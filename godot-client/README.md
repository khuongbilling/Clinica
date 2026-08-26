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

## Running (requires a local Godot 4.3+ install)

No Godot executable was available in the sandbox this skeleton was authored
in, so none of the `.tscn`/`.gd` files below have been opened or executed by
the Godot engine. Treat them as unverified until run once locally.

```sh
# Open the editor:
#   Godot 4.3+ → Import → select godot-client/project.godot

# Or run headless:
godot4 --headless --path godot-client \
  --script res://scripts/tools/run_fixture_validation.gd

godot4 --headless --path godot-client \
  --quit-after 2 res://scenes/boot/boot.tscn
```

## Structural/limitation smoke check (works without Godot installed)

```sh
bash godot-client/tools/validate_skeleton.sh
```

This checks that required files exist and, when a `godot`/`godot4` binary
is present, also attempts a real headless parse/run. When no binary is
present it prints an explicit limitation banner rather than claiming a
Godot-verified pass.
