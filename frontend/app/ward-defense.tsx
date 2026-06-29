import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const { width: SW } = Dimensions.get("window");

/* ═══════════════════════════════════════════════════════════
   WARD DEFENSE: AIRWAY CODE RUSH — Bronchospasm Siege
   ═══════════════════════════════════════════════════════════ */

/* ── Constants (UNCHANGED) ── */
const TICK_MS         = 650;
const LANE_STEPS      = 14;
const MAX_STABILITY   = 100;
const MAX_AP          = 10;
const INIT_AP         = 5;
const AP_REGEN_TICKS  = 3;
const WAVE_PAUSE_TICKS = 5;
const SPAWN_GAP_TICKS  = 4;

/* ── Enemy catalogue (UNCHANGED) ── */
type EnemyDef = {
  name: string; icon: string; maxHp: number;
  speed: number; damage: number; color: string;
  weakness: string[]; partial: string[];
  isBoss?: boolean; flavor: string;
};

const ENEMY_DATA: Record<string, EnemyDef> = {
  breathless_wisp: {
    name: "Breathless Wisp", icon: "💨",
    maxHp: 36, speed: 0.8, damage: 8, color: "#60A5FA",
    weakness: ["breath_sound_scout", "bronchodilator_mist"],
    partial:  ["reassess_breath"],
    flavor: "Restricts airflow — early assessment reveals its pattern.",
  },
  wheeze_sprite: {
    name: "Wheeze Sprite", icon: "🌀",
    maxHp: 50, speed: 0.9, damage: 10, color: "#34D399",
    weakness: ["bronchodilator_mist", "reassess_breath"],
    partial:  ["breath_sound_scout"],
    flavor: "Tight airways create the wheezing audible on auscultation.",
  },
  mucus_slime: {
    name: "Mucus Slime", icon: "🫧",
    maxHp: 65, speed: 0.6, damage: 12, color: "#86EFAC",
    weakness: ["positioning_charm", "breath_sound_scout"],
    partial:  ["bronchodilator_mist"],
    flavor: "Secretion buildup — positioning aids drainage.",
  },
  hypoxia_wraith: {
    name: "Hypoxia Wraith", icon: "👻",
    maxHp: 76, speed: 1.0, damage: 15, color: "#C4B5FD",
    weakness: ["oxygen_ward", "reassess_breath"],
    partial:  ["positioning_charm"],
    flavor: "Oxygen deprivation — supplemental O₂ is the direct counter.",
  },
  bronchospasm_drake: {
    name: "Bronchospasm Drake", icon: "🐲",
    maxHp: 180, speed: 0.38, damage: 28, color: "#F97316",
    weakness: ["bronchodilator_mist", "positioning_charm"],
    partial:  ["oxygen_ward", "reassess_breath"],
    isBoss: true,
    flavor: "Severe bronchospasm incarnate. Bronchodilators are essential.",
  },
};

/* ── Card catalogue (UNCHANGED) ── */
type CardDef = {
  name: string; icon: string; desc: string;
  apCost: number; damage: number; color: string;
  feedback: string; aoe: boolean; category: string;
};

const CARD_DATA: Record<string, CardDef> = {
  breath_sound_scout: {
    name: "Breath Sound Scout", icon: "🔊", desc: "Assess & disrupt",
    apCost: 2, damage: 22, color: "#60A5FA", aoe: false, category: "ASSESS",
    feedback: "Wheezing suggests narrowed airways — a hallmark of bronchospasm.",
  },
  oxygen_ward: {
    name: "Oxygen Ward", icon: "🫁", desc: "Boost oxygenation",
    apCost: 3, damage: 28, color: "#34D399", aoe: false, category: "SUPPORT",
    feedback: "O₂ improves saturation but may not treat the underlying cause.",
  },
  bronchodilator_mist: {
    name: "Bronchodilator Mist", icon: "💨", desc: "Relax airway spasm",
    apCost: 4, damage: 44, color: "#F59E0B", aoe: false, category: "TREAT",
    feedback: "Bronchodilators relax smooth muscle — the direct treatment for bronchospasm.",
  },
  positioning_charm: {
    name: "Positioning Charm", icon: "🛌", desc: "Upright position",
    apCost: 2, damage: 20, color: "#A78BFA", aoe: true, category: "SUPPORT",
    feedback: "Upright positioning reduces work of breathing and aids lung expansion.",
  },
  reassess_breath: {
    name: "Reassess Breath", icon: "🔄", desc: "Verify response",
    apCost: 3, damage: 32, color: "#EC4899", aoe: false, category: "ASSESS",
    feedback: "Reassessment confirms whether your intervention improved the patient.",
  },
};

const HAND = Object.keys(CARD_DATA);

/* ── Wave definitions (UNCHANGED) ── */
type WaveDef = { spawns: string[]; isBoss?: boolean };
const WAVES: WaveDef[] = [
  { spawns: ["breathless_wisp", "breathless_wisp"] },
  { spawns: ["breathless_wisp", "wheeze_sprite", "breathless_wisp"] },
  { spawns: ["wheeze_sprite", "mucus_slime", "wheeze_sprite"] },
  { spawns: ["mucus_slime", "hypoxia_wraith", "wheeze_sprite"] },
  { spawns: ["hypoxia_wraith", "mucus_slime", "hypoxia_wraith", "wheeze_sprite"] },
  { spawns: ["bronchospasm_drake"], isBoss: true },
];

/* ── State types (UNCHANGED) ── */
type ActiveEnemy = {
  uid: string; typeId: string;
  hp: number; maxHp: number;
  progress: number;
  hitFlash: number;
};

type Feedback = { id: string; text: string; color: string; quality: "strong"|"partial"|"weak"; ticks: number };

type Phase = "lobby" | "playing" | "wave_pause" | "won" | "lost";

type GS = {
  phase: Phase;
  wave: number;
  stability: number;
  ap: number; apTimer: number;
  enemies: ActiveEnemy[];
  spawnQueue: string[];
  spawnTimer: number;
  wavePauseTicks: number;
  feedbacks: Feedback[];
  score: number;
  tickCount: number;
  uidSeed: number;
};

/* ── Helpers (UNCHANGED) ── */
function freshState(): GS {
  return {
    phase: "lobby", wave: 0,
    stability: MAX_STABILITY,
    ap: INIT_AP, apTimer: AP_REGEN_TICKS,
    enemies: [], spawnQueue: [], spawnTimer: 0,
    wavePauseTicks: 0, feedbacks: [],
    score: 0, tickCount: 0, uidSeed: 0,
  };
}

function beginWave(gs: GS, waveIdx: number): GS {
  return {
    ...gs,
    wave: waveIdx, phase: "playing",
    spawnQueue: [...WAVES[waveIdx].spawns],
    spawnTimer: 0, enemies: [],
    feedbacks: [], wavePauseTicks: 0,
  };
}

function getMatchQuality(cardId: string, enemy: ActiveEnemy): "strong" | "partial" | "weak" {
  const def = ENEMY_DATA[enemy.typeId];
  if (def.weakness.includes(cardId)) return "strong";
  if (def.partial.includes(cardId))  return "partial";
  return "weak";
}

function applyCard(cardId: string, enemies: ActiveEnemy[]): {
  enemies: ActiveEnemy[]; dmgDealt: number;
  feedback: string; fColor: string; quality: "strong"|"partial"|"weak";
} {
  if (enemies.length === 0) return { enemies, dmgDealt: 0, feedback: "", fColor: "", quality: "weak" };

  const card = CARD_DATA[cardId];
  const sorted = [...enemies].sort((a, b) => a.progress - b.progress);
  const target = sorted[0];
  const quality = getMatchQuality(cardId, target);
  const base = card.damage;
  const primaryDmg = quality === "strong" ? base : quality === "partial" ? Math.round(base * 0.55) : Math.round(base * 0.25);

  let newEnemies: ActiveEnemy[];
  let totalDmg = 0;

  if (card.aoe) {
    newEnemies = enemies.map(e => {
      const d = e.uid === target.uid ? primaryDmg : Math.round(primaryDmg * 0.6);
      totalDmg += d;
      return { ...e, hp: e.hp - d, hitFlash: 4 };
    }).filter(e => e.hp > 0);
  } else {
    totalDmg = primaryDmg;
    newEnemies = enemies
      .map(e => e.uid === target.uid ? { ...e, hp: e.hp - primaryDmg, hitFlash: 4 } : e)
      .filter(e => e.hp > 0);
  }

  const targetName = ENEMY_DATA[target.typeId].name;
  let feedback: string;
  let fColor: string;
  if (quality === "strong") {
    feedback = `✦ Effective! ${card.feedback}`;
    fColor = COLORS.success;
  } else if (quality === "partial") {
    feedback = `◈ Partial match. ${card.feedback}`;
    fColor = COLORS.warning;
  } else {
    feedback = `◌ Weak match. Try a more targeted order. ${card.feedback}`;
    fColor = COLORS.onSurfaceTertiary;
  }

  return { enemies: newEnemies, dmgDealt: totalDmg, feedback, fColor, quality };
}

