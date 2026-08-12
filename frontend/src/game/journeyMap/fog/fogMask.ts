/**
 * fog/fogMask.ts — world-space fog visibility mask (Layer 1)
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png
 *
 * REFERENCE ONLY. Never render that file in gameplay.
 *
 * ── What this module does ─────────────────────────────────────────────────────
 *
 * Draws one canvas element sized to the full MapWorld dimensions (worldW × worldH).
 * The canvas is world-space: it lives inside MapWorld and translates with the
 * camera.  Camera panning does NOT require a redraw.
 *
 * Redraw only when:
 *   • player tile changes     (visibleNow set changes)
 *   • explored set changes    (explored set grows)
 *   • effectiveFieldOfVision changes
 *   • run changes             (new canvas)
 *
 * ── Mask semantics ────────────────────────────────────────────────────────────
 *
 *   Canvas starts as opaque white  → 100 % fog everywhere (UNEXPLORED).
 *   destination-out erase over EXPLORED centers  → light haze remaining (~45 %).
 *   destination-out erase over VISIBLE_NOW centers → near-clear (~7 % remaining).
 *
 * ── Edge style ────────────────────────────────────────────────────────────────
 *
 *   No hard circles. No hex cut-outs. No rectangles.
 *   Each clear region is a primary radial gradient plus 3–5 offset sub-influences
 *   positioned at irregular angles to break perfect circular symmetry.
 *   Adjacent visible tiles blend into one continuous clear area.
 *
 * ── Coordinate system ─────────────────────────────────────────────────────────
 *
 *   All values are WORLD coordinates (same space as HexMapLayer tile positions).
 *   tileCenters must be pre-computed with HexWorldCoords.axialToWorld().
 *   NEVER pass viewport, page, or per-tile dimensions.
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web only — uses HTML5 Canvas 2D API.
 *   Callers must guard with `Platform.OS === 'web'` before calling drawFogMask.
 *   On native the fog overlay will use a different rendering path (future push).
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FogMaskParams {
  /** Full world canvas width in display pixels (MapWorld's width). */
  worldWidth:  number;
  /** Full world canvas height in display pixels (MapWorld's height). */
  worldHeight: number;
  /** Resolved tile edge length in display pixels (coords.sz). */
  sz:          number;
  /**
   * World-space centre point for every tile in the active run.
   * Build from HexWorldCoords.axialToWorld(q, r):
   *   cx = left + sz / 2
   *   cy = top  + sz / 2
   */
  tileCenters:           ReadonlyMap<string, { cx: number; cy: number }>;
  /** Tile IDs that are currently within the player's field of vision. */
  visibleNowIds:         ReadonlySet<string>;
  /** Tile IDs that have been seen at least once this run but are not currently visible. */
  exploredIds:           ReadonlySet<string>;
  /** Player's effective field of vision radius (from fogVision.effectiveFieldOfVision). */
  effectiveFieldOfVision: number;
}

// ── Cache key ──────────────────────────────────────────────────────────────────

/**
 * Builds a stable string key from the visibility inputs.
 * If the key hasn't changed since the last draw, skip the redraw.
 *
 * Camera position is NOT part of this key — camera pan never triggers a redraw.
 */
export function fogMaskCacheKey(params: {
  visibleNowIds:          ReadonlySet<string>;
  exploredIds:            ReadonlySet<string>;
  effectiveFieldOfVision: number;
  sz:                     number;
}): string {
  const vis = [...params.visibleNowIds].sort().join(',');
  const exp = [...params.exploredIds].sort().join(',');
  return `v=${vis}|e=${exp}|fov=${params.effectiveFieldOfVision}|sz=${params.sz}`;
}

// ── Main draw function ─────────────────────────────────────────────────────────

/**
 * Draws the fog visibility mask onto `canvas`.
 *
 * After this call:
 *   • UNEXPLORED areas remain opaque white (full fog).
 *   • EXPLORED areas are partially erased — light memory haze remains.
 *   • VISIBLE_NOW areas are nearly fully erased — almost clear.
 *
 * All erase operations use soft radial gradients + offset sub-influences to
 * produce organic, non-circular edges.  Adjacent visible tiles blend together.
 *
 * Web only — canvas.getContext('2d') must be available.
 */
