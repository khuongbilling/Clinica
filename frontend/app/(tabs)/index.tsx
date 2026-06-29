import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated, Modal, Pressable, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APTITUDE_INFO, HEROES, RANKS } from "@/src/game/content";
import { getHeroSprite } from "@/src/components/HeroSprites";
import { usePlayer } from "@/src/game/store";
import { useTestSession } from "@/src/game/testSession";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const INTRO_KEY = "clinica.intro.seen";
const BG_KEY    = "clinica.arena.bg";

/* ── Arena scene definitions (collectable backgrounds) ── */
const ARENA_SCENES: Record<string, {
  name: string;
  sky: readonly [string, string, string];
  mid: string;
  accent: string;
  orb1: string;
  orb2: string;
}> = {
  River: {
    name: "Cardiac Ward",
    sky: ["#061e30", "#0c3d58", "#071828"] as const,
    mid: "#0a3248",
    accent: COLORS.river,
    orb1: "#06B6D4",
    orb2: "#0e7490",
  },
  Air: {
    name: "Respiratory Spire",
    sky: ["#0d1e30", "#162d46", "#0a1a28"] as const,
    mid: "#142438",
    accent: COLORS.air,
    orb1: "#B0DEFF",
    orb2: "#60A5FA",
  },
  Fire: {
    name: "Immune Forge",
    sky: ["#200a04", "#3d1006", "#1a0804"] as const,
    mid: "#2e0e06",
    accent: COLORS.fire,
    orb1: "#F97316",
    orb2: "#DC2626",
  },
  Mind: {
    name: "Neural Chamber",
    sky: ["#100a22", "#1e1040", "#0e0a1e"] as const,
    mid: "#180e32",
    accent: COLORS.mind,
    orb1: "#A78BFA",
    orb2: "#7C3AED",
  },
  Forge: {
    name: "Osseous Hall",
    sky: ["#181008", "#2e1e0a", "#140e06"] as const,
    mid: "#241608",
    accent: COLORS.forge,
    orb1: "#D97706",
    orb2: "#92400E",
  },
  Energy: {
    name: "Metabolic Nexus",
    sky: ["#181206", "#2c200a", "#141008"] as const,
    mid: "#221a08",
    accent: COLORS.energy,
    orb1: "#FBBF24",
    orb2: "#D97706",
  },
  Storm: {
    name: "Sepsis Front",
    sky: ["#0e0a20", "#1c1040", "#0c0a1c"] as const,
    mid: "#160e30",
    accent: COLORS.storm,
    orb1: "#8B5CF6",
    orb2: "#4C1D95",
  },
  Filter: {
    name: "Renal Depths",
    sky: ["#041620", "#083040", "#04121a"] as const,
    mid: "#062030",
    accent: COLORS.filter,
    orb1: "#22D3EE",
    orb2: "#0891B2",
  },
  Protection: {
    name: "Healing Sanctuary",
    sky: ["#061410", "#0e2820", "#061210"] as const,
    mid: "#0a1e18",
    accent: COLORS.protection,
    orb1: "#34D399",
    orb2: "#059669",
  },
  Growth: {
    name: "Endocrine Garden",
    sky: ["#180810", "#301020", "#140810"] as const,
    mid: "#200c18",
    accent: COLORS.growth,
    orb1: "#F472B6",
    orb2: "#BE185D",
  },
};

const FALLBACK_SCENE = ARENA_SCENES.River;

