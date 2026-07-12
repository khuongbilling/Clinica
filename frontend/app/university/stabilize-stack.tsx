/**
 * Stabilize Stack — The Fading Apprentice (Wei, 50M)
 *
 * Redesigned:
 *  - Donghua scene at top (full-width landscape illustration, like Cue Hunt)
 *    with patient subtitle + scenario text overlaid at bottom of image.
 *  - Action orbs (circular tiles, 3-column) instead of rectangular cards.
 *  - Prominent "Back to University" button always visible at bottom.
 *  - Tutorial popup that force-taps the first correct action orb.
 *
 * Game logic unchanged:
 *  - Tap 3 orbs in clinical order; correct phase = right slot.
 *  - Tutorial: stabilizeIntro → requiredTargetId "action_assess_mental_status".
 *  - Phase machine: playing → review → complete.
 */

import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { RewardBurst } from "@/src/components/university/RewardBurst";
import { useTutorial, useHighlightTarget } from "@/src/game/tutorialStore";
import { markChainStep } from "@/src/game/chainProgress";
import { useBlockBack } from "@/src/hooks/useBlockBack";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";

// Donghua patient illustration: Wei on garden path — 1408 × 768 (landscape)
const PATIENT_SCENE = require("../../assets/images/stabilize_patient_wei.png");
// Aspect ratio (width ÷ height). maxWidth:600 → max height ≈ 327 px.
const SCENE_AR = 1408 / 768;

// RN-web ScrollView creates a CSS stacking context that traps zIndex:9500
// inside it. Passing transform:"none" as user style overrides the base so
// the highlighted orb escapes above the TutorialOverlay scrim on web.
const SCROLL_FIX_WEB =
  Platform.OS === "web" ? ({ transform: "none" } as any) : undefined;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActionDef {
  id: string;
  label: string;
  shortDesc: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  /** 0 / 1 / 2 = correct phase slot.  -1 = distractor. */
  phaseIndex: number;
  color: string;
  coaching: string | null;
}

// ── Case data ─────────────────────────────────────────────────────────────────

const CASE = {
  name:     "Wei, 50 · M",
  subtitle: "APPRENTICE · Ward Trainee",
  setting:  "Dizzy and weak after training. Choose your first three actions.",
  vitals: [
    { label: "HR",   value: "102",   alert: true  },
    { label: "RR",   value: "8",     alert: true  },
    { label: "SpO₂", value: "88%",   alert: true  },
    { label: "Temp", value: "36.8°C",alert: false },
  ],
};

const CARE_PHASES = [
  { step: 1, label: "Check Safety",      color: "#8B5CF6", icon: "eye-outline"   as const },
  { step: 2, label: "Confirm Stability", color: "#22D3EE", icon: "pulse-outline" as const },
  { step: 3, label: "Support Recovery",  color: "#2DD4BF", icon: "water-outline" as const },
] as const;

const ACTIONS: ActionDef[] = [
  {
    id:        "action_assess_mental_status",
    label:     "Assess mental status",
    shortDesc: "Check responsiveness — AVPU",
    icon:      "eye-outline",
    phaseIndex: 0,
    color:     "#8B5CF6",
    coaching:  null,
  },
  {
    id:        "action_check_vitals",
    label:     "Check vitals",
    shortDesc: "HR, RR, SpO₂, temperature",
    icon:      "pulse-outline",
    phaseIndex: 1,
    color:     "#22D3EE",
    coaching:  null,
  },
  {
    id:        "action_oral_fluids",
    label:     "Offer oral fluids",
    shortDesc: "Water if swallow is safe",
    icon:      "water-outline",
    phaseIndex: 2,
    color:     "#2DD4BF",
    coaching:  null,
  },
  {
    id:        "action_random_medication",
    label:     "Give medication",
    shortDesc: "Remedy from cabinet",
    icon:      "medical-outline",
    phaseIndex: -1,
    color:     "#F87171",
    coaching:  "Medication without diagnosis can cause harm. Assess first.",
  },
  {
    id:        "action_send_training",
    label:     "Send to training",
    shortDesc: "Cannot wait — needs care",
    icon:      "school-outline",
    phaseIndex: -1,
    color:     "#FBBF24",
    coaching:  "This patient needs urgent attention.",
  },
  {
    id:        "action_ignore_symptoms",
    label:     "Ignore symptoms",
    shortDesc: "Continue rounds",
    icon:      "eye-off-outline",
    phaseIndex: -1,
    color:     "#6B7280",
    coaching:  "Ignoring these signs is dangerous.",
  },
  {
    id:        "action_reassess_fluids",
    label:     "Reassess after fluids",
    shortDesc: "Monitor and wait",
    icon:      "refresh-circle-outline",
    phaseIndex: -1,
    color:     "#A78BFA",
    coaching:  "Reassessment comes after initial stabilisation.",
  },
];

