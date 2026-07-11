/**
 * Stabilize Stack — The Garden (Wei, 50M, ABCDE ordering)
 *
 * Visual: hand-drawn donghua fantasy-medical board. Patient panel with animated
 * Stability bar at top; illustrated action cards with fantasy-medical icons;
 * visible 5-step Care Chain track that locks cards in as the player taps them.
 *
 * GAMEPLAY / TUTORIAL LOGIC IS UNCHANGED:
 *  - ACTIONS / correctOrder / DISPLAY_ORDER / phase machine: identical
 *  - Tutorial wiring: stabilizeIntro → requiredTargetId "action_assess_mental_status"
 *    still uses useHighlightTarget + onTargetPress (zIndex 9500 blocking scrim)
 *  - testIDs preserved: stack-tile-{id}, stabilize-back/finish/continue/return
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

import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { useTutorial, useHighlightTarget } from "@/src/game/tutorialStore";

// Patient scene illustration (donghua) — 1408x768
const PATIENT_SCENE = require("../../assets/images/stabilize_patient_wei.png");
const PATIENT_SCENE_RATIO = 1408 / 768;

// On web, RN-web's ScrollView base style applies `transform: translateZ(0)`,
// which creates a CSS stacking context that TRAPS the tutorial-highlighted
// card's zIndex 9500 below the TutorialOverlay blocking scrim (zIndex 9000)
// — making the forced tutorial step unclickable. Overriding the transform
// lets the highlighted card escape and sit above the scrim, exactly like the
// non-scrolling mini-game screens (rapid-triage, mealcraft).
const SCROLL_FIX_WEB =
  Platform.OS === "web" ? ({ transform: "none" } as any) : undefined;

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

const CASE = {
  name: "Wei",
  age: 50,
  sex: "M",
  setting: "Found unresponsive in garden by neighbour",
  vitals: [
    { label: "HR",   value: "102",   alert: true },
    { label: "RR",   value: "8",     alert: true },
    { label: "SpO₂", value: "88%",   alert: true },
    { label: "Temp", value: "36.8°C",alert: false },
  ],
};

const ACTIONS: ActionCard[] = [
  {
    id: "action_assess_mental_status",
    label: "Assess mental status",
    shortDesc: "Check responsiveness — AVPU",
    icon: "eye-outline",
    correctOrder: 1,
    reasoning: "Disability (D in ABCDE). Establish whether the patient responds to voice, pain, or not at all before acting.",
    framework: "ABCDE · D — Disability",
    color: "#8B5CF6",
  },
  {
    id: "action_open_airway",
    label: "Open the airway",
    shortDesc: "Head-tilt chin-lift position",
    icon: "arrow-up-circle-outline",
    correctOrder: 2,
    reasoning: "Airway (A). An unconscious patient loses muscle tone — the tongue can fall back. Opening the airway is always the first physical intervention.",
    framework: "ABCDE · A — Airway",
    color: "#B0DEFF",
  },
  {
    id: "action_check_breathing",
    label: "Check breathing",
    shortDesc: "Look, listen, feel — 10 seconds",
    icon: "pulse-outline",
    correctOrder: 3,
    reasoning: "Breathing (B). Only after a patent airway: assess rate, depth, and symmetry. Wei's RR of 8 is dangerously low.",
    framework: "ABCDE · B — Breathing",
    color: "#22D3EE",
  },
  {
    id: "action_apply_oxygen",
    label: "Apply high-flow O₂",
    shortDesc: "15L/min via non-rebreather mask",
    icon: "cloud-circle-outline",
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

// Shuffle for display (same each play for consistency)
const DISPLAY_ORDER = [2, 4, 0, 3, 1];

// Per-action visual extras (keeps ActionCard interface clean)
const ACTION_VISUAL: Record<string, { glowDesc: string }> = {
  action_assess_mental_status: { glowDesc: "Diagnostic aura appears near the head" },
  action_open_airway:          { glowDesc: "Airway passage glows open" },
  action_check_breathing:      { glowDesc: "Breath-wave line stabilises" },
  action_apply_oxygen:         { glowDesc: "Oxygen halo spreads — SpO₂ rising" },
  action_iv_access:            { glowDesc: "Circulation link established" },
};

// ── Animated patient scene — Wei in the garden, symptoms visible ─────────────

/** Pulsing symptom chip pinned over the patient scene. */
function SymptomChip({
  icon,
  label,
  color,
  delay,
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
        Animated.delay(400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, delay]);

  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const dotScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.25] });

  return (
    <View style={[styles.symptomChip, { borderColor: color + "55" }]}>
      <Animated.View
        style={[
          styles.symptomDot,
          { backgroundColor: color, opacity: dotOpacity, transform: [{ scale: dotScale }] },
        ]}
      />
      <Ionicons name={icon} size={11} color={color} />
      <Text style={[styles.symptomTxt, { color }]}>{label}</Text>
    </View>
  );
}

