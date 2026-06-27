import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { useTestSession } from "@/src/game/testSession";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── Types ────────────────────────────────────────────────────────────────────

type Step = "welcome" | "name" | "quiz" | "result";

type QuizAnswers = {
  learningGoal: string;   // Q1 → learningProfile
  challenge: string;      // Q2 → difficulty
  healerStyle: string;    // Q3 → playerClass
  fantasyRole: string;    // Q4 → systemAffinity
  learningStyle: string;  // Q5 → explanationStyle
};

type QuizChoice = { label: string; value: string; icon: string };
type QuizQuestion = {
  id: keyof QuizAnswers;
  progress: string;
  kicker: string;
  title: string;
  choices: QuizChoice[];
};

// ── Quiz data ────────────────────────────────────────────────────────────────

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'learningGoal',
    progress: '1 / 5',
    kicker: 'CODEX AWAKENING · LEARNING GOAL',
    title: 'Why did the Codex call you?',
    choices: [
      { label: 'I am curious about medicine and want to learn in a fun way.', value: 'curious', icon: 'bulb-outline' },
      { label: 'I am learning anatomy, physiology, or healthcare basics.', value: 'medical_learner', icon: 'book-outline' },
      { label: 'I am a nursing or healthcare student.', value: 'nursing_student', icon: 'medkit-outline' },
      { label: 'I am preparing for NCLEX or clinical judgment exams.', value: 'nclex', icon: 'clipboard-outline' },
      { label: 'I already work in healthcare and want a light review.', value: 'professional', icon: 'pulse-outline' },
    ],
  },
  {
    id: 'challenge',
    progress: '2 / 5',
    kicker: 'CODEX AWAKENING · CHALLENGE LEVEL',
    title: 'How much guidance do you want in battle?',
    choices: [
      { label: 'Guide me closely. I am new.', value: 'guided', icon: 'compass-outline' },
      { label: 'Give me some clues, but let me think.', value: 'standard', icon: 'shield-half-outline' },
      { label: 'Hide more clues so I can practice reasoning.', value: 'clinical', icon: 'eye-outline' },
      { label: 'Make it like clinical judgment. I want to assess first.', value: 'nclex', icon: 'clipboard-outline' },
      { label: 'Challenge me with changing conditions later.', value: 'expert_later', icon: 'trending-up-outline' },
    ],
  },
  {
    id: 'healerStyle',
    progress: '3 / 5',
    kicker: 'CODEX AWAKENING · HEALER STYLE',
    title: 'When a patient is in danger, what do you do first?',
    choices: [
      { label: 'Protect them and buy time.', value: 'Guardian', icon: 'shield-outline' },
      { label: 'Look for clues before acting.', value: 'Seer', icon: 'search-outline' },
      { label: 'Treat the main problem quickly.', value: 'Interventionist', icon: 'flash-outline' },
      { label: 'Coordinate the team and resources.', value: 'Coordinator', icon: 'people-outline' },
      { label: 'Prevent harm before it happens.', value: 'Protector', icon: 'lock-closed-outline' },
    ],
  },
  {
    id: 'fantasyRole',
    progress: '4 / 5',
    kicker: 'CODEX AWAKENING · BODY-SYSTEM AFFINITY',
    title: 'Which healer path calls to you?',
    choices: [
      { label: 'Air Temple Guardian — breathing and oxygenation.', value: 'Air', icon: 'partly-sunny-outline' },
      { label: 'River Gate Healer — circulation and flow.', value: 'River', icon: 'water-outline' },
      { label: 'Fire Ward Purifier — infection and inflammation.', value: 'Fire', icon: 'flame-outline' },
      { label: 'Energy Shrine Alchemist — glucose, fuel, and balance.', value: 'Energy', icon: 'battery-charging-outline' },
      { label: 'Mind Lantern Guide — mental status and safety.', value: 'Mind', icon: 'moon-outline' },
    ],
  },
  {
    id: 'learningStyle',
    progress: '5 / 5',
    kicker: 'CODEX AWAKENING · LEARNING STYLE',
    title: 'How do you like to learn?',
    choices: [
      { label: 'Simple story first, medical meaning after.', value: 'fantasy_first', icon: 'book-outline' },
      { label: 'Visual examples and short definitions.', value: 'visual_medical', icon: 'images-outline' },
      { label: 'Clinical reasoning and patient care steps.', value: 'clinical_reasoning', icon: 'list-outline' },
      { label: 'NCLEX-style cues, priorities, and rationales.', value: 'nclex_judgment', icon: 'checkmark-circle-outline' },
      { label: 'Brief professional terms without too much explanation.', value: 'professional_brief', icon: 'speedometer-outline' },
    ],
  },
];

