from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas.market import (
    ActionResponse,
    AnnouncementsResponse,
    CompareRequest,
    CompareResponse,
    FundamentalsResponse,
    NewsResponse,
    QuoteResponse,
    RecentViewItemResponse,
    RecentViewPayload,
    RecentViewsResponse,
    RecommendationsResponse,
    SummaryRequest,
    SummaryResponse,
    WatchlistItemPayload,
    WatchlistItemResponse,
    WatchlistResponse,
)
from app.db.session import get_db
from app.services.compare import build_compare_response
from app.services.company_data import get_announcements, get_fundamentals, validate_announcements_limit
from app.services.market_data import get_news, get_quote, normalize_symbol, validate_news_limit
from app.services.recommendations import get_recommendations
from app.services.research_store import (
    delete_watchlist_item,
    list_recent_views,
    list_watchlist,
    upsert_recent_view,
    upsert_watchlist_item,
)
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


@router.post("/compare", response_model=CompareResponse)
def compare(payload: CompareRequest) -> CompareResponse:
    return build_compare_response(payload.symbols, force_refresh=payload.fresh)


@router.get("/watchlist", response_model=WatchlistResponse)
def get_watchlist(client_id: str, db: Session = Depends(get_db)) -> WatchlistResponse:
    return list_watchlist(db, client_id)


@router.post("/watchlist", response_model=WatchlistItemResponse)
def save_watchlist_item(
    payload: WatchlistItemPayload,
    db: Session = Depends(get_db),
) -> WatchlistItemResponse:
    return upsert_watchlist_item(db, payload)


@router.delete("/watchlist/{symbol}", response_model=ActionResponse)
def remove_watchlist_item(symbol: str, client_id: str, db: Session = Depends(get_db)) -> ActionResponse:
    delete_watchlist_item(db, client_id, symbol)
    return ActionResponse(status="ok")


@router.get("/recent-views", response_model=RecentViewsResponse)
def get_recent_views(client_id: str, db: Session = Depends(get_db)) -> RecentViewsResponse:
    return list_recent_views(db, client_id)


@router.post("/recent-views", response_model=RecentViewItemResponse)
def save_recent_view(
    payload: RecentViewPayload,
    db: Session = Depends(get_db),
) -> RecentViewItemResponse:
    return upsert_recent_view(db, payload)
