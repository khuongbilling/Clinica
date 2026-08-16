/**
 * tests/journey_map_blueprint.test.ts — Push 2: Navigation-First Blueprint
 *
 * Verifies the ChapterMapBlueprint system:
 *   1. Blueprint shape and field invariants (all authored chapters 1–10)
 *   2. Walkable cells match the chapter template exactly
 *   3. Clearings are valid, non-empty, and within the walkable set
 *   4. start + gate clearings have the correct cells and purpose
 *   5. World margins contain the entire walkable footprint
 *   6. Blueprint is stable across repeated calls (immutable cache)
 *   7. Blueprint seed is stable and per-chapter (not per-run)
 *   8. Generation order: blueprint is derivable before any art decisions
 *   9. Rechallenging invariants: geometry fields are identical across runs
 *  10. Archetypes are correct for all Book I chapters
 */

import { getChapterMapBlueprint }  from '../src/game/journeyMap/chapterMapBlueprint';
import { getChapterMapTemplate }    from '../src/game/journeyMap/chapterMapTemplates';
import { getChapterTerrainCellCount } from '../src/game/journeyMap/config';
import type { AxialCoord }          from '../src/game/journeyMap/topology';
import type {
  MapArchetype,
  ClearingPurpose,
} from '../src/game/journeyMap/chapterMapTemplate.types';

let passed = 0, failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`PASS - ${name}`); }
  else    { failed++; console.log(`FAIL - ${name}${detail ? ': ' + detail : ''}`); }
}

// ── helpers ───────────────────────────────────────────────────────────────────

const AXIAL_DIRS: readonly (readonly [number, number])[] = [
  [1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1],
];

function coordKey(c: AxialCoord) { return `${c.q},${c.r}`; }

function bfsDistances(adj: Map<string, string[]>, startId: string): Map<string, number> {
  const dist  = new Map<string, number>([[startId, 0]]);
  const queue = [startId];
  while (queue.length) {
    const cur = queue.shift()!;
    const d   = dist.get(cur)!;
    for (const nb of (adj.get(cur) ?? [])) {
      if (!dist.has(nb)) { dist.set(nb, d + 1); queue.push(nb); }
    }
  }
  return dist;
}

function buildAdj(keys: Set<string>): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const k of keys) {
    const [q, r] = k.split(',').map(Number);
    adj.set(k, AXIAL_DIRS
      .map(([dq, dr]) => `${q! + dq},${r! + dr}`)
      .filter(nb => keys.has(nb)));
  }
  return adj;
}

// ── 1. Shape and field invariants (all authored chapters 1–10) ────────────────

const EXPECTED_ARCHETYPES: Record<number, MapArchetype> = {
  1:  'simulation_plaza',
  2:  'academic_quad',
  3:  'simulation_complex',
  4:  'simulation_plaza',
  5:  'academic_quad',
  6:  'simulation_complex',
  7:  'simulation_plaza',
  8:  'academic_quad',
  9:  'simulation_complex',
  10: 'simulation_plaza',
};

for (let ch = 1; ch <= 10; ch++) {
  const bp       = getChapterMapBlueprint(ch);
  const expected = getChapterTerrainCellCount(ch);

  check(`[ch${ch}] chapterId === ${ch}`,         bp.chapterId === ch);
  check(`[ch${ch}] tileCount === ${expected}`,   bp.tileCount === expected);
  check(`[ch${ch}] walkableCells.length === ${expected}`,
    bp.walkableCells.length === expected);

  check(`[ch${ch}] archetype correct`,
    bp.archetype === EXPECTED_ARCHETYPES[ch],
    `got '${bp.archetype}', want '${EXPECTED_ARCHETYPES[ch]}'`);

  check(`[ch${ch}] startCell present`,   typeof bp.startCell.q === 'number');
  check(`[ch${ch}] gateCell present`,    typeof bp.gateCell.q  === 'number');

  check(`[ch${ch}] clearings non-empty`, bp.clearings.length >= 2);
  check(`[ch${ch}] clearings is Array`,  Array.isArray(bp.clearings));
  check(`[ch${ch}] obstacleZones is Array`, Array.isArray(bp.obstacleZones));
  check(`[ch${ch}] scenicZones is Array`,   Array.isArray(bp.scenicZones));

  // Margins object shape
  const m = bp.worldMarginTiles;
  check(`[ch${ch}] margins.marginTiles >= 1`, m.marginTiles >= 1);
  check(`[ch${ch}] margins.minQ <= margins.maxQ`, m.minQ <= m.maxQ);
  check(`[ch${ch}] margins.minR <= margins.maxR`, m.minR <= m.maxR);

  // Seed is a non-empty string
  check(`[ch${ch}] seed non-empty string`,
    typeof bp.seed === 'string' && bp.seed.length > 0);
}

// ── 2. Walkable cells match the chapter template exactly ─────────────────────

