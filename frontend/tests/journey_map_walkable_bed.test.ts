/**
 * journey_map_walkable_bed.test.ts — Production Bridge Push 6
 *
 * Validates the WalkableBed generator:
 *   • Cell coverage — walkableCellKeys covers all HexLaneLayout cells
 *   • Zone count — clearings match HexLaneLayout.clearingZones count
 *   • Lane zones — primary count matches primary laneSegments count
 *   • Adjacency — startZone and gateZone exist and have connections
 *   • Prompt quality — bedPromptFragment non-empty and mentions key terms
 *   • Scenery constraint — sceneryConstraintFragment present
 *   • Scen safety — no scenery zone cell appears in walkable cell set (cross-check)
 *   • Role views — clearings/primaryLanes/secondaryLanes derived correctly
 *   • Determinism — two calls return the same bedPromptFragment
 *   • Multi-chapter — beds for Ch 1–5 all pass basic integrity
 */

import assert from 'assert';
import { getWalkableBed, getWalkableBedRange } from '../src/game/journeyMap/walkableBedGenerator';
import { getChapterHexLayout }                 from '../src/game/journeyMap/chapterHexLayout';
import { getChapterSceneryLayout }             from '../src/game/journeyMap/chapterSceneryLayout';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed   = 0;
let failed   = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`  ✗ ${name}\n      ${msg}`);
    console.log(`  ✗ ${name}\n      ${msg}`);
  }
}

