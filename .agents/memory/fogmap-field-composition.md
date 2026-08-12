---
name: Fog-map field composition — canonical design spec
description: Layer stack, fog behavior tiers, reveal edge rules, asset paths, and technical approach for the fog of war system. Reference image at frontend/assets/dev-reference/fog_system_design_reference.png
---

# Fog of War — Canonical Design Reference

**Image:** `frontend/assets/dev-reference/fog_system_design_reference.png`
Read this before any fog layer or asset change.

---

## Design Pillars

`Atmospheric · Organic · Layered · No Rectangles · No Scenery`

---

## Layer Stack (bottom → top, z-order)

| Layer | # | Name | Role |
|---|---|---|---|
| Map Background | 0 | Painted environment raster | Base; always visible |
| Visibility Mask | 1 | Alpha-erase mask | Composite step; not a rendered layer |
| Base Fog | 2 | Dense clouds | Primary concealment — 80–95% opacity |
| Mid Fog | 3 | Medium density | Atmospheric depth |
| Foreground Wisps | 4 | Moving, thin wisps | Surface detail; drifts slowly |

Current z-index assignments in code:
- `FOG_BASE_Z = 5500` (above terrain ceiling 5400, below WorldObjects 6200)
- `FOG_MID_Z  = 5510`
- Foreground Wisps: not yet implemented — target z ~5600

---

## Fog Behavior by Tile State

| State | Visual | Opacity |
|---|---|---|
| Unexplored | Dense fog | 80–95% |
| Explored (exploredButOutOfVision) | Light haze | 20–40% |
| Visible Now (current tile + FoV) | Clear | 0% |

---

## Reveal Edge Style

**DO NOT:**
- Hard circles
- Hex-shaped holes
- Rectangles
- Sharp edges
- Scenic art in fog assets

**DO:**
- Soft edges
- Layered opacity
- Irregular shapes
- Natural wisps
- Seamless blend (Gaussian + noise on mask)

---

## Asset File Structure

All fog assets: `frontend/public/assets/fog/`

```
/day/
  fog_large_01.webp     fog_large_02.webp
  fog_medium_01.webp
  fog_wisp_01.webp      fog_wisp_02.webp

/evening/   (same filenames)
/night/     (same filenames)
```

Assets must be **transparent PNG or WebP — fog shapes only, zero scenery, zero background fill**.
Any asset with a baked-in background must be regenerated with `removeBackground: true`.

---

## Technical Approach (spec from design doc)

1. Generate visibility mask from player's Field of Vision (radius 1)
2. Blur and feather the mask for organic edges (Gaussian + noise)
3. Use mask to erase fog from composite fog layers (destination-in)
4. Use fog sprites with varied scale, rotation, and opacity
5. Deterministic placement using run seed (`seededRandom(hashString(runSeed + ':fogbase'))`)
6. No scenic artwork in fog assets — fog only, transparent PNG/WebP

---

## Motion (optional, future push)

- Slow drift
- Subtle movement
- No repeating pattern
- < 1% movement per frame
- Seeded per run

---

## Implementation Notes (from design doc)

- Remove ALL existing fog rectangles, scenic images, per-tile overlays ✅ (Push 0 done)
- Add FogLayer as second layer above map ✅
- Use transparent fog assets (no trees, no scenery)
- Use visibility mask to erase fog based on player position
- Blend edges via multiple overlapping fog sprites + alpha masks
- Keep fog in world-space (moves with camera) ✅
- Unexplored = dense fog, Explored = light haze, Visible = clear

---

## Current Push Status

- **Mask removed** — fog covers full map unconditionally (temporary, for visual testing)
- **Visibility clearing disabled** in `FogBaseLayer.tsx` and `FogMidLayer.tsx`
- **Next push** = re-enable mask with organic blurred clearing around player FoV (radius 1)
- Edge taper removed — will be restored as part of mask reintroduction

**Why:**
Mask and taper were removed at user request to test full-coverage fog rendering before wiring visibility back in.
