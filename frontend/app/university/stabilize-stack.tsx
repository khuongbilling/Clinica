/**
 * Stabilize Stack — The Garden (Wei, 50M)
 *
 * Immersive patient-centred scene: donghua Lotus infirmary illustration,
 * three-phase glowing care-flow path, and illustrated fantasy-medical action
 * cards (3 correct + 4 distractor options).
 *
 * GAMEPLAY / TUTORIAL LOGIC UNCHANGED:
 *  - Tap-to-order: player selects 3 actions; taps fill care-flow phases in order.
 *  - Correct = right action in right phase slot; wrong = caution animation + coaching.
 *  - Tutorial: stabilizeIntro → requiredTargetId "action_assess_mental_status"
 *    still uses useHighlightTarget + onTargetPress (zIndex 9500 above scrim).
 *  - testIDs preserved: stack-tile-{id}, stabilize-back/finish/continue/return.
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
import { useTutorial, useHighlightTarget } from "@/src/game/tutorialStore";
import { useBlockBack } from "@/src/hooks/useBlockBack";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";

// Donghua patient illustration: Wei unconscious on garden path — 1408×768
const PATIENT_SCENE = require("../../assets/images/stabilize_patient_wei.png");
const PATIENT_SCENE_RATIO = 1408 / 768;

// RN-web ScrollView sets transform:translateZ(0) as a base style, creating a
// CSS stacking context that traps useHighlightTarget's zIndex:9500 below the
// TutorialOverlay scrim (9000). Passing transform:"none" as user style overrides
// the base and lets the highlighted card escape above the scrim on web.
const SCROLL_FIX_WEB =
  Platform.OS === "web" ? ({ transform: "none" } as any) : undefined;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActionCard {
  id: string;
  label: string;
  shortDesc: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  /** 0 / 1 / 2 = correct phase index.  -1 = distractor (wrong). */
  phaseIndex: number;
  color: string;
  glowDesc: string;
  coaching: string | null;
}

// ── Case data ─────────────────────────────────────────────────────────────────

const CASE = {
  name: "Wei",
  age: 50,
  sex: "M",
  setting: "Found unresponsive in garden by neighbour",
  vitals: [
    { label: "HR",   value: "102",   alert: true  },
    { label: "RR",   value: "8",     alert: true  },
    { label: "SpO₂", value: "88%",   alert: true  },
    { label: "Temp", value: "36.8°C",alert: false },
  ],
};

// ── 3-phase glowing care-flow path ────────────────────────────────────────────

const CARE_PHASES = [
  { step: 1, label: "Check Safety",      color: "#8B5CF6", icon: "eye-outline"             as const },
  { step: 2, label: "Confirm Stability", color: "#22D3EE", icon: "pulse-outline"           as const },
  { step: 3, label: "Support Recovery",  color: "#2DD4BF", icon: "water-outline"           as const },
] as const;

// ── Action cards (3 correct + 4 distractors) ─────────────────────────────────

