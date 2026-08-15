---
name: Fog-map canonical compositing
description: Approved architecture for how fog reveal is drawn — direct destination-out with organic multi-lobe clusters; no mask canvas, no destination-in.
---

# Fog-Map Canonical Compositing Architecture

**Rule:** FogBase and FogMid erase directly on the fog canvas with
`globalCompositeOperation = 'destination-out'`. No separate mask canvas.
No `destination-in`. The old two-canvas architecture (draw fog → apply black
mask via destination-in) produces visible artifacts when the mask canvas is in
any transient state.

## Three-tier haze system

| Tile state   | Base strength | Mid strength | Visual result            |
|---|---|---|---|
| VISIBLE_NOW  | 0.98          | 0.98         | Terrain nearly clear     |
| EXPLORED     | 0.70          | 0.78         | 20–40 % haze remains     |
| UNEXPLORED   | no erase      | no erase     | Dense fog                |

## Organic erase primitives (fogMask.ts)

Two exported functions are the only approved way to erase fog:

- `eraseSoftLobe(ctx, x, y, radius, strength)` — radial gradient via `fillRect`
  (not arc). Gradient stops: 0→strength, 0.45→strength×0.92, 0.75→strength×0.45, 1→0.
- `eraseOrganicFogCluster(ctx, cx, cy, radius, strength, tileId, sz)` — central
  lobe + 4–5 seeded asymmetric secondary lobes from LOBE_PROFILES.

Both Base and Mid use the SAME tileId as lobe seed → identical lobe positions,
only radius (Mid ≈ 0.95× Base) and strength differ. This creates subtle
layering without two unrelated reveal regions.

## FogEdge layer retired

`FogEdgeLayer` is permanently unmounted from `HexMapLayer.tsx`.
`fog_edge_day_01.png` is retained as an unused asset (PNG on disk).
`edgeDay` removed from `JOURNEY_ASSETS.fog` registry.
`fogEdge.ts` is dead code — direct-require so it compiles but doesn't register.

## Z-index table (current)

| Layer       | z     |
|---|---|
| FOG_BASE    | 5000  |
| GATE        | 5100  |
| FOG_MID     | 5200  |
| FOG_WISP    | 5300  ← was 5400; filled Edge's old slot |
| DEV_MASK    | 14500 |
| DEV_OVERLAY | 19000 |

## Debug diagnostic

`FogDevDiagnostic` has toggles B/M/W/MSK (no Edge toggle).
Test sequence: A=Base only → B=+Mid → C=+Wisp.
VisibleNow count of < 7 is NOT an error — boundary tiles have fewer neighbors.

**Why:** Two-canvas destination-in compositing produced hard-edged visible
shapes whenever the mask canvas was in a transient or misaligned state.
Direct destination-out on the fog canvas eliminates the intermediate surface
and therefore eliminates the artifact class entirely.

**How to apply:** Any future fog layer must use `eraseOrganicFogCluster` (or
`eraseSoftLobe` for simple cases) with destination-out already set on the
fog canvas directly. Never introduce a mask canvas or destination-in.
