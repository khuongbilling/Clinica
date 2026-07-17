import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getLotusNode, isLotusNodeComplete, LOTUS_LESSON_SAFETY_NOTE,
} from "@/src/game/lotusLessons";
import {
  completeObjective, isObjectiveXpGranted, markObjectiveXpGranted,
} from "@/src/game/objectiveProgress";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { MilestoneReward } from "@/src/components/onboarding/MilestoneReward";
import { SceneTransition } from "@/src/components/onboarding/SceneTransition";
import { OnboardingProgressBar } from "@/src/components/onboarding/OnboardingProgressBar";
import type { LotusLessonRewards } from "@/src/game/lotusLessons";

// ── Topic colour + icon per lesson node ─────────────────────────────────────
const LESSON_META: Record<string, { icon: string; color: string; label: string }> = {
  'recognizing-cues-hydration': { icon: 'water-outline',       color: '#06B6D4', label: 'Hydration Basics' },
  'fever-and-warmth':           { icon: 'thermometer-outline', color: '#F97316', label: 'Fever & Warmth' },
  'breathing-basics':           { icon: 'pulse-outline',       color: '#B0DEFF', label: 'Breathing Basics' },
};

// Letter labels for choice options
const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

// ── Learning tag chip ─────────────────────────────────────────────────────────
function TagChip({ tag }: { tag: string }) {
  const [category, ...rest] = tag.split(': ');
  const label = rest.join(': ');
  const isNclex   = category === 'NCLEX Concept';
  const isSkill   = category === 'Health Skill';
  const isHabit   = category === 'Clinical Habit';
  const chipColor = isNclex ? '#A78BFA' : isSkill ? '#06B6D4' : isHabit ? COLORS.success : COLORS.brand;
  return (
    <View style={[tagStyles.chip, { borderColor: chipColor + '44', backgroundColor: chipColor + '14' }]}>
      <Text style={[tagStyles.category, { color: chipColor + 'BB' }]}>{category.toUpperCase()}</Text>
      <Text style={[tagStyles.label, { color: chipColor }]}>{label}</Text>
    </View>
  );
}
const tagStyles = StyleSheet.create({
  chip: {
    borderRadius: RADIUS.md, borderWidth: 1,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, gap: 2,
  },
  category: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  label: { fontSize: 11, fontWeight: '700' },
});

