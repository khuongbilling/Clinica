/**
 * fog_calculator.test.ts — PUSH 10
 *
 * Unit tests for journeyMap/fogCalculator.ts.
 *
 * Run: npx sucrase-node tests/fog_calculator.test.ts
 *
 * Covers:
 *  1.  axialNeighborKeys — returns exactly 6 neighbour keys
 *  2.  axialNeighborKeys — correct keys for (0,0)
 *  3.  axialNeighborKeys — correct keys for arbitrary position
 *  4.  isAdjacent — directly adjacent tiles
 *  5.  isAdjacent — non-adjacent tiles (distance 2)
 *  6.  isAdjacent — same tile (distance 0)
 *  7.  computeInitialFog — start tile is revealed
 *  8.  computeInitialFog — tiles adjacent to start become frontier
 *  9.  computeInitialFog — tiles not adjacent to start are hidden
 * 10.  computeInitialFog — all tiles in a single-tile map are revealed
 * 11.  computeInitialFog — throws on missing startId
 * 12.  computeFogAfterMove — destination becomes revealed
 * 13.  computeFogAfterMove — destination visited flag set
 * 14.  computeFogAfterMove — destination is current
 * 15.  computeFogAfterMove — old current tile loses current flag
 * 16.  computeFogAfterMove — old current tile stays revealed
 * 17.  computeFogAfterMove — tiles adjacent to new current become frontier
 * 18.  computeFogAfterMove — frontier tiles no longer adjacent revert to hidden
 * 19.  computeFogAfterMove — already-revealed tiles never demoted to hidden
 * 20.  computeFogAfterMove — already-revealed tiles never demoted to frontier
 * 21.  computeFogAfterMove — throws on unknown destinationId
 * 22.  computeFogAfterMove — object reuse: unchanged tiles return same ref
 * 23.  isEncounterVisible — hidden tile → false
 * 24.  isEncounterVisible — frontier tile → false
 * 25.  isEncounterVisible — revealed tile → true
 * 26.  isEncounterVisible — current tile → true (even if visibility hidden)
 * 27.  encounter privacy: hidden tile with battle encounter not visible
 * 28.  encounter privacy: frontier tile with battle encounter not visible
 * 29.  encounter privacy: revealed tile with battle encounter IS visible
 * 30.  computeFogAfterMove — player token (current) moves correctly
 * 31.  computeFogAfterMove — chained two moves: correct final frontier
 * 32.  computeFogAfterMove — tile that was frontier and visited stays revealed
 *       (stepping on a frontier tile makes it revealed; later moves cannot hide it)
 */

import {
  AXIAL_DIRS,
  axialNeighborKeys,
  isAdjacent,
  computeInitialFog,
  computeFogAfterMove,
  isEncounterVisible,
} from '../src/game/journeyMap/fogCalculator';

import type { JourneyTile, TileVisibility } from '../src/game/journeyMap/types';

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

// ── Tile factory ──────────────────────────────────────────────────────────────

