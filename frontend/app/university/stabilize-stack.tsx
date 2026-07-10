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

interface ActionCard {
  id: string;
  label: string;
  shortDesc: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  correctOrder: number;
  reasoning: string;
  framework: string;
  color: string;
}

// ── Case data ────────────────────────────────────────────────────────────────
// "The Garden" — Wei, 50M, unresponsive in garden. ABCDE ordering case.
// correctOrder defines the ideal clinical sequence (1 = first).

const CASE = {
  name: "Wei",
  age: 50,
  sex: "M",
  setting: "Found unresponsive in garden by neighbour",
  complaint: "No response to verbal stimulus. Breathing noted but irregular.",
  vitals: [
    { label: "HR", value: "102", alert: true },
    { label: "RR", value: "8", alert: true },
    { label: "SpO₂", value: "88%", alert: true },
    { label: "Temp", value: "36.8°C", alert: false },
  ],
};

const ACTIONS: ActionCard[] = [
  {
    id: "action_assess_mental_status",
    label: "Assess mental status",
    shortDesc: "Check responsiveness — AVPU",
    icon: "radio-button-on-outline",
    correctOrder: 1,
    reasoning: "Disability (D in ABCDE). Establish whether the patient responds to voice, pain, or not at all before acting.",
    framework: "ABCDE · D — Disability",
    color: "#8B5CF6",
  },
  {
    id: "action_open_airway",
    label: "Open the airway",
    shortDesc: "Head-tilt chin-lift position",
    icon: "git-merge-outline",
    correctOrder: 2,
    reasoning: "Airway (A). An unconscious patient loses muscle tone — the tongue can fall back. Opening the airway is always the first physical intervention.",
    framework: "ABCDE · A — Airway",
    color: "#B0DEFF",
  },
  {
    id: "action_check_breathing",
    label: "Check breathing",
    shortDesc: "Look, listen, feel — 10 seconds",
    icon: "partly-sunny-outline",
    correctOrder: 3,
    reasoning: "Breathing (B). Only after a patent airway: assess rate, depth, and symmetry. Wei's RR of 8 is dangerously low.",
    framework: "ABCDE · B — Breathing",
    color: "#22D3EE",
  },
  {
    id: "action_apply_oxygen",
    label: "Apply high-flow O₂",
    shortDesc: "15L/min via non-rebreather mask",
    icon: "cloud-outline",
    correctOrder: 4,
    reasoning: "Breathing intervention. SpO₂ 88% is critically low. High-flow oxygen is the immediate response before circulation is assessed.",
    framework: "ABCDE · B — Breathing intervention",
    color: "#06B6D4",
  },
  {
    id: "action_iv_access",
    label: "Establish IV access",
    shortDesc: "Large-bore cannula, draw bloods",
    icon: "medical-outline",
    correctOrder: 5,
    reasoning: "Circulation (C). Once breathing is supported, establish intravenous access for fluids and medications. Draw bloods at this point.",
    framework: "ABCDE · C — Circulation",
    color: "#EF4444",
  },
];

// Shuffle for display (same shuffle each play for consistency in this prototype)
const DISPLAY_ORDER = [2, 4, 0, 3, 1]; // indices into ACTIONS array

// ── Action tile ───────────────────────────────────────────────────────────────

