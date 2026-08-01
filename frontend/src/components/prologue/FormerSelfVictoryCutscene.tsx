/**
 * FormerSelfVictoryCutscene — VN-style post-first-battle cutscene
 *
 * Phase: former_self_victory_boast
 *
 * After the first tutorial battle the Prodigy becomes even more reckless.
 * Nightingale raises concern. Master Bai gives a quiet final warning.
 *
 * VN layout: scene bg | right character portrait | bottom dialogue bar
 *   – Left column: large avatar (80px) + speaker name below
 *   – Right column: dialogue text (17px) + ▾ advance arrow
 *   – No oval/capsule glow behind characters
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
import {
  PROLOGUE_CHARACTERS,
  type PrologueSpeakerId,
} from "../../game/prologueCharacters";

const { width: W, height: H } = Dimensions.get("window");

const BG = require("../../../assets/images/ward_corridor_battle.png");

const SPEAKERS: Record<
  PrologueSpeakerId,
  { label: string; color: string; barColor: string; art: any; avatar: any;
    artFit: "contain" | "cover"; artPos: "bottom" | "top" }
> = {
  PRODIGY: {
    label:    PROLOGUE_CHARACTERS.PRODIGY.name,
    color:    PROLOGUE_CHARACTERS.PRODIGY.color,
    barColor: PROLOGUE_CHARACTERS.PRODIGY.barColor,
    art:      PROLOGUE_CHARACTERS.PRODIGY.largePortrait,
    avatar:   PROLOGUE_CHARACTERS.PRODIGY.avatar48,
    artFit:   "cover",
    artPos:   "bottom",
  },
  MASTER_BAI: {
    label:    PROLOGUE_CHARACTERS.MASTER_BAI.name,
    color:    PROLOGUE_CHARACTERS.MASTER_BAI.color,
    barColor: PROLOGUE_CHARACTERS.MASTER_BAI.barColor,
    art:      PROLOGUE_CHARACTERS.MASTER_BAI.largePortrait,
    avatar:   PROLOGUE_CHARACTERS.MASTER_BAI.avatar48,
    artFit:   "contain",
    artPos:   "bottom",
  },
  NIGHTINGALE: {
    label:    PROLOGUE_CHARACTERS.NIGHTINGALE.name,
    color:    PROLOGUE_CHARACTERS.NIGHTINGALE.color,
    barColor: PROLOGUE_CHARACTERS.NIGHTINGALE.barColor,
    art:      PROLOGUE_CHARACTERS.NIGHTINGALE.largePortrait,
    avatar:   PROLOGUE_CHARACTERS.NIGHTINGALE.avatar48,
    artFit:   "cover",
    artPos:   "bottom",
  },
  FLEMING: {
    label:    PROLOGUE_CHARACTERS.FLEMING.name,
    color:    PROLOGUE_CHARACTERS.FLEMING.color,
    barColor: PROLOGUE_CHARACTERS.FLEMING.barColor,
    art:      PROLOGUE_CHARACTERS.FLEMING.largePortrait,
    avatar:   PROLOGUE_CHARACTERS.FLEMING.avatar48,
    artFit:   "cover",
    artPos:   "bottom",
  },
};

interface Beat { speaker: PrologueSpeakerId; line: string; autoEnd?: boolean }

const BEATS: Beat[] = [
  { speaker: "PRODIGY",     line: "Child's play. The ward hasn't seen a real challenge since my last shift." },
  { speaker: "NIGHTINGALE", line: "The monitoring crystals failed before the first creature appeared. Something does not add up." },
  { speaker: "PRODIGY",     line: "The crystals are old. They need recalibrating. That's maintenance — not a threat." },
  { speaker: "NIGHTINGALE", line: "These injuries do not match the enemies we fought. The visible corruption was not the source." },
  { speaker: "PRODIGY",     line: "Then find the source. That is exactly what we are about to do — by going forward." },
  { speaker: "MASTER_BAI",  line: "...Wait.", autoEnd: true },
];

const CHARS_PER_SEC = 32;
const BAR_HEIGHT    = 200;

interface Props { onComplete: () => void }

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
    setDisplayed(""); setTypewriterDone(false);
    let pos = 0;
    const interval = Math.round(1000 / CHARS_PER_SEC);
    twTimer.current = setInterval(() => {
      pos += 1;
      setDisplayed(line.slice(0, pos));
      if (pos >= line.length) { stopTypewriter(); if (mountedRef.current) setTypewriterDone(true); }
    }, interval);
  }, []);

  const skipTypewriter = useCallback((line: string) => {
    stopTypewriter(); setDisplayed(line); setTypewriterDone(true);
  }, []);

  const revealBeat = useCallback((idx: number) => {
    if (!mountedRef.current) return;
    beatRef.current = idx; setBeatIdx(idx);
    Animated.parallel([
      Animated.timing(barSlide, { toValue: 0,  duration: 280, useNativeDriver: true }),
      Animated.timing(barFade,  { toValue: 1,  duration: 280, useNativeDriver: true }),
      Animated.timing(charFade, { toValue: 1,  duration: 300, useNativeDriver: true }),
    ]).start(() => { if (!mountedRef.current) return; startTypewriter(BEATS[idx].line); });
  }, [barSlide, barFade, charFade, startTypewriter]);

  useEffect(() => {
    mountedRef.current = true;
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgScale, { toValue: 1.0,  duration: 8000, useNativeDriver: true }),
        Animated.timing(bgScale, { toValue: 1.04, duration: 8000, useNativeDriver: true }),
      ])
    ).start();
    Animated.timing(bgFade, { toValue: 1, duration: 700, useNativeDriver: true }).start(() => {
      after(200, () => revealBeat(0));
    });
    return () => { mountedRef.current = false; stopTypewriter(); timers.current.forEach(clearTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advanceBeat = useCallback(() => {
    if (busyRef.current || !mountedRef.current) return;
    busyRef.current = true;
    const nextIdx = beatRef.current + 1;
    if (nextIdx >= BEATS.length) {
      Animated.parallel([
        Animated.timing(barFade,  { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(charFade, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        Animated.timing(closeFade, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => { after(80, onComplete); });
      });
      return;
    }
    Animated.parallel([
      Animated.timing(barFade,  { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(charFade, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      if (!mountedRef.current) return;
      barSlide.setValue(60); charFade.setValue(0); busyRef.current = false; revealBeat(nextIdx);
    });
  }, [barFade, charFade, barSlide, closeFade, onComplete, revealBeat]);

  const handleTap = useCallback(() => {
    if (busyRef.current || !mountedRef.current) return;
    const beat = BEATS[beatRef.current];
    if (!typewriterDone) { skipTypewriter(beat.line); return; }
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
  const barTotal = BAR_HEIGHT + insets.bottom;

  return (
    <Pressable style={s.root} onPress={handleTap}>

      {/* ── Background ─────────────────────────────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgFade }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: bgScale }] }]}>
          <ExpoImage source={BG} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
        <LinearGradient
          colors={["rgba(0,0,0,0.18)", "rgba(0,0,0,0.05)", "rgba(4,8,18,0.78)"]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </Animated.View>

      {/* ── Character portrait — right side, above dialogue bar ─────────── */}
      <Animated.View
        style={[s.charWrap, { opacity: charFade, bottom: barTotal }]}
        pointerEvents="none"
      >
        <ExpoImage
          source={speaker.art}
          style={s.charArt}
          contentFit={speaker.artFit}
          contentPosition={speaker.artPos}
        />
        {/* left-edge blend */}
        <LinearGradient
          colors={["rgba(4,8,18,0.82)", "rgba(4,8,18,0)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 0.38, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* bottom feather — fades the portrait into the bar edge */}
        <LinearGradient
          colors={["transparent", "rgba(4,8,18,0.96)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.charBottomFade}
          pointerEvents="none"
        />
      </Animated.View>

      {/* ── VN Dialogue Bar ────────────────────────────────────────── */}
      <Animated.View
        style={[
          s.bar,
          {
            opacity:         barFade,
            transform:       [{ translateY: barSlide }],
            height:          barTotal,
            paddingBottom:   insets.bottom + 14,
            backgroundColor: speaker.barColor,
            borderTopColor:  `${speaker.color}66`,
          },
        ]}
        pointerEvents="none"
      >
        <View style={[s.barAccent, { backgroundColor: speaker.color }]} />
        <View style={s.barInner}>
          <View style={s.leftCol}>
            <View style={[s.avatarRing, { borderColor: speaker.color }]}>
              <ExpoImage source={speaker.avatar} style={s.avatarImg} contentFit="cover" />
            </View>
            <Text style={[s.speakerName, { color: speaker.color }]} numberOfLines={2}>
              {speaker.label}
            </Text>
          </View>

          <View style={s.textCol}>
            <Text style={s.dlgText} numberOfLines={4}>
              {displayed}
              {!typewriterDone && <Text style={{ color: speaker.color }}>▌</Text>}
            </Text>
          </View>

          {typewriterDone && !beat.autoEnd && (
            <View style={s.arrowWrap}>
              <Text style={[s.arrow, { color: speaker.color }]}>▾</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* ── Fade-to-black ──────────────────────────────────────────── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#040810", opacity: closeFade }]}
        pointerEvents="none"
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#040810" },

  // Portrait container: right-aligned, fills from screen top to dialogue bar.
  // The bottom is set inline as barTotal so the character is never covered.
  charWrap: {
    position:       "absolute",
    top:            0,
    left:           0,
    right:          0,
    alignItems:     "flex-end",
    justifyContent: "flex-end",
    overflow:       "hidden",
  },
  // Takes up 74% of screen width on the right; height fills the container.
  charArt: { width: W * 0.74, height: "100%" },
  charBottomFade: {
    position: "absolute",
    bottom:   0,
    left:     0,
    right:    0,
    height:   "32%",
  },

  bar: {
    position:       "absolute",
    bottom:         0,
    left:           0,
    right:          0,
    borderTopWidth: 1.5,
  },
  barAccent: { height: 2, width: "100%", opacity: 0.8 },

  barInner: {
    flex:              1,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingTop:        12,
    gap:               14,
  },

  leftCol: { alignItems: "center", gap: 6, flexShrink: 0, width: 92 },
  avatarRing: {
    width:        92,
    height:       92,
    borderRadius: 46,
    borderWidth:  3,
    overflow:     "hidden",
  },
  avatarImg:   { width: "100%", height: "100%" },
  speakerName: {
    fontSize:      10,
    fontWeight:    "800",
    letterSpacing: 1.2,
    textAlign:     "center",
    textTransform: "uppercase",
    lineHeight:    14,
  },

  textCol:  { flex: 1 },
  dlgText: {
    color:      "#E8EEF6",
    fontSize:   17,
    fontWeight: "400",
    lineHeight: 26,
  },

  arrowWrap: { alignSelf: "flex-end", paddingBottom: 4, flexShrink: 0 },
  arrow:     { fontSize: 24, fontWeight: "900", opacity: 0.9 },
});
