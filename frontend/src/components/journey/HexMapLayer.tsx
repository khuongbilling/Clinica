/**
 * HexMapLayer — PUSH 5 camera / PUSH 9 axial rendering + content privacy
 *
 * Renders a bounded draggable hex map world inside a clipping viewport.
 * All tiles use AXIAL q,r coordinates (flat-top hexes):
 *
 *   pixel_left = q × 0.75 × sz + ox
 *   pixel_top  = (r × 0.866 + q × 0.433) × sz + oy
 *
 * Privacy rules (Push 9)
 * ──────────────────────
 * • Hidden and frontier tiles MUST NOT leak encounter type through:
 *   - Visual: encounter icons are only rendered for `revealed` or `current` tiles.
 *   - Accessibility: labels say "unexplored" / "nearby" — never the encounter name.
 *   - DOM: data-encounter is masked to "unknown" for non-revealed tiles.
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

import { type HexMapTile, JOURNEY_MAP_FIXTURE } from '@/src/game/journeyMap/fixture';
import { UI } from '@/src/theme/ui';

// ── Hex layout constants (flat-top axial) ────────────────────────────────────
const Q_STEP  = 0.75;   // horizontal advance per q unit  (= 3/4)
const R_STEP  = 0.866;  // vertical advance per r unit    (≈ √3/2)
const Q_VOFF  = 0.433;  // vertical bump per q unit       (≈ √3/4)

const MAX_TILE_SZ = 88;
/**
 * 44 px is the minimum touch-target size required by WCAG 2.5.5 and iOS HIG.
 * Setting this as the lower bound ensures every interactive tile meets the
 * accessibility touch-target rule regardless of container width.
 */
const MIN_TILE_SZ = 44;

// ── Raster assets ─────────────────────────────────────────────────────────────
const TILE_BASE = {
  hidden:   require('@/assets/ui/journey/tiles/hex-hidden.webp')   as number,
  frontier: require('@/assets/ui/journey/tiles/hex-frontier.webp') as number,
  revealed: require('@/assets/ui/journey/tiles/hex-revealed.webp') as number,
  current:  require('@/assets/ui/journey/tiles/hex-current.webp')  as number,
};

// Fog art overlay — applied on top of the base tile for hidden tiles.
// Approved: no flat-black opacity layer; texture comes from this asset.
const FOG_TILE  = require('@/assets/ui/journey/fog/fog-tile.webp')         as number;
// Frontier glow art — restrained selection highlight for reachable tiles.
const FOG_GLOW  = require('@/assets/ui/journey/tiles/hex-selected.webp')   as number;
// Player token rendered on top of the current tile.
const PLAYER_TOKEN = require('@/assets/ui/journey/map/player-map-token.webp') as number;

const ENCOUNTER_ICON = {
  battle:         require('@/assets/ui/journey/encounters/battle.webp')          as number,
  treasureBronze: require('@/assets/ui/journey/encounters/treasure-bronze.webp') as number,
  treasureSilver: require('@/assets/ui/journey/encounters/treasure-silver.webp') as number,
  treasureGold:   require('@/assets/ui/journey/encounters/treasure-gold.webp')   as number,
  merchant:       require('@/assets/ui/journey/encounters/merchant.webp')        as number,
  areaBoss:       require('@/assets/ui/journey/encounters/area-boss.webp')       as number,
};

// ── Resolved tile visual sources ─────────────────────────────────────────────

/**
 * Effective tile-art sources passed from HexMapLayer down to HexTile.
 * Callers supply a ChapterShiftVisuals subset via the `tileVisuals` prop;
 * HexMapLayer merges it with module-level defaults so HexTile always receives
 * concrete asset numbers.
 */
type ResolvedTileVis = {
  terrainBase:     number;   // hex-revealed equivalent
  terrainCurrent:  number;   // hex-current (jade glow)
  terrainFrontier: number;   // hex-frontier
  fogInterior:     number;   // fog overlay for hidden tiles
};

// ── Asset helpers ─────────────────────────────────────────────────────────────

