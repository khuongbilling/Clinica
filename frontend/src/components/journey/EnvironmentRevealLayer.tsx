/**
 * EnvironmentRevealLayer — progressive environment reveal canvas  (Blueprint Push)
 *
 * Renders the chapter's developed environment painting (full-colour raster art)
 * ONLY in tiles that the player has explored or can currently see.
 *
 * In unexplored areas the canvas is fully transparent, so BlueprintHexLayer
 * (z=0) shows through.  In explored / visible areas the environment painting
 * is revealed with organic feathered lobes that exceed the fog's erasure radius
 * by a small margin — the environment surface always extends slightly beyond the
 * cleared fog zone, preventing any dark-seam artefact at the reveal edge.
 *
 * ── Algorithm ─────────────────────────────────────────────────────────────────
 *
 *   1. Draw the environment image cover-style on the main canvas  (source-over).
 *   2. Build an OFFSCREEN "reveal mask" by drawing soft radial gradient circles
 *      at every explored / visible tile centre.  Radii are chosen to be
 *      SLIGHTLY LARGER than the fog's destination-out erasure radii:
 *        fog erasure explored  = sz × 1.20
 *        fog erasure visible   = sz × 1.45 × fovScale
 *        reveal explored       = sz × 1.25   (+ 0.05 × sz margin)
 *        reveal visible        = sz × 1.50 × fovScale  (+ 0.05 × sz margin)
 *      This guarantees the environment painting always covers the fog-cleared
 *      zone without any ring of exposed blueprint beneath cleared fog.
 *   3. Apply the mask with destination-in:
 *        result = environment × mask_alpha
 *      → unexplored: transparent   (blueprint shows through)
 *      → explored:   ~72 % opaque  (environment with memory dimness)
 *      → visible:    ~96 % opaque  (full-colour environment)
 *
 *   The FogOfWarLayer (z=5200) then draws a semi-transparent fog film over
 *   everything, adding an atmospheric veil even in explored areas and a dark
 *   shroud in unexplored areas (through which the blueprint linework shows).
 *
 * ── Materialization fade ──────────────────────────────────────────────────────
 *
 *   When new tiles enter the explored or visible sets (i.e. the player moves
 *   into previously undiscovered territory), the canvas opacity animates from
 *   0 → 1 over MATERIALIZE_MS milliseconds using a CSS ease-out transition.
 *   This creates a smooth "discovery" materialisation effect rather than a
 *   single-frame snap.
 *
 *   Moves that only REMOVE tiles from the visible set (player steps back, tiles
 *   leave FOV) do NOT trigger the animation — the canvas stays at full opacity
 *   so the memory-haze transition is instant.
 *
 * ── Layer stack position ──────────────────────────────────────────────────────
 *
 *   BlueprintHexLayer  z = JOURNEY_Z.BACKGROUND (0)
 *   EnvironmentReveal  z = JOURNEY_Z.ENV_REVEAL  (1)   ← this component
 *   HexTerrain         z = 100–400
 *   WorldContent       z = 3000–4900
 *   FogOfWarLayer      z = 5200
 *
 * Web uses a canvas mask. Native uses clipped reveal lobes, each positioned
 * against the same world-sized image, so it never exposes finished art in
 * unexplored territory while retaining the exact same source alignment.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Asset } from 'expo-asset';
import Svg, { Circle, ClipPath, Defs, Image as SvgImage } from 'react-native-svg';
import { buildFogMaskCacheKey } from '@/src/game/journeyMap/fog/fogMask';
import {
  EXPLORED_ENVIRONMENT_REVEAL_FACTOR,
  getEnvironmentRevealRadius,
  VISIBLE_ENVIRONMENT_REVEAL_FACTOR,
} from '@/src/game/journeyMap/fog/fogRevealGeometry';
import { JOURNEY_Z } from './journeyZ';

// ── Reveal strength constants ──────────────────────────────────────────────────

/**
 * Lobe strength for EXPLORED (out-of-vision) tiles.
 * ~0.72 → environment is readable but slightly dimmed; the semi-transparent
 * fog above adds further depth variation in this zone.
 */
const EXPLORED_STRENGTH = 0.72;

/**
 * Lobe strength for VISIBLE_NOW tiles.
 * ~0.96 → near-full environment richness; the narrow ring of remaining fog
 * softens the edge without dimming the active FOV.
 */
