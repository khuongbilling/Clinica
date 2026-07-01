/**
 * Ward Defense V2 — Lotus Healing Sanctum
 *
 * INTERACTIVE MAP — built from drawn React Native components.
 * No screenshot used as background. Every visual layer is a
 * coded React Native component that mirrors the reference composition.
 *
 *   Layer 0  bg       — SanctuaryBackground (drawn garden scene)
 *   Layer 1  lane     — solid stone path following PATH_WPS (opaque, not overlay)
 *   Layer 2  pads     — six stone octagonal deploy platforms (tappable)
 *   Layer 3  gate     — Disease Gate portal (upper-left, built into scene)
 *   Layer 4  lantern  — Vital Lantern shrine (upper-right, built into scene)
 *   Layer 5  vignette
 *   Layer 6  heroes   — animated hero sprites on pads
 *   Layer 7  proj     — projectile bursts
 *   Layer 8  enemies  — animated enemy sprites walking the lane
 *
 * COORDINATE SYSTEM: px = fx * aw,  py = fy * ah
 */
import React from "react";
import {
  View, Text, Animated, Pressable, StyleSheet, LayoutChangeEvent,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

/* ─── Path — clockwise loop around 2×3 center platform cluster ─────────────
   Enemies spawn at Disease Gate (upper-left), travel clockwise around the
   six-pad center zone, and exit at Vital Lantern (upper-right). */
export const PATH_WPS: [number, number][] = [
  [0.13, 0.18],  /*  0  Disease Gate spawn       */
  [0.18, 0.22],  /*  1  upper-left turn          */
  [0.32, 0.22],  /*  2  top lane left            */
  [0.50, 0.22],  /*  3  top lane center          */
  [0.70, 0.22],  /*  4  top lane right           */
  [0.82, 0.32],  /*  5  right turn               */
  [0.82, 0.48],  /*  6  right lane               */
  [0.72, 0.60],  /*  7  bottom-right turn        */
  [0.50, 0.64],  /*  8  bottom lane center       */
  [0.28, 0.60],  /*  9  bottom-left turn         */
  [0.18, 0.48],  /* 10  left lane                */
  [0.18, 0.34],  /* 11  left-top                 */
  [0.30, 0.24],  /* 12  inner top-left           */
  [0.58, 0.24],  /* 13  inner top-right          */
  [0.80, 0.22],  /* 14  final approach           */
  [0.88, 0.18],  /* 15  Vital Lantern exit       */
];

/* Six deploy pads — 2 rows × 3 cols, centered in the platform zone */
export const DEPLOY_TILES: [number, number][] = [
  [0.36, 0.36], [0.50, 0.36], [0.64, 0.36],
  [0.36, 0.51], [0.50, 0.51], [0.64, 0.51],
];

/* ─── Assets ────────────────────────────────────────────────────────────── */
const IMG_UNITS: Record<string, any> = {
  ward_scout:  require("../assets/heroes/battle/apprentice_seer.png"),
  mist_caster: require("../assets/heroes/battle/village_caretaker.png"),
  o2_healer:   require("../assets/heroes/battle/novice_guardian.png"),
};

const IMG_ENEMIES: Record<string, any> = {
  breathless_wisp:    require("../assets/images/enemy_breathless_wisp.png"),
  wheeze_sprite:      require("../assets/images/enemy_wheeze_sprite.png"),
  mucus_slime:        require("../assets/images/enemy_mucus_slime.png"),
  hypoxia_wraith:     require("../assets/images/enemy_hypoxia_wraith.png"),
  bronchospasm_drake: require("../assets/images/enemy_bronchospasm_drake.png"),
};

const ENEMY_COLOR: Record<string, string> = {
  breathless_wisp:    "#93c5fd",
  wheeze_sprite:      "#34d399",
  mucus_slime:        "#86efac",
  hypoxia_wraith:     "#c4b5fd",
  bronchospasm_drake: "#fb923c",
};

/* ─── Props ─────────────────────────────────────────────────────────────── */
export interface WardBoardV2Props {
  aw: number; ah: number;
  onLayout: (e: LayoutChangeEvent) => void;
  enemies: any[];
  deployedUnits: any[];
  projectiles: any[];
  stability: number;
  phase: string;
  wave: number;
  selectedUnit: string | null;
  ap: number;
  bobY: Animated.AnimatedInterpolation<number>;
  spawnQueueLen: number;
  mergeTileSet: Set<number>;
  onTilePress: (i: number) => void;
  canAfford: boolean;
  unitColors: Record<string, string>;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lp = (a: number, b: number, t: number)   => a + (b - a) * cl(t, 0, 1);

function getEnemyFrac(e: { pathIndex: number; pathProgress: number }): [number, number] {
  const pi   = cl(e.pathIndex, 0, PATH_WPS.length - 2);
  const from = PATH_WPS[pi];
  const to   = PATH_WPS[pi + 1];
  return [lp(from[0], to[0], e.pathProgress), lp(from[1], to[1], e.pathProgress)];
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 0 — SANCTUARY BACKGROUND
   Drawn garden/temple scene. No screenshot used. Matches reference composition:
   dark blue-green garden, central stone platform, lotus pond below,
   dense foliage at edges, stone lanterns, gate arch (left), pagoda (right).
   ═══════════════════════════════════════════════════════════════════════════ */
function SanctuaryBackground({ aw, ah }: { aw: number; ah: number }) {
  if (aw < 20 || ah < 20) return null;

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 0, pointerEvents: "none" }]}>

      {/* ── Deep garden base gradient ── */}
      <LinearGradient
        colors={["#08171000", "#0E2419", "#122C1E", "#091913"]}
        start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={["#081710FF", "#0E241980", "#00000000", "#09191380"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── Corner foliage masses ── */}
      {([
        [0,      0,      0.24, 0.28],
        [0.76,   0,      0.24, 0.28],
        [0,      0.72,   0.24, 0.28],
        [0.76,   0.72,   0.24, 0.28],
        [0,      0.24,   0.16, 0.48],   /* left edge dense brush */
        [0.84,   0.24,   0.16, 0.48],   /* right edge dense brush */
      ] as [number, number, number, number][]).map(([fx, fy, fw, fh], i) => (
        <View key={`fol${i}`} style={{
          position: "absolute",
          left: fx * aw, top: fy * ah,
          width: fw * aw, height: fh * ah,
          borderRadius: 14,
          backgroundColor: i < 4 ? "#0D2419" : "#0F2B1B",
        }} />
      ))}

      {/* ── Additional inner foliage blobs ── */}
      {([
        [0.04, 0.30, 0.10, 0.18, "#0C2317"],
        [0.86, 0.30, 0.10, 0.18, "#0C2317"],
        [0.06, 0.52, 0.10, 0.14, "#0B2115"],
        [0.84, 0.52, 0.10, 0.14, "#0B2115"],
      ] as [number, number, number, number, string][]).map(([fx, fy, fw, fh, col], i) => (
        <View key={`ib${i}`} style={{
          position: "absolute",
          left: fx * aw, top: fy * ah,
          width: fw * aw, height: fh * ah,
          borderRadius: 10,
          backgroundColor: col,
        }} />
      ))}

      {/* ── Stone arch frame — Disease Gate area (upper-left) ── */}
      <View style={{
        position: "absolute",
        left: aw * 0.03, top: ah * 0.03,
        width: aw * 0.23, height: ah * 0.32,
        borderRadius: 10, borderTopLeftRadius: 40, borderTopRightRadius: 40,
        backgroundColor: "#101E16",
        borderWidth: 1.5, borderColor: "#1E3828",
      }} />
      <View style={{
        position: "absolute",
        left: aw * 0.06, top: ah * 0.04,
        width: aw * 0.17, height: ah * 0.26,
        borderRadius: 8, borderTopLeftRadius: 30, borderTopRightRadius: 30,
        backgroundColor: "#0C1810",
        borderWidth: 1, borderColor: "#162E22",
      }} />

      {/* ── Pagoda/Temple frame — Vital Lantern area (upper-right) ── */}
      <View style={{
        position: "absolute",
        left: aw * 0.74, top: ah * 0.03,
        width: aw * 0.23, height: ah * 0.32,
        borderRadius: 10, borderTopLeftRadius: 40, borderTopRightRadius: 40,
        backgroundColor: "#101E16",
        borderWidth: 1.5, borderColor: "#1E3828",
      }} />
      {/* Pagoda roof tiers */}
      {[0, 1, 2].map(i => (
        <View key={`prT${i}`} style={{
          position: "absolute",
          left: aw * (0.76 + i * 0.012),
          top: ah * (0.045 + i * 0.025),
          width: aw * (0.19 - i * 0.024),
          height: 6,
          borderRadius: 3,
          backgroundColor: "#1A3222",
          borderWidth: 0.5, borderColor: "#2A4832",
        }} />
      ))}

      {/* ── Raised stone platform — center pad area ── */}
      <View style={{
        position: "absolute",
        left: aw * 0.21, top: ah * 0.23,
        width: aw * 0.58, height: ah * 0.42,
        borderRadius: 10,
        backgroundColor: "#141F18",
        borderWidth: 2, borderColor: "#223D2E",
      }} />
      {/* Inner platform highlight */}
      <View style={{
        position: "absolute",
        left: aw * 0.24, top: ah * 0.25,
        width: aw * 0.52, height: ah * 0.38,
        borderRadius: 8,
        backgroundColor: "#172318",
        borderWidth: 1, borderColor: "#1E3428",
      }} />

      {/* ── Lotus pond — bottom center ── */}
      <View style={{
        position: "absolute",
        left: aw * 0.24, top: ah * 0.65,
        width: aw * 0.52, height: ah * 0.24,
        borderRadius: aw * 0.12,
        backgroundColor: "#0A3048",
        borderWidth: 1.5, borderColor: "#164E6E",
      }} />
      {/* Lily pad blobs on water */}
      {([
        [0.32, 0.72, "#0F4A30"],
        [0.50, 0.70, "#0D4028"],
        [0.68, 0.72, "#0F4A30"],
        [0.41, 0.76, "#0E3E26"],
        [0.60, 0.76, "#0E3E26"],
      ] as [number, number, string][]).map(([fx, fy, col], i) => (
        <View key={`lp${i}`} style={{
          position: "absolute",
          left: fx * aw - 9, top: fy * ah - 6,
          width: 18, height: 12,
          borderRadius: 9,
          backgroundColor: col,
        }} />
      ))}
      {/* Lotus blossoms */}
      {([[0.33, 0.72], [0.50, 0.70], [0.67, 0.72]] as [number, number][]).map(([fx, fy], i) => (
        <Text key={`lotus${i}`} style={{
          position: "absolute",
          left: fx * aw - 9, top: fy * ah - 9,
          fontSize: 14, opacity: 0.85,
        }}>🌸</Text>
      ))}

      {/* ── Stone lanterns — left and right mid ── */}
      {([[0.095, 0.48], [0.905, 0.48]] as [number, number][]).map(([fx, fy], i) => (
        <View key={`ln${i}`} style={{
          position: "absolute",
          left: fx * aw - 11, top: fy * ah - 22,
          width: 22, height: 40,
          alignItems: "center",
          zIndex: 1,
        }}>
          {/* Roof cap */}
          <View style={{
            width: 22, height: 5, borderRadius: 2,
            backgroundColor: "#2A1800",
            borderWidth: 0.5, borderColor: "#4A3010",
          }} />
          {/* Body */}
          <View style={{
            width: 16, height: 18, borderRadius: 4,
            backgroundColor: "#4A2E00",
            borderWidth: 1.5, borderColor: "#7A5000",
            alignItems: "center", justifyContent: "center",
            ...({ boxShadow: "0 0 10px #FF8C0050" } as any),
          }}>
            <View style={{
              width: 8, height: 10, borderRadius: 2,
              backgroundColor: "#FF990030",
              borderWidth: 0.5, borderColor: "#FF990060",
            }} />
          </View>
          {/* Pole */}
          <View style={{ width: 4, height: 14, backgroundColor: "#2A1800", borderRadius: 2 }} />
          {/* Base stone */}
          <View style={{ width: 18, height: 5, borderRadius: 3, backgroundColor: "#1E1400" }} />
        </View>
      ))}

      {/* ── Stone steps below platform ── */}
      {[0, 1, 2].map(i => (
        <View key={`step${i}`} style={{
          position: "absolute",
          left: aw * (0.32 + i * 0.012),
          top: ah * 0.637 + i * 4,
          width: aw * (0.36 - i * 0.024),
          height: 4.5,
          borderRadius: 2,
          backgroundColor: `rgba(55, 38, 12, ${0.80 - i * 0.20})`,
        }} />
      ))}

      {/* ── Stone guard rails around platform ── */}
      {[
        { l: aw * 0.205, t: ah * 0.265, w: 4, h: ah * 0.355 },  /* left rail */
        { l: aw * 0.791, t: ah * 0.265, w: 4, h: ah * 0.355 },  /* right rail */
        { l: aw * 0.205, t: ah * 0.265, w: aw * 0.590, h: 4 }, /* top rail */
      ].map((r, i) => (
        <View key={`rail${i}`} style={{
          position: "absolute",
          left: r.l, top: r.t,
          width: r.w, height: r.h,
          backgroundColor: "#223428",
          borderRadius: 2,
          borderWidth: 0.5, borderColor: "#304A38",
        }} />
      ))}

      {/* ── Garden flower accents at edges ── */}
      {([
        [0.88, 0.20, "🌺"], [0.91, 0.43, "🌿"],
        [0.89, 0.65, "🌺"], [0.05, 0.22, "🌿"],
        [0.04, 0.46, "🌺"], [0.06, 0.68, "🌿"],
      ] as [number, number, string][]).map(([fx, fy, emoji], i) => (
        <Text key={`gf${i}`} style={{
          position: "absolute",
          left: (fx as number) * aw - 8,
          top:  (fy as number) * ah - 8,
          fontSize: 12, opacity: 0.60,
        }}>{emoji as string}</Text>
      ))}

    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 1 — SOLID STONE LANE  (fully opaque — is part of the map, not overlay)
   Follows clockwise PATH_WPS exactly. Three-pass rendering:
   dark border → warm stone fill → lighter center highlight stripe.
   ═══════════════════════════════════════════════════════════════════════════ */
const LANE_STONE = "#C0A050";   /* fully opaque warm sandy stone   */
const LANE_EDGE  = "#3A1E04";   /* fully opaque dark brown border  */
const LANE_INNER = "#D4B868";   /* fully opaque lighter highlight  */

function WaypointLane({ aw, ah }: { aw: number; ah: number }) {
  const LANE_W = Math.max(24, aw * 0.090);  /* ~9% of board width */
  const JR     = LANE_W / 2 + 2;
  const BW     = 2.5;

  function seg(fx1: number, fy1: number, fx2: number, fy2: number) {
    const px1 = fx1 * aw, py1 = fy1 * ah;
    const px2 = fx2 * aw, py2 = fy2 * ah;
    const cx  = (px1 + px2) / 2, cy = (py1 + py2) / 2;
    const dx  = px2 - px1, dy = py2 - py1;
    return {
      cx, cy, angle: Math.atan2(dy, dx) * (180 / Math.PI),
      len: Math.sqrt(dx * dx + dy * dy) + 3,
    };
  }

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 2, pointerEvents: "none" }]}>

      {/* Pass 1 — wide dark border strips */}
      {PATH_WPS.slice(0, -1).map(([fx1, fy1], i) => {
        const [fx2, fy2] = PATH_WPS[i + 1];
        const { cx, cy, angle, len } = seg(fx1, fy1, fx2, fy2);
        const W = LANE_W + BW * 2;
        return (
          <View key={`dk${i}`} style={{
            position: "absolute",
            left: cx - len / 2, top: cy - W / 2,
            width: len, height: W,
            transform: [{ rotate: `${angle}deg` }],
            backgroundColor: LANE_EDGE,
          }} />
        );
      })}
      {/* Pass 1b — border junction circles */}
      {PATH_WPS.map(([fx, fy], i) => {
        const r = JR + BW;
        return (
          <View key={`djc${i}`} style={{
            position: "absolute",
            left: fx * aw - r, top: fy * ah - r,
            width: r * 2, height: r * 2, borderRadius: r,
            backgroundColor: LANE_EDGE,
          }} />
        );
      })}

      {/* Pass 2 — warm stone fill strips */}
      {PATH_WPS.slice(0, -1).map(([fx1, fy1], i) => {
        const [fx2, fy2] = PATH_WPS[i + 1];
        const { cx, cy, angle, len } = seg(fx1, fy1, fx2, fy2);
        return (
          <View key={`st${i}`} style={{
            position: "absolute",
            left: cx - len / 2, top: cy - LANE_W / 2,
            width: len, height: LANE_W,
            transform: [{ rotate: `${angle}deg` }],
            backgroundColor: LANE_STONE,
          }} />
        );
      })}
      {/* Pass 2b — stone fill junction circles */}
      {PATH_WPS.map(([fx, fy], i) => (
        <View key={`jc${i}`} style={{
          position: "absolute",
          left: fx * aw - JR, top: fy * ah - JR,
          width: JR * 2, height: JR * 2, borderRadius: JR,
          backgroundColor: LANE_STONE,
        }} />
      ))}

      {/* Pass 3 — centre highlight stripe (3D depth) */}
      {PATH_WPS.slice(0, -1).map(([fx1, fy1], i) => {
        const [fx2, fy2] = PATH_WPS[i + 1];
        const { cx, cy, angle, len } = seg(fx1, fy1, fx2, fy2);
        const HW = LANE_W * 0.28;
        return (
          <View key={`hl${i}`} style={{
            position: "absolute",
            left: cx - len / 2, top: cy - HW / 2,
            width: len, height: HW,
            transform: [{ rotate: `${angle}deg` }],
            backgroundColor: LANE_INNER,
          }} />
        );
      })}

      {/* Pass 3b — highlight junction circles */}
      {PATH_WPS.map(([fx, fy], i) => {
        const r = LANE_W * 0.14 + 2;
        return (
          <View key={`hjc${i}`} style={{
            position: "absolute",
            left: fx * aw - r, top: fy * ah - r,
            width: r * 2, height: r * 2, borderRadius: r,
            backgroundColor: LANE_INNER,
          }} />
        );
      })}

      {/* Lotus rune motifs along the path center */}
      {([
        [0.50, 0.22], [0.82, 0.40], [0.50, 0.64], [0.18, 0.40],
      ] as [number, number][]).map(([fx, fy], i) => (
        <Text key={`rune${i}`} style={{
          position: "absolute",
          left: fx * aw - 7, top: fy * ah - 7,
          fontSize: 10, opacity: 0.40, color: "#8B6820",
        }}>✿</Text>
      ))}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 2 — STONE DEPLOY PLATFORMS
   Octagonal-style stone platforms — each is the actual tap target.
   Medical-cross etching in warm healing green. Stone frame, no floating overlays.
   ═══════════════════════════════════════════════════════════════════════════ */
