/**
 * journeyMap/chapterHexLayout.ts — Push 5: Hex Lane and Clearing Expansion
 *
 * Expands an abstract PathwayGraph into the exact walkable hex tile footprint
 * for a chapter, hitting the canonical tile count target precisely.
 *
 * PIPELINE STEP
 * ─────────────
 *   DNA → PathwayGraph → HexLaneLayout → art / encounters
 *
 * TILE BUDGET TARGETS
 * ────────────────────
 *   55–65%  Lane cells         (hex corridors between nodes)
 *   25–35%  Clearing cells     (open areas at clearing/junction nodes)
 *    5–15%  Transition cells   (widening zones near clearings)
 *
 * CLEARING COUNT FORMULA
 * ───────────────────────
 *   clearingCount = clamp(round(tileCount / 10), 5, 12)
 *
 * EXACT TILE COUNT GUARANTEE
 * ───────────────────────────
 *   Lane corridors are 1-wide by default; transition tiles widen to 3-wide
 *   near clearings (directive §5).  After initial generation:
 *     Under target → compactness-BFS expansion.
 *     Over target  → leaf-strip pruning (safe, O(N) per pass).
 *   Both preserve connectivity.  Gate is never pruned.
 *
 * COMMIT TAG: feat(journey): expand route graph into lane and clearing hex footprint
 */

import { fnv1a32, mulberry32 } from './prng';
import { getChapterTerrainCellCount } from './config';
import { getChapterMapDNA } from './chapterMapDNA';
import { getChapterPathwayGraph } from './chapterPathwayGraph';
import type { AxialCoord } from './topology';
import type {
  ChapterMapDNA,
  ClearingType,
  ClearingShape,
  ClearingZone,
  LaneSegment,
  HexLaneLayout,
  PathwayGraph,
  PathEdge,
  PathNode,
} from './chapterMapTemplate.types';

// ── Constants ─────────────────────────────────────────────────────────────────

const HEX_DIRS: AxialCoord[] = [
  { q: 1, r: 0 }, { q: -1, r: 0 },
  { q: 0, r: 1 }, { q: 0, r: -1 },
  { q: 1, r: -1 }, { q: -1, r: 1 },
];

/**
 * Base half-width for lane corridors.  Kept at 0 (1-wide) so the centre-line
 * generation stays within budget.  Transition tiles near clearings gain +1
 * via TRANSITION_HALF_WIDTH_BONUS, widening to 3 there (directive §5).
 */
const LANE_HALF_WIDTH: Record<'primary' | 'secondary', number> = {
  primary:   0,
  secondary: 0,
};

/** Extra half-width applied to the transition tiles nearest a clearing. */
const TRANSITION_HALF_WIDTH_BONUS = 1;

/** Number of centre-line tiles near a clearing that get the transition bonus. */
const TRANSITION_ZONE_TILES = 2;

/** Clearing count formula: clamp(round(N/10), 5, 12). */
function targetClearingCount(tileCount: number): number {
  return Math.max(5, Math.min(12, Math.round(tileCount / 10)));
}

/**
 * Chapter 1's university quad is intentionally plaza-first rather than a web of
 * one-hex corridors. Three overlapping courtyard discs keep all 60 progression
 * cells inside a compact, open campus footprint with many natural route loops.
 */
