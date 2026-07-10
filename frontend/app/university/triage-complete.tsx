/**
 * Triage Complete — placeholder reached after finishing all Rapid Triage cards.
 *
 * Step 7 will replace this with Stabilize Stack or the full chain integration.
 * For now this is a minimal, safe completion screen.
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

import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function TriageCompleteScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#1A1228", "#130E20", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconWrap}>
          <LinearGradient
            colors={["#A78BFA20", "#7C3AED10"]}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="checkmark-done-outline" size={44} color="#A78BFA" />
        </View>

        {/* Result */}
        <Text style={styles.kicker}>CASE COMPLETE</Text>
        <Text style={styles.title}>Rapid Triage done.</Text>
        <Text style={styles.body}>
          You sorted all three patients correctly. You're learning to act on urgency, not instinct.
        </Text>

        <View style={styles.divider} />

        {/* Coming-soon notice */}
        <View style={styles.nextRow}>
          <Ionicons name="time-outline" size={13} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.nextTxt}>Next challenge unlocking soon.</Text>
        </View>
      </View>

      {/* Back CTA */}
      <Pressable
        style={styles.backBtn}
        onPress={() => router.replace("/university" as any)}
        testID="triage-complete-back"
      >
        <Ionicons name="chevron-back" size={15} color={COLORS.onSurfaceTertiary} />
        <Text style={styles.backTxt}>Back to University</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  iconWrap: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 1.5, borderColor: "#A78BFA40",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    marginBottom: SPACING.sm,
  },
  kicker: {
    color: "#A78BFA",
    fontSize: 9, fontWeight: "700", letterSpacing: 3,
  },
  title: {
    color: COLORS.onSurface,
    fontSize: 22, fontWeight: "300",
    textAlign: "center", letterSpacing: 0.3,
  },
  body: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 14, lineHeight: 21,
    textAlign: "center",
    paddingHorizontal: SPACING.md,
  },
  divider: {
    height: 1, backgroundColor: "#A78BFA18",
    alignSelf: "stretch",
    marginVertical: SPACING.sm,
  },
  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  nextTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12, fontStyle: "italic",
  },

  backBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: SPACING.md, paddingBottom: SPACING.xl,
  },
  backTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13, fontWeight: "600",
  },
});