function calcRewards(won: boolean, stability: number, score: number) {
  if (won) {
    const bonus = Math.floor(stability / 20);
    return {
      codexShards: 18 + bonus * 3,
      playerXp: 60 + bonus * 6,
      heroXp: 22 + bonus * 2,
      airCatalyst: bonus + 1,
    };
  }
  return { codexShards: 5, playerXp: 15, heroXp: 6, airCatalyst: 0 };
}

/* ═══════════════════════════════════════════════════════════
   ASSET COMPONENTS
   Each block is clearly separated so future art can replace
   individual components with real sprite sheets independently.
   ═══════════════════════════════════════════════════════════ */

/* ── [ASSET: backgroundScene] Airway Ward Corridor
   Atmosphere-first 2.5D design: sky-as-canvas, organic vault shapes,
   radial bloom light sources, round orb lanterns.
   Replace with a real parallax sprite sheet when art is ready. ── */
function WardCorridorScene() {
  return (
    <>
      {/* ══ LAYER 1 — Deep sky atmosphere (background) ══ */}
      <LinearGradient
        colors={["#010610", "#020a1a", "#030c1e", "#020913"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Far ward sanctum bloom — life-light of the inner sanctum, visible through the arch */}
      {/* Outermost halo — very diffuse, wide */}
      <LinearGradient
        colors={["#60A5FA22", "#3b82f614", "#00000000"]}
        style={{ position: "absolute", top: "4%", left: "6%", right: "6%", height: "58%", borderRadius: 999 }}
      />
      {/* Mid bloom ring */}
      <LinearGradient
        colors={["#60A5FA55", "#3b82f630", "#00000000"]}
        style={{ position: "absolute", top: "16%", left: "24%", right: "24%", height: "44%", borderRadius: 999 }}
      />
      {/* Inner bright bloom */}
      <LinearGradient
        colors={["#93C5FD99", "#60A5FA70", "#00000000"]}
        style={{ position: "absolute", top: "26%", left: "36%", right: "36%", height: "28%", borderRadius: 999 }}
      />
      {/* Bright core — the ward's eye */}
      <LinearGradient
        colors={["#dbeafe", "#bfdbfebb", "#60A5FA55", "#00000000"]}
        style={{ position: "absolute", top: "34%", left: "44%", right: "44%", height: 18, borderRadius: 999 }}
      />

      {/* ══ Far arch portal silhouette (behind the bloom) ══ */}
      <View style={{
        position: "absolute", left: "32%", top: "13%",
        width: 10, height: "57%",
        backgroundColor: "#010810",
        borderTopLeftRadius: 5, borderTopRightRadius: 5,
      }} />
      <View style={{
        position: "absolute", right: "32%", top: "13%",
        width: 10, height: "57%",
        backgroundColor: "#010810",
        borderTopLeftRadius: 5, borderTopRightRadius: 5,
      }} />
      {/* Arch crown keystone */}
      <View style={{
        position: "absolute", top: "8%", left: "31%", right: "31%",
        height: 30, borderTopLeftRadius: 999, borderTopRightRadius: 999,
        backgroundColor: "#010810",
      }} />

      {/* ══ LAYER 2 — Vault ceiling (organic arch masses, NOT rectangles) ══ */}
      {/* Left vault wing — large borderRadius creates organic stone arch shape */}
      <View style={{
        position: "absolute", top: 0, left: 0, width: "46%", height: "58%",
        backgroundColor: "#020a1a", borderBottomRightRadius: 240,
      }} />
      {/* Right vault wing */}
      <View style={{
        position: "absolute", top: 0, right: 0, width: "46%", height: "58%",
        backgroundColor: "#020a1a", borderBottomLeftRadius: 240,
      }} />
      {/* Centre cap — ensures the crown of the vault is solid */}
      <View style={{
        position: "absolute", top: 0, left: "32%", right: "32%", height: "18%",
        backgroundColor: "#020a1a",
      }} />

      {/* Vault rib accent — cathedral rib emanating from each arch */}
      <LinearGradient
        colors={["#60A5FA18", "#00000000"]}
        start={{ x: 1, y: 0.2 }} end={{ x: 0, y: 1 }}
        style={{ position: "absolute", top: "28%", left: "36%", width: "14%", height: "32%", borderBottomRightRadius: 999 }}
      />
      <LinearGradient
        colors={["#60A5FA18", "#00000000"]}
        start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: "28%", right: "36%", width: "14%", height: "32%", borderBottomLeftRadius: 999 }}
      />

      {/* ══ Side wall masses ══ */}
      {/* Left wall (patient/core side) */}
      <View style={{ position: "absolute", left: 0, top: "44%", bottom: 0, width: "7%", backgroundColor: "#020912" }} />
      {/* Left wall inner glow (life-light reflected on near wall) */}
      <LinearGradient
        colors={["#60A5FA30", "#60A5FA14", "#00000000"]}
        start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }}
        style={{ position: "absolute", left: "7%", top: "44%", bottom: 0, width: "7%" }}
      />
      {/* Right wall (spawn/enemy side) */}
      <View style={{ position: "absolute", right: 0, top: "40%", bottom: 0, width: "7%", backgroundColor: "#010810" }} />
      {/* Right wall spawn shimmer */}
      <LinearGradient
        colors={["#F9731618", "#F9731610", "#00000000"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: "absolute", right: "7%", top: "40%", bottom: 0, width: "7%" }}
      />

      {/* ══ Hanging lanterns — true round orbs ══ */}
      {/* Lantern A — left (near core), pendant wire */}
      <View style={{ position: "absolute", left: "10%", top: 0, width: 1, height: "34%", backgroundColor: "#0e2840" }} />
      <View style={{
        position: "absolute", left: "7.5%", top: "31%",
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: "#091a30", borderWidth: 2, borderColor: "#93C5FD99",
        alignItems: "center", justifyContent: "center",
      }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#BAE6FDee" }} />
      </View>
      <LinearGradient colors={["#60A5FA60", "#60A5FA28", "#00000000"]}
        style={{ position: "absolute", left: "3%", top: "24%", width: "18%", height: "26%", borderRadius: 999 }} />

      {/* Lantern B — centre-left, slightly larger */}
      <View style={{ position: "absolute", left: "35%", top: 0, width: 1, height: "30%", backgroundColor: "#0e2840" }} />
      <View style={{
        position: "absolute", left: "32%", top: "26%",
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: "#091a30", borderWidth: 2, borderColor: "#BAE6FDbb",
        alignItems: "center", justifyContent: "center",
      }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#dbeafeee" }} />
      </View>
      <LinearGradient colors={["#93C5FD65", "#60A5FA30", "#00000000"]}
        style={{ position: "absolute", left: "26%", top: "17%", width: "22%", height: "32%", borderRadius: 999 }} />

      {/* Lantern C — centre-right */}
      <View style={{ position: "absolute", right: "25%", top: 0, width: 1, height: "28%", backgroundColor: "#0e2840" }} />
      <View style={{
        position: "absolute", right: "22%", top: "24%",
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: "#091a30", borderWidth: 2, borderColor: "#BAE6FDbb",
        alignItems: "center", justifyContent: "center",
      }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#dbeafeee" }} />
      </View>
      <LinearGradient colors={["#93C5FD65", "#60A5FA30", "#00000000"]}
        style={{ position: "absolute", right: "14%", top: "15%", width: "22%", height: "32%", borderRadius: 999 }} />

      {/* ══ LAYER 3 — Floor / lane pathway ══ */}
      {/* Floor slab */}
      <LinearGradient
        colors={["#020c1c", "#030f24", "#060f20"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: "absolute", bottom: 0, left: "7%", right: "7%", height: "38%" }}
      />
      {/* Floor horizon — bright crease where wall meets floor */}
      <View style={{ position: "absolute", bottom: "38%", left: "7%", right: "7%", height: 1.5, backgroundColor: "#60A5FA38" }} />
      <LinearGradient
        colors={["#60A5FA18", "#60A5FA55", "#93C5FD40", "#60A5FA18"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: "absolute", bottom: "37.5%", left: "7%", right: "7%", height: 1 }}
      />
      {/* Perspective lane lines — converge toward far arch */}
      {[0.10, 0.26, 0.50, 0.74, 0.90].map((frac, i) => (
        <View key={i} style={{
          position: "absolute", bottom: 0,
          left: `${7 + frac * 86}%` as any, width: 0.5, height: "38%",
          backgroundColor: "#60A5FA16",
        }} />
      ))}
      {/* Horizontal runework lines */}
      <View style={{ position: "absolute", bottom: "28%", left: "7%", right: "7%", height: 0.5, backgroundColor: "#60A5FA28" }} />
      <View style={{ position: "absolute", bottom: "19%", left: "7%", right: "7%", height: 0.5, backgroundColor: "#60A5FA20" }} />
      <View style={{ position: "absolute", bottom: "10%", left: "7%", right: "7%", height: 0.5, backgroundColor: "#60A5FA14" }} />
      {/* Floor rune circles (healing glyphs embedded in stone) */}
      {[{l:"18%",b:"22%"},{l:"40%",b:"16%"},{l:"60%",b:"22%"},{l:"78%",b:"14%"}].map((p, i) => (
        <View key={i} style={{
          position: "absolute", left: p.l as any, bottom: p.b as any,
          width: 18, height: 18, borderRadius: 9,
          borderWidth: 0.5, borderColor: "#60A5FA35",
        }} />
      ))}

      {/* Atmospheric motes — floating air particles */}
      {[{t:"40%",l:"16%"},{t:"35%",l:"36%"},{t:"48%",l:"56%"},{t:"38%",l:"74%"},{t:"52%",l:"88%"}].map((p, i) => (
        <View key={i} style={{
          position: "absolute", top: p.t as any, left: p.l as any,
          width: i % 2 === 0 ? 3 : 2, height: i % 2 === 0 ? 3 : 2, borderRadius: 2,
          backgroundColor: i % 3 === 0 ? "#93C5FD65" : i % 3 === 1 ? "#60A5FA45" : "#BAE6FD38",
        }} />
      ))}

      {/* Spawn-side warm shimmer — enemies enter from right */}
      <LinearGradient
        colors={["#00000000", "#F9731618"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "22%" }}
      />
      {/* Bottom ground vignette */}
      <LinearGradient
        colors={["#00000000", "#010810bb"]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "20%" }}
      />
    </>
  );
}

