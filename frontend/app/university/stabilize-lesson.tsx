/**
 * Stabilize Lesson — "Learn the Chain"
 *
 * Three beats that walk through the Stabilize Stack care chain in order:
 *   1. Check Safety   — assess mental status (AVPU)
 *   2. Confirm Stability — check vitals (HR, RR, SpO₂)
 *   3. Support Recovery — offer oral fluids
 *
 * Reached via "Learn the Chain" on the Stabilize Stack completion panel.
 * Last beat → "Done" → /university. No "Apply it" / replay button anywhere.
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
// Teaching beats — one per care-chain step
// ─────────────────────────────────────────────────────────────────────────────

interface Beat {
  step: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  phase: string;
  action: string;
  heading: string;
  body: string;
  accentColor: string;
}

const BEATS: Beat[] = [
  {
    step: "STEP 1 OF 3",
    icon: "eye-outline",
    phase: "Check Safety",
    action: "Assess mental status",
    heading: "Always look before you act",
    body: "The very first move is checking whether the patient is conscious and responsive — AVPU: Alert, Voice, Pain, Unresponsive. You cannot safely give fluids, medication, or any intervention until you know their level of consciousness.",
    accentColor: "#8B5CF6",
  },
  {
    step: "STEP 2 OF 3",
    icon: "pulse-outline",
    phase: "Confirm Stability",
    action: "Check vitals",
    heading: "Map the real picture",
    body: "Heart rate, respiratory rate, and oxygen saturation tell you whether the patient is deteriorating or holding. Wei's numbers — HR 102, RR 8, SpO₂ 88% — are all critically abnormal. Without measuring them you're guessing. Never guess when vitals are available.",
    accentColor: "#22D3EE",
  },
  {
    step: "STEP 3 OF 3",
    icon: "water-outline",
    phase: "Support Recovery",
    action: "Offer oral fluids",
    heading: "Safe support starts the healing",
    body: "Once you know the patient is conscious and you have their vitals, gentle rehydration can begin — but only if swallowing is safe. Oral fluids are a low-risk first step that starts correcting dehydration while you prepare the next level of care if needed.",
    accentColor: "#2DD4BF",
  },
];

const TOTAL = BEATS.length;

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function StabilizeLessonScreen() {
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
        colors={["#0B1E2E", "#071018", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/university")}
          hitSlop={10}
          testID="stabilize-lesson-back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.kicker}>STABILIZE STACK</Text>
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
              i === beatIdx && { ...styles.dotActive, backgroundColor: beat.accentColor },
            ]}
          />
        ))}
      </View>

      {/* ── BEAT CONTENT ────────────────────────────────────────────── */}
      <Animated.View style={[styles.beatArea, { opacity: fadeAnim }]}>
        {/* Phase badge */}
        <View style={[styles.phaseBadge, { borderColor: beat.accentColor + "44", backgroundColor: beat.accentColor + "14" }]}>
          <Ionicons name={beat.icon} size={13} color={beat.accentColor} />
          <Text style={[styles.phaseLabel, { color: beat.accentColor }]}>{beat.phase}</Text>
        </View>

        {/* Icon circle */}
        <View style={[styles.iconCircle, { borderColor: beat.accentColor + "50", backgroundColor: beat.accentColor + "12" }]}>
          <Ionicons name={beat.icon} size={38} color={beat.accentColor} />
        </View>

        {/* Step kicker */}
        <Text style={[styles.stepLabel, { color: beat.accentColor + "AA" }]}>{beat.step}</Text>

        {/* Action name */}
        <View style={[styles.actionChip, { borderColor: beat.accentColor + "30" }]}>
          <Text style={[styles.actionChipTxt, { color: beat.accentColor }]}>"{beat.action}"</Text>
        </View>

        {/* Heading */}
        <Text style={styles.heading}>{beat.heading}</Text>

        {/* Body */}
        <Text style={styles.body}>{beat.body}</Text>
      </Animated.View>

      {/* ── CHAIN INDICATOR ─────────────────────────────────────────── */}
      <View style={styles.chainRow}>
        {BEATS.map((b, i) => (
          <React.Fragment key={i}>
            <View style={[
              styles.chainDot,
              { borderColor: b.accentColor + (i <= beatIdx ? "CC" : "30"), backgroundColor: i <= beatIdx ? b.accentColor + "22" : "transparent" },
            ]}>
              <Ionicons name={b.icon} size={11} color={b.accentColor + (i <= beatIdx ? "FF" : "44")} />
            </View>
            {i < BEATS.length - 1 && (
              <View style={[styles.chainLine, { backgroundColor: i < beatIdx ? "#2DD4BF30" : "#1E3830" }]} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* ── NAV BUTTON ──────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.nextBtn, { backgroundColor: beat.accentColor }]}
          onPress={advance}
          testID="stabilize-lesson-next"
        >
          <Text style={styles.nextTxt}>{isLast ? "DONE" : "NEXT STEP"}</Text>
          <Ionicons
            name={isLast ? "checkmark-circle" : "arrow-forward"}
            size={16}
            color="#040D14"
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
    color: "#06B6D4", fontSize: 10, fontWeight: "800",
    letterSpacing: 1.5, textTransform: "uppercase",
  },
  subtitle: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  counter: {
    color: COLORS.onSurfaceTertiary, fontSize: 13,
    fontWeight: "600", width: 36, textAlign: "right",
  },

  dotRow: {
    flexDirection: "row", justifyContent: "center",
    gap: 6, paddingVertical: SPACING.sm,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.surfaceSecondary },
  dotPast: { backgroundColor: "#2DD4BF40" },
  dotActive: { width: 20, borderRadius: 3 },

  beatArea: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: SPACING.xl, gap: SPACING.sm,
  },
  phaseBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: RADIUS.pill, borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  phaseLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },

  iconCircle: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
  },
  stepLabel: {
    fontSize: 9, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase",
    marginTop: SPACING.sm,
  },
  actionChip: {
    borderWidth: 1, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 5,
  },
  actionChipTxt: { fontSize: 13, fontWeight: "600", fontStyle: "italic" },

  heading: {
    color: COLORS.onSurface, fontSize: 20, fontWeight: "700",
    textAlign: "center", lineHeight: 26, marginTop: SPACING.sm,
  },
  body: {
    color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21,
    textAlign: "center",
  },

  chainRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, gap: 0,
  },
  chainDot: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
  },
  chainLine: { flex: 1, height: 1.5, marginHorizontal: 4 },

  footer: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },
  nextBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: RADIUS.pill,
    paddingVertical: 14, paddingHorizontal: SPACING.xl, minHeight: 48,
  },
  nextTxt: { color: "#040D14", fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
});
