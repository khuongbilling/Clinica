/**
 * game/threats.ts — Multi-threat combat domain model (Push 5).
 *
 * Adds a typed Threat layer that sits alongside the existing
 * BattleState / WaveMember model.  This module is pure domain logic with
 * no dependencies on React or the battle reducer.
 *
 * Design rules
 * ─────────────
 *  • MAX_THREATS = 3 concurrent threats per encounter.
 *  • Stability is shared across all threats (lives on BattleState).
 *  • A threat is resolved when corruptionCurrent reaches 0.
 *  • Victory  = every required threat resolved AND stability > 0.
 *  • Failure  = stability <= 0.
 *  • Immutable update pattern: all mutation helpers return a new Threat.
 *  • Backward compat: existing BattleState / WaveMember are untouched.
 *  • MULTI_THREAT_COMBAT_V1 gates UI wiring; this module is always safe to import.
 *
 * Threat roles
 * ─────────────
 *  acute       — primary presenting problem; always required for victory.
 *  progressive — secondary threat that escalates if left untreated; required.
 *  disruptor   — complication that disrupts care actions; required.
 *  risk        — potential complication; not required (resolving it earns bonuses).
 *  barrier     — blocks access to core care pathways; not required for victory but
 *                must be resolved before certain actions on other threats work.
 *
 * Victory requirements
 * ─────────────────────
 *  Threats with roles 'acute', 'progressive', and 'disruptor' are "required".
 *  Threats with roles 'risk' or 'barrier' are optional (bonus objectives).
 *  Latent threats (not yet active) are never required regardless of role.
 */

import type { Enemy } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum concurrent Threat objects in a single encounter. */
export const MAX_THREATS = 3 as const;

/** Threat speed is clamped to [MIN_SPEED, MAX_SPEED]. */
export const MIN_SPEED = 1 as const;
export const MAX_SPEED = 10 as const;

// ── Core types ────────────────────────────────────────────────────────────────

/**
 * The clinical role a threat plays in the encounter.
 *
 *  acute       — primary presenting problem (required to resolve for victory).
 *  progressive — secondary threat that worsens each turn (required).
 *  disruptor   — complicates care actions; knocks out skills if unmanaged (required).
 *  risk        — latent hazard; resolving it is a bonus objective (not required).
 *  barrier     — blocks pathways or items until resolved (not required for win).
 */
export type ThreatRole = 'acute' | 'progressive' | 'disruptor' | 'risk' | 'barrier';

/**
 * What the threat is signalling / about to do this turn.
 * Resolved as a discriminated union so switch exhaustiveness is checked.
 */
export type ThreatIntent =
  | { kind: 'idle' }                                          // no special action
  | { kind: 'surge';    magnitude: number }                   // spike corruption damage next
  | { kind: 'corrupt';  magnitude: number }                   // extra direct stability drain
  | { kind: 'spread';   targetThreatId?: string }             // may propagate to another slot
  | { kind: 'escalate' }                                      // advance to next phase / increase speed
  | { kind: 'disrupt';  targetRole: ThreatRole };             // disable actions on another threat

/**
 * Runtime modifier bag on a Threat (buffs / debuffs applied during the encounter).
 * All fields are additive deltas or replacement multipliers as noted.
 */
export interface ThreatModifiers {
  /** 0.0–1.0 flat reduction on incoming corruption damage (e.g. 0.2 = 20% resist). */
  corruptionResistance: number;
  /** Additive bonus to per-turn stability drain (stacks with enemy.instability). */
  stabilityDrainBonus:  number;
  /** 0.0–1.0 probability this threat spreads corruption to another slot each turn. */
  spreadChance:         number;
  /** When true, care-chain bonuses do not apply to actions targeting this threat. */
  immuneToChain:        boolean;
  /** When true, next incoming corruption-damage hit is absorbed (cleared after use). */
  shielded:             boolean;
}

