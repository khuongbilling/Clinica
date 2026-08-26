# Clinica Canonical Backend/API Authority Contract

> **M0-P3H documentation-and-contract freeze.**
>
> This document records the current backend authority boundary for a future
> Replit-to-Godot or Replit-to-Unity migration. It is an audit-backed contract,
> not an implementation change. It does not change backend routes, session
> behavior, gameplay, economy, saves, frontend runtime, dependencies, CI,
> assets, or tests.

## 1. Purpose, precedence, and the engine rule

This contract extends the [canonical gameplay authority
contract](./canonical-gameplay-contract.md) and the [canonical save-schema
contract](./canonical-save-schema-contract.md). The gameplay contract owns the
broader rules/presentation hierarchy; the save contract owns envelope shape,
versions, and migration. This document names the API boundary that turns
eligible progress into durable state.

When the client, cache, or server disagree, use this precedence:

1. A **dedicated authenticated server route** plus its server-issued record,
   receipt, attempt, claim, or conditional mutation is durable authority.
2. The server's current player, Journey-run, or activity-attempt state defines
   cross-device value and reconciliation.
3. Portable game rules and versioned manifests define deterministic content and
   validation inputs, but do not grant value alone.
4. Client reducers, screen state, local cache, queued retries, and preferences
   are presentation/offline support only.

> **Godot/Unity rule:** only dedicated server routes and server-issued
> receipts/records are durable value authority. A Godot or Unity reducer,
> local save, scene outcome, client-generated claim key, or cached completion
> must never be promoted into a currency, reward, inventory, progression, or
> cross-device authority source.

`ENGINE LOCK-IN: LOW.` The transport, record ownership, stable identifiers,
manifest versions, and replay rules are engine-neutral. Expo/React Native is
one client implementation; a Godot or Unity client must preserve these
contracts rather than reproduce their authority in engine code.

## 2. Current API boundary and credentials

The current API is mounted beneath `/api`. Its route names are a current
compatibility surface, not an engine protocol specification. No `/vN` path
prefix exists today; backward compatibility is carried by documented request
shapes, stable IDs, per-manifest versions, save/schema versions, read-side
normalization, and explicit retirement responses.

### 2.1 Player signed-session boundary

- Player writes and protected reads use `X-Clinica-Session`; some compatibility
  wrappers also send the same signed token as `X-Clinica-Economy-Token`.
- Guest sessions are stateless HMAC-signed payloads bound to exactly one player
  ID. The legacy economy credential is accepted only by the explicit
  one-time `/player/{player_id}/session/migrate` path.
- A tokenless pre-session local save remains local-only. It must not gain
  backend access merely by presenting an old player ID.
- Expected player boundary errors are `401` for missing/invalid credentials,
  `404` for an absent player/record, and `403` where an authenticated player
  lacks access to a server-gated chapter or feature.

**Current gap, preserved for migration:** a signed guest session contains an
issuance timestamp but no expiry, per-session revocation record, or server-side
revocation check. A replacement service must add expiry and revocation as a
deliberate compatibility/security change; it must not incorrectly claim that
the present implementation already provides them.

### 2.2 Faculty and curriculum-administrator boundary

Grand Rounds authoring is a distinct privileged surface:

- Faculty authoring routes require `X-Clinica-Faculty-Key`.
- Curriculum credential issuance, rotation, revocation, and inspection require
  `X-Clinica-Curriculum-Admin-Key`.
- The faculty key resolves through either configured role credentials or a
  revocable server-side credential registry. Generated credentials are stored
  as keyed digests, and the one-time raw credential is returned only at
  issuance/rotation.
- Faculty draft, review, approval, publication, and retirement records have
  stable draft/case IDs, manifest versions, revisions, roles, and audit
  metadata. A player session is never faculty authorization.

`401` means an invalid or absent privileged credential; `503` can mean the
curriculum-administration registry is not configured. Role/transition conflicts
use the usual validation/conflict semantics below.

## 3. Generic player snapshots are not value mutations

