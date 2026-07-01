/**
 * Ward Defense V2 — Lotus Healing Sanctum
 *
 * INTERACTIVE MAP — built entirely from drawn React Native components.
 * Reference: attached_assets/.../ward_defense_target.png (July 2026)
 *
 * Layer order (zIndex):
 *   0  SanctuaryBackground  — dark teal water garden (drawn)
 *   2  WaypointLane         — solid stone path wrapping clockwise
 *   6  StonePad × 6         — octagonal stone platforms (tap targets)
 *  22  GatePortal           — purple portal in stone arch (upper-left)
 *  22  LanternShrine        — golden dome shrine (upper-right)
 *   7  vignette
 *  10  HeroOnPad
 *  13  ProjectileDot
 *  14  EnemyOnPath
 */
import React from "react";
import {
  View, Text, Animated, Pressable, StyleSheet, LayoutChangeEvent,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

/* ─── Path — clockwise loop around 2×3 center platform cluster ─────────────
   Enemies spawn at Disease Gate (upper-left), travel clockwise, exit
   at Vital Lantern (upper-right). MUST stay identical to ward-defense.tsx.  */
export const PATH_WPS: [number, number][] = [
  [0.13, 0.18],  /*  0  Disease Gate spawn        */
  [0.18, 0.22],  /*  1  upper-left turn           */
  [0.32, 0.22],  /*  2  top lane left             */
  [0.50, 0.22],  /*  3  top lane center           */
  [0.70, 0.22],  /*  4  top lane right            */
  [0.82, 0.32],  /*  5  right turn                */
  [0.82, 0.48],  /*  6  right lane                */
  [0.72, 0.60],  /*  7  bottom-right turn         */
  [0.50, 0.64],  /*  8  bottom lane center        */
  [0.28, 0.60],  /*  9  bottom-left turn          */
  [0.18, 0.48],  /* 10  left lane                 */
  [0.18, 0.34],  /* 11  left-top                  */
  [0.30, 0.24],  /* 12  inner top-left            */
  [0.58, 0.24],  /* 13  inner top-right           */
  [0.80, 0.22],  /* 14  final approach            */
  [0.88, 0.18],  /* 15  Vital Lantern exit        */
];

/* Six deploy pads — 2 rows × 3 cols, centered in the platform zone.
   MUST stay identical to ward-defense.tsx.                              */
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
  enemies: any[]; deployedUnits: any[]; projectiles: any[];
  stability: number; phase: string; wave: number;
  selectedUnit: string | null; ap: number;
  bobY: Animated.AnimatedInterpolation<number>;
  spawnQueueLen: number; mergeTileSet: Set<number>;
  onTilePress: (i: number) => void; canAfford: boolean;
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

/* Regular octagon clip-path (uniform for both axes) */
const OCT = "polygon(29% 0%, 71% 0%, 100% 29%, 100% 71%, 71% 100%, 29% 100%, 0% 71%, 0% 29%)";

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 0 — SANCTUARY BACKGROUND
   Dark teal lotus-pond garden matching the reference composition.
   Buddha statue (left), pagoda (right), stone lanterns, dense lily pads,
   pink lotus blossoms, green plant clusters around all edges.
   ═══════════════════════════════════════════════════════════════════════════ */
function SanctuaryBackground({ aw, ah }: { aw: number; ah: number }) {
  if (aw < 20 || ah < 20) return null;
  const W = aw, H = ah;

  /* Scattered lotus flower positions (x fraction, y fraction, scale) */
  const lotusPos: [number, number, number][] = [
    [0.06, 0.15, 1.1], [0.10, 0.40, 0.9], [0.07, 0.62, 1.2], [0.12, 0.80, 0.8],
    [0.88, 0.30, 1.0], [0.93, 0.55, 1.2], [0.86, 0.70, 0.9], [0.90, 0.12, 0.8],
    [0.28, 0.82, 1.0], [0.50, 0.85, 1.1], [0.70, 0.82, 0.9],
    [0.22, 0.10, 0.8], [0.75, 0.10, 0.8],
  ];

  /* Stone lantern positions */
  const lanternPos: [number, number][] = [
    [0.10, 0.50], [0.90, 0.50],
    [0.18, 0.78], [0.82, 0.78],
    [0.50, 0.90],
  ];

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 0, pointerEvents: "none" }]}>

      {/* ── Base: dark teal lotus-pond water ── */}
      <LinearGradient
        colors={["#07121A", "#0B1E2A", "#0E2435", "#091820"]}
        start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={["#071810CC", "#0B2030AA", "#00000000", "#071820AA"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── Dense dark water across entire board ── */}
      {([
        /* left water area */  [0,    0,    0.20, 1.0, "#081620"],
        /* right water area */ [0.80, 0,    0.20, 1.0, "#081620"],
        /* top water */        [0.20, 0,    0.60, 0.18, "#07141E"],
        /* bottom water */     [0.20, 0.72, 0.60, 0.28, "#061218"],
      ] as [number, number, number, number, string][]).map(([fx, fy, fw, fh, col], i) => (
        <View key={`wtr${i}`} style={{
          position: "absolute",
          left: fx * W, top: fy * H, width: fw * W, height: fh * H,
          backgroundColor: col, borderRadius: 8,
        }} />
      ))}

      {/* ── Lily pad clusters (oval dark-green shapes on water) ── */}
      {([
        [0.06, 0.25, 28, 18], [0.08, 0.45, 22, 14], [0.10, 0.68, 26, 16],
        [0.88, 0.22, 24, 16], [0.92, 0.42, 20, 14], [0.87, 0.65, 28, 18],
        [0.25, 0.80, 22, 14], [0.45, 0.84, 26, 16], [0.65, 0.82, 22, 14],
        [0.18, 0.10, 18, 12], [0.80, 0.10, 18, 12], [0.50, 0.88, 20, 12],
        [0.04, 0.08, 20, 13], [0.93, 0.75, 20, 13], [0.14, 0.88, 18, 12],
        [0.75, 0.88, 22, 14],
      ] as [number, number, number, number][]).map(([fx, fy, pw, ph], i) => (
        <View key={`lp${i}`} style={{
          position: "absolute",
          left: fx * W - pw / 2, top: fy * H - ph / 2,
          width: pw, height: ph,
          borderRadius: 12,
          backgroundColor: i % 3 === 0 ? "#1A4828" : i % 3 === 1 ? "#153C20" : "#0F3018",
        }} />
      ))}

      {/* ── Lotus blossoms ── */}
      {lotusPos.map(([fx, fy, sc], i) => (
        <Text key={`lt${i}`} style={{
          position: "absolute",
          left: fx * W - 9 * sc, top: fy * H - 9 * sc,
          fontSize: 14 * sc, opacity: 0.82,
        }}>🌸</Text>
      ))}

      {/* ── Green plant clusters at board edges ── */}
      {([
        [0,    0,    0.18, 0.22], [0.82, 0,    0.18, 0.22],
        [0,    0.78, 0.18, 0.22], [0.82, 0.78, 0.18, 0.22],
        [0,    0.20, 0.14, 0.58], [0.86, 0.20, 0.14, 0.58],
        [0.18, 0,    0.64, 0.10], [0.18, 0.88, 0.64, 0.12],
      ] as [number, number, number, number][]).map(([fx, fy, fw, fh], i) => (
        <View key={`pl${i}`} style={{
          position: "absolute",
          left: fx * W, top: fy * H,
          width: fw * W, height: fh * H,
          borderRadius: 16,
          backgroundColor: i < 4 ? "#0D2518" : "#0E2A1C",
        }} />
      ))}

      {/* ── Dense foliage blobs overlapping edges ── */}
      {([
        [0.04, 0.18, 0.12, 0.16], [0.03, 0.38, 0.10, 0.18],
        [0.05, 0.60, 0.12, 0.16], [0.04, 0.78, 0.14, 0.14],
        [0.83, 0.18, 0.12, 0.16], [0.86, 0.38, 0.10, 0.18],
        [0.83, 0.60, 0.12, 0.16], [0.82, 0.78, 0.14, 0.14],
      ] as [number, number, number, number][]).map(([fx, fy, fw, fh], i) => (
        <View key={`fb${i}`} style={{
          position: "absolute",
          left: fx * W, top: fy * H,
          width: fw * W, height: fh * H,
          borderRadius: 14,
          backgroundColor: "#102A18",
        }} />
      ))}

      {/* ── Stone raised platform base (pads sit on this) ── */}
      <View style={{
        position: "absolute",
        left: W * 0.22, top: H * 0.24,
        width: W * 0.56, height: H * 0.42,
        borderRadius: 10, backgroundColor: "#1C1F2A",
        borderWidth: 2, borderColor: "#2E3248",
      }} />
      {/* Inner platform highlight */}
      <View style={{
        position: "absolute",
        left: W * 0.24, top: H * 0.255,
        width: W * 0.52, height: H * 0.39,
        borderRadius: 8, backgroundColor: "#1A1D28",
        borderWidth: 1, borderColor: "#28304A",
      }} />
      {/* Green garden fill between pads */}
      {([
        /* center-left plant */  [0.31, 0.41, 0.07, 0.10],
        /* center-right plant */ [0.62, 0.41, 0.07, 0.10],
        /* center mid plant */   [0.47, 0.41, 0.06, 0.08],
      ] as [number, number, number, number][]).map(([fx, fy, fw, fh], i) => (
        <View key={`pg${i}`} style={{
          position: "absolute",
          left: fx * W, top: fy * H, width: fw * W, height: fh * H,
          borderRadius: 8, backgroundColor: "#142A18",
          borderWidth: 0.5, borderColor: "#1E4A28",
        }} />
      ))}

      {/* ── Buddha statue — left mid ── */}
      <View style={{
        position: "absolute",
        left: W * 0.03, top: H * 0.32,
        width: 32, height: 52,
        alignItems: "center",
      }}>
        {/* Statue body */}
        <View style={{
          width: 26, height: 36, borderRadius: 8,
          backgroundColor: "#2A3028",
          borderWidth: 1.5, borderColor: "#3A4838",
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 18, opacity: 0.85 }}>🧘</Text>
        </View>
        {/* Lotus pedestal */}
        <View style={{ width: 28, height: 8, borderRadius: 4, backgroundColor: "#1E2C1A", borderWidth: 1, borderColor: "#2A4028", marginTop: 1 }} />
        <View style={{ width: 22, height: 6, borderRadius: 3, backgroundColor: "#162010", marginTop: 0.5 }} />
      </View>

      {/* ── Pagoda / temple structure — right mid ── */}
      <View style={{
        position: "absolute",
        left: W * 0.87, top: H * 0.42,
        width: W * 0.12, height: H * 0.30,
        alignItems: "center",
      }}>
        {[0, 1, 2, 3].map(t => (
          <View key={`pgt${t}`} style={{
            width: W * (0.11 - t * 0.012), height: 7,
            borderRadius: 2,
            backgroundColor: t === 0 ? "#2A1A08" : "#1C1408",
            borderWidth: 0.5, borderColor: "#5A3A10",
            marginBottom: 2,
          }} />
        ))}
        <View style={{
          width: W * 0.10, height: H * 0.18,
          backgroundColor: "#1A140C",
          borderWidth: 1, borderColor: "#3A2A10",
          borderRadius: 4, borderTopLeftRadius: 0, borderTopRightRadius: 0,
        }} />
      </View>

      {/* ── Stone arch frame for Gate area (upper-left) ── */}
      <View style={{
        position: "absolute",
        left: W * 0.02, top: H * 0.02,
        width: W * 0.24, height: H * 0.34,
        borderRadius: 10, borderTopLeftRadius: 50, borderTopRightRadius: 50,
        backgroundColor: "#101610",
        borderWidth: 2, borderColor: "#1E2C1A",
      }} />
      <View style={{
        position: "absolute",
        left: W * 0.05, top: H * 0.03,
        width: W * 0.18, height: H * 0.28,
        borderRadius: 8, borderTopLeftRadius: 36, borderTopRightRadius: 36,
        backgroundColor: "#0C120C",
        borderWidth: 1, borderColor: "#182018",
      }} />
      {/* Arch stone steps */}
      {[0, 1, 2].map(i => (
        <View key={`gs${i}`} style={{
          position: "absolute",
          left: W * (0.05 + i * 0.01), top: H * 0.30 + i * 5,
          width: W * (0.19 - i * 0.02), height: 5,
          borderRadius: 2, backgroundColor: `rgba(40, 35, 15, ${0.7 - i * 0.15})`,
        }} />
      ))}

      {/* ── Pagoda arch frame for Lantern area (upper-right) ── */}
      <View style={{
        position: "absolute",
        left: W * 0.74, top: H * 0.02,
        width: W * 0.24, height: H * 0.34,
        borderRadius: 10, borderTopLeftRadius: 50, borderTopRightRadius: 50,
        backgroundColor: "#100E08",
        borderWidth: 2, borderColor: "#281E0C",
      }} />
      {/* Pagoda roof tiers on right frame */}
      {[0, 1, 2, 3].map(i => (
        <View key={`lprt${i}`} style={{
          position: "absolute",
          left: W * (0.755 + i * 0.010),
          top: H * (0.03 + i * 0.028),
          width: W * (0.21 - i * 0.020), height: 7,
          borderRadius: 3,
          backgroundColor: i === 0 ? "#302010" : "#201808",
          borderWidth: 0.5, borderColor: "#5A4020",
        }} />
      ))}

      {/* ── Stone lanterns around the path ── */}
      {lanternPos.map(([fx, fy], i) => {
        const lx = fx * W - 11;
        const ly = fy * H - 28;
        return (
          <View key={`sln${i}`} style={{
            position: "absolute", left: lx, top: ly,
            width: 22, height: 44, alignItems: "center",
          }}>
            {/* Cap */}
            <View style={{ width: 20, height: 5, borderRadius: 2, backgroundColor: "#2A1A00", borderWidth: 0.5, borderColor: "#5A3A00" }} />
            {/* Body */}
            <View style={{
              width: 16, height: 20, borderRadius: 5,
              backgroundColor: "#4A3000",
              borderWidth: 1.5, borderColor: "#8A5800",
              alignItems: "center", justifyContent: "center",
              ...({ boxShadow: "0 0 12px #FF900055" } as any),
            }}>
              <View style={{ width: 8, height: 12, borderRadius: 3, backgroundColor: "#FF880028", borderWidth: 0.5, borderColor: "#FF880050" }} />
            </View>
            {/* Pole */}
            <View style={{ width: 4, height: 14, backgroundColor: "#2A1800", borderRadius: 2 }} />
            {/* Base */}
            <View style={{ width: 18, height: 5, borderRadius: 3, backgroundColor: "#1A1000" }} />
          </View>
        );
      })}

      {/* ── Stone steps at top-center of path ── */}
      {[0, 1, 2].map(i => (
        <View key={`tst${i}`} style={{
          position: "absolute",
          left: W * (0.44 + i * 0.01), top: H * 0.035 + i * 5,
          width: W * (0.12 - i * 0.02), height: 5,
          borderRadius: 2, backgroundColor: `rgba(60, 48, 20, ${0.7 - i * 0.15})`,
        }} />
      ))}

      {/* ── Stone steps at bottom-center ── */}
      {[0, 1, 2].map(i => (
        <View key={`bst${i}`} style={{
          position: "absolute",
          left: W * (0.40 + i * 0.01), top: H * 0.66 + i * 5,
          width: W * (0.20 - i * 0.02), height: 5,
          borderRadius: 2, backgroundColor: `rgba(55, 42, 12, ${0.72 - i * 0.15})`,
        }} />
      ))}

      {/* ── Decorative plant accents at path corners ── */}
      {([
        [0.16, 0.63, "🌿"], [0.83, 0.63, "🌿"],
        [0.84, 0.23, "🌺"], [0.14, 0.23, "🌺"],
        [0.50, 0.89, "🌺"], [0.50, 0.09, "🌿"],
      ] as [number, number, string][]).map(([fx, fy, em], i) => (
        <Text key={`da${i}`} style={{
          position: "absolute",
          left: (fx as number) * W - 8, top: (fy as number) * H - 8,
          fontSize: 12, opacity: 0.65,
        }}>{em as string}</Text>
      ))}

    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 1 — STONE LANE  (fully opaque sandy stone — part of the map)
   Three render passes: dark edge border → warm stone fill → lighter centre.
   ═══════════════════════════════════════════════════════════════════════════ */
const LANE_STONE = "#C8A850";   /* warm sandy stone — fully opaque  */
const LANE_EDGE  = "#3A2008";   /* dark brown border — fully opaque */
const LANE_INNER = "#DAC068";   /* lighter centre highlight          */

function WaypointLane({ aw, ah }: { aw: number; ah: number }) {
  const LANE_W = Math.max(22, aw * 0.088);
  const JR     = LANE_W / 2 + 2;
  const BW     = 3;

  function seg(fx1: number, fy1: number, fx2: number, fy2: number) {
    const px1 = fx1 * aw, py1 = fy1 * ah;
    const px2 = fx2 * aw, py2 = fy2 * ah;
    const cx  = (px1 + px2) / 2, cy = (py1 + py2) / 2;
    const dx  = px2 - px1, dy = py2 - py1;
    return { cx, cy, angle: Math.atan2(dy, dx) * (180 / Math.PI), len: Math.sqrt(dx * dx + dy * dy) + 3 };
  }

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 2, pointerEvents: "none" }]}>

      {/* Pass 1 — wide dark border */}
      {PATH_WPS.slice(0, -1).map(([fx1, fy1], i) => {
        const { cx, cy, angle, len } = seg(fx1, fy1, ...PATH_WPS[i + 1]);
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

      {/* Pass 2 — warm stone fill */}
      {PATH_WPS.slice(0, -1).map(([fx1, fy1], i) => {
        const { cx, cy, angle, len } = seg(fx1, fy1, ...PATH_WPS[i + 1]);
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
      {PATH_WPS.map(([fx, fy], i) => (
        <View key={`jc${i}`} style={{
          position: "absolute",
          left: fx * aw - JR, top: fy * ah - JR,
          width: JR * 2, height: JR * 2, borderRadius: JR,
          backgroundColor: LANE_STONE,
        }} />
      ))}

      {/* Pass 3 — centre highlight stripe */}
      {PATH_WPS.slice(0, -1).map(([fx1, fy1], i) => {
        const { cx, cy, angle, len } = seg(fx1, fy1, ...PATH_WPS[i + 1]);
        const HW = LANE_W * 0.26;
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
      {PATH_WPS.map(([fx, fy], i) => {
        const r = LANE_W * 0.13 + 2;
        return (
          <View key={`hjc${i}`} style={{
            position: "absolute",
            left: fx * aw - r, top: fy * ah - r,
            width: r * 2, height: r * 2, borderRadius: r,
            backgroundColor: LANE_INNER,
          }} />
        );
      })}

      {/* Lotus rune engravings along the path centre */}
      {([
        [0.50, 0.22], [0.82, 0.40], [0.50, 0.64], [0.18, 0.40],
        [0.32, 0.22], [0.70, 0.22], [0.28, 0.60], [0.72, 0.60],
      ] as [number, number][]).map(([fx, fy], i) => (
        <Text key={`rn${i}`} style={{
          position: "absolute",
          left: fx * aw - 7, top: fy * ah - 7,
          fontSize: 10, opacity: 0.35, color: "#7A5820",
        }}>✿</Text>
      ))}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 2 — OCTAGONAL STONE DEPLOY PLATFORMS
   Match reference: octagon stone frame → dark stone ring → teal-blue disc
   → bright white medical cross (large, glowing). Platform IS the tap target.
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
  const SIZE = cl(Math.min(aw, ah) * 0.108, 40, 56); /* total octagon diameter */
  const R    = SIZE / 2;

  const isTargetable = !occupied && selected && canAfford;
  const isBlocked    = !occupied && selected && !canAfford;
  const isMerge      = isMergeCandidate;

  /* Stone frame accent colour */
  const frameAccent = isMerge     ? "#C49A00"
                    : isTargetable ? "#70C890"
                    : "#6A6888";

  /* Inner disc colour */
  const discBase    = isMerge     ? "#3A2C00"
                    : isTargetable ? "#12382A"
                    : "#0E2848";
  const discEdge    = isMerge     ? "#C49A00"
                    : isTargetable ? "#70C890"
                    : "#2A6090";

  /* Cross */
  const crossColor  = isMerge     ? "#FFD700"
                    : isTargetable ? "#FFFFFF"
                    : "#FFFFFF";
  const crossOpacity = isBlocked  ? 0.20 : isTargetable ? 1.0 : 0.78;
  const crossLen    = R * 0.68;  /* arm half-length from centre */
  const crossThk    = R * 0.20;  /* bar thickness              */

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
      {/* Targetable outer glow ring — tight, not floating overlay */}
      {(isTargetable || isMerge) && (
        <View style={{
          position: "absolute",
          width: SIZE + 22, height: SIZE + 22,
          borderRadius: (SIZE + 22) / 2,
          borderWidth: 1.5, borderColor: frameAccent + "70",
          ...({ boxShadow: `0 0 20px ${frameAccent}50` } as any),
        }} />
      )}

      {/* ── Octagonal outer stone frame ──
          border effect: outer octagon shows frameAccent, inner octagon shows stone-dark */}
      <View style={[{
        width: SIZE, height: SIZE,
        backgroundColor: frameAccent,
        alignItems: "center", justifyContent: "center",
        ...((isTargetable || isMerge) && {
          boxShadow: `0 0 22px ${frameAccent}80`,
        } as any),
      }, { clipPath: OCT } as any]}>

        {/* Stone frame fill */}
        <View style={[{
          width: SIZE - 5, height: SIZE - 5,
          backgroundColor: "#2A283C",
          alignItems: "center", justifyContent: "center",
        }, { clipPath: OCT } as any]}>

          {/* Dark inner stone ring */}
          <View style={{
            width: SIZE * 0.80, height: SIZE * 0.80,
            borderRadius: SIZE * 0.40,
            backgroundColor: "#1A1828",
            borderWidth: 2, borderColor: discEdge + "90",
            alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}>

            {/* Teal-blue glowing disc */}
            <LinearGradient
              colors={[discBase, discEdge.slice(0, 7) + "FF", discBase]}
              start={{ x: 0.3, y: 0.1 }} end={{ x: 0.7, y: 0.9 }}
              style={{
                width: SIZE * 0.68, height: SIZE * 0.68,
                borderRadius: SIZE * 0.34,
                borderWidth: 1.5, borderColor: discEdge,
                alignItems: "center", justifyContent: "center",
                ...({ boxShadow: `0 0 14px ${discEdge}90, 0 0 6px ${discEdge}60` } as any),
              }}
            >
              {/* Radial highlight at top */}
              <LinearGradient
                colors={["#FFFFFF15", "#00000000"]}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }}
                style={{
                  position: "absolute", left: 0, top: 0, right: 0, bottom: 0,
                  borderRadius: SIZE * 0.34,
                }}
              />

              {/* Bright white medical cross */}
              {!occupied && !isMerge && (
                <>
                  <View style={{
                    position: "absolute",
                    width: crossLen * 2, height: crossThk,
                    backgroundColor: crossColor,
                    borderRadius: crossThk / 2,
                    opacity: crossOpacity,
                    ...({ boxShadow: `0 0 10px #FFFFFFAA` } as any),
                  }} />
                  <View style={{
                    position: "absolute",
                    width: crossThk, height: crossLen * 2,
                    backgroundColor: crossColor,
                    borderRadius: crossThk / 2,
                    opacity: crossOpacity,
                    ...({ boxShadow: `0 0 10px #FFFFFFAA` } as any),
                  }} />
                  {/* Cross centre dot */}
                  <View style={{
                    position: "absolute",
                    width: crossThk * 0.8, height: crossThk * 0.8,
                    borderRadius: crossThk * 0.4,
                    backgroundColor: crossColor,
                    opacity: crossOpacity * 0.9,
                  }} />
                </>
              )}

              {/* Merge star */}
              {isMerge && (
                <Text style={{
                  color: "#FFD700", fontSize: SIZE * 0.28,
                  fontWeight: "800",
                  ...({ textShadow: "0 0 12px #FFD70099" } as any),
                }}>★</Text>
              )}

              {/* Occupied dim */}
              {occupied && (
                <View style={{
                  width: SIZE * 0.18, height: SIZE * 0.18,
                  borderRadius: SIZE * 0.09,
                  backgroundColor: "#FFFFFF15",
                  borderWidth: 1, borderColor: "#FFFFFF25",
                }} />
              )}
            </LinearGradient>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 3 — DISEASE GATE PORTAL (upper-left)
   Large stone arch with purple swirling portal and energy lightning.
   ═══════════════════════════════════════════════════════════════════════════ */
function GatePortal({ aw, ah, spawnQueueLen }: { aw: number; ah: number; spawnQueueLen: number }) {
  const orbR  = cl(Math.min(aw, ah) * 0.080, 28, 52);
  const orbCX = PATH_WPS[0][0] * aw;
  const orbCY = PATH_WPS[0][1] * ah;

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 22, pointerEvents: "none" }]}>
      {/* Stone arch outer frame */}
      <View style={{
        position: "absolute",
        left: orbCX - orbR - 10, top: orbCY - orbR - 16,
        width: orbR * 2 + 20, height: orbR * 2 + 24,
        borderRadius: orbR * 0.4, borderTopLeftRadius: orbR, borderTopRightRadius: orbR,
        backgroundColor: "#0E1810",
        borderWidth: 2.5, borderColor: "#243A1E",
        ...({ boxShadow: "0 0 24px #7C3AED40" } as any),
      }} />
      {/* Stone arch inner recess */}
      <View style={{
        position: "absolute",
        left: orbCX - orbR - 5, top: orbCY - orbR - 10,
        width: orbR * 2 + 10, height: orbR * 2 + 14,
        borderRadius: orbR * 0.35, borderTopLeftRadius: orbR * 0.8, borderTopRightRadius: orbR * 0.8,
        backgroundColor: "#080C08",
        borderWidth: 1, borderColor: "#1A2818",
      }} />

      {/* Outer purple glow ring */}
      <View style={{
        position: "absolute",
        left: orbCX - orbR - 4, top: orbCY - orbR - 4,
        width: orbR * 2 + 8, height: orbR * 2 + 8,
        borderRadius: orbR + 4,
        borderWidth: 2, borderColor: "#8B5CF650",
        ...({ boxShadow: `0 0 ${orbR * 2}px #7C3AED80` } as any),
      }} />

      {/* Purple portal orb */}
      <LinearGradient
        colors={["#1A0040", "#5B00CC", "#8B22FF", "#B060FF", "#8B22FF", "#2A0060"]}
        start={{ x: 0.2, y: 0.1 }} end={{ x: 0.8, y: 0.9 }}
        style={{
          position: "absolute",
          left: orbCX - orbR, top: orbCY - orbR,
          width: orbR * 2, height: orbR * 2,
          borderRadius: orbR,
          borderWidth: 2.5, borderColor: "#C084FC",
          alignItems: "center", justifyContent: "center",
          ...({ boxShadow: `0 0 ${orbR * 1.2}px #A855F7FF, 0 0 ${orbR * 2.5}px #7C3AED80` } as any),
        }}
      >
        {/* Dark vortex centre */}
        <View style={{
          width: orbR * 0.60, height: orbR * 0.60,
          borderRadius: orbR * 0.30,
          backgroundColor: "#02000C",
          borderWidth: 2, borderColor: "#A855F780",
          alignItems: "center", justifyContent: "center",
        }}>
          <View style={{
            width: orbR * 0.25, height: orbR * 0.25,
            borderRadius: orbR * 0.12,
            backgroundColor: "#4A00AA50",
            borderWidth: 1, borderColor: "#C084FC",
          }} />
        </View>
      </LinearGradient>

      {/* Energy lightning accent dots */}
      {([[orbCX - orbR * 1.3, orbCY - orbR * 0.8], [orbCX + orbR * 1.0, orbCY + orbR * 0.5]] as [number, number][]).map(([lx, ly], i) => (
        <View key={`elt${i}`} style={{
          position: "absolute", left: lx - 3, top: ly - 3,
          width: 6, height: 6, borderRadius: 3,
          backgroundColor: "#C084FC",
          ...({ boxShadow: "0 0 8px #A855F7" } as any),
        }} />
      ))}

      {/* Spawn queue badge */}
      {spawnQueueLen > 0 && (
        <View style={{
          position: "absolute",
          left: orbCX + orbR - 6, top: orbCY - orbR - 6,
          backgroundColor: "#6D28D9", borderRadius: 9,
          paddingHorizontal: 5, paddingVertical: 1,
          borderWidth: 1, borderColor: "#C084FC",
        }}>
          <Text style={{ color: "#fff", fontSize: 7, fontWeight: "900" }}>⚡{spawnQueueLen}</Text>
        </View>
      )}

      {/* Label */}
      <View style={{
        position: "absolute",
        left: Math.max(1, orbCX - 36), top: orbCY - orbR - 22,
        backgroundColor: "#08100800",
        paddingHorizontal: 7, paddingVertical: 2, borderRadius: 3,
        borderWidth: 1, borderColor: "#7C3AED80",
        backgroundColor: "#080C0ECC" as any,
      }}>
        <Text style={{ color: "#DDD6FE", fontSize: 6.5, fontWeight: "800", letterSpacing: 1 }}>
          DISEASE GATE
        </Text>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 4 — VITAL LANTERN SHRINE (upper-right)
   Ornate golden dome cage with crystal lotus flowers and warm amber glow.
   ═══════════════════════════════════════════════════════════════════════════ */
function LanternShrine({ aw, ah, stability }: { aw: number; ah: number; stability: number }) {
  const orbR   = cl(Math.min(aw, ah) * 0.080, 28, 52);
  const lastWP = PATH_WPS[PATH_WPS.length - 1];
  const orbCX  = lastWP[0] * aw;
  const orbCY  = lastWP[1] * ah;
  const pct    = cl(stability, 0, 100);
  const glowC  = pct > 60 ? "#FBBF24" : pct > 30 ? "#F59E0B" : "#EF4444";
  const glowC2 = pct > 60 ? "#FDE68A" : pct > 30 ? "#FCD34D" : "#FCA5A5";

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 22, pointerEvents: "none" }]}>
      {/* Pagoda outer arch */}
      <View style={{
        position: "absolute",
        left: orbCX - orbR - 10, top: orbCY - orbR - 20,
        width: orbR * 2 + 20, height: orbR * 2 + 28,
        borderRadius: orbR * 0.4, borderTopLeftRadius: orbR, borderTopRightRadius: orbR,
        backgroundColor: "#120E04",
        borderWidth: 2.5, borderColor: "#3A2C08",
        ...({ boxShadow: `0 0 24px ${glowC}50` } as any),
      }} />
      {/* Pagoda roof tiers */}
      {[0, 1, 2].map(t => (
        <View key={`pgrt${t}`} style={{
          position: "absolute",
          left: orbCX - orbR - 4 + t * 3,
          top: orbCY - orbR - 20 + t * 7,
          width: orbR * 2 + 8 - t * 6, height: 7,
          borderRadius: 4, borderTopLeftRadius: 6, borderTopRightRadius: 6,
          backgroundColor: t === 0 ? "#2A1A00" : "#1C1200",
          borderWidth: 0.5, borderColor: glowC + "50",
        }} />
      ))}

      {/* Outer golden glow ring */}
      <View style={{
        position: "absolute",
        left: orbCX - orbR - 4, top: orbCY - orbR - 4,
        width: orbR * 2 + 8, height: orbR * 2 + 8,
        borderRadius: orbR + 4,
        borderWidth: 2, borderColor: glowC + "60",
        ...({ boxShadow: `0 0 ${orbR * 2}px ${glowC}80` } as any),
      }} />

      {/* Golden dome / cage structure — concentric rings */}
      <View style={{
        position: "absolute",
        left: orbCX - orbR, top: orbCY - orbR,
        width: orbR * 2, height: orbR * 2,
        borderRadius: orbR,
        borderWidth: 3, borderColor: glowC,
        alignItems: "center", justifyContent: "center",
        backgroundColor: "#18100000",
        ...({ boxShadow: `0 0 ${orbR * 1.2}px ${glowC}FF, 0 0 ${orbR * 2.5}px ${glowC}70` } as any),
      }}>
        {/* Dome cage bars */}
        {[0, 60, 120].map(angle => (
          <View key={`cb${angle}`} style={{
            position: "absolute",
            width: orbR * 2 - 4, height: 2,
            backgroundColor: glowC + "80",
            transform: [{ rotate: `${angle}deg` }],
            borderRadius: 1,
          }} />
        ))}
        {/* Golden glowing orb fill */}
        <LinearGradient
          colors={["#4A2800", "#8B5000", glowC, glowC2, glowC, "#5A3000"]}
          start={{ x: 0.2, y: 0.1 }} end={{ x: 0.8, y: 0.9 }}
          style={{
            width: orbR * 1.40, height: orbR * 1.40,
            borderRadius: orbR * 0.70,
            alignItems: "center", justifyContent: "center",
          }}
        >
          {/* Inner lotus glyph */}
          <View style={{
            width: orbR * 0.60, height: orbR * 0.60,
            borderRadius: orbR * 0.30,
            backgroundColor: glowC2 + "30",
            borderWidth: 1.5, borderColor: glowC2,
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ fontSize: orbR * 0.30, color: glowC2 }}>✦</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Crystal lotus flowers at base */}
      {([[orbCX - orbR * 1.3, orbCY + orbR * 0.4], [orbCX + orbR * 1.1, orbCY + orbR * 0.4]] as [number, number][]).map(([lx, ly], i) => (
        <Text key={`clt${i}`} style={{
          position: "absolute", left: lx - 8, top: ly - 8,
          fontSize: 13,
          ...({ filter: `hue-rotate(${i * 40}deg)` } as any),
        }}>🌸</Text>
      ))}

      {/* Label */}
      <View style={{
        position: "absolute",
        left: orbCX - 38, top: orbCY - orbR - 28,
        backgroundColor: "#08100ECC",
        paddingHorizontal: 7, paddingVertical: 2, borderRadius: 3,
        borderWidth: 1, borderColor: glowC + "70",
      }}>
        <Text style={{ color: glowC2, fontSize: 6.5, fontWeight: "800", letterSpacing: 1 }}>
          VITAL LANTERN
        </Text>
      </View>

      {/* Stability bar below orb */}
      <View style={{
        position: "absolute",
        left: orbCX - 36, top: orbCY + orbR + 6,
        width: 72,
      }}>
        <View style={{ width: 72, height: 5, backgroundColor: "#00000070", borderRadius: 3, overflow: "hidden", borderWidth: 0.5, borderColor: glowC + "60" }}>
          <View style={{ width: `${pct}%` as any, height: "100%", backgroundColor: glowC, borderRadius: 3 }} />
        </View>
        <Text style={{ color: glowC, fontSize: 6.5, fontWeight: "700", marginTop: 1, textAlign: "center" }}>{pct}%</Text>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 6 — HERO SPRITE ON PAD
   ═══════════════════════════════════════════════════════════════════════════ */
const HERO_W = 52, HERO_H = 66;

function HeroOnPad({ aw, ah, tileIdx, unit, bobY, unitColors }: {
  aw: number; ah: number; tileIdx: number;
  unit: any; bobY: Animated.AnimatedInterpolation<number>; unitColors: Record<string, string>;
}) {
  if (!unit) return null;
  const [fx, fy] = DEPLOY_TILES[tileIdx];
  const cx  = fx * aw;
  const cy  = fy * ah;
  const img = IMG_UNITS[unit.typeId];
  const col = unitColors[unit.typeId] ?? "#22d3ee";
  const hpPct   = cl(unit.hp / unit.maxHp, 0, 1);
  const isFlash = (unit.castFlash ?? 0) > 0 || (unit.mergeFlash ?? 0) > 0;

  return (
    <Animated.View style={{
      position: "absolute",
      left: cx - HERO_W / 2, top: cy - HERO_H / 2,
      width: HERO_W, alignItems: "center", zIndex: 10,
      transform: [{ translateY: bobY }],
    }}>
      {hpPct < 0.99 && (
        <View style={{ width: 36, height: 4, backgroundColor: "#00000090", borderRadius: 2, marginBottom: 2, overflow: "hidden" }}>
          <View style={{ width: `${hpPct * 100}%` as any, height: "100%", backgroundColor: hpPct > 0.5 ? "#22C55E" : hpPct > 0.25 ? "#FACC15" : "#EF4444" }} />
        </View>
      )}
      {img ? (
        <ExpoImage source={img} style={{ width: HERO_W, height: HERO_H }} contentFit="contain" cachePolicy="none" />
      ) : (
        <View style={{ width: HERO_W, height: HERO_H, borderRadius: 8, backgroundColor: col + "33", borderWidth: 2, borderColor: col, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 26 }}>🧙</Text>
        </View>
      )}
      {isFlash && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#FFFFFF30", borderRadius: 6, zIndex: 1 }} />
      )}
      <View style={{ width: 28, height: 4, borderRadius: 14, backgroundColor: "#00000070", marginTop: -2 }} />
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 7 — PROJECTILE BURST
   ═══════════════════════════════════════════════════════════════════════════ */
function ProjectileDot({ aw, ah, p }: { aw: number; ah: number; p: any }) {
  const fx  = lp(p.fromFx, p.toFx, p.progress);
  const fy  = lp(p.fromFy, p.toFy, p.progress);
  const col = p.color ?? "#88C060";
  return (
    <View style={{
      position: "absolute",
      left: fx * aw - 5, top: fy * ah - 5,
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: col + "55", borderWidth: 2, borderColor: col,
      alignItems: "center", justifyContent: "center", zIndex: 13,
    }}>
      <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: "#fff" }} />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 8 — ENEMY ON LANE
   ═══════════════════════════════════════════════════════════════════════════ */
function EnemyOnPath({ aw, ah, enemy, bobY }: { aw: number; ah: number; enemy: any; bobY: Animated.AnimatedInterpolation<number> }) {
  const [fx, fy] = getEnemyFrac(enemy);
  const hpPct  = cl(enemy.hp / enemy.maxHp, 0, 1);
  const barCol = hpPct > 0.6 ? "#22C55E" : hpPct > 0.3 ? "#FACC15" : "#EF4444";
  const isFlash = (enemy.hitFlash ?? 0) > 0;
  const isBoss  = enemy.typeId === "bronchospasm_drake";
  const sprW = isBoss ? 64 : 48, sprH = isBoss ? 64 : 48;
  const accent = ENEMY_COLOR[enemy.typeId] ?? "#94a3b8";
  const img    = IMG_ENEMIES[enemy.typeId];

  const fallbackEmoji = enemy.typeId === "bronchospasm_drake" ? "🐲"
    : enemy.typeId === "hypoxia_wraith"  ? "👻"
    : enemy.typeId === "mucus_slime"     ? "🫧"
    : enemy.typeId === "wheeze_sprite"   ? "🌀" : "💨";

  return (
    <Animated.View style={{
      position: "absolute",
      left: fx * aw - sprW / 2, top: fy * ah - sprH - 18,
      alignItems: "center", zIndex: 14,
      transform: [{ translateY: bobY }],
    }}>
      <View style={{ width: sprW + 8, height: 4, backgroundColor: "#00000090", borderRadius: 2, marginBottom: 2, overflow: "hidden" }}>
        <View style={{ width: `${hpPct * 100}%` as any, height: "100%", backgroundColor: barCol, borderRadius: 2 }} />
      </View>
      <View style={{ backgroundColor: accent + "22", borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, marginBottom: 3, borderWidth: 0.5, borderColor: accent + "70", maxWidth: sprW + 10 }}>
        <Text style={{ color: accent, fontSize: 5.5, fontWeight: "700", textAlign: "center" }} numberOfLines={1}>
          {enemy.clue ?? enemy.name ?? "?"}
        </Text>
      </View>
      {isBoss && <Text style={{ color: accent, fontSize: 7, fontWeight: "700", marginBottom: 1 }}>{enemy.hp}</Text>}
      {img ? (
        <ExpoImage source={img} style={{ width: sprW, height: sprH }} contentFit="contain" />
      ) : (
        <View style={{ width: sprW, height: sprH, borderRadius: sprW / 2, backgroundColor: accent + "33", borderWidth: 2, borderColor: accent, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: isBoss ? 22 : 16 }}>{fallbackEmoji}</Text>
        </View>
      )}
      {isFlash && <View style={{ position: "absolute", top: 12, left: 0, right: 0, bottom: 4, backgroundColor: "#FFFFFF28", borderRadius: 10, zIndex: 15 }} />}
      {(enemy.slowTicks ?? 0) > 0 && (
        <View style={{ position: "absolute", top: 10, right: -8, backgroundColor: "#A78BFA22", borderRadius: 3, paddingHorizontal: 2 }}>
          <Text style={{ color: "#A78BFA", fontSize: 5 }}>↓</Text>
        </View>
      )}
      <View style={{ width: isBoss ? 44 : 30, height: 4, borderRadius: 22, backgroundColor: "#000000A0", marginTop: -2 }} />
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
      style={{ flex: 1, position: "relative", overflow: "hidden", backgroundColor: "#07121A" }}
      onLayout={onLayout}
    >
      {/* L0: Drawn sanctuary garden scene */}
      <SanctuaryBackground aw={W} ah={H} />

      {/* L1: Solid stone lane */}
      {W > 20 && <WaypointLane aw={W} ah={H} />}

      {/* L2: Six octagonal stone platforms (each IS the tap target) */}
      {W > 20 && DEPLOY_TILES.map((_, i) => (
        <StonePad
          key={i} aw={W} ah={H} tileIdx={i}
          occupied={deployedUnits.some((u: any) => u.tileIndex === i)}
          selected={!!selectedUnit} canAfford={canAfford}
          isMergeCandidate={mergeTileSet.has(i)}
          onPress={() => onTilePress(i)}
        />
      ))}

      {/* L3 / L4: Gate + Lantern */}
      {W > 20 && <GatePortal aw={W} ah={H} spawnQueueLen={spawnQueueLen} />}
      {W > 20 && <LanternShrine aw={W} ah={H} stability={stability} />}

      {/* L5: Subtle edge vignette */}
      <LinearGradient
        colors={["#00000070", "#00000000", "#00000000", "#00000070"]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { zIndex: 7, pointerEvents: "none" }]}
      />

      {/* L6: Hero sprites */}
      {W > 20 && DEPLOY_TILES.map((_, i) => (
        <HeroOnPad key={i} aw={W} ah={H} tileIdx={i}
          unit={deployedUnits.find((u: any) => u.tileIndex === i)}
          bobY={bobY} unitColors={unitColors}
        />
      ))}

      {/* L7: Projectiles */}
      {projectiles.map((p: any) => (
        <ProjectileDot key={p.uid} aw={W} ah={H} p={p} />
      ))}

      {/* L8: Enemies walking the lane */}
      {enemies.map((e: any) => (
        <EnemyOnPath key={e.uid} aw={W} ah={H} enemy={e} bobY={bobY} />
      ))}
    </View>
  );
}