// ── Mapping helpers ──────────────────────────────────────────────────────────

const CLASS_APTITUDE: Record<string, string> = {
  Guardian: 'guardian',
  Seer: 'sage',
  Interventionist: 'guardian',
  Coordinator: 'warden',
  Protector: 'warden',
};

const CLASS_APTITUDE_HERO: Record<string, string> = {
  guardian: 'Novice Guardian',
  sage: 'Apprentice Seer',
  warden: 'Junior Warden',
};

const CLASS_CLINICAL: Record<string, string> = {
  Guardian: 'Stabilization and patient safety',
  Seer: 'Assessment and cue recognition',
  Interventionist: 'Targeted intervention and decisive action',
  Coordinator: 'Care coordination and resource use',
  Protector: 'Prevention, safety, and harm reduction',
};

const CLASS_DESCRIPTION: Record<string, string> = {
  Guardian: 'You protect patients by keeping them stable, reading clues, and restoring breath when the windways tighten.',
  Seer: 'You see what others miss — revealing hidden clues and understanding patterns before acting.',
  Interventionist: 'You act decisively once the priority is clear. Speed and precision are your strengths.',
  Coordinator: 'You manage flow, resources, and priorities under pressure. The team moves with you.',
  Protector: 'You prevent harm before it arrives. Safety, barriers, and vigilance define your path.',
};

const SYSTEM_LABEL: Record<string, string> = {
  Air: 'Air Temple',
  River: 'River',
  Fire: 'Fire Ward',
  Energy: 'Energy Shrine',
  Mind: 'Mind Lantern',
};

const SYSTEM_COLOR: Record<string, string> = {
  Air: '#4CA8E8',
  River: '#3B9FD8',
  Fire: '#E87A4C',
  Energy: '#F5C842',
  Mind: '#B48AE8',
};

const PROFILE_LABEL: Record<string, string> = {
  curious: 'Curious Learner',
  medical_learner: 'Medical Learner',
  nursing_student: 'Nursing Student',
  nclex: 'NCLEX Preparer',
  professional: 'Healthcare Professional',
};

const PROFILE_DEPTH: Record<string, string> = {
  curious: 'simple',
  medical_learner: 'simple',
  nursing_student: 'nursing',
  nclex: 'nclex',
  professional: 'professional',
};

const DIFF_LABEL: Record<string, string> = {
  guided: 'Guided — More clues visible',
  standard: 'Standard — Balanced challenge',
  clinical: 'Clinical — Fewer hints, more reasoning',
  nclex: 'NCLEX — All clues hidden',
  expert_later: 'Clinical (Expert unlocks later)',
};

const DIFF_VALUE: Record<string, string> = {
  guided: 'guided',
  standard: 'standard',
  clinical: 'clinical',
  nclex: 'nclex',
  expert_later: 'clinical',
};

const DEFAULTS: QuizAnswers = {
  learningGoal: 'curious',
  challenge: 'guided',
  healerStyle: 'Guardian',
  fantasyRole: 'Air',
  learningStyle: 'fantasy_first',
};

