from __future__ import annotations

import logging
import math
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from xml.etree import ElementTree

import httpx
import yfinance as yf

from app.core.cache import TTLCache
from app.core.config import get_settings
from app.core.errors import APIError
from app.schemas.market import NewsItem, NewsResponse, QuoteResponse
from app.services.company_data import (
    AKSHARE_QUOTE_PROVIDER,
    SupplementalProviderNotFoundError,
    SupplementalProviderUnavailableError,
    fetch_eastmoney_news_items,
    fetch_quote_from_akshare,
    is_a_share_symbol,
)


logger = logging.getLogger(__name__)

SYMBOL_PATTERN = re.compile(r"^[A-Za-z0-9.\-^=]{1,10}$")
US_SYMBOL_PATTERN = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")
QUOTE_CACHE = TTLCache[QuoteResponse](ttl_seconds=60)
NEWS_CACHE = TTLCache[list[NewsItem]](ttl_seconds=180)
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; AIStockResearchPlatform/1.0; +https://ai-stock-research-platform.vercel.app)",
}
YAHOO_FINANCE_PROVIDER = "Yahoo Finance"
ALPHA_VANTAGE_PROVIDER = "Alpha Vantage"
FINNHUB_PROVIDER = "Finnhub"
GOOGLE_NEWS_PROVIDER = "Google News RSS"
MOCK_PROVIDER = "mock:fallback"


class ProviderUnavailableError(Exception):
    pass


class ProviderNotFoundError(Exception):
    pass


def normalize_symbol(symbol: str) -> str:
    normalized = symbol.strip().upper()
    if not normalized:
        raise APIError(
            status_code=400,
            code="INVALID_SYMBOL",
            message="股票代码不能为空，请输入类似 AAPL 的代码。",
        )

    normalized = _normalize_regional_symbol(normalized)

    if not SYMBOL_PATTERN.fullmatch(normalized):
        raise APIError(
            status_code=400,
            code="INVALID_SYMBOL",
            message="股票代码格式无效，请输入合法代码，例如 AAPL、300750.SZ、600519.SS、0700.HK。",
            details={"symbol": normalized},
        )
    return normalized


def validate_news_limit(limit: int) -> int:
    if limit < 1 or limit > 20:
        raise APIError(
            status_code=400,
            code="INVALID_LIMIT",
            message="limit 必须在 1 到 20 之间。",
            details={"limit": limit},
        )
    return limit


def get_quote(symbol: str, *, force_refresh: bool = False) -> QuoteResponse:
    normalized_symbol = normalize_symbol(symbol)

    if not force_refresh:
        cached_quote = QUOTE_CACHE.get(normalized_symbol)
        if cached_quote is not None:
            return cached_quote

    settings = get_settings()
    fetchers: list[tuple[str, Any]] = []
    if is_a_share_symbol(normalized_symbol):
        fetchers.append((AKSHARE_QUOTE_PROVIDER, lambda: fetch_quote_from_akshare(normalized_symbol)))

    fetchers.append((YAHOO_FINANCE_PROVIDER, lambda: _fetch_quote_from_yfinance(normalized_symbol)))

    if settings.alpha_vantage_api_key:
        fetchers.append(
            (
                ALPHA_VANTAGE_PROVIDER,
                lambda: _fetch_quote_from_alpha_vantage(normalized_symbol, settings.alpha_vantage_api_key or ""),
            )
        )
    if settings.finnhub_api_key:
        fetchers.append(
            (
                FINNHUB_PROVIDER,
                lambda: _fetch_quote_from_finnhub(normalized_symbol, settings.finnhub_api_key or ""),
            )
        )

    unavailable_providers: list[str] = []
    not_found_seen = False

    for provider_name, fetcher in fetchers:
        try:
            quote = fetcher()
            return QUOTE_CACHE.set(normalized_symbol, quote)
        except (ProviderNotFoundError, SupplementalProviderNotFoundError) as exc:
            not_found_seen = True
            logger.info("Quote not found from %s for %s: %s", provider_name, normalized_symbol, exc)
        except (ProviderUnavailableError, SupplementalProviderUnavailableError) as exc:
            unavailable_providers.append(provider_name)
            logger.warning("Quote provider %s unavailable for %s: %s", provider_name, normalized_symbol, exc)

    if not_found_seen:
        raise APIError(
            status_code=404,
            code="QUOTE_NOT_FOUND",
            message=f"未找到股票代码 {normalized_symbol} 的行情数据。",
            details={"symbol": normalized_symbol},
        )

    raise APIError(
        status_code=502,
        code="QUOTE_SOURCE_UNAVAILABLE",
        message="行情数据源暂时不可用，请稍后重试。",
        details={"providers": unavailable_providers or None},
    )


