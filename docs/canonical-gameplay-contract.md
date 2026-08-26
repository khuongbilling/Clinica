# Clinica Canonical Gameplay Authority Contract

> **M0-P3F documentation freeze.**
>
> This document records the authority boundaries observed on the current local
> HEAD. It is a contract and migration reference, not a new implementation.
> It does not change gameplay values, progression, gating, rewards, persistence,
> backend behavior, or tests.

## 1. Purpose and precedence

Clinica has a layered architecture. A layer may provide portable rules or
presentation without owning durable authority. When sources disagree, use this
precedence:

1. **Server-owned state and dedicated server completion/claim contracts** own
   durable progression, valuable economy, reward claims, attempts, receipts,
   and cross-device state.
2. **Portable game modules and typed manifests** own deterministic rules and
   content data that can be shared by clients or ported to another engine.
3. **Screens, components, route orchestration, and visual layers** present and
   collect input; they do not establish durable authority.
4. **Local cache, tutorial state, and preferences** support offline/bootstrap or
   presentation behavior only. They must not be treated as server-owned value.
5. **Historical documents, generated reports, legacy factories, and stale
   compatibility paths** are evidence or migration material only. They must not
   override active modules, contracts, manifests, validators, or tests.

`replit.md` is the project-level pointer to this contract. The
[`canonical-backend-api-authority-contract.md`](./canonical-backend-api-authority-contract.md)
defines the dedicated route, receipt, credential, replay, and migration boundary
for durable server value.

Portable migration vectors and their SHA-256 validation profile live in
[`fixtures/clinica-golden/v1/`](../fixtures/clinica-golden/v1/). They preserve
deterministic rules and stable identifiers for engine ports; they do not replace
the executable gameplay, server-authority, or concurrency suites.

`archive/historical-product/PRD.md` is historical and non-authoritative.
`docs/freeze-journey-combat-v1.md`, `docs/battle-audit.md`, and
`docs/tutorial-audit.md` are useful freeze/audit references, but executable
current modules and tests win where their wording is stale.

## 2. Durable authority versus portable rules

### 2.1 Server-owned durable authority

`backend/server.py` and the MongoDB player/run collections own:

- authenticated player identity and session-bound writes;
- account XP/level and protected progression fields;
- valuable currencies, inventory, equipment ownership, and reward grants;
- activity attempts, action/answer submissions, completion receipts, and
  period markers;
- stamina commitments and valuable completion boundaries;
- Journey run persistence, server checks, boss completion, and key claims;
- Daily Rounds settlement and legacy conversion;
- University practice, Clinical Simulation, Grand Rounds, Crisis Drill, and
  Ward Defense completion contracts;
- Player Hero eligibility, creation receipts, and server-issued values.

The generic player update route intentionally strips protected fields. A client
snapshot, optimistic local mutation, or arbitrary reward payload is never a
replacement for a dedicated server-owned mutation.

### 2.2 Portable rules and data

The following frontend modules are portable rule/data authorities, not
necessarily durable state authorities:

- `frontend/src/game/progression.ts` — XP curves, feature definitions, gate
  evaluation, hero XP distribution, and class milestone calculations;
- `frontend/src/game/content.ts` — battle content definitions;
- `frontend/src/game/clinical.ts` — clinical evaluation and battle AP rules;
- `frontend/src/game/skillCalc.ts` — combat effect calculation and ordering;
- `frontend/src/game/battle.ts` — client battle state machine and action
  resolution;
- `frontend/src/game/items.ts`, `cards.ts`, and `equipment.ts` — item/card/
  equipment catalog and portable effect data;
- `frontend/src/game/stamina.ts` — client-side persistent-stamina rules;
- `frontend/src/game/journeyMap/` — Journey geometry, encounter, shift, fog,
  lifecycle, and client validation contracts;
- `frontend/src/game/realm.ts` and `realmGrid.ts` — Realm layout/building and
  production rule data;
- `frontend/src/game/dailyRounds.ts` — Daily Rounds vocabulary and client
  state/reward logic, subject to server reward authority;
- `frontend/src/game/playerHero.ts` — Player Hero schema and portable stage/
  artifact contract;