function PatientScene({ runningCorrect }: { runningCorrect: number }) {
  // Slow, IRREGULAR breathing — shallow rise, pause, uneven fall (RR 8).
  const breath = useRef(new Animated.Value(0)).current;
  // Critical red vignette pulse; fades out as the patient stabilises.
  const vignette = useRef(new Animated.Value(0)).current;
  // Teal healing glow that grows with each correct action.
  const heal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        // shallow inhale
        Animated.timing(breath, { toValue: 1, duration: 1400, useNativeDriver: true }),
        // hold — apnoeic pause (the "irregular" part)
        Animated.delay(900),
        // quick partial exhale
        Animated.timing(breath, { toValue: 0.35, duration: 500, useNativeDriver: true }),
        Animated.delay(300),
        // slow full exhale
        Animated.timing(breath, { toValue: 0, duration: 1600, useNativeDriver: true }),
        // long pause before the next breath
        Animated.delay(1400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(vignette, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(vignette, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [vignette]);

  useEffect(() => {
    Animated.timing(heal, {
      toValue: runningCorrect / ACTIONS.length,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [runningCorrect, heal]);

  // Vignette peak opacity shrinks as the patient improves.
  const vigMax = Math.max(0.05, 0.32 - runningCorrect * 0.06);
  const vignetteOpacity = vignette.interpolate({
    inputRange: [0, 1],
    outputRange: [vigMax * 0.35, vigMax],
  });
  const healOpacity = heal.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] });
  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.022] });
  const breathShift = breath.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  return (
    <View style={styles.sceneWrap}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { transform: [{ scale: breathScale }, { translateY: breathShift }] },
        ]}
      >
        <ExpoImage
          source={PATIENT_SCENE}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={250}
        />
      </Animated.View>

      {/* Critical red vignette — pulses, weakens as stability rises */}
      <Animated.View
        pointerEvents="none"
        style={[styles.sceneVignette, { opacity: vignetteOpacity }]}
      />
      {/* Healing teal wash — grows with correct actions */}
      <Animated.View
        pointerEvents="none"
        style={[styles.sceneHeal, { opacity: healOpacity }]}
      />
      {/* Bottom gradient so chips stay legible */}
      <LinearGradient
        colors={["transparent", "rgba(5,12,18,0.82)"]}
        style={styles.sceneBottomFade}
        pointerEvents="none"
      />

      {/* Symptom chips — the "description", shown ON the patient */}
      <View style={styles.symptomRow} pointerEvents="none">
        <SymptomChip icon="moon-outline" label="Unresponsive" color="#C4B5FD" delay={0} />
        <SymptomChip icon="pulse-outline" label="RR 8 · irregular" color="#F59E0B" delay={450} />
        <SymptomChip icon="water-outline" label="SpO₂ 88% · lips dusky" color="#60A5FA" delay={900} />
      </View>
    </View>
  );
}

// ── PatientPanel — scene + stability bar + vitals ─────────────────────────────

