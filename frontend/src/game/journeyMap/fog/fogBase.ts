/**
 * fog/fogBase.ts — Layer 2 Base Fog canvas drawing logic
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png  (REFERENCE ONLY)
 *
 * ── Role ─────────────────────────────────────────────────────────────────────
 *
 * FogBase is the ONLY layer allowed to guarantee complete unexplored coverage.
 *
 *   1. Atmospheric foundation fill  rgba(62, 82, 96, 0.68)
 *      Guarantees 100 % opaque coverage in unexplored space.
 *      No transparent gaps possible regardless of image content.
 *
 *   2. fog_base_day_01.png drawn cover-style across the FULL world rect.
 *      ONE draw call.  No grid.  No repeated panels.  No visible seams.
 *
 *   3. Direct destination-out erasure for revealed tiles.
 *      destination-out punches transparent holes in the fog canvas itself —
 *      NO separate mask canvas, NO destination-in compositing.
 *      Explored tiles → hard solid-circle erase (permanent clear, no residue).
 *      Visible-now tiles → feathered radial gradient erase (soft boundary).
 *
 * ── Why direct destination-out (not mask + destination-in) ──────────────────
 *
 *   The old mask approach created an offscreen BLACK canvas and composited it
 *   via destination-in.  If the mask canvas size, DPR, or timing was off even
 *   slightly, the raw black canvas was visible as a hard-edged opaque shape.
 *   Direct destination-out eliminates the intermediate surface entirely —
 *   the fog texture is punched directly, like a photoshop soft eraser.
 *
 * ── Approved DAY runtime assets ──────────────────────────────────────────────
 *
 *   fog_base_day_01.png — primary Base Fog texture (PASS)
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web only — HTML5 Canvas 2D.
 *   Callers must guard with `Platform.OS === 'web'` before calling drawFogBase.
 */

import { Asset } from 'expo-asset';
import { JOURNEY_ASSETS } from '../assets';

// ── Bundled asset source ──────────────────────────────────────────────────────
const FOG_BASE_DAY_SOURCE = JOURNEY_ASSETS.fog.baseDay;

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * @deprecated Push 3: canvas is now exactly worldWidth × worldHeight at origin
 * 0,0.  Kept as 0 so existing import references compile without changes.
 */
export const FOG_WORLD_PADDING = 0;

/**
 * Day-time atmospheric foundation colour.
 * Applied as a solid fillRect before the texture so unexplored areas are
 * never transparent regardless of image alpha content.
 */
const DAY_FOUNDATION_COLOR = 'rgba(62, 82, 96, 0.68)';

/**
 * Opacity of the fog_base texture drawn over the foundation.
 */
const BASE_TEXTURE_ALPHA = 0.80;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FogBaseParams {
  worldWidth:             number;
  worldHeight:            number;
  /** Hex tile size (px). */
  sz:                     number;
  tileCenters:            ReadonlyMap<string, { cx: number; cy: number }>;
  visibleNowIds:          ReadonlySet<string>;
  exploredIds:            ReadonlySet<string>;
  effectiveFieldOfVision: number;
  /** JourneyRun.seed — kept for interface stability; not used inside draw. */
  runSeed:                string;
}

// ── Image cache ───────────────────────────────────────────────────────────────

const imageCache = new Map<string, Promise<HTMLImageElement>>();

/**
 * Resolve a Metro-bundled require() number to a web URI via expo-asset, then
 * load it into an HTMLImageElement for canvas drawImage().  Cached per URI.
 *
 * Defensive guard: throws if the URI contains "reference" so a mis-registered
 * reference sheet can never silently render as game fog.
 */
async function loadBundledImage(source: number): Promise<HTMLImageElement> {
  const asset = Asset.fromModule(source);
  if (!asset.uri) await asset.downloadAsync();
  const uri = asset.uri ?? '';

  if (
    uri.includes('reference') ||
    uri.includes('system_reference') ||
    uri.includes('system reference')
  ) {
    throw new Error(
      `[fogBase] Reference image cannot be used as runtime fog: ${uri}`,
    );
  }

  const cached = imageCache.get(uri);
  if (cached) return cached;

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    if (!uri) {
      reject(new Error(`fogBase: asset URI unavailable (source=${source})`));
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`fogBase: failed to load ${uri}`));
    img.src = uri;
  });
  imageCache.set(uri, p);
  return p;
}

// ── Cover-style drawImage ─────────────────────────────────────────────────────

/**
 * Draws `image` into the destination rectangle using CSS cover semantics:
 * the image fills the entire destination, centred and cropped as needed.
 */
function drawImageCover(
  ctx:        CanvasRenderingContext2D,
  image:      HTMLImageElement,
  destX:      number,
  destY:      number,
  destWidth:  number,
  destHeight: number,
): void {
  const srcRatio  = image.width  / image.height;
  const destRatio = destWidth    / destHeight;

  let sx = 0, sy = 0, sw = image.width, sh = image.height;

  if (srcRatio > destRatio) {
    sw = image.height * destRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / destRatio;
    sy = (image.height - sh) / 2;
  }

  ctx.drawImage(image, sx, sy, sw, sh, destX, destY, destWidth, destHeight);
}

// ── Reveal helpers ────────────────────────────────────────────────────────────

