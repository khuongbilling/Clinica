/**
 * Ward Defense V2 — Lotus Healing Sanctum
 *
 * INTERACTIVE MAP — the illustrated reference asset IS the battlefield.
 * Background: assets/ward-defense/lotus-healing-ward-map-portrait.png (portrait
 * 878×1408 — Disease Gate top-left, Vital Lantern top-right, nine cross
 * pedestals in a 3×3 grid, oval stone walkway loop).  The board is sized
 * to the image ratio exactly; overlay coordinates are fractions of that size.
 *
 * Layer order (zIndex):
 *   0  <ExpoImage IMG_MAP>  — portrait battle map (fills the fitted board)
 *   6  StonePad × 9         — fully invisible tap targets (gold star on merge only)
 *  22  GateBadge            — spawn-queue count over the drawn gate
 *  10  HeroOnPad            — deployed hero sprites (centered on platforms)
 *  13  ProjectileDot
 *  14  EnemyOnPath          — enemies walking the (invisible) mapped lane
 */
import React, { useRef, useEffect } from "react";
import {
  View, Text, Animated, Pressable, StyleSheet, LayoutChangeEvent, Easing,
} from "react-native";
import { Image as ExpoImage } from "expo-image";

/* Enemy route — traces the illustrated stone walkway in the square (1:1) map:
   Disease Gate (upper-left, purple portal) → down left side → across bottom →
   up right side → Vital Lantern (upper-right, golden pagoda) — a perimeter loop.
   Fractions map onto the board's measured size (onLayout) — board matches the
   image ratio exactly so coordinates stay valid regardless of screen size.
   MUST stay identical to ward-defense.tsx.                              */
export const PATH_WPS: [number, number][] = [
  [0.122, 0.13], /*  0  Disease Gate spawn        */
  [0.122, 0.26], /*  1  left lane upper           */
  [0.114, 0.40], /*  2  left lane                 */
  [0.114, 0.54], /*  3  left lane                 */
  [0.131, 0.68], /*  4  left lane lower           */
  [0.175, 0.78], /*  5  bottom-left curve         */
  [0.297, 0.83], /*  6  bottom lane left          */
  [0.510, 0.84], /*  7  bottom lane center        */
  [0.703, 0.83], /*  8  bottom lane right         */
  [0.825, 0.78], /*  9  bottom-right curve        */
  [0.877, 0.68], /* 10  right lane lower          */
  [0.886, 0.54], /* 11  right lane                */
  [0.886, 0.40], /* 12  right lane                */
  [0.869, 0.26], /* 13  right lane upper          */
  [0.825, 0.13], /* 14  Vital Lantern exit        */
];

/* Nine deploy pads — aligned onto the nine cross pedestals drawn in the
   widened portrait map (3 cols × 3 rows, inside the walkway loop).
   MUST stay identical to ward-defense.tsx.                              */
export const DEPLOY_TILES: [number, number][] = [
  [0.345, 0.350], [0.510, 0.350], [0.675, 0.350],
  [0.345, 0.493], [0.510, 0.493], [0.675, 0.493],
  [0.345, 0.626], [0.510, 0.626], [0.675, 0.626],
];

/* ─── Assets ────────────────────────────────────────────────────────────── */
const IMG_MAP = require("../../assets/ward-defense/lotus-healing-ward-map-portrait.png");
/* Fog "wings" — mirrored strips of the map's own outer edges. They extend the
   scenery horizontally so the map spans the FULL screen width on wide displays
   without cropping or altering the square gameplay board. Mirroring guarantees
   pixel-perfect seam continuity at the board edges. */
