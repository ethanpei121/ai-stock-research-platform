from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.market import QuoteResponse
from app.services.market_data import normalize_symbol


client = TestClient(app)


def test_quote_requires_non_empty_symbol() -> None:
    response = client.get("/api/v1/quote?symbol=")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_SYMBOL"


def test_normalize_symbol_supports_a_share_shenzhen_code() -> None:
    assert normalize_symbol("300750") == "300750.SZ"


def test_normalize_symbol_supports_a_share_shanghai_code() -> None:
    assert normalize_symbol("600519") == "600519.SS"


def test_normalize_symbol_supports_hk_with_suffix() -> None:
    assert normalize_symbol("00700.HK") == "0700.HK"


def test_normalize_symbol_supports_hk_without_suffix() -> None:
    assert normalize_symbol("0700") == "0700.HK"


def test_get_quote_prefers_akshare_before_yfinance_for_a_share() -> None:
    mocked_quote = QuoteResponse(
        symbol="002594.SZ",
        price=99.01,
        change=1.25,
        change_percent=1.28,
        currency="CNY",
        market_time=datetime.now(timezone.utc),
        provider="AkShare / Xueqiu Quote",
    )

    with (
        patch("app.services.market_data.fetch_quote_from_akshare", return_value=mocked_quote) as mock_akshare,
        patch("app.services.market_data._fetch_quote_from_yfinance") as mock_yfinance,
    ):
        response = client.get("/api/v1/quote?symbol=002594&fresh=true")

    assert response.status_code == 200
    assert response.json()["provider"] == "AkShare / Xueqiu Quote"
    mock_akshare.assert_called_once_with("002594.SZ")
    mock_yfinance.assert_not_called()
