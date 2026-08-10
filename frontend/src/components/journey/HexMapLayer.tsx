/**
 * HexMapLayer — PUSH 5 camera / PUSH 9 axial rendering + content privacy
 *
 * Renders a bounded draggable hex map world inside a clipping viewport.
 * All tiles use AXIAL q,r coordinates (flat-top hexes).
 *
 * PUSH 13 — INTENTIONAL TIGHTER SPACING (visual terrain unification):
 *   The grid constants are deliberately set below the mathematical hex-touching
 *   values (Q_STEP=0.75, R_STEP=√3/2≈0.866, Q_VOFF=√3/4≈0.433).  The
 *   reduction creates controlled overlap at tile edges so adjacent hexes read
 *   as one contiguous terrain mass rather than isolated floating platforms.
 *
 *   Q_STEP = 0.72  (was 0.75)   — 4 % tighter in x; covers diagonal corner gaps
 *   R_STEP = 0.79  (was 0.866)  — 9 % tighter in y; solid hex bodies now overlap
 *   Q_VOFF = R_STEP/2 = 0.395  (was 0.433) — maintains correct stagger ratio
 *
 *   Touch targets remain sz×sz (WCAG 2.5.5 / iOS HIG minimum 44 px enforced).
 *   Tile coordinates are UNCHANGED — same q,r for all shifts.
 *
 *   Pixel positions (for reference):
 *   pixel_left = q × 0.72 × sz + ox
 *   pixel_top  = (r × 0.79 + q × 0.395) × sz + oy
 *
 * PUSH 15 — Visibility state rename + configurable REVEAL_RADIUS
 * ───────────────────────────────────────────────────────────────
 * • TileVisibility renamed: hidden→unexplored, frontier→visibleNow,
 *   revealed→exploredButOutOfVision.  REVEAL_RADIUS=1 exported from fogCalculator.
 *
 * PUSH 16 — Continuous background rendering (no per-tile terrain blocks)
 * ────────────────────────────────────────────────────────────────────────
 * • hex-revealed / hex-frontier terrain images are NO LONGER rendered per-tile.
 *   The chapter background image is the painted environment; hexes are a grid
 *   interaction layer placed on top — not a collection of floor tiles.
 * • exploredButOutOfVision → SVG memory veil (fill rgba(6,10,22,0.38), w=0.9 border)
 * • visibleNow             → SVG jade edge glow (stroke rgba(100,230,208,0.58), w=1.4)
 * • current                → tileVis.terrainCurrent (jade glow): position indicator
 *
 * PUSH 4 (fog) — Seamless atmospheric fog (no per-tile fog blocks)
 * ────────────────────────────────────────────────────────────────
 * • TILE_BASE.hidden and per-tile fog textures removed entirely.
 * • Fog is ONE world-space SVG above all tile Pressables (zIndex 5000).
 * • unexplored → large RadialGradient blob (2.8 × sz); adjacent blobs overlap
 *   into a seamless ink-blue fog mass.  Tile disabled Pressable at zIndex 1–3000.
 * • visibleNow → tile elevated to zIndex 5100+.  Jade edge glow; full brightness.
 * • current → tile at zIndex 9999 (always topmost).
 * Note: SVG <Mask> is NOT used — react-native-svg's web backend has no Mask class.
 *
 * PUSH 9 — Show treasure tier visually on the map
 * ────────────────────────────────────────────────
 * • Treasure is the ONLY encounter type shown on visibleNow (frontier) tiles.
 *   Seeing a gold chest one step away creates real routing decisions without
 *   spoiling anything — there is no hidden enemy composition to protect.
 *   All other encounter types (battle, merchant, areaBoss) remain invisible
 *   on frontier tiles per the existing privacy rule.
 * • encounterMapNode() gains the visibleNow-treasure exception; a11yLabel()
 *   mirrors it so screen-readers announce "Nearby — Treasure (gold)" etc.
 * • EncounterMapNode gains an optional shadowColor field.  Treasure returns
 *   a tier-specific glow pool so the chest tier reads at small map scales:
 *     gold   → rgba(220,170,0,0.55)   warm amber pool
 *     silver → rgba(90,140,255,0.45)  cool blue pool
 *     bronze → undefined (default dark SHADOW_COLOR — humble, no glow)
 * • Layer 2c reads node.shadowColor ?? SHADOW_COLOR.
 *
 * PUSH 8 — Standardised 2.5D depth sorting and grounding shadows
 * ────────────────────────────────────────────────────────────────
 * • Tile Pressable gains overflow:'visible' so sprites that overflow the sz×sz
 *   bounding box (area boss: −4 % above top; player: −36 %) are not clipped.
 *   Depth sorting still uses tileZ (r + q×0.5 formula) which already paints
 *   lower-screen tiles in front of higher-screen tiles — no change needed there.
 * • Contact shadow (Layer 2c): dark flat ink ellipse painted BEFORE each world
 *   object (SVG painters order — first = bottom).  rx = sizeMul × SHADOW_RX_MUL × sz;
 *   ry = SHADOW_RY_FRAC × sz (constant very-flat profile across all types).
 * • Player shadow: same dark ellipse added to Layer 4a SVG before the jade glow.
 *   The glow gradient (transparent at edges) lets the shadow show at the perimeter
 *   while the centre is covered by teal — grounded but still magical.
 * • SHADOW_COLOR: rgba(0,5,20,0.50) — ink-navy, fits Ink & Mist palette,
 *   less harsh than CSS #000 drop-shadow and does not fight the fog tones.
 *
 * PUSH 7 — 2.5D world-object props replace flat encounter medallions on the map
 * ──────────────────────────────────────────────────────────────────────────
 * • MAP_NODE record (map-nodes/) replaces ENCOUNTER_ICON (ui/journey/encounters/)
 *   as the on-map asset.  ENCOUNTER_ICON stays in use for legend/modal UI.
 * • encounterMapNode(tile) returns { src, sizeMul } so each encounter type
 *   can have a distinct footprint on the tile.
 * • Area boss: sizeMul 0.92 — dominates the hex (imposing creature).
 * • Merchant cart: sizeMul 0.75 — substantial world prop.
 * • Battle pedestal: sizeMul 0.68 — ominous stone marker.
 * • Chests: sizeMul 0.62 — chest scale on tile floor.
 * • All MAP_NODE assets are transparent-background PNGs placed with bottom
 *   of bounding box at ~88 % tile height (the 2.5D hex floor position).
 * • Ward event: renderer accepts the encounter type; dedicated 2.5D NPC/prop
 *   assets to be added in a future push — battle pedestal used as placeholder.
 *
 * PUSH 5 — Distinct visual treatment for exploredButOutOfVision tiles
 * ──────────────────────────────────────────────────────────────────
 * • exploredButOutOfVision tiles elevated to zIndex 5050 (between fog 5000 and
 *   visibleNow 5100+) so terrain is always visible above the fog mass.
 * • Memory veil (FOG_VEIL_FILL = rgba(6,10,22,0.38)): hex-polygon fill on the
 *   tile's own SVG overlay — terrain visible at ~62 % brightness, never bleeds
 *   outside the hex shape.
 * • Border brightened to rgba(255,255,255,0.32) — signals "visited area" vs
 *   the unmarked void of unexplored territory.
 * • Encounter markers (Layer 3) render ABOVE the veil — remain legible.
 * • No fog SVG element at explored tile positions — veil is entirely tile-side.
 *
 * PUSH 6 — 2.5D chibi player sprite on the current tile
 * ──────────────────────────────────────────────────────
 * • When the player has a class, their map sprite (assets/map-sprites/) replaces
 *   the generic jade medallion token on the current tile.
 * • Sprite is sized to overflow the tile (CHR_H_RATIO × sz tall) so the character
 *   stands prominently above the hex surface, with feet grounded at ~84% down.
 * • A jade/teal ambient glow ellipse (Layer 4a) is drawn between the tile's jade
 *   glow background (Layer 1a) and the sprite — creates a soft magical ground pool.
 *   The sprites themselves contain a built-in gray contact shadow, so the two
 *   layers work together: realistic grounding + magical map presence.
 * • Medallion token fallback is preserved unchanged for players with no class yet.
 * • Sprite key: MAP_SPRITE record in illustratedAssets.ts; resolved via
 *   getMapSprite(player.class_tree_id) in fog-map.tsx → passed as explorationCharacter.
 *
 * Privacy rules (Push 9 / 16)
 * ──────────────────────────
 * • unexplored and visibleNow tiles MUST NOT leak encounter type through:
 *   - Visual: encounter icons only on exploredButOutOfVision or current tiles.
 *   - Accessibility: labels say "unexplored" / "nearby" — never the encounter name.
 *   - DOM: data-encounter masked to "unknown" for non-exploredButOutOfVision tiles.
 *
 * Camera system
 * ─────────────
 * • PanResponder drives drag; onStart=false lets tile taps through.
 * • Camera re-centres on the `current` tile whenever the tile set changes
 *   (tracked by a `tilesKey` derived from tile-count + current tile id).
 * • boundsRef / initialCamRef / camRef are plain refs so PanResponder
 *   (created once) always reads the latest values without stale closures.
 */