function baseSrc(tile: HexMapTile, vis: ResolvedTileVis): number {
  if (tile.current)                   return vis.terrainCurrent;
  // Hidden tiles use the module-level hidden art — shift-unaware for now
  // (fog textures are overlaid on top; the base does not need to vary).
  if (tile.visibility === 'hidden')   return TILE_BASE.hidden;
  if (tile.visibility === 'frontier') return vis.terrainFrontier;
  return vis.terrainBase;
}

/**
 * Returns the encounter icon source ONLY for revealed or current tiles.
 * Hidden and frontier tiles always return null — encounters must not be
 * visible (or inferrable) until the player has discovered the tile.
 */
function encounterSrc(tile: HexMapTile): number | null {
  if (!tile.current && tile.visibility !== 'revealed') return null;
  switch (tile.encounter) {
    case 'battle':   return ENCOUNTER_ICON.battle;
    case 'merchant': return ENCOUNTER_ICON.merchant;
    case 'areaBoss': return ENCOUNTER_ICON.areaBoss;
    case 'treasure':
      if (tile.chestTier === 'gold')   return ENCOUNTER_ICON.treasureGold;
      if (tile.chestTier === 'silver') return ENCOUNTER_ICON.treasureSilver;
      return ENCOUNTER_ICON.treasureBronze;
    default: return null;
  }
}

/**
 * Privacy-safe accessibility label:
 *   hidden   → "Unexplored tile" (no encounter hint)
 *   frontier → "Nearby tile, not yet explored"
 *   revealed / current → descriptive label including encounter type
 */
function a11yLabel(tile: HexMapTile): string {
  if (tile.current) return 'Current position';
  if (tile.isGate && tile.visibility === 'revealed') return 'Chapter Boss Gate';
  if (tile.visibility === 'hidden')   return 'Unexplored tile';
  if (tile.visibility === 'frontier') return 'Nearby tile, not yet explored';
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
}

