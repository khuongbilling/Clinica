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
import { NarrativePanel } from "@/src/components/ui/NarrativePanel";
import { PrimaryButton } from "@/src/components/ui/PrimaryButton";

// "Reminiscing / Fragments of Before": the Memory Reminiscence visual-novel
// cutscene.
//
// Runs exactly once, immediately after Push 4's class confirmation
// (post-recall.tsx redirects here instead of straight to the hub when
// `player.seen_reminiscence` is false). A paced, skippable donghua/manhwa-style
// motion comic: 14 tap-to-advance illustrated scene cards written as one
// connected first-person memory, dressed with lightweight Animated-API motion
// (fade / slow zoom / slow pan / gentle pulse / heartbeat / lotus petals /
// rising light motes / cold rain / a one-shot Lotus Recall burst) and optional
// "SYSTEM:" lines. No video files, no frame-by-frame animation — every card is
// a single still illustration dressed up with code-driven motion.
//
// Story (current Clinica canon): the player was a HEALTH STUDENT in a world
// like Earth, with an undecided path (nursing / medicine / public health /
// mental health / research / teaching / leadership). Their first life ended
// suddenly; they awakened in Clinica, gained power too easily, mistook power
// for understanding, and failed against The Silent Infarction. Lotus Recall
// returned them for a second chance — not for more strength, but for guided
// learning that begins at Clinica University.
//
// The colour arc runs warm → dark → luminous: warm student memories, the sudden
// dark of the first death, the gold of awakening, warm overconfidence, the dark
// of the Silent Infarction and failure, then the golden rebirth. The enigmatic
// narrator — "The Lotus Keeper" — appears only near the end (scenes 12–13),
// ancient and instructional, never a tooltip. Nothing is graphic; loss is shown
// symbolically (collapse, rain, a fading heartbeat). Ends by pointing the player
// toward Clinica University, where the true journey begins.
//
// Muted "manhwa ink" palette — the reminiscence reads as a mature manhwa
// visual novel: aged paper, steel-blue ink, restrained luminous gold. Kept
// intentionally separate from the app's donghua gameplay themes.
const PALETTE = {
  ivory: "#EDE6D8",
  skyBlueSoft: "#9FB4C7",
  gold: "#B58A3A",
  goldBright: "#E0B45C",
  navyDeep: "#0A0C12",
} as const;

