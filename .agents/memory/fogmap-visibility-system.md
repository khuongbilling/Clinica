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
