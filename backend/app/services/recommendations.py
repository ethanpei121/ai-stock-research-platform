from __future__ import annotations

import logging
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Any

import yfinance as yf

from app.core.cache import TTLCache
from app.core.errors import APIError
from app.schemas.market import (
    RecommendationEvidence,
    RecommendationGroup,
    RecommendationScorecard,
    RecommendationsResponse,
    RecommendationStock,
)
from app.services.market_data import MOCK_PROVIDER, get_quote, normalize_symbol


logger = logging.getLogger(__name__)

RECOMMENDATIONS_CACHE = TTLCache[RecommendationsResponse](ttl_seconds=1800)
STOCK_ANALYSIS_CACHE = TTLCache[RecommendationStock](ttl_seconds=1800)
LATEST_RECOMMENDATIONS_SNAPSHOT: RecommendationsResponse | None = None
STYLE_FILTER_PRIORITY = ["热门", "稳健", "高弹性", "A股", "美股"]
ANALYST_PROVIDER = "Yahoo Finance Analyst Consensus"
PRICE_HISTORY_PROVIDER = "Yahoo Finance Price History"
MAX_WORKERS = 4


@dataclass(frozen=True)
class CandidateStock:
    symbol: str
    company_name: str
    market: str
    region: str
    tags: tuple[str, ...]


@dataclass(frozen=True)
class CandidateGroup:
    id: str
    category: str
    subcategory: str
    description: str
    stocks: tuple[CandidateStock, ...]


@dataclass(frozen=True)
class StockMetrics:
    quote_provider: str
    news_providers: tuple[str, ...]
    momentum_1m: float | None
    momentum_3m: float | None
    volume_ratio: float | None
    volatility_1m: float | None
    news_count_7d: int
    analyst_target_upside: float | None
    analyst_consensus: str | None
    analyst_opinion_count: int | None
    analyst_recommendation_mean: float | None
    revenue_growth: float | None
    earnings_growth: float | None
    daily_change_percent: float
    supports_analyst_data: bool


