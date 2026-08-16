---
name: FogOfWarLayer push state (Pushes 1–3 + Corrective Push A)
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


## Push 4 (done)
Destination-out erasure inside `drawFogOfWar`:
- After foundation + texture: `buildOrganicRevealInfluences` + `eraseSoftLobe` (explored 0.70, visible 0.98) — same lobe model as legacy fogBase.ts
- `exploredTileIds` may include currently-visible ids (monotonic) — must subtract `visibleTileIds` before building lobes or tiles get double lobes
- Tile geometry travels as props: HexMapLayer builds memoised `fogTileCenters` (coords.axialToWorld + sz/2) and passes sz/tileCenters/fov/runSeed — fogOfWar never re-derives hex math
- FogOfWarLayer split into Effect A (canvas create, dims deps) + Effect B (draw, full deps + `buildFogMaskCacheKey` skip) — camera pan never redraws
- Debug/fixture mode (run=null) has no run exploration state — fog-map falls back to tile.visibility-derived sets so `?debug=N` exercises the erasure

## Corrective Push A (a32c591)

### Root cause
`computeHexWorldCoords(tiles, containerWidth)` derived sz to fit the tile set within the viewport,
producing worldW ≈ containerW. maxCameraX = max(0, worldW−viewportW) = 0 → camera locked at 0,0.
Additionally, Ch1 had negative-q tiles silently dropped: worldOriginX was centred from q=0 (not minQ),
placing tile q=−2 at left=−75px (off-canvas left edge).

### Fixes
- `AUTHORED_MAP_TILE_SZ = 150` exported from hexWorldCoords.ts — canonical tile size for world sizing, independent of viewport
- `computeHexWorldCoords(tiles, containerWidth, szOverride?)` — new third param; when provided delegates to `_computeAuthoredWorldCoords`
- `_computeAuthoredWorldCoords`: uses minQ (not 0) for worldOriginX; worldWidth = round((maxQ−minQ)×Q_STEP×sz)+sz+2×MARGIN; no viewport padding term
- `HexMapLayerProps`: `worldTileSize?: number` and `onMetricsUpdate?: (m) => void`
- `HexMapWorldMetrics`: extended with viewportW/H, playerWorldX/Y, desiredCamX/Y, maxCamX/maxCamY
- fog-map.tsx: passes `worldTileSize={AUTHORED_MAP_TILE_SZ}` to HexMapLayer; `CameraDiagnosticsPanel` in mapOuter (NOT inside MapWorld, so stays fixed during camera pan)

### Expected values for Ch1 at AUTHORED_MAP_TILE_SZ=150
- Viewport:   ~382 × ~351
- MapWorld:   ~710 × ~585
- Max camera: ~328 × ~234

### Recenter correctness
Recenter uses `initialCamRef.current` which is set to `{x:destX, y:destY}` (player-centred) in Effect 2.
It does NOT reset to 0,0. No change needed.

## Screenshot tool limitation
- fog-map route requires AsyncStorage player session — screenshot tool always starts fresh
- `?debug=N` now works for fog verification (Push 4 fallback), but Metro rebuilds make the first 1–2 screenshots after an edit come back blank/stale — retry with sleeps until browser logs show the new dev log lines
- Verification of run-persisted exploration must still be done in the live app with a real session
