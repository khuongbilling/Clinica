/**
 * OpeningMemoryCinematic
 *
 * Phase 1 of the new cinematic prologue — "Awakening / Before the Academy".
 * Plays a fragmented memory montage of The Former Self (The Prodigy): from
 * legendary healer to growing overconfidence, ending on the Silent Infarction
 * encounter setup.
 *
 * Cinematic presentation:
 *  - Custom typography (Cinzel display serif + Cormorant Garamond narration),
 *    loaded via expo-font with graceful system-font fallback.
 *  - Art panels dissolve directly into each other (A/B layer crossfade) while
 *    a real per-beat Ken Burns move (scale + translate, direction/intensity
 *    defined in the beat data) drifts the active panel. No black flash.
 *  - Narration lines rise gently as they fade in; the intro identity card
 *    eases in with scale and a soft gold glow.
 *  - Letterbox bars frame the montage; the bottom bar carries a minimal
 *    beat-progress indicator.
 *  - The black overlay is used only for the very first fade-in and final exit.
 *
 * UX:
 *  - Tap anywhere to reveal the next narration line, or advance to the next
 *    beat once all lines in the current beat are visible.
 *  - Each beat auto-advances if the player doesn't tap.
 *  - A discreet SKIP control fades in after a short delay; it cancels all
 *    timers, fades to black, and calls onComplete() exactly once.
 *  - Calls onComplete() when the final beat finishes.
 *
 * Expo Go constraints honoured: every animation is opacity/transform on the
 * native driver; no reanimated APIs; fonts come from bundled project assets.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  cinematicFontStyles,
  useCinematicFonts,
} from "../../hooks/use-cinematic-fonts";

// ─── Art ─────────────────────────────────────────────────────────────────────

const ART = {
  origin:      require("../../../assets/images/opening_prodigy_origin.png"),
  fame:        require("../../../assets/images/opening_prodigy_fame.png"),
  victory:     require("../../../assets/images/opening_prodigy_victory.png"),
  caution:     require("../../../assets/images/opening_prodigy_caution.png"),
  infallible:  require("../../../assets/images/opening_prodigy_infallible.png"),
  observation: require("../../../assets/images/opening_prodigy_observation.png"),
  judgment:    require("../../../assets/images/opening_prodigy_judgment.png"),
  warning:     require("../../../assets/images/opening_prodigy_warning.png"),
} as const;
type ArtKey = keyof typeof ART;

// ─── Ken Burns config ─────────────────────────────────────────────────────────

/**
 * Per-beat camera move. Scale + translate run together over KEN_BURNS_DUR ms
 * on the active art layer (native-driver transforms only). Directions vary
 * beat to beat so no two panels feel identical.
 */
type KenBurns = {
  scaleFrom: number;
  scaleTo:   number;
  xFrom:     number;
  xTo:       number;
  yFrom:     number;
  yTo:       number;
};

// ─── Beat data ────────────────────────────────────────────────────────────────

