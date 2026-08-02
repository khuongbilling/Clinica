/**
 * FormerSelfVictoryCutscene — VN-style post-first-battle cutscene
 *
 * Phase: former_self_victory_boast
 *
 * After the first tutorial battle the Prodigy becomes even more reckless.
 * Nightingale raises concern. Master Bai gives a quiet final warning.
 *
 * VN layout (see PrologueVNBar):
 *   – Full background fills screen with Ken Burns pan
 *   – Current speaker's portrait fades in on the right side
 *   – Bottom dialogue bar: [avatar] dialogue text… [▾] / [name]
 *   – Tap: skip typewriter → advance; last beat auto-advances 1.2 s
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type PrologueSpeakerId } from "../../game/prologueCharacters";
import { useVNTypewriter } from "../../hooks/useVNTypewriter";
import PrologueVNBar, { vnSpeakerFor } from "./PrologueVNBar";

const BG = require("../../../assets/images/ward_corridor_battle.png");

interface Beat { speaker: PrologueSpeakerId; line: string; autoEnd?: boolean }

const BEATS: Beat[] = [
  { speaker: "PRODIGY",     line: "Child's play. The ward hasn't seen a real challenge since my last shift." },
  { speaker: "NIGHTINGALE", line: "The monitoring crystals failed before the first creature appeared. Something does not add up." },
  { speaker: "PRODIGY",     line: "The crystals are old. They need recalibrating. That's maintenance — not a threat." },
  { speaker: "NIGHTINGALE", line: "These injuries do not match the enemies we fought. The visible corruption was not the source." },
  { speaker: "PRODIGY",     line: "Then find the source. That is exactly what we are about to do — by going forward." },
  { speaker: "MASTER_BAI",  line: "...Wait.", autoEnd: true },
];

interface Props { onComplete: () => void }

export default function FormerSelfVictoryCutscene({ onComplete }: Props) {
  const [beatIdx, setBeatIdx] = useState(0);

  const beatRef    = useRef(0);
  const busyRef    = useRef(false);
  const mountedRef = useRef(true);
  const timers     = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { displayed, typewriterDone, startTypewriter, skipTypewriter } = useVNTypewriter();

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

  const revealBeat = useCallback((idx: number) => {
    if (!mountedRef.current) return;
    beatRef.current = idx;
    setBeatIdx(idx);
    Animated.parallel([
      Animated.timing(barSlide, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(barFade,  { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(charFade, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      if (!mountedRef.current) return;
      startTypewriter(BEATS[idx].line);
    });
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
    return () => {
      mountedRef.current = false;
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
        Animated.timing(barFade,  { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(charFade, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        Animated.timing(closeFade, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => {
          after(80, onComplete);
        });
      });
      return;
    }
    Animated.parallel([
      Animated.timing(barFade,  { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(charFade, { toValue: 0, duration: 180, useNativeDriver: true }),
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

  const beat = BEATS[beatIdx];

  return (
    <Pressable style={s.root} onPress={handleTap}>

      {/* ── Background (Ken Burns) ───────────────────────────────────── */}
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

      {/* ── VN portrait + dialogue bar ──────────────────────────────── */}
      <PrologueVNBar
        speaker={vnSpeakerFor(beat.speaker)}
        displayed={displayed}
        typewriterDone={typewriterDone}
        barSlide={barSlide}
        barFade={barFade}
        charFade={charFade}
        showArrow={typewriterDone && !beat.autoEnd}
      />

      {/* ── Fade-to-black ────────────────────────────────────────────── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#040810", opacity: closeFade }]}
        pointerEvents="none"
      />

    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#040810" },
});
