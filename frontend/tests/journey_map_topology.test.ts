/**
 * journey_map_topology.test.ts
 *
 * Unit tests for journeyMap/topology.ts.
 *
 * Run: npx sucrase-node tests/journey_map_topology.test.ts
 *
 * Covers:
 *  1. Exact tile counts — at every chapter boundary
 *  2. Unique coordinates — no duplicate (q, r) pairs
 *  3. Connectivity — all tiles reachable from start via BFS
 *  4. Start tile existence — startTileId is a valid tile key
 *  5. Gate existence — gateAnchorId is a valid tile key
 *  6. Gate reachability — graphDistances includes gateAnchorId
 *  7. Gate distance — gateAnchorId meets the minimum graph-distance threshold
 *  8. Gate non-adjacency — gate is not a direct neighbour of start
 *  9. Determinism — same seed + chapter always produces identical output
 * 10. Seed variation — different seeds produce meaningfully different maps
 * 11. Chapter boundary tile counts — matches getChapterTerrainCellCount exactly
 * 12. graphDistances covers the whole map — size === tile count
 * 13. No throws for supported chapter range
 * 14. Start tile is in the lower portion — r ≥ median r of all tiles
 * 15. Gate anchor is not the start tile
 */

import {
  generateHexTopology,
  bfsDistances,
  type HexTopology,
  type AxialCoord,
} from '../src/game/journeyMap/topology';

import { getChapterTerrainCellCount } from '../src/game/journeyMap/config';

// ── Tiny test harness (mirrors journey_map_config.test.ts) ────────────────────

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

function tileKey(t: AxialCoord): string { return `${t.q},${t.r}`; }

const AXIAL_DIRS: ReadonlyArray<AxialCoord> = [
  { q:  1, r:  0 }, { q: -1, r:  0 },
  { q:  0, r:  1 }, { q:  0, r: -1 },
  { q:  1, r: -1 }, { q: -1, r:  1 },
];

function neighborKeys(q: number, r: number): string[] {
  return AXIAL_DIRS.map(d => `${q + d.q},${r + d.r}`);
}

/** Serialise a topology for equality comparison across two runs. */
function serialise(t: HexTopology): string {
  const tileKeys = t.tiles.map(tileKey).sort().join('|');
  const distEntries = [...t.graphDistances.entries()]
    .sort(([ka], [kb]) => ka.localeCompare(kb))
    .map(([k, v]) => `${k}=${v}`)
    .join('|');
  return `tiles:${tileKeys};start:${t.startTileId};gate:${t.gateAnchorId};dist:${distEntries}`;
}

// ── 1. Chapter boundary tile counts ──────────────────────────────────────────

console.log('\n── Chapter boundary tile counts ──');

const BOUNDARY_CASES: Array<[number, number]> = [
  [1,   30], [3,  30], [5,  30],
  [6,   35], [10, 35],
  [11,  40], [20, 40],
  [21,  45], [30, 45],
  [31,  50],
  [100, 80],
];

for (const [ch, expected] of BOUNDARY_CASES) {
  eq(getChapterTerrainCellCount(ch), expected, `ch ${ch} → ${expected} tiles`);
}

// ── 2–15. Full topology tests ─────────────────────────────────────────────────

/**
 * Run all structural tests on a single generated topology.
 * Returns true if every check passed (useful for calling from loops).
 */
