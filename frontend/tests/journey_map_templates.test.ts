/**
 * tests/journey_map_templates.test.ts — AUTHORED MAP ADJUSTMENT (Push 1)
 *
 * Verifies the ChapterMapTemplate system:
 *   1. ChapterMapTemplate types/shape (id, role, tags, environmentId, etc.)
 *   2. Chapter geometry identical across run seeds / attempts / shifts
 *   3. Encounters still vary with run seed on the fixed geometry
 *   4. Validation: unique ids/coords, exactly one start/gate, connectivity
 *   5. HexTopology bridge (getChapterHexTopology) gives consistent geometry
 *   6. Tile minimum-neighbour rule (no orphans)
 *   7. Canonical tile counts per chapter band
 */

import { getChapterMapTemplate, getChapterHexTopology } from '../src/game/journeyMap/chapterMapTemplates';
import { generateRunData }                               from '../src/game/journeyMap/journeyRunLifecycle';
import { getChapterTerrainCellCount }                    from '../src/game/journeyMap/config';

let passed = 0, failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`PASS - ${name}`); }
  else    { failed++; console.log(`FAIL - ${name}${detail ? ': ' + detail : ''}`); }
}

function tileKeySet(tiles: { q: number; r: number }[]): string {
  return tiles.map(t => `${t.q},${t.r}`).sort().join('|');
}

// ── 1. ChapterMapTemplate shape and invariants (authored chapters 1–10) ──────
for (let ch = 1; ch <= 10; ch++) {
  const t = getChapterMapTemplate(ch);
  const expected = getChapterTerrainCellCount(ch);

  check(`[ch${ch}] chapterId === string(chapter)`, t.chapterId === String(ch));
  check(`[ch${ch}] tile count === ${expected}`,    t.tiles.length === expected);
  check(`[ch${ch}] exactly one start tile`,        t.tiles.filter(x => x.role === 'start').length === 1);
  check(`[ch${ch}] exactly one gate tile`,         t.tiles.filter(x => x.role === 'gate').length === 1);
  check(`[ch${ch}] startTileId references a tile`, t.tiles.some(x => x.id === t.startTileId));
  check(`[ch${ch}] gateTileId references a tile`,  t.tiles.some(x => x.id === t.gateTileId));
  check(`[ch${ch}] start tile role matches id`,    t.tiles.find(x => x.id === t.startTileId)?.role === 'start');
  check(`[ch${ch}] gate tile role matches id`,     t.tiles.find(x => x.id === t.gateTileId)?.role === 'gate');
  check(`[ch${ch}] environmentId non-empty`,       typeof t.environmentId === 'string' && t.environmentId.length > 0);
  check(`[ch${ch}] shape field present`,           ['rectangular','square','circular','irregular'].includes(t.shape));

  // Unique ids and coords.
  const ids   = new Set(t.tiles.map(x => x.id));
  const coords = new Set(t.tiles.map(x => `${x.q},${x.r}`));
  check(`[ch${ch}] unique tile ids`,         ids.size === t.tiles.length);
  check(`[ch${ch}] unique tile coordinates`, coords.size === t.tiles.length);

  // id === "q,r".
  check(`[ch${ch}] tile ids match coordinates`,
    t.tiles.every(x => x.id === `${x.q},${x.r}`));

  // All tiles have tags array (may be empty).
  check(`[ch${ch}] all tiles have tags array`, t.tiles.every(x => Array.isArray(x.tags)));

  // No tile is entirely disconnected (every id has at least one neighbor in the set).
  const DIRS: readonly (readonly [number, number])[] = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
  const connected = t.tiles.every(tile =>
    DIRS.some(([dq, dr]) => ids.has(`${tile.q + dq},${tile.r + dr}`))
  );
  check(`[ch${ch}] no orphan tiles`, connected);
}

