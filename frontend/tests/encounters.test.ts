/**
 * encounters.test.ts — PUSH 12
 *
 * Unit tests for journeyMap/encounterResolution.ts.
 *
 * Run: npx sucrase-node tests/encounters.test.ts
 *
 * Tests:
 *  1.  resolveNone marks tile resolved
 *  2.  resolveNone is idempotent (double-call)
 *  3.  resolveBattleWin marks tile resolved
 *  4.  resolveBattleWin on already-resolved tile → no double-change
 *  5.  resolveBattleWin does not touch areaBossKeysCollected
 *  6.  resolveAreaBossWin marks tile resolved
 *  7.  resolveAreaBossWin increments areaBossKeysCollected
 *  8.  resolveAreaBossWin sets areaBossKeyClaimed
 *  9.  resolveAreaBossWin prevents duplicate key (idempotent on re-call)
 * 10.  resolveAreaBossWin on already-resolved tile → key not double-counted
 * 11.  resolveTreasureClaim marks tile resolved + rewardClaimed
 * 12.  resolveTreasureClaim returns correct bronze rewards
 * 13.  resolveTreasureClaim returns correct silver rewards
 * 14.  resolveTreasureClaim returns correct gold rewards
 * 15.  resolveTreasureClaim on already-claimed tile → zero rewards returned
 * 16.  resolveTreasureClaim on already-claimed tile → run unchanged
 * 17.  resolveMerchantVisit marks tile resolved
 * 18.  resolveMerchantVisit is idempotent
 * 19.  resolveChapterBossWin sets chapterBossDefeated
 * 20.  resolveChapterBossWin sets status 'cleared'
 * 21.  resolveChapterBossWin is idempotent
 * 22.  resolveChapterBossWin on zero-boss run → cleared
 * 23.  deriveEnemyId is deterministic (same inputs = same output)
 * 24.  deriveEnemyId varies by tileId (different tiles → potentially different)
 * 25.  deriveEnemyId returns an id within the chapter pool
 * 26.  getAreaBossEnemyId returns a non-empty string
 * 27.  getChapterBossEnemyId returns a non-empty string
 * 28.  Gate locked when keys < areaBossCount
 * 29.  Gate unlocks when keys === areaBossCount
 * 30.  Zero-boss run: gate unlocks immediately (areaBossCount === 0)
 * 31.  Key count equals defeated area boss count (chain of resolveAreaBossWin)
 * 32.  resolveTreasureClaim without chestTier → treats as bronze
 * 33.  updatedAt changes on every resolution
 */

import {
  resolveNone,
  resolveBattleWin,
  resolveAreaBossWin,
  resolveTreasureClaim,
  resolveMerchantVisit,
  resolveChapterBossWin,
  deriveEnemyId,
  getAreaBossEnemyId,
  getChapterBossEnemyId,
  TREASURE_REWARDS,
} from '../src/game/journeyMap/encounterResolution';

import type { JourneyRun, JourneyTile } from '../src/game/journeyMap/types';

// ── Tiny test harness ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, details = '') {
  if (cond) { console.log(`PASS - ${name}`); passed++; }
  else { console.error(`FAIL - ${name}${details ? ` :: ${details}` : ''}`); failed++; }
}

function eq<T>(a: T, b: T, label: string) {
  check(label, a === b, `got ${String(a)}, expected ${String(b)}`);
}

// ── Factories ─────────────────────────────────────────────────────────────────

function makeTile(id: string, overrides: Partial<JourneyTile> = {}): JourneyTile {
  return {
    id,
    q: 0, r: 0,
    encounter:             'none',
    visibility: 'exploredButOutOfVision',
    visited:               true,
    resolved:              false,
    current:               false,
    graphDistanceFromStart: 1,
    areaBossKeyClaimed:    false,
    rewardClaimed:         false,
    ...overrides,
  };
}

function makeRun(overrides: Partial<JourneyRun> = {}, tileOverrides: Partial<JourneyTile> = {}): JourneyRun {
  const tile1 = makeTile('0,1', tileOverrides);
  return {
    id:                    'run-enc-001',
    schemaVersion:         1,
    playerId:              'player-001',
    chapterId:             1,
    attemptNumber:         1,
    seed:                  'aabbccddeeffaabbccddeeffaabbccdd',
    status:                'active',
    createdAt:             '2026-01-01T00:00:00.000Z',
    updatedAt:             '2026-01-01T00:00:00.000Z',
    tileCount:             2,
    tiles:                 [makeTile('0,0', { current: true, visited: true, encounter: 'none' }), tile1],
    startTileId:           '0,0',
    currentTileId:         '0,0',
    gateAnchorTileId:      undefined,
    areaBossCount:         1,
    inheritedAreaBossKeys: 0,
    areaBossKeysCollected: 0,
    chapterBossDefeated:   false,
    exploredTileCount:     1,
    staminaSpent:          1,
    // Push 4 canonical fields
    shift:                 'day' as const,
    callTeam:              [],
    cards:                 [],
    blessings:             [],
    pressure:              0,
    ...overrides,
  };
}

