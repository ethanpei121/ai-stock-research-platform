from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from unittest.mock import patch

from app.main import app
from app.db import session as db_session


client = TestClient(app)


def test_health_route_returns_ok() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_init_db_schema_skips_when_database_is_unavailable(caplog) -> None:
    with patch.object(db_session, "engine", object()):
        with patch.object(
            db_session.Base.metadata,
            "create_all",
            side_effect=OperationalError("SELECT 1", {}, Exception("network is unreachable")),
        ):
            with caplog.at_level("WARNING"):
                db_session.init_db_schema()

    assert "Database schema initialization skipped" in caplog.text
