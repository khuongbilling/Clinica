/**
 * HexMapLayer — PUSH 8 bounded camera pan / PUSH 7 unified world transform / PUSH 6 unified world coords
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
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
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
import Svg, { Circle, Defs, Ellipse, Polygon, RadialGradient, Stop } from 'react-native-svg';

import { type HexMapTile, JOURNEY_MAP_FIXTURE } from '@/src/game/journeyMap/fixture';
import { UI } from '@/src/theme/ui';
import {
  Q_STEP, R_STEP, Q_VOFF,
  MIN_TILE_SZ, MAX_TILE_SZ,
  computeHexWorldCoords,
  type HexWorldCoords,
} from './hexWorldCoords';
import { JourneyFogField } from './JourneyFogField';

// ── Hex layout constants — imported from hexWorldCoords.ts (Push 6) ──────────
// Q_STEP, R_STEP, Q_VOFF, MIN_TILE_SZ, MAX_TILE_SZ are re-exported from the
// authoritative hexWorldCoords module.  They remain visible here so that any
// file-level code that references them (SVG sort rationale, fog comments) can
// still do so without touching the import chain.
// Do NOT redefine these constants locally — hexWorldCoords.ts is the owner.

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

// Push 13: blobColor and blobOpacity removed from FogTheme — they drove the
// rectangular fillRect fog plane (web) and SVG blob fills (native) which are
// now gone.  The remaining fields drive per-tile state-ring SVGs only.
//
// Push 18: hazeColor + hazeAlpha added — drives the memory-haze SVG fill that
// tints explored-but-out-of-vision tiles.  Kept in FogTheme so the haze colour
// matches the per-shift fog palette without a separate prop.
type FogTheme = {
  veilStroke:     string;   // exploredButOutOfVision hairline edge stroke
  veilStrokeW:    number;   // hairline width (px)
  frontierStroke: string;   // visibleNow edge glow + inner circular glow color
  currentRing:    string;   // current-tile SVG ring stroke (Layer 1a)
  /** Push 18: SVG fill colour for the explored memory-haze overlay. */
  hazeColor:      string;
  /** Push 18: opacity of the memory-haze hex fill (0–1). */
  hazeAlpha:      number;
};

