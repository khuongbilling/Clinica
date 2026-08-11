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
 * • exploredButOutOfVision → SVG memory veil (faint fill + hairline ring); painting shows through
 * • visibleNow             → SVG jade edge glow (transparent center); painting shows through
 * • current                → SVG jade ring; painting shows through the center
 *
 * PUSH 8 (map sprite) — Player scale + grounding polish
 * ──────────────────────────────────────────────────────
 * • CHR_W_RATIO 1.00 → 1.15: sprite occupies 1.15 hex widths (target 1.0–1.25).
 * • CHR_H_RATIO 1.32 → 1.15: square bounding box matches the 1024×1024 square
 *   asset so contentFit="contain" fills exactly — no letterbox vertical offset.
 * • CHR_Y_SHIFT 0.36 → 0.38: feet/boots land at ~0.655 × sz (lower-centre of
 *   tile).  Character head rises ~32 % of sz above the tile top.
 * • CHR_GLOW_CY 0.83 → 0.65: jade ground pool tracks the new feet position.
 * • CHR_GLOW_RX 0.33 → 0.36, CHR_SHADOW_RX + 0.07: wider footprint to match
 *   the 1.15× sprite scale; shadow remains clearly under the character.
 * • CHR_SHADOW_RY 0.072 → 0.075: slightly stronger contact shadow presence.
 * • Current-tile hex ring (Layer 1a) renders below the sprite and remains
 *   visible in the upper half of the tile above the character's body.
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
 * PUSH 9 — Standardise map encounters as 2.5D world pieces
 * ──────────────────────────────────────────────────────────
 * ALL encounter types (battle, merchant, areaBoss, treasure) are now shown
 * as physical world pieces on BOTH visibleNow (frontier) and
 * exploredButOutOfVision tiles.  Previous push showed treasure only.
 *
 * Disclosure rules:
 *   battle  → battle pedestal (crossed scalpels + caduceus plinth).
 *             Composition hidden until fight starts — the pedestal only
 *             signals that an encounter is waiting, not what the enemy is.
 *   merchant → apothecary cart.  Full disclosure; it's a positive event.
 *   areaBoss → actual boss sprite (sizeMul 1.35 > player 1.15).  Intentionally
 *             intimidating — players should see it coming from one tile away.
 *   treasure → gold/silver/bronze isometric chest matching tier.
 *             shadowColor: gold → warm amber pool, silver → cool blue pool.
 *   wardEvent → renderer-ready stub; dedicated NPC/prop art ships with
 *               the wardEvent EncounterType addition (future push).
 *
 * Area boss shadow: teal-tinted pool matches the creature's flame colour.
 * New asset: encounter_chest_gold.png (isometric, transparent bg).
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
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, Polygon, RadialGradient, Stop } from 'react-native-svg';

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
   */
  veilStroke:     string;   // exploredButOutOfVision hairline edge stroke
  veilStrokeW:    number;   // hairline width (px)
  frontierStroke: string;   // visibleNow edge glow + inner circular glow color
  currentRing:    string;   // current-tile SVG ring stroke (Layer 1a)
};

const FOG_THEMES: Record<'day' | 'evening' | 'night', FogTheme> = {
  // ── Night — canonical dark environment; values preserved from Push 4–5 ─────
  night: {
    blobColor:      'rgb(6,10,22)',           // deep ink-blue atmospheric fog
    blobOpacity:    0.97,                     // dense solid mass; blobs alone cover unexplored area
    veilStroke:     'rgba(255,255,255,0.28)', // white hairline — visited-territory wire
    veilStrokeW:    0.8,
    frontierStroke: 'rgba(100,230,208,0.80)', // jade-teal edge glow + inner circular glow source
    currentRing:    'rgba(90,230,205,0.82)',  // bright jade ring
  },

  // ── Day — bright natural light, warm daylight, pale mist ────────────────────
  // Backgrounds: ivory/cream marble, sunlight through clouds, jade-teal pillars,
  // flowering greenery, open active environment.
  day: {
    blobColor:      'rgb(200,220,238)',        // pale blue-white daylight cloud-mist
    blobOpacity:    0.94,                      // boosted: blobs alone must cover unexplored area
    veilStroke:     'rgba(140,110,55,0.38)',   // antique gold hairline (legible on bright stone)
    veilStrokeW:    0.9,
    frontierStroke: 'rgba(80,205,165,0.82)',   // warm jade edge glow + inner circular glow source
    currentRing:    'rgba(80,210,170,0.85)',   // jade ring, warm tone for daylight
  },

  // ── Evening — true twilight: amber lanterns, indigo sky, long shadows ───────
  // Backgrounds: dusky purple-mauve courtyard, amber lanterns lit, teal columns,
  // orange sunset sky, long diagonal shadows cutting across the atrium.
  evening: {
    blobColor:      'rgb(28,18,52)',           // deep indigo-purple dusk shadow
    blobOpacity:    0.95,
    veilStroke:     'rgba(200,155,70,0.40)',   // warm amber hairline — lantern glow hint
    veilStrokeW:    0.8,
    frontierStroke: 'rgba(195,150,65,0.80)',   // amber edge + inner circular glow — lanterns
    currentRing:    'rgba(90,225,195,0.82)',   // jade ring (same family as night)
  },
};

