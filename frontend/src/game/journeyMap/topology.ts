/**
 * journeyMap/topology.ts — PUSH 6
 *
 * Deterministic connected hex-topology generator.
 *
 * Given a chapter number and an arbitrary seed (string or integer), produces
 * an identical connected axial-coordinate map every time.  No React, Expo, or
 * UI imports belong here.
 *
 * Coordinate system
 * ─────────────────
 * Axial (q, r):  q grows rightward, r grows downward on the portrait screen.
 * The third cube coordinate is s = −q − r (not stored).
 * Tile keys are the string "q,r" (e.g. "0,0", "-1,2").
 *
 * Growth algorithm
 * ────────────────
 * Starting from tile (0,0):
 *   1. Pick a frontier tile via weighted random:
 *        weight = compactness(n²) × portraitBias × widthPenalty
 *   2. Add it to the map; update frontier.
 *   3. Repeat until `targetCount` tiles are placed.
 *
 * Portrait bias pushes positive-r (downward) growth more than lateral.
 * Width penalty softly discourages tiles that extend the q-spread beyond
 * √(targetCount × 1.2).
 *
 * Compactness (n = number of already-placed neighbours, weight = n²) prevents
 * the organic blob from developing long, thin fingers.
 *
 * Retry logic
 * ───────────
 * If the generated map fails validation — disconnected, wrong count, gate too
 * close to start, or excessively wide — a new PRNG stream is derived from the
 * same seed and the process repeats (up to MAX_RETRIES times).  Each retry is
 * reproducible from the same seed + retry index.
 */

import { getChapterTerrainCellCount } from './config';
import { mulberry32, fnv1a32 } from './prng';

// ── Public types ──────────────────────────────────────────────────────────────

export interface AxialCoord {
  q: number;
  r: number;
}

/**
 * Per-tile authoring zone metadata injected by the canonical map pipeline.
 *
 * Only present on HexTopology objects produced by the blueprint pipeline
 * (chapters in BLUEPRINT_PIPELINE_CHAPTERS).  Always undefined for authored
 * circular/blob topology and procedural fallback chapters.
 *
 *   zoneType:
 *     'lane'       — hex corridor tile along a primary or secondary lane
 *     'clearing'   — open area tile at a named clearing/junction node
 *     'transition' — widened approach near a clearing, or BFS expansion filler
 *
 *   clearingId:   Clearing zone id (only when zoneType === 'clearing')
 *   clearingType: ClearingType value (only when zoneType === 'clearing')
 *   laneClass:    Lane width class (only when zoneType === 'lane')
 */
export interface HexTileZoneMeta {
  zoneType:     'lane' | 'clearing' | 'transition';
  clearingId?:  string;
  /** Matches ClearingType values from chapterMapTemplate.types.ts. */
  clearingType?: string;
  laneClass?:   'primary' | 'secondary';
}

export interface HexTopology {
  chapter:        number;
  seed:           string | number;
  /** All tile coordinates in arbitrary order. */
  tiles:          AxialCoord[];
  /** "q,r" key of the player start tile (bottom-ish, centred). */
  startTileId:    string;
  /** "q,r" key of the chapter boss gate anchor (top-ish, far from start). */
  gateAnchorId:   string;
  /** BFS graph distances from startTileId to every tile. */
  graphDistances: Map<string, number>;
  /**
   * Optional per-tile zone metadata from the canonical map pipeline.
   * tileKey ("q,r") → HexTileZoneMeta.
   * Only present for chapters in BLUEPRINT_PIPELINE_CHAPTERS.
   */
  zoneMeta?:      Map<string, HexTileZoneMeta>;
}

export interface GenerateTopologyOptions {
  chapter: number;
  seed:    string | number;
}

// ── PRNG ──────────────────────────────────────────────────────────────────────
// mulberry32 and fnv1a32 live in ./prng (shared with encounters.ts).

