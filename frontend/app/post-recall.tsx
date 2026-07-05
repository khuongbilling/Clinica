import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlayer } from "@/src/game/store";
import {
  QUIZ_QUESTIONS,
  computeQuizResult,
  computeAutomatedAssignment,
  formatResonance,
  CLASS_TAGLINE,
  CLASS_ICON,
  CLASS_COLOR,
  type QuizAnswers,
  type QuizResult,
} from "@/src/game/classQuiz";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// Post-recall onboarding. Runs immediately after Lotus Recall, before the
// player ever reaches the normal hub, in two resumable sub-steps:
//   1. Identity restoration — a System-styled name input that saves into the
//      same `player.name` field used everywhere else (header, profile).
//   2. Class diagnostic (Push 3) — a 5-question System personality/career
//      quiz (or an "Automated Class Assignment" shortcut) that RECOMMENDS a
//      primary class, second-closest fit, and modern department resonance.
//      Push 3 intentionally stops at showing that recommendation — actually
//      saving the class onto the player, the full confirmation screen,
//      reminiscence, Lotus Lessons, and simulation chapters are Push 4+.
//      For now, "Continue" simply marks the diagnostic sub-step as seen
//      (completeIdentityRestore's sibling, completeDiagnosticIntro) so the
//      player is never stuck re-answering it, then proceeds to the hub.
// The screen re-derives which sub-step to show from persisted player flags
// (identity_restored / diagnostic_intro_seen) on every render, so a reload
// or app restart mid-sequence always resumes at the correct step instead of
// getting stuck or skipping ahead.

type DiagnosticView = "intro" | "question" | "assigning" | "result";

const AUTOMATED_MESSAGES = [
  "SYSTEM: Soul resonance unstable.",
  "SYSTEM: Reconstructing from fragmented instinct.",
];

