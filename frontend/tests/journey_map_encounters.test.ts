/**
 * journey_map_encounters.test.ts
 *
 * Unit tests for journeyMap/encounters.ts.
 *
 * Run: npx sucrase-node tests/journey_map_encounters.test.ts
 *
 * Covers:
 *  1.  Determinism — same chapter + seed + topology → identical assignment
 *  2.  All encounter values are valid EncounterType members
 *  3.  areaBoss cap never exceeded (≤ 3)
 *  4.  Treasure cap never exceeded (≤ getTreasureCap(chapter))
 *  5.  Merchant cap never exceeded (≤ getMerchantCap(chapter))
 *  6.  Start tile always has encounter = 'none' and no chestTier
 *  7.  Gate tile always has encounter = 'none' and no chestTier
 *  8.  chestTier defined on every treasure tile, undefined on all others
 *  9.  chestTier values are valid ChestTier members
 * 10.  Encounter rates sum to TOTAL_BP at every chapter boundary
 * 11.  Chest-tier rates sum to TOTAL_BP at every chapter boundary
 * 12.  tiles.length equals topology.tiles.length (all tiles accounted for)
 * 13.  areaBossCount equals actual tile count with encounter === 'areaBoss'
 * 14.  Zero-boss maps are valid (areaBossCount can be 0 with no impossible gate)
 * 15.  No areaBoss tile is adjacent to the start tile
 * 16.  Seed variation — different seeds produce different assignments
 * 17.  Chapter variation — different chapters with same seed differ
 */

import {
  assignJourneyEncounters,
  type AssignedTile,
  type EncounterAssignment,
} from '../src/game/journeyMap/encounters';

import { generateHexTopology, type HexTopology } from '../src/game/journeyMap/topology';
import {
  getTreasureCap,
  getMerchantCap,
  getEncounterRatesBp,
  getChestTierRatesBp,
  TOTAL_BP,
} from '../src/game/journeyMap/config';

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

const VALID_ENCOUNTERS = new Set(['none', 'battle', 'treasure', 'merchant', 'areaBoss', 'boss']);
const VALID_CHEST_TIERS = new Set(['bronze', 'silver', 'gold']);

const AXIAL_DIRS = [
  { q:  1, r:  0 }, { q: -1, r:  0 },
  { q:  0, r:  1 }, { q:  0, r: -1 },
  { q:  1, r: -1 }, { q: -1, r:  1 },
];

function neighborKeys(tileKey: string, tileSet: Set<string>): string[] {
  const c = tileKey.indexOf(',');
  const q = Number(tileKey.slice(0, c));
  const r = Number(tileKey.slice(c + 1));
  return AXIAL_DIRS.map(d => `${q + d.q},${r + d.r}`).filter(k => tileSet.has(k));
}

function serialise(a: EncounterAssignment): string {
  return JSON.stringify({
    areaBossCount: a.areaBossCount,
    tiles: [...a.tiles]
      .sort((x, y) => x.tileKey.localeCompare(y.tileKey))
      .map(t => `${t.tileKey}:${t.encounter}:${t.chestTier ?? '-'}`),
  });
}

