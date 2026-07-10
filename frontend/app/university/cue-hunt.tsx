import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { useTutorial, useHighlightTarget } from "@/src/game/tutorialStore";

// ── Case data ────────────────────────────────────────────────────────────────

interface CueItem {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  detail: string;
  clinicalNote: string;
  isKey: boolean;
  accentColor: string;
}

const CASE_CUES: CueItem[] = [
  {
    id: "clue_dry_lips",
    label: "Pale, dry lips",
    icon: "water-outline",
    detail: "Bloodless pallor — a classic sign of low circulating haemoglobin.",
    clinicalNote: "Anemia indicator · Mucosal pallor",
    isKey: true,
    accentColor: "#F472B6",
  },
  {
    id: "clue_rapid_breathing",
    label: "Rapid breathing",
    icon: "partly-sunny-outline",
    detail: "RR 24. The lungs are compensating — trying to deliver more O₂ when the blood can carry less.",
    clinicalNote: "Tachypnoea · Compensatory response",
    isKey: true,
    accentColor: "#B0DEFF",
  },
  {
    id: "clue_heart_rate",
    label: "Pounding heart",
    icon: "pulse-outline",
    detail: "HR 108. The heart is beating faster to keep oxygen delivery up despite low haemoglobin.",
    clinicalNote: "Tachycardia · Cardiac compensation",
    isKey: true,
    accentColor: "#06B6D4",
  },
  {
    id: "clue_conjunctiva",
    label: "White inner eyelid",
    icon: "eye-outline",
    detail: "Pale conjunctiva is one of the most reliable bedside signs of anaemia — look at the lower eyelid.",
    clinicalNote: "Conjunctival pallor · Anaemia sign",
    isKey: true,
    accentColor: "#34D399",
  },
  {
    id: "clue_brittle_nails",
    label: "Brittle nails",
    icon: "hand-right-outline",
    detail: "Nails splitting and thinning at the edges — koilonychia is a long-term iron deficiency sign.",
    clinicalNote: "Koilonychia · Iron deficiency",
    isKey: false,
    accentColor: "#D97706",
  },
  {
    id: "clue_fatigue",
    label: "Barely standing",
    icon: "body-outline",
    detail: "Muscle fatigue from oxygen debt. The body diverts remaining O₂ to vital organs first.",
    clinicalNote: "Exertional fatigue · O₂ debt",
    isKey: false,
    accentColor: "#8B5CF6",
  },
  {
    id: "clue_temperature",
    label: "Normal temperature",
    icon: "thermometer-outline",
    detail: "37.1°C — rules out active infection or inflammatory response as the primary cause.",
    clinicalNote: "Afebrile · Infection less likely",
    isKey: false,
    accentColor: "#F59E0B",
  },
  {
    id: "clue_craving",
    label: "Craving cold water",
    icon: "snow-outline",
    detail: "Compulsive desire for ice or cold water (pagophagia) — a form of pica strongly associated with iron deficiency.",
    clinicalNote: "Pagophagia · Iron deficiency pica",
    isKey: false,
    accentColor: "#22D3EE",
  },
];

const TOTAL_KEY = CASE_CUES.filter((c) => c.isKey).length;

// ── Individual cue bubble ────────────────────────────────────────────────────