`PUT /player/{player_id}` is an authenticated compatibility/reconciliation
route, not an economy or progression command. It removes protected fields
before persistence. In particular, snapshots cannot authoritatively set:

- stamina, refill/bonus/repeat-budget state, reward-unit counters, XP, player
  level, mastery, or hero progression;
- currencies, inventory, roster ownership, cards, equipment, skins, units,
  summon history, combat upgrades, or wellness value;
- University counters/milestones, bosses, chapter progress, Journey keys/nodes,
  level/chapter reward claims, or Ward Defense records/rewards/Aegis state;
- Player Hero values, creation receipts, opportunity state, opening/prologue
  gates, identity/class progression, or specialization;
- legacy Daily V1 data. Daily Rounds V2 receives the limited merge/CAS path
  described below, not a raw overwrite.

The route writes allowed profile/presentation-compatible fields and stamps the
server update time. Its Daily Rounds V2 merge compares the current server value
and retries a bounded compare-and-set operation; concurrent mismatches return
`409` with a retry instruction.

**Current gap, preserved for migration:** this generic `PUT` still accepts
residual writable player fields. A future protocol must define an allowlist of
each permitted field, ownership, validation, and merge behavior before exposing
it to a new engine. Do not expand it while porting or assume that an
authenticated whole-player snapshot is safe.

## 4. Dedicated authoritative mutations

The table below records the routes that presently own valuable transitions.
Client wrappers in `frontend/src/api/client.ts` call these routes; wrapper
existence does not make the client authoritative.

| Domain | Dedicated durable boundary | Server-owned proof and outcome |
|---|---|---|
| Player creation/session migration | `POST /player`, `POST /player/{id}/session/migrate` | Creates the player and issues/migrates the signed session; migration is explicit, not inferred from an ID. |
| Stamina and Age 1 economy | `POST /player/{id}/economy` | Current server stamina, regeneration/pacing state, refill caps, repeat budget, and source/period limits determine commitments and grants. |
| Legacy Daily settlement | `POST /player/{id}/daily-rounds/legacy-settlement` | Server validates the persisted legacy record/state and produces an immutable one-time settlement/entitlement boundary. |
| University practice | `POST /player/{id}/university-practice/attempts`, `/complete` | Approved challenge ID, activity, difficulty, and version issue a one-use attempt. Completion consumes it and derives rewards, milestones, mastery, and taper from server state. |
| Activity recovery receipt | `POST /player/{id}/activity-completions` | A registered completion source must already prove completion. The server records a duplicate-safe receipt usable for Daily/registry reconciliation. |
| Clinical Simulation | `POST/GET /player/{id}/clinical-simulations/...` | Reviewed manifest, selected variation/seed, legal action sequence, attempt state, first-clear claim, debrief, and reward receipt are server-owned. |
| Grand Rounds | `POST/GET /player/{id}/grand-rounds/...` | Reviewed private manifest, one active attempt, legal responses/stages, pause/resume/abandon lifecycle, completion claim, first-clear receipt, and server-derived debrief/reward are server-owned. |
| Crisis Drill | `POST/GET /player/{id}/crisis-drills/...` | Server-issued attempt, private case projection, action order, time/lifecycle state, completion receipt, and derived grant are server-owned. |
| Ward Defense | `POST /player/{id}/ward-defense/start`, `/complete`, `/exchange`, `/assemble-aegis`, `/aegis-sidegrade` | Server-issued run/scenario, minimum duration, daily and weekly ceilings, run claim status, rotations, exchanges, inventory consumption, and Aegis protections control value. |
| Journey area/chapter/world boss and merchant | `POST /player/{id}/journey-runs/{run}/area-boss-completion`, `/chapter-boss-completion`, `/merchant-purchase`, and the Verdantha completion route | Persisted run identity, active status, position/tile, key/commitment state, stock, player balance, and first-clear markers gate server-derived results. |
| Player Hero | `GET /player/{id}/player-hero/eligibility`, `POST /create`, `POST /proficiency` | Server validates gating, exactly-once creation, generated values/receipt, and verified Journey evidence for proficiency. |
| Class material claims | `POST /player/{id}/select-class`, `/class-tiers`, `/claim-specialization` | Server validates stable IDs, prerequisites, material quantities, and one-time/immutable claim boundaries. |

