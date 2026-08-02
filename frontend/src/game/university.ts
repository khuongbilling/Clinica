import { HeroRole, PlayerState } from './types';
import { HeroProgress, defaultProgress, getHeroShards } from './evolution';
import { FOUNDATION_BANNER, GachaEntry, DUPLICATE_REFUND } from './gacha';
import { playerLevelFromXp } from './progression';

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

// ── Class Change ──────────────────────────────────────────────────────────────
// Heroes undergo a Class Change at 3★ Certification — their role evolves into
// a more specialised form with an updated title. At 5★ they reach their
// legendary apex class.

export const CLASS_CHANGE_STAR = 3; // first class-change breakpoint

const ROLE_CLASS_LABELS: Record<string, [string, string, string]> = {
  // [1-2★ apprentice label, 3-4★ class-change label, 5★ apex label]
  Stabilizer:   ['Apprentice Stabilizer', 'Senior Stabilizer',   'Stability Guardian'],
  Assessor:     ['Apprentice Assessor',   'Clinical Assessor',   'Diagnostic Sage'],
  Analyst:      ['Apprentice Analyst',    'Lead Analyst',        'Analytical Master'],
  Coordinator:  ['Apprentice Coord.',     'Ward Coordinator',    'Operations Chief'],
  Educator:     ['Apprentice Educator',   'Clinical Educator',   'Lore Keeper'],
  Specialist:   ['Specialist',            'Senior Specialist',   'Master Specialist'],
  Scout:        ['Observer',              'Field Observer',      'Vanguard Observer'],
  Striker:      ['Striker',               'Elite Striker',       'Apex Striker'],
  Restorer:     ['Restorer',              'Master Restorer',     'Restoration Sage'],
  Preventer:    ['Preventer',             'Chief Preventer',     'Sentinel'],
  SystemsLeader:['Systems Analyst',       'Systems Leader',      'Systems Director'],
};

/**
 * Maps HeroRole code values to player-facing display names.
 * 'Scout' → 'Observer' (avoids confusion with the renamed 'Assess' clinical pathway step).
 * All other roles pass through unchanged.
 */
export function heroRoleLabel(role: string): string {
  if (role === 'Scout') return 'Observer';
  return role;
}

/** Display class title for a hero at a given Certification Star. */
export function heroClassLabel(role: string, star: number): string {
  const labels = ROLE_CLASS_LABELS[role];
  if (!labels) return role;
  if (star >= 5) return labels[2];
  if (star >= CLASS_CHANGE_STAR) return labels[1];
  return labels[0];
}

/** True when this star is the exact class-change breakpoint (shows badge). */
export function isClassChangeStar(star: number): boolean {
  return star === CLASS_CHANGE_STAR;
}

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
  Specialist:      { id: 'reassess_trainee',      label: 'Reassess Trainee',      role: 'Specialist' },
  Scout:           { id: 'scout_trainee',          label: 'Observer Trainee',       role: 'Scout' },
  Striker:         { id: 'striker_trainee',        label: 'Striker Trainee',        role: 'Striker' },
  Restorer:        { id: 'restorer_trainee',       label: 'Restorer Trainee',       role: 'Restorer' },
  Preventer:       { id: 'preventer_trainee',      label: 'Preventer Trainee',      role: 'Preventer' },
  SystemsLeader:   { id: 'systems_leader_trainee', label: 'Systems Leader Trainee', role: 'SystemsLeader' },
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
  /** Player Level gate: must be >= toStar to promote. */
  playerLevel: number;
  playerLevelNeeded: number;
  playerLevelOk: boolean;
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
  // Player Level gate — Level N unlocks promotion to N★
  const playerLevel = player.player_level ?? playerLevelFromXp(player.xp ?? 0).level;

  if (prog.star >= MAX_CERTIFICATION_STAR) {
    return {
      atMaxStar: true, eligible: false, req: null, trainee,
      level, levelNeeded: 0, levelOk: true,
      playerLevel, playerLevelNeeded: MAX_CERTIFICATION_STAR, playerLevelOk: true,
      shardsHave, shardsNeeded: 0, shardsOk: true,
      trainHave, trainNeeded: 0, trainOk: true,
      creditsHave, creditsNeeded: 0, creditsOk: true,
      missing: ['Already at maximum Certification Star.'],
    };
  }

  const req = PROMOTION_REQUIREMENTS[prog.star];
  const levelOk = level >= req.levelRequired;
  const playerLevelNeeded = req.toStar;
  const playerLevelOk = playerLevel >= playerLevelNeeded;
  const shardsOk = shardsHave >= req.shardsRequired;
  const trainOk = trainHave >= req.trainRequired;
  const materialsOk = req.shardsOrTrainees ? (shardsOk || trainOk) : (shardsOk && trainOk);
  const creditsOk = creditsHave >= req.creditsRequired;
  const eligible = levelOk && playerLevelOk && materialsOk && creditsOk;

  const missing: string[] = [];
  if (!playerLevelOk) missing.push(`Reach Player Level ${playerLevelNeeded} to unlock ${req.toStar}★ Certification`);
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
    playerLevel, playerLevelNeeded, playerLevelOk,
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