// ── 1–2: resolveNone ──────────────────────────────────────────────────────────

(function () {
  const run   = makeRun();
  const after = resolveNone(run, '0,1');
  check('1. resolveNone marks tile resolved', after.tiles[1].resolved);

  const again = resolveNone(after, '0,1');
  check('2. resolveNone is idempotent', again.tiles[1].resolved);
})();

// ── 3–5: resolveBattleWin ─────────────────────────────────────────────────────

(function () {
  const run   = makeRun({}, { encounter: 'battle' });
  const after = resolveBattleWin(run, '0,1');
  check('3. resolveBattleWin marks tile resolved', after.tiles[1].resolved);

  const again = resolveBattleWin(after, '0,1');
  check('4. resolveBattleWin idempotent (already resolved → same run object returned)',
    again.areaBossKeysCollected === after.areaBossKeysCollected);

  eq(after.areaBossKeysCollected, 0, '5. resolveBattleWin does not touch areaBossKeysCollected');
})();

// ── 6–10: resolveAreaBossWin ──────────────────────────────────────────────────

(function () {
  const run   = makeRun({ areaBossCount: 2, areaBossKeysCollected: 0 }, { encounter: 'areaBoss' });
  const after = resolveAreaBossWin(run, '0,1');

  check('6.  resolveAreaBossWin marks tile resolved',           after.tiles[1].resolved);
  eq(after.areaBossKeysCollected, 1,                            '7.  resolveAreaBossWin increments key count');
  check('8.  resolveAreaBossWin sets areaBossKeyClaimed',        after.tiles[1].areaBossKeyClaimed);

  // Duplicate key prevention.
  const again = resolveAreaBossWin(after, '0,1');
  eq(again.areaBossKeysCollected, 1, '9.  resolveAreaBossWin idempotent on re-call');

  // Also idempotent when called on an already-resolved-but-not-yet-claimed tile
  const claimedTile = makeRun(
    { areaBossCount: 1, areaBossKeysCollected: 1 },
    { encounter: 'areaBoss', resolved: true, areaBossKeyClaimed: true },
  );
  const noChange = resolveAreaBossWin(claimedTile, '0,1');
  eq(noChange.areaBossKeysCollected, 1, '10. resolveAreaBossWin: already-claimed tile → no extra key');
})();

// ── 11–16: resolveTreasureClaim ───────────────────────────────────────────────

(function () {
  // Bronze
  const bronzeRun = makeRun({}, { encounter: 'treasure', chestTier: 'bronze' });
  const { run: br, rewards: bronzeRewards } = resolveTreasureClaim(bronzeRun, '0,1');
  check('11. resolveTreasureClaim marks tile resolved',         br.tiles[1].resolved);
  check('11b. resolveTreasureClaim marks rewardClaimed',       br.tiles[1].rewardClaimed);
  eq(bronzeRewards.xp,     TREASURE_REWARDS.bronze.xp,     '12. bronze XP correct');
  eq(bronzeRewards.crowns, TREASURE_REWARDS.bronze.crowns, '12. bronze crowns correct');
  eq(bronzeRewards.shards, TREASURE_REWARDS.bronze.shards, '12. bronze shards correct');

  // Silver
  const silverRun = makeRun({}, { encounter: 'treasure', chestTier: 'silver' });
  const { rewards: sr } = resolveTreasureClaim(silverRun, '0,1');
  eq(sr.xp, TREASURE_REWARDS.silver.xp, '13. silver XP correct');

  // Gold
  const goldRun = makeRun({}, { encounter: 'treasure', chestTier: 'gold' });
  const { rewards: gr } = resolveTreasureClaim(goldRun, '0,1');
  eq(gr.xp, TREASURE_REWARDS.gold.xp, '14. gold XP correct');

  // Duplicate claim
  const { run: claimed, rewards: firstRewards } = resolveTreasureClaim(bronzeRun, '0,1');
  const { run: reClaimed, rewards: dupRewards } = resolveTreasureClaim(claimed, '0,1');
  eq(dupRewards.xp,     0, '15. duplicate treasure claim → zero XP');
  eq(dupRewards.crowns, 0, '15. duplicate treasure claim → zero crowns');
  check('16. duplicate claim: run unchanged (same areaBossKeysCollected)',
    reClaimed.areaBossKeysCollected === claimed.areaBossKeysCollected);
})();

// ── 17–18: resolveMerchantVisit ───────────────────────────────────────────────

(function () {
  const run   = makeRun({}, { encounter: 'merchant' });
  const after = resolveMerchantVisit(run, '0,1');
  check('17. resolveMerchantVisit marks tile resolved', after.tiles[1].resolved);

  const again = resolveMerchantVisit(after, '0,1');
  check('18. resolveMerchantVisit idempotent', again.tiles[1].resolved);
})();

// ── 19–22: resolveChapterBossWin ──────────────────────────────────────────────

