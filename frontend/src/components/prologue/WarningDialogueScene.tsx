/**
 * WarningDialogueScene
 *
 * Phase: warning_dialogue_scene
 *
 * VN-style warning after the overconfidence cutscene: Master Bai,
 * Florence Nightingale, Alexander Fleming, and the Former Self deliver
 * the narrative warning beat before the inevitable scripted loss.
 *
 * VN layout (see PrologueVNBar):
 *   – Full background: ward_corridor_battle.png (Ken Burns pan)
 *   – Current speaker's portrait fades in on the right (above bar)
 *   – Bottom bar: [avatar] dialogue text… [▾] / [name]
 *   – Tap: skip typewriter → tap again → advance
 *   – Last beat has trapReveal: red pulse; auto-completes on tap
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

interface Beat { speaker: PrologueSpeakerId; line: string; trapReveal?: boolean }

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
  { speaker: "PRODIGY",     line: "Watch carefully, Master. I will show you how quickly this can be ended.", trapReveal: true },
];

// Bar is slightly taller here to fit longer lines comfortably.
const BAR_HEIGHT = 220;

interface Props { onComplete: () => void }

export default function WarningDialogueScene({ onComplete }: Props) {
  const [beatIdx, setBeatIdx] = useState(0);

  const beatRef    = useRef(0);
  const busyRef    = useRef(false);
  const mountedRef = useRef(true);
  const timers     = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { displayed, typewriterDone, startTypewriter, skipTypewriter } = useVNTypewriter();

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

  const revealBeat = useCallback((idx: number) => {
    if (!mountedRef.current) return;
    beatRef.current = idx;
    setBeatIdx(idx);

    // Trap-reveal: pulsing red overlay on the last beat
    if (BEATS[idx].trapReveal) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(redOverlay, { toValue: 0.42, duration: 650, useNativeDriver: true }),
          Animated.timing(redOverlay, { toValue: 0.10, duration: 650, useNativeDriver: true }),
        ])
      ).start();
    }

    Animated.parallel([
      Animated.timing(barSlide, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(barFade,  { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(charFade, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      if (!mountedRef.current) return;
      startTypewriter(BEATS[idx].line);
    });
  }, [barSlide, barFade, charFade, redOverlay, startTypewriter]);

  useEffect(() => {
    mountedRef.current = true;
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgScale, { toValue: 1.0,  duration: 8000, useNativeDriver: true }),
        Animated.timing(bgScale, { toValue: 1.04, duration: 8000, useNativeDriver: true }),
      ])
    ).start();
    Animated.timing(bgFade, { toValue: 1, duration: 600, useNativeDriver: true }).start(() => {
      after(200, () => revealBeat(0));
    });
    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
    };
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
  }, [typewriterDone, skipTypewriter, barFade, charFade, barSlide, closeFade, onComplete, revealBeat]);

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
        {/* Trap-reveal red pulse */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: "#FF1020", opacity: redOverlay }]}
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
        barHeight={BAR_HEIGHT}
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
