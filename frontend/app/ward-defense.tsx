import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

/* ═══════════════════════════════════════════════════════════
   WARD DEFENSE: CORRUPTION RUSH
   Airway Ward — Bronchospasm Rush (Prototype v1)
   ═══════════════════════════════════════════════════════════ */

const TICK_MS         = 650;
const LANE_STEPS      = 14;
const MAX_STABILITY   = 100;
const MAX_AP          = 10;
const INIT_AP         = 5;
const AP_REGEN_TICKS  = 3;   // 1 AP per 3 ticks (~2 s)
const WAVE_PAUSE_TICKS = 5;  // pause ticks between waves
const SPAWN_GAP_TICKS  = 4;  // ticks between each enemy entering the lane

/* ── Enemy catalogue ── */
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

/* ── Card catalogue ── */
type CardDef = {
  name: string; icon: string; desc: string;
  apCost: number; damage: number; color: string;
  feedback: string; aoe: boolean;
};

const CARD_DATA: Record<string, CardDef> = {
  breath_sound_scout: {
    name: "Breath Sound Scout", icon: "🔊", desc: "Assess & disrupt",
    apCost: 2, damage: 22, color: "#60A5FA", aoe: false,
    feedback: "Wheezing suggests narrowed airways — a hallmark of bronchospasm.",
  },
  oxygen_ward: {
    name: "Oxygen Ward", icon: "🫁", desc: "Boost oxygenation",
    apCost: 3, damage: 28, color: "#34D399", aoe: false,
    feedback: "O₂ improves saturation but may not treat the underlying cause.",
  },
  bronchodilator_mist: {
    name: "Bronchodilator Mist", icon: "💨", desc: "Relax airway spasm",
    apCost: 4, damage: 44, color: "#F59E0B", aoe: false,
    feedback: "Bronchodilators relax smooth muscle — the direct treatment for bronchospasm.",
  },
  positioning_charm: {
    name: "Positioning Charm", icon: "🛌", desc: "Upright position",
    apCost: 2, damage: 20, color: "#A78BFA", aoe: true,
    feedback: "Upright positioning reduces work of breathing and aids lung expansion.",
  },
  reassess_breath: {
    name: "Reassess Breath", icon: "🔄", desc: "Verify response",
    apCost: 3, damage: 32, color: "#EC4899", aoe: false,
    feedback: "Reassessment confirms whether your intervention improved the patient.",
  },
};

const HAND = Object.keys(CARD_DATA);

/* ── Wave definitions ── */
type WaveDef = { spawns: string[]; isBoss?: boolean };
const WAVES: WaveDef[] = [
  { spawns: ["breathless_wisp", "breathless_wisp"] },
  { spawns: ["breathless_wisp", "wheeze_sprite", "breathless_wisp"] },
  { spawns: ["wheeze_sprite", "mucus_slime", "wheeze_sprite"] },
  { spawns: ["mucus_slime", "hypoxia_wraith", "wheeze_sprite"] },
  { spawns: ["hypoxia_wraith", "mucus_slime", "hypoxia_wraith", "wheeze_sprite"] },
  { spawns: ["bronchospasm_drake"], isBoss: true },
];

/* ── State types ── */
type ActiveEnemy = {
  uid: string; typeId: string;
  hp: number; maxHp: number;
  progress: number;   // LANE_STEPS → 0 (core)
  hitFlash: number;   // ticks of white flash on hit
};

type Feedback = { id: string; text: string; color: string; ticks: number };

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

