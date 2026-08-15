/**
 * fog/fogMid.ts — Layer 3 Mid Fog canvas drawing logic
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png  (REFERENCE ONLY)
 *
 * ── Role ─────────────────────────────────────────────────────────────────────
 *
 * Mid Fog is NOT the primary concealment layer (that is Base Fog, Layer 2).
 * It adds a broad atmospheric texture across the full world canvas, giving
 * depth variation and a softer visual transition between fog tiers.
 *
 * ── Corrective Push: one continuous world field ───────────────────────────────
 *
 * Previous approach stamped many small rectangular sprite copies across the
 * canvas (same grid-stamp bug that was fixed in fogBase).  This produced
 * visible overlapping fog cards and rectangular panel seams.
 *
 * Current approach matches fogBase exactly:
 *
 *   1. Canvas sized SYNCHRONOUSLY before any image await — eliminates
 *      the DPR first-frame oversize flash.
 *
 *   2. fog_mid_day_01.png drawn cover-style across the FULL world rect.
 *      ONE draw call.  No grid.  No repeated panels.  No visible seams.
 *
 *   3. Visibility mask (destination-in) punches organic clear / haze areas
 *      for VISIBLE_NOW and EXPLORED tiles respectively.
 *
 * ── Opacity vs Base Fog ───────────────────────────────────────────────────────
 *
 *   Base Fog:  foundation rgba(62,82,96,0.68) + texture 0.80 (primary concealment)
 *   Mid  Fog:  texture 0.50 (atmospheric detail — no additional foundation fill
 *              needed because Base already provides 100% coverage beneath)
 *
 * ── Clearing behaviour ───────────────────────────────────────────────────────
 *
 *   UNEXPLORED  → Mid Fog stacks over Base Fog  (full mask opacity)
 *   EXPLORED    → small amount may remain as memory haze
 *                 (~30 % mask residual × 0.50 texture alpha → subtle)
 *   VISIBLE_NOW → almost fully clear
 *                 (~3 % mask residual × lower opacity → effectively invisible)
 *
 * ── Asset ─────────────────────────────────────────────────────────────────────
 *
 *   fog_mid_day_01.png — PASS (zero color bleed, clean RGBA)
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web only — HTML5 Canvas 2D.
 */

import { Asset } from 'expo-asset';
import { JOURNEY_ASSETS } from '../assets';
import { drawFogMask, type FogMaskParams } from './fogMask';

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
  /** JourneyRun seed — included for cache-key parity with FogBase; not used for drawing. */
  runSeed:                string;
}

// ── Image cache ───────────────────────────────────────────────────────────────

const imageCache = new Map<string, Promise<HTMLImageElement>>();

/** Same resolver pattern as fogBase — uses expo-asset, not resolveAssetSource. */
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

/**
 * Draws `image` into the destination rectangle using CSS cover semantics:
 * the image fills the entire destination, centred and cropped as needed.
 * No distortion, no letterboxing.
 *
 * All coordinates are in world units (ctx already has DPR scale applied).
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
    // Image is wider than dest proportionally — crop left/right.
    sw = image.height * destRatio;
    sx = (image.width - sw) / 2;
  } else {
    // Image is taller than dest proportionally — crop top/bottom.
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
 *         Eliminates the DPR first-frame oversize flash (matches fogBase fix).
 *
 * Step 2: Load fog_mid_day_01.png (cached after first call).
 *
 * Step 3: ONE continuous atmospheric texture:
 *           fog_mid texture drawn cover-style across the full world rect.
 *           No grid.  No repeated rectangular panels.  No visible seams.
 *
 * Step 4: Apply the visibility mask with `destination-in` to reveal
 *         explored / visible-now areas.
 *
 * Async — awaits image load on first call; subsequent calls use the cache.
 * Web only — wraps HTMLCanvasElement.getContext('2d').
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
  // Setting CSS dimensions here — not after the image-load await — means the
  // canvas is the correct display size on every frame from first paint.
  canvas.style.position = 'absolute';
  canvas.style.left     = '0px';
  canvas.style.top      = '0px';
  canvas.style.width    = `${worldWidth}px`;
  canvas.style.height   = `${worldHeight}px`;
  // Assigning .width/.height resets the canvas context; do it before getContext().
  canvas.width  = Math.ceil(worldWidth  * DPR);
  canvas.height = Math.ceil(worldHeight * DPR);

  // ── Step 2: Load fog_mid image (cached after first call) ─────────────────
  const midImg = await loadBundledImage(FOG_MID_DAY_SOURCE);

  // ── Step 3: Continuous atmospheric texture ────────────────────────────────
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // setTransform on a freshly-sized canvas (no accumulated scale from prior draw).
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, worldWidth, worldHeight);

  // fog_mid texture — ONE cover-scale draw across the full world.
  // No grid.  No repeated rectangular panels.  No visible seams.
  // Base Fog already provides opaque coverage; Mid adds atmospheric texture.
  ctx.save();
  ctx.globalAlpha = MID_TEXTURE_ALPHA;
  drawImageCover(ctx, midImg, 0, 0, worldWidth, worldHeight);
  ctx.restore();

  // ── Step 4: Apply visibility mask (destination-in) ────────────────────────
  // Same pattern as fogBase — offscreen mask at world dimensions.
  const maskCanvas = document.createElement('canvas');
  const maskParams: FogMaskParams = {
    worldWidth,
    worldHeight,
    sz,
    tileCenters,
    visibleNowIds,
    exploredIds,
    effectiveFieldOfVision,
  };
  drawFogMask(maskCanvas, maskParams);

  ctx.globalCompositeOperation = 'destination-in';
  ctx.globalAlpha = 1;
  ctx.drawImage(maskCanvas, 0, 0, worldWidth, worldHeight);
  ctx.globalCompositeOperation = 'source-over';
}
