/* ═══════════════════════════════════════════════════════════════════
   WARD DEFENSE: AIRWAY CODE RUSH
   Sprite tower-defense board — Clinica: Kingdom of Healing
   NCLEX Clinical Judgment integrated throughout gameplay
   ═══════════════════════════════════════════════════════════════════ */
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated, Image, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

/* ── Tick speed ── */
const TICK_MS          = 500;
const MAX_STABILITY    = 100;
const MAX_AP           = 12;
const INIT_AP          = 5;
const AP_REGEN_TICKS   = 3;
const WAVE_PAUSE_TICKS = 10;
const SPAWN_GAP_TICKS  = 7;
const KILL_AP_BONUS    = 2;
const ROAD_W           = 28;   /* visual road width in px */
const TILE_SIZE        = 46;   /* deployment tile size in px */

/* ── Board: path waypoints as [fracX, fracY] (0=top-left, 1=bottom-right) ──
   S-curve: Corruption Gate (top-right) → Vital Lantern (bottom-left)      */
const PATH_WPS: [number, number][] = [
  [0.88, 0.09],   /* 0 — Corruption Gate entry */
  [0.14, 0.09],   /* 1 — top-left corner */
  [0.14, 0.47],   /* 2 — mid-left corner */
  [0.86, 0.47],   /* 3 — mid-right corner */
  [0.86, 0.88],   /* 4 — bottom-right corner */
  [0.11, 0.88],   /* 5 — Vital Lantern (exit) */
];
const N_SEGS = PATH_WPS.length - 1;   /* 5 segments */

/* ── Deployment tiles: two interior zones between path rows ── */
const DEPLOY_TILES: [number, number][] = [
  [0.38, 0.27], [0.55, 0.27], [0.72, 0.27],  /* top zone */
  [0.30, 0.67], [0.50, 0.67], [0.70, 0.67],  /* bottom zone */
];

/* ═══════════════════════════════════════════════════════════════════
   ENEMY CATALOGUE
   ═══════════════════════════════════════════════════════════════════ */
type EnemyDef = {
  name: string; icon: string; maxHp: number;
  speed: number; damage: number; color: string;
  weakUnits: string[];   /* unit type IDs that deal full damage */
  strongUnits: string[]; /* unit type IDs that deal extra damage */
  clue: string; flavor: string; isBoss?: boolean;
};

const ENEMY_DATA: Record<string, EnemyDef> = {
  breathless_wisp: {
    name: "Breathless Wisp", icon: "💨",
    maxHp: 55, speed: 0.058, damage: 8, color: "#60A5FA",
    weakUnits: ["ward_scout"],
    strongUnits: [],
    clue: "Dyspnea",
    flavor: "Restricts airflow — early assessment reveals its pattern.",
  },
  wheeze_sprite: {
    name: "Wheeze Sprite", icon: "🌀",
    maxHp: 80, speed: 0.065, damage: 10, color: "#34D399",
    weakUnits: ["ward_scout", "mist_caster"],
    strongUnits: [],
    clue: "Wheezing",
    flavor: "Tight airways — wheeze audible on auscultation.",
  },
  mucus_slime: {
    name: "Mucus Slime", icon: "🫧",
    maxHp: 95, speed: 0.042, damage: 14, color: "#86EFAC",
    weakUnits: ["o2_healer"],
    strongUnits: [],
    clue: "Secretions",
    flavor: "Secretion buildup — positioning aids drainage.",
  },
  hypoxia_wraith: {
    name: "Hypoxia Wraith", icon: "👻",
    maxHp: 105, speed: 0.070, damage: 16, color: "#C4B5FD",
    weakUnits: ["o2_healer"],
    strongUnits: [],
    clue: "Cyanosis",
    flavor: "Oxygen deprivation — supplemental O₂ is the direct counter.",
  },
  bronchospasm_drake: {
    name: "Bronchospasm Drake", icon: "🐲",
    maxHp: 260, speed: 0.028, damage: 30, color: "#F97316",
    weakUnits: ["mist_caster"],
    strongUnits: [],
    isBoss: true,
    clue: "Bronchospasm",
    flavor: "Severe bronchospasm incarnate — bronchodilators essential.",
  },
};

/* ═══════════════════════════════════════════════════════════════════
   HEALER UNIT CATALOGUE — deployable on tiles
   ═══════════════════════════════════════════════════════════════════ */
type UnitDef = {
  name: string; color: string; apCost: number;
  damage: number; attackSpeed: number; range: number; aoe: boolean;
  category: string;
  strong: string[];   /* enemy type IDs = full damage */
  weak: string[];     /* enemy type IDs = reduced damage */
  concept: string; flavor: string;
};

const UNIT_DATA: Record<string, UnitDef> = {
  ward_scout: {
    name: "Ward Scout", color: "#60A5FA",
    apCost: 3, damage: 19, attackSpeed: 2, range: 0.31,
    aoe: false, category: "ASSESS",
    strong: ["breathless_wisp", "wheeze_sprite"],
    weak:   ["mucus_slime", "bronchospasm_drake"],
    concept: "Auscultation identifies respiratory cues — assess before treating.",
    flavor: "Quick-eyed healer trained to spot airway patterns early.",
  },
  mist_caster: {
    name: "Mist Caster", color: "#F59E0B",
    apCost: 5, damage: 38, attackSpeed: 4, range: 0.25,
    aoe: false, category: "TREAT",
    strong: ["wheeze_sprite", "bronchospasm_drake"],
    weak:   ["hypoxia_wraith", "mucus_slime"],
    concept: "Bronchodilators relax airway smooth muscle — first-line for bronchospasm.",
    flavor: "Pharmacist-mage who conjures targeted bronchodilator mist.",
  },
  o2_healer: {
    name: "O₂ Healer", color: "#34D399",
    apCost: 4, damage: 22, attackSpeed: 3, range: 0.29,
    aoe: true, category: "SUPPORT",
    strong: ["hypoxia_wraith", "mucus_slime"],
    weak:   ["breathless_wisp", "bronchospasm_drake"],
    concept: "O₂ corrects hypoxemia; positioning aids secretion drainage.",
    flavor: "Oxygenation and positioning specialist.",
  },
};
const UNIT_TYPES = Object.keys(UNIT_DATA);

/* ═══════════════════════════════════════════════════════════════════
   GLOBAL ABILITY CATALOGUE — bottom hand cards
   ═══════════════════════════════════════════════════════════════════ */
type AbilityDef = {
  name: string; icon: string; color: string; apCost: number;
  category: string; concept: string; flavor: string;
};

const ABILITY_DATA: Record<string, AbilityDef> = {
  broncho_burst: {
    name: "Broncho Burst", icon: "💨", color: "#F59E0B", apCost: 4,
    category: "TREAT",
    concept: "Nebulized bronchodilator treats all active bronchospasm.",
    flavor: "Deal 30 damage to every enemy on the path.",
  },
  emergency_o2: {
    name: "Emergency O₂", icon: "🆘", color: "#34D399", apCost: 3,
    category: "CRISIS",
    concept: "Emergency supplemental O₂ addresses immediate hypoxemia.",
    flavor: "Restore +15 Stability instantly.",
  },
  positioning_order: {
    name: "Positioning", icon: "🛌", color: "#A78BFA", apCost: 2,
    category: "SUPPORT",
    concept: "Upright positioning reduces work of breathing and aids drainage.",
    flavor: "Slow all enemies 50% for 6 ticks.",
  },
  reassess_protocol: {
    name: "Reassess", icon: "🔄", color: "#EC4899", apCost: 3,
    category: "ASSESS",
    concept: "Reassessment closes the clinical loop — confirms interventions work.",
    flavor: "+5 Stability if correct units are deployed. Reveals cues.",
  },
};
const ABILITIES = Object.keys(ABILITY_DATA);

/* ── Wave definitions ── */
type WaveDef = { spawns: string[]; isBoss?: boolean };
const WAVES: WaveDef[] = [
  { spawns: ["breathless_wisp", "breathless_wisp", "breathless_wisp"] },
  { spawns: ["breathless_wisp", "wheeze_sprite", "breathless_wisp", "wheeze_sprite"] },
  { spawns: ["wheeze_sprite", "mucus_slime", "wheeze_sprite"] },
  { spawns: ["hypoxia_wraith", "mucus_slime", "wheeze_sprite", "hypoxia_wraith"] },
  { spawns: ["hypoxia_wraith", "wheeze_sprite", "hypoxia_wraith", "mucus_slime"] },
  { spawns: ["bronchospasm_drake"], isBoss: true },
];

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
type ActiveEnemy = {
  uid: string; typeId: string; hp: number; maxHp: number;
  pathIndex: number; pathProgress: number;
  hitFlash: number; slowTicks: number;
};

type DeployedUnit = {
  uid: string; typeId: string; tileIndex: number;
  cooldown: number; castFlash: number;
  level: number;      /* 1 | 2 | 3  — Care Synthesis level */
  mergeFlash: number; /* ticks of golden merge-ascension glow */
};

type Projectile = {
  uid: string; toEnemyUid: string;
  fromFx: number; fromFy: number;
  toFx: number; toFy: number;
  progress: number; color: string;
  damage: number; unitTypeId: string;
};

type Feedback = {
  id: string; text: string; color: string;
  quality: "strong" | "partial" | "weak" | "bonus"; ticks: number;
};

type Phase = "lobby" | "playing" | "wave_pause" | "won" | "lost";
type EnemyMasteryEntry = { defeated: boolean; correctDefeated: boolean };
type LearningStats = {
  priorityActions: number;
  strongMatches: number; partialMatches: number; weakMatches: number;
  peakCareChain: number; reassessUses: number;
  learnedConcepts: string[];
  enemyMastery: Record<string, EnemyMasteryEntry>;
};

type GS = {
  phase: Phase; wave: number;
  stability: number; ap: number; apTimer: number;
  deployedUnits: DeployedUnit[];
  enemies: ActiveEnemy[]; projectiles: Projectile[];
  spawnQueue: string[]; spawnTimer: number;
  wavePauseTicks: number; feedbacks: Feedback[];
  score: number; tickCount: number; uidSeed: number;
  /* NCLEX learning */
  careChain: number; peakCareChain: number; priorityActions: number;
  strongMatches: number; partialMatches: number; weakMatches: number;
  reassessUses: number; learnedConcepts: string[];
  enemyMastery: Record<string, EnemyMasteryEntry>;
  lastKillQuality: "strong" | "partial" | "weak" | null;
};

/* ═══════════════════════════════════════════════════════════════════
   PURE HELPERS
   ═══════════════════════════════════════════════════════════════════ */
function freshMastery(): Record<string, EnemyMasteryEntry> {
  const m: Record<string, EnemyMasteryEntry> = {};
  Object.keys(ENEMY_DATA).forEach(k => { m[k] = { defeated: false, correctDefeated: false }; });
  return m;
}

function freshState(): GS {
  return {
    phase: "lobby", wave: 0,
    stability: MAX_STABILITY, ap: INIT_AP, apTimer: AP_REGEN_TICKS,
    deployedUnits: [], enemies: [], projectiles: [],
    spawnQueue: [], spawnTimer: 0, wavePauseTicks: 0, feedbacks: [],
    score: 0, tickCount: 0, uidSeed: 0,
    careChain: 0, peakCareChain: 0, priorityActions: 0,
    strongMatches: 0, partialMatches: 0, weakMatches: 0,
    reassessUses: 0, learnedConcepts: [], enemyMastery: freshMastery(),
    lastKillQuality: null,
  };
}

function beginWave(gs: GS, waveIdx: number): GS {
  return {
    ...gs, wave: waveIdx, phase: "playing",
    spawnQueue: [...WAVES[waveIdx].spawns],
    spawnTimer: 0, enemies: [], projectiles: [],
    feedbacks: [], wavePauseTicks: 0,
  };
}

function cl(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function lp(a: number, b: number, t: number)   { return a + (b - a) * cl(t, 0, 1); }

function getEnemyPosFrac(e: ActiveEnemy): { x: number; y: number } {
  const pi = cl(e.pathIndex, 0, N_SEGS - 1);
  const from = PATH_WPS[pi], to = PATH_WPS[pi + 1];
  return { x: lp(from[0], to[0], e.pathProgress), y: lp(from[1], to[1], e.pathProgress) };
}

function getUnitPosFrac(tileIdx: number): { x: number; y: number } {
  return { x: DEPLOY_TILES[tileIdx][0], y: DEPLOY_TILES[tileIdx][1] };
}

function distFrac(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function getMatchQuality(unitTypeId: string, enemyTypeId: string): "strong" | "partial" | "weak" {
  const u = UNIT_DATA[unitTypeId];
  if (u.strong.includes(enemyTypeId)) return "strong";
  if (u.weak.includes(enemyTypeId))   return "weak";
  return "partial";
}

function applyDmg(base: number, q: "strong" | "partial" | "weak"): number {
  return q === "strong" ? base : q === "partial" ? Math.round(base * 0.55) : Math.round(base * 0.25);
}

function calcRewards(won: boolean, stability: number) {
  if (won) {
    const b = Math.floor(stability / 20);
    return { codexShards: 22 + b * 4, playerXp: 70 + b * 8, heroXp: 25 + b * 3, airCatalyst: b + 1 };
  }
  return { codexShards: 6, playerXp: 18, heroXp: 8, airCatalyst: 0 };
}

/* ── Care Synthesis helpers ── */
function getScaledStats(def: UnitDef, level: number) {
  const dmgMult = level === 1 ? 1.0 : level === 2 ? 1.65 : 2.8;
  return {
    damage:      Math.round(def.damage * dmgMult),
    attackSpeed: Math.max(1, def.attackSpeed - (level - 1)),
    range:       def.range + (level - 1) * 0.045,
  };
}

function findMergePair(units: DeployedUnit[]): [DeployedUnit, DeployedUnit] | null {
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i], b = units[j];
      if (a.typeId === b.typeId && a.level === b.level && a.level < 3) return [a, b];
    }
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════
   BOARD GRID — subtle cell-line overlay making the board read as a
   tactical game field rather than a scenic background
   ═══════════════════════════════════════════════════════════════════ */
function BoardGrid({ aw, ah }: { aw: number; ah: number }) {
  if (aw < 20 || ah < 20) return null;
  const CELL = 30;
  const cols = Math.ceil(aw / CELL) + 1;
  const rows = Math.ceil(ah / CELL) + 1;
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <View key={`h${i}`} style={{
          position: "absolute", left: 0, top: i * CELL,
          width: aw, height: 1,
          backgroundColor: "#4a88c8", opacity: 0.10, zIndex: 0,
        }} />
      ))}
      {Array.from({ length: cols }, (_, i) => (
        <View key={`v${i}`} style={{
          position: "absolute", top: 0, left: i * CELL,
          width: 1, height: ah,
          backgroundColor: "#4a88c8", opacity: 0.10, zIndex: 0,
        }} />
      ))}
      {/* Corner accent dots at every other intersection */}
      {Array.from({ length: Math.ceil(rows / 2) }, (_, r) =>
        Array.from({ length: Math.ceil(cols / 2) }, (_, c) => (
          <View key={`d${r}_${c}`} style={{
            position: "absolute",
            left: c * CELL * 2 - 1, top: r * CELL * 2 - 1,
            width: 2.5, height: 2.5, borderRadius: 1.5,
            backgroundColor: "#4a88c8", opacity: 0.22, zIndex: 0,
          }} />
        ))
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PATH TILE ROAD — S-curve rendered as individual paving-stone tiles
   giving a board-game "road" feel rather than a painted corridor
   ═══════════════════════════════════════════════════════════════════ */
function PathTileRoad({ aw, ah }: { aw: number; ah: number }) {
  if (aw < 20 || ah < 20) return null;

  const TILE_ALONG = 22;
  const TILE_GAP   = 5;
  const STEP = TILE_ALONG + TILE_GAP;

  const tiles: { cx: number; cy: number; angle: number; seg: number }[] = [];
  for (let seg = 0; seg < N_SEGS; seg++) {
    const from = PATH_WPS[seg], to = PATH_WPS[seg + 1];
    const x1 = from[0] * aw, y1 = from[1] * ah;
    const x2 = to[0] * aw,   y2 = to[1] * ah;
    const dx = x2 - x1, dy = y2 - y1;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const n = Math.max(1, Math.floor(segLen / STEP));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      tiles.push({ cx: x1 + dx * t, cy: y1 + dy * t, angle, seg });
    }
  }

  return (
    <>
      {/* Dark road base per segment (solid fill behind tiles) */}
      {PATH_WPS.slice(0, -1).map((wp, seg) => {
        const to = PATH_WPS[seg + 1];
        const x1 = wp[0] * aw, y1 = wp[1] * ah;
        const x2 = to[0] * aw, y2 = to[1] * ah;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View key={`base${seg}`} style={{
            position: "absolute",
            left: (x1 + x2) / 2 - len / 2,
            top:  (y1 + y2) / 2 - (ROAD_W + 2) / 2,
            width: len, height: ROAD_W + 2,
            backgroundColor: "#040c18",
            transform: [{ rotate: `${angle}deg` }], zIndex: 1,
          }} />
        );
      })}
      {/* Corner junction fillers */}
      {PATH_WPS.slice(1, -1).map(([fx, fy], i) => (
        <View key={`corner${i}`} style={{
          position: "absolute",
          left: fx * aw - (ROAD_W + 2) / 2,
          top:  fy * ah - (ROAD_W + 2) / 2,
          width: ROAD_W + 2, height: ROAD_W + 2, borderRadius: (ROAD_W + 2) / 2,
          backgroundColor: "#040c18", zIndex: 1,
        }} />
      ))}
      {/* Individual paving-stone tiles */}
      {tiles.map((tile, i) => (
        <View key={`tile${i}`} style={{
          position: "absolute",
          left: tile.cx - TILE_ALONG / 2,
          top:  tile.cy - ROAD_W / 2,
          width: TILE_ALONG, height: ROAD_W,
          backgroundColor: tile.seg % 2 === 0 ? "#0d1e36" : "#0c1c32",
          borderWidth: 1,
          borderColor: "#2a5070",
          borderRadius: 3,
          transform: [{ rotate: `${tile.angle}deg` }], zIndex: 2,
        }} />
      ))}
      {/* Center glow line per segment — directional visual cue */}
      {PATH_WPS.slice(0, -1).map((wp, seg) => {
        const to = PATH_WPS[seg + 1];
        const x1 = wp[0] * aw, y1 = wp[1] * ah;
        const x2 = to[0] * aw, y2 = to[1] * ah;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const glowColor = seg % 2 === 0 ? "#60A5FA" : "#34D399";
        return (
          <View key={`glow${seg}`} style={{
            position: "absolute",
            left: (x1 + x2) / 2 - len / 2,
            top:  (y1 + y2) / 2 - 1.5,
            width: len, height: 3,
            backgroundColor: glowColor + "40",
            transform: [{ rotate: `${angle}deg` }], zIndex: 3,
          }} />
        );
      })}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BOARD ENDPOINTS
   ═══════════════════════════════════════════════════════════════════ */
function CorruptionGate({ aw, ah }: { aw: number; ah: number }) {
  const [fx, fy] = PATH_WPS[0];
  const px = fx * aw, py = fy * ah;
  return (
    <View style={{ position: "absolute", left: px - 20, top: py - 22, alignItems: "center", zIndex: 3 }}>
      <Text style={{ color: "#EF444488", fontSize: 6.5, fontWeight: "700", letterSpacing: 0.5 }}>GATE</Text>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#1a0608",
        borderWidth: 2, borderColor: "#EF4444", alignItems: "center", justifyContent: "center" }}>
        <LinearGradient colors={["#3b0a10", "#200508"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16 }} />
        <Text style={{ color: "#EF4444", fontSize: 14, lineHeight: 16, fontWeight: "700" }}>✕</Text>
      </View>
      {/* Outer ring pulse */}
      <View style={{ position: "absolute", top: 12, width: 40, height: 40, borderRadius: 20,
        borderWidth: 1, borderColor: "#EF444430" }} />
    </View>
  );
}

