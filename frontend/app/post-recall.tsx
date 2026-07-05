import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlayer } from "@/src/game/store";
import { QUIZ_QUESTIONS, computeClassProfile, type QuizAnswers } from "@/src/game/classQuiz";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// Post-recall onboarding. Runs immediately after Lotus Recall, before the
// player ever reaches the normal hub, in two resumable sub-steps:
//   1. Identity restoration — a System-styled name input that saves into the
//      same `player.name` field used everywhere else (header, profile).
//   2. Class diagnostic — the "Codex Awakening" quiz. Five choices recommend
//      a starting class/pathway which is applied onto the existing player
//      (aptitude, class tree, learning depth, difficulty, starting hero).
// The screen re-derives which sub-step to show from persisted player flags
// (identity_restored / diagnostic_intro_seen) on every render, so a reload
// or app restart mid-sequence always resumes at the correct step instead of
// getting stuck or skipping ahead.
export default function PostRecall() {
  const router = useRouter();
  const { player, completeIdentityRestore, applyClassDiagnostic } = usePlayer();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Class-diagnostic sub-state (only used within the "diagnostic" phase).
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [showResult, setShowResult] = useState(false);

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
  }, [phase, quizStep, showResult, fadeAnim]);

  useEffect(() => {
    if (phase === "done") router.replace("/(tabs)");
  }, [phase, router]);

  useEffect(() => {
    if (player?.name && player.name !== "Healer") setName(player.name);
  }, [player?.name]);

  const submitIdentity = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await completeIdentityRestore(name.trim() || "Healer");
    } finally {
      setSubmitting(false);
    }
  };

  const chooseAnswer = (value: string) => {
    const q = QUIZ_QUESTIONS[quizStep];
    setAnswers((prev) => ({ ...prev, [q.id]: value }));
    if (quizStep + 1 < QUIZ_QUESTIONS.length) {
      setQuizStep(quizStep + 1);
    } else {
      setShowResult(true);
    }
  };

  const skipQuestion = () => {
    if (quizStep + 1 < QUIZ_QUESTIONS.length) {
      setQuizStep(quizStep + 1);
    } else {
      setShowResult(true);
    }
  };

  const confirmClass = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const p = computeClassProfile(answers);
      await applyClassDiagnostic({
        aptitude: p.aptitude,
        player_class: p.player_class,
        learning_profile: p.learning_profile,
        difficulty: p.difficulty,
        system_affinity: p.system_affinity,
        explanation_style: p.explanation_style,
        codex_depth: p.codex_depth,
      });
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
        ) : !showResult ? (
          <Animated.View style={[styles.flex, { opacity: fadeAnim, width: "100%" }]} testID="post-recall-diagnostic">
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              <View style={styles.diagBlock}>
                {quizStep === 0 && (
                  <>
                    <Ionicons name="pulse" size={32} color={COLORS.brand} />
                    <Text style={styles.systemLine}>SYSTEM: Class resonance detected.</Text>
                    <Text style={styles.body}>
                      A short diagnostic, {player?.name || "Healer"} — not a test. Your choices
                      recommend a starting pathway. Nothing is permanent; every path keeps
                      evolving as you train.
                    </Text>
                  </>
                )}
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
              </View>
            </ScrollView>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.flex, { opacity: fadeAnim, width: "100%" }]} testID="post-recall-result">
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              {(() => {
                const p = computeClassProfile(answers);
                return (
                  <>
                    <View style={styles.diagBlock}>
                      <Text style={[styles.kicker, { color: p.accentColor }]}>YOUR HEALER PATH</Text>
                      <Text style={styles.pathTitle}>{p.pathTitle}</Text>
                      <Text style={styles.body}>{p.classDescription}</Text>
                    </View>
                    <View style={[styles.setupCard, { borderColor: p.accentColor + "40" }]}>
                      <Text style={styles.setupCardTitle}>RECOMMENDED SETUP</Text>
                      <View style={{ gap: SPACING.sm }}>
                        {([
                          { label: "Learning Depth", value: p.profileLabel, icon: "book-outline" },
                          { label: "Challenge", value: p.diffLabel, icon: "shield-half-outline" },
                          { label: "Clinical Style", value: p.clinicalStyle, icon: "pulse-outline" },
                          { label: "First Hero", value: p.firstHero, icon: "person-outline" },
                        ] as const).map(({ label, value, icon }) => (
                          <View key={label} style={styles.setupRow}>
                            <Ionicons name={icon as any} size={14} color={COLORS.onSurfaceTertiary} />
                            <Text style={styles.setupLabel}>{label}:</Text>
                            <Text style={styles.setupValue}>{value}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <Text style={styles.note}>
                      You can change learning depth and difficulty later in Settings, and every
                      pathway keeps evolving as you train at the University.
                    </Text>
                    <Pressable
                      style={[styles.button, submitting && styles.buttonDisabled]}
                      onPress={confirmClass}
                      disabled={submitting}
                      testID="post-recall-class-confirm"
                    >
                      <Text style={styles.buttonTxt}>ENTER THE SANCTUARY</Text>
                    </Pressable>
                    <Pressable
                      style={styles.secondaryBtn}
                      testID="post-recall-class-change"
                      onPress={() => { setShowResult(false); setQuizStep(0); }}
                    >
                      <Text style={styles.secondaryTxt}>CHANGE ANSWERS</Text>
                    </Pressable>
                  </>
                );
              })()}
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
  answerText: { color: COLORS.onSurface, fontSize: 14, flex: 1, lineHeight: 20 },
  skipBtn: { alignItems: "center", paddingVertical: SPACING.sm },
  skipTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13 },
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
