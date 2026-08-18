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

## Current registry state (v2 — Medical Simulation Theatre)
| Key | File | Status |
|-----|------|--------|
| 1:day:6439241b | map-platform-background-ch1-day-blueprint-v2.png | registered |
| 1:evening:6439241b | map-platform-background-ch1-evening-blueprint-v2.png | registered |
| 1:night:6439241b | map-platform-background-ch1-night-blueprint-v2.png | registered |

v1 (courtyard) retired — user rejected it. v2 = indoor clinical simulation theatre.
Clinical white tile floor, teal hex-grid indicators, medical equipment in negative space only.
Night shift: neon teal corridors, red sealed blast-door gate.
Day/Evening/Night share the SAME blueprint hash — geometry is shift-invariant.

**Rule for future Ch1 regenerations:** user explicitly does NOT want an outdoor courtyard.
Environment must be INDOOR clinical/simulation. Keep the bed geometry intact, change only lighting.

Blueprint hash for Ch1 (MAP_LAYOUT_VERSION v1): **6439241b**
