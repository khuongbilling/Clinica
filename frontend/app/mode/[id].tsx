import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StaminaPill } from "@/src/components/StaminaPill";
import { getBannerImage } from "@/src/components/ModeBanners";
import { InlineNotice, useInlineNotice } from "@/src/components/WebAlert";
import { usePlayer } from "@/src/game/store";
import { useWebBackToHub } from "@/src/hooks/useWebBackToHub";
import { findMode, MODE_STATUS_LABEL } from "@/src/game/modeHub";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ─────────────────────────────────────────────────────────────
// SHARED MODE INTRODUCTION PAGE  (Mode → Intro → Gameplay pattern)
// Every active mode on the Ward Operations hub routes here first. The intro
// shows only lore + a simple "How it works" briefing (deliberately NO in-depth
// units/enemies) and a single CTA into the actual gameplay screen (mode.route).
// This is the reusable template for all future game modes.
// ─────────────────────────────────────────────────────────────
export default function ModeIntroPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { player } = usePlayer();
  const { notice, flashNotice } = useInlineNotice();
  const mode = findMode(id);

  // Browser back mirrors the in-app arrow instead of popping stale gameplay screens.
  useWebBackToHub("/shift");

  if (!player) {
    return (
      <SafeAreaView style={[styles.root, styles.loading]} edges={["top", "bottom"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  if (!mode) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <Pressable style={styles.backBtn} onPress={() => router.replace("/shift")} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={styles.missing}>
          <Ionicons name="help-circle-outline" size={40} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.missingTxt}>This mode could not be found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const playerLevel = player.player_level ?? 1;
  const bossUnlocked = playerLevel >= 7;
  const locked = mode.id === "boss-ward" && !bossUnlocked;
  const playable = mode.status === "active" && !locked && !!mode.route;
  const art = getBannerImage(mode.imageKey);
  const howItWorks = mode.howItWorks ?? [mode.subtitle];

  const begin = () => {
    if (locked) {
      flashNotice("The Fading Core is Sealed — reach Player Level 7 to unlock this encounter.");
      return;
    }
    if (!playable || !mode.route) {
      flashNotice(`${mode.title} — Coming Soon. This mode is still in development.`);
      return;
    }
    router.push(mode.route as any);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero banner */}
        <View style={styles.hero}>
          {art ? (
            <ExpoImage source={art} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={[mode.accentColor + "66", mode.accentColor + "18", COLORS.surface]}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <LinearGradient
            colors={["rgba(8,10,14,0.35)", "rgba(8,10,14,0.15)", "rgba(8,10,14,0.96)"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroTop}>
            <Pressable style={styles.backBtn} onPress={() => router.replace("/shift")} hitSlop={10} testID="mode-intro-back">
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </Pressable>
            <StaminaPill player={player} />
          </View>
          <View style={styles.heroBody}>
            <View style={[styles.statusChip, { borderColor: mode.accentColor + "80", backgroundColor: mode.accentColor + "2A" }]}>
              <Ionicons name={mode.icon as any} size={12} color={mode.accentColor} />
              <Text style={[styles.statusChipTxt, { color: mode.accentColor }]}>
                {locked ? "LOCKED" : MODE_STATUS_LABEL[mode.status].toUpperCase()}
              </Text>
            </View>
            <Text style={styles.heroTitle}>{mode.title}</Text>
            <Text style={styles.heroSubtitle}>{mode.subtitle}</Text>
          </View>
        </View>

        {/* Lore */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BRIEFING</Text>
          <Text style={styles.lore}>{mode.lore ?? mode.subtitle}</Text>
        </View>

        {/* How it works — simple, no unit/enemy depth */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
          {howItWorks.map((line, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: mode.accentColor }]} />
              <Text style={styles.bulletTxt}>{line}</Text>
            </View>
          ))}
        </View>

        {/* Rewards */}
        {mode.rewardPreview && (
          <View style={styles.rewardCard}>
            <Ionicons name="gift-outline" size={16} color={COLORS.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rewardLabel}>REWARDS</Text>
              <Text style={styles.rewardTxt}>{mode.rewardPreview}</Text>
            </View>
          </View>
        )}

        {locked && mode.unlockRequirement && (
          <View style={styles.lockNote}>
            <Ionicons name="lock-closed" size={14} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.lockNoteTxt}>{mode.unlockRequirement}</Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaBar}>
        {notice && (
          <View style={{ marginBottom: SPACING.sm }}>
            <InlineNotice notice={notice} icon="lock-closed" testID="mode-intro-notice" />
          </View>
        )}
        <Pressable
          style={[styles.cta, { backgroundColor: playable ? mode.accentColor : COLORS.surfaceTertiary }]}
          onPress={begin}
          testID="mode-intro-begin"
        >
          <Text style={[styles.ctaTxt, { color: playable ? COLORS.onBrand : COLORS.onSurfaceTertiary }]}>
            {locked ? "Locked" : playable ? (mode.entryLabel ?? "Begin") : "Coming Soon"}
          </Text>
          {playable && <Ionicons name="arrow-forward" size={16} color={COLORS.onBrand} />}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: 120 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(12,14,18,0.5)", alignItems: "center", justifyContent: "center",
  },

  hero: { height: 300, justifyContent: "space-between", overflow: "hidden" },
  heroTop: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: SPACING.lg,
  },
  heroBody: { padding: SPACING.lg, gap: 6 },
  statusChip: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
    borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 4,
  },
  statusChipTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  heroSubtitle: { color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 18, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 },

  section: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, gap: SPACING.sm },
  sectionLabel: { color: COLORS.brand, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  lore: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 22 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  bulletDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  bulletTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20, flex: 1 },

  rewardCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    marginHorizontal: SPACING.lg, marginTop: SPACING.lg,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.brand + "30", padding: SPACING.md,
  },
  rewardLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  rewardTxt: { color: COLORS.brand, fontSize: 13, fontWeight: "700", marginTop: 1 },

  lockNote: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    marginHorizontal: SPACING.lg, marginTop: SPACING.md,
  },
  lockNoteTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, flex: 1 },

  ctaBar: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: SPACING.lg, paddingTop: SPACING.md,
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    borderRadius: RADIUS.md, paddingVertical: SPACING.md + 2,
  },
  ctaTxt: { fontSize: 15, fontWeight: "800", letterSpacing: 1 },

  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.md },
  missingTxt: { color: COLORS.onSurfaceTertiary, fontSize: 14 },
});
