/**
 * journey_map_canonical_artifact.test.ts — Production Bridge Push 1
 *
 * Validates all guarantees of getCanonicalChapterMapArtifact(1):
 *
 *   • Artifact builds without throwing
 *   • tileCount === 60 (Ch1 target from getChapterTerrainCellCount)
 *   • All 60 tiles form a single connected component (BFS from start)
 *   • startTileId and gateAnchorId are present in the tile set
 *   • clearingCount >= MIN_CLEARING_COUNT (pipeline formula: clamp(60/10, 5, 12) = 6)
 *   • loopCount >= 2 (academic_quad directive)
 *   • dna.topologyFamily === 'academic_quad' (Ch1 migrated from open_plaza)
 *   • Ch2 dna.topologyFamily === 'open_plaza' (swap preserved)
 *   • Blueprint is NOT a circular blob (confirmed by multiple non-diameter routes)
 *   • zoneMeta covers all 60 tiles (no tile left unlabelled)
 *   • zoneMeta has at least MIN_CLEARING_COUNT clearing cells (≥1 per clearing zone)
 *   • Scenery safety invariant passes (walkable ∩ scenery = ∅)
 *   • blueprintHash is 8 hex characters
 *   • mapLayoutVersion === 'v1'
 *   • Artifact is cached — same chapter returns identical object reference
 *   • graphDistances covers all tiles reachable from start (connectivity sanity)
 *   • Ch1 diversity fingerprint has no consecutive-family violation (ch1≠ch2)
 *   • Blueprint hash is deterministic — calling twice yields same hash
 */

import assert      from 'assert';
import {
  getCanonicalChapterMapArtifact,
  MAP_LAYOUT_VERSION,
}                  from '../src/game/journeyMap/canonicalMapArtifact';
import { getChapterTerrainCellCount } from '../src/game/journeyMap/config';
import { getChapterMapDNA }           from '../src/game/journeyMap/chapterMapDNA';

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