// ── Push 8: 2.5D character sprite sizing ─────────────────────────────────────
//
// Sprites in assets/map-sprites/ are 1024 × 1024 square PNGs (transparent bg).
// The character body is centred horizontally; feet/boots land at ~90 % of the
// image height.  There is no baked-in contact shadow — Layer 4a supplies it.
//
// Container is a SQUARE bounding box (CHR_W_RATIO = CHR_H_RATIO):
//   contentFit="contain" fills the square exactly — no letterbox centering offset.
//   charW = charH = CHR_W_RATIO × sz  (1.15 hex widths)
//   charX = (sz − charW) / 2 = −0.075 × sz  (extends 7.5 % beyond tile edges)
//   charY = −CHR_Y_SHIFT × sz         (shifts sprite upward from tile top)
//
// Sizing goal: feet contact lower-centre of tile (~0.65 × sz from tile top).
//
// Math:
//   feet_y = charY + 0.90 × charH
//          = −CHR_Y_SHIFT × sz + 0.90 × CHR_W_RATIO × sz
//   target = 0.655 × sz
//   → CHR_Y_SHIFT = 0.90 × 1.15 − 0.655 = 1.035 − 0.655 = 0.38            ✓
//
// Head rises to: charY + 0.05 × charH ≈ −0.38sz + 0.058sz = −0.32sz
// (about 32 % of tile width above the tile top — overlaps the cell above in
//  isometric depth but renders on top thanks to zIndex 9999.)
//
// The jade glow ellipse (Layer 4a) is centred at the feet position and widens
// slightly beyond the sprite footprint for a magical ambient halo effect.
const CHR_W_RATIO          = 1.15;   // sprite width  = 1.15 × sz (1.15 hex widths)
const CHR_H_RATIO          = 1.15;   // sprite height = 1.15 × sz (square bounding box)
const CHR_Y_SHIFT          = 0.38;   // upward shift from tile top (fraction of sz)
const CHR_GLOW_CY          = 0.65;   // jade glow centre Y = feet position (fraction of sz)
const CHR_GLOW_RX          = 0.36;   // jade glow horizontal radius (wider than 1.0× era)
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
const CHR_SHADOW_CY    = CHR_GLOW_CY;            // same floor as jade glow (0.65 × sz)
const CHR_SHADOW_RX    = CHR_GLOW_RX + 0.07;     // wider than glow (0.43 × sz) — Push 8
const CHR_SHADOW_RY    = 0.075;                  // slightly taller than node shadow

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
  // Push 9: dedicated isometric gold chest (transparent bg).
  // Replaces node_reward_medical_chest.png which had a baked-in white background
  // and a front-facing (non-isometric) perspective inconsistent with the other tiers.
  treasureGold:   require('@/assets/map-nodes/encounter_chest_gold.png')         as number,
};

// ── Resolved tile visual sources ─────────────────────────────────────────────

/**
 * Effective tile-art sources passed from HexMapLayer down to HexTile.
 * Push 4: terrain images are no longer rendered per-tile.
 * The chapter background painting is the environment; hex Pressables are an
 * interaction/state layer placed on top — not a collection of floor tiles.
 * Push 7: fog rendering moved to JourneyFogLayer (see below) — HexTile carries
 * only interaction target, state border/glow, and encounter anchor.
 */

