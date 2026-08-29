# M1-P1/M1-P2 Godot Migration Foundation

> **Scope: additive foundation pass, now verified against a real Godot
> engine.** This document describes the `godot-client/` skeleton added in
> M1-P1, plus the M1-P2 portable-schema migration layer described in §9. It
> does not change the existing Expo/React Native client, backend
> routes/auth/economy/save behavior, gameplay rules, assets, application
> dependencies, or the M0 canonical contracts. It does add Godot 4.4.1
> itself to this workspace's Nix environment (`replit.nix`) purely as a
> dev/verification tool — no application/runtime dependency changed. See §4
> and `docs/M1-P1-VERIFICATION.md` for what M1-P1 verified, and
> `docs/M1-P2-VERIFICATION.md` for what M1-P2 verified.

## 1. Relationship to the canonical contracts

This skeleton is built to preserve, not reinterpret, the authority rules
already frozen for engine portability:

- [`../../docs/canonical-gameplay-contract.md`](../../docs/canonical-gameplay-contract.md)
  — durable authority vs. portable rules vs. presentation vs. local state.
- [`../../docs/canonical-backend-api-authority-contract.md`](../../docs/canonical-backend-api-authority-contract.md)
  — the API boundary and the explicit **Godot/Unity rule**: only dedicated
  server routes and server-issued receipts/records are durable value
  authority. A Godot reducer, local save, scene outcome, client-generated
  claim key, or cached completion must never be promoted into a currency,
  reward, inventory, progression, or cross-device authority source.
- [`../../docs/canonical-save-schema-contract.md`](../../docs/canonical-save-schema-contract.md)
  — the `clinica.player` v3 envelope shape and authoritative/local split.
- [`../../docs/save-schema-migration-ledger.md`](../../docs/save-schema-migration-ledger.md)
  — the ordered, pure, non-rewarding migration steps a future save adapter
  must follow.
- [`../../fixtures/clinica-golden/v1/README.md`](../../fixtures/clinica-golden/v1/README.md)
  — the portable, engine-neutral fixture pack this project reads (never
  writes) for validation.

Everything below is written to be consistent with those documents. If this
file and a canonical contract ever disagree, the canonical contract wins.

## 2. Folder responsibilities

```
godot-client/
  project.godot            Mobile-first Godot 4.x project settings.
  export_presets.cfg       Minimal, unsigned Android/iOS/Desktop stubs.
  scenes/
    boot/                  Composition-root wiring entry point (run/main_scene).
    app_shell/              First presentation surface (placeholder UI).
  scripts/
    core/
      contracts/           Portable domain data (PlayerEnvelope, JourneyRunRef,
                            ActivityAttemptRef, ValidationResult). Pure data,
                            no I/O, no Node dependency.
      services/             Portable interfaces (INavigationService,
                            IAppStateService, IApiTransport, ISaveCacheStore,
                            IConfigProvider, ILogger, IErrorReporter,
                            IFixtureValidator, ICutscenePlaybackService).
                            RefCounted-based, no engine I/O.
      composition_root.gd   The ONLY file that constructs concrete adapters
                            and wires them to the interfaces above. Registered
                            as the `Services` autoload.
    adapters/               Concrete, engine-specific implementations of the
                            interfaces above (composition edge). Each adapter
                            is the only place allowed to touch a Godot node
                            type, HTTPRequest, FileAccess/user://, OS, etc.
    tools/                  Headless CLI entry points (SceneTree-based) for
                            dev/CI tooling, e.g. run_fixture_validation.gd.
  tools/
    validate_skeleton.sh    Bash smoke/structure check; honest about whether
                            a Godot binary was available to verify with.
  docs/
    MIGRATION.md            This file.
    M1-P1-VERIFICATION.md   What was actually verified in this push, and the
                            ENGINE LOCK-IN rating.
```

### Why the contracts/services split

