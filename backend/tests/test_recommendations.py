from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.market import (
    RecommendationEvidence,
    RecommendationGroup,
    RecommendationScorecard,
    RecommendationsResponse,
    RecommendationStock,
)


client = TestClient(app)


def test_recommendations_route_returns_grouped_recommendations() -> None:
    mocked_response = RecommendationsResponse(
        updated_at=datetime.now(timezone.utc),
        categories=["科技", "医药"],
        style_filters=["热门", "稳健", "美股"],
        methodology="基于真实行情、新闻与分析师一致预期打分。",
        data_sources=["Yahoo Finance Price History", "Yahoo Finance Analyst Consensus"],
        groups=[
            RecommendationGroup(
                id="tech-ai-infra",
                category="科技",
                subcategory="AI算力与云基础设施",
                description="示例分组。",
                stocks=[
                    RecommendationStock(
                        symbol="NVDA",
                        company_name="英伟达",
                        market="US",
                        region="美国",
                        rationale="优先跟踪：近3个月价格走强，分析师覆盖度高。",
                        tags=["AI", "GPU"],
                        styles=["热门", "美股"],
                        scorecard=RecommendationScorecard(
                            prosperity=5,
                            valuation=4,
                            fund_flow=4,
                            catalyst=5,
                            total=4.5,
                            label="优先跟踪",
                        ),
                        evidence=RecommendationEvidence(
                            momentum_1m=12.5,
                            momentum_3m=28.1,
                            volume_ratio=1.34,
                            news_count_7d=6,
                            analyst_target_upside=14.2,
                            analyst_consensus="买入",
                            analyst_opinion_count=18,
                            revenue_growth=22.1,
                            earnings_growth=30.5,
                        ),
                        data_sources=[
                            "Yahoo Finance",
                            "Yahoo Finance Price History",
                            "Yahoo Finance Analyst Consensus",
                        ],
                    )
                ],
            )
        ],
    )

    with patch("app.api.v1.market.get_recommendations", return_value=mocked_response):
        response = client.get("/api/v1/recommendations")

    assert response.status_code == 200
    payload = response.json()
    assert payload["categories"] == ["科技", "医药"]
    assert payload["style_filters"] == ["热门", "稳健", "美股"]
    assert payload["methodology"]
    assert payload["groups"][0]["stocks"][0]["scorecard"]["total"] == 4.5
    assert payload["groups"][0]["stocks"][0]["evidence"]["news_count_7d"] == 6
