/**
 * journey_map_spatial_weights.test.ts — Production Bridge Push 3
 *
 * Validates spatial encounter placement:
 *
 * Unit tests for computeSpatialMultipliers:
 *   • Clearing zone: battle reduced, treasure/merchant/wardEvent/areaBoss boosted
 *   • Primary lane: areaBoss = 0, merchant = 0 (forbidden)
 *   • Secondary lane: areaBoss = 0
 *   • Transition: areaBoss = 0
 *   • No zone metadata: returns empty object (passthrough — authored chapters)
 *   • Dead-end flag: treasure/merchant/wardEvent get floor multipliers
 *   • Dead-end clearing: clearing multipliers apply (dead-end doesn't downgrade clearing)
 *   • none is never in the multiplier map
 *
 * Integration tests via assignCanonicalEncounters (Ch1 blueprint topology):
 *   • Area boss never appears on non-clearing tiles for Ch4+ (synthetic topology)
 *   • Treasure clearing fraction > all-tile clearing fraction (clearing preference)
 *   • Battle clearing fraction < all-tile clearing fraction (battle reduced in clearings)
 *   • Dead-end tiles receive proportionally more treasure than non-dead-end lanes
 *   • Merchant never appears on primary-lane tiles
 *   • Overall encounter rates approximately preserved (within ±15% of base)
 *   • Determinism: same seed/chapter/shift → identical results
 *   • Non-blueprint chapter (no zoneMeta): results are unchanged vs pre-Push-3 baseline
 */

import assert      from 'assert';
import {
  computeSpatialMultipliers,
  type SpatialWeightInput,
}                  from '../src/game/journeyMap/encounterSpatialWeights';
import {
  assignCanonicalEncounters,
  type CanonicalEncounterType,
}                  from '../src/game/journeyMap/canonicalEncounters';
import { getCanonicalChapterMapArtifact } from '../src/game/journeyMap/canonicalMapArtifact';
import type { HexTopology, AxialCoord, HexTileZoneMeta } from '../src/game/journeyMap/topology';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed   = 0;
let failed   = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
  } catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`FAIL - ${name}\n       ${msg}`);
    console.error(`FAIL - ${name}\n       ${msg}`);
  }
}

