/**
 * game/shiftPressure.ts — Push 11: persistent shift pressure system.
 *
 * One 0–100 pressure value per active chapter run.  The name and
 * semantics of the pressure scale depend on the current shift:
 *
 *   DAY     → Coordination Load
 *   EVENING → Handoff Debt
 *   NIGHT   → Silent Risk
 *
 * Sources
 * ────────
 *   Map decisions, Ward Event tile resolution, and battle outcomes all
 *   feed into pressure via PressureModifier deltas.  Each modifier carries
 *   a named source and a reason string for the HUD log.
 *
 * Effects
 * ────────
 *   Pressure resolves into a PressureLevel ('high' | 'moderate' | 'low') and
 *   from there into a flat list of PressureModEffect descriptors.  These
 *   descriptors are consumed by the battle engine to adjust:
 *     • TeamReadinessInput / EnemyReadinessInput (Pushes 9, 10)
 *     • Reinforcement arrival rounds (Push 8)
 *     • AP available in round 1
 *     • Intent visibility
 *     • Latent threat behaviour (Push 8)
 *
 * Stacking cap rule (spec requirement)
 * ──────────────────────────────────────
 *   getPressureEffects() returns AT MOST ONE effect of each PressureModEffectKind
 *   for a given pressure level.  Effects never accumulate across multiple sources.
 *
 * This module is pure domain logic — no React, no BattleState writes.
 */

import type { TimeOfDay } from './journeyMap/types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Pressure at or above this value is considered HIGH. */
export const PRESSURE_HIGH_THRESHOLD = 70;

/** Pressure at or below this value is considered LOW. */
export const PRESSURE_LOW_THRESHOLD  = 30;

/** Minimum pressure value (inclusive). */
export const PRESSURE_MIN = 0;

/** Maximum pressure value (inclusive). */
export const PRESSURE_MAX = 100;

// Specific effect magnitudes ─────────────────────────────────────────

/** AP penalty for high Coordination Load (day). */
export const DAY_HIGH_AP_PENALTY = 1;

/** Team readiness bonus for low Coordination Load (day). */
export const DAY_LOW_READINESS_BONUS = 5;

/** Call Team coordination penalty for high Coordination Load (day). */
export const DAY_HIGH_CALL_TEAM_PENALTY = 1;

/** Rounds reinforcement arrives earlier for high Handoff Debt (evening). */
export const EVENING_HIGH_ARRIVAL_DELTA = -1;

/** Rounds reinforcement is delayed for low Handoff Debt (evening). */
export const EVENING_LOW_ARRIVAL_DELTA = 1;

/** Rounds Support is delayed for high Handoff Debt (evening). */
export const EVENING_HIGH_SUPPORT_DELAY = 1;

/** Enemy readiness bonus for high Silent Risk (night). */
export const NIGHT_HIGH_ENEMY_READINESS = 10;

/** Team readiness bonus for low Silent Risk (night). */
export const NIGHT_LOW_TEAM_READINESS = 10;

/**
 * Additional readiness bonus fraction applied to a latent threat that
 * activates when Silent Risk is HIGH.  Stacks on top of NIGHT_READINESS_BONUS.
 */
export const NIGHT_HIGH_LATENT_BONUS = 0.15;

// ── Pressure level ────────────────────────────────────────────────────────────

/**
 * Named band derived from the 0–100 pressure value.
 *
 *  high     ≥ PRESSURE_HIGH_THRESHOLD (70)
 *  moderate  30 < value < 70
 *  low      ≤ PRESSURE_LOW_THRESHOLD  (30)
 */
export type PressureLevel = 'high' | 'moderate' | 'low';

/**
 * Resolve the pressure level from a raw value.
 *
 * @param value  0–100 (clamped internally).
 */
export function getPressureLevel(value: number): PressureLevel {
  const v = Math.min(PRESSURE_MAX, Math.max(PRESSURE_MIN, Math.round(value)));
  if (v >= PRESSURE_HIGH_THRESHOLD) return 'high';
  if (v <= PRESSURE_LOW_THRESHOLD)  return 'low';
  return 'moderate';
}

