/**
 * Rapid Triage — The Fading Apprentice
 *
 * University mini-game: one patient card at a time; tap Emergency / Urgent /
 * Routine to sort them. 3 prototype cards (dehydration theme).
 *
 * Tutorial: rapidTriageIntro (forced, System-narrated, defined in tutorials.ts)
 *   Step 1 — centre dialogue: "Now decide how quickly this patient needs help."
 *   Step 2 — requireAction + requiredTargetId:"triage_urgent"
 *             → TutorialOverlay scrim blocks all but the highlighted Urgent button.
 *
 * After all 3 cards → /university/triage-complete placeholder.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { playRewardCue } from "@/src/game/cues";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { useBlockBack } from "@/src/hooks/useBlockBack";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { useTutorial, useHighlightTarget } from "@/src/game/tutorialStore";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TriageLevel = "emergency" | "urgent" | "routine";

interface TriageCard {
  id: string;
  patientRole: string;
  scenario: string;
  correct: TriageLevel;
  correctFeedback: string;
  wrongFeedback: Partial<Record<TriageLevel, string>>;
}

interface FeedbackState {
  correct: boolean;
  text: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cards
// ─────────────────────────────────────────────────────────────────────────────

const CARDS: TriageCard[] = [
  {
    id: "card_dizzy",
    patientRole: "Apprentice",
    scenario:
      "Apprentice is dizzy but alert, able to drink, no chest pain.",
    correct: "urgent",
    correctFeedback: "Correct. She needs attention soon, but she's stable.",
    wrongFeedback: {
      emergency:
        "Not an emergency. She's alert and can drink — escalate only if she worsens.",
      routine:
        "Not routine. Dizziness after training can worsen if ignored.",
    },
  },
  {
    id: "card_elder",
    patientRole: "Elder",
    scenario:
      "Elder patient is confused, very weak, BP low, unable to drink.",
    correct: "emergency",
    correctFeedback: "Correct. Immediate care needed.",
    wrongFeedback: {
      urgent:
        "More than urgent. Confusion, low BP, and inability to drink need immediate care.",
      routine:
        "Not routine. This patient is unstable — treat as an emergency.",
    },
  },
  {
    id: "card_student",
    patientRole: "Student",
    scenario:
      "Student asks how much water to drink during training. No symptoms.",
    correct: "routine",
    correctFeedback: "Correct. No urgency — routine guidance applies.",
    wrongFeedback: {
      emergency:
        "Not an emergency. This is a wellness question with no active symptoms.",
      urgent:
        "Not urgent. No signs of illness — this is routine guidance.",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Button config
// ─────────────────────────────────────────────────────────────────────────────

interface BtnDef {
  level: TriageLevel;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accent: string;
  bg: string;
  targetId: string;
}

const BTN_DEFS: BtnDef[] = [
  {
    level: "emergency",
    label: "Emergency",
    icon: "flash-outline",
    accent: "#EF4444",
    bg: "#EF444416",
    targetId: "triage_emergency",
  },
  {
    level: "urgent",
    label: "Urgent",
    icon: "timer-outline",
    accent: "#F59E0B",
    bg: "#F59E0B16",
    targetId: "triage_urgent",
  },
  {
    level: "routine",
    label: "Routine",
    icon: "checkmark-circle-outline",
    accent: "#2DD4BF",
    bg: "#2DD4BF16",
    targetId: "triage_routine",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TriageButton — self-contained component so hooks are always called at top level
// ─────────────────────────────────────────────────────────────────────────────

interface TriageBtnProps {
  def: BtnDef;
  disabled: boolean;
  onPress: (level: TriageLevel) => void;
}

function TriageButton({ def, disabled, onPress }: TriageBtnProps) {
  const { isHighlighted, onTargetPress, highlightStyle } =
    useHighlightTarget(def.targetId);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (isHighlighted) onTargetPress();
    onPress(def.level);
  }, [disabled, isHighlighted, def.level, onPress, onTargetPress]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.triageBtn,
        { backgroundColor: def.bg, borderColor: def.accent + "55" },
        highlightStyle,
        pressed && !disabled && { opacity: 0.82 },
      ]}
      onPress={handlePress}
      testID={`triage-btn-${def.level}`}
    >
      <View
        style={[
          styles.triageBtnIcon,
          { backgroundColor: def.accent + "18", borderColor: def.accent + "40" },
        ]}
      >
        <Ionicons name={def.icon} size={20} color={def.accent} />
      </View>
      <Text style={[styles.triageBtnLabel, { color: def.accent }]}>
        {def.label}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={def.accent + "70"} />
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RapidTriageScreen
// ─────────────────────────────────────────────────────────────────────────────

export default function RapidTriageScreen() {
  const router = useRouter();
  const { startTutorial, isCompleted, activeTutorialId } = useTutorial();

  const [cardIdx, setCardIdx] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Back navigation is blocked while playing — the back arrow is the
  // deliberate exit (forward replace to the University hub, never a pop).
  useBlockBack();
  // Leaving mid-tutorial must never leak the overlay onto the next screen.
  useClearTutorialOnExit();

  const cardFade = useRef(new Animated.Value(1)).current;
  const feedbackFade = useRef(new Animated.Value(0)).current;

  // ── Tutorial: auto-start once (700 ms — hydration guard) ────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isCompleted("rapidTriageIntro") && !activeTutorialId) {
        startTutorial("rapidTriageIntro");
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Feedback fade ────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(feedbackFade, {
      toValue: feedback ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [feedback, feedbackFade]);

  // ── Advance to next card (fade out → in) ────────────────────────────────
  const advanceCard = useCallback(() => {
    Animated.timing(cardFade, {
      toValue: 0,
      duration: 170,
      useNativeDriver: true,
    }).start(() => {
      setFeedback(null);
      feedbackFade.setValue(0);
      setCardIdx((c) => c + 1);
      Animated.timing(cardFade, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  }, [cardFade, feedbackFade]);

  // ── Triage handler ───────────────────────────────────────────────────────
  const handleTriage = useCallback(
    (level: TriageLevel) => {
      if (feedback) return; // locked while feedback is visible

      const card = CARDS[cardIdx];

      if (level === card.correct) {
        playRewardCue();
        setFeedback({ correct: true, text: card.correctFeedback });
        setTimeout(() => {
          if (cardIdx >= CARDS.length - 1) {
            router.replace("/university/triage-complete" as any);
          } else {
            advanceCard();
          }
        }, 1400);
      } else {
        setFeedback({
          correct: false,
          text: card.wrongFeedback[level] ?? "Not quite. Try again.",
        });
        setTimeout(() => setFeedback(null), 2400);
      }
    },
    [feedback, cardIdx, advanceCard, router],
  );

  // ────────────────────────────────────────────────────────────────────────
  const card = CARDS[cardIdx];
  const dots = Array.from({ length: CARDS.length }, (_, i) => i);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Purple/violet gradient — visually distinct from teal Cue Hunt */}
      <LinearGradient
        colors={["#1A1228", "#130E20", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.replace("/university")}
          hitSlop={10}
          testID="triage-back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.kicker}>RAPID TRIAGE</Text>
          <Text style={styles.subtitle}>The Fading Apprentice</Text>
        </View>
        <Text style={styles.counter}>{cardIdx + 1}/{CARDS.length}</Text>
      </View>

      {/* ── PROGRESS DOTS ──────────────────────────────────────────────── */}
      <View style={styles.dotRow}>
        {dots.map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < cardIdx && styles.dotPast,
              i === cardIdx && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* ── PATIENT CARD ───────────────────────────────────────────────── */}
      <Animated.View style={[styles.patientCard, { opacity: cardFade }]}>
        <LinearGradient
          colors={["#1E1630", "#160F22"]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Role chip — top-left */}
        <View style={styles.roleChip}>
          <Text style={styles.roleChipTxt}>PATIENT</Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={["#A78BFA20", "#7C3AED10"]}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="person" size={44} color="#A78BFA" />
        </View>

        {/* Role label */}
        <Text style={styles.roleLabel}>{card.patientRole}</Text>

        {/* Scenario — the core content */}
        <Text style={styles.scenarioTxt}>{card.scenario}</Text>

        <View style={styles.divider} />
        <Text style={styles.promptTxt}>How urgent is this patient?</Text>
      </Animated.View>

      {/* ── FEEDBACK STRIP ─────────────────────────────────────────────── */}
      <Animated.View
        style={[styles.feedbackStrip, { opacity: feedbackFade }]}
        pointerEvents="none"
      >
        {feedback && (
          <>
            <Ionicons
              name={feedback.correct ? "checkmark-circle" : "information-circle"}
              size={14}
              color={feedback.correct ? "#2DD4BF" : "#F59E0B"}
            />
            <Text
              style={[
                styles.feedbackTxt,
                { color: feedback.correct ? "#2DD4BF" : "#F59E0B" },
              ]}
            >
              {feedback.text}
            </Text>
          </>
        )}
      </Animated.View>

      {/* ── TRIAGE BUTTONS ─────────────────────────────────────────────── */}
      <View style={styles.buttonZone}>
        {BTN_DEFS.map((def) => (
          <TriageButton
            key={def.level}
            def={def}
            disabled={!!feedback}
            onPress={handleTriage}
          />
        ))}
      </View>

      {/* ── TUTORIAL OVERLAY (System-narrated, forced) ─────────────────── */}
      <TutorialOverlay />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, gap: 1 },
  kicker: { color: "#A78BFA", fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  subtitle: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "300" },
  counter: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },

  // Progress dots
  dotRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingBottom: SPACING.sm,
  },
  dot: { width: 28, height: 4, borderRadius: 2, backgroundColor: "#2A2A3A" },
  dotPast: { backgroundColor: "#A78BFA55" },
  dotActive: { backgroundColor: "#A78BFA" },

  // Patient card
  patientCard: {
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "#A78BFA28",
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.md,
    overflow: "hidden",
    flex: 1,
    marginBottom: SPACING.xs,
  },
  roleChip: {
    position: "absolute",
    top: SPACING.sm, left: SPACING.md,
    backgroundColor: "#A78BFA14",
    borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: "#A78BFA30",
    paddingHorizontal: 8, paddingVertical: 3,
  },
  roleChipTxt: { color: "#A78BFA", fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  avatarWrap: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 1.5, borderColor: "#A78BFA40",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    marginTop: SPACING.xl,
  },
  roleLabel: {
    color: COLORS.onSurface,
    fontSize: 17, fontWeight: "600", letterSpacing: 0.3,
  },
  scenarioTxt: {
    color: COLORS.onSurface,
    fontSize: 15, lineHeight: 23,
    textAlign: "center",
    fontWeight: "300",
    flex: 1,
    paddingHorizontal: SPACING.xs,
  },
  divider: {
    height: 1, backgroundColor: "#A78BFA20",
    alignSelf: "stretch", marginHorizontal: SPACING.md,
  },
  promptTxt: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13, letterSpacing: 0.3,
    fontStyle: "italic", textAlign: "center",
  },

  // Feedback
  feedbackStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    minHeight: 34,
  },
  feedbackTxt: {
    fontSize: 12, fontWeight: "600", lineHeight: 16, flex: 1,
  },

  // Buttons
  buttonZone: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  triageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 18,
  },
  triageBtnIcon: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  triageBtnLabel: {
    fontSize: 16, fontWeight: "700", letterSpacing: 0.3, flex: 1,
  },
});
