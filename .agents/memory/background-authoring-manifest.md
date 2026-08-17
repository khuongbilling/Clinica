---
name: Background authoring manifest (Push 4)
description: BackgroundAuthoringManifest design — bridges blueprint geometry to raster art assets; no circular imports with canonicalMapArtifact; Ch1 all three shifts registered 'generated'.
---

## What this covers
The `backgroundAuthoringManifest.ts` module introduced in Production Bridge Push 4.

## Key design decisions

**No circular imports:**
`backgroundAuthoringManifest.ts` imports the pipeline modules directly (getChapterHexLayout, getChapterSceneryLayout, getChapterBackgroundSpec) plus MAP_LAYOUT_VERSION from canonicalMapArtifact — but NOT the artifact builder itself. `canonicalMapArtifact.ts` imports `getBackgroundAuthoringManifests` from the manifest module. This keeps the dependency arrow one-way.

**ASSET_REGISTRY is a manual declaration:**
```typescript
const ASSET_REGISTRY: Partial<Record<number, Record<TimeOfDay, ManifestAssetStatus>>> = {
  1: { day: 'generated', evening: 'generated', night: 'generated' },
};
```
Developers manually set assetStatus to 'generated' only after the raster file exists at targetAssetPath AND is registered in chapterMapVisuals.ts. Never auto-detect from filesystem at runtime.

**assetVersion formula:**
- pending → `'BACKGROUND_ASSET_REQUIRED'`
- generated/approved → `'${MAP_LAYOUT_VERSION}:${blueprintHash}'`

**isChapterBackgroundSynced:**
Returns true when ALL three shifts are non-pending AND their assetVersion matches the CURRENT `${MAP_LAYOUT_VERSION}:${hash}`. Since assetVersion is computed from the current artifact hash, this always returns true for 'generated' shifts unless MAP_LAYOUT_VERSION or the hex geometry changes.

**Blueprint hash computation:**
Identical formula to `canonicalMapArtifact.ts` — `fnv1a32(layout.seed:MAP_LAYOUT_VERSION:sortedTileKeys)` — so hashes always agree without calling the artifact builder.

## Files touched (Push 4)
- NEW: `backgroundAuthoringManifest.ts`
- MODIFIED: `chapterBackgroundSpec.ts` — added `buildSpatialContext()` + `describeQuadrant()`, new `spatialContext` param in `buildAiPrompt`
- MODIFIED: `canonicalMapArtifact.ts` — added `backgroundManifests` field + import
- MODIFIED: `chapterMapVisuals.ts` — added `CH1_NIGHT_BG` require; Ch1 night now uses dedicated PNG
- MODIFIED: `fog-map.tsx` — DevDiagnostics shows per-shift manifest status instead of static ⚠
- NEW: `tests/journey_map_background_manifest.test.ts` — 51 tests
- NEW asset: `assets/ui/journey/map/map-platform-background-ch1-night.png`

**Why:**
The static "⚠ BACKGROUND NOT YET SYNCED TO BLUEPRINT" warning needed a real data structure behind it — not just removal. The manifest provides a versioned, auditable bridge between geometry (blueprint hash) and art (raster file), with lifecycle status per shift.
