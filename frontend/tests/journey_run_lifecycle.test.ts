/**
 * journey_run_lifecycle.test.ts
 *
 * Unit tests for journeyMap/journeyRunLifecycle.ts.
 *
 * Run: npx sucrase-node tests/journey_run_lifecycle.test.ts
 *
 * All tests use a mock repository — no real database or HTTP required.
 * Async tests run inside a top-level IIFE (sucrase-node uses CJS, not ESM,
 * so top-level await is not available).
 *
 * Covers:
 *  1.  buildInitialJourneyRun — tiles.length === topology.tiles.length
 *  2.  buildInitialJourneyRun — start tile is revealed / visited / current
 *  3.  buildInitialJourneyRun — tiles adjacent to start are 'visibleNow'
 *  4.  buildInitialJourneyRun — gate tile has encounter = 'none'
 *  5.  buildInitialJourneyRun — all encounter types are valid
 *  6.  buildInitialJourneyRun — tileCount = tiles.length - 1 (gate excluded)
 *  7.  buildInitialJourneyRun — areaBossCount matches actual boss tiles
 *  8.  buildInitialJourneyRun — createdAt / updatedAt are ISO strings
 *  9.  generateSecureSeed — returns 32-char hex string
 * 10.  generateSecureSeed — two calls return different values
 * 11.  loadOrCreateJourneyRun — no prior runs → createFirstRun called
 * 12.  loadOrCreateJourneyRun — active run exists → returned unchanged
 * 13.  loadOrCreateJourneyRun — cleared run exists → returned, no new create
 * 14.  loadOrCreateJourneyRun — N concurrent calls → createFirstRun idempotent
 * 15.  loadOrCreateJourneyRun — getLatestRun skipped when active run found
 * 16.  challengeChapter — cleared run → attempt+1, createChallengeRun called
 * 17.  challengeChapter — active run → throws
 * 18.  challengeChapter — no prior run → throws
 * 19.  challengeChapter — different seeds on each new attempt
 * 20.  challengeChapter — double-click race: idempotent, single run persisted
 * 21.  reload returns same seed across multiple loadOrCreate calls
 * 22.  full lifecycle: first → cleared → challenge → second active run
 */

import {
  buildInitialJourneyRun,
  loadOrCreateJourneyRun,
  challengeChapter,
  rechallengeMap,
  generateRunData,
  type IJourneyRunRepository,
} from '../src/game/journeyMap/journeyRunLifecycle';
import { createChapterBossKeyState } from '../src/game/journeyMap/chapterBossKeys';

import { generateHexTopology }     from '../src/game/journeyMap/topology';
import { getChapterHexTopology }   from '../src/game/journeyMap/chapterMapTemplates';
import { assignJourneyEncounters } from '../src/game/journeyMap/encounters';
import { generateSecureSeed }      from '../src/game/journeyMap/secureSeed';
import type { JourneyRun }         from '../src/game/journeyMap/types';

// ── Tiny test harness ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, details = ''): void {
  if (cond) {
    console.log(`PASS - ${name}`);
    passed++;
  } else {
    console.error(`FAIL - ${name}${details ? ` :: ${details}` : ''}`);
    failed++;
  }
}

