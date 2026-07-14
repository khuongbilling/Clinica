import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlayer } from "@/src/game/store";
import { completeObjective, markObjectiveXpGranted } from "@/src/game/objectiveProgress";
import { CLASS_IDENTITIES, CLASS_IDS, getClassTree, type ClassId } from "@/src/game/classTree";
import {
  QUIZ_QUESTIONS,
  computeQuizResult,
  computeAutomatedAssignment,
  formatResonance,
  classIdFromFantasyClass,
  fantasyClassFromClassId,
  resonanceForPreview,
  getFuturePathHint,
  CLASS_FLAVOR_TITLE,
  CLASS_WHY_FITS,
  type QuizAnswers,
  type QuizResult,
  type FantasyClass,
} from "@/src/game/classQuiz";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { OnboardingProgressBar } from "@/src/components/onboarding/OnboardingProgressBar";
import { MilestoneReward } from "@/src/components/onboarding/MilestoneReward";
import { SystemPanel } from "@/src/components/onboarding/SystemPanel";

// Post-recall onboarding. Runs immediately after Lotus Recall, before the
// player ever reaches the normal hub, in two resumable sub-steps:
//   1. Identity restoration — a System-styled name input that saves into the
//      same `player.name` field used everywhere else (header, profile).
//   2. Class diagnostic (Push 3 + 4) — a 5-question System personality/career
//      quiz (or an "Automated Class Assignment" shortcut) that recommends a
//      primary class, second-closest fit, and modern department resonance,
//      then (Push 4) a full result screen where the player can accept the
//      recommendation, switch to the second-closest fit, or choose any of
//      the 6 classes manually, and finally REGISTER that choice onto the
//      player via store.confirmClassDiagnostic — the exact same class_tree_id
//      field already read by Profile/PlayerHeader/Class Tree. The choice is
//      explicitly framed as forgiving and non-permanent: it can be freely
//      re-switched later from the Class Tree screen.
//      (Push 5) Once class is confirmed, the player is routed once through
//      the memory-reminiscence scene, then into Clinica University, where
//      Lotus Lessons and the Ch1-5 simulation framing live (see
//      reminiscence.tsx, university/*, lotusLessons.ts, modeHub.ts).
// The screen re-derives which sub-step to show from persisted player flags
// (identity_restored / diagnostic_intro_seen) on every render, so a reload
// or app restart mid-sequence always resumes at the correct step instead of
// getting stuck or skipping ahead.

type DiagnosticView = "intro" | "question" | "assigning" | "result" | "chooser" | "confirming";

const AUTOMATED_MESSAGES = [
  "SYSTEM: Soul resonance unstable.",
  "SYSTEM: Reconstructing from fragmented instinct.",
];

