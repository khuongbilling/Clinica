import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated, Image, Modal, Pressable, StyleSheet, Text,
  View,
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
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Capture stage pixel dimensions so RN Web can size the image correctly
  const [stageDims, setStageDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    AsyncStorage.getItem(INTRO_KEY).then((val) => {
      if (!val) setShowIntro(true);
    });
  }, []);

  useEffect(() => {
    // Slow element glow breathe
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2800, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2800, useNativeDriver: false }),
      ])
    ).start();
    // Subtle tap-hint pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
        Animated.delay(1400),
      ])
    ).start();
  }, []);

  const dismissIntro = async () => {
    await AsyncStorage.setItem(INTRO_KEY, "1");
    setShowIntro(false);
  };

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.42] });

  if (!player || loading) {
    return <View style={{ flex: 1, backgroundColor: COLORS.surface }} />;
  }

  const apt       = APTITUDE_INFO[player.aptitude];
  const nextRank  = RANKS[player.rank_index + 1];
  const progress  = nextRank
    ? Math.min(1, (player.xp - RANKS[player.rank_index].xpRequired) /
                  (nextRank.xpRequired - RANKS[player.rank_index].xpRequired))
    : 1;

  const leadHeroId   = player.active_team?.[0] ?? "novice_guardian";
  const leadHero     = HEROES.find((h) => h.id === leadHeroId);
  const heroSprite   = getHeroSprite(leadHeroId);
  const elementColor = ELEMENT_COLORS[leadHero?.element ?? "River"] ?? COLORS.river;
  const bossUnlocked = (player.bosses_defeated?.length ?? 0) > 0 || player.runs_completed >= 1;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>

      {/* ── COMPACT HEADER ── */}
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

      {/* ── HERO STAGE (flex:1 — fills all remaining space above the button) ── */}
      <Pressable
        style={styles.heroStage}
        onPress={() => router.push("/hero-select")}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) setStageDims({ w: width, h: height });
        }}
        testID="home-portrait-tap"
      >
        {/* Dark stage background */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: COLORS.surfaceSecondary + "CC" }]} />

        {/* Top-to-mid dark gradient (header bleed protection) */}
        <LinearGradient
          colors={["rgba(12,14,18,0.75)", "rgba(12,14,18,0.0)"]}
          locations={[0, 0.28]}
          style={[StyleSheet.absoluteFillObject, { zIndex: 1 }]}
        />

        {/* Bottom dark gradient (into info overlay) */}
        <LinearGradient
          colors={["rgba(12,14,18,0.0)", "rgba(12,14,18,0.72)", "rgba(12,14,18,0.97)"]}
          locations={[0.45, 0.78, 1]}
          style={[StyleSheet.absoluteFillObject, { zIndex: 1 }]}
        />

        {/* Element glow radial — bottom-center */}
        <Animated.View
          style={[
            styles.elementGlow,
            { backgroundColor: elementColor, opacity: glowOpacity },
          ]}
        />

        {/* ── HERO PORTRAIT — explicitly pixel-sized so RN Web centers correctly ── */}
        {heroSprite && stageDims.h > 0 ? (
          <Image
            source={heroSprite}
            style={{
              position: "absolute",
              width:  stageDims.w,
              height: stageDims.h,
              // shift up slightly so feet don't hide behind info overlay
              top: -stageDims.h * 0.04,
            }}
            resizeMode="contain"
          />
        ) : (
          <View style={StyleSheet.absoluteFillObject} />
        )}

        {/* ── FLOATING ICONS — absolutely inside stage ── */}
        {/* Events — top-left */}
        <View style={[styles.floatPos, styles.floatTL]}>
          <FloatIcon
            icon="calendar-outline"
            label="Events"
            color={COLORS.air}
            locked
            lockText="Soon"
            onPress={() => {}}
          />
        </View>

        {/* Boss — top-right */}
        <View style={[styles.floatPos, styles.floatTR]}>
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

        {/* Daily — mid-left */}
        <View style={[styles.floatPos, styles.floatML]}>
          <FloatIcon
            icon="shield-checkmark-outline"
            label="Daily"
            color={COLORS.mind}
            locked
            lockText="Soon"
            onPress={() => {}}
          />
        </View>

        {/* Summon — mid-right */}
        <View style={[styles.floatPos, styles.floatMR]}>
          <FloatIcon
            icon="sparkles"
            label="Summon"
            color={COLORS.brand}
            onPress={() => router.push("/summon")}
            testID="home-float-summon"
          />
        </View>

        {/* ── HERO INFO OVERLAY — pinned to bottom of stage ── */}
        <View style={[styles.heroInfoOverlay, { zIndex: 2 }]}>
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
          {/* Subtle tap hint — pulsing dot + tiny text, no color pop */}
          <Animated.View style={[styles.tapHint, { opacity: pulseAnim }]}>
            <View style={[styles.tapDot, { backgroundColor: elementColor + "90" }]} />
            <Text style={styles.tapHintTxt}>tap portrait to change hero</Text>
          </Animated.View>
        </View>
      </Pressable>

      {/* ── PRIMARY ACTION BUTTON ── */}
      <Pressable
        style={[styles.startBtn, { borderColor: COLORS.brand + "50" }]}
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
                { name: "Air",   desc: "Lungs",  color: COLORS.air   },
                { name: "River", desc: "Heart",  color: COLORS.river },
                { name: "Fire",  desc: "Immune", color: COLORS.fire  },
                { name: "Mind",  desc: "Neuro",  color: COLORS.mind  },
                { name: "Stone", desc: "Bone",   color: COLORS.forge },
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

