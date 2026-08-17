---
name: Fog-map Push 5 — blueprint-backed background render
description: How getChapterMapVisuals routes blueprint chapters through the manifest; alignment removal; MAP BLUEPRINT overlay; hash mismatch detection.
---

## What this covers
Production Bridge Push 5: blueprint-backed background rendering.

## Key decisions

**getChapterMapVisuals enrichment (chapterMapVisuals.ts):**
For BLUEPRINT_PIPELINE_CHAPTERS, `getChapterMapVisuals(chapter, shift)` now:
1. Calls `getBackgroundAuthoringManifest(chapter, shift)` to get the manifest.
2. Returns `{...base, blueprintHash, blueprintLayoutVersion, isBlueprintBacked:true, backgroundScale:undefined, backgroundOffsetX:undefined, backgroundOffsetY:undefined}`.
3. Falls back to the static registry entry if the manifest throws.

The manual alignment values (1.60 scale, -64/-112 offset) that were hand-tuned for Ch1 are removed for all blueprint chapters — the generated raster fills worldW × worldH via `contentFit="cover"` without compensation.

**zoneType on HexMapTile (fixture.ts + fog-map.tsx):**
`HexMapTile.zoneType?` added to `fixture.ts` interface.
`toHexMapTile()` in fog-map.tsx threads `t.zoneType` through.
This is the only way HexMapLayer can render the MAP BLUEPRINT overlay without knowing about JourneyTile directly.

**MAP BLUEPRINT debug overlay (HexMapLayer.tsx):**
Added `mapBlueprint?: boolean` to `HexMapDevOverlay`.
Two new optional props on HexMapLayerProps:
- `startTileId?: string` — GOLD tint on origin tile
- `blueprintSceneryZones?: readonly { q, r }[]` — RED dots at exclusion zone centroids

Overlay renders at `JOURNEY_Z.DEV_OVERLAY - 1` (below text overlays) for zone tiles, `DEV_OVERLAY` for scenery dots.
Color map: lane=GREEN, clearing=CYAN, transition=AMBER, start=GOLD, gate=PURPLE, unlabelled=grey, scenery=RED.

**Hash mismatch banner (fog-map.tsx DevDiagnostics):**
Compares `run.mapBlueprintHash` vs `pipelineArtifact.blueprintHash`.
Non-empty run hash guard (legacy runs use '' as hash, must not false-alarm).
Shows red banner: "⚠ BACKGROUND / BLUEPRINT MISMATCH" with first-10-chars of each hash.

**blueprintSceneryZones in main component (fog-map.tsx):**
useMemo computes zone centroids from `getCanonicalChapterMapArtifact(chNum).sceneryLayout.sceneryZones.map(z => z.centroid)` — DEV-only, undefined in production.
Passed to HexMapLayer as `blueprintSceneryZones={__DEV__ ? blueprintSceneryZones : undefined}`.

**Why:**
Manual alignment (backgroundScale/Offset) was tuned against the OLD courtyard painting. Blueprint-generated backgrounds are designed to map to world coordinates, so alignment compensation adds visual distortion rather than fixing it. The overlay lets balancers verify zone geometry against the new art immediately.