const VISIBLE_STRENGTH = 0.96;

/**
 * Reveal lobe radius for EXPLORED (out-of-vision) tiles, as a multiple of sz.
 *
 * Fog erasure explored = sz × 1.20 (fogMask.ts exploredPrimaryR).
 * This value is sz × 1.25 — 5 % larger than fog erasure — so the environment
 * paint always covers the fully-cleared zone with no seam at the edge.
 */
const EXPLORED_RADIUS_FACTOR = EXPLORED_ENVIRONMENT_REVEAL_FACTOR;

/**
 * Reveal lobe radius for VISIBLE_NOW tiles, as a multiple of sz × fovScale.
 *
 * Fog erasure visible = sz × 1.45 × fovScale (fogMask.ts visiblePrimaryR).
 * This value is sz × 1.50 × fovScale — 5 % larger than fog erasure.
 */
const VISIBLE_RADIUS_FACTOR = VISIBLE_ENVIRONMENT_REVEAL_FACTOR;

/** Duration of the materialisation fade when new territory is discovered (ms). */
const MATERIALIZE_MS = 350;

// ── Image cache ───────────────────────────────────────────────────────────────

const imageCache = new Map<string, Promise<HTMLImageElement>>();

async function loadEnvImage(source: import('expo-image').ImageSource | number): Promise<HTMLImageElement> {
  let uri: string;
  if (typeof source === 'number') {
    const asset = Asset.fromModule(source);
    if (!asset.uri) await asset.downloadAsync();
    uri = asset.uri ?? '';
  } else if (typeof source === 'string') {
    uri = source;
  } else if (source && typeof source === 'object' && 'uri' in source && typeof (source as { uri?: unknown }).uri === 'string') {
    uri = (source as { uri: string }).uri;
  } else {
    throw new Error('[EnvironmentReveal] Unsupported source type');
  }
  if (!uri) throw new Error('[EnvironmentReveal] Empty URI — asset not bundled');

  const hit = imageCache.get(uri);
  if (hit) return hit;

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`[EnvironmentReveal] Load failed: ${uri}`));
    img.src = uri;
  });
  imageCache.set(uri, p);
  return p;
}

// ── Cover draw ────────────────────────────────────────────────────────────────

