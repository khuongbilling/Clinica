# Clinica External Backend Portability

This document describes the provider-neutral FastAPI backend package for a
standard external host. It does not change the frontend, Godot client, API
authority rules, save contracts, gameplay, rewards, routing, or database
schema.

## Runtime boundary

The external host runs the existing `backend/server.py` application with
Python **3.11.14** and the pinned dependency closure in
`backend/constraints-python311-2026-08-29.txt`.

The repository contains code and dependency metadata only. Runtime secrets
must be supplied by the external host's secret manager or environment
injection:

- `MONGO_URL` — the target MongoDB connection URI
- `DB_NAME` — the application database name, normally `clinica`
- `SESSION_SECRET` — the server-side session/signing secret

Do not put any of these values in Git, `.env`/`.envrc` files committed to the
repository, Docker build arguments, image layers, issue reports, or logs.
The checked-in `.dockerignore` excludes local environment files, credential
JSON, PEM files, database archives, dumps, and local database state from the
container build context.

Set `CLINICA_ENV=production` on the external host. In that mode the backend
fails closed if any of `MONGO_URL`, `DB_NAME`, or `SESSION_SECRET` is absent or
blank. Development and test environments retain the historical local-Mongo
defaults for the Replit workflow and authority-test compatibility.

## Health and readiness

- `GET /healthz` is a non-mutating process/import liveness probe. It does not
  contact MongoDB and returns `200` when the application is loaded.
- `GET /readyz` validates runtime configuration and sends a non-mutating
  MongoDB `ping`. It returns `200` only when both are ready and `503` otherwise.

Neither endpoint creates indexes, writes documents, settles rewards, changes
progression, or performs a migration.

## Standard host process

Install the exact backend closure from the repository root:

```bash
python3.11 --version  # must report 3.11.14
python3.11 -m pip install \
  -r backend/requirements.txt \
  -c backend/constraints-python311-2026-08-29.txt
python3.11 -m pip check
```

Inject the three runtime values through the host's secret manager, set
`CLINICA_ENV=production`, and run:

```bash
python3.11 -m uvicorn server:app \
  --app-dir backend \
  --host 0.0.0.0 \
  --port "${PORT:-8000}"
```

Use the host's health checker against `/healthz` and readiness checker against
`/readyz`. `PORT` is a non-secret deployment setting and defaults to `8000`.

## Standard container host

Build from the repository root without embedding runtime values:

```bash
docker build -f backend/Dockerfile -t clinica-backend .
```

Pass runtime secrets at container launch through the host secret manager:

```bash
docker run --rm -p 8000:8000 \
  --env CLINICA_ENV=production \
  --env MONGO_URL \
  --env DB_NAME \
  --env SESSION_SECRET \
  --env PORT=8000 \
  clinica-backend
```

The image listens on `0.0.0.0:${PORT}` and does not select a hosting vendor,
change application routing, or alter the database. The application process
runs as the fixed unprivileged UID/GID `10001:10001`. MongoDB TLS, network
allowlisting, backups, and credential rotation remain responsibilities of the
managed database/host configuration; no such values belong in this repo.

## Validation boundary

The existing backend authority tests remain the canonical application test
collection. Portability CI additionally imports the app from a clean
non-Replit environment, checks the production fail-closed gate, checks health
route presence, verifies the pinned Python closure, collects all backend
tests, and confirms no tracked environment files, dumps, or migration archives
are introduced. Frontend regression verification remains the existing
`cd frontend && npm run validate` command.