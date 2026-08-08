/**
 * movement.test.ts — PUSH 11
 *
 * Unit tests for journeyMap/movement.ts.
 *
 * Run: npx sucrase-node tests/movement.test.ts
 *
 * Covers:
 *  1.  validateMove — adjacent frontier tile → ok: true
 *  2.  validateMove — adjacent revealed tile (backtrack) → ok: true
 *  3.  validateMove — non-adjacent tile → NOT_ADJACENT
 *  4.  validateMove — adjacent hidden tile → NOT_REACHABLE
 *  5.  validateMove — tile id not in run → NOT_REACHABLE
 *  6.  validateMove — no current tile in run → NOT_REACHABLE
 *  7.  validateMove — stamina === 0 → INSUFFICIENT_STAMINA
 *  8.  validateMove — stamina === 0.9 (< 1) → INSUFFICIENT_STAMINA
 *  9.  validateMove — stamina === 1 exactly → ok: true
 * 10.  validateMove — stamina > 1 → ok: true
 * 11.  applyMoveToRun — destination becomes current
 * 12.  applyMoveToRun — destination visibility becomes revealed
 * 13.  applyMoveToRun — destination visited flag set
 * 14.  applyMoveToRun — staminaSpent incremented by exactly 1
 * 15.  applyMoveToRun — backtrack: staminaSpent still +1 (not free)
 * 16.  applyMoveToRun — backtrack: exploredTileCount unchanged
 * 17.  applyMoveToRun — first visit: exploredTileCount +1
 * 18.  applyMoveToRun — old current tile loses current flag
 * 19.  applyMoveToRun — old current tile stays revealed
 * 20.  applyMoveToRun — frontier tiles adjacent to new current
 * 21.  applyMoveToRun — frontier tiles NOT adjacent → hidden (unless visited)
 * 22.  applyMoveToRun — original run is not mutated
 * 23.  applyMoveToRun — updatedAt is updated ISO string
 * 24.  applyMoveToRun — currentTileId matches destination
 * 25.  applyMoveToRun — tile reveals only after movement (not before)
 * 26.  applyMoveToRun — chained moves accumulate staminaSpent correctly
 * 27.  applyMoveToRun — chained moves accumulate exploredTileCount correctly
 * 28.  applyMoveToRun — refresh: currentTileId and staminaSpent preserved
 * 29.  validateMove — gate tile (visibility revealed) is a valid destination
 * 30.  MOVE_STAMINA_COST is exactly 1
 */

import {
  validateMove,
  applyMoveToRun,
  MOVE_STAMINA_COST,
  type MoveFailReason,
  type ValidateResult,
} from '../src/game/journeyMap/movement';

import type { JourneyRun, JourneyTile } from '../src/game/journeyMap/types';

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

// ── Factories ─────────────────────────────────────────────────────────────────

function makeTile(q: number, r: number, overrides: Partial<JourneyTile> = {}): JourneyTile {
  return {
    id:                    `${q},${r}`,
    q, r,
    encounter:             'none',
    visibility:            'hidden',
    visited:               false,
    resolved:              false,
    current:               false,
    graphDistanceFromStart: 0,
    areaBossKeyClaimed:    false,
    rewardClaimed:         false,
    ...overrides,
  };
}

/**
 * Build a minimal but valid JourneyRun.
 *
 * Layout — linear chain (0,0) → (1,0) → (2,0) → (3,0):
 *   (0,0) start: current + revealed + visited
 *   (1,0)      : frontier
 *   (2,0)      : hidden
 *   (3,0)      : hidden
 */
