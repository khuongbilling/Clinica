import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getLesson, getBadge } from "@/src/game/lessons";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function LessonDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { player, completeLesson } = usePlayer();
  const lesson = getLesson(String(id));
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [reward, setReward] = useState<string | null>(null);

  if (!player || !lesson) return null;

  const badge = getBadge(lesson.badgeId);
  const alreadyDone = (player.lessons_completed || []).includes(lesson.id);

  const onChoose = async (i: number) => {
    if (answered) return;
    setSelected(i);
    setAnswered(true);
    const res = await completeLesson(lesson.id);
    if (res.ok) setReward(res.message);
  };

  const isCorrect = selected === lesson.quickChallenge.correctIndex;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university/lessons")} testID="lesson-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>LESSON{alreadyDone ? " · COMPLETED" : ""}</Text>
        <Text style={styles.title}>{lesson.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Block label="What it means" text={lesson.whatItMeans} icon="help-circle-outline" />
        <Block label="Why it matters" text={lesson.whyItMatters} icon="alert-circle-outline" />
        <Block label="What to look for" text={lesson.whatToLookFor} icon="search-outline" />
        <Block label="What to do first" text={lesson.whatToDoFirst} icon="checkmark-done-outline" />
        <Block label="Game translation" text={lesson.gameTranslation} icon="game-controller-outline" accent />
        {lesson.clinicalNote && (
          <Block label="Clinical learner note" text={lesson.clinicalNote} icon="school-outline" />
        )}

        <View style={styles.challengeBox}>
          <Text style={styles.challengeTitle}>Quick Challenge</Text>
          <Text style={styles.challengeQ}>{lesson.quickChallenge.question}</Text>
          {lesson.quickChallenge.choices.map((c, i) => {
            const isSel = selected === i;
            const showCorrect = answered && i === lesson.quickChallenge.correctIndex;
            const showWrong = answered && isSel && i !== lesson.quickChallenge.correctIndex;
            return (
              <Pressable
                key={i}
                onPress={() => onChoose(i)}
                disabled={answered}
                style={[
                  styles.choice,
                  showCorrect && styles.choiceCorrect,
                  showWrong && styles.choiceWrong,
                ]}
                testID={`lesson-choice-${i}`}
              >
                <Text style={styles.choiceTxt}>{c}</Text>
              </Pressable>
            );
          })}
          {answered && (
            <View style={styles.feedbackBox} testID="lesson-feedback">
              <Text style={[styles.feedbackHeader, { color: isCorrect ? COLORS.brand : COLORS.onSurfaceSecondary }]}>
                {isCorrect ? "Correct!" : "Not quite — here's why"}
              </Text>
              <Text style={styles.feedbackTxt}>{lesson.quickChallenge.explanation}</Text>
              {reward && <Text style={styles.rewardTxt}>{reward}</Text>}
              {badge && (
                <Text style={styles.badgeTxt}>
                  Progress toward {badge.name}: {Math.min((player.badge_progress || {})[badge.id] || 0, badge.goal)}/{badge.goal}
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.combatPanel}>
          <Text style={styles.combatTitle}>Concept-to-Combat</Text>
          <CombatRow label="Real Concept" text={lesson.conceptToCombat.realConcept} />
          <CombatRow label="Game Translation" text={lesson.conceptToCombat.gameTranslation} />
          <CombatRow label="Battle Tip" text={lesson.conceptToCombat.battleTip} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Block({ label, text, icon, accent }: { label: string; text: string; icon: string; accent?: boolean }) {
  return (
    <View style={[styles.block, accent && styles.blockAccent]}>
      <View style={styles.blockHeader}>
        <Ionicons name={icon as any} size={15} color={accent ? COLORS.brand : COLORS.onSurfaceSecondary} />
        <Text style={[styles.blockLabel, accent && { color: COLORS.brand }]}>{label}</Text>
      </View>
      <Text style={styles.blockTxt}>{text}</Text>
    </View>
  );
}

function CombatRow({ label, text }: { label: string; text: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.combatLabel}>{label}</Text>
      <Text style={styles.combatTxt}>{text}</Text>
    </View>
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
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  block: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, backgroundColor: COLORS.surfaceSecondary, gap: 4,
  },
  blockAccent: { borderColor: COLORS.brand + "60" },
  blockHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  blockLabel: { color: COLORS.onSurface, fontSize: 11, fontWeight: "700" },
  blockTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },
  challengeBox: {
    borderWidth: 1, borderColor: COLORS.brand + "50", borderRadius: RADIUS.md,
    padding: SPACING.md, backgroundColor: COLORS.surfaceSecondary, gap: SPACING.sm,
  },
  challengeTitle: { color: COLORS.brand, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  challengeQ: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  choice: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.sm, backgroundColor: COLORS.surface,
  },
  choiceCorrect: { borderColor: COLORS.brand, backgroundColor: COLORS.brand + "18" },
  choiceWrong: { borderColor: COLORS.brandSecondary, backgroundColor: COLORS.brandSecondary + "18" },
  choiceTxt: { color: COLORS.onSurface, fontSize: 12 },
  feedbackBox: { gap: 4, marginTop: 4 },
  feedbackHeader: { fontSize: 12, fontWeight: "800" },
  feedbackTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 16 },
  rewardTxt: { color: COLORS.brand, fontSize: 12, fontWeight: "700" },
  badgeTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  combatPanel: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, backgroundColor: COLORS.surfaceSecondary, gap: SPACING.sm,
  },
  combatTitle: { color: COLORS.onSurface, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  combatLabel: { color: COLORS.brand, fontSize: 10, fontWeight: "700" },
  combatTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 16 },
});
