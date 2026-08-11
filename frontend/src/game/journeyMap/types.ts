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

// ── Shift (time of day) ───────────────────────────────────────────────────────

/**
 * The shift (time of day) at which a journey run is created.
 * Frozen for the lifetime of the run — determines ward event subtype distribution
 * and enemy density caps throughout the chapter.
 *
 * Canonical mapping (local device time at run-creation):
 *   day     →  06:00–13:59
 *   evening →  14:00–21:59
 *   night   →  22:00–05:59
 */
export type TimeOfDay = 'day' | 'evening' | 'night';

// ── Encounter ────────────────────────────────────────────────────────────────

export type EncounterType =
  | 'none'
  | 'battle'
  | 'treasure'
  | 'merchant'
  | 'areaBoss'
  /**
   * Push 20: ward event tile — a non-combat clinical encounter.
   * Subtype is carried on tile.wardEventSubtype (WardEventSubtype).
   * World-object prop selected by encounterMapNode() → MAP_NODE.ward*.
   */
  | 'wardEvent'
  /**
   * Assigned exclusively to the chapter-boss gate tile.
   * Not rolled randomly — set by the run factory; never appears on playable tiles.
   */
  | 'boss';

// ── Chest ────────────────────────────────────────────────────────────────────

export type ChestTier = 'bronze' | 'silver' | 'gold';

// ── Ward Event subtype ────────────────────────────────────────────────────────

/**
 * Sub-classification of a wardEvent tile.  Assigned once at map-generation
 * time and persisted on the tile; NEVER rerolled on revisit.
 *
 * The three "interaction" subtypes are shift-exclusive:
 *   patient_family_team   → Day only
 *   handoff_patient       → Evening only
 *   surveillance_patient  → Night only
 *
 * All other five subtypes appear across every shift at varying weights.
 */
export type WardEventSubtype =
  | 'support_ally'          // Ally NPC offers assistance
  | 'protocol_card'         // Clinical protocol card available
  | 'ward_blessing'         // Passive positive ward effect
  | 'patient_family_team'   // Daytime interaction event
  | 'handoff_patient'       // Evening shift-change / patient check
  | 'surveillance_patient'  // Night monitoring event
  | 'resource_service'      // Equipment or service encounter
  | 'ward_hazard';          // Environmental or clinical hazard

// ── Run inventory types ───────────────────────────────────────────────────────

/**
 * A Protocol Card collected from a ward_event tile during a journey run.
 * Cards are picked up when a 'protocol_card' ward event is resolved and may
 * be used to unlock bonus effects in subsequent encounters.
 */
export interface JourneyCard {
  /** Unique id within this run (deterministic: e.g. "card:<sourceTileId>"). */
  readonly id:           string;
  /** Tile this card came from. */
  readonly sourceTileId: string;
  /** Tile where the card was spent, if already used. */
  usedAtTileId?:         string;
}

/**
 * A Ward Blessing active during this run.
 * Blessings are granted by 'ward_blessing' ward event tiles and provide
 * passive bonuses (e.g. stability regen, reduced corruption) for the run.
 */
export interface JourneyBlessing {
  /** Unique id within this run. */
  readonly id:           string;
  /** Tile this blessing came from. */
  readonly sourceTileId: string;
}

// ── Tile visibility ──────────────────────────────────────────────────────────

/**
 * hidden   — player cannot see the tile at all
 * frontier — adjacent to a revealed tile; shown as a dim silhouette
 * revealed — player has line-of-sight or has explored an adjacent tile
 */
/**
 * Three-state fog-of-war visibility model (spec rule 5):
 *   unexplored          — never seen; fully fogged, non-interactive
 *   visibleNow          — within the player's current reveal radius; fog-free, interactive
 *   exploredButOutOfVision — visited at least once but outside current reveal radius;
 *                          permanently uncovered, interactive
 */
export type TileVisibility = 'unexplored' | 'visibleNow' | 'exploredButOutOfVision';

// ── Run status ───────────────────────────────────────────────────────────────

export type JourneyRunStatus = 'active' | 'cleared' | 'abandoned';

// ── Terrain visual variant ────────────────────────────────────────────────────