// ── Main component ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const router = useRouter();
  const { createPlayer } = usePlayer();
  const { logEvent, updateProfile } = useTestSession();

  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    logEvent('game_opened', 'onboarding');
    logEvent('opening_hook_viewed', 'onboarding');
  }, []);

  const finalAnswers: QuizAnswers = { ...DEFAULTS, ...answers };

  const pathTitle = `${SYSTEM_LABEL[finalAnswers.fantasyRole] ?? finalAnswers.fantasyRole} ${finalAnswers.healerStyle}`;
  const aptitude = CLASS_APTITUDE[finalAnswers.healerStyle] || 'guardian';
  const difficulty = DIFF_VALUE[finalAnswers.challenge] || finalAnswers.challenge;
  const accentColor = SYSTEM_COLOR[finalAnswers.fantasyRole] || COLORS.brand;

  const submit = async (ans: QuizAnswers) => {
    setBusy(true);
    setError(null);
    const apt = CLASS_APTITUDE[ans.healerStyle] || 'guardian';
    const diff = DIFF_VALUE[ans.challenge] || ans.challenge;
    try {
      await createPlayer({
        name: name.trim() || "Healer",
        aptitude: apt,
        learning_profile: ans.learningGoal,
        difficulty: diff,
        player_class: ans.healerStyle,
        system_affinity: ans.fantasyRole,
        explanation_style: ans.learningStyle,
        codex_depth: PROFILE_DEPTH[ans.learningGoal] || 'simple',
      });
      logEvent('learning_profile_selected', 'onboarding', { meta: { profile: ans.learningGoal } });
      updateProfile(ans.learningGoal);
      router.replace({ pathname: "/battle", params: { enemyId: "air_sprite" } });
    } catch (e: any) {
      setError(e?.message || "Could not begin your journey.");
    } finally {
      setBusy(false);
    }
  };

  const quickStart = async () => {
    await submit(DEFAULTS);
  };

  // ---------- WELCOME ----------
  if (step === "welcome") {
    return (
      <Frame>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>CHAPTER I · THE FADING CORE</Text>
          <Text style={styles.titleXL}>The Kingdom{"\n"}is Alive</Text>
          <View style={styles.openingLines}>
            {["Air breathes.", "River circulates.", "Fire defends.", "Energy fuels.", "Mind guides.", "Protection guards."].map((l) => (
              <Text key={l} style={styles.openingLine}>{l}</Text>
            ))}
          </View>
          <Text style={styles.lede}>
            But disease corruption is spreading.{"\n\n"}
            Lead your healer team. Read the clues. Keep the patient stable. Restore the body one battle at a time.
          </Text>
          <Text style={styles.tagline}>Fight disease. Restore the body. Learn medicine through play.</Text>
          <View style={styles.audienceRow}>
            {[
              { icon: "game-controller", label: "RPG fans" },
              { icon: "heart",           label: "Nursing students" },
              { icon: "bulb",            label: "Curious minds" },
              { icon: "clipboard",       label: "NCLEX learners" },
            ].map(({ icon, label }) => (
              <View key={label} style={styles.audienceChip}>
                <Ionicons name={icon as any} size={12} color={COLORS.brand} />
                <Text style={styles.audienceChipTxt}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ gap: SPACING.sm }}>
          <Cta testID="welcome-begin" label="BEGIN HEALING" onPress={() => setStep("name")} />
          <Pressable style={styles.secondaryBtn} onPress={quickStart} testID="welcome-quickstart">
            <Text style={styles.secondaryTxt}>QUICK START</Text>
          </Pressable>
        </View>
      </Frame>
    );
  }

  // ---------- NAME ----------
  if (step === "name") {
    return (
      <Frame>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>STEP 1 OF 2</Text>
          <Text style={styles.title}>Name your healer</Text>
          <Text style={styles.lede}>The Codex will remember the name you carry into Clinica.</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your healer name"
            placeholderTextColor={COLORS.onSurfaceTertiary}
            style={styles.input}
            maxLength={24}
            autoFocus
            testID="onboarding-name-input"
          />
        </View>
        <View style={{ gap: SPACING.sm }}>
          <Cta testID="onboarding-name-continue" label="CONTINUE" disabled={!name.trim()} onPress={() => { setQuizStep(0); setStep("quiz"); }} />
          <Pressable style={styles.secondaryBtn} onPress={() => { setName("Healer"); setQuizStep(0); setStep("quiz"); }}>
            <Text style={styles.secondaryTxt}>SKIP NAME</Text>
          </Pressable>
        </View>
      </Frame>
    );
  }

  // ---------- QUIZ (5 questions) ----------
  if (step === "quiz") {
    const q = QUIZ_QUESTIONS[quizStep];
    return (
      <Frame>
        <View style={styles.heroBlock}>
          <View style={styles.progressRow}>
            {QUIZ_QUESTIONS.map((_, i) => (
              <View key={i} style={[styles.progressDot, i <= quizStep && { backgroundColor: COLORS.brand }]} />
            ))}
          </View>
          <Text style={styles.kicker}>{q.kicker}</Text>
          <Text style={styles.title}>{q.title}</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm, paddingBottom: SPACING.lg }}>
          {q.choices.map((c) => (
            <Pressable
              key={c.value}
              style={styles.answerBtn}
              testID={`quiz-${q.id}-answer-${c.value}`}
              onPress={() => {
                const next = { ...answers, [q.id]: c.value };
                setAnswers(next);
                if (quizStep + 1 < QUIZ_QUESTIONS.length) {
                  setQuizStep(quizStep + 1);
                } else {
                  setStep("result");
                }
              }}
            >
              <View style={styles.answerIcon}>
                <Ionicons name={c.icon as any} size={18} color={COLORS.brand} />
              </View>
              <Text style={styles.answerText}>{c.label}</Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.skipBtn}
            testID={`quiz-skip-${quizStep}`}
            onPress={() => {
              if (quizStep + 1 < QUIZ_QUESTIONS.length) {
                setQuizStep(quizStep + 1);
              } else {
                setStep("result");
              }
            }}
          >
            <Text style={styles.skipTxt}>Skip this question →</Text>
          </Pressable>
        </ScrollView>
      </Frame>
    );
  }

  // ---------- RESULT ----------
  if (step === "result") {
    const isAirAffinityMismatch = finalAnswers.fantasyRole !== 'Air';
    return (
      <Frame>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.md, paddingBottom: SPACING.lg }}>
          <View style={styles.heroBlock}>
            <Text style={[styles.kicker, { color: accentColor }]}>YOUR HEALER PATH</Text>
            <Text style={styles.titleXL}>{pathTitle}</Text>
            <Text style={styles.lede}>{CLASS_DESCRIPTION[finalAnswers.healerStyle]}</Text>
          </View>

          {/* Recommended Setup Cards */}
          <View style={[styles.setupCard, { borderColor: accentColor + "40" }]}>
            <Text style={styles.setupCardTitle}>RECOMMENDED SETUP</Text>
            <View style={{ gap: SPACING.sm }}>
              {([
                { label: 'Learning Depth', value: PROFILE_LABEL[finalAnswers.learningGoal] || finalAnswers.learningGoal, icon: 'book-outline' },
                { label: 'Challenge', value: DIFF_LABEL[finalAnswers.challenge] || finalAnswers.challenge, icon: 'shield-half-outline' },
                { label: 'Clinical Style', value: CLASS_CLINICAL[finalAnswers.healerStyle] || '', icon: 'pulse-outline' },
                { label: 'First Hero', value: CLASS_APTITUDE_HERO[aptitude] || 'Novice Guardian', icon: 'person-outline' },
              ] as const).map(({ label, value, icon }) => (
                <View key={label} style={styles.setupRow}>
                  <Ionicons name={icon as any} size={14} color={COLORS.onSurfaceTertiary} />
                  <Text style={styles.setupLabel}>{label}:</Text>
                  <Text style={styles.setupValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Non-Air system affinity note */}
          {isAirAffinityMismatch && (
            <View style={styles.affinityNote}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.brand} />
              <Text style={styles.affinityNoteText}>
                Your chosen path will grow stronger after the Air Temple. First mission: Restore the Air Temple.
              </Text>
            </View>
          )}

          {/* Expert note */}
          {finalAnswers.challenge === 'expert_later' && (
            <View style={styles.affinityNote}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.brand} />
              <Text style={styles.affinityNoteText}>
                Expert mode unlocks after your first missions. Starting at Clinical difficulty.
              </Text>
            </View>
          )}

          <Text style={styles.settingsNote}>
            You can change learning depth and difficulty later in Settings.
          </Text>

          {error && <Text style={styles.error}>{error}</Text>}

          <Cta
            testID="result-begin"
            label={busy ? "..." : "BEGIN FIRST MISSION"}
            disabled={busy}
            onPress={() => submit(finalAnswers)}
          />
          {busy && <ActivityIndicator color={COLORS.brand} style={{ marginTop: SPACING.sm }} />}
          <Pressable
            style={styles.secondaryBtn}
            testID="result-change-answers"
            onPress={() => { setQuizStep(0); setStep("quiz"); }}
          >
            <Text style={styles.secondaryTxt}>CHANGE ANSWERS</Text>
          </Pressable>
        </ScrollView>
      </Frame>
    );
  }

  return null;
}

