/**
 * journeyMap/visionConfig.ts
 *
 * Configurable field-of-vision system for the journey map.
 *
 * FORMULA
 * ───────
 *   effectiveRadius = BASE_VISION_RADIUS + sum(active bonus values)
 *
 * Clamped to [BASE_VISION_RADIUS, MAX_VISION_RADIUS] so no single source can
 * trivialise exploration.
 *
 * EXTENSIBILITY SLOTS
 * ────────────────────
 *   getClassVisionBonuses(classTreeId)            — class passive (Scout, Ranger…)
 *   resolveVisionBonuses(classTreeId, tempBonuses) — all active sources combined
 *
 * Callers pass `computeEffectiveVisionRadius(bonuses)` directly to
 * `applyMoveToRun` or any fog function that accepts an optional `radius` param.
 *
 * HOW TO ADD A NEW VISION BONUS SOURCE
 * ──────────────────────────────────────
 *  1. Add its type to VisionBonusSource.
 *  2. Write a resolver function `getXxxVisionBonuses(input) → VisionBonus[]`.
 *  3. Spread its output inside resolveVisionBonuses().
 *  No other files need to change.
 */

import { REVEAL_RADIUS } from './fogCalculator';

// ── Baseline and cap ──────────────────────────────────────────────────────────

/**
 * Default field-of-vision radius for all players (spec rule 4).
 * Current tile + all tiles within 1 hex step are `visibleNow`.
 * Mirrors fogCalculator.REVEAL_RADIUS — both must stay in sync.
 */
export const BASE_VISION_RADIUS: number = REVEAL_RADIUS;

/**
 * Hard cap on effective vision radius.
 * A single class / buff is not allowed to make the whole map trivially readable.
 */
export const MAX_VISION_RADIUS = 4;

// ── Bonus types ───────────────────────────────────────────────────────────────

/**
 * Source category for a vision bonus.
 *
 * Adding a new union member here is the only type-level change needed;
 * implement the matching resolver and spread it in resolveVisionBonuses().
 */
export type VisionBonusSource =
  | 'class_passive'    // granted by the player's active class tree
  | 'temporary_buff'   // from an item or ward-shift skill (session or single-move)
  | 'prodigy_trait'    // from The Prodigy hero trait
  | 'scouting_skill';  // from an equipped scouting support skill

export interface VisionBonus {
  /** Category — used for logging and future UI attribution display. */
  source: VisionBonusSource;
  /** Positive integer added to BASE_VISION_RADIUS. */
  value:  number;
  /** Human-readable label for the UI (e.g. "Scout Passive +1"). */
  label?: string;
}

// ── Core formula ──────────────────────────────────────────────────────────────

/**
 * Compute the player's effective vision radius.
 *
 * effectiveRadius = BASE_VISION_RADIUS + Σ(bonus.value)
 * clamped to [BASE_VISION_RADIUS, MAX_VISION_RADIUS].
 *
 * @example
 *   computeEffectiveVisionRadius([])
 *   // → 1  (baseline, no bonuses)
 *
 *   computeEffectiveVisionRadius([{ source: 'class_passive', value: 1 }])
 *   // → 2  (Scout class with +1 vision)
 *
 *   computeEffectiveVisionRadius([{ source: 'class_passive', value: 10 }])
 *   // → 4  (capped at MAX_VISION_RADIUS)
 */
export function computeEffectiveVisionRadius(bonuses: VisionBonus[]): number {
  const sum   = bonuses.reduce((acc, b) => acc + b.value, 0);
  const total = BASE_VISION_RADIUS + sum;
  return Math.min(MAX_VISION_RADIUS, Math.max(BASE_VISION_RADIUS, total));
}

// ── Bonus resolvers ───────────────────────────────────────────────────────────

/**
 * CLASS_VISION_BONUSES registry.
 *
 * Map classTreeId → vision radius bonus value.
 * Add an entry here when a class earns a map-vision passive.
 * No other file needs to change.
 *
 * @example
 *   scout: 1   — Scout archetype sees 2 rings
 *   ranger: 1  — Ranger archetype sees 2 rings
 */
const CLASS_VISION_BONUSES: Readonly<Record<string, number>> = {
  // 'scout':  1,
  // 'ranger': 1,
};

/**
 * Resolve the vision bonus granted by the player's active class tree.
 * Returns [] if the classTreeId has no registered bonus (all current classes).
 */
export function getClassVisionBonuses(classTreeId: string | undefined): VisionBonus[] {
  if (!classTreeId) return [];
  const value = CLASS_VISION_BONUSES[classTreeId];
  if (!value) return [];
  return [{
    source: 'class_passive',
    value,
    label:  `${classTreeId} class passive`,
  }];
}

/**
 * Aggregate ALL active vision bonuses for a player session.
 *
 * Called once per move in fog-map.tsx.  Add new sources here as they ship:
 *   ...getSkillVisionBonuses(equippedSkills),
 *   ...getProdigyVisionBonuses(heroTeam),
 *
 * @param classTreeId   Player's active class tree id (or undefined).
 * @param tempBonuses   Transient buffs for this session (default: []).
 */
export function resolveVisionBonuses(
  classTreeId:  string | undefined,
  tempBonuses:  VisionBonus[] = [],
): VisionBonus[] {
  return [
    ...getClassVisionBonuses(classTreeId),
    ...tempBonuses,
    // Future: ...getSkillVisionBonuses(equippedSkills),
    // Future: ...getProdigyVisionBonuses(heroTeam),
  ];
}
