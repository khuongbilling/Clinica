/**
 * journeyMap/chapterMapTemplates.ts — AUTHORED MAP ADJUSTMENT (Push 1)
 *
 * CANONICAL RULE
 * ──────────────
 * Each Chapter owns ONE fixed authored hex-map template.  The following are
 * frozen per chapter and never change across attempts, rechallenges, shifts,
 * or regenerations:
 *   • exact hex coordinates
 *   • overall map shape
 *   • total tile count
 *   • starting tile
 *   • Chapter Boss Gate tile
 *
 * A new Chapter attempt randomizes ONLY the encounter layer (battles, area
 * bosses, treasure, merchant, ward events, tiers, temporary rewards, fog) —
 * that continues to come from the per-run secure seed via the existing
 * canonical encounter generator.  Geometry does NOT read the run seed.
 *
 * AUTHORED DATA, NOT RUNTIME GENERATION
 * ─────────────────────────────────────
 * Chapters 1–10 (Book I) are CHECKED-IN LITERAL COORDINATE DATA below.  They
 * were produced once by the validated topology generator and then snapshotted,
 * so future changes to the generator, PRNG, or tile-count config can never
 * silently redraw a shipped chapter's canonical map.
 *
 * ⚠ NEVER edit an AUTHORED_CHAPTER_MAPS entry once shipped — that would
 *   redraw that chapter's canonical geometry for every player.
 *
 * Chapters 11+ (not yet authored) fall back to deterministic generation from
 * a fixed per-chapter design seed.  When a Book II chapter ships, snapshot it
 * into AUTHORED_CHAPTER_MAPS the same way.
 *
 * Every template is validated at first access (connected single footprint —
 * no floating islands, start/gate present) and callers receive a defensive
 * copy, so no consumer can mutate canonical state.
 */

import { generateHexTopology, bfsDistances } from './topology';
import type { AxialCoord, HexTopology } from './topology';

// ── Authored geometry data (Book I, chapters 1–10) ───────────────────────────

interface AuthoredChapterMap {
  readonly start: string;                       // "q,r" start tile key
  readonly gate:  string;                       // "q,r" Chapter Boss Gate key
  readonly tiles: ReadonlyArray<readonly [number, number]>; // [q, r] pairs
}

const AUTHORED_CHAPTER_MAPS: Readonly<Record<number, AuthoredChapterMap>> = {
  1: {
    start: '0,2',
    gate: '2,-5',
    tiles: [[0,0],[-1,0],[0,1],[-2,1],[0,-1],[1,0],[-1,-1],[-3,2],[-1,1],[0,2],[-1,-2],[0,-2],[2,-1],[2,0],[-2,2],[-1,2],[1,-2],[1,-3],[1,1],[2,-3],[1,-1],[1,2],[2,1],[0,-3],[1,-4],[0,-4],[-2,0],[1,3],[2,-5],[-3,0]],
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

// ── Fallback design seeds for chapters not yet authored (11+) ────────────────

/** Deterministic per-chapter design seed — fixed per chapter, never per run. */
function templateSeedFor(chapter: number): string {
  return `clinica-authored-ch${chapter}`;
}

// ── Internal: build + validate a canonical topology (cached master copy) ─────

function axialKey(q: number, r: number): string {
  return `${q},${r}`;
}

const AXIAL_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
];

function buildFromAuthoredData(chapter: number, data: AuthoredChapterMap): HexTopology {
  const tiles: AxialCoord[] = data.tiles.map(([q, r]) => ({ q, r }));
  const tileSet = new Set(tiles.map(t => axialKey(t.q, t.r)));

  if (tileSet.size !== tiles.length) {
    throw new Error(`chapterMapTemplates: duplicate coordinates in authored map ch${chapter}`);
  }
  if (!tileSet.has(data.start) || !tileSet.has(data.gate)) {
    throw new Error(`chapterMapTemplates: start/gate missing from authored map ch${chapter}`);
  }

  const adjacency = new Map<string, string[]>();
  for (const t of tiles) {
    adjacency.set(
      axialKey(t.q, t.r),
      AXIAL_DIRS.map(([dq, dr]) => axialKey(t.q + dq, t.r + dr)).filter(k => tileSet.has(k)),
    );
  }
  const graphDistances = bfsDistances(adjacency, data.start);
  if (graphDistances.size !== tiles.length) {
    throw new Error(`chapterMapTemplates: authored map ch${chapter} is not a single connected footprint`);
  }

  return {
    chapter,
    seed: `authored-ch${chapter}`,
    tiles,
    startTileId: data.start,
    gateAnchorId: data.gate,
    graphDistances,
  };
}

const templateCache = new Map<number, HexTopology>();

function masterTemplate(chapter: number): HexTopology {
  const cached = templateCache.get(chapter);
  if (cached) return cached;

  const authored = AUTHORED_CHAPTER_MAPS[chapter];
  const topology = authored
    ? buildFromAuthoredData(chapter, authored)
    : generateHexTopology({ chapter, seed: templateSeedFor(chapter) });

  templateCache.set(chapter, topology);
  return topology;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return the fixed authored hex-map template for a chapter.
 *
 * Pure and deterministic: the run seed is deliberately NOT an input.
 * Returns a DEFENSIVE COPY on every call — mutating the result cannot
 * contaminate the canonical template for later runs.
 */
export function getChapterMapTemplate(chapter: number): HexTopology {
  const master = masterTemplate(chapter);
  return {
    chapter:        master.chapter,
    seed:           master.seed,
    tiles:          master.tiles.map(t => ({ q: t.q, r: t.r })),
    startTileId:    master.startTileId,
    gateAnchorId:   master.gateAnchorId,
    graphDistances: new Map(master.graphDistances),
  };
}