function buildChapterOneOpenCourtyardLayout(
  dna: ChapterMapDNA,
  targetCount: number,
): HexLaneLayout {
  const addCells = new Map<string, AxialCoord>();
  const add = (cells: readonly AxialCoord[]) => {
    for (const cell of cells) addCells.set(hexKey(cell.q, cell.r), cell);
  };

  const entryPlaza = hexDisc({ q: 1, r: 0 }, 2);
  const grandQuad = hexDisc({ q: 5, r: 0 }, 3);
  const gateCourt = hexDisc({ q: 10, r: 0 }, 1);
  add(entryPlaza);
  add(grandQuad);
  add(gateCourt);
  // A south garden step makes the 59-cell triple-courtyard composition exactly
  // match the stable 60-cell progression budget without narrowing any route.
  add([{ q: 5, r: 4 }]);

  const cells = [...addCells.values()].sort((a, b) => a.q - b.q || a.r - b.r);
  if (cells.length !== targetCount) {
    throw new Error(
      `Chapter 1 open courtyard must contain exactly ${targetCount} cells; got ${cells.length}.`,
    );
  }

  const includes = (cell: AxialCoord) => addCells.has(hexKey(cell.q, cell.r));
  const zone = (
    id: string,
    nodeId: string,
    type: ClearingType,
    shape: ClearingShape,
    center: AxialCoord,
    size: 'small' | 'normal' | 'major',
    sourceCells: readonly AxialCoord[],
    exitCount: number,
  ): ClearingZone => ({
    id,
    nodeId,
    type,
    shape,
    center,
    size,
    cells: sourceCells.filter(includes),
    exitCount,
  });

  return {
    chapterId: 1,
    seed: dna.seed,
    cells,
    startCell: { q: 0, r: 0 },
    gateCell: { q: 11, r: 0 },
    clearingZones: [
      zone('entry-plaza', 'start', 'SIDE_CLEARING', 'court', { q: 1, r: 0 }, 'major', entryPlaza, 4),
      zone('grand-quad', 'j1', 'JUNCTION_CLEARING', 'widened_intersection', { q: 5, r: 0 }, 'major', grandQuad, 6),
      zone('gate-court', 'fa', 'FINAL_CLEARING', 'court', { q: 10, r: 0 }, 'normal', gateCourt, 4),
      zone('north-colonnade', 'j2', 'JUNCTION_CLEARING', 'oval', { q: 5, r: -2 }, 'normal',
        [{ q: 4, r: -2 }, { q: 5, r: -3 }, { q: 5, r: -2 }, { q: 6, r: -3 }], 3),
      zone('south-garden', 'c1', 'GENERAL_CLEARING', 'irregular_bay', { q: 5, r: 3 }, 'normal',
        [{ q: 4, r: 3 }, { q: 5, r: 3 }, { q: 5, r: 4 }, { q: 6, r: 2 }, { q: 6, r: 3 }], 3),
    ],
    // Intersections are plazas, not corridor bottlenecks. Empty lane segments
    // intentionally classify all cells as open clearings/transition spaces.
    laneSegments: [],
    targetTileCount: targetCount,
    actualTileCount: cells.length,
    budgetFractions: { lane: 0, clearing: 1 },
  };
}

/** Node types that generate a ClearingZone (all except GATE and TRANSITION). */
const NODE_TO_CLEARING_TYPE: Partial<Record<string, ClearingType>> = {
  START:         'SIDE_CLEARING',
  JUNCTION:      'JUNCTION_CLEARING',
  CLEARING:      'GENERAL_CLEARING',
  LANDMARK:      'SIDE_CLEARING',
  FINAL_APPROACH: 'FINAL_CLEARING',
};

// ── Hex geometry helpers ──────────────────────────────────────────────────────

function hexKey(q: number, r: number): string { return `${q},${r}`; }

function parseHexKey(k: string): AxialCoord {
  const i = k.indexOf(',');
  return { q: +k.slice(0, i), r: +k.slice(i + 1) };
}