// ── Shift label ───────────────────────────────────────────────────────────────

/**
 * The HUD-facing name for the pressure scale on each shift.
 *
 *   day     → Coordination Load
 *   evening → Handoff Debt
 *   night   → Silent Risk
 */
export function getPressureLabel(shift: TimeOfDay): string {
  switch (shift) {
    case 'day':     return 'Coordination Load';
    case 'evening': return 'Handoff Debt';
    case 'night':   return 'Silent Risk';
    default: {
      const _: never = shift;
      return 'Pressure';
    }
  }
}

// ── ShiftPressure state ───────────────────────────────────────────────────────

/**
 * The chapter-scoped pressure value.
 *
 *  value  0–100 (clamped).  Starts at a shift-appropriate default.
 *  shift  Which shift produced this pressure instance.
 *  label  Human-readable name ('Coordination Load' / 'Handoff Debt' / 'Silent Risk').
 */
export interface ShiftPressure {
  readonly value: number;
  readonly shift: TimeOfDay;
  readonly label: string;
}

/**
 * Default starting pressure for each shift.
 * Moderate (50) is a neutral starting point.
 */
export const DEFAULT_PRESSURE_BY_SHIFT: Record<TimeOfDay, number> = {
  day:     50,
  evening: 50,
  night:   50,
} as const;

/**
 * Create a new ShiftPressure for the given shift.
 *
 * @param shift    Current time-of-day shift.
 * @param initial  Starting pressure value (default 50).
 */
export function createPressure(shift: TimeOfDay, initial?: number): ShiftPressure {
  const value = Math.min(PRESSURE_MAX, Math.max(PRESSURE_MIN,
    Math.round(initial ?? DEFAULT_PRESSURE_BY_SHIFT[shift])));
  return { value, shift, label: getPressureLabel(shift) };
}

// ── Pressure modifiers ────────────────────────────────────────────────────────

/**
 * What caused the pressure change.
 *  ward_event      — resolved a Ward Event tile on the fog map.
 *  battle_win      — won a battle encounter.
 *  battle_loss     — lost (or abandoned) a battle encounter.
 *  map_decision    — made a navigational choice (rest, explore, etc.).
 *  call_team       — a Call Team member action changed pressure.
 *  chapter_start   — initial pressure set at chapter start.
 */
export type PressureSourceKind =
  | 'ward_event'
  | 'battle_win'
  | 'battle_loss'
  | 'map_decision'
  | 'call_team'
  | 'chapter_start';

/**
 * A named event that modifies pressure by a signed delta.
 *
 *  delta   Positive = more pressure; negative = less pressure.
 *  reason  Short HUD log string (e.g. "Cleared suppression protocol").
 */
export interface PressureModifier {
  readonly source: PressureSourceKind;
  readonly delta:  number;
  readonly reason: string;
}

/**
 * Apply a pressure modifier and return the updated ShiftPressure.
 * The resulting value is clamped to [PRESSURE_MIN, PRESSURE_MAX].
 */
export function applyPressureModifier(
  pressure: ShiftPressure,
  mod:      PressureModifier,
): ShiftPressure {
  const next = Math.min(PRESSURE_MAX,
    Math.max(PRESSURE_MIN, Math.round(pressure.value + mod.delta)));
  return { ...pressure, value: next };
}

/**
 * Apply multiple modifiers in sequence and return the final ShiftPressure.
 * Modifiers are applied in order; each output feeds the next input.
 */
export function applyPressureModifiers(
  pressure:  ShiftPressure,
  modifiers: readonly PressureModifier[],
): ShiftPressure {
  return modifiers.reduce(applyPressureModifier, pressure);
}

// ── Pressure effects ──────────────────────────────────────────────────────────

/**
 * All possible effect kinds that pressure can generate.
 * Each kind appears AT MOST ONCE in a getPressureEffects() result.
 */
