/**
 * canonical_encounters.test.ts
 *
 * Deterministic tests for journeyMap/canonicalEncounters.ts (Push 2).
 *
 * Run: npx sucrase-node tests/canonical_encounters.test.ts
 *
 * Covers:
 *  1.  Determinism: same seed + chapter + timeOfDay → identical output
 *  2.  Different seeds → different tile assignments
 *  3.  Different timeOfDay → different assignment (ward event rates differ)
 *  4.  Start tile always 'none'
 *  5.  Gate anchor always 'none'
 *  6.  Area boss hard max ≤ 3 (at chapters where rate > 0)
 *  7.  Every area boss tile has graphDistanceFromStart ≥ 3
 *  8.  Battle count ≤ floor(eligible × densityCap / 10000)
 *  9.  All treasure tiles have chestTier defined
 * 10.  No non-treasure tile has chestTier
 * 11.  All wardEvent tiles have a valid wardEventSubtype
 * 12.  No non-wardEvent tile has wardEventSubtype
 * 13.  Chapter 1 produces zero area boss tiles (rate is 0%)
 * 14.  Chapter 1 produces zero ward event tiles (rate is 0%)
 * 15.  Chapter 2 night produces zero ward event tiles (rate is 0%)
 * 16.  Chapter 2 day may produce ward event tiles (rate is 5%)
 * 17.  Total tile count equals topology.tiles.length
 * 18.  Encounter counts are non-negative
 * 19.  Day/evening/night all produce valid caps (cross-time-of-day sweep)
 * 20.  High chapter (100) with day: battle count ≤ day density cap
 */

import { generateHexTopology } from '../src/game/journeyMap/topology';
import {
  assignCanonicalEncounters,
  WARD_EVENT_SUBTYPES,
  type CanonicalEncounterType,
  type WardEventSubtype,
} from '../src/game/journeyMap/canonicalEncounters';
import {
  CANONICAL_AREA_BOSS_HARD_MAX,
  CANONICAL_TOTAL_BP,
  canonicalEnemyDensityCapBp,
  TIME_OF_DAY_VALUES,
  type TimeOfDay,
} from '../src/game/journeyMap/canonicalConfig';

// ── Test harness ───────────────────────────────────────────────────────────────

let _errors = 0;
function check(name: string, pass: boolean, detail = '') {
  if (pass) {
    console.log(`PASS - ${name}`);
  } else {
    console.error(`FAIL - ${name}${detail ? ` (${detail})` : ''}`);
    _errors++;
  }
}

// ── Shared topology fixtures ───────────────────────────────────────────────────
// Chapters and seeds are arbitrary but fixed — changing them would require
// updating expected values in the tests below.

const SEED_A  = 'canonical-test-seed-alpha';
const SEED_B  = 'canonical-test-seed-beta';

const topo5   = generateHexTopology({ chapter:   5, seed: SEED_A });
const topo10  = generateHexTopology({ chapter:  10, seed: SEED_A });
const topo1   = generateHexTopology({ chapter:   1, seed: SEED_A });
const topo2   = generateHexTopology({ chapter:   2, seed: SEED_A });
const topo100 = generateHexTopology({ chapter: 100, seed: SEED_A });

// ── 1. Determinism ─────────────────────────────────────────────────────────────

console.log('\n── 1. Determinism ──');

{
  const a = assignCanonicalEncounters({ chapter: 5, seed: SEED_A, timeOfDay: 'day', topology: topo5 });
  const b = assignCanonicalEncounters({ chapter: 5, seed: SEED_A, timeOfDay: 'day', topology: topo5 });
  check('same seed/chapter/tod → identical tile order',
    a.tiles.map(t => t.tileKey).join('|') === b.tiles.map(t => t.tileKey).join('|'));
  check('same seed/chapter/tod → identical encounters',
    a.tiles.map(t => t.encounter).join('|') === b.tiles.map(t => t.encounter).join('|'));
  check('same seed/chapter/tod → identical chest tiers',
    a.tiles.map(t => t.chestTier ?? '-').join('|') === b.tiles.map(t => t.chestTier ?? '-').join('|'));
  check('same seed/chapter/tod → identical areaBossCount',
    a.areaBossCount === b.areaBossCount);
  check('same seed/chapter/tod → identical battleCount',
    a.battleCount === b.battleCount);
}

// Determinism at chapter 10
{
  const a = assignCanonicalEncounters({ chapter: 10, seed: SEED_A, timeOfDay: 'evening', topology: topo10 });
  const b = assignCanonicalEncounters({ chapter: 10, seed: SEED_A, timeOfDay: 'evening', topology: topo10 });
  check('ch10/evening determinism',
    a.tiles.map(t => `${t.encounter}:${t.chestTier ?? ''}:${t.wardEventSubtype ?? ''}`).join('|') ===
    b.tiles.map(t => `${t.encounter}:${t.chestTier ?? ''}:${t.wardEventSubtype ?? ''}`).join('|'));
}