// ── Main lesson screen ────────────────────────────────────────────────────────
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

  const lessonStarted = !loading && !!player && !!node;
  useEffect(() => {
    if (lessonStarted) onRequiredAction("openLesson");
  }, [lessonStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading / not-found fallback ──────────────────────────────────────────
  if (loading || !player || !node) {
    const notFound = !loading && !!player && !node;
    const meta = { icon: 'leaf-outline', color: COLORS.brand, label: 'Lotus Lesson' };
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={[styles.hero, { borderBottomColor: meta.color + '30' }]}>
          <LinearGradient colors={[meta.color + '28', COLORS.surface]} style={StyleSheet.absoluteFillObject} />
          <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university/lessons")} hitSlop={10} testID="lotus-lesson-back">
            <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
          </Pressable>
          <Text style={styles.kicker}>LOTUS LESSON</Text>
          {notFound && <Text style={styles.heroTitle}>Lesson not found</Text>}
        </View>
        <View style={styles.fallback}>
          {notFound ? (
            <>
              <Text style={styles.fallbackTxt}>
                This lesson isn't available right now. Head back to Vital Foundations.
              </Text>
              <Pressable style={styles.primaryBtn} onPress={() => goBack(router, "/university/lessons")} testID="lotus-lesson-back-to-path">
                <Ionicons name="arrow-back" size={16} color={COLORS.onBrand} />
                <Text style={styles.primaryBtnTxt}>Back to Lessons</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={COLORS.brand} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const meta = LESSON_META[node.id] ?? { icon: 'leaf-outline', color: COLORS.brand, label: 'Lesson' };
  const alreadyDone = isLotusNodeComplete(player, node.id);
  const interaction = node.interactions[step];
  const isLast = step === node.interactions.length - 1;
  const totalSteps = node.interactions.length;

  // ── Actions ───────────────────────────────────────────────────────────────
  const finish = async () => {
    const res = await completeLotusLessonNode(node.id);
    if (res.ok && res.rewards) setRewards(res.rewards);
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

  // ── Render: playing ───────────────────────────────────────────────────────
  if (!finished) {
    const isChoice = interaction.type === 'choice';
    const isCorrectSelected = selected !== null && interaction.choices?.[selected]?.correct;
    const hasAnswered = selected !== null;
    const canContinue = !isChoice || hasAnswered;

    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Header with topic colour accent */}
        <View style={styles.hero}>
          <LinearGradient
            colors={[meta.color + '28', COLORS.surface]}
            style={StyleSheet.absoluteFillObject}
          />
          <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university/lessons")} hitSlop={10} testID="lotus-lesson-back">
            <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
          </Pressable>

          {/* Kicker row: topic tag + step counter */}
          <View style={styles.heroMetaRow}>
            <View style={[styles.topicChip, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
              <Ionicons name={meta.icon as any} size={11} color={meta.color} />
              <Text style={[styles.topicChipTxt, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
            </View>
            <Text style={styles.stepCounter}>STEP {step + 1} OF {totalSteps}</Text>
          </View>

          <Text style={styles.heroTitle} numberOfLines={2}>{node.title}</Text>

          {/* Segmented progress bar */}
          <View style={styles.segBarRow}>
            {node.interactions.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.segBarSeg,
                  { flex: 1, backgroundColor: i < step ? meta.color + 'AA' : i === step ? meta.color : COLORS.border },
                ]}
              />
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <SceneTransition trigger={step}>
            {/* ── Info beat ──────────────────────────────────────────────── */}
            {!isChoice ? (
              <View style={styles.infoCard}>
                {/* Large topic icon */}
                <View style={[styles.infoIconWrap, { backgroundColor: meta.color + '1C' }]}>
                  <Ionicons name={meta.icon as any} size={32} color={meta.color} />
                </View>

                <Text style={styles.infoPrompt}>{interaction.prompt}</Text>

                {interaction.detail && (
                  <View style={[styles.clinicalNoteBox, { borderLeftColor: meta.color }]}>
                    <View style={styles.clinicalNoteHeader}>
                      <Ionicons name="document-text-outline" size={12} color={meta.color} />
                      <Text style={[styles.clinicalNoteLabel, { color: meta.color }]}>CLINICAL NOTE</Text>
                    </View>
                    <Text style={styles.clinicalNoteText}>{interaction.detail}</Text>
                  </View>
                )}
              </View>
            ) : (
              /* ── Choice beat ───────────────────────────────────────────── */
              <View style={styles.choiceCard}>
                <View style={[styles.choicePromptBadge, { backgroundColor: meta.color + '18' }]}>
                  <Ionicons name="help-circle-outline" size={14} color={meta.color} />
                  <Text style={[styles.choicePromptLabel, { color: meta.color }]}>QUICK CHECK</Text>
                </View>
                <Text style={styles.choicePrompt}>{interaction.prompt}</Text>

                <View style={styles.choiceList}>
                  {interaction.choices?.map((c, i) => {
                    const isSel = selected === i;
                    const showCorrect = hasAnswered && c.correct;
                    const showWrong = isSel && !c.correct;
                    return (
                      <Pressable
                        key={i}
                        onPress={() => onChoose(i)}
                        disabled={hasAnswered}
                        style={[
                          styles.choiceOption,
                          showCorrect && styles.choiceCorrect,
                          showWrong && styles.choiceWrong,
                        ]}
                        testID={`lotus-choice-${i}`}
                      >
                        {/* Letter label */}
                        <View style={[
                          styles.choiceLabel,
                          showCorrect && { backgroundColor: COLORS.success + '30', borderColor: COLORS.success },
                          showWrong && { backgroundColor: COLORS.error + '30', borderColor: COLORS.error },
                        ]}>
                          <Text style={[
                            styles.choiceLabelTxt,
                            showCorrect && { color: COLORS.success },
                            showWrong && { color: COLORS.error },
                          ]}>
                            {showCorrect ? '✓' : showWrong ? '✗' : CHOICE_LABELS[i]}
                          </Text>
                        </View>
                        <Text style={[
                          styles.choiceText,
                          showCorrect && { color: COLORS.success, fontWeight: '700' },
                          showWrong && { color: COLORS.error },
                        ]}>{c.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Feedback box after selection */}
                {hasAnswered && interaction.choices && (
                  <View style={[
                    styles.feedbackBox,
                    isCorrectSelected
                      ? { borderColor: COLORS.success + '50', backgroundColor: COLORS.success + '0E' }
                      : { borderColor: COLORS.error + '50', backgroundColor: COLORS.error + '0E' },
                  ]}>
                    <Ionicons
                      name={isCorrectSelected ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={isCorrectSelected ? COLORS.success : COLORS.error}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[
                        styles.feedbackTitle,
                        { color: isCorrectSelected ? COLORS.success : COLORS.error },
                      ]}>
                        {isCorrectSelected ? 'Correct!' : 'Not quite.'}
                      </Text>
                      <Text style={styles.feedbackText}>
                        {interaction.choices[selected].feedback}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Continue / Finish button */}
            {canContinue && (
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: meta.color }]}
                onPress={advance}
                testID="lotus-lesson-continue"
              >
                <Text style={styles.primaryBtnTxt}>{isLast ? 'Finish Lesson' : 'Continue'}</Text>
                <Ionicons name="arrow-forward" size={16} color="#000" />
              </Pressable>
            )}

            {/* Safety disclaimer — small, at bottom */}
            <View style={styles.disclaimerRow}>
              <Ionicons name="shield-checkmark-outline" size={11} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.disclaimerTxt}>{LOTUS_LESSON_SAFETY_NOTE}</Text>
            </View>
          </SceneTransition>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: completion screen ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={[styles.scroll, styles.doneScroll]} showsVerticalScrollIndicator={false}>
        <SceneTransition trigger="lesson-complete" style={styles.doneWrap}>
          <View testID="lotus-lesson-complete" style={styles.doneInner}>

            {/* Onboarding progress (first lesson only) */}
            {!alreadyDone && (player.lessons_completed?.length ?? 0) <= 1 && (
              <OnboardingProgressBar step="Lessons" />
            )}

            {/* Big topic icon */}
            <View style={[styles.doneIconWrap, { backgroundColor: meta.color + '1C' }]}>
              <Ionicons name={meta.icon as any} size={36} color={meta.color} />
              <View style={styles.doneCheckBadge}>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              </View>
            </View>

            {/* Title */}
            <Text style={styles.doneKicker}>LESSON COMPLETE</Text>
            <Text style={styles.doneTitle}>{node.title}</Text>

            {/* Unlock banner (first time only) */}
            {!alreadyDone && (
              <View style={[styles.unlockBanner, { borderColor: meta.color + '44', backgroundColor: meta.color + '10' }]}>
                <Ionicons name="lock-open-outline" size={15} color={meta.color} />
                <Text style={[styles.unlockBannerTxt, { color: meta.color }]}>
                  Clinical foundation strengthened — Ward Shift simulation unlocked.
                </Text>
              </View>
            )}

            {/* What You Practiced — learning tags */}
            {node.learningTags && node.learningTags.length > 0 && (
              <View style={styles.tagsSection}>
                <Text style={styles.tagsSectionTitle}>WHAT YOU PRACTICED</Text>
                <View style={styles.tagsRow}>
                  {node.learningTags.map((tag, i) => <TagChip key={i} tag={tag} />)}
                </View>
              </View>
            )}

            {/* Milestone reward */}
            {rewards && (
              <MilestoneReward
                title="LESSON REWARD"
                items={[
                  { icon: "diamond-outline",    label: "Insight Crystals",    amount: String(rewards.insightCrystals) },
                  { icon: "logo-usd",           label: "Ward Coins",          amount: String(rewards.crowns) },
                  { icon: "school-outline",     label: "University Credits",  amount: String(rewards.universityCredits) },
                  { icon: "trending-up-outline",label: "XP",                  amount: String(rewards.xp) },
                ]}
              />
            )}

            {/* Ward Shift connection */}
            {node.payoffCopy && (
              <View style={[styles.payoffBox, { borderColor: meta.color + '35', backgroundColor: meta.color + '0A' }]}>
                <View style={styles.payoffHeader}>
                  <Ionicons name="link-outline" size={13} color={meta.color} />
                  <Text style={[styles.payoffHeaderTxt, { color: meta.color }]}>WARD SHIFT CONNECTION</Text>
                </View>
                <Text style={styles.payoffTxt}>{node.payoffCopy}</Text>
              </View>
            )}

            {/* CTAs */}
            {node.linkedCaseId && (
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: meta.color }]}
                onPress={goToShift}
                testID="lotus-lesson-go-shift"
              >
                <Ionicons name="pulse" size={16} color="#000" />
                <Text style={styles.primaryBtnTxt}>Try It in a Ward Shift</Text>
              </Pressable>
            )}

            <Pressable
              style={styles.secondaryBtn}
              onPress={() => goBack(router, "/university/lessons")}
              testID="lotus-lesson-back-to-path"
            >
              <Text style={styles.secondaryBtnTxt}>Back to Vital Foundations</Text>
            </Pressable>

          </View>
        </SceneTransition>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },

  // Hero / header
  hero: {
    padding: SPACING.lg, paddingTop: SPACING.xl, gap: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  topicChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  topicChipTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  stepCounter: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: '700', lineHeight: 24, marginTop: 2 },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: '700' },

  // Segmented progress bar
  segBarRow: { flexDirection: 'row', gap: 3, marginTop: SPACING.xs },
  segBarSeg: { height: 4, borderRadius: 2 },

  // Scroll area
  scroll: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxxl },

  // Info beat card
  infoCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    padding: SPACING.lg, gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center',
  },
  infoIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  infoPrompt: {
    color: COLORS.onSurface, fontSize: 17, fontWeight: '700',
    lineHeight: 25, textAlign: 'center',
  },
  clinicalNoteBox: {
    borderLeftWidth: 3, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceTertiary,
    padding: SPACING.md, gap: SPACING.xs, width: '100%',
  },
  clinicalNoteHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clinicalNoteLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  clinicalNoteText: { color: COLORS.onSurfaceSecondary, fontSize: 15, lineHeight: 22 },

  // Choice beat card
  choiceCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    padding: SPACING.lg, gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  choicePromptBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3,
  },
  choicePromptLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  choicePrompt: { color: COLORS.onSurface, fontSize: 17, fontWeight: '600', lineHeight: 25 },
  choiceList: { gap: SPACING.sm },
  choiceOption: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, backgroundColor: COLORS.surface,
  },
  choiceCorrect: { borderColor: COLORS.success + '66', backgroundColor: COLORS.success + '0C' },
  choiceWrong:   { borderColor: COLORS.error   + '66', backgroundColor: COLORS.error   + '0C' },
  choiceLabel: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.border, flexShrink: 0,
  },
  choiceLabelTxt: { color: COLORS.onSurfaceSecondary, fontSize: 14, fontWeight: '800' },
  choiceText: { color: COLORS.onSurface, fontSize: 15, lineHeight: 22, flex: 1 },

  // Feedback box
  feedbackBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md,
  },
  feedbackTitle: { fontSize: 14, fontWeight: '800' },
  feedbackText:  { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },

  // Continue button
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    backgroundColor: COLORS.brand, borderRadius: RADIUS.pill,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
  },
  primaryBtnTxt: { color: "#000", fontSize: 14, fontWeight: "800" },

  // Safety disclaimer
  disclaimerRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 5,
    paddingHorizontal: SPACING.sm,
  },
  disclaimerTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 9, lineHeight: 13 },

  // Fallback
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.md, padding: SPACING.xl },
  fallbackTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  // ── Completion screen ──────────────────────────────────────────────────────
  doneScroll: { paddingBottom: SPACING.xxxl },
  doneWrap: { flex: 1 },
  doneInner: { alignItems: 'center', gap: SPACING.lg, paddingTop: SPACING.xl },

  doneIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  doneCheckBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: COLORS.surface, borderRadius: 12,
  },
  doneKicker: { color: COLORS.success, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  doneTitle: {
    color: COLORS.onSurface, fontSize: 20, fontWeight: '700',
    textAlign: 'center', lineHeight: 27,
  },

  unlockBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderWidth: 1, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, width: '100%',
  },
  unlockBannerTxt: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },

  // What You Practiced
  tagsSection: { width: '100%', gap: SPACING.sm },
  tagsSectionTitle: {
    color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: '800',
    letterSpacing: 1.5,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },

  // Payoff box
  payoffBox: {
    borderWidth: 1, borderRadius: RADIUS.md,
    padding: SPACING.md, gap: SPACING.sm, width: '100%',
  },
  payoffHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  payoffHeaderTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  payoffTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },

  secondaryBtn: { paddingVertical: SPACING.sm },
  secondaryBtnTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: '600' },
});
