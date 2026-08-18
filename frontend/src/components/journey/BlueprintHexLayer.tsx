/**
 * BlueprintHexLayer — architectural blueprint base layer  (Blueprint Push)
 *
 * The foundational background for blueprint-chapter maps.
 * Renders the ENTIRE hex grid as dark-navy architectural linework — always
 * visible everywhere on the map, including unexplored areas.
 *
 * ── Role in the layer stack ───────────────────────────────────────────────────
 *
 *   BlueprintHexLayer   z = JOURNEY_Z.BACKGROUND (0)   ← this component
 *   EnvironmentReveal   z = JOURNEY_Z.ENV_REVEAL  (1)   ← developed env reveal
 *   HexTerrain          z = 100–400
 *   WorldContent        z = 3000–4900
 *   FogOfWarLayer       z = 5200  (semi-transparent in unexplored areas, so the
 *                                  blueprint shows through as dark architecture)
 *
 * ── Visual language ───────────────────────────────────────────────────────────
 *
 *   Background: deep ink-navy (#060D1A)
 *   Graph paper: very faint blue-white grid lines (blueprint graph paper feel)
 *   Hex outlines: thin teal/cyan at 22–42 % opacity, varying by zone type
 *   Start tile:   teal cross + small circle marker
 *   Gate tile:    purple diamond marker
 *   World frame:  thin border with corner tick marks
 *
 * All geometry is derived from coords.axialToWorld() — no inline formulas.
 * This ensures the blueprint outline always aligns perfectly with terrain tiles.
 *
 * Web-only — returns null on native.
 */

import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import type { HexMapTile } from '@/src/game/journeyMap/fixture';
import type { HexWorldCoords } from './hexWorldCoords';
import { JOURNEY_Z } from './journeyZ';

// ── Blueprint visual constants ─────────────────────────────────────────────────

/** Background: deep ink-navy — darker than the fog so the blueprint reads as
 *  a distinct substrate even with semi-transparent fog above. */
const BG_COLOR = '#060D1A';

/** Very fine graph-paper grid — classic blueprint draughting sheet.
 *  Low opacity keeps it subtle; it should read as texture, not clutter. */
const GRID_COLOR   = 'rgba(80, 140, 200, 0.055)';
const GRID_SPACING = 13;  // px between graph-paper grid lines

/** Hex outline colours — teal family, brightness varies by zone function. */
const HEX_STROKE_CLEARING   = 'rgba(105, 215, 225, 0.42)';  // open encounter zone — brightest
const HEX_STROKE_LANE        = 'rgba( 72, 180, 192, 0.22)';  // primary path — moderate
const HEX_STROKE_TRANSITION  = 'rgba( 65, 165, 178, 0.18)';  // connector — faint
const HEX_STROKE_DEFAULT     = 'rgba( 80, 195, 200, 0.26)';  // unclassified — base

/** Special-tile annotation colours. */
const START_COLOR = 'rgba(110, 245, 195, 0.65)';  // teal-jade — player origin
const GATE_COLOR  = 'rgba(165, 105, 255, 0.58)';  // purple     — chapter exit

/** Inset factor for the hex outline polygon (keeps stroke inside bounding box). */
const HEX_INSET = 0.84;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface BlueprintHexLayerProps {
  tiles:        readonly HexMapTile[];
  coords:       HexWorldCoords;
  worldWidth:   number;
  worldHeight:  number;
  /** Tile ID of the player start position (draws cross + circle annotation). */
  startTileId?: string;
  /** Tile ID of the chapter gate (draws diamond annotation). */
  gateTileId?:  string;
  /** Run seed — used as a cache key (not for drawing randomness). */
  runSeed?:     string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BlueprintHexLayer(props: BlueprintHexLayerProps): React.ReactElement | null {
  if (Platform.OS !== 'web') return null;
  return <BlueprintHexLayerWeb {...props} />;
}

function BlueprintHexLayerWeb({
  tiles,
  coords,
  worldWidth,
  worldHeight,
  startTileId,
  gateTileId,
}: BlueprintHexLayerProps): React.ReactElement {
  const containerRef = useRef<View>(null);
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);

  // ── Effect A: create canvas once on mount ──────────────────────────────────
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const container = containerRef.current as unknown as HTMLDivElement | null;
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
    container.appendChild(canvas);
    canvasRef.current = canvas;

    return () => {
      canvas.remove();
      canvasRef.current = null;
    };
  }, []);

  // ── Effect B: redraw whenever geometry or tile list changes ────────────────
  // Camera pan does NOT appear here — no redraw on pan.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof document === 'undefined') return;
    drawBlueprint(canvas, { tiles, coords, worldWidth, worldHeight, startTileId, gateTileId });
  // coords is derived from tiles+containerWidth; tiles in deps covers both.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, worldWidth, worldHeight, startTileId, gateTileId]);

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
        zIndex:   JOURNEY_Z.BACKGROUND,
      }}
    />
  );
}

// ── Draw function ─────────────────────────────────────────────────────────────

