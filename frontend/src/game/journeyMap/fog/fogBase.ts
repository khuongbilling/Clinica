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
 *
 *   2. fog_base_day_01.png drawn cover-style across the FULL world rect.
 *
 *   3. Direct destination-out organic erasure for each revealed tile.
 *
 * ── Three-state fog behavior ──────────────────────────────────────────────────
 *
 *   VISIBLE_NOW  → eraseStrength 0.98  → 0–5 % perceived fog
 *   EXPLORED     → eraseStrength 0.70  → 20–40 % memory haze remains
 *   UNEXPLORED   → no erasure          → 80–95 % dense fog
 *
 * ── Organic erasure (no mask canvas) ─────────────────────────────────────────
 *
 *   destination-out is applied DIRECTLY to the fog canvas.  No intermediate
 *   mask surface, no destination-in.  eraseOrganicFogCluster() (fogMask.ts)
 *   places one central lobe + 4–5 seeded asymmetric secondary lobes per tile.
 *   Adjacent tiles' clusters overlap naturally into ONE contiguous clearing.
 *
 *   Base and Mid share the SAME lobe positions (same tileId seed) so their
 *   organic reveals are pixel-geometrically identical — only strength differs.
 *
 * ── Approved DAY runtime assets ──────────────────────────────────────────────
 *
 *   fog_base_day_01.png — primary Base Fog texture (PASS)
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web only — HTML5 Canvas 2D.
 */

import { Asset } from 'expo-asset';
import { JOURNEY_ASSETS } from '../assets';
import { buildOrganicRevealInfluences, eraseSoftLobe } from './fogMask';

// ── Bundled asset source ──────────────────────────────────────────────────────
const FOG_BASE_DAY_SOURCE = JOURNEY_ASSETS.fog.baseDay;

// ── Constants ─────────────────────────────────────────────────────────────────

/** @deprecated Push 3: kept for import compatibility; always 0. */
export const FOG_WORLD_PADDING = 0;

/** Day-time atmospheric foundation colour (100 % opaque unexplored coverage). */
const DAY_FOUNDATION_COLOR = 'rgba(62, 82, 96, 0.68)';

/** Opacity of the fog_base texture drawn over the foundation. */
const BASE_TEXTURE_ALPHA = 0.80;

/**
 * Erase strength for EXPLORED tiles (Base layer).
 * ~0.70 → roughly 25–35 % fog haze remains — readable terrain through mist.
 */
const BASE_EXPLORED_STRENGTH = 0.70;

/**
 * Erase strength for VISIBLE_NOW tiles (Base layer).
 * ~0.98 → fog nearly gone — clear terrain and character readable.
 */
const BASE_VISIBLE_STRENGTH = 0.98;

/** Primary organic cluster radius for explored tiles (Base). */
const BASE_EXPLORED_RADIUS_MULT = 1.2;

/** Primary organic cluster radius for visible-now tiles (Base). */
const BASE_VISIBLE_RADIUS_MULT  = 1.45;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FogBaseParams {
  worldWidth:             number;
  worldHeight:            number;
  sz:                     number;
  tileCenters:            ReadonlyMap<string, { cx: number; cy: number }>;
  visibleNowIds:          ReadonlySet<string>;
  exploredIds:            ReadonlySet<string>;
  effectiveFieldOfVision: number;
  /** JourneyRun seed — threaded through as tile-id seed prefix. */
  runSeed:                string;
}

// ── Image cache ───────────────────────────────────────────────────────────────

const imageCache = new Map<string, Promise<HTMLImageElement>>();

async function loadBundledImage(source: number): Promise<HTMLImageElement> {
  const asset = Asset.fromModule(source);
  if (!asset.uri) await asset.downloadAsync();
  const uri = asset.uri ?? '';

  if (
    uri.includes('reference') ||
    uri.includes('system_reference') ||
    uri.includes('system reference')
  ) {
    throw new Error(`[fogBase] Reference image cannot be used as runtime fog: ${uri}`);
  }

  const cached = imageCache.get(uri);
  if (cached) return cached;

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    if (!uri) { reject(new Error(`fogBase: asset URI unavailable (source=${source})`)); return; }
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
  if (srcRatio > destRatio) { sw = image.height * destRatio; sx = (image.width - sw) / 2; }
  else                      { sh = image.width / destRatio;  sy = (image.height - sh) / 2; }
  ctx.drawImage(image, sx, sy, sw, sh, destX, destY, destWidth, destHeight);
}

