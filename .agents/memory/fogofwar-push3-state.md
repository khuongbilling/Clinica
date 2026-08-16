---
name: FogOfWarLayer push state (Pushes 1–3)
description: Architecture decisions, commit refs, and what each push added to the new single-canvas fog system.
---

## Canonical layer architecture
- Single `FogOfWarLayer` canvas replaces legacy FogBase/FogMid/FogWisp (all disabled with `false &&` guard)
- Canvas = full world rect (worldWidth × worldHeight), position:absolute left:0 top:0
- z-index: JOURNEY_Z.FOG_MID (5200) — above Gate (5100), below dev overlays
- Web-only; returns null on native
- `useLayoutEffect` (not useEffect) so the foundation fill paints on the first browser frame

## Push 1 (1c0765a)
- FogOfWarLayer.tsx created; transparent canvas only; diagnostic panel confirms alignment

## Push 2 (c20cd93)
- fogOfWar.ts created: `drawFogOfWar(canvas, params)` — clear → DPR scale → rgba(55,72,86,0.82) foundation → fog_base_day_01 cover draw at α=0.45
- Asset guard rejects any URI containing "reference"
- `useLayoutEffect` added so foundation visible on first frame

## Push 3 (fb63d64)
- `calculateVisibleTileIds(currentTileId, tiles, radius)` exported from fogCalculator.ts — canonical public FOV ring function
- backend/server.py: `explored_tile_ids` added to JourneyRunCreate (List[str]=[]) and JourneyRunSave (Optional[List[str]]=None) — was silently dropped before
- FogOfWarParams extended with `exploredTileIds?` + `visibleTileIds?` (accepted, not used for drawing yet)
- Full prop chain: fog-map.tsx (computes fogVisibleTileIds via useMemo + calculateVisibleTileIds) → HexMapLayer (fogExploredTileIds, fogVisibleTileIds passthrough) → FogOfWarLayer → drawFogOfWar

## Push 4 plan
Add destination-out erasure inside `drawFogOfWar`:
- After foundation + texture: erase lobes for `exploredTileIds` (feathered, persistent memory)
- Then erase for `visibleTileIds` (sharper, current FOV)
- Follow the `buildOrganicRevealInfluences` + `eraseSoftLobe` pattern from fogBase.ts
- Need tile coordinate lookup: pass tile coord map or derive from id ("q,r" format)

## Screenshot tool limitation
- fog-map route requires AsyncStorage player session — screenshot tool always starts fresh
- `?debug=12` mode renders synthetic tiles but canvas fires after layout → onLayout gives worldW AFTER screenshot capture → always shows blank
- Verification must be done in the live app with a real session
