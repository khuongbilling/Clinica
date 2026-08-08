/**
 * game/shiftOrchestration.ts — Push 8: shift-specific threat orchestration.
 *
 * Takes a ThreatGroup (built in Push 6) and applies battle-presentation rules
 * for the current time-of-day shift WITHOUT generating new threats or changing
 * the total enemy count.
 *
 * DAY      — all threats start active and visible.  Intents are fully visible.
 *            Pressure comes from all objectives simultaneously.  Highest
 *            support-call availability.
 *
 * EVENING  — if the group has 3 threats, the third defers as a "Handoff
 *            Reinforcement" that arrives after 2 complete player rounds.
 *            The player can reveal it early, delay its arrival, or weaken its
 *            starting state through preparation actions.  Groups of 1–2 threats
 *            are treated identically to DAY.
 *
 * NIGHT    — one generated threat (the last, non-acute member) begins latent
 *            and hidden — a "Silent Risk".  Assessment actions, Blessings, or
 *            specific preparation moves can reveal it.  If ignored past
 *            arrivalRound it auto-activates with a readiness bonus (extra
 *            starting corruption).  Single-threat groups are unaffected.
 *
 * Invariants
 * ───────────
 *  • Total threats NEVER exceeds MAX_THREATS (3) after orchestration.
 *  • The 'acute' role threat is NEVER hidden, latent, or deferred.
 *  • This module is pure domain logic — no React, no BattleState mutation,
 *    no battle screen changes.  MULTI_THREAT_COMBAT_V1 gates UI wiring.
 */

import type { TimeOfDay }                         from './journeyMap/types';
import type { ActionType }                         from './types';
import { type Threat }                             from './threats';
import { type ThreatGroup }                        from './threatGroups';

// ── Counterplay types ──────────────────────────────────────────────────────────

/**
 * What the player can do to interact with a pending Reinforcement.
 * 'blessing' is a named ward-specific mechanic (not an ActionType).
 */
export type CounterplayTrigger = ActionType | 'blessing';

/**
 * Describes the three ways a player can mitigate an incoming Reinforcement
 * before it arrives.
 */
export interface ReinforcementCounterplay {
  /**
   * Triggers that reveal the Reinforcement immediately (make it visible +
   * remove the latent flag) without changing its arrival round.
   */
  readonly revealsOn: readonly CounterplayTrigger[];
  /**
   * Triggers that postpone the arrival by the given number of rounds.
   * Multiple matching actions stack additively.
   */
  readonly delaysOn:  readonly { readonly trigger: CounterplayTrigger; readonly rounds: number }[];
  /**
   * Triggers that reduce the Reinforcement's corruptionCurrent on arrival
   * by the given percentage of its corruptionMax.
   */
  readonly weakensOn: readonly { readonly trigger: CounterplayTrigger; readonly reductionPct: number }[];
}

/**
 * What kind of deferred entry the Reinforcement represents.
 *
 *  handoff          — EVENING: a deliberate sequential arrival (telegraphed,
 *                     visible once revealed, part of the encounter design).
 *  latent_activation — NIGHT: a hidden threat that self-activates if ignored
 *                      (not telegraphed; readinessBonus applies on activation).
 */
export type ReinforcementKind = 'handoff' | 'latent_activation';

/**
 * A threat whose entry into the battle is deferred past round 1.
 *
 * For 'handoff':          threat is NOT in OrchestrationResult.threats at round 1.
 *                         The battle engine adds it at arrivalRound.
 * For 'latent_activation': threat IS in OrchestrationResult.threats (latent+hidden).
 *                         The battle engine flips latent→false at arrivalRound
 *                         if the player has not already revealed it.
 */
export interface Reinforcement {
  readonly kind:           ReinforcementKind;
  /** The Threat object — pre-built, ready to be activated. */
  readonly threat:         Threat;
  /**
   * 1-indexed round number on which this reinforcement enters (or auto-activates
   * if unrevealed).  "After 2 rounds" → arrivalRound = 3.
   */
  readonly arrivalRound:   number;
  /**
   * true for EVENING handoffs: the player receives a warning indicator at
   * round start.  false for NIGHT latent threats (no warning unless revealed).
   */
  readonly telegraphed:    boolean;
  /** Player actions that can interact with this reinforcement before it arrives. */
  readonly counterplay:    ReinforcementCounterplay;
  /**
   * Extra corruption added (as a fraction of corruptionMax) when the threat
   * auto-activates at arrivalRound WITHOUT having been revealed.
   * 0 means no readiness penalty.  0.25 means +25% of corruptionMax.
   */
  readonly readinessBonus: number;
}

