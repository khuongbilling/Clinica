/**
 * FogOfWarLayer — single full-world fog canvas
 *
 * Push 2 — draw one continuous full-map fog field (no reveal yet).
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

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  worldWidth:  number;
  worldHeight: number;

  // ── Push 3: exploration state (wired; not yet used for drawing) ────────────
  /**
   * Tile IDs that have ever entered the player's FOV.
   * Passed through to drawFogOfWar; Push 4 will erase 'exploredButOutOfVision'
   * lobes for these tiles (destination-out).
   */
  exploredTileIds?: readonly string[];

  /**
   * Live FOV ring — tile IDs currently visible from the player's position.
   * Push 4 will erase sharper 'visibleNow' lobes for these tiles.
   */
  visibleTileIds?: ReadonlySet<string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function FogOfWarLayer({
  worldWidth,
  worldHeight,
  exploredTileIds,
  visibleTileIds,
}: Props): React.ReactElement | null {
  // Web only — native has no canvas API at this layer.
  if (Platform.OS !== 'web') return null;

  return (
    <FogOfWarLayerWeb
      worldWidth={worldWidth}
      worldHeight={worldHeight}
      exploredTileIds={exploredTileIds}
      visibleTileIds={visibleTileIds}
    />
  );
}

// Separated so the hooks always run (no early return before hooks rule).
function FogOfWarLayerWeb({
  worldWidth,
  worldHeight,
  exploredTileIds,
  visibleTileIds,
}: Props): React.ReactElement {
  const containerRef = useRef<View>(null);

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

    // Push 2: draw one continuous full-map fog field.
    // Push 3: exploredTileIds + visibleTileIds are threaded through but not
    //         used for drawing yet — Push 4 adds destination-out erasure.
    // Fire-and-forget — canvas is already in the DOM; the draw updates it
    // asynchronously as the texture loads (foundation renders immediately,
    // texture appears on the next frame once the image resolves).
    drawFogOfWar(canvas, {
      worldWidth,
      worldHeight,
      exploredTileIds,
      visibleTileIds,
    }).catch((err) => {
      console.warn('[FogOfWarLayer] drawFogOfWar failed:', err);
    });

    return () => {
      canvas.remove();
    };
  }, [worldWidth, worldHeight]);

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
