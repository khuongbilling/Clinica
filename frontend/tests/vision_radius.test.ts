/**
 * tests/vision_radius.test.ts — Push 14
 *
 * Unit tests for the extensible hex field-of-vision system.
 *
 * Run:  cd frontend && npx sucrase-node tests/vision_radius.test.ts
 *
 * Covers:
 *   axialHexDistance
 *    1. distance from a tile to itself is 0
 *    2. adjacent tiles have distance 1 (all 6 axial directions)
 *    3. distance 2 along q-axis
 *    4. distance 2 along diagonal
 *    5. distance is symmetric (a→b = b→a)
 *    6. matches the canonical spec formula verbatim
 *
 *   computeInitialFog — radius 1 (baseline)
 *    7.  start tile is exploredButOutOfVision
 *    8.  all distance-1 tiles are visibleNow
 *    9.  tiles at distance 2 are unexplored
 *    10. tiles at distance 3 are unexplored
 *
 *   computeInitialFog — radius 2
 *    11. start tile is exploredButOutOfVision
 *    12. all distance-1 tiles are visibleNow
 *    13. all distance-2 tiles are visibleNow
 *    14. tiles at distance 3 are unexplored
 *    15. tiles at distance 4 are unexplored
 *
 *   computeInitialFog — radius 3
 *    16. start tile is exploredButOutOfVision
 *    17. all distance-1 tiles are visibleNow
 *    18. all distance-2 tiles are visibleNow
 *    19. all distance-3 tiles are visibleNow
 *    20. tiles at distance 4 are unexplored
 *    21. tiles at distance 5 are unexplored
 *
 *   computeEffectiveVisionRadius (from visionConfig)
 *    22. no bonuses → BASE_VISION_RADIUS (1)
 *    23. +1 bonus → 2
 *    24. +2 bonuses (+1+1) → 3
 *    25. cap: very large bonus → MAX_VISION_RADIUS (4)
 *    26. floor: negative bonus → BASE_VISION_RADIUS (1)
 *
 *   resolveVisionBonuses
 *    27. no class → []
 *    28. unknown class → []
 *    29. temporary bonus included
 *    30. combined bonuses → correct effective radius
 */

import {
  axialHexDistance,
  computeInitialFog,
  AXIAL_DIRS,
} from '../src/game/journeyMap/fogCalculator';

import {
  BASE_VISION_RADIUS,
  MAX_VISION_RADIUS,
  computeEffectiveVisionRadius,
  resolveVisionBonuses,
  type VisionBonus,
} from '../src/game/journeyMap/visionConfig';

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

function eq<T>(label: string, actual: T, expected: T): void {
  check(label, actual === expected, `got ${String(actual)}, expected ${String(expected)}`);
}

// ── Grid helpers ─────────────────────────────────────────────────────────────

/**
 * Generate all tile coords within `maxDist` hex steps of the origin (0,0).
 * This is the canonical hex disc — every tile in the grid.
 * id = "q,r" (same convention as fogCalculator).
 */
function hexDisc(maxDist: number): { id: string; q: number; r: number }[] {
  const tiles: { id: string; q: number; r: number }[] = [];
  for (let q = -maxDist; q <= maxDist; q++) {
    const r1 = Math.max(-maxDist, -q - maxDist);
    const r2 = Math.min(maxDist,  -q + maxDist);
    for (let r = r1; r <= r2; r++) {
      tiles.push({ id: `${q},${r}`, q, r });
    }
  }
  return tiles;
}

/** All tiles in the disc that are exactly `dist` steps from origin. */
function atDistance(
  disc: { id: string; q: number; r: number }[],
  dist: number,
): { id: string; q: number; r: number }[] {
  return disc.filter(t => axialHexDistance({ q: 0, r: 0 }, t) === dist);
}

// ── 1–6: axialHexDistance ────────────────────────────────────────────────────

console.log('\n── axialHexDistance ──');

eq('1. distance from tile to itself is 0',
  axialHexDistance({ q: 0, r: 0 }, { q: 0, r: 0 }), 0);

eq('2a. adjacent tile (q+1,0) has distance 1',
  axialHexDistance({ q: 0, r: 0 }, { q: 1, r: 0 }), 1);

// All six axial directions should be distance 1.
check('2b. all 6 axial-direction neighbours have distance 1',
  AXIAL_DIRS.every(d => axialHexDistance({ q: 0, r: 0 }, { q: d.q, r: d.r }) === 1));

eq('3. distance 2 along q-axis',
  axialHexDistance({ q: 0, r: 0 }, { q: 2, r: 0 }), 2);

eq('4. distance 2 on a diagonal (q=1, r=1)',
  axialHexDistance({ q: 0, r: 0 }, { q: 1, r: 1 }), 2);

check('5. distance is symmetric',
  axialHexDistance({ q: 3, r: -2 }, { q: -1, r: 1 }) ===
  axialHexDistance({ q: -1, r: 1 }, { q: 3, r: -2 }));