CANDIDATE_GROUPS: tuple[CandidateGroup, ...] = (
    CandidateGroup(
        id="tech-ai-infra",
        category="科技",
        subcategory="AI算力与云基础设施",
        description="在算力和企业级 AI 基建里挑流动性最好的龙头做跟踪。",
        stocks=(
            CandidateStock("NVDA", "英伟达", "US", "美国", ("AI", "GPU", "龙头")),
            CandidateStock("MSFT", "微软", "US", "美国", ("云平台", "Copilot", "企业软件")),
        ),
    ),
    CandidateGroup(
        id="tech-semiconductor",
        category="科技",
        subcategory="半导体与晶圆制造",
        description="关注先进制程、AI 芯片和晶圆产能周期。",
        stocks=(
            CandidateStock("AMD", "超威半导体", "US", "美国", ("AI芯片", "CPU", "成长")),
            CandidateStock("TSM", "台积电", "US ADR", "中国台湾", ("晶圆代工", "先进制程", "龙头")),
        ),
    ),
    CandidateGroup(
        id="tech-software",
        category="科技",
        subcategory="企业软件与自动化",
        description="观察高续费软件和流程自动化标的的真实景气度。",
        stocks=(
            CandidateStock("NOW", "ServiceNow", "US", "美国", ("SaaS", "自动化", "高毛利")),
            CandidateStock("ADBE", "Adobe", "US", "美国", ("生成式AI", "订阅", "创意软件")),
        ),
    ),
    CandidateGroup(
        id="tech-cybersecurity",
        category="科技",
        subcategory="网络安全",
        description="用价格趋势、新闻热度和分析师覆盖度观察安全赛道。",
        stocks=(
            CandidateStock("CRWD", "CrowdStrike", "US", "美国", ("安全", "SaaS", "平台")),
            CandidateStock("PANW", "Palo Alto Networks", "US", "美国", ("网络安全", "企业IT", "云安全")),
        ),
    ),
    CandidateGroup(
        id="manufacturing-automation",
        category="制造",
        subcategory="工业自动化",
        description="围绕工厂数字化、电气化和自动化升级。",
        stocks=(
            CandidateStock("ETN", "伊顿", "US", "美国", ("电气化", "工业", "配电")),
            CandidateStock("ROK", "罗克韦尔自动化", "US", "美国", ("自动化", "工厂", "工业软件")),
        ),
    ),
    CandidateGroup(
        id="manufacturing-ev",
        category="制造",
        subcategory="电动车与电池",
        description="同时覆盖全球整车龙头和 A 股动力电池龙头。",
        stocks=(
            CandidateStock("TSLA", "特斯拉", "US", "美国", ("电动车", "储能", "高波动")),
            CandidateStock("300750", "宁德时代", "CN A-share", "中国", ("动力电池", "储能", "A股")),
        ),
    ),
    CandidateGroup(
        id="manufacturing-defense",
        category="制造",
        subcategory="航空航天与国防",
        description="以订单能见度和资金活跃度观察航空国防主线。",
        stocks=(
            CandidateStock("LMT", "洛克希德马丁", "US", "美国", ("军工", "订单", "防御")),
            CandidateStock("RTX", "雷神技术", "US", "美国", ("航空发动机", "防务", "航空")),
        ),
    ),
    CandidateGroup(
        id="healthcare-innovative-pharma",
        category="医药",
        subcategory="创新药龙头",
        description="优先跟踪全球创新药和减重药主线的头部公司。",
        stocks=(
            CandidateStock("LLY", "礼来", "US", "美国", ("减重药", "创新药", "龙头")),
            CandidateStock("NVO", "诺和诺德", "US ADR", "欧洲", ("GLP-1", "全球化", "高景气")),
        ),
    ),
    CandidateGroup(
        id="healthcare-devices",
        category="医药",
        subcategory="医疗器械",
        description="看手术机器人和高端器械的真实经营与市场热度。",
        stocks=(
            CandidateStock("ISRG", "直觉外科", "US", "美国", ("手术机器人", "高端器械", "平台")),
            CandidateStock("SYK", "史赛克", "US", "美国", ("骨科", "器械", "龙头")),
        ),
    ),
    CandidateGroup(
        id="finance-payments",
        category="金融",
        subcategory="支付与金融科技",
        description="聚焦支付网络、跨境消费和金融科技龙头。",
        stocks=(
            CandidateStock("V", "Visa", "US", "美国", ("支付", "网络效应", "高利润")),
            CandidateStock("MA", "Mastercard", "US", "美国", ("支付", "跨境", "品牌")),
        ),
    ),
    CandidateGroup(
        id="finance-data",
        category="金融",
        subcategory="交易所与金融信息服务",
        description="用分析师预期和价格趋势观察高质量现金流赛道。",
        stocks=(
            CandidateStock("SPGI", "标普全球", "US", "美国", ("评级", "指数", "数据")),
            CandidateStock("ICE", "洲际交易所", "US", "美国", ("交易所", "数据", "稳定")),
        ),
    ),
    CandidateGroup(
        id="consumer-staples",
        category="消费",
        subcategory="必选消费与渠道",
        description="适合在宏观不确定阶段观察防御型消费资产。",
        stocks=(
            CandidateStock("COST", "好市多", "US", "美国", ("渠道", "会员", "防御")),
            CandidateStock("PG", "宝洁", "US", "美国", ("日化", "消费", "稳健")),
        ),
    ),
    CandidateGroup(
        id="consumer-digital",
        category="消费",
        subcategory="电商与旅行平台",
        description="看线上流量、平台变现与出行景气的同步变化。",
        stocks=(
            CandidateStock("AMZN", "亚马逊", "US", "美国", ("电商", "云平台", "规模")),
            CandidateStock("BKNG", "Booking Holdings", "US", "美国", ("旅游", "预订平台", "全球化")),
        ),
    ),
    CandidateGroup(
        id="energy-lng",
        category="能源",
        subcategory="一体化能源与 LNG",
        description="用油气龙头和 LNG 核心公司观察能源主线。",
        stocks=(
            CandidateStock("XOM", "埃克森美孚", "US", "美国", ("石油", "天然气", "现金流")),
            CandidateStock("LNG", "Cheniere Energy", "US", "美国", ("LNG", "出口", "能源")),
        ),
    ),
    CandidateGroup(
        id="energy-grid",
        category="能源",
        subcategory="电网设备与新能源",
        description="跟踪电网扩容和新能源龙头的真实量价节奏。",
        stocks=(
            CandidateStock("GEV", "GE Vernova", "US", "美国", ("电网", "设备", "能源转型")),
            CandidateStock("601012", "隆基绿能", "CN A-share", "中国", ("光伏", "A股", "周期")),
        ),
    ),
    CandidateGroup(
        id="materials-critical-minerals",
        category="原材料",
        subcategory="铜锂与关键矿产",
        description="受益于电气化和储能周期的关键资源方向。",
        stocks=(
            CandidateStock("FCX", "自由港麦克莫兰", "US", "美国", ("铜", "矿业", "弹性")),
            CandidateStock("ALB", "雅宝", "US", "美国", ("锂", "新能源", "波动")),
        ),
    ),
    CandidateGroup(
        id="infra-datacenter",
        category="基建与公用事业",
        subcategory="数据中心与通信基础设施",
        description="观察 AI 机柜、电信基础设施和云上架构扩容。",
        stocks=(
            CandidateStock("EQIX", "Equinix", "US", "美国", ("数据中心", "REIT", "基础设施")),
            CandidateStock("DLR", "Digital Realty", "US", "美国", ("数据中心", "机柜", "REIT")),
        ),
    ),
)