/* ── Helpers ── */
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
  feedback: string; fColor: string;
} {
  if (enemies.length === 0) return { enemies, dmgDealt: 0, feedback: "", fColor: "" };

  const card = CARD_DATA[cardId];
  // Target = most advanced enemy (lowest progress, closest to core)
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
    feedback = `✓ Effective vs ${targetName}! ${card.feedback}`;
    fColor = COLORS.success;
  } else if (quality === "partial") {
    feedback = `~ Partial: ${card.feedback}`;
    fColor = COLORS.warning;
  } else {
    feedback = `Weak match. Try a more targeted card. ${card.feedback}`;
    fColor = COLORS.onSurfaceTertiary;
  }

  return { enemies: newEnemies, dmgDealt: totalDmg, feedback, fColor };
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
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function WardDefense() {
  const router = useRouter();
  const { player, applyRewards } = usePlayer();

  const gsRef   = useRef<GS>(freshState());
  const [, bump] = useState(0);
  const rewardsApplied = useRef(false);

  const gs = gsRef.current;

  function set(next: GS) { gsRef.current = next; bump(t => t + 1); }

  /* ── Game tick ── */
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

      // AP regen
      const at = ns.apTimer - 1;
      if (at <= 0 && ns.ap < MAX_AP) {
        ns = { ...ns, ap: ns.ap + 1, apTimer: AP_REGEN_TICKS };
      } else {
        ns = { ...ns, apTimer: Math.max(0, at) };
      }

      // Spawn queue
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

      // Move enemies + check core
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

  /* ── Apply rewards once on end ── */
  useEffect(() => {
    if ((gs.phase === "won" || gs.phase === "lost") && !rewardsApplied.current && player) {
      rewardsApplied.current = true;
      const r = calcRewards(gs.phase === "won", gs.stability, gs.score);
      applyRewards({ xp: r.playerXp, codexShards: r.codexShards }).catch(() => {});
    }
  }, [gs.phase, player]);

  /* ── Start / replay ── */
  function startGame() {
    rewardsApplied.current = false;
    set(beginWave({ ...freshState(), stability: MAX_STABILITY, ap: INIT_AP, apTimer: AP_REGEN_TICKS }, 0));
  }

  /* ── Play a card ── */
  function playCard(cardId: string) {
    const s = gsRef.current;
    if (s.phase !== "playing") return;
    const card = CARD_DATA[cardId];
    if (s.ap < card.apCost) return;
    const activeEnemies = s.enemies.filter(e => e.progress < LANE_STEPS);
    if (activeEnemies.length === 0) return;

    const { enemies: newEnemies, dmgDealt, feedback, fColor } = applyCard(cardId, s.enemies);
    const fid = String(Date.now());
    const feedbacks: Feedback[] = feedback
      ? [{ id: fid, text: feedback, color: fColor, ticks: 7 }, ...s.feedbacks.slice(0, 1)]
      : s.feedbacks;

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

  /* ── Active game ── */
  const hasActiveEnemies = gs.enemies.some(e => e.progress < LANE_STEPS);

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>

      {/* ── HEADER ── */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={18} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.modeKicker}>AIRWAY WARD DEFENSE</Text>
          {gs.phase === "wave_pause" ? (
            <Text style={[s.waveLabel, { color: COLORS.success }]}>
              Wave {gs.wave + 1} cleared — next wave incoming…
            </Text>
          ) : waveDef.isBoss ? (
            <Text style={[s.waveLabel, { color: COLORS.error }]}>⚠ BOSS WAVE</Text>
          ) : (
            <Text style={s.waveLabel}>Wave {gs.wave + 1} / {WAVES.length}</Text>
          )}
        </View>
        <Text style={s.scoreTag}>{gs.score} dmg</Text>
      </View>

      {/* ── STATUS BARS ── */}
      <View style={s.statusRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={s.barRow}>
            <Text style={s.barLbl}>❤️ STABILITY</Text>
            <Text style={[s.barVal, {
              color: gs.stability > 60 ? COLORS.success : gs.stability > 30 ? COLORS.warning : COLORS.error,
            }]}>{gs.stability}</Text>
          </View>
          <View style={s.barBg}>
            <View style={[s.barFill, {
              width: `${gs.stability}%` as any,
              backgroundColor: gs.stability > 60 ? COLORS.success : gs.stability > 30 ? COLORS.warning : COLORS.error,
            }]} />
          </View>
        </View>
        <View style={s.apBlock}>
          <Text style={s.barLbl}>⚡ AP {gs.ap}/{MAX_AP}</Text>
          <View style={s.gemRow}>
            {Array.from({ length: MAX_AP }).map((_, i) => (
              <View key={i} style={[s.gem, { backgroundColor: i < gs.ap ? COLORS.runeGold : COLORS.surfaceTertiary }]} />
            ))}
          </View>
        </View>
      </View>

      {/* ── LANE ── */}
      <View style={s.lane}>
        <LinearGradient colors={["#0a1422", "#0c1a32", "#0a1222"]} style={StyleSheet.absoluteFillObject} />

        {/* Track path */}
        <View style={s.trackPath} />

        {/* Patient core icon */}
        <View style={s.coreIcon}>
          <Text style={{ fontSize: 24 }}>🏥</Text>
          <View style={[s.coreBar, {
            width: `${gs.stability}%` as any,
            backgroundColor: gs.stability > 60 ? COLORS.success : COLORS.error,
          }]} />
        </View>

        {/* Spawn indicator */}
        <View style={s.spawnEdge}>
          <Text style={{ fontSize: 12, color: COLORS.error + "90" }}>⚠</Text>
        </View>

        {/* Enemies */}
        {gs.enemies.map(e => {
          const def = ENEMY_DATA[e.typeId];
          const pct = Math.max(0, Math.min(1, (e.progress - 0.5) / (LANE_STEPS - 1)));
          const leftPct = 12 + pct * 70;
          const hpPct = Math.round((e.hp / e.maxHp) * 100);
          return (
            <View key={e.uid} style={[
              s.enemyToken,
              def.isBoss && s.bossToken,
              {
                left: `${leftPct}%` as any,
                borderColor: e.hitFlash > 0 ? "#fff" : def.color,
                backgroundColor: e.hitFlash > 0 ? def.color + "55" : def.color + "18",
              },
            ]}>
              <Text style={[s.enemyIcon, def.isBoss && { fontSize: 22 }]}>{def.icon}</Text>
              <View style={s.enemyHpBg}>
                <View style={[s.enemyHpFill, { width: `${hpPct}%` as any, backgroundColor: def.color }]} />
              </View>
              {def.isBoss && (
                <Text style={[s.bossHpTxt, { color: def.color }]}>{e.hp}</Text>
              )}
            </View>
          );
        })}

        {/* Wave pause overlay */}
        {gs.phase === "wave_pause" && (
          <View style={s.pauseOverlay}>
            <Text style={s.pauseTxt}>
              {gs.wave + 1 < WAVES.length
                ? (WAVES[gs.wave + 1]?.isBoss ? "⚠ BOSS WAVE INCOMING" : `WAVE ${gs.wave + 2} INCOMING`)
                : "PROCESSING…"
              }
            </Text>
          </View>
        )}
      </View>

      {/* ── FEEDBACK ── */}
      <View style={s.feedbackArea}>
        {gs.feedbacks.slice(0, 2).map(f => (
          <Text key={f.id} style={[s.feedbackTxt, { color: f.color }]} numberOfLines={2}>
            {f.text}
          </Text>
        ))}
      </View>

      {/* ── ACTIVE ENEMIES ROSTER ── */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={s.roster} contentContainerStyle={{ gap: 6, paddingHorizontal: SPACING.md }}
      >
        {gs.enemies.map(e => {
          const def = ENEMY_DATA[e.typeId];
          return (
            <View key={e.uid} style={[s.rosterChip, { borderColor: def.color + "50" }]}>
              <Text style={{ fontSize: 11 }}>{def.icon}</Text>
              <Text style={[s.rosterName, { color: def.color }]}>{def.name.split(" ")[0]}</Text>
              <Text style={[s.rosterHp, { color: def.color }]}>{e.hp}</Text>
            </View>
          );
        })}
        {gs.spawnQueue.length > 0 && (
          <View style={[s.rosterChip, { borderColor: COLORS.border }]}>
            <Text style={{ fontSize: 11 }}>⏳</Text>
            <Text style={s.rosterName}>{gs.spawnQueue.length} incoming</Text>
          </View>
        )}
        {gs.enemies.length === 0 && gs.spawnQueue.length === 0 && gs.phase === "playing" && (
          <View style={[s.rosterChip, { borderColor: COLORS.success + "50" }]}>
            <Text style={[s.rosterName, { color: COLORS.success }]}>Lane clear</Text>
          </View>
        )}
      </ScrollView>

      {/* ── CARD HAND ── */}
      <View style={s.hand}>
        {HAND.map(cardId => {
          const card = CARD_DATA[cardId];
          const canAfford = gs.ap >= card.apCost;
          const disabled = !canAfford || !hasActiveEnemies || gs.phase !== "playing";
          return (
            <Pressable
              key={cardId}
              style={[
                s.card,
                { borderColor: canAfford && hasActiveEnemies ? card.color + "70" : COLORS.border },
                disabled && s.cardOff,
              ]}
              onPress={() => playCard(cardId)}
              disabled={disabled}
            >
              <Text style={s.cardIcon}>{card.icon}</Text>
              <Text
                style={[s.cardName, { color: canAfford && hasActiveEnemies ? card.color : COLORS.onSurfaceTertiary }]}
                numberOfLines={2}
              >
                {card.name}
              </Text>
              <View style={[s.apPill, { backgroundColor: canAfford ? card.color + "28" : COLORS.surfaceTertiary }]}>
                <Text style={[s.apPillTxt, { color: canAfford ? card.color : COLORS.onSurfaceTertiary }]}>
                  {card.apCost} AP
                </Text>
              </View>
              {card.aoe && <Text style={[s.aoeTag, { color: card.color }]}>AoE</Text>}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════
   LOBBY SCREEN
   ═══════════════════════════════════════════════════════════ */
function LobbyScreen({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>
      <LinearGradient colors={["#08121e", "#0c1a32", "#08101a"]} style={StyleSheet.absoluteFillObject} />
      <ScrollView contentContainerStyle={s.lobbyContent} showsVerticalScrollIndicator={false}>

        <Pressable style={s.backBtn} onPress={onBack} hitSlop={10}>
          <Ionicons name="arrow-back" size={18} color={COLORS.onSurfaceSecondary} />
        </Pressable>

        <View style={s.lobbyHero}>
          <Text style={{ fontSize: 52 }}>🏥</Text>
          <Text style={s.lobbyKicker}>WARD DEFENSE · PROTOTYPE</Text>
          <Text style={s.lobbyTitle}>Airway Rush</Text>
          <Text style={s.lobbySubtitle}>Bronchospasm Corruption · 5 Waves + Boss</Text>
        </View>

        <View style={s.card2}>
          <Text style={s.cardSectionTitle}>⚕ MISSION</Text>
          <Text style={s.bodyTxt}>
            Bronchospasm corruption is spreading through Airway Ward. Enemies march toward your patient's core.
            {"\n\n"}Use clinical cards to stop them before <Text style={{ color: COLORS.error }}>Patient Stability</Text> reaches zero. Correct card choices deal more damage and unlock deeper nursing feedback.
          </Text>
        </View>

        <View style={s.card2}>
          <Text style={s.cardSectionTitle}>🃏 CLINICAL CARDS</Text>
          {Object.entries(CARD_DATA).map(([, card]) => (
            <View key={card.name} style={s.listRow}>
              <Text style={{ fontSize: 18, width: 26 }}>{card.icon}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[s.listName, { color: card.color }]}>{card.name}</Text>
                  <View style={[s.apPill, { backgroundColor: card.color + "22" }]}>
                    <Text style={[s.apPillTxt, { color: card.color }]}>{card.apCost} AP{card.aoe ? " · AoE" : ""}</Text>
                  </View>
                </View>
                <Text style={s.listDesc}>{card.feedback}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.card2}>
          <Text style={s.cardSectionTitle}>🩺 ENEMIES</Text>
          {Object.entries(ENEMY_DATA).map(([, def]) => (
            <View key={def.name} style={s.listRow}>
              <Text style={{ fontSize: 18, width: 26 }}>{def.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.listName, { color: def.color }]}>{def.name}{def.isBoss ? " 👑 BOSS" : ""}</Text>
                <Text style={s.listDesc}>{def.flavor}</Text>
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

/* ═══════════════════════════════════════════════════════════
   RESULT SCREEN
   ═══════════════════════════════════════════════════════════ */
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
        colors={won ? ["#061c12", "#0a2a1c", "#061210"] : ["#180608", "#28090d", "#120406"]}
        style={StyleSheet.absoluteFillObject}
      />
      <ScrollView contentContainerStyle={s.resultContent} showsVerticalScrollIndicator={false}>
        <Text style={s.resultEmoji}>{won ? "🏆" : "💔"}</Text>
        <Text style={[s.resultTitle, { color: won ? COLORS.success : COLORS.error }]}>
          {won ? "WARD DEFENDED!" : "PATIENT DESTABILIZED"}
        </Text>
        <Text style={s.resultSub}>
          {won
            ? `All ${WAVES.length} waves cleared · ${stability} Stability remaining`
            : `Fell on Wave ${wave + 1} of ${WAVES.length}`
          }
        </Text>

        <View style={s.rewardBox}>
          <Text style={s.cardSectionTitle}>REWARDS EARNED</Text>
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

        <Text style={s.scoreLine}>Total damage dealt: {score}</Text>

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

/* ═══════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  /* Header */
  header: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderBottomWidth: 1, borderColor: COLORS.border,
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  modeKicker: { color: COLORS.air, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  waveLabel:  { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  scoreTag:   { color: COLORS.brand, fontSize: 11, fontWeight: "700" },

  /* Status bars */
  statusRow: {
    flexDirection: "row", gap: SPACING.md, alignItems: "center",
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderColor: COLORS.border,
  },
  barRow:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  barLbl:  { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  barVal:  { fontSize: 11, fontWeight: "700" },
  barBg:   { height: 8, backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.pill, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: RADIUS.pill },
  apBlock: { width: 96 },
  gemRow:  { flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 4 },
  gem:     { width: 7, height: 7, borderRadius: 4 },

  /* Lane */
  lane: {
    flex: 1, overflow: "hidden",
    marginHorizontal: SPACING.md, marginVertical: SPACING.xs,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    minHeight: 110,
  },
  trackPath: {
    position: "absolute", top: "54%", left: "8%", right: "8%",
    height: 2, backgroundColor: COLORS.air + "28", borderRadius: 1,
  },
  coreIcon: {
    position: "absolute", left: 8, top: "28%", alignItems: "center", gap: 3,
  },
  coreBar: { height: 3, borderRadius: RADIUS.pill, maxWidth: 34 },
  spawnEdge: { position: "absolute", right: 8, top: "40%" },

  enemyToken: {
    position: "absolute", top: "22%",
    width: 46, height: 58, borderRadius: RADIUS.md, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center", gap: 3,
  },
  bossToken: { width: 58, height: 68, top: "15%" },
  enemyIcon: { fontSize: 20 },
  enemyHpBg: {
    width: "80%", height: 4,
    backgroundColor: COLORS.surfaceTertiary, borderRadius: 2, overflow: "hidden",
  },
  enemyHpFill: { height: "100%", borderRadius: 2 },
  bossHpTxt: { fontSize: 9, fontWeight: "700" },

  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", justifyContent: "center",
  },
  pauseTxt: { color: COLORS.air, fontSize: 15, fontWeight: "700", letterSpacing: 2 },

  /* Feedback */
  feedbackArea: { minHeight: 42, paddingHorizontal: SPACING.md, justifyContent: "center", gap: 2 },
  feedbackTxt:  { fontSize: 11, lineHeight: 16, fontWeight: "500" },

  /* Roster */
  roster: { maxHeight: 34, marginBottom: SPACING.xs },
  rosterChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderRadius: RADIUS.pill, borderWidth: 1,
    backgroundColor: COLORS.surfaceSecondary,
  },
  rosterName: { color: COLORS.onSurfaceSecondary, fontSize: 10, fontWeight: "600" },
  rosterHp:   { fontSize: 10, fontWeight: "700" },

  /* Card hand */
  hand: {
    flexDirection: "row", gap: 5,
    paddingHorizontal: SPACING.sm, paddingBottom: SPACING.sm,
  },
  card: {
    flex: 1, alignItems: "center", gap: 3,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1.5,
    backgroundColor: COLORS.surfaceSecondary,
  },
  cardOff: { opacity: 0.38 },
  cardIcon: { fontSize: 20 },
  cardName: { fontSize: 9, fontWeight: "700", textAlign: "center", letterSpacing: 0.2 },
  apPill:   { borderRadius: RADIUS.pill, paddingHorizontal: 5, paddingVertical: 2 },
  apPillTxt:{ fontSize: 8, fontWeight: "700" },
  aoeTag:   { fontSize: 8, fontWeight: "700", letterSpacing: 1 },

  /* Lobby */
  lobbyContent: { padding: SPACING.lg, gap: SPACING.lg },
  lobbyHero:    { alignItems: "center", gap: 4, paddingVertical: SPACING.md },
  lobbyKicker:  { color: COLORS.air, fontSize: 10, fontWeight: "700", letterSpacing: 3 },
  lobbyTitle:   { color: COLORS.onSurface, fontSize: 30, fontWeight: "300" },
  lobbySubtitle:{ color: COLORS.onSurfaceSecondary, fontSize: 13 },

  card2: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
  },
  cardSectionTitle: {
    color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 2, marginBottom: 2,
  },
  bodyTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 21 },
  listRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start" },
  listName: { fontSize: 12, fontWeight: "700" },
  listDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 17, marginTop: 1 },

  enterBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.sm, backgroundColor: COLORS.brand, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
  },
  enterBtnTxt: { color: COLORS.onBrand, fontSize: 14, fontWeight: "700", letterSpacing: 2 },

  /* Result */
  resultContent: { padding: SPACING.xl, alignItems: "center", gap: SPACING.md },
  resultEmoji:   { fontSize: 64, marginTop: SPACING.xl },
  resultTitle:   { fontSize: 24, fontWeight: "700", letterSpacing: 2, textAlign: "center" },
  resultSub:     { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: "center" },
  rewardBox: {
    width: "100%", backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
  },
  rewardRow:   { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  rewardLbl:   { flex: 1, color: COLORS.onSurfaceSecondary, fontSize: 14 },
  rewardVal:   { fontSize: 18, fontWeight: "700" },
  scoreLine:   { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  exitBtn: {
    width: "100%", borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: "center",
  },
  exitBtnTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },
});
