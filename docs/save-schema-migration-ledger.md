# Clinica Save Schema Migration Ledger

> **M0-P3G companion ledger.**
>
> This ledger freezes the ordered, engine-independent migration semantics for
> the player save envelope. It documents the required future migration work and
> does not change the current runtime migration behavior.

Canonical contract: [`canonical-save-schema-contract.md`](./canonical-save-schema-contract.md)
Authority context: [`canonical-gameplay-contract.md`](./canonical-gameplay-contract.md)

## 1. Version vocabulary

| Version | Meaning | Status |
|---|---|---|
| **Unversioned legacy** | Existing raw `PlayerState` payloads, including data stored under `clinica.player.v2`, with no serialized top-level version. | Current input; infer as v1 only at the migration boundary. |
| **v1** | Legacy-compatible normalized player data with known aliases/defaults resolved but without the final split envelope. | Compatibility target. |
| **v2** | Explicitly versioned normalized player cache with stable IDs and separate authority/local classification. | Planned canonical cache step. |
| **v3** | Engine-independent `clinica.player` envelope with required `save_version: 3`, explicit authority sections, and forward-safe extensions. | Target freeze for Replit-to-Godot interchange. |

The `v2` in `clinica.player.v2` is not evidence of v2 payload semantics.
`daily_rounds.version = 2` and Journey `schema_version = 2` are independent
nested subsystem versions.

## 2. Ordered migration ledger

### Entry A — unversioned legacy → v1

**Input:** raw legacy `PlayerState` or cache payload without
`save_version`.

**Required transforms:**

- Treat the input as v1 compatibility data only; never treat the cache key as
  a schema version.
- Validate basic container types and quarantine malformed valuable fields.
- Apply fixed additive defaults currently represented by
  `normalizeProgression()`—for example empty claim arrays/maps, absent
  optional summaries, and explicit null/empty presentation values.
- Canonicalize only known aliases:
  - `nonmedical` → `curious`;
  - `nursingStudent` → `nursing_student`;
  - `nclexPrep` → `nclex`;
  - `healthcareProfessional` → `professional`.
- Do **not** map `preNursing`; its behavior differs and requires an explicit
  future decision.
- Canonicalize known Chapter 1 claim IDs:
  - `c1p1` → `c1n1`;
  - `c1p2` → `c1n4`;
  - `c1p4` → `c1n4`;
  - `c1p5` → `c1n6`.
  `c1p3` was not claimable and must not create a new claim.
- Preserve Hero ownership and only normalize a missing progression record for
  an already-owned Hero.
- Preserve `realm_seed` when present. If a legacy seed is absent, derive it
  deterministically from stable `player_id`; never use random generation.
- Preserve all stable IDs and deduplicate set-like claim/ID arrays
  deterministically.

**Forbidden transforms:**

- no currency, stamina, inventory, Hero, Player Hero, claim, reward, or receipt
  creation;
- no local-to-server account binding from a tokenless player ID;
- no device-time-generated timestamp;
- no inference of ownership from display text or array position.

**Current evidence:** `frontend/src/game/store.tsx:50-496`,
`frontend/src/game/types.ts`, and Journey
`normalizeTiles()` in `frontend/src/game/journeyMap/journeyRunRepository.ts`.

### Entry B — v1 → v2

**Input:** v1 legacy-compatible data.

**Required transforms:**

- Add the explicit player envelope metadata:
  `schema_id: "clinica.player"`, integer `save_version: 2`, and stable
  `player_id`.
- Split or classify data into `authoritative` and `local` sections without
  changing gameplay values.
- Keep Journey runs and activity attempts as references to their separately
  persisted records, not copied into the player snapshot as new authority.
- Keep `daily_rounds.version = 2` and Journey `schema_version = 2` nested and
  independent.
- Preserve all server-issued currencies, claims, receipts, stamina commitments,
  Hero state, Player Hero state, and attempt IDs exactly.
- Canonicalize set-like arrays deterministically and preserve meaningful list
  order.
- Carry unknown fields into a non-authoritative extension/quarantine area
  rather than dropping them.

**Timing rule:** a migration must not fill a missing stamina timestamp,
production timestamp, or other valuable time field with `new Date()`. It must
preserve the known value, use a fixed non-authoritative marker, or defer to the
authenticated server snapshot according to the field's ownership.

**Current evidence:** `saveLocal()`, `loadLocal()`, and `refresh()` in
`frontend/src/game/store.tsx`; current code still performs broad normalization
under the old cache key, so this step is not yet an executable migration.

### Entry C — v2 → v3

**Input:** explicit v2 normalized cache.

**Required transforms:**

- Emit the final `clinica.player` envelope with required integer
  `save_version: 3`.
- Make the authority split engine-independent:
  - server-owned durable Player values under `authoritative.player`;
  - Journey and attempt references under their own reference sections;
  - tutorial, preference, and presentation state under `local`.
- Keep Player Hero isolated from roster Hero collections and progression.
- Keep Realm layout/decor/seed as portable profile/presentation state.
- Mark Realm production/collection non-authoritative until a server-time,
  authenticated Realm contract exists.
- Preserve nested Daily Rounds and Journey versions.
- Preserve stable IDs, receipt IDs, claim keys, and attempt identity.
- Retain forward-compatible unknown extensions without interpreting them as
  authority.

**Forbidden transforms:** no downgrade to v1/v2, no local reward settlement,
no conversion of a local cache into an authenticated export, and no creation of
missing valuable state.

## 3. Nested subsystem compatibility

### Journey

Journey `schema_version` is independently migrated at the run-record boundary.
Known read compatibility includes:

- `hidden` → `unexplored`;
- `frontier` → `visibleNow`;
- `revealed` → `exploredButOutOfVision`;
- deriving missing legacy `explored_tile_ids` from tile visibility;
- treating missing map identity as legacy and abandoning stale/corrupt runs
  through the existing recovery lifecycle rather than rewriting their
  geometry.

Run UUID, chapter, attempt number, tile IDs, seed, map identity, and server
claim status are never regenerated during player-save migration.

### Daily Rounds

Daily Rounds `version = 2` remains a nested migration. Legacy V1 entitlements
are evidence for the authenticated settlement route only. A client migration
may mark/read pending settlement state, but may not apply currency, stamina, or
material rewards locally.

The backend's receipt/idempotency and compare-and-set behavior remains the
authority for replay and cross-device settlement.

## 4. Determinism and safety invariants

Every migration function MUST be:

- pure: no network, storage writes, random values, device clock, or reward
  side effects;
- idempotent: applying the same migration twice produces the same canonical
  result;
- ordered: only `v1 → v2 → v3` (or a documented sequence of those steps);
- stable-ID preserving;
- deterministic when deduplicating maps, lists, claims, and aliases;
- fail-closed for malformed valuable state;
- incapable of granting or minting currency, stamina, inventory, Heroes,
  Player Hero state, claims, rewards, or receipts.

The runtime may write the migrated cache after a successful read, but that
write is a cache rewrite—not a reward or authority mutation.

## 5. Unknown versions and downgrade policy

| Input | Required behavior |
|---|---|
| Missing `save_version` | Infer legacy v1 at the migration boundary only. |
| Known v1/v2/v3 | Apply the ordered migration path. |
| `save_version` greater than the supported version | Preserve/quarantine raw data, provide a safe read-only or server-refresh path, and do not rewrite it. |
| Malformed JSON/container shape | Reject or quarantine; do not fill valuable state from guesses. |
| Older cache after a newer backend response | Replace authoritative fields with the backend response; do not let the old cache regress claims or rewards. |
| Requested downgrade | Reject. There is no destructive downgrade path. |

Unknown fields on a known version may survive in opaque extensions, but they
must not be treated as authority merely because a future engine wrote them.

## 6. Save/export/import and refresh ledger

| Operation | Owner and rule |
|---|---|
| Local cache read | Client parser/migration; presentation only until signed backend reconciliation. |
| Local cache write | Client cache adapter after canonical normalization; no reward side effects. |
| Authenticated player refresh | Backend durable Player snapshot wins for authoritative fields. |
| Journey reload | Journey repository/server run record wins; run identity remains separate. |
| Activity resume | Server attempt record and receipt state win over compact Player summaries. |
| Offline/tokenless save | Local-only; never binds or mutates backend authority. |
| Export | Versioned data record; omit/redact transport session credentials. |
| Import | Known-version migration only; never grants value; unknown future versions are quarantined. |
| Reset | Must clear all explicitly owned local namespaces in a later implementation; current namespace mismatch remains a tracked risk. |

Current refresh behavior in `frontend/src/game/store.tsx` includes a narrow
one-way merge for selected onboarding flags. A future implementation must keep
such exceptions explicitly enumerated; it must not generalize them into
client-wins merging for valuable fields.

## 7. Migration test requirements

The implementation stage must add portable, non-renderer migration fixtures
and tests for:

- unversioned current `PlayerState` and `clinica.player.v2` cache inputs;
- v1, v2, and v3 canonical fixtures;
- missing additive fields and malformed field types;
- every approved learning-profile and Journey-ID alias;
- legacy Journey visibility names and missing explored IDs;
- duplicate claims, IDs, receipts, and set-like entries;
- repeated migration/idempotence;
- stale local cache followed by backend refresh;
- tokenless local saves and failed/offline reconciliation;
- unknown future versions and preservation/quarantine behavior;
- attempted downgrade;
- Player versus roster Hero separation;
- Player Hero non-creation during migration;
- Realm local-time/production data remaining non-authoritative;
- Daily Rounds nested-version preservation and no-local-reward settlement;
- Journey run identity/schema preservation;
- duplicate Journey attempts, duplicate claims, and replay-safe receipts;
- no minting of currency, stamina, inventory, Heroes, claims, rewards, or
  receipts under any migration path.

Existing evidence to reuse includes:

- `frontend/tests/daily_rounds_v2.test.ts`;
- `frontend/tests/journey_run_lifecycle.test.ts`;
- `frontend/tests/journey_map_run_identity.test.ts`;
- `frontend/tests/chapter_boss_keys.test.ts`;
- `backend/tests/test_player_api.py`;
- `backend/tests/daily_rounds_authority_check.py`;
- `backend/tests/test_clinical_simulation_authority.py`;
- `backend/tests/test_grand_rounds_authority.py`;
- `backend/tests/test_crisis_drill_authority.py`.

## 8. Current implementation gaps and tracked risks

This ledger intentionally records, rather than repairs, the following:

1. There is no serialized top-level player `save_version`.
2. `normalizeProgression()` combines compatibility backfills, data repair,
   current-time reads, and runtime freshness.
3. Realm production uses local time and generic snapshot-shaped persistence.
4. `clinica:journey:expanded` is outside the `clinica.` reset sweep.
5. Generic Journey `cleared` is weaker than the dedicated guarded boss route.
6. Tutorial/local acknowledgements and account onboarding flags have split
   ownership.

These gaps are the input to later implementation stages, not exceptions to the
contract.

## 9. Portability rating

**ENGINE LOCK-IN: LOW.**

**Unity migration impact: LOW / ACCEPTABLE.**

The required engine-independent boundary keeps valuable state on authenticated
server contracts and keeps rules, IDs, attempts, Journey identity, and nested
versions portable. Expo/React Native navigation, local storage adapters,
animations, fog rendering, and other presentation code may be replaced without
changing the save contract.