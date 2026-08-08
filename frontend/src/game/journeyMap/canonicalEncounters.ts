/**
 * canonicalEncounters.ts — Push 2: one-roll-per-tile canonical encounter generator.
 *
 * Algorithm
 * ─────────
 * 1. Build initial rate weights from canonicalConfig (chapter + timeOfDay).
 * 2. Separate all topology tiles into eligible (rolled) vs frozen (start, gate).
 * 3. Fisher-Yates shuffle the eligible tile processing order so that cap
 *    cut-offs do not systematically bias one region of the map.
 * 4. For each eligible tile in shuffled order:
 *    a. Copy the base weights into a per-tile live-weights object.
 *    b. Zero-out categories that have hit their cap (accumulative state):
 *         - areaBoss:  count ≥ CANONICAL_AREA_BOSS_HARD_MAX  OR  tile distance < 3
 *         - battle:    count ≥ battleDensityCap (computed from canonicalConfig)
 *    c. Perform exactly ONE weighted categorical roll.
 *    d. Increment the counter for the chosen category.
 *    e. If encounter === 'treasure': immediately roll a ChestTier from the
 *       canonical chest-quality distribution.
 *    f. If encounter === 'wardEvent': immediately roll a WardEventSubtype
 *       from the uniform five-type distribution.
 * 5. Frozen tiles (start, gate) are always 'none'; no roll is performed.
 *
 * Determinism guarantee
 * ─────────────────────
 * The PRNG is seeded as  mulberry32(fnv1a32(`${seed}:canonical:${chapter}:${timeOfDay}`))
 * so identical (seed, chapter, timeOfDay) inputs always produce identical output.
 *
 * What is unchanged
 * ─────────────────
 * encounters.ts and all code that calls assignJourneyEncounters() are not
 * touched.  This module is NOT yet wired to the journey run lifecycle;
 * it will be connected when JOURNEY_CANONICAL_V1 is enabled in a later push.
 */

import { mulberry32, fnv1a32 } from './prng';
import type { HexTopology } from './topology';
import type { ChestTier } from './types';
import {
  CANONICAL_TOTAL_BP,
  CANONICAL_AREA_BOSS_HARD_MAX,
  canonicalEncounterRatesBp,
  canonicalChestQualityRatesBp,
  canonicalEnemyDensityCapBp,
  type TimeOfDay,
} from './canonicalConfig';

// ── Public types ───────────────────────────────────────────────────────────────

/**
 * Superset of the existing EncounterType that adds canonical encounter categories.
 * The extra categories are only produced when the corresponding feature flag is
 * active at the generator call site.
 */
export type CanonicalEncounterType =
  | 'none'
  | 'battle'
  | 'treasure'
  | 'merchant'
  | 'areaBoss'
  | 'wardEvent';

/**
 * Subtypes for wardEvent tiles.  Assigned deterministically at generation time.
 * Full descriptions live in the ward-events content layer (future push).
 */
export type WardEventSubtype =
  | 'critical_care'     // High-acuity single patient
  | 'emergency_triage'  // Multiple patients needing sorting
  | 'code_response'     // Code blue / rapid response
  | 'med_audit'         // Medication reconciliation review
  | 'shift_handoff';    // Complex end-of-shift scenario

export const WARD_EVENT_SUBTYPES: readonly WardEventSubtype[] = [
  'critical_care',
  'emergency_triage',
  'code_response',
  'med_audit',
  'shift_handoff',
];

/** A tile with its canonical encounter, chest tier, and ward-event subtype. */
export interface CanonicalAssignedTile {
  readonly tileKey:               string;
  readonly q:                     number;
  readonly r:                     number;
  readonly graphDistanceFromStart: number;
  encounter:                      CanonicalEncounterType;
  /** Only defined when encounter === 'treasure'. */
  chestTier?:                     ChestTier;
  /** Only defined when encounter === 'wardEvent'. */
  wardEventSubtype?:              WardEventSubtype;
}

export interface CanonicalEncounterAssignment {
  tiles:          CanonicalAssignedTile[];
  areaBossCount:  number;
  battleCount:    number;
  treasureCount:  number;
  merchantCount:  number;
  wardEventCount: number;
}

export interface CanonicalAssignEncountersOptions {
  chapter:   number;
  seed:      string | number;
  timeOfDay: TimeOfDay;
  topology:  HexTopology;
}

// ── Private helpers ────────────────────────────────────────────────────────────

/** In-place Fisher-Yates shuffle using the seeded RNG. */
function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
}

/**
 * One weighted categorical roll over a `weights` object (values in any unit;
 * zero-weight entries are ineligible).  If all weights are zero, returns 'none'
 * as a safe fallback.
 */
function weightedRoll(weights: Record<string, number>, rng: () => number): string {
  const entries = Object.entries(weights);
  const total   = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return 'none';
  let x = rng() * total;
  for (const [key, val] of entries) {
    x -= val;
    if (x <= 0) return key;
  }
  // Floating-point rounding safety: return the last non-zero key.
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i][1] > 0) return entries[i][0];
  }
  return 'none';
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Assign canonical encounter types and subtypes to all tiles in the topology.
 *
 * Pure and deterministic: same (seed, chapter, timeOfDay, topology) → same output.
 * Does not modify the supplied topology.
 */
