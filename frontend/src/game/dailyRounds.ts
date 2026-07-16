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
    reward: { crowns: 50, playerXp: 20 },
    isDone: (p) => !!p?.prologue_complete,
  },
  {
    id: 'ms_lotus_recall',
    label: 'Complete Lotus Recall',
    description: 'Follow the memory through the Lotus Recall.',
    icon: 'flower-outline',
    reward: { universityCredits: 30, playerXp: 20 },
    isDone: (p) => !!p?.identity_restored || (p?.story_scenes_seen ?? []).includes('lotus_recall'),
  },
  {
    id: 'ms_identity',
    label: 'Restore Your Identity',
    description: 'Reclaim your name and face in the ward.',
    icon: 'person-circle-outline',
    reward: { universityCredits: 30, playerXp: 20 },
    isDone: (p) => !!p?.identity_restored,
  },
  {
    id: 'ms_class_diagnostic',
    label: 'Complete Class Diagnostic',
    description: 'Take the clinical resonance assessment.',
    icon: 'flask-outline',
    reward: { universityCredits: 40, playerXp: 25 },
    isDone: (p) => !!p?.diagnostic_intro_seen,
  },
  {
    id: 'ms_class_confirm',
    label: 'Confirm Class Assignment',
    description: 'Choose your clinical path in the class tree.',
    icon: 'git-branch-outline',
    reward: { universityCredits: 50, playerXp: 25 },
    isDone: (p) => !!p?.class_tree_id,
  },
  {
    id: 'ms_reminiscence',
    label: 'Complete Reminiscence',
    description: 'Recover the memory of your calling.',
    icon: 'eye-outline',
    reward: { universityCredits: 50, playerXp: 25 },
    isDone: (p) => !!p?.seen_reminiscence,
  },
  {
    id: 'ms_main_hub',
    label: 'Reach the Main Hub',
    description: 'Enter the Shift hub and begin your career.',
    icon: 'home-outline',
    reward: { codexShards: 25, playerXp: 30 },
    isDone: (p) => !!p?.onboarding_complete && !!p?.identity_restored,
  },
  {
    id: 'ms_visit_uni',
    label: 'Visit Clinica University',
    description: 'Open the University and start learning.',
    icon: 'school-outline',
    reward: { universityCredits: 30, playerXp: 20 },
    isDone: (p) => (p?.lessons_completed?.length ?? 0) > 0 || (p?.uni_cue_lab_count ?? 0) > 0,
  },
  {
    id: 'ms_lotus_lesson',
    label: 'Complete First Lotus Lesson',
    description: 'Finish a lesson in Vital Foundations.',
    icon: 'leaf',
    reward: { universityCredits: 50, playerXp: 30 },
    isDone: (p) => (p?.lessons_completed ?? []).some((id: string) => id.startsWith('lotus:')),
  },
  {
    id: 'ms_fading_apprenticeship',
    label: 'Complete The Fading Apprenticeship',
    description: 'Win your first simulation battle.',
    icon: 'shield-checkmark-outline',
    reward: { crowns: 50, playerXp: 30 },
    isDone: (p) => (p?.runs_completed ?? 0) >= 1,
  },
  {
    id: 'ms_journey_map',
    label: 'Enter Chapter 1 Journey Map',
    description: 'Begin your first Journey Map node.',
    icon: 'map-outline',
    reward: { crowns: 50, playerXp: 30 },
    isDone: (p) => (p?.claimed_journey_nodes?.length ?? 0) > 0,
  },
  {
    id: 'ms_first_ward_shift',
    label: 'Complete First Ward Shift',
    description: 'Purify a disease in a clinical simulation case.',
    icon: 'medkit-outline',
    reward: { crowns: 75, playerXp: 30, heroXp: 10 },
    isDone: (p) => (p?.runs_completed ?? 0) >= 1,
  },
  {
    id: 'ms_chapter1',
    label: 'Complete Chapter 1',
    description: 'Advance to Chapter 2 of the healing journey.',
    icon: 'trophy-outline',
    reward: { codexShards: 50, playerXp: 50 },
    isDone: (p) => (p?.chapter_progress ?? 1) >= 2,
  },
  {
    id: 'ms_level2',
    label: 'Reach Level 2',
    description: 'Grow your healer rank through victories.',
    icon: 'trending-up',
    reward: { codexShards: 25, crowns: 50, playerXp: 25 },
    isDone: (p) => playerLevelFromXp(p?.xp ?? 0).level >= 2,
  },
  {
    id: 'ms_summoning_hall',
    label: 'Unlock Summoning Hall',
    description: 'Open the Hall of Heroes and recruit your team.',
    icon: 'people-outline',
    reward: { codexShards: 50, playerXp: 50 },
    isDone: (p) => playerLevelFromXp(p?.xp ?? 0).level >= 2,
  },
  {
    id: 'ms_first_daily',
    label: 'Complete First Daily Set',
    description: 'Finish all three daily duties in one day.',
    icon: 'checkmark-circle-outline',
    reward: { crowns: 50, playerXp: 25 },
    isDone: (p) => (p?.daily_rounds?.weekly_days_completed ?? 0) >= 1,
  },
  {
    id: 'ms_first_weekly',
    label: 'Complete First Weekly Set',
    description: 'Claim the weekly clinical growth reward.',
    icon: 'ribbon-outline',
    reward: { codexShards: 75, playerXp: 50 },
    isDone: (p) => !!(p?.daily_rounds?.weekly_all_complete_claimed),
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
}

