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
  const shimAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(INTRO_KEY).then((v) => { if (!v) setShowIntro(true); });
  }, []);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.25, duration: 850, useNativeDriver: false }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 850, useNativeDriver: false }),
      Animated.delay(1600),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(shimAnim, { toValue: 1, duration: 3200, useNativeDriver: false }),
      Animated.timing(shimAnim, { toValue: 0, duration: 3200, useNativeDriver: false }),
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

  const floorOpacity = shimAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

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
          floorOpacity={floorOpacity}
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
   SCENIC BACKGROUNDS — one per element
   All shapes are absolute-positioned Views/LinearGradients.
   ══════════════════════════════════════════════════════════ */

type SceneProps = { o: string; a: string }; // orb1 color, accent color

/** Cardiac Ward — Hospital Cathedral. Stone columns, gothic arch window. */
function CardiacWardScene({ o, a }: SceneProps) {
  const COL = "#030d18";
  return (
    <>
      {/* Stone column — left */}
      <View style={[sc.col, { left: 0, width: "19%" }]} />
      <View style={{ position: "absolute", left: "19%", top: 0, bottom: 0, width: 1, backgroundColor: o + "35" }} />
      {/* Stone column — right */}
      <View style={[sc.col, { right: 0, width: "19%" }]} />
      <View style={{ position: "absolute", right: "19%", top: 0, bottom: 0, width: 1, backgroundColor: o + "35" }} />

      {/* Column capitals (wider top block) */}
      <View style={{ position: "absolute", left: 0, top: 0, width: "22%", height: "6%", backgroundColor: COL + "CC" }} />
      <View style={{ position: "absolute", right: 0, top: 0, width: "22%", height: "6%", backgroundColor: COL + "CC" }} />

      {/* Gothic arch window — tall oval behind hero, element glow */}
      <View style={[sc.archOuter, { backgroundColor: o + "14" }]} />
      <View style={[sc.archInner, { backgroundColor: o + "0C" }]} />

      {/* Light beam strips fanning from arch top */}
      <LinearGradient colors={[o + "1A", o + "00"]} locations={[0, 1]}
        style={[sc.beam, { top: "6%",  left: "19%", right: "19%", height: "18%" }]} />
      <LinearGradient colors={[o + "12", o + "00"]} locations={[0, 1]}
        style={[sc.beam, { top: "20%", left: "22%", right: "22%", height: "20%" }]} />

      {/* Horizon wall cornice line */}
      <View style={{ position: "absolute", bottom: "37%", left: "19%", right: "19%", height: 1, backgroundColor: o + "40" }} />

      {/* Floor: pulse crystal accents */}
      <View style={{ position: "absolute", bottom: "33%", left: "27%", width: 3, height: 9,  borderRadius: 2, backgroundColor: o + "70" }} />
      <View style={{ position: "absolute", bottom: "35%", left: "33%", width: 2, height: 6,  borderRadius: 1, backgroundColor: a + "90" }} />
      <View style={{ position: "absolute", bottom: "32%", right: "27%", width: 3, height: 8, borderRadius: 2, backgroundColor: o + "60" }} />
      <View style={{ position: "absolute", bottom: "34%", right: "33%", width: 2, height: 5, borderRadius: 1, backgroundColor: a + "70" }} />
    </>
  );
}

/** Respiratory Spire — Sky Sanctuary. Pointed spires, layered clouds, pale mist. */
function RespiratorySpireScene({ o, a }: SceneProps) {
  return (
    <>
      {/* Left spire body */}
      <View style={{ position: "absolute", left: "8%", top: 0, height: "72%", width: "7%", backgroundColor: "#0a1520", borderTopLeftRadius: 999, borderTopRightRadius: 999 }} />
      {/* Left spire tip (narrower) */}
      <View style={{ position: "absolute", left: "10%", top: "-6%", width: "3%", height: "15%", backgroundColor: "#0a1520", borderTopLeftRadius: 999, borderTopRightRadius: 999 }} />
      {/* Left spire window slit */}
      <View style={{ position: "absolute", left: "10.5%", top: "25%", width: "2%", height: "12%", borderRadius: 999, backgroundColor: o + "30" }} />

      {/* Right spire body */}
      <View style={{ position: "absolute", right: "8%", top: 0, height: "72%", width: "7%", backgroundColor: "#0a1520", borderTopLeftRadius: 999, borderTopRightRadius: 999 }} />
      {/* Right spire tip */}
      <View style={{ position: "absolute", right: "10%", top: "-6%", width: "3%", height: "15%", backgroundColor: "#0a1520", borderTopLeftRadius: 999, borderTopRightRadius: 999 }} />
      {/* Right spire window slit */}
      <View style={{ position: "absolute", right: "10.5%", top: "25%", width: "2%", height: "12%", borderRadius: 999, backgroundColor: o + "30" }} />

      {/* Cloud layers — wide flat ovals at staggered heights */}
      <View style={{ position: "absolute", top: "8%",  left: "-8%", right: "-8%", height: 22, borderRadius: 999, backgroundColor: o + "16" }} />
      <View style={{ position: "absolute", top: "19%", left: "5%",  right: "5%",  height: 16, borderRadius: 999, backgroundColor: o + "12" }} />
      <View style={{ position: "absolute", top: "30%", left: "-5%", right: "-5%", height: 14, borderRadius: 999, backgroundColor: o + "0E" }} />
      <View style={{ position: "absolute", top: "43%", left: "10%", right: "10%", height: 12, borderRadius: 999, backgroundColor: o + "09" }} />

      {/* Floor mist */}
      <LinearGradient colors={[o + "00", o + "20"]} locations={[0, 1]}
        style={{ position: "absolute", bottom: "34%", left: 0, right: 0, height: "10%" }} />
    </>
  );
}

