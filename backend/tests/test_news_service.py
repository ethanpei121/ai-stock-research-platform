from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from app.schemas.market import NewsItem
from app.services import market_data


def _build_news_item(index: int, source: str = "Yahoo Finance") -> NewsItem:
    return NewsItem(
        title=f"news-{index}",
        url=f"https://example.com/{index}",
        published_at=datetime.now(timezone.utc) - timedelta(minutes=index),
        source=source,
    )


def test_get_news_stops_fetching_after_reaching_target_count() -> None:
    market_data.NEWS_CACHE.clear()
    yfinance_items = [_build_news_item(index) for index in range(8)]

    with (
        patch("app.services.market_data._fetch_yfinance_news_items", return_value=yfinance_items) as mock_yfinance,
        patch("app.services.market_data._fetch_google_news_items") as mock_google,
        patch("app.services.market_data._fetch_alpha_vantage_news_items") as mock_alpha,
        patch(
            "app.services.market_data.get_settings",
            return_value=SimpleNamespace(alpha_vantage_api_key="demo", finnhub_api_key=None),
        ),
    ):
        response = market_data.get_news("AMD", limit=6, force_refresh=True)

    assert response.count == 6
    assert response.providers == ["Yahoo Finance"]
    mock_yfinance.assert_called_once_with("AMD")
    mock_google.assert_not_called()
    mock_alpha.assert_not_called()


def test_get_news_returns_mock_items_when_all_sources_are_empty() -> None:
    market_data.NEWS_CACHE.clear()

    with (
        patch("app.services.market_data._fetch_yfinance_news_items", return_value=[]),
        patch("app.services.market_data._fetch_google_news_items", return_value=[]),
        patch(
            "app.services.market_data.get_settings",
            return_value=SimpleNamespace(alpha_vantage_api_key=None, finnhub_api_key=None),
        ),
    ):
        response = market_data.get_news("AMD", limit=6, force_refresh=True)

    assert response.count == 6
    assert response.providers == ["mock:fallback"]
    assert all(item.source == "mock:fallback" for item in response.items)
