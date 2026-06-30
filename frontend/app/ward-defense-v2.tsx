/**
 * Ward Defense V2 — Lotus Healing Sanctum (Layer-Based Fixed Layout)
 *
 * RENDERING PHILOSOPHY — strict layout replication:
 *   Every visual element is a declared CSS layer at exact board-fraction coords.
 *   Nothing relies on the background image having a path in the right place.
 *
 *   Layer 1  bg    — background art (atmosphere only, contentFit="cover")
 *   Layer 2  plat  — center platform block (stone arena where heroes stand)
 *   Layer 3  lane  — U-shaped stone walkway (left strip + bottom strip + right strip)
 *   Layer 4  pads  — 6 stone medallion deploy pads (2×3 centered in platform)
 *   Layer 5  gate  — Disease Gate portal (left lane entry, top-left block)
 *   Layer 6  lant  — Vital Lantern shrine (right lane exit, top-right block)
 *   Layer 7  vig   — edge vignette
 *   Layer 8  hero  — hero sprites standing on pads (Animated, above pads)
 *   Layer 9  proj  — projectiles
 *   Layer 10 enemy — enemy sprites walking on lane (Animated)
 *
 * COORDINATE SYSTEM: px = fx * aw,  py = fy * ah   (direct board fractions)
 * No cover-mode math. No imgPx. No offset calculations.
 */
