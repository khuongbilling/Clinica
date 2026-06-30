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

/* ═══════════════════════════════════════════════════════════════════
   PATH ROAD — renders the S-curve enemy corridor on the board
   ═══════════════════════════════════════════════════════════════════ */
function PathRoad({ aw, ah }: { aw: number; ah: number }) {
  if (aw < 20 || ah < 20) return null;

  const segs = PATH_WPS.slice(0, -1).map((wp, i) => {
    const [x1, y1] = [wp[0] * aw, wp[1] * ah];
    const [x2, y2] = [PATH_WPS[i + 1][0] * aw, PATH_WPS[i + 1][1] * ah];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, len, angle };
  });

  return (
    <>
      {/* Road fill */}
      {segs.map((seg, i) => (
        <View key={`r${i}`} style={{
          position: "absolute",
          left: seg.cx - seg.len / 2, top: seg.cy - ROAD_W / 2,
          width: seg.len, height: ROAD_W,
          backgroundColor: "#06121e",
          borderTopWidth: 1.5, borderBottomWidth: 1.5,
          borderColor: "#60A5FA25",
          transform: [{ rotate: `${seg.angle}deg` }],
          zIndex: 1,
        }} />
      ))}
      {/* Glow tint alternating */}
      {segs.map((seg, i) => (
        <View key={`g${i}`} style={{
          position: "absolute",
          left: seg.cx - seg.len / 2, top: seg.cy - ROAD_W / 2,
          width: seg.len, height: ROAD_W,
          backgroundColor: i % 2 === 0 ? "#60A5FA07" : "#34D39907",
          transform: [{ rotate: `${seg.angle}deg` }],
          zIndex: 1,
        }} />
      ))}
      {/* Corner joints at interior waypoints */}
      {PATH_WPS.slice(1, -1).map(([fx, fy], i) => (
        <View key={`c${i}`} style={{
          position: "absolute",
          left: fx * aw - ROAD_W / 2, top: fy * ah - ROAD_W / 2,
          width: ROAD_W, height: ROAD_W, borderRadius: ROAD_W / 2,
          backgroundColor: "#06121e",
          borderWidth: 1.5, borderColor: "#60A5FA28",
          zIndex: 1,
        }} />
      ))}
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
   ENEMY SPRITES — 2.5D chibi disease spirits
   ═══════════════════════════════════════════════════════════════════ */
type SpriteProps = { hitFlash: boolean; bobY: Animated.AnimatedInterpolation<number> };

function BreathlessWispSprite({ hitFlash, bobY }: SpriteProps) {
  const c = hitFlash ? "#ffffff" : "#93C5FD";
  const bg = hitFlash ? "#60A5FA66" : "#60A5FA22";
  return (
    <Animated.View style={{ alignItems: "center", transform: [{ translateY: bobY }] }}>
      <View style={{ flexDirection: "row", gap: 5, marginBottom: -4 }}>
        {[-6, 0, 6].map((rot, i) => (
          <View key={i} style={{ width: 2.5, height: 8 + (i === 1 ? 4 : 0), borderRadius: 2,
            backgroundColor: "#60A5FA70", transform: [{ rotate: `${rot}deg` }] }} />
        ))}
      </View>
      <View style={{ width: 34, height: 42, borderRadius: 999, backgroundColor: bg,
        borderWidth: 1.5, borderColor: c, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <View style={{ position: "absolute", top: "15%", left: "20%", width: "60%", height: "40%",
          borderRadius: 999, backgroundColor: "#e0f2fe44" }} />
        <View style={{ flexDirection: "row", gap: 9, marginTop: -6 }}>
          <View style={{ width: 6, height: 7, borderRadius: 4, backgroundColor: "#1e3a5f" }} />
          <View style={{ width: 6, height: 7, borderRadius: 4, backgroundColor: "#1e3a5f" }} />
        </View>
        <View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: "#1e3a5f", marginTop: 5 }} />
      </View>
      <View style={{ flexDirection: "row", gap: 4, marginTop: -3 }}>
        {[{h:12,rot:-8},{h:16,rot:0},{h:12,rot:8}].map((t, i) => (
          <View key={i} style={{ width: 3, height: t.h, borderRadius: 3,
            backgroundColor: "#60A5FA55", transform: [{ rotate: `${t.rot}deg` }] }} />
        ))}
      </View>
    </Animated.View>
  );
}

function WheezeSpriteSprite({ hitFlash, bobY }: SpriteProps) {
  const c = hitFlash ? "#ffffff" : "#6EE7B7";
  const bg = hitFlash ? "#34D39966" : "#34D39920";
  return (
    <Animated.View style={{ alignItems: "center", transform: [{ translateY: bobY }] }}>
      <View style={{ flexDirection: "row", gap: 3, marginBottom: -6 }}>
        {[{h:8,rot:-18},{h:12,rot:-6},{h:10,rot:8},{h:7,rot:20}].map((sp, i) => (
          <View key={i} style={{ width: 2.5, height: sp.h, borderRadius: 2,
            backgroundColor: "#34D39960", transform: [{ rotate: `${sp.rot}deg` }] }} />
        ))}
      </View>
      <View style={{ width: 38, height: 44, borderRadius: 16, borderTopLeftRadius: 999,
        borderTopRightRadius: 8, borderBottomRightRadius: 999, borderBottomLeftRadius: 12,
        backgroundColor: bg, borderWidth: 1.5, borderColor: c,
        alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <View style={{ position: "absolute", top: "18%", left: "8%", right: "8%", height: 1, backgroundColor: "#34D39940", transform: [{ rotate: "-12deg" }] }} />
        <View style={{ position: "absolute", top: "40%", left: "8%", right: "8%", height: 1, backgroundColor: "#34D39940", transform: [{ rotate: "8deg" }] }} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: -8, transform: [{ rotate: "-6deg" }] }}>
          <View style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: "#065f46", transform: [{ rotate: "10deg" }] }} />
          <View style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: "#065f46", transform: [{ rotate: "-10deg" }] }} />
        </View>
        <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: "#065f46", marginTop: 6 }} />
      </View>
      <View style={{ flexDirection: "row", gap: 3, marginTop: -2 }}>
        {[-6, 0, 4].map((rot, i) => (
          <View key={i} style={{ width: 2, height: 8, borderRadius: 2,
            backgroundColor: "#6EE7B744", transform: [{ rotate: `${rot}deg` }] }} />
        ))}
      </View>
    </Animated.View>
  );
}