function PatientPanel({ runningCorrect }: { runningCorrect: number }) {
  const stabilityAnim = useRef(new Animated.Value(0.18)).current;

  useEffect(() => {
    const target = 0.18 + runningCorrect * (0.82 / ACTIONS.length);
    Animated.timing(stabilityAnim, {
      toValue: target,
      duration: 480,
      useNativeDriver: false,
    }).start();
  }, [runningCorrect, stabilityAnim]);

  const stabPct = Math.round((0.18 + runningCorrect * (0.82 / ACTIONS.length)) * 100);
  const stabColor = stabPct < 40 ? "#EF4444" : stabPct < 70 ? "#F59E0B" : "#2DD4BF";

  return (
    <View style={styles.patientCard}>
      <LinearGradient
        colors={["#0E1D2E", "#091420"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Name row */}
      <View style={styles.patientRow}>
        <View style={styles.patientAvatar}>
          <Ionicons name="person" size={20} color="#06B6D4" />
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

      {/* Animated patient scene */}
      <PatientScene runningCorrect={runningCorrect} />

      {/* Stability bar */}
      <View style={styles.stabilityRow}>
        <Text style={styles.stabilityLabel}>Patient Stability</Text>
        <Text style={[styles.stabilityPct, { color: stabColor }]}>{stabPct}%</Text>
      </View>
      <View style={styles.stabilityTrack}>
        <LinearGradient
          colors={["#0B1A14", "#122A20"]}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View
          style={[
            styles.stabilityFill,
            {
              width: stabilityAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }) as any,
              backgroundColor: stabColor,
            },
          ]}
        >
          <LinearGradient
            colors={[stabColor + "CC", stabColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
        {/* Glow orb at the leading edge */}
        <Animated.View
          style={[
            styles.stabilityOrb,
            {
              left: stabilityAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "98%"],
              }) as any,
              backgroundColor: stabColor,
            },
          ]}
        />
      </View>

      {/* Vitals */}
      <View style={styles.vitalStrip}>
        {CASE.vitals.map((v) => (
          <View key={v.label} style={styles.vitalItem}>
            <Text style={styles.vitalLabel}>{v.label}</Text>
            <Text style={[styles.vitalValue, v.alert && styles.vitalAlert]}>{v.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── CareChainTrack ─────────────────────────────────────────────────────────────

function CareChainTrack({ tapSequence }: { tapSequence: string[] }) {
  return (
    <View style={styles.chainOuter}>
      <LinearGradient
        colors={["#0D2518", "#091A12"]}
        style={StyleSheet.absoluteFillObject}
      />
      <Text style={styles.chainTitle}>
        <Ionicons name="link-outline" size={10} color="#2DD4BF" />{"  "}CARE CHAIN
      </Text>
      <View style={styles.chainSlots}>
        {Array.from({ length: ACTIONS.length }, (_, i) => {
          const filledId = tapSequence[i];
          const action = filledId ? ACTIONS.find((a) => a.id === filledId) : null;
          const isCorrect = action && action.correctOrder === i + 1;
          const dotColor = action ? (isCorrect ? action.color : "#EF4444") : "#1E3830";
          return (
            <React.Fragment key={i}>
              <View style={styles.chainSlot}>
                <View
                  style={[
                    styles.chainDot,
                    {
                      backgroundColor: action ? dotColor + "22" : "#1E3830",
                      borderColor: action ? dotColor : "#2DD4BF18",
                    },
                  ]}
                >
                  {action ? (
                    <Ionicons name={action.icon} size={13} color={dotColor} />
                  ) : (
                    <Text style={styles.chainStepNum}>{i + 1}</Text>
                  )}
                </View>
                <Text style={[styles.chainStepLabel, action && { color: dotColor }]}>
                  {action ? action.label.split(" ").slice(0, 2).join(" ") : `Step ${i + 1}`}
                </Text>
              </View>
              {i < ACTIONS.length - 1 && (
                <View style={[styles.chainConnector, { backgroundColor: tapSequence[i] ? "#2DD4BF30" : "#1E3830" }]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

// ── ActionCardTile ─────────────────────────────────────────────────────────────

function ActionCardTile({
  action,
  tapIndex,
  onTap,
  disabled,
}: {
  action: ActionCard;
  tapIndex: number | null;
  onTap: (id: string) => void;
  disabled: boolean;
}) {
  const { isHighlighted, onTargetPress, highlightStyle } = useHighlightTarget(action.id);
  const scaleAnim = useMemo(() => new Animated.Value(1), []);
  const glowAnim = useMemo(() => new Animated.Value(0), []);
  const shakeX = useMemo(() => new Animated.Value(0), []);

  const isTapped = tapIndex !== null;
  const isCorrectPosition = isTapped && tapIndex + 1 === action.correctOrder;
  const isWrong = isTapped && !isCorrectPosition;

  useEffect(() => {
    if (!isTapped) return;
    if (isCorrectPosition) {
      // Glow burst
      glowAnim.setValue(0);
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 350, useNativeDriver: true }),
      ]).start();
    } else {
      // Gentle shake + dim caution
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -4, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 4, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [isTapped, isCorrectPosition, glowAnim, shakeX]);

  const handlePress = useCallback(() => {
    if (disabled || isTapped) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 65, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    if (isHighlighted) onTargetPress();
    onTap(action.id);
  }, [disabled, isTapped, isHighlighted, onTargetPress, onTap, action.id, scaleAnim]);

  const ringColor = isWrong ? "#EF4444" : action.color;
  const cardBg = isTapped
    ? (isCorrectPosition ? action.color + "12" : "#EF444412")
    : "transparent";
  const borderColor = isTapped
    ? (isCorrectPosition ? action.color + "55" : "#EF444455")
    : isHighlighted
      ? "#2DD4BF"
      : COLORS.border;

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }, { translateX: shakeX }] },
        isHighlighted && styles.cardHighlightShadow,
        highlightStyle,
      ]}
    >
      <Pressable
        style={[styles.card, { borderColor, backgroundColor: cardBg }]}
        onPress={handlePress}
        testID={`stack-tile-${action.id}`}
      >
        {/* Correct glow overlay */}
        {isCorrectPosition && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: RADIUS.md,
                backgroundColor: action.color + "18",
                opacity: glowAnim,
              },
            ]}
          />
        )}

        {/* Wrong — caution rune overlay */}
        {isWrong && (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, styles.cautionRune]}
          >
            <Ionicons name="warning-outline" size={14} color="#EF444460" />
          </View>
        )}

        {/* Top row: order badge + framework tag */}
        <View style={styles.cardTopRow}>
          <View
            style={[
              styles.orderBadge,
              isTapped
                ? { backgroundColor: ringColor, borderColor: ringColor }
                : styles.orderBadgeEmpty,
            ]}
          >
            {isTapped ? (
              <Text style={styles.orderBadgeNum}>{tapIndex! + 1}</Text>
            ) : (
              <Text style={styles.orderBadgeQ}>?</Text>
            )}
          </View>

          <Text style={[styles.frameworkTag, { color: isTapped ? ringColor : COLORS.onSurfaceTertiary }]}>
            {action.framework}
          </Text>
        </View>

        {/* Icon + label row */}
        <View style={styles.cardBody}>
          <View
            style={[
              styles.cardIconWrap,
              {
                backgroundColor: isTapped
                  ? ringColor + "22"
                  : action.color + "14",
                borderColor: isTapped ? ringColor + "60" : action.color + "30",
              },
            ]}
          >
            <Ionicons
              name={action.icon}
              size={22}
              color={isTapped ? ringColor : action.color}
            />
          </View>
          <View style={styles.cardTextWrap}>
            <Text
              style={[
                styles.cardLabel,
                { color: isTapped ? COLORS.onSurface : COLORS.onSurfaceSecondary },
              ]}
              numberOfLines={2}
            >
              {action.label}
            </Text>
            <Text style={styles.cardDesc} numberOfLines={2}>
              {isTapped
                ? ACTION_VISUAL[action.id]?.glowDesc ?? action.shortDesc
                : action.shortDesc}
            </Text>
          </View>
        </View>

        {/* Correct: animated glow ring at bottom */}
        {isCorrectPosition && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.correctGlowBar,
              { backgroundColor: action.color, opacity: glowAnim },
            ]}
          />
        )}

        {/* Wrong: coaching line */}
        {isWrong && (
          <Text style={styles.cautionCoach}>
            Not quite — review the ABCDE order after all cards are placed.
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
          setTimeout(() => setPhase("review"), 450);
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

  // Running correct count: updates as each action is tapped (for stability bar)
  const runningCorrect = useMemo(() => {
    return ACTIONS.filter((a) => {
      const idx = tapSequence.indexOf(a.id);
      return idx !== -1 && idx + 1 === a.correctOrder;
    }).length;
  }, [tapSequence]);

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

  // ── Complete phase ───────────────────────────────────────────────────────────

  if (phase === "complete") {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <LinearGradient
          colors={["#0B1E2E", "#071018", COLORS.surface]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.header}>
          <Pressable
            style={styles.backBtn}
            onPress={() => goBack(router, "/university")}
            hitSlop={10}
          >
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

  // ── Playing + review phases ──────────────────────────────────────────────────

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

      <ScrollView
        style={SCROLL_FIX_WEB}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Patient panel with stability bar */}
        <PatientPanel runningCorrect={runningCorrect} />

        {/* Care Chain track */}
        <CareChainTrack tapSequence={tapSequence} />

        {/* Instruction row */}
        <View style={styles.instructRow}>
          <Ionicons name="layers-outline" size={13} color="#2DD4BF" />
          <Text style={styles.instructTxt}>
            {phase === "playing"
              ? "Tap each action in the order a clinician should do it."
              : "Review: correct clinical sequence shown below."}
          </Text>
        </View>

        {/* Action cards — playing phase */}
        {phase === "playing" && (
          <View style={styles.cardList}>
            {displayedActions.map((action) => (
              <ActionCardTile
                key={action.id}
                action={action}
                tapIndex={tapIndexFor(action.id)}
                onTap={handleTap}
                disabled={false}
              />
            ))}
          </View>
        )}

        {/* Review phase — correct clinical order with reasoning */}
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

      {/* Tutorial narration + blocking scrim (stabilizeIntro, forced).
          Must be rendered INSIDE this screen so the highlighted card
          (zIndex 9500, via useHighlightTarget) can sit above the scrim. */}
      <TutorialOverlay />
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
  kicker: {
    color: "#06B6D4", fontSize: 10, fontWeight: "700", letterSpacing: 2, flex: 1,
  },
  tappedCount: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },

  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 64, gap: SPACING.md },

  // ── Patient card ──────────────────────────────────────────────────────────
  patientCard: {
    borderRadius: RADIUS.lg, overflow: "hidden",
    borderWidth: 1, borderColor: "#06B6D430",
    padding: SPACING.md, gap: SPACING.sm,
  },
  patientRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  patientAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#06B6D418", borderWidth: 1.5, borderColor: "#06B6D440",
    alignItems: "center", justifyContent: "center",
  },
  patientInfo: { flex: 1, gap: 2 },
  patientName: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  patientMeta: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  criticalBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#EF444418", borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: "#EF444430",
  },
  criticalDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" },
  criticalTxt: { color: "#EF4444", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },

  // ── Animated patient scene ────────────────────────────────────────────────
  sceneWrap: {
    width: "100%",
    aspectRatio: PATIENT_SCENE_RATIO,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#06B6D425",
    backgroundColor: "#091420",
  },
  sceneVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#7F1D1D",
  },
  sceneHeal: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#2DD4BF",
  },
  sceneBottomFade: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    height: "46%",
  },
  symptomRow: {
    position: "absolute",
    left: SPACING.sm, right: SPACING.sm, bottom: SPACING.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  symptomChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(5,12,18,0.78)",
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  symptomDot: { width: 6, height: 6, borderRadius: 3 },
  symptomTxt: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },

  // Stability bar
  stabilityRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  stabilityLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  stabilityPct: { fontSize: 11, fontWeight: "700" },
  stabilityTrack: {
    height: 8, borderRadius: 4, overflow: "hidden",
    backgroundColor: "#0B1A14",
    borderWidth: 1, borderColor: "#2DD4BF14",
    position: "relative",
  },
  stabilityFill: {
    position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4,
    overflow: "hidden",
  },
  stabilityOrb: {
    position: "absolute", width: 10, height: 10,
    borderRadius: 5, top: -1,
    shadowColor: "#2DD4BF", shadowOpacity: 0.9, shadowRadius: 6,
  },

  vitalStrip: {
    flexDirection: "row", justifyContent: "space-between",
    paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  vitalItem: { alignItems: "center", gap: 2 },
  vitalLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  vitalValue: { color: COLORS.onSurfaceSecondary, fontSize: 15, fontWeight: "300" },
  vitalAlert: { color: "#EF4444" },

  // ── Care Chain track ──────────────────────────────────────────────────────
  chainOuter: {
    borderRadius: RADIUS.md, overflow: "hidden",
    borderWidth: 1, borderColor: "#2DD4BF18",
    padding: SPACING.sm, gap: SPACING.sm,
  },
  chainTitle: {
    color: "#2DD4BF", fontSize: 9, fontWeight: "700", letterSpacing: 1.5,
  },
  chainSlots: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  chainSlot: { alignItems: "center", gap: 4, flex: 1 },
  chainDot: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
  },
  chainStepNum: {
    color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: "700",
  },
  chainStepLabel: {
    color: COLORS.onSurfaceTertiary, fontSize: 8, fontWeight: "600",
    textAlign: "center", letterSpacing: 0.2, lineHeight: 11,
  },
  chainConnector: { height: 1.5, flex: 0.15, marginBottom: 16 },

  // ── Instruction row ───────────────────────────────────────────────────────
  instructRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
  },
  instructTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, flex: 1 },

  // ── Action cards ──────────────────────────────────────────────────────────
  cardList: { gap: SPACING.sm },
  card: {
    borderRadius: RADIUS.md, borderWidth: 1,
    padding: SPACING.md, gap: SPACING.sm, overflow: "hidden",
    backgroundColor: COLORS.surfaceSecondary,
  },
  cardHighlightShadow: {
    shadowColor: "#2DD4BF", shadowOpacity: 0.75, shadowRadius: 12,
    elevation: 18,
  },
  cardTopRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
  },
  orderBadge: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
  orderBadgeEmpty: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: COLORS.border,
  },
  orderBadgeNum: { color: COLORS.surface, fontSize: 11, fontWeight: "800" },
  orderBadgeQ: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700" },
  frameworkTag: { fontSize: 9, fontWeight: "700", letterSpacing: 0.8, flex: 1 },

  cardBody: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  cardIconWrap: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
  },
  cardTextWrap: { flex: 1, gap: 3 },
  cardLabel: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  cardDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 16 },

  correctGlowBar: {
    height: 2, borderRadius: 1, marginTop: 2,
  },

  cautionRune: {
    alignItems: "flex-end", justifyContent: "flex-end",
    padding: SPACING.sm, pointerEvents: "none",
  },
  cautionCoach: {
    color: "#EF4444AA", fontSize: 10, lineHeight: 15, fontStyle: "italic",
  },

  // ── Review ────────────────────────────────────────────────────────────────
  reviewWrap: { gap: SPACING.sm },
  reviewCard: {
    borderRadius: RADIUS.md, borderWidth: 1,
    backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.md, gap: SPACING.sm, overflow: "hidden",
  },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  reviewNum: {
    width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
  },
  reviewNumTxt: { color: COLORS.surface, fontSize: 13, fontWeight: "800" },
  reviewTitleWrap: { flex: 1, gap: 2 },
  reviewActionLabel: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700" },
  reviewFramework: { fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  reviewPlayerBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderWidth: 1, borderRadius: RADIUS.pill, borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 6, paddingVertical: 3,
  },
  reviewPlayerTxt: { fontSize: 10, fontWeight: "700" },
  reviewReasoning: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },

  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreLbl: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  scoreVal: { fontSize: 20, fontWeight: "800" },
  continueBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.sm, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, marginTop: SPACING.sm,
  },
  continueBtnTxt: { fontSize: 14, fontWeight: "700" },

  // ── Complete ──────────────────────────────────────────────────────────────
  completeBody: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: SPACING.xl, gap: SPACING.md,
  },
  completeIcon: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  gradeLabel: { fontSize: 22, fontWeight: "800", letterSpacing: 0.5 },
  scoreDisplay: { color: COLORS.onSurface, fontSize: 40, fontWeight: "300" },
  scoreCaption: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: -SPACING.sm },
  completeDivider: { width: "40%", height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  completeLearning: {
    color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20,
    textAlign: "center",
  },
  completeBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  completeBtnTxt: { fontSize: 14, fontWeight: "700" },

  // ── Back to Uni ───────────────────────────────────────────────────────────
  backToUni: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "center", paddingVertical: SPACING.sm,
  },
  backToUniTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
});
