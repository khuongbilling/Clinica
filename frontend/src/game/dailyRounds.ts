// ────────────────────────────────────────────────────────────
// DAILY WARD ROUNDS — free-to-earn daily engagement backbone.
//
// Pure logic only: this module never touches the store, currencies, or the
// network directly. It computes the next DailyRoundsState + the reward a
// caller should hand to the existing player-update pipeline.
//
// Three loops, all strictly free-to-earn (no new currency, no monetization):
//   1. Login streak — increments once per calendar day, resets on a missed day.
//   2. Three daily objectives — rolled from a pool filtered to unlocked modes;
//      progress auto-fills as they play; each grants a reward and finishing all
//      three grants a small bonus.
//   3. Four weekly tasks — university, battles, daily sets, hero/material —
//      each claimable independently; completing all grants a modest RLG bonus.
//
// Fix 9 additions:
//   – DailyReward extended (universityCredits, playerXp, heroXp, refinedLotusGems)
//   – DailyEventType extended (journey_node, material_earned)
//   – Weekly task system (4 tasks, per-task claims, weekly completion bonus)
//   – Quest milestone system (one-time, auto-detected, claimable with rewards)
//
// Day/week reset reuses wellness.ts dateKey()/weekKey() so every recurring
// system in Clinica shares one calendar-day / ISO-week definition.
// ────────────────────────────────────────────────────────────

import { dateKey, weekKey } from './wellness';
import { playerLevelFromXp } from './progression';

// ---------- Reward shape (existing + extended currencies) ----------
export interface DailyReward {
  crowns?: number;
  codexShards?: number;
  insightCrystals?: number;
  // Fix 9 additions (all free-to-earn):
  universityCredits?: number;
  playerXp?: number;
  heroXp?: number;
  refinedLotusGems?: number; // weekly completion only — not farmable
  stamina?: number; // bounded Age 1 engagement bonus, never a new currency
  // Task 270 — equipment item ids granted directly into owned_equipment.
  equipmentItems?: string[];
}

// Progress-event types. Each maps to a hook point that already exists in the
// game's flow (see store.tsx). Objectives filter on these.
export type DailyEventType =
  | 'ward_shift_win'    // Ward Shift / clinical battle completed (applyRewards)
  | 'ward_defense_wave' // Ward Defense waves cleared (recordWardWaves)
  | 'university_lesson' // University lesson / practice completed (completeLesson / completeUniPractice)
  | 'wellness_log'      // Lotus Plate Journal activity logged (logWellnessActivity)
  | 'hero_action'       // Hero recruited / summoned / trained / evolved
  | 'journey_node'      // Journey Map node completed (claimJourneyNode)
  | 'material_earned';  // Learning material earned or used (practice / upgradeHeroSkill)

// ---------- Objective pool (daily) ----------
export interface DailyObjectiveTemplate {
  id: string;
  mode: string;       // FEATURE_UNLOCKS feature id
  event: DailyEventType;
  target: number;
  label: string;
  description: string;
  icon: string;       // Ionicons glyph
  reward: DailyReward;
}

// Core 3 spec tasks + 2 alternates for variety when more modes are unlocked.
// Pool shuffles deterministically per player×day, so objectives are consistent
// within a day but rotate for variety.
export const DAILY_OBJECTIVE_POOL: DailyObjectiveTemplate[] = [
  {
    id: 'obj_uni_practice',
    mode: 'university',
    event: 'university_lesson',
    target: 1,
    label: 'Clinical Study',
    description: 'Complete 1 University practice or lesson.',
    icon: 'school',
    reward: { universityCredits: 15, playerXp: 10 },
  },
  {
    id: 'obj_ward_battle',
    mode: 'ward_shift',
    event: 'ward_shift_win',
    target: 1,
    label: 'Answer the Ward',
    description: 'Complete 1 Ward Shift or Journey battle.',
    icon: 'medkit',
    reward: { crowns: 50, playerXp: 15, heroXp: 10 },
  },
  {
    id: 'obj_material',
    mode: 'university',
    event: 'material_earned',
    target: 1,
    label: 'Gather Supplies',
    description: 'Earn or use 1 learning material.',
    icon: 'library',
    reward: { universityCredits: 10, playerXp: 10 },
  },
  {
    id: 'obj_ward_defense',
    mode: 'ward_defense',
    event: 'ward_defense_wave',
    target: 3,
    label: 'Hold the Line',
    description: 'Clear 3 Ward Defense waves.',
    icon: 'shield-half',
    reward: { crowns: 50, playerXp: 15, heroXp: 10 },
  },
  {
    id: 'obj_hero',
    mode: 'hall_of_heroes',
    event: 'hero_action',
    target: 1,
    label: 'Rally a Hero',
    description: 'Recruit, summon, train, or evolve a hero.',
    icon: 'people',
    reward: { universityCredits: 10, playerXp: 10 },
  },
  // P3: Journey Map-aligned objective — fires on claimJourneyNode in the store.
  {
    id: 'obj_journey_node',
    mode: 'ward_shift', // available once Ward Shift unlocks (same as battle objectives)
    event: 'journey_node',
    target: 1,
    label: 'Advance the Journey',
    description: 'Claim 1 Journey Map node reward.',
    icon: 'map',
    reward: { crowns: 60, playerXp: 20, heroXp: 10 },
  },
];

