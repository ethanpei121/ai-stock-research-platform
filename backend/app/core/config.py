from functools import lru_cache
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    parsed_url = urlparse(database_url)
    if not parsed_url.scheme.startswith("postgresql"):
        return database_url

    query_params = dict(parse_qsl(parsed_url.query, keep_blank_values=True))
    query_params.setdefault("sslmode", "require")

    return urlunparse(
        parsed_url._replace(query=urlencode(query_params))
    )


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    database_url: str | None = None
    cors_allow_origins: list[str] = ["http://localhost:3000"]

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def parse_cors_allow_origins(cls, value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        if isinstance(value, list):
            return [str(origin).strip() for origin in value if str(origin).strip()]
        raise TypeError("CORS_ALLOW_ORIGINS must be a comma-separated string or list")

    @property
    def normalized_database_url(self) -> str | None:
        if not self.database_url:
            return None
        return normalize_database_url(self.database_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()
