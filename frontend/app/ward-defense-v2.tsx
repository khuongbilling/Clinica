/**
 * Ward Defense V2 — Lotus Healing Sanctum
 *
 * RENDERING APPROACH — IMAGE-FIRST:
 *   The background PNG contains the path, gate, and lantern architecture baked in.
 *   CSS overlays are polish only: subtle glow dots, deployment pads, HP bars.
 *   No CSS "road strips" — the art carries the path narrative.
 */
import React from "react";
import {
  View, Text, Animated, Pressable,
  StyleSheet, LayoutChangeEvent,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

/* ── Path + tile constants — must mirror ward-defense.tsx ─────────────────── */
const PATH_WPS: [number, number][] = [
  [0.14, 0.10],   /* Disease Gate (top-left) */
  [0.14, 0.82],   /* bottom-left corner */
  [0.86, 0.82],   /* bottom-right corner */
  [0.86, 0.10],   /* Vital Lantern (top-right) */
];

const DEPLOY_TILES: [number, number][] = [
  [0.33, 0.38], [0.50, 0.38], [0.67, 0.38],  /* top row */
  [0.33, 0.58], [0.50, 0.58], [0.67, 0.58],  /* bottom row */
];

/* ── Illustrated image assets ─────────────────────────────────────────────── */
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

/* ── Image-bounds alignment — contain mode ────────────────────────────────── */
const IMG_AR_W = 3, IMG_AR_H = 4;

type ImgBounds = { iw: number; ih: number; ox: number; oy: number };

function getImgBounds(aw: number, ah: number): ImgBounds {
  const scale = Math.min(aw / IMG_AR_W, ah / IMG_AR_H);
  const iw = IMG_AR_W * scale;
  const ih = IMG_AR_H * scale;
  return { iw, ih, ox: (aw - iw) / 2, oy: (ah - ih) / 2 };
}

function imgPx(fx: number, fy: number, b: ImgBounds): [number, number] {
  return [b.ox + fx * b.iw, b.oy + fy * b.ih];
}

/* ════════════════════════════════════════════════════════════════════════════
   BOARD SCENE — art-first, CSS is polish only
════════════════════════════════════════════════════════════════════════════ */
function BoardScene({ aw, ah, imgBounds: b }: { aw: number; ah: number; imgBounds: ImgBounds }) {
  /* Subtle directional diamonds along path midpoints */
  const dots: { x: number; y: number; deg: number }[] = [];
  for (let seg = 0; seg < PATH_WPS.length - 1; seg++) {
    const [ax, ay] = PATH_WPS[seg];
    const [bx, by] = PATH_WPS[seg + 1];
    /* Place 2 dots along each segment at 33% and 66% */
    for (const t of [0.33, 0.66]) {
      const [px, py] = imgPx(ax + (bx - ax) * t, ay + (by - ay) * t, b);
      const deg = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
      dots.push({ x: px, y: py, deg });
    }
  }

  return (
    <>
      {/* Dark fill behind letterboxed image */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#050a12" }]} />

      {/* Vignette — top and bottom atmospheric fade */}
      <LinearGradient
        colors={["#00000070", "#00000000", "#00000000", "#00000070"]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
      />

      {/* Illustrated board — contains full lotus sanctuary scene */}
      <ExpoImage
        source={IMG_BOARD}
        style={StyleSheet.absoluteFillObject}
        contentFit="contain"
        contentPosition="center"
      />

      {/* Subtle path diamonds — gentle direction hints, not road strips */}
      {aw > 20 && dots.map((d, i) => (
        <View key={i} style={{
          position: "absolute",
          left: d.x - 5, top: d.y - 5,
          width: 10, height: 10,
          transform: [{ rotate: `${d.deg + 45}deg` }],
          zIndex: 3, opacity: 0.35,
        }}>
          <View style={{
            width: 7, height: 7, margin: 1.5,
            backgroundColor: "#fde68a",
            borderWidth: 0.5, borderColor: "#f59e0b",
          }}/>
        </View>
      ))}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   HEALING ZONE FRAME — subtle border + label around the 2×3 grid
════════════════════════════════════════════════════════════════════════════ */
function HealingZoneFrame({ imgBounds: b }: { imgBounds: ImgBounds }) {
  const PAD = 0.06;
  const [x1, y1] = imgPx(0.33 - PAD, 0.32 - PAD, b);
  const [x2, y2] = imgPx(0.67 + PAD, 0.58 + PAD, b);
  const zw = x2 - x1, zh = y2 - y1;
  const labelX = (x1 + x2) / 2;

  return (
    <>
      {/* Outer glow ring */}
      <View style={{
        position: "absolute",
        left: x1 - 4, top: y1 - 4,
        width: zw + 8, height: zh + 8,
        borderRadius: 20,
        borderWidth: 1, borderColor: "#22d3ee18",
        backgroundColor: "#10b98105",
        zIndex: 3,
      }}/>

      {/* Corner lotus petal accents */}
      {[[x1, y1], [x2, y1], [x1, y2], [x2, y2]].map(([cx, cy], i) => (
        <View key={i} style={{
          position: "absolute",
          left: cx - 5, top: cy - 5,
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: "#34d39928",
          borderWidth: 1, borderColor: "#34d39960",
          zIndex: 4,
        }}/>
      ))}

      {/* HEALING ZONE label */}
      <View style={{
        position: "absolute",
        left: labelX - 44, top: y1 - 12,
        height: 15, width: 88, borderRadius: 7,
        backgroundColor: "#071a1290",
        borderWidth: 1, borderColor: "#22d3ee35",
        alignItems: "center", justifyContent: "center",
        zIndex: 5,
      }}>
        <Text style={{ color: "#6ee7b7bb", fontSize: 6, fontWeight: "800", letterSpacing: 1.5 }}>
          ✦  HEALING ZONE  ✦
        </Text>
      </View>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DISEASE PORTAL — label badge + pulsing ring over gate position
════════════════════════════════════════════════════════════════════════════ */
function DiseasePortal({
  imgBounds: b, aw, spawnQueueLen,
}: { imgBounds: ImgBounds; aw: number; spawnQueueLen: number }) {
  const [px, py] = imgPx(PATH_WPS[0][0], PATH_WPS[0][1], b);

  return (
    <View style={{
      position: "absolute",
      left: cl(px - 36, 4, aw - 84), top: cl(py - 44, 4, 200),
      alignItems: "center", zIndex: 20,
    }}>
      {/* Spawn warning badge */}
      {spawnQueueLen > 0 && (
        <View style={{
          backgroundColor: "#4c1d95ee",
          borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
          borderWidth: 1.5, borderColor: "#a855f7",
          marginBottom: 4,
        }}>
          <Text style={{ color: "#e9d5ff", fontSize: 8, fontWeight: "800" }}>
            ⚡ {spawnQueueLen} incoming
          </Text>
        </View>
      )}

      {/* Label tag */}
      <View style={{
        backgroundColor: "#1e0535cc",
        borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
        borderWidth: 1, borderColor: "#7c3aed",
      }}>
        <Text style={{ color: "#c4b5fd", fontSize: 7, fontWeight: "800", letterSpacing: 0.8 }}>
          DISEASE GATE
        </Text>
      </View>

      {/* Pulsing threat ring */}
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        borderWidth: 2, borderColor: "#a855f760",
        backgroundColor: "#3b076418",
        alignItems: "center", justifyContent: "center",
        marginTop: 4,
      }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#7c3aed" }}/>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   VITAL LANTERN — stability display at the shrine position
════════════════════════════════════════════════════════════════════════════ */
function VitalLantern({
  stability, imgBounds: b, ah,
}: { stability: number; imgBounds: ImgBounds; ah: number }) {
  const [px, py] = imgPx(PATH_WPS[PATH_WPS.length - 1][0], PATH_WPS[PATH_WPS.length - 1][1], b);
  const pct   = cl(stability, 0, 100);
  const glow  = pct > 60 ? "#22d3ee" : pct > 30 ? "#facc15" : "#ef4444";
  const top   = cl(py - 44, 4, ah - 110);
  const left  = cl(px - 36, 4, 9999);

  return (
    <View style={{
      position: "absolute",
      left, top, alignItems: "flex-end", zIndex: 20,
    }}>
      {/* Label */}
      <View style={{
        backgroundColor: "#061e1ecc",
        borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
        borderWidth: 1, borderColor: glow + "90",
        marginBottom: 3,
      }}>
        <Text style={{ color: "#a7f3d0", fontSize: 7, fontWeight: "800", letterSpacing: 0.5 }}>
          VITAL LANTERN
        </Text>
      </View>

      {/* Stability bar */}
      <View style={{
        width: 72, height: 8, backgroundColor: "#0a1c1c88",
        borderRadius: 4, overflow: "hidden",
        borderWidth: 1, borderColor: glow + "55",
        marginBottom: 3,
      }}>
        <View style={{
          width: `${pct}%` as any, height: "100%",
          backgroundColor: glow, borderRadius: 4,
        }}/>
      </View>

      {/* Glow orb */}
      <View style={{
        width: 30, height: 30, borderRadius: 15,
        borderWidth: 2, borderColor: glow,
        backgroundColor: glow + "25",
        alignSelf: "flex-end",
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ fontSize: 11, color: glow }}>✦</Text>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DEPLOY PAD — circular stone platform at image-aligned tile position
════════════════════════════════════════════════════════════════════════════ */
interface DPProps {
  tileIdx: number; unit: any;
  selectedUnit: string | null; canAfford: boolean;
  isMergeCandidate: boolean; onPress: () => void;
  imgBounds: ImgBounds;
  unitColors: Record<string, string>;
  bobY: Animated.AnimatedInterpolation<number>;
}

function DeployPad({
  tileIdx, unit, selectedUnit, canAfford, isMergeCandidate,
  onPress, imgBounds: b, unitColors, bobY,
}: DPProps) {
  const [fx, fy]   = DEPLOY_TILES[tileIdx];
  const [px, py]   = imgPx(fx, fy, b);
  const isOccupied = !!unit;

  const padColor = isOccupied
    ? (unitColors[unit.typeId] ?? "#60a5fa")
    : isMergeCandidate ? "#FFD700"
    : canAfford ? "#34d399" : "#334155";

  const PLATFORM_D = 64;  /* diameter of stone platform disc */
  const SPRITE_W   = 60;
  const SPRITE_H   = 74;
  const HIT_W      = PLATFORM_D + 16;
  const HIT_H      = SPRITE_H + PLATFORM_D + 8;

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        left: px - HIT_W / 2,
        top:  py - SPRITE_H - PLATFORM_D / 2 - 4,
        width: HIT_W, height: HIT_H,
        alignItems: "center",
        zIndex: 15,
      }}
    >
      {/* ── Hero sprite — floats above the platform ── */}
      {isOccupied && (
        <Animated.View style={{
          transform: [{ translateY: bobY }],
          alignItems: "center",
          marginBottom: -8,
          zIndex: 17,
        }}>
          {/* Level badge */}
          {(unit.level ?? 1) > 1 && (
            <View style={{
              position: "absolute", top: -4, right: -6, zIndex: 18,
              backgroundColor: (unit.level ?? 1) >= 3 ? "#FFD700" : "#a78bfa",
              borderRadius: 5, paddingHorizontal: 4, paddingVertical: 1,
            }}>
              <Text style={{ color: "#0a0a1a", fontSize: 5.5, fontWeight: "900" }}>
                Lv.{unit.level}
              </Text>
            </View>
          )}

          {/* Cast flash ring */}
          {(unit.castFlash ?? 0) > 0 && (
            <View style={{
              position: "absolute", top: -6, left: -6, right: -6, bottom: -6,
              borderRadius: 48, borderWidth: 3, borderColor: padColor + "cc", zIndex: 16,
            }}/>
          )}

          {/* Merge candidate golden halo */}
          {isMergeCandidate && (
            <View style={{
              position: "absolute", top: -10, left: -10, right: -10, bottom: -10,
              borderRadius: 52, borderWidth: 2.5, borderColor: "#FFD700aa",
              backgroundColor: "#FFD70012", zIndex: 16,
            }}/>
          )}

          {/* Hero battle sprite — same asset as bottom card */}
          <ExpoImage
            source={IMG_UNITS[unit.typeId] ?? IMG_UNITS.ward_scout}
            style={{ width: SPRITE_W, height: SPRITE_H }}
            contentFit="contain"
          />

          {/* Ground shadow */}
          <View style={{
            width: 44, height: 6, borderRadius: 22,
            backgroundColor: "#00000088", marginTop: -6, alignSelf: "center",
          }}/>
        </Animated.View>
      )}

      {/* ── Circular stone platform disc ── */}
      <LinearGradient
        colors={isOccupied
          ? [padColor + "60", padColor + "30", "#0c1e1a"]
          : isMergeCandidate ? ["#FFD70040", "#8b5c0020", "#0a150f"]
          : canAfford  ? ["#22d3ee28", "#0d3a2888", "#071610"]
          :              ["#1a2d2588", "#0f1e1880", "#090d0c"]}
        start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
        style={{
          width: PLATFORM_D, height: PLATFORM_D, borderRadius: PLATFORM_D / 2,
          borderWidth: isOccupied ? 2.5 : canAfford ? 1.5 : 1,
          borderColor: isOccupied
            ? padColor + "dd"
            : isMergeCandidate ? "#FFD700bb"
            : canAfford ? "#22d3ee90" : "#2a4035aa",
          alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Inner ring — engraved lotus */}
        <View style={{
          width: PLATFORM_D - 18, height: PLATFORM_D - 18,
          borderRadius: (PLATFORM_D - 18) / 2,
          borderWidth: 1,
          borderColor: isOccupied ? padColor + "50"
            : canAfford ? "#22d3ee40" : "#2a403560",
        }}/>

        {/* Empty: lotus cross symbol */}
        {!isOccupied && (
          <>
            <View style={{
              position: "absolute",
              width: 1.5, height: PLATFORM_D - 28,
              backgroundColor: canAfford ? "#22d3ee55" : "#2a403555",
              borderRadius: 1,
            }}/>
            <View style={{
              position: "absolute",
              width: PLATFORM_D - 28, height: 1.5,
              backgroundColor: canAfford ? "#22d3ee55" : "#2a403555",
              borderRadius: 1,
            }}/>
          </>
        )}
      </LinearGradient>

      {/* ── Stepped stone pedestal under the disc ── */}
      <LinearGradient
        colors={["#0c1a14", "#071210"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{
          width: PLATFORM_D + 8, height: 8, borderRadius: 4,
          marginTop: -3, alignSelf: "center",
          borderWidth: 1,
          borderColor: isOccupied ? padColor + "40" : "#1a3028",
        }}
      />
    </Pressable>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ENEMY ON PATH — illustrated sprite with HP bar
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
  const sprW     = isBoss ? 72 : 52;
  const sprH     = isBoss ? 72 : 52;
  const barW     = isBoss ? 64 : 46;
  const accentC  = ENEMY_COLOR[enemy.typeId] ?? "#94a3b8";
  const img      = IMG_ENEMIES[enemy.typeId];

  return (
    <Animated.View style={{
      position: "absolute",
      left: px - sprW / 2,
      top:  py - sprH - 30,
      alignItems: "center",
      zIndex: 14,
      transform: [{ translateY: bobY }],
    }}>
      {/* HP bar */}
      <View style={{
        width: barW, height: 5, backgroundColor: "#00000090",
        borderRadius: 3, marginBottom: 2, overflow: "hidden",
        borderWidth: 0.5, borderColor: "#ffffff20",
      }}>
        <View style={{
          width: `${hpPct * 100}%` as any, height: "100%",
          backgroundColor: barColor, borderRadius: 3,
        }}/>
      </View>

      {/* Clinical cue badge */}
      <View style={{
        backgroundColor: accentC + "25", borderRadius: 4,
        paddingHorizontal: 4, paddingVertical: 1, marginBottom: 3,
        borderWidth: 0.5, borderColor: accentC + "77",
        maxWidth: barW + 16,
      }}>
        <Text
          style={{ color: accentC, fontSize: 6, fontWeight: "700", textAlign: "center" }}
          numberOfLines={1}
        >
          {enemy.clue ?? enemy.name ?? "?"}
        </Text>
      </View>

      {/* Boss HP number */}
      {isBoss && (
        <Text style={{ color: accentC, fontSize: 8, fontWeight: "700", marginBottom: 1 }}>
          {enemy.hp}
        </Text>
      )}

      {/* Hit-flash overlay */}
      {isFlash && (
        <View style={{
          position: "absolute", top: 20, left: 0, right: 0, bottom: 5,
          backgroundColor: "#ffffff30", borderRadius: 10, zIndex: 15,
        }}/>
      )}

      {/* Slow indicator */}
      {(enemy.slowTicks ?? 0) > 0 && (
        <View style={{
          position: "absolute", top: 16, right: -10,
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
        width: isBoss ? 52 : 38, height: 5, borderRadius: 25,
        backgroundColor: "#000000a0", marginTop: -3,
      }}/>
    </Animated.View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PROJECTILE
════════════════════════════════════════════════════════════════════════════ */
function ProjectileDot({ p, imgBounds: b }: { p: any; imgBounds: ImgBounds }) {
  const fx  = lp(p.fromFx, p.toFx, p.progress);
  const fy  = lp(p.fromFy, p.toFy, p.progress);
  const [px, py] = imgPx(fx, fy, b);
  const col = p.color ?? "#22d3ee";
  return (
    <View style={{
      position: "absolute",
      left: px - 7, top: py - 7,
      width: 14, height: 14, borderRadius: 7,
      backgroundColor: col + "50", borderWidth: 2, borderColor: col,
      alignItems: "center", justifyContent: "center", zIndex: 13,
    }}>
      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#fff" }}/>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN BOARD EXPORT
════════════════════════════════════════════════════════════════════════════ */
export function WardBoardV2({
  aw, ah, onLayout,
  enemies, deployedUnits, projectiles,
  stability, phase, wave,
  selectedUnit, bobY,
  spawnQueueLen, mergeTileSet, onTilePress, canAfford, unitColors,
}: WardBoardV2Props) {
  const imgBounds = getImgBounds(aw > 20 ? aw : 360, ah > 20 ? ah : 500);

  return (
    <View
      style={{ flex: 1, position: "relative", overflow: "hidden", backgroundColor: "#050a12" }}
      onLayout={onLayout}
    >
      {/* 1. Illustrated board scene */}
      <BoardScene aw={aw} ah={ah} imgBounds={imgBounds} />

      {/* 2. Healing zone frame around deployment grid */}
      {aw > 20 && <HealingZoneFrame imgBounds={imgBounds} />}

      {/* 3. Disease portal label */}
      {aw > 20 && (
        <DiseasePortal imgBounds={imgBounds} aw={aw} spawnQueueLen={spawnQueueLen} />
      )}

      {/* 4. Vital lantern stability display */}
      {aw > 20 && <VitalLantern stability={stability} imgBounds={imgBounds} ah={ah} />}

      {/* 5. Deploy pads */}
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

      {/* 6. Projectiles */}
      {projectiles.map((p: any) => (
        <ProjectileDot key={p.uid} p={p} imgBounds={imgBounds} />
      ))}

      {/* 7. Enemy sprites */}
      {enemies.map((e: any) => (
        <EnemyOnPath key={e.uid} enemy={e} bobY={bobY} imgBounds={imgBounds} />
      ))}

      {/* 8. Wave-pause atmospheric overlay — dim board, ClinicalPanel shown above in parent */}
      {phase === "wave_pause" && (
        <View style={[StyleSheet.absoluteFillObject, {
          backgroundColor: "#00000040", zIndex: 25,
        }]}/>
      )}
    </View>
  );
}

export default WardBoardV2;
