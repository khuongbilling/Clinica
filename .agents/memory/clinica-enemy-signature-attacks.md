---
name: Clinica enemy signature attacks
description: How enemy end-of-turn signature attacks work and which existing systems they must respect
---

# Enemy signature attacks (endPlayerTurn)

Each enemy has a fixed signature attack kind derived from its ElementSystem (boss `lord_imbalance` → spread). Kinds:
- `assault` — full stability damage.
- `spread` — half stability damage + corruption regrow (`SPREAD_CORRUPTION_REGROW`).
- `hex` — half stability damage + next-turn AP −1 (min 1).

**Why balance-neutral:** each alt effect trades away half the stability damage, so it doesn't strictly increase difficulty.

## Must respect existing Infection Control mechanic
The `applyCall` Infection Control option sets `blockNextSpread = true` ("next spread blocked"). Any `spread` signature attack MUST check `s.blockNextSpread`: when true, skip corruption regrow, log the block, and consume the flag (clear it). Forgetting this makes the Infection Control call a no-op — a real gameplay regression caught in review.

**How to apply:** whenever you add/modify a corruption-raising enemy effect, grep for `blockNextSpread` and ensure the flag is honored and consumed. The flag is only cleared on a spread-kind turn; it persists across non-spread enemy turns.
