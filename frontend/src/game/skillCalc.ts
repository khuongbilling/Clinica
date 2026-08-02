/**
 * Centralized skill effect calculation — Push 2 + Push 4 + Push 6.
 *
 * Push 2: wired existing clinical modifiers into a single SkillModifiers bag.
 * Push 4: activated heroStatMod — modest per-hero stat scaling.
 * Push 6: activated affinityFamilyMod — ×1.15 strong / ×0.90 weak / ×1.00 neutral
 *         based on hero.strongAffinities / hero.weakAffinities vs enemy.primaryAffinity.
 *
 * Formula:
 *   Strike   = base × (1 + elementBonus) × affinity × clinical × system
 *              × chapter × cast × heroStat × affinityFamily
 *              × [heroLevel × equipment × leaderBonus × playerClass
 *                 × careChain × clinicalCue]
 *
 *   Stabilize = base × clinical × system × corruption × cast × heroStat
 *              × affinityFamily × stabilityGain × enemyResistance
 *              × [heroLevel × equipment × leaderBonus
 *                 × playerClass × careChain × clinicalCue]
 *              + cueBonusFlat           ← flat bonus after multiply,
 *                                         BEFORE stabilityGain & resistance
 *
 *   Shield    = base × heroStat × affinityFamily
 *              × [heroLevel × equipment × leaderBonus × playerClass × careChain]
 *
 * Square-bracketed factors are future slots (×1.00 until their push).
 */