export default function RunHome() {
  const router  = useRouter();
  const { player, loading } = usePlayer();
  const { logEvent } = useTestSession();
  const [showIntro, setShowIntro] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem(INTRO_KEY).then((v) => { if (!v) setShowIntro(true); });
  }, []);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.25, duration: 850, useNativeDriver: false }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 850, useNativeDriver: false }),
      Animated.delay(1600),
    ])).start();
  }, []);

  const dismissIntro = async () => {
    await AsyncStorage.setItem(INTRO_KEY, "1");
    setShowIntro(false);
  };

  if (!player || loading) {
    return <View style={{ flex: 1, backgroundColor: COLORS.surface }} />;
  }

  const apt      = APTITUDE_INFO[player.aptitude];
  const nextRank = RANKS[player.rank_index + 1];
  const progress = nextRank
    ? Math.min(1, (player.xp - RANKS[player.rank_index].xpRequired) /
                  (nextRank.xpRequired - RANKS[player.rank_index].xpRequired))
    : 1;

  const leadHeroId   = player.active_team?.[0] ?? "novice_guardian";
  const leadHero     = HEROES.find((h) => h.id === leadHeroId);
  const heroSprite   = getHeroSprite(leadHeroId);
  const elementColor = ELEMENT_COLORS[leadHero?.element ?? "River"] ?? COLORS.river;
  const bossUnlocked = (player.bosses_defeated?.length ?? 0) > 0 || player.runs_completed >= 1;

  const scene = ARENA_SCENES[leadHero?.element ?? "River"] ?? FALLBACK_SCENE;


  return (
    <SafeAreaView style={styles.root} edges={["top"]}>

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rankKicker}>{RANKS[player.rank_index].name.toUpperCase()}</Text>
          <Text style={styles.playerName}>{player.name}</Text>
        </View>
        <Pressable
          style={styles.headerBtn}
          onPress={() => router.push("/tutorial")}
          hitSlop={10}
          testID="run-tutorial-button"
        >
          <Ionicons name="help-circle-outline" size={22} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        {apt && (
          <View style={[styles.headerBtn, { borderColor: apt.color + "60" }]}>
            <Ionicons name={apt.icon as any} size={18} color={apt.color} />
          </View>
        )}
      </View>

      {/* ── ARENA SCENE LABEL ── */}
      <View style={styles.sceneLabelRow}>
        <View style={[styles.sceneDot, { backgroundColor: scene.accent }]} />
        <Text style={[styles.sceneLabel, { color: scene.accent }]}>{scene.name.toUpperCase()}</Text>
      </View>

      {/* ── MAIN ARENA — full-width scene + side buttons + hero ── */}
      <View style={styles.arena}>

        {/* ── FULL-WIDTH SCENIC BACKGROUND ── */}
        <SceneBg
          element={leadHero?.element ?? "River"}
          scene={scene}
        />

        {/* ══ SIDE COLUMNS + HERO sit on top of background ══ */}

        {/* LEFT COLUMN */}
        <View style={styles.sideCol}>
          <FeatureButton
            icon="calendar-outline"
            label="Events"
            color={COLORS.air}
            locked
            lockText="Soon"
            onPress={() => {}}
          />
          <FeatureButton
            icon="shield-checkmark-outline"
            label="Daily"
            color={COLORS.mind}
            locked
            lockText="Soon"
            onPress={() => {}}
          />
        </View>

        {/* CENTER — hero only, background is the arena layer behind */}
        <Pressable
          style={styles.heroCenter}
          onPress={() => router.push("/hero-select")}
          testID="home-portrait-tap"
        >
          {heroSprite ? (
            <Image
              source={heroSprite}
              style={styles.heroImg}
              contentFit="contain"
              contentPosition="center"
            />
          ) : (
            <View style={styles.heroPlaceholder} />
          )}

          {/* Tap hint */}
          <Animated.View style={[styles.tapPulse, { opacity: pulseAnim }]}>
            <View style={[styles.tapDot, { backgroundColor: elementColor }]} />
            <Text style={styles.tapLabel}>tap to change</Text>
          </Animated.View>
        </Pressable>

        {/* RIGHT COLUMN */}
        <View style={styles.sideCol}>
          <FeatureButton
            icon={bossUnlocked ? "skull" : "lock-closed"}
            label="Boss"
            color={COLORS.error}
            locked={!bossUnlocked}
            lockText="1 run"
            onPress={() => { if (bossUnlocked) router.push("/boss"); }}
            testID="home-float-boss"
          />
          <FeatureButton
            icon="sparkles"
            label="Summon"
            color={COLORS.brand}
            onPress={() => router.push("/summon")}
            testID="home-float-summon"
          />
        </View>
      </View>

      {/* ── HERO INFO PANEL ── */}
      <Pressable
        style={[styles.infoPanel, { borderColor: elementColor + "35" }]}
        onPress={() => router.push("/hero-select")}
      >
        <View style={[styles.elementBadge, { borderColor: elementColor + "80", backgroundColor: elementColor + "15" }]}>
          <Text style={[styles.elementTxt, { color: elementColor }]}>{leadHero?.element ?? "River"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroName}>{leadHero?.name ?? "Your Hero"}</Text>
          <Text style={styles.heroTitle}>{leadHero?.title ?? apt?.title ?? ""}</Text>
        </View>
        <View style={styles.xpCol}>
          <View style={styles.xpBg}>
            <View style={[styles.xpBar, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: elementColor }]} />
          </View>
          <Text style={styles.xpTxt}>{nextRank ? `${player.xp}/${nextRank.xpRequired} XP` : "MAX"}</Text>
        </View>
      </Pressable>

      {/* ── START SHIFT ── */}
      <Pressable
        style={styles.startBtn}
        onPress={() => { logEvent("shifting_ward_opened", "home", {}); router.push("/shift"); }}
        testID="run-random-encounter"
      >
        <Ionicons name="medical" size={18} color={COLORS.onBrand} />
        <Text style={styles.startTxt}>START SHIFT</Text>
        <Ionicons name="arrow-forward" size={16} color={COLORS.onBrand} />
      </Pressable>

      {/* ── INTRO MODAL ── */}
      <Modal visible={showIntro} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.introOverlay}>
          <View style={styles.introPanel}>
            <View style={styles.introHandle} />
            <Text style={styles.introKicker}>A KINGDOM SHAPED LIKE THE BODY</Text>
            <Text style={styles.introTitle}>Welcome to Clinica</Text>
            <Text style={styles.introBody}>
              Five great regions — Air, River, Fire, Mind, Stone — each a living body system.{"\n\n"}
              Your healer team reads patient clues, keeps Stability above zero, and drives Corruption to zero.{"\n\n"}
              <Text style={{ color: COLORS.brand }}>Fight disease. Restore the body. Learn medicine through play.</Text>
            </Text>
            <View style={styles.introSystems}>
              {[
                { name: "Air",   desc: "Lungs",  color: COLORS.air   },
                { name: "River", desc: "Heart",  color: COLORS.river },
                { name: "Fire",  desc: "Immune", color: COLORS.fire  },
                { name: "Mind",  desc: "Neuro",  color: COLORS.mind  },
                { name: "Stone", desc: "Bone",   color: COLORS.forge },
              ].map((s) => (
                <View key={s.name} style={styles.sysPill}>
                  <View style={[styles.sysDot, { backgroundColor: s.color }]} />
                  <Text style={[styles.sysName, { color: s.color }]}>{s.name}</Text>
                  <Text style={styles.sysDesc}>{s.desc}</Text>
                </View>
              ))}
            </View>
            <Pressable style={styles.introCta} onPress={dismissIntro} testID="intro-dismiss">
              <Text style={styles.introCtaTxt}>BEGIN THE JOURNEY</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ══════════════════════════════════════════════════════════
   SCENIC BACKGROUNDS — lore-themed environments (anime/donghua style)
   Each scene is a distinct location: hospital ward, garden pavilion,
   alchemical forge, neuro lab, ancient temple.
   ══════════════════════════════════════════════════════════ */