type Beat = {
  id:         string;
  sceneLabel: string;
  lines:      string[];
  art:        ArtKey;
  accent:     string;
  tintColor?: string;
  kb:         KenBurns;
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
    art:    "origin",
    accent: "#D4AF37",
    // Gentle push-in, drifting right — a memory surfacing.
    kb: { scaleFrom: 1.02, scaleTo: 1.10, xFrom: -10, xTo: 8, yFrom: 0, yTo: -6 },
  },
  {
    id: "fame",
    sceneLabel: "CLINICA ARCHIVE  ·  INCIDENT REPORTS",
    lines: [
      "Your name was spoken throughout Clinica.",
      "Diseases that overwhelmed entire parties fell before you.",
      "Injuries others feared became little more than inconveniences.",
    ],
    art:    "fame",
    accent: "#4FD8C4",
    // Slow pull-back — taking in the acclaim.
    kb: { scaleFrom: 1.12, scaleTo: 1.03, xFrom: 6, xTo: -6, yFrom: -8, yTo: 6 },
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
    // Confident lateral sweep with a push-in.
    kb: { scaleFrom: 1.04, scaleTo: 1.13, xFrom: 12, xTo: -12, yFrom: 0, yTo: 0 },
  },
  {
    id: "caution",
    sceneLabel: "BEHAVIORAL ASSESSMENT  ·  PATTERN SHIFT",
    lines: [
      "With every victory,",
      "caution began to feel unnecessary.",
    ],
    art:       "caution",
    accent:    "#F7C948",
    tintColor: "rgba(80,50,0,0.25)",
    // Upward drift — a subtle loss of grounding.
    kb: { scaleFrom: 1.03, scaleTo: 1.10, xFrom: 0, xTo: 0, yFrom: 10, yTo: -10 },
  },
  {
    id: "infallible",
    sceneLabel: "PSYCHOLOGICAL PROFILE  ·  WARNING",
    lines: [
      "You began to believe",
      "experience made you infallible.",
    ],
    art:       "infallible",
    accent:    "#C8A0FF",
    tintColor: "rgba(40,0,60,0.30)",
    // Retreating diagonal — the profile pulling away to observe.
    kb: { scaleFrom: 1.13, scaleTo: 1.04, xFrom: -12, xTo: 6, yFrom: 6, yTo: -6 },
  },
  {
    id: "observation",
    sceneLabel: "FIELD REPORT  ·  PATTERN DEVIATION",
    lines: [
      "That strength could replace observation.",
    ],
    art:       "observation",
    accent:    "#F7C948",
    tintColor: "rgba(20,0,0,0.40)",
    // Firm push-in, sinking slightly — pressure building.
    kb: { scaleFrom: 1.05, scaleTo: 1.15, xFrom: 0, xTo: -8, yFrom: -8, yTo: 8 },
  },
  {
    id: "judgment",
    sceneLabel: "INCIDENT LOG  ·  PRE-COLLAPSE",
    lines: [
      "That speed could replace judgment.",
    ],
    art:       "judgment",
    accent:    "#F77B72",
    tintColor: "rgba(60,0,0,0.45)",
    // Faster, tighter push-in — momentum out of control.
    kb: { scaleFrom: 1.06, scaleTo: 1.17, xFrom: 8, xTo: -10, yFrom: 4, yTo: -8 },
  },
  {
    id: "warning",
    sceneLabel: "CLASSIFIED  ·  SILENT INFARCTION EVENT",
    lines: [
      "On the day you encountered the Silent Infarction…",
      "three legends tried to warn you.",
    ],
    art:       "warning",
    accent:    "#8B1A1A",
    tintColor: "rgba(80,0,0,0.50)",
    // Slow ominous creep downward-in — the trap closing.
    kb: { scaleFrom: 1.02, scaleTo: 1.12, xFrom: -6, xTo: 6, yFrom: -10, yTo: 8 },
  },
];

