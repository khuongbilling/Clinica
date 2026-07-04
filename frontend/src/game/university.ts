import { HeroRole, PlayerState } from './types';
import { HeroProgress, defaultProgress, getHeroShards } from './evolution';
import { FOUNDATION_BANNER, GachaEntry } from './gacha';

// ────────────────────────────────────────────────────────────
// CLINICA UNIVERSITY — hybrid hero progression foundation
//
// Five independent-but-connected tracks:
//   Hero Level        — EXP-based growth, capped per Certification Star.
//   Certification Star — evolution/rarity grade (1★–5★), raised via
//                        promotion at Hero Certification.
//   Hero Shards       — duplicate-hero conversion material (per hero;
//                        stored in hero_progression[id].copies).
//   Class Trainees    — same-class/school training material (shared
//                        across every hero of that role).
//   University Credits — global progression currency.
// ────────────────────────────────────────────────────────────

export const MAX_CERTIFICATION_STAR = 5;

export const LEVEL_CAP_BY_STAR: Record<number, number> = {
  1: 10, 2: 20, 3: 30, 4: 40, 5: 50,
};

export function levelCapForStar(star: number): number {
  const s = Math.min(MAX_CERTIFICATION_STAR, Math.max(1, Math.round(star)));
  return LEVEL_CAP_BY_STAR[s] ?? 50;
}

// ---------- Class Trainees ----------
export interface TraineeDef {
  id: string;
  label: string;
  role: HeroRole;
}

export const CLASS_TRAINEE_BY_ROLE: Record<HeroRole, TraineeDef> = {
  Assessor:    { id: 'assess_trainee',    label: 'Assess Trainee',    role: 'Assessor' },
  Stabilizer:  { id: 'stabilize_trainee', label: 'Stabilize Trainee', role: 'Stabilizer' },
  Analyst:     { id: 'treat_trainee',     label: 'Treat Trainee',     role: 'Analyst' },
  Coordinator: { id: 'protect_trainee',   label: 'Protect Trainee',   role: 'Coordinator' },
  Educator:    { id: 'support_trainee',   label: 'Support Trainee',   role: 'Educator' },
  Specialist:  { id: 'reassess_trainee',  label: 'Reassess Trainee',  role: 'Specialist' },
};

export const ALL_TRAINEES: TraineeDef[] = Object.values(CLASS_TRAINEE_BY_ROLE);

// Future school placeholders — not yet obtainable, referenced by Department Schools.
export const FUTURE_TRAINEE_IDS = ['airway_trainee', 'pharmacology_trainee', 'emergency_trainee', 'nutrition_trainee'];

export function traineeForRole(role: HeroRole): TraineeDef {
  return CLASS_TRAINEE_BY_ROLE[role];
}

// ---------- Certification promotion requirements ----------
export interface PromotionRequirement {
  fromStar: number;
  toStar: number;
  levelRequired: number;
  shardsRequired: number;
  trainRequired: number;
  creditsRequired: number;
  // 1★→2★ MVP rule: EITHER enough shards OR enough trainees. Higher tiers
  // require both.
  shardsOrTrainees: boolean;
}

export const PROMOTION_REQUIREMENTS: Record<number, PromotionRequirement> = {
  1: { fromStar: 1, toStar: 2, levelRequired: 10, shardsRequired: 20, trainRequired: 3, creditsRequired: 500, shardsOrTrainees: true },
  2: { fromStar: 2, toStar: 3, levelRequired: 20, shardsRequired: 40, trainRequired: 5, creditsRequired: 1500, shardsOrTrainees: false },
  3: { fromStar: 3, toStar: 4, levelRequired: 30, shardsRequired: 80, trainRequired: 10, creditsRequired: 5000, shardsOrTrainees: false },
  4: { fromStar: 4, toStar: 5, levelRequired: 40, shardsRequired: 150, trainRequired: 20, creditsRequired: 15000, shardsOrTrainees: false },
};

export interface PromotionCheck {
  atMaxStar: boolean;
  eligible: boolean;
  req: PromotionRequirement | null;
  trainee: TraineeDef;
  level: number;
  levelNeeded: number;
  levelOk: boolean;
  shardsHave: number;
  shardsNeeded: number;
  shardsOk: boolean;
  trainHave: number;
  trainNeeded: number;
  trainOk: boolean;
  creditsHave: number;
  creditsNeeded: number;
  creditsOk: boolean;
  missing: string[];
}

