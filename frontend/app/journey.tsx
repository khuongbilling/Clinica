/**
 * /journey — Chapter Journey Map screen
 *
 * A full-screen scrollable view of the Phase 1 chapter progression map.
 * Accessible from the main hub via the "Journey" feature button.
 *
 * Route: /journey
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChapterJourneyMap } from "@/src/components/ChapterJourneyMap";
import {
  getCurrentChapter,
  getNextRecommendedPart,
} from "@/src/game/chapterJourney";
import { playerLevelFromXp } from "@/src/game/progression";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function JourneyScreen() {
  const router = useRouter();
  const { player, loading } = usePlayer();

  if (loading || !player) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={["top", "bottom"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  const { level: playerLevel } = playerLevelFromXp(player.xp ?? 0);
  const currentChapter = getCurrentChapter(playerLevel);
  const nextStep = getNextRecommendedPart(playerLevel);
  // C3: Field Practice Required — show a strip when the next chapter is locked
  // and the player hasn't yet done any battles (no entries in battle_stars).
  const hasBattleStars = Object.keys(player.battle_stars ?? {}).length > 0;
  const showFieldPracticeStrip = !hasBattleStars && playerLevel < 2;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="journey-screen">
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={10}
          testID="journey-back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>PHASE 1 · CHAPTERS 1–10</Text>
          <Text style={styles.title}>Chapter Journey</Text>
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelTxt}>Lv.{playerLevel}</Text>
        </View>
      </View>

      {/* ── C3: Field Practice Required strip (new players with no battle XP) ── */}
      {showFieldPracticeStrip && (
        <Pressable
          style={styles.fieldPracticeStrip}
          onPress={() => router.push("/mode/ward-shift" as any)}
          testID="journey-field-practice-strip"
        >
          <Ionicons name="shield-half" size={18} color={COLORS.error} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldPracticeTitle}>Field Practice Required</Text>
            <Text style={styles.fieldPracticeSub}>Complete Ward Shifts and earn ★ ratings to progress through chapters.</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={COLORS.error} />
        </Pressable>
      )}

      {/* ── Next recommended step strip ── */}
      {nextStep && (
        <Pressable
          style={styles.nextStepStrip}
          onPress={() => {
            if (nextStep.part.route && !nextStep.part.isPlaceholder) {
              router.push(nextStep.part.route as any);
            }
          }}
          testID="journey-next-step"
        >
          <View style={[styles.nextDot, { backgroundColor: currentChapter.accentColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.nextKicker, { color: currentChapter.accentColor }]}>
              NEXT · CH.{currentChapter.number} — PART {nextStep.part.part}
            </Text>
            <Text style={styles.nextTitle} numberOfLines={1}>
              {nextStep.part.title}
            </Text>
          </View>
          {nextStep.part.route && !nextStep.part.isPlaceholder ? (
            <Ionicons name="arrow-forward-circle" size={22} color={currentChapter.accentColor} />
          ) : (
            <View style={styles.comingSoonPill}>
              <Text style={styles.comingSoonTxt}>SOON</Text>
            </View>
          )}
        </Pressable>
      )}

      {/* ── Journey Map scroll ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="journey-scroll"
      >
        <ChapterJourneyMap playerLevel={playerLevel} battleStars={player.battle_stars ?? {}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: COLORS.brand,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.onSurface,
  },
  levelBadge: {
    backgroundColor: COLORS.brandTertiary,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.brand + "60",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  levelTxt: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.brand,
  },

  // C3: Field Practice Required strip
  fieldPracticeStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.error + "12",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error + "50",
    padding: SPACING.sm,
  },
  fieldPracticeTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.error,
    letterSpacing: 0.3,
  },
  fieldPracticeSub: {
    fontSize: 11,
    color: COLORS.onSurfaceTertiary,
    marginTop: 1,
    lineHeight: 14,
  },

  // Next step strip
  nextStepStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
  },
  nextDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  nextKicker: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  nextTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.onSurface,
    marginTop: 1,
  },
  comingSoonPill: {
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  comingSoonTxt: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.onSurfaceTertiary,
    letterSpacing: 0.8,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.xl },
});
