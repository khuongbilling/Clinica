import { LaunchRarity } from './types';

// ─────────────────────────────────────────────────────────────
// EVOLUTION SYSTEM — Launch Gacha Mechanics
//
// Heroes evolve from Common → Uncommon → Rare → Epic by spending
// earned materials + meeting level / content prerequisites.
// Duplicate pulls convert to Soul Shards + Lotus Dust.
// ─────────────────────────────────────────────────────────────

export interface EvolutionMaterial {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const EVOLUTION_MATERIALS: Record<string, EvolutionMaterial> = {
  soul_shards: {
    id: 'soul_shards',
    name: 'Soul Shards',
    icon: 'sparkles',
    description: 'Crystallized hero essence from duplicate summons. The primary evolution fuel.',
  },
  lotus_dust: {
    id: 'lotus_dust',
    name: 'Lotus Dust',
    icon: 'flower',
    description: 'Fine gold dust shed by summoned heroes. Used in lower-tier evolutions.',
  },
  class_seal: {
    id: 'class_seal',
    name: 'Class Seal',
    icon: 'seal',
    description: 'A class-family seal that marks a hero\'s readiness for advancement.',
  },
  class_seal_fragment: {
    id: 'class_seal_fragment',
    name: 'Class Seal Fragment',
    icon: 'puzzle-piece',
    description: 'Shard of a Class Seal. Three fragments combine into one seal.',
  },
  discipline_scroll: {
    id: 'discipline_scroll',
    name: 'Discipline Scroll',
    icon: 'document-text',
    description: 'A training record. Earned from Ward Shift battles and University lessons.',
  },
  advanced_seal: {
    id: 'advanced_seal',
    name: 'Advanced Seal',
    icon: 'shield-checkmark',
    description: 'An elite advancement seal required for Rare→Epic evolution. Rare drop from boss clears.',
  },
  advanced_seal_fragment: {
    id: 'advanced_seal_fragment',
    name: 'Advanced Seal Fragment',
    icon: 'layers',
    description: 'Shard of an Advanced Seal. Five fragments combine into one seal.',
  },
  memory_thread: {
    id: 'memory_thread',
    name: 'Memory Thread',
    icon: 'infinite',
    description: 'Woven from a hero\'s bond memories. Required for Epic Ascension.',
  },
  university_badge: {
    id: 'university_badge',
    name: 'University Badge',
    icon: 'school',
    description: 'Awarded on completing a relevant University lesson. Proves clinical readiness.',
  },
  ward_medal: {
    id: 'ward_medal',
    name: 'Ward Medal',
    icon: 'medal',
    description: 'Earned from completing Ward Shift challenges. Proves battle readiness.',
  },
};

// ─────────────────────────────────────────────────────────────
// DUPLICATE CONVERSION VALUES
// When you pull a hero you already own fully, the duplicate
// converts to Soul Shards + Lotus Dust (or advanced materials
// at higher rarity).
// ─────────────────────────────────────────────────────────────

export interface DuplicateConversion {
  soulShards: number;
  lotusDust?: number;
  classSealFragments?: number;
  advancedSealFragments?: number;
}

export const DUPLICATE_CONVERSION: Record<LaunchRarity, DuplicateConversion> = {
  common:   { soulShards: 10, lotusDust: 5 },
  uncommon: { soulShards: 25, lotusDust: 15 },
  rare:     { soulShards: 60, classSealFragments: 1 },
  epic:     { soulShards: 120, advancedSealFragments: 1 },
};

// ─────────────────────────────────────────────────────────────
// EVOLUTION COST RULES
// C→U, U→R, R→E each have material costs + a content prerequisite.
// ─────────────────────────────────────────────────────────────

export interface EvolutionCost {
  fromRarity: LaunchRarity;
  toRarity: LaunchRarity;
  levelRequired: number;
  soulShards: number;
  lotusDust?: number;
  classSeals?: number;
  disciplineScrolls?: number;
  advancedSeals?: number;
  memoryThreads?: number;
  prerequisiteLabel: string;
  prerequisiteDetail: string;
}

export const EVOLUTION_COSTS: Record<string, EvolutionCost> = {
  common_to_uncommon: {
    fromRarity: 'common',
    toRarity: 'uncommon',
    levelRequired: 10,
    soulShards: 20,
    classSeals: 1,
    disciplineScrolls: 5,
    prerequisiteLabel: 'University intro lesson',
    prerequisiteDetail: 'Complete an introductory lesson related to this hero\'s family at Clinica University.',
  },
  uncommon_to_rare: {
    fromRarity: 'uncommon',
    toRarity: 'rare',
    levelRequired: 25,
    soulShards: 60,
    classSeals: 2,
    disciplineScrolls: 20,
    prerequisiteLabel: 'Ward Shift challenge',
    prerequisiteDetail: 'Complete a Ward Shift challenge related to this hero\'s specialty.',
  },
  rare_to_epic: {
    fromRarity: 'rare',
    toRarity: 'epic',
    levelRequired: 45,
    soulShards: 120,
    advancedSeals: 1,
    disciplineScrolls: 50,
    prerequisiteLabel: 'Journey boss or advanced simulation',
    prerequisiteDetail: 'Defeat a Journey Map boss or complete an advanced simulation related to this hero\'s discipline.',
  },
  epic_to_epic_ascended: {
    fromRarity: 'epic',
    toRarity: 'epic',
    levelRequired: 60,
    soulShards: 200,
    advancedSeals: 2,
    memoryThreads: 1,
    prerequisiteLabel: 'Character memory quest',
    prerequisiteDetail: 'Discover and complete this hero\'s character memory quest — unlocked at deep bond level.',
  },
};

// ─────────────────────────────────────────────────────────────
// PULL RATES — Launch Normal Banner
// No Legendary or Mythic in the normal gacha economy.
// ─────────────────────────────────────────────────────────────

export const LAUNCH_PULL_RATES: Record<LaunchRarity, number> = {
  common:   65,
  uncommon: 25,
  rare:     8,
  epic:     2,
};

export function formatEvolutionCost(cost: EvolutionCost): string {
  const parts: string[] = [];
  parts.push(`Lv.${cost.levelRequired}`);
  parts.push(`${cost.soulShards} Soul Shards`);
  if (cost.lotusDust)        parts.push(`${cost.lotusDust} Lotus Dust`);
  if (cost.classSeals)       parts.push(`${cost.classSeals} Class Seal${cost.classSeals > 1 ? 's' : ''}`);
  if (cost.disciplineScrolls) parts.push(`${cost.disciplineScrolls} Discipline Scroll${cost.disciplineScrolls > 1 ? 's' : ''}`);
  if (cost.advancedSeals)    parts.push(`${cost.advancedSeals} Advanced Seal${cost.advancedSeals > 1 ? 's' : ''}`);
  if (cost.memoryThreads)    parts.push(`${cost.memoryThreads} Memory Thread`);
  return parts.join(' · ');
}

export function getEvolutionCost(fromRarity: LaunchRarity, toRarity: LaunchRarity): EvolutionCost | null {
  if (fromRarity === 'common'   && toRarity === 'uncommon') return EVOLUTION_COSTS.common_to_uncommon;
  if (fromRarity === 'uncommon' && toRarity === 'rare')     return EVOLUTION_COSTS.uncommon_to_rare;
  if (fromRarity === 'rare'     && toRarity === 'epic')     return EVOLUTION_COSTS.rare_to_epic;
  if (fromRarity === 'epic'     && toRarity === 'epic')     return EVOLUTION_COSTS.epic_to_epic_ascended;
  return null;
}

export function nextRarity(r: LaunchRarity): LaunchRarity | null {
  if (r === 'common')   return 'uncommon';
  if (r === 'uncommon') return 'rare';
  if (r === 'rare')     return 'epic';
  return null;
}