`scripts/core/` never imports a Godot node type (`Node`, `Control`,
`HTTPRequest`, `FileAccess`, ...). It only uses `RefCounted`, primitive
types, `Dictionary`/`Array`, and signals (which `RefCounted`/`Object`
support natively). This is what "engine-independent" means in practice for
this codebase: if Clinica ever needed a second engine, `scripts/core/`
should port with minimal changes, while `scripts/adapters/` would be
rewritten per engine.

Godot's GDScript has no formal `interface` keyword. The `Ixxx` base classes
under `scripts/core/services/` are documentation-and-structure contracts:
adapters `extends` them and override every method. This gives IDE
autocomplete and a single source of truth for the contract shape, even
though GDScript does not enforce it at compile time the way a real
interface would.

## 3. Authority boundaries this skeleton commits to

- **No local authority promotion.** `LocalSaveCacheAdapter` writes to a
  Godot `user://` file, entirely separate from the existing Expo client's
  `clinica.player.v2` AsyncStorage key (no shared storage, no collision, no
  read/write path between the two clients). Nothing it stores is ever
  treated as authoritative; see `ISaveCacheStore`'s doc comment.
- **No fabricated network authority.** `HttpApiTransport.request()` is a
  named seam, not a working client. It returns `not_implemented` for every
  call. A future push must implement it to call only the documented
  `/api` routes with the documented headers (`X-Clinica-Session`, and
  faculty/curriculum-admin headers only from privileged tooling, never a
  player build) and must treat only the server's response as authoritative,
  per the Godot/Unity rule.
- **No cinematic recreation, no gameplay authority in playback.**
  `ICutscenePlaybackService`/`CutscenePlaybackService` expose
  `play/skip/replay` and `finished`/`skipped`/`fallback_triggered` signals
  only. There is no video decoding, no cinematic asset, and nothing here
  grants a reward, unlocks a gate, or otherwise acts as gameplay authority.
  A future push plugs in a real `VideoStreamPlayer`-based renderer behind
  the same interface.
- **Read-only fixtures.** `FixtureValidatorAdapter` opens files under
  `fixtures/clinica-golden/v1/` with `FileAccess.READ` only. It never calls
  `FileAccess.WRITE` against that directory and never mutates gameplay or
  save state. It is a dev/migration tool, not a shipped runtime feature —
  the fixture pack must remain reachable at `../fixtures/clinica-golden/v1/`
  relative to this project for the tool to find it (that path traversal
  only matters for this headless tooling script; it is not exercised by the
  boot/app-shell runtime).
- **Stable IDs preserved conceptually.** `PlayerEnvelope`, `JourneyRunRef`,
  and `ActivityAttemptRef` mirror the shapes in
  `docs/canonical-save-schema-contract.md` §2–§4 (envelope keys,
  `save_version: 3`, Journey `schema_version: 2`, and the explicit
  requirement that a Journey run or activity attempt is *referenced*, never
  duplicated, inside the player envelope). They currently hold no real
  server data; they exist so a future implementation has an
  already-agreed-upon shape to fill in.

## 4. Fixture validation — what it checks and how parity is verified

Run from the repository root:

```sh
node fixtures/clinica-golden/v1/validate.cjs
```

This remains the **authoritative** check (SHA-256 canonical-hash parity,
full referential integrity). It is unchanged by this push.

The Godot-side validator
(`scripts/adapters/validation/fixture_validator_adapter.gd`, runnable via
`scripts/tools/run_fixture_validation.gd`) now performs a real second-engine
**canonical SHA-256 hash-parity check**, not just a structural smoke check.
It ports `validate.cjs`'s `clinica-jcs-v1` canonicalization (sorted-key JSON
stringification + SHA-256) into GDScript, using `String.sha256_text()`, and
compares the resulting digest for every fixture against `hashes.json`.
Verified under real Godot 4.4.1.stable: all 10 `payload_sha256_parity:*`
checks pass, matching `validate.cjs` byte-for-byte for every value in the
fixture pack, including every float literal present
(0.25 / 0.3 / 0.325 / 0.5 / 1.18 / 1.6).