/**
 * Push 7: source + tile-footprint for one world-object prop.
 * Push 9: shadowColor — tier-specific glow pool for treasure chests.
 *         Omit to use the default dark SHADOW_COLOR.
 */
type EncounterMapNode = { src: number; sizeMul: number; shadowColor?: string };

/**
 * Returns the 2.5D world-object asset and tile footprint for revealed tiles.
 *
 * Visibility rule (Push 9):
 *   unexplored            → always null (tile not yet in FOV history)
 *   visibleNow            → ALL encounter types shown (in current FOV)
 *   exploredButOutOfVision → ALL encounter types shown (remembered)
 *   current               → ALL encounter types shown
 *
 * Battle discloses the PEDESTAL, not the enemy composition.  Players learn
 * "a fight is here" but not what they'll face until the battle starts.
 *
 * sizeMul drives the bounding-box size as a fraction of the tile sz.
 * Positioning: bottom of bounding box anchored at ~88 % tile height (hex floor).
 *
 *   areaBoss    1.35 — larger than player sprite (CHR_W_RATIO 1.15); imposing
 *   merchant    0.78 — substantial cart prop, slightly larger than before
 *   battle      0.70 — stone pedestal; raised slightly for better presence
 *   treasure    0.68 — chest scale; slightly larger for tier readability
 */
