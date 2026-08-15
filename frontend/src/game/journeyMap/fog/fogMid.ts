/**
 * fog/fogMid.ts — Layer 3 Mid Fog canvas drawing logic
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png  (REFERENCE ONLY)
 *
 * ── Role ─────────────────────────────────────────────────────────────────────
 *
 * Mid Fog is NOT the primary concealment layer (that is Base Fog, Layer 2).
 * It adds broad atmospheric texture, giving depth variation and a softer
 * visual transition between fog tiers.
 *
 * Mid MUST NOT contain:
 *   • fillRect covering worldWidth × worldHeight   ← only Base gets that
 *   • solid blue/gray foundation fill              ← same
 *
 * ── Three-state fog behavior ──────────────────────────────────────────────────
 *
 *   VISIBLE_NOW  → eraseStrength 0.98  → texture nearly gone
 *   EXPLORED     → eraseStrength 0.78  → 15–25 % texture remains (adds haze depth)
 *   UNEXPLORED   → no erasure          → full Mid texture (0.50 opacity)
 *
 * ── Shared organic topology ──────────────────────────────────────────────────
 *
 *   Mid uses the SAME seeded lobe positions as Base (same tileId → same profile).
 *   Only erase strength and radius multiplier differ (Mid ≈ 0.95× Base radius).
 *   This produces subtle irregular layering without creating two unrelated reveal
 *   regions — the transition zones overlap without perfectly coinciding.
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web only — HTML5 Canvas 2D.
 */

import { Asset } from 'expo-asset';
import { JOURNEY_ASSETS } from '../assets';
import { buildOrganicRevealInfluences, eraseSoftLobe } from './fogMask';

// ── Bundled asset source ───────────────────────────────────────────────────────
const FOG_MID_DAY_SOURCE = JOURNEY_ASSETS.fog.midDay;

// ── Constants ─────────────────────────────────────────────────────────────────

/** @deprecated Push 3: kept for import compatibility; always 0. */
export const FOG_MID_WORLD_PADDING = 0;

/** Opacity of the fog_mid texture. Lower than Base — Mid is detail, not concealment. */
const MID_TEXTURE_ALPHA = 0.50;

/**
 * Erase strength for EXPLORED tiles (Mid layer).
 * Slightly higher than Base (0.78 vs 0.70) — Mid is lighter texture so
 * more must be removed to keep the explored zone visually coherent.
 * Residual ~20–25 % Mid texture adds depth to the Base haze.
 */
const MID_EXPLORED_STRENGTH = 0.78;

/**
 * Erase strength for VISIBLE_NOW tiles (Mid layer).
 * Same as Base — terrain should be clearly readable in the visible zone.
 */
const MID_VISIBLE_STRENGTH = 0.98;

/**
 * Mid organic cluster radius is slightly narrower than Base (× 0.95).
 * Same seeded lobe positions, subtly different extent → irregular layering.
 */
const MID_RADIUS_MULT = 0.95;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FogMidParams {
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
  if (srcRatio > destRatio) { sw = image.height * destRatio; sx = (image.width - sw) / 2; }
  else                      { sh = image.width / destRatio;  sy = (image.height - sh) / 2; }
  ctx.drawImage(image, sx, sy, sw, sh, destX, destY, destWidth, destHeight);
}

// ── Main draw function ─────────────────────────────────────────────────────────

/**
 * Draws the Mid Fog layer (Layer 3) onto `canvas`.
 *
 * Step 1: Size canvas synchronously.
 * Step 2: Load fog_mid_day_01.png (cached after first call).
 * Step 3: Mid texture only — NO foundation fill (Base has that).
 * Step 4: Direct destination-out organic erasure — same lobe topology as Base,
 *         radius × 0.95, different strength → subtle irregular layering.
 *
 * Async — web only.
 */
export async function drawFogMid(
  canvas: HTMLCanvasElement,
  params: FogMidParams,
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

  // Step 2: Load fog_mid image
  const midImg = await loadBundledImage(FOG_MID_DAY_SOURCE);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, worldWidth, worldHeight);

  // Step 3: Mid texture — NO foundation fill
  ctx.save();
  ctx.globalAlpha = MID_TEXTURE_ALPHA;
  drawImageCover(ctx, midImg, 0, 0, worldWidth, worldHeight);
  ctx.restore();

  // Step 4: Organic erasure — SAME seeded lobe positions as Base (same seed →
  // same profile), radius × MID_RADIUS_MULT, layer-specific strengths.
  // Uses buildOrganicRevealInfluences so Mid EXACTLY matches Base topology.
  ctx.globalCompositeOperation = 'destination-out';

  const lobes = buildOrganicRevealInfluences({
    tileCenters,
    visibleNowIds,
    exploredIds,
    sz,
    effectiveFieldOfVision,
    runSeed,
    exploredStrength: MID_EXPLORED_STRENGTH,
    visibleStrength:  MID_VISIBLE_STRENGTH,
    radiusMultiplier: MID_RADIUS_MULT,
  });

  for (const lobe of lobes) {
    eraseSoftLobe(ctx, lobe.x, lobe.y, lobe.radius, lobe.strength);
  }

  ctx.globalCompositeOperation = 'source-over';
}