function MucusSlimeSprite({ hitFlash, bobY }: SpriteProps) {
  const c = hitFlash ? "#ffffff" : "#86EFAC";
  const bg = hitFlash ? "#86EFAC88" : "#86EFAC30";
  return (
    <Animated.View style={{ alignItems: "center", transform: [{ translateY: bobY }] }}>
      <View style={{ width: 42, height: 38, borderRadius: 999, backgroundColor: bg,
        borderWidth: 1.5, borderColor: c, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <View style={{ position: "absolute", top: "12%", right: "18%", width: 10, height: 8, borderRadius: 999, backgroundColor: "#ffffff35" }} />
        <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
          <View style={{ width: 5, height: 6, borderRadius: 3, backgroundColor: "#065f46" }} />
          <View style={{ width: 5, height: 6, borderRadius: 3, backgroundColor: "#065f46" }} />
        </View>
        <View style={{ marginTop: 3, flexDirection: "row", gap: 1 }}>
          {[2, 3, 3, 2].map((h, i) => (
            <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: "#065f46" }} />
          ))}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 3, marginTop: -4 }}>
        {[{w:12,h:9},{w:16,h:12},{w:10,h:7}].map((d, i) => (
          <View key={i} style={{ width: d.w, height: d.h, borderRadius: 999,
            backgroundColor: bg, borderWidth: 1, borderColor: c + "80" }} />
        ))}
      </View>
    </Animated.View>
  );
}

