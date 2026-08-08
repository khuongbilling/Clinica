/**
 * game/stabilityEngine.ts — Push 7: shared Stability combat loop.
 *
 * Adds:
 *  • StabilityTier — the five named bands for the shared Stability bar.
 *  • getStabilityTier(stability) — tier lookup for any 0–100 value.
 *  • calcThreatPressure(threat) — stability points this threat drains per round.
 *  • calcIncomingPressure(threats, stability) — aggregate pressure + projection.
 *  • buildThreatDisplayData(threat, stability) — everything needed to render one
 *    threat row (corruption bar, intent label, status, resolved flag).
 *  • describeIntent(intent) — short human-readable label for the battle HUD.
 *
 * Unit convention
 * ────────────────
 * Pressure values are in the same unit as BattleState.stability: integer stability
 * points (0–100).  A pressure of 8 means "this threat will drain 8 stability this
 * round if left untreated."  This matches the existing getEnemyDamage() contract
 * where enemy.instability is the per-turn base damage.
 *
 * No shift mechanics, no BattleState changes, no React imports.
 * MULTI_THREAT_COMBAT_V1 gates UI wiring; this module is always safe to import.
 */

import type { Threat, ThreatIntent } from './threats';

// ── Stability tiers ────────────────────────────────────────────────────────────

/**
 * Named stability band shown on the shared Stability bar.
 *
 *  stable   75–100  Patient is holding; normal care pace.
 *  guarded  50–74   Watch for deterioration; consider escalating.
 *  unstable 25–49   Active danger; prioritise stabilisation.
 *  critical  1–24   Imminent failure; emergency actions only.
 *  failure     0    Battle lost.
 */
export type StabilityTierName =
  | 'stable'
  | 'guarded'
  | 'unstable'
  | 'critical'
  | 'failure';

/** All data needed to render one tier in the Stability bar legend or UI token. */
export interface StabilityTierInfo {
  /** Machine-readable name — use for styling keys and conditional logic. */
  readonly name:  StabilityTierName;
  /** Human-readable label shown in the HUD. */
  readonly label: string;
  /**
   * Short one-word clinical cue displayed alongside the bar.
   * Maps to the nurse-style descriptor for patient status.
   */
  readonly cue:   string;
  /** Inclusive lower bound (0–100). */
  readonly min:   number;
  /** Inclusive upper bound (0–100). */
  readonly max:   number;
  /**
   * Semantic colour token (design-system name, not raw hex).
   * Consumers look up the actual hex/RGB from the UI token layer.
   */
  readonly colorToken: string;
}

/**
 * Ordered from highest to lowest so a simple linear scan can resolve any value.
 */
export const STABILITY_TIERS: readonly StabilityTierInfo[] = [
  {
    name:       'stable',
    label:      'Stable',
    cue:        'Holding',
    min:        75,
    max:        100,
    colorToken: 'success',
  },
  {
    name:       'guarded',
    label:      'Guarded',
    cue:        'Watch',
    min:        50,
    max:        74,
    colorToken: 'warning',
  },
  {
    name:       'unstable',
    label:      'Unstable',
    cue:        'Deteriorating',
    min:        25,
    max:        49,
    colorToken: 'danger',
  },
  {
    name:       'critical',
    label:      'Critical',
    cue:        'Emergency',
    min:        1,
    max:        24,
    colorToken: 'critical',
  },
  {
    name:       'failure',
    label:      'Failure',
    cue:        'Lost',
    min:        0,
    max:        0,
    colorToken: 'failure',
  },
] as const;

/**
 * Resolve the StabilityTierInfo for a given stability value.
 *
 * @param stability  Current shared stability (clamped to [0, 100] internally).
 * @returns The matching tier, never undefined (failure tier catches 0).
 */
export function getStabilityTier(stability: number): StabilityTierInfo {
  const s = Math.min(100, Math.max(0, Math.round(stability)));
  for (const tier of STABILITY_TIERS) {
    if (s >= tier.min && s <= tier.max) return tier;
  }
  // Unreachable — failure tier covers 0 and we clamped above.
  return STABILITY_TIERS[STABILITY_TIERS.length - 1];
}

// ── Intent description ─────────────────────────────────────────────────────────

/**
 * Human-readable one-line description of a threat's current intent.
 * Used in the battle HUD "next action" row below each threat bar.
 */
