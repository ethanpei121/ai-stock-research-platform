from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any

import yfinance as yf

from app.core.cache import TTLCache
from app.core.config import get_settings
from app.core.errors import APIError
from app.schemas.market import AnnouncementItem, AnnouncementsResponse, FundamentalsResponse, NewsItem, QuoteResponse

try:
    import akshare as ak
except Exception:  # pragma: no cover - optional dependency at runtime
    ak = None

try:
    import tushare as ts
except Exception:  # pragma: no cover - optional dependency at runtime
    ts = None


logger = logging.getLogger(__name__)

AKSHARE_QUOTE_PROVIDER = "AkShare / Eastmoney Quote"
AKSHARE_XUEQIU_QUOTE_PROVIDER = "AkShare / Xueqiu Quote"
AKSHARE_NEWS_PROVIDER = "AkShare / Eastmoney News"
AKSHARE_FUNDAMENTALS_PROVIDER = "AkShare / Eastmoney Fundamentals"
EASTMONEY_NOTICE_PROVIDER = "AkShare / Eastmoney Notices"
CNINFO_PROVIDER = "CNINFO Disclosure"
TUSHARE_FUNDAMENTALS_PROVIDER = "Tushare Fundamentals"
TUSHARE_ANNOUNCEMENT_PROVIDER = "Tushare Announcements"
YAHOO_FUNDAMENTALS_PROVIDER = "Yahoo Finance Fundamentals"

FUNDAMENTALS_CACHE = TTLCache[FundamentalsResponse](ttl_seconds=21600)
ANNOUNCEMENTS_CACHE = TTLCache[list[AnnouncementItem]](ttl_seconds=900)


class SupplementalProviderUnavailableError(Exception):
    pass


class SupplementalProviderNotFoundError(Exception):
    pass


@lru_cache(maxsize=1)
def _get_tushare_client() -> Any | None:
    settings = get_settings()
    if not settings.tushare_token or ts is None:
        return None
    return ts.pro_api(settings.tushare_token)


def is_a_share_symbol(symbol: str) -> bool:
    return symbol.endswith((".SZ", ".SS", ".BJ"))


def validate_announcements_limit(limit: int) -> int:
    if limit < 1 or limit > 20:
        raise APIError(
            status_code=400,
            code="INVALID_LIMIT",
            message="limit 必须在 1 到 20 之间。",
            details={"limit": limit},
        )
    return limit


def fetch_quote_from_akshare(symbol: str) -> QuoteResponse:
    if not is_a_share_symbol(symbol):
        raise SupplementalProviderNotFoundError("AkShare quote fallback only supports A-share symbols")
    if ak is None:
        raise SupplementalProviderUnavailableError("akshare is not installed")

    unavailable = False
    for fetcher in (_fetch_quote_from_akshare_xueqiu, _fetch_quote_from_akshare_snapshot):
        try:
            return fetcher(symbol)
        except SupplementalProviderNotFoundError:
            continue
        except SupplementalProviderUnavailableError as exc:
            unavailable = True
            logger.warning("AkShare quote fetch failed for %s via %s: %s", symbol, fetcher.__name__, exc)

    if unavailable:
        raise SupplementalProviderUnavailableError("AkShare quote request failed")

    raise SupplementalProviderNotFoundError("AkShare returned no matching A-share quote")


