---
name: Hex Lane Layout Pipeline (Push 5)
description: getChapterHexLayout — converts PathwayGraph into exact walkable hex tile footprint with precise tile count, clearing zones, lane segments, and BFS connectivity guarantee.
---

## Rule
`getChapterHexLayout(chapter)` must always return a layout where `actualTileCount === targetTileCount` and all cells are BFS-connected from `startCell`.

**Why:** The downstream art and encounter systems (Push 6+) index tiles by position; any mismatch or island silently corrupts encounter placement.

## How to apply
- File: `frontend/src/game/journeyMap/chapterHexLayout.ts`
- Public API: `getChapterHexLayout(ch)` (cached), `getChapterHexLayoutRange(from, to)`
- Pipeline: DNA + PathwayGraph → `buildHexLayout` → `HexLaneLayout`

## Critical implementation notes

### Lane-free campus exception
Chapter 1 is intentionally an open-courtyard campus, not a corridor map. Its
walkable-art direction must prohibit invented bottlenecks, and generic
lane-oriented checks must treat this as an explicit exception.

**Why:** Fabricating corridor metadata would make the finished environment
contradict the playable map.

### Lane width
- `LANE_HALF_WIDTH = { primary: 0, secondary: 0 }` — corridors are 1-wide at baseline.
- `TRANSITION_HALF_WIDTH_BONUS = 1` on the last `TRANSITION_ZONE_TILES = 2` tiles approaching a clearing node → widens to 3 there (directive §5 transition effect).
- Do NOT raise `LANE_HALF_WIDTH` for primary to 1 — it triples tile count via Minkowski expansion and makes pruning nearly impossible for tightly-budgeted chapters.

### Node spacing
- `hexSpacing(edge)`: primary ≈ 0.40 × laneLength, secondary ≈ 0.50 × laneLength, floor 2.
- This keeps the generated tile count within reach of the target before adjustment.

### hexLine zero-distance
- `hexLine(a, a)` returns `[{q:a.q, r:a.r}]` (1 tile), NOT 2.
- The old `Math.max(1, hexDist)` bug returned 2 tiles for the same-point case.

### Tile count adjustment
**Under target** → `expandToTarget`: greedy BFS expansion, always picks the frontier candidate with the most existing neighbours (compactness-first).

**Over target** → `pruneToTarget`: two-pass leaf stripping (safe, O(N)):
1. Remove degree-0/1 non-protected tiles.
2. Remove degree-2 tiles whose two neighbours are directly adjacent (triangle check — removal is always safe).
3. Fallback: single-tile connectivity-checked removal for residual excess.
Never uses a full BFS-per-candidate in the main passes — that was the original O(N²) bug.

### Clearing count guarantee
- Formula: `clamp(round(N/10), 5, 12)`.
- Clearing-eligible nodes: all types in `NODE_TO_CLEARING_TYPE` (START, JUNCTION, CLEARING, LANDMARK, FINAL_APPROACH).
- If still under 5 after these, GATE node is added as a `SIDE_CLEARING`.

### Protected tiles
During pruning, these are never removed:
- `startCell` (PathwayGraph.startNodeId position)
- `gateCell` (PathwayGraph.gateNodeId position)
- All clearing centre coords

## Test file
`frontend/tests/journey_map_hex_layout.test.ts` — 59 tests across 15 sections.
All prior suites (config 272, templates 297, blueprint 588, dna 306, pathway_graph 550) remain green.