function HexTile({ tile, sz, ox, oy, onPress, explorationCharacter, tileVis }: HexTileProps) {
  const pos      = tilePos(tile.q, tile.r, sz, ox, oy);
  const base     = baseSrc(tile, tileVis);
  const marker   = encounterSrc(tile);
  const markerSz = Math.round(sz * 0.52);
  const markerX  = Math.round((sz - markerSz) / 2);
  const markerY  = Math.round((sz - markerSz) / 2) - Math.round(sz * 0.06);

  // Privacy: mask encounter type in DOM attributes for non-revealed tiles.
  const isRevealed = tile.current || tile.visibility === 'revealed';

  // Hidden tiles are not interactive — players cannot select unseen territory.
  const isHidden   = !tile.current && tile.visibility === 'hidden';
  const isFrontier = !tile.current && tile.visibility === 'frontier';

  // Player token sits on top of the current tile base.
  const tokenSz = Math.round(sz * 0.62);
  const tokenX  = Math.round((sz - tokenSz) / 2);
  const tokenY  = Math.round((sz - tokenSz) / 2) - Math.round(sz * 0.08);

  return (
    <Pressable
      style={[s.tile, { left: pos.left, top: pos.top, width: sz, height: sz }]}
      testID={tile.id}
      onPress={() => onPress(tile)}
      // Hidden tiles must not be selectable.
      disabled={isHidden}
      accessibilityRole={isHidden ? 'none' : 'button'}
      accessibilityLabel={a11yLabel(tile)}
      {...webData({
        'data-tile-id':    tile.id,
        'data-q':          String(tile.q),
        'data-r':          String(tile.r),
        'data-visibility': tile.current ? 'current' : tile.visibility,
        // Masked to "unknown" for hidden/frontier — prevents encounter leak.
        'data-encounter':  isRevealed ? tile.encounter : 'unknown',
      })}
    >
      {/* ── Base hex art ────────────────────────────────────────────────── */}
      <Image
        source={base}
        style={{ width: sz, height: sz }}
        contentFit="contain"
        recyclingKey={`base-${tile.id}`}
      />

      {/* ── Fog overlay — hidden tiles only ─────────────────────────────── */}
      {/* Texture from tileVis.fogInterior (shift-aware); no flat-black layer. */}
      {isHidden && (
        <Image
          source={tileVis.fogInterior}
          style={[s.overlay, { width: sz, height: sz, opacity: 0.90 }]}
          contentFit="contain"
          recyclingKey={`fog-${tile.id}`}
        />
      )}

      {/* ── Frontier glow — restrained reachable highlight ───────────────── */}
      {/* Low-opacity selected art signals the tile is adjacent and tappable. */}
      {isFrontier && (
        <Image
          source={FOG_GLOW}
          style={[s.overlay, { width: sz, height: sz, opacity: 0.35 }]}
          contentFit="contain"
          recyclingKey={`glow-${tile.id}`}
        />
      )}

      {/* ── Encounter icon (revealed + current tiles only) ───────────────── */}
      {marker !== null && (
        <Image
          source={marker}
          style={[s.marker, { left: markerX, top: markerY, width: markerSz, height: markerSz }]}
          contentFit="contain"
          recyclingKey={`marker-${tile.id}`}
        />
      )}

      {/* ── Player token / exploration character — current tile only ──────── */}
      {/* explorationCharacter: class map sprite (chibi/pawn). Renders in      */}
      {/* place of the medallion. Absent → fallback to medallion (spec rule).  */}
      {/* The character is sized slightly taller than the tile so it visually  */}
      {/* overlaps adjacent terrain — intentional pawn-on-board aesthetic.     */}
      {tile.current && (() => {
        if (explorationCharacter) {
          const charW = Math.round(sz * 0.78);
          const charH = Math.round(sz * 1.05);
          const charX = Math.round((sz - charW) / 2);
          // Anchor so feet sit at ~80 % down the tile; head overflows above.
          // Negative offset — character top extends above the tile edge so
          // feet land at ~tile-bottom. 5 % overhang feels like a pawn on a board.
          const charY = -Math.round(sz * 0.05);
          return (
            <Image
              source={explorationCharacter}
              style={[s.marker, { left: charX, top: charY, width: charW, height: charH }]}
              contentFit="contain"
              recyclingKey={`char-${tile.id}`}
            />
          );
        }
        return (
          <Image
            source={PLAYER_TOKEN}
            style={[s.marker, { left: tokenX, top: tokenY, width: tokenSz, height: tokenSz }]}
            contentFit="contain"
            recyclingKey={`token-${tile.id}`}
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
  tileVisuals?: Pick<import('@/src/game/journeyMap/chapterMapVisuals').ChapterShiftVisuals,
    'terrainBase' | 'terrainCurrent' | 'terrainFrontier' | 'fogInterior'>;

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
  gateArt,
  explorationCharacter,
}: HexMapLayerProps) {
  // ── Resolved tile art (prop overrides merged with module-level defaults) ──
  // Module-level TILE_BASE / FOG_TILE constants are the night-theme defaults.
  // When a caller supplies tileVisuals (from getChapterMapVisuals), those
  // assets take priority.  Never fall through to CSS filter tricks.
  const resolvedTileVis: ResolvedTileVis = {
    terrainBase:     tileVisuals?.terrainBase     ?? TILE_BASE.revealed,
    terrainCurrent:  tileVisuals?.terrainCurrent  ?? TILE_BASE.current,
    terrainFrontier: tileVisuals?.terrainFrontier ?? TILE_BASE.frontier,
    fogInterior:     tileVisuals?.fogInterior     ?? FOG_TILE,
  };

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

  // ── Render order: ascending r for depth; current tile paints last (top) ───
  const sorted = useMemo(
    () =>
      [...tiles].sort((a, b) => {
        if (a.current && !b.current) return  1;
        if (b.current && !a.current) return -1;
        return a.r !== b.r ? a.r - b.r : a.q - b.q;
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
          />
        ))}

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
          if (!gateTile || gateTile.visibility === 'hidden') return null;
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
  tile:    { position: 'absolute' },
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
