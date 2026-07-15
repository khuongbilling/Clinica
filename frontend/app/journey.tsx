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
  CHAPTERS,
  getCurrentChapter,
  getChapterFailureHint,
  getNextRecommendedPart,
} from "@/src/game/chapterJourney";
import { playerLevelFromXp } from "@/src/game/progression";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function JourneyScreen() {
  const router = useRouter();
  const { player, loading, claimChapterChest, claimJourneyNode } = usePlayer();

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
  // J5: Field Practice Required — show strip when the player has done at least
  // one battle but still needs more XP/levels to unlock the next chapter.
  // (Previously only showed for brand-new players with no battle stars.)
  const hasBattleStars = Object.keys(player.battle_stars ?? {}).length > 0;
  const nextLockedChapter = CHAPTERS.find((ch) => ch.levelGate > playerLevel);
  const showFieldPracticeStrip = !!nextLockedChapter && hasBattleStars;
  // J5: University support strip — show when the player has accumulated 3+
  // total battle failures, suggesting targeted University practice.
  const totalFailures = Object.values(player.failure_counts ?? {}).reduce(
    (sum: number, v) => sum + ((v as number) || 0),
    0,
  );
  const failureHint = getChapterFailureHint(currentChapter.number);
  const showUniversitySupport = totalFailures >= 3 && !!failureHint && !showFieldPracticeStrip;

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

      {/* ── J5: Field Practice Required strip — shown when next chapter is locked ── */}
      {showFieldPracticeStrip && (
        <Pressable
          style={styles.fieldPracticeStrip}
          onPress={() => router.push("/mode/ward-shift" as any)}
          testID="journey-field-practice-strip"
        >
          <Ionicons name="shield-half" size={18} color={COLORS.error} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldPracticeTitle}>Field Practice Required</Text>
            <Text style={styles.fieldPracticeSub}>
              Reach Level {nextLockedChapter?.levelGate} to unlock Chapter {nextLockedChapter?.number}. Complete University practice, replay cleared shifts, or upgrade hero skills.
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={COLORS.error} />
        </Pressable>
      )}

      {/* ── J5: University Support strip — shown when player has frequent failures ── */}
      {showUniversitySupport && failureHint && (
        <View style={styles.universitySupportStrip} testID="journey-university-support">
          <Ionicons name="school-outline" size={18} color={COLORS.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.universitySupportTitle}>Having Trouble?</Text>
            <Text style={styles.universitySupportSub}>{failureHint.text}</Text>
            <View style={styles.universitySupportBtnRow}>
              <Pressable
                style={styles.universitySupportBtn}
                onPress={() => router.push(failureHint.primaryRoute as any)}
              >
                <Text style={styles.universitySupportBtnTxt}>Practice at University</Text>
              </Pressable>
              <Pressable
                style={[styles.universitySupportBtn, styles.universitySupportBtnSecondary]}
                onPress={() => router.push(failureHint.secondaryRoute as any)}
              >
                <Text style={[styles.universitySupportBtnTxt, { color: "#A78BFA" }]}>Upgrade Skills</Text>
              </Pressable>
            </View>
          </View>
        </View>
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
        <ChapterJourneyMap
          playerLevel={playerLevel}
          battleStars={player.battle_stars ?? {}}
          claimedChests={player.claimed_chapter_chests ?? []}
          claimedNodes={player.claimed_journey_nodes ?? []}
          storyScenesSeen={player.story_scenes_seen ?? []}
          wardDefenseWaves={player.ward_defense_waves ?? 0}
          onChestClaim={async (chestId) => {
            const res = await claimChapterChest(chestId);
            if (!res.ok) {
              console.warn('[Journey] chest claim failed:', res.message);
            }
          }}
          onNodeClaim={async (nodeId, stars) => {
            const res = await claimJourneyNode(nodeId, stars);
            if (!res.ok) {
              console.warn('[Journey] node claim failed:', res.message);
            }
          }}
        />
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

  // J5: Field Practice Required strip
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

  // J5: University support strip (shown when 3+ failures)
  universitySupportStrip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.brand + "10",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.brand + "45",
    padding: SPACING.sm,
  },
  universitySupportTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.brand,
    letterSpacing: 0.3,
  },
  universitySupportSub: {
    fontSize: 11,
    color: COLORS.onSurfaceTertiary,
    marginTop: 2,
    lineHeight: 15,
  },
  universitySupportBtnRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    flexWrap: "wrap",
  },
  universitySupportBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  universitySupportBtnSecondary: {
    backgroundColor: "#A78BFA20",
    borderWidth: 1,
    borderColor: "#A78BFA55",
  },
  universitySupportBtnTxt: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.onBrand,
    letterSpacing: 0.5,
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
