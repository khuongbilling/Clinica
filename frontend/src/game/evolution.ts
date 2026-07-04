import { Hero, HeroRole, HeroSkill } from './types';

// ────────────────────────────────────────────────────────────
// HERO EVOLUTION / STAR SYSTEM
// Every owned hero starts at ★1. Duplicate pulls grant "copies"
// (evolution fuel). Spending copies raises the hero's star, which
// scales its skill power and unlocks unique class-based abilities.
// The copy cost doubles each tier so a higher star literally
// requires a higher-star's worth of duplicates.
// ────────────────────────────────────────────────────────────

export const MAX_STAR = 6;
export const DUP_SHARD_BONUS = 10; // small consolation shards on a duplicate pull

export interface HeroProgress {
  star: number;
  // Hero Shards for this specific hero — fed by duplicate pulls (University
  // Recruitment) and spent on Certification Star promotion. Field kept as
  // `copies` for backend/save compatibility; use getHeroShards() to read it.
  copies: number;
  // Hero Level — separate EXP-based growth track, capped per Certification
  // Star (see university.ts levelCapForStar). Independent of `star`.
  level?: number;
  // Safe hero locking/favorite (Step 10) — protects a hero from being used
  // as promotion material for other heroes.
  locked?: boolean;
  favorite?: boolean;
}

export function defaultProgress(): HeroProgress {
  return { star: 1, copies: 0, level: 1, locked: false, favorite: false };
}

export function getProgress(
  progression: Record<string, HeroProgress> | undefined,
  heroId: string,
): HeroProgress {
  const p = progression?.[heroId];
  if (!p) return defaultProgress();
  return { star: p.star, copies: p.copies, level: p.level ?? 1, locked: !!p.locked, favorite: !!p.favorite };
}

// Hero Shards — clearer accessor name for the reused `copies` field.
export function getHeroShards(p: HeroProgress): number {
  return p.copies ?? 0;
}

// Copies required to go from `star` → star + 1 : 2^(star-1)
// ★1→2 = 1, ★2→3 = 2, ★3→4 = 4, ★4→5 = 8, ★5→6 = 16
export function copiesForNextStar(star: number): number {
  if (star >= MAX_STAR) return Infinity;
  return Math.pow(2, star - 1);
}

export function canEvolve(p: HeroProgress): boolean {
  return p.star < MAX_STAR && p.copies >= copiesForNextStar(p.star);
}

export function evolveProgress(p: HeroProgress): HeroProgress {
  if (!canEvolve(p)) return p;
  return { star: p.star + 1, copies: p.copies - copiesForNextStar(p.star) };
}

// Skill power grows +12% per star above ★1.
export function starEffectMultiplier(star: number): number {
  return 1 + 0.12 * (star - 1);
}

export function starPowerBonusPct(star: number): number {
  return Math.round((starEffectMultiplier(star) - 1) * 100);
}

// ────────────────────────────────────────────────────────────
// CLASS × STAR UNIQUE ABILITIES
// Each role unlocks thematically appropriate signature skills at
// star milestones. The table is intentionally simple to extend.
// ────────────────────────────────────────────────────────────

interface AbilityTemplate {
  minStar: number;
  key: string;
  name: string;
  type: HeroSkill['type'];
  cost: number;
  base: { stabilize?: number; strike?: number; shield?: number; reveal?: number };
  description: string;
  shortEffect: string;
  beginnerExplanation?: string;
  nclexExplanation?: string;
}

