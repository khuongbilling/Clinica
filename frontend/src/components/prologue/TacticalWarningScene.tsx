/**
 * TacticalWarningScene
 *
 * Push 3 prologue cinematic — "The Battlefield"
 * Phase: former_self_battlefield_cutscene
 *
 * Visual-novel style scene set on the 2.5D isometric emergency treatment plaza.
 * Master Bai, Florence Nightingale, and Sir Alexander Fleming warn the Former Self
 * not to advance alone. The Prodigy ignores them. The Silent Infarction springs its trap.
 *
 * UX:
 *  - Tap anywhere to reveal the next dialogue line or advance to the next beat.
 *  - Active speaker's portrait glows; inactive speakers are dimmed.
 *  - Stage directions appear in small italic text above the dialogue.
 *  - A red overlay pulses in on the final three beats (trap reveal).
 *  - Calls onComplete() after the last beat finishes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: W, height: H } = Dimensions.get("window");
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

// ─── Art ─────────────────────────────────────────────────────────────────────

import { PROLOGUE_CHARACTERS } from "../../game/prologueCharacters";

const ART = {
  battlefield: require("../../../assets/images/tactical_battlefield.png"),
  masterBai:   PROLOGUE_CHARACTERS.MASTER_BAI.avatar48,
  nightingale: PROLOGUE_CHARACTERS.NIGHTINGALE.avatar48,
  fleming:     require("../../../assets/images/fleming_vn_bust.png"),
  prodigy:     PROLOGUE_CHARACTERS.PRODIGY.avatar48,
} as const;

// ─── Characters ───────────────────────────────────────────────────────────────

type SpeakerId = "MASTER_BAI" | "NIGHTINGALE" | "FLEMING" | "PRODIGY";

// artHeight = Math.round(W * 0.68 * nativeH / nativeW) — update if PNGs are regenerated.
const SPEAKERS: Record<SpeakerId, { label: string; color: string; avatar: any; art: any; artFit: "contain" | "cover"; artHeight?: number }> = {
  // master_bai_vn_extended.png 1003×1152
  MASTER_BAI:  { label: "Master Bai",           color: "#D9A441", avatar: ART.masterBai,   art: PROLOGUE_CHARACTERS.MASTER_BAI.largePortrait,  artFit: "contain", artHeight: Math.round(W * 0.68 * 1152 / 1003) },
  // nightingale_vn_extended.png 1422×1248 (landscape)
  NIGHTINGALE: { label: "Florence Nightingale",  color: "#E8C453", avatar: ART.nightingale, art: PROLOGUE_CHARACTERS.NIGHTINGALE.largePortrait, artFit: "contain", artHeight: Math.round(W * 0.68 * 1248 / 1422) },
  // fleming_vn_extended.png 1024×1248
  FLEMING:     { label: "Sir Alexander Fleming", color: "#3ECFB2", avatar: ART.fleming,     art: PROLOGUE_CHARACTERS.FLEMING.largePortrait,     artFit: "contain", artHeight: Math.round(W * 0.68 * 1248 / 1024) },
  // prodigy_vn_extended.png 1202×1248
  PRODIGY:     { label: "The Prodigy",           color: "#7EB8F7", avatar: ART.prodigy,     art: PROLOGUE_CHARACTERS.PRODIGY.largePortrait,     artFit: "contain", artHeight: Math.round(W * 0.68 * 1248 / 1202) },
};

const SPEAKER_ORDER: SpeakerId[] = ["MASTER_BAI", "NIGHTINGALE", "FLEMING", "PRODIGY"];

// ─── Dialogue beats ───────────────────────────────────────────────────────────

type Beat = {
  speaker:   SpeakerId;
  lines:     string[];
  stageDir?: string;   // italic stage direction shown above dialogue
  trapReveal?: boolean; // triggers red overlay pulse
};

const BEATS: Beat[] = [
  {
    speaker:  "MASTER_BAI",
    lines:    ["Stop where you are."],
    stageDir: "Master Bai steps forward, one hand raised toward the plaza entrance.",
  },
  {
    speaker:  "PRODIGY",
    lines:    ["We have already wasted enough time."],
    stageDir: "The Prodigy halts, turning back with visible impatience.",
  },
  {
    speaker: "MASTER_BAI",
    lines: [
      "Time spent observing is not time wasted.",
      "Something is wrong. The enemy is allowing us to see only what it wants us to see.",
    ],
    stageDir: "Master Bai gestures toward the fog-covered far end of the plaza.",
  },
  {
    speaker:  "PRODIGY",
    lines:    ["You taught me to trust my training."],
    stageDir: "The Prodigy steps toward the visible enemies below.",
  },
  {
    speaker: "MASTER_BAI",
    lines: [
      "I taught you to question your first conclusion.",
      "Confidence without reflection is merely another form of blindness.",
    ],
  },
  {
    speaker:  "NIGHTINGALE",
    lines:    ["These injuries do not match the enemies in front of us."],
    stageDir: "Nightingale kneels beside an injured NPC, raising her golden lamp over them.",
  },
  {
    speaker:  "PRODIGY",
    lines:    ["Then we will ask the enemy after we defeat it."],
    stageDir: "The Prodigy draws their weapon.",
  },
  {
    speaker: "NIGHTINGALE",
    lines: [
      "The environment is part of the assessment.",
      "Their breathing changed before they collapsed. The monitors failed before the first creature appeared. We are missing something important.",
    ],
    stageDir: "Nightingale stands, turning to face the monitoring crystals. All of them dark.",
  },
  {
    speaker: "PRODIGY",
    lines:   ["Or you are searching for complexity where none exists."],
  },
  {
    speaker: "NIGHTINGALE",
    lines:   ["A patient does not become less endangered because the danger is difficult to see."],
  },
  {
    speaker:  "FLEMING",
    lines:    ["This corruption is adapting."],
    stageDir: "Fleming crouches, examining a glowing sample scraped from the cracked floor tiles.",
  },
  {
    speaker: "PRODIGY",
    lines:   ["Everything adapts shortly before I destroy it."],
  },
  {
    speaker: "FLEMING",
    lines: [
      "That certainty is precisely what concerns me.",
      "The organisms at the edge are already resistant to our first response. If we attack carelessly, we may strengthen what we are trying to eliminate.",
    ],
    stageDir: "Fleming holds the sample up. The corruption has already changed color.",
  },
  {
    speaker: "PRODIGY",
    lines:   ["Then I will strike hard enough that resistance will not matter."],
  },
  {
    speaker: "FLEMING",
    lines:   ["Power used without proper selection can turn treatment into harm."],
  },
  {
    speaker:  "MASTER_BAI",
    lines:    ["Wait for the others. Assess the field. Form a plan."],
    stageDir: "Master Bai places a hand on The Prodigy's shoulder.",
  },
  {
    speaker: "PRODIGY",
    lines: [
      "While we stand here discussing possibilities, people are suffering.",
      "I have defeated stronger enemies than this alone.",
    ],
    stageDir: "The Prodigy steps forward, shrugging off Master Bai's hand.",
  },
  {
    speaker: "MASTER_BAI",
    lines:   ["That is why this enemy has chosen you."],
  },
  {
    speaker:     "PRODIGY",
    lines:       ["Watch carefully, Master.", "I will show you how quickly this can be ended."],
    stageDir:    "The Prodigy advances alone. The fog at the far end begins to part, revealing the trap.",
    trapReveal:  true,
  },
];

// ─── Timing ───────────────────────────────────────────────────────────────────

const LINE_REVEAL_MS   = 900;   // gap between lines in a multi-line beat
const AUTO_ADVANCE_MS  = 3200;  // after all lines shown, auto-tap after this delay

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function TacticalWarningScene({ onComplete }: Props) {
  // ── State ──
  const insets      = useSafeAreaInsets();
  const [panelH,    setPanelH]    = useState(240); // measured dialogue panel height
  const charWrapBot = panelH + insets.bottom;      // portrait bottom = top of dialogue panel

  const [beatIdx,   setBeatIdx]   = useState(0);
  const [lineIdx,   setLineIdx]   = useState(0);   // lines revealed so far (0-based count)

  // Refs — avoids stale closures in timers
  const beatIdxRef    = useRef(0);
  const lineIdxRef    = useRef(0);
  const busyRef       = useRef(false);
  const mountedRef    = useRef(true);
  const doAdvanceRef  = useRef<() => void>(() => {});  // breaks circular dep with revealBeat

  // ── Animation values ──
  const introFade  = useRef(new Animated.Value(0)).current;
  const mainFade   = useRef(new Animated.Value(0)).current;
  const redOverlay = useRef(new Animated.Value(0)).current;  // trap reveal
  const bgScale    = useRef(new Animated.Value(1.04)).current; // slow ambient zoom
  const lineAnims  = useRef(
    Array.from({ length: 4 }, () => new Animated.Value(0))
  ).current;
  const stageDirFade = useRef(new Animated.Value(0)).current;
  const speakerFade  = useRef(new Animated.Value(0)).current;

  // Timers
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  // ── Fade helpers ──
  const fadeIn  = useCallback((val: Animated.Value, dur = 500) =>
    Animated.timing(val, { toValue: 1, duration: dur, useNativeDriver: true }).start(), []);
  const fadeOut = useCallback((val: Animated.Value, dur = 300) =>
    Animated.timing(val, { toValue: 0, duration: dur, useNativeDriver: true }).start(), []);

  // ── Ambient bg breathing ──
  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(bgScale, { toValue: 1.0,  duration: 6000, useNativeDriver: true }),
        Animated.timing(bgScale, { toValue: 1.04, duration: 6000, useNativeDriver: true }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [bgScale]);

  // ── Intro hold ──
  useEffect(() => {
    fadeIn(introFade, 800);
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      // Intro banner fades out, scene fades in
      fadeOut(introFade, 600);
      const t2 = setTimeout(() => {
        if (!mountedRef.current) return;
        fadeIn(mainFade, 700);
        revealBeat(0);
      }, 700);
      timers.current.push(t2);
    }, 2800);
    timers.current.push(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reveal a beat (switch speaker + show lines) ──
  const revealBeat = useCallback((idx: number) => {
    clearTimers();
    beatIdxRef.current = idx;
    lineIdxRef.current = 0;
    busyRef.current    = false;

    const beat = BEATS[idx];

    // Reset line anims
    lineAnims.forEach(a => a.setValue(0));
    stageDirFade.setValue(0);
    speakerFade.setValue(0);

    setBeatIdx(idx);
    setLineIdx(0);

    // Speaker chip + stage dir fade in
    fadeIn(speakerFade, 400);
    if (beat.stageDir) fadeIn(stageDirFade, 500);

    // Trap reveal overlay
    if (beat.trapReveal) {
      Animated.timing(redOverlay, { toValue: 0.45, duration: 2000, useNativeDriver: true }).start();
    }

    // Line reveals — line 0 immediate, subsequent staggered
    fadeIn(lineAnims[0], 500);

    for (let i = 1; i < beat.lines.length; i++) {
      const t = setTimeout(() => {
        if (!mountedRef.current) return;
        fadeIn(lineAnims[i], 500);
        lineIdxRef.current = i;
        setLineIdx(i);
      }, i * LINE_REVEAL_MS);
      timers.current.push(t);
    }

    // Auto-advance after all lines + hold
    // Uses doAdvanceRef to avoid a circular useCallback dependency.
    const autoDelay = (beat.lines.length - 1) * LINE_REVEAL_MS + AUTO_ADVANCE_MS;
    const autoT = setTimeout(() => {
      if (mountedRef.current) doAdvanceRef.current();
    }, autoDelay);
    timers.current.push(autoT);
  }, [lineAnims, stageDirFade, speakerFade, redOverlay, clearTimers, fadeIn]);

  // ── Advance: next line or next beat ──
  const doAdvance = useCallback(() => {
    if (!mountedRef.current || busyRef.current) return;
    const beat     = BEATS[beatIdxRef.current];
    const curLine  = lineIdxRef.current;
    const maxLine  = beat.lines.length - 1;

    if (curLine < maxLine) {
      // Reveal next line immediately (skip auto-reveal timer)
      clearTimers();
      busyRef.current = false;
      const nextLine = curLine + 1;
      fadeIn(lineAnims[nextLine], 300);
      lineIdxRef.current = nextLine;
      setLineIdx(nextLine);

      // Still need auto-advance after showing all remaining lines
      const remaining = maxLine - nextLine;
      const autoDelay = remaining * LINE_REVEAL_MS + AUTO_ADVANCE_MS;
      const autoT = setTimeout(() => {
        if (mountedRef.current) doAdvanceRef.current();
      }, autoDelay);
      timers.current.push(autoT);
      return;
    }

    // All lines shown — move to next beat
    clearTimers();
    busyRef.current = true;
    const next = beatIdxRef.current + 1;

    if (next >= BEATS.length) {
      // Last beat — cross-fade out then complete
      Animated.timing(mainFade, { toValue: 0, duration: 800, useNativeDriver: true }).start(() => {
        if (mountedRef.current) onComplete();
      });
      return;
    }

    // Cross-fade to next beat
    Animated.timing(mainFade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      if (!mountedRef.current) return;
      revealBeat(next);
      Animated.timing(mainFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    });
  }, [lineAnims, clearTimers, fadeIn, onComplete, revealBeat]);

  // Keep the ref current so revealBeat's auto-advance timers always call
  // the latest version of doAdvance (breaks the circular useCallback dep).
  doAdvanceRef.current = doAdvance;

  // ── Render ────────────────────────────────────────────────────────────────

  const beat     = BEATS[beatIdx];
  const speaker  = SPEAKERS[beat.speaker];
  const progress = (beatIdx + 1) / BEATS.length;

  return (
    <Pressable style={styles.root} onPress={doAdvance} testID="tactical-scene">
      {/* ── BATTLEFIELD BACKGROUND ── */}
      <Animated.View style={[styles.bgWrap, { transform: [{ scale: bgScale }] }]}>
        <ExpoImage
          source={ART.battlefield}
          style={styles.bg}
          contentFit="cover"
        />
      </Animated.View>

      {/* ── RED TRAP OVERLAY ── */}
      <Animated.View
        style={[styles.redOverlay, { opacity: redOverlay }]}
        pointerEvents="none"
      />

      {/* ── BOTTOM GRADIENT PANEL ── */}
      <LinearGradient
        colors={["transparent", "rgba(4,10,18,0.72)", "rgba(4,10,18,0.97)"]}
        locations={[0, 0.35, 0.75]}
        style={styles.panelGradient}
        pointerEvents="none"
      />

      {/* ── charPortrait — right side, bottom flush with dialogue panel ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.charPortrait,
          {
            bottom:  charWrapBot,
            width:   W * 0.68,
            height:  Math.min(
              speaker.artHeight ?? (H - charWrapBot),
              H - charWrapBot
            ),
            opacity: mainFade,
          },
        ]}
      >
        <ExpoImage
          source={speaker.art}
          style={{ width: "100%", height: "100%" }}
          contentFit={speaker.artFit}
        />
        {/* bottom feather */}
        <LinearGradient
          colors={["transparent", "rgba(4,10,18,0.96)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.charBottomFade}
          pointerEvents="none"
        />
      </Animated.View>

      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        {/* ── TOP: progress + scene label ── */}
        <View style={styles.topBar} pointerEvents="none">
          <Text style={styles.sceneLabel}>EMERGENCY TREATMENT PLAZA  ·  NIGHT</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
        </View>

        {/* ── SPACER pushes panel to bottom ── */}
        <View style={{ flex: 1 }} pointerEvents="none" />

        {/* ── DIALOGUE PANEL ── */}
        <Animated.View
          style={[styles.panel, { opacity: mainFade }]}
          pointerEvents="none"
          onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}
        >

          {/* Portrait row */}
          <View style={styles.portraitRow}>
            {SPEAKER_ORDER.map((sid) => {
              const sp      = SPEAKERS[sid];
              const isActive = sid === beat.speaker;
              return (
                <View
                  key={sid}
                  style={[
                    styles.portraitWrap,
                    { borderColor: isActive ? sp.color : "transparent" },
                    !isActive && styles.portraitDim,
                  ]}
                >
                  <ExpoImage
                    source={sp.avatar}
                    style={styles.portraitImg}
                    contentFit="cover"
                  />
                </View>
              );
            })}
          </View>

          {/* Stage direction */}
          {beat.stageDir ? (
            <Animated.Text style={[styles.stageDir, { opacity: stageDirFade }]} numberOfLines={2}>
              {beat.stageDir}
            </Animated.Text>
          ) : null}

          {/* Speaker name */}
          <Animated.Text style={[styles.speakerName, { color: speaker.color, opacity: speakerFade }]}>
            {speaker.label.toUpperCase()}
          </Animated.Text>

          {/* Dialogue lines */}
          <View style={styles.linesWrap}>
            {beat.lines.map((line, i) => (
              <Animated.Text
                key={`${beatIdx}-${i}`}
                style={[styles.dialogueLine, { opacity: lineAnims[i] }]}
              >
                {line}
              </Animated.Text>
            ))}
          </View>

          {/* Tap hint */}
          <Text style={styles.tapHint}>
            {beatIdx === BEATS.length - 1 && lineIdx >= beat.lines.length - 1
              ? "[ tap to continue ]"
              : "[ tap ]"}
          </Text>
        </Animated.View>
      </SafeAreaView>

      {/* ── INTRO OVERLAY ── */}
      <Animated.View style={[styles.introOverlay, { opacity: introFade }]} pointerEvents="none">
        <LinearGradient
          colors={["rgba(4,10,18,0.92)", "rgba(8,20,35,0.97)"]}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.introKicker}>PROLOGUE  ·  PHASE II</Text>
        <Text style={styles.introTitle}>The Battlefield</Text>
        <Text style={styles.introSub}>
          Three legends stand between The Prodigy and the fog.
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#040A12",
  },

  bgWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  bg: {
    width: "100%",
    height: "100%",
  },

  redOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#8B0000",
  },

  panelGradient: {
    position:  "absolute",
    bottom:    0,
    left:      0,
    right:     0,
    height:    "65%",
  },

  /** The large full-height character portrait — right-aligned, bottom flush with the dialogue panel. */
  charPortrait: {
    position:        "absolute",
    right:           0,
    overflow:        "hidden",
    backgroundColor: "transparent",
  },

  // Active speaker portrait — spans from screen top to the dialogue panel top (set via inline bottom)
  charWrap: {
    position:        "absolute",
    top:             0,
    left:            0,
    right:           0,
    alignItems:      "flex-end",
    justifyContent:  "flex-end",
    overflow:        "hidden",
    backgroundColor: "transparent",
  },
  charArt: { width: "68%", height: "100%" },
  charBottomFade: {
    position: "absolute",
    bottom:   0,
    left:     0,
    right:    0,
    height:   "32%",
  },

  safe: {
    flex:           1,
    justifyContent: "space-between",
  },

  // Top bar
  topBar: {
    paddingTop:        16,
    paddingHorizontal: 20,
    gap:               8,
  },
  sceneLabel: {
    color:       "rgba(255,255,255,0.35)",
    fontSize:    10,
    fontWeight:  "700",
    letterSpacing: 2.5,
    textAlign:   "center",
  },
  progressBar: {
    height:          2,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius:    1,
    overflow:        "hidden",
  },
  progressFill: {
    height:          2,
    backgroundColor: "rgba(255,255,255,0.40)",
    borderRadius:    1,
  },

  // Dialogue panel
  panel: {
    paddingHorizontal: 20,
    paddingVertical:   12,
    gap:               10,
  },

  portraitRow: {
    flexDirection:  "row",
    justifyContent: "center",
    gap:            14,
    marginBottom:   4,
  },
  portraitWrap: {
    width:        92,
    height:       92,
    borderRadius: 46,
    borderWidth:  3,
    borderColor:  "transparent",
    overflow:     "hidden",
    shadowOpacity: 0.8,
    shadowRadius:  8,
    shadowOffset:  { width: 0, height: 0 },
    elevation:     4,
  },
  portraitDim: {
    opacity: 0.35,
  },
  portraitImg: {
    width:  92,
    height: 92,
  },

  stageDir: {
    color:       "rgba(180,200,220,0.55)",
    fontSize:    11,
    fontStyle:   "italic",
    textAlign:   "center",
    lineHeight:  16,
    letterSpacing: 0.3,
  },

  speakerName: {
    fontSize:      10,
    fontWeight:    "800",
    letterSpacing: 1.2,
    textAlign:     "left",
    textTransform: "uppercase",
    lineHeight:    14,
  },

  linesWrap: {
    gap: 6,
  },
  dialogueLine: {
    color:         "#EDF2F7",
    fontSize:      17,
    lineHeight:    26,
    textAlign:     "left",
    fontWeight:    "400",
    letterSpacing: 0.3,
  },

  tapHint: {
    color:       "rgba(255,255,255,0.22)",
    fontSize:    10,
    letterSpacing: 1.5,
    textAlign:   "center",
    marginTop:   4,
  },

  // Intro overlay
  introOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     "center",
    justifyContent: "center",
    gap:            14,
    paddingHorizontal: 32,
  },
  introKicker: {
    color:       "rgba(90,200,170,0.75)",
    fontSize:    11,
    fontWeight:  "800",
    letterSpacing: 3.5,
    textAlign:   "center",
  },
  introTitle: {
    color:       "#F4F7FB",
    fontSize:    34,
    fontWeight:  "200",
    letterSpacing: 1,
    textAlign:   "center",
  },
  introSub: {
    color:       "rgba(180,200,220,0.55)",
    fontSize:    13,
    lineHeight:  20,
    textAlign:   "center",
    maxWidth:    300,
  },
});
