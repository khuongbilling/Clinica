import { useEffect, useState } from 'react';

// ---------- SHIFT STAMINA ----------
// Each ward encounter costs stamina; it recovers 1 point per REGEN interval of
// real time, capped at MAX_STAMINA. All regen is computed lazily from a stored
// value + timestamp, so nothing needs to run in the background.

export const MAX_STAMINA = 5;
export const ENCOUNTER_COST = 1;
export const REGEN_MINUTES = 12;
export const REGEN_MS = REGEN_MINUTES * 60 * 1000;

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
export function regen(stamina: number, updatedAtISO: string, now: number = Date.now()): StaminaState {
  const clamped = Math.max(0, Math.min(MAX_STAMINA, Math.floor(stamina)));
  if (clamped >= MAX_STAMINA) {
    return { stamina: MAX_STAMINA, updatedAt: new Date(now).toISOString() };
  }
  const last = Date.parse(updatedAtISO);
  const base = Number.isNaN(last) ? now : last;
  const elapsed = Math.max(0, now - base);
  const gained = Math.floor(elapsed / REGEN_MS);
  if (gained <= 0) {
    return { stamina: clamped, updatedAt: updatedAtISO };
  }
  const next = Math.min(MAX_STAMINA, clamped + gained);
  if (next >= MAX_STAMINA) {
    return { stamina: MAX_STAMINA, updatedAt: new Date(now).toISOString() };
  }
  return { stamina: next, updatedAt: new Date(base + gained * REGEN_MS).toISOString() };
}

/** Milliseconds until the next stamina point (0 if already full). */
export function msUntilNext(stamina: number, updatedAtISO: string, now: number = Date.now()): number {
  if (stamina >= MAX_STAMINA) return 0;
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
export function useLiveStamina(player: { stamina?: number; stamina_updated_at?: string } | null) {
  const [, setTick] = useState(0);
  const now = Date.now();
  const stored = player?.stamina ?? MAX_STAMINA;
  const updatedAt = player?.stamina_updated_at ?? new Date(now).toISOString();
  const live = regen(stored, updatedAt, now);
  const remaining = msUntilNext(live.stamina, live.updatedAt, now);
  const full = live.stamina >= MAX_STAMINA;

  useEffect(() => {
    if (full) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [full]);

  return { stamina: live.stamina, max: MAX_STAMINA, msUntilNext: remaining, full };
}
