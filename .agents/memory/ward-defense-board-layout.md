---
name: Ward Defense board layout
description: How the battle board is rendered — the illustrated reference image IS the background, with transparent gameplay overlays mapped onto its drawn features. Board must be aspect-locked to the image's EXACT native pixel ratio.
---

## CRITICAL — the illustrated map IS the background
The board is NOT drawn with React Native components. The approved illustrated
asset is rendered as the literal battle-map background:
`frontend/assets/ward-defense/lotus-healing-ward-map-portrait.png`.
Gameplay elements (enemy lane, deploy pads, sprites) are transparent overlays
whose fractional coordinates map onto features drawn INSIDE the image.
**Why:** user explicitly rejected any CSS/RN-drawn scene. The Disease Gate,
Vital Lantern, perimeter walkway loop, and 9 glowing pedestals (3×3 grid) all
live in the image. (Filename still says "portrait" but the art is now square —
kept unchanged so every `require()` stays valid.)
- Use `expo-image` (ExpoImage), NOT RN `Image`. Use `boxShadow`, not `shadow*`.
- `frontend/public/` assets 404 on Expo web — `require()` is mandatory, not a URL.
- The PNG is large: the first screenshot right after a restart shows a blank
  board (decode lag). ALWAYS re-screenshot before assuming breakage.

## CRITICAL — aspect-lock the board to the image's EXACT native ratio
For overlay fractions to sit EXACTLY on drawn features with zero crop, the board
size MUST match the image's real pixel ratio. Current implementation measures the
available area (onLayout) and fits the whole image inside it, preserving aspect:
```
const scale = Math.min(availW / 1024, availH / 1024);
const W = 1024 * scale, H = 1024 * scale;   // board == image ratio → no crop
<ExpoImage source={IMG_MAP} style={StyleSheet.absoluteFillObject} contentFit=... />
```
The current map is **square 1024×1024 (1:1)**. (It was previously portrait
768×1408 = 6:11; the model refused to produce a clean 3×3 in a 3:4 canvas and
kept adding a 4th row, so the art was regenerated at 1:1 to get a true 3×3.)
**Why:** if the board ratio != image ratio, `cover` crops and overlays drift off
the drawn features — user reported "totally off". Matching board size to the
image ratio guarantees alignment with zero crop.
**How to apply:** if you swap the map image, read the NEW PNG's pixel dimensions
and update BOTH divisors in the `scale` calc (and W/H) to that width/height,
then re-verify overlays.

## Measure overlay coordinates from pixels, not by eye
DEPLOY_TILES were derived by decoding the PNG with `pngjs` in code_execution,
collecting the bright-cyan pedestal-glow pixels, and clustering to centroids.
**Gotcha:** plain k-means on the raw glow gets pulled toward the cyan X-shaped
connectors between pedestals, skewing centroids inward. Fix = integral-image
EROSION first (keep only dense disc cores where a ~14px window is >72% glow),
which drops the thin connector lines, THEN cluster + regularize to a clean grid.
Always overlay the result back onto the art (draw dots on a PNG copy and view)
before committing. Far more reliable than eyeballing a screenshot.
Current values (fractions of board w/h, 3×3 grid): columns 0.377 / 0.500 /
0.623; rows 0.380 / 0.490 / 0.600. DEPLOY_TILES is row-major (9 tiles). PATH_WPS
traces the perimeter walkway loop (gate top-left → down left → across bottom
~0.86 → up right → lantern top-right), 15 waypoints.

## Both files must stay in sync (drift hazard)
PATH_WPS + DEPLOY_TILES are duplicated: exported consts in `ward-defense-v2.tsx`
(render/gameplay) and local consts in `ward-defense.tsx`. They MUST be identical.
StonePad tap targets (9 of them) and HeroOnPad sprites both center on the tile
fraction (`left: cx - size/2`). Merge logic is unit-type based (findMergePair by
tileIndex), NOT grid adjacency, so changing the tile count/layout is safe.

## Enemy locomotion + game-speed toggle
Enemies walk OR float by type via an `ENEMY_LOCO` map: `EnemyOnPath` owns a
per-enemy `Animated.loop` (walk = hop+squash; float = drift+scale), NOT a shared
`bobY` prop (that was removed). Loops use `useNativeDriver:false` (JS thread) —
fine at current wave sizes, but watch for jank if enemy counts scale up.
2× speed toggle: `speedMul` state, tick interval = `TICK_MS / speedMul` with the
interval effect keyed on `[speedMul]`; game state is read via `gsRef.current` so
there's no stale-closure risk. HUD button replaced the old dead settings gear.

## Dev testing note
To reach the board past the lobby, temporarily add
`if (gs.phase==="lobby") { startGame(); return null; }` above the real lobby
return in `ward-defense.tsx`. ALWAYS revert this before finishing.