import { Image } from 'expo-image';
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { type HexMapTile, JOURNEY_MAP_FIXTURE } from '@/src/game/journeyMap/fixture';
import { UI } from '@/src/theme/ui';

// ── Hex layout constants (flat-top axial, Push 13 tightened) ─────────────────
// Values are deliberately below the mathematical hex-touching thresholds so
// adjacent solid hex bodies overlap — eliminating the transparent-corner gap
// that makes each tile look like a separate floating platform.
// See the file header for full rationale.
const Q_STEP  = 0.72;   // horizontal advance per q unit  (std 0.75 → 0.72)
const R_STEP  = 0.79;   // vertical advance per r unit    (std 0.866 → 0.79)
const Q_VOFF  = 0.395;  // vertical bump per q unit       (= R_STEP / 2)

const MAX_TILE_SZ = 88;
/**
 * 44 px is the minimum touch-target size required by WCAG 2.5.5 and iOS HIG.
 * Setting this as the lower bound ensures every interactive tile meets the
 * accessibility touch-target rule regardless of container width.
 */
const MIN_TILE_SZ = 44;

// ── Hex grid overlay constants (Push 16 / 17) ────────────────────────────────
//
// The chapter environment is a SINGLE painted background behind all hexes.
// Hex tiles are a pure interaction/grid layer drawn as SVG polygon outlines.
// No terrain image is rendered for explored or visibleNow tiles.
//
// Rendering model per tile (Push 17 — SVG hex outlines):
//   current              → terrainCurrent jade glow image + bright SVG border ring
//   exploredButOutOfVision → SVG thin white hairline (barely-there cell boundary)
//   visibleNow           → SVG jade/teal edge glow + faint jade interior tint
//   unexplored           → TILE_BASE.hidden + fog overlay (full concealment)
//
// SVG stroke/fill values are defined inline (hexBorderStyle) near hexPoints().
// Polygon inset: R = sz/2 × HEX_INSET keeps the stroke from clipping at tile edge.

// ── Continuous atmospheric fog constants (Push 4 + Push 5) ───────────────────
//
// All fog is rendered as a SINGLE world-space SVG element (no per-tile images).
// Tile z-ordering governs the three visibility tiers:
//
//   unexplored              → large RadialGradient blob (FOG_BLOB_RADIUS × sz).
//                             Adjacent blobs overlap into a seamless continuous
//                             fog mass.  No hex-grid shapes visible in the fog.
//                             Tile Pressable at zIndex 1–3000 (below fog; disabled).
//
//   exploredButOutOfVision  → tile elevated to zIndex 5050 (above fog SVG at 5000,
//                             below visibleNow at 5100+).  Terrain is fully visible;
//                             a hex-shaped dark veil (FOG_VEIL_FILL) + slightly
//                             brightened hairline border conveys "remembered but
//                             not actively lit".  No fog SVG element at this tile.
//
//   visibleNow              → tile elevated to zIndex 5100+ (above fog SVG at 5000).
//                             Terrain renders on top of fog at full brightness with
//                             jade edge glow.  Adjacent tiles overlap (sz tiles,
//                             0.72×sz spacing) → seamless connected reveal cluster.
//
//   current                 → tile at zIndex 9999 (always topmost).
//
const FOG_BLOB_RADIUS = 2.80; // blob radius multiplier — 2.8×sz merges adjacents

// ── Push 10: per-shift SVG fog and overlay color themes ──────────────────────
//
// Three canonical shifts each carry a dedicated color theme that drives every
// SVG-rendered atmospheric element: fog blobs, memory veil, frontier edge glow,
// and the current-tile ring.  Raster backgrounds already switch via
// getChapterMapVisuals() in chapterMapVisuals.ts; these SVG colors complete the
// per-shift presentation without any CSS filter substitution.
//
// Resolution: HexMapLayer receives `timeOfDay` from fog-map.tsx (= run.shift,
// frozen at run creation).  The resolved `fogTheme` is passed into each HexTile.
//
// Color rationale per shift:
//   night   — deep ink-blue fog / navy veil / white hairlines / teal jade accents.
//             Exact values from Push 4–5; no change per Push 10 spec.
//   day     — pale blue-white cloud mist / warm cream veil / antique-gold hairlines.
//             Fog reads as natural daylight mist, not darkness.
//   evening — deep indigo-purple dusk fog / indigo veil / amber hairlines.
//             Lanterns beginning to matter: amber accents echo lit environment.

type FogTheme = {
  blobColor:      string;   // fog blob RadialGradient fill color
  blobOpacity:    number;   // peak center opacity (edges always fade to 0)
  /**
   * Push 11: flat-color fill for the base concealment Rect drawn at the START
   * of the fog SVG (before all gradient blobs).  This is the concealment floor:
   * even in areas where only one blob's semi-transparent edge covers the tile,
   * the background is still substantially obscured.  Explored tiles (zIndex 5050+)
   * sit above the fog SVG and are completely unaffected by this rect.
   */
  baseFill:       string;
  veilFill:       string;   // exploredButOutOfVision hex-polygon fill
  veilStroke:     string;   // exploredButOutOfVision hairline edge stroke
  veilStrokeW:    number;   // hairline width (px)
  frontierFill:   string;   // visibleNow interior tint fill
  frontierStroke: string;   // visibleNow edge glow stroke
  currentRing:    string;   // current-tile SVG ring stroke (Layer 1a)
};