def _fetch_quote_from_akshare_xueqiu(symbol: str) -> QuoteResponse:
    try:
        quote_df = ak.stock_individual_spot_xq(symbol=_to_akshare_xueqiu_symbol(symbol), timeout=8)
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        raise SupplementalProviderUnavailableError("AkShare Xueqiu quote request failed") from exc

    item_map = _rows_to_item_map(quote_df)
    if not item_map:
        raise SupplementalProviderNotFoundError("AkShare Xueqiu returned empty quote payload")

    price = _safe_float(_item_map_value(item_map, "现价", "最新价", "最新", "current"))
    change = _safe_float(_item_map_value(item_map, "涨跌", "涨跌额", "change"))
    change_percent = _safe_float(_item_map_value(item_map, "涨幅", "涨跌幅", "change_percent"))
    previous_close = _safe_float(_item_map_value(item_map, "昨收", "前收盘", "昨收价", "pre_close", "previous_close"))
    market_time = _coerce_datetime(_item_map_value(item_map, "时间", "更新时间", "交易时间"))
    currency = _pick_first_text(_item_map_value(item_map, "货币", "currency"), "CNY") or "CNY"

    if price is None:
        raise SupplementalProviderNotFoundError("AkShare Xueqiu returned empty quote price")
    if change is None and previous_close is not None:
        change = price - previous_close
    if change_percent is None and previous_close not in (None, 0):
        change_percent = ((price - previous_close) / previous_close) * 100

    return QuoteResponse(
        symbol=symbol,
        price=round(price, 4),
        change=round(change or 0.0, 4),
        change_percent=round(change_percent or 0.0, 4),
        currency=currency,
        market_time=market_time,
        provider=AKSHARE_XUEQIU_QUOTE_PROVIDER,
    )


def _fetch_quote_from_akshare_snapshot(symbol: str) -> QuoteResponse:
    try:
        quote_df = ak.stock_zh_a_spot_em()
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        raise SupplementalProviderUnavailableError("AkShare snapshot quote request failed") from exc

    row = _find_row_by_code(quote_df, _base_symbol(symbol))
    if row is None:
        raise SupplementalProviderNotFoundError("AkShare returned no matching A-share quote")

    price = _safe_float(row.get("最新价"))
    change = _safe_float(row.get("涨跌额"))
    change_percent = _safe_float(row.get("涨跌幅"))
    previous_close = _safe_float(row.get("昨收"))
    market_time = _coerce_datetime(_pick_first_value(row.get("时间戳"), row.get("更新时间")))

    if price is None:
        raise SupplementalProviderNotFoundError("AkShare returned empty quote price")
    if change is None and previous_close is not None:
        change = price - previous_close
    if change_percent is None and previous_close not in (None, 0):
        change_percent = ((price - previous_close) / previous_close) * 100

    return QuoteResponse(
        symbol=symbol,
        price=round(price, 4),
        change=round(change or 0.0, 4),
        change_percent=round(change_percent or 0.0, 4),
        currency="CNY",
        market_time=market_time,
        provider=AKSHARE_QUOTE_PROVIDER,
    )


def fetch_eastmoney_news_items(symbol: str) -> list[NewsItem]:
    if not is_a_share_symbol(symbol) or ak is None:
        return []

    try:
        news_df = ak.stock_news_em(symbol=_base_symbol(symbol))
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        logger.warning("AkShare Eastmoney news fetch failed for %s: %s", symbol, exc)
        return []

    items: list[NewsItem] = []
    for row in _iter_rows(news_df):
        title = _pick_first_text(row.get("新闻标题"), row.get("标题"), row.get("title"))
        url = _pick_first_text(row.get("新闻链接"), row.get("url"), row.get("链接"))
        published_at = _coerce_datetime(
            _pick_first_value(row.get("发布时间"), row.get("日期"), row.get("time"))
        )
        publisher = _pick_first_text(row.get("文章来源"), row.get("来源"), AKSHARE_NEWS_PROVIDER)
        if not title or not url:
            continue
        items.append(
            NewsItem(
                title=title,
                url=url,
                published_at=published_at,
                source=_compose_source(AKSHARE_NEWS_PROVIDER, publisher),
            )
        )
        if len(items) >= 20:
            break

    return items


