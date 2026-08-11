/**
 * JourneyFogField.tsx — Push 16
 *
 * Continuous atmospheric fog field rendered as a world-space layer inside MapWorld.
 * Replaces the null-stubbed JourneyFogLayer (Push 13) with real painted fog art.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SEPARATION OF CONCERNS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   FOG ART  ─ raster assets only.
 *     Six painted PNG fog banks (2 large + 2 medium + 2 wisp) from Push 15,
 *     positioned in world space as Image components.  They overlap naturally to
 *     form one continuous cloud mass.  No fog cloud shape is drawn in code.
 *
 *   VISIBILITY MASK  ─ code-driven.
 *     Each fog bank's opacity is attenuated by how close its centre lies to
 *     any visible tile centre (visibleNow / current / exploredButOutOfVision).
 *     Closer = less opaque = fog thins away from unexplored terrain.
 *
 *   CLEARING LAYER  ─ SVG radial overlay.
 *     A very-low-opacity SVG radial gradient is placed at each visibleNow /
 *     current tile centre.  This is an atmospheric hint only — not the hard
 *     visibility boundary, which is already enforced by HexTile z-ordering.
 *     The gradient reinforces the sense of fog naturally rolling back around
 *     where the player can see.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RENDERING CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Rendered at zIndex 5000 inside MapWorld (same Animated.View as all HexTiles).
 *
 *   z-ordering guarantees:
 *     unexplored tile Pressables       z  1–3000   ← below fog field
 *     JourneyFogField                  z  5000     ← fog
 *     exploredButOutOfVision HexTile   z  5050     ← above fog
 *     visibleNow HexTile               z  5100+    ← above fog
 *     current HexTile                  z  9999     ← always topmost
 *
 *   Fog artwork is NEVER attached to individual HexTile components.
 *   All clearing influence is derived from the tile visibility array; the
 *   fog calculator and game state logic in fogCalculator.ts are untouched.
 */

import { Image } from 'expo-image';
import { useMemo }  from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import type { HexMapTile } from '@/src/game/journeyMap/fixture';
import type { HexWorldCoords } from './hexWorldCoords';

// ── zIndex ────────────────────────────────────────────────────────────────────

/**
 * World-space stack position for JourneyFogField.
 * Must stay in (3000, 5050) — above unexplored Pressables, below explored tiles.
 */
export const FOG_FIELD_Z = 5000;

// ── Raster fog bank assets ────────────────────────────────────────────────────
//
// Metro bundler requires every require() argument to be a STATIC STRING LITERAL.
// No template literals, no dynamic paths.  All 18 push-15 assets declared here.

const FOG_BANKS = {
  day: {
    large01:  require('@/assets/ui/journey/fog/fog-bank-large-01-day.png')  as number,
    large02:  require('@/assets/ui/journey/fog/fog-bank-large-02-day.png')  as number,
    medium01: require('@/assets/ui/journey/fog/fog-bank-medium-01-day.png') as number,
    medium02: require('@/assets/ui/journey/fog/fog-bank-medium-02-day.png') as number,
    wisp01:   require('@/assets/ui/journey/fog/fog-wisp-01-day.png')        as number,
    wisp02:   require('@/assets/ui/journey/fog/fog-wisp-02-day.png')        as number,
  },
  evening: {
    large01:  require('@/assets/ui/journey/fog/fog-bank-large-01-evening.png')  as number,
    large02:  require('@/assets/ui/journey/fog/fog-bank-large-02-evening.png')  as number,
    medium01: require('@/assets/ui/journey/fog/fog-bank-medium-01-evening.png') as number,
    medium02: require('@/assets/ui/journey/fog/fog-bank-medium-02-evening.png') as number,
    wisp01:   require('@/assets/ui/journey/fog/fog-wisp-01-evening.png')        as number,
    wisp02:   require('@/assets/ui/journey/fog/fog-wisp-02-evening.png')        as number,
  },
  night: {
    large01:  require('@/assets/ui/journey/fog/fog-bank-large-01-night.png')  as number,
    large02:  require('@/assets/ui/journey/fog/fog-bank-large-02-night.png')  as number,
    medium01: require('@/assets/ui/journey/fog/fog-bank-medium-01-night.png') as number,
    medium02: require('@/assets/ui/journey/fog/fog-bank-medium-02-night.png') as number,
    wisp01:   require('@/assets/ui/journey/fog/fog-wisp-01-night.png')        as number,
    wisp02:   require('@/assets/ui/journey/fog/fog-wisp-02-night.png')        as number,
  },
} as const;

