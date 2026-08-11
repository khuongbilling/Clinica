/**
 * hexWorldCoords — authoritative hex map world coordinate system (Push 6)
 *
 * Single source of truth for every axial-to-pixel conversion on the fog map.
 * Used by: HexMapLayer, HexTile, JourneyFogLayer, gate art overlay,
 * battle / treasure / merchant / areaBoss markers, fog visibility centres,
 * and camera centering.
 *
 * CONTRACT
 * ────────
 * The centre of tile (q, r) is exactly the same world-space coordinate in
 * every renderer.  No component may inline
 *   `q * Q_STEP * sz + ox`  or  `r * R_STEP + q * Q_VOFF) * sz + oy`
 * — all callers must go through `HexWorldCoords.axialToWorld(q, r)`.
 *
 * Pixel formula (for documentation only — use axialToWorld, never inline):
 *   left = Math.round(q × Q_STEP × sz) + worldOriginX
 *   top  = Math.round((r × R_STEP + q × Q_VOFF) × sz) + worldOriginY
 *   cx   = left + Math.round(sz / 2)
 *   cy   = top  + Math.round(sz / 2)
 */

// ── Hex layout constants (flat-top axial, Push 13 tightened) ─────────────────
// Values are deliberately below mathematical hex-touching thresholds so
// adjacent solid hex bodies overlap — eliminating the transparent corner gaps
// that make each tile look like a separate floating platform.
// See HexMapLayer file header for full rationale.

/** Horizontal world-space advance per q unit. (Mathematical: 0.75; tightened: 0.72) */
export const Q_STEP = 0.72;
/** Vertical world-space advance per r unit. (Mathematical: √3/2 ≈ 0.866; tightened: 0.79) */
export const R_STEP = 0.79;
/** Vertical world-space bump per q unit (= R_STEP / 2; maintains stagger ratio). */
export const Q_VOFF = 0.395;

// ── Tile size bounds ──────────────────────────────────────────────────────────

/** Upper bound on tile size in display pixels. */
export const MAX_TILE_SZ = 88;
/**
 * Lower bound on tile size in display pixels.
 * 44 px is the minimum touch-target size required by WCAG 2.5.5 and iOS HIG.
 * This ensures every interactive tile meets the rule regardless of container width.
 */
export const MIN_TILE_SZ = 44;

// ── World bounds padding (named for explicit intent) ──────────────────────────

/**
 * Extra pixels added below the bottommost tile for sprite and fog gradient bleed.
 * Fog radial gradients extend past the outermost tile edges; sprites extend above
 * their tile bounding box.  This clearance prevents both from being clipped.
 */
export const FOG_BOTTOM_PAD_PX = 10;

// ── Coordinate system interface ───────────────────────────────────────────────

/**
 * Fully-bound world coordinate system for one hex map layout.
 *
 * Created by `computeHexWorldCoords(tiles, containerWidth)` once per geometry
 * settle and shared with every sub-component that places anything in world space:
 * HexTile, JourneyFogLayer, gate art, camera centering, dev overlays.
 *
 * Invariant: the centre of tile (q, r) — `axialToWorld(q, r).cx/cy` — is
 * numerically identical in every renderer for the same layout object.
 */
export interface HexWorldCoords {
  /** Resolved tile edge length / bounding-box side in display pixels. */
  readonly sz: number;

  /**
   * World-space X of the top-left corner of tile (0, 0).
   * All other left values are derived from this via the Q_STEP formula.
   */
  readonly worldOriginX: number;

  /**
   * World-space Y of the top-left corner of tile (0, 0).
   * Fixed at 10 px — top breathing room above the hex grid.
   */
  readonly worldOriginY: number;

  /** Total world canvas width in display pixels. */
  readonly worldWidth: number;

  /** Total world canvas height in display pixels. */
  readonly worldHeight: number;

  /**
   * Convert axial (q, r) → world-space pixel rectangle.
   *
   * Returns:
   *   `left`, `top` — top-left corner of the tile's sz × sz bounding box.
   *   `cx`,   `cy`  — centre of the tile hex.
   *
   * Use `cx/cy` for fog holes, camera target, encounter markers, and sprite
   * grounding.  Use `left/top` for absolute-positioned Views.
   *
   * This is the ONLY authoritative axial-to-pixel formula in the renderer.
   * Every placement — terrain cells, player token, Gate, fog visibility
   * centres, camera centering — MUST call this function.
   */
  readonly axialToWorld: (
    q: number,
    r: number,
  ) => { left: number; top: number; cx: number; cy: number };
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Compute the complete world coordinate system for a tile set and container.
 *
 * World bounds are derived from:
 *   • All terrain coordinates (rightmost q, bottommost r determine extremes)
 *   • One tile-body of clearance on right + bottom (gate art / sprite overflow)
 *   • Symmetric x centering overflow when the world is narrower than container
 *   • Fixed top margin of 10 px (worldOriginY)
 *   • `FOG_BOTTOM_PAD_PX` extra below the lowest tile (fog / sprite bleed)
 *
 * @param tiles         Tile set — only `q` and `r` are read.
 * @param containerWidth Viewport width in display pixels.
 */
export function computeHexWorldCoords(
  tiles: ReadonlyArray<{ readonly q: number; readonly r: number }>,
  containerWidth: number,
): HexWorldCoords {
  // ── Tile size ──────────────────────────────────────────────────────────────
  const maxQ    = tiles.reduce((m, t) => Math.max(m, t.q), 0);
  const wFactor = maxQ * Q_STEP + 1;
  const sz      = tiles.length === 0
    ? 60
    : Math.min(MAX_TILE_SZ, Math.max(MIN_TILE_SZ, Math.floor(containerWidth / wFactor)));

  // ── Origin ─────────────────────────────────────────────────────────────────
  // worldOriginX: centres the tile set horizontally within the container.
  // worldOriginY: fixed 10 px top breathing room.
  const worldOriginX: number = Math.floor((containerWidth - wFactor * sz) / 2);
  const worldOriginY: number = 10;

  // ── World bounds ───────────────────────────────────────────────────────────
  // Fractional tile advances to the rightmost / bottommost tile top-left corner.
  const maxPxRight  = tiles.reduce((m, t) => Math.max(m, t.q * Q_STEP), 0);
  const maxPxBottom = tiles.reduce((m, t) => Math.max(m, t.r * R_STEP + t.q * Q_VOFF), 0);

  // worldWidth  = position of rightmost tile's left edge
  //             + sz  (one tile body — gate art extends to right edge)
  //             + symmetric x centering overflow if container is wider
  const worldWidth  = Math.round(maxPxRight * sz) + sz + Math.max(worldOriginX, 0) * 2;

  // worldHeight = position of bottommost tile's top edge
  //             + sz                (one tile body — sprite grounding at bottom)
  //             + worldOriginY      (top breathing room is mirrored at bottom)
  //             + FOG_BOTTOM_PAD_PX (fog gradient / sprite bleed clearance)
  const worldHeight = Math.round(maxPxBottom * sz) + sz + worldOriginY + FOG_BOTTOM_PAD_PX;

  // ── Authoritative conversion (the ONLY place this formula lives) ───────────
  function axialToWorld(q: number, r: number) {
    const left = Math.round(q * Q_STEP * sz) + worldOriginX;
    const top  = Math.round((r * R_STEP + q * Q_VOFF) * sz) + worldOriginY;
    return {
      left,
      top,
      cx: left + Math.round(sz / 2),
      cy: top  + Math.round(sz / 2),
    };
  }

  return { sz, worldOriginX, worldOriginY, worldWidth, worldHeight, axialToWorld };
}
