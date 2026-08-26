# Clinica Canonical Save Schema Contract

> **M0-P3G documentation-and-contract freeze.**
>
> This document defines the engine-independent save boundary for a future
> Replit-to-Godot migration. It records the current authority model and the
> required versioned save contract; it is not an implementation change.
> Runtime behavior, gameplay values, normalization code, backend models and
> routes, dependencies, assets, and existing tests remain unchanged until a
> later implementation stage.

## 1. Purpose and precedence

The save contract is an interchange and ownership contract, not a renderer
contract. When persisted sources disagree, use this precedence:

1. Authenticated server state and dedicated server mutation/claim contracts own
   valuable durable state and cross-device progression.
2. Separately persisted Journey runs and activity attempts own their own
   lifecycle, identity, receipts, and replay boundaries.
3. Portable game modules and typed manifests own deterministic rules, content,
   formulas, and stable identifiers; they do not grant value by themselves.
4. Device-local cache, tutorial, preference, and presentation state may improve
   offline UX but cannot become server authority.
5. Screens, routes, animation, fog, and other engine presentation never define
   save authority.

This contract extends
[`docs/canonical-gameplay-contract.md`](./canonical-gameplay-contract.md).
The gameplay contract remains the authority for the broader rule hierarchy,
server protections, golden-master evidence, and tracked gameplay risks.
The [`canonical backend/API authority contract`](./canonical-backend-api-authority-contract.md)
defines which dedicated server routes, attempts, receipts, claims, and
reconciliation responses own the values represented by this schema.

The portable v1 migration vectors, canonical JSON profile, and fixture validator
are in [`fixtures/clinica-golden/v1/`](../fixtures/clinica-golden/v1/). Those
fixtures lock `clinica.player` v3 interchange semantics while retaining
independent Journey and Daily Rounds nested versions.

## 2. Top-level player envelope

Every canonical player export, cache payload, or engine-to-engine interchange
record MUST have this shape at the boundary:

```json
{
  "schema_id": "clinica.player",
  "save_version": 3,
  "player_id": "stable-player-uuid",
  "authoritative": {
    "player": {},
    "journey_run_refs": [],
    "activity_attempt_refs": []
  },
  "local": {
    "tutorials": {},
    "preferences": {},
    "presentation": {}
  }
}
```

Rules:

- `schema_id` MUST equal `clinica.player` for this contract.
- `save_version` MUST be an integer. It is the serialized schema version, not a
  cache-key suffix.
- `player_id` is the stable account identifier. It must not be regenerated
  during migration.
- The `authoritative` and `local` sections are an ownership boundary. A
  physical implementation may use separate records, but it must preserve this
  distinction.
- The example is the v3 envelope shape. Legacy raw `PlayerState` payloads are
  accepted only through the ordered migration ledger.

### The current cache key is not the schema version

`clinica.player.v2` is an existing AsyncStorage/localStorage cache namespace.
The `v2` suffix records a historical cache generation only. It MUST NEVER be
used as proof that the serialized player payload is schema version 2. The
payload currently has no top-level `save_version`; this is a known M0-P3G gap.

## 3. Persistence ownership

### 3.1 Backend-authoritative Player state

The authenticated MongoDB `players` document, exposed through protected API
contracts, owns:

- stable player identity and account profile required by gameplay;
- player XP, level, rank, mastery, class tree/progress/specialization, chapter
  progression, feature gates, and durable learning progression;
- currencies, inventory, stamina commitments, repeat budgets, and pacing claims;
- roster ownership, roster Hero progression, equipment ownership, cards,
  units, summons, and combat-affecting upgrades;
- boss, chapter, milestone, Journey-key/node, Ward Defense, and first-clear
  claims;
- University practice evidence and server-settled activity summaries;
- reward receipts, period markers, idempotency markers, and daily-event claims;
- opening/onboarding flags when they gate server-owned progression;
- the Player Hero record, opportunities, eligibility gates, creation receipt,
  and proficiency state.

Generic player snapshots are not a substitute for dedicated server mutations.
The server must continue to validate authenticated ownership, current state,
claim identity, concurrency, and replay behavior.

### 3.2 Journey runs are separate durable records

Journey runs are not a child snapshot of the player envelope. They remain
separately persisted records in `journey_runs`, addressed by:

- server run UUID;
- `player_id`;
- `chapter_id`;
- `attempt_number`;
- Journey `schema_version`;
- immutable map/run identity such as seed, tile IDs, map layout version,
  blueprint hash, and topology family.

