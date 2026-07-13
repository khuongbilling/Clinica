/**
 * battleXp.ts — C3: Chapter-aware battle XP, star multipliers, sweep rewards
 *
 * Single source of truth for all XP math that depends on chapter / star rating
 * so battle.tsx, result.tsx, and shift-cases.tsx all share the same numbers.
 */

// ── Chapter XP table ─────────────────────────────────────────────────────────
// [normalBattleXp, finaleOrBossXp] per chapter (matches C3 spec exactly)
const CHAPTER_XP_TABLE: Record<number, [number, number]> = {
  1:  [30,  35],
  2:  [40,  50],
  3:  [55,  70],
  4:  [70,  90],
  5:  [90,  115],
  6:  [115, 145],
  7:  [145, 180],
  8:  [180, 225],
  9:  [225, 280],
  10: [300, 400],
};

/**
 * Maps enemy difficulty (1–10) to approximate chapter tier.
 * Enemies not yet linked to a chapter are approximated by difficulty.
 */
function difficultyToChapter(difficulty: number): number {
  return Math.max(1, Math.min(10, Math.round(difficulty)));
}

/**
 * Returns the base XP for a battle.
 * Bosses use the finale column; normal battles use the standard column.
 * Falls back gracefully for difficulties outside 1–10.
 */
export function getBattleBaseXp(difficulty: number, isBoss: boolean): number {
  const chapter = difficultyToChapter(difficulty);
  const row = CHAPTER_XP_TABLE[chapter] ?? [30, 35];
  return isBoss ? row[1] : row[0];
}

// ── Star XP multiplier ───────────────────────────────────────────────────────
/**
 * Strict star-based XP multiplier.
 *   1★ ≈ 33.33%   2★ ≈ 66.67%   3★ = 100%
 * Returns 0 for 0 stars (loss) — handle with LOSS_LEARNING_XP instead.
 */
export function starXpMultiplier(stars: number): number {
  if (stars <= 0) return 0;
  return Math.min(3, stars) / 3;
}

/**
 * Human-readable star multiplier label: "33%", "67%", "100%".
 * Returns "—" for 0 stars.
 */
export function starMultiplierLabel(stars: number): string {
  if (stars <= 0) return "—";
  const pct = Math.round((Math.min(3, stars) / 3) * 100);
  return `${pct}%`;
}

// ── Loss XP ───────────────────────────────────────────────────────────────────
/**
 * Small flat XP awarded on a real (non-training, non-prologue) loss.
 * Stamina cost (1 per attempt, 10 min regen) already gates loss-farming:
 * 8 XP per 10 min is far below sustainable progression.
 */
export const LOSS_LEARNING_XP = 8;

// ── Auto Sweep ───────────────────────────────────────────────────────────────
/** Minimum star rating to unlock sweep for a battle (2★+). */
export const SWEEP_UNLOCK_STARS = 2;

/** Sweep costs the same as a normal Ward Shift encounter. */
export const SWEEP_STAMINA_COST = 1;

/** Whether auto-sweep is unlocked for this battle. */
export function isSweepUnlocked(bestStars: number): boolean {
  return bestStars >= SWEEP_UNLOCK_STARS;
}

/**
 * XP earned from one auto-sweep.
 * Scales with best star rating achieved; no first-clear bonus; no hero XP.
 * 3★ sweep always awards full base XP for that chapter.
 */
export function getSweepXp(baseXp: number, bestStars: number): number {
  return Math.max(1, Math.round(baseXp * starXpMultiplier(bestStars)));
}

/**
 * Ward Coins (crowns) earned from one auto-sweep.
 * Fixed small amount scaled by chapter tier (inferred from base XP).
 */
export function getSweepCrowns(baseXp: number): number {
  if (baseXp >= 250) return 30;
  if (baseXp >= 150) return 20;
  if (baseXp >= 80)  return 14;
  if (baseXp >= 40)  return 10;
  return 8;
}