export function checkPromotion(role: HeroRole, prog: HeroProgress, player: PlayerState): PromotionCheck {
  const trainee = traineeForRole(role);
  const level = prog.level ?? 1;
  const shardsHave = getHeroShards(prog);
  const trainHave = player.class_trainees?.[trainee.id] ?? 0;
  const creditsHave = player.university_credits ?? 0;

  if (prog.star >= MAX_CERTIFICATION_STAR) {
    return {
      atMaxStar: true, eligible: false, req: null, trainee,
      level, levelNeeded: 0, levelOk: true,
      shardsHave, shardsNeeded: 0, shardsOk: true,
      trainHave, trainNeeded: 0, trainOk: true,
      creditsHave, creditsNeeded: 0, creditsOk: true,
      missing: ['Already at maximum Certification Star.'],
    };
  }

  const req = PROMOTION_REQUIREMENTS[prog.star];
  const levelOk = level >= req.levelRequired;
  const shardsOk = shardsHave >= req.shardsRequired;
  const trainOk = trainHave >= req.trainRequired;
  const materialsOk = req.shardsOrTrainees ? (shardsOk || trainOk) : (shardsOk && trainOk);
  const creditsOk = creditsHave >= req.creditsRequired;
  const eligible = levelOk && materialsOk && creditsOk;

  const missing: string[] = [];
  if (!levelOk) missing.push(`Reach Hero Level ${req.levelRequired} (currently ${level})`);
  if (!materialsOk) {
    missing.push(req.shardsOrTrainees
      ? `Need ${req.shardsRequired} Hero Shards OR ${req.trainRequired} ${trainee.label}s (have ${shardsHave} shards, ${trainHave} trainees)`
      : `Need ${req.shardsRequired} Hero Shards AND ${req.trainRequired} ${trainee.label}s (have ${shardsHave} shards, ${trainHave} trainees)`);
  }
  if (!creditsOk) missing.push(`Need ${req.creditsRequired} University Credits (have ${creditsHave})`);

  return {
    atMaxStar: false, eligible, req, trainee,
    level, levelNeeded: req.levelRequired, levelOk,
    shardsHave, shardsNeeded: req.shardsRequired, shardsOk,
    trainHave, trainNeeded: req.trainRequired, trainOk,
    creditsHave, creditsNeeded: req.creditsRequired, creditsOk,
    missing,
  };
}

export interface PromotionResult {
  ok: boolean;
  message: string;
  newProg?: HeroProgress;
  shardsSpent?: number;
  trainSpent?: number;
  creditsSpent?: number;
}

// Promotion raises Certification Star + level cap. It NEVER deletes/replaces
// the hero — only its progression object is updated.
export function promoteHero(heroName: string, role: HeroRole, prog: HeroProgress, player: PlayerState): PromotionResult {
  const check = checkPromotion(role, prog, player);
  if (check.atMaxStar) return { ok: false, message: `${heroName} is already at the maximum Certification Star.` };
  if (!check.eligible || !check.req) {
    return { ok: false, message: `Not ready to promote ${heroName} yet: ${check.missing.join('; ')}.` };
  }
  const req = check.req;
  let shardsSpent = 0;
  let trainSpent = 0;
  if (req.shardsOrTrainees) {
    // Prefer spending shards first so shared Class Trainees stay available for other heroes.
    if (check.shardsOk) shardsSpent = req.shardsRequired;
    else trainSpent = req.trainRequired;
  } else {
    shardsSpent = req.shardsRequired;
    trainSpent = req.trainRequired;
  }
  const newProg: HeroProgress = { ...prog, star: req.toStar, copies: Math.max(0, prog.copies - shardsSpent) };
  return {
    ok: true,
    message: `${heroName} promoted to ${req.toStar}-Star Certification! Level cap is now ${levelCapForStar(req.toStar)}.`,
    newProg,
    shardsSpent,
    trainSpent,
    creditsSpent: req.creditsRequired,
  };
}

// ---------- Auto Select Materials (Step 11) ----------
// Auto Select only ever proposes spending THIS hero's own Hero Shards and the
// shared Class Trainees for its role/school — it never touches, locks, or
// consumes any other owned hero, so locked/favorited/team/first-copy heroes
// are structurally protected without extra bookkeeping.
export interface AutoSelectPlan {
  usable: boolean;
  useShards: boolean;
  useTrainees: boolean;
  summary: string;
}

export function autoSelectMaterials(check: PromotionCheck): AutoSelectPlan {
  if (check.atMaxStar || !check.req) {
    return { usable: false, useShards: false, useTrainees: false, summary: 'No promotion available.' };
  }
  if (check.req.shardsOrTrainees) {
    if (check.shardsOk) return { usable: true, useShards: true, useTrainees: false, summary: `Will use ${check.req.shardsRequired} Hero Shards.` };
    if (check.trainOk) return { usable: true, useShards: false, useTrainees: true, summary: `Will use ${check.req.trainRequired} ${check.trainee.label}s.` };
    return { usable: false, useShards: false, useTrainees: false, summary: 'Not enough Hero Shards or Class Trainees yet.' };
  }
  if (check.shardsOk && check.trainOk) {
    return { usable: true, useShards: true, useTrainees: true, summary: `Will use ${check.req.shardsRequired} Hero Shards + ${check.req.trainRequired} ${check.trainee.label}s.` };
  }
  return { usable: false, useShards: false, useTrainees: false, summary: 'Not enough Hero Shards and Class Trainees yet.' };
}