function runStructuralTests(
  topo: HexTopology,
  label: string,
  strict = true,
): boolean {
  const tileKeys = new Set(topo.tiles.map(tileKey));
  const target   = getChapterTerrainCellCount(topo.chapter);

  // ── 2. Exact tile count ────────────────────────────────────────────────
  const countOk = topo.tiles.length === target;
  check(`[${label}] tile count = ${target}`, countOk,
    `got ${topo.tiles.length}`);

  // ── 3. Unique coordinates ──────────────────────────────────────────────
  check(`[${label}] no duplicate (q,r)`, tileKeys.size === topo.tiles.length,
    `set size ${tileKeys.size} vs array length ${topo.tiles.length}`);

  // ── 4. Start tile exists ───────────────────────────────────────────────
  const startExists = tileKeys.has(topo.startTileId);
  check(`[${label}] startTileId in tiles`, startExists);

  // ── 5. Gate exists ─────────────────────────────────────────────────────
  const gateExists = tileKeys.has(topo.gateAnchorId);
  check(`[${label}] gateAnchorId in tiles`, gateExists);

  // ── 6. Gate ≠ start ────────────────────────────────────────────────────
  check(`[${label}] gate ≠ start`, topo.gateAnchorId !== topo.startTileId);

  // ── 7. graphDistances covers the whole map ─────────────────────────────
  check(`[${label}] graphDistances.size = tile count`,
    topo.graphDistances.size === topo.tiles.length,
    `got ${topo.graphDistances.size}`);

  // ── 8. Connectivity — every tile reachable from start ─────────────────
  const allReachable = topo.tiles.every(t => topo.graphDistances.has(tileKey(t)));
  check(`[${label}] all tiles reachable from start`, allReachable);

  // ── 9. Gate is reachable ───────────────────────────────────────────────
  const gateReachable = topo.graphDistances.has(topo.gateAnchorId);
  check(`[${label}] gate reachable from start`, gateReachable);

  // ── 10. Gate distance ≥ minimum ─────────────────────────────────────────
  const gateDist = topo.graphDistances.get(topo.gateAnchorId) ?? 0;
  const minDist  = Math.max(4, Math.floor(target * 0.22));
  check(`[${label}] gate dist ${gateDist} ≥ minDist ${minDist}`,
    gateDist >= minDist, `got ${gateDist}`);

  // ── 11. Gate not adjacent to start ──────────────────────────────────────
  const startCoord   = topo.startTileId.split(',').map(Number);
  const startNeighbors = new Set(neighborKeys(startCoord[0], startCoord[1]));
  check(`[${label}] gate not adjacent to start`,
    !startNeighbors.has(topo.gateAnchorId));

  // ── 12. graphDistances is internally consistent ──────────────────────────
  // Build our own adjacency from the tiles and verify BFS matches.
  if (strict) {
    const adj = new Map<string, string[]>();
    for (const t of topo.tiles) {
      const k = tileKey(t);
      adj.set(k, neighborKeys(t.q, t.r).filter(nk => tileKeys.has(nk)));
    }
    const recomputed = bfsDistances(adj, topo.startTileId);
    let distMatch = recomputed.size === topo.graphDistances.size;
    if (distMatch) {
      for (const [k, v] of recomputed) {
        if (topo.graphDistances.get(k) !== v) { distMatch = false; break; }
      }
    }
    check(`[${label}] graphDistances matches recomputed BFS`, distMatch);
  }

  // ── 13. Start tile is in the lower half (r ≥ median r) ─────────────────
  const sortedR   = topo.tiles.map(t => t.r).sort((a, b) => a - b);
  const medianR   = sortedR[Math.floor(sortedR.length / 2)];
  const startR    = Number(topo.startTileId.split(',')[1]);
  check(`[${label}] start.r (${startR}) ≥ median r (${medianR})`,
    startR >= medianR, `startR=${startR} medianR=${medianR}`);

  return !failed; // rough: caller should check `failed` directly
}

// ── Run structural tests on representative chapters and seeds ─────────────────

const TEST_CASES: Array<{ chapter: number; seed: string | number }> = [
  { chapter:  1, seed: 'alpha'  },
  { chapter:  1, seed: 42       },
  { chapter:  5, seed: 'beta'   },
  { chapter:  6, seed: 'alpha'  },
  { chapter: 10, seed: 1337     },
  { chapter: 11, seed: 'gamma'  },
  { chapter: 20, seed: 0        },
  { chapter: 21, seed: 'delta'  },
  { chapter: 31, seed: 'alpha'  },
];

