/**
 * journeyMap/movement.ts — PUSH 11 / PUSH 15 rename
 *
 * Pure movement validation and application logic.
 * No React, no Expo, no I/O — easy to unit-test and reason about.
 *
 * MOVEMENT RULES
 * ──────────────
 *   1. Player may only move to an adjacent hex (axial distance === 1).
 *   2. Destination must be 'visibleNow' or 'exploredButOutOfVision' (not 'unexplored').
 *   3. Walking, backtracking, discovery, chests, merchants, and gates are free.
 *   4. The caller charges only when a battle or authored hazard is committed.
 *
 * ATOMICITY CONTRACT
 * ──────────────────
 *   validateMove()  — pure predicate, no side effects
 *   applyMoveToRun() — pure transformation, returns a new JourneyRun
 *
 *   The caller (fog-map.tsx) is responsible for:
 *     1. Calling validateMove()
 *     2. Calling applyMoveToRun() and updating React state
 *     3. Persisting the run via repo.saveRun()
 */

import { isAdjacent, computeFogAfterMove, REVEAL_RADIUS } from './fogCalculator';
import type { JourneyRun } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MoveFailReason =
  | 'NOT_ADJACENT'          // destination is not a hex neighbor of current tile
  | 'NOT_REACHABLE'         // destination is unexplored, or doesn't exist, or no current tile
  | 'GATE_TILE';            // destination is the boss-gate anchor — interact from adjacent tile

export type ValidateResult =
  | { ok: true }
  | { ok: false; reason: MoveFailReason };

// ── validateMove ──────────────────────────────────────────────────────────────

/**
 * Pure validation: checks all pre-conditions for a move without applying it.
 *
 * Guards:
 *   • destination must exist in the run's tile array
 *   • destination must be adjacent (axial distance === 1) to the current tile
 *   • destination must be 'visibleNow' or 'exploredButOutOfVision' (never 'unexplored')
 *
 * @param run      Current journey run state.
 * @param destId   Tile id the player wants to move to.
 * @param _stamina Deprecated compatibility argument. Movement is free.
 */
export function validateMove(
  run:     JourneyRun,
  destId:  string,
  _stamina?: number,
): ValidateResult {
  const current = run.tiles.find(t => t.current);
  const dest    = run.tiles.find(t => t.id === destId);

  // Guard: destination must exist and a current tile must be set.
  if (!dest || !current) return { ok: false, reason: 'NOT_REACHABLE' };

  // Guard: must be a direct hex neighbor.
  if (!isAdjacent(current.q, current.r, dest.q, dest.r)) {
    return { ok: false, reason: 'NOT_ADJACENT' };
  }

  // Guard: destination must be visible (visibleNow or previously explored).
  if (dest.visibility !== 'visibleNow' && dest.visibility !== 'exploredButOutOfVision') {
    return { ok: false, reason: 'NOT_REACHABLE' };
  }

  // Guard: the boss-gate anchor tile is not a movement destination.
  // Players interact with the gate by tapping it from an adjacent tile;
  // the handleTilePress dispatch table already redirects gate taps to
  // handleGateTap() before validateMove is reached, so this is a
  // safety backstop for any future programmatic move paths.
  if (run.gateAnchorTileId && dest.id === run.gateAnchorTileId) {
    return { ok: false, reason: 'GATE_TILE' };
  }

  return { ok: true };
}

// ── applyMoveToRun ────────────────────────────────────────────────────────────

/**
 * Apply a validated move to the run. Pure — no I/O, no side effects.
 *
 * Does NOT deduct player stamina — the caller does that via spendStamina()
 * before calling this function.
 *
 * What changes:
 *   • tile visibility/current/visited flags updated via computeFogAfterMove()
 *   • run.currentTileId → destinationId
 *   • run.staminaSpent  → +1
 *   • run.exploredTileCount → +1 if this tile had not been visited before
 *   • run.updatedAt     → current ISO timestamp
 *
 * @param run          Current run (unmodified).
 * @param destId       Tile id to move to (must have already passed validateMove).
 * @param visionRadius Effective field-of-vision radius (default: REVEAL_RADIUS = 1).
 *                     Pass the result of computeEffectiveVisionRadius() from visionConfig
 *                     to apply class passive bonuses, temporary buffs, or scouting skills.
 * @returns            A new JourneyRun with the move applied.
 */
export function applyMoveToRun(
  run:          JourneyRun,
  destId:       string,
  visionRadius: number = REVEAL_RADIUS,
): JourneyRun {
  const dest              = run.tiles.find(t => t.id === destId);
  const wasAlreadyVisited = dest?.visited ?? false;

  // Recompute fog using the player's effective vision radius.
  // visionRadius=1 (default) → current tile + 1 ring; class/skill bonuses add rings.
  // Pass the persistent exploredTileIds set so tiles that have ever been in FOV
  // become 'exploredButOutOfVision' (remembered terrain) instead of reverting
  // to 'unexplored' (dense fog) when they fall outside the current radius.
  const { tiles, exploredTileIds } = computeFogAfterMove(
    run.tiles,
    destId,
    visionRadius,
    new Set(run.exploredTileIds),
  );

  return {
    ...run,
    tiles,
    exploredTileIds:   [...exploredTileIds],
    currentTileId:     destId,
    staminaSpent:      run.staminaSpent,
    // exploredTileCount counts tiles the player has stepped on (visited).
    // Backtracking to an already-visited tile does not increase the count.
    exploredTileCount: wasAlreadyVisited
      ? run.exploredTileCount
      : run.exploredTileCount + 1,
    updatedAt:         new Date().toISOString(),
  };
}

// ── Convenience ───────────────────────────────────────────────────────────────

/** Ordinary Journey movement is intentionally never a stamina sink. */
export const MOVE_STAMINA_COST = 0 as const;
