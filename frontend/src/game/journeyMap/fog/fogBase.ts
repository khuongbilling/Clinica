/**
 * fog/fogBase.ts — Layer 2 Base Fog canvas drawing logic
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png  (REFERENCE ONLY)
 *
 * ── Corrective Push: one continuous world field ───────────────────────────────
 *
 * Previous approach stamped many small rectangular sprite copies across the
 * canvas.  This produced visible overlapping fog cards and relied on sprite
 * overlap for coverage (leaving transparent gaps between instances).
 *
 * Current approach:
 *
 *   1. Atmospheric foundation fill  rgba(62, 82, 96, 0.68)
 *      Guarantees 100 % opaque coverage in unexplored space.
 *      No transparent gaps possible regardless of image content.
 *
 *   2. fog_base_day_01.png drawn cover-style across the FULL world rect
 *      ONE draw call.  No grid.  No repeated panels.  No visible seams.
 *
 *   3. Visibility mask (destination-in) punches organic clear / haze areas
 *      for VISIBLE_NOW and EXPLORED tiles respectively.
 *
 * ── Removed: fog_bank_day_01.png ─────────────────────────────────────────────
 *
 *   fog_bank_day_01.png is a reference-sheet image that contains text labels
 *   ("BASE FOG", "FOREGROUND WISPS", asset filenames, etc.).  It was visibly
 *   painting those labels into the live game map.  It is NOT a fog texture.
 *
 *   Do NOT add it back until a clean, label-free asset is generated with
 *   removeBackground:true.  Until then it must live only at:
 *   /assets/dev-reference/fog_bank_system_reference.png
 *
 * ── Approved DAY runtime assets ──────────────────────────────────────────────
 *
 *   fog_base_day_01.png — primary Base Fog texture (PASS)
 *   fog_mid_day_01.png  — Mid Fog texture  (handled by fogMid.ts)
 *   fog_edge_day_01.png — Edge fog         (handled by fogEdge.ts)
 *   fog_wisp_day_01.png — Foreground wisps (handled by fogWisp.ts)
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web only — HTML5 Canvas 2D.
 *   Callers must guard with `Platform.OS === 'web'` before calling drawFogBase.
 */

import { Asset } from 'expo-asset';
import { JOURNEY_ASSETS } from '../assets';
import { drawFogMask, type FogMaskParams } from './fogMask';

// ── Bundled asset source ──────────────────────────────────────────────────────
// Metro-bundled require() number resolved via expo-asset.
// DO NOT use Image.resolveAssetSource — react-native-web throws on Expo web.
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
 * Tuning value — adjust for different shifts once per-shift assets exist.
 */
const DAY_FOUNDATION_COLOR = 'rgba(62, 82, 96, 0.68)';

/**
 * Opacity of the fog_base texture drawn over the foundation.
 * The foundation shows through slightly, softening the single-image look.
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
  /** JourneyRun.seed — used by the caller's cache key; not consumed here. */
  runSeed:                string;
}

// ── Image cache ───────────────────────────────────────────────────────────────

const imageCache = new Map<string, Promise<HTMLImageElement>>();

/**
 * Resolve a Metro-bundled require() number to a web URI via expo-asset, then
 * load it into an HTMLImageElement for canvas drawImage().  Cached per URI.
 *
 * WHY expo-asset and not Image.resolveAssetSource from react-native:
 * react-native-web does not implement resolveAssetSource — it throws
 * "not a function" on Expo web.  expo-asset's Asset.fromModule() has its
 * own cross-platform resolver that works correctly in the Metro dev server.
 *
 * Defensive guard: throws if the URI contains "reference" so a mis-registered
 * reference sheet can never silently render as game fog.
 */
async function loadBundledImage(source: number): Promise<HTMLImageElement> {
  const asset = Asset.fromModule(source);
  if (!asset.uri) await asset.downloadAsync();
  const uri = asset.uri ?? '';

  // Refuse to load reference / design-sheet images as runtime fog.
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

// ── Main draw function ────────────────────────────────────────────────────────

/**
 * Draws the Base Fog layer (Layer 2) onto `canvas`.
 *
 * Step 1: Size canvas synchronously — CSS + backing — before any image await.
 *         Eliminates the DPR first-frame oversize flash (canvas.style.width/height
 *         was previously set only after the async image load resolved).
 *
 * Step 2: Load fog_base_day_01.png (cached after first call).
 *
 * Step 3: Render ONE continuous atmospheric field:
 *           a. Solid atmospheric foundation fill (no transparent gaps possible).
 *           b. fog_base texture drawn cover-style across the full world rect.
 *
 * Step 4: Apply the visibility mask with `destination-in` to reveal
 *         explored / visible-now areas.
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

  // ── Step 2: Load fog_base image (cached after first call) ─────────────────
  const baseImg = await loadBundledImage(FOG_BASE_DAY_SOURCE);

  // ── Step 3: Continuous atmospheric field ─────────────────────────────────
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // setTransform on a freshly-sized canvas (no accumulated scale from prior draw).
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, worldWidth, worldHeight);

  // 3a. Foundation fill — guarantees 100 % opaque coverage everywhere.
  //     The mask (Step 4) will erase it over visible / explored tiles.
  //     Without this fill, transparent PNG edges leave gaps in unexplored fog.
  ctx.fillStyle = DAY_FOUNDATION_COLOR;
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  // 3b. fog_base texture — ONE cover-scale draw across the full world.
  //     No grid.  No repeated rectangular panels.  No visible seams.
  ctx.save();
  ctx.globalAlpha = BASE_TEXTURE_ALPHA;
  drawImageCover(ctx, baseImg, 0, 0, worldWidth, worldHeight);
  ctx.restore();

  // ── Step 4: Apply visibility mask (destination-in) ────────────────────────
  // drawFogMask produces a DPR-backed offscreen canvas exactly worldWidth ×
  // worldHeight.  We draw it at world coords (ctx already has DPR scale applied)
  // by passing explicit world-unit dest dimensions so it maps 1:1.
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