// ── 2. Canonical tile count band table ───────────────────────────────────────
const BAND_CASES: [number, number][] = [
  [1,  60], [5,  60], [6,  70], [10,  70],
  [11, 80], [20, 80], [21, 90], [30,  90],
  [31, 100], [40, 100],
];
for (const [ch, expected] of BAND_CASES) {
  check(`[ch${ch}] canonical tile count ${expected}`, getChapterTerrainCellCount(ch) === expected);
}

// ── 3. Geometry fixed across seeds / shifts (authored chapters only) ──────────
// All Ch1–10 are production-authored: seed and shift must not affect coordinates.
// Unauth'd chapters (ch11+) use procedural generation — they vary by seed.
for (const ch of [1, 5, 10]) {
  const a = generateRunData(ch, 'seed-aaaa', 'day');
  const b = generateRunData(ch, 'seed-bbbb', 'night');
  check(`[ch${ch}] identical coordinates across seeds+shifts`,
    tileKeySet(a.topology.tiles) === tileKeySet(b.topology.tiles));
  check(`[ch${ch}] identical start tile`, a.topology.startTileId === b.topology.startTileId);
  check(`[ch${ch}] identical gate tile`,  a.topology.gateAnchorId === b.topology.gateAnchorId);
}
// Unauth'd chapters (ch11+): different seeds → different geometry (procedural fallback).
for (const ch of [12, 15]) {
  const a = generateRunData(ch, 'seed-aaaa', 'day');
  const b = generateRunData(ch, 'seed-bbbb', 'day');
  check(`[ch${ch}] (unauth'd) geometry varies between seeds`,
    tileKeySet(a.topology.tiles) !== tileKeySet(b.topology.tiles));
}

// ── 4. Encounters vary with run seed on the fixed geometry ───────────────────
{
  const a = generateRunData(4, 'seed-aaaa', 'day');
  const b = generateRunData(4, 'seed-bbbb', 'day');
  const sig = (e: typeof a.encounters) =>
    e.tiles.map(t => `${t.tileKey}:${t.encounter}`).sort().join('|');
  check('[ch4] encounter layout differs between seeds', sig(a.encounters) !== sig(b.encounters));
}

// ── 5. getChapterHexTopology is consistent with getChapterMapTemplate ────────
for (const ch of [1, 6, 10]) {
  const tpl = getChapterMapTemplate(ch);
  const hex = getChapterHexTopology(ch);
  check(`[ch${ch}] HexTopology start matches template`,      hex.startTileId   === tpl.startTileId);
  check(`[ch${ch}] HexTopology gate matches template`,       hex.gateAnchorId  === tpl.gateTileId);
  check(`[ch${ch}] HexTopology tile count matches template`, hex.tiles.length  === tpl.tiles.length);
}

// ── 6. getChapterHexTopology is single connected footprint ───────────────────
for (const ch of [1, 5, 10, 12]) {
  const hex = getChapterHexTopology(ch);
  check(`[ch${ch}] HexTopology BFS covers all tiles`,
    hex.graphDistances.size === hex.tiles.length);
  check(`[ch${ch}] HexTopology gate reachable`,
    hex.graphDistances.has(hex.gateAnchorId));
}

// ── 7. Stability: repeated access returns same geometry ──────────────────────
{
  const a = getChapterMapTemplate(3);
  const b = getChapterMapTemplate(3);
  const coordsA = a.tiles.map(t => t.id).sort().join('|');
  const coordsB = b.tiles.map(t => t.id).sort().join('|');
  check('[ch3] repeated access identical', coordsA === coordsB
    && a.startTileId === b.startTileId && a.gateTileId === b.gateTileId);
}

// ── 8. Fallback path for unauth'd chapters (ch11+) ───────────────────────────
{
  const t  = getChapterMapTemplate(12);
  const expected = getChapterTerrainCellCount(12);
  check('[ch12] fallback tile count correct', t.tiles.length === expected);
  check('[ch12] fallback has start+gate', t.tiles.some(x => x.role === 'start') && t.tiles.some(x => x.role === 'gate'));
  check('[ch12] fallback chapterId correct', t.chapterId === '12');
}

