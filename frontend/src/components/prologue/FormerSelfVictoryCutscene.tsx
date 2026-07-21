/**
 * FormerSelfVictoryCutscene — VN-style post-battle cutscene
 *
 * Phase: former_self_victory_boast
 *
 * After the first tutorial battle, the Prodigy becomes even more reckless.
 * Nightingale raises concern. The Prodigy dismisses it entirely.
 *
 * VN layout (same as WarningDialogueScene):
 *   – Full background: ward_corridor_battle.png
 *   – Only current speaker's half-body art on the right
 *   – Bottom bar with 64px portrait + typewriter dialogue
 *   – Tap: skip typewriter → advance; last beat auto-advances 1.2 s
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
  prodigy:     require("../../../assets/images/the_prodigy_vn.png"),
} as const;

// ─── Speakers ─────────────────────────────────────────────────────────────────

type SpeakerId = "PRODIGY" | "NIGHTINGALE" | "MASTER_BAI";

const SPEAKERS: Record<
  SpeakerId,
  { label: string; color: string; barColor: string; art: any; portrait: any }
> = {
  PRODIGY: {
    label:    "The Former Self",
    color:    "#E8354A",
    barColor: "rgba(28,5,8,0.93)",
    art:      ART.prodigy,
    portrait: ART.prodigy,
  },
  NIGHTINGALE: {
    label:    "Florence Nightingale",
    color:    "#4FD8C4",
    barColor: "rgba(5,22,20,0.93)",
    art:      ART.nightingale,
    portrait: ART.nightingale,
  },
  MASTER_BAI: {
    label:    "Master Bai",
    color:    "#D9A441",
    barColor: "rgba(30,20,5,0.93)",
    art:      ART.masterBai,
    portrait: ART.masterBai,
  },
};

// ─── Beats ────────────────────────────────────────────────────────────────────

interface Beat {
  speaker:  SpeakerId;
  line:     string;
  autoEnd?: boolean;
}

const BEATS: Beat[] = [
  {
    speaker: "PRODIGY",
    line:    "Child's play. The ward hasn't seen a real challenge since my last shift.",
  },
  {
    speaker: "NIGHTINGALE",
    line:    "The monitoring crystals failed before the first creature appeared. Something does not add up.",
  },
  {
    speaker: "PRODIGY",
    line:    "The crystals are old. They need recalibrating. That's maintenance — not a threat.",
  },
  {
    speaker: "NIGHTINGALE",
    line:    "These injuries do not match the enemies we fought. The visible corruption was not the source.",
  },
  {
    speaker: "PRODIGY",
    line:    "Then find the source. That is exactly what we are about to do — by going forward.",
  },
  {
    speaker:  "MASTER_BAI",
    line:     "...Wait.",
    autoEnd:  true,
  },
];

const CHARS_PER_SEC = 32;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function FormerSelfVictoryCutscene({ onComplete }: Props) {
  const insets = useSafeAreaInsets();

  const [beatIdx,        setBeatIdx]        = useState(0);
  const [displayed,      setDisplayed]      = useState("");
  const [typewriterDone, setTypewriterDone] = useState(false);

  const beatRef    = useRef(0);
  const busyRef    = useRef(false);
  const mountedRef = useRef(true);
  const twTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const timers     = useRef<ReturnType<typeof setTimeout>[]>([]);

  const bgFade    = useRef(new Animated.Value(0)).current;
  const bgScale   = useRef(new Animated.Value(1.04)).current;
  const charFade  = useRef(new Animated.Value(0)).current;
  const barSlide  = useRef(new Animated.Value(60)).current;
  const barFade   = useRef(new Animated.Value(0)).current;
  const closeFade = useRef(new Animated.Value(0)).current;

  const after = (ms: number, fn: () => void) => {
    const t = setTimeout(() => { if (mountedRef.current) fn(); }, ms);
    timers.current.push(t);
    return t;
  };

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

  const revealBeat = useCallback((idx: number) => {
    if (!mountedRef.current) return;
    beatRef.current = idx;
    setBeatIdx(idx);

    Animated.parallel([
      Animated.timing(barSlide, { toValue: 0,  duration: 280, useNativeDriver: false }),
      Animated.timing(barFade,  { toValue: 1,  duration: 280, useNativeDriver: false }),
      Animated.timing(charFade, { toValue: 1,  duration: 250, useNativeDriver: false }),
    ]).start(() => {
      if (!mountedRef.current) return;
      startTypewriter(BEATS[idx].line);
    });
  }, [barSlide, barFade, charFade, startTypewriter]);

  useEffect(() => {
    mountedRef.current = true;

    Animated.loop(
      Animated.sequence([
        Animated.timing(bgScale, { toValue: 1.0,  duration: 8000, useNativeDriver: false }),
        Animated.timing(bgScale, { toValue: 1.04, duration: 8000, useNativeDriver: false }),
      ])
    ).start();

    Animated.timing(bgFade, { toValue: 1, duration: 700, useNativeDriver: false }).start(() => {
      after(200, () => revealBeat(0));
    });

    return () => {
      mountedRef.current = false;
      stopTypewriter();
      timers.current.forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advanceBeat = useCallback(() => {
    if (busyRef.current || !mountedRef.current) return;
    busyRef.current = true;

    const nextIdx = beatRef.current + 1;

    if (nextIdx >= BEATS.length) {
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
  }, [barFade, charFade, barSlide, closeFade, onComplete, revealBeat]);

  const handleTap = useCallback(() => {
    if (busyRef.current || !mountedRef.current) return;
    const beat = BEATS[beatRef.current];
    if (!typewriterDone) {
      skipTypewriter(beat.line);
      return;
    }
    if (beat.autoEnd) return;
    advanceBeat();
  }, [typewriterDone, skipTypewriter, advanceBeat]);

  useEffect(() => {
    if (!typewriterDone) return;
    const beat = BEATS[beatRef.current];
    if (!beat?.autoEnd) return;
    const t = after(1200, () => advanceBeat());
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typewriterDone]);

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
        <LinearGradient
          colors={["rgba(0,0,0,0.28)", "rgba(0,0,0,0.15)", "rgba(4,8,18,0.72)"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </Animated.View>

      {/* ── Character art (right, above bar) ───────────────────── */}
      <Animated.View
        style={[s.charWrap, { bottom: BAR_HEIGHT + insets.bottom, opacity: charFade }]}
        pointerEvents="none"
      >
        <ExpoImage source={speaker.art} style={s.charArt} contentFit="contain" />
        <View style={[s.charGlow, { backgroundColor: `${speaker.color}18` }]} pointerEvents="none" />
      </Animated.View>

      {/* ── VN Dialogue Bar ─────────────────────────────────────── */}
      <Animated.View
        style={[
          s.bar,
          {
            opacity:         barFade,
            transform:       [{ translateY: barSlide }],
            height:          BAR_HEIGHT + insets.bottom,
            paddingBottom:   insets.bottom + 12,
            backgroundColor: speaker.barColor,
            borderTopColor:  `${speaker.color}55`,
          },
        ]}
        pointerEvents="none"
      >
        <View style={[s.barAccentLine, { backgroundColor: speaker.color }]} />
        <View style={s.barInner}>
          <View style={[s.portraitRing, { borderColor: speaker.color }]}>
            <ExpoImage source={speaker.portrait} style={s.portraitImg} contentFit="cover" />
          </View>
          <View style={s.textCol}>
            <Text style={[s.speakerName, { color: speaker.color }]} numberOfLines={1}>
              {speaker.label}
            </Text>
            <Text style={s.dlgText} numberOfLines={4}>
              {displayed}
              {!typewriterDone && <Text style={{ color: speaker.color }}>▌</Text>}
            </Text>
          </View>
          {typewriterDone && !beat.autoEnd && (
            <View style={s.nextArrowWrap}>
              <Text style={[s.nextArrow, { color: speaker.color }]}>▾</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* ── Fade-to-black ──────────────────────────────────────── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#040810", opacity: closeFade }]}
        pointerEvents="none"
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#040810" },

  charWrap: {
    position:       "absolute",
    right:          W * 0.02,
    alignItems:     "flex-end",
    justifyContent: "flex-end",
    width:          W * 0.62,
    height:         H * 0.64,
  },
  charArt:  { width: "100%", height: "100%" },
  charGlow: {
    position:     "absolute",
    width:        "70%",
    height:       "80%",
    right:        "15%",
    bottom:       0,
    borderRadius: 200,
  },

  bar: {
    position:       "absolute",
    bottom:         0,
    left:           0,
    right:          0,
    borderTopWidth: 1,
  },
  barAccentLine: { height: 2, width: "100%", opacity: 0.7 },
  barInner: {
    flex:              1,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingTop:        10,
    gap:               14,
  },

  portraitRing: {
    width:        64,
    height:       64,
    borderRadius: 32,
    borderWidth:  2.5,
    overflow:     "hidden",
    flexShrink:   0,
  },
  portraitImg: { width: "100%", height: "100%" },

  textCol: { flex: 1, gap: 4 },
  speakerName: {
    fontSize:      11,
    fontWeight:    "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  dlgText: {
    color:      "#DCE8F2",
    fontSize:   15.5,
    fontWeight: "400",
    lineHeight: 24,
  },

  nextArrowWrap: { alignSelf: "flex-end", paddingBottom: 4, flexShrink: 0 },
  nextArrow:     { fontSize: 22, fontWeight: "900", opacity: 0.9 },
});
