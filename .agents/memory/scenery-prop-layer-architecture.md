---
name: Scenery prop layer architecture
description: SceneryPropLayer separates collision-critical scenery from the raster background; props placed at runtime from SceneryLayout.
---

# Scenery Prop Layer Architecture

## The rule
Collision-critical scenery (beds, consoles, tables, machines, planters, columns) must NEVER be baked into the base raster background. The base raster shows only: floor, embedded inlays, lighting, permanent perimeter architecture. All freestanding blocking props are a runtime `SceneryPropLayer` rendered above the background and below fog.

**Why:** AI-generated rasters cannot guarantee pixel-accurate obstacle avoidance. The background prompt can say "no furniture" but the AI approximates. Runtime placement is deterministic and validatable.

## Layer stack (canonical)
```
Blueprint → Walkable Bed → CLEAN BACKGROUND RASTER → Hex Terrain → SceneryPropLayer → Encounter Objects → Player → Fog
```

## Key files
- `sceneryPropTypes.ts` — 11 SimulationEra prop types, `SCENERY_PROP_DEFS` catalog (`asset: null` until PNGs generated), `ZONE_TYPE_TO_PROPS` mapping, `PlacedSceneryProp` type
- `sceneryPropPlacer.ts` — `computeSceneryProps(scenery, coords, chapterId)` → `PlacedSceneryProp[]`; deterministic from blueprint seed + `SCENERY_PROP_LAYOUT_VERSION`; safety check via pixel-grid sampling (coarse but conservative; see tech-debt task for finer check)
- `SceneryPropLayerView.tsx` — renders `PlacedSceneryProp[]` inside world Animated.View; DEV placeholder boxes when `asset=null`; depth-sorts by `groundY` using `OBJECT_DEPTH=10`
- `HexMapLayer.tsx` — added `worldSceneryChildren?: ReactNode` prop, rendered between terrain tiles and `HexObjectLayer`
- `fog-map.tsx` — `sceneryCoords` + `placedSceneryProps` useMemos; passes `SceneryPropLayerView` as `worldSceneryChildren` for blueprint-pipeline chapters only

## Coordinate system for prop placement
- `computeHexWorldCoords(mapTiles, mapSize.w, AUTHORED_MAP_TILE_SZ)` gives `HexWorldCoords`
- `coords.axialToWorld(q, r)` → `{left, top, cx, cy}` (pixel positions in world space)
- Props are positioned with `worldLeft = cx - pw/2`, `worldTop = cy - ph` (ground at bottom-center)
- `groundY = cy` (same as bottom-center) used for depth sorting

## Safety check
`isSafeToPlace` samples a pixel grid within `(collisionRadiusTiles + safetyBufferTiles) × sz` of the prop center and converts each sample to axial coords, then checks against `SceneryLayout.walkableSafetyMaskKeys`. Step size is `sz × 0.5` — may miss edge cases for large props (known tech debt).

## Props are shift-invariant
`computeSceneryProps` is seeded from `"ch{N}|scenery-props|{SCENERY_PROP_LAYOUT_VERSION}"` — no shift, no player, no attempt number. Same positions day/evening/night.

## Clearing perimeter rule
`isClearing` detected by `zone.walkableContactCount > 3`. For clearing zones, only cells beyond `CLEARING_PERIMETER_RATIO (0.55)` × zone radius are used as candidates. Keeps clearing interiors open for encounters.

## Background v4 (current)
Ch1 v4 backgrounds registered in `BLUEPRINT_RASTER_REGISTRY` for both known hashes (`6439241b`, `01dd9c64`). Files: `map-platform-background-ch1-{day/evening/night}-blueprint-v4.png`. Prompt: open clinical simulation floor, NO furniture on traversable area, equipment only in far-edge alcoves.

## z-index
Props use `min(WORLD_CONTENT_MAX, WORLD_CONTENT_BASE + round(groundY × OBJECT_DEPTH))` = same formula as HexObjectLayer. They are naturally depth-sorted with player/encounters by their respective groundY values. Fog (z≥5000) covers everything.

## What NOT to do
- Never put freestanding blocking props in the background prompt again — AI cannot guarantee avoidance
- Never render SceneryPropLayerView outside the world Animated.View (it must share the camera transform)
- Never seed prop layout from run.attempt or run.seed — must be blueprint-seed only or positions shift between attempts
