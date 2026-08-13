/**
 * fog/fogMask.ts — world-space fog visibility mask (Push 3 rebuild)
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png
 *
 * REFERENCE ONLY. Never render that file in gameplay.
 *
 * ── What this module does ─────────────────────────────────────────────────────
 *
 * Provides two things:
 *
 *  1. drawFogMask(canvas, params)
 *     Offscreen control surface — NOT displayed in production.
 *     A white canvas (full fog) with destination-out erasure over visible/explored
 *     tile centres, producing an organic three-state alpha field:
 *
 *       UNEXPLORED   → mask alpha 1.0  → fog fully preserved
 *       EXPLORED     → mask alpha ~0.30 → ~30 % fog haze remains
 *       VISIBLE_NOW  → mask alpha ~0.03 → fog nearly gone
 *
 *     The mask is then composited onto the fog sprite canvas via destination-in,
 *     which multiplies each sprite pixel's alpha by the mask value.
 *
 *  2. drawFogMaskDev(canvas, params)
 *     DEV-ONLY grayscale visualisation.  Shows the three states as:
 *       UNEXPLORED   → dark  (#1a1a1a)
 *       EXPLORED     → mid   (#777)
 *       VISIBLE_NOW  → light (#f0f0f0)
 *     Must never be composed into the production rendering chain.
 *
 * ── Organic reveal ────────────────────────────────────────────────────────────
 *
 *   No hex cut-outs.  No hard circles.  No seven-circle flower.
 *   Each tile's influence is a primary radial brush PLUS 4–5 offset sub-lobes
 *   chosen from one of six asymmetric profiles keyed by tile ID hash.
 *   Adjacent visible tiles' influences overlap completely, merging into one
 *   continuous irregular clearing.
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
  tileCenters:            ReadonlyMap<string, { cx: number; cy: number }>;
  /** Tile IDs that are currently within the player's field of vision. */
  visibleNowIds:          ReadonlySet<string>;
  /** Tile IDs that have been seen at least once this run but are not currently visible. */
  exploredIds:            ReadonlySet<string>;
  /** Player's effective field of vision radius (from fogVision.getEffectiveVisionRadius). */
  effectiveFieldOfVision: number;
  /**
   * @deprecated Push 3: padding is no longer used by drawFogMask.
   * The mask canvas is now exactly worldWidth × worldHeight at origin 0,0.
   * Field kept for backward compatibility with fogMid.ts / fogWisp.ts callers
   * that still pass it — it is silently ignored.
   */
  padding?: number;
}

// ── Cache key ──────────────────────────────────────────────────────────────────

/**
 * All inputs that affect the mask output — including world dimensions so that
 * a viewport resize correctly forces a full redraw.
 */
export interface FogMaskCacheKeyInput {
  /** JourneyRun identifier (use runSeed). */
  runId:                  string;
  worldWidth:             number;
  worldHeight:            number;
  /** Tile size (coords.sz). */
  tileSize:               number;
  effectiveFieldOfVision: number;
  visibleNowIds:          ReadonlySet<string>;
  exploredIds:            ReadonlySet<string>;
}

/**
 * Builds a stable string key from all visibility inputs.
 * If the key matches the cached value, skip the redraw.
 *
 * Camera position is NOT part of this key — camera pan never triggers a redraw.
 * World dimensions ARE included — a resize must force regeneration.
 */
export function buildFogMaskCacheKey({
  runId,
  worldWidth,
  worldHeight,
  tileSize,
  effectiveFieldOfVision,
  visibleNowIds,
  exploredIds,
}: FogMaskCacheKeyInput): string {
  const vis = [...visibleNowIds].sort().join(',');
  const exp = [...exploredIds].sort().join(',');
  return [
    runId,
    Math.round(worldWidth),
    Math.round(worldHeight),
    Math.round(tileSize),
    effectiveFieldOfVision,
    vis,
    exp,
  ].join('|');
}