const ABILITY_TABLE: Record<HeroRole, AbilityTemplate[]> = {
  Stabilizer: [
    {
      minStar: 3, key: 'sustained_care', name: 'Sustained Care', type: 'stabilize', cost: 1,
      base: { stabilize: 12 },
      description: 'A steady restorative rhythm that keeps the patient stable turn after turn.',
      shortEffect: 'Stabilize +12',
      beginnerExplanation: 'Keeps the patient calm and steady with ongoing care.',
      nclexExplanation: 'Continuous monitoring and supportive care maintain hemodynamic stability.',
    },
    {
      minStar: 5, key: 'guardians_resolve', name: "Guardian's Resolve", type: 'stabilize', cost: 2,
      base: { stabilize: 16, shield: 15 },
      description: 'An unbreakable vigil — restores stability and shields the patient from the next threat.',
      shortEffect: 'Stabilize +16 · Shield 15',
      beginnerExplanation: 'Heals and protects the patient at the same time.',
      nclexExplanation: 'Proactive stabilization plus protective measures reduce risk of decompensation.',
    },
  ],
  Assessor: [
    {
      minStar: 3, key: 'keen_insight', name: 'Keen Insight', type: 'scout', cost: 1,
      base: { reveal: 2 },
      description: 'A trained eye uncovers hidden clues others miss.',
      shortEffect: 'Reveal 2 clues',
      beginnerExplanation: 'Spots hidden signs and symptoms in the patient.',
      nclexExplanation: 'Focused assessment surfaces subtle findings that guide the plan of care.',
    },
    {
      minStar: 5, key: 'full_workup', name: 'Full Workup', type: 'analyze', cost: 2,
      base: { reveal: 3, stabilize: 8 },
      description: 'A comprehensive assessment reveals the full picture and steadies the patient.',
      shortEffect: 'Reveal 3 · Stabilize +8',
      beginnerExplanation: 'A thorough check-up that also settles the patient.',
      nclexExplanation: 'Systematic head-to-toe assessment informs prioritization and early intervention.',
    },
  ],
  Analyst: [
    {
      minStar: 3, key: 'targeted_strike', name: 'Targeted Strike', type: 'strike', cost: 1,
      base: { strike: 18 },
      description: 'Data-driven precision that cuts straight at the corruption.',
      shortEffect: 'Strike 18',
      beginnerExplanation: 'A precise treatment aimed right at the problem.',
      nclexExplanation: 'Evidence-based targeted therapy addresses the underlying pathology directly.',
    },
    {
      minStar: 5, key: 'critical_analysis', name: 'Critical Analysis', type: 'strike', cost: 2,
      base: { strike: 30 },
      description: 'A decisive, calculated intervention that overwhelms the affliction.',
      shortEffect: 'Strike 30',
      beginnerExplanation: 'A powerful, well-planned treatment that hits hard.',
      nclexExplanation: 'Rapid analysis and decisive intervention control an escalating problem.',
    },
  ],
  Coordinator: [
    {
      minStar: 3, key: 'rally_shield', name: 'Rally Shield', type: 'shield', cost: 1,
      base: { shield: 16 },
      description: 'Marshals the team to brace the patient against incoming harm.',
      shortEffect: 'Shield 16',
      beginnerExplanation: 'Sets up protection before the next danger hits.',
      nclexExplanation: 'Coordinated care and anticipatory guidance reduce harm from the next stressor.',
    },
    {
      minStar: 5, key: 'command_ward', name: 'Command Ward', type: 'command', cost: 2,
      base: { shield: 18, stabilize: 10 },
      description: 'Directs the whole ward — shields the patient and restores stability.',
      shortEffect: 'Shield 18 · Stabilize +10',
      beginnerExplanation: 'Protects and heals the patient with a coordinated effort.',
      nclexExplanation: 'Effective delegation and prioritization protect and stabilize the patient.',
    },
  ],
  Educator: [
    {
      minStar: 3, key: 'teaching_moment', name: 'Teaching Moment', type: 'support', cost: 1,
      base: { stabilize: 8, reveal: 1 },
      description: 'Explains the plan clearly — calming the patient and revealing what matters.',
      shortEffect: 'Stabilize +8 · Reveal 1',
      beginnerExplanation: 'Teaching the patient reduces fear and clarifies the situation.',
      nclexExplanation: 'Patient education improves adherence and surfaces relevant history.',
    },
    {
      minStar: 5, key: 'inspire', name: 'Inspire', type: 'support', cost: 2,
      base: { stabilize: 14, shield: 12 },
      description: "Rallies the patient's own resilience — restoring stability and lasting protection.",
      shortEffect: 'Stabilize +14 · Shield 12',
      beginnerExplanation: 'Motivates the patient, helping them heal and stay protected.',
      nclexExplanation: 'Empowering the patient promotes recovery and self-protective behavior.',
    },
  ],
  Specialist: [
    {
      minStar: 3, key: 'focused_remedy', name: 'Focused Remedy', type: 'strike', cost: 1,
      base: { strike: 14, stabilize: 8 },
      description: "A specialist's tailored remedy that treats the cause and soothes the patient.",
      shortEffect: 'Strike 14 · Stabilize +8',
      beginnerExplanation: 'A specialized treatment that fights the problem and helps the patient.',
      nclexExplanation: 'Specialty-specific intervention addresses etiology while supporting the patient.',
    },
    {
      minStar: 5, key: 'mastery', name: 'Mastery', type: 'strike', cost: 2,
      base: { strike: 22, stabilize: 12 },
      description: 'Mastered technique — a powerful strike paired with strong restoration.',
      shortEffect: 'Strike 22 · Stabilize +12',
      beginnerExplanation: 'An expert treatment that hits hard and heals well.',
      nclexExplanation: 'Expert-level management combines definitive treatment with supportive care.',
    },
  ],
};

