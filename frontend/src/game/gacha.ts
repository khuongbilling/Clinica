import { Hero } from './types';

// ---------- Gacha Pool ----------
export interface GachaEntry {
  id: string;
  heroId: string; // ID matching HEROES in content.ts
  name: string;
  rarity: 3 | 4 | 5;
  role: string;
  aptitude: string;
  weight: number;
}

export const FOUNDATION_BANNER: GachaEntry[] = [
  { id: 'H001', heroId: 'novice_guardian',  name: 'Novice Guardian',   rarity: 3, role: 'Stabilizer',  aptitude: 'Guardian', weight: 30 },
  { id: 'H002', heroId: 'apprentice_seer',  name: 'Apprentice Seer',   rarity: 3, role: 'Assessor',    aptitude: 'Sage',     weight: 30 },
  { id: 'H003', heroId: 'junior_warden',    name: 'Junior Warden',     rarity: 3, role: 'Coordinator', aptitude: 'Warden',   weight: 30 },
  { id: 'H004', heroId: 'data_acolyte',     name: 'Data Acolyte',      rarity: 3, role: 'Analyst',     aptitude: 'Weaver',   weight: 30 },
  { id: 'H005', heroId: 'village_caretaker',name: 'Village Caretaker', rarity: 3, role: 'Educator',    aptitude: 'Warden',   weight: 25 },
  { id: 'H006', heroId: 'night_watcher',    name: 'Night Watcher',     rarity: 3, role: 'Stabilizer',  aptitude: 'Guardian', weight: 25 },
  { id: 'H007', heroId: 'storm_runner',     name: 'Storm Runner',      rarity: 4, role: 'Stabilizer',  aptitude: 'Guardian', weight: 10 },
  { id: 'H008', heroId: 'infection_warden', name: 'Infection Warden',  rarity: 4, role: 'Specialist',  aptitude: 'Warden',   weight: 10 },
  { id: 'H009', heroId: 'wound_sage',       name: 'Wound Sage',        rarity: 4, role: 'Specialist',  aptitude: 'Sage',     weight: 10 },
  { id: 'H010', heroId: 'mindkeeper',       name: 'Mindkeeper',        rarity: 4, role: 'Specialist',  aptitude: 'Sage',     weight: 10 },
  // Rarity 5 ghost slots — heroes don't yet exist in content.ts but are reserved for future expansion.
  // Pulling these grants a temporary placeholder + bonus shards.
  { id: 'H011', heroId: 'clinical_sage',    name: 'Clinical Sage',     rarity: 5, role: 'Assessor',    aptitude: 'Sage',     weight: 2 },
  { id: 'H012', heroId: 'critical_guardian',name: 'Critical Guardian', rarity: 5, role: 'Stabilizer',  aptitude: 'Guardian', weight: 2 },
];

export const SUMMON_COST = 100;
export const DUPLICATE_REFUND = 25;

export interface SummonResult {
  entry: GachaEntry;
  duplicate: boolean;
  message: string;
}

export function summonOnce(ownedHeroIds: string[]): SummonResult {
  const totalWeight = FOUNDATION_BANNER.reduce((sum, h) => sum + h.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of FOUNDATION_BANNER) {
    roll -= entry.weight;
    if (roll <= 0) {
      const duplicate = ownedHeroIds.includes(entry.heroId);
      return {
        entry,
        duplicate,
        message: duplicate
          ? `Duplicate ${entry.name}! Converted to ${DUPLICATE_REFUND} Codex Shards.`
          : `You summoned ${entry.name}!`,
      };
    }
  }
  // Fallback (shouldn't hit)
  const entry = FOUNDATION_BANNER[0];
  return { entry, duplicate: ownedHeroIds.includes(entry.heroId), message: `You summoned ${entry.name}.` };
}

export function rarityColor(r: number): string {
  if (r >= 6) return '#FF6B9D';
  if (r === 5) return '#D4AF37';
  if (r === 4) return '#A78BFA';
  return '#9CA3AF';
}