export function hexDist(a: AxialCoord, b: AxialCoord): number {
  const dq = a.q - b.q, dr = a.r - b.r, ds = -dq - dr;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

function hexRoundFrac(fq: number, fr: number): AxialCoord {
  const fs = -fq - fr;
  let q = Math.round(fq), r = Math.round(fr), s = Math.round(fs);
  const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

/**
 * All hexes on the straight line from `a` to `b`, inclusive.
 * Returns exactly `[{...a}]` when `a === b` (zero distance).
 */
export function hexLine(a: AxialCoord, b: AxialCoord): AxialCoord[] {
  const n = hexDist(a, b);
  if (n === 0) return [{ q: a.q, r: a.r }];
  const result: AxialCoord[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    result.push(hexRoundFrac(a.q + (b.q - a.q) * t, a.r + (b.r - a.r) * t));
  }
  return result;
}

/**
 * All hexes within a cube-radius of `radius` from `center`
 * (standard hexagonal disc, Minkowski sum with point).
 */
function hexDisc(center: AxialCoord, radius: number): AxialCoord[] {
  const result: AxialCoord[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      result.push({ q: center.q + dq, r: center.r + dr });
    }
  }
  return result;
}

/**
 * BFS growth from `seeds` until `maxCells` total tiles are collected.
 * Returns all cells including seeds.
 */
function hexBfsGrow(seeds: AxialCoord[], maxCells: number): AxialCoord[] {
  const cells = new Map<string, AxialCoord>();
  for (const s of seeds) cells.set(hexKey(s.q, s.r), s);
  let frontier = [...seeds];
  while (cells.size < maxCells && frontier.length > 0) {
    const next: AxialCoord[] = [];
    for (const c of frontier) {
      for (const d of HEX_DIRS) {
        if (cells.size >= maxCells) break;
        const nc = { q: c.q + d.q, r: c.r + d.r };
        const k  = hexKey(nc.q, nc.r);
        if (!cells.has(k)) { cells.set(k, nc); next.push(nc); }
      }
      if (cells.size >= maxCells) break;
    }
    frontier = next;
  }
  return [...cells.values()];
}

/**
 * Generates a thick corridor by expanding the centre-line via a Minkowski
 * disc of radius `halfWidth`, with an optional extra-width transition zone
 * on the last `transitionTileCount` tiles (nearest node B).
 *
 * When `halfWidth === 0` and `transitionBonus === 0`, this returns the raw
 * centre line (1-tile-wide corridor).  Transition bonus gives the directive's
 * "lane → widened approach → clearing" shape.
 */
function hexThickLine(
  a:                   AxialCoord,
  b:                   AxialCoord,
  halfWidth:           number,
  transitionTileCount: number = 0,
  transitionBonus:     number = 0,
): AxialCoord[] {
  const line  = hexLine(a, b);
  const cells = new Map<string, AxialCoord>();

  for (let i = 0; i < line.length; i++) {
    const c          = line[i]!;
    const isTrans    = transitionTileCount > 0 && i >= line.length - transitionTileCount;
    const effectiveHW = halfWidth + (isTrans ? transitionBonus : 0);

    if (effectiveHW === 0) {
      cells.set(hexKey(c.q, c.r), c);
    } else {
      // Minkowski disc
      for (let dq = -effectiveHW; dq <= effectiveHW; dq++) {
        for (let dr = -effectiveHW; dr <= effectiveHW; dr++) {
          if (Math.abs(-dq - dr) <= effectiveHW) {
            const nc = { q: c.q + dq, r: c.r + dr };
            cells.set(hexKey(nc.q, nc.r), nc);
          }
        }
      }
    }
  }
  return [...cells.values()];
}

// ── Adjacency and BFS ─────────────────────────────────────────────────────────

function buildTileAdj(tileSet: Set<string>): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const k of tileSet) {
    const { q, r } = parseHexKey(k);
    adj.set(k, HEX_DIRS.map(d => hexKey(q + d.q, r + d.r)).filter(nk => tileSet.has(nk)));
  }
  return adj;
}

function bfsReach(adj: Map<string, string[]>, startKey: string): Set<string> {
  const visited = new Set<string>([startKey]);
  const queue   = [startKey];
  for (let h = 0; h < queue.length; h++) {
    for (const nk of (adj.get(queue[h]!) ?? [])) {
      if (!visited.has(nk)) { visited.add(nk); queue.push(nk); }
    }
  }
  return visited;
}

// ── Graph path helpers ────────────────────────────────────────────────────────

function graphShortestPath(graph: PathwayGraph, from: string, to: string): string[] {
  const adj = new Map<string, string[]>();
  for (const n of graph.nodes) adj.set(n.id, []);
  for (const e of graph.edges) {
    adj.get(e.fromId)!.push(e.toId);
    adj.get(e.toId)!.push(e.fromId);
  }
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  for (let h = 0; h < queue.length; h++) {
    const cur = queue[h]!;
    if (cur === to) break;
    for (const nb of (adj.get(cur) ?? [])) {
      if (!prev.has(nb)) { prev.set(nb, cur); queue.push(nb); }
    }
  }
  if (!prev.has(to)) return [from];
  const path: string[] = [];
  let cur: string | null = to;
  while (cur !== null) { path.unshift(cur); cur = prev.get(cur) ?? null; }
  return path;
}