One known, narrow limitation: the GDScript port does not special-case
extreme-magnitude floats that JavaScript would render in exponential
notation (e.g. `1e+21`); none occur in the current fixture pack. If a
future fixture introduces such a value, extend `_canonicalize()` in
`fixture_validator_adapter.gd` and re-verify before trusting its hash.

## 5. Cutscene playback seam (superseded by §11 / M2-P1)

`ICutscenePlaybackService` originally existed (M1-P1) as a placeholder seam
only: `play(id)` immediately emitted `finished` with no real asset
resolution. **M2-P1 replaced that placeholder with a real, video-backed
implementation** — see §11 for the current design. The interface itself is
unchanged in spirit (same four verbs: play/skip/replay/trigger_fallback,
now joined by `loading` and `current_state()`), so no call site outside
`scripts/adapters/cutscene/` and `scenes/opening/` had to change.

None of this touches gameplay state, currency, or progression.

## 6. Export configuration stance

`export_presets.cfg` contains minimal, `runnable=false` stub presets for
Android, iOS, and a Desktop target. They contain no keystore paths, no
provisioning profile UUIDs, and no signing identities — every credential
field is blank. They have not been opened in the Godot editor (no
executable was available), so they are unverified placeholders, not a
claim that export succeeds. Before a real export: open this project in
Godot 4.3+, let the editor regenerate/validate this file against your
installed export templates, and supply signing credentials through Godot's
own preset UI — never by committing them to this repository.

## 7. Unity portability notes

