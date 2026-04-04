from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from openai import OpenAI

from app.core.cache import TTLCache
from app.core.config import get_settings
from app.core.errors import APIError
from app.schemas.market import (
    AnnouncementItem,
    FundamentalsResponse,
    NewsItem,
    NewsResponse,
    QuoteResponse,
    SummaryContent,
    SummaryDataPoints,
    SummaryMeta,
    SummaryResponse,
)
from app.services.company_data import get_announcements, get_fundamentals
from app.services.market_data import get_news, get_quote, normalize_symbol


logger = logging.getLogger(__name__)
LLM_SUMMARY_TIMEOUT_SECONDS = 20.0
SUMMARY_CACHE = TTLCache[SummaryResponse](ttl_seconds=900)
SUMMARY_CACHE_VERSION = "summary-v2"
SUMMARY_PROMPT_NEWS_LIMIT = 4
SUMMARY_PROMPT_ANNOUNCEMENT_LIMIT = 2
SUMMARY_MAX_OUTPUT_TOKENS = 320

POSITIVE_KEYWORDS = (
    "beat",
    "growth",
    "upgrade",
    "surge",
    "record",
    "buyback",
    "profit",
    "partnership",
    "增持",
    "签约",
    "中标",
)
NEGATIVE_KEYWORDS = (
    "miss",
    "downgrade",
    "lawsuit",
    "recall",
    "cut",
    "drop",
    "investigation",
    "risk",
    "诉讼",
    "减持",
    "亏损",
)
ANNOUNCEMENT_POSITIVE_KEYWORDS = ("年报", "一季报", "中标", "回购", "分红", "增持", "股权激励")
ANNOUNCEMENT_NEGATIVE_KEYWORDS = ("风险", "减持", "问询", "处罚", "诉讼", "终止", "延期", "澄清")


@dataclass
class SummaryGenerationResult:
    content: SummaryContent
    meta: SummaryMeta


def generate_summary(
    symbol: str,
    generated_at: datetime | None = None,
    *,
    force_refresh: bool = True,
    quote: QuoteResponse | None = None,
    news_items: list[NewsItem] | None = None,
    news_providers: list[str] | None = None,
    include_supplemental: bool = False,
) -> SummaryResponse:
    settings = get_settings()
    normalized_symbol = normalize_symbol(symbol)
    resolved_quote = _resolve_quote(normalized_symbol, quote, force_refresh=force_refresh)
    resolved_news = _resolve_news(
        normalized_symbol,
        news_items=news_items,
        news_providers=news_providers,
        force_refresh=force_refresh,
    )

    fundamentals: FundamentalsResponse | None = None
    announcements: list[AnnouncementItem] = []

    if include_supplemental:
        try:
            fundamentals = get_fundamentals(normalized_symbol)
        except APIError as exc:
            logger.info("Fundamentals unavailable for summary %s: %s", normalized_symbol, exc.code)

        try:
            announcements_response = get_announcements(normalized_symbol, limit=3)
            announcements = announcements_response.items
        except APIError as exc:
            logger.info("Announcements unavailable for summary %s: %s", normalized_symbol, exc.code)

    cache_key = _build_summary_cache_key(
        symbol=normalized_symbol,
        quote=resolved_quote,
        news_items=resolved_news.items,
        fundamentals=fundamentals,
        announcements=announcements,
        include_supplemental=include_supplemental,
        settings=settings,
    )
    if not force_refresh:
        cached_summary = SUMMARY_CACHE.get(cache_key)
        if cached_summary is not None:
            return cached_summary

    summary_result = _generate_llm_summary(
        normalized_symbol,
        resolved_quote,
        resolved_news.items,
        fundamentals,
        announcements,
        settings,
    )
    if summary_result is None:
        summary_result = _generate_rule_summary(
            normalized_symbol,
            resolved_quote,
            resolved_news.items,
            fundamentals,
            announcements,
        )

    latest_news_time = max((item.published_at for item in resolved_news.items), default=None)

    response = SummaryResponse(
        symbol=normalized_symbol,
        generated_at=generated_at or datetime.now(timezone.utc),
        summary=summary_result.content,
        data_points=SummaryDataPoints(
            price=resolved_quote.price,
            change_percent=resolved_quote.change_percent,
            news_count=len(resolved_news.items),
        ),
        meta=SummaryMeta(
            provider=summary_result.meta.provider,
            model=summary_result.meta.model,
            is_fallback=summary_result.meta.is_fallback,
            force_refresh_used=force_refresh,
            quote_provider=resolved_quote.provider,
            quote_market_time=resolved_quote.market_time,
            latest_news_time=latest_news_time,
            news_providers=resolved_news.providers,
        ),
    )
    return SUMMARY_CACHE.set(cache_key, response)