- `frontend/src/game/activityRegistry.manifest.json` — activity IDs, routes,
  feature associations, and completion-kind metadata. It does not grant value.

Portable rules must remain deterministic, use stable IDs, and avoid depending
on a particular renderer, device clock, local storage implementation, or UI
component when they describe game authority.

### 2.3 Presentation and controller boundaries

`frontend/app/`, screen components, panels, banners, `HexMapLayer`, fog art,
battle animation, route parameters, and explanatory copy are presentation or
controller layers. They may call canonical rules and server APIs, but:

- route visibility is not authorization;
- a disabled button is not a server gate;
- a displayed reward is not a granted reward;
- a rendered encounter is not proof that a reward claim is valid;
- a UI preference is not progression;
- a client battle result is not by itself durable economy.

### 2.4 Local-only state

The following are intentionally local or cache-like and non-authoritative:

- `frontend/src/game/store.tsx` AsyncStorage cache at
  `clinica.player.v2`, including offline bootstrap, migration, and backfill;
- tokenless pre-session saves;
- `frontend/src/game/tutorialStore.tsx` tutorial keys and active overlay state;
- `frontend/src/game/testSession.tsx` local test-session state;
- tutorial/seen state in daily panels;
- `frontend/src/features/journey/ui/journeyExpandedPreference.ts` display
  preference;
- pending Journey boss-key retry queue state;
- current Realm production/assignment state until a server contract confirms
  collection;
- client battle AP, action, card, item, clue, and turn state.

Local state may be used optimistically, but server-confirmed state must replace
it at refresh or reconciliation boundaries.

## 3. Frozen gameplay authority contracts

### 3.1 Player/account progression versus hero progression

`frontend/src/game/progression.ts` separates the two levels:

- **Player Level** is account-wide and derives from player XP. It controls
  feature gates, account progression, and class milestone unlocks.
- **Hero Level** belongs to an individual roster hero in `hero_progression`.
  Battle contribution and Training Hall progression write this same conceptual
  hero progression, subject to star/certification and account caps.
- `frontend/src/game/heroSkillAcademy.ts` contains portable upgrade data and
  validation; valuable upgrade purchases must use the server-owned mutation
  path.
- **Player Hero** is a separate progression/product. It is stored as
  `player_hero`, is not an ordinary roster hero, and must not be added to
  `heroes_owned` or `hero_progression`. Its server contract owns eligibility,
  creation, receipts, and server-generated values.

### 3.2 Feature gating

The current feature ladder in `progression.ts` is frozen at these values:

| Feature | Current account-level gate |
|---|---:|
| University / Ward Shift | 1 |
| Lotus Journal / Summoning Hall / Daily & Weekly Rounds | 2 |
| Shop / Community Board | 3 |
| Ward Defense | 4 |
| Realm | 5 |
| World Event | 7 |
| Boss | 9 |
| Ten-pull | 12 |
| Advanced Traits | 15 |
| Advanced Sims | 25 |

Additional current invariants:

- Ward Shift also requires `lessonsStarted`.
- Realm requires the first Ward Shift.
- Gate context combines persisted account progression with the relevant
  `runs_completed` and `lessons_completed` milestones.
- Player Hero server access requires the current level-30 and opening/
  identity/prologue/calling/class/specialization/awakening conditions in
  `backend/server.py`.
- Frontend gate evaluation supplies presentation and actionable explanations;
  dedicated server endpoints must re-check their own access and attempt state.

### 3.3 Opening, onboarding, and tutorials

- Opening identity/prologue state is durable player state represented by the
  backend/player fields such as `identity_restored`,
  `diagnostic_intro_seen`, `opening_prologue_complete`, opening phase, and
  prologue reward claim.
- `frontend/src/game/tutorials.ts` is the tutorial catalog.
- `frontend/src/game/tutorialStore.tsx` is a local tutorial state machine, not
  a server economy or account-progression authority.
- Tutorial invariants are one active loop, hydration before replay, completed/
  dismissed guards, rapid-tap deduplication, exact target/action matching,
  forced-clear cleanup, and reset removal of tutorial keys.
- `docs/tutorial-audit.md` records the intended sequence and known gaps; it
  does not override the opening state machine or backend fields.

### 3.4 Battle, clinical reasoning, and action economy

