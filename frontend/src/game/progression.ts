// ────────────────────────────────────────────────────────────
// PROGRESSION — Player Level/EXP vs Hero Level/EXP
//
// Two fully independent tracks:
//   Player Level  — account-wide. Grown by Player EXP earned from battles
//                   (scaled by chapter/difficulty/stars/first-clear/Clinical
//                   Cue). Drives Shift Stamina max, feature unlocks, and
//                   Player Class ability tiers (10/20/30).
//   Hero Level    — per-hero. Grown by Hero EXP earned from battle
//                   contribution share (damage/heal/shield/reveal/AP), capped
//                   per Certification Star (see university.ts levelCapForStar).
//                   Training Hall (university.ts trainProgress) remains an
//                   alternate manual way to raise the same `level` field.
// ────────────────────────────────────────────────────────────

// ---------- Player Level curve ----------
// Cost (in Player EXP) to go from level L to L+1. Same currency as the
// existing `xp`/RANKS field — RANKS stay as flavor text layered on top.
// J2 XP curve: targets Level 2 @ 150 total XP, Level 3 @ ~360, Level 4 @ ~640,
// Level 5 @ ~990, Level 6 @ ~1410, Level 7 @ ~1910 — comfortable early pacing
// that rewards story + battle + journey node clears without excessive grinding.
// Formula: 150 + 35*(L-1) + 25*(L-1)^1.2  (flat start, gentle acceleration).
export function playerXpCostForLevel(level: number): number {
  const l = Math.max(0, level - 1);
  return Math.round(150 + 35 * l + 25 * Math.pow(l, 1.2));
}

export const PLAYER_LEVEL_CAP = 60;

export interface PlayerLevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number; // 0 when at cap
  atCap: boolean;
}

export function playerLevelFromXp(xp: number): PlayerLevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  while (level < PLAYER_LEVEL_CAP) {
    const cost = playerXpCostForLevel(level);
    if (remaining < cost) break;
    remaining -= cost;
    level++;
  }
  const atCap = level >= PLAYER_LEVEL_CAP;
  return {
    level,
    xpIntoLevel: remaining,
    xpForNextLevel: atCap ? 0 : playerXpCostForLevel(level),
    atCap,
  };
}

// ---------- Shift Stamina cap ----------
// Base 20, +1 every 2 levels, with an extra +1 bump at key milestones.
export const STAMINA_MILESTONES = [5, 10, 15, 20, 25, 30];

export function staminaMaxForLevel(level: number): number {
  const base = 20;
  const trickle = Math.floor(Math.max(0, level - 1) / 2);
  const milestoneBonus = STAMINA_MILESTONES.filter((m) => level >= m).length;
  return base + trickle + milestoneBonus;
}

// ---------- Feature unlocks ----------
export interface FeatureUnlock {
  id: string;
  label: string;
  level: number;
}

// Rollout order (guided so a new player never faces everything at once):
//   University (foundation) → Ward Shift simulations → Ward Defense → Realm →
//   Boss exam → living-world endgame. Ward Shift is Level 1 but gated behind
//   the first University lesson (narrative gate in checkFeatureGate) so School
//   always comes first. Realm sits AFTER Ward Defense but BEFORE the Boss.
// P23 unlock ladder (spread side systems so each level has something to look
// forward to rather than everything arriving at once):
//   Lv1  → University, Ward Shift (lesson-gated narrative)
//   Lv2  → Lotus Journal, Daily & Weekly Rounds, Hall of Heroes (team building)
//   Lv3  → Apothecary Market / Shops  ← bumped from Lv2
//   Lv4  → Ward Defense standalone     ← aligns with Ward Defense feature
//   Lv5  → Realm (also needs first shift done)
//   Lv7  → World Events (Miasma Bloom) ← bumped from Lv5
//   Lv9  → Boss Encounters              ← bumped from Lv7 (Ch6 story = Lv10)
//   Lv12 → Full 10-pull Recruitment     (unchanged)
export const FEATURE_UNLOCKS: FeatureUnlock[] = [
  { id: 'university',       label: 'Clinica University & Training Hall', level: 1 },
  { id: 'ward_shift',       label: 'Ward Shift Simulations',             level: 1 },
  { id: 'lotus_journal',    label: 'Lotus Plate Journal',                level: 2 },
  // C5 — Hall of Heroes and Daily/Weekly Rounds stay at Level 2 (Apprentice
  // Path). Team-building via Summoning Hall is essential early; daily quests
  // provide meaningful inter-chapter grinding XP from the start.
  { id: 'hall_of_heroes',   label: 'Summoning Hall (Recruitment)',       level: 2 },
  { id: 'daily_rounds',     label: 'Daily & Weekly Rounds',              level: 2 },
  // P23 — Shop bumped to Lv3 so players have something new to unlock after
  // their first grinding session between Ch2 and Ch3.
  { id: 'shop',             label: 'Apothecary Market (Shops)',          level: 3 },
  // P25 — Community Board tab appears alongside the Shop so players have a
  // reason to explore the outer wards from the very start. Active participation
  // in the Miasma Bloom outbreak response is gated separately at Lv7 (world_event).
  { id: 'community_board',  label: 'Community Health Board',             level: 3 },
  { id: 'ward_defense',     label: 'Ward Defense',                       level: 4 },
  { id: 'realm',            label: 'Realm — Grand Ward Atrium',          level: 5 },
  // P23 — World Events and Boss both bumped so the unlock ladder stays
  // meaningful through the mid-game (Ch5–Ch6 range).
  { id: 'world_event',      label: 'World Events (Miasma Bloom)',        level: 7 },
  { id: 'boss',             label: 'Boss Encounters',                    level: 9 },
  { id: 'ten_pull',         label: 'Full Class Recruitment (10-pull)',   level: 12 },
  { id: 'advanced_traits',  label: 'Advanced Hero Traits',               level: 15 },
  { id: 'advanced_sims',    label: 'Advanced Simulations',               level: 25 },
];

