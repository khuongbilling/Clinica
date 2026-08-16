/**
 * journeyMap/chapterSceneryLayout.ts — Push 6: Scenery Zones from Negative Space
 *
 * Derives environmental scenery zones from the non-walkable space around the
 * HexLaneLayout footprint.
 *
 * CORE RULE
 * ──────────
 *   WALKABLE SPACE IS SACRED.
 *   No scenery zone cell may appear in the walkable safety mask:
 *     sceneryCell ∩ walkableSafetyMask === ∅   (hard invariant, tested)
 *
 * PIPELINE STEP
 * ─────────────
 *   HexLaneLayout → SceneryLayout
 *   (reads DNA for density; reads clearing centres for framing placement)
 *
 * ALGORITHM
 * ──────────
 *   1. Walkable safety mask  = walkable cells ∪ their 1-ring hex neighbours
 *   2. World bounds          = safety-mask bbox + WORLD_MARGIN tile margin
 *   3. Candidate tiles       = world grid − safety mask
 *   4. BFS cluster candidates into connected components
 *   5. Filter clusters smaller than MIN_CLUSTER_SIZE
 *   6. Compute spatial metrics per cluster (contact, enclosure, clearing dist)
 *   7. Assign zone type deterministically from metrics + DNA
 *   8. Rank & density-filter: keep top-N% by score; guarantee ≥ MIN_ZONES
 *
 * DENSITY LEVELS  (from DNA.obstaclePattern + chapter)
 * ──────────────
 *   LOW    → keep ~35% of candidate zones
 *   MEDIUM → keep ~65%
 *   HIGH   → keep ~90%
 *
 * COMMIT TAG: feat(journey): derive obstacle zones from non-walkable map space
 */

import { fnv1a32, mulberry32 } from './prng';
import { getChapterMapDNA }      from './chapterMapDNA';
import { getChapterHexLayout }   from './chapterHexLayout';
import type { AxialCoord }       from './topology';
import type {
  ChapterMapDNA,
  SceneryZoneType,
  EnvironmentalDensity,
  SceneryZone,
  SceneryLayout,
  HexLaneLayout,
} from './chapterMapTemplate.types';

// ── Constants ─────────────────────────────────────────────────────────────────

const HEX_DIRS: AxialCoord[] = [
  { q: 1, r: 0 }, { q: -1, r: 0 },
  { q: 0, r: 1 }, { q: 0, r: -1 },
  { q: 1, r: -1 }, { q: -1, r: 1 },
];

/** Tile margin added around the safety-mask bounding box to form world bounds. */
const WORLD_MARGIN = 4;

/** Clusters smaller than this are discarded (too tiny to be meaningful scenery). */
const MIN_CLUSTER_SIZE = 2;

/** Minimum scenery zones to guarantee even at LOW density. */
const MIN_ZONES = 2;

/** Fraction of zones kept per density level. */
const DENSITY_KEEP: Record<EnvironmentalDensity, number> = {
  LOW:    0.35,
  MEDIUM: 0.65,
  HIGH:   0.90,
};

// ── Hex helpers ───────────────────────────────────────────────────────────────

function hexKey(q: number, r: number): string { return `${q},${r}`; }

function parseHexKey(k: string): AxialCoord {
  const i = k.indexOf(',');
  return { q: +k.slice(0, i), r: +k.slice(i + 1) };
}

function hexDist(a: AxialCoord, b: AxialCoord): number {
  const dq = a.q - b.q, dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(-dq - dr));
}

// ── Step 1: Walkable safety mask ──────────────────────────────────────────────

/**
 * Returns the set of "q,r" keys that no scenery may overlap:
 *   walkable cells ∪ all immediate hex-neighbours of walkable cells.
 *
 * This implements the 0.15–0.25 × tile_size safety padding from the directive
 * at the hex-grid granularity (1 tile = 1 safety ring).
 */
export function computeWalkableSafetyMask(layout: HexLaneLayout): Set<string> {
  const mask = new Set<string>();
  for (const c of layout.cells) {
    mask.add(hexKey(c.q, c.r));
    for (const d of HEX_DIRS) {
      mask.add(hexKey(c.q + d.q, c.r + d.r));
    }
  }
  return mask;
}

// ── Step 2: World bounds ───────────────────────────────────────────────────────

