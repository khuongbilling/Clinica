/**
 * FogEdgeLayer — Layer 3.5 Organic Reveal-Edge Fog (Push 6)
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png  (REFERENCE ONLY)
 *
 * ── Role in the layer stack ───────────────────────────────────────────────────
 *
 *   ChapterEnvironment   (background painting)
 *   HexTerrain           (tile Pressables — z 50–5400)
 *   FogBaseLayer         (Layer 2, z 5500 — primary concealment)
 *   FogMidLayer          (Layer 3, z 5510 — atmospheric detail)
 *   FogEdgeLayer         (Layer 3.5, z 5520 — THIS COMPONENT)
 *   WorldObjects         (encounter nodes, gate — z 6200–7000)
 *   Player               (sprite — z 6200+)
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

/** z-index inside MapWorld — above Mid Fog (5510), below WorldObjects (6200+). */
export const FOG_EDGE_Z = 5520;

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
      if (tile.visibility === 'visibleNow' || tile.current) {
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
