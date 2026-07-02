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
Vital Lantern, oval walkway loop, and 9 cross pedestals (3×3 grid) all
live in the image (Buddhist-garden portrait design, now 878×1408 after a
surgical widening — see "Widening the map art" below).
- Use `expo-image` (ExpoImage), NOT RN `Image`. Use `boxShadow`, not `shadow*`.
- `frontend/public/` assets 404 on Expo web — `require()` is mandatory, not a URL.
- The PNG is large: the first screenshot right after a restart shows a blank
  board (decode lag). ALWAYS re-screenshot before assuming breakage.

## CRITICAL — aspect-lock the board to the image's EXACT native ratio
For overlay fractions to sit EXACTLY on drawn features with zero crop, the board
size MUST match the image's real pixel ratio. Current implementation measures the
available area (onLayout) and fits the whole image inside it, preserving aspect:
```
const scale = Math.min(availW / 878, availH / 1408);
const W = 878 * scale, H = 1408 * scale;   // board == image ratio → no crop
<ExpoImage source={IMG_MAP} style={StyleSheet.absoluteFillObject} contentFit=... />
```
The current map is **portrait 878×1408**. History: original portrait 768×1408
(6 pedestals) → AI-regenerated square 1024×1024 3×3 (user REJECTED: wanted the
original Buddhist-garden design kept) → original restored from git and widened
programmatically to 878×1408 with a 3rd pedestal column (user approved).
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
Current values (fractions of 878×1408 board, 3×3 grid): columns 0.345 / 0.510 /
0.675; rows 0.350 / 0.493 / 0.626. DEPLOY_TILES is row-major (9 tiles). PATH_WPS
traces the oval walkway loop (gate top-left → down left → across bottom ~0.84 →
up right → lantern top-right), 15 waypoints. Sprites "stand on" a pedestal when
centered on its glowing TOP FACE (fy is top-face center; the dark hex base
drawn below the sprite is correct art, not misalignment).

## Widening the map art programmatically (approved technique)
To fit more pedestal columns WITHOUT changing the drawn design (user demand:
"only add on"), widen the canvas via a center-line insertion, not AI regen:
insert a vertical band (110px) at the pond's center x, filling it by ping-pong
tiling per-row "clean" source windows (plank/sky rows, water rows, dock-rung
rows each get their own feature-free window so fences, pier, and walkway extend
seamlessly), then clone an existing pedestal column patch (with glow, ~14px
feathered alpha) into the inserted region. Update: fit divisors, DEPLOY_TILES
(new width denominators), and PATH_WPS x-fractions (left of cut: px/newW;
right of cut: (px+ins)/newW). Verify with a half-scale preview PNG + dev-seeded
units on all pads. **Why:** AI image generation cannot edit-with-reference here
and regenerating loses the approved design.

## Both files must stay in sync (drift hazard)
PATH_WPS + DEPLOY_TILES are duplicated: exported consts in `ward-defense-v2.tsx`
(render/gameplay) and local consts in `ward-defense.tsx`. They MUST be identical.
StonePad tap targets (9 of them) and HeroOnPad sprites both center on the tile
fraction (`left: cx - size/2`). Merge logic is unit-type based (findMergePair by
tileIndex), NOT grid adjacency, so changing the tile count/layout is safe.

## Full-width scenery via fog "wings" (don't widen the map art itself)
User wanted the map to span the full screen width horizontally WITHOUT cropping
or changing the theme. Solution: keep the square gameplay board untouched and
flank it with two decorative "wing" images inside a flexDirection:"row"
container (wings flex:1, height:H, contentFit:"cover", contentPosition anchored
toward the seam). Wings collapse to 0 on narrow/portrait screens — no mobile
regression — and overlay fractions/fit math stay untouched.
**Wing texture recipe (programmatic, from the map's own art):** measure the
pure-fog edge band first (sample per-column saturation; ~48px on the portrait
map — wider strips leak drawn features into the wing), ping-pong mirror-tile it
outward from the seam (mirror ⇒ pixel-perfect seam continuity), then apply
progressive box blur + darkening past the first tile — raw tiling shows obvious
repeated "totem" blobs; blur turns them into natural mist. Regenerate wings
whenever the map asset changes. Files:
assets/ward-defense/map-wing-left/right.png (384×1408).

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
