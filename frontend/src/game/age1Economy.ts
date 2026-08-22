/**
 * Age 1 economy policy.
 *
 * This module deliberately contains no React, storage, or network work.  It
 * gives every repeatable activity the same daily progression-value budget while
 * keeping exploration and low-power activities playable after that budget is
 * exhausted.
 */

export const AGE1_ECONOMY_VERSION = 1;
export const AGE1_REPEAT_FULL_BUDGET = 12;
export const AGE1_REPEAT_REDUCED_BUDGET = 8;
export const AGE1_REPEAT_SHARP_BUDGET = 4;
export const AGE1_REFILL_DAILY_CAP_BARS = 1;

export type Age1RepeatState = {
  age1_reward_day?: string;
  age1_reward_units?: number;
};

export type Age1RepeatResult<T extends Age1RepeatState> = {
  state: T;
  multiplier: number;
  units: number;
};

export function age1DayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Spend repeat-reward budget in regular-equivalent units.
 *
 * The budget is intentionally independent from stamina: paid/refill energy
 * can extend a session but cannot restore progression value for the day.
 */
export function consumeAge1RepeatBudget<T extends Age1RepeatState>(
  source: T,
  units: number,
  now: Date = new Date(),
): Age1RepeatResult<T> {
  const cleanUnits = Math.max(0, Math.round(units));
  const day = age1DayKey(now);
  const used = source.age1_reward_day === day
    ? Math.max(0, Math.round(source.age1_reward_units ?? 0))
    : 0;
  const nextUsed = used + cleanUnits;
  // Multi-unit encounters (elite/area/boss) can cross a tier boundary. Their
  // reward is prorated by the units that land in each tier instead of receiving
  // the full reward at the pre-encounter tier.
  const unitMultiplier = (unitIndex: number) => {
    if (unitIndex < AGE1_REPEAT_FULL_BUDGET) return 1;
    if (unitIndex < AGE1_REPEAT_FULL_BUDGET + AGE1_REPEAT_REDUCED_BUDGET) return 0.45;
    if (unitIndex < AGE1_REPEAT_FULL_BUDGET + AGE1_REPEAT_REDUCED_BUDGET + AGE1_REPEAT_SHARP_BUDGET) return 0.1;
    return 0;
  };
  const multiplier = cleanUnits === 0
    ? 1
    : Array.from({ length: cleanUnits }, (_, offset) => unitMultiplier(used + offset))
      .reduce<number>((sum, value) => sum + value, 0) / cleanUnits;
  return {
    state: { ...source, age1_reward_day: day, age1_reward_units: nextUsed },
    multiplier,
    units: cleanUnits,
  };
}

export function scaledAge1Reward(value: number, multiplier: number): number {
  if (!value || multiplier <= 0) return 0;
  return Math.max(1, Math.round(value * multiplier));
}

export function age1StaminaBonusDay<T extends { age1_stamina_bonus_day?: string; age1_stamina_bonus_sources?: string[] }>(
  source: T,
  sourceId: string,
  amount: number,
  now: Date = new Date(),
): T & { staminaBonus: number } {
  const day = age1DayKey(now);
  const claimed = source.age1_stamina_bonus_day === day
    ? [...(source.age1_stamina_bonus_sources ?? [])]
    : [];
  if (claimed.includes(sourceId)) return { ...source, staminaBonus: 0 };
  return {
    ...source,
    age1_stamina_bonus_day: day,
    age1_stamina_bonus_sources: [...claimed, sourceId],
    staminaBonus: Math.max(0, Math.round(amount)),
  };
}

export function age1WeekKey(now: Date = new Date()): string {
  const d = new Date(now);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function age1WeeklyStaminaBonus<T extends { age1_stamina_bonus_week?: string }>(
  source: T,
  amount: number,
  now: Date = new Date(),
): T & { staminaBonus: number } {
  const week = age1WeekKey(now);
  if (source.age1_stamina_bonus_week === week) return { ...source, staminaBonus: 0 };
  return { ...source, age1_stamina_bonus_week: week, staminaBonus: Math.max(0, Math.round(amount)) };
}