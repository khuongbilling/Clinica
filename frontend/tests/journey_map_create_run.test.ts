/**
 * journey_map_create_run.test.ts
 *
 * Unit tests for journeyMap/createRun.ts.
 *
 * Run: npx sucrase-node tests/journey_map_create_run.test.ts
 *
 * Covers:
 *  1.  Structural validity — validateRun returns no errors on fresh runs
 *  2.  Gate tile always has encounter = 'boss'
 *  3.  Start tile always has encounter = 'none'
 *  4.  tileCount = tiles.length − 1  (gate excluded from playable count)
 *  5.  gateAnchorTileId references a tile in the tiles array
 *  6.  startTileId and currentTileId both reference the same start tile
 *  7.  Start tile is 'revealed', visited, and current at creation
 *  8.  All non-start tiles begin 'hidden' and unvisited
 *  9.  Determinism — same inputs produce identical tile assignments
 * 10.  Attempt variation — different attempts produce different tile layouts
 * 11.  Chapter variation — different chapters produce different tile layouts
 * 12.  Rate distribution — encounters are not all 'none' over a real map
 * 13.  areaBossCount matches actual areaBoss tile count
 * 14.  areaBossKeysCollected starts at 0
 * 15.  chapterBossDefeated starts false
 * 16.  exploredTileCount starts at 1 (only the start tile is revealed)
 * 17.  staminaSpent starts at 0
 * 18.  Edge case — chapter 1, attempt 1 (smallest valid run)
 * 19.  Treasure tiles all have a chestTier; non-treasure tiles do not
 * 20.  All tile ids within a run are unique
 * 21.  All-hidden run variant (zero-areaBoss) still validates cleanly
 */

import {
  createJourneyRun,
  JOURNEY_RUN_SCHEMA_VERSION,
  type CreateJourneyRunOptions,
} from '../src/game/journeyMap/createRun';
import { validateRun } from '../src/game/journeyMap/validate';
import type { JourneyRun } from '../src/game/journeyMap/types';

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

const NOW = '2026-01-01T00:00:00.000Z';

function makeRun(opts: Partial<CreateJourneyRunOptions> & { chapterId: number }): JourneyRun {
  return createJourneyRun({
    playerId:      'player_test',
    attemptNumber: 1,
    nowIso:        NOW,
    ...opts,
  });
}

/** Stable serialisation for diffing tile assignments (excludes timestamps). */
function serialiseTiles(run: JourneyRun): string {
  return JSON.stringify(
    [...run.tiles]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(t => `${t.id}:${t.encounter}:${t.chestTier ?? '-'}:${t.visibility}`),
  );
}

// ── Standard cases used across multiple groups ────────────────────────────────

const STD_CASES: Array<{ chapter: number; attempt: number }> = [
  { chapter:  1, attempt: 1 },
  { chapter:  1, attempt: 2 },
  { chapter:  5, attempt: 1 },
  { chapter:  6, attempt: 1 },
  { chapter: 10, attempt: 3 },
  { chapter: 20, attempt: 1 },
  { chapter: 11, attempt: 5 },
];

// ── 1. Structural validity ────────────────────────────────────────────────────

console.log('\n── Structural validity (validateRun) ──');

for (const { chapter, attempt } of STD_CASES) {
  const label = `ch${chapter}/attempt${attempt}`;
  let run: JourneyRun;
  try {
    run = makeRun({ chapterId: chapter, attemptNumber: attempt });
  } catch (err) {
    check(`[${label}] createJourneyRun does not throw`, false, String(err));
    continue;
  }

  const errors = validateRun(run);
  check(
    `[${label}] validateRun passes`,
    errors.length === 0,
    errors.join(' | '),
  );
}

// ── 2. Gate tile always has encounter = 'boss' ────────────────────────────────

console.log('\n── Gate tile = boss ──');

