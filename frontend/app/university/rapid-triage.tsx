import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { useTutorial, useHighlightTarget } from "@/src/game/tutorialStore";

// ── Types ────────────────────────────────────────────────────────────────────

type TriageCategory = "emergency" | "urgent" | "stable";

interface TriageCase {
  id: string;
  name: string;
  age: number;
  sex: string;
  complaint: string;
  vitals: { label: string; value: string; alert: boolean }[];
  correct: TriageCategory;
  explanation: string;
  clinicalKey: string;
}

// ── Case data ─────────────────────────────────────────────────────────────────

const TRIAGE_CASES: TriageCase[] = [
  {
    id: "case_laceration",
    name: "Fang",
    age: 34,
    sex: "M",
    complaint: "Deep hand laceration from broken glass. Bleeding slowing with direct pressure. Alert and cooperative.",
    vitals: [
      { label: "HR", value: "96", alert: false },
      { label: "RR", value: "16", alert: false },
      { label: "SpO₂", value: "99%", alert: false },
      { label: "Temp", value: "36.9°C", alert: false },
    ],
    correct: "urgent",
    explanation: "Controlled bleeding with stable vitals. Needs wound assessment and suturing within 30 minutes, but not life-threatening right now.",
    clinicalKey: "Controlled haemorrhage → Urgent, not Emergency",
  },
  {
    id: "case_stroke",
    name: "Jin",
    age: 78,
    sex: "M",
    complaint: "Sudden right-sided weakness and slurred speech. Family says he collapsed 20 minutes ago. Cannot hold his arm up.",
    vitals: [
      { label: "HR", value: "82", alert: false },
      { label: "BP", value: "178/104", alert: true },
      { label: "SpO₂", value: "96%", alert: true },
      { label: "GCS", value: "13/15", alert: true },
    ],
    correct: "emergency",
    explanation: "Classic stroke presentation — FAST positive. Hypertensive, reduced GCS. Every minute matters for brain tissue. This is a time-critical emergency.",
    clinicalKey: "FAST positive + hypertension → Emergency",
  },
  {
    id: "case_anaphylaxis",
    name: "Xiao",
    age: 7,
    sex: "F",
    complaint: "Hives spreading across chest and face after eating peanuts at a school event. Throat feels 'tight'. Wheezing audible.",
    vitals: [
      { label: "HR", value: "134", alert: true },
      { label: "RR", value: "32", alert: true },
      { label: "SpO₂", value: "92%", alert: true },
      { label: "Temp", value: "37.0°C", alert: false },
    ],
    correct: "emergency",
    explanation: "Anaphylaxis with airway compromise. Tachycardia, tachypnoea, low O₂ saturation, and audible wheeze. Adrenaline is needed immediately.",
    clinicalKey: "Airway compromise + SpO₂ 92% → Emergency",
  },
  {
    id: "case_back_pain",
    name: "Chen",
    age: 44,
    sex: "M",
    complaint: "Lower back pain for 3 days after moving furniture. Worse with bending. No radiation, no incontinence. Walking slowly.",
    vitals: [
      { label: "HR", value: "78", alert: false },
      { label: "RR", value: "14", alert: false },
      { label: "SpO₂", value: "99%", alert: false },
      { label: "Temp", value: "36.5°C", alert: false },
    ],
    correct: "stable",
    explanation: "Mechanical back pain with no red flags. Vitals fully normal. Analgesia and assessment can happen in standard queue — no immediate risk.",
    clinicalKey: "No red flags + normal vitals → Stable",
  },
  {
    id: "case_uti",
    name: "Zhu",
    age: 19,
    sex: "F",
    complaint: "Burning urination and increased frequency for 2 days. Mild lower abdominal pressure. No fever, no flank pain.",
    vitals: [
      { label: "HR", value: "72", alert: false },
      { label: "RR", value: "14", alert: false },
      { label: "SpO₂", value: "99%", alert: false },
      { label: "Temp", value: "36.6°C", alert: false },
    ],
    correct: "stable",
    explanation: "Uncomplicated UTI signs with no systemic involvement. No fever, no flank pain to suggest pyelonephritis. Can wait for routine assessment.",
    clinicalKey: "Afebrile UTI, no systemic signs → Stable",
  },
];

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORIES: {
  id: TriageCategory;
  label: string;
  sub: string;
  color: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  targetId: string;
}[] = [
  {
    id: "emergency",
    label: "Emergency",
    sub: "Immediate threat",
    color: "#EF4444",
    icon: "flash",
    targetId: "triage_emergency",
  },
  {
    id: "urgent",
    label: "Urgent",
    sub: "Needs care soon",
    color: "#F59E0B",
    icon: "alert-circle",
    targetId: "triage_urgent",
  },
  {
    id: "stable",
    label: "Stable",
    sub: "Can wait safely",
    color: "#22C55E",
    icon: "checkmark-circle",
    targetId: "triage_stable",
  },
];