/**
 * Returns the axial bounding box of the safety mask enlarged by WORLD_MARGIN.
 * All candidate scenery tiles will be drawn from this region.
 */
export function computeWorldBounds(
  safetyMask: Set<string>,
): { minQ: number; maxQ: number; minR: number; maxR: number } {
  let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  for (const k of safetyMask) {
    const { q, r } = parseHexKey(k);
    if (q < minQ) minQ = q;
    if (q > maxQ) maxQ = q;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
  }
  return {
    minQ: minQ - WORLD_MARGIN,
    maxQ: maxQ + WORLD_MARGIN,
    minR: minR - WORLD_MARGIN,
    maxR: maxR + WORLD_MARGIN,
  };
}

// ── Step 3: Candidate scenery tiles ───────────────────────────────────────────

/**
 * All axial hex tiles within the world bounds rectangle that are NOT in the
 * walkable safety mask.  These are the raw candidates for scenery placement.
 */
function getCandidateTiles(
  bounds:     { minQ: number; maxQ: number; minR: number; maxR: number },
  safetyMask: Set<string>,
): AxialCoord[] {
  const result: AxialCoord[] = [];
  for (let q = bounds.minQ; q <= bounds.maxQ; q++) {
    for (let r = bounds.minR; r <= bounds.maxR; r++) {
      if (!safetyMask.has(hexKey(q, r))) {
        result.push({ q, r });
      }
    }
  }
  return result;
}

// ── Step 4: BFS clustering ─────────────────────────────────────────────────────

/**
 * Partitions `candidates` into hex-connected components.
 * Only tiles within `candidateSet` are considered adjacent.
 */
function clusterCandidates(candidates: AxialCoord[]): AxialCoord[][] {
  const candidateSet = new Set(candidates.map(c => hexKey(c.q, c.r)));
  const visited      = new Set<string>();
  const clusters: AxialCoord[][] = [];

  for (const c of candidates) {
    const k = hexKey(c.q, c.r);
    if (visited.has(k)) continue;

    // BFS from c
    const cluster: AxialCoord[] = [];
    const queue = [c];
    visited.add(k);

    for (let h = 0; h < queue.length; h++) {
      const cur = queue[h]!;
      cluster.push(cur);
      for (const d of HEX_DIRS) {
        const nk = hexKey(cur.q + d.q, cur.r + d.r);
        if (candidateSet.has(nk) && !visited.has(nk)) {
          visited.add(nk);
          queue.push(parseHexKey(nk));
        }
      }
    }
    clusters.push(cluster);
  }

  return clusters;
}

// ── Step 5: Spatial metrics per cluster ───────────────────────────────────────

interface ClusterMetrics {
  cells:               AxialCoord[];
  centroid:            AxialCoord;
  area:                number;
  walkableContactCount: number;
  isEnclosed:          boolean;
  nearestClearingDist: number;
  score:               number;
}

function computeClusterMetrics(
  cluster:      AxialCoord[],
  safetyMask:   Set<string>,
  clearingCtrs: AxialCoord[],
): ClusterMetrics {
  const area = cluster.length;

  // Centroid (rounded)
  const sumQ  = cluster.reduce((s, c) => s + c.q, 0);
  const sumR  = cluster.reduce((s, c) => s + c.r, 0);
  const centroid: AxialCoord = {
    q: Math.round(sumQ / area),
    r: Math.round(sumR / area),
  };

  // Walkable contact: cells whose at least one hex-neighbour is in safety mask
  let contact = 0;
  let totalBorderNeighbours = 0;
  let walkableBorderNeighbours = 0;

  for (const c of cluster) {
    let hasWalkableNeighbour = false;
    for (const d of HEX_DIRS) {
      const nk = hexKey(c.q + d.q, c.r + d.r);
      totalBorderNeighbours++;
      if (safetyMask.has(nk)) {
        walkableBorderNeighbours++;
        hasWalkableNeighbour = true;
      }
    }
    if (hasWalkableNeighbour) contact++;
  }

  const walkableContactCount = contact;

  // Enclosure: > 50% of all border-neighbour slots occupied by walkable tiles
  const isEnclosed = totalBorderNeighbours > 0
    && walkableBorderNeighbours / totalBorderNeighbours > 0.50;

  // Nearest clearing distance
  let nearestClearingDist = Infinity;
  for (const c of cluster) {
    for (const cc of clearingCtrs) {
      const d = hexDist(c, cc);
      if (d < nearestClearingDist) nearestClearingDist = d;
    }
  }
  if (clearingCtrs.length === 0) nearestClearingDist = 99;

  // Zone quality score (used for density ranking)
  const score =
    walkableContactCount * 1.5 +
    (isEnclosed ? 4 : 0) +
    (nearestClearingDist <= 2 ? 5 : nearestClearingDist <= 4 ? 2 : 0) +
    area * 0.6;

  return {
    cells: cluster,
    centroid,
    area,
    walkableContactCount,
    isEnclosed,
    nearestClearingDist,
    score,
  };
}