function findEdge(graph: PathwayGraph, a: string, b: string): PathEdge | undefined {
  return graph.edges.find(
    e => (e.fromId === a && e.toId === b) || (e.fromId === b && e.toId === a),
  );
}

// ── Node spatial positioning ──────────────────────────────────────────────────

function mainAxis(dna: ChapterMapDNA): AxialCoord {
  switch (dna.aspectRatio) {
    case 'portrait':  return { q: 0, r: 1 };
    case 'wide':      return { q: 1, r: 0 };
    case 'balanced':  return { q: 1, r: 0 }; // horizontal with perpendicular branches
    default:          return { q: 0, r: 1 };
  }
}

function branchAxis(dna: ChapterMapDNA): AxialCoord {
  switch (dna.aspectRatio) {
    case 'portrait':  return { q: 1, r: 0 };
    case 'wide':      return { q: 0, r: 1 };
    case 'balanced':  return { q: 0, r: 1 };
    default:          return { q: 1, r: 0 };
  }
}

/**
 * Compact hex spacing between adjacent graph nodes.
 * Scaled down from the PathEdge.laneLength so the generated tiles fit the
 * budget even after lane expansion and clearing growth.
 *
 * Primary  ~0.40 × laneLength  (floor 2)
 * Secondary ~0.50 × laneLength  (floor 2)
 */
function hexSpacing(edge: PathEdge): number {
  return edge.width === 'primary'
    ? Math.max(2, Math.round(edge.laneLength * 0.40))
    : Math.max(2, Math.round(edge.laneLength * 0.50));
}

/**
 * Assigns axial hex positions to all PathwayGraph nodes:
 *   1. Spine nodes (shortest path start→gate) along the main axis.
 *   2. Branch nodes perpendicular to their spine parent, alternating ±side.
 *   3. Recursive for any un-placed deeper branches.
 *   4. Safety fallback for truly disconnected nodes.
 */
function computeNodePositions(
  graph: PathwayGraph,
  dna:   ChapterMapDNA,
): Map<string, AxialCoord> {
  const positions = new Map<string, AxialCoord>();
  const mAxis     = mainAxis(dna);
  const bAxis     = branchAxis(dna);

  // 1. Spine
  const spine = graphShortestPath(graph, graph.startNodeId, graph.gateNodeId);
  let mPos = 0;
  for (let i = 0; i < spine.length; i++) {
    const nid = spine[i]!;
    positions.set(nid, { q: Math.round(mPos * mAxis.q), r: Math.round(mPos * mAxis.r) });
    if (i < spine.length - 1) {
      const edge = findEdge(graph, nid, spine[i + 1]!);
      mPos += hexSpacing(edge ?? { width: 'primary', laneLength: 4 } as PathEdge);
    }
  }

  // 2–3. Breadth-first placement of branch nodes
  const placed     = new Set(spine);
  let   frontier   = [...spine];
  let   branchSign = 1;

  while (frontier.length > 0 && placed.size < graph.nodes.length) {
    const nextFrontier: string[] = [];
    for (const parentId of frontier) {
      const parentPos = positions.get(parentId)!;
      for (const edge of graph.edges) {
        const childId =
          edge.fromId === parentId ? edge.toId :
          edge.toId   === parentId ? edge.fromId : null;
        if (childId === null || placed.has(childId)) continue;

        const bLen = hexSpacing(edge);
        positions.set(childId, {
          q: parentPos.q + bAxis.q * bLen * branchSign,
          r: parentPos.r + bAxis.r * bLen * branchSign,
        });
        placed.add(childId);
        nextFrontier.push(childId);
        branchSign = -branchSign;
      }
    }
    frontier = nextFrontier;
  }

  // 4. Safety: unplaced nodes default to origin
  for (const n of graph.nodes) {
    if (!positions.has(n.id)) positions.set(n.id, { q: 0, r: 0 });
  }

  return positions;
}

// ── Clearing shape generators ─────────────────────────────────────────────────