def _resolve_quote(symbol: str, quote: QuoteResponse | None, *, force_refresh: bool) -> QuoteResponse:
    if quote is not None:
        try:
            if normalize_symbol(quote.symbol) == symbol:
                return quote.model_copy(update={"symbol": symbol})
        except APIError:
            logger.info("Provided quote payload is invalid for %s; falling back to live fetch.", symbol)

    return get_quote(symbol, force_refresh=force_refresh)


def _resolve_news(
    symbol: str,
    *,
    news_items: list[NewsItem] | None,
    news_providers: list[str] | None,
    force_refresh: bool,
) -> NewsResponse:
    if news_items:
        items = news_items[:20]
        providers = news_providers or _extract_news_providers(items)
        return NewsResponse(
            symbol=symbol,
            count=len(items),
            items=items,
            providers=providers,
        )

    return get_news(symbol, limit=5, force_refresh=force_refresh)


def _extract_news_providers(items: list[NewsItem]) -> list[str]:
    providers: list[str] = []
    seen: set[str] = set()

    for item in items:
        provider = item.source.split(" / ", 1)[0].strip()
        if provider and provider not in seen:
            seen.add(provider)
            providers.append(provider)

    return providers


def _generate_llm_summary(
    symbol: str,
    quote: QuoteResponse,
    news_items: list[NewsItem],
    fundamentals: FundamentalsResponse | None,
    announcements: list[AnnouncementItem],
    settings: Any,
) -> SummaryGenerationResult | None:
    if not settings.llm_api_key:
        return None

    selected_news_items = _select_summary_news_items(news_items)
    selected_announcements = _select_summary_announcements(announcements)
    payload = {
        "symbol": symbol,
        "quote": {
            "price": quote.price,
            "change": quote.change,
            "change_percent": quote.change_percent,
            "currency": quote.currency,
            "market_time": quote.market_time.isoformat(),
            "provider": quote.provider,
        },
        "fundamentals": None
        if fundamentals is None
        else {
            "providers": fundamentals.providers,
            "industry": fundamentals.industry,
            "market_cap": fundamentals.market_cap,
            "pe_ratio": fundamentals.pe_ratio,
            "pb_ratio": fundamentals.pb_ratio,
            "roe": fundamentals.roe,
            "gross_margin": fundamentals.gross_margin,
            "net_margin": fundamentals.net_margin,
            "debt_to_asset": fundamentals.debt_to_asset,
            "revenue_growth": fundamentals.revenue_growth,
            "net_profit_growth": fundamentals.net_profit_growth,
        },
        "news": [
            {
                "title": item.title,
                "source": item.source,
                "published_at": item.published_at.isoformat(),
            }
            for item in selected_news_items
        ],
        "announcements": [
            {
                "title": item.title,
                "source": item.source,
                "published_at": item.published_at.isoformat(),
                "category": item.category,
            }
            for item in selected_announcements
        ],
    }

    try:
        client = OpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            timeout=LLM_SUMMARY_TIMEOUT_SECONDS,
        )
        completion = client.chat.completions.create(
            model=settings.llm_model,
            temperature=0.2,
            max_tokens=SUMMARY_MAX_OUTPUT_TOKENS,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是一名谨慎的中文股票研究助理。"
                        "请基于给定的行情、新闻、基本面和公告做快速中文摘要。"
                        "只输出一个 JSON 对象，字段必须是 bullish、bearish、conclusion。"
                        "bullish 和 bearish 必须是 2 到 4 条中文短句数组；"
                        "conclusion 必须是 1 段简洁中文结论；不要输出 markdown、解释或额外字段。"
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(payload, ensure_ascii=False),
                },
            ],
        )
        content = completion.choices[0].message.content or ""
        parsed = _extract_json_object(content)
        return SummaryGenerationResult(
            content=SummaryContent(
                bullish=_coerce_points(parsed.get("bullish"), minimum=2),
                bearish=_coerce_points(parsed.get("bearish"), minimum=2),
                conclusion=_coerce_conclusion(parsed.get("conclusion")),
            ),
            meta=SummaryMeta(
                provider="dashscope" if settings.dashscope_api_key else "openai",
                model=settings.llm_model,
                is_fallback=False,
            ),
        )
    except Exception as exc:
        logger.exception("LLM summary generation failed, falling back to rule template.", exc_info=exc)
        return None