export default function PostRecall() {
  const router = useRouter();
  const { player, applyRewards, completeIdentityRestore, confirmClassDiagnostic } = usePlayer();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  // Push 6 — Profile "Replay Class Diagnostic" reopens this same quiz for a
  // player who already finished onboarding. It always starts on the intro
  // view (ignoring identity/diagnostic_intro_seen), never auto-redirects
  // away, and only ever writes anything if the player explicitly taps
  // REGISTER on the result screen — exactly the same explicit-confirm gate
  // normal onboarding already uses.
  const isReplay = replay === "1";
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Class-diagnostic sub-state (only used within the "diagnostic" phase).
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [view, setView] = useState<DiagnosticView>("intro");
  const [automatedMsgIndex, setAutomatedMsgIndex] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  // Which class is currently being previewed for registration — defaults to
  // the primary recommendation, but can be switched to the second-closest
  // fit or any manually chosen class without losing the original result.
  const [previewClass, setPreviewClass] = useState<FantasyClass | null>(null);
  const [confirmMessages, setConfirmMessages] = useState<string[]>([]);
  const [confirmMsgIndex, setConfirmMsgIndex] = useState(0);
  const confirmFiredRef = useRef(false);

  const phase: "identity" | "diagnostic" | "done" = isReplay
    ? "diagnostic"
    : !player
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
    if (isReplay) return;
    if (phase !== "done") return;
    // Push 5 — after class confirmation, route through the one-time
    // memory-reminiscence scene before the player ever reaches University
    // or the normal hub. Once seen, later visits go straight to the hub.
    if (player && !player.seen_reminiscence) {
      router.replace("/reminiscence");
    } else {
      router.replace("/(tabs)");
    }
  }, [isReplay, phase, player, router]);

  useEffect(() => {
    if (player?.name && player.name !== "Healer") setName(player.name);
  }, [player?.name]);

  // C1: grant obj_diagnostic_done (step 4) the first time the quiz result is shown.
  // This useEffect covers all three paths: answered quiz, skipped quiz, and automated
  // assignment — all three land on view="result" before class confirmation.
  const diagnosticGrantRef = useRef(false);
  useEffect(() => {
    if (isReplay || view !== "result" || diagnosticGrantRef.current) return;
    diagnosticGrantRef.current = true;
    completeObjective("obj_diagnostic_done").then(async (isNew) => {
      if (isNew) {
        await markObjectiveXpGranted("obj_diagnostic_done");
        await applyRewards({ xp: 10, codexShards: 0, crowns: 0, codex: [], enemyId: "", enemyName: "" });
      }
    });
  }, [view, isReplay]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Drives the SYSTEM confirmation message sequence, then actually saves the
  // chosen class. Guarded by confirmFiredRef so the save only fires once per
  // "confirming" entry even if this effect re-runs on re-render.
  useEffect(() => {
    if (view !== "confirming") return;
    if (confirmMsgIndex < confirmMessages.length - 1) {
      const t = setTimeout(() => setConfirmMsgIndex((i) => i + 1), 750);
      return () => clearTimeout(t);
    }
    if (confirmFiredRef.current) return;
    const t = setTimeout(async () => {
      if (!previewClass || !result || confirmFiredRef.current) return;
      confirmFiredRef.current = true;
      setSubmitting(true);
      try {
        await confirmClassDiagnostic(
          classIdFromFantasyClass(previewClass),
          resonanceForPreview(result, previewClass),
          result.secondaryClass,
        );
        // C1: grant obj_class_result (step 5) right after class is confirmed.
        // This fires here (not in /class-result screen) because post-recall
        // routes directly to /reminiscence, bypassing /class-result entirely.
        if (!isReplay) {
          const isNew = await completeObjective("obj_class_result");
          if (isNew) {
            await markObjectiveXpGranted("obj_class_result");
            await applyRewards({ xp: 10, codexShards: 0, crowns: 0, codex: [], enemyId: "", enemyName: "" });
          }
        }
        if (isReplay) router.replace("/(tabs)/profile");
      } finally {
        setSubmitting(false);
      }
    }, 1100);
    return () => clearTimeout(t);
  }, [view, confirmMsgIndex, confirmMessages.length, previewClass, result, confirmClassDiagnostic, isReplay, router]);

  const submitIdentity = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await completeIdentityRestore(name.trim() || "Healer");
      // C1: grant obj_identity_done (step 3) immediately after name is saved.
      const isNew = await completeObjective("obj_identity_done");
      if (isNew) {
        await markObjectiveXpGranted("obj_identity_done");
        await applyRewards({ xp: 10, codexShards: 0, crowns: 0, codex: [], enemyId: "", enemyName: "" });
      }
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
      const r = computeQuizResult(nextAnswers);
      setResult(r);
      setPreviewClass(r.primaryClass);
      setView("result");
    }
  };

  const skipQuestion = () => {
    if (quizStep + 1 < QUIZ_QUESTIONS.length) {
      setQuizStep(quizStep + 1);
    } else {
      const r = computeQuizResult(answers);
      setResult(r);
      setPreviewClass(r.primaryClass);
      setView("result");
    }
  };

  const runAutomatedAssignment = () => {
    const r = computeAutomatedAssignment();
    setResult(r);
    setPreviewClass(r.primaryClass);
    setAutomatedMsgIndex(0);
    setView("assigning");
  };

  const changeAnswers = () => {
    setResult(null);
    setPreviewClass(null);
    setAnswers({});
    setQuizStep(0);
    setView("question");
  };

  const previewSecondFit = () => {
    if (!result) return;
    setPreviewClass(result.secondaryClass);
  };

  const previewRecommended = () => {
    if (!result) return;
    setPreviewClass(result.primaryClass);
  };

  const openChooser = () => setView("chooser");

  const pickManualClass = (id: ClassId) => {
    setPreviewClass(fantasyClassFromClassId(id));
    setView("result");
  };

  const beginConfirm = () => {
    if (!result || !previewClass) return;
    const resonance = resonanceForPreview(result, previewClass);
    const trait = getClassTree(classIdFromFantasyClass(previewClass))[0];
    confirmFiredRef.current = false;
    setConfirmMessages([
      `SYSTEM: Class registered \u2014 ${previewClass}.`,
      `SYSTEM: Initial trait unlocked \u2014 ${trait?.name ?? "Field Readiness"}.`,
      `SYSTEM: Secondary resonance detected \u2014 ${formatResonance(resonance)}.`,
      "SYSTEM: Warning: Insight archive incomplete.",
      "SYSTEM: Recommended correction: Clinica University.",
    ]);
    setConfirmMsgIndex(0);
    setView("confirming");
  };

  if (phase === "done") return null;

  const activeClass = previewClass ?? result?.primaryClass ?? null;
  const activeIsPrimary = !!result && activeClass === result.primaryClass;
  const activeIsSecondary = !!result && activeClass === result.secondaryClass;
  const activeIdentity = activeClass ? CLASS_IDENTITIES[classIdFromFantasyClass(activeClass)] : null;
  const activeResonance = result && activeClass ? resonanceForPreview(result, activeClass) : null;
  const activeTrait = activeClass ? getClassTree(classIdFromFantasyClass(activeClass))[0] : null;
  const activeFuturePath = result && activeClass && activeResonance
    ? getFuturePathHint(activeResonance, activeClass)
    : null;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]} testID="post-recall-screen">
      {/* Clinica healing-academy background: deep jade night sky with lotus warmth */}
      <LinearGradient
        colors={["#0B1628", "#0E2330", "#112B28", "#0F2420"]}
        locations={[0, 0.35, 0.72, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["#1B5C4820", "#C084FC12", "#00000000"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.scrim} pointerEvents="none" />
      {isReplay && (
        <Pressable
          style={styles.replayCloseBtn}
          onPress={() => router.replace("/(tabs)/profile")}
          hitSlop={10}
          testID="post-recall-replay-close"
        >
          <Ionicons name="close" size={18} color={COLORS.onSurfaceSecondary} />
        </Pressable>
      )}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        {phase === "identity" ? (
          <Animated.View style={[styles.identityWrap, { opacity: fadeAnim }]} testID="post-recall-identity">
            {!isReplay && <OnboardingProgressBar step="Identity" />}
            {!isReplay && (
              <MilestoneReward
                title="LOTUS RECALL AWAKENED"
                accent={COLORS.brand}
                items={[
                  { icon: "flower-outline", label: "Memory preserved" },
                  { icon: "refresh-outline", label: "Second chance granted" },
                ]}
              />
            )}
            <View style={styles.identityHeader}>
              <View style={styles.identityBadge}>
                <Ionicons name="finger-print" size={30} color={COLORS.brand} />
              </View>
              <Text style={styles.identityTitle}>Restore Your Designation</Text>
              <SystemPanel icon="finger-print-outline" compact>
                <Text style={styles.systemLine}>Identity record fragmented.</Text>
                <Text style={styles.systemLine}>Restore designation.</Text>
              </SystemPanel>
              <Text style={styles.body}>
                The Lotus Recall preserved you, but not every record. Before the Sanctuary can
                re-open your file, it needs a name to write it under.
              </Text>
            </View>
            <View style={styles.identityForm}>
              <Text style={styles.inputLabel}>ENTER DESIGNATION</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
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
            </View>
          </Animated.View>
        ) : view === "intro" ? (
          <Animated.View style={[styles.block, { opacity: fadeAnim }]} testID="post-recall-diagnostic-intro">
            {!isReplay && <OnboardingProgressBar step="Diagnostic" />}
            <Ionicons name="pulse" size={32} color={COLORS.brand} />
            <SystemPanel icon="pulse-outline" compact>
              <Text style={styles.systemLine}>Class resonance detected.</Text>
            </SystemPanel>
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
          <Animated.View style={[styles.scrollWrap, { opacity: fadeAnim }]} testID="post-recall-diagnostic">
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
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
            <SystemPanel icon="hourglass-outline" compact>
              {AUTOMATED_MESSAGES.slice(0, automatedMsgIndex + 1).map((line, i) => (
                <Text key={i} style={styles.systemLine}>{line.replace(/^SYSTEM:\s*/, "")}</Text>
              ))}
            </SystemPanel>
          </Animated.View>
        ) : view === "chooser" ? (
          <Animated.View style={[styles.scrollWrap, { opacity: fadeAnim }]} testID="post-recall-chooser">
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              <Pressable style={styles.backLink} onPress={() => setView("result")} testID="post-recall-chooser-back">
                <Ionicons name="chevron-back" size={16} color={COLORS.onSurfaceTertiary} />
                <Text style={styles.backLinkTxt}>Back to result</Text>
              </Pressable>
              <Text style={styles.kicker}>SYSTEM: MANUAL OVERRIDE</Text>
              <Text style={styles.qTitle}>Choose a Class</Text>
              <Text style={styles.body}>
                Any of the six pathways is available. This is a starting point, not a lock.
              </Text>
              <View style={styles.classGrid}>
                {CLASS_IDS.map((id) => {
                  const identity = CLASS_IDENTITIES[id];
                  const isActive = activeClass === fantasyClassFromClassId(id);
                  return (
                    <Pressable
                      key={id}
                      style={[
                        styles.classCard,
                        { borderColor: isActive ? identity.color : COLORS.border },
                        isActive && { backgroundColor: identity.color + "18" },
                      ]}
                      onPress={() => pickManualClass(id)}
                      testID={`post-recall-chooser-${id}`}
                    >
                      <View style={[styles.classCardIcon, { backgroundColor: identity.color + "22" }]}>
                        <Ionicons name={identity.icon as any} size={22} color={identity.color} />
                      </View>
                      <Text style={styles.classCardName}>{identity.name}</Text>
                      <Text style={styles.classCardRole} numberOfLines={2}>{identity.role}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </Animated.View>
        ) : view === "confirming" ? (
          <Animated.View style={[styles.block, { opacity: fadeAnim }]} testID="post-recall-confirming">
            <Ionicons name="checkmark-circle-outline" size={32} color={COLORS.brand} />
            <SystemPanel icon="checkmark-circle-outline" compact>
              {confirmMessages.slice(0, confirmMsgIndex + 1).map((line, i) => (
                <Text key={i} style={styles.systemLine}>{line.replace(/^SYSTEM:\s*/, "")}</Text>
              ))}
            </SystemPanel>
            {confirmMsgIndex >= confirmMessages.length - 1 && activeTrait && activeClass && (
              <MilestoneReward
                title="CLASS REGISTERED"
                accent={activeIdentity?.color}
                items={[
                  { icon: (activeIdentity?.icon as any) || "school-outline", label: activeClass },
                  { icon: "sparkles-outline", label: activeTrait.name },
                ]}
              />
            )}
          </Animated.View>
        ) : (
          <Animated.View style={[styles.scrollWrap, { opacity: fadeAnim }]} testID="post-recall-result">
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              {!isReplay && <OnboardingProgressBar step="Class Result" />}
              {result && activeClass && activeIdentity && (
                <>
                  <View style={styles.diagBlock}>
                    <Text style={[styles.kicker, { color: activeIdentity.color }]}>
                      {result.automated && activeIsPrimary
                        ? "SYSTEM: CLASS ASSIGNED"
                        : activeIsPrimary
                        ? "YOUR RECOMMENDED PATH"
                        : activeIsSecondary
                        ? "ALTERNATE RESONANCE"
                        : "MANUAL SELECTION"}
                    </Text>
                    <View style={styles.resultIcon}>
                      <Ionicons name={activeIdentity.icon as any} size={28} color={activeIdentity.color} />
                    </View>
                    <Text style={styles.pathTitle}>{activeClass}</Text>
                    <Text style={styles.flavorTitle}>{CLASS_FLAVOR_TITLE[activeClass]}</Text>
                    <Text style={styles.body}>{CLASS_WHY_FITS[activeClass]}</Text>
                  </View>

                  <View style={[styles.setupCard, { borderColor: activeIdentity.color + "40" }]}>
                    <Text style={styles.setupCardTitle}>SYSTEM ANALYSIS</Text>
                    <View style={{ gap: SPACING.sm }}>
                      <View style={styles.setupRow}>
                        <Ionicons name="business-outline" size={14} color={COLORS.onSurfaceTertiary} />
                        <Text style={styles.setupLabel}>Modern Department Resonance:</Text>
                        <Text style={styles.setupValue}>{formatResonance(activeResonance || "")}</Text>
                      </View>
                      {activeTrait && (
                        <View style={styles.setupRow}>
                          <Ionicons name="sparkles-outline" size={14} color={COLORS.onSurfaceTertiary} />
                          <Text style={styles.setupLabel}>Starting Trait:</Text>
                          <Text style={styles.setupValue}>{activeTrait.name}</Text>
                        </View>
                      )}
                      <View style={styles.setupRow}>
                        <Ionicons name={CLASS_IDENTITIES[classIdFromFantasyClass(result.secondaryClass)].icon as any} size={14} color={COLORS.onSurfaceTertiary} />
                        <Text style={styles.setupLabel}>Second Closest Fit:</Text>
                        <Text style={styles.setupValue}>{result.secondaryClass}</Text>
                      </View>
                      {activeFuturePath && (
                        <View style={styles.setupRow}>
                          <Ionicons name="telescope-outline" size={14} color={COLORS.onSurfaceTertiary} />
                          <Text style={styles.setupLabel}>Future Path Hint:</Text>
                          <Text style={styles.setupValue}>{activeFuturePath}</Text>
                        </View>
                      )}
                    </View>
                    {activeTrait && (
                      <Text style={styles.traitDesc}>{activeTrait.description}</Text>
                    )}
                  </View>

                  <Text style={styles.note}>
                    This is a starting pathway, {player?.name || "Healer"} — not a lock. Your
                    class stays freely re-trainable from the Class Tree, and every future path
                    keeps evolving as you train at the University.
                  </Text>

                  <Pressable
                    style={[styles.button, submitting && styles.buttonDisabled]}
                    onPress={beginConfirm}
                    disabled={submitting}
                    testID="post-recall-register-class"
                  >
                    <Text style={styles.buttonTxt}>
                      {activeIsPrimary ? `ACCEPT \u2014 REGISTER ${activeClass.toUpperCase()}` : `CONFIRM \u2014 REGISTER ${activeClass.toUpperCase()}`}
                    </Text>
                  </Pressable>

                  <View style={{ gap: SPACING.xs, width: "100%", alignItems: "center" }}>
                    {!activeIsSecondary && (
                      <Pressable style={styles.secondaryBtn} testID="post-recall-preview-second-fit" onPress={previewSecondFit}>
                        <Text style={styles.secondaryTxt}>REVIEW SECOND CLOSEST FIT — {result.secondaryClass.toUpperCase()}</Text>
                      </Pressable>
                    )}
                    {!activeIsPrimary && (
                      <Pressable style={styles.secondaryBtn} testID="post-recall-preview-recommended" onPress={previewRecommended}>
                        <Text style={styles.secondaryTxt}>BACK TO RECOMMENDED — {result.primaryClass.toUpperCase()}</Text>
                      </Pressable>
                    )}
                    <Pressable style={styles.secondaryBtn} testID="post-recall-open-chooser" onPress={openChooser}>
                      <Text style={styles.secondaryTxt}>CHOOSE A DIFFERENT CLASS</Text>
                    </Pressable>
                    {!result.automated && (
                      <Pressable style={styles.secondaryBtn} testID="post-recall-class-change" onPress={changeAnswers}>
                        <Text style={styles.secondaryTxt}>CHANGE ANSWERS</Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={styles.automatedBtnCompact}
                      onPress={runAutomatedAssignment}
                      testID="post-recall-automated-assignment-result"
                    >
                      <Ionicons name="shuffle-outline" size={14} color={COLORS.onSurfaceTertiary} />
                      <Text style={styles.automatedCompactTxt}>Automated Class Assignment instead</Text>
                    </Pressable>
                  </View>
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
  replayCloseBtn: {
    position: "absolute", top: SPACING.md, right: SPACING.md, zIndex: 10,
    width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surfaceSecondary,
  },
  flex: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  identityWrap: {
    flex: 1,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: SPACING.xl,
    gap: SPACING.lg,
  },
  identityHeader: { alignItems: "center", gap: SPACING.md, width: "100%" },
  identityBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,175,55,0.12)",
    borderWidth: 1,
    borderColor: COLORS.brand,
  },
  identityTitle: {
    color: COLORS.onSurface,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "300",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  identityForm: { width: "100%", alignItems: "center", gap: SPACING.md },
  scrollWrap: { flex: 1, width: "100%" },
  scrollView: { flex: 1, width: "100%" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,10,14,0.66)" },
  scroll: { gap: SPACING.md, paddingVertical: SPACING.md, alignItems: "center", maxWidth: 460, width: "100%", alignSelf: "center" },
  block: { alignItems: "center", gap: SPACING.md, maxWidth: 380, width: "100%" },
  diagBlock: { alignItems: "center", gap: SPACING.sm, width: "100%" },
  systemLine: { color: COLORS.brand, fontSize: 13, fontWeight: "700", letterSpacing: 0.5, textAlign: "center" },
  kicker: { color: COLORS.brand, fontSize: 11, letterSpacing: 2, fontWeight: "700", textAlign: "center", marginTop: SPACING.xs },
  qTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: "600", textAlign: "center", lineHeight: 27 },
  pathTitle: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300", textAlign: "center", lineHeight: 30 },
  flavorTitle: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "600", textAlign: "center", fontStyle: "italic" },
  body: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: SPACING.xs },
  note: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18, textAlign: "center" },
  input: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: COLORS.brand + "88",
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 4,
    color: COLORS.onSurface,
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: 0.5,
    textAlign: "center",
    marginTop: SPACING.md,
    backgroundColor: "rgba(18,26,34,0.72)",
    shadowColor: COLORS.brand,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  inputLabel: {
    color: COLORS.brand,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "700",
    textAlign: "center",
    marginTop: SPACING.md,
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
  traitDesc: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 17, marginTop: SPACING.sm },
  button: { backgroundColor: COLORS.brand, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, borderRadius: RADIUS.md, marginTop: SPACING.md, width: "100%", alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 1.5, textAlign: "center" },
  secondaryBtn: { alignItems: "center", paddingVertical: SPACING.sm },
  secondaryTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, letterSpacing: 0.5, fontWeight: "600", textAlign: "center" },
  backLink: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  backLinkTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13 },
  classGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, width: "100%", justifyContent: "space-between" },
  classCard: {
    width: "48%",
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.surfaceSecondary,
  },
  classCardIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  classCardName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700" },
  classCardRole: { color: COLORS.onSurfaceTertiary, fontSize: 11, textAlign: "center", lineHeight: 15 },
});
