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

      {/* ── MAIN ARENA — side buttons + centered character ── */}
      <View style={styles.arena}>

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

        {/* CENTER — scenic background + hero portrait */}
        <Pressable
          style={styles.heroCenter}
          onPress={() => router.push("/hero-select")}
          testID="home-portrait-tap"
        >
          {/* ── Sky gradient ── */}
          <LinearGradient
            colors={scene.sky}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* ── Back-wall mid-tone band ── */}
          <LinearGradient
            colors={[scene.mid + "00", scene.mid + "CC", scene.mid + "00"]}
            locations={[0, 0.5, 1]}
            style={styles.bgMidBand}
          />

          {/* ── Large background orb — upper-left ── */}
          <View
            style={[
              styles.bgOrb,
              {
                width: 180, height: 180,
                top: "-15%", left: "-20%",
                backgroundColor: scene.orb1 + "28",
                borderRadius: 90,
              },
            ]}
          />
          {/* ── Large background orb — lower-right ── */}
          <View
            style={[
              styles.bgOrb,
              {
                width: 160, height: 160,
                bottom: "5%", right: "-18%",
                backgroundColor: scene.orb2 + "22",
                borderRadius: 80,
              },
            ]}
          />
          {/* ── Small accent orb — upper-right ── */}
          <View
            style={[
              styles.bgOrb,
              {
                width: 80, height: 80,
                top: "10%", right: "8%",
                backgroundColor: scene.orb1 + "30",
                borderRadius: 40,
              },
            ]}
          />

          {/* ── Horizontal horizon line ── */}
          <View style={[styles.horizonLine, { backgroundColor: scene.accent + "50" }]} />

          {/* ── Glowing floor ellipse (stage) ── */}
          <Animated.View
            style={[
              styles.floorEllipse,
              { backgroundColor: scene.accent, opacity: floorOpacity },
            ]}
          />

          {/* ── Floor surface gradient ── */}
          <LinearGradient
            colors={[scene.accent + "00", scene.accent + "35"]}
            locations={[0, 1]}
            style={styles.floorSurface}
          />

          {/* ── HERO IMAGE (sits above background layers) ── */}
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

          {/* Top vignette so header reads cleanly */}
          <LinearGradient
            colors={["rgba(8,10,14,0.7)", "rgba(8,10,14,0.0)"]}
            locations={[0, 1]}
            style={[StyleSheet.absoluteFillObject, { height: "30%", pointerEvents: "none" } as any]}
          />

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

  /* Background scene layers */
  bgMidBand: {
    position: "absolute",
    top: "20%", bottom: "20%",
    left: 0, right: 0,
  },
  bgOrb: {
    position: "absolute",
  },
  horizonLine: {
    position: "absolute",
    bottom: "28%",
    left: "5%", right: "5%",
    height: 1,
  },
  floorEllipse: {
    position: "absolute",
    bottom: "-14%",
    left: "-30%", right: "-30%",
    height: "42%",
    borderRadius: 999,
    opacity: 0.45,
  },
  floorSurface: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: "30%",
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