def get_recommendations() -> RecommendationsResponse:
    global LATEST_RECOMMENDATIONS_SNAPSHOT

    cached_response = RECOMMENDATIONS_CACHE.get("default")
    if cached_response is not None:
        return cached_response

    analyses = _analyze_candidate_universe()
    groups: list[RecommendationGroup] = []

    for group in CANDIDATE_GROUPS:
        stocks = [analyses[candidate.symbol] for candidate in group.stocks if candidate.symbol in analyses]
        if not stocks:
            continue

        groups.append(
            RecommendationGroup(
                id=group.id,
                category=group.category,
                subcategory=group.subcategory,
                description=group.description,
                stocks=sorted(stocks, key=lambda item: item.scorecard.total, reverse=True),
            )
        )

    if not groups:
        if LATEST_RECOMMENDATIONS_SNAPSHOT is not None:
            logger.warning("Recommendation generation returned no groups, serving last successful snapshot instead.")
            return LATEST_RECOMMENDATIONS_SNAPSHOT

        raise APIError(
            status_code=502,
            code="RECOMMENDATIONS_UNAVAILABLE",
            message="推荐模块暂时无法生成，请稍后重试。",
        )

    categories = list(dict.fromkeys(group.category for group in groups))
    response = RecommendationsResponse(
        updated_at=datetime.now(timezone.utc),
        categories=categories,
        style_filters=_derive_style_filters(groups),
        methodology=(
            "实时推荐会先在预设观察池中选股，再优先用最新报价与近 6 个月价格/成交量历史计算动量、量能、"
            "波动与当日强弱。若新闻或分析师公开字段无法在时限内稳定获取，则对应维度按中性处理，"
            "确保接口优先稳定返回可排序结果。"
        ),
        data_sources=[
            PRICE_HISTORY_PROVIDER,
            "Yahoo Finance / Alpha Vantage / Finnhub / AkShare 行情",
        ],
        groups=groups,
    )
    cached = RECOMMENDATIONS_CACHE.set("default", response)
    LATEST_RECOMMENDATIONS_SNAPSHOT = cached
    return cached


