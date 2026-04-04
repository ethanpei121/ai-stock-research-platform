from types import SimpleNamespace
from unittest.mock import Mock, patch

from app.services.company_data import fetch_quote_from_akshare


class FakeDataFrame:
    def __init__(self, rows):
        self._rows = rows

    def to_dict(self, orient: str):
        assert orient == "records"
        return self._rows


def test_fetch_quote_from_akshare_prefers_single_symbol_xueqiu_endpoint() -> None:
    fake_ak = SimpleNamespace(
        stock_individual_spot_xq=Mock(
            return_value=FakeDataFrame(
                [
                    {"item": "现价", "value": "275.30"},
                    {"item": "涨跌", "value": "4.20"},
                    {"item": "涨幅", "value": "1.55"},
                    {"item": "昨收", "value": "271.10"},
                    {"item": "货币", "value": "CNY"},
                    {"item": "时间", "value": "2026-04-04 15:00:00"},
                ]
            )
        ),
        stock_zh_a_spot_em=Mock(),
    )

    with patch("app.services.company_data.ak", fake_ak):
        quote = fetch_quote_from_akshare("300750.SZ")

    assert quote.symbol == "300750.SZ"
    assert quote.provider == "AkShare / Xueqiu Quote"
    assert quote.price == 275.3
    assert quote.change == 4.2
    assert quote.change_percent == 1.55
    fake_ak.stock_individual_spot_xq.assert_called_once_with(symbol="SZ300750", timeout=8)
    fake_ak.stock_zh_a_spot_em.assert_not_called()


def test_fetch_quote_from_akshare_falls_back_to_snapshot_when_single_symbol_endpoint_fails() -> None:
    fake_ak = SimpleNamespace(
        stock_individual_spot_xq=Mock(side_effect=RuntimeError("upstream timeout")),
        stock_zh_a_spot_em=Mock(
            return_value=FakeDataFrame(
                [
                    {
                        "代码": "002594",
                        "最新价": "99.01",
                        "涨跌额": "1.25",
                        "涨跌幅": "1.28",
                        "昨收": "97.76",
                        "时间戳": "15:00:00",
                    }
                ]
            )
        ),
    )

    with patch("app.services.company_data.ak", fake_ak):
        quote = fetch_quote_from_akshare("002594.SZ")

    assert quote.symbol == "002594.SZ"
    assert quote.provider == "AkShare / Eastmoney Quote"
    assert quote.price == 99.01
    assert quote.change == 1.25
    assert quote.change_percent == 1.28
    fake_ak.stock_individual_spot_xq.assert_called_once_with(symbol="SZ002594", timeout=8)
    fake_ak.stock_zh_a_spot_em.assert_called_once()
