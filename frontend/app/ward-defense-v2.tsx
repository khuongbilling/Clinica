/**
 * Ward Defense V2 — Lotus Healing Sanctum
 *
 * RENDERING APPROACH — IMAGE-FIRST:
 *   Board background, unit sprites, and enemy sprites are all illustrated PNGs.
 *   CSS Views are used only for interactive overlays (HP bars, badges, pads, projectiles).
 *
 * FRAMING FIX:
 *   Board image is 9:16 portrait. resizeMode="contain" keeps the full scene visible
 *   with scenic margins. All overlay positions (portal, lantern, tiles, enemies) are
 *   computed from the image's actual pixel-level rendering bounds so they stay perfectly
 *   aligned with the background art at any board size.
 */
import React from "react";
import {
  View, Text, Animated, Pressable,
  StyleSheet, LayoutChangeEvent,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

/* ── Path + tile constants — must mirror ward-defense.tsx ─────────────────── */
/* U-path: Disease Gate top-LEFT → down left → across bottom → up right → Vital Lantern top-RIGHT */
const PATH_WPS: [number, number][] = [
  [0.14, 0.10],   /* Disease Gate (top-left) */
  [0.14, 0.82],   /* bottom-left corner */
  [0.86, 0.82],   /* bottom-right corner */
  [0.86, 0.10],   /* Vital Lantern (top-right) */
];

const DEPLOY_TILES: [number, number][] = [
  [0.33, 0.32], [0.50, 0.32], [0.67, 0.32],  /* top row */
  [0.33, 0.58], [0.50, 0.58], [0.67, 0.58],  /* bottom row */
];

/* ── Illustrated image assets ─────────────────────────────────────────────── */
const IMG_BOARD = require("../assets/images/ward_board_scene.png");
const IMG_UNITS: Record<string, any> = {
  ward_scout:  require("../assets/images/sprite_ward_scout.png"),
  mist_caster: require("../assets/images/sprite_mist_caster.png"),
  o2_healer:   require("../assets/images/sprite_o2_healer.png"),
};
const IMG_ENEMIES: Record<string, any> = {
  breathless_wisp:    require("../assets/images/enemy_breathless_wisp.png"),
  wheeze_sprite:      require("../assets/images/enemy_wheeze_sprite.png"),
  mucus_slime:        require("../assets/images/enemy_mucus_slime.png"),
  hypoxia_wraith:     require("../assets/images/enemy_hypoxia_wraith.png"),
  bronchospasm_drake: require("../assets/images/enemy_bronchospasm_drake.png"),
};

/* ── Enemy accent colors ──────────────────────────────────────────────────── */
const ENEMY_COLOR: Record<string, string> = {
  breathless_wisp:    "#93c5fd",
  wheeze_sprite:      "#34d399",
  mucus_slime:        "#86efac",
  hypoxia_wraith:     "#c4b5fd",
  bronchospasm_drake: "#fb923c",
};

/* ── Prop interface ───────────────────────────────────────────────────────── */
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

/* ── Pure helpers ─────────────────────────────────────────────────────────── */
function cl(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function lp(a: number, b: number, t: number)   { return a + (b - a) * cl(t, 0, 1); }

function getEnemyFrac(e: { pathIndex: number; pathProgress: number }): [number, number] {
  const pi   = cl(e.pathIndex, 0, PATH_WPS.length - 2);
  const from = PATH_WPS[pi];
  const to   = PATH_WPS[pi + 1];
  return [lp(from[0], to[0], e.pathProgress), lp(from[1], to[1], e.pathProgress)];
}

/* ── Image-bounds alignment system ───────────────────────────────────────────
   The board image is 9:16 portrait; resizeMode="contain" letterboxes it inside
   the View. These helpers compute the image's actual rendered rectangle so every
   CSS overlay (portal, lantern, tiles, enemies) aligns precisely with the art.
─────────────────────────────────────────────────────────────────────────────── */
const IMG_AR_W = 3, IMG_AR_H = 4; /* 3:4 portrait — matches generated map aspect ratio */

type ImgBounds = { iw: number; ih: number; ox: number; oy: number };

function getImgBounds(aw: number, ah: number): ImgBounds {
  const scale = Math.min(aw / IMG_AR_W, ah / IMG_AR_H);
  const iw = IMG_AR_W * scale;
  const ih = IMG_AR_H * scale;
  return { iw, ih, ox: (aw - iw) / 2, oy: (ah - ih) / 2 };
}

/** Convert fractional [0..1, 0..1] image coordinates → absolute view pixels */
function imgPx(fx: number, fy: number, b: ImgBounds): [number, number] {
  return [b.ox + fx * b.iw, b.oy + fy * b.ih];
}

/* ════════════════════════════════════════════════════════════════════════════
   BOARD SCENE — illustrated PNG (contained) + directional arrow guides
════════════════════════════════════════════════════════════════════════════ */
function BoardScene({ aw, ah, imgBounds: b }: { aw: number; ah: number; imgBounds: ImgBounds }) {
  const arrows: { cx: number; cy: number; deg: number }[] = [];
  for (let seg = 0; seg < PATH_WPS.length - 1; seg++) {
    const [ax, ay] = PATH_WPS[seg];
    const [bx, by] = PATH_WPS[seg + 1];
    const [cx, cy] = imgPx((ax + bx) / 2, (ay + by) / 2, b);
    const deg = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    arrows.push({ cx, cy, deg });
  }

  return (
    <>
      {/* Dark atmospheric background — fills board behind letterboxed image */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#040c14" }]} />

      {/* Subtle vignette at top and bottom edges */}
      <LinearGradient
        colors={["#00000055", "#00000000", "#00000000", "#00000060"]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
      />

      {/* Illustrated board background — expo-image contentFit="contain" is reliable on web */}
      <ExpoImage
        source={IMG_BOARD}
        style={StyleSheet.absoluteFillObject}
        contentFit="contain"
        contentPosition="center"
      />

      {/* Enemy path corridor strips — show the route enemies walk */}
      {aw > 20 && PATH_WPS.slice(0, -1).map((wp, seg) => {
        const [ax, ay] = imgPx(wp[0], wp[1], b);
        const to = PATH_WPS[seg + 1];
        const [bx2, by2] = imgPx(to[0], to[1], b);
        const dx = bx2 - ax, dy = by2 - ay;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const cx = (ax + bx2) / 2, cy = (ay + by2) / 2;
        const RW = 22;
        return (
          <View key={`road-${seg}`} style={{
            position: "absolute",
            left: cx - len / 2, top: cy - RW / 2,
            width: len, height: RW,
            backgroundColor: "#7c3aed14",
            borderTopWidth: 1, borderBottomWidth: 1,
            borderColor: "#a855f730",
            transform: [{ rotate: `${angle}deg` }],
            zIndex: 3,
          }}/>
        );
      })}

      {/* Path direction arrows — aligned to image content */}
      {aw > 20 && arrows.map((a, i) => (
        <View key={i} style={{
          position: "absolute",
          left: a.cx - 10, top: a.cy - 10,
          width: 20, height: 20,
          alignItems: "center", justifyContent: "center",
          transform: [{ rotate: `${a.deg}deg` }],
          zIndex: 4, opacity: 0.60,
        }}>
          <View style={{ width: 0, height: 0,
            borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 10,
            borderTopColor: "transparent", borderBottomColor: "transparent",
            borderLeftColor: "#fde68a",
          }}/>
        </View>
      ))}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CENTER ZONE OVERLAY — glowing ring + label framing the 2×3 deploy grid
   Renders between the board art and all interactive overlays.
════════════════════════════════════════════════════════════════════════════ */
function CenterZoneOverlay({ imgBounds: b }: { imgBounds: ImgBounds }) {
  /* Zone bounds (fractional image coords, with padding around the 2×3 grid) */
  const ZONE_X1 = 0.22, ZONE_X2 = 0.78;
  const ZONE_Y1 = 0.17, ZONE_Y2 = 0.73;

  const [x1, y1] = imgPx(ZONE_X1, ZONE_Y1, b);
  const [x2, y2] = imgPx(ZONE_X2, ZONE_Y2, b);
  const zw = x2 - x1, zh = y2 - y1;

  /* Label position — centered at top edge of zone */
  const labelX = (x1 + x2) / 2;
  const labelY = y1 + 4;

  return (
    <>
      {/* Faint glowing zone rectangle */}
      <View style={{
        position: "absolute",
        left: x1, top: y1, width: zw, height: zh,
        borderRadius: 18,
        borderWidth: 1.5, borderColor: "#34d39940",
        backgroundColor: "#10b98108",
        zIndex: 3,
      }}/>

      {/* Inner inset ring — creates depth/framing */}
      <View style={{
        position: "absolute",
        left: x1 + 6, top: y1 + 6, width: zw - 12, height: zh - 12,
        borderRadius: 13,
        borderWidth: 1, borderColor: "#6ee7b720",
        zIndex: 3,
      }}/>

      {/* Corner accents — four lotus-petal dots */}
      {[[x1 + 10, y1 + 10], [x2 - 10, y1 + 10],
        [x1 + 10, y2 - 10], [x2 - 10, y2 - 10]].map(([cx, cy], i) => (
        <View key={i} style={{
          position: "absolute",
          left: cx - 4, top: cy - 4, width: 8, height: 8, borderRadius: 4,
          backgroundColor: "#34d39940", borderWidth: 1, borderColor: "#6ee7b760",
          zIndex: 3,
        }}/>
      ))}

      {/* "HEALING ZONE" label — floats at top-center of zone */}
      <View style={{
        position: "absolute",
        left: labelX - 42, top: labelY - 9,
        width: 84, height: 18, borderRadius: 9,
        backgroundColor: "#071a1280",
        borderWidth: 1, borderColor: "#34d39950",
        alignItems: "center", justifyContent: "center",
        zIndex: 4,
      }}>
        <Text style={{
          color: "#6ee7b7cc", fontSize: 6.5, fontWeight: "800",
          letterSpacing: 1.2, textAlign: "center",
        }}>
          ✦  HEALING ZONE  ✦
        </Text>
      </View>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DISEASE PORTAL — positioned at PATH_WPS[0] in image-aligned coordinates
════════════════════════════════════════════════════════════════════════════ */
function DiseasePortal({ imgBounds: b, aw }: { imgBounds: ImgBounds; aw: number }) {
  const [px, py] = imgPx(PATH_WPS[0][0], PATH_WPS[0][1], b);
  return (
    <View style={{
      position: "absolute",
      left: Math.min(px - 38, aw - 84), top: Math.max(2, py - 46),
      alignItems: "center", zIndex: 20,
    }}>
      <View style={{
        backgroundColor: "#3b0764e8", borderRadius: 6,
        paddingHorizontal: 7, paddingVertical: 2, marginBottom: 4,
        borderWidth: 1, borderColor: "#a855f7",
      }}>
        <Text style={{ color: "#e9d5ff", fontSize: 7, fontWeight: "800", letterSpacing: 0.8 }}>
          DISEASE GATE
        </Text>
      </View>
      <View style={{
        width: 54, height: 54, borderRadius: 27,
        backgroundColor: "#2e1065d0",
        borderWidth: 3, borderColor: "#a855f7",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        <LinearGradient
          colors={["#4c1d95", "#1e0535", "#0a0018"]}
          start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={{ position: "absolute", width: 42, height: 42, borderRadius: 21,
          borderWidth: 1.5, borderColor: "#7c3aed80" }}/>
        <View style={{ position: "absolute", width: 26, height: 26, borderRadius: 13,
          borderWidth: 1, borderColor: "#a855f760" }}/>
        <View style={{
          width: 14, height: 12, borderRadius: 7,
          backgroundColor: "#7c3aed40", borderWidth: 2, borderColor: "#c084fccc",
          alignItems: "center", justifyContent: "center",
        }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#a855f7ee" }}/>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 5, marginTop: 3 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{
            width: 2, height: 7, borderRadius: 1,
            backgroundColor: "#a855f760",
            transform: [{ rotate: `${(i - 1) * 15}deg` }],
          }}/>
        ))}
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   VITAL LANTERN — positioned at PATH_WPS[last] in image-aligned coordinates
════════════════════════════════════════════════════════════════════════════ */
function VitalLantern({ stability, imgBounds: b, ah }: { stability: number; imgBounds: ImgBounds; ah: number }) {
  const [px, py] = imgPx(PATH_WPS[PATH_WPS.length - 1][0], PATH_WPS[PATH_WPS.length - 1][1], b);
  const pct  = cl(stability, 0, 100);
  const glow = pct > 60 ? "#22d3ee" : pct > 30 ? "#facc15" : "#ef4444";

  return (
    <View style={{
      position: "absolute",
      left: Math.max(2, px - 40), top: Math.max(4, Math.min(ah - 130, py - 10)),
      alignItems: "center", zIndex: 20,
    }}>
      <View style={{
        backgroundColor: "#0c2a2ae8", borderRadius: 6,
        paddingHorizontal: 7, paddingVertical: 2, marginBottom: 3,
        borderWidth: 1, borderColor: glow + "80",
      }}>
        <Text style={{ color: "#a7f3d0", fontSize: 7, fontWeight: "800", letterSpacing: 0.5 }}>
          VITAL LANTERN
        </Text>
      </View>
      <View style={{
        width: 64, height: 5, backgroundColor: "#0d202070",
        borderRadius: 3, marginBottom: 4, overflow: "hidden",
        borderWidth: 1, borderColor: "#ffffff30",
      }}>
        <View style={{ width: `${pct}%` as any, height: "100%",
          backgroundColor: glow, borderRadius: 3 }}/>
      </View>
      <View style={{
        position: "absolute", top: 26, left: 0, width: 78, height: 78, borderRadius: 39,
        backgroundColor: glow + "0e", borderWidth: 1.5, borderColor: glow + "25",
      }}/>
      <View style={{
        width: 12, height: 26, backgroundColor: "#1a3a2a",
        borderRadius: 3, borderWidth: 1.5, borderColor: glow + "50",
        alignItems: "center", justifyContent: "center",
      }}>
        <View style={{ width: 2, height: 16, backgroundColor: glow + "60", borderRadius: 1 }}/>
      </View>
      {/* Shrine disc — circular, not square */}
      <LinearGradient
        colors={[glow + "55", "#0e2a1e", "#071612"]}
        start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={{
          width: 52, height: 52, borderRadius: 26,
          borderWidth: 2.5, borderColor: glow,
          alignItems: "center", justifyContent: "center",
          overflow: "hidden", marginTop: -3,
        }}
      >
        <View style={{ position: "absolute", width: 38, height: 38, borderRadius: 19,
          borderWidth: 1, borderColor: glow + "60" }}/>
        <Text style={{ fontSize: 14, color: glow }}>✦</Text>
      </LinearGradient>
      <View style={{
        width: 62, height: 9, borderRadius: 5,
        backgroundColor: "#0a1e14", borderWidth: 1, borderColor: glow + "55", marginTop: -2,
      }}/>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DEPLOY PAD — transparent pressable zone at image-aligned tile position
════════════════════════════════════════════════════════════════════════════ */
interface DPProps {
  tileIdx: number; unit: any;
  selectedUnit: string | null; canAfford: boolean;
  isMergeCandidate: boolean; onPress: () => void;
  imgBounds: ImgBounds;
  unitColors: Record<string, string>;
  bobY: Animated.AnimatedInterpolation<number>;
}

function DeployPad({ tileIdx, unit, selectedUnit, canAfford, isMergeCandidate, onPress, imgBounds: b, unitColors, bobY }: DPProps) {
  const [fx, fy]  = DEPLOY_TILES[tileIdx];
  const [px, py]  = imgPx(fx, fy, b);
  const isOccupied = !!unit;
  const padColor  = isOccupied
    ? (unitColors[unit.typeId] ?? "#60a5fa")
    : canAfford ? "#22d3ee" : "#64748b";
  const SZ = 58;

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        left: px - SZ / 2 - 4, top: py - SZ / 2 - 36,
        width: SZ + 8, height: SZ + 44,
        alignItems: "center", zIndex: 15,
      }}
    >
      {/* Unit image sprite standing above the tile */}
      {isOccupied && (
        <Animated.View style={{
          marginBottom: -4,
          transform: [{ translateY: bobY }],
          zIndex: 16,
        }}>
          {(unit.level ?? 1) > 1 && (
            <View style={{
              position: "absolute", top: -4, right: -4, zIndex: 17,
              backgroundColor: (unit.level ?? 1) >= 3 ? "#FFD700" : "#a78bfa",
              borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1,
            }}>
              <Text style={{ color: "#0a0a1a", fontSize: 5, fontWeight: "800" }}>
                Lv.{unit.level}
              </Text>
            </View>
          )}
          {(unit.castFlash ?? 0) > 0 && (
            <View style={{
              position: "absolute", top: -5, left: -5, right: -5, bottom: -5,
              borderRadius: 40, borderWidth: 2.5, borderColor: padColor + "aa", zIndex: 15,
            }}/>
          )}
          {isMergeCandidate && (
            <View style={{
              position: "absolute", top: -8, left: -8, right: -8, bottom: -8,
              borderRadius: 44, borderWidth: 2, borderColor: "#FFD70099",
              backgroundColor: "#FFD70015", zIndex: 15,
            }}/>
          )}
          {/* Deployed board sprite — hero battle sprite */}
          <ExpoImage
            source={IMG_UNITS[unit.typeId] ?? IMG_UNITS.ward_scout}
            style={{ width: 54, height: 66 }}
            contentFit="contain"
          />
          <View style={{
            width: 40, height: 6, borderRadius: 20,
            backgroundColor: "#000000aa", alignSelf: "center", marginTop: -4,
          }}/>
        </Animated.View>
      )}

      {/* ── Stone platform surface — solid gradient, not transparent glass ── */}
      <LinearGradient
        colors={isOccupied
          ? [padColor + "55", padColor + "28", "#0c1e18"]
          : canAfford ? ["#1e5040", "#0f2d22", "#071812"] : ["#1a2d25", "#101e18", "#0a1410"]}
        start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={{
          width: SZ, height: SZ, borderRadius: 10,
          borderWidth: isOccupied ? 2.5 : 1.5,
          borderColor: isOccupied
            ? padColor + "ee"
            : isMergeCandidate ? "#FFD700cc"
            : canAfford ? "#34d399aa" : "#2a4a3878",
          overflow: "hidden",
          alignItems: "center", justifyContent: "center",
        }}
      >
        {/* Engraved inner ring */}
        <View style={{
          position: "absolute",
          width: SZ - 14, height: SZ - 14, borderRadius: 7,
          borderWidth: 1,
          borderColor: isOccupied ? padColor + "66" : canAfford ? "#34d39950" : "#2a4a3840",
        }}/>

        {/* Corner rivets */}
        {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([cx,cy],i) => (
          <View key={i} style={{
            position: "absolute",
            left: cx < 0 ? 6 : undefined,
            right: cx > 0 ? 6 : undefined,
            top: cy < 0 ? 6 : undefined,
            bottom: cy > 0 ? 6 : undefined,
            width: 5, height: 5, borderRadius: 2.5,
            backgroundColor: isOccupied ? padColor + "aa" : canAfford ? "#34d39977" : "#2a4a3870",
          }}/>
        ))}

        {/* Empty pad: lotus rune circle + cross */}
        {!isOccupied && (
          <View style={{ alignItems: "center", justifyContent: "center" }}>
            <View style={{
              width: 24, height: 24, borderRadius: 12,
              borderWidth: 1.5, borderColor: canAfford ? "#34d39960" : "#2a4a3860",
              alignItems: "center", justifyContent: "center",
            }}>
              <View style={{
                width: 1.5, height: 16, borderRadius: 1,
                backgroundColor: canAfford ? "#34d39970" : "#2a4a3870",
                position: "absolute",
              }}/>
              <View style={{
                width: 16, height: 1.5, borderRadius: 1,
                backgroundColor: canAfford ? "#34d39970" : "#2a4a3870",
              }}/>
            </View>
          </View>
        )}

        {/* Occupied: role badge */}
        {isOccupied && (
          <View style={{
            position: "absolute", bottom: 5,
            backgroundColor: padColor + "44", borderRadius: 4,
            paddingHorizontal: 5, paddingVertical: 1,
            borderWidth: 1, borderColor: padColor + "88",
          }}>
            <Text style={{ color: "#eee", fontSize: 6, fontWeight: "800", letterSpacing: 0.3 }}>
              {unit.typeId === "ward_scout" ? "ASSESS"
                : unit.typeId === "mist_caster" ? "TREAT" : "SUPPORT"}
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* ── Stepped stone base pedestal ── */}
      <LinearGradient
        colors={["#050d0a", "#0a1410"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{
          width: SZ + 8, height: 9, borderRadius: 5,
          marginTop: -3, alignSelf: "center",
          borderWidth: 1, borderColor: isOccupied ? padColor + "55" : "#1a3028",
        }}
      />
    </Pressable>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ENEMY ON PATH — illustrated sprite at image-aligned path position
════════════════════════════════════════════════════════════════════════════ */
function EnemyOnPath({
  enemy, bobY, imgBounds: b,
}: { enemy: any; bobY: Animated.AnimatedInterpolation<number>; imgBounds: ImgBounds }) {
  const [fx, fy] = getEnemyFrac(enemy);
  const [px, py] = imgPx(fx, fy, b);

  const hpPct    = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
  const barColor = hpPct > 0.6 ? "#22c55e" : hpPct > 0.3 ? "#facc15" : "#ef4444";
  const isFlash  = (enemy.hitFlash ?? 0) > 0;
  const isBoss   = enemy.typeId === "bronchospasm_drake";
  const sprW     = isBoss ? 68 : 50;
  const sprH     = isBoss ? 68 : 50;
  const barW     = isBoss ? 60 : 44;
  const accentC  = ENEMY_COLOR[enemy.typeId] ?? "#94a3b8";
  const img      = IMG_ENEMIES[enemy.typeId];

  return (
    <Animated.View style={{
      position: "absolute",
      left: px - sprW / 2,
      top: py - sprH - 28,
      alignItems: "center",
      zIndex: 14,
      transform: [{ translateY: bobY }],
    }}>
      {/* HP bar */}
      <View style={{
        width: barW, height: 5, backgroundColor: "#00000090",
        borderRadius: 3, marginBottom: 2, overflow: "hidden",
        borderWidth: 0.5, borderColor: "#ffffff25",
      }}>
        <View style={{ width: `${hpPct * 100}%` as any, height: "100%",
          backgroundColor: barColor, borderRadius: 3 }}/>
      </View>

      {/* Clinical cue badge */}
      <View style={{
        backgroundColor: accentC + "28", borderRadius: 4,
        paddingHorizontal: 4, paddingVertical: 1, marginBottom: 3,
        borderWidth: 0.5, borderColor: accentC + "80",
        maxWidth: barW + 20,
      }}>
        <Text
          style={{ color: accentC, fontSize: 6.5, fontWeight: "700", textAlign: "center" }}
          numberOfLines={1}
        >
          {enemy.clue ?? enemy.name ?? "?"}
        </Text>
      </View>

      {isBoss && (
        <Text style={{ color: accentC, fontSize: 8, fontWeight: "700", marginBottom: 1 }}>
          {enemy.hp}
        </Text>
      )}

      {/* Hit-flash overlay */}
      {isFlash && (
        <View style={{
          position: "absolute", top: 22, left: 0, right: 0, bottom: 6,
          backgroundColor: "#ffffff35", borderRadius: 10, zIndex: 15,
        }}/>
      )}

      {(enemy.slowTicks ?? 0) > 0 && (
        <View style={{
          position: "absolute", top: 18, right: -10,
          backgroundColor: "#A78BFA22", borderRadius: 4, paddingHorizontal: 3,
        }}>
          <Text style={{ color: "#A78BFA", fontSize: 6 }}>↓</Text>
        </View>
      )}

      {/* Illustrated enemy sprite */}
      {img ? (
        <ExpoImage source={img} style={{ width: sprW, height: sprH }} contentFit="contain" />
      ) : (
        <View style={{
          width: sprW, height: sprH, borderRadius: sprW / 2,
          backgroundColor: accentC + "33", borderWidth: 2, borderColor: accentC,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: isBoss ? 24 : 18 }}>
            {enemy.typeId === "bronchospasm_drake" ? "🐉"
              : enemy.typeId === "hypoxia_wraith" ? "👻"
              : enemy.typeId === "mucus_slime" ? "🫧"
              : "💨"}
          </Text>
        </View>
      )}

      {/* Ground shadow */}
      <View style={{
        width: isBoss ? 50 : 36, height: 5, borderRadius: 25,
        backgroundColor: "#000000a0", marginTop: -3,
      }}/>
    </Animated.View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PROJECTILE — image-aligned glowing orb in flight
════════════════════════════════════════════════════════════════════════════ */
function ProjectileDot({ p, imgBounds: b }: { p: any; imgBounds: ImgBounds }) {
  const fx  = lp(p.fromFx, p.toFx, p.progress);
  const fy  = lp(p.fromFy, p.toFy, p.progress);
  const [px, py] = imgPx(fx, fy, b);
  const col = p.color ?? "#22d3ee";
  return (
    <View style={{
      position: "absolute",
      left: px - 8, top: py - 8,
      width: 16, height: 16, borderRadius: 8,
      backgroundColor: col + "55", borderWidth: 2.5, borderColor: col,
      alignItems: "center", justifyContent: "center", zIndex: 13,
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#ffffff" }}/>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   WAVE PAUSE OVERLAY
════════════════════════════════════════════════════════════════════════════ */
function WavePauseOverlay({ wave }: { wave: number }) {
  return (
    <View style={[StyleSheet.absoluteFillObject, {
      alignItems: "center", justifyContent: "center",
      backgroundColor: "#00000070", zIndex: 30,
    }]}>
      <View style={{
        backgroundColor: "#0a1810f5", borderRadius: 18,
        padding: 26, alignItems: "center",
        borderWidth: 2, borderColor: "#22d3ee55", minWidth: 200,
      }}>
        <Text style={{
          color: "#22d3ee", fontSize: 13, fontWeight: "700",
          letterSpacing: 1.5, marginBottom: 6,
        }}>
          ✦  WAVE {wave + 2} INCOMING  ✦
        </Text>
        <Text style={{ color: "#a7f3d0", fontSize: 10.5 }}>
          Deploy your healers before the wave…
        </Text>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN BOARD EXPORT — used by ward-defense.tsx
   All overlay positions computed from image rendering bounds (imgBounds) so
   they stay aligned with the art at every board size / letterbox amount.
════════════════════════════════════════════════════════════════════════════ */
export function WardBoardV2({
  aw, ah, onLayout,
  enemies, deployedUnits, projectiles,
  stability, phase, wave,
  selectedUnit, bobY,
  spawnQueueLen, mergeTileSet, onTilePress, canAfford, unitColors,
}: WardBoardV2Props) {
  /* Image rendering bounds — recomputed whenever board size changes */
  const imgBounds = getImgBounds(aw > 20 ? aw : 360, ah > 20 ? ah : 500);

  return (
    <View
      style={{ flex: 1, position: "relative", overflow: "hidden", backgroundColor: "#040c14" }}
      onLayout={onLayout}
    >
      {/* 1. Illustrated board scene (contain — full image always visible) */}
      <BoardScene aw={aw} ah={ah} imgBounds={imgBounds} />

      {/* 3. Disease Portal overlay */}
      {aw > 20 && <DiseasePortal imgBounds={imgBounds} aw={aw} />}

      {/* 3. Vital Lantern overlay */}
      {aw > 20 && <VitalLantern stability={stability} imgBounds={imgBounds} ah={ah} />}

      {/* 4. Deploy pads — image-aligned touch zones */}
      {aw > 20 && DEPLOY_TILES.map((_, i) => (
        <DeployPad
          key={i} tileIdx={i}
          unit={deployedUnits.find((u: any) => u.tileIndex === i)}
          selectedUnit={selectedUnit}
          canAfford={canAfford}
          isMergeCandidate={mergeTileSet.has(i)}
          onPress={() => onTilePress(i)}
          imgBounds={imgBounds}
          unitColors={unitColors}
          bobY={bobY}
        />
      ))}

      {/* 5. Projectiles — image-aligned */}
      {projectiles.map((p: any) => (
        <ProjectileDot key={p.uid} p={p} imgBounds={imgBounds} />
      ))}

      {/* 6. Enemy sprites — image-aligned, move along path */}
      {enemies.map((e: any) => (
        <EnemyOnPath key={e.uid} enemy={e} bobY={bobY} imgBounds={imgBounds} />
      ))}

      {/* 7. Spawn queue warning */}
      {spawnQueueLen > 0 && (
        <View style={{
          position: "absolute", top: 6, left: 6,
          backgroundColor: "#7c3aede0", borderRadius: 8,
          paddingHorizontal: 9, paddingVertical: 3,
          borderWidth: 1, borderColor: "#c084fc", zIndex: 25,
        }}>
          <Text style={{ color: "#f3e8ff", fontSize: 8, fontWeight: "700" }}>
            ⚡ {spawnQueueLen} approaching
          </Text>
        </View>
      )}

      {/* 8. Wave pause overlay */}
      {phase === "wave_pause" && <WavePauseOverlay wave={wave} />}
    </View>
  );
}

export default WardBoardV2;