/** Always produces a uint32 that embeds both the chapter and the caller's seed. */
function toNumericSeed(chapter: number, seed: string | number): number {
  // Prefix with chapter so that seed="42" for ch1 differs from ch2.
  return fnv1a32(`ch${chapter}:${seed}`);
}

// ── Axial hex geometry ────────────────────────────────────────────────────────

const AXIAL_DIRS: readonly AxialCoord[] = [
  { q:  1, r:  0 }, { q: -1, r: 0 },
  { q:  0, r:  1 }, { q:  0, r: -1 },
  { q:  1, r: -1 }, { q: -1, r:  1 },
];

function axialKey(q: number, r: number): string {
  return `${q},${r}`;
}

function parseKey(key: string): AxialCoord {
  const c = key.indexOf(',');
  return { q: Number(key.slice(0, c)), r: Number(key.slice(c + 1)) };
}

function axialNeighborKeys(q: number, r: number): string[] {
  return AXIAL_DIRS.map(d => axialKey(q + d.q, r + d.r));
}

// ── Weighted random selection ─────────────────────────────────────────────────

function weightedPick<T>(
  items: T[],
  weight: (item: T) => number,
  rng: () => number,
): T {
  const weights = items.map(item => Math.max(0, weight(item)));
  const total   = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) {
    // Uniform fallback when every weight is zero (shouldn't happen in practice).
    return items[Math.floor(rng() * items.length)];
  }
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ── Growth weights ────────────────────────────────────────────────────────────

/**
 * Compactness weight.
 * n = number of already-placed neighbours of candidate tile.
 * Weight = n + 1 (linear) — mild preference for tiles that fill in the blob.
 * Deliberately not quadratic so that the portrait-bias weight can dominate
 * and produce tall, narrow maps rather than circular ones.
 */
function compactnessWeight(q: number, r: number, tileSet: Set<string>): number {
  let n = 0;
  for (const nk of axialNeighborKeys(q, r)) {
    if (tileSet.has(nk)) n++;
  }
  return n + 1; // frontier tiles always have n ≥ 1 → weight ≥ 2
}

/**
 * Portrait-bias weight.
 * Strongly rewards downward growth (positive r, bottom of screen) and
 * moderately rewards upward growth (needed for the gate region at top).
 * Penalises lateral spread (large |q|) to keep the map narrow and tall.
 */
function portraitBiasWeight(q: number, r: number): number {
  const vertBoost    = r >= 0
    ? 1.0 + r * 0.30          // downward: strong bias toward positive r
    : 1.0 + Math.abs(r) * 0.15; // upward: moderate bias (gate lives up here)
  const horizPenalty = Math.max(0.15, 1.0 - Math.abs(q) * 0.14);
  return vertBoost * horizPenalty;
}

/**
 * Width-limit weight.
 * Applies a very small weight (0.002) — not 0 — when a candidate would push
 * the q-spread beyond `maxWidth`.  The near-zero weight allows growth to
 * continue if absolutely every frontier tile would exceed the limit (edge
 * case), but strongly discourages such tiles in practice.
 */
function widthWeight(
  q: number,
  minQ: number,
  maxQ: number,
  maxWidth: number,
): number {
  const newMinQ = Math.min(minQ, q);
  const newMaxQ = Math.max(maxQ, q);
  return (newMaxQ - newMinQ) > maxWidth ? 0.002 : 1.0;
}

// ── Graph helpers ─────────────────────────────────────────────────────────────

function buildAdjacency(tileSet: Set<string>): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const k of tileSet) {
    const { q, r } = parseKey(k);
    adj.set(k, axialNeighborKeys(q, r).filter(nk => tileSet.has(nk)));
  }
  return adj;
}

/**
 * BFS from `startKey`.  Returns a Map of every reachable tile → distance.
 * If the map is connected, `result.size === tileSet.size`.
 */
