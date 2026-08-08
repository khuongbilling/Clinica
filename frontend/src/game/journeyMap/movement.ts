/**
 * journeyMap/movement.ts — PUSH 11
 *
 * Pure movement validation and application logic.
 * No React, no Expo, no I/O — easy to unit-test and reason about.
 *
 * MOVEMENT RULES
 * ──────────────
 *   1. Player may only move to an adjacent hex (axial distance === 1).
 *   2. Destination must be 'frontier' or 'revealed' (not 'hidden').
 *   3. Every successful move costs exactly 1 stamina.
 *   4. All encounter types (none / battle / treasure / merchant / areaBoss)
 *      share the same 1-stamina cost; the encounter itself is free.
 *   5. Backtracking to a previously-visited revealed tile costs 1 stamina.
 *
 * ATOMICITY CONTRACT
 * ──────────────────
 *   validateMove()  — pure predicate, no side effects
 *   applyMoveToRun() — pure transformation, returns a new JourneyRun
 *
 *   The caller (fog-map.tsx) is responsible for:
 *     1. Calling validateMove()
 *     2. Deducting 1 stamina via spendStamina() (store action with
 *        synchronous ref-based critical section — prevents double-spend)
 *     3. Calling applyMoveToRun() and updating React state
 *     4. Persisting the run via repo.saveRun()
 *
 *   If spendStamina() returns false (race condition between validate and
 *   deduct), the caller bails and nothing else changes.
 */

import { isAdjacent, computeFogAfterMove } from './fogCalculator';
import type { JourneyRun } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MoveFailReason =
  | 'NOT_ADJACENT'          // destination is not a hex neighbor of current tile
  | 'NOT_REACHABLE'         // destination is hidden, or doesn't exist, or no current tile
  | 'INSUFFICIENT_STAMINA'; // player has < 1 stamina

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
 *   • destination must be 'frontier' or 'revealed' (never 'hidden')
 *   • player must have at least 1 stamina
 *
 * @param run      Current journey run state.
 * @param destId   Tile id the player wants to move to.
 * @param stamina  Player's current stamina (live-computed from regen).
 */
export function validateMove(
  run:     JourneyRun,
  destId:  string,
  stamina: number,
): ValidateResult {
  const current = run.tiles.find(t => t.current);
  const dest    = run.tiles.find(t => t.id === destId);

  // Guard: destination must exist and a current tile must be set.
  if (!dest || !current) return { ok: false, reason: 'NOT_REACHABLE' };

  // Guard: must be a direct hex neighbor.
  if (!isAdjacent(current.q, current.r, dest.q, dest.r)) {
    return { ok: false, reason: 'NOT_ADJACENT' };
  }

  // Guard: destination must be visible (frontier or previously revealed).
  if (dest.visibility !== 'frontier' && dest.visibility !== 'revealed') {
    return { ok: false, reason: 'NOT_REACHABLE' };
  }

  // Guard: must have stamina.
  if (stamina < 1) return { ok: false, reason: 'INSUFFICIENT_STAMINA' };

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
 * @param run    Current run (unmodified).
 * @param destId Tile id to move to (must have already passed validateMove).
 * @returns      A new JourneyRun with the move applied.
 */
export function applyMoveToRun(run: JourneyRun, destId: string): JourneyRun {
  const dest            = run.tiles.find(t => t.id === destId);
  const wasAlreadyVisited = dest?.visited ?? false;

  // Recompute fog: destination revealed + frontier ring updates.
  const tiles = computeFogAfterMove(run.tiles, destId);

  return {
    ...run,
    tiles,
    currentTileId:     destId,
    staminaSpent:      run.staminaSpent + 1,
    // exploredTileCount counts tiles the player has stepped on (visited).
    // Backtracking to an already-visited tile does not increase the count.
    exploredTileCount: wasAlreadyVisited
      ? run.exploredTileCount
      : run.exploredTileCount + 1,
    updatedAt:         new Date().toISOString(),
  };
}

// ── Convenience ───────────────────────────────────────────────────────────────

/** The stamina cost of every single move, regardless of encounter type. */
export const MOVE_STAMINA_COST = 1 as const;
