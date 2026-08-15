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
 * PUSH 4 (fog) — Canvas-based layered fog renderer (no per-tile fog blocks)
 * ──────────────────────────────────────────────────────────────────────────
 * • TILE_BASE.hidden and per-tile fog textures removed entirely.
 * • Fog is four world-space canvas layers (FogBase/Mid/Edge/Wisp).
 *   All layers live ABOVE world content (player, encounters, 3000–4900).
 *   FogBase (5000) is the primary concealment layer.  Gate (5100) rises above
 *   it.  FogMid/Edge/Wisp (5200–5400) veil the upper atmosphere above the gate.
 * • Concealment uses canvas destination-in compositing — NOT SVG <Mask>
 *   (react-native-svg's web backend has no Mask class).
 * • unexplored tiles hidden by opaque fog canvas; no z-poke-through needed.
 * • visibleNow / exploredButOutOfVision → transparent fog holes reveal terrain.
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
  useState,
  type MutableRefObject,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, Polygon, RadialGradient, Stop } from 'react-native-svg';

import { buildFogMaskCacheKey, drawFogMaskDev } from '@/src/game/journeyMap/fog/fogMask';
import {
  type FogVisibilityState,
  fogVisibilityFromTileState,
  getFogVisibilityState,
  getEffectiveVisionRadius,
  DEFAULT_PLAYER_VISION_STATS,
} from '@/src/game/journeyMap/fog/fogVision';
import { FogBaseLayer }     from './FogBaseLayer';
import { FogMidLayer }      from './FogMidLayer';
import { FogEdgeLayer }     from './FogEdgeLayer';
import { FogWispLayer }     from './FogWispLayer';
import { FogDevDiagnostic } from './FogDevDiagnostic';
import { JOURNEY_Z }    from './journeyZ';
import { type HexMapTile, JOURNEY_MAP_FIXTURE } from '@/src/game/journeyMap/fixture';
import { UI, SERIF } from '@/src/theme/ui';
import {
  Q_STEP, R_STEP, Q_VOFF,
  MIN_TILE_SZ, MAX_TILE_SZ,
  computeHexWorldCoords,
  type HexWorldCoords,
} from './hexWorldCoords';

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
//  isometric depth.  Push 21: sorts correctly via OBJECT_BASE + worldY*DEPTH —
//  no special-case zIndex needed.)
//
// The jade glow ellipse (Layer 4a) is centred at the feet position and widens
// slightly beyond the sprite footprint for a magical ambient halo effect.
const CHR_W_RATIO          = 1.38;   // Push 2: 1.15 → 1.38 (+20%) for mobile readability
const CHR_H_RATIO          = 1.38;   // Push 2: 1.15 → 1.38 (+20%) — square bounding box
// CHR_Y_SHIFT: keeps feet anchored at the same tile position after the scale-up.
// Feet land at sz×(CHR_H_RATIO−CHR_Y_SHIFT).  Target = 0.77×sz (unchanged from Push 19).
// Old: 1.15−0.38 = 0.77 ✓   New: 1.38−0.61 = 0.77 ✓
const CHR_Y_SHIFT          = 0.61;   // Push 2: 0.38 → 0.61 (compensates for taller sprite)
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

// ── z-layer bases (see journeyZ.ts for the full canonical table) ──────────────
//
// TERRAIN pass  (HexTile Pressable — terrain image, state rings, contact shadow)
//   z = JOURNEY_Z.TERRAIN_BASE (100) + worldY × TERRAIN_DEPTH (10)
//   worldY range for authored maps: roughly 0–30 → terrain z 100–400.
//   Unexplored disabled Pressables: capped below TERRAIN_BASE (≤ 99)
//   so they never intercept taps on revealed tiles above them.
//
// WORLD CONTENT pass  (HexObjectLayer — encounter nodes, jade glow, player)
//   z = JOURNEY_Z.WORLD_CONTENT_BASE (3000) + worldY × OBJECT_DEPTH (10)
//   Clamped to JOURNEY_Z.WORLD_CONTENT_MAX (4900) — world objects sort by
//   worldY for 2.5D depth but never escape above FogBase (5000).
//
// GATE  → JOURNEY_Z.GATE (5100)
//   Above FogBase (5000): gate landmark rises through the base fog mass.
//   Below FogMid/Edge/Wisp (5200–5400): still veiled by upper atmospheric layers.
//
// DEPTH = 10 — one z-unit per 0.1 worldY step; consistent across TERRAIN and
// WORLD CONTENT passes so a southern terrain tile never rises above its objects.
const TERRAIN_BASE  = JOURNEY_Z.TERRAIN_BASE;         // 100
const TERRAIN_DEPTH = 10;
const OBJECT_BASE   = JOURNEY_Z.WORLD_CONTENT_BASE;   // 3000
const OBJECT_DEPTH  = 10;
const GATE_ART_Z    = JOURNEY_Z.GATE;                 // 5100
const CHR_SHADOW_CY    = CHR_GLOW_CY;            // same floor as jade glow (0.65 × sz)
const CHR_SHADOW_RX    = CHR_GLOW_RX + 0.07;     // wider than glow (0.43 × sz) — Push 8
const CHR_SHADOW_RY    = 0.075;                  // slightly taller than node shadow

// ── Raster assets ─────────────────────────────────────────────────────────────
// Push 4:  fog is a world-space SVG layer; terrainCurrent (jade glow) still used.
// Push 7:  MAP_NODE (world-object PNGs) replaces ENCOUNTER_ICON on the map surface.
//          ENCOUNTER_ICON is retained for legend panels and MerchantModal UI.
// Push A:  Layer 0 standalone terrain PNG removed.  The environmentBackground
//          painting inside MapWorld is the floor; hex cells are a movement-grid
//          overlay on that environment, not standalone slabs.
//          TERRAIN_NORMAL / TERRAIN_SCALE / MEMORY_TERRAIN_ALPHA removed.
//          MEMORY_NODE_ALPHA retained — encounter nodes still dim on memory tiles.

// ── Push 18: memory state opacity constants ───────────────────────────────────
// MEMORY_NODE_ALPHA — encounter-node image opacity for explored tiles.
//   Stays at 0.82 so known stationary encounters remain clearly visible
//   after discovery.  Players should always be able to read the encounter
//   type they previously scouted.
const MEMORY_NODE_ALPHA = 0.82;

// Push 6 fallback — jade medallion token.  Still referenced below as the
// legacy medallion; replaced in Layer 4a/4b by MAP_SPRITE_EXPLORER (Push 19).
const PLAYER_TOKEN = require('@/assets/ui/journey/map/player-map-token.webp') as number;

// Push 19: generic exploration sprite used when the player has no class yet.
// Replaces the jade medallion token so the current tile always shows a
// painterly donghua chibi character rather than a UI ornament.
// Art spec: 2.5–3-head-tall chibi, teal-jade longcoat, black hair, soft
// cel-painted rendering, transparent bg, painted contact shadow at feet.
//
// Push (Task 719): replaced with per-direction source map below.
// MAP_SPRITE_EXPLORER retained as the face_e canonical reference only.
const MAP_SPRITE_EXPLORER = require('@/assets/map-sprites/map_sprite_explorer.png') as number;

// ── Directional idle facing for the exploration hero ─────────────────────────
//
// The hex grid uses flat-top axial (q,r). Every valid move is one of exactly
// 6 neighbor vectors; we map that delta to a named facing so the sprite can
// show a dedicated directional frame instead of a mirrored copy.
//
// Task 719: 6 unique frames ship for the generic explorer sprite.
// Each FacingDir has its own source PNG — no scaleX mirroring needed for the
// explorer.  Class sprites fall back to the mirror approach (scaleX:-1 for
// westward facings) until per-class 6-frame art is authored.
export type FacingDir = 'face_e' | 'face_w' | 'face_ne' | 'face_nw' | 'face_se' | 'face_sw';

