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
import { getChapterTileCount }                           from '../src/game/journeyMap/config';

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
  const expected = getChapterTileCount(ch);

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
  [1, 30], [5, 30], [6, 35], [10, 35],
  [11, 40], [20, 40], [21, 45], [30, 45],
  [31, 50], [40, 50],
];
for (const [ch, expected] of BAND_CASES) {
  check(`[ch${ch}] canonical tile count ${expected}`, getChapterTileCount(ch) === expected);
}

// ── 3. Geometry fixed across seeds / shifts via run data ─────────────────────
for (const ch of [1, 4, 7, 10]) {
  const a = generateRunData(ch, 'seed-aaaa', 'day');
  const b = generateRunData(ch, 'seed-bbbb', 'night');
  check(`[ch${ch}] identical coordinates across seeds+shifts`,
    tileKeySet(a.topology.tiles) === tileKeySet(b.topology.tiles));
  check(`[ch${ch}] identical start tile`, a.topology.startTileId === b.topology.startTileId);
  check(`[ch${ch}] identical gate tile`,  a.topology.gateAnchorId === b.topology.gateAnchorId);
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
  const expected = getChapterTileCount(12);
  check('[ch12] fallback tile count correct', t.tiles.length === expected);
  check('[ch12] fallback has start+gate', t.tiles.some(x => x.role === 'start') && t.tiles.some(x => x.role === 'gate'));
  check('[ch12] fallback chapterId correct', t.chapterId === '12');
}

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
