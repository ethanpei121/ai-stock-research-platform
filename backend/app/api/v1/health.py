import logging

from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError, TimeoutError

from app.core.errors import APIError
from app.db.session import get_engine


logger = logging.getLogger(__name__)

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
            connection.execute(text("SELECT 1"))

        return {"status": "ok", "database": "connected"}
    except RuntimeError as exc:
        logger.warning("Database health check skipped: %s", exc)
        raise APIError(
            status_code=500,
            code="DATABASE_NOT_CONFIGURED",
            message="Database connectivity check failed: DATABASE_URL is not configured.",
        ) from exc
    except (SQLAlchemyError, TimeoutError) as exc:
        logger.exception("Database connectivity check failed", exc_info=exc)
        raise APIError(
            status_code=500,
            code="DATABASE_CONNECTION_FAILED",
            message="Database connectivity check failed. Please verify the database service and credentials.",
        ) from exc