function ActionTile({
  action,
  tapIndex,
  totalTapped,
  onTap,
  disabled,
}: {
  action: ActionCard;
  tapIndex: number | null;
  totalTapped: number;
  onTap: (id: string) => void;
  disabled: boolean;
}) {
  const { isHighlighted, onTargetPress, highlightStyle } = useHighlightTarget(action.id);
  const scaleAnim = useMemo(() => new Animated.Value(1), []);
  const isTapped = tapIndex !== null;
  const isCorrectPosition = isTapped && tapIndex + 1 === action.correctOrder;

  const handlePress = useCallback(() => {
    if (disabled || isTapped) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 70, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    if (isHighlighted) onTargetPress();
    onTap(action.id);
  }, [disabled, isTapped, isHighlighted, onTargetPress, onTap, action.id, scaleAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={[
          styles.tile,
          isTapped && styles.tileTapped,
          isTapped && { borderColor: (isCorrectPosition ? action.color : "#EF4444") + "50" },
          isHighlighted && styles.tileHighlight,
          highlightStyle,
        ]}
        onPress={handlePress}
        testID={`stack-tile-${action.id}`}
      >
        {isTapped && (
          <LinearGradient
            colors={
              isCorrectPosition
                ? [action.color + "15", action.color + "06"]
                : ["#EF444415", "#EF444406"]
            }
            style={StyleSheet.absoluteFillObject}
          />
        )}

        {/* Order badge */}
        <View
          style={[
            styles.badge,
            isTapped
              ? {
                  backgroundColor: isCorrectPosition ? action.color : "#EF4444",
                }
              : styles.badgeEmpty,
          ]}
        >
          {isTapped ? (
            <Text style={styles.badgeNum}>{tapIndex! + 1}</Text>
          ) : (
            <Text style={styles.badgeQ}>?</Text>
          )}
        </View>

        {/* Icon + text */}
        <View style={styles.tileBody}>
          <View
            style={[
              styles.tileIcon,
              { backgroundColor: isTapped ? action.color + "22" : "rgba(255,255,255,0.06)" },
            ]}
          >
            <Ionicons
              name={action.icon}
              size={18}
              color={isTapped ? action.color : COLORS.onSurfaceTertiary}
            />
          </View>
          <View style={styles.tileText}>
            <Text
              style={[
                styles.tileLabel,
                isTapped && { color: COLORS.onSurface },
              ]}
              numberOfLines={1}
            >
              {action.label}
            </Text>
            <Text style={styles.tileDesc} numberOfLines={1}>
              {action.shortDesc}
            </Text>
          </View>
        </View>

        {/* Post-tap: framework tag */}
        {isTapped && (
          <Text style={[styles.tileFramework, { color: action.color }]}>
            {action.framework}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

type Phase = "playing" | "review" | "complete";

export default function StabilizeStackScreen() {
  const router = useRouter();
  const { startTutorial, isCompleted, activeTutorialId } = useTutorial();

  const [tapSequence, setTapSequence] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("playing");
  const [reviewIndex, setReviewIndex] = useState(0);
  const [revealAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isCompleted("stabilizeIntro") && !activeTutorialId) {
        startTutorial("stabilizeIntro");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const handleTap = useCallback(
    (id: string) => {
      if (phase !== "playing") return;
      setTapSequence((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        if (next.length === ACTIONS.length) {
          setTimeout(() => setPhase("review"), 400);
          Animated.timing(revealAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
        }
        return next;
      });
    },
    [phase, revealAnim],
  );

  const tapIndexFor = useCallback(
    (id: string) => {
      const i = tapSequence.indexOf(id);
      return i === -1 ? null : i;
    },
    [tapSequence],
  );

  const correctCount = useMemo(
    () =>
      ACTIONS.filter((a) => {
        const idx = tapSequence.indexOf(a.id);
        return idx !== -1 && idx + 1 === a.correctOrder;
      }).length,
    [tapSequence],
  );

  // Ordered review: show each action's reasoning in the correct clinical order
  const reviewActions = useMemo(
    () => [...ACTIONS].sort((a, b) => a.correctOrder - b.correctOrder),
    [],
  );

  const displayedActions = useMemo(
    () => DISPLAY_ORDER.map((i) => ACTIONS[i]),
    [],
  );

  const grade =
    correctCount === 5
      ? { label: "Perfect Sequence", color: "#2DD4BF", icon: "trophy" as const }
      : correctCount >= 3
        ? { label: "Good Instincts", color: "#22C55E", icon: "checkmark-done" as const }
        : { label: "Keep Learning", color: "#F59E0B", icon: "school" as const };

  if (phase === "complete") {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <LinearGradient
          colors={["#0B1E2E", "#071018", COLORS.surface]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} hitSlop={10}>
            <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
          </Pressable>
          <Text style={styles.kicker}>STABILIZE STACK · COMPLETE</Text>
        </View>
        <View style={styles.completeBody}>
          <View style={[styles.completeIcon, { borderColor: grade.color + "50" }]}>
            <Ionicons name={grade.icon} size={32} color={grade.color} />
          </View>
          <Text style={[styles.gradeLabel, { color: grade.color }]}>{grade.label}</Text>
          <Text style={styles.scoreDisplay}>{correctCount} / {ACTIONS.length}</Text>
          <Text style={styles.scoreCaption}>actions in correct clinical order</Text>
          <View style={styles.completeDivider} />
          <Text style={styles.completeLearning}>
            ABCDE — Airway, Breathing, Circulation, Disability, Exposure. This sequence saves lives because it addresses immediate threats before downstream problems.
          </Text>
          <Pressable
            style={[styles.completeBtn, { backgroundColor: grade.color }]}
            onPress={() => goBack(router, "/university")}
            testID="stabilize-finish"
          >
            <Text style={[styles.completeBtnTxt, { color: COLORS.surface }]}>Return to University</Text>
            <Ionicons name="arrow-forward" size={14} color={COLORS.surface} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#0B1E2E", "#071018", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/university")}
          hitSlop={10}
          testID="stabilize-back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <Text style={styles.kicker}>STABILIZE STACK</Text>
        <Text style={styles.tappedCount}>
          {tapSequence.length}/{ACTIONS.length}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Patient card */}
        <View style={styles.patientCard}>
          <LinearGradient
            colors={["#0E1D2E", "#091420"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.patientRow}>
            <View style={styles.patientAvatar}>
              <Ionicons name="person" size={22} color="#06B6D4" />
            </View>
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>{CASE.name}, {CASE.age} · {CASE.sex}</Text>
              <Text style={styles.patientMeta}>{CASE.setting}</Text>
            </View>
            <View style={styles.criticalBadge}>
              <View style={styles.criticalDot} />
              <Text style={styles.criticalTxt}>Critical</Text>
            </View>
          </View>
          <Text style={styles.complaint}>{CASE.complaint}</Text>
          <View style={styles.vitalStrip}>
            {CASE.vitals.map((v) => (
              <View key={v.label} style={styles.vitalItem}>
                <Text style={styles.vitalLabel}>{v.label}</Text>
                <Text style={[styles.vitalValue, v.alert && styles.vitalAlert]}>{v.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructRow}>
          <Ionicons name="layers-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.instructTxt}>
            {phase === "playing"
              ? "Tap each action in the order a clinician should do it."
              : "Review: correct clinical sequence shown below."}
          </Text>
        </View>

        {/* Action tiles — playing phase */}
        {phase === "playing" && (
          <View style={styles.tileList}>
            {displayedActions.map((action) => (
              <ActionTile
                key={action.id}
                action={action}
                tapIndex={tapIndexFor(action.id)}
                totalTapped={tapSequence.length}
                onTap={handleTap}
                disabled={false}
              />
            ))}
          </View>
        )}

        {/* Review phase — actions shown in correct order with reasoning */}
        {phase === "review" && (
          <Animated.View style={[styles.reviewWrap, { opacity: revealAnim }]}>
            {reviewActions.map((action) => {
              const idx = tapSequence.indexOf(action.id);
              const playerOrder = idx + 1;
              const isCorrect = playerOrder === action.correctOrder;
              return (
                <View
                  key={action.id}
                  style={[
                    styles.reviewCard,
                    { borderColor: (isCorrect ? action.color : "#EF4444") + "40" },
                  ]}
                >
                  <LinearGradient
                    colors={
                      isCorrect
                        ? [action.color + "12", action.color + "06"]
                        : ["#EF444412", "#EF444406"]
                    }
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={styles.reviewTop}>
                    <View style={[styles.reviewNum, { backgroundColor: isCorrect ? action.color : "#EF4444" }]}>
                      <Text style={styles.reviewNumTxt}>{action.correctOrder}</Text>
                    </View>
                    <View style={styles.reviewTitleWrap}>
                      <Text style={styles.reviewActionLabel}>{action.label}</Text>
                      <Text style={[styles.reviewFramework, { color: action.color }]}>
                        {action.framework}
                      </Text>
                    </View>
                    <View style={styles.reviewPlayerBadge}>
                      <Ionicons
                        name={isCorrect ? "checkmark" : "close"}
                        size={11}
                        color={isCorrect ? action.color : "#EF4444"}
                      />
                      <Text style={[styles.reviewPlayerTxt, { color: isCorrect ? action.color : "#EF4444" }]}>
                        You: {playerOrder}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.reviewReasoning}>{action.reasoning}</Text>
                </View>
              );
            })}

            {/* Score + continue */}
            <View style={[styles.scoreRow, { marginTop: SPACING.sm }]}>
              <Text style={styles.scoreLbl}>Correct sequence</Text>
              <Text style={[styles.scoreVal, { color: grade.color }]}>
                {correctCount}/{ACTIONS.length}
              </Text>
            </View>
            <Pressable
              style={[styles.continueBtn, { backgroundColor: grade.color }]}
              onPress={() => setPhase("complete")}
              testID="stabilize-continue"
            >
              <Text style={[styles.continueBtnTxt, { color: COLORS.surface }]}>See Results</Text>
              <Ionicons name="arrow-forward" size={14} color={COLORS.surface} />
            </Pressable>
          </Animated.View>
        )}

        <Pressable
          style={styles.backToUni}
          onPress={() => goBack(router, "/university")}
          testID="stabilize-return"
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
    flexDirection: "row", alignItems: "center",
    gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  kicker: { color: "#06B6D4", fontSize: 10, fontWeight: "700", letterSpacing: 2, flex: 1 },
  tappedCount: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },

  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl, gap: SPACING.md },

  patientCard: {
    borderRadius: RADIUS.lg, overflow: "hidden",
    borderWidth: 1, borderColor: "#06B6D430",
    padding: SPACING.md, gap: SPACING.sm,
  },
  patientRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  patientAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#06B6D418",
    borderWidth: 1.5, borderColor: "#06B6D440",
    alignItems: "center", justifyContent: "center",
  },
  patientInfo: { flex: 1, gap: 2 },
  patientName: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  patientMeta: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  criticalBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#EF444418",
    borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: "#EF444430",
  },
  criticalDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" },
  criticalTxt: { color: "#EF4444", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  complaint: {
    color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19,
    fontStyle: "italic", backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: RADIUS.sm, padding: SPACING.sm,
  },
  vitalStrip: {
    flexDirection: "row", justifyContent: "space-between",
    paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  vitalItem: { alignItems: "center", gap: 2 },
  vitalLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  vitalValue: { color: COLORS.onSurfaceSecondary, fontSize: 15, fontWeight: "300" },
  vitalAlert: { color: "#EF4444" },

  instructRow: {
    flexDirection: "row", alignItems: "center",
    gap: SPACING.sm,
  },
  instructTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, flex: 1 },

  // Action tiles
  tileList: { gap: SPACING.sm },
  tile: {
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.md, gap: SPACING.sm, overflow: "hidden",
  },
  tileTapped: { backgroundColor: COLORS.surfaceTertiary },
  tileHighlight: {
    borderColor: "#2DD4BF",
    shadowColor: "#2DD4BF", shadowOpacity: 0.7,
    shadowRadius: 10, elevation: 16,
  },
  badge: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    alignSelf: "flex-start" as any,
  },
  badgeEmpty: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: COLORS.border },
  badgeNum: { color: COLORS.surface, fontSize: 12, fontWeight: "800" },
  badgeQ: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "700" },
  tileBody: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  tileIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
  },
  tileText: { flex: 1, gap: 2 },
  tileLabel: { color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
  tileDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, opacity: 0.7 },
  tileFramework: { fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },

  // Review
  reviewWrap: { gap: SPACING.sm },
  reviewCard: {
    borderRadius: RADIUS.md, borderWidth: 1,
    backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.md, gap: SPACING.sm, overflow: "hidden",
  },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  reviewNum: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
  },
  reviewNumTxt: { color: COLORS.surface, fontSize: 13, fontWeight: "800" },
  reviewTitleWrap: { flex: 1, gap: 2 },
  reviewActionLabel: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700" },
  reviewFramework: { fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  reviewPlayerBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 6, paddingVertical: 3,
    borderColor: "rgba(255,255,255,0.1)",
  },
  reviewPlayerTxt: { fontSize: 10, fontWeight: "700" },
  reviewReasoning: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },

  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreLbl: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  scoreVal: { fontSize: 14, fontWeight: "800" },
  continueBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, borderRadius: RADIUS.pill,
    paddingVertical: 12, paddingHorizontal: SPACING.xl,
    marginTop: SPACING.xs,
  },
  continueBtnTxt: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },

  // Complete
  completeBody: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: SPACING.xl, gap: SPACING.md,
  },
  completeIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
  },
  gradeLabel: { fontSize: 22, fontWeight: "300", letterSpacing: 1 },
  scoreDisplay: { color: COLORS.onSurface, fontSize: 48, fontWeight: "200", letterSpacing: -1 },
  scoreCaption: { color: COLORS.onSurfaceTertiary, fontSize: 13, marginTop: -SPACING.md },
  completeDivider: { width: 48, height: 1.5, backgroundColor: COLORS.border, marginVertical: SPACING.xs },
  completeLearning: {
    color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20,
    textAlign: "center", maxWidth: 320,
  },
  completeBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: RADIUS.pill, paddingHorizontal: SPACING.xl, paddingVertical: 12,
    marginTop: SPACING.sm,
  },
  completeBtnTxt: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },

  backToUni: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: SPACING.sm,
  },
  backToUniTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
});
