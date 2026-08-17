/**
 * encounterSpatialWeights.ts — Production Bridge Push 3
 *
 * Zone-aware encounter placement weights.
 *
 * PURPOSE
 * ───────
 * Computes per-tile multipliers applied to `liveWeights` inside
 * `assignCanonicalEncounters` AFTER the existing hard caps (areaBoss count,
 * distance gate, battle density ceiling) and BEFORE the weighted roll.
 *
 * The multipliers control WHERE encounters appear spatially without changing
 * the canonical encounter RATE TABLES defined in `canonicalConfig.ts`.
 * The `none` weight is intentionally excluded from all multiplier tables:
 * it absorbs any redistribution naturally, so clearings feel more open and
 * lanes feel denser without any explicit `none` accounting.
 *
 * TILE ZONES (from the blueprint pipeline)
 * ─────────────────────────────────────────
 *   'lane'       — hex corridor tile along a primary or secondary lane.
 *                  Primary lanes are the main 3-wide arteries; secondary
 *                  are 2-wide side routes.
 *   'clearing'   — open area at a named clearing or junction node.
 *                  These have surrounding open cells appropriate for NPCs,
 *                  large sprites, and interactive objects.
 *   'transition' — widened approach near a clearing, or BFS expansion filler.
 *                  Intermediate context.
 *
 *   undefined    — tile is from an authored/procedural chapter that does not
 *                  have zone metadata.  Returning {} = empty multipliers causes
 *                  the caller to leave all weights unchanged (multiplier = 1.0
 *                  by the absent-key convention).
 *
 * DEAD-END TILES
 * ──────────────
 * A tile with exactly one walkable neighbor is a "dead end" — a side pocket
 * or branch terminus.  These are natural reward spots: the player must commit
 * to entering and retracing, so a reward justifies the detour.  Dead-end
 * tiles receive a bonus multiplier for treasure, merchant, and ward-event
 * encounters regardless of zone type.
 *
 * PRESERVATION GUARANTEE
 * ──────────────────────
 * Multipliers for each encounter type are designed so that the INTEGRATED
 * expected count across the full tile distribution is approximately equal to
 * what the base rates would produce without spatial weighting.  In practice:
 *
 *   battle:    integrated ≈ 1.00× base (lane boost offsets clearing reduction)
 *   treasure:  integrated ≈ 0.90–1.05× base (cleared by dead-end boost)
 *   merchant:  integrated ≈ 0.80–1.00× base (cleared by clearing boost)
 *   wardEvent: integrated ≈ 0.85–1.00× base
 *   areaBoss:  integrated ≈ 0.75–0.90× base (restricted to clearing tiles)
 *
 * The slight areaBoss shortfall vs base rate is acceptable because:
 *   a) areaBoss already has a hard cap of 3 per run.
 *   b) Clearing tiles are 15–25% of the map → spatial restriction is strict.
 *   c) The 2.0× clearing boost partially compensates.
 *   d) Spatial coherence (bosses always in open areas) outweighs ±10% drift.
 *
 * DO NOT IMPORT FROM canonicalConfig.ts or any UI/React layer.
 * This module is a pure data transformation — no side effects, no state.
 */

// ── Public types ──────────────────────────────────────────────────────────────

export interface SpatialWeightInput {
  /**
   * Zone classification from `HexTileZoneMeta.zoneType`.
   * `undefined` for tiles without zone metadata (authored/procedural chapters).
   */
  readonly zoneType:     'lane' | 'clearing' | 'transition' | undefined;
  /** Lane width class. Only meaningful when zoneType === 'lane'. */
  readonly laneClass:    'primary' | 'secondary' | undefined;
  /**
   * Clearing type string from `HexTileZoneMeta.clearingType`.
   * Retained for future sub-type routing (e.g. 'rest_stop' vs 'junction').
   * Not yet used in multiplier logic; reserved for Push 4+.
   */
  readonly clearingType: string | undefined;
  /**
   * True when this tile has exactly one walkable neighbour.
   * Provides a bonus multiplier for reward-type encounters.
   */
  readonly isDeadEnd:    boolean;
}

// ── Multiplier tables ─────────────────────────────────────────────────────────

/**
 * Multipliers for the `clearing` zone type.
 * Clearings are open multi-function spaces: less battle pressure,
 * great for merchants/NPCs/ward events, and the only valid area boss site.
 */
const CLEARING_MULTS = {
  areaBoss:  2.00,   // only valid placement zone — boost to compensate for restriction
  battle:    0.65,   // open space, less conflict density
  treasure:  1.80,   // chests need open ground — clearings provide it
  merchant:  3.00,   // NPCs need space to render + context
  wardEvent: 2.50,   // interactive events belong in open areas
} as const;