export const DAILY_OBJECTIVE_COUNT = 3;

// Bonus for finishing all of the day's objectives (daily set completion).
export const ALL_COMPLETE_BONUS: DailyReward = { codexShards: 25, crowns: 25, playerXp: 10 };

// ---------- Weekly tasks (4 fixed tasks + completion bonus) ----------
export interface WeeklyTaskDef {
  id: string;
  label: string;
  description: string;
  icon: string;
  target: number;
  reward: DailyReward;
}

export interface WeeklyTaskState extends WeeklyTaskDef {
  progress: number;
  claimed: boolean;
}

export const WEEKLY_TASKS: WeeklyTaskDef[] = [
  {
    id: 'w_university',
    label: 'Clinical Practice',
    description: 'Complete 5 University activities.',
    icon: 'school',
    target: 5,
    reward: { universityCredits: 100, playerXp: 50 },
  },
  {
    id: 'w_battles',
    label: 'Ward Rounds',
    description: 'Complete 5 Ward Shifts or Journey battles.',
    icon: 'medkit',
    target: 5,
    reward: { crowns: 200, playerXp: 75, heroXp: 75 },
  },
  {
    id: 'w_daily_sets',
    label: 'Daily Rhythm',
    description: 'Complete 3 Daily task sets.',
    icon: 'calendar',
    target: 3,
    reward: { codexShards: 75, playerXp: 50 },
  },
  {
    id: 'w_hero',
    label: 'Hero Growth',
    description: 'Train a hero, upgrade a skill, or earn 3 learning materials.',
    icon: 'people',
    target: 1,
    reward: { universityCredits: 50, crowns: 50, playerXp: 25 },
  },
];

// Weekly completion bonus: RLG is strictly once per week and not farmable.
export const WEEKLY_ALL_COMPLETE_REWARD: DailyReward = {
  codexShards: 150,
  refinedLotusGems: 5,
  crowns: 100,
};

// Keep for backward-compat references (weekly days streak tracking).
export const WEEKLY_GOAL_TARGET = 5;
export const WEEKLY_GOAL_REWARD: DailyReward = WEEKLY_ALL_COMPLETE_REWARD;

// ---------- Quest milestones (one-time, auto-detected) ----------
export interface QuestMilestoneDef {
  id: string;
  label: string;
  description: string;
  icon: string;
  reward: DailyReward;
  isDone: (player: any) => boolean;
}