def get_news(symbol: str, limit: int = 5, *, force_refresh: bool = False) -> NewsResponse:
    normalized_symbol = normalize_symbol(symbol)
    validated_limit = validate_news_limit(limit)

    if force_refresh:
        cached_items = _fetch_news_items(normalized_symbol)
        NEWS_CACHE.set(normalized_symbol, cached_items)
    else:
        cached_items = NEWS_CACHE.get(normalized_symbol)
        if cached_items is None:
            cached_items = _fetch_news_items(normalized_symbol)
            NEWS_CACHE.set(normalized_symbol, cached_items)

    items = cached_items[:validated_limit]
    return NewsResponse(
        symbol=normalized_symbol,
        count=len(items),
        items=items,
        providers=_extract_news_providers(items),
    )


def _fetch_quote_from_yfinance(symbol: str) -> QuoteResponse:
    ticker = yf.Ticker(symbol)
    fast_info = _safe_fast_info(ticker)

    try:
        intraday_history = ticker.history(period="1d", interval="1m", auto_adjust=False)
    except Exception as exc:
        logger.warning("Intraday quote fetch failed for %s: %s", symbol, exc)
        intraday_history = None

    close_point = _extract_latest_close(intraday_history)
    if close_point is None:
        try:
            daily_history = ticker.history(period="5d", interval="1d", auto_adjust=False)
        except Exception as exc:
            raise ProviderUnavailableError("yfinance history request failed") from exc

        close_point = _extract_latest_close(daily_history)
        if close_point is None:
            raise ProviderNotFoundError("yfinance returned empty quote history")

    price = close_point["price"]
    market_time = close_point["market_time"]
    previous_close = _resolve_previous_close(
        fast_info=fast_info,
        current_price=price,
        symbol=symbol,
    )
    change = round(price - previous_close, 4)
    change_percent = round((change / previous_close) * 100, 4) if previous_close else 0.0
    currency = str(fast_info.get("currency") or _infer_currency(symbol))

    return QuoteResponse(
        symbol=symbol,
        price=round(price, 4),
        change=change,
        change_percent=change_percent,
        currency=currency,
        market_time=market_time,
        provider=YAHOO_FINANCE_PROVIDER,
    )


def _fetch_quote_from_alpha_vantage(symbol: str, api_key: str) -> QuoteResponse:
    mapped_symbol = _map_alpha_vantage_symbol(symbol)
    if not mapped_symbol:
        raise ProviderNotFoundError("symbol is not supported by Alpha Vantage mapping")

    try:
        with httpx.Client(timeout=15.0, headers=DEFAULT_HEADERS, follow_redirects=True) as client:
            response = client.get(
                "https://www.alphavantage.co/query",
                params={
                    "function": "GLOBAL_QUOTE",
                    "symbol": mapped_symbol,
                    "apikey": api_key,
                },
            )
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        raise ProviderUnavailableError("Alpha Vantage quote request failed") from exc

    if payload.get("Note") or payload.get("Information"):
        raise ProviderUnavailableError(str(payload.get("Note") or payload.get("Information")))

    quote_payload = payload.get("Global Quote")
    if not isinstance(quote_payload, dict) or not quote_payload:
        raise ProviderNotFoundError("Alpha Vantage returned no quote payload")

    price = _safe_float(quote_payload.get("05. price"))
    if price is None:
        raise ProviderNotFoundError("Alpha Vantage returned empty price")

    previous_close = _safe_float(quote_payload.get("08. previous close"))
    change = _safe_float(quote_payload.get("09. change"))
    change_percent = _parse_percent(quote_payload.get("10. change percent"))

    if previous_close is None and change is not None:
        previous_close = price - change
    if change is None and previous_close is not None:
        change = round(price - previous_close, 4)
    if change_percent is None and previous_close:
        change_percent = round(((price - previous_close) / previous_close) * 100, 4)

    market_time = _coerce_datetime(quote_payload.get("07. latest trading day"))

    return QuoteResponse(
        symbol=symbol,
        price=round(price, 4),
        change=round(change or 0.0, 4),
        change_percent=round(change_percent or 0.0, 4),
        currency=_infer_currency(symbol),
        market_time=market_time,
        provider=ALPHA_VANTAGE_PROVIDER,
    )