/** A single active (or latent) threat in a multi-threat encounter. */
export interface Threat {
  /** Unique identifier — matches enemy.id when created from an Enemy. */
  readonly id:               string;
  /** Display name shown in the battle HUD. */
  readonly name:             string;
  /** Current corruption HP; drops toward 0 as the player deals corruption damage. */
  corruptionCurrent:         number;
  /** Maximum corruption at encounter start; never changes after creation. */
  readonly corruptionMax:    number;
  /**
   * Turn-order priority (1–10, higher acts sooner each enemy phase).
   * Maps to enemy.instability when created from an Enemy.
   */
  readonly speed:            number;
  /** Clinical role determining required-for-victory status and AI behaviour. */
  readonly role:             ThreatRole;
  /** What the threat intends to do this turn (updated at start of each enemy phase). */
  intent:                    ThreatIntent;
  /**
   * true once corruptionCurrent reaches 0.
   * Call syncResolved() or applyCorruptionDelta() to keep this consistent.
   */
  resolved:                  boolean;
  /**
   * Hidden threats exist and deal damage but are not shown in the UI.
   * Revealed via Scout / Assess actions.
   */
  hidden:                    boolean;
  /**
   * Latent threats are queued but not yet active; they enter play when
   * a trigger condition fires (e.g. another threat is resolved, turn N reached).
   * Latent threats are never required for victory.
   */
  latent:                    boolean;
  /** Runtime buff / debuff bag. */
  modifiers:                 ThreatModifiers;
}

/**
 * The threat-list slice that will be merged into an extended BattleState when
 * MULTI_THREAT_COMBAT_V1 activates.  Stability is NOT duplicated here — it
 * stays on BattleState as the single shared value.
 */
export interface MultiThreatBattleState {
  /** 1–MAX_THREATS concurrent Threat objects. */
  threats: readonly Threat[];
}

// ── Defaults ──────────────────────────────────────────────────────────────────

/** Zero-value modifiers for a freshly created Threat. */
export const DEFAULT_THREAT_MODIFIERS: Readonly<ThreatModifiers> = {
  corruptionResistance: 0,
  stabilityDrainBonus:  0,
  spreadChance:         0,
  immuneToChain:        false,
  shielded:             false,
};

/**
 * Default role sequence used when buildThreats() receives no explicit roles.
 * First enemy → acute, second → progressive, third → disruptor.
 */
const DEFAULT_ROLE_SEQUENCE: readonly ThreatRole[] = ['acute', 'progressive', 'disruptor'];

// ── Constructors ──────────────────────────────────────────────────────────────

/** Options for makeThreat(). All fields except id/name/corruptionMax are optional. */
export interface MakeThreatOptions {
  id:                       string;
  name:                     string;
  corruptionMax:            number;
  corruptionCurrent?:       number;       // defaults to corruptionMax
  speed?:                   number;       // defaults to 5
  role?:                    ThreatRole;   // defaults to 'acute'
  intent?:                  ThreatIntent; // defaults to { kind: 'idle' }
  resolved?:                boolean;      // defaults to corruptionCurrent <= 0
  hidden?:                  boolean;      // defaults to false
  latent?:                  boolean;      // defaults to false
  modifiers?:               Partial<ThreatModifiers>;
}

/**
 * Create a Threat from an explicit options bag.
 * Clamps corruptionCurrent to [0, corruptionMax] and auto-computes resolved.
 */
export function makeThreat(opts: MakeThreatOptions): Threat {
  const corruptionMax     = Math.max(0, opts.corruptionMax);
  const corruptionCurrent = Math.min(
    corruptionMax,
    Math.max(0, opts.corruptionCurrent ?? corruptionMax),
  );
  const speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(opts.speed ?? 5)));
  return {
    id:               opts.id,
    name:             opts.name,
    corruptionCurrent,
    corruptionMax,
    speed,
    role:             opts.role    ?? 'acute',
    intent:           opts.intent  ?? { kind: 'idle' },
    resolved:         opts.resolved ?? (corruptionCurrent <= 0),
    hidden:           opts.hidden  ?? false,
    latent:           opts.latent  ?? false,
    modifiers: {
      ...DEFAULT_THREAT_MODIFIERS,
      ...(opts.modifiers ?? {}),
    },
  };
}