// ── 2. Different seeds → different results ────────────────────────────────────

console.log('\n── 2. Seed independence ──');

{
  const topoB5 = generateHexTopology({ chapter: 5, seed: SEED_B });
  const ra = assignCanonicalEncounters({ chapter: 5, seed: SEED_A, timeOfDay: 'day', topology: topo5 });
  const rb = assignCanonicalEncounters({ chapter: 5, seed: SEED_B, timeOfDay: 'day', topology: topoB5 });
  // Two runs with different seeds should differ (probability of identical 33-tile
  // encounter string is astronomically small).
  const sameEncounters = ra.tiles
    .filter(t => !['none'].includes(t.encounter))
    .map(t => t.encounter).join(',') ===
    rb.tiles
    .filter(t => !['none'].includes(t.encounter))
    .map(t => t.encounter).join(',');
  check('different seeds → different encounter string', !sameEncounters,
    'both runs produced the identical non-none encounter string (unexpected)');
}

// ── 3. timeOfDay independence ─────────────────────────────────────────────────

console.log('\n── 3. TimeOfDay independence ──');

{
  // At chapter 10 with ward events (15% day vs 12% evening vs 9% night),
  // runs with different times of day should differ.
  const day   = assignCanonicalEncounters({ chapter: 10, seed: SEED_A, timeOfDay: 'day',     topology: topo10 });
  const night = assignCanonicalEncounters({ chapter: 10, seed: SEED_A, timeOfDay: 'night',   topology: topo10 });
  const sameEnc = day.tiles.map(t => t.encounter).join('|') === night.tiles.map(t => t.encounter).join('|');
  check('day vs night → different encounter assignment', !sameEnc,
    'day and night produced identical encounter strings');
}

// ── 4 & 5. Frozen tiles ───────────────────────────────────────────────────────

console.log('\n── 4 & 5. Frozen tiles ──');

for (const [label, topo, chapter] of [
  ['ch1',  topo1,  1],
  ['ch5',  topo5,  5],
  ['ch10', topo10, 10],
] as const) {
  const result = assignCanonicalEncounters({ chapter: chapter as number, seed: SEED_A, timeOfDay: 'day', topology: topo });
  const tileMap = new Map(result.tiles.map(t => [t.tileKey, t]));

  const startTile = tileMap.get(topo.startTileId);
  check(`${label}: start tile encounter='none'`,
    startTile !== undefined && startTile.encounter === 'none',
    `got encounter='${startTile?.encounter}'`);

  const gateTile = tileMap.get(topo.gateAnchorId);
  check(`${label}: gate tile encounter='none'`,
    gateTile !== undefined && gateTile.encounter === 'none',
    `got encounter='${gateTile?.encounter}'`);
}

// ── 6 & 7. Area boss constraints ──────────────────────────────────────────────

console.log('\n── 6 & 7. Area boss constraints ──');

// Run 20 independent seeds at chapter 10 (area boss rate = 3%) and
// verify hard max and distance constraints hold every time.
for (let i = 0; i < 20; i++) {
  const seed = `area-boss-test-seed-${i}`;
  const topo = generateHexTopology({ chapter: 10, seed });
  const result = assignCanonicalEncounters({ chapter: 10, seed, timeOfDay: 'day', topology: topo });

  check(`seed${i} ch10: areaBossCount <= ${CANONICAL_AREA_BOSS_HARD_MAX}`,
    result.areaBossCount <= CANONICAL_AREA_BOSS_HARD_MAX,
    `got ${result.areaBossCount}`);

  const areaBossTiles = result.tiles.filter(t => t.encounter === 'areaBoss');
  check(`seed${i} ch10: areaBossCount matches tile list`,
    areaBossTiles.length === result.areaBossCount);

  const distViolations = areaBossTiles.filter(t => t.graphDistanceFromStart < 3);
  check(`seed${i} ch10: all area boss tiles at dist >= 3`,
    distViolations.length === 0,
    `${distViolations.length} violation(s) at dist=${distViolations.map(t => t.graphDistanceFromStart).join(',')}`);
}

