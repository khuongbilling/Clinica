/**
 * Apply It — placeholder screen reached from "Apply It" on the Cue Hunt lesson.
 *
 * Step 6 will replace this with the full Rapid Triage challenge.
 * For now this is a minimal, safe landing page with a back path.
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
        colors={["#162C24", "#0E2018", COLORS.surface]}
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
            colors={["#1A3830", "#142C26"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.iconWrap}>
            <Ionicons name="timer-outline" size={36} color="#2DD4BF" />
          </View>
          <Text style={styles.cardTitle}>Coming Soon</Text>
          <Text style={styles.cardBody}>
            In Rapid Triage, you'll apply what you learned to sort five patients by urgency.
          </Text>
          <Text style={styles.cardBody}>
            This challenge unlocks next.
          </Text>
        </View>
      </View>

      {/* Back CTA */}
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
  kicker: { color: "#2DD4BF", fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 14, fontWeight: "300" },

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
    borderColor: "#2DD4BF20",
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.md,
    overflow: "hidden",
  },
  iconWrap: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: "#2DD4BF12",
    borderWidth: 1, borderColor: "#2DD4BF30",
    alignItems: "center", justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    color: "#2DD4BF",
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
