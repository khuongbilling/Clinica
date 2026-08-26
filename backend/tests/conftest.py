"""Shared pytest infrastructure for the backend authority suite.

The authority tests use httpx's ASGI transport and call ``asyncio.run``
directly because the project does not depend on an asyncio pytest plugin.
Motor binds its executor to the first event loop it uses, so one loop per
test leaves later ASGI tests with a closed-loop client.  Keep one runner for
the entire pytest session; this file intentionally contains no application
behavior.
"""

from __future__ import annotations

import asyncio
import inspect
import sys
from pathlib import Path
from typing import Any, Coroutine

import pytest


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


@pytest.fixture(scope="session", autouse=True)
def shared_asyncio_runner() -> Any:
    """Run every plain-asyncio backend test on one session loop."""

    runner = asyncio.Runner()
    original_run = asyncio.run

    def run_on_shared_loop(
        main: Coroutine[Any, Any, Any],
        *,
        debug: bool | None = None,
    ) -> Any:
        if not inspect.iscoroutine(main):
            raise ValueError("a coroutine was expected")
        if debug is not None:
            runner.get_loop().set_debug(debug)
        return runner.run(main)

    asyncio.run = run_on_shared_loop
    try:
        yield
    finally:
        asyncio.run = original_run
        runner.close()