function makeTile(
  q: number,
  r: number,
  overrides: Partial<JourneyTile> = {},
): JourneyTile {
  return {
    id:                    `${q},${r}`,
    q,
    r,
    encounter:             'none',
    visibility:            'unexplored',
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
 * Build a linear chain of tiles along the q axis:
 *   (0,0) — (1,0) — (2,0) — ... — (n-1, 0)
 *
 * Each tile's id = "q,0".
 */
function linearChain(n: number): JourneyTile[] {
  return Array.from({ length: n }, (_, i) => makeTile(i, 0));
}

/**
 * Find a tile by id in an array (throws if missing).
 */
function byId(tiles: readonly JourneyTile[], id: string): JourneyTile {
  const t = tiles.find(t => t.id === id);
  if (!t) throw new Error(`Test helper: tile "${id}" not found`);
  return t;
}

// ── 1–6: axialNeighborKeys / isAdjacent ──────────────────────────────────────

check('1. axialNeighborKeys returns 6 keys',
  axialNeighborKeys(0, 0).length === 6);

check('2. axialNeighborKeys keys for (0,0)',
  (() => {
    const keys = axialNeighborKeys(0, 0);
    const expected = AXIAL_DIRS.map(d => `${d.q},${d.r}`);
    return expected.every(k => keys.includes(k));
  })());

check('3. axialNeighborKeys keys for (3,2)',
  (() => {
    const keys = axialNeighborKeys(3, 2);
    const expected = AXIAL_DIRS.map(d => `${3 + d.q},${2 + d.r}`);
    return expected.every(k => keys.includes(k));
  })());

check('4. isAdjacent — adjacent along q-axis',
  isAdjacent(0, 0, 1, 0));

check('5. isAdjacent — distance 2 is false',
  !isAdjacent(0, 0, 2, 0));

check('6. isAdjacent — same tile is false',
  !isAdjacent(0, 0, 0, 0));

// ── 7–11: computeInitialFog ───────────────────────────────────────────────────

(function () {
  // 5-tile chain: (0,0)–(4,0); start = (1,0)
  const tiles = linearChain(5).map(t => ({ id: t.id, q: t.q, r: t.r }));
  const fog   = computeInitialFog(tiles, '1,0');

  eq(fog.get('1,0'), 'exploredButOutOfVision', '7. computeInitialFog — start tile is revealed');

  check('8. computeInitialFog — tiles adjacent to start become frontier',
    fog.get('0,0') === 'visibleNow' && fog.get('2,0') === 'visibleNow');

  check('9. computeInitialFog — tiles not adjacent to start are hidden',
    fog.get('3,0') === 'unexplored' && fog.get('4,0') === 'unexplored');
})();

(function () {
  const tiles = [{ id: '0,0', q: 0, r: 0 }];
  const fog   = computeInitialFog(tiles, '0,0');
  eq(fog.get('0,0'), 'exploredButOutOfVision', '10. computeInitialFog — single-tile map is revealed');
})();

check('11. computeInitialFog — throws on missing startId',
  (() => {
    try {
      computeInitialFog([{ id: '0,0', q: 0, r: 0 }], 'missing');
      return false;
    } catch { return true; }
  })());

// ── 12–22: computeFogAfterMove ────────────────────────────────────────────────

(function () {
  /**
   * 5-tile chain: (0,0)–(4,0).
   * Initial state: (0,0) current+revealed, (1,0) frontier, rest hidden.
   * We move to (1,0).
   */
  const initialTiles = linearChain(5);
  initialTiles[0] = { ...initialTiles[0], visibility: 'exploredButOutOfVision', visited: true, current: true };
  initialTiles[1] = { ...initialTiles[1], visibility: 'visibleNow' };
  // (2–4) already hidden (default)

  const after = computeFogAfterMove(initialTiles, '1,0');
  const dest  = byId(after, '1,0');

  eq(dest.visibility, 'exploredButOutOfVision', '12. computeFogAfterMove — destination becomes revealed');
  check('13. computeFogAfterMove — destination visited flag set',   dest.visited);
  check('14. computeFogAfterMove — destination is current',          dest.current);

  const oldCurrent = byId(after, '0,0');
  check('15. computeFogAfterMove — old current tile loses current flag', !oldCurrent.current);
  eq(oldCurrent.visibility, 'exploredButOutOfVision', '16. computeFogAfterMove — old current tile stays revealed');

  // (2,0) is adjacent to new current (1,0) → frontier
  eq(byId(after, '2,0').visibility, 'visibleNow', '17. computeFogAfterMove — adjacent tiles become frontier');

  // (0,0) is adjacent to new current (1,0) — but it's already revealed.
  // The important frontier→hidden case: tiles adjacent ONLY to the OLD current
  // tile but NOT to the new one.  In this linear chain, (0,0) IS adjacent to
  // (1,0) so it won't revert.  Let's use a different tile not in the chain.
  // We'll test this properly with a star topology below.
})();

(function () {
  /**
   * Star topology — centre + 4 arms.  Arranged so arm1 is NOT adjacent to
   * arm2, proving frontier tiles revert when the player moves away.
   *
   *   arm3 (0,-1)
   *      |
   * arm4 (-1,0) — C(0,0) — arm2 (1,0)
   *      |
   *   arm5 (0,1)    [arm5 = not used in assertions]
   *             arm1 (1,-1) — destination
   *
   * Initial (C is current+revealed):
   *   frontier: arm2 (1,0), arm3 (0,-1), arm4 (-1,0), arm1 (1,-1)
   *   all others hidden (arm5 is far)
   */
  const C    = makeTile(0,  0, { visibility: 'exploredButOutOfVision', visited: true, current: true });
  const arm1 = makeTile(1, -1, { visibility: 'visibleNow' });  // adjacent to C
  const arm2 = makeTile(1,  0, { visibility: 'visibleNow' });  // adjacent to C, NOT arm1
  const arm3 = makeTile(0, -1, { visibility: 'visibleNow' });  // adjacent to C, IS adjacent to arm1
  const arm4 = makeTile(-1, 0, { visibility: 'visibleNow' });  // adjacent to C, NOT arm1
  const far  = makeTile(2,  0, { visibility: 'unexplored'   });  // two steps from C

  const allTiles = [C, arm1, arm2, arm3, arm4, far];
  const after    = computeFogAfterMove(allTiles, arm1.id); // move to (1,-1)

  // arm2 (1,0): neighbors of arm1 (1,-1) → check if (1,0) is a neighbor.
  // AXIAL_DIRS of (1,-1): (2,-1),(0,-1),(1,0),(1,-2),(2,-2),(0,0)
  // (1,0) IS a neighbor of (1,-1) → should stay frontier
  eq(byId(after, arm2.id).visibility, 'visibleNow',
    '17b. tile adjacent to new current (arm2) becomes frontier');

  // arm3 (0,-1): neighbors of arm1 (1,-1): includes (0,-1)? yes → frontier
  eq(byId(after, arm3.id).visibility, 'visibleNow',
    '17c. tile adjacent to new current (arm3) becomes frontier');

  // arm4 (-1,0): neighbors of arm1 (1,-1): (-1,0)? (1+AXIAL_DIRS.q, -1+AXIAL_DIRS.r)
  // AXIAL_DIRS: (2,-1),(0,-1),(1,0),(1,-2),(2,-2),(0,0) — does NOT include (-1,0)
  // arm4 was frontier from old current; now no longer adjacent to new current
  // arm4 is not revealed/visited → reverts to hidden
  eq(byId(after, arm4.id).visibility, 'unexplored',
    '18. computeFogAfterMove — frontier no longer adjacent reverts to hidden');

  // C (0,0): neighbors of arm1 (1,-1) include (0,0) (via AXIAL_DIR (-1,+1) from arm1)
  // → C is adjacent to arm1. But C is already revealed. Must stay revealed.
  eq(byId(after, C.id).visibility, 'exploredButOutOfVision',
    '19. computeFogAfterMove — revealed tiles never demoted to hidden');

  // "far" (2,0): not adjacent to arm1 → hidden. Not adjacent to C → not frontier.
  // Is (2,0) adjacent to arm1 (1,-1)?  (2-1, 0-(-1)) = (1,1) not in AXIAL_DIRS. No.
  eq(byId(after, far.id).visibility, 'unexplored',
    '20. computeFogAfterMove — tiles far from new current stay hidden');
})();

check('21. computeFogAfterMove — throws on unknown destinationId',
  (() => {
    try {
      computeFogAfterMove([makeTile(0, 0, { visibility: 'exploredButOutOfVision', current: true })], '9,9');
      return false;
    } catch { return true; }
  })());

check('22. computeFogAfterMove — unchanged tiles reuse same object reference',
  (() => {
    const tiles = linearChain(5);
    tiles[0] = { ...tiles[0], visibility: 'exploredButOutOfVision', visited: true, current: true };
    tiles[1] = { ...tiles[1], visibility: 'visibleNow' };
    const after = computeFogAfterMove(tiles, '1,0');
    // tile (3,0) and (4,0) are both hidden before and after — should be same ref
    return after.find(t => t.id === '3,0') === tiles[3];
  })());

// ── 23–29: isEncounterVisible / encounter privacy ─────────────────────────────

check('23. isEncounterVisible — hidden tile → false',
  !isEncounterVisible({ current: false, visibility: 'unexplored' }));

check('24. isEncounterVisible — frontier tile → false',
  !isEncounterVisible({ current: false, visibility: 'visibleNow' }));

check('25. isEncounterVisible — revealed tile → true',
  isEncounterVisible({ current: false, visibility: 'exploredButOutOfVision' }));

check('26. isEncounterVisible — current tile → true regardless of visibility',
  isEncounterVisible({ current: true, visibility: 'unexplored' }));

(function () {
  const hiddenBattle   = makeTile(0, 0, { visibility: 'unexplored',   encounter: 'battle' });
  const frontierBattle = makeTile(1, 0, { visibility: 'visibleNow', encounter: 'battle' });
  const revealedBattle = makeTile(2, 0, { visibility: 'exploredButOutOfVision', encounter: 'battle' });

  check('27. encounter privacy — hidden tile with battle encounter not visible',
    !isEncounterVisible(hiddenBattle));

  check('28. encounter privacy — frontier tile with battle encounter not visible',
    !isEncounterVisible(frontierBattle));

  check('29. encounter privacy — revealed tile with battle encounter IS visible',
    isEncounterVisible(revealedBattle));
})();

// ── 30–32: chained moves / edge cases ────────────────────────────────────────

(function () {
  /**
   * Chain: (0,0)–(1,0)–(2,0)–(3,0)
   * Start at (0,0). Move (0,0)→(1,0)→(2,0).
   * After both moves check the final state.
   */
  let tiles = linearChain(4);
  tiles[0] = { ...tiles[0], visibility: 'exploredButOutOfVision', visited: true, current: true };
  tiles[1] = { ...tiles[1], visibility: 'visibleNow' };
  // (2,3) hidden

  // Move 1: (0,0) → (1,0)
  tiles = computeFogAfterMove(tiles, '1,0');
  // Move 2: (1,0) → (2,0)
  tiles = computeFogAfterMove(tiles, '2,0');

  const t2 = byId(tiles, '2,0');
  const t3 = byId(tiles, '3,0');
  const t1 = byId(tiles, '1,0');
  const t0 = byId(tiles, '0,0');

  check('30. chained move — final current is (2,0)', t2.current);
  eq(t2.visibility, 'exploredButOutOfVision', '30b. (2,0) revealed after two moves');
  eq(t3.visibility, 'visibleNow', '31. (3,0) is frontier after second move');
  eq(t1.visibility, 'exploredButOutOfVision', '31b. (1,0) stays revealed permanently');

  // Is (0,0) adjacent to (2,0)?  dq=2 → not adjacent. NOT a neighbor.
  // But (0,0) is revealed (visited step 1).  It must stay revealed.
  eq(t0.visibility, 'exploredButOutOfVision', '31c. (0,0) stays revealed — visited tile permanent');
})();

(function () {
  /**
   * Step onto a frontier tile, making it revealed, then move away.
   * The formerly-frontier tile must remain revealed.
   *
   *   (0,0) start → (1,0) frontier → move to (1,0) → it's revealed
   *   Then move to (2,0) → (1,0) stays revealed, not frontier/hidden.
   */
  let tiles = linearChain(4);
  tiles[0] = { ...tiles[0], visibility: 'exploredButOutOfVision', visited: true, current: true };
  tiles[1] = { ...tiles[1], visibility: 'visibleNow' };

  tiles = computeFogAfterMove(tiles, '1,0');  // step onto frontier tile
  tiles = computeFogAfterMove(tiles, '2,0');  // step further

  eq(byId(tiles, '1,0').visibility, 'exploredButOutOfVision',
    '32. tile that was frontier and visited stays revealed after player moves away');
})();

// ── Results ───────────────────────────────────────────────────────────────────

console.log('');
console.log(`── Results: ${passed} passed, ${failed} failed ──`);

if (failed > 0) process.exit(1);
