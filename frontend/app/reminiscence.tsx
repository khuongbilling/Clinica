import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { SPACING, RADIUS } from "@/src/theme/colors";
import { MotionPanel, PanelEffect } from "@/src/components/reminiscence/MotionPanel";
import { LotusPetalOverlay } from "@/src/components/reminiscence/LotusPetalOverlay";
import { LotusRecallBurst } from "@/src/components/reminiscence/LotusRecallBurst";
import { TypedText } from "@/src/components/reminiscence/TypedText";

// Push 6 — Memory Reminiscence motion-comic upgrade.
//
// Runs exactly once, immediately after Push 4's class confirmation
// (post-recall.tsx redirects here instead of straight to the hub when
// `player.seen_reminiscence` is false). A short, paced, skippable
// donghua/manhwa-style motion-comic: 9 tap-to-advance illustrated panels with
// light Animated-API motion (fade / slow zoom / slow pan / pulse / lotus
// petals / a one-shot Lotus Recall burst) and optional typed "SYSTEM:" lines.
// No video files, no frame-by-frame animation — every panel is a single still
// illustration dressed up with lightweight, code-driven motion. Ends by
// transitioning into Clinica University (not the normal hub), whose
// "Start Here" card already highlights Lotus Lessons.
//
// Bright "donghua" palette — intentionally separate from the app's dark
// COLORS theme, since this scene is meant to read as pearl/ivory/sky-blue/
// jade/lotus-pink/gold rather than the dark-fantasy dashboard look used
// elsewhere in the app.
const PALETTE = {
  ivory: "#FBF6EC",
  skyBlueSoft: "#BFE0F5",
  gold: "#C9962C",
  goldBright: "#F2C25C",
  navyDeep: "#0E1526",
} as const;

type Panel = {
  kicker: string;
  lines: string[];
  systemLines?: string[];
  art: number;
  effect: PanelEffect;
  petals?: boolean;
};

const PANELS: Panel[] = [
  {
    kicker: "BEFORE THIS WORLD",
    lines: ["Before this world, there was another."],
    art: require("../assets/reminiscence/panel_01_classroom.png"),
    effect: "fadeIn",
  },
  {
    kicker: "AN UNNAMED FUTURE",
    lines: [
      "Fluorescent classrooms. Unfinished plans.",
      "A future leaning toward medicine, but never named.",
    ],
    art: require("../assets/reminiscence/panel_02_future.png"),
    effect: "zoomIn",
  },
  {
    kicker: "THAT DAY",
    lines: ["Then everything changed."],
    art: require("../assets/reminiscence/panel_03_event.png"),
    effect: "panSlow",
  },
  {
    kicker: "DARKNESS",
    lines: ["Darkness."],
    systemLines: ["SYSTEM: Soul-thread detected."],
    art: require("../assets/reminiscence/panel_04_darkness_thread.png"),
    effect: "pulse",
  },
  {
    kicker: "ARRIVAL",
    lines: ["And then — this world."],
    art: require("../assets/reminiscence/panel_05_arrival.png"),
    effect: "panSlow",
    petals: true,
  },
  {
    kicker: "A SECOND CHANCE",
    lines: [
      "You called it a second chance.",
      "But somewhere along the way, you mistook survival for mastery.",
    ],
    art: require("../assets/reminiscence/panel_06_mastery.png"),
    effect: "zoomIn",
  },
  {
    kicker: "THE SILENT INFARCT",
    lines: ["The ward corrected you."],
    systemLines: ["SYSTEM: Insight archive incomplete."],
    art: require("../assets/reminiscence/panel_07_infarct.png"),
    effect: "pulse",
  },
  {
    kicker: "LOTUS RECALL",
    lines: [],
    systemLines: ["SYSTEM: Emergency Lotus Recall activated.", "SYSTEM: Soul-thread preserved."],
    art: require("../assets/reminiscence/panel_08_lotus_recall.png"),
    effect: "lotusRecall",
    petals: true,
  },
  {
    kicker: "CLINICA UNIVERSITY",
    lines: [
      "You were not recalled because you were ready.",
      "You were recalled because you can still learn.",
    ],
    art: require("../assets/reminiscence/panel_09_university.png"),
    effect: "fadeIn",
    petals: true,
  },
];