def _analyze_candidate_universe() -> dict[str, RecommendationStock]:
    analyses: dict[str, RecommendationStock] = {}
    candidates = [candidate for group in CANDIDATE_GROUPS for candidate in group.stocks]
    normalized_symbols = list(dict.fromkeys(normalize_symbol(candidate.symbol) for candidate in candidates))
    preloaded_histories = _download_histories(normalized_symbols)

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_map = {
            executor.submit(
                _analyze_candidate,
                candidate,
                preloaded_histories.get(normalize_symbol(candidate.symbol)),
            ): candidate
            for candidate in candidates
        }
        for future in as_completed(future_map):
            candidate = future_map[future]
            try:
                analyzed = future.result()
            except Exception as exc:
                logger.warning("Recommendation analysis failed for %s: %s", candidate.symbol, exc)
                continue

            if analyzed is not None:
                analyses[candidate.symbol] = analyzed

    return analyses


def _analyze_candidate(candidate: CandidateStock, preloaded_history: Any | None = None) -> RecommendationStock | None:
    normalized_symbol = normalize_symbol(candidate.symbol)
    cached_stock = STOCK_ANALYSIS_CACHE.get(normalized_symbol)
    if cached_stock is not None:
        return cached_stock.model_copy(update={"symbol": candidate.symbol})

    quote = get_quote(normalized_symbol)
    history = preloaded_history
    if history is None:
        ticker = yf.Ticker(normalized_symbol)
        history = _safe_history(ticker)
    metrics = _build_metrics(quote=quote, news=None, history=history, info={})
    scorecard = _build_scorecard(metrics)
    styles = _derive_styles(candidate.market, metrics, scorecard)

    stock = RecommendationStock(
        symbol=candidate.symbol,
        company_name=candidate.company_name,
        market=candidate.market,
        region=candidate.region,
        rationale=_build_rationale(metrics, scorecard),
        tags=list(candidate.tags),
        styles=styles,
        scorecard=scorecard,
        evidence=RecommendationEvidence(
            momentum_1m=metrics.momentum_1m,
            momentum_3m=metrics.momentum_3m,
            volume_ratio=metrics.volume_ratio,
            news_count_7d=metrics.news_count_7d,
            analyst_target_upside=metrics.analyst_target_upside,
            analyst_consensus=metrics.analyst_consensus,
            analyst_opinion_count=metrics.analyst_opinion_count,
            revenue_growth=metrics.revenue_growth,
            earnings_growth=metrics.earnings_growth,
        ),
        data_sources=_derive_data_sources(metrics),
    )
    cached = STOCK_ANALYSIS_CACHE.set(normalized_symbol, stock)
    return cached.model_copy(update={"symbol": candidate.symbol})


def _download_histories(symbols: list[str]) -> dict[str, Any]:
    if not symbols:
        return {}

    try:
        downloaded = yf.download(
            tickers=" ".join(symbols),
            period="6mo",
            interval="1d",
            auto_adjust=False,
            progress=False,
            threads=True,
            group_by="ticker",
            timeout=10,
        )
    except Exception as exc:
        logger.warning("Recommendation bulk history fetch failed: %s", exc)
        return {}

    histories: dict[str, Any] = {}
    for symbol in symbols:
        history = _extract_downloaded_history(downloaded, symbol)
        if history is not None:
            histories[symbol] = history

    return histories


def _extract_downloaded_history(downloaded: Any, symbol: str) -> Any:
    if downloaded is None or getattr(downloaded, "empty", True):
        return None

    columns = getattr(downloaded, "columns", None)
    if hasattr(columns, "nlevels") and columns.nlevels > 1:
        try:
            history = downloaded[symbol]
        except Exception:
            try:
                history = downloaded.xs(symbol, axis=1, level=0)
            except Exception:
                return None
        if getattr(history, "empty", True):
            return None
        return history

    return downloaded if "Close" in downloaded else None