// Shuffled display order — mixes correct + distractors
const DISPLAY_ORDER = [3, 0, 5, 1, 6, 2, 4];

const PHASE_REASONING: Record<number, string> = {
  0: "Assessing mental status (AVPU) confirms consciousness — always the first step.",
  1: "Checking vitals maps the patient's true state. Wei's numbers are critically abnormal.",
  2: "Once swallow is confirmed safe, oral fluids begin gentle rehydration.",
};

// ── SymptomChip ───────────────────────────────────────────────────────────────

function SymptomChip({
  icon, label, color, delay,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  color: string;
  delay: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
        Animated.delay(500),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, delay]);

  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <View style={[styles.chip, { borderColor: color + "55" }]}>
      <Animated.View style={[styles.chipDot, { backgroundColor: color, opacity: dotOpacity }]} />
      <Ionicons name={icon} size={10} color={color} />
      <Text style={[styles.chipTxt, { color }]}>{label}</Text>
    </View>
  );
}

// ── DonghuaScene ──────────────────────────────────────────────────────────────
// Full-width landscape donghua illustration with overlaid patient description.
// Animations: breath cycle, vignette danger pulse, teal heal overlay, wrong shake.

function DonghuaScene({
  correctCount,
  wrongCount,
}: {
  correctCount: number;
  wrongCount: number;
}) {
  const breathAnim = useRef(new Animated.Value(0)).current;
  const vigAnim    = useRef(new Animated.Value(0)).current;
  const healAnim   = useRef(new Animated.Value(0)).current;
  const shakeAnim  = useRef(new Animated.Value(0)).current;

  // Breath loop — slow scale + drift
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(breathAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
        Animated.delay(900),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathAnim]);

  // Danger vignette pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(vigAnim, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(vigAnim, { toValue: 0, duration: 1300, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [vigAnim]);

  // Heal overlay grows with each correct tap
  useEffect(() => {
    Animated.timing(healAnim, {
      toValue: correctCount / CARE_PHASES.length,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [correctCount, healAnim]);

  // Wrong-action shake
  useEffect(() => {
    if (wrongCount === 0) return;
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [wrongCount, shakeAnim]);

  const vigMax     = Math.max(0.04, 0.28 - correctCount * 0.07);
  const vigOpacity = vigAnim.interpolate({ inputRange: [0, 1], outputRange: [vigMax * 0.35, vigMax] });
  const healOpacity = healAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] });
  const breathScale = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] });
  const breathShiftY = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] });

  return (
    <View style={styles.sceneContainer}>
      {/* Patient illustration */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            transform: [
              { scale: breathScale },
              { translateY: breathShiftY },
              { translateX: shakeAnim },
            ],
          },
        ]}
      >
        <ExpoImage
          source={PATIENT_SCENE}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={300}
        />
      </Animated.View>

      {/* Danger vignette */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "#1A0A0A", opacity: vigOpacity }]}
      />

      {/* Teal healing overlay */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "#2DD4BF", opacity: healOpacity }]}
      />

      {/* Bottom gradient fade into background */}
      <LinearGradient
        colors={["transparent", "rgba(7,12,20,0.92)"]}
        style={styles.sceneFade}
        pointerEvents="none"
      />

      {/* Patient description overlay — bottom of scene */}
      <View style={styles.sceneOverlay} pointerEvents="none">
        <Text style={styles.sceneSubtitle}>{CASE.subtitle}</Text>
        <Text style={styles.sceneSetting} numberOfLines={2}>{CASE.setting}</Text>
      </View>

      {/* Symptom chips — top-right corner */}
      <View style={styles.chipRow} pointerEvents="none">
        <SymptomChip icon="moon-outline"  label="Unresponsive" color="#C4B5FD" delay={0}   />
        <SymptomChip icon="pulse-outline" label="RR 8 irreg."  color="#F59E0B" delay={400} />
        <SymptomChip icon="water-outline" label="SpO₂ 88%"     color="#60A5FA" delay={800} />
      </View>
    </View>
  );
}