import { ActionType, AffinityFamily, HeroCombatStats } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Hero stat → multiplier helpers  (Combat Scaling Push 4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a raw hero stat value to a ×multiplier for heroStatMod.
 *
 * Baseline is stat = 10 → ×1.00 (common-tier average).
 * Each point above/below shifts the multiplier by ±0.0133 (Push 13: widened from ±0.01).
 *
 * | stat | ×mult  | who has this                    |
 * |------|--------|---------------------------------|
 * |  5   | ×0.93  | very low (weakest common)       |
 * | 10   | ×1.00  | common average (baseline)       |
 * | 16   | ×1.08  | uncommon peak                   |
 * | 22   | ×1.16  | rare peak                       |
 * | 30   | ×1.27  | epic peak                       |
 * | 45   | ×1.40  | legendary prologue heroes (cap) |
 * | 55+  | ×1.40  | mythic (hard cap)               |
 */
export function statToMultiplier(stat: number): number {
  return Math.min(1.40, Math.max(0.90, 1.0 + (stat - 10) / 75));
}

/**
 * Returns the hero stat value that should scale a skill of the given type.
 *
 * Skill type → stat mapping (per spec):
 *   scout / analyze        → insight
 *   stabilize / support / cleanse → carePower
 *   strike / counter       → intervention
 *   shield                 → guard
 *   command                → coordination
 *
 * Shield effects always use guard regardless of skill type — see applySkill
 * in battle.ts where shieldMods is built separately with hero.stats.guard.
 */
export function statForSkillType(type: ActionType, stats: HeroCombatStats): number {
  switch (type) {
    case 'scout':    return stats.insight;
    case 'analyze':  return stats.insight;
    case 'stabilize':return stats.carePower;
    case 'support':  return stats.carePower;
    case 'cleanse':  return stats.carePower;
    case 'strike':   return stats.intervention;
    case 'counter':  return stats.intervention;
    case 'shield':   return stats.guard;
    case 'command':  return stats.coordination;
    default:         return 10; // neutral → ×1.00
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Affinity family match multiplier  (Combat Scaling Push 6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the affinity-family match multiplier for one hero action against
 * one enemy.
 *
 * | condition                            | ×mult | rationale                      |
 * |--------------------------------------|-------|--------------------------------|
 * | hero.strongAffinities ∩ enemyAffs ≠∅ | ×1.15 | middle of spec range 1.10–1.20 |
 * | hero.weakAffinities   ∩ enemyAffs ≠∅ | ×0.90 | middle of spec range 0.85–0.95 |
 * | no overlap (neutral)                 | ×1.00 |                                |
 *
 * Both enemy affinity slots are checked (primary + secondary) so a hero
 * specialising in a secondary domain still gets recognition.
 *
 * Fails safely to ×1.00 when Push-5 affinity data is absent on either side,
 * ensuring old heroes/enemies never crash.
 */
/**
 * @param affinityResistance Push-7 enemy field (0.0–0.20).
 *   Dampens the strong-match bonus only: effective mult = 1 + 0.15 × (1 − resistance).
 *   Does not affect the weak-match penalty (player's weakness is not mitigated by the enemy).
 */
export function calcAffinityFamilyMod(
  heroStrong: AffinityFamily[] | undefined,
  heroWeak:   AffinityFamily[] | undefined,
  enemyPrimary:   AffinityFamily | undefined,
  /** All secondary clinical domains (Push 1: array replaces deprecated single secondaryAffinity). */
  enemySecondary: AffinityFamily[] | AffinityFamily | undefined,
  affinityResistance: number = 0,
): number {
  // No data on either side → neutral (graceful fallback for pre-Push-5 objects)
  if (!enemyPrimary || (!heroStrong?.length && !heroWeak?.length)) return 1.00;

  // Normalise: accept both legacy single value and new array form.
  const secondaryArr: AffinityFamily[] = Array.isArray(enemySecondary)
    ? enemySecondary
    : enemySecondary ? [enemySecondary] : [];
  const enemyAffs = [enemyPrimary, ...secondaryArr].filter(
    (a): a is AffinityFamily => a !== undefined,
  );
  const strong = heroStrong ?? [];
  const weak   = heroWeak   ?? [];

  if (enemyAffs.some(a => strong.includes(a))) {
    // Push 7: affinityResistance dampens the bonus portion (0.18) but not the base (1.0)
    // Push 13: bonus raised 0.15 → 0.18 so strong-affinity match is clearly noticeable.
    return 1 + 0.18 * (1 - Math.min(affinityResistance, 1));
  }
  // Push 13: weak penalty tightened 0.90 → 0.87 so mismatched heroes feel meaningfully weaker.
  if (enemyAffs.some(a => weak.includes(a))) return 0.87; // weak match — penalty unchanged
  return 1.00;                                             // neutral
}

// ─────────────────────────────────────────────────────────────────────────────
// Modifier bag
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillModifiers {
  // ── Active now ──────────────────────────────────────────────────────────────
  /**
   * Treatment-correctness multiplier.
   * Strike:    corrOutcome.reductionMult  (strong 1.6 / appropriate 1.0 / weak 0.3 / bad 0)
   * Stabilize: res.modifier              (from evaluateClinicalAppropriateness)
   */
  clinicalMod: number;
  /** System-match bonus from res.systemModifier. */
  systemMod: number;
  /**
   * Perfect / Good / Normal cast quality (CAST_QUALITY_MULTIPLIER).
   * 1.0 for items, cards, temp actions (they have no cast prompt).
   */
  castMult: number;
  /**
   * Stabilize only: getStabilizationModifier(corruption) — dampens healing
   * when enemy corruption is already low (near-win suppressor).
   * 1.0 for strike / shield.
   */
  corruptionMod: number;
  /**
   * Strike only: getTreatmentStabilityModifier(stability) — dampens corruption
   * reduction when patient is already highly stable.
   * 1.0 for stabilize / shield, and for cards / temp actions.
   */
  chapterMod: number;
  /**
   * Stabilize only: getStabilityGainModifier(stability) — diminishing returns
   * near 100 stability.
   * 1.0 for strike / shield.
   */
  stabilityGainMod: number;
  /**
   * Stabilize only: stabilityResistanceMultiplier(enemy) — boss / late-game
   * healer-suppression.
   * 1.0 for strike / shield.
   */
  enemyResistanceMod: number;
  /**
   * Affinity multiplier from res.affinityResult.multiplier.
   * 1.0 for shield.
   */
  affinityMod: number;
  /**
   * Element-vs-weakness fraction added to base before multiply.
   * 0.3 when hero.element === enemy.weakElement, else 0.
   * Only used for strike; 0 for stabilize / shield.
   */
  elementBonus: number;
  /**
   * Clinical-cue flat bonus (additive AFTER core multiply, BEFORE
   * stabilityGain × resistance). Equals state.cueBonusStabilize when
   * a cue was answered correctly this turn; 0 otherwise.
   * Only used for stabilize; 0 for strike / shield.
   */
  cueBonusFlat: number;

  // ── Activated in a named push ────────────────────────────────────────────────
  /** Push 4: per-hero stat scale factor (×0.90–×1.35 from HeroCombatStats). */
  heroStatMod: number;
  /**
   * Push 6: affinity-family match multiplier.
   * ×1.15 strong / ×0.90 weak / ×1.00 neutral.
   * See calcAffinityFamilyMod() for the full match logic.
   * Dampened by enemy.affinityResistance (Push 7): strong bonus reduced by that fraction.
   */
  affinityFamilyMod: number;
  /**
   * Push 7: enemy resistance to corruption-lowering effects (strike only).
   * Value = 1 − enemy.corruptionResistance.
   * Tutorial enemies: ~1.00. Bosses: ~0.65–0.72.
   * 1.00 for stabilize / shield (no parallel for those — see enemyResistanceMod / hiddenDefenseMod).
   */
  corruptionResistanceMod: number;
  /**
   * Push 7: hidden-pathology defense — reduces ALL effects proportionally
   * to remaining unrevealed hidden clues.
   * = 1 − (enemy.hiddenDefense × hiddenCluesFraction).
   * Drops to 1.00 when all hidden clues are revealed via Scout or Reassess.
   */
  hiddenDefenseMod: number;

  // ── Future slots (all ×1.00 — not yet activated) ────────────────────────────
  /** hero level scale factor. */
  heroLevelMod: number;
  /** Push 5: equipped item / gear bonus. */
  equipmentMod: number;
  /** Push 4: leader-slot extra multiplier. */
  leaderBonusMod: number;
  /** Push 3: player class per-skill multiplier (beyond init-time bonuses). */
  playerClassMod: number;
  /** Push 3: care-chain completion bonus multiplier. */
  careChainMod: number;
  /**
   * Push 3: multiplicative clinical-cue bonus (beyond the existing flat
   * additive cueBonusFlat).
   */
  clinicalCueMod: number;
}

/**
 * Neutral bag — every slot at ×1.00 (or 0 for additive bonuses).
 * Use as a spread base and override only what differs from neutral.
 */
export function neutralModifiers(): SkillModifiers {
  return {
    // active
    clinicalMod: 1,
    systemMod: 1,
    castMult: 1,
    corruptionMod: 1,
    chapterMod: 1,
    stabilityGainMod: 1,
    enemyResistanceMod: 1,
    affinityMod: 1,
    elementBonus: 0,
    cueBonusFlat: 0,
    // activated
    heroStatMod: 1,
    affinityFamilyMod: 1,
    corruptionResistanceMod: 1,
    hiddenDefenseMod: 1,
    // future
    heroLevelMod: 1,
    equipmentMod: 1,
    leaderBonusMod: 1,
    playerClassMod: 1,
    careChainMod: 1,
    clinicalCueMod: 1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Effect calculators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Corruption reduction (strike).
 *
 * Element bonus is additive pre-multiply so it scales with every subsequent
 * modifier (matches historical Math.floor(base * 0.3) element bonus, now
 * a clean fraction).
 *
 * Floor: 0. A strike never heals the enemy.
 */
export function calcStrikeEffect(base: number, mods: SkillModifiers): number {
  if (base <= 0) return 0;
  const boostedBase = base * (1 + mods.elementBonus);
  const result = boostedBase
    * mods.affinityMod
    * mods.clinicalMod
    * mods.systemMod
    * mods.chapterMod
    * mods.castMult
    * mods.heroStatMod           // Push 4
    * mods.affinityFamilyMod     // Push 6
    * mods.corruptionResistanceMod // Push 7: enemy defense vs strike
    * mods.hiddenDefenseMod      // Push 7: hidden pathology defense
    // future ─────────────────
    * mods.heroLevelMod
    * mods.equipmentMod
    * mods.leaderBonusMod
    * mods.playerClassMod
    * mods.careChainMod
    * mods.clinicalCueMod;
  return Math.max(0, Math.round(result));
}

/**
 * Stability restoration (stabilize).
 *
 * cueBonusFlat is added AFTER the core multiply but BEFORE the "patient-state"
 * modifiers (stabilityGainMod × enemyResistanceMod). This preserves the
 * historical behaviour where the clinical-cue bonus also benefited from
 * diminishing-returns dampening.
 *
 * Floor: 0.
 */
export function calcStabilizeEffect(base: number, mods: SkillModifiers): number {
  if (base < 0) return 0;
  const coreResult = base
    * mods.clinicalMod
    * mods.systemMod
    * mods.corruptionMod
    * mods.castMult
    * mods.heroStatMod           // Push 4
    * mods.affinityFamilyMod     // Push 6
    * mods.hiddenDefenseMod      // Push 7: hidden pathology defense (corruptionResistanceMod = 1.00 for stabilize)
    // future ─────────────────
    * mods.heroLevelMod
    * mods.equipmentMod
    * mods.leaderBonusMod
    * mods.playerClassMod
    * mods.careChainMod
    * mods.clinicalCueMod;
  // Flat cue bonus added here so it also passes through patient-state modifiers
  const withFlat = Math.max(0, coreResult) + mods.cueBonusFlat;
  const result = withFlat * mods.stabilityGainMod * mods.enemyResistanceMod;
  return Math.max(0, Math.round(result));
}

/**
 * Protection (shield %).
 *
 * Shield is a hard percentage stored in shieldNext; no clinical/affinity/cast
 * applies. Future multipliers (hero stat, equipment, etc.) slot in naturally
 * when those pushes land.
 *
 * Floor: 0. Caller enforces the hard 100% ceiling via Math.min.
 */
export function calcShieldEffect(base: number, mods: SkillModifiers): number {
  if (base <= 0) return 0;
  const result = base
    * mods.heroStatMod           // Push 4
    * mods.affinityFamilyMod     // Push 6
    * mods.hiddenDefenseMod      // Push 7: hidden pathology defense
    // future ─────────────────
    * mods.heroLevelMod
    * mods.equipmentMod
    * mods.leaderBonusMod
    * mods.playerClassMod
    * mods.careChainMod;
  return Math.max(0, Math.round(result));
}