function HypoxiaWraithSprite({ hitFlash, bobY }: SpriteProps) {
  const c = hitFlash ? "#ffffff" : "#A78BFA";
  const bg = hitFlash ? "#A78BFA55" : "#A78BFA15";
  return (
    <Animated.View style={{ alignItems: "center", transform: [{ translateY: bobY }] }}>
      <View style={{ width: 30, height: 52, borderTopLeftRadius: 999, borderTopRightRadius: 999,
        borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
        backgroundColor: bg, borderWidth: 1.5, borderColor: c + "90",
        alignItems: "center", overflow: "hidden" }}>
        <LinearGradient colors={["#A78BFA18", "#00000000"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: "60%" }} />
        <View style={{ flexDirection: "row", gap: 7, marginTop: 10 }}>
          <View style={{ width: 7, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: "#3b0764" }} />
          <View style={{ width: 7, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: "#3b0764" }} />
        </View>
        <View style={{ width: 10, height: 2, borderRadius: 1, backgroundColor: "#3b0764", marginTop: 6 }} />
      </View>
      <View style={{ flexDirection: "row", gap: 4, marginTop: -6 }}>
        {[{h:12,rot:-14},{h:10,rot:0},{h:13,rot:12}].map((t, i) => (
          <View key={i} style={{ width: 6, height: t.h, borderRadius: 999,
            backgroundColor: "#A78BFA22", borderWidth: 1, borderColor: c + "40",
            transform: [{ rotate: `${t.rot}deg` }] }} />
        ))}
      </View>
    </Animated.View>
  );
}

