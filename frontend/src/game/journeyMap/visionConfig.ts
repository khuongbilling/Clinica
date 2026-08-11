/**
 * journeyMap/visionConfig.ts — Push 14 (extensible hex field of vision)
 *
 * FORMULA
 * ───────
 *   effectiveVisionRadius =
 *     BASE_VISION_RADIUS        (= 1, constant)
 *     + Σ(bonus.value for each active VisionBonus)
 *
 * Clamped to [BASE_VISION_RADIUS, MAX_VISION_RADIUS] so no single source
 * can trivialise exploration.
 *
 * BASE CASE (all bonuses = 0):
 *   effectiveVisionRadius = 1
 *   → current tile + all 6 adjacent tiles are visibleNow
 *
 * WIRING (fog-map.tsx):
 *   const radius = computeEffectiveVisionRadius(
 *     resolveVisionBonuses(player.class_tree_id)
 *   );
 *   // pass radius to applyMoveToRun() / computeInitialFog()
 *
 * HOW TO ADD A NEW BONUS SOURCE
 * ──────────────────────────────
 *  Class passive:   add an entry to CLASS_VISION_BONUSES (source: 'class_passive').
 *  Skill:           return a VisionBonus from a skill resolver, pass as tempBonuses.
 *  Equipment:       same as skill.
 *  Temporary buff:  same; clear when the buff expires.
 *
 * No other file changes needed — resolveVisionBonuses() collects everything.
 */

import { REVEAL_RADIUS } from './fogCalculator';

// ── Baseline and cap ──────────────────────────────────────────────────────────

/**
 * Default field-of-vision radius for all players (spec: base = 1).
 * Current tile + all tiles within 1 hex step → visibleNow.
 */
export const BASE_VISION_RADIUS: number = REVEAL_RADIUS; // 1

/**
 * Hard cap on effective vision radius.
 * No single class / buff can make the whole chapter trivially readable.
 */
export const MAX_VISION_RADIUS = 4;

// ── VisionBonus ───────────────────────────────────────────────────────────────

/**
 * One active vision bonus from any game-mechanic source.
 *
 * source — canonical source identifier; use a fixed string per mechanic so
 *           the UI can display the breakdown and future deduplication logic
 *           can target specific sources.
 * value  — signed integer added to BASE_VISION_RADIUS (negative values allowed;
 *           the total is always clamped to [BASE, MAX]).
 * label  — optional human-readable description for the UI bonus breakdown panel.
 *
 * @example
 *   { source: 'class_passive',   value: 1, label: 'Scout class vision' }
 *   { source: 'scouting_skill',  value: 1, label: 'Eagle Eye (equipped)' }
 *   { source: 'temporary_buff',  value: 1, label: 'Clarity Potion (3 moves)' }
 */
export interface VisionBonus {
  source: string;
  value:  number;
  label?: string;
}

// ── Core formula ──────────────────────────────────────────────────────────────

/**
 * Compute the player's effective vision radius from a list of active bonuses.
 *
 *   effectiveVisionRadius = BASE_VISION_RADIUS + Σ(bonus.value)
 *
 * Result clamped to [BASE_VISION_RADIUS, MAX_VISION_RADIUS].
 * An empty list returns BASE_VISION_RADIUS (= 1).
 *
 * @example
 *   computeEffectiveVisionRadius([])                                    // → 1
 *   computeEffectiveVisionRadius([{ source: 'class_passive', value: 1 }]) // → 2
 *   computeEffectiveVisionRadius([{ source: 'class_passive', value: 1 },
 *                                 { source: 'scouting_skill', value: 1 }]) // → 3
 *   computeEffectiveVisionRadius([{ source: 'temporary_buff', value: 99 }]) // → 4 (capped)
 */
export function computeEffectiveVisionRadius(bonuses: readonly VisionBonus[]): number {
  const total = BASE_VISION_RADIUS + bonuses.reduce((sum, b) => sum + b.value, 0);
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
 * Returns class-tree vision bonuses for the given classTreeId.
 *
 * Returns an empty array when:
 *   - classTreeId is undefined or empty string (player has no class yet)
 *   - the class has no vision passive registered in CLASS_VISION_BONUSES
 *
 * @example
 *   getClassVisionBonuses(undefined)  // → []
 *   getClassVisionBonuses('warrior')  // → []  (no passive registered)
 *   getClassVisionBonuses('scout')    // → [{ source: 'class_passive', value: 1, label: '...' }]
 */
export function getClassVisionBonuses(classTreeId: string | undefined): VisionBonus[] {
  if (!classTreeId) return [];
  const value = CLASS_VISION_BONUSES[classTreeId];
  if (!value) return [];
  return [{
    source: 'class_passive',
    value,
    label: `${classTreeId} vision passive`,
  }];
}

/**
 * Aggregate ALL active vision bonuses for a player session into a single
 * VisionBonus[] array, ready to pass to computeEffectiveVisionRadius().
 *
 * Sources resolved:
 *   classTreeId  → CLASS_VISION_BONUSES lookup via getClassVisionBonuses()
 *   tempBonuses  → skills, equipment, temporary item buffs — supplied by the
 *                  caller from the player's live combat/exploration state
 *
 * To add skill / equipment resolvers: compute VisionBonus values from player
 * state and pass them as tempBonuses — no change to this function needed.
 *
 * @param classTreeId  Player's active class tree id (undefined = no class).
 * @param tempBonuses  Additional transient bonuses (skill, item, ward-shift).
 *
 * @example
 *   // Baseline — no class, no bonuses → radius 1
 *   resolveVisionBonuses(undefined)         // → []
 *   computeEffectiveVisionRadius([])        // → 1
 *
 *   // Scout class passive → radius 2 (when registered)
 *   resolveVisionBonuses('scout')
 *
 *   // Temporary item buff → radius 2
 *   resolveVisionBonuses(undefined, [{ source: 'temporary_buff', value: 1 }])
 */
export function resolveVisionBonuses(
  classTreeId:  string | undefined,
  tempBonuses?: readonly VisionBonus[],
): VisionBonus[] {
  return [
    ...getClassVisionBonuses(classTreeId),
    ...(tempBonuses ?? []),
  ];
}