function CueBubble({
  cue,
  found,
  onTap,
}: {
  cue: CueItem;
  found: boolean;
  onTap: (id: string) => void;
}) {
  const { isHighlighted, onTargetPress, highlightStyle } = useHighlightTarget(cue.id);

  const scaleAnim = useMemo(() => new Animated.Value(1), []);

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    if (isHighlighted) onTargetPress();
    onTap(cue.id);
  }, [isHighlighted, onTargetPress, onTap, cue.id, scaleAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], flex: 1 }}>
      <Pressable
        style={[
          styles.cueBubble,
          found && styles.cueBubbleFound,
          isHighlighted && styles.cueBubbleHighlight,
          highlightStyle,
        ]}
        onPress={handlePress}
        testID={`cue-bubble-${cue.id}`}
      >
        {found && (
          <LinearGradient
            colors={[cue.accentColor + "18", cue.accentColor + "08"]}
            style={StyleSheet.absoluteFillObject}
          />
        )}

        {/* Icon */}
        <View
          style={[
            styles.cueIconWrap,
            { backgroundColor: cue.accentColor + (found ? "28" : "14") },
          ]}
        >
          <Ionicons
            name={cue.icon}
            size={20}
            color={found ? cue.accentColor : COLORS.onSurfaceTertiary}
          />
          {found && (
            <View style={[styles.foundDot, { backgroundColor: cue.accentColor }]} />
          )}
        </View>

        {/* Label */}
        <Text
          style={[styles.cueLabel, found && { color: COLORS.onSurface }]}
          numberOfLines={2}
        >
          {cue.label}
        </Text>

        {/* Revealed detail */}
        {found && (
          <>
            <View style={[styles.cueDivider, { backgroundColor: cue.accentColor + "40" }]} />
            <Text style={[styles.cueDetail, { color: cue.accentColor }]} numberOfLines={3}>
              {cue.detail}
            </Text>
            <Text style={styles.cueClinicalNote}>{cue.clinicalNote}</Text>
            {cue.isKey && (
              <View style={[styles.keyBadge, { borderColor: cue.accentColor + "60" }]}>
                <Ionicons name="checkmark-circle" size={10} color={cue.accentColor} />
                <Text style={[styles.keyBadgeTxt, { color: cue.accentColor }]}>KEY FINDING</Text>
              </View>
            )}
          </>
        )}

        {/* Unfound: subtle hint */}
        {!found && (
          <Text style={styles.cueTapHint}>tap to reveal</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function CueHuntScreen() {
  const router = useRouter();
  const { startTutorial, isCompleted, activeTutorialId } = useTutorial();
  const [found, setFound] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"playing" | "complete">("playing");

  const keyFound = useMemo(
    () => CASE_CUES.filter((c) => c.isKey && found.has(c.id)).length,
    [found],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isCompleted("cueHuntIntro") && !activeTutorialId) {
        startTutorial("cueHuntIntro");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (keyFound >= TOTAL_KEY && phase === "playing") {
      setPhase("complete");
    }
  }, [keyFound, phase]);

  const handleTap = useCallback((id: string) => {
    setFound((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const progressPct = (keyFound / TOTAL_KEY) * 100;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#0B2220", "#0D2E2B", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/university")}
          hitSlop={10}
          testID="cue-hunt-back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <Text style={styles.kicker}>CUE HUNT · THE FADING APPRENTICE</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Patient profile card */}
        <View style={styles.patientCard}>
          <LinearGradient
            colors={["#1A2E2C", "#142420"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.patientRow}>
            <View style={styles.patientAvatar}>
              <Ionicons name="person" size={24} color="#2DD4BF" />
            </View>
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>Mei Lin, 22</Text>
              <Text style={styles.patientRole}>Herbology apprentice · Greenhouse sector</Text>
            </View>
            <View style={styles.patientStatus}>
              <View style={[styles.statusDot, { backgroundColor: "#F59E0B" }]} />
              <Text style={styles.statusTxt}>Concerning</Text>
            </View>
          </View>

          <View style={styles.complaintRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={13} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.complaintTxt} numberOfLines={2}>
              "I've been dizzy all morning… can't catch my breath."
            </Text>
          </View>

          <View style={styles.vitalStrip}>
            {[
              { label: "HR", value: "108", unit: "bpm", alert: true },
              { label: "RR", value: "24", unit: "/min", alert: true },
              { label: "SpO₂", value: "96", unit: "%", alert: false },
              { label: "Temp", value: "37.1", unit: "°C", alert: false },
            ].map((v) => (
              <View key={v.label} style={styles.vitalItem}>
                <Text style={styles.vitalLabel}>{v.label}</Text>
                <Text style={[styles.vitalValue, v.alert && styles.vitalAlert]}>
                  {v.value}
                </Text>
                <Text style={styles.vitalUnit}>{v.unit}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${progressPct}%` as any },
              ]}
            />
          </View>
          <Text style={styles.progressTxt}>
            {keyFound}/{TOTAL_KEY} key findings
          </Text>
        </View>

        {/* Cue grid */}
        <Text style={styles.sectionHint}>
          Tap each finding to read what it means clinically.
        </Text>

        <View style={styles.grid}>
          {CASE_CUES.map((cue, i) => (
            <View key={cue.id} style={styles.gridCell}>
              <CueBubble
                cue={cue}
                found={found.has(cue.id)}
                onTap={handleTap}
              />
            </View>
          ))}
        </View>

        {/* Completion panel */}
        {phase === "complete" && (
          <View style={styles.resolvedCard}>
            <LinearGradient
              colors={["#0D3B38", "#162E2B"]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.resolvedIcon}>
              <Ionicons name="checkmark-done" size={28} color="#2DD4BF" />
            </View>
            <Text style={styles.resolvedTitle}>Case Resolved</Text>
            <Text style={styles.resolvedBody}>
              The pattern is clear: pallor, tachycardia, tachypnoea, and pale conjunctiva — all four pointing to anaemia. A blood panel will confirm. Mei Lin needs iron supplementation and rest, not antibiotics.
            </Text>
            <Text style={styles.resolvedDiagnosis}>
              Suspected: Iron-deficiency anaemia
            </Text>
            <Pressable
              style={styles.resolvedBtn}
              onPress={() => goBack(router, "/university")}
              testID="cue-hunt-finish"
            >
              <Text style={styles.resolvedBtnTxt}>Return to University</Text>
              <Ionicons name="arrow-forward" size={14} color="#0B1A18" />
            </Pressable>
          </View>
        )}

        {/* Footer back link (shown while playing) */}
        {phase === "playing" && (
          <Pressable
            style={styles.backToUni}
            onPress={() => goBack(router, "/university")}
            testID="cue-hunt-return"
          >
            <Ionicons name="chevron-back" size={15} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.backToUniTxt}>Back to University</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    color: "#2DD4BF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    flex: 1,
  },

  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.md,
  },

  // Patient card
  patientCard: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2DD4BF25",
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2DD4BF18",
    borderWidth: 1.5,
    borderColor: "#2DD4BF40",
    alignItems: "center",
    justifyContent: "center",
  },
  patientInfo: { flex: 1, gap: 2 },
  patientName: {
    color: COLORS.onSurface,
    fontSize: 15,
    fontWeight: "600",
  },
  patientRole: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 11,
  },
  patientStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F59E0B18",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#F59E0B30",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTxt: {
    color: "#F59E0B",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  complaintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  complaintTxt: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 12,
    fontStyle: "italic",
    flex: 1,
    lineHeight: 17,
  },
  vitalStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  vitalItem: { alignItems: "center", gap: 2 },
  vitalLabel: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  vitalValue: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 17,
    fontWeight: "300",
  },
  vitalAlert: { color: "#F59E0B" },
  vitalUnit: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 9,
  },

  // Progress
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(45,212,191,0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2DD4BF",
    borderRadius: 2,
  },
  progressTxt: {
    color: "#2DD4BF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    minWidth: 90,
    textAlign: "right",
  },

  sectionHint: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 11,
    textAlign: "center",
    marginTop: -SPACING.xs,
  },

  // Grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  gridCell: {
    width: "48%",
  },

  // Cue bubble
  cueBubble: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.md,
    gap: SPACING.sm,
    overflow: "hidden",
    minHeight: 110,
  },
  cueBubbleFound: {
    borderColor: "transparent",
    backgroundColor: COLORS.surfaceTertiary,
  },
  cueBubbleHighlight: {
    borderColor: "#2DD4BF",
  },
  cueIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  foundDot: {
    position: "absolute",
    top: 1,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.surfaceTertiary,
  },
  cueLabel: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  cueTapHint: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    fontStyle: "italic",
    opacity: 0.6,
    marginTop: "auto" as any,
  },
  cueDivider: {
    height: 1,
  },
  cueDetail: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
  },
  cueClinicalNote: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase" as any,
  },
  keyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start" as any,
    marginTop: 2,
  },
  keyBadgeTxt: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },

  // Resolution card
  resolvedCard: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#2DD4BF40",
    padding: SPACING.lg,
    gap: SPACING.md,
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  resolvedIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#2DD4BF18",
    borderWidth: 1.5,
    borderColor: "#2DD4BF40",
    alignItems: "center",
    justifyContent: "center",
  },
  resolvedTitle: {
    color: "#2DD4BF",
    fontSize: 20,
    fontWeight: "300",
    letterSpacing: 1,
  },
  resolvedBody: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  resolvedDiagnosis: {
    color: COLORS.brand,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  resolvedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2DD4BF",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 12,
    marginTop: SPACING.xs,
  },
  resolvedBtnTxt: {
    color: "#0B1A18",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // Footer
  backToUni: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: SPACING.md,
  },
  backToUniTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13,
    fontWeight: "600",
  },
});
