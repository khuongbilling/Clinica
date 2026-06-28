import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Image, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { APTITUDE_INFO, BOSS_LORD_IMBALANCE, ENEMIES, HEROES, RANKS } from "@/src/game/content";
import { getHeroSprite } from "@/src/components/HeroSprites";
import { usePlayer } from "@/src/game/store";
import { useTestSession } from "@/src/game/testSession";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const INTRO_KEY = "clinica.intro.seen";

export default function RunHome() {
  const router = useRouter();
  const { player } = usePlayer();
  const { logEvent } = useTestSession();
  const insets = useSafeAreaInsets();

  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(INTRO_KEY).then((val) => {
      if (!val) setShowIntro(true);
    });
  }, []);

  const dismissIntro = async () => {
    await AsyncStorage.setItem(INTRO_KEY, "1");
    setShowIntro(false);
  };

  const dailyShift = useMemo(() => {
    if (!player) return [];
    const starters = ENEMIES.filter((e) => e.difficulty <= 2);
    const advanced = ENEMIES.filter((e) => e.difficulty >= 3);
    const seed = (player.runs_completed || 0) % 5;
    const seed2 = (seed + 2) % 5;
    return [
      starters[seed % starters.length],
      starters[(seed + 1) % starters.length],
      advanced[seed2 % advanced.length],
    ];
  }, [player]);

  if (!player) return null;

  const apt = APTITUDE_INFO[player.aptitude];
  const nextRank = RANKS[player.rank_index + 1];
  const progress = nextRank
    ? Math.min(1, (player.xp - RANKS[player.rank_index].xpRequired) / (nextRank.xpRequired - RANKS[player.rank_index].xpRequired))
    : 1;

  const leadHeroId = player.active_team?.[0] ?? "novice_guardian";
  const leadHero = HEROES.find((h) => h.id === leadHeroId);
  const heroSprite = getHeroSprite(leadHeroId);

  const bossUnlocked = (player.bosses_defeated?.length ?? 0) > 0 || player.runs_completed >= 1;
  const shiftsToday = dailyShift.length;

  const launchRandom = () => {
    const pool = ENEMIES.filter((e) => e.difficulty <= 3);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    logEvent("random_encounter_started", "home", { meta: { enemyId: pick.id } });
    router.push({ pathname: "/battle", params: { enemyId: pick.id } });
  };

  return (
    <View style={styles.root}>
      {/* ── PORTRAIT SECTION (top ~55%) — tappable to change lead ── */}
      <Pressable style={styles.portraitSection} onPress={() => router.push("/hero-select")} testID="home-portrait-tap">
        {heroSprite ? (
          <Image source={heroSprite} style={styles.portrait} resizeMode="cover" />
        ) : (
          <View style={[styles.portrait, styles.portraitFallback]} />
        )}

        <LinearGradient
          colors={[
            "rgba(12,14,18,0.55)",
            "rgba(12,14,18,0.0)",
            "rgba(12,14,18,0.0)",
            "rgba(12,14,18,0.80)",
            "rgba(12,14,18,1.0)",
          ]}
          locations={[0, 0.15, 0.5, 0.80, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + SPACING.sm }]}>
          <View>
            <Text style={styles.rankKicker}>{RANKS[player.rank_index].name.toUpperCase()}</Text>
            <Text style={styles.playerName}>{player.name}</Text>
          </View>
          <View style={styles.topBarRight}>
            <Pressable
              style={styles.iconBtn}
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

        {/* Bottom of portrait: hero label + XP */}
        <View style={styles.portraitBottom}>
          <Text style={styles.heroName}>{leadHero?.name ?? "Your Hero"}</Text>
          <Text style={styles.heroTitle}>{leadHero?.title ?? apt?.title}</Text>
          <View style={styles.xpRow}>
            <View style={styles.xpBg}>
              <View style={[styles.xpFill, { width: `${progress * 100}%` as any }]} />
            </View>
            <Text style={styles.xpTxt}>
              {nextRank ? `${player.xp} / ${nextRank.xpRequired} XP` : "MAX RANK"}
            </Text>
          </View>
          <View style={styles.changeBadge}>
            <Ionicons name="swap-horizontal" size={11} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.changeTxt}>TAP TO CHANGE HERO</Text>
          </View>
        </View>
      </Pressable>

      {/* ── NAV SECTION (bottom ~45%) ── */}
      <View style={[styles.navSection, { paddingBottom: insets.bottom + SPACING.md }]}>

        {/* Primary tile: Today's Shift */}
        <Pressable style={styles.primaryTile} onPress={() => router.push("/shift")} testID="run-daily-shift">
          <View style={[styles.primaryIconWrap, { borderColor: COLORS.brand + "40" }]}>
            <Ionicons name="flame" size={30} color={COLORS.brand} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.primaryKicker}>DAILY DUTY</Text>
            <Text style={styles.primaryTitle}>Today's Shift</Text>
            <Text style={styles.primarySub}>{shiftsToday} encounters · {player.runs_completed} runs completed</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.onSurfaceTertiary} />
        </Pressable>

        {/* Secondary row: Random + Boss */}
        <View style={styles.secondaryRow}>

          {/* Random encounter */}
          <Pressable style={styles.secTile} onPress={launchRandom} testID="run-random-encounter">
            <View style={[styles.secIconWrap, { backgroundColor: COLORS.mind + "18" }]}>
              <Ionicons name="shuffle" size={22} color={COLORS.mind} />
            </View>
            <Text style={styles.secTitle}>Shifting Ward</Text>
            <Text style={styles.secSub}>Mystery encounter</Text>
            <View style={[styles.secTag, { borderColor: COLORS.mind + "40" }]}>
              <Text style={[styles.secTagTxt, { color: COLORS.mind }]}>RANDOM</Text>
            </View>
          </Pressable>

          {/* Boss */}
          <Pressable
            style={[styles.secTile, !bossUnlocked && styles.secTileLocked]}
            onPress={() => router.push("/boss")}
            testID="run-boss-card"
          >
            <View style={[
              styles.secIconWrap,
              { backgroundColor: bossUnlocked ? COLORS.error + "18" : COLORS.surfaceTertiary }
            ]}>
              <Ionicons
                name={bossUnlocked ? "skull" : "lock-closed"}
                size={22}
                color={bossUnlocked ? COLORS.error : COLORS.onSurfaceTertiary}
              />
            </View>
            <Text style={[styles.secTitle, !bossUnlocked && styles.lockedText]}>
              Fading Core
            </Text>
            <Text style={styles.secSub}>
              {bossUnlocked ? "Chapter I boss" : "1 shift to unlock"}
            </Text>
            {bossUnlocked && (
              <View style={[styles.secTag, { borderColor: COLORS.error + "40" }]}>
                <Text style={[styles.secTagTxt, { color: COLORS.error }]}>BOSS</Text>
              </View>
            )}
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

  portraitSection: { flex: 6, position: "relative", overflow: "hidden" },
  portrait: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  portraitFallback: { backgroundColor: COLORS.surfaceSecondary },

  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingHorizontal: SPACING.lg,
  },
  rankKicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  playerName: { color: COLORS.onSurface, fontSize: 22, fontWeight: "300", marginTop: 2 },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(12,14,18,0.6)", alignItems: "center", justifyContent: "center" },
  aptBadge: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(12,14,18,0.6)" },

  portraitBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: 4,
  },
  heroName: { color: COLORS.onSurface, fontSize: 20, fontWeight: "500" },
  heroTitle: { color: COLORS.onSurfaceSecondary, fontSize: 12, letterSpacing: 0.5 },
  changeBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  changeTxt: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 1.5, fontWeight: "600" },
  xpRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: 4 },
  xpBg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  xpFill: { height: "100%", backgroundColor: COLORS.brand },
  xpTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, minWidth: 70, textAlign: "right" },

  navSection: { flex: 5, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.sm },

  primaryTile: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.brand + "30",
    borderLeftWidth: 3, borderLeftColor: COLORS.brand,
  },
  primaryIconWrap: { width: 52, height: 52, borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.brand + "14" },
  primaryKicker: { color: COLORS.brand, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  primaryTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: "500" },
  primarySub: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 1 },

  secondaryRow: { flexDirection: "row", gap: SPACING.sm, flex: 1 },

  secTile: {
    flex: 1, backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
    gap: 4, justifyContent: "flex-start",
  },
  secTileLocked: { opacity: 0.6 },
  secIconWrap: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  secTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "500" },
  lockedText: { color: COLORS.onSurfaceTertiary },
  secSub: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15 },
  secTag: { alignSelf: "flex-start", borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  secTagTxt: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },

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
