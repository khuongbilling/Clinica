/**
 * Apply It — bridge screen between the Cue Hunt lesson and Rapid Triage.
 *
 * Routes directly into /university/rapid-triage via a prominent CTA.
 * The "Back to University" escape hatch is still present for players who
 * don't want to continue immediately.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function ApplyItScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#1A1228", "#130E20", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/university")}
          hitSlop={10}
          testID="apply-back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.kicker}>NEXT CHALLENGE</Text>
          <Text style={styles.title}>Rapid Triage</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.card}>
          <LinearGradient
            colors={["#1E1630", "#160F22"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.iconWrap}>
            <Ionicons name="timer-outline" size={36} color="#A78BFA" />
          </View>
          <Text style={styles.cardTitle}>Ready?</Text>
          <Text style={styles.cardBody}>
            Sort three patients by urgency — Emergency, Urgent, or Routine.
          </Text>
          <Text style={styles.cardBody}>
            Use what you just learned about dehydration.
          </Text>
        </View>

        {/* Primary CTA */}
        <Pressable
          style={styles.startBtn}
          onPress={() => router.push("/university/rapid-triage" as any)}
          testID="apply-start-triage"
        >
          <Text style={styles.startBtnTxt}>Begin Rapid Triage</Text>
          <Ionicons name="arrow-forward" size={14} color="#0B1A18" />
        </Pressable>
      </View>

      {/* Escape hatch */}
      <Pressable
        style={styles.backCTA}
        onPress={() => goBack(router, "/university")}
        testID="apply-finish"
      >
        <Ionicons name="chevron-back" size={15} color={COLORS.onSurfaceTertiary} />
        <Text style={styles.backCTATxt}>Back to University</Text>
      </Pressable>
    </SafeAreaView>
  );
}

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
  kicker: { color: "#A78BFA", fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 14, fontWeight: "300" },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "#A78BFA28",
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.md,
    overflow: "hidden",
  },
  iconWrap: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: "#A78BFA10",
    borderWidth: 1, borderColor: "#A78BFA30",
    alignItems: "center", justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    color: "#A78BFA",
    fontSize: 18, fontWeight: "700", letterSpacing: 0.3,
  },
  cardBody: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 14, lineHeight: 20,
    textAlign: "center",
  },

  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#A78BFA",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 15,
  },
  startBtnTxt: {
    color: "#0B1A18",
    fontSize: 15, fontWeight: "800", letterSpacing: 0.4,
  },

  backCTA: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: SPACING.md, paddingBottom: SPACING.xl,
  },
  backCTATxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13, fontWeight: "600",
  },
});
