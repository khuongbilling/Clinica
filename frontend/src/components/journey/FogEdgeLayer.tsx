/**
 * FogEdgeLayer — Layer 3.5 Organic Reveal-Edge Fog (Push 6)
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png  (REFERENCE ONLY)
 *
 * ── Role in the layer stack ───────────────────────────────────────────────────
 *
 *   ChapterEnvironment   (background painting — z 0)
 *   HexTerrain           (tile Pressables — z 100–400)
 *   WorldContent         (player, encounters — z 3000–4900)
 *   FogBaseLayer         (Layer 2, z 5000 — primary concealment)
 *   Gate                 (z 5100)
 *   FogMidLayer          (Layer 3, z 5200 — atmospheric detail)
 *   FogEdgeLayer         (Layer 3.5, z 5300 — THIS COMPONENT)
 *   FogWispLayer         (z 5400)
 *
 * FogEdgeLayer places sparse fog_edge sprites ONLY near the boundary between
 * VISIBLE_NOW and unexplored / explored terrain.  Its job is to make the
 * reveal boundary look hand-painted rather than mathematically perfect.
 *
 * ── Redraw triggers ───────────────────────────────────────────────────────────
 *
 *   • tiles change (player moves → visibleNow set changes)
 *   • worldW / worldH / sz change
 *   • runSeed changes (new run → new deterministic placement)
 *
 *   Camera pan does NOT trigger a redraw.
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web: HTML5 Canvas 2D (imperative DOM canvas appended to a container View).
 *   Native: null stub.
 */

import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

import { drawFogEdge, FOG_EDGE_PADDING } from '@/src/game/journeyMap/fog/fogEdge';
import { fogVisibilityFromTileState } from '@/src/game/journeyMap/fog/fogVision';
import type { HexMapTile } from '@/src/game/journeyMap/fixture';
import type { HexWorldCoords } from './hexWorldCoords';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FogEdgeLayerProps {
  /** All tiles in the active run. */
  tiles:       readonly HexMapTile[];
  /** Pre-computed world coordinate system (same object HexMapLayer uses). */
  coords:      HexWorldCoords;
  worldWidth:  number;
  worldHeight: number;
  /** JourneyRun seed — deterministic edge sprite placement per run. */
  runSeed:     string;
}

/** z-index inside MapWorld — above FogMid (5200), below FogWisp (5400).
 *  Matches JOURNEY_Z.FOG_EDGE. */
export const FOG_EDGE_Z = 5300;

// ── Component ─────────────────────────────────────────────────────────────────

export function FogEdgeLayer({
  tiles,
  coords,
  worldWidth,
  worldHeight,
  runSeed,
}: FogEdgeLayerProps): React.ReactElement | null {
  const containerRef = useRef<View>(null);
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const cacheKeyRef  = useRef<string>('');

  // ── Effect A: create / destroy imperative canvas ───────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;

    const container = containerRef.current as unknown as HTMLDivElement | null;
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `position:absolute;left:${-FOG_EDGE_PADDING}px;top:${-FOG_EDGE_PADDING}px;pointer-events:none;`;
    container.appendChild(canvas);
    canvasRef.current  = canvas;
    cacheKeyRef.current = '';

    return () => {
      canvas.remove();
      canvasRef.current  = null;
      cacheKeyRef.current = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSeed]);

  // ── Effect B: redraw when visibility inputs change ─────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Build the visibleNow set for boundary detection.
    const visibleNowIds = new Set<string>();
    for (const tile of tiles) {
      // Central fog-visibility resolver — no direct tile.visibility comparisons.
      if (fogVisibilityFromTileState(tile.visibility, tile.current) === 'visibleNow') {
        visibleNowIds.add(tile.id);
      }
    }

    // Cache key: only redraw when the visibleNow set or tile-size changes.
    // (Boundary is fully determined by these two inputs + runSeed, which is
    //  handled by Effect A recreating the canvas on run change.)
    const nextKey = `v=${[...visibleNowIds].sort().join(',')}|sz=${coords.sz}`;
    if (nextKey === cacheKeyRef.current) return;
    cacheKeyRef.current = nextKey;

    void drawFogEdge(canvas, {
      worldWidth,
      worldHeight,
      tiles,
      coords,
      visibleNowIds,
      runSeed,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, worldWidth, worldHeight, coords.sz, runSeed]);

  // Native: no canvas-based fog yet
  if (Platform.OS !== 'web') return null;

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
        zIndex:   FOG_EDGE_Z,
      }}
    />
  );
}