export function bfsDistances(
  adjacency: Map<string, string[]>,
  startKey:  string,
): Map<string, number> {
  const dist  = new Map<string, number>([[startKey, 0]]);
  const queue = [startKey];
  for (let head = 0; head < queue.length; head++) {
    const curr = queue[head];
    const d    = dist.get(curr)!;
    for (const nk of (adjacency.get(curr) ?? [])) {
      if (!dist.has(nk)) { dist.set(nk, d + 1); queue.push(nk); }
    }
  }
  return dist;
}

// ── Tile selection ────────────────────────────────────────────────────────────

/**
 * Minimum gate graph-distance for `targetCount` tiles.
 *
 * Calibrated to the typical BFS diameter of a portrait-biased map:
 *   30 tiles → 6   (diameter ~8–10, gate at ~70% of that)
 *   40 tiles → 8   (diameter ~10–14)
 *   55 tiles → 12
 *
 * Up to 100 cells, 0.22 × N keeps the requirement achievable while still
 * ensuring the gate is meaningfully distant from the start. Larger maps retain
 * the same compact growth profile, so their diameter grows with √N rather than
 * linearly; use a scale-aware floor there to avoid rejecting every valid map.
 */
function minGateDistance(targetCount: number): number {
  if (targetCount <= 100) {
    return Math.max(4, Math.floor(targetCount * 0.22));
  }
  return Math.max(4, Math.floor(Math.sqrt(targetCount) * 2));
}

/**
 * Choose the start tile from the bottom 30 % of the map (highest r values),
 * preferring tiles near the horizontal centre (smallest |q|).
 */
function chooseLowerStartTile(coords: AxialCoord[]): AxialCoord {
  const sorted    = [...coords].sort((a, b) => b.r - a.r || Math.abs(a.q) - Math.abs(b.q));
  const poolSize  = Math.max(3, Math.ceil(sorted.length * 0.30));
  const pool      = sorted.slice(0, poolSize);
  pool.sort((a, b) => Math.abs(a.q) - Math.abs(b.q) || b.r - a.r);
  return pool[0];
}

/**
 * Choose the gate anchor from tiles that are:
 *  • ≥ minGateDistance from start by graph distance
 *  • not adjacent to start
 *  • preferably above start (lower r value)
 *  • preferably far from start (highest graph distance)
 *  • preferably horizontally centred
 */
function chooseGateAnchorTile(
  coords:   AxialCoord[],
  distances: Map<string, number>,
  start:    AxialCoord,
  tileSet:  Set<string>,
): AxialCoord | null {
  const startKey          = axialKey(start.q, start.r);
  const startNeighborKeys = new Set(
    axialNeighborKeys(start.q, start.r).filter(k => tileSet.has(k)),
  );
  const minDist = minGateDistance(tileSet.size);

  const candidates = coords.filter(t => {
    const k = axialKey(t.q, t.r);
    return (
      k !== startKey &&
      !startNeighborKeys.has(k) &&
      (distances.get(k) ?? 0) >= minDist
    );
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const da     = distances.get(axialKey(a.q, a.r)) ?? 0;
    const db     = distances.get(axialKey(b.q, b.r)) ?? 0;
    // 1. Tiles visually above start (lower r) are strongly preferred.
    const aAbove = a.r < start.r ? 1 : 0;
    const bAbove = b.r < start.r ? 1 : 0;
    if (aAbove !== bAbove) return bAbove - aAbove;
    // 2. Farther from start is better.
    if (db !== da) return db - da;
    // 3. More centred horizontally.
    return Math.abs(a.q) - Math.abs(b.q);
  });

  return candidates[0];
}

// ── Validity check ────────────────────────────────────────────────────────────

