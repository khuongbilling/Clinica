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
  /**
   * Extra padding in pixels beyond the world edges (matches the fog canvas padding).
   * The mask canvas is sized to (worldWidth + 2×padding) × (worldHeight + 2×padding)
   * and all tile centre coordinates are shifted by +padding so they line up with
   * the padded fog canvas.  Defaults to 0 (backward-compatible).
   */
  padding?: number;
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

  // Padding expands the canvas and shifts all tile centres so the mask aligns
  // with the padded fog canvas.  Padded area starts white (full fog).
  const P = params.padding ?? 0;

  // ── Size the canvas to the world (+ padding on all 4 sides) ──────────────────
  canvas.width  = Math.ceil(worldWidth  + 2 * P);
  canvas.height = Math.ceil(worldHeight + 2 * P);

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
  //
  // IMPORTANT: radii must stay ≤ ~1.2 × sz so that erase circles don't bleed
  // more than one tile-spacing (≈0.72 × sz) past each tile centre.  Larger radii
  // cause accumulated destination-out passes to compound and wipe the mask opaque
  // everywhere, making the entire fog canvas disappear after destination-in.
  const fovScale         = 1 + (effectiveFieldOfVision - 1) * 0.18;
  const visiblePrimaryR  = sz * 1.20 * fovScale;  // main clear dome (was 2.45)
  const exploredPrimaryR = sz * 1.10;             // explored haze dome (was 1.95)

  // ── EXPLORED tiles first (lighter clearing, painted underneath VISIBLE_NOW) ──
  // All tile centres are shifted by +P so they align with the padded canvas.
  for (const id of exploredIds) {
    const c = tileCenters.get(id);
    if (!c) continue;

    const px = c.cx + P;
    const py = c.cy + P;

    // Primary influence — partial erase; enough opacity remains for light haze
    drawRadialInfluence(ctx, px, py, exploredPrimaryR, 0.55);

    // 3 offset sub-influences — break circular symmetry (radii ≤ 0.55 × sz)
    drawRadialInfluence(ctx, px - 0.44 * sz, py - 0.28 * sz, sz * 0.52, 0.38);
    drawRadialInfluence(ctx, px + 0.52 * sz, py + 0.32 * sz, sz * 0.46, 0.33);
    drawRadialInfluence(ctx, px - 0.22 * sz, py + 0.54 * sz, sz * 0.50, 0.36);
  }

  // ── VISIBLE_NOW tiles on top (stronger clearing, near-fully transparent) ──────
  for (const id of visibleNowIds) {
    const c = tileCenters.get(id);
    if (!c) continue;

    const px = c.cx + P;
    const py = c.cy + P;
    const sr = fovScale; // sub-influence scale

    // Primary influence — near-full erase at centre
    drawRadialInfluence(ctx, px, py, visiblePrimaryR, 0.93);

    // 5 offset sub-influences at irregular positions for organic edges
    // Radii kept ≤ 0.75 × sz × sr so they don't reach past the next tile
    // NW bulge
    drawRadialInfluence(ctx, px - 0.52 * sz, py - 0.31 * sz, sz * 0.68 * sr, 0.70);
    // NE bulge
    drawRadialInfluence(ctx, px + 0.58 * sz, py - 0.42 * sz, sz * 0.60 * sr, 0.62);
    // S bulge
    drawRadialInfluence(ctx, px - 0.28 * sz, py + 0.62 * sz, sz * 0.56 * sr, 0.65);
    // SE extension
    drawRadialInfluence(ctx, px + 0.41 * sz, py + 0.50 * sz, sz * 0.64 * sr, 0.60);
    // N tip
    drawRadialInfluence(ctx, px + 0.04 * sz, py - 0.72 * sz, sz * 0.46 * sr, 0.55);
  }

  // ── Reset compositing mode ────────────────────────────────────────────────────
  ctx.globalCompositeOperation = 'source-over';
}

// ── Edge taper ─────────────────────────────────────────────────────────────────

