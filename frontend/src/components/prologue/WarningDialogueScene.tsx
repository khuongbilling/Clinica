/**
 * WarningDialogueScene — Push 10 (phase reorder)
 *
 * Phase: warning_dialogue_scene
 *
 * Full-body donghua-style dialogue scene that plays AFTER the first tutorial
 * battle. Master Bai, Florence Nightingale, and Alexander Fleming warn the
 * Former Self not to rush. The Former Self ignores them and advances.
 *
 * Visual format (Bug 5 fix):
 *   – Each speaker has a large full-body illustration that slides/fades in
 *   – Active speaker is at full brightness; others are dimmed at the edges
 *   – Dialogue text appears in a large readable panel below the figure
 *   – The figure disappears when the next speaker takes over
 *   – Red trap-reveal overlay pulses on the final beats
 *
 * Former Self uses `former_self_portrait.png` consistently (Bug 1 fix).
 *
 * Dialogue content matches TacticalWarningScene (same narrative beats,
 * updated to reference that they just watched the Former Self fight).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
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

const { height: H } = Dimensions.get("window");

// ─── Art ─────────────────────────────────────────────────────────────────────

const ART = {
  battlefield: require("../../../assets/images/ward_corridor_battle.png"),
  masterBai:   require("../../../assets/images/master_bai.png"),
  nightingale: require("../../../assets/heroes/florence_nightingale.png"),
  fleming:     require("../../../assets/images/fleming_portrait.png"),
  prodigy:     require("../../../assets/images/former_self_portrait.png"),
} as const;

// ─── Speakers ─────────────────────────────────────────────────────────────────

type SpeakerId = "MASTER_BAI" | "NIGHTINGALE" | "FLEMING" | "PRODIGY";

const SPEAKERS: Record<SpeakerId, { label: string; color: string; art: any }> = {
  MASTER_BAI:  { label: "Master Bai",           color: "#D9A441", art: ART.masterBai   },
  NIGHTINGALE: { label: "Florence Nightingale",  color: "#E8C453", art: ART.nightingale },
  FLEMING:     { label: "Alexander Fleming",     color: "#3ECFB2", art: ART.fleming     },
  PRODIGY:     { label: "The Former Self",       color: "#E8354A", art: ART.prodigy     },
};

// ─── Beats ────────────────────────────────────────────────────────────────────

interface Beat {
  speaker:     SpeakerId;
  lines:       string[];
  stageDir?:   string;
  trapReveal?: boolean;
}

const BEATS: Beat[] = [
  {
    speaker:  "MASTER_BAI",
    lines:    ["That battle showed you the rhythm."],
    stageDir: "Master Bai studies the far end of the plaza — something in the fog does not move right.",
  },
  {
    speaker: "MASTER_BAI",
    lines: [
      "But something is wrong here. The enemy is allowing us to see only what it wants us to see.",
    ],
  },
  {
    speaker:  "PRODIGY",
    lines:    ["I have already cleared the visible threats. The ward is open."],
    stageDir: "The Former Self gestures broadly at the quieted battlefield.",
  },
  {
    speaker: "NIGHTINGALE",
    lines:   ["These injuries do not match the enemies in front of us."],
    stageDir: "Nightingale kneels beside a fallen indicator, raising her lamp.",
  },
  {
    speaker: "NIGHTINGALE",
    lines: [
      "The monitoring crystals failed before the first creature appeared.",
      "We are missing something important.",
    ],
  },
  {
    speaker:  "PRODIGY",
    lines:    ["Or you are searching for complexity where none exists."],
  },
  {
    speaker: "NIGHTINGALE",
    lines:   ["A patient does not become less endangered because the danger is difficult to see."],
  },
  {
    speaker:  "FLEMING",
    lines:    ["This corruption is adapting."],
    stageDir: "Fleming crouches, examining a glowing sample from the cracked floor tiles.",
  },
  {
    speaker: "FLEMING",
    lines: [
      "The organisms at the edge are already resistant to our first response.",
      "If we advance carelessly, we may strengthen what we are trying to eliminate.",
    ],
  },
  {
    speaker: "PRODIGY",
    lines:   ["I have defeated stronger enemies than this alone."],
  },
  {
    speaker: "FLEMING",
    lines:   ["Power used without proper selection can turn treatment into harm."],
  },
  {
    speaker:  "MASTER_BAI",
    lines:    ["Wait. Assess the field. The pattern is not complete."],
    stageDir: "Master Bai places a hand on the Former Self's shoulder.",
  },
  {
    speaker: "PRODIGY",
    lines: [
      "While we stand discussing possibilities, something is still spreading.",
    ],
    stageDir: "The Former Self steps forward.",
  },
  {
    speaker: "MASTER_BAI",
    lines:   ["That is why this enemy has chosen you."],
  },
  {
    speaker:     "PRODIGY",
    lines:       ["Watch carefully, Master.", "I will show you how quickly this can be ended."],
    stageDir:    "The Former Self advances alone. The fog at the far end begins to part — revealing the trap.",
    trapReveal:  true,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function WarningDialogueScene({ onComplete }: Props) {
  const [beatIdx,  setBeatIdx]  = useState(0);
  const [lineIdx,  setLineIdx]  = useState(0);

  const beatRef    = useRef(0);
  const lineRef    = useRef(0);
  const busyRef    = useRef(false);
  const mountedRef = useRef(true);
  const timers     = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Animations
  const bgFade     = useRef(new Animated.Value(0)).current;
  const bgScale    = useRef(new Animated.Value(1.04)).current;
  const redOverlay = useRef(new Animated.Value(0)).current;

  const figFade    = useRef(new Animated.Value(0)).current;
  const figSlide   = useRef(new Animated.Value(30)).current;
  const dlgFade    = useRef(new Animated.Value(0)).current;
  const stageDirFd = useRef(new Animated.Value(0)).current;

  const after = (ms: number, fn: () => void) => {
    const t = setTimeout(() => { if (mountedRef.current) fn(); }, ms);
    timers.current.push(t);
  };
  const fadeAnim = (val: Animated.Value, to: number, dur = 350) =>
    Animated.timing(val, { toValue: to, duration: dur, useNativeDriver: false }).start();

  // ── Boot ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgScale, { toValue: 1.0,  duration: 7000, useNativeDriver: false }),
        Animated.timing(bgScale, { toValue: 1.04, duration: 7000, useNativeDriver: false }),
      ])
    ).start();
    fadeAnim(bgFade, 1, 500);
    after(600, () => revealBeat(0));
    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Show beat ─────────────────────────────────────────────────────────────────

  const revealBeat = useCallback((idx: number) => {
    if (!mountedRef.current) return;
    beatRef.current = idx;
    lineRef.current = 0;
    setBeatIdx(idx);
    setLineIdx(0);

    const beat = BEATS[idx];

    // Red overlay for trap reveal
    if (beat.trapReveal) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(redOverlay, { toValue: 0.38, duration: 700, useNativeDriver: false }),
          Animated.timing(redOverlay, { toValue: 0.10, duration: 700, useNativeDriver: false }),
        ])
      ).start();
    }

    // Animate speaker figure in
    figFade.setValue(0);
    figSlide.setValue(30);
    dlgFade.setValue(0);
    stageDirFd.setValue(0);

    Animated.parallel([
      Animated.timing(figFade,  { toValue: 1, duration: 500, useNativeDriver: false }),
      Animated.timing(figSlide, { toValue: 0, duration: 500, useNativeDriver: false }),
    ]).start(() => {
      if (!mountedRef.current) return;
      if (beat.stageDir) fadeAnim(stageDirFd, 1, 400);
      after(200, () => fadeAnim(dlgFade, 1, 350));
    });
  }, [figFade, figSlide, dlgFade, stageDirFd, redOverlay]);

  // ── Advance ───────────────────────────────────────────────────────────────────

  const doAdvance = useCallback(() => {
    if (busyRef.current || !mountedRef.current) return;
    busyRef.current = true;

    const beat = BEATS[beatRef.current];
    const nextLine = lineRef.current + 1;

    if (nextLine < beat.lines.length) {
      // Reveal the next line in this beat
      lineRef.current = nextLine;
      setLineIdx(nextLine);
      after(100, () => { busyRef.current = false; });
      return;
    }

    // Advance to next beat
    const nextBeat = beatRef.current + 1;
    if (nextBeat >= BEATS.length) {
      // Done
      Animated.timing(figFade, { toValue: 0, duration: 350, useNativeDriver: false }).start(() => {
        after(200, () => {
          if (mountedRef.current) onComplete();
        });
      });
      return;
    }

    // Slide out current figure → reveal next
    Animated.parallel([
      Animated.timing(figFade, { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.timing(dlgFade, { toValue: 0, duration: 250, useNativeDriver: false }),
      Animated.timing(stageDirFd, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start(() => {
      if (!mountedRef.current) return;
      busyRef.current = false;
      revealBeat(nextBeat);
    });
  }, [figFade, dlgFade, stageDirFd, onComplete, revealBeat]);

  const beat       = BEATS[beatIdx];
  const speaker    = SPEAKERS[beat.speaker];
  const shownLines = beat.lines.slice(0, lineIdx + 1);

  return (
    <Pressable style={s.root} onPress={doAdvance}>
      {/* Battlefield BG */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgFade }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: bgScale }] }]}>
          <ExpoImage source={ART.battlefield} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
        {/* Dark vignette */}
        <LinearGradient
          colors={["rgba(0,0,0,0.60)", "rgba(4,8,14,0.92)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Trap-reveal red overlay */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: "#FF2020", opacity: redOverlay }]}
          pointerEvents="none"
        />
      </Animated.View>

      <SafeAreaView style={s.safe}>
        {/* Speaker figure — large, centered, full body */}
        <Animated.View
          style={[s.figureWrap, { opacity: figFade, transform: [{ translateY: figSlide }] }]}
          pointerEvents="none"
        >
          <ExpoImage source={speaker.art} style={s.figure} contentFit="contain" />
          {/* Color glow behind figure */}
          <View style={[s.figureGlow, { backgroundColor: `${speaker.color}20` }]} />
        </Animated.View>

        {/* Speaker label */}
        <Animated.View style={[s.speakerLabel, { opacity: dlgFade }]}>
          <View style={[s.speakerDot, { backgroundColor: speaker.color }]} />
          <Text style={[s.speakerName, { color: speaker.color }]}>{speaker.label}</Text>
        </Animated.View>

        {/* Stage direction */}
        {beat.stageDir != null && (
          <Animated.Text style={[s.stageDir, { opacity: stageDirFd }]} numberOfLines={2}>
            {beat.stageDir}
          </Animated.Text>
        )}

        {/* Dialogue panel */}
        <Animated.View style={[s.dlgPanel, { opacity: dlgFade, borderColor: `${speaker.color}30` }]}>
          {shownLines.map((line, i) => (
            <Text key={i} style={[s.dlgLine, i < shownLines.length - 1 && s.dlgLinePrev]}>
              {line}
            </Text>
          ))}
          <Text style={s.tapHint}>▸ TAP TO CONTINUE</Text>
        </Animated.View>
      </SafeAreaView>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#040810" },
  safe: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  figureWrap: {
    position: "absolute",
    top: "5%",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    height: H * 0.52,
  },
  figure: {
    width: 220,
    height: "100%",
  },
  figureGlow: {
    position: "absolute",
    width: 200,
    height: "90%",
    borderRadius: 100,
  },
  speakerLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  speakerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  speakerName: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  stageDir: {
    color: "rgba(160,180,200,0.45)",
    fontSize: 11,
    fontStyle: "italic",
    lineHeight: 16,
    textAlign: "left",
    alignSelf: "flex-start",
  },
  dlgPanel: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    backgroundColor: "rgba(4,10,20,0.88)",
    gap: 8,
  },
  dlgLine: {
    color: "#D0E0EC",
    fontSize: 16,
    fontWeight: "300",
    lineHeight: 26,
  },
  dlgLinePrev: {
    color: "#6A7A8A",
    fontSize: 14,
    lineHeight: 22,
  },
  tapHint: {
    color: "rgba(160,180,200,0.30)",
    fontSize: 9,
    letterSpacing: 2.5,
    alignSelf: "flex-end",
    marginTop: 4,
  },
});
