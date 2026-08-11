/**
 * JourneyFogField.tsx — Push 26 (procedural runtime fog)
 *
 * Zero raster assets.  Zero SVG.  Zero flat overlay.
 *
 * The fog is generated entirely at runtime from deterministic pseudorandom
 * blob positions.  Each blob is three concentric <View> circles whose
 * borderRadius makes them round, and whose stacked opacities produce a
 * feathered radial gradient effect:
 *
 *   inner ring  — dense fog body       (opacity_factor 0.54)
 *   middle ring — transitional mist    (opacity_factor 0.26)
 *   outer ring  — feathered wisps      (opacity_factor 0.08)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CLEARING
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Each blob's parent opacity is driven by its centre's distance to the
 * nearest visible tile centre.  Three visibility tiers control clearing radii:
 *
 *   current                startR = 1.9 × sz   fullR = 0.6 × sz
 *   visibleNow             startR = 1.6 × sz   fullR = 0.45 × sz
 *   exploredButOutOfVision startR = 1.0 × sz   fullR = 0.25 × sz
 *
 * Linear ramp from fullR (opacity = 0) to startR (opacity = BLOB_ALPHA_MAX).
 * The most-clearing source wins (minimum factor across all sources).
 *
 * Because blobs range from 12 % to 32 % of world width in outer radius, and
 * clearing radii are 1–2 tile-sizes (~80–160 px), multiple blobs near the
 * clearing boundary will fade independently, giving a soft irregular edge
 * that reads as genuine mist thinning rather than a hard boundary.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DRIFT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A single Animated.ValueXY drives a slow global translateX/Y on the blob
 * container.  useNativeDriver: true keeps the animation off the JS thread.
 * Drift amplitude ±10 px over a 48-second cycle — barely perceptible but
 * enough to make the mist feel alive.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PERFORMANCE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   • 22 blobs × 3 rings = 66 views — acceptable for mobile.
 *   • All positions are static (computed once in useMemo on tile/size change).
 *   • Only the global drift transform is animated; it uses the native driver.
 *   • Blobs with opacity < 0.02 are skipped (no invisible views rendered).
 *   • No canvas, no WebGL, no raster assets, no SVG.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Z-ORDERING (inside MapWorld Animated.View)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   unexplored tile Pressables     z  1–3000   (below fog — covered)
 *   JourneyFogField                z  5000     (fog field)
 *   exploredButOutOfVision HexTile z  5050     (above fog)
 *   visibleNow HexTile             z  5100+    (above fog)
 *   current HexTile                z  9999     (topmost)
 */