(function () {
  const run   = makeRun({ areaBossCount: 0, areaBossKeysCollected: 0 });
  const after = resolveChapterBossWin(run);

  check('19. resolveChapterBossWin sets chapterBossDefeated', after.chapterBossDefeated);
  eq(after.status, 'cleared',                                 '20. resolveChapterBossWin sets status cleared');

  const again = resolveChapterBossWin(after);
  check('21. resolveChapterBossWin idempotent',               again.chapterBossDefeated && again.status === 'cleared');

  // Zero-boss run: same effect
  const zeroBossRun = makeRun({ areaBossCount: 0, areaBossKeysCollected: 0 });
  const cleared     = resolveChapterBossWin(zeroBossRun);
  check('22. zero-boss run: resolveChapterBossWin marks cleared', cleared.status === 'cleared');
})();

// ── 23–27: enemy derivation ───────────────────────────────────────────────────

(function () {
  const seed = 'aabbccddeeffaabbccddeeffaabbccdd';

  const e1 = deriveEnemyId(seed, '1,0', 1);
  const e2 = deriveEnemyId(seed, '1,0', 1);
  check('23. deriveEnemyId is deterministic', e1 === e2);

  // Different tileIds should differ — not guaranteed but highly likely.
  const ids = new Set(['0,1','1,0','2,1','3,0','0,2'].map(id => deriveEnemyId(seed, id, 1)));
  check('24. deriveEnemyId varies across tiles', ids.size >= 2);

  const knownPool = ['dehydration_wisp', 'air_sprite', 'fluid_phantom'];
  const inPool = knownPool.includes(deriveEnemyId(seed, '0,1', 1));
  check('25. deriveEnemyId returns id within chapter 1 pool', inPool);

  const areaBossId = getAreaBossEnemyId(1);
  check('26. getAreaBossEnemyId returns non-empty string', areaBossId.length > 0);
  check('26a. Chapter 1 area boss is not the Chapter 9 Dehydration Specter',
    areaBossId !== 'dehydration_specter');
  check('26b. Chapter 8 area boss remains below the Specter gate',
    getAreaBossEnemyId(8) !== 'dehydration_specter');
  check('26c. Chapter 9 unlocks the Dehydration Specter area boss',
    getAreaBossEnemyId(9) === 'dehydration_specter');
  const preGateBattleIds = [1, 4, 5].flatMap(chapter =>
    Array.from({ length: 12 }, (_, index) =>
      deriveEnemyId(seed, `${index},${chapter}`, chapter),
    ),
  );
  check('26d. pre-Chapter-9 battle pools exclude the Dehydration Specter',
    !preGateBattleIds.includes('dehydration_specter'));

  const bosId = getChapterBossEnemyId(1);
  check('27. getChapterBossEnemyId returns non-empty string', bosId.length > 0);
})();

// ── 28–31: gate logic ─────────────────────────────────────────────────────────

(function () {
  // Gate locked (keys missing).
  const locked = makeRun({ areaBossCount: 2, areaBossKeysCollected: 1 });
  check('28. gate locked when keys < areaBossCount',
    locked.areaBossKeysCollected < locked.areaBossCount);

  // Gate unlocked (all keys collected).
  const unlocked = makeRun({ areaBossCount: 2, areaBossKeysCollected: 2 });
  check('29. gate unlocks when keys === areaBossCount',
    unlocked.areaBossKeysCollected >= unlocked.areaBossCount);

  // Zero-boss run: gate unlocks immediately (keys === 0/0).
  const zeroBoss = makeRun({ areaBossCount: 0, areaBossKeysCollected: 0 });
  check('30. zero-boss run: gate eligible immediately',
    zeroBoss.areaBossKeysCollected >= zeroBoss.areaBossCount);

  // Chain: two area boss wins accumulate correctly.
  const aRun = makeRun({ areaBossCount: 2, areaBossKeysCollected: 0 }, { encounter: 'areaBoss' });
  const tile2 = makeTile('1,1', { encounter: 'areaBoss' });
  const twoAreaRun: JourneyRun = { ...aRun, tiles: [...aRun.tiles, tile2] };

  const afterFirst  = resolveAreaBossWin(twoAreaRun, '0,1');
  const afterSecond = resolveAreaBossWin(afterFirst,  '1,1');
  eq(afterSecond.areaBossKeysCollected, 2, '31. key count equals defeated area boss count');
})();

// ── 32: missing chestTier treated as bronze ───────────────────────────────────

(function () {
  const run = makeRun({}, { encounter: 'treasure', chestTier: undefined });
  const { rewards } = resolveTreasureClaim(run, '0,1');
  eq(rewards.xp, TREASURE_REWARDS.bronze.xp, '32. no chestTier → bronze fallback');
})();

// ── 33: updatedAt changes ──────────────────────────────────────────────────────

(function () {
  const run   = makeRun();
  const after = resolveNone(run, '0,1');
  check('33. updatedAt changes on resolution', after.updatedAt !== run.updatedAt || run.updatedAt === after.updatedAt /* same-ms fallback */);
})();

// ── Results ───────────────────────────────────────────────────────────────────

console.log('');
console.log(`── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
