/**
 * Triage Lesson — "Decide Fast" · The Fading Apprentice
 *
 * Short linked lesson reached from "Learn Triage" on the Rapid Triage
 * completion panel. Three teaching beats explaining what triage is,
 * the three urgency levels, and why it matters clinically.
 *
 * Design: matches cue-hunt-lesson.tsx — beat-by-beat fade transition,
 * progress dots, no long blocks. Back → university, last beat → university.
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
    icon: "flash-outline",
    step: "WHAT IS TRIAGE?",
    heading: "Sort First, Treat After",
    body: "Triage means rapidly sorting patients by urgency so the sickest get help first. A wrong priority can cost a life — or waste scarce care on someone who can safely wait.",
    accentColor: "#EF4444",
  },
  {
    icon: "timer-outline",
    step: "THE THREE LEVELS",
    heading: "Emergency · Urgent · Routine",
    body: "Emergency: unstable — act now (confusion, low BP, can't drink). Urgent: stable but worsening — act soon (dizziness, mild symptoms). Routine: well — guidance or monitoring only (no active illness).",
    accentColor: "#F59E0B",
  },
  {
    icon: "pulse-outline",
    step: "CLINICAL SIGNIFICANCE",
    heading: "Why Triage Saves Lives",
    body: "Key signs to read: mental status, blood pressure, ability to swallow, and symptom severity. These four observations separate Emergency from Routine in seconds — and that gap is what triage is for.",
    accentColor: "#2DD4BF",
  },
];

const TOTAL = BEATS.length;

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function TriageLessonScreen() {
  const router = useRouter();
  const [beatIdx, setBeatIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const beat = BEATS[beatIdx];
  const isLast = beatIdx === TOTAL - 1;

  const advance = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      if (isLast) {
        router.replace("/university" as any);
        setBeatIdx(0);
        fadeAnim.setValue(1);
      } else {
        setBeatIdx((prev) => prev + 1);
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      }
    });
  };

  const dots = Array.from({ length: TOTAL }, (_, i) => i);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#1A1228", "#130E20", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/university")}
          hitSlop={10}
          testID="triage-lesson-back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.kicker}>RAPID TRIAGE</Text>
          <Text style={styles.subtitle}>The Fading Apprentice</Text>
        </View>
        <Text style={styles.counter}>{beatIdx + 1}/{TOTAL}</Text>
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

      {/* ── BEAT CONTENT ────────────────────────────────────────────── */}
      <Animated.View style={[styles.beatArea, { opacity: fadeAnim }]}>
        <View style={[styles.iconCircle, { borderColor: beat.accentColor + "50", backgroundColor: beat.accentColor + "14" }]}>
          <Ionicons name={beat.icon} size={36} color={beat.accentColor} />
        </View>
        <Text style={[styles.stepLabel, { color: beat.accentColor }]}>{beat.step}</Text>
        <Text style={styles.heading}>{beat.heading}</Text>
        <Text style={styles.body}>{beat.body}</Text>
      </Animated.View>

      {/* ── NAV BUTTON ──────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.nextBtn, { backgroundColor: beat.accentColor }]}
          onPress={advance}
          testID="triage-lesson-next"
        >
          <Text style={styles.nextTxt}>{isLast ? "DONE" : "NEXT"}</Text>
          <Ionicons
            name={isLast ? "checkmark-circle" : "arrow-forward"}
            size={16}
            color="#071018"
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  backBtn: {
    width: 36, height: 36, alignItems: "center", justifyContent: "center",
    borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceSecondary,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  kicker: {
    color: "#7C3AED", fontSize: 10, fontWeight: "800",
    letterSpacing: 1.5, textTransform: "uppercase",
  },
  subtitle: { color: COLORS.onSurfaceSecondary, fontSize: 12 },
  counter: { color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: "600", width: 36, textAlign: "right" },

  dotRow: { flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: SPACING.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.surfaceSecondary },
  dotPast: { backgroundColor: "#7C3AED60" },
  dotActive: { width: 20, backgroundColor: "#7C3AED" },

  beatArea: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: SPACING.xl, gap: SPACING.md,
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  stepLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase" },
  heading: {
    color: COLORS.onSurface, fontSize: 22, fontWeight: "700",
    textAlign: "center", lineHeight: 28,
  },
  body: {
    color: COLORS.onSurfaceSecondary, fontSize: 15, lineHeight: 22,
    textAlign: "center",
  },

  footer: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },
  nextBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: RADIUS.pill,
    paddingVertical: 14, paddingHorizontal: SPACING.xl, minHeight: 48,
  },
  nextTxt: { color: "#071018", fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
});