const FOG_THEMES: Record<'day' | 'evening' | 'night', FogTheme> = {
  // ── Night — canonical dark environment; values preserved from Push 4–5 ─────
  night: {
    blobColor:      'rgb(6,10,22)',           // deep ink-blue atmospheric fog
    blobOpacity:    0.97,                     // dense solid mass; edges handled by baseFill
    baseFill:       'rgba(6,10,22,0.62)',     // floor: ensures no unexplored tile exposes background
    veilFill:       'rgba(6,10,22,0.38)',     // navy memory veil
    veilStroke:     'rgba(255,255,255,0.32)', // white hairline
    veilStrokeW:    0.9,
    frontierFill:   'rgba(80,220,196,0.12)',  // reachable-cell tint (Push 12: readable at small sz)
    frontierStroke: 'rgba(100,230,208,0.72)', // jade-teal edge glow (Push 12: boosted for legibility)
    currentRing:    'rgba(90,230,205,0.82)',  // bright jade ring
  },

  // ── Day — bright natural light, warm daylight, pale mist ────────────────────
  // Backgrounds: ivory/cream marble, sunlight through clouds, jade-teal pillars,
  // flowering greenery, open active environment.
  // Push 11: baseFill is critical here — pale blue-white mist over cream marble
  // reads as nearly transparent without the flat base layer.
  day: {
    blobColor:      'rgb(200,220,238)',        // pale blue-white daylight cloud-mist
    blobOpacity:    0.92,                      // boosted from 0.85; baseFill handles the floor
    baseFill:       'rgba(195,210,230,0.60)',  // solid pale mist floor — conceals marble detail
    veilFill:       'rgba(200,185,155,0.26)',  // warm cream/parchment memory veil
    veilStroke:     'rgba(140,110,55,0.40)',   // antique gold hairline (legible on bright stone)
    veilStrokeW:    1.0,
    frontierFill:   'rgba(60,190,155,0.14)',   // warm jade-teal interior tint (Push 12: boosted)
    frontierStroke: 'rgba(80,205,165,0.75)',   // warm jade edge glow (Push 12: boosted)
    currentRing:    'rgba(80,210,170,0.85)',   // jade ring, warm tone for daylight
  },

  // ── Evening — true twilight: amber lanterns, indigo sky, long shadows ───────
  // Backgrounds: dusky purple-mauve courtyard, amber lanterns lit, teal columns,
  // orange sunset sky, long diagonal shadows cutting across the atrium.
  evening: {
    blobColor:      'rgb(28,18,52)',           // deep indigo-purple dusk shadow
    blobOpacity:    0.95,                      // boosted from 0.91
    baseFill:       'rgba(28,18,52,0.58)',     // indigo floor — hides courtyard under dusk veil
    veilFill:       'rgba(28,18,52,0.30)',     // indigo memory veil (dimmer than night)
    veilStroke:     'rgba(200,155,70,0.44)',   // warm amber hairline — lantern glow hint
    veilStrokeW:    0.9,
    frontierFill:   'rgba(75,205,175,0.12)',   // reachable-cell tint (Push 12: boosted)
    frontierStroke: 'rgba(195,150,65,0.68)',   // amber edge — lanterns starting to define space (Push 12)
    currentRing:    'rgba(90,225,195,0.82)',   // jade ring (same family as night)
  },
};

// ── Push 6: 2.5D character sprite sizing ─────────────────────────────────────
//
// Sprites in assets/map-sprites/ are square PNGs with:
//   • Transparent background
//   • Built-in gray contact shadow ellipse at ~91% of image height
//   • Character body occupying the full image height
//
// Sizing goal: the sprite's built-in shadow should land at ~84% down the tile
// (visual floor of the 2.5D hex), with the body rising 36% above the tile top.
//
// Math (shadow at 91% of charH):
//   CHR_Y_SHIFT + CHR_H_RATIO × sz × 0.91 ≈ 0.84 × sz
//   → CHR_Y_SHIFT = (0.84 − 1.32 × 0.91) × sz = (0.84 − 1.201) × sz ≈ −0.36 × sz  ✓
//
// The jade glow ellipse (Layer 4a) is drawn at the same floor position and
// slightly wider than the built-in shadow to give a magical ambient halo.
const CHR_W_RATIO          = 1.00;   // sprite width = full tile sz
const CHR_H_RATIO          = 1.32;   // sprite height overflows tile (2.5D scale)
const CHR_Y_SHIFT          = 0.36;   // upward shift from tile top (fraction of sz)
const CHR_GLOW_CY          = 0.83;   // jade glow ellipse centre Y (fraction of sz)
const CHR_GLOW_RX          = 0.33;   // jade glow horizontal radius (fraction of sz)
const CHR_GLOW_RY          = 0.11;   // jade glow vertical radius (flattened ellipse)
const CHR_GLOW_COLOR       = 'rgba(60,220,180,1)'; // jade/teal to match tile ring glow
const CHR_GLOW_OPACITY     = 0.55;   // peak centre opacity of jade glow pool

// ── Push 8: map-object grounding shadows ─────────────────────────────────────
//
// Flat ellipses drawn BELOW each world object (SVG painters order — first = bottom)
// so props feel planted on the hex surface rather than floating.
//
//   SHADOW_COLOR      — ink-navy (not flat black); fits Ink & Mist palette
//   SHADOW_RY_FRAC    — constant very-flat ry = 0.055 × sz for all object types
//   SHADOW_RX_MUL     — encounter-node rx = sizeMul × SHADOW_RX_MUL × sz
//                       slightly less than the prop footprint (shadow fits under base)
//
// Player shadow uses fixed fractions rather than sizeMul because the sprite is
// positioned with CHR_Y_SHIFT rather than the 88 %-floor rule.
const SHADOW_COLOR     = 'rgba(0,5,20,0.62)';   // Ink & Mist dark navy — Push 12: richer grounding
const SHADOW_RY_FRAC   = 0.068;                  // Push 12: slightly taller profile for clearer contact
const SHADOW_RX_MUL    = 0.48;                   // node shadow rx = sizeMul × this × sz
const CHR_SHADOW_CY    = CHR_GLOW_CY;            // same floor as jade glow (0.83 × sz)
const CHR_SHADOW_RX    = CHR_GLOW_RX + 0.06;     // wider than glow (0.39 × sz)
const CHR_SHADOW_RY    = 0.072;                  // slightly taller than node shadow

// ── Raster assets ─────────────────────────────────────────────────────────────
// Push 4: fog is a world-space SVG layer; terrainCurrent (jade glow) still used.
// Push 7: MAP_NODE (world-object PNGs) replaces ENCOUNTER_ICON on the map surface.
//         ENCOUNTER_ICON is retained for legend panels and MerchantModal UI.

// Player token rendered on top of the current tile (Push 6 fallback).
const PLAYER_TOKEN = require('@/assets/ui/journey/map/player-map-token.webp') as number;

/**
 * Circular-medallion UI icons — LEGEND PANELS / MODAL HEADERS ONLY (not map).
 * Push 7: the map now renders MAP_NODE world objects instead of these.
 */
const ENCOUNTER_ICON = {
  battle:         require('@/assets/ui/journey/encounters/battle.webp')          as number,
  treasureBronze: require('@/assets/ui/journey/encounters/treasure-bronze.webp') as number,
  treasureSilver: require('@/assets/ui/journey/encounters/treasure-silver.webp') as number,
  treasureGold:   require('@/assets/ui/journey/encounters/treasure-gold.webp')   as number,
  merchant:       require('@/assets/ui/journey/encounters/merchant.webp')        as number,
  areaBoss:       require('@/assets/ui/journey/encounters/area-boss.webp')       as number,
};

/**
 * Push 7: 2.5D world-object PNGs for the map surface.
 * All are transparent-background PNGs at native 1024×1024 resolution.
 * Gold chest reuses node_reward_medical_chest.png — the ideal gold tier art.
 */
const MAP_NODE = {
  battle:         require('@/assets/map-nodes/encounter_battle.png')             as number,
  merchant:       require('@/assets/map-nodes/encounter_merchant.png')           as number,
  areaBoss:       require('@/assets/map-nodes/encounter_area_boss.png')          as number,
  treasureBronze: require('@/assets/map-nodes/encounter_chest_bronze.png')       as number,
  treasureSilver: require('@/assets/map-nodes/encounter_chest_silver.png')       as number,
  treasureGold:   require('@/assets/map-nodes/node_reward_medical_chest.png')    as number,
};

// ── Resolved tile visual sources ─────────────────────────────────────────────

/**
 * Effective tile-art sources passed from HexMapLayer down to HexTile.
 * Push 4: only terrainCurrent remains — fog is now a world-space SVG layer,
 * not a per-tile texture.  fogInterior is no longer rendered by the renderer
 * (kept in ChapterShiftVisuals for theming reference / future use).
 */
type ResolvedTileVis = {
  terrainCurrent: number;  // hex-current (jade glow for the player's position)
};

/**
 * Push 7: source + tile-footprint for one world-object prop.
 * Push 9: shadowColor — tier-specific glow pool for treasure chests.
 *         Omit to use the default dark SHADOW_COLOR.
 */
type EncounterMapNode = { src: number; sizeMul: number; shadowColor?: string };

