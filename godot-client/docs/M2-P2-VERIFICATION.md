# M2-P2 Verification Report — Prologue Battle Slice

## Scope delivered

- Deterministic temporary loadout using three existing prologue-only IDs.
- One fixed Silent Infarction introductory clinical encounter.
- Ordered assess → prioritize → intervene → reassess → final action teaching
  loop.
- Battle AP owned by the encounter and explicitly separate from displayed
  persistent stamina.
- Session-only post-battle handoff placeholder with a clear Continue action.
- One portable service interface, one Godot adapter, and no screen-level
  calculator implementation.
- Dedicated first-battle validator.

No durable reward, currency, XP, stamina, hero ownership, progression, save,
receipt, inventory, or backend mutation is added.

## Environment

- Godot 4.4.1 stable.
- Tests run from an isolated temporary copy with temporary HOME/XDG data paths.
- Existing fixture content and canonical contract documents were read but not
  modified.

## Exact validation results

| Check | Result |
|---|---:|
| Clean headless Godot import | PASS, exit 0 |
| Boot → Opening → AppShell smoke | PASS, exit 0 |
| Direct Opening smoke | PASS, exit 0 |
| Prologue loadout scene smoke | PASS, exit 0 |
| Prologue battle scene smoke | PASS, exit 0 |
| Prologue handoff scene smoke | PASS, exit 0 |
| Existing fixture/hash validator | 68 pass, 0 fail |
| Existing migration validator | 41 pass, 0 fail |
| Existing M2-P1 opening/cutscene validator | 40 pass, 0 fail |
| New M2-P2 first-battle validator | 61 pass, 0 fail |
| Aggregate `validate_skeleton.sh` | PASS |

Total validator assertions: **210 pass, 0 fail**.

## First-battle validator coverage

The dedicated validator:

- requires the existing fixture/hash validator to pass;
- evaluates all six battle/clinical golden-vector cases through
  `PrologueBattleRules`;
- checks Strike rounding, Stabilize ordering, and shield-before-stability
  ordering;
- runs two independent services through the same action sequence and compares
  every result and final snapshot;
- proves an out-of-order final action cannot mutate state;
- requires the exact five-action history and prevents completion at
  reassessment;
- verifies fixed loadout and encounter IDs;
- proves only intervention spends battle AP and persistent stamina remains
  unchanged through completion;
- proves durable-write and durable-grant counts remain zero;
- rejects forbidden save/API/player-authority references;
- confirms exactly one concrete prologue battle adapter;
- confirms the ordered teaching sequence and fixed handoff;
- loads and instantiates all three prologue scenes;
- checks focus-following scroll containers, wrapped readable copy, and 76–84
  pixel touch controls on the instantiated node trees;
- confirms the presentation controller delegates actions rather than
  reimplementing calculation logic;
- checks the M2-P2 battle sources contain no M2-P3 marker.

## Self-audit

### BLOCKER

None.

### HIGH

None.

### MEDIUM

None.

### LOW / known limitations

- This is intentionally one deterministic teaching case, not the complete
  battle engine.
- Visual presentation uses text/UI fallbacks only; no new art or audio is
  required.
- The displayed stamina baseline proves separation but does not read or mutate
  a player save.
- The handoff returns to AppShell and does not begin M2-P3.

## Protected-scope audit

No files under `frontend/` or `backend/` changed. No root package/lockfile,
canonical gameplay contract, or golden fixture content changed.

## ENGINE LOCK-IN

**LOW / GREEN.**

State, content, calculator inputs/outputs, and action order are plain portable
data behind one interface. Godot-specific code is limited to the adapter,
composition wiring, scenes, and navigation calls. A future Unity client can
replace those edges without changing the deterministic contract.