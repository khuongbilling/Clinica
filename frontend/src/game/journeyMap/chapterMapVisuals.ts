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

// Push 10 Ch1 Evening rasters — same atrium at twilight.
//   background  map-platform-background-ch1-evening.png — amber lanterns, long
//               diagonal shadows, teal pillars in last daylight, indigo in
//               corners, central jade fountain, warm gold through arches.
//   fogInterior fog-tile-evening.png — smoky blue-grey / muted indigo with
//               warm amber highlights near lit spaces.
//   terrainBase hex-revealed-evening.png — amber-lit warm stone, jade lotus
//               rune glowing visibly, amber-silhouetted herbs at corners.
//   terrainFrontier hex-frontier-evening.png — amber-warm cloud-scroll stone,
//               jade-teal border glow more prominent in dimming light.
//   terrainCurrent  hex-current-evening.png — jade-gold mandala, green fire
//               at border, dramatically vibrant against evening stone.
const CH1_EVE_BG       = require('@/assets/ui/journey/map/map-platform-background-ch1-evening.png') as number;
const CH1_EVE_FOG      = require('@/assets/ui/journey/fog/fog-tile-evening.png')                     as number;
const CH1_EVE_REVEALED = require('@/assets/ui/journey/tiles/hex-revealed-evening.png')               as number;
const CH1_EVE_FRONTIER = require('@/assets/ui/journey/tiles/hex-frontier-evening.png')               as number;
const CH1_EVE_CURRENT  = require('@/assets/ui/journey/tiles/hex-current-evening.png')                as number;

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
    background:      CH1_EVE_BG,
    fogInterior:     CH1_EVE_FOG,
    fogEdge:         FOG_EDGE,          // no shift-specific edge raster yet
    terrainBase:     CH1_EVE_REVEALED,
    terrainCurrent:  CH1_EVE_CURRENT,
    terrainFrontier: CH1_EVE_FRONTIER,
  },
  night: {
    // Push 11 assessment — no regeneration required.
    // All existing assets already satisfy the Night spec:
    //
    //   background  map-platform-background.webp — deep navy/blue-black ward,
    //               teal medical illumination flanking corridors, purple/violet
    //               lanterns, gold compass mandala at centre.  Strong contrast,
    //               sparse localized lighting.  Canonical dark baseline.
    //
    //   fogInterior fog-tile.webp — dark teal-grey smoky atmospheric fog.
    //               Deepest of the three shift fogs.  Transparent at edges so
    //               it blends with the dark hidden-tile base below.
    //
    //   terrainBase hex-revealed.webp — dark cracked stone with thin teal
    //               medical glow edging.  Transparent background; separates
    //               clearly from the dark map environment.
    //
    //   terrainFrontier hex-frontier.webp — same dark cracked stone with
    //               rising mist and teal glow — atmospheric, readable as
    //               reachable even against a dark background.
    //
    //   terrainCurrent hex-current.webp — deep jade neon glow radiating
    //               through cracked stone; strongest glow of all three shifts,
    //               ensuring current-tile readability at low ambient light.
    //
    //   fogEdge     inherits the shared fog-edge-bottom.webp (no shift-
    //               specific edge raster needed — dark edge blends naturally).
    //
    // To replace an individual layer: swap the require() call on that line only.
    background:      BG_NIGHT,       // map-platform-background.webp — canonical dark ward
    fogInterior:     FOG_INTERIOR,   // fog-tile.webp — deepest atmospheric fog
    fogEdge:         FOG_EDGE,       // fog-edge-bottom.webp (shared)
    terrainBase:     TILE_BASE,      // hex-revealed.webp — dark cracked stone, teal glow edge
    terrainCurrent:  TILE_CURRENT,   // hex-current.webp — jade neon glow through stone
    terrainFrontier: TILE_FRONTIER,  // hex-frontier.webp — dark stone + mist, teal glow
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
