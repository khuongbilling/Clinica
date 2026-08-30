# INFRA-R3 — Replit Exit / MongoDB Migration Runbook

Status: PRE-CUTOVER SAFETY PLAN

This runbook exists to move Clinica's current MongoDB data out of Replit without changing gameplay rules, reward authority, save semantics, or player state during preparation. It is intentionally conservative. Do not cancel, delete, reset, or repurpose the Replit workspace until every exit gate in this document is satisfied.

## 1. Known current baseline

- Source application workspace: Replit Clinica project.
- Source database name: `clinica`.
- Source MongoDB: standalone MongoDB 7.0.x, bound locally to `127.0.0.1:27017`.
- Source storage: Replit workspace-local `.local/mongodb-data` (approximately 434 MB filesystem usage at the 2026-08-29 audit).
- `MONGO_URL` is not currently configured, so the backend falls back to the local database.
- Source authentication is not enabled by the configured local `mongod` launch command.
- MongoDB Database Tools (`mongodump`, `mongorestore`, `mongosh`) were not installed at the audit checkpoint.
- The Replit workspace has ample free disk capacity for a logical archive and restore-verification artifacts.
- Backend code is now reproducible outside Replit via `infra-r2-backend-portability` and its GitHub CI.
- Godot validation is already reproducible outside Replit via `infra-r1-godot-ci`.

## 2. Hard safety rules

1. Do not copy the live WiredTiger directory while `mongod` is running and treat that copy as the migration artifact.
2. Prefer a logical BSON migration with official `mongodump` / `mongorestore` tools.
3. Never commit Mongo connection strings, database passwords, session secrets, exported player records, archives, or database dumps to Git.
4. Do not point either the Expo frontend or Godot client at a new backend until the restored database has passed source-vs-target verification.
5. Do not change server authority rules, reward settlement, save schema, stable IDs, or progression as part of this infrastructure migration.
6. Do not delete the source database after cutover. Keep it as rollback protection until the new environment has passed the rollback window.
7. Any source-to-target comparison must use metadata, counts, indexes, and application-level invariant checks. Do not expose player document contents in logs.

## 3. Recommended destination

For lowest operational error risk, use a managed MongoDB service that supports MongoDB 7.0-compatible BSON restore semantics and normal `mongodb+srv://` / `mongodb://` application connections. MongoDB Atlas is the preferred default because MongoDB documents `mongodump` / `mongorestore` as an appropriate migration path for small deployments and manages database users, TLS, backups, and cluster operations.

Avoid sizing the destination from the source `.local/mongodb-data` filesystem size alone. Logical data size and index size must be measured from the running source database before choosing the destination tier. Do not choose a hard storage ceiling with insufficient headroom.

## 4. Migration phases and stop gates

### Phase A — Freeze the reproducible code baseline

Required before touching data:

- Godot CI green on a GitHub-hosted runner.
- Backend Portability CI green on a GitHub-hosted runner.
- Frontend CI green.
- Migration branch SHA recorded.

STOP if any of these checks are red.

### Phase B — Prepare source tooling without changing data

- Obtain official MongoDB Database Tools compatible with the source/server generation.
- Verify `mongodump`, `mongorestore`, and `mongosh` versions.
- Ensure the tools are temporary/dev tooling only; do not make them an application runtime dependency.
- Ensure backup output goes outside `.local/mongodb-data`.

STOP if the tooling cannot connect cleanly to the source or if installing it would alter the database directory.

### Phase C — Start source database and capture source verification manifest

During a controlled maintenance window:

- Start only the existing source `mongod` using its existing database directory and settings.
- Confirm the server identifies the expected `clinica` database.
- Capture a metadata-only verification manifest before the dump.

The manifest must include, without document contents:

- MongoDB server version and feature compatibility version.
- Database name.
- Collection and view name set.
- Exact document count per collection.
- Database logical data size, storage size, and index size (informational only).
- Collection type and capped/timeseries/validator settings.
- View source and a hash of any pipeline definition.
- Every index name and ordered key pattern.
- Index `unique`, `sparse`, `partial`, TTL, hidden, collation, wildcard, and weights semantics.
- GridFS `files` / `chunks` presence and exact counts if GridFS is used.

STOP if the source database reports corruption, an unexpected database name, or metadata that cannot be captured reliably.

### Phase D — Enter write freeze and create logical dump

To prevent missing writes:

1. Stop player-facing/backend write traffic or otherwise place the application in a maintenance/write-freeze state.
2. Confirm no source writes are occurring.
3. Run `mongodump` for the `clinica` database into a gzip-compressed archive outside the live database directory.
4. Compute a SHA-256 digest of the completed archive.
5. Copy the archive to separately preserved storage before proceeding.

Record:

- dump tool version;
- source server version;
- archive byte size;
- archive SHA-256;
- timestamp in UTC;
- source code SHA.

STOP if `mongodump` reports any warning/error that could imply an incomplete backup, or if the archive cannot be independently checksummed/copied.

### Phase E — Restore into isolated destination

- Create a new destination cluster/database user using least privilege suitable for the application.
- Restrict network access; do not leave unrestricted ingress as the permanent configuration.
- Restore the archive using `mongorestore` into the isolated destination.
- Do not overwrite the source or reuse its local data directory.
- Do not direct production clients at the restored database yet.

STOP if restore reports namespace, index, BSON, authentication, or compatibility errors.

### Phase F — Source/target verification

Capture the same metadata-only manifest from the restored target and compare it to the source.

Required equality before cutover:

- exact collection/view set;
- exact document count for every collection;
- exact index names and ordered key patterns;
- exact semantic index options (unique/sparse/partial/TTL/hidden/collation/etc.);
- capped/timeseries/view/GridFS semantics;
- application-required stable IDs and canonical schema invariants through read-only checks.

Storage byte sizes do NOT need to match because a logical restore can change allocation/layout.

Also run read-only application smoke checks against the target using a non-production/test session where possible. Do not grant rewards, mutate progression, or create duplicate claims as part of verification.

STOP if any required equality/invariant check differs. Diagnose and repeat the restore rather than manually editing player data to force a match.

### Phase G — External backend cutover

Only after database parity passes:

- Deploy the FastAPI backend from the verified GitHub SHA using the pinned Python 3.11.14 dependency baseline.
- Preserve access to `frontend/src/game/activityRegistry.manifest.json` until that repository coupling is intentionally refactored and tested.
- Configure secrets outside source control:
  - `MONGO_URL`
  - `DB_NAME`
  - `SESSION_SECRET`
  - required AI integration variables
  - faculty/curriculum-admin bootstrap variables if intentionally used
- Run backend health/import/API smoke tests.
- Run authority tests against an isolated/non-production verification context before enabling player traffic.

STOP if the backend cannot start cleanly or if authority/session behavior differs from the existing canonical contracts.

### Phase H — Frontend cutover

- Change the frontend backend URL from the Replit endpoint to the new backend.
- Rebuild from GitHub.
- Run frontend CI and end-to-end smoke paths.
- Verify login/guest session, save load, progression reads, and server-authoritative flows.
- Avoid reward-generating smoke actions unless the test account/environment is designed for them.

Rollback immediately to the prior endpoint if player-state integrity or authority behavior is uncertain.

### Phase I — Godot API connection

Godot currently has a portable `CLINICA_BACKEND_URL` configuration seam but its `HttpApiTransport` remains intentionally unimplemented.

Connect Godot only after the external backend/database pair is verified. Implement the network adapter behind the existing interface and canonical authority contract; do not duplicate server rules in the client.

Required before Godot network cutover:

- session/header semantics match canonical API contract;
- retry/error/reconciliation behavior is explicit;
- valuable state remains server authoritative;
- no local save promotes currency, inventory, rewards, progression, ownership, or claim authority;
- golden fixtures and migration validators remain green;
- Godot CI remains green.

### Phase J — Replit exit gate

Replit is safe to remove only when ALL are true:

- independent Godot CI green;
- independent backend CI green;
- frontend CI green;
- source Mongo archive exists in separately preserved storage and its SHA-256 is recorded;
- target Mongo restore verified against source manifest;
- external backend is running and tested;
- frontend no longer references a Replit backend hostname;
- Godot backend connection is tested if the Godot client is using live API functionality;
- repository audit finds no required Replit runtime/build/hostname dependency;
- rollback source is retained for the agreed rollback window;
- no unresolved BLOCKER/HIGH migration findings remain.

Only then cancel or delete the Replit environment.

## 5. Rollback strategy

Until the exit gate is complete, Replit remains the preserved source-of-truth environment for the old database only; GitHub is the code source of truth.

If cutover fails:

1. stop writes to the new destination;
2. restore application routing to the last known-good backend/source combination;
3. do not merge divergent player-state databases;
4. identify any writes that occurred on the new destination before attempting another migration;
5. repeat migration from a newly frozen authoritative source or perform a deliberately designed reconciliation process.

Never perform an ad-hoc two-way merge of player economy/progression databases.

## 6. Lock-in rating

- Engine lock-in: LOW / GREEN.
- Code/build Replit lock-in: LOW / GREEN after INFRA-R1 and INFRA-R2.
- Data/hosting Replit lock-in: MEDIUM / AMBER until the local MongoDB is exported, restored, and verified externally.
- Overall Replit cancellation readiness: NOT YET — blocked only by protected data/backend cutover work, not by Godot compilation or backend code reproducibility.