const ACTIONS: ActionCard[] = [
  {
    id:         "action_assess_mental_status",
    label:      "Assess mental status",
    shortDesc:  "Check responsiveness — AVPU scale",
    icon:       "eye-outline",
    phaseIndex: 0,
    color:      "#8B5CF6",
    glowDesc:   "Diagnostic aura forms — consciousness confirmed",
    coaching:   null,
  },
  {
    id:         "action_check_vitals",
    label:      "Check vitals",
    shortDesc:  "Measure HR, RR, SpO₂, temperature",
    icon:       "pulse-outline",
    phaseIndex: 1,
    color:      "#22D3EE",
    glowDesc:   "Pulse ribbon stabilises — vital signs mapped",
    coaching:   null,
  },
  {
    id:         "action_oral_fluids",
    label:      "Offer oral fluids if safe",
    shortDesc:  "Water with lotus care — swallow intact",
    icon:       "water-outline",
    phaseIndex: 2,
    color:      "#2DD4BF",
    glowDesc:   "Healing water flows — hydration and colour improve",
    coaching:   null,
  },
  {
    id:         "action_random_medication",
    label:      "Give random medication",
    shortDesc:  "Select a remedy from the cabinet",
    icon:       "medical-outline",
    phaseIndex: -1,
    color:      "#F87171",
    glowDesc:   "Caution rune — unverified treatment without assessment",
    coaching:   "Medication without diagnosis can cause harm. Assess the patient first.",
  },
  {
    id:         "action_send_training",
    label:      "Send back to training",
    shortDesc:  "This patient needs immediate care",
    icon:       "school-outline",
    phaseIndex: -1,
    color:      "#FBBF24",
    glowDesc:   "Warning scroll — this patient cannot wait",
    coaching:   "This patient needs urgent attention. Training can wait.",
  },
  {
    id:         "action_ignore_symptoms",
    label:      "Ignore symptoms",
    shortDesc:  "Continue rounds as normal",
    icon:       "eye-off-outline",
    phaseIndex: -1,
    color:      "#6B7280",
    glowDesc:   "Dim pulse — neglect leaves the patient at risk",
    coaching:   "Ignoring these signs is dangerous. Always investigate.",
  },
  {
    id:         "action_reassess_fluids",
    label:      "Reassess after fluids",
    shortDesc:  "Circular scan — monitor and wait",
    icon:       "refresh-circle-outline",
    phaseIndex: -1,
    color:      "#A78BFA",
    glowDesc:   "Gentle scan pulse — timing is not right yet",
    coaching:   "Reassessment follows initial stabilisation, not before.",
  },
];

// Shuffled display order — mixes correct + wrong options
const DISPLAY_ORDER = [3, 0, 5, 1, 6, 2, 4];

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
        Animated.delay(400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, delay]);

  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const dotScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.25] });

  return (
    <View style={[styles.symptomChip, { borderColor: color + "55" }]}>
      <Animated.View style={[styles.symptomDot, { backgroundColor: color, opacity: dotOpacity, transform: [{ scale: dotScale }] }]} />
      <Ionicons name={icon} size={11} color={color} />
      <Text style={[styles.symptomTxt, { color }]}>{label}</Text>
    </View>
  );
}

// ── PatientScene — animated breath, vignette, heal, wrong-shake ──────────────

function PatientScene({ runningCorrect, wrongCount }: { runningCorrect: number; wrongCount: number }) {
  const breath     = useRef(new Animated.Value(0)).current;
  const vignette   = useRef(new Animated.Value(0)).current;
  const heal       = useRef(new Animated.Value(0)).current;
  const wrongShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(breath, { toValue: 0.35, duration: 500, useNativeDriver: true }),
        Animated.delay(300),
        Animated.timing(breath, { toValue: 0, duration: 1600, useNativeDriver: true }),
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
    Animated.timing(heal, { toValue: runningCorrect / CARE_PHASES.length, duration: 600, useNativeDriver: true }).start();
  }, [runningCorrect, heal]);

  // Brief lateral shake on wrong action — dizziness worsens
  useEffect(() => {
    if (wrongCount === 0) return;
    Animated.sequence([
      Animated.timing(wrongShake, { toValue: -5, duration: 60, useNativeDriver: true }),
      Animated.timing(wrongShake, { toValue: 5, duration: 60, useNativeDriver: true }),
      Animated.timing(wrongShake, { toValue: -3, duration: 60, useNativeDriver: true }),
      Animated.timing(wrongShake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [wrongCount, wrongShake]);

  const vigMax        = Math.max(0.05, 0.32 - runningCorrect * 0.09);
  const vignetteOpacity = vignette.interpolate({ inputRange: [0, 1], outputRange: [vigMax * 0.35, vigMax] });
  const healOpacity   = heal.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] });
  const breathScale   = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.022] });
  const breathShift   = breath.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  return (
    <View style={styles.sceneWrap}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { transform: [{ scale: breathScale }, { translateY: breathShift }, { translateX: wrongShake }] },
        ]}
      >
        <ExpoImage
          source={PATIENT_SCENE}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={250}
        />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.sceneVignette, { opacity: vignetteOpacity }]} />
      <Animated.View pointerEvents="none" style={[styles.sceneHeal, { opacity: healOpacity }]} />
      <LinearGradient
        colors={["transparent", "rgba(5,12,18,0.85)"]}
        style={styles.sceneBottomFade}
        pointerEvents="none"
      />

      <View style={styles.symptomRow} pointerEvents="none">
        <SymptomChip icon="moon-outline"  label="Unresponsive"         color="#C4B5FD" delay={0} />
        <SymptomChip icon="pulse-outline" label="RR 8 · irregular"     color="#F59E0B" delay={450} />
        <SymptomChip icon="water-outline" label="SpO₂ 88% · lips dusky" color="#60A5FA" delay={900} />
      </View>
    </View>
  );
}

