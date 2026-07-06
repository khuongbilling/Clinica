import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { SceneTransition } from "@/src/components/onboarding/SceneTransition";
import { OnboardingProgressBar } from "@/src/components/onboarding/OnboardingProgressBar";

// Push 1 prologue finale. Reached only after the scripted-to-lose Silent
// Infarct boss battle. There is no Game Over screen here and no rewards —
// this is a narrative beat: the patient could not be saved, the Kingdom of
// Healing calls the player back ("Lotus Recall"), and they land safely in
// the post-recall home state to begin their real training.
export default function LotusRecall() {
  const router = useRouter();
  const { completePrologue } = usePlayer();
  const { replay } = useLocalSearchParams<{ enemyId?: string; replay?: string }>();
  // Push 6 — Replay Prologue watches this cinematic without ever writing
  // prologue_complete or entering the real (mutating) post-recall onboarding.
  const isReplay = replay === "1";
  const [ready, setReady] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 1200, useNativeDriver: true }).start();
    const t = setTimeout(() => setReady(true), 1800);
    return () => clearTimeout(t);
  }, [fadeAnim]);

  const proceed = async () => {
    if (isReplay) {
      router.replace("/(tabs)/profile");
      return;
    }
    await completePrologue();
    router.replace("/post-recall");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]} testID="lotus-recall-screen">
      <Animated.View style={[styles.glow, { opacity: fadeAnim }]} pointerEvents="none" />
      <SceneTransition style={styles.block} duration={1200}>
        {!isReplay && <OnboardingProgressBar step="Lotus Recall" />}
        <Ionicons name="flower" size={40} color={COLORS.brand} />
        <Text style={styles.kicker}>LOTUS RECALL</Text>
        <Text style={styles.title}>The patient is gone.</Text>
        <Text style={styles.body}>
          Some conditions hide until it is too late — a silent, incomplete picture, a chart that
          contradicted itself, a warning that came too late to act on.
        </Text>
        <Text style={styles.body}>
          This is not a failure of your hands. It is a reminder of why the Kingdom trains its
          healers so carefully. A pulse of lotus light draws you back to the Sanctuary, safe,
          to begin that training in earnest.
        </Text>
        {ready ? (
          <Pressable style={styles.button} onPress={proceed} testID="lotus-recall-continue">
            <Text style={styles.buttonTxt}>{isReplay ? "END REPLAY" : "RETURN TO THE SANCTUARY"}</Text>
          </Pressable>
        ) : (
          <View style={styles.waitRow}>
            <View style={styles.waitDot} />
            <Text style={styles.waitTxt}>The lotus light gathers…</Text>
          </View>
        )}
      </SceneTransition>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  block: { alignItems: "center", gap: SPACING.md, maxWidth: 380 },
  kicker: { color: COLORS.brand, fontSize: 12, letterSpacing: 4, fontWeight: "700", marginTop: SPACING.sm },
  title: { color: COLORS.onSurface, fontSize: 26, fontWeight: "300", textAlign: "center" },
  body: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  button: { backgroundColor: COLORS.brand, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, borderRadius: RADIUS.md, marginTop: SPACING.lg },
  buttonTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
  glow: {
    position: "absolute",
    top: "30%",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: COLORS.brand,
    opacity: 0.08,
  },
  waitRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.lg },
  waitDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.brand },
  waitTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 1 },
});