// ── Step 6: Zone type assignment ───────────────────────────────────────────────

/**
 * Zone type pools for different spatial contexts.
 * The directive says:
 *   • Inside a curve (enclosed) → ARCHITECTURE, GARDEN, COLUMN_GROUP
 *   • Frames a clearing         → OBSERVATION_DECK, DECORATIVE_LANDMARK, ACADEMIC_STATUE
 *   • Island between lanes      → COLUMN_GROUP, PLANTER, WATER_FEATURE
 *   • Large zone                → BUILDING_WING, SIMULATION_STRUCTURE, GARDEN
 *   • Small zone                → PLANTER, WATER_FEATURE, ACADEMIC_STATUE
 */
const ZONE_POOLS: Record<string, SceneryZoneType[]> = {
  clearingFrame: ['OBSERVATION_DECK', 'DECORATIVE_LANDMARK', 'ACADEMIC_STATUE'],
  enclosed:      ['ARCHITECTURE', 'GARDEN', 'COLUMN_GROUP'],
  large:         ['BUILDING_WING', 'SIMULATION_STRUCTURE', 'GARDEN', 'ARCHITECTURE'],
  medium:        ['GARDEN', 'PLANTER', 'COLUMN_GROUP', 'WATER_FEATURE'],
  small:         ['PLANTER', 'WATER_FEATURE', 'ACADEMIC_STATUE', 'COLUMN_GROUP'],
};

/** Obstacle-pattern influence on zone type selection. */
const PATTERN_PREFERRED: Record<string, SceneryZoneType[]> = {
  walls:   ['ARCHITECTURE', 'BUILDING_WING', 'COLUMN_GROUP'],
  islands: ['GARDEN', 'PLANTER', 'WATER_FEATURE'],
  blocks:  ['BUILDING_WING', 'SIMULATION_STRUCTURE', 'ARCHITECTURE'],
  mixed:   ['GARDEN', 'SIMULATION_STRUCTURE', 'DECORATIVE_LANDMARK'],
  none:    ['GARDEN', 'PLANTER'],
};

function assignZoneType(
  metrics: ClusterMetrics,
  dna:     ChapterMapDNA,
  rng:     () => number,
): SceneryZoneType {
  // Select pool based on spatial context (priority order)
  let pool: SceneryZoneType[];

  if (metrics.nearestClearingDist <= 2) {
    pool = ZONE_POOLS.clearingFrame!;
  } else if (metrics.isEnclosed) {
    pool = ZONE_POOLS.enclosed!;
  } else if (metrics.area >= 8) {
    pool = ZONE_POOLS.large!;
  } else if (metrics.area >= 4) {
    pool = ZONE_POOLS.medium!;
  } else {
    pool = ZONE_POOLS.small!;
  }

  // Occasionally (30% chance) bias toward DNA obstacle-pattern preferred type
  const patternPool = PATTERN_PREFERRED[dna.obstaclePattern] ?? ZONE_POOLS.medium!;
  const usePattern  = rng() < 0.30;

  const finalPool = usePattern
    ? [...new Set([...patternPool, ...pool])]  // pattern first, then spatial
    : pool;

  return finalPool[Math.floor(rng() * finalPool.length)]!;
}

// ── Step 7: Environmental density ─────────────────────────────────────────────

/**
 * Derives the environmental density from the chapter's DNA.
 *
 * University chapters 1–3 are always LOW.
 * Later chapters scale with obstaclePattern complexity.
 */