/** Run the full structural assertion suite on one assignment result. */
function assertAssignment(
  result: EncounterAssignment,
  topology: HexTopology,
  chapter: number,
  label: string,
): void {
  const { tiles, areaBossCount } = result;
  const tileSet = new Set(tiles.map(t => t.tileKey));

  // ── 12. tiles.length matches topology.tiles.length ─────────────────────────
  eq(tiles.length, topology.tiles.length, `[${label}] tiles.length = ${topology.tiles.length}`);

  // ── 2. All encounter values are valid ──────────────────────────────────────
  const invalidEncounters = tiles.filter(t => !VALID_ENCOUNTERS.has(t.encounter));
  check(`[${label}] all encounter types valid`, invalidEncounters.length === 0,
    `invalid: ${invalidEncounters.map(t => t.encounter).join(', ')}`);

  // ── 3. areaBoss cap ────────────────────────────────────────────────────────
  const bossTiles = tiles.filter(t => t.encounter === 'areaBoss');
  check(`[${label}] areaBoss count ≤ 3`, bossTiles.length <= 3,
    `got ${bossTiles.length}`);

  // ── 4. Treasure cap ────────────────────────────────────────────────────────
  const treasureCap  = getTreasureCap(chapter);
  const treasureTiles = tiles.filter(t => t.encounter === 'treasure');
  check(`[${label}] treasure count ≤ cap ${treasureCap}`, treasureTiles.length <= treasureCap,
    `got ${treasureTiles.length}`);

  // ── 5. Merchant cap ────────────────────────────────────────────────────────
  const merchantCap   = getMerchantCap(chapter);
  const merchantTiles = tiles.filter(t => t.encounter === 'merchant');
  check(`[${label}] merchant count ≤ cap ${merchantCap}`, merchantTiles.length <= merchantCap,
    `got ${merchantTiles.length}`);

  // ── 6. Start tile is safe ──────────────────────────────────────────────────
  const startTile = tiles.find(t => t.tileKey === topology.startTileId);
  check(`[${label}] start tile exists in result`, !!startTile);
  if (startTile) {
    eq(startTile.encounter, 'none', `[${label}] start encounter = 'none'`);
    check(`[${label}] start tile has no chestTier`, startTile.chestTier === undefined);
  }

  // ── 7. Gate tile has encounter = 'boss' ───────────────────────────────────
  const gateTile = tiles.find(t => t.tileKey === topology.gateAnchorId);
  check(`[${label}] gate tile exists in result`, !!gateTile);
  if (gateTile) {
    eq(gateTile.encounter, 'boss', `[${label}] gate encounter = 'boss'`);
    check(`[${label}] gate tile has no chestTier`, gateTile.chestTier === undefined);
  }

  // ── 8. chestTier ↔ treasure ────────────────────────────────────────────────
  const missingTier  = tiles.filter(t => t.encounter === 'treasure' && t.chestTier === undefined);
  const spuriousTier = tiles.filter(t => t.encounter !== 'treasure' && t.chestTier !== undefined);
  check(`[${label}] all treasure tiles have chestTier`, missingTier.length === 0,
    `missing on ${missingTier.length} tiles`);
  check(`[${label}] only treasure tiles have chestTier`, spuriousTier.length === 0,
    `spurious on ${spuriousTier.length} tiles`);

  // ── 9. Valid chestTier values ──────────────────────────────────────────────
  const invalidTiers = tiles.filter(t => t.chestTier !== undefined && !VALID_CHEST_TIERS.has(t.chestTier!));
  check(`[${label}] all chestTier values valid`, invalidTiers.length === 0,
    `invalid: ${invalidTiers.map(t => t.chestTier).join(', ')}`);

  // ── 13. areaBossCount matches actual count ─────────────────────────────────
  eq(areaBossCount, bossTiles.length, `[${label}] areaBossCount = tile count`);

  // ── 15. No areaBoss adjacent to start ─────────────────────────────────────
  const startAdj  = new Set(neighborKeys(topology.startTileId, tileSet));
  const adjBosses = bossTiles.filter(t => startAdj.has(t.tileKey));
  check(`[${label}] no areaBoss adjacent to start`, adjBosses.length === 0,
    `adjacent bosses: ${adjBosses.map(t => t.tileKey).join(', ')}`);
}

// ── Standard topologies used across several test groups ──────────────────────

const STD_CASES: Array<{ chapter: number; seed: string | number }> = [
  { chapter:  1, seed: 'encounter_test' },
  { chapter:  1, seed: 0                },
  { chapter:  5, seed: 'beta'           },
  { chapter:  6, seed: 'alpha'          },
  { chapter: 10, seed: 1337             },
  { chapter: 20, seed: 'deep_run'       },
  { chapter: 11, seed: 'gamma'          },
];

