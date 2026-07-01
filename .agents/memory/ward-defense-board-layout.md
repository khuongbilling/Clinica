---
name: Ward Defense board layout
description: How the battle board is rendered — layer order, coordinate system, component design, and reference image target.
---

## Visual reference
`frontend/assets/references/ward_defense_target.png` — approved target image (July 2026):
- HUD: "Lotus Healing Ward" title + "Wave 1/6 💀" | Stability ❤️ green bar | AP X/Y blue | ⚙️ gear
- Board: purple Disease Gate portal (upper-left, x≈0.13, y≈0.18), golden Vital Lantern shrine (upper-right, x≈0.88, y≈0.18),
  6 octagonal-style dark stone "+" deploy pads (2×3 center), drawn lotus sanctuary background
- Below board: "🩺 CLINICAL CUE CHECK" panel (during wave_pause) with parchment/tan body + teal header
- Bottom: Three bordered unit cards (ASSESS/TREAT/SUPPORT role labels) + right sidebar (SKILLS/ITEMS/PAUSE)

## CRITICAL — No screenshot background
The board is built ENTIRELY from drawn React Native components. `ward_map_garden.png` exists but MUST NOT
be used as a battle board background. The drawn `SanctuaryBackground` component replaced ExpoImage background.

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
0. SanctuaryBackground — drawn garden scene: LinearGradient base + foliage blobs + stone platform + lotus pond + lanterns + stone arches for gate/pagoda areas
1. WaypointLane — THREE render passes per segment: (1) dark LANE_EDGE border, (2) solid LANE_STONE fill, (3) LANE_INNER highlight stripe. ALL colors fully opaque (no rgba transparency).
2. StonePad × 6 — octagonal-style platform: warm stone outer frame + dark inner circle + medical cross (no floating overlay ring when targetable — subtle pulse border only)
3. GatePortal — purple orb with stone arch backdrop at PATH_WPS[0]
4. LanternShrine — golden orb with pagoda backdrop at PATH_WPS[last]
5. Edge vignette (LinearGradient)
6. HeroOnPad — Animated hero sprites (feet anchored at pad center)
7. ProjectileDot
8. EnemyOnPath — Animated enemy sprites with health bars + cue labels

## WaypointLane rendering approach — SOLID OPAQUE COLORS
```
LANE_STONE = "#C0A050"  // warm sandy stone — fully opaque
LANE_EDGE  = "#3A1E04"  // dark brown border — fully opaque
LANE_INNER = "#D4B868"  // lighter center highlight — fully opaque
LANE_W     = max(24, aw * 0.090)
JR         = LANE_W / 2 + 2   // junction circle radius
```
Three passes: (1) wide border Views in LANE_EDGE, (2) fill Views in LANE_STONE, (3) narrow center stripe in LANE_INNER.
Each pass also draws junction circles at every waypoint to cap the segments cleanly.

## StonePad design (stone-embedded, not sci-fi floating overlay)
- Outer octagonal frame: warm earth tones (#1C2A20 bg, stoneRim border)
- Inner circle: dark teal healing atmosphere (#0E1E16), with healing-colored innerEdge border
- Medical cross: barLen = R*0.58, barThk = R*0.16, cream/green color (crossCol)
- Targetable state: subtle pulse ring (borderWidth:1.5, boxShadow with green tint)
- Do NOT render a large glow halo ring — it looks like a floating overlay
- isMerge → amber/gold; isTargetable → healing green; default → muted grey-green

## GatePortal — stone arch integrated
- orbCX = PATH_WPS[0][0]*aw, orbCY = PATH_WPS[0][1]*ah
- orbR = cl(min(aw,ah)*0.072, 24, 46)
- Stone arch backdrop View behind the orb (borderTopLeftRadius + borderTopRightRadius for arch shape)
- Purple LinearGradient orb with vortex center
- Label: carved into stone (dark bg, teal text, borderColor purple)

## LanternShrine — pagoda integrated
- lastWP = PATH_WPS[PATH_WPS.length - 1]; orbCX = lastWP[0]*aw, orbCY = lastWP[1]*ah
- orbR = cl(min(aw,ah)*0.072, 24, 46)
- Pagoda arch backdrop + 3 tier roof decorations
- Golden LinearGradient orb; glowC changes with stability (green > 60%, amber > 30%, red otherwise)
- Stability bar + % text below the orb

## ClinicalQuestionPanel (wave_pause only)
- NOT position:absolute — placed below the ward View in normal flow
- LinearGradient wrapper: ["#e8d5a8", "#d4b870"] (parchment/tan)
- Header badge: backgroundColor "#0d5c52" (dark teal), text "#e0fffa" (teal-white)
- Timer badge: backgroundColor "#5a2e00cc" (dark amber), text "#fbbf24"
- Answer grid: flexDirection "row", flexWrap "wrap", each button width "48%" → 2×2 layout
- Answered correct: green bg "#0a3020e0" / incorrect: red bg "#3a0a0ae0"

## Dev bypass pattern
`if (gs.phase === "lobby") { startGame(); return null; }` — ALWAYS revert before committing.
Do NOT try to directly set state to wave_pause via setTimeout — deployedUnits will be undefined.

## Build notes
- ward-defense-v2.tsx MUST have `export default function WardDefenseV2Screen() { return null; }` for Expo Router.
- Spread with conditional CSS props: `...(condition && { boxShadow: "..." } as any)` — THREE dots (not two).
- Metro CI mode (CI=1): must restart workflow to see changes — no hot-reload.
- No LX/RX/BY constants anywhere — those were the old 3-strip approach. Use PATH_WPS directly.
- shadow* style props are deprecated on Expo web — always use `boxShadow` via `({ boxShadow: "..." } as any)`.