export function deriveEnvironmentalDensity(dna: ChapterMapDNA): EnvironmentalDensity {
  if (dna.chapterId <= 3) return 'LOW';

  switch (dna.obstaclePattern) {
    case 'none':    return 'LOW';
    case 'islands': return dna.chapterId <= 6 ? 'LOW' : 'MEDIUM';
    case 'walls':   return 'MEDIUM';
    case 'blocks':  return dna.chapterId >= 8 ? 'HIGH' : 'MEDIUM';
    case 'mixed':   return 'HIGH';
    default:        return 'MEDIUM';
  }
}

// ── Step 8: Density filter ─────────────────────────────────────────────────────

/**
 * Keeps the top-N zones by score according to the density level.
 * Always keeps at least MIN_ZONES to guarantee some environmental context.
 */
function applyDensityFilter(
  zones:   ClusterMetrics[],
  density: EnvironmentalDensity,
): ClusterMetrics[] {
  if (zones.length === 0) return [];

  const sorted   = [...zones].sort((a, b) => b.score - a.score);
  const keepFrac = DENSITY_KEEP[density];
  const keepN    = Math.max(MIN_ZONES, Math.round(sorted.length * keepFrac));

  return sorted.slice(0, keepN);
}

// ── Main builder ───────────────────────────────────────────────────────────────

function buildSceneryLayout(
  layout: HexLaneLayout,
  dna:    ChapterMapDNA,
  rng:    () => number,
): SceneryLayout {
  // 1. Walkable safety mask
  const safetyMask = computeWalkableSafetyMask(layout);

  // 2. World bounds
  const worldBounds = computeWorldBounds(safetyMask);

  // 3. Candidate tiles
  const candidates = getCandidateTiles(worldBounds, safetyMask);

  // 4. BFS cluster
  const rawClusters = clusterCandidates(candidates);

  // 5. Filter tiny clusters
  const usableClusters = rawClusters.filter(c => c.length >= MIN_CLUSTER_SIZE);

  // Clearing centres for proximity scoring
  const clearingCtrs = layout.clearingZones.map(cz => cz.center);

  // 6. Compute spatial metrics
  const allMetrics = usableClusters.map(cluster =>
    computeClusterMetrics(cluster, safetyMask, clearingCtrs),
  );

  // 7. Derive density and filter
  const density       = deriveEnvironmentalDensity(dna);
  const keptMetrics   = applyDensityFilter(allMetrics, density);

  // 8. Build SceneryZone objects
  const sceneryZones: SceneryZone[] = keptMetrics.map((m, i) => ({
    id:                  `sz_${i}`,
    type:                assignZoneType(m, dna, rng),
    cells:               m.cells,
    centroid:            m.centroid,
    area:                m.area,
    walkableContactCount: m.walkableContactCount,
    isEnclosed:          m.isEnclosed,
    nearestClearingDist: m.nearestClearingDist,
  }));

  return {
    chapterId:              layout.chapterId,
    seed:                   dna.seed,
    walkableSafetyMaskKeys: [...safetyMask],
    worldBounds,
    sceneryZones,
    environmentalDensity:   density,
  };
}

// ── Cache + public API ────────────────────────────────────────────────────────

const sceneryCache = new Map<number, SceneryLayout>();

/**
 * Returns the SceneryLayout for the given chapter.
 *
 * Guaranteed:
 *   • Every cell in `sceneryZones` is absent from `walkableSafetyMaskKeys`.
 *   • `walkableSafetyMaskKeys` ⊇ all HexLaneLayout.cells keys.
 *   • `worldBounds` contains all walkable cells with ≥ WORLD_MARGIN margin.
 *   • `sceneryZones.length ≥ 1`.
 *   • Same chapter always returns the same cached object.
 */
export function getChapterSceneryLayout(chapter: number): SceneryLayout {
  const cached = sceneryCache.get(chapter);
  if (cached) return cached;

  const dna    = getChapterMapDNA(chapter);
  const layout = getChapterHexLayout(chapter);
  const rng    = mulberry32(fnv1a32(`${dna.seed}:scenery-v1`));

  const result = buildSceneryLayout(layout, dna, rng);
  sceneryCache.set(chapter, result);
  return result;
}

/**
 * Returns scenery layouts for a range of chapters [from, to] inclusive.
 */
export function getChapterSceneryLayoutRange(from: number, to: number): SceneryLayout[] {
  const result: SceneryLayout[] = [];
  for (let c = from; c <= to; c++) result.push(getChapterSceneryLayout(c));
  return result;
}