function eq<T>(a: T, b: T, label: string): void {
  check(label, a === b, `got ${String(a)}, expected ${String(b)}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AXIAL_DIRS = [
  { q:  1, r:  0 }, { q: -1, r:  0 },
  { q:  0, r:  1 }, { q:  0, r: -1 },
  { q:  1, r: -1 }, { q: -1, r:  1 },
];

function neighborKeys(k: string, tileSet: Set<string>): string[] {
  const c = k.indexOf(',');
  const q = Number(k.slice(0, c));
  const r = Number(k.slice(c + 1));
  return AXIAL_DIRS.map(d => `${q + d.q},${r + d.r}`).filter(nk => tileSet.has(nk));
}

function makeId(): string {
  return `run-${Math.random().toString(36).slice(2)}`;
}

/** Build a real run via the full pipeline (no I/O). */
function buildRealRun(opts: {
  playerId:      string;
  chapterId:     number;
  attemptNumber: number;
  seed:          string;
}): JourneyRun {
  const { topology, encounters } = generateRunData(opts.chapterId, opts.seed, 'day');
  return buildInitialJourneyRun({ id: makeId(), shift: 'day', ...opts, topology, encounters });
}

// ── Mock repository ───────────────────────────────────────────────────────────

class MockRepo implements IJourneyRunRepository {
  runs: JourneyRun[]               = [];
  createFirstRunCallCount          = 0;
  createChallengeRunCallCount      = 0;

  constructor(initialRuns: JourneyRun[] = []) {
    this.runs = [...initialRuns];
  }

  async getActiveRun(playerId: string, chapterId: number): Promise<JourneyRun | null> {
    // Return the highest-attempt active run, matching the backend's
    // attempt_number DESC sort on get_active_journey_run.
    const matches = this.runs.filter(
      r => r.playerId === playerId && r.chapterId === chapterId && r.status === 'active',
    );
    if (matches.length === 0) return null;
    return matches.reduce((best, r) => r.attemptNumber > best.attemptNumber ? r : best);
  }

  async getLatestRun(playerId: string, chapterId: number): Promise<JourneyRun | null> {
    const matches = this.runs.filter(
      r => r.playerId === playerId && r.chapterId === chapterId,
    );
    if (matches.length === 0) return null;
    return matches.reduce((best, r) => r.attemptNumber > best.attemptNumber ? r : best);
  }

  async createFirstRun(playerId: string, chapterId: number): Promise<JourneyRun> {
    this.createFirstRunCallCount++;
    const existing = this.runs.find(
      r => r.playerId === playerId && r.chapterId === chapterId && r.attemptNumber === 1,
    );
    if (existing) return existing; // idempotent
    const run = buildRealRun({ playerId, chapterId, attemptNumber: 1, seed: generateSecureSeed() });
    this.runs.push(run);
    return run;
  }

  async createChallengeRun(
    playerId:           string,
    chapterId:          number,
    priorAttemptNumber: number,
  ): Promise<JourneyRun> {
    this.createChallengeRunCallCount++;
    const next = priorAttemptNumber + 1;
    const existing = this.runs.find(
      r => r.playerId === playerId && r.chapterId === chapterId && r.attemptNumber === next,
    );
    if (existing) return existing; // idempotent (simulates atomic backend)
    const run = buildRealRun({ playerId, chapterId, attemptNumber: next, seed: generateSecureSeed() });
    this.runs.push(run);
    return run;
  }

  async saveRun(run: JourneyRun): Promise<JourneyRun> {
    const idx = this.runs.findIndex(r => r.id === run.id);
    if (idx >= 0) this.runs[idx] = run;
    return run;
  }

  async markRunCleared(runId: string): Promise<JourneyRun> {
    const idx = this.runs.findIndex(r => r.id === runId);
    if (idx < 0) throw new Error(`run ${runId} not found`);
    const cleared = { ...this.runs[idx], status: 'cleared' as const };
    this.runs[idx] = cleared;
    return cleared;
  }

  async abandonRun(runId: string): Promise<void> {
    const idx = this.runs.findIndex(r => r.id === runId);
    if (idx < 0) throw new Error(`run ${runId} not found`);
    this.runs[idx] = { ...this.runs[idx], status: 'abandoned' as const };
  }

  async createRechallengeRun(
    playerId:             string,
    chapterId:            number,
    priorAttemptNumber:   number,
    inheritedAreaBossKeys: number,
  ): Promise<JourneyRun> {
    this.createChallengeRunCallCount++;
    const next = priorAttemptNumber + 1;
    const existing = this.runs.find(
      r => r.playerId === playerId && r.chapterId === chapterId && r.attemptNumber === next,
    );
    if (existing) return existing; // idempotent
    const base = buildRealRun({ playerId, chapterId, attemptNumber: next, seed: generateSecureSeed() });
    const run  = { ...base, areaBossKeysCollected: inheritedAreaBossKeys, inheritedAreaBossKeys };
    this.runs.push(run);
    return run;
  }
}

// ── All tests inside one async IIFE ───────────────────────────────────────────
// sucrase-node compiles to CJS; top-level await is not available there.

(async () => {

// ── 1–8: buildInitialJourneyRun ───────────────────────────────────────────────

console.log('\n── buildInitialJourneyRun ──');

{
  const chapter    = 1;
  const seed       = 'build_run_seed';
  const topology   = getChapterHexTopology(chapter);
  const encounters = assignJourneyEncounters({ chapter, seed, topology });
  const run = buildInitialJourneyRun({
    id: 'test-id-1', playerId: 'p1', chapterId: chapter,
    attemptNumber: 1, seed, shift: 'day', topology, encounters,
  });

  const tileSet   = new Set(run.tiles.map(t => t.id));
  const VALID_ENC = new Set(['none','battle','treasure','merchant','areaBoss']);

  // 1. tiles.length
  eq(run.tiles.length, topology.tiles.length, '1. tiles.length = topology size');

  // 2. Start tile state
  const startTile = run.tiles.find(t => t.id === topology.startTileId);
  check('2a. start tile exists', !!startTile);
  check('2b. start.visibility = revealed', startTile?.visibility === 'exploredButOutOfVision');
  check('2c. start.visited = true',        startTile?.visited   === true);
  check('2d. start.current = true',        startTile?.current   === true);

  // 3. Adjacent frontier
  const adjKeys  = new Set(neighborKeys(topology.startTileId, tileSet));
  const adjTiles = run.tiles.filter(t => adjKeys.has(t.id));
  check('3. start-adjacent tiles are frontier',
    adjTiles.length > 0 && adjTiles.every(t => t.visibility === 'visibleNow'),
    adjTiles.map(t => t.visibility).join(','));

  // 4. Gate encounter = none
  const gateTile = run.tiles.find(t => t.id === topology.gateAnchorId);
  check('4a. gate tile exists', !!gateTile);
  eq(gateTile?.encounter, 'none', '4b. gate.encounter = none');

  // 5. All encounters valid
  const badEnc = run.tiles.filter(t => !VALID_ENC.has(t.encounter));
  check('5. all encounter types valid', badEnc.length === 0,
    badEnc.map(t => t.encounter).join(', '));

  // 6. tileCount
  eq(run.tileCount, run.tiles.length - 1, '6. tileCount = tiles.length - 1');

  // 7. areaBossCount
  const actualBosses = run.tiles.filter(t => t.encounter === 'areaBoss').length;
  eq(run.areaBossCount, actualBosses, '7. areaBossCount consistent');

  // 8. Metadata
  check('8a. createdAt is ISO',  !isNaN(Date.parse(run.createdAt)));
  check('8b. updatedAt is ISO',  !isNaN(Date.parse(run.updatedAt)));
  eq(run.status,        'active', '8c. initial status = active');
  eq(run.attemptNumber, 1,        '8d. attemptNumber  = 1');
  eq(run.seed,          seed,     '8e. seed preserved');
}

// ── 9–10: generateSecureSeed ──────────────────────────────────────────────────

console.log('\n── generateSecureSeed ──');

{
  const s1 = generateSecureSeed();
  const s2 = generateSecureSeed();
  check('9.  seed is 32-char lowercase hex', /^[0-9a-f]{32}$/.test(s1), `"${s1}"`);
  check('10. two calls produce different seeds', s1 !== s2);
}

// ── 11–15: loadOrCreateJourneyRun ────────────────────────────────────────────

console.log('\n── loadOrCreateJourneyRun ──');

{
  const P = 'player-A';
  const C = 1;

  // 11. No prior runs → createFirstRun called, active run returned
  {
    const repo = new MockRepo();
    const run  = await loadOrCreateJourneyRun(P, C, repo);
    eq(repo.createFirstRunCallCount, 1, '11a. createFirstRun called once');
    eq(run.status, 'active',            '11b. returned run is active');
    eq(run.attemptNumber, 1,            '11c. attemptNumber = 1');
    check('11d. seed is 32-char hex',   /^[0-9a-f]{32}$/.test(run.seed));
  }

  // 12. Active run exists → returned unchanged, createFirstRun not called
  {
    const existing = buildRealRun({ playerId: P, chapterId: C, attemptNumber: 1, seed: generateSecureSeed() });
    const repo     = new MockRepo([existing]);
    const run      = await loadOrCreateJourneyRun(P, C, repo);
    eq(repo.createFirstRunCallCount, 0, '12a. createFirstRun not called');
    eq(run.id,   existing.id,           '12b. same run returned');
    eq(run.seed, existing.seed,         '12c. seed unchanged');
  }

  // 13. Cleared run, no active → cleared run returned, no new create
  {
    const clearedRun = { ...buildRealRun({ playerId: P, chapterId: C, attemptNumber: 1, seed: generateSecureSeed() }), status: 'cleared' as const };
    const repo       = new MockRepo([clearedRun]);
    const run        = await loadOrCreateJourneyRun(P, C, repo);
    eq(repo.createFirstRunCallCount, 0, '13a. createFirstRun not called');
    eq(run.status, 'cleared',           '13b. cleared run returned');
    eq(run.id,     clearedRun.id,       '13c. same run id');
  }

  // 14. Concurrent calls → idempotent, same run returned each time
  {
    const repo = new MockRepo();
    const [r1, r2, r3] = await Promise.all([
      loadOrCreateJourneyRun(P, C, repo),
      loadOrCreateJourneyRun(P, C, repo),
      loadOrCreateJourneyRun(P, C, repo),
    ]);
    // All three resolve to attempt #1 (mock is idempotent for duplicate creates).
    check('14a. concurrent r1 = r2 ids', r1.id === r2.id);
    check('14b. concurrent r2 = r3 ids', r2.id === r3.id);
    eq(r1.attemptNumber, 1, '14c. attemptNumber = 1 for all');
  }

  // 15. getLatestRun not called when active run found
  {
    let latestCalled = false;
    const existing = buildRealRun({ playerId: P, chapterId: C, attemptNumber: 1, seed: generateSecureSeed() });
    const spyRepo: IJourneyRunRepository = {
      getActiveRun:          async () => existing,
      getLatestRun:          async () => { latestCalled = true; return null; },
      createFirstRun:        async () => { throw new Error('should not call'); },
      createChallengeRun:    async () => { throw new Error('should not call'); },
      createRechallengeRun:  async () => { throw new Error('should not call'); },
      saveRun:               async (r) => r,
      markRunCleared:        async () => { throw new Error('should not call'); },
      abandonRun:            async () => { throw new Error('should not call'); },
    };
    await loadOrCreateJourneyRun(P, C, spyRepo);
    check('15. getLatestRun skipped when active run found', !latestCalled);
  }
}

// ── 16–20: challengeChapter ───────────────────────────────────────────────────

console.log('\n── challengeChapter ──');

{
  const P = 'player-B';
  const C = 1;

  // 16. Cleared run → attempt+1, new active run
  {
    const seed1      = generateSecureSeed();
    const clearedRun = { ...buildRealRun({ playerId: P, chapterId: C, attemptNumber: 1, seed: seed1 }), status: 'cleared' as const };
    const repo       = new MockRepo([clearedRun]);
    const newRun     = await challengeChapter(P, C, repo);
    eq(repo.createChallengeRunCallCount, 1, '16a. createChallengeRun called once');
    eq(newRun.attemptNumber, 2,             '16b. new attemptNumber = 2');
    eq(newRun.status, 'active',             '16c. new run is active');
  }

  // 17. Active run → throws
  {
    const activeRun = buildRealRun({ playerId: P, chapterId: C, attemptNumber: 1, seed: generateSecureSeed() });
    const repo      = new MockRepo([activeRun]);
    let threw = false;
    try { await challengeChapter(P, C, repo); } catch { threw = true; }
    check('17. challengeChapter throws if run is active', threw);
  }

  // 18. No prior run → throws
  {
    const repo = new MockRepo();
    let threw  = false;
    try { await challengeChapter(P, C, repo); } catch { threw = true; }
    check('18. challengeChapter throws if no run exists', threw);
  }

  // 19. Different seeds on each challenge attempt
  {
    const seed1      = generateSecureSeed();
    const clearedRun = { ...buildRealRun({ playerId: P, chapterId: C, attemptNumber: 1, seed: seed1 }), status: 'cleared' as const };
    const repo       = new MockRepo([clearedRun]);
    const newRun     = await challengeChapter(P, C, repo);
    check('19. challenge run has different seed', newRun.seed !== seed1,
      `run1="${seed1}" run2="${newRun.seed}"`);
  }

  // 20. Double-click: concurrent calls return same run, no duplicate persisted
  {
    const seed1      = generateSecureSeed();
    const clearedRun = { ...buildRealRun({ playerId: P, chapterId: C, attemptNumber: 1, seed: seed1 }), status: 'cleared' as const };
    const repo       = new MockRepo([clearedRun]);
    const [runA, runB] = await Promise.all([
      challengeChapter(P, C, repo),
      challengeChapter(P, C, repo),
    ]);
    check('20a. both concurrent calls return same run id', runA.id === runB.id,
      `runA.id=${runA.id} runB.id=${runB.id}`);
    eq(runA.attemptNumber, 2, '20b. attempt is 2');
    const attempt2Count = repo.runs.filter(r => r.chapterId === C && r.attemptNumber === 2).length;
    eq(attempt2Count, 1, '20c. exactly one attempt-2 run persisted');
  }
}

// ── 21. Reload same seed ──────────────────────────────────────────────────────

console.log('\n── Reload same seed ──');

{
  const P    = 'player-C';
  const C    = 6;
  const repo = new MockRepo();
  const r1   = await loadOrCreateJourneyRun(P, C, repo);
  const r2   = await loadOrCreateJourneyRun(P, C, repo);
  const r3   = await loadOrCreateJourneyRun(P, C, repo);
  check('21a. r1 seed === r2 seed', r1.seed === r2.seed);
  check('21b. r2 seed === r3 seed', r2.seed === r3.seed);
  check('21c. all same run id',     r1.id   === r2.id && r2.id === r3.id);
}

// ── 22. Full lifecycle ────────────────────────────────────────────────────────

console.log('\n── Full lifecycle ──');

{
  const P    = 'player-D';
  const C    = 5;
  const repo = new MockRepo();

  const run1 = await loadOrCreateJourneyRun(P, C, repo);
  eq(run1.attemptNumber, 1, '22a. first run = attempt 1');
  eq(run1.status, 'active', '22b. first run is active');

  const reloaded = await loadOrCreateJourneyRun(P, C, repo);
  eq(reloaded.id, run1.id, '22c. reload returns same run');

  await repo.markRunCleared(run1.id);

  const afterClear = await loadOrCreateJourneyRun(P, C, repo);
  eq(afterClear.id,     run1.id,    '22d. cleared run returned by load');
  eq(afterClear.status, 'cleared',  '22e. status is cleared');

  const run2 = await challengeChapter(P, C, repo);
  eq(run2.attemptNumber, 2,         '22f. challenge = attempt 2');
  eq(run2.status, 'active',         '22g. new run is active');
  check('22h. new seed differs',     run2.seed !== run1.seed);

  const afterChallenge = await loadOrCreateJourneyRun(P, C, repo);
  eq(afterChallenge.id,  run2.id,   '22i. new active run loaded');
  check('22j. old cleared run not returned', afterChallenge.id !== run1.id);
}

// ── 23–30: rechallengeMap ─────────────────────────────────────────────────────

console.log('\n── rechallengeMap ──');

{
  const P = 'player-E';
  const C = 5; // Ch5 has area bosses (3% rate)

  // 23. Eligible rechallenge: creates attempt N+1, inherited keys on new run
  {
    const seed1      = generateSecureSeed();
    const activeRun  = { ...buildRealRun({ playerId: P, chapterId: C, attemptNumber: 1, seed: seed1 }), areaBossKeysCollected: 2 };
    const repo       = new MockRepo([activeRun]);
    const keyState   = createChapterBossKeyState(C, 2);   // 2 keys, boss not defeated
    const newRun     = await rechallengeMap(P, C, repo, keyState);
    eq(newRun.attemptNumber,          2,        '23a. new run = attempt 2');
    eq(newRun.status,                 'active', '23b. new run is active');
    eq(newRun.areaBossKeysCollected,  2,        '23c. total keys on new run = 2 (inherited)');
    eq(newRun.inheritedAreaBossKeys,  2,        '23d. inheritedAreaBossKeys = 2');
    check('23e. new seed differs',    newRun.seed !== activeRun.seed);
  }

  // 24. Old run is abandoned after rechallenge
  {
    const seed1     = generateSecureSeed();
    const activeRun = { ...buildRealRun({ playerId: P, chapterId: C, attemptNumber: 2, seed: seed1 }), areaBossKeysCollected: 1 };
    const repo      = new MockRepo([activeRun]);
    const keyState  = createChapterBossKeyState(C, 1);
    await rechallengeMap(P, C, repo, keyState);
    const oldRun    = repo.runs.find(r => r.id === activeRun.id)!;
    eq(oldRun.status, 'abandoned', '24. old run is abandoned');
  }

  // 25. Ineligible: chapter boss already defeated → throws
  {
    const seed1     = generateSecureSeed();
    const activeRun = { ...buildRealRun({ playerId: P, chapterId: C, attemptNumber: 1, seed: seed1 }), chapterBossDefeated: true };
    const repo      = new MockRepo([activeRun]);
    const keyState  = createChapterBossKeyState(C, 0);
    let threw = false;
    try { await rechallengeMap(P, C, repo, keyState); } catch { threw = true; }
    check('25. throws when boss defeated', threw);
  }

  // 26. Ineligible: 3 keys collected (gate open) → throws
  {
    const seed1     = generateSecureSeed();
    const activeRun = { ...buildRealRun({ playerId: P, chapterId: C, attemptNumber: 1, seed: seed1 }), areaBossKeysCollected: 3 };
    const repo      = new MockRepo([activeRun]);
    const keyState  = createChapterBossKeyState(C, 3);
    let threw = false;
    try { await rechallengeMap(P, C, repo, keyState); } catch { threw = true; }
    check('26. throws when gate open (3 keys)', threw);
  }

  // 27. No active run → throws
  {
    const repo     = new MockRepo();  // empty
    const keyState = createChapterBossKeyState(C, 0);
    let threw = false;
    try { await rechallengeMap(P, C, repo, keyState); } catch { threw = true; }
    check('27. throws with no active run', threw);
  }

  // 28. Keys 0 → new run also starts at 0, inheritedAreaBossKeys = 0
  {
    const seed1     = generateSecureSeed();
    const activeRun = buildRealRun({ playerId: P, chapterId: C, attemptNumber: 1, seed: seed1 }); // areaBossKeysCollected = 0
    const repo      = new MockRepo([activeRun]);
    const keyState  = createChapterBossKeyState(C, 0);
    const newRun    = await rechallengeMap(P, C, repo, keyState);
    eq(newRun.areaBossKeysCollected, 0, '28a. 0 keys inherited when none collected');
    eq(newRun.inheritedAreaBossKeys, 0, '28b. inheritedAreaBossKeys = 0 on first attempt');
  }

  // 28c. First-run creation never sets inheritedAreaBossKeys > 0
  {
    const repo    = new MockRepo();
    const firstRun = await loadOrCreateJourneyRun(P, C, repo);
    eq(firstRun.inheritedAreaBossKeys, 0, '28c. first run has inheritedAreaBossKeys = 0');
  }

  // 29. Recovery: loadOrCreateJourneyRun with abandoned latest → creates successor with inherited keys
  {
    const seed1       = generateSecureSeed();
    const abandonedRun = {
      ...buildRealRun({ playerId: P, chapterId: C, attemptNumber: 3, seed: seed1 }),
      status: 'abandoned' as const,
      areaBossKeysCollected: 2,
    };
    const repo    = new MockRepo([abandonedRun]);
    const loaded  = await loadOrCreateJourneyRun(P, C, repo);
    eq(loaded.attemptNumber,         4, '29a. successor = attempt 4');
    eq(loaded.status,                'active', '29b. successor is active');
    eq(loaded.areaBossKeysCollected, 2, '29c. inherited keys in recovered run');
  }

  // 30. Double-tap rechallenge: second call returns same run (dedup)
  {
    const seed1     = generateSecureSeed();
    const activeRun = { ...buildRealRun({ playerId: P, chapterId: C, attemptNumber: 4, seed: seed1 }), areaBossKeysCollected: 1 };
    const repo      = new MockRepo([activeRun]);
    const keyState  = createChapterBossKeyState(C, 1);
    const [r1, r2]  = await Promise.all([
      rechallengeMap(P, C, repo, keyState),
      rechallengeMap(P, C, repo, keyState),
    ]);
    check('30a. double-tap: both attempts get same run id', r1.id === r2.id);
    const activeRuns = repo.runs.filter(r => r.playerId === P && r.chapterId === C && r.status === 'active');
    check('30b. only one active run after double-tap', activeRuns.length === 1);
  }

  // 32. Recovery: chapterKeysCollected param overrides abandoned run's stale count
  //     Scenario: Area Boss won on a prior attempt (canonical chapter-level keys = 2)
  //     but the run record only reflects run-level count (areaBossKeysCollected = 1)
  //     after a partial update.  The recovered run must inherit the canonical count.
  {
    const seed1 = generateSecureSeed();
    // Stale run-level count (1) differs from canonical chapter count (2)
    const abandonedRun = {
      ...buildRealRun({ playerId: P, chapterId: C, attemptNumber: 5, seed: seed1 }),
      status: 'abandoned' as const,
      areaBossKeysCollected: 1, // stale run-level
    };
    const repo     = new MockRepo([abandonedRun]);
    // Pass canonical chapter-level count as the authoritative value
    const loaded   = await loadOrCreateJourneyRun(P, C, repo, 2);
    eq(loaded.attemptNumber,         6, '32a. successor = attempt 6');
    eq(loaded.status,                'active', '32b. successor is active');
    eq(loaded.areaBossKeysCollected, 2, '32c. canonical chapter count (2) wins over stale run count (1)');
  }

  // 31. Two active runs (edge case): getActiveRun returns highest-attempt one
  {
    const P2   = 'player-F';
    const seed1 = generateSecureSeed();
    const seed2 = generateSecureSeed();
    // Simulate an edge case where two active runs exist (e.g. partial transition).
    const runLow  = buildRealRun({ playerId: P2, chapterId: C, attemptNumber: 1, seed: seed1 });
    const runHigh = buildRealRun({ playerId: P2, chapterId: C, attemptNumber: 2, seed: seed2 });
    const repo    = new MockRepo([runLow, runHigh]);  // both active
    const loaded  = await loadOrCreateJourneyRun(P2, C, repo);
    eq(loaded.attemptNumber, 2, '31. two active runs → highest attempt returned');
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);

})().catch(err => { console.error('Unhandled:', err); process.exit(1); });
