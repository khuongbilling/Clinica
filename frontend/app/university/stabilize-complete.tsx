/**
 * Stabilize Complete — minimal completion placeholder.
 *
 * Safe landing after finishing the Stabilize Stack puzzle.
 * A full reward / chain integration screen will replace this in a later step.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function StabilizeCompleteScreen() {
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 440, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#071A14", "#040E0C", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Icon */}
        <View style={styles.iconWrap}>
          <LinearGradient
            colors={["#22C55E20", "#16A34A10"]}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="medkit-outline" size={44} color="#22C55E" />
        </View>

        <Text style={styles.kicker}>CASE RESOLVED</Text>
        <Text style={styles.title}>Apprentice stabilised.</Text>
        <Text style={styles.body}>
          You assessed before treating, and offered fluids safely. That's clinical thinking.
        </Text>

        <View style={styles.divider} />

        {/* Coming-next hint */}
        <View style={styles.hintRow}>
          <Ionicons name="time-outline" size={13} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.hintTxt}>More challenges coming soon.</Text>
        </View>
      </Animated.View>

      {/* Return CTA */}
      <Pressable
        style={styles.backBtn}
        onPress={() => router.replace("/university" as any)}
        testID="stabilize-complete-back"
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
    gap: SPACING.lg,
  },

  iconWrap: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 1.5, borderColor: "#22C55E45",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    marginBottom: SPACING.xs,
  },
  kicker: {
    color: "#22C55E",
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
    height: 1, backgroundColor: "#22C55E18",
    alignSelf: "stretch", marginHorizontal: SPACING.xl,
  },
  hintRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  hintTxt: {
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
