/**
 * game/openingReadiness.ts — Push 9: speed-based opening Readiness.
 *
 * Computes whether the team or the enemy group acts first at the start of a
 * battle and what opening advantage that produces.
 *
 * Readiness values
 * ─────────────────
 *   Team Readiness   = avg(active hero speeds) + mapBonus + cardBonus
 *                      + blessingBonus + supportBonus − pressurePenalty
 *   Enemy Readiness  = avg(active threat speeds) + encounterAlertness
 *                      + ambushBonus + bossModifier
 *   delta            = teamReadiness − enemyReadiness
 *
 * Opening outcomes (from delta)
 * ──────────────────────────────
 *   delta ≥ 15       first_response    Fastest hero acts first; team gets +1 AP round 1.
 *   5 ≤ delta < 15   team_initiative   Fastest hero acts first; no AP bonus.
 *   -4 ≤ delta ≤ 4   speed_order       Normal individual Speed turn order.
 *   -14 ≤ delta ≤ -5 enemy_initiative  Fastest threat acts first.
 *   delta ≤ -15      ambush            Max 2 enemy opening actions total.
 *
 * Hard constraints
 * ─────────────────
 *   • Enemies NEVER get two complete rounds — the ambush cap (2 actions) enforces this.
 *   • After the opening sequence, all subsequent turns use normal individual Speed order.
 *
 * Unit convention
 * ────────────────
 *   Speeds are integers on the 1–10 scale used throughout threats.ts.
 *   Bonus/penalty fields are plain numbers (may be fractional; readiness is kept
 *   as a float internally and only rounded at the display / comparison boundary).
 *
 * This module is pure domain logic — no React, no BattleState writes.
 * MULTI_THREAT_COMBAT_V1 gates UI wiring; this module is always safe to import.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** delta threshold for First Response (team advantage). */
export const FIRST_RESPONSE_THRESHOLD   =  15;
/** delta threshold for Team Initiative. */
export const TEAM_INITIATIVE_THRESHOLD  =   5;
/** Lower bound of the neutral speed-order band (inclusive). */
export const SPEED_ORDER_LOWER          =  -4;
/** delta threshold (exclusive, i.e. ≤ this) for Enemy Initiative. */
export const ENEMY_INITIATIVE_THRESHOLD =  -5;
/** delta threshold (inclusive, i.e. ≤ this) for Ambush. */
export const AMBUSH_THRESHOLD           = -15;

/** AP bonus awarded to the team on a First Response opening. */
export const FIRST_RESPONSE_AP_BONUS = 1;

/**
 * Maximum enemy actions during an Ambush opening.
 * Ensures enemies NEVER get two complete rounds.
 */
export const AMBUSH_MAX_ENEMY_ACTIONS = 2;

// ── Input types ───────────────────────────────────────────────────────────────

/**
 * All contributors to the team's opening Readiness.
 *
 *  heroSpeeds      One speed value per active hero on the starting roster (1–10 scale).
 *                  Must be non-empty.  The module treats these as-is; the caller is
 *                  responsible for sourcing them from hero stats or progression.
 *  mapBonus        Flat bonus from the fog-map tile / encounter type (positive or 0).
 *  cardBonus       Flat bonus from active JourneyCards (positive or 0).
 *  blessingBonus   Flat bonus from active JourneyBlessings (positive or 0).
 *  supportBonus    Flat bonus from pre-battle support actions (positive or 0).
 *  pressurePenalty Flat penalty from shift pressure / instability (positive = more penalty).
 */
export interface TeamReadinessInput {
  readonly heroSpeeds:      readonly number[];
  readonly mapBonus:        number;
  readonly cardBonus:       number;
  readonly blessingBonus:   number;
  readonly supportBonus:    number;
  readonly pressurePenalty: number;
}

/**
 * All contributors to the enemy group's opening Readiness.
 *
 *  threatSpeeds        One speed value per active (non-latent, non-resolved) threat.
 *                      Must be non-empty.
 *  encounterAlertness  Bonus from the encounter tile type (e.g. ambush tile, boss room).
 *  ambushBonus         Additional bonus when the fight is started at night or the threat
 *                      group contains a hidden threat.
 *  bossModifier        Flat modifier for chapter-boss or area-boss encounters.
 */
export interface EnemyReadinessInput {
  readonly threatSpeeds:       readonly number[];
  readonly encounterAlertness: number;
  readonly ambushBonus:        number;
  readonly bossModifier:       number;
}

// ── Outcome type ──────────────────────────────────────────────────────────────

