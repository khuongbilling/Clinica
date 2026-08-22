/**
 * journeyMap/encounters.ts — PUSH 7
 *
 * Deterministic encounter and chest-tier assignment for fog-map journey tiles.
 *
 * Given a topology (from topology.ts), a chapter number, and an arbitrary seed,
 * this module assigns an EncounterType to every playable tile and a ChestTier to
 * every treasure tile using the chapter-calibrated rates from config.ts.
 *
 * Design rules
 * ────────────
 * 1.  Start tile  → always 'none'.
 * 2.  Gate tile   → always 'boss' (chapter-boss encounter, never rolled).
 * 3.  All other tiles get exactly one EncounterType: none|battle|treasure|merchant|areaBoss.
 * 4.  Encounters are rolled using the chapter's configured basis-point rates.
 * 5.  Caps are enforced after rolling; excess tiles are converted to 'none'
 *     by a seeded Fisher-Yates selection (same PRNG stream → deterministic).
 *         areaBoss  cap = 3
 *         treasure  cap = getTreasureCap(chapter)
 *         merchant  cap = getMerchantCap(chapter)
 * 6.  Area-boss placement constraints (applied after capping):
 *       a. Not adjacent to the start tile (hard — violators are removed and
 *          the module tries to re-place them deeper).
 *       b. Prefer the deeper half of the map (high graphDistances from start).
 *       c. Soft: two areaBoss tiles should not neighbour each other when a
 *          non-adjacent swap candidate exists.
 * 7.  Treasure tiles each receive a ChestTier ('bronze'|'silver'|'gold')
 *     drawn from the chapter's chest-tier distribution.
 * 8.  Same chapter + seed + topology → identical output every time.
 * 9.  Zero-areaBoss runs are valid; gate unlocks when discovered.
 *
 * PRNG namespace
 * ─────────────
 * The RNG stream is seeded as fnv1a32(`${seed}:encounters`) so it is always
 * independent from the topology stream (fnv1a32(`ch${chapter}:${seed}`)).
 */

import { mulberry32, fnv1a32 } from './prng';
import type { HexTopology } from './topology';
import {
  getEncounterRatesBp,
  getChestTierRatesBp,
  getTreasureCap,
  getMerchantCap,
  getAreaBossCap,
} from './config';
import type { EncounterType, ChestTier } from './types';
import { isEliteBattle } from './encounterResolution';

// ── Public types ──────────────────────────────────────────────────────────────

/** A single tile with its assigned encounter and optional chest tier. */
export interface AssignedTile {
  /** Axial key "q,r". */
  readonly tileKey: string;
  readonly q: number;
  readonly r: number;
  encounter: EncounterType;
  /** Only defined when encounter === 'treasure'. */
  chestTier?: ChestTier;
  isElite?: boolean;
}

export interface EncounterAssignment {
  tiles: AssignedTile[];
  /**
   * How many areaBoss tiles are in this run.
   * Equals the number of Chapter Boss keys required to open the gate.
   * May be 0 — in that case the gate unlocks on discovery.
   */
  areaBossCount: number;
}

export interface AssignEncountersOptions {
  chapter: number;
  seed:    string | number;
  topology: HexTopology;
}

// ── Axial directions ──────────────────────────────────────────────────────────

const AXIAL_DIRS = [
  { q:  1, r:  0 }, { q: -1, r:  0 },
  { q:  0, r:  1 }, { q:  0, r: -1 },
  { q:  1, r: -1 }, { q: -1, r:  1 },
] as const;

// ── Internal helpers ──────────────────────────────────────────────────────────

function tileNeighborKeys(tileKey: string, tileSet: ReadonlySet<string>): string[] {
  const c = tileKey.indexOf(',');
  const q = Number(tileKey.slice(0, c));
  const r = Number(tileKey.slice(c + 1));
  return AXIAL_DIRS
    .map(d => `${q + d.q},${r + d.r}`)
    .filter(k => tileSet.has(k));
}

