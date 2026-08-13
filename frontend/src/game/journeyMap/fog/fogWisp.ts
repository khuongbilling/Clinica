/**
 * fog/fogWisp.ts — Layer 4 Foreground Wisps (Push 7)
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png  (REFERENCE ONLY)
 *
 * ── Role ─────────────────────────────────────────────────────────────────────
 *
 * Foreground Wisps are the topmost fog layer.  They are NOT primary
 * concealment (that is Base Fog, Layer 2) — they add:
 *   • Surface detail across unexplored terrain
 *   • Gossamer tendrils that break the uniformity of Base + Mid Fog
 *   • A sense of depth: different layer moves differently (future animation push)
 *
 * ── Opacity vs other layers ──────────────────────────────────────────────────
 *
 *   Base Fog  (L2):  0.70–0.90  primary concealment
 *   Mid  Fog  (L3):  0.30–0.60  atmospheric texture
 *   Wisps     (L4):  0.20–0.45  surface detail — lightest layer
 *
 * ── Coverage strategy ────────────────────────────────────────────────────────
 *
 *   Tighter grid (WISP_CELL_TILES = 3.0) → more numerous instances than Base/Mid.
 *   Smaller scale (1.5–3.2 × sz) → fine surface detail, no large blocks.
 *   ±20° rotation range (more than Base/Mid's ±10°) for irregular silhouettes.
 *   Separate seed namespace ':fogwisp' so instances never align with other layers.
 *
 * ── Clearing behaviour ───────────────────────────────────────────────────────
 *
 *   Same visibility mask as Base/Mid (destination-in).
 *   Because instance opacity is lowest, EXPLORED residual is barely perceptible
 *   — a hint of life rather than concealment.
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web only — HTML5 Canvas 2D.
 */

import { Asset } from 'expo-asset';
import { JOURNEY_ASSETS } from '../assets';
import { drawFogMask, type FogMaskParams } from './fogMask';

// ── Asset source ───────────────────────────────────────────────────────────────
const FOG_WISP_DAY_SOURCE = JOURNEY_ASSETS.fog.wispDay;

// ── Layout constants ───────────────────────────────────────────────────────────

/** Matches all other fog layer paddings so every layer bleeds identically. */
/**
 * @deprecated Push 3: canvas is now exactly worldWidth × worldHeight at origin 0,0.
 * Kept as 0 so existing import references compile without changes.
 */
export const FOG_WISP_PADDING = 0;

/** Tighter grid than Mid Fog — more wisp instances for surface detail. */
const WISP_CELL_TILES = 3.0;

/** Minimum rendered width (× sz). Wisps are smaller than Base/Mid. */
const WISP_W_MIN_TILES = 1.5;

/** Maximum rendered width (× sz). */
const WISP_W_MAX_TILES = 3.2;

/** Aspect ratio of fog_wisp image (assumed 1536 × 1024 — same gen settings). */
const WISP_ASPECT = 1536 / 1024;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FogWispParams {
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

// ── Image cache ────────────────────────────────────────────────────────────────

const imageCache = new Map<string, Promise<HTMLImageElement>>();

async function loadBundledImage(source: number): Promise<HTMLImageElement> {
  const asset = Asset.fromModule(source);
  if (!asset.uri) await asset.downloadAsync();
  const uri = asset.uri ?? '';

  const cached = imageCache.get(uri);
  if (cached) return cached;

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    if (!uri) { reject(new Error('fogWisp: asset URI unavailable')); return; }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`fogWisp: failed to load ${uri}`));
    img.src     = uri;
  });
  imageCache.set(uri, p);
  return p;
}

// ── Main draw function ─────────────────────────────────────────────────────────

/**
 * Draws the Foreground Wisp layer (Layer 4) onto `canvas`.
 *
 * Step 1: Load fog_wisp image (cached after first call).
 * Step 2: Size padded canvas.
 * Step 3: Draw overlapping wisp instances (tighter grid, smaller scale).
 * Step 4: Apply visibility mask (destination-in) — same as Base/Mid.
 * Step 5: Edge taper.
 *
 * Web only. Callers must guard with `Platform.OS === 'web'`.
 */
export async function drawFogWisp(
  canvas: HTMLCanvasElement,
  params: FogWispParams,
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

  const wispImg = await loadBundledImage(FOG_WISP_DAY_SOURCE);

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

  // ── Draw wisp instances ───────────────────────────────────────────────────
  const cellSize = sz * WISP_CELL_TILES;
  const cols     = Math.ceil(worldWidth  / cellSize) + 2;
  const rows     = Math.ceil(worldHeight / cellSize) + 2;

  const rand = seededRandom(hashString(runSeed + ':fogwisp'));

  ctx.save();
  // Push 3: no translate — sprites are drawn directly in world coords.

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      // Jitter up to ±55% of cell — more than Base/Mid for less regimented look
      const cx = (col + 0.5) * cellSize + (rand() - 0.5) * cellSize * 1.1;
      const cy = (row + 0.5) * cellSize + (rand() - 0.5) * cellSize * 1.1;

      const wTiles = WISP_W_MIN_TILES + rand() * (WISP_W_MAX_TILES - WISP_W_MIN_TILES);
      const w      = sz * wTiles;
      const h      = w  / WISP_ASPECT;

      // Rotation ±20° — wider than Base/Mid for more organic silhouettes
      const angle  = (rand() * 40 - 20) * (Math.PI / 180);

      // Opacity 0.20–0.45 — lightest layer
      const alpha  = 0.20 + rand() * 0.25;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.drawImage(wispImg, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  ctx.restore();

  // ── Visibility mask (destination-in) ──────────────────────────────────────
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