// ---------- Hero Level / Training Hall ----------
export function canTrain(prog: HeroProgress): boolean {
  const cap = levelCapForStar(prog.star);
  return (prog.level ?? 1) < cap;
}

export function trainProgress(prog: HeroProgress): HeroProgress {
  const cap = levelCapForStar(prog.star);
  const level = Math.min(cap, (prog.level ?? 1) + 1);
  return { ...prog, level };
}

// ---------- Rarity → quality tier (never rendered as "stars") ----------
export function rarityTierLabel(rarity: number): string {
  return `T${rarity}`;
}

// ---------- University Recruitment ----------
export type RecruitKind = 'hero' | 'shards' | 'trainee' | 'credits';

export interface RecruitResult {
  kind: RecruitKind;
  entry?: GachaEntry;
  isNewHero?: boolean;
  shardAmount?: number;
  trainee?: TraineeDef;
  traineeAmount?: number;
  creditsAmount?: number;
  message: string;
}

function rollHeroOutcome(ownedHeroIds: Set<string>): RecruitResult {
  const totalWeight = FOUNDATION_BANNER.reduce((sum, h) => sum + h.weight, 0);
  let roll = Math.random() * totalWeight;
  let entry = FOUNDATION_BANNER[0];
  for (const e of FOUNDATION_BANNER) {
    roll -= e.weight;
    if (roll <= 0) { entry = e; break; }
  }
  const duplicate = ownedHeroIds.has(entry.heroId);
  if (duplicate) {
    const shardAmount = 10 + entry.rarity * 5;
    return { kind: 'shards', entry, shardAmount, message: `Duplicate ${entry.name} converted into ${shardAmount} Hero Shards!` };
  }
  return { kind: 'hero', entry, isNewHero: true, message: `${entry.name} enrolled at Clinica University as a 1-Star healer!` };
}

function rollTraineeOutcome(): RecruitResult {
  const trainee = ALL_TRAINEES[Math.floor(Math.random() * ALL_TRAINEES.length)];
  const traineeAmount = 2 + Math.floor(Math.random() * 3);
  return { kind: 'trainee', trainee, traineeAmount, message: `Recruited ${traineeAmount} ${trainee.label}(s)!` };
}

function rollCreditsOutcome(): RecruitResult {
  const creditsAmount = 50 + Math.floor(Math.random() * 101);
  return { kind: 'credits', creditsAmount, message: `Earned ${creditsAmount} University Credits!` };
}

export function recruitOnce(ownedHeroIds: Set<string>): RecruitResult {
  const roll = Math.random();
  if (roll < 0.7) return rollHeroOutcome(ownedHeroIds);
  if (roll < 0.9) return rollTraineeOutcome();
  return rollCreditsOutcome();
}

// Full Class Recruitment: 10 results, guaranteed at least 1 Class Trainee
// reward and some University Credits somewhere in the batch (heroes/shards
// are already guaranteed on every pull).
export function recruitTen(ownedHeroIds: string[]): RecruitResult[] {
  const owned = new Set(ownedHeroIds);
  const results: RecruitResult[] = [];
  for (let i = 0; i < 10; i++) {
    const r = recruitOnce(owned);
    if (r.kind === 'hero' && r.entry) owned.add(r.entry.heroId);
    results.push(r);
  }
  if (!results.some(r => r.kind === 'trainee')) {
    const replaceIdx = results.findIndex(r => r.kind === 'shards' || r.kind === 'credits');
    const idx = replaceIdx >= 0 ? replaceIdx : results.length - 1;
    results[idx] = rollTraineeOutcome();
  }
  if (!results.some(r => r.kind === 'credits')) {
    const replaceIdx = results.findIndex((r, i) => i !== results.findIndex(rr => rr.kind === 'trainee') && (r.kind === 'shards'));
    const idx = replaceIdx >= 0 ? replaceIdx : results.length - 1;
    results[idx] = rollCreditsOutcome();
  }
  return results;
}

export function applyRecruitResultToProgression(
  prog: Record<string, HeroProgress> | undefined,
  heroesOwned: string[],
  result: RecruitResult,
): { heroesOwned: string[]; progression: Record<string, HeroProgress> } {
  const nextOwned = [...heroesOwned];
  const nextProg = { ...(prog || {}) };
  if (result.kind === 'hero' && result.entry) {
    if (!nextOwned.includes(result.entry.heroId)) nextOwned.push(result.entry.heroId);
    if (!nextProg[result.entry.heroId]) nextProg[result.entry.heroId] = defaultProgress();
  } else if (result.kind === 'shards' && result.entry) {
    const cur = nextProg[result.entry.heroId] || defaultProgress();
    nextProg[result.entry.heroId] = { ...cur, copies: cur.copies + (result.shardAmount || 0) };
  }
  return { heroesOwned: nextOwned, progression: nextProg };
}