/**
 * The five possible opening outcomes, ordered from most team-favourable to least.
 *
 *  first_response   — Team wins big (delta ≥ 15): fastest hero first + +1 AP.
 *  team_initiative  — Team wins (5 ≤ delta < 15): fastest hero first.
 *  speed_order      — Neutral (−4 ≤ delta ≤ 4): normal individual Speed turn order.
 *  enemy_initiative — Enemy wins (−14 ≤ delta ≤ −5): fastest threat first.
 *  ambush           — Enemy wins big (delta ≤ −15): max 2 enemy opening actions.
 */
export type OpeningOutcome =
  | 'first_response'
  | 'team_initiative'
  | 'speed_order'
  | 'enemy_initiative'
  | 'ambush';

// ── Result type ───────────────────────────────────────────────────────────────

/** The full result of an opening Readiness calculation. */
export interface ReadinessResult {
  /** Computed team Readiness (float). */
  readonly teamReadiness:  number;
  /** Computed enemy Readiness (float). */
  readonly enemyReadiness: number;
  /**
   * teamReadiness − enemyReadiness.
   * Positive = team advantage; negative = enemy advantage.
   */
  readonly delta:          number;
  /** Which opening scenario applies. */
  readonly outcome:        OpeningOutcome;
  /**
   * Extra AP granted to the team in round 1.
   * 1 for first_response; 0 for all other outcomes.
   */
  readonly apBonus:        number;
  /**
   * Index into the INPUT speed array for the actor who moves first.
   *   • team_initiative / first_response → index into TeamReadinessInput.heroSpeeds
   *   • enemy_initiative / ambush        → index into EnemyReadinessInput.threatSpeeds
   *   • speed_order                      → -1 (use normal turn order)
   * When there are ties, the FIRST occurrence (lowest index) wins.
   */
  readonly openingActorIndex: number;
  /**
   * Maximum number of enemy opening actions before the team can act.
   * 2 for ambush; 0 for all other outcomes.
   */
  readonly maxEnemyOpeningActions: number;
}

// ── Helper: mean ──────────────────────────────────────────────────────────────

/**
 * Arithmetic mean of a non-empty number array.
 * Returns 0 for an empty array (caller should validate before calling).
 */
function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Index of the first occurrence of the maximum value in an array.
 * Returns -1 for empty arrays.
 */
function indexOfMax(values: readonly number[]): number {
  if (values.length === 0) return -1;
  let maxIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[maxIdx]) maxIdx = i;
  }
  return maxIdx;
}

// ── Readiness calculations ────────────────────────────────────────────────────

/**
 * Calculate the team's total opening Readiness.
 *
 * Formula: mean(heroSpeeds) + mapBonus + cardBonus + blessingBonus
 *          + supportBonus − pressurePenalty
 */
export function calcTeamReadiness(input: TeamReadinessInput): number {
  return (
    mean(input.heroSpeeds)
    + input.mapBonus
    + input.cardBonus
    + input.blessingBonus
    + input.supportBonus
    - input.pressurePenalty
  );
}

/**
 * Calculate the enemy group's total opening Readiness.
 *
 * Formula: mean(threatSpeeds) + encounterAlertness + ambushBonus + bossModifier
 */
export function calcEnemyReadiness(input: EnemyReadinessInput): number {
  return (
    mean(input.threatSpeeds)
    + input.encounterAlertness
    + input.ambushBonus
    + input.bossModifier
  );
}

// ── Outcome resolution ────────────────────────────────────────────────────────

/**
 * Resolve the opening outcome from a pre-computed delta.
 *
 * Threshold table (inclusive boundaries):
 *   delta ≥ 15        → first_response
 *   5 ≤ delta < 15    → team_initiative
 *   −4 ≤ delta < 5    → speed_order
 *   −15 < delta ≤ −5  → enemy_initiative
 *   delta ≤ −15       → ambush
 *
 * @param delta  teamReadiness − enemyReadiness (float allowed).
 */
export function getOpeningOutcome(delta: number): OpeningOutcome {
  if (delta >= FIRST_RESPONSE_THRESHOLD)   return 'first_response';
  if (delta >= TEAM_INITIATIVE_THRESHOLD)  return 'team_initiative';
  if (delta > ENEMY_INITIATIVE_THRESHOLD)  return 'speed_order';
  if (delta > AMBUSH_THRESHOLD)            return 'enemy_initiative';
  return 'ambush';
}

// ── Full calculation ──────────────────────────────────────────────────────────

/**
 * Compute the full opening Readiness result for one battle.
 *
 * Combines team and enemy readiness, resolves the outcome, and fills every field
 * of ReadinessResult so the battle engine can act on it directly.
 *
 * @param team   Team readiness contributors.
 * @param enemy  Enemy readiness contributors.
 */
