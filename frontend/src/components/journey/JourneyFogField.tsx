/**
 * JourneyFogField.tsx — Push 25 (pure-raster cloud fog)
 *
 * Replaces the Push 17 SVG-mask architecture.  The fog is now driven
 * entirely by raster assets — no SVG element of any kind.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHITECTURE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Layer 0 — dark base View  (React Native, no SVG)
 *   ──────────────────────────────────────────────────
 *   A solid-colour View covers the entire fog field.  Its backgroundColor and
 *   opacity are shift-tuned to give unexplored areas their characteristic deep
 *   shadow.  The explored tiles that render above the fog field (z ≥ 5050)
 *   show through normally — this layer only affects tiles below z 5000.
 *
 *   Layer 1 — 12 overlapping cloud bank Images  (primary fog body)
 *   ──────────────────────────────────────────────────────────────
 *   Twelve placements of the six Push-15 cloud bank PNGs (large01/02,
 *   medium01/02, wisp01/02) cover the entire map with heavy overlap and bleed
 *   beyond all four world edges.  Each placement carries an independently
 *   computed opacity:
 *
 *     • Full fog (CLOUD_ALPHA_MAX = 0.82) when the bank centre is more than
 *       CLOUD_CLEAR_START_F × sz away from every visible tile centre.
 *     • Linear ramp to 0 as the bank centre approaches within
 *       CLOUD_CLEAR_FULL_F × sz of any visible tile centre.
 *     • 0 when the bank centre is inside CLOUD_CLEAR_FULL_F × sz.
 *
 *   This makes the cloud PNGs the actual fog body.  Banks far from the player
 *   render at full density; banks near the clearing zone fade organically.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CLEARING
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Three visibility tiers use different clearing radii:
 *
 *     current                startR = 1.8 × sz   fullR = 0.5 × sz
 *     visibleNow             startR = 1.5 × sz   fullR = 0.4 × sz
 *     exploredButOutOfVision startR = 0.9 × sz   fullR = 0.2 × sz
 *
 *   The per-bank opacity is set by the single tile centre that produces the
 *   MOST clearing (minimum clearFactor across all centres).  Two adjacent
 *   visible tiles will naturally produce a merged, wider clearing because both
 *   independently pull the bank opacity down, and the minimum wins.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY NOT SVG
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Push 17's SVG mask produced smooth per-pixel gradient clearing — but the
 *   visual it cleared was a flat solid-colour <Rect> at 0.82–0.95 opacity.
 *   The cloud PNGs were secondary texture at 0.25 opacity, barely visible.
 *   The result looked like a coloured glass overlay with wisps, not cloud cover.
 *
 *   In Push 25 the cloud PNGs are the fog.  The clearing operates on the
 *   cloud images directly through per-bank opacity.  At game scale the
 *   bank-centre approximation is imperceptible — each bank spans 40–72 % of
 *   world width, so the fade zone covers hundreds of pixels of natural
 *   cloud texture.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Z-ORDERING (inside MapWorld Animated.View)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   unexplored tile Pressables     z  1–3000   (below fog — covered)
 *   JourneyFogField                z  5000     (fog field)
 *     ↳ dark base View             — Layer 0, appears behind cloud banks
 *     ↳ cloud bank Images          — Layer 1, primary fog visual
 *   exploredButOutOfVision HexTile z  5050     (above fog — visible)
 *   visibleNow HexTile             z  5100+    (above fog)
 *   current HexTile                z  9999     (topmost)
 */

import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

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

// ── Per-shift dark base ────────────────────────────────────────────────────────
//
// Layer 0: solid-colour View that provides the deep-shadow backdrop for all
// unexplored areas.  No SVG — plain React Native View.
//
//   day     — pale overcast blue-grey  (atmosphere, not darkness)
//   evening — deep indigo-purple       (twilight heaviness)
//   night   — near-black navy          (impenetrable dark)

const DARK_BASE_COLOR: Record<'day' | 'evening' | 'night', string> = {
  day:     '#8aacbf',
  evening: '#140c20',
  night:   '#060a16',
};