function scaleNum(n: number | undefined, mult: number): number | undefined {
  return n === undefined ? undefined : Math.round(n * mult);
}

// Scale a base skill's numeric effects by the star multiplier.
// Reveal is a clue COUNT, so it is never scaled.
function scaleSkill(s: HeroSkill, mult: number): HeroSkill {
  return {
    ...s,
    stabilize: scaleNum(s.stabilize, mult),
    strike: scaleNum(s.strike, mult),
    shield: scaleNum(s.shield, mult),
  };
}

// Ability templates a hero of this role has unlocked at the given star.
export function unlockedAbilityTemplates(role: HeroRole, star: number): AbilityTemplate[] {
  return (ABILITY_TABLE[role] || []).filter(t => t.minStar <= star);
}

// The next locked ability (for "next unlock" previews), if any.
export function nextAbilityTemplate(role: HeroRole, star: number): AbilityTemplate | null {
  return (ABILITY_TABLE[role] || []).find(t => t.minStar > star) || null;
}

export interface AbilityPreview {
  name: string;
  shortEffect: string;
  minStar: number;
}

export function abilityPreview(t: AbilityTemplate): AbilityPreview {
  return { name: t.name, shortEffect: t.shortEffect, minStar: t.minStar };
}

export function unlockedAbilityPreviews(role: HeroRole, star: number): AbilityPreview[] {
  return unlockedAbilityTemplates(role, star).map(abilityPreview);
}

export function nextAbilityPreview(role: HeroRole, star: number): AbilityPreview | null {
  const t = nextAbilityTemplate(role, star);
  return t ? abilityPreview(t) : null;
}

// Build the concrete star-unlocked HeroSkills for a hero (scaled by star).
export function starUnlockSkills(hero: Hero, star: number): HeroSkill[] {
  const mult = starEffectMultiplier(star);
  return unlockedAbilityTemplates(hero.role, star).map(t => ({
    id: `${hero.id}_${t.key}`,
    name: t.name,
    type: t.type,
    systemType: hero.element,
    cost: t.cost,
    description: t.description,
    shortEffect: t.shortEffect,
    beginnerExplanation: t.beginnerExplanation,
    nclexExplanation: t.nclexExplanation,
    stabilize: scaleNum(t.base.stabilize, mult),
    strike: scaleNum(t.base.strike, mult),
    shield: scaleNum(t.base.shield, mult),
    reveal: t.base.reveal,
  }));
}

// Produce a battle-ready hero: base skills scaled by star + unlocked star abilities.
export function applyStarToHero(hero: Hero, prog: HeroProgress): Hero {
  const mult = starEffectMultiplier(prog.star);
  const scaledBase = hero.skills.map(s => scaleSkill(s, mult));
  const starSkills = starUnlockSkills(hero, prog.star);
  return { ...hero, star: prog.star, skills: [...scaledBase, ...starSkills] };
}
