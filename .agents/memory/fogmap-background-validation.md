---
name: Fog-map background composition validation
description: Obstacle-safe background pipeline — scenery classification, geometry validator, manifest status lifecycle, and AI raster generation gotchas.
---

# Background composition validation (obstacle-safe rasters)

**Rule:** blocking-vs-non-blocking scenery classification lives ONLY in
`journeyMap/sceneryClassification.ts` (leaf module, imports types only).
`backgroundValidator.ts` checks blocking zone cells against
`WalkableBed.walkableCellKeys` and is wired into
`getBackgroundAuthoringManifests` — every manifest carries `validationResult`.

**Why:** generated map art kept placing furniture/equipment inside playable
hexes; the safety mask is now enforced as a hard constraint at prompt level
(FORBIDDEN ZONE / SCENERY ZONE paragraphs + per-env COMPOSITION_DISCIPLINE in
chapterBackgroundSpec) AND at geometry level (validator).

**How to apply:**
- `ManifestAssetStatus` raster states ('raster_unvalidated'/'validated'/
  'invalid_overlap') are RE-DERIVED by buildManifest from the validator —
  declaring 'validated' in ASSET_REGISTRY is a statement that a raster exists,
  not a bypass. `isChapterBackgroundSynced` requires 'validated' on all shifts.
- ARCHITECTURE is classified blocking (physical building mass), alongside the
  7 obvious types; only PLANTER and DECORATIVE_LANDMARK are non-blocking.
- DEV footprint overlay: `devOverlay.footprint` + `footprintOverlay` prop on
  HexMapLayer (green=bed, red=blocking cells, magenta=validator violations);
  blocking cells lie OUTSIDE the tile list so all passes render from axial
  coords via `coords.axialToWorld`.

## AI raster generation gotchas
- generateImage can emit a CONTACT SHEET (main image + variant thumbnails)
  for complex map prompts — always visually inspect; fix by adding hard
  negatives "collage, multi-panel, image grid, contact sheet, variant
  thumbnails" + "ONE SINGLE continuous full-bleed painting edge to edge".
- generateImage does NOT overwrite an existing outputPath — it appends `_2`;
  check the returned filePath and `mv` over the target.

## Pre-existing test-chain break (as of Aug 2026)
`npm run test` aborts at journey_map_encounters (generateHexTopology chapter=31
"no valid map after 60 retries"); journey_map_create_run (6 fail) and
journey_map_templates (42 fail) also fail — all reproduce on clean HEAD,
verified via `git worktree add /tmp/... HEAD` + symlinked node_modules.
