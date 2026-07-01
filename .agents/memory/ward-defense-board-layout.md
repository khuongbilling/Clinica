---
name: Ward Defense board layout
description: How the battle board is rendered — layer order, coordinate system, component design, and reference image target.
---

## Visual reference
`frontend/assets/references/ward_defense_target.png` — approved target image (July 2026):
- HUD: "Lotus Healing Ward" title + "Wave 1/6 💀" | Stability ❤️ green bar | AP X/Y blue | ⚙️ gear
- Board: purple Disease Gate portal (upper-left, x≈0.13, y≈0.18), golden Vital Lantern shrine (upper-right, x≈0.88, y≈0.18),
  6 perfectly circular dark "+" deploy pads (2×3 center), rich isometric lotus sanctuary background
- Below board: "🩺 CLINICAL CUE CHECK" panel (during wave_pause) with parchment/tan body + teal header
- Bottom: Three bordered unit cards (ASSESS/TREAT/SUPPORT role labels) + right sidebar (SKILLS/ITEMS/PAUSE)

## PATH_WPS — clockwise enemy route (MUST be identical in ward-defense.tsx AND ward-defense-v2.tsx)
```
[0.13,0.18], [0.18,0.22], [0.32,0.22], [0.50,0.22], [0.70,0.22],
[0.82,0.32], [0.82,0.48],
[0.72,0.60], [0.50,0.64], [0.28,0.60],
[0.18,0.48], [0.18,0.34],
[0.30,0.24], [0.58,0.24], [0.80,0.22], [0.88,0.18]
```
Enemies travel: Gate (upper-left) → right along top → down right side → left along bottom → up left side → right inner top lane → Lantern (upper-right).

## DEPLOY_TILES — six pad positions (MUST be identical in both files)
```
[0.36,0.36], [0.50,0.36], [0.64,0.36],
[0.36,0.51], [0.50,0.51], [0.64,0.51]
```

## Layout order (ward-defense.tsx main return)
1. SafeAreaView → LinearGradient HUD bar
2. View s.ward → the board (flex:1, contains WardBoardV2)
3. ClinicalQuestionPanel (during wave_pause only) — placed below board in normal flow
4. HandPanel (unit cards + right sidebar)

## Layer order inside WardBoardV2 (ward-defense-v2.tsx)
1. Background image (100% opacity, contentFit="cover") — illustrated lotus sanctuary
2. WaypointLane — three render passes: fill segments → junction circles → border segments
3. StonePad × 6 — fully circular (borderRadius: R+5), dark with glowing "+" center
4. GatePortal — purple radial-gradient orb at PATH_WPS[0]; orbR = min(aw,ah)*0.062
5. LanternShrine — golden orb at PATH_WPS[last]; orbR = min(aw,ah)*0.062
6. Edge vignette
7. HeroOnPad — Animated hero sprites (feet anchored at pad center)
8. ProjectileDot
9. EnemyOnPath — Animated enemy sprites with health bars + cue labels

## WaypointLane rendering approach
For each segment (wp[i] → wp[i+1]):
- cx,cy = midpoint; segLen = euclidean pixel distance + 2px overlap
- angle = atan2(dy*ah, dx*aw) in degrees → transform rotate
- Three passes: (1) fill Views, (2) junction circles at every waypoint (radius = LANE_W/2+1), (3) border Views with top/bottom borderWidth
- LANE_W = max(20, aw * 0.082); LANE_FILL = "rgba(195,165,95,0.50)"; LANE_BORDER = "rgba(80,55,15,0.82)"

## StonePad design
- Outer frame: borderRadius = R + 5 → fully circular stone platform (NOT rounded rectangle)
- Frame color: cyan (#22d3ee) when targetable, amber when merge, dark blue default
- Inner circle: LinearGradient dark navy with "+" cross bars visible on empty pads
- CSS boxShadow on web (THREE dots for spread): `...(condition && { boxShadow: "..." } as any)`
- R = cl(min(aw,ah) * 0.076, 24, 44)

## GatePortal (purple swirling orb)
- orbCX = PATH_WPS[0][0]*aw, orbCY = PATH_WPS[0][1]*ah (centered AT the waypoint)
- orbR = cl(min(aw,ah)*0.062, 20, 40) — NOT based on corridor width
- LinearGradient: dark purple → bright purple → dark purple

## LanternShrine (golden radiant orb)
- lastWP = PATH_WPS[PATH_WPS.length - 1]; orbCX = lastWP[0]*aw, orbCY = lastWP[1]*ah
- orbR = cl(min(aw,ah)*0.062, 20, 40) — NOT based on corridor width
- LinearGradient: deep amber → #fbbf24 → amber

## ClinicalQuestionPanel (wave_pause only)
- NOT position:absolute — placed below the ward View in normal flow
- LinearGradient wrapper: ["#e8d5a8", "#d4b870"] (parchment/tan)
- Header badge: backgroundColor "#0d5c52" (dark teal), text "#e0fffa" (teal-white)
- Timer badge: backgroundColor "#5a2e00cc" (dark amber), text "#fbbf24"
- Question text: "#2d1200" (dark brown for readability on parchment)
- Answer buttons: backgroundColor "#c8a06088", borderColor "#8b5e3c"
- Letter circles: backgroundColor "#6b3200", text "#fde68a"
- Option text: "#2d1200" (dark brown)
- Answered correct: green bg "#0a3020e0" / incorrect: red bg "#3a0a0ae0"

## Dev bypass pattern
`if (gs.phase === "lobby") { startGame(); return null; }` — ALWAYS revert before committing.
Do NOT try to directly set state to wave_pause via setTimeout — deployedUnits will be undefined.

## Build notes
- ward-defense-v2.tsx MUST have `export default function WardDefenseV2Screen() { return null; }` for Expo Router.
- Spread with conditional CSS props: `...(condition && { boxShadow: "..." } as any)` — THREE dots (not two).
- Metro CI mode (CI=1): must restart workflow to see changes — no hot-reload.
- No LX/RX/BY constants anywhere — those were the old 3-strip approach. Use PATH_WPS directly.