const DARK_BASE_ALPHA: Record<'day' | 'evening' | 'night', number> = {
  day:     0.28,
  evening: 0.42,
  night:   0.50,
};

// ── Cloud bank density & clearing ─────────────────────────────────────────────

/**
 * Maximum opacity for a cloud bank Image when fully outside all clearing zones.
 * This is the primary fog density value — the cloud texture is the fog body.
 */
const CLOUD_ALPHA_MAX = 0.82;

/**
 * Per-visibility-state clearing radii, expressed as multiples of sz (tile size).
 *
 *   startR  — bank begins fading when bank centre is this far from tile centre
 *   fullR   — bank is fully transparent at or below this distance
 *
 * Larger radii for current / visibleNow produce wide organic clearing.
 * Smaller radii for exploredButOutOfVision produce light memory misting only.
 */
const CLEAR_PARAMS = {
  current:                { startR: 1.8, fullR: 0.5 },
  visibleNow:             { startR: 1.5, fullR: 0.4 },
  exploredButOutOfVision: { startR: 0.9, fullR: 0.2 },
} as const;

// ── Fog bank placement ─────────────────────────────────────────────────────────

/**
 * Fog bank placement in fractional world coordinates.
 * xF/yF may be negative — banks bleed beyond world edges for natural coverage.
 */
type BankDef = {
  readonly xF:  number;
  readonly yF:  number;
  readonly wF:  number;
  readonly hF:  number;
  readonly key: keyof (typeof FOG_BANKS)['day'];
};

/**
 * Twelve fog bank placements for full-map coverage with heavy overlap.
 *
 * Four rows of large/medium banks cover every quadrant.  Wisp banks fill
 * seams and add depth variation.  The xF/yF overhangs (negative values and
 * values > 0.5) ensure no gap appears at world edges even on wide viewports.
 *
 * The same six PNG keys appear multiple times — reusing a texture at a
 * different position/size is how games achieve varied cloud cover from a
 * small asset set.
 */
const BANK_DEFS: readonly BankDef[] = [
  // ── Large banks — four-quadrant primary coverage ──────────────────────────
  { xF: -0.12, yF: -0.14, wF: 0.75, hF: 0.60, key: 'large01'  },
  { xF:  0.37, yF: -0.10, wF: 0.75, hF: 0.60, key: 'large02'  },
  { xF: -0.10, yF:  0.43, wF: 0.75, hF: 0.60, key: 'large02'  },
  { xF:  0.35, yF:  0.41, wF: 0.75, hF: 0.60, key: 'large01'  },
  // ── Medium banks — mid-row fill, vertical seam coverage ──────────────────
  { xF:  0.10, yF:  0.17, wF: 0.64, hF: 0.52, key: 'medium01' },
  { xF: -0.06, yF:  0.27, wF: 0.62, hF: 0.50, key: 'medium02' },
  { xF:  0.44, yF:  0.25, wF: 0.62, hF: 0.50, key: 'medium01' },
  { xF:  0.08, yF:  0.61, wF: 0.60, hF: 0.46, key: 'medium02' },
  // ── Wisp banks — gap fill and depth layering ──────────────────────────────
  { xF:  0.18, yF: -0.06, wF: 0.48, hF: 0.36, key: 'wisp01'   },
  { xF: -0.08, yF:  0.53, wF: 0.48, hF: 0.34, key: 'wisp02'   },
  { xF:  0.50, yF:  0.58, wF: 0.46, hF: 0.32, key: 'wisp01'   },
  { xF:  0.28, yF:  0.73, wF: 0.46, hF: 0.32, key: 'wisp02'   },
];

// ── Clearing source type ───────────────────────────────────────────────────────

type ClearSource = {
  cx:     number;
  cy:     number;
  startR: number;   // already multiplied by sz
  fullR:  number;   // already multiplied by sz
};

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
 * JourneyFogField — pure-raster cloud fog field (Push 25).
 *
 * Renders two layers inside MapWorld at zIndex 5000:
 *
 *   Layer 0  Dark base View — shift-tinted atmospheric backdrop (no SVG).
 *
 *   Layer 1  12 cloud bank Images — the actual fog body.  Per-bank opacity is
 *            driven by proximity to visible tile centres.  Banks far from the
 *            player appear at full density; banks near visible tiles fade to 0.
 */