Run status, current tile, immutable encounters, exploration, stamina spent,
key/boss progress, merchant stock, and run claims belong to the run record and
its dedicated server routes. The player envelope may contain references or
chapter-level claim summaries, but must not duplicate run authority.

Journey `schema_version` is a nested subsystem version. It is not the player
envelope's `save_version`.

### 3.3 Activity attempts are separate durable records

Clinical Simulation, Grand Rounds, and Crisis Drill keep full case/action state
in their server attempt collections. The Player document contains only compact
history, best-score, active-attempt, daily-event, and receipt metadata needed
for discovery and resumable entry.

Attempt IDs, activity IDs, case/drill IDs, content versions, action receipts,
completion keys, and grant IDs are durable identity. An engine client may
cache a display summary but may not recreate an attempt or reward from that
summary.

### 3.4 Device-local and non-authoritative state

The following remains device-local or cache-like unless a later contract
explicitly promotes it:

- `clinica.tutorials.v1`, `clinica.tutorials.dismissed.v1`, and
  `clinica.tutorials.active.v1`;
- settings, tips, intro/banner/unlock acknowledgements, and seen/new badge
  sets;
- local loadout preferences, test-session state, compendium presentation
  cache, chain cache, and pending Journey retry queue;
- identity-creation draft data before atomic account confirmation;
- Journey expanded/collapsed display preference;
- client battle AP, action, card, item, clue, turn, and animation state.

These values may be lost, replayed, or divergent across devices without
changing valuable account authority. Tutorial-local state must not be used as a
reward or eligibility proof.

### 3.5 Save, export, and import ownership

- A save/export is a versioned data record, not a session credential.
- Opaque session credentials such as `economy_token` are transport/session
  plumbing and must not be treated as player value or migration authority.
  Exports should omit or redact them.
- An authenticated backend export is authoritative for the fields it owns.
- A local export may preserve offline presentation state and uncommitted local
  UX, but cannot claim that those values were committed to the account.
- Import accepts only known schema versions, performs ordered read-side
  migration, and never grants value as a side effect.
- Importing an old or tokenless local record cannot bind an unverified player ID
  to a backend account.

## 4. Field classification

### 4.1 Player versus roster Hero progression

Player progression is account-wide:

- `xp`, `player_level`, rank, mastery;
- `class_tree_id`, `class_progress`, `class_specialization`;
- chapter/feature progression, University/activity progression, claims, and
  account currencies.

Roster Hero progression is per owned Hero:

- `heroes_owned`;
- `hero_progression[hero_id]` with star, copies, level, XP, lock, and favorite;
- `active_team`, `hero_equipment`, summons, and Hero Skill Academy state.

Migration must preserve the distinction. Missing Hero progression may be
normalized only for an already-owned Hero; migration must never add a Hero to
`heroes_owned` or grant a Hero.

### 4.2 Player Hero

Player Hero is a separate one-time character system. It is not a roster Hero,
Recruitment result, `hero_progression` entry, or Class Tree entry. The
following remain separate and server-owned:

- `player_hero`;
- `player_hero_opportunities`;
- `awakening_beat_complete`;
- creation/proficiency receipts and opportunity/run identity.

No migration may manufacture, duplicate, merge, or infer Player Hero state from
roster Heroes.

### 4.3 Realm

- `realm_layout`, `realm_decor`, and `realm_seed` are portable profile/
  presentation state. They must not change combat power or unlock authority.
- `realm_assignments` and `realm_production` currently mix profile state with
  time-based resource production. Until a server-time, authenticated Realm
  authority contract exists, production and collection are
  non-authoritative and must not mint wallet value through import, refresh, or
  local clock changes.
- The current local production implementation and generic snapshot boundary
  are tracked risks, not changed by this freeze.

### 4.4 Daily Rounds

`daily_rounds` remains a nested subsystem with its own `version` field,
currently version 2. Its dates, objectives, weekly markers, settlement markers,
and receipt IDs must not be mistaken for the top-level player
`save_version`.

Client board state may support presentation and progress reconciliation.
Server receipts, settlement endpoints, monotonic merges, and period markers own
valuable Daily Rounds rewards. Migration must never pay legacy claims locally.

## 5. Stable-ID rules

Migration and engine ports MUST preserve canonical IDs byte-for-byte unless an
explicit, deterministic alias mapping is listed in the migration ledger.

Stable identity includes:

- player UUIDs;
- Hero, skill, item, card, equipment, unit, enemy, building, class, title, and
  activity IDs;
- claim keys, completion keys, receipts, grant IDs, and period/event IDs;
- Journey run UUIDs, chapter IDs, attempt numbers, tile IDs, map versions,
  blueprint hashes, and topology families;
- clinical attempt IDs, case/drill IDs, variant/content versions, and action IDs.

Never derive identity from display names, array order, screen routes, generated
labels, localized text, or renderer-specific paths. When a list is logically a
set, deduplicate by stable ID using a deterministic rule and preserve semantic
ordering where ordering is meaningful.

## 6. Backend refresh and reconciliation

The engine-independent refresh sequence is:

1. Read the local envelope or legacy payload.
2. Parse and migrate it read-side through the ordered ledger.
3. Use the migrated local data only for offline/bootstrap presentation.
4. If a valid signed session exists, fetch the backend snapshot and dedicated
   run/attempt state.
5. Replace authoritative local fields with server-confirmed values.
6. Merge only explicitly documented one-way presentation/onboarding flags; do
   not perform a general client-wins merge over valuable state.
7. Preserve local-only preferences/tutorial state separately.
8. Write the canonical cache representation without issuing rewards or claims.

The current frontend refresh already follows this general shape: it refuses
tokenless backend mutation, normalizes local data, settles legacy Daily state
through a dedicated route, fetches the backend snapshot, and writes the
reconciled cache. The explicit v1/v2/v3 envelope and pure migration functions
are a later implementation stage.

## 7. Forward compatibility and unknown fields

- Known older versions migrate only through ordered, deterministic steps.
- Unknown future `save_version` values must be preserved or quarantined as raw
  data and surfaced as unsupported; they must not be downgraded, partially
  rewritten, or silently discarded.
- Unknown fields in a known version may be retained in an opaque extension
  area, but must not be interpreted as authority or sent through a generic
  valuable-state mutation.
- Malformed or internally contradictory valuable fields must fail closed:
  quarantine the record or require a server refresh rather than inventing
  defaults that could grant value.
- No migration may destructively downgrade a newer record to an older schema.

## 8. Tracked risks intentionally not changed in M0-P3G

This is a freeze, not a runtime repair. The following remain recorded for later
implementation:

- the `clinica:journey:expanded` reset-namespace mismatch;
- the generic Journey `PATCH /journey-runs/{id}/cleared` endpoint being weaker
  than the guarded chapter-boss completion route;
- local-time Realm production and generic Realm snapshot write ownership;
- the current broad `normalizeProgression()` function mixing migration,
  defaulting, freshness, and runtime time reads;
- split device-local tutorial acknowledgements versus account onboarding flags;
- any future need to attest client-simulated battle outcomes.

## 9. Portability rating

**ENGINE LOCK-IN: LOW.**

**Unity migration impact: LOW / ACCEPTABLE.**

The durable authority boundary, stable IDs, separate run/attempt records,
portable rule modules, typed manifests, and server-owned rewards make an engine
port practical. The main migration work is reimplementing presentation,
orchestration, local cache adapters, and client API integration. The tracked
Realm timing, Journey attestation, and client battle risks should be resolved
before they become engine-specific authority.

## 10. Active evidence and implementation owners

The contract is grounded in these current sources:

- `frontend/src/game/types.ts`
- `frontend/src/game/store.tsx`
- `frontend/src/game/playerHero.ts`
- `frontend/src/game/journeyMap/journeyRunRepository.ts`
- `frontend/src/game/journeyMap/journeyRunLifecycle.ts`
- `frontend/src/game/dailyRounds.ts`
- `frontend/src/game/realm.ts` and `realmGrid.ts`
- `frontend/src/game/tutorialStore.tsx`
- `frontend/src/game/activityRegistry.manifest.json`
- `backend/server.py`
- `docs/canonical-gameplay-contract.md`

Existing behavioral evidence includes
`frontend/tests/daily_rounds_v2.test.ts`,
`frontend/tests/journey_run_lifecycle.test.ts`,
`frontend/tests/journey_map_run_identity.test.ts`,
`backend/tests/test_player_api.py`,
`backend/tests/daily_rounds_authority_check.py`,
`backend/tests/test_clinical_simulation_authority.py`,
`backend/tests/test_grand_rounds_authority.py`, and
`backend/tests/test_crisis_drill_authority.py`.

These sources remain executable authority. This document does not replace them
or claim that the future envelope is already implemented.