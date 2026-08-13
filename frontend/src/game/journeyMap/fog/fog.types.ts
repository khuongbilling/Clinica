/**
 * fog/fog.types.ts — canonical fog-of-war type definitions
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png
 *
 * REFERENCE ONLY. Never render that file in gameplay.
 *
 * These types are the single source of truth for the new fog system.
 * The legacy TileVisibility strings ('visibleNow' | 'exploredButOutOfVision' |
 * 'unexplored') in types.ts remain on JourneyTile for backward compatibility
 * with the tile-state pipeline; this module defines the canonical NEW names.
 */

// ── Canonical visibility states ───────────────────────────────────────────────

/**
 * Three-tier fog visibility state for a hex tile.
 *
 *  VISIBLE_NOW  — within the player's current field of vision (0 % fog opacity)
 *  EXPLORED     — seen at least once during this run; light haze (20–40 % opacity)
 *  UNEXPLORED   — never seen; fully fogged (80–95 % opacity)
 */
export type FogVisibility = 'VISIBLE_NOW' | 'EXPLORED' | 'UNEXPLORED';

// ── Field of Vision bonuses ───────────────────────────────────────────────────

/**
 * Additive bonuses applied on top of BASE_FIELD_OF_VISION.
 * All values are in integer hex-step units.
 *
 * Push 2: all bonuses default to 0.
 * Future pushes wire in class, skill, equipment and temporary sources.
 */
export interface FovBonuses {
  /** Class-tree bonus (e.g. Ranger passive). */
  classBonus:     number;
  /** Active skill modifier (e.g. Keen Eye triggered). */
  skillBonus:     number;
  /** Equipment bonus (e.g. field scope). */
  equipmentBonus: number;
  /** Temporary effect (e.g. ward buff, item use, chapter event). */
  temporaryBonus: number;
}

/** Zero-bonus default — use when no bonuses are active. */
export const ZERO_FOV_BONUSES: FovBonuses = {
  classBonus:     0,
  skillBonus:     0,
  equipmentBonus: 0,
  temporaryBonus: 0,
};

// ── Vision config ─────────────────────────────────────────────────────────────

/**
 * Full input to the field-of-vision computation.
 * Pass to `effectiveFieldOfVision` and `calculateVisibleTileIds`.
 */
export interface VisionConfig {
  /**
   * Current tile the player is standing on.
   * The visible set is centred here.
   */
  currentTile: { q: number; r: number };
  /** Additive bonus breakdown.  Pass ZERO_FOV_BONUSES when none are active. */
  bonuses:     FovBonuses;
}

// ── Tile visibility snapshot ──────────────────────────────────────────────────

/**
 * Per-tile fog state computed by the fog vision system.
 * Attached to tile-level data only by the rendering pipeline; never stored
 * on JourneyTile directly (the persisted tile uses the legacy TileVisibility).
 */
export interface TileFogState {
  tileId:     string;
  visibility: FogVisibility;
}

// ── Spec-canonical types (Push 2) ─────────────────────────────────────────────
//
// These are the publicly-exported names required by the Push 2 spec.
// They sit alongside the existing uppercase FogVisibility for back-compat.
//
// All fog rendering, gate logic, and encounter-privacy guards MUST derive
// tile state from getFogVisibilityState() (fogVision.ts) using these types —
// never from raw tile.visibility string comparisons scattered in components.

/**
 * Canonical three-state fog visibility for rendering and gate logic.
 *
 *   "visibleNow"  — within the player's current field of vision
 *   "explored"    — seen at least once this run; light haze remains
 *   "unexplored"  — never seen; fully opaque fog
 *
 * Note: "explored" maps to the legacy TileVisibility value
 * 'exploredButOutOfVision' on JourneyTile.  The shorter name is canonical
 * in the fog system; the legacy name is kept on JourneyTile only for
 * backward compatibility with the tile-state pipeline.
 */
export type FogVisibilityState =
  | 'visibleNow'
  | 'explored'
  | 'unexplored';

/**
 * Simple axial hex coordinate pair.
 * Canonical argument shape for fog-vision functions (matches the spec).
 * Use instead of the domain-level AxialCoord where the fog layer is the caller.
 */
export interface HexCoord {
  q: number;
  r: number;
}

/**
 * Additive field-of-vision bonuses from all game-mechanic sources.
 * Canonical alias for FovBonuses — prefer VisionBonuses in new code.
 */
export type VisionBonuses = FovBonuses;

/**
 * Full vision input: base radius + additive bonus breakdown.
 * Pass to getEffectiveVisionRadius() and calculateVisibleTileIds().
 */
export interface PlayerVisionStats {
  /** Base radius before any bonuses (always 1 for the current push). */
  baseVisionRadius: number;
  bonuses:          VisionBonuses;
}

/**
 * Default PlayerVisionStats — no class / skill / equipment / temporary bonuses.
 * Effective radius = 1 (current tile + all 6 neighbours).
 */
export const DEFAULT_PLAYER_VISION_STATS: PlayerVisionStats = {
  baseVisionRadius: 1,
  bonuses: ZERO_FOV_BONUSES,
};
