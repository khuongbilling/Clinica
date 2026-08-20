/**
 * journeyMap/encounterResolution.ts — PUSH 12
 *
 * Pure encounter resolution functions for the fog-map journey experience.
 * No React, Expo, or I/O — all functions are deterministic from their inputs
 * and safe to call in tests without mocking.
 *
 * RESOLUTION CONTRACT
 * ───────────────────
 * Each resolve* function:
 *   • Accepts an existing JourneyRun and returns a NEW JourneyRun (no mutation).
 *   • Is idempotent — resolving an already-resolved tile is a no-op for the
 *     guarded fields (resolved, areaBossKeyClaimed, rewardClaimed, etc.).
 *   • Never calls network, never deducts stamina — the caller handles I/O.
 *
 * ENEMY DERIVATION
 * ────────────────
 * Enemy IDs within battle/areaBoss tiles are derived deterministically from the
 * run seed + tile id.  This guarantees no reroll after discovery without
 * requiring an extra stored field — the same (seed, tileId, chapter) triple
 * always produces the same enemy.
 *
 * TREASURE REWARDS
 * ────────────────
 * Bronze → 50 XP, 25 crowns, 0 shards
 * Silver → 100 XP, 75 crowns, 2 shards
 * Gold   → 200 XP, 150 crowns, 5 shards
 */