// ── 1–9, 12–13, 15 — Structural tests ────────────────────────────────────────

console.log('\n── Structural correctness ──');

for (const { chapter, seed } of STD_CASES) {
  const label    = `ch${chapter}/${String(seed)}`;
  const topology = generateHexTopology({ chapter, seed });
  let result: EncounterAssignment;
  try {
    result = assignJourneyEncounters({ chapter, seed, topology });
  } catch (err) {
    check(`[${label}] no throw`, false, String(err));
    continue;
  }
  assertAssignment(result, topology, chapter, label);
}

// ── 1. Determinism ────────────────────────────────────────────────────────────

console.log('\n── Determinism ──');

{
  const DETERM_CASES: Array<{ chapter: number; seed: string | number }> = [
    { chapter:  1, seed: 'determ_seed'   },
    { chapter:  6, seed: 'determ_seed'   },
    { chapter: 11, seed: 777             },
    { chapter: 20, seed: 'fixed'         },
  ];

  for (const opts of DETERM_CASES) {
    const label    = `ch${opts.chapter}/${String(opts.seed)}`;
    const topology = generateHexTopology(opts);
    const a        = assignJourneyEncounters({ ...opts, topology });
    const b        = assignJourneyEncounters({ ...opts, topology });
    check(`[determinism ${label}] identical output`, serialise(a) === serialise(b));
  }
}

// ── 10. Encounter rates sum to TOTAL_BP ───────────────────────────────────────

console.log('\n── Rate totals ──');

{
  const CHAPTERS = [1, 5, 10, 20, 25, 35, 50, 100];
  for (const ch of CHAPTERS) {
    const rates = getEncounterRatesBp(ch);
    const sum   = (Object.values(rates) as number[]).reduce((s, v) => s + v, 0);
    eq(sum, TOTAL_BP, `ch ${ch} encounter rates sum to ${TOTAL_BP} BP`);
  }
}

// ── 11. Chest-tier rates sum to TOTAL_BP ──────────────────────────────────────

{
  const CHAPTERS = [1, 5, 10, 20, 35, 50, 100];
  for (const ch of CHAPTERS) {
    const rates = getChestTierRatesBp(ch);
    const sum   = (Object.values(rates) as number[]).reduce((s, v) => s + v, 0);
    eq(sum, TOTAL_BP, `ch ${ch} chest-tier rates sum to ${TOTAL_BP} BP`);
  }
}

// ── 14. Zero-boss maps are valid ──────────────────────────────────────────────
//
// Build a minimal 5-tile topology where ALL non-frozen tiles are adjacent to
// the start, so every rolled areaBoss gets removed and cannot be re-placed.
// The result must have areaBossCount = 0 and no invalid state.

console.log('\n── Zero-boss maps ──');