export type PressureModEffectKind =
  | 'ap_penalty'                 // day high:     −N first-round AP
  | 'side_objective'             // day high:     additional side objective
  | 'call_team_penalty'          // day high:     Call Team coordination penalty
  | 'readiness_team_bonus'       // day low / night low: +N team readiness
  | 'support_faster'             // day low:      faster Support call
  | 'intent_hidden'              // evening high: hide enemy intents
  | 'reinforcement_arrival_delta'// evening:      adjust arrival round (±N)
  | 'support_delay'              // evening high: delay Support calls
  | 'intent_revealed'            // evening low:  reveal enemy intents
  | 'protocol_card_opportunity'  // evening low:  free Protocol Card draw
  | 'readiness_enemy_bonus'      // night high:   +N enemy readiness
  | 'latent_readiness_bonus'     // night high:   latent threat activates stronger
  | 'ambush_eligible'            // night high:   lowers threshold to trigger Ambush
  | 'latent_threat_reveal'       // night low:    latent threat revealed immediately
  | 'first_response_eligible';   // night low:    lowers threshold for First Response

/** A typed pressure effect descriptor consumed by the battle engine. */
export type PressureModEffect =
  | { readonly kind: 'ap_penalty';                 readonly amount:  number }
  | { readonly kind: 'side_objective' }
  | { readonly kind: 'call_team_penalty';           readonly amount:  number }
  | { readonly kind: 'readiness_team_bonus';        readonly amount:  number }
  | { readonly kind: 'support_faster' }
  | { readonly kind: 'intent_hidden' }
  | { readonly kind: 'reinforcement_arrival_delta'; readonly rounds:  number }
  | { readonly kind: 'support_delay';               readonly rounds:  number }
  | { readonly kind: 'intent_revealed' }
  | { readonly kind: 'protocol_card_opportunity' }
  | { readonly kind: 'readiness_enemy_bonus';       readonly amount:  number }
  | { readonly kind: 'latent_readiness_bonus';      readonly value:   number }
  | { readonly kind: 'ambush_eligible' }
  | { readonly kind: 'latent_threat_reveal' }
  | { readonly kind: 'first_response_eligible' };

// ── Per-shift effect tables ───────────────────────────────────────────────────

const DAY_HIGH_EFFECTS: readonly PressureModEffect[] = [
  { kind: 'ap_penalty',       amount: DAY_HIGH_AP_PENALTY },
  { kind: 'side_objective' },
  { kind: 'call_team_penalty', amount: DAY_HIGH_CALL_TEAM_PENALTY },
] as const;

const DAY_LOW_EFFECTS: readonly PressureModEffect[] = [
  { kind: 'readiness_team_bonus', amount: DAY_LOW_READINESS_BONUS },
  { kind: 'support_faster' },
] as const;

const EVENING_HIGH_EFFECTS: readonly PressureModEffect[] = [
  { kind: 'intent_hidden' },
  { kind: 'reinforcement_arrival_delta', rounds: EVENING_HIGH_ARRIVAL_DELTA },
  { kind: 'support_delay', rounds: EVENING_HIGH_SUPPORT_DELAY },
] as const;

const EVENING_LOW_EFFECTS: readonly PressureModEffect[] = [
  { kind: 'intent_revealed' },
  { kind: 'protocol_card_opportunity' },
  { kind: 'reinforcement_arrival_delta', rounds: EVENING_LOW_ARRIVAL_DELTA },
] as const;

const NIGHT_HIGH_EFFECTS: readonly PressureModEffect[] = [
  { kind: 'readiness_enemy_bonus', amount: NIGHT_HIGH_ENEMY_READINESS },
  { kind: 'latent_readiness_bonus', value: NIGHT_HIGH_LATENT_BONUS },
  { kind: 'ambush_eligible' },
] as const;

const NIGHT_LOW_EFFECTS: readonly PressureModEffect[] = [
  { kind: 'readiness_team_bonus', amount: NIGHT_LOW_TEAM_READINESS },
  { kind: 'latent_threat_reveal' },
  { kind: 'first_response_eligible' },
] as const;