export function JourneyFogField({ tiles, coords, timeOfDay }: JourneyFogFieldProps) {
  const { worldWidth: W, worldHeight: H, sz } = coords;
  const assets = FOG_BANKS[timeOfDay];

  // ── Build clearing sources ────────────────────────────────────────────────
  //
  // Each non-unexplored tile contributes one ClearSource.  startR / fullR are
  // pre-multiplied by sz so the useMemo below does not re-run when sz changes
  // independently — sz changes only when containerWidth changes, which also
  // recomputes coords and invalidates this memo anyway.
  const clearSources: readonly ClearSource[] = useMemo(() => {
    const sources: ClearSource[] = [];
    for (const tile of tiles) {
      if (tile.visibility === 'unexplored') continue;
      const { cx, cy } = coords.axialToWorld(tile.q, tile.r);
      const tier =
        tile.current              ? CLEAR_PARAMS.current :
        tile.visibility === 'visibleNow' ? CLEAR_PARAMS.visibleNow :
        CLEAR_PARAMS.exploredButOutOfVision;
      sources.push({
        cx,
        cy,
        startR: tier.startR * sz,
        fullR:  tier.fullR  * sz,
      });
    }
    return sources;
  }, [tiles, coords, sz]);

  // ── Resolve bank placements with per-bank clearing opacity ────────────────
  const bankPlacements = useMemo(() => {
    return BANK_DEFS.map(def => {
      const x = Math.round(def.xF * W);
      const y = Math.round(def.yF * H);
      const w = Math.round(def.wF * W);
      const h = Math.round(def.hF * H);

      // Use the bank's geometric centre as the clearing probe point.
      // Each bank spans 40–75 % of world width — the centre approximation
      // is appropriate at this scale; per-pixel mask is not needed.
      const bankCx = x + w * 0.5;
      const bankCy = y + h * 0.5;

      // Find the single clear source that produces the MOST clearing for
      // this bank (minimum clearFactor → maximum transparency).
      let minClearFactor = 1.0;   // 1.0 = no clearing, 0.0 = fully transparent
      for (const src of clearSources) {
        const dist = Math.hypot(src.cx - bankCx, src.cy - bankCy);
        const f =
          dist <= src.fullR  ? 0 :
          dist >= src.startR ? 1 :
          (dist - src.fullR) / (src.startR - src.fullR);
        if (f < minClearFactor) minClearFactor = f;
        if (minClearFactor === 0) break;  // can't go lower
      }

      return {
        src:     assets[def.key],
        x, y, w, h,
        opacity: CLOUD_ALPHA_MAX * minClearFactor,
      };
    });
  }, [W, H, assets, clearSources]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, styles.field]}
    >
      {/*
        ── Layer 0: dark base View ──────────────────────────────────────────────
        *
        * Provides the atmospheric darkness behind the cloud banks.
        * The solid colour with shift-tuned opacity replaces the SVG <Rect>
        * used in Push 17.  No clearing is applied — the base is always
        * present.  Explored tiles render above this at z ≥ 5050 and appear
        * normally.  Only truly unexplored tiles (z 1–3000) are shadowed.
        */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: DARK_BASE_COLOR[timeOfDay],
            opacity:         DARK_BASE_ALPHA[timeOfDay],
          },
        ]}
      />

      {/*
        ── Layer 1: cloud bank Images — PRIMARY fog visual ──────────────────────
        *
        * Twelve cloud bank PNGs rendered at per-bank clearing opacity.
        * Far from visible tiles → full opacity (dense cloud cover).
        * Near visible tiles → fades to 0 (organic clearing).
        *
        * contentFit="fill" stretches each bank to its fractional world bounds.
        * The PNG's own irregular cloud silhouette prevents rectangular edges.
        *
        * cachePolicy="memory-disk" keeps decoded frames resident so player
        * movement doesn't cause per-step PNG decode stutter on native.
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
            opacity:  p.opacity,
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
