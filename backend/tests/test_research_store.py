from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import Base
from app.schemas.market import RecentViewPayload, WatchlistItemPayload
from app.services.research_store import (
    list_recent_views,
    list_watchlist,
    upsert_recent_view,
    upsert_watchlist_item,
)


def build_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    session_local = sessionmaker(bind=engine, future=True)
    return session_local()


def test_watchlist_item_is_persisted_and_listed() -> None:
    db = build_session()
    try:
        upsert_watchlist_item(
            db,
            WatchlistItemPayload(
                client_id="test-client",
                symbol="AAPL",
                company_name="Apple Inc.",
                market="US",
                region="美国",
                tags=["AI", "消费电子"],
                status="持续跟踪",
            ),
        )

        response = list_watchlist(db, "test-client")

        assert response.count == 1
        assert response.items[0].symbol == "AAPL"
        assert response.items[0].status == "持续跟踪"
        assert response.items[0].tags == ["AI", "消费电子"]
    finally:
        db.close()


def test_recent_views_are_upserted_and_trimmed() -> None:
    db = build_session()
    try:
        for index in range(10):
            upsert_recent_view(
                db,
                RecentViewPayload(
                    client_id="test-client",
                    symbol=f"AAPL{index}" if index > 0 else "AAPL",
                    company_name=f"Company {index}",
                ),
            )

        response = list_recent_views(db, "test-client")

        assert response.count == 8
        assert len(response.items) == 8
    finally:
        db.close()
