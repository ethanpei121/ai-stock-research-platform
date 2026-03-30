from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_quote_requires_non_empty_symbol() -> None:
    response = client.get("/api/v1/quote?symbol=")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_SYMBOL"