export function describeIntent(intent: ThreatIntent): string {
  switch (intent.kind) {
    case 'idle':
      return 'Holding — no immediate action.';
    case 'surge':
      return `Surging — prepares a spike of ${intent.magnitude} stability damage.`;
    case 'corrupt':
      return `Corrupting — will drain ${intent.magnitude} stability directly.`;
    case 'spread':
      return intent.targetThreatId
        ? `Spreading — propagating corruption to another threat.`
        : `Spreading — may propagate corruption this turn.`;
    case 'escalate':
      return 'Escalating — advancing to the next phase; pressure increases.';
    case 'disrupt':
      return `Disrupting — targeting ${intent.targetRole} care actions this turn.`;
    default: {
      // Exhaustiveness guard — TypeScript will error if a new kind is added without handling it.
      const _: never = intent;
      return 'Unknown intent.';
    }
  }
}

// ── Per-threat pressure ────────────────────────────────────────────────────────

/**
 * Calculate the stability pressure (points per round) contributed by one threat.
 *
 * Pressure formula
 * ─────────────────
 *  • Resolved or latent threats contribute 0 (they have stopped acting).
 *  • base   = threat.speed  (maps to enemy.instability — per-turn base damage).
 *  • intent = additional damage keyed on ThreatIntent.kind:
 *               idle      → 0
 *               surge(n)  → n   (telegraphed burst)
 *               corrupt(n)→ n   (direct stability drain)
 *               spread    → 0   (spreads corruption, not direct stability)
 *               escalate  → ceil(base × 0.5)  (50 % speed bonus)
 *               disrupt   → 0   (disrupts actions, not direct stability)
 *  • drain  = threat.modifiers.stabilityDrainBonus  (flat additive modifier).
 *  • total  = max(0, base + intent + drain)
 *
 * @param threat  The threat to evaluate.
 * @returns       Non-negative integer stability points drained per round.
 */
export function calcThreatPressure(threat: Threat): number {
  if (threat.resolved || threat.latent) return 0;

  const base   = threat.speed;
  const intent = threat.intent;
  let   bonus  = 0;

  switch (intent.kind) {
    case 'surge':
    case 'corrupt':
      bonus = intent.magnitude;
      break;
    case 'escalate':
      bonus = Math.ceil(base * 0.5);
      break;
    case 'idle':
    case 'spread':
    case 'disrupt':
      bonus = 0;
      break;
    default: {
      const _: never = intent;
      bonus = 0;
    }
  }

  const drain = threat.modifiers.stabilityDrainBonus;
  return Math.max(0, base + bonus + drain);
}

// ── Per-threat display data ────────────────────────────────────────────────────

/**
 * Status summary for one threat — drives the badge / label in the battle HUD.
 *
 *  active    — visible and fighting; showing corruption bar + intent.
 *  hidden    — exists but not revealed; shows redacted entry.
 *  latent    — queued, not yet active; not shown to the player until activated.
 *  resolved  — corruption reached 0; bar collapsed, no more pressure.
 */
export type ThreatStatus = 'active' | 'hidden' | 'latent' | 'resolved';

/** Derive the ThreatStatus for rendering. */
export function getThreatStatus(threat: Threat): ThreatStatus {
  if (threat.resolved) return 'resolved';
  if (threat.latent)   return 'latent';
  if (threat.hidden)   return 'hidden';
  return 'active';
}

/** All data needed to render one row in the multi-threat battle HUD. */
export interface ThreatDisplayData {
  /** Source threat object. */
  readonly threat:          Threat;
  /** Resolved display status. */
  readonly status:          ThreatStatus;
  /** Corruption as a percentage of max (0–100), suitable for a progress bar. */
  readonly corruptionPct:   number;
  /** This threat's pressure contribution to the current round (0 if resolved/latent). */
  readonly pressureThisRound: number;
  /** Human-readable intent description for the "next action" row. */
  readonly intentLabel:     string;
  /** Shared-stability tier at the time this data was built (for conditional coloring). */
  readonly stabilityTier:   StabilityTierInfo;
  /**
   * true when this threat is contributing meaningful pressure this round.
   * Convenience flag: status === 'active' && pressureThisRound > 0.
   */
  readonly isPressingNow:   boolean;
}

