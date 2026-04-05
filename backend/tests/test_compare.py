from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.market import CompareResponse, CompareStockResponse, FundamentalsResponse, QuoteResponse


client = TestClient(app)


def test_compare_route_returns_payload_when_service_is_mocked() -> None:
    mocked_response = CompareResponse(
        generated_at=datetime.now(timezone.utc),
        items=[
            CompareStockResponse(
                symbol="AAPL",
                company_name="Apple Inc.",
                quote=QuoteResponse(
                    symbol="AAPL",
                    price=214.31,
                    change=1.42,
                    change_percent=0.67,
                    currency="USD",
                    market_time=datetime.now(timezone.utc),
                    provider="Yahoo Finance",
                ),
                fundamentals=FundamentalsResponse(
                    symbol="AAPL",
                    as_of=datetime.now(timezone.utc),
                    providers=["Yahoo Finance Fundamentals"],
                    company_name="Apple Inc.",
                    industry="Consumer Electronics",
                    market_cap=3200000000000,
                    pe_ratio=31.2,
                    pb_ratio=45.8,
                    roe=145.2,
                    revenue_growth=6.8,
                    net_profit_growth=9.1,
                ),
                news_count=5,
                latest_news_time=datetime.now(timezone.utc),
                announcement_count=0,
                latest_announcement_time=None,
                highlights=["短线表现偏强。", "营收增速为正。"],
                data_sources=["Yahoo Finance", "Yahoo Finance Fundamentals"],
            ),
            CompareStockResponse(
                symbol="MSFT",
                company_name="Microsoft",
                quote=QuoteResponse(
                    symbol="MSFT",
                    price=428.25,
                    change=-2.13,
                    change_percent=-0.49,
                    currency="USD",
                    market_time=datetime.now(timezone.utc),
                    provider="Yahoo Finance",
                ),
                fundamentals=None,
                news_count=3,
                latest_news_time=datetime.now(timezone.utc),
                announcement_count=0,
                latest_announcement_time=None,
                highlights=["短线波动需留意。"],
                data_sources=["Yahoo Finance"],
            ),
        ],
    )

    with patch("app.api.v1.market.build_compare_response", return_value=mocked_response):
        response = client.post("/api/v1/compare", json={"symbols": ["AAPL", "MSFT"]})

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["items"]) == 2
    assert payload["items"][0]["symbol"] == "AAPL"
    assert payload["items"][0]["news_count"] == 5
    assert payload["items"][1]["data_sources"] == ["Yahoo Finance"]
