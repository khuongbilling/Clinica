/**
 * PrologueTutorialGate — Push 10 (phase reorder)
 *
 * Phase: opening_battle_tutorial
 *
 * A thin gate component that navigates to the real guided ward tutorial battle
 * (dehydration_specter / prologueBattle tutorial) on mount.
 *
 * The loaner team for this battle is Florence Nightingale + Alexander Fleming
 * + The Prodigy (configured in battle.tsx via the isPrologueTutorial flag).
 *
 * When the player wins the tutorial, result.tsx advances the prologue phase to
 * `former_self_victory_boast` and routes back to /opening-prologue.
 *
 * This component shows a brief transition screen while the navigation fires.
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

export default function PrologueTutorialGate() {
  const router = useRouter();
  const mounted = useRef(true);
  const fade    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    mounted.current = true;

    // Fade in the transition screen, then navigate
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: false }).start(() => {
      const t = setTimeout(() => {
        if (mounted.current) {
          router.replace({
            pathname: "/battle",
            params: {
              enemyId: "dehydration_specter",
              training: "1",
              prologue: "tutorial",
            },
          } as Parameters<typeof router.replace>[0]);
        }
      }, 900);
      return () => clearTimeout(t);
    });

    return () => { mounted.current = false; };
  }, [router]);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={["#040810", "#060F1C"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Animated.View style={[s.content, { opacity: fade }]}>
        {/* Animated dots */}
        <View style={s.dotsRow}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[s.dot, i === 1 && { backgroundColor: "#4FD8C4" }]} />
          ))}
        </View>
        <Text style={s.kicker}>CLINICA UNIVERSITY  ·  FIRST SHIFT</Text>
        <Text style={s.heading}>The Ward Awaits</Text>
        <Text style={s.sub}>
          Nightingale, Fleming, and The Prodigy stand with you.{"\n"}
          Assess. Stabilize. Treat. Reassess.
        </Text>
        <Text style={s.instructor}>MASTER BAI will guide you.</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#040810",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 32,
  },
  content: {
    alignItems: "center",
    gap: 14,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(79,216,196,0.35)",
  },
  kicker: {
    color: "rgba(79,216,196,0.40)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 3,
    textAlign: "center",
  },
  heading: {
    color: "#D8ECF4",
    fontSize: 26,
    fontWeight: "300",
    letterSpacing: 3,
    textAlign: "center",
  },
  sub: {
    color: "#5A7A8A",
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
    fontStyle: "italic",
  },
  instructor: {
    color: "rgba(217,164,65,0.55)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: 8,
  },
});