const IMG_WING_L = require("../../assets/ward-defense/map-wing-left.png");
const IMG_WING_R = require("../../assets/ward-defense/map-wing-right.png");
const IMG_UNITS: Record<string, any> = {
  ward_scout:      require("../../assets/heroes/battle/apprentice_seer.png"),
  reassess_sage:   require("../../assets/heroes/battle/mindkeeper.png"),
  mist_caster:     require("../../assets/heroes/battle/village_caretaker.png"),
  herbal_chemist:  require("../../assets/heroes/battle/wound_sage.png"),
  o2_healer:       require("../../assets/heroes/battle/novice_guardian.png"),
  guardian:        require("../../assets/heroes/battle/junior_warden.png"),
  rhythm_medic:    require("../../assets/heroes/battle/storm_runner.png"),
  lantern_scribe:  require("../../assets/heroes/battle/data_acolyte.png"),
  fever_warden:    require("../../assets/heroes/battle/infection_warden.png"),
  airway_sentinel: require("../../assets/heroes/battle/night_watcher.png"),
};
const IMG_ENEMIES: Record<string, any> = {
  breathless_wisp:    require("../../assets/images/enemy_breathless_wisp.png"),
  wheeze_sprite:      require("../../assets/images/enemy_wheeze_sprite.png"),
  mucus_slime:        require("../../assets/images/enemy_mucus_slime.png"),
  hypoxia_wraith:     require("../../assets/images/enemy_hypoxia_wraith.png"),
  panic_imp:          require("../../assets/images/enemy_panic_imp.png"),
  fever_imp:          require("../../assets/images/enemy_fever_imp.png"),
  shock_shade:        require("../../assets/images/enemy_shock_shade.png"),
  stun_toad:          require("../../assets/images/enemy_stun_toad.png"),
  corruption_leech:   require("../../assets/images/enemy_corruption_leech.png"),
  bronchospasm_drake: require("../../assets/images/enemy_bronchospasm_drake.png"),
};
const ENEMY_COLOR: Record<string, string> = {
  breathless_wisp:    "#93c5fd",
  wheeze_sprite:      "#34d399",
  mucus_slime:        "#86efac",
  hypoxia_wraith:     "#c4b5fd",
  panic_imp:          "#fca5a5",
  fever_imp:          "#fb7185",
  shock_shade:        "#fcd34d",
  stun_toad:          "#a3e635",
  corruption_leech:   "#c084fc",
  bronchospasm_drake: "#fb923c",
};

/* Locomotion style — ethereal spirits hover/float, corporeal ones step/hop */
const ENEMY_LOCO: Record<string, "walk" | "float"> = {
  breathless_wisp:    "float",
  wheeze_sprite:      "float",
  mucus_slime:        "walk",
  hypoxia_wraith:     "float",
  panic_imp:          "float",
  fever_imp:          "walk",
  shock_shade:        "float",
  stun_toad:          "walk",
  corruption_leech:   "walk",
  bronchospasm_drake: "walk",
};

/* ─── Per-unit attack choreography ─────────────────────────────────────────
   Each healer has a signature cast: how far it lunges toward its target, the
   colour of its aura flash, and the shape of the projectile it hurls. Purely
   presentational — driven by the unit's atkDx/atkDy set in the game loop.   */