def _build_metrics(*, quote: Any, news: Any, history: Any, info: dict[str, Any]) -> StockMetrics:
    usable_news_providers = _filter_real_news_providers(getattr(news, "providers", []) if news else [])
    news_count_7d = _count_recent_news(news.items) if news and usable_news_providers else 0

    analyst_target = _safe_float(info.get("targetMeanPrice"))
    analyst_recommendation_mean = _safe_float(info.get("recommendationMean"))
    analyst_opinion_count = _safe_int(info.get("numberOfAnalystOpinions"))
    supports_analyst_data = any(
        value is not None
        for value in (analyst_target, analyst_recommendation_mean, analyst_opinion_count)
    )

    analyst_target_upside = None
    if analyst_target is not None and quote.price:
        analyst_target_upside = round(((analyst_target - quote.price) / quote.price) * 100, 2)

    return StockMetrics(
        quote_provider=quote.provider,
        news_providers=tuple(usable_news_providers),
        momentum_1m=_extract_momentum(history, 21),
        momentum_3m=_extract_momentum(history, 63),
        volume_ratio=_extract_volume_ratio(history),
        volatility_1m=_extract_volatility(history, 21),
        news_count_7d=news_count_7d,
        analyst_target_upside=analyst_target_upside,
        analyst_consensus=_humanize_analyst_consensus(info, analyst_recommendation_mean),
        analyst_opinion_count=analyst_opinion_count,
        analyst_recommendation_mean=analyst_recommendation_mean,
        revenue_growth=_to_percentage(info.get("revenueGrowth")),
        earnings_growth=_to_percentage(info.get("earningsGrowth")),
        daily_change_percent=quote.change_percent,
        supports_analyst_data=supports_analyst_data,
    )


def _build_scorecard(metrics: StockMetrics) -> RecommendationScorecard:
    prosperity_components = _compact_scores(
        _score_banded(metrics.momentum_1m, (-8.0, 0.0, 8.0, 18.0)),
        _score_banded(metrics.momentum_3m, (-15.0, 0.0, 12.0, 28.0)),
        _score_banded(metrics.revenue_growth, (-5.0, 5.0, 15.0, 25.0)),
        _score_banded(metrics.earnings_growth, (-5.0, 5.0, 15.0, 25.0)),
    )
    valuation_components = _compact_scores(
        _score_banded(metrics.analyst_target_upside, (-10.0, 0.0, 10.0, 20.0)),
        _score_recommendation_mean(metrics.analyst_recommendation_mean),
    )
    activity_components = _compact_scores(
        _score_banded(metrics.volume_ratio, (0.7, 0.95, 1.15, 1.4)),
        _score_banded(metrics.daily_change_percent, (-2.0, 0.0, 2.0, 4.0)),
        _score_banded(metrics.momentum_1m, (-8.0, 0.0, 8.0, 18.0)),
    )
    catalyst_components = _compact_scores(
        _score_banded(float(metrics.news_count_7d), (0.0, 2.0, 4.0, 7.0)),
        _score_banded(_safe_float(metrics.analyst_opinion_count), (0.0, 5.0, 10.0, 20.0)),
        _score_banded(abs(metrics.daily_change_percent), (0.8, 1.8, 3.5, 6.0)),
    )

    prosperity = _average_score(prosperity_components)
    valuation = _average_score(valuation_components)
    fund_flow = _average_score(activity_components)
    catalyst = _average_score(catalyst_components)
    total = round(mean([prosperity, valuation, fund_flow, catalyst]), 1)

    if total >= 4.3:
        label = "优先跟踪"
    elif total >= 3.6:
        label = "重点观察"
    elif total >= 3.0:
        label = "保持观察"
    else:
        label = "谨慎观察"

    return RecommendationScorecard(
        prosperity=prosperity,
        valuation=valuation,
        fund_flow=fund_flow,
        catalyst=catalyst,
        total=total,
        label=label,
    )


def _derive_styles(market: str, metrics: StockMetrics, scorecard: RecommendationScorecard) -> list[str]:
    styles: list[str] = []

    if scorecard.catalyst >= 4 or metrics.news_count_7d >= 5:
        styles.append("热门")

    if metrics.volatility_1m is not None and metrics.volatility_1m <= 18 and scorecard.total >= 3.2:
        styles.append("稳健")
    elif scorecard.total >= 4.2 and abs(metrics.daily_change_percent) <= 2.5:
        styles.append("稳健")

    if (
        metrics.volatility_1m is not None and metrics.volatility_1m >= 30
    ) or (
        metrics.analyst_target_upside is not None and metrics.analyst_target_upside >= 20
    ) or (
        metrics.momentum_1m is not None and abs(metrics.momentum_1m) >= 15
    ):
        styles.append("高弹性")

    if market.startswith("CN"):
        styles.append("A股")
    if market.startswith("US"):
        styles.append("美股")

    return list(dict.fromkeys(styles))


