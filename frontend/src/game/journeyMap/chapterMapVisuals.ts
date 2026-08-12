/**
 * chapterMapVisuals.ts — PUSH 23
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
   * Optional painting transform for aligning the background artwork with the
   * authored hex footprint.  Applied to the background Image in fog-map.tsx.
   * Defaults (1.0, 0, 0) leave the image at its contentFit="cover" position.
   *
   *   backgroundScale   — uniform scale from the image centre (>1 zooms in).
   *                       Use to make the floor dominate and push sky/ceiling
   *                       out of the visible area.
   *
   *   backgroundOffsetX — horizontal shift in display pixels.
   *                       Positive → image moves RIGHT (content shifts right).
   *                       Negative → image moves LEFT.
   *
   *   backgroundOffsetY — vertical shift in display pixels.
   *                       Positive → image moves DOWN (lower content visible at top).
   *                       Negative → image moves UP (upper content pushed above viewport;
   *                                  use to eliminate sky from the tile zone).
   *
   * Rationale: the background is a FIXED layer that does not scroll with the
   * camera.  The transform is tuned for the INITIAL camera position (centred
   * on the chapter start tile) since that is the frame players encounter first
   * and spend the most time in.
   *
   * Set per chapter / shift only when the default centre-fill creates obvious
   * misalignment — sky over tiles, or a key landmark in a wrong tile zone.
   * Leave unset for chapters whose artwork already frames the grid naturally.
   */
  backgroundScale?:   number;
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;

  /**
   * Push 23: unified per-shift terrain tile texture.
   *
   * A single raster PNG used by HexTile Layer 0 for EVERY tile state (base,
   * frontier, current).  SVG rings in Layer 1a/2a/2b handle state indication;
   * this image sets the stone palette and lighting for the active shift:
   *
   *   day     — warm ivory/cream stone, jade lotus rune, gold vein highlights,
   *              morning light warmth
   *   evening — amber-lit stone, indigo shadows, jade rune glowing warmly,
   *              antique gold veins
   *   night   — jade-teal cracked stone, sparse gold veins, deep shadow
   *              (hex-terrain-normal.png — the original push-10 tile)
   *
   * Must be a dedicated raster per shift.  NEVER derive a shift variant by
   * applying a CSS filter (hue-rotate, brightness, etc.) at render time.
   * When absent: HexTile falls back to TERRAIN_NORMAL (night).
   */
  terrainTexture?: number;

  /**
   * @deprecated Push 23: terrainBase/Current/Frontier are superseded by the
   * single `terrainTexture` field.  HexTile uses one image for all states
   * since Push 10 (state differentiation via SVG overlays, not per-state art).
   * These fields are retained so existing Ch1 registrations don't error.
   */
  terrainBase:     number;
  terrainCurrent:  number;
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

// Tile art — legacy per-state assets kept for existing Ch1 registrations
// (terrainBase/Current/Frontier fields).  These are no longer used by the
// renderer — see the @deprecated notes on those interface fields above.
const TILE_BASE     = require('@/assets/ui/journey/tiles/hex-revealed.webp')  as number;
const TILE_CURRENT  = require('@/assets/ui/journey/tiles/hex-current.webp')   as number;
const TILE_FRONTIER = require('@/assets/ui/journey/tiles/hex-frontier.webp')  as number;

// ── Push 23: unified per-shift terrain textures ───────────────────────────────
//
// One stone tile drives ALL terrain states per shift — SVG rings/glows in
// HexTile Layers 1a/2a/2b handle state differentiation on top.
//
// Each shift is a DEDICATED raster.  No CSS filter is applied to derive
// one shift's stone from another.  DO NOT add a filter fallback.
//
//   TERRAIN_DAY     — warm ivory/cream stone, jade rune, gold veins, morning light
//   TERRAIN_EVENING — amber-lit stone, indigo shadows on extrusion, antique gold
//   TERRAIN_NIGHT   — jade-teal cracked stone, deep navy shadow (Push 10 canonical)
const TERRAIN_DAY     = require('@/assets/ui/journey/tiles/hex-terrain-day.png')     as number;
const TERRAIN_EVENING = require('@/assets/ui/journey/tiles/hex-terrain-evening.png') as number;
const TERRAIN_NIGHT   = require('@/assets/ui/journey/tiles/hex-terrain-normal.png')  as number;

// ── Global default visuals ────────────────────────────────────────────────────
// Used for any chapter/shift without a dedicated registry entry.
// Terrain tiles are the same across all three defaults — no shift-specific
// terrain art exists yet.  Backgrounds differ by shift.

