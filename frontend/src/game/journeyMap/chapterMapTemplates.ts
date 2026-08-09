/**
 * journeyMap/chapterMapTemplates.ts — AUTHORED MAP ADJUSTMENT (Push 1)
 *
 * CANONICAL RULE
 * ──────────────
 * Each Chapter owns ONE fixed authored hex-map template.  The following are
 * frozen per chapter and never change across attempts, rechallenges, shifts,
 * or regenerations:
 *   • exact hex coordinates     • overall map shape
 *   • total tile count          • starting tile
 *   • Chapter Boss Gate tile
 *
 * A new Chapter attempt randomizes ONLY the encounter layer — that continues
 * to come from the per-run secure seed via the existing canonical encounter
 * generator.  Geometry does NOT read the run seed.
 *
 * TWO PUBLIC EXPORTS
 * ──────────────────
 * getChapterMapTemplate(chapter)  → ChapterMapTemplate (new typed API)
 * getChapterHexTopology(chapter)  → HexTopology (used by run lifecycle / createRun)
 *
 * Both are fully validated on first access and cached.
 *
 * AUTHORED DATA vs PROCEDURAL FALLBACK
 * ─────────────────────────────────────
 * Chapters 1–10 (Book I) are CHECKED-IN LITERAL COORDINATE DATA — snapshotted
 * once so future generator / PRNG changes can never redraw a shipped map.
 * Chapters 11+ fall back to deterministic procedural generation from a fixed
 * per-chapter design seed (not a per-run seed) until they are authored and
 * added to AUTHORED_CHAPTER_MAPS.
 *
 * ⚠ NEVER edit an AUTHORED_CHAPTER_MAPS entry once shipped.
 */

import { generateHexTopology, bfsDistances } from './topology';
import { getChapterTileCount }               from './config';
import type { AxialCoord, HexTopology }      from './topology';
import type {
  ChapterMapTemplate,
  ChapterMapTemplateTile,
  ChapterTileRole,
  ChapterTileTag,
} from './chapterMapTemplate.types';

// ── Canonical environment ids (Book I) ────────────────────────────────────────

const CHAPTER_ENVIRONMENT_IDS: Readonly<Record<number, string>> = {
  1:  'atrium-approach',
  2:  'triage-corridor',
  3:  'observation-wing',
  4:  'medicine-ward',
  5:  'isolation-block',
  6:  'surgical-floor',
  7:  'emergency-bay',
  8:  'intensive-unit',
  9:  'real-ward-east',
  10: 'finale-summit',
};

function environmentIdFor(chapter: number): string {
  return CHAPTER_ENVIRONMENT_IDS[chapter] ?? `chapter-${chapter}`;
}

// ── Authored geometry data (Book I, chapters 1–10) ───────────────────────────
// ⚠ NEVER edit a shipped entry — it redraws that chapter's canonical map.

interface AuthoredRawMap {
  readonly start: string;                                   // "q,r"
  readonly gate:  string;                                   // "q,r"
  readonly tiles: ReadonlyArray<readonly [number, number]>; // [q, r] pairs
}

