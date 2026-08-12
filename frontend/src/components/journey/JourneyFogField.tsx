/**
 * JourneyFogField.tsx — Push B (painted atmospheric fog) + Push 2 architecture
 *
 * Zero circular blobs.  Zero SVG.  Zero flat grey wash.
 *
 * Fog is two world-space layers of painted raster cloud bank Images that move
 * in lockstep with MapWorld's camera transform:
 *
 *   BackFogLayer  (z FOG_BACK_Z = 4800)
 *     Dense atmospheric base.  Covers unexplored tiles (z 50–1550).  Clears
 *     around visible and explored tiles.  12 placements using all three
 *     cloud banks (A large mass / B secondary / C wispy).
 *
 *   FrontFogLayer (z FOG_FRONT_Z = 6100)
 *     Light wisp overlay.  Adds atmospheric depth above explored terrain
 *     (z 5100+) and below world objects (z 6200+).  Clears more aggressively
 *     so visible areas remain unobscured.  6 placements, bank C only.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LAYER STACK (inside MapWorld Animated.View, inherits camera transform)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   unexplored tile Pressables   z    50–1550   covered by BackFog
 *   BackFogLayer                 z      4800    dense atmospheric base
 *   explored / visibleNow tiles  z  5100–5400   render above BackFog
 *   FrontFogLayer                z      6100    wisp depth above terrain
 *   HexObjectLayer               z  6200–6500   sprites above both fog layers
 *   BossGate                     z      7000
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CLEARING
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Each placement has a centre (cx, cy).  Clearing uses edge-based distance:
 *
 *   edgeDist = max(0, centreDist − diagonal × 0.36)
 *
 * BackFog tiers:
 *   current                startR = 2.0 × sz   fullR = 0.7 × sz
 *   visibleNow             startR = 1.7 × sz   fullR = 0.5 × sz
 *   exploredButOutOfVision startR = 1.1 × sz   fullR = 0.3 × sz
 *
 * FrontFog tiers (more aggressive — protects visible/explored areas):
 *   current                startR = 2.5 × sz   fullR = 1.5 × sz
 *   visibleNow             startR = 2.2 × sz   fullR = 1.2 × sz
 *   exploredButOutOfVision startR = 1.5 × sz   fullR = 0.9 × sz
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DRIFT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A single Animated.ValueXY translates both cloud containers ±12 px over a
 * 56-second cycle.  Shared drift keeps the layers locked together visually.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PERFORMANCE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   • 12 back + 6 front Image nodes + 1 base tint View = 19 render nodes.
 *   • Positions computed once in useMemo; opacity recomputed only when
 *     clearing sources change (player moves).
 *   • Only the drift transform is frame-animated (Animated layout bridge).
 *   • Assets pre-loaded by the existing preloadTabAssets pipeline.
 */

