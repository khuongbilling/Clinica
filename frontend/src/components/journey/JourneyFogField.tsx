/**
 * JourneyFogField.tsx — Push 17 (feathered fog around field of vision)
 *
 * Refactors Push 16's coarse per-bank opacity clearing into a continuous
 * per-pixel gradient field using an SVG <Mask>.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHITECTURE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Layer A — SVG gradient mask  (primary fog density field)
 *   ─────────────────────────────────────────────────────────
 *   A world-sized <Rect> filled with fogColor is masked by a <Mask> that
 *   encodes the visibility field:
 *
 *     • White base          → fog visible everywhere (default)
 *     • Black radial holes  → clearing at visibleNow / current tile centres
 *     • Dark-grey radials   → lighter mist at exploredButOutOfVision centres
 *
 *   Because adjacent black radials overlap and sum in the mask buffer, two
 *   neighbouring visibleNow tiles automatically merge their clearing zones
 *   into one smooth, organic, non-hex-shaped region.  No geometric hex
 *   cutout is ever visible.
 *
 *   Layer B — raster fog bank Images  (cloud texture)
 *   ─────────────────────────────────────────────────
 *   Six painted PNG fog banks (2 large + 2 medium + 2 wisp) from Push 15,
 *   rendered ON TOP of the SVG mask at a fixed low opacity (TEXTURE_ALPHA).
 *
 *   At full opacity the SVG fog rect occludes the underlying terrain in
 *   unexplored areas.  At the feathered boundary the SVG rect becomes
 *   partially transparent and the bank Images show through as cloud wisps.
 *   In the fully clear zone the SVG rect is transparent; the bank Images
 *   still contribute a small amount of atmospheric haze (≤ 25 %).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CLEARING RADII
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   CLEAR_R per tile state (multiples of sz):
 *     current              1.4 × sz  (player position: maximum clearing)
 *     visibleNow           1.2 × sz  (visible tile ring: strong clearing)
 *     exploredButOutOfVision 0.85 × sz (remembered terrain: light mist only)
 *
 *   Adjacent visibleNow tiles at ~0.8 × sz apart with CLEAR_R = 1.2 × sz
 *   overlap by ~0.4 × sz.  Their black radials merge in the mask buffer →
 *   one organic continuous clearing region with no hex geometry visible.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GRADIENT STOP DESIGN
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   visibleNow / current clearing gradient (mask = white base + black holes):
 *     0 %  → black, opacity 1.00  (fog absent: fully clear at tile centre)
 *    55 %  → black, opacity 0.88  (still mostly clear)
 *    80 %  → black, opacity 0.42  (entering feather zone: half-fog)
 *   100 %  → black, opacity 0.00  (full fog resumes beyond edge)
 *
 *   This produces a "plateau of clear air" surrounded by a soft feathered
 *   gradient — no sudden edge, no hex-shaped cutout.
 *
 *   exploredButOutOfVision mist gradient:
 *     0 %  → black, opacity 0.52  (fog thinned to ~half: memory mist)
 *   100 %  → black, opacity 0.00  (full fog resumes at edge)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Z-ORDERING (inside MapWorld Animated.View)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   unexplored tile Pressables     z  1–3000   (below fog)
 *   JourneyFogField                z  5000     (fog layer)
 *     ↳ SVG fog mask (Layer A)     — rendered first, appears behind
 *     ↳ bank Images  (Layer B)     — rendered after, appears in front
 *   exploredButOutOfVision HexTile z  5050     (above fog)
 *   visibleNow HexTile             z  5100+    (above fog)
 *   current HexTile                z  9999     (topmost)
 */

import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Mask, Rect, RadialGradient, Stop } from 'react-native-svg';

import type { HexMapTile } from '@/src/game/journeyMap/fixture';
import type { HexWorldCoords } from './hexWorldCoords';

// ── zIndex ─────────────────────────────────────────────────────────────────────

/**
 * World-space stack position for JourneyFogField.
 * Must stay in (3000, 5050) — above unexplored Pressables, below explored tiles.
 */
export const FOG_FIELD_Z = 5000;

// ── Raster fog bank assets ────────────────────────────────────────────────────
//
// Metro bundler requires every require() argument to be a STATIC STRING LITERAL.
// No template literals, no dynamic paths.  All 18 Push-15 assets declared here.

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

