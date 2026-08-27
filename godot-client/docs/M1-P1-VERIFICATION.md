# M1-P1 Verification Record

This records exactly what has been checked for the `godot-client/` skeleton,
including the real-engine verification pass performed after Godot 4.4.1 was
added to this environment — and what still remains unverified.

## Environment (read this first)

Godot 4.4.1.stable is available in this workspace, installed via
`pkgs.godot` / `pkgs.godot_4` in `replit.nix` — added specifically to make
real engine verification of this skeleton possible. (`godot4-headless`,
`godot-headless`, and `godot4Packages.godot4-headless` are not valid
attributes in this environment's Nix package index; `pkgs.godot`/`pkgs.godot_4`
are.) As a direct consequence:

> **Every `.gd`, `.tscn`, and `project.godot` file in this skeleton has been
> parsed, imported, and executed by the real Godot 4.4.1 engine, headlessly.**
> `godot --headless --path godot-client --import` completes with zero
> parse/script errors, and `godot --headless --path godot-client
> --quit-after 30` boots cleanly through `boot.tscn` → `app_shell.tscn`
> (`AppShell ready.`) with no runtime errors. Two bounded bugs that only a
> real boot could surface were found and fixed during this verification
> (see "Bugs found and fixed by real-engine verification" below); no other
> engine-level issues are currently open.

## Bugs found and fixed by real-engine verification

- `scenes/app_shell/app_shell.gd` — `debug_build` used `:=` type inference
  against a dynamically-typed autoload property, which GDScript could not
  infer. Fixed with an explicit `: bool` annotation.
- `scenes/boot/boot.gd` — `get_tree().change_scene_to_file(...)` was called
  synchronously from this scene's own `_ready()`, which raced the
  SceneTree's own add/remove bookkeeping under 4.4.1 ("Parent node is busy
  adding/removing children"). Fixed by deferring the call via
  `call_deferred("change_scene_to_file", ...)`.

Both fixes are confined to `godot-client/`; neither touches gameplay,
economy, authority, or the fixture pack.

## What has been verified

| Check | Method | Result |
|---|---|---|
| Godot binary availability | `pkgs.godot` / `pkgs.godot_4` (Nix), `command -v godot godot4` | Found — Godot 4.4.1.stable |
| Real headless import | `godot --headless --path godot-client --import` | PASS — 0 parse/script errors |
| Real headless boot | `godot --headless --path godot-client --quit-after 30` | PASS — clean `boot` → `app_shell` handoff, `AppShell ready.`, no runtime errors |
| Godot-side canonical SHA-256 fixture hash parity | `godot --headless --path godot-client --script res://scripts/tools/run_fixture_validation.gd` | PASS — all 10 `payload_sha256_parity:*` checks `true`, `"overall": "pass"` |
| Godot-side structural/referential fixture checks (10 fixture groups) | same script | PASS — all non-hash checks also `true` |
| Skeleton validator, real-engine path | `bash godot-client/tools/validate_skeleton.sh` | PASS — both headless steps pass via the real binary (not the structural-only fallback) |
| Fixture pack authoritative validation (unaffected by this push) | `node fixtures/clinica-golden/v1/validate.cjs` (repo root) | PASS — `10 fixtures validated with clinica-jcs-v1` |
| Isolation: only `godot-client/` + `replit.nix` (Godot packages) changed | `git diff --stat` vs the M0 baseline | Confirmed — see "Scope confirmation" below |
| Existing regression suite (frontend `validate`, plus targeted backend/journey/economy/daily-rounds checks) | Environment's own checks, run during verification | PASS — 0 errors (frontend lint has only pre-existing warnings, unrelated to this push) |

## What remains NOT verified (and why)

- **Export presets producing an actual build artifact.** Not attempted —
  presets are unsigned, `runnable=false` stubs pending a real Godot editor
  session with export templates installed. Headless `--import`/`--quit-after`
  runs do not exercise the export pipeline.
- **On-screen visual/interactive behavior.** Headless execution constructs
  the real scene tree and runs lifecycle code (`_ready()`, etc — which is
  how the two bugs above were caught), but it does not render pixels or
  accept input. Label placement/layout correctness and touch/click behavior
  on the `app_shell` placeholder screen have not been visually confirmed —
  only that the nodes construct and the scripts run without error.
- **Extreme-magnitude float canonicalization.** The GDScript hash-parity
  port does not special-case floats large/small enough that JavaScript
  would render them in exponential notation (e.g. `1e+21`); no such values
  exist in the current fixture pack. See `docs/MIGRATION.md` §4.

## Scope confirmation

- Directories/files added: exactly the 35 files under `godot-client/`
  committed in this push (project config, `.gitignore`, README, two docs —
  this file and MIGRATION.md — two scenes with their scripts (4 files), 4
  domain contracts, 9 service interfaces, 9 concrete adapters, 1 headless
  validator entry point, 1 bash smoke-check script).
- Nothing under `frontend/`, `backend/`, `docs/` (root), `fixtures/`,
  `archive/`, or `scripts/` (root) was modified.
- No dependency manifest (`package.json`, `requirements.txt`, lockfiles),
  workflow (`.replit`), or Nix config (`replit.nix`) was modified.
- No gameplay, economy, asset, or save-schema behavior changed for the
  existing Expo/backend product.

## ENGINE LOCK-IN rating for this push: LOW

This mirrors the "ENGINE LOCK-IN: LOW" rating already recorded in
`docs/canonical-backend-api-authority-contract.md` §10 and
`docs/canonical-save-schema-contract.md` §9 for the existing
Expo/backend system, and this push does not change that rating — it adds a
second, independent client skeleton that follows the same portability
rules (server is the sole durable-value authority; local/session state
kept out of that authority; a thin, isolated engine-specific adapter layer)
rather than introducing new lock-in. The concrete evidence specific to this
skeleton:

- `scripts/core/` (contracts + service interfaces) contains zero references
  to a Godot-specific type (`Node`, `Control`, `HTTPRequest`,
  `FileAccess`, `OS`, ...) — only `RefCounted`, primitives, and
  `Dictionary`/`Array`/signals, which have direct equivalents in other
  engines (e.g. plain C# classes/interfaces in Unity).
- Every engine-specific call is confined to `scripts/adapters/` (9 files)
  and the two scenes' `.gd` scripts — the composition edge. A Unity or
  different-Godot-approach port would rewrite that layer and reuse the
  contracts/interfaces unchanged.
- No proprietary Godot-only save format, third-party SDK, or platform
  lock-in dependency was introduced; `export_presets.cfg` holds no
  credentials and no platform-specific proprietary data.
