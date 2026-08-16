/**
 * hexWorldCoords — authoritative hex map world coordinate system (Push 6)
 *
 * Single source of truth for every axial-to-pixel conversion on the fog map.
 * Used by: HexMapLayer, HexTile, gate art overlay,
 * battle / treasure / merchant / areaBoss markers,
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

/** Upper bound on tile size in display pixels (viewport-fit mode). */
export const MAX_TILE_SZ = 88;
/**
 * Lower bound on tile size in display pixels.
 * 44 px is the minimum touch-target size required by WCAG 2.5.5 and iOS HIG.
 * This ensures every interactive tile meets the rule regardless of container width.
 */
export const MIN_TILE_SZ = 44;

/**
 * Authored tile size for world-canvas rendering.
 *
 * This is the CANONICAL tile size for the full MapWorld coordinate system.
 * It is INDEPENDENT of viewport / container dimensions — the world is always
 * computed at this scale and the camera viewport then clips the visible slice.
 *
 * At 150 px/tile a Chapter 1 map (q span −2 … 3 = 5 cols) produces a world
 * roughly 710 × 600 px — meaningfully wider and taller than a mobile viewport
 * (≈ 380 × 360), giving the player-follow camera ~330 × 240 px of travel.
 *
 * Pass this as `szOverride` to `computeHexWorldCoords` (or as `worldTileSize`
 * to `HexMapLayer`) to activate the full-span formula that accounts for tiles
 * with negative q coordinates correctly.
 */
export const AUTHORED_MAP_TILE_SZ = 150;

// ── World bounds padding (named for explicit intent) ──────────────────────────

/**
 * Extra pixels added below the bottommost tile for sprite bleed.
 * Sprites extend above their tile bounding box; this clearance prevents clipping.
 */
export const FOG_BOTTOM_PAD_PX = 10;

// ── Coordinate system interface ───────────────────────────────────────────────

/**
 * Fully-bound world coordinate system for one hex map layout.
 *
 * Created by `computeHexWorldCoords(tiles, containerWidth)` once per geometry
 * settle and shared with every sub-component that places anything in world space:
 * HexTile, gate art, camera centering, dev overlays.
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
 * Two modes:
 *
 *   Viewport-fit mode (default, szOverride omitted):
 *     sz is derived from containerWidth so the full tile set fits horizontally.
 *     worldWidth ≈ containerWidth.  Camera cannot pan when world ≈ viewport.
 *     Use only when the map is guaranteed larger than the viewport from tile count
 *     alone (many q columns).
 *
 *   Authored-world mode (szOverride = AUTHORED_MAP_TILE_SZ):
 *     sz is the fixed authored tile size, independent of the viewport.
 *     worldOriginX correctly accounts for tiles with negative q coordinates.
 *     worldWidth = full q-span × Q_STEP × sz + sz + 2×MARGIN, always larger
 *     than a mobile viewport for the authored chapter layouts.
 *     This activates the player-follow camera in HexMapLayer.
 *
 * @param tiles          Tile set — only `q` and `r` are read.
 * @param containerWidth Viewport width in display pixels (only used in
 *                       viewport-fit mode; ignored when szOverride is provided).
 * @param szOverride     Fixed tile size in display pixels.  Pass
 *                       `AUTHORED_MAP_TILE_SZ` to get the full authored world.
 */
export function computeHexWorldCoords(
  tiles: ReadonlyArray<{ readonly q: number; readonly r: number }>,
  containerWidth: number,
  szOverride?: number,
): HexWorldCoords {
  // ── Authored-world mode ────────────────────────────────────────────────────
  if (szOverride !== undefined) {
    return _computeAuthoredWorldCoords(tiles, szOverride);
  }

  // ── Viewport-fit mode (legacy) ─────────────────────────────────────────────
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

// ── Authored-world formula (used when szOverride is provided) ─────────────────
//
// Unlike the viewport-fit formula, this:
//   • Uses the FULL axial q-span (minQ … maxQ), correctly accounting for tiles
//     with negative q coordinates which the viewport-fit formula ignores.
//   • Sets worldOriginX so the leftmost tile sits at MARGIN px from left.
//   • worldWidth = full q-span × Q_STEP × sz + sz + 2×MARGIN.
//   • Never adds viewport-width padding — the camera viewport is separate.
//
// This is a module-private helper; callers go through computeHexWorldCoords.
const _AUTHORED_MARGIN = 10; // px of breathing room on left and right edges

function _computeAuthoredWorldCoords(
  tiles: ReadonlyArray<{ readonly q: number; readonly r: number }>,
  sz:    number,
): HexWorldCoords {
  if (tiles.length === 0) {
    const worldOriginX = _AUTHORED_MARGIN;
    const worldOriginY = _AUTHORED_MARGIN;
    function axialToWorldEmpty(q: number, r: number) {
      const left = Math.round(q * Q_STEP * sz) + worldOriginX;
      const top  = Math.round((r * R_STEP + q * Q_VOFF) * sz) + worldOriginY;
      return { left, top, cx: left + Math.round(sz / 2), cy: top + Math.round(sz / 2) };
    }
    return {
      sz, worldOriginX, worldOriginY,
      worldWidth: sz + _AUTHORED_MARGIN * 2, worldHeight: sz + _AUTHORED_MARGIN * 2,
      axialToWorld: axialToWorldEmpty,
    };
  }

  // Full axial extent — includes tiles with negative q.
  const minQ = tiles.reduce((m, t) => Math.min(m, t.q), tiles[0].q);
  const maxQ = tiles.reduce((m, t) => Math.max(m, t.q), tiles[0].q);

  // worldOriginX: places the leftmost tile (q = minQ) at left = _AUTHORED_MARGIN.
  //   left(minQ) = round(minQ × Q_STEP × sz) + worldOriginX = _AUTHORED_MARGIN
  //   ⟹ worldOriginX = _AUTHORED_MARGIN − round(minQ × Q_STEP × sz)
  const worldOriginX = _AUTHORED_MARGIN - Math.round(minQ * Q_STEP * sz);
  const worldOriginY = 10;

  // worldWidth covers the tile body from minQ left-edge to maxQ right-edge,
  // plus one margin on each side.
  //   right edge of maxQ tile = round(maxQ × Q_STEP × sz) + worldOriginX + sz
  //                           = round(maxQ × Q_STEP × sz) + worldOriginX + sz
  //   worldWidth = right edge + _AUTHORED_MARGIN (right breathing room)
  //   Substituting worldOriginX:
  //     ≈ round((maxQ − minQ) × Q_STEP × sz) + sz + 2 × _AUTHORED_MARGIN
  const worldWidth = Math.round((maxQ - minQ) * Q_STEP * sz) + sz + _AUTHORED_MARGIN * 2;

  // worldHeight: standard formula driven by the bottommost tile row.
  const maxPxBottom = tiles.reduce((m, t) => Math.max(m, t.r * R_STEP + t.q * Q_VOFF), 0);
  const worldHeight = Math.round(maxPxBottom * sz) + sz + worldOriginY + FOG_BOTTOM_PAD_PX;

  // Identical axial-to-pixel formula — worldOriginX is the only thing that changed.
  function axialToWorld(q: number, r: number) {
    const left = Math.round(q * Q_STEP * sz) + worldOriginX;
    const top  = Math.round((r * R_STEP + q * Q_VOFF) * sz) + worldOriginY;
    return { left, top, cx: left + Math.round(sz / 2), cy: top + Math.round(sz / 2) };
  }

  return { sz, worldOriginX, worldOriginY, worldWidth, worldHeight, axialToWorld };
}