def _fetch_quote_from_finnhub(symbol: str, api_key: str) -> QuoteResponse:
    if not US_SYMBOL_PATTERN.fullmatch(symbol) or symbol.endswith((".SZ", ".SS", ".BJ")):
        raise ProviderNotFoundError("Finnhub fallback only handles standard tickers")

    try:
        with httpx.Client(timeout=15.0, headers=DEFAULT_HEADERS, follow_redirects=True) as client:
            response = client.get(
                "https://finnhub.io/api/v1/quote",
                params={"symbol": symbol, "token": api_key},
            )
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        raise ProviderUnavailableError("Finnhub quote request failed") from exc

    current_price = _safe_float(payload.get("c"))
    previous_close = _safe_float(payload.get("pc"))
    if current_price is None:
        raise ProviderNotFoundError("Finnhub returned empty current price")

    change = _safe_float(payload.get("d"))
    if change is None and previous_close is not None:
        change = current_price - previous_close

    change_percent = _safe_float(payload.get("dp"))
    if change_percent is None and previous_close:
        change_percent = ((current_price - previous_close) / previous_close) * 100

    return QuoteResponse(
        symbol=symbol,
        price=round(current_price, 4),
        change=round(change or 0.0, 4),
        change_percent=round(change_percent or 0.0, 4),
        currency="USD",
        market_time=_coerce_datetime(payload.get("t")),
        provider=FINNHUB_PROVIDER,
    )


def _fetch_news_items(symbol: str) -> list[NewsItem]:
    aggregated_items: list[NewsItem] = []

    if is_a_share_symbol(symbol):
        aggregated_items.extend(fetch_eastmoney_news_items(symbol))

    aggregated_items.extend(_fetch_yfinance_news_items(symbol))

    settings = get_settings()
    if settings.alpha_vantage_api_key:
        aggregated_items.extend(_fetch_alpha_vantage_news_items(symbol, settings.alpha_vantage_api_key))

    aggregated_items.extend(_fetch_google_news_items(symbol))
    deduplicated_items = _merge_news_items(aggregated_items)

    if deduplicated_items:
        return deduplicated_items[:20]

    return _build_mock_news(symbol)


def _fetch_yfinance_news_items(symbol: str) -> list[NewsItem]:
    try:
        raw_news = yf.Ticker(symbol).news or []
    except Exception as exc:
        logger.warning("yfinance news fetch failed for %s: %s", symbol, exc)
        return []

    parsed_items: list[NewsItem] = []
    seen_urls: set[str] = set()

    for raw_item in raw_news:
        item = _parse_yfinance_news_item(raw_item)
        if item is None or item.url in seen_urls:
            continue
        seen_urls.add(item.url)
        parsed_items.append(item)
        if len(parsed_items) >= 20:
            break

    return parsed_items


def _fetch_alpha_vantage_news_items(symbol: str, api_key: str) -> list[NewsItem]:
    mapped_symbol = _map_alpha_vantage_symbol(symbol)
    if not mapped_symbol:
        return []

    try:
        with httpx.Client(timeout=18.0, headers=DEFAULT_HEADERS, follow_redirects=True) as client:
            response = client.get(
                "https://www.alphavantage.co/query",
                params={
                    "function": "NEWS_SENTIMENT",
                    "tickers": mapped_symbol,
                    "limit": 20,
                    "apikey": api_key,
                },
            )
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        logger.warning("Alpha Vantage news fetch failed for %s: %s", symbol, exc)
        return []

    if payload.get("Note") or payload.get("Information"):
        logger.warning("Alpha Vantage news temporarily unavailable for %s: %s", symbol, payload)
        return []

    feed = payload.get("feed")
    if not isinstance(feed, list):
        return []

    items: list[NewsItem] = []
    for raw_item in feed:
        if not isinstance(raw_item, dict):
            continue

        title = _pick_first_text(raw_item.get("title"))
        url = _pick_first_text(raw_item.get("url"), raw_item.get("banner_image"))
        published_at = _coerce_alpha_vantage_datetime(raw_item.get("time_published"))
        publisher = _pick_first_text(raw_item.get("source"), raw_item.get("source_domain"), ALPHA_VANTAGE_PROVIDER)
        if not title or not url:
            continue

        items.append(
            NewsItem(
                title=title,
                url=url,
                published_at=published_at,
                source=_compose_news_source(ALPHA_VANTAGE_PROVIDER, publisher),
            )
        )
        if len(items) >= 20:
            break

    return items


