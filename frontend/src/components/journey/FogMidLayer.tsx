/**
 * FogMidLayer — Layer 3 Mid Fog renderer (Push 5)
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
 *   FogMidLayer          (Layer 3, z 5200 — THIS COMPONENT)
 *   FogEdgeLayer         (z 5300)
 *   FogWispLayer         (z 5400)
 *
 * Mid Fog sits directly above Base Fog in world space.  Both layers clear in
 * the same way (same visibility mask) — the behavioural difference comes purely
 * from the lower instance opacity (0.30–0.60 vs Base's 0.70–0.90) and smaller
 * instance scale, giving atmospheric layering in unexplored terrain.
 *
 * ── Redraw triggers ───────────────────────────────────────────────────────────
 *
 *   Same as FogBaseLayer: tiles / worldW / worldH / sz / runSeed changes.
 *   Camera pan does NOT trigger a redraw.
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web: HTML5 Canvas 2D.
 *   Native: null stub.
 */

import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

import { drawFogMid, FOG_MID_WORLD_PADDING } from '@/src/game/journeyMap/fog/fogMid';
import { fogMaskCacheKey } from '@/src/game/journeyMap/fog/fogMask';
import {
  fogVisibilityFromTileState,
  getEffectiveVisionRadius,
  DEFAULT_PLAYER_VISION_STATS,
} from '@/src/game/journeyMap/fog/fogVision';
import type { HexMapTile } from '@/src/game/journeyMap/fixture';
import type { HexWorldCoords } from './hexWorldCoords';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FogMidLayerProps {
  tiles:       readonly HexMapTile[];
  coords:      HexWorldCoords;
  worldWidth:  number;
  worldHeight: number;
  runSeed:     string;
}

/** z-index inside MapWorld — above Gate (5100), below FogEdge (5300).
 *  Matches JOURNEY_Z.FOG_MID. */
export const FOG_MID_Z = 5200;

// ── Component ─────────────────────────────────────────────────────────────────

export function FogMidLayer({
  tiles,
  coords,
  worldWidth,
  worldHeight,
  runSeed,
}: FogMidLayerProps): React.ReactElement | null {
  const containerRef = useRef<View>(null);
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const cacheKeyRef  = useRef<string>('');

  // Effect A: create / destroy the imperative canvas
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;

    const container = containerRef.current as unknown as HTMLDivElement | null;
    if (!container) return;

    const canvas = document.createElement('canvas');
    // Offset by −padding so the extended canvas bleeds past all world edges.
    canvas.style.cssText = `position:absolute;left:${-FOG_MID_WORLD_PADDING}px;top:${-FOG_MID_WORLD_PADDING}px;pointer-events:none;`;
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

  // Effect B: redraw when visibility inputs change
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { sz } = coords;

    // Build tile centres and classify visibility for the mask.
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
    const nextKey = fogMaskCacheKey({ visibleNowIds, exploredIds, effectiveFieldOfVision: fov, sz });
    if (nextKey === cacheKeyRef.current) return;
    cacheKeyRef.current = nextKey;

    void drawFogMid(canvas, {
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
        zIndex:   FOG_MID_Z,
      }}
    />
  );
}