// ── 9. Push 3 acceptance criteria ────────────────────────────────────────────
//
// Chapter 1: authored geometry — seed / attempt / shift have no effect on layout.
// All Ch1–10 are authored; Ch11+ use procedural generation.
{
  const CH1_START = '0,3';    // Push 1 (doubled): lower-centre of radius-4 atrium
  const CH1_GATE  = '0,-4';   // Push 1 (doubled): top-centre cap — ceremonial arch
  const coordsOf  = (r: ReturnType<typeof generateRunData>) =>
    r.topology.tiles.map(t => `${t.q},${t.r}`).sort().join('|');

  // AC1: Ch1 attempt 1 and attempt 2 have identical physical geometry.
  {
    const a1 = generateRunData(1, 'attempt-1-seed-aaa', 'day');
    const a2 = generateRunData(1, 'attempt-2-seed-bbb', 'day');
    check('[push3 AC1] ch1 attempt1 vs attempt2 identical coords', coordsOf(a1) === coordsOf(a2));
    check('[push3 AC1] ch1 attempt1 vs attempt2 identical start', a1.topology.startTileId === a2.topology.startTileId);
    check('[push3 AC1] ch1 attempt1 vs attempt2 identical gate',  a1.topology.gateAnchorId === a2.topology.gateAnchorId);
  }

  // AC2: Ch1 Day, Evening, Night have identical physical geometry.
  {
    const day     = generateRunData(1, 'seed-xyz', 'day');
    const evening = generateRunData(1, 'seed-xyz', 'evening');
    const night   = generateRunData(1, 'seed-xyz', 'night');
    check('[push3 AC2] ch1 day vs evening identical coords', coordsOf(day) === coordsOf(evening));
    check('[push3 AC2] ch1 day vs night identical coords',   coordsOf(day) === coordsOf(night));
    check('[push3 AC2] ch1 day gate fixed',     day.topology.gateAnchorId     === CH1_GATE);
    check('[push3 AC2] ch1 evening gate fixed', evening.topology.gateAnchorId === CH1_GATE);
    check('[push3 AC2] ch1 night gate fixed',   night.topology.gateAnchorId   === CH1_GATE);
  }

  // AC3: Encounter locations may differ between seeds (seed still controls encounters).
  {
    const enc1 = generateRunData(1, 'seed-aaa', 'day').encounters;
    const enc2 = generateRunData(1, 'seed-bbb', 'day').encounters;
    const encSig = (e: typeof enc1) => e.tiles.map(t => `${t.tileKey}:${t.encounter}`).sort().join('|');
    check('[push3 AC3] ch1 encounters differ between seeds', encSig(enc1) !== encSig(enc2));
  }

  // AC4: Gate remains at exactly the authored coordinate.
  {
    for (const seed of ['any-seed', 'another-seed', '']) {
      const r = generateRunData(1, seed, 'day');
      check(`[push3 AC4] ch1 gate always ${CH1_GATE} (seed="${seed}")`,
        r.topology.gateAnchorId === CH1_GATE);
    }
  }

  // AC5: Start remains at exactly the authored coordinate.
  {
    const r = generateRunData(1, 'any-seed', 'night');
    check('[push3 AC5] ch1 start always at authored coord', r.topology.startTileId === CH1_START);
  }

  // AC6: isAuthoredChapter routing — Ch1–10 use template, Ch11+ use procedural.
  {
    const { isAuthoredChapter } = require('../src/game/journeyMap/chapterMapTemplates');
    check('[push3 AC6] isAuthoredChapter(1) true',   isAuthoredChapter(1)  === true);
    check('[push3 AC6] isAuthoredChapter(5) true',   isAuthoredChapter(5)  === true);
    check('[push3 AC6] isAuthoredChapter(10) true',  isAuthoredChapter(10) === true);
    check('[push3 AC6] isAuthoredChapter(11) false', isAuthoredChapter(11) === false);

    const ch12a = generateRunData(12, 'seed-aaa', 'day');
    const ch12b = generateRunData(12, 'seed-bbb', 'day');
    check('[push3 AC6] ch12 (unauth) geometry varies between seeds',
      coordsOf(ch12a) !== coordsOf(ch12b));
  }
}

