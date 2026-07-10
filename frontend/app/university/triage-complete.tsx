/**
 * Triage Complete — Step 7 completion transition.
 *
 * Bridges Rapid Triage → Stabilize Stack. Short feedback +
 * "Stabilize the Patient" CTA routing to the stabilize placeholder.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function TriageCompleteScreen() {
  const router = useRouter();

  // Gentle entrance fade
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Background — same violet tone as Rapid Triage */}
      <LinearGradient
        colors={["#1A1228", "#130E20", COLORS.surface]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── CONTENT ─────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Icon — shield with checkmark */}
        <View style={styles.iconWrap}>
          <LinearGradient
            colors={["#A78BFA24", "#7C3AED12"]}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="shield-checkmark-outline" size={44} color="#A78BFA" />
        </View>

        {/* Kicker */}
        <Text style={styles.kicker}>TRIAGE COMPLETE</Text>

        {/* Core feedback — short, exactly per spec */}
        <Text style={styles.feedbackTxt}>
          You sorted the patient safely.{"\n"}Now choose what to do first.
        </Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Primary CTA — Stabilize the Patient */}
        <Pressable
          style={styles.stabilizeBtn}
          onPress={() => router.push("/university/stabilize-placeholder" as any)}
          testID="triage-complete-stabilize"
        >
          <Ionicons name="pulse-outline" size={16} color="#0B1A18" />
          <Text style={styles.stabilizeTxt}>Stabilize the Patient</Text>
          <Ionicons name="arrow-forward" size={14} color="#0B1A18" />
        </Pressable>
      </Animated.View>

      {/* ── BACK LINK ───────────────────────────────────────────────── */}
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
    gap: SPACING.lg,
  },

  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    borderColor: "#A78BFA45",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: SPACING.xs,
  },

  kicker: {
    color: "#A78BFA",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 3,
  },

  feedbackTxt: {
    color: COLORS.onSurface,
    fontSize: 20,
    fontWeight: "300",
    textAlign: "center",
    lineHeight: 30,
    letterSpacing: 0.2,
    paddingHorizontal: SPACING.sm,
  },

  divider: {
    height: 1,
    backgroundColor: "#A78BFA20",
    alignSelf: "stretch",
    marginHorizontal: SPACING.xl,
  },

  stabilizeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#A78BFA",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 15,
    marginTop: SPACING.xs,
  },
  stabilizeTxt: {
    color: "#0B1A18",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  backTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13,
    fontWeight: "600",
  },
});
