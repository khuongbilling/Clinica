/**
 * fogTileMap.ts — Data contracts for the Fogbound Tile Map mode.
 *
 * Used by the FogboundTileMap renderer (Push 9).
 * All fog-reveal / movement / battle-trigger game logic is OUT OF SCOPE for
 * Push 9 — only the data shapes, config factory, and display constants ship here.
 *
 * Determinism rule (from realm-terrain-textures memory):
 *   getDefaultFogMapConfig MUST derive tile layout from a hash of chapter.id —
 *   never from Math.random() — so refreshing the screen does not reshuffle tiles.
 */

import type { Chapter } from './chapterJourney';

// ── Tile type ─────────────────────────────────────────────────────────────────

export type TileType =
  | 'battle'
  | 'treasure'
  | 'merchant'
  | 'area_boss'
  | 'boss_gate'
  | 'empty';

// ── Tile shape ────────────────────────────────────────────────────────────────

export interface FogTile {
  /** Unique tile id within this map, e.g. "tile_0_3". */
  id: string;
  type: TileType;
  /** Zero-based row in the hex grid. */
  row: number;
  /** Zero-based column in the hex grid. */
  col: number;
  /** Whether the player has revealed this tile (adjacent rule — stub false for now). */
  revealed: boolean;
  /** Whether the player has already visited / cleared this tile. */
  visited: boolean;
  /** If true, this tile holds a Chapter Key Fragment collectible. */
  keyFragment?: boolean;
}

// ── Tile outcome display config ───────────────────────────────────────────────

export interface TileOutcomeConfig {
  type: TileType;
  icon: string;          // Ionicons glyph name
  label: string;
  description: string;
  accentColor: string;
}

/**
 * Legend bar displayed below the hex grid so players know what each tile icon means.
 * Only the four playable types are shown (boss_gate and empty are not in the legend).
 */
export const TILE_OUTCOMES: TileOutcomeConfig[] = [
  {
    type:        'battle',
    icon:        'flash',
    label:       'Battle',
    description: 'A Ward Shift encounter. Defeat the disease-spirit to progress.',
    accentColor: '#EF4444',
  },
  {
    type:        'treasure',
    icon:        'gift',
    label:       'Treasure',
    description: 'A supply cache. Collect Ward Coins, Codex Shards, or items.',
    accentColor: '#D4AF37',
  },
  {
    type:        'merchant',
    icon:        'storefront',
    label:       'Merchant',
    description: 'Trade post. Exchange Ward Coins for consumables at special rates.',
    accentColor: '#4FD8C4',
  },
  {
    type:        'area_boss',
    icon:        'skull',
    label:       'Area Boss',
    description: 'A powerful sub-boss guarding this map zone. Drops key fragments.',
    accentColor: '#F97316',
  },
];

// ── Merchant rate config ──────────────────────────────────────────────────────

/**
 * Merchant rates for the Fogbound Tile Map.
 * Maps item category → Ward Coin cost at a Merchant tile.
 * All rates are stubs for Push 9 — real inventory and dynamic pricing
 * will be wired in a future push.
 */
export const MERCHANT_RATES: Record<string, number> = {
  health_tonic:        30,   // Restores stability during the next battle
  stabilize_charm:     50,   // +10 stability on battle start
  ward_shield:         45,   // Absorbs one corruption tick
  diagnosis_scroll:    35,   // Reveals a hidden clinical cue in battle
  assessment_kit:      60,   // +1 AP on first turn
  antidote_vial:       40,   // Removes a corruption stack
};

// ── Fog map config ────────────────────────────────────────────────────────────

export interface ChapterFogMapConfig {
  chapterId: string;
  /** Total tiles in the grid (target ~50). */
  totalTiles: number;
  /** Number of key fragments needed to unlock the Chapter Boss Gate. */
  keyFragmentsRequired: number;
  tiles: FogTile[];
}

// ── Deterministic pseudo-random helper ───────────────────────────────────────