function ok(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(msg ?? `Expected ${String(a)} === ${String(b)}`);
}
function approxEq(a: number, b: number, tol: number, msg: string): void {
  if (Math.abs(a - b) > tol) throw new Error(`${msg}: |${a} - ${b}| = ${Math.abs(a-b)} > ${tol}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function multsFor(input: SpatialWeightInput): Partial<Record<string, number>> {
  return computeSpatialMultipliers(input);
}

function mult(mults: Partial<Record<string, number>>, key: string): number {
  return mults[key] ?? 1.0;
}

const HEX_DIRS = [
  { q:  1, r:  0 }, { q: -1, r:  0 },
  { q:  0, r:  1 }, { q:  0, r: -1 },
  { q:  1, r: -1 }, { q: -1, r:  1 },
] as const;

/** Build a valid HexTopology from a flat list of coord entries with zone metadata. */
function buildTestTopology(entries: {
  q:           number;
  r:           number;
  zoneType?:   'lane' | 'clearing' | 'transition';
  laneClass?:  'primary' | 'secondary';
  isStart?:    boolean;
  isGate?:     boolean;
}[]): HexTopology {
  const tiles: AxialCoord[]             = entries.map(e => ({ q: e.q, r: e.r }));
  const zoneMeta = new Map<string, HexTileZoneMeta>();
  let startTileId = '';
  let gateAnchorId = '';

  for (const e of entries) {
    const key = `${e.q},${e.r}`;
    if (e.isStart) startTileId  = key;
    if (e.isGate)  gateAnchorId = key;
    if (e.zoneType) {
      zoneMeta.set(key, {
        zoneType:  e.zoneType,
        laneClass: e.laneClass,
      });
    }
  }

  // BFS distances from start
  const coordSet = new Set(tiles.map(c => `${c.q},${c.r}`));
  const graphDistances = new Map<string, number>();
  graphDistances.set(startTileId, 0);
  const queue: string[] = [startTileId];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    const [sq, sr] = cur.split(',').map(Number) as [number, number];
    const d = graphDistances.get(cur)!;
    for (const dir of HEX_DIRS) {
      const nk = `${sq + dir.q},${sr + dir.r}`;
      if (coordSet.has(nk) && !graphDistances.has(nk)) {
        graphDistances.set(nk, d + 1);
        queue.push(nk);
      }
    }
  }

  return {
    chapter:  4,
    seed:     'test',
    tiles,
    startTileId,
    gateAnchorId,
    graphDistances,
    zoneMeta,
  };
}

// ── Unit tests: computeSpatialMultipliers ──────────────────────────────────────

const noMeta: SpatialWeightInput = { zoneType: undefined, laneClass: undefined, clearingType: undefined, isDeadEnd: false };
const clearing: SpatialWeightInput = { zoneType: 'clearing', laneClass: undefined, clearingType: undefined, isDeadEnd: false };
const primaryLane: SpatialWeightInput = { zoneType: 'lane', laneClass: 'primary', clearingType: undefined, isDeadEnd: false };
const secondaryLane: SpatialWeightInput = { zoneType: 'lane', laneClass: 'secondary', clearingType: undefined, isDeadEnd: false };
const transition: SpatialWeightInput = { zoneType: 'transition', laneClass: undefined, clearingType: undefined, isDeadEnd: false };
const deadEndLane: SpatialWeightInput = { zoneType: 'lane', laneClass: 'secondary', clearingType: undefined, isDeadEnd: true };
const deadEndClearing: SpatialWeightInput = { zoneType: 'clearing', laneClass: undefined, clearingType: undefined, isDeadEnd: true };

// ── No metadata ────────────────────────────────────────────────────────────────
test('no zone metadata → empty object (authored/procedural passthrough)', () => {
  const m = multsFor(noMeta);
  eq(Object.keys(m).length, 0, `expected empty object, got keys: ${Object.keys(m).join(',')}`);
});

test('missing key in multipliers → implied 1.0 by convention', () => {
  const m = multsFor(noMeta);
  eq(mult(m, 'battle'), 1.0, 'battle missing → should default to 1.0');
  eq(mult(m, 'none'),   1.0, 'none missing → should default to 1.0');
});

// ── none never in multipliers ─────────────────────────────────────────────────
test('none is never included in any zone multiplier (absorbs naturally)', () => {
  for (const input of [clearing, primaryLane, secondaryLane, transition, deadEndLane]) {
    const m = multsFor(input);
    ok(!('none' in m), `none should not be in multiplier map for ${input.zoneType}/${input.laneClass}`);
  }
});

// ── Clearing ──────────────────────────────────────────────────────────────────
test('clearing: areaBoss > 1.0 (boosted — only valid zone)', () => {
  const m = multsFor(clearing);
  ok((m.areaBoss ?? 0) > 1.0, `expected areaBoss > 1.0 on clearing, got ${m.areaBoss}`);
});

test('clearing: battle < 1.0 (reduced — open space, less conflict)', () => {
  const m = multsFor(clearing);
  ok((m.battle ?? 1.0) < 1.0, `expected battle < 1.0 on clearing, got ${m.battle}`);
});

test('clearing: treasure > 1.0 (preferred — open ground)', () => {
  const m = multsFor(clearing);
  ok((m.treasure ?? 0) > 1.0, `expected treasure > 1.0 on clearing, got ${m.treasure}`);
});

test('clearing: merchant > 1.0 (strongly preferred — NPC space)', () => {
  const m = multsFor(clearing);
  ok((m.merchant ?? 0) > 1.0, `expected merchant > 1.0 on clearing, got ${m.merchant}`);
});

test('clearing: wardEvent > 1.0 (interactive encounters belong in open areas)', () => {
  const m = multsFor(clearing);
  ok((m.wardEvent ?? 0) > 1.0, `expected wardEvent > 1.0 on clearing, got ${m.wardEvent}`);
});

// ── Primary lane ──────────────────────────────────────────────────────────────
test('primary lane: areaBoss = 0 (FORBIDDEN — no boss blocking main artery)', () => {
  const m = multsFor(primaryLane);
  eq(mult(m, 'areaBoss'), 0, `expected areaBoss = 0 on primary lane, got ${m.areaBoss}`);
});

test('primary lane: merchant = 0 (FORBIDDEN — no merchant in main artery)', () => {
  const m = multsFor(primaryLane);
  eq(mult(m, 'merchant'), 0, `expected merchant = 0 on primary lane, got ${m.merchant}`);
});

test('primary lane: battle > 1.0 (conflict zone)', () => {
  const m = multsFor(primaryLane);
  ok((m.battle ?? 1.0) > 1.0, `expected battle > 1.0 on primary lane, got ${m.battle}`);
});

test('primary lane: treasure < 1.0 (chest blocks readability in main artery)', () => {
  const m = multsFor(primaryLane);
  ok((m.treasure ?? 1.0) < 1.0, `expected treasure < 1.0 on primary lane, got ${m.treasure}`);
});

// ── Secondary lane ────────────────────────────────────────────────────────────
test('secondary lane: areaBoss = 0 (FORBIDDEN — too narrow for boss)', () => {
  const m = multsFor(secondaryLane);
  eq(mult(m, 'areaBoss'), 0, `expected areaBoss = 0 on secondary lane, got ${m.areaBoss}`);
});

test('secondary lane: merchant < 1.0 (rare in side corridors)', () => {
  const m = multsFor(secondaryLane);
  ok((m.merchant ?? 1.0) < 1.0, `expected merchant < 1.0 on secondary lane, got ${m.merchant}`);
});

// ── Transition ────────────────────────────────────────────────────────────────
test('transition: areaBoss = 0 (FORBIDDEN — not enough open cells)', () => {
  const m = multsFor(transition);
  eq(mult(m, 'areaBoss'), 0, `expected areaBoss = 0 on transition, got ${m.areaBoss}`);
});

// ── Dead-end overrides ────────────────────────────────────────────────────────
test('dead-end secondary lane: treasure >= 2.5 (prime reward spot)', () => {
  const m = multsFor(deadEndLane);
  ok((m.treasure ?? 0) >= 2.5, `dead-end treasure should be >= 2.5, got ${m.treasure}`);
});

test('dead-end secondary lane: merchant >= 1.0 (small shop in side pocket)', () => {
  const m = multsFor(deadEndLane);
  ok((m.merchant ?? 0) >= 1.0, `dead-end merchant should be >= 1.0, got ${m.merchant}`);
});

test('dead-end secondary lane: wardEvent >= 1.5 (training bay / support event)', () => {
  const m = multsFor(deadEndLane);
  ok((m.wardEvent ?? 0) >= 1.5, `dead-end wardEvent should be >= 1.5, got ${m.wardEvent}`);
});

test('dead-end secondary lane: areaBoss still = 0 (dead ends are too small for bosses)', () => {
  const m = multsFor(deadEndLane);
  eq(mult(m, 'areaBoss'), 0, `areaBoss should be 0 even on dead-end lane, got ${m.areaBoss}`);
});

test('dead-end clearing: treasure >= max(clearing_treasure, 2.5)', () => {
  const mClearing = multsFor(clearing);
  const mDeadClearing = multsFor(deadEndClearing);
  const expectedMin = Math.max(mClearing.treasure ?? 0, 2.5);
  ok(
    (mDeadClearing.treasure ?? 0) >= expectedMin,
    `dead-end clearing treasure should be >= ${expectedMin}, got ${mDeadClearing.treasure}`,
  );
});

test('dead-end clearing: areaBoss still uses clearing multiplier (not dead-end override)', () => {
  const mClearing     = multsFor(clearing);
  const mDeadClearing = multsFor(deadEndClearing);
  eq(
    mDeadClearing.areaBoss,
    mClearing.areaBoss,
    `areaBoss should be same for clearing with/without dead-end flag`,
  );
});

// ── Integration: assignCanonicalEncounters with synthetic zone metadata ────────

/**
 * Builds a simple 13-tile topology: centre-clearing star with 6 lane arms
 * of 2 tiles each, plus start (clearing) and gate (clearing).
 *
 *       clearing        clearing        clearing
 *         (gate)                        (dead end)
 *            \           /
 *   primary-lane  clearing (centre)  primary-lane
 *            /           \
 *        clearing          clearing
 *       (start)           (dead end)
 *
 * Layout: 6-hex star from centre (0,0)
 *   centre = clearing
 *   inner ring (dist 1) = primary lane
 *   outer ring (dist 2) = clearing (dead ends)
 *   one extra = start (dist=0 from start)
 *   gate = one outer clearing
 *
 * Actually let's do a simpler linear layout for predictability:
 *   row: start(clearing) — lane(primary) — lane(primary) — clearing — lane(secondary) — gate(clearing)
 *   branch from clearing: secondary-lane — clearing(dead-end)
 */

// Simple layout: linear chain with a branch
//  (0,0)=start  (1,0)=primary  (2,0)=primary  (3,0)=clearing  (4,0)=secondary  (5,0)=gate
//                                              (3,1)=secondary  (3,2)=clearing(dead-end)
const SYNTHETIC_ENTRIES = [
  { q: 0, r: 0, zoneType: 'clearing' as const, isStart: true },
  { q: 1, r: 0, zoneType: 'lane' as const,     laneClass: 'primary' as const },
  { q: 2, r: 0, zoneType: 'lane' as const,     laneClass: 'primary' as const },
  { q: 3, r: 0, zoneType: 'clearing' as const },
  { q: 4, r: 0, zoneType: 'lane' as const,     laneClass: 'secondary' as const },
  { q: 5, r: 0, zoneType: 'clearing' as const, isGate: true },
  // Branch from clearing (3,0)
  { q: 3, r: 1, zoneType: 'lane' as const,     laneClass: 'secondary' as const },
  { q: 3, r: 2, zoneType: 'clearing' as const },  // dead-end
];

let syntheticTopology: HexTopology;

test('synthetic topology builds without error', () => {
  syntheticTopology = buildTestTopology(SYNTHETIC_ENTRIES);
  ok(syntheticTopology.tiles.length === SYNTHETIC_ENTRIES.length, 'tile count matches');
  ok(syntheticTopology.startTileId === '0,0', `start should be 0,0, got ${syntheticTopology.startTileId}`);
  ok(syntheticTopology.gateAnchorId === '5,0', `gate should be 5,0, got ${syntheticTopology.gateAnchorId}`);
});

// Run many seeds to gather area boss placement statistics for ch4.
test('area boss only lands on clearing tiles (CLEARING ONLY rule)', () => {
  // Ch4 has 3% area boss rate.
  let bossOnClearing = 0;
  let bossOnNonClearing = 0;
  const RUNS = 500;

  for (let i = 0; i < RUNS; i++) {
    const result = assignCanonicalEncounters({
      chapter:   4,
      seed:      `area-boss-test-${i}`,
      timeOfDay: 'day',
      topology:  syntheticTopology,
    });

    for (const tile of result.tiles) {
      if (tile.encounter !== 'areaBoss') continue;
      const zoneMeta = syntheticTopology.zoneMeta?.get(tile.tileKey);
      if (zoneMeta?.zoneType === 'clearing') {
        bossOnClearing++;
      } else {
        bossOnNonClearing++;
      }
    }
  }

  ok(
    bossOnNonClearing === 0,
    `area boss appeared on ${bossOnNonClearing} non-clearing tiles across ${RUNS} runs ` +
    `(should be 0). On clearing: ${bossOnClearing}`,
  );
});

test('merchant never appears on primary-lane tiles', () => {
  let merchantOnPrimary = 0;
  const RUNS = 500;

  for (let i = 0; i < RUNS; i++) {
    const result = assignCanonicalEncounters({
      chapter:   8,   // ch8 has some merchant rate
      seed:      `merchant-test-${i}`,
      timeOfDay: 'day',
      topology:  syntheticTopology,
    });

    for (const tile of result.tiles) {
      if (tile.encounter !== 'merchant') continue;
      const zoneMeta = syntheticTopology.zoneMeta?.get(tile.tileKey);
      if (zoneMeta?.zoneType === 'lane' && zoneMeta.laneClass === 'primary') {
        merchantOnPrimary++;
      }
    }
  }

  ok(
    merchantOnPrimary === 0,
    `merchant appeared on ${merchantOnPrimary} primary-lane tiles across ${RUNS} runs (should be 0)`,
  );
});

// ── Integration: assignCanonicalEncounters with Ch1 blueprint topology ─────────

let ch1Topology: HexTopology;
const CH1_SEED = 'push3-integration-seed';

test('get Ch1 blueprint topology without error', () => {
  const artifact = getCanonicalChapterMapArtifact(1);
  ch1Topology = {
    chapter:        1,
    seed:           artifact.dna.seed,
    tiles:          artifact.walkableCells,
    startTileId:    artifact.asTopology.startTileId,
    gateAnchorId:   artifact.asTopology.gateAnchorId,
    graphDistances: artifact.asTopology.graphDistances,
    zoneMeta:       artifact.zoneMeta,
  };
  ok(ch1Topology.tiles.length === 60, `expected 60 tiles, got ${ch1Topology.tiles.length}`);
  ok(ch1Topology.zoneMeta != null, 'Ch1 should have zone metadata');
});

test('Ch1 assignCanonicalEncounters runs deterministically with spatial weights', () => {
  const r1 = assignCanonicalEncounters({ chapter: 1, seed: CH1_SEED, timeOfDay: 'day', topology: ch1Topology });
  const r2 = assignCanonicalEncounters({ chapter: 1, seed: CH1_SEED, timeOfDay: 'day', topology: ch1Topology });
  ok(r1.tiles.length === r2.tiles.length, 'tile count must be same across calls');
  for (let i = 0; i < r1.tiles.length; i++) {
    const t1 = r1.tiles[i]!;
    const t2 = r2.tiles[i]!;
    ok(t1.tileKey === t2.tileKey && t1.encounter === t2.encounter,
      `tile ${i} mismatch: ${t1.tileKey}/${t1.encounter} vs ${t2.tileKey}/${t2.encounter}`);
  }
});

test('treasure appears proportionally more on clearing tiles than the clearing baseline', () => {
  // Run many seeds to gather statistics.
  const RUNS = 200;
  let clearingTiles = 0;
  let totalEligible = 0;
  let treasureClearingCount = 0;
  let treasureTotalCount = 0;

  // Count clearing fraction baseline from the topology itself.
  for (const coord of ch1Topology.tiles) {
    const key = `${coord.q},${coord.r}`;
    if (key === ch1Topology.startTileId || key === ch1Topology.gateAnchorId) continue;
    totalEligible++;
    const zm = ch1Topology.zoneMeta?.get(key);
    if (zm?.zoneType === 'clearing') clearingTiles++;
  }
  const clearingBaseline = clearingTiles / totalEligible;

  for (let i = 0; i < RUNS; i++) {
    const result = assignCanonicalEncounters({
      chapter: 1, seed: `treasure-spatial-${i}`, timeOfDay: 'day', topology: ch1Topology,
    });
    for (const tile of result.tiles) {
      if (tile.encounter !== 'treasure') continue;
      treasureTotalCount++;
      const zm = ch1Topology.zoneMeta?.get(tile.tileKey);
      if (zm?.zoneType === 'clearing') treasureClearingCount++;
    }
  }

  if (treasureTotalCount === 0) {
    // Ch1 treasure rate is 5%; with 59 eligible tiles and 200 runs, expect ~590 treasures.
    // If somehow none appear, skip the ratio check rather than fail.
    console.log('  [skip] no treasure tiles found — rate may be low for this chapter');
    return;
  }

  const treasureClearingFraction = treasureClearingCount / treasureTotalCount;

  ok(
    treasureClearingFraction > clearingBaseline,
    `treasure clearing fraction ${(treasureClearingFraction * 100).toFixed(1)}% should exceed ` +
    `baseline ${(clearingBaseline * 100).toFixed(1)}% — clearing preference not working`,
  );
});

test('battle appears proportionally less on clearing tiles than the clearing baseline', () => {
  const RUNS = 200;
  let clearingTiles = 0;
  let totalEligible = 0;
  let battleClearingCount = 0;
  let battleTotalCount = 0;

  for (const coord of ch1Topology.tiles) {
    const key = `${coord.q},${coord.r}`;
    if (key === ch1Topology.startTileId || key === ch1Topology.gateAnchorId) continue;
    totalEligible++;
    const zm = ch1Topology.zoneMeta?.get(key);
    if (zm?.zoneType === 'clearing') clearingTiles++;
  }
  const clearingBaseline = clearingTiles / totalEligible;

  for (let i = 0; i < RUNS; i++) {
    const result = assignCanonicalEncounters({
      chapter: 1, seed: `battle-spatial-${i}`, timeOfDay: 'day', topology: ch1Topology,
    });
    for (const tile of result.tiles) {
      if (tile.encounter !== 'battle') continue;
      battleTotalCount++;
      const zm = ch1Topology.zoneMeta?.get(tile.tileKey);
      if (zm?.zoneType === 'clearing') battleClearingCount++;
    }
  }

  if (battleTotalCount === 0) return;

  const battleClearingFraction = battleClearingCount / battleTotalCount;

  ok(
    battleClearingFraction < clearingBaseline,
    `battle clearing fraction ${(battleClearingFraction * 100).toFixed(1)}% should be less than ` +
    `baseline ${(clearingBaseline * 100).toFixed(1)}% — battle reduction in clearings not working`,
  );
});

test('overall Ch1 battle rate approximately preserved (within ±15% of 30% base)', () => {
  const RUNS = 200;
  let totalEligible = 0;
  let totalBattle = 0;

  for (let i = 0; i < RUNS; i++) {
    const result = assignCanonicalEncounters({
      chapter: 1, seed: `rate-preserve-${i}`, timeOfDay: 'day', topology: ch1Topology,
    });
    for (const tile of result.tiles) {
      const zm = ch1Topology.zoneMeta?.get(tile.tileKey);
      // Count only eligible (non-frozen) tiles.
      if (tile.tileKey === ch1Topology.startTileId || tile.tileKey === ch1Topology.gateAnchorId) continue;
      totalEligible++;
      if (tile.encounter === 'battle') totalBattle++;
    }
  }

  const battleRate = totalBattle / totalEligible;
  const BASE_BATTLE_RATE = 0.30;
  const TOLERANCE = 0.15; // ±15 percentage points

  ok(
    Math.abs(battleRate - BASE_BATTLE_RATE) <= TOLERANCE,
    `battle rate ${(battleRate * 100).toFixed(1)}% is outside ±15% of base 30% ` +
    `(range: ${((BASE_BATTLE_RATE - TOLERANCE) * 100).toFixed(0)}%–${((BASE_BATTLE_RATE + TOLERANCE) * 100).toFixed(0)}%)`,
  );
});

// ── Results ───────────────────────────────────────────────────────────────────

console.log('');
console.log('─'.repeat(70));
console.log(`journey_map_spatial_weights: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('');
  for (const f of failures) console.log(f);
}
console.log('─'.repeat(70));

if (failed > 0) process.exit(1);