`frontend/src/game/battle.ts` owns the client battle state machine, action
dispatch, turn resolution, and victory flow. `frontend/app/battle.tsx` is the
screen/orchestrator. Portable content and formulas come from `content.ts`,
`clinical.ts`, and `skillCalc.ts`.

Clinical evaluation currently follows this precedence:

1. required clues;
2. unsafe revealed clue;
3. unsafe enemy tags;
4. inappropriate;
5. strong;
6. allowed, including low-stability conditions;
7. appropriate system fit;
8. weak fallback.

Current battle economy contracts:

- Battle AP is separate from persistent stamina.
- `clinical.ts:getTurnAP` uses the current stability bands of
  `3/5/8/9/10`, applies the existing chapter/corruption and high-stability
  modifiers, and clamps the result to `3..10`.
- `battle.ts` owns AP spending, action costs, single-hero-per-turn behavior,
  cards, items, and end-turn resolution.
- `skillCalc.ts` owns Strike, Stabilize, and Shield calculation ordering and
  rounding. Its results must not be reimplemented in a screen.
- Clinical cues and answers are currently client-side battle state.
- The server validates valuable completion boundaries, not every ordinary
  client-simulated action, AP spend, clue answer, or damage calculation.

Persistent shift/Journey stamina is separate:

- the portable stamina rule is `frontend/src/game/stamina.ts`;
- regeneration is lazy and uses the existing 15-minute timing contract;
- current costs are regular 1, elite 2, area boss 3, and chapter/world boss 5;
- server economy mutation and commitment records own valuable consumption and
  reward eligibility.

### 3.5 Journey maps, chapters, encounters, bosses, and fog

Canonical Journey ownership is split by concern:

- `journeyRunLifecycle.ts` builds and reloads runs;
- `chapterMapTemplates.ts` and the canonical map artifact/stage modules own
  approved geometry and structure;
- `chapterShiftRules.ts` owns offered/resolved shifts, never device clock;
- `encounters.ts` owns seeded weighted ordinary encounter assignment;
- `fogCalculator.ts` owns portable visibility and reveal behavior;
- `validate.ts` owns client movement/gate checks;
- `encounterResolution.ts` owns pure client result transitions;
- `journeyRunRepository.ts` plus backend `journey_runs` own persistence and
  server reconciliation;
- `HexMapLayer` and fog assets are presentation.

Frozen lifecycle invariants:

- Active or cleared runs are reused; loading a run must not silently reroll.
- A cleared chapter is the prerequisite for `challengeChapter`.
- Rechallenge abandons the prior active run before creating its successor.
- Terrain geometry, coordinates, start, gate, and structural identity are
  stable; the run seed randomizes eligible content, not approved terrain.
- The boss gate is not an ordinary encounter roll. A valid run may have zero
  area bosses.
- Chapter boss completion requires the persisted active run, gate adjacency,
  exactly 3 chapter keys, and the existing 5-stamina commitment.
- Area boss completion requires the authenticated existing 3-stamina
  commitment, current area-boss tile, and atomic key/resolution guards.
- Client `battleResultApplied` protection prevents double application while
  returning from battle through the result screen.
- `chapterBossKeys` and server claim predicates prevent duplicate key/reward
  application.

The backend is strongest at persisted run ownership and boss/reward completion.
The client remains the portable geometry/fog/action presentation path. The
server must not be replaced by route-level UI or a legacy run factory.

### 3.6 Realm

- `frontend/src/game/realm.ts` owns portable building, layout, unlock, and
  production definitions; `realmGrid.ts` owns placement geometry.
- Atrium is the Realm foundation and the current default/backfill contract
  keeps Atrium at level 3 where required so existing players do not silently
  lose Realm navigation.
- Realm is a sanctuary/build/heal/research base, not an attack, raid, or
  defense mode.
- Realm production currently accrues and collects locally through store state
  and timestamps. It is not equivalent to server-confirmed valuable economy.
- Currency names, descriptions, prices, and planned marketplace content in
  `economy.ts` are display/design anchors. They are not purchase authority.

### 3.7 Daily Rounds and Daily Check-In compatibility

- `frontend/src/game/dailyRounds.ts` owns portable Daily Rounds vocabulary,
  objective definitions, and client state helpers.