def _build_summary_cache_key(
    *,
    symbol: str,
    quote: QuoteResponse,
    news_items: list[NewsItem],
    fundamentals: FundamentalsResponse | None,
    announcements: list[AnnouncementItem],
    include_supplemental: bool,
    settings: Any,
) -> str:
    payload = {
        "version": SUMMARY_CACHE_VERSION,
        "symbol": symbol,
        "include_supplemental": include_supplemental,
        "llm_provider": "dashscope" if settings.dashscope_api_key else "openai" if settings.openai_api_key else "template",
        "llm_model": settings.llm_model,
        "quote": {
            "price": quote.price,
            "change": quote.change,
            "change_percent": quote.change_percent,
            "provider": quote.provider,
            "market_time": quote.market_time.isoformat(),
        },
        "news": [
            {
                "title": item.title,
                "source": item.source,
                "published_at": item.published_at.isoformat(),
            }
            for item in news_items
        ],
        "fundamentals": None
        if fundamentals is None
        else {
            "as_of": fundamentals.as_of.isoformat(),
            "providers": fundamentals.providers,
            "industry": fundamentals.industry,
            "market_cap": fundamentals.market_cap,
            "pe_ratio": fundamentals.pe_ratio,
            "pb_ratio": fundamentals.pb_ratio,
            "roe": fundamentals.roe,
            "gross_margin": fundamentals.gross_margin,
            "net_margin": fundamentals.net_margin,
            "debt_to_asset": fundamentals.debt_to_asset,
            "revenue_growth": fundamentals.revenue_growth,
            "net_profit_growth": fundamentals.net_profit_growth,
        },
        "announcements": [
            {
                "title": item.title,
                "source": item.source,
                "published_at": item.published_at.isoformat(),
                "category": item.category,
            }
            for item in announcements
        ],
    }
    serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _select_summary_news_items(news_items: list[NewsItem]) -> list[NewsItem]:
    return news_items[:SUMMARY_PROMPT_NEWS_LIMIT]


def _select_summary_announcements(announcements: list[AnnouncementItem]) -> list[AnnouncementItem]:
    return announcements[:SUMMARY_PROMPT_ANNOUNCEMENT_LIMIT]


def _extract_json_object(content: str) -> dict[str, Any]:
    stripped = content.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if stripped.startswith("json"):
            stripped = stripped[4:].strip()

    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start_index = stripped.find("{")
    end_index = stripped.rfind("}")
    if start_index != -1 and end_index != -1 and end_index > start_index:
        candidate = stripped[start_index : end_index + 1]
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed

    raise ValueError("LLM response is not valid JSON.")


