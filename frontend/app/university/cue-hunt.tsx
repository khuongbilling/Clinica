/**
 * Cue Hunt — The Fading Apprentice
 *
 * A visual patient scene where the player taps clinical clues hidden in a
 * Lotus-infirmary illustration built from pure React Native views.
 *
 * Required clues (3):   dry_lips · weak_posture · water_flask
 * Distractors (3):      window · books · scroll
 *
 * Tutorial: cueHuntIntro (forced, System-narrated). Step 1 primes the player
 * with "Before you treat, learn to see. Tap the dry lips." Step 2 blocks all
 * taps via TutorialOverlay scrim and highlights only clue_dry_lips (zIndex 9500).
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { playRewardCue } from "@/src/game/cues";
import { useTutorial, useHighlightTarget } from "@/src/game/tutorialStore";
import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ─────────────────────────────────────────────────────────────────────────────
// Zone definitions
// All positions are FRACTIONS OF scW (scene width), not percentages of scH.
// scH is always scW * SCENE_RATIO. Using a single linear unit keeps the layout
// pixel-perfect regardless of actual screen size.
// ─────────────────────────────────────────────────────────────────────────────

const SCENE_RATIO = 1.35; // scH = scW * SCENE_RATIO
const REQUIRED_COUNT = 3;

interface ZoneDef {
  id: string;
  label: string;
  feedback: string;
  isRequired: boolean;
  cx: number; // center x as fraction of scW
  cy: number; // center y as fraction of scW  (NOT scH)
  r: number;  // radius as fraction of scW
  color: string;
}

const ZONES: readonly ZoneDef[] = [
  // ── Required ─────────────────────────────────────────────────────────────
  {
    id: "clue_dry_lips",
    label: "Dry lips",
    feedback: "Cracked and pale — dehydration sign.",
    isRequired: true,
    cx: 0.500, cy: 0.375, r: 0.086,
    color: "#2DD4BF",
  },
  {
    id: "clue_weak_posture",
    label: "Weak posture",
    feedback: "Slumped shoulders — low energy, muscle weakness.",
    isRequired: true,
    cx: 0.500, cy: 0.690, r: 0.108,
    color: "#2DD4BF",
  },
  {
    id: "clue_water_flask",
    label: "Empty flask",
    feedback: "Almost empty — not been drinking enough.",
    isRequired: true,
    cx: 0.826, cy: 0.685, r: 0.078,
    color: "#D4AF37",
  },
  // ── Distractors ───────────────────────────────────────────────────────────
  {
    id: "distractor_window",
    label: "",
    feedback: "",
    isRequired: false,
    cx: 0.500, cy: 0.115, r: 0.108,
    color: "#F59E0B",
  },
  {
    id: "distractor_books",
    label: "",
    feedback: "",
    isRequired: false,
    cx: 0.125, cy: 0.740, r: 0.084,
    color: "#7C3AED",
  },
  {
    id: "distractor_scroll",
    label: "",
    feedback: "",
    isRequired: false,
    cx: 0.190, cy: 1.030, r: 0.073,
    color: "#D97706",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// ClueZone — single tappable zone in the scene
// ─────────────────────────────────────────────────────────────────────────────

interface ClueZoneProps {
  zone: ZoneDef;
  scW: number;
  found: boolean;
  onCorrect: (z: ZoneDef) => void;
  onWrong: () => void;
}

function ClueZone({ zone, scW, found, onCorrect, onWrong }: ClueZoneProps) {
  const { isHighlighted, onTargetPress } = useHighlightTarget(zone.id);

  const rPx = zone.r * scW;
  const dPx = rPx * 2;
  const leftPx = zone.cx * scW - rPx;
  const topPx = zone.cy * scW - rPx; // cy is also a fraction of scW

  // Pulse ring for unfound zones
  const pulse = useRef(new Animated.Value(0)).current;
  // One-shot glow burst on found
  const burstScale = useRef(new Animated.Value(1)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;
  // Shake for wrong taps
  const shakeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (found) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [found, pulse]);

  useEffect(() => {
    if (!found) return;
    burstScale.setValue(1);
    burstOpacity.setValue(0.85);
    Animated.parallel([
      Animated.spring(burstScale, { toValue: 2.5, speed: 3, useNativeDriver: true }),
      Animated.timing(burstOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, [found, burstScale, burstOpacity]);

  const handlePress = useCallback(() => {
    if (zone.isRequired) {
      if (found) return;
      if (isHighlighted) onTargetPress();
      onCorrect(zone);
    } else {
      Animated.sequence([
        Animated.timing(shakeX, { toValue: -8, duration: 48, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 8, duration: 48, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -5, duration: 48, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 5, duration: 48, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 48, useNativeDriver: true }),
      ]).start();
      onWrong();
    }
  }, [zone, found, isHighlighted, onTargetPress, onCorrect, onWrong, shakeX]);

  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.40] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.10] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: leftPx,
        top: topPx,
        width: dPx,
        height: dPx,
        transform: [{ translateX: shakeX }],
        zIndex: isHighlighted ? 9500 : 1,
      }}
    >
      {/* Glow burst — runs once on found */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: dPx, height: dPx, borderRadius: rPx,
          borderWidth: 2.5, borderColor: zone.color,
          transform: [{ scale: burstScale }],
          opacity: burstOpacity,
        }}
      />

      {/* Tutorial highlight aura — shown when this zone is the forced target */}
      {isHighlighted && !found && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: dPx + 16, height: dPx + 16,
            left: -8, top: -8,
            borderRadius: rPx + 8,
            borderWidth: 2.5, borderColor: "#2DD4BF",
            backgroundColor: "#2DD4BF14",
            shadowColor: "#2DD4BF",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.95,
            shadowRadius: 16,
          }}
        />
      )}

      {/* Pulsing ring — unfound, not highlighted */}
      {!found && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: dPx, height: dPx, borderRadius: rPx,
            borderWidth: isHighlighted ? 2.5 : 1.5,
            borderColor: isHighlighted ? "#2DD4BF" : zone.color,
            opacity: isHighlighted ? 0.88 : pulseOpacity,
            transform: [{ scale: isHighlighted ? 1.08 : pulseScale }],
          }}
        />
      )}

      {/* Solid ring + checkmark — found state */}
      {found && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: dPx, height: dPx, borderRadius: rPx,
            borderWidth: 2.5, borderColor: zone.color,
            backgroundColor: zone.color + "22",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="checkmark" size={dPx * 0.38} color={zone.color} />
        </View>
      )}

      {/* Hit area — transparent Pressable over the full zone */}
      <Pressable
        style={{
          position: "absolute",
          width: dPx, height: dPx, borderRadius: rPx,
        }}
        onPress={handlePress}
        testID={`zone-${zone.id}`}
      />

      {/* Label badge below the zone, visible when found */}
      {found && !!zone.label && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: dPx + 5,
            alignSelf: "center",
            backgroundColor: zone.color + "22",
            borderRadius: RADIUS.pill,
            borderWidth: 1, borderColor: zone.color + "55",
            paddingHorizontal: 7, paddingVertical: 3,
          }}
        >
          <Text
            style={{ color: zone.color, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}
          >
            {zone.label}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InfirmaryScene — the full visual room layout
// scW is the actual scene container width (in pixels). All positions use scW
// as the base unit. scH is implicit (= scW * SCENE_RATIO).
// ─────────────────────────────────────────────────────────────────────────────

interface SceneProps {
  scW: number;
  found: Set<string>;
  onCorrect: (z: ZoneDef) => void;
  onWrong: () => void;
}

function InfirmaryScene({ scW, found, onCorrect, onWrong }: SceneProps) {
  const U = scW; // base unit shorthand

  return (
    <View style={{ width: U, height: U * SCENE_RATIO, overflow: "hidden" }}>
      {/* ── ROOM BACKGROUND ────────────────────────────────────────────── */}
      <LinearGradient
        colors={["#1C3C30", "#153028", "#0E2018"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Floor area — slightly darker, separated by a faint line */}
      <View style={{
        position: "absolute",
        top: U * 0.95, left: 0, right: 0,
        height: U * (SCENE_RATIO - 0.95),
        backgroundColor: "#0C1A10",
      }} />
      <View style={{
        position: "absolute",
        top: U * 0.95, left: 0, right: 0, height: 1,
        backgroundColor: "#2DD4BF18",
      }} />

      {/* ── WINDOW ARCH (back wall, top center) ────────────────────────── */}
      {/* Outer warm ambient glow */}
      <View style={{
        position: "absolute",
        left: U * 0.30, top: -U * 0.04,
        width: U * 0.40, height: U * 0.30,
        borderTopLeftRadius: U * 0.20,
        borderTopRightRadius: U * 0.20,
        backgroundColor: "#F5C840",
        opacity: 0.09,
      }} />
      {/* Arch frame */}
      <View style={{
        position: "absolute",
        left: U * 0.335, top: 0,
        width: U * 0.33, height: U * 0.26,
        borderTopLeftRadius: U * 0.165,
        borderTopRightRadius: U * 0.165,
        borderWidth: 1.5, borderBottomWidth: 0,
        borderColor: "#F5C84055",
        overflow: "hidden",
      }}>
        <LinearGradient
          colors={["#F5C84028", "#F5C84005"]}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Dividing bar in arch */}
        <View style={{
          position: "absolute", bottom: 0,
          left: "50%", width: 1.5, height: "52%",
          backgroundColor: "#F5C84030",
          transform: [{ translateX: -0.75 }],
        }} />
      </View>

      {/* Thin pillar lines flanking the window */}
      <View style={{
        position: "absolute", top: 0,
        left: U * 0.275, width: 1.5, height: U * 0.28,
        backgroundColor: "#2DD4BF18",
      }} />
      <View style={{
        position: "absolute", top: 0,
        right: U * 0.275, width: 1.5, height: U * 0.28,
        backgroundColor: "#2DD4BF18",
      }} />

      {/* Wall ambient gradient near window (lotus glow) */}
      <LinearGradient
        colors={["#F5C84012", "transparent"]}
        style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: U * 0.35,
        }}
      />

      {/* ── BOOK STACK (left wall) ─────────────────────────────────────── */}
      {([
        { dy: 0.00, w: 0.130, c: "#2D4428" },
        { dy: 0.055, w: 0.110, c: "#1E3518" },
        { dy: 0.110, w: 0.145, c: "#3A5230" },
      ] as const).map((b, i) => (
        <View key={i} style={{
          position: "absolute",
          left: U * 0.040, top: U * 0.690 + U * b.dy,
          width: U * b.w, height: U * 0.048,
          backgroundColor: b.c, borderRadius: 2,
          borderRightWidth: 1, borderRightColor: "#FFFFFF10",
        }} />
      ))}
      {/* Gold accent spine line on books */}
      <View style={{
        position: "absolute",
        left: U * 0.040, top: U * 0.690,
        width: 2, height: U * 0.158,
        backgroundColor: "#D4AF3725",
      }} />

      {/* ── SCROLL (floor left) ────────────────────────────────────────── */}
      <View style={{
        position: "absolute",
        left: U * 0.148, top: U * 0.968,
        width: U * 0.082, height: U * 0.140,
        borderRadius: U * 0.041,
        backgroundColor: "#8B6E3A",
        borderWidth: 1, borderColor: "#A0804A40",
        overflow: "hidden",
      }}>
        {/* Scroll end caps */}
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: U * 0.020, backgroundColor: "#6A5228",
          borderRadius: U * 0.041,
        }} />
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: U * 0.020, backgroundColor: "#6A5228",
          borderRadius: U * 0.041,
        }} />
      </View>

      {/* ── SIDE TABLE (right) ─────────────────────────────────────────── */}
      {/* Table top surface */}
      <View style={{
        position: "absolute",
        left: U * 0.700, top: U * 0.852,
        width: U * 0.220, height: U * 0.026,
        backgroundColor: "#2A3C30", borderRadius: 3,
        borderTopWidth: 1, borderTopColor: "#3C5040",
      }} />
      {/* Table leg */}
      <View style={{
        position: "absolute",
        left: U * 0.793, top: U * 0.878,
        width: U * 0.032, height: U * 0.120,
        backgroundColor: "#1E2E24", borderRadius: 2,
      }} />

      {/* ── FLASK (on table, right) ────────────────────────────────────── */}
      {/* Flask cap */}
      <View style={{
        position: "absolute",
        left: U * 0.795, top: U * 0.516,
        width: U * 0.062, height: U * 0.022,
        backgroundColor: "#2A4840", borderRadius: 3,
        borderWidth: 1, borderColor: "#3A5A5050",
      }} />
      {/* Flask body */}
      <View style={{
        position: "absolute",
        left: U * 0.800, top: U * 0.535,
        width: U * 0.052, height: U * 0.320,
        borderRadius: U * 0.026,
        backgroundColor: "#1A3430",
        borderWidth: 1.5, borderColor: "#D4AF3748",
        overflow: "hidden",
      }}>
        {/* Water level — only ~10% full at the very bottom */}
        <View style={{
          position: "absolute",
          bottom: 0, left: 2, right: 2, height: "10%",
          backgroundColor: "#2DD4BF32", borderRadius: U * 0.022,
        }} />
        {/* Subtle highlight stripe on glass */}
        <View style={{
          position: "absolute",
          left: U * 0.010, top: U * 0.025,
          width: U * 0.010, height: "55%",
          backgroundColor: "#FFFFFF14", borderRadius: 3,
        }} />
      </View>

      {/* ── HEALING MAT / CUSHION ─────────────────────────────────────── */}
      {/* Raised platform */}
      <View style={{
        position: "absolute",
        left: U * 0.200, top: U * 0.978,
        width: U * 0.400, height: U * 0.065,
        backgroundColor: "#142820", borderRadius: 6,
      }} />
      {/* Mat surface */}
      <View style={{
        position: "absolute",
        left: U * 0.215, top: U * 0.985,
        width: U * 0.370, height: U * 0.054,
        backgroundColor: "#1D4040", borderRadius: 5,
        borderWidth: 1, borderColor: "#2DD4BF2A",
      }} />
      {/* Mat teal trim lines */}
      <View style={{
        position: "absolute",
        left: U * 0.215, top: U * 0.985,
        width: U * 0.370, height: 1.5,
        backgroundColor: "#2DD4BF20",
      }} />
      <View style={{
        position: "absolute",
        left: U * 0.215, top: U * 0.985 + U * 0.052,
        width: U * 0.370, height: 1.5,
        backgroundColor: "#2DD4BF20",
      }} />

      {/* ── PATIENT FIGURE ────────────────────────────────────────────── */}
      {/* Hair — slightly behind and above the head */}
      <View style={{
        position: "absolute",
        left: U * 0.378, top: U * 0.220,
        width: U * 0.244, height: U * 0.130,
        borderRadius: U * 0.120,
        backgroundColor: "#2D1A0A",
      }} />

      {/* Head (circle) */}
      <View style={{
        position: "absolute",
        left: U * 0.420, top: U * 0.260,
        width: U * 0.160, height: U * 0.160,
        borderRadius: U * 0.080,
        backgroundColor: "#C4957A",
      }}>
        {/* Lower face shading (chin/neck blend) */}
        <View style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0, height: "45%",
          borderBottomLeftRadius: U * 0.080,
          borderBottomRightRadius: U * 0.080,
          backgroundColor: "#B5866A",
        }} />
      </View>

      {/* Neck */}
      <View style={{
        position: "absolute",
        left: U * 0.468, top: U * 0.418,
        width: U * 0.064, height: U * 0.058,
        backgroundColor: "#B5866A",
        borderRadius: 3,
      }} />

      {/* Shoulders — slightly drooped left (showing weak posture) */}
      <View style={{
        position: "absolute",
        left: U * 0.258, top: U * 0.462,
        width: U * 0.484, height: U * 0.096,
        borderRadius: U * 0.048,
        backgroundColor: "#C4DED8",
        transform: [{ rotate: "2.5deg" }],
      }} />

      {/* Body / robe — main garment */}
      <View style={{
        position: "absolute",
        left: U * 0.332, top: U * 0.528,
        width: U * 0.336, height: U * 0.430,
        borderRadius: 10,
        backgroundColor: "#D4E8E4",
        transform: [{ rotate: "1.5deg" }],
        overflow: "hidden",
      }}>
        {/* Subtle robe center line */}
        <View style={{
          position: "absolute",
          left: "50%", top: 0, width: 1.5, height: "100%",
          backgroundColor: "#9DC8C220",
          transform: [{ translateX: -0.75 }],
        }} />
        {/* Robe fold shading */}
        <LinearGradient
          colors={["transparent", "#7AADA826"]}
          start={{ x: 0, y: 0.4 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>

      {/* Legs / robe hem on mat */}
      <View style={{
        position: "absolute",
        left: U * 0.260, top: U * 0.928,
        width: U * 0.480, height: U * 0.080,
        borderRadius: 8,
        backgroundColor: "#BAD2CC",
        transform: [{ rotate: "1deg" }],
      }} />

      {/* ── AMBIENT PARTICLES (Lotus magic) ──────────────────────────── */}
      {[
        { px: 0.220, py: 0.142, pr: 2.5, po: 0.32 },
        { px: 0.762, py: 0.178, pr: 3.0, po: 0.26 },
        { px: 0.370, py: 0.640, pr: 2.0, po: 0.18 },
        { px: 0.655, py: 0.295, pr: 2.0, po: 0.20 },
        { px: 0.140, py: 0.460, pr: 1.5, po: 0.15 },
      ].map((p, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: U * p.px - p.pr,
            top: U * p.py - p.pr,
            width: p.pr * 2, height: p.pr * 2,
            borderRadius: p.pr,
            backgroundColor: "#2DD4BF",
            opacity: p.po,
          }}
        />
      ))}

      {/* ── CLUE ZONES — rendered above all scene elements ─────────── */}
      {ZONES.map((zone) => (
        <ClueZone
          key={zone.id}
          zone={zone}
          scW={scW}
          found={found.has(zone.id)}
          onCorrect={onCorrect}
          onWrong={onWrong}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CueHuntScreen — main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function CueHuntScreen() {
  const router = useRouter();
  const { startTutorial, isCompleted, activeTutorialId } = useTutorial();

  const [scW, setScW] = useState(0);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"playing" | "complete">("playing");
  const [toastText, setToastText] = useState("");
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const requiredFound = [...found].filter(
    (id) => ZONES.find((z) => z.id === id)?.isRequired,
  ).length;

  // Auto-start tutorial once (delayed to avoid hydration race)
  useEffect(() => {
    const t = setTimeout(() => {
      if (!isCompleted("cueHuntIntro") && !activeTutorialId) {
        startTutorial("cueHuntIntro");
      }
    }, 700);
    return () => clearTimeout(t);
  }, []);

  // Transition to complete when all required clues found
  useEffect(() => {
    if (requiredFound >= REQUIRED_COUNT && phase === "playing") {
      setTimeout(() => setPhase("complete"), 450);
    }
  }, [requiredFound, phase]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setScW(e.nativeEvent.layout.width);
  }, []);

  const showToast = useCallback(
    (msg: string) => {
      if (!msg) return;
      setToastText(msg);
      toastOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1100),
        Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setToastText(""));
    },
    [toastOpacity],
  );

  const handleCorrect = useCallback(
    (zone: ZoneDef) => {
      setFound((prev) => {
        if (prev.has(zone.id)) return prev;
        return new Set([...prev, zone.id]);
      });
      playRewardCue();
      showToast(zone.feedback);
    },
    [showToast],
  );

  const handleWrong = useCallback(() => {
    // Visual shake handled inside ClueZone — no toast, no penalty
  }, []);

  const dots = Array.from({ length: REQUIRED_COUNT }, (_, i) => i < requiredFound);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#162C24", "#0E2018", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/university")}
          hitSlop={10}
          testID="cue-hunt-back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.kicker}>CUE HUNT</Text>
          <Text style={styles.caseName}>The Fading Apprentice</Text>
        </View>
        {/* Progress dots — teal when found */}
        <View style={styles.dotRow}>
          {dots.map((filled, i) => (
            <View key={i} style={[styles.dot, filled && styles.dotFilled]} />
          ))}
        </View>
      </View>

      {/* ── OBJECTIVE STRIP ───────────────────────────────────────────── */}
      <View style={styles.objectiveRow}>
        <Ionicons name="eye-outline" size={13} color="#2DD4BF" />
        <Text style={styles.objectiveTxt}>
          Find 3 clues · {requiredFound}/3 found
        </Text>
      </View>

      {/* ── SCENE ─────────────────────────────────────────────────────── */}
      <View style={styles.sceneOuter}>
        {/* The scene container has a fixed aspect ratio so the Lotus
            infirmary room always renders at the same proportions.
            onLayout gives us the actual width, which we use as the base
            unit (scW) for all scene element positions. */}
        <View
          style={styles.sceneContainer}
          onLayout={handleLayout}
        >
          {scW > 0 && (
            <InfirmaryScene
              scW={scW}
              found={found}
              onCorrect={handleCorrect}
              onWrong={handleWrong}
            />
          )}

          {/* Short feedback toast, positioned inside scene at the bottom */}
          {toastText !== "" && (
            <Animated.View
              style={[styles.toast, { opacity: toastOpacity }]}
              pointerEvents="none"
            >
              <Text style={styles.toastTxt}>{toastText}</Text>
            </Animated.View>
          )}
        </View>
      </View>

      {/* ── BOTTOM: completion feedback OR back link ──────────────────── */}
      {phase === "complete" ? (
        <View style={styles.completionCard}>
          <LinearGradient
            colors={["#0D3B38", "#152E2A"]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Icon + kicker row */}
          <View style={styles.completeTopRow}>
            <View style={styles.completeIconWrap}>
              <Ionicons name="checkmark-done" size={14} color="#2DD4BF" />
            </View>
            <Text style={styles.completeKicker}>ROUND COMPLETE</Text>
          </View>

          {/* Observation — what the player noticed */}
          <Text style={styles.observationTxt}>
            "You noticed dry lips, weakness, and poor intake."
          </Text>

          {/* Clinical connection */}
          <Text style={styles.clinicalTxt}>
            These clues suggest dehydration risk.
          </Text>

          {/* Action row */}
          <View style={styles.completeActions}>
            <Pressable
              style={styles.learnWhyBtn}
              onPress={() => router.push("/university/cue-hunt-lesson" as any)}
              testID="cue-hunt-learn-why"
            >
              <Text style={styles.learnWhyTxt}>Learn Why</Text>
              <Ionicons name="arrow-forward" size={13} color="#0B1A18" />
            </Pressable>
            <Pressable
              onPress={() => goBack(router, "/university")}
              testID="cue-hunt-finish"
            >
              <Text style={styles.completeBackTxt}>Back to University</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={styles.backToUni}
          onPress={() => goBack(router, "/university")}
          testID="cue-hunt-return"
        >
          <Ionicons name="chevron-back" size={15} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.backToUniTxt}>Back to University</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

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
  kicker: { color: "#2DD4BF", fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  caseName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "300", letterSpacing: 0.4 },
  dotRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.border },
  dotFilled: { backgroundColor: "#2DD4BF" },

  objectiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  objectiveTxt: {
    color: "#2DD4BF",
    fontSize: 12, fontWeight: "700", letterSpacing: 0.5,
  },

  sceneOuter: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    alignItems: "center",
  },
  sceneContainer: {
    // Fixed aspect ratio keeps the Lotus infirmary room proportional on all sizes.
    // scW * SCENE_RATIO = height, so aspectRatio (w/h) = 1/SCENE_RATIO.
    aspectRatio: 1 / SCENE_RATIO,
    width: "100%",
    maxWidth: 480,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2DD4BF18",
  },

  toast: {
    position: "absolute",
    bottom: SPACING.md,
    alignSelf: "center",
    backgroundColor: "rgba(13,59,56,0.92)",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: "#2DD4BF40",
  },
  toastTxt: { color: "#2DD4BF", fontSize: 12, fontWeight: "600" },

  completionCard: {
    margin: SPACING.lg,
    marginTop: 0,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: "#2DD4BF30",
    overflow: "hidden",
  },
  completeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  completeIconWrap: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#2DD4BF18",
    borderWidth: 1, borderColor: "#2DD4BF40",
    alignItems: "center", justifyContent: "center",
  },
  completeKicker: {
    color: "#2DD4BF",
    fontSize: 9, fontWeight: "700", letterSpacing: 2,
  },
  observationTxt: {
    color: COLORS.onSurface,
    fontSize: 15, fontStyle: "italic", fontWeight: "300",
    lineHeight: 22,
  },
  clinicalTxt: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  completeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginTop: SPACING.xs ?? 4,
  },
  learnWhyBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#2DD4BF",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.lg, paddingVertical: 14,
    minHeight: 44,
  },
  learnWhyTxt: { color: "#0B1A18", fontSize: 13, fontWeight: "800" },
  completeBackTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13, fontWeight: "600",
  },

  backToUni: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: SPACING.md, paddingBottom: SPACING.xl,
  },
  backToUniTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
});