const FOG_THEMES: Record<'day' | 'evening' | 'night', FogTheme> = {
  night: {
    veilStroke:     'rgba(255,255,255,0.28)', // white hairline — visited-territory wire
    veilStrokeW:    0.8,
    frontierStroke: 'rgba(100,230,208,0.80)', // jade-teal edge glow + inner circular glow source
    currentRing:    'rgba(90,230,205,0.82)',  // bright jade ring
    // Push 18: cool ink-blue tint — memory of something seen in dim starlight
    hazeColor:      'rgba(20,35,75,1)',
    hazeAlpha:      0.32,
  },
  day: {
    veilStroke:     'rgba(140,110,55,0.38)',  // antique gold hairline
    veilStrokeW:    0.9,
    frontierStroke: 'rgba(80,205,165,0.82)',  // warm jade edge glow
    currentRing:    'rgba(80,210,170,0.85)',  // jade ring, warm tone for daylight
    // Push 18: pale overcast grey — daylight memory haze, minimal tint
    hazeColor:      'rgba(160,175,195,1)',
    hazeAlpha:      0.22,
  },
  evening: {
    veilStroke:     'rgba(200,155,70,0.40)',  // warm amber hairline — lantern glow hint
    veilStrokeW:    0.8,
    frontierStroke: 'rgba(195,150,65,0.80)', // amber edge + inner circular glow — lanterns
    currentRing:    'rgba(90,225,195,0.82)', // jade ring (same family as night)
    // Push 18: muted indigo — dusk memory, fading lantern warmth
    hazeColor:      'rgba(45,25,85,1)',
    hazeAlpha:      0.28,
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
// Push 4:  fog is a world-space SVG layer; terrainCurrent (jade glow) still used.
// Push 7:  MAP_NODE (world-object PNGs) replaces ENCOUNTER_ICON on the map surface.
//          ENCOUNTER_ICON is retained for legend panels and MerchantModal UI.
// Push 10: 2.5D hex terrain base tile.  One asset for ALL states — state
//          indication is handled by SVG overlays above (Layers 1a/2a/2b).
//          The same stone surface appears under normal, reachable, current,
//          and explored tiles; fog hides unexplored ones entirely.
//
//          Asset: hex-terrain-normal.png
//            • 2.5D three-quarter top-down painterly stone hex
//            • Jade-teal cracked stone surface with gold vein highlights
//            • Beveled bottom-left / bottom face for 2.5D depth illusion
//            • TRUE ALPHA transparency outside the hex silhouette
//            • No black/white/gray rectangular canvas
//            • Generated at high resolution, background-removed

/** Push 10: 2.5D painterly stone hex — base terrain for every tile state. */
const TERRAIN_NORMAL = require('@/assets/ui/journey/tiles/hex-terrain-normal.png') as number;

// ── Push 18: memory state opacity constants ───────────────────────────────────
//
// exploredButOutOfVision tiles are styled as "remembered terrain" — readable
// but visually distinct from the fully-lit current field of vision.
//
// MEMORY_TERRAIN_ALPHA — terrain image opacity for explored tiles.
//   Reduces from 1.0 → 0.70: a ~30 % dimming that reads as "less lit"
//   without hiding the stone surface.  Combined with the hazeColor overlay
//   (Layer 2b) this produces the "slight desaturation + dimming" effect
//   without a CSS filter (which is not cross-platform on native).
//
// MEMORY_NODE_ALPHA — encounter-node image opacity for explored tiles.
//   Stays higher (0.82) so known stationary encounters remain clearly
//   visible after discovery.  Players should always be able to read
//   the encounter type they previously scouted.
const MEMORY_TERRAIN_ALPHA = 0.70;
const MEMORY_NODE_ALPHA    = 0.82;

/**
 * Push 11 — visual unification scale factor.
 *
 * The terrain PNG's hex silhouette has ~7–8 % transparent padding per side
 * inside the sz × sz bounding box (artefact of the 2.5D three-quarter-top
 * perspective and the removeBackground cutout).  Even with coordinate-level
 * hex-body overlap (Q_STEP 0.72 < 0.75, R_STEP 0.79 < 0.866), those
 * transparent bands create visible gaps that make each tile read as an
 * independent floating platform.
 *
 * Rendering the terrain Image at 115 % of sz (centred, with the Pressable's
 * existing `overflow:'visible'`) bleeds the stone surface 7.5 % beyond each
 * edge into neighbouring tiles' transparent-corner zones.  The existing iso-
 * depth zIndex ordering (higher-r / lower-screen-position = higher z) ensures
 * the "closer" tile correctly paints on top in every overlap region — exactly
 * the right 2.5D layering behaviour.
 *
 * SVG state rings stay at 100 % sz and fall just inside the extended terrain
 * hex silhouette, so cell boundaries remain crisp.
 *
 * This constant is the single lever for the bleed amount.  Increase → more
 * join; decrease → more gap.  Do not exceed 1.30 or terrain bleeds over SVG
 * state rings visually.
 */
const TERRAIN_SCALE = 1.15;

// Push 6 fallback — jade medallion token.  Still referenced below as the
// legacy medallion; replaced in Layer 4a/4b by MAP_SPRITE_EXPLORER (Push 19).
const PLAYER_TOKEN = require('@/assets/ui/journey/map/player-map-token.webp') as number;

// Push 19: generic exploration sprite used when the player has no class yet.
// Replaces the jade medallion token so the current tile always shows a
// painterly donghua chibi character rather than a UI ornament.
// Art spec: 2.5–3-head-tall chibi, teal-jade longcoat, black hair, soft
// cel-painted rendering, transparent bg, painted contact shadow at feet.
const MAP_SPRITE_EXPLORER = require('@/assets/map-sprites/map_sprite_explorer.png') as number;

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
 *
 * Push 20: ward event world-object props added — one per WardEventSubtype group.
 * All share the same three-quarter top-down isometric camera angle and Clinica
 * dark-navy / teal-jade / gold palette as the existing encounter nodes.
 * Contact shadow is baked into each asset; SVG shadow ellipse (Layer 3 shadow)
 * adds the per-tile grounding ellipse at runtime.
 *
 *   wardNpc      — support_ally: jade-lit lantern post + caduceus plinth
 *   wardPatient  — patient_family_team / handoff / surveillance: clinical bed scene
 *   wardShrine   — ward_blessing: tiered jade lotus altar with floating orb
 *   wardProtocol — protocol_card: clinical document lectern with caduceus parchment
 *   wardSupply   — resource_service: medical equipment trolley with IV hook
 *   wardHazard   — ward_hazard: overturned biohazard container + spill + cones
 */
const MAP_NODE = {
  battle:         require('@/assets/map-nodes/encounter_battle.png')             as number,
  merchant:       require('@/assets/map-nodes/encounter_merchant.png')           as number,
  areaBoss:       require('@/assets/map-nodes/encounter_area_boss.png')          as number,
  treasureBronze: require('@/assets/map-nodes/encounter_chest_bronze.png')       as number,
  treasureSilver: require('@/assets/map-nodes/encounter_chest_silver.png')       as number,
  // Push 9: dedicated isometric gold chest (transparent bg).
  treasureGold:   require('@/assets/map-nodes/encounter_chest_gold.png')         as number,
  // Push 20: ward event props
  wardNpc:        require('@/assets/map-nodes/encounter_ward_npc.png')           as number,
  wardPatient:    require('@/assets/map-nodes/encounter_ward_patient.png')       as number,
  wardShrine:     require('@/assets/map-nodes/encounter_ward_shrine.png')        as number,
  wardProtocol:   require('@/assets/map-nodes/encounter_ward_protocol.png')      as number,
  wardSupply:     require('@/assets/map-nodes/encounter_ward_supply.png')        as number,
  wardHazard:     require('@/assets/map-nodes/encounter_ward_hazard.png')        as number,
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

    // ── Push 20: wardEvent — clinical non-combat encounter ──────────────────
    // Prop selected by WardEventSubtype; all three patient interaction subtypes
    // share one ward-bed scene (the distinction is surfaced in the UI modal, not
    // on the map itself so the object reads the same regardless of shift).
    //
    // sizeMul tuning:
    //   wardShrine   0.88 — tiered altar is tall; keep it imposing
    //   wardPatient  0.92 — bed is wide; large footprint reads well at map scale
    //   wardHazard   0.88 — circular spill base needs room to read the symbol
    //   wardNpc      0.76 — lantern post is narrow; slightly smaller for balance
    //   wardSupply   0.82 — trolley is wide; medium footprint
    //   wardProtocol 0.72 — lectern is tall and narrow; keep it readable but small
    case 'wardEvent': {
      const sub = tile.wardEventSubtype;
      switch (sub) {
        case 'support_ally':
          return {
            src:         MAP_NODE.wardNpc,
            sizeMul:     0.76,
            shadowColor: 'rgba(0,180,150,0.28)',   // soft teal pool — welcoming
          };
        case 'patient_family_team':
        case 'handoff_patient':
        case 'surveillance_patient':
          return {
            src:         MAP_NODE.wardPatient,
            sizeMul:     0.92,
            // no shadowColor override — dark navy default suits the clinical white linen
          };
        case 'ward_blessing':
          return {
            src:         MAP_NODE.wardShrine,
            sizeMul:     0.88,
            shadowColor: 'rgba(0,200,160,0.35)',   // teal-jade luminous pool — magical
          };
        case 'protocol_card':
          return {
            src:         MAP_NODE.wardProtocol,
            sizeMul:     0.72,
            // no shadowColor — neutral stone base
          };
        case 'resource_service':
          return {
            src:         MAP_NODE.wardSupply,
            sizeMul:     0.82,
            // no shadowColor — institutional dark-iron trolley
          };
        case 'ward_hazard':
          return {
            src:         MAP_NODE.wardHazard,
            sizeMul:     0.88,
            shadowColor: 'rgba(220,50,0,0.38)',    // red-orange glow pool — danger
          };
        default:
          // Unknown subtype or undefined — render nothing; tile stays as terrain only.
          return null;
      }
    }

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
// Push 6: tilePos() removed.  All axial-to-pixel conversions now go through
// HexWorldCoords.axialToWorld(q, r) obtained from computeHexWorldCoords().
// See frontend/src/components/journey/hexWorldCoords.ts for the formula.

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
  tile:   HexMapTile;
  /**
   * Push 6: world coordinate system — replaces the former `sz`, `ox`, `oy`
   * scalar props.  Use `coords.axialToWorld(tile.q, tile.r)` for position and
   * `coords.sz` wherever the tile size in pixels is needed.
   */
  coords: HexWorldCoords;
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

function HexTile({ tile, coords, onPress, explorationCharacter, fogTheme }: HexTileProps) {
  const { sz } = coords;
  const pos = coords.axialToWorld(tile.q, tile.r);
  // Push 7: world-object node replaces flat encounter icon on the map.
  // node.sizeMul controls footprint; bottom of bounding box sits at ~88 % tile height.
  const node = encounterMapNode(tile);

  // Privacy: mask encounter type in DOM attributes for non-revealed tiles.
  const isRevealed = tile.current || tile.visibility === 'exploredButOutOfVision';

  // unexplored tiles are not interactive — players cannot select unseen territory.
  const isHidden   = !tile.current && tile.visibility === 'unexplored';
  const isVisible  = !tile.current && tile.visibility === 'visibleNow';
  const isExplored = !tile.current && tile.visibility === 'exploredButOutOfVision';

  // Push 11: terrain rendered at TERRAIN_SCALE × sz, centred on the tile.
  // Negative offset (terrainOff) shifts the image left/up so it is centred;
  // the Pressable's overflow:'visible' (s.tile) lets it bleed into adjacent
  // tiles' transparent-corner zones, visually joining the terrain field.
  const terrainSz  = Math.round(sz * TERRAIN_SCALE);
  const terrainOff = -Math.round((terrainSz - sz) / 2);

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
      // Push 10: style is a function so we can read pressed state for the
      // "selected" feedback treatment.  opacity drop makes the whole tile
      // (including transparent hex corners) dimmer — the beveled stone surface
      // reads as "touched" without needing a separate selected raster asset.
      style={({ pressed }) => [
        s.tile,
        { left: pos.left, top: pos.top, width: sz, height: sz, zIndex: tileZ },
        pressed && !isHidden && s.terrainPressed,
      ]}
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
      {/* ── Layer 0: 2.5D hex terrain base (Push 10 / Push 11 / Push 18) ──────
        * Painterly stone surface: jade-teal cracked stone, beveled lower face,
        * TRUE ALPHA transparency outside the hex silhouette.
        *
        * Push 11 — visual field unification:
        * The Image is rendered at TERRAIN_SCALE (115%) of sz, centred on the
        * tile (terrainOff = negative offset so left/top = -7.5% of sz).
        * This bleeds the stone surface beyond the tile bounding box into the
        * transparent-corner zones of neighbouring tiles, eliminating the
        * visible gaps that made each cell look like a separate floating platform.
        *
        * The Pressable has overflow:'visible' (s.tile) so the extra bleed
        * renders correctly on both web and native without clipping.
        *
        * ISO DEPTH: tileZ ensures the "closer" (lower-on-screen) tile paints
        * on top in every overlap region — correct 2.5D layering behaviour.
        *
        * Push 18 — memory dimming:
        * exploredButOutOfVision tiles render at MEMORY_TERRAIN_ALPHA (0.70)
        * so the stone surface is noticeably dimmer than visibleNow (1.0).
        * Combined with the hazeColor fill in Layer 2b, this creates the
        * "remembered but unlit" look without CSS filter (native-compatible).
        *
        * SVG state rings (Layers 1a / 2a / 2b) stay at 100% sz and appear
        * just inside the extended terrain hex silhouette, keeping cell
        * boundaries crisp while the stone surfaces read as one field. */}
      <Image
        source={TERRAIN_NORMAL}
        style={{
          position: 'absolute',
          left:    terrainOff,
          top:     terrainOff,
          width:   terrainSz,
          height:  terrainSz,
          opacity: isExplored ? MEMORY_TERRAIN_ALPHA : 1,
        }}
        contentFit="fill"
        recyclingKey={`terrain-${tile.id}`}
      />

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

      {/* ── Layer 2b: exploredButOutOfVision — memory haze + hairline ───────────
        *
        * Push 18: upgraded from hairline-only to a two-part treatment:
        *
        *   1. Memory haze fill — a very light shift-tinted SVG hex fill that
        *      sits over the dimmed terrain (Layer 0).  Together they produce:
        *        • "Slight dimming" — terrain at MEMORY_TERRAIN_ALPHA (0.70)
        *        • "Atmospheric haze" — hazeColor tint at hazeAlpha (0.22–0.32)
        *        • "Not heavy unexplored fog" — combined opacity is far lighter
        *          than the unexplored fog rect (0.82–0.95 in JourneyFogField)
        *
        *   2. Hairline ring — preserved exactly as before; marks the hex
        *      boundary and distinguishes explored from unexplored at a glance.
        *
        * visibleNow tiles (Layer 2a) have NO haze fill — the jade inner glow
        * makes them noticeably brighter than explored terrain.
        *
        * Encounter markers (Layer 3) render above this at MEMORY_NODE_ALPHA
        * so stationary encounters remain readable after discovery.
        *
        * FogTheme.hazeColor and hazeAlpha are shift-specific so the haze
        * always reads as part of the same atmospheric palette as the fog:
        *   night   — cool ink-blue  at 0.32 opacity
        *   day     — pale grey-blue at 0.22 opacity  (daylight is gentler)
        *   evening — muted indigo   at 0.28 opacity
        */}
      {isExplored && (
        <View style={[s.overlay, { pointerEvents: 'none' }]}>
          <Svg width={sz} height={sz}>
            {/* Memory haze fill — tints and further dims the explored terrain */}
            <Polygon
              points={hexPoints(sz, 0.97)}
              fill={fogTheme.hazeColor}
              fillOpacity={fogTheme.hazeAlpha}
              stroke="none"
            />
            {/* Hairline ring — boundary marker for visited territory */}
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
      {/* Push 9:  all encounter types shown on visibleNow AND exploredButOut-    */}
      {/* OfVision.  Battle shows the pedestal only (enemy hidden); areaBoss      */}
      {/* renders the actual boss sprite at 1.35 × sz (larger than player 1.15). */}
      {/* All nodes bottom-anchored at ~88 % tile height (the 2.5D hex floor).   */}
      {/*                                                                         */}
      {/* Push 18: exploredButOutOfVision nodes render at MEMORY_NODE_ALPHA       */}
      {/* (0.82) so known stationary encounters stay clearly readable after        */}
      {/* discovery — players should always be able to identify what they scouted. */}
      {/* visibleNow / current nodes stay at full opacity (1.0).                  */}
      {node !== null && (() => {
        const nodeSz = Math.round(sz * node.sizeMul);
        const nodeX  = Math.round((sz - nodeSz) / 2);
        // Bottom of bounding box anchored at 88 % tile height (the hex floor).
        const nodeY  = Math.round(sz * 0.88 - nodeSz);
        return (
          <Image
            source={node.src}
            style={[s.marker, {
              left:    nodeX,
              top:     nodeY,
              width:   nodeSz,
              height:  nodeSz,
              opacity: isExplored ? MEMORY_NODE_ALPHA : 1,
            }]}
            contentFit="contain"
            recyclingKey={`node-${tile.id}`}
          />
        );
      })()}

      {/* ── Layer 4a: jade ambient ground pool — all current-tile sprites ───── */}
      {/* Rendered BELOW the character sprite (painters order) so the character */}
      {/* appears to stand in a pool of magical teal light.                     */}
      {/* The sprites carry their own painted contact shadow in the art;         */}
      {/* this layer adds the ambient "inhabiting-the-world" magical presence.  */}
      {/*                                                                       */}
      {/* Push 19: condition broadened — jade glow now fires for both the class  */}
      {/* sprite (explorationCharacter) AND the default chibi explorer fallback  */}
      {/* (MAP_SPRITE_EXPLORER).  The old jade medallion path is retired here.   */}
      {tile.current && (
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

      {/* ── Layer 4b: player sprite — current tile only ───────────────────── */}
      {/* Push 6: sprite is sized at CHR_H_RATIO × sz so the character stands  */}
      {/* taller than the tile (2.5D camera angle).  The sprite's built-in     */}
      {/* painted shadow lands at ~84 % down the tile — the visual "floor".    */}
      {/*                                                                       */}
      {/* Push 19: the jade medallion token fallback is retired.  When no       */}
      {/* class_tree_id is set, MAP_SPRITE_EXPLORER (donghua chibi, teal-jade   */}
      {/* longcoat, black hair) is shown instead.  Both class sprites and the   */}
      {/* explorer default use the same CHR_* sizing so they sit identically.  */}
      {tile.current && (() => {
        const activeSprite = explorationCharacter ?? MAP_SPRITE_EXPLORER;
        const charW = Math.round(sz * CHR_W_RATIO);
        const charH = Math.round(sz * CHR_H_RATIO);
        const charX = Math.round((sz - charW) / 2);
        const charY = -Math.round(sz * CHR_Y_SHIFT);
        return (
          <Image
            source={activeSprite}
            style={[s.marker, { left: charX, top: charY, width: charW, height: charH }]}
            contentFit="contain"
            recyclingKey={`chr-${tile.id}`}
          />
        );
      })()}
    </Pressable>
  );
}

// ── JourneyFogLayer ───────────────────────────────────────────────────────────

/**
 * Push 13: all legacy block-based fog rendering removed.
 *
 * The previous implementation used:
 *   Web    — HTML <canvas> fillRect() covering worldW × worldH (rectangular
 *             solid base) then destination-out radial holes.  The fillRect was
 *             the source of the "white/square fog plane" artifact.
 *   Native — react-native-svg RadialGradient Circle blobs per unexplored tile.
 *             Adjacent blobs merged into rectangular-looking masses.
 *
 * Both paths are removed here.  The component returns null so the map renders
 * without any fog overlay.  Push 14 will introduce a new non-rectangular fog
 * implementation that carries no rectangular artifacts.
 *
 * State-ring SVGs in HexTile (current / visibleNow / exploredButOutOfVision)
 * are NOT fog — they are interactivity indicators and are preserved.
 */
interface JourneyFogLayerProps {
  tiles:    readonly HexMapTile[];
  coords:   HexWorldCoords;
  fogTheme: FogTheme;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function JourneyFogLayer(_props: JourneyFogLayerProps): null {
  // Push 13: legacy block fog removed; Push 14 will replace with new implementation.
  return null;
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

// ── Dev-only diagnostic types (exported for JourneyMapDiagnosticsPanel) ───────

/**
 * World-space metrics written by HexMapLayer to a caller-supplied ref once the
 * geometry is settled.  Production code must never read from this ref — it exists
 * solely to feed the development diagnostics panel.
 */
export interface HexMapWorldMetrics {
  /** Full rendered world width in px (same formula as worldW inside the component). */
  worldW:            number;
  /** Full rendered world height in px. */
  worldH:            number;
  /** Camera X at the moment the metrics were written (initial centre on load). */
  cameraX:           number;
  /** Camera Y at the moment the metrics were written. */
  cameraY:           number;
  /** Number of HexTile elements actually rendered (= tiles.length). */
  renderedTileCount: number;
  /** Resolved tile size in display pixels (sz). */
  tileSize:          number;
}

/**
 * Boolean flags that enable per-tile debug overlays.  All flags are false/absent
 * in production.  HexMapLayer guards every branch with `__DEV__`.
 */
export interface HexMapDevOverlay {
  /** Draw an outline + dimension label for the full world bounding box. */
  worldBounds?:      boolean;
  /** Draw an outline for the container viewport. */
  viewportBounds?:   boolean;
  /** Show each tile's string id above the hex. */
  tileIds?:          boolean;
  /** Show axial q,r coordinates inside each hex. */
  axialCoords?:      boolean;
  /** Mark the computed pixel centre of each tile with a dot. */
  tileCenters?:      boolean;
  /** Mark the encounter anchor point (bottom-centre of each tile). */
  encounterAnchors?: boolean;
  /** Show a colour-coded badge for each tile's visibility state. */
  visibilityState?:  boolean;
  /** Suppress fog rendering so tiles beneath are clearly visible. */
  fogLayer?:         boolean;
  /** Mark the sprite anchor point (grounding Y) for the current tile. */
  spriteAnchors?:    boolean;
}

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
   * Visual theme assets for the current chapter/shift.
   * Terrain floor images are no longer rendered per-tile (Push 2 — transparent
   * hex cells; painting is the terrain).  fogInterior was removed in Push 13
   * along with all block-based fog rendering.
   *
   * @deprecated All fields are currently unused by the tile renderer; the prop
   * is retained so call-sites don't need updating when Push 14 fog arrives.
   */
  tileVisuals?: Pick<import('@/src/game/journeyMap/chapterMapVisuals').ChapterShiftVisuals,
    'terrainCurrent' | 'terrainBase' | 'terrainFrontier'>;

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

  // ── Dev-only props (no-op in production) ────────────────────────────────

  /**
   * When provided, HexMapLayer writes world metrics (worldW/H, camera, sz,
   * rendered tile count) to this ref after geometry is settled.
   * Read it from the diagnostics panel — never in production code.
   */
  diagRef?: MutableRefObject<HexMapWorldMetrics | null>;

  /**
   * Push 7: world-space background painting.
   *
   * When provided, rendered as the FIRST child of MapWorld — the Animated.View
   * that receives the camera translate transform.  This makes the background
   * move in lockstep with terrain cells, Gate art, player sprite, encounter
   * objects, and fog: one world, one transform.
   *
   * source  — Expo Image require() source (same as ChapterShiftVisuals.background)
   * scale   — uniform zoom from the painting's own centre (default 1, no-op)
   * offsetX — post-scale horizontal shift in display pixels (default 0)
   * offsetY — post-scale vertical shift in display pixels (default 0)
   *
   * The image fills worldWidth × worldHeight with contentFit="cover"; the
   * viewport's overflow:"hidden" clips whatever extends beyond the screen edge.
   * When absent (loading / error / debug), MapWorld renders without a background.
   */
  environmentBackground?: {
    /** Same type accepted by expo-image's Image source prop: require() number or {uri} object. */
    source:   import('expo-image').ImageSource | number;
    scale?:   number;
    offsetX?: number;
    offsetY?: number;
  };

  /**
   * Per-tile debug overlays controlled by the diagnostics panel checkboxes.
   * Every branch is guarded by `__DEV__`; no overhead in production.
   */
  devOverlay?: HexMapDevOverlay;
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
  environmentBackground,
  diagRef,
  devOverlay,
}: HexMapLayerProps) {
  // ── Push 10: resolved shift fog/overlay theme ─────────────────────────────
  // Drives all SVG atmospheric colors: fog blobs, memory veil, frontier glow,
  // current-tile ring.  Defaults to 'night' when no shift is provided (fixture
  // mode / debug route) so the existing dark aesthetic is preserved as fallback.
  const fogTheme = FOG_THEMES[timeOfDay ?? 'night'];

  // ── Geometry — Push 6: unified world coordinate system ───────────────────
  // All tile positions (terrain, player, gate, fog holes, camera) are derived
  // from this single coords object.  No component may inline the formula.
  const coords = computeHexWorldCoords(tiles, containerWidth);
  const {
    sz,
    worldOriginX: ox,
    worldOriginY: oy,
    worldWidth:   worldW,
    worldHeight:  worldH,
  } = coords;

  // ── Persistent refs ─────────────────────────────────────────────────────────
  const boundsRef          = useRef({ minX: -9999, maxX: 9999, minY: -9999, maxY: 9999 });
  const initialCamRef      = useRef({ x: 0, y: 0 });
  const camRef             = useRef({ x: 0, y: 0 });
  const drag               = useRef({ moved: false, camX0: 0, camY0: 0 });
  //
  // Push 8: split the old single tilesKeyRef into two independent signals so
  // the camera can distinguish "new run loaded" from "player moved one tile":
  //   prevRunKeyRef    — mirrors tiles.length; changes only when a brand-new
  //                      run is loaded (tile count changes).
  //   prevPlayerKeyRef — mirrors currentTile.id; changes after each movement.
  // Container resize is tracked separately (prevContainerRef).
  const prevRunKeyRef      = useRef(0);
  const prevPlayerKeyRef   = useRef('');
  const prevContainerRef   = useRef({ w: 0, h: 0 });

  // ── Camera animation ──────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cameraAnim = useMemo(() => new Animated.ValueXY({ x: 0, y: 0 }), []);

  // Derived signals — stable strings that collapse into the two cases.
  const currentTile = tiles.find(t => t.current);
  const runKey      = tiles.length;                // new value = new run
  const playerKey   = currentTile?.id ?? '';       // new value = player moved
  const tilesKey    = `${runKey}:${playerKey}`;   // combined for Effect 2 dep

  // ── Effect 1: recompute camera bounds ────────────────────────────────────
  // Runs whenever the world geometry or container changes.
  // Must run BEFORE Effect 2 so the camera centering reads fresh bounds.
  //
  // Bounds design (Push 8):
  //   MARGIN ≈ 0.55 × sz  — about half a tile of "overscroll" in every direction.
  //   This is deliberately modest: large enough that every terrain edge can be
  //   brought to the middle of the viewport (the world already has built-in
  //   worldOriginX / worldOriginY padding), small enough that the painted
  //   background never fully leaves the viewport.
  //
  //   minX = min(-MARGIN, containerWidth  - worldW - MARGIN)
  //     → when worldW > containerWidth: allows panning all the way to the right edge
  //     → when worldW ≤ containerWidth: limits to ±MARGIN around origin (world fits)
  //   maxX = MARGIN  (overscroll left edge, symmetric)
  //   Same logic vertically with worldH / containerHeight.
  useLayoutEffect(() => {
    if (containerWidth < 10 || containerHeight < 10) return;
    const MARGIN = Math.round(sz * 0.55);
    boundsRef.current = {
      minX: Math.min(-MARGIN, containerWidth  - worldW - MARGIN),
      maxX: Math.max(0,        MARGIN),
      minY: Math.min(-MARGIN, containerHeight - worldH - MARGIN),
      maxY: Math.max(0,        MARGIN),
    };
  // worldW / worldH encode the tile set indirectly — they change when tiles change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerWidth, containerHeight, sz, worldW, worldH]);

  // ── Effect 2: position camera on load / player move / resize ─────────────
  // Three distinct camera behaviours (Push 8):
  //
  //   A. New run (runKey changed) or container resize
  //      → instant setValue — no animation; the map was just loaded or the
  //        viewport just changed size.  A spring here would show the world
  //        flying in from off-screen on every page open.
  //
  //   B. Player moved (playerKey changed, same run)
  //      → Animated.spring toward the new tile centre.  The camera gently
  //        follows the player so they always remain near the viewport centre
  //        without the jarring jump of setValue.  Respects reduce-motion.
  //
  // In both cases:
  //   • initialCamRef is updated so recenter() always targets the current player.
  //   • camRef is updated immediately (before animation) so stale-closure reads
  //     in the PanResponder see the correct destination, not the origin.
  useLayoutEffect(() => {
    if (containerWidth < 10 || containerHeight < 10) return;

    const isNewRun         = runKey    !== prevRunKeyRef.current;
    const playerMoved      = playerKey !== prevPlayerKeyRef.current;
    const containerChanged =
      containerWidth  !== prevContainerRef.current.w ||
      containerHeight !== prevContainerRef.current.h;

    if (!isNewRun && !playerMoved && !containerChanged) return;

    // Commit new prev values before any early returns below.
    prevRunKeyRef.current      = runKey;
    prevPlayerKeyRef.current   = playerKey;
    prevContainerRef.current   = { w: containerWidth, h: containerHeight };

    const targetTile = currentTile ?? tiles[0];
    if (!targetTile) return;

    const { cx: tileCx, cy: tileCy } = coords.axialToWorld(targetTile.q, targetTile.r);
    const { minX, maxX, minY, maxY } = boundsRef.current;

    const destX = clamp(containerWidth  / 2 - tileCx, minX, maxX);
    const destY = clamp(containerHeight / 2 - tileCy, minY, maxY);

    // Recenter always targets the current player tile.
    initialCamRef.current = { x: destX, y: destY };
    // camRef updated now so PanResponder reads destination, not flight-path value.
    camRef.current = { x: destX, y: destY };

    if (isNewRun || containerChanged) {
      // Case A — instant, no animation.
      cameraAnim.setValue({ x: destX, y: destY });
    } else {
      // Case B — ease camera toward the player's new tile after movement.
      AccessibilityInfo.isReduceMotionEnabled()
        .then(reduceMotion => {
          if (reduceMotion) {
            cameraAnim.setValue({ x: destX, y: destY });
          } else {
            Animated.spring(cameraAnim, {
              toValue:          { x: destX, y: destY },
              useNativeDriver:  false,
              friction:         8,
              tension:          100,
            }).start();
          }
        })
        .catch(() => {
          Animated.spring(cameraAnim, {
            toValue:         { x: destX, y: destY },
            useNativeDriver: false,
            friction:        8,
            tension:         100,
          }).start();
        });
    }

    // ── Dev diagnostics ──────────────────────────────────────────────────────
    // Production: diagRef is always undefined; tree-shakers eliminate this.
    if (__DEV__ && diagRef) {
      diagRef.current = {
        worldW,
        worldH,
        cameraX:           destX,
        cameraY:           destY,
        renderedTileCount: tiles.length,
        tileSize:          sz,
      };
    }
  // tilesKey = `${runKey}:${playerKey}` collapses both movement signals into one dep.
  // sz/containerWidth/containerHeight cover geometry changes.
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
        style={[
          s.world,
          {
            // Push 7: explicit world dimensions so the background image fills
            // exactly the same canvas as terrain, fog, and gate elements.
            width:  worldW,
            height: worldH,
            transform: cameraAnim.getTranslateTransform(),
          },
        ]}
      >
        {/* ── Push 7: Chapter environment background ────────────────────────
          * First child of MapWorld: paints beneath all terrain cells, encounter
          * objects, gate art, player sprite, and fog.
          *
          * This is the fix for "stationary background + moving grid" bug:
          * background is now INSIDE the Animated.View that receives
          * cameraAnim.getTranslateTransform(), so it moves in lockstep with
          * every other world-space element.
          *
          * The image fills worldW × worldH (same canvas as the tile grid).
          * overflow:"hidden" on the viewport View clips the edges.
          * The scale/offsetX/offsetY transform is forwarded verbatim from
          * ChapterShiftVisuals — these were the per-chapter alignment tuning
          * values and remain valid in world space.
          *
          * Not rendered during loading / error (environmentBackground absent).
          */}
        {environmentBackground && (
          <Image
            source={environmentBackground.source}
            style={[
              StyleSheet.absoluteFillObject,
              {
                transform: [
                  { scale:      environmentBackground.scale   ?? 1 },
                  { translateX: environmentBackground.offsetX ?? 0 },
                  { translateY: environmentBackground.offsetY ?? 0 },
                ],
              },
            ]}
            contentFit="cover"
            testID="map-background"
          />
        )}

        {/* ── Complete terrain — ALL tiles, no visibility filter (Push 5) ─────
          * Every tile in the `tiles` prop is mounted into MapWorld for the
          * full lifetime of the run.  Do NOT gate this map on visibility,
          * encounter type, fog state, or whether a tile is inside the camera
          * viewport.  Filtering here would:
          *   • Leave permanent fog patches over missing tile positions (fog
          *     carves reveal-holes at tile centres — absent tiles = no hole)
          *   • Break BFS adjacency and the movement/encounter eligibility graph
          *   • Remove disabled Pressables that are still accessibility targets
          *
          * Fog visibility → JourneyFogLayer (canvas/SVG overlay, below)
          * Camera panning → PanResponder + Animated.ValueXY (this file)
          * Neither deletes terrain from MapWorld.
          */}
        {sorted.map(tile => (
          <HexTile
            key={tile.id}
            tile={tile}
            coords={coords}
            onPress={handleTilePress}
            explorationCharacter={explorationCharacter}
            fogTheme={fogTheme}
          />
        ))}

        {/* ── Push 16: JourneyFogField — continuous atmospheric fog overlay ─
         *
         * Replaces the null-stubbed JourneyFogLayer (Push 13) with the Push 15
         * raster fog bank assets, composed as a world-space field.
         *
         * The field renders at zIndex 5000:
         *   above  unexplored tile Pressables (z 1–3000)
         *   below  exploredButOutOfVision tiles (z 5050+)
         *   below  visibleNow / current tiles (z 5100+ / 9999)
         *
         * Fog bank opacity is attenuated near visible tile centres (code-driven
         * clearing influence).  An SVG overlay adds a very-low-opacity radial
         * clearing hint at each visibleNow / current centre.
         *
         * Falls back to 'night' palette when timeOfDay is not yet resolved
         * (dev / test render paths without a shift).
         */}
        <JourneyFogField
          tiles={tiles}
          coords={coords}
          timeOfDay={timeOfDay ?? 'night'}
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
          const { left, top } = coords.axialToWorld(gateTile.q, gateTile.r);
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

        {/* ── Dev per-tile overlays (Push 0 — __DEV__ only) ────────────────
         * Rendered as a second pass over `sorted` so overlay text/dots always
         * appear above every tile Pressable (zIndex 19000 keeps them above the
         * fog SVG at 5000 but below the diagnostics panel at 19999).
         * Every branch is wrapped in `__DEV__` — no runtime cost in production.
         */}
        {__DEV__ && devOverlay && sorted.map(tile => {
          // Push 6: dev overlay uses the same authoritative axialToWorld as production renderers.
          const { left: px, top: py } = coords.axialToWorld(tile.q, tile.r);
          const mid  = Math.round(sz / 2);
          const vis  = tile.visibility;
          const visColor =
            vis === 'visibleNow'            ? '#4ade80' :
            vis === 'exploredButOutOfVision' ? '#facc15' : '#94a3b8';

          return (
            <View
              key={`dev-${tile.id}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left:     px,
                top:      py,
                width:    sz,
                height:   sz,
                zIndex:   19000,
              }}
            >
              {/* Tile ID */}
              {devOverlay.tileIds && (
                <Text style={{
                  position:   'absolute',
                  top:        2,
                  left:       2,
                  right:      2,
                  color:      '#ffffff',
                  fontSize:   7,
                  fontWeight: '700',
                  textShadowColor: '#000',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                  textAlign:  'center',
                }}>
                  {tile.id.slice(-6)}
                </Text>
              )}

              {/* Axial q,r */}
              {devOverlay.axialCoords && (
                <Text style={{
                  position:   'absolute',
                  bottom:     2,
                  left:       2,
                  right:      2,
                  color:      '#93c5fd',
                  fontSize:   7,
                  fontWeight: '600',
                  textShadowColor: '#000',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                  textAlign:  'center',
                }}>
                  {tile.q},{tile.r}
                </Text>
              )}

              {/* Tile centre dot */}
              {devOverlay.tileCenters && (
                <View style={{
                  position:        'absolute',
                  left:            mid - 2,
                  top:             mid - 2,
                  width:           4,
                  height:          4,
                  borderRadius:    2,
                  backgroundColor: '#ffffff88',
                }} />
              )}

              {/* Encounter anchor (bottom-centre of tile, 2.5D floor grounding) */}
              {devOverlay.encounterAnchors && (tile.encounter !== 'none' || tile.isGate) && (
                <View style={{
                  position:        'absolute',
                  left:            mid - 3,
                  top:             Math.round(sz * 0.78) - 3,
                  width:           6,
                  height:          6,
                  borderRadius:    3,
                  backgroundColor: tile.isGate ? '#fbbf24' : '#f472b6',
                  borderWidth:     1,
                  borderColor:     '#ffffff88',
                }} />
              )}

              {/* Sprite anchor (character grounding Y on current tile) */}
              {devOverlay.spriteAnchors && tile.current && (
                <View style={{
                  position:        'absolute',
                  left:            mid - 4,
                  top:             Math.round(sz * 0.655) - 2,
                  width:           8,
                  height:          4,
                  backgroundColor: '#34d399CC',
                  borderRadius:    2,
                }} />
              )}

              {/* Visibility state badge */}
              {devOverlay.visibilityState && (
                <View style={{
                  position:        'absolute',
                  top:             mid - 7,
                  left:            mid - 7,
                  width:           14,
                  height:          14,
                  borderRadius:    7,
                  backgroundColor: visColor + '99',
                  borderWidth:     1,
                  borderColor:     visColor,
                }} />
              )}
            </View>
          );
        })}

        {/* World bounding-box outline */}
        {__DEV__ && devOverlay?.worldBounds && (
          <View
            pointerEvents="none"
            style={{
              position:    'absolute',
              left:        0,
              top:         0,
              width:       worldW,
              height:      worldH,
              borderWidth: 2,
              borderColor: '#f472b688',
              zIndex:      19500,
            }}
          >
            <Text style={{
              color:      '#f472b8',
              fontSize:    8,
              fontWeight: '700',
              padding:     3,
            }}>
              {worldW}×{worldH}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Viewport bounding-box outline */}
      {__DEV__ && devOverlay?.viewportBounds && (
        <View
          pointerEvents="none"
          style={{
            position:    'absolute',
            left:        0,
            top:         0,
            width:       containerWidth,
            height:      containerHeight,
            borderWidth: 2,
            borderColor: '#34d39988',
            zIndex:      19600,
          }}
        >
          <Text style={{
            color:     '#34d399',
            fontSize:   8,
            fontWeight: '700',
            padding:    3,
          }}>
            VP {containerWidth}×{containerHeight}
          </Text>
        </View>
      )}

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
  // Push 10: pressed / selected feedback — applied to the whole Pressable so
  // the beveled stone surface dims uniformly.  Brief opacity drop (1 → 0.72)
  // reads as a tactile "tap" confirmation without needing a separate raster asset.
  terrainPressed: { opacity: 0.72 },
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
