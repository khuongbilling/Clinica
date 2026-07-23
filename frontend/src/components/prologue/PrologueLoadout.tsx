/**
 * PrologueLoadout
 *
 * Push 4b prologue screen — "Prepare for Battle"
 * Phase: former_self_support_loadout
 *
 * A story loadout screen over the darkened isometric battlefield.
 * Three required temporary units are presented:
 *   1. Florence Nightingale (LOCKED · LEGENDARY)
 *   2. Sir Alexander Fleming (LOCKED · LEGENDARY)
 *   3. The Former Self (The Prodigy — player unit)
 *
 * Temporary units do NOT enter the permanent roster.
 * Nightingale and Fleming CANNOT be removed.
 *
 * Flow:
 *  intro       → battlefield + 3 slots appear (2 initially empty)
 *  nightingale → Nightingale card slides in, her join line displays
 *  fleming     → Fleming card slides in, his join line displays
 *  master_bai  → Master Bai speaks 2 lines (auto)
 *  ready       → confirm button pulses, player can enter
 */

import { useCallback, useEffect, useRef, useState } from "react";
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

// ─── Art ─────────────────────────────────────────────────────────────────────

const ART = {
  battlefield:  require("../../../assets/images/tactical_battlefield.png"),
  formerSelf:   require("../../../assets/images/prodigy_vn_canonical.png"),
  nightingale:  require("../../../assets/images/nightingale_vn_bust.png"),
  fleming:      require("../../../assets/images/fleming_portrait.png"),
  masterBai:    require("../../../assets/images/master_bai.png"),
} as const;

// ─── Stage machine ────────────────────────────────────────────────────────────

type LoadoutStage =
  | "intro"
  | "nightingale"
  | "fleming"
  | "master_bai"
  | "ready";

// ─── Hero slot data ───────────────────────────────────────────────────────────

const HERO_SLOTS = [
  {
    id:       "nightingale",
    name:     "Florence Nightingale",
    role:     "Legendary Support",
    roleColor: "#E8C453",
    tags:     ["Observe", "Stabilize", "Reassess"],
    avatar:   ART.nightingale,
    locked:   true,
    badge:    "REQUIRED · LEGENDARY",
    joinLine: "I will watch for the dangers hidden between the obvious ones.",
    appearsAt: "nightingale" as LoadoutStage,
  },
  {
    id:       "former_self",
    name:     "The Prodigy",
    role:     "Legendary Clinician",
    roleColor: "#7EB8F7",
    tags:     ["Strike", "Heal", "Solo"],
    avatar:   ART.formerSelf,
    locked:   false,
    badge:    null,
    joinLine: null,
    appearsAt: "intro" as LoadoutStage,
  },
  {
    id:       "fleming",
    name:     "Sir Alexander Fleming",
    role:     "Legendary Assessment",
    roleColor: "#3ECFB2",
    tags:     ["Analyze", "Counter", "Correct"],
    avatar:   ART.fleming,
    locked:   true,
    badge:    "REQUIRED · LEGENDARY",
    joinLine: "And I will ensure that our response is guided by evidence rather than assumption.",
    appearsAt: "fleming" as LoadoutStage,
  },
] as const;

// Stage weight order for visibility checks
const STAGE_ORDER: LoadoutStage[] = [
  "intro", "nightingale", "fleming", "master_bai", "ready",
];

function stageGte(a: LoadoutStage, b: LoadoutStage): boolean {
  return STAGE_ORDER.indexOf(a) >= STAGE_ORDER.indexOf(b);
}