// ── Shift hints ────────────────────────────────────────────────────────────────

/**
 * How visible enemy intents are on the battle HUD this shift.
 *  full    — all intents shown immediately each round (DAY).
 *  partial — intents delayed or shown with a 1-round lag (EVENING).
 *  hidden  — intents obscured; Assessment required to reveal them (NIGHT).
 */
export type IntentVisibility = 'full' | 'partial' | 'hidden';

/**
 * Relative availability of support-call actions (consult / call / rapid-response).
 *  high   — maximum options available (DAY).
 *  normal — standard availability (EVENING).
 *  low    — restricted options (NIGHT: skeleton crew).
 */
export type SupportAvailability = 'high' | 'normal' | 'low';

/**
 * How the threat group applies pressure.
 *  simultaneous — all active threats drain stability at once (DAY).
 *  sequential   — threats enter over time; pressure ramps up (EVENING).
 *  latent       — hidden threat adds uncertainty; may spike pressure (NIGHT).
 */
export type PressureType = 'simultaneous' | 'sequential' | 'latent';

/** Shift-specific display and gameplay hints for the battle HUD. */
export interface ShiftHints {
  readonly shift:               TimeOfDay;
  readonly intentVisibility:    IntentVisibility;
  readonly supportAvailability: SupportAvailability;
  readonly pressureType:        PressureType;
}

// ── Result ─────────────────────────────────────────────────────────────────────

/**
 * The output of all three orchestration functions.
 *
 *  shift          — the shift that produced this result.
 *  threats        — threats active at round 1 (1–MAX_THREATS).
 *                   For 'handoff', the third threat is absent here.
 *                   For 'latent_activation', all threats are here (one latent+hidden).
 *  reinforcements — deferred entries (0–1 in current rules).
 *  hints          — shift-specific presentation flags for the HUD.
 */
export interface OrchestrationResult {
  readonly shift:          TimeOfDay;
  readonly threats:        readonly Threat[];
  readonly reinforcements: readonly Reinforcement[];
  readonly hints:          ShiftHints;
}

// ── Counterplay constants ──────────────────────────────────────────────────────

/**
 * Standard counterplay for the EVENING handoff:
 *  • Scout / Analyze / Support  → reveals the incoming threat early.
 *  • Shield / Support           → delays arrival by 1 round.
 *  • Strike                     → weakens it by 20% of its corruptionMax.
 */
const EVENING_COUNTERPLAY: ReinforcementCounterplay = {
  revealsOn: ['scout', 'analyze', 'support'],
  delaysOn:  [
    { trigger: 'shield',  rounds: 1 },
    { trigger: 'support', rounds: 1 },
  ],
  weakensOn: [
    { trigger: 'strike', reductionPct: 0.20 },
  ],
} as const;

/**
 * Standard counterplay for the NIGHT latent activation:
 *  • Scout / Analyze / Blessing → reveals the hidden threat immediately.
 *  • Blessing                   → also weakens it by 15% on activation.
 *  No delay options — once the clock starts, only reveal or weaken applies.
 */
const NIGHT_COUNTERPLAY: ReinforcementCounterplay = {
  revealsOn: ['scout', 'analyze', 'blessing'],
  delaysOn:  [],
  weakensOn: [
    { trigger: 'blessing', reductionPct: 0.15 },
  ],
} as const;

/** Round on which the EVENING handoff arrives (player gets rounds 1–2 to prepare). */
export const EVENING_ARRIVAL_ROUND = 3;

/** Round on which the NIGHT latent threat auto-activates if unrevealed. */
export const NIGHT_ARRIVAL_ROUND = 3;

/** Fraction of corruptionMax added to the NIGHT threat when it self-activates unrevealed. */
export const NIGHT_READINESS_BONUS = 0.25;

// ── Day ────────────────────────────────────────────────────────────────────────