/* ── [ASSET: effectAsset] Card cast effect burst ── */
function CardEffectBurst({
  animVal, color, quality,
}: { animVal: Animated.Value; color: string; quality: "strong"|"partial"|"weak" }) {
  const scale = animVal.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 1.4, 0.6] });
  const opacity = animVal.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.85, 0] });
  const ringScale = animVal.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.2] });
  const ringOpacity = animVal.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 0.3, 0] });

  if (quality === "weak") {
    return (
      <Animated.View style={{
        position: "absolute", top: "30%", left: "38%",
        width: 48, height: 48, alignItems: "center", justifyContent: "center",
        opacity, transform: [{ scale }],
      }}>
        {/* Dull dim spark for weak/wrong */}
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#6b7280" + "44",
          borderWidth: 1.5, borderColor: "#6b7280" }} />
        <View style={{ position: "absolute", width: 12, height: 12, borderRadius: 6,
          backgroundColor: "#9ca3af" + "55" }} />
      </Animated.View>
    );
  }

  return (
    <>
      {/* Expanding ring */}
      <Animated.View style={{
        position: "absolute", top: "20%", left: "35%",
        width: 60, height: 60, borderRadius: 30,
        borderWidth: 2, borderColor: color,
        opacity: ringOpacity,
        transform: [{ scale: ringScale }],
      }} />
      {/* Core burst */}
      <Animated.View style={{
        position: "absolute", top: "28%", left: "41%",
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: color + "45",
        opacity, transform: [{ scale }],
        alignItems: "center", justifyContent: "center",
      }}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: color + "90" }} />
      </Animated.View>
      {/* Star sparks (strong only) */}
      {quality === "strong" && [
        {dx:-18,dy:-12},{dx:18,dy:-12},{dx:-16,dy:8},{dx:16,dy:8},{dx:0,dy:-22},
      ].map((p, i) => (
        <Animated.View key={i} style={{
          position: "absolute", top: "34%", left: "46%",
          width: 6, height: 6, borderRadius: 3, backgroundColor: color,
          opacity, transform: [{ translateX: p.dx * (animVal as any) }, { translateY: p.dy * (animVal as any) }],
        }} />
      ))}
    </>
  );
}

/* ── [ASSET: enemySprite] Semi-chibi 2.5D enemy sprites (pure RN Views)
   Replace each function below with a real sprite Image when art is ready.
   Asset IDs: breathless_wisp | wheeze_sprite | mucus_slime | hypoxia_wraith | bronchospasm_drake ── */

type SpriteProps = { hitFlash: boolean; bobY: Animated.AnimatedInterpolation<number> };

