import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useBlockBack } from "@/src/hooks/useBlockBack";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { SceneTransition } from "@/src/components/onboarding/SceneTransition";
import { OnboardingProgressBar } from "@/src/components/onboarding/OnboardingProgressBar";
import { SystemNarratorBar } from "@/src/components/SystemNarratorBar";

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

  // The prologue finale must complete — backing out would re-enter the
  // scripted-loss boss or strand onboarding. proceed() exits via replace.
  useBlockBack();

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1800);
    return () => clearTimeout(t);
  }, []);

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
      {/* Clinica healing-academy background: deep jade night sky with lotus warmth */}
      <LinearGradient
        colors={["#0B1628", "#0E2330", "#112B28", "#0F2420"]}
        locations={[0, 0.35, 0.72, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["#1B5C4820", "#C084FC12", "#00000000"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.scrim} pointerEvents="none" />
      <SceneTransition style={styles.block} duration={1200}>
        {!isReplay && <OnboardingProgressBar step="Lotus Recall" />}
        {!isReplay && (
          <SystemNarratorBar
            message="You were not ready. But you answered the call. The Recall has brought you back — now the real training begins."
            testID="lotus-recall-narrator"
          />
        )}
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
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,10,14,0.62)" },
  block: { alignItems: "center", gap: SPACING.md, maxWidth: 380, width: "100%" },
  kicker: { color: COLORS.brand, fontSize: 12, letterSpacing: 4, fontWeight: "700", marginTop: SPACING.sm },
  title: { color: COLORS.onSurface, fontSize: 26, fontWeight: "300", textAlign: "center" },
  body: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  button: { backgroundColor: COLORS.brand, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, borderRadius: RADIUS.md, marginTop: SPACING.lg },
  buttonTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
  waitRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.lg },
  waitDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.brand },
  waitTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 1 },
});
