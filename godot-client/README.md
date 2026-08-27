# Clinica Godot Client — M1-P1 Skeleton + M1-P2 Portable Schemas + M2-P1 Opening Shell

Foundation-only Godot 4.x project. This is an additive migration skeleton:
it does not replace, modify, or depend on the existing Expo/React Native
client (`frontend/`) or backend (`backend/`), and it changes no gameplay,
economy, or save behavior. See [`docs/MIGRATION.md`](docs/MIGRATION.md) for
folder responsibilities and authority boundaries,
[`docs/M1-P1-VERIFICATION.md`](docs/M1-P1-VERIFICATION.md) for what M1-P1
verified, [`docs/M1-P2-VERIFICATION.md`](docs/M1-P2-VERIFICATION.md) for
what the M1-P2 portable-schema migration layer verified, and
[`docs/M2-P1-VERIFICATION.md`](docs/M2-P1-VERIFICATION.md) for what the
M2-P1 opening shell + real cutscene playback push verified.

## M2-P1: opening shell + real cutscene playback

`Boot` now navigates to a new `Opening` scene (before `AppShell`), which
hosts a real, video-backed implementation of `ICutscenePlaybackService`
(`scripts/adapters/cutscene/cutscene_playback_service.gd`): a loading
state, mobile-friendly Skip and Replay controls, and a genuine
missing/unsupported-asset fallback (there is no pre-rendered video in this
repository yet — see `assets/cutscenes/README.md`). Finished playback, a
user skip, and a fallback all converge on the exact same
post-cutscene transition into `AppShell`; Replay is a presentation-only
restart with no reward, gating, or save/progression effect. See
[`docs/MIGRATION.md`](docs/MIGRATION.md) §11 for the full design and
[`docs/M2-P1-VERIFICATION.md`](docs/M2-P1-VERIFICATION.md) for verification
results.

## M1-P2: portable save schema + migrations

`scripts/core/migration/player_save_migration.gd` is a pure, deterministic
migrator (`migrate(raw) -> MigrationOutcome`) that carries a legacy or
partial player save forward to the canonical `clinica.player` v3 envelope
(unversioned/legacy → v1 → v2 → v3, per
`docs/save-schema-migration-ledger.md`), plus `player_save_transfer.gd`, a
thin safe import/export boundary for future Godot ↔ Unity/Replit transfer
that never emits a Godot-specific serialized resource. See
[`docs/MIGRATION.md`](docs/MIGRATION.md) §9 for the full design notes and
[`docs/M1-P2-VERIFICATION.md`](docs/M1-P2-VERIFICATION.md) for verification
results.

## What this push ships

- A mobile-first Godot project: boot scene → opening cutscene shell →
  app-shell placeholder screen.
- Engine-independent domain contracts (`scripts/core/contracts/`) and
  service interfaces (`scripts/core/services/`).
- A composition root (`scripts/core/composition_root.gd`, the `Services`
  autoload) that wires concrete adapters (`scripts/adapters/`) — navigation,
  app state, an API-transport seam, a local save/cache adapter, config,
  logging, error reporting, a real video-backed cutscene-playback service
  (M2-P1), and read-only fixture/migration/cutscene validators.
- A read-only validator for `fixtures/clinica-golden/v1/`
  (`scripts/adapters/validation/fixture_validator_adapter.gd`, runnable
  headlessly via `scripts/tools/run_fixture_validation.gd`).
- Minimal, unsigned export-preset stubs for Android/iOS/Desktop
  (`export_presets.cfg`).

## What this push does NOT ship

- Gameplay, balance, progression, Journey, Realm, combat, tutorials, or UI
  parity with the existing client.
- Real network/save wiring — `HttpApiTransport.request()` and
  `LocalSaveCacheAdapter` are structural seams, not a working backend
  integration.
- Cinematic content — no pre-rendered video file exists yet; the opening
  scene's real, honest missing-asset fallback is what runs today (see
  `assets/cutscenes/README.md` and `docs/MIGRATION.md` §11).
- Signed or verified platform exports.

## Running (Godot 4.4.1 verified in this environment)

Godot 4.4.1.stable is available in this workspace (added via `pkgs.godot` /
`pkgs.godot_4` in `replit.nix`, specifically so this skeleton could be
verified against a real engine — see `docs/M1-P1-VERIFICATION.md`). Every
`.tscn`/`.gd` file below has been headlessly imported and booted by that
real engine, and the Godot-side fixture validator's canonical SHA-256
hash-parity check has been run against it and passes.

```sh
# Open the editor:
#   Godot 4.3+ → Import → select godot-client/project.godot

# Or run headless (as verified in this environment):
godot --headless --path godot-client \
  --script res://scripts/tools/run_fixture_validation.gd

godot --headless --path godot-client \
  --script res://scripts/tools/run_migration_validation.gd

godot --headless --path godot-client \
  --script res://scripts/tools/run_opening_cutscene_validation.gd

godot --headless --path godot-client \
  --quit-after 6 res://scenes/boot/boot.tscn
```

## Structural + real-engine smoke check

```sh
bash godot-client/tools/validate_skeleton.sh
```

In this environment this detects the real Godot binary and reports a
genuine PASS from both headless checks (fixture validator, including hash
parity; and boot-scene parse/run) rather than the structural-only fallback.
The fallback path (file-presence checks + limitation banner) remains in the
script for environments that have no Godot binary at all.