export const QUEST_MILESTONES: QuestMilestoneDef[] = [
  {
    id: 'ms_prologue',
    label: 'Complete the Prologue',
    description: 'Answer the first call and face the Infarct.',
    icon: 'sparkles',
    // P6 — onboarding milestones reward currencies, not XP; levels gate systems
    // while chapter progress gates story. XP comes from battles and journey nodes.
    reward: { crowns: 75 },
    isDone: (p) => !!p?.prologue_complete,
  },
  {
    id: 'ms_lotus_recall',
    label: 'Complete Lotus Recall',
    description: 'Follow the memory through the Lotus Recall.',
    icon: 'flower-outline',
    reward: { universityCredits: 50 },
    isDone: (p) => !!p?.identity_restored || (p?.story_scenes_seen ?? []).includes('lotus_recall'),
  },
  {
    id: 'ms_identity',
    label: 'Restore Your Identity',
    description: 'Reclaim your name and face in the ward.',
    icon: 'person-circle-outline',
    reward: { universityCredits: 50 },
    isDone: (p) => !!p?.identity_restored,
  },
  {
    id: 'ms_class_diagnostic',
    label: 'Complete Class Diagnostic',
    description: 'Take the clinical resonance assessment.',
    icon: 'flask-outline',
    reward: { universityCredits: 65 },
    isDone: (p) => !!p?.diagnostic_intro_seen,
  },
  {
    id: 'ms_class_confirm',
    label: 'Confirm Class Assignment',
    description: 'Choose your clinical path in the class tree.',
    icon: 'git-branch-outline',
    reward: { universityCredits: 75 },
    isDone: (p) => !!p?.class_tree_id,
  },
  {
    id: 'ms_reminiscence',
    label: 'Complete Reminiscence',
    description: 'Recover the memory of your calling.',
    icon: 'eye-outline',
    reward: { universityCredits: 75 },
    isDone: (p) => !!p?.seen_reminiscence,
  },
  {
    id: 'ms_main_hub',
    label: 'Reach the Main Hub',
    description: 'Enter the Shift hub and begin your career.',
    icon: 'home-outline',
    reward: { codexShards: 40 },
    isDone: (p) => !!p?.onboarding_complete && !!p?.identity_restored,
  },
  {
    id: 'ms_visit_uni',
    label: 'Visit Clinica University',
    description: 'Open the University and start learning.',
    icon: 'school-outline',
    reward: { universityCredits: 50 },
    isDone: (p) => (p?.lessons_completed?.length ?? 0) > 0 || (p?.uni_cue_lab_count ?? 0) > 0,
  },
  {
    id: 'ms_lotus_lesson',
    label: 'Complete First Lotus Lesson',
    description: 'Finish a lesson in Vital Foundations.',
    icon: 'leaf',
    reward: { universityCredits: 75 },
    isDone: (p) => (p?.lessons_completed ?? []).some((id: string) => id.startsWith('lotus:')),
  },
  {
    id: 'ms_fading_apprenticeship',
    label: 'Complete The Fading Apprenticeship',
    description: 'Win your first simulation battle.',
    icon: 'shield-checkmark-outline',
    reward: { crowns: 100 },
    isDone: (p) => (p?.runs_completed ?? 0) >= 1,
  },
  {
    id: 'ms_journey_map',
    label: 'Enter Chapter 1 Journey Map',
    description: 'Begin your first Journey Map node.',
    icon: 'map-outline',
    reward: { crowns: 75 },
    isDone: (p) => (p?.claimed_journey_nodes?.length ?? 0) > 0,
  },
  {
    id: 'ms_first_ward_shift',
    label: 'Complete First Ward Shift',
    description: 'Purify a disease in a clinical simulation case.',
    icon: 'medkit-outline',
    reward: { crowns: 100, heroXp: 15 },
    isDone: (p) => (p?.runs_completed ?? 0) >= 1,
  },
  {
    id: 'ms_chapter1',
    label: 'Complete Chapter 1',
    description: 'Advance to Chapter 2 of the healing journey.',
    icon: 'trophy-outline',
    // P6 — big completion reward in currencies, not XP. Story gates on c1n6 node.
    reward: { codexShards: 75, crowns: 100 },
    isDone: (p) =>
      (p?.claimed_journey_nodes ?? []).includes('c1n6') ||
      (p?.chapter_progress ?? 1) >= 2,
  },
  {
    id: 'ms_level2',
    label: 'Reach Level 2',
    description: 'Grow your healer rank through victories.',
    icon: 'trending-up',
    // P6 — level milestones grant currencies; XP from level milestones
    // creates an XP feedback loop that speeds up early progression.
    reward: { codexShards: 50, crowns: 100 },
    isDone: (p) => playerLevelFromXp(p?.xp ?? 0).level >= 2,
  },
  {
    id: 'ms_summoning_hall',
    label: 'Unlock Summoning Hall',
    description: 'Open the Hall of Heroes and recruit your team.',
    icon: 'people-outline',
    reward: { codexShards: 75 },
    isDone: (p) => playerLevelFromXp(p?.xp ?? 0).level >= 2,
  },
  {
    id: 'ms_first_daily',
    label: 'Complete First Daily Set',
    description: 'Finish all three daily duties in one day.',
    icon: 'checkmark-circle-outline',
    reward: { crowns: 75 },
    isDone: (p) => (p?.daily_rounds?.weekly_days_completed ?? 0) >= 1,
  },
  {
    id: 'ms_first_weekly',
    label: 'Complete First Weekly Set',
    description: 'Claim the weekly clinical growth reward.',
    icon: 'ribbon-outline',
    reward: { codexShards: 100 },
    isDone: (p) => !!(p?.daily_rounds?.weekly_all_complete_claimed),
  },
  // P3: Journey Map-aligned milestones — tied to the Chapter 1 node progression.
  {
    id: 'ms_journey_c1_battle',
    label: 'First Ward Shift Victory',
    description: 'Claim the Journey Map reward for winning your first clinical battle.',
    icon: 'shield-checkmark-outline',
    reward: { crowns: 100, heroXp: 20 },
    isDone: (p) => (p?.claimed_journey_nodes ?? []).includes('c1n4'),
  },
  {
    id: 'ms_journey_c1_all',
    label: 'Chapter 1 Journey Complete',
    description: 'Claim all six Chapter 1 Journey Map node rewards.',
    icon: 'map-outline',
    // P6 — Chapter 1 journey complete is a major milestone: big currency reward,
    // no XP boost (XP from battle nodes already compensated the player during play).
    reward: { codexShards: 100, crowns: 150 },
    isDone: (p) => {
      const claimed: string[] = p?.claimed_journey_nodes ?? [];
      return ['c1n1','c1n2','c1n3','c1n4','c1n5','c1n6'].every((id: string) => claimed.includes(id));
    },
  },
  {
    id: 'ms_hero_skill',
    label: 'First Skill Upgrade',
    description: 'Upgrade a hero skill at the Skill Academy.',
    icon: 'flash-outline',
    reward: { universityCredits: 75 },
    isDone: (p) => Object.keys(p?.hero_skill_upgrades ?? {}).length > 0,
  },
  {
    id: 'ms_streak_7',
    label: 'Seven-Day Healing Streak',
    description: 'Log in for 7 consecutive days.',
    icon: 'flame-outline',
    reward: { codexShards: 75, crowns: 125 },
    isDone: (p) => (p?.daily_rounds?.streak_count ?? 0) >= 7,
  },
  // ── Task 270 — Equipment acquisition milestones ──────────────────────────
  {
    id: 'ms_equip_lotus_lamp_wick',
    label: 'Ward Healer',
    description: 'Complete 3 Ward Shift runs to earn the Lotus Lamp Wick.',
    icon: 'flame-outline',
    reward: { crowns: 50, equipmentItems: ['lotus_lamp_wick'] },
    isDone: (p) => (p?.runs_completed ?? 0) >= 3,
  },
  {
    id: 'ms_equip_culture_lens',
    label: 'University Practitioner',
    description: 'Complete 5 University lessons or practice sessions to earn the Culture Lens.',
    icon: 'school-outline',
    reward: { universityCredits: 50, equipmentItems: ['culture_lens'] },
    isDone: (p) =>
      ((p?.lessons_completed?.length ?? 0) +
        (p?.uni_cue_lab_count ?? 0) +
        (p?.uni_triage_count ?? 0) +
        (p?.uni_stack_count ?? 0)) >= 5,
  },
  {
    id: 'ms_equip_triage_sash',
    label: 'Boss Vanquisher',
    description: 'Defeat a boss in Ward Shift to earn the Triage Sash.',
    icon: 'shield-checkmark-outline',
    reward: { crowns: 75, equipmentItems: ['triage_sash'] },
    isDone: (p) => (p?.bosses_defeated?.length ?? 0) >= 1,
  },
  {
    id: 'ms_equip_apothecary_seal',
    label: 'Seasoned Practitioner',
    description: 'Complete 5 Ward Shift runs to earn the Apothecary Seal.',
    icon: 'flask-outline',
    reward: { crowns: 60, equipmentItems: ['apothecary_seal'] },
    isDone: (p) => (p?.runs_completed ?? 0) >= 5,
  },
  {
    id: 'ms_equip_field_coordinator_badge',
    label: 'Daily Coordinator',
    description: 'Complete your first full Daily Ward Rounds set to earn the Field Coordinator Badge.',
    icon: 'ribbon-outline',
    reward: { crowns: 50, equipmentItems: ['field_coordinator_badge'] },
    isDone: (p) => (p?.daily_rounds?.weekly_days_completed ?? 0) >= 1,
  },
];