function BronchospasmDrakeSprite({ hitFlash, bobY }: SpriteProps) {
  const c = hitFlash ? "#ffffff" : "#F97316";
  const bg = hitFlash ? "#F9731688" : "#F9731630";
  return (
    <Animated.View style={{ alignItems: "center", transform: [{ translateY: bobY }] }}>
      <View style={{ position: "absolute", top: -6, alignSelf: "center",
        width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: "#F9731628" }} />
      <View style={{ position: "absolute", top: 4, alignSelf: "center",
        width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: "#F9731640" }} />
      <View style={{ flexDirection: "row", gap: 3, marginBottom: -5, zIndex: 2 }}>
        {[{w:6,h:14,rot:-18},{w:8,h:18,rot:-6},{w:10,h:22,rot:0},{w:8,h:16,rot:6},{w:6,h:12,rot:18}].map((cr, i) => (
          <View key={i} style={{ width: cr.w, height: cr.h, borderRadius: 2,
            backgroundColor: i === 2 ? "#1e3a78" : "#162860",
            borderWidth: 1, borderColor: "#60A5FA55",
            transform: [{ rotate: `${cr.rot}deg` }] }} />
        ))}
      </View>
      <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: bg,
        borderWidth: 2, borderColor: c, alignItems: "center", justifyContent: "center", zIndex: 3 }}>
        <View style={{ position: "absolute", top: "18%", left: "10%", right: "10%", height: 1, backgroundColor: "#F9731640" }} />
        <View style={{ position: "absolute", top: "36%", left: "10%", right: "10%", height: 1, backgroundColor: "#F9731630" }} />
        <View style={{ flexDirection: "row", gap: 14, marginTop: -8 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#7c2d12", borderWidth: 1.5, borderColor: "#fbbf24" }} />
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#7c2d12", borderWidth: 1.5, borderColor: "#fbbf24" }} />
        </View>
        <View style={{ width: 18, height: 8, borderRadius: 4, backgroundColor: "#7c2d1288", borderWidth: 1, borderColor: c, marginTop: 5 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-around", paddingTop: 2 }}>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#431407" }} />
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#431407" }} />
          </View>
        </View>
        <View style={{ position: "absolute", top: -6, flexDirection: "row", gap: 12 }}>
          <View style={{ width: 5, height: 10, borderRadius: 3, backgroundColor: "#1e40af", transform: [{ rotate: "-14deg" }] }} />
          <View style={{ width: 7, height: 14, borderRadius: 3, backgroundColor: "#1d4ed8" }} />
          <View style={{ width: 5, height: 10, borderRadius: 3, backgroundColor: "#1e40af", transform: [{ rotate: "14deg" }] }} />
        </View>
      </View>
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

/* ═══════════════════════════════════════════════════════════════════
   UNIT SPRITES — deployable healer units (compact 36px designs)
   ═══════════════════════════════════════════════════════════════════ */
function WardScoutSprite({ castFlash }: { castFlash: boolean }) {
  const c = castFlash ? "#fff" : "#60A5FA";
  const bg = castFlash ? "#60A5FA99" : "#60A5FA28";
  return (
    <View style={{ alignItems: "center" }}>
      {/* Outer glow ring when casting */}
      {castFlash && (
        <View style={{ position: "absolute", top: -2, width: 42, height: 42, borderRadius: 21,
          borderWidth: 1.5, borderColor: "#60A5FA55", zIndex: -1 }} />
      )}
      {/* Head */}
      <View style={{ width: 18, height: 16, borderRadius: 999, backgroundColor: "#fde68a",
        borderWidth: 1, borderColor: "#d97706", alignItems: "center", justifyContent: "center" }}>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <View style={{ width: 3, height: 3.5, borderRadius: 2, backgroundColor: "#1e3a5f" }} />
          <View style={{ width: 3, height: 3.5, borderRadius: 2, backgroundColor: "#1e3a5f" }} />
        </View>
        {/* Stethoscope headband */}
        <View style={{ position: "absolute", top: -4, left: -2, right: -2, height: 5,
          borderRadius: 3, borderWidth: 1.5, borderColor: c + "80", borderBottomWidth: 0 }} />
      </View>
      {/* Body */}
      <View style={{ width: 24, height: 22, borderRadius: 8, backgroundColor: bg,
        borderWidth: 1.5, borderColor: c, alignItems: "center", justifyContent: "center", marginTop: -3 }}>
        <View style={{ width: 9, height: 2.5, borderRadius: 1, backgroundColor: c }} />
        <View style={{ position: "absolute", width: 2.5, height: 9, borderRadius: 1, backgroundColor: c }} />
      </View>
      {/* Assessment sound waves when casting */}
      {castFlash && (
        <View style={{ position: "absolute", right: -8, top: 16, gap: 2 }}>
          {[3, 5, 7].map((h, i) => (
            <View key={i} style={{ width: 1.5, height: h, borderRadius: 1, backgroundColor: "#60A5FA70", marginBottom: 1 }} />
          ))}
        </View>
      )}
    </View>
  );
}

function MistCasterSprite({ castFlash }: { castFlash: boolean }) {
  const c = castFlash ? "#fff" : "#F59E0B";
  const bg = castFlash ? "#F59E0B99" : "#F59E0B28";
  return (
    <View style={{ alignItems: "center" }}>
      {castFlash && (
        <View style={{ position: "absolute", top: -2, width: 44, height: 48, borderRadius: 12,
          borderWidth: 1.5, borderColor: "#F59E0B55", zIndex: -1 }} />
      )}
      {/* Conical hat */}
      <View style={{ width: 22, height: 7, borderRadius: 4, backgroundColor: "#1e3a5f",
        borderWidth: 1, borderColor: c + "70", marginBottom: -2 }} />
      {/* Head */}
      <View style={{ width: 16, height: 14, borderRadius: 999, backgroundColor: "#fde68a",
        borderWidth: 1, borderColor: "#d97706", alignItems: "center", justifyContent: "center" }}>
        <View style={{ flexDirection: "row", gap: 3 }}>
          <View style={{ width: 2.5, height: 3, borderRadius: 2, backgroundColor: "#1e3a5f" }} />
          <View style={{ width: 2.5, height: 3, borderRadius: 2, backgroundColor: "#1e3a5f" }} />
        </View>
      </View>
      {/* Robe body */}
      <View style={{ width: 22, height: 26, borderRadius: 9, borderTopLeftRadius: 4,
        borderTopRightRadius: 4, backgroundColor: bg, borderWidth: 1.5, borderColor: c,
        alignItems: "center", justifyContent: "center", marginTop: -3 }}>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, borderWidth: 1.5, borderColor: c }} />
        {/* Mist effect when casting */}
        {castFlash && [0, 6, 12].map((top, i) => (
          <View key={i} style={{ position: "absolute", top, right: -6, width: 5, height: 1.5,
            borderRadius: 1, backgroundColor: c + "88" }} />
        ))}
      </View>
    </View>
  );
}

