from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.market import QuoteResponse, SummaryContent, SummaryDataPoints, SummaryMeta, SummaryResponse


client = TestClient(app)


def test_quote_route_can_force_refresh() -> None:
    with patch("app.api.v1.market.get_quote") as mock_get_quote:
        mock_get_quote.return_value = QuoteResponse(
            symbol="AAPL",
            price=189.12,
            change=1.23,
            change_percent=0.65,
            currency="USD",
            market_time=datetime.now(timezone.utc),
            provider="Yahoo Finance",
        )

        response = client.get("/api/v1/quote?symbol=AAPL&fresh=true")

        assert response.status_code == 200
        mock_get_quote.assert_called_once_with("AAPL", force_refresh=True)


def test_summary_route_defaults_to_force_refresh() -> None:
    with patch("app.api.v1.market.generate_summary") as mock_generate_summary:
        now = datetime.now(timezone.utc)
        mock_generate_summary.return_value = SummaryResponse(
            symbol="AAPL",
            generated_at=now,
            summary=SummaryContent(
                bullish=["最新行情已刷新。", "新闻已重新抓取。"],
                bearish=["免费源仍可能有分钟级延迟。", "正式投资前仍需复核。"],
                conclusion="当前摘要已基于本轮刷新结果生成。",
            ),
            data_points=SummaryDataPoints(
                price=189.12,
                change_percent=0.65,
                news_count=5,
            ),
            meta=SummaryMeta(
                provider="template",
                model=None,
                is_fallback=True,
                force_refresh_used=True,
                quote_provider="Yahoo Finance",
                quote_market_time=now,
                latest_news_time=now,
                news_providers=["Yahoo Finance", "Google News RSS"],
            ),
        )

        response = client.post("/api/v1/summary", json={"symbol": "AAPL"})

        assert response.status_code == 200
        assert mock_generate_summary.call_count == 1
        assert mock_generate_summary.call_args.args[0] == "AAPL"
        assert mock_generate_summary.call_args.kwargs["force_refresh"] is True
        assert isinstance(mock_generate_summary.call_args.kwargs["generated_at"], datetime)
