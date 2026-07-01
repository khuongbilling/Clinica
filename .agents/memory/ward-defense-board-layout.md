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
Vital Lantern, walkway loop, and 6 cross pedestals all live in the image.
- Use `expo-image` (ExpoImage), NOT RN `Image`. Use `boxShadow`, not `shadow*`.
- `frontend/public/` assets 404 on Expo web — `require()` is mandatory, not a URL.
- The PNG is large: the first screenshot right after a restart shows a blank
  board (decode lag). ALWAYS re-screenshot before assuming breakage.

## CRITICAL — aspect-lock the board to the image's EXACT native ratio
For overlay fractions to sit EXACTLY on drawn features with zero crop, the board
container MUST be aspect-locked to the image's real pixel ratio, and the image
uses `contentFit="cover"` (cover == contain when ratios match, so no crop/shift):
```
<View style={{flex:1, alignItems:"center", justifyContent:"center", overflow:"hidden"}}>
  <View style={{height:"100%", aspectRatio: 768/1408, maxWidth:"100%", position:"relative", overflow:"hidden"}} onLayout={onLayout}>
    <ExpoImage source={IMG_MAP} style={StyleSheet.absoluteFillObject} contentFit="cover" />
```
**Why:** a `flex:1` board with `cover` and NO aspect-lock crops the image
whenever the board ratio != image ratio (badly on landscape web, subtly on
phones), so overlays drift off the drawn crosses — user reported "totally off".
Aspect-locking to the image ratio fills the portrait screen height with only
negligible side margins AND guarantees alignment. Do NOT guess the ratio: the
portrait map is 768×1408 = 6:11 (≈0.545), NOT 9:16 (0.5625). Read the real PNG
header before setting `aspectRatio`.
**How to apply:** if you swap the map image, re-check its pixel dimensions and
update `aspectRatio` to width/height of the NEW file, then re-verify overlays.

## Measure overlay coordinates from pixels, not by eye
DEPLOY_TILES were derived by decoding the PNG with `pngjs` in code_execution,
collecting the bright-cyan cross-glow pixels, k-means clustering into 6 blobs,
and taking centroid fractions. This is far more reliable than eyeballing a
screenshot (esp. on the cover-cropped landscape web preview).
Current values (fractions of board w/h): columns 0.394 / 0.629; rows 0.350 /
0.493 / 0.626. PATH_WPS traces the U-walkway loop (gate top-left → down left →
across bottom ~0.83 → up right → lantern top-right), 15 waypoints.

## Both files must stay in sync (drift hazard)
PATH_WPS + DEPLOY_TILES are duplicated: exported consts in `ward-defense-v2.tsx`
(render/gameplay) and local consts in `ward-defense.tsx`. They MUST be identical.
StonePad tap targets and HeroOnPad sprites both center on the tile fraction
(`left: cx - size/2`). Merge logic is unit-type based (findMergePair by
tileIndex), NOT grid adjacency, so changing the tile layout is safe.

## Dev testing note
To reach the board past the lobby, temporarily add
`if (gs.phase==="lobby") { startGame(); return null; }` above the real lobby
return in `ward-defense.tsx`. ALWAYS revert this before finishing.