const AUTHORED_CHAPTER_MAPS: Readonly<Record<number, AuthoredRawMap>> = {
  /**
   * Chapter 1 — "Atrium Approach"
   *
   * 30-tile compact rounded-square footprint.
   * Layout (axial, portrait orientation):
   *
   *         cap  (-1,-3) (0,-3) (1,-3)
   *         row  (-2,-2) (-1,-2) (0,-2) (1,-2) (2,-2)
   *         row  (-2,-1) (-1,-1) (0,-1) (1,-1) (2,-1)
   *         row  (-2, 0) (-1, 0) (0, 0) (1, 0) (2, 0)
   *         row  (-2, 1) (-1, 1) (0, 1) (1, 1) (2, 1)
   *         row  (-2, 2) (-1, 2) (0, 2) (1, 2)          ← (2,2) omitted: slight asymmetry
   *         cap  (-1, 3) (0, 3) (1, 3)
   *
   * Start  (0, 1):  geometric centre-lower; all 6 hex neighbours present.
   * Gate  (-1,-3):  upper-left cap; BFS distance 5 from start.
   *
   * ⚠ DO NOT EDIT these coordinates once shipped.
   */
  1: {
    start: '0,1',
    gate:  '-1,-3',
    tiles: [
      [-1,-3],[0,-3],[1,-3],
      [-2,-2],[-1,-2],[0,-2],[1,-2],[2,-2],
      [-2,-1],[-1,-1],[0,-1],[1,-1],[2,-1],
      [-2, 0],[-1, 0],[0, 0],[1, 0],[2, 0],
      [-2, 1],[-1, 1],[0, 1],[1, 1],[2, 1],
      [-2, 2],[-1, 2],[0, 2],[1, 2],
      [-1, 3],[0, 3],[1, 3],
    ],
  },
  2: {
    start: '-1,4',
    gate: '2,-3',
    tiles: [[0,0],[-1,1],[-1,2],[-2,2],[0,1],[-3,2],[1,0],[-2,1],[-2,3],[0,2],[-1,0],[-2,4],[-3,3],[2,-1],[-3,5],[-1,4],[1,-1],[-1,-1],[-2,5],[0,-1],[2,-2],[-2,6],[-1,3],[2,-3],[1,-2],[-2,0],[2,0],[-3,4],[1,1],[1,2]],
  },
  3: {
    start: '0,6',
    gate: '1,-3',
    tiles: [[0,0],[0,-1],[1,-2],[1,-1],[0,1],[0,2],[-1,2],[-1,0],[-1,3],[1,1],[0,3],[2,-2],[-2,3],[-1,1],[0,4],[-2,0],[1,2],[1,4],[1,5],[0,-2],[-3,3],[0,5],[2,4],[2,1],[1,6],[0,6],[2,-3],[1,-3],[-1,6],[-2,7]],
  },
  4: {
    start: '0,5',
    gate: '1,-3',
    tiles: [[0,0],[0,1],[0,2],[-1,1],[-1,2],[-1,3],[-1,4],[-2,4],[1,0],[0,3],[1,1],[1,-1],[2,-1],[0,4],[1,4],[1,2],[0,-1],[-2,3],[-1,0],[2,2],[0,-2],[0,5],[2,1],[-1,5],[-3,5],[1,-2],[1,-3],[2,0],[-1,6],[-1,-1]],
  },
  5: {
    start: '0,5',
    gate: '0,-1',
    tiles: [[0,0],[0,1],[1,1],[1,2],[1,-1],[-1,2],[1,3],[-1,1],[-2,2],[2,3],[0,3],[-3,3],[2,2],[0,4],[1,4],[-1,5],[-2,1],[0,5],[0,-1],[1,5],[2,4],[-1,0],[2,0],[-2,5],[-1,4],[2,5],[-2,4],[0,2],[-2,3],[-2,6]],
  },
  6: {
    start: '0,6',
    gate: '-1,-1',
    tiles: [[0,0],[0,1],[-1,1],[0,2],[-1,2],[1,-1],[1,2],[-1,3],[-2,3],[1,3],[-2,4],[-1,4],[0,3],[1,0],[0,4],[-3,3],[1,4],[-1,5],[1,1],[2,-1],[-3,4],[2,0],[-3,5],[-2,1],[0,5],[-3,2],[2,3],[-2,2],[-3,1],[2,4],[0,6],[3,3],[-1,0],[2,5],[-1,-1]],
  },
  7: {
    start: '0,1',
    gate: '-3,-3',
    tiles: [[0,0],[-1,0],[0,-1],[-1,1],[-1,-1],[-1,2],[0,-2],[0,-3],[1,-2],[0,1],[1,-3],[1,-4],[-1,-2],[1,1],[1,-1],[-2,-1],[-2,-2],[-3,-1],[-2,0],[-2,2],[1,0],[-1,-3],[-2,-3],[-3,1],[2,-1],[3,-1],[1,-5],[-2,1],[2,-3],[-3,0],[-3,2],[-3,3],[2,-2],[-3,4],[-3,-3]],
  },
  8: {
    start: '0,5',
    gate: '-1,-4',
    tiles: [[0,0],[0,1],[0,-1],[-1,2],[1,1],[-1,3],[2,0],[1,2],[-2,3],[0,3],[1,3],[-1,4],[-1,1],[2,3],[2,4],[-2,5],[0,-2],[3,-1],[-3,5],[2,2],[1,-3],[0,2],[2,1],[3,2],[0,-3],[-2,2],[-1,-3],[-1,5],[0,5],[2,-4],[-1,-4],[-3,2],[0,4],[1,4],[3,4]],
  },
  9: {
    start: '0,5',
    gate: '0,-3',
    tiles: [[0,0],[0,-1],[-1,0],[-1,-1],[1,-1],[-2,0],[0,1],[-3,1],[0,2],[1,0],[-1,1],[-2,2],[0,-2],[1,1],[2,-1],[-1,2],[3,-2],[-1,3],[-2,3],[2,-2],[0,3],[1,2],[0,4],[-2,1],[1,3],[0,-3],[0,5],[-3,3],[-3,2],[1,4],[-3,4],[-1,5],[2,3],[2,4],[-1,-2]],
  },
  10: {
    start: '0,5',
    gate: '0,-3',
    tiles: [[0,0],[1,-1],[2,-1],[2,0],[1,0],[3,-1],[1,1],[0,-1],[1,2],[1,-2],[0,1],[0,3],[-1,0],[1,3],[-1,3],[2,-2],[0,4],[1,-3],[-2,4],[-1,5],[-1,4],[2,-3],[0,5],[-1,-1],[1,4],[0,2],[-3,5],[-2,5],[0,-3],[1,-4],[1,5],[2,2],[-2,-1],[3,-2],[-1,2]],
  },
};