export function calcOpeningReadiness(
  team:  TeamReadinessInput,
  enemy: EnemyReadinessInput,
): ReadinessResult {
  const teamReadiness  = calcTeamReadiness(team);
  const enemyReadiness = calcEnemyReadiness(enemy);
  const delta          = teamReadiness - enemyReadiness;
  const outcome        = getOpeningOutcome(delta);

  const apBonus: number = outcome === 'first_response' ? FIRST_RESPONSE_AP_BONUS : 0;

  let openingActorIndex: number;
  switch (outcome) {
    case 'first_response':
    case 'team_initiative':
      openingActorIndex = indexOfMax(team.heroSpeeds);
      break;
    case 'enemy_initiative':
    case 'ambush':
      openingActorIndex = indexOfMax(enemy.threatSpeeds);
      break;
    default:
      openingActorIndex = -1;
  }

  const maxEnemyOpeningActions: number =
    outcome === 'ambush' ? AMBUSH_MAX_ENEMY_ACTIONS : 0;

  return {
    teamReadiness,
    enemyReadiness,
    delta,
    outcome,
    apBonus,
    openingActorIndex,
    maxEnemyOpeningActions,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate opening Readiness inputs before passing them to the calculator.
 * Returns an array of error strings; an empty array means inputs are valid.
 *
 * Checks:
 *  • heroSpeeds must be non-empty.
 *  • threatSpeeds must be non-empty.
 *  • Every speed value must be a finite number in the 1–10 range.
 *  • pressurePenalty must be non-negative.
 *  • All bonus / modifier fields must be non-negative.
 */
export function validateReadinessInputs(
  team:  TeamReadinessInput,
  enemy: EnemyReadinessInput,
): readonly string[] {
  const errors: string[] = [];

  if (team.heroSpeeds.length === 0) {
    errors.push('TeamReadinessInput: heroSpeeds must not be empty.');
  }
  if (enemy.threatSpeeds.length === 0) {
    errors.push('EnemyReadinessInput: threatSpeeds must not be empty.');
  }

  for (const [i, s] of team.heroSpeeds.entries()) {
    if (!Number.isFinite(s) || s < 1 || s > 10) {
      errors.push(`TeamReadinessInput: heroSpeeds[${i}] = ${s} is outside [1, 10].`);
    }
  }
  for (const [i, s] of enemy.threatSpeeds.entries()) {
    if (!Number.isFinite(s) || s < 1 || s > 10) {
      errors.push(`EnemyReadinessInput: threatSpeeds[${i}] = ${s} is outside [1, 10].`);
    }
  }

  if (team.pressurePenalty < 0) {
    errors.push(`TeamReadinessInput: pressurePenalty ${team.pressurePenalty} must be ≥ 0.`);
  }

  const teamBonuses: [string, number][] = [
    ['mapBonus',      team.mapBonus],
    ['cardBonus',     team.cardBonus],
    ['blessingBonus', team.blessingBonus],
    ['supportBonus',  team.supportBonus],
  ];
  for (const [key, val] of teamBonuses) {
    if (val < 0) errors.push(`TeamReadinessInput: ${key} ${val} must be ≥ 0.`);
  }

  const enemyBonuses: [string, number][] = [
    ['encounterAlertness', enemy.encounterAlertness],
    ['ambushBonus',        enemy.ambushBonus],
    ['bossModifier',       enemy.bossModifier],
  ];
  for (const [key, val] of enemyBonuses) {
    if (val < 0) errors.push(`EnemyReadinessInput: ${key} ${val} must be ≥ 0.`);
  }

  return errors;
}

// ── Convenience: speed-order sort ────────────────────────────────────────────

/**
 * Return a list of combatant indices sorted by speed descending (highest first),
 * as used in the post-opening normal Speed turn order.
 *
 * @param speeds  Speed values for all combatants (heroes + threats interleaved
 *                or provided separately, caller decides the convention).
 * @returns       Indices into `speeds` sorted by speed descending; ties preserve
 *                original index order (stable sort).
 */
export function speedOrderIndices(speeds: readonly number[]): readonly number[] {
  return speeds
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ i }) => i);
}

/**
 * Short description of an opening outcome for the battle HUD announcement.
 */
export function describeOutcome(outcome: OpeningOutcome): string {
  switch (outcome) {
    case 'first_response':
      return 'First Response — your team acts first and gains +1 AP this round.';
    case 'team_initiative':
      return 'Team Initiative — your fastest hero acts first.';
    case 'speed_order':
      return 'Standard — turn order follows individual Speed.';
    case 'enemy_initiative':
      return 'Enemy Initiative — the fastest threat acts before your team.';
    case 'ambush':
      return 'Ambush — the enemy acts first with up to 2 opening actions.';
    default: {
      const _: never = outcome;
      return 'Unknown opening.';
    }
  }
}