def _fetch_google_news_items(symbol: str) -> list[NewsItem]:
    query = _build_google_news_query(symbol)

    try:
        with httpx.Client(timeout=18.0, headers=DEFAULT_HEADERS, follow_redirects=True) as client:
            response = client.get(
                "https://news.google.com/rss/search",
                params={
                    "q": query,
                    "hl": "zh-CN",
                    "gl": "CN",
                    "ceid": "CN:zh-Hans",
                },
            )
            response.raise_for_status()
            root = ElementTree.fromstring(response.text)
    except Exception as exc:
        logger.warning("Google News RSS fetch failed for %s: %s", symbol, exc)
        return []

    items: list[NewsItem] = []
    for raw_item in root.findall(".//item"):
        raw_title = _xml_child_text(raw_item, "title")
        link = _xml_child_text(raw_item, "link")
        pub_date = _xml_child_text(raw_item, "pubDate")
        source_name = _xml_child_text(raw_item, "source") or _extract_source_from_title(raw_title)
        title = _strip_source_from_title(raw_title)

        if not title or not link:
            continue

        items.append(
            NewsItem(
                title=title,
                url=link,
                published_at=_coerce_rfc2822_datetime(pub_date),
                source=_compose_news_source(GOOGLE_NEWS_PROVIDER, source_name or GOOGLE_NEWS_PROVIDER),
            )
        )
        if len(items) >= 20:
            break

    return items


def _safe_fast_info(ticker: yf.Ticker) -> dict[str, Any]:
    try:
        return dict(ticker.fast_info or {})
    except Exception as exc:
        logger.warning("fast_info fetch failed: %s", exc)
        return {}


def _normalize_regional_symbol(symbol: str) -> str:
    if symbol.endswith(".HK"):
        base = symbol[:-3]
        if base.isdigit():
            normalized = base.lstrip("0") or "0"
            if len(normalized) <= 4:
                normalized = normalized.zfill(4)
            return f"{normalized}.HK"
        return symbol

    if not symbol.isdigit():
        return symbol

    if len(symbol) == 6:
        if symbol.startswith(("0", "3")):
            return f"{symbol}.SZ"
        if symbol.startswith(("5", "6", "9")):
            return f"{symbol}.SS"
        if symbol.startswith(("4", "8")):
            return f"{symbol}.BJ"
        return symbol

    if len(symbol) in (4, 5):
        normalized = symbol.lstrip("0") or "0"
        if len(normalized) <= 4:
            normalized = normalized.zfill(4)
        return f"{normalized}.HK"

    return symbol
    if symbol.startswith(("0", "3")):
        return f"{symbol}.SZ"
    if symbol.startswith(("5", "6", "9")):
        return f"{symbol}.SS"
    if symbol.startswith(("4", "8")):
        return f"{symbol}.BJ"
    return symbol


def _map_alpha_vantage_symbol(symbol: str) -> str | None:
    if symbol.endswith(".SZ"):
        return f"{symbol[:-3]}.SHE"
    if symbol.endswith(".SS"):
        return f"{symbol[:-3]}.SHA"
    if symbol.endswith(".BJ"):
        return None
    return symbol


def _extract_latest_close(history_frame: Any) -> dict[str, Any] | None:
    if history_frame is None:
        return None
    if getattr(history_frame, "empty", True):
        return None
    if "Close" not in history_frame:
        return None

    closes = history_frame["Close"].dropna()
    if closes.empty:
        return None

    price = _safe_float(closes.iloc[-1])
    if price is None:
        return None

    return {
        "price": price,
        "market_time": _coerce_datetime(closes.index[-1]),
    }


def _resolve_previous_close(*, fast_info: dict[str, Any], current_price: float, symbol: str) -> float:
    previous_close = (
        fast_info.get("previousClose")
        or fast_info.get("regularMarketPreviousClose")
        or fast_info.get("previous_close")
    )
    resolved_previous_close = _safe_float(previous_close)
    if resolved_previous_close is not None:
        return resolved_previous_close

    logger.warning("Previous close unavailable for %s, falling back to current price.", symbol)
    return current_price