function isValidTopology(
  tileSet:        Set<string>,
  distances:       Map<string, number>,
  gateKey:         string,
  targetCount:     number,
  maxWidthAllowed: number,
): boolean {
  // 1. Exact tile count.
  if (tileSet.size !== targetCount) return false;

  // 2. Fully connected — every tile must be reachable from start.
  if (distances.size !== tileSet.size) return false;

  // 3. Gate tile exists and is reachable.
  if (!distances.has(gateKey)) return false;

  // 4. Gate is meaningfully far from start.
  if ((distances.get(gateKey) ?? 0) < minGateDistance(targetCount)) return false;

  // 5. Map width is within bounds (20 % slack over the soft limit).
  let minQ = 0, maxQ = 0;
  for (const k of tileSet) {
    const { q } = parseKey(k);
    if (q < minQ) minQ = q;
    if (q > maxQ) maxQ = q;
  }
  if ((maxQ - minQ) > Math.ceil(maxWidthAllowed * 1.4)) return false;

  return true;
}

/**
 * Build a deterministic, narrow portrait fallback for the rare case where
 * every weighted-growth attempt fails validation.
 *
 * The rows all include q=0, so the result is connected by construction. The
 * row count is derived from the existing gate-distance rule, rather than
 * weakening that rule for the fallback. Seeded row-width placement keeps
 * fallback maps deterministic while still allowing different seeds to make
 * different silhouettes.
 */
function buildFallbackTileSet(
  targetCount: number,
  maxWidth:    number,
  baseSeed:    number,
): Set<string> | null {
  const rowCount    = minGateDistance(targetCount) + 1;
  const baseWidth   = Math.floor(targetCount / rowCount);
  const extraRows   = targetCount % rowCount;
  const maxRowWidth = Math.ceil(maxWidth * 1.4) + 1;

  if (baseWidth < 1 || baseWidth + (extraRows > 0 ? 1 : 0) > maxRowWidth) {
    return null;
  }

  const rowWidths = Array<number>(rowCount).fill(baseWidth);
  const rowOrder  = Array.from({ length: rowCount }, (_, index) => index);
  const rng       = mulberry32((baseSeed ^ 0x9e3779b9) >>> 0);

  // Fisher-Yates gives a deterministic distribution of the remainder rows.
  for (let i = rowOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rowOrder[i], rowOrder[j]] = [rowOrder[j], rowOrder[i]];
  }
  for (let i = 0; i < extraRows; i++) {
    rowWidths[rowOrder[i]]++;
  }

  const tileSet = new Set<string>();
  for (let r = 0; r < rowCount; r++) {
    const width = rowWidths[r];
    const minQ  = -Math.floor(width / 2);
    for (let q = minQ; q < minQ + width; q++) {
      tileSet.add(axialKey(q, r));
    }
  }

  return tileSet.size === targetCount ? tileSet : null;
}

// ── Main export ───────────────────────────────────────────────────────────────

const MAX_RETRIES = 60;

/**
 * Generate a deterministic, connected hex-map topology.
 *
 * Guaranteed properties:
 *  • `tiles.length === getChapterTerrainCellCount(chapter)`
 *  • All tiles form one connected component (verified by BFS).
 *  • No duplicate coordinates.
 *  • `startTileId` and `gateAnchorId` are valid keys present in `tiles`.
 *  • `graphDistances.get(gateAnchorId) >= minGateDistance(tileCount)`.
 *  • Same `chapter` + `seed` always produces identical output.
 *  • Different seeds normally produce different output.
 *
 * A deterministic validator-checked fallback is used if all retry attempts
 * fail, so supported chapter/seed combinations never fail due to randomness.
 */