export function defaultDailyRoundsState(): DailyRoundsState {
  return {
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
  };
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
  unlockedModes: string[],
  playerId: string,
  now: Date = new Date(),
): { state: DailyRoundsState; changed: boolean } {
  let s: DailyRoundsState = state ? { ...state } : defaultDailyRoundsState();
  let changed = !state;
  const today = dateKey(now);
  const week = weekKey(now);

  if (s.daily_date !== today) {
    const seed = hashSeed(`${playerId || 'clinica'}:${today}`);
    s.objectives = rollDailyObjectives(unlockedModes, seed);
    s.all_complete_claimed = false;
    s.daily_date = today;
    changed = true;
  }

  if (s.weekly_key !== week) {
    s.weekly_key = week;
    s.weekly_days_completed = 0;
    s.weekly_claimed = false;
    s.weekly_credited_dates = [];
    s.weekly_tasks = initWeeklyTasks();
    s.weekly_all_complete_claimed = false;
    s.weekly_material_earned = 0;
    changed = true;
  }

  // Backfill weekly_tasks for pre-Fix9 saves that have a valid week but no tasks.
  if (!s.weekly_tasks?.length) {
    s = {
      ...s,
      weekly_tasks: initWeeklyTasks(),
      weekly_all_complete_claimed: s.weekly_all_complete_claimed ?? false,
      weekly_material_earned: s.weekly_material_earned ?? 0,
    };
    changed = true;
  }

  // Sync w_daily_sets progress from weekly_days_completed.
  const dsIdx = s.weekly_tasks.findIndex(t => t.id === 'w_daily_sets');
  if (dsIdx >= 0) {
    const dsTask = s.weekly_tasks[dsIdx];
    const expected = Math.min(dsTask.target, s.weekly_days_completed);
    if (dsTask.progress !== expected) {
      const wt = [...s.weekly_tasks];
      wt[dsIdx] = { ...dsTask, progress: expected };
      s = { ...s, weekly_tasks: wt };
      changed = true;
    }
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
  const reward = streakRewardForDay(newStreak);
  return {
    state: { ...state, streak_count: newStreak, last_checkin_date: today },
    alreadyCheckedIn: false,
    reward,
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
  return state.objectives.length > 0 && state.objectives.every((o) => o.progress >= o.target);
}

export function allWeeklyTasksComplete(state: DailyRoundsState): boolean {
  return (state.weekly_tasks ?? []).length > 0 && (state.weekly_tasks ?? []).every(t => t.progress >= t.target);
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
): { state: DailyRoundsState; changed: boolean } {
  if (amount <= 0) return { state, changed: false };
  let changed = false;

  // Daily objectives
  const objectives = state.objectives.map((o) => {
    if (o.event !== event || o.progress >= o.target) return o;
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
      // Sync w_daily_sets weekly task progress
      const dsIdx = (s.weekly_tasks ?? []).findIndex(t => t.id === 'w_daily_sets');
      if (dsIdx >= 0) {
        const dsTask = s.weekly_tasks[dsIdx];
        const newProg = Math.min(dsTask.target, s.weekly_days_completed);
        if (dsTask.progress < newProg) {
          const wt = [...s.weekly_tasks];
          wt[dsIdx] = { ...dsTask, progress: newProg };
          s = { ...s, weekly_tasks: wt };
        }
      }
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
  const tasks = state.weekly_tasks ?? [];
  if (!tasks.length) return { state, changed: false };

  let changed = false;
  let weekly_tasks = [...tasks];
  let weekly_material_earned = state.weekly_material_earned ?? 0;

  function advance(id: string, amt: number = 1) {
    const idx = weekly_tasks.findIndex(t => t.id === id);
    if (idx < 0) return;
    const t = weekly_tasks[idx];
    if (t.progress >= t.target) return;
    weekly_tasks[idx] = { ...t, progress: Math.min(t.target, t.progress + amt) };
    changed = true;
  }

  switch (event) {
    case 'university_lesson':
      advance('w_university');
      break;
    case 'ward_shift_win':
    case 'journey_node':
      advance('w_battles');
      break;
    case 'hero_action':
      advance('w_hero');
      break;
    case 'material_earned': {
      // Hero-growth fallback: 3 materials = done, only if hero_action hasn't already completed it.
      const heroTask = weekly_tasks.find(t => t.id === 'w_hero');
      if (heroTask && heroTask.progress < heroTask.target) {
        weekly_material_earned = (weekly_material_earned + amount);
        if (weekly_material_earned >= 3) advance('w_hero');
        changed = true; // track the count even if not yet at threshold
      }
      break;
    }
    default:
      break;
  }

  if (!changed) return { state, changed: false };
  return { state: { ...state, weekly_tasks, weekly_material_earned }, changed: true };
}

// ---------- Claims ----------
export interface ClaimResult {
  state: DailyRoundsState;
  reward: DailyReward | null;
  message: string;
}

export function claimObjectiveReward(state: DailyRoundsState, objectiveId: string): ClaimResult {
  const idx = state.objectives.findIndex((o) => o.id === objectiveId);
  if (idx < 0) return { state, reward: null, message: 'Unknown objective.' };
  const obj = state.objectives[idx];
  if (obj.progress < obj.target) return { state, reward: null, message: 'Objective not complete yet.' };
  if (obj.claimed) return { state, reward: null, message: 'Already claimed.' };
  const objectives = [...state.objectives];
  objectives[idx] = { ...obj, claimed: true };
  return { state: { ...state, objectives }, reward: obj.reward, message: 'Reward claimed!' };
}

export function claimAllCompleteBonus(state: DailyRoundsState): ClaimResult {
  if (!allObjectivesComplete(state)) return { state, reward: null, message: 'Finish all objectives first.' };
  if (state.all_complete_claimed) return { state, reward: null, message: 'Bonus already claimed.' };
  return { state: { ...state, all_complete_claimed: true }, reward: ALL_COMPLETE_BONUS, message: 'Daily bonus claimed!' };
}

export function claimWeeklyTask(state: DailyRoundsState, taskId: string): ClaimResult {
  const tasks = state.weekly_tasks ?? [];
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx < 0) return { state, reward: null, message: 'Unknown weekly task.' };
  const task = tasks[idx];
  if (task.progress < task.target) return { state, reward: null, message: 'Task not complete yet.' };
  if (task.claimed) return { state, reward: null, message: 'Already claimed.' };
  const weekly_tasks = [...tasks];
  weekly_tasks[idx] = { ...task, claimed: true };
  return { state: { ...state, weekly_tasks }, reward: task.reward, message: 'Weekly task reward claimed!' };
}

export function claimWeeklyAllComplete(state: DailyRoundsState): ClaimResult {
  if (!allWeeklyTasksComplete(state)) return { state, reward: null, message: 'Complete all weekly tasks first.' };
  if (state.weekly_all_complete_claimed) return { state, reward: null, message: 'Weekly completion bonus already claimed.' };
  return { state: { ...state, weekly_all_complete_claimed: true }, reward: WEEKLY_ALL_COMPLETE_REWARD, message: 'Weekly completion bonus claimed!' };
}

// Keep for backward-compat; now delegates to claimWeeklyAllComplete.
export function claimWeeklyReward(state: DailyRoundsState): ClaimResult {
  return claimWeeklyAllComplete(state);
}

// ---------- UI helpers ----------
export function claimableCount(state: DailyRoundsState | undefined): number {
  if (!state) return 0;
  let n = 0;
  for (const o of state.objectives) if (o.progress >= o.target && !o.claimed) n++;
  if (allObjectivesComplete(state) && !state.all_complete_claimed) n++;
  for (const t of state.weekly_tasks ?? []) if (t.progress >= t.target && !t.claimed) n++;
  if (allWeeklyTasksComplete(state) && !state.weekly_all_complete_claimed) n++;
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
  return parts.join(' · ') || 'No reward';
}
