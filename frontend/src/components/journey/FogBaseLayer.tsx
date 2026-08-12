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
 *   ChapterEnvironment   (background painting)
 *   HexTerrain           (tile Pressables — z 50–5400)
 *   FogBaseLayer         (this component — z 5500)   ← primary concealment
 *   FogMidLayer          (z 5510)
 *   FogEdgeLayer         (z 5520)
 *   FogWispLayer         (z 5530)
 *   WorldObjects         (encounter nodes, gate — z 6200–7000)
 *   Player               (sprite — z 6200+)
 *
 * At z 5500, the canvas sits ABOVE all terrain Pressables including revealed
 * tiles (z 50–5400).  The visibility mask from fogMask.ts (destination-in
 * compositing) punches clear holes over explored / visible-now tile centres so
 * they show through the fog; unexplored tiles remain hidden beneath it.
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

import { drawFogBase, FOG_WORLD_PADDING } from '@/src/game/journeyMap/fog/fogBase';
import { fogMaskCacheKey } from '@/src/game/journeyMap/fog/fogMask';
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
 *  Must be above TERRAIN_BASE ceiling (5400) so fog covers all tiles,
 *  and below WorldObjects / player (6200+). */
export const FOG_BASE_Z = 5500;

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
    // Offset by −padding so the extended canvas bleeds past all world edges.
    canvas.style.cssText = `position:absolute;left:${-FOG_WORLD_PADDING}px;top:${-FOG_WORLD_PADDING}px;pointer-events:none;`;
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

    // Skip expensive canvas draw if nothing that affects the output changed.
    const nextKey = fogMaskCacheKey({ visibleNowIds, exploredIds, effectiveFieldOfVision: 1, sz });
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
      effectiveFieldOfVision: 1,
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
      }}
    />
  );
}
