/**
 * ClinicaUniversityIntroduction — Push 10
 *
 * Final prologue phase: `clinica_university_introduction`.
 * Introduces the University as the player's first destination post-rebirth.
 *
 * Tone: hopeful, structured, welcoming — not a lecture. The player
 * understands why they're here and where to go first.
 *
 * Flow:
 *   Scene fades in with animated entry of all sections.
 *   Player taps "ENTER CLINICA UNIVERSITY" → onComplete() → hub.
 *
 * Art style: donghua luminous, warm teal-and-gold academic sanctuary feel.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { usePlayer } from "@/src/game/store";

// ─── Constants ───────────────────────────────────────────────────────────────

const { height: H } = Dimensions.get("window");

const DESTINATIONS = [
  {
    symbol: "☽",
    color:  "#E8C453",
    glow:   "rgba(232,196,83,0.16)",
    border: "rgba(232,196,83,0.30)",
    title:  "Lotus Lessons",
    sub:    "Start here.",
    desc:   "Short, focused learning sessions. Build the clinical foundation you need before applying it in the field.",
  },
  {
    symbol: "◈",
    color:  "#3ECFB2",
    glow:   "rgba(62,207,178,0.14)",
    border: "rgba(62,207,178,0.28)",
    title:  "Simulations",
    sub:    "Apply safely.",
    desc:   "Structured ward scenarios where errors are teachers, not consequences. The safe space between knowing and doing.",
  },
  {
    symbol: "◆",
    color:  "#A87DE0",
    glow:   "rgba(168,125,224,0.14)",
    border: "rgba(168,125,224,0.28)",
    title:  "Research Library",
    sub:    "Understand the systems.",
    desc:   "The Codex. Disease profiles, pharmacology, and pattern libraries. The deeper your understanding, the sharper your judgment.",
  },
  {
    symbol: "✦",
    color:  "#5A9FE8",
    glow:   "rgba(90,159,232,0.14)",
    border: "rgba(90,159,232,0.28)",
    title:  "Class Tree",
    sub:    "Find your role.",
    desc:   "Ward Guardian. Clinical Sage. Domain Warden. Harmony Weaver. Your path shapes how you heal, and who you become.",
  },
  {
    symbol: "⊕",
    color:  "#80E8A0",
    glow:   "rgba(128,232,160,0.14)",
    border: "rgba(128,232,160,0.28)",
    title:  "Ward Shift",
    sub:    "Where learning becomes practice.",
    desc:   "Once your foundation is set, take your first real shift. The ward needs healers who understand before they act.",
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function ClinicaUniversityIntroduction({ onComplete }: Props) {
  const { player } = usePlayer();
  const name = player?.name ?? "Healer";

  // ── Animations ────────────────────────────────────────────────────────────
  const rootFade     = useRef(new Animated.Value(0)).current;
  const headerFade   = useRef(new Animated.Value(0)).current;
  const headerSlide  = useRef(new Animated.Value(24)).current;
  const cardsFade    = useRef(new Animated.Value(0)).current;
  const footerFade   = useRef(new Animated.Value(0)).current;
  const shimmer      = useRef(new Animated.Value(0)).current;
  const closeFade    = useRef(new Animated.Value(0)).current;
  const mountedRef   = useRef(true);
  const timers       = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addTimer = (fn: () => void, ms: number) => {
    const t = setTimeout(() => { if (mountedRef.current) fn(); }, ms);
    timers.current.push(t);
  };

  useEffect(() => {
    mountedRef.current = true;

    // Shimmer loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 4000, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 4000, useNativeDriver: false }),
      ])
    ).start();

    // Entry sequence
    Animated.timing(rootFade, { toValue: 1, duration: 600, useNativeDriver: false }).start(() => {
      if (!mountedRef.current) return;
      Animated.parallel([
        Animated.timing(headerFade,  { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(headerSlide, { toValue: 0, duration: 700, useNativeDriver: false }),
      ]).start();
      addTimer(() => {
        Animated.timing(cardsFade, { toValue: 1, duration: 600, useNativeDriver: false }).start();
      }, 450);
      addTimer(() => {
        Animated.timing(footerFade, { toValue: 1, duration: 500, useNativeDriver: false }).start();
      }, 900);
    });

    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const handleEnter = useCallback(() => {
    Animated.timing(closeFade, { toValue: 1, duration: 600, useNativeDriver: false }).start(() => {
      if (mountedRef.current) {
        setTimeout(onComplete, 100);
      }
    });
  }, [closeFade, onComplete]);

  const shimmerOpac = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.28] });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: rootFade }]}>
        {/* Background */}
        <LinearGradient
          colors={["#050F18", "#030B14", "#060F1C"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Warm teal glow from top (university beacon) */}
        <View style={s.topGlow} pointerEvents="none" />

        {/* Ambient shimmer */}
        <Animated.View style={[s.shimmerBand, { opacity: shimmerOpac }]} pointerEvents="none">
          <LinearGradient
            colors={["rgba(62,207,178,0.10)", "rgba(232,196,83,0.05)", "transparent"]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </Animated.View>

        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
          >
            {/* ── University header ──────────────────────────────────── */}
            <Animated.View
              style={[s.header, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}
            >
              {/* University emblem */}
              <View style={s.emblem}>
                <Text style={s.emblemSymbol}>✚</Text>
                <View style={s.emblemRing} />
              </View>

              <Text style={s.universityLabel}>CLINICA UNIVERSITY</Text>
              <Text style={s.universityTagline}>Kingdom of Healing</Text>

              {/* Recall copy */}
              <View style={s.recallCard}>
                <Text style={s.recallLine}>
                  "{name}, you were not recalled because you were ready."
                </Text>
                <Text style={[s.recallLine, s.recallLineAccent]}>
                  "You were recalled because you can still learn."
                </Text>
                <Text style={[s.recallLine, s.recallLineSub]}>
                  Begin with Lotus Lessons.
                </Text>
              </View>
            </Animated.View>

            {/* ── Destination cards ─────────────────────────────────── */}
            <Animated.View style={[s.destinations, { opacity: cardsFade }]}>
              <Text style={s.destinationsLabel}>YOUR PATH FORWARD</Text>
              {DESTINATIONS.map((dest, i) => (
                <View
                  key={i}
                  style={[s.destCard, { borderColor: dest.border, backgroundColor: dest.glow }]}
                >
                  <View style={[s.destIcon, { borderColor: dest.border }]}>
                    <Text style={[s.destIconSym, { color: dest.color }]}>{dest.symbol}</Text>
                  </View>
                  <View style={s.destText}>
                    <View style={s.destTitleRow}>
                      <Text style={[s.destTitle, { color: dest.color }]}>{dest.title}</Text>
                      <Text style={[s.destSub, { color: `${dest.color}88` }]}>· {dest.sub}</Text>
                    </View>
                    <Text style={s.destDesc}>{dest.desc}</Text>
                  </View>
                </View>
              ))}
            </Animated.View>

            {/* ── Footer CTA ────────────────────────────────────────── */}
            <Animated.View style={[s.footer, { opacity: footerFade }]}>
              <Text style={s.footerNote}>
                The Kingdom grows as you learn.{"\n"}
                Every lesson opens a new door.
              </Text>
              <Pressable
                style={({ pressed }) => [s.enterBtn, pressed && { opacity: 0.82, transform: [{ scale: 0.97 }] }]}
                onPress={handleEnter}
              >
                <LinearGradient
                  colors={["#3ECFB2", "#2A9A85"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.enterBtnGradient}
                  pointerEvents="none"
                />
                <Text style={s.enterBtnText}>ENTER CLINICA UNIVERSITY</Text>
              </Pressable>
              <Text style={s.enterNote}>
                The prologue is complete. Your real journey begins.
              </Text>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>

      {/* Closing fade overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#050F18", opacity: closeFade }]}
        pointerEvents="none"
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050F18" },

  // ── Ambient ──
  topGlow: {
    position: "absolute",
    top: -80,
    left: "20%",
    right: "20%",
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(62,207,178,0.08)",
  },
  shimmerBand: {
    position: "absolute",
    top: 0, left: 0, right: 0, height: H * 0.5,
  },

  // ── Scroll ──
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 48,
    gap: 22,
  },

  // ── University header ──
  header: {
    alignItems: "center",
    gap: 10,
  },
  emblem: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  emblemSymbol: {
    fontSize: 34,
    color: "#3ECFB2",
    fontWeight: "700",
  },
  emblemRing: {
    position: "absolute",
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    borderColor: "rgba(62,207,178,0.40)",
  },
  universityLabel: {
    color: "#E0F4EE",
    fontSize: 22,
    fontWeight: "300",
    letterSpacing: 4,
    textAlign: "center",
  },
  universityTagline: {
    color: "rgba(62,207,178,0.55)",
    fontSize: 11,
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  recallCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(62,207,178,0.18)",
    borderRadius: 16,
    backgroundColor: "rgba(4,14,24,0.80)",
    padding: 18,
    gap: 8,
  },
  recallLine: {
    color: "#B0C8DC",
    fontSize: 15,
    fontWeight: "300",
    fontStyle: "italic",
    lineHeight: 24,
    textAlign: "center",
  },
  recallLineAccent: {
    color: "#D8ECE4",
    fontWeight: "400",
  },
  recallLineSub: {
    color: "#E8C453",
    fontStyle: "normal",
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 4,
  },

  // ── Destinations ──
  destinations: {
    gap: 10,
  },
  destinationsLabel: {
    color: "rgba(160,180,200,0.40)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 3,
    textAlign: "center",
    marginBottom: 4,
  },
  destCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  destIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(4,14,24,0.60)",
    flexShrink: 0,
  },
  destIconSym: {
    fontSize: 20,
  },
  destText: {
    flex: 1,
    gap: 4,
  },
  destTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    flexWrap: "wrap",
  },
  destTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  destSub: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  destDesc: {
    color: "#6A7A8A",
    fontSize: 12,
    lineHeight: 18,
  },

  // ── Footer ──
  footer: {
    alignItems: "center",
    gap: 14,
    paddingTop: 4,
  },
  footerNote: {
    color: "#4A6070",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 22,
    fontStyle: "italic",
  },
  enterBtn: {
    width: "100%",
    height: 56,
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3ECFB2",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  enterBtnGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  enterBtnText: {
    color: "#030C10",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2.5,
  },
  enterNote: {
    color: "rgba(160,180,200,0.35)",
    fontSize: 11,
    textAlign: "center",
    letterSpacing: 0.5,
  },
});
