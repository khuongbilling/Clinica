---
name: Ward Defense board layout
description: How the battle board is rendered — layer order, coordinate system, and why the lane must be drawn explicitly as CSS.
---

## The problem that caused multiple failed iterations
The background image (ward_board_scene.png) was treated as the source of truth for the lane.
Overlays used cover-mode math (imgPx + getImgBounds) to align with image pixels.
Result: enemies floated off the path, pads looked like dots, gate/lantern were just labels.

## The working approach (layer-based fixed coordinates)

**Coordinate system**: `px = fx * aw`, `py = fy * ah` — direct board fractions, no cover-mode math.

**Layer order** (ward-defense-v2.tsx):
1. Background image (contentFit="cover", opacity ~0.70) — atmosphere only
2. CenterPlatform — dark stone block filling `x: LX*aw → RX*aw`, `y: 0 → BY*ah`
3. StoneLane — three LinearGradient strips forming the U-walkway (left vert + bottom horiz + right vert)
4. StonePad (×6) — stone medallion Pressables at DEPLOY_TILES positions; show affordance ring on UNOCCUPIED pads when unit selected
5. GatePortal — fills `x: 0→LX*aw`, `y: 0→TY*ah`; purple orb + label
6. LanternShrine — fills `x: RX*aw→aw`, `y: 0→TY*ah`; teal orb + stability bar
7. Edge vignette
8. HeroOnPad (Animated) — hero sprite, feet at `fy*ah - 4px`
9. ProjectileDot — `fx*aw, fy*ah`
10. EnemyOnPath (Animated) — sprite above lane point `fy*ah - sprH - 22`

**Layout constants** (LX/RX/TY/BY must stay in sync across both files):
- `LX = 0.18` (inner edge left corridor)
- `RX = 0.82` (inner edge right corridor)
- `TY = 0.22` (top of corridors = gate/lantern block height)
- `BY = 0.76` (top of bottom corridor)

**PATH_WPS** (enemy centerline, both files): `[0.09,0.30] → [0.09,0.83] → [0.91,0.83] → [0.91,0.30]`

**DEPLOY_TILES** (both files): `[0.35,0.40],[0.50,0.40],[0.65,0.40],[0.35,0.59],[0.50,0.59],[0.65,0.59]`

**Why:**
Expo web / RN-web nested flex makes image-pixel coordinate alignment unreliable.
The only robust approach is to draw every interactive element as its own CSS View/LinearGradient
at exact board-fraction positions, and use the image only as atmospheric texture.

**How to apply:**
- Any future coordinate/layout change: edit LX/RX/TY/BY constants ONLY — all components read from them.
- PATH_WPS and DEPLOY_TILES MUST stay identical in ward-defense.tsx and ward-defense-v2.tsx.
- ward-defense-v2.tsx needs `export default function WardDefenseV2Screen(){}` to satisfy Expo Router.
- Dev bypass pattern: change freshState() to call beginWave() with pre-deployed units; always revert before publish.
