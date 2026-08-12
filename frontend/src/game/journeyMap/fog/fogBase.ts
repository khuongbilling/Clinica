/**
 * fog/fogBase.ts — Layer 2 Base Fog canvas drawing logic
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png
 *
 * REFERENCE ONLY. Never render that file in gameplay.
 *
 * ── What this module does ─────────────────────────────────────────────────────
 *
 * Draws multiple overlapping fog sprite instances across the full world canvas,
 * then applies the Push-3 visibility mask to reveal explored / visible-now areas.
 *
 * Result:
 *   UNEXPLORED  → dense atmospheric fog (opacity 0.70–0.90)
 *   EXPLORED    → mostly cleared; light haze from mask partial-erase
 *   VISIBLE_NOW → effectively clear (mask fully erases fog near tile centres)
 *
 * ── Assets ───────────────────────────────────────────────────────────────────
 *
 *   fog_base_day_01.png — PASS (16 near-centre cyan pixels; fog-body coloring)
 *   fog_bank_day_01.png — REJECTED (3 501 near-opaque dark pixels spread across
 *                         full image width; incompletely removed background)
 *
 *   Regenerate fog_bank with removeBackground:true before adding it back.
 *   This module currently uses only fog_base.
 *
 * ── Coverage strategy ────────────────────────────────────────────────────────
 *
 *   Instances are placed on a grid (cell = sz × BASE_CELL_TILES) with seeded
 *   jitter, scale, rotation, and opacity variation.  No single rectangle is
 *   visible: adjacent instances overlap and the mask feathers all edges.
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web only — HTML5 Canvas 2D.
 *   Callers must guard with `Platform.OS === 'web'` before calling drawFogBase.
 */

import { Asset } from 'expo-asset';
import { applyEdgeTaper, drawFogMask, type FogMaskParams } from './fogMask';
import { JOURNEY_ASSETS } from '../assets';

// ── Bundled asset source ───────────────────────────────────────────────────────
// JOURNEY_ASSETS.fog.baseDay is a Metro-bundled require() number.
// We resolve it via expo-asset's Asset.fromModule() which works cross-platform.
// DO NOT use Image.resolveAssetSource from react-native — react-native-web
// does not implement that function (throws on Expo web).
// DO NOT use a raw '/assets/...' URI — Metro dev server does not serve public/.
const FOG_BASE_DAY_SOURCE = JOURNEY_ASSETS.fog.baseDay;

// ── Layout constants ──────────────────────────────────────────────────────────

/**
 * Extra pixels added on all four sides of the fog canvas beyond the MapWorld
 * boundary.  The canvas is positioned at (−padding, −padding) in world space
 * so the fog extends past the outermost hex centres and never shows a hard edge.
 * FogBaseLayer.tsx reads this export to apply the matching CSS offset.
 */
export const FOG_WORLD_PADDING = 200;

/** Grid cell width in tile-size multiples. Adjacent cells overlap at ≥ half-width. */
const BASE_CELL_TILES = 4.5;

/** Minimum rendered width of one instance (× sz). */
const BASE_W_MIN_TILES = 4;

/** Maximum rendered width of one instance (× sz). */
const BASE_W_MAX_TILES = 8;

/** Natural aspect ratio of the fog_base image (1536 × 1024). */
const FOG_BASE_ASPECT = 1536 / 1024;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FogBaseParams {
  worldWidth:             number;
  worldHeight:            number;
  sz:                     number;
  tileCenters:            ReadonlyMap<string, { cx: number; cy: number }>;
  visibleNowIds:          ReadonlySet<string>;
  exploredIds:            ReadonlySet<string>;
  effectiveFieldOfVision: number;
  /** JourneyRun.seed — drives deterministic placement each run. */
  runSeed:                string;
}

// ── Seeded random ─────────────────────────────────────────────────────────────

/** djb2-style string hash → unsigned 32-bit integer. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

/** Linear-congruential generator seeded from a number.  Returns a closure → [0, 1). */
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

/**
 * Resolve a Metro-bundled require() number to a web URI via expo-asset, then
 * load it into an HTMLImageElement for canvas drawImage().  Cached per URI.
 *
 * WHY expo-asset and not Image.resolveAssetSource from react-native:
 * react-native-web does not implement resolveAssetSource — it throws
 * "not a function" on Expo web.  expo-asset's Asset.fromModule() has its
 * own cross-platform resolver that works correctly in the Metro dev server.
 */
