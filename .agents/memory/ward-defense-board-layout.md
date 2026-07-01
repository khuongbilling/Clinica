---
name: Ward Defense board layout
description: How the battle board is rendered — the illustrated reference image IS the background, with transparent gameplay overlays mapped onto its drawn features.
---

## CRITICAL — the illustrated map IS the background
The board is NOT drawn with React Native components. The approved illustrated
asset is rendered as the literal battle-map background:
`frontend/assets/ward-defense/lotus-healing-ward-map-portrait.png` (portrait 9:16 AI-generated).
```
IMG_MAP = require("../assets/ward-defense/lotus-healing-ward-map-portrait.png")
// Board fills ALL available space — no aspect-ratio constraint:
<View style={{flex:1, position:"relative", overflow:"hidden"}} onLayout={onLayout}>
  <ExpoImage source={IMG_MAP} style={StyleSheet.absoluteFillObject} contentFit="cover" />
```
**Why no aspect-ratio lock:** the new image is portrait (9:16), designed to fill
the mobile board area. `contentFit="cover"` handles any minor ratio mismatch
with minimal cropping. Overlay fractions (PATH_WPS / DEPLOY_TILES) map onto the
onLayout-measured board size, so they work regardless of exact screen dimensions.
Do NOT add `maxWidth` to `s.ward` in ward-defense.tsx — that re-creates the black-bars problem.
The old landscape 1536×1024 image (lotus-healing-ward-map.png) is kept as a backup but is no longer used.
**Why:** user explicitly rejected the CSS/RN-drawn scene ("The reference map was
not used"). The drawn Disease Gate, Vital Lantern, stone walkway, and 6 blue
cross-platforms all live INSIDE the image. Gameplay elements are transparent
overlays whose coordinates map onto image features.
- Use `expo-image` (ExpoImage), NOT RN `Image`.
- `frontend/public/` assets 404 on Expo web — `require()` is mandatory, not a URL.
- The PNG is ~3.5MB: screenshots taken right after load show a blank board +
  glow rings before the image decodes. Re-screenshot to confirm before assuming breakage.

## Overlay coordinates (fractions of board w/h; MUST be identical in ward-defense.tsx AND ward-defense-v2.tsx)
PATH_WPS — enemy route tracing the drawn walkway (Disease Gate upper-left → down
left → around bottom → up right → Vital Lantern upper-right):
```
[0.15,0.22][0.19,0.30][0.22,0.42][0.24,0.56][0.28,0.68][0.37,0.78][0.50,0.82]
[0.63,0.78][0.72,0.68][0.77,0.56][0.79,0.42][0.82,0.30][0.86,0.22]
```
DEPLOY_TILES — 6 pads centered on the drawn blue crosses:
```
[0.360,0.460][0.510,0.460][0.655,0.460]
[0.360,0.655][0.510,0.655][0.655,0.655]
```

## Overlay components (ward-defense-v2.tsx)
- StonePad × 6 — FULLY INVISIBLE tap target (Pressable). Renders nothing except
  a gold ★ ring when the tile is a merge candidate. The old green "targetable"
  and red "blocked" selection rings were removed (user: "deployment circles …
  make it transparent"). StonePadProps only needs {tileIdx, isMergeCandidate,
  onPress}. Uses DEPLOY_TILES.
- GateBadge — spawn-queue count badge positioned over the drawn gate.
- HeroOnPad — hero sprite centered on pad: `top: cy - HERO_H/2` (HERO_W=52, HERO_H=66).
- EnemyOnPath — walks PATH_WPS. ProjectileDot — projectiles.

## ClinicalQuestionPanel — must size to content
The panel's main row (`flexDirection:"row"` holding the 2×2 answer grid + lotus
sidebar) must NOT have `flex:1`. With `flex:1` the panel collapses to its
`minHeight` and the C/D answer row gets clipped on tall/narrow phones. Use
`alignItems:"stretch"` (no flex) so the panel grows to fit all four options.

## Layout order (ward-defense.tsx main return)
1. SafeAreaView → LinearGradient HUD bar
2. View s.ward → board (flex:1, contains WardBoardV2)
3. ClinicalQuestionPanel (wave_pause only) — below board in normal flow
4. HandPanel (unit cards + right sidebar); card portraits also use ExpoImage.

## Dev bypass pattern — ALWAYS REVERT
`if (gs.phase === "lobby") { startGame(); return null; }` before the real lobby
return (~line 2413) to skip the lobby for screenshots. Revert before finalizing.

## Build notes
- ward-defense-v2.tsx MUST have `export default function WardDefenseV2Screen() { return null; }` for Expo Router.
- Metro CI mode (CI=1): must restart "Start application" workflow after code changes.
- boxShadow not shadow* (deprecated on Expo web).
