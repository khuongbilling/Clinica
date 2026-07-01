---
name: Ward Defense board layout
description: How the battle board is rendered — layer order, coordinate system, component design, and reference image target.
---

## Visual reference
`frontend/assets/references/ward_defense_target.png` — approved target image.
Reference composition: dark teal lotus garden, sandy stone path wrapping clockwise, 6 octagonal
platforms with teal-blue disc + bright white cross, Disease Gate (upper-left), Vital Lantern (upper-right).

## CRITICAL — No screenshot background
The board is built ENTIRELY from drawn React Native components.
`ward_map_garden.png` exists but MUST NOT be used as background.

## PATH_WPS — clockwise enemy route (MUST be identical in ward-defense.tsx AND ward-defense-v2.tsx)
```
[0.13,0.18], [0.18,0.22], [0.32,0.22], [0.50,0.22], [0.70,0.22],
[0.82,0.32], [0.82,0.48],
[0.72,0.60], [0.50,0.64], [0.28,0.60],
[0.18,0.48], [0.18,0.34],
[0.30,0.24], [0.58,0.24], [0.80,0.22], [0.88,0.18]
```

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
0. SanctuaryBackground — dark teal lotus garden: rich water base, lily pads, lotus flowers everywhere,
   Buddha statue (left), pagoda (right), stone lanterns, stone arch frame for gate area, pagoda arch for lantern area
1. WaypointLane — THREE fully opaque passes: LANE_EDGE (#3A2008) border, LANE_STONE (#C8A850) fill, LANE_INNER (#DAC068) centre.
   All colors fully opaque, no rgba(). Lotus rune ✿ engravings along the path.
2. StonePad × 6 — octagonal clip-path (`clipPath: OCT`). Outer octagon is frameAccent color; inner octagon
   is #2A283C stone fill; dark ring; teal-blue disc (discEdge); bright white cross (barLen=R*0.68, barThk=R*0.20)
   with boxShadow glow. SIZE = cl(min(aw,ah)*0.154, 52, 90).
3. GatePortal — purple swirling orb with stone arch outer frame (borderTopLeftRadius + borderTopRightRadius = orbR)
4. LanternShrine — golden dome cage (concentric rings at 0°/60°/120°) with golden orb fill
5. Edge vignette
6. HeroOnPad sprites
7. ProjectileDot sprites
8. EnemyOnPath sprites

## Octagon clip-path (OCT constant)
```
const OCT = "polygon(29% 0%, 71% 0%, 100% 29%, 100% 71%, 71% 100%, 29% 100%, 0% 71%, 0% 29%)";
```
Apply as: `style={[{ width: SIZE, ... }, { clipPath: OCT } as any]}`
Works on Expo web (React Native Web). On native it falls back to square — acceptable since app is web-first.
Do NOT apply borderWidth to clipped Views — border is achieved by making outer octagon larger in frameAccent color.

## WaypointLane — solid opaque only
```
LANE_STONE = "#C8A850"  // warm sandy stone
LANE_EDGE  = "#3A2008"  // dark brown border
LANE_INNER = "#DAC068"  // lighter centre highlight
LANE_W = max(22, aw * 0.088)
```

## StonePad palette
- Default: frameAccent="#6A6888", discBase="#0E2848", discEdge="#2A6090", crossColor="#FFFFFF"
- Targetable: frameAccent="#70C890", discBase="#12382A", discEdge="#70C890"
- Merge: frameAccent="#C49A00", discBase="#3A2C00", crossColor="#FFD700"

## ClinicalQuestionPanel (wave_pause only)
- LinearGradient wrapper: ["#e8d5a8", "#d4b870"] (parchment/tan)
- Header badge: backgroundColor "#0d5c52" (dark teal), text "#e0fffa"
- Answer grid: flexDirection "row", flexWrap "wrap", each button width "48%" → 2×2

## Dev bypass pattern — ALWAYS REVERT
`if (gs.phase === "lobby") { startGame(); return null; }` — must revert before finalizing.

## Build notes
- ward-defense-v2.tsx MUST have `export default function WardDefenseV2Screen() { return null; }` for Expo Router.
- Spread with conditional CSS: `...(condition && { boxShadow: "..." } as any)` — THREE dots.
- Metro CI mode (CI=1): must restart workflow after code changes.
- boxShadow not shadow* (deprecated on Expo web).