// Canonical spec formula: (|dq| + |dr| + |ds|) / 2, ds = (q+r) delta.
check('6. matches canonical spec formula verbatim',
  (() => {
    const a = { q: 2, r: -3 };
    const b = { q: -1, r: 4 };
    const dq = a.q - b.q;
    const dr = a.r - b.r;
    const ds = (a.q + a.r) - (b.q + b.r);
    const expected = (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
    return axialHexDistance(a, b) === expected;
  })());

// ── 7–10: radius 1 (baseline) ─────────────────────────────────────────────────

console.log('\n── computeInitialFog — radius 1 ──');

(function () {
  const disc = hexDisc(5);        // big enough disc: tiles out to distance 5
  const fog  = computeInitialFog(disc, '0,0', 1);

  eq('7.  radius 1 — start tile is exploredButOutOfVision',
    fog.get('0,0'), 'exploredButOutOfVision');

  const ring1 = atDistance(disc, 1);
  check('8.  radius 1 — all distance-1 tiles are visibleNow',
    ring1.length === 6 &&          // hexagon has exactly 6 dist-1 neighbours
    ring1.every(t => fog.get(t.id) === 'visibleNow'));

  const ring2 = atDistance(disc, 2);
  check('9.  radius 1 — distance-2 tiles are unexplored',
    ring2.length > 0 &&
    ring2.every(t => fog.get(t.id) === 'unexplored'));

  const ring3 = atDistance(disc, 3);
  check('10. radius 1 — distance-3 tiles are unexplored',
    ring3.length > 0 &&
    ring3.every(t => fog.get(t.id) === 'unexplored'));
})();

// ── 11–15: radius 2 ───────────────────────────────────────────────────────────

console.log('\n── computeInitialFog — radius 2 ──');

(function () {
  const disc = hexDisc(5);
  const fog  = computeInitialFog(disc, '0,0', 2);

  eq('11. radius 2 — start tile is exploredButOutOfVision',
    fog.get('0,0'), 'exploredButOutOfVision');

  const ring1 = atDistance(disc, 1);
  check('12. radius 2 — all distance-1 tiles are visibleNow',
    ring1.every(t => fog.get(t.id) === 'visibleNow'));

  const ring2 = atDistance(disc, 2);
  check('13. radius 2 — all distance-2 tiles are visibleNow',
    ring2.length > 0 &&
    ring2.every(t => fog.get(t.id) === 'visibleNow'));

  const ring3 = atDistance(disc, 3);
  check('14. radius 2 — distance-3 tiles are unexplored',
    ring3.length > 0 &&
    ring3.every(t => fog.get(t.id) === 'unexplored'));

  const ring4 = atDistance(disc, 4);
  check('15. radius 2 — distance-4 tiles are unexplored',
    ring4.length > 0 &&
    ring4.every(t => fog.get(t.id) === 'unexplored'));
})();

// ── 16–21: radius 3 ───────────────────────────────────────────────────────────

console.log('\n── computeInitialFog — radius 3 ──');

(function () {
  const disc = hexDisc(5);
  const fog  = computeInitialFog(disc, '0,0', 3);

  eq('16. radius 3 — start tile is exploredButOutOfVision',
    fog.get('0,0'), 'exploredButOutOfVision');

  const ring1 = atDistance(disc, 1);
  check('17. radius 3 — all distance-1 tiles are visibleNow',
    ring1.every(t => fog.get(t.id) === 'visibleNow'));

  const ring2 = atDistance(disc, 2);
  check('18. radius 3 — all distance-2 tiles are visibleNow',
    ring2.length > 0 &&
    ring2.every(t => fog.get(t.id) === 'visibleNow'));

  const ring3 = atDistance(disc, 3);
  check('19. radius 3 — all distance-3 tiles are visibleNow',
    ring3.length > 0 &&
    ring3.every(t => fog.get(t.id) === 'visibleNow'));

  const ring4 = atDistance(disc, 4);
  check('20. radius 3 — distance-4 tiles are unexplored',
    ring4.length > 0 &&
    ring4.every(t => fog.get(t.id) === 'unexplored'));

  const ring5 = atDistance(disc, 5);
  check('21. radius 3 — distance-5 tiles are unexplored',
    ring5.length > 0 &&
    ring5.every(t => fog.get(t.id) === 'unexplored'));
})();

// ── 22–26: computeEffectiveVisionRadius ───────────────────────────────────────

console.log('\n── computeEffectiveVisionRadius ──');

eq('22. no bonuses → BASE_VISION_RADIUS',
  computeEffectiveVisionRadius([]), BASE_VISION_RADIUS);

eq('23. +1 bonus → radius 2',
  computeEffectiveVisionRadius([{ source: 'class_passive', value: 1 }]), 2);

eq('24. +1 +1 bonuses → radius 3',
  computeEffectiveVisionRadius([
    { source: 'class_passive',  value: 1 },
    { source: 'scouting_skill', value: 1 },
  ]), 3);

eq('25. very large bonus capped at MAX_VISION_RADIUS',
  computeEffectiveVisionRadius([{ source: 'temporary_buff', value: 99 }]),
  MAX_VISION_RADIUS);

eq('26. negative bonus floored at BASE_VISION_RADIUS',
  computeEffectiveVisionRadius([{ source: 'temporary_buff', value: -5 }]),
  BASE_VISION_RADIUS);

// ── 27–30: resolveVisionBonuses ───────────────────────────────────────────────

console.log('\n── resolveVisionBonuses ──');

check('27. no class → empty bonus list',
  resolveVisionBonuses(undefined).length === 0);

check('28. unregistered class → empty bonus list',
  resolveVisionBonuses('warrior').length === 0);

(function () {
  const buff: VisionBonus = { source: 'temporary_buff', value: 1, label: 'Test buff' };
  const bonuses = resolveVisionBonuses(undefined, [buff]);
  check('29. temporary bonus is included in resolved list',
    bonuses.length === 1 && bonuses[0].source === 'temporary_buff');
})();

(function () {
  const buff: VisionBonus = { source: 'temporary_buff', value: 1 };
  const bonuses = resolveVisionBonuses(undefined, [buff]);
  eq('30. resolved bonuses yield correct effective radius',
    computeEffectiveVisionRadius(bonuses), 2);
})();

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