// ── Fog bank texture layout ───────────────────────────────────────────────────

/**
 * Fog bank placement in fractional world coordinates.
 * xF, yF may be negative (banks bleed beyond the world edge for natural coverage).
 */
type BankDef = {
  readonly xF:  number;
  readonly yF:  number;
  readonly wF:  number;
  readonly hF:  number;
  readonly key: keyof (typeof FOG_BANKS)['day'];
};

/**
 * Six fog bank placements covering all four world quadrants with heavy overlap.
 * Together they read as one continuous organic cloud mass when composited.
 *
 * In Push 17 these Images are texture only — they are NOT individually cleared
 * by visibility proximity.  The SVG mask layer (Layer A) handles all clearing.
 */
const BANK_DEFS: readonly BankDef[] = [
  { xF: -0.08, yF: -0.08, wF: 0.76, hF: 0.62, key: 'large01'  },
  { xF:  0.30, yF:  0.33, wF: 0.76, hF: 0.62, key: 'large02'  },
  { xF:  0.37, yF: -0.06, wF: 0.56, hF: 0.50, key: 'medium01' },
  { xF: -0.08, yF:  0.44, wF: 0.56, hF: 0.50, key: 'medium02' },
  { xF:  0.10, yF:  0.10, wF: 0.45, hF: 0.26, key: 'wisp01'   },
  { xF:  0.42, yF:  0.62, wF: 0.45, hF: 0.26, key: 'wisp02'   },
];

/**
 * Fixed opacity for fog bank texture Images.
 *
 * Banks are cloud-silhouette PNGs: only painted cloud areas carry pigment.
 * At TEXTURE_ALPHA they read as wisps / atmospheric haze visible at clearing
 * boundaries and just perceptible in the clear zone.  The primary fog density
 * is handled entirely by the SVG mask layer.
 */
const TEXTURE_ALPHA = 0.25;

// ── Per-shift fog field parameters ───────────────────────────────────────────

/**
 * SVG fog rect fill colour and base opacity per time-of-day shift.
 *
 * These drive the primary fog density.  Choosing a dark, saturated colour
 * prevents the fog from reading as a simple grey overlay and ties it to the
 * Ink & Mist palette.
 *
 *   day     — pale overcast blue; lighter alpha (daylight penetrates more)
 *   evening — deep indigo-purple; heavy alpha (dusk fog presses in)
 *   night   — near-black navy ink; maximum alpha (fog is almost impenetrable)
 */
const FOG_PARAMS: Record<'day' | 'evening' | 'night', { color: string; alpha: number }> = {
  day:     { color: '#bdd4e8', alpha: 0.82 },
  evening: { color: '#2a1950', alpha: 0.90 },
  night:   { color: '#0e1428', alpha: 0.95 },
};

// ── Clearing radius factors ───────────────────────────────────────────────────

/**
 * Radial clearing radius in multiples of tile size (sz) per visibility state.
 *
 * Adjacent visibleNow tiles at ~0.8 × sz apart have overlapping clearing
 * radii at CLEAR_R = 1.2 × sz, blending into one organic merged clear zone.
 *
 * The CLEAR_R values are deliberately chosen so:
 *   1. A single isolated visibleNow tile has a clearly perceptible clear area
 *      that exceeds its hex body (radius > 0.5 × sz).
 *   2. Adjacent visibleNow tiles merge (CLEAR_R > adjacent-tile spacing / 2).
 *   3. The feather gradient extends ~0.3 × sz into the first unexplored ring,
 *      which reads as "fog edges naturally approaching the visible zone."
 */