for (let ch = 1; ch <= 10; ch++) {
  const bp  = getChapterMapBlueprint(ch);
  const tpl = getChapterMapTemplate(ch);

  const bpKeys  = new Set(bp.walkableCells.map(coordKey));
  const tplKeys = new Set(tpl.tiles.map(t => t.id));

  check(`[ch${ch}] walkableCells matches template (count)`,
    bpKeys.size === tplKeys.size);
  check(`[ch${ch}] walkableCells matches template (set equality)`,
    [...bpKeys].every(k => tplKeys.has(k)) &&
    [...tplKeys].every(k => bpKeys.has(k)));
}

// ── 3. startCell and gateCell match template ──────────────────────────────────

for (let ch = 1; ch <= 10; ch++) {
  const bp  = getChapterMapBlueprint(ch);
  const tpl = getChapterMapTemplate(ch);

  check(`[ch${ch}] startCell matches template.startTileId`,
    coordKey(bp.startCell) === tpl.startTileId);
  check(`[ch${ch}] gateCell matches template.gateTileId`,
    coordKey(bp.gateCell) === tpl.gateTileId);
}

// ── 4. Clearings are valid ────────────────────────────────────────────────────

const VALID_PURPOSES: ClearingPurpose[] = [
  'general','encounter','treasure','merchant','ward_event','boss','landmark',
];

for (let ch = 1; ch <= 10; ch++) {
  const bp       = getChapterMapBlueprint(ch);
  const walkKeys = new Set(bp.walkableCells.map(coordKey));

  for (const cl of bp.clearings) {
    check(`[ch${ch}] clearing "${cl.id}" non-empty cells`, cl.cells.length > 0);
    check(`[ch${ch}] clearing "${cl.id}" purpose is valid`,
      VALID_PURPOSES.includes(cl.purpose));
    check(`[ch${ch}] clearing "${cl.id}" center in walkable set`,
      walkKeys.has(coordKey(cl.center)));
    check(`[ch${ch}] clearing "${cl.id}" all cells in walkable set`,
      cl.cells.every(c => walkKeys.has(coordKey(c))));
    check(`[ch${ch}] clearing "${cl.id}" minimumOpenRadius >= 1`,
      cl.minimumOpenRadius >= 1);
    check(`[ch${ch}] clearing "${cl.id}" id non-empty`,
      typeof cl.id === 'string' && cl.id.length > 0);
  }
}

// ── 5. Mandatory clearings: "start" (general) and "gate" (boss) ──────────────

for (let ch = 1; ch <= 10; ch++) {
  const bp = getChapterMapBlueprint(ch);

  const startClearing = bp.clearings.find(c => c.id === 'start');
  const gateClearing  = bp.clearings.find(c => c.id === 'gate');

  check(`[ch${ch}] "start" clearing exists`,   startClearing !== undefined);
  check(`[ch${ch}] "start" clearing purpose === general`,
    startClearing?.purpose === 'general');
  check(`[ch${ch}] "start" clearing center === startCell`,
    startClearing !== undefined &&
    coordKey(startClearing.center) === coordKey(bp.startCell));

  check(`[ch${ch}] "gate" clearing exists`,    gateClearing !== undefined);
  check(`[ch${ch}] "gate" clearing purpose === boss`,
    gateClearing?.purpose === 'boss');
  check(`[ch${ch}] "gate" clearing center === gateCell`,
    gateClearing !== undefined &&
    coordKey(gateClearing.center) === coordKey(bp.gateCell));

  // Clearing cells must include the anchor tile
  check(`[ch${ch}] "start" clearing contains startCell`,
    startClearing?.cells.some(c => coordKey(c) === coordKey(bp.startCell)) ?? false);
  check(`[ch${ch}] "gate" clearing contains gateCell`,
    gateClearing?.cells.some(c => coordKey(c) === coordKey(bp.gateCell)) ?? false);
}

// ── 6. World margins contain the entire walkable footprint ────────────────────

for (let ch = 1; ch <= 10; ch++) {
  const bp = getChapterMapBlueprint(ch);
  const m  = bp.worldMarginTiles;

  const allWithin = bp.walkableCells.every(c =>
    c.q >= m.minQ && c.q <= m.maxQ &&
    c.r >= m.minR && c.r <= m.maxR,
  );
  check(`[ch${ch}] all walkableCells inside worldMarginTiles`, allWithin);

  // Margins must extend beyond the footprint on every axis
  const minQ = Math.min(...bp.walkableCells.map(c => c.q));
  const maxQ = Math.max(...bp.walkableCells.map(c => c.q));
  const minR = Math.min(...bp.walkableCells.map(c => c.r));
  const maxR = Math.max(...bp.walkableCells.map(c => c.r));

  check(`[ch${ch}] margin extends below minQ`, m.minQ < minQ);
  check(`[ch${ch}] margin extends above maxQ`, m.maxQ > maxQ);
  check(`[ch${ch}] margin extends below minR`, m.minR < minR);
  check(`[ch${ch}] margin extends above maxR`, m.maxR > maxR);
}

