/**
 * FogOfWarLayer — single full-world fog canvas
 *
 * Push 2 — draw one continuous full-map fog field.
 * Push 3 — exploration state wired through.
 * Push 4 — destination-out erasure: explored + visible tiles revealed.
 *
 * Architecture rules (do not break):
 *  • ONE canvas, covers the entire world rect (worldWidth × worldHeight).
 *  • Container View and canvas both start at left:0, top:0.
 *  • No negative offsets, no padding, no +200/+400 expansion.
 *  • Backing dimensions: ceil(worldWidth * DPR) × ceil(worldHeight * DPR).
 *  • CSS width/height == worldWidth × worldHeight (unchanged by DPR).
 *  • pointerEvents: none on both container and canvas.
 *  • Web-only — returns null on native.
 *
 * Render order contract (from HexMapLayer):
 *   ChapterBackground → HexTerrain → WorldContent → Gate → FogOfWarLayer → UI
 */

import React, { useLayoutEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { JOURNEY_Z } from '../../../components/journey/journeyZ';
import { drawFogOfWar } from './fogOfWar';
import { buildFogMaskCacheKey } from './fogMask';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  worldWidth:  number;
  worldHeight: number;

  /**
   * Tile IDs that have ever entered the player's FOV (monotonically growing).
   * Push 4: erased as 'exploredButOutOfVision' lobes (light haze remains).
   */
  exploredTileIds?: readonly string[];

  /**
   * Live FOV ring — tile IDs currently visible from the player's position.
   * Push 4: erased as sharper 'visibleNow' lobes (fog-free).
   */
  visibleTileIds?: ReadonlySet<string>;

  // ── Push 4: erasure geometry ────────────────────────────────────────────────

  /** Resolved tile edge length in display pixels (coords.sz). */
  sz?: number;

  /**
   * World-space centre point per tile ID, built by HexMapLayer from
   * coords.axialToWorld(q, r): cx = left + sz/2, cy = top + sz/2.
   */
  tileCenters?: ReadonlyMap<string, { cx: number; cy: number }>;

  /** Player's effective field of vision radius. Default 1. */
  effectiveFieldOfVision?: number;

  /** JourneyRun seed — deterministic organic lobe profiles. */
  runSeed?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function FogOfWarLayer(props: Props): React.ReactElement | null {
  // Web only — native has no canvas API at this layer.
  if (Platform.OS !== 'web') return null;

  return <FogOfWarLayerWeb {...props} />;
}

// Separated so the hooks always run (no early return before hooks rule).
function FogOfWarLayerWeb({
  worldWidth,
  worldHeight,
  exploredTileIds,
  visibleTileIds,
  sz,
  tileCenters,
  effectiveFieldOfVision,
  runSeed,
}: Props): React.ReactElement {
  const containerRef = useRef<View>(null);
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const cacheKeyRef  = useRef<string>('');

  // ── Effect A: create the canvas (dimensions only) ──────────────────────────
  // useLayoutEffect fires synchronously after DOM mutations but BEFORE the
  // browser paints — canvas is in the DOM and the foundation fill is drawn
  // on the very first frame (no blank flash, screenshot-tool-visible).
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const container = containerRef.current as unknown as HTMLDivElement | null;
    if (!container) return;

    const DPR = window.devicePixelRatio ?? 1;

    const canvas          = document.createElement('canvas');
    canvas.style.cssText  =
      `position:absolute;left:0;top:0;` +
      `width:${worldWidth}px;height:${worldHeight}px;` +
      `pointer-events:none;`;

    // Backing (pixel) dimensions — HiDPI-correct, no fractional pixels.
    canvas.width  = Math.ceil(worldWidth  * DPR);
    canvas.height = Math.ceil(worldHeight * DPR);

    container.appendChild(canvas);
    canvasRef.current  = canvas;
    cacheKeyRef.current = ''; // force a draw on (re)attach

    return () => {
      canvas.remove();
      canvasRef.current   = null;
      cacheKeyRef.current = '';
    };
  }, [worldWidth, worldHeight]);

  // ── Effect B: draw / redraw when visibility inputs change ──────────────────
  // Camera pan never appears here — it is NOT in these deps.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const visibleNowIds = visibleTileIds ?? new Set<string>();
    const exploredIds   = new Set(exploredTileIds ?? []);

    // Skip redraws when nothing that affects the output changed.
    const nextKey = buildFogMaskCacheKey({
      runId:                  runSeed ?? 'fixture-default',
      worldWidth,
      worldHeight,
      tileSize:               sz ?? 0,
      effectiveFieldOfVision: effectiveFieldOfVision ?? 1,
      visibleNowIds,
      exploredIds,
    });
    if (nextKey === cacheKeyRef.current) return;
    cacheKeyRef.current = nextKey;

    // Fire-and-forget — canvas is already in the DOM; the draw updates it
    // asynchronously as the texture loads (foundation renders immediately,
    // texture + reveal erasure appear once the image resolves).
    drawFogOfWar(canvas, {
      worldWidth,
      worldHeight,
      exploredTileIds,
      visibleTileIds,
      sz,
      tileCenters,
      effectiveFieldOfVision,
      runSeed,
    }).catch((err) => {
      console.warn('[FogOfWarLayer] drawFogOfWar failed:', err);
    });
  }, [
    worldWidth,
    worldHeight,
    exploredTileIds,
    visibleTileIds,
    sz,
    tileCenters,
    effectiveFieldOfVision,
    runSeed,
  ]);

  return (
    <View
      ref={containerRef}
      style={[
        styles.container,
        {
          width:        worldWidth,
          height:       worldHeight,
          zIndex:       JOURNEY_Z.FOG_MID,  // 5200 — above Gate (5100)
          // Use style.pointerEvents (not prop) — required on Expo web.
          pointerEvents: 'none',
        },
      ]}
    >
      {/* Dev diagnostic — __DEV__ only, never ships ─────────────────────────
        * Shows that the fog canvas is perfectly aligned to the world rect.
        * Positioned at top:8, left:8 of the WORLD container so it stays
        * visible when the camera centers on the initial player position.
        *
        *   FOG ALIGNMENT
        *   Background:   382 × 351 @ 0,0
        *   FogOfWar:     382 × 351 @ 0,0
        *
        * Values come from worldWidth/worldHeight (runtime, not hardcoded).
        * Both rows must be identical — that is the acceptance criterion.
        */}
      {/* Push 2 alignment check: fog canvas dims must equal world dims.
          Full camera diagnostic is in fog-map.tsx CameraDiagnosticsPanel (viewport-level).
          __DEV__ only — never ships. */}
      {__DEV__ && <FogAlignmentCheck worldWidth={worldWidth} worldHeight={worldHeight} />}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dev diagnostic panel
// ─────────────────────────────────────────────────────────────────────────────

/** Confirms fog canvas is sized to world rect (both axes must match MapWorld). */
function FogAlignmentCheck({
  worldWidth,
  worldHeight,
}: {
  worldWidth:  number;
  worldHeight: number;
}): React.ReactElement {
  const w = Math.round(worldWidth);
  const h = Math.round(worldHeight);

  return (
    <View style={[diagStyles.panel, { pointerEvents: 'none' }]}>
      <Text style={diagStyles.header}>FOG CANVAS</Text>
      <Text style={diagStyles.label}>FogOfWar:</Text>
      <Text style={diagStyles.value}>{w} × {h} @ 0,0</Text>
      <Text style={diagStyles.label}>↑ must equal MapWorld</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left:     0,
    top:      0,
    overflow: 'hidden',
  },
});

const diagStyles = StyleSheet.create({
  panel: {
    position:        'absolute',
    left:            8,
    top:             8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius:    6,
    paddingHorizontal: 10,
    paddingVertical:   7,
    zIndex:          14600,
  },
  header: {
    color:      '#f0f0f0',
    fontSize:   9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  label: {
    color:     '#94a3b8',
    fontSize:  9,
    marginTop: 2,
  },
  value: {
    color:      '#4ade80',
    fontSize:   10,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
});