export function generateHexTopology({
  chapter,
  seed,
}: GenerateTopologyOptions): HexTopology {
  const targetCount = getChapterTerrainCellCount(chapter);
  const baseSeed    = toNumericSeed(chapter, seed);
  // Width budget: tighter than a square root of N so the map grows tall.
  // √(N × 0.75) gives: 30→5, 35→5, 40→6, 50→7, 55→7.
  const maxWidth    = Math.max(5, Math.ceil(Math.sqrt(targetCount * 0.75)));

  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    // Deterministically derive a distinct PRNG stream per retry.
    // Knuth's multiplicative hash mixes the retry index with the base seed.
    const rng = mulberry32((baseSeed + retry * 2_654_435_761) >>> 0);

    // ── Grow the tile set from (0, 0) ──────────────────────────────────────
    const tileSet  = new Set<string>([axialKey(0, 0)]);
    const frontier = new Set<string>(axialNeighborKeys(0, 0));

    let minQ = 0, maxQ = 0;

    while (tileSet.size < targetCount) {
      if (frontier.size === 0) break; // shouldn't happen; signals a bug

      const candidates: AxialCoord[] = [];
      for (const k of frontier) candidates.push(parseKey(k));

      const chosen = weightedPick(
        candidates,
        ({ q, r }) =>
          compactnessWeight(q, r, tileSet) *
          portraitBiasWeight(q, r) *
          widthWeight(q, minQ, maxQ, maxWidth),
        rng,
      );

      const ck = axialKey(chosen.q, chosen.r);
      tileSet.add(ck);
      frontier.delete(ck);

      if (chosen.q < minQ) minQ = chosen.q;
      if (chosen.q > maxQ) maxQ = chosen.q;

      for (const nk of axialNeighborKeys(chosen.q, chosen.r)) {
        if (!tileSet.has(nk)) frontier.add(nk);
      }
    }

    if (tileSet.size !== targetCount) continue;

    // ── Graph analysis ─────────────────────────────────────────────────────
    const coords     = [...tileSet].map(parseKey);
    const adjacency  = buildAdjacency(tileSet);
    const start      = chooseLowerStartTile(coords);
    const startKey   = axialKey(start.q, start.r);
    const distances  = bfsDistances(adjacency, startKey);
    const gate       = chooseGateAnchorTile(coords, distances, start, tileSet);

    if (!gate) continue;
    const gateKey = axialKey(gate.q, gate.r);

    if (!isValidTopology(tileSet, distances, gateKey, targetCount, maxWidth)) {
      continue;
    }

    return {
      chapter,
      seed,
      tiles:          coords,
      startTileId:    startKey,
      gateAnchorId:   gateKey,
      graphDistances: distances,
    };
  }

  // Retry exhaustion must not make a valid chapter/seed unusable. Build a
  // connected portrait map from the same count/width inputs, then pass it
  // through the same start, gate, and validity checks as stochastic maps.
  const fallbackTileSet = buildFallbackTileSet(targetCount, maxWidth, baseSeed);
  if (fallbackTileSet) {
    const fallbackCoords    = [...fallbackTileSet].map(parseKey);
    const fallbackAdjacency = buildAdjacency(fallbackTileSet);
    const fallbackStart     = chooseLowerStartTile(fallbackCoords);
    const fallbackStartKey  = axialKey(fallbackStart.q, fallbackStart.r);
    const fallbackDistances  = bfsDistances(fallbackAdjacency, fallbackStartKey);
    const fallbackGate       = chooseGateAnchorTile(
      fallbackCoords,
      fallbackDistances,
      fallbackStart,
      fallbackTileSet,
    );

    if (fallbackGate) {
      const fallbackGateKey = axialKey(fallbackGate.q, fallbackGate.r);
      if (isValidTopology(
        fallbackTileSet,
        fallbackDistances,
        fallbackGateKey,
        targetCount,
        maxWidth,
      )) {
        return {
          chapter,
          seed,
          tiles:          fallbackCoords,
          startTileId:    fallbackStartKey,
          gateAnchorId:   fallbackGateKey,
          graphDistances: fallbackDistances,
        };
      }
    }
  }

  throw new Error(
    `generateHexTopology: no valid map after ${MAX_RETRIES} retries or ` +
    `fallback validation (chapter=${chapter}, seed=${String(seed)})`,
  );
}