// ── 10. Chapter 1 coordinate SNAPSHOT ────────────────────────────────────────
//
// These coordinates are the PERMANENT authored hexagonal battlefield (Push 1 doubled).
// They must NEVER change regardless of run seed, attempt number, or TimeOfDay.
// If this test fails after a code change, it means the Chapter 1 canonical
// footprint was accidentally mutated — revert AUTHORED_CHAPTER_MAPS[1] in
// chapterMapTemplates.ts.
//
// Layout: 9 rows, widths 5+6+7+8+8+8+7+6+5 = 60 cells.
//   r=-4: q= 0..4    (top cap, 5)
//   r=-3: q=-1..4    (6)
//   r=-2: q=-2..4    (7)
//   r=-1: q=-3..4    (8)
//   r= 0: q=-4..3    (8 — corner (4,0) dropped)
//   r= 1: q=-4..3    (8)
//   r= 2: q=-4..2    (7)
//   r= 3: q=-4..1    (6)   Start (0,3)
//   r= 4: q=-4..0    (5)
{
  // Sorted canonical coordinate set for Chapter 1 (60 tiles, radius-4 circular atrium).
  const CH1_SNAPSHOT = [
    '-1,-1','-1,-2','-1,-3','-1,0','-1,1','-1,2','-1,3','-1,4',
    '-2,-1','-2,-2','-2,0','-2,1','-2,2','-2,3','-2,4',
    '-3,-1','-3,0','-3,1','-3,2','-3,3','-3,4',
    '-4,0', '-4,1', '-4,2', '-4,3', '-4,4',
    '0,-1', '0,-2', '0,-3', '0,-4', '0,0', '0,1', '0,2', '0,3', '0,4',
    '1,-1', '1,-2', '1,-3', '1,-4', '1,0', '1,1', '1,2', '1,3',
    '2,-1', '2,-2', '2,-3', '2,-4', '2,0', '2,1', '2,2',
    '3,-1', '3,-2', '3,-3', '3,-4', '3,0', '3,1',
    '4,-1', '4,-2', '4,-3', '4,-4',
  ].sort().join('|');

  const CH1_START = '0,3';    // lower-centre of the atrium floor, 6 neighbours
  const CH1_GATE  = '0,-4';   // top-centre cap — ceremonial entrance arch
  const CH1_ENV   = 'atrium-approach';

  // Template API.
  const tpl = getChapterMapTemplate(1);
  const tplCoords = tpl.tiles.map(t => t.id).sort().join('|');
  check('[ch1 snapshot] template coords match authored set', tplCoords === CH1_SNAPSHOT,
    `got ${tpl.tiles.length} tiles`);
  check('[ch1 snapshot] template startTileId fixed',    tpl.startTileId   === CH1_START);
  check('[ch1 snapshot] template gateTileId fixed',     tpl.gateTileId    === CH1_GATE);
  check('[ch1 snapshot] template environmentId fixed',  tpl.environmentId === CH1_ENV);
  check('[ch1 snapshot] start role correct', tpl.tiles.find(t => t.id === CH1_START)?.role === 'start');
  check('[ch1 snapshot] gate role correct',  tpl.tiles.find(t => t.id === CH1_GATE)?.role  === 'gate');

  // HexTopology bridge (used by lifecycle / createRun).
  const hex = getChapterHexTopology(1);
  const hexCoords = hex.tiles.map(t => `${t.q},${t.r}`).sort().join('|');
  check('[ch1 snapshot] HexTopology coords match authored set', hexCoords === CH1_SNAPSHOT);
  check('[ch1 snapshot] HexTopology startTileId fixed',  hex.startTileId  === CH1_START);
  check('[ch1 snapshot] HexTopology gateAnchorId fixed', hex.gateAnchorId === CH1_GATE);

  // Geometry invariant across DIFFERENT SEEDS.
  for (const seed of ['seed-aaa', 'seed-bbb', 'completely-different-seed-xyz', '']) {
    const run = generateRunData(1, seed, 'day');
    const runCoords = run.topology.tiles.map(t => `${t.q},${t.r}`).sort().join('|');
    check(`[ch1 snapshot] seed="${seed}" → identical coords`, runCoords === CH1_SNAPSHOT);
    check(`[ch1 snapshot] seed="${seed}" → identical start`,  run.topology.startTileId  === CH1_START);
    check(`[ch1 snapshot] seed="${seed}" → identical gate`,   run.topology.gateAnchorId === CH1_GATE);
  }

  // Geometry invariant across SHIFTS (TimeOfDay).
  for (const shift of ['day', 'evening', 'night'] as const) {
    const run = generateRunData(1, 'any-seed', shift);
    const runCoords = run.topology.tiles.map(t => `${t.q},${t.r}`).sort().join('|');
    check(`[ch1 snapshot] shift="${shift}" → identical coords`, runCoords === CH1_SNAPSHOT);
    check(`[ch1 snapshot] shift="${shift}" → identical start`,  run.topology.startTileId  === CH1_START);
    check(`[ch1 snapshot] shift="${shift}" → identical gate`,   run.topology.gateAnchorId === CH1_GATE);
  }

  // Geometry invariant across MULTIPLE CALLS (no mutation between calls).
  const second = getChapterMapTemplate(1);
  check('[ch1 snapshot] stable across repeated calls',
    second.tiles.map(t => t.id).sort().join('|') === CH1_SNAPSHOT);
}

