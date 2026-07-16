import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getLotusNode,
  isLotusNodeComplete,
  LOTUS_LESSON_SAFETY_NOTE,
} from "@/src/game/lotusLessons";
import {
  completeObjective,
  isObjectiveXpGranted,
  markObjectiveXpGranted,
} from "@/src/game/objectiveProgress";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { MilestoneReward } from "@/src/components/onboarding/MilestoneReward";
import { SceneTransition } from "@/src/components/onboarding/SceneTransition";
import { OnboardingProgressBar } from "@/src/components/onboarding/OnboardingProgressBar";
import type { LotusLessonRewards } from "@/src/game/lotusLessons";

// Push 5 — Lotus Lesson interaction flow.
//
// Renders one node's `interactions` array in order: "info" beats just
// require a tap to continue, "choice" beats show options with gentle,
// non-blocking feedback (wrong answers never fail the player out — they
// just see why, then continue). On the last interaction, grants the
// node's earned-only rewards and shows the payoff copy that links this
// lesson to its first real Ward Shift case.

export default function LotusLessonScreen() {
  const router = useRouter();
  const { nodeId } = useLocalSearchParams<{ nodeId: string }>();
  const { player, loading, completeLotusLessonNode, applyRewards } = usePlayer();
  const node = getLotusNode(String(nodeId));

  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [rewards, setRewards] = useState<LotusLessonRewards | null>(null);
  const { onRequiredAction } = useTutorial();

  // The player has actually started a lesson once this screen loads with a
  // valid node — advance to the lesson screen.
  const lessonStarted = !loading && !!player && !!node;
  useEffect(() => {
    if (lessonStarted) onRequiredAction("openLesson");
  }, [lessonStarted]);

  if (loading || !player || !node) {
    const notFound = !loading && !!player && !node;
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.hero}>
          <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
          <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university/lessons")} hitSlop={10} testID="lotus-lesson-back">
            <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
          </Pressable>
          <Text style={styles.kicker}>LOTUS LESSON</Text>
          {notFound && <Text style={styles.title}>Lesson not found</Text>}
        </View>
        <View style={styles.fallback}>
          {notFound ? (
            <>
              <Text style={styles.detail}>This lesson isn’t available right now. Head back to Vital Foundations to pick another.</Text>
              <Pressable style={styles.continueBtn} onPress={() => goBack(router, "/university/lessons")} testID="lotus-lesson-back-to-path">
                <Ionicons name="arrow-back" size={16} color={COLORS.onBrand} />
                <Text style={styles.continueTxt}>Back to Lessons</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={COLORS.brand} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const alreadyDone = isLotusNodeComplete(player, node.id);
  const interaction = node.interactions[step];
  const isLast = step === node.interactions.length - 1;

  const finish = async () => {
    const res = await completeLotusLessonNode(node.id);
    if (res.ok && res.rewards) setRewards(res.rewards);
    // C1 obj 13: grant once when player completes any Lotus Lesson.
    // Use the XP-paid record for deduplication — completeObjective alone
    // marks the step done but never grants the 10 XP objective reward.
    if (!alreadyDone) {
      const isNew = await completeObjective("obj_lotus_first_lesson");
      if (isNew) {
        const alreadyGranted = await isObjectiveXpGranted("obj_lotus_first_lesson");
        if (!alreadyGranted) {
          await applyRewards({ xp: 10 });
          await markObjectiveXpGranted("obj_lotus_first_lesson");
        }
      }
    }
    setFinished(true);
  };

  const advance = () => {
    setSelected(null);
    if (isLast) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  };

  const onChoose = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
  };

  const goToShift = () => {
    router.replace({ pathname: "/battle", params: { enemyId: node.linkedCaseId } } as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university/lessons")} hitSlop={10} testID="lotus-lesson-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>LOTUS LESSON{alreadyDone ? " · COMPLETED" : ""}</Text>
        <Text style={styles.title}>{node.title}</Text>
        {!finished && (
          <View style={styles.progressRow}>
            {node.interactions.map((_, i) => (
              <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
            ))}
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!finished ? (
          <SceneTransition trigger={step}>
            <View style={styles.safetyBox}>
              <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.safetyTxt}>{LOTUS_LESSON_SAFETY_NOTE}</Text>
            </View>

            <View style={styles.card} testID="lotus-lesson-interaction">
              <Text style={styles.prompt}>{interaction.prompt}</Text>
              {interaction.detail && <Text style={styles.detail}>{interaction.detail}</Text>}

              {interaction.type === "choice" && interaction.choices && (
                <View style={{ gap: SPACING.sm, marginTop: SPACING.sm }}>
                  {interaction.choices.map((c, i) => {
                    const isSel = selected === i;
                    const showCorrect = selected !== null && c.correct;
                    const showWrong = isSel && !c.correct;
                    return (
                      <Pressable
                        key={i}
                        onPress={() => onChoose(i)}
                        disabled={selected !== null}
                        style={[
                          styles.choice,
                          showCorrect && styles.choiceCorrect,
                          showWrong && styles.choiceWrong,
                        ]}
                        testID={`lotus-choice-${i}`}
                      >
                        <Text style={styles.choiceTxt}>{c.text}</Text>
                      </Pressable>
                    );
                  })}
                  {selected !== null && (
                    <Text style={styles.feedbackTxt}>{interaction.choices[selected].feedback}</Text>
                  )}
                </View>
              )}
            </View>

            {(interaction.type === "info" || selected !== null) && (
              <Pressable style={styles.continueBtn} onPress={advance} testID="lotus-lesson-continue">
                <Text style={styles.continueTxt}>{isLast ? "Finish Lesson" : "Continue"}</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.onBrand} />
              </Pressable>
            )}
          </SceneTransition>
        ) : (
          <SceneTransition trigger="lesson-complete" style={styles.doneWrap}>
          <View testID="lotus-lesson-complete">
            {!alreadyDone && (player.lessons_completed?.length ?? 0) <= 1 && (
              <OnboardingProgressBar step="Lessons" />
            )}
            <Ionicons name="checkmark-circle" size={48} color={COLORS.brand} />
            <Text style={styles.doneTitle}>Lesson Complete</Text>
            {!alreadyDone && (
              <View style={styles.unlockBanner}>
                <Ionicons name="lock-open-outline" size={15} color={COLORS.brand} />
                <Text style={styles.unlockBannerTxt}>
                  Your clinical foundation is stronger. First simulation shift unlocked.
                </Text>
              </View>
            )}
            {rewards && (
              <MilestoneReward
                title="LESSON REWARD"
                items={[
                  { icon: "diamond-outline", label: "Insight Crystals", amount: String(rewards.insightCrystals) },
                  { icon: "logo-usd", label: "Ward Coins", amount: String(rewards.crowns) },
                  { icon: "school-outline", label: "University Credits", amount: String(rewards.universityCredits) },
                  { icon: "trending-up-outline", label: "XP", amount: String(rewards.xp) },
                ]}
              />
            )}
            {node.payoffCopy && (
              <View style={styles.payoffBox}>
                <Text style={styles.payoffTxt}>{node.payoffCopy}</Text>
              </View>
            )}
            {node.linkedCaseId && (
              <Pressable style={styles.continueBtn} onPress={goToShift} testID="lotus-lesson-go-shift">
                <Ionicons name="pulse" size={16} color={COLORS.onBrand} />
                <Text style={styles.continueTxt}>Try It in a Ward Shift</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => goBack(router, "/university/lessons")}
              testID="lotus-lesson-back-to-path"
            >
              <Text style={styles.secondaryTxt}>Back to Vital Foundations</Text>
            </Pressable>
          </View>
          </SceneTransition>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: 4 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)", marginBottom: SPACING.sm,
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 22, fontWeight: "300" },
  progressRow: { flexDirection: "row", gap: 6, marginTop: SPACING.sm },
  progressDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: COLORS.border },
  progressDotActive: { backgroundColor: COLORS.brand },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.md, padding: SPACING.xl },
  safetyBox: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.sm, backgroundColor: COLORS.surfaceSecondary,
  },
  safetyTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 15 },
  card: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.lg, backgroundColor: COLORS.surfaceSecondary, gap: SPACING.sm,
  },
  prompt: { color: COLORS.onSurface, fontSize: 16, fontWeight: "600", lineHeight: 23 },
  detail: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  choice: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.sm, backgroundColor: COLORS.surface,
  },
  choiceCorrect: { borderColor: COLORS.brand, backgroundColor: COLORS.brand + "18" },
  choiceWrong: { borderColor: COLORS.brandSecondary, backgroundColor: COLORS.brandSecondary + "18" },
  choiceTxt: { color: COLORS.onSurface, fontSize: 13 },
  feedbackTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  continueBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    backgroundColor: COLORS.brand, borderRadius: RADIUS.pill, paddingVertical: SPACING.md,
  },
  continueTxt: { color: COLORS.onBrand, fontSize: 14, fontWeight: "700" },
  doneWrap: { alignItems: "center", gap: SPACING.md, paddingTop: SPACING.lg },
  doneTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: "700" },
  unlockBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.brand + "18", borderWidth: 1, borderColor: COLORS.brand + "50",
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    width: "100%",
  },
  unlockBannerTxt: { flex: 1, color: COLORS.onSurface, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  payoffBox: {
    borderWidth: 1, borderColor: COLORS.brand + "40", borderRadius: RADIUS.md,
    padding: SPACING.md, backgroundColor: COLORS.brand + "10", width: "100%",
  },
  payoffTxt: { color: COLORS.onSurface, fontSize: 13, lineHeight: 19, textAlign: "center", fontStyle: "italic" },
  secondaryBtn: { paddingVertical: SPACING.sm },
  secondaryTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },
});