/**
 * Fades the fog canvas to transparent at all four world edges, eliminating any
 * visible rectangular cutoff where the fog meets the map boundary.
 *
 * Call this as the LAST step after all fog sprites and the visibility mask have
 * been applied.  It composites a vignette with `destination-in`:
 *
 *   • Interior (> taperPx from world edge)  — fully opaque → fog kept unchanged.
 *   • Taper zone (0 – taperPx from world edge) — linear fade 100 % → 0 %.
 *   • Padding area (outside world boundary)  — 0 % → fog fully erased.
 *
 * The four edge gradients are applied independently; corners receive the product
 * of both adjacent gradients, producing a natural diagonal fade.
 *
 * @param ctx        The fog canvas 2D context (already has sprites + mask).
 * @param canvasW    Full canvas width  (worldWidth  + 2 × padding).
 * @param canvasH    Full canvas height (worldHeight + 2 × padding).
 * @param padding    The FOG_WORLD_PADDING value used when sizing the canvas.
 * @param taperPx    Fade distance in pixels measured inward from the world edge.
 *                   Recommended: 100–180 px.
 */
export function applyEdgeTaper(
  ctx:      CanvasRenderingContext2D,
  canvasW:  number,
  canvasH:  number,
  padding:  number,
  taperPx:  number,
): void {
  // Build a vignette canvas that is white (keep fog) in the interior and
  // transparent (erase fog) in the padded area and taper zone.
  const vig = document.createElement('canvas');
  vig.width  = canvasW;
  vig.height = canvasH;
  const v = vig.getContext('2d');
  if (!v) return;

  // Start fully opaque — fog is preserved everywhere by default.
  v.fillStyle = 'rgba(255,255,255,1)';
  v.fillRect(0, 0, canvasW, canvasH);

  // destination-out: wherever we paint, we erase the white.
  v.globalCompositeOperation = 'destination-out';

  // Helper: fraction of the gradient where the world edge sits.
  // Gradient spans from canvas edge (0 or canvasW/H) to taper end inside world.
  // In that span: [canvas-edge … world-edge] = padding/(padding+taperPx) frac.
  const edgeFrac = (p: number, t: number) => p / (p + t);

  // ── Left edge (erase from canvas x=0; full through x=padding; fade to x=padding+taper)
  {
    const gx1 = 0;
    const gx2 = padding + taperPx;
    const g = v.createLinearGradient(gx1, 0, gx2, 0);
    const f = edgeFrac(padding, taperPx);
    g.addColorStop(0,   'rgba(0,0,0,1)');
    g.addColorStop(f,   'rgba(0,0,0,1)'); // world edge — still fully erased
    g.addColorStop(1,   'rgba(0,0,0,0)'); // taper end — keep fog
    v.fillStyle = g;
    v.fillRect(gx1, 0, gx2, canvasH);
  }

  // ── Right edge
  {
    const gx1 = canvasW;
    const gx2 = canvasW - padding - taperPx;
    const g = v.createLinearGradient(gx1, 0, gx2, 0);
    const f = edgeFrac(padding, taperPx);
    g.addColorStop(0,   'rgba(0,0,0,1)');
    g.addColorStop(f,   'rgba(0,0,0,1)');
    g.addColorStop(1,   'rgba(0,0,0,0)');
    v.fillStyle = g;
    v.fillRect(gx2, 0, padding + taperPx, canvasH);
  }

  // ── Top edge
  {
    const gy1 = 0;
    const gy2 = padding + taperPx;
    const g = v.createLinearGradient(0, gy1, 0, gy2);
    const f = edgeFrac(padding, taperPx);
    g.addColorStop(0,   'rgba(0,0,0,1)');
    g.addColorStop(f,   'rgba(0,0,0,1)');
    g.addColorStop(1,   'rgba(0,0,0,0)');
    v.fillStyle = g;
    v.fillRect(0, gy1, canvasW, gy2);
  }

  // ── Bottom edge
  {
    const gy1 = canvasH;
    const gy2 = canvasH - padding - taperPx;
    const g = v.createLinearGradient(0, gy1, 0, gy2);
    const f = edgeFrac(padding, taperPx);
    g.addColorStop(0,   'rgba(0,0,0,1)');
    g.addColorStop(f,   'rgba(0,0,0,1)');
    g.addColorStop(1,   'rgba(0,0,0,0)');
    v.fillStyle = g;
    v.fillRect(0, gy2, canvasW, padding + taperPx);
  }

  v.globalCompositeOperation = 'source-over';

  // Apply the vignette to the fog canvas: keep fog only where vignette is opaque.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.globalAlpha = 1;
  ctx.drawImage(vig, 0, 0);
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