// ---------- Login streak reward cycle ----------
export const STREAK_REWARD_CYCLE: DailyReward[] = [
  { crowns: 40 },
  { crowns: 60 },
  { crowns: 80, codexShards: 10 },
  { crowns: 100 },
  { crowns: 120, codexShards: 15 },
  { crowns: 150 },
  { crowns: 200, codexShards: 25, insightCrystals: 1 },
];

export function streakRewardForDay(streak: number): DailyReward {
  if (streak <= 0) return STREAK_REWARD_CYCLE[0];
  return STREAK_REWARD_CYCLE[(streak - 1) % STREAK_REWARD_CYCLE.length];
}

// ---------- Persisted state ----------
export interface DailyObjectiveState {
  id: string;
  /** Canonical registry activity ID for V2 GO navigation. */
  activity_id?: string;
  category?: string;
  route?: string;
  mode: string;
  event: DailyEventType;
  target: number;
  progress: number;
  claimed: boolean;
  label: string;
  description: string;
  icon: string;
  reward: DailyReward;
}

export interface DailyRoundsState {
  /** The sole recurring Daily/Weekly system. Legacy state migrates here once. */
  version: 2;
  /** Server-authoritative V1 entitlement settlement completed. */
  legacy_claims_settled?: boolean;
  /** Immutable server receipt identifier once V1 settlement has completed. */
  legacy_settlement_id?: string;
  streak_count: number;
  last_checkin_date: string;
  daily_date: string;
  objectives: DailyObjectiveState[];
  all_complete_claimed: boolean;
  weekly_key: string;
  weekly_days_completed: number;
  weekly_claimed: boolean;
  weekly_credited_dates: string[];
  // Fix 9 — weekly task system
  weekly_tasks: WeeklyTaskState[];
  weekly_all_complete_claimed: boolean;
  weekly_material_earned: number; // accumulated material events toward w_hero fallback
  /** Number of distinct opportunities needed today (2 early, 3 mature). */
  required_count?: number;
  /** Weekly Momentum acknowledgement markers: "2", "4", and "5". */
  weekly_momentum_claimed?: string[];
}

