/**
 * FogWispLayer — Layer 4 Foreground Wisps (Push 7)
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
 *   FogEdgeLayer         (Layer 3.5, z 5300 — boundary wisps)
 *   FogWispLayer         (Layer 4, z 5400 — THIS COMPONENT)
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

import { drawFogWisp } from '@/src/game/journeyMap/fog/fogWisp';
import { buildFogMaskCacheKey } from '@/src/game/journeyMap/fog/fogMask';
import {
  fogVisibilityFromTileState,
  getEffectiveVisionRadius,
  DEFAULT_PLAYER_VISION_STATS,
} from '@/src/game/journeyMap/fog/fogVision';
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

/** z-index — above FogEdgeLayer (5300), topmost fog layer.
 *  Matches JOURNEY_Z.FOG_WISP. */
export const FOG_WISP_Z = 5400;

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
    // Push 3: canvas is exactly worldWidth × worldHeight at origin 0,0.
    canvas.style.cssText = `position:absolute;left:0;top:0;pointer-events:none;`;
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
      // Central fog-visibility resolver — no direct tile.visibility comparisons.
      const fs = fogVisibilityFromTileState(tile.visibility, tile.current);
      if (fs === 'visibleNow') visibleNowIds.add(tile.id);
      else if (fs === 'explored') exploredIds.add(tile.id);
    }

    const fov     = getEffectiveVisionRadius(DEFAULT_PLAYER_VISION_STATS);
    const nextKey = buildFogMaskCacheKey({
      runId:                  runSeed,
      worldWidth,
      worldHeight,
      tileSize:               sz,
      effectiveFieldOfVision: fov,
      visibleNowIds,
      exploredIds,
    });
    if (nextKey === cacheKeyRef.current) return;
    cacheKeyRef.current = nextKey;

    void drawFogWisp(canvas, {
      worldWidth,
      worldHeight,
      sz,
      tileCenters,
      visibleNowIds,
      exploredIds,
      effectiveFieldOfVision: fov,
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
