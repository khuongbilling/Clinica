---
name: Fog-map blueprint raster registry
description: How blueprint-pipeline background art is registered, keyed, and served at runtime; circular-require root cause and fix.
---

## Blueprint raster registry

`BLUEPRINT_RASTER_REGISTRY` in `chapterMapVisuals.ts` maps `chapter:shift:blueprintHash` → static Metro `require()` asset.

`getChapterMapVisuals` looks up the key via `getBackgroundAuthoringManifest(chapter, shift).mapBlueprintHash`.
- Match → serve blueprint art, strip alignment offsets, `isBlueprintBacked: true`.
- Miss → `blueprintBackgroundMissing: true` + legacy fallback → DevDiagnostics shows red banner.

## Circular require — critical lesson (Push 6 post-mortem)

**Symptom:** Registry always missed at Metro runtime → legacy ceremony webp served regardless of hash.

**Root cause:** `canonicalMapArtifact.ts` imports `getBackgroundAuthoringManifests` from `backgroundAuthoringManifest.ts`; `backgroundAuthoringManifest.ts` imported `MAP_LAYOUT_VERSION` from `canonicalMapArtifact.ts`. Metro's CommonJS cycle left `MAP_LAYOUT_VERSION` undefined when `backgroundAuthoringManifest.ts` initialised → `computeBlueprintHash` hashed `undefined:v1:…` → wrong hash → key never matched.

**Fix:** Extracted `MAP_LAYOUT_VERSION` to a leaf file `journeyMapVersion.ts` (no imports from either module). `canonicalMapArtifact.ts` imports + re-exports it; `backgroundAuthoringManifest.ts` imports from `journeyMapVersion.ts` directly. Cycle eliminated.

**Rule:** Never put a constant that `backgroundAuthoringManifest.ts` needs inside any module that `backgroundAuthoringManifest.ts` is imported by. Use `journeyMapVersion.ts` as the canonical home.

## Current registry state (Push 6 complete)
| Key | File | Status |
|-----|------|--------|
| 1:day:6439241b | map-platform-background-ch1-day-blueprint-v1.png | registered |
| 1:evening:6439241b | map-platform-background-ch1-evening-blueprint-v1.png | registered |
| 1:night:6439241b | map-platform-background-ch1-night-blueprint-v1.png | registered |

All three Ch1 shifts generated from Push 6 bed-aware prompts (walkableBedGenerator.ts).
Day/Evening/Night share the SAME blueprint hash — geometry is shift-invariant.

Blueprint hash for Ch1 (MAP_LAYOUT_VERSION v1): **6439241b**