// ── PatientPanel — scene + stability bar + vitals ─────────────────────────────

function PatientPanel({ runningCorrect, wrongCount }: { runningCorrect: number; wrongCount: number }) {
  const stabilityAnim = useRef(new Animated.Value(0.18)).current;

  useEffect(() => {
    const raw    = 0.18 + runningCorrect * (0.82 / CARE_PHASES.length) - wrongCount * 0.04;
    const target = Math.max(0.08, Math.min(1, raw));
    Animated.timing(stabilityAnim, { toValue: target, duration: 480, useNativeDriver: false }).start();
  }, [runningCorrect, wrongCount, stabilityAnim]);

  const stabPct   = Math.round((0.18 + runningCorrect * (0.82 / CARE_PHASES.length)) * 100);
  const stabColor = stabPct < 40 ? "#EF4444" : stabPct < 70 ? "#F59E0B" : "#2DD4BF";

  return (
    <View style={styles.patientCard}>
      <LinearGradient colors={["#0E1D2E", "#091420"]} style={StyleSheet.absoluteFillObject} />

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

      <PatientScene runningCorrect={runningCorrect} wrongCount={wrongCount} />

      <View style={styles.stabilityRow}>
        <Text style={styles.stabilityLabel}>PATIENT STABILITY</Text>
        <Text style={[styles.stabilityPct, { color: stabColor }]}>{stabPct}%</Text>
      </View>
      <View style={styles.stabilityTrack}>
        <LinearGradient colors={["#0B1A14", "#122A20"]} style={StyleSheet.absoluteFillObject} />
        <Animated.View
          style={[
            styles.stabilityFill,
            {
              width: stabilityAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) as any,
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
        <Animated.View
          style={[
            styles.stabilityOrb,
            {
              left: stabilityAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "98%"] }) as any,
              backgroundColor: stabColor,
            },
          ]}
        />
      </View>

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

// ── CareFlowPath — three glowing phase slots ──────────────────────────────────

function CareFlowPath({ tapSequence }: { tapSequence: string[] }) {
  return (
    <View style={styles.flowOuter}>
      <LinearGradient colors={["#0D1E2C", "#091420"]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.flowHeader}>
        <Ionicons name="git-branch-outline" size={11} color="#2DD4BF" />
        <Text style={styles.flowTitle}>CARE-FLOW PATH</Text>
      </View>

      <View style={styles.flowSlots}>
        {CARE_PHASES.map((carePhase, phaseIdx) => {
          const filledId    = tapSequence[phaseIdx];
          const filledAction = filledId ? ACTIONS.find((a) => a.id === filledId) : null;
          const isOk        = filledAction?.phaseIndex === phaseIdx;
          const slotColor   = filledAction ? (isOk ? carePhase.color : "#EF4444") : "#1E3830";

          return (
            <React.Fragment key={carePhase.step}>
              <View style={styles.flowSlot}>
                <View
                  style={[
                    styles.flowDot,
                    {
                      backgroundColor: filledAction ? slotColor + "22" : "rgba(5,12,18,0.5)",
                      borderColor: filledAction ? slotColor : "#2DD4BF22",
                    },
                  ]}
                >
                  {filledAction ? (
                    <Ionicons
                      name={isOk ? filledAction.icon : "close"}
                      size={16}
                      color={slotColor}
                    />
                  ) : (
                    <Text style={[styles.flowStepNum, { color: "#2DD4BF50" }]}>{carePhase.step}</Text>
                  )}
                </View>
                <Text
                  style={[styles.flowLabel, { color: filledAction ? slotColor : COLORS.onSurfaceTertiary }]}
                  numberOfLines={2}
                >
                  {filledAction ? filledAction.label.split(" ").slice(0, 2).join(" ") : carePhase.label}
                </Text>
              </View>

              {phaseIdx < CARE_PHASES.length - 1 && (
                <View
                  style={[
                    styles.flowConnector,
                    { backgroundColor: tapSequence[phaseIdx] ? "#2DD4BF35" : "#1E3830" },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      <View style={styles.flowPhaseStrip}>
        {CARE_PHASES.map((ph, i) => (
          <Text
            key={i}
            style={[styles.flowPhaseTag, { color: tapSequence[i] ? ph.color : "#2DD4BF28" }]}
          >
            {ph.label.toUpperCase()}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ── ActionCardTile — illustrated fantasy-medical card ─────────────────────────

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
  const { isHighlighted, isTutorialBlocked, onTargetPress, highlightStyle } = useHighlightTarget(action.id);
  const scaleAnim = useMemo(() => new Animated.Value(1), []);
  const glowAnim  = useMemo(() => new Animated.Value(0), []);
  const shakeX    = useMemo(() => new Animated.Value(0), []);

  const isTapped   = tapIndex !== null;
  const isCorrect  = isTapped && action.phaseIndex >= 0 && tapIndex === action.phaseIndex;
  const isWrong    = isTapped && !isCorrect;

  useEffect(() => {
    if (!isTapped) return;
    if (isCorrect) {
      glowAnim.setValue(0);
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 350, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 6,  duration: 50, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -4, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 4,  duration: 50, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0,  duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [isTapped, isCorrect, glowAnim, shakeX]);

  const handlePress = useCallback(() => {
    if (disabled || isTapped) return;
    // During a tutorial forced-action step, only the highlighted card is
    // allowed to fire — other cards are silently blocked so wrong taps have
    // no game effect (the visual scrim is now pointer-events:none on native).
    if (isTutorialBlocked) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 65, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    if (isHighlighted) onTargetPress();
    onTap(action.id);
  }, [disabled, isTapped, isHighlighted, isTutorialBlocked, onTargetPress, onTap, action.id, scaleAnim]);

  const ringColor   = isWrong ? "#EF4444" : action.color;
  const cardBg      = isTapped
    ? (isCorrect ? action.color + "12" : "#EF444412")
    : "rgba(14,24,38,0.75)";
  const borderColor = isTapped
    ? (isCorrect ? action.color + "66" : "#EF444455")
    : isHighlighted
      ? "#2DD4BF"
      : action.color + "30";

  return (
    <Animated.View
      style={[
        styles.cardWrap,
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
        {/* Fantasy-medical top-gradient glow */}
        <LinearGradient
          colors={[action.color + "09", "transparent"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        />

        {/* Correct flash overlay */}
        {isCorrect && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { borderRadius: RADIUS.md, backgroundColor: action.color + "18", opacity: glowAnim },
            ]}
          />
        )}

        {/* Wrong — caution rune corner */}
        {isWrong && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.cautionRune]}>
            <Ionicons name="warning-outline" size={13} color="#EF444455" />
          </View>
        )}

        {/* Large illustrated icon */}
        <View
          style={[
            styles.cardIconWrap,
            {
              backgroundColor: isTapped ? ringColor + "20" : action.color + "14",
              borderColor: isTapped ? ringColor + "60" : action.color + "30",
            },
          ]}
        >
          <Ionicons
            name={action.icon}
            size={28}
            color={isTapped ? ringColor : action.color}
          />
        </View>

        {/* Label */}
        <Text
          style={[styles.cardLabel, { color: isTapped ? COLORS.onSurface : COLORS.onSurfaceSecondary }]}
          numberOfLines={2}
        >
          {action.label}
        </Text>

        {/* Description / effect */}
        <Text style={styles.cardDesc} numberOfLines={2}>
          {isTapped ? action.glowDesc : action.shortDesc}
        </Text>

        {/* Wrong coaching */}
        {isWrong && action.coaching && (
          <Text style={styles.cautionCoach} numberOfLines={2}>{action.coaching}</Text>
        )}

        {/* Correct bottom glow bar */}
        {isCorrect && (
          <Animated.View
            pointerEvents="none"
            style={[styles.correctGlowBar, { backgroundColor: action.color, opacity: glowAnim }]}
          />
        )}

        {/* Phase badge on correct */}
        {isCorrect && (
          <View style={[styles.phaseBadge, { backgroundColor: action.color + "22", borderColor: action.color + "55" }]}>
            <Text style={[styles.phaseBadgeTxt, { color: action.color }]}>
              Step {action.phaseIndex + 1} · {CARE_PHASES[action.phaseIndex]?.label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

type GamePhase = "playing" | "review" | "complete";

const PHASE_REASONING: Record<number, string> = {
  0: "Assessing mental status (AVPU) confirms consciousness and whether it is safe to act — always the first step.",
  1: "Checking vitals (HR, RR, SpO₂, temp) maps the patient's true state. Wei's numbers are critically abnormal.",
  2: "Once swallow is confirmed intact, oral fluids begin gentle rehydration and support colour and recovery.",
};

export default function StabilizeStackScreen() {
  const router = useRouter();
  const { startTutorial, isCompleted, activeTutorialId } = useTutorial();

  const [tapSequence, setTapSequence] = useState<string[]>([]);
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [revealAnim] = useState(new Animated.Value(0));

  // Back navigation is blocked while playing — the back arrow / "Return to
  // University" buttons are the deliberate exits (forward replace, never a pop).
  useBlockBack();
  // Leaving mid-tutorial must never leak the overlay onto the next screen.
  useClearTutorialOnExit();

  // Auto-start the forced tutorial on first visit
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isCompleted("stabilizeIntro") && !activeTutorialId) {
        startTutorial("stabilizeIntro");
      }
    }, 600);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { requiredTargetId } = useTutorial();

  const handleTap = useCallback(
    (id: string) => {
      if (phase !== "playing") return;
      // Double-guard: if a tutorial step requires a specific card, ignore any
      // other card that somehow reaches this handler (e.g. rapid double-tap).
      if (requiredTargetId && id !== requiredTargetId) return;
      setTapSequence((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        if (next.length === CARE_PHASES.length) {
          setTimeout(() => setPhase("review"), 450);
          Animated.timing(revealAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
        }
        return next;
      });
    },
    [phase, revealAnim, requiredTargetId],
  );

  const tapIndexFor = useCallback(
    (id: string) => {
      const i = tapSequence.indexOf(id);
      return i === -1 ? null : i;
    },
    [tapSequence],
  );

  // Correct = tapped at the exact right phase position
  const correctCount = useMemo(
    () =>
      tapSequence.filter((id, idx) => {
        const a = ACTIONS.find((x) => x.id === id);
        return a && a.phaseIndex === idx;
      }).length,
    [tapSequence],
  );

  const wrongCount = useMemo(
    () =>
      tapSequence.filter((id, idx) => {
        const a = ACTIONS.find((x) => x.id === id);
        return !a || a.phaseIndex !== idx;
      }).length,
    [tapSequence],
  );

  const displayedActions = useMemo(() => DISPLAY_ORDER.map((i) => ACTIONS[i]), []);

  const grade =
    correctCount === CARE_PHASES.length
      ? { label: "Perfect Care Chain", color: "#2DD4BF", icon: "trophy"         as const }
      : correctCount === 2
        ? { label: "Good Instincts",   color: "#22C55E", icon: "checkmark-done" as const }
        : { label: "Keep Learning",    color: "#F59E0B", icon: "school"         as const };

  // ── Complete ─────────────────────────────────────────────────────────────────

  if (phase === "complete") {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <LinearGradient
          colors={["#0B1E2E", "#071018", COLORS.surface]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.replace("/university")} hitSlop={10}>
            <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
          </Pressable>
          <Text style={styles.kicker}>STABILIZE STACK · COMPLETE</Text>
        </View>
        <View style={styles.completeBody}>
          <View style={[styles.completeIcon, { borderColor: grade.color + "50" }]}>
            <Ionicons name={grade.icon} size={32} color={grade.color} />
          </View>
          <Text style={[styles.gradeLabel, { color: grade.color }]}>{grade.label}</Text>
          <Text style={styles.scoreDisplay}>{correctCount} / {CARE_PHASES.length}</Text>
          <Text style={styles.scoreCaption}>care steps placed correctly</Text>
          <View style={styles.completeDivider} />
          <Text style={styles.completeLearning}>
            Check Safety → Confirm Stability → Support Recovery. Always assess before you act — knowing the patient's mental state and vital signs guides every decision.
          </Text>
          <Pressable
            style={[styles.completeBtn, { backgroundColor: grade.color }]}
            onPress={() => router.replace("/university")}
            testID="stabilize-finish"
          >
            <Text style={[styles.completeBtnTxt, { color: COLORS.surface }]}>Return to University</Text>
            <Ionicons name="arrow-forward" size={14} color={COLORS.surface} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Playing + review ─────────────────────────────────────────────────────────

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
        <Text style={styles.kicker}>STABILIZE STACK</Text>
        <Text style={styles.tappedCount}>{tapSequence.length}/{CARE_PHASES.length}</Text>
      </View>

      <ScrollView
        style={SCROLL_FIX_WEB}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Immersive patient panel */}
        <PatientPanel runningCorrect={correctCount} wrongCount={wrongCount} />

        {/* 3-phase glowing care-flow path */}
        <CareFlowPath tapSequence={tapSequence} />

        {/* Instruction row */}
        <View style={styles.instructRow}>
          <Ionicons name="layers-outline" size={13} color="#2DD4BF" />
          <Text style={styles.instructTxt}>
            {phase === "playing"
              ? "Select 3 care actions in clinical order to build the path."
              : "Review: the correct care sequence is shown below."}
          </Text>
        </View>

        {/* Action cards — 2-column illustrated grid */}
        {phase === "playing" && (
          <View style={styles.cardGrid}>
            {displayedActions.map((action) => (
              <ActionCardTile
                key={action.id}
                action={action}
                tapIndex={tapIndexFor(action.id)}
                onTap={handleTap}
                disabled={tapSequence.length >= CARE_PHASES.length}
              />
            ))}
          </View>
        )}

        {/* Review phase */}
        {phase === "review" && (
          <Animated.View style={[styles.reviewWrap, { opacity: revealAnim }]}>
            {CARE_PHASES.map((carePhase, phaseIdx) => {
              const filledId     = tapSequence[phaseIdx];
              const filledAction = filledId ? ACTIONS.find((a) => a.id === filledId) : null;
              const correctAction = ACTIONS.find((a) => a.phaseIndex === phaseIdx);
              const isOk         = filledAction?.phaseIndex === phaseIdx;

              return (
                <View
                  key={phaseIdx}
                  style={[styles.reviewCard, { borderColor: (isOk ? carePhase.color : "#EF4444") + "40" }]}
                >
                  <LinearGradient
                    colors={
                      isOk
                        ? [carePhase.color + "12", carePhase.color + "06"]
                        : ["#EF444412", "#EF444406"]
                    }
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={styles.reviewTop}>
                    <View style={[styles.reviewNum, { backgroundColor: isOk ? carePhase.color : "#EF4444" }]}>
                      <Text style={styles.reviewNumTxt}>{phaseIdx + 1}</Text>
                    </View>
                    <View style={styles.reviewTitleWrap}>
                      <Text style={[styles.reviewPhaseLabel, { color: carePhase.color }]}>
                        {carePhase.label}
                      </Text>
                      <Text style={styles.reviewActionLabel}>{correctAction?.label}</Text>
                    </View>
                    <View style={styles.reviewPlayerBadge}>
                      <Ionicons
                        name={isOk ? "checkmark" : "close"}
                        size={11}
                        color={isOk ? carePhase.color : "#EF4444"}
                      />
                      <Text style={[styles.reviewPlayerTxt, { color: isOk ? carePhase.color : "#EF4444" }]}>
                        {isOk ? "Correct" : "Wrong"}
                      </Text>
                    </View>
                  </View>

                  {!isOk && filledAction && (
                    <Text style={styles.reviewWrongChoice}>
                      You chose: {filledAction.label}
                    </Text>
                  )}

                  <Text style={styles.reviewReasoning}>{PHASE_REASONING[phaseIdx]}</Text>

                  {!isOk && filledAction?.coaching && (
                    <Text style={styles.reviewCoaching}>{filledAction.coaching}</Text>
                  )}
                </View>
              );
            })}

            <View style={[styles.scoreRow, { marginTop: SPACING.sm }]}>
              <Text style={styles.scoreLbl}>Correct steps</Text>
              <Text style={[styles.scoreVal, { color: grade.color }]}>
                {correctCount}/{CARE_PHASES.length}
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
          onPress={() => router.replace("/university")}
          testID="stabilize-return"
        >
          <Ionicons name="chevron-back" size={15} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.backToUniTxt}>Back to University</Text>
        </Pressable>
      </ScrollView>

      {/* Tutorial narration + blocking scrim.
          Must be inside this screen so the highlighted card (zIndex 9500)
          can rise above the scrim. See SCROLL_FIX_WEB note at top. */}
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
  kicker: { color: "#06B6D4", fontSize: 10, fontWeight: "700", letterSpacing: 2, flex: 1 },
  tappedCount: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },

  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 64, gap: SPACING.md },

  // ── Patient card ──────────────────────────────────────────────────────────
  patientCard: {
    borderRadius: RADIUS.lg, overflow: "hidden",
    borderWidth: 1, borderColor: "#06B6D430",
    padding: SPACING.md, gap: SPACING.sm,
  },
  patientRow:   { flexDirection: "row", alignItems: "center", gap: SPACING.md },
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

  // ── Patient scene ─────────────────────────────────────────────────────────
  sceneWrap: {
    width: "100%", aspectRatio: PATIENT_SCENE_RATIO,
    borderRadius: RADIUS.md, overflow: "hidden",
    borderWidth: 1, borderColor: "#06B6D425",
    backgroundColor: "#091420",
  },
  sceneVignette: { ...StyleSheet.absoluteFillObject, backgroundColor: "#7F1D1D" },
  sceneHeal:     { ...StyleSheet.absoluteFillObject, backgroundColor: "#2DD4BF" },
  sceneBottomFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "46%" },
  symptomRow: {
    position: "absolute", left: SPACING.sm, right: SPACING.sm, bottom: SPACING.sm,
    flexDirection: "row", flexWrap: "wrap", gap: 6,
  },
  symptomChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(5,12,18,0.78)", borderWidth: 1,
    borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 4,
  },
  symptomDot: { width: 6, height: 6, borderRadius: 3 },
  symptomTxt: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },

  // ── Stability bar ─────────────────────────────────────────────────────────
  stabilityRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stabilityLabel:{ color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  stabilityPct:  { fontSize: 11, fontWeight: "700" },
  stabilityTrack: {
    height: 8, borderRadius: 4, overflow: "hidden",
    backgroundColor: "#0B1A14", borderWidth: 1, borderColor: "#2DD4BF14",
    position: "relative",
  },
  stabilityFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4, overflow: "hidden" },
  stabilityOrb:  {
    position: "absolute", width: 10, height: 10, borderRadius: 5, top: -1,
    shadowColor: "#2DD4BF", shadowOpacity: 0.9, shadowRadius: 6,
  },

  // ── Vitals ────────────────────────────────────────────────────────────────
  vitalStrip: {
    flexDirection: "row", justifyContent: "space-between",
    paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  vitalItem:  { alignItems: "center", gap: 2 },
  vitalLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  vitalValue: { color: COLORS.onSurfaceSecondary, fontSize: 15, fontWeight: "300" },
  vitalAlert: { color: "#EF4444" },

  // ── Care-flow path ────────────────────────────────────────────────────────
  flowOuter: {
    borderRadius: RADIUS.md, overflow: "hidden",
    borderWidth: 1, borderColor: "#2DD4BF18",
    padding: SPACING.sm, gap: 4,
  },
  flowHeader:   { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  flowTitle:    { color: "#2DD4BF", fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  flowSlots:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  flowSlot:     { alignItems: "center", gap: 4, flex: 1 },
  flowDot: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
  },
  flowStepNum:  { fontSize: 13, fontWeight: "700" },
  flowLabel: {
    fontSize: 8, fontWeight: "600", textAlign: "center",
    letterSpacing: 0.2, lineHeight: 11,
  },
  flowConnector:   { height: 1.5, flex: 0.18, marginBottom: 22 },
  flowPhaseStrip:  { flexDirection: "row", justifyContent: "space-around" },
  flowPhaseTag: {
    fontSize: 7, fontWeight: "700", letterSpacing: 0.8,
    textAlign: "center", flex: 1,
  },

  // ── Instruction ───────────────────────────────────────────────────────────
  instructRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  instructTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, flex: 1 },

  // ── Action cards (2-column grid) ──────────────────────────────────────────
  cardGrid:  { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  cardWrap:  { width: "48%" },
  card: {
    borderRadius: RADIUS.md, borderWidth: 1,
    padding: SPACING.md, gap: SPACING.sm, overflow: "hidden",
    minHeight: 128,
  },
  cardHighlightShadow: {
    shadowColor: "#2DD4BF", shadowOpacity: 0.75, shadowRadius: 12, elevation: 18,
  },
  cardIconWrap: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, alignSelf: "center",
  },
  cardLabel: { fontSize: 13, fontWeight: "700", lineHeight: 17, textAlign: "center" },
  cardDesc:  { color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 14, textAlign: "center" },

  correctGlowBar: { height: 2, borderRadius: 1, marginTop: 2 },
  cautionRune:    { alignItems: "flex-end", justifyContent: "flex-end", padding: SPACING.sm },
  cautionCoach:   { color: "#EF4444AA", fontSize: 9, lineHeight: 13, fontStyle: "italic", textAlign: "center" },
  phaseBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 2,
  },
  phaseBadgeTxt: { fontSize: 8, fontWeight: "700", letterSpacing: 0.3, textAlign: "center" },

  // ── Review ────────────────────────────────────────────────────────────────
  reviewWrap: { gap: SPACING.sm },
  reviewCard: {
    borderRadius: RADIUS.md, borderWidth: 1,
    backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.md, gap: SPACING.sm, overflow: "hidden",
  },
  reviewTop:         { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  reviewNum:         { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  reviewNumTxt:      { color: COLORS.surface, fontSize: 13, fontWeight: "800" },
  reviewTitleWrap:   { flex: 1, gap: 2 },
  reviewPhaseLabel:  { fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  reviewActionLabel: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700" },
  reviewPlayerBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderWidth: 1, borderRadius: RADIUS.pill, borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 6, paddingVertical: 3,
  },
  reviewPlayerTxt:  { fontSize: 10, fontWeight: "700" },
  reviewWrongChoice:{ color: COLORS.onSurfaceTertiary, fontSize: 11, fontStyle: "italic" },
  reviewReasoning:  { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },
  reviewCoaching:   { color: "#F59E0BAA", fontSize: 11, lineHeight: 16, fontStyle: "italic" },

  scoreRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreLbl:    { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  scoreVal:    { fontSize: 20, fontWeight: "800" },
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

  // ── Back to university ────────────────────────────────────────────────────
  backToUni: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "center", paddingVertical: SPACING.sm,
  },
  backToUniTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
});