function makeRun(tileOverrides: Partial<JourneyTile>[] = []): JourneyRun {
  const defaults: JourneyTile[] = [
    makeTile(0, 0, { visibility: 'revealed', visited: true, current: true }),
    makeTile(1, 0, { visibility: 'frontier' }),
    makeTile(2, 0),
    makeTile(3, 0),
  ];

  const tiles = defaults.map((t, i) =>
    tileOverrides[i] ? { ...t, ...tileOverrides[i] } : t,
  );

  return {
    id:                    'run-test-001',
    schemaVersion:         1,
    playerId:              'player-001',
    chapterId:             1,
    attemptNumber:         1,
    seed:                  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    status:                'active',
    createdAt:             '2026-01-01T00:00:00.000Z',
    updatedAt:             '2026-01-01T00:00:00.000Z',
    tileCount:             3,
    tiles,
    startTileId:           '0,0',
    currentTileId:         '0,0',
    gateAnchorTileId:      undefined,
    areaBossCount:         0,
    areaBossKeysCollected: 0,
    chapterBossDefeated:   false,
    exploredTileCount:     1,
    staminaSpent:          0,
    // Push 4 canonical fields
    shift:                 'day' as const,
    callTeam:              [],
    cards:                 [],
    blessings:             [],
    pressure:              0,
  };
}

function valid(result: ValidateResult): boolean { return result.ok; }
function failReason(result: ValidateResult): MoveFailReason | undefined {
  return result.ok ? undefined : result.reason;
}

// ── 1–10: validateMove ────────────────────────────────────────────────────────

const run = makeRun();

check('1. adjacent frontier tile → ok',
  valid(validateMove(run, '1,0', 5)));

check('2. adjacent revealed tile (backtrack) → ok',
  (() => {
    // Build a run where (0,0) is still revealed but not current.
    // Player is at (1,0), (0,0) is revealed (visited start).
    const r = makeRun();
    r.tiles[0] = { ...r.tiles[0], current: false };
    r.tiles[1] = { ...r.tiles[1], current: true, visibility: 'revealed', visited: true };
    r.currentTileId = '1,0';
    return valid(validateMove(r, '0,0', 5));
  })());

check('3. non-adjacent tile → NOT_ADJACENT',
  failReason(validateMove(run, '2,0', 5)) === 'NOT_ADJACENT');

check('4. adjacent hidden tile → NOT_REACHABLE',
  (() => {
    // Make a run where tile at (1,0) is hidden.
    const r: JourneyRun = {
      ...run,
      tiles: run.tiles.map(t =>
        t.id === '1,0' ? { ...t, visibility: 'hidden' } : t,
      ),
    };
    return failReason(validateMove(r, '1,0', 5)) === 'NOT_REACHABLE';
  })());

check('5. tile id not in run → NOT_REACHABLE',
  failReason(validateMove(run, '9,9', 5)) === 'NOT_REACHABLE');

check('6. no current tile in run → NOT_REACHABLE',
  (() => {
    const r: JourneyRun = {
      ...run,
      tiles: run.tiles.map(t => ({ ...t, current: false })),
    };
    return failReason(validateMove(r, '1,0', 5)) === 'NOT_REACHABLE';
  })());

check('7. stamina === 0 → INSUFFICIENT_STAMINA',
  failReason(validateMove(run, '1,0', 0)) === 'INSUFFICIENT_STAMINA');

check('8. stamina === 0.9 (< 1) → INSUFFICIENT_STAMINA',
  failReason(validateMove(run, '1,0', 0.9)) === 'INSUFFICIENT_STAMINA');

check('9. stamina === 1 exactly → ok',
  valid(validateMove(run, '1,0', 1)));

check('10. stamina > 1 → ok',
  valid(validateMove(run, '1,0', 20)));

// ── 11–28: applyMoveToRun ─────────────────────────────────────────────────────

