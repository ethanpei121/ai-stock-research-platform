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


class RecommendationStock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symbol: str
    company_name: str
    market: str
    region: str
    rationale: str
    tags: list[str] = Field(default_factory=list)


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
    groups: list[RecommendationGroup]
