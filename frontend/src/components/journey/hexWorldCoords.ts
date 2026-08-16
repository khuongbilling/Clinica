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
 * At 110 px/tile a Chapter 1 map (q span −2 … 3 = 5 cols) produces a world
 * roughly 650–700 × 800–850 px — meaningfully wider and taller than a mobile
 * viewport (≈ 380 × 360), giving the player-follow camera ~270–320 × 420–480 px
 * of travel, while showing 4–5 hex columns for tactical readability.
 *
 * (Was 150 px through Push 4A.1 — reduced in Push 4A.2 for mobile composition.)
 *
 * Pass this as `szOverride` to `computeHexWorldCoords` (or as `worldTileSize`
 * to `HexMapLayer`) to activate the full-span formula that accounts for tiles
 * with negative q coordinates correctly.
 */
export const AUTHORED_MAP_TILE_SZ = 110;

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
// Push 4A.1 rewrite: uses the ACTUAL pixel bounding box of all tile positions
// rather than the axial q-span approximation.  Key differences vs the old
// approach:
//
//   OLD: worldOriginX derived from minQ only (wrong for negative-r tiles).
//        worldHeight seeded from 0, so tiles above r=0 shrank the world.
//        worldMargin = 10 px (too small; world ≈ viewport on Chapter 1).
//
//   NEW: minLeft / minTop / maxRight / maxBottom computed from every tile's
//        actual pixel footprint (rawLeft = q×Q_STEP×sz, rawTop = (r×R_STEP +
//        q×Q_VOFF)×sz).  originX = worldMargin − minLeft correctly offsets the
//        entire footprint into positive world-space regardless of sign.
//        worldMargin = sz × 0.65 (≈ 97 px at sz=150) gives breathing room for
//        sprite overflow, encounter props, jade glow, and edge composition.
//
// This is a module-private helper; callers go through computeHexWorldCoords.

function _computeAuthoredWorldCoords(
  tiles: ReadonlyArray<{ readonly q: number; readonly r: number }>,
  sz:    number,
): HexWorldCoords {
  // worldMargin: breathing room on every side of the tile footprint.
  // sz × 0.65 at the canonical authored tile size (110 px) gives ≈ 72 px —
  // enough for sprite overflow, encounter props, jade glow, and edge composition.
  // Do NOT reduce below sz × 0.5 or sprites near map edges will clip.
  const worldMargin = sz * 0.65;

  if (tiles.length === 0) {
    const worldOriginX = worldMargin;
    const worldOriginY = worldMargin;
    function axialToWorldEmpty(q: number, r: number) {
      const left = Math.round(q * Q_STEP * sz + worldOriginX);
      const top  = Math.round((r * R_STEP + q * Q_VOFF) * sz + worldOriginY);
      return { left, top, cx: left + Math.round(sz / 2), cy: top + Math.round(sz / 2) };
    }
    return {
      sz, worldOriginX, worldOriginY,
      worldWidth:  Math.ceil(sz + worldMargin * 2),
      worldHeight: Math.ceil(sz + worldMargin * 2),
      axialToWorld: axialToWorldEmpty,
    };
  }

  // ── Step 1: actual pixel bounding box of every tile ─────────────────────────
  //
  // Each tile's raw (un-offset) pixel footprint in the coordinate system where
  // tile (0,0) is at the origin:
  //
  //   rawLeft   = q × Q_STEP × sz
  //   rawTop    = (r × R_STEP + q × Q_VOFF) × sz
  //   rawRight  = rawLeft + sz        (one tile body wide)
  //   rawBottom = rawTop  + sz        (one tile body tall)
  //
  // We need the global min/max across all tiles so the world origin can shift
  // the ENTIRE footprint into positive world-space with a uniform margin.
  let minLeft   =  Infinity;
  let minTop    =  Infinity;
  let maxRight  = -Infinity;
  let maxBottom = -Infinity;

  for (const tile of tiles) {
    const rawLeft   = tile.q * Q_STEP * sz;
    const rawTop    = (tile.r * R_STEP + tile.q * Q_VOFF) * sz;
    if (rawLeft          < minLeft)   minLeft   = rawLeft;
    if (rawTop           < minTop)    minTop    = rawTop;
    if (rawLeft + sz     > maxRight)  maxRight  = rawLeft + sz;
    if (rawTop  + sz     > maxBottom) maxBottom = rawTop  + sz;
  }

  // ── Step 2: world origin — push footprint into positive space + margin ──────
  //
  //   originX = worldMargin − minLeft
  //   originY = worldMargin − minTop
  //
  // After this shift, the leftmost tile's left edge lands at exactly worldMargin.
  // Tiles with negative rawLeft (e.g. q = −2 in Chapter 1) are handled correctly.
  const worldOriginX = worldMargin - minLeft;
  const worldOriginY = worldMargin - minTop;

  // ── Step 3: world canvas dimensions ─────────────────────────────────────────
  //
  //   worldWidth  = (maxRight  − minLeft) + worldMargin × 2
  //   worldHeight = (maxBottom − minTop)  + worldMargin × 2
  //
  // The Chapter background image fills exactly these dimensions.
  // Do NOT clamp to containerWidth/containerHeight — the world is intentionally
  // larger than the mobile viewport so the player-follow camera has travel room.
  const worldWidth  = Math.ceil(maxRight  - minLeft + worldMargin * 2);
  const worldHeight = Math.ceil(maxBottom - minTop  + worldMargin * 2);

  // ── Step 4: axial → pixel conversion ────────────────────────────────────────
  //
  // Identical raw formula; originX / originY offset the result into world-space.
  // Every placement (terrain, player, gate, fog holes, camera) MUST use this.
  function axialToWorld(q: number, r: number) {
    const left = Math.round(q * Q_STEP * sz + worldOriginX);
    const top  = Math.round((r * R_STEP + q * Q_VOFF) * sz + worldOriginY);
    return {
      left,
      top,
      cx: left + Math.round(sz / 2),
      cy: top  + Math.round(sz / 2),
    };
  }

  return { sz, worldOriginX, worldOriginY, worldWidth, worldHeight, axialToWorld };
}