// ── Fog bank layout ───────────────────────────────────────────────────────────

/**
 * Fractional world-space placement descriptor for one fog bank image.
 *
 * xF, yF — top-left corner as fraction of worldWidth / worldHeight.
 *           Negative values allowed — banks may bleed left/above the world
 *           edge for a natural coverage with no hard seam.
 * wF, hF — size as fraction of worldWidth / worldHeight.
 * key    — which slot to pull from FOG_BANKS[shift].
 * base   — maximum opacity (before clearing influence reduces it).
 */
type BankDef = {
  readonly xF:   number;
  readonly yF:   number;
  readonly wF:   number;
  readonly hF:   number;
  readonly key:  keyof (typeof FOG_BANKS)['day'];
  readonly base: number;
};

/**
 * Six fog banks arranged so every world quadrant is covered, with heavy
 * central overlap.  The combined result reads as one organic fog mass.
 *
 * Layout strategy:
 *   large01  — upper-left primary anchor (heaviest bank)
 *   large02  — lower-right primary anchor (offsets the first for full coverage)
 *   medium01 — upper-right infill
 *   medium02 — lower-left infill
 *   wisp01   — central tendril crossing (adds internal density variation)
 *   wisp02   — lower-right trailing edge tendril
 */
const BANK_DEFS: readonly BankDef[] = [
  { xF: -0.08, yF: -0.08, wF: 0.75, hF: 0.62, key: 'large01',  base: 0.90 },
  { xF:  0.30, yF:  0.33, wF: 0.75, hF: 0.62, key: 'large02',  base: 0.88 },
  { xF:  0.37, yF: -0.06, wF: 0.56, hF: 0.50, key: 'medium01', base: 0.82 },
  { xF: -0.08, yF:  0.44, wF: 0.56, hF: 0.50, key: 'medium02', base: 0.80 },
  { xF:  0.10, yF:  0.10, wF: 0.45, hF: 0.26, key: 'wisp01',   base: 0.65 },
  { xF:  0.42, yF:  0.62, wF: 0.45, hF: 0.26, key: 'wisp02',   base: 0.60 },
];

// ── Clearing influence radii ───────────────────────────────────────────────────

/**
 * Clearing-influence radius in multiples of tile size (sz) per visibility state.
 *
 * A fog bank whose centre falls within this radius of a tile will have its
 * opacity attenuated — the closer the centre, the greater the attenuation.
 *
 * Larger radius = fog clears over a wider surrounding area.
 *
 *   current              — player stands in clear air; strongest clearing
 *   visibleNow           — active field of vision ring; strong clearing
 *   exploredButOutOfVision — remembered territory; gentle haze only
 */
const CLEAR_RADIUS: Record<string, number> = {
  current:                2.8,
  visibleNow:             2.2,
  exploredButOutOfVision: 1.3,
};

// ── SVG clearing overlay colours ──────────────────────────────────────────────

/**
 * Colour used by the SVG radial clearing gradients placed at visible tile centres.
 *
 * Each shift uses a soft hue that evokes "air and light breaking through" the
 * dominant fog palette.  These gradients are very low opacity (≤ 0.28 at peak)
 * — atmospheric hints, not hard cutouts.
 */
const CLEARING_COLOR: Record<'day' | 'evening' | 'night', string> = {
  day:     'rgba(210,235,255,1)',   // pale morning blue — dawn light in the mist
  evening: 'rgba(180,145,215,1)',   // muted lavender — lingering dusk glow
  night:   'rgba(50,110,175,1)',    // cold deep blue — moonlit fog thinning
};

