# M1-P1 Verification Record

This records exactly what was checked for the `godot-client/` skeleton added
in this push, and — just as importantly — what could **not** be checked in
this environment.

## Environment constraint (read this first)

No `godot`, `godot4`, or `godot3` executable exists anywhere in the
container this skeleton was authored in (`command -v godot godot4 godot3`
and a broad filesystem search both returned nothing). As a direct
consequence:

> **No `.gd`, `.tscn`, or `project.godot` file added in this push has been
> parsed, opened, or executed by the actual Godot engine.** Every file was
> hand-written to match Godot 4.3's documented file formats and GDScript
> syntax, but "structurally plausible" is not the same as "engine-verified."
> The first time this project is opened in a real Godot 4.3+ editor (or run
> via `godot4 --headless ...`), treat that as the first real test pass, and
> fix whatever it surfaces.

## What was verified in this environment

| Check | Method | Result |
|---|---|---|
| Godot binary availability | `command -v godot godot4 godot3` + filesystem search | Not found — confirmed absent |
| Structural completeness of the skeleton | `bash godot-client/tools/validate_skeleton.sh` | PASS (structural only, see script's own limitation banner) — all 30 required files present, `project.godot` declares `run/main_scene` |
| Fixture pack read-only presence | same script | PASS — `fixtures/clinica-golden/v1/fixture-index.json` reachable at `../fixtures/clinica-golden/v1/` relative to `godot-client/` |
| Fixture pack authoritative validation (unaffected by this push) | `node fixtures/clinica-golden/v1/validate.cjs` (repo root) | PASS — `10 fixtures validated with clinica-jcs-v1` |
| Isolation: only `godot-client/` changed | `git status --porcelain=v1`, `git diff --stat` | Confirmed — the only change relative to HEAD is the new untracked `godot-client/` directory. (One unrelated auto-stamp touched `docs/tutorial-audit.md`'s commit-hash line as a side effect of the environment's own `validate` workflow running; it was reverted with `git checkout -- docs/tutorial-audit.md` so this push touches nothing outside `godot-client/`.) |
| Existing regression suite (frontend `validate`) | Environment's own `validate` workflow (`cd frontend && npm run validate`) ran to completion during this session | FINISHED, `0 errors, 460 warnings` (pre-existing lint warnings, unrelated to this push — no `frontend/` file was touched) |
| Repository HEAD unchanged before this push's commit | `git rev-parse HEAD` | `08af76aaf07f188c57d8ed4cbcdd223a608b17a9` (matches the HEAD recorded at the start of this task) |

## What was explicitly NOT verified (and why)

- **GDScript parses without error.** Not verified — no Godot binary. Risk
  is mitigated by keeping every script small, single-purpose, and following
  documented GDScript 4.x syntax closely, but a typo or 4.x API drift is
  possible and would only surface on first real open.
- **`project.godot` loads in the editor / `Services` autoload resolves.**
  Not verified for the same reason.
- **`SHA-256` canonical-hash parity** between a hypothetical GDScript port
  of `validate.cjs`'s canonicalization routine and the actual fixture
  hashes. Not attempted at all — see
  `scripts/adapters/validation/fixture_validator_adapter.gd`'s doc comment
  and `docs/MIGRATION.md` §4. The authoritative hash check remains
  `node fixtures/clinica-golden/v1/validate.cjs`, which was re-run read-only
  above and still passes.
- **Export presets producing an actual build artifact.** Not attempted —
  presets are unsigned, `runnable=false` stubs pending a real Godot editor
  session with export templates installed.
- **Any interactive/visual behavior** (boot → app-shell transition, label
  rendering, HTTPRequest node lifecycle). Not verified — headless engine
  execution was unavailable.

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