export function isFeatureUnlocked(id: string, level: number): boolean {
  const f = FEATURE_UNLOCKS.find((x) => x.id === id);
  if (!f) return true;
  return level >= f.level;
}

export function nextLockedFeature(level: number): FeatureUnlock | null {
  const locked = FEATURE_UNLOCKS.filter((f) => f.level > level).sort((a, b) => a.level - b.level);
  return locked[0] || null;
}

// ---------- Compound feature gates ----------
// Some features require BOTH a Player Level AND a narrative milestone flag
// (first Ward Shift completed, first lessons done). These express the guided-
// onboarding gating from the "System narrator" onboarding pass. Level-only
// checks stay in isFeatureUnlocked above; callers that need the story gate use
// these instead so a max-level returning player is never blocked by a flag
// they can no longer earn out of order.
export interface CompoundGateContext {
  level: number;
  firstWardShiftDone: boolean;
  lessonsStarted: boolean;
}

export interface GateResult {
  unlocked: boolean;
  reason: string | null;
}

export function checkFeatureGate(id: string, ctx: CompoundGateContext): GateResult {
  const levelOk = isFeatureUnlocked(id, ctx.level);
  const f = FEATURE_UNLOCKS.find((x) => x.id === id);
  const needLevel = f ? f.level : 1;
  if (!levelOk) {
    // P23: action-oriented reason strings — tell the player what to DO, not
    // just what level to reach.
    const earlyGrindTip = needLevel <= 3
      ? 'Replay cleared shifts, finish University practice, and complete daily quests to gain XP.'
      : needLevel <= 6
      ? 'Complete chapter battles, run daily quests, and upgrade hero skills to advance.'
      : 'Continue chapter progression, daily quests, and Realm production to reach this milestone.';
    return {
      unlocked: false,
      reason: `Reach Player Level ${needLevel} to unlock. ${earlyGrindTip}`,
    };
  }
  switch (id) {
    // C5 — Summoning Hall (hall_of_heroes) now unlocks at Level 2 with no
    // additional narrative gate. The Level 2 gate itself is sufficient:
    // players who reached Level 2 have necessarily done some gameplay.
    case 'hall_of_heroes':
      return { unlocked: true, reason: null };
    // Ward Shift simulations open only after the player begins their first
    // University lesson — School always comes before the (simulated) ward. This
    // is a narrative gate, not a level gate, so a returning max-level player who
    // never happened to open a lesson isn't hard-blocked (level is already met).
    case 'ward_shift':
      if (!ctx.lessonsStarted) {
        return {
          unlocked: false,
          reason: 'Begin your first Lotus Lesson at Clinica University to open Ward Shift simulations.',
        };
      }
      return { unlocked: true, reason: null };
    case 'realm':
      if (!ctx.firstWardShiftDone) {
        return {
          unlocked: false,
          reason: 'Complete your first Ward Shift simulation to unlock the Realm.',
        };
      }
      return { unlocked: true, reason: null };
    default:
      return { unlocked: true, reason: null };
  }
}

