/**
 * journeyMap/fogCalculator.ts — PUSH 10 / PUSH 15 rename
 *
 * Pure fog-of-war visibility logic.  No React, no Expo, no I/O.
 *
 * THREE VISIBILITY STATES (spec rule 5)
 * ───────────────────────
 *   unexplored            — not within the player's reveal radius; fully fogged
 *   visibleNow            — within REVEAL_RADIUS of the player's current tile;
 *                           selectable, fog-free, encounter content NOT revealed
 *                           until the player steps on the tile
 *   exploredButOutOfVision — player has stepped on this tile at least once;
 *                           permanently uncovered; encounter content visible
 *
 * ENCOUNTER PRIVACY RULE (enforced in the renderer, tested here)
 * ───────────────────────────────────────────────────────────────
 *   A tile's encounter type may only be shown when:
 *     tile.current === true  OR  tile.visibility === 'exploredButOutOfVision'
 *   For all other states (unexplored / visibleNow), encounter MUST stay masked.
 *
 * REVEAL RADIUS
 * ─────────────
 *   REVEAL_RADIUS = 1 by default (spec rule 4).
 *   Future skills / class bonuses may increase this value.
 *   Pass a custom radius to computeInitialFog / computeFogAfterMove if needed.
 *
 * FRONTIER SHRINKS AND MOVES
 * ──────────────────────────
 *   visibleNow is defined as "within REVEAL_RADIUS of the player's CURRENT
 *   tile," NOT "adjacent to any explored tile."  This means:
 *   • Tiles behind the player that are no longer within radius of the current
 *     position revert to unexplored — unless the player has already visited
 *     them (visited tiles are permanently exploredButOutOfVision).
 *   • The visibleNow ring moves with the player.
 */

import type { JourneyTile, TileVisibility } from './types';

// ── Configurable reveal radius ─────────────────────────────────────────────────

/**
 * Default player field-of-vision radius in hex steps (spec rule 4).
 * 1 = current tile + all direct neighbours.
 * Future skills / class bonuses may pass a larger value to the fog functions.
 */
export const REVEAL_RADIUS = 1 as const;

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

/**
 * Axial (cube-coordinate) hex distance between two tiles.
 * Accepts object params for ergonomic call-site usage.
 *
 * Formula (cube-coordinate / axial form):
 *   dq = a.q − b.q,  dr = a.r − b.r,  ds = (a.q+a.r) − (b.q+b.r)
 *   distance = (|dq| + |dr| + |ds|) / 2
 *
 * Mathematically equivalent to the scalar axialDistance() below but with the
 * {q, r} object signature expected by visionConfig and external callers.
 */
export function axialHexDistance(
  a: { q: number; r: number },
  b: { q: number; r: number },
): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = (a.q + a.r) - (b.q + b.r);
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

/**
 * Axial (hex grid) distance between two tiles — scalar param variant.
 * Used internally by tilesWithinRadius and isAdjacent.
 * dist = max(|dq|, |dr|, |dq+dr|) — equivalent to (|dq|+|dr|+|ds|)/2.
 */