function drawCover(
  ctx:   CanvasRenderingContext2D,
  img:   HTMLImageElement,
  w:     number,
  h:     number,
): void {
  const sr = img.width / img.height;
  const dr = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (sr > dr) { sw = img.height * dr; sx = (img.width - sw)  / 2; }
  else          { sh = img.width  / dr; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EnvironmentRevealLayerProps {
  /**
   * The environment image source — same value as HexMapLayerProps.environmentBackground.source.
   * Accepts any valid expo-image source (number from require(), {uri}, or ImageSource object).
   */
  source: import('expo-image').ImageSource | number;

  worldWidth:  number;
  worldHeight: number;

  /** Tile edge length in display pixels (coords.sz). */
  sz: number;

  /**
   * World-space centre point for every tile — same Map HexMapLayer builds for
   * FogOfWarLayer:  cx = left + sz/2,  cy = top + sz/2.
   */
  tileCenters: ReadonlyMap<string, { cx: number; cy: number }>;

  /**
   * Tile IDs that have ever entered the player's FOV (monotonically growing).
   * Explored-but-out-of-vision = this set minus visibleTileIds.
   */
  exploredTileIds?: readonly string[];

  /** Tile IDs currently in the player's active FOV ring. */
  visibleTileIds?: ReadonlySet<string>;

  /** Player's effective vision radius — used to scale reveal lobe radii. Default 1. */
  effectiveFieldOfVision?: number;

  /** Run seed — deterministic, used only for cache-key construction here. */
  runSeed?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EnvironmentRevealLayer(props: EnvironmentRevealLayerProps): React.ReactElement | null {
  if (Platform.OS !== 'web') return <EnvironmentRevealLayerNative {...props} />;
  return <EnvironmentRevealLayerWeb {...props} />;
}

/**
 * Canvas compositing is web-only. Native draws at most two full-world SVG image
 * layers, each clipped by all of its reveal circles. This bounds image instances
 * on a fully explored map while retaining the no-leak visibility contract.
 */
function EnvironmentRevealLayerNative({
  source,
  worldWidth,
  worldHeight,
  sz,
  tileCenters,
  exploredTileIds = [],
  visibleTileIds,
  effectiveFieldOfVision = 1,
}: EnvironmentRevealLayerProps): React.ReactElement {
  const [uri, setUri] = useState<string | null>(null);
  const clipId = useRef(`environment-reveal-${String(source).replace(/[^a-zA-Z0-9]/g, '')}`).current;
  const circles = useMemo(() => {
    const explored: Array<{ id: string; cx: number; cy: number; radius: number }> = [];
    const visible: Array<{ id: string; cx: number; cy: number; radius: number }> = [];
    const visibleIds = visibleTileIds ?? new Set<string>();
    const ids = new Set<string>(exploredTileIds);
    for (const id of visibleIds) ids.add(id);
    for (const id of ids) {
      const center = tileCenters.get(id);
      if (!center) continue;
      const target = visibleIds.has(id) ? visible : explored;
      target.push({
        id,
        cx: center.cx,
        cy: center.cy,
        radius: getEnvironmentRevealRadius(
          sz,
          visibleIds.has(id) ? 'visible' : 'explored',
          effectiveFieldOfVision,
        ),
      });
    }
    return { explored, visible };
  }, [effectiveFieldOfVision, exploredTileIds, sz, tileCenters, visibleTileIds]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let nextUri: string | undefined;
        if (typeof source === 'number') {
          const asset = Asset.fromModule(source);
          if (!asset.uri) await asset.downloadAsync();
          nextUri = asset.uri;
        } else if (typeof source === 'string') {
          nextUri = source;
        } else if (source && typeof source === 'object' && 'uri' in source) {
          nextUri = (source as { uri?: string }).uri;
        }
        if (!cancelled) setUri(nextUri ?? null);
      } catch {
        if (!cancelled) setUri(null);
      }
    })();
    return () => { cancelled = true; };
  }, [source]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: worldWidth,
        height: worldHeight,
        zIndex: JOURNEY_Z.ENV_REVEAL,
      }}
    >
      {uri != null && (
        <Svg width={worldWidth} height={worldHeight}>
          <Defs>
            <ClipPath id={`${clipId}-explored`}>
              {circles.explored.map(circle => (
                <Circle key={circle.id} cx={circle.cx} cy={circle.cy} r={circle.radius} />
              ))}
            </ClipPath>
            <ClipPath id={`${clipId}-visible`}>
              {circles.visible.map(circle => (
                <Circle key={circle.id} cx={circle.cx} cy={circle.cy} r={circle.radius} />
              ))}
            </ClipPath>
          </Defs>
          {circles.explored.length > 0 && (
            <SvgImage
              href={{ uri }}
              width={worldWidth}
              height={worldHeight}
              opacity={EXPLORED_STRENGTH}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${clipId}-explored)`}
            />
          )}
          {circles.visible.length > 0 && (
            <SvgImage
              href={{ uri }}
              width={worldWidth}
              height={worldHeight}
              opacity={VISIBLE_STRENGTH}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${clipId}-visible)`}
            />
          )}
        </Svg>
      )}
    </View>
  );
}

