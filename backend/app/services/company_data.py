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
    fast_info = _safe_yfinance_fast_info(ticker)
    try:
        info = ticker.info or {}
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        logger.warning("Yahoo Finance fundamentals info fetch failed for %s: %s", symbol, exc)
        info = {}

    if not isinstance(info, dict):
        info = {}

    income_stmt = _pick_first_value(
        _safe_yfinance_statement_frame(lambda: ticker.quarterly_income_stmt, symbol, "quarterly income statement"),
        _safe_yfinance_statement_frame(lambda: ticker.income_stmt, symbol, "annual income statement"),
    )
    balance_sheet = _pick_first_value(
        _safe_yfinance_statement_frame(lambda: ticker.quarterly_balance_sheet, symbol, "quarterly balance sheet"),
        _safe_yfinance_statement_frame(lambda: ticker.balance_sheet, symbol, "annual balance sheet"),
    )

    revenue_values = _extract_statement_values(
        income_stmt,
        ["Total Revenue", "Operating Revenue", "Revenue"],
    )
    net_income_values = _extract_statement_values(
        income_stmt,
        ["Net Income", "Net Income Common Stockholders", "Net Income Including Noncontrolling Interests"],
    )
    gross_profit_values = _extract_statement_values(income_stmt, ["Gross Profit"])
    equity_values = _extract_statement_values(
        balance_sheet,
        ["Stockholders Equity", "Total Stockholder Equity", "Total Equity Gross Minority Interest", "Common Stock Equity"],
    )
    total_assets_values = _extract_statement_values(balance_sheet, ["Total Assets"])
    total_debt_values = _extract_statement_values(
        balance_sheet,
        ["Total Debt", "Total Liabilities Net Minority Interest", "Total Liabilities"],
    )

    current_price = _safe_float(
        _pick_first_value(
            info.get("currentPrice"),
            info.get("regularMarketPrice"),
            fast_info.get("lastPrice"),
            fast_info.get("last_price"),
        )
    )
    shares_outstanding = _safe_float(
        _pick_first_value(
            info.get("sharesOutstanding"),
            info.get("impliedSharesOutstanding"),
            fast_info.get("shares"),
            fast_info.get("sharesOutstanding"),
        )
    )
    market_cap = _safe_float(
        _pick_first_value(
            info.get("marketCap"),
            fast_info.get("marketCap"),
            fast_info.get("market_cap"),
        )
    )
    if market_cap is None and shares_outstanding is not None and current_price is not None:
        market_cap = shares_outstanding * current_price

    float_shares = _safe_float(
        _pick_first_value(
            info.get("floatShares"),
            fast_info.get("floatShares"),
            fast_info.get("float_shares"),
            shares_outstanding,
        )
    )
    float_market_cap = None
    if float_shares is not None and current_price is not None:
        float_market_cap = float_shares * current_price

    latest_revenue = revenue_values[0] if revenue_values else None
    latest_net_income = net_income_values[0] if net_income_values else None
    latest_gross_profit = gross_profit_values[0] if gross_profit_values else None
    latest_equity = equity_values[0] if equity_values else None
    latest_total_assets = total_assets_values[0] if total_assets_values else None
    latest_total_debt = total_debt_values[0] if total_debt_values else None

    pe_ratio = _safe_float(_pick_first_value(info.get("trailingPE"), info.get("forwardPE")))
    if pe_ratio is None and market_cap is not None and latest_net_income not in (None, 0):
        pe_ratio = market_cap / latest_net_income

    pb_ratio = _safe_float(info.get("priceToBook"))
    if pb_ratio is None and market_cap is not None and latest_equity not in (None, 0):
        pb_ratio = market_cap / latest_equity

    roe = _ratio_to_percent(info.get("returnOnEquity"))
    if roe is None and latest_net_income is not None and latest_equity not in (None, 0):
        roe = round((latest_net_income / latest_equity) * 100, 4)

    gross_margin = _ratio_to_percent(info.get("grossMargins"))
    if gross_margin is None and latest_gross_profit is not None and latest_revenue not in (None, 0):
        gross_margin = round((latest_gross_profit / latest_revenue) * 100, 4)

    net_margin = _ratio_to_percent(info.get("profitMargins"))
    if net_margin is None and latest_net_income is not None and latest_revenue not in (None, 0):
        net_margin = round((latest_net_income / latest_revenue) * 100, 4)

    debt_to_asset = None
    if latest_total_debt is not None and latest_total_assets not in (None, 0):
        debt_to_asset = round((latest_total_debt / latest_total_assets) * 100, 4)

    revenue_growth = _ratio_to_percent(info.get("revenueGrowth"))
    if revenue_growth is None:
        revenue_growth = _calculate_growth_percent(revenue_values)

    net_profit_growth = _ratio_to_percent(info.get("earningsGrowth"))
    if net_profit_growth is None:
        net_profit_growth = _calculate_growth_percent(net_income_values)

    company_name = _pick_first_text(
        info.get("shortName"),
        info.get("longName"),
        info.get("displayName"),
        info.get("name"),
        symbol,
    )
    industry = _pick_first_text(info.get("industry"), info.get("sector"))
    listed_date = _normalize_epoch_date(_pick_first_value(info.get("firstTradeDateEpochUtc"), info.get("firstTradeDateMilliseconds")))
    as_of = _resolve_statement_as_of(income_stmt, balance_sheet)

    has_any_signal = any(
        value is not None
        for value in (
            market_cap,
            float_market_cap,
            pe_ratio,
            pb_ratio,
            roe,
            gross_margin,
            net_margin,
            debt_to_asset,
            revenue_growth,
            net_profit_growth,
        )
    ) or bool(industry)

    if not has_any_signal:
        raise SupplementalProviderNotFoundError("Yahoo Finance returned no usable fundamentals")

    return FundamentalsResponse(
        symbol=symbol,
        as_of=as_of,
        providers=[YAHOO_FUNDAMENTALS_PROVIDER],
        company_name=company_name,
        industry=industry,
        listed_date=listed_date,
        market_cap=market_cap,
        float_market_cap=float_market_cap,
        pe_ratio=pe_ratio,
        pb_ratio=pb_ratio,
        roe=roe,
        gross_margin=gross_margin,
        net_margin=net_margin,
        debt_to_asset=debt_to_asset,
        revenue_growth=revenue_growth,
        net_profit_growth=net_profit_growth,
        source_note="美股与非 A 股基本面当前会优先汇总 Yahoo Finance 的概览字段、fast_info 与财报表数据。",
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


def _safe_yfinance_fast_info(ticker: yf.Ticker) -> dict[str, Any]:
    try:
        raw_fast_info = ticker.fast_info or {}
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        logger.warning("Yahoo Finance fast_info fetch failed: %s", exc)
        return {}

    try:
        return dict(raw_fast_info)
    except Exception:
        return {}


def _safe_yfinance_statement_frame(loader: Any, symbol: str, label: str) -> Any | None:
    try:
        frame = loader()
    except Exception as exc:  # pragma: no cover - network/runtime dependent
        logger.warning("Yahoo Finance %s fetch failed for %s: %s", label, symbol, exc)
        return None

    if frame is None or getattr(frame, "empty", True):
        return None
    return frame


def _extract_statement_values(frame: Any, row_labels: list[str]) -> list[float]:
    if frame is None or getattr(frame, "empty", True):
        return []

    index = getattr(frame, "index", None)
    if index is None:
        return []

    normalized_rows = {str(row).strip().casefold(): row for row in index}
    for label in row_labels:
        matched_row = normalized_rows.get(label.casefold())
        if matched_row is None:
            continue

        try:
            series = frame.loc[matched_row]
        except Exception:
            continue

        if hasattr(series, "sort_index"):
            try:
                series = series.sort_index(ascending=False)
            except Exception:
                pass

        values: list[Any]
        if hasattr(series, "tolist"):
            values = list(series.tolist())
        elif isinstance(series, (list, tuple)):
            values = list(series)
        else:
            values = [series]

        parsed_values = [_safe_float(value) for value in values]
        return [value for value in parsed_values if value is not None]

    return []


def _calculate_growth_percent(values: list[float]) -> float | None:
    if len(values) < 2:
        return None

    current_value = values[0]
    previous_value = values[1]
    if previous_value == 0:
        return None

    return round(((current_value - previous_value) / abs(previous_value)) * 100, 4)


def _resolve_statement_as_of(*frames: Any) -> datetime:
    for frame in frames:
        if frame is None or getattr(frame, "empty", True):
            continue

        columns = list(getattr(frame, "columns", []))
        if not columns:
            continue

        try:
            latest_column = sorted(columns, reverse=True)[0]
        except Exception:
            latest_column = columns[0]
        return _coerce_datetime(latest_column)

    return datetime.now(timezone.utc)


def _normalize_epoch_date(value: Any) -> str | None:
    if value is None:
        return None

    parsed = _safe_float(value)
    if parsed is None:
        return None

    if parsed > 10_000_000_000:
        parsed /= 1000

    try:
        return datetime.fromtimestamp(parsed, tz=timezone.utc).date().isoformat()
    except (OverflowError, OSError, ValueError):
        return None