import { useEffect, useRef, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import type { HexMapTile } from '@/src/game/journeyMap/fixture';
import type { HexWorldCoords } from './hexWorldCoords';

// ── zIndex ─────────────────────────────────────────────────────────────────────

export const FOG_FIELD_Z = 5000;

// ── Seeded pseudorandom number generator ──────────────────────────────────────
//
// Deterministic LCG — same blob layout every render for a given index.
// No Math.random() — positions are stable across React reconciler cycles.

function seededRand(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ── Blob definitions — generated once at module level ─────────────────────────
//
// 22 blobs placed across 110 % of world width/height (bleed past all edges).
// xF / yF are fractional: 0.0 = world left/top, 1.0 = world right/bottom.
// sizeF is outer-ring radius as a fraction of world width.

const BLOB_COUNT = 22;

type BlobDef = {
  readonly xF:    number;   // blob centre, fraction of worldWidth
  readonly yF:    number;   // blob centre, fraction of worldHeight
  readonly sizeF: number;   // outer ring radius, fraction of worldWidth
};

const BLOB_DEFS: BlobDef[] = Array.from({ length: BLOB_COUNT }, (_, i) => ({
  xF:    -0.12 + seededRand(i * 11 + 1) * 1.24,   // -12 % … 112 %
  yF:    -0.10 + seededRand(i * 11 + 2) * 1.20,   // -10 % … 110 %
  sizeF:  0.12 + seededRand(i * 11 + 3) * 0.20,   //  12 % …  32 %
}));

// ── Per-shift fog palette ──────────────────────────────────────────────────────
//
// blobColor — the backgroundColor shared by all three rings of every blob.
// The inner/mid/outer ring opacity factors handle the density gradient.
// No flat base overlay — blobs provide all coverage.

const FOG_PALETTE: Record<'day' | 'evening' | 'night', { blobColor: string }> = {
  day:     { blobColor: '#7a9db4' },   // pale blue-grey atmospheric haze
  evening: { blobColor: '#1e1030' },   // deep indigo-purple twilight fog
  night:   { blobColor: '#0c1a28' },   // near-black navy mist
};

// ── Ring opacity factors (inner to outer) ─────────────────────────────────────
//
// Applied multiplicatively with the parent blob's clearing opacity.
// Three rings simulate a radial gradient using only View borderRadius.

const RING_OPACITY = {
  inner:  0.54,   // dense fog body
  middle: 0.26,   // transitional mist
  outer:  0.08,   // feathered wisps
} as const;

// ── Maximum blob opacity (far from any visible tile) ──────────────────────────

const BLOB_ALPHA_MAX = 0.84;

// ── Clearing radius factors (multiples of sz) ─────────────────────────────────

const CLEAR = {
  current:                { startR: 1.9, fullR: 0.6 },
  visibleNow:             { startR: 1.6, fullR: 0.45 },
  exploredButOutOfVision: { startR: 1.0, fullR: 0.25 },
} as const;

// ── Drift animation constants ──────────────────────────────────────────────────

const DRIFT_PX  = 10;    // amplitude in pixels (±)
const DRIFT_MS  = 12000; // milliseconds per step (4 steps = 48 s full cycle)

// ── ClearSource type ──────────────────────────────────────────────────────────

type ClearSource = {
  cx:     number;
  cy:     number;
  startR: number;   // already multiplied by sz
  fullR:  number;   // already multiplied by sz
};

// ── Resolved blob (pixel-space, ready for render) ─────────────────────────────

type ResolvedBlob = {
  cx:      number;
  cy:      number;
  outerR:  number;   // outer ring radius (pixels)
  midR:    number;   // middle ring radius
  innerR:  number;   // inner ring radius
  opacity: number;   // clearing-driven parent opacity
  color:   string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export interface JourneyFogFieldProps {
  tiles:     readonly HexMapTile[];
  coords:    HexWorldCoords;
  timeOfDay: 'day' | 'evening' | 'night';
}

export function JourneyFogField({ tiles, coords, timeOfDay }: JourneyFogFieldProps) {
  const { worldWidth: W, worldHeight: H, sz } = coords;
  const { blobColor } = FOG_PALETTE[timeOfDay];

  // ── Drift animation ─────────────────────────────────────────────────────────
  const driftX = useRef(new Animated.Value(0)).current;
  const driftY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const D = DRIFT_PX;
    const T = DRIFT_MS;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(driftX, { toValue:  D,        duration: T, useNativeDriver: true }),
          Animated.timing(driftY, { toValue:  D * 0.5,  duration: T, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(driftX, { toValue: -D * 0.3,  duration: T, useNativeDriver: true }),
          Animated.timing(driftY, { toValue:  D,        duration: T, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(driftX, { toValue: -D,        duration: T, useNativeDriver: true }),
          Animated.timing(driftY, { toValue: -D * 0.5,  duration: T, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(driftX, { toValue:  D * 0.3,  duration: T, useNativeDriver: true }),
          Animated.timing(driftY, { toValue: -D,        duration: T, useNativeDriver: true }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // drift constants never change; no deps needed

  // ── Clearing sources ────────────────────────────────────────────────────────
  const clearSources: readonly ClearSource[] = useMemo(() => {
    const out: ClearSource[] = [];
    for (const tile of tiles) {
      if (tile.visibility === 'unexplored') continue;
      const { cx, cy } = coords.axialToWorld(tile.q, tile.r);
      const params =
        tile.current              ? CLEAR.current :
        tile.visibility === 'visibleNow' ? CLEAR.visibleNow :
        CLEAR.exploredButOutOfVision;
      out.push({ cx, cy, startR: params.startR * sz, fullR: params.fullR * sz });
    }
    return out;
  }, [tiles, coords, sz]);

  // ── Resolved blobs ──────────────────────────────────────────────────────────
  const blobs: ResolvedBlob[] = useMemo(() => {
    const result: ResolvedBlob[] = [];
    for (const def of BLOB_DEFS) {
      const cx     = def.xF * W;
      const cy     = def.yF * H;
      const outerR = def.sizeF * W;

      // Find minimum clearFactor across all sources (most-clearing wins)
      let minFactor = 1.0;
      for (const src of clearSources) {
        const dist = Math.hypot(src.cx - cx, src.cy - cy);
        const f =
          dist <= src.fullR  ? 0 :
          dist >= src.startR ? 1 :
          (dist - src.fullR) / (src.startR - src.fullR);
        if (f < minFactor) minFactor = f;
        if (minFactor === 0) break;
      }

      const opacity = BLOB_ALPHA_MAX * minFactor;
      if (opacity < 0.02) continue; // skip fully-cleared blobs

      result.push({
        cx,
        cy,
        outerR,
        midR:   outerR * 0.70,
        innerR: outerR * 0.47,
        opacity,
        color:  blobColor,
      });
    }
    return result;
  }, [W, H, blobColor, clearSources]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, styles.field]}
    >
      {/*
        Drifting blob container.
        useNativeDriver:true → translateX/Y run on the GPU thread.
        Static blob opacities are regular View style props (not animated).
      */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { transform: [{ translateX: driftX }, { translateY: driftY }] },
        ]}
      >
        {blobs.map((blob, i) => (
          <FogBlob key={i} blob={blob} />
        ))}
      </Animated.View>
    </View>
  );
}

// ── FogBlob ───────────────────────────────────────────────────────────────────
//
// Three concentric circles simulate a radial density gradient.
// The parent View's opacity is the clearing-driven value; each ring
// multiplies its own layer factor on top (parent × ring_factor).

function FogBlob({ blob }: { blob: ResolvedBlob }) {
  const { cx, cy, outerR, midR, innerR, opacity, color } = blob;
  // Parent positioned at outer-ring bounding box centre
  const left = cx - outerR;
  const top  = cy - outerR;
  const size = outerR * 2;

  return (
    <View
      style={{
        position: 'absolute',
        left,
        top,
        width:   size,
        height:  size,
        opacity,
      }}
    >
      {/* Outer feather ring — fills the entire bounding box */}
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: 99999,
          backgroundColor: color,
          opacity: RING_OPACITY.outer,
        }}
      />

      {/* Middle density ring */}
      <View
        style={{
          position:        'absolute',
          left:            outerR - midR,
          top:             outerR - midR,
          width:           midR * 2,
          height:          midR * 2,
          borderRadius:    99999,
          backgroundColor: color,
          opacity:         RING_OPACITY.middle,
        }}
      />

      {/* Inner fog body */}
      <View
        style={{
          position:        'absolute',
          left:            outerR - innerR,
          top:             outerR - innerR,
          width:           innerR * 2,
          height:          innerR * 2,
          borderRadius:    99999,
          backgroundColor: color,
          opacity:         RING_OPACITY.inner,
        }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  field: {
    zIndex: FOG_FIELD_Z,
  },
});
