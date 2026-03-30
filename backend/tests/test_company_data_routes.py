from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.market import AnnouncementItem, AnnouncementsResponse, FundamentalsResponse


client = TestClient(app)


def test_fundamentals_route_returns_payload_when_service_is_mocked() -> None:
    mocked_response = FundamentalsResponse(
        symbol="300750.SZ",
        as_of=datetime.now(timezone.utc),
        providers=["AkShare / Eastmoney Fundamentals"],
        company_name="宁德时代",
        industry="电池",
        listed_date="2018-06-11",
        market_cap=812345678901.0,
        float_market_cap=701234567890.0,
        pe_ratio=22.3,
        pb_ratio=4.8,
        roe=18.1,
        gross_margin=24.2,
        net_margin=12.4,
        debt_to_asset=55.6,
        revenue_growth=16.2,
        net_profit_growth=14.8,
        source_note="mocked",
    )

    with patch("app.api.v1.market.get_fundamentals", return_value=mocked_response):
        response = client.get("/api/v1/fundamentals?symbol=300750")

    assert response.status_code == 200
    payload = response.json()
    assert payload["company_name"] == "宁德时代"
    assert payload["providers"] == ["AkShare / Eastmoney Fundamentals"]
    assert payload["revenue_growth"] == 16.2


def test_announcements_route_validates_limit() -> None:
    response = client.get("/api/v1/announcements?symbol=300750&limit=0")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_LIMIT"


def test_announcements_route_returns_payload_when_service_is_mocked() -> None:
    mocked_response = AnnouncementsResponse(
        symbol="300750.SZ",
        count=2,
        providers=["CNINFO Disclosure", "AkShare / Eastmoney Notices"],
        items=[
            AnnouncementItem(
                title="关于 2025 年年度报告的公告",
                url="https://example.com/report.pdf",
                published_at=datetime.now(timezone.utc),
                source="CNINFO Disclosure",
                category="年报",
            ),
            AnnouncementItem(
                title="关于回购股份进展的公告",
                url="https://example.com/buyback.pdf",
                published_at=datetime.now(timezone.utc),
                source="AkShare / Eastmoney Notices",
                category="重大事项",
            ),
        ],
    )

    with patch("app.api.v1.market.get_announcements", return_value=mocked_response):
        response = client.get("/api/v1/announcements?symbol=300750&limit=2")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 2
    assert payload["providers"] == ["CNINFO Disclosure", "AkShare / Eastmoney Notices"]
    assert payload["items"][0]["category"] == "年报"
