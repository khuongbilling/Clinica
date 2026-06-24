import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APTITUDE_INFO } from "@/src/game/content";
import { APTITUDE_RESULT, CALLING_QUIZ, LEARNING_GOALS, scoreQuiz } from "@/src/game/onboarding";
import { usePlayer } from "@/src/game/store";
import type { Aptitude } from "@/src/game/types";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

type Step = "welcome" | "name" | "quiz" | "result" | "choose" | "goal" | "trial";

export default function Onboarding() {
  const router = useRouter();
  const { createPlayer } = usePlayer();

  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [qIdx, setQIdx] = useState(0);
  const [picks, setPicks] = useState<Aptitude[]>([]);
  const [chosenAptitude, setChosenAptitude] = useState<Aptitude | null>(null);
  const [learningGoalId, setLearningGoalId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recommended = useMemo<Aptitude | null>(() => (picks.length === CALLING_QUIZ.length ? scoreQuiz(picks) : null), [picks]);
  const aptitude = chosenAptitude || recommended;

  const submit = async () => {
    if (!aptitude || !learningGoalId) return;
    const goal = LEARNING_GOALS.find(g => g.id === learningGoalId)!;
    setBusy(true);
    setError(null);
    try {
      await createPlayer({
        name: name.trim() || "Healer",
        aptitude,
        recommended_aptitude: recommended || undefined,
        learning_goal: goal.label,
        learning_profile: goal.id,
        codex_depth: goal.depth,
      });
      // Send player directly into first trial battle
      router.replace({ pathname: "/battle", params: { enemyId: "air_sprite" } });
    } catch (e: any) {
      setError(e?.message || "Could not begin your journey.");
    } finally {
      setBusy(false);
    }
  };

  // ---------- WELCOME ----------
  if (step === "welcome") {
    return (
      <Frame>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>CHAPTER I · THE FADING CORE</Text>
          <Text style={styles.titleXL}>Welcome to{"\n"}Clinica</Text>
          <Text style={styles.lede}>
            The Great Codex has shattered. Disease Corruptions are spreading across the Kingdom of Clinica. Before you enter the Core, the Codex asks one question: what kind of healer calls to you?
          </Text>
        </View>
        <Cta testID="welcome-begin" label="BEGIN CALLING QUIZ" onPress={() => setStep("name")} />
      </Frame>
    );
  }

  // ---------- NAME ----------
  if (step === "name") {
    return (
      <Frame>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>STEP 1 OF 3</Text>
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
        <Cta testID="onboarding-name-continue" label="CONTINUE" disabled={!name.trim()} onPress={() => setStep("quiz")} />
      </Frame>
    );
  }

  // ---------- QUIZ ----------
  if (step === "quiz") {
    const q = CALLING_QUIZ[qIdx];
    return (
      <Frame>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>CALLING QUIZ · QUESTION {qIdx + 1} OF {CALLING_QUIZ.length}</Text>
          <Text style={styles.title}>{q.prompt}</Text>
        </View>
        <View style={{ gap: SPACING.sm }}>
          {q.answers.map((a, i) => (
            <Pressable
              key={i}
              style={styles.answerBtn}
              testID={`quiz-${q.id}-answer-${a.aptitude}`}
              onPress={() => {
                const next = [...picks, a.aptitude];
                setPicks(next);
                if (qIdx + 1 < CALLING_QUIZ.length) {
                  setQIdx(qIdx + 1);
                } else {
                  setStep("result");
                }
              }}
            >
              <View style={styles.answerLetter}><Text style={styles.answerLetterTxt}>{String.fromCharCode(65 + i)}</Text></View>
              <Text style={styles.answerText}>{a.text}</Text>
            </Pressable>
          ))}
        </View>
      </Frame>
    );
  }

  // ---------- RESULT ----------
  if (step === "result" && recommended) {
    const info = APTITUDE_RESULT[recommended];
    const apt = APTITUDE_INFO[recommended];
    return (
      <Frame>
        <View style={styles.heroBlock}>
          <Text style={[styles.kicker, { color: apt.color }]}>YOUR CALLING</Text>
          <Text style={styles.title}>{info.title}</Text>
          <Text style={styles.lede}>{info.body}</Text>
          <View style={[styles.bonusCard, { borderColor: apt.color }]}>
            <Ionicons name={apt.icon as any} size={20} color={apt.color} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bonusLabel, { color: apt.color }]}>{info.bonus}</Text>
              <Text style={styles.bonusHero}>Starting Hero: {info.startingHero}</Text>
            </View>
          </View>
        </View>
        <View style={{ gap: SPACING.sm }}>
          <Cta testID="result-accept" label={`ACCEPT ${apt.title.toUpperCase()}`} onPress={() => { setChosenAptitude(recommended); setStep("goal"); }} />
          <Pressable style={styles.secondaryBtn} onPress={() => setStep("choose")} testID="result-choose-another">
            <Text style={styles.secondaryTxt}>CHOOSE ANOTHER PATH</Text>
          </Pressable>
        </View>
      </Frame>
    );
  }

  // ---------- CHOOSE ANOTHER PATH ----------
  if (step === "choose") {
    return (
      <Frame>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>CHOOSE YOUR PATH</Text>
          <Text style={styles.title}>Four callings.{"\n"}One choice.</Text>
        </View>
        <View style={{ gap: SPACING.sm }}>
          {(Object.keys(APTITUDE_RESULT) as Aptitude[]).map((a) => {
            const info = APTITUDE_RESULT[a];
            const apt = APTITUDE_INFO[a];
            const isRec = recommended === a;
            return (
              <Pressable
                key={a}
                style={[styles.pathCard, { borderColor: apt.color + "60" }]}
                onPress={() => { setChosenAptitude(a); setStep("goal"); }}
                testID={`choose-${a}`}
              >
                <View style={[styles.pathIcon, { borderColor: apt.color }]}>
                  <Ionicons name={apt.icon as any} size={20} color={apt.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.pathName}>{apt.title}</Text>
                    {isRec && <View style={styles.recBadge}><Text style={styles.recBadgeTxt}>RECOMMENDED</Text></View>}
                  </View>
                  <Text style={styles.pathHero}>Starting Hero: {info.startingHero}</Text>
                  <Text style={[styles.pathBonus, { color: apt.color }]}>{info.bonus}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Frame>
    );
  }

  // ---------- LEARNING GOAL ----------
  if (step === "goal") {
    return (
      <Frame>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>BEFORE YOU ENTER</Text>
          <Text style={styles.title}>What brings you{"\n"}to Clinica?</Text>
          <Text style={styles.lede}>The Codex will adjust its lessons to match your journey.</Text>
        </View>
        <View style={{ gap: SPACING.sm }}>
          {LEARNING_GOALS.map((g) => {
            const selected = learningGoalId === g.id;
            return (
              <Pressable
                key={g.id}
                style={[styles.goalCard, selected && { borderColor: COLORS.brand, backgroundColor: COLORS.brand + "12" }]}
                onPress={() => setLearningGoalId(g.id)}
                testID={`goal-${g.id}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.goalText, selected && { color: COLORS.brand }]}>{g.label}</Text>
                  <Text style={styles.goalSub}>{g.sublabel}</Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={20} color={COLORS.brand} />}
              </Pressable>
            );
          })}
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        <Cta testID="goal-continue" label="CONTINUE" disabled={!learningGoalId} onPress={() => setStep("trial")} />
      </Frame>
    );
  }

  // ---------- TRIAL INTRO ----------
  if (step === "trial") {
    return (
      <Frame>
        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>FIRST TRIAL</Text>
          <Text style={styles.titleXL}>The Air{"\n"}Crystal</Text>
          <Text style={styles.lede}>
            Your first corruption weakens the Air system. Watch the clues, reveal what is hidden, and restore Stability before the Air Crystal fades.
          </Text>
          <View style={styles.trialMeta}>
            <View style={styles.trialPill}><Text style={styles.trialPillTxt}>AIR SYSTEM</Text></View>
            <View style={styles.trialPill}><Text style={styles.trialPillTxt}>3 VISIBLE CLUES</Text></View>
            <View style={styles.trialPill}><Text style={styles.trialPillTxt}>1 HIDDEN</Text></View>
          </View>
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        <Cta testID="trial-enter" label={busy ? "..." : "ENTER BATTLE"} disabled={busy} onPress={submit} />
        {busy && <ActivityIndicator color={COLORS.brand} style={{ marginTop: SPACING.sm }} />}
      </Frame>
    );
  }

  return null;
}

// ---------- Reusable bits ----------
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>{children}</ScrollView>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.xl, minHeight: "100%" },
  heroBlock: { gap: SPACING.sm, marginTop: SPACING.lg, flexGrow: 1 },
  kicker: { color: COLORS.brand, fontSize: 11, letterSpacing: 3, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 30, lineHeight: 36, fontWeight: "300" },
  titleXL: { color: COLORS.onSurface, fontSize: 42, lineHeight: 46, fontWeight: "300" },
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

  answerBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  answerLetter: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  answerLetterTxt: { color: COLORS.brand, fontSize: 12, fontWeight: "700" },
  answerText: { color: COLORS.onSurface, fontSize: 15, flex: 1, lineHeight: 20 },

  bonusCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, marginTop: SPACING.md,
  },
  bonusLabel: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  bonusHero: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 4 },

  pathCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1,
  },
  pathIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceTertiary },
  pathName: { color: COLORS.onSurface, fontSize: 16, fontWeight: "600" },
  pathHero: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  pathBonus: { fontSize: 11, marginTop: 4, fontWeight: "500" },
  recBadge: { backgroundColor: COLORS.brand, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.pill },
  recBadgeTxt: { color: COLORS.onBrand, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },

  goalCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md, justifyContent: "space-between",
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  goalText: { color: COLORS.onSurface, fontSize: 14, flex: 1 },
  goalSub: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 3 },

  trialMeta: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md, flexWrap: "wrap" },
  trialPill: { backgroundColor: COLORS.brandTertiary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill },
  trialPillTxt: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  error: { color: COLORS.error, fontSize: 13, textAlign: "center" },
});