type SceneProps = { o: string; a: string };

/** Hospital Night Ward — modern clinic after dark. Cardiac monitors, city window, IV pole, bed. */
function CardiacWardScene({ o, a }: SceneProps) {
  return (
    <>
      {/* Dark hospital wall */}
      <LinearGradient colors={["#0a1624", "#0d1a2c", "#0a1420"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFillObject} />
      {/* Dado rail stripe */}
      <View style={{ position: "absolute", top: "62%", left: 0, right: 0, height: 1.5, backgroundColor: "#1e2d3e" }} />
      <View style={{ position: "absolute", top: "62%", left: 0, right: 0, height: "8%", backgroundColor: "#080f1a" }} />

      {/* Ceiling fluorescent panels */}
      <View style={{ position: "absolute", top: "3%", left: "18%", width: "30%", height: "2.5%", backgroundColor: "#b8dcee", borderRadius: 2, opacity: 0.85 }} />
      <LinearGradient colors={["#b8dcee22", "#00000000"]} style={{ position: "absolute", top: "5.5%", left: "10%", width: "46%", height: "14%" }} />
      <View style={{ position: "absolute", top: "3%", right: "16%", width: "22%", height: "2.5%", backgroundColor: "#b8dcee", borderRadius: 2, opacity: 0.7 }} />
      <LinearGradient colors={["#b8dcee18", "#00000000"]} style={{ position: "absolute", top: "5.5%", right: "8%", width: "38%", height: "10%" }} />

      {/* Window — left background, city at night */}
      <View style={{ position: "absolute", left: "4%", top: "8%", width: "22%", height: "52%", borderWidth: 1.5, borderColor: "#283c50", borderRadius: 2, overflow: "hidden" }}>
        <LinearGradient colors={["#08101e", "#0c1a30"]} style={{ flex: 1 }} />
        {[
          { t: "14%", l: "18%" }, { t: "28%", l: "58%" }, { t: "20%", l: "76%" },
          { t: "48%", l: "28%" }, { t: "42%", l: "68%" }, { t: "62%", l: "12%" },
          { t: "55%", l: "50%" }, { t: "22%", l: "42%" }, { t: "38%", l: "82%" },
        ].map((d, i) => (
          <View key={i} style={{ position: "absolute", top: d.t as any, left: d.l as any,
            width: i % 2 === 0 ? 2 : 1.5, height: i % 2 === 0 ? 2 : 1.5, borderRadius: 2,
            backgroundColor: i % 3 === 0 ? "#ffd06080" : i % 3 === 1 ? "#60a0ff80" : "#ffe08080" }} />
        ))}
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "30%", backgroundColor: "#05090f" }} />
        <View style={{ position: "absolute", bottom: "28%", left: "8%", width: "20%", height: "20%", backgroundColor: "#05090f" }} />
        <View style={{ position: "absolute", bottom: "28%", right: "12%", width: "22%", height: "28%", backgroundColor: "#05090f" }} />
      </View>
      <View style={{ position: "absolute", left: "4%", top: "34%", width: "22%", height: 1, backgroundColor: "#283c50" }} />
      <LinearGradient colors={["#1040a018", "#00000000"]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
        style={{ position: "absolute", left: "4%", top: "60%", width: "30%", height: "20%" }} />

      {/* Heart monitor — right side */}
      <View style={{ position: "absolute", right: "5%", top: "16%", width: "16%", height: "36%",
        backgroundColor: "#0c1c2c", borderRadius: 4, borderWidth: 1, borderColor: "#1e3048" }}>
        <View style={{ position: "absolute", top: "10%", left: "8%", right: "8%", height: "42%",
          backgroundColor: "#060e10", borderRadius: 2 }}>
          <View style={{ position: "absolute", top: "48%", left: 0, right: 0, height: 1, backgroundColor: o + "70" }} />
          <LinearGradient colors={[o + "00", o + "35", o + "00"]} locations={[0, 0.5, 1]}
            style={{ position: "absolute", top: "28%", left: 0, right: 0, height: "44%" }} />
        </View>
        <View style={{ position: "absolute", bottom: "14%", left: "18%", width: 3, height: 3, borderRadius: 2, backgroundColor: o + "CC" }} />
        <View style={{ position: "absolute", bottom: "14%", right: "22%", width: 3, height: 3, borderRadius: 2, backgroundColor: "#22c55e90" }} />
      </View>
      <View style={{ position: "absolute", right: "12%", top: "52%", width: 2, height: "22%", backgroundColor: "#1e3048" }} />
      <View style={{ position: "absolute", right: "9%", top: "73%", width: "9%", height: 3, borderRadius: 2, backgroundColor: "#1e3048" }} />

      {/* IV pole */}
      <View style={{ position: "absolute", left: "30%", top: 0, width: 2, height: "74%", backgroundColor: "#243648" }} />
      <View style={{ position: "absolute", left: "28%", top: "3%", width: "5%", height: 2, borderRadius: 1, backgroundColor: "#243648" }} />
      <View style={{ position: "absolute", left: "27%", top: "4%", width: "5%", height: "10%",
        borderRadius: 4, backgroundColor: "#122840", borderWidth: 1, borderColor: o + "40" }}>
        <LinearGradient colors={[o + "1a", o + "08"]} style={{ flex: 1, borderRadius: 4 }} />
      </View>
      <View style={{ position: "absolute", left: "30%", top: "14%", width: 1, height: "20%", backgroundColor: "#1e3460" }} />

      {/* Bed silhouette */}
      <View style={{ position: "absolute", bottom: "29%", left: "4%", width: "32%", height: "4.5%", backgroundColor: "#14202e", borderRadius: 2 }} />
      <View style={{ position: "absolute", bottom: "33%", left: "4%", width: "32%", height: "7%", backgroundColor: "#0f1a28", borderRadius: 2 }} />
      <View style={{ position: "absolute", bottom: "25%", left: "7%", width: 2, height: "4%", backgroundColor: "#14202e" }} />
      <View style={{ position: "absolute", bottom: "25%", left: "31%", width: 2, height: "4%", backgroundColor: "#14202e" }} />

      {/* Floor tiles */}
      <LinearGradient colors={["#08101e", "#0c1622"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "27%" }} />
      <View style={{ position: "absolute", bottom: "23%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff09" }} />
      <View style={{ position: "absolute", bottom: "17%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff07" }} />
      <View style={{ position: "absolute", bottom: "11%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff05" }} />
    </>
  );
}

