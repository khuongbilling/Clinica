/**
 * JourneyFogField.tsx — Push B (painted atmospheric fog)
 *
 * Zero circular blobs.  Zero SVG.  Zero flat grey wash.
 *
 * Fog is a layered field of painted raster cloud bank Images positioned in
 * world space.  Three shift-specific assets (A: large cloud mass, B: secondary
 * drifting bank, C: wispy tendrils) are tiled across 12 placements that span
 * 110 % of world width/height so every edge bleeds into the viewport margin.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LAYER STACK
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Layer 0 — base tint View
 *     Shift-coloured semi-opaque fill over the entire fog field.
 *     Provides even base density so no gaps appear between cloud placements.
 *     Does NOT clear — always present at fixed opacity.
 *
 *   Layer 1 — drifting cloud bank container (Animated.View)
 *     12 Image placements.  Each image is one of the three fog bank PNGs for
 *     the current shift (A/B/C), sized and centred at a seeded pseudorandom
 *     world-space position.  Opacity is driven by the clearing calculation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CLEARING
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Each placement has a centre point (cx, cy).  The clearing factor is computed
 * from the distance between that centre and the nearest visible tile centre,
 * adjusted outward by half the placement's bounding-box diagonal (edge-based
 * clearing):
 *
 *   edgeDist = max(0, centreDist − diagonal × 0.36)
 *
 * This means clearing begins when the EDGE of the cloud image, not just its
 * centre, enters the reveal radius — preventing large banks from protruding
 * into cleared territory even when their centre is far away.
 *
 * Three visibility tiers:
 *   current                startR = 2.0 × sz   fullR = 0.7 × sz
 *   visibleNow             startR = 1.7 × sz   fullR = 0.5 × sz
 *   exploredButOutOfVision startR = 1.1 × sz   fullR = 0.3 × sz
 *
 * Linear ramp from fullR (opacity 0) → startR (opacity BANK_ALPHA_MAX).
 * Minimum clearFactor across all sources wins.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DRIFT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A single Animated.ValueXY translates the cloud container ±12 px over a
 * 56-second cycle.  useNativeDriver: true keeps it off the JS thread.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PERFORMANCE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   • 12 Image nodes + 1 base tint View = 13 render nodes total.
 *   • Positions computed once in useMemo; opacity recomputed only when
 *     clearSources changes (player moves).
 *   • Only the drift transform is frame-animated (native driver).
 *   • Assets are pre-loaded by the existing preloadTabAssets pipeline.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Z-ORDERING (inside MapWorld Animated.View)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   unexplored tile Pressables     z  1–3000   (below fog — covered)
 *   JourneyFogField                z  5000     (fog field — this component)
 *   exploredButOutOfVision HexTile z  5050+    (above fog — visible)
 *   visibleNow HexTile             z  5100+    (above fog — visible)
 */

