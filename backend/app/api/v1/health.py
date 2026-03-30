from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import get_engine


public_router = APIRouter(tags=["health"])
api_router = APIRouter(prefix="/api/v1/health", tags=["health"])


@public_router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@api_router.get("/db")
def database_health_check() -> dict[str, object]:
    try:
        engine = get_engine()
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            db_value = result.scalar_one()

        return {"status": "ok", "database": "connected", "result": db_value}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Database connection failed: {exc}",
        ) from exc
