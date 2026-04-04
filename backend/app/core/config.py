import json
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

    return urlunparse(parsed_url._replace(query=urlencode(query_params)))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        enable_decoding=False,
    )

    app_env: str = "development"
    database_url: str | None = None
    cors_allow_origins: list[str] = ["http://localhost:3000"]
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str | None = None
    dashscope_api_key: str | None = None
    dashscope_model: str | None = "qwen-plus-2025-07-28"
    dashscope_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    alpha_vantage_api_key: str | None = None
    finnhub_api_key: str | None = None
    tushare_token: str | None = None

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def parse_cors_allow_origins(cls, value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            stripped_value = value.strip()
            if not stripped_value:
                return []
            if stripped_value.startswith("["):
                try:
                    parsed_value = json.loads(stripped_value)
                except json.JSONDecodeError as exc:
                    raise ValueError("CORS_ALLOW_ORIGINS JSON format is invalid.") from exc

                if not isinstance(parsed_value, list):
                    raise ValueError("CORS_ALLOW_ORIGINS JSON format must be an array.")
                return [
                    str(origin).strip() for origin in parsed_value if str(origin).strip()
                ]

            return [origin.strip() for origin in stripped_value.split(",") if origin.strip()]
        if isinstance(value, list):
            return [str(origin).strip() for origin in value if str(origin).strip()]
        raise ValueError(
            "CORS_ALLOW_ORIGINS must be a JSON array string, comma-separated string, or list."
        )

    @property
    def normalized_database_url(self) -> str | None:
        if not self.database_url:
            return None
        return normalize_database_url(self.database_url)

    @property
    def llm_api_key(self) -> str | None:
        return self.dashscope_api_key or self.openai_api_key

    @property
    def llm_model(self) -> str:
        return self.dashscope_model or self.openai_model

    @property
    def llm_base_url(self) -> str | None:
        if self.dashscope_api_key:
            return self.dashscope_base_url
        return self.openai_base_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