(function () {
  const before  = makeRun();
  const after   = applyMoveToRun(before, '1,0');
  const destTile = after.tiles.find(t => t.id === '1,0')!;
  const oldTile  = after.tiles.find(t => t.id === '0,0')!;

  check('11. destination becomes current',            destTile.current);
  eq(destTile.visibility, 'revealed',                 '12. destination visibility revealed');
  check('13. destination visited flag set',           destTile.visited);
  eq(after.staminaSpent, 1,                           '14. staminaSpent incremented by 1');
  check('18. old current tile loses current flag',    !oldTile.current);
  eq(oldTile.visibility, 'revealed',                  '19. old current tile stays revealed');
  eq(after.currentTileId, '1,0',                      '24. currentTileId matches destination');
  check('23. updatedAt is a non-empty ISO string',    after.updatedAt.length > 10);

  // Frontier ring: (2,0) is adjacent to new current (1,0) → frontier.
  const tile2 = after.tiles.find(t => t.id === '2,0')!;
  eq(tile2.visibility, 'frontier',                    '20. adjacent tiles become frontier');

  // (3,0) is NOT adjacent to (1,0) → hidden.
  const tile3 = after.tiles.find(t => t.id === '3,0')!;
  eq(tile3.visibility, 'hidden',                      '21. non-adjacent frontier → hidden');

  // exploredTileCount: destination (1,0) was not visited → +1.
  eq(after.exploredTileCount, 2,                      '17. first visit increments exploredTileCount');

  // Original run must not have been mutated.
  check('22. original run not mutated',
    before.currentTileId === '0,0' &&
    before.staminaSpent === 0 &&
    before.tiles[1].visibility === 'frontier');
})();

(function () {
  // Backtrack test: player at (1,0), move back to (0,0) (already visited).
  const before = makeRun();
  // Simulate: player moved from (0,0) to (1,0).
  const mid = applyMoveToRun(before, '1,0');
  // Now backtrack: move back to (0,0).
  const after = applyMoveToRun(mid, '0,0');

  eq(after.staminaSpent, 2,  '15. backtrack staminaSpent +1 (not free)');
  eq(after.exploredTileCount, 2, '16. backtrack: exploredTileCount unchanged (already visited)');
})();

(function () {
  // Tile reveals only after movement (test 25).
  // Before moving: (1,0) is frontier — encounter must NOT be visible.
  const before = makeRun();
  // Give the frontier tile a battle encounter.
  before.tiles[1] = { ...before.tiles[1], encounter: 'battle' };

  // Before move: frontier tile has encounter but it must not be considered revealed.
  check('25. frontier tile is NOT revealed before movement',
    before.tiles.find(t => t.id === '1,0')!.visibility === 'frontier');

  // After move: destination becomes revealed — encounter is now visible.
  const after = applyMoveToRun(before, '1,0');
  check('25b. tile IS revealed after movement',
    after.tiles.find(t => t.id === '1,0')!.visibility === 'revealed');
})();

(function () {
  // Chained moves: (0,0) → (1,0) → (2,0).
  let r = makeRun();
  r = applyMoveToRun(r, '1,0');
  r = applyMoveToRun(r, '2,0');

  eq(r.staminaSpent,      2, '26. chained moves accumulate staminaSpent');
  eq(r.exploredTileCount, 3, '27. chained moves accumulate exploredTileCount');
})();

(function () {
  // Refresh test: run state after applyMoveToRun preserves currentTileId and staminaSpent.
  // Simulates: save run → reload → verify.
  const before = makeRun();
  const after  = applyMoveToRun(before, '1,0');

  // "Refresh" = deserialise the same object back (in our architecture, the
  // repository returns the same data shape).
  const restored: JourneyRun = JSON.parse(JSON.stringify(after));

  eq(restored.currentTileId, '1,0', '28. refresh: currentTileId preserved');
  eq(restored.staminaSpent, 1,      '28b. refresh: staminaSpent preserved');
  check('28c. refresh: current tile flag preserved',
    restored.tiles.find(t => t.id === '1,0')!.current);
})();

(function () {
  // Gate tile (visibility: revealed) is a valid destination.
  const r = makeRun();
  // Patch (1,0) to be revealed (simulates a visited tile adjacent to current).
  const r2: JourneyRun = {
    ...r,
    tiles: r.tiles.map(t =>
      t.id === '1,0' ? { ...t, visibility: 'revealed', visited: true } : t,
    ),
  };
  check('29. revealed adjacent tile (e.g. gate) is valid destination',
    valid(validateMove(r2, '1,0', 5)));
})();

// ── 30: MOVE_STAMINA_COST ─────────────────────────────────────────────────────

eq(MOVE_STAMINA_COST, 1, '30. MOVE_STAMINA_COST is exactly 1');

// ── Results ───────────────────────────────────────────────────────────────────

console.log('');
console.log(`── Results: ${passed} passed, ${failed} failed ──`);

if (failed > 0) process.exit(1);