function encounterMapNode(tile: HexMapTile): EncounterMapNode | null {
  const vis = tile.visibility;

  // Only truly unexplored tiles suppress world objects.
  // visibleNow, exploredButOutOfVision, and current all render their encounter.
  if (!tile.current && vis === 'unexplored') return null;

  switch (tile.encounter) {
    case 'battle':
      return { src: MAP_NODE.battle, sizeMul: 0.70 };

    case 'merchant':
      return { src: MAP_NODE.merchant, sizeMul: 0.78 };

    case 'areaBoss':
      // 1.35 × sz — intentionally larger than the player sprite (1.15) so the
      // boss reads as genuinely threatening from one tile away.
      // Teal shadow pool matches the creature's ambient flame colour.
      return {
        src:         MAP_NODE.areaBoss,
        sizeMul:     1.35,
        shadowColor: 'rgba(0,160,140,0.40)',  // teal glow pool
      };

    case 'treasure': {
      const tier = tile.chestTier ?? 'bronze';
      return {
        src: tier === 'gold'   ? MAP_NODE.treasureGold
           : tier === 'silver' ? MAP_NODE.treasureSilver
           :                     MAP_NODE.treasureBronze,
        sizeMul: 0.68,
        // Tier-specific glow pool so the chest tier reads at small map sizes.
        // Bronze gets no override — the default dark shadow suits its humble look.
        shadowColor:
          tier === 'gold'   ? 'rgba(220,170,0,0.55)'   // warm amber pool
        : tier === 'silver' ? 'rgba(90,140,255,0.45)'  // cool blue pool
        : undefined,
      };
    }

    // wardEvent: renderer-ready stub.
    // When wardEvent is added to EncounterType, add a case here with dedicated
    // NPC/prop assets keyed by tile.wardEventSubtype:
    //   support_ally / ward_blessing       → allied NPC prop
    //   patient_family_team / handoff /
    //   surveillance_patient               → patient scene prop
    //   protocol_card                      → clinical document prop
    //   resource_service                   → equipment station prop
    //   ward_hazard                        → hazard marker prop
    default:
      return null;
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

  // Push 9: all encounter types are disclosed once a tile is visibleNow or
  // exploredButOutOfVision — the world object is visible, so the label matches.
  if (tile.encounter !== 'none' && tile.encounter !== 'boss') {
    const prefix = tile.visibility === 'visibleNow' ? 'Nearby' : 'Tile';
    const enc =
      tile.encounter === 'areaBoss' ? 'Area Boss'
    : tile.encounter === 'treasure' ? `Treasure (${tile.chestTier ?? 'bronze'})`
    : tile.encounter === 'merchant' ? 'Merchant'
    : 'Battle';
    return `${prefix} — ${enc}`;
  }

  if (tile.visibility === 'visibleNow') return 'Nearby tile, not yet explored';
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
  /**
   * Per-shift SVG color theme — drives state border/glow colors (veil hairline,
   * frontier jade rim, current-tile ring).  Resolved by HexMapLayer from the
   * active `timeOfDay`; individual tiles never inspect shift state themselves.
   * Atmospheric fog belongs to JourneyFogLayer, not HexTile.
   */
  fogTheme: FogTheme;
}

function HexTile({ tile, sz, ox, oy, onPress, explorationCharacter, fogTheme }: HexTileProps) {
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
      {/* ── Layer 1a: current tile — single hex boundary + subtle center glow ──
        * One strong hex ring at the tile edge is the primary "you are here" signal.
        * A faint radial glow lights the interior without filling it — environment
        * painting shows through the center.  CHR_GLOW (Layer 4a) provides the
        * per-character circular ground pool beneath the sprite.                */}
      {tile.current && (
        <View style={[s.overlay, { pointerEvents: 'none' }]}>
          <Svg width={sz} height={sz}>
            <Defs>
              <RadialGradient id="cur-glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <Stop offset="0%"   stopColor={fogTheme.currentRing} stopOpacity={0.14} />
                <Stop offset="55%"  stopColor={fogTheme.currentRing} stopOpacity={0.04} />
                <Stop offset="100%" stopColor={fogTheme.currentRing} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {/* Faint radial interior illumination — magical ambience, not a floor */}
            <Circle cx={sz / 2} cy={sz / 2} r={sz * 0.44} fill="url(#cur-glow)" />
            {/* Strongest hex boundary of all three states — "you are here" */}
            <Polygon
              points={hexPoints(sz, 0.97)}
              fill="transparent"
              stroke={fogTheme.currentRing}
              strokeWidth={2.8}
              strokeOpacity={0.92}
            />
          </Svg>
        </View>
      )}

      {/* ── Layer 1b: unexplored tile — no per-tile images (Push 4) ────────── */}
      {/* Fog is now a world-space SVG layer above all tile Pressables.        */}
      {/* TILE_BASE.hidden and fogInterior textures are removed here.           */}
      {/* The tile Pressable itself stays (disabled=true → non-interactive).   */}

      {/* ── Layer 2a: visibleNow — circular inner glow + jade rim ──────────────
        * Transparent interior with a circular radial glow signals reachable
        * territory without creating a hex-shaped floor.  The jade rim at the
        * cell boundary is the primary readability signal.
        * Gradient ID is unique per tile (q×r) since multiple frontier tiles
        * coexist and SVG IDs are document-global in web output.                */}
      {isVisible && (
        <View style={[s.overlay, { pointerEvents: 'none' }]}>
          <Svg width={sz} height={sz}>
            <Defs>
              <RadialGradient
                id={`fg-${tile.q}x${tile.r}`}
                cx="50%" cy="50%" r="50%" fx="50%" fy="50%"
              >
                <Stop offset="0%"   stopColor={fogTheme.frontierStroke} stopOpacity={0.22} />
                <Stop offset="55%"  stopColor={fogTheme.frontierStroke} stopOpacity={0.07} />
                <Stop offset="100%" stopColor={fogTheme.frontierStroke} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {/* Soft circular illumination — restrained magical glow, not a floor */}
            <Circle cx={sz / 2} cy={sz / 2} r={sz * 0.42} fill={`url(#fg-${tile.q}x${tile.r})`} />
            {/* Jade rim — slightly stronger than explored hairline; movement cue */}
            <Polygon
              points={hexPoints(sz, 0.96)}
              fill="transparent"
              stroke={fogTheme.frontierStroke}
              strokeWidth={2.2}
              strokeOpacity={0.84}
            />
          </Svg>
        </View>
      )}

      {/* ── Layer 2b: exploredButOutOfVision — hairline wire only ───────────────
        * No fill at all — the environment painting shows fully through the tile.
        * A single thin hairline ring marks "visited territory" at the hex edge.
        * Encounter markers (Layer 3) render above this and stay legible.       */}
      {isExplored && (
        <View style={[s.overlay, { pointerEvents: 'none' }]}>
          <Svg width={sz} height={sz}>
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

      {/* ── Layer 3: encounter world object (visibleNow / explored / current) ── */}
      {/* Push 9: all encounter types shown on visibleNow AND exploredButOut-     */}
      {/* OfVision.  Battle shows the pedestal only (enemy hidden); areaBoss       */}
      {/* renders the actual boss sprite at 1.35 × sz (larger than player 1.15). */}
      {/* All nodes bottom-anchored at ~88 % tile height (the 2.5D hex floor).   */}
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

// ── JourneyFogLayer ───────────────────────────────────────────────────────────

/**
 * Continuous atmospheric fog surface rendered above all tile Pressables.
 *
 * Receives the full tile set plus geometry/theme props; produces ONE visually
 * seamless fog layer.  Individual HexTile components carry NO fog DOM — all
 * atmospheric fog logic lives here.
 *
 * Web:    imperatively-managed HTML <canvas> child injected into a View ref.
 *         Canvas 2D destination-out compositing → solid fog fill with feathered
 *         holes carved at each explored / visible tile.  No tile-boundary seams.
 * Native: react-native-svg RadialGradient blobs (Skia handles userSpaceOnUse).
 *
 * zIndex 5000 — above unexplored tile Pressables (1–3000),
 *               below exploredButOutOfVision (5050) and visibleNow (5100+).
 *
 * Inputs:
 *   tiles    — full run tile set (visibility + coords read here, not in HexTile)
 *   sz/ox/oy — tile geometry constants from HexMapLayer
 *   worldW/H — total world canvas bounds
 *   fogTheme — per-shift colour palette (blobColor, blobOpacity, etc.)
 */
interface JourneyFogLayerProps {
  tiles:    readonly HexMapTile[];
  sz:       number;
  ox:       number;
  oy:       number;
  worldW:   number;
  worldH:   number;
  fogTheme: FogTheme;
}

function JourneyFogLayer({ tiles, sz, ox, oy, worldW, worldH, fogTheme }: JourneyFogLayerProps) {
  // Web: imperatively-managed HTML <canvas> child
  const fogContainerRef = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const container = fogContainerRef.current as unknown as HTMLDivElement | null;
    if (!container || worldW <= 0 || worldH <= 0) return;

    // Reuse the canvas across renders to avoid teardown/setup cost.
    let canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) {
      canvas = document.createElement('canvas');
      Object.assign(canvas.style, {
        position: 'absolute', left: '0', top: '0',
        display: 'block', pointerEvents: 'none',
      });
      container.appendChild(canvas);
    }

    // Hi-DPI: physical canvas size = logical size × devicePixelRatio.
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.round(worldW * dpr);
    canvas.height = Math.round(worldH * dpr);
    canvas.style.width  = worldW + 'px';
    canvas.style.height = worldH + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ── Step 1: solid fog fill — one continuous atmospheric surface ─────────
    ctx.clearRect(0, 0, worldW, worldH);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fogTheme.blobOpacity;
    ctx.fillStyle   = fogTheme.blobColor;
    ctx.fillRect(0, 0, worldW, worldH);
    ctx.globalAlpha = 1;

    // ── Step 2: carve feathered reveal holes at each non-unexplored tile ───
    // destination-out draws REMOVE canvas opacity.  A radial gradient that is
    // opaque-black at centre and transparent at the outer edge creates an
    // organic feathered reveal boundary.  Adjacent holes merge naturally.
    ctx.globalCompositeOperation = 'destination-out';

    for (const t of tiles) {
      if (!t.current && t.visibility === 'unexplored') continue;

      const { left, top } = tilePos(t.q, t.r, sz, ox, oy);
      const cx = left + sz / 2;
      const cy = top  + sz / 2;

      // Reveal radius scales with visibility quality:
      //   current              → widest clear area + longest feather
      //   visibleNow           → medium reach (adjacent territory)
      //   exploredButOutOfVision → tight (remembered position, not active sight)
      const isCur    = t.current;
      const isVis    = !isCur && t.visibility === 'visibleNow';
      const clearR   = isCur ? sz * 0.60 : isVis ? sz * 0.52 : sz * 0.42;
      const featherR = isCur ? sz * 1.30 : isVis ? sz * 1.12 : sz * 0.96;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, featherR);
      grad.addColorStop(0,                 'rgba(0,0,0,1)');
      grad.addColorStop(clearR / featherR, 'rgba(0,0,0,1)');
      grad.addColorStop(0.82,              'rgba(0,0,0,0.35)');
      grad.addColorStop(1,                 'rgba(0,0,0,0)');

      ctx.beginPath();
      ctx.arc(cx, cy, featherR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, sz, ox, oy, worldW, worldH, fogTheme]);

  // ── Web: return the container View; canvas is injected above ──────────────
  if (Platform.OS === 'web') {
    return (
      <View
        ref={fogContainerRef}
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0,
          width: worldW, height: worldH, zIndex: 5000,
        } as object}
      />
    );
  }

  // ── Native: SVG RadialGradient blobs (Skia handles userSpaceOnUse) ─────────
  const unexplored = tiles.filter(t => !t.current && t.visibility === 'unexplored');
  if (unexplored.length === 0) return null;
  const blobR = sz * FOG_BLOB_RADIUS;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, width: worldW, height: worldH, zIndex: 5000, pointerEvents: 'none' } as object}>
      <Svg width={worldW} height={worldH}>
        <Defs>
          {unexplored.map(t => {
            const { left, top } = tilePos(t.q, t.r, sz, ox, oy);
            const cx = left + sz / 2;
            const cy = top  + sz / 2;
            const id = fogGradId('fog', t.q, t.r);
            return (
              <RadialGradient key={id} id={id} cx={cx} cy={cy} r={blobR} fx={cx} fy={cy} gradientUnits="userSpaceOnUse">
                <Stop offset="0%"   stopColor={fogTheme.blobColor} stopOpacity={fogTheme.blobOpacity} />
                <Stop offset="65%"  stopColor={fogTheme.blobColor} stopOpacity={fogTheme.blobOpacity * 0.95} />
                <Stop offset="75%"  stopColor={fogTheme.blobColor} stopOpacity={fogTheme.blobOpacity * 0.50} />
                <Stop offset="100%" stopColor={fogTheme.blobColor} stopOpacity={0} />
              </RadialGradient>
            );
          })}
        </Defs>
        {unexplored.map(t => {
          const { left, top } = tilePos(t.q, t.r, sz, ox, oy);
          return (
            <Circle key={t.id} cx={left + sz / 2} cy={top + sz / 2} r={blobR} fill={`url(#${fogGradId('fog', t.q, t.r)})`} />
          );
        })}
      </Svg>
    </View>
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
   * Visual theme assets for the current chapter/shift. Only `fogInterior` is
   * read by the tile renderer; terrain floor images are no longer rendered
   * per-tile (Push 2 — transparent hex cells; painting is the terrain).
   */
  tileVisuals?: Pick<import('@/src/game/journeyMap/chapterMapVisuals').ChapterShiftVisuals,
    'terrainCurrent' | 'terrainBase' | 'terrainFrontier' | 'fogInterior'>;

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

  // ── Canvas fog (web only) ──────────────────────────────────────────────────
  // react-native-svg RadialGradient with gradientUnits="userSpaceOnUse" on web
  // renders as white rectangles — gradient coords don't map to screen space.
  // Push 7: fog rendering extracted to JourneyFogLayer (see above).
  // HexMapLayer no longer owns fogContainerRef or the canvas useEffect.

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
            fogTheme={fogTheme}
          />
        ))}

        {/* ── Continuous atmospheric fog (Push 7 — JourneyFogLayer) ──────────
         * All fog rendering is delegated to JourneyFogLayer.
         * HexTile components carry NO fog DOM — inspecting one HexTile in the
         * DOM shows only interaction target, state glow/border, encounter anchor.
         * zIndex 5000: above unexplored Pressables (1–3000), below current (9999).
         */}
        <JourneyFogLayer
          tiles={tiles}
          sz={sz}
          ox={ox}
          oy={oy}
          worldW={worldW}
          worldH={worldH}
          fogTheme={fogTheme}
        />

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
  tile:    { position: 'absolute', overflow: 'visible', backgroundColor: 'transparent' },
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
