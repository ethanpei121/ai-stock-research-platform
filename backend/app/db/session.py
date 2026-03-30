from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


settings = get_settings()

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


def get_engine():
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
