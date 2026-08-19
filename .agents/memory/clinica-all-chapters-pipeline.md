---
name: All-chapters blueprint pipeline
description: BLUEPRINT_PIPELINE_CHAPTERS extended to Ch1-10; corridor leak root cause and fix; Stage 3 art registration pattern.
---

# All-chapters blueprint pipeline

## The rule
`BLUEPRINT_PIPELINE_CHAPTERS` (config.ts) now contains `{1,2,3,4,5,6,7,8,9,10}`. Every Book 1 chapter runs the three-stage pipeline. When adding chapters beyond 10, add them to this set only after their topology family has a builder in `chapterPathwayGraph.ts`.

**Why:** All 10 topology-family builders exist; all pipeline stages (hexLayout, sceneryLayout, backgroundSpec, canonicalMapArtifact) are generic. Restricting to just Ch1 was a migration gate, not a design constraint.

## Corridor-leak root cause (fixed)
`CHAPTER_SHIFT_VISUALS[1].*.background` was the old `CH1_*_BG` corridor PNG. The `blueprintBackgroundMissing: true` return path spread `base` unchanged, so `environmentBackground.source` = corridor. Fixed by:
1. Changing all three Ch1 `base.background` values to the v4 blueprint rasters (`CH1_*_BG_BLUEPRINT_V4`).
2. Suppressing `environmentBackground` in fog-map.tsx when `blueprintBackgroundMissing: true` (pass `undefined` — the prop is optional).

## Stage 3 registration pattern
To complete Stage 3 for a chapter:
1. Get the chapter's blueprint hash from the DevDiagnostics panel → "STAGE 3 — FINISHED BACKGROUND" section.
2. Generate illustrated background from `bgManifest.aiPrompt` for each shift (day/evening/night).
3. Place PNGs at `frontend/assets/ui/journey/map/map-platform-background-ch{N}-{shift}-blueprint-v{V}.png`.
4. Add entries to `BLUEPRINT_RASTER_REGISTRY` in `chapterMapVisuals.ts` (key = `'{N}:{shift}:{hash}'`).
5. Update `ASSET_REGISTRY[N]` in `backgroundAuthoringManifest.ts` to `{ day: 'validated', evening: 'validated', night: 'validated' }`.

Until Step 3-5 are done for a chapter, the map correctly shows blueprint foundation (dark navy + linework) in unexplored tiles and nothing in explored tiles.

## Three-stage diagnostic
DevDiagnostics in fog-map.tsx shows:
- STAGE 1 — STRUCTURE BLUEPRINT: ✓ GEOMETRY LOCKED (hash, version, cell count, clearings, obstacle check)
- STAGE 2 — WALKABLE HEX PATH: ✓ VALIDATED (playable tiles, zones, connectivity, no hex-obstacle intersections, geo hash match)
- STAGE 3 — FINISHED BACKGROUND: ✓ ALIGNED / ⚠ PENDING / ✗ FAIL (per-shift asset status, hash-in-registry check)

**How to apply:** Any time you're debugging a chapter map visual or adding new chapter art, check the three-stage panel first to identify which stage is incomplete.