/** Immune Forge — Volcanic Cavern. Dark jagged rocks, lava vent glow, embers. */
function ImmuneForgeScene({ o, a }: SceneProps) {
  const ROCK = "#120604";
  return (
    <>
      {/* Rock mass — bottom-left */}
      <View style={{ position: "absolute", bottom: "28%", left: "-5%", width: "35%", height: "40%", borderRadius: 30, backgroundColor: ROCK }} />
      <View style={{ position: "absolute", bottom: "38%", left: "0%",  width: "22%", height: "30%", borderRadius: 20, backgroundColor: ROCK }} />
      <View style={{ position: "absolute", bottom: "48%", left: "5%",  width: "12%", height: "20%", borderRadius: 15, backgroundColor: ROCK }} />

      {/* Rock mass — bottom-right */}
      <View style={{ position: "absolute", bottom: "28%", right: "-5%", width: "35%", height: "40%", borderRadius: 30, backgroundColor: ROCK }} />
      <View style={{ position: "absolute", bottom: "38%", right: "0%",  width: "22%", height: "30%", borderRadius: 20, backgroundColor: ROCK }} />
      <View style={{ position: "absolute", bottom: "48%", right: "5%",  width: "12%", height: "20%", borderRadius: 15, backgroundColor: ROCK }} />

      {/* Central forge vent — lava glow from floor gap */}
      <View style={{ position: "absolute", bottom: "30%", left: "30%", right: "30%", height: "8%", borderRadius: 999, backgroundColor: o + "50" }} />
      <LinearGradient colors={[o + "00", o + "35"]} locations={[0, 1]}
        style={{ position: "absolute", bottom: "32%", left: "25%", right: "25%", height: "25%" }} />

      {/* Ember sparks — fixed dot positions */}
      {[
        { t: "12%", l: "22%" }, { t: "8%",  l: "55%" }, { t: "18%", l: "70%" },
        { t: "6%",  l: "38%" }, { t: "22%", l: "82%" }, { t: "15%", l: "15%" },
        { t: "28%", r: "18%" }, { t: "10%", r: "35%" },
      ].map((p, i) => (
        <View key={i} style={{
          position: "absolute", top: p.t as any,
          left: (p as any).l as any, right: (p as any).r as any,
          width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
          borderRadius: 2, backgroundColor: o + "BB",
        }} />
      ))}

      {/* Heat haze band */}
      <LinearGradient colors={[o + "00", o + "0C", o + "00"]} locations={[0, 0.5, 1]}
        style={{ position: "absolute", top: "25%", left: 0, right: 0, height: "18%" }} />
    </>
  );
}

/** Neural Chamber — Synaptic Void. Floating neuron orbs, connection threads. */
function NeuralChamberScene({ o, a }: SceneProps) {
  const orbs = [
    { t: "8%",  l: "20%", s: 52, op: "20" },
    { t: "5%",  r: "15%", s: 36, op: "18" },
    { t: "28%", l: "8%",  s: 28, op: "15" },
    { t: "35%", r: "8%",  s: 40, op: "18" },
    { t: "18%", l: "42%", s: 20, op: "22" },
    { t: "48%", l: "25%", s: 16, op: "14" },
    { t: "42%", r: "20%", s: 22, op: "16" },
  ];
  return (
    <>
      {/* Neuron cell bodies */}
      {orbs.map((orb, i) => (
        <View key={i} style={{
          position: "absolute",
          top: orb.t as any, left: (orb as any).l as any, right: (orb as any).r as any,
          width: orb.s, height: orb.s,
          borderRadius: orb.s / 2,
          backgroundColor: o + orb.op,
          borderWidth: 1,
          borderColor: o + "30",
        }} />
      ))}

      {/* Axon threads (thin connection lines) */}
      <View style={{ position: "absolute", top: "14%",  left: "20%", right: "35%", height: 1, backgroundColor: o + "25" }} />
      <View style={{ position: "absolute", top: "22%",  left: "12%", right: "10%", height: 1, backgroundColor: o + "18" }} />
      <View style={{ position: "absolute", top: "32%",  left: "25%", right: "20%", height: 1, backgroundColor: o + "20" }} />
      <View style={{ position: "absolute", top: "40%",  left: "15%", right: "28%", height: 1, backgroundColor: o + "15" }} />

      {/* Central synaptic glow (behind hero) */}
      <View style={[sc.archOuter, { backgroundColor: o + "10", top: "15%" }]} />

      {/* Void depth rings */}
      <View style={{ position: "absolute", alignSelf: "center", top: "10%", width: "70%", aspectRatio: 1, borderRadius: 999, borderWidth: 1, borderColor: o + "15" }} />
      <View style={{ position: "absolute", alignSelf: "center", top: "5%",  width: "85%", aspectRatio: 1, borderRadius: 999, borderWidth: 1, borderColor: o + "08" }} />
    </>
  );
}