/* ── FloatIcon component ─────────────────────────────────────────── */
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
      hitSlop={8}
    >
      <View style={[
        styles.floatCircle,
        {
          borderColor: locked ? COLORS.border : color + "70",
          backgroundColor: locked ? "rgba(255,255,255,0.06)" : color + "20",
        },
      ]}>
        <Ionicons name={icon as any} size={20} color={locked ? COLORS.onSurfaceTertiary : color} />
      </View>
      <Text style={[styles.floatLabel, { color: locked ? COLORS.onSurfaceTertiary : color }]}>
        {label}
      </Text>
      {locked && lockText && (
        <Text style={styles.floatLockTxt}>{lockText}</Text>
      )}
    </Pressable>
  );
}

/* ── Styles ──────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  rankKicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  playerName:  { color: COLORS.onSurface, fontSize: 20, fontWeight: "300" },
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

  /* Hero stage */
  heroStage: {
    flex: 1,
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  elementGlow: {
    position: "absolute",
    bottom: "5%",
    left: "-30%",
    right: "-30%",
    height: "28%",
    borderRadius: 999,
    zIndex: 0,
  },

  /* Floating icon positions */
  floatPos: { position: "absolute", zIndex: 10 },
  floatTL:  { top: SPACING.lg,  left: SPACING.md  },
  floatTR:  { top: SPACING.lg,  right: SPACING.md },
  floatML:  { top: "42%",       left: SPACING.md  },
  floatMR:  { top: "42%",       right: SPACING.md },
  floatBtn: { alignItems: "center", gap: 3 },
  floatBtnLocked: { opacity: 0.55 },
  floatCircle: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
    // frosted look
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  floatLabel:   { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  floatLockTxt: { color: COLORS.onSurfaceTertiary, fontSize: 9 },

  /* Hero info overlay */
  heroInfoOverlay: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: 3,
  },
  elementChip: {
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: "flex-start",
    marginBottom: 2,
  },
  elementChipTxt: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  heroName:  { color: COLORS.onSurface,          fontSize: 18, fontWeight: "700", letterSpacing: 0.3 },
  heroTitle: { color: COLORS.onSurfaceSecondary,  fontSize: 12, letterSpacing: 0.3 },
  xpRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xs, marginTop: 4 },
  xpBg:  { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  xpFill: { height: "100%", borderRadius: 2 },
  xpTxt: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.8, minWidth: 70, textAlign: "right" },

  /* Tap hint */
  tapHint: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  tapDot:  { width: 5, height: 5, borderRadius: 3 },
  tapHintTxt: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.8 },

  /* Start button */
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.brand,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
    borderWidth: 1,
  },
  startBtnTxt: { color: COLORS.onBrand, fontSize: 14, fontWeight: "700", letterSpacing: 2 },

  /* Intro modal */
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
  introTitle:  { color: COLORS.onSurface, fontSize: 28, fontWeight: "300", marginTop: -4 },
  introBody:   { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 22 },
  introSystemRow: { flexDirection: "row", gap: SPACING.xs, flexWrap: "wrap" },
  introSysPill:   { alignItems: "center", gap: 3, minWidth: 46 },
  introSysDot:    { width: 8, height: 8, borderRadius: 4 },
  introSysName:   { fontSize: 11, fontWeight: "700" },
  introSysDesc:   { color: COLORS.onSurfaceTertiary, fontSize: 9 },
  introCta: {
    backgroundColor: COLORS.brand, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, alignItems: "center", marginTop: SPACING.sm,
  },
  introCtaTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
});
