/**
 * Push 9 — Leader Spot system.
 *
 * The hero placed in slot 1 (team index 0) becomes the Leader.  Every battle,
 * the Leader grants a role-based specialty bonus to the whole team.  Bonuses
 * scale modestly with the hero's rarity and star promotion so veteran players
 * see a meaningful (but never overwhelming) return on investing in their leader.
 *
 * Design constraints:
 *  • Only ONE leader bonus is active per battle (the slot-0 hero).
 *  • Bonuses are applied inside the existing SkillModifiers / initBattle opts
 *    pipeline — no new BattleState fields required for the core multipliers.
 *  • Flat bonuses (apBonus, cueCorrectApBonus) are intentionally not scaled so
 *    they remain integer values and are easy for players to understand.
 */

import type { Hero, HeroRole } from './types';

// ── Leader bonus data shape ───────────────────────────────────────────────────

export interface LeaderBonus {
  /** Display name shown on mission-loadout ("Restorative Leadership"). */
  name: string;
  /** One-sentence player-facing description of the active effect. */
  description: string;
  /** Conceptual system ("All Systems" for most roles). */
  system: string;
  // ── SkillModifiers.leaderBonusMod values per bag ──────────────────────────
  /** Multiplier applied to strikeMods in applySkill. */
  strikeMult: number;
  /** Multiplier applied to stabMods in applySkill. */
  stabilizeMult: number;
  /** Multiplier applied to shieldMods in applySkill. */
  shieldMult: number;
  /** Multiplier applied to item strike/stabilize bags in useItem. */
  itemMult: number;
  /** Multiplier applied to card strike/stabilize bags in applyCard. */
  cardMult: number;
  // ── Flat bonuses (not rarity/star scaled) ─────────────────────────────────
  /** Extra AP added to starting AP in initBattle. */
  apBonus: number;
  /**
   * +AP granted on the FIRST correct Clinical Cue this battle.
   * Stacks on top of the standard +1 AP awarded to all correct answers.
   */
  cueCorrectApBonus: number;
}

// ── Role → specialty table ────────────────────────────────────────────────────

