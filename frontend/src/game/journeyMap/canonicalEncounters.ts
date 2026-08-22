/**
 * canonicalEncounters.ts — Push 3: zone-aware encounter placement.
 *
 * Algorithm (Push 2 baseline + Push 3 spatial layer)
 * ──────────────────────────────────────────────────
 * 1. Build initial rate weights from canonicalConfig (chapter + timeOfDay).
 * 2. Separate all topology tiles into eligible (rolled) vs frozen (start, gate).
 *    - Compute each tile's zone metadata and dead-end flag from topology.zoneMeta
 *      and adjacency degree.  Tiles without zoneMeta (authored/procedural chapters)
 *      carry undefined zone fields → spatial multipliers are passthrough (×1.0).
 * 3. Fisher-Yates shuffle the eligible tile processing order so that cap
 *    cut-offs do not systematically bias one region of the map.
 * 4. For each eligible tile in shuffled order:
 *    a. Copy the base weights into a per-tile live-weights object.
 *    b. Zero-out categories that have hit their cap (accumulative state):
 *         - areaBoss:  count ≥ CANONICAL_AREA_BOSS_HARD_MAX  OR  tile distance < 3
 *         - battle:    count ≥ battleDensityCap (computed from canonicalConfig)
 *    c. [Push 3] Apply zone-aware spatial multipliers from encounterSpatialWeights.ts.
 *       Multipliers modify WHERE encounters land without changing the rate tables
 *       in canonicalConfig.ts.  The `none` weight is intentionally not multiplied —
 *       it absorbs redistribution naturally.
 *    d. Perform exactly ONE weighted categorical roll.
 *    e. Increment the counter for the chosen category.
 *    f. If encounter === 'treasure': immediately roll a ChestTier.
 *    g. If encounter === 'wardEvent': immediately roll a WardEventSubtype.
 * 5. Frozen tiles (start, gate) are always 'none'; no roll is performed.
 *
 * Determinism guarantee
 * ─────────────────────
 * The PRNG is seeded as  mulberry32(fnv1a32(`${seed}:canonical:${chapter}:${timeOfDay}`))
 * so identical (seed, chapter, timeOfDay) inputs always produce identical output.
 *
 * Rate-table invariant
 * ────────────────────
 * Nothing in this file modifies canonicalConfig.ts.
 * The encounter RATES (30% battle, 5% treasure, etc.) are unchanged.
 * Spatial multipliers redistribute encounters across zone types while
 * keeping the integrated expected count approximately equal to the base-rate
 * prediction.  See encounterSpatialWeights.ts for the preservation analysis.
 */

import { mulberry32, fnv1a32 } from './prng';
import type { HexTopology } from './topology';
import type { ChestTier, WardEventSubtype } from './types';
import {
  CANONICAL_TOTAL_BP,
  CANONICAL_AREA_BOSS_HARD_MAX,
  canonicalEncounterRatesBp,
  canonicalChestQualityRatesBp,
  canonicalEnemyDensityCapBp,
  type TimeOfDay,
} from './canonicalConfig';
import { rollWardEventSubtype } from './wardEventSubtypes';
import { computeSpatialMultipliers } from './encounterSpatialWeights';
import { isEliteBattle } from './encounterResolution';

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

// WardEventSubtype is defined in types.ts and the roll engine lives in
// wardEventSubtypes.ts.  Re-exported here for backwards compatibility
// with any import that still references canonicalEncounters.
export type { WardEventSubtype };

/** A tile with its canonical encounter, chest tier, and ward-event subtype. */
export interface CanonicalAssignedTile {
  readonly tileKey:               string;
  readonly q:                     number;
  readonly r:                     number;
  readonly graphDistanceFromStart: number;
  encounter:                      CanonicalEncounterType;
  /** Only defined when encounter === 'treasure'. */
  chestTier?:                     ChestTier;
  /** Enhanced metadata on a normal battle, never a separate encounter kind. */
  isElite?:                       boolean;
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

/**
 * Axial hex neighbour directions (6-connected flat-top grid).
 * Used for dead-end detection: a tile with exactly one walkable
 * neighbour is a dead end and receives a reward-encounter bonus.
 */
const HEX_DIRS = [
  { q:  1, r:  0 }, { q: -1, r:  0 },
  { q:  0, r:  1 }, { q:  0, r: -1 },
  { q:  1, r: -1 }, { q: -1, r:  1 },
] as const;

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
  const baseRates  = canonicalEncounterRatesBp(chapter, timeOfDay);
  const chestRates = canonicalChestQualityRatesBp(chapter);
  const frozenKeys = new Set([topology.startTileId, topology.gateAnchorId]);