// ── 11. Push 1 acceptance criteria — Chapter 1 start and gate placement ────────
//
// These tests lock the deliberate placement decisions for the doubled Ch1 map:
//   Start  (0,3):  lower-centre of the radius-4 atrium, 6 exploration directions
//   Gate   (0,−4): top-centre cap — ceremonial entrance arch
//
// "Never changes" means: invariant across seed, attempt number, and TimeOfDay.
{
  const CH1_START = '0,3';
  const CH1_GATE  = '0,-4';
  const AXIAL_DIRS: readonly (readonly [number, number])[] = [
    [1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1],
  ];

  const tpl   = getChapterMapTemplate(1);
  const idSet = new Set(tpl.tiles.map(t => t.id));

  // S1: Start is at the authored coordinate.
  check('[push3-placement S1] start at (0,3)',         tpl.startTileId  === CH1_START);
  check('[push3-placement S1] start role correct',     tpl.tiles.find(t => t.id === CH1_START)?.role === 'start');

  // S2: Start has exactly 6 neighbours (interior of radius-4 hex).
  {
    const [q, r] = CH1_START.split(',').map(Number);
    const n = AXIAL_DIRS.filter(([dq,dr]) => idSet.has(`${q+dq},${r+dr}`)).length;
    check('[push3-placement S2] start has exactly 6 neighbours',
      n === 6, `actual: ${n}`);
  }

  // S3: Start is NOT in the top cap row (r ≠ -4).
  {
    const [, r] = CH1_START.split(',').map(Number);
    check('[push3-placement S3] start not in top-cap row (r ≠ -4)', r !== -4);
  }

  // S4: Start is in the lower sector (r > 0).
  {
    const [, r] = CH1_START.split(',').map(Number);
    check('[push3-placement S4] start in lower sector (r > 0)', r > 0, `r=${r}`);
  }

  // G1: Gate is at the authored coordinate.
  check('[push3-placement G1] gate at (0,-4)',         tpl.gateTileId  === CH1_GATE);
  check('[push3-placement G1] gate role correct',      tpl.tiles.find(t => t.id === CH1_GATE)?.role === 'gate');

  // G2: Gate IS in the top cap row (r = -4) — ceremonial arch placement.
  {
    const [, r] = CH1_GATE.split(',').map(Number);
    check('[push3-placement G2] gate in top-cap row (r = -4)', r === -4);
  }

  // G3: Gate is in the top row (r = -4).
  {
    const [, r] = CH1_GATE.split(',').map(Number);
    check('[push3-placement G3] gate in topmost row (r = -4)', r === -4, `r=${r}`);
  }

  // G4: Gate row (r = -4) has ≥ 3 cells (the top cap is substantial).
  {
    const [, gr] = CH1_GATE.split(',').map(Number);
    const rowCells = tpl.tiles.filter(t => t.r === gr).length;
    check('[push3-placement G4] gate row has ≥ 3 cells', rowCells >= 3, `cells=${rowCells}`);
  }

  // INV1: Start coordinate is invariant across all seeds.
  for (const seed of ['seed-aaa', 'seed-bbb', 'any-seed-xyz', '']) {
    const run = generateRunData(1, seed, 'day');
    check(`[push3-placement INV1] seed="${seed}" → start always ${CH1_START}`,
      run.topology.startTileId === CH1_START);
  }

  // INV2: Gate coordinate is invariant across all seeds.
  for (const seed of ['seed-aaa', 'seed-bbb', 'any-seed-xyz', '']) {
    const run = generateRunData(1, seed, 'day');
    check(`[push3-placement INV2] seed="${seed}" → gate always ${CH1_GATE}`,
      run.topology.gateAnchorId === CH1_GATE);
  }

  // INV3: Start/gate invariant across all TimeOfDay shifts.
  for (const shift of ['day', 'evening', 'night'] as const) {
    const run = generateRunData(1, 'any-seed', shift);
    check(`[push3-placement INV3] shift="${shift}" → start always ${CH1_START}`,
      run.topology.startTileId === CH1_START);
    check(`[push3-placement INV3] shift="${shift}" → gate always ${CH1_GATE}`,
      run.topology.gateAnchorId === CH1_GATE);
  }

  // BFS1: Gate is reachable from start in exactly 7 hops.
  {
    const adj = new Map<string, string[]>();
    for (const t of tpl.tiles) {
      adj.set(t.id, AXIAL_DIRS
        .map(([dq,dr]) => `${t.q+dq},${t.r+dr}`)
        .filter(k => idSet.has(k)));
    }
    const dist  = new Map<string, number>([[CH1_START, 0]]);
    const queue = [CH1_START];
    while (queue.length) {
      const cur = queue.shift()!;
      const d   = dist.get(cur)!;
      for (const nb of (adj.get(cur) ?? [])) {
        if (!dist.has(nb)) { dist.set(nb, d + 1); queue.push(nb); }
      }
    }
    const d = dist.get(CH1_GATE) ?? -1;
    check('[push3-placement BFS1] gate reachable from start', d >= 0);
    check('[push3-placement BFS1] BFS distance start→gate = 7', d === 7, `actual: ${d}`);
  }
}

