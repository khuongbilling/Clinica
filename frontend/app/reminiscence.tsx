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
import { LightMotesOverlay } from "@/src/components/reminiscence/LightMotesOverlay";
import { RainOverlay } from "@/src/components/reminiscence/RainOverlay";
import { TypedText } from "@/src/components/reminiscence/TypedText";

// Push 6 — "Fragments of Before": the Memory Reminiscence visual-novel cutscene.
//
// Runs exactly once, immediately after Push 4's class confirmation
// (post-recall.tsx redirects here instead of straight to the hub when
// `player.seen_reminiscence` is false). A paced, skippable donghua/manhwa-style
// visual novel: 15 tap-to-advance illustrated scene cards written as a single
// first-person memory, dressed with lightweight Animated-API motion (fade /
// slow zoom / slow pan / gentle pulse / heartbeat / lotus petals / rising light
// motes / cold rain / a one-shot Lotus Recall burst) and optional "SYSTEM:"
// lines. No video files, no frame-by-frame animation — every card is a single
// still illustration dressed up with code-driven motion.
//
// The colour arc runs bright → dark → golden: warm hopeful memories, then the
// cold weight of failure and grief, then the golden rebirth. An enigmatic
// narrator — "The Lotus Keeper" — appears only near the end (scenes 9–10),
// never dominating. Nothing is graphic; loss is shown symbolically (a wilting
// lotus, rain, a fading heartbeat). Ends by transitioning toward Clinica
// University, whose "Start Here" card already highlights the Lotus Lessons.
//
// Bright "donghua" palette — intentionally separate from the app's dark COLORS
// theme, since this scene reads as pearl/ivory/sky-blue/jade/lotus-pink/gold.
const PALETTE = {
  ivory: "#FBF6EC",
  skyBlueSoft: "#BFE0F5",
  gold: "#C9962C",
  goldBright: "#F2C25C",
  navyDeep: "#0E1526",
} as const;

// Per-scene bottom-heavy gradient tints that carry the bright→dark→golden arc.
// Each keeps the lower third dark enough for legible text while shifting the
// overall cast of the frame.
type Tint = "warm" | "dark" | "cold" | "gold";
const TINTS: Record<Tint, [string, string, string]> = {
  warm: ["rgba(60,40,14,0.02)", "rgba(46,30,10,0.16)", "rgba(28,18,6,0.82)"],
  dark: ["rgba(6,10,20,0.12)", "rgba(6,10,20,0.42)", "rgba(3,6,14,0.93)"],
  cold: ["rgba(20,32,48,0.10)", "rgba(12,22,38,0.44)", "rgba(4,10,22,0.93)"],
  gold: ["rgba(70,50,14,0.03)", "rgba(52,36,10,0.18)", "rgba(26,17,5,0.85)"],
};

type Panel = {
  kicker: string;
  lines: string[];
  systemLines?: string[];
  keeperLines?: string[];
  art: number;
  effect: PanelEffect;
  tint: Tint;
  petals?: boolean;
  motes?: boolean;
  moteColor?: string;
  rain?: boolean;
};