const MODERATE_EFFECTS: readonly PressureModEffect[] = [] as const;

/**
 * Resolve the active pressure effects for the current pressure state.
 *
 * Returns a flat list of PressureModEffect descriptors.  Each kind appears
 * AT MOST ONCE — the stacking cap rule is enforced structurally (the tables
 * themselves contain no duplicates, and only one table is selected per level).
 *
 * @param pressure  Current ShiftPressure.
 */
export function getPressureEffects(pressure: ShiftPressure): readonly PressureModEffect[] {
  const level = getPressureLevel(pressure.value);
  if (level === 'moderate') return MODERATE_EFFECTS;

  switch (pressure.shift) {
    case 'day':
      return level === 'high' ? DAY_HIGH_EFFECTS : DAY_LOW_EFFECTS;
    case 'evening':
      return level === 'high' ? EVENING_HIGH_EFFECTS : EVENING_LOW_EFFECTS;
    case 'night':
      return level === 'high' ? NIGHT_HIGH_EFFECTS : NIGHT_LOW_EFFECTS;
    default: {
      const _: never = pressure.shift;
      return MODERATE_EFFECTS;
    }
  }
}

// ── Effect query helpers ──────────────────────────────────────────────────────

/** Find an effect by kind (returns undefined if absent). */
export function findEffect<K extends PressureModEffectKind>(
  effects: readonly PressureModEffect[],
  kind: K,
): Extract<PressureModEffect, { kind: K }> | undefined {
  return effects.find((e): e is Extract<PressureModEffect, { kind: K }> => e.kind === kind);
}

/**
 * Net team readiness modifier from the current pressure effects.
 * Positive = bonus; negative = penalty.
 * Maps: readiness_team_bonus → positive, ap_penalty → (already handled separately).
 */
export function pressureTeamReadinessDelta(effects: readonly PressureModEffect[]): number {
  const bonus = findEffect(effects, 'readiness_team_bonus');
  return bonus ? bonus.amount : 0;
}

/**
 * Net enemy readiness modifier from the current pressure effects.
 */
export function pressureEnemyReadinessDelta(effects: readonly PressureModEffect[]): number {
  const bonus = findEffect(effects, 'readiness_enemy_bonus');
  return bonus ? bonus.amount : 0;
}

/**
 * AP penalty from the current pressure effects (0 if none).
 * The battle engine subtracts this from round-1 available AP.
 */
export function pressureApPenalty(effects: readonly PressureModEffect[]): number {
  const penalty = findEffect(effects, 'ap_penalty');
  return penalty ? penalty.amount : 0;
}

/**
 * Reinforcement arrival-round delta from the current pressure effects (0 if none).
 * Negative = earlier (high evening pressure); positive = later (low evening pressure).
 * Caller adds this to Reinforcement.arrivalRound, clamping to ≥ 2.
 */
export function pressureArrivalDelta(effects: readonly PressureModEffect[]): number {
  const delta = findEffect(effects, 'reinforcement_arrival_delta');
  return delta ? delta.rounds : 0;
}

/**
 * True when the current effects include an intent_hidden modifier.
 * Battle HUD should obscure threat intents when true.
 */
export function pressureHidesIntent(effects: readonly PressureModEffect[]): boolean {
  return effects.some(e => e.kind === 'intent_hidden');
}

/**
 * True when the current effects include an intent_revealed modifier.
 * Battle HUD should show ALL threat intents (even hidden ones) when true.
 */
export function pressureRevealsIntent(effects: readonly PressureModEffect[]): boolean {
  return effects.some(e => e.kind === 'intent_revealed');
}

/**
 * True when high Silent Risk makes the latent threat eligible for immediate reveal.
 * Caller checks this before applying NIGHT_COUNTERPLAY in shiftOrchestration.
 */
export function pressureRevealsLatent(effects: readonly PressureModEffect[]): boolean {
  return effects.some(e => e.kind === 'latent_threat_reveal');
}