function O2HealerSprite({ castFlash }: { castFlash: boolean }) {
  const c = castFlash ? "#fff" : "#34D399";
  const bg = castFlash ? "#34D39999" : "#34D39928";
  return (
    <View style={{ alignItems: "center" }}>
      {castFlash && (
        <View style={{ position: "absolute", top: -4, width: 46, height: 46, borderRadius: 23,
          borderWidth: 1.5, borderColor: "#34D39950", zIndex: -1 }} />
      )}
      {/* Head with O₂ label */}
      <View style={{ width: 18, height: 16, borderRadius: 999, backgroundColor: "#fde68a",
        borderWidth: 1, borderColor: "#d97706", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: c, fontSize: 5.5, fontWeight: "700", marginTop: -1 }}>O₂</Text>
        <View style={{ flexDirection: "row", gap: 4, marginTop: 1 }}>
          <View style={{ width: 2.5, height: 3, borderRadius: 2, backgroundColor: "#1e3a5f" }} />
          <View style={{ width: 2.5, height: 3, borderRadius: 2, backgroundColor: "#1e3a5f" }} />
        </View>
      </View>
      {/* Round body */}
      <View style={{ width: 24, height: 22, borderRadius: 999, backgroundColor: bg,
        borderWidth: 1.5, borderColor: c, alignItems: "center", justifyContent: "center", marginTop: -4 }}>
        {/* O₂ canister */}
        <View style={{ width: 8, height: 12, borderRadius: 4, backgroundColor: "#0a1428",
          borderWidth: 1, borderColor: c + "90" }} />
        {/* AoE ring when casting */}
        {castFlash && (
          <View style={{ position: "absolute", width: 36, height: 36, borderRadius: 18,
            borderWidth: 1, borderColor: c + "55" }} />
        )}
      </View>
    </View>
  );
}

function UnitSprite({ typeId, castFlash }: { typeId: string; castFlash: boolean }) {
  switch (typeId) {
    case "ward_scout":  return <WardScoutSprite castFlash={castFlash} />;
    case "mist_caster": return <MistCasterSprite castFlash={castFlash} />;
    case "o2_healer":   return <O2HealerSprite castFlash={castFlash} />;
    default: return <View style={{ width: 22, height: 28, borderRadius: 6, backgroundColor: "#334155" }} />;
  }
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
  tileIdx, unit, selectedUnit, canAfford, onPress, aw, ah,
}: {
  tileIdx: number; unit: DeployedUnit | undefined;
  selectedUnit: string; canAfford: boolean;
  onPress: () => void; aw: number; ah: number;
}) {
  const [fx, fy] = DEPLOY_TILES[tileIdx];
  const px = fx * aw, py = fy * ah;
  const selColor = UNIT_DATA[selectedUnit]?.color ?? "#60A5FA";
  const isOccupied = !!unit;
  const unitColor = isOccupied ? UNIT_DATA[unit!.typeId].color : selColor;

  return (
    <Pressable
      style={{
        position: "absolute",
        left: px - TILE_SIZE / 2, top: py - TILE_SIZE / 2,
        width: TILE_SIZE, height: TILE_SIZE,
        borderRadius: 10,
        backgroundColor: isOccupied ? unitColor + "18" : canAfford ? selColor + "14" : "#0a182888",
        borderWidth: isOccupied ? 2 : 1.5,
        borderColor: isOccupied ? unitColor + "70" : canAfford ? selColor + "55" : "#1a3050",
        alignItems: "center", justifyContent: "center", zIndex: 4,
      }}
      onPress={onPress}
    >
      {isOccupied ? (
        <>
          <UnitSprite typeId={unit!.typeId} castFlash={unit!.castFlash > 0} />
          {/* Range ring (faint) */}
          <View style={{ position: "absolute", width: UNIT_DATA[unit!.typeId].range * 2 * aw,
            height: UNIT_DATA[unit!.typeId].range * 2 * aw,
            borderRadius: UNIT_DATA[unit!.typeId].range * aw,
            borderWidth: 1, borderColor: unitColor + "15",
            backgroundColor: unitColor + "05", zIndex: -1 }} />
        </>
      ) : (
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          {/* Tile rune cross */}
          <View style={{ width: 10, height: 2.5, borderRadius: 1.5, backgroundColor: selColor + (canAfford ? "45" : "20") }} />
          <View style={{ position: "absolute", width: 2.5, height: 10, borderRadius: 1.5, backgroundColor: selColor + (canAfford ? "45" : "20") }} />
        </View>
      )}
    </Pressable>
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
      left: cx - 4, top: cy - 4,
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: p.color,
      opacity: 0.9 + p.progress * 0.1,
      zIndex: 10,
    }} />
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HAND PANEL — Deploy units + use abilities
   ═══════════════════════════════════════════════════════════════════ */
