# M1-P1 Godot Migration Foundation

> **Scope: additive foundation pass only.** This document describes the
> `godot-client/` skeleton added in M1-P1. It does not change the existing
> Expo/React Native client, backend routes/auth/economy/save behavior,
> gameplay rules, assets, dependencies, or the M0 canonical contracts.

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

## 4. Fixture validation — what it checks and what it explicitly does not

Run from the repository root:

```sh
node fixtures/clinica-golden/v1/validate.cjs
```

This remains the **authoritative** check (SHA-256 canonical-hash parity,
full referential integrity). It is unchanged by this push.

The Godot-side validator
(`scripts/adapters/validation/fixture_validator_adapter.gd`, runnable via
`scripts/tools/run_fixture_validation.gd`) is a **portability smoke check**:
it re-implements the envelope-shape and a handful of cross-reference checks
from `validate.cjs` in GDScript, to prove the fixture pack is readable and
structurally sound from a second engine. It deliberately does **not**
attempt SHA-256 canonical-hash verification: no Godot executable was
available while this script was authored, so a hand-ported canonicalization
routine could not be exercised or trusted, and shipping an unverified hash
check that might silently always "pass" (or always "fail") would be worse
than not having one. The validator reports this explicitly as a `limited`
check rather than fabricating a result. Closing this gap (porting and
testing the canonicalization routine against a real Godot binary) is
future work, not implemented here.

## 5. Cutscene placeholder seam

`ICutscenePlaybackService` exists so that later work (actual pre-rendered
cutscene playback) has an agreed seam to implement against without forcing
scene/UI code to change call sites. Current behavior:

- `play(id)` records the id and immediately emits `finished` (there is no
  asset to play yet).
- `skip()` emits `skipped` if a cutscene is "current".
- `replay()` re-invokes `play()` with the same id.
- `trigger_fallback(reason)` emits `fallback_triggered` for a caller to
  react to (e.g. show a static image instead of a video) — this hook exists
  now specifically so the future video-backed implementation has a defined
  failure path from day one.

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
- Any modification to `frontend/`, `backend/`, assets, dependencies,
  lockfiles, or the contents of `fixtures/clinica-golden/v1/`.
