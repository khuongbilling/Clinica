# Clinica Godot Client — M1-P1 Skeleton

Foundation-only Godot 4.x project. This is an additive migration skeleton:
it does not replace, modify, or depend on the existing Expo/React Native
client (`frontend/`) or backend (`backend/`), and it changes no gameplay,
economy, or save behavior. See [`docs/MIGRATION.md`](docs/MIGRATION.md) for
folder responsibilities and authority boundaries, and
[`docs/M1-P1-VERIFICATION.md`](docs/M1-P1-VERIFICATION.md) for exactly what
was verified — and what remains unverified — in the environment this
skeleton was built in.

## What this push ships

- A mobile-first Godot project: boot scene → app-shell placeholder screen.
- Engine-independent domain contracts (`scripts/core/contracts/`) and
  service interfaces (`scripts/core/services/`).
- A composition root (`scripts/core/composition_root.gd`, the `Services`
  autoload) that wires concrete adapters (`scripts/adapters/`) — navigation,
  app state, an API-transport seam, a local save/cache adapter, config,
  logging, error reporting, a cutscene-playback placeholder, and a
  read-only fixture validator.
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
- Cinematic content — the cutscene service is a placeholder seam
  (skip/replay/fallback/finished hooks only).
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
  --quit-after 2 res://scenes/boot/boot.tscn
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