function BreathlessWispSprite({ hitFlash, bobY }: SpriteProps) {
  const c = hitFlash ? "#ffffff" : "#93C5FD";
  const bg = hitFlash ? "#60A5FA66" : "#60A5FA22";
  return (
    <Animated.View style={{ alignItems: "center", transform: [{ translateY: bobY }] }}>
      {/* [ASSET: enemySprite: breathless_wisp] Pale blue gasping wind spirit */}
      {/* Upper wisps */}
      <View style={{ flexDirection: "row", gap: 5, marginBottom: -4 }}>
        {[-6, 0, 6].map((rot, i) => (
          <View key={i} style={{ width: 2.5, height: 8 + (i === 1 ? 4 : 0), borderRadius: 2,
            backgroundColor: "#60A5FA70", transform: [{ rotate: `${rot}deg` }] }} />
        ))}
      </View>
      {/* Main oval body */}
      <View style={{ width: 34, height: 42, borderRadius: 999,
        backgroundColor: bg, borderWidth: 1.5, borderColor: c,
        alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {/* Inner glow */}
        <View style={{ position: "absolute", top: "15%", left: "20%", width: "60%", height: "40%",
          borderRadius: 999, backgroundColor: "#e0f2fe44" }} />
        {/* Eyes — wide and gasping */}
        <View style={{ flexDirection: "row", gap: 9, marginTop: -6 }}>
          <View style={{ width: 6, height: 7, borderRadius: 4, backgroundColor: "#1e3a5f" }} />
          <View style={{ width: 6, height: 7, borderRadius: 4, backgroundColor: "#1e3a5f" }} />
        </View>
        {/* Gasping O mouth */}
        <View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 1.5,
          borderColor: "#1e3a5f", marginTop: 5 }} />
      </View>
      {/* Bottom wisps */}
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
      {/* [ASSET: enemySprite: wheeze_sprite] Twisted whistling air spirit */}
      {/* Top spike rings */}
      <View style={{ flexDirection: "row", gap: 3, marginBottom: -6 }}>
        {[{h:8,rot:-18},{h:12,rot:-6},{h:10,rot:8},{h:7,rot:20}].map((sp, i) => (
          <View key={i} style={{ width: 2.5, height: sp.h, borderRadius: 2,
            backgroundColor: "#34D39960", transform: [{ rotate: `${sp.rot}deg` }] }} />
        ))}
      </View>
      {/* Twisted body — wider on one side */}
      <View style={{ width: 38, height: 44, borderRadius: 16,
        borderTopLeftRadius: 999, borderTopRightRadius: 8, borderBottomRightRadius: 999, borderBottomLeftRadius: 12,
        backgroundColor: bg, borderWidth: 1.5, borderColor: c,
        alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {/* Swirl lines */}
        <View style={{ position: "absolute", top: "18%", left: "8%", right: "8%", height: 1,
          backgroundColor: "#34D39940", transform: [{ rotate: "-12deg" }] }} />
        <View style={{ position: "absolute", top: "40%", left: "8%", right: "8%", height: 1,
          backgroundColor: "#34D39940", transform: [{ rotate: "8deg" }] }} />
        <View style={{ position: "absolute", top: "62%", left: "8%", right: "8%", height: 1,
          backgroundColor: "#34D39930", transform: [{ rotate: "-6deg" }] }} />
        {/* Slanted angry eyes */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: -8, transform: [{ rotate: "-6deg" }] }}>
          <View style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: "#065f46",
            transform: [{ rotate: "10deg" }] }} />
          <View style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: "#065f46",
            transform: [{ rotate: "-10deg" }] }} />
        </View>
        {/* Narrow whistle mouth */}
        <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: "#065f46", marginTop: 6 }} />
      </View>
      {/* Wind vent lines */}
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
      {/* [ASSET: enemySprite: mucus_slime] Translucent blue-green bubble slime */}
      {/* Main blob body */}
      <View style={{ width: 42, height: 38, borderRadius: 999,
        backgroundColor: bg, borderWidth: 1.5, borderColor: c,
        alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {/* Shiny highlight */}
        <View style={{ position: "absolute", top: "12%", right: "18%", width: 10, height: 8,
          borderRadius: 999, backgroundColor: "#ffffff35" }} />
        {/* Smaller inner bubble */}
        <View style={{ position: "absolute", top: "30%", left: "12%", width: 8, height: 7,
          borderRadius: 999, backgroundColor: "#86EFAC22", borderWidth: 1, borderColor: "#86EFAC50" }} />
        {/* Dot eyes */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
          <View style={{ width: 5, height: 6, borderRadius: 3, backgroundColor: "#065f46" }} />
          <View style={{ width: 5, height: 6, borderRadius: 3, backgroundColor: "#065f46" }} />
        </View>
        {/* Wide smile */}
        <View style={{ marginTop: 3, flexDirection: "row", gap: 1 }}>
          {[2, 3, 3, 2].map((h, i) => (
            <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: "#065f46" }} />
          ))}
        </View>
      </View>
      {/* Blobby bottom drip */}
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
      {/* [ASSET: enemySprite: hypoxia_wraith] Dim blue oxygen-draining ghost */}
      {/* Ghostly tall body */}
      <View style={{ width: 30, height: 52, borderTopLeftRadius: 999, borderTopRightRadius: 999,
        borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
        backgroundColor: bg, borderWidth: 1.5, borderColor: c + "90",
        alignItems: "center", overflow: "hidden" }}>
        {/* Dim inner fade */}
        <LinearGradient colors={["#A78BFA18", "#00000000"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: "60%" }} />
        {/* Hollow empty eyes */}
        <View style={{ flexDirection: "row", gap: 7, marginTop: 10 }}>
          <View style={{ width: 7, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: "#3b0764" }} />
          <View style={{ width: 7, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: "#3b0764" }} />
        </View>
        {/* Wisping mouth */}
        <View style={{ width: 10, height: 2, borderRadius: 1, backgroundColor: "#3b0764", marginTop: 6 }} />
        {/* Oxygen drain vortex lines */}
        <View style={{ position: "absolute", bottom: "18%", left: "10%", right: "10%", height: 1,
          backgroundColor: "#A78BFA35" }} />
        <View style={{ position: "absolute", bottom: "28%", left: "14%", right: "14%", height: 0.5,
          backgroundColor: "#A78BFA25" }} />
      </View>
      {/* Tattered bottom — 3 phantom wisps */}
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
      {/* [ASSET: enemySprite: bronchospasm_drake] BOSS — constricting wind-ring dragon */}
      {/* Outer wind ring halos */}
      <View style={{ position: "absolute", top: -6, alignSelf: "center",
        width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: "#F9731628" }} />
      <View style={{ position: "absolute", top: 4, alignSelf: "center",
        width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: "#F9731640" }} />
      {/* Dark corruption crystal clusters (bottom) */}
      <View style={{ flexDirection: "row", gap: 3, marginBottom: -5, zIndex: 2 }}>
        {[{w:6,h:14,rot:-18},{w:8,h:18,rot:-6},{w:10,h:22,rot:0},{w:8,h:16,rot:6},{w:6,h:12,rot:18}].map((cr, i) => (
          <View key={i} style={{ width: cr.w, height: cr.h, borderRadius: 2,
            backgroundColor: i === 2 ? "#1e3a78" : "#162860",
            borderWidth: 1, borderColor: "#60A5FA55",
            transform: [{ rotate: `${cr.rot}deg` }] }} />
        ))}
      </View>
      {/* Main drake body */}
      <View style={{ width: 52, height: 52, borderRadius: 14,
        backgroundColor: bg, borderWidth: 2, borderColor: c,
        alignItems: "center", justifyContent: "center", zIndex: 3 }}>
        {/* Scales texture */}
        <View style={{ position: "absolute", top: "18%", left: "10%", right: "10%", height: 1,
          backgroundColor: "#F9731640" }} />
        <View style={{ position: "absolute", top: "36%", left: "10%", right: "10%", height: 1,
          backgroundColor: "#F9731630" }} />
        <View style={{ position: "absolute", top: "54%", left: "10%", right: "10%", height: 1,
          backgroundColor: "#F9731625" }} />
        {/* Drake eyes — fierce */}
        <View style={{ flexDirection: "row", gap: 14, marginTop: -8 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#7c2d12",
            borderWidth: 1.5, borderColor: "#fbbf24" }} />
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#7c2d12",
            borderWidth: 1.5, borderColor: "#fbbf24" }} />
        </View>
        {/* Snout */}
        <View style={{ width: 18, height: 8, borderRadius: 4,
          backgroundColor: "#7c2d1288", borderWidth: 1, borderColor: c, marginTop: 5 }}>
          {/* Nostrils */}
          <View style={{ flexDirection: "row", justifyContent: "space-around", paddingTop: 2 }}>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#431407" }} />
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#431407" }} />
          </View>
        </View>
        {/* Crown/horns */}
        <View style={{ position: "absolute", top: -6, flexDirection: "row", gap: 12 }}>
          <View style={{ width: 5, height: 10, borderRadius: 3, backgroundColor: "#1e40af",
            transform: [{ rotate: "-14deg" }] }} />
          <View style={{ width: 7, height: 14, borderRadius: 3, backgroundColor: "#1d4ed8" }} />
          <View style={{ width: 5, height: 10, borderRadius: 3, backgroundColor: "#1e40af",
            transform: [{ rotate: "14deg" }] }} />
        </View>
      </View>
      {/* HP label for boss */}
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
    default: return <View style={{ width: 36, height: 48, borderRadius: 8, backgroundColor: "#334155" }} />;
  }
}

/* ── [ASSET: heroBattleSprite] Semi-chibi healer defending the core
   Foreground portrait layer — visually separate from background via glow halo.
   Replace with a real sprite Image when art is ready. ── */
function HeroBattleSprite({ bob }: { bob: Animated.Value }) {
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  return (
    <Animated.View style={[s.heroBattlePos, { transform: [{ translateY: bobY }] }]}>
      {/* ── Portrait backing halo — separates hero from background scene ── */}
      {/* Outer soft aura */}
      <LinearGradient
        colors={["#60A5FA20", "#60A5FA10", "#00000000"]}
        style={{
          position: "absolute", top: -32, left: -20, right: -24,
          bottom: -14, borderRadius: 999,
        }}
      />
      {/* Inner glow ring */}
      <View style={{
        position: "absolute", top: -24, left: -14, right: -18, bottom: -10,
        borderRadius: 999,
        borderWidth: 1, borderColor: "#60A5FA30",
        backgroundColor: "#60A5FA08",
      }} />

      {/* [ASSET: heroBattleSprite] Healer chibi defending patient core */}
      {/* Staff */}
      <View style={{ position: "absolute", right: -6, top: -8, width: 3.5, height: 60,
        backgroundColor: "#c4b5fd", borderRadius: 2 }}>
        <View style={{ position: "absolute", top: -5, left: -4, width: 11, height: 11,
          borderRadius: 6, backgroundColor: "#7c3aed", borderWidth: 1.5, borderColor: "#ddd6fe" }} />
        {/* Staff gem glow */}
        <LinearGradient colors={["#a78bfa60", "#a78bfa20", "#00000000"]}
          style={{ position: "absolute", top: -10, left: -8, width: 20, height: 28, borderRadius: 999 }} />
      </View>

      {/* Cloak/body */}
      <View style={{ width: 40, height: 48, borderRadius: 12,
        borderTopLeftRadius: 5, borderTopRightRadius: 5,
        backgroundColor: "#1e3a5f", borderWidth: 1.5, borderColor: "#60A5FAaa",
        alignItems: "center", overflow: "hidden" }}>
        {/* Cloak trim band */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8,
          backgroundColor: "#1d4ed8" }} />
        {/* Medical cross on chest */}
        <View style={{ marginTop: 16, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 13, height: 3.5, borderRadius: 2, backgroundColor: "#60A5FA" }} />
          <View style={{ position: "absolute", width: 3.5, height: 13, borderRadius: 2, backgroundColor: "#60A5FA" }} />
        </View>
        {/* Collar line */}
        <View style={{ position: "absolute", top: 8, left: "22%", right: "22%", height: 1,
          backgroundColor: "#93C5FD50" }} />
        {/* Inner body sheen */}
        <LinearGradient colors={["#60A5FA12", "#00000000"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", borderRadius: 10 }} />
      </View>

      {/* Head */}
      <View style={{ position: "absolute", top: -26, left: 4, width: 32, height: 30,
        borderRadius: 999, backgroundColor: "#fde68a",
        borderWidth: 1.5, borderColor: "#d97706",
        alignItems: "center", justifyContent: "center" }}>
        {/* Eyes */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: -2 }}>
          <View style={{ width: 5, height: 6, borderRadius: 3, backgroundColor: "#1e3a5f" }} />
          <View style={{ width: 5, height: 6, borderRadius: 3, backgroundColor: "#1e3a5f" }} />
        </View>
        {/* Determined mouth */}
        <View style={{ width: 8, height: 2.5, borderRadius: 1, backgroundColor: "#92400e", marginTop: 4 }} />
        {/* Healer cap */}
        <View style={{ position: "absolute", top: -9, left: -3, right: -3, height: 13,
          backgroundColor: "#1d4ed8", borderRadius: 6 }}>
          <View style={{ position: "absolute", top: 3, left: "25%", right: "25%", alignItems: "center" }}>
            <View style={{ width: 10, height: 2.5, borderRadius: 1, backgroundColor: "#60A5FA" }} />
            <View style={{ position: "absolute", width: 2.5, height: 8, borderRadius: 1, backgroundColor: "#60A5FA" }} />
          </View>
        </View>
        {/* Face sheen */}
        <View style={{ position: "absolute", top: "12%", left: "14%", width: "38%", height: "30%",
          borderRadius: 999, backgroundColor: "#ffffff25" }} />
      </View>

      {/* ── Ground shadow — anchors hero onto the corridor floor ── */}
      <View style={{
        width: 44, height: 10, borderRadius: 999,
        backgroundColor: "#000000",
        opacity: 0.35,
        marginTop: -6,
        alignSelf: "center",
      }} />
      <LinearGradient colors={["#60A5FA28", "#00000000"]}
        style={{ width: 56, height: 10, borderRadius: 999, marginTop: -4, alignSelf: "center" }} />
    </Animated.View>
  );
}