function EnvironmentRevealLayerWeb({
  source,
  worldWidth,
  worldHeight,
  sz,
  tileCenters,
  exploredTileIds,
  visibleTileIds,
  effectiveFieldOfVision,
  runSeed,
}: EnvironmentRevealLayerProps): React.ReactElement {
  const containerRef    = useRef<View>(null);
  const canvasRef       = useRef<HTMLCanvasElement | null>(null);
  const cacheKeyRef     = useRef<string>('');
  const lastSourceRef   = useRef<string>('');

  // Track explored + visible counts to detect when new territory is revealed.
  // Only used for the materialisation fade decision — not for drawing.
  const prevExploredCountRef = useRef<number>(0);
  const prevVisibleCountRef  = useRef<number>(0);

  // ── Effect A: create canvas on mount (remount when world dims change) ──────
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const container = containerRef.current as unknown as HTMLDivElement | null;
    if (!container) return;

    const DPR = window.devicePixelRatio ?? 1;
    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      `position:absolute;left:0;top:0;` +
      `width:${worldWidth}px;height:${worldHeight}px;` +
      `pointer-events:none;opacity:1;`;
    canvas.width  = Math.ceil(worldWidth  * DPR);
    canvas.height = Math.ceil(worldHeight * DPR);

    container.appendChild(canvas);
    canvasRef.current   = canvas;
    cacheKeyRef.current = ''; // force redraw on attach
    // Reset counts so the first reveal triggers a fade from nothing.
    prevExploredCountRef.current = 0;
    prevVisibleCountRef.current  = 0;

    return () => {
      canvas.remove();
      canvasRef.current   = null;
      cacheKeyRef.current = '';
    };
  }, [worldWidth, worldHeight]);

  // ── Effect B: draw / redraw when visibility inputs change ─────────────────
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const visibleNowIds: ReadonlySet<string> = visibleTileIds ?? new Set<string>();
    const exploredIds   = new Set(exploredTileIds ?? []);

    // Source-change check — use string representation as a fast compare.
    const sourceKey = typeof source === 'number'
      ? String(source)
      : ((source as { uri?: string }).uri ?? JSON.stringify(source));

    const nextKey = sourceKey + '|' + buildFogMaskCacheKey({
      runId:                  runSeed ?? 'fixture-default',
      worldWidth,
      worldHeight,
      tileSize:               sz ?? 0,
      effectiveFieldOfVision: effectiveFieldOfVision ?? 1,
      visibleNowIds,
      exploredIds,
    });

    if (nextKey === cacheKeyRef.current && sourceKey === lastSourceRef.current) return;
    cacheKeyRef.current   = nextKey;
    lastSourceRef.current = sourceKey;

    // ── Materialisation fade decision ────────────────────────────────────────
    // Only animate when the player has newly entered undiscovered territory
    // (explored or visible counts grew).  Shrinks (tiles leaving FOV) don't
    // animate — the canvas snaps to the new state so memory-haze is instant.
    const prevExp = prevExploredCountRef.current;
    const prevVis = prevVisibleCountRef.current;
    const newExp  = exploredIds.size;
    const newVis  = visibleNowIds.size;
    const hasNewTiles = newExp > prevExp || newVis > prevVis;

    prevExploredCountRef.current = newExp;
    prevVisibleCountRef.current  = newVis;

    if (hasNewTiles) {
      // Hide canvas instantly before the async draw, then fade in after paint.
      canvas.style.transition = 'none';
      canvas.style.opacity    = '0';
    }

    void (async () => {
      await drawReveal(canvas, {
        source,
        worldWidth,
        worldHeight,
        sz,
        tileCenters,
        exploredTileIds,
        visibleTileIds,
        effectiveFieldOfVision,
        runSeed,
      });

      if (hasNewTiles) {
        // Double rAF: first frame commits opacity:0, second triggers transition.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!canvasRef.current) return;
            canvasRef.current.style.transition = `opacity ${MATERIALIZE_MS}ms ease-out`;
            canvasRef.current.style.opacity    = '1';
          });
        });
      }
    })();
  }, [
    source, worldWidth, worldHeight, sz, tileCenters,
    exploredTileIds, visibleTileIds, effectiveFieldOfVision, runSeed,
  ]);

  return (
    <View
      ref={containerRef}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left:     0,
        top:      0,
        width:    worldWidth,
        height:   worldHeight,
        zIndex:   JOURNEY_Z.ENV_REVEAL,
        overflow: 'hidden',
      }}
    />
  );
}

// ── Draw function ─────────────────────────────────────────────────────────────

