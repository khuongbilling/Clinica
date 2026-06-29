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

/* ── Arena scene definitions — element accent + orb colors for props ── */
const ARENA_SCENES: Record<string, {
  name: string;
  accent: string;
  orb1: string;
  orb2: string;
}> = {
  River:      { name: "Grand Ward Atrium",      accent: COLORS.river,      orb1: "#06B6D4", orb2: "#0e7490" },
  Air:        { name: "Healer's Garden Spire",  accent: COLORS.air,        orb1: "#B0DEFF", orb2: "#60A5FA" },
  Fire:       { name: "Alchemical Forge",       accent: COLORS.fire,       orb1: "#F97316", orb2: "#DC2626" },
  Mind:       { name: "Neural Observatory",     accent: COLORS.mind,       orb1: "#A78BFA", orb2: "#7C3AED" },
  Forge:      { name: "Osseous Hall",           accent: COLORS.forge,      orb1: "#D97706", orb2: "#92400E" },
  Energy:     { name: "Metabolic Sanctum",      accent: COLORS.energy,     orb1: "#FBBF24", orb2: "#D97706" },
  Storm:      { name: "Storm Observatory",      accent: COLORS.storm,      orb1: "#8B5CF6", orb2: "#4C1D95" },
  Filter:     { name: "Renal Depths",           accent: COLORS.filter,     orb1: "#22D3EE", orb2: "#0891B2" },
  Protection: { name: "Restoration Hall",       accent: COLORS.protection, orb1: "#34D399", orb2: "#059669" },
  Growth:     { name: "Endocrine Garden",       accent: COLORS.growth,     orb1: "#F472B6", orb2: "#BE185D" },
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

      {/* ── SCENE LOCATION LABEL ── */}
      <View style={styles.sceneLabelRow}>
        <View style={[styles.sceneDot, { backgroundColor: scene.accent }]} />
        <Text style={[styles.sceneLabel, { color: scene.accent }]}>{scene.name.toUpperCase()}</Text>
      </View>

      {/* ── MAIN ARENA — layered: scenic bg → side cols → hero portrait ── */}
      <View style={styles.arena}>

        {/* LAYER 1 — full-width scenic background (drawn behind everything) */}
        <SceneBg element={leadHero?.element ?? "River"} scene={scene} />

        {/* LAYER 2 — side columns (float above bg, transparent backgrounds) */}

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

        {/* CENTER — hero portrait (plain, no frame, no pedestal, no blob) */}
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

          {/* Tap hint — minimal pill bottom-right */}
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

      {/* ── WARD DEFENSE ENTRY ── */}
      <Pressable
        style={styles.wardDefBtn}
        onPress={() => router.push("/ward-defense")}
        testID="home-ward-defense"
      >
        <View style={styles.wardDefLeft}>
          <Text style={styles.wardDefNew}>NEW</Text>
          <Text style={styles.wardDefTitle}>Ward Defense</Text>
          <Text style={styles.wardDefSub}>Airway Rush · 5 waves + boss</Text>
        </View>
        <View style={styles.wardDefRight}>
          <Text style={{ fontSize: 28 }}>🐲</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.air + "80"} />
        </View>
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
   SCENIC BACKGROUNDS
   True three-layer approach:
     Layer 1 — neutral near-black base (not element-tinted)
     Layer 2 — environment scene (architectural, environment-forward)
     Layer 3 — vignette + hero ground shadow (depth/grounding)
   Element/ward colors used ONLY for specific light sources and
   small accent props — never as the dominant room color.
   ══════════════════════════════════════════════════════════ */

type SceneProps = { o: string; a: string };

