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

## Fix pass (post-audit) + hash-agnostic registry fix

Six gaps patched across two fix passes — see details below in each section.

### Hash-agnostic registry fallback (critical — applied after audit)

**Root cause of "corridor background" on mobile web:**
`BLUEPRINT_RASTER_REGISTRY` uses exact `chapter:shift:hash` keys. When the runtime
blueprint hash is not one of the pre-registered values (`6439241b` or `01dd9c64`),
`blueprintRaster` is `null`. The `blueprintBackgroundMissing: true` branch then spreads
`...base` which keeps `background = CH1_NIGHT_BG` (legacy corridor art) as the
`environmentBackground.source`. `EnvironmentRevealLayer` then reveals corridor art in
all explored/visible tiles — user describes as "old generic corridor background".

**Fix in `getChapterMapVisuals` (`chapterMapVisuals.ts`):**
After the exact hash lookup fails, scan for any `chapter:shift:*` entry in the registry
as a fallback. Log a `console.warn` in `__DEV__` naming the unregistered hash so it can
be added. Only the truly-no-raster case (no entry at all for that chapter+shift) sets
`blueprintBackgroundMissing: true`.

**Why this is safe:** All Ch1 registered hashes point to the same v4 asset, so a
hash-agnostic fallback is visually identical to an exact match.

## Activation gate

`HexMapLayer` receives `isBlueprintChapter?: boolean` from fog-map.tsx:
```
isBlueprintChapter={chapterVisuals.isBlueprintBacked === true}
```
`chapterVisuals.isBlueprintBacked` is true for all chapters in `BLUEPRINT_PIPELINE_CHAPTERS`.

**Debug fixture mode** (`?debug=N`): uses `DEV_FALLBACK_VISUALS` which lacks `isBlueprintBacked`. So debug mode always shows the standard path → white background (no environment image in fixture). This is expected — not a bug.

## Fog opacity change (fogOfWar.ts)

FOUNDATION_COLOR is no longer a single constant — it is now a per-chapter parameter threaded as:
  `fogOfWar.ts` `FogOfWarParams.foundationColor` → `FogOfWarLayer.tsx` `Props.foundationColor` → `HexMapLayer.tsx` → passed as:
  ```
  foundationColor={isBlueprintChapter ? BLUEPRINT_FOUNDATION_COLOR : STANDARD_FOUNDATION_COLOR}
  ```

Two exported constants in `fogOfWar.ts`:
- `BLUEPRINT_FOUNDATION_COLOR = 'rgba(12, 22, 48, 0.64)'` — dark navy 64 % for blueprint chapters
- `STANDARD_FOUNDATION_COLOR  = 'rgba(55, 72, 86, 0.82)'` — warm blue-grey 82 % for non-blueprint chapters

**Why:** Global opacity reduction incorrectly let Ch2–Ch10 backgrounds show through unexplored fog.

**How to apply:** New chapters always get STANDARD. Add a chapter to BLUEPRINT_PIPELINE_CHAPTERS + it automatically gets BLUEPRINT.

## Debug/fixture support

In `fog-map.tsx`, the debug path (`debugTiles !== null`) now calls `getChapterMapVisuals(chNum, 'night')` for any chapter in `BLUEPRINT_PIPELINE_CHAPTERS`, instead of `DEV_FALLBACK_VISUALS`. This activates the dual-layer system in `?debug=N` sessions without a real run. Non-blueprint chapters still get `DEV_FALLBACK_VISUALS`.

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