/**
 * Returns the 2.5D world-object asset and tile footprint for revealed tiles.
 *
 * Privacy rule: encounter type must not be inferrable until explored.
 *   unexplored → always null
 *   visibleNow → null EXCEPT treasure (Push 9 exception — see below)
 *   exploredButOutOfVision / current → all encounter types shown
 *
 * Push 9 — treasure visibleNow exception:
 *   Treasure chests are the one encounter type shown on frontier tiles.
 *   Knowing the tier BEFORE stepping there lets players decide whether
 *   a gold chest is worth a detour.  There is no hidden composition to
 *   protect (unlike battles), so early disclosure is purely strategic.
 *   All other encounter types remain hidden until the tile is explored.
 *
 * sizeMul drives the bounding-box size as a fraction of the tile sz.
 * Positioning: bottom of box anchored at ~88 % tile height (hex floor).
 *
 *   areaBoss    0.92 — large creature dominates the hex
 *   merchant    0.75 — notable world prop
 *   battle      0.68 — stone pedestal encounter marker
 *   treasure    0.62 — chest scale, grounded on floor
 */
function encounterMapNode(tile: HexMapTile): EncounterMapNode | null {
  const vis = tile.visibility;

  // Treasure is shown on frontier tiles (Push 9 exception).
  // All other encounters require exploredButOutOfVision or current.
  const isTreasureFrontier =
    tile.encounter === 'treasure' && vis === 'visibleNow';

  if (!tile.current && vis !== 'exploredButOutOfVision' && !isTreasureFrontier) {
    return null;
  }

  switch (tile.encounter) {
    case 'battle':   return { src: MAP_NODE.battle,   sizeMul: 0.68 };
    case 'merchant': return { src: MAP_NODE.merchant, sizeMul: 0.75 };
    case 'areaBoss': return { src: MAP_NODE.areaBoss, sizeMul: 0.86 }; // Push 12: reduced from 0.92 — still dominates without clutter
    case 'treasure': {
      const tier = tile.chestTier ?? 'bronze';
      return {
        src: tier === 'gold'   ? MAP_NODE.treasureGold
           : tier === 'silver' ? MAP_NODE.treasureSilver
           : MAP_NODE.treasureBronze,
        sizeMul: 0.66, // Push 12: raised from 0.62 — chests need more presence to read clearly
        // Tier-specific glow pool so the chest tier reads at small map sizes.
        // Bronze gets no override — the default dark shadow suits its humble look.
        shadowColor:
          tier === 'gold'   ? 'rgba(220,170,0,0.55)'  // warm amber pool
        : tier === 'silver' ? 'rgba(90,140,255,0.45)' // cool blue pool
        : undefined,
      };
    }
    // wardEvent: renderer-ready; placeholder until dedicated NPC/prop art ships.
    default: return null;
  }
}

/** @deprecated Map surface now uses encounterMapNode. Legacy icon for legend/modal UI. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ENCOUNTER_ICON_REF = ENCOUNTER_ICON;

/**
 * Privacy-safe accessibility label:
 *   hidden   → "Unexplored tile" (no encounter hint)
 *   frontier → "Nearby tile, not yet explored"
 *   revealed / current → descriptive label including encounter type
 */
function a11yLabel(tile: HexMapTile): string {
  if (tile.current) return 'Current position';
  if (tile.isGate && tile.visibility === 'exploredButOutOfVision') return 'Chapter Boss Gate';
  if (tile.visibility === 'unexplored') return 'Unexplored tile';
  if (tile.visibility === 'visibleNow') {
    // Push 9: treasure is the one encounter type disclosed on frontier tiles.
    if (tile.encounter === 'treasure') {
      const tier = tile.chestTier ? ` (${tile.chestTier})` : '';
      return `Nearby tile — Treasure${tier}`;
    }
    return 'Nearby tile, not yet explored';
  }
  if (tile.encounter !== 'none') {
    const enc = tile.encounter === 'areaBoss' ? 'Area Boss'
              : tile.encounter === 'treasure' ? `Treasure (${tile.chestTier ?? ''})`
              : tile.encounter.charAt(0).toUpperCase() + tile.encounter.slice(1);
    return `Tile — ${enc}`;
  }
  return tile.isGate ? 'Gate tile' : 'Explored tile — no encounter';
}

/** Passes data-* attributes to DOM on web; no-op on native. */
const webData = (o: Record<string, string>) => o as unknown as object;

// ── Geometry ──────────────────────────────────────────────────────────────────

