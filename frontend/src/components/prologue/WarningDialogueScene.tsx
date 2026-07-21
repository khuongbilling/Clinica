/**
 * WarningDialogueScene — Push 11b
 *
 * Phase: warning_dialogue_scene
 *
 * Visual Novel–style dialogue scene that plays AFTER the overconfidence
 * cutscene. Master Bai, Florence Nightingale, Alexander Fleming, and the
 * Former Self deliver the narrative warning beat.
 *
 * VN layout (Persona 5 / Disgaea reference):
 *   – Full background: ward_corridor_battle.png (panning Ken Burns)
 *   – Half-body character art stands on the RIGHT side of the screen
 *   – Bottom bar (full width, semi-transparent):
 *       ┌──────────────────────────────────────────────────────────┐
 *       │ [●portrait] Speaker Name                         [▾ NEXT]│
 *       │                                                          │
 *       │   Typewriter dialogue text…                             │
 *       └──────────────────────────────────────────────────────────┘
 *   – Portrait thumbnail: circle avatar bottom-left of the bar
 *   – Speaker name: accent-coloured, above dialogue text
 *   – Typewriter: character-by-character reveal, ~28 chars/sec
 *   – Tap anywhere: skip typewriter → show full line; tap again → advance
 *   – Red pulse overlay on the final trapReveal beat
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: W, height: H } = Dimensions.get("window");

// ─── Art ─────────────────────────────────────────────────────────────────────

const ART = {
  battlefield: require("../../../assets/images/ward_corridor_battle.png"),
  masterBai:   require("../../../assets/images/master_bai_nobg.png"),
  nightingale: require("../../../assets/images/nightingale_legend_vn.png"),
  fleming:     require("../../../assets/images/fleming_legend_vn.png"),
  prodigy:     require("../../../assets/images/the_prodigy_vn.png"),
} as const;

// ─── Speakers ─────────────────────────────────────────────────────────────────

type SpeakerId = "MASTER_BAI" | "NIGHTINGALE" | "FLEMING" | "PRODIGY";

const SPEAKERS: Record<
  SpeakerId,
  { label: string; color: string; barColor: string; art: any; portrait: any }
> = {
  MASTER_BAI: {
    label:    "Master Bai",
    color:    "#D9A441",
    barColor: "rgba(30,20,5,0.93)",
    art:      ART.masterBai,
    portrait: ART.masterBai,
  },
  NIGHTINGALE: {
    label:    "Florence Nightingale",
    color:    "#4FD8C4",
    barColor: "rgba(5,22,20,0.93)",
    art:      ART.nightingale,
    portrait: ART.nightingale,
  },
  FLEMING: {
    label:    "Alexander Fleming",
    color:    "#78B8F0",
    barColor: "rgba(5,15,28,0.93)",
    art:      ART.fleming,
    portrait: ART.fleming,
  },
  PRODIGY: {
    label:    "The Former Self",
    color:    "#E8354A",
    barColor: "rgba(28,5,8,0.93)",
    art:      ART.prodigy,
    portrait: ART.prodigy,
  },
};

// ─── Beats ────────────────────────────────────────────────────────────────────

interface Beat {
  speaker:    SpeakerId;
  line:       string;
  trapReveal?: boolean;
}

const BEATS: Beat[] = [
  { speaker: "MASTER_BAI",  line: "That battle showed you the rhythm." },
  { speaker: "MASTER_BAI",  line: "But something is wrong here. The enemy is allowing us to see only what it wants us to see." },
  { speaker: "PRODIGY",     line: "I have already cleared the visible threats. The ward is open." },
  { speaker: "NIGHTINGALE", line: "These injuries do not match the enemies in front of us." },
  { speaker: "NIGHTINGALE", line: "The monitoring crystals failed before the first creature appeared. We are missing something important." },
  { speaker: "PRODIGY",     line: "Or you are searching for complexity where none exists." },
  { speaker: "NIGHTINGALE", line: "A patient does not become less endangered because the danger is difficult to see." },
  { speaker: "FLEMING",     line: "This corruption is adapting." },
  { speaker: "FLEMING",     line: "If we advance carelessly, we may strengthen what we are trying to eliminate." },
  { speaker: "PRODIGY",     line: "I have defeated stronger enemies than this alone." },
  { speaker: "FLEMING",     line: "Power used without proper selection can turn treatment into harm." },
  { speaker: "MASTER_BAI",  line: "Wait. Assess the field. The pattern is not complete." },
  { speaker: "PRODIGY",     line: "While we stand discussing possibilities, something is still spreading." },
  { speaker: "MASTER_BAI",  line: "That is why this enemy has chosen you." },
  {
    speaker:    "PRODIGY",
    line:       "Watch carefully, Master. I will show you how quickly this can be ended.",
    trapReveal: true,
  },
];

const CHARS_PER_SEC = 32;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function WarningDialogueScene({ onComplete }: Props) {
  const insets = useSafeAreaInsets();

  const [beatIdx,    setBeatIdx]    = useState(0);
  const [displayed,  setDisplayed]  = useState("");
  const [typewriterDone, setTypewriterDone] = useState(false);

  const beatRef    = useRef(0);
  const busyRef    = useRef(false);
  const mountedRef = useRef(true);
  const twTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const timers     = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Animations
  const bgFade      = useRef(new Animated.Value(0)).current;
  const bgScale     = useRef(new Animated.Value(1.04)).current;
  const redOverlay  = useRef(new Animated.Value(0)).current;
  const charFade    = useRef(new Animated.Value(0)).current;
  const barSlide    = useRef(new Animated.Value(60)).current;
  const barFade     = useRef(new Animated.Value(0)).current;
  const closeFade   = useRef(new Animated.Value(0)).current;

  const after = (ms: number, fn: () => void) => {
    const t = setTimeout(() => { if (mountedRef.current) fn(); }, ms);
    timers.current.push(t);
    return t;
  };

  // ── Typewriter ────────────────────────────────────────────────────────────

  const stopTypewriter = () => {
    if (twTimer.current) { clearInterval(twTimer.current); twTimer.current = null; }
  };

  const startTypewriter = useCallback((line: string) => {
    stopTypewriter();
    if (!mountedRef.current) return;
    setDisplayed("");
    setTypewriterDone(false);

    let pos = 0;
    const interval = Math.round(1000 / CHARS_PER_SEC);
    twTimer.current = setInterval(() => {
      pos += 1;
      setDisplayed(line.slice(0, pos));
      if (pos >= line.length) {
        stopTypewriter();
        if (mountedRef.current) setTypewriterDone(true);
      }
    }, interval);
  }, []);

  const skipTypewriter = useCallback((line: string) => {
    stopTypewriter();
    setDisplayed(line);
    setTypewriterDone(true);
  }, []);

  // ── Show beat ─────────────────────────────────────────────────────────────

  const revealBeat = useCallback((idx: number) => {
    if (!mountedRef.current) return;
    beatRef.current = idx;
    setBeatIdx(idx);

    const beat = BEATS[idx];

    if (beat.trapReveal) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(redOverlay, { toValue: 0.42, duration: 650, useNativeDriver: false }),
          Animated.timing(redOverlay, { toValue: 0.10, duration: 650, useNativeDriver: false }),
        ])
      ).start();
    }

    // Slide bar in, then start typewriter
    Animated.parallel([
      Animated.timing(barSlide, { toValue: 0,  duration: 280, useNativeDriver: false }),
      Animated.timing(barFade,  { toValue: 1,  duration: 280, useNativeDriver: false }),
      Animated.timing(charFade, { toValue: 1,  duration: 250, useNativeDriver: false }),
    ]).start(() => {
      if (!mountedRef.current) return;
      startTypewriter(beat.line);
    });
  }, [barSlide, barFade, charFade, redOverlay, startTypewriter]);

  // ── Boot ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;

    Animated.loop(
      Animated.sequence([
        Animated.timing(bgScale, { toValue: 1.0,  duration: 8000, useNativeDriver: false }),
        Animated.timing(bgScale, { toValue: 1.04, duration: 8000, useNativeDriver: false }),
      ])
    ).start();

    Animated.timing(bgFade, { toValue: 1, duration: 600, useNativeDriver: false }).start(() => {
      after(200, () => revealBeat(0));
    });

    return () => {
      mountedRef.current = false;
      stopTypewriter();
      timers.current.forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tap handler ───────────────────────────────────────────────────────────

  const handleTap = useCallback(() => {
    if (busyRef.current || !mountedRef.current) return;

    const beat = BEATS[beatRef.current];

    // If typewriter still running — skip to end of current line
    if (!typewriterDone) {
      skipTypewriter(beat.line);
      return;
    }

    busyRef.current = true;

    const nextIdx = beatRef.current + 1;

    if (nextIdx >= BEATS.length) {
      // Final beat — close out
      Animated.parallel([
        Animated.timing(barFade,  { toValue: 0, duration: 300, useNativeDriver: false }),
        Animated.timing(charFade, { toValue: 0, duration: 300, useNativeDriver: false }),
      ]).start(() => {
        Animated.timing(closeFade, { toValue: 1, duration: 500, useNativeDriver: false }).start(() => {
          after(80, onComplete);
        });
      });
      return;
    }

    // Reset bar for next beat
    Animated.parallel([
      Animated.timing(barFade,  { toValue: 0, duration: 220, useNativeDriver: false }),
      Animated.timing(charFade, { toValue: 0, duration: 180, useNativeDriver: false }),
    ]).start(() => {
      if (!mountedRef.current) return;
      barSlide.setValue(60);
      charFade.setValue(0);
      busyRef.current = false;
      revealBeat(nextIdx);
    });
  }, [typewriterDone, skipTypewriter, barFade, charFade, barSlide, closeFade, onComplete, revealBeat]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const beat    = BEATS[beatIdx];
  const speaker = SPEAKERS[beat.speaker];

  const BAR_HEIGHT = 168;

  return (
    <Pressable style={s.root} onPress={handleTap}>

      {/* ── Background ─────────────────────────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgFade }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: bgScale }] }]}>
          <ExpoImage source={ART.battlefield} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>

        {/* Gradient — heavier at bottom where the bar lives */}
        <LinearGradient
          colors={["rgba(0,0,0,0.28)", "rgba(0,0,0,0.15)", "rgba(4,8,18,0.72)"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Trap-reveal red pulse */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: "#FF1020", opacity: redOverlay }]}
          pointerEvents="none"
        />
      </Animated.View>

      {/* ── Character half-body (right side, above bar) ────────── */}
      <Animated.View
        style={[s.charWrap, { bottom: BAR_HEIGHT + insets.bottom, opacity: charFade }]}
        pointerEvents="none"
      >
        <ExpoImage
          source={speaker.art}
          style={s.charArt}
          contentFit="contain"
        />
        {/* Subtle glow halo behind character */}
        <View
          style={[s.charGlow, { backgroundColor: `${speaker.color}18` }]}
          pointerEvents="none"
        />
      </Animated.View>

      {/* ── VN Dialogue Bar ────────────────────────────────────── */}
      <Animated.View
        style={[
          s.bar,
          {
            opacity:          barFade,
            transform:        [{ translateY: barSlide }],
            height:           BAR_HEIGHT + insets.bottom,
            paddingBottom:    insets.bottom + 12,
            backgroundColor:  speaker.barColor,
            borderTopColor:   `${speaker.color}55`,
          },
        ]}
        pointerEvents="none"
      >
        {/* Top accent line */}
        <View style={[s.barAccentLine, { backgroundColor: speaker.color }]} />

        <View style={s.barInner}>
          {/* Portrait thumbnail — circle */}
          <View style={[s.portraitRing, { borderColor: speaker.color }]}>
            <ExpoImage
              source={speaker.portrait}
              style={s.portraitImg}
              contentFit="cover"
            />
          </View>

          {/* Text column */}
          <View style={s.textCol}>
            {/* Speaker name */}
            <Text style={[s.speakerName, { color: speaker.color }]} numberOfLines={1}>
              {speaker.label}
            </Text>

            {/* Dialogue text */}
            <Text style={s.dlgText} numberOfLines={4}>
              {displayed}
              {!typewriterDone && <Text style={{ color: speaker.color }}>▌</Text>}
            </Text>
          </View>

          {/* Next arrow */}
          {typewriterDone && (
            <View style={s.nextArrowWrap}>
              <Text style={[s.nextArrow, { color: speaker.color }]}>▾</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* ── Fade-to-black close ────────────────────────────────── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#040810", opacity: closeFade }]}
        pointerEvents="none"
      />
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#040810",
  },

  // Character art
  charWrap: {
    position:  "absolute",
    right:     W * 0.02,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    width:     W * 0.62,
    height:    H * 0.64,
  },
  charArt: {
    width:  "100%",
    height: "100%",
  },
  charGlow: {
    position:     "absolute",
    width:        "70%",
    height:       "80%",
    right:        "15%",
    bottom:       0,
    borderRadius: 200,
  },

  // VN bar
  bar: {
    position:      "absolute",
    bottom:        0,
    left:          0,
    right:         0,
    borderTopWidth: 1,
  },
  barAccentLine: {
    height: 2,
    width:  "100%",
    opacity: 0.7,
  },
  barInner: {
    flex:           1,
    flexDirection:  "row",
    alignItems:     "center",
    paddingHorizontal: 16,
    paddingTop:     10,
    gap:            14,
  },

  // Portrait
  portraitRing: {
    width:        64,
    height:       64,
    borderRadius: 32,
    borderWidth:  2.5,
    overflow:     "hidden",
    flexShrink:   0,
  },
  portraitImg: {
    width:  "100%",
    height: "100%",
  },

  // Text
  textCol: {
    flex:  1,
    gap:   4,
  },
  speakerName: {
    fontSize:     11,
    fontWeight:   "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  dlgText: {
    color:      "#DCE8F2",
    fontSize:   15.5,
    fontWeight: "400",
    lineHeight: 24,
  },

  // Next arrow
  nextArrowWrap: {
    alignSelf:  "flex-end",
    paddingBottom: 4,
    flexShrink: 0,
  },
  nextArrow: {
    fontSize:   22,
    fontWeight: "900",
    opacity:    0.9,
  },
});
