from __future__ import annotations

import logging
import math
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import yfinance as yf

from app.core.cache import TTLCache
from app.core.errors import APIError
from app.schemas.market import NewsItem, NewsResponse, QuoteResponse


logger = logging.getLogger(__name__)

SYMBOL_PATTERN = re.compile(r"^[A-Za-z0-9.\-^=]{1,10}$")
QUOTE_CACHE = TTLCache[QuoteResponse](ttl_seconds=60)
NEWS_CACHE = TTLCache[list[NewsItem]](ttl_seconds=180)


def normalize_symbol(symbol: str) -> str:
    normalized = symbol.strip().upper()
    if not normalized:
        raise APIError(
            status_code=400,
            code="INVALID_SYMBOL",
            message="股票代码不能为空，请输入类似 AAPL 的代码。",
        )
    if not SYMBOL_PATTERN.fullmatch(normalized):
        raise APIError(
            status_code=400,
            code="INVALID_SYMBOL",
            message="股票代码格式无效，请输入合法的美股代码。",
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


def get_quote(symbol: str) -> QuoteResponse:
    normalized_symbol = normalize_symbol(symbol)

    cached_quote = QUOTE_CACHE.get(normalized_symbol)
    if cached_quote is not None:
        return cached_quote

    ticker = yf.Ticker(normalized_symbol)
    fast_info = _safe_fast_info(ticker)

    try:
        intraday_history = ticker.history(period="1d", interval="1m", auto_adjust=False)
    except Exception as exc:
        logger.warning("Intraday quote fetch failed for %s: %s", normalized_symbol, exc)
        intraday_history = None

    close_point = _extract_latest_close(intraday_history)
    if close_point:
        price = close_point["price"]
        market_time = close_point["market_time"]
    else:
        try:
            daily_history = ticker.history(period="5d", interval="1d", auto_adjust=False)
        except Exception as exc:
            logger.exception("Daily quote fetch failed for %s", exc_info=exc)
            raise APIError(
                status_code=502,
                code="QUOTE_SOURCE_UNAVAILABLE",
                message="行情数据源暂时不可用，请稍后重试。",
            ) from exc

        close_point = _extract_latest_close(daily_history)
        if not close_point:
            raise APIError(
                status_code=404,
                code="QUOTE_NOT_FOUND",
                message=f"未找到股票代码 {normalized_symbol} 的行情数据。",
                details={"symbol": normalized_symbol},
            )

        price = close_point["price"]
        market_time = close_point["market_time"]

    previous_close = _resolve_previous_close(
        fast_info=fast_info,
        current_price=price,
        symbol=normalized_symbol,
    )
    change = round(price - previous_close, 4)
    change_percent = round((change / previous_close) * 100, 4) if previous_close else 0.0
    currency = str(fast_info.get("currency") or "USD")

    quote = QuoteResponse(
        symbol=normalized_symbol,
        price=round(price, 4),
        change=change,
        change_percent=change_percent,
        currency=currency,
        market_time=market_time,
    )
    return QUOTE_CACHE.set(normalized_symbol, quote)


def get_news(symbol: str, limit: int = 5) -> NewsResponse:
    normalized_symbol = normalize_symbol(symbol)
    validated_limit = validate_news_limit(limit)

    cached_items = NEWS_CACHE.get(normalized_symbol)
    if cached_items is None:
        cached_items = _fetch_news_items(normalized_symbol)
        NEWS_CACHE.set(normalized_symbol, cached_items)

    items = cached_items[:validated_limit]
    return NewsResponse(symbol=normalized_symbol, count=len(items), items=items)


def _safe_fast_info(ticker: yf.Ticker) -> dict[str, Any]:
    try:
        return dict(ticker.fast_info or {})
    except Exception as exc:
        logger.warning("fast_info fetch failed: %s", exc)
        return {}


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


def _fetch_news_items(symbol: str) -> list[NewsItem]:
    try:
        raw_news = yf.Ticker(symbol).news or []
    except Exception as exc:
        logger.warning("News fetch failed for %s: %s", symbol, exc)
        raw_news = []

    parsed_items: list[NewsItem] = []
    seen_urls: set[str] = set()

    for raw_item in raw_news:
        item = _parse_news_item(raw_item)
        if item is None or item.url in seen_urls:
            continue
        seen_urls.add(item.url)
        parsed_items.append(item)
        if len(parsed_items) >= 20:
            break

    if parsed_items:
        return parsed_items

    return _build_mock_news(symbol)


def _parse_news_item(item: Any) -> NewsItem | None:
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
    source = _pick_first_text(
        item.get("publisher"),
        item.get("source"),
        _extract_nested_string(content, "provider", "displayName"),
        _extract_nested_string(content, "provider", "name"),
        "Yahoo Finance",
    )

    if not title or not url:
        return None

    return NewsItem(
        title=title,
        url=url,
        published_at=_coerce_datetime(published_at),
        source=source,
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


def _build_mock_news(symbol: str) -> list[NewsItem]:
    now = datetime.now(timezone.utc)
    templates = [
        f"{symbol} 相关新闻源暂不可用，当前展示演示用回退资讯。",
        f"{symbol} 投资者可关注下一份财报、指引与行业轮动情况。",
        f"{symbol} 回退新闻已启用，建议上线生产时接入更稳定的数据源。",
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
                source="mock:fallback",
            )
        )
    return items
