/**
 * battleXp.ts — C3: Chapter-aware battle XP, star multipliers, sweep rewards
 *
 * Single source of truth for all XP math that depends on chapter / star rating
 * so battle.tsx, result.tsx, and shift-cases.tsx all share the same numbers.
 */

// ── Chapter XP table ─────────────────────────────────────────────────────────
// [normalBattleXp, finaleOrBossXp] per chapter
// P6 rebalance — Ch1-Ch3 XP cut to prevent reaching Level 4 before meaningful
// Chapter 1 completion.  A 5-battle Ch1 run now gives 75 XP (was 150 XP),
// so Level 4 (637 XP) requires real Ch2 progress or sustained grinding,
// not just a pair of early runs.  Ch4+ unchanged (mid-game, not the concern).
const CHAPTER_XP_TABLE: Record<number, [number, number]> = {
  1:  [15,  20],   // was [30, 35]  — 5-battle run: 75 XP (was 150 XP)
  2:  [25,  32],   // was [40, 50]  — mid-early cap
  3:  [40,  52],   // was [55, 70]  — gentle step up
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
 * The Age 1 repeat-reward budget and 15-minute stamina recovery prevent loss
 * farming from becoming a progression shortcut.
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
 * Experience Scroll drops from a real (non-training, non-prologue) battle win.
 * Returns an array of { key, count } so multiple tiers can drop at once.
 *
 * Rarity ladder (matches university.ts SCROLL_TIERS):
 *   Common (xs/10 XP)   — 1★ normal wins
 *   Uncommon (sm/25 XP) — 2★ normal, 1★ boss
 *   Rare (md/50 XP)     — 3★ normal, 2★ boss
 *   Epic (lg/100 XP)    — 3★ boss ONLY
 *
 * This ensures boss 3★ clears are the exclusive reliable source of the best
 * scrolls, rewarding skilled play without making early scrolls unobtainable.
 */
export function getBattleScrollDrop(
  stars: number,
  isBoss: boolean,
): { key: string; count: number }[] {
  if (stars < 1) return [];   // loss → nothing
  if (isBoss) {
    if (stars >= 3) return [{ key: 'exp_scroll_lg', count: 1 }]; // epic
    if (stars >= 2) return [{ key: 'exp_scroll_md', count: 1 }]; // rare
    return               [{ key: 'exp_scroll_sm', count: 1 }];   // uncommon
  }
  // Normal (non-boss) battles:
  if (stars >= 3) return [{ key: 'exp_scroll_md', count: 1 }];   // rare
  if (stars >= 2) return [{ key: 'exp_scroll_sm', count: 1 }];   // uncommon
  return               [{ key: 'exp_scroll_xs', count: 1 }];     // common
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