function VitalLanternBoard({ stability, aw, ah }: { stability: number; aw: number; ah: number }) {
  const [fx, fy] = PATH_WPS[PATH_WPS.length - 1];
  const px = fx * aw, py = fy * ah;
  const glow = stability > 60 ? "#34D399" : stability > 30 ? "#FBBF24" : "#F87171";
  return (
    <View style={{ position: "absolute", left: px - 20, top: py - 30, alignItems: "center", zIndex: 6 }}>
      <LinearGradient colors={[glow + "35", "#00000000"]}
        style={{ position: "absolute", top: -12, left: -12, width: 60, height: 60, borderRadius: 30 }} />
      <Text style={{ color: glow, fontSize: 6.5, fontWeight: "700", letterSpacing: 0.5, marginBottom: 2 }}>LANTERN</Text>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "#081625",
        borderWidth: 2, borderColor: glow, alignItems: "center", justifyContent: "center" }}>
        <LinearGradient colors={[glow + "90", glow + "40"]}
          style={{ position: "absolute", top: 2, left: 2, right: 2, bottom: 2, borderRadius: 999 }} />
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 11, height: 2.5, borderRadius: 2, backgroundColor: "#fff" }} />
          <View style={{ position: "absolute", width: 2.5, height: 11, borderRadius: 2, backgroundColor: "#fff" }} />
        </View>
      </View>
      <View style={{ width: 34, height: 4, borderRadius: 2, backgroundColor: "#0a1428", marginTop: 4, overflow: "hidden" }}>
        <View style={{ width: `${stability}%` as any, height: "100%", borderRadius: 2, backgroundColor: glow }} />
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ENEMY SPRITES — 2.5D Rush Royale-style chibi monsters
   Each: shield gem backing card + large character + pupils/catchlights
   ═══════════════════════════════════════════════════════════════════ */
type SpriteProps = { hitFlash: boolean; bobY: Animated.AnimatedInterpolation<number> };

/* ─── ENEMY SPRITES ─────────────────────────────────────────────────────────
   Design principles:
   • Face LEFT (toward healers/board entrance)
   • Non-circular monster silhouettes — each enemy has a DIFFERENT shape
   • Directional reaching limbs toward victims
   • Hollow/sunken/grotesque eyes — NOT cute round emoji eyes
   • Speed trail on the right (trailing edge)
   ─────────────────────────────────────────────────────────────────────────── */

/* BREATHLESS WISP — elongated spirit, tall oval body, hollow socket eyes */
function BreathlessWispSprite({ hitFlash, bobY }: SpriteProps) {
  const c = hitFlash ? "#fff" : "#93c5fd";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* GEM CARD backing */}
      <View style={{ position:"absolute", bottom:-2, width:54, height:30,
        borderRadius:8, borderBottomLeftRadius:28, borderBottomRightRadius:28,
        backgroundColor:"#1e3a8a", borderWidth:2, borderColor:"#0f172a" }}>
        <View style={{ position:"absolute", top:3, left:8, right:8, height:5,
          borderRadius:3, backgroundColor:"#93c5fd25" }}/>
      </View>
      {/* SPEED TRAIL — on right (enemy moves left) */}
      <View style={{ position:"absolute", right:-6, top:22, gap:3 }}>
        {[18,12,22,14].map((w,i)=>(
          <View key={i} style={{ width:w, height:1.5, borderRadius:1,
            backgroundColor:"#60a5fa65" }}/>
        ))}
      </View>
      {/* FORWARD REACHING TENDRILS — left side, toward healers */}
      <View style={{ position:"absolute", top:16, left:-16, width:22, height:7,
        borderRadius:4, borderTopRightRadius:0, borderBottomRightRadius:0,
        backgroundColor:"#bfdbfe28", borderWidth:1.5, borderColor:c+"70",
        transform:[{rotate:"-10deg"}]}}/>
      <View style={{ position:"absolute", top:28, left:-18, width:24, height:6,
        borderRadius:4, backgroundColor:"#bfdbfe20", borderWidth:1, borderColor:c+"45",
        transform:[{rotate:"10deg"}]}}/>
      {/* ELONGATED TALL OVAL BODY — NOT a sphere */}
      <View style={{ width:40, height:62, borderRadius:20,
        borderBottomLeftRadius:8, borderBottomRightRadius:8,
        backgroundColor:"#bfdbfe18", borderWidth:2, borderColor:c,
        alignItems:"center", overflow:"hidden" }}>
        <LinearGradient colors={[c+"45","#bfdbfe10","transparent"]}
          style={{ position:"absolute", top:0, left:0, right:0, height:46 }}/>
        <View style={{ position:"absolute", top:4, left:7, width:18, height:10,
          borderRadius:9, backgroundColor:"#ffffff22" }}/>
        {/* HOLLOW SUNKEN SOCKETS — dark pits, NOT round emoji eyes */}
        <View style={{ position:"absolute", top:14, flexDirection:"row", gap:8 }}>
          {[0,1].map(i=>(
            <View key={i} style={{ width:13, height:17, borderRadius:7,
              backgroundColor:"#0f172a", alignItems:"center", justifyContent:"center" }}>
              <View style={{ width:7, height:11, borderRadius:4, backgroundColor:"#020617" }}/>
              <View style={{ position:"absolute", width:5, height:5, borderRadius:3,
                backgroundColor:"#60a5fa65" }}/>
              <View style={{ position:"absolute", top:2, right:2, width:3, height:3,
                borderRadius:2, backgroundColor:"#93c5fd90" }}/>
            </View>
          ))}
        </View>
        {/* Jagged mouth slash */}
        <View style={{ position:"absolute", top:38, width:22, height:5,
          borderRadius:2, backgroundColor:"#0f172a" }}>
          <View style={{ position:"absolute", top:1, left:3, right:3, height:2,
            backgroundColor:"#1e3a8a" }}/>
        </View>
      </View>
      {/* DISSOLVING IRREGULAR TAIL STRANDS — not round blobs */}
      <View style={{ flexDirection:"row", gap:0, marginTop:-5 }}>
        {[{w:7,h:15,r:-14},{w:6,h:22,r:-3},{w:7,h:18,r:5},{w:5,h:14,r:16}].map((t,i)=>(
          <View key={i} style={{ width:t.w, height:t.h, borderRadius:999,
            backgroundColor:"#bfdbfe18", borderWidth:1, borderColor:c+"28",
            transform:[{rotate:`${t.r}deg`}]}}/>
        ))}
      </View>
    </Animated.View>
  );
}

/* WHEEZE SPRITE — goblin head + cyclone vortex body (humanoid top, wind bottom) */
function WheezeSpriteSprite({ hitFlash, bobY }: SpriteProps) {
  const c = hitFlash ? "#fff" : "#6ee7b7";
  const darkG = "#065f46";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* GEM CARD */}
      <View style={{ position:"absolute", bottom:-2, width:56, height:30,
        borderRadius:8, borderBottomLeftRadius:28, borderBottomRightRadius:28,
        backgroundColor:"#064e3b", borderWidth:2, borderColor:"#022c22" }}>
        <View style={{ position:"absolute", top:3, left:8, right:8, height:5,
          borderRadius:3, backgroundColor:"#34d39928" }}/>
      </View>
      {/* SPEED TRAIL */}
      <View style={{ position:"absolute", right:-6, top:20, gap:2.5 }}>
        {[16,10,20,12,16].map((w,i)=>(
          <View key={i} style={{ width:w, height:1.5, borderRadius:1,
            backgroundColor:`${c}65` }}/>
        ))}
      </View>
      {/* WIND ARM — left (trailing behind) */}
      <View style={{ position:"absolute", top:12, left:-20, width:24, height:9,
        borderRadius:5, backgroundColor:"#1a6b4a88",
        borderWidth:1.5, borderColor:c+"70",
        transform:[{rotate:"22deg"}]}}/>
      {/* WIND ARM — right (reaching forward/left toward healers) */}
      <View style={{ position:"absolute", top:10, right:-18, width:26, height:9,
        borderRadius:5, backgroundColor:"#1a6b4a88",
        borderWidth:1.5, borderColor:c,
        transform:[{rotate:"-15deg"}]}}/>
      {/* GOBLIN HEAD — wide, squished/wind-pressed, NOT a circle */}
      <View style={{ width:44, height:30, borderRadius:14,
        borderTopLeftRadius:10, borderTopRightRadius:18,
        backgroundColor:"#1a6b4a", borderWidth:2, borderColor:c }}>
        {/* Heavy brow ridge */}
        <View style={{ position:"absolute", top:3, left:4, right:4, height:8,
          borderRadius:4, backgroundColor:darkG }}/>
        {/* Wind-squinted LEFT eye — nearly shut from wind pressure */}
        <View style={{ position:"absolute", top:9, left:5, width:10, height:5,
          borderRadius:3, backgroundColor:darkG,
          transform:[{rotate:"-12deg"}]}}/>
        {/* RIGHT eye — open and fierce */}
        <View style={{ position:"absolute", top:8, right:4, width:10, height:12,
          borderRadius:5, backgroundColor:darkG,
          alignItems:"center", justifyContent:"center" }}>
          <View style={{ width:5, height:7, borderRadius:3, backgroundColor:c }}/>
          <View style={{ position:"absolute", top:1, right:1, width:3, height:3,
            borderRadius:2, backgroundColor:"#fff" }}/>
        </View>
        {/* Snout */}
        <View style={{ position:"absolute", top:17, right:11, width:7, height:5,
          borderRadius:3, borderWidth:1.5, borderColor:darkG }}/>
        {/* Clenched teeth grin */}
        <View style={{ position:"absolute", bottom:2, left:5, right:5, height:6,
          borderRadius:3, borderTopLeftRadius:0, borderTopRightRadius:0,
          backgroundColor:darkG, flexDirection:"row",
          justifyContent:"space-around", paddingTop:1 }}>
          {[0,1,2,3].map(i=>(
            <View key={i} style={{ width:5, height:4, borderRadius:1,
              borderBottomLeftRadius:3, borderBottomRightRadius:3,
              backgroundColor:"#ecfdf5" }}/>
          ))}
        </View>
      </View>
      {/* CYCLONE CONE BODY — vortex replaces legs entirely */}
      <View style={{ width:46, height:38, borderRadius:23,
        borderTopLeftRadius:12, borderTopRightRadius:12,
        borderBottomLeftRadius:5, borderBottomRightRadius:5,
        backgroundColor:"#064e3b65", borderWidth:2, borderColor:c,
        marginTop:-4, alignItems:"center", overflow:"hidden" }}>
        <View style={{ position:"absolute", top:3, left:2, right:2, height:30,
          borderRadius:13, borderWidth:2, borderColor:c+"42" }}/>
        <View style={{ position:"absolute", top:9, left:6, right:6, height:18,
          borderRadius:9, borderWidth:1.5, borderColor:c+"28" }}/>
        {[5,13,21].map((t,i)=>(
          <View key={i} style={{ position:"absolute", top:t, left:8, right:8, height:1.5,
            borderRadius:1, backgroundColor:c+"38",
            transform:[{rotate:`${[-10,5,-8][i]}deg`}]}}/>
        ))}
      </View>
      {/* Cyclone tip */}
      <View style={{ width:10, height:14, borderRadius:5,
        backgroundColor:"#064e3b", borderWidth:1.5, borderColor:c+"60",
        marginTop:-7 }}/>
    </Animated.View>
  );
}

/* MUCUS SLIME — wide low asymmetric blob with REACHING PSEUDOPODS, not a circle */
function MucusSlimeSprite({ hitFlash, bobY }: SpriteProps) {
  const c = hitFlash ? "#fff" : "#86efac";
  const darkG = "#14532d";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* GEM CARD — widest enemy */}
      <View style={{ position:"absolute", bottom:-2, width:68, height:34,
        borderRadius:8, borderBottomLeftRadius:34, borderBottomRightRadius:34,
        backgroundColor:darkG, borderWidth:2, borderColor:"#052e16" }}>
        <View style={{ position:"absolute", top:4, left:12, right:12, height:6,
          borderRadius:3, backgroundColor:"#86efac25" }}/>
      </View>
      {/* DRIP TRAIL — right side */}
      <View style={{ position:"absolute", right:-4, top:14, gap:4 }}>
        {[{w:9,h:5},{w:5,h:9},{w:7,h:6}].map((d,i)=>(
          <View key={i} style={{ width:d.w, height:d.h, borderRadius:999,
            backgroundColor:`${c}52` }}/>
        ))}
      </View>
      {/* MAIN REACHING PSEUDOPOD — forward-left, toward healers */}
      <View style={{ position:"absolute", top:6, left:-24, width:32, height:16,
        borderRadius:8, borderTopLeftRadius:3, borderBottomLeftRadius:3,
        backgroundColor:"#166534", borderWidth:2, borderColor:c,
        transform:[{rotate:"-8deg"}]}}/>
      {/* Pseudopod suction cup tip */}
      <View style={{ position:"absolute", top:4, left:-30, width:14, height:14,
        borderRadius:7, backgroundColor:darkG, borderWidth:2, borderColor:c,
        alignItems:"center", justifyContent:"center" }}>
        <View style={{ width:6, height:6, borderRadius:3,
          borderWidth:1.5, borderColor:c }}/>
      </View>
      {/* SECONDARY PSEUDOPOD — lower angle */}
      <View style={{ position:"absolute", top:26, left:-20, width:26, height:11,
        borderRadius:6, backgroundColor:"#166534", borderWidth:2, borderColor:c,
        transform:[{rotate:"14deg"}]}}/>
      {/* WIDE ASYMMETRIC BLOB BODY */}
      <View style={{ width:60, height:44, borderRadius:22,
        borderTopLeftRadius:16, borderTopRightRadius:28,
        borderBottomLeftRadius:12, borderBottomRightRadius:20,
        backgroundColor:"#166534", borderWidth:2.5, borderColor:c,
        alignItems:"center", justifyContent:"center" }}>
        <View style={{ position:"absolute", top:5, left:8, width:18, height:10,
          borderRadius:9, backgroundColor:"#ffffff28" }}/>
        {/* Surface bumps */}
        {[{t:5,l:34,s:8},{t:16,l:45,s:6},{t:27,l:37,s:7},{t:7,l:21,s:5}].map((b,i)=>(
          <View key={i} style={{ position:"absolute", top:b.t, left:b.l,
            width:b.s, height:b.s, borderRadius:b.s/2,
            backgroundColor:darkG, borderWidth:1.5, borderColor:c+"60" }}/>
        ))}
        {/* Face SUNKEN IN BODY — heavy drooping lids, grotesque */}
        <View style={{ position:"absolute", top:9, left:7, flexDirection:"row", gap:11 }}>
          {[0,1].map(i=>(
            <View key={i} style={{ alignItems:"center" }}>
              <View style={{ width:15, height:9, borderRadius:4, borderBottomLeftRadius:2,
                borderBottomRightRadius:2, backgroundColor:darkG,
                transform:[{rotate:`${i===0?-8:8}deg`}]}}/>
              <View style={{ width:11, height:11, borderRadius:6,
                backgroundColor:darkG, marginTop:-2,
                alignItems:"center", justifyContent:"center" }}>
                <View style={{ width:5, height:5, borderRadius:3, backgroundColor:"#bbf7d0" }}/>
                <View style={{ position:"absolute", top:1.5, right:1.5, width:2.5, height:2.5,
                  borderRadius:2, backgroundColor:"#fff" }}/>
              </View>
            </View>
          ))}
        </View>
        {/* Wide maw with alternating fangs */}
        <View style={{ position:"absolute", bottom:3, left:7, right:5, height:12,
          borderRadius:6, borderTopLeftRadius:2, borderTopRightRadius:2,
          backgroundColor:darkG, flexDirection:"row",
          justifyContent:"space-around", alignItems:"flex-start",
          paddingTop:1, paddingHorizontal:2 }}>
          {[0,1,2,3,4].map(i=>(
            <View key={i} style={{ width:5, height:i%2===0?9:6, borderRadius:1,
              borderBottomLeftRadius:4, borderBottomRightRadius:4,
              backgroundColor:c, opacity:i%2===0?1:0.7 }}/>
          ))}
        </View>
      </View>
      {/* DRIP POOL at base */}
      <View style={{ flexDirection:"row", gap:3, marginTop:-3 }}>
        {[{w:13,h:9},{w:8,h:14},{w:12,h:10},{w:6,h:8}].map((d,i)=>(
          <View key={i} style={{ width:d.w, height:d.h, borderRadius:999,
            backgroundColor:"#166534", borderWidth:1.5, borderColor:c+"52",
            marginTop:i%2===1?5:0 }}/>
        ))}
      </View>
    </Animated.View>
  );
}

