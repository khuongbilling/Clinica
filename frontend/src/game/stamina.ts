import { useEffect, useState } from 'react';
import { staminaMaxForLevel } from './progression';

// ---------- SHIFT STAMINA ----------
// Meaningful ward commitments cost stamina; it recovers 1 point per REGEN interval of
// real time, capped at the player's current stamina max. All regen is computed
// lazily from a stored value + timestamp, so nothing needs to run in the background.
//
// The stamina cap follows the slow Age 1 Player Level curve.
export const MAX_STAMINA = staminaMaxForLevel(1);
// Costs are for meaningful commitments, never ordinary movement or discovery.
export const ENCOUNTER_COST = 1;
export const ELITE_ENCOUNTER_COST = 2;
export const AREA_BOSS_ENCOUNTER_COST = 3;
export const BOSS_ENCOUNTER_COST = 5;
// Age 1 pacing: one point every fifteen minutes.
export const REGEN_MINUTES = 15;
export const REGEN_MS = REGEN_MINUTES * 60 * 1000;

export type MeaningfulAction = 'regular' | 'elite' | 'areaBoss' | 'boss' | 'hazard' | 'sweep';
export const STAMINA_COSTS: Record<MeaningfulAction, number> = {
  regular: ENCOUNTER_COST,
  elite: ELITE_ENCOUNTER_COST,
  areaBoss: AREA_BOSS_ENCOUNTER_COST,
  boss: BOSS_ENCOUNTER_COST,
  hazard: ENCOUNTER_COST,
  sweep: ENCOUNTER_COST,
};

export function getWardShiftStaminaCost(difficulty: number): number {
  return difficulty >= 3 ? ELITE_ENCOUNTER_COST : ENCOUNTER_COST;
}

export function getJourneyStaminaCost(encounter: string, difficulty = 1): number {
  if (encounter === 'areaBoss') return AREA_BOSS_ENCOUNTER_COST;
  if (encounter === 'battle') return getWardShiftStaminaCost(difficulty);
  return 0;
}

/** Resolve the stamina cap for a player, derived from Player Level. */
export function maxStaminaForPlayer(player: { player_level?: number } | null | undefined): number {
  return staminaMaxForLevel(player?.player_level ?? 1);
}

export interface StaminaState {
  stamina: number;
  updatedAt: string; // ISO timestamp
}

/**
 * Compute the current stamina from a stored value + timestamp.
 * Returns the up-to-date stamina and a normalized timestamp:
 *  - When full, the timer is reset to `now` (no regen accrues at cap).
 *  - When partial, the timestamp is advanced by whole intervals consumed,
 *    carrying the sub-interval remainder so the countdown stays accurate.
 */
export function regen(stamina: number, updatedAtISO: string, now: number = Date.now(), max: number = MAX_STAMINA): StaminaState {
  const clamped = Math.max(0, Math.min(max, Math.floor(stamina)));
  if (clamped >= max) {
    return { stamina: max, updatedAt: new Date(now).toISOString() };
  }
  const last = Date.parse(updatedAtISO);
  const base = Number.isNaN(last) ? now : last;
  const elapsed = Math.max(0, now - base);
  const gained = Math.floor(elapsed / REGEN_MS);
  if (gained <= 0) {
    return { stamina: clamped, updatedAt: updatedAtISO };
  }
  const next = Math.min(max, clamped + gained);
  if (next >= max) {
    return { stamina: max, updatedAt: new Date(now).toISOString() };
  }
  return { stamina: next, updatedAt: new Date(base + gained * REGEN_MS).toISOString() };
}

/** Milliseconds until the next stamina point (0 if already full). */
export function msUntilNext(stamina: number, updatedAtISO: string, now: number = Date.now(), max: number = MAX_STAMINA): number {
  if (stamina >= max) return 0;
  const last = Date.parse(updatedAtISO);
  const base = Number.isNaN(last) ? now : last;
  return Math.max(0, base + REGEN_MS - now);
}

/** Format a millisecond duration as m:ss (or h:mm:ss for long durations). */
export function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Live-updating stamina for UI. Recomputes on each render and ticks every
 * second while regenerating so countdowns stay current without persisting.
 */
export function useLiveStamina(player: { stamina?: number; stamina_updated_at?: string; player_level?: number } | null) {
  const [, setTick] = useState(0);
  const now = Date.now();
  const max = maxStaminaForPlayer(player);
  const stored = player?.stamina ?? max;
  const updatedAt = player?.stamina_updated_at ?? new Date(now).toISOString();
  const live = regen(stored, updatedAt, now, max);
  const remaining = msUntilNext(live.stamina, live.updatedAt, now, max);
  const full = live.stamina >= max;

  useEffect(() => {
    if (full) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [full]);

  return { stamina: live.stamina, max, msUntilNext: remaining, full };
}