def _safe_float(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None

    if math.isnan(parsed) or math.isinf(parsed):
        return None
    return parsed


def _parse_percent(value: Any) -> float | None:
    if isinstance(value, str):
        value = value.replace("%", "").strip()
    return _safe_float(value)


def _parse_yfinance_news_item(item: Any) -> NewsItem | None:
    if not isinstance(item, dict):
        return None

    content = item.get("content")
    content = content if isinstance(content, dict) else {}

    title = _pick_first_text(item.get("title"), content.get("title"))
    url = _extract_url(item, content)
    published_at = _pick_first_value(
        item.get("published_at"),
        item.get("providerPublishTime"),
        content.get("pubDate"),
        content.get("displayTime"),
    )
    publisher = _pick_first_text(
        item.get("publisher"),
        item.get("source"),
        _extract_nested_string(content, "provider", "displayName"),
        _extract_nested_string(content, "provider", "name"),
        YAHOO_FINANCE_PROVIDER,
    )

    if not title or not url:
        return None

    return NewsItem(
        title=title,
        url=url,
        published_at=_coerce_datetime(published_at),
        source=_compose_news_source(YAHOO_FINANCE_PROVIDER, publisher),
    )


def _extract_url(item: dict[str, Any], content: dict[str, Any]) -> str | None:
    candidates: list[Any] = [
        item.get("link"),
        item.get("url"),
        content.get("canonicalUrl"),
        content.get("clickThroughUrl"),
        content.get("url"),
    ]
    for candidate in candidates:
        if isinstance(candidate, str) and candidate:
            return candidate
        if isinstance(candidate, dict):
            nested_url = _pick_first_text(
                candidate.get("url"),
                candidate.get("link"),
                candidate.get("canonicalUrl"),
            )
            if nested_url:
                return nested_url
    return None


def _extract_nested_string(payload: dict[str, Any], *path: str) -> str | None:
    current: Any = payload
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current if isinstance(current, str) and current else None


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
        normalized = value.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return datetime.now(timezone.utc)

    return datetime.now(timezone.utc)


def _coerce_alpha_vantage_datetime(value: Any) -> datetime:
    if not isinstance(value, str) or not value.strip():
        return datetime.now(timezone.utc)

    for fmt in ("%Y%m%dT%H%M%S", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(value, fmt)
            return parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return datetime.now(timezone.utc)


def _coerce_rfc2822_datetime(value: Any) -> datetime:
    if not isinstance(value, str) or not value.strip():
        return datetime.now(timezone.utc)
    try:
        parsed = parsedate_to_datetime(value)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError, IndexError):
        return datetime.now(timezone.utc)


def _build_google_news_query(symbol: str) -> str:
    if symbol.endswith((".SZ", ".SS", ".BJ")):
        return f'{symbol.split(".", 1)[0]} 股票'
    return f"{symbol} stock"


def _xml_child_text(element: ElementTree.Element, tag_name: str) -> str | None:
    child = element.find(tag_name)
    if child is None or child.text is None:
        return None
    text = child.text.strip()
    return text or None


def _extract_source_from_title(title: str | None) -> str | None:
    if not title or " - " not in title:
        return None
    return title.rsplit(" - ", 1)[-1].strip() or None


def _strip_source_from_title(title: str | None) -> str | None:
    if not title:
        return None
    if " - " not in title:
        return title.strip() or None
    return title.rsplit(" - ", 1)[0].strip() or None


def _compose_news_source(provider: str, publisher: str | None) -> str:
    if publisher and publisher != provider:
        return f"{provider} / {publisher}"
    return provider


def _merge_news_items(items: list[NewsItem]) -> list[NewsItem]:
    sorted_items = sorted(items, key=lambda item: item.published_at, reverse=True)
    deduplicated: list[NewsItem] = []
    seen_keys: set[str] = set()

    for item in sorted_items:
        key = (item.url or item.title).strip().lower()
        if not key or key in seen_keys:
            continue
        seen_keys.add(key)
        deduplicated.append(item)
        if len(deduplicated) >= 20:
            break

    return deduplicated


def _extract_news_providers(items: list[NewsItem]) -> list[str]:
    providers: list[str] = []
    seen: set[str] = set()

    for item in items:
        provider = item.source.split(" / ", 1)[0].strip()
        if provider and provider not in seen:
            seen.add(provider)
            providers.append(provider)

    return providers


def _infer_currency(symbol: str) -> str:
    if symbol.endswith((".SZ", ".SS", ".BJ")):
        return "CNY"
    if symbol.endswith(".HK"):
        return "HKD"
    return "USD"


def _build_mock_news(symbol: str) -> list[NewsItem]:
    now = datetime.now(timezone.utc)
    templates = [
        f"{symbol} 相关新闻源暂不可用，当前展示演示用回退资讯。",
        f"{symbol} 投资者可关注下一份财报、指引与行业轮动情况。",
        f"{symbol} 回退新闻已启用，建议上线生产时接入更稳定的新闻源。",
        f"{symbol} 当前页面仍可完成端到端演示，包括行情、新闻和总结流程。",
        f"{symbol} 若需更高实时性，可后续接入付费新闻与低延迟报价源。",
    ]

    items: list[NewsItem] = []
    for index in range(20):
        title = templates[index % len(templates)]
        items.append(
            NewsItem(
                title=title,
                url=f"https://finance.yahoo.com/quote/{symbol}",
                published_at=now - timedelta(hours=index * 2),
                source=MOCK_PROVIDER,
            )
        )
    return items