/**
 * DAY orchestration:
 *  • All threats from the group start active and visible.
 *  • No reinforcements.
 *  • Full intent visibility; highest support availability; simultaneous pressure.
 */
export function orchestrateDay(group: ThreatGroup): OrchestrationResult {
  return {
    shift:          'day',
    threats:        group.threats,
    reinforcements: [],
    hints: {
      shift:               'day',
      intentVisibility:    'full',
      supportAvailability: 'high',
      pressureType:        'simultaneous',
    },
  };
}

// ── Evening ────────────────────────────────────────────────────────────────────

/**
 * EVENING orchestration:
 *
 * If the group has exactly 3 threats:
 *  • The first two threats start active.
 *  • The third threat is deferred as a 'handoff' Reinforcement arriving at
 *    round 3 (telegraphed; player has rounds 1–2 to prepare).
 *  • Counterplay: reveal (scout/analyze/support), delay (shield/support +1 round),
 *    weaken (strike −20% corruption).
 *
 * If the group has 1–2 threats: same result as orchestrateDay.
 *
 * Partial intent visibility; normal support availability; sequential pressure.
 */
export function orchestrateEvening(group: ThreatGroup): OrchestrationResult {
  const hints: ShiftHints = {
    shift:               'evening',
    intentVisibility:    'partial',
    supportAvailability: 'normal',
    pressureType:        'sequential',
  };

  // Only apply handoff rule when there are exactly 3 threats.
  if (group.threats.length < 3) {
    return {
      shift:          'evening',
      threats:        group.threats,
      reinforcements: [],
      hints,
    };
  }

  const [first, second, third] = group.threats as [Threat, Threat, Threat];

  const reinforcement: Reinforcement = {
    kind:           'handoff',
    threat:         third,
    arrivalRound:   EVENING_ARRIVAL_ROUND,
    telegraphed:    true,
    counterplay:    EVENING_COUNTERPLAY,
    readinessBonus: 0,   // handoffs do not gain a readiness bonus
  };

  return {
    shift:          'evening',
    threats:        [first, second],
    reinforcements: [reinforcement],
    hints,
  };
}

// ── Night ──────────────────────────────────────────────────────────────────────

/**
 * NIGHT orchestration:
 *
 * If the group has 2–3 threats:
 *  • The LAST threat (never the 'acute') is set to latent=true, hidden=true.
 *    It remains in the threats array as a "Silent Risk".
 *  • A 'latent_activation' Reinforcement describes when and how it enters if
 *    the player does not reveal it (round 3, +25% readiness bonus on arrival).
 *  • Counterplay: reveal (scout/analyze/blessing), weaken (blessing −15%).
 *
 * If the group has only 1 threat: same result as orchestrateDay (cannot hide
 * the sole acute threat).
 *
 * Hidden intent visibility; low support availability; latent pressure.
 */
export function orchestrateNight(group: ThreatGroup): OrchestrationResult {
  const hints: ShiftHints = {
    shift:               'night',
    intentVisibility:    'hidden',
    supportAvailability: 'low',
    pressureType:        'latent',
  };

  // Cannot hide the sole acute threat.
  if (group.threats.length < 2) {
    return {
      shift:          'night',
      threats:        group.threats,
      reinforcements: [],
      hints,
    };
  }

  // Hide the last threat (lowest index priority = disruptor or progressive).
  // The 'acute' at index 0 is never touched.
  const lastIdx     = group.threats.length - 1;
  const baseThreat  = group.threats[lastIdx];

  const hiddenThreat: Threat = {
    ...baseThreat,
    latent: true,
    hidden: true,
  };

  const threats: Threat[] = [
    ...group.threats.slice(0, lastIdx),
    hiddenThreat,
  ];

  const reinforcement: Reinforcement = {
    kind:           'latent_activation',
    threat:         hiddenThreat,
    arrivalRound:   NIGHT_ARRIVAL_ROUND,
    telegraphed:    false,
    counterplay:    NIGHT_COUNTERPLAY,
    readinessBonus: NIGHT_READINESS_BONUS,
  };

  return {
    shift:          'night',
    threats,
    reinforcements: [reinforcement],
    hints,
  };
}

// ── Dispatch ───────────────────────────────────────────────────────────────────