/* HYPOXIA WRAITH — tall dark hooded figure with skeletal reaching hand, facing left */
function HypoxiaWraithSprite({ hitFlash, bobY }: SpriteProps) {
  const c = hitFlash ? "#fff" : "#c4b5fd";
  const purple = "#3b0764";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* GEM CARD */}
      <View style={{ position:"absolute", bottom:-2, width:52, height:30,
        borderRadius:8, borderBottomLeftRadius:26, borderBottomRightRadius:26,
        backgroundColor:purple, borderWidth:2, borderColor:"#1a0040" }}>
        <View style={{ position:"absolute", top:3, left:8, right:8, height:5,
          borderRadius:3, backgroundColor:"#a78bfa28" }}/>
      </View>
      {/* SHADOW MIST — base fog */}
      <View style={{ position:"absolute", bottom:12, left:-12, right:-12, height:24,
        borderRadius:14, backgroundColor:"#2e107055" }}/>
      {/* SKELETAL REACHING HAND — forward/left toward healers */}
      <View style={{ position:"absolute", top:22, left:-22, zIndex:5 }}>
        <View style={{ width:14, height:12, borderRadius:5,
          backgroundColor:"#e2e8f0", borderWidth:1.5, borderColor:"#94a3b8" }}/>
        {[{l:0,t:-11,h:12,r:-10},{l:4,t:-14,h:15,r:-3},
          {l:8,t:-14,h:15,r:4},{l:12,t:-11,h:12,r:12}].map((f,i)=>(
          <View key={i} style={{ position:"absolute", left:f.l, top:f.t,
            width:5, height:f.h, borderRadius:3,
            backgroundColor:"#e2e8f0", borderWidth:1, borderColor:"#94a3b8",
            transform:[{rotate:`${f.r}deg`}]}}/>
        ))}
      </View>
      {/* TATTERED CLOAK — tall, asymmetric silhouette */}
      <View style={{ width:42, height:62, borderRadius:10,
        borderTopLeftRadius:4, borderTopRightRadius:18,
        borderBottomLeftRadius:6, borderBottomRightRadius:14,
        backgroundColor:"#1a004090", borderWidth:2, borderColor:c+"80",
        alignItems:"center" }}>
        <LinearGradient colors={["#4c1d9560","#1a004090","#0d001a"]}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0,
            borderRadius:10 }}/>
        {/* Hood shadow area */}
        <View style={{ position:"absolute", top:0, left:0, right:0, height:28,
          borderTopLeftRadius:4, borderTopRightRadius:18,
          backgroundColor:"#0d001a80" }}/>
        {/* GLOWING EYES in hood — evil purple */}
        <View style={{ position:"absolute", top:12, flexDirection:"row", gap:12 }}>
          {[0,1].map(i=>(
            <View key={i} style={{ width:10, height:11, borderRadius:6,
              backgroundColor:"#7c3aed", alignItems:"center", justifyContent:"center" }}>
              <View style={{ width:4.5, height:4.5, borderRadius:2.5,
                backgroundColor:"#c4b5fd" }}/>
              <View style={{ position:"absolute", top:1, right:1, width:2.5, height:2.5,
                borderRadius:2, backgroundColor:"#fff" }}/>
            </View>
          ))}
        </View>
        {/* Interior seam */}
        <View style={{ position:"absolute", top:28, bottom:0, left:"48%", width:1.5,
          backgroundColor:c+"30" }}/>
      </View>
      {/* RAGGED TORN STRIPS at cloak bottom */}
      <View style={{ flexDirection:"row", gap:1, marginTop:-10 }}>
        {[{w:8,h:18,r:-12},{w:5,h:25,r:-4},{w:7,h:20,r:5},{w:5,h:15,r:14},{w:6,h:22,r:-6}].map((t,i)=>(
          <View key={i} style={{ width:t.w, height:t.h,
            borderRadius:3, borderBottomLeftRadius:999, borderBottomRightRadius:999,
            backgroundColor:"#1a004090", borderWidth:1, borderColor:c+"28",
            transform:[{rotate:`${t.r}deg`}]}}/>
        ))}
      </View>
      {/* Outer aura ring */}
      <View style={{ position:"absolute", top:0, width:54, height:54, borderRadius:27,
        borderWidth:1.5, borderColor:"#7c3aed28" }}/>
    </Animated.View>
  );
}

/* BRONCHOSPASM DRAKE — boss dragon, spread membraned wings, flame breath, facing left */
function BronchospasmDrakeSprite({ hitFlash, bobY }: SpriteProps) {
  const c    = hitFlash ? "#fff" : "#fb923c";
  const fill = hitFlash ? "#ea580c" : "#7c2d1222";
  const dark = "#431407";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* BOSS GEM CARD — larger */}
      <View style={{ position:"absolute", bottom:-2, width:80, height:44,
        borderRadius:10, borderBottomLeftRadius:40, borderBottomRightRadius:40,
        backgroundColor:"#7c2d12", borderWidth:2.5, borderColor:"#431407" }}>
        <View style={{ position:"absolute", top:5, left:14, right:14, height:7,
          borderRadius:4, backgroundColor:"#fbbf2430" }}/>
      </View>
      {/* Boss aura rings */}
      <View style={{ position:"absolute", top:6, width:88, height:88, borderRadius:44,
        borderWidth:2, borderColor:"#f9731620" }}/>
      <View style={{ position:"absolute", top:14, width:70, height:70, borderRadius:35,
        borderWidth:1.5, borderColor:"#f9731438" }}/>
      {/* LEFT MEMBRANED WING — large, swept back */}
      <View style={{ position:"absolute", top:16, left:-32, width:52, height:60,
        borderRadius:8, borderTopLeftRadius:44, borderTopRightRadius:4,
        backgroundColor:fill, borderWidth:2.5, borderColor:c+"80",
        transform:[{rotate:"-14deg"}]}}/>
      {/* Wing bone lines left */}
      <View style={{ position:"absolute", top:20, left:-24, width:34, height:2.5,
        borderRadius:1, backgroundColor:c+"58", transform:[{rotate:"-30deg"}]}}/>
      <View style={{ position:"absolute", top:29, left:-22, width:28, height:2,
        borderRadius:1, backgroundColor:c+"48", transform:[{rotate:"-20deg"}]}}/>
      <View style={{ position:"absolute", top:37, left:-20, width:22, height:1.5,
        borderRadius:1, backgroundColor:c+"38", transform:[{rotate:"-12deg"}]}}/>
      {/* RIGHT WING */}
      <View style={{ position:"absolute", top:16, right:-32, width:52, height:60,
        borderRadius:8, borderTopLeftRadius:4, borderTopRightRadius:44,
        backgroundColor:fill, borderWidth:2.5, borderColor:c+"80",
        transform:[{rotate:"14deg"}]}}/>
      <View style={{ position:"absolute", top:20, right:-24, width:34, height:2.5,
        borderRadius:1, backgroundColor:c+"58", transform:[{rotate:"30deg"}]}}/>
      <View style={{ position:"absolute", top:29, right:-22, width:28, height:2,
        borderRadius:1, backgroundColor:c+"48", transform:[{rotate:"20deg"}]}}/>
      {/* DUAL HORNS */}
      <View style={{ flexDirection:"row", gap:28, marginBottom:-9, zIndex:6 }}>
        {[-26,26].map((rot,i)=>(
          <View key={i} style={{ width:12, height:30, borderRadius:6,
            borderTopLeftRadius:2, borderTopRightRadius:2,
            backgroundColor:dark, borderWidth:2, borderColor:c+"80",
            transform:[{rotate:`${rot}deg`}]}}/>
        ))}
      </View>
      {/* DRAGON HEAD */}
      <View style={{ width:72, height:68, borderRadius:20,
        borderTopLeftRadius:30, borderTopRightRadius:30,
        backgroundColor:"#92330a", borderWidth:3, borderColor:c,
        alignItems:"center", justifyContent:"center", zIndex:5 }}>
        <LinearGradient colors={[c+"30","transparent"]}
          style={{ position:"absolute", top:0, left:0, right:0, height:30 }}/>
        {/* Scale texture rows */}
        {[18,30,44].map((t,i)=>(
          <View key={i} style={{ position:"absolute", top:t, left:"8%", right:"8%",
            height:1.5, backgroundColor:"#f9731428" }}/>
        ))}
        {/* SLIT-PUPIL FIERCE EYES */}
        <View style={{ flexDirection:"row", gap:18, marginTop:-12 }}>
          {[0,1].map(i=>(
            <View key={i} style={{ width:17, height:16, borderRadius:9,
              backgroundColor:dark, borderWidth:3, borderColor:"#fbbf24",
              alignItems:"center", justifyContent:"center" }}>
              <View style={{ width:8, height:8, borderRadius:4, backgroundColor:"#fbbf24" }}/>
              <View style={{ position:"absolute", width:3, height:12,
                borderRadius:2, backgroundColor:dark }}/>
              <View style={{ position:"absolute", top:2, right:2, width:4, height:4,
                borderRadius:2, backgroundColor:"#fff" }}/>
            </View>
          ))}
        </View>
        {/* JAW with 5 fangs */}
        <View style={{ width:44, height:20, borderRadius:8,
          borderTopLeftRadius:4, borderTopRightRadius:4,
          backgroundColor:dark, borderWidth:2.5, borderColor:c,
          marginTop:9, flexDirection:"row", justifyContent:"space-around",
          alignItems:"flex-start", paddingTop:2, paddingHorizontal:3 }}>
          {[0,1,2,3,4].map(i=>(
            <View key={i} style={{ width:5, height:i%2===0?13:8, borderRadius:1.5,
              borderBottomLeftRadius:4, borderBottomRightRadius:4,
              backgroundColor:"#fde68a", opacity:i%2===0?1:0.8 }}/>
          ))}
        </View>
        {/* Nostrils */}
        <View style={{ position:"absolute", top:37, left:18, width:7, height:5,
          borderRadius:4, backgroundColor:dark }}/>
        <View style={{ position:"absolute", top:37, right:18, width:7, height:5,
          borderRadius:4, backgroundColor:dark }}/>
      </View>
      {/* FLAME BREATH columns */}
      {!hitFlash && (
        <View style={{ flexDirection:"row", gap:2, marginTop:2, alignItems:"flex-end" }}>
          {[{h:9,col:"#f97316"},{h:18,col:"#fbbf24"},{h:12,col:"#ef4444"},
            {h:20,col:"#fde68a"},{h:12,col:"#f97316"},{h:17,col:"#fbbf24"},{h:8,col:"#f97316"}].map((fl,i)=>(
            <View key={i} style={{ width:8, height:fl.h, borderRadius:999,
              backgroundColor:fl.col+"82" }}/>
          ))}
        </View>
      )}
    </Animated.View>
  );
}


function EnemySprite({ typeId, hitFlash, bobY }: { typeId: string; hitFlash: boolean; bobY: Animated.AnimatedInterpolation<number> }) {
  switch (typeId) {
    case "breathless_wisp":    return <BreathlessWispSprite hitFlash={hitFlash} bobY={bobY} />;
    case "wheeze_sprite":      return <WheezeSpriteSprite   hitFlash={hitFlash} bobY={bobY} />;
    case "mucus_slime":        return <MucusSlimeSprite     hitFlash={hitFlash} bobY={bobY} />;
    case "hypoxia_wraith":     return <HypoxiaWraithSprite  hitFlash={hitFlash} bobY={bobY} />;
    case "bronchospasm_drake": return <BronchospasmDrakeSprite hitFlash={hitFlash} bobY={bobY} />;
    default: return <View style={{ width: 34, height: 44, borderRadius: 8, backgroundColor: "#334155" }} />;
  }
}

/* ─── UNIT SPRITES ───────────────────────────────────────────────────────────
   Design principles — what makes these CHARACTERS not ICONS:
   • Visible legs + shoes at bottom — grounds them as characters
   • 3/4 right-facing pose — asymmetric: left eye smaller, right eye main
   • Hair extends BEYOND head circle — distinctive non-circular silhouette
   • Front arm extended, holding actual prop (stethoscope disc / staff / mask)
   • Back arm behind body, partially visible
   • Costume details: lapels, buttons, belt, pockets — layered depth
   ─────────────────────────────────────────────────────────────────────────── */

/* WARD SCOUT — Blue nurse, 3/4 right-facing, white A-line coat, stethoscope */
function WardScoutSprite({ castFlash }: { castFlash: boolean }) {
  const trim = castFlash ? "#2563eb" : "#3b82f6";
  const coat = castFlash ? "#bfdbfe" : "#f0f9ff";
  const skin = "#fde8c8";
  const hair = "#1c3557";
  return (
    <View style={{ width:52, height:68, position:"relative" }}>
      {/* GEM CARD */}
      <View style={{ position:"absolute", bottom:0, left:2, right:2, height:32,
        borderRadius:8, borderBottomLeftRadius:30, borderBottomRightRadius:30,
        backgroundColor:"#1e3a8a", borderWidth:2, borderColor:"#0f172a" }}>
        <View style={{ position:"absolute", top:4, left:8, right:8, height:5,
          borderRadius:3, backgroundColor:"#60a5fa28" }}/>
      </View>
      {/* LEGS — dark trousers */}
      <View style={{ position:"absolute", bottom:8, left:13, width:9, height:18,
        borderRadius:4, backgroundColor:"#334155", borderWidth:1.5, borderColor:"#1e293b" }}/>
      <View style={{ position:"absolute", bottom:8, left:23, width:9, height:15,
        borderRadius:4, backgroundColor:"#334155", borderWidth:1.5, borderColor:"#1e293b",
        transform:[{rotate:"-8deg"}]}}/>
      {/* Shoes — white, pointed right */}
      <View style={{ position:"absolute", bottom:2, left:9, width:15, height:7,
        borderRadius:4, backgroundColor:coat, borderWidth:2, borderColor:trim }}/>
      <View style={{ position:"absolute", bottom:1, left:19, width:16, height:7,
        borderRadius:4, backgroundColor:coat, borderWidth:2, borderColor:trim,
        transform:[{rotate:"-5deg"}]}}/>
      {/* BACK ARM */}
      <View style={{ position:"absolute", top:28, left:2, width:10, height:22,
        borderRadius:5, backgroundColor:coat, borderWidth:1.5, borderColor:trim,
        transform:[{rotate:"-28deg"}]}}/>
      {/* COAT BODY — A-line, wider at hem */}
      <View style={{ position:"absolute", top:26, left:5, width:38, height:36,
        borderRadius:8, borderTopLeftRadius:16, borderTopRightRadius:6,
        backgroundColor:coat, borderWidth:2, borderColor:trim }}>
        {/* Left lapel */}
        <View style={{ position:"absolute", top:0, left:4, width:10, height:18,
          borderRadius:4, borderTopLeftRadius:10, backgroundColor:trim+"45" }}/>
        {/* Right side trim */}
        <View style={{ position:"absolute", top:0, right:0, bottom:0, width:7,
          borderTopRightRadius:5, borderBottomRightRadius:7, backgroundColor:trim+"28" }}/>
        {/* Buttons */}
        {[9,17,25].map((t,i)=>(
          <View key={i} style={{ position:"absolute", top:t, left:21, width:5, height:5,
            borderRadius:3, backgroundColor:trim, borderWidth:1, borderColor:"#1d4ed8" }}/>
        ))}
        {/* Belt line */}
        <View style={{ position:"absolute", top:20, left:0, right:0, height:3,
          backgroundColor:trim+"70" }}/>
        {/* Breast pocket */}
        <View style={{ position:"absolute", bottom:5, left:5, width:11, height:9,
          borderRadius:4, borderWidth:1.5, borderColor:trim+"70" }}/>
      </View>
      {/* FRONT ARM — reaching right, stethoscope */}
      <View style={{ position:"absolute", top:28, right:2, width:11, height:24,
        borderRadius:6, backgroundColor:coat, borderWidth:2, borderColor:trim,
        transform:[{rotate:"28deg"}]}}/>
      {/* Stethoscope disc at arm end */}
      <View style={{ position:"absolute", top:50, right:-4, width:14, height:14,
        borderRadius:7, backgroundColor:"#94a3b8", borderWidth:2.5, borderColor:"#475569",
        alignItems:"center", justifyContent:"center" }}>
        <View style={{ width:6, height:6, borderRadius:3, backgroundColor:"#0f172a" }}/>
        <View style={{ position:"absolute", top:1.5, right:1.5, width:3, height:3,
          borderRadius:2, backgroundColor:"#e2e8f0" }}/>
      </View>
      {/* NECK */}
      <View style={{ position:"absolute", top:22, left:19, width:11, height:8,
        backgroundColor:skin, borderWidth:1, borderColor:"#e9a84c" }}/>
      {/* HEAD — right of center for 3/4 view */}
      <View style={{ position:"absolute", top:0, left:11, width:32, height:28,
        borderRadius:14, backgroundColor:skin, borderWidth:2, borderColor:"#e9a84c" }}>
        {/* HAIR back layer */}
        <View style={{ position:"absolute", top:-10, left:-3, width:38, height:18,
          borderRadius:999, backgroundColor:hair }}/>
        {/* Hair left side */}
        <View style={{ position:"absolute", top:2, left:-6, width:9, height:20,
          borderRadius:5, backgroundColor:hair }}/>
        {/* Hair front strand */}
        <View style={{ position:"absolute", top:-6, right:3, width:7, height:14,
          borderRadius:4, backgroundColor:hair }}/>
        {/* NURSE CAP — tilted slightly */}
        <View style={{ position:"absolute", top:-5, left:7, width:22, height:10,
          borderRadius:5, borderBottomLeftRadius:0, borderBottomRightRadius:0,
          backgroundColor:"#f0f9ff", borderWidth:2, borderColor:trim }}>
          <View style={{ position:"absolute", left:6, top:2, width:9, height:2.5,
            backgroundColor:"#ef4444" }}/>
          <View style={{ position:"absolute", left:9, top:-2, width:2.5, height:7,
            backgroundColor:"#ef4444" }}/>
        </View>
        {/* Blush — right cheek (3/4 view) */}
        <View style={{ position:"absolute", top:16, right:2, width:8, height:5,
          borderRadius:4, backgroundColor:"#fca5a568" }}/>
        {/* Left eye — SMALLER (3/4 partial view) */}
        <View style={{ position:"absolute", top:10, left:4, width:5, height:7,
          borderRadius:3, backgroundColor:"#1e3a5f" }}>
          <View style={{ position:"absolute", top:1, right:1, width:2, height:2,
            borderRadius:1, backgroundColor:"#fff" }}/>
        </View>
        {/* Right eye — MAIN large eye */}
        <View style={{ position:"absolute", top:9, right:4, width:9, height:10,
          borderRadius:5, backgroundColor:"#1e3a5f" }}>
          <View style={{ width:5, height:5, borderRadius:2.5, backgroundColor:"#60a5fa",
            marginTop:2, marginLeft:2 }}/>
          <View style={{ position:"absolute", top:1.5, right:1.5, width:3.5, height:3.5,
            borderRadius:2, backgroundColor:"#fff" }}/>
        </View>
        {/* Nose */}
        <View style={{ position:"absolute", top:17, right:10, width:3, height:2,
          borderRadius:2, backgroundColor:"#e9a84c70" }}/>
        {/* Smile */}
        <View style={{ position:"absolute", bottom:4, right:3, width:10, height:4,
          borderRadius:3, borderBottomWidth:2.5, borderColor:"#c2410c" }}/>
      </View>
      {castFlash && (
        <View style={{ position:"absolute", top:-2, left:-2, right:-2, bottom:-2,
          borderRadius:14, borderWidth:2.5, borderColor:`${trim}80` }}/>
      )}
    </View>
  );
}

