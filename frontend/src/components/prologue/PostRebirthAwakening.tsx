/**
 * PostRebirthAwakening — Push 9
 *
 * Cinematic for the `post_rebirth_awakening` prologue phase.
 * Plays immediately after identity_reconstruction_character_creation.
 *
 * Scene: Lotus Recovery Chamber (mystical recovery room meets lotus garden).
 *
 * Flow:
 *   awakening  — (auto 2.5 s) player name + Level 1 materialise
 *   system     — 5 system-terminal messages, tap each to accumulate
 *   flicker    — (auto 2.5 s) failed power attempt + player question appears
 *   bai_1      — Master Bai projection: "Power is what brought you here."
 *   bai_2      — (tap) "This time, we will begin with understanding."
 *   closing    — (auto 1.8 s) enrollment confirmed → fade → onComplete()
 *
 * Visual style: donghua luminous, soft teal-amber-lotus palette.
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
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { usePlayer } from "@/src/game/store";

// ─── Constants ───────────────────────────────────────────────────────────────

const { width: W, height: H } = Dimensions.get("window");

const APTITUDE_META: Record<string, { name: string; symbol: string; color: string; glow: string }> = {
  guardian: { name: "Ward Guardian",    symbol: "◈", color: "#5A9FE8", glow: "rgba(90,159,232,0.22)"  },
  sage:     { name: "Clinical Sage",    symbol: "◆", color: "#A87DE0", glow: "rgba(168,125,224,0.22)" },
  warden:   { name: "Domain Warden",    symbol: "✦", color: "#3ECFB2", glow: "rgba(62,207,178,0.22)"  },
  weaver:   { name: "Harmony Weaver",   symbol: "✿", color: "#E8C453", glow: "rgba(232,196,83,0.22)"  },
};

const SYSTEM_MESSAGES = [
  { label: "STATUS",     text: "Identity reconstruction complete.",     ok: true  },
  { label: "RANK",       text: "Previous rank: Unavailable.",           ok: false },
  { label: "ABILITIES",  text: "Previous abilities: Sealed.",           ok: false },
  { label: "ASSESSMENT", text: "Clinical judgment assessment: Incomplete.", ok: false },
  { label: "RECOMMEND",  text: "Enrollment recommendation: Clinica University.", ok: true },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Ambient lotus petal (purely decorative, no animation overhead). */
function Petal({ top, left, rotate, opacity }: {
  top: number; left: number; rotate: string; opacity: number;
}) {
  return (
    <View
      style={[s.petal, { top, left, opacity, transform: [{ rotate }] }]}
      pointerEvents="none"
    />
  );
}