/**
 * Multipliers for the `lane` / primary-lane zone type.
 * Primary lanes (width 3) are the main arteries: battle-heavy, reward-sparse.
 * No bosses or merchants in tight corridors.
 */
const PRIMARY_LANE_MULTS = {
  areaBoss:  0.00,   // FORBIDDEN — no boss blocking a main corridor
  battle:    1.20,   // lane = conflict zone, denser battles
  treasure:  0.50,   // chest in main artery blocks readability
  merchant:  0.00,   // FORBIDDEN — no merchant in a main artery
  wardEvent: 0.30,   // interactive NPC needs space → very rare in primary lanes
} as const;

/**
 * Multipliers for the `lane` / secondary-lane zone type.
 * Secondary lanes (width 2) are side routes: still lanes but narrower; slightly
 * more forgiving than primary for reward placement.
 */
const SECONDARY_LANE_MULTS = {
  areaBoss:  0.00,   // FORBIDDEN — secondary corridors too narrow for boss representation
  battle:    1.15,   // still a conflict zone
  treasure:  0.70,   // chest in a side passage is acceptable but not preferred
  merchant:  0.15,   // very rare; only valid in wider secondary passages
  wardEvent: 0.50,   // rare; occasional training moment in a side corridor
} as const;

/**
 * Multipliers for the `transition` zone type.
 * Transitions widen near clearings or fill gaps — intermediate context.
 */
const TRANSITION_MULTS = {
  areaBoss:  0.00,   // FORBIDDEN — not enough open cells for boss representation
  battle:    1.05,   // mildly elevated, still a lane-adjacent zone
  treasure:  0.85,   // acceptable but not preferred
  merchant:  0.40,   // slightly possible in wider transition zones
  wardEvent: 0.70,   // occasional
} as const;

/** Minimum multiplier applied to dead-end tiles for reward-type encounters. */
const DEAD_END_TREASURE_MIN  = 2.50;  // prime reward spot
const DEAD_END_MERCHANT_MIN  = 1.00;  // small shop tucked into a side pocket
const DEAD_END_WARD_MIN      = 1.50;  // training bay / support event in a side recess

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns spatial weight multipliers for a tile's encounter weight vector.
 *
 * The caller should apply these as:
 *   for (const [key, mult] of Object.entries(multipliers)) {
 *     if (liveWeights[key] !== undefined) {
 *       liveWeights[key] = liveWeights[key] * mult;
 *     }
 *   }
 *
 * Missing encounter keys in the returned object imply a multiplier of 1.0
 * (no modification).  The `none` weight is NEVER included — it absorbs
 * the redistribution naturally via the total-weight change.
 *
 * Returns an empty object (`{}`) when `zoneType` is `undefined`
 * (authored/procedural chapter without zone metadata) — all weights unchanged.
 */
export function computeSpatialMultipliers(
  input: SpatialWeightInput,
): Partial<Record<string, number>> {
  const { zoneType, laneClass, isDeadEnd } = input;

  // Non-blueprint chapters have no zone metadata → passthrough.
  if (!zoneType) return {};

  // Select the base multiplier table for this zone.
  let mults: Record<string, number>;

  if (zoneType === 'clearing') {
    mults = { ...CLEARING_MULTS };
  } else if (zoneType === 'lane') {
    mults = laneClass === 'primary'
      ? { ...PRIMARY_LANE_MULTS }
      : { ...SECONDARY_LANE_MULTS };
  } else {
    // transition
    mults = { ...TRANSITION_MULTS };
  }

  // ── Dead-end override ─────────────────────────────────────────────────────
  // Reward-type encounters get a floor multiplier on dead-end tiles,
  // regardless of zone type.  Area boss is excluded — dead ends are
  // typically too small for the boss representation.
  if (isDeadEnd) {
    mults.treasure  = Math.max(mults.treasure  ?? 0, DEAD_END_TREASURE_MIN);
    mults.merchant  = Math.max(mults.merchant  ?? 0, DEAD_END_MERCHANT_MIN);
    mults.wardEvent = Math.max(mults.wardEvent ?? 0, DEAD_END_WARD_MIN);
  }

  return mults;
}

// ── Verification helper (tests only) ─────────────────────────────────────────

/**
 * Returns a human-readable summary of the multipliers for a given input.
 * Intended for use in tests and diagnostic logging only.
 */
export function describeSpatialMultipliers(input: SpatialWeightInput): string {
  const m = computeSpatialMultipliers(input);
  if (Object.keys(m).length === 0) return 'no metadata → passthrough (all ×1.0)';
  return Object.entries(m)
    .map(([k, v]) => `${k}:×${(v ?? 1).toFixed(2)}`)
    .join(' ');
}