/**
 * Extra latent readiness-bonus fraction from high Silent Risk.
 * Added on top of NIGHT_READINESS_BONUS in shiftOrchestration when the latent
 * threat auto-activates unrevealed.
 */
export function pressureLatentBonus(effects: readonly PressureModEffect[]): number {
  const e = findEffect(effects, 'latent_readiness_bonus');
  return e ? e.value : 0;
}

// ── Summary ───────────────────────────────────────────────────────────────────

/**
 * Human-readable one-line summary of the current pressure state for the HUD.
 *
 * Examples:
 *   "Coordination Load: 72 — High"
 *   "Handoff Debt: 28 — Low"
 *   "Silent Risk: 50 — Moderate"
 */
export function describePressure(pressure: ShiftPressure): string {
  const level = getPressureLevel(pressure.value);
  const cap   = level.charAt(0).toUpperCase() + level.slice(1);
  return `${pressure.label}: ${pressure.value} — ${cap}`;
}

/**
 * Short effect summary string for tooltip / sidebar display.
 * Returns empty string for moderate pressure.
 */
export function describePressureEffects(pressure: ShiftPressure): string {
  const effects = getPressureEffects(pressure);
  if (effects.length === 0) return '';

  const level = getPressureLevel(pressure.value);
  const parts: string[] = [];

  for (const e of effects) {
    switch (e.kind) {
      case 'ap_penalty':
        parts.push(`−${e.amount} AP round 1`); break;
      case 'side_objective':
        parts.push('Side objective active'); break;
      case 'call_team_penalty':
        parts.push(`Call Team −${e.amount} coordination`); break;
      case 'readiness_team_bonus':
        parts.push(`+${e.amount} Team Readiness`); break;
      case 'support_faster':
        parts.push('Support faster'); break;
      case 'intent_hidden':
        parts.push('Intents hidden'); break;
      case 'reinforcement_arrival_delta':
        parts.push(e.rounds < 0
          ? `Reinforcement ${Math.abs(e.rounds)}r earlier`
          : `Reinforcement ${e.rounds}r later`); break;
      case 'support_delay':
        parts.push(`Support ${e.rounds}r delayed`); break;
      case 'intent_revealed':
        parts.push('Intents revealed'); break;
      case 'protocol_card_opportunity':
        parts.push('Free Protocol Card'); break;
      case 'readiness_enemy_bonus':
        parts.push(`+${e.amount} Enemy Readiness`); break;
      case 'latent_readiness_bonus':
        parts.push(`Latent threat +${Math.round(e.value * 100)}% readiness`); break;
      case 'ambush_eligible':
        parts.push('Ambush eligible'); break;
      case 'latent_threat_reveal':
        parts.push('Latent threat revealed'); break;
      case 'first_response_eligible':
        parts.push('First Response eligible'); break;
    }
  }

  return parts.join(' · ');
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a ShiftPressure.  Returns an array of error strings.
 *
 * Checks:
 *  • value is an integer in [PRESSURE_MIN, PRESSURE_MAX].
 *  • shift is a valid TimeOfDay.
 *  • label matches getPressureLabel(shift).
 */
export function validatePressure(pressure: ShiftPressure): readonly string[] {
  const errors: string[] = [];
  const { value, shift, label } = pressure;

  if (!Number.isInteger(value) || value < PRESSURE_MIN || value > PRESSURE_MAX) {
    errors.push(`pressure.value ${value} must be an integer in [${PRESSURE_MIN}, ${PRESSURE_MAX}].`);
  }
  if (!['day', 'evening', 'night'].includes(shift)) {
    errors.push(`pressure.shift "${shift}" is not a valid TimeOfDay.`);
  }
  const expectedLabel = getPressureLabel(shift as TimeOfDay);
  if (label !== expectedLabel) {
    errors.push(`pressure.label "${label}" does not match getPressureLabel("${shift}") = "${expectedLabel}".`);
  }

  return errors;
}
