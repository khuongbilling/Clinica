/**
 * fog/fogWisp.ts — Layer 4 Foreground Wisps
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png  (REFERENCE ONLY)
 *
 * ── Role ─────────────────────────────────────────────────────────────────────
 *
 * Foreground Wisps are the topmost fog layer.  They are NOT primary concealment
 * (that is Base Fog) — they add surface texture that breaks the uniformity of
 * the fog mass and create a sense of atmospheric depth.
 *
 * ── Content restriction ───────────────────────────────────────────────────────
 *
 * Wisp canvas is full worldWidth × worldHeight at (0,0) — BUT the IMAGE
 * content inside that canvas MUST NOT cover the full rectangle.
 *
 * DO NOT:
 *   • drawImageCover(fog_wisp_day_01, entire world)
 *   • apply a destination-in mask to a full-world wisp fill
 *
 * DO:
 *   • Paint a few sparse wisp instances at seeded positions
 *   • AVOID the VISIBLE_NOW region (exclusion zone + fade-in boundary)
 *   • Concentrate near the visibility transition and unexplored terrain
 *
 * ── Self-managing placement (no mask) ─────────────────────────────────────────
 *
 * Instead of applying a destination-in mask, wisps are placed by checking each
 * candidate position's distance to the nearest VISIBLE_NOW tile center:
 *
 *   dist < exclusionR                 → skip (inside clear zone)
 *   exclusionR ≤ dist < boundaryROuter → draw at ramped alpha (0→full)
 *   dist ≥ boundaryROuter             → draw at full seeded alpha
 *
 * This guarantees wisps can NEVER re-cover the player's visible region even as
 * the topmost layer — they stay in the fog territory by construction.
 *
 * ── Seeded random contract ───────────────────────────────────────────────────
 *
 * Five random values are consumed per grid cell in a fixed order (jitterX,
 * jitterY, widthFrac, alphaFrac, angleFrac).  Values are consumed even for
 * skipped cells so the deterministic sequence is independent of which cells
 * are in the visible zone.  Same runSeed → same placement every load.
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web only — HTML5 Canvas 2D.
 */

import { Asset } from 'expo-asset';
import { JOURNEY_ASSETS } from '../assets';

// ── Asset source ───────────────────────────────────────────────────────────────
const FOG_WISP_DAY_SOURCE = JOURNEY_ASSETS.fog.wispDay;

// ── Layout constants ───────────────────────────────────────────────────────────

/**
 * @deprecated Push 3: canvas is now exactly worldWidth × worldHeight at origin 0,0.
 * Kept as 0 so existing import references compile without changes.
 */
export const FOG_WISP_PADDING = 0;

/** Grid cell size (× sz) — controls wisp density. */
const WISP_CELL_TILES = 3.0;

/** Minimum rendered width of one wisp instance (× sz). */
const WISP_W_MIN_TILES = 1.5;

/** Maximum rendered width of one wisp instance (× sz). */
const WISP_W_MAX_TILES = 3.2;

/** Aspect ratio of fog_wisp image (1536 × 1024). */
const WISP_ASPECT = 1536 / 1024;

/**
 * Clear zone radius multiplier relative to the mask's primary lobe radius.
 * Instances whose grid-cell center is inside this radius of any VISIBLE_NOW
 * tile center are skipped entirely.
 * Set to 1.05 × mask radius so there is a small safe margin beyond the
 * mask clear zone before wisps start appearing.
 */
const EXCLUSION_RADIUS_MULT = 1.05;

/**
 * Outer boundary radius multiplier.  Instances between exclusionR and
 * boundaryROuter are faded from 0 → full alpha (linear ramp).
 * 1.80 × mask radius gives a generous feathered transition band.
 */
