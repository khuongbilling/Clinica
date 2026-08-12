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
 *  Layer 4  Foreground Wisps    sparse atmospheric mist ABOVE world objects
 *  ────────────────────────────────────────────────────────────────────────
 *  [world objects: encounters, Gate, player sprite]
 *  ────────────────────────────────────────────────────────────────────────
 *  Layer 3  Mid Fog             atmospheric detail + transition softness
 *  Layer 2  Base Fog            dense primary concealment (80–95 % opacity)
 *  Layer 1  Visibility Mask     code-generated, invisible, driven by FoV
 *  Layer 0  Map Background      tactical map / chapter environment
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
