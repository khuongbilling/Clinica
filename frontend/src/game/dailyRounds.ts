// ────────────────────────────────────────────────────────────
// DAILY WARD ROUNDS — free-to-earn daily engagement backbone.
//
// Pure logic only: this module never touches the store, currencies, or the
// network directly. It computes the next DailyRoundsState + the reward a
// caller should hand to the existing player-update pipeline (store.tsx folds
// the returned currency deltas into crowns / codex_shards / insight_crystals).
//
// Three loops, all strictly free-to-earn (no new currency, no monetization):
//   1. Login streak — increments once per calendar day, resets on a missed day.
//   2. Three daily objectives — rolled from a pool filtered to the modes the
//      player has actually unlocked; progress auto-fills as they play; each
//      grants a reward and finishing all three grants a small bonus.
//   3. A weekly goal — "complete daily rounds N days this week" — resets at the
//      start of each ISO week (reusing wellness weekKey) with a bigger reward.
//
// Day/week reset reuses wellness.ts dateKey()/weekKey() so every recurring
// system in Clinica shares one calendar-day / ISO-week definition.
// ────────────────────────────────────────────────────────────

import { dateKey, weekKey } from './wellness';

// ---------- Reward shape (existing currencies only) ----------
export interface DailyReward {
  crowns?: number;
  codexShards?: number;
  insightCrystals?: number;
}

// Progress-event types. Each maps to a completion point that already exists in
// the game's flow (see store.tsx hook points). Objectives filter on these.
export type DailyEventType =
  | 'ward_shift_win'    // a Ward Shift / clinical battle completed (applyRewards)
  | 'ward_defense_wave' // Ward Defense waves cleared (recordWardWaves)
  | 'university_lesson' // a University lesson completed (completeLesson)
  | 'wellness_log'      // a Lotus Plate Journal activity logged (logWellnessActivity)
  | 'hero_action';      // a hero recruited / summoned / trained / evolved

// ---------- Objective pool ----------
// One template per unlocked mode (at most one objective per mode per day) so
// objectives always spread the player across different systems. `mode` is the
// FEATURE_UNLOCKS id used to gate whether this objective can appear at all.
export interface DailyObjectiveTemplate {
  id: string;
  mode: string; // FEATURE_UNLOCKS feature id
  event: DailyEventType;
  target: number;
  label: string;
  description: string;
  icon: string; // Ionicons glyph
  reward: DailyReward;
}

export const DAILY_OBJECTIVE_POOL: DailyObjectiveTemplate[] = [
  {
    id: 'obj_ward_shift',
    mode: 'ward_shift',
    event: 'ward_shift_win',
    target: 2,
    label: 'Answer the Ward',
    description: 'Complete 2 Ward Shift battles.',
    icon: 'medkit',
    reward: { crowns: 80, codexShards: 10 },
  },
  {
    id: 'obj_ward_defense',
    mode: 'ward_defense',
    event: 'ward_defense_wave',
    target: 3,
    label: 'Hold the Line',
    description: 'Clear 3 Ward Defense waves.',
    icon: 'shield-half',
    reward: { crowns: 70, codexShards: 10 },
  },
  {
    id: 'obj_university',
    mode: 'university',
    event: 'university_lesson',
    target: 1,
    label: 'Study the Body',
    description: 'Complete 1 University lesson.',
    icon: 'school',
    reward: { crowns: 60, codexShards: 15 },
  },
  {
    id: 'obj_lotus_journal',
    mode: 'lotus_journal',
    event: 'wellness_log',
    target: 2,
    label: 'Tend the Garden',
    description: 'Log 2 wellness activities in the Journal.',
    icon: 'leaf',
    reward: { crowns: 50, insightCrystals: 1 },
  },
  {
    id: 'obj_hall_of_heroes',
    mode: 'hall_of_heroes',
    event: 'hero_action',
    target: 1,
    label: 'Rally a Hero',
    description: 'Recruit, summon, train, or evolve a hero.',
    icon: 'people',
    reward: { crowns: 70, codexShards: 10 },
  },
];

export const DAILY_OBJECTIVE_COUNT = 3;

// Bonus for finishing all of the day's objectives.
export const ALL_COMPLETE_BONUS: DailyReward = { crowns: 120, insightCrystals: 1 };

// ---------- Weekly goal ----------
export const WEEKLY_GOAL_TARGET = 5; // complete daily rounds on 5 days this week
export const WEEKLY_GOAL_REWARD: DailyReward = { crowns: 300, codexShards: 40, insightCrystals: 3 };

// ---------- Login streak reward cycle (escalating, repeats weekly) ----------
// Day 1 is small; rewards grow across a 7-day cycle and reset to the day-1
// tier on the 8th consecutive day, so the streak always feels like it climbs.
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
  last_checkin_date: string; // dateKey of the last check-in ('' if never)
  daily_date: string;        // dateKey the current objectives belong to
  objectives: DailyObjectiveState[];
  all_complete_claimed: boolean;
  weekly_key: string;        // weekKey the weekly goal belongs to
  weekly_days_completed: number;
  weekly_claimed: boolean;
  weekly_credited_dates: string[]; // dates already counted toward the weekly goal
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
  return {
    id: t.id,
    mode: t.mode,
    event: t.event,
    target: t.target,
    progress: 0,
    claimed: false,
    label: t.label,
    description: t.description,
    icon: t.icon,
    reward: t.reward,
  };
}