async function loadBundledImage(source: number): Promise<HTMLImageElement> {
  const asset = Asset.fromModule(source);
  // uri may be null on first access; downloadAsync() guarantees it is set.
  if (!asset.uri) await asset.downloadAsync();
  const uri = asset.uri ?? '';

  const cached = imageCache.get(uri);
  if (cached) return cached;

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    if (!uri) { reject(new Error(`fogBase: asset URI unavailable (source=${source})`)); return; }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`fogBase: failed to load ${uri}`));
    img.src     = uri;
  });
  imageCache.set(uri, p);
  return p;
}

// ── Main draw function ─────────────────────────────────────────────────────────

/**
 * Draws the Base Fog layer (Layer 2) onto `canvas`.
 *
 * Step 1: Load the fog_base image (cached after first call).
 * Step 2: Size canvas to worldW × worldH.
 * Step 3: Draw overlapping fog instances (grid + seeded jitter / scale / rotation).
 * Step 4: Apply the Push-3 visibility mask with `destination-in`.
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

  // ── Load fog image (Metro-bundled, cached after first call) ──────────────
  const baseImg = await loadBundledImage(FOG_BASE_DAY_SOURCE);

  const P = FOG_WORLD_PADDING;

  // ── Size canvas to world + padding on all sides ───────────────────────────
  // The canvas is positioned at (−P, −P) in world space (CSS offset applied by
  // FogBaseLayer) so it bleeds past the outermost hex edges and never shows a
  // hard rectangular boundary.
  canvas.width  = Math.ceil(worldWidth  + 2 * P);
  canvas.height = Math.ceil(worldHeight + 2 * P);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Start fully transparent — no colored background fill.
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── Step 3: Draw overlapping fog instances ────────────────────────────────
  // We translate the context by (P, P) so all sprite positions stay in world
  // space (0,0 = top-left of MapWorld) while canvas(0,0) = world(−P, −P).
  const cellSize = sz * BASE_CELL_TILES;
  const cols     = Math.ceil(worldWidth  / cellSize) + 2; // +2 for bleed beyond world
  const rows     = Math.ceil(worldHeight / cellSize) + 2;

  const rand = seededRandom(hashString(runSeed + ':fogbase'));

  ctx.save();
  // Shift so world coordinates map correctly onto the padded canvas.
  ctx.translate(P, P);

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      // Grid centre + seeded jitter (up to ±45% of cell size)
      const cx = (col + 0.5) * cellSize + (rand() - 0.5) * cellSize * 0.9;
      const cy = (row + 0.5) * cellSize + (rand() - 0.5) * cellSize * 0.9;

      // Rendered width: [BASE_W_MIN_TILES × sz, BASE_W_MAX_TILES × sz]
      const wTiles = BASE_W_MIN_TILES + rand() * (BASE_W_MAX_TILES - BASE_W_MIN_TILES);
      const w      = sz * wTiles;
      const h      = w / FOG_BASE_ASPECT;

      // Rotation: −10° … +10°
      const angle  = (rand() * 20 - 10) * (Math.PI / 180);

      // Opacity: 0.70 … 0.90
      const alpha  = 0.70 + rand() * 0.20;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.drawImage(baseImg, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  ctx.restore(); // undo translate(P, P)

  // ── Step 4: Apply visibility mask with destination-in ─────────────────────
  // The mask is WHITE (alpha=1) where fog must be opaque — that includes the
  // padded area and all unexplored tiles.  destination-in keeps fog sprite
  // pixels proportionally to mask alpha; transparent mask pixels erase fog.
  // We pass padding=P so the mask is sized to match this canvas and the tile
  // clearings land at the correct padded canvas positions.
  const maskCanvas = document.createElement('canvas');
  const maskParams: FogMaskParams = {
    worldWidth,
    worldHeight,
    sz,
    tileCenters,
    visibleNowIds,
    exploredIds,
    effectiveFieldOfVision,
    padding: P,
  };
  drawFogMask(maskCanvas, maskParams);

  ctx.globalCompositeOperation = 'destination-in';
  ctx.globalAlpha = 1;
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';

  // ── Step 5: Edge taper — dissolve fog to transparent at world boundaries ──
  // Prevents any visible rectangular cutoff where the fog meets the map edge.
  applyEdgeTaper(ctx, canvas.width, canvas.height, P, 140);
}
