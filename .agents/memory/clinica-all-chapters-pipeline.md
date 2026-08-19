---
name: All-chapters blueprint pipeline
description: BLUEPRINT_PIPELINE_CHAPTERS extended to Ch1-10; corridor leak root cause and fix; Stage 3 art registration pattern.
---

# All-chapters blueprint pipeline

## The rule
`BLUEPRINT_PIPELINE_CHAPTERS` (config.ts) now contains `{1,2,3,4,5,6,7,8,9,10}`. Every Book 1 chapter runs the three-stage pipeline. When adding chapters beyond 10, add them to this set only after their topology family has a builder in `chapterPathwayGraph.ts`.

**Why:** All 10 topology-family builders exist; all pipeline stages (hexLayout, sceneryLayout, backgroundSpec, canonicalMapArtifact) are generic. Restricting to just Ch1 was a migration gate, not a design constraint.

## Stage 3 selection contract
The Ch1 bright sci-fi corridor issue came from a mismatch between the manifest and the registry: the manifest declared the painterly `map-platform-background-ch1-{shift}.png` assets, while the hash registry and Ch1 base fallbacks selected unrelated `*-blueprint-v4.png` hospital interiors.

**Rule:** A pipeline chapter may reveal an environment only when one exact `chapter:shift:blueprintHash` registry entry exists and its declared asset path equals `manifest.rasterAsset`. The registry must not choose an arbitrary older asset for the same chapter/shift.

**Why:** The logical geometry validator confirms the walkable/scenery specification, not the identity or visual alignment of the PNG actually rendered. A hash-agnostic fallback can therefore make diagnostics report “validated” while showing obsolete art.

**How to apply:** Register the approved painterly Ch1 day/evening/night assets under both currently supported runtime hashes. Keep the Ch1 base shift values on those same assets, and leave `environmentBackground` undefined when Stage 3 is missing or mismatched so the blueprint foundation remains visible.

## Stage 3 registration pattern
To complete Stage 3 for a chapter:
1. Get the chapter's blueprint hash from the DevDiagnostics panel → "STAGE 3 — FINISHED BACKGROUND" section.
2. Generate illustrated background from `bgManifest.aiPrompt` for each shift (day/evening/night).
3. Place PNGs at the asset path declared by the manifest.
4. Add exact entries to `BLUEPRINT_RASTER_REGISTRY` in `chapterMapVisuals.ts` (key = `'{N}:{shift}:{hash}'`) whose `assetPath` equals `manifest.rasterAsset`.
5. Update `ASSET_REGISTRY[N]` in `backgroundAuthoringManifest.ts` to `{ day: 'validated', evening: 'validated', night: 'validated' }`.

Until Step 3-5 are done for a chapter, the map correctly shows blueprint foundation (dark navy + linework) in unexplored tiles and nothing in explored tiles.

## Three-stage diagnostic
DevDiagnostics in fog-map.tsx shows:
- STAGE 1 — STRUCTURE BLUEPRINT: ✓ GEOMETRY LOCKED (hash, version, cell count, clearings, obstacle check)
- STAGE 2 — WALKABLE HEX PATH: ✓ VALIDATED (playable tiles, zones, connectivity, no hex-obstacle intersections, geo hash match)
- STAGE 3 — FINISHED BACKGROUND: ✓ ALIGNED / ⚠ PENDING / ✗ FAIL (selected raster path, manifest path, exact registry key, and match result)

**How to apply:** Any time you're debugging a chapter map visual or adding new chapter art, check the three-stage panel first to identify which stage is incomplete.
