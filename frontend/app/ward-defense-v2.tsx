/**
 * Ward Defense V2 — Lotus Healing Sanctum
 *
 * ART-FIRST HYBRID APPROACH (v4):
 *   The illustrated lotus-sanctuary image is the map. CSS layers sit on top.
 *
 *   Layer 1  bg      — illustrated art, 100% opacity (background fills the board)
 *   Layer 2  lane    — pale warm-stone semi-transparent overlay forming the U-path
 *                       (cream/beige tint brightens corridor areas above the art)
 *   Layer 3  pads    — six stone medallion Pressables (solid, embedded look)
 *   Layer 4  gate    — floating Disease Gate pill badge at left corridor entry
 *   Layer 5  lantern — floating Vital Lantern pill badge at right corridor entry
 *   Layer 6  vignette
 *   Layer 7  heroes  — Animated hero sprites on pads
 *   Layer 8  proj    — projectile dots
 *   Layer 9  enemies — Animated enemy sprites on lane
 *
 * COORDINATE SYSTEM: px = fx * aw,  py = fy * ah   (direct board fractions)
 */
import React from "react";
import {
  View, Text, Animated, Pressable, StyleSheet, LayoutChangeEvent,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

/* ─── Path — clockwise loop around 2×3 center platform cluster ─────────────
   Enemies spawn at Disease Gate (upper-left), travel clockwise around the
   six-pad center zone, and exit at Vital Lantern (upper-right).
   All coordinates are board fractions: 0,0 = top-left, 1,1 = bottom-right. */
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
const IMG_BOARD = require("../assets/images/ward_board_scene.png");

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
   LAYER 2 — CONTINUOUS STONE LANE  (follows clockwise PATH_WPS exactly)
   Each segment between consecutive waypoints is a rotated amber strip,
   creating a single unbroken stone walkway around the center platform zone.
   ═══════════════════════════════════════════════════════════════════════════ */

const LANE_FILL   = "rgba(195, 165, 95,  0.50)";
const LANE_BORDER = "rgba(80,  55,  15,  0.82)";

function WaypointLane({ aw, ah }: { aw: number; ah: number }) {
  const LANE_W = Math.max(20, aw * 0.082);   /* ~8.2% of board width */
  const JR     = LANE_W / 2 + 1;             /* junction circle radius */

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 3, pointerEvents: "none" }]}>
      {/* Segments — one per consecutive waypoint pair */}
      {PATH_WPS.slice(0, -1).map(([fx1, fy1], i) => {
        const [fx2, fy2] = PATH_WPS[i + 1];
        const px1 = fx1 * aw, py1 = fy1 * ah;
        const px2 = fx2 * aw, py2 = fy2 * ah;
        const cx  = (px1 + px2) / 2;
        const cy  = (py1 + py2) / 2;
        const dx  = px2 - px1, dy = py2 - py1;
        const segLen = Math.sqrt(dx * dx + dy * dy) + 2;
        const angle  = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left:   cx - segLen / 2,
              top:    cy - LANE_W / 2,
              width:  segLen,
              height: LANE_W,
              transform: [{ rotate: `${angle}deg` }],
              backgroundColor: LANE_FILL,
            }}
          />
        );
      })}

      {/* Junction filled circles at every waypoint — seals corner gaps */}
      {PATH_WPS.map(([fx, fy], i) => (
        <View
          key={`j${i}`}
          style={{
            position: "absolute",
            left: fx * aw - JR,
            top:  fy * ah - JR,
            width: JR * 2, height: JR * 2, borderRadius: JR,
            backgroundColor: LANE_FILL,
          }}
        />
      ))}

      {/* Outer border — drawn as a thin stroke over the fill */}
      {PATH_WPS.slice(0, -1).map(([fx1, fy1], i) => {
        const [fx2, fy2] = PATH_WPS[i + 1];
        const px1 = fx1 * aw, py1 = fy1 * ah;
        const px2 = fx2 * aw, py2 = fy2 * ah;
        const cx  = (px1 + px2) / 2;
        const cy  = (py1 + py2) / 2;
        const dx  = px2 - px1, dy = py2 - py1;
        const segLen = Math.sqrt(dx * dx + dy * dy) + 2;
        const angle  = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={`b${i}`}
            style={{
              position: "absolute",
              left:   cx - segLen / 2,
              top:    cy - LANE_W / 2,
              width:  segLen,
              height: LANE_W,
              transform: [{ rotate: `${angle}deg` }],
              borderTopWidth: 1.5,
              borderBottomWidth: 1.5,
              borderColor: LANE_BORDER,
            }}
          />
        );
      })}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 3 — HEXAGONAL DEPLOY PADS  (matches reference: dark hex frame +
   glowing inner circle with "+" cross — always visible, brighter when active)
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

  /* Accent colours */
  const frameC  = isMerge ? "#f59e0b" : isTargetable ? "#22d3ee" : isBlocked ? "#475569" : "#1e6fa8";
  const glowC   = isMerge ? "#fde047" : isTargetable ? "#7de8ff" : "#3aabe0";
  const innerBg : [string,string,string] = isMerge
    ? ["#1a1200", "#1a1200", "#0d0d00"]
    : ["#041624", "#061e30", "#020e1a"];

  const barLen = R * 0.60;
  const barThk = R * 0.17;

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        left: cx - R - 14, top: cy - R - 14,
        width: (R + 14) * 2, height: (R + 14) * 2,
        alignItems: "center", justifyContent: "center",
        zIndex: 6,
      }}
    >
      {/* Outer glow halo (active state) */}
      {(isTargetable || isMerge) && (
        <View style={{
          position: "absolute",
          width: R * 2 + 24, height: R * 2 + 24, borderRadius: R + 12,
          backgroundColor: frameC + "18",
          borderWidth: 1.5, borderColor: frameC + "55",
        }}/>
      )}

      {/* Circular outer frame — fully round stone platform */}
      <View style={{
        width: R * 2 + 10, height: R * 2 + 10,
        borderRadius: R + 5,              /* fully circular stone platform */
        backgroundColor: "#0b1820ee",
        borderWidth: 2.5, borderColor: frameC,
        alignItems: "center", justifyContent: "center",
        ...(isTargetable && {
          /* CSS box-shadow for web glow */
          boxShadow: `0 0 16px ${frameC}80, 0 0 6px ${frameC}50` as any,
        } as any),
      }}>
        {/* Subtle radial sheen on the circular frame */}
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: R + 5, overflow: "hidden",
        }}>
          <LinearGradient
            colors={["#c8860022", "#00000000", "#c8860022"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
          />
        </View>

        {/* Inner glowing circle */}
        <LinearGradient
          colors={innerBg}
          start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={{
            width: R * 2 - 2, height: R * 2 - 2, borderRadius: R - 1,
            alignItems: "center", justifyContent: "center",
            borderWidth: 1.5, borderColor: glowC + "70",
            overflow: "hidden",
          }}
        >
          {/* Subtle radial sheen */}
          <LinearGradient
            colors={[glowC + "25", "#00000000"]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
          />

          {/* "+" cross bars — always visible on empty pads */}
          {!occupied && !isMerge && (
            <>
              <View style={{
                position: "absolute",
                width: barLen, height: barThk,
                backgroundColor: glowC,
                borderRadius: barThk / 2,
                opacity: isTargetable ? 1.0 : 0.55,
              }}/>
              <View style={{
                position: "absolute",
                width: barThk, height: barLen,
                backgroundColor: glowC,
                borderRadius: barThk / 2,
                opacity: isTargetable ? 1.0 : 0.55,
              }}/>
            </>
          )}

          {/* Merge star */}
          {isMerge && (
            <Text style={{ color: "#fde047", fontSize: R * 0.55, fontWeight: "800" }}>★</Text>
          )}

          {/* Occupied dim glow (hero standing here — sprite covers this) */}
          {occupied && (
            <View style={{
              width: R * 0.55, height: R * 0.55, borderRadius: R * 0.3,
              backgroundColor: glowC + "20",
            }}/>
          )}
        </LinearGradient>
      </View>
    </Pressable>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 4 — DISEASE GATE PORTAL
   Glowing purple swirling portal in the upper-left corridor, matching the
   reference image: purple orb with dark vortex centre + floating label.
   ═══════════════════════════════════════════════════════════════════════════ */
function GatePortal({ aw, ah, spawnQueueLen }: { aw: number; ah: number; spawnQueueLen: number }) {
  const orbR  = cl(Math.min(aw, ah) * 0.062, 20, 40);
  const orbCX = PATH_WPS[0][0] * aw;
  const orbCY = PATH_WPS[0][1] * ah;

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 22, pointerEvents: "none" }]}>
      {/* Purple portal orb */}
      <View style={{
        position: "absolute",
        left: orbCX - orbR, top: orbCY - orbR,
        width: orbR * 2, height: orbR * 2, borderRadius: orbR,
        alignItems: "center", justifyContent: "center",
        ...({ boxShadow: `0 0 ${orbR}px #a855f7cc, 0 0 ${orbR*1.8}px #7c3aed88` } as any),
      }}>
        <LinearGradient
          colors={["#1a0030", "#4c0080", "#7c3aed", "#a855f7", "#7c3aed", "#1a0030"]}
          start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={{ width: orbR * 2, height: orbR * 2, borderRadius: orbR,
                   borderWidth: 2, borderColor: "#c084fc",
                   alignItems: "center", justifyContent: "center" }}
        >
          {/* Dark vortex centre */}
          <View style={{
            width: orbR * 0.7, height: orbR * 0.7, borderRadius: orbR * 0.35,
            backgroundColor: "#05000a",
            borderWidth: 1.5, borderColor: "#a855f788",
          }}/>
        </LinearGradient>
      </View>

      {/* Queue badge */}
      {spawnQueueLen > 0 && (
        <View style={{
          position: "absolute",
          left: orbCX + orbR - 6, top: orbCY - orbR - 4,
          backgroundColor: "#7c3aed", borderRadius: 8,
          paddingHorizontal: 5, paddingVertical: 1,
          borderWidth: 1, borderColor: "#c084fc",
          zIndex: 23,
        }}>
          <Text style={{ color: "#fff", fontSize: 7, fontWeight: "900" }}>⚡{spawnQueueLen}</Text>
        </View>
      )}

      {/* Label */}
      <View style={{
        position: "absolute",
        left: Math.max(1, orbCX - 28), top: orbCY - orbR - 16,
        backgroundColor: "#160828CC",
        paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
        borderWidth: 1, borderColor: "#7c3aed88",
      }}>
        <Text style={{ color: "#e9d5ff", fontSize: 6, fontWeight: "800", letterSpacing: 0.7 }}>
          DISEASE GATE
        </Text>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 5 — VITAL LANTERN SHRINE
   Golden glowing orb/shrine in the upper-right corridor + stability bar.
   ═══════════════════════════════════════════════════════════════════════════ */
function LanternShrine({ aw, ah, stability }: { aw: number; ah: number; stability: number }) {
  const orbR  = cl(Math.min(aw, ah) * 0.062, 20, 40);
  const lastWP = PATH_WPS[PATH_WPS.length - 1];
  const orbCX  = lastWP[0] * aw;
  const orbCY  = lastWP[1] * ah;
  const pct       = cl(stability, 0, 100);
  const glowC     = pct > 60 ? "#fbbf24" : pct > 30 ? "#f59e0b" : "#ef4444";
  const glowShadow = pct > 60 ? "#fbbf24" : pct > 30 ? "#f59e0b" : "#ef4444";

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 22, pointerEvents: "none" }]}>
      {/* Golden shrine orb */}
      <View style={{
        position: "absolute",
        left: orbCX - orbR, top: orbCY - orbR,
        width: orbR * 2, height: orbR * 2, borderRadius: orbR,
        alignItems: "center", justifyContent: "center",
        ...({ boxShadow: `0 0 ${orbR}px ${glowShadow}cc, 0 0 ${orbR*1.8}px ${glowShadow}66` } as any),
      }}>
        <LinearGradient
          colors={["#3d1f00", "#8b4500", glowC, "#fde68a", glowC, "#6b3200"]}
          start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={{ width: orbR * 2, height: orbR * 2, borderRadius: orbR,
                   borderWidth: 2, borderColor: "#fde68a",
                   alignItems: "center", justifyContent: "center" }}
        >
          {/* Lotus inner glyph */}
          <View style={{
            width: orbR * 0.65, height: orbR * 0.65, borderRadius: orbR * 0.33,
            backgroundColor: "#fffbeb33",
            borderWidth: 1.5, borderColor: "#fde68a",
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ fontSize: orbR * 0.38, color: "#fde68a" }}>✦</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Label */}
      <View style={{
        position: "absolute",
        left: orbCX - 30, top: orbCY - orbR - 16,
        backgroundColor: "#06180eCC",
        paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
        borderWidth: 1, borderColor: glowC + "88",
      }}>
        <Text style={{ color: "#fef3c7", fontSize: 6, fontWeight: "800", letterSpacing: 0.7 }}>
          VITAL LANTERN
        </Text>
      </View>

      {/* Stability bar — positioned below the orb */}
      <View style={{
        position: "absolute",
        left: orbCX - 32, top: orbCY + orbR + 3,
        width: 64,
      }}>
        <View style={{
          width: 64, height: 5, backgroundColor: "#00000060",
          borderRadius: 3, overflow: "hidden",
          borderWidth: 0.5, borderColor: glowC + "70",
        }}>
          <View style={{ width: `${pct}%` as any, height: "100%", backgroundColor: glowC, borderRadius: 3 }}/>
        </View>
        <Text style={{ color: glowC, fontSize: 6.5, fontWeight: "700", marginTop: 1, textAlign: "center" }}>
          {pct}%
        </Text>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 7 — HERO SPRITE ON PAD
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
          }}/>
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
        }}/>
      )}
      <View style={{
        width: 28, height: 4, borderRadius: 14,
        backgroundColor: "#00000070", marginTop: -2,
      }}/>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 8 — PROJECTILE
   ═══════════════════════════════════════════════════════════════════════════ */
