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
import { CHAPTER_ELITE_RATE_BP, getChapterContent, isAge1Chapter } from '../chapterContent';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TreasureReward {
  xp:     number;
  crowns: number;
  shards: number;
  inventory?: Record<string, number>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Loot table keyed by chest tier. */
export const TREASURE_REWARDS: Record<ChestTier, TreasureReward> = {
  bronze: { xp: 0, crowns:  25, shards: 0, inventory: { 'Lab Token': 1 } },
  silver: { xp: 0, crowns:  75, shards: 2, inventory: { 'Lab Token': 2 } },
  gold:   { xp: 0, crowns: 150, shards: 5, inventory: { 'Lab Token': 3 } },
};

// ── Chapter enemy pools (deterministic seeded picks) ─────────────────────────

/**
 * Chapter → normal battle enemy pool.
 * The pool entries are real enemy IDs from content.ts, matching the chapter's
 * difficulty range.  Derived via fnv1a hash of (seed + ':' + tileId) so the
 * same tile always yields the same enemy for a given run.
 */
export const CHAPTER_BATTLE_POOL: Record<number, readonly string[]> = Object.fromEntries(
  Array.from({ length: 10 }, (_, index) => {
    const chapter = index + 1;
    return [chapter, getChapterContent(chapter).normal.map(entry => entry.id)];
  }),
);
export const CHAPTER_AREA_BOSS: Record<number, string> = Object.fromEntries(
  Array.from({ length: 10 }, (_, index) => {
    const chapter = index + 1;
    return [chapter, getChapterContent(chapter).areaBoss.id];
  }),
);
export const CHAPTER_BOSS: Record<number, string> = Object.fromEntries(
  Array.from({ length: 10 }, (_, index) => {
    const chapter = index + 1;
    return [chapter, getChapterContent(chapter).chapterBoss.id];
  }),
);

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
  if (!isAge1Chapter(chapterId)) {
    throw new Error(`[encounterResolution] missing Age 1 battle package for chapter ${chapterId}`);
  }
  const content = getChapterContent(chapterId);
  if (isEliteBattle(runSeed, tileId, chapterId)) return content.elite.id;
  const pool = content.normal;
  const hash = fnv1a32(`${runSeed}:${tileId}`);
  return pool[hash % pool.length].id;
}

/** Return the fixed area-boss enemy for a chapter. */
export function getAreaBossEnemyId(chapterId: number): string {
  return getChapterContent(chapterId).areaBoss.id;
}

/**
 * Area-boss battles are chapter-owned, not URL-owned. A saved route or an
 * out-of-date client may still carry an old `enemyId`, so only a valid journey
 * chapter is allowed to choose the enemy for an area-boss return path.
 */
export function resolveJourneyAreaBossEnemyId(
  requestedEnemyId: string | undefined,
  journeyChapterId: string | number | undefined,
  isAreaBoss: boolean,
): string | undefined {
  const chapterId = Number(journeyChapterId);
  if (!isAreaBoss || !Number.isInteger(chapterId) || chapterId < 1) {
    return requestedEnemyId;
  }
  return getAreaBossEnemyId(chapterId);
}

/** Return the fixed chapter-boss (gate encounter) enemy for a chapter. */
export function getChapterBossEnemyId(chapterId: number): string {
  return getChapterContent(chapterId).chapterBoss.id;
}

/** Elite is metadata on a battle tile, never a separate map encounter type. */
export function isEliteBattle(runSeed: string, tileId: string, chapterId: number): boolean {
  if (!isAge1Chapter(chapterId)) return false;
  return fnv1a32(`${runSeed}:${tileId}:elite`) % 10_000 < CHAPTER_ELITE_RATE_BP;
}

export function getBattleEncounter(runSeed: string, tileId: string, chapterId: number) {
  const elite = isEliteBattle(runSeed, tileId, chapterId);
  const content = getChapterContent(chapterId);
  const enemyId = deriveEnemyId(runSeed, tileId, chapterId);
  const entry = elite ? content.elite : content.normal.find(enemy => enemy.id === enemyId)!;
  return { enemyId, elite, label: entry.name };
}

export type BossCacheKind = 'areaBoss' | 'chapterBoss';

/** Separate area and chapter cache profiles; rechallenges deliberately award no XP. */
export function getBossCacheReward(chapterId: number, kind: BossCacheKind, firstClear: boolean): TreasureReward {
  const chapter = Math.max(1, Math.min(10, chapterId));
  const major = kind === 'chapterBoss';
  return {
    xp: firstClear ? chapter * (major ? 35 : 15) : 0,
    crowns: chapter * (major ? 80 : 40),
    shards: chapter * (major ? 3 : 1),
    inventory: { 'Lab Token': major ? 3 : 1 },
  };
}

export function getTreasureReward(tier: ChestTier, chapterId: number): TreasureReward {
  const base = TREASURE_REWARDS[tier];
  const chapter = Math.max(1, Math.min(10, chapterId));
  return {
    xp: 0,
    crowns: base.crowns + (chapter - 1) * (tier === 'gold' ? 14 : tier === 'silver' ? 8 : 4),
    shards: base.shards + Math.floor((chapter - 1) / (tier === 'bronze' ? 5 : 3)),
    inventory: { 'Lab Token': (base.inventory?.['Lab Token'] ?? 0) + Math.floor((chapter - 1) / 4) },
  };
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
    return { run, rewards: { xp: 0, crowns: 0, shards: 0, inventory: {} } };
  }

  const tier: ChestTier = tile.chestTier ?? 'bronze';
  const rewards = getTreasureReward(tier, run.chapterId);

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
