/**
 * tests/journey_map_templates.test.ts — AUTHORED MAP ADJUSTMENT
 *
 * Verifies the canonical authored-geometry rule:
 *   1. Chapter geometry is identical regardless of run seed / attempt / shift
 *      (generateRunData with different seeds → same coordinates, start, gate).
 *   2. Encounters still vary with the run seed on the fixed geometry.
 *   3. Templates are single connected footprints (no floating islands).
 *   4. Callers cannot mutate the canonical template (defensive copy).
 */

import { getChapterMapTemplate } from '../src/game/journeyMap/chapterMapTemplates';
import { generateRunData }        from '../src/game/journeyMap/journeyRunLifecycle';

let passed = 0, failed = 0;
function check(name: string, ok: boolean) {
  if (ok) { passed++; console.log(`PASS - ${name}`); }
  else    { failed++; console.log(`FAIL - ${name}`); }
}

function tileKeySet(tiles: { q: number; r: number }[]): string {
  return tiles.map(t => `${t.q},${t.r}`).sort().join('|');
}

// ── 1. Geometry fixed across seeds / shifts ──────────────────────────────────
for (const ch of [1, 4, 7, 10, 12]) {
  const a = generateRunData(ch, 'seed-aaaa', 'day');
  const b = generateRunData(ch, 'seed-bbbb', 'night');
  check(`[ch${ch}] identical coordinates across seeds+shifts`,
    tileKeySet(a.topology.tiles) === tileKeySet(b.topology.tiles));
  check(`[ch${ch}] identical start tile`, a.topology.startTileId === b.topology.startTileId);
  check(`[ch${ch}] identical gate tile`,  a.topology.gateAnchorId === b.topology.gateAnchorId);
}

// ── 2. Encounters still vary with run seed ───────────────────────────────────
{
  const a = generateRunData(4, 'seed-aaaa', 'day');
  const b = generateRunData(4, 'seed-bbbb', 'day');
  const sig = (e: typeof a.encounters) =>
    e.tiles.map(t => `${t.tileKey}:${t.encounter}`).sort().join('|');
  check('[ch4] encounter layout differs between seeds', sig(a.encounters) !== sig(b.encounters));
}

// ── 3. Connected single footprint, valid start/gate ──────────────────────────
for (let ch = 1; ch <= 12; ch++) {
  const t = getChapterMapTemplate(ch);
  const keys = new Set(t.tiles.map(c => `${c.q},${c.r}`));
  check(`[ch${ch}] connected footprint (BFS covers all tiles)`,
    t.graphDistances.size === t.tiles.length);
  check(`[ch${ch}] start+gate present`, keys.has(t.startTileId) && keys.has(t.gateAnchorId));
  check(`[ch${ch}] gate not at start`, t.startTileId !== t.gateAnchorId);
}

// ── 4. Defensive copy — mutation cannot poison the canonical template ────────
{
  const first = getChapterMapTemplate(1);
  const originalCount = first.tiles.length;
  first.tiles.pop();
  first.graphDistances.clear();
  const second = getChapterMapTemplate(1);
  check('[ch1] template immune to caller mutation',
    second.tiles.length === originalCount && second.graphDistances.size === originalCount);
}

// ── 5. Stability across repeated access ──────────────────────────────────────
{
  const a = getChapterMapTemplate(3);
  const b = getChapterMapTemplate(3);
  check('[ch3] repeated access identical', tileKeySet(a.tiles) === tileKeySet(b.tiles)
    && a.startTileId === b.startTileId && a.gateAnchorId === b.gateAnchorId);
}

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