### 4.1 Journey persistence is split by concern

`journey_runs` are separately persisted from the player document. The server
freezes a submitted run's identity, immutable tile set, encounter placement,
gate, movement adjacency, explored evidence, area-boss key transition, chapter
boss transition, and merchant inventory/purchase. A unique compound index on
`(player_id, chapter_id, attempt_number)` turns concurrent creation into a
replay of the existing run rather than a duplicate run.

The client repository's in-flight request map reduces double taps, but the
database uniqueness constraint is the durable guarantee. Journey run
`schema_version`, `id`, `player_id`, `chapter_id`, `attempt_number`, seed,
tile IDs, manifest/hash identifiers, and claim keys are stable migration data.

**Current gaps, preserved for migration:**

- Run creation still accepts client-supplied seed/topology inputs before the
  server freezes and derives reward-bearing portions. It lacks complete
  server-generated topology/encounter attestation.
- `PATCH /journey-runs/{run_id}/cleared` is a generic, weak status transition
  compared with boss-completion routes and can affect Player Hero proficiency
  evidence. A new service must not use this as the authority for a valuable
  clear.
- Treasure resolution can be persisted on a server run, but there is no
  dedicated server treasure-payout route. The retired generic reward endpoint
  is not a substitute.
- Some Journey settlement crosses player and run documents without a fully
  transactional multi-document boundary. Current idempotent markers reduce
  replay risk, but a durable replacement should make the complete settlement
  atomic or provide a resumable outbox/receipt protocol.

### 4.2 Ward Defense has bounded grants, not full combat attestation

Ward Defense correctly issues the run/server scenario, rejects early claims,
marks a run claimed, bounds inputs, applies server-derived base rewards, and
uses daily/weekly and inventory predicates. It also returns an idempotent
already-claimed result.

The board simulation and performance fields remain client-submitted. The server
clamps reported stability, score, clinical totals/correctness, and overtime, but
does not replay the full combat. This is a deliberately recorded gap: a future
authoritative service needs signed action/event telemetry or server simulation
before it can claim full combat attestation.

### 4.3 Daily Rounds, Realm, and normal client economy

Legacy Daily settlement is server-owned. Daily Rounds V2 board state may merge
through the guarded generic update path, but V2 does **not** have a dedicated
server claim/reward endpoint that derives all valuable rewards from
server-owned receipts. Local V2 reducers cannot be treated as reward authority.

Realm layout/decor are portable presentation/profile state. Realm production
and collection currently use local elapsed time and generic persistence; they
are not server-time authority. Similarly, normal shop, equipment, recruitment,
hero-training, and several inventory/progression reducers currently lack
dedicated server transactions. Catalogs, local cost checks, UI locks, and local
currency decrements remain non-authoritative until a dedicated server mutation
exists.

## 5. Receipts, idempotency, concurrency, and replay

The current server uses several complementary safeguards. They are migration
requirements, not permission to assume every domain has every safeguard.

| Safeguard | Current use |
|---|---|
| Session/player binding | Every dedicated player mutation validates the signed session against the addressed player. |
| Server-issued attempt/run ID | University, Clinical Simulation, Grand Rounds, Crisis Drill, Ward Defense, and Journey store opaque durable identities before valuable completion. |
| State transition predicate | Attempt/run status such as `issued → processing → claimed`, `active → completed`, or `active → claimed` is checked in the write query. |
| Compare-and-set (CAS) | Player `updated_at`, current Daily V2 state, active attempt reservations, and expected revision/state predicates reject stale concurrent mutations. |
| Unique index | Journey `(player_id, chapter_id, attempt_number)` prevents duplicate concurrent runs. Stable server IDs prevent cross-player reuse. |
| Claim key / first-clear marker | First-clear maps, claimed-run IDs, tile IDs, boss markers, and activity IDs prevent duplicate valuable claims. |
| Idempotent replay response | Replayed completions commonly return the canonical current player/run/receipt with `already_*` information instead of granting again. |
| Bounded period counters | Daily/weekly reward units, Ward Defense claim ceilings, rotation records, and Aegis pity/fragment limits are computed from server state. |
| Receipt ownership/recovery | Completion owner/claim token plus persisted completion data lets retries reconstruct a canonical outcome after interrupted completion. |

