---
name: Fog-map Push 5A — blueprint-matched raster generation and loading
description: How BLUEPRINT_RASTER_REGISTRY wires versioned rasters to the renderer; blueprintBackgroundMissing flag; asset naming convention; generation lessons.
---

## What this covers
Production Bridge Push 5A: generating and loading the actual Ch1 day blueprint background.

## BLUEPRINT_RASTER_REGISTRY pattern (chapterMapVisuals.ts)

Metro bundler requires STATIC `require()` calls — asset paths cannot be built from runtime strings. The registry solves this:

```ts
const CH1_DAY_BG_BLUEPRINT_V1 = require(
  '@/assets/ui/journey/map/map-platform-background-ch1-day-blueprint-v1.png',
) as number;

const BLUEPRINT_RASTER_REGISTRY: Record<string, number> = {
  '1:day:6439241b': CH1_DAY_BG_BLUEPRINT_V1,
};
```

Key format: `'chapter:shift:blueprintHash'` — embedding the exact hash means a geometry change auto-invalidates the registry entry, and DevDiagnostics shows "⚠ BLUEPRINT BACKGROUND MISSING" rather than silently serving stale art.

## getChapterMapVisuals lookup order (Push 5A)

1. Compute `registryKey = chapter:shift:hash`
2. If key in BLUEPRINT_RASTER_REGISTRY → use that raster, strip alignment offsets, `blueprintBackgroundMissing: false`
3. If NOT in registry → keep `base.background` (legacy fallback), set `blueprintBackgroundMissing: true`
4. DevDiagnostics shows "⚠ BLUEPRINT BACKGROUND MISSING / Chapter / hash / LEGACY COURTYARD" when flag is true

**Why:** The manifest has no Metro asset reference — it only stores string paths and status flags. The registry is the only place that can hold a Metro asset number (require() integer) for a blueprint-versioned file.

## Versioned asset naming convention

Format: `map-platform-background-ch{N}-{shift}-blueprint-v{M}.png`

- Versioned name (`-blueprint-v1`) preserves the old static PNG (`-ch1-day.png`) as a rollback target
- Old file is still required by the CHAPTER_SHIFT_VISUALS static registry — do NOT delete it
- When a new hash requires new art, increment M (e.g. `-blueprint-v2.png`) and add a new registry key

## Ch1 day blueprint hash
`6439241b` (MAP_LAYOUT_VERSION v1)

## Image generation lessons

- The spec's AI prompt is correct and usable — extract via `getBackgroundAuthoringManifest(1, 'day').aiPrompt`
- AI generators tend to bake in text labels even with "no text" in the negative prompt — add "NO TEXT NO LABELS NO WORDS NO LETTERS NO ANNOTATIONS" prominently in the positive prompt, not just the negative
- Some clearing interiors still get U-shaped courtyard garden features — acceptable for v1 since hex tiles overlay them; add explicit "COMPLETELY BARE OPEN STONE FLOOR at its centre" per clearing
- V1 had baked text labels → regenerated as V2; V2 accepted (no text, horizontal west-east campus, open paved corridors clearly visible)
- Use `resolution: 'high'` for production map backgrounds

## Current registry state (Push 6 complete)
| Key | File | Status |
|-----|------|--------|
| 1:day:6439241b | map-platform-background-ch1-day-blueprint-v1.png | registered |
| 1:evening:6439241b | map-platform-background-ch1-evening-blueprint-v1.png | registered |
| 1:night:6439241b | map-platform-background-ch1-night-blueprint-v1.png | registered |

All three Ch1 shifts generated from Push 6 bed-aware prompts (walkableBedGenerator.ts).
Day/Evening/Night share the SAME blueprint hash — geometry is shift-invariant.
