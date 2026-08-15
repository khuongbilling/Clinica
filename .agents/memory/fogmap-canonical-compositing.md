---
name: Fog-map canonical compositing
description: Approved architecture for how fog reveal is drawn — direct destination-out with organic multi-lobe clusters; single data builder; two-mode debug system replacing old MSK.
---

# Fog-Map Canonical Compositing Architecture

**Rule:** FogBase and FogMid erase directly on the fog canvas with
`globalCompositeOperation = 'destination-out'`. No separate mask canvas.
No `destination-in`. The old two-canvas architecture (draw fog → apply black
mask via destination-in) produces visible artifacts when the mask canvas is in
any transient state.

## Single source of truth — buildOrganicRevealInfluences()

`buildOrganicRevealInfluences(params): OrganicRevealLobe[]` in `fogMask.ts` is
the ONE function that determines lobe positions. It accepts:
- `exploredStrength` / `visibleStrength` / `radiusMultiplier` so Base and Mid
  can each pass their own values while keeping the SAME seed → same positions.
- Seed per tile: `${runSeed}:${tileId}:fogReveal`

**All three consumers MUST use this function:**
1. `fogBase.ts` — destination-out erasure (strength 0.70/0.98, mult 1.0)
2. `fogMid.ts`  — destination-out erasure (strength 0.78/0.98, mult 0.95)
3. `drawFogAlphaDebug` — colored overlay for ALPHA diagnostic mode

`eraseSoftLobe(ctx, x, y, radius, strength)` is the draw primitive (fillRect, not arc).
`eraseOrganicFogCluster` is a legacy wrapper — prefer `buildOrganicRevealInfluences` + loop.

## Three-tier haze system

| Tile state   | Base strength | Mid strength | Visual result            |
|---|---|---|---|
| VISIBLE_NOW  | 0.98          | 0.98         | Terrain nearly clear     |
| EXPLORED     | 0.70          | 0.78         | 20–40 % haze remains     |
| UNEXPLORED   | no erase      | no erase     | Dense fog                |

## Debug system (replaced old monolithic MSK)

`FogLayerToggles` has these keys: `base`, `mid`, `wisp`, `state`, `alpha`.
**No `mask` or `edge` keys.**

**STATE toggle** — translucent React Views per tile:
  green=visibleNow, amber=explored, blue=unexplored.
  Checks GAMEPLAY calculation (calculateVisibleTileIds).
  Rendered in HexMapLayer as a separate sorted.map block.

**ALPHA toggle** — canvas overlay via `drawFogAlphaDebug`:
  Uses the SAME buildOrganicRevealInfluences lobes as production.
  green (~20%) for visible lobes, amber (~15%) for explored lobes.
  Map remains visible (semi-transparent, not opaque black/white).
  Canvas mounted/unmounted by Effect A (deps: `devFogAlpha`).
  Redrawn by Effect B (deps: `devFogAlpha`, tiles, worldW, worldH, sz).

## FogEdge layer retired

`FogEdgeLayer` is permanently unmounted. `fog_edge_day_01.png` retained as
unused asset. `edgeDay` removed from JOURNEY_ASSETS.fog. `fogEdge.ts` is dead code.

## Z-index table (current)

| Layer       | z     |
|---|---|
| FOG_BASE    | 5000  |
| GATE        | 5100  |
| FOG_MID     | 5200  |
| FOG_WISP    | 5300  |
| DEV_MASK    | 14500 |
| DEV_OVERLAY | 19000 |

## Test sequence

A. B only → B. +M → C. +W (production appearance, all debug OFF)
D. +STATE → verify hex geometry (green/amber/blue tints match tiles)
E. +ALPHA → verify organic art (no giant circles; adjacent visible tiles merge)

**Why direct destination-out:** Two-canvas destination-in compositing produced
hard-edged visible shapes whenever the mask canvas was in transient state.
Direct destination-out on the fog canvas eliminates the intermediate surface.

**Why separate STATE + ALPHA debug:** The old MSK was misleading because it used
legacy radial circles — not the same algorithm as production. Developers were
tuning the wrong geometry. The two-mode system cleanly separates gameplay logic
verification (STATE) from fog art verification (ALPHA), and both show the map
beneath rather than obscuring it with opaque shapes.