- Backend daily merge, legacy settlement, state-hash checks, period markers,
  and verified completion receipts own durable reward authority.
- Daily Rounds V2 is the current active recurring contract and is intentionally
  stamina-oriented on the server.
- Older client currency/XP reward tables and local reward application remain
  compatibility/legacy paths; they must not independently grant valuable state.
- There is no separate current Daily Check-In authority identified beyond
  compatibility terminology and regression tests. Treat Daily Check-In tests
  as legacy compatibility evidence and route valuable claims through the
  server-owned Daily Rounds/economy contract.

### 3.8 University, Clinical Simulation, Grand Rounds, Crisis Drill, Ward Defense,
and Player Hero

The screens and frontend game modules provide portable content and controllers.
The following server contracts own attempts, validation, and valuable results:

| System | Durable authority |
|---|---|
| University practice | Approved challenge/activity/version, one-use receipt, server-derived reward and mastery |
| Clinical Simulation | Server-owned reviewed case/attempt/action/completion manifest and replay rules |
| Grand Rounds | Reviewed manifest, private answer/effect fields, faculty/role credentials, completion receipt |
| Crisis Drill | Server-owned attempt clock, timeout, private projection, and completion |
| Ward Defense | Server-issued run, completion, claimed-run IDs, reward, exchange, and Aegis state |
| Player Hero | Server eligibility, server-generated creation receipt/values, and proficiency contract |

`frontend/src/game/playerHero.ts` is the portable schema; Player Hero remains
separate from roster recruitment. Prologue loaner heroes are intentionally
nonpersistent and must not become owned roster progression.

### 3.9 Inventory, equipment, items, shops, and rewards

- `items.ts`, `cards.ts`, and `equipment.ts` provide portable catalog data and
  effect descriptions.
- Inventory and owned-equipment fields are durable server-owned player state.
- Client battle consumption is simulation/optimistic state until a trusted
  completion path confirms the durable result.
- Dedicated server exchanges, Ward/Aegis flows, Journey merchant flows, and
  activity completion routes own valuable purchases and rewards.
- `economy.ts` is not a payment, shop, or anti-cheat boundary.
- Catalog entries marked `future` remain unavailable unless an active server/
  gameplay contract says otherwise.

### 3.10 Valuable economy and reward claims

Server authority covers:

- currencies and inventory;
- stamina commitments and consumption;
- first-clear and repeat reward policy;
- activity receipts and period markers;
- Journey boss/key claims;
- Ward Defense and Aegis exchanges;
- Player Hero creation/proficiency;
- Daily settlement and verified activity recovery.

The server-side guard pattern is conditional/authenticated mutation using
current server state, attempt or claim identity, status predicates, `updated_at`
or equivalent concurrency checks, and idempotent replay behavior. Generic
client-provided XP, currency, inventory, mastery, hero, equipment, claim, or
reward values must not become authoritative merely because they appear in a
payload.

### 3.11 Save and persistence ownership

- Signed-session backend snapshots are the cross-device source of truth for
  durable player state.
- `clinica.player.v2` is a local cache/offline bootstrap and migration layer.
- Tokenless pre-session saves remain local-only; they must not mint backend
  authority from an unverified player ID.
- Refresh normalizes local data, reconciles permitted onboarding/objective
  state, fetches the backend snapshot, and writes back only through allowed
  server paths.
- Journey runs use repository/reload semantics and backend `journey_runs`;
  local in-flight deduplication is not a substitute for server uniqueness.
- Tutorial and preference state may remain local because it is not valuable
  progression.

## 4. Current anti-duplication and exploit invariants

These invariants are frozen observations, not new implementation requirements
to be solved in this push:

- Generic player updates cannot overwrite server-owned XP, level, heroes,
  hero progression, currencies, inventory, equipment, cards, codex, milestones,
  University counters, bosses, Journey claims, or related valuable fields.
- Dedicated activity attempts use server-owned manifests, session checks,
  one-use status transitions, receipts, and replay-safe completion.
- Economy mutations use current server state and optimistic concurrency rather
  than trusting a stale client snapshot.
- Player Hero creation is conditionally atomic and returns the existing result
  on replay instead of issuing a second hero.