def _build_rationale(metrics: StockMetrics, scorecard: RecommendationScorecard) -> str:
    clauses: list[str] = []

    if metrics.momentum_3m is not None:
        clauses.append(f"近3个月价格变动 {metrics.momentum_3m:+.1f}%")
    if metrics.volume_ratio is not None:
        clauses.append(f"近5日/20日量比 {metrics.volume_ratio:.2f} 倍")
    if metrics.news_count_7d > 0:
        clauses.append(f"近7天抓取到 {metrics.news_count_7d} 条真实新闻")
    elif metrics.news_providers:
        clauses.append("新闻源可用，但近7天未抓到新增高相关资讯")
    else:
        clauses.append("新闻热度维度暂无稳定真实数据，因此未加分")

    if metrics.analyst_target_upside is not None:
        clauses.append(f"分析师一致目标价相对现价 {metrics.analyst_target_upside:+.1f}%")
    elif metrics.analyst_consensus:
        coverage_text = metrics.analyst_consensus
        if metrics.analyst_opinion_count:
            coverage_text = f"{coverage_text}（{metrics.analyst_opinion_count} 位分析师覆盖）"
        clauses.append(f"分析师一致预期为 {coverage_text}")
    else:
        clauses.append("分析师目标价或一致预期不足，估值维度按中性处理")

    if metrics.revenue_growth is not None:
        clauses.append(f"营收增速字段 {metrics.revenue_growth:+.1f}%")
    elif metrics.earnings_growth is not None:
        clauses.append(f"盈利增速字段 {metrics.earnings_growth:+.1f}%")

    basis = "；".join(clauses[:5])
    return f"{scorecard.label}：{basis}。"


def _derive_data_sources(metrics: StockMetrics) -> list[str]:
    sources: list[str] = [metrics.quote_provider]
    if any(value is not None for value in (metrics.momentum_1m, metrics.momentum_3m, metrics.volume_ratio, metrics.volatility_1m)):
        sources.append(PRICE_HISTORY_PROVIDER)
    sources.extend(metrics.news_providers)
    if metrics.supports_analyst_data:
        sources.append(ANALYST_PROVIDER)
    return list(dict.fromkeys(source for source in sources if source))


