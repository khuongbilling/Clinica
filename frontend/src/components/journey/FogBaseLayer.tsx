/**
 * FogBaseLayer — Layer 2 Base Fog renderer (Push 4)
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png
 *
 * REFERENCE ONLY. Never render that file in gameplay.
 *
 * ── Role in the layer stack ───────────────────────────────────────────────────
 *
 *   ChapterEnvironment   (background painting — z 0)
 *   HexTerrain           (tile Pressables — z 100–400)
 *   WorldContent         (player, encounters — z 3000–4900)
 *   FogBaseLayer         (this component — z 5000)   ← primary concealment
 *   Gate                 (z 5100)
 *   FogMidLayer          (z 5200)
 *   FogEdgeLayer         (z 5300)
 *   FogWispLayer         (z 5400)
 *
 * At z 5000, the canvas sits ABOVE all terrain (100–400) and world content
 * (3000–4900).  The visibility mask from fogMask.ts (destination-in
 * compositing) punches transparent holes over explored / visible-now tile
 * centres so terrain and objects show through the fog; unexplored tiles and
 * their world objects remain hidden beneath the opaque canvas.
 *
 * ── Redraw triggers ───────────────────────────────────────────────────────────
 *
 *   • tiles change      (player moves → visibility set changes)
 *   • worldW / worldH / sz change
 *   • timeOfDay changes (future: per-shift asset swap)
 *   • runSeed changes   (new run → new deterministic placement)
 *
 *   Camera pan does NOT trigger a redraw — the canvas translates inside
 *   MapWorld with the camera transform.
 *
 * ── Platform ──────────────────────────────────────────────────────────────────
 *
 *   Web: HTML5 Canvas 2D (imperative DOM canvas appended to a container View).
 *   Native: null — fog rendering for native uses a different path (future push).
 */

import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

import { drawFogBase } from '@/src/game/journeyMap/fog/fogBase';
import { buildFogMaskCacheKey } from '@/src/game/journeyMap/fog/fogMask';
import {
  calculateVisibleTileIds,
  getEffectiveVisionRadius,
  DEFAULT_PLAYER_VISION_STATS,
} from '@/src/game/journeyMap/fog/fogVision';
import type { HexMapTile } from '@/src/game/journeyMap/fixture';
import type { HexWorldCoords } from './hexWorldCoords';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FogBaseLayerProps {
  /** All tiles in the active run — never filter this array. */
  tiles:      readonly HexMapTile[];
  /** Pre-computed world coordinate system (same object HexMapLayer uses). */
  coords:     HexWorldCoords;
  worldWidth:  number;
  worldHeight: number;
  /**
   * JourneyRun seed — drives deterministic fog instance placement.
   * Same seed → same layout every time the same run is loaded.
   */
  runSeed:    string;
}

/** z-index of the fog canvas inside MapWorld.
 *  Must be above terrain (100–400) and world content (3000–4900);
 *  below Gate (5100), FogMid (5200), FogEdge (5300), FogWisp (5400).
 *  Matches JOURNEY_Z.FOG_BASE. */
export const FOG_BASE_Z = 5000;

// ── Component ─────────────────────────────────────────────────────────────────

export function FogBaseLayer({
  tiles,
  coords,
  worldWidth,
  worldHeight,
  runSeed,
}: FogBaseLayerProps): React.ReactElement | null {
  const containerRef = useRef<View>(null);
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const cacheKeyRef  = useRef<string>('');

  // ── Effect A: create / destroy the imperative canvas ──────────────────────
  // Runs once on mount (canvas created) and on unmount (canvas removed).
  // Run-seed changes unmount+remount the whole layer so a new placement is
  // computed — if you want live seed changes, add `runSeed` to this dep array.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;

    const container = containerRef.current as unknown as HTMLDivElement | null;
    if (!container) return;

    const canvas = document.createElement('canvas');
    // Push 3: canvas is exactly worldWidth × worldHeight at origin 0,0.
    // MapViewport clips any overflow — no bleed padding needed.
    canvas.style.cssText = `position:absolute;left:0;top:0;pointer-events:none;`;
    container.appendChild(canvas);
    canvasRef.current  = canvas;
    cacheKeyRef.current = ''; // force a draw on first attach

    return () => {
      canvas.remove();
      canvasRef.current  = null;
      cacheKeyRef.current = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSeed]); // re-create canvas when run changes → new seeded placement

  // ── Effect B: draw / redraw when visibility inputs change ─────────────────
  // Camera pan never appears here — it is NOT in these deps.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { sz } = coords;

    // Build tile centres and classify visibility for the mask.
    const tileCenters   = new Map<string, { cx: number; cy: number }>();
    const exploredIds   = new Set<string>();
    let   currentCoord: { q: number; r: number } | undefined;

    for (const tile of tiles) {
      const { left, top } = coords.axialToWorld(tile.q, tile.r);
      tileCenters.set(tile.id, { cx: left + sz / 2, cy: top + sz / 2 });
      // Find the current tile so we can run the canonical FOV calculation.
      if (tile.current) currentCoord = { q: tile.q, r: tile.r };
      // Explored = previously visited tiles now outside the FOV window.
      if (tile.visibility === 'exploredButOutOfVision') exploredIds.add(tile.id);
    }

    // FOV: use calculateVisibleTileIds so the clearing reflects BASE_FOV (1),
    // which includes the current hex PLUS all adjacent hexes within distance 1
    // (up to 7 tiles total for an interior position).
    // Using isCurrent alone produced visibleNow = 1, which is wrong.
    const fov = getEffectiveVisionRadius(DEFAULT_PLAYER_VISION_STATS);
    const visibleNowIds: ReadonlySet<string> = currentCoord
      ? calculateVisibleTileIds({ currentTile: currentCoord, tiles, visionRadius: fov })
      : new Set<string>();
    // Push 3: buildFogMaskCacheKey includes runId + world dimensions so a
    // viewport resize correctly forces a full redraw (cache bug fix).
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

    // Async — image load is cached after first call; subsequent calls are fast.
    void drawFogBase(canvas, {
      worldWidth,
      worldHeight,
      sz,
      tileCenters,
      visibleNowIds,
      exploredIds,
      effectiveFieldOfVision: fov,
      runSeed,
    });
  // coords.axialToWorld is stable for the same tiles+containerWidth; including
  // coords would cause spurious redraws — sz and tiles are sufficient signals.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, worldWidth, worldHeight, coords.sz, runSeed]);

  // Native: no canvas-based fog yet
  if (Platform.OS !== 'web') return null;

  // ── Container View ────────────────────────────────────────────────────────
  // The canvas is appended inside this div in Effect A.
  // The div is world-space: it lives inside MapWorld and translates with the
  // camera — no redraw on pan.
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
        zIndex:   FOG_BASE_Z,
        overflow: 'hidden',
      }}
    />
  );
}
