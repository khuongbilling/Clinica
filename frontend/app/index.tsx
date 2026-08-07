import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { usePlayer } from "@/src/game/store";
import { COLORS, SPACING } from "@/src/theme/colors";

const HINTS = [
  "The Kingdom of Clinica is shaped like the human body.",
  "Read ALL clues before choosing your action.",
  "Keep Stability above zero — or the patient is lost.",
  "Reduce Corruption to zero to defeat the disease.",
  "Air Temple governs the lungs. River Domain, the heart.",
  "Match your hero's element to the enemy's system.",
  "Rapid Response costs 2 AP — save it for critical moments.",
  "Assess first, intervene second. Always.",
  "Mind Citadel holds neurological function. Protect it.",
  "The Fading Core awaits once you prove yourself in the ward.",
];

export default function Boot() {
  const { player, loading } = usePlayer();
  // DEV ONLY: ?qa_direct_hub=1 skips the title screen so screenshot tools
  // can reach the hub directly (the <Redirect> is followed by the tool).
  const { qa_direct_hub, qa_inject } = useLocalSearchParams<{ qa_direct_hub?: string; qa_inject?: string }>();
  const [hintIdx, setHintIdx] = useState(() => Math.floor(Math.random() * HINTS.length));
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!loading) return;
    const cycle = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setHintIdx((i) => (i + 1) % HINTS.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 2800);
    return () => clearInterval(cycle);
  }, [loading]);

  if (loading) {
    return (
      <View style={styles.container} testID="boot-loading">
        <View style={styles.brandBlock}>
          <Text style={styles.title}>CLINICA</Text>
          <Text style={styles.subtitle}>Kingdom of Healing</Text>
        </View>
        <View style={styles.hintBlock}>
          <Text style={styles.hintLabel}>FROM THE CODEX</Text>
          <Animated.Text style={[styles.hintText, { opacity: fadeAnim }]}>
            {HINTS[hintIdx]}
          </Animated.Text>
        </View>
      </View>
    );
  }

  // Once the player store has loaded, always enter through the title/landing
  // screen. From there "Start Game" runs the full-page preloader, which warms
  // every asset (including battle backgrounds) before routing into the game.
  // DEV ONLY: either param jumps straight to the hub (no title → preloader chain).
  // qa_inject=1 also runs the web/index.html script which seeds localStorage with
  // a mock player before React starts, so readPlayerSync() returns it on frame 1.
  if (qa_direct_hub === "1" || qa_inject === "1") return <Redirect href="/(tabs)" />;
  return <Redirect href="/title" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xl,
    padding: SPACING.xl,
  },
  brandBlock: { alignItems: "center", gap: SPACING.sm },
  title: {
    color: COLORS.brand,
    fontSize: 40,
    letterSpacing: 8,
    fontWeight: "300",
  },
  subtitle: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13,
    letterSpacing: 3,
  },
  hintBlock: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    maxWidth: 340,
  },
  hintLabel: {
    color: COLORS.brand,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
  },
  hintText: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    fontStyle: "italic",
  },
});