for (const { chapter, attempt } of STD_CASES) {
  const label = `ch${chapter}/attempt${attempt}`;
  const run   = makeRun({ chapterId: chapter, attemptNumber: attempt });

  const gateTile = run.tiles.find(t => t.id === run.gateAnchorTileId);
  check(`[${label}] gate tile found`, !!gateTile);
  if (gateTile) {
    eq(gateTile.encounter, 'boss', `[${label}] gate.encounter = 'boss'`);
    check(`[${label}] gate tile has no chestTier`, gateTile.chestTier === undefined);
  }
}

// ── 3. Start tile always has encounter = 'none' ───────────────────────────────

console.log('\n── Start tile = none ──');

for (const { chapter, attempt } of STD_CASES) {
  const label = `ch${chapter}/attempt${attempt}`;
  const run   = makeRun({ chapterId: chapter, attemptNumber: attempt });

  const startTile = run.tiles.find(t => t.id === run.startTileId);
  check(`[${label}] start tile found`, !!startTile);
  if (startTile) {
    eq(startTile.encounter, 'none', `[${label}] start.encounter = 'none'`);
    check(`[${label}] start tile has no chestTier`, startTile.chestTier === undefined);
  }
}

// ── 4. tileCount = tiles.length − 1 ──────────────────────────────────────────

console.log('\n── tileCount = tiles.length − 1 ──');

for (const { chapter, attempt } of STD_CASES) {
  const label = `ch${chapter}/attempt${attempt}`;
  const run   = makeRun({ chapterId: chapter, attemptNumber: attempt });

  eq(
    run.tileCount,
    run.tiles.length - 1,
    `[${label}] tileCount = ${run.tiles.length - 1}`,
  );
}

// ── 5. gateAnchorTileId references a real tile ────────────────────────────────

console.log('\n── gateAnchorTileId is in tiles ──');

for (const { chapter, attempt } of STD_CASES) {
  const label = `ch${chapter}/attempt${attempt}`;
  const run   = makeRun({ chapterId: chapter, attemptNumber: attempt });

  check(
    `[${label}] gateAnchorTileId defined`,
    run.gateAnchorTileId !== undefined,
  );
  if (run.gateAnchorTileId) {
    const found = run.tiles.some(t => t.id === run.gateAnchorTileId);
    check(`[${label}] gateAnchorTileId found in tiles`, found, run.gateAnchorTileId);
  }
}

// ── 6. startTileId and currentTileId agree ────────────────────────────────────

console.log('\n── startTileId = currentTileId at creation ──');

for (const { chapter, attempt } of STD_CASES) {
  const label = `ch${chapter}/attempt${attempt}`;
  const run   = makeRun({ chapterId: chapter, attemptNumber: attempt });

  eq(run.startTileId, run.currentTileId, `[${label}] start = current`);
  const startTile = run.tiles.find(t => t.id === run.startTileId);
  check(`[${label}] start tile .current = true`, !!startTile?.current);
}

// ── 7. Start tile initial state ───────────────────────────────────────────────

console.log('\n── Start tile initial state ──');

{
  const run = makeRun({ chapterId: 1 });
  const startTile = run.tiles.find(t => t.id === run.startTileId)!;

  eq(startTile.visibility, 'revealed', 'start.visibility = revealed');
  check('start.visited = true',  startTile.visited  === true);
  check('start.current = true',  startTile.current  === true);
  check('start.resolved = false', startTile.resolved === false);
}

// ── 8. All non-start tiles begin hidden and unvisited ─────────────────────────

console.log('\n── Non-start tiles begin hidden ──');

for (const { chapter, attempt } of STD_CASES) {
  const label = `ch${chapter}/attempt${attempt}`;
  const run   = makeRun({ chapterId: chapter, attemptNumber: attempt });

  const nonStart = run.tiles.filter(t => t.id !== run.startTileId);
  const badVis   = nonStart.filter(t => t.visibility !== 'hidden');
  const badVisit = nonStart.filter(t => t.visited);
  const badCurr  = nonStart.filter(t => t.current);

  check(`[${label}] all non-start tiles hidden`,   badVis.length   === 0, `${badVis.length} not hidden`);
  check(`[${label}] all non-start tiles unvisited`, badVisit.length === 0, `${badVisit.length} visited`);
  check(`[${label}] no non-start tile is current`,  badCurr.length  === 0, `${badCurr.length} current`);
}