import { Fragment, useEffect, useRef, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import type { HexMapTile } from '@/src/game/journeyMap/fixture';
import type { HexWorldCoords } from './hexWorldCoords';

// ── z-index constants ─────────────────────────────────────────────────────────

/** Legacy constant — kept for any external refs; equal to FOG_BACK_Z. */
export const FOG_FIELD_Z = 4800;
/** Dense back-fog layer — above unexplored Pressables (z 50–1550), below explored tiles (z 5100+). */
export const FOG_BACK_Z  = 4800;
/** Light front-fog wisp layer — above explored terrain, below HexObjectLayer (z 6200+). */
export const FOG_FRONT_Z = 6100;

// ── Seeded PRNG — deterministic, no Math.random() ────────────────────────────

function seededRand(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ── Fog bank assets per shift ─────────────────────────────────────────────────
//
// Three painted cloud textures per shift:
//   A — large primary cloud mass  (dominant coverage, main body)
//   B — secondary drifting bank   (different silhouette, layering)
//   C — wispy tendrils            (lighter, edge detail)

const FOG_BANKS = {
  night: [
    require('@/assets/ui/journey/fog/fog-bank-A-night.png') as number,
    require('@/assets/ui/journey/fog/fog-bank-B-night.png') as number,
    require('@/assets/ui/journey/fog/fog-bank-C-night.png') as number,
  ],
  day: [
    require('@/assets/ui/journey/fog/fog-bank-A-day.png') as number,
    require('@/assets/ui/journey/fog/fog-bank-B-day.png') as number,
    require('@/assets/ui/journey/fog/fog-bank-C-day.png') as number,
  ],
  evening: [
    require('@/assets/ui/journey/fog/fog-bank-A-evening.png') as number,
    require('@/assets/ui/journey/fog/fog-bank-B-evening.png') as number,
    require('@/assets/ui/journey/fog/fog-bank-C-evening.png') as number,
  ],
} as const;

// ── Per-shift palette ─────────────────────────────────────────────────────────
//
// baseColor     — tint fill beneath cloud images (even coverage base)
// baseOpacity   — opacity of the base tint View  (back fog only)
// bankAlphaMax  — maximum opacity for each back cloud bank Image

type ShiftPalette = {
  baseColor:    string;
  baseOpacity:  number;
  bankAlphaMax: number;
};

const PALETTE: Record<'day' | 'evening' | 'night', ShiftPalette> = {
  night:   { baseColor: '#0a1520', baseOpacity: 0.50, bankAlphaMax: 0.88 },
  day:     { baseColor: '#8898a8', baseOpacity: 0.22, bankAlphaMax: 0.78 },
  evening: { baseColor: '#160e28', baseOpacity: 0.42, bankAlphaMax: 0.85 },
};

// ── Placement definitions ─────────────────────────────────────────────────────

type PlacementDef = {
  bankIdx: 0 | 1 | 2;
  xF: number;  // centre x as fraction of worldWidth
  yF: number;  // centre y as fraction of worldHeight
  wF: number;  // image width as fraction of worldWidth
  hF: number;  // image height (≈ wF since assets are square-ish)
};

// Back fog: 12 placements, all three banks, spread -10 %…110 %.
// Bank assignment: A A A A  B B B B  C C C C
const BACK_PLACEMENT_DEFS: PlacementDef[] = Array.from({ length: 12 }, (_, i) => {
  const bankIdx = (Math.floor(i / 4) as 0 | 1 | 2);
  const s       = i * 13 + bankIdx * 7;
  return {
    bankIdx,
    xF: -0.10 + seededRand(s + 1) * 1.20,   // -10 %…110 %
    yF: -0.10 + seededRand(s + 2) * 1.20,
    wF:  0.55 + seededRand(s + 3) * 0.30,   //  55 %… 85 % of worldWidth
    hF:  0.45 + seededRand(s + 4) * 0.30,   //  45 %… 75 %
  };
});

// Front fog: 6 placements, bank C (wispy) only, range 0 %…100 %.
// Distinct seed range (offset 53) from back placements.
const FRONT_PLACEMENT_DEFS: PlacementDef[] = Array.from({ length: 6 }, (_, i) => {
  const s = i * 17 + 53;
  return {
    bankIdx: 2 as const,   // bank C — wispy tendrils only
    xF:  0.00 + seededRand(s + 1) * 1.00,   // 0 %…100 %
    yF:  0.00 + seededRand(s + 2) * 1.00,
    wF:  0.40 + seededRand(s + 3) * 0.35,   // 40 %… 75 %
    hF:  0.30 + seededRand(s + 4) * 0.35,   // 30 %… 65 %
  };
});

// ── Clearing parameters ───────────────────────────────────────────────────────

const BACK_CLEAR = {
  current:                { startR: 2.0, fullR: 0.7 },
  visibleNow:             { startR: 1.7, fullR: 0.5 },
  exploredButOutOfVision: { startR: 1.1, fullR: 0.3 },
} as const;

// Front fog clears more aggressively — does not obscure visible areas.
const FRONT_CLEAR = {
  current:                { startR: 2.5, fullR: 1.5 },
  visibleNow:             { startR: 2.2, fullR: 1.2 },
  exploredButOutOfVision: { startR: 1.5, fullR: 0.9 },
} as const;

/** Maximum opacity for the front-fog wisp layer. */
const FRONT_BANK_ALPHA_MAX = 0.22;

// ── Drift animation constants ─────────────────────────────────────────────────

const DRIFT_PX = 12;    // ± pixels
const DRIFT_MS = 14000; // ms per step (4 steps = 56 s full cycle)

// ── Internal types ────────────────────────────────────────────────────────────

type ClearSource = {
  cx: number; cy: number;
  startR: number; fullR: number;   // already multiplied by sz
};

type ResolvedPlacement = {
  bankIdx:  0 | 1 | 2;
  left:     number;
  top:      number;
  width:    number;
  height:   number;
  diagonal: number;   // half-diagonal for edge-based clearing
  opacity:  number;   // clearing-driven
};

// ── Pure helper ───────────────────────────────────────────────────────────────

/**
 * Resolve placement opacity from clearing sources.
 * Edge-adjusted distance prevents large cloud banks protruding into cleared zones.
 */
function resolvePlacements(
  defs:     PlacementDef[],
  W:        number,
  H:        number,
  sources:  readonly ClearSource[],
  alphaMax: number,
): ResolvedPlacement[] {
  return defs.map(def => {
    const width    = def.wF * W;
    const height   = def.hF * W;   // square-ish: height proportional to width
    const cx       = def.xF * W;
    const cy       = def.yF * H;
    const left     = cx - width  / 2;
    const top      = cy - height / 2;
    const diagonal = Math.hypot(width, height) * 0.36;

    let minFactor = 1.0;
    for (const src of sources) {
      const dist     = Math.hypot(src.cx - cx, src.cy - cy);
      const edgeDist = Math.max(0, dist - diagonal);
      const f =
        edgeDist <= src.fullR  ? 0 :
        edgeDist >= src.startR ? 1 :
        (edgeDist - src.fullR) / (src.startR - src.fullR);
      if (f < minFactor) minFactor = f;
      if (minFactor === 0) break;
    }

    return { bankIdx: def.bankIdx, left, top, width, height, diagonal, opacity: alphaMax * minFactor };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface JourneyFogFieldProps {
  /** Full tile set — visibility state drives clearing calculations. */
  tiles:     readonly HexMapTile[];
  /** World-coordinate system — provides axialToWorld(), sz, worldWidth, worldHeight. */
  coords:    HexWorldCoords;
  /** Active time-of-day shift — selects cloud bank assets and palette. */
  timeOfDay: 'day' | 'evening' | 'night';
  /**
   * Run seed — enables per-run placement variation in future refinement.
   * Accepted now so the prop contract is stable; position defs remain
   * module-level constants until a dedicated seed-variation push.
   */
  seed?:     string;
  // ── Dev-only props — no-ops in production ─────────────────────────────────
  /** Suppress the dense back-fog layer (__DEV__ only). */
  hideBack?:  boolean;
  /** Suppress the light front-fog wisp layer (__DEV__ only). */
  hideFront?: boolean;
  /** Render fog-clearing influence rings for each visible / explored tile (__DEV__ only). */
  showMask?:  boolean;
}

export function JourneyFogField({
  tiles,
  coords,
  timeOfDay,
  seed: _seed,
  hideBack,
  hideFront,
  showMask,
}: JourneyFogFieldProps) {
  const { worldWidth: W, worldHeight: H, sz } = coords;
  const palette = PALETTE[timeOfDay];
  const banks   = FOG_BANKS[timeOfDay];

  // ── Drift animation — shared between both layers ──────────────────────────
  // A single ValueXY drives both containers so back and front move in lockstep.
  const driftX = useRef(new Animated.Value(0)).current;
  const driftY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const D = DRIFT_PX;
    const T = DRIFT_MS;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(driftX, { toValue:  D,        duration: T, useNativeDriver: false }),
          Animated.timing(driftY, { toValue:  D * 0.4,  duration: T, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(driftX, { toValue: -D * 0.4,  duration: T, useNativeDriver: false }),
          Animated.timing(driftY, { toValue:  D,        duration: T, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(driftX, { toValue: -D,        duration: T, useNativeDriver: false }),
          Animated.timing(driftY, { toValue: -D * 0.4,  duration: T, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(driftX, { toValue:  D * 0.4,  duration: T, useNativeDriver: false }),
          Animated.timing(driftY, { toValue: -D,        duration: T, useNativeDriver: false }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const driftTransform = [{ translateX: driftX }, { translateY: driftY }] as const;

  // ── Back-fog clearing sources ─────────────────────────────────────────────
  const backSources: readonly ClearSource[] = useMemo(() => {
    const out: ClearSource[] = [];
    for (const tile of tiles) {
      if (tile.visibility === 'unexplored') continue;
      const { cx, cy } = coords.axialToWorld(tile.q, tile.r);
      const p =
        tile.current                           ? BACK_CLEAR.current :
        tile.visibility === 'visibleNow'       ? BACK_CLEAR.visibleNow :
        BACK_CLEAR.exploredButOutOfVision;
      out.push({ cx, cy, startR: p.startR * sz, fullR: p.fullR * sz });
    }
    return out;
  }, [tiles, coords, sz]);

  // ── Front-fog clearing sources (more aggressive) ──────────────────────────
  const frontSources: readonly ClearSource[] = useMemo(() => {
    const out: ClearSource[] = [];
    for (const tile of tiles) {
      if (tile.visibility === 'unexplored') continue;
      const { cx, cy } = coords.axialToWorld(tile.q, tile.r);
      const p =
        tile.current                           ? FRONT_CLEAR.current :
        tile.visibility === 'visibleNow'       ? FRONT_CLEAR.visibleNow :
        FRONT_CLEAR.exploredButOutOfVision;
      out.push({ cx, cy, startR: p.startR * sz, fullR: p.fullR * sz });
    }
    return out;
  }, [tiles, coords, sz]);

  // ── Resolved placements ───────────────────────────────────────────────────
  const backPlacements = useMemo(
    () => resolvePlacements(BACK_PLACEMENT_DEFS, W, H, backSources, palette.bankAlphaMax),
    [W, H, backSources, palette.bankAlphaMax],
  );
  const frontPlacements = useMemo(
    () => resolvePlacements(FRONT_PLACEMENT_DEFS, W, H, frontSources, FRONT_BANK_ALPHA_MAX),
    [W, H, frontSources],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  //
  // Push 2A: rectangular cloud-bank Image nodes and the base-tint View have
  // been removed.  Unexplored terrain is temporarily unfogged.
  // The clearing math (backSources, frontSources, backPlacements,
  // frontPlacements) and z-constants remain intact so the next fog push can
  // slot painted art back in without architecture changes.
  //
  // Variables retained to avoid churn (used by dev mask + next push):
  //   palette, banks, backPlacements, frontPlacements, driftTransform,
  //   hideBack, hideFront
  void palette; void banks; void backPlacements; void frontPlacements;
  void driftTransform; void hideBack; void hideFront;

  return (
    <>
      {/* ── Dev: fog mask — back-fog clearing influence rings ─────────────
       * Green ring = fullR (fully cleared).  Amber ring = startR (fog starts).
       * Only rendered when showMask is true (dev diagnostics toggle).       */}
      {__DEV__ && showMask && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, styles.maskLayer]}
        >
          {backSources.map((src, i) => (
            <Fragment key={i}>
              {/* fullR — fully cleared zone */}
              <View style={{
                position:        'absolute',
                left:            src.cx - src.fullR,
                top:             src.cy - src.fullR,
                width:           src.fullR * 2,
                height:          src.fullR * 2,
                borderRadius:    src.fullR,
                borderWidth:     1,
                borderColor:     'rgba(0,255,120,0.80)',
                backgroundColor: 'transparent',
              }} />
              {/* startR — fog begins here */}
              <View style={{
                position:        'absolute',
                left:            src.cx - src.startR,
                top:             src.cy - src.startR,
                width:           src.startR * 2,
                height:          src.startR * 2,
                borderRadius:    src.startR,
                borderWidth:     1,
                borderColor:     'rgba(255,200,0,0.50)',
                backgroundColor: 'transparent',
              }} />
            </Fragment>
          ))}
        </View>
      )}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backFog: {
    zIndex: FOG_BACK_Z,   // 4800 — above unexplored tiles, below explored/visible
  },
  frontFog: {
    zIndex: FOG_FRONT_Z,  // 6100 — above terrain, below world objects
  },
  maskLayer: {
    zIndex: 8500,         // above both fog layers, below dev tile overlays (19000)
  },
});
