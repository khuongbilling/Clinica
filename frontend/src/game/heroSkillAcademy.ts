import type { Hero } from './types';

export type UpgradeCategory = 'scout' | 'triage' | 'stabilize' | 'knowledge' | 'general';

export interface SkillUpgradeRequirements {
  cue_scroll?: number;
  triage_scroll?: number;
  stab_scroll?: number;
  lesson_note?: number;
  care_chain_manual?: number;
  hero_training_page?: number;
  university_credits: number;
  hero_level: number;
}

export interface SkillUpgradeEffect {
  reveal?: number;
  stabilize?: number;
  strike?: number;
  shield?: number;
  heroXp?: number;
}

export interface SkillUpgradeRankDef {
  rank: number;
  label: string;
  description: string;
  battleEffect: string;
  effect: SkillUpgradeEffect;
  requirements: SkillUpgradeRequirements;
}

export interface SkillUpgradeDef {
  id: string;
  name: string;
  category: UpgradeCategory;
  categoryLabel: string;
  description: string;
  icon: string;
  accentColor: string;
  targetActionTypes: string[];
  maxRank: number;
  ranks: SkillUpgradeRankDef[];
}

// Where to earn each material — shown in missing-materials hints.
export const MATERIAL_SOURCE_HINTS: Record<string, string> = {
  cue_scroll:        'Practice Clinical Cue Lab',
  triage_scroll:     'Practice Rapid Triage Hall',
  stab_scroll:       'Practice Stabilize Stack Lab',
  lesson_note:       'Complete Lotus Lessons',
  care_chain_manual: 'Complete University Milestones',
  hero_training_page:'Complete University practice (any lab)',
  university_credits:'Complete University practice',
};

export const MATERIAL_LABELS: Record<string, string> = {
  cue_scroll:        'Cue Scroll',
  triage_scroll:     'Triage Scroll',
  stab_scroll:       'Stabilization Scroll',
  lesson_note:       'Lesson Note',
  care_chain_manual: 'Care Chain Manual',
  hero_training_page:'Hero Training Page',
};