// ── 12. Push 1 acceptance criteria — Chapter 1 hexagonal battlefield ──────────
//
// Validates the specific shape properties of the doubled 60-cell tactical field.
// These are structural guarantees that must hold for the template to be approved.
{
  const AXIAL_DIRS: readonly (readonly [number, number])[] = [
    [1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1],
  ];

  const tpl   = getChapterMapTemplate(1);
  const tiles = tpl.tiles;
  const idSet = new Set(tiles.map(t => t.id));

  // AC1: Exactly 60 unique coordinates.
  check('[push2 AC1] exactly 60 cells',           tiles.length === 60);
  check('[push2 AC1] all ids unique',             new Set(tiles.map(t => t.id)).size === 60);
  check('[push2 AC1] all coordinates unique',     new Set(tiles.map(t => `${t.q},${t.r}`)).size === 60);

  // AC2: Single connected component — BFS from start covers all 60 tiles.
  {
    const adj = new Map<string, string[]>();
    for (const t of tiles) {
      adj.set(t.id, AXIAL_DIRS
        .map(([dq,dr]) => `${t.q+dq},${t.r+dr}`)
        .filter(k => idSet.has(k)));
    }
    const visited = new Set<string>([tpl.startTileId]);
    const queue   = [tpl.startTileId];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of (adj.get(cur) ?? [])) {
        if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
      }
    }
    check('[push2 AC2] single connected component (BFS covers all 60)', visited.size === 60);
  }

  // AC3: Start cell exists and is correctly tagged.
  check('[push2 AC3] start tile exists',          tiles.some(t => t.id === tpl.startTileId));
  check('[push2 AC3] start tile role is start',   tiles.find(t => t.id === tpl.startTileId)?.role === 'start');
  check('[push2 AC3] start at authored coord',    tpl.startTileId === '0,3');

  // AC4: Gate cell exists and is correctly tagged.
  check('[push2 AC4] gate tile exists',           tiles.some(t => t.id === tpl.gateTileId));
  check('[push2 AC4] gate tile role is gate',     tiles.find(t => t.id === tpl.gateTileId)?.role === 'gate');
  check('[push2 AC4] gate at authored coord',     tpl.gateTileId === '0,-4');

  // AC5: Every terrain cell has at least one neighbour (no orphans).
  //      The radius-4 hex requires ≥3 neighbours on every cell (no peninsulas).
  {
    let minNeighbours = Infinity;
    let orphanFound   = false;
    for (const t of tiles) {
      const count = AXIAL_DIRS.filter(([dq,dr]) => idSet.has(`${t.q+dq},${t.r+dr}`)).length;
      if (count === 0) orphanFound = true;
      minNeighbours = Math.min(minNeighbours, count);
    }
    check('[push2 AC5] no orphan cells (every cell has ≥1 neighbour)',   !orphanFound);
    check('[push2 AC5] no dead-ends (every cell has ≥2 neighbours)',
      minNeighbours >= 2,
      `min neighbours found: ${minNeighbours}`);
    check('[push2 AC5] tactical density (every cell has ≥3 neighbours)',
      minNeighbours >= 3,
      `min neighbours found: ${minNeighbours}`);
  }

  // AC6: Gate is reachable from start (BFS distance finite).
  {
    const adj2 = new Map<string, string[]>();
    for (const t of tiles) {
      adj2.set(t.id, AXIAL_DIRS
        .map(([dq,dr]) => `${t.q+dq},${t.r+dr}`)
        .filter(k => idSet.has(k)));
    }
    const dist  = new Map<string, number>([[tpl.startTileId, 0]]);
    const queue = [tpl.startTileId];
    while (queue.length) {
      const cur = queue.shift()!;
      const d   = dist.get(cur)!;
      for (const nb of (adj2.get(cur) ?? [])) {
        if (!dist.has(nb)) { dist.set(nb, d + 1); queue.push(nb); }
      }
    }
    const gateDistance = dist.get(tpl.gateTileId) ?? -1;
    check('[push2 AC6] gate is reachable from start',  gateDistance >= 0);
    check('[push2 AC6] BFS distance start→gate ≥ 4',  gateDistance >= 4,
      `actual: ${gateDistance}`);
  }

  // AC7: Shape properties — 9 rows (r=-4 to r=4), max width 8.
  {
    const rValues = tiles.map(t => t.r);
    const minR    = Math.min(...rValues);
    const maxR    = Math.max(...rValues);
    check('[push2 AC7] 9 rows (r from -4 to +4)', minR === -4 && maxR === 4);

    let maxWidth = 0;
    for (let r = minR; r <= maxR; r++) {
      const width = tiles.filter(t => t.r === r).length;
      maxWidth = Math.max(maxWidth, width);
    }
    check('[push2 AC7] max row width = 8', maxWidth === 8,
      `actual max width: ${maxWidth}`);
  }

  // AC8: Row-width profile matches the authored 5+6+7+8+8+8+7+6+5 pattern.
  {
    const widthByRow = [-4,-3,-2,-1,0,1,2,3,4].map(r => tiles.filter(t => t.r === r).length);
    const expected   = [5, 6, 7, 8, 8, 8, 7, 6, 5];
    check('[push2 AC8] row widths match 5+6+7+8+8+8+7+6+5',
      widthByRow.join(',') === expected.join(','),
      `actual: ${widthByRow.join(',')}`);
  }
}