const MAX_LINES          = 4;
const LINE_INTERVAL_MS   = 1000;
const AUTO_ADVANCE_MS    = 2600;
const INTRO_HOLD_MS      = 3400;
const CROSSFADE_DUR      = 750;    // ms — art dissolve overlap
const KEN_BURNS_DUR      = 13000;  // ms — full camera move per panel
const LETTERBOX_H        = 34;     // px — cinematic bar height
const SKIP_DELAY_MS      = 3200;   // ms before the SKIP control fades in
const LINE_RISE_PX       = 14;     // px — narration upward drift distance

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
  const insets = useSafeAreaInsets();

  // ── Typography (graceful fallback while loading) ──
  const [fontsLoaded] = useCinematicFonts();
  const fonts = cinematicFontStyles(fontsLoaded);

  // ── State machine ──
  const [stage, setStage]     = useState<"intro" | "beat">("intro");
  const [beatIdx, setBeatIdx] = useState(0);
  const stageRef    = useRef<"intro" | "beat">("intro");
  const beatIdxRef  = useRef(0);
  const busyRef     = useRef(false);
  const mountedRef  = useRef(true);
  const finishedRef = useRef(false); // guarantees onComplete fires exactly once

  // ── Art layers (A / B alternating dissolve) ──
  const [artA, setArtA] = useState<ArtKey>("origin");
  const [artB, setArtB] = useState<ArtKey>("origin");
  const layerAOpacity  = useRef(new Animated.Value(1)).current; // A is first on-screen
  const layerBOpacity  = useRef(new Animated.Value(0)).current;
  const activeLayerRef = useRef<"A" | "B">("A");

  // ── Ken Burns per layer: progress value + current move config ──
  const kbProgA = useRef(new Animated.Value(0)).current;
  const kbProgB = useRef(new Animated.Value(0)).current;
  const [kbCfgA, setKbCfgA] = useState<KenBurns>(BEATS[0].kb);
  const [kbCfgB, setKbCfgB] = useState<KenBurns>(BEATS[0].kb);

  // ── Black overlay — used ONLY for very first fade-in and final exit ──
  const fadeOverlay = useRef(new Animated.Value(1)).current; // starts black

  // ── Intro card + narration text ──
  const introCardFade = useRef(new Animated.Value(0)).current;
  const textFade      = useRef(new Animated.Value(1)).current;
  const lineAnims     = useRef(
    Array.from({ length: MAX_LINES }, () => new Animated.Value(0))
  ).current;

  // ── Tint overlay ──
  const tintFade = useRef(new Animated.Value(0)).current;

  // ── Letterbox bars + skip control ──
  const letterboxAnim = useRef(new Animated.Value(0)).current; // 0 = off-screen
  const skipFade      = useRef(new Animated.Value(0)).current;
  const [skipVisible, setSkipVisible] = useState(false);

  // ── Particles ──
  const petalAnims = useRef(
    PETAL_DATA.map((_, i) => new Animated.Value(i / PETAL_DATA.length))
  ).current;

  // Timer bookkeeping
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  // ── Helpers ──

  const fadeIn = useCallback((val: Animated.Value, dur = 700) => {
    Animated.timing(val, {
      toValue:         1,
      duration:        dur,
      easing:          Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  /** (Re)start the slow camera move on one art layer. */
  const startKenBurns = useCallback(
    (layer: "A" | "B") => {
      const prog = layer === "A" ? kbProgA : kbProgB;
      prog.stopAnimation();
      prog.setValue(0);
      Animated.timing(prog, {
        toValue:         1,
        duration:        KEN_BURNS_DUR,
        easing:          Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start();
    },
    [kbProgA, kbProgB]
  );

  // ── A/B dissolve — old panel fades out, new panel fades in simultaneously,
  //    while the incoming panel starts its own Ken Burns move ──
  const doCrossFade = useCallback(
    (newArt: ArtKey, kb: KenBurns, onDone: () => void) => {
      busyRef.current = true;
      if (activeLayerRef.current === "A") {
        setArtB(newArt);
        setKbCfgB(kb);
        layerBOpacity.setValue(0);
        startKenBurns("B");
        Animated.parallel([
          Animated.timing(layerAOpacity, { toValue: 0, duration: CROSSFADE_DUR, useNativeDriver: true }),
          Animated.timing(layerBOpacity, { toValue: 1, duration: CROSSFADE_DUR, useNativeDriver: true }),
        ]).start(() => {
          if (!mountedRef.current) return;
          activeLayerRef.current = "B";
          onDone();
          busyRef.current = false;
        });
      } else {
        setArtA(newArt);
        setKbCfgA(kb);
        layerAOpacity.setValue(0);
        startKenBurns("A");
        Animated.parallel([
          Animated.timing(layerBOpacity, { toValue: 0, duration: CROSSFADE_DUR, useNativeDriver: true }),
          Animated.timing(layerAOpacity, { toValue: 1, duration: CROSSFADE_DUR, useNativeDriver: true }),
        ]).start(() => {
          if (!mountedRef.current) return;
          activeLayerRef.current = "A";
          onDone();
          busyRef.current = false;
        });
      }
    },
    [layerAOpacity, layerBOpacity, startKenBurns]
  );

  // ── Text-only soft fade (same art, just text changes) ──
  const softTextFade = useCallback((callback: () => void) => {
    busyRef.current = true;
    Animated.timing(textFade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      if (!mountedRef.current) return;
      callback();
      busyRef.current = false;
      Animated.timing(textFade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    });
  }, [textFade]);

  // ── Update tint when beat changes ──
  const updateTint = useCallback((beat: Beat) => {
    if (beat.tintColor) {
      tintFade.setValue(0);
      Animated.timing(tintFade, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    } else {
      Animated.timing(tintFade, { toValue: 0, duration: 400, useNativeDriver: true }).start();
    }
  }, [tintFade]);

  // ── Particle system ──
  useEffect(() => {
    const stops: Animated.CompositeAnimation[] = [];
    petalAnims.forEach((anim, i) => {
      const loop = Animated.loop(
        Animated.timing(anim, { toValue: 1, duration: PETAL_DATA[i].speed, useNativeDriver: true })
      );
      loop.start();
      stops.push(loop);
    });
    return () => stops.forEach(s => s.stop());
  }, [petalAnims]);

  // ── Line reveal ──
  const revealLines = useCallback((beat: Beat) => {
    clearTimers();
    lineAnims.forEach(a => a.setValue(0));
    textFade.setValue(1);

    fadeIn(lineAnims[0], 600);
    for (let i = 1; i < beat.lines.length; i++) {
      const t = setTimeout(() => {
        if (mountedRef.current) fadeIn(lineAnims[i], 600);
      }, i * LINE_INTERVAL_MS);
      timers.current.push(t);
    }

    const autoDelay = (beat.lines.length - 1) * LINE_INTERVAL_MS + AUTO_ADVANCE_MS;
    const autoT = setTimeout(() => {
      if (mountedRef.current) doAdvanceBeat();
    }, autoDelay);
    timers.current.push(autoT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers, lineAnims, fadeIn]);

  // ── Final exit — fade to black then complete, exactly once ──
  const finishCinematic = useCallback((fadeDur = 900) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    busyRef.current     = true;
    clearTimers();
    Animated.timing(fadeOverlay, {
      toValue:         1,
      duration:        fadeDur,
      easing:          Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      if (mountedRef.current) onComplete();
    });
  }, [clearTimers, fadeOverlay, onComplete]);

  // ── Advance to next beat or finish ──
  const doAdvanceBeat = useCallback(() => {
    if (!mountedRef.current || busyRef.current || finishedRef.current) return;
    const current = beatIdxRef.current;
    const next    = current + 1;

    if (next >= BEATS.length) {
      finishCinematic();
      return;
    }

    clearTimers();

    const artChanged = BEATS[current].art !== BEATS[next].art;

    const applyBeat = () => {
      if (!mountedRef.current) return;
      beatIdxRef.current = next;
      setBeatIdx(next);
      updateTint(BEATS[next]);
      revealLines(BEATS[next]);
    };

    if (artChanged) {
      // Fade text out first, then dissolve the art layers
      Animated.timing(textFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        if (!mountedRef.current) return;
        doCrossFade(BEATS[next].art, BEATS[next].kb, applyBeat);
      });
    } else {
      softTextFade(applyBeat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doCrossFade, softTextFade, finishCinematic, revealLines, updateTint, clearTimers]);

  // ── Boot sequence ──
  useEffect(() => {
    mountedRef.current = true;

    // Prime layer A with the first beat's art and start its camera move
    setArtA(BEATS[0].art);
    setKbCfgA(BEATS[0].kb);
    layerAOpacity.setValue(1);
    layerBOpacity.setValue(0);
    activeLayerRef.current = "A";
    startKenBurns("A");

    // Fade the black overlay away to reveal the scene (no black-flash start)
    Animated.timing(fadeOverlay, { toValue: 0, duration: 900, useNativeDriver: true }).start();

    // Letterbox bars slide in as the scene reveals
    Animated.timing(letterboxAnim, {
      toValue:         1,
      duration:        1100,
      easing:          Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Fade intro card in shortly after
    const cardIn = setTimeout(() => {
      if (mountedRef.current) fadeIn(introCardFade, 800);
    }, 300);
    timers.current.push(cardIn);

    // After the intro hold, dissolve the card and begin beat 0
    const hold = setTimeout(() => {
      if (!mountedRef.current) return;
      Animated.timing(introCardFade, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        if (!mountedRef.current) return;
        stageRef.current = "beat";
        setStage("beat");
        beatIdxRef.current = 0;
        setBeatIdx(0);
        revealLines(BEATS[0]);
      });
    }, INTRO_HOLD_MS);
    timers.current.push(hold);

    return () => {
      mountedRef.current = false;
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Skip control reveal (own timer — survives beat-change clearTimers) ──
  useEffect(() => {
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      setSkipVisible(true);
      Animated.timing(skipFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, SKIP_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSkip = useCallback(() => {
    finishCinematic(650);
  }, [finishCinematic]);

  // ── Tap handler ──
  const handleTap = useCallback(() => {
    if (busyRef.current || finishedRef.current) return;

    if (stageRef.current === "intro") {
      clearTimers();
      // Skip intro immediately
      Animated.timing(introCardFade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        if (!mountedRef.current) return;
        stageRef.current   = "beat";
        beatIdxRef.current = 0;
        setStage("beat");
        setBeatIdx(0);
        revealLines(BEATS[0]);
      });
      return;
    }

    const beat = BEATS[beatIdxRef.current];
    const allVisible = lineAnims
      .slice(0, beat.lines.length)
      .every(a => (a as any)._value >= 0.99);

    if (!allVisible) {
      clearTimers();
      lineAnims.forEach((a, i) => {
        if (i < beat.lines.length) fadeIn(a, 250);
      });
      const t = setTimeout(() => {
        if (mountedRef.current) doAdvanceBeat();
      }, AUTO_ADVANCE_MS);
      timers.current.push(t);
    } else {
      clearTimers();
      doAdvanceBeat();
    }
  }, [clearTimers, doAdvanceBeat, fadeIn, introCardFade, lineAnims, revealLines]);

  // ── Derived ──
  const beat    = BEATS[Math.min(beatIdx, BEATS.length - 1)];
  const hasTint = stage === "beat" && !!beat.tintColor;

  // Ken Burns transforms (interpolations rebuilt whenever a layer's cfg changes)
  const kbStyleA = {
    transform: [
      { scale:      kbProgA.interpolate({ inputRange: [0, 1], outputRange: [kbCfgA.scaleFrom, kbCfgA.scaleTo] }) },
      { translateX: kbProgA.interpolate({ inputRange: [0, 1], outputRange: [kbCfgA.xFrom, kbCfgA.xTo] }) },
      { translateY: kbProgA.interpolate({ inputRange: [0, 1], outputRange: [kbCfgA.yFrom, kbCfgA.yTo] }) },
    ],
  };
  const kbStyleB = {
    transform: [
      { scale:      kbProgB.interpolate({ inputRange: [0, 1], outputRange: [kbCfgB.scaleFrom, kbCfgB.scaleTo] }) },
      { translateX: kbProgB.interpolate({ inputRange: [0, 1], outputRange: [kbCfgB.xFrom, kbCfgB.xTo] }) },
      { translateY: kbProgB.interpolate({ inputRange: [0, 1], outputRange: [kbCfgB.yFrom, kbCfgB.yTo] }) },
    ],
  };

  // Letterbox slide-in transforms
  const lbTopStyle = {
    transform: [{ translateY: letterboxAnim.interpolate({ inputRange: [0, 1], outputRange: [-LETTERBOX_H, 0] }) }],
  };
  const lbBottomStyle = {
    transform: [{ translateY: letterboxAnim.interpolate({ inputRange: [0, 1], outputRange: [LETTERBOX_H, 0] }) }],
  };

  // Intro card ease-in scale
  const introCardScale = introCardFade.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>

      {/* ── Art layer A ──────────────────────────────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: layerAOpacity }]}>
        <Animated.View style={[StyleSheet.absoluteFill, kbStyleA]}>
          {/* Blurred fill — same image at cover, blurred, fills any letterbox bars */}
          <View style={[StyleSheet.absoluteFill, { opacity: 0.38, overflow: "hidden" }]}>
            <ExpoImage
              source={ART[artA]}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition="center"
              blurRadius={22}
            />
          </View>
          {/* Sharp image — full art, no cropping */}
          <ExpoImage
            source={ART[artA]}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            contentPosition="center"
          />
        </Animated.View>
      </Animated.View>

      {/* ── Art layer B (cross-dissolve target) ─────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: layerBOpacity }]}>
        <Animated.View style={[StyleSheet.absoluteFill, kbStyleB]}>
          {/* Blurred fill */}
          <View style={[StyleSheet.absoluteFill, { opacity: 0.38, overflow: "hidden" }]}>
            <ExpoImage
              source={ART[artB]}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition="center"
              blurRadius={22}
            />
          </View>
          {/* Sharp image — full art, no cropping */}
          <ExpoImage
            source={ART[artB]}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            contentPosition="center"
          />
        </Animated.View>
      </Animated.View>

      {/* ── Per-beat tint overlay ────────────────────────────────────── */}
      {hasTint && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: beat.tintColor, opacity: tintFade }]}
        />
      )}

      {/* ── Top vignette ─────────────────────────────────────────────── */}
      <LinearGradient
        colors={["rgba(3,5,10,0.85)", "transparent"]}
        locations={[0, 0.32]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── Bottom vignette ──────────────────────────────────────────── */}
      <LinearGradient
        colors={["transparent", "rgba(3,5,10,0.80)", "rgba(3,5,10,0.97)"]}
        locations={[0.42, 0.68, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

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
                transform: [{ translateY }, { rotate: `${p.rot}deg` }],
                opacity,
              },
            ]}
          />
        );
      })}

      {/* ── Cinematic letterbox bars ─────────────────────────────────── */}
      <Animated.View pointerEvents="none" style={[styles.letterboxTop, lbTopStyle]} />
      <Animated.View pointerEvents="none" style={[styles.letterboxBottom, lbBottomStyle]}>
        {/* Beat-progress indicator */}
        <View style={styles.progressRow}>
          {BEATS.map((b, i) => {
            const isActive = stage === "beat" && i === beatIdx;
            const isDone   = stage === "beat" && i < beatIdx;
            return (
              <View
                key={b.id}
                style={[
                  styles.progressSeg,
                  isActive && { backgroundColor: beat.accent, width: 18, opacity: 0.95 },
                  isDone   && { backgroundColor: "rgba(212,175,55,0.55)" },
                ]}
              />
            );
          })}
        </View>
      </Animated.View>

      {/* ── UI content ───────────────────────────────────────────────── */}
      <SafeAreaView style={styles.safe} pointerEvents="box-none">

        {/* Scene label (beat mode) */}
        <View style={styles.topArea}>
          {stage === "beat" && (
            <Animated.View style={{ opacity: textFade }}>
              <Text style={[styles.sceneLabel, fonts.display, { color: beat.accent }]}>
                {beat.sceneLabel}
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Intro identity card — eases in with scale + soft gold glow */}
        {stage === "intro" && (
          <Animated.View
            style={[
              styles.introCard,
              { opacity: introCardFade, transform: [{ scale: introCardScale }] },
            ]}
          >
            <View style={styles.introGlow} pointerEvents="none" />
            <Text style={[styles.classifiedTag, fonts.display]}>— CLASSIFIED —</Text>
            <View style={styles.divider} />
            <Text style={[styles.introTitle, fonts.display]}>THE FORMER SELF</Text>
            <Text style={[styles.introSubtitle, fonts.narrationItalic]}>The Prodigy</Text>
            <View style={styles.divider} />
            <Text style={[styles.classifiedTag, fonts.display]}>CLINICA · WARD ARCHIVES</Text>
          </Animated.View>
        )}

        {/* Narration + identity strip + tap hint */}
        <View style={styles.bottomArea}>
          {stage === "beat" && (
            <Animated.View style={[styles.narration, { opacity: textFade }]}>
              {beat.lines.map((line, i) => (
                <Animated.Text
                  key={`${beat.id}-${i}`}
                  style={[
                    styles.line,
                    fonts.narration,
                    i === 0 && styles.lineFirst,
                    {
                      opacity: lineAnims[i],
                      transform: [{
                        translateY: lineAnims[i].interpolate({
                          inputRange:  [0, 1],
                          outputRange: [LINE_RISE_PX, 0],
                        }),
                      }],
                    },
                  ]}
                >
                  {line}
                </Animated.Text>
              ))}
            </Animated.View>
          )}

          <View style={styles.identityStrip} pointerEvents="none">
            <View
              style={[
                styles.identityDot,
                { backgroundColor: stage === "beat" ? beat.accent : "#D4AF37" },
              ]}
            />
            <Text style={[styles.identityName, fonts.display]}>THE FORMER SELF</Text>
            <Text style={styles.identitySep}>·</Text>
            <Text style={[styles.identityTitle, fonts.narrationItalic]}>The Prodigy</Text>
          </View>

          <Text style={styles.tapHint}>Tap anywhere to continue</Text>
        </View>
      </SafeAreaView>

      {/* Full-screen tap target (below skip button, above art) */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />

      {/* ── Discreet SKIP control (above the tap target) ─────────────── */}
      {skipVisible && (
        <Animated.View
          style={[
            styles.skipWrap,
            { top: Math.max(insets.top, LETTERBOX_H) + 10, opacity: skipFade },
          ]}
        >
          <Pressable
            onPress={handleSkip}
            hitSlop={12}
            style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.skipText, fonts.display]}>SKIP ▸</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* ── Black overlay — only for initial reveal and final exit.
             Rendered last so the exit fade covers every layer. ───────── */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "#03050A", opacity: fadeOverlay }]}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#03050A" },
  safe: { flex: 1, justifyContent: "space-between" },

  petal: { position: "absolute" },

  // ── Letterbox framing ──
  letterboxTop: {
    position:        "absolute",
    top:             0,
    left:            0,
    right:           0,
    height:          LETTERBOX_H,
    backgroundColor: "#000000",
  },
  letterboxBottom: {
    position:        "absolute",
    bottom:          0,
    left:            0,
    right:           0,
    height:          LETTERBOX_H,
    backgroundColor: "#000000",
    alignItems:      "center",
    justifyContent:  "center",
  },
  progressRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
  },
  progressSeg: {
    width:           12,
    height:          2,
    borderRadius:    1,
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  topArea: {
    paddingTop:        LETTERBOX_H + 14,
    paddingHorizontal: 20,
    minHeight:         LETTERBOX_H + 30,
  },
  bottomArea: {
    paddingBottom: LETTERBOX_H + 2,
  },

  introCard: {
    position:          "absolute",
    alignSelf:         "center",
    top:               "35%",
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: 32,
  },
  introGlow: {
    position:        "absolute",
    top:             -48,
    bottom:          -48,
    left:            -40,
    right:           -40,
    borderRadius:    160,
    backgroundColor: "rgba(212,175,55,0.07)",
    shadowColor:     "#D4AF37",
    shadowOpacity:   0.55,
    shadowRadius:    60,
    shadowOffset:    { width: 0, height: 0 },
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
    fontSize:      26,
    fontWeight:    "300",
    letterSpacing: 5,
    textAlign:     "center",
  },
  introSubtitle: {
    color:         "rgba(212,175,55,0.9)",
    fontSize:      19,
    fontStyle:     "italic",
    letterSpacing: 1,
  },

  sceneLabel: {
    fontSize:      10,
    letterSpacing: 3,
    fontWeight:    "700",
    opacity:       0.85,
  },

  narration: {
    paddingHorizontal: 22,
    paddingBottom:     12,
    gap:               10,
  },
  line: {
    color:      "#E8EEF5",
    fontSize:   24,
    fontWeight: "300",
    lineHeight: 33,
  },
  lineFirst: {
    fontSize:   27,
    lineHeight: 36,
  },

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
    fontSize:      13,
    fontStyle:     "italic",
    letterSpacing: 0.5,
  },

  tapHint: {
    color:         "rgba(255,255,255,0.18)",
    fontSize:      11,
    letterSpacing: 1.5,
    textAlign:     "center",
    paddingBottom: 10,
  },

  // ── Skip control ──
  skipWrap: {
    position: "absolute",
    right:    16,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      999,
    borderWidth:       1,
    borderColor:       "rgba(255,255,255,0.18)",
    backgroundColor:   "rgba(3,5,10,0.45)",
  },
  skipText: {
    color:         "rgba(255,255,255,0.62)",
    fontSize:      10,
    letterSpacing: 2.5,
    fontWeight:    "700",
  },
});