/* MIST CASTER — Amber alchemist mage, tall hat, flowing robe, staff with orb */
function MistCasterSprite({ castFlash }: { castFlash: boolean }) {
  const accent = castFlash ? "#fde68a" : "#f59e0b";
  const robe   = castFlash ? "#4c1d95" : "#1e1b4b";
  const skin   = "#fde8c8";
  const hair   = "#0f172a";
  return (
    <View style={{ width:52, height:74, position:"relative" }}>
      {/* GEM CARD */}
      <View style={{ position:"absolute", bottom:0, left:2, right:2, height:32,
        borderRadius:8, borderBottomLeftRadius:30, borderBottomRightRadius:30,
        backgroundColor:"#451a03", borderWidth:2, borderColor:"#1c0a00" }}>
        <View style={{ position:"absolute", top:4, left:8, right:8, height:5,
          borderRadius:3, backgroundColor:"#f59e0b28" }}/>
      </View>
      {/* STAFF — tall, extends above sprite on right */}
      <View style={{ position:"absolute", top:-12, right:7, width:6, height:86,
        borderRadius:3, backgroundColor:"#44260a", borderWidth:1.5, borderColor:accent+"80" }}>
        {/* Orb at top */}
        <View style={{ position:"absolute", top:-13, left:-10, width:26, height:26,
          borderRadius:13, borderWidth:3, borderColor:accent,
          backgroundColor:castFlash ? "#fde68a" : accent+"45",
          alignItems:"center", justifyContent:"center" }}>
          <View style={{ width:10, height:10, borderRadius:5,
            backgroundColor:castFlash ? "#fff" : accent }}/>
          <View style={{ position:"absolute", top:3, left:3, width:5, height:5,
            borderRadius:3, backgroundColor:"#ffffff50" }}/>
        </View>
        {/* Staff binding bands */}
        {[22,38,54].map((t,i)=>(
          <View key={i} style={{ position:"absolute", top:t, left:-2, right:-2, height:4,
            borderRadius:2, backgroundColor:accent+"65" }}/>
        ))}
      </View>
      {/* Small FEET peeking under robe hem */}
      <View style={{ position:"absolute", bottom:6, left:10, width:13, height:7,
        borderRadius:4, borderTopLeftRadius:0, backgroundColor:"#0f172a" }}/>
      <View style={{ position:"absolute", bottom:6, left:22, width:11, height:6,
        borderRadius:4, borderTopLeftRadius:0, backgroundColor:"#0f172a" }}/>
      {/* ROBE BODY — wide hem, tapered waist */}
      <View style={{ position:"absolute", top:30, left:4, width:34, height:44,
        borderRadius:10, borderTopLeftRadius:14, borderTopRightRadius:6,
        backgroundColor:robe, borderWidth:2, borderColor:accent+"70" }}>
        {/* Amber hem trim */}
        <View style={{ position:"absolute", bottom:0, left:0, right:0, height:7,
          borderBottomLeftRadius:9, borderBottomRightRadius:9,
          backgroundColor:accent+"45" }}/>
        {/* Waist sash */}
        <View style={{ position:"absolute", top:16, left:0, right:0, height:4,
          backgroundColor:accent+"65" }}/>
        {/* Robe fold lines */}
        <View style={{ position:"absolute", top:12, left:8, width:1.5, height:24,
          backgroundColor:accent+"25" }}/>
        <View style={{ position:"absolute", top:8, right:8, width:1.5, height:28,
          backgroundColor:accent+"20" }}/>
        {/* Gem clasp at collar */}
        <View style={{ position:"absolute", top:2, left:10, width:9, height:9,
          borderRadius:2, backgroundColor:accent+"90",
          transform:[{rotate:"45deg"}]}}/>
      </View>
      {/* LEFT SLEEVE — raised in casting pose */}
      <View style={{ position:"absolute", top:28, left:-6, width:18, height:30,
        borderRadius:9, borderTopLeftRadius:12,
        backgroundColor:robe, borderWidth:2, borderColor:accent+"70",
        transform:[{rotate:"-16deg"}]}}/>
      {/* Left hand casting glow */}
      <View style={{ position:"absolute", top:14, left:-4, width:16, height:16,
        borderRadius:8, backgroundColor:accent+"58", borderWidth:2, borderColor:accent }}/>
      {/* RIGHT SLEEVE */}
      <View style={{ position:"absolute", top:30, right:16, width:13, height:26,
        borderRadius:7, borderTopRightRadius:10,
        backgroundColor:robe, borderWidth:2, borderColor:accent+"65",
        transform:[{rotate:"10deg"}]}}/>
      {/* NECK */}
      <View style={{ position:"absolute", top:26, left:17, width:10, height:8,
        backgroundColor:skin, borderWidth:1, borderColor:"#e9a84c" }}/>
      {/* HEAD */}
      <View style={{ position:"absolute", top:2, left:10, width:28, height:26,
        borderRadius:13, backgroundColor:skin, borderWidth:2, borderColor:"#e9a84c" }}>
        {/* Hair — dark, framing face */}
        <View style={{ position:"absolute", top:-8, left:-2, width:32, height:16,
          borderRadius:999, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:0, left:-5, width:8, height:22,
          borderRadius:4, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:-4, right:-1, width:6, height:16,
          borderRadius:3, backgroundColor:hair }}/>
        {/* TALL POINTED HAT tip */}
        <View style={{ position:"absolute", top:-22, left:9, width:8, height:18,
          borderRadius:4, borderTopLeftRadius:1, borderTopRightRadius:1,
          backgroundColor:hair, borderWidth:1.5, borderColor:accent+"65",
          transform:[{rotate:"-5deg"}]}}/>
        {/* Hat brim */}
        <View style={{ position:"absolute", top:-8, left:0, width:28, height:9,
          borderRadius:5, borderBottomLeftRadius:2, borderBottomRightRadius:2,
          backgroundColor:hair, borderWidth:1.5, borderColor:accent+"65" }}>
          <View style={{ position:"absolute", bottom:0, left:0, right:0, height:3,
            backgroundColor:accent+"82" }}/>
          <View style={{ position:"absolute", bottom:0, left:6, width:5, height:5,
            borderRadius:1, backgroundColor:accent, transform:[{rotate:"45deg"}]}}/>
        </View>
        {/* Blush */}
        <View style={{ position:"absolute", top:14, right:2, width:7, height:4,
          borderRadius:4, backgroundColor:"#fca5a560" }}/>
        {/* Left eye — smaller (3/4) */}
        <View style={{ position:"absolute", top:10, left:3, width:5, height:6,
          borderRadius:3, backgroundColor:"#0f172a" }}>
          <View style={{ position:"absolute", top:1, right:1, width:2, height:2,
            borderRadius:1, backgroundColor:"#fff" }}/>
        </View>
        {/* Right eye — main */}
        <View style={{ position:"absolute", top:9, right:3, width:9, height:10,
          borderRadius:5, backgroundColor:"#0f172a" }}>
          <View style={{ width:5, height:5, borderRadius:2.5, backgroundColor:accent,
            marginTop:2, marginLeft:2 }}/>
          <View style={{ position:"absolute", top:1.5, right:1.5, width:3.5, height:3.5,
            borderRadius:2, backgroundColor:"#fff" }}/>
        </View>
        {/* Mouth */}
        <View style={{ position:"absolute", bottom:4, right:3, width:9, height:4,
          borderRadius:2, borderBottomWidth:2, borderColor:"#92400e" }}/>
      </View>
      {castFlash && (
        <View style={{ position:"absolute", top:-4, left:-4, right:-4, bottom:-4,
          borderRadius:14, borderWidth:2, borderColor:`${accent}70` }}/>
      )}
    </View>
  );
}

/* O2 HEALER — Green RT, stocky build, O₂ tank on back, mask in hand */
function O2HealerSprite({ castFlash }: { castFlash: boolean }) {
  const accent = castFlash ? "#6ee7b7" : "#34d399";
  const vest   = castFlash ? "#065f46" : "#064e3b";
  const skin   = "#fde8c8";
  const hair   = "#1f2937";
  return (
    <View style={{ width:52, height:66, position:"relative" }}>
      {/* GEM CARD */}
      <View style={{ position:"absolute", bottom:0, left:2, right:2, height:32,
        borderRadius:8, borderBottomLeftRadius:30, borderBottomRightRadius:30,
        backgroundColor:"#064e3b", borderWidth:2, borderColor:"#022c22" }}>
        <View style={{ position:"absolute", top:4, left:8, right:8, height:5,
          borderRadius:3, backgroundColor:"#34d39928" }}/>
      </View>
      {/* O₂ TANK — strapped to left/back side, clearly cylindrical */}
      <View style={{ position:"absolute", top:22, left:-5, width:14, height:34,
        borderRadius:7, backgroundColor:"#1e293b", borderWidth:2, borderColor:accent }}>
        <View style={{ position:"absolute", top:-5, left:1, width:12, height:7,
          borderRadius:3, backgroundColor:"#334155" }}/>
        <Text style={{ position:"absolute", top:8, left:0, right:0, textAlign:"center",
          color:accent, fontSize:7, fontWeight:"800" }}>O₂</Text>
        {/* Gauge window */}
        <View style={{ position:"absolute", bottom:3, left:1, right:1, height:9,
          borderRadius:5, backgroundColor:"#0f172a",
          borderWidth:1, borderColor:accent+"65",
          justifyContent:"center", alignItems:"center" }}>
          <View style={{ width:5, height:5, borderRadius:3,
            borderWidth:1.5, borderColor:accent+"80" }}/>
        </View>
      </View>
      {/* Tank shoulder strap */}
      <View style={{ position:"absolute", top:26, left:9, width:2, height:14,
        borderRadius:1, backgroundColor:accent+"70" }}/>
      {/* LEGS — dark cargo pants */}
      <View style={{ position:"absolute", bottom:8, left:14, width:10, height:16,
        borderRadius:4, backgroundColor:"#1e293b", borderWidth:1.5, borderColor:"#0f172a" }}/>
      <View style={{ position:"absolute", bottom:8, left:25, width:10, height:14,
        borderRadius:4, backgroundColor:"#1e293b", borderWidth:1.5, borderColor:"#0f172a",
        transform:[{rotate:"-8deg"}]}}/>
      {/* Boots */}
      <View style={{ position:"absolute", bottom:1, left:10, width:17, height:8,
        borderRadius:4, backgroundColor:"#374151", borderWidth:2, borderColor:"#1f2937" }}/>
      <View style={{ position:"absolute", bottom:1, left:22, width:16, height:7,
        borderRadius:4, backgroundColor:"#374151", borderWidth:2, borderColor:"#1f2937",
        transform:[{rotate:"-5deg"}]}}/>
      {/* BACK ARM */}
      <View style={{ position:"absolute", top:26, left:8, width:10, height:22,
        borderRadius:5, backgroundColor:vest, borderWidth:1.5, borderColor:accent,
        transform:[{rotate:"-22deg"}]}}/>
      {/* VEST BODY — stocky, wide-shouldered */}
      <View style={{ position:"absolute", top:22, left:9, width:35, height:34,
        borderRadius:8, borderTopLeftRadius:16, borderTopRightRadius:8,
        backgroundColor:vest, borderWidth:2, borderColor:accent }}>
        {/* Chest pocket */}
        <View style={{ position:"absolute", top:5, left:3, width:12, height:9,
          borderRadius:3, borderWidth:1.5, borderColor:accent+"70" }}>
          <Text style={{ color:accent, fontSize:5.5, fontWeight:"800", textAlign:"center" }}>O₂</Text>
        </View>
        {/* Right pocket */}
        <View style={{ position:"absolute", bottom:5, right:3, width:9, height:8,
          borderRadius:3, borderWidth:1.5, borderColor:accent+"70" }}/>
        {/* Center zipper stripe */}
        <View style={{ position:"absolute", top:0, bottom:0, left:"47%", width:2,
          backgroundColor:accent+"42" }}/>
        {/* Shoulder patch */}
        <View style={{ position:"absolute", top:3, right:3, width:10, height:5,
          borderRadius:2, backgroundColor:accent+"42", borderWidth:1, borderColor:accent }}/>
      </View>
      {/* FRONT ARM — reaching out, holding O₂ mask */}
      <View style={{ position:"absolute", top:24, right:1, width:11, height:24,
        borderRadius:6, backgroundColor:vest, borderWidth:2, borderColor:accent,
        transform:[{rotate:"32deg"}]}}/>
      {/* O₂ MASK in hand */}
      <View style={{ position:"absolute", top:44, right:-8, width:18, height:13,
        borderRadius:5, backgroundColor:accent+"88", borderWidth:2.5, borderColor:accent,
        alignItems:"center", justifyContent:"center" }}>
        <View style={{ width:9, height:4, borderRadius:2,
          backgroundColor:"#065f46", borderWidth:1, borderColor:accent }}/>
        <View style={{ position:"absolute", right:-4, top:3, width:5, height:2,
          borderRadius:1, backgroundColor:accent+"70" }}/>
      </View>
      {/* Hose from mask back toward tank */}
      <View style={{ position:"absolute", top:30, left:12, width:2, height:18,
        borderRadius:1, backgroundColor:accent+"62", transform:[{rotate:"22deg"}]}}/>
      {/* NECK */}
      <View style={{ position:"absolute", top:18, left:20, width:12, height:7,
        backgroundColor:skin, borderWidth:1, borderColor:"#e9a84c" }}/>
      {/* HEAD — wider chibi, stocky proportions */}
      <View style={{ position:"absolute", top:0, left:10, width:32, height:26,
        borderRadius:13, backgroundColor:skin, borderWidth:2, borderColor:"#e9a84c" }}>
        {/* Hair */}
        <View style={{ position:"absolute", top:-8, left:-2, width:36, height:16,
          borderRadius:999, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:2, left:-5, width:8, height:18,
          borderRadius:4, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:-4, right:0, width:8, height:12,
          borderRadius:4, backgroundColor:hair }}/>
        {/* GREEN MEDICAL HEADBAND */}
        <View style={{ position:"absolute", top:-2, left:0, right:0, height:8,
          borderRadius:4, borderBottomLeftRadius:0, borderBottomRightRadius:0,
          backgroundColor:vest, borderWidth:2, borderColor:accent }}>
          <View style={{ position:"absolute", right:5, top:1.5, width:11, height:5,
            borderRadius:2, borderWidth:1, borderColor:accent+"80" }}/>
        </View>
        {/* O₂ mask pushed up on forehead */}
        <View style={{ position:"absolute", top:4, left:3, width:16, height:5,
          borderRadius:3, backgroundColor:accent+"70", borderWidth:1.5, borderColor:accent }}/>
        {/* Blush */}
        <View style={{ position:"absolute", top:15, right:2, width:8, height:4,
          borderRadius:4, backgroundColor:"#fca5a560" }}/>
        {/* Left eye — smaller (3/4) */}
        <View style={{ position:"absolute", top:10, left:4, width:6, height:7,
          borderRadius:3, backgroundColor:"#0f172a" }}>
          <View style={{ position:"absolute", top:1, right:1, width:2, height:2,
            borderRadius:1, backgroundColor:"#fff" }}/>
        </View>
        {/* Right eye — main */}
        <View style={{ position:"absolute", top:9, right:4, width:9, height:10,
          borderRadius:5, backgroundColor:"#0f172a" }}>
          <View style={{ width:5, height:5, borderRadius:2.5, backgroundColor:accent,
            marginTop:2, marginLeft:2 }}/>
          <View style={{ position:"absolute", top:1.5, right:1.5, width:3.5, height:3.5,
            borderRadius:2, backgroundColor:"#fff" }}/>
        </View>
        {/* Determined mouth */}
        <View style={{ position:"absolute", bottom:4, right:3, width:10, height:3,
          borderRadius:1.5, backgroundColor:"#b45309" }}/>
      </View>
      {castFlash && (
        <View style={{ position:"absolute", top:-4, left:-4, right:-4, bottom:-4,
          borderRadius:16, borderWidth:2.5, borderColor:`${accent}70` }}/>
      )}
    </View>
  );
}