Porting rules:

- Preserve the original attempt/run/receipt/claim ID on retry. Do not create a
  new valuable identity because a request timed out.
- Treat `409` as a state conflict that requires refetch/reconcile/retry with the
  same idempotency identity where the route permits it.
- Never retry a claimed reward by locally applying the advertised result.
- A server acknowledgement is the commit point. A local animation or a
  client-side success screen is not.
- Add a transaction or durable reconciliation protocol whenever a future route
  mutates multiple durable records; do not silently rely on client ordering.

## 6. Error semantics and compatibility behavior

The current API uses the following meanings consistently enough to preserve in a
ported contract:

| Status | Meaning at this boundary |
|---:|---|
| `401` | Missing or invalid credential; a faculty-registry credential may also be revoked. Player guest sessions currently have no individual revocation check. |
| `403` | Authenticated player lacks an unlocked chapter/feature/role permission. |
| `404` | Player, attempt, run, or resource identity is absent. |
| `409` | State changed, duplicate/consumed claim, active-attempt conflict, timing/gate failure, exhausted limit, or retry-required concurrency conflict. Refetch before acting. |
| `410` | A retired generic reward/attempt route. Call the domain-owned route instead; do not downgrade to a local fallback. |
| `422` | Malformed, unknown, mismatched-version, illegal, or impossible requested content/action. |
| `503` | Privileged curriculum administration is not configured. |

Backward-compatibility requirements:

- Keep stable player, Journey, attempt, receipt, activity, manifest, case,
  challenge, stock, tile, chapter, item, class, and claim identifiers.
- Carry schema/manifest/challenge/case versions in records and requests where
  they already exist. New engines must parse known historical versions and
  reject unsupported future versions without fabricating a reward.
- Preserve read-side normalization for legacy Journey runs and save envelopes.
  Migration must be deterministic, idempotent, stable-ID preserving, and
  non-rewarding, as required by the save-schema migration ledger.
- Keep retired endpoints explicitly retired (`410`) until a versioned
  replacement/migration window is documented. Never reactivate generic
  client-supplied reward or attempt endpoints as a shortcut.

## 7. Client cache and reconciliation contract

`frontend/src/game/store.tsx` provides local bootstrap, optimistic
presentation, and recovery—not durable value authority:

- `clinica.player.v2` is a local cache namespace, not a serialized schema
  version or account authority.
- Tokenless local saves never issue/derive a signed session from an unverified
  player ID.
- On a valid session, refresh may migrate the legacy credential, settle legacy
  Daily evidence, fetch the authenticated server snapshot, normalize it, and
  cache it locally.
- Server snapshots replace cross-device value. The client may preserve only
  documented monotonic/local onboarding compatibility fields and only write
  through allowed APIs.
- Journey local creation dedupe, offline UI, pending queues, tutorial state,
  Daily V2 board reducers, Realm collection, shop/equipment/recruitment/training
  reducers, and battle outcomes are not evidence of a durable grant.

Local reset currently clears client storage and returns the app to entry flow.
It does not by itself delete the remote player record. `DELETE /player/{id}` is
an authenticated backend route, but the local reset path does not invoke it.
Migration/product work must make this distinction explicit and must not promise
remote-account deletion from a device-only reset.

## 8. Explicitly retired or non-authoritative paths

These paths must not be revived as alternate reward authority:

- `POST /player/{id}/activity-attempts/{activity}` returns `410`: generic
  client-created attempts are retired.
- `POST /player/{id}/activity-attempts/{attempt_id}/claim` returns `410`:
  generic attempt claims are retired.
- `POST /player/{id}/rewards/{activity}` returns `410`: a client claim key is
  not proof of a completed activity.
- The old area-boss-key claim route is retired/non-authoritative; the
  Journey-run area-boss completion route owns that transition.
- Generic local reward helpers, presentation-only catalog prices, client
  simulation output, and AsyncStorage snapshots are never fallback authority
  for a server refusal or outage.

Legacy code may remain as compatibility evidence. This contract neither removes
it nor upgrades it into a durable API.

## 9. Migration risks and implementation backlog

The following are audit findings, deliberately recorded without runtime fixes:

1. Signed guest sessions have no expiry or individual revocation mechanism.
2. Generic player `PUT` retains residual writable fields and needs an explicit
   future allowlist/field-ownership contract.
3. Journey creation accepts client-supplied run inputs and lacks full server
   topology/encounter attestation.
4. Generic Journey `cleared` status mutation is weaker than dedicated boss
   completion and can influence Player Hero proficiency evidence.
5. No dedicated server Journey treasure-payout route exists.
6. Journey reward operations can cross multiple documents without complete
   atomic settlement.
7. Daily Rounds V2 has no dedicated server claim/reward authority route.
8. Realm production relies on local time and generic persistence.
9. Normal shop, equipment, recruitment, and hero-training flows lack dedicated
   server transactions.
10. Ward Defense accepts bounded client-submitted outcome metrics.
11. Ward Defense does not yet have full combat/action attestation.
12. Local account reset does not mean remote account deletion.
13. Authority tests do not comprehensively cover session expiry/revocation,
    Journey settlement/treasure and generic-clear abuse, Ward Defense API
    completion/attestation, Realm, normal shops, Player Hero lifecycle, and
    generic-save race coverage.

These risks are a migration checklist, not an authorization to change current
behavior in M0-P3H. Each fix must be introduced later through a versioned,
tested compatibility plan with explicit data and replay migration.

## 10. Portability guidance and evidence

For Godot or Unity:

- Implement an engine-neutral API client that sends the existing session and
  privileged headers only to their respective routes; never embed faculty or
  admin secrets in a player build.
- Model player, Journey run, activity attempt, completion receipt, claim, and
  content manifest as durable data records with stable IDs and versions.
- Keep deterministic game formulas, map identity, authored case data, and
  UI-independent validation portable. Keep rendering, scene flow, animations,
  and local preferences engine-specific.
- Implement an explicit reconcile loop: fetch server state after successful
  value mutations, retain an idempotency identity for retry, and replace local
  value state with the canonical server response.
- Make unreconciled/offline outcomes visibly pending rather than treating them
  as granted. A future offline authority design requires server-verifiable
  signed receipts or a distinct reconciliation protocol.
- Preserve `401/403/404/409/410/422/503` semantics or map them deliberately in
  a documented API version; never turn a `410`/`409` into a client-side payout.

Current executable evidence for this contract includes:

- `backend/tests/test_player_api.py`
- `backend/tests/test_iteration3_fields.py`
- `backend/tests/test_iteration6_clinical_fields.py`
- `backend/tests/daily_rounds_authority_check.py`
- `backend/tests/activity_registry_authority_check.py`
- `backend/tests/test_legacy_university_practice_authority.py`
- `backend/tests/test_clinical_simulation_authority.py`
- `backend/tests/test_clinical_simulation_variations.py`
- `backend/tests/test_grand_rounds_authority.py`
- `backend/tests/test_crisis_drill_authority.py`
- frontend Journey lifecycle/identity and Daily Rounds replay tests referenced
  by the canonical gameplay contract.

Tests are evidence of current behavior, not proof that the identified gaps are
closed. When a client presentation test conflicts with a protected server
mutation, receipt, or rejection, the authenticated server contract wins.