/* ── Vital Lantern (Patient Core) — glowing healing shrine ── */
function VitalLantern({ stability }: { stability: number }) {
  const glow = stability > 60 ? "#34D399" : stability > 30 ? "#FBBF24" : "#F87171";
  return (
    <View style={s.vitalLanternPos}>
      {/* Outermost aura bloom */}
      <LinearGradient colors={[glow + "30", "#00000000"]}
        style={{ position: "absolute", top: -24, left: -22, width: 78, height: 78, borderRadius: 999 }} />
      {/* Mid glow ring */}
      <LinearGradient colors={[glow + "55", "#00000000"]}
        style={{ position: "absolute", top: -14, left: -12, width: 58, height: 58, borderRadius: 999 }} />
      {/* Shrine pedestal base */}
      <View style={{ width: 26, height: 8, borderRadius: 4, backgroundColor: "#0c1e38",
        borderWidth: 1, borderColor: glow + "60", marginBottom: -2 }} />
      {/* Shrine orb — round, glowing */}
      <View style={{ width: 32, height: 32, borderRadius: 16,
        backgroundColor: "#091830", borderWidth: 2, borderColor: glow,
        alignItems: "center", justifyContent: "center" }}>
        {/* Inner fill glow */}
        <LinearGradient colors={[glow + "99", glow + "44"]}
          style={{ position: "absolute", top: 2, left: 2, right: 2, bottom: 2, borderRadius: 999 }} />
        {/* Medical cross */}
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 13, height: 3.5, borderRadius: 2, backgroundColor: "#fff" }} />
          <View style={{ position: "absolute", width: 3.5, height: 13, borderRadius: 2, backgroundColor: "#fff" }} />
        </View>
        {/* Inner sheen */}
        <View style={{ position: "absolute", top: "14%", left: "16%", width: "36%", height: "28%",
          borderRadius: 999, backgroundColor: "#ffffff28" }} />
      </View>
      {/* Ground shadow */}
      <View style={{ width: 36, height: 8, borderRadius: 999, backgroundColor: "#000000",
        opacity: 0.3, marginTop: -2, alignSelf: "center" }} />
      {/* Stability micro bar */}
      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#0a1428",
        marginTop: 6, overflow: "hidden" }}>
        <View style={{ width: `${stability}%` as any, height: "100%", borderRadius: 2, backgroundColor: glow }} />
      </View>
    </View>
  );
}

