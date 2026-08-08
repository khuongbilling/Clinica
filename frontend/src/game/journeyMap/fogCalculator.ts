/**
 * journeyMap/fogCalculator.ts — PUSH 10
 *
 * Pure fog-of-war visibility logic.  No React, no Expo, no I/O.
 *
 * THREE VISIBILITY STATES
 * ───────────────────────
 *   hidden   — not adjacent to the player's current tile; fully fogged
 *   frontier — directly adjacent to the player's current tile; selectable,
 *              fog-covered, encounter content NOT revealed
 *   revealed — player has stepped on this tile at least once;
 *              permanently uncovered; encounter content visible
 *
 * ENCOUNTER PRIVACY RULE (enforced in the renderer, tested here)
 * ───────────────────────────────────────────────────────────────
 *   A tile's encounter type may only be shown when:
 *     tile.current === true  OR  tile.visibility === 'revealed'
 *   For all other states (hidden / frontier), encounter MUST stay masked.
 *
 * FRONTIER SHRINKS AND MOVES
 * ──────────────────────────
 *   Frontier is defined as "adjacent to the player's CURRENT tile," NOT
 *   "adjacent to any revealed tile."  This means:
 *   • Tiles behind the player that are no longer adjacent to the current
 *     position revert to hidden — unless the player has already visited
 *     them (visited tiles are permanently revealed).
 *   • The frontier is a narrow ring that moves with the player.
 */

import type { JourneyTile, TileVisibility } from './types';

// ── Hex adjacency ─────────────────────────────────────────────────────────────

export const AXIAL_DIRS = [
  { q:  1, r:  0 },
  { q: -1, r:  0 },
  { q:  0, r:  1 },
  { q:  0, r: -1 },
  { q:  1, r: -1 },
  { q: -1, r:  1 },
] as const;

/**
 * Returns the 6 axial neighbor tile-key strings ("q,r") for a given position.
 * The caller is responsible for filtering out keys that don't exist in the
 * current tile set.
 */
export function axialNeighborKeys(q: number, r: number): string[] {
  return AXIAL_DIRS.map(d => `${q + d.q},${r + d.r}`);
}

/**
 * True when two tiles are exactly one hex step apart (axial distance === 1).
 */
export function isAdjacent(q1: number, r1: number, q2: number, r2: number): boolean {
  const dq = q2 - q1;
  const dr = r2 - r1;
  return AXIAL_DIRS.some(d => d.q === dq && d.r === dr);
}

// ── Fog computation ───────────────────────────────────────────────────────────

/** Minimal tile shape required for initial fog calculation. */
interface TileCoord {
  readonly id: string;
  readonly q:  number;
  readonly r:  number;
}

/**
 * Compute the initial visibility map for a brand-new journey run.
 *
 * Rules:
 *   start tile          → 'revealed'
 *   tiles adjacent d=1  → 'frontier'
 *   all others          → 'hidden'
 *
 * @param tiles    All playable tiles in the run; id must equal "q,r".
 * @param startId  The id of the starting tile.
 * @returns        Map<tileId, TileVisibility>.
 * @throws         If startId is not found in tiles.
 */
export function computeInitialFog(
  tiles:   readonly TileCoord[],
  startId: string,
): Map<string, TileVisibility> {
  const tileIds = new Set(tiles.map(t => t.id));
  const start   = tiles.find(t => t.id === startId);

  if (!start) {
    throw new Error(`fogCalculator: startId "${startId}" not found in tiles`);
  }

  // Only neighbours that actually exist in the tile set become frontier.
  const adjToStart = new Set(
    axialNeighborKeys(start.q, start.r).filter(k => tileIds.has(k)),
  );

  const result = new Map<string, TileVisibility>();
  for (const t of tiles) {
    if (t.id === startId)          result.set(t.id, 'revealed');
    else if (adjToStart.has(t.id)) result.set(t.id, 'frontier');
    else                           result.set(t.id, 'hidden');
  }
  return result;
}

/**
 * Recompute tile visibility after the player moves to `destinationId`.
 *
 * Algorithm (two passes):
 *
 *   Pass 1 — Apply movement:
 *     destination → { visibility: 'revealed', visited: true, current: true }
 *     old current → { current: false }          (visibility stays 'revealed')
 *
 *   Pass 2 — Recompute frontier:
 *     already-revealed tiles → unchanged  (permanent)
 *     adjacent to destination → 'frontier'
 *     all others              → 'hidden'
 *
 * Frontier tiles that are no longer adjacent to the new current tile revert
 * to 'hidden' — UNLESS they were previously visited (which means their
 * visibility is already 'revealed' from Pass 1, so they're handled there).
 *
 * Returns a new array; tiles that don't change are the same object references.
 *
 * @throws If destinationId is not found in tiles.
 */
export function computeFogAfterMove(
  tiles:         readonly JourneyTile[],
  destinationId: string,
): JourneyTile[] {
  const dest = tiles.find(t => t.id === destinationId);
  if (!dest) {
    throw new Error(`fogCalculator: destinationId "${destinationId}" not found in tiles`);
  }

  // ── Pass 1: apply movement ────────────────────────────────────────────────
  const afterMove: JourneyTile[] = tiles.map(t => {
    if (t.id === destinationId) {
      return { ...t, visibility: 'revealed' as TileVisibility, visited: true, current: true };
    }
    if (t.current) {
      return { ...t, current: false };  // was current; stays revealed
    }
    return t;
  });

  // ── Pass 2: recompute frontier (based on NEW current tile = destination) ──
  const neighborOfDest = new Set(axialNeighborKeys(dest.q, dest.r));

  return afterMove.map(t => {
    // Revealed tiles are permanently uncovered — never demoted.
    if (t.visibility === 'revealed') return t;

    const newVis: TileVisibility = neighborOfDest.has(t.id) ? 'frontier' : 'hidden';
    if (newVis === t.visibility) return t;   // no change — reuse object reference
    return { ...t, visibility: newVis };
  });
}

// ── Encounter privacy helper ──────────────────────────────────────────────────

/**
 * Returns true when a tile's encounter content may be displayed.
 *
 * This is the single authoritative rule used by HexMapLayer's `encounterSrc`
 * function and mirrored in tests.
 *
 *   revealed (stepped on)  → show encounter
 *   current position       → show encounter
 *   frontier / hidden      → MASK encounter (never expose content)
 */
export function isEncounterVisible(tile: {
  current:    boolean;
  visibility: TileVisibility;
}): boolean {
  return tile.current || tile.visibility === 'revealed';
}
