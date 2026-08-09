/**
 * chapterMapVisuals.ts — PUSH 8
 *
 * Shift-aware visual theme registry for chapter fog-maps.
 *
 * Each chapter registers three shift variants (day / evening / night).
 * `getChapterMapVisuals(chapter, timeOfDay)` is the single call-site for
 * resolving which assets to use; callers never hard-code asset paths.
 *
 * Metro bundler requires STATIC require() calls — asset paths cannot be
 * constructed from runtime strings.  All fields are `number` (the resolved
 * Metro asset reference), not the `string` paths suggested in the spec.
 *
 * Fallback rule (enforced):
 *   If dedicated day/evening artwork does not yet exist for a given layer,
 *   use the existing raster as a temporary placeholder.
 *   DO NOT fake the visual with CSS hue-rotate, brightness, inversion,
 *   or any other filter.  Final art must be dedicated raster PNG/WebP.
 *
 * HOW TO ADD A CHAPTER:
 *   1. Add a CHAPTER_SHIFT_VISUALS[N] entry with all three shifts.
 *   2. For any shift whose terrain art is not yet finalised, spread
 *      DEFAULT_SHIFT_VISUALS[shift] and override only background (and any
 *      other layers that DO have approved art for that shift).
 *   3. Ship; terrain art updates only require changing the require() here —
 *      no caller changes needed.
 */

import type { TimeOfDay } from './types';

// ── Visual theme interface ────────────────────────────────────────────────────

export interface ChapterShiftVisuals {
  /**
   * Map-platform background rendered behind all tiles.
   * The primary shift differentiator — three dedicated rasters per chapter.
   */
  background: number;

  /**
   * Fog overlay texture applied on top of HIDDEN tiles (interior fog body).
   * Different shifts may use lighter/denser fog art.
   */
  fogInterior: number;

  /**
   * Fog edge indicator (representative single direction: bottom).
   * Direction-specific variants (fog-edge-top/bottom/left/right.webp) exist
   * in assets/ui/journey/fog/; wire direction-specific logic in the renderer
   * when the art set is finalized.
   */
  fogEdge: number;

  /**
   * Hex tile texture for REVEALED tiles (terrain the player has visited or
   * can see but carries no encounter).
   */
  terrainBase: number;

  /**
   * Hex tile texture for the CURRENT tile (player's position, jade glow).
   * Keep the jade glow aesthetic across shifts.
   */
  terrainCurrent: number;

  /**
   * Hex tile texture for FRONTIER tiles (adjacent, reachable, not yet entered).
   */
  terrainFrontier: number;

  /**
   * Optional ambient overlay rendered on top of all tiles inside the map
   * viewport (e.g. light rays, dusk particle haze, night vignette).
   * Must be a raster asset — no CSS filter substitutes.
   * Omit until a dedicated ambient raster is approved.
   */
  ambientOverlay?: number;
}

// ── Shared asset references (module-level statics required by Metro) ──────────

// Backgrounds
const BG_DAY     = require('@/assets/ui/journey/map/map-platform-background-day.webp')     as number;
const BG_EVENING = require('@/assets/ui/journey/map/map-platform-background-evening.webp') as number;
// Night IS the canonical dark environment — used explicitly, not as a generic fallback.
const BG_NIGHT   = require('@/assets/ui/journey/map/map-platform-background.webp')          as number;

// Fog
const FOG_INTERIOR = require('@/assets/ui/journey/fog/fog-tile.webp')         as number;
const FOG_EDGE     = require('@/assets/ui/journey/fog/fog-edge-bottom.webp')  as number;

// Tile art — shift-unaware for now; replaced per-shift when dedicated art ships
const TILE_BASE     = require('@/assets/ui/journey/tiles/hex-revealed.webp')  as number;
const TILE_CURRENT  = require('@/assets/ui/journey/tiles/hex-current.webp')   as number;
const TILE_FRONTIER = require('@/assets/ui/journey/tiles/hex-frontier.webp')  as number;

// ── Global default visuals ────────────────────────────────────────────────────
// Used for any chapter/shift without a dedicated registry entry.
// Terrain tiles are the same across all three defaults — no shift-specific
// terrain art exists yet.  Backgrounds differ by shift.