const EXPLORER_FACING_SPRITES: Record<FacingDir, number> = {
  face_e:  require('@/assets/map-sprites/map_sprite_explorer_face_e.png')  as number,
  face_w:  require('@/assets/map-sprites/map_sprite_explorer_face_w.png')  as number,
  face_ne: require('@/assets/map-sprites/map_sprite_explorer_face_ne.png') as number,
  face_nw: require('@/assets/map-sprites/map_sprite_explorer_face_nw.png') as number,
  face_se: require('@/assets/map-sprites/map_sprite_explorer_face_se.png') as number,
  face_sw: require('@/assets/map-sprites/map_sprite_explorer_face_sw.png') as number,
};
/** Resolve an axial move delta (dq, dr) to one of the 6 hex facings. */
export function hexFacingFromDelta(dq: number, dr: number): FacingDir {
  if (dq ===  1 && dr ===  0) return 'face_e';
  if (dq === -1 && dr ===  0) return 'face_w';
  if (dq ===  1 && dr === -1) return 'face_ne';
  if (dq === -1 && dr ===  1) return 'face_sw';
  if (dq ===  0 && dr ===  1) return 'face_se';
  if (dq ===  0 && dr === -1) return 'face_nw';
  return 'face_e'; // non-neighbour delta — keep current facing
}

/**
 * scaleX for a facing: used ONLY for class sprites that don't yet have
 * dedicated 6-frame art.  Native art faces right; leftward facings mirror.
 * Explorer sprite uses EXPLORER_FACING_SPRITES instead — no scaleX needed.
 */
function facingScaleX(f: FacingDir): 1 | -1 {
  return (f === 'face_w' || f === 'face_nw' || f === 'face_sw') ? -1 : 1;
}

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
 * HexTile carries only interaction target, state border/glow, and encounter anchor.
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
// Push 2: fogState parameter replaces direct tile.visibility comparison so that
// encounter-privacy is always derived from the central getFogVisibilityState()
// resolver rather than scattered string checks.
function encounterMapNode(tile: HexMapTile, fogState: FogVisibilityState): EncounterMapNode | null {
  // Only truly unexplored tiles suppress world objects.
  // visibleNow, explored, and current all render their encounter.
  if (!tile.current && fogState === 'unexplored') return null;

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
// Push 2: fogState replaces direct tile.visibility comparisons so all a11y
// text is routed through the central getFogVisibilityState() resolver.
function a11yLabel(tile: HexMapTile, fogState: FogVisibilityState): string {
  if (tile.current) return 'Current position';
  if (tile.isGate && fogState === 'explored') return 'Chapter Boss Gate';
  if (fogState === 'unexplored') return 'Unexplored tile';

  // Push 9: all encounter types are disclosed once a tile is visibleNow or
  // explored — the world object is visible, so the label matches it.
  if (tile.encounter !== 'none' && tile.encounter !== 'boss') {
    const prefix = fogState === 'visibleNow' ? 'Nearby' : 'Tile';
    const enc =
      tile.encounter === 'areaBoss' ? 'Area Boss'
    : tile.encounter === 'treasure' ? `Treasure (${tile.chestTier ?? 'bronze'})`
    : tile.encounter === 'merchant' ? 'Merchant'
    : 'Battle';
    return `${prefix} — ${enc}`;
  }

  if (fogState === 'visibleNow') return 'Nearby tile, not yet explored';
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
   * Per-shift SVG color theme — drives state border/glow colors (veil hairline,
   * frontier jade rim, current-tile ring).  Resolved by HexMapLayer from the
   * active `timeOfDay`; individual tiles never inspect shift state themselves.
   * Atmospheric fog is rendered by a separate overlay, not HexTile.
   */
  fogTheme: FogTheme;
  /**
   * Push 23: shift-specific terrain tile image from getChapterMapVisuals().
   * Used in Layer 0 for every tile state — SVG rings/glows above it handle
   * state differentiation, so one image covers base/frontier/current.
   * When absent: falls back to TERRAIN_NORMAL (canonical night stone).
   */
  terrainSrc?: number;
  /**
   * Push 2: pre-computed fog visibility state from getFogVisibilityState().
   * HexTile must NOT read tile.visibility directly — all fog-state decisions
   * must go through the central resolver in fogVision.ts.
   */
  fogState: FogVisibilityState;
}

// Push 21: explorationCharacter removed from HexTile — it is now consumed by
// HexObjectLayer (the object-pass renderer).  HexTile handles terrain + rings
// + contact shadow only; it never renders sprites directly.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function HexTile({ tile, coords, onPress, fogTheme, terrainSrc: _terrainSrc, fogState }: HexTileProps) {
  const { sz } = coords;
  const pos = coords.axialToWorld(tile.q, tile.r);
  // Push 7: world-object node replaces flat encounter icon on the map.
  // node.sizeMul controls footprint; bottom of bounding box sits at ~88 % tile height.
  // Push 2: fogState comes from the central getFogVisibilityState() resolver.
  const node = encounterMapNode(tile, fogState);

  // Privacy: mask encounter type in DOM attributes for non-revealed tiles.
  // Push 2: derived from the central fogState, not tile.visibility directly.
  const isRevealed = tile.current || fogState === 'explored';

  // unexplored tiles are not interactive — players cannot select unseen territory.
  const isHidden   = !tile.current && fogState === 'unexplored';
  const isVisible  = !tile.current && fogState === 'visibleNow';
  const isExplored = !tile.current && fogState === 'explored';

  // Push A: terrainSz / terrainOff removed — Layer 0 standalone terrain PNG
  // is gone.  The environmentBackground inside MapWorld is the floor; hex cells
  // are a movement-grid overlay on that environment, not standalone slabs.

  // Push 21: unified terrain z for all non-unexplored tiles.
  //
  // All revealed tiles (exploredButOutOfVision, visibleNow, current) now share
  // TERRAIN_BASE as their stratum.  worldY offset keeps southern tiles in front
  // of northern ones within the terrain pass.  The old 9999 sentinel for the
  // current tile is removed — the player sprite now lives in HexObjectLayer at
  // OBJECT_BASE + worldY * OBJECT_DEPTH, above all terrain, and sorts correctly
  // against encounter nodes on adjacent tiles.
  //
  // Strata (Push 21):
  //   FogBase (5000) and above   fog layers + gate — see journeyZ.ts
  //   OBJECT_BASE + worldY*DEPTH  3000–4900   HexObjectLayer (nodes + player)
  //   TERRAIN_BASE + worldY*DEPTH  100–400    HexTile Pressables (revealed)
  //   unexplored (capped ≤ 99)    10–99       disabled Pressables, below terrain
  //   See: /assets/dev-reference/fog_system_design_reference.png
  const worldY = tile.r + tile.q * 0.5;
  // Unexplored: capped strictly below TERRAIN_BASE so they never z-intercept
  // taps on revealed tiles above them (they're invisible under fog anyway).
  // Push 2: use fogState (from the central resolver) for the z-index branch.
  const tileZ  =
    fogState === 'unexplored' && !tile.current
      ? Math.min(JOURNEY_Z.TERRAIN_BASE - 1, Math.round(worldY * 3) + 10)
      : TERRAIN_BASE + Math.round(worldY * TERRAIN_DEPTH);

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
      accessibilityLabel={a11yLabel(tile, fogState)}
      {...webData({
        'data-tile-id':    tile.id,
        'data-q':          String(tile.q),
        'data-r':          String(tile.r),
        'data-visibility': tile.current ? 'current' : fogState,
        'data-encounter':  isRevealed ? tile.encounter : 'unknown',
      })}
    >
      {/* ── Layer 0 (Push A): floor-presence tint — movement cell, not slab ───
        *
        * The old standalone terrain PNG (beveled 2.5D stone slab) is removed.
        * The environmentBackground painting inside MapWorld is the terrain floor.
        * Hex cells are a movement-grid overlay on that environment.
        *
        * This layer adds a very subtle SVG hex fill (~8 % opacity) for all
        * revealed tiles so cells read as "walkable steps" against the painted
        * background without any slab or puzzle-piece border.
        *
        *   current              → brighter tint (12 %) — "you are here"
        *   visibleNow           → standard tint (8 %) — reachable step
        *   exploredButOutOfVision → dim tint (6 %) — memory of a trodden path
        *   unexplored           → no tint (covered by fog above)
        *
        * The fill colour is drawn from the shift's frontierStroke palette so
        * the ground glow is always tonally consistent with the fog and rings.
        * Inset to 0.98 so the fill sits cleanly inside the ring strokes above.
        */}
      {!isHidden && (
        <View style={[s.overlay, { pointerEvents: 'none' }]}>
          <Svg width={sz} height={sz}>
            <Polygon
              points={hexPoints(sz, 0.98)}
              fill={fogTheme.frontierStroke}
              fillOpacity={tile.current ? 0.12 : isVisible ? 0.08 : 0.06}
              stroke="none"
            />
          </Svg>
        </View>
      )}

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

      {/* ── Layer 1b: unexplored tile — no per-tile images ────────────────── */}
      {/* The tile Pressable stays (disabled=true → non-interactive) as an    */}
      {/* accessibility target and BFS graph node.                             */}

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

      {/* ── Layers 3, 4a, 4b MOVED to HexObjectLayer (Push 21) ───────────────
        * Encounter node sprites, jade ground glow, and player sprite now live
        * in the OBJECT pass (z OBJECT_BASE + worldY*DEPTH), above all terrain.
        * This keeps HexTile as a pure terrain + interaction + shadow element.  */}
    </Pressable>
  );
}

