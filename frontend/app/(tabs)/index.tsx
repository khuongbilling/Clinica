import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated, Image, Modal, Pressable, StyleSheet, Text,
  useWindowDimensions, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APTITUDE_INFO, HEROES, RANKS } from "@/src/game/content";
import { getHeroSprite } from "@/src/components/HeroSprites";
import { usePlayer } from "@/src/game/store";
import { useTestSession } from "@/src/game/testSession";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const INTRO_KEY = "clinica.intro.seen";

export default function RunHome() {
  const router = useRouter();
  const { player, loading } = usePlayer();
  const { logEvent } = useTestSession();
  const [showIntro, setShowIntro] = useState(false);
  const glowAnim = useRef(new Animated.Value(0)).current;
  const { height: screenH } = useWindowDimensions();

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

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.44] });

  if (!player || loading) {
    return <View style={{ flex: 1, backgroundColor: COLORS.surface }} />;
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

  // Responsive portrait height: taller on larger screens
  const portraitH = screenH < 680 ? 200 : screenH < 780 ? 240 : screenH < 900 ? 278 : 310;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rankKicker}>{RANKS[player.rank_index].name.toUpperCase()}</Text>
          <Text style={styles.playerName}>{player.name}</Text>
        </View>
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

      {/* ── TOP ICON ROW: Events | Boss ── */}
      <View style={styles.iconRowOuter}>
        <FloatIcon
          icon="calendar-outline"
          label="Events"
          color={COLORS.air}
          locked
          lockText="Soon"
          onPress={() => {}}
        />
        <FloatIcon
          icon={bossUnlocked ? "skull" : "lock-closed"}
          label="Boss"
          color={COLORS.error}
          locked={!bossUnlocked}
          lockText="1 run"
          onPress={() => { if (bossUnlocked) router.push("/boss"); }}
          testID="home-float-boss"
        />
      </View>

      {/* ── PORTRAIT FRAME ── */}
      <Pressable
        style={[styles.portraitFrame, { height: portraitH, borderColor: elementColor + "40" }]}
        onPress={() => router.push("/hero-select")}
        testID="home-portrait-tap"
      >
        {/* Dark background */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: COLORS.surfaceSecondary }]} />

        {/* Subtle gradient: darker at top and bottom edges */}
        <LinearGradient
          colors={["rgba(12,14,18,0.6)", "rgba(12,14,18,0.0)", "rgba(12,14,18,0.55)"]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Element glow — bottom */}
        <Animated.View
          style={[
            styles.elementGlow,
            { backgroundColor: elementColor, opacity: glowOpacity },
          ]}
        />

        {/* Full-body hero — centered, contain, fills frame */}
        {heroSprite ? (
          <Image
            source={heroSprite}
            style={styles.heroImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.heroFallback} />
        )}

        {/* Tap hint */}
        <View style={styles.changeBadge}>
          <Ionicons name="swap-horizontal" size={11} color={elementColor + "AA"} />
          <Text style={[styles.changeTxt, { color: elementColor + "AA" }]}>TAP TO CHANGE HERO</Text>
        </View>
      </Pressable>

      {/* ── BOTTOM ICON ROW: Daily | Summon ── */}
      <View style={styles.iconRowOuter}>
        <FloatIcon
          icon="shield-checkmark-outline"
          label="Daily"
          color={COLORS.mind}
          locked
          lockText="Soon"
          onPress={() => {}}
        />
        <FloatIcon
          icon="sparkles"
          label="Summon"
          color={COLORS.brand}
          onPress={() => router.push("/summon")}
          testID="home-float-summon"
        />
      </View>

      {/* ── HERO INFO CARD ── */}
      <Pressable
        style={[styles.heroCard, { borderColor: elementColor + "30" }]}
        onPress={() => router.push("/hero-select")}
      >
        <View style={[styles.elementChip, { borderColor: elementColor + "70", backgroundColor: elementColor + "18" }]}>
          <Text style={[styles.elementChipTxt, { color: elementColor }]}>{leadHero?.element ?? "River"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroName}>{leadHero?.name ?? "Your Hero"}</Text>
          <Text style={styles.heroTitle}>{leadHero?.title ?? apt?.title}</Text>
          <View style={styles.xpRow}>
            <View style={styles.xpBg}>
              <View style={[styles.xpFill, { width: `${progress * 100}%` as any, backgroundColor: elementColor }]} />
            </View>
            <Text style={styles.xpTxt}>
              {nextRank ? `${player.xp}/${nextRank.xpRequired}` : "MAX"}
            </Text>
          </View>
        </View>
      </Pressable>

      {/* ── PRIMARY ACTION ── */}
      <Pressable
        style={styles.startBtn}
        onPress={() => { logEvent("shifting_ward_opened", "home", {}); router.push("/shift"); }}
        testID="run-random-encounter"
      >
        <Ionicons name="medical" size={18} color={COLORS.onBrand} />
        <Text style={styles.startBtnTxt}>START SHIFT</Text>
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
    </SafeAreaView>
  );
}