interface StonePadProps {
  aw: number; ah: number; tileIdx: number;
  occupied: boolean; selected: boolean; canAfford: boolean;
  isMergeCandidate: boolean; onPress: () => void;
}

function StonePad({ aw, ah, tileIdx, occupied, selected, canAfford, isMergeCandidate, onPress }: StonePadProps) {
  const [fx, fy] = DEPLOY_TILES[tileIdx];
  const cx = fx * aw;
  const cy = fy * ah;
  const R  = cl(Math.min(aw, ah) * 0.076, 24, 44);

  const isTargetable = !occupied && selected && canAfford;
  const isBlocked    = !occupied && selected && !canAfford;
  const isMerge      = isMergeCandidate;

  /* Stone palette — warm earth tones */
  const stoneRim  = isMerge    ? "#8B6A00"
                  : isTargetable ? "#6A8B4A"
                  : isBlocked  ? "#4A4030"
                  : "#4A3A22";
  const innerEdge = isMerge    ? "#C49A00"
                  : isTargetable ? "#88C060"
                  : "#5C4A30";
  const crossCol  = isMerge    ? "#FFD700"
                  : isTargetable ? "#A0D880"
                  : "#7A9870";
  const crossOpacity = isTargetable ? 0.95 : isBlocked ? 0.35 : 0.55;

  const barLen = R * 0.58;
  const barThk = R * 0.16;

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        left: cx - R - 12, top: cy - R - 12,
        width: (R + 12) * 2, height: (R + 12) * 2,
        alignItems: "center", justifyContent: "center",
        zIndex: 6,
      }}
    >
      {/* Targetable pulse ring — tight and subtle, not floating overlay */}
      {isTargetable && (
        <View style={{
          position: "absolute",
          width: R * 2 + 18, height: R * 2 + 18,
          borderRadius: R + 9,
          borderWidth: 1.5,
          borderColor: "#88C06060",
          ...({ boxShadow: "0 0 12px #88C04030" } as any),
        }} />
      )}

      {/* Outer octagonal stone frame */}
      <View style={{
        width: R * 2 + 8, height: R * 2 + 8,
        borderRadius: R * 0.30,      /* octagonal feel */
        backgroundColor: "#1C2A20",
        borderWidth: 2.5, borderColor: stoneRim,
        alignItems: "center", justifyContent: "center",
        ...((isTargetable || isMerge) && {
          boxShadow: `0 0 14px ${stoneRim}60, 0 0 5px ${stoneRim}40`,
        } as any),
      }}>
        {/* Stone texture sheen */}
        <LinearGradient
          colors={["#C8A84015", "#00000000", "#C8A84010"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{
            position: "absolute", left: 0, top: 0, right: 0, bottom: 0,
            borderRadius: R * 0.28,
          }}
        />

        {/* Inner stone circle with healing atmosphere */}
        <View style={{
          width: R * 2, height: R * 2,
          borderRadius: R,
          backgroundColor: "#0E1E16",
          borderWidth: 1.5, borderColor: innerEdge + "90",
          alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          {/* Inner radial glow */}
          <LinearGradient
            colors={[innerEdge + "18", "#00000000"]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
          />

          {/* Medical cross — carved stone style */}
          {!occupied && !isMerge && (
            <>
              <View style={{
                position: "absolute",
                width: barLen, height: barThk,
                backgroundColor: crossCol,
                borderRadius: barThk / 2,
                opacity: crossOpacity,
              }} />
              <View style={{
                position: "absolute",
                width: barThk, height: barLen,
                backgroundColor: crossCol,
                borderRadius: barThk / 2,
                opacity: crossOpacity,
              }} />
            </>
          )}

          {/* Merge star */}
          {isMerge && (
            <Text style={{ color: "#FFD700", fontSize: R * 0.55, fontWeight: "800" }}>★</Text>
          )}

          {/* Occupied glow */}
          {occupied && (
            <View style={{
              width: R * 0.50, height: R * 0.50, borderRadius: R * 0.25,
              backgroundColor: innerEdge + "18",
            }} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 3 — DISEASE GATE PORTAL (upper-left, built into stone arch)
   ═══════════════════════════════════════════════════════════════════════════ */
function GatePortal({ aw, ah, spawnQueueLen }: { aw: number; ah: number; spawnQueueLen: number }) {
  const orbR  = cl(Math.min(aw, ah) * 0.072, 24, 46);
  const orbCX = PATH_WPS[0][0] * aw;
  const orbCY = PATH_WPS[0][1] * ah;

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 22, pointerEvents: "none" }]}>
      {/* Stone arch backdrop */}
      <View style={{
        position: "absolute",
        left: orbCX - orbR - 8, top: orbCY - orbR - 12,
        width: orbR * 2 + 16, height: orbR * 2 + 20,
        borderRadius: orbR * 0.4, borderTopLeftRadius: orbR * 0.8, borderTopRightRadius: orbR * 0.8,
        backgroundColor: "#0C180E",
        borderWidth: 2, borderColor: "#1E3020",
      }} />

      {/* Outer purple glow ring */}
      <View style={{
        position: "absolute",
        left: orbCX - orbR - 3, top: orbCY - orbR - 3,
        width: orbR * 2 + 6, height: orbR * 2 + 6,
        borderRadius: orbR + 3,
        backgroundColor: "#5B21B608",
        borderWidth: 1.5, borderColor: "#8B5CF640",
        ...({ boxShadow: `0 0 ${orbR * 1.5}px #7C3AED60` } as any),
      }} />

      {/* Purple portal orb */}
      <LinearGradient
        colors={["#180028", "#4C0090", "#7C3AED", "#A855F7", "#7C3AED", "#180028"]}
        start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
        style={{
          position: "absolute",
          left: orbCX - orbR, top: orbCY - orbR,
          width: orbR * 2, height: orbR * 2,
          borderRadius: orbR,
          borderWidth: 2, borderColor: "#C084FC",
          alignItems: "center", justifyContent: "center",
          ...({ boxShadow: `0 0 ${orbR}px #A855F7CC, 0 0 ${orbR * 1.8}px #7C3AED88` } as any),
        }}
      >
        {/* Vortex centre */}
        <View style={{
          width: orbR * 0.65, height: orbR * 0.65, borderRadius: orbR * 0.33,
          backgroundColor: "#04000A",
          borderWidth: 1.5, borderColor: "#A855F770",
        }} />
      </LinearGradient>

      {/* Queue badge */}
      {spawnQueueLen > 0 && (
        <View style={{
          position: "absolute",
          left: orbCX + orbR - 6, top: orbCY - orbR - 4,
          backgroundColor: "#6D28D9", borderRadius: 8,
          paddingHorizontal: 5, paddingVertical: 1,
          borderWidth: 1, borderColor: "#C084FC",
          zIndex: 23,
        }}>
          <Text style={{ color: "#fff", fontSize: 7, fontWeight: "900" }}>⚡{spawnQueueLen}</Text>
        </View>
      )}

      {/* Label — carved into stone */}
      <View style={{
        position: "absolute",
        left: Math.max(1, orbCX - 32), top: orbCY - orbR - 18,
        backgroundColor: "#0E1810CC",
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3,
        borderWidth: 1, borderColor: "#6D28D960",
      }}>
        <Text style={{ color: "#DDD6FE", fontSize: 6, fontWeight: "800", letterSpacing: 0.8 }}>
          DISEASE GATE
        </Text>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 4 — VITAL LANTERN SHRINE (upper-right, built into pagoda arch)
   ═══════════════════════════════════════════════════════════════════════════ */
function LanternShrine({ aw, ah, stability }: { aw: number; ah: number; stability: number }) {
  const orbR  = cl(Math.min(aw, ah) * 0.072, 24, 46);
  const lastWP = PATH_WPS[PATH_WPS.length - 1];
  const orbCX  = lastWP[0] * aw;
  const orbCY  = lastWP[1] * ah;
  const pct       = cl(stability, 0, 100);
  const glowC     = pct > 60 ? "#FBBF24" : pct > 30 ? "#F59E0B" : "#EF4444";

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 22, pointerEvents: "none" }]}>
      {/* Pagoda backdrop */}
      <View style={{
        position: "absolute",
        left: orbCX - orbR - 8, top: orbCY - orbR - 14,
        width: orbR * 2 + 16, height: orbR * 2 + 22,
        borderRadius: orbR * 0.4, borderTopLeftRadius: orbR * 0.8, borderTopRightRadius: orbR * 0.8,
        backgroundColor: "#0F1A0E",
        borderWidth: 2, borderColor: "#1E3018",
      }} />
      {/* Pagoda roof decoration */}
      <View style={{
        position: "absolute",
        left: orbCX - orbR - 2, top: orbCY - orbR - 14,
        width: orbR * 2 + 4, height: 6,
        borderRadius: 3, borderTopLeftRadius: 6, borderTopRightRadius: 6,
        backgroundColor: "#1A2E14",
        borderWidth: 1, borderColor: "#2A4820",
      }} />

      {/* Outer warm glow ring */}
      <View style={{
        position: "absolute",
        left: orbCX - orbR - 3, top: orbCY - orbR - 3,
        width: orbR * 2 + 6, height: orbR * 2 + 6,
        borderRadius: orbR + 3,
        backgroundColor: glowC + "08",
        borderWidth: 1.5, borderColor: glowC + "40",
        ...({ boxShadow: `0 0 ${orbR * 1.5}px ${glowC}50` } as any),
      }} />

      {/* Golden shrine orb */}
      <LinearGradient
        colors={["#3A1C00", "#8B4500", glowC, "#FDE68A", glowC, "#6B3000"]}
        start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
        style={{
          position: "absolute",
          left: orbCX - orbR, top: orbCY - orbR,
          width: orbR * 2, height: orbR * 2,
          borderRadius: orbR,
          borderWidth: 2, borderColor: "#FDE68A",
          alignItems: "center", justifyContent: "center",
          ...({ boxShadow: `0 0 ${orbR}px ${glowC}CC, 0 0 ${orbR * 1.8}px ${glowC}66` } as any),
        }}
      >
        {/* Lotus inner glyph */}
        <View style={{
          width: orbR * 0.62, height: orbR * 0.62, borderRadius: orbR * 0.31,
          backgroundColor: "#FFFBEB25",
          borderWidth: 1.5, borderColor: "#FDE68A",
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: orbR * 0.36, color: "#FDE68A" }}>✦</Text>
        </View>
      </LinearGradient>

      {/* Label — carved into pagoda */}
      <View style={{
        position: "absolute",
        left: orbCX - 34, top: orbCY - orbR - 20,
        backgroundColor: "#09160ACC",
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3,
        borderWidth: 1, borderColor: glowC + "60",
      }}>
        <Text style={{ color: "#FEF3C7", fontSize: 6, fontWeight: "800", letterSpacing: 0.8 }}>
          VITAL LANTERN
        </Text>
      </View>

      {/* Stability bar */}
      <View style={{
        position: "absolute",
        left: orbCX - 34, top: orbCY + orbR + 4,
        width: 68,
      }}>
        <View style={{
          width: 68, height: 5, backgroundColor: "#00000060",
          borderRadius: 3, overflow: "hidden",
          borderWidth: 0.5, borderColor: glowC + "60",
        }}>
          <View style={{ width: `${pct}%` as any, height: "100%", backgroundColor: glowC, borderRadius: 3 }} />
        </View>
        <Text style={{ color: glowC, fontSize: 6.5, fontWeight: "700", marginTop: 1, textAlign: "center" }}>
          {pct}%
        </Text>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 6 — HERO SPRITE ON PAD
   ═══════════════════════════════════════════════════════════════════════════ */
const HERO_W = 52, HERO_H = 66;

function HeroOnPad({
  aw, ah, tileIdx, unit, bobY, unitColors,
}: {
  aw: number; ah: number; tileIdx: number;
  unit: any; bobY: Animated.AnimatedInterpolation<number>; unitColors: Record<string, string>;
}) {
  if (!unit) return null;
  const [fx, fy] = DEPLOY_TILES[tileIdx];
  const cx  = fx * aw;
  const cy  = fy * ah;
  const img = IMG_UNITS[unit.typeId];
  const col = unitColors[unit.typeId] ?? "#22d3ee";
  const hpPct  = cl(unit.hp / unit.maxHp, 0, 1);
  const isFlash = (unit.castFlash ?? 0) > 0 || (unit.mergeFlash ?? 0) > 0;

  return (
    <Animated.View style={{
      position: "absolute",
      left: cx - HERO_W / 2,
      top:  cy - HERO_H - 4,
      width: HERO_W,
      alignItems: "center",
      zIndex: 10,
      transform: [{ translateY: bobY }],
    }}>
      {hpPct < 0.99 && (
        <View style={{
          width: 36, height: 4, backgroundColor: "#00000090",
          borderRadius: 2, marginBottom: 2, overflow: "hidden",
        }}>
          <View style={{
            width: `${hpPct * 100}%` as any, height: "100%",
            backgroundColor: hpPct > 0.5 ? "#22C55E" : hpPct > 0.25 ? "#FACC15" : "#EF4444",
          }} />
        </View>
      )}
      {img ? (
        <ExpoImage
          source={img}
          style={{ width: HERO_W, height: HERO_H }}
          contentFit="contain"
          cachePolicy="none"
        />
      ) : (
        <View style={{
          width: HERO_W, height: HERO_H, borderRadius: 8,
          backgroundColor: col + "33", borderWidth: 2, borderColor: col,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 26 }}>🧙</Text>
        </View>
      )}
      {isFlash && (
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "#FFFFFF30", borderRadius: 6, zIndex: 1,
        }} />
      )}
      <View style={{
        width: 28, height: 4, borderRadius: 14,
        backgroundColor: "#00000070", marginTop: -2,
      }} />
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 7 — PROJECTILE BURST
   ═══════════════════════════════════════════════════════════════════════════ */
function ProjectileDot({ aw, ah, p }: { aw: number; ah: number; p: any }) {
  const fx  = lp(p.fromFx, p.toFx, p.progress);
  const fy  = lp(p.fromFy, p.toFy, p.progress);
  const px  = fx * aw;
  const py  = fy * ah;
  const col = p.color ?? "#88C060";
  return (
    <View style={{
      position: "absolute",
      left: px - 5, top: py - 5,
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: col + "55", borderWidth: 2, borderColor: col,
      alignItems: "center", justifyContent: "center", zIndex: 13,
    }}>
      <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: "#fff" }} />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 8 — ENEMY ON LANE  (walks along PATH_WPS, never leaves the path)
   ═══════════════════════════════════════════════════════════════════════════ */
function EnemyOnPath({
  aw, ah, enemy, bobY,
}: { aw: number; ah: number; enemy: any; bobY: Animated.AnimatedInterpolation<number> }) {
  const [fx, fy] = getEnemyFrac(enemy);
  const px = fx * aw;
  const py = fy * ah;

  const hpPct   = cl(enemy.hp / enemy.maxHp, 0, 1);
  const barCol  = hpPct > 0.6 ? "#22C55E" : hpPct > 0.3 ? "#FACC15" : "#EF4444";
  const isFlash = (enemy.hitFlash ?? 0) > 0;
  const isBoss  = enemy.typeId === "bronchospasm_drake";
  const sprW    = isBoss ? 64 : 48;
  const sprH    = isBoss ? 64 : 48;
  const barW    = isBoss ? 56 : 42;
  const accent  = ENEMY_COLOR[enemy.typeId] ?? "#94a3b8";
  const img     = IMG_ENEMIES[enemy.typeId];

  /* Disease-spirit emoji fallback (cuter, more ominous) */
  const fallbackEmoji = enemy.typeId === "bronchospasm_drake" ? "🐲"
    : enemy.typeId === "hypoxia_wraith"    ? "👻"
    : enemy.typeId === "mucus_slime"       ? "🫧"
    : enemy.typeId === "wheeze_sprite"     ? "🌀"
    : "💨";

  return (
    <Animated.View style={{
      position: "absolute",
      left: px - sprW / 2,
      top:  py - sprH - 18,
      alignItems: "center",
      zIndex: 14,
      transform: [{ translateY: bobY }],
    }}>
      {/* HP bar */}
      <View style={{
        width: barW, height: 4, backgroundColor: "#00000090",
        borderRadius: 2, marginBottom: 2, overflow: "hidden",
        borderWidth: 0.5, borderColor: "#FFFFFF20",
      }}>
        <View style={{
          width: `${hpPct * 100}%` as any, height: "100%",
          backgroundColor: barCol, borderRadius: 2,
        }} />
      </View>

      {/* Clinical cue tag */}
      <View style={{
        backgroundColor: accent + "22", borderRadius: 3,
        paddingHorizontal: 4, paddingVertical: 1, marginBottom: 3,
        borderWidth: 0.5, borderColor: accent + "70",
        maxWidth: barW + 10,
      }}>
        <Text style={{ color: accent, fontSize: 5.5, fontWeight: "700", textAlign: "center" }} numberOfLines={1}>
          {enemy.clue ?? enemy.name ?? "?"}
        </Text>
      </View>

      {isBoss && (
        <Text style={{ color: accent, fontSize: 7, fontWeight: "700", marginBottom: 1 }}>
          {enemy.hp}
        </Text>
      )}

      {/* Sprite */}
      {img ? (
        <ExpoImage source={img} style={{ width: sprW, height: sprH }} contentFit="contain" />
      ) : (
        <View style={{
          width: sprW, height: sprH, borderRadius: sprW / 2,
          backgroundColor: accent + "33", borderWidth: 2, borderColor: accent,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: isBoss ? 22 : 16 }}>{fallbackEmoji}</Text>
        </View>
      )}

      {/* Hit flash */}
      {isFlash && (
        <View style={{
          position: "absolute", top: 12, left: 0, right: 0, bottom: 4,
          backgroundColor: "#FFFFFF28", borderRadius: 10, zIndex: 15,
        }} />
      )}
      {/* Slow indicator */}
      {(enemy.slowTicks ?? 0) > 0 && (
        <View style={{
          position: "absolute", top: 10, right: -8,
          backgroundColor: "#A78BFA22", borderRadius: 3, paddingHorizontal: 2,
        }}>
          <Text style={{ color: "#A78BFA", fontSize: 5 }}>↓</Text>
        </View>
      )}
      {/* Ground shadow */}
      <View style={{
        width: isBoss ? 44 : 30, height: 4, borderRadius: 22,
        backgroundColor: "#000000A0", marginTop: -2,
      }} />
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN BOARD EXPORT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function WardDefenseV2Screen() { return null; }

export function WardBoardV2({
  aw, ah, onLayout,
  enemies, deployedUnits, projectiles,
  stability, phase, wave,
  selectedUnit, bobY,
  spawnQueueLen, mergeTileSet, onTilePress, canAfford, unitColors,
}: WardBoardV2Props) {
  const W = aw > 20 ? aw : 360;
  const H = ah > 20 ? ah : 480;

  return (
    <View
      style={{ flex: 1, position: "relative", overflow: "hidden", backgroundColor: "#091913" }}
      onLayout={onLayout}
    >
      {/* ── L0: Drawn sanctuary background scene ── */}
      <SanctuaryBackground aw={W} ah={H} />

      {/* ── L1: Solid stone lane (fully opaque, part of the map) ── */}
      {W > 20 && <WaypointLane aw={W} ah={H} />}

      {/* ── L2: Six stone deploy platforms (each IS the tap target) ── */}
      {W > 20 && DEPLOY_TILES.map((_, i) => (
        <StonePad
          key={i}
          aw={W} ah={H} tileIdx={i}
          occupied={deployedUnits.some((u: any) => u.tileIndex === i)}
          selected={!!selectedUnit}
          canAfford={canAfford}
          isMergeCandidate={mergeTileSet.has(i)}
          onPress={() => onTilePress(i)}
        />
      ))}

      {/* ── L3 / L4: Disease Gate + Vital Lantern (built into scene) ── */}
      {W > 20 && <GatePortal aw={W} ah={H} spawnQueueLen={spawnQueueLen} />}
      {W > 20 && <LanternShrine aw={W} ah={H} stability={stability} />}

      {/* ── L5: Subtle edge vignette ── */}
      <LinearGradient
        colors={["#00000060", "#00000000", "#00000000", "#00000060"]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { zIndex: 7, pointerEvents: "none" }]}
      />

      {/* ── L6: Hero sprites standing on pads ── */}
      {W > 20 && DEPLOY_TILES.map((_, i) => (
        <HeroOnPad
          key={i}
          aw={W} ah={H} tileIdx={i}
          unit={deployedUnits.find((u: any) => u.tileIndex === i)}
          bobY={bobY}
          unitColors={unitColors}
        />
      ))}

      {/* ── L7: Projectiles ── */}
      {projectiles.map((p: any) => (
        <ProjectileDot key={p.uid} aw={W} ah={H} p={p} />
      ))}

      {/* ── L8: Enemy sprites walking the visible lane only ── */}
      {enemies.map((e: any) => (
        <EnemyOnPath key={e.uid} aw={W} ah={H} enemy={e} bobY={bobY} />
      ))}
    </View>
  );
}