for (const { chapter, seed } of TEST_CASES) {
  console.log(`\n── chapter=${chapter} seed=${String(seed)} ──`);
  const label = `ch${chapter}/${String(seed)}`;
  let topo: HexTopology;
  try {
    topo = generateHexTopology({ chapter, seed });
  } catch (err) {
    check(`[${label}] generator did not throw`, false, String(err));
    continue;
  }
  runStructuralTests(topo, label);
}

// ── Determinism tests ─────────────────────────────────────────────────────────

console.log('\n── Determinism ──');

{
  const CASES: Array<{ chapter: number; seed: string | number }> = [
    { chapter: 1,  seed: 'determinism_test' },
    { chapter: 6,  seed: 'determinism_test' },
    { chapter: 11, seed: 999                },
    { chapter: 21, seed: 'fixed_seed'       },
  ];

  for (const opts of CASES) {
    const label = `ch${opts.chapter}/${String(opts.seed)}`;
    let a: HexTopology, b: HexTopology;
    try {
      a = generateHexTopology(opts);
      b = generateHexTopology(opts);
    } catch (err) {
      check(`[determinism ${label}] no throw`, false, String(err));
      continue;
    }
    check(`[determinism ${label}] identical output`, serialise(a) === serialise(b));
  }
}

// ── Seed variation test ───────────────────────────────────────────────────────

console.log('\n── Seed variation ──');

{
  const CHAPTER = 6; // 35 tiles — good mid-range
  const SEEDS: Array<string | number> = ['seed_A', 'seed_B', 'seed_C', 100, 200];

  const results = SEEDS.map(seed => ({
    seed,
    serial: serialise(generateHexTopology({ chapter: CHAPTER, seed })),
  }));

  // Every pair of distinct seeds should produce a different serialisation.
  let allDifferent = true;
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      if (results[i].serial === results[j].serial) {
        allDifferent = false;
        console.error(
          `COLLISION: seeds "${String(results[i].seed)}" and "${String(results[j].seed)}" produced identical maps`,
        );
      }
    }
  }
  check('all distinct seeds produce distinct ch-6 maps', allDifferent);

  // Same chapter, different seeds must differ in at least tileKey set OR start/gate.
  const sameChapDiffSeed = results[0].serial !== results[1].serial;
  check(
    'seed_A vs seed_B differ on ch-6',
    sameChapDiffSeed,
    'seeds should normally produce different maps',
  );
}

// ── Chapter-changes-the-map test ──────────────────────────────────────────────

console.log('\n── Same seed, different chapter ──');

{
  const SEED = 'shared_seed';
  const PAIRS: Array<[number, number]> = [[1, 6], [6, 11], [11, 21]];

  for (const [chA, chB] of PAIRS) {
    const a = generateHexTopology({ chapter: chA, seed: SEED });
    const b = generateHexTopology({ chapter: chB, seed: SEED });
    check(
      `ch${chA} vs ch${chB} with same seed differ`,
      serialise(a) !== serialise(b),
      'different chapters must produce different maps',
    );
  }
}

// ── No-throw test for extended chapter range ───────────────────────────────────

console.log('\n── No-throw across chapter range ──');

{
  const CHAPTERS = [1, 5, 6, 10, 11, 20, 21, 30, 31, 50, 100];
  const SEED     = 'range_test';

  for (const chapter of CHAPTERS) {
    let threw = false;
    let count = 0;
    try {
      const topo = generateHexTopology({ chapter, seed: SEED });
      count      = topo.tiles.length;
    } catch {
      threw = true;
    }
    const expected = getChapterTerrainCellCount(chapter);
    check(
      `ch ${chapter} generates without throw, tile count = ${expected}`,
      !threw && count === expected,
      threw ? 'threw' : `got ${count}`,
    );
  }
}

// ── Result summary ────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