// ── 9. Determinism ────────────────────────────────────────────────────────────

console.log('\n── Determinism ──');

for (const { chapter, attempt } of STD_CASES) {
  const label = `ch${chapter}/attempt${attempt}`;
  const a = makeRun({ chapterId: chapter, attemptNumber: attempt });
  const b = makeRun({ chapterId: chapter, attemptNumber: attempt });
  check(
    `[determinism ${label}] identical tile assignment`,
    serialiseTiles(a) === serialiseTiles(b),
  );
}

// ── 10. Attempt variation ─────────────────────────────────────────────────────

console.log('\n── Attempt variation ──');

{
  const attempts = [1, 2, 3, 4, 5];
  const serials  = attempts.map(a => serialiseTiles(makeRun({ chapterId: 5, attemptNumber: a })));
  let allDiff = true;
  for (let i = 0; i < serials.length; i++) {
    for (let j = i + 1; j < serials.length; j++) {
      if (serials[i] === serials[j]) {
        allDiff = false;
        console.error(`COLLISION: ch5 attempts ${attempts[i]} and ${attempts[j]} identical`);
      }
    }
  }
  check('distinct attempts produce distinct tile layouts (ch5)', allDiff);
}

// ── 11. Chapter variation ─────────────────────────────────────────────────────

console.log('\n── Chapter variation ──');

{
  const chapters = [1, 5, 6, 10, 11, 20];
  const serials  = chapters.map(ch => serialiseTiles(makeRun({ chapterId: ch, attemptNumber: 1 })));
  let allDiff = true;
  for (let i = 0; i < serials.length; i++) {
    for (let j = i + 1; j < serials.length; j++) {
      if (serials[i] === serials[j]) {
        allDiff = false;
        console.error(`COLLISION: ch${chapters[i]} and ch${chapters[j]} identical`);
      }
    }
  }
  check('distinct chapters produce distinct tile layouts', allDiff);
}

// ── 12. Rate distribution — encounters present ────────────────────────────────

console.log('\n── Encounter distribution across chapters ──');

// Over a set of runs, expect at least some battles and at least some non-none tiles.
// (A few rare seeds might produce zero battles but the probability is negligible
//  with 30–40 tiles at 30% battle rate → use multiple seeds/chapters for robustness.)
{
  const chapters = [1, 5, 6, 10, 11, 20];
  for (const ch of chapters) {
    const totalTiles = [...new Array(5)].flatMap((_, i) =>
      makeRun({ chapterId: ch, attemptNumber: i + 1 }).tiles
    );
    const encounters = totalTiles.reduce<Record<string, number>>((acc, t) => {
      acc[t.encounter] = (acc[t.encounter] ?? 0) + 1;
      return acc;
    }, {});
    check(
      `ch${ch} has at least one battle encounter across 5 attempts`,
      (encounters['battle'] ?? 0) > 0,
      `counts: ${JSON.stringify(encounters)}`,
    );
    check(
      `ch${ch} has exactly one boss tile per run (5 runs → 5 boss tiles)`,
      (encounters['boss'] ?? 0) === 5,
      `boss count: ${encounters['boss']}`,
    );
  }
}

// ── 13. areaBossCount matches tile count ──────────────────────────────────────

console.log('\n── areaBossCount consistency ──');

for (const { chapter, attempt } of STD_CASES) {
  const label = `ch${chapter}/attempt${attempt}`;
  const run   = makeRun({ chapterId: chapter, attemptNumber: attempt });

  const actual = run.tiles.filter(t => t.encounter === 'areaBoss').length;
  eq(run.areaBossCount, actual, `[${label}] areaBossCount = ${actual}`);
}