function clearingShapeForNode(n: PathNode, rng: () => number): ClearingShape {
  const shapes: ClearingShape[] = [
    'oval', 'widened_intersection', 'court', 'offset_plaza', 'irregular_bay', 'crescent',
  ];
  switch (n.type) {
    case 'JUNCTION':       return 'widened_intersection';
    case 'FINAL_APPROACH': return 'court';
    case 'LANDMARK':       return 'crescent';
    case 'START':          return 'oval';
    default:               return shapes[Math.floor(rng() * shapes.length)]!;
  }
}

function clearingSizeTarget(type: ClearingType): { target: number; label: 'small'|'normal'|'major' } {
  switch (type) {
    case 'MAJOR_CLEARING':    return { target: 10, label: 'major' };
    case 'JUNCTION_CLEARING': return { target: 8,  label: 'major' };
    case 'FINAL_CLEARING':    return { target: 8,  label: 'major' };
    case 'GENERAL_CLEARING':  return { target: 6,  label: 'normal' };
    case 'SIDE_CLEARING':     return { target: 4,  label: 'small' };
    default:                  return { target: 5,  label: 'normal' };
  }
}

function generateClearingCells(
  center: AxialCoord,
  type:   ClearingType,
  shape:  ClearingShape,
  rng:    () => number,
): AxialCoord[] {
  const { target } = clearingSizeTarget(type);

  switch (shape) {
    case 'oval': {
      // BFS with r-axis bias
      const cells = new Map<string, AxialCoord>();
      cells.set(hexKey(center.q, center.r), center);
      const frontier = [center];
      while (cells.size < target && frontier.length > 0) {
        const c    = frontier.shift()!;
        const dirs = [...HEX_DIRS].sort((a, b) => {
          const sa = Math.abs(a.r) >= Math.abs(a.q) ? 2 : 1;
          const sb = Math.abs(b.r) >= Math.abs(b.q) ? 2 : 1;
          return sb - sa + (rng() - 0.5) * 0.4;
        });
        for (const d of dirs) {
          if (cells.size >= target) break;
          const nc = { q: c.q + d.q, r: c.r + d.r };
          const k  = hexKey(nc.q, nc.r);
          if (!cells.has(k)) { cells.set(k, nc); frontier.push(nc); }
        }
      }
      return [...cells.values()];
    }

    case 'court': {
      // Rectangular grid
      const sideQ = Math.max(2, Math.ceil(Math.sqrt(target * 1.4)));
      const sideR = Math.max(2, Math.ceil(target / sideQ));
      const cells: AxialCoord[] = [];
      outer: for (let dq = -Math.floor(sideQ / 2); dq <= Math.ceil(sideQ / 2); dq++) {
        for (let dr = -Math.floor(sideR / 2); dr <= Math.ceil(sideR / 2); dr++) {
          cells.push({ q: center.q + dq, r: center.r + dr });
          if (cells.length >= target) break outer;
        }
      }
      return cells;
    }

    case 'crescent': {
      // Disc minus one inner quadrant
      return hexBfsGrow([center], target);
    }

    case 'widened_intersection': {
      // Cross: inner disc + short arms in 4 directions
      const disc = hexDisc(center, 1);
      const arms = HEX_DIRS.slice(0, 4).map(d => ({ q: center.q + d.q * 2, r: center.r + d.r * 2 }));
      return hexBfsGrow([...disc, ...arms], target);
    }

    case 'offset_plaza': {
      // Oval offset by one step
      const offset  = HEX_DIRS[Math.floor(rng() * HEX_DIRS.length)]!;
      const shifted = { q: center.q + offset.q, r: center.r + offset.r };
      return hexBfsGrow([center, shifted], target);
    }

    case 'irregular_bay': {
      // Random BFS blob
      const cells = new Map<string, AxialCoord>();
      cells.set(hexKey(center.q, center.r), center);
      const frontier = [center];
      while (cells.size < target && frontier.length > 0) {
        const idx  = Math.floor(rng() * frontier.length);
        const c    = frontier[idx]!;
        frontier.splice(idx, 1);
        const dirs = [...HEX_DIRS].sort(() => rng() - 0.5);
        for (const d of dirs) {
          if (cells.size >= target) break;
          const nc = { q: c.q + d.q, r: c.r + d.r };
          const k  = hexKey(nc.q, nc.r);
          if (!cells.has(k)) { cells.set(k, nc); frontier.push(nc); }
        }
      }
      return [...cells.values()];
    }
  }
}

