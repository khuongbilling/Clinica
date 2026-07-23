/**
 * PrologueBossGate
 *
 * Phase: scripted_defeat
 *
 * Transition screen before the scripted-loss Silent Infarct boss battle.
 * Visual style follows PrologueTutorialGate (animated dots, kicker, heading,
 * sub-text, instructor footer) — updated for the 3-hero legendary team:
 *   Florence Nightingale · Alexander Fleming · The Former Self
 *
 * Fleming's "Reassess" skill is explicitly referenced so the player knows
 * this battle features the full Scout → Stabilize → Counter → Reassess chain.
 *
 * The battle is narratively scripted to end in defeat (isPrologueBoss path
 * in battle.tsx forces loss at turn 6 then routes to lotus_recall_cinematic).
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

export default function PrologueBossGate() {
  const router  = useRouter();
  const mounted = useRef(true);
  const fade    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    mounted.current = true;

    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: false }).start(() => {
      const t = setTimeout(() => {
        if (mounted.current) {
          router.replace({
            pathname: "/battle",
            params: {
              enemyId: "silent_infarct",
              prologue: "boss",
            },
          } as Parameters<typeof router.replace>[0]);
        }
      }, 1200);
      return () => clearTimeout(t);
    });

    return () => { mounted.current = false; };
  }, [router]);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={["#040810", "#08101E"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <Animated.View style={[s.content, { opacity: fade }]}>
        {/* Animated dot trio — teal centre dot signals active ward */}
        <View style={s.dotsRow}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[s.dot, i === 1 && { backgroundColor: "#C44" }]} />
          ))}
        </View>

        <Text style={s.kicker}>CLINICA UNIVERSITY  ·  SCRIPTED DEFEAT</Text>

        <Text style={s.heading}>The Last Shift</Text>

        <Text style={s.sub}>
          Florence Nightingale, Alexander Fleming and The Prodigy stand with you.{"\n"}
          Scout. Stabilize. Counter. Reassess.
        </Text>

        <Text style={s.instructor}>THE SILENT INFARCTION cannot be defeated — only understood.</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex:               1,
    backgroundColor:    "#040810",
    alignItems:         "center",
    justifyContent:     "center",
    gap:                18,
    paddingHorizontal:  32,
  },
  content: {
    alignItems: "center",
    gap:        14,
  },
  dotsRow: {
    flexDirection: "row",
    gap:           8,
    marginBottom:  8,
  },
  dot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: "rgba(204,68,68,0.35)",
  },
  kicker: {
    color:         "rgba(204,68,68,0.45)",
    fontSize:      9,
    fontWeight:    "700",
    letterSpacing: 3,
    textAlign:     "center",
  },
  heading: {
    color:         "#D8ECF4",
    fontSize:      26,
    fontWeight:    "300",
    letterSpacing: 3,
    textAlign:     "center",
  },
  sub: {
    color:      "#5A7A8A",
    fontSize:   13,
    lineHeight: 22,
    textAlign:  "center",
    fontStyle:  "italic",
  },
  instructor: {
    color:         "rgba(204,100,100,0.55)",
    fontSize:      11,
    fontWeight:    "700",
    letterSpacing: 1.6,
    marginTop:     8,
    textAlign:     "center",
  },
});
