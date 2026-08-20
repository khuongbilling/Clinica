---
name: Fog-map topology generator
description: Calibration rules for generateHexTopology — weight tuning, gate-distance thresholds, and why quadratic compactness breaks portrait maps.
---

## Core algorithm

Weighted BFS growth from (0,0) using three multiplicative weights:
- **Compactness**: `n + 1` (linear, where n = placed neighbours) — mild fill preference.
- **Portrait bias**: `r≥0 → 1 + r×0.30`, `r<0 → 1 + |r|×0.15`, horizontal penalty `max(0.15, 1 - |q|×0.14)`.
- **Width limit**: returns `0.002` (not 0) when q-spread exceeds `maxWidth`; never hard-zero or all-frontier tiles can end up with zero total weight.

**Why linear and not n²:** With `n²`, compactness dominates portrait bias and produces roughly circular maps. A circular 30-tile blob has BFS diameter ≈ 7–8, making any gate-distance threshold above 8 unachievable in 60 retries. Linear `n+1` lets portrait bias control shape, producing tall maps with BFS diameters of 9–13 for 30 tiles.

## Gate-distance threshold

Small maps use a linear gate-separation rule. Large compact maps must scale
the required separation with map diameter rather than raw cell count.

**Why:** Compact maps grow in diameter sublinearly; retaining a linear
requirement at large sizes rejects valid maps and forces artificial,
string-like layouts.

## Width budget

`maxWidth = max(5, ceil(sqrt(N × 0.75)))`
- 30→5, 35→5, 40→6, 50→7

Validity check allows 1.4× slack: `ceil(maxWidth × 1.4)`.

## Retry strategy

60 retries; each retry uses `(baseSeed + retry × 2_654_435_761) >>> 0` as Mulberry32 seed.

## PRNG + seed hashing

PRNG helpers now live in `prng.ts` (shared with encounters.ts):
- Mulberry32 for the growth loop.
- FNV-1a 32-bit to convert string seeds: `fnv1a32("ch${chapter}:${seed}")`.
- Ensures `seed="42"` for ch1 differs from ch2 even though the string is the same.

## Tile selection

- **Start**: bottom 30% by r descending (highest r = lowest on screen), break ties by |q| ascending (centre first).
- **Gate**: candidates must have dist ≥ `minGateDistance`, not adjacent to start, sorted by: above start (r < startR) first, then farther dist, then smaller |q|.

## Test harness

File: `frontend/tests/journey_map_topology.test.ts` — same `check`/`eq` harness as `journey_map_config.test.ts`, run with `npx sucrase-node`.
All 139 assertions pass across ch1–ch100 at various seeds.