const CLEAR_R = {
  current:                1.4,   // player position: widest clearing
  visibleNow:             1.2,   // visible ring: strong clearing, merges with neighbours
  exploredButOutOfVision: 0.85,  // remembered terrain: light mist thinning only
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

export interface JourneyFogFieldProps {
  /** Full tile array for the current run — all visibility states. */
  tiles:     readonly HexMapTile[];
  /** World coordinate system for this render (from computeHexWorldCoords). */
  coords:    HexWorldCoords;
  /** Shift frozen at run creation — selects fog bank asset family and palette. */
  timeOfDay: 'day' | 'evening' | 'night';
}

/**
 * JourneyFogField — feathered atmospheric fog around field of vision (Push 17).
 *
 * Renders two stacked layers inside MapWorld at zIndex 5000:
 *
 *   Layer A  SVG gradient mask — primary fog density with organic per-pixel
 *            clearing.  No hex geometry, no square boundaries.
 *
 *   Layer B  Raster bank Images — cloud texture at low opacity, visible at
 *            feathered clearing boundaries and as atmospheric wisps in the
 *            clear zone.
 */
export function JourneyFogField({ tiles, coords, timeOfDay }: JourneyFogFieldProps) {
  const { worldWidth: W, worldHeight: H, sz } = coords;
  const assets  = FOG_BANKS[timeOfDay];
  const { color: fogColor, alpha: fogAlpha } = FOG_PARAMS[timeOfDay];

  // ── Build clearing sources ────────────────────────────────────────────────
  //
  // Separate visibleNow/current from exploredButOutOfVision so they can
  // receive different gradient stop profiles:
  //   visible  → deep black holes (nearly clear at centre)
  //   explored → dark-grey holes (half-fog "memory mist")
  //
  // current tile uses the 'current' key regardless of its visibility field.
  type ClearCentre = { cx: number; cy: number; r: number };

  const { visibleCentres, exploredCentres } = useMemo(() => {
    const vis: ClearCentre[]  = [];
    const exp: ClearCentre[]  = [];
    for (const tile of tiles) {
      if (tile.visibility === 'unexplored') continue;
      const { cx, cy } = coords.axialToWorld(tile.q, tile.r);
      if (tile.current || tile.visibility === 'visibleNow') {
        const factor = tile.current ? CLEAR_R.current : CLEAR_R.visibleNow;
        vis.push({ cx, cy, r: factor * sz });
      } else {
        // exploredButOutOfVision
        exp.push({ cx, cy, r: CLEAR_R.exploredButOutOfVision * sz });
      }
    }
    return { visibleCentres: vis, exploredCentres: exp };
  }, [tiles, coords, sz]);

  // ── Resolved bank Image placements ───────────────────────────────────────
  const bankPlacements = useMemo(
    () =>
      BANK_DEFS.map(def => ({
        src: assets[def.key],
        x:   Math.round(def.xF * W),
        y:   Math.round(def.yF * H),
        w:   Math.round(def.wF * W),
        h:   Math.round(def.hF * H),
      })),
    [W, H, assets],
  );

  const hasClearZones = visibleCentres.length > 0 || exploredCentres.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, styles.field]}
    >
      {/*
        ── Layer A: SVG gradient mask — PRIMARY fog density field ─────────────
        *
        * A single world-sized <Rect> filled with fogColor is masked by the
        * <Mask> element.  The mask encodes the visibility field as:
        *
        *   white base              → fog opaque everywhere by default
        *   black radial gradient   → clearing at visible tile centres
        *   dark-grey radial        → mist at explored-but-out-of-vision centres
        *
        * Where adjacent black radials overlap, the mask buffer is at full
        * black → the fog rect is fully transparent there → clean merged
        * organic clear region.  No hex boundary is ever painted.
        *
        * When hasClearZones is false (all tiles unexplored, e.g. fresh run),
        * the mask body is all white → full fog everywhere.  The <Mask> is
        * skipped entirely and the <Rect> renders at full fogAlpha.
        */}
      <Svg
        width={W}
        height={H}
        style={StyleSheet.absoluteFillObject}
      >
        {hasClearZones && (
          <Defs>
            <Mask
              id="fog-mask"
              x={0}
              y={0}
              width={W}
              height={H}
              maskContentUnits="userSpaceOnUse"
            >
              {/* White base: fog visible everywhere unless overridden below */}
              <Rect x={0} y={0} width={W} height={H} fill="white" />

              {/*
                ── Clearing holes at visibleNow / current tile centres ──────
                *
                * Gradient design (black over white base):
                *
                *   0%  → black opacity 1.00  — fully clear: fog absent
                *  55%  → black opacity 0.88  — still clear (plateau of clear air)
                *  80%  → black opacity 0.42  — entering feather zone
                * 100%  → black opacity 0.00  — fog fully resumes at edge
                *
                * The plateau (0%→55%) ensures the hex tile body is fully
                * clear, not just its precise centre point.
                * The feather (55%→100%) creates a soft gradual transition.
                *
                * When two clearing circles overlap, their black contributions
                * accumulate in the mask buffer → deeper black → clear region
                * seamlessly widens without any sharp join.
                */}
              {visibleCentres.map((c, i) => (
                <RadialGradient
                  key={`vh-${i}`}
                  id={`vh-${i}`}
                  cx={c.cx}
                  cy={c.cy}
                  r={c.r}
                  fx={c.cx}
                  fy={c.cy}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0%"   stopColor="black" stopOpacity={1.00} />
                  <Stop offset="55%"  stopColor="black" stopOpacity={0.88} />
                  <Stop offset="80%"  stopColor="black" stopOpacity={0.42} />
                  <Stop offset="100%" stopColor="black" stopOpacity={0.00} />
                </RadialGradient>
              ))}
              {visibleCentres.map((c, i) => (
                <Circle
                  key={`vc-${i}`}
                  cx={c.cx}
                  cy={c.cy}
                  r={c.r}
                  fill={`url(#vh-${i})`}
                />
              ))}

              {/*
                ── Memory mist at exploredButOutOfVision tile centres ────────
                *
                * Gradient design:
                *
                *   0%  → black opacity 0.52  — mist thinned to ~half density
                * 100%  → black opacity 0.00  — full fog resumes at edge
                *
                * Effect on fog rect: opacity ≈ fogAlpha × (1 − 0.52) ≈ 45%.
                * The tile itself paints above the fog at z 5050 and is fully
                * visible regardless; the mist creates an atmospheric haze
                * around the tile edges that distinguishes "remembered" from
                * "unexplored" territory.
                */}
              {exploredCentres.map((c, i) => (
                <RadialGradient
                  key={`eh-${i}`}
                  id={`eh-${i}`}
                  cx={c.cx}
                  cy={c.cy}
                  r={c.r}
                  fx={c.cx}
                  fy={c.cy}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0%"   stopColor="black" stopOpacity={0.52} />
                  <Stop offset="100%" stopColor="black" stopOpacity={0.00} />
                </RadialGradient>
              ))}
              {exploredCentres.map((c, i) => (
                <Circle
                  key={`ec-${i}`}
                  cx={c.cx}
                  cy={c.cy}
                  r={c.r}
                  fill={`url(#eh-${i})`}
                />
              ))}
            </Mask>
          </Defs>
        )}

        {/*
          The fog density rectangle.
          When hasClearZones is true: masked by "fog-mask" → clearing holes.
          When hasClearZones is false: no mask → uniform full-opacity fog.
          maskUnits defaults to "objectBoundingBox" for the <Rect>; we pass
          the mask id as a string so the SVG engine resolves it correctly.
        */}
        <Rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill={fogColor}
          opacity={fogAlpha}
          mask={hasClearZones ? 'url(#fog-mask)' : undefined}
        />
      </Svg>

      {/*
        ── Layer B: Raster fog bank Images — cloud texture ─────────────────────
        *
        * Six painted PNG fog banks from Push 15, rendered ON TOP of the SVG
        * layer at a fixed low opacity (TEXTURE_ALPHA = 0.25).
        *
        * Role: cloud-silhouette texture visible at feathered clearing edges.
        *
        * These are NOT driven by visibility proximity.  Their opacity is fixed.
        * In the clear zone, the SVG fog rect is transparent; the bank Images
        * contribute a faint atmospheric haze (≤ 25% × cloud coverage ≈ 8-10%).
        * At the feathered boundary, both layers are partially visible and their
        * overlap reads as soft organic fog texture.
        *
        * contentFit="fill" stretches each bank to its computed pixel bounds;
        * the PNG's own irregular cloud silhouette prevents rectangular edges.
        *
        * cachePolicy="memory-disk" keeps decoded frames resident so that
        * player movement doesn't cause per-step PNG decode stutter on native.
        */}
      {bankPlacements.map((p, i) => (
        <Image
          key={i}
          source={p.src}
          style={{
            position: 'absolute',
            left:     p.x,
            top:      p.y,
            width:    p.w,
            height:   p.h,
            opacity:  TEXTURE_ALPHA,
          }}
          contentFit="fill"
          cachePolicy="memory-disk"
        />
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  field: {
    zIndex: FOG_FIELD_Z,
  },
});