const PANELS: Panel[] = [
  {
    kicker: "A LIFE OF PURPOSE",
    lines: [
      "Before this world… there was another. And in it, I had a dream.",
      "To heal. To understand. To ease the pain of others.",
      "It was everything to me.",
    ],
    art: require("../assets/reminiscence/panel_01_classroom.png"),
    effect: "fadeIn",
    tint: "warm",
    motes: true,
    moteColor: "#FBE7B0",
  },
  {
    kicker: "THE PATH I CHOSE",
    lines: [
      "So I gave it everything. Every late night. Every doubt swallowed in silence.",
      "Every small step forward, I told myself the same quiet promise —",
      "that one day, it would be enough.",
    ],
    art: require("../assets/reminiscence/panel_02_future.png"),
    effect: "zoomIn",
    tint: "warm",
    motes: true,
    moteColor: "#FBE7B0",
  },
  {
    kicker: "THE WORLD I SWORE TO PROTECT",
    lines: [
      "Patients. Colleagues. Friends who became family.",
      "Their smiles. Their trust. The way they breathed easier when I walked in.",
      "They were every reason I kept going.",
    ],
    art: require("../assets/reminiscence/scene_people.png"),
    effect: "panSlow",
    tint: "warm",
    motes: true,
    moteColor: "#FBE7B0",
  },
  {
    kicker: "THE SHIFT THAT BROKE ME",
    lines: [
      "Then came the night that changed everything.",
      "Alarms tearing the quiet apart. Running feet. Too many, all at once.",
      "And one case I was so certain I could solve.",
    ],
    art: require("../assets/reminiscence/panel_03_event.png"),
    effect: "panSlow",
    tint: "dark",
  },
  {
    kicker: "THE SILENT INFARCT",
    lines: [
      "A quiet chest. A heart failing without a single cry for help.",
      "The signs were there. The clues were there.",
    ],
    systemLines: ["SYSTEM: Insight archive incomplete."],
    art: require("../assets/reminiscence/panel_07_infarct.png"),
    effect: "heartbeat",
    tint: "dark",
  },
  {
    kicker: "TOO SLOW. TOO SURE.",
    lines: [
      "But I was too slow. Too proud. Too blind to read it in time.",
      "And when I finally understood…",
      "the monitor had already gone still.",
    ],
    art: require("../assets/reminiscence/scene_flatline.png"),
    effect: "fadeIn",
    tint: "cold",
    rain: true,
  },
  {
    kicker: "EVERYTHING I COULDN'T SAVE",
    lines: [
      "It was not one life. In the end, it was many.",
      "And with each name I could not hold onto,",
      "a small part of me died with them.",
    ],
    art: require("../assets/reminiscence/scene_could_not_save.png"),
    effect: "fadeIn",
    tint: "cold",
  },
  {
    kicker: "THE WEIGHT OF REGRET",
    lines: [
      "I knelt in the rain and asked the question every healer fears to speak —",
      "was I ever truly enough?",
    ],
    art: require("../assets/reminiscence/scene_regret.png"),
    effect: "fadeIn",
    tint: "cold",
    rain: true,
  },
  {
    kicker: "WHAT I BECAME",
    lines: [
      "I was still a doctor. I still wore the coat.",
      "But I no longer remembered what it meant to heal.",
      "Only how it felt to fail.",
    ],
    art: require("../assets/reminiscence/scene_hollow.png"),
    effect: "zoomIn",
    tint: "cold",
  },
  {
    kicker: "IN THE DARKNESS",
    lines: [
      "And then… nothing. Weightless. Endless. I died.",
      "Or so I believed —",
      "until a single thread of light refused to let me fade.",
    ],
    systemLines: ["SYSTEM: Soul-thread detected."],
    art: require("../assets/reminiscence/panel_04_darkness_thread.png"),
    effect: "pulse",
    tint: "dark",
    petals: true,
  },
  {
    kicker: "THE VOICE",
    lines: [],
    keeperLines: [
      "A voice called to me. Not with anger…",
      "You grieve the ones you lost. Good.",
      "Only those who still grieve are worth calling back.",
    ],
    art: require("../assets/reminiscence/scene_lotus_keeper.png"),
    effect: "fadeIn",
    tint: "gold",
    motes: true,
    moteColor: "#FBE7B0",
  },
  {
    kicker: "THE LOTUS KEEPER",
    lines: [],
    keeperLines: [
      "I am the Lotus Keeper. I do not offer forgiveness, healer.",
      "I offer something you wasted the first time —",
      "the chance to truly understand.",
    ],
    art: require("../assets/reminiscence/scene_keeper_closeup.png"),
    effect: "zoomIn",
    tint: "gold",
    petals: true,
    motes: true,
    moteColor: "#FFF3D6",
  },
  {
    kicker: "A SECOND CHANCE",
    lines: [],
    keeperLines: [
      "\u201CYou still wish to heal?\u201D — Then learn.",
      "This time… understand first.",
      "Now — open your eyes.",
    ],
    art: require("../assets/reminiscence/scene_keeper_closeup.png"),
    effect: "pulse",
    tint: "gold",
    petals: true,
  },
  {
    kicker: "LOTUS RECALL",
    lines: [
      "Light poured through me — a warmth I had forgotten I could feel.",
      "A second heartbeat. Blooming.",
    ],
    systemLines: ["SYSTEM: Emergency Lotus Recall activated.", "SYSTEM: Soul-thread preserved."],
    art: require("../assets/reminiscence/panel_08_lotus_recall.png"),
    effect: "lotusRecall",
    tint: "gold",
    petals: true,
  },
  {
    kicker: "A NEW WORLD",
    lines: [
      "I opened my eyes to marble halls and morning gold — a world called Clinica.",
      "The past does not define me.",
      "But understanding it… will save the future.",
    ],
    art: require("../assets/reminiscence/panel_09_university.png"),
    effect: "fadeIn",
    tint: "gold",
    petals: true,
    motes: true,
    moteColor: "#FFF3D6",
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
  const hasKeeper = !!panel.keeperLines?.length;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={StyleSheet.absoluteFill}>
        <MotionPanel key={panelIndex} source={panel.art} effect={panel.effect}>
          {panel.effect === "lotusRecall" && <LotusRecallBurst />}
          {panel.rain && <RainOverlay density={1} />}
          {panel.motes && <LightMotesOverlay density={1} color={panel.moteColor} />}
          {panel.petals && <LotusPetalOverlay density={panel.effect === "lotusRecall" ? 1.6 : 1} />}
          <LinearGradient
            colors={TINTS[panel.tint]}
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
        <Text style={styles.counterTxt}>
          {panelIndex + 1} / {PANELS.length}
        </Text>
        {canSkip && (
          <Pressable onPress={finish} hitSlop={10} testID="reminiscence-skip">
            <Text style={styles.skipTxt}>Skip</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={styles.flex} onPress={advance} testID="reminiscence-tap-area">
        <Animated.View style={[styles.content, { opacity: contentFade }]}>
          <Text style={[styles.kicker, hasKeeper && styles.kickerKeeper]}>{panel.kicker}</Text>
          <View style={{ gap: SPACING.sm }}>
            {panel.lines.map((line, i) => (
              <Text key={`l-${i}`} style={styles.line}>
                {line}
              </Text>
            ))}
            {hasKeeper && (
              <View style={styles.keeperWrap}>
                <View style={styles.keeperNameRow}>
                  <Ionicons name="flower-outline" size={13} color={PALETTE.goldBright} />
                  <Text style={styles.keeperName}>THE LOTUS KEEPER</Text>
                </View>
                {panel.keeperLines?.map((line, i) => (
                  <Text key={`k-${i}`} style={styles.keeperLine}>
                    {line}
                  </Text>
                ))}
              </View>
            )}
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
  counterTxt: {
    color: PALETTE.goldBright,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    opacity: 0.9,
    marginRight: SPACING.md,
  },
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
  kickerKeeper: { color: PALETTE.goldBright },
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
  keeperWrap: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(20,14,6,0.42)",
    borderWidth: 1,
    borderColor: "rgba(242,194,92,0.35)",
  },
  keeperNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  keeperName: {
    color: PALETTE.goldBright,
    fontSize: 10,
    letterSpacing: 2.5,
    fontWeight: "800",
  },
  keeperLine: {
    color: "#FCEFC9",
    fontSize: 19,
    fontStyle: "italic",
    fontWeight: "500",
    lineHeight: 28,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.7)",
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