- Journey run creation is protected by attempt identity/uniqueness and client
  in-flight deduplication; active/cleared reuse prevents rerolls.
- Journey area/chapter boss transitions use persisted run state, adjacency,
  stamina commitments, key counts, and atomic first-clear/resolution predicates.
- Daily settlement and period markers prevent repeat claims and support safe
  legacy conversion.
- Tutorial state prevents multiple active loops and duplicate required-action
  progression, but tutorial-local guards do not protect valuable economy.
- Local Realm production, client battle simulation, local daily reward helpers,
  and local snapshot writes are not sufficient anti-cheat boundaries.

## 5. Explicitly non-canonical parallel or stale systems

The following must not be promoted to authority without a deliberate migration:

- `frontend/src/game/store.tsx` local snapshots, migrations, and captured
  closures for server-owned values;
- `frontend/src/game/testSession.tsx`;
- `frontend/app/battle.tsx` legacy battle/tutorial fallbacks;
- `frontend/src/game/journeyMap/createRun.ts` legacy run factory, rather than
  `journeyRunLifecycle.ts`/repository;
- local Journey expanded preference and panel seen/tutorial keys;
- local pending boss-key retry state;
- client-local daily currency/XP reward application and old Daily Check-In
  compatibility paths;
- local Realm timestamp production/collection;
- `docs/battle-audit.md`, `docs/tutorial-audit.md`, and the older Journey freeze
  prose when it conflicts with executable current code;
- `frontend/src/game/clinical.ts` legacy affinity/system terminology and
  `getAffinityModifier` paths when they conflict with the active
  `skillCalc.ts` affinity-family calculation;
- `equipment.ts` comments/catalog claims that conflict with active battle
  aggregation; `future` entries still require an active contract;
- `frontend/src/game/economy.ts` display-only prices, caps, and planned bundles;
- historical documents under `archive/`, including the archived PRD;
- generated balance simulations that intentionally do not model all runtime
  caps or selection constraints.

These systems may remain for compatibility, offline UX, or migration evidence.
This freeze does not remove, rewrite, or silently promote them.

## 6. Golden-master behavioral evidence

The strongest existing executable evidence is:

### Progression, gates, and route contracts

- `frontend/tests/feature_unlocks.test.ts`
- `frontend/tests/gate_evaluation.test.ts`
- `frontend/tests/realm_routes.test.ts`
- `frontend/tests/chapter_completion.test.ts`
- `frontend/tests/chapter_completion_badge.test.ts`
- `frontend/tests/chapter_completion_render.test.ts`
- `frontend/tests/qa_guided_progression.test.ts`

### Journey and map identity

- `frontend/tests/journey_run_lifecycle.test.ts`
- `frontend/tests/journey_map_run_identity.test.ts`
- `frontend/tests/journey_map_templates.test.ts`
- `frontend/tests/journey_map_canonical_artifact.test.ts`
- `frontend/tests/journey_map_stage_contract.test.ts`
- `frontend/tests/journey_map_encounters.test.ts`
- `frontend/tests/journey_map_topology.test.ts`
- `frontend/tests/journey_map_hex_layout.test.ts`
- `frontend/tests/journey_map_shift_composition.test.ts`
- `frontend/tests/fog_calculator.test.ts`
- `frontend/tests/chapter_boss_keys.test.ts`
- `frontend/tests/fog_map_chapter_boss_rewards.test.ts`
- `frontend/tests/encounters.test.ts`

### Battle and clinical behavior

- `frontend/tests/v1_verification.test.ts`
- `frontend/tests/battle.risk.test.ts`
- `frontend/tests/battle_blocked_feedback.test.ts`
- `frontend/tests/battle_assist.test.ts`
- `frontend/tests/elemental_counter.test.ts`
- `frontend/tests/threats.test.ts`
- `frontend/tests/threat_groups.test.ts`
- `frontend/tests/shift_pressure.test.ts`

### Economy, daily, and reward deduplication

- `frontend/tests/age1_economy.test.ts`
- `frontend/tests/consult_balance.test.ts`
- `frontend/tests/daily_checkin_double_grant.test.ts`
- `frontend/tests/daily_claim_double_grant.test.ts`
- `frontend/tests/daily_rounds_v2.test.ts`
- `frontend/tests/daily_weekly_credit_double_count.test.ts`
- `frontend/tests/daily_weekly_credit_rollover.test.ts`