/**
 * @deprecated Use buildFogMaskCacheKey instead — this legacy form is missing
 * runId and world dimensions so viewport resizes do not force redraws.
 * Kept only while fogMid.ts / fogWisp.ts callers are migrated.
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
 * OFFSCREEN CONTROL SURFACE — never display this canvas in production.
 * It is composited onto the fog sprite canvas with destination-in, which
 * multiplies each sprite pixel's alpha by the mask value.
 *
 * After this call:
 *   • UNEXPLORED areas remain opaque white  → fog fully preserved.
 *   • EXPLORED areas are ~30 % opaque       → light memory haze.
 *   • VISIBLE_NOW areas are ~3 % opaque     → fog nearly gone.
 *
 * Canvas is sized to exactly worldWidth × worldHeight (no padding).
 * Backing store uses devicePixelRatio for crisp retina gradient edges.
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
  // params.padding is intentionally ignored — mask is always exact world size.

  const DPR = typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1;

  // ── Size canvas: exact world dimensions, DPR-backed ───────────────────────
  canvas.width  = Math.ceil(worldWidth  * DPR);
  canvas.height = Math.ceil(worldHeight * DPR);
  // CSS display size matches world units exactly.
  canvas.style.width  = `${worldWidth}px`;
  canvas.style.height = `${worldHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Scale context so all coordinates are in world units.
  ctx.scale(DPR, DPR);

  // ── Step 1: opaque white base — full fog everywhere ───────────────────────
  ctx.clearRect(0, 0, worldWidth, worldHeight);
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  // ── Step 2: erase fog with destination-out ────────────────────────────────
  //
  // Higher erase alpha = less mask remaining = more reveal.
  // Targets (after primary + sub-lobe accumulation at tile center):
  //   EXPLORED   → remaining mask ≈ 0.28–0.38  (25–40 % fog haze)
  //   VISIBLE_NOW → remaining mask ≈ 0.02–0.05  (nearly clear)
  //
  ctx.globalCompositeOperation = 'destination-out';

  const fovScale = 1 + (effectiveFieldOfVision - 1) * 0.18;

  // Primary radii — large enough to merge all 7 visible tiles (current + 6
  // neighbours) into one continuous clearing, not seven separate circles.
  const visiblePrimaryR  = sz * 1.35 * fovScale;
  const exploredPrimaryR = sz * 1.15;

  // ── EXPLORED tiles first (lighter clearing, painted before VISIBLE_NOW) ───
  for (const id of exploredIds) {
    const c = tileCenters.get(id);
    if (!c) continue;
    applyOrganicReveal(ctx, c.cx, c.cy, exploredPrimaryR, 0.65, id, sz);
  }

  // ── VISIBLE_NOW tiles on top (strong clearing, near-fully transparent) ────
  for (const id of visibleNowIds) {
    const c = tileCenters.get(id);
    if (!c) continue;
    applyOrganicReveal(ctx, c.cx, c.cy, visiblePrimaryR, 0.97, id, sz);
  }

  // ── Reset compositing mode ─────────────────────────────────────────────────
  ctx.globalCompositeOperation = 'source-over';
}

// ── Dev-only mask visualisation ────────────────────────────────────────────────

/**
 * Draws a DEVELOPMENT-ONLY grayscale version of the fog visibility state.
 *
 * Shows three distinct tonal bands — dark/mid/light — to verify the organic
 * reveal shape without running the full fog sprite pipeline.
 *
 * Acceptance criteria (dev view):
 *   • No obvious hex holes.
 *   • No seven-circle flower pattern.
 *   • No square or rectangular patches.
 *
 * MUST NOT be used in any production rendering path.
 *
 * @param canvas  The canvas element to draw into (shown in the dev overlay).
 * @param params  Same params as drawFogMask.
 */