// Per-scene bottom-heavy gradient tints that carry the bright→dark→golden arc.
// Each keeps the lower third dark enough for legible text while shifting the
// overall cast of the frame.
type Tint = "warm" | "dark" | "cold" | "gold";
const TINTS: Record<Tint, [string, string, string]> = {
  warm: ["rgba(44,32,16,0.06)", "rgba(34,24,12,0.22)", "rgba(18,13,7,0.88)"],
  dark: ["rgba(4,6,12,0.16)", "rgba(4,6,12,0.48)", "rgba(2,3,7,0.95)"],
  cold: ["rgba(14,22,34,0.14)", "rgba(9,15,26,0.5)", "rgba(3,6,14,0.95)"],
  gold: ["rgba(52,38,14,0.06)", "rgba(38,27,10,0.24)", "rgba(19,13,5,0.88)"],
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
    kicker: "BEFORE CLINICA",
    lines: [
      "Before Clinica, there was another life — a world not so different from Earth.",
      "Classrooms. Deadlines. Crowded hallways. Futures that still felt open.",
      "I was a student then. Still learning. Still searching. Still certain there would be time.",
    ],
    art: require("../assets/reminiscence/panel_01_classroom.png"),
    effect: "fadeIn",
    tint: "warm",
    motes: true,
    moteColor: "#FBE7B0",
  },
  {
    kicker: "A FUTURE NOT YET CHOSEN",
    lines: [
      "I had not chosen a single path. Not yet.",
      "Nursing called to me. So did medicine. Public health. Mental health. Research. Teaching. Leadership.",
      "So many ways to heal — and I had not yet learned which one belonged to me.",
    ],
    art: require("../assets/reminiscence/panel_02_future.png"),
    effect: "zoomIn",
    tint: "warm",
    motes: true,
    moteColor: "#FBE7B0",
  },
  {
    kicker: "WHY I WANTED TO HEAL",
    lines: [
      "If I had not yet chosen my profession, I had already chosen my reason.",
      "I wanted to understand suffering. To ease fear.",
      "To stand beside someone in their worst moment — and not look away.",
    ],
    art: require("../assets/reminiscence/scene_people.png"),
    effect: "panSlow",
    tint: "warm",
    motes: true,
    moteColor: "#FBE7B0",
  },
  {
    kicker: "THE LIFE I THOUGHT WOULD CONTINUE",
    lines: [
      "My life was unfinished in the ordinary way most lives are unfinished.",
      "Assignments I still meant to complete. Messages I still meant to answer.",
      "I believed the future would wait for me. I believed there would always be one more day.",
    ],
    art: require("../assets/reminiscence/panel_03_event.png"),
    effect: "panSlow",
    tint: "warm",
    rain: true,
  },
  {
    kicker: "THE END OF THE FIRST LIFE",
    lines: [
      "Then one ordinary moment became my last.",
      "No grand warning. No storybook sign — only a sudden rupture.",
      "The floor vanished beneath certainty. And then… there was only darkness.",
    ],
    art: require("../assets/reminiscence/scene_flatline.png"),
    effect: "fadeIn",
    tint: "dark",
    rain: true,
  },
  {
    kicker: "AWAKENING IN CLINICA",
    lines: [
      "When I opened my eyes again, I was no longer in that world.",
      "A realm where illness could take shape, and healing held true power.",
      "This was Clinica. I did not know why I had been brought here — only that I had another life.",
    ],
    art: require("../assets/reminiscence/panel_05_arrival.png"),
    effect: "fadeIn",
    tint: "gold",
    petals: true,
    motes: true,
    moteColor: "#FFF3D6",
  },
  {
    kicker: "THE POWER THAT CAME TOO EASILY",
    lines: [
      "Fragments of who I had once been returned to me as instinct.",
      "I could act. I could fight. I could heal.",
      "Power came so easily that I mistook familiarity for understanding.",
    ],
    art: require("../assets/reminiscence/panel_06_mastery.png"),
    effect: "zoomIn",
    tint: "gold",
    motes: true,
    moteColor: "#FBE7B0",
  },
  {
    kicker: "CONFIDENCE WITHOUT UNDERSTANDING",
    lines: [
      "I stopped questioning what I should have studied.",
      "I treated symptoms before causes. I acted before I understood.",
      "I thought confidence was the same as mastery. It was not.",
    ],
    art: require("../assets/reminiscence/scene_hollow.png"),
    effect: "zoomIn",
    tint: "warm",
  },
  {
    kicker: "THE SILENT INFARCTION",
    lines: [
      "Then I met the enemy that power alone could never defeat.",
      "The Silent Infarction. It did not overwhelm me — it did something worse.",
      "It revealed me.",
    ],
    systemLines: ["SYSTEM: Hidden cues undetected."],
    art: require("../assets/reminiscence/panel_07_infarct.png"),
    effect: "heartbeat",
    tint: "dark",
  },
  {
    kicker: "THE FAILURE",
    lines: [
      "In that moment, my certainty fell apart.",
      "The signs had been there. The warnings. The truth beneath the surface.",
      "I had wanted to heal — but wanting had not been enough.",
    ],
    art: require("../assets/reminiscence/scene_regret.png"),
    effect: "fadeIn",
    tint: "cold",
    rain: true,
  },
  {
    kicker: "LOTUS RECALL",
    lines: [
      "But even that was not the end.",
      "A light unfolded beneath me like a bloom opening in the dark.",
      "Time trembled. Memory recoiled. I was not erased — I was returned.",
    ],
    systemLines: ["SYSTEM: Emergency Lotus Recall activated.", "SYSTEM: Soul-thread preserved."],
    art: require("../assets/reminiscence/panel_08_lotus_recall.png"),
    effect: "lotusRecall",
    tint: "gold",
    petals: true,
  },
  {
    kicker: "THE VOICE",
    lines: [],
    keeperLines: [
      "Then a voice found me in the dark. Calm. Ancient. Neither cruel nor kind.",
      "You mistook power for mastery. You acted before you understood.",
      "You called yourself ready because the world had not yet corrected you. Now it has.",
    ],
    art: require("../assets/reminiscence/scene_lotus_keeper.png"),
    effect: "fadeIn",
    tint: "gold",
    motes: true,
    moteColor: "#FBE7B0",
  },
  {
    kicker: "THE SECOND CHANCE",
    lines: [],
    keeperLines: [
      "You were not returned to repeat your failure. You were returned to confront it.",
      "This time, you will not begin with power. You will begin with study.",
      "You will understand before you claim the right to heal.",
    ],
    art: require("../assets/reminiscence/scene_keeper_closeup.png"),
    effect: "zoomIn",
    tint: "gold",
    petals: true,
    motes: true,
    moteColor: "#FFF3D6",
  },
  {
    kicker: "CLINICA UNIVERSITY",
    lines: [
      "And so I was sent back — not to my first world, but to the beginning of this one.",
      "Ahead of me stood the University — not a detour, but the path I should have taken from the start.",
      "This time, I will not mistake power for wisdom. This time, I will learn before I act.",
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
    // The reminiscence ends on "Clinica University" — so land the player there
    // directly, delivering on the cutscene's promise instead of detouring
    // through the hub. University is gated only by account level 1 (always met),
    // so a fresh post-recall player never hits the feature lock, and the
    // University screen already greets them (the System's "you were recalled…"
    // line + arrival transition). The hub's own welcome modal + System-narrator
    // intro simply defer until the player first opens the hub. Replay mode (from
    // Profile) still returns to Profile so it never re-enters onboarding.
    router.replace(isReplay ? "/(tabs)/profile" : "/university");
  };

  // Guard against accidental double-advance: the bottom narrative panel and the
  // Continue button are stacked tap targets, so a single tap near their seam
  // could otherwise fire twice and skip a scene. Ignore any advance within a
  // short window of the previous one so progression stays exactly one step.
  const lastAdvanceRef = useRef(0);
  const advance = () => {
    const now = Date.now();
    if (now - lastAdvanceRef.current < 350) return;
    lastAdvanceRef.current = now;
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

      {/* Upper region — tapping the illustration advances the scene */}
      <Pressable style={styles.tapArea} onPress={advance} testID="reminiscence-tap-area" />

      {/* Bottom narrative panel — keeps story text legible over the art */}
      <Animated.View style={[styles.bottomWrap, { opacity: contentFade }]}>
        <Pressable onPress={advance}>
          <NarrativePanel>
            <Text style={[styles.kicker, hasKeeper && styles.kickerKeeper]}>{panel.kicker}</Text>
            <View style={{ gap: SPACING.sm, marginTop: SPACING.sm }}>
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
          </NarrativePanel>
        </Pressable>

        <PrimaryButton
          label={isLast ? "Begin at the University" : "Continue"}
          onPress={advance}
          iconRight="arrow-forward"
          style={styles.continueBtn}
          testID="reminiscence-continue"
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.navyDeep },
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
  tapArea: { flex: 1 },
  bottomWrap: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.sm,
    gap: SPACING.md,
  },
  kicker: {
    color: PALETTE.goldBright,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "800",
    textAlign: "center",
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
  continueBtn: { alignSelf: "stretch" },
});
