/**
 * fog/fogVision.ts — pure field-of-vision calculations
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png
 *
 * REFERENCE ONLY. Never render that file in gameplay.
 *
 * No React, no Expo, no I/O.  Every export is a pure function.
 *
 * ── Field of Vision formula ───────────────────────────────────────────────────
 *
 *   effectiveFoV = clamp(
 *     baseFieldOfVision
 *       + classBonus
 *       + skillBonus
 *       + equipmentBonus
 *       + temporaryBonus,
 *     FOV_MIN,
 *     FOV_MAX,
 *   )
 *
 * ── Visibility rules ──────────────────────────────────────────────────────────
 *
 *   VISIBLE_NOW  axialHexDistance(currentTile, tile) <= effectiveFoV
 *   EXPLORED     tile has EVER been VISIBLE_NOW during the active JourneyRun
 *                (persisted in exploredTileIds — never demoted to UNEXPLORED)
 *   UNEXPLORED   neither currently visible nor previously explored
 *
 * ── Shift / time-of-day ───────────────────────────────────────────────────────
 *
 *   Day / Evening / Night do NOT automatically alter Field of Vision.
 *   Shift affects fog art colour only (handled by the rendering layer).
 */

import type { FogVisibility, FovBonuses, VisionConfig } from './fog.types';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * All players begin with a base field of vision of 1 hex step.
 * Radius 1 = current tile + all 6 adjacent neighbours.
 */
export const BASE_FIELD_OF_VISION = 1 as const;

/** Minimum effective FoV after all bonuses (always at least current tile + ring). */
export const FOV_MIN = 1 as const;

/** Maximum effective FoV — beyond 4 steps every tile on authored maps is visible. */
export const FOV_MAX = 4 as const;

// ── Hex distance ──────────────────────────────────────────────────────────────

/**
 * Axial (cube-coordinate) hex distance between two tiles.
 *
 * Formula:
 *   dq = a.q − b.q
 *   dr = a.r − b.r
 *   ds = (a.q + a.r) − (b.q + b.r)
 *   distance = (|dq| + |dr| + |ds|) / 2
 *
 * This is the single authoritative implementation for the fog system.
 * fogCalculator.ts carries an identical copy for its own pipeline; the two
 * are kept separate so neither module depends on the other.
 */
export function axialHexDistance(
  a: { q: number; r: number },
  b: { q: number; r: number },
): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds =
    (a.q + a.r) -
    (b.q + b.r);

  return (
    Math.abs(dq) +
    Math.abs(dr) +
    Math.abs(ds)
  ) / 2;
}

// ── Effective FoV ─────────────────────────────────────────────────────────────

/**
 * Computes the player's effective field of vision radius in hex steps,
 * clamped to [FOV_MIN, FOV_MAX].
 *
 * Push 2: all bonuses are 0; result is always BASE_FIELD_OF_VISION (1).
 * Future pushes supply real class / skill / equipment / temporary values.
 */
export function effectiveFieldOfVision(bonuses: FovBonuses): number {
  const raw =
    BASE_FIELD_OF_VISION +
    bonuses.classBonus     +
    bonuses.skillBonus     +
    bonuses.equipmentBonus +
    bonuses.temporaryBonus;

  return Math.max(FOV_MIN, Math.min(FOV_MAX, raw));
}

// ── Visible tile computation ──────────────────────────────────────────────────

/**
 * Returns the set of tile IDs that are VISIBLE_NOW given the player's
 * current position and effective field of vision radius.
 *
 * A tile is VISIBLE_NOW when:
 *   axialHexDistance(currentTile, candidateTile) <= visionRadius
 *
 * The current tile is always included (distance 0).
 *
 * @param currentTile — axial coords of the player's current hex
 * @param tiles       — all tiles in the active run (full set, never filtered)
 * @param visionRadius — result of effectiveFieldOfVision(); defaults to BASE_FIELD_OF_VISION
 */
export function calculateVisibleTileIds({
  currentTile,
  tiles,
  visionRadius = BASE_FIELD_OF_VISION,
}: {
  currentTile:  { q: number; r: number };
  tiles:        ReadonlyArray<{ id: string; q: number; r: number }>;
  visionRadius?: number;
}): ReadonlySet<string> {
  const visible = new Set<string>();
  for (const tile of tiles) {
    if (axialHexDistance(currentTile, tile) <= visionRadius) {
      visible.add(tile.id);
    }
  }
  return visible;
}

// ── Explored-set maintenance ──────────────────────────────────────────────────

/**
 * Returns an updated explored-tile-ID set after the player moves to a new
 * position.  The explored set only ever grows — tiles are never demoted.
 *
 * Call once per move with the NEW current tile and the NEW visible set.
 * The returned set should be persisted on the JourneyRun.
 *
 * @param prevExplored — existing explored set (from the run)
 * @param visibleNow   — result of calculateVisibleTileIds() for the NEW position
 */
export function updateExploredSet(
  prevExplored: ReadonlySet<string>,
  visibleNow:   ReadonlySet<string>,
): ReadonlySet<string> {
  const next = new Set(prevExplored);
  for (const id of visibleNow) next.add(id);
  return next;
}

// ── Per-tile fog state ────────────────────────────────────────────────────────

/**
 * Resolves the canonical FogVisibility for a single tile.
 *
 * Priority:
 *   1. VISIBLE_NOW  — tile is in the current vision set
 *   2. EXPLORED     — tile has been seen before (in the explored set)
 *   3. UNEXPLORED   — tile has never been in the player's FoV
 */
export function resolveTileFogVisibility(
  tileId:      string,
  visibleNow:  ReadonlySet<string>,
  explored:    ReadonlySet<string>,
): FogVisibility {
  if (visibleNow.has(tileId))  return 'VISIBLE_NOW';
  if (explored.has(tileId))    return 'EXPLORED';
  return 'UNEXPLORED';
}

// ── Full snapshot ─────────────────────────────────────────────────────────────

/**
 * Convenience wrapper: given a full tile array, a VisionConfig, and the
 * current explored set, returns a Map<tileId, FogVisibility> for every tile.
 *
 * This is the primary entry point for the rendering layer.
 */
export function computeFogSnapshot({
  tiles,
  config,
  explored,
}: {
  tiles:    ReadonlyArray<{ id: string; q: number; r: number }>;
  config:   VisionConfig;
  explored: ReadonlySet<string>;
}): ReadonlyMap<string, FogVisibility> {
  const radius = effectiveFieldOfVision(config.bonuses);
  const visibleNow = calculateVisibleTileIds({
    currentTile:  config.currentTile,
    tiles,
    visionRadius: radius,
  });

  const snapshot = new Map<string, FogVisibility>();
  for (const tile of tiles) {
    snapshot.set(tile.id, resolveTileFogVisibility(tile.id, visibleNow, explored));
  }
  return snapshot;
}