// Build the compound gate context from a player-like object. Centralized so
// every gate call site (tab bar, screen entry guards, in-app links) derives the
// same level + narrative-milestone signals. Kept loosely typed to avoid a
// circular import with the store's PlayerState.
export function buildGateContext(
  player:
    | {
        player_level?: number | null;
        xp?: number | null;
        runs_completed?: number | null;
        lessons_completed?: unknown[] | null;
      }
    | null
    | undefined,
): CompoundGateContext {
  return {
    level: player ? (player.player_level ?? playerLevelFromXp(player.xp ?? 0).level) : 1,
    firstWardShiftDone: (player?.runs_completed ?? 0) > 0,
    lessonsStarted: (player?.lessons_completed?.length ?? 0) > 0,
  };
}

// ---------- Player Class abilities (account-level, unlocked at 10/20/30) ----------
export type PlayerClass = 'Guardian' | 'Seer' | 'Caretaker' | 'Scholar';

// Reuses the existing required `aptitude` field (set at onboarding) so no
// new persisted field is needed — the free-text `player_class` field maps
// down into the same four aptitudes already.
export function playerClassForAptitude(aptitude?: string | null): PlayerClass {
  switch (aptitude) {
    case 'sage': return 'Seer';
    case 'warden': return 'Caretaker';
    case 'weaver': return 'Scholar';
    default: return 'Guardian';
  }
}

export interface ClassAbilityTier {
  level: number;
  name: string;
  description: string;
}

export const PLAYER_CLASS_ABILITIES: Record<PlayerClass, ClassAbilityTier[]> = {
  Guardian: [
    { level: 10, name: 'Vigil Bond', description: '+5 starting Stability on every battle.' },
    { level: 20, name: 'Iron Vigil', description: "Guardian's Vigil recovers more, plus another +5 starting Stability." },
    { level: 30, name: 'Unbreakable Ward', description: 'Every battle starts with a small protective Shield.' },
  ],
  Seer: [
    { level: 10, name: "Seer's Eye", description: 'One extra hidden clue is revealed at the start of battle.' },
    { level: 20, name: 'Foresight', description: '+1 bonus AP every turn.' },
    { level: 30, name: 'Clarity', description: '+10 starting Stability from calm, clear-eyed assessment.' },
  ],
  Caretaker: [
    { level: 10, name: "Caretaker's Hand", description: '+5 starting Stability on every battle.' },
    { level: 20, name: 'Steady Hands', description: 'Another +10 starting Stability.' },
    { level: 30, name: 'Sanctuary', description: 'Every battle starts with a protective Shield.' },
  ],
  Scholar: [
    { level: 10, name: 'Studied Mind', description: '+1 bonus AP every turn.' },
    { level: 20, name: 'Deep Study', description: 'Another +1 bonus AP every turn.' },
    { level: 30, name: 'Insight', description: 'One extra hidden clue is revealed at the start of battle.' },
  ],
};

export function unlockedClassAbilities(aptitude: string | null | undefined, level: number): ClassAbilityTier[] {
  const cls = playerClassForAptitude(aptitude);
  return PLAYER_CLASS_ABILITIES[cls].filter((t) => t.level <= level);
}

export function nextClassAbility(aptitude: string | null | undefined, level: number): ClassAbilityTier | null {
  const cls = playerClassForAptitude(aptitude);
  return PLAYER_CLASS_ABILITIES[cls].find((t) => t.level > level) || null;
}

export interface ClassBattleBonuses {
  startingStabilityBonus: number;
  revealOneExtraClue: boolean;
  apBonus: number;
  guardianVigilBonus: number;
  startShield: number;
}

// Converts unlocked class abilities into concrete battle-init bonuses.
export function getClassBattleBonuses(aptitude: string | null | undefined, level: number): ClassBattleBonuses {
  const cls = playerClassForAptitude(aptitude);
  const bonuses: ClassBattleBonuses = {
    startingStabilityBonus: 0, revealOneExtraClue: false, apBonus: 0, guardianVigilBonus: 0, startShield: 0,
  };
  if (cls === 'Guardian') {
    if (level >= 10) bonuses.startingStabilityBonus += 5;
    if (level >= 20) { bonuses.startingStabilityBonus += 5; bonuses.guardianVigilBonus += 3; }
    if (level >= 30) bonuses.startShield += 15;
  } else if (cls === 'Seer') {
    if (level >= 10) bonuses.revealOneExtraClue = true;
    if (level >= 20) bonuses.apBonus += 1;
    if (level >= 30) bonuses.startingStabilityBonus += 10;
  } else if (cls === 'Caretaker') {
    if (level >= 10) bonuses.startingStabilityBonus += 5;
    if (level >= 20) bonuses.startingStabilityBonus += 10;
    if (level >= 30) bonuses.startShield += 20;
  } else if (cls === 'Scholar') {
    if (level >= 10) bonuses.apBonus += 1;
    if (level >= 20) bonuses.apBonus += 1;
    if (level >= 30) bonuses.revealOneExtraClue = true;
  }
  return bonuses;
}