const BOUNDARY_OUTER_MULT = 1.80;

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
 * Wisps are placed at seeded grid positions filtered by distance to the
 * nearest VISIBLE_NOW tile center.  Positions inside the exclusion zone
 * are skipped; positions in the boundary band are faded.  No destination-in
 * mask is applied — wisps are self-managing.
 *
 * Web only.  Callers must guard with `Platform.OS === 'web'`.
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
    effectiveFieldOfVision,
    runSeed,
  } = params;

  const wispImg = await loadBundledImage(FOG_WISP_DAY_SOURCE);

  // ── Size canvas: exact world dimensions, DPR-backed ─────────────────────────
  const DPR = typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1;
  canvas.style.position = 'absolute';
  canvas.style.left     = '0px';
  canvas.style.top      = '0px';
  canvas.style.width    = `${worldWidth}px`;
  canvas.style.height   = `${worldHeight}px`;
  canvas.width  = Math.ceil(worldWidth  * DPR);
  canvas.height = Math.ceil(worldHeight * DPR);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(DPR, DPR);

  // ── Build VISIBLE_NOW center list for exclusion-zone checks ───────────────
  // Matches fogBase.ts / fogMid.ts: fovInnerR = sz * 1.45 * fovScale.
  // fovScale uses the same 0.55 multiplier as Base/Mid so wisps stay outside
  // the actual cleared fog area (was 0.18 — left wisps inside the clear zone).
  const fovScale        = 1 + (effectiveFieldOfVision - 1) * 0.55;
  const maskPrimaryR    = sz * 1.45 * fovScale;
  const exclusionR      = maskPrimaryR * EXCLUSION_RADIUS_MULT;
  const boundaryROuter  = maskPrimaryR * BOUNDARY_OUTER_MULT;

  const visibleCenters: { cx: number; cy: number }[] = [];
  for (const id of visibleNowIds) {
    const c = tileCenters.get(id);
    if (c) visibleCenters.push(c);
  }

  /** Returns minimum squared distance from (px, py) to any visible-now center. */
  function minDistSq(px: number, py: number): number {
    let d = Infinity;
    for (const c of visibleCenters) {
      const dx = px - c.cx;
      const dy = py - c.cy;
      const sq = dx * dx + dy * dy;
      if (sq < d) d = sq;
    }
    return d;
  }

  const exclusionRSq     = exclusionR     * exclusionR;
  const boundaryRouterSq = boundaryROuter * boundaryROuter;

  // ── Draw wisp instances ───────────────────────────────────────────────────
  const cellSize = sz * WISP_CELL_TILES;
  const cols     = Math.ceil(worldWidth  / cellSize) + 2;
  const rows     = Math.ceil(worldHeight / cellSize) + 2;

  const rand = seededRandom(hashString(runSeed + ':fogwisp'));

  ctx.save();

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      // Consume 5 random values per cell IN A FIXED ORDER regardless of
      // whether this cell is drawn — deterministic sequence is preserved
      // even when cells near the visible zone are skipped.
      const jitterX  = rand(); // 0: x jitter fraction (0–1)
      const jitterY  = rand(); // 1: y jitter fraction
      const widthFrc = rand(); // 2: width interpolation (0–1)
      const alphaFrc = rand(); // 3: base alpha interpolation
      const angleFrc = rand(); // 4: rotation interpolation

      const cx = (col + 0.5) * cellSize + (jitterX - 0.5) * cellSize * 1.1;
      const cy = (row + 0.5) * cellSize + (jitterY - 0.5) * cellSize * 1.1;

      // Zone check using squared distance (avoids sqrt for early outs)
      const dSq = (visibleCenters.length > 0) ? minDistSq(cx, cy) : Infinity;

      // Hard exclusion: skip instances inside the clear zone
      if (dSq < exclusionRSq) continue;

      // Base alpha from seeded range [0.20 – 0.45]
      let alpha = 0.20 + alphaFrc * 0.25;

      // Soft boundary fade: ramp from 0 → full as dist grows from
      // exclusionR → boundaryROuter
      if (dSq < boundaryRouterSq) {
        const dist = Math.sqrt(dSq);
        const t    = (dist - exclusionR) / (boundaryROuter - exclusionR);
        alpha     *= Math.max(0, Math.min(1, t));
      }

      if (alpha < 0.01) continue;

      const w     = sz * (WISP_W_MIN_TILES + widthFrc * (WISP_W_MAX_TILES - WISP_W_MIN_TILES));
      const h     = w  / WISP_ASPECT;
      const angle = (angleFrc * 40 - 20) * (Math.PI / 180);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.drawImage(wispImg, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  ctx.restore();

  // No destination-in mask applied — wisps are self-managed by the
  // exclusion zone and boundary fade above.  Applying a mask on top of
  // self-managed sprites would erase them twice and produce unexpected
  // opacity interactions with the canonical Base/Mid mask.
}