/* ── Grand Ward Atrium — modern hospital interior, night ── */
function CardiacWardScene({ o, a }: SceneProps) {
  return (
    <>
      {/* Stone/plaster hospital walls — cool architectural grey, not ward-blue */}
      <LinearGradient colors={["#0d1520", "#111822", "#0c131c"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFillObject} />

      {/* Dado rail + lower wall panel */}
      <View style={{ position: "absolute", top: "60%", left: 0, right: 0, height: 2, backgroundColor: "#1a2838" }} />
      <LinearGradient colors={["#0a0f18", "#080d14"]} style={{ position: "absolute", top: "60%", left: 0, right: 0, height: "12%", bottom: 0 }} />

      {/* Ceiling: fluorescent light panels */}
      <View style={{ position: "absolute", top: "3%", left: "16%", width: "34%", height: "2.5%", backgroundColor: "#cce8f4", borderRadius: 2, opacity: 0.82 }} />
      <LinearGradient colors={["#b8dceea0", "#00000000"]} style={{ position: "absolute", top: "5.5%", left: "6%", width: "52%", height: "20%" }} />
      <View style={{ position: "absolute", top: "3%", right: "14%", width: "20%", height: "2.5%", backgroundColor: "#cce8f4", borderRadius: 2, opacity: 0.6 }} />
      <LinearGradient colors={["#b8dcee70", "#00000000"]} style={{ position: "absolute", top: "5.5%", right: "6%", width: "34%", height: "14%" }} />

      {/* LEFT — large window with city skyline at night */}
      <View style={{ position: "absolute", left: "3%", top: "8%", width: "24%", height: "50%", borderWidth: 1.5, borderColor: "#243848", borderRadius: 2, overflow: "hidden" }}>
        <LinearGradient colors={["#060c18", "#0a1428", "#070e1e"]} style={{ flex: 1 }} />
        {/* City building silhouettes */}
        <View style={{ position: "absolute", bottom: 0, left: "5%", width: "18%", height: "44%", backgroundColor: "#040810" }} />
        <View style={{ position: "absolute", bottom: 0, left: "24%", width: "12%", height: "60%", backgroundColor: "#030710" }} />
        <View style={{ position: "absolute", bottom: 0, left: "38%", width: "16%", height: "35%", backgroundColor: "#040810" }} />
        <View style={{ position: "absolute", bottom: 0, right: "12%", width: "20%", height: "52%", backgroundColor: "#030710" }} />
        <View style={{ position: "absolute", bottom: 0, right: "0%",  width: "14%", height: "42%", backgroundColor: "#040810" }} />
        {/* City lights — tiny warm/cool dots */}
        {[{t:"16%",l:"14%"},{t:"28%",l:"58%"},{t:"20%",l:"74%"},{t:"44%",l:"26%"},{t:"38%",l:"62%"},{t:"24%",l:"40%"},{t:"32%",l:"84%"}].map((d, i) => (
          <View key={i} style={{ position: "absolute", top: d.t as any, left: d.l as any,
            width: i % 2 === 0 ? 2 : 1.5, height: i % 2 === 0 ? 2 : 1.5, borderRadius: 2,
            backgroundColor: i % 3 === 0 ? "#ffd06070" : i % 3 === 1 ? "#60a5ff70" : "#ffe08070" }} />
        ))}
        {/* Moonlight wash */}
        <LinearGradient colors={["#c0c8d410", "#00000000"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: "40%" }} />
      </View>
      {/* Window frame — horizontal crossbar */}
      <View style={{ position: "absolute", left: "3%", top: "33%", width: "24%", height: 1, backgroundColor: "#243848" }} />

      {/* RIGHT — cardiac monitor */}
      <View style={{ position: "absolute", right: "4%", top: "14%", width: "16%", height: "36%",
        backgroundColor: "#0c1a2a", borderRadius: 4, borderWidth: 1, borderColor: "#1c3048" }}>
        <View style={{ position: "absolute", top: "10%", left: "10%", right: "10%", height: "42%",
          backgroundColor: "#050e12", borderRadius: 2 }}>
          {/* ECG wave line */}
          <View style={{ position: "absolute", top: "48%", left: 0, right: 0, height: 1, backgroundColor: o + "75" }} />
          <LinearGradient colors={[o + "00", o + "38", o + "00"]} locations={[0, 0.5, 1]}
            style={{ position: "absolute", top: "22%", left: 0, right: 0, height: "52%" }} />
        </View>
        {/* Status LEDs */}
        <View style={{ position: "absolute", bottom: "14%", left: "18%", width: 3, height: 3, borderRadius: 2, backgroundColor: o + "CC" }} />
        <View style={{ position: "absolute", bottom: "14%", right: "22%", width: 3, height: 3, borderRadius: 2, backgroundColor: "#22c55e90" }} />
        {/* Brand stripe */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: "8%", backgroundColor: "#0e2038", borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
      </View>
      {/* Monitor arm */}
      <View style={{ position: "absolute", right: "11%", top: "50%", width: 2, height: "22%", backgroundColor: "#1e3048" }} />
      <View style={{ position: "absolute", right: "8%",  top: "71%", width: "8%",  height: 3, borderRadius: 2, backgroundColor: "#1e3048" }} />

      {/* IV pole — left of center */}
      <View style={{ position: "absolute", left: "32%", top: 0, width: 2, height: "72%", backgroundColor: "#243a52" }} />
      <View style={{ position: "absolute", left: "30%", top: "2%", width: "5%", height: 2, borderRadius: 1, backgroundColor: "#243a52" }} />
      {/* IV bag */}
      <View style={{ position: "absolute", left: "29%", top: "3%", width: "5.5%", height: "11%",
        borderRadius: 4, backgroundColor: "#11283e", borderWidth: 1, borderColor: o + "45" }}>
        <LinearGradient colors={[o + "20", o + "08"]} style={{ flex: 1, borderRadius: 4 }} />
      </View>
      {/* IV tube */}
      <View style={{ position: "absolute", left: "31%", top: "14%", width: 1, height: "18%", backgroundColor: "#1e3460" }} />

      {/* Hospital bed silhouette */}
      <View style={{ position: "absolute", bottom: "28%", left: "3%", width: "30%", height: "5%", backgroundColor: "#121e2c", borderRadius: 2 }} />
      <View style={{ position: "absolute", bottom: "33%", left: "3%", width: "30%", height: "7%", backgroundColor: "#0e1822", borderRadius: 2 }} />
      <View style={{ position: "absolute", bottom: "24%", left: "6%",  width: 2, height: "4%", backgroundColor: "#121e2c" }} />
      <View style={{ position: "absolute", bottom: "24%", left: "28%", width: 2, height: "4%", backgroundColor: "#121e2c" }} />

      {/* Floor — polished linoleum */}
      <LinearGradient colors={["#07101e", "#0b1622"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "27%" }} />
      <View style={{ position: "absolute", bottom: "23%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff0a" }} />
      <View style={{ position: "absolute", bottom: "17%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff07" }} />
      <View style={{ position: "absolute", bottom: "11%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff05" }} />
      {/* Floor reflection strip under hero */}
      <LinearGradient colors={["#00000000", "#b8dcee08", "#00000000"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: "absolute", bottom: "25%", left: "20%", right: "20%", height: 2 }} />
    </>
  );
}

/* ── Healer's Garden Spire — stone pavilion, arched window, moonlight, bamboo ── */
function RespiratorySpireScene({ o, a }: SceneProps) {
  return (
    <>
      {/* Stone wall — deep slate, not element-blue */}
      <LinearGradient colors={["#0c1520", "#101820", "#0a1218"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFillObject} />
      {/* Stone coursing lines */}
      {[14, 28, 44, 60].map((t, i) => (
        <View key={i} style={{ position: "absolute", top: `${t}%`, left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff06" }} />
      ))}
      {/* Vertical stone joints */}
      {[25, 52, 76].map((l, i) => (
        <View key={i} style={{ position: "absolute", left: `${l}%`, top: 0, bottom: "30%", width: 0.5, backgroundColor: "#ffffff04" }} />
      ))}

      {/* Tall pointed arch window — center back */}
      <View style={{ position: "absolute", alignSelf: "center", top: "4%", width: "38%", height: "62%",
        borderTopLeftRadius: 999, borderTopRightRadius: 999, borderWidth: 1.5, borderColor: "#2e4050", overflow: "hidden" }}>
        {/* Night sky through window */}
        <LinearGradient colors={["#0c1a2e", "#101e30", "#0a1422"]} style={{ flex: 1 }} />
        {/* Stars through window */}
        {[{t:"10%",l:"20%"},{t:"22%",l:"60%"},{t:"16%",l:"80%"},{t:"34%",l:"38%"},{t:"28%",l:"72%"}].map((d, i) => (
          <View key={i} style={{ position: "absolute", top: d.t as any, left: d.l as any, width: 1.5, height: 1.5, borderRadius: 1, backgroundColor: "#e8f0f880" }} />
        ))}
        {/* Moon */}
        <View style={{ position: "absolute", top: "8%", left: "52%", width: 18, height: 18, borderRadius: 9, backgroundColor: "#d8e8f0", opacity: 0.4 }} />
        {/* Moonbeam through arch */}
        <LinearGradient colors={[o + "22", "#00000000"]} style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "70%" }} />
        <LinearGradient colors={["#c0d8e818", "#00000000"]} style={{ position: "absolute", top: 0, left: "30%", right: "30%", height: "90%" }} />
      </View>
      {/* Arch sill */}
      <View style={{ position: "absolute", alignSelf: "center", top: "66%", width: "44%", height: "2%", backgroundColor: "#16242e", borderRadius: 1 }} />
      {/* Moonlight cast on floor */}
      <LinearGradient colors={[o + "18", "#00000000"]} style={{ position: "absolute", alignSelf: "center", top: "4%", width: "56%", height: "44%", borderTopLeftRadius: 999, borderTopRightRadius: 999 }} />

      {/* LEFT — bamboo grove */}
      <View style={{ position: "absolute", left: "3%",  top: 0, width: 3,   height: "70%", backgroundColor: "#1e3226", borderRadius: 2 }} />
      <View style={{ position: "absolute", left: "8%",  top: "4%", width: 2, height: "64%", backgroundColor: "#182a1e", borderRadius: 2 }} />
      <View style={{ position: "absolute", left: "12%", top: "1%", width: 2.5, height: "60%", backgroundColor: "#1c3022", borderRadius: 2 }} />
      {[10, 26, 42, 58].map((t, i) => (
        <View key={i} style={{ position: "absolute", left: "2%", top: `${t}%`, width: "14%", height: 1.5, backgroundColor: "#243a28" }} />
      ))}
      {/* Bamboo foliage blobs */}
      <View style={{ position: "absolute", left: "0%",  top: "4%",  width: "18%", height: "14%", borderRadius: 999, backgroundColor: "#1e3020", opacity: 0.55 }} />
      <View style={{ position: "absolute", left: "4%",  top: "20%", width: "12%", height: "10%", borderRadius: 999, backgroundColor: "#1c2e1e", opacity: 0.45 }} />
      <View style={{ position: "absolute", left: "-2%", top: "36%", width: "16%", height: "12%", borderRadius: 999, backgroundColor: "#1a2c1c", opacity: 0.4 }} />

      {/* Hanging herb bundles */}
      {[{ l: "30%" }, { l: "50%" }, { l: "68%" }].map((b, i) => (
        <View key={i}>
          <View style={{ position: "absolute", top: 0, left: b.l as any, width: 2, height: `${14 + i * 2}%`, backgroundColor: "#243a20" }} />
          <View style={{ position: "absolute", top: `${13 + i * 2}%`, left: b.l as any, marginLeft: -5, width: 13, height: 9, borderRadius: 999, backgroundColor: "#1e2e18", opacity: 0.75 }} />
        </View>
      ))}

      {/* RIGHT — stone lantern on pillar */}
      <View style={{ position: "absolute", right: "8%",  top: "10%", width: 2,    height: "30%", backgroundColor: "#1e2e30" }} />
      <View style={{ position: "absolute", right: "5.5%",top: "34%", width: "7%", height: "8%", borderRadius: 3, backgroundColor: "#182020", borderWidth: 1, borderColor: o + "55" }}>
        <LinearGradient colors={[o + "45", o + "10"]} style={{ flex: 1, borderRadius: 3 }} />
      </View>
      <LinearGradient colors={[o + "28", "#00000000"]} style={{ position: "absolute", right: "3%", top: "38%", width: "14%", height: "22%", borderRadius: 999 }} />

      {/* Incense burner center */}
      <View style={{ position: "absolute", bottom: "31%", alignSelf: "center", width: "10%", height: "3%", backgroundColor: "#182022", borderRadius: 2 }} />
      <View style={{ position: "absolute", bottom: "34%", alignSelf: "center", width: "14%", height: "1.5%", borderRadius: 999, backgroundColor: "#1a2420" }} />
      <LinearGradient colors={[o + "00", o + "16", o + "00"]} locations={[0, 0.35, 1]}
        style={{ position: "absolute", bottom: "35%", alignSelf: "center", width: "4%", height: "30%", borderRadius: 999 }} />

      {/* Stone floor */}
      <LinearGradient colors={["#0c1620", "#101a28"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "30%" }} />
      <View style={{ position: "absolute", bottom: "26%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff0A" }} />
      <View style={{ position: "absolute", bottom: "18%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff08" }} />
      <View style={{ position: "absolute", bottom: "10%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff06" }} />
      {/* Moonlight floor reflection */}
      <LinearGradient colors={["#00000000", "#c0d8e810", "#00000000"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: "absolute", bottom: "27%", left: "20%", right: "20%", height: 3 }} />
    </>
  );
}

/* ── Alchemical Forge — stone dungeon, torches, shelves, cauldron ── */
function ImmuneForgeScene({ o, a }: SceneProps) {
  return (
    <>
      {/* Dark charcoal stone — warm but very dark */}
      <LinearGradient colors={["#0e0c08", "#120e0a", "#0c0a06"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFillObject} />
      {/* Stone block lines */}
      {[10, 22, 36, 50, 64, 78].map((t, i) => (
        <View key={i} style={{ position: "absolute", top: `${t}%`, left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff06" }} />
      ))}
      {[22, 50, 76].map((l, i) => (
        <View key={i} style={{ position: "absolute", left: `${l}%`, top: 0, bottom: "28%", width: 0.5, backgroundColor: "#ffffff04" }} />
      ))}

      {/* Stone arch piers */}
      <View style={{ position: "absolute", left:  "17%", top: 0, width: "6%", height: "28%", backgroundColor: "#0b0906" }} />
      <View style={{ position: "absolute", right: "17%", top: 0, width: "6%", height: "28%", backgroundColor: "#0b0906" }} />
      <View style={{ position: "absolute", alignSelf: "center", top: 0, width: "32%", height: "6%", backgroundColor: "#0b0906", borderBottomLeftRadius: 22, borderBottomRightRadius: 22 }} />

      {/* LEFT TORCH */}
      <View style={{ position: "absolute", left: "6%", top: "23%", width: "9%", height: "3%", backgroundColor: "#2a1a0e", borderRadius: 2 }} />
      <View style={{ position: "absolute", left: "9%", top: "13%", width: 3, height: "12%", backgroundColor: "#3a2818" }} />
      <View style={{ position: "absolute", left: "7.5%", top: "8%", width: "6%", height: "6%", borderRadius: 999, backgroundColor: o + "95" }} />
      <LinearGradient colors={[o + "65", o + "28", "#00000000"]} locations={[0, 0.5, 1]}
        style={{ position: "absolute", left: "2%", top: "6%", width: "14%", height: "28%", borderRadius: 999 }} />
      {/* torch inner flicker */}
      <View style={{ position: "absolute", left: "9%", top: "6%", width: 3, height: "4%", borderRadius: 999, backgroundColor: "#fff8d090" }} />

      {/* RIGHT TORCH */}
      <View style={{ position: "absolute", right: "6%", top: "23%", width: "9%", height: "3%", backgroundColor: "#2a1a0e", borderRadius: 2 }} />
      <View style={{ position: "absolute", right: "9%", top: "13%", width: 3, height: "12%", backgroundColor: "#3a2818" }} />
      <View style={{ position: "absolute", right: "7.5%", top: "8%", width: "6%", height: "6%", borderRadius: 999, backgroundColor: o + "95" }} />
      <LinearGradient colors={[o + "65", o + "28", "#00000000"]} locations={[0, 0.5, 1]}
        style={{ position: "absolute", right: "2%", top: "6%", width: "14%", height: "28%", borderRadius: 999 }} />
      <View style={{ position: "absolute", right: "9%", top: "6%", width: 3, height: "4%", borderRadius: 999, backgroundColor: "#fff8d090" }} />

      {/* LEFT SHELF */}
      <View style={{ position: "absolute", left: "2%", top: "47%", width: "18%", height: 2, backgroundColor: "#2a1a0e" }} />
      <View style={{ position: "absolute", left: "3%", top: "38%", width: "5%", height: "10%", borderRadius: 3, backgroundColor: "#1a2810", borderWidth: 1, borderColor: o + "45" }} />
      <View style={{ position: "absolute", left: "10%", top: "36%", width: "3.5%", height: "12%", borderRadius: 999, backgroundColor: "#2c1810", borderWidth: 1, borderColor: "#dc262660" }} />
      <View style={{ position: "absolute", left: "15%", top: "39%", width: "4%", height: "9%", borderRadius: 3, backgroundColor: "#18201c", borderWidth: 1, borderColor: "#22c55e45" }} />

      {/* CAULDRON CENTER */}
      <View style={{ position: "absolute", bottom: "28%", alignSelf: "center", width: "28%", height: "16%", borderRadius: 36, backgroundColor: "#0c0804", borderWidth: 2, borderColor: "#2a1c0e" }} />
      <View style={{ position: "absolute", bottom: "44%", alignSelf: "center", width: "32%", height: "3%", borderRadius: 999, backgroundColor: "#1c120a" }} />
      <LinearGradient colors={[o + "55", o + "22", "#00000000"]} locations={[0, 0.5, 1]}
        style={{ position: "absolute", bottom: "46%", alignSelf: "center", width: "24%", height: "22%", borderRadius: 999, opacity: 0.8 }} />
      {/* Bubbling smoke */}
      <LinearGradient colors={[o + "35", o + "12", "#00000000"]} locations={[0, 0.6, 1]}
        style={{ position: "absolute", bottom: "60%", alignSelf: "center", width: "12%", height: "24%", borderRadius: 999 }} />
      {/* Ember sparks */}
      {[{t:"18%",l:"28%"},{t:"10%",l:"56%"},{t:"14%",r:"24%"},{t:"24%",l:"70%"},{t:"8%",l:"42%"}].map((p, i) => (
        <View key={i} style={{ position: "absolute", top: p.t as any, left: (p as any).l as any, right: (p as any).r as any,
          width: i % 2 === 0 ? 3 : 2, height: i % 2 === 0 ? 3 : 2, borderRadius: 2, backgroundColor: o + "BB" }} />
      ))}

      {/* Floor — stone flags */}
      <LinearGradient colors={["#0a0804", "#0e0c08"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "27%" }} />
      <View style={{ position: "absolute", bottom: "23%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff08" }} />
      <View style={{ position: "absolute", bottom: "15%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff06" }} />
      {/* Cauldron floor glow reflection */}
      <LinearGradient colors={["#00000000", o + "10", "#00000000"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: "absolute", bottom: "25%", left: "25%", right: "25%", height: 4, borderRadius: 4 }} />
    </>
  );
}

/* ── Neural Observatory — deep tech dome, holographic ring, specimen jars, monitors ── */
function NeuralChamberScene({ o, a }: SceneProps) {
  return (
    <>
      {/* Deep tech — charcoal, not element-purple */}
      <LinearGradient colors={["#07050e", "#0c0a18", "#06040c"]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFillObject} />

      {/* CENTRAL HOLOGRAPHIC RING — primary point of interest */}
      <View style={{ position: "absolute", alignSelf: "center", top: "3%", width: "58%", aspectRatio: 1,
        borderRadius: 999, borderWidth: 1.5, borderColor: o + "34" }} />
      <View style={{ position: "absolute", alignSelf: "center", top: "12%", width: "40%", aspectRatio: 1,
        borderRadius: 999, borderWidth: 1, borderColor: o + "22" }} />
      <View style={{ position: "absolute", alignSelf: "center", top: "20%", width: "22%", aspectRatio: 1,
        borderRadius: 999, borderWidth: 0.5, borderColor: o + "16" }} />
      {/* Ring cross hairs */}
      <View style={{ position: "absolute", alignSelf: "center", top: "32%", left: "22%", right: "22%", height: 0.5, backgroundColor: o + "1e" }} />
      <View style={{ position: "absolute", alignSelf: "center", top: "3%", width: 0.5, height: "30%", backgroundColor: o + "14" }} />
      {/* Ring center node */}
      <View style={{ position: "absolute", alignSelf: "center", top: "28%", width: 10, height: 10, borderRadius: 5, backgroundColor: o + "a0" }} />
      <LinearGradient colors={[o + "40", "#00000000"]} style={{ position: "absolute", alignSelf: "center", top: "24%", width: "14%", aspectRatio: 1, borderRadius: 999 }} />

      {/* WALL MONITOR — left */}
      <View style={{ position: "absolute", left: "2%", top: "12%", width: "15%", height: "34%",
        borderWidth: 1, borderColor: o + "24", borderRadius: 2, overflow: "hidden" }}>
        <LinearGradient colors={[o + "0c", "#00000000"]} style={{ flex: 1 }} />
        {[16, 32, 48, 64, 80].map((t, i) => (
          <View key={i} style={{ position: "absolute", top: `${t}%`, left: "10%", right: "10%", height: 0.5, backgroundColor: o + (i % 2 === 0 ? "20" : "10") }} />
        ))}
        {/* Small graph bar chart */}
        {[40, 65, 50, 80, 55].map((h, i) => (
          <View key={i} style={{ position: "absolute", bottom: "18%", left: `${12 + i * 16}%`, width: "10%", height: `${h * 0.2}%`, backgroundColor: o + "30", borderRadius: 1 }} />
        ))}
      </View>

      {/* WALL MONITOR — right */}
      <View style={{ position: "absolute", right: "2%", top: "18%", width: "13%", height: "28%",
        borderWidth: 1, borderColor: o + "20", borderRadius: 2, overflow: "hidden" }}>
        <LinearGradient colors={[o + "08", "#00000000"]} style={{ flex: 1 }} />
        {[22, 44, 66, 88].map((t, i) => (
          <View key={i} style={{ position: "absolute", top: `${t}%`, left: "10%", right: "10%", height: 0.5, backgroundColor: o + "14" }} />
        ))}
      </View>

      {/* LAB BENCH — full width */}
      <View style={{ position: "absolute", bottom: "28%", left: 0, right: 0, height: "5%", backgroundColor: "#0f0c1e" }} />
      <View style={{ position: "absolute", bottom: "33%", left: 0, right: 0, height: 1.5, backgroundColor: o + "28" }} />
      {/* Specimen jars */}
      {[{l:"18%",c:o},{l:"32%",c:"#22c55e"},{l:"47%",c:"#f97316"},{l:"62%",c:o},{l:"76%",c:"#ec4899"}].map((j, i) => (
        <View key={i} style={{ position: "absolute", bottom: "33%", left: j.l as any, width: "6.5%", height: "12%",
          borderRadius: 3, backgroundColor: "#0c0a1a", borderWidth: 1, borderColor: j.c + "55" }}>
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "40%", borderRadius: 3, backgroundColor: j.c + "22" }} />
        </View>
      ))}
      {/* Floating data particles */}
      {[{t:"32%",l:"18%"},{t:"22%",l:"72%"},{t:"44%",r:"22%"},{t:"16%",l:"40%"},{t:"40%",l:"56%"}].map((p, i) => (
        <View key={i} style={{ position: "absolute", top: p.t as any, left: (p as any).l as any, right: (p as any).r as any,
          width: 2, height: 2, borderRadius: 1, backgroundColor: o + "65" }} />
      ))}

      {/* Floor */}
      <LinearGradient colors={["#04020c", "#080614"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "27%" }} />
    </>
  );
}

/* ── Restoration Hall — ancient healing temple, stone pillars, sacred altar, arch ── */
function DefaultHallScene({ o, a }: SceneProps) {
  return (
    <>
      {/* Warm ancient stone — not element-tinted */}
      <LinearGradient colors={["#0f0c08", "#130e0a", "#110c08"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFillObject} />
      {/* Stone coursing */}
      {[10, 24, 38, 54, 68, 82].map((t, i) => (
        <View key={i} style={{ position: "absolute", top: `${t}%`, left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff05" }} />
      ))}

      {/* LEFT PILLAR */}
      <View style={{ position: "absolute", left: "6%", top: 0, bottom: 0, width: "11%", backgroundColor: "#0b0906" }} />
      <View style={{ position: "absolute", left: "6%",  top: 0, bottom: 0, width: 1.5, backgroundColor: o + "24" }} />
      <View style={{ position: "absolute", left: "17%", top: 0, bottom: 0, width: 1,   backgroundColor: o + "12" }} />
      {/* Pillar capital */}
      <View style={{ position: "absolute", left: "4%", top: 0, width: "15%", height: "5%", backgroundColor: "#090706" }} />
      <View style={{ position: "absolute", left: "4%", bottom: "27%", width: "15%", height: "3%", backgroundColor: "#090706" }} />
      {/* Lantern */}
      <View style={{ position: "absolute", left: "8.5%", top: "22%", width: "5%", height: "9%",
        borderRadius: 2, backgroundColor: "#18100a", borderWidth: 1, borderColor: o + "58" }}>
        <LinearGradient colors={[o + "48", o + "12"]} style={{ flex: 1, borderRadius: 2 }} />
      </View>
      <LinearGradient colors={[o + "30", "#00000000"]} style={{ position: "absolute", left: "6%", top: "24%", width: "11%", height: "22%", borderRadius: 999 }} />

      {/* RIGHT PILLAR */}
      <View style={{ position: "absolute", right: "6%", top: 0, bottom: 0, width: "11%", backgroundColor: "#0b0906" }} />
      <View style={{ position: "absolute", right: "6%",  top: 0, bottom: 0, width: 1.5, backgroundColor: o + "24" }} />
      <View style={{ position: "absolute", right: "17%", top: 0, bottom: 0, width: 1,   backgroundColor: o + "12" }} />
      <View style={{ position: "absolute", right: "4%", top: 0, width: "15%", height: "5%", backgroundColor: "#090706" }} />
      <View style={{ position: "absolute", right: "4%", bottom: "27%", width: "15%", height: "3%", backgroundColor: "#090706" }} />
      <View style={{ position: "absolute", right: "8.5%", top: "22%", width: "5%", height: "9%",
        borderRadius: 2, backgroundColor: "#18100a", borderWidth: 1, borderColor: o + "58" }}>
        <LinearGradient colors={[o + "48", o + "12"]} style={{ flex: 1, borderRadius: 2 }} />
      </View>
      <LinearGradient colors={[o + "30", "#00000000"]} style={{ position: "absolute", right: "6%", top: "24%", width: "11%", height: "22%", borderRadius: 999 }} />

      {/* CENTRAL ARCH + TAPESTRY */}
      <View style={{ position: "absolute", alignSelf: "center", top: "6%", width: "42%", height: "58%",
        borderTopLeftRadius: 999, borderTopRightRadius: 999, borderWidth: 1.5, borderColor: o + "22", overflow: "hidden" }}>
        <LinearGradient colors={[o + "16", o + "08", "#00000000"]} locations={[0, 0.5, 1]} style={{ flex: 1 }} />
        {/* Cross motif inside arch */}
        <View style={{ position: "absolute", alignSelf: "center", top: "18%", width: "5%", height: "32%", backgroundColor: o + "22" }} />
        <View style={{ position: "absolute", alignSelf: "center", top: "28%", height: "10%", left: "28%", right: "28%", backgroundColor: o + "22" }} />
      </View>
      <LinearGradient colors={[o + "20", "#00000000"]} style={{ position: "absolute", alignSelf: "center", top: "6%", width: "42%", height: "32%", borderTopLeftRadius: 999, borderTopRightRadius: 999 }} />

      {/* ALTAR */}
      <View style={{ position: "absolute", bottom: "28%", alignSelf: "center", width: "38%", height: "4%",
        backgroundColor: "#131008", borderRadius: 3, borderTopWidth: 1, borderColor: o + "40" }} />
      <LinearGradient colors={[o + "32", "#00000000"]} style={{ position: "absolute", bottom: "32%", alignSelf: "center", width: "30%", height: "14%", borderRadius: 999 }} />
      <View style={{ position: "absolute", bottom: "24%", alignSelf: "center", width: "46%", height: "2.5%", backgroundColor: "#100e08", borderRadius: 2 }} />
      <View style={{ position: "absolute", bottom: "22%", alignSelf: "center", width: "54%", height: "2.5%", backgroundColor: "#0e0c06", borderRadius: 2 }} />

      {/* FLOOR — polished stone */}
      <LinearGradient colors={["#080604", "#0c0a08"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "25%" }} />
      <View style={{ position: "absolute", bottom: "21%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff08" }} />
      <View style={{ position: "absolute", bottom: "13%", left: 0, right: 0, height: 0.5, backgroundColor: "#ffffff06" }} />
      {/* Altar reflection */}
      <LinearGradient colors={["#00000000", o + "0e", "#00000000"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: "absolute", bottom: "23%", left: "24%", right: "24%", height: 3 }} />
    </>
  );
}

/* ── SceneBg wrapper — three-layer compositor ── */
function SceneBg({
  element, scene,
}: {
  element: string;
  scene: { accent: string; orb1: string; orb2: string };
}) {
  const o = scene.orb1;
  const a = scene.accent;

  return (
    <>
      {/* LAYER 1 — universal near-black neutral base */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#06080c" }]} />

      {/* LAYER 2 — environment scene (draws its own atmosphere) */}
      {element === "River"                               && <CardiacWardScene   o={o} a={a} />}
      {element === "Air"                                 && <RespiratorySpireScene o={o} a={a} />}
      {element === "Fire"                                && <ImmuneForgeScene   o={o} a={a} />}
      {element === "Mind"                                && <NeuralChamberScene o={o} a={a} />}
      {!["River","Air","Fire","Mind"].includes(element)  && <DefaultHallScene   o={o} a={a} />}

      {/* LAYER 3a — hero ground shadow (visually grounds the portrait) */}
      <LinearGradient
        colors={["#00000000", "rgba(4,6,10,0.55)"]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "38%" }}
      />
      {/* subtle oval shadow under hero feet */}
      <View style={{ position: "absolute", bottom: "1%", left: "28%", right: "28%", height: 18,
        borderRadius: 999, backgroundColor: "rgba(4,6,10,0.50)" }} />

      {/* LAYER 3b — edge depth vignette */}
      <LinearGradient colors={["rgba(4,6,10,0.78)", "rgba(4,6,10,0.0)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sc.edgeLeft} />
      <LinearGradient colors={["rgba(4,6,10,0.0)", "rgba(4,6,10,0.78)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sc.edgeRight} />

      {/* LAYER 3c — top vignette */}
      <LinearGradient colors={["rgba(4,6,10,0.75)", "rgba(4,6,10,0.0)"]} style={sc.topVignette} />
    </>
  );
}

/** Shared structural styles for SceneBg */
const sc = StyleSheet.create({
  edgeLeft:    { position: "absolute", top: 0, bottom: 0, left: 0,  width: "18%" },
  edgeRight:   { position: "absolute", top: 0, bottom: 0, right: 0, width: "18%" },
  topVignette: { position: "absolute", top: 0, left: 0, right: 0,   height: "22%" },
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

  /* Scene label */
  sceneLabelRow: {
    flexDirection: "row", alignItems: "center",
    gap: 5, paddingHorizontal: SPACING.lg, paddingBottom: 4,
  },
  sceneDot:  { width: 5, height: 5, borderRadius: 3 },
  sceneLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 2 },

  /* Arena — fills remaining vertical space */
  arena: { flex: 1, flexDirection: "row", alignItems: "stretch", overflow: "hidden" },

  /* Side columns */
  sideCol: { width: 72, justifyContent: "space-evenly", alignItems: "center", paddingVertical: SPACING.sm },
  featBtn:    { alignItems: "center", gap: 4 },
  featCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  featLabel:  { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, textAlign: "center" },
  featLock:   { color: COLORS.onSurfaceTertiary, fontSize: 9 },

  /* Hero center — transparent, no frame or pedestal */
  heroCenter: { flex: 1, position: "relative" },
  heroImg:        { flex: 1, width: "100%" },
  heroPlaceholder:{ flex: 1, backgroundColor: "transparent" },

  /* Tap hint */
  tapPulse: {
    position: "absolute", bottom: SPACING.sm, right: SPACING.sm,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(12,14,18,0.55)",
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  tapDot:   { width: 5, height: 5, borderRadius: 3, opacity: 0.85 },
  tapLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.6 },

  /* Hero info panel */
  infoPanel: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginTop: SPACING.xs,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1,
  },
  elementBadge: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 4, alignSelf: "center" },
  elementTxt:   { fontSize: 9, fontWeight: "700", letterSpacing: 1.4 },
  heroName:     { color: COLORS.onSurface, fontSize: 15, fontWeight: "700" },
  heroTitle:    { color: COLORS.onSurfaceSecondary, fontSize: 11, marginTop: 1 },
  xpCol:        { alignItems: "flex-end", gap: 3 },
  xpBg:         { width: 64, height: 3, borderRadius: 2, backgroundColor: COLORS.border, overflow: "hidden" },
  xpBar:        { height: "100%", borderRadius: 2 },
  xpTxt:        { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.6 },

  /* Start button */
  startBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.brand,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm, marginBottom: SPACING.xs,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
  },
  startTxt: { color: COLORS.onBrand, fontSize: 14, fontWeight: "700", letterSpacing: 2 },

  /* Ward Defense card */
  wardDefBtn: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.air + "40",
    backgroundColor: COLORS.surfaceSecondary,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  wardDefLeft:  { flex: 1, gap: 2 },
  wardDefNew:   { color: COLORS.air, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  wardDefTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "700" },
  wardDefSub:   { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  wardDefRight: { flexDirection: "row", alignItems: "center", gap: 4 },

  /* Intro modal */
  introOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" },
  introPanel: {
    backgroundColor: COLORS.surfaceSecondary,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: SPACING.xl, paddingBottom: SPACING.xxxl,
    borderTopWidth: 1, borderColor: COLORS.brand + "40",
    gap: SPACING.md,
  },
  introHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: SPACING.sm },
  introKicker:  { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  introTitle:   { color: COLORS.onSurface, fontSize: 26, fontWeight: "300" },
  introBody:    { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 22 },
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
