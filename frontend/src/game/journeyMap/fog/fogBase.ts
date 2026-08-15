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
 *   3. Canonical visibility mask (destination-in) punches organic clear / haze
 *      areas for VISIBLE_NOW and EXPLORED tiles respectively.
 *
 * ── Shared canonical mask ─────────────────────────────────────────────────────
 *
 *   Uses getOrDrawCanonicalMask() — one shared offscreen canvas per visibility
 *   state, keyed by buildFogMaskCacheKey.  Base, Mid and Wisp all receive the
 *   SAME canvas reference → pixel-perfect geometric identity.
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
import {
  buildFogMaskCacheKey,
  getOrDrawCanonicalMask,
  type FogMaskParams,
} from './fogMask';

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
  /** Hex tile size (px) — used by the mask, not by the base draw. */
  sz:                     number;
  tileCenters:            ReadonlyMap<string, { cx: number; cy: number }>;
  visibleNowIds:          ReadonlySet<string>;
  exploredIds:            ReadonlySet<string>;
  effectiveFieldOfVision: number;
  /** JourneyRun.seed — used for canonical mask cache key. */
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

// ── Main draw function ────────────────────────────────────────────────────────

/**
 * Draws the Base Fog layer (Layer 2) onto `canvas`.
 *
 * Step 1: Size canvas synchronously — CSS + backing — before any image await.
 * Step 2: Load fog_base_day_01.png (cached after first call).
 * Step 3: Render ONE continuous atmospheric field:
 *           a. Solid atmospheric foundation fill (no transparent gaps possible).
 *           b. fog_base texture drawn cover-style across the full world rect.
 * Step 4: Apply the CANONICAL visibility mask with `destination-in` to reveal
 *         explored / visible-now areas.
 *
 * The canonical mask is shared with Mid and Wisp via getOrDrawCanonicalMask()
 * so all three layers erase EXACTLY the same geometry.
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
    runSeed,
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

  // ── Step 4: Apply CANONICAL visibility mask (destination-in) ─────────────
  // getOrDrawCanonicalMask returns (or creates) a shared offscreen canvas so
  // Base, Mid and Wisp erase EXACTLY the same pixels for the same game state.
  const maskParams: FogMaskParams = {
    worldWidth,
    worldHeight,
    sz,
    tileCenters,
    visibleNowIds,
    exploredIds,
    effectiveFieldOfVision,
  };
  const maskCacheKey = buildFogMaskCacheKey({
    runId:                  runSeed,
    worldWidth,
    worldHeight,
    tileSize:               sz,
    effectiveFieldOfVision,
    visibleNowIds,
    exploredIds,
  });
  const maskCanvas = getOrDrawCanonicalMask(maskCacheKey, maskParams);

  ctx.globalCompositeOperation = 'destination-in';
  ctx.globalAlpha = 1;
  ctx.drawImage(maskCanvas, 0, 0, worldWidth, worldHeight);
  ctx.globalCompositeOperation = 'source-over';
}