{
  // Manually construct a star topology:
  //   centre = "0,0" (start)
  //   arms   = "1,0", "-1,0", "0,1"  (all adjacent to start)
  //   gate   = "0,-1" (adjacent to start — frozen)
  //
  // Every non-frozen tile is adjacent to start → no valid boss position exists
  // after removal → areaBossCount must be 0.

  function bfsFromKey(tileKeys: string[], startKey: string): Map<string, number> {
    const adj = new Map<string, string[]>();
    const set = new Set(tileKeys);
    const DIRS = [{q:1,r:0},{q:-1,r:0},{q:0,r:1},{q:0,r:-1},{q:1,r:-1},{q:-1,r:1}];
    for (const k of tileKeys) {
      const c = k.indexOf(','); const q = Number(k.slice(0,c)); const r = Number(k.slice(c+1));
      adj.set(k, DIRS.map(d => `${q+d.q},${r+d.r}`).filter(nk => set.has(nk)));
    }
    const dist = new Map([[startKey, 0]]);
    const q: string[] = [startKey];
    for (let h = 0; h < q.length; h++) {
      const curr = q[h]; const d = dist.get(curr)!;
      for (const nk of (adj.get(curr) ?? [])) {
        if (!dist.has(nk)) { dist.set(nk, d + 1); q.push(nk); }
      }
    }
    return dist;
  }

  const starKeys   = ['0,0', '1,0', '-1,0', '0,1', '0,-1'];
  const starCoords = starKeys.map(k => {
    const c = k.indexOf(','); return { q: Number(k.slice(0,c)), r: Number(k.slice(c+1)) };
  });
  const startKey = '0,0';
  const gateKey  = '0,-1';

  const zeroBossTopology: HexTopology = {
    chapter:        1,
    seed:           'zero_boss',
    tiles:          starCoords,
    startTileId:    startKey,
    gateAnchorId:   gateKey,
    graphDistances: bfsFromKey(starKeys, startKey),
  };

  // Run with several seeds; every result must have areaBossCount === 0.
  const zeroBossSeeds: Array<string | number> = ['zero_a', 'zero_b', 0, 42, 999];
  for (const s of zeroBossSeeds) {
    const res = assignJourneyEncounters({ chapter: 1, seed: s, topology: zeroBossTopology });
    eq(res.areaBossCount, 0, `[zero-boss seed=${String(s)}] areaBossCount = 0`);
    // Full structural checks still pass.
    assertAssignment(res, zeroBossTopology, 1, `zero-boss/${String(s)}`);
  }
}

// ── 16. Seed variation ────────────────────────────────────────────────────────

console.log('\n── Seed variation ──');

{
  const topology = generateHexTopology({ chapter: 6, seed: 'variation_base' });
  const seeds: Array<string | number> = ['var_A', 'var_B', 'var_C', 100, 200];
  const serials = seeds.map(s =>
    serialise(assignJourneyEncounters({ chapter: 6, seed: s, topology })),
  );
  let allDiff = true;
  for (let i = 0; i < serials.length; i++) {
    for (let j = i + 1; j < serials.length; j++) {
      if (serials[i] === serials[j]) {
        allDiff = false;
        console.error(`COLLISION: seeds "${String(seeds[i])}" and "${String(seeds[j])}" identical`);
      }
    }
  }
  check('distinct seeds produce distinct ch-6 assignments', allDiff);
}

// ── 17. Chapter variation ─────────────────────────────────────────────────────

console.log('\n── Chapter variation ──');

{
  const SEED = 'chapter_var_seed';
  const PAIRS: Array<[number, number]> = [[1, 6], [6, 11], [11, 20]];
  for (const [chA, chB] of PAIRS) {
    const topoA = generateHexTopology({ chapter: chA, seed: SEED });
    const topoB = generateHexTopology({ chapter: chB, seed: SEED });
    const a = serialise(assignJourneyEncounters({ chapter: chA, seed: SEED, topology: topoA }));
    const b = serialise(assignJourneyEncounters({ chapter: chB, seed: SEED, topology: topoB }));
    check(`ch${chA} vs ch${chB} with same seed differ`, a !== b);
  }
}

// ── Extended chapter range — no throws ───────────────────────────────────────

console.log('\n── No-throw across chapter range ──');

{
  const CHAPTERS = [1, 5, 6, 10, 11, 20, 21, 31, 50, 100];
  const SEED     = 'range_check';
  for (const ch of CHAPTERS) {
    const topology = generateHexTopology({ chapter: ch, seed: SEED });
    let threw = false;
    let res: EncounterAssignment | undefined;
    try { res = assignJourneyEncounters({ chapter: ch, seed: SEED, topology }); }
    catch { threw = true; }
    check(`ch ${ch} assigns without throw`, !threw);
    if (res) {
      // Quick sanity: areaBossCount matches tile count.
      const actualBosses = res.tiles.filter(t => t.encounter === 'areaBoss').length;
      eq(res.areaBossCount, actualBosses, `ch ${ch} areaBossCount consistent`);
    }
  }
}

// ── Result summary ────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