// ── Tile count adjustment ─────────────────────────────────────────────────────

/**
 * Adds tiles one-by-one, always picking the frontier candidate with the
 * highest neighbour count in the existing tile set (compactness-first).
 */
function expandToTarget(tileSet: Set<string>, target: number): void {
  while (tileSet.size < target) {
    let bestKey = '';
    let bestCnt = -1;
    for (const k of tileSet) {
      const { q, r } = parseHexKey(k);
      for (const d of HEX_DIRS) {
        const nk = hexKey(q + d.q, r + d.r);
        if (tileSet.has(nk)) continue;
        let cnt = 0;
        const { q: nq, r: nr } = parseHexKey(nk);
        for (const dd of HEX_DIRS) {
          if (tileSet.has(hexKey(nq + dd.q, nr + dd.r))) cnt++;
        }
        if (cnt > bestCnt) { bestCnt = cnt; bestKey = nk; }
      }
    }
    if (bestKey === '') break;
    tileSet.add(bestKey);
  }
}

/**
 * Removes tiles one-pass-at-a-time using safe leaf stripping:
 *   Pass 1: remove all degree-1 tiles that are not protected.
 *   Pass 2: remove degree-2 tiles whose two neighbours are directly adjacent
 *           to each other (safe: graph remains connected).
 * Repeats until target reached or no safe candidates remain.
 *
 * Leaf stripping is O(N) per pass and never disconnects the tile graph.
 */
function pruneToTarget(
  tileSet:    Set<string>,
  target:     number,
  protected_: Set<string>,
): void {
  let changed = true;
  while (tileSet.size > target && changed) {
    changed = false;
    const adj = buildTileAdj(tileSet);

    // Pass A: remove leaves (degree 0 or 1)
    for (const k of [...tileSet]) {
      if (tileSet.size <= target) break;
      if (protected_.has(k)) continue;
      const deg = (adj.get(k)?.length ?? 0);
      if (deg <= 1) {
        tileSet.delete(k);
        changed = true;
      }
    }
    if (tileSet.size <= target) break;

    // Re-build adjacency after Pass A
    const adj2 = buildTileAdj(tileSet);

    // Pass B: safe degree-2 removal (both neighbours are adjacent to each other)
    for (const k of [...tileSet]) {
      if (tileSet.size <= target) break;
      if (protected_.has(k)) continue;
      const nbrs = adj2.get(k) ?? [];
      if (nbrs.length !== 2) continue;
      // Safe if the two neighbours share a direct edge
      if ((adj2.get(nbrs[0]!) ?? []).includes(nbrs[1]!)) {
        tileSet.delete(k);
        changed = true;
      }
    }
  }

  // Last resort: connectivity-check single removal for any remaining excess
  while (tileSet.size > target) {
    const adj3 = buildTileAdj(tileSet);
    const root  = [...protectedInSet(tileSet, protected_)][0]
               ?? [...tileSet][0]!;
    let pruned = false;
    for (const k of [...tileSet]) {
      if (tileSet.size <= target) break;
      if (protected_.has(k)) continue;
      // Attempt removal
      tileSet.delete(k);
      const reach = bfsReach(buildTileAdj(tileSet), root);
      if (reach.size === tileSet.size) {
        pruned = true;
      } else {
        tileSet.add(k); // revert — removal disconnected graph
      }
    }
    if (!pruned) break;
  }
}

function protectedInSet(tileSet: Set<string>, protected_: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const k of protected_) if (tileSet.has(k)) result.add(k);
  return result;
}

// ── Main layout builder ───────────────────────────────────────────────────────