const DEFAULT_SHIFT_VISUALS: Record<TimeOfDay, ChapterShiftVisuals> = {
  day: {
    background:      BG_DAY,
    fogInterior:     FOG_INTERIOR,
    fogEdge:         FOG_EDGE,
    terrainBase:     TILE_BASE,
    terrainCurrent:  TILE_CURRENT,
    terrainFrontier: TILE_FRONTIER,
  },
  evening: {
    background:      BG_EVENING,
    fogInterior:     FOG_INTERIOR,
    fogEdge:         FOG_EDGE,
    terrainBase:     TILE_BASE,
    terrainCurrent:  TILE_CURRENT,
    terrainFrontier: TILE_FRONTIER,
  },
  night: {
    background:      BG_NIGHT,
    fogInterior:     FOG_INTERIOR,
    fogEdge:         FOG_EDGE,
    terrainBase:     TILE_BASE,
    terrainCurrent:  TILE_CURRENT,
    terrainFrontier: TILE_FRONTIER,
  },
};

// ── Per-chapter shift visuals registry ───────────────────────────────────────

const CHAPTER_SHIFT_VISUALS: Partial<Record<number, Record<TimeOfDay, ChapterShiftVisuals>>> = {};

// ── Chapter 1: "Atrium Approach" ─────────────────────────────────────────────
//
// DAY — Push 9 dedicated raster set:
//   background  map-platform-background-ch1-day.png — grand healing-academy
//               atrium in warm morning sunlight, jade-teal pillars, gold
//               accents, living greenery, pale atmospheric mist.
//   fogInterior fog-tile-day.png — pale blue-grey / white atmospheric mist,
//               opaque enough to fully conceal tile content while reading
//               as daylight fog (not rendered brighter mechanically).
//   terrainBase hex-revealed-day.png — warm cream stone hex with jade lotus
//               healing rune, antique-gold border trim.
//   terrainFrontier hex-frontier-day.png — cream stone, jade-teal glow border,
//               cloud-scroll relief, transparent background.
//   terrainCurrent  hex-current-day.png — jade-gold lotus mandala, full
//               jade radiance, transparent background.
//   fogEdge     inherits from default (no shift-specific edge raster yet).
//
// EVENING — dedicated background; terrain falls back to defaults.
//
// NIGHT — canonical dark environment — assigned explicitly, not a catch-all.

// Push 9 Ch1 Day rasters (PNG — Metro requires static require calls)
const CH1_DAY_BG       = require('@/assets/ui/journey/map/map-platform-background-ch1-day.png')  as number;
const CH1_DAY_FOG      = require('@/assets/ui/journey/fog/fog-tile-day.png')                      as number;
const CH1_DAY_REVEALED = require('@/assets/ui/journey/tiles/hex-revealed-day.png')                as number;
const CH1_DAY_FRONTIER = require('@/assets/ui/journey/tiles/hex-frontier-day.png')                as number;
const CH1_DAY_CURRENT  = require('@/assets/ui/journey/tiles/hex-current-day.png')                 as number;

CHAPTER_SHIFT_VISUALS[1] = {
  day: {
    background:      CH1_DAY_BG,
    fogInterior:     CH1_DAY_FOG,
    fogEdge:         FOG_EDGE,          // no shift-specific edge raster yet
    terrainBase:     CH1_DAY_REVEALED,
    terrainCurrent:  CH1_DAY_CURRENT,
    terrainFrontier: CH1_DAY_FRONTIER,
  },
  evening: {
    ...DEFAULT_SHIFT_VISUALS.evening,
    background: BG_EVENING,
    // Terrain and fog inherit defaults until evening-specific tile art ships.
  },
  night: {
    ...DEFAULT_SHIFT_VISUALS.night,
    // Night is explicitly assigned — the dark environment belongs to this shift.
    background: BG_NIGHT,
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the shift-appropriate visual theme for a chapter fog-map.
 *
 * Resolution order:
 *   1. Per-chapter shift entry  → CHAPTER_SHIFT_VISUALS[chapter][timeOfDay]
 *   2. Global default for shift → DEFAULT_SHIFT_VISUALS[timeOfDay]
 *
 * Always returns a complete ChapterShiftVisuals object — callers never
 * receive undefined.  Pass the result's fields directly to HexMapLayer
 * (`tileVisuals`) and the map background Image (`background`).
 *
 * @param chapter   Chapter number (1-based).
 * @param timeOfDay 'day' | 'evening' | 'night'
 */
export function getChapterMapVisuals(
  chapter:    number,
  timeOfDay:  TimeOfDay,
): ChapterShiftVisuals {
  return CHAPTER_SHIFT_VISUALS[chapter]?.[timeOfDay] ?? DEFAULT_SHIFT_VISUALS[timeOfDay];
}