/** Healer's Garden Pavilion — dawn light, pointed arch window, hanging herbs, bamboo, incense. */
function RespiratorySpireScene({ o, a }: SceneProps) {
  return (
    <>
      {/* Stone wall */}
      <LinearGradient colors={["#0c1820", "#101c28", "#0e1a22"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFillObject} />
      {[14, 28, 44, 60].map((t, i) => (
        <View key={i} style={{ position: "absolute", top: `${t}%`, left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff06" }} />
      ))}

      {/* Tall pointed arch window — back center */}
      <View style={{ position: "absolute", alignSelf: "center", top: "5%", width: "40%", height: "60%",
        borderTopLeftRadius: 999, borderTopRightRadius: 999, borderWidth: 1.5, borderColor: "#2e4050", overflow: "hidden" }}>
        <LinearGradient colors={["#e8c06020", "#90c8e028", "#6090b020"]} locations={[0, 0.5, 1]} style={{ flex: 1 }} />
        <LinearGradient colors={[o + "22", "#00000000"]} style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "65%" }} />
        <LinearGradient colors={[o + "14", "#00000000"]} style={{ position: "absolute", top: 0, left: "35%", width: "50%", height: "80%" }} />
      </View>
      <View style={{ position: "absolute", alignSelf: "center", top: "39%", width: "40%", height: 1, backgroundColor: "#2e4050" }} />
      <View style={{ position: "absolute", alignSelf: "center", top: "65%", width: "46%", height: "2%", backgroundColor: "#162430", borderRadius: 1 }} />
      <LinearGradient colors={[o + "18", "#00000000"]} style={{ position: "absolute", alignSelf: "center", top: "5%", width: "60%", height: "40%", borderTopLeftRadius: 999, borderTopRightRadius: 999 }} />

      {/* LEFT — bamboo stalks */}
      <View style={{ position: "absolute", left: "5%", top: 0, width: 3, height: "68%", backgroundColor: "#1a2e22", borderRadius: 2 }} />
      <View style={{ position: "absolute", left: "9%", top: "4%", width: 2, height: "62%", backgroundColor: "#162818", borderRadius: 2 }} />
      <View style={{ position: "absolute", left: "13%", top: "1%", width: 2.5, height: "58%", backgroundColor: "#1c3020", borderRadius: 2 }} />
      {[12, 28, 44, 58].map((t, i) => (
        <View key={i} style={{ position: "absolute", left: "4%", top: `${t}%`, width: "13%", height: 1.5, backgroundColor: "#223828" }} />
      ))}
      <View style={{ position: "absolute", left: "0%", top: "6%", width: "18%", height: "12%", borderRadius: 999, backgroundColor: "#1e3022", opacity: 0.55 }} />
      <View style={{ position: "absolute", left: "3%", top: "20%", width: "13%", height: "9%", borderRadius: 999, backgroundColor: "#1c2e20", opacity: 0.45 }} />

      {/* Hanging herb bundles */}
      {[{ l: "28%" }, { l: "48%" }, { l: "66%" }].map((b, i) => (
        <View key={i}>
          <View style={{ position: "absolute", top: 0, left: b.l as any, width: 2, height: `${14 + i * 2}%`, backgroundColor: "#243420" }} />
          <View style={{ position: "absolute", top: `${13 + i * 2}%`, left: b.l as any, marginLeft: -5, width: 12, height: 9, borderRadius: 999, backgroundColor: "#1e2c18", opacity: 0.75 }} />
        </View>
      ))}

      {/* Incense burner */}
      <View style={{ position: "absolute", bottom: "32%", alignSelf: "center", width: "10%", height: "3%", backgroundColor: "#182420", borderRadius: 2 }} />
      <View style={{ position: "absolute", bottom: "35%", alignSelf: "center", width: "14%", height: "2%", borderRadius: 999, backgroundColor: "#1a2620" }} />
      <LinearGradient colors={[o + "00", o + "18", o + "00"]} locations={[0, 0.4, 1]}
        style={{ position: "absolute", bottom: "37%", alignSelf: "center", width: "5%", height: "28%", borderRadius: 999 }} />

      {/* Stone floor */}
      <LinearGradient colors={["#0c1620", "#101a28"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "30%" }} />
      <View style={{ position: "absolute", bottom: "26%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff0A" }} />
      <View style={{ position: "absolute", bottom: "18%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff08" }} />
      <View style={{ position: "absolute", bottom: "10%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff06" }} />
    </>
  );
}

/** Alchemical Forge — stone dungeon, torch sconces, potion shelves, central cauldron. */
function ImmuneForgeScene({ o, a }: SceneProps) {
  return (
    <>
      {/* Stone wall */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#100c08" }} />
      {[10, 22, 35, 48, 62, 76].map((t, i) => (
        <View key={i} style={{ position: "absolute", top: `${t}%`, left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff06" }} />
      ))}
      {[22, 48, 74].map((l, i) => (
        <View key={i} style={{ position: "absolute", left: `${l}%`, top: 0, bottom: "28%", width: 0.5, backgroundColor: "#ffffff05" }} />
      ))}

      {/* Stone arch framing */}
      <View style={{ position: "absolute", left: "17%", top: 0, width: "6%", height: "28%", backgroundColor: "#0c0906" }} />
      <View style={{ position: "absolute", right: "17%", top: 0, width: "6%", height: "28%", backgroundColor: "#0c0906" }} />
      <View style={{ position: "absolute", alignSelf: "center", top: 0, width: "34%", height: "6%", backgroundColor: "#0c0906", borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }} />

      {/* LEFT TORCH */}
      <View style={{ position: "absolute", left: "7%", top: "24%", width: "8%", height: "3%", backgroundColor: "#28180e", borderRadius: 2 }} />
      <View style={{ position: "absolute", left: "9.5%", top: "14%", width: 3, height: "12%", backgroundColor: "#382618" }} />
      <View style={{ position: "absolute", left: "8%", top: "9%", width: "5%", height: "6%", borderRadius: 999, backgroundColor: o + "90" }} />
      <LinearGradient colors={[o + "55", "#00000000"]} style={{ position: "absolute", left: "4%", top: "8%", width: "12%", height: "24%", borderRadius: 999 }} />

      {/* RIGHT TORCH */}
      <View style={{ position: "absolute", right: "7%", top: "24%", width: "8%", height: "3%", backgroundColor: "#28180e", borderRadius: 2 }} />
      <View style={{ position: "absolute", right: "9.5%", top: "14%", width: 3, height: "12%", backgroundColor: "#382618" }} />
      <View style={{ position: "absolute", right: "8%", top: "9%", width: "5%", height: "6%", borderRadius: 999, backgroundColor: o + "90" }} />
      <LinearGradient colors={[o + "55", "#00000000"]} style={{ position: "absolute", right: "4%", top: "8%", width: "12%", height: "24%", borderRadius: 999 }} />

      {/* SHELVES left */}
      <View style={{ position: "absolute", left: "3%", top: "46%", width: "19%", height: 2, backgroundColor: "#28180e" }} />
      <View style={{ position: "absolute", left: "4%", top: "37%", width: "5%", height: "10%", borderRadius: 3, backgroundColor: "#1a2810", borderWidth: 1, borderColor: o + "45" }} />
      <View style={{ position: "absolute", left: "11%", top: "35%", width: "3.5%", height: "12%", borderRadius: 999, backgroundColor: "#2a1610", borderWidth: 1, borderColor: "#dc262650" }} />
      <View style={{ position: "absolute", left: "16%", top: "38%", width: "4.5%", height: "9%", borderRadius: 3, backgroundColor: "#18201c", borderWidth: 1, borderColor: "#22c55e40" }} />

      {/* CAULDRON */}
      <View style={{ position: "absolute", bottom: "29%", alignSelf: "center", width: "26%", height: "15%", borderRadius: 32, backgroundColor: "#0c0804", borderWidth: 2, borderColor: "#261a0e" }} />
      <View style={{ position: "absolute", bottom: "43%", alignSelf: "center", width: "30%", height: "3%", borderRadius: 999, backgroundColor: "#1a1008" }} />
      <LinearGradient colors={[o + "50", "#00000000"]} style={{ position: "absolute", bottom: "44%", alignSelf: "center", width: "22%", height: "20%", borderRadius: 999, opacity: 0.7 }} />
      <LinearGradient colors={[o + "30", o + "10", "#00000000"]} locations={[0, 0.5, 1]}
        style={{ position: "absolute", bottom: "56%", alignSelf: "center", width: "12%", height: "22%", borderRadius: 999 }} />
      {[{ t: "18%", l: "24%" }, { t: "10%", l: "58%" }, { t: "14%", r: "22%" }, { t: "22%", l: "72%" }, { t: "8%", l: "40%" }].map((p, i) => (
        <View key={i} style={{ position: "absolute", top: p.t as any, left: (p as any).l as any, right: (p as any).r as any,
          width: i % 2 === 0 ? 3 : 2, height: i % 2 === 0 ? 3 : 2, borderRadius: 2, backgroundColor: o + "AA" }} />
      ))}

      {/* Floor */}
      <LinearGradient colors={["#0a0804", "#0e0c08"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "27%" }} />
      <View style={{ position: "absolute", bottom: "23%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff08" }} />
      <View style={{ position: "absolute", bottom: "15%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff06" }} />
    </>
  );
}

/** Neuro Research Lab — holographic ring display, specimen jars, lab bench, wall monitors. */
function NeuralChamberScene({ o, a }: SceneProps) {
  return (
    <>
      {/* Dark tech background */}
      <LinearGradient colors={["#06040e", "#0a0818", "#060412"]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFillObject} />

      {/* CENTRAL HOLOGRAPHIC RING */}
      <View style={{ position: "absolute", alignSelf: "center", top: "4%", width: "56%", aspectRatio: 1,
        borderRadius: 999, borderWidth: 1.5, borderColor: o + "30" }} />
      <View style={{ position: "absolute", alignSelf: "center", top: "13%", width: "38%", aspectRatio: 1,
        borderRadius: 999, borderWidth: 1, borderColor: o + "22" }} />
      <View style={{ position: "absolute", alignSelf: "center", top: "4%", width: "56%", aspectRatio: 1, alignItems: "center", justifyContent: "center" }}>
        <View style={{ position: "absolute", left: "18%", right: "18%", height: 0.5, backgroundColor: o + "1e" }} />
        <View style={{ position: "absolute", left: "8%", right: "8%", top: "22%", height: 0.5, backgroundColor: o + "14" }} />
        <View style={{ position: "absolute", left: "8%", right: "8%", bottom: "22%", height: 0.5, backgroundColor: o + "14" }} />
        <View style={{ position: "absolute", top: "18%", bottom: "18%", width: 0.5, backgroundColor: o + "1e" }} />
      </View>
      <View style={{ position: "absolute", alignSelf: "center", top: "22%", width: 8, height: 8, borderRadius: 4, backgroundColor: o + "90" }} />

      {/* WALL MONITOR — left */}
      <View style={{ position: "absolute", left: "2%", top: "14%", width: "15%", height: "32%",
        borderWidth: 1, borderColor: o + "22", borderRadius: 2, overflow: "hidden" }}>
        <LinearGradient colors={[o + "0a", "#00000000"]} style={{ flex: 1 }} />
        {[18, 34, 50, 66, 82].map((t, i) => (
          <View key={i} style={{ position: "absolute", top: `${t}%`, left: "10%", right: "10%", height: 0.5, backgroundColor: o + (i % 2 === 0 ? "1e" : "10") }} />
        ))}
      </View>
      {/* WALL MONITOR — right */}
      <View style={{ position: "absolute", right: "2%", top: "20%", width: "13%", height: "26%",
        borderWidth: 1, borderColor: o + "22", borderRadius: 2, overflow: "hidden" }}>
        <LinearGradient colors={[o + "08", "#00000000"]} style={{ flex: 1 }} />
        {[22, 44, 66, 88].map((t, i) => (
          <View key={i} style={{ position: "absolute", top: `${t}%`, left: "10%", right: "10%", height: 0.5, backgroundColor: o + "14" }} />
        ))}
      </View>

      {/* LAB BENCH */}
      <View style={{ position: "absolute", bottom: "29%", left: 0, right: 0, height: "4.5%", backgroundColor: "#100c1c" }} />
      <View style={{ position: "absolute", bottom: "33%", left: 0, right: 0, height: 1.5, backgroundColor: o + "28" }} />
      {[{ l: "20%", c: o }, { l: "34%", c: "#22c55e" }, { l: "50%", c: "#f97316" }, { l: "64%", c: o }, { l: "76%", c: "#ec4899" }].map((j, i) => (
        <View key={i} style={{ position: "absolute", bottom: "33%", left: j.l as any, width: "6%", height: "11%",
          borderRadius: 3, backgroundColor: "#0c0a18", borderWidth: 1, borderColor: j.c + "50" }}>
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "38%", borderRadius: 3, backgroundColor: j.c + "22" }} />
        </View>
      ))}
      {[{ t: "32%", l: "18%" }, { t: "22%", l: "74%" }, { t: "44%", r: "24%" }, { t: "16%", l: "38%" }, { t: "40%", l: "56%" }].map((p, i) => (
        <View key={i} style={{ position: "absolute", top: p.t as any, left: (p as any).l as any, right: (p as any).r as any,
          width: 2, height: 2, borderRadius: 1, backgroundColor: o + "60" }} />
      ))}

      {/* Floor */}
      <LinearGradient colors={["#04020c", "#080614"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "27%" }} />
    </>
  );
}

/** Ancient Healing Temple — stone pillars, lanterns, tapestry arch, healing altar, steps. */
function DefaultHallScene({ o, a }: SceneProps) {
  return (
    <>
      {/* Stone background */}
      <LinearGradient colors={["#0e0c0a", "#120e0a", "#100c08"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFillObject} />
      {[10, 24, 38, 54, 68, 82].map((t, i) => (
        <View key={i} style={{ position: "absolute", top: `${t}%`, left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff05" }} />
      ))}

      {/* LEFT PILLAR */}
      <View style={{ position: "absolute", left: "7%", top: 0, bottom: 0, width: "10%", backgroundColor: "#0a0806" }} />
      <View style={{ position: "absolute", left: "7%", top: 0, bottom: 0, width: 1.5, backgroundColor: o + "22" }} />
      <View style={{ position: "absolute", left: "17%", top: 0, bottom: 0, width: 1, backgroundColor: o + "12" }} />
      <View style={{ position: "absolute", left: "5%", top: 0, width: "14%", height: "5%", backgroundColor: "#090706" }} />
      <View style={{ position: "absolute", left: "5%", bottom: "27%", width: "14%", height: "3%", backgroundColor: "#090706" }} />
      <View style={{ position: "absolute", left: "9%", top: "22%", width: "5%", height: "9%",
        borderRadius: 2, backgroundColor: "#18100a", borderWidth: 1, borderColor: o + "55" }}>
        <LinearGradient colors={[o + "45", o + "10"]} style={{ flex: 1, borderRadius: 2 }} />
      </View>
      <LinearGradient colors={[o + "28", "#00000000"]} style={{ position: "absolute", left: "7%", top: "24%", width: "10%", height: "20%", borderRadius: 999 }} />

      {/* RIGHT PILLAR */}
      <View style={{ position: "absolute", right: "7%", top: 0, bottom: 0, width: "10%", backgroundColor: "#0a0806" }} />
      <View style={{ position: "absolute", right: "7%", top: 0, bottom: 0, width: 1.5, backgroundColor: o + "22" }} />
      <View style={{ position: "absolute", right: "17%", top: 0, bottom: 0, width: 1, backgroundColor: o + "12" }} />
      <View style={{ position: "absolute", right: "5%", top: 0, width: "14%", height: "5%", backgroundColor: "#090706" }} />
      <View style={{ position: "absolute", right: "5%", bottom: "27%", width: "14%", height: "3%", backgroundColor: "#090706" }} />
      <View style={{ position: "absolute", right: "9%", top: "22%", width: "5%", height: "9%",
        borderRadius: 2, backgroundColor: "#18100a", borderWidth: 1, borderColor: o + "55" }}>
        <LinearGradient colors={[o + "45", o + "10"]} style={{ flex: 1, borderRadius: 2 }} />
      </View>
      <LinearGradient colors={[o + "28", "#00000000"]} style={{ position: "absolute", right: "7%", top: "24%", width: "10%", height: "20%", borderRadius: 999 }} />

      {/* ARCH + TAPESTRY */}
      <View style={{ position: "absolute", alignSelf: "center", top: "7%", width: "44%", height: "56%",
        borderTopLeftRadius: 999, borderTopRightRadius: 999, borderWidth: 1.5, borderColor: o + "1e", overflow: "hidden" }}>
        <LinearGradient colors={[o + "14", o + "08", "#00000000"]} locations={[0, 0.5, 1]} style={{ flex: 1 }} />
        <View style={{ position: "absolute", alignSelf: "center", top: "18%", width: "5%", height: "30%", backgroundColor: o + "20" }} />
        <View style={{ position: "absolute", alignSelf: "center", top: "28%", height: "10%", left: "28%", right: "28%", backgroundColor: o + "20" }} />
      </View>
      <LinearGradient colors={[o + "1c", "#00000000"]} style={{ position: "absolute", alignSelf: "center", top: "7%", width: "44%", height: "28%", borderTopLeftRadius: 999, borderTopRightRadius: 999 }} />

      {/* ALTAR */}
      <View style={{ position: "absolute", bottom: "29%", alignSelf: "center", width: "38%", height: "4%",
        backgroundColor: "#121008", borderRadius: 3, borderTopWidth: 1, borderColor: o + "38" }} />
      <LinearGradient colors={[o + "30", "#00000000"]} style={{ position: "absolute", bottom: "33%", alignSelf: "center", width: "32%", height: "12%", borderRadius: 999 }} />
      <View style={{ position: "absolute", bottom: "25%", alignSelf: "center", width: "44%", height: "2.5%", backgroundColor: "#100e08", borderRadius: 2 }} />
      <View style={{ position: "absolute", bottom: "23%", alignSelf: "center", width: "52%", height: "2.5%", backgroundColor: "#0e0c06", borderRadius: 2 }} />

      {/* Floor */}
      <LinearGradient colors={["#080604", "#0c0a08"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "25%" }} />
      <View style={{ position: "absolute", bottom: "21%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff08" }} />
      <View style={{ position: "absolute", bottom: "13%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff06" }} />
    </>
  );
}

/** Wrapper — sky base + element scene + edge shadows + top vignette */
function SceneBg({
  element, scene,
}: {
  element: string;
  scene: { sky: readonly [string, string, string]; mid: string; accent: string; orb1: string; orb2: string };
}) {
  const o = scene.orb1;
  const a = scene.accent;
  return (
    <>
      {/* 1 — Sky base tint (each scene draws its own walls on top) */}
      <LinearGradient colors={scene.sky} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFillObject} />

      {/* 2 — Element-specific scene environment */}
      {element === "River"                              && <CardiacWardScene o={o} a={a} />}
      {element === "Air"                                && <RespiratorySpireScene o={o} a={a} />}
      {element === "Fire"                               && <ImmuneForgeScene o={o} a={a} />}
      {element === "Mind"                               && <NeuralChamberScene o={o} a={a} />}
      {!["River","Air","Fire","Mind"].includes(element) && <DefaultHallScene o={o} a={a} />}

      {/* 3 — Edge depth vignette */}
      <LinearGradient colors={["rgba(4,6,10,0.72)", "rgba(4,6,10,0.0)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sc.edgeLeft} />
      <LinearGradient colors={["rgba(4,6,10,0.0)", "rgba(4,6,10,0.72)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sc.edgeRight} />

      {/* 4 — Top vignette */}
      <LinearGradient colors={["rgba(4,6,10,0.72)", "rgba(4,6,10,0.0)"]} style={sc.topVignette} />
    </>
  );
}

/** Shared structural styles */
const sc = StyleSheet.create({
  edgeLeft:    { position: "absolute", top: 0, bottom: 0, left: 0,  width: "20%" },
  edgeRight:   { position: "absolute", top: 0, bottom: 0, right: 0, width: "20%" },
  topVignette: { position: "absolute", top: 0, left: 0, right: 0,  height: "22%" },
});

/* ── FeatureButton ── */
function FeatureButton({
  icon, label, color, locked, lockText, onPress, testID,
}: {
  icon: string; label: string; color: string;
  locked?: boolean; lockText?: string;
  onPress: () => void; testID?: string;
}) {
  return (
    <Pressable style={[styles.featBtn, locked && { opacity: 0.5 }]} onPress={onPress} testID={testID} hitSlop={6}>
      <View style={[styles.featCircle, {
        borderColor: locked ? COLORS.border : color + "70",
        backgroundColor: locked ? COLORS.surfaceTertiary : color + "18",
      }]}>
        <Ionicons name={icon as any} size={22} color={locked ? COLORS.onSurfaceTertiary : color} />
      </View>
      <Text style={[styles.featLabel, { color: locked ? COLORS.onSurfaceTertiary : color }]}>{label}</Text>
      {locked && lockText ? <Text style={styles.featLock}>{lockText}</Text> : null}
    </Pressable>
  );
}

/* ── Styles ── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  /* Header */
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs, paddingBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  rankKicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  playerName: { color: COLORS.onSurface, fontSize: 20, fontWeight: "300" },
  headerBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },

  /* Scene label row */
  sceneLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: SPACING.lg,
    paddingBottom: 4,
  },
  sceneDot:  { width: 5, height: 5, borderRadius: 3 },
  sceneLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 2 },

  /* Arena row — fills remaining space between header and bottom bar */
  arena: { flex: 1, flexDirection: "row", alignItems: "stretch", overflow: "hidden" },

  /* Side columns */
  sideCol: {
    width: 72,
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingVertical: SPACING.sm,
  },
  featBtn:    { alignItems: "center", gap: 4 },
  featCircle: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
  },
  featLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, textAlign: "center" },
  featLock:  { color: COLORS.onSurfaceTertiary, fontSize: 9 },

  /* Hero center — plain transparent, no frame */
  heroCenter: {
    flex: 1,
    position: "relative",
  },

  heroImg: { flex: 1, width: "100%" },
  heroPlaceholder: { flex: 1, backgroundColor: COLORS.surfaceSecondary },

  /* Tap hint */
  tapPulse: {
    position: "absolute",
    bottom: SPACING.sm,
    right: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(12,14,18,0.55)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  tapDot:   { width: 5, height: 5, borderRadius: 3, opacity: 0.85 },
  tapLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.6 },

  /* Hero info panel */
  infoPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
  },
  elementBadge: {
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 9, paddingVertical: 4,
    alignSelf: "center",
  },
  elementTxt: { fontSize: 9, fontWeight: "700", letterSpacing: 1.4 },
  heroName:   { color: COLORS.onSurface, fontSize: 15, fontWeight: "700" },
  heroTitle:  { color: COLORS.onSurfaceSecondary, fontSize: 11, marginTop: 1 },
  xpCol:      { alignItems: "flex-end", gap: 3 },
  xpBg:       { width: 64, height: 3, borderRadius: 2, backgroundColor: COLORS.border, overflow: "hidden" },
  xpBar:      { height: "100%", borderRadius: 2 },
  xpTxt:      { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.6 },

  /* Start button */
  startBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.brand,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm, marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
  },
  startTxt: { color: COLORS.onBrand, fontSize: 14, fontWeight: "700", letterSpacing: 2 },

  /* Intro modal */
  introOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" },
  introPanel: {
    backgroundColor: COLORS.surfaceSecondary,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: SPACING.xl, paddingBottom: SPACING.xxxl,
    borderTopWidth: 1, borderColor: COLORS.brand + "40",
    gap: SPACING.md,
  },
  introHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: SPACING.sm },
  introKicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  introTitle:  { color: COLORS.onSurface, fontSize: 26, fontWeight: "300" },
  introBody:   { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 22 },
  introSystems: { flexDirection: "row", gap: SPACING.xs, flexWrap: "wrap" },
  sysPill:  { alignItems: "center", gap: 3, minWidth: 46 },
  sysDot:   { width: 8, height: 8, borderRadius: 4 },
  sysName:  { fontSize: 11, fontWeight: "700" },
  sysDesc:  { color: COLORS.onSurfaceTertiary, fontSize: 9 },
  introCta: {
    backgroundColor: COLORS.brand, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, alignItems: "center", marginTop: SPACING.sm,
  },
  introCtaTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
});