def get_fundamentals(symbol: str) -> FundamentalsResponse:
    cached = FUNDAMENTALS_CACHE.get(symbol)
    if cached is not None:
        return cached

    fetchers: list[Any] = []
    if is_a_share_symbol(symbol):
        fetchers.append(_fetch_fundamentals_from_akshare)
        if get_settings().tushare_token:
            fetchers.insert(0, _fetch_fundamentals_from_tushare)
    else:
        fetchers.append(_fetch_fundamentals_from_yfinance)

    unavailable = False
    for fetcher in fetchers:
        try:
            return FUNDAMENTALS_CACHE.set(symbol, fetcher(symbol))
        except SupplementalProviderNotFoundError:
            continue
        except SupplementalProviderUnavailableError as exc:
            unavailable = True
            logger.warning("Fundamentals provider failed for %s via %s: %s", symbol, fetcher.__name__, exc)

    if unavailable:
        raise APIError(
            status_code=502,
            code="FUNDAMENTALS_SOURCE_UNAVAILABLE",
            message="基本面数据源暂时不可用，请稍后重试。",
        )

    raise APIError(
        status_code=404,
        code="FUNDAMENTALS_NOT_FOUND",
        message=f"未找到股票代码 {symbol} 的基本面数据。",
        details={"symbol": symbol},
    )


def get_announcements(symbol: str, limit: int = 5) -> AnnouncementsResponse:
    validated_limit = validate_announcements_limit(limit)

    if not is_a_share_symbol(symbol):
        raise APIError(
            status_code=404,
            code="ANNOUNCEMENTS_NOT_SUPPORTED",
            message="公告接口当前主要支持 A 股官方披露数据。",
            details={"symbol": symbol},
        )

    cached_items = ANNOUNCEMENTS_CACHE.get(symbol)
    if cached_items is None:
        cached_items = _fetch_announcement_items(symbol)
        if not cached_items:
            raise APIError(
                status_code=404,
                code="ANNOUNCEMENTS_NOT_FOUND",
                message=f"未找到股票代码 {symbol} 的公告数据。",
                details={"symbol": symbol},
            )
        ANNOUNCEMENTS_CACHE.set(symbol, cached_items)

    items = cached_items[:validated_limit]
    return AnnouncementsResponse(
        symbol=symbol,
        count=len(items),
        items=items,
        providers=_extract_providers(items),
    )


def _fetch_fundamentals_from_akshare(symbol: str) -> FundamentalsResponse:
    if ak is None:
        raise SupplementalProviderUnavailableError("akshare is not installed")

    code = _base_symbol(symbol)
    try:
        info_df = ak.stock_individual_info_em(symbol=code)
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        raise SupplementalProviderUnavailableError("AkShare individual info request failed") from exc

    info_map = {
        str(row.get("item") or "").strip(): row.get("value")
        for row in _iter_rows(info_df)
        if str(row.get("item") or "").strip()
    }
    if not info_map:
        raise SupplementalProviderNotFoundError("AkShare returned empty individual info")

    spot_row = None
    try:
        spot_row = _find_row_by_code(ak.stock_zh_a_spot_em(), code)
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        logger.warning("AkShare spot fundamentals supplement failed for %s: %s", symbol, exc)

    fa_row: dict[str, Any] = {}
    try:
        fa_df = ak.stock_financial_analysis_indicator_em(symbol=code)
        fa_rows = _iter_rows(fa_df)
        if fa_rows:
            fa_row = fa_rows[0]
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        logger.warning("AkShare financial indicator fetch failed for %s: %s", symbol, exc)

    providers = [AKSHARE_FUNDAMENTALS_PROVIDER]
    if spot_row:
        providers.append(AKSHARE_QUOTE_PROVIDER)

    return FundamentalsResponse(
        symbol=symbol,
        as_of=_coerce_datetime(_pick_first_value(fa_row.get("报告期"), fa_row.get("REPORT_DATE"), datetime.now(timezone.utc))),
        providers=list(dict.fromkeys(providers)),
        company_name=_pick_first_text(info_map.get("股票简称"), info_map.get("证券简称")),
        industry=_pick_first_text(info_map.get("行业"), info_map.get("所属行业")),
        listed_date=_normalize_date_text(info_map.get("上市时间")),
        market_cap=_safe_float(_pick_first_value(info_map.get("总市值"), spot_row.get("总市值") if spot_row else None)),
        float_market_cap=_safe_float(_pick_first_value(info_map.get("流通市值"), spot_row.get("流通市值") if spot_row else None)),
        pe_ratio=_safe_float(spot_row.get("市盈率-动态") if spot_row else None),
        pb_ratio=_safe_float(spot_row.get("市净率") if spot_row else None),
        roe=_safe_float(_first_value_from_columns(fa_row, ["净资产收益率(%)", "净资产收益率", "加权净资产收益率(%)", "ROEJQ"])),
        gross_margin=_safe_float(_first_value_from_columns(fa_row, ["销售毛利率(%)", "销售毛利率", "毛利率", "XSMLL"])),
        net_margin=_safe_float(_first_value_from_columns(fa_row, ["销售净利率(%)", "销售净利率", "净利率", "XSJLL"])),
        debt_to_asset=_safe_float(_first_value_from_columns(fa_row, ["资产负债率(%)", "资产负债率", "ZCFZL"])),
        revenue_growth=_safe_float(_first_value_from_columns(fa_row, ["营业总收入同比增长(%)", "营业收入同比增长(%)", "营业收入同比增长", "TOTALOPERATEREVTZ", "营业总收入同比"])),
        net_profit_growth=_safe_float(_first_value_from_columns(fa_row, ["归属净利润同比增长(%)", "净利润同比增长(%)", "归母净利润同比增长(%)", "PARENTNETPROFITTZ", "净利润同比增长"])),
        source_note="A 股基本面优先来自东方财富与 AkShare 包装接口，适合演示与研究入口。",
    )