function UnitSprite({ typeId, castFlash, level = 1 }: { typeId: string; castFlash: boolean; level?: number }) {
  let sprite: React.ReactElement;
  switch (typeId) {
    case "ward_scout":  sprite = <WardScoutSprite castFlash={castFlash} />; break;
    case "mist_caster": sprite = <MistCasterSprite castFlash={castFlash} />; break;
    case "o2_healer":   sprite = <O2HealerSprite castFlash={castFlash} />; break;
    default: return <View style={{ width: 22, height: 28, borderRadius: 6, backgroundColor: "#334155" }} />;
  }
  return (
    <View style={{ alignItems: "center" }}>
      {/* Level 3: gold crown accent */}
      {level >= 3 && (
        <View style={{ position: "absolute", top: -2, flexDirection: "row", gap: 3, zIndex: 10 }}>
          {[0,1,2].map(i => (
            <View key={i} style={{ width: 3.5, height: i === 1 ? 6 : 4, borderRadius: 2,
              backgroundColor: "#FFD700", opacity: 0.9 }} />
          ))}
        </View>
      )}
      {sprite}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BOARD ENTITY RENDERERS
   ═══════════════════════════════════════════════════════════════════ */
function EnemyOnPath({
  enemy, bobY, aw, ah,
}: { enemy: ActiveEnemy; bobY: Animated.AnimatedInterpolation<number>; aw: number; ah: number }) {
  const def = ENEMY_DATA[enemy.typeId];
  const fpos = getEnemyPosFrac(enemy);
  const px = fpos.x * aw, py = fpos.y * ah;
  const isBoss = !!def.isBoss;
  const spriteScale = isBoss ? 0.82 : 0.68;
  const hpPct = Math.round((enemy.hp / enemy.maxHp) * 100);
  const HP_BAR_W = isBoss ? 54 : 36;

  return (
    <View style={{
      position: "absolute",
      left: px - (isBoss ? 30 : 20),
      top: py - (isBoss ? 46 : 34),
      alignItems: "center", zIndex: 8,
    }}>
      {/* Clue badge — NCLEX cue recognition */}
      <View style={{
        backgroundColor: def.color + "22", borderWidth: 1,
        borderColor: def.color + "70", borderRadius: 4,
        paddingHorizontal: 4, paddingVertical: 1.5, marginBottom: 1.5,
      }}>
        <Text style={{ color: def.color, fontSize: 6.5, fontWeight: "700", letterSpacing: 0.4 }}>
          {def.clue}
        </Text>
      </View>
      {/* Boss HP counter */}
      {isBoss && (
        <Text style={{ color: def.color, fontSize: 8, fontWeight: "700",
          marginBottom: 1, textShadowColor: "#000", textShadowRadius: 2 }}>
          {enemy.hp}
        </Text>
      )}
      {/* Enemy sprite (scaled for board) */}
      <View style={{ transform: [{ scale: spriteScale }] }}>
        <EnemySprite typeId={enemy.typeId} hitFlash={enemy.hitFlash > 0} bobY={bobY} />
      </View>
      {/* HP bar */}
      <View style={{ width: HP_BAR_W, height: 4, borderRadius: 2, backgroundColor: "#0a1428",
        marginTop: 2, overflow: "hidden" }}>
        <View style={{ width: `${hpPct}%` as any, height: "100%", borderRadius: 2, backgroundColor: def.color }} />
      </View>
      {/* Ground shadow — anchors enemy visually on the board surface */}
      <View style={{
        width: isBoss ? 46 : 28, height: 5, borderRadius: 3,
        backgroundColor: "#000000aa", marginTop: 1,
      }} />
      {/* Slow indicator */}
      {enemy.slowTicks > 0 && (
        <View style={{ position: "absolute", top: -4, right: -8,
          backgroundColor: "#A78BFA22", borderRadius: 4, paddingHorizontal: 3 }}>
          <Text style={{ color: "#A78BFA", fontSize: 6 }}>↓</Text>
        </View>
      )}
    </View>
  );
}

function DeploymentTileView({
  tileIdx, unit, selectedUnit, canAfford, isMergeCandidate, onPress, aw, ah,
}: {
  tileIdx: number; unit: DeployedUnit | undefined;
  selectedUnit: string; canAfford: boolean;
  isMergeCandidate?: boolean;
  onPress: () => void; aw: number; ah: number;
}) {
  const [fx, fy] = DEPLOY_TILES[tileIdx];
  const px = fx * aw, py = fy * ah;
  const selColor = UNIT_DATA[selectedUnit]?.color ?? "#60A5FA";
  const isOccupied = !!unit;
  const unitColor = isOccupied ? UNIT_DATA[unit!.typeId].color : selColor;
  const isZoneA = tileIdx < 3;
  const isFirstInZone = tileIdx === 0 || tileIdx === 3;
  const cornerColor = isOccupied ? unitColor : canAfford ? selColor : "#2a4a6a";

  return (
    <>
      {/* Zone label — first tile of each zone only */}
      {isFirstInZone && (
        <View style={{
          position: "absolute",
          left: px - TILE_SIZE / 2, top: py - TILE_SIZE / 2 - 13,
          zIndex: 5,
        }}>
          <Text style={{ color: "#2a5888", fontSize: 6.5, fontWeight: "700", letterSpacing: 1.5 }}>
            {isZoneA ? "ZONE A" : "ZONE B"}
          </Text>
        </View>
      )}

      {/* The tile cell */}
      <Pressable
        style={{
          position: "absolute",
          left: px - TILE_SIZE / 2, top: py - TILE_SIZE / 2,
          width: TILE_SIZE, height: TILE_SIZE,
          borderRadius: 7,
          backgroundColor: isOccupied
            ? unitColor + "22"
            : canAfford
              ? "#0d1e36"
              : "#080e1c",
          borderWidth: isOccupied ? 2 : 1.5,
          borderColor: isOccupied
            ? unitColor + "99"
            : canAfford
              ? selColor + "77"
              : "#1e3a5a",
          alignItems: "center", justifyContent: "center", zIndex: 4,
        }}
        onPress={onPress}
      >
        {/* Corner accent markers — makes it read as a distinct board cell */}
        {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([dy, dx], i) => (
          <View key={i} style={{
            position: "absolute",
            top:    dy < 0 ? 3 : undefined,
            bottom: dy > 0 ? 3 : undefined,
            left:   dx < 0 ? 3 : undefined,
            right:  dx > 0 ? 3 : undefined,
            width: 5, height: 5, borderRadius: 1.5,
            backgroundColor: cornerColor,
            opacity: isOccupied ? 0.6 : canAfford ? 0.55 : 0.25,
          }} />
        ))}

        {isOccupied ? (
          <>
            {/* Merge candidate golden pulse ring */}
            {isMergeCandidate && (
              <View style={{ position: "absolute", top: -4, left: -4, right: -4, bottom: -4,
                borderRadius: 11, borderWidth: 2, borderColor: "#FFD70088" }} />
            )}
            {/* Merge flash golden fill */}
            {(unit!.mergeFlash ?? 0) > 0 && (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                borderRadius: 7, backgroundColor: "#FFD70018" }} />
            )}
            {/* Level badge top-left */}
            {(unit!.level ?? 1) > 1 && (
              <View style={{ position: "absolute", top: 3, left: 3, borderRadius: 3,
                backgroundColor: (unit!.level ?? 1) >= 3 ? "#FFD700" : "#a78bfa",
                paddingHorizontal: 3, paddingVertical: 1 }}>
                <Text style={{ color: "#0a0a1a", fontSize: 5, fontWeight: "800" }}>
                  Lv.{unit!.level}
                </Text>
              </View>
            )}
            {/* Category badge top-right */}
            <View style={{ position: "absolute", top: 3, right: 3,
              backgroundColor: unitColor + "35", borderRadius: 3, paddingHorizontal: 3 }}>
              <Text style={{ color: unitColor, fontSize: 5.5, fontWeight: "700" }}>
                {UNIT_DATA[unit!.typeId].category.slice(0, 3)}
              </Text>
            </View>
            {/* Drop shadow beneath sprite — grounds unit on tile */}
            <View style={{ position: "absolute", bottom: 5, width: TILE_SIZE - 16, height: 5,
              borderRadius: 3, backgroundColor: "#00000070" }} />
            <UnitSprite typeId={unit!.typeId} castFlash={unit!.castFlash > 0} level={unit!.level ?? 1} />
            {/* Attack range ring */}
            <View style={{ position: "absolute",
              width: UNIT_DATA[unit!.typeId].range * 2 * aw,
              height: UNIT_DATA[unit!.typeId].range * 2 * aw,
              borderRadius: UNIT_DATA[unit!.typeId].range * aw,
              borderWidth: 1, borderColor: unitColor + "18",
              backgroundColor: unitColor + "04", zIndex: -1 }} />
          </>
        ) : (
          /* Empty tile: rune cross + tap hint */
          <View style={{ alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 13, height: 3, borderRadius: 2,
              backgroundColor: canAfford ? selColor + "60" : "#1e3a5a" }} />
            <View style={{ position: "absolute", width: 3, height: 13, borderRadius: 2,
              backgroundColor: canAfford ? selColor + "60" : "#1e3a5a" }} />
            {canAfford && (
              <View style={{ position: "absolute", width: 26, height: 26, borderRadius: 13,
                borderWidth: 1, borderColor: selColor + "22" }} />
            )}
          </View>
        )}
      </Pressable>
    </>
  );
}

