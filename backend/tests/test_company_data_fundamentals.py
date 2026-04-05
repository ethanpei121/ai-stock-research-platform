from datetime import datetime, timezone
from unittest.mock import patch

import pandas as pd
import pytest

from app.services.company_data import _fetch_fundamentals_from_yfinance


class FakeTicker:
    @property
    def info(self):  # pragma: no cover - exercised by patch target
        raise RuntimeError("info is temporarily unavailable")

    @property
    def fast_info(self):  # pragma: no cover - exercised by patch target
        return {
            "market_cap": 1_000_000_000,
            "last_price": 100.0,
            "shares": 10_000_000,
        }

    @property
    def quarterly_income_stmt(self):  # pragma: no cover - exercised by patch target
        return pd.DataFrame(
            {
                datetime(2025, 6, 30, tzinfo=timezone.utc): [2_000_000_000, 400_000_000, 900_000_000],
                datetime(2025, 3, 31, tzinfo=timezone.utc): [1_600_000_000, 300_000_000, 700_000_000],
            },
            index=["Total Revenue", "Net Income", "Gross Profit"],
        )

    @property
    def income_stmt(self):  # pragma: no cover - exercised by patch target
        return pd.DataFrame()

    @property
    def quarterly_balance_sheet(self):  # pragma: no cover - exercised by patch target
        return pd.DataFrame(
            {
                datetime(2025, 6, 30, tzinfo=timezone.utc): [500_000_000, 1_200_000_000, 300_000_000],
                datetime(2025, 3, 31, tzinfo=timezone.utc): [460_000_000, 1_100_000_000, 280_000_000],
            },
            index=["Stockholders Equity", "Total Assets", "Total Debt"],
        )

    @property
    def balance_sheet(self):  # pragma: no cover - exercised by patch target
        return pd.DataFrame()


def test_yfinance_fundamentals_fallback_uses_fast_info_and_statements() -> None:
    with patch("app.services.company_data.yf.Ticker", return_value=FakeTicker()):
        response = _fetch_fundamentals_from_yfinance("TSM")

    assert response.symbol == "TSM"
    assert response.company_name == "TSM"
    assert response.market_cap == pytest.approx(1_000_000_000)
    assert response.float_market_cap == pytest.approx(1_000_000_000)
    assert response.pb_ratio == pytest.approx(2.0)
    assert response.roe == pytest.approx(80.0)
    assert response.gross_margin == pytest.approx(45.0)
    assert response.net_margin == pytest.approx(20.0)
    assert response.debt_to_asset == pytest.approx(25.0)
    assert response.revenue_growth == pytest.approx(25.0)
    assert response.net_profit_growth == pytest.approx(33.3333, rel=1e-4)
