/**
 * FormerSelfIntroScene — Push 10 (phase reorder)
 *
 * Phase: former_self_battlefield_cutscene
 *
 * A brief cinematic that establishes the Former Self as a high-level legendary
 * healer at the height of their power, BEFORE the first tutorial battle begins.
 * This is intentionally short — just enough to show who they were.
 *
 * The Former Self uses `former_self_portrait.png` throughout for visual
 * consistency (no alternate art).
 *
 * Flow:
 *   ward_title  — (auto 1.8 s) ward establishing title fades in
 *   self_entry  — (auto 1.5 s) Former Self materialises with power glows
 *   speak_1     — (tap) "This ward has never held a threat I could not defeat."
 *   speak_2     — (tap) "Nightingale. Fleming. Hold the line with me."
 *   battle_call — (auto 1.2 s) "A shift begins." → onComplete()
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

import { usePlayer } from "@/src/game/store";

const { width: W, height: H } = Dimensions.get("window");

const ART = {
  battlefield: require("../../../assets/images/tactical_battlefield.png"),
  formerSelf:  require("../../../assets/images/former_self_portrait.png"),
  nightingale: require("../../../assets/images/nightingale_portrait.png"),
  fleming:     require("../../../assets/images/fleming_portrait.png"),
  masterBai:   require("../../../assets/images/master_bai.png"),
} as const;

type Stage = "ward_title" | "self_entry" | "speak_1" | "speak_2" | "battle_call";

interface Props {
  onComplete: () => void;
}

export default function FormerSelfIntroScene({ onComplete }: Props) {
  const { player } = usePlayer();
  const [stage, setStage] = useState<Stage>("ward_title");
  const stageRef  = useRef<Stage>("ward_title");
  const mountedRef = useRef(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Animated values
  const bgFade     = useRef(new Animated.Value(0)).current;
  const bgScale    = useRef(new Animated.Value(1.04)).current;
  const titleFade  = useRef(new Animated.Value(0)).current;
  const selfFade   = useRef(new Animated.Value(0)).current;
  const selfSlide  = useRef(new Animated.Value(40)).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;
  const dlgFade    = useRef(new Animated.Value(0)).current;
  const rankFade   = useRef(new Animated.Value(0)).current;
  const sideFade   = useRef(new Animated.Value(0)).current;
  const callFade   = useRef(new Animated.Value(0)).current;
  const closeFade  = useRef(new Animated.Value(0)).current;

  const after = (ms: number, fn: () => void) => {
    const t = setTimeout(() => { if (mountedRef.current) fn(); }, ms);
    timers.current.push(t);
  };
  const fade = (val: Animated.Value, to: number, dur: number, cb?: () => void) =>
    Animated.timing(val, { toValue: to, duration: dur, useNativeDriver: false }).start(cb ?? (() => {}));

  useEffect(() => {
    mountedRef.current = true;

    // BG slow zoom
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgScale, { toValue: 1.0, duration: 7000, useNativeDriver: false }),
        Animated.timing(bgScale, { toValue: 1.04, duration: 7000, useNativeDriver: false }),
      ])
    ).start();

    // Red/crimson power glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1800, useNativeDriver: false }),
      ])
    ).start();

    // Stage 1 — ward title
    fade(bgFade, 1, 700, () => {
      fade(titleFade, 1, 600);
      after(1800, () => {
        fade(titleFade, 0, 400, () => {
          stageRef.current = "self_entry";
          setStage("self_entry");
          // Former Self enters
          Animated.parallel([
            Animated.timing(selfFade,  { toValue: 1, duration: 650, useNativeDriver: false }),
            Animated.timing(selfSlide, { toValue: 0, duration: 650, useNativeDriver: false }),
          ]).start(() => {
            fade(rankFade, 1, 400);
            after(1500, () => {
              stageRef.current = "speak_1";
              setStage("speak_1");
              fade(dlgFade, 1, 400);
            });
          });
        });
      });
    });

    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = useCallback(() => {
    const s = stageRef.current;
    if (s === "speak_1") {
      fade(dlgFade, 0, 200, () => {
        stageRef.current = "speak_2";
        setStage("speak_2");
        fade(dlgFade, 1, 350);
        // Show Nightingale + Fleming side portraits
        fade(sideFade, 1, 500);
      });
      return;
    }
    if (s === "speak_2") {
      stageRef.current = "battle_call";
      setStage("battle_call");
      fade(dlgFade, 0, 250);
      fade(selfFade, 0, 400);
      fade(sideFade, 0, 300);
      fade(callFade, 1, 600, () => {
        after(1200, () => {
          fade(closeFade, 1, 500, () => {
            after(100, onComplete);
          });
        });
      });
    }
  }, [onComplete]);

  const isTappable = stage === "speak_1" || stage === "speak_2";
  const glowOpac = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.40] });

  const dlgLines: Record<Stage, string> = {
    ward_title:   "",
    self_entry:   "",
    speak_1:      '"This ward has never held a threat I could not defeat."',
    speak_2:      '"Nightingale. Fleming. Hold the line with me."',
    battle_call:  "",
  };

  return (
    <Pressable style={s.root} onPress={isTappable ? handleTap : undefined}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgFade }]}>
        {/* Battlefield background */}
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: bgScale }] }]}>
          <ExpoImage source={ART.battlefield} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>

        {/* Dark overlay */}
        <LinearGradient
          colors={["rgba(0,0,0,0.72)", "rgba(4,8,14,0.88)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Crimson power glow behind Former Self */}
        <Animated.View style={[s.powerGlow, { opacity: glowOpac }]} pointerEvents="none" />

        <SafeAreaView style={s.safe}>
          {/* Ward title card */}
          <Animated.View style={[s.titleCard, { opacity: titleFade }]}>
            <Text style={s.titleKicker}>CLINICA — EMERGENCY TREATMENT PLAZA</Text>
            <Text style={s.titleMain}>WARD SHIFT</Text>
            <Text style={s.titleSub}>The Former Self. Mythic Clinician. Peak of power.</Text>
          </Animated.View>

          {/* Former Self figure */}
          <Animated.View style={[s.selfWrap, { opacity: selfFade, transform: [{ translateY: selfSlide }] }]}>
            <ExpoImage source={ART.formerSelf} style={s.selfPortrait} contentFit="contain" />

            {/* Rank badge */}
            <Animated.View style={[s.rankBadge, { opacity: rankFade }]}>
              <Text style={s.rankBadgeText}>✦ RANK: MYTHIC CLINICIAN ✦</Text>
              <Text style={s.rankBadgeSub}>The Former Self  ·  Ward Champion</Text>
            </Animated.View>
          </Animated.View>

          {/* Side heroes (appear at speak_2) */}
          <Animated.View style={[s.sideHeroes, { opacity: sideFade }]} pointerEvents="none">
            <View style={s.sideHeroCard}>
              <ExpoImage source={ART.nightingale} style={s.sidePortrait} contentFit="contain" />
              <Text style={[s.sideName, { color: "#E8C453" }]}>NIGHTINGALE</Text>
            </View>
            <View style={s.sideHeroCard}>
              <ExpoImage source={ART.fleming} style={s.sidePortrait} contentFit="contain" />
              <Text style={[s.sideName, { color: "#3ECFB2" }]}>FLEMING</Text>
            </View>
          </Animated.View>

          {/* Dialogue */}
          {(stage === "speak_1" || stage === "speak_2") && (
            <Animated.View style={[s.dlgBox, { opacity: dlgFade }]}>
              <Text style={s.dlgSpeaker}>The Former Self</Text>
              <Text style={s.dlgText}>{dlgLines[stage]}</Text>
              <Text style={s.tapHint}>▸ TAP TO CONTINUE</Text>
            </Animated.View>
          )}

          {/* Battle call */}
          {stage === "battle_call" && (
            <Animated.View style={[s.battleCall, { opacity: callFade }]}>
              <Text style={s.battleCallKicker}>ENTERING THE WARD</Text>
              <Text style={s.battleCallMain}>A shift begins.</Text>
              <Text style={s.battleCallSub}>Scout. Stabilize. Counter. Reassess.</Text>
            </Animated.View>
          )}
        </SafeAreaView>
      </Animated.View>

      {/* Closing overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#040810", opacity: closeFade }]}
        pointerEvents="none"
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#040810" },
  safe: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  powerGlow: {
    position: "absolute",
    top: "20%",
    left: "20%",
    right: "20%",
    bottom: "10%",
    borderRadius: 200,
    backgroundColor: "rgba(224,60,60,0.25)",
  },
  titleCard: {
    alignItems: "center",
    gap: 6,
    position: "absolute",
    top: "30%",
  },
  titleKicker: {
    color: "rgba(200,160,160,0.50)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 3,
  },
  titleMain: {
    color: "#E8354A",
    fontSize: 32,
    fontWeight: "300",
    letterSpacing: 8,
  },
  titleSub: {
    color: "rgba(200,150,150,0.55)",
    fontSize: 12,
    letterSpacing: 1.5,
  },
  selfWrap: {
    alignItems: "center",
    gap: 12,
  },
  selfPortrait: {
    width: 180,
    height: 240,
  },
  rankBadge: {
    borderWidth: 1,
    borderColor: "rgba(232,53,74,0.45)",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(4,8,14,0.75)",
  },
  rankBadgeText: {
    color: "#E8354A",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  rankBadgeSub: {
    color: "rgba(200,150,150,0.55)",
    fontSize: 10,
    letterSpacing: 1,
  },
  sideHeroes: {
    flexDirection: "row",
    gap: 32,
    position: "absolute",
    bottom: 180,
  },
  sideHeroCard: {
    alignItems: "center",
    gap: 4,
  },
  sidePortrait: {
    width: 56,
    height: 72,
    opacity: 0.75,
  },
  sideName: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  dlgBox: {
    position: "absolute",
    bottom: 100,
    left: 24,
    right: 24,
    borderWidth: 1,
    borderColor: "rgba(232,53,74,0.35)",
    borderRadius: 14,
    padding: 16,
    backgroundColor: "rgba(4,8,14,0.88)",
    gap: 6,
  },
  dlgSpeaker: {
    color: "#E8354A",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  dlgText: {
    color: "#D8E0E8",
    fontSize: 15,
    fontWeight: "300",
    fontStyle: "italic",
    lineHeight: 24,
  },
  tapHint: {
    color: "rgba(160,180,200,0.35)",
    fontSize: 9,
    letterSpacing: 2.5,
    alignSelf: "flex-end",
    marginTop: 2,
  },
  battleCall: {
    position: "absolute",
    alignItems: "center",
    gap: 8,
  },
  battleCallKicker: {
    color: "rgba(160,180,200,0.40)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 4,
  },
  battleCallMain: {
    color: "#E8C090",
    fontSize: 26,
    fontWeight: "300",
    letterSpacing: 4,
  },
  battleCallSub: {
    color: "rgba(160,180,200,0.50)",
    fontSize: 12,
    letterSpacing: 1.5,
  },
});