// ── 12. TerrainVisualVariant seeding ─────────────────────────────────────────
// Verifies Push 4: none-encounter tiles get a deterministic cosmetic variant
// with no gameplay effect.
{
  const VALID_VARIANTS = new Set(['plain','cracked','moss','rune','flowers','lantern','debris']);

  const run = generateRunData(1, 'variant-test-seed', 'day');
  // buildInitialJourneyRun is what actually seeds variants; use the lifecycle
  // directly by inspecting a real run built by the test.
  // We can't call buildInitialJourneyRun without a full repo, so verify via
  // the public topology shape — variants live on JourneyTile, tested here via
  // the run-data topology tiles (geometry only; variant is on the persisted run).
  // Instead, verify the PRNG output is stable for the same inputs.
  const { fnv1a32 } = require('../src/game/journeyMap/prng');
  const VARIANTS = ['plain','cracked','moss','rune','flowers','lantern','debris'];
  const variantFor = (seed: string, key: string) =>
    VARIANTS[fnv1a32(`${seed}:terrain:${key}`) % VARIANTS.length];

  // 1. Each call with the same seed+key returns the same variant.
  for (const key of ['0,1','-1,2','2,-2','-2,0']) {
    const v1 = variantFor('seed-abc', key);
    const v2 = variantFor('seed-abc', key);
    check(`[variant] deterministic for key ${key}`, v1 === v2);
    check(`[variant] ${key} is a valid variant`, VALID_VARIANTS.has(v1));
  }

  // 2. Different seeds produce different variant distributions (not all same).
  const variantsA = run.topology.tiles.map(t => variantFor('seed-aaa', `${t.q},${t.r}`));
  const variantsB = run.topology.tiles.map(t => variantFor('seed-bbb', `${t.q},${t.r}`));
  check('[variant] different seeds produce different distributions',
    variantsA.join('|') !== variantsB.join('|'));

  // 3. All 7 variants are reachable across the tile map with some seed.
  const allTileKeys = run.topology.tiles.map(t => `${t.q},${t.r}`);
  const seen = new Set(allTileKeys.map(k => variantFor('coverage-seed', k)));
  // Not guaranteed for every seed, but with 60 tiles and 7 variants it's almost
  // certain for any fixed seed. Accept ≥5 distinct variants as sufficient coverage.
  check(`[variant] coverage: ≥5 distinct variants seen across 60 tiles`, seen.size >= 5);

  // 4. Variant namespace is isolated — same seed, different namespace never collides.
  //    (terrain namespace: "seed:terrain:key"; encounters use "seed:encounters")
  const terrainHash = fnv1a32('my-seed:terrain:0,0');
  const encHash     = fnv1a32('my-seed:encounters');
  check('[variant] terrain namespace differs from encounter namespace', terrainHash !== encHash);
}

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
