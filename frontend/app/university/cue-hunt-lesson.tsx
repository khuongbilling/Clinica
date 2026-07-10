/**
 * Cue Hunt Lesson — Dehydration Basics · The Fading Apprentice
 *
 * Short linked lesson reached from "Learn Why" on the Cue Hunt completion panel.
 * Three teaching beats, one at a time. Tap Next to advance; tap Apply It on the
 * final beat to move toward the Rapid Triage challenge.
 *
 * Design: beat-by-beat fade transition, centered icon + heading + body,
 * progress dots at top. No long text blocks, no MCQs, no old lesson format.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ─────────────────────────────────────────────────────────────────────────────
// Teaching beats
// ─────────────────────────────────────────────────────────────────────────────

interface Beat {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  step: string;
  heading: string;
  body: string;
  accentColor: string;
}

const BEATS: Beat[] = [
  {
    icon: "water-outline",
    step: "STEP 1",
    heading: "Recognising Dehydration",
    body: "Dehydration can show as dry mouth, dizziness, weakness, thirst, or low urine output.",
    accentColor: "#2DD4BF",
  },
  {
    icon: "pulse-outline",
    step: "STEP 2",
    heading: "Assess Before You Act",
    body: "First, assess severity. Check mental status, vital signs, and whether the patient can safely drink.",
    accentColor: "#2DD4BF",
  },
  {
    icon: "warning-outline",
    step: "STEP 3",
    heading: "Don't Rush Treatment",
    body: "Do not jump to treatment before you know how unstable the patient is.",
    accentColor: "#F59E0B",
  },
];

const TOTAL = BEATS.length;

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function CueHuntLessonScreen() {
  const router = useRouter();
  const [beatIdx, setBeatIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const beat = BEATS[beatIdx];
  const isLast = beatIdx === TOTAL - 1;

  const advance = () => {
    // Fade out current beat
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      if (isLast) {
        // Navigate to Apply It placeholder
        router.push("/university/apply-it" as any);
        // Reset for if user navigates back
        setBeatIdx(0);
        fadeAnim.setValue(1);
      } else {
        setBeatIdx((prev) => prev + 1);
        // Fade in next beat
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      }
    });
  };

  const dots = Array.from({ length: TOTAL }, (_, i) => i);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#162C24", "#0E2018", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/university")}
          hitSlop={10}
          testID="lesson-back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.kicker}>DEHYDRATION BASICS</Text>
          <Text style={styles.subtitle}>The Fading Apprentice</Text>
        </View>
        <Text style={styles.counter}>
          {beatIdx + 1}/{TOTAL}
        </Text>
      </View>

      {/* ── PROGRESS DOTS ───────────────────────────────────────────── */}
      <View style={styles.dotRow}>
        {dots.map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < beatIdx && styles.dotPast,
              i === beatIdx && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* ── BEAT CONTENT (fades in/out on advance) ──────────────────── */}
      <Animated.View style={[styles.beatArea, { opacity: fadeAnim }]}>
        {/* Icon circle */}
        <View
          style={[
            styles.iconCircle,
            {
              borderColor: beat.accentColor + "50",
              backgroundColor: beat.accentColor + "14",
              shadowColor: beat.accentColor,
            },
          ]}
        >
          <Ionicons name={beat.icon} size={34} color={beat.accentColor} />
        </View>

        {/* Step label */}
        <Text style={[styles.stepLabel, { color: beat.accentColor }]}>
          {beat.step}
        </Text>

        {/* Heading */}
        <Text style={styles.heading}>{beat.heading}</Text>

        {/* Body — one short idea */}
        <View style={styles.bodyCard}>
          <LinearGradient
            colors={["#1A3830", "#142C26"]}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={styles.bodyTxt}>{beat.body}</Text>
        </View>

        {/* Connecting thought on beat 1 — links back to Cue Hunt */}
        {beatIdx === 0 && (
          <Text style={styles.connectTxt}>
            ← This is what dry lips, weak posture, and an empty flask were telling you.
          </Text>
        )}
      </Animated.View>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <View style={styles.ctaRow}>
        {isLast ? (
          <Pressable
            style={styles.applyBtn}
            onPress={advance}
            testID="lesson-apply-it"
          >
            <Text style={styles.applyTxt}>Apply It</Text>
            <Ionicons name="arrow-forward" size={14} color="#0B1A18" />
          </Pressable>
        ) : (
          <Pressable
            style={styles.nextBtn}
            onPress={advance}
            testID={`lesson-next-${beatIdx}`}
          >
            <Text style={styles.nextTxt}>Next</Text>
            <Ionicons name="chevron-forward" size={14} color="#2DD4BF" />
          </Pressable>
        )}
      </View>
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
  kicker: {
    color: "#2DD4BF",
    fontSize: 9, fontWeight: "700", letterSpacing: 2,
  },
  subtitle: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 12, fontWeight: "300",
  },
  counter: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12, fontWeight: "600",
  },

  // Progress
  dotRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingBottom: SPACING.sm,
  },
  dot: {
    width: 28, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  dotPast: { backgroundColor: "#2DD4BF60" },
  dotActive: { backgroundColor: "#2DD4BF" },

  // Beat area
  beatArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    marginBottom: SPACING.sm,
  },
  stepLabel: {
    fontSize: 9, fontWeight: "700", letterSpacing: 2,
  },
  heading: {
    color: COLORS.onSurface,
    fontSize: 22, fontWeight: "300",
    textAlign: "center",
    letterSpacing: 0.3,
    lineHeight: 30,
  },
  bodyCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "#2DD4BF18",
    padding: SPACING.lg,
    overflow: "hidden",
    width: "100%",
    marginTop: SPACING.xs,
  },
  bodyTxt: {
    color: COLORS.onSurface,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    fontWeight: "300",
  },
  connectTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 11,
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 16,
    paddingHorizontal: SPACING.md,
  },

  // CTAs
  ctaRow: {
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#2DD4BF50",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 12,
    backgroundColor: "#2DD4BF0A",
  },
  nextTxt: {
    color: "#2DD4BF",
    fontSize: 14, fontWeight: "700", letterSpacing: 0.5,
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2DD4BF",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 14,
  },
  applyTxt: {
    color: "#0B1A18",
    fontSize: 15, fontWeight: "800", letterSpacing: 0.4,
  },
});
