/**
 * journeyMap/validate.ts
 *
 * Pure validation helpers for fog-map domain objects.
 * All functions return a (possibly empty) array of human-readable error strings.
 * An empty array means the input is valid.
 *
 * No imports from React, Expo, or any UI layer belong here.
 */

import { TOTAL_BP, CHEST_BRONZE_MIN_BP, CHEST_GOLD_MAX_BP } from './config';
import type { EncounterRates, ChestQualityRates } from './config';
import type { JourneyRun, JourneyTile } from './types';

// ── Encounter rates ───────────────────────────────────────────────────────────

/**
 * Validates that an EncounterRates object is internally consistent:
 * - All individual rates are non-negative.
 * - Rates sum to exactly TOTAL_BP (10 000).
 */
export function validateEncounterRates(
  cfg: EncounterRates,
  chapter: number,
): string[] {
  const errors: string[] = [];
  const { rates } = cfg;

  let sum = 0;
  for (const [key, bp] of Object.entries(rates)) {
    if (bp < 0) errors.push(`ch${chapter}: ${key} rate is negative (${bp} bp)`);
    sum += bp;
  }
  if (sum !== TOTAL_BP) {
    errors.push(`ch${chapter}: encounter rates sum to ${sum} bp (expected ${TOTAL_BP})`);
  }
  return errors;
}

// ── Chest quality rates ───────────────────────────────────────────────────────

/**
 * Validates that a ChestQualityRates object is internally consistent:
 * - All individual rates are non-negative.
 * - Rates sum to exactly TOTAL_BP (10 000).
 * - Bronze ≥ CHEST_BRONZE_MIN_BP (4 000 bp = 40%).
 * - Gold ≤ CHEST_GOLD_MAX_BP (1 500 bp = 15%).
 * - Silver ≥ 0 (implied by the sum constraint + the bronze/gold bounds,
 *   but checked explicitly for clarity).
 */
export function validateChestQualityRates(
  cfg: ChestQualityRates,
  chapter: number,
): string[] {
  const errors: string[] = [];
  const { bronze, silver, gold } = cfg.rates;

  if (bronze < 0)  errors.push(`ch${chapter}: bronze chest rate is negative (${bronze} bp)`);
  if (silver < 0)  errors.push(`ch${chapter}: silver chest rate is negative (${silver} bp)`);
  if (gold   < 0)  errors.push(`ch${chapter}: gold chest rate is negative (${gold} bp)`);

  if (bronze < CHEST_BRONZE_MIN_BP) {
    errors.push(`ch${chapter}: bronze (${bronze} bp) is below minimum (${CHEST_BRONZE_MIN_BP} bp)`);
  }
  if (gold > CHEST_GOLD_MAX_BP) {
    errors.push(`ch${chapter}: gold (${gold} bp) exceeds maximum (${CHEST_GOLD_MAX_BP} bp)`);
  }

  const sum = bronze + silver + gold;
  if (sum !== TOTAL_BP) {
    errors.push(`ch${chapter}: chest quality rates sum to ${sum} bp (expected ${TOTAL_BP})`);
  }
  return errors;
}

// ── Tile ─────────────────────────────────────────────────────────────────────

/**
 * Validates a single JourneyTile:
 * - chestTier is only set when encounter === 'treasure'.
 * - areaBossKeyClaimed is only true when encounter === 'areaBoss'.
 * - resolved implies visited (you must have visited to resolve).
 */
export function validateTile(tile: JourneyTile): string[] {
  const errors: string[] = [];
  const { id, encounter, chestTier, areaBossKeyClaimed, resolved, visited } = tile;

  if (chestTier !== undefined && encounter !== 'treasure') {
    errors.push(`tile ${id}: chestTier is set but encounter is '${encounter}' (must be 'treasure')`);
  }
  if (encounter === 'treasure' && chestTier === undefined) {
    errors.push(`tile ${id}: encounter is 'treasure' but chestTier is missing`);
  }
  if (areaBossKeyClaimed && encounter !== 'areaBoss') {
    errors.push(`tile ${id}: areaBossKeyClaimed is true but encounter is '${encounter}'`);
  }
  if (resolved && !visited) {
    errors.push(`tile ${id}: resolved is true but visited is false (must visit before resolving)`);
  }
  return errors;
}

// ── Run ──────────────────────────────────────────────────────────────────────

/**
 * Validates a JourneyRun for structural consistency:
 * - tileCount matches the actual tiles array length.
 * - startTileId and currentTileId reference real tile ids.
 * - Every tile passes validateTile.
 * - Denormalised counters (areaBossCount, areaBossKeysCollected, exploredTileCount)
 *   match what can be derived from the tiles array.
 */
export function validateRun(run: JourneyRun): string[] {
  const errors: string[] = [];

  // Tile count
  if (run.tiles.length !== run.tileCount) {
    errors.push(
      `run ch${run.chapterId}: tileCount (${run.tileCount}) ≠ tiles.length (${run.tiles.length})`,
    );
  }

  const tileIndex = new Map(run.tiles.map((t) => [t.id, t]));

  // Reference integrity
  if (!tileIndex.has(run.startTileId)) {
    errors.push(`run ch${run.chapterId}: startTileId '${run.startTileId}' not found in tiles`);
  }
  if (!tileIndex.has(run.currentTileId)) {
    errors.push(`run ch${run.chapterId}: currentTileId '${run.currentTileId}' not found in tiles`);
  }
  if (run.gateAnchorTileId !== undefined && !tileIndex.has(run.gateAnchorTileId)) {
    errors.push(`run ch${run.chapterId}: gateAnchorTileId '${run.gateAnchorTileId}' not found in tiles`);
  }

  // Per-tile validation
  for (const tile of run.tiles) {
    errors.push(...validateTile(tile));
  }

  // Denormalised counter cross-checks
  const derivedAreaBossCount = run.tiles.filter((t) => t.encounter === 'areaBoss').length;
  if (run.areaBossCount !== derivedAreaBossCount) {
    errors.push(
      `run ch${run.chapterId}: areaBossCount (${run.areaBossCount}) ≠ derived (${derivedAreaBossCount})`,
    );
  }

  const derivedKeysCollected = run.tiles.filter((t) => t.areaBossKeyClaimed).length;
  if (run.areaBossKeysCollected !== derivedKeysCollected) {
    errors.push(
      `run ch${run.chapterId}: areaBossKeysCollected (${run.areaBossKeysCollected}) ≠ derived (${derivedKeysCollected})`,
    );
  }

  const derivedExplored = run.tiles.filter((t) => t.visibility !== 'hidden').length;
  if (run.exploredTileCount !== derivedExplored) {
    errors.push(
      `run ch${run.chapterId}: exploredTileCount (${run.exploredTileCount}) ≠ derived (${derivedExplored})`,
    );
  }

  return errors;
}
