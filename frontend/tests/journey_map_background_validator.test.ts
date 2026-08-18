/**
 * journey_map_background_validator.test.ts — Task 766
 *
 * Validates the backgroundValidator module (geometry-level obstacle-safe
 * background composition):
 *   • Scenery classification — blocking vs non-blocking sets
 *   • Ch1 passes validation with the current SceneryLayout (safety mask
 *     already enforces no overlap geometrically)
 *   • A synthetic scene with a blocking zone injected into the bed returns
 *     pass: false with correct violation data
 *   • Referential stability — same result object on repeated calls
 *   • Manifest integration — validationResult drives the 'validated' status
 */

import assert from 'assert';
import {
  validateBackgroundComposition,
  type BackgroundValidationResult,
} from '../src/game/journeyMap/backgroundValidator';
import {
  BLOCKING_SCENERY_TYPES,
  NON_BLOCKING_SCENERY_TYPES,
  isBlockingSceneryZone,
  sceneryTypeLabel,
} from '../src/game/journeyMap/sceneryClassification';
import { getChapterSceneryLayout } from '../src/game/journeyMap/chapterSceneryLayout';
import { getWalkableBed } from '../src/game/journeyMap/walkableBedGenerator';
import { getBackgroundAuthoringManifests } from '../src/game/journeyMap/backgroundAuthoringManifest';
import type { SceneryLayout, SceneryZone, WalkableBed } from '../src/game/journeyMap/chapterMapTemplate.types';

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
  assert.strictEqual(actual, expected, msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function ok(value: unknown, msg = ''): void {
  assert.ok(value, msg || 'Expected truthy value');
}

// ── Shared fixtures ───────────────────────────────────────────────────────────

const scenery = getChapterSceneryLayout(1);
const bed     = getWalkableBed(1);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[1] Scenery classification');
// ─────────────────────────────────────────────────────────────────────────────

test('the 7 task-named types + ARCHITECTURE are blocking', () => {
  for (const t of [
    'SIMULATION_STRUCTURE', 'GARDEN', 'COLUMN_GROUP', 'BUILDING_WING',
    'OBSERVATION_DECK', 'WATER_FEATURE', 'ACADEMIC_STATUE', 'ARCHITECTURE',
  ] as const) {
    ok(isBlockingSceneryZone(t), `${t} should be blocking`);
    ok(BLOCKING_SCENERY_TYPES.has(t), `${t} missing from BLOCKING_SCENERY_TYPES`);
  }
});

test('PLANTER and DECORATIVE_LANDMARK are non-blocking', () => {
  for (const t of ['PLANTER', 'DECORATIVE_LANDMARK'] as const) {
    ok(!isBlockingSceneryZone(t), `${t} should be non-blocking`);
    ok(NON_BLOCKING_SCENERY_TYPES.has(t), `${t} missing from NON_BLOCKING_SCENERY_TYPES`);
  }
});

test('blocking and non-blocking sets are disjoint', () => {
  for (const t of BLOCKING_SCENERY_TYPES) {
    ok(!NON_BLOCKING_SCENERY_TYPES.has(t), `${t} appears in both sets`);
  }
});

test('sceneryTypeLabel produces lowercase spaced labels', () => {
  eq(sceneryTypeLabel('SIMULATION_STRUCTURE'), 'simulation structure');
  eq(sceneryTypeLabel('GARDEN'), 'garden');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[2] Ch1 canonical layout passes validation');
// ─────────────────────────────────────────────────────────────────────────────

const ch1Result = validateBackgroundComposition(1, scenery, bed);

test('Ch1 validation passes (safety mask enforces zero overlap)', () => {
  ok(ch1Result.pass, `violations: ${JSON.stringify(ch1Result.violations)}`);
  eq(ch1Result.violations.length, 0);
});

test('Ch1 result metadata is correct', () => {
  eq(ch1Result.chapterId, 1);
  eq(ch1Result.checkedZoneCount, scenery.sceneryZones.length);
  eq(ch1Result.walkableCellCount, bed.walkableCellKeys.length);
  ok(ch1Result.blockingZoneCount <= ch1Result.checkedZoneCount, 'blocking count exceeds total');
});

test('blockingZoneCount matches classification of the actual zones', () => {
  const expected = scenery.sceneryZones.filter(z => isBlockingSceneryZone(z.type)).length;
  eq(ch1Result.blockingZoneCount, expected);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[3] Synthetic violation detection');
// ─────────────────────────────────────────────────────────────────────────────

// Inject a blocking zone whose cells sit INSIDE the walkable bed.
const bedCell0 = bed.walkableCellKeys[0].split(',').map(Number);
const bedCell1 = bed.walkableCellKeys[1].split(',').map(Number);

const illegalZone: SceneryZone = {
  id:                  'synthetic_illegal_zone',
  type:                'SIMULATION_STRUCTURE',
  cells:               [
    { q: bedCell0[0], r: bedCell0[1] },   // inside the bed → violation
    { q: bedCell1[0], r: bedCell1[1] },   // inside the bed → violation
    { q: 9999, r: 9999 },                 // far outside → not a violation
  ],
  centroid:            { q: bedCell0[0], r: bedCell0[1] },
  area:                3,
  walkableContactCount: 2,
  isEnclosed:          false,
  nearestClearingDist: 1,
};

// Also inject a NON-blocking zone inside the bed — must NOT produce a violation.
const decorativeZone: SceneryZone = {
  ...illegalZone,
  id:   'synthetic_decorative_zone',
  type: 'PLANTER',
};

const syntheticScenery: SceneryLayout = {
  ...scenery,
  sceneryZones: [...scenery.sceneryZones, illegalZone, decorativeZone],
};

const syntheticResult = validateBackgroundComposition(1, syntheticScenery, bed);

test('synthetic blocking zone inside the bed fails validation', () => {
  eq(syntheticResult.pass, false);
  eq(syntheticResult.violations.length, 1, `violations: ${JSON.stringify(syntheticResult.violations)}`);
});

test('violation names the offending zone and type', () => {
  const v = syntheticResult.violations[0];
  eq(v.zoneId, 'synthetic_illegal_zone');
  eq(v.zoneType, 'SIMULATION_STRUCTURE');
});

test('violation lists exactly the overlapping cell keys (not the outside cell)', () => {
  const v = syntheticResult.violations[0];
  eq(v.overlappingCellKeys.length, 2);
  ok(v.overlappingCellKeys.includes(bed.walkableCellKeys[0]), 'missing first bed cell');
  ok(v.overlappingCellKeys.includes(bed.walkableCellKeys[1]), 'missing second bed cell');
  ok(!v.overlappingCellKeys.includes('9999,9999'), 'outside cell wrongly flagged');
});

test('non-blocking zone inside the bed does NOT violate', () => {
  ok(
    !syntheticResult.violations.some(v => v.zoneId === 'synthetic_decorative_zone'),
    'PLANTER zone should never appear in violations',
  );
});

test('synthetic scenery includes the injected zones in checkedZoneCount', () => {
  eq(syntheticResult.checkedZoneCount, scenery.sceneryZones.length + 2);
  eq(syntheticResult.blockingZoneCount, ch1Result.blockingZoneCount + 1);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[4] Referential stability');
// ─────────────────────────────────────────────────────────────────────────────

test('same (scenery, bed) inputs return the SAME result object', () => {
  const again = validateBackgroundComposition(1, scenery, bed);
  ok(again === ch1Result, 'expected reference equality for canonical inputs');
});

test('synthetic inputs are also referentially stable', () => {
  const again = validateBackgroundComposition(1, syntheticScenery, bed);
  ok(again === syntheticResult, 'expected reference equality for synthetic inputs');
});

test('different scenery objects produce different result objects', () => {
  ok(ch1Result !== syntheticResult, 'distinct inputs must not share a cached result');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[5] Manifest integration');
// ─────────────────────────────────────────────────────────────────────────────

test('manifest validationResult is the canonical Ch1 result', () => {
  const manifests = getBackgroundAuthoringManifests(1);
  for (const m of manifests) {
    ok(m.validationResult === ch1Result, `${m.shift}: expected shared cached result`);
  }
});

test('passing validation promotes Ch1 raster statuses to validated', () => {
  const manifests = getBackgroundAuthoringManifests(1);
  for (const m of manifests) {
    eq(m.assetStatus, 'validated', `${m.shift}: status = ${m.assetStatus}`);
  }
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