// ── Deterministic fallback seed for unauth'd chapters ────────────────────────

function templateSeedFor(chapter: number): string {
  return `clinica-authored-ch${chapter}`;
}

// ── Axial hex helpers ─────────────────────────────────────────────────────────

function axialKey(q: number, r: number): string { return `${q},${r}`; }

const AXIAL_DIRS: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
];

function buildAdjacency(tileSet: Set<string>): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const k of tileSet) {
    const comma = k.indexOf(',');
    const q = Number(k.slice(0, comma));
    const r = Number(k.slice(comma + 1));
    adj.set(k, AXIAL_DIRS.map(([dq, dr]) => axialKey(q + dq, r + dr)).filter(nk => tileSet.has(nk)));
  }
  return adj;
}

// ── Tag computation from graph structure ──────────────────────────────────────

function computeTags(
  key:       string,
  neighbors: string[],
  tileSet:   Set<string>,
  centroidQ: number,
  centroidR: number,
): ChapterTileTag[] {
  const comma = key.indexOf(',');
  const q = Number(key.slice(0, comma));
  const r = Number(key.slice(comma + 1));

  const tags: ChapterTileTag[] = [];
  const n = neighbors.length;

  // Structural tags.
  if (n === 1) tags.push('alcove');
  if (n >= 4)  tags.push('intersection');

  // Edge: at least one of the six neighbor positions is absent from the map.
  const hexNeighborCount = AXIAL_DIRS.filter(([dq, dr]) => tileSet.has(axialKey(q + dq, r + dr))).length;
  if (hexNeighborCount < 6) tags.push('edge');

  // Central: within 1.5 units of the geometric centroid (in axial distance).
  const dq = Math.abs(q - centroidQ);
  const dr = Math.abs(r - centroidR);
  if (dq <= 1.5 && dr <= 1.5) tags.push('central');

  // Placement preference hints.
  if (n === 1) tags.push('treasurePreferred', 'merchantPreferred'); // alcoves suit quiet events
  if (n >= 4)  tags.push('bossPreferred');                          // hubs suit boss encounters
  if (n <= 2 && hexNeighborCount < 6) tags.push('quiet');

  return tags;
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateTemplate(
  chapter:     number,
  tiles:       ChapterMapTemplateTile[],
  startTileId: string,
  gateTileId:  string,
): void {
  const expectedCount = getChapterTileCount(chapter);

  // 1. Tile count.
  if (tiles.length !== expectedCount) {
    throw new Error(
      `chapterMapTemplates ch${chapter}: expected ${expectedCount} tiles, got ${tiles.length}`,
    );
  }

  // 2. Unique ids.
  const idSet = new Set(tiles.map(t => t.id));
  if (idSet.size !== tiles.length) {
    throw new Error(`chapterMapTemplates ch${chapter}: duplicate tile ids`);
  }

  // 3. Unique coordinates.
  const coordSet = new Set(tiles.map(t => axialKey(t.q, t.r)));
  if (coordSet.size !== tiles.length) {
    throw new Error(`chapterMapTemplates ch${chapter}: duplicate tile coordinates`);
  }

  // 4. Exactly one start, exactly one gate.
  const starts = tiles.filter(t => t.role === 'start');
  const gates  = tiles.filter(t => t.role === 'gate');
  if (starts.length !== 1) throw new Error(`chapterMapTemplates ch${chapter}: expected 1 start tile, got ${starts.length}`);
  if (gates.length  !== 1) throw new Error(`chapterMapTemplates ch${chapter}: expected 1 gate tile, got ${gates.length}`);

  // 5. startTileId / gateTileId reference existing tiles.
  if (!idSet.has(startTileId)) throw new Error(`chapterMapTemplates ch${chapter}: startTileId '${startTileId}' not found`);
  if (!idSet.has(gateTileId))  throw new Error(`chapterMapTemplates ch${chapter}: gateTileId '${gateTileId}' not found`);
  if (starts[0].id !== startTileId) throw new Error(`chapterMapTemplates ch${chapter}: startTileId mismatch`);
  if (gates[0].id  !== gateTileId)  throw new Error(`chapterMapTemplates ch${chapter}: gateTileId mismatch`);

  // 6. Every tile touches at least one other tile, and all form one connected component.
  const adjacency     = buildAdjacency(coordSet);
  const graphDistances = bfsDistances(adjacency, startTileId);

  for (const [k, neighbors] of adjacency) {
    if (neighbors.length === 0) {
      throw new Error(`chapterMapTemplates ch${chapter}: tile '${k}' has no neighbors (orphan)`);
    }
  }

  if (graphDistances.size !== tiles.length) {
    throw new Error(`chapterMapTemplates ch${chapter}: map is not a single connected footprint`);
  }

  // 7. Gate is reachable from start.
  if (!graphDistances.has(gateTileId)) {
    throw new Error(`chapterMapTemplates ch${chapter}: gate '${gateTileId}' unreachable from start '${startTileId}'`);
  }
}

// ── Build ChapterMapTemplate from authored raw data ───────────────────────────

function buildFromAuthoredData(chapter: number, data: AuthoredRawMap): ChapterMapTemplate {
  const rawPairs = data.tiles;
  const tileSet  = new Set(rawPairs.map(([q, r]) => axialKey(q, r)));

  // Compute centroid for tag calculation.
  const sumQ = rawPairs.reduce((s, [q]) => s + q, 0) / rawPairs.length;
  const sumR = rawPairs.reduce((s, [, r]) => s + r, 0) / rawPairs.length;

  const adjacency = buildAdjacency(tileSet);

  const tiles: ChapterMapTemplateTile[] = rawPairs.map(([q, r]) => {
    const id        = axialKey(q, r);
    const role: ChapterTileRole =
      id === data.start ? 'start' :
      id === data.gate  ? 'gate'  : 'normal';
    const neighbors = adjacency.get(id) ?? [];
    const tags      = computeTags(id, neighbors, tileSet, sumQ, sumR);
    return { id, q, r, role, tags };
  });

  const template: ChapterMapTemplate = {
    chapterId:   String(chapter),
    shape:       'irregular',
    tiles,
    startTileId: data.start,
    gateTileId:  data.gate,
    environmentId: environmentIdFor(chapter),
  };

  validateTemplate(chapter, tiles, data.start, data.gate);
  return template;
}

// ── Build ChapterMapTemplate from procedural generator (fallback) ─────────────

function buildFromProcedural(chapter: number): ChapterMapTemplate {
  const topology = generateHexTopology({ chapter, seed: templateSeedFor(chapter) });
  const tileSet  = new Set(topology.tiles.map(t => axialKey(t.q, t.r)));

  const sumQ = topology.tiles.reduce((s, t) => s + t.q, 0) / topology.tiles.length;
  const sumR = topology.tiles.reduce((s, t) => s + t.r, 0) / topology.tiles.length;

  const adjacency = buildAdjacency(tileSet);

  const tiles: ChapterMapTemplateTile[] = topology.tiles.map(coord => {
    const id   = axialKey(coord.q, coord.r);
    const role: ChapterTileRole =
      id === topology.startTileId  ? 'start' :
      id === topology.gateAnchorId ? 'gate'  : 'normal';
    const neighbors = adjacency.get(id) ?? [];
    const tags      = computeTags(id, neighbors, tileSet, sumQ, sumR);
    return { id, q: coord.q, r: coord.r, role, tags };
  });

  const template: ChapterMapTemplate = {
    chapterId:   String(chapter),
    shape:       'irregular',
    tiles,
    startTileId: topology.startTileId,
    gateTileId:  topology.gateAnchorId,
    environmentId: environmentIdFor(chapter),
  };

  validateTemplate(chapter, tiles, topology.startTileId, topology.gateAnchorId);
  return template;
}

// ── Internal HexTopology builder (used by run lifecycle / createRun) ──────────

function buildHexTopologyFromTemplate(
  chapter:  number,
  template: ChapterMapTemplate,
): HexTopology {
  const coords: AxialCoord[] = template.tiles.map(t => ({ q: t.q, r: t.r }));
  const tileSet = new Set(template.tiles.map(t => t.id));
  const adjacency = buildAdjacency(tileSet);
  const graphDistances = bfsDistances(adjacency, template.startTileId);
  return {
    chapter,
    seed:           `authored-ch${chapter}`,
    tiles:          coords,
    startTileId:    template.startTileId,
    gateAnchorId:   template.gateTileId,
    graphDistances,
  };
}

// ── Caches ────────────────────────────────────────────────────────────────────

const templateCache  = new Map<number, ChapterMapTemplate>();
const topologyCache  = new Map<number, HexTopology>();

function masterTemplate(chapter: number): ChapterMapTemplate {
  const cached = templateCache.get(chapter);
  if (cached) return cached;

  const authored = AUTHORED_CHAPTER_MAPS[chapter];
  const template = authored
    ? buildFromAuthoredData(chapter, authored)
    : buildFromProcedural(chapter);

  templateCache.set(chapter, template);
  return template;
}

// ── Production-authored chapter gate ─────────────────────────────────────────

/**
 * Chapters whose authored geometry has been deployed to production.
 *
 * MIGRATION GATE — add a chapter here only after its template has been:
 *   1. designed and reviewed (tile coordinates, start, gate)
 *   2. snapshot-tested
 *   3. accepted for production use
 *
 * Chapters NOT in this set fall back to the procedural topology generator
 * (generateHexTopology with the per-run seed) so their geometry still varies
 * between attempts while they await authoring.
 *
 * ⚠ Do NOT add a chapter number here until its AUTHORED_CHAPTER_MAPS entry
 *   has been reviewed and locked — adding it prematurely fixes all existing
 *   in-progress runs for that chapter to the authored geometry.
 */
const PRODUCTION_AUTHORED_CHAPTERS = new Set<number>([
  1, // "Atrium Approach" — authored and snapshot-tested in Push 2
]);

/**
 * Returns true when a chapter's geometry should come from the fixed authored
 * template rather than the procedural topology generator.
 *
 * Use this at every run-creation entry point to route geometry selection.
 * When false, callers must continue using generateHexTopology({ chapter, seed })
 * with the per-run seed so encounter variation is preserved.
 */
export function isAuthoredChapter(chapter: number): boolean {
  return PRODUCTION_AUTHORED_CHAPTERS.has(chapter);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return the fixed authored ChapterMapTemplate for a chapter.
 *
 * Validated on first access; returns the same (immutable) master object on
 * every subsequent call.  Do NOT mutate the returned value.
 *
 * The run seed is NOT an input — geometry is fixed per chapter.
 */
export function getChapterMapTemplate(chapter: number): ChapterMapTemplate {
  return masterTemplate(chapter);
}

/**
 * Return a HexTopology for the chapter's fixed authored geometry.
 *
 * Used internally by journeyRunLifecycle and createRun so they do not need
 * to depend on ChapterMapTemplate directly.  Returns a defensive copy so
 * callers can mutate it freely without poisoning the cache.
 *
 * The procedural topology generator remains available as a fallback for
 * unauth'd chapters (11+) via buildFromProcedural.
 */
export function getChapterHexTopology(chapter: number): HexTopology {
  const cached = topologyCache.get(chapter);
  if (cached) {
    // Return defensive copy.
    return {
      chapter:        cached.chapter,
      seed:           cached.seed,
      tiles:          cached.tiles.map(t => ({ q: t.q, r: t.r })),
      startTileId:    cached.startTileId,
      gateAnchorId:   cached.gateAnchorId,
      graphDistances: new Map(cached.graphDistances),
    };
  }

  const topology = buildHexTopologyFromTemplate(chapter, masterTemplate(chapter));
  topologyCache.set(chapter, topology);

  return {
    chapter:        topology.chapter,
    seed:           topology.seed,
    tiles:          topology.tiles.map(t => ({ q: t.q, r: t.r })),
    startTileId:    topology.startTileId,
    gateAnchorId:   topology.gateAnchorId,
    graphDistances: new Map(topology.graphDistances),
  };
}