// ── 7. Blueprint is stable across repeated calls (cached) ────────────────────

{
  const a = getChapterMapBlueprint(1);
  const b = getChapterMapBlueprint(1);
  check('[stability] same reference returned for ch1', a === b);

  const c5a = getChapterMapBlueprint(5);
  const c5b = getChapterMapBlueprint(5);
  check('[stability] same reference returned for ch5', c5a === c5b);

  const c10a = getChapterMapBlueprint(10);
  const c10b = getChapterMapBlueprint(10);
  check('[stability] same reference returned for ch10', c10a === c10b);
}

// ── 8. Blueprint seed is per-chapter, not per-run ────────────────────────────

{
  for (let ch = 1; ch <= 10; ch++) {
    const bp = getChapterMapBlueprint(ch);
    // Seed must not be empty
    check(`[seed ch${ch}] seed is non-empty`, bp.seed.length > 0);
    // Seed must be stable (same as calling again)
    check(`[seed ch${ch}] seed is stable`, bp.seed === getChapterMapBlueprint(ch).seed);
    // Seed must differ between chapters
    if (ch > 1) {
      check(`[seed ch${ch}] seed differs from ch${ch - 1}`,
        bp.seed !== getChapterMapBlueprint(ch - 1).seed);
    }
  }
}

// ── 9. Geometry invariant: blueprint fields agree with template ───────────────
//
// The blueprint is the PRE-ART layer, so every geometry field must be
// traceable to the validated ChapterMapTemplate.  This test is the
// machine-enforced equivalent of "background art MUST NEVER be step 1."

for (let ch = 1; ch <= 10; ch++) {
  const bp  = getChapterMapBlueprint(ch);
  const tpl = getChapterMapTemplate(ch);

  // tileCount == template tile count (blueprint does not invent new tiles)
  check(`[order ch${ch}] tileCount matches template`, bp.tileCount === tpl.tiles.length);

  // start/gate agree with template
  check(`[order ch${ch}] startCell derived from template`,
    coordKey(bp.startCell) === tpl.startTileId);
  check(`[order ch${ch}] gateCell derived from template`,
    coordKey(bp.gateCell) === tpl.gateTileId);

  // No clearing cell exists outside the template tile set
  const tplKeys = new Set(tpl.tiles.map(t => t.id));
  const anyOutside = bp.clearings.some(cl =>
    cl.cells.some(c => !tplKeys.has(coordKey(c))),
  );
  check(`[order ch${ch}] no clearing cell outside template`, !anyOutside);
}

// ── 10. Procedural chapter (ch12) fallback blueprint is valid ─────────────────

{
  const bp = getChapterMapBlueprint(12);
  check('[ch12 procedural] chapterId === 12',        bp.chapterId === 12);
  check('[ch12 procedural] walkableCells non-empty', bp.walkableCells.length > 0);
  check('[ch12 procedural] clearings non-empty',     bp.clearings.length >= 2);
  check('[ch12 procedural] startCell reachable',
    bp.walkableCells.some(c => coordKey(c) === coordKey(bp.startCell)));
  check('[ch12 procedural] gateCell reachable',
    bp.walkableCells.some(c => coordKey(c) === coordKey(bp.gateCell)));
  // Archetype cycles: ch12 → index (12-1)%3 = 2 → 'simulation_complex'
  check('[ch12 procedural] archetype cycles correctly',
    bp.archetype === 'simulation_complex');
}

// ── 11. "start" clearing is BFS-reachable from start in ≤ 2 hops ─────────────

for (let ch = 1; ch <= 10; ch++) {
  const bp       = getChapterMapBlueprint(ch);
  const walkKeys = new Set(bp.walkableCells.map(coordKey));
  const adj      = buildAdj(walkKeys);

  const fromStart    = bfsDistances(adj, coordKey(bp.startCell));
  const startClearing = bp.clearings.find(c => c.id === 'start');

  if (startClearing) {
    const allWithin2 = startClearing.cells.every(c =>
      (fromStart.get(coordKey(c)) ?? Infinity) <= 2,
    );
    check(`[bfs ch${ch}] all "start" clearing cells within 2 hops of start`,
      allWithin2);
  }

  const fromGate   = bfsDistances(adj, coordKey(bp.gateCell));
  const gateClearing = bp.clearings.find(c => c.id === 'gate');

  if (gateClearing) {
    const allWithin2 = gateClearing.cells.every(c =>
      (fromGate.get(coordKey(c)) ?? Infinity) <= 2,
    );
    check(`[bfs ch${ch}] all "gate" clearing cells within 2 hops of gate`,
      allWithin2);
  }
}

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
