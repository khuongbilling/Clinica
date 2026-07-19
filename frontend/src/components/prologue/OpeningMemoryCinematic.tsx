/**
 * OpeningMemoryCinematic
 *
 * Phase 1 of the new cinematic prologue — "Awakening / Before the Academy".
 * Plays a fragmented memory montage of The Former Self (The Prodigy): from
 * legendary healer to growing overconfidence, ending on the Silent Infarction
 * encounter setup.
 *
 * UX:
 *  - Tap anywhere to reveal the next narration line, or advance to the next beat
 *    once all lines in the current beat are visible.
 *  - Each beat auto-advances if the player doesn't tap.
 *  - Calls onComplete() when the final beat finishes → advances the prologue phase.
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
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

// ─── Art ─────────────────────────────────────────────────────────────────────

const ART = {
  portrait: require("../../../assets/images/former_self_portrait.png"),
  healing:  require("../../../assets/images/former_self_scene_healing.png"),
  victory:  require("../../../assets/images/former_self_scene_victory.png"),
} as const;
type ArtKey = keyof typeof ART;

// ─── Beat data ────────────────────────────────────────────────────────────────

type Beat = {
  id:         string;
  sceneLabel: string;
  lines:      string[];
  art:        ArtKey;
  accent:     string;
  tintColor?: string;   // optional colour overlay on the art
};

const BEATS: Beat[] = [
  {
    id: "origin",
    sceneLabel: "CLASSIFIED RECORD  ·  PRE-ACADEMY",
    lines: [
      "Before the Academy…",
      "Before the System began teaching you",
      "what you had forgotten…",
      "you were already considered a hero.",
    ],
    art:    "portrait",
    accent: "#D4AF37",
  },
  {
    id: "fame",
    sceneLabel: "CLINICA ARCHIVE  ·  INCIDENT REPORTS",
    lines: [
      "Your name was spoken throughout Clinica.",
      "Diseases that overwhelmed entire parties fell before you.",
      "Injuries others feared became little more than inconveniences.",
    ],
    art:    "healing",
    accent: "#4FD8C4",
  },
  {
    id: "victory",
    sceneLabel: "TACTICAL LOG  ·  CONFIRMED VICTORIES",
    lines: [
      "Victory came quickly.",
      "Then repeatedly.",
    ],
    art:    "victory",
    accent: "#7EB8F7",
  },
  {
    id: "caution",
    sceneLabel: "BEHAVIORAL ASSESSMENT  ·  PATTERN SHIFT",
    lines: [
      "With every victory,",
      "caution began to feel unnecessary.",
    ],
    art:       "victory",
    accent:    "#F7C948",
    tintColor: "rgba(80,50,0,0.25)",
  },
  {
    id: "infallible",
    sceneLabel: "PSYCHOLOGICAL PROFILE  ·  WARNING",
    lines: [
      "You began to believe",
      "experience made you infallible.",
    ],
    art:       "portrait",
    accent:    "#C8A0FF",
    tintColor: "rgba(40,0,60,0.30)",
  },
  {
    id: "observation",
    sceneLabel: "FIELD REPORT  ·  PATTERN DEVIATION",
    lines: [
      "That strength could replace observation.",
    ],
    art:       "healing",
    accent:    "#F7C948",
    tintColor: "rgba(20,0,0,0.40)",
  },
  {
    id: "judgment",
    sceneLabel: "INCIDENT LOG  ·  PRE-COLLAPSE",
    lines: [
      "That speed could replace judgment.",
    ],
    art:       "victory",
    accent:    "#F77B72",
    tintColor: "rgba(60,0,0,0.45)",
  },
  {
    id: "warning",
    sceneLabel: "CLASSIFIED  ·  SILENT INFARCTION EVENT",
    lines: [
      "On the day you encountered the Silent Infarction…",
      "three legends tried to warn you.",
    ],
    art:       "portrait",
    accent:    "#8B1A1A",
    tintColor: "rgba(80,0,0,0.50)",
  },
];

const MAX_LINES = 4;
const LINE_INTERVAL_MS = 1000;
const AUTO_ADVANCE_AFTER_MS = 2600;
const INTRO_HOLD_MS = 3400;

// ─── Particles ────────────────────────────────────────────────────────────────

const PETAL_DATA = [
  { x: 0.08, w: 8,  h: 5,  rot: 45, color: "#FFD70099", speed: 9200 },
  { x: 0.23, w: 5,  h: 3,  rot: 20, color: "#FF69B466", speed: 11400 },
  { x: 0.39, w: 10, h: 6,  rot: 68, color: "#D4AF3799", speed: 8600 },
  { x: 0.55, w: 7,  h: 4,  rot: 35, color: "#FF69B466", speed: 12200 },
  { x: 0.68, w: 6,  h: 4,  rot: 58, color: "#FFD70099", speed: 9800 },
  { x: 0.82, w: 9,  h: 5,  rot: 15, color: "#FFFFFF55", speed: 10600 },
  { x: 0.16, w: 6,  h: 3,  rot: 80, color: "#FF69B466", speed: 8100 },
  { x: 0.91, w: 5,  h: 3,  rot: 50, color: "#D4AF3799", speed: 11800 },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function OpeningMemoryCinematic({ onComplete }: Props) {
  const { width: SW, height: SH } = Dimensions.get("window");

  // ── State machine: 'intro' → 'beat' ──
  const [stage, setStage]     = useState<"intro" | "beat">("intro");
  const [beatIdx, setBeatIdx] = useState(0);

  // Track via ref so timers see current values without stale closures.
  const stageRef    = useRef<"intro" | "beat">("intro");
  const beatIdxRef  = useRef(0);
  const busyRef     = useRef(false);       // prevents tap races
  const mountedRef  = useRef(true);

  // ── Animation values ──
  const mainFade  = useRef(new Animated.Value(0)).current;
  const lineAnims = useRef(
    Array.from({ length: MAX_LINES }, () => new Animated.Value(0))
  ).current;
  const petalAnims = useRef(
    PETAL_DATA.map((_, i) => new Animated.Value(i / PETAL_DATA.length))
  ).current;

  // ── Timer bookkeeping ──
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  // ── Fade helpers ──
  const fadeIn = useCallback((val: Animated.Value, dur = 700) => {
    Animated.timing(val, { toValue: 1, duration: dur, useNativeDriver: false }).start();
  }, []);

  const crossFade = useCallback((callback: () => void, outDur = 300) => {
    busyRef.current = true;
    Animated.timing(mainFade, { toValue: 0, duration: outDur, useNativeDriver: false }).start(() => {
      if (!mountedRef.current) return;
      callback();
      busyRef.current = false;
      fadeIn(mainFade, 600);
    });
  }, [mainFade, fadeIn]);

  // ── Particle system ──
  useEffect(() => {
    const stops: Animated.CompositeAnimation[] = [];
    petalAnims.forEach((anim, i) => {
      const loop = Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration: PETAL_DATA[i].speed,
          useNativeDriver: false,
        })
      );
      loop.start();
      stops.push(loop);
    });
    return () => stops.forEach(s => s.stop());
  }, [petalAnims]);

  // ── Line reveal for a given beat ──
  const revealLines = useCallback((beat: Beat) => {
    clearTimers();
    lineAnims.forEach(a => a.setValue(0));

    // Line 0 appears immediately.
    fadeIn(lineAnims[0], 500);

    // Subsequent lines are scheduled.
    for (let i = 1; i < beat.lines.length; i++) {
      const t = setTimeout(() => {
        if (mountedRef.current) fadeIn(lineAnims[i], 500);
      }, i * LINE_INTERVAL_MS);
      timers.current.push(t);
    }

    // Auto-advance after all lines + hold.
    const autoDelay = (beat.lines.length - 1) * LINE_INTERVAL_MS + AUTO_ADVANCE_AFTER_MS;
    const autoT = setTimeout(() => {
      if (mountedRef.current) doAdvanceBeat();
    }, autoDelay);
    timers.current.push(autoT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers, lineAnims, fadeIn]);

  // ── Advance to next beat (or complete) ──
  const doAdvanceBeat = useCallback(() => {
    if (!mountedRef.current || busyRef.current) return;
    const current = beatIdxRef.current;
    const next    = current + 1;

    if (next >= BEATS.length) {
      crossFade(() => {
        if (mountedRef.current) onComplete();
      }, 800);
    } else {
      crossFade(() => {
        if (!mountedRef.current) return;
        beatIdxRef.current = next;
        setBeatIdx(next);
        revealLines(BEATS[next]);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crossFade, onComplete, revealLines]);

  // ── Kick off intro ──
  useEffect(() => {
    mountedRef.current = true;
    fadeIn(mainFade, 900);

    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      crossFade(() => {
        stageRef.current = "beat";
        setStage("beat");
        beatIdxRef.current = 0;
        setBeatIdx(0);
        revealLines(BEATS[0]);
      }, 600);
    }, INTRO_HOLD_MS);
    timers.current.push(t);

    return () => {
      mountedRef.current = false;
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tap handler ──
  const handleTap = useCallback(() => {
    if (busyRef.current) return;

    if (stageRef.current === "intro") {
      clearTimers();
      crossFade(() => {
        stageRef.current   = "beat";
        beatIdxRef.current = 0;
        setStage("beat");
        setBeatIdx(0);
        revealLines(BEATS[0]);
      });
      return;
    }

    // In beat mode: check how many lines are visible.
    const beat = BEATS[beatIdxRef.current];
    const allVisible = lineAnims.slice(0, beat.lines.length).every(a => {
      // Check if animation has reached 1.
      // Animated.Value doesn't expose __value in types but we can peek.
      return (a as any)._value >= 0.99;
    });

    if (!allVisible) {
      // Immediately reveal all remaining lines.
      clearTimers();
      lineAnims.forEach((a, i) => {
        if (i < beat.lines.length) fadeIn(a, 250);
      });
      // Schedule auto-advance.
      const t = setTimeout(() => {
        if (mountedRef.current) doAdvanceBeat();
      }, AUTO_ADVANCE_AFTER_MS);
      timers.current.push(t);
    } else {
      clearTimers();
      doAdvanceBeat();
    }
  }, [clearTimers, crossFade, doAdvanceBeat, fadeIn, lineAnims, revealLines]);

  // ── Derived ──
  const beat   = BEATS[Math.min(beatIdx, BEATS.length - 1)];
  const artSrc = ART[beat.art];

  return (
    <View style={styles.root}>

      {/* ── Background art (changes per beat) ──────────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: mainFade }]}>
        <ExpoImage
          source={stage === "intro" ? ART.portrait : artSrc}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="center"
          transition={300}
        />

        {/* Colour tint overlay per beat */}
        {stage === "beat" && beat.tintColor && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: beat.tintColor }]} />
        )}

        {/* Top vignette */}
        <LinearGradient
          colors={["rgba(3,5,10,0.85)", "transparent"]}
          locations={[0, 0.32]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Bottom vignette */}
        <LinearGradient
          colors={["transparent", "rgba(3,5,10,0.80)", "rgba(3,5,10,0.97)"]}
          locations={[0.42, 0.68, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </Animated.View>

      {/* ── Floating petal particles ─────────────────────────────────── */}
      {PETAL_DATA.map((p, i) => {
        const translateY = petalAnims[i].interpolate({
          inputRange:  [0, 1],
          outputRange: [SH + 40, -200],
        });
        const opacity = petalAnims[i].interpolate({
          inputRange:  [0, 0.08, 0.75, 0.92, 1],
          outputRange: [0,  0.8,  0.8,   0,   0],
        });
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.petal,
              {
                left:            p.x * SW,
                width:           p.w,
                height:          p.h,
                borderRadius:    p.h / 2,
                backgroundColor: p.color,
                transform: [
                  { translateY },
                  { rotate: `${p.rot}deg` },
                ],
                opacity,
              },
            ]}
          />
        );
      })}

      {/* ── Content layer ────────────────────────────────────────────── */}
      <SafeAreaView style={styles.safe} pointerEvents="box-none">

        {/* Top anchor: scene label in beat mode, invisible spacer in intro */}
        <View style={styles.topArea}>
          {stage === "beat" && (
            <Animated.View style={{ opacity: mainFade }}>
              <Text style={[styles.sceneLabel, { color: beat.accent }]}>
                {beat.sceneLabel}
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Intro identity card — absolutely centered, fades in with mainFade */}
        {stage === "intro" && (
          <Animated.View style={[styles.introCard, { opacity: mainFade }]}>
            <Text style={styles.classifiedTag}>— CLASSIFIED —</Text>
            <View style={styles.divider} />
            <Text style={styles.introTitle}>THE FORMER SELF</Text>
            <Text style={styles.introSubtitle}>The Prodigy</Text>
            <View style={styles.divider} />
            <Text style={styles.classifiedTag}>CLINICA · WARD ARCHIVES</Text>
          </Animated.View>
        )}

        {/* Bottom anchor: narration lines + identity strip + tap hint */}
        <View style={styles.bottomArea}>
          {stage === "beat" && (
            <Animated.View style={[styles.narration, { opacity: mainFade }]}>
              {beat.lines.map((line, i) => (
                <Animated.Text
                  key={`${beat.id}-${i}`}
                  style={[
                    styles.line,
                    i === 0 && styles.lineFirst,
                    { opacity: lineAnims[i] },
                  ]}
                >
                  {line}
                </Animated.Text>
              ))}
            </Animated.View>
          )}

          {/* Identity strip */}
          <View style={styles.identityStrip} pointerEvents="none">
            <View style={[styles.identityDot, { backgroundColor: stage === "beat" ? beat.accent : "#D4AF37" }]} />
            <Text style={styles.identityName}>THE FORMER SELF</Text>
            <Text style={styles.identitySep}>·</Text>
            <Text style={styles.identityTitle}>The Prodigy</Text>
          </View>

          {/* Tap hint */}
          <Text style={styles.tapHint}>Tap anywhere to continue</Text>
        </View>
      </SafeAreaView>

      {/* ── Full-screen tap target ───────────────────────────────────── */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#03050A" },
  safe: { flex: 1, justifyContent: "space-between" },

  // particles
  petal: { position: "absolute" },

  // layout anchors
  topArea: {
    paddingTop:        16,
    paddingHorizontal: 20,
    minHeight:         32,
  },
  bottomArea: {
    paddingBottom: 4,
  },

  // intro identity card (absolutely centered)
  introCard: {
    position:          "absolute",
    alignSelf:         "center",
    top:               "35%",
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: 32,
  },
  classifiedTag: {
    color:         "rgba(212,175,55,0.7)",
    fontSize:      10,
    letterSpacing: 4,
    fontWeight:    "700",
  },
  divider: {
    width:           140,
    height:          1,
    backgroundColor: "rgba(212,175,55,0.35)",
    marginVertical:  2,
  },
  introTitle: {
    color:         "#F4F7FB",
    fontSize:      30,
    fontWeight:    "300",
    letterSpacing: 8,
    textAlign:     "center",
  },
  introSubtitle: {
    color:         "rgba(212,175,55,0.9)",
    fontSize:      16,
    fontStyle:     "italic",
    letterSpacing: 1,
  },

  // beat scene label
  sceneLabel: {
    fontSize:      10,
    letterSpacing: 3,
    fontWeight:    "700",
    opacity:       0.85,
  },

  // beat narration lines
  narration: {
    paddingHorizontal: 22,
    paddingBottom:     12,
    gap:               10,
  },
  line: {
    color:      "#E8EEF5",
    fontSize:   22,
    fontWeight: "300",
    lineHeight: 32,
  },
  lineFirst: {
    fontSize:   24,
    fontWeight: "400",
  },

  // identity strip
  identityStrip: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 22,
    paddingVertical:   8,
    gap:               8,
  },
  identityDot: {
    width:        5,
    height:       5,
    borderRadius: 3,
  },
  identityName: {
    color:         "rgba(255,255,255,0.55)",
    fontSize:      11,
    letterSpacing: 2.5,
    fontWeight:    "700",
  },
  identitySep: {
    color:    "rgba(255,255,255,0.25)",
    fontSize: 11,
  },
  identityTitle: {
    color:         "rgba(212,175,55,0.7)",
    fontSize:      11,
    fontStyle:     "italic",
    letterSpacing: 0.5,
  },

  // tap hint
  tapHint: {
    color:         "rgba(255,255,255,0.18)",
    fontSize:      11,
    letterSpacing: 1.5,
    textAlign:     "center",
    paddingBottom: 10,
  },
});