/** In-place Fisher-Yates shuffle using the seeded RNG. */
function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
}

/**
 * Weighted random selection from a rates map (basis-point values).
 * The generic parameter is inferred from the record keys, so the return type
 * is tightly typed to the key union of `rates`.
 */
function weightedRoll<K extends string>(
  rates: Record<K, number>,
  rng: () => number,
): K {
  const entries = Object.entries(rates) as Array<[K, number]>;
  const total   = entries.reduce((s, [, v]) => s + v, 0);
  let x = rng() * total;
  for (const [key, val] of entries) {
    x -= val;
    if (x <= 0) return key;
  }
  // Floating-point rounding may leave x slightly > 0; return last key.
  return entries[entries.length - 1][0];
}

/**
 * After rolling, enforce that no more than `cap` tiles have `encounterType`.
 * Excess tiles are chosen uniformly at random (seeded) and set to 'none'.
 * Tiles in `frozenKeys` (start, gate) are never touched.
 */
function enforceCap(
  tiles: AssignedTile[],
  encounterType: EncounterType,
  cap: number,
  rng: () => number,
  frozenKeys: ReadonlySet<string>,
): void {
  const matching = tiles.filter(
    t => t.encounter === encounterType && !frozenKeys.has(t.tileKey),
  );
  if (matching.length <= cap) return;

  shuffleInPlace(matching, rng);
  const excess = matching.length - cap;
  for (let i = 0; i < excess; i++) {
    matching[i].encounter = 'none';
  }
}

function medianValue(distances: Map<string, number>): number {
  const vals = [...distances.values()].sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)] ?? 0;
}

/**
 * Fix area-boss placement after capping.
 *
 * Pass 1 (hard): Remove any areaBoss that landed on a start-adjacent tile.
 *   → Try to re-place each removed boss on a valid deep tile.
 *
 * Pass 2 (soft): Break areaBoss↔areaBoss adjacency when a swap exists.
 */
