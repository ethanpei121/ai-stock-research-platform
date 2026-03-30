from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_recommendations_route_returns_grouped_recommendations() -> None:
    response = client.get("/api/v1/recommendations")

    assert response.status_code == 200
    payload = response.json()
    assert "科技" in payload["categories"]
    assert "医药" in payload["categories"]
    assert len(payload["groups"]) >= 10
    assert payload["groups"][0]["stocks"]
