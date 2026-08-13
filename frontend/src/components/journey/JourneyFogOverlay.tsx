/**
 * JourneyFogOverlay — Journey fog-of-war rendering (Push 1: placeholder)
 *
 * Canonical visual reference:
 * /assets/dev-reference/fog_system_design_reference.png
 *
 * REFERENCE ONLY.
 * Never render this file in gameplay.
 *
 * ── Layer Architecture (from reference) ────────────────────────────────────
 *
 *  Layer 4  FogWisp (5400)      topmost mist — veils gate + upper atmosphere
 *  Layer 3.5 FogEdge (5300)    organic reveal-edge sprites at visibility boundary
 *  Layer 3  FogMid (5200)      atmospheric detail + density variation
 *  ──  Gate (5100)  ──          rises through base fog; veiled by upper layers
 *  Layer 2  FogBase (5000)     dense primary concealment (canvas, destination-in)
 *  ──  WorldContent (3000–4900) player sprite, encounters, treasure, boss
 *  ──  Terrain (100–400)        hex Pressables, rings, shadows (y-depth sorted)
 *  Layer 0  Background (0)      chapter environment painting
 *
 * ── Fog Behaviour ──────────────────────────────────────────────────────────
 *
 *  Unexplored        → dense fog  80–95 % opacity
 *  Explored (haze)   → light fog  20–40 % opacity
 *  Visible Now       → clear       0 % opacity
 *
 * ── Reveal Edge Style ──────────────────────────────────────────────────────
 *
 *  ✗  No hard circles, hex cut-outs, rectangles, sharp edges, scenic art.
 *  ✓  Soft edges, layered opacity, irregular shapes, natural wisps, seamless blend.
 *
 * ── Asset File Structure ───────────────────────────────────────────────────
 *
 *  /public/assets/fog/
 *    day/     fog_large_01.webp  fog_large_02.webp
 *             fog_medium_01.webp fog_wisp_01.webp  fog_wisp_02.webp
 *    evening/ (same set)
 *    night/   (same set)
 *
 *  All assets: transparent PNG/WebP — NO scenic backgrounds baked in.
 *
 * ── Motion (optional) ──────────────────────────────────────────────────────
 *
 *  Slow drift, subtle movement, < 1 % movement/frame, seeded per run.
 *  No repeating pattern.
 *
 * ── Implementation Notes ───────────────────────────────────────────────────
 *
 *  • Render as a world-space layer inside MapWorld (moves with camera).
 *  • Target zIndex: 5000 (above unexplored Pressables, below revealed terrain).
 *  • Use a code-generated visibility mask (Gaussian + noise) to feather reveals.
 *  • Blend fog sprites at varied scale, rotation, and opacity.
 *  • No CSS/SVG/emoji map art — raster fog PNGs/WebPs only.
 */

import type { HexWorldCoords } from './hexWorldCoords';
import type { HexMapTile } from '@/src/game/journeyMap/fixture';
import type { TimeOfDay } from '@/src/game/journeyMap/canonicalConfig';

// ── Props ─────────────────────────────────────────────────────────────────

export interface JourneyFogOverlayProps {
  /** All run tiles — required to compute the visibility mask. */
  tiles:     readonly HexMapTile[];
  /** Pre-computed world coordinate system shared with HexMapLayer. */
  coords:    HexWorldCoords;
  /** Active shift — selects the fog asset colour palette. */
  timeOfDay: TimeOfDay;
  /** Per-run seed — deterministic placement variation across sessions. */
  seed?:     string;
}

// ── Placeholder ───────────────────────────────────────────────────────────

/**
 * Push 1: placeholder — returns null until the fog layers are implemented.
 * The full render (Layers 1–4 from the canonical reference) ships in Push 2+.
 */
export function JourneyFogOverlay(_props: JourneyFogOverlayProps): null {
  return null;
}