import React from "react";
import {
  View, Text, Animated, Pressable, StyleSheet, LayoutChangeEvent,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

/* ═══════════════════════════════════════════════════════════════════════════
   LAYOUT CONSTANTS  (board-fraction units, 0–1)
   ─────────────────────────────────────────────────────────────────────────
   Lane geometry — U-shape:
     • Left corridor:   x  0  →  LX,  y  TY → BY
     • Bottom corridor: x  0  →  1,   y  BY → 1
     • Right corridor:  x  RX →  1,   y  TY → BY
     • Center platform: x  LX →  RX,  y   0 → BY   (heroes deployed here)

   Enemy walk centerline runs through the mid-x of each corridor.
   ═══════════════════════════════════════════════════════════════════════════ */
const LX = 0.18;   /* inner edge of left corridor  */
const RX = 0.82;   /* inner edge of right corridor */
const TY = 0.22;   /* top y — gate / lantern openings start here */
const BY = 0.76;   /* top y of bottom corridor     */

/* Enemy path waypoints — centerline of the stone lane */
export const PATH_WPS: [number, number][] = [
  [0.09, 0.30],   /* Disease Gate entry  (left corridor center) */
  [0.09, 0.83],   /* bottom-left corner  */
  [0.91, 0.83],   /* bottom-right corner */
  [0.91, 0.30],   /* Vital Lantern exit  (right corridor center) */
];

/* Six deploy pads — 2 rows × 3 cols, centered inside the platform */
export const DEPLOY_TILES: [number, number][] = [
  [0.35, 0.40], [0.50, 0.40], [0.65, 0.40],   /* top row    */
  [0.35, 0.59], [0.50, 0.59], [0.65, 0.59],   /* bottom row */
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
   LAYER 2 — CENTER PLATFORM
   Dark stone block that fills the inner arena (between the two corridors).
   Enemies NEVER walk here — this is the heroes' territory.
   ═══════════════════════════════════════════════════════════════════════════ */
function CenterPlatform({ aw, ah }: { aw: number; ah: number }) {
  return (
    <LinearGradient
      colors={["#1A1408", "#211A0A", "#1A1408"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{
        position: "absolute",
        left: LX * aw, top: 0,
        width: (RX - LX) * aw,
        height: BY * ah,
        zIndex: 2,
        borderLeftWidth: 2.5,
        borderRightWidth: 2.5,
        borderBottomWidth: 2.5,
        borderColor: "#0D0904",
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 3 — STONE LANE  (U-shaped enemy walkway)
   Three overlapping View strips: left vertical + bottom horizontal + right vertical.
   The strips share the corner squares naturally through z-stacking.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Stone palette */
const S_DARK   = "#0D0904";
const S_BASE   = "#2A2010";
const S_MID    = "#3D3018";
const S_LIGHT  = "#574830";
const S_BORDER = "#0D0904";

function LaneStrip({
  left, top, w, h, horizontal,
}: { left: number; top: number; w: number; h: number; horizontal: boolean }) {
  return (
    <LinearGradient
      colors={horizontal
        ? [S_DARK, S_MID, S_LIGHT, S_MID, S_DARK]   /* top→bottom for horiz strip */
        : [S_DARK, S_MID, S_LIGHT, S_MID, S_DARK]}   /* left→right for vert strip */
      start={horizontal ? { x: 0, y: 0 } : { x: 0, y: 0.5 }}
      end={horizontal   ? { x: 0, y: 1 } : { x: 1, y: 0.5 }}
      style={{
        position: "absolute",
        left, top, width: w, height: h,
        zIndex: 3,
        borderColor: S_BORDER,
      }}
    />
  );
}

function StoneLane({ aw, ah }: { aw: number; ah: number }) {
  const leftW  = LX * aw;               /* left corridor width        */
  const rightX = RX * aw;               /* right corridor left edge   */
  const rightW = (1 - RX) * aw;         /* right corridor width        */
  const corrT  = TY * ah;               /* top of vertical corridors  */
  const corrH  = (BY - TY) * ah;        /* height of vertical corr.   */
  const botT   = BY * ah;               /* top of bottom corridor     */
  const botH   = (1 - BY) * ah;         /* height of bottom corridor  */

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 3, pointerEvents: "none" }]}>
      {/* Left vertical corridor */}
      <LaneStrip left={0} top={corrT} w={leftW}  h={corrH} horizontal={false} />
      {/* Right vertical corridor */}
      <LaneStrip left={rightX} top={corrT} w={rightW} h={corrH} horizontal={false} />
      {/* Bottom horizontal corridor — full width */}
      <LaneStrip left={0} top={botT}  w={aw}    h={botH}  horizontal={true}  />

      {/* Stone tile seam lines in left corridor */}
      {[0.33, 0.55, 0.77].map(yf => (
        <View key={`lts-${yf}`} style={{
          position: "absolute", zIndex: 4,
          left: 3, top: corrT + yf * corrH,
          width: leftW - 6, height: 1,
          backgroundColor: S_DARK + "aa",
        }}/>
      ))}
      {/* Stone tile seam lines in right corridor */}
      {[0.33, 0.55, 0.77].map(yf => (
        <View key={`rts-${yf}`} style={{
          position: "absolute", zIndex: 4,
          left: rightX + 3, top: corrT + yf * corrH,
          width: rightW - 6, height: 1,
          backgroundColor: S_DARK + "aa",
        }}/>
      ))}
      {/* Stone tile seam lines in bottom corridor (vertical dividers) */}
      {[0.20, 0.40, 0.60, 0.80].map(xf => (
        <View key={`bts-${xf}`} style={{
          position: "absolute", zIndex: 4,
          left: xf * aw, top: botT + 3,
          width: 1, height: botH - 6,
          backgroundColor: S_DARK + "aa",
        }}/>
      ))}

      {/* Edge borders */}
      <View style={{ position: "absolute", zIndex: 4, left: leftW - 1, top: corrT, width: 2, height: corrH + botH, backgroundColor: S_BORDER }}/>
      <View style={{ position: "absolute", zIndex: 4, left: rightX - 1, top: corrT, width: 2, height: corrH + botH, backgroundColor: S_BORDER }}/>
      <View style={{ position: "absolute", zIndex: 4, left: 0, top: corrT - 1, width: leftW, height: 2, backgroundColor: S_BORDER }}/>
      <View style={{ position: "absolute", zIndex: 4, left: rightX, top: corrT - 1, width: rightW, height: 2, backgroundColor: S_BORDER }}/>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 4 — STONE MEDALLION DEPLOY PADS
   Each pad is a proper stone circle at its exact (fx, fy) board position.
   The Pressable wraps a visual medallion + tap affordance.
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
  /* Pad radius scales with the shorter board dimension */
  const R = cl(Math.min(aw, ah) * 0.073, 24, 44);

  /* Only show selection affordance on UNOCCUPIED pads */
  const accentC = isMergeCandidate
    ? "#facc15"
    : (!occupied && selected && canAfford)  ? "#22d3ee"
    : (!occupied && selected && !canAfford) ? "#64748b"
    : null;

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        left: cx - R - 10, top: cy - R - 10,
        width: (R + 10) * 2, height: (R + 10) * 2,
        alignItems: "center", justifyContent: "center",
        zIndex: 6,
      }}
    >
      {/* Outer glow halo when selected */}
      {accentC && (
        <View style={{
          position: "absolute",
          width: R * 2 + 20, height: R * 2 + 20,
          borderRadius: R + 10,
          borderWidth: 2.5,
          borderColor: accentC + "66",
        }}/>
      )}
      {/* Shadow ring */}
      <View style={{
        width: R * 2 + 8, height: R * 2 + 8, borderRadius: R + 4,
        backgroundColor: "#000000aa",
        alignItems: "center", justifyContent: "center",
      }}>
        {/* Stone border ring */}
        <View style={{
          width: R * 2, height: R * 2, borderRadius: R,
          borderWidth: 3,
          borderColor: accentC ?? "#1A1408",
          overflow: "hidden",
          alignItems: "center", justifyContent: "center",
        }}>
          {/* Stone surface — warm stone gradient */}
          <LinearGradient
            colors={["#9C876A", "#7A6248", "#5C4A32", "#4A3A24"]}
            start={{ x: 0.25, y: 0 }} end={{ x: 0.75, y: 1 }}
            style={{ position: "absolute", left: 0, top: 0, width: R * 2, height: R * 2 }}
          />
          {/* Carved inner circle */}
          <View style={{
            width: R - 8, height: R - 8, borderRadius: R,
            borderWidth: 1.5,
            borderColor: accentC ? accentC + "99" : "#2A1E0A",
            backgroundColor: "transparent",
          }}/>
          {/* Affordance symbol */}
          {selected && !occupied && (
            <Text style={{
              position: "absolute",
              color: canAfford ? "#22d3ee" : "#475569",
              fontSize: R * 0.40, fontWeight: "800",
            }}>
              {canAfford ? "+" : "—"}
            </Text>
          )}
          {isMergeCandidate && (
            <Text style={{ position: "absolute", color: "#facc15", fontSize: R * 0.45, fontWeight: "800" }}>
              ★
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 5 — DISEASE GATE PORTAL  (left wall, top-left block)
   Fills the left corridor above the enemy entry point.
   ═══════════════════════════════════════════════════════════════════════════ */
function GatePortal({ aw, ah, spawnQueueLen }: { aw: number; ah: number; spawnQueueLen: number }) {
  const w = LX * aw;
  const h = TY * ah;

  return (
    <View style={{
      position: "absolute",
      left: 0, top: 0, width: w, height: h + 4,
      zIndex: 8, overflow: "hidden",
    }}>
      <LinearGradient
        colors={["#1A0828", "#240C38", "#1A0828"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 4 }}
      >
        {/* Portal eye orb */}
        <View style={{
          width: w * 0.68, height: w * 0.68, borderRadius: w * 0.34,
          backgroundColor: "#2D0A50",
          borderWidth: 2, borderColor: "#8B5CF6",
          alignItems: "center", justifyContent: "center",
          marginBottom: 4,
        }}>
          <View style={{
            width: w * 0.30, height: w * 0.30, borderRadius: w * 0.15,
            backgroundColor: "#6D28D9",
            borderWidth: 1.5, borderColor: "#A78BFA",
          }}/>
        </View>

        {spawnQueueLen > 0 && (
          <View style={{
            backgroundColor: "#3B0764EE", borderRadius: 4,
            paddingHorizontal: 4, paddingVertical: 1,
            borderWidth: 1, borderColor: "#A855F7",
            marginBottom: 2,
          }}>
            <Text style={{ color: "#E9D5FF", fontSize: 6.5, fontWeight: "800" }}>
              ⚡ {spawnQueueLen}
            </Text>
          </View>
        )}

        <Text style={{ color: "#C4B5FD", fontSize: 5.5, fontWeight: "800", letterSpacing: 0.8, textAlign: "center" }}>
          DISEASE{"\n"}GATE
        </Text>
      </LinearGradient>

      {/* Bottom border joining the lane */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2.5, backgroundColor: S_BORDER }}/>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 6 — VITAL LANTERN SHRINE  (right wall, top-right block)
   Fills the right corridor above the enemy exit point, with stability bar.
   ═══════════════════════════════════════════════════════════════════════════ */
function LanternShrine({ aw, ah, stability }: { aw: number; ah: number; stability: number }) {
  const w    = (1 - RX) * aw;
  const h    = TY * ah;
  const pct  = cl(stability, 0, 100);
  const glow = pct > 60 ? "#22D3EE" : pct > 30 ? "#FACC15" : "#EF4444";

  return (
    <View style={{
      position: "absolute",
      right: 0, top: 0, width: w, height: h + 4,
      zIndex: 8, overflow: "hidden",
    }}>
      <LinearGradient
        colors={["#041818", "#062424", "#041818"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 4 }}
      >
        {/* Lantern orb */}
        <View style={{
          width: w * 0.68, height: w * 0.68, borderRadius: w * 0.34,
          backgroundColor: "#051E1E",
          borderWidth: 2, borderColor: glow,
          alignItems: "center", justifyContent: "center",
          marginBottom: 4,
        }}>
          <View style={{
            width: w * 0.30, height: w * 0.30, borderRadius: w * 0.15,
            backgroundColor: glow + "60",
            borderWidth: 1.5, borderColor: glow,
          }}/>
        </View>

        {/* Stability bar */}
        <View style={{
          width: w * 0.82, height: 5, backgroundColor: "#00000070",
          borderRadius: 3, overflow: "hidden",
          borderWidth: 0.5, borderColor: glow + "60",
          marginBottom: 2,
        }}>
          <View style={{
            width: `${pct}%` as any, height: "100%",
            backgroundColor: glow, borderRadius: 3,
          }}/>
        </View>

        <Text style={{ color: "#A7F3D0", fontSize: 5, fontWeight: "800", letterSpacing: 0.5, textAlign: "center" }}>
          VITAL{"\n"}LANTERN
        </Text>
        <Text style={{ color: glow, fontSize: 7, fontWeight: "700" }}>{pct}%</Text>
      </LinearGradient>

      {/* Bottom border joining the lane */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2.5, backgroundColor: S_BORDER }}/>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 8 — HERO SPRITE ON PAD
   Separate from the Pressable (StonePad) so the sprite can be Animated.
   Feet rest just above the pad center.
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
      top:  cy - HERO_H - 4,   /* feet 4px above pad centre */
      width: HERO_W,
      alignItems: "center",
      zIndex: 10,
      transform: [{ translateY: bobY }],
    }}>
      {/* HP bar — only when damaged */}
      {hpPct < 0.99 && (
        <View style={{
          width: 38, height: 4, backgroundColor: "#00000090",
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
          <Text style={{ fontSize: 28 }}>🧙</Text>
        </View>
      )}

      {isFlash && (
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "#FFFFFF30", borderRadius: 6, zIndex: 1,
        }}/>
      )}
      {/* Foot shadow on pad */}
      <View style={{
        width: 30, height: 4, borderRadius: 15,
        backgroundColor: "#00000080", marginTop: -3,
      }}/>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 9 — PROJECTILE
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
      left: px - 6, top: py - 6,
      width: 12, height: 12, borderRadius: 6,
      backgroundColor: col + "55", borderWidth: 2, borderColor: col,
      alignItems: "center", justifyContent: "center", zIndex: 13,
    }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#fff" }}/>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 10 — ENEMY ON LANE
   Positioned at the enemy's lane coordinate (fx*aw, fy*ah) with sprite above.
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
  const sprW    = isBoss ? 66 : 48;
  const sprH    = isBoss ? 66 : 48;
  const barW    = isBoss ? 58 : 42;
  const accent  = ENEMY_COLOR[enemy.typeId] ?? "#94a3b8";
  const img     = IMG_ENEMIES[enemy.typeId];

  return (
    <Animated.View style={{
      position: "absolute",
      left: px - sprW / 2,
      top:  py - sprH - 22,   /* sprite hovers above its lane point */
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
        }}/>
      </View>

      {/* Clinical cue badge */}
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
        <Text style={{ color: accent, fontSize: 7.5, fontWeight: "700", marginBottom: 1 }}>
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
          <Text style={{ fontSize: isBoss ? 22 : 16 }}>
            {enemy.typeId === "bronchospasm_drake" ? "🐉"
              : enemy.typeId === "hypoxia_wraith"  ? "👻"
              : enemy.typeId === "mucus_slime"     ? "🫧" : "💨"}
          </Text>
        </View>
      )}

      {/* Hit flash overlay */}
      {isFlash && (
        <View style={{
          position: "absolute", top: 14, left: 0, right: 0, bottom: 4,
          backgroundColor: "#FFFFFF28", borderRadius: 10, zIndex: 15,
        }}/>
      )}
      {(enemy.slowTicks ?? 0) > 0 && (
        <View style={{
          position: "absolute", top: 12, right: -8,
          backgroundColor: "#A78BFA22", borderRadius: 3, paddingHorizontal: 2,
        }}>
          <Text style={{ color: "#A78BFA", fontSize: 5 }}>↓</Text>
        </View>
      )}

      {/* Foot shadow on lane */}
      <View style={{
        width: isBoss ? 46 : 32, height: 4, borderRadius: 24,
        backgroundColor: "#000000A0", marginTop: -2,
      }}/>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN BOARD EXPORT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function WardDefenseV2Screen() { return null; } /* satisfies Expo router */

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
      style={{ flex: 1, position: "relative", overflow: "hidden", backgroundColor: "#0D0A06" }}
      onLayout={onLayout}
    >
      {/* ── L1: Background art — atmosphere & texture ── */}
      <ExpoImage
        key={`board-${Math.round(W)}-${Math.round(H)}`}
        source={IMG_BOARD}
        style={[StyleSheet.absoluteFillObject, { opacity: 0.70 }]}
        contentFit="cover"
        cachePolicy="none"
      />

      {/* ── L2: Center platform block ── */}
      {aw > 20 && <CenterPlatform aw={W} ah={H} />}

      {/* ── L3: Stone U-lane strips ── */}
      {aw > 20 && <StoneLane aw={W} ah={H} />}

      {/* ── L4: Six stone medallion deploy pads ── */}
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

      {/* ── L5: Gate portal (left) + Lantern shrine (right) ── */}
      {aw > 20 && <GatePortal aw={W} ah={H} spawnQueueLen={spawnQueueLen} />}
      {aw > 20 && <LanternShrine aw={W} ah={H} stability={stability} />}

      {/* ── L7: Edge vignette ── */}
      <LinearGradient
        colors={["#00000060", "#00000000", "#00000000", "#00000060"]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { zIndex: 7, pointerEvents: "none" }]}
      />

      {/* ── L8: Hero sprites standing on pads ── */}
      {aw > 20 && DEPLOY_TILES.map((_, i) => (
        <HeroOnPad
          key={i}
          aw={W} ah={H} tileIdx={i}
          unit={deployedUnits.find((u: any) => u.tileIndex === i)}
          bobY={bobY}
          unitColors={unitColors}
        />
      ))}

      {/* ── L9: Projectiles ── */}
      {projectiles.map((p: any) => (
        <ProjectileDot key={p.uid} aw={W} ah={H} p={p} />
      ))}

      {/* ── L10: Enemy sprites walking on lane ── */}
      {enemies.map((e: any) => (
        <EnemyOnPath key={e.uid} aw={W} ah={H} enemy={e} bobY={bobY} />
      ))}
    </View>
  );
}