// ── Reusable components ──────────────────────────────────────────────────────

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.scroll}>{children}</View>
    </SafeAreaView>
  );
}

function Cta({ label, onPress, disabled, testID }: { label: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.cta, disabled && { opacity: 0.4 }]} testID={testID}>
      <LinearGradient colors={[COLORS.brand, COLORS.brandSecondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <Text style={styles.ctaText}>{label}</Text>
    </Pressable>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { flex: 1, padding: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.lg, justifyContent: "space-between" },
  heroBlock: { gap: SPACING.sm, flex: 1, justifyContent: "center" },
  kicker: { color: COLORS.brand, fontSize: 11, letterSpacing: 3, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 30, lineHeight: 36, fontWeight: "300" },
  titleXL: { color: COLORS.onSurface, fontSize: 38, lineHeight: 44, fontWeight: "300" },
  lede: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 22, marginTop: SPACING.sm },
  input: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    color: COLORS.onSurface, fontSize: 17, borderWidth: 1, borderColor: COLORS.border,
    marginTop: SPACING.md,
  },
  cta: { height: 56, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  ctaText: { color: COLORS.onBrand, fontSize: 14, fontWeight: "700", letterSpacing: 3 },
  secondaryBtn: { height: 50, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.borderStrong },
  secondaryTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  skipBtn: { alignItems: "center", paddingVertical: SPACING.sm },
  skipTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 0.5 },

  progressRow: { flexDirection: "row", gap: 6, marginBottom: SPACING.sm },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.borderStrong },

  answerBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  answerIcon: {
    width: 36, height: 36, borderRadius: 6, backgroundColor: COLORS.brandTertiary,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  answerText: { color: COLORS.onSurface, fontSize: 14, flex: 1, lineHeight: 20 },

  setupCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1,
  },
  setupCardTitle: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700", marginBottom: SPACING.sm },
  setupRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
  setupLabel: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  setupValue: { color: COLORS.onSurface, fontSize: 12, fontWeight: "600", flex: 1 },

  affinityNote: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    backgroundColor: COLORS.brand + "10", borderRadius: 4,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.brand + "30",
    borderLeftWidth: 3, borderLeftColor: COLORS.brand,
  },
  affinityNoteText: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19, flex: 1 },

  settingsNote: { color: COLORS.onSurfaceTertiary, fontSize: 12, textAlign: "center", fontStyle: "italic" },
  error: { color: COLORS.error, fontSize: 13, textAlign: "center" },

  openingLines: { gap: 2, marginVertical: SPACING.sm },
  openingLine: { color: COLORS.onSurfaceSecondary, fontSize: 14, fontStyle: "italic", letterSpacing: 0.3 },
  tagline: { color: COLORS.brand, fontSize: 11, fontStyle: "italic", letterSpacing: 0.5, marginTop: SPACING.sm },

  audienceRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.md },
  audienceChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: COLORS.brand + "14", borderRadius: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.brand + "40",
  },
  audienceChipTxt: { color: COLORS.brand, fontSize: 10, fontWeight: "600", letterSpacing: 0.3 },
});