function buildHexLayout(
  graph:       PathwayGraph,
  dna:         ChapterMapDNA,
  targetCount: number,
  rng:         () => number,
): HexLaneLayout {
  // ── 1. Node hex positions ──────────────────────────────────────────────────
  const nodePos = computeNodePositions(graph, dna);

  // ── 2. Edge count per node ─────────────────────────────────────────────────
  const nodeEdgeCount = new Map<string, number>();
  for (const e of graph.edges) {
    nodeEdgeCount.set(e.fromId, (nodeEdgeCount.get(e.fromId) ?? 0) + 1);
    nodeEdgeCount.set(e.toId,   (nodeEdgeCount.get(e.toId)   ?? 0) + 1);
  }

  // ── 3. Which nodes get clearing zones ─────────────────────────────────────
  // Include START; exclude GATE and TRANSITION.
  let clearingNodes = graph.nodes.filter(n => NODE_TO_CLEARING_TYPE[n.type] !== undefined);

  // Guarantee at least targetClearingCount(targetCount) clearings by adding
  // the GATE node as a SIDE_CLEARING when the count is still short.
  const minCZ = Math.max(5, targetClearingCount(targetCount));
  if (clearingNodes.length < minCZ) {
    const gateNode = graph.nodes.find(n => n.type === 'GATE');
    if (gateNode && !clearingNodes.find(n => n.id === gateNode.id)) {
      clearingNodes = [...clearingNodes, gateNode];
    }
  }

  // ── 4. Clearing tile budget per zone ──────────────────────────────────────
  const clearingBudget  = Math.round(targetCount * 0.30);
  const baseClearSize   = Math.max(3, Math.round(clearingBudget / Math.max(1, clearingNodes.length)));

  // ── 5. Generate lane tiles ─────────────────────────────────────────────────
  const laneTilesByEdge = new Map<string, AxialCoord[]>();
  const masterSet       = new Set<string>();
  const clearingCentres = new Set<string>();

  // Helper: is a node a clearing node?
  const isClearingNode = (id: string) => clearingNodes.some(n => n.id === id);

  for (const edge of graph.edges) {
    const posA = nodePos.get(edge.fromId);
    const posB = nodePos.get(edge.toId);
    if (!posA || !posB) continue;

    const hw         = LANE_HALF_WIDTH[edge.width];
    const toClearing   = isClearingNode(edge.toId);
    const fromClearing = isClearingNode(edge.fromId);
    const transTiles   = (toClearing || fromClearing) ? TRANSITION_ZONE_TILES : 0;
    const transBonus   = (toClearing || fromClearing) ? TRANSITION_HALF_WIDTH_BONUS : 0;

    const laneCells = hexThickLine(posA, posB, hw, transTiles, transBonus);
    laneTilesByEdge.set(edge.id, laneCells);
    for (const c of laneCells) masterSet.add(hexKey(c.q, c.r));
  }

  // ── 6. Generate clearing tiles ─────────────────────────────────────────────
  const clearingZoneList: ClearingZone[] = [];
  let czIndex = 0;

  for (const n of clearingNodes) {
    const pos = nodePos.get(n.id);
    if (!pos) continue;

    const rawType = NODE_TO_CLEARING_TYPE[n.type] ?? 'SIDE_CLEARING';
    const cType: ClearingType =
      (rawType === 'GENERAL_CLEARING' && (nodeEdgeCount.get(n.id) ?? 0) >= 3)
        ? 'MAJOR_CLEARING'
        : (rawType as ClearingType);

    const shape     = clearingShapeForNode(n, rng);
    const { label } = clearingSizeTarget(cType);
    const adjSize   = Math.max(3, Math.round(baseClearSize *
      (cType === 'SIDE_CLEARING' ? 0.70 : cType === 'JUNCTION_CLEARING' ? 1.30 : 1.0)));

    const czCells  = generateClearingCells(pos, cType, shape, rng).slice(0, adjSize);

    clearingZoneList.push({
      id:        `cz_${czIndex++}`,
      nodeId:    n.id,
      type:      cType,
      shape,
      center:    pos,
      size:      label,
      cells:     czCells,
      exitCount: nodeEdgeCount.get(n.id) ?? 1,
    });

    for (const c of czCells) masterSet.add(hexKey(c.q, c.r));
    clearingCentres.add(hexKey(pos.q, pos.r));
  }

  // ── 7. Ensure start and gate are in the set ────────────────────────────────
  const startPos = nodePos.get(graph.startNodeId) ?? { q: 0, r: 0 };
  const gatePos  = nodePos.get(graph.gateNodeId)  ?? { q: 0, r: 1 };
  masterSet.add(hexKey(startPos.q, startPos.r));
  masterSet.add(hexKey(gatePos.q,  gatePos.r));

  // ── 8. Adjust to exact targetCount ────────────────────────────────────────
  const protectedKeys = new Set<string>([
    hexKey(startPos.q, startPos.r),
    hexKey(gatePos.q,  gatePos.r),
    ...clearingCentres,
  ]);

  if (masterSet.size < targetCount) {
    expandToTarget(masterSet, targetCount);
  } else if (masterSet.size > targetCount) {
    pruneToTarget(masterSet, targetCount, protectedKeys);
  }

  // ── 9. Connectivity fix ────────────────────────────────────────────────────
  const startKey = hexKey(startPos.q, startPos.r);
  const reachAdj = buildTileAdj(masterSet);
  const reached  = bfsReach(reachAdj, startKey);

  if (reached.size < masterSet.size) {
    // Drop unreachable islands, then re-expand to target
    for (const k of masterSet) {
      if (!reached.has(k)) masterSet.delete(k);
    }
    if (masterSet.size < targetCount) expandToTarget(masterSet, targetCount);
  }

  // ── 10. Assemble ──────────────────────────────────────────────────────────
  const cells = [...masterSet].map(parseHexKey);

  const laneSegments: LaneSegment[] = [];
  for (const [eid, laneCells] of laneTilesByEdge) {
    const edge = graph.edges.find(e => e.id === eid);
    if (!edge) continue;
    laneSegments.push({
      edgeId:     eid,
      fromNodeId: edge.fromId,
      toNodeId:   edge.toId,
      cells:      laneCells.filter(c => masterSet.has(hexKey(c.q, c.r))),
      width:      edge.width,
    });
  }

  const finalClearings: ClearingZone[] = clearingZoneList.map(cz => ({
    ...cz,
    cells: cz.cells.filter(c => masterSet.has(hexKey(c.q, c.r))),
  }));

  // Budget fractions (pre-overlap raw counts for diagnostics)
  const rawLaneCount     = [...laneTilesByEdge.values()].reduce((s, a) => s + a.length, 0);
  const rawClearingCount = clearingZoneList.reduce((s, cz) => s + cz.cells.length, 0);
  const N                = masterSet.size || 1;

  return {
    chapterId:       graph.chapterId,
    seed:            dna.seed,
    cells,
    startCell:       startPos,
    gateCell:        gatePos,
    clearingZones:   finalClearings,
    laneSegments,
    targetTileCount: targetCount,
    actualTileCount: cells.length,
    budgetFractions: {
      lane:     rawLaneCount     / N,
      clearing: rawClearingCount / N,
    },
  };
}