function drawBlueprint(
  canvas: HTMLCanvasElement,
  {
    tiles,
    coords,
    worldWidth,
    worldHeight,
    startTileId,
    gateTileId,
  }: BlueprintHexLayerProps,
): void {
  const DPR = window.devicePixelRatio ?? 1;
  const { sz } = coords;

  // Size the canvas (DPR-correct; CSS size unchanged).
  canvas.style.width  = `${worldWidth}px`;
  canvas.style.height = `${worldHeight}px`;
  canvas.width  = Math.ceil(worldWidth  * DPR);
  canvas.height = Math.ceil(worldHeight * DPR);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, worldWidth, worldHeight);

  // ── Step 1: solid dark-navy background ────────────────────────────────────
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  // ── Step 2: blueprint graph-paper grid lines ──────────────────────────────
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth   = 0.5;
  for (let y = 0; y <= worldHeight; y += GRID_SPACING) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(worldWidth, y); ctx.stroke();
  }
  for (let x = 0; x <= worldWidth; x += GRID_SPACING) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, worldHeight); ctx.stroke();
  }

  // ── Step 3: hex polygon outlines for ALL tiles ────────────────────────────
  // Flat-top hex vertex formula (matches hexPoints() in HexMapLayer exactly):
  //   R = (sz/2) × HEX_INSET      (horizontal radius)
  //   r = R × √3/2 ≈ R × 0.866   (vertical radius / short radius)
  //   Vertices: right, br, bl, left, tl, tr  (clockwise)
  const R = (sz / 2) * HEX_INSET;
  const r = R * 0.866;

  for (const tile of tiles) {
    const { left, top } = coords.axialToWorld(tile.q, tile.r);
    const cx = left + sz / 2;
    const cy = top  + sz / 2;

    const isStart = tile.id === startTileId;
    const isGate  = tile.id === gateTileId;

    // Zone-specific stroke colour
    if (isStart) {
      ctx.strokeStyle = START_COLOR;
      ctx.lineWidth   = 1.1;
    } else if (isGate) {
      ctx.strokeStyle = GATE_COLOR;
      ctx.lineWidth   = 1.1;
    } else {
      switch (tile.zoneType) {
        case 'clearing':   ctx.strokeStyle = HEX_STROKE_CLEARING;  ctx.lineWidth = 0.90; break;
        case 'lane':       ctx.strokeStyle = HEX_STROKE_LANE;       ctx.lineWidth = 0.70; break;
        case 'transition': ctx.strokeStyle = HEX_STROKE_TRANSITION; ctx.lineWidth = 0.60; break;
        default:           ctx.strokeStyle = HEX_STROKE_DEFAULT;    ctx.lineWidth = 0.70; break;
      }
    }

    ctx.beginPath();
    ctx.moveTo(cx + R,     cy    );   // right
    ctx.lineTo(cx + R / 2, cy + r);   // bottom-right
    ctx.lineTo(cx - R / 2, cy + r);   // bottom-left
    ctx.lineTo(cx - R,     cy    );   // left
    ctx.lineTo(cx - R / 2, cy - r);   // top-left
    ctx.lineTo(cx + R / 2, cy - r);   // top-right
    ctx.closePath();
    ctx.stroke();

    // ── Step 4: landmark annotations ────────────────────────────────────────

    if (isStart) {
      // Cross + circle: player origin marker
      const m = Math.round(sz * 0.095);
      ctx.strokeStyle = START_COLOR;
      ctx.lineWidth   = 0.8;
      ctx.beginPath(); ctx.moveTo(cx - m, cy); ctx.lineTo(cx + m, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - m); ctx.lineTo(cx, cy + m); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, Math.round(sz * 0.065), 0, Math.PI * 2); ctx.stroke();
    }

    if (isGate) {
      // Diamond: gate / chapter exit marker
      const d = Math.round(sz * 0.12);
      ctx.strokeStyle = GATE_COLOR;
      ctx.lineWidth   = 0.9;
      ctx.beginPath();
      ctx.moveTo(cx,     cy - d);
      ctx.lineTo(cx + d, cy    );
      ctx.lineTo(cx,     cy + d);
      ctx.lineTo(cx - d, cy    );
      ctx.closePath();
      ctx.stroke();
    }
  }

  // ── Step 5: world-border frame + corner tick marks ────────────────────────
  // Faint teal rectangle at the world edge — classic blueprint drawing border.
  ctx.strokeStyle = 'rgba(80, 180, 195, 0.16)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(1.5, 1.5, worldWidth - 3, worldHeight - 3);

  const tick = 9;
  ctx.strokeStyle = 'rgba(80, 180, 195, 0.28)';
  ctx.lineWidth   = 0.8;
  const corners: Array<{ x: number; y: number }> = [
    { x: 0,          y: 0           },
    { x: worldWidth, y: 0           },
    { x: 0,          y: worldHeight },
    { x: worldWidth, y: worldHeight },
  ];
  for (const { x, y } of corners) {
    const sx = x === 0 ? 1 : -1;
    const sy = y === 0 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(x, y + sy * 2); ctx.lineTo(x, y + sy * (tick + 2)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + sx * 2, y); ctx.lineTo(x + sx * (tick + 2), y); ctx.stroke();
  }
}