function fixAreaBossPlacement({
  tiles,
  startTileId,
  gateAnchorId,
  graphDistances,
  rng,
}: {
  tiles:          AssignedTile[];
  startTileId:    string;
  gateAnchorId:   string;
  graphDistances: Map<string, number>;
  rng:            () => number;
}): void {
  const tileSet     = new Set(tiles.map(t => t.tileKey));
  const frozenKeys  = new Set([startTileId, gateAnchorId]);
  const startAdj    = new Set(tileNeighborKeys(startTileId, tileSet));

  // ── Pass 1: enforce hard "not adjacent to start" constraint ────────────────
  let removedCount = 0;
  for (const tile of tiles) {
    if (tile.encounter === 'areaBoss' && startAdj.has(tile.tileKey)) {
      tile.encounter = 'none';
      removedCount++;
    }
  }

  if (removedCount > 0) {
    const median = medianValue(graphDistances);

    // Build pool of candidates for re-placement:
    //   • not frozen (start / gate)
    //   • not adjacent to start
    //   • not already areaBoss
    const candidates = tiles.filter(
      t =>
        !frozenKeys.has(t.tileKey) &&
        !startAdj.has(t.tileKey) &&
        t.encounter !== 'areaBoss',
    );

    // Deterministic shuffle first, then stable-sort by depth (deep = preferred).
    shuffleInPlace(candidates, rng);
    candidates.sort((a, b) => {
      const da = graphDistances.get(a.tileKey) ?? 0;
      const db = graphDistances.get(b.tileKey) ?? 0;
      // Deeper-half tiles sort first; within same half, farther sorts first.
      const aDeep = da >= median ? 1 : 0;
      const bDeep = db >= median ? 1 : 0;
      if (bDeep !== aDeep) return bDeep - aDeep;
      return db - da;
    });

    const toPlace = Math.min(removedCount, candidates.length);
    for (let i = 0; i < toPlace; i++) {
      candidates[i].encounter = 'areaBoss';
    }
  }

  // ── Pass 2: soft adjacency-between-bosses constraint ─────────────────────
  // Rebuild the live boss key set after Pass 1 modifications.
  const bossKeys = new Set(
    tiles.filter(t => t.encounter === 'areaBoss').map(t => t.tileKey),
  );

  for (const tile of tiles) {
    if (tile.encounter !== 'areaBoss') continue;
    if (!bossKeys.has(tile.tileKey))   continue; // already swapped away

    const adjBossKeys = tileNeighborKeys(tile.tileKey, tileSet).filter(k => bossKeys.has(k));
    if (adjBossKeys.length === 0) continue;

    // Find a swap candidate: not frozen, not start-adjacent, not areaBoss,
    // and after the swap it would not neighbour any remaining boss.
    const remainingBossKeys = new Set([...bossKeys].filter(k => k !== tile.tileKey));
    const swapTarget = tiles.find(
      t =>
        !frozenKeys.has(t.tileKey) &&
        !startAdj.has(t.tileKey) &&
        !bossKeys.has(t.tileKey) &&
        tileNeighborKeys(t.tileKey, tileSet).every(k => !remainingBossKeys.has(k)),
    );

    if (swapTarget) {
      swapTarget.encounter = 'areaBoss';
      tile.encounter       = 'none';
      bossKeys.delete(tile.tileKey);
      bossKeys.add(swapTarget.tileKey);
    }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Assign encounter types and chest tiers to all tiles in a topology.
 *
 * Pure and deterministic: same inputs → same outputs, always.
 * Does not modify the supplied topology object.
 */
export function assignJourneyEncounters({
  chapter,
  seed,
  topology,
}: AssignEncountersOptions): EncounterAssignment {
  // Namespace the RNG away from the topology stream.
  const rng         = mulberry32(fnv1a32(`${seed}:encounters`));
  const rates       = getEncounterRatesBp(chapter);
  const frozenKeys  = new Set([topology.startTileId, topology.gateAnchorId]);

  // ── Step 1: roll encounter types ─────────────────────────────────────────
  const tiles: AssignedTile[] = topology.tiles.map(coord => {
    const tileKey = `${coord.q},${coord.r}`;
    if (frozenKeys.has(tileKey)) {
      // Start tile → always 'none'.
      // Gate tile  → always 'boss' (chapter-boss encounter, never rolled).
      const encounter: EncounterType =
        tileKey === topology.gateAnchorId ? 'boss' : 'none';
      return { tileKey, q: coord.q, r: coord.r, encounter };
    }
    return {
      tileKey,
      q:         coord.q,
      r:         coord.r,
      encounter: weightedRoll(rates, rng),
    };
  });

  // ── Step 2: enforce caps (mutates tiles in place) ─────────────────────────
  enforceCap(tiles, 'areaBoss', getAreaBossCap(),           rng, frozenKeys);
  enforceCap(tiles, 'treasure', getTreasureCap(chapter),    rng, frozenKeys);
  enforceCap(tiles, 'merchant', getMerchantCap(chapter),    rng, frozenKeys);

  // ── Step 3: fix area-boss placement constraints ───────────────────────────
  fixAreaBossPlacement({
    tiles,
    startTileId:    topology.startTileId,
    gateAnchorId:   topology.gateAnchorId,
    graphDistances: topology.graphDistances,
    rng,
  });

  // ── Step 4: assign chest tiers to every treasure tile ─────────────────────
  const chestRates = getChestTierRatesBp(chapter);
  for (const tile of tiles) {
    if (tile.encounter === 'treasure') {
      tile.chestTier = weightedRoll(chestRates, rng);
    }
    if (tile.encounter === 'battle') {
      tile.isElite = isEliteBattle(String(seed), tile.tileKey, chapter);
    }
  }

  const areaBossCount = tiles.filter(t => t.encounter === 'areaBoss').length;

  return { tiles, areaBossCount };
}
