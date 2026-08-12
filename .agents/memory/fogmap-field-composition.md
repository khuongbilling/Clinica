---
name: Fog-map field composition (Push 2 rebuild)
description: Architecture of JourneyFogField — two-layer world-space atmospheric fog for the hex chapter map.
---

## Rule
JourneyFogField is a SEPARATE component from HexTile.  Returns a Fragment (two Views + optional dev mask).
Raster PNG cloud banks only — no SVG, no CSS gradients, no View blobs.

## Architecture (current — two-layer split)

**BackFogLayer** (`z FOG_BACK_Z = 4800`)
- 12 placements × banks A/B/C (4 each)
- Placement range: -10 %…110 % of world bounds
- Base tint View beneath cloud banks (shift-keyed color + opacity)
- Max opacity: `palette.bankAlphaMax` (0.78–0.88)
- Clearing: `BACK_CLEAR` — current(2.0/0.7), visibleNow(1.7/0.5), explored(1.1/0.3) × sz

**FrontFogLayer** (`z FOG_FRONT_Z = 6100`)
- 6 placements × bank C only (wispy tendrils)
- Placement range: 0 %…100 %
- No base tint — keeps explored areas readable
- Max opacity: `FRONT_BANK_ALPHA_MAX = 0.22`
- Clearing: `FRONT_CLEAR` — current(2.5/1.5), visibleNow(2.2/1.2), explored(1.5/0.9) × sz
  (more aggressive so visible tiles are never obscured by wisps)

**Drift**: single `Animated.ValueXY` shared between both layers — ±12 px, 56-second cycle,
`useNativeDriver: false` (layout bridge; needed for web).

**Clearing helper**: `resolvePlacements(defs, W, H, sources, alphaMax)` — pure function,
edge-based distance (`edgeDist = max(0, centreDist − diagonal×0.36)`).

## Z-ordering inside MapWorld

| Layer | z-range |
|---|---|
| unexplored Pressables | 50–1550 |
| **BackFogLayer** | **4800** |
| explored/visibleNow tiles | 5100–5400 |
| **FrontFogLayer** | **6100** |
| HexObjectLayer (sprites) | 6200–6500 |
| BossGate | 7000 |

## Debug props (dev only)
- `hideBack` / `hideFront` — suppress each layer individually
- `showMask` — renders green/amber border rings at each clearing source's fullR/startR
- Wired via `devOverlay.fogBack`, `devOverlay.fogFront`, `devOverlay.fogMask`
- `devOverlay.fogLayer` = "suppress all fog" shortcut (sets both hideBack + hideFront)

## HexMapDevOverlay fog flags (7 new)
`fogLayer` (all), `fogBack`, `fogFront`, `fogMask`, `showVisibleNow`, `showExplored`, `showUnexplored`

## Props
- `seed?: string` — run.seed forwarded from fog-map → HexMapLayer → JourneyFogField;
  module-level placement defs until seed-variation push
- `timeOfDay` — selects FOG_BANKS and PALETTE entry

## Key constraint
`JourneyFogLayer` null stub was removed in this push. Only JourneyFogField is active.

**Why:**
Previous fog was a single layer at z 5000. Back/front split gives atmospheric depth:
back covers unexplored (dense, below explored tiles), front adds wisp detail above terrain.