/** Default — Ancient Healing Hall. Simple stone pillars + ambient glow window. */
function DefaultHallScene({ o, a }: SceneProps) {
  const COL = "#0a0904";
  return (
    <>
      <View style={[sc.col, { left: 0,  width: "16%", backgroundColor: COL }]} />
      <View style={[sc.col, { right: 0, width: "16%", backgroundColor: COL }]} />
      <View style={{ position: "absolute", left: "16%",  top: 0, bottom: 0, width: 1, backgroundColor: o + "28" }} />
      <View style={{ position: "absolute", right: "16%", top: 0, bottom: 0, width: 1, backgroundColor: o + "28" }} />
      <View style={[sc.archOuter, { backgroundColor: o + "12" }]} />
      <View style={[sc.archInner, { backgroundColor: o + "08" }]} />
      <LinearGradient colors={[o + "14", o + "00"]} locations={[0, 1]}
        style={[sc.beam, { top: "6%", left: "16%", right: "16%", height: "20%" }]} />
    </>
  );
}

/** Wrapper — renders the correct scene + shared floor/shadow/vignette layers */
function SceneBg({
  element, scene, floorOpacity,
}: {
  element: string;
  scene: { sky: readonly [string,string,string]; mid: string; accent: string; orb1: string; orb2: string };
  floorOpacity: Animated.AnimatedInterpolation<number>;
}) {
  const o = scene.orb1;
  const a = scene.accent;
  return (
    <>
      {/* 1 — Sky */}
      <LinearGradient colors={scene.sky} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFillObject} />

      {/* 2 — Element-specific room scene */}
      {element === "River"                                    && <CardiacWardScene o={o} a={a} />}
      {element === "Air"                                      && <RespiratorySpireScene o={o} a={a} />}
      {element === "Fire"                                     && <ImmuneForgeScene o={o} a={a} />}
      {element === "Mind"                                     && <NeuralChamberScene o={o} a={a} />}
      {!["River","Air","Fire","Mind"].includes(element)       && <DefaultHallScene o={o} a={a} />}

      {/* 3 — Floor gradient wash */}
      <LinearGradient colors={[scene.mid + "00", scene.mid + "F0"]} locations={[0, 1]}
        style={sc.floor} />

      {/* 4 — Horizon line */}
      <View style={[sc.horizon, { backgroundColor: a + "50" }]} />

      {/* 5 — Stage glow (animated breathing) */}
      <Animated.View style={[sc.stage, { backgroundColor: a, opacity: floorOpacity }]} />

      {/* 6 — Edge depth shadows (left + right) */}
      <LinearGradient colors={["rgba(4,6,10,0.82)", "rgba(4,6,10,0.0)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sc.edgeLeft} />
      <LinearGradient colors={["rgba(4,6,10,0.0)", "rgba(4,6,10,0.82)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={sc.edgeRight} />

      {/* 7 — Top vignette */}
      <LinearGradient colors={["rgba(4,6,10,0.85)", "rgba(4,6,10,0.0)"]} style={sc.topVignette} />
    </>
  );
}

/** Shared shape styles for scene components */
const sc = StyleSheet.create({
  col: {
    position: "absolute",
    top: 0, bottom: 0,
    backgroundColor: "#030d18",
  },
  archOuter: {
    position: "absolute",
    alignSelf: "center",
    top: "2%",
    width: "52%",
    aspectRatio: 0.7,
    borderRadius: 999,
  },
  archInner: {
    position: "absolute",
    alignSelf: "center",
    top: "10%",
    width: "38%",
    aspectRatio: 0.75,
    borderRadius: 999,
  },
  beam: {
    position: "absolute",
  },
  floor: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: "40%",
  },
  horizon: {
    position: "absolute",
    bottom: "40%",
    left: 0, right: 0,
    height: 1,
  },
  stage: {
    position: "absolute",
    bottom: "-10%",
    left: "22%", right: "22%",
    height: "24%",
    borderRadius: 999,
  },
  edgeLeft: {
    position: "absolute",
    top: 0, bottom: 0, left: 0,
    width: "22%",
  },
  edgeRight: {
    position: "absolute",
    top: 0, bottom: 0, right: 0,
    width: "22%",
  },
  topVignette: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: "25%",
  },
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
  arena: { flex: 1, flexDirection: "row", alignItems: "stretch" },

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

  /* Hero center */
  heroCenter: {
    flex: 1,
    overflow: "hidden",
    borderRadius: RADIUS.lg,
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
