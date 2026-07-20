/**
 * FormerSelfVictoryCutscene — Push 11
 *
 * Phase: former_self_victory_boast
 *
 * A short overconfidence scene that plays immediately after the Former Self's
 * intro on the battlefield. The shift ends "too easily." The Former Self
 * dismisses every warning sign — the team grows visibly uneasy.
 *
 * Narrative beat:
 *   beat_1  — (auto 1.6 s) Victory glow; Former Self turns away from the field
 *   beat_2  — (tap) "Child's play. The ward hasn't seen a real challenge since my last shift."
 *   beat_3  — (tap) Nightingale: "...Something in the monitoring crystals feels wrong."
 *   beat_4  — (tap) "Then find it. That's what you're here for."
 *   beat_5  — (auto 1.2 s) Master Bai watches. Silence. → onComplete()
 *
 * Background: ward_corridor_battle.png (same battlefield backdrop as FormerSelfIntroScene).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

const ART = {
  battlefield: require("../../../assets/images/ward_corridor_battle.png"),
  formerSelf:  require("../../../assets/images/the_prodigy_vn.png"),
  nightingale: require("../../../assets/images/nightingale_vn.png"),
  masterBai:   require("../../../assets/images/master_bai_nobg.png"),
} as const;

type Beat = "beat_1" | "beat_2" | "beat_3" | "beat_4" | "beat_5";

interface Props {
  onComplete: () => void;
}

export default function FormerSelfVictoryCutscene({ onComplete }: Props) {
  const [beat, setBeat]   = useState<Beat>("beat_1");
  const beatRef           = useRef<Beat>("beat_1");
  const mountedRef        = useRef(true);
  const timers            = useRef<ReturnType<typeof setTimeout>[]>([]);

  const bgFade    = useRef(new Animated.Value(0)).current;
  const bgScale   = useRef(new Animated.Value(1.04)).current;
  const victoryGlow = useRef(new Animated.Value(0)).current;
  const selfFade  = useRef(new Animated.Value(0)).current;
  const dlgFade   = useRef(new Animated.Value(0)).current;
  const baiWarn   = useRef(new Animated.Value(0)).current;
  const closeFade = useRef(new Animated.Value(0)).current;

  const after = (ms: number, fn: () => void) => {
    const t = setTimeout(() => { if (mountedRef.current) fn(); }, ms);
    timers.current.push(t);
  };
  const fadeIn = (v: Animated.Value, dur: number, cb?: () => void) =>
    Animated.timing(v, { toValue: 1, duration: dur, useNativeDriver: false }).start(cb ?? (() => {}));
  const fadeOut = (v: Animated.Value, dur: number, cb?: () => void) =>
    Animated.timing(v, { toValue: 0, duration: dur, useNativeDriver: false }).start(cb ?? (() => {}));

  useEffect(() => {
    mountedRef.current = true;

    Animated.loop(
      Animated.sequence([
        Animated.timing(bgScale, { toValue: 1.0, duration: 8000, useNativeDriver: false }),
        Animated.timing(bgScale, { toValue: 1.04, duration: 8000, useNativeDriver: false }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(victoryGlow, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(victoryGlow, { toValue: 0.3, duration: 2000, useNativeDriver: false }),
      ])
    ).start();

    fadeIn(bgFade, 800, () => {
      fadeIn(selfFade, 600);
      after(1600, () => {
        beatRef.current = "beat_2";
        setBeat("beat_2");
        fadeIn(dlgFade, 350);
      });
    });

    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = useCallback(() => {
    const b = beatRef.current;
    if (b === "beat_2") {
      fadeOut(dlgFade, 200, () => {
        beatRef.current = "beat_3";
        setBeat("beat_3");
        fadeIn(dlgFade, 350);
        fadeIn(baiWarn, 500);
      });
      return;
    }
    if (b === "beat_3") {
      fadeOut(dlgFade, 200, () => {
        beatRef.current = "beat_4";
        setBeat("beat_4");
        fadeIn(dlgFade, 350);
      });
      return;
    }
    if (b === "beat_4") {
      beatRef.current = "beat_5";
      setBeat("beat_5");
      fadeOut(dlgFade, 300);
      after(1200, () => {
        fadeIn(closeFade, 600, () => {
          after(80, onComplete);
        });
      });
    }
  }, [onComplete]);

  const isTappable = beat === "beat_2" || beat === "beat_3" || beat === "beat_4";

  const glowOpac = victoryGlow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.28] });

  const LINES: Record<Beat, { speaker: string; speakerColor: string; text: string } | null> = {
    beat_1: null,
    beat_2: {
      speaker: "The Former Self",
      speakerColor: "#E8354A",
      text: '"Child\'s play. The ward hasn\'t seen a real challenge since my last shift."',
    },
    beat_3: {
      speaker: "Florence Nightingale",
      speakerColor: "#E8C453",
      text: '"...Something in the monitoring crystals feels wrong. The pattern is off."',
    },
    beat_4: {
      speaker: "The Former Self",
      speakerColor: "#E8354A",
      text: '"Then find it. That\'s what you\'re here for."',
    },
    beat_5: null,
  };

  const line = LINES[beat];

  return (
    <Pressable style={s.root} onPress={isTappable ? handleTap : undefined}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgFade }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: bgScale }] }]}>
          <ExpoImage source={ART.battlefield} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>

        <LinearGradient
          colors={["rgba(0,0,0,0.68)", "rgba(4,8,14,0.90)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <Animated.View style={[s.victoryGlow, { opacity: glowOpac }]} pointerEvents="none" />

        <SafeAreaView style={s.safe}>
          <Animated.View style={[s.selfWrap, { opacity: selfFade }]}>
            <ExpoImage source={ART.formerSelf} style={s.selfPortrait} contentFit="contain" />
          </Animated.View>

          <Animated.View style={[s.baiWarn, { opacity: baiWarn }]} pointerEvents="none">
            <ExpoImage source={ART.masterBai} style={s.baiPortrait} contentFit="contain" />
            <Text style={s.baiLabel}>Master Bai watches in silence.</Text>
          </Animated.View>

          <Animated.View style={[s.nightingaleWrap, { opacity: baiWarn }]} pointerEvents="none">
            <ExpoImage source={ART.nightingale} style={s.nightingalePortrait} contentFit="contain" />
          </Animated.View>

          {line && (
            <Animated.View style={[s.dlgBox, { opacity: dlgFade }]}>
              <Text style={[s.dlgSpeaker, { color: line.speakerColor }]}>{line.speaker}</Text>
              <Text style={s.dlgText}>{line.text}</Text>
              {isTappable && <Text style={s.tapHint}>▸ TAP TO CONTINUE</Text>}
            </Animated.View>
          )}

          {beat === "beat_5" && (
            <View style={s.silenceWrap} pointerEvents="none">
              <Text style={s.silenceText}>The ward grows quiet.</Text>
              <Text style={s.silenceSub}>The Former Self does not look back.</Text>
            </View>
          )}
        </SafeAreaView>
      </Animated.View>

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
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  victoryGlow: {
    position: "absolute",
    top: "15%",
    left: "15%",
    right: "15%",
    bottom: "10%",
    borderRadius: 240,
    backgroundColor: "rgba(232,53,74,0.3)",
  },
  selfWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  selfPortrait: {
    width: 200,
    height: 260,
  },
  baiWarn: {
    position: "absolute",
    right: 24,
    bottom: 200,
    alignItems: "center",
    gap: 6,
  },
  baiPortrait: {
    width: 52,
    height: 68,
    opacity: 0.65,
  },
  baiLabel: {
    color: "rgba(200,180,140,0.45)",
    fontSize: 8,
    letterSpacing: 1,
    textAlign: "center",
    maxWidth: 72,
  },
  nightingaleWrap: {
    position: "absolute",
    left: 24,
    bottom: 200,
  },
  nightingalePortrait: {
    width: 48,
    height: 64,
    opacity: 0.55,
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
    backgroundColor: "rgba(4,8,14,0.90)",
    gap: 6,
  },
  dlgSpeaker: {
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
  silenceWrap: {
    position: "absolute",
    alignItems: "center",
    gap: 6,
  },
  silenceText: {
    color: "rgba(200,180,140,0.50)",
    fontSize: 14,
    fontWeight: "300",
    letterSpacing: 2,
  },
  silenceSub: {
    color: "rgba(160,140,120,0.35)",
    fontSize: 11,
    letterSpacing: 1.5,
  },
});