// ── StabilityPanel ────────────────────────────────────────────────────────────

function StabilityPanel({
  correctCount,
  wrongCount,
}: {
  correctCount: number;
  wrongCount: number;
}) {
  const stabAnim = useRef(new Animated.Value(0.18)).current;

  useEffect(() => {
    const raw    = 0.18 + correctCount * (0.82 / CARE_PHASES.length) - wrongCount * 0.04;
    const target = Math.max(0.08, Math.min(1, raw));
    Animated.timing(stabAnim, { toValue: target, duration: 500, useNativeDriver: false }).start();
  }, [correctCount, wrongCount, stabAnim]);

  const stabPct   = Math.round((0.18 + correctCount * (0.82 / CARE_PHASES.length)) * 100);
  const stabColor = stabPct < 40 ? "#EF4444" : stabPct < 70 ? "#F59E0B" : "#2DD4BF";

  return (
    <View style={styles.stabilityPanel}>
      <View style={styles.stabRow}>
        <Text style={styles.stabLabel}>STABILITY</Text>
        <Text style={[styles.stabPct, { color: stabColor }]}>{stabPct}%</Text>
      </View>
      <View style={styles.stabTrack}>
        <LinearGradient colors={["#0B1A14", "#122A20"]} style={StyleSheet.absoluteFillObject} />
        <Animated.View
          style={[
            styles.stabFill,
            {
              width: stabAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) as any,
              backgroundColor: stabColor,
            },
          ]}
        >
          <LinearGradient
            colors={[stabColor + "CC", stabColor]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </View>
      <View style={styles.vitalStrip}>
        {CASE.vitals.map((v) => (
          <View key={v.label} style={styles.vitalItem}>
            <Text style={styles.vitalLbl}>{v.label}</Text>
            <Text style={[styles.vitalVal, v.alert && styles.vitalAlert]}>{v.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── CareFlowPath ──────────────────────────────────────────────────────────────

function CareFlowPath({ tapSequence }: { tapSequence: string[] }) {
  return (
    <View style={styles.flowOuter}>
      <LinearGradient colors={["#0D1E2C", "#091420"]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.flowHeader}>
        <Ionicons name="git-branch-outline" size={11} color="#2DD4BF" />
        <Text style={styles.flowTitle}>CARE-FLOW PATH</Text>
      </View>
      <View style={styles.flowSlots}>
        {CARE_PHASES.map((ph, i) => {
          const fid   = tapSequence[i];
          const fa    = fid ? ACTIONS.find((a) => a.id === fid) : null;
          const isOk  = fa?.phaseIndex === i;
          const color = fa ? (isOk ? ph.color : "#EF4444") : "#1E3830";
          return (
            <React.Fragment key={ph.step}>
              <View style={styles.flowSlot}>
                <View
                  style={[
                    styles.flowDot,
                    { borderColor: color, backgroundColor: fa ? color + "22" : "rgba(5,12,18,0.5)" },
                  ]}
                >
                  {fa
                    ? <Ionicons name={isOk ? fa.icon : "close"} size={16} color={color} />
                    : <Text style={[styles.flowNum, { color: "#2DD4BF40" }]}>{ph.step}</Text>
                  }
                </View>
                <Text style={[styles.flowLabel, { color: fa ? color : COLORS.onSurfaceTertiary }]} numberOfLines={2}>
                  {fa ? fa.label.split(" ").slice(0, 2).join(" ") : ph.label}
                </Text>
              </View>
              {i < CARE_PHASES.length - 1 && (
                <View style={[styles.flowLine, { backgroundColor: tapSequence[i] ? "#2DD4BF28" : "#1E3830" }]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

// ── ActionOrb — circular action tile ─────────────────────────────────────────

function ActionOrb({
  action,
  tapIndex,
  onTap,
  disabled,
}: {
  action: ActionDef;
  tapIndex: number | null;
  onTap: (id: string) => void;
  disabled: boolean;
}) {
  const { isHighlighted, isTutorialBlocked, onTargetPress, highlightStyle } =
    useHighlightTarget(action.id);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const shakeX    = useRef(new Animated.Value(0)).current;

  const isTapped  = tapIndex !== null;
  const isCorrect = isTapped && action.phaseIndex >= 0 && tapIndex === action.phaseIndex;
  const isWrong   = isTapped && !isCorrect;

  useEffect(() => {
    if (!isTapped) return;
    if (isCorrect) {
      glowAnim.setValue(0);
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 240, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.45, duration: 420, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -7, duration: 48, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue:  7, duration: 48, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -4, duration: 48, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue:  0, duration: 48, useNativeDriver: true }),
      ]).start();
    }
  }, [isTapped, isCorrect, glowAnim, shakeX]);

  const handlePress = useCallback(() => {
    if (disabled || isTapped || isTutorialBlocked) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.86, duration: 68, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    if (isHighlighted) onTargetPress();
    onTap(action.id);
  }, [disabled, isTapped, isTutorialBlocked, isHighlighted, onTargetPress, onTap, action.id, scaleAnim]);

  const ringColor  = isWrong ? "#EF4444" : action.color;
  const circleBg   = isTapped ? ringColor + "20" : action.color + "14";
  const circleBrd  = isHighlighted ? "#2DD4BF" : isTapped ? ringColor + "80" : action.color + "44";
  const labelColor = isTapped
    ? (isCorrect ? action.color : "#EF4444BB")
    : COLORS.onSurfaceSecondary;

  return (
    <Animated.View
      style={[
        styles.orbWrap,
        { transform: [{ scale: scaleAnim }, { translateX: shakeX }] },
        isHighlighted && styles.orbGlow,
        highlightStyle,
      ]}
    >
      <Pressable
        style={styles.orbPressable}
        onPress={handlePress}
        testID={action.id}
        accessibilityLabel={action.label}
      >
        {/* Circle */}
        <View style={[styles.orbCircle, { backgroundColor: circleBg, borderColor: circleBrd }]}>
          {/* Correct flash overlay */}
          {isCorrect && (
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                { borderRadius: 36, backgroundColor: action.color + "38", opacity: glowAnim },
              ]}
            />
          )}

          {/* Icon */}
          <Ionicons
            name={isWrong ? "close-circle-outline" : action.icon}
            size={30}
            color={isHighlighted ? "#2DD4BF" : isTapped ? ringColor : action.color}
          />

          {/* Caution badge — wrong corner */}
          {isWrong && (
            <View style={styles.orbWarnBadge} pointerEvents="none">
              <Ionicons name="warning" size={10} color="#EF4444" />
            </View>
          )}

          {/* Phase number badge — correct corner */}
          {isCorrect && (
            <View style={[styles.orbPhaseBadge, { backgroundColor: action.color }]}>
              <Text style={styles.orbPhaseNum}>{action.phaseIndex + 1}</Text>
            </View>
          )}
        </View>

        {/* Label */}
        <Text style={[styles.orbLabel, { color: labelColor }]} numberOfLines={2}>
          {action.label}
        </Text>

        {/* Wrong coaching hint */}
        {isWrong && !!action.coaching && (
          <Text style={styles.orbCoach} numberOfLines={2}>
            {action.coaching}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

type GamePhase = "playing" | "review" | "complete";

export default function StabilizeStackScreen() {
  const router = useRouter();
  const {
    startTutorial,
    isCompleted,
    activeTutorialId,
    guidedReserve,
    requiredTargetId,
  } = useTutorial();

  const [tapSequence, setTapSequence] = useState<string[]>([]);
  const [gamePhase,   setGamePhase]   = useState<GamePhase>("playing");
  const [revealAnim]                  = useState(new Animated.Value(0));

  // Scroll ref for auto-scrolling to orb grid on tutorial step 1
  const scrollRef   = useRef<React.ElementRef<typeof ScrollView>>(null);
  const orbGridY    = useRef(0);

  // Back navigation locked while in-game — exits use router.replace.
  useBlockBack();
  // Prevent tutorial overlay leaking onto next screen.
  useClearTutorialOnExit();

  // Auto-start forced tutorial on first visit
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isCompleted("stabilizeIntro") && !activeTutorialId) {
        startTutorial("stabilizeIntro");
      }
    }, 700);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark chain step when player reaches complete
  useEffect(() => {
    if (gamePhase === "complete") markChainStep("stabilizeDone");
  }, [gamePhase]);

  // When tutorial requires an orb tap, scroll orb grid into view
  useEffect(() => {
    if (!requiredTargetId) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: orbGridY.current, animated: true });
    }, 380);
    return () => clearTimeout(t);
  }, [requiredTargetId]);

  // ── Core game handler ───────────────────────────────────────────────────

  const handleTap = useCallback(
    (id: string) => {
      if (gamePhase !== "playing") return;
      // While a tutorial step requires a specific orb, silently block others
      // (the scrim + isTutorialBlocked in the orb provides primary guard).
      if (requiredTargetId && id !== requiredTargetId) return;

      setTapSequence((prev) => {
        if (prev.includes(id)) return prev; // idempotent
        const next = [...prev, id];
        if (next.length === CARE_PHASES.length) {
          setTimeout(() => setGamePhase("review"), 500);
          Animated.timing(revealAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        }
        return next;
      });
    },
    [gamePhase, revealAnim, requiredTargetId],
  );

  const tapIndexFor = useCallback(
    (id: string) => { const i = tapSequence.indexOf(id); return i === -1 ? null : i; },
    [tapSequence],
  );

  const correctCount = useMemo(
    () => tapSequence.filter((id, i) => ACTIONS.find((a) => a.id === id)?.phaseIndex === i).length,
    [tapSequence],
  );
  const wrongCount = useMemo(
    () => tapSequence.filter((id, i) => ACTIONS.find((a) => a.id === id)?.phaseIndex !== i).length,
    [tapSequence],
  );
  const displayedActions = useMemo(() => DISPLAY_ORDER.map((i) => ACTIONS[i]), []);

  const grade =
    correctCount === CARE_PHASES.length
      ? { label: "Perfect Care Chain", color: "#2DD4BF", icon: "trophy"         as const }
      : correctCount === 2
        ? { label: "Good Instincts",   color: "#22C55E", icon: "checkmark-done" as const }
        : { label: "Keep Learning",    color: "#F59E0B", icon: "school"         as const };

  // ── Complete screen ───────────────────────────────────────────────────────

  if (gamePhase === "complete") {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <RewardBurst
          grade={grade}
          score={correctCount}
          total={CARE_PHASES.length}
          observation={
            correctCount === CARE_PHASES.length
              ? '"You placed every step in perfect order — safety first, then stability, then recovery."'
              : `You got ${correctCount} of ${CARE_PHASES.length} steps right.`
          }
          clinicalNote="Check Safety → Confirm Stability → Support Recovery. Always assess before you act."
          chainHint="Next: triage your next patient"
          bgColors={["#0B1E2E", "#071018", "#060D14"]}
          onFinish={() => router.replace("/university")}
          onLearnMore={() => router.push("/university/cue-hunt-lesson" as any)}
          learnLabel="Learn the Chain"
        />
      </SafeAreaView>
    );
  }

  // ── Playing + review ──────────────────────────────────────────────────────

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
          onPress={() => router.replace("/university")}
          hitSlop={10}
          testID="stabilize-back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>STABILIZE STACK</Text>
          <Text style={styles.kickerSub}>The Fading Apprentice</Text>
        </View>
        <Text style={styles.counter}>{tapSequence.length}/{CARE_PHASES.length}</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={SCROLL_FIX_WEB}
        contentContainerStyle={[
          styles.scroll,
          guidedReserve > 0 && { paddingBottom: guidedReserve },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Donghua scene — full-width illustrated patient ─────────────── */}
        <DonghuaScene correctCount={correctCount} wrongCount={wrongCount} />

        {/* ── Stability bar + vital signs ───────────────────────────────── */}
        <StabilityPanel correctCount={correctCount} wrongCount={wrongCount} />

        {/* ── 3-phase glowing care-flow path ───────────────────────────── */}
        <CareFlowPath tapSequence={tapSequence} />

        {/* ── Instruction ──────────────────────────────────────────────── */}
        <View style={styles.instructRow}>
          <Ionicons name="layers-outline" size={13} color="#2DD4BF" />
          <Text style={styles.instructTxt}>
            {gamePhase === "playing"
              ? "Tap 3 actions in the correct clinical order."
              : "Review the correct care sequence below."}
          </Text>
        </View>

        {/* ── Action orbs — 3-column circular grid ─────────────────────── */}
        {gamePhase === "playing" && (
          <View
            style={styles.orbGrid}
            onLayout={(e) => { orbGridY.current = e.nativeEvent.layout.y; }}
          >
            {displayedActions.map((action) => (
              <ActionOrb
                key={action.id}
                action={action}
                tapIndex={tapIndexFor(action.id)}
                onTap={handleTap}
                disabled={tapSequence.length >= CARE_PHASES.length}
              />
            ))}
          </View>
        )}

        {/* ── Review cards ─────────────────────────────────────────────── */}
        {gamePhase === "review" && (
          <Animated.View style={[styles.reviewWrap, { opacity: revealAnim }]}>
            {CARE_PHASES.map((ph, i) => {
              const fid   = tapSequence[i];
              const fa    = fid ? ACTIONS.find((a) => a.id === fid) : null;
              const ca    = ACTIONS.find((a) => a.phaseIndex === i);
              const isOk  = fa?.phaseIndex === i;
              return (
                <View key={i} style={[styles.reviewCard, { borderColor: (isOk ? ph.color : "#EF4444") + "44" }]}>
                  <LinearGradient
                    colors={isOk ? [ph.color + "12", ph.color + "06"] : ["#EF444412", "#EF444406"]}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={styles.reviewTop}>
                    <View style={[styles.reviewNum, { backgroundColor: isOk ? ph.color : "#EF4444" }]}>
                      <Text style={styles.reviewNumTxt}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.reviewPhase, { color: ph.color }]}>{ph.label}</Text>
                      <Text style={styles.reviewAction}>{ca?.label}</Text>
                    </View>
                    <View style={styles.reviewBadge}>
                      <Ionicons name={isOk ? "checkmark" : "close"} size={11} color={isOk ? ph.color : "#EF4444"} />
                      <Text style={[styles.reviewBadgeTxt, { color: isOk ? ph.color : "#EF4444" }]}>
                        {isOk ? "Correct" : "Wrong"}
                      </Text>
                    </View>
                  </View>
                  {!isOk && fa && (
                    <Text style={styles.reviewWrong}>You chose: {fa.label}</Text>
                  )}
                  <Text style={styles.reviewReason}>{PHASE_REASONING[i]}</Text>
                  {!isOk && fa?.coaching && (
                    <Text style={styles.reviewCoach}>{fa.coaching}</Text>
                  )}
                </View>
              );
            })}

            <View style={styles.scoreRow}>
              <Text style={styles.scoreLbl}>Correct steps</Text>
              <Text style={[styles.scoreVal, { color: grade.color }]}>
                {correctCount}/{CARE_PHASES.length}
              </Text>
            </View>
            <Pressable
              style={[styles.continueBtn, { backgroundColor: grade.color }]}
              onPress={() => setGamePhase("complete")}
              testID="stabilize-continue"
            >
              <Text style={[styles.continueTxt, { color: COLORS.surface }]}>See Results</Text>
              <Ionicons name="arrow-forward" size={14} color={COLORS.surface} />
            </Pressable>
          </Animated.View>
        )}

        {/* ── Back to University ────────────────────────────────────────── */}
        <Pressable
          style={styles.backToUni}
          onPress={() => router.replace("/university")}
          testID="stabilize-return"
        >
          <View style={styles.backToUniInner}>
            <Ionicons name="arrow-back-circle-outline" size={18} color="#2DD4BF90" />
            <Text style={styles.backToUniTxt}>Back to University</Text>
          </View>
        </Pressable>
      </ScrollView>

      {/* Tutorial overlay — must be inside this screen so highlighted orb
          (zIndex 9500) rises above the scrim. See SCROLL_FIX_WEB above. */}
      <TutorialOverlay />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  // ── Header ───────────────────────────────────────────────────────────────
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
  kicker: { color: "#06B6D4", fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  kickerSub: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 0.5, marginTop: 1 },
  counter: { color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 72,
    gap: SPACING.md,
  },

  // ── Donghua scene ─────────────────────────────────────────────────────────
  // maxWidth:600 caps height at ≈327px on web; on mobile (≈358px) height≈195px.
  sceneContainer: {
    width: "100%",
    maxWidth: 600,
    aspectRatio: SCENE_AR,
    alignSelf: "center",
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    backgroundColor: "#091420",
    borderWidth: 1,
    borderColor: "#06B6D428",
  },
  sceneFade: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    height: "55%",
  },
  sceneOverlay: {
    position: "absolute",
    left: SPACING.md,
    right: SPACING.md,
    bottom: SPACING.md,
    gap: 3,
  },
  sceneSubtitle: {
    color: "#06B6D4CC",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  sceneSetting: {
    color: COLORS.onSurface,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  chipRow: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    gap: 4,
    alignItems: "flex-end",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(5,10,16,0.80)",
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipDot: { width: 5, height: 5, borderRadius: 2.5 },
  chipTxt: { fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },

  // ── Stability panel ───────────────────────────────────────────────────────
  stabilityPanel: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#06B6D420",
    overflow: "hidden",
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  stabRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stabLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  stabPct: { fontSize: 11, fontWeight: "700" },
  stabTrack: {
    height: 7,
    borderRadius: 3.5,
    overflow: "hidden",
    backgroundColor: "#0B1A14",
    borderWidth: 1,
    borderColor: "#2DD4BF14",
  },
  stabFill: {
    position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 3.5, overflow: "hidden",
  },
  vitalStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  vitalItem: { alignItems: "center", gap: 2 },
  vitalLbl:  { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  vitalVal:  { color: COLORS.onSurfaceSecondary, fontSize: 15, fontWeight: "300" },
  vitalAlert:{ color: "#EF4444" },

  // ── Care-flow path ────────────────────────────────────────────────────────
  flowOuter: {
    borderRadius: RADIUS.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2DD4BF18",
    padding: SPACING.sm,
    gap: 4,
  },
  flowHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  flowTitle:  { color: "#2DD4BF", fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  flowSlots:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  flowSlot:   { alignItems: "center", gap: 4, flex: 1 },
  flowDot: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  flowNum:   { fontSize: 13, fontWeight: "700" },
  flowLabel: { fontSize: 8, fontWeight: "600", textAlign: "center", letterSpacing: 0.2, lineHeight: 11 },
  flowLine:  { height: 1.5, flex: 0.18, marginBottom: 22 },

  // ── Instruction row ───────────────────────────────────────────────────────
  instructRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  instructTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, flex: 1 },

  // ── Action orbs — 3-column grid ───────────────────────────────────────────
  orbGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    rowGap: SPACING.lg,
    columnGap: SPACING.sm,
  },
  orbWrap: {
    width: "30%",
    alignItems: "center",
  },
  orbGlow: {
    shadowColor: "#2DD4BF",
    shadowOpacity: 0.8,
    shadowRadius: 14,
    elevation: 18,
  },
  orbPressable: {
    alignItems: "center",
    gap: SPACING.sm,
    width: "100%",
  },
  orbCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  orbWarnBadge: {
    position: "absolute",
    bottom: 4, right: 4,
    backgroundColor: "#EF444420",
    borderRadius: 7,
    padding: 2,
  },
  orbPhaseBadge: {
    position: "absolute",
    top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  orbPhaseNum: { color: "#fff", fontSize: 9, fontWeight: "800" },
  orbLabel: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 13,
    letterSpacing: 0.2,
  },
  orbCoach: {
    color: "#EF4444AA",
    fontSize: 9,
    lineHeight: 12,
    fontStyle: "italic",
    textAlign: "center",
  },

  // ── Review cards ─────────────────────────────────────────────────────────
  reviewWrap: { gap: SPACING.sm },
  reviewCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.md,
    gap: SPACING.sm,
    overflow: "hidden",
  },
  reviewTop:      { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  reviewNum:      { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  reviewNumTxt:   { color: COLORS.surface, fontSize: 13, fontWeight: "800" },
  reviewPhase:    { fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  reviewAction:   { color: COLORS.onSurface, fontSize: 13, fontWeight: "700" },
  reviewBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderWidth: 1, borderRadius: RADIUS.pill, borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 6, paddingVertical: 3,
  },
  reviewBadgeTxt: { fontSize: 10, fontWeight: "700" },
  reviewWrong:    { color: COLORS.onSurfaceTertiary, fontSize: 11, fontStyle: "italic" },
  reviewReason:   { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },
  reviewCoach:    { color: "#F59E0BAA", fontSize: 11, lineHeight: 16, fontStyle: "italic" },

  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreLbl: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  scoreVal: { fontSize: 20, fontWeight: "800" },
  continueBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.sm, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, marginTop: SPACING.sm,
  },
  continueTxt: { fontSize: 14, fontWeight: "700" },

  // ── Complete screen ───────────────────────────────────────────────────────
  completeBody: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: SPACING.xl, gap: SPACING.md,
  },
  completeIcon: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  gradeLabel:      { fontSize: 22, fontWeight: "800", letterSpacing: 0.5 },
  scoreDisplay:    { color: COLORS.onSurface, fontSize: 40, fontWeight: "300" },
  scoreCaption:    { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: -SPACING.sm },
  completeDivider: { width: "40%", height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  completeLearning:{ color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20, textAlign: "center" },
  completeBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  completeBtnTxt: { fontSize: 14, fontWeight: "700" },

  // ── Back to University ────────────────────────────────────────────────────
  backToUni: {
    alignSelf: "center",
    marginTop: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  backToUniInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: "#2DD4BF28",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: "rgba(45,212,191,0.05)",
  },
  backToUniTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
