/**
 * fog/fogOfWar.ts — single-canvas FogOfWarLayer drawing logic
 *
 * Push 2 — draw one continuous full-map fog field (no reveal yet).
 *
 * Drawing order (every redraw):
 *   1. Clear canvas
 *   2. DPR-scale context
 *   3. Atmospheric foundation fill   rgba(55, 72, 86, 0.82)
 *   4. fog_base_day_01.png drawn ONCE cover-style across the full world rect
 *      at textureAlpha 0.45
 *
 * Rules:
 *   • ONE canvas, ONE texture, ONE cover draw — no grid, no stamps, no tiles.
 *   • Only fog_base_day_01.png is loaded; any URI containing "reference" is
 *     rejected before network I/O begins.
 *   • Future pushes add reveal by erasing into this surface (destination-out).
 *
 * Platform: web only — caller (FogOfWarLayer) is already gated on Platform.OS.
 */

import { Asset } from 'expo-asset';
import { JOURNEY_ASSETS } from '../assets';

// ── Asset source ──────────────────────────────────────────────────────────────

/** Only approved day-time base texture. Never load mid / edge / wisp here. */
const FOG_BASE_DAY_SOURCE = JOURNEY_ASSETS.fog.baseDay;

// ── Tuning constants (easy to adjust for art direction) ───────────────────────

/** Atmospheric foundation colour — warm blue-grey at high opacity.
 *  Keeps the map readable (not nearly black) while providing full coverage. */
const FOUNDATION_COLOR = 'rgba(55, 72, 86, 0.82)';

/** Opacity of the base texture drawn over the foundation.
 *  Range 0.40–0.50 — provides mist depth without obscuring the foundation tint. */
const TEXTURE_ALPHA = 0.45;

// ── Image cache ───────────────────────────────────────────────────────────────

const imageCache = new Map<string, Promise<HTMLImageElement>>();

/**
 * Loads a bundled Expo asset as an HTMLImageElement.
 *
 * Asset guard: rejects any URI containing "reference", "system_reference", or
 * "system reference" — prevents dev-reference sheets from ever reaching the
 * live canvas.
 */
async function loadBundledImage(source: number): Promise<HTMLImageElement> {
  const asset = Asset.fromModule(source);
  if (!asset.uri) await asset.downloadAsync();
  const uri = asset.uri ?? '';

  // ── ASSET GUARD ───────────────────────────────────────────────────────────
  if (
    uri.includes('reference') ||
    uri.includes('system_reference') ||
    uri.includes('system reference')
  ) {
    throw new Error(`[fogOfWar] Reference image rejected as runtime fog: ${uri}`);
  }

  const cached = imageCache.get(uri);
  if (cached) return cached;

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    if (!uri) { reject(new Error(`[fogOfWar] Asset URI unavailable (source=${source})`)); return; }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`[fogOfWar] Failed to load: ${uri}`));
    img.src = uri;
  });
  imageCache.set(uri, p);
  return p;
}

// ── Cover-style drawImage ─────────────────────────────────────────────────────

/**
 * Draws `image` scaled to fill (destWidth × destHeight) starting at (destX, destY),
 * cropping to maintain aspect ratio — identical behaviour to CSS `object-fit:cover`.
 *
 * One call per redraw — do NOT loop or tile.
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

// ── Public draw params ────────────────────────────────────────────────────────

export interface FogOfWarParams {
  /** CSS / world dimensions — drawing space before DPR scaling. */
  worldWidth:  number;
  worldHeight: number;
}

// ── Main draw function ────────────────────────────────────────────────────────

/**
 * Draws one continuous full-map fog field onto `canvas`.
 *
 * Async because it must load the base texture on first call (cached thereafter).
 *
 * Push 2: no reveal — the entire canvas is covered with atmospheric fog.
 * Push 3+ will add destination-out erasure for revealed tiles after this call.
 */
export async function drawFogOfWar(
  canvas:                HTMLCanvasElement,
  { worldWidth, worldHeight }: FogOfWarParams,
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const DPR = window.devicePixelRatio ?? 1;

  // ── 1. Clear ──────────────────────────────────────────────────────────────
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── 2. DPR-scale context ──────────────────────────────────────────────────
  // Canvas backing is ceil(worldWidth*DPR) × ceil(worldHeight*DPR).
  // All drawing uses world-space units (0..worldWidth, 0..worldHeight).
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // ── 3. Atmospheric foundation ─────────────────────────────────────────────
  // One full-world fillRect at FOUNDATION_COLOR.
  // Guarantees continuous coverage — no gaps, no seams, no transparency leaks.
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = FOUNDATION_COLOR;
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  // ── 4. Base texture — ONE cover draw ─────────────────────────────────────
  // Load fog_base_day_01.png (asset guard runs inside loadBundledImage).
  // Draw ONCE across the full world; no grid, no stamps, no repeated panels.
  let image: HTMLImageElement;
  try {
    image = await loadBundledImage(FOG_BASE_DAY_SOURCE);
  } catch (err) {
    // Asset load failed — foundation colour still provides full coverage.
    console.warn('[fogOfWar] Base texture unavailable; foundation-only fog rendered.', err);
    return;
  }

  ctx.globalAlpha = TEXTURE_ALPHA;
  drawImageCover(ctx, image, 0, 0, worldWidth, worldHeight);

  // Restore defaults for any subsequent drawing passes (Push 3+).
  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