Nothing in `scripts/core/` references a Godot type, so the domain
contracts and interface shapes are a reasonable starting point for a
hypothetical Unity (C#) port: the same envelope fields, the same
adapter/interface boundary, and the same "server is the only durable
authority" rule apply regardless of engine. The engine-specific edge that
would need a full rewrite for Unity is exactly `scripts/adapters/` (and the
scene/UI layer) — which is also the only part of this Godot skeleton that
would need a rewrite for a *different* Godot approach (e.g. swapping the
HTTP client library). This mirrors the "ENGINE LOCK-IN: LOW" rating already
recorded in the canonical contracts for the current Expo/backend system;
see `docs/M1-P1-VERIFICATION.md` for the rating as applied to this new
Godot code specifically.

## 8. Explicitly out of scope for M1-P1

- Porting gameplay systems, balance, progression, Journey, Realm, combat,
  tutorials, minigames, or UI parity with the existing client.
- Real authentication, reward settlement, server mutations, gameplay
  persistence, cinematic recreation, or signed platform exports.
- Any modification to `frontend/`, `backend/`, assets, application
  dependencies, lockfiles, or the contents of `fixtures/clinica-golden/v1/`.
  (`replit.nix` did gain the Godot engine itself — `pkgs.godot` /
  `pkgs.godot_4` — as a dev/verification tool; see
  `docs/M1-P1-VERIFICATION.md`. That is not an application dependency and
  changes no gameplay, economy, authority, or save behavior.)

## 9. M1-P2: Portable Schemas + Migrations

M1-P2 adds the first real, executable implementation of the migration
ledger described in
[`../../docs/save-schema-migration-ledger.md`](../../docs/save-schema-migration-ledger.md),
on the Godot side, plus a safe import/export transfer boundary. It does not
touch gameplay, and it does not change what the existing Expo frontend or
FastAPI backend do — see §10.

```
scripts/core/migration/
  player_save_migration.gd   Pure migrator: migrate(raw) -> MigrationOutcome.
                              Ordered Entry A (legacy -> v1 aliases/backfill)
                              -> Entry B (v1 -> v2 authoritative/local split)
                              -> v3 envelope. See its header doc comment for
                              the full purity/determinism/idempotency/
                              no-mint contract this file holds itself to.
  player_save_transfer.gd    import_from_transfer()/export_for_transfer():
                              a thin wrapper around the one migrator above,
                              plus defensive credential-key redaction on
                              export. Never a Godot-specific serialized
                              Resource — always the same portable
                              Dictionary/JSON shape any engine can read.
scripts/core/contracts/
  migration_outcome.gd       Result contract: action (accept/migrate/
                              quarantine), save_version, envelope,
                              quarantine_reason, raw_preserved.
scripts/adapters/validation/
  player_save_migration_validator_adapter.gd
                              Runs the real migrator against the golden
                              fixture (player-migration-vectors.json) AND a
                              few supplementary native GDScript vectors for
                              scenarios the fixture pack does not yet cover
                              (repeated-migration idempotency, Chapter-1
                              alias delta-safety, JSON round trip, quarantine
                              of a non-Dictionary input, no destructive
                              downgrade path, Player Hero never manufactured,
                              export redaction). Every check is labeled
                              `fixture:*` or `native:*` so it is always clear
                              which is fixture-driven vs. supplementary.
scripts/tools/
  run_migration_validation.gd   Headless entry point, mirrors
                                 run_fixture_validation.gd's pattern.
```

`ISaveCacheStore` (and `LocalSaveCacheAdapter`) gained four new methods for
this push: `read_and_migrate()` (read the local cache and run it through the
migrator, no write side effect), `write_migrated_cache(envelope)` (persist
an already-migrated v3 envelope), and `write_quarantine(outcome)` /
`read_quarantine()` (a namespace **fully separate** from the normal cache
file, so a quarantined unknown-future-version or malformed record can never
be confused with, merged into, or silently overwrite valid save data).

### Design decisions worth recording

- **Field classification default.** Every input field is classified as
  `authoritative`, `local`, or — if it matches neither explicit allowlist in
  `player_save_migration.gd` — routed into `local.extensions` (opaque,
  preserved, never read as authority). This follows the ledger's explicit
  instruction to carry unknown fields into a non-authoritative extension
  area rather than dropping them, and avoids having to enumerate the
  entire ~200-field PlayerState shape up front.
- **`realm_seed` backfill formula** is a portable, deterministic
  string-derivation rule (`"…-player-…" -> "realm-…"`) independent of, and
  not a re-implementation of, the frontend's own numeric FNV-1a Realm-grid
  seed algorithm in `frontend/src/game/store.tsx` — that one seeds a
  different, engine-specific rendering concern. Both are legitimately
  different, non-conflicting derivations from the same `player_id`.
- **No-mint proof is independently computed**, not trusted from a fixture's
  declared `grant_delta`: `PlayerSaveMigration.compute_grant_delta()`
  actually diffs before/after valuable fields at runtime. The one
  documented exception is the Chapter-1 journey-node alias rename (adds the
  new ID only when its old counterpart was already present — a rename of an
  existing grant, not a new one).
- **Idempotency by construction, not by re-running logic.** An input that is
  already v3-shaped (`authoritative`/`local` present, `save_version: 3`) is
  accepted unchanged on a fast path — Entry A/B logic never re-runs against
  already-classified data, which is what makes a second `migrate()` call a
  true no-op.
- **Determinism w.r.t. device time** is enforced by construction and
  verifiable by inspection: nothing in `scripts/core/migration/` calls
  `Time.*`, `OS.*`, `randi()`/`randf()`, or any `RandomNumberGenerator` — no
  runtime clock-variance test was fabricated to "prove" this; it is a
  structural property of the code, stated honestly here instead.

## 10. Explicitly out of scope for M1-P2

- Journey/battle/Realm/inventory/shop/recruitment/economy/Player-Hero-
  creation gameplay parity or behavior changes.
- Any network authority work — `HttpApiTransport` is unchanged; migration
  operates only on already-fetched or locally cached data.
- Fixing the backend authority gaps already tracked in
  `docs/canonical-save-schema-contract.md` §8 and
  `docs/save-schema-migration-ledger.md` §8 — those remain labeled,
  out-of-scope tracked gaps, not silently patched by this push.
- Any modification to `frontend/`, `backend/`, `fixtures/clinica-golden/v1/`,
  or the M0 canonical contract documents themselves.

## 11. M2-P1: Opening Shell + Real Cutscene Playback

**Scope: additive presentation pass.** Replaces the M1-P1 cutscene
placeholder (§5) with a real, video-backed implementation, and inserts a
new `Opening` scene between `Boot` and `AppShell`. No gameplay, save,
reward, or progression code path is touched.

### 11.1 What changed

- `scripts/core/services/i_cutscene_playback_service.gd` — the interface
  gained a `loading(cutscene_id)` signal and a `current_state() -> String`
  abstract method (for UI state-driving and testability), and promoted
  `trigger_fallback(reason)` from an adapter-only convenience to a formal
  abstract method. Signatures remain engine-neutral (`String` ids only) —
  no Godot type appears in the interface.
- `scripts/adapters/cutscene/cutscene_playback_service.gd` — real
  implementation. Owns a `CUTSCENE_ASSET_PATHS` manifest
  (`"opening" -> res://assets/cutscenes/opening.ogv`), a small state
  machine (`IDLE/LOADING/PLAYING/FINISHED/SKIPPED/FALLBACK`), and resolves
  + loads the asset via `ResourceLoader`. It does **not** own or construct
  the `VideoStreamPlayer` node — the display surface is bound in from the
  outside via `bind_display_node()`/`unbind_display_node()`, so the
  service (a long-lived autoload member) never keeps a dangling reference
  to a node owned by a scene that may be freed.
- `scenes/opening/opening.tscn` + `opening.gd` (new) — the presentation
  scene. Owns the real `VideoStreamPlayer`, a loading label, a fallback
  label, and Skip/Replay buttons. Binds the display node on `_ready()`,
  unbinds it on `_exit_tree()`.
- `scenes/boot/boot.gd` — now navigates to `opening` (previously navigated
  straight to `app_shell`).
- `assets/cutscenes/README.md` (new) — documents the expected drop-in path
  and format for the real pre-rendered clip. No video file is added by
  this push; see §11.4.

### 11.2 Fallback detection (real, not simulated)

`play(id)` can fall back for three distinct, independently-verified
reasons, in this order:

1. **`missing_asset`** — `ResourceLoader.exists(path)` is false. This is
   the actual, current state of the repository (no `.ogv` file exists yet)
   — the fallback this push ships with is exercised for real, every time,
   not merely simulated in a test.
2. **`unsupported_asset`** — the resource loads but is not a `VideoStream`.
3. **`no_display_node`** — the resource is a valid `VideoStream`, but no
   display node is currently bound (e.g. the opening scene was torn down
   mid-load, or a caller invoked `play()` before binding a surface).

### 11.3 Convergence: one shared transition, three triggers, no second path

`opening.gd`'s `_on_cutscene_finished`, `_on_cutscene_skipped`, and
`_on_cutscene_fallback` handlers all call the exact same
`_advance_to_app_shell()` function, guarded by a one-shot `_transitioned`
flag. There is deliberately no second transition path. This is enforced by
an automated source-level regression check in
`OpeningCutsceneValidatorAdapter` (§ "M2-P1 opening/cutscene validator" in
`docs/M2-P1-VERIFICATION.md`), not just by code review.

**Replay is presentation-only and is not a second completion path.**
`_on_replay_pressed()` calls `Services.cutscene.replay()` and nothing else
— it never calls `_advance_to_app_shell()`, `navigate_to()`, or
`change_scene_to_file`, and it is only reachable before `_transitioned`
becomes true. Replaying the cutscene cannot grant a reward, alter gating,
or write save/progression state: `opening.gd` and
`cutscene_playback_service.gd` reference no save/state/progression/network
authority surface at all (`Services.save_cache`, `Services.app_state`,
`Services.api_transport`, `PlayerEnvelope`) — verified by an automated
grep-style check in the same validator, not just by inspection.

### 11.4 Explicitly out of scope for M2-P1

- The actual pre-rendered cinematic video file. `assets/cutscenes/` ships
  only a `README.md` describing the expected drop-in path
  (`res://assets/cutscenes/opening.ogv`); no video content is fabricated,
  generated, or embedded by this push. The real, honest missing-asset
  fallback (§11.2) is what runs today, and is what future
  `godot --headless --quit-after N res://scenes/boot/boot.tscn` runs will
  keep exercising until a real asset is dropped in.
- A "watch again" screen reachable after the shared transition has fired.
  Replay in this push is a restart-from-the-top control on the opening
  screen itself, available only until `_advance_to_app_shell()` runs —
  see §11.3.
- Threaded/async video resource loading. `ResourceLoader.load()` is called
  synchronously; this is a deliberate scope decision appropriate for a
  short pre-rendered clip, documented here as a known future extension
  point rather than fabricated complexity.
- Any change to `PlayerEnvelope`, save migrations (§9), Journey, combat,
  Realm, economy, inventory, recruitment, Player-Hero creation, backend
  authority routes, the Expo frontend, or any lockfile.

## 12. M2-P2: Deterministic Prologue Battle Slice

M2-P2 adds the first controlled playable Godot slice after the M2-P1 opening
shell. AppShell now links to a temporary loadout, a deterministic introductory
clinical encounter, and an explicitly non-rewarding handoff placeholder.

### 12.1 One portable battle seam

`IPrologueBattleService` is the only new battle-facing interface.
`GodotPrologueBattleService` is its only concrete adapter and is wired only in
the existing `Services` composition root. The presentation scene calls that
service; it does not calculate effects or own action state.

`PrologueBattleRules` contains the minimal engine-independent state transitions
and calculator ordering needed by this slice. Its Strike, Stabilize, and Shield
calculations are validated directly against all six cases in
`battle-clinical-vectors.json`. It is intentionally not a second full combat
engine and does not implement turns, rewards, progression, inventory, or
server settlement.

### 12.2 Session-only action economy

The encounter owns four battle AP. Assessment, prioritization, and
reassessment are teaching decisions; the intervention spends one battle AP.
The state also carries a read-only displayed stamina baseline so validation can
prove that AP changes while persistent stamina does not.

No M2-P2 service or scene references `save_cache`, `api_transport`,
`PlayerEnvelope`, or any local-cache write API. Completion sets only a
session-local handoff route.

### 12.3 Deterministic teaching sequence

The fixed temporary loadout uses the existing prologue-only IDs for
Nightingale, Fleming, and the Former Self. The fixed encounter is the Silent
Infarction introduction. The state machine accepts exactly:

1. assess;
2. prioritize;
3. intervene;
4. reassess;
5. final action.

Out-of-order input is rejected without changing state. Reassessment advances
to the explicit final-action beat; only that fifth action completes the local
teaching case and reveals the Continue action to the handoff placeholder.

### 12.4 Presentation and portability

Loadout, battle, and handoff are Godot presentation scenes with readable,
wrapped labels, keyboard focus, and controls at least 76 logical pixels tall.
They use no required art, audio, generated asset, or renderer-specific combat
logic, so missing visuals cannot block the loop.

For a future Unity port, the state snapshot, fixed content dictionaries,
calculator inputs/outputs, and action sequence can translate directly to plain
C# data and an interface. Only the Godot adapter and scene layer need
replacement.

### 12.5 Explicitly out of scope for M2-P2

- Durable completion, rewards, XP, currency, stamina, hero ownership,
  progression, saves, receipts, or backend calls.
- Main battle-engine replacement or redesign of clinical precedence/formulas.
- Journey, Realm, inventory, shops, recruitment, Player Hero creation, or
  M2-P3.
- Changes to the Expo frontend, backend, root dependencies/lockfiles, canonical
  contracts, or golden fixture content.