export function defaultDailyRoundsState(): DailyRoundsState {
  return {
    version: 2,
    streak_count: 0,
    last_checkin_date: '',
    daily_date: '',
    objectives: [],
    all_complete_claimed: false,
    weekly_key: '',
    weekly_days_completed: 0,
    weekly_claimed: false,
    weekly_credited_dates: [],
    weekly_tasks: [],
    weekly_all_complete_claimed: false,
    weekly_material_earned: 0,
    legacy_claims_settled: true,
  };
}

export interface DailyOpportunityInput {
  id: string;
  label: string;
  category: string;
  route?: string;
  dailyMode: string;
}

const ACTIVITY_EVENT: Record<string, DailyEventType> = {
  'university-practice': 'university_lesson',
  'clinical-simulation': 'university_lesson',
  'grand-rounds': 'university_lesson',
  'crisis-drill': 'university_lesson',
  'ward-shift': 'ward_shift_win',
  'ward-defense': 'ward_defense_wave',
  journey: 'journey_node',
  'lotus-journal': 'wellness_log',
  'hero-growth': 'hero_action',
};

function opportunityObjective(input: DailyOpportunityInput): DailyObjectiveState {
  const event = ACTIVITY_EVENT[input.id];
  return {
    id: `activity:${input.id}`,
    activity_id: input.id,
    category: input.category,
    route: input.route,
    mode: input.dailyMode,
    event: event ?? 'university_lesson',
    target: 1,
    progress: 0,
    claimed: false,
    label: input.label,
    description: `Complete a meaningful ${input.label} activity.`,
    icon: input.category === 'learning' ? 'school' : input.category === 'wellness' ? 'leaf' : input.category === 'adventure' ? 'map' : 'medkit',
    reward: {},
  };
}

