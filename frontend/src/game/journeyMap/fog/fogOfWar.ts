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
import { buildOrganicRevealInfluences, eraseSoftLobe } from './fogMask';

// ── Asset source ──────────────────────────────────────────────────────────────

/** Only approved day-time base texture. Never load mid / edge / wisp here. */
const FOG_BASE_DAY_SOURCE = JOURNEY_ASSETS.fog.baseDay;

// ── Tuning constants (easy to adjust for art direction) ───────────────────────

/**
 * Foundation colour for BLUEPRINT chapters (Ch1 and any future blueprint-pipeline
 * chapters).  Dark ink-navy at 64 % opacity so BlueprintHexLayer (z=0) shows
 * through the fog in unexplored areas as dark architectural linework.
 *
 * Used when FogOfWarParams.foundationColor is not supplied but the caller is a
 * blueprint chapter.  Exported so HexMapLayer can reference it without importing
 * a raw colour string.
 */
export const BLUEPRINT_FOUNDATION_COLOR = 'rgba(12, 22, 48, 0.64)';

/**
 * Foundation colour for STANDARD chapters (Ch2–Ch10 and all non-blueprint maps).
 * Warm blue-grey at 82 % opacity — tight enough to fully conceal the environment
 * painting beneath the fog in unexplored areas.
 *
 * Exported alongside BLUEPRINT_FOUNDATION_COLOR so callers can pick the right
 * value from a single import.
 */
export const STANDARD_FOUNDATION_COLOR = 'rgba(55, 72, 86, 0.82)';

/** @internal — fallback when FogOfWarParams.foundationColor is absent.
 *  Matches STANDARD to preserve behaviour for all non-blueprint callers. */
const FOUNDATION_COLOR_DEFAULT = STANDARD_FOUNDATION_COLOR;

/** Opacity of the base texture drawn over the foundation.
 *  Range 0.40–0.50 — provides mist depth without obscuring the foundation tint. */
const TEXTURE_ALPHA = 0.45;

// ── Push 4: reveal erasure strengths ─────────────────────────────────────────
// Same organic-lobe model proven in the legacy fogBase.ts.

/**
 * Erase strength for EXPLORED (out-of-vision) tiles.
 * ~0.70 → 25–35 % fog haze remains — remembered terrain through light mist.
 */
const EXPLORED_STRENGTH = 0.70;

/**
 * Erase strength for VISIBLE_NOW tiles.
 * ~0.98 → fog nearly gone — current FOV is crystal clear.
 */
