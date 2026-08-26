---
name: Test runner separation
description: The backend async test lifecycle and the frontend's intentionally separate test runners.
---

Backend authority tests that call `asyncio.run()` directly must execute on one
session-scoped runner when they share the global Motor client.

**Why:** Motor retains the event loop that first initializes its executor. A
fresh `asyncio.run()` loop per test closes that loop and causes later ASGI
authority tests to fail during teardown or follow-up database work.

Frontend contract scripts are intentionally executed with Sucrase/Node, even
though they have the historical `.test.ts` suffix. Vitest discovery must name
only the real assertion suites.

**How to apply:** Keep loop-sharing infrastructure in backend test fixtures,
not application startup or routes. When adding a Vitest suite, add it to the
explicit discovery list; leave standalone scripts runnable through their
existing package commands.