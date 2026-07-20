/**
 * MemoryEchoAwardScene — Push 10
 *
 * Cinematic for the `memory_echo_award_scene` prologue phase.
 * Awards Nightingale's Lamp Fragment and Fleming's Culture Notes as
 * permanent inventory items via claimPrologueRewards (idempotent,
 * guarded by prologue_rewards_claimed).
 *
 * Echoes are NOT heroes — they do not occupy hero slots.
 *
 * Flow:
 *   award_fire  — (auto, mount) claimPrologueRewards called immediately
 *   nf_enter    — (auto 1.8s) Nightingale warm-gold silhouette rises
 *   nf_speak    — (tap) "Observe what has changed before deciding what must be done."
 *   nf_card     — (auto 1.4s) silhouette dissolves → Lamp Fragment card forms
 *   fl_enter    — (auto 1.4s) Fleming cool-teal silhouette rises
 *   fl_speak    — (tap) "Study the cause. Then choose the intervention."
 *   fl_card     — (auto 1.4s) silhouette dissolves → Culture Notes card forms
 *   system      — (tap each, 3 msgs) system messages accumulate
 *   reveal      — (tap) both cards side-by-side, full reveal
 *   closing     — (tap) → onComplete()
 *
 * Art style: donghua luminous. Echo silhouettes are translucent memory
 * fragments, NOT full portraits. Gold for Nightingale, teal for Fleming.
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

const NF_COLOR  = "#E8C453";
const NF_GLOW   = "rgba(232,196,83,0.22)";
const NF_BORDER = "rgba(232,196,83,0.45)";

const FL_COLOR  = "#3ECFB2";
const FL_GLOW   = "rgba(62,207,178,0.22)";
const FL_BORDER = "rgba(62,207,178,0.45)";

const SYSTEM_MSGS = [
  "Two instructional memories survived Lotus Recall.",
  "These are not heroes.",
  "They are lessons you were not yet prepared to accept.",
];

type Phase =
  | "nf_enter" | "nf_speak" | "nf_card"
  | "fl_enter" | "fl_speak" | "fl_card"
  | "system"   | "reveal"   | "closing";

// ─── Echo silhouette ─────────────────────────────────────────────────────────

function EchoSilhouette({
  color, glow, border, symbol, name, role, fade, slide,
}: {
  color: string; glow: string; border: string;
  symbol: string; name: string; role: string;
  fade: Animated.Value; slide: Animated.Value;
}) {
  return (
    <Animated.View style={[s.echoFigure, { opacity: fade, transform: [{ translateY: slide }] }]}>
      {/* Outer aura */}
      <View style={[s.echoAura, { backgroundColor: glow, borderColor: border }]} pointerEvents="none" />
      {/* Silhouette body */}
      <View style={[s.echoBody, { borderColor: border, backgroundColor: `${color}08` }]}>
        <Text style={[s.echoSymbol, { color }]}>{symbol}</Text>
      </View>
      {/* Name tag */}
      <View style={[s.echoNameTag, { borderColor: border }]}>
        <Text style={[s.echoNameText, { color }]}>{name}</Text>
        <Text style={s.echoRoleText}>{role}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Echo card ───────────────────────────────────────────────────────────────