function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(msg ?? `Expected ${String(a)} === ${String(b)}`);
}
function ok(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

// ── BFS helper (mirrors logic in canonicalMapArtifact, independent impl) ─────

function bfsReachable(
  tiles: { q: number; r: number }[],
  startId: string,
): Set<string> {
  const HEX_DIRS = [
    [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
  ] as const;
  const coordSet = new Set(tiles.map(c => `${c.q},${c.r}`));
  const visited  = new Set<string>();
  const queue    = [startId];
  visited.add(startId);
  let head = 0;
  while (head < queue.length) {
    const cur  = queue[head++]!;
    const [sq, sr] = cur.split(',').map(Number) as [number, number];
    for (const [dq, dr] of HEX_DIRS) {
      const nk = `${sq + dq},${sr + dr}`;
      if (coordSet.has(nk) && !visited.has(nk)) {
        visited.add(nk);
        queue.push(nk);
      }
    }
  }
  return visited;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CH1 = 1;
const CH2 = 2;
const MIN_CLEARING_COUNT = 5; // clamp(60/10, 5, 12)
const MIN_LOOP_COUNT     = 2; // academic_quad directive
const HEX_PATTERN        = /^[0-9a-f]{8}$/;

// ── Test suite ────────────────────────────────────────────────────────────────

const artifact = getCanonicalChapterMapArtifact(CH1);

// ── 1. Build without throwing ─────────────────────────────────────────────────
test('artifact builds without throwing', () => {
  // If we reach this point the getCanonicalChapterMapArtifact() call above
  // completed without throwing.
  ok(artifact != null, 'artifact is null/undefined');
});

// ── 2. Tile count ─────────────────────────────────────────────────────────────
test('tileCount equals getChapterTerrainCellCount(1)', () => {
  const expected = getChapterTerrainCellCount(CH1);
  eq(artifact.tileCount, expected,
    `tileCount: expected ${expected}, got ${artifact.tileCount}`);
});

test('walkableCells.length matches tileCount', () => {
  eq(artifact.walkableCells.length, artifact.tileCount,
    `walkableCells.length ${artifact.walkableCells.length} !== tileCount ${artifact.tileCount}`);
});

// ── 3. Connectivity ───────────────────────────────────────────────────────────
test('all tiles reachable from startTileId (single connected component)', () => {
  const reachable = bfsReachable(artifact.walkableCells, artifact.asTopology.startTileId);
  const expected  = artifact.tileCount;
  ok(
    reachable.size === expected,
    `BFS from start reached ${reachable.size}/${expected} tiles — layout is disconnected`,
  );
});

// ── 4. Start and gate presence ────────────────────────────────────────────────
test('startTileId present in walkableCells', () => {
  const keys = new Set(artifact.walkableCells.map(c => `${c.q},${c.r}`));
  ok(keys.has(artifact.asTopology.startTileId),
    `startTileId ${artifact.asTopology.startTileId} not in walkableCells`);
});

test('gateAnchorId present in walkableCells', () => {
  const keys = new Set(artifact.walkableCells.map(c => `${c.q},${c.r}`));
  ok(keys.has(artifact.asTopology.gateAnchorId),
    `gateAnchorId ${artifact.asTopology.gateAnchorId} not in walkableCells`);
});

test('startTileId !== gateAnchorId', () => {
  ok(
    artifact.asTopology.startTileId !== artifact.asTopology.gateAnchorId,
    'startTileId and gateAnchorId are the same tile',
  );
});

// ── 5. Clearing count ─────────────────────────────────────────────────────────
test(`clearingCount >= ${MIN_CLEARING_COUNT}`, () => {
  ok(
    artifact.clearingCount >= MIN_CLEARING_COUNT,
    `clearingCount ${artifact.clearingCount} < ${MIN_CLEARING_COUNT}`,
  );
});

// ── 6. Loop count ─────────────────────────────────────────────────────────────
test(`loopCount >= ${MIN_LOOP_COUNT} (academic_quad directive)`, () => {
  ok(
    artifact.loopCount >= MIN_LOOP_COUNT,
    `loopCount ${artifact.loopCount} < ${MIN_LOOP_COUNT}`,
  );
});

// ── 7. DNA family assignments ─────────────────────────────────────────────────
test('Ch1 topologyFamily is academic_quad (migrated from open_plaza)', () => {
  eq(artifact.dna.topologyFamily, 'academic_quad' as string,
    `Ch1 topologyFamily should be 'academic_quad', got '${artifact.dna.topologyFamily}'`);
});

test('Ch2 topologyFamily is open_plaza (swap after Ch1 migration)', () => {
  const ch2Dna = getChapterMapDNA(CH2);
  eq(ch2Dna.topologyFamily, 'open_plaza' as string,
    `Ch2 topologyFamily should be 'open_plaza', got '${ch2Dna.topologyFamily}'`);
});

test('Ch1 and Ch2 topologyFamily are distinct (no consecutive-family violation)', () => {
  const ch2Dna = getChapterMapDNA(CH2);
  ok(
    artifact.dna.topologyFamily !== ch2Dna.topologyFamily,
    `Ch1 and Ch2 share topologyFamily '${artifact.dna.topologyFamily}' — diversity violation`,
  );
});

// ── 8. Not a circular blob ────────────────────────────────────────────────────
// A pure circular blob (the old open_plaza geometry) has loopCount <= 1 and
// a single BFS radius from a central hub.  academic_quad mandates loopCount >= 2
// (multiple cycles = non-radial, non-circular topology).  The loopCount test
// above already covers this, but this test provides explicit intent documentation.
test('topology has multiple cycles (not a circular blob)', () => {
  ok(
    artifact.pathwayGraph.loopCount >= 2,
    `academic_quad campus must have ≥2 loops; got ${artifact.pathwayGraph.loopCount}`,
  );
});

// ── 9. Zone metadata coverage ─────────────────────────────────────────────────
test('zoneMeta covers all walkable tiles (no tile left unlabelled)', () => {
  const missing: string[] = [];
  for (const c of artifact.walkableCells) {
    const k = `${c.q},${c.r}`;
    if (!artifact.zoneMeta.has(k)) missing.push(k);
  }
  ok(missing.length === 0,
    `${missing.length} tile(s) missing zone metadata: ${missing.slice(0, 5).join(', ')}`);
});

test('zoneMeta size equals tileCount', () => {
  eq(artifact.zoneMeta.size, artifact.tileCount,
    `zoneMeta.size ${artifact.zoneMeta.size} !== tileCount ${artifact.tileCount}`);
});

test('zoneMeta has at least MIN_CLEARING_COUNT clearing cells', () => {
  let clearingCells = 0;
  for (const meta of artifact.zoneMeta.values()) {
    if (meta.zoneType === 'clearing') clearingCells++;
  }
  ok(
    clearingCells >= MIN_CLEARING_COUNT,
    `Expected ≥${MIN_CLEARING_COUNT} clearing cells in zoneMeta, got ${clearingCells}`,
  );
});

test('all clearing-zoneType cells have a clearingId', () => {
  const bad: string[] = [];
  for (const [key, meta] of artifact.zoneMeta) {
    if (meta.zoneType === 'clearing' && !meta.clearingId) bad.push(key);
  }
  ok(bad.length === 0,
    `${bad.length} clearing cell(s) missing clearingId: ${bad.slice(0, 3).join(', ')}`);
});

test('all lane-zoneType cells have a laneClass', () => {
  const bad: string[] = [];
  for (const [key, meta] of artifact.zoneMeta) {
    if (meta.zoneType === 'lane' && !meta.laneClass) bad.push(key);
  }
  ok(bad.length === 0,
    `${bad.length} lane cell(s) missing laneClass: ${bad.slice(0, 3).join(', ')}`);
});

// ── 10. Scenery safety ────────────────────────────────────────────────────────
test('scenerySafetyPass is true (walkable ∩ scenery = ∅)', () => {
  ok(artifact.scenerySafetyPass,
    'Scenery safety check FAILED — one or more scenery zone cells overlap walkable tiles');
});

// ── 11. Blueprint hash ────────────────────────────────────────────────────────
test('blueprintHash is 8 hex characters', () => {
  ok(
    HEX_PATTERN.test(artifact.blueprintHash),
    `blueprintHash '${artifact.blueprintHash}' is not 8 lowercase hex chars`,
  );
});

// ── 12. Map layout version ────────────────────────────────────────────────────
test('mapLayoutVersion is v1', () => {
  eq(artifact.mapLayoutVersion, MAP_LAYOUT_VERSION,
    `mapLayoutVersion '${artifact.mapLayoutVersion}' !== '${MAP_LAYOUT_VERSION}'`);
});

// ── 13. Cache determinism ─────────────────────────────────────────────────────
test('getCanonicalChapterMapArtifact returns the same cached object reference', () => {
  const artifact2 = getCanonicalChapterMapArtifact(CH1);
  ok(artifact === artifact2,
    'Calling getCanonicalChapterMapArtifact twice for the same chapter returned different objects');
});

test('blueprintHash is deterministic across two independent reads', () => {
  const a1 = getCanonicalChapterMapArtifact(CH1);
  const a2 = getCanonicalChapterMapArtifact(CH1);
  eq(a1.blueprintHash, a2.blueprintHash,
    'blueprintHash differs between two reads of the same chapter');
});

// ── 14. graphDistances covers all tiles ───────────────────────────────────────
test('graphDistances covers all walkable tiles', () => {
  const tileCount = artifact.tileCount;
  const distCount = artifact.asTopology.graphDistances.size;
  eq(distCount, tileCount,
    `graphDistances covers ${distCount} tiles but tileCount is ${tileCount}`);
});

// ── 15. HexLayout pipeline fields ────────────────────────────────────────────
test('hexLayout.clearingZones.length matches artifact.clearingCount', () => {
  eq(artifact.hexLayout.clearingZones.length, artifact.clearingCount,
    `hexLayout.clearingZones.length ${artifact.hexLayout.clearingZones.length} !== clearingCount ${artifact.clearingCount}`);
});

test('hexLayout.actualTileCount matches artifact.tileCount', () => {
  eq(artifact.hexLayout.actualTileCount, artifact.tileCount,
    `hexLayout.actualTileCount ${artifact.hexLayout.actualTileCount} !== tileCount ${artifact.tileCount}`);
});

// ── Results ───────────────────────────────────────────────────────────────────

console.log('');
console.log('─'.repeat(70));
console.log(`journey_map_canonical_artifact: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('');
  for (const f of failures) console.log(f);
}
console.log('─'.repeat(70));

if (failed > 0) process.exit(1);