function ProjectileView({
  p, aw, ah,
}: { p: Projectile; aw: number; ah: number }) {
  const cx = lp(p.fromFx, p.toFx, p.progress) * aw;
  const cy = lp(p.fromFy, p.toFy, p.progress) * ah;
  return (
    <View style={{
      position: "absolute",
      left: cx - 7, top: cy - 7,
      width: 14, height: 14, borderRadius: 7,
      backgroundColor: p.color + "55",
      borderWidth: 1.5, borderColor: p.color,
      alignItems: "center", justifyContent: "center",
      zIndex: 10,
    }}>
      {/* Bright core */}
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#ffffff" }} />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HAND PANEL — Deploy units + use abilities
   ═══════════════════════════════════════════════════════════════════ */
function HandPanel({
  mode, setMode, selectedUnit, onSelectUnit, onUseAbility, ap, isPlaying,
  hasMerge, onSynthesize,
}: {
  mode: "deploy" | "abilities";
  setMode: (m: "deploy" | "abilities") => void;
  selectedUnit: string;
  onSelectUnit: (typeId: string) => void;
  onUseAbility: (id: string) => void;
  ap: number;
  isPlaying: boolean;
  hasMerge: boolean;
  onSynthesize: () => void;
}) {
  return (
    <View style={s.handArea}>
      {/* Tabs */}
      <View style={s.handTabs}>
        {(["deploy", "abilities"] as const).map(m => (
          <Pressable key={m} style={[s.handTabBtn, mode === m && s.handTabActive]} onPress={() => setMode(m)}>
            <Text style={[s.handTabTxt, { color: mode === m ? COLORS.air : COLORS.onSurfaceTertiary }]}>
              {m === "deploy" ? "⚔ DEPLOY" : "⚡ ABILITIES"}
            </Text>
          </Pressable>
        ))}
        {/* AP display */}
        <View style={s.handApBadge}>
          <Text style={s.handApTxt}>{ap}</Text>
          <Text style={s.handApLabel}>AP</Text>
        </View>
      </View>

      {/* Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.handCards}>
        {mode === "deploy" ? (
          <>
            {/* Synthesize card — shown when a merge pair exists */}
            {hasMerge && (
              <Pressable onPress={onSynthesize}
                style={[s.unitCard, { borderColor: "#FFD700", backgroundColor: "#1a1000",
                  borderWidth: 2, justifyContent: "center", alignItems: "center" }]}>
                <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2,
                  borderColor: "#FFD700", backgroundColor: "#FFD70020",
                  alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                  {[0,1,2].map(i=>(
                    <View key={i} style={{ position: "absolute", width: 3, height: i===1?10:7,
                      borderRadius: 2, backgroundColor: "#FFD700",
                      transform: [{ rotate: `${i*60}deg` }] }} />
                  ))}
                </View>
                <Text style={{ color: "#FFD700", fontSize: 6.5, fontWeight: "800",
                  letterSpacing: 1, textAlign: "center" }}>CARE{"\n"}SYNTHESIS</Text>
                <View style={[s.apRune, { borderColor: "#FFD700", backgroundColor: "#FFD70022",
                  marginTop: 4 }]}>
                  <Text style={[s.apRuneTxt, { color: "#FFD700" }]}>✦</Text>
                  <Text style={[s.apRuneLabel, { color: "#FFD700CC" }]}>FREE</Text>
                </View>
              </Pressable>
            )}
          {UNIT_TYPES.map(typeId => {
            const u = UNIT_DATA[typeId];
            const canAfford = ap >= u.apCost;
            const isSelected = selectedUnit === typeId;
            return (
              <Pressable key={typeId}
                style={[s.unitCard, { borderColor: isSelected ? u.color : canAfford ? u.color + "44" : COLORS.border,
                  backgroundColor: isSelected ? u.color + "18" : canAfford ? "#080e18" : "#060a12" }]}
                onPress={() => onSelectUnit(typeId)}>
                <Text style={[s.cardCatBadge, { color: canAfford ? u.color : COLORS.onSurfaceTertiary }]}>
                  {u.category}
                </Text>
                <UnitSprite typeId={typeId} castFlash={false} />
                <Text style={[s.unitCardName, { color: isSelected ? u.color : canAfford ? u.color + "CC" : COLORS.onSurfaceTertiary }]}
                  numberOfLines={2}>{u.name}</Text>
                <View style={[s.apRune, { borderColor: canAfford ? u.color + "70" : COLORS.border,
                  backgroundColor: canAfford ? u.color + "22" : "transparent" }]}>
                  <Text style={[s.apRuneTxt, { color: canAfford ? u.color : COLORS.onSurfaceTertiary }]}>{u.apCost}</Text>
                  <Text style={[s.apRuneLabel, { color: canAfford ? u.color + "CC" : COLORS.onSurfaceTertiary }]}>AP</Text>
                </View>
              </Pressable>
            );
          })}
          </>
        ) : (
          ABILITIES.map(id => {
            const ab = ABILITY_DATA[id];
            const canAfford = ap >= ab.apCost && isPlaying;
            return (
              <Pressable key={id}
                style={[s.abilityCard, { borderColor: canAfford ? ab.color + "70" : COLORS.border,
                  backgroundColor: canAfford ? "#080e18" : "#060a12", opacity: canAfford ? 1 : 0.45 }]}
                onPress={() => onUseAbility(id)} disabled={!canAfford}>
                <Text style={{ fontSize: 8, fontWeight: "700", color: canAfford ? ab.color : COLORS.onSurfaceTertiary, letterSpacing: 1 }}>
                  {ab.category}
                </Text>
                <Text style={{ fontSize: 22, marginVertical: 4 }}>{ab.icon}</Text>
                <Text style={[s.unitCardName, { color: canAfford ? ab.color : COLORS.onSurfaceTertiary }]}
                  numberOfLines={2}>{ab.name}</Text>
                <View style={[s.apRune, { borderColor: canAfford ? ab.color + "70" : COLORS.border,
                  backgroundColor: canAfford ? ab.color + "22" : "transparent" }]}>
                  <Text style={[s.apRuneTxt, { color: canAfford ? ab.color : COLORS.onSurfaceTertiary }]}>{ab.apCost}</Text>
                  <Text style={[s.apRuneLabel, { color: canAfford ? ab.color + "CC" : COLORS.onSurfaceTertiary }]}>AP</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

/* ── Wave pause overlay ── */
function WavePauseOverlay({ wave }: { wave: number }) {
  const nextWave = wave + 1;
  const isBossNext = WAVES[nextWave]?.isBoss;
  return (
    <View style={s.pauseOverlay}>
      <LinearGradient colors={["rgba(4,10,22,0.90)", "rgba(4,10,22,0.96)"]}
        style={StyleSheet.absoluteFillObject} />
      <Text style={s.pauseTitle}>
        {isBossNext ? "⚠ BOSS WAVE INCOMING" : nextWave < WAVES.length
          ? `WAVE ${nextWave + 1} INCOMING` : "FINAL WAVE CLEARED…"}
      </Text>
      <Text style={s.pauseSub}>Deploy your units — ward stabilizing…</Text>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN WARD DEFENSE COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function WardDefense() {
  const router = useRouter();
  const { player, applyRewards } = usePlayer();

  const gsRef = useRef<GS>(freshState());
  const [, bump] = useState(0);
  const rewardsApplied = useRef(false);

  const gs = gsRef.current;
  function set(next: GS) { gsRef.current = next; bump(t => t + 1); }

  /* Arena size (updated via onLayout) */
  const [arena, setArena] = useState({ w: 360, h: 260 });

  /* Hand mode + selected unit (UI state) */
  const [handMode, setHandMode] = useState<"deploy" | "abilities">("deploy");
  const [selectedUnit, setSelectedUnit] = useState("ward_scout");

  /* Shared idle bob animation */
  const bobAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bobAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
      Animated.timing(bobAnim, { toValue: 0, duration: 900, useNativeDriver: false }),
    ])).start();
  }, []);
  const bobY = bobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  /* ── Game tick ── */
  useEffect(() => {
    const iv = setInterval(() => {
      const s = gsRef.current;

      /* Wave pause countdown */
      if (s.phase === "wave_pause") {
        const pt = s.wavePauseTicks - 1;
        if (pt <= 0) {
          const nw = s.wave + 1;
          if (nw >= WAVES.length) set({ ...s, phase: "won" });
          else set(beginWave(s, nw));
        } else set({ ...s, wavePauseTicks: pt });
        return;
      }

      if (s.phase !== "playing") return;

      /* AP regen */
      let ap = s.ap;
      let apTimer = s.apTimer - 1;
      if (apTimer <= 0 && ap < MAX_AP) { ap++; apTimer = AP_REGEN_TICKS; }
      else apTimer = Math.max(0, apTimer);

      /* Spawn enemies */
      let { spawnQueue, spawnTimer, uidSeed } = s;
      spawnTimer = Math.max(0, spawnTimer - 1);
      let spawnedEnemies = [...s.enemies];
      if (spawnTimer === 0 && spawnQueue.length > 0) {
        const typeId = spawnQueue[0];
        spawnedEnemies = [...spawnedEnemies, {
          uid: `e${uidSeed}`, typeId,
          hp: ENEMY_DATA[typeId].maxHp, maxHp: ENEMY_DATA[typeId].maxHp,
          pathIndex: 0, pathProgress: 0, hitFlash: 0, slowTicks: 0,
        }];
        spawnQueue = spawnQueue.slice(1);
        spawnTimer = SPAWN_GAP_TICKS;
        uidSeed++;
      }

      /* Move enemies along path */
      const reachedLantern: ActiveEnemy[] = [];
      const movedEnemies: ActiveEnemy[] = [];
      for (const e of spawnedEnemies) {
        const spd = ENEMY_DATA[e.typeId].speed * (e.slowTicks > 0 ? 0.45 : 1.0);
        let pi = e.pathIndex, pp = e.pathProgress + spd;
        let sl = Math.max(0, e.slowTicks - 1);
        let hf = Math.max(0, e.hitFlash - 1);
        while (pp >= 1.0 && pi < N_SEGS) { pp -= 1.0; pi++; }
        if (pi >= N_SEGS) reachedLantern.push(e);
        else movedEnemies.push({ ...e, pathIndex: pi, pathProgress: pp, slowTicks: sl, hitFlash: hf });
      }

      /* Lantern damage */
      let stability = s.stability;
      for (const e of reachedLantern) stability = Math.max(0, stability - ENEMY_DATA[e.typeId].damage);

      /* Units: decay cooldown → fire projectiles */
      let newProjectiles = [...s.projectiles];
      const updatedUnits = s.deployedUnits.map(u => {
        const cd = Math.max(0, u.cooldown - 1);
        const cf = Math.max(0, u.castFlash - 1);
        const mf = Math.max(0, (u.mergeFlash ?? 0) - 1);
        if (cd > 0) return { ...u, cooldown: cd, castFlash: cf, mergeFlash: mf };
        const uPos = getUnitPosFrac(u.tileIndex);
        const uDef = UNIT_DATA[u.typeId];
        const scaled = getScaledStats(uDef, u.level ?? 1);
        let tgt: ActiveEnemy | null = null, minD = Infinity;
        for (const e of movedEnemies) {
          const d = distFrac(uPos, getEnemyPosFrac(e));
          if (d <= scaled.range && d < minD) { minD = d; tgt = e; }
        }
        if (!tgt) return { ...u, cooldown: 0, castFlash: cf, mergeFlash: mf };
        const ePos = getEnemyPosFrac(tgt);
        newProjectiles = [...newProjectiles, {
          uid: `p${s.tickCount}_${u.uid}`,
          toEnemyUid: tgt.uid,
          fromFx: uPos.x, fromFy: uPos.y,
          toFx: ePos.x, toFy: ePos.y,
          progress: 0, color: uDef.color,
          damage: scaled.damage, unitTypeId: u.typeId,
        }];
        return { ...u, cooldown: scaled.attackSpeed, castFlash: 2, mergeFlash: mf };
      });

      /* Move projectiles → collect hits */
      type HitRec = { dmg: number; quality: "strong"|"partial"|"weak"; unitTypeId: string };
      const hitMap: Record<string, HitRec[]> = {};
      const aliveProj: Projectile[] = [];
      for (const p of newProjectiles) {
        const te = movedEnemies.find(e => e.uid === p.toEnemyUid);
        if (!te) continue;
        const ePos = getEnemyPosFrac(te);
        const np = p.progress + 0.38;
        if (np >= 1.0) {
          const q = getMatchQuality(p.unitTypeId, te.typeId);
          const dmg = applyDmg(p.damage, q);
          (hitMap[te.uid] ??= []).push({ dmg, quality: q, unitTypeId: p.unitTypeId });
        } else {
          aliveProj.push({ ...p, toFx: ePos.x, toFy: ePos.y, progress: np });
        }
      }

      /* Apply hits to enemies */
      let careChain = s.careChain, peakCareChain = s.peakCareChain;
      let priorityActions = s.priorityActions;
      let strongMatches = s.strongMatches, partialMatches = s.partialMatches, weakMatches = s.weakMatches;
      let learnedConcepts = s.learnedConcepts;
      let enemyMastery = { ...s.enemyMastery };
      let lastKillQuality = s.lastKillQuality;
      let score = s.score;
      let feedbacks = s.feedbacks.map(f => ({ ...f, ticks: f.ticks - 1 })).filter(f => f.ticks > 0);

      const survEnemies: ActiveEnemy[] = [];
      for (const e of movedEnemies) {
        const hits = hitMap[e.uid];
        if (!hits?.length) { survEnemies.push(e); continue; }
        const totalDmg = hits.reduce((sum, h) => sum + h.dmg, 0);
        const quality: "strong"|"partial"|"weak" = hits.some(h => h.quality === "strong") ? "strong"
          : hits.some(h => h.quality === "partial") ? "partial" : "weak";
        if (quality === "strong") strongMatches++;
        else if (quality === "partial") partialMatches++;
        else weakMatches++;
        score += totalDmg;

        const newHp = e.hp - totalDmg;
        if (newHp <= 0) {
          ap = Math.min(MAX_AP, ap + KILL_AP_BONUS);
          const prevM = enemyMastery[e.typeId] ?? { defeated: false, correctDefeated: false };
          enemyMastery = { ...enemyMastery, [e.typeId]: {
            defeated: true, correctDefeated: prevM.correctDefeated || quality === "strong",
          }};
          if (quality === "strong") {
            careChain++; peakCareChain = Math.max(peakCareChain, careChain);
            priorityActions++; lastKillQuality = "strong";
            const sUnit = hits.find(h => h.quality === "strong")!.unitTypeId;
            if (!learnedConcepts.includes(sUnit)) learnedConcepts = [...learnedConcepts, sUnit];
            feedbacks = [{ id: `k${e.uid}`, text: `✦ Priority Action — ${ENEMY_DATA[e.typeId].name} neutralized`,
              color: COLORS.success, quality: "strong", ticks: 6 }, ...feedbacks.slice(0, 1)];
            if (careChain >= 2) {
              ap = Math.min(MAX_AP, ap + 1);
              feedbacks = [{ id: `ch${s.tickCount}`, text: `⛓ Care Chain ×${careChain}! +1 AP`,
                color: COLORS.runeGold, quality: "bonus" as any, ticks: 7 }, ...feedbacks.slice(0, 1)];
            }
          } else if (quality === "weak") {
            careChain = 0; lastKillQuality = "weak";
            feedbacks = [{ id: `w${e.uid}`, text: `◌ Weak Match — deploy a more targeted unit`,
              color: COLORS.onSurfaceTertiary, quality: "weak", ticks: 5 }, ...feedbacks.slice(0, 1)];
          } else {
            careChain = 0; lastKillQuality = "partial";
            feedbacks = [{ id: `pm${e.uid}`, text: `◈ Partial Match — partially effective`,
              color: COLORS.warning, quality: "partial", ticks: 4 }, ...feedbacks.slice(0, 1)];
          }
        } else {
          survEnemies.push({ ...e, hp: newHp, hitFlash: 3 });
        }
      }

      const ns: GS = {
        ...s,
        ap: Math.min(MAX_AP, ap), apTimer,
        spawnQueue, spawnTimer, uidSeed,
        enemies: survEnemies, projectiles: aliveProj,
        deployedUnits: updatedUnits,
        stability, feedbacks, score,
        tickCount: s.tickCount + 1,
        careChain, peakCareChain, priorityActions,
        strongMatches, partialMatches, weakMatches,
        learnedConcepts, enemyMastery, lastKillQuality,
      };

      if (ns.stability <= 0) { set({ ...ns, phase: "lost" }); return; }
      if (ns.spawnQueue.length === 0 && ns.enemies.length === 0) {
        const nw = ns.wave + 1;
        if (nw >= WAVES.length) { set({ ...ns, phase: "won" }); return; }
        set({ ...ns, phase: "wave_pause", wavePauseTicks: WAVE_PAUSE_TICKS });
        return;
      }
      set(ns);
    }, TICK_MS);
    return () => clearInterval(iv);
  }, []);

  /* ── Apply rewards on game end ── */
  useEffect(() => {
    if ((gs.phase === "won" || gs.phase === "lost") && !rewardsApplied.current && player) {
      rewardsApplied.current = true;
      const r = calcRewards(gs.phase === "won", gs.stability);
      applyRewards({ xp: r.playerXp, codexShards: r.codexShards }).catch(() => {});
    }
  }, [gs.phase, player]);

  /* ── Start / replay ── */
  function startGame() {
    rewardsApplied.current = false;
    setSelectedUnit("ward_scout"); setHandMode("deploy");
    set(beginWave(freshState(), 0));
  }

  /* ── Deploy a unit on a tile ── */
  function deployUnit(tileIdx: number) {
    const s = gsRef.current;
    if (s.phase !== "playing" && s.phase !== "wave_pause") return;
    if (s.deployedUnits.find(u => u.tileIndex === tileIdx)) {
      const fid = String(Date.now());
      set({ ...s, feedbacks: [{ id: fid, text: "Tile occupied", color: COLORS.onSurfaceTertiary, quality: "weak", ticks: 3 }, ...s.feedbacks.slice(0, 1)] });
      return;
    }
    const uDef = UNIT_DATA[selectedUnit];
    if (s.ap < uDef.apCost) {
      const fid = String(Date.now());
      set({ ...s, feedbacks: [{ id: fid, text: `Need ${uDef.apCost} AP for ${uDef.name}`, color: COLORS.warning, quality: "weak", ticks: 4 }, ...s.feedbacks.slice(0, 1)] });
      return;
    }
    const fid = String(Date.now());
    set({
      ...s,
      ap: s.ap - uDef.apCost,
      deployedUnits: [...s.deployedUnits, { uid: `u${s.uidSeed}`, typeId: selectedUnit, tileIndex: tileIdx, cooldown: 0, castFlash: 0, level: 1, mergeFlash: 0 }],
      uidSeed: s.uidSeed + 1,
      feedbacks: [{ id: fid, text: `${uDef.name} deployed — ${uDef.flavor}`, color: uDef.color, quality: "bonus" as any, ticks: 5 }, ...s.feedbacks.slice(0, 1)],
    });
  }

  /* ── Care Synthesis — merge two same-type same-level units → Lv+1 ── */
  function handleSynthesize() {
    const s = gsRef.current;
    const pair = findMergePair(s.deployedUnits);
    if (!pair) return;
    const [a, b] = pair;
    const newLevel = a.level + 1;
    const uName = UNIT_DATA[a.typeId].name;
    const fid = String(Date.now());
    set({
      ...s,
      deployedUnits: [
        ...s.deployedUnits.filter(u => u.uid !== a.uid && u.uid !== b.uid),
        { uid: `u${s.uidSeed}`, typeId: a.typeId, tileIndex: a.tileIndex,
          cooldown: 0, castFlash: 2, level: newLevel, mergeFlash: 5 },
      ],
      uidSeed: s.uidSeed + 1,
      feedbacks: [{
        id: fid,
        text: `✦ Care Synthesis — ${uName} ascended to Lv.${newLevel}!`,
        color: "#FFD700", quality: "bonus" as any, ticks: 8,
      }, ...s.feedbacks.slice(0, 1)],
    });
  }

  /* ── Use a global ability ── */
  function useAbility(abilityId: string) {
    const s = gsRef.current;
    if (s.phase !== "playing") return;
    const ab = ABILITY_DATA[abilityId];
    if (s.ap < ab.apCost) return;

    let newEnemies = s.enemies;
    let newStability = s.stability;
    let newReassessUses = s.reassessUses;
    let feedbackText = "", feedbackColor = ab.color;

    switch (abilityId) {
      case "broncho_burst": {
        const dmgd = newEnemies.map(e => ({ ...e, hp: e.hp - 30, hitFlash: 3 }));
        const killed = dmgd.filter(e => e.hp <= 0).length;
        newEnemies = dmgd.filter(e => e.hp > 0);
        feedbackText = killed > 0
          ? `💨 Broncho Burst — ${killed} spirit${killed !== 1 ? "s" : ""} defeated!`
          : "💨 Broncho Burst — 30 damage to all enemies";
        break;
      }
      case "emergency_o2":
        newStability = Math.min(MAX_STABILITY, s.stability + 15);
        feedbackText = "🆘 Emergency O₂ — +15 Stability";
        feedbackColor = COLORS.success;
        break;
      case "positioning_order":
        newEnemies = s.enemies.map(e => ({ ...e, slowTicks: 6 }));
        feedbackText = "🛌 High Fowler's — all enemies slowed";
        feedbackColor = "#A78BFA";
        break;
      case "reassess_protocol": {
        newReassessUses = s.reassessUses + 1;
        const hasCorrect = s.enemies.some(e =>
          s.deployedUnits.some(u => UNIT_DATA[u.typeId].strong.includes(e.typeId))
        );
        if (hasCorrect && s.lastKillQuality === "strong") {
          newStability = Math.min(MAX_STABILITY, s.stability + 5);
          feedbackText = "✦ Reassess Bonus — correct units deployed! +5 Stability";
          feedbackColor = COLORS.success;
        } else if (hasCorrect) {
          feedbackText = "🔄 Reassess — correct units on field, keep going";
          feedbackColor = COLORS.warning;
        } else {
          feedbackText = "🔄 Reassess — check enemy cues, adjust unit types";
          feedbackColor = COLORS.onSurfaceTertiary;
        }
        break;
      }
    }

    const fid = String(Date.now());
    set({ ...s, ap: s.ap - ab.apCost, enemies: newEnemies, stability: newStability,
      reassessUses: newReassessUses,
      feedbacks: [{ id: fid, text: feedbackText, color: feedbackColor, quality: "bonus" as any, ticks: 7 }, ...s.feedbacks.slice(0, 1)] });
  }

  /* ── Lobby ── */
  if (gs.phase === "lobby") {
    return <LobbyScreen onStart={startGame} onBack={() => router.back()} />;
  }

  /* ── Result ── */
  if (gs.phase === "won" || gs.phase === "lost") {
    const rewards = calcRewards(gs.phase === "won", gs.stability);
    const ls: LearningStats = {
      priorityActions: gs.priorityActions, strongMatches: gs.strongMatches,
      partialMatches: gs.partialMatches, weakMatches: gs.weakMatches,
      peakCareChain: gs.peakCareChain, reassessUses: gs.reassessUses,
      learnedConcepts: gs.learnedConcepts, enemyMastery: gs.enemyMastery,
    };
    return (
      <ResultScreen won={gs.phase === "won"} wave={gs.wave} stability={gs.stability}
        score={gs.score} rewards={rewards} learningStats={ls}
        onReplay={startGame} onBack={() => router.back()} />
    );
  }

  /* ── Active game ── */
  const stabilityColor = gs.stability > 60 ? COLORS.success : gs.stability > 30 ? COLORS.warning : COLORS.error;
  const waveDef = WAVES[gs.wave] ?? WAVES[WAVES.length - 1];

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>

      {/* HUD */}
      <View style={s.hud}>
        <Pressable style={s.hudBack} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={16} color={COLORS.onSurface} />
        </Pressable>
        <View style={s.hudWave}>
          <Text style={s.hudKicker}>AIRWAY WARD</Text>
          {gs.phase === "wave_pause" ? (
            <Text style={[s.hudWaveTxt, { color: COLORS.air }]}>↺ Prep…</Text>
          ) : waveDef.isBoss ? (
            <Text style={[s.hudWaveTxt, { color: COLORS.error }]}>⚠ BOSS</Text>
          ) : (
            <Text style={s.hudWaveTxt}>Wave {gs.wave + 1}/{WAVES.length}</Text>
          )}
        </View>
        <View style={s.hudStability}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
            <Text style={s.hudBarLabel}>STABILITY</Text>
            <Text style={[s.hudBarVal, { color: stabilityColor }]}>{gs.stability}</Text>
          </View>
          <View style={s.hudStabilityBg}>
            <View style={[s.hudStabilityFill, { width: `${gs.stability}%` as any, backgroundColor: stabilityColor }]} />
          </View>
        </View>
        <View style={s.hudAp}>
          <Text style={s.hudBarLabel}>AP</Text>
          <View style={s.hudGemRow}>
            {Array.from({ length: MAX_AP }).map((_, i) => (
              <View key={i} style={[s.hudGem, { backgroundColor: i < gs.ap ? COLORS.runeGold : COLORS.surfaceTertiary }]} />
            ))}
          </View>
        </View>
      </View>

      {/* Arena board — the board IS the scene, ward art only frames it */}
      <View style={s.ward} onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        setArena({ w: width, h: height });
      }}>
        {/* Board surface: dark tactical game field */}
        <LinearGradient
          colors={["#060d1c", "#050b16", "#07101f"]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Subtle cell grid — board reads as a tactical grid */}
        <BoardGrid aw={arena.w} ah={arena.h} />
        {/* Ward scene art: narrow horizon strip only, fading into board */}
        <View style={s.sceneStrip}>
          <ExpoImage
            source={require("../assets/images/ward_battle_bg.png")}
            style={[StyleSheet.absoluteFillObject, { opacity: 0.38 }]}
            contentFit="cover"
          />
          <LinearGradient
            colors={["#00000000", "#060d1c"]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
        </View>
        {/* Board frame */}
        <View style={s.boardFrame} pointerEvents="none" />

        {/* Path road S-curve */}
        <PathTileRoad aw={arena.w} ah={arena.h} />

        {/* Board endpoints */}
        <CorruptionGate aw={arena.w} ah={arena.h} />
        <VitalLanternBoard stability={gs.stability} aw={arena.w} ah={arena.h} />

        {/* Deployment tiles */}
        {(() => {
          const mergePair = findMergePair(gs.deployedUnits);
          const mergeTileSet = mergePair
            ? new Set([mergePair[0].tileIndex, mergePair[1].tileIndex])
            : new Set<number>();
          return DEPLOY_TILES.map((_, i) => (
            <DeploymentTileView
              key={i} tileIdx={i}
              unit={gs.deployedUnits.find(u => u.tileIndex === i)}
              selectedUnit={selectedUnit}
              canAfford={gs.ap >= UNIT_DATA[selectedUnit]?.apCost}
              isMergeCandidate={mergeTileSet.has(i)}
              onPress={() => deployUnit(i)}
              aw={arena.w} ah={arena.h}
            />
          ));
        })()}

        {/* Projectiles */}
        {gs.projectiles.map(p => (
          <ProjectileView key={p.uid} p={p} aw={arena.w} ah={arena.h} />
        ))}

        {/* Enemies on path */}
        {gs.enemies.map(e => (
          <EnemyOnPath key={e.uid} enemy={e} bobY={bobY} aw={arena.w} ah={arena.h} />
        ))}

        {/* Spawn queue warning */}
        {gs.spawnQueue.length > 0 && (
          <View style={s.spawnEdge}>
            <Text style={s.spawnTxt}>⚠ {gs.spawnQueue.length}</Text>
          </View>
        )}

        {/* Wave pause overlay */}
        {gs.phase === "wave_pause" && <WavePauseOverlay wave={gs.wave} />}
      </View>

      {/* Feedback strip */}
      <View style={s.feedbackPanel}>
        {gs.feedbacks.slice(0, 2).map((f, idx) => (
          <View key={f.id} style={[s.feedbackRow, { borderLeftColor: f.color, marginTop: idx > 0 ? 2 : 0 }]}>
            <Text style={[s.feedbackTxt, { color: f.color }]} numberOfLines={1}>{f.text}</Text>
          </View>
        ))}
        {gs.feedbacks.length === 0 && (
          <Text style={s.feedbackHint}>Select a unit → tap a tile to deploy. Use abilities anytime.</Text>
        )}
      </View>

      {/* Hand */}
      <HandPanel
        mode={handMode} setMode={setHandMode}
        selectedUnit={selectedUnit} onSelectUnit={setSelectedUnit}
        onUseAbility={useAbility}
        ap={gs.ap} isPlaying={gs.phase === "playing"}
        hasMerge={findMergePair(gs.deployedUnits) !== null}
        onSynthesize={handleSynthesize}
      />

    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LOBBY SCREEN
   ═══════════════════════════════════════════════════════════════════ */
/* ── Translation Codex data ────────────────────────────────────────────────── */
const TRANSLATION_CODEX = [
  {
    fantasyName: "Windway Curse",
    icon: "🌀",
    accentColor: "#6ee7b7",
    medicalMeaning: "Narrowed airway / bronchospasm pattern",
    cues: ["Wheezing", "Fast breathing", "Anxious posture", "Dim oxygen glow"],
    battleMeaning: "Wheeze Sprite and Bronchospasm Drake represent airway narrowing",
    bestMatches: [
      "Bronchodilator Mist (Mist Caster) — targets narrowed airway spirits directly",
      "Oxygen Ward (O₂ Healer) — supports oxygenation, stabilises the Vital Lantern",
    ],
    reassessCue: "Breathing effort · audible wheeze · oxygen glow brightness",
    commonTrap: "Oxygen supports stability, but may not resolve airway narrowing alone — pair it with bronchodilator.",
  },
] as const;

/* ── Case intro data ───────────────────────────────────────────────────────── */
const WINDWAY_CASE = {
  title: "The Windway Curse",
  kicker: "AIRWAY CODE RUSH · CASE BRIEFING",
  story:
    "A courier collapses at the clinic gate. The local healer says wind spirits have knotted his breath-channels.",
  findings: ["Fast, laboured breathing", "Audible wheeze on approach", "Anxious posture, gripping the gate", "Vital Lantern flickering dim"],
  sections: [
    {
      label: "FANTASY BELIEF",
      color: "#a78bfa",
      body: "Wind spirits tied invisible knots through the courier's breath channels, strangling the sacred airflow.",
    },
    {
      label: "CLINICAL CUES",
      color: "#6ee7b7",
      body: "↑ RR · audible wheeze · accessory muscle use · SpO₂ trending down · anxious affect",
    },
    {
      label: "OBJECTIVE",
      color: "#60a5fa",
      body: "Defend the Vital Lantern. Match care cards to the right disease spirits. Reassess breathing effort and wheeze after each intervention.",
    },
  ],
} as const;

/* ── Roadmap data ──────────────────────────────────────────────────────────── */
const ROADMAP_ITEMS = [
  { status: "next",   icon: "📜", label: "Post-battle Clinical Translation Summary",  desc: "Translate each defeated enemy into a plain clinical concept after battle." },
  { status: "next",   icon: "🏰", label: "Ward Realm Framing",                       desc: "Each ward becomes a fantasy realm — Airway Ward, Cardiac Citadel, Neuro Spire." },
  { status: "coming", icon: "🦸", label: "Hero Learning Roles",                       desc: "Unlock specialisations: Airway Sentinel, Medication Alchemist, Neuro Scout." },
  { status: "coming", icon: "⚗️",  label: "Apothecary Lab Preview",                  desc: "Craft care items from battle drops. Combine materials into ability upgrades." },
  { status: "locked", icon: "⚔️",  label: "Arena (Locked Preview)",                  desc: "Challenge curated ward setups from Clinica scholars. Coming after Ward Realm." },
  { status: "locked", icon: "🎓", label: "Scholarly Arena Duel Prototype",           desc: "Turn-based PvE duel using clinical reasoning vs opponent ward builds." },
] as const;

function LobbyScreen({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  const [caseVisible,   setCaseVisible]   = useState(false);
  const [codexExpanded, setCodexExpanded] = useState(false);
  const [mapExpanded,   setMapExpanded]   = useState(false);

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>
      <Image source={require("../assets/images/ward_lobby_bg.png")}
        style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={["#00000000", "#00000000", "#010610cc", "#010610f0"]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject} />

      {/* ── CASE INTRO MODAL ─────────────────────────────────────────── */}
      {caseVisible && (
        <View style={{ position:"absolute", inset:0, zIndex:99, backgroundColor:"#00000090",
          justifyContent:"center", alignItems:"center", padding:16 }}>
          <View style={{ backgroundColor:"#0a1628", borderRadius:16, borderWidth:1.5,
            borderColor:"#1e3a5f", maxWidth:480, width:"100%", overflow:"hidden" }}>
            {/* Header */}
            <LinearGradient colors={["#0e2a4a","#081828"]}
              style={{ padding:18, paddingBottom:14 }}>
              <Text style={{ color:"#60a5fa", fontSize:9, fontWeight:"700",
                letterSpacing:1.4, marginBottom:4 }}>{WINDWAY_CASE.kicker}</Text>
              <Text style={{ color:"#f0f9ff", fontSize:20, fontWeight:"800",
                letterSpacing:0.3 }}>{WINDWAY_CASE.title}</Text>
            </LinearGradient>
            <ScrollView style={{ maxHeight:480 }} contentContainerStyle={{ padding:16, gap:12 }}
              showsVerticalScrollIndicator={false}>
              {/* Story + findings */}
              <Text style={{ color:"#94a3b8", fontSize:12.5, lineHeight:19 }}>
                {WINDWAY_CASE.story}
              </Text>
              <View style={{ backgroundColor:"#0f1f38", borderRadius:10, padding:12,
                borderLeftWidth:3, borderColor:"#60a5fa" }}>
                <Text style={{ color:"#60a5fa", fontSize:9, fontWeight:"700",
                  letterSpacing:1, marginBottom:6 }}>YOU NOTICE</Text>
                {WINDWAY_CASE.findings.map((f,i) => (
                  <View key={i} style={{ flexDirection:"row", gap:8, marginBottom:4 }}>
                    <Text style={{ color:"#60a5fa", fontSize:12 }}>·</Text>
                    <Text style={{ color:"#cbd5e1", fontSize:12, lineHeight:18 }}>{f}</Text>
                  </View>
                ))}
              </View>
              {/* Three sections */}
              {WINDWAY_CASE.sections.map(sec => (
                <View key={sec.label} style={{ backgroundColor:"#0d1b30", borderRadius:10,
                  padding:12, borderLeftWidth:3, borderColor:sec.color }}>
                  <Text style={{ color:sec.color, fontSize:9, fontWeight:"700",
                    letterSpacing:1, marginBottom:5 }}>{sec.label}</Text>
                  <Text style={{ color:"#94a3b8", fontSize:12, lineHeight:18 }}>{sec.body}</Text>
                </View>
              ))}
              {/* Begin button */}
              <Pressable onPress={() => { setCaseVisible(false); onStart(); }}
                style={{ backgroundColor:"#1d4ed8", borderRadius:12, padding:14,
                  alignItems:"center", flexDirection:"row", justifyContent:"center", gap:8,
                  marginTop:4 }}>
                <Ionicons name="shield-checkmark" size={18} color="#fff" />
                <Text style={{ color:"#fff", fontSize:14, fontWeight:"800",
                  letterSpacing:0.5 }}>BEGIN DEFENSE</Text>
              </Pressable>
              <Pressable onPress={() => setCaseVisible(false)}
                style={{ alignItems:"center", paddingVertical:8 }}>
                <Text style={{ color:"#475569", fontSize:11 }}>← Back to Briefing</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={s.lobbyContent} showsVerticalScrollIndicator={false}>
        <Pressable style={s.hudBack} onPress={onBack} hitSlop={10}>
          <Ionicons name="arrow-back" size={16} color={COLORS.onSurface} />
        </Pressable>

        <View style={s.lobbyHeroArea}>
          <View style={s.lobbyEmblem}>
            <LinearGradient colors={["#0e2040", "#081828"]} style={StyleSheet.absoluteFillObject} />
            <View style={{ width: 48, height: 14, borderRadius: 2, backgroundColor: "#60A5FA" }} />
            <View style={{ position: "absolute", width: 14, height: 48, borderRadius: 2, backgroundColor: "#60A5FA" }} />
          </View>
          <Text style={s.lobbyKicker}>WARD DEFENSE · AIRWAY CODE RUSH</Text>
          <Text style={s.lobbyTitle}>Bronchospasm Siege</Text>
          <Text style={s.lobbySubtitle}>6 Waves · Deploy Healers · Defend the Lantern</Text>
        </View>

        {/* Mission */}
        <View style={s.lobbyCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.air }} />
            <Text style={s.lobbySectionTitle}>MISSION</Text>
          </View>
          <Text style={s.lobbyBodyTxt}>
            Disease spirits march through the Airway Ward toward the{" "}
            <Text style={{ color: COLORS.air }}>Vital Lantern</Text>. Deploy healer units on board tiles to auto-attack and neutralize each threat. Use clinical abilities to boost your defense.
          </Text>
          <Text style={[s.lobbyBodyTxt, { marginTop: 8 }]}>
            <Text style={{ color: COLORS.air }}>NCLEX Clinical Judgment:</Text> Recognize cues on each enemy · Prioritize threats · Deploy the right unit · Evaluate with Reassess.
          </Text>
        </View>

        {/* ── TRANSLATION CODEX ──────────────────────────────────────── */}
        <Pressable style={[s.lobbyCard, { gap:0 }]} onPress={() => setCodexExpanded(v => !v)}>
          <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
            <View style={{ width:3, height:14, borderRadius:2, backgroundColor:"#a78bfa" }}/>
            <Text style={s.lobbySectionTitle}>TRANSLATION CODEX</Text>
            <View style={{ flex:1 }}/>
            <View style={{ backgroundColor:"#a78bfa22", borderRadius:6,
              paddingHorizontal:7, paddingVertical:2 }}>
              <Text style={{ color:"#a78bfa", fontSize:8, fontWeight:"700" }}>
                {TRANSLATION_CODEX.length} ENTRY{TRANSLATION_CODEX.length !== 1 ? "S" : ""}
              </Text>
            </View>
            <Ionicons name={codexExpanded ? "chevron-up" : "chevron-down"}
              size={14} color="#64748b" />
          </View>
          {!codexExpanded && (
            <Text style={{ color:"#475569", fontSize:11, marginTop:6 }}>
              Translate fantasy illnesses into plain medical concepts.
            </Text>
          )}
          {codexExpanded && TRANSLATION_CODEX.map((entry, i) => (
            <View key={i} style={{ marginTop:14, gap:10 }}>
              {/* Entry header */}
              <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
                <Text style={{ fontSize:18 }}>{entry.icon}</Text>
                <View>
                  <Text style={{ color:"#a78bfa", fontSize:13, fontWeight:"800" }}>
                    {entry.fantasyName}
                  </Text>
                  <Text style={{ color:"#94a3b8", fontSize:11, marginTop:1 }}>
                    {entry.medicalMeaning}
                  </Text>
                </View>
              </View>
              {/* Recognize cues */}
              <View style={{ backgroundColor:"#0d1b30", borderRadius:8, padding:10,
                borderLeftWidth:2.5, borderColor:entry.accentColor }}>
                <Text style={{ color:entry.accentColor, fontSize:8.5, fontWeight:"700",
                  letterSpacing:0.9, marginBottom:5 }}>RECOGNIZE CUES</Text>
                <View style={{ flexDirection:"row", flexWrap:"wrap", gap:5 }}>
                  {entry.cues.map((cue,j) => (
                    <View key={j} style={{ backgroundColor:entry.accentColor+"20",
                      borderRadius:5, paddingHorizontal:7, paddingVertical:2 }}>
                      <Text style={{ color:entry.accentColor, fontSize:10, fontWeight:"600" }}>
                        {cue}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              {/* Battle meaning */}
              <View style={{ backgroundColor:"#130820", borderRadius:8, padding:10,
                borderLeftWidth:2.5, borderColor:"#7c3aed" }}>
                <Text style={{ color:"#a78bfa", fontSize:8.5, fontWeight:"700",
                  letterSpacing:0.9, marginBottom:4 }}>BATTLE MEANING</Text>
                <Text style={{ color:"#94a3b8", fontSize:11, lineHeight:17 }}>
                  {entry.battleMeaning}
                </Text>
              </View>
              {/* Best matches */}
              <View style={{ backgroundColor:"#081c14", borderRadius:8, padding:10,
                borderLeftWidth:2.5, borderColor:"#34d399" }}>
                <Text style={{ color:"#34d399", fontSize:8.5, fontWeight:"700",
                  letterSpacing:0.9, marginBottom:5 }}>BEST MATCHES</Text>
                {entry.bestMatches.map((m,j) => (
                  <View key={j} style={{ flexDirection:"row", gap:6, marginBottom:3 }}>
                    <Text style={{ color:"#34d399", fontSize:11 }}>✦</Text>
                    <Text style={{ color:"#94a3b8", fontSize:11, lineHeight:17, flex:1 }}>{m}</Text>
                  </View>
                ))}
              </View>
              {/* Reassess + trap */}
              <View style={{ flexDirection:"row", gap:8 }}>
                <View style={{ flex:1, backgroundColor:"#0e1f10", borderRadius:8, padding:9,
                  borderWidth:1, borderColor:"#166534" }}>
                  <Text style={{ color:"#6ee7b7", fontSize:8, fontWeight:"700",
                    letterSpacing:0.8, marginBottom:3 }}>REASSESS</Text>
                  <Text style={{ color:"#86efac", fontSize:10.5, lineHeight:16 }}>
                    {entry.reassessCue}
                  </Text>
                </View>
                <View style={{ flex:1, backgroundColor:"#1a0e0a", borderRadius:8, padding:9,
                  borderWidth:1, borderColor:"#7c3412" }}>
                  <Text style={{ color:"#f97316", fontSize:8, fontWeight:"700",
                    letterSpacing:0.8, marginBottom:3 }}>COMMON TRAP</Text>
                  <Text style={{ color:"#fdba74", fontSize:10.5, lineHeight:16 }}>
                    {entry.commonTrap}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </Pressable>

        {/* Healer units */}
        <View style={s.lobbyCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.brand }} />
            <Text style={s.lobbySectionTitle}>HEALER UNITS — DEPLOY ON TILES</Text>
          </View>
          {UNIT_TYPES.map(typeId => {
            const u = UNIT_DATA[typeId];
            return (
              <View key={typeId} style={s.lobbyListRow}>
                <View style={[s.lobbyEnemyChip, { borderColor: u.color + "55", backgroundColor: u.color + "18" }]}>
                  <UnitSprite typeId={typeId} castFlash={false} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[s.lobbyListName, { color: u.color }]}>{u.name}</Text>
                    <View style={{ backgroundColor: u.color + "22", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ color: u.color, fontSize: 8, fontWeight: "700" }}>{u.apCost} AP · {u.category}</Text>
                    </View>
                  </View>
                  <Text style={s.lobbyListDesc}>{u.flavor}</Text>
                  <Text style={[s.lobbyListDesc, { color: COLORS.air, marginTop: 2 }]}>{u.concept}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Disease spirits */}
        <View style={s.lobbyCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.error }} />
            <Text style={s.lobbySectionTitle}>DISEASE SPIRITS — RECOGNIZE CUES</Text>
          </View>
          {Object.entries(ENEMY_DATA).map(([, def]) => (
            <View key={def.name} style={s.lobbyListRow}>
              <View style={[s.lobbyEnemyChip, { borderColor: def.color + "55", backgroundColor: def.color + "12" }]}>
                <Text style={{ fontSize: 18 }}>{def.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[s.lobbyListName, { color: def.color }]}>{def.name}</Text>
                  <View style={{ backgroundColor: def.color + "20", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                    <Text style={{ color: def.color, fontSize: 7, fontWeight: "700" }}>{def.clue}</Text>
                  </View>
                  {def.isBoss && (
                    <View style={{ backgroundColor: COLORS.error + "22", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ color: COLORS.error, fontSize: 8, fontWeight: "700" }}>BOSS</Text>
                    </View>
                  )}
                </View>
                <Text style={s.lobbyListDesc}>{def.flavor}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── ROADMAP ────────────────────────────────────────────────── */}
        <Pressable style={[s.lobbyCard, { gap:0 }]} onPress={() => setMapExpanded(v => !v)}>
          <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
            <View style={{ width:3, height:14, borderRadius:2, backgroundColor:"#f59e0b" }}/>
            <Text style={s.lobbySectionTitle}>CLINICA ROADMAP</Text>
            <View style={{ flex:1 }}/>
            <View style={{ backgroundColor:"#f59e0b22", borderRadius:6,
              paddingHorizontal:7, paddingVertical:2 }}>
              <Text style={{ color:"#f59e0b", fontSize:8, fontWeight:"700" }}>IN DEVELOPMENT</Text>
            </View>
            <Ionicons name={mapExpanded ? "chevron-up" : "chevron-down"}
              size={14} color="#64748b" />
          </View>
          {!mapExpanded && (
            <Text style={{ color:"#475569", fontSize:11, marginTop:6 }}>
              What's coming next for Clinica.
            </Text>
          )}
          {mapExpanded && (
            <View style={{ marginTop:14, gap:8 }}>
              {ROADMAP_ITEMS.map((item, i) => {
                const statusColor = item.status === "next" ? "#34d399"
                  : item.status === "coming" ? "#f59e0b" : "#475569";
                const statusLabel = item.status === "next" ? "UP NEXT"
                  : item.status === "coming" ? "COMING SOON" : "LOCKED";
                return (
                  <View key={i} style={{ flexDirection:"row", gap:10, alignItems:"flex-start",
                    backgroundColor:"#0a1628", borderRadius:10, padding:12,
                    borderWidth:1, borderColor:statusColor+"28",
                    opacity: item.status === "locked" ? 0.6 : 1 }}>
                    <Text style={{ fontSize:18, marginTop:1 }}>{item.icon}</Text>
                    <View style={{ flex:1, gap:3 }}>
                      <View style={{ flexDirection:"row", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                        <Text style={{ color:"#e2e8f0", fontSize:12, fontWeight:"700", flex:1 }}>
                          {item.label}
                        </Text>
                        <View style={{ backgroundColor:statusColor+"20", borderRadius:4,
                          paddingHorizontal:5, paddingVertical:1 }}>
                          <Text style={{ color:statusColor, fontSize:7, fontWeight:"700" }}>
                            {statusLabel}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color:"#64748b", fontSize:11, lineHeight:16 }}>
                        {item.desc}
                      </Text>
                    </View>
                  </View>
                );
              })}
              <Text style={{ color:"#334155", fontSize:10, textAlign:"center", marginTop:4 }}>
                Roadmap is informational — items may shift as development progresses.
              </Text>
            </View>
          )}
        </Pressable>

        {/* Enter button — opens case intro first */}
        <Pressable style={s.enterBtn} onPress={() => setCaseVisible(true)}>
          <Ionicons name="shield-checkmark" size={20} color={COLORS.onBrand} />
          <Text style={s.enterBtnTxt}>ENTER AIRWAY WARD</Text>
        </Pressable>
        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   RESULT SCREEN — Clinical Judgment Report
   ═══════════════════════════════════════════════════════════════════ */
function ResultScreen({
  won, wave, stability, score, rewards, learningStats, onReplay, onBack,
}: {
  won: boolean; wave: number; stability: number; score: number;
  rewards: ReturnType<typeof calcRewards>;
  learningStats: LearningStats;
  onReplay: () => void; onBack: () => void;
}) {
  const total = learningStats.strongMatches + learningStats.partialMatches + learningStats.weakMatches;
  const masteredEnemies = Object.entries(learningStats.enemyMastery).filter(([, m]) => m.defeated);

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={won ? ["#041c10", "#062a18", "#041410"] : ["#180608", "#26090c", "#120406"]}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={won ? ["#34D39920", "#00000000"] : ["#F8717120", "#00000000"]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: "40%" }}
      />
      <ScrollView contentContainerStyle={s.resultContent} showsVerticalScrollIndicator={false}>
        <Text style={s.resultEmoji}>{won ? "🏆" : "💔"}</Text>
        <Text style={[s.resultTitle, { color: won ? COLORS.success : COLORS.error }]}>
          {won ? "WARD DEFENDED!" : "VITAL LANTERN DIMMED"}
        </Text>
        <Text style={s.resultSub}>
          {won
            ? `All ${WAVES.length} waves cleared · ${stability} Stability remaining`
            : `Fell on Wave ${wave + 1} of ${WAVES.length}`}
        </Text>

        {/* Rewards */}
        <View style={s.rewardBox}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.brand }} />
            <Text style={s.lobbySectionTitle}>REWARDS EARNED</Text>
          </View>
          {[
            { label: "Codex Shards", icon: "📖", val: rewards.codexShards },
            { label: "Player XP",    icon: "⭐", val: rewards.playerXp },
            { label: "Hero XP",      icon: "🦸", val: rewards.heroXp },
            { label: "Air Catalyst", icon: "💨", val: rewards.airCatalyst },
          ].map(r => (
            <View key={r.label} style={s.rewardRow}>
              <Text style={{ fontSize: 20 }}>{r.icon}</Text>
              <Text style={s.rewardLbl}>{r.label}</Text>
              <Text style={[s.rewardVal, { color: r.val > 0 ? COLORS.brand : COLORS.onSurfaceTertiary }]}>+{r.val}</Text>
            </View>
          ))}
        </View>

        {/* Clinical Judgment Report */}
        {total > 0 && (
          <View style={[s.rewardBox, { gap: 0 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.air }} />
              <Text style={s.lobbySectionTitle}>CLINICAL JUDGMENT REPORT</Text>
            </View>

            {/* Match quality 3-column */}
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
              {[
                { count: learningStats.strongMatches,  label: "STRONG",  color: COLORS.success, sym: "✦" },
                { count: learningStats.partialMatches, label: "PARTIAL", color: COLORS.warning,  sym: "◈" },
                { count: learningStats.weakMatches,    label: "WEAK",    color: COLORS.onSurfaceTertiary, sym: "◌" },
              ].map(m => (
                <View key={m.label} style={{ flex: 1, alignItems: "center",
                  backgroundColor: m.color + "12", borderRadius: 8,
                  borderWidth: 1, borderColor: m.color + "30", paddingVertical: 8 }}>
                  <Text style={{ color: m.color, fontSize: 18, fontWeight: "700" }}>{m.count}</Text>
                  <Text style={{ color: m.color, fontSize: 7, fontWeight: "700", letterSpacing: 0.8 }}>
                    {m.sym} {m.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* NCLEX steps summary */}
            {[
              learningStats.priorityActions > 0 && {
                icon: "⚔", label: "Priority Actions",
                val: `×${learningStats.priorityActions}`, color: COLORS.success },
              learningStats.peakCareChain >= 2 && {
                icon: "⛓", label: "Best Care Chain",
                val: `×${learningStats.peakCareChain}`, color: COLORS.runeGold },
              learningStats.reassessUses > 0 && {
                icon: "🔄", label: "Reassess Uses",
                val: `×${learningStats.reassessUses}`, color: "#EC4899" },
            ].filter(Boolean).map((item: any) => (
              <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Text style={{ fontSize: 14 }}>{item.icon}</Text>
                <Text style={{ color: COLORS.onSurfaceSecondary, fontSize: 12, flex: 1 }}>{item.label}</Text>
                <Text style={{ color: item.color, fontSize: 13, fontWeight: "700" }}>{item.val}</Text>
              </View>
            ))}

            {/* Learned clinical concepts */}
            {learningStats.learnedConcepts.length > 0 && (
              <View style={{ marginTop: 6, borderTopWidth: 1, borderColor: "#1a3050", paddingTop: 10 }}>
                <Text style={[s.lobbySectionTitle, { marginBottom: 8 }]}>LEARNED</Text>
                {learningStats.learnedConcepts.slice(0, 3).map(uid => (
                  <View key={uid} style={{ flexDirection: "row", gap: 6, alignItems: "flex-start", marginBottom: 6 }}>
                    <Text style={{ color: COLORS.air, fontSize: 11, marginTop: 1 }}>✦</Text>
                    <Text style={{ color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 16, flex: 1 }}>
                      {UNIT_DATA[uid]?.concept}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Enemy mastery */}
            {masteredEnemies.length > 0 && (
              <View style={{ marginTop: 6, borderTopWidth: 1, borderColor: "#1a3050", paddingTop: 10 }}>
                <Text style={[s.lobbySectionTitle, { marginBottom: 8 }]}>ENEMY MASTERY</Text>
                {masteredEnemies.map(([typeId, m]) => {
                  const def = ENEMY_DATA[typeId];
                  if (!def) return null;
                  return (
                    <View key={typeId} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <Text style={{ fontSize: 14 }}>{def.icon}</Text>
                      <Text style={{ color: COLORS.onSurfaceSecondary, fontSize: 11, flex: 1 }}>{def.name}</Text>
                      <View style={{ backgroundColor: (m.correctDefeated ? COLORS.success : COLORS.onSurfaceTertiary) + "18",
                        borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                        <Text style={{ color: m.correctDefeated ? COLORS.success : COLORS.onSurfaceTertiary,
                          fontSize: 8, fontWeight: "700" }}>
                          {m.correctDefeated ? "✦ CORRECT" : "◌ MATCHED"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        <Text style={s.scoreLine}>Total clinical impact: {score}</Text>

        <Pressable style={s.enterBtn} onPress={onReplay}>
          <Ionicons name="refresh" size={18} color={COLORS.onBrand} />
          <Text style={s.enterBtnTxt}>PLAY AGAIN</Text>
        </Pressable>
        <Pressable style={s.exitBtn} onPress={onBack}>
          <Text style={s.exitBtnTxt}>RETURN HOME</Text>
        </Pressable>
        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#040c18" },

  /* HUD */
  hud: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
    backgroundColor: "#040c18", borderBottomWidth: 1, borderColor: "#1a3050",
  },
  hudBack: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#0a1828", borderWidth: 1, borderColor: "#1a3050",
    alignItems: "center", justifyContent: "center",
  },
  hudWave: { width: 70 },
  hudKicker: { color: COLORS.air, fontSize: 7.5, fontWeight: "700", letterSpacing: 1.5 },
  hudWaveTxt: { color: COLORS.onSurface, fontSize: 11.5, fontWeight: "700" },
  hudStability: { flex: 1 },
  hudBarLabel: { color: COLORS.onSurfaceTertiary, fontSize: 7.5, fontWeight: "700", letterSpacing: 1.5 },
  hudBarVal: { fontSize: 8.5, fontWeight: "700" },
  hudStabilityBg: { height: 7, backgroundColor: "#0a1428", borderRadius: 4, overflow: "hidden" },
  hudStabilityFill: { height: "100%", borderRadius: 4 },
  hudAp: { width: 68 },
  hudGemRow: { flexDirection: "row", flexWrap: "wrap", gap: 2, marginTop: 3 },
  hudGem: { width: 5.5, height: 5.5, borderRadius: 3 },

  /* Arena */
  ward: { flex: 1, overflow: "hidden", position: "relative", backgroundColor: "#060d1c" },
  sceneStrip: {
    position: "absolute", top: 0, left: 0, right: 0, height: 58,
    overflow: "hidden", zIndex: 0,
  },
  boardFrame: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 1.5, borderColor: "#1e4070",
    opacity: 0.35, zIndex: 0,
  },
  spawnEdge: {
    position: "absolute", right: 10, top: "40%",
    backgroundColor: "#2c0a0a", borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.error + "60",
    paddingHorizontal: 6, paddingVertical: 3,
  },
  spawnTxt: { color: COLORS.error, fontSize: 10, fontWeight: "700" },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center", gap: 8, zIndex: 20,
  },
  pauseTitle: { color: COLORS.air, fontSize: 15, fontWeight: "700", letterSpacing: 2 },
  pauseSub: { color: COLORS.onSurfaceTertiary, fontSize: 11 },

  /* Feedback */
  feedbackPanel: {
    minHeight: 50, paddingHorizontal: SPACING.md, paddingVertical: 5,
    justifyContent: "center", backgroundColor: "#040c18",
    borderTopWidth: 1, borderColor: "#0e2040",
  },
  feedbackRow: { borderLeftWidth: 2, paddingLeft: SPACING.sm },
  feedbackTxt: { fontSize: 11, lineHeight: 16, fontWeight: "500" },
  feedbackHint: { color: COLORS.onSurfaceTertiary, fontSize: 10.5, fontStyle: "italic" },

  /* Hand */
  handArea: { backgroundColor: "#040c18", borderTopWidth: 1, borderColor: "#0e2040" },
  handTabs: {
    flexDirection: "row", borderBottomWidth: 1, borderColor: "#0e2040",
    paddingHorizontal: SPACING.sm,
  },
  handTabBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  handTabActive: { borderBottomWidth: 2, borderColor: COLORS.air },
  handTabTxt: { fontSize: 9.5, fontWeight: "700", letterSpacing: 1.2 },
  handApBadge: {
    flexDirection: "row", alignItems: "center", gap: 2,
    paddingVertical: 6, paddingHorizontal: 8,
  },
  handApTxt: { color: COLORS.runeGold, fontSize: 14, fontWeight: "700" },
  handApLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  handCards: { padding: SPACING.xs, gap: 5, flexDirection: "row" },
  unitCard: {
    width: 76, alignItems: "center", gap: 3,
    paddingVertical: 6, paddingTop: 5,
    borderRadius: RADIUS.md, borderWidth: 1.5,
    minHeight: 112,
  },
  abilityCard: {
    width: 72, alignItems: "center", gap: 2,
    paddingVertical: 6,
    borderRadius: RADIUS.md, borderWidth: 1.5,
    minHeight: 105,
  },
  cardCatBadge: { fontSize: 7, fontWeight: "700", letterSpacing: 1 },
  unitCardName: { fontSize: 8, fontWeight: "700", textAlign: "center", lineHeight: 11, paddingHorizontal: 3 },
  apRune: {
    flexDirection: "row", alignItems: "center", gap: 2,
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 6, paddingVertical: 2, marginTop: 1,
  },
  apRuneTxt: { fontSize: 11, fontWeight: "700" },
  apRuneLabel: { fontSize: 6.5, fontWeight: "700", letterSpacing: 0.5, marginTop: 1 },

  /* Lobby */
  lobbyContent: { padding: SPACING.lg, gap: SPACING.lg },
  lobbyHeroArea: { alignItems: "center", gap: 8, paddingVertical: SPACING.md },
  lobbyEmblem: {
    width: 72, height: 72, borderRadius: 12,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    borderWidth: 1.5, borderColor: "#60A5FA40", marginBottom: 8,
  },
  lobbyKicker: { color: COLORS.air, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  lobbyTitle: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300" },
  lobbySubtitle: { color: COLORS.onSurfaceSecondary, fontSize: 12 },
  lobbyCard: {
    backgroundColor: "#080e1c", borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: "#1a3050",
  },
  lobbySectionTitle: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  lobbyBodyTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20 },
  lobbyListRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginBottom: 10 },
  lobbyEnemyChip: {
    width: 44, height: 44, borderRadius: 8, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  lobbyListName: { fontSize: 12, fontWeight: "700" },
  lobbyListDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  enterBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.sm, backgroundColor: COLORS.brand, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
  },
  enterBtnTxt: { color: COLORS.onBrand, fontSize: 14, fontWeight: "700", letterSpacing: 2 },
  exitBtn: {
    width: "100%", borderWidth: 1, borderColor: "#1a3050",
    borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: "center",
  },
  exitBtnTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },

  /* Result */
  resultContent: { padding: SPACING.xl, alignItems: "center", gap: SPACING.md },
  resultEmoji: { fontSize: 64, marginTop: SPACING.xl },
  resultTitle: { fontSize: 22, fontWeight: "700", letterSpacing: 2, textAlign: "center" },
  resultSub: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: "center" },
  rewardBox: {
    width: "100%", backgroundColor: "#08101c",
    borderRadius: RADIUS.md, padding: SPACING.lg,
    borderWidth: 1, borderColor: "#1a3050",
  },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  rewardLbl: { flex: 1, color: COLORS.onSurfaceSecondary, fontSize: 14 },
  rewardVal: { fontSize: 18, fontWeight: "700" },
  scoreLine: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
});