function HandPanel({
  mode, setMode, selectedUnit, onSelectUnit, onUseAbility, ap, isPlaying,
}: {
  mode: "deploy" | "abilities";
  setMode: (m: "deploy" | "abilities") => void;
  selectedUnit: string;
  onSelectUnit: (typeId: string) => void;
  onUseAbility: (id: string) => void;
  ap: number;
  isPlaying: boolean;
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
          UNIT_TYPES.map(typeId => {
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
          })
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
        if (cd > 0) return { ...u, cooldown: cd, castFlash: cf };
        const uPos = getUnitPosFrac(u.tileIndex);
        const uDef = UNIT_DATA[u.typeId];
        let tgt: ActiveEnemy | null = null, minD = Infinity;
        for (const e of movedEnemies) {
          const d = distFrac(uPos, getEnemyPosFrac(e));
          if (d <= uDef.range && d < minD) { minD = d; tgt = e; }
        }
        if (!tgt) return { ...u, cooldown: 0, castFlash: cf };
        const ePos = getEnemyPosFrac(tgt);
        newProjectiles = [...newProjectiles, {
          uid: `p${s.tickCount}_${u.uid}`,
          toEnemyUid: tgt.uid,
          fromFx: uPos.x, fromFy: uPos.y,
          toFx: ePos.x, toFy: ePos.y,
          progress: 0, color: uDef.color,
          damage: uDef.damage, unitTypeId: u.typeId,
        }];
        return { ...u, cooldown: uDef.attackSpeed, castFlash: 2 };
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
      deployedUnits: [...s.deployedUnits, { uid: `u${s.uidSeed}`, typeId: selectedUnit, tileIndex: tileIdx, cooldown: 0, castFlash: 0 }],
      uidSeed: s.uidSeed + 1,
      feedbacks: [{ id: fid, text: `${uDef.name} deployed — ${uDef.flavor}`, color: uDef.color, quality: "bonus" as any, ticks: 5 }, ...s.feedbacks.slice(0, 1)],
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

      {/* Arena board */}
      <View style={s.ward} onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        setArena({ w: width, h: height });
      }}>
        {/* Illustrated background */}
        <ExpoImage
          source={require("../assets/images/ward_battle_bg.png")}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
        {/* Dark board overlay for readability */}
        <LinearGradient
          colors={["#00000045", "#00000028"]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Path road S-curve */}
        <PathRoad aw={arena.w} ah={arena.h} />

        {/* Board endpoints */}
        <CorruptionGate aw={arena.w} ah={arena.h} />
        <VitalLanternBoard stability={gs.stability} aw={arena.w} ah={arena.h} />

        {/* Deployment tiles */}
        {DEPLOY_TILES.map((_, i) => (
          <DeploymentTileView
            key={i} tileIdx={i}
            unit={gs.deployedUnits.find(u => u.tileIndex === i)}
            selectedUnit={selectedUnit}
            canAfford={gs.ap >= UNIT_DATA[selectedUnit]?.apCost}
            onPress={() => deployUnit(i)}
            aw={arena.w} ah={arena.h}
          />
        ))}

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
      />

    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LOBBY SCREEN
   ═══════════════════════════════════════════════════════════════════ */
function LobbyScreen({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>
      <Image source={require("../assets/images/ward_lobby_bg.png")}
        style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={["#00000000", "#00000000", "#010610cc", "#010610f0"]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject} />
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

        <Pressable style={s.enterBtn} onPress={onStart}>
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
  ward: { flex: 1, overflow: "hidden", position: "relative" },
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