// ── HexObjectLayer ────────────────────────────────────────────────────────────
//
// WORLD CONTENT pass — renders encounter node sprites, jade ground pool, and
// the player sprite below the fog layers.
//
// Architecture:
//   • Each tile with an encounter node OR the current (player) tile gets an
//     absolutely-positioned View at that tile's world coordinates.
//   • zIndex = OBJECT_BASE + round(worldY × OBJECT_DEPTH), clamped to
//     JOURNEY_Z.WORLD_CONTENT_MAX (4900) so no object escapes above FogBase (5000).
//     Southern tiles paint above northern ones within the content pass.
//   • Fog (FogBase 5000+) conceals objects on unexplored tiles via canvas
//     transparency — no special-case z-poke-through needed here.
//   • The View is pointerEvents="none" — all taps fall through to terrain.
//   • overflow="visible" lets large sprites (areaBoss ×1.35) extend beyond
//     the sz×sz bounding box without being clipped.
//
// Layer order within each object View (DOM painters order):
//   1. Jade glow Svg (if current tile) — BELOW player sprite
//   2. Encounter node Image — anchored at 88% tile height
//   3. Player sprite Image (if current tile) — ABOVE jade glow

interface HexObjectLayerProps {
  tiles:                readonly HexMapTile[];
  coords:               HexWorldCoords;
  explorationCharacter?: number;
  /** Last movement direction — drives sprite mirror + idle bob facing. Default 'face_e'. */
  playerFacing?:         FacingDir;
  /** True while the player is traversing to a new tile — switches to walk animation. */
  isMoving?:             boolean;
  /**
   * Task 720: tile ID the hero just stepped off.
   * HexObjectLayer renders a brief dust-puff SVG centred on that tile,
   * fading from full opacity to transparent over ~360 ms.
   * Cleared by the parent after ~420 ms so the View is unmounted cleanly.
   */
  dustTileId?:           string;
}