### Backend authority

- `backend/tests/test_player_api.py`
- `backend/tests/activity_registry_authority_check.py`
- `backend/tests/daily_rounds_authority_check.py`
- `backend/tests/test_legacy_university_practice_authority.py`
- `backend/tests/test_clinical_simulation_authority.py`
- `backend/tests/test_clinical_simulation_variations.py`
- `backend/tests/test_grand_rounds_authority.py`
- `backend/tests/test_crisis_drill_authority.py`

Backend authority tests outrank presentation tests when they conflict. Client
tests remain essential evidence for portable rules and presentation behavior,
but a passing client display test cannot override a server rejection, protected
field, receipt, or concurrency contract.

## 7. Engine-portability requirements

The current contract is intended to keep engine migration possible:

- **Stable IDs:** player fields, feature IDs, activity IDs, Journey chapter/tile/
  encounter IDs, heroes, skills, items, receipts, and claim keys must remain
  stable across engines.
- **Engine-independent rules/data:** progression, gates, clinical evaluation,
  formulas, encounter assignment, map identity, rewards, and schemas must be
  represented as portable data and deterministic rules rather than renderer
  behavior.
- **Client-engine presentation separation:** Expo/React Native screens,
  animations, gestures, fog layers, and navigation may change without changing
  the rule contract.
- **Server-authoritative valuable state:** currencies, inventory, rewards,
  attempts, receipts, stamina commitments, and durable progression must stay
  behind authenticated server contracts.
- **Versioned saves and migrations:** persisted player/run schemas and local
  caches need explicit versions, read-side normalization, deterministic
  backfills, and forward-safe migration behavior.
- **Portable test fixtures:** clinical cases, battle formulas, Journey geometry/
  identity, gate contexts, reward claims, replay races, and server authority
  fixtures must be runnable without Expo or a specific rendering engine.
- **No device-clock authority:** time-sensitive valuable behavior must use
  server timestamps or validated commitments; local time may drive presentation
  or an explicitly non-authoritative preview only.

### Engine lock-in rating

**LOW / ACCEPTABLE.**

The durable authority boundary, portable `frontend/src/game` rules/data, typed
manifests, and backend contracts are favorable to a Unity migration. The main
Unity impact is reimplementing presentation/orchestration (screens, animation,
gesture/navigation, fog rendering, and client battle UI) and adapting the
client API/cache layer. Portable rule fixtures can be reused conceptually, and
server-owned valuable state does not need to move into Unity. Migration impact
is higher in the known-risk areas—local Realm production, client-simulated
battle integrity, and incomplete Journey server attestation—because those
boundaries should be resolved before they become engine-specific behavior.

## 8. Tracked migration risks and unresolved authority gaps

These are explicitly tracked risks from the M0-P3F audit. This push records them
and does not redesign or fix them:

1. **Realm production local-time authority:** production/collection is still
   substantially local and needs a server-owned receipt/clock boundary.
2. **Journey run-creation attestation:** server creation does not fully attest
   submitted geometry and ordinary encounter metadata against canonical map
   artifacts.
3. **Journey treasure reward authority:** treasure has stronger client pure
   guards than identified server-grant evidence; ownership remains ambiguous.
4. **Daily Rounds client/server reward drift:** client legacy currency/XP reward
   helpers coexist with the server’s V2 stamina-oriented contract.
5. **Client-simulated battle integrity:** normal clinical action/AP/answer/
   damage simulation is client-side; the server protects the valuable boundary
   rather than replaying every action.
6. **Affinity/equipment explanatory drift:** legacy affinity paths and equipment
   comments/catalog statuses do not perfectly describe active calculations.
7. **Legacy onboarding/profile aliases:** compatibility aliases such as
   `preNursing` remain split across onboarding and downstream behavior.
8. **Verified University-to-Player-Hero proficiency:** the verified receipt
   path from University activity to Player Hero proficiency is incomplete.

Until a dedicated migration changes these boundaries, do not infer authority
from the local implementation merely because it is convenient or visible in a
screen. Preserve the current values and route new work through the authority
layer that owns the relevant contract.