// ── Clearing computation ───────────────────────────────────────────────────────

/**
 * Clearing source: a single tile contributing fog attenuation in its vicinity.
 */
type ClearSource = {
  readonly cx:     number;  // world-space tile centre X
  readonly cy:     number;  // world-space tile centre Y
  readonly radius: number;  // clearing influence radius in px
};

/**
 * Compute how much a fog bank at (bankCx, bankCy) should be cleared, as a
 * fraction in [0, 1].
 *
 * Returns the MAXIMUM clearing from any single tile (not additive).
 * Using max prevents overlapping fields of vision from over-clearing a bank
 * that lies between two visible tiles — the result is never darker than needed.
 *
 * Falloff is linear:
 *   dist = 0           → clearing = 1.0 (fully cleared)
 *   dist = radius      → clearing = 0.0 (no influence)
 *   dist > radius      → clearing = 0.0
 */
function computeClearing(
  bankCx:  number,
  bankCy:  number,
  sources: readonly ClearSource[],
): number {
  let max = 0;
  for (const src of sources) {
    const dist = Math.hypot(bankCx - src.cx, bankCy - src.cy);
    if (dist < src.radius) {
      const f = 1 - dist / src.radius;
      if (f > max) max = f;
    }
  }
  return max > 1 ? 1 : max;
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface JourneyFogFieldProps {
  /** Full tile array for the current run — all visibility states. */
  tiles:     readonly HexMapTile[];
  /** World coordinate system for this render (from computeHexWorldCoords). */
  coords:    HexWorldCoords;
  /** Shift at run creation — selects the right fog bank asset family. */
  timeOfDay: 'day' | 'evening' | 'night';
}

/**
 * JourneyFogField — continuous atmospheric fog field for the hex chapter map.
 *
 * Rendered as a world-space sibling of HexTile elements inside MapWorld.
 * Fog artwork (raster PNGs) is positioned in world space; the visibility mask
 * is code-driven from tile state; fog is NEVER drawn per HexTile.
 */
export function JourneyFogField({ tiles, coords, timeOfDay }: JourneyFogFieldProps) {
  const { worldWidth: W, worldHeight: H, sz } = coords;
  const assets       = FOG_BANKS[timeOfDay];
  const clearColor   = CLEARING_COLOR[timeOfDay];

  // ── 1. Clearing source set — derived from tile visibility ────────────────
  //
  // Build the clearing-influence source list once per tile-state change.
  // Only non-unexplored tiles contribute.  The current tile uses the 'current'
  // radius key regardless of its visibility field (always a strong clear).
  const clearSources = useMemo<readonly ClearSource[]>(() => {
    const out: ClearSource[] = [];
    for (const tile of tiles) {
      if (tile.visibility === 'unexplored') continue;
      const { cx, cy } = coords.axialToWorld(tile.q, tile.r);
      const key    = tile.current ? 'current' : tile.visibility;
      const radius = (CLEAR_RADIUS[key] ?? 1.3) * sz;
      out.push({ cx, cy, radius });
    }
    return out;
  }, [tiles, coords, sz]);

  // ── 2. Resolved fog bank placements ─────────────────────────────────────
  //
  // For each of the 6 bank defs, compute pixel position, size, and final opacity.
  // The fog bank's centre is used as the reference point for clearing.
  // Banks that are fully cleared (opacity ≤ 0.02) are dropped from the render
  // tree entirely — no empty Image nodes.
  const placements = useMemo(() => {
    return BANK_DEFS.map(def => {
      const x       = Math.round(def.xF * W);
      const y       = Math.round(def.yF * H);
      const w       = Math.round(def.wF * W);
      const h       = Math.round(def.hF * H);
      const bankCx  = x + w / 2;
      const bankCy  = y + h / 2;
      const clearing = computeClearing(bankCx, bankCy, clearSources);
      const opacity  = def.base * (1 - clearing);
      return { src: assets[def.key], x, y, w, h, opacity };
    }).filter(p => p.opacity > 0.02);   // skip fully-cleared banks
  }, [W, H, assets, clearSources]);

  // ── 3. SVG clearing overlay tile centres ────────────────────────────────
  //
  // Collect centres for visibleNow + current tiles to place the soft clearing
  // radial gradients.  ExploredButOutOfVision tiles are deliberately excluded —
  // they already sit above the fog (zIndex 5050) and adding a bright gradient
  // behind them would create a visible halo over dark explored territory.
  const clearingCentres = useMemo(
    () =>
      tiles
        .filter(t => t.visibility === 'visibleNow' || t.current)
        .map(t => coords.axialToWorld(t.q, t.r)),
    [tiles, coords],
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, styles.field]}
    >
      {/* ── Fog art layer: positioned raster fog banks ───────────────────────
        *
        * Six Image components covering the world in overlapping masses.
        * Each bank's opacity is attenuated in proportion to proximity to visible
        * tile centres.  No fog cloud shape is ever drawn in code — the art is
        * exclusively the Push 15 PNG assets.
        *
        * contentFit="fill": the transparent PNG is stretched to the computed
        * pixel dimensions.  The image's own soft feathered edges and irregular
        * silhouette prevent any rectangular matte artefact.
        *
        * cachePolicy="memory-disk": fog banks are large PNGs (1024 × 1024).
        * Keeping them decoded in memory prevents per-move decode stutter on
        * native as the player steps through unexplored territory.
        */}
      {placements.map((p, i) => (
        <Image
          key={i}
          source={p.src}
          style={{
            position: 'absolute',
            left:     p.x,
            top:      p.y,
            width:    p.w,
            height:   p.h,
            opacity:  p.opacity,
          }}
          contentFit="fill"
          cachePolicy="memory-disk"
        />
      ))}

      {/* ── Clearing overlay: atmospheric radials at visible tile centres ────
        *
        * A soft SVG radial gradient is placed at each visibleNow / current
        * tile centre.  Gradient peak opacity is 0.28 — an atmospheric hint
        * that suggests fog rolling back, not a hard pixel-exact cutout.
        *
        * The hard visibility boundary (tile content hidden vs. shown) is
        * handled entirely by HexTile z-ordering (exploredButOutOfVision at
        * z 5050, visibleNow at z 5100+).  This layer is purely presentational.
        *
        * Radius = 1.8 × sz: large enough to cover the hex body and one ring
        * of overlap into the adjacent fog bank.
        *
        * Gradient IDs are positional ("cl-0", "cl-1" …).  They are stable
        * within a single SVG document and are never shared across SVG elements.
        */}
      {clearingCentres.length > 0 && (
        <Svg
          width={W}
          height={H}
          style={StyleSheet.absoluteFillObject}
        >
          <Defs>
            {clearingCentres.map((c, i) => (
              <RadialGradient
                key={i}
                id={`cl-${i}`}
                cx={c.cx}
                cy={c.cy}
                r={sz * 1.8}
                fx={c.cx}
                fy={c.cy}
                gradientUnits="userSpaceOnUse"
              >
                {/* Peak at tile centre: fog almost absent */}
                <Stop offset="0%"   stopColor={clearColor} stopOpacity={0.28} />
                {/* Mid-ring: gentle thinning influence */}
                <Stop offset="50%"  stopColor={clearColor} stopOpacity={0.10} />
                {/* Edge: fully transparent — no hard boundary */}
                <Stop offset="100%" stopColor={clearColor} stopOpacity={0}    />
              </RadialGradient>
            ))}
          </Defs>
          {clearingCentres.map((c, i) => (
            <Circle
              key={i}
              cx={c.cx}
              cy={c.cy}
              r={sz * 1.8}
              fill={`url(#cl-${i})`}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  field: {
    zIndex: FOG_FIELD_Z,
  },
});
