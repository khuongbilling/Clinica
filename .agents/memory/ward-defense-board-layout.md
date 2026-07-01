---
name: Ward Defense board layout
description: How the battle board is rendered — layer order, coordinate system, component design, and reference image target.
---

## Visual reference
`frontend/assets/references/ward_defense_target.png` — the approved target composition:
purple swirling Disease Gate portal (left), golden Vital Lantern shrine (right),
clear pale stone U-lane, 6 hexagonal "+" deploy pads in 2×3 center cluster, illustrated lotus sanctuary.

## Layer order (ward-defense-v2.tsx)
1. Background image (100% opacity, contentFit="cover") — full illustrated lotus-sanctuary art
2. StoneLane — three LinearGradient strips forming U-walkway (pale amber tint at 44%)
3. StonePad × 6 — HEXAGONAL dark frame + glowing inner circle + "+" cross bars
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

## StonePad (hexagonal glow pad) design
- Outer frame: rounded rectangle (borderRadius ≈ R*0.28) → octagon feel
- Frame color: frameC = cyan (#22d3ee) when targetable, amber when merge, dark blue default
- Inner circle: LinearGradient dark navy; "+" cross bars always visible on empty pads
- Glow halo: rendered only when targetable or merge-candidate
- CSS boxShadow on web for glow effect (spread via `...(condition && { boxShadow } as any)`)

## GatePortal (purple swirling orb)
- Positioned at: orbCX = PATH_WPS[0][0]*aw, orbCY = PATH_WPS[0][1]*ah - orbR*2.2
- LinearGradient: dark purple → bright purple → dark purple (radial-feel)
- Dark vortex center circle (backgroundColor "#05000a")
- pointerEvents: "none" (decorative overlay, no touch events)

## LanternShrine (golden radiant orb)
- Positioned at: orbCX = PATH_WPS[3][0]*aw, orbCY = PATH_WPS[3][1]*ah - orbR*2.2
- LinearGradient: deep amber → glowC (#fbbf24) → amber (radial-feel)
- Inner lotus glyph "✦"
- Stability bar positioned below the orb at orbCY + orbR + 3
- Glow color shifts: green (#fbbf24) → amber (#f59e0b) → red (#ef4444) at 60/30% thresholds

## Why art-first approach
Expo web nested flex makes image-pixel alignment unreliable. The only robust approach:
draw every interactive element as its own CSS View/LinearGradient at fixed board-fraction
positions, and use the background image as atmospheric texture only. Never trust the image
to show where the path is — always draw the lane explicitly.

## Dev bypass pattern
Add to freshState(): call beginWave(baseWithUnits, 0) to pre-load heroes.
Add to lobby render: `if (gs.phase === "lobby") { startGame(); return null; }`
ALWAYS revert both before committing/publishing.

## Build notes
- ward-defense-v2.tsx MUST have `export default function WardDefenseV2Screen() { return null; }` for Expo Router.
- Spread with conditional CSS props: `...(condition && { boxShadow: "..." } as any)` — note THREE dots.
- Metro CI mode (CI=1) does not push hot-reloads to browser; must restart workflow to see changes.