/** Deterministically choose a 4–6 activity board while taking one activity from
 * each available category before filling the remaining slots. */
export function rollDailyOpportunities(
  eligible: DailyOpportunityInput[],
  seed: number,
): DailyObjectiveState[] {
  const rand = mulberry32(seed);
  const shuffled = [...eligible].sort(() => rand() - 0.5);
  const seenCategories = new Set<string>();
  const varied = shuffled.filter((item) => {
    if (seenCategories.has(item.category)) return false;
    seenCategories.add(item.category);
    return true;
  });
  // Never put two cards that listen to the same completion event on a board:
  // one real completion must only credit one displayed opportunity.
  const rest = shuffled.filter((item) => !varied.includes(item));
  const desired = Math.min(6, Math.max(4, Math.min(eligible.length, 4)));
  return [...varied, ...rest].slice(0, Math.min(desired, eligible.length)).map(opportunityObjective);
}

// ---------- Seeded RNG (stable per player per day) ----------
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toObjectiveState(t: DailyObjectiveTemplate): DailyObjectiveState {
  return { id: t.id, mode: t.mode, event: t.event, target: t.target, progress: 0, claimed: false, label: t.label, description: t.description, icon: t.icon, reward: t.reward };
}

function initWeeklyTasks(): WeeklyTaskState[] {
  return WEEKLY_TASKS.map(t => ({ ...t, progress: 0, claimed: false }));
}

/**
 * Roll up to DAILY_OBJECTIVE_COUNT objectives from the pool, restricted to the
 * player's unlocked modes. Deterministic for a given (unlockedModes, seed).
 */
export function rollDailyObjectives(unlockedModes: string[], seed: number): DailyObjectiveState[] {
  const pool = DAILY_OBJECTIVE_POOL.filter((t) => unlockedModes.includes(t.mode));
  // A legacy account with exactly one unlocked mode must receive one achievable
  // objective, not two variants of the same mode that its old UI described as
  // a single destination.
  if (unlockedModes.length === 1) {
    return pool.slice(0, 1).map((template) => toObjectiveState(
      template.mode === 'ward_shift' ? { ...template, target: 2 } : template,
    ));
  }
  const rand = mulberry32(seed);
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, DAILY_OBJECTIVE_COUNT).map(toObjectiveState);
}

// ---------- Freshness / reset ----------
/**
 * Ensure daily objectives and weekly tasks are fresh for the current day/week.
 * Also backfills weekly_tasks for saves predating Fix 9.
 */