def _generate_rule_summary(
    symbol: str,
    quote: QuoteResponse,
    news_items: list[NewsItem],
    fundamentals: FundamentalsResponse | None,
    announcements: list[AnnouncementItem],
) -> SummaryGenerationResult:
    positive_hits = 0
    negative_hits = 0
    uses_mock_news = any(item.source.startswith("mock") for item in news_items)

    for item in news_items:
        lowered_title = item.title.lower()
        positive_hits += sum(keyword in lowered_title for keyword in POSITIVE_KEYWORDS)
        negative_hits += sum(keyword in lowered_title for keyword in NEGATIVE_KEYWORDS)

    bullish: list[str] = []
    bearish: list[str] = []

    if quote.change_percent >= 0:
        bullish.append(
            f"{symbol} 最新报价为 {quote.price:.2f} {quote.currency}，较前收盘上涨 {abs(quote.change_percent):.2f}%。"
        )
    else:
        bearish.append(
            f"{symbol} 最新报价为 {quote.price:.2f} {quote.currency}，较前收盘下跌 {abs(quote.change_percent):.2f}%。"
        )

    bullish.append(f"已聚合 {len(news_items)} 条相关新闻，可快速查看近期市场关注点。")

    if fundamentals is not None:
        if (fundamentals.revenue_growth or 0) > 0:
            bullish.append(f"基本面显示营收同比增速约 {fundamentals.revenue_growth:.2f}%，说明主营仍在增长。")
        elif fundamentals.revenue_growth is not None:
            bearish.append(f"基本面显示营收同比增速约 {fundamentals.revenue_growth:.2f}%，增长承压需要继续核实。")

        if (fundamentals.net_profit_growth or 0) > 0:
            bullish.append(f"归母净利润同比增速约 {fundamentals.net_profit_growth:.2f}%，利润端表现相对积极。")
        elif fundamentals.net_profit_growth is not None:
            bearish.append(f"归母净利润同比增速约 {fundamentals.net_profit_growth:.2f}%，盈利修复节奏仍需观察。")

        if (fundamentals.roe or 0) >= 10:
            bullish.append(f"ROE 约为 {fundamentals.roe:.2f}%，资本回报率处于相对可接受区间。")
        elif fundamentals.roe is not None:
            bearish.append(f"ROE 约为 {fundamentals.roe:.2f}%，资本回报效率并不算强。")
    elif announcements:
        bullish.append(f"已补充 {len(announcements)} 条公告，可辅助验证近期正式披露信息。")
    else:
        bearish.append("本轮摘要未补充基本面和公告字段，更适合用于快速研判而非深度估值。")

    positive_announcement_hits = 0
    negative_announcement_hits = 0
    for item in announcements:
        title = item.title.lower()
        positive_announcement_hits += sum(keyword in title for keyword in ANNOUNCEMENT_POSITIVE_KEYWORDS)
        negative_announcement_hits += sum(keyword in title for keyword in ANNOUNCEMENT_NEGATIVE_KEYWORDS)

    if announcements:
        bullish.append(f"最近抓取到 {len(announcements)} 条公告，可补充验证新闻之外的正式披露信息。")
    if positive_announcement_hits > 0:
        bullish.append(f"公告标题中出现 {positive_announcement_hits} 个偏积极关键词，可关注正式披露的经营或资本运作进展。")
    if negative_announcement_hits > 0:
        bearish.append(f"公告标题中出现 {negative_announcement_hits} 个偏风险关键词，建议重点阅读原文公告。")

    if positive_hits > 0:
        bullish.append(f"新闻标题中出现 {positive_hits} 个偏利好关键词，短线情绪相对偏积极。")
    else:
        bullish.append("当前新闻面没有明显利好爆点，走势更多依赖财报、估值与行业催化。")

    if negative_hits > 0:
        bearish.append(f"新闻标题中出现 {negative_hits} 个偏风险关键词，需关注潜在回撤与预期落差。")
    else:
        bearish.append("短期未捕捉到明显负面头条，但免费新闻源覆盖度有限。")

    if uses_mock_news:
        bearish.append("新闻数据已触发回退内容，演示可用，但正式上线前建议补充更稳定的新闻源。")
    else:
        bearish.append("免费行情和新闻数据可能存在 15 到 20 分钟延迟，不适合高频交易决策。")

    conclusion = _build_conclusion(
        symbol=symbol,
        change_percent=quote.change_percent,
        positive_hits=positive_hits + positive_announcement_hits,
        negative_hits=negative_hits + negative_announcement_hits,
        uses_mock_news=uses_mock_news,
        has_fundamentals=fundamentals is not None,
        has_announcements=bool(announcements),
    )

    return SummaryGenerationResult(
        content=SummaryContent(
            bullish=_coerce_points(bullish, minimum=2),
            bearish=_coerce_points(bearish, minimum=2),
            conclusion=conclusion,
        ),
        meta=SummaryMeta(
            provider="template",
            model=None,
            is_fallback=True,
        ),
    )


def _build_conclusion(
    *,
    symbol: str,
    change_percent: float,
    positive_hits: int,
    negative_hits: int,
    uses_mock_news: bool,
    has_fundamentals: bool,
    has_announcements: bool,
) -> str:
    if change_percent > 1 and positive_hits >= negative_hits:
        stance = "短线偏强"
    elif change_percent < -1 or negative_hits > positive_hits:
        stance = "短线偏谨慎"
    else:
        stance = "短线中性偏观望"

    if uses_mock_news:
        return (
            f"{symbol} 当前判断为{stance}。行情端已有可用信号，但新闻部分使用了回退数据，"
            "更适合作为演示环境的研究入口，不建议直接据此做高风险交易决策。"
        )

    if has_fundamentals and has_announcements:
        return (
            f"{symbol} 当前判断为{stance}。除行情和新闻外，当前总结还参考了基本面字段与正式公告，"
            "更适合做一轮较完整的投研初筛；若用于真实投资，仍建议继续核对财报原文与估值假设。"
        )

    return (
        f"{symbol} 当前判断为{stance}。当前结论主要基于本轮最新行情与新闻生成，"
        "更适合快速研判；若要用于真实投资，请继续补充财报、公告原文和更高质量新闻源后再做决定。"
    )


def _coerce_points(value: Any, *, minimum: int) -> list[str]:
    points: list[str] = []
    if isinstance(value, list):
        points = [str(item).strip() for item in value if str(item).strip()]
    elif isinstance(value, str) and value.strip():
        points = [value.strip()]

    while len(points) < minimum:
        points.append("建议结合财报、估值与行业变化继续交叉验证。")

    return points[:4]


def _coerce_conclusion(value: Any) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return "当前信息可用于快速演示和初筛，但正式投资前仍需补充更多基本面、公告与时效性更高的数据。"