/**
 * Produces a stable integer hash from a string.
 * Used to generate deterministic tile layouts from chapter.id.
 * MUST NOT use Math.random() — see fogTileMap.ts module docstring.
 */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    // eslint-disable-next-line no-bitwise
    h = (h * 33) ^ s.charCodeAt(i);
  }
  // eslint-disable-next-line no-bitwise
  return h >>> 0;
}

/** Seeded LCG: deterministic [0, 1) float from a seed + index. */
function deterministicFloat(seed: number, idx: number): number {
  // LCG parameters (Numerical Recipes)
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 32;
  // eslint-disable-next-line no-bitwise
  const v = ((a * (seed + idx * 6364136223846793005)) + c) % m;
  return Math.abs(v) / m;
}

// ── Tile type distribution weights ───────────────────────────────────────────

const TYPE_WEIGHTS: { type: TileType; weight: number }[] = [
  { type: 'battle',   weight: 40 },
  { type: 'treasure', weight: 25 },
  { type: 'merchant', weight: 15 },
  { type: 'area_boss',weight: 10 },
  { type: 'empty',    weight: 10 },
];

const TOTAL_WEIGHT = TYPE_WEIGHTS.reduce((s, t) => s + t.weight, 0);

function pickTileType(seed: number, idx: number): TileType {
  let r = deterministicFloat(seed, idx) * TOTAL_WEIGHT;
  for (const { type, weight } of TYPE_WEIGHTS) {
    r -= weight;
    if (r <= 0) return type;
  }
  return 'battle';
}

// ── Config factory ────────────────────────────────────────────────────────────

/**
 * Generates a deterministic placeholder fog-map grid for a chapter.
 * Layout: 7 columns × 8 rows = 56 tiles; one boss_gate tile is injected at
 * the top-centre (row 0, col 3) and excluded from the random pool.
 *
 * Key fragment tiles: every Nth area_boss tile (where N derives from
 * chapter.id) also sets keyFragment: true.
 *
 * Reveal state: the player-start tile (row 7, col 3) plus its immediate
 * neighbours are pre-revealed; all others start fogged.
 */
export function getDefaultFogMapConfig(chapter: Chapter): ChapterFogMapConfig {
  const COLS = 7;
  const ROWS = 8;
  const TOTAL = COLS * ROWS;        // 56
  const KEY_FRAGS_REQUIRED = 3;

  const seed = hashString(chapter.id);

  // Pre-compute which tiles are revealed at start (player position + neighbours).
  // Player starts at bottom-centre: row 7, col 3.
  const START_ROW = ROWS - 1;
  const START_COL = Math.floor(COLS / 2);

  function isStartNeighbour(row: number, col: number): boolean {
    const dr = Math.abs(row - START_ROW);
    const dc = Math.abs(col - START_COL);
    return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
  }

  const tiles: FogTile[] = [];
  let keyFragCount = 0;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const idx = row * COLS + col;
      const id  = `tile_${row}_${col}`;

      // Boss gate occupies the top-centre tile
      const isBossGate = row === 0 && col === Math.floor(COLS / 2);
      // Player start
      const isStart    = row === START_ROW && col === START_COL;

      let type: TileType;
      if (isBossGate) {
        type = 'boss_gate';
      } else if (isStart) {
        type = 'empty'; // player standing tile shows as empty
      } else {
        type = pickTileType(seed, idx);
      }

      const revealed = isStart || isStartNeighbour(row, col) || isBossGate;
      const visited  = isStart;

      // Give key fragments to the first KEY_FRAGS_REQUIRED area_boss tiles
      let keyFragment = false;
      if (type === 'area_boss' && keyFragCount < KEY_FRAGS_REQUIRED) {
        keyFragment = true;
        keyFragCount++;
      }

      tiles.push({ id, type, row, col, revealed, visited, keyFragment });
    }
  }

  return {
    chapterId:            chapter.id,
    totalTiles:           TOTAL,
    keyFragmentsRequired: KEY_FRAGS_REQUIRED,
    tiles,
  };
}