/** Top-left pixel position for a tile in axial q,r coordinates. */
function tilePos(q: number, r: number, sz: number, ox: number, oy: number) {
  return {
    left: Math.round(q * Q_STEP * sz) + ox,
    top:  Math.round((r * R_STEP + q * Q_VOFF) * sz) + oy,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ── SVG hex polygon geometry ──────────────────────────────────────────────────
/**
 * Returns a flat-top hex polygon's SVG `points` string for a tile of side `sz`.
 *
 * Flat-top orientation: pointy vertices are on the LEFT and RIGHT edges.
 * The polygon is inscribed in the sz × sz bounding box with a slight inset
 * (controlled by `inset`, default 0.89) so the SVG stroke never clips.
 *
 * Corner order (clockwise from right):
 *   right → bottom-right → bottom-left → left → top-left → top-right
 */
/**
 * Generate a stable, SVG-safe gradient id for a tile at (q, r).
 * Handles negative coordinates by prefixing with 'n' (e.g. -1 → n1).
 * Prefix distinguishes fog blobs ('fog') from memory hazes ('haze').
 */
function fogGradId(prefix: string, q: number, r: number): string {
  const qs = q >= 0 ? `${q}` : `n${-q}`;
  const rs = r >= 0 ? `${r}` : `n${-r}`;
  return `${prefix}_${qs}_${rs}`;
}

function hexPoints(sz: number, inset = 0.89): string {
  const cx = sz / 2;
  const cy = sz / 2;
  const R  = (sz / 2) * inset;   // horizontal radius
  const r  = R * 0.866;           // vertical radius  (√3/2 ≈ 0.866)
  return [
    [cx + R,     cy    ],          // right
    [cx + R / 2, cy + r],          // bottom-right
    [cx - R / 2, cy + r],          // bottom-left
    [cx - R,     cy    ],          // left
    [cx - R / 2, cy - r],          // top-left
    [cx + R / 2, cy - r],          // top-right
  ].map(([x, y]) => `${(x as number).toFixed(1)},${(y as number).toFixed(1)}`).join(' ');
}

// ── HexTile ───────────────────────────────────────────────────────────────────

interface HexTileProps {
  tile: HexMapTile;
  sz:   number;
  ox:   number;
  oy:   number;
  onPress: (tile: HexMapTile) => void;
  /**
   * When set and this tile is current: renders the exploration character
   * in place of the medallion token.  When absent: medallion is preserved.
   */
  explorationCharacter?: number;
  /** Resolved terrain + fog asset sources for the active chapter/shift. */
  tileVis: ResolvedTileVis;
  /**
   * Push 10: per-shift SVG color theme — drives fog veil, frontier glow,
   * and current-tile ring colors.  Resolved by HexMapLayer from the active
   * `timeOfDay` and passed into every tile so individual tiles never inspect
   * shift state themselves.
   */
  fogTheme: FogTheme;
}

function HexTile({ tile, sz, ox, oy, onPress, explorationCharacter, tileVis, fogTheme }: HexTileProps) {
  const pos  = tilePos(tile.q, tile.r, sz, ox, oy);
  // Push 7: world-object node replaces flat encounter icon on the map.
  // node.sizeMul controls footprint; bottom of bounding box sits at ~88 % tile height.
  const node = encounterMapNode(tile);

  // Privacy: mask encounter type in DOM attributes for non-revealed tiles.
  const isRevealed = tile.current || tile.visibility === 'exploredButOutOfVision';

  // unexplored tiles are not interactive — players cannot select unseen territory.
  const isHidden   = !tile.current && tile.visibility === 'unexplored';
  const isVisible  = !tile.current && tile.visibility === 'visibleNow';
  const isExplored = !tile.current && tile.visibility === 'exploredButOutOfVision';

  // Player token sits on top of the current tile.
  const tokenSz = Math.round(sz * 0.62);
  const tokenX  = Math.round((sz - tokenSz) / 2);
  const tokenY  = Math.round((sz - tokenSz) / 2) - Math.round(sz * 0.08);

  // Iso-depth zIndex: tiles further down the screen paint above tiles further up.
  // Three distinct strata above / below the fog SVG (zIndex 5000):
  //   9999        current tile — always topmost
  //   5100–5200   visibleNow   — above fog, full brightness + jade glow
  //   5050–5075   exploredButOutOfVision — above fog, terrain visible through veil
  //   1–3000      unexplored   — below fog, disabled Pressable only
  const tileZ = tile.current
    ? 9999
    : tile.visibility === 'visibleNow'
      ? 5100 + Math.round((tile.r + tile.q * 0.5) * 10)
      : tile.visibility === 'exploredButOutOfVision'
        ? 5050 + Math.round((tile.r + tile.q * 0.5) * 5)
        : Math.round((tile.r + tile.q * 0.5) * 100) + 1;

  return (
    <Pressable
      style={[s.tile, { left: pos.left, top: pos.top, width: sz, height: sz, zIndex: tileZ }]}
      testID={tile.id}
      onPress={() => onPress(tile)}
      disabled={isHidden}
      accessibilityRole={isHidden ? 'none' : 'button'}
      accessibilityLabel={a11yLabel(tile)}
      {...webData({
        'data-tile-id':    tile.id,
        'data-q':          String(tile.q),
        'data-r':          String(tile.r),
        'data-visibility': tile.current ? 'current' : tile.visibility,
        'data-encounter':  isRevealed ? tile.encounter : 'unknown',
      })}
    >
      {/* ── Layer 1a: current tile — jade glow image + bright SVG border ring ─ */}
      {/* Jade glow image provides the "magical ground illumination" beneath     */}
      {/* the player.  The SVG polygon ring on top sharpens the hex edge so it  */}
      {/* reads strongly as "you are here" without a filled-floor look.          */}
      {tile.current && (
        <Image
          source={tileVis.terrainCurrent}
          style={{ width: sz, height: sz }}
          contentFit="contain"
          recyclingKey={`cur-${tile.id}`}
        />
      )}
      {tile.current && (
        <View style={[s.overlay, { pointerEvents: 'none' }]}>
          {/* Push 12: two-ring "you are here" — outer atmospheric halo + inner
            * sharp position indicator.  The inner ring reads crisply even when
            * the character sprite or world objects occupy the tile centre.       */}
          <Svg width={sz} height={sz}>
            {/* Outer soft halo — widens the "inhabited" feel beyond the sprite */}
            <Polygon
              points={hexPoints(sz, 0.97)}
              fill="transparent"
              stroke={fogTheme.currentRing}
              strokeWidth={1.2}
              strokeOpacity={0.45}
            />
            {/* Inner sharp ring — unambiguous position indicator */}
            <Polygon
              points={hexPoints(sz, 0.82)}
              fill="transparent"
              stroke={fogTheme.currentRing}
              strokeWidth={2.6}
              strokeOpacity={0.88}
            />
          </Svg>
        </View>
      )}

      {/* ── Layer 1b: unexplored tile — no per-tile images (Push 4) ────────── */}
      {/* Fog is now a world-space SVG layer above all tile Pressables.        */}
      {/* TILE_BASE.hidden and fogInterior textures are removed here.           */}
      {/* The tile Pressable itself stays (disabled=true → non-interactive).   */}

      {/* ── Layer 2a: visibleNow — triple-element movement cell (Push 12) ─────
        * Three SVG elements in one pass create a clear "reachable" reading
        * without heavy UI chrome:
        *   1. Interior tint   (inset 0.84) — reinforces cell area in range
        *   2. Outer glow ring (inset 0.96) — primary movement indicator
        *   3. Inner accent    (inset 0.78) — depth; registers as a distinct
        *                                     marker at small tile sizes
        * Push 10: all colours from fogTheme — Day warm jade, Evening amber,
        *          Night cold teal.                                              */}
      {isVisible && (
        <View style={[s.overlay, { pointerEvents: 'none' }]}>
          <Svg width={sz} height={sz}>
            {/* 1. Interior cell tint — faint area fill */}
            <Polygon
              points={hexPoints(sz, 0.84)}
              fill={fogTheme.frontierFill}
              stroke="none"
            />
            {/* 2. Outer glow ring — clear movement-cell boundary */}
            <Polygon
              points={hexPoints(sz, 0.96)}
              fill="transparent"
              stroke={fogTheme.frontierStroke}
              strokeWidth={1.8}
            />
            {/* 3. Inner accent ring — adds tactical-map depth */}
            <Polygon
              points={hexPoints(sz, 0.78)}
              fill="transparent"
              stroke={fogTheme.frontierStroke}
              strokeWidth={0.8}
              strokeOpacity={0.40}
            />
          </Svg>
        </View>
      )}

      {/* ── Layer 2b: exploredButOutOfVision — split veil (Push 12) ────────────
        * Push 5: single filled polygon at inset=1.0 — clearly hex-shaped but
        *   creates "hex card grid" look; adjacent veils double-darken at edges.
        * Push 12: two separate polygons replace it:
        *   Inner body   (inset 0.82) — dimming fill, inset so the painted
        *                               background bleeds through an ~18% margin
        *                               at each tile edge.  Adjacent bodies no
        *                               longer meet → contiguous environment feel.
        *   Outer hairline (inset 0.96) — thin "visited territory" signal at the
        *                               true hex boundary; separated from the fill
        *                               so it reads as an architectural line, not
        *                               a filled card border.
        * Push 10: veilFill / veilStroke / veilStrokeW from fogTheme.
        * Encounter markers (Layer 3) render above both shapes and stay legible. */}
      {isExplored && (
        <View style={[s.overlay, { pointerEvents: 'none' }]}>
          <Svg width={sz} height={sz}>
            {/* Inner veil body — inset so background terrain bleeds at tile edges */}
            <Polygon
              points={hexPoints(sz, 0.82)}
              fill={fogTheme.veilFill}
              stroke="none"
            />
            {/* Outer hairline — visited-territory boundary marker */}
            <Polygon
              points={hexPoints(sz, 0.96)}
              fill="transparent"
              stroke={fogTheme.veilStroke}
              strokeWidth={fogTheme.veilStrokeW}
            />
          </Svg>
        </View>
      )}

      {/* ── Layer 2c: encounter node contact shadow ──────────────────────── */}
      {/* Push 8: flat ink-navy ellipse at the hex floor (88 % tile height). */}
      {/* Drawn BEFORE Layer 3 (SVG painters order) so it sits underneath.  */}
      {/* rx = sizeMul × SHADOW_RX_MUL so shadow footprint matches the prop.*/}
      {node !== null && (
        <View style={[s.overlay, { pointerEvents: 'none' }]}>
          <Svg width={sz} height={sz}>
            <Ellipse
              cx={sz / 2}
              cy={sz * 0.88}
              rx={sz * node.sizeMul * SHADOW_RX_MUL}
              ry={sz * SHADOW_RY_FRAC}
              fill={node.shadowColor ?? SHADOW_COLOR}
            />
          </Svg>
        </View>
      )}

      {/* ── Layer 3: encounter world object (exploredButOutOfVision + current) ─ */}
      {/* Push 7: 2.5D world-object props replace flat UI medallions on the map. */}
      {/* Each encounter type has a distinct sizeMul; all are bottom-anchored at  */}
      {/* ~88 % tile height so props sit on the hex floor in 2.5D perspective.   */}
      {/* Area boss uses the full sizeMul to dominate the tile visually.          */}
      {node !== null && (() => {
        const nodeSz = Math.round(sz * node.sizeMul);
        const nodeX  = Math.round((sz - nodeSz) / 2);
        // Bottom of bounding box anchored at 88 % tile height (the hex floor).
        const nodeY  = Math.round(sz * 0.88 - nodeSz);
        return (
          <Image
            source={node.src}
            style={[s.marker, { left: nodeX, top: nodeY, width: nodeSz, height: nodeSz }]}
            contentFit="contain"
            recyclingKey={`node-${tile.id}`}
          />
        );
      })()}

      {/* ── Layer 4a: jade ambient ground pool — sprite variant only ─────── */}
      {/* Rendered BELOW the character sprite (above the jade glow background) */}
      {/* so the character appears to stand in a pool of magical teal light.   */}
      {/* The sprites carry their own built-in gray contact shadow in the art;  */}
      {/* this layer adds the ambient "inhabiting-the-world" magical presence.  */}
      {/* Only shown when an explorationCharacter sprite is active (not token). */}
      {tile.current && explorationCharacter != null && (
        <View style={[s.overlay, { pointerEvents: 'none' }]}>
          <Svg width={sz} height={sz}>
            <Defs>
              <RadialGradient
                id="chr-gnd"
                cx={sz / 2}    cy={sz * CHR_GLOW_CY}
                r={sz * CHR_GLOW_RX}
                fx={sz / 2}   fy={sz * CHR_GLOW_CY}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0%"   stopColor={CHR_GLOW_COLOR} stopOpacity={CHR_GLOW_OPACITY} />
                <Stop offset="55%"  stopColor={CHR_GLOW_COLOR} stopOpacity={CHR_GLOW_OPACITY * 0.30} />
                <Stop offset="100%" stopColor={CHR_GLOW_COLOR} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {/* Push 8: dark contact shadow — painted first (painters order)   */}
            {/* so jade glow renders on top.  Shadow edges show at the perimeter */}
            {/* where the glow gradient fades to transparent — grounded but     */}
            {/* still magical.                                                   */}
            <Ellipse
              cx={sz / 2}
              cy={sz * CHR_SHADOW_CY}
              rx={sz * CHR_SHADOW_RX}
              ry={sz * CHR_SHADOW_RY}
              fill={SHADOW_COLOR}
            />
            {/* Jade ambient glow — renders above shadow, obscures centre */}
            <Ellipse
              cx={sz / 2}
              cy={sz * CHR_GLOW_CY}
              rx={sz * CHR_GLOW_RX}
              ry={sz * CHR_GLOW_RY}
              fill="url(#chr-gnd)"
            />
          </Svg>
        </View>
      )}

      {/* ── Layer 4b: player sprite / token — current tile only ───────────── */}
      {/* Push 6: sprite is sized at CHR_H_RATIO × sz so the character stands  */}
      {/* taller than the tile (2.5D camera angle).  The sprite's built-in     */}
      {/* shadow lands at ~84 % down the tile — the visual "floor".            */}
      {/* Fallback: jade medallion token when player has no class_tree_id.     */}
      {tile.current && (() => {
        if (explorationCharacter != null) {
          const charW = Math.round(sz * CHR_W_RATIO);
          const charH = Math.round(sz * CHR_H_RATIO);
          const charX = Math.round((sz - charW) / 2);
          const charY = -Math.round(sz * CHR_Y_SHIFT);
          return (
            <Image
              source={explorationCharacter}
              style={[s.marker, { left: charX, top: charY, width: charW, height: charH }]}
              contentFit="contain"
              recyclingKey={`chr-${tile.id}`}
            />
          );
        }
        // No class yet — preserve the jade medallion token unchanged.
        return (
          <Image
            source={PLAYER_TOKEN}
            style={[s.marker, { left: tokenX, top: tokenY, width: tokenSz, height: tokenSz }]}
            contentFit="contain"
            recyclingKey={`tok-${tile.id}`}
          />
        );
      })()}
    </Pressable>
  );
}

// ── RecenterButton ────────────────────────────────────────────────────────────

function RecenterButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={s.recenterBtn}
      onPress={onPress}
      testID="recenter-btn"
      accessibilityLabel="Centre map on current position"
      accessibilityRole="button"
      // C2: hitSlop extends the effective touch area to 44 × 44 px (WCAG 2.5.5)
      // while the visual circle stays at its painted 38 × 38 px size.
      hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
    >
      <Text style={s.recenterIcon} aria-hidden>◎</Text>
    </Pressable>
  );
}