function FloatIcon({
  icon, label, color, locked, lockText, onPress, testID,
}: {
  icon: string; label: string; color: string;
  locked?: boolean; lockText?: string;
  onPress: () => void; testID?: string;
}) {
  return (
    <Pressable
      style={[styles.floatBtn, locked && styles.floatBtnLocked]}
      onPress={onPress}
      testID={testID}
      hitSlop={6}
    >
      <View style={[
        styles.floatCircle,
        { borderColor: locked ? COLORS.border : color + "70", backgroundColor: locked ? COLORS.surfaceTertiary : color + "18" },
      ]}>
        <Ionicons name={icon as any} size={20} color={locked ? COLORS.onSurfaceTertiary : color} />
      </View>
      <Text style={[styles.floatLabel, { color: locked ? COLORS.onSurfaceTertiary : color }]}>{label}</Text>
      {locked && lockText && <Text style={styles.floatLockTxt}>{lockText}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  /* ── HEADER ── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs ?? 4,
  },
  rankKicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  playerName: { color: COLORS.onSurface, fontSize: 20, fontWeight: "300" },
  topIconBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.border,
  },
  aptBadge: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surfaceSecondary,
  },

  /* ── ICON ROWS (above & below portrait) ── */
  iconRowOuter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xs ?? 4,
  },
  floatBtn: { alignItems: "center", gap: 3 },
  floatBtnLocked: { opacity: 0.6 },
  floatCircle: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  floatLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  floatLockTxt: { color: COLORS.onSurfaceTertiary, fontSize: 9 },

  /* ── PORTRAIT FRAME ── */
  portraitFrame: {
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroFallback: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.surfaceSecondary,
  },
  elementGlow: {
    position: "absolute",
    bottom: -30,
    left: "-20%",
    right: "-20%",
    height: "35%",
    borderRadius: 999,
    transform: [{ scaleX: 1.6 }],
  },
  changeBadge: {
    position: "absolute",
    bottom: SPACING.sm,
    right: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(12,14,18,0.65)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  changeTxt: { fontSize: 8, letterSpacing: 1.2, fontWeight: "700" },

  /* ── HERO INFO CARD ── */
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
  },
  elementChip: {
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 5,
    alignItems: "center", justifyContent: "center",
  },
  elementChipTxt: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  heroName: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  heroTitle: { color: COLORS.onSurfaceSecondary, fontSize: 11, letterSpacing: 0.3, marginTop: 1 },
  xpRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xs ?? 4, marginTop: 5 },
  xpBg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: COLORS.border, overflow: "hidden" },
  xpFill: { height: "100%" },
  xpTxt: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.8, minWidth: 52, textAlign: "right" },

  /* ── START SHIFT BUTTON ── */
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.brand,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
  },
  startBtnTxt: { color: COLORS.onBrand, fontSize: 14, fontWeight: "700", letterSpacing: 2 },

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
  introSystemRow: { flexDirection: "row", gap: SPACING.xs ?? 4, flexWrap: "wrap" },
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