export function ensureFreshDailyRounds(
  state: DailyRoundsState | undefined,
  unlockedModes: string[] | DailyOpportunityInput[],
  playerId: string,
  now: Date = new Date(),
  matureAccount: boolean = false,
): { state: DailyRoundsState; changed: boolean } {
  let s: DailyRoundsState = state ? { ...state, version: 2 } : defaultDailyRoundsState();
  let changed = !state;
  const today = dateKey(now);
  const week = weekKey(now);
  const opportunities = unlockedModes.filter((entry): entry is DailyOpportunityInput => typeof entry !== 'string');
  // Daily Rounds V2 is the only active recurring system. A player without
  // enough receipt-backed opportunities receives an empty V2 board, never a
  // fallback legacy board with an independent reward path.
  const target = matureAccount ? 3 : 2;
  const wasLegacy = !state?.version || state.version !== 2;
  const legacyWeeklySettled = !!state?.weekly_claimed
    || !!state?.weekly_all_complete_claimed
    || !!state?.weekly_tasks?.some((task) => task.claimed);
  const legacyDailySettled = !!state?.all_complete_claimed
    || !!state?.objectives?.some((objective) => objective.claimed);
  const legacyEarnedUnclaimed = wasLegacy && (
    !!state?.objectives?.some((objective) => !objective.claimed && objective.progress >= objective.target)
    || !!state?.weekly_tasks?.some((task) => !task.claimed && task.progress >= task.target)
    || (!!state?.objectives?.length && !state?.all_complete_claimed
      && state.objectives.every((objective) => objective.progress >= objective.target))
    || (!!state?.weekly_tasks?.length && !state?.weekly_all_complete_claimed
      && state.weekly_tasks.every((task) => task.progress >= task.target))
  );
  if (s.daily_date !== today || wasLegacy) {
    const seed = hashSeed(`${playerId || 'clinica'}:${today}`);
    s.objectives = opportunities.length >= target ? rollDailyOpportunities(opportunities, seed) : [];
    // V2 never re-opens legacy reward cards. Earned-but-unclaimed V1 rewards
    // remain explicitly pending until the signed backend settlement records
    // its one-time receipt; clients never apply that currency locally.
    s.all_complete_claimed = s.daily_date === today && legacyDailySettled;
    s.daily_date = today;
    s.required_count = Math.min(target, s.objectives.length);
    s.version = 2;
    s.legacy_claims_settled = !legacyEarnedUnclaimed;
    s.weekly_tasks = [];
    s.weekly_all_complete_claimed = legacyWeeklySettled;
    s.weekly_material_earned = 0;
    if (state?.weekly_key === week && legacyWeeklySettled) s.weekly_momentum_claimed = ['5'];
    changed = true;
  }

  if (s.weekly_key !== week) {
    s.weekly_key = week;
    s.weekly_days_completed = 0;
    s.weekly_claimed = false;
    s.weekly_credited_dates = [];
    s.weekly_tasks = [];
    s.weekly_all_complete_claimed = false;
    s.weekly_material_earned = 0;
    s.weekly_momentum_claimed = [];
    changed = true;
  }

  if (s.weekly_tasks.length || s.weekly_material_earned) {
    s = { ...s, weekly_tasks: [], weekly_material_earned: 0 };
    changed = true;
  }

  return { state: s, changed };
}

// ---------- Login streak ----------
export interface CheckInResult {
  state: DailyRoundsState;
  alreadyCheckedIn: boolean;
  reward: DailyReward | null;
  streakDay: number;
  streakReset: boolean;
}

function prevDateKey(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return dateKey(d);
}

export function checkInDailyRounds(state: DailyRoundsState, now: Date = new Date()): CheckInResult {
  const today = dateKey(now);
  if (state.last_checkin_date === today) {
    return { state, alreadyCheckedIn: true, reward: null, streakDay: state.streak_count, streakReset: false };
  }
  const consecutive = state.last_checkin_date === prevDateKey(now) && state.streak_count > 0;
  const newStreak = consecutive ? state.streak_count + 1 : 1;
  return {
    state: { ...state, streak_count: newStreak, last_checkin_date: today },
    alreadyCheckedIn: false,
    // Streak is motivational state only. Recurring Daily/Weekly rewards are
    // exclusively the receipt-backed V2 Stamina recoveries.
    reward: null,
    streakDay: newStreak,
    streakReset: !consecutive && state.last_checkin_date !== '',
  };
}

export function hasCheckedInToday(state: DailyRoundsState | undefined, now: Date = new Date()): boolean {
  if (!state) return false;
  return state.last_checkin_date === dateKey(now);
}

// ---------- Objective progress ----------
export function allObjectivesComplete(state: DailyRoundsState): boolean {
  const required = state.required_count ?? state.objectives.length;
  return required > 0 && state.objectives.filter((o) => o.progress >= o.target).length >= required;
}

export function allWeeklyTasksComplete(state: DailyRoundsState): boolean {
  return false;
}

/**
 * Record daily objective progress AND weekly task progress for an event.
 * Also credits weekly_days_completed when all daily objectives are complete.
 */
export function recordObjectiveProgress(
  state: DailyRoundsState,
  event: DailyEventType,
  amount: number = 1,
  now: Date = new Date(),
  activityId?: string,
): { state: DailyRoundsState; changed: boolean } {
  if (amount <= 0) return { state, changed: false };
  let changed = false;

  // Daily objectives
  const objectives = state.objectives.map((o) => {
    if (o.event !== event || (state.version === 2 && o.activity_id !== activityId) || o.progress >= o.target) return o;
    changed = true;
    return { ...o, progress: Math.min(o.target, o.progress + amount) };
  });
  let s: DailyRoundsState = changed ? { ...state, objectives } : state;

  // Credit weekly_days_completed once per day when full daily set is complete.
  if (allObjectivesComplete(s)) {
    const today = s.daily_date || dateKey(now);
    if (!s.weekly_credited_dates.includes(today)) {
      s = {
        ...s,
        weekly_credited_dates: [...s.weekly_credited_dates, today],
        weekly_days_completed: s.weekly_days_completed + 1,
      };
      changed = true;
    }
  }

  return { state: s, changed };
}