const ROLE_SPECIALTY: Record<HeroRole, LeaderBonus> = {

  /**
   * Stabilizer leader (Guardian / Nightingale archetypes).
   * Specialises in team survival — stabilize effects are notably stronger.
   */
  Stabilizer: {
    name:        'Restorative Leadership',
    description: 'Stabilize skills are 15% stronger.',   // Push 13: 10% → 15%
    system:      'All Systems',
    strikeMult:    1,
    stabilizeMult: 1.15,   // Push 13: 1.10 → 1.15
    shieldMult:    1.07,   // Push 13: 1.05 → 1.07
    itemMult:      1,
    cardMult:      1,
    apBonus:             0,
    cueCorrectApBonus:   0,
  },

  /**
   * Assessor leader (Fleming / diagnostic archetypes).
   * Specialises in offensive assessment — treatment and shielding hit harder.
   */
  Assessor: {
    name:        'Diagnostic Leadership',
    description: 'Strike skills are 13% stronger and shield skills are 10% stronger.',  // Push 13
    system:      'All Systems',
    strikeMult:    1.13,   // Push 13: 1.10 → 1.13
    stabilizeMult: 1,
    shieldMult:    1.10,   // unchanged — shields stay secondary
    itemMult:      1,
    cardMult:      1,
    apBonus:             0,
    cueCorrectApBonus:   0,
  },

  /**
   * Analyst leader (Scholar archetypes).
   * Specialises in knowledge application — correct Clinical Cue answers pay extra.
   */
  Analyst: {
    name:        'Analytical Leadership',
    description: 'First correct Clinical Cue grants +1 AP.',
    system:      'All Systems',
    strikeMult:    1,
    stabilizeMult: 1,
    shieldMult:    1,
    itemMult:      1,
    cardMult:      1,
    apBonus:             0,
    cueCorrectApBonus:   1,  // fires once per battle (first correct cue only)
  },

  /**
   * Coordinator leader (Card Specialist / Consultation archetypes).
   * Specialises in team coordination — cards and calls land harder.
   */
  Coordinator: {
    name:        'Strategic Leadership',
    description: 'Clinical cards are 14% stronger.',   // Push 13: 10% → 14%
    system:      'All Systems',
    strikeMult:    1,
    stabilizeMult: 1,
    shieldMult:    1,
    itemMult:      1,
    cardMult:      1.14,   // Push 13: 1.10 → 1.14
    apBonus:             0,
    cueCorrectApBonus:   0,
  },

  /**
   * Educator leader (Alchemist / Medic archetypes).
   * Specialises in resource optimisation — starts with an extra AP and supplies
   * are stronger (covers both "Alchemist" and "Medic" spec examples).
   */
  Educator: {
    name:        "Scholar's Leadership",
    description: 'Start with +1 AP. Supplies are 13% stronger.',  // Push 13: 10% → 13%
    system:      'All Systems',
    strikeMult:    1,
    stabilizeMult: 1,
    shieldMult:    1,
    itemMult:      1.13,   // Push 13: 1.10 → 1.13
    cardMult:      1,
    apBonus:             1,  // added to initBattle opts.apBonus
    cueCorrectApBonus:   0,
  },

  /**
   * Specialist leader (Public Health / broad-spectrum archetypes).
   * Specialises in balanced output — all clinical skill effects are improved.
   */
  Specialist: {
    name:        'Specialist Leadership',
    description: 'Strike and stabilize skills are 12% stronger. Shields 7% stronger.',  // Push 13
    system:      'All Systems',
    strikeMult:    1.12,   // Push 13: 1.08 → 1.12
    stabilizeMult: 1.12,   // Push 13: 1.08 → 1.12
    shieldMult:    1.07,   // Push 13: 1.05 → 1.07
    itemMult:      1,
    cardMult:      1,
    apBonus:             0,
    cueCorrectApBonus:   0,
  },

  /**
   * Scout leader (field-assessment archetypes).
   * Specialises in information advantage — shield and reveal skills are sharper.
   */
  Scout: {
    name:        'Field Leadership',
    description: 'Shield skills are 13% stronger.',   // Push 13: 10% → 13%
    system:      'All Systems',
    strikeMult:    1,
    stabilizeMult: 1,
    shieldMult:    1.13,   // Push 13: 1.10 → 1.13
    itemMult:      1,
    cardMult:      1,
    apBonus:             0,
    cueCorrectApBonus:   0,
  },

  /**
   * Striker leader (offensive treatment archetypes).
   * Specialises in direct corruption reduction — strike skills hit hardest.
   */
  Striker: {
    name:        'Offensive Leadership',
    description: 'Strike skills are 18% stronger.',   // Push 13: 12% → 18%
    system:      'All Systems',
    strikeMult:    1.18,   // Push 13: 1.12 → 1.18
    stabilizeMult: 1,
    shieldMult:    1,
    itemMult:      1,
    cardMult:      1,
    apBonus:             0,
    cueCorrectApBonus:   0,
  },

  /**
   * Restorer leader (recovery-focused archetypes).
   * Specialises in Stability recovery — stabilize and item effects are stronger.
   */
  Restorer: {
    name:        'Recovery Leadership',
    description: 'Stabilize skills are 12% stronger. Supplies are 10% stronger.',  // Push 13
    system:      'All Systems',
    strikeMult:    1,
    stabilizeMult: 1.12,   // Push 13: 1.08 → 1.12
    shieldMult:    1,
    itemMult:      1.10,   // Push 13: 1.08 → 1.10
    cardMult:      1,
    apBonus:             0,
    cueCorrectApBonus:   0,
  },

  /**
   * Preventer leader (defensive/prevention archetypes).
   * Specialises in damage mitigation — shield effects and card plays are amplified.
   */
  Preventer: {
    name:        'Protective Leadership',
    description: 'Shield and card effects are 13% stronger.',  // Push 13: 10% → 13%
    system:      'All Systems',
    strikeMult:    1,
    stabilizeMult: 1,
    shieldMult:    1.13,   // Push 13: 1.10 → 1.13
    itemMult:      1,
    cardMult:      1.13,   // Push 13: 1.10 → 1.13
    apBonus:             0,
    cueCorrectApBonus:   0,
  },

  /**
   * SystemsLeader (holistic / public-health archetypes).
   * Specialises in cross-system breadth — small bonus to all effects plus an
   * extra AP from the first correct Clinical Cue.
   */
  SystemsLeader: {
    name:        'Systems Leadership',
    description: 'All skills 8% stronger. First correct Cue grants +1 AP.',  // Push 13: 5% → 8%
    system:      'All Systems',
    strikeMult:    1.08,   // Push 13: 1.05 → 1.08
    stabilizeMult: 1.08,   // Push 13: 1.05 → 1.08
    shieldMult:    1.08,   // Push 13: 1.05 → 1.08
    itemMult:      1.08,   // Push 13: 1.05 → 1.08
    cardMult:      1.08,   // Push 13: 1.05 → 1.08
    apBonus:             0,
    cueCorrectApBonus:   1,
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return the base (unscaled) LeaderBonus for a hero based on their role.
 * Safe to call with any hero — falls back to Specialist for unknown roles.
 */
export function getLeaderBonus(hero: Hero): LeaderBonus {
  return ROLE_SPECIALTY[hero.role] ?? ROLE_SPECIALTY['Specialist'];
}

/**
 * Scale all MULTIPLIER fields of a LeaderBonus by the hero's rarity and star
 * tier.  Flat bonuses (apBonus, cueCorrectApBonus) are left unchanged so they
 * remain predictable integer values.
 *
 * Scaling range:
 *  • ★3 hero, star=1  → scale = 1.00  (no amplification)
 *  • ★5 hero, star=3  → scale ≈ 1.08  (+8% on excess above 1.0)
 *  • ★7 hero, star=5  → scale ≈ 1.18  (+18% on excess above 1.0)
 *
 * Example: Stabilizer stabilizeMult base=1.10
 *  • ★3 s=1:  1 + 0.10 × 1.00 = 1.100
 *  • ★5 s=3:  1 + 0.10 × 1.08 = 1.108
 *  • ★7 s=5:  1 + 0.10 × 1.18 = 1.118
 */
export function scaleLeaderBonus(base: LeaderBonus, hero: Hero): LeaderBonus {
  const rarityBonus = (hero.rarity - 3) * 0.025;        // +0 to +10%
  const starBonus   = ((hero.star ?? 1) - 1) * 0.016;  // +0 to  +6.4%
  const scale       = 1 + rarityBonus + starBonus;
  // scaleMult: leave 1.0 values at exactly 1.0 to avoid floating-point noise.
  const sm = (m: number) => m === 1 ? 1 : 1 + (m - 1) * scale;
  return {
    ...base,
    strikeMult:    sm(base.strikeMult),
    stabilizeMult: sm(base.stabilizeMult),
    shieldMult:    sm(base.shieldMult),
    itemMult:      sm(base.itemMult),
    cardMult:      sm(base.cardMult),
    // apBonus + cueCorrectApBonus intentionally not scaled.
  };
}