/** Glyph medical/healing symbol scattered in background. */
function AmbientGlyph({ top, left, sym, color }: {
  top: number | string; left: number | string; sym: string; color: string;
}) {
  return (
    <Text style={[s.glyph, { top: top as any, left: left as any, color }]} pointerEvents="none">
      {sym}
    </Text>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

type InnerPhase = "awakening" | "system" | "flicker" | "bai_1" | "bai_2" | "closing";

interface Props {
  onComplete: () => void;
}

export default function PostRebirthAwakening({ onComplete }: Props) {
  const { player } = usePlayer();

  const name      = player?.name      ?? "Healer";
  const pronouns  = player?.pronouns  ?? null;
  const aptitudeKey = (player?.aptitude as string) ?? "warden";
  const apt       = APTITUDE_META[aptitudeKey] ?? APTITUDE_META.warden;

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase,     setPhase]     = useState<InnerPhase>("awakening");
  const [sysCount,  setSysCount]  = useState(0);   // how many system msgs revealed

  // ── Animations ────────────────────────────────────────────────────────────
  const rootFade      = useRef(new Animated.Value(0)).current;
  const nameFade      = useRef(new Animated.Value(0)).current;
  const nameSlide     = useRef(new Animated.Value(20)).current;
  const levelFade     = useRef(new Animated.Value(0)).current;
  const sysPanel      = useRef(new Animated.Value(0)).current;
  const flickerScale  = useRef(new Animated.Value(0)).current;
  const flickerOpac   = useRef(new Animated.Value(0)).current;
  const questionFade  = useRef(new Animated.Value(0)).current;
  const baiPanel      = useRef(new Animated.Value(0)).current;
  const baiText2Fade  = useRef(new Animated.Value(0)).current;
  const closingGlow   = useRef(new Animated.Value(0)).current;
  const closingFade   = useRef(new Animated.Value(0)).current;
  const shimmer       = useRef(new Animated.Value(0)).current;
  const petalDrift    = useRef(new Animated.Value(0)).current;

  const mountedRef = useRef(true);
  const timers     = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addTimer = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => { if (mountedRef.current) fn(); }, ms);
    timers.current.push(t);
  }, []);

  // ── Ambient loops ─────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer,    { toValue: 1, duration: 3500, useNativeDriver: false }),
        Animated.timing(shimmer,    { toValue: 0, duration: 3500, useNativeDriver: false }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(petalDrift, { toValue: 1, duration: 6000, useNativeDriver: false }),
        Animated.timing(petalDrift, { toValue: 0, duration: 6000, useNativeDriver: false }),
      ])
    ).start();

    // ── Phase: awakening ────────────────────────────────────────────────────
    // Fade in scene → name materialises → level reveals → auto-advance
    Animated.timing(rootFade, {
      toValue: 1, duration: 800, useNativeDriver: false,
    }).start(() => {
      if (!mountedRef.current) return;
      Animated.parallel([
        Animated.timing(nameFade,  { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(nameSlide, { toValue: 0, duration: 700, useNativeDriver: false }),
      ]).start(() => {
        if (!mountedRef.current) return;
        addTimer(() => {
          Animated.timing(levelFade, { toValue: 1, duration: 500, useNativeDriver: false }).start();
        }, 300);
        addTimer(() => {
          Animated.timing(sysPanel, { toValue: 1, duration: 400, useNativeDriver: false }).start();
          setPhase("system");
        }, 2200);
      });
    });

    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // ── Flicker sequence (triggered when phase changes to "flicker") ──────────
  useEffect(() => {
    if (phase !== "flicker") return;
    // Aura pulse animation: quick surge → decay → faint ember
    Animated.sequence([
      Animated.parallel([
        Animated.timing(flickerScale, { toValue: 1.8, duration: 350, useNativeDriver: false }),
        Animated.timing(flickerOpac,  { toValue: 1.0, duration: 350, useNativeDriver: false }),
      ]),
      Animated.parallel([
        Animated.timing(flickerScale, { toValue: 1.2, duration: 280, useNativeDriver: false }),
        Animated.timing(flickerOpac,  { toValue: 0.35, duration: 280, useNativeDriver: false }),
      ]),
      Animated.parallel([
        Animated.timing(flickerScale, { toValue: 1.55, duration: 300, useNativeDriver: false }),
        Animated.timing(flickerOpac,  { toValue: 0.65, duration: 300, useNativeDriver: false }),
      ]),
      Animated.parallel([
        Animated.timing(flickerScale, { toValue: 0.4, duration: 800, useNativeDriver: false }),
        Animated.timing(flickerOpac,  { toValue: 0.08, duration: 800, useNativeDriver: false }),
      ]),
    ]).start(() => {
      if (!mountedRef.current) return;
      // Player's question fades in after the failed attempt
      Animated.timing(questionFade, { toValue: 1, duration: 500, useNativeDriver: false }).start();
      addTimer(() => {
        Animated.timing(baiPanel, { toValue: 1, duration: 500, useNativeDriver: false }).start();
        setPhase("bai_1");
      }, 1400);
    });
  }, [phase]);

  // ── Closing sequence ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "closing") return;
    Animated.sequence([
      Animated.timing(closingGlow, { toValue: 1, duration: 600, useNativeDriver: false }),
      Animated.delay(1000),
      Animated.timing(closingFade, { toValue: 1, duration: 900, useNativeDriver: false }),
    ]).start(() => {
      addTimer(onComplete, 200);
    });
  }, [phase]);

  // ── Tap handler ───────────────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (phase === "system") {
      const next = sysCount + 1;
      if (next < SYSTEM_MESSAGES.length) {
        setSysCount(next);
      } else {
        // All 5 shown — start flicker
        setPhase("flicker");
      }
      return;
    }

    if (phase === "bai_1") {
      Animated.timing(baiText2Fade, { toValue: 1, duration: 400, useNativeDriver: false }).start();
      setPhase("bai_2");
      return;
    }

    if (phase === "bai_2") {
      setPhase("closing");
      return;
    }
  }, [phase, sysCount, baiText2Fade]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const shimmerOpac = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.40] });
  const petalY      = petalDrift.interpolate({ inputRange: [0, 1], outputRange: [0, 12] });
  const isTappable  = phase === "system" || phase === "bai_1" || phase === "bai_2";

  const closingGlowOpac = closingGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Pressable
      style={s.root}
      onPress={isTappable ? handleTap : undefined}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: rootFade }]}>
        {/* Base gradient — lotus recovery chamber */}
        <LinearGradient
          colors={["#06101A", "#030810", "#040B14"]}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Ambient aptitude glow from below */}
        <View
          style={[s.aptGlow, { backgroundColor: apt.glow }]}
          pointerEvents="none"
        />

        {/* Water shimmer */}
        <Animated.View
          style={[s.shimmerBand, { opacity: shimmerOpac }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={["transparent", `${apt.color}18`, "transparent"]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </Animated.View>

        {/* Ambient glyphs */}
        <AmbientGlyph top="12%"  left="6%"  sym="✚" color="rgba(62,207,178,0.08)"  />
        <AmbientGlyph top="22%"  left="86%" sym="◈" color="rgba(90,159,232,0.07)"  />
        <AmbientGlyph top="68%"  left="4%"  sym="◆" color="rgba(168,125,224,0.07)" />
        <AmbientGlyph top="75%"  left="88%" sym="✦" color="rgba(232,196,83,0.07)"  />
        <AmbientGlyph top="42%"  left="92%" sym="✚" color="rgba(62,207,178,0.06)"  />

        {/* Drifting lotus petals */}
        {[
          { t: H * 0.10, l: W * 0.07, r: "18deg",  o: 0.18 },
          { t: H * 0.25, l: W * 0.86, r: "145deg", o: 0.14 },
          { t: H * 0.55, l: W * 0.12, r: "275deg", o: 0.16 },
          { t: H * 0.72, l: W * 0.80, r: "355deg", o: 0.12 },
          { t: H * 0.40, l: W * 0.94, r: "60deg",  o: 0.11 },
        ].map((p, i) => (
          <Animated.View
            key={i}
            style={{ transform: [{ translateY: petalY }] }}
            pointerEvents="none"
          >
            <Petal top={p.t} left={p.l} rotate={p.r} opacity={p.o} />
          </Animated.View>
        ))}

        {/* ── Central scene ──────────────────────────────────────────────── */}
        <SafeAreaView style={s.safe}>

          {/* Top: Recovery chamber label */}
          <Text style={s.chamberLabel}>✦ LOTUS RECOVERY CHAMBER ✦</Text>

          {/* Player identity panel */}
          <View style={s.identityPanel}>
            {/* Aptitude symbol ring */}
            <Animated.View
              style={[s.aptRing, { borderColor: apt.color, opacity: nameFade }]}
            >
              <Text style={[s.aptSymbol, { color: apt.color }]}>{apt.symbol}</Text>
            </Animated.View>

            {/* Name */}
            <Animated.Text
              style={[s.playerName, { opacity: nameFade, transform: [{ translateY: nameSlide }] }]}
            >
              {name}
            </Animated.Text>

            {/* Pronouns (if set) */}
            {pronouns ? (
              <Animated.Text style={[s.playerPronouns, { opacity: nameFade }]}>
                {pronouns}
              </Animated.Text>
            ) : null}

            {/* Level / aptitude row */}
            <Animated.View style={[s.levelRow, { opacity: levelFade }]}>
              <View style={[s.levelBadge, { borderColor: apt.color }]}>
                <Text style={[s.levelBadgeText, { color: apt.color }]}>LEVEL 1</Text>
              </View>
              <Text style={[s.aptName, { color: apt.color }]}>
                {apt.name}
              </Text>
            </Animated.View>
          </View>

          {/* ── System terminal panel ──────────────────────────────────── */}
          <Animated.View style={[s.sysPanel, { opacity: sysPanel }]}>
            <View style={s.sysPanelInner}>
              <Text style={s.sysPanelTitle}>⊕ CLINICA OS  ·  IDENTITY MODULE</Text>
              {SYSTEM_MESSAGES.slice(0, sysCount + (phase !== "awakening" ? 1 : 0)).map((msg, i) => (
                <View key={i} style={s.sysLine}>
                  <Text style={[s.sysLineLabel, msg.ok ? s.sysOk : s.sysWarn]}>
                    [{msg.label}]
                  </Text>
                  <Text style={[s.sysLineText, msg.ok ? s.sysOk : s.sysWarn]}>
                    {" "}{msg.text}
                  </Text>
                </View>
              ))}
              {/* Tap indicator */}
              {phase === "system" && sysCount < SYSTEM_MESSAGES.length - 1 && (
                <Text style={s.tapHint}>▸ TAP TO CONTINUE</Text>
              )}
              {phase === "system" && sysCount >= SYSTEM_MESSAGES.length - 1 && (
                <Text style={s.tapHint}>▸ TAP TO PROCEED</Text>
              )}
            </View>
          </Animated.View>

          {/* ── Flicker aura (failed power attempt) ───────────────────── */}
          {(phase === "flicker" || phase === "bai_1" || phase === "bai_2" || phase === "closing") && (
            <View style={s.flickerContainer} pointerEvents="none">
              <Animated.View
                style={[
                  s.flickerAura,
                  {
                    borderColor: apt.color,
                    backgroundColor: apt.glow,
                    transform: [{ scale: flickerScale }],
                    opacity: flickerOpac,
                  },
                ]}
                pointerEvents="none"
              />
            </View>
          )}

          {/* Player question */}
          <Animated.Text style={[s.playerQuestion, { opacity: questionFade }]}>
            "…Where is my power?"
          </Animated.Text>

          {/* ── Master Bai projection ──────────────────────────────────── */}
          {(phase === "bai_1" || phase === "bai_2" || phase === "closing") && (
            <Animated.View style={[s.baiCard, { opacity: baiPanel }]}>
              <LinearGradient
                colors={["rgba(232,196,83,0.06)", "rgba(10,16,24,0.92)"]}
                locations={[0, 0.8]}
                style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                pointerEvents="none"
              />
              <View style={s.baiHeader}>
                <View style={s.baiProjectionDot} />
                <Text style={s.baiProjectionLabel}>MASTER BAI  ·  PROJECTION</Text>
                <View style={s.baiProjectionDot} />
              </View>
              <Text style={s.baiLine}>
                "Power is what brought you here."
              </Text>
              <Animated.Text style={[s.baiLine, s.baiLine2, { opacity: baiText2Fade }]}>
                "This time, we will begin with understanding."
              </Animated.Text>
              {phase === "bai_1" && (
                <Text style={s.tapHint}>▸ TAP TO CONTINUE</Text>
              )}
              {phase === "bai_2" && (
                <Text style={s.tapHint}>▸ TAP TO PROCEED</Text>
              )}
            </Animated.View>
          )}

          {/* ── Closing: enrollment confirmed ─────────────────────────── */}
          {phase === "closing" && (
            <Animated.View style={[s.closingMsg, { opacity: closingGlow }]}>
              <LinearGradient
                colors={[`${apt.color}22`, "transparent"]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <Text style={[s.closingMsgText, { color: apt.color }]}>
                ✦  Enrollment: Clinica University — Confirmed  ✦
              </Text>
            </Animated.View>
          )}
        </SafeAreaView>
      </Animated.View>

      {/* Final fade-to-dark overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, s.fadeOverlay, { opacity: closingFade }]}
        pointerEvents="none"
      />
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#030810",
  },
  safe: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 14,
  },

  // ── Ambient ──
  aptGlow: {
    position: "absolute",
    bottom: -60,
    left: -40,
    right: -40,
    height: H * 0.55,
    borderRadius: H * 0.28,
  },
  shimmerBand: {
    position: "absolute",
    left: 0, right: 0,
    top: H * 0.35,
    height: H * 0.4,
  },
  glyph: {
    position: "absolute",
    fontSize: 28,
    opacity: 1,
  },
  petal: {
    position: "absolute",
    width: 16,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(224,170,255,0.65)",
  },

  // ── Chamber label ──
  chamberLabel: {
    marginTop: 14,
    color: "rgba(62,207,178,0.35)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 3.5,
    textAlign: "center",
  },

  // ── Identity panel ──
  identityPanel: {
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  aptRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    marginBottom: 4,
  },
  aptSymbol: {
    fontSize: 28,
  },
  playerName: {
    color: "#F0F4FF",
    fontSize: 30,
    fontWeight: "300",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  playerPronouns: {
    color: "rgba(180,200,230,0.45)",
    fontSize: 12,
    letterSpacing: 1,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  levelBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  aptName: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
  },

  // ── System panel ──
  sysPanel: {
    width: "100%",
    maxWidth: 420,
  },
  sysPanelInner: {
    backgroundColor: "rgba(4,16,28,0.88)",
    borderWidth: 1,
    borderColor: "rgba(62,207,178,0.20)",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  sysPanelTitle: {
    color: "rgba(62,207,178,0.40)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  sysLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  sysLineLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontVariant: ["tabular-nums"] as any,
  },
  sysLineText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  sysOk:   { color: "#3ECFB2" },
  sysWarn: { color: "#7A8898" },
  tapHint: {
    marginTop: 6,
    color: "rgba(160,180,210,0.35)",
    fontSize: 9,
    letterSpacing: 2.5,
    alignSelf: "flex-end",
  },

  // ── Flicker aura ──
  flickerContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 80,
  },
  flickerAura: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
  },

  // ── Player question ──
  playerQuestion: {
    color: "rgba(220,230,245,0.70)",
    fontSize: 18,
    fontWeight: "300",
    fontStyle: "italic",
    textAlign: "center",
    letterSpacing: 0.3,
    maxWidth: 340,
    lineHeight: 28,
  },

  // ── Master Bai card ──
  baiCard: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: "rgba(232,196,83,0.22)",
    borderRadius: 16,
    padding: 18,
    gap: 10,
    overflow: "hidden",
  },
  baiHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 4,
  },
  baiProjectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(232,196,83,0.55)",
  },
  baiProjectionLabel: {
    color: "rgba(232,196,83,0.55)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
  },
  baiLine: {
    color: "#E8E0C8",
    fontSize: 16,
    fontWeight: "300",
    fontStyle: "italic",
    lineHeight: 26,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  baiLine2: {
    color: "#F4EED8",
    fontWeight: "400",
  },

  // ── Closing ──
  closingMsg: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 12,
    overflow: "hidden",
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  closingMsgText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textAlign: "center",
  },

  // ── Fade overlay ──
  fadeOverlay: {
    backgroundColor: "#030810",
  },
});