export function drawFogMask(
  canvas: HTMLCanvasElement,
  params: FogMaskParams,
): void {
  const {
    worldWidth,
    worldHeight,
    sz,
    tileCenters,
    visibleNowIds,
    exploredIds,
    effectiveFieldOfVision,
  } = params;

  // ── Size the canvas to the world ─────────────────────────────────────────────
  canvas.width  = Math.ceil(worldWidth);
  canvas.height = Math.ceil(worldHeight);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // ── Step 1: opaque white base — full fog everywhere ──────────────────────────
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ── Step 2: erase fog using destination-out ───────────────────────────────────
  // Higher alpha in the gradient stroke = more opaque mask erased = more reveal.
  ctx.globalCompositeOperation = 'destination-out';

  // Scale influence radii with tile size and FoV.
  // fovScale stretches the primary radius as vision expands.
  const fovScale         = 1 + (effectiveFieldOfVision - 1) * 0.18;
  const visiblePrimaryR  = sz * 2.45 * fovScale;  // main clear dome
  const exploredPrimaryR = sz * 1.95;             // explored haze dome

  // ── EXPLORED tiles first (lighter clearing, painted underneath VISIBLE_NOW) ──
  for (const id of exploredIds) {
    const c = tileCenters.get(id);
    if (!c) continue;

    // Primary influence — partial erase; enough opacity remains for light haze
    drawRadialInfluence(ctx, c.cx, c.cy, exploredPrimaryR, 0.55);

    // 3 offset sub-influences — break circular symmetry
    drawRadialInfluence(ctx, c.cx - 0.44 * sz, c.cy - 0.28 * sz, sz * 1.05, 0.38);
    drawRadialInfluence(ctx, c.cx + 0.52 * sz, c.cy + 0.32 * sz, sz * 0.88, 0.33);
    drawRadialInfluence(ctx, c.cx - 0.22 * sz, c.cy + 0.54 * sz, sz * 0.95, 0.36);
  }

  // ── VISIBLE_NOW tiles on top (stronger clearing, near-fully transparent) ──────
  for (const id of visibleNowIds) {
    const c = tileCenters.get(id);
    if (!c) continue;

    const sr = fovScale; // sub-influence scale
    // Primary influence — near-full erase at centre
    drawRadialInfluence(ctx, c.cx, c.cy, visiblePrimaryR, 0.93);

    // 5 offset sub-influences at irregular positions for organic edges
    // NW bulge
    drawRadialInfluence(ctx, c.cx - 0.52 * sz, c.cy - 0.31 * sz, sz * 1.35 * sr, 0.70);
    // NE bulge
    drawRadialInfluence(ctx, c.cx + 0.58 * sz, c.cy - 0.42 * sz, sz * 1.18 * sr, 0.62);
    // S bulge
    drawRadialInfluence(ctx, c.cx - 0.28 * sz, c.cy + 0.62 * sz, sz * 1.10 * sr, 0.65);
    // SE extension
    drawRadialInfluence(ctx, c.cx + 0.41 * sz, c.cy + 0.50 * sz, sz * 1.28 * sr, 0.60);
    // N tip
    drawRadialInfluence(ctx, c.cx + 0.04 * sz, c.cy - 0.72 * sz, sz * 0.92 * sr, 0.55);
  }

  // ── Reset compositing mode ────────────────────────────────────────────────────
  ctx.globalCompositeOperation = 'source-over';
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Draws one soft radial erase influence at (cx, cy).
 *
 * Uses a multi-stop radial gradient that:
 *   • Holds strong opacity from center to ~35 % of radius (clean clear core).
 *   • Falls off gently through 60–90 % (soft organic edge).
 *   • Reaches 0 at the radius boundary (seamless blend into unexplored fog).
 *
 * @param alpha  Peak erase strength at center.  0 = no erase, 1 = full erase.
 */
function drawRadialInfluence(
  ctx:    CanvasRenderingContext2D,
  cx:     number,
  cy:     number,
  radius: number,
  alpha:  number,
): void {
  if (radius <= 0) return;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  // Organic falloff — faster drop at midpoint for a non-circular silhouette
  grad.addColorStop(0.00, `rgba(0,0,0,${alpha})`);
  grad.addColorStop(0.35, `rgba(0,0,0,${(alpha * 0.90).toFixed(3)})`);
  grad.addColorStop(0.58, `rgba(0,0,0,${(alpha * 0.62).toFixed(3)})`);
  grad.addColorStop(0.76, `rgba(0,0,0,${(alpha * 0.32).toFixed(3)})`);
  grad.addColorStop(0.90, `rgba(0,0,0,${(alpha * 0.10).toFixed(3)})`);
  grad.addColorStop(1.00, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}