/**
 * Build the display data for one threat.
 *
 * @param threat             The threat to describe.
 * @param currentStability   Shared stability value (0–100); used to resolve the
 *                           tier context for conditional HUD colouring.
 */
export function buildThreatDisplayData(
  threat:           Threat,
  currentStability: number,
): ThreatDisplayData {
  const status           = getThreatStatus(threat);
  const corruptionPct    = threat.corruptionMax > 0
    ? Math.round((threat.corruptionCurrent / threat.corruptionMax) * 100)
    : 0;
  const pressureThisRound = calcThreatPressure(threat);
  const intentLabel      = describeIntent(threat.intent);
  const stabilityTier    = getStabilityTier(currentStability);
  const isPressingNow    = status === 'active' && pressureThisRound > 0;

  return {
    threat,
    status,
    corruptionPct,
    pressureThisRound,
    intentLabel,
    stabilityTier,
    isPressingNow,
  };
}

// ── Aggregate incoming pressure ────────────────────────────────────────────────

/** Per-threat entry in the aggregate pressure breakdown. */
export interface ThreatPressureEntry {
  readonly threatId:   string;
  readonly threatName: string;
  readonly pressure:   number;
  /** Convenience: status at time of calculation. */
  readonly status:     ThreatStatus;
}

/**
 * The full incoming-pressure result for one round.
 *
 *  totalPressure       — sum of all active threat pressures.
 *  byThreat            — per-threat breakdown (includes resolved/latent at 0).
 *  projectedStability  — max(0, currentStability − totalPressure).
 *  projectedTier       — tier of projectedStability.
 *  tierDropped         — true if projectedTier.name !== currentTier.name.
 *  currentTier         — tier of currentStability.
 */
export interface IncomingPressureResult {
  readonly totalPressure:       number;
  readonly byThreat:            readonly ThreatPressureEntry[];
  readonly projectedStability:  number;
  readonly projectedTier:       StabilityTierInfo;
  readonly currentTier:         StabilityTierInfo;
  /** True when the patient will cross into a lower tier this round. */
  readonly tierDropped:         boolean;
}

/**
 * Calculate the aggregate incoming stability pressure from all threats for the
 * current round and project the resulting stability value.
 *
 * Resolved and latent threats contribute 0 and are included in byThreat for
 * completeness (so the caller can always show a full threat list without gaps).
 *
 * @param threats           All Threat objects in the encounter (1–3).
 * @param currentStability  Shared stability before this round's damage (0–100).
 */
export function calcIncomingPressure(
  threats:          readonly Threat[],
  currentStability: number,
): IncomingPressureResult {
  const currentTier = getStabilityTier(currentStability);

  const byThreat: ThreatPressureEntry[] = threats.map(t => ({
    threatId:   t.id,
    threatName: t.name,
    pressure:   calcThreatPressure(t),
    status:     getThreatStatus(t),
  }));

  const totalPressure      = byThreat.reduce((sum, e) => sum + e.pressure, 0);
  const projectedStability = Math.max(0, currentStability - totalPressure);
  const projectedTier      = getStabilityTier(projectedStability);
  const tierDropped        = projectedTier.name !== currentTier.name;

  return {
    totalPressure,
    byThreat,
    projectedStability,
    projectedTier,
    currentTier,
    tierDropped,
  };
}

// ── Convenience: full display set for all threats ─────────────────────────────

/**
 * Build ThreatDisplayData for every threat in the encounter, plus the aggregate
 * incoming pressure.  One-stop call for the battle HUD renderer.
 *
 * @param threats           All threats in the encounter.
 * @param currentStability  Shared stability (0–100).
 */
export interface MultiThreatDisplayResult {
  readonly threatRows:      readonly ThreatDisplayData[];
  readonly incomingPressure: IncomingPressureResult;
  readonly stabilityTier:   StabilityTierInfo;
}

export function buildMultiThreatDisplay(
  threats:          readonly Threat[],
  currentStability: number,
): MultiThreatDisplayResult {
  const stabilityTier    = getStabilityTier(currentStability);
  const threatRows       = threats.map(t => buildThreatDisplayData(t, currentStability));
  const incomingPressure = calcIncomingPressure(threats, currentStability);

  return { threatRows, incomingPressure, stabilityTier };
}
