---
name: Fog-map visibility system
description: Three-state fog (hidden/frontier/revealed) rules, key design decisions, and the no-session dev-route fix.
---

# Fog-map visibility system

## The rule that matters most
**Frontier = adjacent to the player's CURRENT tile only**, not "adjacent to any revealed tile."

This means:
- Tiles behind the player that are no longer adjacent to the current position **revert to hidden** — unless the player has already visited them (visited → permanently revealed).
- The frontier ring is narrow and moves with the player.

**Why:** The spec says "frontier tiles that are no longer adjacent may return to hidden unless previously revealed." This rule is only meaningful if frontier is based on the current tile, not all revealed tiles. If frontier were all-revealed-adjacent, revealed tiles never un-reveal, so nothing would ever un-frontier.

**How to apply:** `computeFogAfterMove(tiles, destId)` in `fogCalculator.ts`:
1. Mark destination revealed + current; unmark old current.
2. Build neighbor set of destination (new current).
3. For each non-revealed tile: frontier if in neighbor set, hidden otherwise.

## Encounter privacy rule
`isEncounterVisible(tile)` = `tile.current || tile.visibility === 'revealed'`.
Hidden and frontier tiles MUST NOT show encounter icons or names — enforced in HexMapLayer `encounterSrc` and in `isEncounterVisible` exported from fogCalculator.

## Dev-route no-session fallback
The screenshot tool and unauthenticated browsers never have a player session. If `player?.id` is undefined, the `useEffect` in `fog-map.tsx` must call `setRunLoading(false)` immediately — otherwise the spinner hangs forever. The `mapTiles` memo falls back to `JOURNEY_MAP_FIXTURE` when `player?.id` is falsy and no run is loaded.

## movement.ts API (Push 11)
- `validateMove(run, destId, stamina)` → `{ ok: true } | { ok: false, reason }`
- `applyMoveToRun(run, destId)` → `JourneyRun` — pure, no stamina deduction
- `MOVE_STAMINA_COST = 1`
- `MoveFailReason`: `NOT_ADJACENT | NOT_REACHABLE | INSUFFICIENT_STAMINA`

**Atomicity order in fog-map.tsx**: validate → spendStamina (store ref critical section, prevents double-spend) → applyMoveToRun → setRun (optimistic) → repo.saveRun (async, best-effort). If spendStamina returns false after a race, bail before applying.

**Camera recentre on move**: automatic — tilesKey = `${tiles.length}:${currentTile?.id}` changes when currentTileId changes, triggering useLayoutEffect in HexMapLayer.

**Encounter trigger**: `pendingEncounter` state set after movement to an unresolved non-empty tile. Real encounter navigation wired in future pushes; Push 11 shows a dismissable banner.

**movingRef guard**: `useRef<boolean>(false)` prevents double-tap double-spend across async boundary.

## fogCalculator.ts API
- `AXIAL_DIRS` — 6 flat-top axial directions (also used by lifecycle for adjacency)
- `axialNeighborKeys(q, r)` → string[] — 6 neighbor tile keys in "q,r" format
- `isAdjacent(q1,r1,q2,r2)` → boolean
- `computeInitialFog(tiles, startId)` → Map<tileId, TileVisibility>
- `computeFogAfterMove(tiles, destId)` → JourneyTile[]
- `isEncounterVisible(tile)` → boolean

## journeyRunLifecycle.ts
`buildInitialJourneyRun` was refactored to call `computeInitialFog` instead of inline adjacency logic. The local `AXIAL_DIRS` constant was removed from lifecycle — it now lives only in fogCalculator.

## HexMapLayer.tsx fog rendering
- Hidden: hex-hidden.webp base + fog-tile.webp overlay at opacity 0.90
- Frontier: hex-frontier.webp base + hex-selected.webp overlay at opacity 0.35 (restrained glow)
- Revealed: hex-revealed.webp + encounter icon
- Current: hex-current.webp + encounter icon + player-map-token.webp
- Hidden tiles are `disabled` (Pressable) — not selectable; frontier tiles are pressable (movement wired in Push 11).

## Named vision bonus slots (Push 5)

`visionConfig.ts` exposes `VisionBonusInputs` — four explicit named fields:
- `classVisionBonus`, `skillVisionBonus`, `equipmentVisionBonus`, `temporaryVisionBonus`

All default to 0 via `ZERO_VISION_BONUSES`. `resolveVisionBonuses(classTreeId, overrides?)` builds the record; `computeEffectiveVisionRadius(bonuses)` applies the formula (BASE + sum of all four) and clamps to `MAX_VISION_RADIUS = 4`. To test radius 2: `resolveVisionBonuses(undefined, { temporaryVisionBonus: 1 })`.

`axialHexDistance(a, b)` (object params, `(|dq|+|dr|+|ds|)/2`) is exported from `fogCalculator.ts` alongside the existing scalar `axialDistance(q1,r1,q2,r2)`.

## exploredTileIds persistence (Push 6)

`JourneyRun.exploredTileIds: readonly string[]` — tile IDs that have ever entered the player's FOV. Grows monotonically; never shrinks within a run.

**Behaviour change:** `visibleNow` tiles the player hasn't stepped on now stay `exploredButOutOfVision` when they leave FOV, rather than reverting to `unexplored`. Only truly never-seen tiles show dense fog.

**computeFogAfterMove** now returns `{ tiles, exploredTileIds }` instead of `JourneyTile[]`. Pass 4 param: `exploredTileIds: ReadonlySet<string>`. Pass 2 priority: `inFOV → visibleNow | everSeen → exploredButOutOfVision | unexplored`.

**Wire:** `explored_tile_ids?` in WireRun; `fromWire` derives it from tile states for legacy runs (no migration needed). `saveRun` sends it in the PUT body.

**createRun.ts** (alternate run-creation path) also sets `exploredTileIds` — keep both paths in sync when changing run structure.

## Named vision bonus slots (Push 5)

`visionConfig.ts` exposes `VisionBonusInputs` — four explicit named fields:
- `classVisionBonus`, `skillVisionBonus`, `equipmentVisionBonus`, `temporaryVisionBonus`

All default to 0 via `ZERO_VISION_BONUSES`. `resolveVisionBonuses(classTreeId, overrides?)` builds the record; `computeEffectiveVisionRadius(bonuses)` applies the formula (BASE + sum of all four) and clamps to `MAX_VISION_RADIUS = 4`. To test radius 2: `resolveVisionBonuses(undefined, { temporaryVisionBonus: 1 })`.

`axialHexDistance(a, b)` (object params, `(|dq|+|dr|+|ds|)/2`) is exported from `fogCalculator.ts` alongside the existing scalar `axialDistance(q1,r1,q2,r2)` which is used internally by `tilesWithinRadius` and `isAdjacent`.
