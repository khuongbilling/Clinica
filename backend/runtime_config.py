"""Provider-neutral runtime configuration for the Clinica backend.

Development keeps the historical local MongoDB defaults so the Replit workflow
and existing authority tests remain compatible. Production is explicit:
required connection and signing configuration must be supplied by the host's
secret/environment manager rather than by repository content.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping


class RuntimeConfigError(RuntimeError):
    """Raised when the deployment environment is not safe to start."""


@dataclass(frozen=True)
class RuntimeConfig:
    environment: str
    mongo_url: str
    db_name: str
    session_secret: str | None


def get_runtime_config(environ: Mapping[str, str] | None = None) -> RuntimeConfig:
    """Return validated runtime settings without contacting external services."""
    values = os.environ if environ is None else environ
    environment = (values.get("CLINICA_ENV") or "development").strip().lower()

    if environment not in {"development", "test", "production"}:
        raise RuntimeConfigError(
            "CLINICA_ENV must be development, test, or production"
        )

    mongo_url = (values.get("MONGO_URL") or "").strip()
    db_name = (values.get("DB_NAME") or "").strip()
    session_secret = values.get("SESSION_SECRET")

    if environment != "production":
        return RuntimeConfig(
            environment=environment,
            mongo_url=mongo_url or "mongodb://127.0.0.1:27017",
            db_name=db_name or "clinica",
            session_secret=session_secret,
        )

    missing = [
        name
        for name, value in (
            ("MONGO_URL", mongo_url),
            ("DB_NAME", db_name),
            ("SESSION_SECRET", session_secret),
        )
        if not value or not value.strip()
    ]
    if missing:
        raise RuntimeConfigError(
            "required production configuration is missing: " + ", ".join(missing)
        )

    return RuntimeConfig(
        environment=environment,
        mongo_url=mongo_url,
        db_name=db_name,
        session_secret=session_secret,
    )