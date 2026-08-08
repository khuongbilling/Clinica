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

`minGateDistance(N) = max(4, floor(N × 0.22))`

Observed gate distances vs thresholds:
- 30 tiles: threshold 6, observed 8–13
- 35 tiles: threshold 7, observed 9–10
- 40 tiles: threshold 8, observed 8–12
- 50 tiles: threshold 11, observed 12+

**Why 0.22 not 0.35:** 0.35 × 30 = 10.5, which exceeds the achievable maximum BFS distance for compact maps. 0.22 is the highest multiplier that reliably passes in all 60 retries across the full chapter range (1–100).

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