// ── Organic erasure ───────────────────────────────────────────────────────────

/**
 * Applies destination-out organic erasure to the fog canvas for all revealed tiles.
 *
 * Uses buildOrganicRevealInfluences (the single source of truth for lobe data)
 * so the production erase footprint EXACTLY matches the ALPHA debug overlay.
 *
 * EXPLORED tiles:
 *   Partial erase (strength 0.70) → ~25–35 % haze remains.
 *   Memory-fog: terrain readable but distinctly veiled.
 *
 * VISIBLE_NOW tiles:
 *   Strong erase (strength 0.98) → nearly clear center.
 *   Adjacent tile clusters overlap into ONE organic clearing (no hex holes).
 *   Soft feathered boundary produced by asymmetric secondary lobes.
 */
function applyFogErasure(
  ctx:                    CanvasRenderingContext2D,
  sz:                     number,
  tileCenters:            ReadonlyMap<string, { cx: number; cy: number }>,
  exploredIds:            ReadonlySet<string>,
  visibleNowIds:          ReadonlySet<string>,
  effectiveFieldOfVision: number,
  runSeed:                string,
): void {
  ctx.globalCompositeOperation = 'destination-out';

  const lobes = buildOrganicRevealInfluences({
    tileCenters,
    visibleNowIds,
    exploredIds,
    sz,
    effectiveFieldOfVision,
    runSeed,
    exploredStrength: BASE_EXPLORED_STRENGTH,
    visibleStrength:  BASE_VISIBLE_STRENGTH,
    radiusMultiplier: 1.0,
  });

  for (const lobe of lobes) {
    eraseSoftLobe(ctx, lobe.x, lobe.y, lobe.radius, lobe.strength);
  }

  ctx.globalCompositeOperation = 'source-over';
}

// ── Main draw function ────────────────────────────────────────────────────────

/**
 * Draws the Base Fog layer (Layer 2) onto `canvas`.
 *
 * Step 1: Size canvas synchronously.
 * Step 2: Load fog_base_day_01.png (cached after first call).
 * Step 3: Foundation fill + fog texture → 100 % opaque everywhere.
 * Step 4: Direct destination-out organic erasure:
 *           Explored → partial (haze remains).
 *           Visible-now → strong (one contiguous organic clearing).
 *
 * Async — web only.
 */
export async function drawFogBase(
  canvas: HTMLCanvasElement,
  params: FogBaseParams,
): Promise<void> {
  const {
    worldWidth, worldHeight, sz,
    tileCenters, visibleNowIds, exploredIds,
    effectiveFieldOfVision, runSeed,
  } = params;

  const DPR = typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1;

  // Step 1: Size canvas synchronously
  canvas.style.position = 'absolute';
  canvas.style.left     = '0px';
  canvas.style.top      = '0px';
  canvas.style.width    = `${worldWidth}px`;
  canvas.style.height   = `${worldHeight}px`;
  canvas.width  = Math.ceil(worldWidth  * DPR);
  canvas.height = Math.ceil(worldHeight * DPR);

  // Step 2: Load fog_base image
  const baseImg = await loadBundledImage(FOG_BASE_DAY_SOURCE);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, worldWidth, worldHeight);

  // Step 3: Atmospheric field
  ctx.fillStyle = DAY_FOUNDATION_COLOR;
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  ctx.save();
  ctx.globalAlpha = BASE_TEXTURE_ALPHA;
  drawImageCover(ctx, baseImg, 0, 0, worldWidth, worldHeight);
  ctx.restore();

  // Step 4: Organic erasure
  applyFogErasure(ctx, sz, tileCenters, exploredIds, visibleNowIds, effectiveFieldOfVision, runSeed);
}
