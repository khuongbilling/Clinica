/**
 * tests/vision_config.test.ts
 *
 * Unit tests for the configurable field-of-vision system.
 * Run:  cd frontend && npx sucrase-node tests/vision_config.test.ts
 */

import {
  BASE_VISION_RADIUS,
  MAX_VISION_RADIUS,
  computeEffectiveVisionRadius,
  getClassVisionBonuses,
  resolveVisionBonuses,
  type VisionBonus,
} from '../src/game/journeyMap/visionConfig';

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect<T>(label: string, actual: T, expected: T) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`PASS - ${label}`);
    passed++;
  } else {
    console.error(`FAIL - ${label}`);
    console.error(`  expected: ${JSON.stringify(expected)}`);
    console.error(`  actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ── BASE_VISION_RADIUS ────────────────────────────────────────────────────────

expect('BASE_VISION_RADIUS is 1', BASE_VISION_RADIUS, 1);
expect('MAX_VISION_RADIUS is 4', MAX_VISION_RADIUS, 4);

// ── computeEffectiveVisionRadius ──────────────────────────────────────────────

console.log('\n── computeEffectiveVisionRadius ──');

expect(
  'no bonuses → BASE_VISION_RADIUS',
  computeEffectiveVisionRadius([]),
  1,
);

expect(
  'single class_passive +1 → 2',
  computeEffectiveVisionRadius([{ source: 'class_passive', value: 1 }]),
  2,
);

expect(
  'two bonuses +1+1 → 3',
  computeEffectiveVisionRadius([
    { source: 'class_passive',   value: 1 },
    { source: 'scouting_skill',  value: 1 },
  ]),
  3,
);

expect(
  'bonuses capped at MAX_VISION_RADIUS',
  computeEffectiveVisionRadius([{ source: 'temporary_buff', value: 99 }]),
  MAX_VISION_RADIUS,
);

expect(
  'negative bonus never goes below BASE_VISION_RADIUS',
  computeEffectiveVisionRadius([{ source: 'temporary_buff', value: -5 }]),
  BASE_VISION_RADIUS,
);

expect(
  'zero bonus → BASE_VISION_RADIUS',
  computeEffectiveVisionRadius([{ source: 'prodigy_trait', value: 0 }]),
  BASE_VISION_RADIUS,
);

expect(
  'exactly MAX_VISION_RADIUS from bonuses',
  computeEffectiveVisionRadius([{ source: 'class_passive', value: MAX_VISION_RADIUS - BASE_VISION_RADIUS }]),
  MAX_VISION_RADIUS,
);

// ── getClassVisionBonuses ─────────────────────────────────────────────────────

console.log('\n── getClassVisionBonuses ──');

expect(
  'undefined classTreeId → [] (no bonus)',
  getClassVisionBonuses(undefined),
  [],
);

expect(
  'unknown class → [] (no bonus registered)',
  getClassVisionBonuses('warrior'),
  [],
);

expect(
  'empty string classTreeId → [] (no bonus)',
  getClassVisionBonuses(''),
  [],
);

// ── resolveVisionBonuses ──────────────────────────────────────────────────────

console.log('\n── resolveVisionBonuses ──');

expect(
  'no class + no tempBonuses → []',
  resolveVisionBonuses(undefined),
  [],
);

expect(
  'unknown class + no tempBonuses → []',
  resolveVisionBonuses('surgeon'),
  [],
);

const tempBuff: VisionBonus = { source: 'temporary_buff', value: 1, label: 'Clarity Potion' };

expect(
  'no class + one tempBonus → [tempBonus]',
  resolveVisionBonuses(undefined, [tempBuff]),
  [tempBuff],
);

expect(
  'unknown class + two tempBonuses → two entries',
  resolveVisionBonuses('medic', [tempBuff, { source: 'scouting_skill', value: 1 }]).length,
  2,
);

expect(
  'effective radius from tempBonuses only',
  computeEffectiveVisionRadius(resolveVisionBonuses(undefined, [tempBuff])),
  2,
);

expect(
  'tempBonuses combined → stays within max',
  computeEffectiveVisionRadius(resolveVisionBonuses(undefined, [
    { source: 'temporary_buff', value: 2 },
    { source: 'scouting_skill', value: 2 },
  ])),
  MAX_VISION_RADIUS,
);

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