// Also verify at chapter 1 (rate = 0%) and chapter 3 (rate = 0%) — always 0
{
  const r1 = assignCanonicalEncounters({ chapter: 1, seed: SEED_A, timeOfDay: 'day', topology: topo1 });
  check('ch1: zero area boss tiles', r1.areaBossCount === 0, `got ${r1.areaBossCount}`);

  const topo3 = generateHexTopology({ chapter: 3, seed: SEED_A });
  const r3 = assignCanonicalEncounters({ chapter: 3, seed: SEED_A, timeOfDay: 'day', topology: topo3 });
  check('ch3: zero area boss tiles', r3.areaBossCount === 0, `got ${r3.areaBossCount}`);
}

// ── 8. Battle density cap ─────────────────────────────────────────────────────

console.log('\n── 8. Battle density caps ──');

for (const tod of TIME_OF_DAY_VALUES) {
  // Test across multiple chapters and seeds
  for (const [ch, topo] of [[5, topo5], [10, topo10], [100, topo100]] as const) {
    const result     = assignCanonicalEncounters({ chapter: ch as number, seed: SEED_A, timeOfDay: tod, topology: topo });
    const eligible   = topo.tiles.length - 2; // minus start and gate
    const densityCap = Math.floor(eligible * canonicalEnemyDensityCapBp(tod) / CANONICAL_TOTAL_BP);

    check(`ch${ch}/${tod}: battleCount (${result.battleCount}) <= densityCap (${densityCap})`,
      result.battleCount <= densityCap);
  }
}

// ── 9 & 10. Chest tiers ───────────────────────────────────────────────────────

console.log('\n── 9 & 10. Chest tiers ──');

{
  const result = assignCanonicalEncounters({ chapter: 10, seed: SEED_A, timeOfDay: 'day', topology: topo10 });

  const treasureTiles    = result.tiles.filter(t => t.encounter === 'treasure');
  const nonTreasureTiles = result.tiles.filter(t => t.encounter !== 'treasure');

  const missingTier = treasureTiles.filter(t => t.chestTier === undefined);
  check('all treasure tiles have chestTier', missingTier.length === 0,
    `${missingTier.length} treasure tiles missing chestTier`);

  const validTiers = new Set(['bronze', 'silver', 'gold']);
  const invalidTier = treasureTiles.filter(t => !validTiers.has(t.chestTier!));
  check('all chest tiers are valid values', invalidTier.length === 0,
    `invalid tiers: ${invalidTier.map(t => t.chestTier).join(',')}`);

  const unexpectedTier = nonTreasureTiles.filter(t => t.chestTier !== undefined);
  check('no non-treasure tile has chestTier', unexpectedTier.length === 0,
    `${unexpectedTier.length} non-treasure tiles have chestTier`);
}

// ── 11 & 12. Ward event subtypes ─────────────────────────────────────────────

console.log('\n── 11 & 12. Ward event subtypes ──');

{
  // Chapter 10 day has ward event rate 15% — should produce several ward events
  const result = assignCanonicalEncounters({ chapter: 10, seed: SEED_A, timeOfDay: 'day', topology: topo10 });

  const wardTiles    = result.tiles.filter(t => t.encounter === 'wardEvent');
  const nonWardTiles = result.tiles.filter(t => t.encounter !== 'wardEvent');

  const missingSubtype = wardTiles.filter(t => t.wardEventSubtype === undefined);
  check('all wardEvent tiles have wardEventSubtype', missingSubtype.length === 0,
    `${missingSubtype.length} wardEvent tiles missing subtype`);

  const validSubtypes = new Set<string>(WARD_EVENT_SUBTYPES);
  const invalidSubtype = wardTiles.filter(t => !validSubtypes.has(t.wardEventSubtype!));
  check('all ward event subtypes are valid', invalidSubtype.length === 0,
    `invalid: ${invalidSubtype.map(t => t.wardEventSubtype).join(',')}`);

  const unexpectedSubtype = nonWardTiles.filter(t => t.wardEventSubtype !== undefined);
  check('no non-wardEvent tile has wardEventSubtype', unexpectedSubtype.length === 0,
    `${unexpectedSubtype.length} non-wardEvent tiles have subtypes`);
}

// ── 13. Chapter 1: zero area boss ─────────────────────────────────────────────

console.log('\n── 13-16. Chapter-specific encounter constraints ──');

{
  for (const tod of TIME_OF_DAY_VALUES) {
    const r = assignCanonicalEncounters({ chapter: 1, seed: SEED_A, timeOfDay: tod, topology: topo1 });
    check(`ch1/${tod}: zero area boss (rate=0%)`,
      r.areaBossCount === 0, `got ${r.areaBossCount}`);
  }
}

// ── 14. Chapter 1: zero ward events ──────────────────────────────────────────

