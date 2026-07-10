/**
 * Cue Hunt Lesson — Dehydration Risk
 *
 * Minimal placeholder reached from the "Learn Why" CTA on the Cue Hunt
 * completion panel. Step 5 will build this into a full short linked lesson.
 * For now it shows a concise clinical insight bridging play → explanation.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

const CLUE_RECAP = [
  {
    id: "lips",
    icon: "water-outline" as const,
    label: "Dry lips",
    why: "Mucous membranes lose moisture before other signs appear — a sensitive early marker.",
  },
  {
    id: "posture",
    icon: "body-outline" as const,
    label: "Weak posture",
    why: "Fluid loss reduces blood volume and muscle perfusion, causing fatigue and slumping.",
  },
  {
    id: "flask",
    icon: "beaker-outline" as const,
    label: "Near-empty flask",
    why: "Low intake confirms the mechanism. The body cannot compensate without replacing fluids.",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function CueHuntLessonScreen() {
  const router = useRouter();

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
          testID="lesson-back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.kicker}>CLINICAL INSIGHT</Text>
          <Text style={styles.title}>Why Dehydration?</Text>
        </View>
      </View>

      {/* ── CONTENT ───────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Recap label */}
        <Text style={styles.sectionLabel}>WHAT YOU FOUND</Text>

        {/* Clue cards — one per discovered clue */}
        {CLUE_RECAP.map((c) => (
          <View key={c.id} style={styles.clueCard}>
            <LinearGradient
              colors={["#1A3830", "#142C26"]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.clueIconWrap}>
              <Ionicons name={c.icon} size={16} color="#2DD4BF" />
            </View>
            <View style={styles.clueBody}>
              <Text style={styles.clueLabel}>{c.label}</Text>
              <Text style={styles.clueWhy}>{c.why}</Text>
            </View>
          </View>
        ))}

        {/* Insight block */}
        <View style={styles.insightCard}>
          <LinearGradient
            colors={["#1C3830", "#142E28"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.insightHeader}>
            <Ionicons name="bulb-outline" size={14} color="#D4AF37" />
            <Text style={styles.insightKicker}>THE PATTERN</Text>
          </View>
          <Text style={styles.insightBody}>
            Three separate clues — lips, posture, intake — all point to the same mechanism: the body losing more fluid than it takes in.
          </Text>
          <Text style={styles.insightBody}>
            No single clue is enough. Seeing them together is clinical pattern recognition. That's what you just practised.
          </Text>
        </View>

        {/* Coming-soon notice */}
        <View style={styles.comingSoonRow}>
          <Ionicons name="time-outline" size={12} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.comingSoonTxt}>Full lesson unlocking soon.</Text>
        </View>
      </ScrollView>

      {/* ── BACK CTA ──────────────────────────────────────────────────── */}
      <Pressable
        style={styles.backCTA}
        onPress={() => goBack(router, "/university")}
        testID="lesson-finish"
      >
        <Ionicons name="chevron-back" size={15} color={COLORS.onSurfaceTertiary} />
        <Text style={styles.backCTATxt}>Back to University</Text>
      </Pressable>
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
  kicker: { color: "#D4AF37", fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 14, fontWeight: "300", letterSpacing: 0.4 },

  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },

  sectionLabel: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 9, fontWeight: "700", letterSpacing: 2,
    marginBottom: SPACING.xs ?? 4,
  },

  clueCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#2DD4BF18",
    padding: SPACING.md,
    overflow: "hidden",
  },
  clueIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#2DD4BF12",
    borderWidth: 1, borderColor: "#2DD4BF30",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  clueBody: { flex: 1, gap: 3 },
  clueLabel: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  clueWhy: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },

  insightCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#D4AF3728",
    padding: SPACING.md,
    gap: SPACING.sm,
    overflow: "hidden",
    marginTop: SPACING.sm,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  insightKicker: {
    color: "#D4AF37",
    fontSize: 9, fontWeight: "700", letterSpacing: 2,
  },
  insightBody: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13, lineHeight: 19,
  },

  comingSoonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: SPACING.sm,
    justifyContent: "center",
  },
  comingSoonTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 11, fontStyle: "italic",
  },

  backCTA: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: SPACING.md, paddingBottom: SPACING.xl,
  },
  backCTATxt: { color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
});