function EchoCard({
  color, glow, border, icon, title, type, effect, flavor, uses, fade, scale,
}: {
  color: string; glow: string; border: string;
  icon: string; title: string; type: string;
  effect: string; flavor: string; uses: string;
  fade: Animated.Value; scale: Animated.Value;
}) {
  return (
    <Animated.View style={[s.card, { borderColor: border, opacity: fade, transform: [{ scale }] }]}>
      <LinearGradient
        colors={[`${color}0A`, "#04101C"]}
        locations={[0, 0.7]}
        style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
        pointerEvents="none"
      />
      {/* Card type badge */}
      <View style={[s.cardBadge, { borderColor: border }]}>
        <Text style={[s.cardBadgeText, { color }]}>◈ {type}</Text>
      </View>
      {/* Portrait placeholder — abstract memory fragment */}
      <View style={[s.cardPortrait, { borderColor: border, backgroundColor: glow }]}>
        <Text style={[s.cardPortraitIcon, { color }]}>{icon}</Text>
        <Text style={[s.cardPortraitLabel, { color: `${color}80` }]}>MEMORY FRAGMENT</Text>
      </View>
      {/* Title */}
      <Text style={[s.cardTitle, { color }]}>{title}</Text>
      {/* Effect */}
      <View style={[s.cardEffectBox, { borderColor: `${color}30` }]}>
        <Text style={s.cardEffectLabel}>BEGINNING EFFECT</Text>
        <Text style={s.cardEffectText}>{effect}</Text>
      </View>
      {/* Flavor */}
      <Text style={s.cardFlavor}>"{flavor}"</Text>
      {/* Uses badge */}
      <View style={[s.usesBadge, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
        <Text style={[s.usesBadgeText, { color }]}>{uses}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function MemoryEchoAwardScene({ onComplete }: Props) {
  const { claimPrologueRewards } = usePlayer();

  const [phase,    setPhase]    = useState<Phase>("nf_enter");
  const [sysCount, setSysCount] = useState(0);

  // ── Animations ────────────────────────────────────────────────────────────
  const rootFade   = useRef(new Animated.Value(0)).current;
  const shimmer    = useRef(new Animated.Value(0)).current;

  // Nightingale echo
  const nfFade    = useRef(new Animated.Value(0)).current;
  const nfSlide   = useRef(new Animated.Value(30)).current;
  const nfSpeakFd = useRef(new Animated.Value(0)).current;
  const nfCardFd  = useRef(new Animated.Value(0)).current;
  const nfCardSc  = useRef(new Animated.Value(0.85)).current;

  // Fleming echo
  const flFade    = useRef(new Animated.Value(0)).current;
  const flSlide   = useRef(new Animated.Value(30)).current;
  const flSpeakFd = useRef(new Animated.Value(0)).current;
  const flCardFd  = useRef(new Animated.Value(0)).current;
  const flCardSc  = useRef(new Animated.Value(0.85)).current;

  // System + reveal
  const sysFd     = useRef(new Animated.Value(0)).current;
  const revealFd  = useRef(new Animated.Value(0)).current;
  const closeFade = useRef(new Animated.Value(0)).current;

  const mountedRef = useRef(true);
  const timers     = useRef<ReturnType<typeof setTimeout>[]>([]);
  const addTimer   = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => { if (mountedRef.current) fn(); }, ms);
    timers.current.push(t);
  }, []);

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    // Award items immediately on mount (idempotent)
    claimPrologueRewards().catch(() => {});

    // Shimmer loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 3800, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 3800, useNativeDriver: false }),
      ])
    ).start();

    // Scene fade in → Nightingale enters
    Animated.timing(rootFade, { toValue: 1, duration: 700, useNativeDriver: false }).start(() => {
      if (!mountedRef.current) return;
      enterNightingale();
    });

    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // ── Phase sequences ───────────────────────────────────────────────────────

  const enterNightingale = useCallback(() => {
    Animated.parallel([
      Animated.timing(nfFade,  { toValue: 1, duration: 900, useNativeDriver: false }),
      Animated.timing(nfSlide, { toValue: 0, duration: 900, useNativeDriver: false }),
    ]).start(() => {
      if (!mountedRef.current) return;
      addTimer(() => {
        Animated.timing(nfSpeakFd, { toValue: 1, duration: 500, useNativeDriver: false }).start();
        setPhase("nf_speak");
      }, 400);
    });
  }, [nfFade, nfSlide, nfSpeakFd, addTimer]);

  const leaveNightingale = useCallback(() => {
    // Silhouette dissolves, card forms
    Animated.parallel([
      Animated.timing(nfFade,   { toValue: 0, duration: 700, useNativeDriver: false }),
      Animated.timing(nfCardFd, { toValue: 1, duration: 700, useNativeDriver: false }),
      Animated.timing(nfCardSc, { toValue: 1, duration: 700, useNativeDriver: false }),
    ]).start(() => {
      if (!mountedRef.current) return;
      setPhase("fl_enter");
      Animated.parallel([
        Animated.timing(flFade,  { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(flSlide, { toValue: 0, duration: 900, useNativeDriver: false }),
      ]).start(() => {
        if (!mountedRef.current) return;
        addTimer(() => {
          Animated.timing(flSpeakFd, { toValue: 1, duration: 500, useNativeDriver: false }).start();
          setPhase("fl_speak");
        }, 400);
      });
    });
  }, [nfFade, nfCardFd, nfCardSc, flFade, flSlide, flSpeakFd, addTimer]);

  const leaveFleming = useCallback(() => {
    Animated.parallel([
      Animated.timing(flFade,   { toValue: 0, duration: 700, useNativeDriver: false }),
      Animated.timing(flCardFd, { toValue: 1, duration: 700, useNativeDriver: false }),
      Animated.timing(flCardSc, { toValue: 1, duration: 700, useNativeDriver: false }),
    ]).start(() => {
      if (!mountedRef.current) return;
      setPhase("system");
      Animated.timing(sysFd, { toValue: 1, duration: 500, useNativeDriver: false }).start();
    });
  }, [flFade, flCardFd, flCardSc, sysFd]);

  // ── Tap handler ───────────────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (phase === "nf_speak") {
      setPhase("nf_card");
      addTimer(leaveNightingale, 200);
      return;
    }
    if (phase === "fl_speak") {
      setPhase("fl_card");
      addTimer(leaveFleming, 200);
      return;
    }
    if (phase === "system") {
      const next = sysCount + 1;
      if (next < SYSTEM_MSGS.length) {
        setSysCount(next);
      } else {
        setPhase("reveal");
        Animated.timing(revealFd, { toValue: 1, duration: 600, useNativeDriver: false }).start();
      }
      return;
    }
    if (phase === "reveal") {
      setPhase("closing");
      Animated.timing(closeFade, { toValue: 1, duration: 900, useNativeDriver: false }).start(() => {
        addTimer(onComplete, 200);
      });
      return;
    }
  }, [phase, sysCount, leaveNightingale, leaveFleming, revealFd, closeFade, addTimer, onComplete]);

  const isTappable = ["nf_speak", "fl_speak", "system", "reveal"].includes(phase);
  const shimmerOpac = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Pressable style={s.root} onPress={isTappable ? handleTap : undefined}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: rootFade }]}>
        <LinearGradient
          colors={["#060A12", "#040810", "#06101A"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Ambient shimmer */}
        <Animated.View style={[s.shimmerBand, { opacity: shimmerOpac }]} pointerEvents="none">
          <LinearGradient
            colors={["transparent", "rgba(232,196,83,0.08)", "rgba(62,207,178,0.06)", "transparent"]}
            locations={[0, 0.35, 0.65, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </Animated.View>

        <SafeAreaView style={s.safe}>
          {/* Phase kicker */}
          <Text style={s.kicker}>✦ MEMORY ECHO RECOVERY ✦</Text>

          {/* ── Nightingale silhouette ─────────────────────────────────── */}
          {["nf_enter", "nf_speak"].includes(phase) && (
            <EchoSilhouette
              color={NF_COLOR} glow={NF_GLOW} border={NF_BORDER}
              symbol="☽" name="FLORENCE NIGHTINGALE" role="Memory Echo"
              fade={nfFade} slide={nfSlide}
            />
          )}

          {/* Nightingale's dialogue */}
          <Animated.View style={[s.speechBubble, { borderColor: NF_BORDER, opacity: nfSpeakFd }]}>
            <Text style={[s.speechName, { color: NF_COLOR }]}>Nightingale Echo</Text>
            <Text style={s.speechText}>
              "Observe what has changed before deciding what must be done."
            </Text>
            {phase === "nf_speak" && <Text style={s.tapHint}>▸ TAP TO CONTINUE</Text>}
          </Animated.View>

          {/* ── Nightingale card (forms after she leaves) ──────────────── */}
          {(["nf_card", "fl_enter", "fl_speak", "fl_card", "system"].includes(phase)) && (
            <Animated.View style={[s.singleCardWrap, { opacity: nfCardFd }]}>
              <EchoCard
                color={NF_COLOR} glow={NF_GLOW} border={NF_BORDER}
                icon="☽" title="Nightingale's Lamp Fragment"
                type="SUPPORT MEMORY ECHO"
                effect="Reveals one concealed clue, environmental hazard, or hidden symptom."
                flavor="A fragment of warm lamplight remains within your reconstructed memory. It illuminates what haste once caused you to overlook."
                uses="1× per battle"
                fade={nfCardFd} scale={nfCardSc}
              />
            </Animated.View>
          )}

          {/* ── Fleming silhouette ─────────────────────────────────────── */}
          {["fl_enter", "fl_speak"].includes(phase) && (
            <EchoSilhouette
              color={FL_COLOR} glow={FL_GLOW} border={FL_BORDER}
              symbol="⊕" name="ALEXANDER FLEMING" role="Memory Echo"
              fade={flFade} slide={flSlide}
            />
          )}

          {/* Fleming's dialogue */}
          <Animated.View style={[s.speechBubble, { borderColor: FL_BORDER, opacity: flSpeakFd }]}>
            <Text style={[s.speechName, { color: FL_COLOR }]}>Fleming Echo</Text>
            <Text style={s.speechText}>
              "Study the cause. Then choose the intervention."
            </Text>
            {phase === "fl_speak" && <Text style={s.tapHint}>▸ TAP TO CONTINUE</Text>}
          </Animated.View>

          {/* ── System messages ─────────────────────────────────────────── */}
          {["system", "reveal"].includes(phase) && (
            <Animated.View style={[s.sysPanel, { opacity: sysFd }]}>
              <Text style={s.sysPanelTitle}>⊕ CLINICA OS  ·  RECALL MODULE</Text>
              {SYSTEM_MSGS.slice(0, sysCount + 1).map((msg, i) => (
                <Text key={i} style={[s.sysMsg, i === 2 && { color: "#E8C453" }]}>
                  {msg}
                </Text>
              ))}
              {phase === "system" && sysCount < SYSTEM_MSGS.length - 1 && (
                <Text style={s.tapHint}>▸ TAP TO CONTINUE</Text>
              )}
              {phase === "system" && sysCount >= SYSTEM_MSGS.length - 1 && (
                <Text style={s.tapHint}>▸ TAP TO SEE YOUR ECHOES</Text>
              )}
            </Animated.View>
          )}

          {/* ── Both cards revealed side by side ─────────────────────── */}
          {phase === "reveal" && (
            <Animated.View style={[s.dualCardRow, { opacity: revealFd }]}>
              <View style={s.dualCardHalf}>
                <EchoCard
                  color={NF_COLOR} glow={NF_GLOW} border={NF_BORDER}
                  icon="☽" title="Lamp Fragment"
                  type="SUPPORT ECHO"
                  effect="Reveals one concealed clue or hidden symptom."
                  flavor="A fragment of warm lamplight. It illuminates what haste caused you to overlook."
                  uses="1× per battle"
                  fade={nfCardFd} scale={nfCardSc}
                />
              </View>
              <View style={s.dualCardHalf}>
                <EchoCard
                  color={FL_COLOR} glow={FL_GLOW} border={FL_BORDER}
                  icon="⊕" title="Culture Notes"
                  type="ASSESSMENT ECHO"
                  effect="Reveals one enemy weakness, resistance, or ineffective treatment."
                  flavor="Faded notes from a forgotten battlefield. The strongest treatment is not always the correct one."
                  uses="1× per battle"
                  fade={flCardFd} scale={flCardSc}
                />
              </View>
            </Animated.View>
          )}

          {phase === "reveal" && (
            <Pressable onPress={handleTap} style={s.continueBtn}>
              <Text style={s.continueBtnText}>CARRY THESE LESSONS FORWARD</Text>
            </Pressable>
          )}
        </SafeAreaView>
      </Animated.View>

      {/* Fade-out overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#040810", opacity: closeFade }]}
        pointerEvents="none"
      />
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#040810" },
  safe: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 20,
  },

  // ── Ambient ──
  shimmerBand: {
    position: "absolute",
    top: H * 0.25, bottom: 0, left: 0, right: 0,
  },

  // ── Kicker ──
  kicker: {
    marginTop: 14,
    color: "rgba(232,196,83,0.35)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 3.5,
    textAlign: "center",
  },

  // ── Echo silhouette ──
  echoFigure: {
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  echoAura: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    top: -10,
  },
  echoBody: {
    width: 90,
    height: 130,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  echoSymbol: {
    fontSize: 36,
    opacity: 0.6,
  },
  echoNameTag: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignItems: "center",
    backgroundColor: "rgba(4,8,16,0.80)",
  },
  echoNameText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  echoRoleText: {
    color: "rgba(160,180,210,0.50)",
    fontSize: 9,
    letterSpacing: 1.2,
    marginTop: 1,
  },

  // ── Speech bubble ──
  speechBubble: {
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(4,10,20,0.85)",
    gap: 6,
  },
  speechName: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  speechText: {
    color: "#D8E4F0",
    fontSize: 15,
    fontWeight: "300",
    fontStyle: "italic",
    lineHeight: 24,
  },
  tapHint: {
    color: "rgba(160,180,210,0.35)",
    fontSize: 9,
    letterSpacing: 2.5,
    alignSelf: "flex-end",
    marginTop: 4,
  },

  // ── Single card (during transition) ──
  singleCardWrap: {
    width: "100%",
    maxWidth: 300,
  },

  // ── Echo card ──
  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    overflow: "hidden",
    backgroundColor: "rgba(4,12,22,0.92)",
  },
  cardBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  cardBadgeText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  cardPortrait: {
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    overflow: "hidden",
  },
  cardPortraitIcon: {
    fontSize: 26,
    opacity: 0.55,
  },
  cardPortraitLabel: {
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  cardEffectBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    gap: 3,
  },
  cardEffectLabel: {
    color: "rgba(160,180,210,0.50)",
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  cardEffectText: {
    color: "#C0D0E0",
    fontSize: 11,
    lineHeight: 16,
  },
  cardFlavor: {
    color: "#6A7A8A",
    fontSize: 10,
    fontStyle: "italic",
    lineHeight: 15,
  },
  usesBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  usesBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  // ── System panel ──
  sysPanel: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "rgba(4,12,22,0.88)",
    borderWidth: 1,
    borderColor: "rgba(62,207,178,0.18)",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  sysPanelTitle: {
    color: "rgba(62,207,178,0.35)",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  sysMsg: {
    color: "#7A8898",
    fontSize: 13,
    lineHeight: 20,
    fontStyle: "italic",
  },

  // ── Dual card reveal ──
  dualCardRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  dualCardHalf: {
    flex: 1,
  },

  // ── Continue button ──
  continueBtn: {
    marginTop: 4,
    paddingVertical: 15,
    paddingHorizontal: 36,
    borderRadius: 999,
    backgroundColor: "#E8C453",
    shadowColor: "#E8C453",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  continueBtnText: {
    color: "#06100A",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