def _fetch_fundamentals_from_tushare(symbol: str) -> FundamentalsResponse:
    client = _get_tushare_client()
    if client is None:
        raise SupplementalProviderUnavailableError("tushare client is not configured")

    ts_code = _to_ts_code(symbol)
    today = datetime.now(timezone.utc)
    start_date = (today - timedelta(days=180)).strftime("%Y%m%d")
    end_date = today.strftime("%Y%m%d")

    try:
        basic_df = client.stock_basic(ts_code=ts_code, fields="ts_code,symbol,name,area,industry,market,list_date")
        daily_df = client.daily_basic(
            ts_code=ts_code,
            start_date=start_date,
            end_date=end_date,
            fields="ts_code,trade_date,pe,pb,total_mv,circ_mv",
        )
        fina_df = client.fina_indicator(
            ts_code=ts_code,
            start_date=start_date,
            end_date=end_date,
            fields="ts_code,ann_date,end_date,roe,grossprofit_margin,netprofit_margin,debt_to_assets,q_sales_yoy,q_dtprofit_yoy",
        )
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        raise SupplementalProviderUnavailableError("Tushare fundamentals request failed") from exc

    basic_rows = _iter_rows(basic_df)
    if not basic_rows:
        raise SupplementalProviderNotFoundError("Tushare returned no basic company data")

    basic_row = basic_rows[0]
    daily_rows = _sort_rows_desc(_iter_rows(daily_df), ("trade_date",))
    fina_rows = _sort_rows_desc(_iter_rows(fina_df), ("end_date", "ann_date"))
    daily_row = daily_rows[0] if daily_rows else {}
    fina_row = fina_rows[0] if fina_rows else {}

    return FundamentalsResponse(
        symbol=symbol,
        as_of=_coerce_datetime(_pick_first_value(fina_row.get("ann_date"), fina_row.get("end_date"), daily_row.get("trade_date"), datetime.now(timezone.utc))),
        providers=[TUSHARE_FUNDAMENTALS_PROVIDER],
        company_name=_pick_first_text(basic_row.get("name")),
        industry=_pick_first_text(basic_row.get("industry")),
        listed_date=_normalize_date_text(basic_row.get("list_date")),
        market_cap=_safe_float(daily_row.get("total_mv")),
        float_market_cap=_safe_float(daily_row.get("circ_mv")),
        pe_ratio=_safe_float(daily_row.get("pe")),
        pb_ratio=_safe_float(daily_row.get("pb")),
        roe=_safe_float(fina_row.get("roe")),
        gross_margin=_safe_float(fina_row.get("grossprofit_margin")),
        net_margin=_safe_float(fina_row.get("netprofit_margin")),
        debt_to_asset=_safe_float(fina_row.get("debt_to_assets")),
        revenue_growth=_safe_float(fina_row.get("q_sales_yoy")),
        net_profit_growth=_safe_float(fina_row.get("q_dtprofit_yoy")),
        source_note="若已配置 TUSHARE_TOKEN，则优先使用 Tushare 财务指标补充 A 股基本面。",
    )