async function drawReveal(
  canvas: HTMLCanvasElement,
  {
    source,
    worldWidth,
    worldHeight,
    sz,
    tileCenters,
    exploredTileIds,
    visibleTileIds,
    effectiveFieldOfVision,
  }: EnvironmentRevealLayerProps,
): Promise<void> {
  const DPR = window.devicePixelRatio ?? 1;

  // Resize canvas synchronously (may be a no-op if dims are unchanged).
  canvas.style.width  = `${worldWidth}px`;
  canvas.style.height = `${worldHeight}px`;
  const backW = Math.ceil(worldWidth  * DPR);
  const backH = Math.ceil(worldHeight * DPR);
  if (canvas.width !== backW || canvas.height !== backH) {
    canvas.width  = backW;
    canvas.height = backH;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, worldWidth, worldHeight);

  // Separate visible-now from explored-but-out-of-vision.
  const visibleNowIds: ReadonlySet<string> = visibleTileIds ?? new Set<string>();
  const exploredIds = new Set<string>();
  for (const id of exploredTileIds ?? []) {
    if (!visibleNowIds.has(id)) exploredIds.add(id);
  }

  // Nothing revealed yet — canvas stays transparent (blueprint shows through).
  if (visibleNowIds.size === 0 && exploredIds.size === 0) return;
  if (!sz || sz <= 0 || !tileCenters || tileCenters.size === 0) return;

  // ── Load environment image ────────────────────────────────────────────────
  let envImg: HTMLImageElement;
  try {
    envImg = await loadEnvImage(source);
  } catch (err) {
    console.warn('[EnvironmentReveal] Image load failed — blueprint-only render:', err);
    return;
  }

  // ── Step 1: draw environment image cover-style (full canvas) ──────────────
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1.0;
  drawCover(ctx, envImg, worldWidth, worldHeight);

  // ── Step 2: build reveal mask on an offscreen canvas ─────────────────────
  // The offscreen canvas is transparent everywhere.  Drawing soft gradient
  // circles with source-over naturally UNIONS overlapping lobe areas.
  // Multiple adjacent visible tiles' lobes merge into one contiguous reveal.
  const offscreen = document.createElement('canvas');
  offscreen.width  = backW;
  offscreen.height = backH;
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) return;
  offCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  offCtx.clearRect(0, 0, worldWidth, worldHeight);
  offCtx.globalCompositeOperation = 'source-over';

  // Explored (out-of-vision) reveal lobes.
  // Radius = sz × EXPLORED_RADIUS_FACTOR (1.25).
  // Fog erasure explored = sz × 1.20 → reveal exceeds erasure by 0.05 × sz
  // so the environment surface always covers the cleared fog zone completely.
  const explRadius = getEnvironmentRevealRadius(sz, 'explored');
  for (const id of exploredIds) {
    const c = tileCenters.get(id);
    if (!c) continue;
    const g = offCtx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, explRadius);
    g.addColorStop(0,    `rgba(255,255,255,${EXPLORED_STRENGTH})`);
    g.addColorStop(0.50, `rgba(255,255,255,${(EXPLORED_STRENGTH * 0.88).toFixed(3)})`);
    g.addColorStop(0.78, `rgba(255,255,255,${(EXPLORED_STRENGTH * 0.42).toFixed(3)})`);
    g.addColorStop(1,    'rgba(255,255,255,0)');
    offCtx.fillStyle = g;
    offCtx.fillRect(c.cx - explRadius, c.cy - explRadius, explRadius * 2, explRadius * 2);
  }

  // Visible-now reveal lobes.
  // Radius = sz × VISIBLE_RADIUS_FACTOR (1.50) × fovScale.
  // Fog erasure visible = sz × 1.45 × fovScale → reveal exceeds erasure by
  // 0.05 × sz × fovScale — same proportional margin as explored lobes.
  const visRadius = getEnvironmentRevealRadius(
    sz,
    'visible',
    effectiveFieldOfVision ?? 1,
  );
  for (const id of visibleNowIds) {
    const c = tileCenters.get(id);
    if (!c) continue;
    const g = offCtx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, visRadius);
    g.addColorStop(0,    `rgba(255,255,255,${VISIBLE_STRENGTH})`);
    g.addColorStop(0.55, `rgba(255,255,255,${(VISIBLE_STRENGTH * 0.92).toFixed(3)})`);
    g.addColorStop(0.82, `rgba(255,255,255,${(VISIBLE_STRENGTH * 0.38).toFixed(3)})`);
    g.addColorStop(1,    'rgba(255,255,255,0)');
    offCtx.fillStyle = g;
    offCtx.fillRect(c.cx - visRadius, c.cy - visRadius, visRadius * 2, visRadius * 2);
  }

  // ── Step 3: apply reveal mask (destination-in) ────────────────────────────
  // destination-in: result_alpha = canvas_alpha × mask_alpha.
  // Where offscreen has alpha > 0 → environment is kept (revealed).
  // Where offscreen is transparent → environment is erased (blueprint shows).
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(offscreen, 0, 0, worldWidth, worldHeight);

  // ── Restore context state ─────────────────────────────────────────────────
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1.0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
