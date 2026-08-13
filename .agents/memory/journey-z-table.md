---
name: Journey map z-index table
description: Canonical z-index values for all chapter fog-map layers; world content now below fog.
---

## Source of truth
`frontend/src/components/journey/journeyZ.ts` — `JOURNEY_Z` constant object.

## Z-index table (bottom → top)

| Layer | z-index | Notes |
|---|---|---|
| Background | 0 | Chapter environment painting |
| Terrain | 100–400 | TERRAIN_BASE(100) + worldY×10; unexplored capped ≤ 99 |
| World Content | 3000–4900 | WORLD_CONTENT_BASE(3000) + worldY×10, clamped WORLD_CONTENT_MAX(4900) |
| FogBase | 5000 | Primary canvas concealment |
| Gate | 5100 | Rises above base fog, veiled by mid/edge/wisp |
| FogMid | 5200 | Atmospheric density variation |
| FogEdge | 5300 | Organic reveal-edge sprites |
| FogWisp | 5400 | Topmost surface wisps |
| DEV_MASK | 14500 | __DEV__ fog debug canvas |
| DEV_OVERLAY | 19000 | __DEV__ per-tile text/dots |
| DEV_DIAGNOSTICS | 19999 | __DEV__ diagnostics HUD |

## Fog visibility state types (Push 2)

`FogVisibilityState = 'visibleNow' | 'explored' | 'unexplored'` — canonical lowercase type in `fog.types.ts`.

Note: "explored" = the legacy 'exploredButOutOfVision' on JourneyTile; the short name is canonical in the fog system.

Import `FogVisibilityState` from `fogVision.ts` (re-exported there for convenience). All fog-rendering types also available from `fog.types.ts`.

## Central resolver (Push 2)

`getFogVisibilityState(tileId, visibleNowIds, exploredIds): FogVisibilityState` in `fogVision.ts` — THE only authoritative classifier.

`fogVisibilityFromTileState(tileVisibility, isCurrent): FogVisibilityState` — bridge for single-tile decisions (gate IIFE, per-tile HexTile).

`getEffectiveVisionRadius(stats: PlayerVisionStats): number` — replaces hardcoded `effectiveFieldOfVision: 1` everywhere.

**Why:** No component should compare `tile.visibility === 'exploredButOutOfVision'` directly. All fog/gate/encounter decisions go through the central resolver or bridge helper.

## Consistency rule (enforced in Push 2)
- Fog layers: use `fogVisibilityFromTileState` to build visibleNowIds/exploredIds sets
- HexObjectLayer: `useMemo` computes sets once; `getFogVisibilityState` used in render loop
- HexTile: receives `fogState: FogVisibilityState` prop; never reads `tile.visibility` for fog decisions
- Gate section: `fogVisibilityFromTileState(gateTile.visibility, gateTile.current)` → `gateFogState`
- `encounterMapNode(tile, fogState)` and `a11yLabel(tile, fogState)` — both require pre-computed fogState param

## JSX render order in HexMapLayer.tsx MapWorld
1. `<ChapterEnvironment>` — background image
2. `{sorted.map → HexTile}` — terrain pass
3. `<HexObjectLayer>` — world content pass  
4. `<FogBaseLayer>` — primary concealment
5. `{gateArt → ...}` — gate overlay
6. `<FogMidLayer>`, `<FogEdgeLayer>`, `<FogWispLayer>` — upper fog
7. DevFogMask, DevOverlays — __DEV__ only

## Critical design decision
World content (player sprite, encounter nodes, treasure, area boss) sits **below** FogBase.
Concealment is achieved by canvas `destination-in` transparency — fog canvas has opaque pixels over unexplored tiles and transparent holes over visible tiles. No z-poke-through needed.

**Why:** Correct fog-of-war — fog physically hides objects on unexplored tiles. Previously objects were at z 6200–6500 (above fog), which was the wrong design: you could see them even on unexplored tiles (code had to manually skip rendering them).

## Constants in HexMapLayer.tsx
`TERRAIN_BASE`, `OBJECT_BASE`, `GATE_ART_Z` are local aliases for `JOURNEY_Z.*` values — kept so all the formulas that reference them still read clearly.

## Unexplored tile z formula
Changed from `worldY×50+50` (could reach 1550, above new TERRAIN_BASE of 100) to `Math.min(JOURNEY_Z.TERRAIN_BASE - 1, Math.round(worldY * 3) + 10)` — always capped ≤ 99. Prevents unexplored disabled Pressables from intercepting taps on revealed tiles above them.

## Fog layer z-index exports
- `FOG_BASE_Z = 5000` (FogBaseLayer.tsx)
- `FOG_MID_Z = 5200` (FogMidLayer.tsx)
- `FOG_EDGE_Z = 5300` (FogEdgeLayer.tsx)
- `FOG_WISP_Z = 5400` (FogWispLayer.tsx)