type ProjShape = "orb" | "bolt" | "ring" | "spark" | "leaf" | "wave" | "star" | "shard" | "flame" | "gust";
interface UnitFx { lunge: number; aura: string; proj: ProjShape; }
const UNIT_FX: Record<string, UnitFx> = {
  ward_scout:      { lunge: 6,  aura: "#38bdf8", proj: "spark" },
  reassess_sage:   { lunge: 4,  aura: "#a78bfa", proj: "star"  },
  mist_caster:     { lunge: 5,  aura: "#5eead4", proj: "wave"  },
  herbal_chemist:  { lunge: 5,  aura: "#84cc16", proj: "leaf"  },
  o2_healer:       { lunge: 7,  aura: "#22d3ee", proj: "ring"  },
  guardian:        { lunge: 9,  aura: "#f59e0b", proj: "orb"   },
  rhythm_medic:    { lunge: 10, aura: "#f472b6", proj: "bolt"  },
  lantern_scribe:  { lunge: 4,  aura: "#fbbf24", proj: "shard" },
  fever_warden:    { lunge: 8,  aura: "#fb7185", proj: "flame" },
  airway_sentinel: { lunge: 8,  aura: "#f472b6", proj: "gust"  },
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
  const lunge = useRef(new Animated.Value(0)).current;
  const isCast = (unit?.castFlash ?? 0) > 0;

  /* Lunge pulse: on each cast, snap forward then ease back to rest — the amount
     and direction come from the unit's signature UNIT_FX + last-target vector. */
  useEffect(() => {
    if (!isCast) return;
    lunge.setValue(0);
    Animated.sequence([
      Animated.timing(lunge, { toValue: 1, duration: 90,  easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(lunge, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [isCast, unit?.castFlash, lunge]);

  if (!unit) return null;
  const [fx, fy] = DEPLOY_TILES[tileIdx];
  const cx  = fx * aw;
  const cy  = fy * ah;
  const img = IMG_UNITS[unit.typeId];
  const col = unitColors[unit.typeId] ?? "#22d3ee";
  const fxDef = UNIT_FX[unit.typeId] ?? { lunge: 5, aura: col, proj: "orb" as ProjShape };
  const hpPct   = cl(unit.hp / unit.maxHp, 0, 1);
  const isFlash = isCast || (unit.mergeFlash ?? 0) > 0;
  const isStunned = (unit.stunTicks ?? 0) > 0;

  /* Hero sprites natively face LEFT — flip to face the target's side */
  const faceRight = (unit.atkDx ?? -1) > 0;
  const dx = unit.atkDx ?? 0, dy = unit.atkDy ?? 0;
  const lungeX = lunge.interpolate({ inputRange: [0, 1], outputRange: [0, dx * fxDef.lunge] });
  const lungeY = lunge.interpolate({ inputRange: [0, 1], outputRange: [0, dy * fxDef.lunge] });
  const auraScale = lunge.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.35] });
  const auraOpacity = lunge.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.85, 0] });

  return (
    <Animated.View style={{
      position: "absolute",
      left: cx - HERO_W / 2, top: cy - HERO_H / 2,
      width: HERO_W, alignItems: "center", zIndex: 10,
      transform: [{ translateY: bobY }, { translateX: lungeX }, { translateY: lungeY }],
    }}>
      {hpPct < 0.99 && (
        <View style={{ width: 36, height: 4, backgroundColor: "#00000090", borderRadius: 2, marginBottom: 2, overflow: "hidden" }}>
          <View style={{ width: `${hpPct * 100}%` as any, height: "100%", backgroundColor: hpPct > 0.5 ? "#22C55E" : hpPct > 0.25 ? "#FACC15" : "#EF4444" }} />
        </View>
      )}
      {/* Signature cast aura — swells and fades on each attack, tinted per unit */}
      <Animated.View style={{
        position: "absolute", top: HERO_H * 0.28, width: HERO_W * 0.9, height: HERO_W * 0.9,
        borderRadius: HERO_W, backgroundColor: fxDef.aura + "44",
        borderWidth: 2, borderColor: fxDef.aura,
        opacity: auraOpacity, transform: [{ scale: auraScale }], zIndex: 0,
        ...({ boxShadow: `0 0 12px ${fxDef.aura}` } as any),
      }} />
      {img ? (
        <ExpoImage source={img} style={{ width: HERO_W, height: HERO_H, transform: [{ scaleX: faceRight ? -1 : 1 }] }} contentFit="contain" cachePolicy="none" />
      ) : (
        <View style={{ width: HERO_W, height: HERO_H, borderRadius: 8, backgroundColor: col + "33", borderWidth: 2, borderColor: col, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 26 }}>🧙</Text>
        </View>
      )}
      {isFlash && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#FFFFFF30", borderRadius: 6, zIndex: 1 }} />
      )}
      {isStunned && (
        <View style={{ position: "absolute", top: -4, backgroundColor: "#0b1220CC", borderRadius: 6, paddingHorizontal: 3, zIndex: 2 }}>
          <Text style={{ fontSize: 11 }}>💫</Text>
        </View>
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
  const shape: ProjShape = (UNIT_FX[p.unitTypeId]?.proj) ?? "orb";
  const col = UNIT_FX[p.unitTypeId]?.aura ?? p.color ?? "#88C060";
  /* Heading of travel — orients directional projectiles (bolt/shard/gust/leaf) */
  const ang = Math.atan2(p.toFy - p.fromFy, p.toFx - p.fromFx) * 180 / Math.PI;
  const left = fx * aw, top = fy * ah;
  const wrap = (children: React.ReactNode, w: number, h: number, rot = 0) => (
    <View style={{
      position: "absolute", left: left - w / 2, top: top - h / 2,
      width: w, height: h, alignItems: "center", justifyContent: "center",
      zIndex: 13, transform: [{ rotate: `${rot}deg` }],
    }}>{children}</View>
  );
  const glow = (extra: any) => ({ ...({ boxShadow: `0 0 8px ${col}` } as any), ...extra });

  switch (shape) {
    case "bolt": /* rhythm_medic — a fast dash streak */
      return wrap(<View style={glow({ width: 16, height: 3, borderRadius: 2, backgroundColor: col })} />, 20, 6, ang);
    case "shard": /* lantern_scribe — a sharp diamond */
      return wrap(<View style={glow({ width: 8, height: 8, backgroundColor: col, transform: [{ rotate: "45deg" }] })} />, 14, 14, ang);
    case "gust": /* airway_sentinel — a swept crescent of air */
      return wrap(<View style={glow({ width: 14, height: 8, borderTopLeftRadius: 8, borderBottomLeftRadius: 8, borderRightWidth: 0, borderWidth: 2, borderColor: col, backgroundColor: col + "33" })} />, 18, 12, ang);
    case "leaf": /* herbal_chemist — an oval herbal mote */
      return wrap(<View style={glow({ width: 8, height: 12, borderRadius: 6, backgroundColor: col + "88", borderWidth: 1.5, borderColor: col })} />, 14, 16, ang + 45);
    case "flame": /* fever_warden — a hot teardrop */
      return wrap(<View style={glow({ width: 9, height: 11, borderRadius: 6, borderTopLeftRadius: 2, backgroundColor: col + "AA", borderWidth: 1, borderColor: "#fff7ed" })} />, 14, 16, ang + 45);
    case "ring": /* o2_healer — a hollow oxygen ring */
      return wrap(<View style={glow({ width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: col, backgroundColor: "transparent" })} />, 16, 16);
    case "wave": /* mist_caster — a soft misty puff */
      return wrap(<View style={glow({ width: 13, height: 9, borderRadius: 6, backgroundColor: col + "66", borderWidth: 1, borderColor: col })} />, 16, 12);
    case "star": /* reassess_sage — a bright insight spark */
      return wrap(<Text style={{ color: col, fontSize: 13, fontWeight: "900", ...({ textShadow: `0 0 8px ${col}` } as any) }}>✦</Text>, 16, 16);
    case "spark": /* ward_scout — a tiny quick pip */
      return wrap(<View style={glow({ width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff", borderWidth: 2, borderColor: col })} />, 12, 12);
    default: /* orb — guardian & fallback */
      return wrap(
        <View style={glow({ width: 10, height: 10, borderRadius: 5, backgroundColor: col + "55", borderWidth: 2, borderColor: col, alignItems: "center", justifyContent: "center" })}>
          <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: "#fff" }} />
        </View>, 14, 14);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYER 8 — ENEMY ON LANE
   ═══════════════════════════════════════════════════════════════════════════ */
function EnemyOnPath({ aw, ah, enemy }: { aw: number; ah: number; enemy: any }) {
  const [fx, fy] = getEnemyFrac(enemy);
  const hpPct  = cl(enemy.hp / enemy.maxHp, 0, 1);
  const barCol = hpPct > 0.6 ? "#22C55E" : hpPct > 0.3 ? "#FACC15" : "#EF4444";
  const isFlash = (enemy.hitFlash ?? 0) > 0;
  const isBoss  = enemy.typeId === "bronchospasm_drake";
  const sprW = isBoss ? 64 : 48, sprH = isBoss ? 64 : 48;
  const accent = ENEMY_COLOR[enemy.typeId] ?? "#94a3b8";
  const img    = IMG_ENEMIES[enemy.typeId];
  const loco   = ENEMY_LOCO[enemy.typeId] ?? "float";

  /* Per-enemy locomotion: walkers hop (grounded bounce + squash/stretch),
     floaters hover (slow vertical drift + gentle breathing scale). */
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const dur = loco === "walk" ? 300 : 1500;
    const upEase   = loco === "walk" ? Easing.out(Easing.quad) : Easing.inOut(Easing.sin);
    const downEase = loco === "walk" ? Easing.in(Easing.quad)  : Easing.inOut(Easing.sin);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: dur, easing: upEase,   useNativeDriver: false }),
      Animated.timing(anim, { toValue: 0, duration: dur, easing: downEase, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [loco, anim]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: loco === "walk" ? [0, -7] : [-5, 5],
  });
  const wobble = loco === "walk"
    ? { scaleY: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.05] }) }
    : { scale:  anim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.04] }) };

  const fallbackEmoji = enemy.typeId === "bronchospasm_drake" ? "🐲"
    : enemy.typeId === "hypoxia_wraith"  ? "👻"
    : enemy.typeId === "mucus_slime"     ? "🫧"
    : enemy.typeId === "wheeze_sprite"   ? "🌀" : "💨";

  /* Face the direction of travel, derived from the instantaneous movement vector
     of the CURRENT path segment (not a fixed lane threshold). Enemies moving
     rightward — the whole bottom traverse and the lower right curve — flip to
     face right; leftward/near-vertical legs keep the base LEFT-facing art.
     Base enemy art faces LEFT → apply scaleX:-1 only when heading right. */
  const seg   = cl(enemy.pathIndex, 0, PATH_WPS.length - 2);
  const segDx = PATH_WPS[seg + 1][0] - PATH_WPS[seg][0];
  const faceRight = segDx > 0.01;

  return (
    <Animated.View style={{
      position: "absolute",
      left: fx * aw - sprW / 2, top: fy * ah - sprH - 18,
      alignItems: "center", zIndex: 14,
      transform: [{ translateY }, wobble],
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
        <ExpoImage source={img} style={{ width: sprW, height: sprH, transform: [{ scaleX: faceRight ? -1 : 1 }] }} contentFit="contain" />
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
      {isBoss && !enemy.revealed && (
        <View style={{ position: "absolute", top: 22, backgroundColor: "#0b1220D0", borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1, borderWidth: 0.5, borderColor: accent + "AA", zIndex: 16 }}>
          <Text style={{ color: accent, fontSize: 6, fontWeight: "800" }}>🛡 RESIST</Text>
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
  /* Measure the AVAILABLE area (outer container) and fit the whole 878×1408
     portrait map inside it, preserving aspect. This guarantees the entry
     (Disease Gate) and exit (Vital Lantern) at the top of the map are NEVER
     cropped, while keeping overlays perfectly aligned
     (board size == image ratio → contentFit exact). */
  const availW = aw > 20 ? aw : 360;
  const availH = ah > 20 ? ah : 480;
  const scale  = Math.min(availW / 878, availH / 1408);
  const W = 878 * scale;
  const H = 1408 * scale;

  return (
    <View
      style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#07121A", overflow: "hidden" }}
      onLayout={onLayout}
    >
    {/* Left fog wing — fills any leftover width, seam matches the map's left edge */}
    <ExpoImage
      source={IMG_WING_L}
      style={{ flex: 1, height: H, alignSelf: "center" }}
      contentFit="cover"
      contentPosition="right center"
      cachePolicy="memory-disk"
    />
    <View
      style={{
        width: W,
        height: H,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#07121A",
      }}
    >
      {/* L0: Portrait battle map, sized to fit fully inside the available area.
          Board size matches the image's 878×1408 ratio exactly, so contentFit
          shows the WHOLE map (gate + lantern included) with zero crop, and
          overlay fractions (PATH_WPS / DEPLOY_TILES) sit EXACTLY on features. */}
      <ExpoImage
        source={IMG_MAP}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        cachePolicy="memory-disk"
      />

      {/* L2: Nine invisible tap targets aligned onto the drawn pedestals */}
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
        <EnemyOnPath key={e.uid} aw={W} ah={H} enemy={e} />
      ))}
    </View>
    {/* Right fog wing — fills any leftover width, seam matches the map's right edge */}
    <ExpoImage
      source={IMG_WING_R}
      style={{ flex: 1, height: H, alignSelf: "center" }}
      contentFit="cover"
      contentPosition="left center"
      cachePolicy="memory-disk"
    />
    </View>
  );
}
