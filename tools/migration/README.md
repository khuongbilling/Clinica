# Clinica MongoDB Migration Tooling

## INFRA-R3A — Source preservation

Purpose: preserve the current Replit-local MongoDB before any backend/database cutover.

Guardrails:

- Do not cancel or delete the Replit workspace before the archive is restored and verified elsewhere.
- Do not copy the live `.local/mongodb-data` WiredTiger directory as the primary migration method.
- Do not redirect frontend or Godot clients during this step.
- Do not merge source and target player state in both directions.
- Do not expose document contents, player identifiers, tokens, or secret values in the metadata manifest.

The source-preservation script requires a running source MongoDB plus `mongodump`, Python/PyMongo, and `sha256sum`. It writes only to an explicitly supplied backup output directory.

Successful R3A evidence consists of:

1. metadata-only source manifest;
2. compressed logical archive;
3. SHA-256 checksum file;
4. checksum verification PASS;
5. source database left unchanged.

After R3A, the next phase is R3B: restore the archive into an isolated external MongoDB target and compare source/target collection sets, exact document counts, collection/view options, and index semantics before any application connection string is changed.

ENGINE LOCK-IN: LOW. The archive/metadata boundary is engine-independent and does not couple gameplay rules, save authority, or client presentation to Replit, Godot, or a specific future game engine.