// ── HexMapLayer ───────────────────────────────────────────────────────────────

/**
 * Gate artwork rendered as a spatial overlay anchored to the gate tile.
 * pointerEvents="none" lets taps fall through to the underlying tile Pressable,
 * so gate interaction remains associated with the gateTileId.
 */
export interface GateArtProps {
  /** Source for the locked state (< 3 keys). */
  lockedSrc:   number;
  /** Source for the unlocked state (≥ 3 keys). */
  unlockedSrc: number;
  /** Whether the key requirement has been met. */
  unlocked:    boolean;
}

export interface HexMapLayerProps {
  containerWidth:  number;
  containerHeight: number;
  /** Tile set to render (axial q,r coords). Defaults to the static Push-4 fixture. */
  tiles?: readonly HexMapTile[];
  /**
   * Called when a non-hidden tile is tapped (after the drag threshold is
   * filtered out).  Hidden tiles are `disabled` and never fire this.
   */
  onTilePress?: (tile: HexMapTile) => void;
  /**
   * Shift-aware tile visual overrides from the chapter map visuals registry.
   * Pass the result of `getChapterMapVisuals(chapter, timeOfDay)` here.
   * When absent, the renderer uses its module-level default assets (night theme).
   * Only the subset consumed by tile rendering is used here; the `background`
   * and `fogEdge` fields from ChapterShiftVisuals are consumed by the parent screen.
   */
  /**
   * Only `terrainCurrent` and `fogInterior` are consumed by the renderer.
   * (terrainBase / terrainFrontier stay in ChapterShiftVisuals for future use
   * but are NOT rendered per-tile — the background painting is the floor.)
   */
  tileVisuals?: Pick<import('@/src/game/journeyMap/chapterMapVisuals').ChapterShiftVisuals,
    'terrainCurrent' | 'fogInterior'>;

  /**
   * Push 10: active shift — drives the SVG fog/veil/frontier/ring color theme.
   * Pass `run.shift` (frozen at run creation).  When absent (fixture / debug
   * mode) the renderer defaults to 'night' so the dark aesthetic is preserved.
   */
  timeOfDay?: 'day' | 'evening' | 'night';

  /**
   * Optional gate artwork anchored spatially to the `isGate` tile.
   * When provided and the gate tile is visible (frontier or revealed),
   * a gate image is rendered inside the world viewport centred on the gate tile.
   * The overlay is non-interactive — taps fall through to the tile Pressable.
   *
   * Gate art participates in the existing fog rules:
   *   hidden   → not rendered (gate is undiscovered)
   *   frontier → rendered (gate is nearby)
   *   revealed → rendered (gate is in view)
   */
  gateArt?: GateArtProps;

  /**
   * Raster asset for the player's active exploration character (chibi/pawn
   * map sprite keyed by the player's class_tree_id).
   *
   * When provided: replaces the medallion player token on the current tile
   * with the character sprite, centred on the hex and sized to overlap the
   * tile naturally. The jade glow (hex-current.webp base) and tile selection
   * state are preserved — only the token image changes.
   *
   * When absent (player has no resolved class yet): the existing medallion
   * marker is preserved unchanged. Do NOT substitute a generic icon.
   */
  explorationCharacter?: number;
}