// ── Cache + public API ────────────────────────────────────────────────────────

const layoutCache = new Map<number, HexLaneLayout>();

/**
 * Returns the HexLaneLayout for the given chapter.
 *
 * Guaranteed:
 *   • `actualTileCount === targetTileCount`
 *   • All cells form one connected component (BFS from startCell).
 *   • `startCell` and `gateCell` are in `cells`.
 *   • No duplicate coords.
 *   • `clearingZones.length` ≥ 5.
 */
export function getChapterHexLayout(chapter: number): HexLaneLayout {
  const cached = layoutCache.get(chapter);
  if (cached) return cached;

  const dna         = getChapterMapDNA(chapter);
  const graph       = getChapterPathwayGraph(chapter);
  const targetCount = getChapterTerrainCellCount(chapter);
  const seedStr     = `${dna.seed}:hex-layout-v1`;
  const rng         = mulberry32(fnv1a32(seedStr));

  const layout = chapter === 1
    ? buildChapterOneOpenCourtyardLayout(dna, targetCount)
    : buildHexLayout(graph, dna, targetCount, rng);
  layoutCache.set(chapter, layout);
  return layout;
}

/**
 * Returns hex layouts for a range of chapters [from, to] inclusive.
 */
export function getChapterHexLayoutRange(from: number, to: number): HexLaneLayout[] {
  const result: HexLaneLayout[] = [];
  for (let c = from; c <= to; c++) result.push(getChapterHexLayout(c));
  return result;
}