  // ── Tile coordinate set (for adjacency / dead-end detection) ─────────────────
  // Build once up-front — O(N) — so per-tile lookups are O(1).
  const tileCoordSet = new Set<string>(
    topology.tiles.map(c => `${c.q},${c.r}`),
  );

  // ── Partition tiles ───────────────────────────────────────────────────────────
  type EligibleEntry = {
    tileKey:      string;
    q:            number;
    r:            number;
    dist:         number;
    // Zone metadata (Push 3 — undefined for authored/procedural chapters).
    zoneType:     'lane' | 'clearing' | 'transition' | undefined;
    laneClass:    'primary' | 'secondary' | undefined;
    clearingType: string | undefined;
    isDeadEnd:    boolean;
  };
  type FrozenEntry = { tileKey: string; q: number; r: number; dist: number };

  const eligibleTiles: EligibleEntry[] = [];
  const frozenTiles:   FrozenEntry[]   = [];

  for (const coord of topology.tiles) {
    const tileKey  = `${coord.q},${coord.r}`;
    const dist     = topology.graphDistances.get(tileKey) ?? 0;
    const zoneMeta = topology.zoneMeta?.get(tileKey);

    if (frozenKeys.has(tileKey)) {
      frozenTiles.push({ tileKey, q: coord.q, r: coord.r, dist });
    } else {
      // Adjacency degree for dead-end detection.
      // A tile with exactly 1 walkable neighbour is a dead end (branch terminus).
      // Frozen tiles (start/gate) are excluded from being classified as dead ends
      // because they are always assigned 'none' and are not eligible for rewards.
      const degree = HEX_DIRS.reduce((n, d) =>
        n + (tileCoordSet.has(`${coord.q + d.q},${coord.r + d.r}`) ? 1 : 0), 0);
      const isDeadEnd = degree === 1;

      eligibleTiles.push({
        tileKey,
        q:            coord.q,
        r:            coord.r,
        dist,
        zoneType:     zoneMeta?.zoneType,
        laneClass:    zoneMeta?.laneClass,
        clearingType: zoneMeta?.clearingType,
        isDeadEnd,
      });
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

    // ── Hard caps ────────────────────────────────────────────────────────────
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
    // Chapter 5+ merchant cadence can roll often enough to produce multiples;
    // Age 1 deliberately allows only one persistent merchant per run.
    if (merchantCount >= 1) {
      liveWeights.merchant = 0;
    }

    // ── Spatial weight multipliers (Push 3) ───────────────────────────────────
    // Zone-aware biasing for blueprint-pipeline chapters.
    // For non-blueprint chapters (no zone metadata), computeSpatialMultipliers
    // returns {} → no modification → existing behaviour fully preserved.
    //
    // Multipliers are applied AFTER hard caps so:
    //   a) A cap-zeroed weight (e.g. areaBoss=0 from count cap) stays zero
    //      regardless of the spatial multiplier (0 × anything = 0).
    //   b) A spatial zero (e.g. areaBoss=0 on a lane tile) is not re-opened
    //      by the count cap; the cap check only further restricts.
    //
    // The `none` weight is intentionally NOT included in spatialMults so it
    // absorbs the redistribution naturally — clearings get more empty terrain,
    // lanes get denser encounters, without explicit `none` accounting.
    const spatialMults = computeSpatialMultipliers({
      zoneType:     tile.zoneType,
      laneClass:    tile.laneClass,
      clearingType: tile.clearingType,
      isDeadEnd:    tile.isDeadEnd,
    });
    for (const [key, mult] of Object.entries(spatialMults)) {
      if (key in liveWeights && mult !== undefined) {
        liveWeights[key] = (liveWeights[key] ?? 0) * mult;
      }
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
      assignedTile.chestTier = weightedRoll(
        chestRates as unknown as Record<string, number>, rng,
      ) as ChestTier;
    }
    if (encounter === 'battle') {
      assignedTile.isElite = isEliteBattle(String(seed), tile.tileKey, chapter);
    }

    // Ward event subtype: shift-weighted roll from wardEventSubtypes.ts.
    // Assigned in-stream so the same PRNG position always yields the same subtype.
    if (encounter === 'wardEvent') {
      assignedTile.wardEventSubtype = rollWardEventSubtype(timeOfDay, rng);
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
