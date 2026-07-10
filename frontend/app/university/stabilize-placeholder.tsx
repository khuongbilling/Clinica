/**
 * Stabilize Stack — placeholder.
 *
 * Safe destination for the "Stabilize the Patient" CTA on the Triage Complete
 * screen. Step 8 will replace this with the real action-order puzzle.
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

export default function StabilizePlaceholderScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#0E1E2C", "#091622", COLORS.surface]}
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
        <View style={styles.headerCenter}>
          <Text style={styles.kicker}>STABILIZE STACK</Text>
          <Text style={styles.title}>The Fading Apprentice</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.card}>
          <LinearGradient
            colors={["#112030", "#0A1828"]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Icon */}
          <View style={styles.iconWrap}>
            <Ionicons name="layers-outline" size={36} color="#38BDF8" />
          </View>

          <Text style={styles.cardTitle}>Coming Next</Text>
          <Text style={styles.cardBody}>
            In Stabilize Stack, you'll choose the right sequence of actions to stabilise the patient.
          </Text>
          <Text style={styles.cardBody}>
            Order matters — this challenge unlocks soon.
          </Text>
        </View>
      </View>

      {/* Back CTA */}
      <Pressable
        style={styles.backCTA}
        onPress={() => goBack(router, "/university")}
        testID="stabilize-finish"
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
  kicker: { color: "#38BDF8", fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "300" },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "#38BDF820",
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.md,
    overflow: "hidden",
  },
  iconWrap: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: "#38BDF810",
    borderWidth: 1, borderColor: "#38BDF830",
    alignItems: "center", justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    color: "#38BDF8",
    fontSize: 18, fontWeight: "700", letterSpacing: 0.3,
  },
  cardBody: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 14, lineHeight: 20,
    textAlign: "center",
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