export function assignCanonicalEncounters({
  chapter,
  seed,
  timeOfDay,
  topology,
}: CanonicalAssignEncountersOptions): CanonicalEncounterAssignment {
  // ── PRNG ─────────────────────────────────────────────────────────────────────
  // Namespace includes timeOfDay so day/evening/night streams are fully independent.
  const rng = mulberry32(fnv1a32(`${seed}:canonical:${chapter}:${timeOfDay}`));

  // ── Base rates (constant for this run) ────────────────────────────────────────
  const baseRates     = canonicalEncounterRatesBp(chapter, timeOfDay);
  const chestRates    = canonicalChestQualityRatesBp(chapter);
  const frozenKeys    = new Set([topology.startTileId, topology.gateAnchorId]);

  // ── Partition tiles ───────────────────────────────────────────────────────────
  type EligibleEntry = { tileKey: string; q: number; r: number; dist: number };
  type FrozenEntry   = { tileKey: string; q: number; r: number; dist: number };

  const eligibleTiles: EligibleEntry[] = [];
  const frozenTiles:   FrozenEntry[]   = [];

  for (const coord of topology.tiles) {
    const tileKey = `${coord.q},${coord.r}`;
    const dist    = topology.graphDistances.get(tileKey) ?? 0;
    if (frozenKeys.has(tileKey)) {
      frozenTiles.push({ tileKey, q: coord.q, r: coord.r, dist });
    } else {
      eligibleTiles.push({ tileKey, q: coord.q, r: coord.r, dist });
    }
  }

  // ── Shuffle processing order ───────────────────────────────────────────────────
  // Must happen before any rolls so cap cut-offs are not geographically biased.
  shuffleInPlace(eligibleTiles, rng);

  // ── Cap budgets ───────────────────────────────────────────────────────────────
  const eligibleCount    = eligibleTiles.length;
  const densityCapBp     = canonicalEnemyDensityCapBp(timeOfDay);
  const battleDensityCap = Math.floor(eligibleCount * densityCapBp / CANONICAL_TOTAL_BP);

  // ── Rolling loop ──────────────────────────────────────────────────────────────
  let areaBossCount  = 0;
  let battleCount    = 0;
  let treasureCount  = 0;
  let merchantCount  = 0;
  let wardEventCount = 0;

  const resultTiles: CanonicalAssignedTile[] = [];

  for (const tile of eligibleTiles) {
    // Per-tile live weights: start from the base and zero out capped categories.
    // Using spread so the base is never mutated.
    const liveWeights: Record<string, number> = { ...baseRates };

    // Area boss: hard maximum
    if (areaBossCount >= CANONICAL_AREA_BOSS_HARD_MAX) {
      liveWeights.areaBoss = 0;
    }
    // Area boss: distance constraint (must be ≥ 3 graph hops from start)
    if (tile.dist < 3) {
      liveWeights.areaBoss = 0;
    }
    // Battle: density ceiling (proportion of eligible tiles)
    if (battleCount >= battleDensityCap) {
      liveWeights.battle = 0;
    }

    // ── Single roll ─────────────────────────────────────────────────────────────
    const encounter = weightedRoll(liveWeights, rng) as CanonicalEncounterType;

    // Update counters before building the tile so the next tile sees the
    // updated cap state via the counters at the top of the loop.
    if (encounter === 'areaBoss')  areaBossCount++;
    if (encounter === 'battle')    battleCount++;
    if (encounter === 'treasure')  treasureCount++;
    if (encounter === 'merchant')  merchantCount++;
    if (encounter === 'wardEvent') wardEventCount++;

    const assignedTile: CanonicalAssignedTile = {
      tileKey:               tile.tileKey,
      q:                     tile.q,
      r:                     tile.r,
      graphDistanceFromStart: tile.dist,
      encounter,
    };

    // Chest tier: assigned immediately on treasure roll from the same RNG stream.
    if (encounter === 'treasure') {
      assignedTile.chestTier = weightedRoll(chestRates as unknown as Record<string, number>, rng) as ChestTier;
    }

    // Ward event subtype: uniform selection from the five canonical subtypes.
    if (encounter === 'wardEvent') {
      const idx = Math.floor(rng() * WARD_EVENT_SUBTYPES.length);
      assignedTile.wardEventSubtype = WARD_EVENT_SUBTYPES[idx];
    }

    resultTiles.push(assignedTile);
  }

  // ── Frozen tiles ─────────────────────────────────────────────────────────────
  for (const tile of frozenTiles) {
    resultTiles.push({
      tileKey:               tile.tileKey,
      q:                     tile.q,
      r:                     tile.r,
      graphDistanceFromStart: tile.dist,
      encounter:             'none',
    });
  }

  return {
    tiles: resultTiles,
    areaBossCount,
    battleCount,
    treasureCount,
    merchantCount,
    wardEventCount,
  };
}
