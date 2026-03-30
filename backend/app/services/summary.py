from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from openai import OpenAI

from app.core.config import get_settings
from app.schemas.market import NewsItem, SummaryContent, SummaryDataPoints, SummaryResponse
from app.services.market_data import get_news, get_quote, normalize_symbol


logger = logging.getLogger(__name__)

POSITIVE_KEYWORDS = (
    "beat",
    "growth",
    "upgrade",
    "surge",
    "record",
    "buyback",
    "profit",
    "partnership",
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
)


def generate_summary(symbol: str, generated_at: datetime | None = None) -> SummaryResponse:
    normalized_symbol = normalize_symbol(symbol)
    quote = get_quote(normalized_symbol)
    news = get_news(normalized_symbol, limit=5)

    summary_content = _generate_llm_summary(normalized_symbol, quote, news.items)
    if summary_content is None:
        summary_content = _generate_rule_summary(normalized_symbol, quote, news.items)

    return SummaryResponse(
        symbol=normalized_symbol,
        generated_at=generated_at or datetime.now(timezone.utc),
        summary=summary_content,
        data_points=SummaryDataPoints(
            price=quote.price,
            change_percent=quote.change_percent,
            news_count=len(news.items),
        ),
    )


def _generate_llm_summary(symbol: str, quote: Any, news_items: list[NewsItem]) -> SummaryContent | None:
    settings = get_settings()
    if not settings.llm_api_key:
        return None

    payload = {
        "symbol": symbol,
        "quote": {
            "price": quote.price,
            "change": quote.change,
            "change_percent": quote.change_percent,
            "currency": quote.currency,
            "market_time": quote.market_time.isoformat(),
        },
        "news": [
            {
                "title": item.title,
                "source": item.source,
                "published_at": item.published_at.isoformat(),
                "url": item.url,
            }
            for item in news_items
        ],
    }

    try:
        client = OpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            timeout=30.0,
        )
        completion = client.chat.completions.create(
            model=settings.llm_model,
            temperature=0.2,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是一名谨慎的中文股票研究助理。"
                        "请仅输出一个 JSON 对象，字段必须是 bullish、bearish、conclusion。"
                        "bullish 和 bearish 必须是中文字符串数组，每个数组 2 到 4 条；"
                        "conclusion 必须是 1 段中文结论。不要输出 markdown 解释。"
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
        return SummaryContent(
            bullish=_coerce_points(parsed.get("bullish"), minimum=2),
            bearish=_coerce_points(parsed.get("bearish"), minimum=2),
            conclusion=_coerce_conclusion(parsed.get("conclusion")),
        )
    except Exception as exc:
        logger.exception("LLM summary generation failed, falling back to rule template.", exc_info=exc)
        return None


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


def _generate_rule_summary(symbol: str, quote: Any, news_items: list[NewsItem]) -> SummaryContent:
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
        positive_hits=positive_hits,
        negative_hits=negative_hits,
        uses_mock_news=uses_mock_news,
    )

    return SummaryContent(
        bullish=_coerce_points(bullish, minimum=2),
        bearish=_coerce_points(bearish, minimum=2),
        conclusion=conclusion,
    )


def _build_conclusion(
    *,
    symbol: str,
    change_percent: float,
    positive_hits: int,
    negative_hits: int,
    uses_mock_news: bool,
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

    return (
        f"{symbol} 当前判断为{stance}。可以先结合价格变化与最近新闻做一轮快速筛选，"
        "若要用于真实投资，请继续补充财报、估值和更高质量新闻源后再做决定。"
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
    return "当前信息可用于快速演示和初筛，但正式投资前仍需补充更多基本面与时效性更高的数据。"