function ProjectileDot({ aw, ah, p }: { aw: number; ah: number; p: any }) {
  const fx  = lp(p.fromFx, p.toFx, p.progress);
  const fy  = lp(p.fromFy, p.toFy, p.progress);
  const px  = fx * aw;
  const py  = fy * ah;
  const col = p.color ?? "#22d3ee";
  return (
    <View style={{
      position: "absolute",
      left: px - 5, top: py - 5,
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: col + "55", borderWidth: 2, borderColor: col,
      alignItems: "center", justifyContent: "center", zIndex: 13,
    }}>
      <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: "#fff" }}/>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 9 — ENEMY ON LANE
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

  return (
    <Animated.View style={{
      position: "absolute",
      left: px - sprW / 2,
      top:  py - sprH - 20,
      alignItems: "center",
      zIndex: 14,
      transform: [{ translateY: bobY }],
    }}>
      <View style={{
        width: barW, height: 4, backgroundColor: "#00000090",
        borderRadius: 2, marginBottom: 2, overflow: "hidden",
        borderWidth: 0.5, borderColor: "#FFFFFF20",
      }}>
        <View style={{
          width: `${hpPct * 100}%` as any, height: "100%",
          backgroundColor: barCol, borderRadius: 2,
        }}/>
      </View>

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

      {img ? (
        <ExpoImage source={img} style={{ width: sprW, height: sprH }} contentFit="contain" />
      ) : (
        <View style={{
          width: sprW, height: sprH, borderRadius: sprW / 2,
          backgroundColor: accent + "33", borderWidth: 2, borderColor: accent,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: isBoss ? 20 : 15 }}>
            {enemy.typeId === "bronchospasm_drake" ? "🐉"
              : enemy.typeId === "hypoxia_wraith"  ? "👻"
              : enemy.typeId === "mucus_slime"     ? "🫧" : "💨"}
          </Text>
        </View>
      )}

      {isFlash && (
        <View style={{
          position: "absolute", top: 12, left: 0, right: 0, bottom: 4,
          backgroundColor: "#FFFFFF28", borderRadius: 10, zIndex: 15,
        }}/>
      )}
      {(enemy.slowTicks ?? 0) > 0 && (
        <View style={{
          position: "absolute", top: 10, right: -8,
          backgroundColor: "#A78BFA22", borderRadius: 3, paddingHorizontal: 2,
        }}>
          <Text style={{ color: "#A78BFA", fontSize: 5 }}>↓</Text>
        </View>
      )}
      <View style={{
        width: isBoss ? 44 : 30, height: 4, borderRadius: 22,
        backgroundColor: "#000000A0", marginTop: -2,
      }}/>
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
      style={{ flex: 1, position: "relative", overflow: "hidden", backgroundColor: "#0D1A0E" }}
      onLayout={onLayout}
    >
      {/* ── L1: Full illustrated lotus-sanctuary art — 100% opacity ── */}
      <ExpoImage
        key={`board-${Math.round(W)}-${Math.round(H)}`}
        source={IMG_BOARD}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        cachePolicy="none"
      />

      {/* ── L2: Continuous waypoint-following stone lane ── */}
      {aw > 20 && <WaypointLane aw={W} ah={H} />}

      {/* ── L3: Six stone medallion deploy pads ── */}
      {aw > 20 && DEPLOY_TILES.map((_, i) => (
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

      {/* ── L4 / L5: Disease Gate + Vital Lantern floating badges ── */}
      {aw > 20 && <GatePortal aw={W} ah={H} spawnQueueLen={spawnQueueLen} />}
      {aw > 20 && <LanternShrine aw={W} ah={H} stability={stability} />}

      {/* ── L6: Subtle edge vignette ── */}
      <LinearGradient
        colors={["#00000050", "#00000000", "#00000000", "#00000050"]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { zIndex: 7, pointerEvents: "none" }]}
      />

      {/* ── L7: Hero sprites standing on pads ── */}
      {aw > 20 && DEPLOY_TILES.map((_, i) => (
        <HeroOnPad
          key={i}
          aw={W} ah={H} tileIdx={i}
          unit={deployedUnits.find((u: any) => u.tileIndex === i)}
          bobY={bobY}
          unitColors={unitColors}
        />
      ))}

      {/* ── L8: Projectiles ── */}
      {projectiles.map((p: any) => (
        <ProjectileDot key={p.uid} aw={W} ah={H} p={p} />
      ))}

      {/* ── L9: Enemy sprites walking on lane ── */}
      {enemies.map((e: any) => (
        <EnemyOnPath key={e.uid} aw={W} ah={H} enemy={e} bobY={bobY} />
      ))}
    </View>
  );
}
