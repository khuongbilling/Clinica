---
name: Fog-map field composition (Push 26)
description: Architecture of JourneyFogField — procedural runtime fog for the hex chapter map.
---

## Rule
JourneyFogField is a SEPARATE component from HexTile.  Zero raster assets.  Zero SVG.  Zero flat overlay.
Fog is generated at runtime from deterministic pseudorandom View blobs.

## Architecture (Push 26 — procedural blob fog)

**22 blobs × 3 concentric rings each = up to 66 View nodes.**

Each blob = three nested `<View>` circles with `borderRadius: 99999`:
  - inner  ring: `opacity_factor 0.54` — dense fog body
  - middle ring: `opacity_factor 0.26` — transitional mist
  - outer  ring: `opacity_factor 0.08` — feathered wisps

Three rings simulate a radial gradient using only React Native primitives.
Multiple overlapping blobs produce natural variation.

**Blob placement:**
- Positions generated at MODULE LEVEL via seeded PRNG (`seededRand(i*11+offset)`)
- xF range: -12% to 112% of world width (bleed past edges)
- yF range: -10% to 110% of world height
- sizeF (outer radius): 12%–32% of world width
- Positions are IDENTICAL every run (deterministic, not per-run seeded)

**Per-blob clearing:**
Each blob's parent opacity driven by min distance from blob centre to any visible tile centre.
Three tiers (multiples of sz):
  current:                startR=1.9, fullR=0.6
  visibleNow:             startR=1.6, fullR=0.45
  exploredButOutOfVision: startR=1.0, fullR=0.25
BLOB_ALPHA_MAX = 0.84. Blobs with opacity < 0.02 skipped (not rendered).

**Shift palettes (blobColor):**
  day:     '#7a9db4'  — pale blue-grey atmospheric haze
  evening: '#1e1030'  — deep indigo-purple twilight fog
  night:   '#0c1a28'  — near-black navy mist

**Drift:**
Single `Animated.ValueXY` on blob container — `useNativeDriver: true`, ±10px, 48s cycle.
GPU-driven. Zero JS-thread cost.

**z-ordering:**
`JourneyFogField` at `zIndex 5000` — above unexplored Pressables (z 1–3000), below explored tiles (z 5050+).

**timeOfDay fallback:**
HexMapLayer passes `timeOfDay ?? 'night'`.

**Known refinement opportunities:**
- Blob positions are module-level constants (same every attempt). Per-run seeding from `run.seed` would give variation between attempts.
- Clearing uses blob CENTRE distance; large blobs whose centre is far but edge overlaps the clearing zone still show. Could refine to (dist - outerR) for edge-based clearing.

**History of this component:**
- Push 16/17: SVG Mask + radial gradient + raster PNGs at 0.25 opacity
- Push 25: removed SVG mask; raster PNGs at 0.82 opacity with per-bank centre clearing
- Push 26: removed all raster assets; pure procedural View blobs (current)
