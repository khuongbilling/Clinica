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

**Rule:** Stage 1 comes from the checked-in data-only source, never the mutable generated Stage 2 layout. A pipeline chapter may reveal an environment only when Stage 2 passes and one exact `chapter:shift:blueprintHash:structureHash` registry entry exists, its declared asset path equals `manifest.rasterAsset`, and the manifest asset version includes both hashes. `structureHash` covers authored obstacle/scenery zones, start/gate endpoints, and clearing identities as well as the walkable footprint.

**Why:** A snapshot derived from the candidate being validated can self-approve authored drift. A walkable-only hash would still accept art after an endpoint, clearing, or obstacle-only blueprint change; a hash-agnostic fallback can make diagnostics report “validated” while showing obsolete art.

**How to apply:** Update the Stage 1 literal source only as an explicit authored-blueprint revision, then register an approved raster under the resulting full identity. Keep `environmentBackground` undefined when Stage 2 fails or Stage 3 is missing/mismatched so the blueprint foundation remains visible. Pack A/B reference slots are non-rendering until their binaries are reviewed and registered.

## Stage 3 registration pattern
To complete Stage 3 for a chapter:
1. Get the chapter's blueprint and structure hashes from the DevDiagnostics panel → "STAGE 3 — FINISHED BACKGROUND" section.
2. Generate illustrated background from `bgManifest.aiPrompt` for each shift (day/evening/night).
3. Place PNGs at the asset path declared by the manifest.
4. Add exact entries to `BLUEPRINT_RASTER_REGISTRY` in `chapterMapVisuals.ts` (key = `'{N}:{shift}:{blueprintHash}:{structureHash}'`) whose `assetPath` equals `manifest.rasterAsset`.
5. Update `ASSET_REGISTRY[N]` in `backgroundAuthoringManifest.ts` to `{ day: 'validated', evening: 'validated', night: 'validated' }`.

Until Step 3-5 are done for a chapter, the map correctly shows blueprint foundation (dark navy + linework) in unexplored tiles and nothing in explored tiles.

## Cross-platform reveal discipline
Finished art must be revealed only through explored/visible territory on both web and native. Web canvas and native masks share the fog FOV scale; native must use a bounded mask/layer count rather than one full-world image per revealed tile.

**Why:** A platform-specific full-image fallback leaks Stage 3 art into fog, while a per-tile full-image implementation can become expensive once a whole chapter is explored.

## Three-stage diagnostic
DevDiagnostics in fog-map.tsx shows:
- STAGE 1 — STRUCTURE BLUEPRINT: ✓ GEOMETRY LOCKED (hash, version, cell count, clearings, obstacle check)
- STAGE 2 — WALKABLE HEX PATH: ✓ VALIDATED (playable tiles, zones, connectivity, no hex-obstacle intersections, geo hash match)
- STAGE 3 — FINISHED BACKGROUND: ✓ ALIGNED / ⚠ PENDING / ✗ FAIL (selected raster path, manifest path, exact registry key, and match result)

**How to apply:** Any time you're debugging a chapter map visual or adding new chapter art, check the three-stage panel first to identify which stage is incomplete.