def _fetch_fundamentals_from_yfinance(symbol: str) -> FundamentalsResponse:
    ticker = yf.Ticker(symbol)
    try:
        info = ticker.info or {}
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        raise SupplementalProviderUnavailableError("Yahoo Finance fundamentals request failed") from exc

    if not isinstance(info, dict) or not info:
        raise SupplementalProviderNotFoundError("Yahoo Finance returned empty fundamentals")

    company_name = _pick_first_text(info.get("shortName"), info.get("longName"))
    if not company_name:
        raise SupplementalProviderNotFoundError("Yahoo Finance returned no company name")

    float_shares = _safe_float(info.get("floatShares"))
    current_price = _safe_float(info.get("currentPrice")) or _safe_float(info.get("regularMarketPrice"))
    float_market_cap = None
    if float_shares is not None and current_price is not None:
        float_market_cap = float_shares * current_price

    return FundamentalsResponse(
        symbol=symbol,
        as_of=datetime.now(timezone.utc),
        providers=[YAHOO_FUNDAMENTALS_PROVIDER],
        company_name=company_name,
        industry=_pick_first_text(info.get("industry"), info.get("sector")),
        listed_date=None,
        market_cap=_safe_float(info.get("marketCap")),
        float_market_cap=float_market_cap,
        pe_ratio=_safe_float(_pick_first_value(info.get("trailingPE"), info.get("forwardPE"))),
        pb_ratio=_safe_float(info.get("priceToBook")),
        roe=_ratio_to_percent(info.get("returnOnEquity")),
        gross_margin=_ratio_to_percent(info.get("grossMargins")),
        net_margin=_ratio_to_percent(info.get("profitMargins")),
        debt_to_asset=None,
        revenue_growth=_ratio_to_percent(info.get("revenueGrowth")),
        net_profit_growth=_ratio_to_percent(info.get("earningsGrowth")),
        source_note="美股与非 A 股基本面当前主要通过 Yahoo Finance 获取。",
    )


def _fetch_announcement_items(symbol: str) -> list[AnnouncementItem]:
    aggregated: list[AnnouncementItem] = []
    aggregated.extend(_fetch_cninfo_announcements(symbol))
    aggregated.extend(_fetch_eastmoney_notice_announcements(symbol))
    if get_settings().tushare_token:
        aggregated.extend(_fetch_tushare_announcements(symbol))
    return _merge_announcement_items(aggregated)


def _fetch_cninfo_announcements(symbol: str) -> list[AnnouncementItem]:
    if ak is None:
        return []

    end_date = datetime.now(timezone.utc).strftime("%Y%m%d")
    start_date = (datetime.now(timezone.utc) - timedelta(days=180)).strftime("%Y%m%d")

    try:
        disclosure_df = ak.stock_zh_a_disclosure_report_cninfo(
            symbol=_base_symbol(symbol),
            market="沪深京",
            keyword="",
            category="",
            start_date=start_date,
            end_date=end_date,
        )
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        logger.warning("CNINFO announcement fetch failed for %s: %s", symbol, exc)
        return []

    items: list[AnnouncementItem] = []
    for row in _iter_rows(disclosure_df):
        title = _pick_first_text(row.get("公告标题"), row.get("title"))
        url = _pick_first_text(row.get("公告链接"), row.get("url"))
        published_at = _coerce_datetime(_pick_first_value(row.get("公告时间"), row.get("ann_date")))
        if not title or not url:
            continue
        items.append(
            AnnouncementItem(
                title=title,
                url=url,
                published_at=published_at,
                source=CNINFO_PROVIDER,
                category=None,
            )
        )
        if len(items) >= 20:
            break

    return items


