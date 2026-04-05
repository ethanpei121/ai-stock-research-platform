from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.db.models import RecentViewEntry, WatchlistEntry
from app.schemas.market import (
    RecentViewItemResponse,
    RecentViewPayload,
    RecentViewsResponse,
    WatchlistItemPayload,
    WatchlistItemResponse,
    WatchlistResponse,
)
from app.services.market_data import normalize_symbol


RECENT_VIEW_LIMIT = 8


def _validate_client_id(client_id: str) -> str:
    normalized = client_id.strip()
    if not normalized:
        raise APIError(
            status_code=400,
            code="INVALID_CLIENT_ID",
            message="client_id 不能为空。",
        )
    if len(normalized) > 128:
        raise APIError(
            status_code=400,
            code="INVALID_CLIENT_ID",
            message="client_id 长度不能超过 128。",
        )
    return normalized


def _normalize_tags(tags: list[str]) -> list[str]:
    normalized: list[str] = []
    for tag in tags:
        cleaned = str(tag).strip()
        if cleaned and cleaned not in normalized:
            normalized.append(cleaned)
        if len(normalized) >= 8:
            break
    return normalized


def _to_watchlist_item(record: WatchlistEntry) -> WatchlistItemResponse:
    return WatchlistItemResponse(
        symbol=record.symbol,
        company_name=record.company_name,
        market=record.market,
        region=record.region,
        tags=list(record.tags or []),
        status=record.status,  # type: ignore[arg-type]
        added_at=record.created_at,
        updated_at=record.updated_at,
    )


def _to_recent_view_item(record: RecentViewEntry) -> RecentViewItemResponse:
    return RecentViewItemResponse(
        symbol=record.symbol,
        company_name=record.company_name,
        viewed_at=record.viewed_at,
    )


def list_watchlist(db: Session, client_id: str) -> WatchlistResponse:
    normalized_client_id = _validate_client_id(client_id)
    rows = (
        db.query(WatchlistEntry)
        .filter(WatchlistEntry.client_id == normalized_client_id)
        .order_by(WatchlistEntry.updated_at.desc(), WatchlistEntry.id.desc())
        .all()
    )

    items = [_to_watchlist_item(row) for row in rows]
    return WatchlistResponse(client_id=normalized_client_id, count=len(items), items=items)


def upsert_watchlist_item(db: Session, payload: WatchlistItemPayload) -> WatchlistItemResponse:
    normalized_client_id = _validate_client_id(payload.client_id)
    normalized_symbol = normalize_symbol(payload.symbol)
    company_name = (payload.company_name or normalized_symbol).strip()
    if not company_name:
        company_name = normalized_symbol

    now = datetime.now(timezone.utc)
    record = (
        db.query(WatchlistEntry)
        .filter(
            WatchlistEntry.client_id == normalized_client_id,
            WatchlistEntry.symbol == normalized_symbol,
        )
        .one_or_none()
    )

    if record is None:
        record = WatchlistEntry(
            client_id=normalized_client_id,
            symbol=normalized_symbol,
            company_name=company_name,
            market=payload.market.strip() if payload.market else None,
            region=payload.region.strip() if payload.region else None,
            tags=_normalize_tags(payload.tags),
            status=payload.status,
            created_at=now,
            updated_at=now,
        )
        db.add(record)
    else:
        record.company_name = company_name
        record.market = payload.market.strip() if payload.market else record.market
        record.region = payload.region.strip() if payload.region else record.region
        record.tags = _normalize_tags(payload.tags) or list(record.tags or [])
        record.status = payload.status
        record.updated_at = now

    db.commit()
    db.refresh(record)
    return _to_watchlist_item(record)


def delete_watchlist_item(db: Session, client_id: str, symbol: str) -> None:
    normalized_client_id = _validate_client_id(client_id)
    normalized_symbol = normalize_symbol(symbol)
    record = (
        db.query(WatchlistEntry)
        .filter(
            WatchlistEntry.client_id == normalized_client_id,
            WatchlistEntry.symbol == normalized_symbol,
        )
        .one_or_none()
    )
    if record is None:
        return

    db.delete(record)
    db.commit()


def list_recent_views(db: Session, client_id: str) -> RecentViewsResponse:
    normalized_client_id = _validate_client_id(client_id)
    rows = (
        db.query(RecentViewEntry)
        .filter(RecentViewEntry.client_id == normalized_client_id)
        .order_by(RecentViewEntry.viewed_at.desc(), RecentViewEntry.id.desc())
        .limit(RECENT_VIEW_LIMIT)
        .all()
    )
    items = [_to_recent_view_item(row) for row in rows]
    return RecentViewsResponse(client_id=normalized_client_id, count=len(items), items=items)


def upsert_recent_view(db: Session, payload: RecentViewPayload) -> RecentViewItemResponse:
    normalized_client_id = _validate_client_id(payload.client_id)
    normalized_symbol = normalize_symbol(payload.symbol)
    company_name = (payload.company_name or normalized_symbol).strip()
    if not company_name:
        company_name = normalized_symbol

    now = datetime.now(timezone.utc)
    record = (
        db.query(RecentViewEntry)
        .filter(
            RecentViewEntry.client_id == normalized_client_id,
            RecentViewEntry.symbol == normalized_symbol,
        )
        .one_or_none()
    )

    if record is None:
        record = RecentViewEntry(
            client_id=normalized_client_id,
            symbol=normalized_symbol,
            company_name=company_name,
            viewed_at=now,
        )
        db.add(record)
    else:
        record.company_name = company_name
        record.viewed_at = now

    db.commit()

    obsolete_rows = (
        db.query(RecentViewEntry)
        .filter(RecentViewEntry.client_id == normalized_client_id)
        .order_by(RecentViewEntry.viewed_at.desc(), RecentViewEntry.id.desc())
        .offset(RECENT_VIEW_LIMIT)
        .all()
    )
    if obsolete_rows:
        for row in obsolete_rows:
            db.delete(row)
        db.commit()

    db.refresh(record)
    return _to_recent_view_item(record)
