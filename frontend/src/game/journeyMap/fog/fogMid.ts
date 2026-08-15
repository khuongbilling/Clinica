/**
 * fog/fogMid.ts — Layer 3 Mid Fog canvas drawing logic
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png  (REFERENCE ONLY)
 *
 * ── Role ─────────────────────────────────────────────────────────────────────
 *
 * Mid Fog is NOT the primary concealment layer (that is Base Fog, Layer 2).
 * It adds broad atmospheric texture across the world canvas, giving depth
 * variation and a softer visual transition between fog tiers.
 *
 * Mid MUST NOT contain:
 *   • fillRect covering worldWidth × worldHeight      ← only Base gets that
 *   • solid blue/gray foundation fill                 ← same
 *   • opaque fallback rectangle                       ← same
 *
 * ── Opacity targets ──────────────────────────────────────────────────────────
 *
 *   UNEXPLORED   → Mid alpha 0.35–0.55 (texture at MID_TEXTURE_ALPHA)
 *   EXPLORED     → transparent (fog erased by destination-out)
 *   VISIBLE_NOW  → transparent (fog erased by feathered gradient)
 *
 * ── Direct erasure (no mask canvas) ──────────────────────────────────────────
 *
 *   Uses the same destination-out erasure as FogBase — punches transparent
 *   holes directly in the fog canvas.  No separate mask canvas, no
 *   destination-in compositing.  Explored tiles are hard-erased; visible-now
 *   tiles get a feathered radial gradient.
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web only — HTML5 Canvas 2D.
 */

import { Asset } from 'expo-asset';
import { JOURNEY_ASSETS } from '../assets';

// ── Bundled asset source ───────────────────────────────────────────────────────
const FOG_MID_DAY_SOURCE = JOURNEY_ASSETS.fog.midDay;

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * @deprecated Push 3: canvas is now exactly worldWidth × worldHeight at origin 0,0.
 * Kept as 0 so existing import references compile without changes.
 */
export const FOG_MID_WORLD_PADDING = 0;

/**
 * Opacity of the fog_mid texture drawn over the full world rect.
 * Lower than Base Fog's 0.80 — Mid is atmospheric detail, not concealment.
 * Base already provides 100 % opaque coverage; Mid adds texture variation.
 */
const MID_TEXTURE_ALPHA = 0.50;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FogMidParams {
  worldWidth:             number;
  worldHeight:            number;
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

async function loadBundledImage(source: number): Promise<HTMLImageElement> {
  const asset = Asset.fromModule(source);
  if (!asset.uri) await asset.downloadAsync();
  const uri = asset.uri ?? '';

  const cached = imageCache.get(uri);
  if (cached) return cached;

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    if (!uri) { reject(new Error(`fogMid: asset URI unavailable (source=${source})`)); return; }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`fogMid: failed to load ${uri}`));
    img.src     = uri;
  });
  imageCache.set(uri, p);
  return p;
}

// ── Cover-style drawImage ─────────────────────────────────────────────────────

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

// ── Main draw function ─────────────────────────────────────────────────────────

/**
 * Draws the Mid Fog layer (Layer 3) onto `canvas`.
 *
 * Step 1: Size canvas SYNCHRONOUSLY — CSS + backing — before any image await.
 * Step 2: Load fog_mid_day_01.png (cached after first call).
 * Step 3: ONE continuous atmospheric texture — fog_mid drawn cover-style.
 *         No foundation fill (only Base has that).
 * Step 4: Direct destination-out erasure — same geometry as FogBase.
 *           Explored tiles → hard full-erase circles (permanent clear).
 *           Visible-now tiles → feathered radial gradient erase.
 *
 * No mask canvas.  No destination-in.  Transparent holes expose the layers
 * below (FogBase at z 5000, map terrain at z 100–400, etc.).
 *
 * Async — awaits image load on first call; subsequent calls use the cache.
 * Web only.
 */
export async function drawFogMid(
  canvas: HTMLCanvasElement,
  params: FogMidParams,
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

  // ── Step 2: Load fog_mid image (cached after first call) ─────────────────
  const midImg = await loadBundledImage(FOG_MID_DAY_SOURCE);

  // ── Step 3: Atmospheric texture (no foundation fill) ─────────────────────
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, worldWidth, worldHeight);

  // NO fillRect here — only Base gets the opaque foundation.
  ctx.save();
  ctx.globalAlpha = MID_TEXTURE_ALPHA;
  drawImageCover(ctx, midImg, 0, 0, worldWidth, worldHeight);
  ctx.restore();

  // ── Step 4: Direct destination-out erasure ────────────────────────────────
  // Matches Base Fog geometry exactly — same fovScale, same radii.
  ctx.globalCompositeOperation = 'destination-out';

  // Explored: hard permanent erase
  const exploredR = sz * 0.88;
  ctx.fillStyle = 'rgba(0,0,0,1)';
  for (const id of exploredIds) {
    const c = tileCenters.get(id);
    if (!c) continue;
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, exploredR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Visible-now: feathered gradient erase (soft edge at FOV boundary)
  const fovScale  = 1 + (effectiveFieldOfVision - 1) * 0.55;
  const fovInnerR = sz * 1.45 * fovScale;
  const featherW  = sz * 0.60;
  const fovOuterR = fovInnerR + featherW;
  const innerFrac = fovInnerR / fovOuterR;

  for (const id of visibleNowIds) {
    const c = tileCenters.get(id);
    if (!c) continue;

    const grad = ctx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, fovOuterR);
    grad.addColorStop(0,          'rgba(0,0,0,1)');
    grad.addColorStop(innerFrac,  'rgba(0,0,0,1)');
    grad.addColorStop(1,          'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, fovOuterR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
}