/* ── [ASSET: cardIcon] Clinical Talisman Card ── */
function TalismanCard({
  cardId, canAfford, hasTargets, isPlaying, onPress,
}: {
  cardId: string; canAfford: boolean; hasTargets: boolean;
  isPlaying: boolean; onPress: () => void;
}) {
  const card = CARD_DATA[cardId];
  const active = canAfford && hasTargets && isPlaying;
  const c = active ? card.color : COLORS.onSurfaceTertiary;

  return (
    <Pressable
      style={[s.talismanCard, {
        borderColor: active ? card.color + "80" : COLORS.border,
        backgroundColor: active ? "#080e18" : "#060a12",
        opacity: active ? 1 : 0.42,
      }]}
      onPress={onPress}
      disabled={!active}
    >
      {/* Category badge top */}
      <View style={[s.cardCatBadge, { backgroundColor: active ? card.color + "28" : "transparent" }]}>
        <Text style={[s.cardCatTxt, { color: c }]}>{card.category}</Text>
        {card.aoe && <Text style={[s.cardCatTxt, { color: c }]}> · AoE</Text>}
      </View>

      {/* Icon circle — the talisman rune */}
      <View style={[s.cardIconCircle, {
        borderColor: active ? card.color + "70" : COLORS.border,
        backgroundColor: active ? card.color + "18" : COLORS.surfaceTertiary,
      }]}>
        <Text style={s.cardIconEmoji}>{card.icon}</Text>
        {/* Corner rune marks */}
        <View style={{ position: "absolute", top: 2, left: 2, width: 4, height: 4,
          borderTopWidth: 1, borderLeftWidth: 1, borderColor: c + "60" }} />
        <View style={{ position: "absolute", top: 2, right: 2, width: 4, height: 4,
          borderTopWidth: 1, borderRightWidth: 1, borderColor: c + "60" }} />
        <View style={{ position: "absolute", bottom: 2, left: 2, width: 4, height: 4,
          borderBottomWidth: 1, borderLeftWidth: 1, borderColor: c + "60" }} />
        <View style={{ position: "absolute", bottom: 2, right: 2, width: 4, height: 4,
          borderBottomWidth: 1, borderRightWidth: 1, borderColor: c + "60" }} />
      </View>

      {/* Card name */}
      <Text style={[s.cardNameTxt, { color: active ? card.color : COLORS.onSurfaceTertiary }]}
        numberOfLines={2}>
        {card.name}
      </Text>

      {/* AP rune cost */}
      <View style={[s.apRune, { backgroundColor: active ? card.color + "25" : "transparent",
        borderColor: active ? card.color + "60" : COLORS.border }]}>
        <Text style={[s.apRuneTxt, { color: c }]}>{card.apCost}</Text>
        <Text style={[s.apRuneLabel, { color: c + "CC" }]}>AP</Text>
      </View>
    </Pressable>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT (game logic UNCHANGED — visual layer only)
   ══════════════════════════════════════════════════════════ */
export default function WardDefense() {
  const router = useRouter();
  const { player, applyRewards } = usePlayer();

  const gsRef   = useRef<GS>(freshState());
  const [, bump] = useState(0);
  const rewardsApplied = useRef(false);

  const gs = gsRef.current;

  function set(next: GS) { gsRef.current = next; bump(t => t + 1); }

  /* ── Idle bob animation (shared across all enemy sprites) ── */
  const bobAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bobAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
      Animated.timing(bobAnim, { toValue: 0, duration: 900, useNativeDriver: false }),
    ])).start();
  }, []);

  /* ── Card cast effect ── */
  const effectAnim = useRef(new Animated.Value(0)).current;
  const effectColorRef = useRef("#60A5FA");
  const effectQualRef  = useRef<"strong"|"partial"|"weak">("weak");
  const [showEffect, setShowEffect] = useState(false);

  function triggerEffect(color: string, quality: "strong"|"partial"|"weak") {
    effectColorRef.current = color;
    effectQualRef.current  = quality;
    setShowEffect(true);
    effectAnim.setValue(0);
    Animated.sequence([
      Animated.timing(effectAnim, { toValue: 1, duration: 280, useNativeDriver: false }),
      Animated.timing(effectAnim, { toValue: 0, duration: 420, useNativeDriver: false }),
    ]).start(() => setShowEffect(false));
  }

  /* ── Game tick (UNCHANGED logic) ── */
  useEffect(() => {
    const iv = setInterval(() => {
      const s = gsRef.current;

      if (s.phase === "wave_pause") {
        const pt = s.wavePauseTicks - 1;
        if (pt <= 0) {
          const nw = s.wave + 1;
          if (nw >= WAVES.length) set({ ...s, phase: "won" });
          else set(beginWave(s, nw));
        } else {
          set({ ...s, wavePauseTicks: pt });
        }
        return;
      }

      if (s.phase !== "playing") return;

      let ns: GS = { ...s, tickCount: s.tickCount + 1 };

      const at = ns.apTimer - 1;
      if (at <= 0 && ns.ap < MAX_AP) {
        ns = { ...ns, ap: ns.ap + 1, apTimer: AP_REGEN_TICKS };
      } else {
        ns = { ...ns, apTimer: Math.max(0, at) };
      }

      let { spawnQueue, spawnTimer, enemies, uidSeed } = ns;
      spawnTimer -= 1;
      if (spawnTimer <= 0 && spawnQueue.length > 0) {
        const typeId = spawnQueue[0];
        enemies = [...enemies, {
          uid: `e${uidSeed}`, typeId,
          hp: ENEMY_DATA[typeId].maxHp, maxHp: ENEMY_DATA[typeId].maxHp,
          progress: LANE_STEPS, hitFlash: 0,
        }];
        spawnQueue = spawnQueue.slice(1);
        spawnTimer = SPAWN_GAP_TICKS;
        uidSeed += 1;
      }
      ns = { ...ns, spawnQueue, spawnTimer, enemies, uidSeed };

      const reached: ActiveEnemy[] = [];
      const alive: ActiveEnemy[] = [];
      for (const e of ns.enemies) {
        const np = e.progress - ENEMY_DATA[e.typeId].speed;
        const nf = Math.max(0, e.hitFlash - 1);
        if (np <= 0) reached.push(e);
        else alive.push({ ...e, progress: np, hitFlash: nf });
      }

      let { stability } = ns;
      for (const e of reached) stability = Math.max(0, stability - ENEMY_DATA[e.typeId].damage);

      const feedbacks = ns.feedbacks.map(f => ({ ...f, ticks: f.ticks - 1 })).filter(f => f.ticks > 0);
      ns = { ...ns, enemies: alive, stability, feedbacks };

      if (stability <= 0)        { set({ ...ns, phase: "lost" }); return; }

      if (ns.spawnQueue.length === 0 && ns.enemies.length === 0) {
        const nw = ns.wave + 1;
        if (nw >= WAVES.length) set({ ...ns, phase: "won" });
        else set({ ...ns, phase: "wave_pause", wavePauseTicks: WAVE_PAUSE_TICKS });
        return;
      }

      set(ns);
    }, TICK_MS);
    return () => clearInterval(iv);
  }, []);

  /* ── Apply rewards (UNCHANGED) ── */
  useEffect(() => {
    if ((gs.phase === "won" || gs.phase === "lost") && !rewardsApplied.current && player) {
      rewardsApplied.current = true;
      const r = calcRewards(gs.phase === "won", gs.stability, gs.score);
      applyRewards({ xp: r.playerXp, codexShards: r.codexShards }).catch(() => {});
    }
  }, [gs.phase, player]);

  /* ── Start / replay (UNCHANGED) ── */
  function startGame() {
    rewardsApplied.current = false;
    set(beginWave({ ...freshState(), stability: MAX_STABILITY, ap: INIT_AP, apTimer: AP_REGEN_TICKS }, 0));
  }

  /* ── Play a card (UNCHANGED logic + effect trigger) ── */
  function playCard(cardId: string) {
    const s = gsRef.current;
    if (s.phase !== "playing") return;
    const card = CARD_DATA[cardId];
    if (s.ap < card.apCost) return;
    const activeEnemies = s.enemies.filter(e => e.progress < LANE_STEPS);
    if (activeEnemies.length === 0) return;

    const { enemies: newEnemies, dmgDealt, feedback, fColor, quality } = applyCard(cardId, s.enemies);
    const fid = String(Date.now());
    const feedbacks: Feedback[] = feedback
      ? [{ id: fid, text: feedback, color: fColor, quality, ticks: 8 }, ...s.feedbacks.slice(0, 1)]
      : s.feedbacks;

    triggerEffect(card.color, quality);
    set({ ...s, ap: s.ap - card.apCost, enemies: newEnemies, feedbacks, score: s.score + dmgDealt });
  }

  const waveDef = WAVES[gs.wave] ?? WAVES[WAVES.length - 1];
  const rewards = calcRewards(gs.phase === "won", gs.stability, gs.score);

  /* ── Lobby ── */
  if (gs.phase === "lobby") {
    return <LobbyScreen onStart={startGame} onBack={() => router.back()} />;
  }

  /* ── Result ── */
  if (gs.phase === "won" || gs.phase === "lost") {
    return (
      <ResultScreen
        won={gs.phase === "won"}
        wave={gs.wave}
        stability={gs.stability}
        score={gs.score}
        rewards={rewards}
        onReplay={startGame}
        onBack={() => router.back()}
      />
    );
  }

  /* ── Active game screen — 2.5D visual ── */
  const hasActiveEnemies = gs.enemies.some(e => e.progress < LANE_STEPS);
  const stabilityColor = gs.stability > 60 ? COLORS.success : gs.stability > 30 ? COLORS.warning : COLORS.error;

  const bobY = bobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>

      {/* ══ HUD STRIP ══ */}
      <View style={s.hud}>
        {/* Back */}
        <Pressable style={s.hudBack} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={16} color={COLORS.onSurface} />
        </Pressable>

        {/* Wave label */}
        <View style={s.hudWave}>
          <Text style={s.hudKicker}>AIRWAY WARD</Text>
          {gs.phase === "wave_pause" ? (
            <Text style={[s.hudWaveTxt, { color: COLORS.air }]}>↺ Next wave…</Text>
          ) : waveDef.isBoss ? (
            <Text style={[s.hudWaveTxt, { color: COLORS.error }]}>⚠ BOSS</Text>
          ) : (
            <Text style={s.hudWaveTxt}>Wave {gs.wave + 1} / {WAVES.length}</Text>
          )}
        </View>

        {/* Stability bar */}
        <View style={s.hudStability}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
            <Text style={s.hudBarLabel}>STABILITY</Text>
            <Text style={[s.hudBarVal, { color: stabilityColor }]}>{gs.stability}</Text>
          </View>
          <View style={s.hudStabilityBg}>
            <View style={[s.hudStabilityFill, {
              width: `${gs.stability}%` as any, backgroundColor: stabilityColor,
            }]} />
          </View>
        </View>

        {/* AP gems */}
        <View style={s.hudAp}>
          <Text style={s.hudBarLabel}>AP {gs.ap}</Text>
          <View style={s.hudGemRow}>
            {Array.from({ length: MAX_AP }).map((_, i) => (
              <View key={i} style={[s.hudGem, {
                backgroundColor: i < gs.ap ? COLORS.runeGold : COLORS.surfaceTertiary,
              }]} />
            ))}
          </View>
        </View>
      </View>

      {/* ══ WARD SCENE ══ */}
      <View style={s.ward}>
        {/* [ASSET: backgroundScene] */}
        <WardCorridorScene />

        {/* Vital Lantern — patient core, left/far end */}
        <VitalLantern stability={gs.stability} />

        {/* Hero battle sprite — guarding the core */}
        <HeroBattleSprite bob={bobAnim} />

        {/* Enemies on lane */}
        {gs.enemies.map((e) => {
          const def = ENEMY_DATA[e.typeId];
          const pct = Math.max(0, Math.min(1, (e.progress - 0.5) / (LANE_STEPS - 1)));
          // 2.5D: enemies scale up as they approach core (left), shrink as they spawn (right)
          const scale = 0.72 + (1 - pct) * 0.28;
          const leftPct = 14 + pct * 64;
          const topPct  = 30 + (1 - pct) * 20;
          const hpPct   = Math.round((e.hp / e.maxHp) * 100);

          return (
            <View key={e.uid} style={{
              position: "absolute",
              left: `${leftPct}%` as any,
              top: `${topPct}%` as any,
              transform: [{ scale }],
              alignItems: "center",
              zIndex: Math.round((1 - pct) * 10),
            }}>
              {/* Boss HP number above sprite */}
              {def.isBoss && (
                <Text style={{ color: def.color, fontSize: 9, fontWeight: "700",
                  marginBottom: 2, textShadowColor: "#000", textShadowRadius: 3 }}>
                  {e.hp} HP
                </Text>
              )}

              {/* Enemy sprite */}
              <EnemySprite
                typeId={e.typeId}
                hitFlash={e.hitFlash > 0}
                bobY={bobY}
              />

              {/* HP bar below sprite */}
              <View style={{ width: def.isBoss ? 64 : 40, height: 4, borderRadius: 2,
                backgroundColor: "#0a1428", marginTop: 3, overflow: "hidden" }}>
                <View style={{ width: `${hpPct}%` as any, height: "100%",
                  borderRadius: 2, backgroundColor: def.color }} />
              </View>

              {/* Name chip — show on boss */}
              {def.isBoss && (
                <View style={{ marginTop: 3, backgroundColor: "#0a1428cc",
                  borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ color: def.color, fontSize: 8, fontWeight: "700", letterSpacing: 0.5 }}>
                    BOSS
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Spawn edge warning */}
        {gs.spawnQueue.length > 0 && (
          <View style={s.spawnEdge}>
            <Text style={s.spawnTxt}>⚠ {gs.spawnQueue.length}</Text>
          </View>
        )}

        {/* [ASSET: effectAsset] Card cast burst */}
        {showEffect && (
          <CardEffectBurst
            animVal={effectAnim}
            color={effectColorRef.current}
            quality={effectQualRef.current}
          />
        )}

        {/* Wave pause overlay */}
        {gs.phase === "wave_pause" && (
          <View style={s.pauseOverlay}>
            <LinearGradient colors={["rgba(6,10,20,0.85)", "rgba(6,10,20,0.95)"]} style={StyleSheet.absoluteFillObject} />
            <Text style={s.pauseWaveTxt}>
              {gs.wave + 1 < WAVES.length
                ? (WAVES[gs.wave + 1]?.isBoss ? "⚠  BOSS WAVE INCOMING" : `WAVE ${gs.wave + 2} INCOMING`)
                : "PROCESSING…"}
            </Text>
            <Text style={s.pauseSubTxt}>Ward stabilizing…</Text>
          </View>
        )}
      </View>

      {/* ══ FEEDBACK PANEL ══ */}
      <View style={s.feedbackPanel}>
        {gs.feedbacks.slice(0, 1).map(f => (
          <View key={f.id} style={[s.feedbackRow, { borderLeftColor: f.color }]}>
            <Text style={[s.feedbackTxt, { color: f.color }]} numberOfLines={2}>{f.text}</Text>
          </View>
        ))}
        {gs.feedbacks.length === 0 && (
          <Text style={s.feedbackHint}>Select a clinical order to intervene.</Text>
        )}
      </View>

      {/* ══ CARD HAND — Clinical Talismans ══ */}
      <View style={s.hand}>
        {HAND.map(cardId => (
          <TalismanCard
            key={cardId}
            cardId={cardId}
            canAfford={gs.ap >= CARD_DATA[cardId].apCost}
            hasTargets={hasActiveEnemies}
            isPlaying={gs.phase === "playing"}
            onPress={() => playCard(cardId)}
          />
        ))}
      </View>

    </SafeAreaView>
  );
}

/* ══════════════════════════════════════════════════════════
   LOBBY SCREEN — atmospheric Airway Ward
   ══════════════════════════════════════════════════════════ */
function LobbyScreen({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>
      {/* ── Lobby atmospheric background — full ward corridor scene ── */}
      <LinearGradient colors={["#010610", "#020a1a", "#030c1e", "#020913"]} style={StyleSheet.absoluteFillObject} />
      {/* Central sanctum bloom */}
      <LinearGradient colors={["#60A5FA28", "#3b82f618", "#00000000"]}
        style={{ position: "absolute", top: "3%", left: "8%", right: "8%", height: "50%", borderRadius: 999 }} />
      <LinearGradient colors={["#93C5FD55", "#60A5FA30", "#00000000"]}
        style={{ position: "absolute", top: "10%", left: "26%", right: "26%", height: "32%", borderRadius: 999 }} />
      <LinearGradient colors={["#bfdbfeaa", "#60A5FA55", "#00000000"]}
        style={{ position: "absolute", top: "18%", left: "40%", right: "40%", height: "18%", borderRadius: 999 }} />
      {/* Far arch silhouette */}
      <View style={{ position: "absolute", left: "32%", top: "6%", width: 9, height: "40%",
        backgroundColor: "#010810", borderTopLeftRadius: 5, borderTopRightRadius: 5 }} />
      <View style={{ position: "absolute", right: "32%", top: "6%", width: 9, height: "40%",
        backgroundColor: "#010810", borderTopLeftRadius: 5, borderTopRightRadius: 5 }} />
      <View style={{ position: "absolute", top: "3%", left: "31%", right: "31%", height: 26,
        borderTopLeftRadius: 999, borderTopRightRadius: 999, backgroundColor: "#010810" }} />
      {/* Organic vault ceiling — left and right wings */}
      <View style={{ position: "absolute", top: 0, left: 0, width: "44%", height: "44%",
        backgroundColor: "#020a1a", borderBottomRightRadius: 200 }} />
      <View style={{ position: "absolute", top: 0, right: 0, width: "44%", height: "44%",
        backgroundColor: "#020a1a", borderBottomLeftRadius: 200 }} />
      <View style={{ position: "absolute", top: 0, left: "32%", right: "32%", height: "14%",
        backgroundColor: "#020a1a" }} />
      {/* Left orb lantern */}
      <View style={{ position: "absolute", left: "9%", top: 0, width: 1, height: "26%", backgroundColor: "#0e2840" }} />
      <View style={{ position: "absolute", left: "6.5%", top: "23%", width: 22, height: 22, borderRadius: 11,
        backgroundColor: "#091a30", borderWidth: 2, borderColor: "#93C5FD99",
        alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#BAE6FDee" }} />
      </View>
      <LinearGradient colors={["#60A5FA50", "#60A5FA22", "#00000000"]}
        style={{ position: "absolute", left: "2%", top: "16%", width: "16%", height: "22%", borderRadius: 999 }} />
      {/* Right orb lantern */}
      <View style={{ position: "absolute", right: "9%", top: 0, width: 1, height: "24%", backgroundColor: "#0e2840" }} />
      <View style={{ position: "absolute", right: "6.5%", top: "21%", width: 22, height: 22, borderRadius: 11,
        backgroundColor: "#091a30", borderWidth: 2, borderColor: "#93C5FD99",
        alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#BAE6FDee" }} />
      </View>
      <LinearGradient colors={["#60A5FA50", "#60A5FA22", "#00000000"]}
        style={{ position: "absolute", right: "2%", top: "14%", width: "16%", height: "22%", borderRadius: 999 }} />

      <ScrollView contentContainerStyle={s.lobbyContent} showsVerticalScrollIndicator={false}>

        <Pressable style={s.hudBack} onPress={onBack} hitSlop={10}>
          <Ionicons name="arrow-back" size={16} color={COLORS.onSurface} />
        </Pressable>

        {/* Hero art area */}
        <View style={s.lobbyHeroArea}>
          {/* Simple ward emblem */}
          <View style={s.lobbyEmblem}>
            <LinearGradient colors={["#0e2040", "#081828"]} style={StyleSheet.absoluteFillObject} />
            <View style={{ width: 48, height: 14, borderRadius: 2, backgroundColor: "#60A5FA" }} />
            <View style={{ position: "absolute", width: 14, height: 48, borderRadius: 2, backgroundColor: "#60A5FA" }} />
            {/* Corner accents */}
            {[{t:4,l:4},{t:4,r:4},{b:4,l:4},{b:4,r:4}].map((p, i) => (
              <View key={i} style={{
                position: "absolute",
                top: (p as any).t, bottom: (p as any).b,
                left: (p as any).l, right: (p as any).r,
                width: 8, height: 8,
                borderTopWidth: (p as any).t !== undefined ? 1.5 : 0,
                borderBottomWidth: (p as any).b !== undefined ? 1.5 : 0,
                borderLeftWidth: (p as any).l !== undefined ? 1.5 : 0,
                borderRightWidth: (p as any).r !== undefined ? 1.5 : 0,
                borderColor: "#60A5FA80",
              }} />
            ))}
          </View>
          <Text style={s.lobbyKicker}>WARD DEFENSE · AIRWAY CODE RUSH</Text>
          <Text style={s.lobbyTitle}>Bronchospasm Siege</Text>
          <Text style={s.lobbySubtitle}>5 Waves + Boss · Airway Ward</Text>
          {/* Difficulty indicator */}
          <View style={{ flexDirection: "row", gap: 5, marginTop: 4 }}>
            {["⬡","⬡","⬡","⬡","◎"].map((d, i) => (
              <Text key={i} style={{ color: i < 3 ? COLORS.air : i < 4 ? COLORS.warning : COLORS.error, fontSize: 11 }}>{d}</Text>
            ))}
            <Text style={{ color: COLORS.onSurfaceTertiary, fontSize: 10 }}> Moderate</Text>
          </View>
        </View>

        {/* Mission */}
        <View style={s.lobbyCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.air }} />
            <Text style={s.lobbySectionTitle}>MISSION</Text>
          </View>
          <Text style={s.lobbyBodyTxt}>
            Bronchospasm corruption spreads through the Airway Ward. Disease-spirits march toward the
            <Text style={{ color: COLORS.air }}> Vital Lantern</Text> — your patient's life core.
          </Text>
          <Text style={[s.lobbyBodyTxt, { marginTop: 8 }]}>
            Play clinical orders to counter each spirit. Correct interventions deal full damage and unlock
            nursing insight. Mismatched orders still act but at reduced power.
          </Text>
        </View>

        {/* Enemy roster */}
        <View style={s.lobbyCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.error }} />
            <Text style={s.lobbySectionTitle}>DISEASE SPIRITS</Text>
          </View>
          {Object.entries(ENEMY_DATA).map(([, def]) => (
            <View key={def.name} style={s.lobbyListRow}>
              <View style={[s.lobbyEnemyChip, { borderColor: def.color + "55", backgroundColor: def.color + "12" }]}>
                <Text style={{ fontSize: 16 }}>{def.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[s.lobbyListName, { color: def.color }]}>{def.name}</Text>
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

        {/* Clinical orders */}
        <View style={s.lobbyCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.brand }} />
            <Text style={s.lobbySectionTitle}>CLINICAL ORDERS</Text>
          </View>
          {Object.entries(CARD_DATA).map(([, card]) => (
            <View key={card.name} style={s.lobbyListRow}>
              <View style={[s.lobbyEnemyChip, { borderColor: card.color + "55", backgroundColor: card.color + "12" }]}>
                <Text style={{ fontSize: 14 }}>{card.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[s.lobbyListName, { color: card.color }]}>{card.name}</Text>
                  <View style={{ backgroundColor: card.color + "20", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ color: card.color, fontSize: 8, fontWeight: "700" }}>
                      {card.apCost} AP{card.aoe ? " · AoE" : ""}
                    </Text>
                  </View>
                </View>
                <Text style={s.lobbyListDesc}>{card.feedback}</Text>
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

/* ══════════════════════════════════════════════════════════
   RESULT SCREEN
   ══════════════════════════════════════════════════════════ */
function ResultScreen({
  won, wave, stability, score, rewards, onReplay, onBack,
}: {
  won: boolean; wave: number; stability: number; score: number;
  rewards: ReturnType<typeof calcRewards>;
  onReplay: () => void; onBack: () => void;
}) {
  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={won ? ["#041c10", "#062a18", "#041410"] : ["#180608", "#26090c", "#120406"]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Atmospheric rays */}
      <LinearGradient
        colors={won ? ["#34D39920", "#00000000"] : ["#F8717120", "#00000000"]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: "45%" }}
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
              <Text style={[s.rewardVal, { color: r.val > 0 ? COLORS.brand : COLORS.onSurfaceTertiary }]}>
                +{r.val}
              </Text>
            </View>
          ))}
        </View>

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

/* ══════════════════════════════════════════════════════════
   STYLES
   ══════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#040c18" },

  /* ── HUD ── */
  hud: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
    backgroundColor: "#040c18",
    borderBottomWidth: 1, borderColor: "#1a3050",
  },
  hudBack: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#0a1828", borderWidth: 1, borderColor: "#1a3050",
    alignItems: "center", justifyContent: "center",
  },
  hudWave:   { width: 76 },
  hudKicker: { color: COLORS.air, fontSize: 8, fontWeight: "700", letterSpacing: 1.5 },
  hudWaveTxt:{ color: COLORS.onSurface, fontSize: 12, fontWeight: "700" },

  hudStability: { flex: 1 },
  hudBarLabel:  { color: COLORS.onSurfaceTertiary, fontSize: 8, fontWeight: "700", letterSpacing: 1.5 },
  hudBarVal:    { fontSize: 9, fontWeight: "700" },
  hudStabilityBg:   { height: 7, backgroundColor: "#0a1428", borderRadius: 4, overflow: "hidden" },
  hudStabilityFill: { height: "100%", borderRadius: 4 },

  hudAp:    { width: 72 },
  hudGemRow:{ flexDirection: "row", flexWrap: "wrap", gap: 2, marginTop: 3 },
  hudGem:   { width: 6, height: 6, borderRadius: 3 },

  /* ── Ward scene ── */
  ward: { flex: 1, overflow: "hidden", position: "relative" },

  /* Vital Lantern position — sits in the lane at the core end */
  vitalLanternPos: {
    position: "absolute", left: 6, top: "44%",
    alignItems: "center",
    zIndex: 5,
  },

  /* Hero battle sprite position — foreground portrait, same 2.5D lane depth as near-core enemies */
  heroBattlePos: {
    position: "absolute", left: 38, top: "34%",
    zIndex: 6,
  },

  /* Spawn edge warning */
  spawnEdge: {
    position: "absolute", right: 10, top: "42%",
    backgroundColor: "#2c0a0a",
    borderRadius: 6, borderWidth: 1, borderColor: COLORS.error + "60",
    paddingHorizontal: 6, paddingVertical: 3,
  },
  spawnTxt: { color: COLORS.error, fontSize: 10, fontWeight: "700" },

  /* Wave pause */
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center", gap: 6,
  },
  pauseWaveTxt: { color: COLORS.air, fontSize: 16, fontWeight: "700", letterSpacing: 2 },
  pauseSubTxt:  { color: COLORS.onSurfaceTertiary, fontSize: 11 },

  /* ── Feedback panel ── */
  feedbackPanel: {
    minHeight: 44, paddingHorizontal: SPACING.md,
    justifyContent: "center", backgroundColor: "#040c18",
    borderTopWidth: 1, borderColor: "#0e2040",
  },
  feedbackRow: {
    borderLeftWidth: 2, paddingLeft: SPACING.sm,
  },
  feedbackTxt:  { fontSize: 11, lineHeight: 16, fontWeight: "500" },
  feedbackHint: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontStyle: "italic" },

  /* ── Talisman card hand ── */
  hand: {
    flexDirection: "row", gap: 4,
    paddingHorizontal: SPACING.sm, paddingBottom: SPACING.sm,
    paddingTop: SPACING.xs,
    backgroundColor: "#040c18",
    borderTopWidth: 1, borderColor: "#0e2040",
  },
  talismanCard: {
    flex: 1, alignItems: "center", gap: 3,
    paddingVertical: SPACING.sm, paddingTop: 5,
    borderRadius: RADIUS.md, borderWidth: 1.5,
    minHeight: 118,
  },
  cardCatBadge: {
    flexDirection: "row", borderRadius: 3,
    paddingHorizontal: 4, paddingVertical: 1.5,
    marginBottom: 1,
  },
  cardCatTxt: { fontSize: 7, fontWeight: "700", letterSpacing: 1 },
  cardIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
  },
  cardIconEmoji: { fontSize: 18 },
  cardNameTxt: { fontSize: 8.5, fontWeight: "700", textAlign: "center", lineHeight: 12, paddingHorizontal: 2 },
  apRune: {
    flexDirection: "row", alignItems: "center", gap: 2,
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 7, paddingVertical: 2.5,
    marginTop: 1,
  },
  apRuneTxt:   { fontSize: 12, fontWeight: "700" },
  apRuneLabel: { fontSize: 7, fontWeight: "700", letterSpacing: 0.5, marginTop: 1 },

  /* ── Lobby ── */
  lobbyContent: { padding: SPACING.lg, gap: SPACING.lg },

  lobbyHeroArea: { alignItems: "center", gap: 8, paddingVertical: SPACING.md },
  lobbyEmblem: {
    width: 72, height: 72, borderRadius: 12,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    borderWidth: 1.5, borderColor: "#60A5FA40", marginBottom: 8,
  },
  lobbyKicker:   { color: COLORS.air, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  lobbyTitle:    { color: COLORS.onSurface, fontSize: 26, fontWeight: "300" },
  lobbySubtitle: { color: COLORS.onSurfaceSecondary, fontSize: 13 },

  lobbyCard: {
    backgroundColor: "#080e1c", borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: "#1a3050",
  },
  lobbySectionTitle: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  lobbyBodyTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20 },

  lobbyListRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginBottom: 10 },
  lobbyEnemyChip: {
    width: 36, height: 36, borderRadius: 8, borderWidth: 1,
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

  /* ── Result ── */
  resultContent: { padding: SPACING.xl, alignItems: "center", gap: SPACING.md },
  resultEmoji:   { fontSize: 64, marginTop: SPACING.xl },
  resultTitle:   { fontSize: 24, fontWeight: "700", letterSpacing: 2, textAlign: "center" },
  resultSub:     { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: "center" },

  rewardBox: {
    width: "100%", backgroundColor: "#08101c",
    borderRadius: RADIUS.md, padding: SPACING.lg,
    borderWidth: 1, borderColor: "#1a3050",
  },
  rewardRow:  { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  rewardLbl:  { flex: 1, color: COLORS.onSurfaceSecondary, fontSize: 14 },
  rewardVal:  { fontSize: 18, fontWeight: "700" },
  scoreLine:  { color: COLORS.onSurfaceTertiary, fontSize: 12 },

  exitBtn: {
    width: "100%", borderWidth: 1, borderColor: "#1a3050",
    borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: "center",
  },
  exitBtnTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },
});