import type { JourneyRun, JourneyTile, ChestTier } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TreasureReward {
  xp:     number;
  crowns: number;
  shards: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Loot table keyed by chest tier. */
export const TREASURE_REWARDS: Record<ChestTier, TreasureReward> = {
  bronze: { xp:  50, crowns:  25, shards: 0 },
  silver: { xp: 100, crowns:  75, shards: 2 },
  gold:   { xp: 200, crowns: 150, shards: 5 },
};

// ── Chapter enemy pools (deterministic seeded picks) ─────────────────────────

/**
 * Chapter → normal battle enemy pool.
 * The pool entries are real enemy IDs from content.ts, matching the chapter's
 * difficulty range.  Derived via fnv1a hash of (seed + ':' + tileId) so the
 * same tile always yields the same enemy for a given run.
 */
const CHAPTER_BATTLE_POOL: Record<number, readonly string[]> = {
  1: ['dehydration_wisp', 'air_sprite', 'fluid_phantom'],
  2: ['fever_imp',        'air_sprite', 'dehydration_wisp'],
  3: ['fever_shade',      'gale_spirit', 'fluid_phantom'],
  4: ['fever_shade',      'gale_spirit', 'fluid_phantom'],
  5: ['gale_spirit',      'fever_shade', 'fluid_phantom'],
};

const DEFAULT_BATTLE_POOL = CHAPTER_BATTLE_POOL[1];

/** Chapter → area-boss enemy (fixed, not seeded — there is exactly one per run). */
const CHAPTER_AREA_BOSS: Record<number, string> = {
  1: 'fluid_phantom',
  2: 'fever_shade',
  3: 'gale_spirit',
  4: 'gale_spirit',
  5: 'fever_shade',
  6: 'gale_spirit',
  7: 'fever_shade',
  8: 'gale_spirit',
  9: 'dehydration_specter',
};

// Chapters after the explicit early-game table inherit the Chapter 9+
// real-world boss.  Keeping the default here is safe because every
// pre-Chapter-9 chapter has an explicit entry above.
const DEFAULT_AREA_BOSS = 'dehydration_specter';

/**
 * Chapter → chapter-boss enemy (the final gate encounter).
 * Uses the prologue boss for early chapters since that is the only fully-wired
 * boss enemy with sprite and scripted result handling.
 */
const CHAPTER_BOSS: Record<number, string> = {
  1: 'silent_infarct',
  2: 'silent_infarct',
  3: 'silent_infarct',
  4: 'silent_infarct',
  5: 'silent_infarct',
};

const DEFAULT_CHAPTER_BOSS = 'silent_infarct';

// ── PRNG helpers ──────────────────────────────────────────────────────────────

/** FNV-1a 32-bit hash — same implementation used by topology/prng.ts. */
function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// ── Enemy derivation ──────────────────────────────────────────────────────────

/**
 * Deterministically derive a normal battle enemy from the run's seed and the
 * tile's stable id.
 *
 * The same (runSeed, tileId, chapterId) triple always returns the same enemyId,
 * satisfying the "no reroll after discovery" requirement without storing the
 * enemy id on the tile.
 */
export function deriveEnemyId(
  runSeed:   string,
  tileId:    string,
  chapterId: number,
): string {
  const pool = CHAPTER_BATTLE_POOL[chapterId] ?? DEFAULT_BATTLE_POOL;
  const hash = fnv1a32(`${runSeed}:${tileId}`);
  return pool[hash % pool.length];
}

/** Return the fixed area-boss enemy for a chapter. */
export function getAreaBossEnemyId(chapterId: number): string {
  return CHAPTER_AREA_BOSS[chapterId] ?? DEFAULT_AREA_BOSS;
}

/** Return the fixed chapter-boss (gate encounter) enemy for a chapter. */
export function getChapterBossEnemyId(chapterId: number): string {
  return CHAPTER_BOSS[chapterId] ?? DEFAULT_CHAPTER_BOSS;
}

// ── Tile helper ───────────────────────────────────────────────────────────────

/** Return a new tile array with the tile at `tileId` patched. */
function patchTile(
  tiles:  JourneyTile[],
  tileId: string,
  patch:  Partial<JourneyTile>,
): JourneyTile[] {
  return tiles.map(t => t.id === tileId ? { ...t, ...patch } : t);
}

/** Stamp the current ISO timestamp onto a run. */
function touch(run: JourneyRun): JourneyRun {
  return { ...run, updatedAt: new Date().toISOString() };
}

// ── Resolution functions ──────────────────────────────────────────────────────

/**
 * Resolve a tile that carries no encounter.
 * Just marks it resolved so it won't be flagged as unresolved in future logic.
 */
export function resolveNone(run: JourneyRun, tileId: string): JourneyRun {
  return touch({
    ...run,
    tiles: patchTile(run.tiles, tileId, { resolved: true }),
  });
}

/**
 * Resolve a normal battle tile after a win.
 * Idempotent — already-resolved tiles are unchanged.
 */
export function resolveBattleWin(run: JourneyRun, tileId: string): JourneyRun {
  const tile = run.tiles.find(t => t.id === tileId);
  if (!tile || tile.resolved) return run;
  return touch({
    ...run,
    tiles: patchTile(run.tiles, tileId, { resolved: true }),
  });
}

/**
 * Resolve an area-boss tile after a win.
 * Awards exactly one key (guarded by `areaBossKeyClaimed`).
 */
export function resolveAreaBossWin(run: JourneyRun, tileId: string): JourneyRun {
  const tile = run.tiles.find(t => t.id === tileId);
  if (!tile) return run;

  const alreadyClaimed = tile.areaBossKeyClaimed;
  const newKeysCollected = alreadyClaimed
    ? run.areaBossKeysCollected
    : run.areaBossKeysCollected + 1;

  return touch({
    ...run,
    areaBossKeysCollected: newKeysCollected,
    tiles: patchTile(run.tiles, tileId, {
      resolved:           true,
      areaBossKeyClaimed: true,
    }),
  });
}

/**
 * Claim the treasure chest on a tile.
 *
 * Returns the updated run and the rewards to grant.
 * If the tile was already claimed, returns the original run and ZERO rewards
 * (duplicate-claim prevention).
 */
export function resolveTreasureClaim(
  run:    JourneyRun,
  tileId: string,
): { run: JourneyRun; rewards: TreasureReward } {
  const tile = run.tiles.find(t => t.id === tileId);

  // Duplicate-claim guard: return zero rewards if already claimed.
  if (!tile || tile.rewardClaimed) {
    return { run, rewards: { xp: 0, crowns: 0, shards: 0 } };
  }

  const tier: ChestTier = tile.chestTier ?? 'bronze';
  const rewards = TREASURE_REWARDS[tier];

  const updatedRun = touch({
    ...run,
    tiles: patchTile(run.tiles, tileId, {
      resolved:      true,
      rewardClaimed: true,
    }),
  });

  return { run: updatedRun, rewards };
}

/**
 * Record that the player has visited the merchant tile.
 * Marks the tile resolved (the merchant remains reachable; the tile is just
 * no longer flagged as an unresolved encounter).
 */
export function resolveMerchantVisit(run: JourneyRun, tileId: string): JourneyRun {
  const tile = run.tiles.find(t => t.id === tileId);
  if (!tile || tile.resolved) return run;
  return touch({
    ...run,
    tiles: patchTile(run.tiles, tileId, { resolved: true }),
  });
}

/**
 * Resolve the chapter-boss encounter after a win.
 * Sets `chapterBossDefeated = true`.  The caller is responsible for also
 * calling `repo.markRunCleared()` to persist `status: 'cleared'`.
 */
export function resolveChapterBossWin(run: JourneyRun): JourneyRun {
  if (run.chapterBossDefeated) return run;
  return touch({
    ...run,
    chapterBossDefeated: true,
    status:              'cleared',
  });
}
