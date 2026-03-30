from fastapi.testclient import TestClient

from app.main import app
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
