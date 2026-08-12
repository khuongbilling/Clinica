/**
 * FogWispLayer — Layer 4 Foreground Wisps (Push 7)
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
 *   FogEdgeLayer         (Layer 3.5, z 5520 — boundary wisps)
 *   FogWispLayer         (Layer 4, z 5530 — THIS COMPONENT)
 *   WorldObjects         (encounter nodes, gate — z 6200–7000)
 *   Player               (sprite — z 6200+)
 *
 * Topmost fog layer — thin surface wisps at 0.20–0.45 opacity over unexplored
 * terrain.  Uses the same visibility mask as Base/Mid so the clear zone is
 * respected.  Tighter grid (3.0 × sz) and smaller scale (1.5–3.2 × sz) give
 * fine surface detail that Base/Mid cannot achieve at their coarser scales.
 *
 * ── Redraw triggers ───────────────────────────────────────────────────────────
 *
 *   • tiles change (visibility set changes)
 *   • worldW / worldH / sz change
 *   • runSeed changes
 *
 *   Camera pan does NOT trigger a redraw.
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web: HTML5 Canvas 2D.
 *   Native: null stub.
 */

import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

import { drawFogWisp, FOG_WISP_PADDING } from '@/src/game/journeyMap/fog/fogWisp';
import { fogMaskCacheKey } from '@/src/game/journeyMap/fog/fogMask';
import type { HexMapTile } from '@/src/game/journeyMap/fixture';
import type { HexWorldCoords } from './hexWorldCoords';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FogWispLayerProps {
  tiles:       readonly HexMapTile[];
  coords:      HexWorldCoords;
  worldWidth:  number;
  worldHeight: number;
  runSeed:     string;
}

/** z-index — above FogEdgeLayer (5520), below WorldObjects (6200+). */
export const FOG_WISP_Z = 5530;

// ── Component ─────────────────────────────────────────────────────────────────

export function FogWispLayer({
  tiles,
  coords,
  worldWidth,
  worldHeight,
  runSeed,
}: FogWispLayerProps): React.ReactElement | null {
  const containerRef = useRef<View>(null);
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const cacheKeyRef  = useRef<string>('');

  // Effect A: create / destroy canvas
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;

    const container = containerRef.current as unknown as HTMLDivElement | null;
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `position:absolute;left:${-FOG_WISP_PADDING}px;top:${-FOG_WISP_PADDING}px;pointer-events:none;`;
    container.appendChild(canvas);
    canvasRef.current   = canvas;
    cacheKeyRef.current = '';

    return () => {
      canvas.remove();
      canvasRef.current   = null;
      cacheKeyRef.current = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSeed]);

  // Effect B: redraw when visibility changes
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { sz } = coords;

    const tileCenters   = new Map<string, { cx: number; cy: number }>();
    const visibleNowIds = new Set<string>();
    const exploredIds   = new Set<string>();

    for (const tile of tiles) {
      const { left, top } = coords.axialToWorld(tile.q, tile.r);
      tileCenters.set(tile.id, { cx: left + sz / 2, cy: top + sz / 2 });
      if (tile.visibility === 'visibleNow' || tile.current) {
        visibleNowIds.add(tile.id);
      } else if (tile.visibility === 'exploredButOutOfVision') {
        exploredIds.add(tile.id);
      }
    }

    const nextKey = fogMaskCacheKey({ visibleNowIds, exploredIds, effectiveFieldOfVision: 1, sz });
    if (nextKey === cacheKeyRef.current) return;
    cacheKeyRef.current = nextKey;

    void drawFogWisp(canvas, {
      worldWidth,
      worldHeight,
      sz,
      tileCenters,
      visibleNowIds,
      exploredIds,
      effectiveFieldOfVision: 1,
      runSeed,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, worldWidth, worldHeight, coords.sz, runSeed]);

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
        zIndex:   FOG_WISP_Z,
      }}
    />
  );
}
