import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// Push 5 — Memory Reminiscence.
//
// Runs exactly once, immediately after Push 4's class confirmation
// (post-recall.tsx redirects here instead of straight to the hub when
// `player.seen_reminiscence` is false). A short, paced, skippable story
// beat that explains the isekai setup in respectful, non-graphic terms:
// modern-world student -> sudden cardiac event -> fantasy world -> mistook
// survival for mastery -> lost to The Silent Infarct -> saved by Lotus
// Recall as a second chance. Ends by transitioning into Clinica University
// (not the normal hub) so the University feels like the meaningful next
// step, not a random menu item.

const BEATS: { kicker: string; lines: string[] }[] = [
  {
    kicker: "BEFORE",
    lines: [
      "Before this world, there was another.",
      "Fluorescent classrooms. Unfinished plans.",
      "A future leaning toward medicine — but never fully named.",
    ],
  },
  {
    kicker: "THAT DAY",
    lines: [
      "Then, without warning, your heart lost its rhythm.",
      "It happened fast, and it happened quietly.",
      "You don't remember all of it. You don't need to.",
    ],
  },
  {
    kicker: "AFTER",
    lines: [
      "Darkness.",
      "And then — this world.",
      "You called it a second chance.",
    ],
  },
  {
    kicker: "THE MISTAKE",
    lines: [
      "But somewhere along the way, you mistook survival for mastery.",
      "You walked into the ward like you already knew how it would end.",
    ],
  },
  {
    kicker: "THE SILENT INFARCT",
    lines: [
      "It doesn't announce itself. It doesn't wait for you to be ready.",
      "You went in unprepared, and it corrected you.",
      "Today, the ward corrected you.",
    ],
  },
  {
    kicker: "LOTUS RECALL",
    lines: [
      "You were not left there.",
      "Lotus Recall pulled you back — not as a reward, but as a chance to actually learn this time.",
    ],
  },
];

export default function ReminiscenceScreen() {
  const router = useRouter();
  const { player, markReminiscenceSeen } = usePlayer();
  const [beatIndex, setBeatIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const finishingRef = useRef(false);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [beatIndex, fadeAnim]);

  // Safety: if this screen is ever reached after it's already been seen
  // (e.g. deep link / back navigation), don't trap the player — bounce to
  // University immediately.
  useEffect(() => {
    if (player?.seen_reminiscence) {
      router.replace("/university");
    }
  }, [player?.seen_reminiscence, router]);

  const finish = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    await markReminiscenceSeen();
    router.replace("/university");
  };

  const advance = () => {
    if (beatIndex < BEATS.length - 1) {
      setBeatIndex((i) => i + 1);
    } else {
      finish();
    }
  };

  const beat = BEATS[beatIndex];
  const isLast = beatIndex === BEATS.length - 1;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />

      <View style={styles.topBar}>
        <View style={styles.progressRow}>
          {BEATS.map((_, i) => (
            <View
              key={i}
              style={[styles.progressDot, i <= beatIndex && styles.progressDotActive]}
            />
          ))}
        </View>
        <Pressable onPress={finish} hitSlop={10} testID="reminiscence-skip">
          <Text style={styles.skipTxt}>Skip</Text>
        </Pressable>
      </View>

      <Pressable style={styles.flex} onPress={advance} testID="reminiscence-tap-area">
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <Text style={styles.kicker}>{beat.kicker}</Text>
          <View style={{ gap: SPACING.md }}>
            {beat.lines.map((line, i) => (
              <Text key={i} style={styles.line}>{line}</Text>
            ))}
          </View>
        </Animated.View>
      </Pressable>

      <View style={styles.bottomBar}>
        <Pressable style={styles.continueBtn} onPress={advance} testID="reminiscence-continue">
          <Text style={styles.continueTxt}>{isLast ? "Enter Clinica University" : "Continue"}</Text>
          <Ionicons name="arrow-forward" size={16} color={COLORS.onBrand} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md,
  },
  progressRow: { flexDirection: "row", gap: 6, flex: 1, marginRight: SPACING.md },
  progressDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: COLORS.border },
  progressDotActive: { backgroundColor: COLORS.brand },
  skipTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: "600" },
  content: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: SPACING.xl, gap: SPACING.lg,
  },
  kicker: { color: COLORS.brand, fontSize: 11, letterSpacing: 3, fontWeight: "800" },
  line: { color: COLORS.onSurface, fontSize: 18, fontWeight: "300", lineHeight: 27, textAlign: "center" },
  bottomBar: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, paddingTop: SPACING.sm },
  continueBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    backgroundColor: COLORS.brand, borderRadius: RADIUS.pill, paddingVertical: SPACING.md,
  },
  continueTxt: { color: COLORS.onBrand, fontSize: 15, fontWeight: "700" },
});
