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

import { Asset } from 'expo-asset';
import { JOURNEY_ASSETS } from '../assets';
import { drawFogMask, type FogMaskParams } from './fogMask';

// ── Bundled asset source ───────────────────────────────────────────────────────
const FOG_MID_DAY_SOURCE = JOURNEY_ASSETS.fog.midDay;

// ── Layout constants ──────────────────────────────────────────────────────────

/**
 * Extra pixels on all four sides of the Mid Fog canvas — must match
 * FOG_WORLD_PADDING in fogBase.ts so both layers bleed identically.
 * FogMidLayer.tsx reads this export to apply the matching CSS offset.
 */
/**
 * @deprecated Push 3: canvas is now exactly worldWidth × worldHeight at origin 0,0.
 * Kept as 0 so existing import references compile without changes.
 */
export const FOG_MID_WORLD_PADDING = 0;

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

  const midImg = await loadBundledImage(FOG_MID_DAY_SOURCE);

  // ── Size canvas: exact world dimensions, DPR-backed ─────────────────────────
  // Push 3: canvas is exactly worldWidth × worldHeight at origin 0,0.
  const DPR = typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1;
  canvas.width  = Math.ceil(worldWidth  * DPR);
  canvas.height = Math.ceil(worldHeight * DPR);
  canvas.style.width  = `${worldWidth}px`;
  canvas.style.height = `${worldHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(DPR, DPR);

  // ── Fog instances ─────────────────────────────────────────────────────────
  const cellSize = sz * MID_CELL_TILES;
  const cols     = Math.ceil(worldWidth  / cellSize) + 2;
  const rows     = Math.ceil(worldHeight / cellSize) + 2;

  // Separate seed namespace from Base Fog so layers never share a placement.
  const rand = seededRandom(hashString(runSeed + ':fogmid'));

  ctx.save();
  // Push 3: no translate — sprites are drawn directly in world coords.

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

  ctx.restore();

  // ── Visibility mask (destination-in) ──────────────────────────────────────
  // Mid Fog uses the same mask as Base Fog — same clearing radii, same FoV.
  // Because Mid Fog has lower instance opacity (0.30–0.60), the combined effect
  // on EXPLORED tiles is a light memory haze (mask residual × low alpha).
  const maskCanvas = document.createElement('canvas');
  const maskParams: FogMaskParams = {
    worldWidth,
    worldHeight,
    sz,
    tileCenters,
    visibleNowIds,
    exploredIds,
    effectiveFieldOfVision,
    // Push 3: no padding — mask is exact world size.
  };
  drawFogMask(maskCanvas, maskParams);

  ctx.globalCompositeOperation = 'destination-in';
  ctx.globalAlpha = 1;
  // Explicit world-unit dest size so DPR-scaled ctx maps to DPR-backed maskCanvas.
  ctx.drawImage(maskCanvas, 0, 0, worldWidth, worldHeight);
  ctx.globalCompositeOperation = 'source-over';

  // Push 3: applyEdgeTaper removed — MapViewport clips edges; taper not needed.
}