def _fetch_eastmoney_notice_announcements(symbol: str) -> list[AnnouncementItem]:
    if ak is None:
        return []

    code = _base_symbol(symbol)
    categories = ["全部", "重大事项", "财务报告", "风险提示"]
    dates = [
        (datetime.now(timezone.utc) - timedelta(days=offset)).strftime("%Y%m%d")
        for offset in range(0, 10)
    ]

    items: list[AnnouncementItem] = []
    for category in categories:
        for date in dates:
            try:
                notice_df = ak.stock_notice_report(symbol=category, date=date)
            except Exception as exc:  # pragma: no cover - network/runtime dependent
                logger.warning("Eastmoney notice fetch failed for %s on %s/%s: %s", symbol, category, date, exc)
                continue

            for row in _iter_rows(notice_df):
                row_code = _normalize_code_text(row.get("代码"))
                if row_code != code:
                    continue
                title = _pick_first_text(row.get("公告标题"), row.get("title"))
                url = _pick_first_text(row.get("网址"), row.get("url"))
                published_at = _coerce_datetime(_pick_first_value(row.get("公告日期"), date))
                notice_category = _pick_first_text(row.get("公告类型"), category)
                if not title or not url:
                    continue
                items.append(
                    AnnouncementItem(
                        title=title,
                        url=url,
                        published_at=published_at,
                        source=EASTMONEY_NOTICE_PROVIDER,
                        category=notice_category,
                    )
                )
                if len(items) >= 20:
                    return _merge_announcement_items(items)

    return _merge_announcement_items(items)


def _fetch_tushare_announcements(symbol: str) -> list[AnnouncementItem]:
    client = _get_tushare_client()
    if client is None:
        return []

    ts_code = _to_ts_code(symbol)
    end_date = datetime.now(timezone.utc).strftime("%Y%m%d")
    start_date = (datetime.now(timezone.utc) - timedelta(days=120)).strftime("%Y%m%d")

    try:
        announcements_df = client.anns_d(
            ts_code=ts_code,
            start_date=start_date,
            end_date=end_date,
        )
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        logger.warning("Tushare announcements fetch failed for %s: %s", symbol, exc)
        return []

    items: list[AnnouncementItem] = []
    for row in _sort_rows_desc(_iter_rows(announcements_df), ("ann_date", "rec_time")):
        title = _pick_first_text(row.get("title"))
        url = _pick_first_text(row.get("url"))
        published_at = _coerce_datetime(_pick_first_value(row.get("rec_time"), row.get("ann_date")))
        if not title or not url:
            continue
        items.append(
            AnnouncementItem(
                title=title,
                url=url,
                published_at=published_at,
                source=TUSHARE_ANNOUNCEMENT_PROVIDER,
                category=None,
            )
        )
        if len(items) >= 20:
            break

    return items


def _find_row_by_code(dataframe: Any, code: str) -> dict[str, Any] | None:
    for row in _iter_rows(dataframe):
        row_code = _normalize_code_text(row.get("代码"))
        if row_code == code:
            return row
    return None


def _iter_rows(dataframe: Any) -> list[dict[str, Any]]:
    if dataframe is None:
        return []
    try:
        rows = dataframe.to_dict("records")
    except Exception:
        return []
    return [row for row in rows if isinstance(row, dict)]


def _base_symbol(symbol: str) -> str:
    return symbol.split(".", 1)[0]


