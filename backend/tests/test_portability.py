"""Provider-neutral backend portability checks with no database writes."""

from __future__ import annotations

import asyncio

import httpx
import pytest

from runtime_config import RuntimeConfigError, get_runtime_config


def test_production_configuration_fails_closed_without_required_values() -> None:
    base = {
        "CLINICA_ENV": "production",
        "MONGO_URL": "mongodb://db.example.invalid:27017",
        "DB_NAME": "clinica",
        "SESSION_SECRET": "portable-test-secret",
    }
    for name in ("MONGO_URL", "DB_NAME", "SESSION_SECRET"):
        config = {key: value for key, value in base.items() if key != name}
        with pytest.raises(RuntimeConfigError):
            get_runtime_config(config)


def test_non_production_defaults_remain_compatible() -> None:
    config = get_runtime_config({"CLINICA_ENV": "test"})
    assert config.mongo_url == "mongodb://127.0.0.1:27017"
    assert config.db_name == "clinica"


def test_healthz_is_non_mutating_and_provider_neutral() -> None:
    import server

    async def request() -> httpx.Response:
        transport = httpx.ASGITransport(app=server.app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            return await client.get("/healthz")

    response = asyncio.run(request())
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readyz_reports_database_failure_without_writing() -> None:
    import server

    class FailingAdmin:
        async def command(self, name: str) -> None:
            assert name == "ping"
            raise RuntimeError("database unavailable")

    class FakeClient:
        admin = FailingAdmin()

    async def request() -> httpx.Response:
        original_client = server.client
        server.client = FakeClient()
        try:
            transport = httpx.ASGITransport(app=server.app)
            async with httpx.AsyncClient(
                transport=transport, base_url="http://test"
            ) as client:
                return await client.get("/readyz")
        finally:
            server.client = original_client

    response = asyncio.run(request())
    assert response.status_code == 503
    assert response.json() == {"status": "not_ready"}