export function HexMapLayer({
  containerWidth,
  containerHeight,
  tiles = JOURNEY_MAP_FIXTURE,
  onTilePress,
  tileVisuals,
  timeOfDay,
  gateArt,
  explorationCharacter,
}: HexMapLayerProps) {
  // ── Resolved tile art (prop override merged with night-theme default) ───
  // Push 4: only terrainCurrent is needed.  Fog is now a world-space SVG
  // (see continuous atmospheric fog constants); no per-tile fog texture.
  const resolvedTileVis: ResolvedTileVis = {
    terrainCurrent: tileVisuals?.terrainCurrent ?? require('@/assets/ui/journey/tiles/hex-current.webp') as number,
  };

  // ── Push 10: resolved shift fog/overlay theme ─────────────────────────────
  // Drives all SVG atmospheric colors: fog blobs, memory veil, frontier glow,
  // current-tile ring.  Defaults to 'night' when no shift is provided (fixture
  // mode / debug route) so the existing dark aesthetic is preserved as fallback.
  const fogTheme = FOG_THEMES[timeOfDay ?? 'night'];

  // ── Geometry (recomputed on every render; cheap enough to not useMemo) ─────
  const maxQ = tiles.reduce((m, t) => Math.max(m, t.q), 0);
  const maxR = tiles.reduce((m, t) => Math.max(m, t.r), 0);
  const wFactor = maxQ * Q_STEP + 1;

  const sz = tiles.length === 0 ? 60 : Math.min(
    MAX_TILE_SZ,
    Math.max(MIN_TILE_SZ, Math.floor(containerWidth / wFactor)),
  );
  const ox = Math.floor((containerWidth - wFactor * sz) / 2);
  const oy = 10;

  // World bounding box in pixels (for camera bounds).
  const maxPxRight  = tiles.reduce((m, t) => Math.max(m, t.q * Q_STEP), 0);
  const maxPxBottom = tiles.reduce((m, t) => Math.max(m, t.r * R_STEP + t.q * Q_VOFF), 0);
  const worldW = Math.round(maxPxRight * sz) + sz + Math.max(ox, 0) * 2;
  const worldH = Math.round(maxPxBottom * sz) + sz + oy + 10;

  // ── Persistent refs ────────────────────────────────────────────────────────
  const boundsRef     = useRef({ minX: -9999, maxX: 9999, minY: -9999, maxY: 9999 });
  const initialCamRef = useRef({ x: 0, y: 0 });
  const camRef        = useRef({ x: 0, y: 0 });
  const drag          = useRef({ moved: false, camX0: 0, camY0: 0 });
  const tilesKeyRef   = useRef('');
  /**
   * Tracks the container dimensions used for the last re-centre so that an
   * orientation change (which only mutates containerWidth / containerHeight,
   * not the tile set) also triggers a fresh re-centre.
   */
  const prevContainerRef = useRef({ w: 0, h: 0 });

  // ── Camera animation ───────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cameraAnim = useMemo(() => new Animated.ValueXY({ x: 0, y: 0 }), []);

  // Stable string that changes when the tile set changes (new run loaded).
  const currentTile = tiles.find(t => t.current);
  const tilesKey = `${tiles.length}:${currentTile?.id ?? ''}`;

  // ── Recompute bounds + (re-)centre camera when container or tiles change ───
  useLayoutEffect(() => {
    if (containerWidth < 10 || containerHeight < 10) return;

    const MARGIN = Math.round(sz * 0.55);
    const newBounds = {
      minX: Math.min(-MARGIN, containerWidth  - worldW - MARGIN),
      maxX: Math.max(0,        MARGIN),
      minY: Math.min(-MARGIN, containerHeight - worldH - MARGIN),
      maxY: Math.max(0,        MARGIN),
    };
    boundsRef.current = newBounds;

    // Re-centre when:
    //   (a) the tile set changes — new run loaded or debug-mode toggle; OR
    //   (b) the container dimensions changed — device rotation / window resize.
    // Without (b), an orientation flip updates bounds but leaves the camera at
    // coordinates computed for the old viewport size.
    const tilesChanged     = tilesKey !== tilesKeyRef.current;
    const containerChanged =
      containerWidth  !== prevContainerRef.current.w ||
      containerHeight !== prevContainerRef.current.h;

    if (tilesChanged || containerChanged) {
      if (tilesChanged) tilesKeyRef.current = tilesKey;
      prevContainerRef.current = { w: containerWidth, h: containerHeight };

      const playerTile = currentTile ?? tiles[0];
      if (playerTile) {
        const tileCx =
          Math.round(playerTile.q * Q_STEP * sz) + ox + sz / 2;
        const tileCy =
          Math.round((playerTile.r * R_STEP + playerTile.q * Q_VOFF) * sz) + oy + sz / 2;

        const rawX  = containerWidth  / 2 - tileCx;
        const rawY  = containerHeight / 2 - tileCy;
        const initX = clamp(rawX, newBounds.minX, newBounds.maxX);
        const initY = clamp(rawY, newBounds.minY, newBounds.maxY);

        initialCamRef.current = { x: initX, y: initY };
        camRef.current        = { x: initX, y: initY };
        cameraAnim.setValue({ x: initX, y: initY });
      }
    }
  // sz changes when containerWidth changes; tilesKey drives re-centre on new run.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerWidth, containerHeight, sz, tilesKey]);

  // ── PanResponder (created once; reads refs at call-time) ──────────────────
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder:        () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,
        onMoveShouldSetPanResponderCapture: () => false,

        onPanResponderGrant: () => {
          drag.current.moved  = false;
          drag.current.camX0  = camRef.current.x;
          drag.current.camY0  = camRef.current.y;
        },
        onPanResponderMove: (_, gs) => {
          if (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5) drag.current.moved = true;
          const { minX, maxX, minY, maxY } = boundsRef.current;
          const newX = clamp(drag.current.camX0 + gs.dx, minX, maxX);
          const newY = clamp(drag.current.camY0 + gs.dy, minY, maxY);
          camRef.current = { x: newX, y: newY };
          cameraAnim.setValue({ x: newX, y: newY });
        },
        onPanResponderRelease:   () => { drag.current.moved = false; },
        onPanResponderTerminate: () => { drag.current.moved = false; },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Recenter ───────────────────────────────────────────────────────────────
  const recenter = useCallback(() => {
    const { x, y } = initialCamRef.current;
    // C3: Commit the logical position immediately so stale-closure reads are
    // always accurate, regardless of whether animation is skipped.
    camRef.current = { x, y };

    // C3: Respect reduced-motion preference (WCAG 2.3.3).
    // If the user has enabled "Reduce Motion" in OS accessibility settings,
    // jump the camera instantly rather than spring-animating.
    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduceMotion => {
        if (reduceMotion) {
          cameraAnim.setValue({ x, y });
        } else {
          Animated.spring(cameraAnim, {
            toValue: { x, y }, useNativeDriver: false, friction: 7, tension: 120,
          }).start();
        }
      })
      .catch(() => {
        // Cannot determine preference — spring-animate as the default.
        Animated.spring(cameraAnim, {
          toValue: { x, y }, useNativeDriver: false, friction: 7, tension: 120,
        }).start();
      });
  }, [cameraAnim]);

  // ── Tile press — delegates to onTilePress prop after drag guard ──────────
  const handleTilePress = useCallback((tile: HexMapTile) => {
    if (drag.current.moved) return;
    onTilePress?.(tile);
  }, [onTilePress]);

  // ── Render order: iso-depth sort; current tile paints last (top) ────────────
  // Push 13: tighter spacing means tiles from adjacent staggered columns now
  // visually overlap. Sorting by r alone was correct when only same-column rows
  // overlapped; with the new constants, diagonal neighbours (q, r) vs
  // (q+1, r−1) also overlap in screen space.
  //
  // Iso-depth for flat-top axial: screen_y ∝ r × R_STEP + q × Q_VOFF
  //   = (r + q × 0.5) × R_STEP   [since Q_VOFF = R_STEP/2]
  // Sorting by (r + q × 0.5) correctly orders ALL overlapping pairs.
  const sorted = useMemo(
    () =>
      [...tiles].sort((a, b) => {
        if (a.current && !b.current) return  1;
        if (b.current && !a.current) return -1;
        const da = a.r + a.q * 0.5;
        const db = b.r + b.q * 0.5;
        return da !== db ? da - db : a.q - b.q;
      }),
    [tiles],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View
      style={[StyleSheet.absoluteFill, s.viewport]}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={[s.world, { transform: cameraAnim.getTranslateTransform() }]}
      >
        {sorted.map(tile => (
          <HexTile
            key={tile.id}
            tile={tile}
            sz={sz}
            ox={ox}
            oy={oy}
            onPress={handleTilePress}
            explorationCharacter={explorationCharacter}
            tileVis={resolvedTileVis}
            fogTheme={fogTheme}
          />
        ))}

        {/* ── Continuous atmospheric fog — Push 4 ───────────────────────────
         * A single world-space SVG replaces ALL per-tile fog images (both
         * the Layer A local images inside each Pressable and the old Layer B
         * oversized-halo Image elements).
         *
         * Design:
         *   unexplored            → large RadialGradient blob (FOG_BLOB_RADIUS × sz).
         *                           Adjacent blobs fully overlap → one seamless ink-
         *                           blue fog mass.  No hex-tile shape is visible.
         *   exploredButOutOfVision → small thin RadialGradient haze (FOG_HAZE_RADIUS × sz).
         *                           Tile is BELOW the fog SVG (zIndex < 5000) so its
         *                           terrain shows dimly through the 22 % haze.
         *   visibleNow             → tile at zIndex 5100+, ABOVE the fog SVG, so
         *                           terrain renders on top of the fog without any
         *                           hole/cutout in the SVG.  Adjacent visibleNow tiles
         *                           overlap each other (tiles are sz × sz, spacing
         *                           0.72 × sz) forming a seamless reveal cluster.
         *   current                → tile at zIndex 9999 (always topmost).
         *
         * Why not SVG <Mask>: react-native-svg's web backend (elements.web.ts)
         * has no Mask class — only a type import.  Mask only works on native.
         * The zIndex-elevation approach works on both platforms.
         *
         * zIndex 5000: above all normal tiles (1–3000), below current tile (9999).
         * pointerEvents="none": all taps fall through to tile Pressables.
         */}
        {(() => {
          // Push 5: explored tiles now sit at zIndex 5050 (ABOVE this fog SVG).
          // Their memory veil is applied tile-side as a hex-polygon fill (Layer 2b).
          // This SVG renders ONLY unexplored fog blobs.
          const unexplored = tiles.filter(t => !t.current && t.visibility === 'unexplored');
          if (unexplored.length === 0) return null;

          const blobR = sz * FOG_BLOB_RADIUS;

          return (
            <View
              style={{ position: 'absolute', top: 0, left: 0, width: worldW, height: worldH, zIndex: 5000, pointerEvents: 'none' } as object}
            >
              <Svg width={worldW} height={worldH}>
                {/*
                  Push 11 — base concealment floor.
                  A flat Rect at the same zIndex as the fog SVG (5000) gives a
                  guaranteed minimum concealment across the ENTIRE world area.
                  Even where only one blob's semi-transparent edge reaches, the
                  background is still blocked by baseFill (0.58–0.62 opacity).
                  Explored / visibleNow tiles sit at zIndex 5050–5200 (above this
                  SVG) so they receive zero dimming from this rect.
                */}
                <Rect
                  x={0} y={0}
                  width={worldW} height={worldH}
                  fill={fogTheme.baseFill}
                />
                <Defs>
                  {/*
                    Push 11 — tighter gradient stops.
                    Previous: [0%: 0.94, 52%: 0.865, 100%: 0] — long semi-transparent
                    ramp from 52–100% where background was readable through one blob.
                    Push 11: cap stays dense to 65%, meaningful fade begins at 75%,
                    edge is zero at 100%.  Combined with baseFill this gives solid
                    concealment everywhere except the softest atmospheric blob edge.
                  */}
                  {unexplored.map(t => {
                    const { left, top } = tilePos(t.q, t.r, sz, ox, oy);
                    const cx = left + sz / 2;
                    const cy = top  + sz / 2;
                    const id = fogGradId('fog', t.q, t.r);
                    return (
                      <RadialGradient
                        key={id} id={id}
                        cx={cx} cy={cy} r={blobR} fx={cx} fy={cy}
                        gradientUnits="userSpaceOnUse"
                      >
                        <Stop offset="0%"   stopColor={fogTheme.blobColor} stopOpacity={fogTheme.blobOpacity} />
                        <Stop offset="65%"  stopColor={fogTheme.blobColor} stopOpacity={fogTheme.blobOpacity * 0.95} />
                        <Stop offset="75%"  stopColor={fogTheme.blobColor} stopOpacity={fogTheme.blobOpacity * 0.50} />
                        <Stop offset="100%" stopColor={fogTheme.blobColor} stopOpacity={0} />
                      </RadialGradient>
                    );
                  })}
                </Defs>

                {/* Unexplored fog blobs — overlap and merge into one seamless fog mass */}
                {unexplored.map(t => {
                  const { left, top } = tilePos(t.q, t.r, sz, ox, oy);
                  return (
                    <Circle
                      key={t.id}
                      cx={left + sz / 2}
                      cy={top  + sz / 2}
                      r={blobR}
                      fill={`url(#${fogGradId('fog', t.q, t.r)})`}
                    />
                  );
                })}
              </Svg>
            </View>
          );
        })()}

        {/* ── Gate art overlay ──────────────────────────────────────────────
         * Spatially anchored to the isGate tile inside the world viewport.
         * Visually extends beyond the tile hex to feel like part of the
         * environment, but does NOT create fake playable tiles:
         *   - interaction handled entirely by the underlying gate HexTile
         *   - pointerEvents="none" lets all taps pass through to the tile
         *   - fog rules: hidden → not rendered; frontier/revealed → visible
         */}
        {gateArt && (() => {
          const gateTile = tiles.find(t => t.isGate);
          if (!gateTile || gateTile.visibility === 'unexplored') return null;
          const { left, top } = tilePos(gateTile.q, gateTile.r, sz, ox, oy);
          // Overlay is 1.8× the tile size — visually prominent but centred
          // so it does not shift the effective tap target.
          const overlaySize = Math.round(sz * 1.8);
          const offset      = Math.round((overlaySize - sz) / 2);
          return (
            <View
              key="gate-art-overlay"
              pointerEvents="none"
              style={{
                position: 'absolute',
                left:     left  - offset,
                top:      top   - offset,
                width:    overlaySize,
                height:   overlaySize,
                zIndex:   5500,  // above fog SVG (5000), below current tile (9999)
              }}
            >
              <Image
                source={gateArt.unlocked ? gateArt.unlockedSrc : gateArt.lockedSrc}
                style={{ width: overlaySize, height: overlaySize }}
                contentFit="contain"
                testID="boss-gate-art"
              />
            </View>
          );
        })()}
      </Animated.View>

      <RecenterButton onPress={recenter} />
    </View>
  );
}

// Re-export HexMapTile for convenience (fog-map.tsx imports from here).
export type { HexMapTile };

// ── Styles ────────────────────────────────────────────────────────────────────
const JADE     = UI.jade       ?? '#3DC4A8';
const PANEL_BG = (UI as Record<string, string>).sanctuaryPanel ?? '#122030';

const s = StyleSheet.create({
  viewport: {},
  world: {
    position: 'absolute',
    top:  0,
    left: 0,
  },
  // overflow:'visible' lets large sprites (area boss, player) extend above/
  // beyond the sz×sz tile bounds without being clipped.  Depth ordering is
  // still governed by tileZ (set on the Pressable itself), so the correct
  // 2.5D "lower tiles in front" ordering is preserved.
  tile:    { position: 'absolute', overflow: 'visible' },
  overlay: { position: 'absolute', top: 0, left: 0 },
  marker:  { position: 'absolute' },
  recenterBtn: {
    position:        'absolute',
    bottom:          14,
    right:           14,
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: PANEL_BG + 'EE',
    borderWidth:     1.5,
    borderColor:     JADE + '88',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.35,
    shadowRadius:    4,
    elevation:       4,
  },
  recenterIcon: {
    color:      JADE,
    fontSize:   20,
    lineHeight: 22,
    userSelect: 'none',
  } as object,
});
