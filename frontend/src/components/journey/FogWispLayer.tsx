/**
 * FogWispLayer — Layer 4 Foreground Wisps
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
 * terrain.  The canvas is a full worldWidth × worldHeight sheet at (0,0) — a
 * full-map layer — with sparse wisp sprites painted into it via fogWisp.ts.
 *
 * ── Shared FOV source of truth ────────────────────────────────────────────────
 *
 *   Uses calculateVisibleTileIds() — same as FogBaseLayer and FogMidLayer —
 *   so the visibility clearing is IDENTICAL across all fog layers.
 *   fogVisibilityFromTileState() must NOT be used here: it maps only
 *   tile.current === true → visibleNow (1-tile hole), which disagrees with
 *   FogBase/FogMid's correct FOV-1 clearing of up to 7 tiles.
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
  calculateVisibleTileIds,
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

/** z-index — topmost fog layer (FogEdge removed; Wisp now at 5300).
 *  Matches JOURNEY_Z.FOG_WISP. */
export const FOG_WISP_Z = 5300;

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

    // Build tile centres and classify visibility for the mask.
    const tileCenters = new Map<string, { cx: number; cy: number }>();
    const exploredIds = new Set<string>();
    let   currentCoord: { q: number; r: number } | undefined;

    for (const tile of tiles) {
      const { left, top } = coords.axialToWorld(tile.q, tile.r);
      tileCenters.set(tile.id, { cx: left + sz / 2, cy: top + sz / 2 });
      // Find the current tile so we can run the canonical FOV calculation.
      if (tile.current) currentCoord = { q: tile.q, r: tile.r };
      // Explored = previously visited tiles now outside the FOV window.
      if (tile.visibility === 'exploredButOutOfVision') exploredIds.add(tile.id);
    }

    // FOV: use calculateVisibleTileIds — SHARED source of truth with FogBaseLayer.
    // fogVisibilityFromTileState() must NOT be used here: it gives a 1-tile hole
    // (only tile.current === true → visibleNow), which disagrees with FogBase's
    // correct FOV-1 clearing of the current hex + up to 6 adjacent tiles.
    const fov = getEffectiveVisionRadius(DEFAULT_PLAYER_VISION_STATS);
    const visibleNowIds: ReadonlySet<string> = currentCoord
      ? calculateVisibleTileIds({ currentTile: currentCoord, tiles, visionRadius: fov })
      : new Set<string>();

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

    // DEV: report actual canvas CSS + visibleNow count consumed by this layer.
    if (__DEV__) console.log(`[FogWisp] CSS: ${worldWidth}×${worldHeight} @ 0,0 | visibleNow: ${visibleNowIds.size} | explored: ${exploredIds.size}`);

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
        overflow: 'hidden',
      }}
    />
  );
}