export default function PostRecall() {
  const router = useRouter();
  const { player, completeIdentityRestore, completeDiagnosticIntro } = usePlayer();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Class-diagnostic sub-state (only used within the "diagnostic" phase).
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [view, setView] = useState<DiagnosticView>("intro");
  const [automatedMsgIndex, setAutomatedMsgIndex] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);

  const phase: "identity" | "diagnostic" | "done" = !player
    ? "identity"
    : player.identity_restored === false
    ? "identity"
    : player.diagnostic_intro_seen === false
    ? "diagnostic"
    : "done";

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [phase, view, quizStep, automatedMsgIndex, fadeAnim]);

  useEffect(() => {
    if (phase === "done") router.replace("/(tabs)");
  }, [phase, router]);

  useEffect(() => {
    if (player?.name && player.name !== "Healer") setName(player.name);
  }, [player?.name]);

  // Drives the short "SYSTEM: ..." message sequence for Automated Class
  // Assignment, then reveals the (already-computed) randomized result.
  useEffect(() => {
    if (view !== "assigning") return;
    if (automatedMsgIndex < AUTOMATED_MESSAGES.length - 1) {
      const t = setTimeout(() => setAutomatedMsgIndex((i) => i + 1), 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setView("result"), 1100);
    return () => clearTimeout(t);
  }, [view, automatedMsgIndex]);

  const submitIdentity = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await completeIdentityRestore(name.trim() || "Healer");
    } finally {
      setSubmitting(false);
    }
  };

  const startQuiz = () => {
    setAnswers({});
    setQuizStep(0);
    setView("question");
  };

  const chooseAnswer = (value: string) => {
    const q = QUIZ_QUESTIONS[quizStep];
    const nextAnswers = { ...answers, [q.id]: value };
    setAnswers(nextAnswers);
    if (quizStep + 1 < QUIZ_QUESTIONS.length) {
      setQuizStep(quizStep + 1);
    } else {
      setResult(computeQuizResult(nextAnswers));
      setView("result");
    }
  };

  const skipQuestion = () => {
    if (quizStep + 1 < QUIZ_QUESTIONS.length) {
      setQuizStep(quizStep + 1);
    } else {
      setResult(computeQuizResult(answers));
      setView("result");
    }
  };

  const runAutomatedAssignment = () => {
    setResult(computeAutomatedAssignment());
    setAutomatedMsgIndex(0);
    setView("assigning");
  };

  const changeAnswers = () => {
    setResult(null);
    setAnswers({});
    setQuizStep(0);
    setView("question");
  };

  const confirmContinue = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Push 3 scope: acknowledge the diagnostic step only. The recommended
      // class/resonance is not yet written onto the player — see Push 4.
      await completeDiagnosticIntro();
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "done") return null;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]} testID="post-recall-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        {phase === "identity" ? (
          <Animated.View style={[styles.block, { opacity: fadeAnim }]} testID="post-recall-identity">
            <Ionicons name="finger-print" size={36} color={COLORS.brand} />
            <Text style={styles.systemLine}>SYSTEM: Identity record fragmented.</Text>
            <Text style={styles.systemLine}>SYSTEM: Restore designation.</Text>
            <Text style={styles.body}>
              The Lotus Recall preserved you, but not every record. Before the Sanctuary can
              re-open your file, it needs a name to write it under.
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your designation"
              placeholderTextColor={COLORS.onSurfaceTertiary}
              style={styles.input}
              maxLength={24}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={submitIdentity}
              testID="post-recall-name-input"
            />
            <Pressable
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={submitIdentity}
              disabled={submitting}
              testID="post-recall-name-continue"
            >
              <Text style={styles.buttonTxt}>CONFIRM DESIGNATION</Text>
            </Pressable>
          </Animated.View>
        ) : view === "intro" ? (
          <Animated.View style={[styles.block, { opacity: fadeAnim }]} testID="post-recall-diagnostic-intro">
            <Ionicons name="pulse" size={32} color={COLORS.brand} />
            <Text style={styles.systemLine}>SYSTEM: Class resonance detected.</Text>
            <Text style={styles.body}>
              A short diagnostic, {player?.name || "Healer"} — not a test. Five quick scenarios
              recommend a starting pathway and the modern department it resonates with. Nothing
              is permanent; every path keeps evolving as you train.
            </Text>
            <Pressable
              style={[styles.button, { marginTop: SPACING.lg }]}
              onPress={startQuiz}
              testID="post-recall-diagnostic-start"
            >
              <Text style={styles.buttonTxt}>BEGIN DIAGNOSTIC</Text>
            </Pressable>
            <Pressable
              style={styles.automatedBtn}
              onPress={runAutomatedAssignment}
              testID="post-recall-automated-assignment"
            >
              <Ionicons name="shuffle-outline" size={16} color={COLORS.onSurfaceSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.automatedTitle}>Automated Class Assignment</Text>
                <Text style={styles.automatedSubtext}>
                  Let the System assign a starting pathway from unstable soul data.
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        ) : view === "question" ? (
          <Animated.View style={[styles.flex, { opacity: fadeAnim, width: "100%" }]} testID="post-recall-diagnostic">
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              <View style={styles.diagBlock}>
                <View style={styles.progressRow}>
                  {QUIZ_QUESTIONS.map((_, i) => (
                    <View key={i} style={[styles.progressDot, i <= quizStep && { backgroundColor: COLORS.brand }]} />
                  ))}
                </View>
                <Text style={styles.kicker}>{QUIZ_QUESTIONS[quizStep].kicker}</Text>
                <Text style={styles.qTitle}>{QUIZ_QUESTIONS[quizStep].title}</Text>
              </View>
              <View style={{ gap: SPACING.sm, width: "100%" }}>
                {QUIZ_QUESTIONS[quizStep].choices.map((c) => (
                  <Pressable
                    key={c.value}
                    style={styles.answerBtn}
                    testID={`diagnostic-${QUIZ_QUESTIONS[quizStep].id}-answer-${c.value}`}
                    onPress={() => chooseAnswer(c.value)}
                  >
                    <View style={styles.answerIcon}>
                      <Ionicons name={c.icon as any} size={18} color={COLORS.brand} />
                    </View>
                    <Text style={styles.answerText}>{c.label}</Text>
                  </Pressable>
                ))}
                <Pressable style={styles.skipBtn} testID={`diagnostic-skip-${quizStep}`} onPress={skipQuestion}>
                  <Text style={styles.skipTxt}>Skip this question →</Text>
                </Pressable>
                <Pressable
                  style={styles.automatedBtnCompact}
                  onPress={runAutomatedAssignment}
                  testID="post-recall-automated-assignment-inline"
                >
                  <Ionicons name="shuffle-outline" size={14} color={COLORS.onSurfaceTertiary} />
                  <Text style={styles.automatedCompactTxt}>Let the System decide instead</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Animated.View>
        ) : view === "assigning" ? (
          <Animated.View style={[styles.block, { opacity: fadeAnim }]} testID="post-recall-assigning">
            <Ionicons name="hourglass-outline" size={32} color={COLORS.brand} />
            {AUTOMATED_MESSAGES.slice(0, automatedMsgIndex + 1).map((line, i) => (
              <Text key={i} style={styles.systemLine}>{line}</Text>
            ))}
          </Animated.View>
        ) : (
          <Animated.View style={[styles.flex, { opacity: fadeAnim, width: "100%" }]} testID="post-recall-result">
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              {result && (
                <>
                  <View style={styles.diagBlock}>
                    <Text style={[styles.kicker, { color: CLASS_COLOR[result.primaryClass] }]}>
                      {result.automated ? "SYSTEM: CLASS ASSIGNED" : "YOUR RECOMMENDED PATH"}
                    </Text>
                    <View style={styles.resultIcon}>
                      <Ionicons name={CLASS_ICON[result.primaryClass] as any} size={28} color={CLASS_COLOR[result.primaryClass]} />
                    </View>
                    <Text style={styles.pathTitle}>{result.primaryClass}</Text>
                    <Text style={styles.body}>{CLASS_TAGLINE[result.primaryClass]}</Text>
                  </View>
                  <View style={[styles.setupCard, { borderColor: CLASS_COLOR[result.primaryClass] + "40" }]}>
                    <Text style={styles.setupCardTitle}>RECOMMENDED SETUP</Text>
                    <View style={{ gap: SPACING.sm }}>
                      <View style={styles.setupRow}>
                        <Ionicons name="business-outline" size={14} color={COLORS.onSurfaceTertiary} />
                        <Text style={styles.setupLabel}>Modern Department Resonance:</Text>
                        <Text style={styles.setupValue}>{formatResonance(result.primaryResonance)}</Text>
                      </View>
                      <View style={styles.setupRow}>
                        <Ionicons name={CLASS_ICON[result.secondaryClass] as any} size={14} color={COLORS.onSurfaceTertiary} />
                        <Text style={styles.setupLabel}>Second Closest Fit:</Text>
                        <Text style={styles.setupValue}>{result.secondaryClass}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.note}>
                    This is a recommendation, {player?.name || "Healer"} — not a lock. Your class,
                    depth, and pathway keep evolving as you train at the University.
                  </Text>
                  <Pressable
                    style={[styles.button, submitting && styles.buttonDisabled]}
                    onPress={confirmContinue}
                    disabled={submitting}
                    testID="post-recall-diagnostic-continue"
                  >
                    <Text style={styles.buttonTxt}>CONTINUE</Text>
                  </Pressable>
                  {!result.automated && (
                    <Pressable
                      style={styles.secondaryBtn}
                      testID="post-recall-class-change"
                      onPress={changeAnswers}
                    >
                      <Text style={styles.secondaryTxt}>CHANGE ANSWERS</Text>
                    </Pressable>
                  )}
                </>
              )}
            </ScrollView>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  flex: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  scroll: { gap: SPACING.md, paddingVertical: SPACING.lg, alignItems: "center", maxWidth: 420, width: "100%", alignSelf: "center" },
  block: { alignItems: "center", gap: SPACING.md, maxWidth: 380, width: "100%" },
  diagBlock: { alignItems: "center", gap: SPACING.sm, width: "100%" },
  systemLine: { color: COLORS.brand, fontSize: 13, fontWeight: "700", letterSpacing: 0.5, textAlign: "center" },
  kicker: { color: COLORS.brand, fontSize: 11, letterSpacing: 2, fontWeight: "700", textAlign: "center", marginTop: SPACING.xs },
  qTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: "600", textAlign: "center", lineHeight: 27 },
  pathTitle: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300", textAlign: "center" },
  body: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: SPACING.xs },
  note: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18, textAlign: "center" },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    color: COLORS.onSurface,
    fontSize: 15,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
  },
  progressRow: { flexDirection: "row", gap: 6, marginTop: SPACING.sm },
  progressDot: { width: 22, height: 4, borderRadius: 2, backgroundColor: COLORS.border },
  answerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
  },
  answerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.brand + "18",
  },
  resultIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceSecondary,
    marginVertical: SPACING.xs,
  },
  answerText: { color: COLORS.onSurface, fontSize: 14, flex: 1, lineHeight: 20 },
  skipBtn: { alignItems: "center", paddingVertical: SPACING.sm },
  skipTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13 },
  automatedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    width: "100%",
  },
  automatedTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700" },
  automatedSubtext: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 2, lineHeight: 16 },
  automatedBtnCompact: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: SPACING.sm },
  automatedCompactTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  setupCard: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, width: "100%", backgroundColor: COLORS.surfaceSecondary },
  setupCardTitle: { color: COLORS.onSurfaceTertiary, fontSize: 11, letterSpacing: 1.5, fontWeight: "700", marginBottom: SPACING.sm },
  setupRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xs, flexWrap: "wrap" },
  setupLabel: { color: COLORS.onSurfaceTertiary, fontSize: 13 },
  setupValue: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600", flexShrink: 1 },
  button: { backgroundColor: COLORS.brand, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, borderRadius: RADIUS.md, marginTop: SPACING.md, width: "100%", alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
  secondaryBtn: { alignItems: "center", paddingVertical: SPACING.md, marginTop: SPACING.xs },
  secondaryTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 1, fontWeight: "600" },
});
