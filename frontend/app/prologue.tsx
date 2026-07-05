import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { usePlayer } from "@/src/game/store";
import { COLORS, SPACING } from "@/src/theme/colors";

// Push 1 prologue entry point. Replaces the old name/quiz onboarding as the
// very first thing a brand-new player sees: a short cinematic beat, then a
// silent, default player is created (prologue_complete: false) and the
// player is dropped straight into the guided tutorial Ward Shift battle.
// Name input, the aptitude quiz, and the class-result screen are deferred to
// a later push — onboarding.tsx is left intact and unlinked for now.
export default function Prologue() {
  const router = useRouter();
  const { player, createPlayer } = usePlayer();
  const [starting, setStarting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const startedRef = useRef(false);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (startedRef.current) return;
    if (player && player.prologue_complete === false) {
      startedRef.current = true;
      router.replace({ pathname: "/battle", params: { enemyId: "dehydration_wisp", training: "1", prologue: "tutorial" } });
      return;
    }
    if (!player) {
      startedRef.current = true;
      setStarting(true);
      createPlayer({
        name: "Healer",
        aptitude: "guardian",
        codex_depth: "simple",
        prologue_complete: false,
      }).then(() => {
        router.replace({ pathname: "/battle", params: { enemyId: "dehydration_wisp", training: "1", prologue: "tutorial" } });
      }).catch(() => {
        setStarting(false);
        startedRef.current = false;
      });
    }
  }, [player, createPlayer, router]);

  return (
    <View style={styles.container} testID="prologue-screen">
      <Animated.View style={[styles.block, { opacity: fadeAnim }]}>
        <Text style={styles.kicker}>THE KINGDOM OF HEALING</Text>
        <Text style={styles.title}>A patient needs you.</Text>
        <Text style={styles.body}>
          Somewhere in the ward, Stability is falling and Corruption is spreading.
          There is no time for paperwork — only the work itself.
        </Text>
        <Text style={styles.sub}>{starting ? "Entering the ward…" : "Preparing your first shift…"}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  block: { alignItems: "center", gap: SPACING.md, maxWidth: 360 },
  kicker: { color: COLORS.brand, fontSize: 11, letterSpacing: 3, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 26, fontWeight: "300", textAlign: "center" },
  body: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  sub: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 1, marginTop: SPACING.md },
});
