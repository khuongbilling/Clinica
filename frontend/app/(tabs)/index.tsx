import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated, Image, Modal, Pressable, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APTITUDE_INFO, ENEMIES, HEROES, RANKS } from "@/src/game/content";
import { getHeroSprite } from "@/src/components/HeroSprites";
import { usePlayer } from "@/src/game/store";
import { useTestSession } from "@/src/game/testSession";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const INTRO_KEY = "clinica.intro.seen";

export default function RunHome() {
  const router = useRouter();
  const { player, loading } = usePlayer();
  const { logEvent } = useTestSession();
  const insets = useSafeAreaInsets();

  const [showIntro, setShowIntro] = useState(false);
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(INTRO_KEY).then((val) => {
      if (!val) setShowIntro(true);
    });
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2600, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2600, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const dismissIntro = async () => {
    await AsyncStorage.setItem(INTRO_KEY, "1");
    setShowIntro(false);
  };

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.38] });

  if (!player) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.surface }} />
    );
  }

  const apt = APTITUDE_INFO[player.aptitude];
  const nextRank = RANKS[player.rank_index + 1];
  const progress = nextRank
    ? Math.min(1, (player.xp - RANKS[player.rank_index].xpRequired) / (nextRank.xpRequired - RANKS[player.rank_index].xpRequired))
    : 1;

  const leadHeroId = player.active_team?.[0] ?? "novice_guardian";
  const leadHero = HEROES.find((h) => h.id === leadHeroId);
  const heroSprite = getHeroSprite(leadHeroId);
  const elementColor = ELEMENT_COLORS[leadHero?.element ?? "River"] ?? COLORS.river;

  const bossUnlocked = (player.bosses_defeated?.length ?? 0) > 0 || player.runs_completed >= 1;
  const bossColor = bossUnlocked ? COLORS.error : COLORS.onSurfaceTertiary;

  const launchRandom = () => {
    const pool = ENEMIES.filter((e) => e.difficulty <= 3);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    logEvent("random_encounter_started", "home", { meta: { enemyId: pick.id } });
    router.push({ pathname: "/battle", params: { enemyId: pick.id } });
  };

  return (
    <View style={styles.root}>

      {/* ── PORTRAIT SECTION (~75% of screen) ── */}
      <Pressable
        style={styles.portraitSection}
        onPress={() => router.push("/hero-select")}
        testID="home-portrait-tap"
      >
        {/* Hero portrait — contain shows the full body; dark bg ensures contrast */}
        {heroSprite ? (
          <Image source={heroSprite} style={styles.portrait} resizeMode="contain" />
        ) : (
          <View style={[styles.portrait, styles.portraitFallback]} />
        )}

        {/* Gradient: slight top fade (for top-bar readability) + strong bottom fade */}
        <LinearGradient
          colors={[
            "rgba(12,14,18,0.55)",
            "rgba(12,14,18,0.0)",
            "rgba(12,14,18,0.0)",
            "rgba(12,14,18,0.60)",
            "rgba(12,14,18,1.0)",
          ]}
          locations={[0, 0.18, 0.55, 0.78, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Bottom-edge element glow — sits at feet level, pulses softly */}
        <Animated.View
          style={[
            styles.elementGlow,
            { backgroundColor: elementColor, opacity: glowOpacity },
          ]}
        />

        {/* ── TOP BAR ── */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top + SPACING.md, 52) }]}>
          <View>
            <Text style={styles.rankKicker}>{RANKS[player.rank_index].name.toUpperCase()}</Text>
            <Text style={styles.playerName}>{player.name}</Text>
          </View>
          <View style={styles.topBarRight}>
            <Pressable
              style={styles.topIconBtn}
              onPress={() => router.push("/tutorial")}
              hitSlop={10}
              testID="run-tutorial-button"
            >
              <Ionicons name="help-circle-outline" size={22} color={COLORS.onSurfaceSecondary} />
            </Pressable>
            {apt && (
              <View style={[styles.aptBadge, { borderColor: apt.color + "60" }]}>
                <Ionicons name={apt.icon as any} size={18} color={apt.color} />
              </View>
            )}
          </View>
        </View>

        {/* ── PORTRAIT FOOTER: hero name + XP + change hint ── */}
        <View style={styles.portraitBottom}>
          <View style={[styles.elementChip, { borderColor: elementColor + "70", backgroundColor: elementColor + "18" }]}>
            <Text style={[styles.elementChipTxt, { color: elementColor }]}>{leadHero?.element ?? "River"}</Text>
          </View>
          <Text style={styles.heroName}>{leadHero?.name ?? "Your Hero"}</Text>
          <Text style={styles.heroTitle}>{leadHero?.title ?? apt?.title}</Text>
          <View style={styles.xpRow}>
            <View style={styles.xpBg}>
              <View style={[styles.xpFill, { width: `${progress * 100}%` as any, backgroundColor: elementColor }]} />
            </View>
            <Text style={styles.xpTxt}>
              {nextRank ? `${player.xp} / ${nextRank.xpRequired} XP` : "MAX RANK"}
            </Text>
          </View>
          <View style={styles.changeBadge}>
            <Ionicons name="swap-horizontal" size={11} color={elementColor + "99"} />
            <Text style={[styles.changeTxt, { color: elementColor + "99" }]}>TAP TO CHANGE HERO</Text>
          </View>
        </View>
      </Pressable>

      {/* ── NAV SECTION — two compact icon buttons ── */}
      <View style={[styles.navSection, { paddingBottom: insets.bottom + SPACING.lg }]}>

        {/* Subtle separator line */}
        <View style={[styles.navDivider, { backgroundColor: elementColor + "30" }]} />

        <View style={styles.iconRow}>

          {/* Shifting Ward — random encounter */}
          <Pressable style={styles.iconBtn} onPress={launchRandom} testID="run-random-encounter">
            <View style={[styles.iconCircle, { backgroundColor: COLORS.mind + "22", borderColor: COLORS.mind + "55" }]}>
              <Ionicons name="shuffle" size={26} color={COLORS.mind} />
            </View>
            <Text style={styles.iconLabel}>Shifting Ward</Text>
            <Text style={styles.iconSub}>Mystery encounter</Text>
          </Pressable>

          {/* Vertical rule */}
          <View style={styles.iconSep} />

          {/* Fading Core — boss */}
          <Pressable
            style={[styles.iconBtn, !bossUnlocked && styles.iconBtnLocked]}
            onPress={() => router.push("/boss")}
            testID="run-boss-card"
          >
            <View style={[
              styles.iconCircle,
              { backgroundColor: bossColor + "22", borderColor: bossColor + "55" },
            ]}>
              <Ionicons
                name={bossUnlocked ? "skull" : "lock-closed"}
                size={26}
                color={bossColor}
              />
            </View>
            <Text style={[styles.iconLabel, !bossUnlocked && styles.iconLabelLocked]}>
              Fading Core
            </Text>
            <Text style={styles.iconSub}>
              {bossUnlocked ? "Chapter I boss" : "1 run to unlock"}
            </Text>
          </Pressable>

        </View>
      </View>

      {/* ── ABOUT CLINICA — one-time intro popup ── */}
      <Modal visible={showIntro} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.introOverlay}>
          <View style={styles.introPanel}>
            <View style={styles.introHandle} />
            <Text style={styles.introKicker}>A KINGDOM SHAPED LIKE THE BODY</Text>
            <Text style={styles.introTitle}>Welcome to Clinica</Text>
            <Text style={styles.introBody}>
              Five great regions — Air, River, Fire, Mind, Stone — each a living body system. Disease corruption spreads through them all.{"\n\n"}
              Your healer team reads patient clues, keeps Stability above zero, and drives Corruption to zero.{"\n\n"}
              <Text style={{ color: COLORS.brand }}>Fight disease. Restore the body. Learn medicine through play.</Text>
            </Text>
            <View style={styles.introSystemRow}>
              {[
                { name: "Air", desc: "Lungs", color: COLORS.air },
                { name: "River", desc: "Heart", color: COLORS.river },
                { name: "Fire", desc: "Immune", color: COLORS.fire },
                { name: "Mind", desc: "Neuro", color: COLORS.mind },
                { name: "Stone", desc: "Bone", color: COLORS.forge },
              ].map((s) => (
                <View key={s.name} style={styles.introSysPill}>
                  <View style={[styles.introSysDot, { backgroundColor: s.color }]} />
                  <Text style={[styles.introSysName, { color: s.color }]}>{s.name}</Text>
                  <Text style={styles.introSysDesc}>{s.desc}</Text>
                </View>
              ))}
            </View>
            <Pressable style={styles.introCta} onPress={dismissIntro} testID="intro-dismiss">
              <Text style={styles.introCtaTxt}>BEGIN THE JOURNEY</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  /* ── PORTRAIT ── */
  portraitSection: { flex: 6, position: "relative", overflow: "hidden" },
  elementGlow: {
    position: "absolute",
    bottom: -40,
    left: "-30%",
    right: "-30%",
    height: "30%",
    borderRadius: 999,
    transform: [{ scaleX: 1.8 }],
  },
  portrait: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
  },
  portraitFallback: { backgroundColor: COLORS.surfaceSecondary },

  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingHorizontal: SPACING.lg,
  },
  rankKicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  playerName: { color: COLORS.onSurface, fontSize: 22, fontWeight: "300", marginTop: 2 },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  topIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(12,14,18,0.6)",
    alignItems: "center", justifyContent: "center",
  },
  aptBadge: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(12,14,18,0.6)",
  },

  portraitBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl, gap: 5,
  },
  elementChip: {
    alignSelf: "flex-start",
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 3,
    marginBottom: 2,
  },
  elementChipTxt: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  heroName: { color: COLORS.onSurface, fontSize: 24, fontWeight: "500" },
  heroTitle: { color: COLORS.onSurfaceSecondary, fontSize: 12, letterSpacing: 0.5 },
  changeBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  changeTxt: { fontSize: 9, letterSpacing: 1.5, fontWeight: "600" },
  xpRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: 4 },
  xpBg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  xpFill: { height: "100%" },
  xpTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, minWidth: 70, textAlign: "right" },

  /* ── NAV ── */
  navSection: {
    flex: 3,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    justifyContent: "flex-start",
    gap: SPACING.md,
  },
  navDivider: { height: 1, borderRadius: 1, marginBottom: SPACING.xs },
  iconRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 0,
  },
  iconBtn: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: SPACING.sm,
  },
  iconBtnLocked: { opacity: 0.55 },
  iconCircle: {
    width: 64, height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  iconLabel: {
    color: COLORS.onSurface,
    fontSize: 13, fontWeight: "600",
    textAlign: "center",
  },
  iconLabelLocked: { color: COLORS.onSurfaceTertiary },
  iconSub: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 15,
  },
  iconSep: {
    width: 1,
    height: 60,
    backgroundColor: COLORS.border,
    marginTop: SPACING.sm,
    alignSelf: "center",
  },

  /* ── INTRO MODAL ── */
  introOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" },
  introPanel: {
    backgroundColor: COLORS.surfaceSecondary,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
    borderTopWidth: 1, borderColor: COLORS.brand + "40",
    gap: SPACING.md,
  },
  introHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: SPACING.sm },
  introKicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  introTitle: { color: COLORS.onSurface, fontSize: 28, fontWeight: "300", marginTop: -4 },
  introBody: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 22 },
  introSystemRow: { flexDirection: "row", gap: SPACING.xs, flexWrap: "wrap" },
  introSysPill: { alignItems: "center", gap: 3, minWidth: 46 },
  introSysDot: { width: 8, height: 8, borderRadius: 4 },
  introSysName: { fontSize: 11, fontWeight: "700" },
  introSysDesc: { color: COLORS.onSurfaceTertiary, fontSize: 9 },
  introCta: {
    backgroundColor: COLORS.brand, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, alignItems: "center", marginTop: SPACING.sm,
  },
  introCtaTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
});
