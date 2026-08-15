/**
 * FogEdgeLayer — Layer 3.5 Organic Reveal-Edge Fog
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
 * The canvas is a full worldWidth × worldHeight sheet at (0,0) — a full-map
 * layer — but only boundary-adjacent pixels are painted into it (sparse).
 *
 * ── Shared FOV source of truth ────────────────────────────────────────────────
 *
 *   Uses calculateVisibleTileIds() — same as FogBaseLayer and FogMidLayer —
 *   so the visible-now set is IDENTICAL across all fog layers.
 *   fogVisibilityFromTileState() must NOT be used here: it maps only
 *   tile.current === true → visibleNow (1-tile hole), which disagrees with
 *   FogBase/FogMid's correct FOV-1 clearing of up to 7 tiles.
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

import { drawFogEdge } from '@/src/game/journeyMap/fog/fogEdge';
import {
  calculateVisibleTileIds,
  getEffectiveVisionRadius,
  DEFAULT_PLAYER_VISION_STATS,
} from '@/src/game/journeyMap/fog/fogVision';
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
    // Push 3: canvas is exactly worldWidth × worldHeight at origin 0,0.
    canvas.style.cssText = `position:absolute;left:0;top:0;pointer-events:none;`;
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

    // Build the visibleNow set for boundary detection using the SHARED FOV
    // source of truth (calculateVisibleTileIds), not fogVisibilityFromTileState.
    // fogVisibilityFromTileState gives a 1-tile hole while all other layers
    // use FOV-1 = up to 7 tiles; this disagreement created mismatched boundary art.
    let currentCoord: { q: number; r: number } | undefined;
    for (const tile of tiles) {
      if (tile.current) { currentCoord = { q: tile.q, r: tile.r }; break; }
    }

    const fov = getEffectiveVisionRadius(DEFAULT_PLAYER_VISION_STATS);
    const visibleNowIds: ReadonlySet<string> = currentCoord
      ? calculateVisibleTileIds({ currentTile: currentCoord, tiles, visionRadius: fov })
      : new Set<string>();

    // Cache key: redraw when the visibleNow set, tile-size, or world dimensions change.
    // World dimensions included — a resize must force regeneration.
    const nextKey = `fov=${fov}|v=${[...visibleNowIds].sort().join(',')}|sz=${coords.sz}|w=${Math.round(worldWidth)}|h=${Math.round(worldHeight)}`;
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
        overflow: 'hidden',
      }}
    />
  );
}