/**
 * Record weekly task progress for an event (called alongside recordObjectiveProgress).
 */
export function recordWeeklyProgress(
  state: DailyRoundsState,
  event: DailyEventType,
  amount: number = 1,
): { state: DailyRoundsState; changed: boolean } {
  // Weekly Momentum is derived only from distinct completed Daily targets.
  // Legacy fixed-task progress is retired and must never create a payout.
  void event;
  void amount;
  return { state, changed: false };
}

// ---------- Claims ----------
export interface ClaimResult {
  state: DailyRoundsState;
  reward: DailyReward | null;
  message: string;
}

export function claimObjectiveReward(state: DailyRoundsState, objectiveId: string): ClaimResult {
  void objectiveId;
  return { state, reward: null, message: 'V2 opportunities grant credit when completed; finish the daily target for its one Stamina recovery.' };
}

export function claimAllCompleteBonus(state: DailyRoundsState): ClaimResult {
  if (!allObjectivesComplete(state)) return { state, reward: null, message: 'Complete the required opportunities first.' };
  if (state.all_complete_claimed) return { state, reward: null, message: 'Bonus already claimed.' };
  return {
    state: { ...state, all_complete_claimed: true },
    reward: { stamina: 1 },
    message: 'Daily Rounds complete!',
  };
}

export function claimWeeklyTask(state: DailyRoundsState, taskId: string): ClaimResult {
  void taskId;
  return { state, reward: null, message: 'Weekly Momentum is based on distinct completed days.' };
}

export function claimWeeklyAllComplete(state: DailyRoundsState): ClaimResult {
  if (state.weekly_days_completed < WEEKLY_GOAL_TARGET) return { state, reward: null, message: 'Complete Daily Rounds on 5 distinct days first.' };
  if ((state.weekly_momentum_claimed ?? []).includes('5')) return { state, reward: null, message: 'Weekly Momentum already claimed.' };
  return {
    state: { ...state, weekly_momentum_claimed: [...(state.weekly_momentum_claimed ?? []), '5'] },
    reward: { stamina: 5 },
    message: 'Weekly Momentum complete!',
  };
}

// Keep for backward-compat; now delegates to claimWeeklyAllComplete.
export function claimWeeklyReward(state: DailyRoundsState): ClaimResult {
  return claimWeeklyAllComplete(state);
}

// ---------- UI helpers ----------
export function claimableCount(state: DailyRoundsState | undefined): number {
  if (!state) return 0;
  let n = 0;
  if (allObjectivesComplete(state) && !state.all_complete_claimed) n++;
  if (state.weekly_days_completed >= WEEKLY_GOAL_TARGET && !(state.weekly_momentum_claimed ?? []).includes('5')) n++;
  return n;
}

export function checkInAvailable(state: DailyRoundsState | undefined, now: Date = new Date()): boolean {
  return !hasCheckedInToday(state, now);
}

export function msUntilNextDay(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

export function formatCountdown(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function summarizeReward(reward: DailyReward): string {
  const parts: string[] = [];
  if (reward.crowns)             parts.push(`${reward.crowns} Coins`);
  if (reward.codexShards)        parts.push(`${reward.codexShards} Shards`);
  if (reward.universityCredits)  parts.push(`${reward.universityCredits} Credits`);
  if (reward.playerXp)           parts.push(`+${reward.playerXp} XP`);
  if (reward.heroXp)             parts.push(`+${reward.heroXp} Hero XP`);
  if (reward.refinedLotusGems)   parts.push(`${reward.refinedLotusGems} Refined Gems`);
  if (reward.insightCrystals)    parts.push(`${reward.insightCrystals} Crystal${reward.insightCrystals > 1 ? 's' : ''}`);
  if (reward.stamina)            parts.push(`+${reward.stamina} Stamina`);
  return parts.join(' · ') || 'No reward';
}
