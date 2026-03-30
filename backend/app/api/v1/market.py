from datetime import datetime, timezone

from fastapi import APIRouter

from app.schemas.market import (
    AnnouncementsResponse,
    FundamentalsResponse,
    NewsResponse,
    QuoteResponse,
    RecommendationsResponse,
    SummaryRequest,
    SummaryResponse,
)
from app.services.company_data import get_announcements, get_fundamentals, validate_announcements_limit
from app.services.market_data import get_news, get_quote, normalize_symbol, validate_news_limit
from app.services.recommendations import get_recommendations
from app.services.summary import generate_summary


router = APIRouter(prefix="/api/v1", tags=["market"])


@router.get("/quote", response_model=QuoteResponse)
def quote(symbol: str, fresh: bool = False) -> QuoteResponse:
    return get_quote(symbol, force_refresh=fresh)


@router.get("/fundamentals", response_model=FundamentalsResponse)
def fundamentals(symbol: str) -> FundamentalsResponse:
    return get_fundamentals(normalize_symbol(symbol))


@router.get("/news", response_model=NewsResponse)
def news(symbol: str, limit: int = 5, fresh: bool = False) -> NewsResponse:
    validated_limit = validate_news_limit(limit)
    return get_news(symbol, validated_limit, force_refresh=fresh)


@router.get("/announcements", response_model=AnnouncementsResponse)
def announcements(symbol: str, limit: int = 5) -> AnnouncementsResponse:
    validated_limit = validate_announcements_limit(limit)
    return get_announcements(normalize_symbol(symbol), validated_limit)


@router.post("/summary", response_model=SummaryResponse)
def summary(payload: SummaryRequest) -> SummaryResponse:
    return generate_summary(
        payload.symbol,
        generated_at=datetime.now(timezone.utc),
        force_refresh=payload.fresh,
        quote=payload.quote,
        news_items=payload.news_items,
        news_providers=payload.news_providers,
        include_supplemental=payload.include_supplemental,
    )


@router.get("/recommendations", response_model=RecommendationsResponse)
def recommendations() -> RecommendationsResponse:
    return get_recommendations()
