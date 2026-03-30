from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class QuoteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symbol: str
    price: float
    change: float
    change_percent: float
    currency: str
    market_time: datetime
    provider: str


class NewsItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    url: str
    published_at: datetime
    source: str


class NewsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symbol: str
    count: int
    items: list[NewsItem]
    providers: list[str] = Field(default_factory=list)


class AnnouncementItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    url: str
    published_at: datetime
    source: str
    category: str | None = None


class AnnouncementsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symbol: str
    count: int
    items: list[AnnouncementItem]
    providers: list[str] = Field(default_factory=list)


class FundamentalsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symbol: str
    as_of: datetime
    providers: list[str] = Field(default_factory=list)
    company_name: str | None = None
    industry: str | None = None
    listed_date: str | None = None
    market_cap: float | None = None
    float_market_cap: float | None = None
    pe_ratio: float | None = None
    pb_ratio: float | None = None
    roe: float | None = None
    gross_margin: float | None = None
    net_margin: float | None = None
    debt_to_asset: float | None = None
    revenue_growth: float | None = None
    net_profit_growth: float | None = None
    source_note: str | None = None


class SummaryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symbol: str = Field(..., min_length=1)


class SummaryContent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bullish: list[str]
    bearish: list[str]
    conclusion: str


class SummaryDataPoints(BaseModel):
    model_config = ConfigDict(extra="forbid")

    price: float
    change_percent: float
    news_count: int


class SummaryMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: str
    model: str | None = None
    is_fallback: bool


class SummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symbol: str
    generated_at: datetime
    summary: SummaryContent
    data_points: SummaryDataPoints
    meta: SummaryMeta


class RecommendationEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    momentum_1m: float | None = None
    momentum_3m: float | None = None
    volume_ratio: float | None = None
    news_count_7d: int = 0
    analyst_target_upside: float | None = None
    analyst_consensus: str | None = None
    analyst_opinion_count: int | None = None
    revenue_growth: float | None = None
    earnings_growth: float | None = None


class RecommendationScorecard(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prosperity: int = Field(..., ge=1, le=5)
    valuation: int = Field(..., ge=1, le=5)
    fund_flow: int = Field(..., ge=1, le=5)
    catalyst: int = Field(..., ge=1, le=5)
    total: float = Field(..., ge=1, le=5)
    label: str


class RecommendationStock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symbol: str
    company_name: str
    market: str
    region: str
    rationale: str
    tags: list[str] = Field(default_factory=list)
    styles: list[str] = Field(default_factory=list)
    scorecard: RecommendationScorecard
    evidence: RecommendationEvidence
    data_sources: list[str] = Field(default_factory=list)


class RecommendationGroup(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    category: str
    subcategory: str
    description: str
    stocks: list[RecommendationStock]


class RecommendationsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    updated_at: datetime
    categories: list[str]
    style_filters: list[str]
    methodology: str
    data_sources: list[str] = Field(default_factory=list)
    groups: list[RecommendationGroup]
