/**
 * fog/fogMid.ts — Layer 3 Mid Fog canvas drawing logic
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png  (REFERENCE ONLY)
 *
 * ── Role ─────────────────────────────────────────────────────────────────────
 *
 * Mid Fog is NOT the primary concealment layer (that is Base Fog, Layer 2).
 * It adds:
 *   • atmospheric texture across unexplored terrain
 *   • internal density variation (so Base Fog doesn't look like one cloud)
 *   • softer visual transition between fog tiers
 *   • smoky detail at a finer scale than Base Fog
 *
 * ── Opacity vs Base Fog ───────────────────────────────────────────────────────
 *
 *   Base Fog:  0.70–0.90  (primary concealment)
 *   Mid  Fog:  0.30–0.60  (texture / detail overlay)
 *
 * ── Clearing behaviour ───────────────────────────────────────────────────────
 *
 *   UNEXPLORED  → Mid Fog stacks over Base Fog  (full mask opacity)
 *   EXPLORED    → small amount may remain as memory haze
 *                 (~45 % mask residual × 0.30–0.60 instance opacity → subtle)
 *   VISIBLE_NOW → almost fully clear
 *                 (~7 % mask residual × lower opacity → effectively invisible)
 *
 * ── Asset ─────────────────────────────────────────────────────────────────────
 *
 *   fog_mid_day_01.png — PASS (zero color bleed, clean RGBA)
 *
 * ── Coverage strategy ────────────────────────────────────────────────────────
 *
 *   Smaller cell grid than Base Fog (MID_CELL_TILES = 3.5 vs Base's 4.5)
 *   → more instances → finer texture / denser overlap.
 *   Scale range 0.65–1.1 relative to a reference of sz × 5 tiles.
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web only — HTML5 Canvas 2D.
 */

import { drawFogMask, type FogMaskParams } from './fogMask';

// ── Asset path ────────────────────────────────────────────────────────────────

export const FOG_MID_DAY_SRC = '/assets/journey/fog/day/fog_mid_day_01.png';

// ── Layout constants ──────────────────────────────────────────────────────────

/** Grid cell width in tile-size multiples (smaller than Base Fog for finer texture). */
const MID_CELL_TILES = 3.5;

/** Reference tile-width at "1.0 scale" — midpoint of Base Fog's 4–8 range. */
const MID_REF_TILES = 5;

/** Minimum rendered width: 0.65 × reference. */
const MID_W_MIN_TILES = MID_REF_TILES * 0.65; // ~3.25 × sz

/** Maximum rendered width: 1.1 × reference. */
const MID_W_MAX_TILES = MID_REF_TILES * 1.10; // ~5.5 × sz

/** Natural aspect ratio of fog_mid image (1536 × 1024). */
const FOG_MID_ASPECT = 1536 / 1024;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FogMidParams {
  worldWidth:             number;
  worldHeight:            number;
  sz:                     number;
  tileCenters:            ReadonlyMap<string, { cx: number; cy: number }>;
  visibleNowIds:          ReadonlySet<string>;
  exploredIds:            ReadonlySet<string>;
  effectiveFieldOfVision: number;
  runSeed:                string;
}

// ── Seeded random ─────────────────────────────────────────────────────────────

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223;
    s = s >>> 0;
    return s / 0x100000000;
  };
}

// ── Image cache ───────────────────────────────────────────────────────────────

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src     = src;
  });
  imageCache.set(src, p);
  return p;
}

// ── Main draw function ─────────────────────────────────────────────────────────

/**
 * Draws the Mid Fog layer (Layer 3) onto `canvas`.
 *
 * Step 1: Load fog_mid image (cached after first call).
 * Step 2: Size canvas to worldW × worldH.
 * Step 3: Draw overlapping mid fog instances (finer grid vs Base Fog).
 * Step 4: Apply the Push-3 visibility mask with `destination-in`.
 *
 * Mid Fog uses a different seed namespace (`':fogmid'`) from Base Fog
 * (`':fogbase'`) so instance positions never coincide — each layer has
 * independent variation for a true atmospheric layering effect.
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
    runSeed,
  } = params;

  const midImg = await loadImage(FOG_MID_DAY_SRC);

  canvas.width  = Math.ceil(worldWidth);
  canvas.height = Math.ceil(worldHeight);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── Fog instances ─────────────────────────────────────────────────────────
  const cellSize = sz * MID_CELL_TILES;
  const cols     = Math.ceil(worldWidth  / cellSize) + 2;
  const rows     = Math.ceil(worldHeight / cellSize) + 2;

  // Separate seed namespace from Base Fog so layers never share a placement.
  const rand = seededRandom(hashString(runSeed + ':fogmid'));

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      // Grid centre + seeded jitter (up to ±50% of cell — slightly more than base)
      const cx = (col + 0.5) * cellSize + (rand() - 0.5) * cellSize * 1.0;
      const cy = (row + 0.5) * cellSize + (rand() - 0.5) * cellSize * 1.0;

      const wTiles = MID_W_MIN_TILES + rand() * (MID_W_MAX_TILES - MID_W_MIN_TILES);
      const w      = sz * wTiles;
      const h      = w / FOG_MID_ASPECT;

      // Rotation: −10° … +10°
      const angle  = (rand() * 20 - 10) * (Math.PI / 180);

      // Opacity: 0.30 … 0.60 — significantly lower than Base Fog
      const alpha  = 0.30 + rand() * 0.30;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.drawImage(midImg, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  // ── Visibility mask (destination-in) ─────────────────────────────────────
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
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}