import { useEffect, useRef, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import type { HexMapTile } from '@/src/game/journeyMap/fixture';
import type { HexWorldCoords } from './hexWorldCoords';

// ── zIndex ─────────────────────────────────────────────────────────────────────

export const FOG_FIELD_Z = 5000;

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
// baseColor     — tint fill beneath cloud images (provides base coverage)
// baseOpacity   — opacity of the base tint View  (0–1)
// bankAlphaMax  — maximum opacity for each cloud bank Image

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

// ── Placement definitions — seeded layout, computed once at module level ──────
//
// 12 placements reuse 3 bank assets (bankIdx 0/1/2).
// xF, yF: fractional centre of the image in world space (-10 %…110 %).
// wF, hF: fractional size as a share of worldWidth.
//
// Rotation is not applied (RN Image rotation on web has layout cost); the
// different bank silhouettes provide adequate visual variety without it.

type PlacementDef = {
  bankIdx: 0 | 1 | 2;
  xF: number;  // centre x, fraction of worldWidth
  yF: number;  // centre y, fraction of worldHeight
  wF: number;  // image width, fraction of worldWidth
  hF: number;  // image height (≈ wF since assets are square-ish 1:1)
};

// Bank assignment pattern: A A A A B B B B C C C C
// Positions spread from -10 % to 110 % on both axes.
const PLACEMENT_DEFS: PlacementDef[] = Array.from({ length: 12 }, (_, i) => {
  const bankIdx = (Math.floor(i / 4) as 0 | 1 | 2);
  const s       = i * 13 + bankIdx * 7;   // unique seed per placement
  return {
    bankIdx,
    xF: -0.10 + seededRand(s + 1) * 1.20,   // -10 % … 110 %
    yF: -0.10 + seededRand(s + 2) * 1.20,   // -10 % … 110 %
    wF:  0.55 + seededRand(s + 3) * 0.30,   //  55 % …  85 % of worldWidth
    hF:  0.45 + seededRand(s + 4) * 0.30,   //  45 % …  75 % of worldWidth
  };
});

// ── Clearing parameters ───────────────────────────────────────────────────────

const CLEAR = {
  current:                { startR: 2.0, fullR: 0.7 },
  visibleNow:             { startR: 1.7, fullR: 0.5 },
  exploredButOutOfVision: { startR: 1.1, fullR: 0.3 },
} as const;

// ── Drift animation constants ─────────────────────────────────────────────────

const DRIFT_PX = 12;   // ± pixels
const DRIFT_MS = 14000; // ms per step (4 steps = 56 s full cycle)

// ── Types ─────────────────────────────────────────────────────────────────────

type ClearSource = {
  cx: number; cy: number;
  startR: number; fullR: number;   // already × sz
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

// ── Component ─────────────────────────────────────────────────────────────────

export interface JourneyFogFieldProps {
  tiles:     readonly HexMapTile[];
  coords:    HexWorldCoords;
  timeOfDay: 'day' | 'evening' | 'night';
}

export function JourneyFogField({ tiles, coords, timeOfDay }: JourneyFogFieldProps) {
  const { worldWidth: W, worldHeight: H, sz } = coords;
  const palette = PALETTE[timeOfDay];
  const banks   = FOG_BANKS[timeOfDay];

  // ── Drift animation ─────────────────────────────────────────────────────────
  const driftX = useRef(new Animated.Value(0)).current;
  const driftY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const D = DRIFT_PX;
    const T = DRIFT_MS;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(driftX, { toValue:  D,       duration: T, useNativeDriver: false }),
          Animated.timing(driftY, { toValue:  D * 0.4, duration: T, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(driftX, { toValue: -D * 0.4, duration: T, useNativeDriver: false }),
          Animated.timing(driftY, { toValue:  D,       duration: T, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(driftX, { toValue: -D,       duration: T, useNativeDriver: false }),
          Animated.timing(driftY, { toValue: -D * 0.4, duration: T, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(driftX, { toValue:  D * 0.4, duration: T, useNativeDriver: false }),
          Animated.timing(driftY, { toValue: -D,       duration: T, useNativeDriver: false }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Clearing sources ────────────────────────────────────────────────────────
  const clearSources: readonly ClearSource[] = useMemo(() => {
    const out: ClearSource[] = [];
    for (const tile of tiles) {
      if (tile.visibility === 'unexplored') continue;
      const { cx, cy } = coords.axialToWorld(tile.q, tile.r);
      const p =
        tile.current                           ? CLEAR.current :
        tile.visibility === 'visibleNow'       ? CLEAR.visibleNow :
        CLEAR.exploredButOutOfVision;
      out.push({ cx, cy, startR: p.startR * sz, fullR: p.fullR * sz });
    }
    return out;
  }, [tiles, coords, sz]);

  // ── Resolved placements ─────────────────────────────────────────────────────
  // Recomputed when world size, clearing sources, or shift changes.
  const placements: ResolvedPlacement[] = useMemo(() => {
    const result: ResolvedPlacement[] = [];

    for (const def of PLACEMENT_DEFS) {
      const width    = def.wF * W;
      const height   = def.hF * W;   // keep aspect roughly square
      const cx       = def.xF * W;
      const cy       = def.yF * H;
      const left     = cx - width  / 2;
      const top      = cy - height / 2;
      const diagonal = Math.hypot(width, height) * 0.36;  // edge-clearing offset

      // Minimum clearFactor across all sources (edge-adjusted distance)
      let minFactor = 1.0;
      for (const src of clearSources) {
        const dist     = Math.hypot(src.cx - cx, src.cy - cy);
        const edgeDist = Math.max(0, dist - diagonal);
        const f =
          edgeDist <= src.fullR  ? 0 :
          edgeDist >= src.startR ? 1 :
          (edgeDist - src.fullR) / (src.startR - src.fullR);
        if (f < minFactor) minFactor = f;
        if (minFactor === 0) break;
      }

      const opacity = palette.bankAlphaMax * minFactor;
      // Keep all placements so world coverage doesn't thin near cleared zones —
      // fully cleared placements simply become invisible (opacity ≈ 0).

      result.push({ bankIdx: def.bankIdx, left, top, width, height, diagonal, opacity });
    }
    return result;
  }, [W, H, palette.bankAlphaMax, clearSources]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, styles.field]}
    >
      {/* ── Layer 0: base tint — even atmospheric coverage beneath cloud banks */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: palette.baseColor, opacity: palette.baseOpacity },
        ]}
      />

      {/* ── Layer 1: drifting painted cloud banks ──────────────────────────── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { transform: [{ translateX: driftX }, { translateY: driftY }] },
        ]}
      >
        {placements.map((p, i) => (
          <Image
            key={i}
            source={banks[p.bankIdx]}
            style={{
              position: 'absolute',
              left:     p.left,
              top:      p.top,
              width:    p.width,
              height:   p.height,
              opacity:  p.opacity,
            }}
            contentFit="fill"
            // Recycling key is placement index — same asset, same slot each render.
            recyclingKey={`fog-${i}`}
          />
        ))}
      </Animated.View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  field: {
    zIndex: FOG_FIELD_Z,
  },
});