/**
 * Cosmetic surface appearance for a tile with encounter === 'none'.
 *
 * Rules:
 *   • Only assigned to 'none' encounter tiles — encounter tiles use their own
 *     encounter icon as the visual distinguisher.
 *   • Deterministic for the current run (seeded from run seed + tile key).
 *   • Has NO effect on traversal, movement, stamina cost, encounter probability,
 *     fog behaviour, BFS, or any other gameplay system.
 *   • Not displayed to the player as a label — purely a visual surface hint for
 *     the terrain renderer.
 *
 * Variants describe the surface texture/decoration of an empty terrain hex:
 *   plain    — default stone/floor with no added detail
 *   cracked  — fractured tile surface
 *   moss     — organic growth between stone seams
 *   rune     — faint engraved hospital-seal glyph
 *   flowers  — small botanical cluster at tile centre
 *   lantern  — unlit wall-mounted lantern bracket
 *   debris   — scattered medical supply fragments
 */
export type TerrainVisualVariant =
  | 'plain'
  | 'cracked'
  | 'moss'
  | 'rune'
  | 'flowers'
  | 'lantern'
  | 'debris';

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

  /**
   * Sub-classification of the ward event on this tile.
   * Only set when encounter === 'wardEvent'; undefined otherwise.
   * Assigned once at map-generation time — NEVER rerolled on revisit.
   * Persisted as part of the tile's JSON in the journey run document.
   */
  wardEventSubtype?: WardEventSubtype;

  /**
   * Cosmetic surface variant for terrain tiles with encounter === 'none'.
   * Undefined for all other encounter types.
   *
   * Assigned once at run-creation time from a deterministic seed derived from
   * the run seed + tile key.  Has no gameplay effect whatsoever.
   * See TerrainVisualVariant for the full variant catalogue.
   */
  visualVariant?: TerrainVisualVariant;

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

  /**
   * Chapter Boss Keys carried forward from prior map attempts (Rechallenge Map).
   * Always 0 for the first run of a chapter and for post-clear challenge runs.
   *
   * Invariant:
   *   areaBossKeysCollected === inheritedAreaBossKeys
   *                          + tiles.filter(t => t.areaBossKeyClaimed).length
   */
  inheritedAreaBossKeys: number;

  /**
   * Total Chapter Boss Keys collected so far (inherited + claimed on this map).
   * This is the counter used for the gate-unlock check.
   */
  areaBossKeysCollected: number;

  /** Whether the chapter boss (gate encounter) has been defeated. */
  chapterBossDefeated: boolean;

  /** Count of tiles whose visibility !== 'unexplored'. */
  exploredTileCount: number;

  /**
   * Set of tile IDs that have ever entered the player's field of vision.
   * Monotonically growing — never shrinks within a run.
   *
   * When a tile in this set falls outside the current FOV it is rendered as
   * 'exploredButOutOfVision' (remembered terrain, light atmospheric haze) rather
   * than reverting to 'unexplored' (dense fog).
   *
   * Serialised as a string array; legacy runs derive this field from tile
   * visibility states on load (see journeyRunRepository.fromWire).
   */
  exploredTileIds: readonly string[];

  /** Total stamina spent on encounters in this run. */
  staminaSpent: number;

  // ── New canonical-run fields (Push 4) ──────────────────────────────────────

  /**
   * The shift at which this run was created.
   * Frozen for the run's lifetime — determines ward event subtypes and
   * enemy density caps.  Defaults to 'day' on pre-canonical legacy runs.
   */
  readonly shift: TimeOfDay;

  /**
   * Hero IDs available to call for assistance during this run.
   * Populated by 'support_ally' ward events; consumed by Call actions in
   * encounters (wired in future pushes).
   */
  callTeam: readonly string[];

  /**
   * Protocol cards collected from 'protocol_card' ward event tiles.
   * Each card may be spent once to unlock a bonus effect.
   */
  cards: JourneyCard[];

  /**
   * Ward blessings currently active.  Granted by 'ward_blessing' ward event
   * tiles.  Provide passive bonuses for the duration of the run.
   */
  blessings: JourneyBlessing[];

  /**
   * Ward pressure meter (0–100).
   * Rises with unresolved ward hazards and corruption spread; falls with
   * successful care actions.  Affects encounter difficulty modifiers.
   */
  pressure: number;
}
