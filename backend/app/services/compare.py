from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from app.core.errors import APIError
from app.schemas.market import CompareResponse, CompareStockResponse
from app.services.company_data import get_announcements, get_fundamentals
from app.services.market_data import get_news, get_quote, normalize_symbol


MAX_COMPARE_SYMBOLS = 4
COMPARE_WORKERS = 4


def build_compare_response(symbols: list[str], *, force_refresh: bool = False) -> CompareResponse:
    normalized_symbols = [normalize_symbol(symbol) for symbol in symbols]
    deduplicated_symbols = list(dict.fromkeys(normalized_symbols))

    if len(deduplicated_symbols) < 2:
        raise APIError(
            status_code=400,
            code="COMPARE_SYMBOLS_TOO_FEW",
            message="对比分析至少需要 2 个不同的股票代码。",
        )
    if len(deduplicated_symbols) > MAX_COMPARE_SYMBOLS:
        raise APIError(
            status_code=400,
            code="COMPARE_SYMBOLS_TOO_MANY",
            message="对比分析最多支持 4 个股票代码。",
        )

    items: dict[str, CompareStockResponse] = {}

    with ThreadPoolExecutor(max_workers=min(COMPARE_WORKERS, len(deduplicated_symbols))) as executor:
        future_map = {
            executor.submit(_build_compare_item, symbol, force_refresh=force_refresh): symbol
            for symbol in deduplicated_symbols
        }
        for future in as_completed(future_map):
            symbol = future_map[future]
            items[symbol] = future.result()

    ordered_items = [items[symbol] for symbol in deduplicated_symbols]
    return CompareResponse(generated_at=datetime.now(timezone.utc), items=ordered_items)


def _build_compare_item(symbol: str, *, force_refresh: bool) -> CompareStockResponse:
    quote = get_quote(symbol, force_refresh=force_refresh)
    news = get_news(symbol, limit=5, force_refresh=force_refresh)

    fundamentals = None
    fundamentals_sources: list[str] = []
    try:
        fundamentals = get_fundamentals(symbol)
        fundamentals_sources = list(fundamentals.providers)
    except APIError:
        fundamentals = None

    announcement_count = 0
    latest_announcement_time = None
    announcement_sources: list[str] = []
    try:
        announcements = get_announcements(symbol, limit=3)
        announcement_count = announcements.count
        latest_announcement_time = max((item.published_at for item in announcements.items), default=None)
        announcement_sources = list(announcements.providers)
    except APIError:
        announcement_count = 0

    latest_news_time = max((item.published_at for item in news.items), default=None)
    company_name = fundamentals.company_name if fundamentals and fundamentals.company_name else None

    data_sources = list(
        dict.fromkeys(
            [quote.provider, *fundamentals_sources, *news.providers, *announcement_sources]
        )
    )

    return CompareStockResponse(
        symbol=symbol,
        company_name=company_name,
        quote=quote,
        fundamentals=fundamentals,
        news_count=news.count,
        latest_news_time=latest_news_time,
        announcement_count=announcement_count,
        latest_announcement_time=latest_announcement_time,
        highlights=_build_highlights(
            symbol=symbol,
            quote=quote,
            fundamentals=fundamentals,
            news_count=news.count,
            announcement_count=announcement_count,
        ),
        data_sources=data_sources,
    )


def _build_highlights(
    *,
    symbol: str,
    quote,
    fundamentals,
    news_count: int,
    announcement_count: int,
) -> list[str]:
    highlights: list[str] = []

    if quote.change_percent >= 0:
        highlights.append(f"{symbol} 当日涨跌幅 {quote.change_percent:+.2f}%，短线表现偏强。")
    else:
        highlights.append(f"{symbol} 当日涨跌幅 {quote.change_percent:+.2f}%，短线波动需留意。")

    if fundamentals is not None:
        if fundamentals.revenue_growth is not None:
            trend_text = "主营仍在增长" if fundamentals.revenue_growth >= 0 else "营收增速承压"
            highlights.append(f"营收增速 {fundamentals.revenue_growth:+.1f}%，{trend_text}。")
        if fundamentals.net_profit_growth is not None:
            profit_text = "利润趋势偏积极" if fundamentals.net_profit_growth >= 0 else "利润修复仍需观察"
            highlights.append(f"净利增速 {fundamentals.net_profit_growth:+.1f}%，{profit_text}。")
        if fundamentals.roe is not None:
            highlights.append(f"ROE 约 {fundamentals.roe:.1f}%，可辅助判断资本回报效率。")
    else:
        highlights.append("当前未补齐稳定基本面字段，估值比较请谨慎解读。")

    if news_count > 0:
        highlights.append(f"最近抓到 {news_count} 条新闻，市场关注度仍在。")
    else:
        highlights.append("近期高相关新闻较少，更多要靠财报与估值验证。")

    if announcement_count > 0:
        highlights.append(f"近期有 {announcement_count} 条公告披露，可继续核对正式口径。")

    return highlights[:4]
