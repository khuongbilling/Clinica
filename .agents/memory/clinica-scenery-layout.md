---
name: Scenery Layout Pipeline (Push 6)
description: getChapterSceneryLayout — derives environmental scenery zones from non-walkable negative space around the HexLaneLayout footprint.
---

## Rule
**Walkable space is sacred.** No scenery zone cell may appear in the walkable safety mask. This is a hard invariant: `sceneryCell ∩ walkableSafetyMask === ∅`.

**Why:** Scenery is rendered over the map background. Any scenery tile that lands on a walkable hex visually blocks the player's path or an encounter clearing.

## How to apply
- File: `frontend/src/game/journeyMap/chapterSceneryLayout.ts`
- Public API: `getChapterSceneryLayout(ch)` (cached), `getChapterSceneryLayoutRange(from, to)`
- Utilities: `computeWalkableSafetyMask(layout)`, `computeWorldBounds(safetyMask)`, `deriveEnvironmentalDensity(dna)`
- Pipeline: HexLaneLayout + ChapterMapDNA → `buildSceneryLayout` → `SceneryLayout`

## Algorithm
1. **Walkable safety mask** = all walkable cells ∪ their immediate hex-neighbours (1-ring border)
2. **World bounds** = safety-mask axial bbox + WORLD_MARGIN (4 tiles) on all sides
3. **Candidate tiles** = all axial tiles in world bounds − safety mask
4. **BFS cluster** candidates into hex-connected components
5. Filter clusters smaller than MIN_CLUSTER_SIZE (2)
6. Compute per-cluster metrics: walkableContactCount, isEnclosed (>50% border = walkable), nearestClearingDist
7. **Zone type assignment**: nearClearingDist≤2 → OBSERVATION_DECK/DECORATIVE_LANDMARK; isEnclosed → ARCHITECTURE/GARDEN; area≥8 → BUILDING_WING/SIMULATION_STRUCTURE; otherwise PLANTER/WATER_FEATURE/etc. + 30% DNA obstaclePattern bias
8. **Density filter**: rank by score (contact×1.5 + enclosed?4 + clearingProx + area×0.6); keep top DENSITY_KEEP[density]%; guarantee ≥ MIN_ZONES (2)
9. Return SceneryLayout

## Density derivation (deriveEnvironmentalDensity)
- Ch 1–3 → always LOW (University early chapters)
- obstaclePattern 'none' → LOW
- obstaclePattern 'islands' → LOW (ch≤6) or MEDIUM
- obstaclePattern 'walls' → MEDIUM
- obstaclePattern 'blocks' → MEDIUM (ch<8) or HIGH
- obstaclePattern 'mixed' → HIGH

## Test file
`frontend/tests/journey_map_scenery_layout.test.ts` — 51 tests across 13 sections.
All prior suites (config 272, templates 297, blueprint 588, dna 306, pathway_graph 550, hex_layout 59) remain green.
Total tests as of Push 6: 2,123 passed, 0 failed.