function eq<T>(actual: T, expected: T, msg = ''): void {
  assert.strictEqual(
    actual, expected,
    msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function ok(value: unknown, msg = ''): void {
  assert.ok(value, msg || 'Expected truthy value');
}

function gt(actual: number, floor: number, msg = ''): void {
  assert.ok(
    actual > floor,
    msg || `Expected ${actual} > ${floor}`,
  );
}

function contains(haystack: string, needle: string, msg = ''): void {
  assert.ok(
    haystack.includes(needle),
    msg || `Expected string to contain "${needle}"`,
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cellKey(q: number, r: number): string {
  return `${q},${r}`;
}

// ── Chapter 1 — primary chapter under test ────────────────────────────────────

const CH = 1;

const bed1    = getWalkableBed(CH);
const layout1 = getChapterHexLayout(CH);
const scenery1 = getChapterSceneryLayout(CH);

console.log('\njourne_map_walkable_bed');
console.log('──────────────────────────────────────────────────────────────────────');

// ── 1. Basic structure ────────────────────────────────────────────────────────

test('Ch1 bed is returned without error', () => {
  ok(bed1, 'getWalkableBed(1) returned falsy');
});

test('Ch1 chapterId matches', () => {
  eq(bed1.chapterId, CH);
});

// ── 2. Cell coverage ──────────────────────────────────────────────────────────

test('walkableCellKeys covers every HexLaneLayout cell', () => {
  const bedKeys = new Set(bed1.walkableCellKeys);
  let missing = 0;
  for (const c of layout1.cells) {
    if (!bedKeys.has(cellKey(c.q, c.r))) missing++;
  }
  eq(missing, 0, `${missing} layout cells are absent from walkableCellKeys`);
});

test('walkableCellKeys count matches layout.actualTileCount', () => {
  eq(
    bed1.walkableCellKeys.length,
    layout1.actualTileCount,
    `bed has ${bed1.walkableCellKeys.length} keys but layout has ${layout1.actualTileCount} tiles`,
  );
});

// ── 3. Zone counts ────────────────────────────────────────────────────────────

test('clearings count matches layout.clearingZones.length', () => {
  eq(
    bed1.clearings.length,
    layout1.clearingZones.length,
    `Expected ${layout1.clearingZones.length} clearing zones, got ${bed1.clearings.length}`,
  );
});

test('all zones have unique ids', () => {
  const ids = bed1.zones.map(z => z.id);
  const unique = new Set(ids);
  eq(unique.size, ids.length, `Duplicate zone IDs detected`);
});

test('clearings + lanes = all zones', () => {
  const total = bed1.clearings.length + bed1.primaryLanes.length + bed1.secondaryLanes.length;
  eq(total, bed1.zones.length, `Role views total (${total}) ≠ zones length (${bed1.zones.length})`);
});

// ── 4. Lane zone quality ──────────────────────────────────────────────────────

test('primary lane zones are present', () => {
  const expectedPrimary = layout1.laneSegments.filter(s => s.width === 'primary').length;
  if (expectedPrimary === 0) {
    eq(bed1.primaryLanes.length, 0, 'Lane-free courtyard layout should not invent primary lanes');
    return;
  }
  ok(bed1.primaryLanes.length > 0, 'No primary lane zones found');
  eq(
    bed1.primaryLanes.length,
    expectedPrimary,
    `Expected ${expectedPrimary} primary lane zones, got ${bed1.primaryLanes.length}`,
  );
});

test('secondary lane zones are present', () => {
  const expectedSecondary = layout1.laneSegments.filter(s => s.width === 'secondary').length;
  if (expectedSecondary === 0) {
    eq(bed1.secondaryLanes.length, 0, 'Lane-free courtyard layout should not invent secondary lanes');
    return;
  }
  ok(bed1.secondaryLanes.length > 0, 'No secondary lane zones found');
  eq(
    bed1.secondaryLanes.length,
    expectedSecondary,
    `Expected ${expectedSecondary} secondary lane zones, got ${bed1.secondaryLanes.length}`,
  );
});

test('all lane zones have a laneDirection', () => {
  const laneZones = [...bed1.primaryLanes, ...bed1.secondaryLanes];
  for (const z of laneZones) {
    ok(
      z.laneDirection === 'horizontal' || z.laneDirection === 'vertical' || z.laneDirection === 'diagonal',
      `Zone ${z.id} missing valid laneDirection, got ${z.laneDirection}`,
    );
  }
});

test('all lane zones have a worldPosition', () => {
  for (const z of [...bed1.primaryLanes, ...bed1.secondaryLanes]) {
    ok(z.worldPosition.length > 0, `Zone ${z.id} has empty worldPosition`);
  }
});

// ── 5. Clearing zone quality ──────────────────────────────────────────────────

test('clearing zones have clearingType', () => {
  for (const cz of bed1.clearings) {
    ok(cz.clearingType, `Clearing ${cz.id} is missing clearingType`);
  }
});

test('clearing zones have clearingShape', () => {
  for (const cz of bed1.clearings) {
    ok(cz.clearingShape, `Clearing ${cz.id} is missing clearingShape`);
  }
});

test('clearing zones have exitCount ≥ 1', () => {
  for (const cz of bed1.clearings) {
    ok((cz.exitCount ?? 0) >= 1, `Clearing ${cz.id} has exitCount ${cz.exitCount}`);
  }
});

test('clearing zones have worldPosition', () => {
  for (const cz of bed1.clearings) {
    ok(cz.worldPosition.length > 0, `Clearing ${cz.id} has empty worldPosition`);
  }
});

// ── 6. Adjacency ──────────────────────────────────────────────────────────────

test('startZone is non-null', () => {
  ok(bed1.startZone, 'startZone should not be null');
});

test('gateZone is non-null', () => {
  ok(bed1.gateZone, 'gateZone should not be null');
});

test('startZone has at least 1 connection', () => {
  gt(
    bed1.startZone!.connectsTo.length, 0,
    `startZone ${bed1.startZone!.id} has no connections`,
  );
});

test('gateZone has at least 1 connection', () => {
  gt(
    bed1.gateZone!.connectsTo.length, 0,
    `gateZone ${bed1.gateZone!.id} has no connections`,
  );
});

test('every connectsTo id references a real zone', () => {
  const zoneIds = new Set(bed1.zones.map(z => z.id));
  let bad = 0;
  for (const zone of bed1.zones) {
    for (const ref of zone.connectsTo) {
      if (!zoneIds.has(ref)) bad++;
    }
  }
  eq(bad, 0, `${bad} dangling connectsTo references found`);
});

test('adjacency is symmetric', () => {
  let asymmetric = 0;
  for (const zone of bed1.zones) {
    for (const refId of zone.connectsTo) {
      const refZone = bed1.zones.find(z => z.id === refId)!;
      if (!refZone.connectsTo.includes(zone.id)) asymmetric++;
    }
  }
  eq(asymmetric, 0, `${asymmetric} asymmetric adjacency pairs found`);
});

// ── 7. Prompt fragment quality ────────────────────────────────────────────────

test('bedPromptFragment is non-empty', () => {
  ok(bed1.bedPromptFragment.length > 50, `bedPromptFragment is too short: "${bed1.bedPromptFragment}"`);
});

test('bedPromptFragment contains WALKABLE FLOOR BED header', () => {
  contains(bed1.bedPromptFragment, 'WALKABLE FLOOR BED');
});

test('bedPromptFragment contains clearing mention', () => {
  contains(bed1.bedPromptFragment, 'OPEN COURTS', `bedPromptFragment missing clearing section`);
});

test('bedPromptFragment describes either corridors or a lane-free courtyard network', () => {
  const hasLanes = layout1.laneSegments.length > 0;
  contains(bed1.bedPromptFragment, hasLanes ? 'PRIMARY CORRIDORS' : 'COURTYARD NETWORK');
});

test('bedPromptFragment contains ENTRANCE and GATE', () => {
  contains(bed1.bedPromptFragment, 'ENTRANCE');
  contains(bed1.bedPromptFragment, 'GATE');
});

test('bedPromptFragment contains scenery constraint', () => {
  contains(bed1.bedPromptFragment, 'negative space');
});

test('bedPromptFragment references every clearing worldPosition', () => {
  for (const cz of bed1.clearings) {
    contains(
      bed1.bedPromptFragment,
      cz.worldPosition,
      `bedPromptFragment does not mention clearing position "${cz.worldPosition}"`,
    );
  }
});

test('sceneryConstraintFragment is non-empty', () => {
  ok(bed1.sceneryConstraintFragment.length > 50);
});

test('sceneryConstraintFragment mentions negative space', () => {
  contains(bed1.sceneryConstraintFragment, 'negative space');
});

// ── 8. Scenery safety cross-check ─────────────────────────────────────────────

test('no SceneryZone cell overlaps with walkable cell set', () => {
  const walkableKeys = new Set(bed1.walkableCellKeys);
  let overlap = 0;
  for (const sz of scenery1.sceneryZones) {
    for (const c of sz.cells) {
      if (walkableKeys.has(cellKey(c.q, c.r))) overlap++;
    }
  }
  eq(overlap, 0, `${overlap} scenery zone cells overlap with walkable cells`);
});

// ── 9. Determinism ────────────────────────────────────────────────────────────

test('two calls return the same object (cache)', () => {
  const bed1a = getWalkableBed(CH);
  assert.strictEqual(bed1a, bed1, 'getWalkableBed should return the cached object');
});

test('bedPromptFragment is stable across calls', () => {
  const bed1b = getWalkableBed(CH);
  eq(bed1b.bedPromptFragment, bed1.bedPromptFragment);
});

// ── 10. Multi-chapter integrity (Ch 1–5) ──────────────────────────────────────

const range = getWalkableBedRange(1, 5);

test('getWalkableBedRange(1,5) returns 5 beds', () => {
  eq(range.length, 5);
});

for (let ch = 1; ch <= 5; ch++) {
  const bed = range[ch - 1];
  const layout = getChapterHexLayout(ch);

  test(`Ch${ch}: walkableCellKeys covers all layout cells`, () => {
    const keys = new Set(bed.walkableCellKeys);
    let missing = 0;
    for (const c of layout.cells) {
      if (!keys.has(cellKey(c.q, c.r))) missing++;
    }
    eq(missing, 0, `Ch${ch}: ${missing} layout cells absent from walkableCellKeys`);
  });

  test(`Ch${ch}: clearings count matches layout`, () => {
    eq(
      bed.clearings.length,
      layout.clearingZones.length,
      `Ch${ch}: ${bed.clearings.length} vs ${layout.clearingZones.length}`,
    );
  });

  test(`Ch${ch}: startZone and gateZone are non-null`, () => {
    ok(bed.startZone, `Ch${ch}: startZone is null`);
    ok(bed.gateZone,  `Ch${ch}: gateZone is null`);
  });

  test(`Ch${ch}: bedPromptFragment mentions WALKABLE FLOOR BED`, () => {
    contains(bed.bedPromptFragment, 'WALKABLE FLOOR BED');
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('──────────────────────────────────────────────────────────────────────');
if (failed > 0) {
  console.log(`\nFailures:\n${failures.join('\n')}`);
}
console.log(`\njourne_map_walkable_bed: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