/**
 * Applies destination-out erasure to `ctx` for all revealed tiles.
 *
 * destination-out subtracts alpha from the fog canvas directly — no mask
 * canvas, no destination-in.  The fog is punched like a photoshop soft eraser.
 *
 *   EXPLORED tiles   → hard solid-circle erase at alpha=1 (permanent clear)
 *   VISIBLE_NOW tiles → feathered radial gradient erase (soft FOV boundary)
 *
 * Both sets are drawn with destination-out so their effects accumulate — an
 * explored tile inside the visible zone is simply erased twice, which is fine.
 */
function applyFogErasure(
  ctx:                    CanvasRenderingContext2D,
  sz:                     number,
  tileCenters:            ReadonlyMap<string, { cx: number; cy: number }>,
  exploredIds:            ReadonlySet<string>,
  visibleNowIds:          ReadonlySet<string>,
  effectiveFieldOfVision: number,
): void {
  ctx.globalCompositeOperation = 'destination-out';

  // ── Explored: hard permanent erase (no haze residue) ─────────────────────
  // Radius sz × 0.88 covers the hex body.  Adjacent explored tiles overlap
  // naturally, merging into one continuous clear region.
  const exploredR = sz * 0.88;
  ctx.fillStyle = 'rgba(0,0,0,1)';

  for (const id of exploredIds) {
    const c = tileCenters.get(id);
    if (!c) continue;
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, exploredR, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Visible-now: feathered gradient erase (soft edge at FOV boundary) ────
  // fovScale extends the inner clear radius for FOV > 1.
  //   FOV=1 → fovInnerR ≈ sz × 1.45  (current tile + 6 adjacent)
  //   FOV=2 → fovInnerR ≈ sz × 2.25
  // The gradient is alpha=1 from center → fovInnerR, then fades to 0 at
  // fovOuterR — a soft-eraser ring only at the outer boundary.
  const fovScale  = 1 + (effectiveFieldOfVision - 1) * 0.55;
  const fovInnerR = sz * 1.45 * fovScale;
  const featherW  = sz * 0.60;
  const fovOuterR = fovInnerR + featherW;
  const innerFrac = fovInnerR / fovOuterR;

  for (const id of visibleNowIds) {
    const c = tileCenters.get(id);
    if (!c) continue;

    const grad = ctx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, fovOuterR);
    grad.addColorStop(0,          'rgba(0,0,0,1)'); // center: full erase
    grad.addColorStop(innerFrac,  'rgba(0,0,0,1)'); // inner edge: still full
    grad.addColorStop(1,          'rgba(0,0,0,0)'); // outer edge: no erase
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, fovOuterR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
}

// ── Main draw function ────────────────────────────────────────────────────────

/**
 * Draws the Base Fog layer (Layer 2) onto `canvas`.
 *
 * Step 1: Size canvas synchronously — CSS + backing — before any image await.
 * Step 2: Load fog_base_day_01.png (cached after first call).
 * Step 3: Render ONE continuous atmospheric field:
 *           a. Solid atmospheric foundation fill (no transparent gaps possible).
 *           b. fog_base texture drawn cover-style across the full world rect.
 * Step 4: Punch transparent holes with destination-out directly on this canvas:
 *           a. Explored tiles → hard full-erase circles (permanent clear).
 *           b. Visible-now tiles → feathered radial gradient erase (soft edge).
 *
 * No mask canvas.  No destination-in.  Transparent holes show the map layer
 * beneath this canvas (z < 5000) — terrain, player sprite, encounters.
 *
 * Async — awaits image load on first call; subsequent calls use the cache.
 * Web only — wraps HTMLCanvasElement.getContext('2d').
 */
export async function drawFogBase(
  canvas: HTMLCanvasElement,
  params: FogBaseParams,
): Promise<void> {
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

  // ── Step 1: Size canvas SYNCHRONOUSLY (before any await) ─────────────────
  canvas.style.position = 'absolute';
  canvas.style.left     = '0px';
  canvas.style.top      = '0px';
  canvas.style.width    = `${worldWidth}px`;
  canvas.style.height   = `${worldHeight}px`;
  canvas.width  = Math.ceil(worldWidth  * DPR);
  canvas.height = Math.ceil(worldHeight * DPR);

  // ── Step 2: Load fog_base image (cached after first call) ─────────────────
  const baseImg = await loadBundledImage(FOG_BASE_DAY_SOURCE);

  // ── Step 3: Continuous atmospheric field ─────────────────────────────────
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, worldWidth, worldHeight);

  // 3a. Foundation fill — guarantees 100 % opaque coverage everywhere.
  ctx.fillStyle = DAY_FOUNDATION_COLOR;
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  // 3b. fog_base texture — ONE cover-scale draw across the full world.
  ctx.save();
  ctx.globalAlpha = BASE_TEXTURE_ALPHA;
  drawImageCover(ctx, baseImg, 0, 0, worldWidth, worldHeight);
  ctx.restore();

  // ── Step 4: Direct destination-out erasure ────────────────────────────────
  // Punches transparent holes in the fog canvas for explored / visible tiles.
  // The canvas is fully opaque after Step 3; after Step 4 the punched regions
  // are transparent, exposing the map (terrain / player / encounters) below.
  applyFogErasure(ctx, sz, tileCenters, exploredIds, visibleNowIds, effectiveFieldOfVision);
}