{
  for (const tod of TIME_OF_DAY_VALUES) {
    const r = assignCanonicalEncounters({ chapter: 1, seed: SEED_A, timeOfDay: tod, topology: topo1 });
    check(`ch1/${tod}: zero ward events (rate=0%)`,
      r.wardEventCount === 0, `got ${r.wardEventCount}`);
  }
}

// ── 15. Chapter 2 night: zero ward events ────────────────────────────────────

{
  const topo2b = generateHexTopology({ chapter: 2, seed: SEED_B });
  // Run 10 seeds to build statistical confidence that night always gives 0
  let nightWardEventTotal = 0;
  for (let i = 0; i < 10; i++) {
    const s = `ch2-night-seed-${i}`;
    const t = generateHexTopology({ chapter: 2, seed: s });
    const r = assignCanonicalEncounters({ chapter: 2, seed: s, timeOfDay: 'night', topology: t });
    nightWardEventTotal += r.wardEventCount;
  }
  check('ch2/night: zero ward events across 10 seeds (rate=0%)',
    nightWardEventTotal === 0, `total=${nightWardEventTotal}`);
}

// ── 16. Chapter 2 day: may produce ward events (rate = 5%) ───────────────────

{
  // Run 20 seeds at ch2/day — expect at least one to produce a ward event.
  let anyWardEvents = false;
  for (let i = 0; i < 20; i++) {
    const s = `ch2-day-seed-${i}`;
    const t = generateHexTopology({ chapter: 2, seed: s });
    const r = assignCanonicalEncounters({ chapter: 2, seed: s, timeOfDay: 'day', topology: t });
    if (r.wardEventCount > 0) { anyWardEvents = true; break; }
  }
  check('ch2/day: at least one run produces a ward event (rate=5%)', anyWardEvents,
    'all 20 seeds produced zero ward events — generator may be ignoring wardEvent rate');
}

// ── 17. Total tile count ──────────────────────────────────────────────────────

console.log('\n── 17-19. Total tile count and non-negative counters ──');

{
  for (const [ch, topo] of [[1, topo1], [5, topo5], [10, topo10], [100, topo100]] as const) {
    const r = assignCanonicalEncounters({ chapter: ch as number, seed: SEED_A, timeOfDay: 'day', topology: topo });
    check(`ch${ch}: result.tiles.length === topology.tiles.length`,
      r.tiles.length === topo.tiles.length,
      `${r.tiles.length} vs ${topo.tiles.length}`);
  }
}

// ── 18. Non-negative counters ────────────────────────────────────────────────

{
  const r = assignCanonicalEncounters({ chapter: 10, seed: SEED_A, timeOfDay: 'evening', topology: topo10 });
  check('areaBossCount >= 0',  r.areaBossCount  >= 0);
  check('battleCount >= 0',    r.battleCount    >= 0);
  check('treasureCount >= 0',  r.treasureCount  >= 0);
  check('merchantCount >= 0',  r.merchantCount  >= 0);
  check('wardEventCount >= 0', r.wardEventCount >= 0);
}

// ── 19. Cross-time-of-day validity sweep ─────────────────────────────────────

{
  for (const tod of TIME_OF_DAY_VALUES) {
    const result   = assignCanonicalEncounters({ chapter: 5, seed: SEED_A, timeOfDay: tod, topology: topo5 });
    const eligible = topo5.tiles.length - 2;
    const densityCap = Math.floor(eligible * canonicalEnemyDensityCapBp(tod) / CANONICAL_TOTAL_BP);

    check(`ch5/${tod}: battleCount <= densityCap`,    result.battleCount    <= densityCap);
    check(`ch5/${tod}: areaBossCount <= hard max`,    result.areaBossCount  <= CANONICAL_AREA_BOSS_HARD_MAX);
    check(`ch5/${tod}: tile count === topology size`, result.tiles.length   === topo5.tiles.length);
  }
}

// ── 20. High chapter battle density cap ──────────────────────────────────────

console.log('\n── 20. High chapter density cap ──');

{
  const eligible   = topo100.tiles.length - 2;
  const densityCap = Math.floor(eligible * canonicalEnemyDensityCapBp('day') / CANONICAL_TOTAL_BP);
  const r          = assignCanonicalEncounters({ chapter: 100, seed: SEED_A, timeOfDay: 'day', topology: topo100 });

  check(`ch100/day: battleCount (${r.battleCount}) <= densityCap (${densityCap})`,
    r.battleCount <= densityCap);
  check('ch100/day: areaBossCount <= 3', r.areaBossCount <= CANONICAL_AREA_BOSS_HARD_MAX,
    `got ${r.areaBossCount}`);
}

// ── Results ────────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${_errors === 0 ? 'ALL PASSED' : `${_errors} FAILED`} ──`);
if (_errors > 0) process.exit(1);
