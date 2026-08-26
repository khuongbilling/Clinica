# Clinica Golden Fixtures v1

This directory is the portable migration/validation asset pack for Clinica.
It captures a minimal set of engine-independent inputs and expected semantic
outputs. It does **not** replace the executable TypeScript, FastAPI, MongoDB,
or concurrency regression suites.

## Contract references

- [`docs/canonical-gameplay-contract.md`](../../../docs/canonical-gameplay-contract.md)
- [`docs/canonical-save-schema-contract.md`](../../../docs/canonical-save-schema-contract.md)
- [`docs/canonical-backend-api-authority-contract.md`](../../../docs/canonical-backend-api-authority-contract.md)
- [`docs/save-schema-migration-ledger.md`](../../../docs/save-schema-migration-ledger.md)

## Authority boundary

- `portable` fixtures describe deterministic rules/data suitable for TypeScript,
  Godot, and Unity implementations.
- `server` fixtures describe sanitized public projections of server-issued
  attempts, receipts, replay results, and error semantics. They never prove
  server authority by themselves.
- `local_projection` fixtures describe presentation/profile data that must not
  grant durable value.
- `reference` fixtures provide catalog/ID linkage and are not a reward source.

Sessions/HMAC, FastAPI routing, MongoDB unique indexes and compare-and-set
queries, real concurrency, duplicate-claim races, and server reward settlement
remain executable backend tests.

## Canonical JSON profile: `clinica-jcs-v1`

Payload hashes use SHA-256 over the fixture's `payload` value after:

1. recursively sorting object keys by JCS-compatible UTF-16 code-unit order;
2. preserving array order exactly;
3. serializing UTF-8 JSON without insignificant whitespace;
4. using JSON number syntax only for finite values;
5. normalizing source text to Unicode NFC and LF line endings before it enters a
   fixture; and
6. omitting envelope metadata, credentials, signatures, volatile timestamps,
   renderer paths, scene state, and local presentation preferences from the
   hash input.

This is intentionally compatible with the object-ordering and primitive rules
of RFC 8785/JCS for the fixture value set. The validator implements the profile
directly so TypeScript, Godot, and Unity ports have one unambiguous target.

## Fixture rules

- Every data fixture has stable envelope metadata, a `payload`, and a SHA-256
  entry in `hashes.json`.
- Player `save_version`, Journey `schema_version`, and Daily Rounds `version`
  remain independent nested contracts.
- Stable IDs are opaque strings. Display names, array positions, routes, and
  generated UUIDs are never identity.
- Migrations must be pure, deterministic, idempotent, stable-ID preserving,
  fail closed for malformed valuable data, and non-rewarding.
- Unknown future versions quarantine unchanged; they never silently downgrade.
- A local cache, client reducer, or scene outcome cannot mint currency, stamina,
  inventory, hero ownership, equipment, claims, or receipts.

## Validation

Run from the repository root:

```sh
node fixtures/clinica-golden/v1/validate.cjs
```

The validator checks fixture envelopes and hashes, stable-ID uniqueness and
resolution, non-negative quantities, equipment/loadout compatibility, Player
Hero/roster separation, Journey/activity references, migration quarantine, and
no-mint invariants. It deliberately does not emulate backend authentication or
database behavior.