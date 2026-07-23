/**
 * WarningDialogueScene — Push 11b
 *
 * Phase: warning_dialogue_scene
 *
 * VN-style warning after the overconfidence cutscene: Master Bai,
 * Florence Nightingale, Alexander Fleming, and the Former Self deliver
 * the narrative warning beat before the inevitable scripted loss.
 *
 * VN layout (anime dialogue reference style):
 *   – Full background: ward_corridor_battle.png (Ken Burns pan)
 *   – Current speaker's portrait fades in on the right (above bar)
 *   – Bottom bar:
 *       [avatar]   dialogue text…                           [▾]
 *       [ name ]
 *   – NO oval/capsule glow behind character art
 *   – Tap: skip typewriter → tap again → advance
 *   – Last beat has trapReveal: red pulse; auto-completes on tap
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
  { label: string; color: string; barColor: string; art: any; avatar: any }
> = {
  PRODIGY: {
    label:    PROLOGUE_CHARACTERS.PRODIGY.name,
    color:    PROLOGUE_CHARACTERS.PRODIGY.color,
    barColor: PROLOGUE_CHARACTERS.PRODIGY.barColor,
    art:      PROLOGUE_CHARACTERS.PRODIGY.largePortrait,
    avatar:   PROLOGUE_CHARACTERS.PRODIGY.avatar48,
  },
  MASTER_BAI: {
    label:    PROLOGUE_CHARACTERS.MASTER_BAI.name,
    color:    PROLOGUE_CHARACTERS.MASTER_BAI.color,
    barColor: PROLOGUE_CHARACTERS.MASTER_BAI.barColor,
    art:      PROLOGUE_CHARACTERS.MASTER_BAI.largePortrait,
    avatar:   PROLOGUE_CHARACTERS.MASTER_BAI.avatar48,
  },
  NIGHTINGALE: {
    label:    PROLOGUE_CHARACTERS.NIGHTINGALE.name,
    color:    PROLOGUE_CHARACTERS.NIGHTINGALE.color,
    barColor: PROLOGUE_CHARACTERS.NIGHTINGALE.barColor,
    art:      PROLOGUE_CHARACTERS.NIGHTINGALE.largePortrait,
    avatar:   PROLOGUE_CHARACTERS.NIGHTINGALE.avatar48,
  },
  FLEMING: {
    label:    PROLOGUE_CHARACTERS.FLEMING.name,
    color:    PROLOGUE_CHARACTERS.FLEMING.color,
    barColor: PROLOGUE_CHARACTERS.FLEMING.barColor,
    art:      PROLOGUE_CHARACTERS.FLEMING.largePortrait,
    avatar:   PROLOGUE_CHARACTERS.FLEMING.avatar48,
  },
};

interface Beat {
  speaker:     PrologueSpeakerId;
  line:        string;
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
const BAR_HEIGHT    = 200;

interface Props { onComplete: () => void }

export default function WarningDialogueScene({ onComplete }: Props) {
  const insets = useSafeAreaInsets();

  const [beatIdx,        setBeatIdx]        = useState(0);
  const [displayed,      setDisplayed]      = useState("");
  const [typewriterDone, setTypewriterDone] = useState(false);

  const beatRef    = useRef(0);
  const busyRef    = useRef(false);
  const mountedRef = useRef(true);
  const twTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const timers     = useRef<ReturnType<typeof setTimeout>[]>([]);

  const bgFade     = useRef(new Animated.Value(0)).current;
  const bgScale    = useRef(new Animated.Value(1.04)).current;
  const redOverlay = useRef(new Animated.Value(0)).current;
  const charFade   = useRef(new Animated.Value(0)).current;
  const barSlide   = useRef(new Animated.Value(60)).current;
  const barFade    = useRef(new Animated.Value(0)).current;
  const closeFade  = useRef(new Animated.Value(0)).current;

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

    const beat = BEATS[idx];
    if (beat.trapReveal) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(redOverlay, { toValue: 0.42, duration: 650, useNativeDriver: false }),
          Animated.timing(redOverlay, { toValue: 0.10, duration: 650, useNativeDriver: false }),
        ])
      ).start();
    }

    Animated.parallel([
      Animated.timing(barSlide, { toValue: 0,  duration: 280, useNativeDriver: false }),
      Animated.timing(barFade,  { toValue: 1,  duration: 280, useNativeDriver: false }),
      Animated.timing(charFade, { toValue: 1,  duration: 300, useNativeDriver: false }),
    ]).start(() => { if (!mountedRef.current) return; startTypewriter(beat.line); });
  }, [barSlide, barFade, charFade, redOverlay, startTypewriter]);

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
    return () => { mountedRef.current = false; stopTypewriter(); timers.current.forEach(clearTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = useCallback(() => {
    if (busyRef.current || !mountedRef.current) return;

    const beat = BEATS[beatRef.current];
    if (!typewriterDone) { skipTypewriter(beat.line); return; }

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
      barSlide.setValue(60); charFade.setValue(0); busyRef.current = false; revealBeat(nextIdx);
    });
  }, [typewriterDone, skipTypewriter, barFade, charFade, barSlide, closeFade, onComplete, revealBeat]);

  // ─── Render ─────────────────────────────────────────────────────────────────

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
        {/* Trap-reveal red pulse */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: "#FF1020", opacity: redOverlay }]}
          pointerEvents="none"
        />
      </Animated.View>

      {/* ── Character portrait — right side, grounded behind bar ──────── */}
      <Animated.View
        style={[s.charWrap, { bottom: barTotal - 100, opacity: charFade }]}
        pointerEvents="none"
      >
        <ExpoImage source={speaker.art} style={s.charArt} contentFit="contain" contentPosition="bottom" />
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

          {typewriterDone && (
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

  charWrap: {
    position:       "absolute",
    right:          0,
    alignItems:     "flex-end",
    justifyContent: "flex-end",
    width:          W * 0.80,
    height:         H * 0.82,
  },
  charArt: { width: "100%", height: "100%" },

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

  leftCol: { alignItems: "center", gap: 6, flexShrink: 0, width: 80 },
  avatarRing: {
    width:        80,
    height:       80,
    borderRadius: 40,
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