def _derive_style_filters(groups: list[RecommendationGroup]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []

    for label in STYLE_FILTER_PRIORITY:
        if any(label in stock.styles for group in groups for stock in group.stocks):
            seen.add(label)
            ordered.append(label)

    for group in groups:
        for stock in group.stocks:
            for style in stock.styles:
                if style not in seen:
                    seen.add(style)
                    ordered.append(style)

    return ordered


def _safe_history(ticker: yf.Ticker) -> Any:
    try:
        history = ticker.history(period="6mo", interval="1d", auto_adjust=False)
    except Exception as exc:
        logger.warning("Recommendation history fetch failed: %s", exc)
        return None
    if getattr(history, "empty", True):
        return None
    return history


def _safe_info(ticker: yf.Ticker) -> dict[str, Any]:
    try:
        info = ticker.info or {}
    except Exception as exc:
        logger.warning("Recommendation info fetch failed: %s", exc)
        return {}
    return info if isinstance(info, dict) else {}


def _extract_momentum(history: Any, lookback_days: int) -> float | None:
    closes = _get_series(history, "Close")
    if closes is None or len(closes) <= lookback_days:
        return None

    latest = _safe_float(closes.iloc[-1])
    base = _safe_float(closes.iloc[-(lookback_days + 1)])
    if latest is None or base in (None, 0):
        return None
    return round(((latest / base) - 1) * 100, 2)


def _extract_volume_ratio(history: Any) -> float | None:
    volumes = _get_series(history, "Volume")
    if volumes is None or len(volumes) < 20:
        return None

    last_five = [_safe_float(value) for value in volumes.tail(5)]
    last_twenty = [_safe_float(value) for value in volumes.tail(20)]
    valid_five = [value for value in last_five if value is not None]
    valid_twenty = [value for value in last_twenty if value is not None]

    if len(valid_five) < 3 or len(valid_twenty) < 10:
        return None

    avg_five = mean(valid_five)
    avg_twenty = mean(valid_twenty)
    if avg_twenty <= 0:
        return None
    return round(avg_five / avg_twenty, 2)


def _extract_volatility(history: Any, lookback_days: int) -> float | None:
    closes = _get_series(history, "Close")
    if closes is None or len(closes) <= lookback_days:
        return None

    try:
        returns = closes.pct_change().dropna().tail(lookback_days)
        if getattr(returns, "empty", True):
            return None
        volatility = float(returns.std()) * math.sqrt(252) * 100
    except Exception:
        return None

    if math.isnan(volatility) or math.isinf(volatility):
        return None
    return round(volatility, 2)


def _count_recent_news(items: list[Any], days: int = 7) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    count = 0
    for item in items:
        published_at = getattr(item, "published_at", None)
        if isinstance(published_at, datetime) and published_at >= cutoff:
            count += 1
    return count


def _filter_real_news_providers(providers: list[str] | tuple[str, ...]) -> list[str]:
    cleaned: list[str] = []
    for provider in providers:
        if not provider or provider == MOCK_PROVIDER:
            continue
        cleaned.append(provider)
    return cleaned


def _humanize_analyst_consensus(info: dict[str, Any], recommendation_mean: float | None) -> str | None:
    raw_key = _pick_first_text(info.get("recommendationKey"))
    if raw_key:
        normalized = raw_key.strip().lower().replace("-", "_")
        mapping = {
            "strong_buy": "强烈推荐",
            "buy": "买入",
            "hold": "中性",
            "underperform": "减持",
            "sell": "卖出",
        }
        if normalized in mapping:
            return mapping[normalized]

    if recommendation_mean is None:
        return None
    if recommendation_mean <= 1.8:
        return "强烈推荐"
    if recommendation_mean <= 2.6:
        return "买入"
    if recommendation_mean <= 3.4:
        return "中性"
    if recommendation_mean <= 4.2:
        return "减持"
    return "卖出"


def _score_banded(value: float | None, thresholds: tuple[float, float, float, float]) -> int | None:
    if value is None:
        return None
    low, low_mid, high_mid, high = thresholds
    if value < low:
        return 1
    if value < low_mid:
        return 2
    if value < high_mid:
        return 3
    if value < high:
        return 4
    return 5


def _score_recommendation_mean(value: float | None) -> int | None:
    if value is None:
        return None
    if value <= 1.8:
        return 5
    if value <= 2.6:
        return 4
    if value <= 3.4:
        return 3
    if value <= 4.2:
        return 2
    return 1


def _average_score(values: list[int]) -> int:
    if not values:
        return 3
    return max(1, min(5, round(mean(values))))


def _compact_scores(*values: int | None) -> list[int]:
    return [value for value in values if value is not None]


def _derive_data_sources_from_iterable(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def _get_series(history: Any, column: str) -> Any:
    if history is None or column not in history:
        return None
    try:
        series = history[column].dropna()
    except Exception:
        return None
    if getattr(series, "empty", True):
        return None
    return series


def _safe_float(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(parsed) or math.isinf(parsed):
        return None
    return parsed


def _safe_int(value: Any) -> int | None:
    parsed = _safe_float(value)
    if parsed is None:
        return None
    return int(parsed)


def _to_percentage(value: Any) -> float | None:
    parsed = _safe_float(value)
    if parsed is None:
        return None
    return round(parsed * 100, 2)


def _pick_first_text(*values: Any) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None