function HexObjectLayer({
  tiles,
  coords,
  explorationCharacter,
  playerFacing = 'face_e',
  isMoving = false,
  dustTileId,
}: HexObjectLayerProps) {
  const { sz } = coords;

  // ── Walk / idle animation ─────────────────────────────────────────────────
  //
  // Two Animated.Values drive the step cycle:
  //   bobAnim  — vertical translation (Y axis)
  //   swayAnim — lateral translation (X axis)
  //
  // Idle  : gentle ±3 px bob, 950 ms half-cycle, sway = 0
  // Moving: quick ±5 px bob + ±3 px lateral sway, 180 ms half-cycle
  //         (≈ 2.8 steps/s — premium JRPG exploration pace)
  //
  // Both run on the native driver (transform only); no layout re-measure.
  const bobAnim  = useRef(new Animated.Value(0)).current;
  const swayAnim = useRef(new Animated.Value(0)).current;

  // ── Task 720: step-dust trail ─────────────────────────────────────────────
  //
  // dustAnim drives the opacity of a radial SVG dust puff rendered on the tile
  // the hero just stepped off.  When dustTileId changes to a non-null value the
  // animation runs once: snap to 1 → ease-out fade to 0 over ~360 ms.
  // The parent clears dustTileId after ~420 ms so the overlay View is unmounted.
  // useNativeDriver:true — opacity-only animation, no layout cost.
  const dustAnim       = useRef(new Animated.Value(0)).current;
  const prevDustTileId = useRef<string | undefined>(undefined);

  // ── Task 721: tile-to-tile position tween ────────────────────────────────
  //
  // tweenAnim is an offset (translateX, translateY) applied to the wrapper
  // Animated.View that contains ONLY the jade glow + player sprite.
  //
  // On each move the current tile's View jumps to the new world coords
  // (pos.left / pos.top).  To make the sprite appear to glide rather than
  // snap, we:
  //   1. Compute delta = oldPos − newPos  (both in world space).
  //   2. Immediately set tweenAnim to that delta so the sprite visually starts
  //      at the OLD screen position.
  //   3. Ease tweenAnim back to (0, 0) over 220 ms — the sprite slides to its
  //      true destination.
  //
  // This runs purely on the native driver (transform only) and does not
  // interact with the camera spring or tile zIndex ordering.
  const tweenAnim            = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const prevCurrentTileIdRef  = useRef<string | undefined>(undefined);
  const prevCurrentTilePosRef = useRef<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (dustTileId && dustTileId !== prevDustTileId.current) {
      prevDustTileId.current = dustTileId;
      dustAnim.setValue(1);
      Animated.timing(dustAnim, {
        toValue:         0,
        duration:        360,
        useNativeDriver: true,
        easing:          Easing.out(Easing.quad),
      }).start();
    }
    // dustAnim is a stable ref value — intentional omission from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dustTileId]);

  // Task 721: fire the position tween whenever the current tile changes.
  //
  // IMPORTANT: this MUST be useLayoutEffect (not useEffect).
  //
  // On web, useEffect fires *after* the browser has painted the committed frame.
  // That means if we used useEffect:
  //   1. React commits the new tile View at (left: newLeft, top: newTop) with
  //      tweenAnim at {x:0, y:0} — the sprite renders at the destination.
  //   2. useEffect fires, we setValue({x: dx, y: dy}) — sprite jumps back.
  //   3. Animated.timing runs forward — sprite slides to destination.
  //   Net result: snap TO destination, then snap BACK, then glide — worse than
  //   the original teleport.
  //
  // useLayoutEffect fires synchronously after React's DOM mutations but BEFORE
  // the browser paints, so the delta is committed to tweenAnim before the first
  // visual frame — the sprite starts at the old position and only ever moves
  // forward to the new one.  This is the same timing the camera spring uses.
  //
  // We derive the current tile id and world coords outside the effect so the
  // effect dep is a primitive (string | undefined), stable across renders that
  // don't involve a tile change.
  const currentTile    = tiles.find(t => t.current);
  const currentTileId  = currentTile?.id;
  const currentTilePos = currentTile ? coords.axialToWorld(currentTile.q, currentTile.r) : null;

  useLayoutEffect(() => {
    if (!currentTileId || !currentTilePos) return;

    const prev     = prevCurrentTileIdRef.current;
    const prevPos  = prevCurrentTilePosRef.current;

    if (prev && prev !== currentTileId && prevPos) {
      // Tile changed — snap offset to delta then ease back to origin.
      const dx = prevPos.left - currentTilePos.left;
      const dy = prevPos.top  - currentTilePos.top;
      tweenAnim.setValue({ x: dx, y: dy });
      Animated.timing(tweenAnim, {
        toValue:         { x: 0, y: 0 },
        duration:        220,
        useNativeDriver: true,
        easing:          Easing.out(Easing.quad),
      }).start();
    } else {
      // First render or same tile — ensure offset is at rest with no animation.
      tweenAnim.stopAnimation();
      tweenAnim.setValue({ x: 0, y: 0 });
    }

    prevCurrentTileIdRef.current  = currentTileId;
    prevCurrentTilePosRef.current = { left: currentTilePos.left, top: currentTilePos.top };
    // tweenAnim, prevCurrentTileIdRef, prevCurrentTilePosRef are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTileId]);

  useEffect(() => {
    bobAnim.stopAnimation();
    swayAnim.stopAnimation();

    if (isMoving) {
      // Walk mode: two parallel loops — fast bob + lateral step sway.
      const bobLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(bobAnim,  { toValue: -5, duration: 180, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          Animated.timing(bobAnim,  { toValue:  0, duration: 180, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        ]),
      );
      const swayLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(swayAnim, { toValue:  3, duration: 180, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          Animated.timing(swayAnim, { toValue: -3, duration: 180, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        ]),
      );
      bobLoop.start();
      swayLoop.start();
      return () => { bobLoop.stop(); swayLoop.stop(); };
    }

    // Idle mode: slow gentle bob, sway snaps to rest.
    swayAnim.setValue(0);
    const idleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: -3, duration: 950, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(bobAnim, { toValue:  0, duration: 950, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]),
    );
    idleLoop.start();
    return () => idleLoop.stop();
  }, [isMoving, bobAnim, swayAnim]);

  // Class sprites don't yet have 6-frame art → mirror leftward facings.
  // Explorer uses EXPLORER_FACING_SPRITES per-direction — no scaleX needed.
  const classScaleX = facingScaleX(playerFacing);

  // Push 2: build the canonical fog-state sets once per render so that all
  // encounter-privacy, opacity, and a11y decisions inside this component
  // consistently use getFogVisibilityState() instead of tile.visibility checks.
  const { visibleNowIds: objVisibleNowIds, exploredIds: objExploredIds } = useMemo(() => {
    const visibleNowIds = new Set<string>();
    const exploredIds   = new Set<string>();
    for (const t of tiles) {
      const fs = fogVisibilityFromTileState(t.visibility, t.current);
      if (fs === 'visibleNow') visibleNowIds.add(t.id);
      else if (fs === 'explored') exploredIds.add(t.id);
    }
    return { visibleNowIds, exploredIds };
  }, [tiles]);

  return (
    <>
      {tiles.map(tile => {
        // Push 2: derive fog state from the central resolver so encounter
        // visibility is never gated by a scattered tile.visibility comparison.
        const fogState   = getFogVisibilityState(tile.id, objVisibleNowIds, objExploredIds);
        const node       = encounterMapNode(tile, fogState);
        const hasCurrent = tile.current;
        const hasDust    = tile.id === dustTileId;
        if (!node && !hasCurrent && !hasDust) return null;

        const pos      = coords.axialToWorld(tile.q, tile.r);
        const worldY   = tile.r + tile.q * 0.5;
        const objectZ  = Math.min(
          JOURNEY_Z.WORLD_CONTENT_MAX,
          OBJECT_BASE + Math.round(worldY * OBJECT_DEPTH),
        );
        // Push 2: derived from the central fog state, not tile.visibility.
        const isExplored = !tile.current && fogState === 'explored';
        // Unique glow gradient id — only one current tile exists at a time but
        // SVG ids are document-global on web so we namespace per tile anyway.
        const glowId = `chr-gnd-${tile.id}`;

        return (
          <View
            key={`obj-${tile.id}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left:     pos.left,
              top:      pos.top,
              width:    sz,
              height:   sz,
              zIndex:   objectZ,
              overflow: 'visible',
            }}
          >
            {/* Layer 3: encounter world-object sprite.
              * Bottom of bounding box anchored at ~88 % tile height (the hex floor).
              * Push 18: exploredButOutOfVision nodes at MEMORY_NODE_ALPHA (0.82).
              * NOT inside the tween wrapper — encounter nodes stay anchored to
              * the destination tile; only the hero sprite glides across.        */}
            {node !== null && (() => {
              const nodeSz = Math.round(sz * node.sizeMul);
              const nodeX  = Math.round((sz - nodeSz) / 2);
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

            {/* Layer 4c: Task 720 — step-dust departure puff.
              * Renders on the tile the hero just vacated (hasDust && !hasCurrent).
              * A radial SVG ellipse centred at the sprite's foot position
              * (sz × 0.65) fades from opacity 1 → 0 over ~360 ms via dustAnim.
              * Does NOT affect tile state, fog logic, or movement validation.
              * NOT inside the tween wrapper — dust stays at the departure tile. */}
            {hasDust && !hasCurrent && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left:  0, top: 0,
                  width: sz, height: sz,
                  opacity: dustAnim,
                }}
              >
                <Svg width={sz} height={sz}>
                  <Defs>
                    <RadialGradient
                      id={`dust-${tile.id}`}
                      cx={sz / 2}
                      cy={sz * 0.65}
                      r={sz * 0.34}
                      fx={sz / 2}
                      fy={sz * 0.65}
                      gradientUnits="userSpaceOnUse"
                    >
                      <Stop offset="0%"   stopColor="rgba(230,218,170,1)" stopOpacity={0.72} />
                      <Stop offset="55%"  stopColor="rgba(210,198,145,1)" stopOpacity={0.30} />
                      <Stop offset="100%" stopColor="rgba(190,178,120,1)" stopOpacity={0}    />
                    </RadialGradient>
                  </Defs>
                  {/* Horizontal dust ellipse — wide footprint, flat profile */}
                  <Ellipse
                    cx={sz / 2}
                    cy={sz * 0.65}
                    rx={sz * 0.36}
                    ry={sz * 0.13}
                    fill={`url(#dust-${tile.id})`}
                  />
                </Svg>
              </Animated.View>
            )}

            {/* Task 721: tween wrapper — jade glow (Layer 4a) + player sprite (Layer 4b).
              * Applies a translateX/Y offset that starts at (oldTilePos − newTilePos)
              * and eases to (0, 0) over 220 ms so the sprite glides between tiles
              * instead of teleporting.  The encounter node and dust puff are
              * intentionally outside this wrapper so they stay tile-anchored.   */}
            {hasCurrent && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left:     0,
                  top:      0,
                  width:    sz,
                  height:   sz,
                  overflow: 'visible',
                  transform: [
                    { translateX: tweenAnim.x },
                    { translateY: tweenAnim.y },
                  ],
                }}
              >
                {/* Layer 4a: jade ambient ground pool.
                  * Renders BELOW the player sprite (DOM paint order).
                  * Dark contact shadow is drawn first (SVG painters order) so the
                  * jade glow gradient sits on top — grounded but magical.        */}
                <Svg
                  width={sz}
                  height={sz}
                  style={{ position: 'absolute', left: 0, top: 0 }}
                >
                  <Defs>
                    <RadialGradient
                      id={glowId}
                      cx={sz / 2}  cy={sz * CHR_GLOW_CY}
                      r={sz * CHR_GLOW_RX}
                      fx={sz / 2}  fy={sz * CHR_GLOW_CY}
                      gradientUnits="userSpaceOnUse"
                    >
                      <Stop offset="0%"   stopColor={CHR_GLOW_COLOR} stopOpacity={CHR_GLOW_OPACITY} />
                      <Stop offset="55%"  stopColor={CHR_GLOW_COLOR} stopOpacity={CHR_GLOW_OPACITY * 0.30} />
                      <Stop offset="100%" stopColor={CHR_GLOW_COLOR} stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  {/* Contact shadow — below jade glow (SVG painters order) */}
                  <Ellipse
                    cx={sz / 2}        cy={sz * CHR_SHADOW_CY}
                    rx={sz * CHR_SHADOW_RX} ry={sz * CHR_SHADOW_RY}
                    fill={SHADOW_COLOR}
                  />
                  {/* Jade ambient glow — above shadow */}
                  <Ellipse
                    cx={sz / 2}        cy={sz * CHR_GLOW_CY}
                    rx={sz * CHR_GLOW_RX} ry={sz * CHR_GLOW_RY}
                    fill={`url(#${glowId})`}
                  />
                </Svg>

                {/* Layer 4b: player sprite.
                  * Task 719: Explorer uses EXPLORER_FACING_SPRITES[playerFacing] — a
                  * dedicated directional frame for each of the 6 hex directions.
                  * No scaleX mirroring is needed for the explorer.
                  * Class sprites (explorationCharacter set) fall back to the mirror
                  * approach (classScaleX) until 6-frame class art is authored.
                  * Idle       : slow ±3 px bob, sway = 0.
                  * Walk (isMoving): fast ±5 px bob + ±3 px lateral sway (step cycle).
                  * Renders ABOVE jade glow (DOM paint order).                   */}
                {(() => {
                  const activeSprite = explorationCharacter
                    ? explorationCharacter
                    : EXPLORER_FACING_SPRITES[playerFacing];
                  const spriteScaleX = explorationCharacter ? classScaleX : 1;
                  const charW = Math.round(sz * CHR_W_RATIO);
                  const charH = Math.round(sz * CHR_H_RATIO);
                  const charX = Math.round((sz - charW) / 2);
                  const charY = -Math.round(sz * CHR_Y_SHIFT);
                  return (
                    <Animated.View
                      style={[s.marker, {
                        left:      charX,
                        top:       charY,
                        width:     charW,
                        height:    charH,
                        transform: [{ scaleX: spriteScaleX }, { translateY: bobAnim }, { translateX: swayAnim }],
                      }]}
                    >
                      <Image
                        source={activeSprite}
                        style={{ width: charW, height: charH }}
                        contentFit="contain"
                        recyclingKey={`chr-${tile.id}`}
                      />
                    </Animated.View>
                  );
                })()}
              </Animated.View>
            )}
          </View>
        );
      })}
    </>
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
  /** Mark the sprite anchor point (grounding Y) for the current tile. */
  spriteAnchors?:    boolean;
  /**
   * DEV ONLY — fog visibility debug tint.
   * Push 2: overlays a full-tile semi-transparent colour per FogVisibility tier:
   *   VISIBLE_NOW → green  (#4ade80 @ 35 %)
   *   EXPLORED    → yellow (#facc15 @ 35 %)
   *   UNEXPLORED  → red    (#ef4444 @ 35 %)
   * MUST NOT ship — gate all render paths with __DEV__.
   */
  fogDebug?:         boolean;
  /**
   * DEV ONLY — world-space fog visibility mask canvas (Push 3 / Layer 1).
   * Renders the raw mask as a semi-transparent white-on-clear overlay inside
   * MapWorld so you can verify the organic clearing shape before fog art is added.
   * Web only — uses HTML5 Canvas 2D.  No-op on native.
   * MUST NOT ship — gated with __DEV__.
   */
  fogMask?:          boolean;
  /**
   * DEV ONLY — playable-bounds visualiser.
   * Renders four layers inside MapWorld:
   *   GOLD  — full world canvas outline (the base map image boundary)
   *   CYAN  — playable-bounds rectangle (map inset by hexOuterRadius × 0.75)
   *   GREEN — per-tile border: hex body fits inside playable bounds ✓
   *   RED   — per-tile border: hex body extends outside playable bounds ✗
   * A stats label shows total terrain cells and out-of-bounds count.
   * A console.warn fires in __DEV__ for every out-of-bounds tile regardless
   * of whether the overlay flag is enabled, so CI surfaces the problem early.
   * MUST NOT ship — gated with __DEV__.
   */
  playableBounds?:   boolean;
}

/**
 * Gate artwork rendered as a spatial overlay anchored to the gate tile.
 * pointerEvents="none" lets taps fall through to the underlying tile Pressable,
 * so gate interaction remains associated with the gateTileId.
 */
export interface GateArtProps {
  /** Source for the locked state (< keysRequired keys). */
  lockedSrc:    number;
  /** Source for the unlocked state (≥ keysRequired keys). */
  unlockedSrc:  number;
  /** Whether the key requirement has been met. */
  unlocked:     boolean;
  /**
   * Keys already accumulated (chapter-level; persists across attempts).
   * Displayed as a progress badge on the gate landmark: "X/N LOCKED" or "UNLOCKED".
   */
  keysCollected: number;
  /**
   * Keys required to open the gate (always CHAPTER_BOSS_KEY_REQUIREMENT = 3).
   * Passed explicitly so HexMapLayer has no dependency on the game constant.
   */
  keysRequired:  number;
  /**
   * Push 22: the exact gate anchor tile ID from the chapter map template
   * (run.gateAnchorTileId).  When provided the gate landmark is positioned by
   * ID lookup rather than the isGate flag, guaranteeing alignment with the
   * template-fixed cell even when tile ordering changes.
   */
  gateTileId?:  string;
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
   * Only the terrain subset consumed by tile rendering is used here;
   * the `background` field is consumed by the parent screen.
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
   * Task 719 semantics — callers MUST follow this contract:
   *
   *   Set to a class-specific sprite token (MAP_SPRITE.guardian, .seer, etc.)
   *   only when the player has an authored class sprite that differs from the
   *   generic explorer.  In that case HexObjectLayer renders the sprite with a
   *   scaleX mirror for westward facings (fallback until 6-frame class art ships).
   *
   *   Leave UNDEFINED when:
   *     • Player data is not yet loaded.
   *     • The resolved avatar would be MAP_SPRITE.explorer (pre-class or era
   *       default that hasn't been overridden by a class variant yet).
   *   In the undefined case HexObjectLayer selects from EXPLORER_FACING_SPRITES
   *   keyed by playerFacing — the 6 unique directional frames, no mirroring.
   */
  explorationCharacter?: number;

  /**
   * Last movement direction for the exploration hero.
   * Drives left/right sprite mirroring so the character faces where it just
   * walked, and holds that direction while standing idle.
   * Defaults to 'face_e' (native art orientation) when omitted.
   */
  playerFacing?: FacingDir;

  /**
   * True while the player is actively traversing to a new tile.
   * Switches the exploration sprite from slow idle bob to the faster
   * walk step cycle (quick bob + lateral sway).  Returns to idle
   * automatically when set back to false.
   */
  isMoving?: boolean;

  /**
   * Task 720: tile ID the hero just stepped off.
   * HexObjectLayer renders a brief dust-puff SVG on that tile,
   * fading from opacity 1 → 0 over ~360 ms.
   * Pass the `fromTile.id` captured in fog-map.tsx at move start;
   * clear to undefined after ~420 ms (the animation will have completed).
   */
  dustTileId?: string;

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
   * Push 23: shift-resolved terrain tile image from getChapterMapVisuals().
   * Forwarded to every HexTile as `terrainSrc`.  Uses ChapterShiftVisuals
   * .terrainTexture — a single stone per shift that all 30 terrain cells share.
   * When absent (fixture / test routes without a resolved shift): HexTile
   * falls back to TERRAIN_NORMAL (canonical night-theme jade-teal stone).
   */
  terrainTexture?: number;

  /**
   * JourneyRun.seed — drives deterministic fog instance placement in
   * FogBaseLayer (Push 4).  Same seed = same fog layout every time the run
   * is loaded.  When absent (fixture / debug routes) a fixed fallback is used.
   */
  runSeed?: string;

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
  playerFacing,
  isMoving,
  dustTileId,
  terrainTexture,
  environmentBackground,
  runSeed,
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
    worldWidth:  worldW,
    worldHeight: worldH,
  } = coords;

  // ── Persistent refs ─────────────────────────────────────────────────────────
  const boundsRef          = useRef({ minX: -9999, maxX: 9999, minY: -9999, maxY: 9999 });
  const initialCamRef      = useRef({ x: 0, y: 0 });
  const camRef             = useRef({ x: 0, y: 0 });
  const drag               = useRef({ moved: false, camX0: 0, camY0: 0 });

  // ── Push 3: fog mask canvas refs (dev only, web only) ─────────────────────
  // fogContainerRef: the world-space View that holds the imperative canvas.
  // fogCanvasRef:    the <canvas> element appended inside that container.
  // fogMaskKeyRef:   last-drawn cache key — skip redraw if inputs unchanged.
  const fogContainerRef = useRef<View>(null);
  const fogCanvasRef    = useRef<HTMLCanvasElement | null>(null);
  const fogMaskKeyRef   = useRef<string>('');

  // ── DEV: per-layer visibility toggles ────────────────────────────────────
  // Allow isolating individual fog layers to identify compositing bugs.
  // Use sequence: A=Base only → B=+Mid → C=+Edge → D=All to pinpoint issues.
  // Always unconditional useState — __DEV__ gates only the toggle UI.
  const [devFogBase,  setDevFogBase]  = useState(true);
  const [devFogMid,   setDevFogMid]   = useState(true);
  const [devFogEdge,  setDevFogEdge]  = useState(true);
  const [devFogWisp,  setDevFogWisp]  = useState(true);
  const [devFogMaskOn, setDevFogMaskOn] = useState(false);
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
  // Bounds design — base map image is the authoritative world boundary:
  //
  //   Camera translation (cx, cy) positions MapWorld's top-left at viewport
  //   pixel (cx, cy).  The Chapter background image fills worldW × worldH
  //   exactly.  The viewport must never expose any area outside that image.
  //
  //   Derivation per axis (X shown; Y is symmetric):
  //
  //     MapWorld left  edge in viewport = cx
  //     MapWorld right edge in viewport = cx + worldW
  //
  //     Constraints:
  //       cx ≤ 0                         MapWorld left  ≤ viewport left
  //       cx ≥ containerWidth − worldW   MapWorld right ≥ viewport right
  //
  //     → maxX = 0
  //     → minX = containerWidth − worldW
  //
  //   When the world is SMALLER than the viewport on an axis (tiny map):
  //     do not pan on that axis; center the map instead.
  //     → minX = maxX = round((containerWidth − worldW) / 2)
  //
  //   SPRITE_PAD, fog canvas padding, Gate sprite, and area-boss dimensions
  //   do NOT expand camera bounds.  All world objects must be positioned
  //   inside the painted base map; they do not define the camera limits.
  //   Manual pan (PanResponder) and recenter both read from boundsRef so
  //   they automatically apply the same clamp — no separate handling needed.
  useLayoutEffect(() => {
    if (containerWidth < 10 || containerHeight < 10) return;

    // X axis — center map if it fits entirely in the viewport width.
    const fitsW    = worldW < containerWidth;
    const halfExtraW = Math.round((containerWidth  - worldW) / 2);

    // Y axis — center map if it fits entirely in the viewport height.
    const fitsH    = worldH < containerHeight;
    const halfExtraH = Math.round((containerHeight - worldH) / 2);

    boundsRef.current = {
      minX: fitsW ? halfExtraW : Math.round(containerWidth  - worldW),
      maxX: fitsW ? halfExtraW : 0,
      minY: fitsH ? halfExtraH : Math.round(containerHeight - worldH),
      maxY: fitsH ? halfExtraH : 0,
    };
  }, [containerWidth, containerHeight, worldW, worldH]);

  // ── Effect: DEV playable-bounds validation ────────────────────────────────
  // Runs in __DEV__ whenever tile geometry settles.  Warns to the console if
  // any tile's rendered hex body extends outside the safe playable margin
  // (map canvas inset by hexOuterRadius × 0.75 on every side).
  //
  // The check uses the same hex half-extents as the overlay visualiser:
  //   hexR      = (sz/2) × 0.89   — outer radius of the inset hex (inset=0.89)
  //   halfWidth = round(hexR)      — horizontal half-extent
  //   halfHeight = round(hexR × √3/2)  — vertical half-extent
  //   margin    = round(hexR × 0.75)   — safe inset from world edge
  //
  // This never throws or blocks — it is a developer signal only.
  useLayoutEffect(() => {
    if (!__DEV__ || tiles.length === 0 || worldW < 10 || worldH < 10) return;
    const hexR   = (sz / 2) * 0.89;
    const margin = Math.round(hexR * 0.75);
    const halfW  = Math.round(hexR);
    const halfH  = Math.round(hexR * 0.866);
    const pb     = { left: margin, top: margin, right: worldW - margin, bottom: worldH - margin };
    const oob    = tiles.filter(tile => {
      const { cx, cy } = coords.axialToWorld(tile.q, tile.r);
      return cx - halfW < pb.left || cx + halfW > pb.right ||
             cy - halfH < pb.top  || cy + halfH > pb.bottom;
    });
    if (oob.length > 0) {
      console.warn(
        `[HexMapLayer] ${oob.length}/${tiles.length} tile(s) extend outside ` +
        `playable bounds (margin=${margin}px sz=${sz}px worldW=${worldW}px worldH=${worldH}px): ` +
        oob.map(t => t.id).join(', '),
      );
    }
  // coords is derived from tiles + containerWidth; tiles in deps covers both.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldW, worldH, sz, tiles]);

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

  // ── Push 3: fog mask canvas — lifecycle (dev only, web only) ──────────────
  // Effect A: create the imperative <canvas> when the toggle turns on;
  //           destroy it when the toggle turns off or the component unmounts.
  //           Camera pan does NOT touch these deps — no redraw on pan.
  useEffect(() => {
    const showMask = __DEV__ && (devFogMaskOn || !!devOverlay?.fogMask);
    if (!showMask || Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;

    const container = fogContainerRef.current as unknown as HTMLDivElement | null;
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;opacity:0.82;';
    container.appendChild(canvas);
    fogCanvasRef.current  = canvas;
    fogMaskKeyRef.current = ''; // force a draw on first attach

    return () => {
      canvas.remove();
      fogCanvasRef.current  = null;
      fogMaskKeyRef.current = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devFogMaskOn, devOverlay?.fogMask]);

  // ── Push 3: fog mask canvas — redraw when visibility inputs change ─────────
  // Effect B: runs whenever tiles / world dimensions / sz change.
  //           Uses buildFogMaskCacheKey to skip redraws when inputs are unchanged.
  //           Camera translation is NOT in these deps (pan = no redraw).
  useEffect(() => {
    const showMask = __DEV__ && (devFogMaskOn || !!devOverlay?.fogMask);
    if (!showMask || Platform.OS !== 'web') return;
    const canvas = fogCanvasRef.current;
    if (!canvas) return;

    // Build tile centers and classify visibility from current tile state
    const tileCenters  = new Map<string, { cx: number; cy: number }>();
    const visibleNowIds = new Set<string>();
    const exploredIds   = new Set<string>();

    for (const tile of tiles) {
      const { left, top } = coords.axialToWorld(tile.q, tile.r);
      tileCenters.set(tile.id, { cx: left + sz / 2, cy: top + sz / 2 });
      // Push 2: use the central bridge helper — consistent with all other layers.
      const fs = fogVisibilityFromTileState(tile.visibility, tile.current);
      if (fs === 'visibleNow') visibleNowIds.add(tile.id);
      else if (fs === 'explored') exploredIds.add(tile.id);
    }

    // Skip redraw if nothing changed (e.g. cosmetic re-render with same state).
    // Push 3: buildFogMaskCacheKey now includes world dimensions + runId so
    // viewport resizes correctly force regeneration (Push 3 cache bug fix).
    const fov     = getEffectiveVisionRadius(DEFAULT_PLAYER_VISION_STATS);
    // Use the run seed embedded in the tile data as the run identifier.
    // HexMapLayer doesn't receive runSeed directly — derive a stable id from
    // tile count + first tile id so different runs produce different keys.
    const devRunId = tiles.length > 0 ? (tiles[0]?.id ?? '') : '';
    const nextKey  = buildFogMaskCacheKey({
      runId:                  devRunId,
      worldWidth:             worldW,
      worldHeight:            worldH,
      tileSize:               sz,
      effectiveFieldOfVision: fov,
      visibleNowIds,
      exploredIds,
    });
    if (nextKey === fogMaskKeyRef.current) return;
    fogMaskKeyRef.current = nextKey;

    // drawFogMaskDev shows the three-state grayscale (dark/mid/light) so the
    // organic reveal shape is visible without running the full fog sprite pipeline.
    // This function must never be used in production rendering.
    drawFogMaskDev(canvas, {
      worldWidth:             worldW,
      worldHeight:            worldH,
      sz,
      tileCenters,
      visibleNowIds,
      exploredIds,
      effectiveFieldOfVision: fov,
    });
  // coords.axialToWorld is a pure function derived from tiles + containerWidth;
  // including coords would cause spurious redraws — sz + tiles are sufficient.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devFogMaskOn, devOverlay?.fogMask, tiles, worldW, worldH, sz]);

  // ── Render order: iso-depth sort for TERRAIN PASS ────────────────────────────
  // Push 13: tighter spacing means tiles from adjacent staggered columns now
  // visually overlap. Sorting by r alone was correct when only same-column rows
  // overlapped; with the new constants, diagonal neighbours (q, r) vs
  // (q+1, r−1) also overlap in screen space.
  //
  // Iso-depth for flat-top axial: screen_y ∝ r × R_STEP + q × Q_VOFF
  //   = (r + q × 0.5) × R_STEP   [since Q_VOFF = R_STEP/2]
  // Sorting by (r + q × 0.5) correctly orders ALL overlapping pairs.
  //
  // Push 21: current tile is no longer painted last to assert z=9999 supremacy;
  // tileZ uses TERRAIN_BASE + worldY*TERRAIN_DEPTH for all revealed tiles.
  // Putting current tile last in DOM order is still a useful belt-and-suspenders
  // tie-breaker if two tiles land at the exact same tileZ (unlikely in practice).
  // The player sprite lives in HexObjectLayer and sorts independently.
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

  // ── DEV: precompute playable bounds for overlay rendering ─────────────────
  // Evaluated once per render when the flag is enabled; null in production or
  // when the flag is off.  Both the per-tile border pass and the world-space
  // rectangle block reference this object so the formula runs only once.
  const devPlayableBounds = (__DEV__ && !!devOverlay?.playableBounds && worldW >= 10 && worldH >= 10)
    ? (() => {
        const hexR   = (sz / 2) * 0.89;
        const margin = Math.round(hexR * 0.75);
        const halfW  = Math.round(hexR);
        const halfH  = Math.round(hexR * 0.866);
        const left   = margin;
        const top    = margin;
        const right  = worldW - margin;
        const bottom = worldH - margin;
        const oobCount = tiles.filter(tile => {
          const { cx, cy } = coords.axialToWorld(tile.q, tile.r);
          return cx - halfW < left || cx + halfW > right ||
                 cy - halfH < top  || cy + halfH > bottom;
        }).length;
        return { left, top, right, bottom, halfW, halfH, oobCount };
      })()
    : null;

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

        {/* ── TERRAIN PASS: Pressable + state rings + contact shadow ─────────
          * All tiles mounted for the full run lifetime — never filter by
          * visibility, encounter type, or fog state.  Filtering would break
          * BFS adjacency and leave permanent fog patches.
          * z JOURNEY_Z.TERRAIN_BASE (100) + worldY×TERRAIN_DEPTH for all
          * revealed tiles; unexplored disabled Pressables capped ≤ 99 so
          * they never intercept taps on revealed tiles.
          * HexTile renders terrain rings + contact shadow only.           */}
        {sorted.map(tile => (
          <HexTile
            key={tile.id}
            tile={tile}
            coords={coords}
            onPress={handleTilePress}
            fogTheme={fogTheme}
            terrainSrc={terrainTexture}
            fogState={fogVisibilityFromTileState(tile.visibility, tile.current)}
          />
        ))}

        {/* ── WORLD CONTENT PASS: encounter nodes + jade glow + player ─────────
          * z JOURNEY_Z.WORLD_CONTENT_BASE (3000) + worldY×OBJECT_DEPTH,
          * clamped to JOURNEY_Z.WORLD_CONTENT_MAX (4900).
          * Always below FogBase (5000) — fog physically conceals objects on
          * unexplored tiles via canvas transparency, not z-poke-through.
          * pointerEvents="none" — all taps fall through to terrain Pressables.
          * Large sprites (areaBoss ×1.35) depth-sort among all world objects. */}
        <HexObjectLayer
          tiles={tiles}
          coords={coords}
          explorationCharacter={explorationCharacter}
          playerFacing={playerFacing}
          isMoving={isMoving}
          dustTileId={dustTileId}
        />

        {/* ── FogBaseLayer — primary concealment (JOURNEY_Z.FOG_BASE = 5000) ──
          * Canvas blanket covering terrain (100–400) and world content
          * (3000–4900).  destination-in compositing punches transparent holes
          * at visibleNow / exploredButOutOfVision tile centres so terrain and
          * objects show through without z-poke-through.
          * Web only — native = null stub.  Camera pan does not trigger redraw.
          * __DEV__: toggle controlled by devFogBase state (diagnostic panel). */}
        {(!__DEV__ || devFogBase) && (
          <FogBaseLayer
            tiles={tiles}
            coords={coords}
            worldWidth={worldW}
            worldHeight={worldH}
            runSeed={runSeed ?? 'fixture-default'}
          />
        )}

        {/* ── Gate art overlay (JOURNEY_Z.GATE = 5100) ────────────────────────
         * Push 22: spatially anchored to the template-fixed gate tile inside
         * the world viewport.  The gate is a true map landmark:
         *
         *   Z-INDEX
         *   • 5100 — above FogBase (5000): landmark rises through the base fog.
         *     Below FogMid/Edge/Wisp (5200–5400): upper atmospheric layers
         *     still veil it with mist, giving a partially-obscured epic feel.
         *
         *   POSITIONING
         *   • Primary lookup: tiles.find(t => t.id === gateArt.gateTileId)
         *     uses the exact run.gateAnchorTileId so the landmark always sits
         *     on the cell the template reserved for the gate.
         *   • Fallback: tiles.find(t => t.isGate) for callers that do not yet
         *     pass gateTileId (dev fixture, tests).
         *
         *   FOG PARTICIPATION
         *   • Gate is not rendered while the tile is 'unexplored'.
         *   • Gate renders at reduced opacity for 'exploredButOutOfVision'
         *     (memory state) — the player knows it's there but can't see details.
         *   • Full-opacity render for 'visibleNow' and 'current'.
         *
         *   WORLD INTEGRATION
         *   • Overlay lives inside the Animated.View world container →
         *     pans and scales exactly with terrain, fog, and player sprite.
         *   • Overlay is 1.8 × sz → visually extends beyond the hex cell to
         *     read as a landmark without creating fake interactive tiles.
         *   • pointerEvents="none" → all taps reach the underlying HexTile.
         *
         *   PROGRESS BADGE
         *   • A badge below the gate image shows the current key count:
         *       0/3  LOCKED  |  1/3  LOCKED  |  2/3  LOCKED  |  3/3  UNLOCKED
         *   • Gate is ALWAYS locked until exactly 3 chapter-level keys are
         *     accumulated.  No auto-unlock for zero-boss-map runs.
         */}
        {gateArt && (() => {
          // Push 22: prefer explicit gateTileId; fall back to isGate flag.
          const gateTile = gateArt.gateTileId
            ? (tiles.find(t => t.id === gateArt.gateTileId) ?? tiles.find(t => t.isGate))
            : tiles.find(t => t.isGate);

          // Push 2: derive gate fog state from the central resolver so that
          // gate visibility and opacity decisions are never direct tile.visibility
          // comparisons — they go through getFogVisibilityState() instead.
          const gateFogState = gateTile
            ? fogVisibilityFromTileState(gateTile.visibility, gateTile.current)
            : 'unexplored' as const;
          if (!gateTile || gateFogState === 'unexplored') return null;

          const { left, top } = coords.axialToWorld(gateTile.q, gateTile.r);

          // Overlay is 1.3 × sz — prominent landmark with minimal bleed into
          // neighbouring cells so the player token is never hidden by gate art.
          const overlaySize = Math.round(sz * 1.3);
          const offset      = Math.round((overlaySize - sz) / 2);

          // Explored (out of vision): render at MEMORY_NODE_ALPHA so the
          // player knows the gate position without seeing the current lock state.
          const gateOpacity = gateFogState === 'explored'
            ? MEMORY_NODE_ALPHA
            : 1;

          // Progress badge dimensions — scaled to tile size for legibility
          // across the range of map sizes (small phones → large tablets).
          const badgeH   = Math.round(sz * 0.28);
          const badgePad = Math.round(sz * 0.06);
          const badgeFsz = Math.max(9, Math.round(sz * 0.12));

          const keyLabel     = `${gateArt.keysCollected}/${gateArt.keysRequired}`;
          const stateLabel   = gateArt.unlocked ? 'UNLOCKED' : 'LOCKED';
          // Jade teal for unlocked; amber for locked — matches the Ink & Mist palette.
          const badgeBg      = gateArt.unlocked ? 'rgba(20,180,140,0.92)' : 'rgba(20,12,40,0.82)';
          const badgeBorder  = gateArt.unlocked ? '#14b48c' : '#7c5cad';
          const keyColor     = gateArt.unlocked ? '#fff'    : '#f5c842';
          const stateColor   = gateArt.unlocked ? '#c8fff0' : '#c4b5d8';

          return (
            <View
              key="gate-art-overlay"
              pointerEvents="none"
              style={{
                position: 'absolute',
                left:     left  - offset,
                top:      top   - offset,
                width:    overlaySize,
                // Extra height to accommodate the badge below the gate image.
                height:   overlaySize + badgeH + badgePad,
                zIndex:   GATE_ART_Z,
                opacity:  gateOpacity,
                alignItems: 'center',
              }}
            >
              {/* Gate image — locked or unlocked art */}
              <Image
                source={gateArt.unlocked ? gateArt.unlockedSrc : gateArt.lockedSrc}
                style={{ width: overlaySize, height: overlaySize }}
                contentFit="contain"
                testID="boss-gate-art"
              />

              {/* Progress badge — "X/N  LOCKED" or "UNLOCKED"
                * Rendered as an absolutely-positioned pill below the gate image.
                * Not rendered in the memory state (gate is vague enough already). */}
              {gateFogState !== 'explored' && (
                <View
                  style={{
                    marginTop:       badgePad,
                    paddingHorizontal: badgePad * 2,
                    paddingVertical:  Math.round(badgePad * 0.6),
                    backgroundColor: badgeBg,
                    borderRadius:    badgeH / 2,
                    borderWidth:     1,
                    borderColor:     badgeBorder,
                    flexDirection:   'row',
                    alignItems:      'center',
                    gap:             Math.round(sz * 0.06),
                  }}
                >
                  <Text style={{
                    fontFamily:  SERIF,
                    fontSize:    badgeFsz,
                    fontWeight:  '700',
                    color:       keyColor,
                    letterSpacing: 0.5,
                  }}>
                    {keyLabel}
                  </Text>
                  <Text style={{
                    fontFamily:  SERIF,
                    fontSize:    badgeFsz * 0.85,
                    fontWeight:  '600',
                    color:       stateColor,
                    letterSpacing: 1,
                  }}>
                    {stateLabel}
                  </Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* ── FogMidLayer — atmospheric detail (JOURNEY_Z.FOG_MID = 5200) ─────
          * Above Gate (5100) — upper mist veils the gate landmark.
          * Atmospheric texture at 0.50 opacity; NO foundation fill (Base only).
          * Web only — native = null stub.
          * __DEV__: toggle controlled by devFogMid state (diagnostic panel). */}
        {(!__DEV__ || devFogMid) && (
          <FogMidLayer
            tiles={tiles}
            coords={coords}
            worldWidth={worldW}
            worldHeight={worldH}
            runSeed={runSeed ?? 'fixture-default'}
          />
        )}

        {/* ── FogEdgeLayer — reveal boundary (JOURNEY_Z.FOG_EDGE = 5300) ───────
          * Sparse edge sprites at the visibleNow / fog boundary only.
          * Organic wispy tendrils — no full-world cover draw.
          * Web only — native = null stub.
          * __DEV__: toggle controlled by devFogEdge state (diagnostic panel). */}
        {(!__DEV__ || devFogEdge) && (
          <FogEdgeLayer
            tiles={tiles}
            coords={coords}
            worldWidth={worldW}
            worldHeight={worldH}
            runSeed={runSeed ?? 'fixture-default'}
          />
        )}

        {/* ── FogWispLayer — topmost mist (JOURNEY_Z.FOG_WISP = 5400) ─────────
          * Sparse wisp instances outside the VISIBLE_NOW exclusion zone.
          * Self-managing placement — no destination-in mask, no world fill.
          * Web only — native = null stub.
          * __DEV__: toggle controlled by devFogWisp state (diagnostic panel). */}
        {(!__DEV__ || devFogWisp) && (
          <FogWispLayer
            tiles={tiles}
            coords={coords}
            worldWidth={worldW}
            worldHeight={worldH}
            runSeed={runSeed ?? 'fixture-default'}
          />
        )}

        {/* ── FogDevDiagnostic — __DEV__ only (z 19999) ───────────────────────
          * Reports layer dimensions + tile counts in a top-right panel.
          * Also provides Base/Mid/Edge/Wisp/Mask toggle buttons for the
          * A → B → C → D compositing isolation test.
          * Acceptance: all five layers show identical W × H @ 0,0;
          * "Visible Now: 7" for an interior start at FOV 1.
          * Remove once visual compositing is confirmed correct. */}
        {__DEV__ && (
          <FogDevDiagnostic
            tiles={tiles}
            worldWidth={worldW}
            worldHeight={worldH}
            fogToggles={{
              base: devFogBase,
              mid:  devFogMid,
              edge: devFogEdge,
              wisp: devFogWisp,
              mask: devFogMaskOn,
            }}
            onToggle={(layer) => {
              if (layer === 'base') setDevFogBase(v => !v);
              else if (layer === 'mid')  setDevFogMid(v => !v);
              else if (layer === 'edge') setDevFogEdge(v => !v);
              else if (layer === 'wisp') setDevFogWisp(v => !v);
              else if (layer === 'mask') setDevFogMaskOn(v => !v);
            }}
          />
        )}

        {/* ── Dev fog mask (JOURNEY_Z.DEV_MASK = 14500) — __DEV__ only ─────────
          * Zero-size View whose DOM div hosts the imperative canvas drawn by
          * Effect A.  Renders above all fog layers; below DEV_OVERLAY (19000).
          * pointerEvents="none".  MUST NOT ship.
          */}
        {__DEV__ && (devFogMaskOn || devOverlay?.fogMask) && (
          <View
            ref={fogContainerRef}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left:     0,
              top:      0,
              width:    worldW,
              height:   worldH,
              zIndex:   JOURNEY_Z.DEV_MASK,
            }}
          />
        )}

        {/* ── Dev per-tile overlays (Push 0 — __DEV__ only) ────────────────
         * Rendered as a second pass over `sorted` so overlay text/dots always
         * appear above all fog layers (JOURNEY_Z.DEV_OVERLAY = 19000) and
         * below the diagnostics panel (DEV_DIAGNOSTICS = 19999).
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

              {/* Push 2: fog debug tint — full-tile colour per FogVisibility tier.
               *  VISIBLE_NOW → green  (#4ade80)
               *  EXPLORED    → yellow (#facc15)
               *  UNEXPLORED  → red    (#ef4444)
               *  DEV ONLY — must never ship. */}
              {devOverlay.fogDebug && (() => {
                const fogTint =
                  vis === 'visibleNow'            ? '#4ade8059' :
                  vis === 'exploredButOutOfVision' ? '#facc1559' :
                                                    '#ef444459';
                return (
                  <View style={{
                    position:        'absolute',
                    left:            0,
                    top:             0,
                    width:           sz,
                    height:          sz,
                    backgroundColor: fogTint,
                  }} />
                );
              })()}

              {/* Playable-bounds per-tile border: GREEN = inside, RED = outside */}
              {devOverlay.playableBounds && devPlayableBounds && (() => {
                const { cx: tcx, cy: tcy } = coords.axialToWorld(tile.q, tile.r);
                const { halfW, halfH, left: pbL, top: pbT, right: pbR, bottom: pbB } = devPlayableBounds;
                const inside =
                  tcx - halfW >= pbL && tcx + halfW <= pbR &&
                  tcy - halfH >= pbT && tcy + halfH <= pbB;
                return (
                  <View
                    pointerEvents="none"
                    style={{
                      position:    'absolute',
                      left:        0,
                      top:         0,
                      width:       sz,
                      height:      sz,
                      borderWidth: 2,
                      borderColor: inside ? '#22c55e' : '#ef4444',
                    }}
                  />
                );
              })()}

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

        {/* Playable-bounds visualiser — GOLD map boundary + CYAN playable rect */}
        {__DEV__ && devPlayableBounds && (
          <>
            {/* GOLD — full world canvas = base map image boundary */}
            <View
              pointerEvents="none"
              style={{
                position:    'absolute',
                left:        0,
                top:         0,
                width:       worldW,
                height:      worldH,
                borderWidth: 2,
                borderColor: '#f59e0b',
                zIndex:      19410,
              }}
            />
            {/* CYAN — playable bounds (inset by hexOuterRadius × 0.75) */}
            <View
              pointerEvents="none"
              style={{
                position:    'absolute',
                left:        devPlayableBounds.left,
                top:         devPlayableBounds.top,
                width:       devPlayableBounds.right  - devPlayableBounds.left,
                height:      devPlayableBounds.bottom - devPlayableBounds.top,
                borderWidth: 2,
                borderColor: '#06b6d4',
                zIndex:      19420,
              }}
            >
              <Text style={{
                position:        'absolute',
                bottom:          2,
                left:            2,
                color:           '#06b6d4',
                fontSize:        7,
                fontWeight:      '700',
                backgroundColor: '#00000099',
                padding:         2,
              }}>
                {'Terrain cells: ' + tiles.length + '/' + tiles.length +
                 ' | Out-of-bounds: ' + devPlayableBounds.oobCount}
              </Text>
            </View>
          </>
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