/**
 * Convert an existing Enemy into a Threat.
 *
 * Mapping:
 *  enemy.id              → threat.id
 *  enemy.name            → threat.name
 *  enemy.corruption      → corruptionMax + corruptionCurrent
 *  enemy.instability     → speed (both use a 1–10 scale)
 *  role argument         → role (default 'acute')
 */
export function threatFromEnemy(enemy: Enemy, role: ThreatRole = 'acute'): Threat {
  return makeThreat({
    id:            enemy.id,
    name:          enemy.name,
    corruptionMax: enemy.corruption,
    speed:         enemy.instability,
    role,
  });
}

/**
 * Build a readonly Threat array from up to MAX_THREATS enemies.
 * Extra enemies beyond the cap are silently discarded.
 *
 * @param enemies  Source enemy objects (1–3).
 * @param roles    Optional explicit role for each slot.  Defaults to
 *                 DEFAULT_ROLE_SEQUENCE (acute / progressive / disruptor).
 */
export function buildThreats(
  enemies:  readonly Enemy[],
  roles?:   readonly ThreatRole[],
): readonly Threat[] {
  return enemies
    .slice(0, MAX_THREATS)
    .map((enemy, i) =>
      threatFromEnemy(enemy, roles?.[i] ?? DEFAULT_ROLE_SEQUENCE[i] ?? 'acute'),
    );
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** True when the threat's corruption has been fully removed. */
export function isThreatResolved(t: Threat): boolean {
  return t.corruptionCurrent <= 0;
}

/**
 * True when the threat must be resolved for a multi-threat victory.
 *
 * Required roles: acute, progressive, disruptor.
 * Optional roles: risk, barrier.
 * Latent threats are never required regardless of role.
 */
export function isRequiredThreat(t: Threat): boolean {
  if (t.latent) return false;
  return t.role === 'acute' || t.role === 'progressive' || t.role === 'disruptor';
}

/** True when every required threat has been resolved. */
export function allRequiredResolved(threats: readonly Threat[]): boolean {
  return threats.filter(isRequiredThreat).every(t => t.resolved);
}

/**
 * Multi-threat victory condition:
 *   all required threats resolved AND stability > 0.
 */
export function isVictory(threats: readonly Threat[], stability: number): boolean {
  return stability > 0 && allRequiredResolved(threats);
}

/**
 * Battle failure condition:
 *   stability <= 0 (shared across all threats).
 */
export function isFailure(stability: number): boolean {
  return stability <= 0;
}

/** Number of non-latent threats currently active. */
export function activeThreatCount(threats: readonly Threat[]): number {
  return threats.filter(t => !t.latent).length;
}

/** All threats that are still unresolved and not latent. */
export function pendingThreats(threats: readonly Threat[]): readonly Threat[] {
  return threats.filter(t => !t.latent && !t.resolved);
}

/**
 * Return threats sorted by speed descending (highest speed acts first).
 * Ties are broken by array position (lower index first).
 */
export function threatsInTurnOrder(threats: readonly Threat[]): readonly Threat[] {
  return [...threats].sort((a, b) => b.speed - a.speed);
}

// ── Immutable mutation helpers ─────────────────────────────────────────────────

/**
 * Apply a signed corruption delta to a threat and auto-sync resolved.
 *
 *  Positive delta = healing (adds corruption back, capped at corruptionMax).
 *  Negative delta = damage (reduces corruption toward 0, cannot go below 0).
 *
 * When modifiers.corruptionResistance > 0, damage (negative delta) is reduced
 * proportionally.  Healing is not affected by resistance.
 *
 * Returns a new Threat; does not mutate the original.
 */
export function applyCorruptionDelta(threat: Threat, delta: number): Threat {
  let effective = delta;

  // Apply resistance only to damage (negative delta).
  if (delta < 0) {
    const resist = Math.min(1, Math.max(0, threat.modifiers.corruptionResistance));
    effective    = delta * (1 - resist);

    // Absorb the hit if shielded; clear the shield.
    if (threat.modifiers.shielded) {
      return {
        ...threat,
        modifiers: { ...threat.modifiers, shielded: false },
      };
    }
  }

  const corruptionCurrent = Math.min(
    threat.corruptionMax,
    Math.max(0, threat.corruptionCurrent + effective),
  );

  return {
    ...threat,
    corruptionCurrent,
    resolved: corruptionCurrent <= 0,
  };
}

/**
 * Set the threat's intent for this turn.
 * Returns a new Threat; does not mutate the original.
 */
export function setThreatIntent(threat: Threat, intent: ThreatIntent): Threat {
  return { ...threat, intent };
}

/**
 * Reveal a hidden threat (sets hidden = false).
 * No-op if already revealed.
 */
export function revealThreat(threat: Threat): Threat {
  if (!threat.hidden) return threat;
  return { ...threat, hidden: false };
}

/**
 * Activate a latent threat (sets latent = false).
 * No-op if already active.
 */
export function activateThreat(threat: Threat): Threat {
  if (!threat.latent) return threat;
  return { ...threat, latent: false };
}

/**
 * Re-derive the resolved flag from corruptionCurrent.
 * Call this after any manual corruptionCurrent mutation (prefer applyCorruptionDelta
 * which handles this automatically).
 */
export function syncResolved(threat: Threat): Threat {
  const resolved = threat.corruptionCurrent <= 0;
  if (threat.resolved === resolved) return threat;
  return { ...threat, resolved };
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a threat array.  Returns an array of human-readable error strings.
 * An empty array means the threat list is valid.
 *
 * Checks:
 *  • Total count ≤ MAX_THREATS.
 *  • No duplicate threat ids.
 *  • Each corruptionMax > 0.
 *  • Each corruptionCurrent in [0, corruptionMax].
 *  • Each speed in [MIN_SPEED, MAX_SPEED].
 *  • corruptionResistance in [0, 1].
 *  • spreadChance in [0, 1].
 *  • No more than one threat with role 'acute' (primary presenter).
 *  • resolved flag consistent with corruptionCurrent.
 */
export function validateThreats(threats: readonly Threat[]): readonly string[] {
  const errors: string[] = [];

  if (threats.length > MAX_THREATS) {
    errors.push(`Too many threats: ${threats.length} (max ${MAX_THREATS}).`);
  }

  const ids = new Set<string>();
  let acuteCount = 0;

  for (const t of threats) {
    const tag = `Threat "${t.id}"`;

    if (ids.has(t.id)) {
      errors.push(`${tag}: duplicate id.`);
    }
    ids.add(t.id);

    if (t.corruptionMax <= 0) {
      errors.push(`${tag}: corruptionMax must be > 0 (got ${t.corruptionMax}).`);
    }
    if (t.corruptionCurrent < 0) {
      errors.push(`${tag}: corruptionCurrent cannot be negative (got ${t.corruptionCurrent}).`);
    }
    if (t.corruptionCurrent > t.corruptionMax) {
      errors.push(
        `${tag}: corruptionCurrent (${t.corruptionCurrent}) exceeds corruptionMax (${t.corruptionMax}).`,
      );
    }
    if (t.speed < MIN_SPEED || t.speed > MAX_SPEED) {
      errors.push(`${tag}: speed ${t.speed} out of [${MIN_SPEED}, ${MAX_SPEED}].`);
    }
    if (t.modifiers.corruptionResistance < 0 || t.modifiers.corruptionResistance > 1) {
      errors.push(`${tag}: corruptionResistance ${t.modifiers.corruptionResistance} out of [0, 1].`);
    }
    if (t.modifiers.spreadChance < 0 || t.modifiers.spreadChance > 1) {
      errors.push(`${tag}: spreadChance ${t.modifiers.spreadChance} out of [0, 1].`);
    }
    // resolved consistency
    const expectedResolved = t.corruptionCurrent <= 0;
    if (t.resolved !== expectedResolved) {
      errors.push(
        `${tag}: resolved flag (${t.resolved}) is inconsistent with corruptionCurrent (${t.corruptionCurrent}).`,
      );
    }

    if (t.role === 'acute') acuteCount++;
  }

  if (acuteCount > 1) {
    errors.push(`Only one threat may have role 'acute' (found ${acuteCount}).`);
  }

  return errors;
}
