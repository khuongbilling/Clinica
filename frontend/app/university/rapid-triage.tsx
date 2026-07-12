/**
 * Rapid Triage — The Fading Apprentice
 *
 * University mini-game: one patient card at a time; tap Emergency / Urgent /
 * Routine to sort them. 3 prototype cards (dehydration theme).
 *
 * Layout:  Header → Donghua scene (infirmary illustration, purple-tinted) →
 *          Progress dots → Patient card (flex:1) → Feedback strip →
 *          Triage buttons → Tutorial overlay
 *
 * Tutorial: rapidTriageIntro (forced, System-narrated)
 *   Step 1 — centre dialogue: "Now decide how quickly this patient needs help."
 *   Step 2 — requireAction + requiredTargetId:"triage_urgent"
 *
 * Completion: inline RewardBurst (no route change).
 */

import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
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
import { markChainStep, checkAndMarkFirstPerfect } from "@/src/game/chainProgress";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { RewardBurst } from "@/src/components/university/RewardBurst";
import { useBlockBack } from "@/src/hooks/useBlockBack";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { useTutorial, useHighlightTarget } from "@/src/game/tutorialStore";
import { usePlayer } from "@/src/game/store";
import { MilestoneRewardItem } from "@/src/components/onboarding/MilestoneReward";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// Infirmary illustration reused with purple overlay for triage context
const SCENE_IMG = require("../../assets/images/cue_hunt_infirmary_scene.png");
// Aspect ratio 896×1280 → portrait. maxWidth:340 → height ≈ 485 → cap 190px
const SCENE_AR = 896 / 1280; // width / height (portrait, < 1)

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TriageLevel = "emergency" | "urgent" | "routine";
type GamePhase   = "playing" | "complete";

interface TriageCard {
  id: string;
  patientRole: string;
  scenario: string;
  correct: TriageLevel;
  correctFeedback: string;
  wrongFeedback: Partial<Record<TriageLevel, string>>;
  visual: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    accent: string;
    setting: string;
    chips: string[];
  };
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
    scenario: "Apprentice is dizzy but alert, able to drink, no chest pain.",
    correct: "urgent",
    correctFeedback: "Correct. She needs attention soon, but she's stable.",
    wrongFeedback: {
      emergency: "Not an emergency. She's alert and can drink — escalate only if she worsens.",
      routine:   "Not routine. Dizziness after training can worsen if ignored.",
    },
    visual: {
      icon: "fitness-outline", accent: "#F59E0B",
      setting: "Training hall · afternoon",
      chips: ["Alert", "Dizzy", "Can drink"],
    },
  },
  {
    id: "card_elder",
    patientRole: "Elder",
    scenario: "Elder patient is confused, very weak, BP low, unable to drink.",
    correct: "emergency",
    correctFeedback: "Correct. Immediate care needed.",
    wrongFeedback: {
      urgent:  "More than urgent. Confusion, low BP, and inability to drink need immediate care.",
      routine: "Not routine. This patient is unstable — treat as an emergency.",
    },
    visual: {
      icon: "bed-outline", accent: "#EF4444",
      setting: "Patient room · morning rounds",
      chips: ["Confused", "BP low", "Can't drink"],
    },
  },
  {
    id: "card_student",
    patientRole: "Student",
    scenario: "Student asks how much water to drink during training. No symptoms.",
    correct: "routine",
    correctFeedback: "Correct. No urgency — routine guidance applies.",
    wrongFeedback: {
      emergency: "Not an emergency. This is a wellness question with no active symptoms.",
      urgent:    "Not urgent. No signs of illness — this is routine guidance.",
    },
    visual: {
      icon: "school-outline", accent: "#2DD4BF",
      setting: "Courtyard · after class",
      chips: ["Alert", "Well", "No symptoms"],
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
  { level: "emergency", label: "Emergency", icon: "flash-outline",          accent: "#EF4444", bg: "#EF444416", targetId: "triage_emergency" },
  { level: "urgent",    label: "Urgent",    icon: "timer-outline",          accent: "#F59E0B", bg: "#F59E0B16", targetId: "triage_urgent"    },
  { level: "routine",   label: "Routine",   icon: "checkmark-circle-outline",accent: "#2DD4BF", bg: "#2DD4BF16", targetId: "triage_routine"  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TriageButton — self-contained so hooks always run at top level
// ─────────────────────────────────────────────────────────────────────────────

function TriageButton({ def, disabled, onPress }: {
  def: BtnDef;
  disabled: boolean;
  onPress: (level: TriageLevel) => void;
}) {
  const { isHighlighted, isTutorialBlocked, onTargetPress, highlightStyle } =
    useHighlightTarget(def.targetId);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    if (disabled || isTutorialBlocked) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    if (isHighlighted) onTargetPress();
    onPress(def.level);
  }, [disabled, isHighlighted, isTutorialBlocked, def.level, onPress, onTargetPress, scaleAnim]);

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, highlightStyle]}>
      <Pressable
        style={({ pressed }) => [
          styles.triageBtn,
          { backgroundColor: def.bg, borderColor: def.accent + "55" },
          pressed && !disabled && { opacity: 0.80 },
        ]}
        onPress={handlePress}
        testID={`triage-btn-${def.level}`}
      >
        <View style={[styles.triageBtnIcon, { backgroundColor: def.accent + "18", borderColor: def.accent + "40" }]}>
          <Ionicons name={def.icon} size={20} color={def.accent} />
        </View>
        <Text style={[styles.triageBtnLabel, { color: def.accent }]}>{def.label}</Text>
        <Ionicons name="chevron-forward" size={14} color={def.accent + "70"} />
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DonghuaTriageScene — infirmary art with purple triage overlay
// ─────────────────────────────────────────────────────────────────────────────