/**
 * Orchestrate a ThreatGroup for the given shift.
 *
 * Dispatches to orchestrateDay / orchestrateEvening / orchestrateNight.
 * This is the primary entry point for the battle initialisation pipeline.
 *
 * @param group  Threat group produced by buildNormalThreatGroup /
 *               buildAreaBossThreatGroup / buildChapterBossThreatGroup.
 * @param shift  Current time-of-day shift.
 */
export function orchestrateForShift(
  group: ThreatGroup,
  shift: TimeOfDay,
): OrchestrationResult {
  switch (shift) {
    case 'day':     return orchestrateDay(group);
    case 'evening': return orchestrateEvening(group);
    case 'night':   return orchestrateNight(group);
    default: {
      const _: never = shift;
      return orchestrateDay(group);
    }
  }
}

// ── Validation ─────────────────────────────────────────────────────────────────

/**
 * Validate an OrchestrationResult.  Returns an array of error strings.
 * An empty array means the result is consistent.
 *
 * Checks:
 *  • threats array is not empty.
 *  • No threat in the result has role 'acute' AND is latent or hidden
 *    (the acute threat must always be visible at round 1).
 *  • For 'handoff' reinforcements: the threat must NOT be in the threats array.
 *  • For 'latent_activation' reinforcements: the threat MUST be in the threats
 *    array (with latent=true).
 *  • No duplicate threat ids across threats + reinforcement threats.
 *  • arrivalRound must be >= 2 (cannot arrive before round 2).
 *  • readinessBonus in [0, 1].
 */
export function validateOrchestration(result: OrchestrationResult): readonly string[] {
  const errors: string[] = [];
  const { threats, reinforcements } = result;

  if (threats.length === 0) {
    errors.push('OrchestrationResult: threats array is empty.');
  }

  // Acute must not be hidden or latent
  for (const t of threats) {
    if (t.role === 'acute' && (t.hidden || t.latent)) {
      errors.push(`Threat "${t.id}" has role 'acute' but is hidden or latent — acute must always be visible at round 1.`);
    }
  }

  const threatIds = new Set(threats.map(t => t.id));

  for (const r of reinforcements) {
    if (r.arrivalRound < 2) {
      errors.push(`Reinforcement "${r.threat.id}": arrivalRound ${r.arrivalRound} must be >= 2.`);
    }
    if (r.readinessBonus < 0 || r.readinessBonus > 1) {
      errors.push(`Reinforcement "${r.threat.id}": readinessBonus ${r.readinessBonus} must be in [0, 1].`);
    }

    if (r.kind === 'handoff') {
      if (threatIds.has(r.threat.id)) {
        errors.push(`Handoff reinforcement "${r.threat.id}" must NOT appear in the threats array.`);
      }
    }

    if (r.kind === 'latent_activation') {
      if (!threatIds.has(r.threat.id)) {
        errors.push(`latent-activation reinforcement "${r.threat.id}" MUST appear in the threats array (as latent+hidden).`);
      }
      const inThreats = threats.find(t => t.id === r.threat.id);
      if (inThreats && !inThreats.latent) {
        errors.push(`Latent-activation reinforcement "${r.threat.id}" is in threats but not marked latent.`);
      }
    }
  }

  // Duplicate id check across all threats + reinforcement threats
  const allIds = new Set<string>();
  for (const t of threats) {
    if (allIds.has(t.id)) errors.push(`Duplicate threat id "${t.id}" in threats array.`);
    allIds.add(t.id);
  }
  for (const r of reinforcements) {
    if (r.kind === 'handoff') {
      if (allIds.has(r.threat.id)) errors.push(`Duplicate threat id "${r.threat.id}" across threats and handoff reinforcements.`);
      allIds.add(r.threat.id);
    }
  }

  return errors;
}

// ── Convenience query ──────────────────────────────────────────────────────────

/**
 * Return the total number of unique threats in the orchestration (active +
 * deferred handoffs + latent activations).  Should never exceed MAX_THREATS.
 */
export function totalThreatCount(result: OrchestrationResult): number {
  const handoffIds = new Set(
    result.reinforcements
      .filter(r => r.kind === 'handoff')
      .map(r => r.threat.id),
  );
  return result.threats.length + handoffIds.size;
}
