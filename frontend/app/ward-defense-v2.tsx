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

/* ─── Lane geometry — board-fraction units ──────────────────────────────────
   U-shaped stone lane:
     Left corridor  : x  0  → LX,  y  0 → BY
     Bottom corridor: x  0  → 1,   y BY → 1
     Right corridor : x RX  → 1,   y  0 → BY
   Center zone (heroes): x LX → RX, y 0 → BY                               */
const LX = 0.17;
const RX = 0.83;
const BY = 0.77;

/* Enemy walk centerline (mid-x of each corridor) */
export const PATH_WPS: [number, number][] = [
  [0.085, 0.30],  /* Disease Gate entry  */
  [0.085, 0.83],  /* bottom-left corner  */
  [0.915, 0.83],  /* bottom-right corner */
  [0.915, 0.30],  /* Vital Lantern exit  */
];

/* Six deploy pads — 2 rows × 3 cols, centered in the platform area */
export const DEPLOY_TILES: [number, number][] = [
  [0.35, 0.40], [0.50, 0.40], [0.65, 0.40],
  [0.35, 0.59], [0.50, 0.59], [0.65, 0.59],
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
   LAYER 2 — PALE STONE LANE OVERLAY
   A warm cream/stone semi-transparent tint brightens the corridor areas,
   making the walkway read as lighter stone vs the darker lotus/water zones.
   The borders are warm amber lines that define the path edges precisely.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Palette — pale warm stone  (stronger for visual clarity) */
const LANE_FILL   = "rgba(195, 165, 95,  0.44)";  /* warm amber at 44%       */
const LANE_EDGE_L = "rgba(145, 110, 48,  0.68)";  /* deeper amber edge       */
const LANE_EDGE_R = "rgba(145, 110, 48,  0.68)";
const LANE_BORDER = "rgba(80,  55,  15,  0.88)";  /* near-opaque dark seam   */

function LaneStrip({
  left, top, width, height, dir,
}: {
  left: number; top: number; width: number; height: number;
  dir: "horiz" | "vert";
}) {
  const colorsH: [string, string, string] = [LANE_EDGE_L, LANE_FILL, LANE_EDGE_R];
  const colorsV: [string, string, string] = [LANE_EDGE_L, LANE_FILL, LANE_EDGE_R];
  return (
    <LinearGradient
      colors={dir === "vert" ? colorsH : colorsV}
      start={dir === "vert" ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
      end={dir === "vert"   ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
      style={{ position: "absolute", left, top, width, height }}
    />
  );
}

function StoneLane({ aw, ah }: { aw: number; ah: number }) {
  const leftW  = LX * aw;
  const rightX = RX * aw;
  const rightW = (1 - RX) * aw;
  const corrH  = BY * ah;
  const botT   = BY * ah;
  const botH   = (1 - BY) * ah;

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 3, pointerEvents: "none" }]}>
      {/* Left vertical corridor — pale stone tint */}
      <LaneStrip left={0} top={0} width={leftW} height={corrH} dir="vert" />
      {/* Right vertical corridor */}
      <LaneStrip left={rightX} top={0} width={rightW} height={corrH} dir="vert" />
      {/* Bottom horizontal corridor */}
      <LaneStrip left={0} top={botT} width={aw} height={botH} dir="horiz" />

      {/* Inner-edge border lines — amber, 72% opaque, clearly define the path */}
      <View style={{ position:"absolute", left:leftW-1.5,  top:0, width:3, height:corrH+botH, backgroundColor:LANE_BORDER }}/>
      <View style={{ position:"absolute", left:rightX-1.5, top:0, width:3, height:corrH+botH, backgroundColor:LANE_BORDER }}/>
      <View style={{ position:"absolute", left:0, top:botT-1.5, width:aw, height:3, backgroundColor:LANE_BORDER }}/>

      {/* Subtle stone-tile seam lines inside left corridor */}
      {[0.25, 0.50, 0.72].map(yf => (
        <View key={`l${yf}`} style={{
          position:"absolute", left:3, top:yf*corrH,
          width:leftW-6, height:1.5,
          backgroundColor:"rgba(140,105,45,0.35)",
        }}/>
      ))}
      {/* Seam lines inside right corridor */}
      {[0.25, 0.50, 0.72].map(yf => (
        <View key={`r${yf}`} style={{
          position:"absolute", left:rightX+3, top:yf*corrH,
          width:rightW-6, height:1.5,
          backgroundColor:"rgba(140,105,45,0.35)",
        }}/>
      ))}
      {/* Seam lines inside bottom corridor */}
      {[0.25, 0.50, 0.75].map(xf => (
        <View key={`b${xf}`} style={{
          position:"absolute", left:xf*aw, top:botT+3,
          width:1.5, height:botH-6,
          backgroundColor:"rgba(140,105,45,0.35)",
        }}/>
      ))}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 3 — STONE MEDALLION DEPLOY PADS
   Solid warm-stone circles anchored at exact deploy tile positions.
   Show selection affordance ring on unoccupied pads when a unit is selected.
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
  const R  = cl(Math.min(aw, ah) * 0.072, 22, 42);

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
      {/* Glow halo — only when selected/merge-candidate */}
      {accentC && (
        <View style={{
          position: "absolute",
          width: R * 2 + 18, height: R * 2 + 18, borderRadius: R + 9,
          borderWidth: 2, borderColor: accentC + "66",
        }}/>
      )}

      {/* Drop shadow */}
      <View style={{
        width: R * 2 + 6, height: R * 2 + 6, borderRadius: R + 3,
        backgroundColor: "#00000055",
        alignItems: "center", justifyContent: "center",
      }}>
        {/* Stone ring */}
        <View style={{
          width: R * 2, height: R * 2, borderRadius: R,
          borderWidth: 2.5,
          borderColor: accentC ?? "#4A3820",
          overflow: "hidden",
          alignItems: "center", justifyContent: "center",
        }}>
          {/* Warm stone surface */}
          <LinearGradient
            colors={["#B09878", "#8C7A58", "#6B5840", "#544430"]}
            start={{ x: 0.25, y: 0 }} end={{ x: 0.75, y: 1 }}
            style={{ position: "absolute", left: 0, top: 0, width: R * 2, height: R * 2 }}
          />
          {/* Carved inner ring */}
          <View style={{
            width: R - 7, height: R - 7, borderRadius: R,
            borderWidth: 1.5,
            borderColor: accentC ? accentC + "88" : "#2E2010",
          }}/>
          {/* Symbol on empty selected pad */}
          {selected && !occupied && (
            <Text style={{
              position: "absolute",
              color: canAfford ? "#22d3ee" : "#475569",
              fontSize: R * 0.38, fontWeight: "800",
            }}>
              {canAfford ? "+" : "—"}
            </Text>
          )}
          {isMergeCandidate && (
            <Text style={{ position: "absolute", color: "#facc15", fontSize: R * 0.42, fontWeight: "800" }}>
              ★
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 4 — DISEASE GATE BADGE  (floating pill at left corridor entry)
   ═══════════════════════════════════════════════════════════════════════════ */
function GateBadge({ aw, ah, spawnQueueLen }: { aw: number; ah: number; spawnQueueLen: number }) {
  const cy = PATH_WPS[0][1] * ah;
  return (
    <View style={{
      position: "absolute", left: 3, top: cy - 40,
      zIndex: 22, alignItems: "flex-start",
    }}>
      {spawnQueueLen > 0 && (
        <View style={{
          backgroundColor: "#3B0764EE", borderRadius: 5,
          paddingHorizontal: 6, paddingVertical: 2,
          borderWidth: 1, borderColor: "#A855F7",
          marginBottom: 2,
        }}>
          <Text style={{ color: "#E9D5FF", fontSize: 7, fontWeight: "800" }}>⚡ {spawnQueueLen}</Text>
        </View>
      )}
      <View style={{
        backgroundColor: "#160828DD", borderRadius: 5,
        paddingHorizontal: 6, paddingVertical: 3,
        borderWidth: 1, borderColor: "#7C3AED88",
      }}>
        <Text style={{ color: "#C4B5FD", fontSize: 6.5, fontWeight: "800", letterSpacing: 0.8 }}>
          DISEASE GATE
        </Text>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 5 — VITAL LANTERN BADGE  (floating pill + stability bar, right side)
   ═══════════════════════════════════════════════════════════════════════════ */
function LanternBadge({ aw, ah, stability }: { aw: number; ah: number; stability: number }) {
  const cy  = PATH_WPS[3][1] * ah;
  const pct = cl(stability, 0, 100);
  const glow = pct > 60 ? "#22D3EE" : pct > 30 ? "#FACC15" : "#EF4444";
  return (
    <View style={{
      position: "absolute", right: 3, top: cy - 52,
      zIndex: 22, alignItems: "flex-end",
    }}>
      <View style={{
        backgroundColor: "#061A1ADD", borderRadius: 5,
        paddingHorizontal: 6, paddingVertical: 3,
        borderWidth: 1, borderColor: glow + "88",
        marginBottom: 3,
      }}>
        <Text style={{ color: "#A7F3D0", fontSize: 6.5, fontWeight: "800", letterSpacing: 0.8 }}>
          VITAL LANTERN
        </Text>
      </View>
      <View style={{
        width: 64, height: 5, backgroundColor: "#00000060",
        borderRadius: 3, overflow: "hidden",
        borderWidth: 0.5, borderColor: glow + "60",
      }}>
        <View style={{
          width: `${pct}%` as any, height: "100%",
          backgroundColor: glow, borderRadius: 3,
        }}/>
      </View>
      <Text style={{ color: glow, fontSize: 7, fontWeight: "700", marginTop: 2 }}>{pct}%</Text>
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

      {/* ── L2: Pale stone lane overlay — cream/amber tint marks the path ── */}
      {aw > 20 && <StoneLane aw={W} ah={H} />}

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
      {aw > 20 && <GateBadge aw={W} ah={H} spawnQueueLen={spawnQueueLen} />}
      {aw > 20 && <LanternBadge aw={W} ah={H} stability={stability} />}

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
