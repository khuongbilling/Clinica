/**
 * journeyMap/types.ts
 *
 * Domain contracts for the fog-map chapter experience (Push 1).
 * These types are intentionally isolated from the existing VisualMap/JourneyScreen
 * implementation — they describe the NEW tile-based runtime state only.
 *
 * No imports from React, Expo, or any UI layer belong here.
 */

// ── Primitives ───────────────────────────────────────────────────────────────

/** Semantic alias: integer basis points where 10 000 = 100%, 100 = 1%. */
export type BasisPoints = number;

/** Axial hex coordinates (q = column, r = row). */
export interface AxialCoord {
  readonly q: number;
  readonly r: number;
}

// ── Encounter ────────────────────────────────────────────────────────────────

export type EncounterType =
  | 'none'
  | 'battle'
  | 'treasure'
  | 'merchant'
  | 'areaBoss';

// ── Chest ────────────────────────────────────────────────────────────────────

export type ChestTier = 'bronze' | 'silver' | 'gold';

// ── Tile visibility ──────────────────────────────────────────────────────────

/**
 * hidden   — player cannot see the tile at all
 * frontier — adjacent to a revealed tile; shown as a dim silhouette
 * revealed — player has line-of-sight or has explored an adjacent tile
 */
export type TileVisibility = 'hidden' | 'frontier' | 'revealed';

// ── Run status ───────────────────────────────────────────────────────────────

export type JourneyRunStatus = 'active' | 'cleared';

// ── Tile ─────────────────────────────────────────────────────────────────────

export interface JourneyTile {
  /** Stable unique tile identifier within this run, e.g. "tile_0_3". */
  readonly id: string;

  /** Axial hex column. */
  readonly q: number;

  /** Axial hex row. */
  readonly r: number;

  /** What encounter (if any) this tile holds. */
  encounter: EncounterType;

  /**
   * Quality of the chest this tile grants.
   * Only set when encounter === 'treasure'; undefined otherwise.
   */
  chestTier?: ChestTier;

  /** Fog visibility state. */
  visibility: TileVisibility;

  /** Player has moved through this tile at least once. */
  visited: boolean;

  /**
   * The encounter on this tile has been completed (battle won, chest looted,
   * merchant used, area-boss defeated).
   */
  resolved: boolean;

  /** The player token is currently on this tile. */
  current: boolean;

  /** Shortest-path distance from the start tile (BFS, unweighted). */
  graphDistanceFromStart: number;

  /**
   * The area-boss key on this tile has been claimed.
   * Only meaningful when encounter === 'areaBoss'.
   */
  areaBossKeyClaimed: boolean;

  /** The tile's post-encounter reward has been claimed. */
  rewardClaimed: boolean;
}

// ── Run ──────────────────────────────────────────────────────────────────────

export interface JourneyRun {
  /** Stable UUID assigned by the server on creation. */
  readonly id: string;

  /** Increment when the shape of this object changes to detect stale saves. */
  readonly schemaVersion: number;

  readonly playerId: string;
  readonly chapterId: number;

  /** Monotonically incrementing attempt number for this chapter (1-based). */
  readonly attemptNumber: number;

  /**
   * Cryptographically random hex seed used for deterministic map generation.
   * Fixed for the lifetime of the run — never changes, never re-rolled.
   */
  readonly seed: string;

  status: JourneyRunStatus;

  readonly createdAt: string; // ISO-8601
  updatedAt: string;          // ISO-8601

  /** Total playable hex tiles (does NOT include the chapter-boss gate tile). */
  readonly tileCount: number;

  tiles: JourneyTile[];

  /** id of the starting tile. */
  readonly startTileId: string;

  /** id of the tile the player is currently on. */
  currentTileId: string;

  /**
   * id of the chapter-boss gate anchor tile (the decorative non-playable tile
   * at the end of the map).  Undefined until the map generator places it.
   */
  gateAnchorTileId?: string;

  // ── Derived progress counters (denormalised for cheap reads) ──────────────

  /** How many area-boss tiles were placed in this run. */
  areaBossCount: number;

  /** How many area-boss keys the player has collected so far this run. */
  areaBossKeysCollected: number;

  /** Whether the chapter boss (gate encounter) has been defeated. */
  chapterBossDefeated: boolean;

  /** Count of tiles whose visibility !== 'hidden'. */
  exploredTileCount: number;

  /** Total stamina spent on encounters in this run. */
  staminaSpent: number;
}
