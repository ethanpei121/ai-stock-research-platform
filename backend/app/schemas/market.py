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


class SummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symbol: str
    generated_at: datetime
    summary: SummaryContent
    data_points: SummaryDataPoints