export const SKILL_UPGRADES: SkillUpgradeDef[] = [
  // ── 1. Scout / Cue Recognition ──────────────────────────────────────────
  {
    id: 'lantern_of_clues',
    name: 'Lantern of Clues',
    category: 'scout',
    categoryLabel: 'Scout · Cue Recognition',
    description:
      'Scout and assess skills reveal hidden clinical cues more effectively, helping identify enemy weaknesses earlier.',
    icon: 'eye-outline',
    accentColor: '#2DD4BF',
    targetActionTypes: ['scout', 'analyze'],
    maxRank: 2,
    ranks: [
      {
        rank: 1,
        label: 'Lantern of Clues I',
        description: 'Scout and analyze skills reveal one additional hidden clue.',
        battleEffect: '+1 clue reveal per scout/analyze skill used.',
        effect: { reveal: 1 },
        requirements: {
          cue_scroll: 3,
          hero_training_page: 1,
          university_credits: 50,
          hero_level: 2,
        },
      },
      {
        rank: 2,
        label: 'Lantern of Clues II',
        description: 'Scout and analyze skills now reveal two additional clues (cumulative with Rank I).',
        battleEffect: '+2 clue reveals per scout/analyze skill used.',
        effect: { reveal: 1 },
        requirements: {
          cue_scroll: 5,
          hero_training_page: 1,
          care_chain_manual: 1,
          university_credits: 75,
          hero_level: 3,
        },
      },
    ],
  },

  // ── 2. Stabilize / Recovery ──────────────────────────────────────────────
  {
    id: 'guardian_touch',
    name: "Guardian's Touch",
    category: 'stabilize',
    categoryLabel: 'Stabilize · Recovery',
    description:
      'Stabilization skills restore more Vital Stability, improving sustain and patient recovery throughout longer encounters.',
    icon: 'heart-outline',
    accentColor: '#22C55E',
    targetActionTypes: ['stabilize'],
    maxRank: 2,
    ranks: [
      {
        rank: 1,
        label: "Guardian's Touch I",
        description: 'Stabilization skills restore +4 Vital Stability.',
        battleEffect: '+4 Stability on every stabilize skill.',
        effect: { stabilize: 4 },
        requirements: {
          stab_scroll: 3,
          hero_training_page: 1,
          university_credits: 50,
          hero_level: 2,
        },
      },
      {
        rank: 2,
        label: "Guardian's Touch II",
        description: 'Stabilization skills restore +8 Vital Stability total (cumulative with Rank I).',
        battleEffect: '+8 Stability on every stabilize skill.',
        effect: { stabilize: 4 },
        requirements: {
          stab_scroll: 5,
          hero_training_page: 1,
          care_chain_manual: 1,
          university_credits: 75,
          hero_level: 3,
        },
      },
    ],
  },

  // ── 3. Triage / Readiness ────────────────────────────────────────────────
  {
    id: 'field_readiness',
    name: 'Field Readiness',
    category: 'triage',
    categoryLabel: 'Triage · Readiness',
    description:
      'Shield and support skills provide stronger protective cover, rewarding triage preparation before a battle starts.',
    icon: 'shield-outline',
    accentColor: '#F59E0B',
    targetActionTypes: ['shield', 'support'],
    maxRank: 2,
    ranks: [
      {
        rank: 1,
        label: 'Field Readiness I',
        description: 'Shield and support skills grant +4 Shield to the patient.',
        battleEffect: '+4 Shield per shield/support skill used.',
        effect: { shield: 4 },
        requirements: {
          triage_scroll: 3,
          hero_training_page: 1,
          university_credits: 75,
          hero_level: 2,
        },
      },
      {
        rank: 2,
        label: 'Field Readiness II',
        description: 'Shield and support skills grant +8 Shield total (cumulative with Rank I).',
        battleEffect: '+8 Shield per shield/support skill used.',
        effect: { shield: 4 },
        requirements: {
          triage_scroll: 5,
          care_chain_manual: 1,
          university_credits: 100,
          hero_level: 3,
        },
      },
    ],
  },

  // ── 4. Knowledge Passive ─────────────────────────────────────────────────
  {
    id: 'hydration_knowledge',
    name: 'Hydration Knowledge',
    category: 'knowledge',
    categoryLabel: 'Knowledge Passive',
    description:
      'Lesson-based understanding of fluid balance and patient physiology provides a small passive bonus to clinical care skills.',
    icon: 'water-outline',
    accentColor: '#A855F7',
    targetActionTypes: ['stabilize', 'scout'],
    maxRank: 2,
    ranks: [
      {
        rank: 1,
        label: 'Hydration Knowledge I',
        description: 'Clinical knowledge adds a passive +2 Stability boost to all stabilize skills.',
        battleEffect: '+2 Stability on every stabilize skill.',
        effect: { stabilize: 2 },
        requirements: {
          lesson_note: 2,
          university_credits: 40,
          hero_level: 2,
        },
      },
      {
        rank: 2,
        label: 'Hydration Knowledge II',
        description: 'Deeper knowledge adds +2 more Stability to stabilize skills and +1 reveal to scout skills.',
        battleEffect: '+2 Stability on stabilize · +1 reveal on scout skills.',
        effect: { stabilize: 2, reveal: 1 },
        requirements: {
          lesson_note: 4,
          university_credits: 60,
          hero_level: 3,
        },
      },
    ],
  },

  // ── 5. General Training ──────────────────────────────────────────────────
  {
    id: 'care_chain_training',
    name: 'Care Chain Training',
    category: 'general',
    categoryLabel: 'General Training',
    description:
      'Intensive care chain sessions accelerate hero development, granting bonus Hero EXP to all owned healers.',
    icon: 'school-outline',
    accentColor: '#F43F5E',
    targetActionTypes: [],
    maxRank: 2,
    ranks: [
      {
        rank: 1,
        label: 'Care Chain Training I',
        description: 'All owned heroes gain 50 Hero EXP from this focused training session.',
        battleEffect: 'Grants 50 Hero EXP to all owned heroes on purchase.',
        effect: { heroXp: 50 },
        requirements: {
          care_chain_manual: 1,
          hero_training_page: 2,
          university_credits: 100,
          hero_level: 3,
        },
      },
      {
        rank: 2,
        label: 'Care Chain Training II',
        description: 'Advanced training sessions grant 100 Hero EXP to all owned heroes.',
        battleEffect: 'Grants 100 Hero EXP to all owned heroes on purchase.',
        effect: { heroXp: 100 },
        requirements: {
          care_chain_manual: 2,
          hero_training_page: 4,
          university_credits: 150,
          hero_level: 4,
        },
      },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

// Returns the current rank for an upgrade (0 = not purchased).
export function getUpgradeRank(upgrades: Record<string, number>, upgradeId: string): number {
  return upgrades[upgradeId] ?? 0;
}

// Returns the highest hero level across all owned heroes (minimum 1).
export function maxHeroLevel(
  player: { hero_progression?: Record<string, { level?: number }> },
): number {
  const prog = player.hero_progression ?? {};
  const levels = Object.values(prog).map(p => p.level ?? 1);
  return levels.length === 0 ? 1 : Math.max(...levels);
}

// Returns whether the player can purchase the next rank of an upgrade.
export function canUpgrade(
  player: {
    inventory?: Record<string, number>;
    university_credits?: number;
    hero_skill_upgrades?: Record<string, number>;
    hero_progression?: Record<string, { level?: number }>;
  },
  upgradeId: string,
): { can: boolean; reason?: string } {
  const upg = SKILL_UPGRADES.find(u => u.id === upgradeId);
  if (!upg) return { can: false, reason: 'Unknown upgrade.' };

  const currentRank = (player.hero_skill_upgrades ?? {})[upgradeId] ?? 0;
  if (currentRank >= upg.maxRank) return { can: false, reason: 'Already at max rank.' };

  const rankDef = upg.ranks[currentRank];
  if (!rankDef) return { can: false, reason: 'No rank definition.' };

  const inv = player.inventory ?? {};
  const uc  = player.university_credits ?? 0;
  const req = rankDef.requirements;
  const heroLevel = maxHeroLevel(player);

  if (heroLevel < req.hero_level)                                 return { can: false, reason: `Requires a hero at level ${req.hero_level}.` };
  if ((inv.cue_scroll         ?? 0) < (req.cue_scroll         ?? 0)) return { can: false, reason: `Need ${req.cue_scroll} Cue Scroll(s).` };
  if ((inv.triage_scroll      ?? 0) < (req.triage_scroll      ?? 0)) return { can: false, reason: `Need ${req.triage_scroll} Triage Scroll(s).` };
  if ((inv.stab_scroll        ?? 0) < (req.stab_scroll        ?? 0)) return { can: false, reason: `Need ${req.stab_scroll} Stabilization Scroll(s).` };
  if ((inv.lesson_note        ?? 0) < (req.lesson_note        ?? 0)) return { can: false, reason: `Need ${req.lesson_note} Lesson Note(s).` };
  if ((inv.care_chain_manual  ?? 0) < (req.care_chain_manual  ?? 0)) return { can: false, reason: `Need ${req.care_chain_manual} Care Chain Manual(s).` };
  if ((inv.hero_training_page ?? 0) < (req.hero_training_page ?? 0)) return { can: false, reason: `Need ${req.hero_training_page} Training Page(s).` };
  if (uc < req.university_credits)                                    return { can: false, reason: `Need ${req.university_credits} University Credits.` };

  return { can: true };
}

// Returns a list of unmet requirements with human-readable labels and source hints.
export function getMissingMaterials(
  player: {
    inventory?: Record<string, number>;
    university_credits?: number;
    hero_skill_upgrades?: Record<string, number>;
    hero_progression?: Record<string, { level?: number }>;
  },
  upgradeId: string,
): { key: string; label: string; have: number; need: number; source: string }[] {
  const upg = SKILL_UPGRADES.find(u => u.id === upgradeId);
  if (!upg) return [];
  const currentRank = (player.hero_skill_upgrades ?? {})[upgradeId] ?? 0;
  if (currentRank >= upg.maxRank) return [];
  const rankDef = upg.ranks[currentRank];
  if (!rankDef) return [];

  const inv = player.inventory ?? {};
  const uc  = player.university_credits ?? 0;
  const req = rankDef.requirements;
  const missing: { key: string; label: string; have: number; need: number; source: string }[] = [];

  function check(key: string, need?: number) {
    if (!need) return;
    const have = key === 'university_credits' ? uc : (inv[key] ?? 0);
    if (have < need) {
      missing.push({
        key,
        label: key === 'university_credits' ? 'University Credits' : (MATERIAL_LABELS[key] ?? key),
        have,
        need,
        source: MATERIAL_SOURCE_HINTS[key] ?? 'Complete University activities',
      });
    }
  }

  check('cue_scroll',        req.cue_scroll);
  check('triage_scroll',     req.triage_scroll);
  check('stab_scroll',       req.stab_scroll);
  check('lesson_note',       req.lesson_note);
  check('care_chain_manual', req.care_chain_manual);
  check('hero_training_page',req.hero_training_page);
  check('university_credits',req.university_credits);

  const heroLevel = maxHeroLevel(player);
  if (heroLevel < req.hero_level) {
    missing.push({
      key: 'hero_level',
      label: `Hero Level ${req.hero_level}`,
      have: heroLevel,
      need: req.hero_level,
      source: 'Train heroes in Training Hall or earn Hero EXP from battles',
    });
  }

  return missing;
}

// ── Battle integration ─────────────────────────────────────────────────────
// Applies active upgrade bonuses to a hero team BEFORE initBattle.
// Returns a new Hero[] with modified skill copies — originals are unchanged.
//
// SAFE design: only adds a delta to a skill field that already exists on the
// skill (scout skills get +reveal but never +stabilize, etc.).  battle.ts and
// BattleState are NOT touched.
export function applySkillUpgradesToTeam(
  team: Hero[],
  upgrades: Record<string, number>,
): Hero[] {
  if (!upgrades || Object.keys(upgrades).length === 0) return team;

  // Accumulate cumulative deltas per ActionType
  const byType: Record<string, { reveal: number; stabilize: number; strike: number; shield: number }> = {};

  for (const upg of SKILL_UPGRADES) {
    if (upg.targetActionTypes.length === 0) continue;
    const currentRank = upgrades[upg.id] ?? 0;
    if (currentRank === 0) continue;

    for (let r = 0; r < currentRank && r < upg.ranks.length; r++) {
      const eff = upg.ranks[r].effect;
      for (const actionType of upg.targetActionTypes) {
        if (!byType[actionType]) byType[actionType] = { reveal: 0, stabilize: 0, strike: 0, shield: 0 };
        const d = byType[actionType];
        d.reveal    += eff.reveal    ?? 0;
        d.stabilize += eff.stabilize ?? 0;
        d.strike    += eff.strike    ?? 0;
        d.shield    += eff.shield    ?? 0;
      }
    }
  }

  if (Object.keys(byType).length === 0) return team;

  return team.map(hero => ({
    ...hero,
    skills: hero.skills.map(skill => {
      const d = byType[skill.type];
      if (!d) return skill;
      // Only add delta to fields already present on the skill
      return {
        ...skill,
        reveal:    skill.reveal    !== undefined && d.reveal    > 0 ? skill.reveal    + d.reveal    : skill.reveal,
        stabilize: skill.stabilize !== undefined && d.stabilize > 0 ? skill.stabilize + d.stabilize : skill.stabilize,
        strike:    skill.strike    !== undefined && d.strike    > 0 ? skill.strike    + d.strike    : skill.strike,
        shield:    skill.shield    !== undefined && d.shield    > 0 ? skill.shield    + d.shield    : skill.shield,
      };
    }),
  }));
}