export default function ReminiscenceScreen() {
  const router = useRouter();
  const { player, markReminiscenceSeen } = usePlayer();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  // Push 6 — Profile "Replay Memory Reminiscence" watches this cutscene again
  // without breaking University/Lotus Lessons state: markReminiscenceSeen is
  // already a no-op once seen_reminiscence is true, and this bounces back to
  // Profile afterward instead of re-entering University's onboarding path.
  const isReplay = replay === "1";
  const [panelIndex, setPanelIndex] = useState(0);
  const contentFade = useRef(new Animated.Value(0)).current;
  const finishingRef = useRef(false);

  useEffect(() => {
    contentFade.setValue(0);
    Animated.timing(contentFade, { toValue: 1, duration: 500, delay: 150, useNativeDriver: true }).start();
  }, [panelIndex, contentFade]);

  // Safety: if this screen is ever reached after it's already been seen
  // (e.g. deep link, back navigation, or app reload mid-scene), never trap
  // the player — bounce straight to the main hub. Skipped entirely in replay
  // mode, since seen_reminiscence being true is exactly what makes replay
  // reachable in the first place.
  useEffect(() => {
    if (!isReplay && player?.seen_reminiscence) {
      router.replace("/(tabs)");
    }
  }, [isReplay, player?.seen_reminiscence, router]);

  const finish = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    await markReminiscenceSeen();
    // After reminiscence, land the player on the MAIN hub — the System will
    // narrate the guided onboarding from there — not straight into University.
    router.replace(isReplay ? "/(tabs)/profile" : "/(tabs)");
  };

  const advance = () => {
    if (panelIndex < PANELS.length - 1) {
      setPanelIndex((i) => i + 1);
    } else {
      finish();
    }
  };

  const panel = PANELS[panelIndex];
  const isLast = panelIndex === PANELS.length - 1;
  const canSkip = panelIndex > 0;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={StyleSheet.absoluteFill}>
        <MotionPanel key={panelIndex} source={panel.art} effect={panel.effect}>
          {panel.effect === "lotusRecall" && <LotusRecallBurst />}
          {panel.petals && <LotusPetalOverlay density={panel.effect === "lotusRecall" ? 1.6 : 1} />}
          <LinearGradient
            colors={["rgba(14,21,38,0.05)", "rgba(14,21,38,0.12)", "rgba(14,21,38,0.86)"]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </MotionPanel>
      </View>

      <View style={styles.topBar}>
        <View style={styles.progressRow}>
          {PANELS.map((_, i) => (
            <View key={i} style={[styles.progressDot, i <= panelIndex && styles.progressDotActive]} />
          ))}
        </View>
        {canSkip && (
          <Pressable onPress={finish} hitSlop={10} testID="reminiscence-skip">
            <Text style={styles.skipTxt}>Skip</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={styles.flex} onPress={advance} testID="reminiscence-tap-area">
        <Animated.View style={[styles.content, { opacity: contentFade }]}>
          <Text style={styles.kicker}>{panel.kicker}</Text>
          <View style={{ gap: SPACING.sm }}>
            {panel.lines.map((line, i) => (
              <Text key={`l-${i}`} style={styles.line}>
                {line}
              </Text>
            ))}
            {panel.systemLines?.map((line, i) => (
              <TypedText
                key={`s-${panelIndex}-${i}`}
                text={line}
                delay={panel.lines.length > 0 ? 500 + i * 900 : i * 900}
                style={styles.systemLine}
              />
            ))}
          </View>
        </Animated.View>
      </Pressable>

      <View style={styles.bottomBar}>
        <Pressable style={styles.continueBtn} onPress={advance} testID="reminiscence-continue">
          <Text style={styles.continueTxt}>{isLast ? "Enter Clinica" : "Continue"}</Text>
          <Ionicons name="arrow-forward" size={16} color={PALETTE.ivory} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.navyDeep },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  progressRow: { flexDirection: "row", gap: 6, flex: 1, marginRight: SPACING.md },
  progressDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.28)" },
  progressDotActive: { backgroundColor: PALETTE.goldBright },
  skipTxt: { color: PALETTE.ivory, fontSize: 13, fontWeight: "600", opacity: 0.85 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },
  kicker: {
    color: PALETTE.goldBright,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  line: {
    color: PALETTE.ivory,
    fontSize: 19,
    fontWeight: "400",
    lineHeight: 27,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 1 },
  },
  systemLine: {
    color: PALETTE.skyBlueSoft,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
    fontFamily: "monospace",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  bottomBar: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, paddingTop: SPACING.sm },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: PALETTE.gold,
    borderRadius: RADIUS.pill,
    paddingVertical: SPACING.md,
    shadowColor: PALETTE.gold,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  continueTxt: { color: PALETTE.ivory, fontSize: 15, fontWeight: "700" },
});