export function drawFogMaskDev(
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

  const DPR = typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1;

  canvas.width  = Math.ceil(worldWidth  * DPR);
  canvas.height = Math.ceil(worldHeight * DPR);
  canvas.style.width  = `${worldWidth}px`;
  canvas.style.height = `${worldHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(DPR, DPR);

  // Fill with UNEXPLORED base — dark
  ctx.clearRect(0, 0, worldWidth, worldHeight);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  // source-over: paint lighter regions on top
  ctx.globalCompositeOperation = 'source-over';

  const fovScale = 1 + (effectiveFieldOfVision - 1) * 0.18;
  const visiblePrimaryR  = sz * 1.35 * fovScale;
  const exploredPrimaryR = sz * 1.15;

  // EXPLORED — mid gray
  for (const id of exploredIds) {
    const c = tileCenters.get(id);
    if (!c) continue;
    applyOrganicRevealColour(ctx, c.cx, c.cy, exploredPrimaryR, id, sz, '#777777');
  }

  // VISIBLE_NOW — near white
  for (const id of visibleNowIds) {
    const c = tileCenters.get(id);
    if (!c) continue;
    applyOrganicRevealColour(ctx, c.cx, c.cy, visiblePrimaryR, id, sz, '#f0f0f0');
  }
}

// ── Edge taper (deprecated — kept for fogMid.ts / fogWisp.ts compat) ─────────

/**
 * @deprecated Push 3: edge taper is no longer called by drawFogBase.
 * The map edge is clipped by MapViewport — visibility transitions provide all
 * the feathering needed.  Kept for binary compatibility with fogMid.ts and
 * fogWisp.ts which still call it; those callers will be migrated in a future push.
 *
 * Fades the fog canvas to transparent at all four world edges.
 */
export function applyEdgeTaper(
  ctx:      CanvasRenderingContext2D,
  canvasW:  number,
  canvasH:  number,
  padding:  number,
  taperPx:  number,
): void {
  const vig = document.createElement('canvas');
  vig.width  = canvasW;
  vig.height = canvasH;
  const v = vig.getContext('2d');
  if (!v) return;

  v.fillStyle = 'rgba(255,255,255,1)';
  v.fillRect(0, 0, canvasW, canvasH);
  v.globalCompositeOperation = 'destination-out';

  const edgeFrac = (p: number, t: number) => p / (p + t);

  {
    const gx1 = 0;
    const gx2 = padding + taperPx;
    const g = v.createLinearGradient(gx1, 0, gx2, 0);
    const f = edgeFrac(padding, taperPx);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(f, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    v.fillStyle = g;
    v.fillRect(gx1, 0, gx2, canvasH);
  }
  {
    const gx1 = canvasW;
    const gx2 = canvasW - padding - taperPx;
    const g = v.createLinearGradient(gx1, 0, gx2, 0);
    const f = edgeFrac(padding, taperPx);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(f, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    v.fillStyle = g;
    v.fillRect(gx2, 0, padding + taperPx, canvasH);
  }
  {
    const gy1 = 0;
    const gy2 = padding + taperPx;
    const g = v.createLinearGradient(0, gy1, 0, gy2);
    const f = edgeFrac(padding, taperPx);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(f, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    v.fillStyle = g;
    v.fillRect(0, gy1, canvasW, gy2);
  }
  {
    const gy1 = canvasH;
    const gy2 = canvasH - padding - taperPx;
    const g = v.createLinearGradient(0, gy1, 0, gy2);
    const f = edgeFrac(padding, taperPx);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(f, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    v.fillStyle = g;
    v.fillRect(0, gy2, canvasW, padding + taperPx);
  }

  v.globalCompositeOperation = 'source-over';
  ctx.globalCompositeOperation = 'destination-in';
  ctx.globalAlpha = 1;
  ctx.drawImage(vig, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * djb2-style string hash → unsigned 32-bit integer.
 * Used to select a deterministic lobe profile per tile ID.
 */
function hashTileId(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

/** One offset sub-lobe descriptor (all dimensions in sz units). */
interface LobeOffset {
  /** Horizontal offset from tile centre, in sz units. */
  dx:       number;
  /** Vertical offset from tile centre, in sz units. */
  dy:       number;
  /** Lobe radius, in sz units. */
  scale:    number;
  /** Lobe strength as a fraction of the primary strength. */
  strength: number;
}

/**
 * Six asymmetric lobe profiles — each tile picks one by hashing its ID.
 *
 * Profile rules:
 *   • Profiles are intentionally asymmetric (different lobes in each quadrant).
 *   • No profile has equal lobes in all four quadrants (would look circular).
 *   • Each profile's heaviest lobe points in a different compass direction.
 *   • Sub-lobe radii span 0.36–0.88 × sz (large enough to visibly distort outline).
 */
const LOBE_PROFILES: readonly LobeOffset[][] = [
  // Profile 0 — NW heavy + S tail
  [
    { dx: -0.62, dy: -0.40, scale: 0.82, strength: 0.78 },
    { dx: +0.20, dy: +0.72, scale: 0.62, strength: 0.62 },
    { dx: +0.56, dy: -0.24, scale: 0.52, strength: 0.54 },
    { dx: -0.30, dy: +0.52, scale: 0.44, strength: 0.48 },
  ],
  // Profile 1 — SE heavy + N tip + extra NE wisp
  [
    { dx: +0.60, dy: +0.46, scale: 0.86, strength: 0.80 },
    { dx: -0.50, dy: +0.28, scale: 0.58, strength: 0.60 },
    { dx: +0.14, dy: -0.68, scale: 0.48, strength: 0.52 },
    { dx: -0.66, dy: -0.32, scale: 0.42, strength: 0.46 },
    { dx: +0.38, dy: -0.56, scale: 0.36, strength: 0.44 },
  ],
  // Profile 2 — N biased + SW + S tail
  [
    { dx: +0.10, dy: -0.76, scale: 0.80, strength: 0.76 },
    { dx: +0.62, dy: +0.40, scale: 0.60, strength: 0.62 },
    { dx: -0.52, dy: +0.48, scale: 0.54, strength: 0.58 },
    { dx: +0.36, dy: -0.50, scale: 0.46, strength: 0.50 },
    { dx: -0.20, dy: +0.72, scale: 0.38, strength: 0.44 },
  ],
  // Profile 3 — E heavy + NW + SE drift
  [
    { dx: +0.74, dy: -0.14, scale: 0.84, strength: 0.78 },
    { dx: -0.40, dy: -0.60, scale: 0.56, strength: 0.60 },
    { dx: +0.30, dy: +0.66, scale: 0.62, strength: 0.64 },
    { dx: -0.62, dy: +0.24, scale: 0.48, strength: 0.52 },
  ],
  // Profile 4 — SW heavy + NE + N tendril
  [
    { dx: -0.56, dy: +0.58, scale: 0.88, strength: 0.82 },
    { dx: +0.64, dy: -0.30, scale: 0.64, strength: 0.66 },
    { dx: -0.24, dy: -0.70, scale: 0.50, strength: 0.54 },
    { dx: +0.46, dy: +0.44, scale: 0.54, strength: 0.60 },
    { dx: -0.72, dy: -0.16, scale: 0.36, strength: 0.44 },
  ],
  // Profile 5 — irregular 4-way + S tip
  [
    { dx: +0.44, dy: -0.66, scale: 0.72, strength: 0.70 },
    { dx: -0.58, dy: -0.28, scale: 0.66, strength: 0.66 },
    { dx: -0.42, dy: +0.62, scale: 0.58, strength: 0.62 },
    { dx: +0.60, dy: +0.36, scale: 0.54, strength: 0.58 },
    { dx: +0.02, dy: +0.78, scale: 0.40, strength: 0.48 },
  ],
];

/**
 * Returns the asymmetric lobe profile for a given tile ID.
 * The same tile ID always produces the same profile (deterministic).
 */
function seededOffsets(tileId: string): readonly LobeOffset[] {
  const idx = hashTileId(tileId) % LOBE_PROFILES.length;
  return LOBE_PROFILES[idx]!;
}

/**
 * Applies an organic multi-lobe erase influence at (cx, cy) using
 * destination-out compositing.
 *
 * One primary lobe (centered at tile centre) + seeded asymmetric sub-lobes
 * break perfect circular symmetry.  Different tile IDs produce different
 * lobe profiles so the pattern does not repeat visibly across the map.
 *
 * Adjacent tiles' overlapping influences merge into one continuous clearing.
 *
 * @param strength  Primary peak erase alpha. 0 = no erase, 1 = full erase.
 *                  Sub-lobe alphas are derived proportionally.
 */
function applyOrganicReveal(
  ctx:           CanvasRenderingContext2D,
  cx:            number,
  cy:            number,
  primaryRadius: number,
  strength:      number,
  tileId:        string,
  sz:            number,
): void {
  // Primary center lobe
  drawRadialInfluence(ctx, cx, cy, primaryRadius, strength);

  // Seeded asymmetric sub-lobes
  const lobes = seededOffsets(tileId);
  for (const lobe of lobes) {
    drawRadialInfluence(
      ctx,
      cx + lobe.dx * sz,
      cy + lobe.dy * sz,
      lobe.scale * sz,
      strength * lobe.strength,
    );
  }
}

/**
 * Colour variant of applyOrganicReveal used by drawFogMaskDev.
 * Draws soft radial patches in `colour` (source-over) instead of destination-out.
 */
function applyOrganicRevealColour(
  ctx:           CanvasRenderingContext2D,
  cx:            number,
  cy:            number,
  primaryRadius: number,
  tileId:        string,
  sz:            number,
  colour:        string,
): void {
  drawRadialColour(ctx, cx, cy, primaryRadius, colour, 1.0);

  const lobes = seededOffsets(tileId);
  for (const lobe of lobes) {
    drawRadialColour(
      ctx,
      cx + lobe.dx * sz,
      cy + lobe.dy * sz,
      lobe.scale * sz,
      colour,
      lobe.strength,
    );
  }
}

/**
 * Draws one soft radial erase influence at (cx, cy) using destination-out.
 *
 * Multi-stop gradient:
 *   0 %  → strong erase (alpha)
 *   35 % → 90 % of alpha
 *   58 % → 62 % of alpha
 *   76 % → 32 % of alpha
 *   90 % → 10 % of alpha
 *   100% → 0 (transparent)
 *
 * @param alpha  Peak erase strength at centre.  0 = no erase, 1 = full erase.
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

/**
 * Dev-only: draws a soft radial patch in `colour` (source-over) at (cx, cy).
 */
function drawRadialColour(
  ctx:    CanvasRenderingContext2D,
  cx:     number,
  cy:     number,
  radius: number,
  colour: string,
  alpha:  number,
): void {
  if (radius <= 0) return;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0.00, colour);
  grad.addColorStop(0.40, colour);
  // Parse alpha into the fade stops
  const a = (alpha * 0.60).toFixed(3);
  const b = (alpha * 0.00).toFixed(3);

  // We can't easily inject alpha into a named colour string, so paint via
  // global alpha instead.
  ctx.save();
  ctx.globalAlpha = alpha;
  const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g2.addColorStop(0.00, colour);
  g2.addColorStop(0.40, colour);
  // Approximate: use transparent at edge via a second stop with rgba
  const fade = colour.startsWith('#')
    ? hexToRgba(colour, 0)
    : colour;
  g2.addColorStop(0.75, fade === colour ? colour : fade);
  g2.addColorStop(1.00, fade === colour ? 'transparent' : fade);
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Suppress unused-variable lint for the simple stops we computed above.
  void a; void b;
}

/** Convert #rrggbb hex to rgba(r,g,b,a) string. */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