// ── 14–17. Initial scalar fields ──────────────────────────────────────────────

console.log('\n── Initial scalar fields ──');

{
  const run = makeRun({ chapterId: 3, attemptNumber: 2 });
  eq(run.areaBossKeysCollected, 0,      'areaBossKeysCollected = 0');
  eq(run.exploredTileCount,     1,      'exploredTileCount = 1 (start only)');
  eq(run.staminaSpent,          0,      'staminaSpent = 0');
  eq(run.schemaVersion, JOURNEY_RUN_SCHEMA_VERSION, `schemaVersion = ${JOURNEY_RUN_SCHEMA_VERSION}`);
  check('status = active',       run.status === 'active');
  check('chapterBossDefeated = false', run.chapterBossDefeated === false);
}

// ── 18. Edge case — chapter 1, attempt 1 ─────────────────────────────────────

console.log('\n── Edge: ch1 attempt 1 ──');

{
  const run    = makeRun({ chapterId: 1, attemptNumber: 1 });
  const errors = validateRun(run);
  check('ch1/attempt1 validateRun passes', errors.length === 0, errors.join(' | '));
  // getChapterTileCount(1) = 30 total (gate included).
  // tileCount = 29 (30 playable excl. gate); tiles.length = 30.
  check('ch1/attempt1 has 29 playable tiles (30 total − 1 gate)', run.tileCount === 29,
    `tileCount=${run.tileCount}`);
  check('ch1/attempt1 tiles array has 30 entries (29 playable + 1 gate)',
    run.tiles.length === 30, `tiles.length=${run.tiles.length}`);
}

// ── 19. chestTier ↔ treasure ──────────────────────────────────────────────────

console.log('\n── chestTier consistency ──');

for (const { chapter, attempt } of STD_CASES) {
  const label = `ch${chapter}/attempt${attempt}`;
  const run   = makeRun({ chapterId: chapter, attemptNumber: attempt });

  const missingTier  = run.tiles.filter(t => t.encounter === 'treasure' && t.chestTier === undefined);
  const spuriousTier = run.tiles.filter(t => t.encounter !== 'treasure' && t.chestTier !== undefined);
  check(`[${label}] all treasure tiles have chestTier`, missingTier.length === 0,
    `missing on ${missingTier.length} tiles`);
  check(`[${label}] only treasure tiles have chestTier`, spuriousTier.length === 0,
    `spurious on ${spuriousTier.length} tiles`);
}

// ── 20. All tile ids are unique ───────────────────────────────────────────────

console.log('\n── Unique tile ids ──');

for (const { chapter, attempt } of STD_CASES) {
  const label = `ch${chapter}/attempt${attempt}`;
  const run   = makeRun({ chapterId: chapter, attemptNumber: attempt });

  const ids  = run.tiles.map(t => t.id);
  const uniq = new Set(ids);
  check(`[${label}] all tile ids unique`, uniq.size === ids.length,
    `${ids.length - uniq.size} duplicates`);
}

// ── 21. Zero-areaBoss run still validates ─────────────────────────────────────
//
// Use chapter 1 with multiple attempts and collect any that happen to have
// zero areaBoss tiles; verify validateRun still passes.

console.log('\n── Zero-areaBoss runs validate ──');

{
  let tested = 0;
  for (let attempt = 1; attempt <= 30; attempt++) {
    const run = makeRun({ chapterId: 1, attemptNumber: attempt });
    if (run.areaBossCount === 0) {
      const errors = validateRun(run);
      check(
        `ch1/attempt${attempt} zero-areaBoss run validates`,
        errors.length === 0,
        errors.join(' | '),
      );
      tested++;
      if (tested >= 3) break; // 3 examples is enough
    }
  }
  // If we didn't find any zero-boss runs in 30 attempts, skip gracefully.
  if (tested === 0) {
    console.log('SKIP - no zero-areaBoss run found in 30 ch1 attempts (acceptable)');
  }
}

// ── Result summary ────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