// ---------- Player EXP reward scaling ----------
export interface PlayerXpRewardInput {
  baseXp: number; // existing chapter/boss-scaled base (battle.tsx)
  difficultyMultiplier: number; // e.g. from getDifficultyModifier-derived scale
  stars: number; // 0-3 performance stars earned this battle
  isFirstClear: boolean;
  clinicalCuesCorrect: number;
}

export function computePlayerXpReward(input: PlayerXpRewardInput): number {
  // C3: strict star-based multiplier — 1★≈33%, 2★≈67%, 3★=100%.
  // For 0★ wins (shouldn't normally occur) we still floor at 33% so a
  // technical win always gets something; loss XP is handled separately in
  // battle.tsx via LOSS_LEARNING_XP.
  const starMul = input.stars <= 0 ? 1 / 3 : Math.min(3, input.stars) / 3;
  let xp = input.baseXp * Math.max(0.5, input.difficultyMultiplier) * starMul;
  if (input.isFirstClear) xp *= 1.5;
  xp += input.clinicalCuesCorrect * 5;
  return Math.max(1, Math.round(xp));
}

// ---------- Hero Level curve (per-hero, capped by Certification Star) ----------
export function heroXpCostForLevel(level: number): number {
  return 40 + Math.max(0, level - 1) * 8;
}

export interface HeroLevelResult {
  level: number;
  xp: number; // remainder xp banked into the (possibly capped) level
  leveledUp: boolean;
  levelsGained: number;
}

// Adds `addXp` Hero EXP starting from `fromLevel`/`fromXp`, auto-leveling up
// to (but never past) `cap` (the Certification Star level cap). XP earned
// while already at the cap is retained (banked) so it isn't lost — it will
// auto-apply the moment the hero is promoted and the cap rises.
export function addHeroXp(fromLevel: number, fromXp: number, addXp: number, cap: number): HeroLevelResult {
  let level = Math.max(1, Math.round(fromLevel));
  let xp = Math.max(0, fromXp) + Math.max(0, addXp);
  const startLevel = level;
  while (level < cap) {
    const cost = heroXpCostForLevel(level);
    if (xp < cost) break;
    xp -= cost;
    level++;
  }
  return { level, xp, leveledUp: level > startLevel, levelsGained: level - startLevel };
}

// ---------- Hero battle-contribution → per-hero EXP split ----------
export interface ContributionSplitInput {
  totalPlayerXp: number; // used as the base EXP pool to distribute per hero
  contribution: Record<string, number>; // heroId -> raw contribution points this battle
  participantIds: string[]; // heroes that acted at least once
  overleveledIds?: string[]; // heroes farming content far below their level
}

export interface HeroXpAward {
  heroId: string;
  contributionShare: number; // 0..1
  xpAwarded: number;
}

const PARTICIPATION_FLOOR_FACTOR = 0.4; // a participant's share never falls below 40% of an equal split
const OVERLEVELED_XP_MULTIPLIER = 0.35; // heavily reduced EXP for overleveled heroes farming low content

export function splitContributionToHeroXp(input: ContributionSplitInput): HeroXpAward[] {
  const { totalPlayerXp, contribution, participantIds, overleveledIds = [] } = input;
  if (participantIds.length === 0) return [];
  const totalPoints = participantIds.reduce((sum, id) => sum + Math.max(0, contribution[id] || 0), 0);
  const equalShare = 1 / participantIds.length;
  const floorShare = equalShare * PARTICIPATION_FLOOR_FACTOR;

  // Raw shares, honoring the participation floor for anyone who acted.
  const rawShares: Record<string, number> = {};
  if (totalPoints <= 0) {
    participantIds.forEach((id) => { rawShares[id] = equalShare; });
  } else {
    participantIds.forEach((id) => {
      const naturalShare = Math.max(0, contribution[id] || 0) / totalPoints;
      rawShares[id] = Math.max(naturalShare, floorShare);
    });
  }
  // Renormalize so shares sum to 1.
  const shareSum = participantIds.reduce((s, id) => s + rawShares[id], 0) || 1;
  return participantIds.map((id) => {
    const share = rawShares[id] / shareSum;
    let xp = Math.round(totalPlayerXp * share);
    if (overleveledIds.includes(id)) xp = Math.round(xp * OVERLEVELED_XP_MULTIPLIER);
    return { heroId: id, contributionShare: share, xpAwarded: Math.max(1, xp) };
  });
}
