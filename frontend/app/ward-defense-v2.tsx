/**
 * Ward Defense V2 — Lotus Healing Sanctum
 *
 * INTERACTIVE MAP — the illustrated reference asset IS the battlefield.
 * Background: assets/ward-defense/lotus-healing-ward-map.png (the drawn
 * Disease Gate, Vital Lantern, stone walkway, and six blue cross-platforms
 * all live in this image). Gameplay elements are transparent overlays whose
 * coordinates (PATH_WPS, DEPLOY_TILES) are mapped onto image features.
 *
 * Layer order (zIndex):
 *   0  <ExpoImage IMG_MAP>  — illustrated battle map (contentFit="cover",
 *                            board locked to the image's native 3:2 aspect ratio)
 *   6  StonePad × 6         — fully invisible tap targets (gold star on merge only)
 *  22  GateBadge            — spawn-queue count over the drawn gate
 *  10  HeroOnPad            — deployed hero sprites (centered on platforms)
 *  13  ProjectileDot
 *  14  EnemyOnPath          — enemies walking the (invisible) mapped lane
 */
import React from "react";
import {
  View, Text, Animated, Pressable, StyleSheet, LayoutChangeEvent,
} from "react-native";
import { Image as ExpoImage } from "expo-image";

/* Enemy route — traces the illustrated stone walkway in the reference map:
   Disease Gate (upper-left) → down the left lane → around the bottom →
   up the right lane → Vital Lantern (upper-right).
   Fractions map directly onto the background image (contentFit="cover",
   aspect-locked 3:2 container so the art is never distorted).
   MUST stay identical to ward-defense.tsx.                              */
export const PATH_WPS: [number, number][] = [
  [0.15, 0.22],  /*  0  Disease Gate spawn        */
  [0.19, 0.30],  /*  1  enter left lane           */
  [0.22, 0.42],  /*  2  left lane upper           */
  [0.24, 0.56],  /*  3  left lane lower           */
  [0.28, 0.68],  /*  4  bottom-left curve         */
  [0.37, 0.78],  /*  5  bottom lane left          */
  [0.50, 0.82],  /*  6  bottom lane center        */
  [0.63, 0.78],  /*  7  bottom lane right         */
  [0.72, 0.68],  /*  8  bottom-right curve        */
  [0.77, 0.56],  /*  9  right lane lower          */
  [0.79, 0.42],  /* 10  right lane upper          */
  [0.82, 0.30],  /* 11  right lane top            */
  [0.86, 0.22],  /* 12  Vital Lantern exit        */
];

/* Six deploy pads — aligned onto the six blue cross-platforms drawn in
   the reference map (2 rows × 3 cols).
   MUST stay identical to ward-defense.tsx.                              */
export const DEPLOY_TILES: [number, number][] = [
  [0.360, 0.460], [0.510, 0.460], [0.655, 0.460],
  [0.360, 0.655], [0.510, 0.655], [0.655, 0.655],
];

/* ─── Assets ────────────────────────────────────────────────────────────── */
const IMG_MAP = require("../assets/ward-defense/lotus-healing-ward-map.png");
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
  bobY: Animated.AnimatedInterpolation<number>;
  spawnQueueLen: number; mergeTileSet: Set<number>;
  onTilePress: (i: number) => void;
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
   LAYER 2 — OCTAGONAL STONE DEPLOY PLATFORMS
   Match reference: octagon stone frame → dark stone ring → teal-blue disc
   → bright white medical cross (large, glowing). Platform IS the tap target.
   ═══════════════════════════════════════════════════════════════════════════ */
interface StonePadProps {
  aw: number; ah: number; tileIdx: number;
  isMergeCandidate: boolean; onPress: () => void;
}

function StonePad({ aw, ah, tileIdx, isMergeCandidate, onPress }: StonePadProps) {
  const [fx, fy] = DEPLOY_TILES[tileIdx];
  const cx = fx * aw;
  const cy = fy * ah;
  /* Hit area sized to roughly one drawn platform cell */
  const HIT = cl(Math.min(aw, ah) * 0.15, 56, 96);
  const R   = HIT / 2;

  const isMerge  = isMergeCandidate;
  const ringSize = HIT * 0.92;

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        left: cx - R, top: cy - R,
        width: HIT, height: HIT,
        alignItems: "center", justifyContent: "center",
        zIndex: 6,
      }}
    >
      {/* Fully transparent tap target — the drawn platform art lives in the
          background image. The only overlay is a gold star marking a merge. */}
      {isMerge && (
        <View style={{
          width: ringSize, height: ringSize,
          borderRadius: ringSize / 2,
          borderWidth: 2, borderColor: "#FFD700CC",
          backgroundColor: "transparent",
          alignItems: "center", justifyContent: "center",
          ...({ boxShadow: "0 0 14px #FFD70080" } as any),
        }}>
          <Text style={{
            color: "#FFD700", fontSize: ringSize * 0.30, fontWeight: "800",
            ...({ textShadow: "0 0 12px #FFD70099" } as any),
          }}>★</Text>
        </View>
      )}
    </Pressable>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 4 — GATE SPAWN BADGE (overlaid on the drawn Disease Gate)
   The gate + lantern art live in the background image; we only overlay the
   live spawn-queue count.
   ═══════════════════════════════════════════════════════════════════════════ */
function GateBadge({ aw, ah, spawnQueueLen }: { aw: number; ah: number; spawnQueueLen: number }) {
  const cx = PATH_WPS[0][0] * aw;
  const cy = PATH_WPS[0][1] * ah;
  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 22, pointerEvents: "none" }]}>
      <View style={{
        position: "absolute",
        left: cx - 14, top: cy - 12,
        backgroundColor: "#2A0060E6", borderRadius: 10,
        paddingHorizontal: 7, paddingVertical: 2,
        borderWidth: 1, borderColor: "#C084FC",
        ...({ boxShadow: "0 0 12px #7C3AEDAA" } as any),
      }}>
        <Text style={{ color: "#EDE9FE", fontSize: 9, fontWeight: "900" }}>⚡{spawnQueueLen}</Text>
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
  bobY,
  spawnQueueLen, mergeTileSet, onTilePress, unitColors,
}: WardBoardV2Props) {
  const W = aw > 20 ? aw : 360;
  const H = ah > 20 ? ah : 480;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#07121A", overflow: "hidden" }}>
    <View
      style={{
        width: "100%",
        aspectRatio: 1536 / 1024,
        maxHeight: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#07121A",
      }}
      onLayout={onLayout}
    >
      {/* L0: Illustrated lotus sanctuary battle map (reference asset).
          Container is locked to the image's native 3:2 aspect ratio so the
          art is never stretched; overlay coordinates map onto this box. */}
      <ExpoImage
        source={IMG_MAP}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        cachePolicy="memory-disk"
      />

      {/* L2: Six invisible tap targets aligned onto the drawn platforms */}
      {W > 20 && DEPLOY_TILES.map((_, i) => (
        <StonePad
          key={i} aw={W} ah={H} tileIdx={i}
          isMergeCandidate={mergeTileSet.has(i)}
          onPress={() => onTilePress(i)}
        />
      ))}

      {/* L4: Spawn-queue badge over the drawn Disease Gate */}
      {W > 20 && spawnQueueLen > 0 && <GateBadge aw={W} ah={H} spawnQueueLen={spawnQueueLen} />}

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
    </View>
  );
}
