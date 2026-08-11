/**
 * journeyMap/visionConfig.ts — Push 5 (radius-based field of vision)
 *
 * FORMULA
 * ───────
 *   effectiveVisionRadius =
 *     BASE_VISION_RADIUS        (= 1, constant)
 *     + classVisionBonus        (class tree passive, e.g. Scout +1)
 *     + skillVisionBonus        (equipped scouting support skill)
 *     + equipmentVisionBonus    (worn item / equipment piece)
 *     + temporaryVisionBonus    (item use, ward-shift buff, single-move)
 *
 * Clamped to [BASE_VISION_RADIUS, MAX_VISION_RADIUS] so no single source
 * can trivialise exploration.
 *
 * BASE CASE (all bonuses = 0):
 *   effectiveVisionRadius = 1
 *   → current tile + all 6 adjacent tiles are visibleNow
 *
 * WIRING
 * ──────
 *   fog-map.tsx calls:
 *     const radius = computeEffectiveVisionRadius(
 *       resolveVisionBonuses(player.class_tree_id)
 *     );
 *   and passes `radius` to applyMoveToRun() / computeInitialFog().
 *
 * HOW TO ADD A NEW BONUS SOURCE
 * ──────────────────────────────
 *  1. Add its value to the appropriate field in VisionBonusInputs.
 *  2. Write a resolver function that reads player/hero state.
 *  3. Populate that field inside resolveVisionBonuses() — no other file changes.
 */

import { REVEAL_RADIUS } from './fogCalculator';

// ── Baseline and cap ──────────────────────────────────────────────────────────

/**
 * Default field-of-vision radius for all players (spec: base = 1).
 * Current tile + all tiles within 1 hex step → visibleNow.
 */
export const BASE_VISION_RADIUS: number = REVEAL_RADIUS;   // 1

/**
 * Hard cap on effective vision radius.
 * No single class / buff can make the whole chapter trivially readable.
 */
export const MAX_VISION_RADIUS = 4;

// ── Named bonus slots ─────────────────────────────────────────────────────────

/**
 * One record per game-mechanic bonus source.
 *
 * All fields are plain numbers defaulting to 0.  Use ZERO_VISION_BONUSES as a
 * spread base so call sites only set the fields they actually control.
 *
 * @example
 *   // Scout class (+1) + no other bonuses → radius 2
 *   const b: VisionBonusInputs = { ...ZERO_VISION_BONUSES, classVisionBonus: 1 };
 *   computeEffectiveVisionRadius(b); // → 2
 *
 *   // Testing radius 2 explicitly:
 *   computeEffectiveVisionRadius({ ...ZERO_VISION_BONUSES, temporaryVisionBonus: 1 }); // → 2
 */
export interface VisionBonusInputs {
  /** Class tree passive — e.g. Scout or Ranger sees one extra ring. */
  classVisionBonus:     number;
  /** Equipped scouting support skill bonus. */
  skillVisionBonus:     number;
  /** Worn item or equipment slot bonus. */
  equipmentVisionBonus: number;
  /** Transient: item use, ward-shift ability, or single-move buff. */
  temporaryVisionBonus: number;
}

/** Zero-bonus baseline — spread to fill unused fields. */
export const ZERO_VISION_BONUSES: Readonly<VisionBonusInputs> = {
  classVisionBonus:     0,
  skillVisionBonus:     0,
  equipmentVisionBonus: 0,
  temporaryVisionBonus: 0,
};

// ── Core formula ──────────────────────────────────────────────────────────────

/**
 * Compute the player's effective vision radius.
 *
 *   effectiveVisionRadius =
 *     BASE_VISION_RADIUS
 *     + classVisionBonus
 *     + skillVisionBonus
 *     + equipmentVisionBonus
 *     + temporaryVisionBonus
 *
 * Result clamped to [BASE_VISION_RADIUS, MAX_VISION_RADIUS].
 *
 * @example
 *   computeEffectiveVisionRadius(ZERO_VISION_BONUSES)         // → 1
 *   computeEffectiveVisionRadius({ ...ZERO_VISION_BONUSES, classVisionBonus: 1 })   // → 2
 *   computeEffectiveVisionRadius({ ...ZERO_VISION_BONUSES, classVisionBonus: 10 })  // → 4 (capped)
 */
export function computeEffectiveVisionRadius(bonuses: VisionBonusInputs): number {
  const total =
    BASE_VISION_RADIUS
    + bonuses.classVisionBonus
    + bonuses.skillVisionBonus
    + bonuses.equipmentVisionBonus
    + bonuses.temporaryVisionBonus;
  return Math.min(MAX_VISION_RADIUS, Math.max(BASE_VISION_RADIUS, total));
}

// ── Per-source resolver registry ──────────────────────────────────────────────

/**
 * CLASS_VISION_BONUSES: classTreeId → bonus value.
 * Add an entry when a class earns a map-vision passive; no other changes needed.
 *
 * @example
 *   'scout':  1   // Scout archetype sees 2 rings
 *   'ranger': 1   // Ranger archetype sees 2 rings
 */
const CLASS_VISION_BONUSES: Readonly<Record<string, number>> = {
  // 'scout':  1,
  // 'ranger': 1,
};

/**
 * Aggregate ALL active vision bonuses for a player session into a single
 * VisionBonusInputs record, ready to pass to computeEffectiveVisionRadius().
 *
 * Add new source resolvers as their game mechanics ship:
 *   skillVisionBonus:     getSkillVisionBonus(equippedSkills),
 *   equipmentVisionBonus: getEquipmentVisionBonus(equipment),
 *   temporaryVisionBonus: run.activeBuffs.visionBonus ?? 0,
 *
 * @param classTreeId  Player's active class tree id (or undefined = no class yet).
 * @param overrides    Directly override individual bonus fields — useful for
 *                     temporary buffs or testing (e.g. { temporaryVisionBonus: 1 }).
 */
export function resolveVisionBonuses(
  classTreeId: string | undefined,
  overrides?:  Partial<VisionBonusInputs>,
): VisionBonusInputs {
  const classBonus = (classTreeId && CLASS_VISION_BONUSES[classTreeId]) || 0;
  return {
    ...ZERO_VISION_BONUSES,
    classVisionBonus: classBonus,
    // Future: skillVisionBonus:     getSkillVisionBonus(equippedSkills),
    // Future: equipmentVisionBonus: getEquipmentVisionBonus(equipment),
    ...overrides,   // transient buffs or test overrides applied last
  };
}