function DonghuaTriageScene() {
  return (
    <View style={styles.sceneOuter}>
      <View style={styles.sceneContainer}>
        {/* Portrait infirmary art — absoluteFill into the fixed-height container */}
        <ExpoImage
          source={SCENE_IMG}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={250}
        />

        {/* Purple tint overlay — distinguishes triage from cue-hunt green */}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: "#7C3AED2A" }]}
        />
        {/* Top gradient */}
        <LinearGradient
          colors={["rgba(26,18,40,0.60)", "transparent"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%" }}
          pointerEvents="none"
        />
        {/* Bottom fade */}
        <LinearGradient
          colors={["transparent", "rgba(19,14,32,0.92)"]}
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%" }}
          pointerEvents="none"
        />

        {/* Scene label */}
        <View style={styles.sceneLabel} pointerEvents="none">
          <Text style={styles.sceneLabelKicker}>RAPID TRIAGE · The Fading Apprentice</Text>
          <Text style={styles.sceneLabelSub}>Assess each patient. Decide how urgently they need care.</Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RapidTriageScreen
// ─────────────────────────────────────────────────────────────────────────────

export default function RapidTriageScreen() {
  const router  = useRouter();
  const { player, updateState } = usePlayer();
  const { startTutorial, isCompleted, activeTutorialId } = useTutorial();

  const [cardIdx,   setCardIdx]   = useState(0);
  const [feedback,  setFeedback]  = useState<FeedbackState | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>("playing");
  const [correctCount, setCorrectCount] = useState(0);
  const [creditsEarned, setCreditsEarned] = useState(0);
  const [milestoneItems, setMilestoneItems] = useState<MilestoneRewardItem[] | undefined>();
  const creditedRef = useRef(false);

  useBlockBack();
  useClearTutorialOnExit();

  // Award University Credits once on completion
  useEffect(() => {
    if (gamePhase !== "complete" || creditedRef.current) return;
    creditedRef.current = true;
    const credits = correctCount === CARDS.length ? 30 : correctCount === 2 ? 20 : 10;
    setCreditsEarned(credits);
    const isPerfect = correctCount === CARDS.length;
    (async () => {
      if (isPerfect) {
        const isFirst = await checkAndMarkFirstPerfect("triage");
        if (isFirst) {
          const bonus = 15;
          setMilestoneItems([
            { icon: "school", label: "Uni Credits", amount: String(bonus) },
            { icon: "trophy", label: "First Perfect Bonus" },
          ]);
          if (player && updateState) {
            await updateState({ ...player, university_credits: (player.university_credits || 0) + credits + bonus });
          }
          return;
        }
      }
      if (player && updateState) {
        await updateState({ ...player, university_credits: (player.university_credits || 0) + credits });
      }
    })();
  }, [gamePhase]); // eslint-disable-line react-hooks/exhaustive-deps

  const cardFade    = useRef(new Animated.Value(1)).current;
  const feedbackFade = useRef(new Animated.Value(0)).current;

  // ── Tutorial: auto-start once ─────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isCompleted("rapidTriageIntro") && !activeTutorialId) {
        startTutorial("rapidTriageIntro");
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Feedback fade ─────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(feedbackFade, {
      toValue: feedback ? 1 : 0,
      duration: 200, useNativeDriver: true,
    }).start();
  }, [feedback, feedbackFade]);

  // ── Advance to next card (fade out → in) ──────────────────────────────────
  const advanceCard = useCallback(() => {
    Animated.timing(cardFade, { toValue: 0, duration: 170, useNativeDriver: true }).start(() => {
      setFeedback(null);
      feedbackFade.setValue(0);
      setCardIdx((c) => {
        const next = c + 1;
        if (next >= CARDS.length) {
          // All cards done — show reward
          setGamePhase("complete");
        }
        return next;
      });
      Animated.timing(cardFade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }, [cardFade, feedbackFade]);

  // ── Triage handler ────────────────────────────────────────────────────────
  const handleTriage = useCallback(
    (level: TriageLevel) => {
      if (feedback) return;
      const card = CARDS[cardIdx];
      if (level === card.correct) {
        playRewardCue();
        setCorrectCount((n) => n + 1);
        setFeedback({ correct: true, text: card.correctFeedback });
        setTimeout(() => {
          if (cardIdx >= CARDS.length - 1) {
            markChainStep("rapidTriageDone");
            // Fade out, then switch to complete phase
            Animated.timing(cardFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
              setGamePhase("complete");
            });
          } else {
            advanceCard();
          }
        }, 1400);
      } else {
        setFeedback({ correct: false, text: card.wrongFeedback[level] ?? "Not quite." });
        // Auto-advance after showing wrong feedback — never trap the player on one card
        setTimeout(() => {
          if (cardIdx >= CARDS.length - 1) {
            markChainStep("rapidTriageDone");
            Animated.timing(cardFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
              setGamePhase("complete");
            });
          } else {
            advanceCard();
          }
        }, 2400);
      }
    },
    [feedback, cardIdx, advanceCard, cardFade],
  );

  // ── Complete phase — full-screen reward ───────────────────────────────────
  if (gamePhase === "complete") {
    const allCorrect = correctCount === CARDS.length;
    const twoCorrect = correctCount === 2;
    const grade = allCorrect
      ? { label: "Perfect Triage",  color: "#2DD4BF", icon: "trophy"         as const }
      : twoCorrect
        ? { label: "Good Instincts", color: "#22C55E", icon: "checkmark-done" as const }
        : { label: "Keep Learning",  color: "#F59E0B", icon: "school"         as const };

    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <RewardBurst
          grade={grade}
          score={correctCount}
          total={CARDS.length}
          observation={
            allCorrect
              ? "You read every patient correctly — urgency, stability, all of it."
              : `You got ${correctCount} of ${CARDS.length} triage calls right.`
          }
          clinicalNote="Triage is the skill that decides who gets help first. Time saves lives."
          chainHint="Next: stabilise the patient"
          bgColors={["#1A1228", "#130E20", "#0D0B12"]}
          creditsEarned={creditsEarned}
          milestoneItems={milestoneItems}
          onFinish={() => router.replace("/university")}
          onLearnMore={() => router.push("/university/cue-hunt-lesson" as any)}
          learnLabel="Learn Triage"
          onContinue={() => router.replace("/university/stabilize-stack" as any)}
          continueLabel="Next: Stabilize Stack →"
        />
      </SafeAreaView>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  const card = CARDS[Math.min(cardIdx, CARDS.length - 1)];
  const dots = Array.from({ length: CARDS.length }, (_, i) => i);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#1A1228", "#130E20", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
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

      {/* ── DONGHUA SCENE — infirmary art, purple-tinted ─────────────────── */}
      <DonghuaTriageScene />

      {/* ── PROGRESS DOTS ──────────────────────────────────────────────────── */}
      <View style={styles.dotRow}>
        {dots.map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < cardIdx  && styles.dotPast,
              i === cardIdx && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* ── PATIENT CARD ───────────────────────────────────────────────────── */}
      <Animated.View style={[styles.patientCard, { opacity: cardFade }]}>
        <LinearGradient colors={["#1E1630", "#160F22"]} style={StyleSheet.absoluteFillObject} />

        {/* Role chip */}
        <View style={styles.roleChip}>
          <Text style={styles.roleChipTxt}>PATIENT</Text>
        </View>

        {/* Scene strip — icon + setting + clinical chips */}
        <View style={[styles.sceneStrip, { borderColor: card.visual.accent + "30" }]}>
          <LinearGradient
            colors={[card.visual.accent + "18", card.visual.accent + "08"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <View style={[styles.sceneIcon, { backgroundColor: card.visual.accent + "18", borderColor: card.visual.accent + "35" }]}>
            <Ionicons name={card.visual.icon} size={30} color={card.visual.accent} />
          </View>
          <View style={styles.sceneInfo}>
            <Text style={[styles.sceneSettingTxt, { color: card.visual.accent }]}>{card.visual.setting}</Text>
            <View style={styles.chipRow}>
              {card.visual.chips.map((chip, i) => (
                <View key={i} style={[styles.chip, { borderColor: card.visual.accent + "40" }]}>
                  <Text style={[styles.chipTxt, { color: card.visual.accent }]}>{chip}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.roleLabel}>{card.patientRole}</Text>
        <Text style={styles.scenarioTxt}>{card.scenario}</Text>
        <View style={styles.divider} />
        <Text style={styles.promptTxt}>How urgent is this patient?</Text>
      </Animated.View>

      {/* ── FEEDBACK STRIP ─────────────────────────────────────────────────── */}
      <Animated.View style={[styles.feedbackStrip, { opacity: feedbackFade }]} pointerEvents="none">
        {feedback && (
          <>
            <Ionicons
              name={feedback.correct ? "checkmark-circle" : "information-circle"}
              size={14}
              color={feedback.correct ? "#2DD4BF" : "#F59E0B"}
            />
            <Text style={[styles.feedbackTxt, { color: feedback.correct ? "#2DD4BF" : "#F59E0B" }]}>
              {feedback.text}
            </Text>
          </>
        )}
      </Animated.View>

      {/* ── TRIAGE BUTTONS ─────────────────────────────────────────────────── */}
      <View style={styles.buttonZone}>
        {BTN_DEFS.map((def) => (
          <TriageButton key={def.level} def={def} disabled={!!feedback} onPress={handleTriage} />
        ))}
      </View>

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
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, gap: SPACING.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, gap: 1 },
  kicker:   { color: "#A78BFA", fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  subtitle: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "300" },
  counter:  { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },

  // Donghua scene
  sceneOuter: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  sceneContainer: {
    width: "100%",
    height: 168,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    backgroundColor: "#1A1228",
    borderWidth: 1,
    borderColor: "#7C3AED28",
  },
  sceneLabel: {
    position: "absolute",
    left: SPACING.md, right: SPACING.md, bottom: SPACING.md,
    gap: 3,
  },
  sceneLabelKicker: { color: "#A78BFACC", fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  sceneLabelSub:    { color: COLORS.onSurface, fontSize: 11, fontWeight: "600", lineHeight: 15 },

  // Progress dots
  dotRow: { flexDirection: "row", justifyContent: "center", gap: 6, paddingBottom: SPACING.sm },
  dot:       { width: 28, height: 4, borderRadius: 2, backgroundColor: "#2A2A3A" },
  dotPast:   { backgroundColor: "#A78BFA55" },
  dotActive: { backgroundColor: "#A78BFA" },

  // Patient card
  patientCard: {
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: "#A78BFA28",
    padding: SPACING.xl, alignItems: "center", gap: SPACING.md,
    overflow: "hidden", flex: 1, marginBottom: SPACING.xs,
  },
  roleChip: {
    position: "absolute", top: SPACING.sm, left: SPACING.md,
    backgroundColor: "#A78BFA14", borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: "#A78BFA30",
    paddingHorizontal: 8, paddingVertical: 3,
  },
  roleChipTxt: { color: "#A78BFA", fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  roleLabel:   { color: COLORS.onSurface, fontSize: 17, fontWeight: "600", letterSpacing: 0.3 },
  scenarioTxt: {
    color: COLORS.onSurface, fontSize: 15, lineHeight: 23,
    textAlign: "center", fontWeight: "300", flex: 1, paddingHorizontal: SPACING.xs,
  },
  divider: { height: 1, backgroundColor: "#A78BFA20", alignSelf: "stretch", marginHorizontal: SPACING.md },
  promptTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, letterSpacing: 0.3, fontStyle: "italic", textAlign: "center" },

  // Scene strip inside card
  sceneStrip: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1, padding: SPACING.md,
    alignSelf: "stretch", overflow: "hidden", marginTop: SPACING.md,
  },
  sceneIcon: {
    width: 56, height: 56, borderRadius: RADIUS.md, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  sceneInfo: { flex: 1, gap: 6 },
  sceneSettingTxt: { fontSize: 12, fontWeight: "600", letterSpacing: 0.3 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1 },
  chipTxt: { fontSize: 10, fontWeight: "600" },

  // Feedback
  feedbackStrip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, minHeight: 34,
  },
  feedbackTxt: { fontSize: 12, fontWeight: "600", lineHeight: 16, flex: 1 },

  // Buttons
  buttonZone: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.sm },
  triageBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1.5,
    paddingHorizontal: SPACING.lg, paddingVertical: 16,
  },
  triageBtnIcon: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  triageBtnLabel: { fontSize: 16, fontWeight: "700", letterSpacing: 0.3, flex: 1 },
});