// ── Category button ───────────────────────────────────────────────────────────

function CategoryBtn({
  cat,
  disabled,
  onSelect,
}: {
  cat: (typeof CATEGORIES)[0];
  disabled: boolean;
  onSelect: (id: TriageCategory) => void;
}) {
  const { isHighlighted, onTargetPress, highlightStyle } = useHighlightTarget(cat.targetId);
  const scaleAnim = useMemo(() => new Animated.Value(1), []);

  const handlePress = useCallback(() => {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 70, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    if (isHighlighted) onTargetPress();
    onSelect(cat.id);
  }, [disabled, isHighlighted, onTargetPress, onSelect, cat.id, scaleAnim]);

  return (
    <Animated.View style={[{ flex: 1 }, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        style={[
          styles.catBtn,
          { borderColor: cat.color + "40" },
          disabled && styles.catBtnDisabled,
          isHighlighted && styles.catBtnHighlight,
          highlightStyle,
        ]}
        onPress={handlePress}
        testID={`triage-btn-${cat.id}`}
      >
        <View style={[styles.catIconWrap, { backgroundColor: cat.color + "20" }]}>
          <Ionicons name={cat.icon} size={20} color={cat.color} />
        </View>
        <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label}</Text>
        <Text style={styles.catSub}>{cat.sub}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

type Phase = "playing" | "feedback" | "complete";

export default function RapidTriageScreen() {
  const router = useRouter();
  const { startTutorial, isCompleted, activeTutorialId } = useTutorial();

  const [caseIndex, setCaseIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [lastChoice, setLastChoice] = useState<TriageCategory | null>(null);
  const [feedbackAnim] = useState(new Animated.Value(0));

  const currentCase = TRIAGE_CASES[caseIndex];
  const isCorrect = lastChoice === currentCase?.correct;
  const totalCases = TRIAGE_CASES.length;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isCompleted("rapidTriageIntro") && !activeTutorialId) {
        startTutorial("rapidTriageIntro");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const handleSelect = useCallback(
    (choice: TriageCategory) => {
      if (phase !== "playing") return;
      setLastChoice(choice);
      if (choice === currentCase.correct) {
        setScore((s) => s + 1);
      }
      setPhase("feedback");
      Animated.timing(feedbackAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    },
    [phase, currentCase, feedbackAnim],
  );

  const handleNext = useCallback(() => {
    if (caseIndex + 1 >= totalCases) {
      setPhase("complete");
    } else {
      setCaseIndex((i) => i + 1);
      setLastChoice(null);
      setPhase("playing");
      feedbackAnim.setValue(0);
    }
  }, [caseIndex, totalCases, feedbackAnim]);

  const correctCat = CATEGORIES.find((c) => c.id === currentCase?.correct);

  if (phase === "complete") {
    const grade =
      score === 5
        ? { label: "Excellent", color: "#2DD4BF", icon: "trophy" as const }
        : score >= 3
          ? { label: "Good", color: "#22C55E", icon: "checkmark-done" as const }
          : { label: "Keep Practising", color: "#F59E0B", icon: "refresh" as const };

    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <LinearGradient
          colors={["#1C1207", "#100D02", COLORS.surface]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} hitSlop={10}>
            <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
          </Pressable>
          <Text style={styles.kicker}>RAPID TRIAGE · COMPLETE</Text>
        </View>
        <View style={styles.completeBody}>
          <View style={[styles.completeIcon, { borderColor: grade.color + "50" }]}>
            <Ionicons name={grade.icon} size={34} color={grade.color} />
          </View>
          <Text style={[styles.gradeLabel, { color: grade.color }]}>{grade.label}</Text>
          <Text style={styles.scoreDisplay}>
            {score} / {totalCases}
          </Text>
          <Text style={styles.scoreCaption}>cases correctly triaged</Text>
          <View style={styles.completeDivider} />
          <Text style={styles.completeLearning}>
            Speed matters in triage — but accuracy saves lives. Every wrong categorisation either delays someone who can't wait, or wastes a resus bay on someone who can.
          </Text>
          <Pressable
            style={styles.completeBtn}
            onPress={() => goBack(router, "/university")}
            testID="rapid-triage-finish"
          >
            <Text style={styles.completeBtnTxt}>Return to University</Text>
            <Ionicons name="arrow-forward" size={14} color="#0B1A18" />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#1C1207", "#100D02", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/university")}
          hitSlop={10}
          testID="rapid-triage-back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <Text style={styles.kicker}>RAPID TRIAGE</Text>
        <Text style={styles.progress}>
          {caseIndex + 1}/{totalCases}
        </Text>
      </View>

      {/* Case dots */}
      <View style={styles.dots}>
        {TRIAGE_CASES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < caseIndex && styles.dotDone,
              i === caseIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Patient card */}
        <View style={styles.patientCard}>
          <LinearGradient
            colors={["#1E1A0E", "#171308"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.patientRow}>
            <View style={styles.patientAvatar}>
              <Ionicons name="person" size={22} color={COLORS.brand} />
            </View>
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>
                {currentCase.name}, {currentCase.age}
              </Text>
              <Text style={styles.patientMeta}>
                {currentCase.sex} · Presenting now
              </Text>
            </View>
            {phase === "feedback" && correctCat && (
              <View style={[styles.answerBadge, { borderColor: (isCorrect ? correctCat.color : "#EF4444") + "60" }]}>
                <Ionicons
                  name={isCorrect ? "checkmark" : "close"}
                  size={12}
                  color={isCorrect ? correctCat.color : "#EF4444"}
                />
                <Text style={[styles.answerBadgeTxt, { color: isCorrect ? correctCat.color : "#EF4444" }]}>
                  {isCorrect ? "Correct" : "Incorrect"}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.complaint}>{currentCase.complaint}</Text>

          <View style={styles.vitalStrip}>
            {currentCase.vitals.map((v) => (
              <View key={v.label} style={styles.vitalItem}>
                <Text style={styles.vitalLabel}>{v.label}</Text>
                <Text style={[styles.vitalValue, v.alert && styles.vitalAlert]}>
                  {v.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Category buttons */}
        <Text style={styles.prompt}>
          {phase === "playing" ? "How urgently does this patient need care?" : ""}
        </Text>

        <View style={styles.catRow}>
          {CATEGORIES.map((cat) => (
            <CategoryBtn
              key={cat.id}
              cat={cat}
              disabled={phase !== "playing"}
              onSelect={handleSelect}
            />
          ))}
        </View>

        {/* Feedback panel */}
        {phase === "feedback" && correctCat && (
          <Animated.View style={[styles.feedbackCard, { opacity: feedbackAnim }]}>
            <LinearGradient
              colors={
                isCorrect
                  ? [correctCat.color + "18", correctCat.color + "08"]
                  : ["#EF444418", "#EF444408"]
              }
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.feedbackTop}>
              <Ionicons
                name={isCorrect ? "checkmark-circle" : "close-circle"}
                size={18}
                color={isCorrect ? correctCat.color : "#EF4444"}
              />
              <Text style={[styles.feedbackVerdict, { color: isCorrect ? correctCat.color : "#EF4444" }]}>
                {isCorrect
                  ? `${correctCat.label} — correct.`
                  : `${CATEGORIES.find((c) => c.id === lastChoice)?.label} was not right.`}
              </Text>
            </View>
            {!isCorrect && (
              <Text style={styles.feedbackCorrectHint}>
                Correct: <Text style={{ color: correctCat.color, fontWeight: "700" }}>{correctCat.label}</Text>
              </Text>
            )}
            <Text style={styles.feedbackExplanation}>{currentCase.explanation}</Text>
            <Text style={styles.feedbackKey}>{currentCase.clinicalKey}</Text>

            <Pressable
              style={[styles.nextBtn, { backgroundColor: correctCat.color }]}
              onPress={handleNext}
              testID="triage-next"
            >
              <Text style={styles.nextBtnTxt}>
                {caseIndex + 1 < totalCases ? "Next Patient" : "See Results"}
              </Text>
              <Ionicons name="arrow-forward" size={14} color={COLORS.surface} />
            </Pressable>
          </Animated.View>
        )}

        {/* Score footer */}
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLbl}>Score</Text>
          <Text style={styles.scoreVal}>
            {score} / {caseIndex + (phase === "feedback" ? 1 : 0)} so far
          </Text>
        </View>

        <Pressable
          style={styles.backToUni}
          onPress={() => goBack(router, "/university")}
          testID="rapid-triage-return"
        >
          <Ionicons name="chevron-back" size={15} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.backToUniTxt}>Back to University</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  kicker: {
    color: COLORS.brand,
    fontSize: 10, fontWeight: "700", letterSpacing: 2, flex: 1,
  },
  progress: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12, fontWeight: "600",
  },

  dots: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  dot: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  dotActive: { backgroundColor: COLORS.brand },
  dotDone: { backgroundColor: COLORS.brandSecondary },

  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.md,
  },

  patientCard: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  patientRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
  },
  patientAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.brandTertiary,
    borderWidth: 1.5, borderColor: COLORS.brand + "40",
    alignItems: "center", justifyContent: "center",
  },
  patientInfo: { flex: 1, gap: 2 },
  patientName: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  patientMeta: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  answerBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  answerBadgeTxt: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  complaint: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13, lineHeight: 19,
    fontStyle: "italic",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  vitalStrip: {
    flexDirection: "row", justifyContent: "space-between",
    paddingTop: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  vitalItem: { alignItems: "center", gap: 2 },
  vitalLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  vitalValue: { color: COLORS.onSurfaceSecondary, fontSize: 15, fontWeight: "300" },
  vitalAlert: { color: "#EF4444" },

  prompt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12, textAlign: "center",
  },
  catRow: { flexDirection: "row", gap: SPACING.sm },
  catBtn: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.md,
    alignItems: "center",
    gap: SPACING.sm,
  },
  catBtnDisabled: { opacity: 0.45 },
  catBtnHighlight: {
    borderColor: "#2DD4BF",
    shadowColor: "#2DD4BF",
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 18,
  },
  catIconWrap: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
  },
  catLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.3, textAlign: "center" },
  catSub: { color: COLORS.onSurfaceTertiary, fontSize: 9, textAlign: "center" },

  feedbackCard: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  feedbackTop: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  feedbackVerdict: { fontSize: 14, fontWeight: "700" },
  feedbackCorrectHint: { color: COLORS.onSurfaceSecondary, fontSize: 12 },
  feedbackExplanation: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  feedbackKey: {
    color: COLORS.onSurfaceTertiary, fontSize: 10,
    fontWeight: "700", letterSpacing: 0.8,
    textTransform: "uppercase" as any,
  },
  nextBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    justifyContent: "center",
    borderRadius: RADIUS.pill,
    paddingVertical: 12, paddingHorizontal: SPACING.xl,
    marginTop: SPACING.xs,
  },
  nextBtnTxt: { color: COLORS.surface, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },

  scoreRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
  },
  scoreLbl: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  scoreVal: { color: COLORS.brand, fontSize: 12, fontWeight: "700" },

  backToUni: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: SPACING.sm,
  },
  backToUniTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },

  // Complete screen
  completeBody: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: SPACING.xl, gap: SPACING.md,
  },
  completeIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  gradeLabel: { fontSize: 22, fontWeight: "300", letterSpacing: 1 },
  scoreDisplay: { color: COLORS.onSurface, fontSize: 48, fontWeight: "200", letterSpacing: -1 },
  scoreCaption: { color: COLORS.onSurfaceTertiary, fontSize: 13, marginTop: -SPACING.md },
  completeDivider: { width: 48, height: 1.5, backgroundColor: COLORS.border, marginVertical: SPACING.xs },
  completeLearning: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13, lineHeight: 20, textAlign: "center",
    maxWidth: 320,
  },
  completeBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.brand,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.xl, paddingVertical: 12,
    marginTop: SPACING.sm,
  },
  completeBtnTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
});