def _to_akshare_xueqiu_symbol(symbol: str) -> str:
    code = _base_symbol(symbol)
    if symbol.endswith(".SZ"):
        return f"SZ{code}"
    if symbol.endswith(".SS"):
        return f"SH{code}"
    if symbol.endswith(".BJ"):
        return f"BJ{code}"
    return code


def _to_ts_code(symbol: str) -> str:
    if symbol.endswith((".SZ", ".SS", ".BJ")):
        return symbol
    code = _base_symbol(symbol)
    if code.startswith(("0", "3")):
        return f"{code}.SZ"
    if code.startswith(("5", "6", "9")):
        return f"{code}.SS"
    if code.startswith(("4", "8")):
        return f"{code}.BJ"
    return symbol


def _normalize_code_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    digits = "".join(character for character in text if character.isdigit())
    if len(digits) >= 6:
        return digits[-6:]
    return digits.zfill(6) if digits else ""


def _sort_rows_desc(rows: list[dict[str, Any]], keys: tuple[str, ...]) -> list[dict[str, Any]]:
    def key_func(row: dict[str, Any]) -> tuple[str, ...]:
        return tuple(str(row.get(key) or "") for key in keys)

    return sorted(rows, key=key_func, reverse=True)


def _merge_announcement_items(items: list[AnnouncementItem]) -> list[AnnouncementItem]:
    merged: list[AnnouncementItem] = []
    seen: set[str] = set()
    for item in sorted(items, key=lambda current: current.published_at, reverse=True):
        key = (item.url or item.title).strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(item)
        if len(merged) >= 20:
            break
    return merged


def _extract_providers(items: list[AnnouncementItem]) -> list[str]:
    providers: list[str] = []
    seen: set[str] = set()
    for item in items:
        provider = item.source.split(" / ", 1)[0].strip()
        if provider and provider not in seen:
            seen.add(provider)
            providers.append(provider)
    return providers


def _first_value_from_columns(row: dict[str, Any], columns: list[str]) -> Any:
    for column in columns:
        if column in row and row.get(column) not in (None, ""):
            return row.get(column)
    return None


def _compose_source(provider: str, publisher: str | None) -> str:
    if publisher and publisher != provider:
        return f"{provider} / {publisher}"
    return provider


def _rows_to_item_map(dataframe: Any) -> dict[str, Any]:
    item_map: dict[str, Any] = {}
    for row in _iter_rows(dataframe):
        key = _pick_first_text(row.get("item"), row.get("项目"), row.get("名称"), row.get("key"))
        value = _pick_first_value(row.get("value"), row.get("值"), row.get("数据"))
        if not key or value is None:
            continue
        item_map[key] = value
    return item_map


def _item_map_value(item_map: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in item_map and item_map[key] not in (None, ""):
            return item_map[key]
    return None


def _pick_first_text(*values: Any) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _pick_first_value(*values: Any) -> Any:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def _coerce_datetime(value: Any) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if hasattr(value, "to_pydatetime"):
        value = value.to_pydatetime()
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        normalized = value.strip().replace("Z", "+00:00")
        for fmt in (None, "%Y%m%d", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
            try:
                if fmt is None:
                    parsed = datetime.fromisoformat(normalized)
                else:
                    parsed = datetime.strptime(normalized, fmt)
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
    return datetime.now(timezone.utc)


def _normalize_date_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if len(text) == 8 and text.isdigit():
        return f"{text[:4]}-{text[4:6]}-{text[6:8]}"
    return text


def _safe_float(value: Any) -> float | None:
    if isinstance(value, str):
        cleaned = value.replace(",", "").replace("%", "").strip()
        if not cleaned:
            return None
        value = cleaned
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(parsed) or math.isinf(parsed):
        return None
    return round(parsed, 4)


def _ratio_to_percent(value: Any) -> float | None:
    parsed = _safe_float(value)
    if parsed is None:
        return None
    if abs(parsed) <= 1:
        parsed *= 100
    return round(parsed, 4)