export function axialDistance(q1: number, r1: number, q2: number, r2: number): number {
  const dq = q2 - q1;
  const dr = r2 - r1;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

/**
 * Collect all tile ids within `radius` hex steps of (cq, cr).
 * Returns a Set<string> of "q,r" keys that exist in the supplied tile set.
 */
function tilesWithinRadius(
  cq: number,
  cr: number,
  radius: number,
  tileIds: Set<string>,
): Set<string> {
  const result = new Set<string>();
  // BFS / brute-force over the axial range — fine for small radius values.
  for (const id of tileIds) {
    const [q, r] = id.split(',').map(Number);
    if (axialDistance(cq, cr, q, r) <= radius) result.add(id);
  }
  return result;
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
 *   start tile                      → 'exploredButOutOfVision'
 *   tiles within radius of start    → 'visibleNow'
 *   all others                      → 'unexplored'
 *
 * @param tiles    All playable tiles in the run; id must equal "q,r".
 * @param startId  The id of the starting tile.
 * @param radius   Reveal radius (default: REVEAL_RADIUS = 1).
 * @returns        Map<tileId, TileVisibility>.
 * @throws         If startId is not found in tiles.
 */
export function computeInitialFog(
  tiles:   readonly TileCoord[],
  startId: string,
  radius:  number = REVEAL_RADIUS,
): Map<string, TileVisibility> {
  const tileIds = new Set(tiles.map(t => t.id));
  const start   = tiles.find(t => t.id === startId);

  if (!start) {
    throw new Error(`fogCalculator: startId "${startId}" not found in tiles`);
  }

  const inRadius = tilesWithinRadius(start.q, start.r, radius, tileIds);

  const result = new Map<string, TileVisibility>();
  for (const t of tiles) {
    if (t.id === startId)        result.set(t.id, 'exploredButOutOfVision');
    else if (inRadius.has(t.id)) result.set(t.id, 'visibleNow');
    else                         result.set(t.id, 'unexplored');
  }
  return result;
}

/**
 * Recompute tile visibility after the player moves to `destinationId`.
 *
 * Algorithm (two passes):
 *
 *   Pass 1 — Apply movement:
 *     destination → { visibility: 'exploredButOutOfVision', visited: true, current: true }
 *     old current → { current: false }   (visibility stays 'exploredButOutOfVision')
 *
 *   Pass 2 — Recompute visibleNow ring:
 *     already-exploredButOutOfVision tiles → unchanged (permanent)
 *     within radius of destination         → 'visibleNow'
 *     in nextExploredIds but outside FOV   → 'exploredButOutOfVision' (remembered)
 *     never seen                           → 'unexplored'
 *
 * PUSH 6 — REMEMBERED TERRAIN
 * ─────────────────────────────
 *   `exploredTileIds` is the caller-provided set of tile IDs that have EVER
 *   entered the player's field of vision.  Any tile in this set that falls
 *   outside the current FOV radius is shown as 'exploredButOutOfVision'
 *   (remembered with light haze) rather than reverting to 'unexplored'.
 *
 *   The returned `exploredTileIds` is the grown set (input + destination +
 *   new FOV ring).  Callers must persist this on the run.
 *
 * Returns a new array; tiles that don't change are the same object references.
 *
 * @param radius          Reveal radius (default: REVEAL_RADIUS = 1).
 * @param exploredTileIds Tile IDs ever seen; grows with every move (default: empty).
 * @throws If destinationId is not found in tiles.
 */
export function computeFogAfterMove(
  tiles:           readonly JourneyTile[],
  destinationId:   string,
  radius:          number = REVEAL_RADIUS,
  exploredTileIds: ReadonlySet<string> = new Set(),
): { tiles: JourneyTile[]; exploredTileIds: Set<string> } {
  const dest = tiles.find(t => t.id === destinationId);
  if (!dest) {
    throw new Error(`fogCalculator: destinationId "${destinationId}" not found in tiles`);
  }

  // ── Pass 1: apply movement ────────────────────────────────────────────────
  const afterMove: JourneyTile[] = tiles.map(t => {
    if (t.id === destinationId) {
      return { ...t, visibility: 'exploredButOutOfVision' as TileVisibility, visited: true, current: true };
    }
    if (t.current) {
      return { ...t, current: false };  // was current; stays exploredButOutOfVision
    }
    return t;
  });

  // ── Grow explored set: destination + new FOV ring ─────────────────────────
  // Build BEFORE Pass 2 so the new ring is included in the memory check.
  const tileIds        = new Set(tiles.map(t => t.id));
  const inRadiusOfDest = tilesWithinRadius(dest.q, dest.r, radius, tileIds);

  const nextExplored = new Set(exploredTileIds);
  nextExplored.add(destinationId);
  for (const id of inRadiusOfDest) nextExplored.add(id);

  // ── Pass 2: recompute visibleNow ring (based on NEW current = destination) ─
  const resultTiles = afterMove.map(t => {
    // exploredButOutOfVision tiles are permanently uncovered — never demoted.
    if (t.visibility === 'exploredButOutOfVision') return t;

    const inFov    = inRadiusOfDest.has(t.id);
    const everSeen = nextExplored.has(t.id);

    // Priority: in FOV now → visibleNow
    //           seen before but outside FOV → exploredButOutOfVision (remembered)
    //           never in FOV → unexplored (dense fog)
    const newVis: TileVisibility = inFov    ? 'visibleNow'
                                 : everSeen ? 'exploredButOutOfVision'
                                 :            'unexplored';

    if (newVis === t.visibility) return t;   // no change — reuse object reference
    return { ...t, visibility: newVis };
  });

  return { tiles: resultTiles, exploredTileIds: nextExplored };
}

// ── Encounter privacy helper ──────────────────────────────────────────────────

/**
 * Returns true when a tile's encounter content may be displayed.
 *
 * This is the single authoritative rule used by HexMapLayer's `encounterSrc`
 * function and mirrored in tests.
 *
 *   exploredButOutOfVision (stepped on)  → show encounter
 *   current position                     → show encounter
 *   visibleNow / unexplored              → MASK encounter (never expose content)
 */
export function isEncounterVisible(tile: {
  current:    boolean;
  visibility: TileVisibility;
}): boolean {
  return tile.current || tile.visibility === 'exploredButOutOfVision';
}
