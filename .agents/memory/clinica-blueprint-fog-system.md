---
name: Blueprint fog system (Blueprint Push)
description: Dual-layer blueprint-to-developed fog-of-war renderer for blueprint-chapter maps.
---

## Architecture

Two new canvas components replace the plain background Image for `isBlueprintChapter` chapters:

| Layer | Component | z-index | Always visible? |
|-------|-----------|---------|-----------------|
| 0 | `BlueprintHexLayer` | `JOURNEY_Z.BACKGROUND (0)` | Yes — full world |
| 1 | `EnvironmentRevealLayer` | `JOURNEY_Z.ENV_REVEAL (1)` | Only in explored/visible tiles |
| 5200 | `FogOfWarLayer` | unchanged | Full world, semi-transparent |

**Why:** Dark nav blueprint shows through semi-transparent fog in unexplored areas. Environment painting progressively appears via `destination-in` masking where tiles are explored/visible.

## Activation gate

`HexMapLayer` receives `isBlueprintChapter?: boolean` from fog-map.tsx:
```
isBlueprintChapter={chapterVisuals.isBlueprintBacked === true}
```
`chapterVisuals.isBlueprintBacked` is true for all chapters in `BLUEPRINT_PIPELINE_CHAPTERS`.

**Debug fixture mode** (`?debug=N`): uses `DEV_FALLBACK_VISUALS` which lacks `isBlueprintBacked`. So debug mode always shows the standard path → white background (no environment image in fixture). This is expected — not a bug.

## Fog opacity change (fogOfWar.ts)

`FOUNDATION_COLOR` changed: `rgba(55,72,86,0.82)` → `rgba(12,22,48,0.64)`
- Darker navy (not warm grey) so blueprint linework shows through as dark architectural ghost
- Reduced from 82 % → 64 % opacity: ~18 % of blueprint visible in unexplored areas
- This is GLOBAL — affects all chapters. For non-blueprint chapters the environment painting shows through at ~36 %, which is acceptable.

**How to apply:** If non-blueprint chapters look too washed out, raise FOUNDATION_COLOR alpha back toward 0.75–0.80. If blueprint chapters don't show enough linework, lower it further toward 0.55.

## EnvironmentRevealLayer

- Canvas component; web-only (returns null on native)
- Loads environment image via `expo-asset Asset.fromModule()` (handles `require()` number sources) or direct `{uri}` string extraction
- Image cached in module-level Map keyed by URI (avoids re-download on re-renders)
- `destination-in` masking: offscreen canvas with radial gradient circles per explored/visible tile → clips environment to revealed areas
- Explored tiles: radius `1.08 × sz`, peak alpha `0.72`
- Visible-now tiles: radius `1.38 × sz × fovScale`, peak alpha `0.96`
- Redraws only when cache key changes (`buildFogMaskCacheKey` + source URI)

## BlueprintHexLayer

- Canvas component; web-only
- Graph-paper grid lines at 13 px spacing (very faint blue-white)
- Hex outlines with zone-specific stroke colours (clearing brightest, transition faintest)
- Start tile: teal cross + circle; gate tile: purple diamond annotation
- World frame with corner tick marks

## Sprite slimming (Blueprint Push)

```
CHR_W_RATIO  1.15 → 0.90   (slimmer)
CHR_H_RATIO  1.15 → 0.95   (tall slender proportions)
CHR_Y_SHIFT  0.38 → 0.18   (CHR_H_RATIO − 0.77 invariant maintained)
CHR_GLOW_CY  0.65 → 0.675  (tracks new feet position 0.675 × sz)
```

**Why:** Second variation of exploration sprite was approved — smaller, slimmer chibi silhouette reads as lighter against blueprint environment.

## journeyZ.ts

`ENV_REVEAL: 1` added between `BACKGROUND: 0` and `TERRAIN_BASE: 100`.

## New files

- `frontend/src/components/journey/BlueprintHexLayer.tsx`
- `frontend/src/components/journey/EnvironmentRevealLayer.tsx`