// ── Experience Scroll tiers ──────────────────────────────────────────────────
//
// Four tiers of scroll with increasing XP and rarity. Players earn lower
// tiers from normal battles and higher tiers from boss clears. All tiers can
// be purchased at the Training Hall for Crowns, with price scaling to rarity.
//
// XP cost curve: heroXpCostForLevel(L) = 40 + (L-1)*8
//   xs (10 XP)  — roughly 0.25 levels at Lv1, <0.1 at Lv10  (common gain, 1★ drop)
//   sm (25 XP)  — 0.6 levels at Lv1, ~0.2 at Lv10            (uncommon, 2★ drop)
//   md (50 XP)  — 1.25 levels at Lv1, ~0.45 at Lv10          (rare, 3★ drop)
//   lg (100 XP) — 2.5 levels at Lv1, ~0.9 at Lv10            (epic, boss 3★ drop only)

export interface ScrollTier {
  key: string;       // inventory key (e.g. 'exp_scroll_xs')
  xp: number;        // Hero XP granted on use
  label: string;     // display name
  rarity: string;    // 'Common' | 'Uncommon' | 'Rare' | 'Epic'
  crownCost: number; // price at Training Hall
  color: string;     // tint color for UI
  iconName: string;  // Ionicons name
}

export const SCROLL_TIERS: ScrollTier[] = [
  {
    key: 'exp_scroll_xs', xp: 10,  label: 'Basic Scroll',     rarity: 'Common',
    crownCost: 35,  color: '#94A3B8', iconName: 'document-outline',
  },
  {
    key: 'exp_scroll_sm', xp: 25,  label: 'Refined Scroll',   rarity: 'Uncommon',
    crownCost: 80,  color: '#34D399', iconName: 'document-text-outline',
  },
  {
    key: 'exp_scroll_md', xp: 50,  label: 'Advanced Scroll',  rarity: 'Rare',
    crownCost: 150, color: '#60A5FA', iconName: 'document-text',
  },
  {
    key: 'exp_scroll_lg', xp: 100, label: 'Sovereign Scroll',  rarity: 'Epic',
    crownCost: 260, color: '#D4AF37', iconName: 'star',
  },
];

/** Convenience look-up by inventory key. Returns undefined for unknown keys. */
export function findScrollTier(key: string): ScrollTier | undefined {
  return SCROLL_TIERS.find((t) => t.key === key);
}

/** @deprecated Use SCROLL_TIERS[3].xp — kept for backward compat */
export const EXP_SCROLL_XP = 100;
/** @deprecated Use SCROLL_TIERS[3].crownCost — kept for backward compat */
export const EXP_SCROLL_CROWN_COST = 260;

// ── Player Level → max Certification Star gate ───────────────────────────────
//
// Player Level gates hero PROMOTION (star advancement), not individual levels
// within a star tier. Level 2 → can promote to 2★, Level 3 → 3★, etc.
// Within a star tier heroes can freely level up to that tier's cap.

/** Maximum Certification Star a player at this level may promote heroes to. */
export function playerMaxStar(playerLevel: number): number {
  return Math.min(MAX_CERTIFICATION_STAR, Math.max(1, Math.round(playerLevel)));
}

/**
 * Effective hero level cap = level cap for the hero's current Certification Star.
 * The player-level gate now operates at the PROMOTION boundary (see checkPromotion
 * and playerMaxStar), not at the within-tier level ceiling.
 *
 * The `playerLevel` param is retained for call-site compatibility but no longer
 * clamps the within-tier level.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function heroEffectiveLevelCap(star: number, _playerLevel?: number): number {
  return levelCapForStar(star);
}

/**
 * Whether a hero can receive scroll (or battle) XP right now.
 */
export function canUseScroll(prog: HeroProgress, _playerLevel?: number): boolean {
  return (prog.level ?? 1) < levelCapForStar(prog.star);
}

/** @deprecated Use canUseScroll(prog, playerLevel) */
export function canTrain(prog: HeroProgress): boolean {
  const cap = levelCapForStar(prog.star);
  return (prog.level ?? 1) < cap;
}

/** @deprecated Kept for any callers still using the direct +1-level path */
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
  /** Per-hero evolution shards (copies) awarded for a duplicate pull. */
  shardAmount?: number;
  /** Codex Shards (summoning currency) refunded as consolation for a duplicate. */
  codexShardRefund?: number;
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
    const codexShardRefund = DUPLICATE_REFUND;
    return {
      kind: 'shards',
      entry,
      shardAmount,
      codexShardRefund,
      message: `Duplicate ${entry.name}! Converted into ${shardAmount} Hero Shards + ${codexShardRefund} Codex Shards refunded.`,
    };
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

// Tutorial Recruitment Ceremony — guaranteed hero pull, never trainee/credits.
// For summon 2 (preferDifferentRole set), prefers a hero with a different role
// than the first enrolled healer to give the starter party complementary skills.
// Falls back to any un-owned hero when role-filtering would leave the pool empty,
// and falls back to the normal hero-outcome roll if the player owns every hero.
export function tutorialRecruitOnce(ownedHeroIds: Set<string>, preferDifferentRole?: string): RecruitResult {
  const available = FOUNDATION_BANNER.filter(e => !ownedHeroIds.has(e.heroId));
  if (available.length === 0) {
    return rollHeroOutcome(ownedHeroIds);
  }
  let pool = available;
  if (preferDifferentRole) {
    const diffRole = available.filter(e => e.role !== preferDifferentRole);
    if (diffRole.length > 0) pool = diffRole;
  }
  const totalWeight = pool.reduce((sum, h) => sum + h.weight, 0);
  let roll = Math.random() * totalWeight;
  let entry = pool[0];
  for (const e of pool) {
    roll -= e.weight;
    if (roll <= 0) { entry = e; break; }
  }
  return {
    kind: 'hero',
    entry,
    isNewHero: true,
    message: `${entry.name} has answered the call of the Realm — they join your ward as a 1-Star healer!`,
  };
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