const VISIBLE_STRENGTH = 0.98;

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

  // ── Push 3: exploration state ──────────────────────────────────────────────
  // Passed from FogOfWarLayer → drawFogOfWar so Push 4 can erase reveal lobes
  // with destination-out compositing.  Not yet used for drawing — accepted here
  // to establish the prop contract before the erasure pass is added.

  /**
   * Tile IDs that have ever entered the player's FOV (monotonically growing).
   * Push 4 will erase 'exploredButOutOfVision' lobes for these tiles.
   */
  exploredTileIds?: readonly string[];

  /**
   * Tile IDs currently within the player's live FOV ring (moves with the player).
   * Push 4 will erase sharper 'visibleNow' lobes for these tiles.
   */
  visibleTileIds?: ReadonlySet<string>;

  // ── Push 4: erasure geometry inputs ────────────────────────────────────────

  /** Resolved tile edge length in display pixels (coords.sz from HexMapLayer). */
  sz?: number;

  /**
   * World-space centre point for every tile in the active run, keyed by tile ID.
   * Built by HexMapLayer from coords.axialToWorld(q, r):
   *   cx = left + sz / 2, cy = top + sz / 2
   */
  tileCenters?: ReadonlyMap<string, { cx: number; cy: number }>;

  /** Player's effective field of vision radius (fogVision). Default 1. */
  effectiveFieldOfVision?: number;

  /** JourneyRun seed — deterministic organic lobe profiles per tile. */
  runSeed?: string;

  /**
   * Atmospheric foundation colour override.
   *
   * Blueprint chapters pass BLUEPRINT_FOUNDATION_COLOR (dark navy, 64 % opacity)
   * so the blueprint linework shows through the fog in unexplored areas.
   *
   * Non-blueprint chapters pass STANDARD_FOUNDATION_COLOR (warm blue-grey, 82 %)
   * to keep unexplored areas fully hidden behind dense fog.
   *
   * When absent, STANDARD_FOUNDATION_COLOR is used as the safe default.
   */
  foundationColor?: string;
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
  canvas: HTMLCanvasElement,
  {
    worldWidth,
    worldHeight,
    exploredTileIds,
    visibleTileIds,
    sz,
    tileCenters,
    effectiveFieldOfVision,
    runSeed,
    foundationColor,
  }: FogOfWarParams,
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
  ctx.fillStyle = foundationColor ?? FOUNDATION_COLOR_DEFAULT;
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
  ctx.globalAlpha = 1.0;

  // ── 5. Push 4: destination-out reveal erasure ─────────────────────────────
  // Explored (out-of-vision) tiles → feathered organic lobes, light haze left.
  // Visible-now tiles → sharper/stronger lobes, fog-free FOV.
  // Same buildOrganicRevealInfluences + eraseSoftLobe pattern as legacy fogBase.
  eraseRevealLobes(ctx, {
    exploredTileIds,
    visibleTileIds,
    sz,
    tileCenters,
    effectiveFieldOfVision,
    runSeed,
  });

  // Restore defaults for any subsequent drawing passes.
  ctx.globalAlpha = 1.0;
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ── Push 4: reveal erasure pass ───────────────────────────────────────────────

/**
 * Erases organic reveal lobes into the fog canvas with destination-out.
 *
 * No-op when geometry inputs (sz / tileCenters) are missing or nothing is
 * revealed — the full fog field from steps 3–4 remains intact.
 *
 * exploredTileIds may include currently-visible tiles (it grows monotonically);
 * those are excluded here so each tile gets exactly one tier of lobes.
 */
function eraseRevealLobes(
  ctx: CanvasRenderingContext2D,
  {
    exploredTileIds,
    visibleTileIds,
    sz,
    tileCenters,
    effectiveFieldOfVision,
    runSeed,
  }: Pick<
    FogOfWarParams,
    'exploredTileIds' | 'visibleTileIds' | 'sz' | 'tileCenters' |
    'effectiveFieldOfVision' | 'runSeed'
  >,
): void {
  if (!sz || sz <= 0 || !tileCenters || tileCenters.size === 0) {
    if (__DEV__) console.log('[fogOfWar] erase skipped — missing geometry', { sz, centers: tileCenters?.size ?? 0 });
    return;
  }

  const visibleNowIds: ReadonlySet<string> = visibleTileIds ?? new Set<string>();

  // Explored-but-out-of-vision = ever-seen minus currently visible.
  const exploredIds = new Set<string>();
  for (const id of exploredTileIds ?? []) {
    if (!visibleNowIds.has(id)) exploredIds.add(id);
  }

  if (visibleNowIds.size === 0 && exploredIds.size === 0) return;

  const lobes = buildOrganicRevealInfluences({
    tileCenters,
    visibleNowIds,
    exploredIds,
    sz,
    effectiveFieldOfVision: effectiveFieldOfVision ?? 1,
    runSeed:                runSeed ?? 'fixture-default',
    exploredStrength:       EXPLORED_STRENGTH,
    visibleStrength:        VISIBLE_STRENGTH,
    radiusMultiplier:       1.0,
  });

  if (__DEV__) console.log(`[fogOfWar] erasing ${lobes.length} lobes | visible: ${visibleNowIds.size} | explored: ${exploredIds.size}`);
  ctx.globalCompositeOperation = 'destination-out';
  for (const lobe of lobes) {
    eraseSoftLobe(ctx, lobe.x, lobe.y, lobe.radius, lobe.strength);
  }
  ctx.globalCompositeOperation = 'source-over';
}