// Push 23: DEFAULT_SHIFT_VISUALS now includes terrainTexture for all shifts.
// Chapters without a per-chapter CHAPTER_SHIFT_VISUALS entry will still get
// the correct shift-specific terrain tile (day/evening/night) via this default.
const DEFAULT_SHIFT_VISUALS: Record<TimeOfDay, ChapterShiftVisuals> = {
  day: {
    background:      BG_DAY,
    terrainTexture:  TERRAIN_DAY,
    terrainBase:     TILE_BASE,
    terrainCurrent:  TILE_CURRENT,
    terrainFrontier: TILE_FRONTIER,
  },
  evening: {
    background:      BG_EVENING,
    terrainTexture:  TERRAIN_EVENING,
    terrainBase:     TILE_BASE,
    terrainCurrent:  TILE_CURRENT,
    terrainFrontier: TILE_FRONTIER,
  },
  night: {
    background:      BG_NIGHT,
    terrainTexture:  TERRAIN_NIGHT,
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
//   terrainBase hex-revealed-day.png — warm cream stone hex with jade lotus
//               healing rune, antique-gold border trim.
//   terrainFrontier hex-frontier-day.png — cream stone, jade-teal glow border,
//               cloud-scroll relief, transparent background.
//   terrainCurrent  hex-current-day.png — jade-gold lotus mandala, full
//               jade radiance, transparent background.
//
// EVENING — dedicated background; terrain falls back to defaults.
//
// NIGHT — canonical dark environment — assigned explicitly, not a catch-all.

// Push 9 Ch1 Day rasters (PNG — Metro requires static require calls)
const CH1_DAY_BG       = require('@/assets/ui/journey/map/map-platform-background-ch1-day.png')  as number;
const CH1_DAY_REVEALED = require('@/assets/ui/journey/tiles/hex-revealed-day.png')                as number;
const CH1_DAY_FRONTIER = require('@/assets/ui/journey/tiles/hex-frontier-day.png')                as number;
const CH1_DAY_CURRENT  = require('@/assets/ui/journey/tiles/hex-current-day.png')                 as number;

// Push 10 Ch1 Evening rasters — same atrium at twilight.
//   background  map-platform-background-ch1-evening.png — amber lanterns, long
//               diagonal shadows, teal pillars in last daylight, indigo in
//               corners, central jade fountain, warm gold through arches.
//   terrainBase hex-revealed-evening.png — amber-lit warm stone, jade lotus
//               rune glowing visibly, amber-silhouetted herbs at corners.
//   terrainFrontier hex-frontier-evening.png — amber-warm cloud-scroll stone,
//               jade-teal border glow more prominent in dimming light.
//   terrainCurrent  hex-current-evening.png — jade-gold mandala, green fire
//               at border, dramatically vibrant against evening stone.
const CH1_EVE_BG       = require('@/assets/ui/journey/map/map-platform-background-ch1-evening.png') as number;
const CH1_EVE_REVEALED = require('@/assets/ui/journey/tiles/hex-revealed-evening.png')               as number;
const CH1_EVE_FRONTIER = require('@/assets/ui/journey/tiles/hex-frontier-evening.png')               as number;
const CH1_EVE_CURRENT  = require('@/assets/ui/journey/tiles/hex-current-evening.png')                as number;

// ── Push 12: Chapter 1 painting alignment — all three shifts ─────────────────
//
// COORDINATE BASIS (sz = 88 px, containerWidth ≈ 390 px)
// ───────────────────────────────────────────────────────
//   Q_STEP  = 0.72   R_STEP  = 0.79   Q_VOFF  = 0.395
//   worldOriginX ≈ 55    worldOriginY = 10   worldH ≈ 351   worldW ≈ 390
//
//   Key world-space positions:
//     Start tile (−1,2)  cx = 37,  cy = 158
//     Gate  tile ( 3,0)  cx = 290, cy = 168
//     Top cap (r = −3)   world top ≈ −199 to −129
//     Bottom cap (r = 3) world bottom ≈ 341
//     Grid x-centre ≈ 131   (vs canvas centre 195)
//     Grid y-centre ≈  71   (vs canvas centre 175)
//
// BACKGROUND TRANSFORM (applied to absoluteFillObject Image in MapWorld)
// ───────────────────────────────────────────────────────────────────────
//   transform: [ { scale }, { translateX }, { translateY } ]
//   contentFit = "cover"  →  1024×1024 source fills 390×351 canvas,
//   cropping 19.5 px top+bottom (scale = 390/1024 = 0.381).
//
//   A source pixel at fraction (fx, fy) appears in element space at:
//     ex = fx × 1024 × 0.381          ey = fy × 1024 × 0.381 − 19.5
//   Then the world position after transform(S, offsetX, offsetY):
//     world_x = (ex − 195) × S + 195 + offsetX
//     world_y = (ey − 175.5) × S + 175.5 + offsetY
//
// CHOSEN VALUES — same for all three shifts (paintings differ; see notes)
// ───────────────────────────────────────────────────────────────────────
//   backgroundScale  = 1.60
//     • Minimum scale to span both top tiles (world y ≈ −199) and bottom
//       tiles (world y ≈ 341): requires S ≥ 1.54; using 1.60 for margin.
//     • At S = 1.60 the transformed image spans ≈ 562 px vertically,
//       comfortably covering the 540 px tile range.
//     • Zooms into the inner floor area of each painting, pushing sky /
//       outer walls toward the image extremes.
//
//   backgroundOffsetX  — shifts painting LEFT so its architectural centre
//     lands above the hex-grid x-centre (131) rather than the canvas
//     centre (195).  Different per shift because each painting places its
//     centrepiece at a different source x:
//       Day     centrepiece ≈ 50 % → ex = 195 → offsetX = 131 − 195 = −64
//       Evening centrepiece ≈ 47 % → ex ≈ 183 → offsetX ≈ −46  (fountain)
//       Night   centrepiece ≈ 50 % → ex = 195 → offsetX = −64  (compass)
//
//   backgroundOffsetY  = −112
//     • Centres the painting's floor feature on the hex-grid y-centre (71):
//         world_y = (ey − 175.5) × 1.60 + 175.5 + offsetY = 71
//         → offsetY = 71 − 175.5 − (ey − 175.5) × 1.60
//       For the Day mandala at source y ≈ 52 % (ey ≈ 182): offsetY ≈ −112
//       Evening fountain ≈ 52 %: same calculation → −112
//       Night compass at source y = 50 % (ey = 175.5): offsetY ≈ −104,
//         but −112 satisfies the top-coverage constraint and keeps the
//         compass near the grid centre — used uniformly for consistency.
//
// RESULTING TILE → SOURCE PIXEL MAPPING (at S=1.60, offsetX=−64, offsetY=−112)
// ─────────────────────────────────────────────────────────────────────────────
//   Start tile (cx=37, cy=158) → source (24 %, 58 %)
//     Day:     left-centre inner courtyard — entrance approach to the mandala
//     Evening: left-centre floor near lower garden planters — entrance feel
//     Night:   left cross-arm of the ward corridor — lower-left entry point
//
//   Gate tile (cx=290, cy=168) → source (73 %, 59 %)
//     Day:     right-side colonnade — pillar arch framing the far-right exit
//     Evening: right staircase / archway area — sealed passage landmark
//     Night:   right cross-arm end — sealed corridor terminus (gate position)
//
//   Top cap (world y ≈ −155 avg) → source y ≈ 8 %
//     Day:     upper archway ring — entering from the outer gallery
//     Evening: entrance archway at top of painting — narrative top entry
//     Night:   top staircase / gateway — top entrance of the ward plan
//
//   Bottom cap (world y ≈ 297 avg) → source y ≈ 91 %
//     All:     lower perimeter floor — well within the traversable courtyard

CHAPTER_SHIFT_VISUALS[1] = {
  day: {
    background:        CH1_DAY_BG,
    backgroundScale:   1.60,
    backgroundOffsetX: -64,
    backgroundOffsetY: -112,
    // Push 23: shift-specific terrain tile — warm ivory stone, gold veins.
    terrainTexture:    TERRAIN_DAY,
    terrainBase:       CH1_DAY_REVEALED,
    terrainCurrent:    CH1_DAY_CURRENT,
    terrainFrontier:   CH1_DAY_FRONTIER,
  },
  evening: {
    background:        CH1_EVE_BG,
    // Evening fountain sits at ≈ 47 % image width (not 50 %) so offsetX
    // is −46 (rather than −64) to keep the courtyard centre on the grid.
    backgroundScale:   1.60,
    backgroundOffsetX: -46,
    backgroundOffsetY: -112,
    // Push 23: shift-specific terrain tile — amber-lit stone, indigo shadows.
    terrainTexture:    TERRAIN_EVENING,
    terrainBase:       CH1_EVE_REVEALED,
    terrainCurrent:    CH1_EVE_CURRENT,
    terrainFrontier:   CH1_EVE_FRONTIER,
  },
  night: {
    // Night: map-platform-background.webp — deep navy/blue-black ward,
    // teal corridors, purple lanterns, gold compass mandala at centre.
    // Compass sits at exactly 50 % image width and height → offsetX = −64
    // centres it on the grid x-centre; offsetY = −112 satisfies top-tile
    // coverage and keeps the compass at grid y ≈ 64 (vs grid centre 71).
    // The cross-shaped corridor plan maps naturally to the hex-field shape:
    //   top staircase  → top-cap tiles (r = −3)
    //   right corridor → gate tile column (q = 3)
    //   left corridor  → start tile column (q = −1)
    background:        BG_NIGHT,
    backgroundScale:   1.60,
    backgroundOffsetX: -64,
    backgroundOffsetY: -112,
    // Push 23: TERRAIN_NIGHT = hex-terrain-normal.png — the Push 10 canonical
    // jade-teal cracked stone; already designed for the dark visual direction.
    terrainTexture:    TERRAIN_NIGHT,
    terrainBase:       TILE_BASE,
    terrainCurrent:    TILE_CURRENT,
    terrainFrontier:   TILE_FRONTIER,
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

/**
 * Night-shift visuals used ONLY for the developer `?debug=N` preview route,
 * where no real JourneyRun (and therefore no authoritative shift) exists.
 *
 * Never use this as a production fallback — callers must gate on a resolved
 * run shift and return `null` / show a loading shell instead.
 */
export const DEV_FALLBACK_VISUALS: ChapterShiftVisuals = DEFAULT_SHIFT_VISUALS.night;