// Master Bai's two lines (auto-reveal)
const MASTER_BAI_LINES = [
  "A capable team does not exist to admire your strength.",
  "It exists to challenge your judgment.",
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function PrologueLoadout({ onComplete }: Props) {
  const [stage,   setStage]   = useState<LoadoutStage>("intro");

  const stageRef   = useRef<LoadoutStage>("intro");
  const mountedRef = useRef(true);
  const timers     = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  // ── Animated values ──────────────────────────────────────────────────────────

  // Background
  const bgFade    = useRef(new Animated.Value(0)).current;
  const redPulse  = useRef(new Animated.Value(0)).current;   // pulsing red glow in bg

  // Former Self in bg
  const fsBgOpac  = useRef(new Animated.Value(0)).current;

  // Panel
  const panelFade = useRef(new Animated.Value(0)).current;

  // Per-slot slide-in
  const nightSlide = useRef(new Animated.Value(60)).current;
  const nightFade  = useRef(new Animated.Value(0)).current;
  const flemSlide  = useRef(new Animated.Value(60)).current;
  const flemFade   = useRef(new Animated.Value(0)).current;

  // Dialogue box
  const dlgFade  = useRef(new Animated.Value(0)).current;
  const [dlgContent, setDlgContent] = useState<{
    speaker: string;
    speakerColor: string;
    avatar: any;
    lines: readonly string[];
  } | null>(null);
  const dlgLineAnims = useRef(
    Array.from({ length: 3 }, () => new Animated.Value(0))
  ).current;

  // Confirm button
  const btnScale  = useRef(new Animated.Value(0.92)).current;
  const btnFade   = useRef(new Animated.Value(0)).current;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function anim(val: Animated.Value, toValue: number, duration: number, cb?: () => void) {
    Animated.timing(val, { toValue, duration, useNativeDriver: false }).start(cb ?? (() => {}));
  }

  function after(ms: number, fn: () => void) {
    const t = setTimeout(() => { if (mountedRef.current) fn(); }, ms);
    timers.current.push(t);
    return t;
  }

  function toStage(s: LoadoutStage) {
    stageRef.current = s;
    setStage(s);
  }

  function showDialogue(
    speaker: string,
    speakerColor: string,
    avatar: any,
    lines: readonly string[],
    onDone?: () => void,
  ) {
    dlgLineAnims.forEach(a => a.setValue(0));
    setDlgContent({ speaker, speakerColor, avatar, lines });

    // Fade dialogue box in
    dlgFade.setValue(0);
    anim(dlgFade, 1, 350);

    // Stagger line reveals
    lines.forEach((_, i) => {
      after(i * 900, () => {
        anim(dlgLineAnims[i], 1, 450);
      });
    });

    // After all lines + hold → callback
    const holdMs = (lines.length - 1) * 900 + 2200;
    after(holdMs, () => {
      anim(dlgFade, 0, 300, () => {
        setDlgContent(null);
        onDone?.();
      });
    });
  }

  // ── Main flow ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Pulsing red glow in bg (Former Self trapped)
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(redPulse, { toValue: 0.5, duration: 1500, useNativeDriver: false }),
        Animated.timing(redPulse, { toValue: 0.1, duration: 1500, useNativeDriver: false }),
      ])
    );
    pulse.start();

    // 1. Fade in background + panel
    anim(bgFade, 1, 900);
    anim(fsBgOpac, 0.22, 1400);  // Former Self ghosted in bg
    after(500, () => anim(panelFade, 1, 700));

    // 2. After panel appears, Nightingale joins
    after(1600, () => {
      toStage("nightingale");
      Animated.parallel([
        Animated.timing(nightSlide, { toValue: 0,  duration: 500, useNativeDriver: false }),
        Animated.timing(nightFade,  { toValue: 1,  duration: 500, useNativeDriver: false }),
      ]).start();

      after(700, () => {
        showDialogue(
          "FLORENCE NIGHTINGALE",
          "#E8C453",
          ART.nightingale,
          [HERO_SLOTS[0].joinLine],
          () => {
            // 3. Fleming joins
            toStage("fleming");
            Animated.parallel([
              Animated.timing(flemSlide, { toValue: 0, duration: 500, useNativeDriver: false }),
              Animated.timing(flemFade,  { toValue: 1, duration: 500, useNativeDriver: false }),
            ]).start();

            after(700, () => {
              showDialogue(
                "SIR ALEXANDER FLEMING",
                "#3ECFB2",
                ART.fleming,
                [HERO_SLOTS[2].joinLine],
                () => {
                  // 4. Master Bai speaks
                  toStage("master_bai");
                  showDialogue(
                    "MASTER BAI",
                    "#D9A441",
                    ART.masterBai,
                    MASTER_BAI_LINES,
                    () => {
                      // 5. Ready
                      toStage("ready");
                      anim(btnFade, 1, 500);
                      Animated.loop(
                        Animated.sequence([
                          Animated.timing(btnScale, { toValue: 1.03, duration: 900, useNativeDriver: false }),
                          Animated.timing(btnScale, { toValue: 0.97, duration: 900, useNativeDriver: false }),
                        ])
                      ).start();
                    },
                  );
                },
              );
            });
          },
        );
      });
    });

    return () => { pulse.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────

  const isReady = stage === "ready";

  return (
    <View style={styles.root}>
      {/* ── BATTLEFIELD BACKGROUND (darkened + red pulse) ── */}
      <Animated.View style={[styles.bgWrap, { opacity: bgFade }]}>
        <ExpoImage source={ART.battlefield} style={styles.bg} contentFit="cover" />
      </Animated.View>

      {/* Heavy dark overlay */}
      <View style={styles.darkOverlay} pointerEvents="none" />

      {/* Former Self ghosted in background (trapped in fog) */}
      <Animated.View style={[styles.fsBgWrap, { opacity: fsBgOpac }]} pointerEvents="none">
        <ExpoImage source={ART.formerSelf} style={styles.fsBgImg} contentFit="contain" />
      </Animated.View>

      {/* Pulsing red glow around Former Self */}
      <Animated.View style={[styles.fsRedGlow, { opacity: redPulse }]} pointerEvents="none" />

      {/* Top fog overlay */}
      <LinearGradient
        colors={["rgba(4,10,18,0.85)", "transparent", "rgba(4,10,18,0.95)"]}
        locations={[0, 0.4, 1]}
        style={styles.fogOverlay}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe}>
        {/* ── HEADER ── */}
        <Animated.View style={[styles.header, { opacity: panelFade }]}>
          <Text style={styles.headerKicker}>PROLOGUE  ·  STORY LOADOUT</Text>
          <Text style={styles.headerTitle}>Your Team</Text>
          <Text style={styles.headerNote}>
            Temporary legendary units · Not added to permanent roster
          </Text>
        </Animated.View>

        {/* ── HERO SLOTS ── */}
        <Animated.View style={[styles.slotsWrap, { opacity: panelFade }]}>

          {/* Nightingale slot */}
          <Animated.View
            style={[
              styles.heroCard,
              styles.heroCardLocked,
              {
                opacity:   nightFade,
                transform: [{ translateY: nightSlide }],
              },
            ]}
          >
            <View style={styles.heroAvatarWrap}>
              <ExpoImage source={ART.nightingale} style={styles.heroAvatar} contentFit="cover" />
              <View style={styles.lockBadge}>
                <Text style={styles.lockIcon}>🔒</Text>
              </View>
            </View>
            <View style={styles.heroInfo}>
              <Text style={[styles.heroRole, { color: "#E8C453" }]}>
                REQUIRED · LEGENDARY
              </Text>
              <Text style={styles.heroName}>Florence Nightingale</Text>
              <View style={styles.tagRow}>
                {["Observe", "Stabilize", "Reassess"].map(t => (
                  <View key={t} style={[styles.tag, { borderColor: "#E8C45340" }]}>
                    <Text style={[styles.tagText, { color: "#E8C453" }]}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* Former Self slot — always visible */}
          <View style={[styles.heroCard, styles.heroCardSelf]}>
            <View style={styles.heroAvatarWrap}>
              <ExpoImage source={ART.formerSelf} style={styles.heroAvatar} contentFit="cover" />
              <View style={[styles.lockBadge, styles.youBadge]}>
                <Text style={styles.youIcon}>★</Text>
              </View>
            </View>
            <View style={styles.heroInfo}>
              <Text style={[styles.heroRole, { color: "#7EB8F7" }]}>THE PRODIGY</Text>
              <Text style={styles.heroName}>The Former Self</Text>
              <View style={styles.tagRow}>
                {["Strike", "Heal", "Solo"].map(t => (
                  <View key={t} style={[styles.tag, { borderColor: "#7EB8F740" }]}>
                    <Text style={[styles.tagText, { color: "#7EB8F7" }]}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Fleming slot */}
          <Animated.View
            style={[
              styles.heroCard,
              styles.heroCardLocked,
              {
                opacity:   flemFade,
                transform: [{ translateY: flemSlide }],
              },
            ]}
          >
            <View style={styles.heroAvatarWrap}>
              <ExpoImage source={ART.fleming} style={styles.heroAvatar} contentFit="cover" />
              <View style={styles.lockBadge}>
                <Text style={styles.lockIcon}>🔒</Text>
              </View>
            </View>
            <View style={styles.heroInfo}>
              <Text style={[styles.heroRole, { color: "#3ECFB2" }]}>
                REQUIRED · LEGENDARY
              </Text>
              <Text style={styles.heroName}>Sir Alexander Fleming</Text>
              <View style={styles.tagRow}>
                {["Analyze", "Counter", "Correct"].map(t => (
                  <View key={t} style={[styles.tag, { borderColor: "#3ECFB240" }]}>
                    <Text style={[styles.tagText, { color: "#3ECFB2" }]}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

        </Animated.View>

        {/* ── DIALOGUE BOX ── */}
        {dlgContent && (
          <Animated.View style={[styles.dlgWrap, { opacity: dlgFade }]} pointerEvents="none">
            <View style={styles.dlgPanel}>
              <View style={styles.dlgHeader}>
                <ExpoImage
                  source={dlgContent.avatar}
                  style={styles.dlgAvatar}
                  contentFit="cover"
                />
                <Text style={[styles.dlgSpeaker, { color: dlgContent.speakerColor }]}>
                  {dlgContent.speaker}
                </Text>
              </View>
              {dlgContent.lines.map((line, i) => (
                <Animated.Text
                  key={i}
                  style={[styles.dlgLine, { opacity: dlgLineAnims[i] }]}
                >
                  {line}
                </Animated.Text>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── CONFIRM BUTTON ── */}
        <Animated.View style={[styles.btnWrap, { opacity: btnFade, transform: [{ scale: btnScale }] }]}>
          <Pressable
            style={[styles.confirmBtn, !isReady && styles.confirmBtnDisabled]}
            onPress={isReady ? onComplete : undefined}
            testID="loadout-confirm"
          >
            <LinearGradient
              colors={isReady
                ? ["#8B1A1A", "#B22222", "#8B1A1A"]
                : ["#3a3a3a", "#4a4a4a", "#3a3a3a"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmGradient}
            >
              <Text style={styles.confirmText}>ENTER THE BATTLEFIELD</Text>
            </LinearGradient>
          </Pressable>
          <Text style={styles.confirmSubtext}>
            Assess.  Prioritize.  Intervene.  Reassess.
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020508",
  },

  bgWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  bg: {
    width:  "100%",
    height: "100%",
  },

  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,5,8,0.82)",
  },

  // Former Self in background
  fsBgWrap: {
    position:       "absolute",
    bottom:         "28%",
    alignSelf:      "center",
    width:          180,
    height:         320,
  },
  fsBgImg: {
    width:  "100%",
    height: "100%",
  },
  fsRedGlow: {
    position:        "absolute",
    bottom:          "30%",
    alignSelf:       "center",
    width:           220,
    height:          220,
    borderRadius:    110,
    backgroundColor: "#8B0000",
  },

  fogOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  safe: {
    flex:              1,
    paddingHorizontal: 16,
    paddingBottom:     8,
    gap:               12,
  },

  // Header
  header: {
    paddingTop:  20,
    alignItems: "center",
    gap:         4,
  },
  headerKicker: {
    color:         "rgba(139,0,0,0.75)",
    fontSize:      10,
    fontWeight:    "800",
    letterSpacing: 3,
  },
  headerTitle: {
    color:         "#F4F7FB",
    fontSize:      26,
    fontWeight:    "200",
    letterSpacing: 0.5,
  },
  headerNote: {
    color:         "rgba(255,255,255,0.28)",
    fontSize:      11,
    letterSpacing: 0.3,
    textAlign:     "center",
  },

  // Slots
  slotsWrap: {
    flex: 1,
    gap:  8,
    justifyContent: "center",
  },

  heroCard: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               12,
    padding:           12,
    borderRadius:      12,
    borderWidth:       1,
  },
  heroCardLocked: {
    backgroundColor: "rgba(10,15,22,0.80)",
    borderColor:     "rgba(255,255,255,0.08)",
  },
  heroCardSelf: {
    backgroundColor: "rgba(20,30,50,0.85)",
    borderColor:     "rgba(126,184,247,0.25)",
  },

  heroAvatarWrap: {
    position:     "relative",
    width:        60,
    height:       60,
  },
  heroAvatar: {
    width:        60,
    height:       60,
    borderRadius: 30,
  },
  lockBadge: {
    position:        "absolute",
    bottom:          -3,
    right:           -3,
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: "rgba(10,15,22,0.90)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  lockIcon: {
    fontSize: 10,
  },
  youBadge: {
    backgroundColor: "rgba(126,184,247,0.20)",
  },
  youIcon: {
    fontSize: 10,
    color:    "#7EB8F7",
  },

  heroInfo: {
    flex: 1,
    gap:  3,
  },
  heroRole: {
    fontSize:      9,
    fontWeight:    "800",
    letterSpacing: 1.8,
  },
  heroName: {
    color:         "#EDF2F7",
    fontSize:      14,
    fontWeight:    "500",
    letterSpacing: 0.2,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           4,
    marginTop:     2,
  },
  tag: {
    borderWidth:     1,
    borderRadius:    4,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  tagText: {
    fontSize:      9,
    fontWeight:    "600",
    letterSpacing: 0.5,
  },

  // Dialogue
  dlgWrap: {
    marginBottom: 4,
  },
  dlgPanel: {
    backgroundColor:   "rgba(4,10,18,0.92)",
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       "rgba(255,255,255,0.08)",
    padding:           14,
    gap:               8,
  },
  dlgHeader: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  dlgAvatar: {
    width:        34,
    height:       34,
    borderRadius: 17,
  },
  dlgSpeaker: {
    fontSize:      10,
    fontWeight:    "800",
    letterSpacing: 2,
  },
  dlgLine: {
    color:         "#EDF2F7",
    fontSize:      14,
    lineHeight:    22,
    fontWeight:    "300",
    letterSpacing: 0.2,
  },

  // Confirm
  btnWrap: {
    alignItems: "center",
    gap:        8,
    marginBottom: 4,
  },
  confirmBtn: {
    width:        "100%",
    borderRadius: 10,
    overflow:     "hidden",
  },
  confirmBtnDisabled: {
    opacity: 0.55,
  },
  confirmGradient: {
    paddingVertical:   16,
    alignItems:        "center",
    justifyContent:    "center",
  },
  confirmText: {
    color:         "#FFFFFF",
    fontSize:      14,
    fontWeight:    "800",
    letterSpacing: 3.5,
  },
  confirmSubtext: {
    color:         "rgba(255,255,255,0.30)",
    fontSize:      11,
    letterSpacing: 1.2,
    textAlign:     "center",
  },
});
