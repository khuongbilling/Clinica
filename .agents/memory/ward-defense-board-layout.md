---
name: Ward Defense board layout
description: How the battle board is rendered — layer order, coordinate system, component design, and reference image target.
---

## Visual reference
`frontend/assets/references/ward_defense_target.png` — approved target image (saved July 2026):
- HUD: "Lotus Healing Ward" title + "Wave 1/6 💀" | Stability ❤️ green bar | AP X/Y blue | ⚙️ gear
- Board: purple Disease Gate portal (upper-left), golden Vital Lantern shrine (upper-right),
  6 hexagonal dark "+" deploy pads (2×3 center), rich isometric lotus sanctuary
- Below board: "🩺 CLINICAL CUE CHECK" panel (during wave_pause) with 2-col A/B/C/D grid + timer + lotus badge
- Bottom: Three bordered unit cards (ASSESS/TREAT/SUPPORT role labels) + right sidebar (SKILLS/ITEMS/PAUSE)

## Layout order (ward-defense.tsx main return)
1. SafeAreaView
2. LinearGradient HUD bar
3. View s.ward — the board (flex:1, contains WardBoardV2)
4. ClinicalQuestionPanel (during wave_pause) OR feedbackPanel (during playing)
5. HandPanel (unit cards + right sidebar)

## Layer order inside WardBoardV2 (ward-defense-v2.tsx)
1. Background image (100% opacity, contentFit="cover") — illustrated lotus sanctuary
2. StoneLane — three LinearGradient strips forming U-walkway (pale amber tint at 44%)
3. StonePad × 6 — hexagonal dark frame + glowing inner circle + "+" cross bars
4. GatePortal — purple radial-gradient orb with dark vortex center + label + queue badge
5. LanternShrine — golden radial-gradient orb + lotus glyph + label + stability bar
6. Edge vignette
7. HeroOnPad — Animated hero sprites (feet anchored at pad center)
8. ProjectileDot
9. EnemyOnPath — Animated enemy sprites walking the corridor centerline

## Coordinate system
`px = fx * aw,  py = fy * ah` — direct board fractions, no cover-mode math ever.

## Layout constants (must stay identical in ward-defense.tsx and ward-defense-v2.tsx)
- LX = 0.17 (inner edge left corridor)
- RX = 0.83 (inner edge right corridor)
- BY = 0.77 (top of bottom corridor)
- PATH_WPS: [0.085,0.30] → [0.085,0.83] → [0.915,0.83] → [0.915,0.30]
- DEPLOY_TILES: [0.35,0.40] [0.50,0.40] [0.65,0.40] / [0.35,0.59] [0.50,0.59] [0.65,0.59]

## StonePad design
- Outer frame: rounded rectangle (borderRadius ≈ R*0.28) → octagon feel
- Frame color: cyan (#22d3ee) when targetable, amber when merge, dark blue default
- Inner circle: LinearGradient dark navy; "+" cross bars always visible on empty pads
- CSS boxShadow on web for glow effect: `...(condition && { boxShadow: "..." } as any)` — THREE dots required

## GatePortal (purple swirling orb)
- orbCX = PATH_WPS[0][0]*aw, orbCY = PATH_WPS[0][1]*ah - orbR*2.2
- LinearGradient: dark purple → bright purple → dark purple

## LanternShrine (golden radiant orb)
- orbCX = PATH_WPS[3][0]*aw, orbCY = PATH_WPS[3][1]*ah - orbR*2.2
- LinearGradient: deep amber → #fbbf24 → amber

## ClinicalQuestionPanel (wave_pause only)
- NOT position:absolute — placed below the ward View in normal flow
- Header: "🩺 CLINICAL CUE CHECK" cyan badge + 🕐 Xs countdown timer (amber) + lotus ✿ badge on right
- 2-column A/B/C/D answer grid (clinicalGrid style with flexWrap)
- Answered state: correct option highlighted cyan, wrong option highlighted red
- Timer resets on wave change via useEffect([wave])
- Receives `wave` prop to drive timer reset

## HandPanel
- No tab bar at top — flex row layout with right sidebar
- handRow: flex row containing handCards (flex:1) + handSidebar (width:52)
- Cards are flex:1 each (not fixed width) — fills available space in 3 equal columns
- Right sidebar: ⚡/⚔ SKILLS/UNITS toggle, ITEMS count badge, ✿ PAUSE
- ABILITIES mode: replaces card area with abilities display when mode === "abilities"

## Dev bypass pattern
Add to lobby render: `if (gs.phase === "lobby") { startGame(); return null; }`
ALWAYS revert before committing/publishing.

## Build notes
- ward-defense-v2.tsx MUST have `export default function WardDefenseV2Screen() { return null; }` for Expo Router.
- Spread with conditional CSS props: `...(condition && { boxShadow: "..." } as any)` — THREE dots (not two).
- Metro CI mode (CI=1) does not push hot-reloads to browser; must restart workflow to see changes.