/**
 * Roll up to DAILY_OBJECTIVE_COUNT objectives from the pool, restricted to the
 * player's unlocked modes. Deterministic for a given (unlockedModes, seed) so
 * the same day never reshuffles between renders. If fewer than three modes are
 * unlocked (e.g. a newer player), fewer objectives are produced — locked modes
 * never surface as objectives.
 */
export function rollDailyObjectives(unlockedModes: string[], seed: number): DailyObjectiveState[] {
  const pool = DAILY_OBJECTIVE_POOL.filter((t) => unlockedModes.includes(t.mode));
  const rand = mulberry32(seed);
  // Fisher–Yates with the seeded RNG.
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, DAILY_OBJECTIVE_COUNT).map(toObjectiveState);
}

// ---------- Freshness / reset ----------
/**
 * Reset the daily objective set at the start of a new calendar day and the
 * weekly goal at the start of a new ISO week. Returns the (possibly) new state
 * and whether anything changed so the caller can decide to persist.
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
  streakReset: boolean; // true when a missed day reset the streak to 1
}

function prevDateKey(now: Date): string {
  // Local-calendar previous day (DST-safe: Date normalizes day-1 overflow).
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return dateKey(d);
}

/**
 * Perform the once-per-day login check-in. Increments the streak if yesterday
 * was the last check-in, resets to 1 if a day was missed, and no-ops if already
 * checked in today. Caller should ensureFreshDailyRounds first.
 */
export function checkInDailyRounds(state: DailyRoundsState, now: Date = new Date()): CheckInResult {
  const today = dateKey(now);
  if (state.last_checkin_date === today) {
    return {
      state,
      alreadyCheckedIn: true,
      reward: null,
      streakDay: state.streak_count,
      streakReset: false,
    };
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

/**
 * Record `amount` progress toward every objective matching `event`. Also
 * credits the weekly goal the first time all of a day's objectives are complete
 * (once per calendar day). Returns the new state and whether anything changed.
 */
export function recordObjectiveProgress(
  state: DailyRoundsState,
  event: DailyEventType,
  amount: number = 1,
  now: Date = new Date(),
): { state: DailyRoundsState; changed: boolean } {
  if (amount <= 0) return { state, changed: false };
  let changed = false;
  const objectives = state.objectives.map((o) => {
    if (o.event !== event || o.progress >= o.target) return o;
    changed = true;
    return { ...o, progress: Math.min(o.target, o.progress + amount) };
  });
  let s: DailyRoundsState = changed ? { ...state, objectives } : state;

  // Credit the weekly goal once per day when the full set is complete.
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

export function claimWeeklyReward(state: DailyRoundsState): ClaimResult {
  if (state.weekly_days_completed < WEEKLY_GOAL_TARGET) {
    return { state, reward: null, message: 'Weekly goal not reached yet.' };
  }
  if (state.weekly_claimed) return { state, reward: null, message: 'Weekly reward already claimed.' };
  return { state: { ...state, weekly_claimed: true }, reward: WEEKLY_GOAL_REWARD, message: 'Weekly reward claimed!' };
}

// ---------- UI helpers ----------
/** Count of currently claimable rewards (objectives + all-complete + weekly). */
export function claimableCount(state: DailyRoundsState | undefined): number {
  if (!state) return 0;
  let n = 0;
  for (const o of state.objectives) if (o.progress >= o.target && !o.claimed) n++;
  if (allObjectivesComplete(state) && !state.all_complete_claimed) n++;
  if (state.weekly_days_completed >= WEEKLY_GOAL_TARGET && !state.weekly_claimed) n++;
  return n;
}

/** True when the player still needs to check in today (drives the badge/pulse). */
export function checkInAvailable(state: DailyRoundsState | undefined, now: Date = new Date()): boolean {
  return !hasCheckedInToday(state, now);
}

/**
 * Milliseconds until the next calendar day (local midnight) for the refresh
 * timer. Must agree with wellness.dateKey/weekKey (all local-calendar) so the
 * countdown flips at the same instant the daily reroll happens.
 */
export function msUntilNextDay(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

/** Format a duration in ms as "Xh Ym" for the "refreshes in" label. */
export function formatCountdown(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function summarizeReward(reward: DailyReward): string {
  const parts: string[] = [];
  if (reward.crowns) parts.push(`${reward.crowns} Crowns`);
  if (reward.codexShards) parts.push(`${reward.codexShards} Codex Shards`);
  if (reward.insightCrystals) parts.push(`${reward.insightCrystals} Insight Crystal${reward.insightCrystals > 1 ? 's' : ''}`);
  return parts.join(' · ') || 'No reward';
}
