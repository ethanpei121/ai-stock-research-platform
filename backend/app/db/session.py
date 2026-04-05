from collections.abc import Generator
import logging

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.models import Base


settings = get_settings()
logger = logging.getLogger(__name__)

engine = (
    create_engine(
        settings.normalized_database_url,
        pool_pre_ping=True,
        future=True,
    )
    if settings.normalized_database_url
    else None
)

SessionLocal = (
    sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
        future=True,
    )
    if engine is not None
    else None
)


def get_engine() -> Engine:
    if engine is None:
        raise RuntimeError("DATABASE_URL is not configured.")
    return engine


def get_db() -> Generator[Session, None, None]:
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL is not configured.")

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db_schema() -> None:
    if engine is None:
        return
    try:
        Base.metadata.create_all(bind=engine)
    except SQLAlchemyError as exc:
        logger.warning("Database schema initialization skipped because the database is unavailable: %s", exc)
