/**
 * SilentInfarctionRevealScene
 *
 * Push 4a prologue cinematic — "The Silent Infarction"
 * Phase: silent_infarction_initial_reveal
 *
 * The trap springs. The battlefield erupts in red.
 * Three legends react. The Silent Infarction reveals itself and speaks.
 *
 * Stage machine:
 *  quiet      → battlefield settles, brief pause
 *  pulse      → red heartbeat sweeps across field, chaos builds
 *  react      → 3 hero dialogue beats (tap to advance, urgent)
 *  si_emerge  → SI portrait rises from fog, screen darkens
 *  si_speak   → 3 SI lines (auto-advance, slow, menacing)
 *  freeze     → white flash trap-closes
 *  out        → fade to black → onComplete()
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
  si:           require("../../../assets/images/silent_infarction_portrait.png"),
  nightingale:  require("../../../assets/images/nightingale_portrait.png"),
  fleming:      require("../../../assets/images/fleming_portrait.png"),
  masterBai:    require("../../../assets/images/master_bai.png"),
} as const;

// ─── Stage machine ────────────────────────────────────────────────────────────

type RevealStage =
  | "quiet"
  | "pulse"
  | "react"
  | "si_emerge"
  | "si_speak"
  | "freeze"
  | "out";

// ─── Dialogue beats ───────────────────────────────────────────────────────────

const REACT_BEATS = [
  { speaker: "NIGHTINGALE",   color: "#E8C453", avatar: ART.nightingale,
    line: "Their condition is deteriorating!" },
  { speaker: "FLEMING",       color: "#3ECFB2", avatar: ART.fleming,
    line: "The visible creatures are not the source!" },
  { speaker: "MASTER BAI",    color: "#D9A441", avatar: ART.masterBai,
    line: "Fall back! Now!" },
] as const;

const SI_LINES = [
  "The strongest healers are often the easiest to deceive.",
  "They see what they expect to see.",
  "And act before they understand.",
];

const SI_LINE_HOLD_MS = 2800; // auto-advance delay per SI line

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function SilentInfarctionRevealScene({ onComplete }: Props) {
  const [stage,        setStage]       = useState<RevealStage>("quiet");
  const [reactBeat,    setReactBeat]   = useState(0);   // index in REACT_BEATS
  const [siLine,       setSiLine]      = useState(0);   // index in SI_LINES
  const [beatVisible,  setBeatVisible] = useState(false);

  const stageRef     = useRef<RevealStage>("quiet");
  const mountedRef   = useRef(true);
  const timers       = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  // Battlefield
  const bgScale    = useRef(new Animated.Value(1.04)).current;
  const bgFade     = useRef(new Animated.Value(0)).current;

  // Red sweep (heartbeat pulse — horizontal stripe)
  const sweepX     = useRef(new Animated.Value(-500)).current;
  const sweepOpac  = useRef(new Animated.Value(0)).current;

  // Red overlay — grows as trap closes
  const redOpac    = useRef(new Animated.Value(0)).current;

  // Bottom crimson energy glow
  const bottomGlow = useRef(new Animated.Value(0)).current;

  // Dark vignette
  const vignette   = useRef(new Animated.Value(0)).current;

  // SI reveal
  const siOpac     = useRef(new Animated.Value(0)).current;

  // Dialogue box
  const dlgFade    = useRef(new Animated.Value(0)).current;
  const dlgScale   = useRef(new Animated.Value(0.93)).current;

  // White freeze flash
  const whiteFade  = useRef(new Animated.Value(0)).current;

  // Full black cover (final)
  const blackFade  = useRef(new Animated.Value(0)).current;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function anim(
    val: Animated.Value,
    toValue: number,
    duration: number,
    cb?: () => void,
  ) {
    Animated.timing(val, { toValue, duration, useNativeDriver: false }).start(
      cb ?? (() => {}),
    );
  }

  function after(ms: number, fn: () => void) {
    const t = setTimeout(() => { if (mountedRef.current) fn(); }, ms);
    timers.current.push(t);
  }

  function toStage(s: RevealStage) {
    stageRef.current = s;
    setStage(s);
  }

  // ── Show a dialogue beat (react or SI) ───────────────────────────────────────

  function showDialogue() {
    dlgFade.setValue(0);
    dlgScale.setValue(0.93);
    setBeatVisible(true);
    Animated.parallel([
      Animated.timing(dlgFade,  { toValue: 1, duration: 350, useNativeDriver: false }),
      Animated.timing(dlgScale, { toValue: 1, duration: 350, useNativeDriver: false }),
    ]).start();
  }

  function hideDialogue(cb: () => void) {
    Animated.timing(dlgFade, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => {
      setBeatVisible(false);
      cb();
    });
  }

  // ── Main sequence ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // Ambient bg breathing
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(bgScale, { toValue: 1.00, duration: 5000, useNativeDriver: false }),
        Animated.timing(bgScale, { toValue: 1.04, duration: 5000, useNativeDriver: false }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [bgScale]);

  useEffect(() => {
    // 1. Battlefield fades in
    anim(bgFade, 1, 800);

    // 2. After brief quiet → trigger pulse
    after(1200, () => {
      toStage("pulse");

      // Heartbeat sweep: stripe moves left→right
      sweepX.setValue(-500);
      anim(sweepOpac, 0.7, 150);
      anim(sweepX, 600, 700, () => {
        anim(sweepOpac, 0, 200);
      });

      // Red overlay builds
      anim(redOpac, 0.35, 1200);
      // Bottom glow rises
      anim(bottomGlow, 0.9, 1000);
      // Vignette darkens
      anim(vignette, 0.55, 1000);

      // 3. After pulse settles → hero reactions
      after(1400, () => {
        toStage("react");
        setReactBeat(0);
        showDialogue();
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tap handler ───────────────────────────────────────────────────────────────

  const handleTap = useCallback(() => {
    const s = stageRef.current;

    if (s === "react") {
      // Advance through the 3 hero reaction beats
      hideDialogue(() => {
        const next = reactBeat + 1;
        if (next < REACT_BEATS.length) {
          setReactBeat(next);
          after(100, showDialogue);
        } else {
          // All hero reactions done → SI emerges
          toStage("si_emerge");
          setSiLine(0);

          // Intensify atmosphere
          anim(redOpac, 0.60, 1200);
          anim(vignette, 0.85, 1200);
          anim(bottomGlow, 1, 600);

          // SI portrait rises
          after(600, () => {
            anim(siOpac, 1, 1200);
          });

          // After emergence, begin SI dialogue
          after(2200, () => {
            toStage("si_speak");
            setSiLine(0);
            showDialogue();
            scheduleNextSiLine(0);
          });
        }
      });
    }
    // Tapping during si_emerge / si_speak / freeze / out does nothing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactBeat]);

  // ── Auto-advance SI lines ─────────────────────────────────────────────────────

  function scheduleNextSiLine(current: number) {
    const next = current + 1;
    after(SI_LINE_HOLD_MS, () => {
      if (next < SI_LINES.length) {
        hideDialogue(() => {
          setSiLine(next);
          after(300, () => {
            showDialogue();
            scheduleNextSiLine(next);
          });
        });
      } else {
        // All SI lines done → freeze
        hideDialogue(() => runFreeze());
      }
    });
  }

  function runFreeze() {
    toStage("freeze");
    // White flash
    anim(whiteFade, 1, 180, () => {
      anim(whiteFade, 0, 250, () => {
        // Fade to black
        toStage("out");
        anim(blackFade, 1, 900, () => {
          if (mountedRef.current) onComplete();
        });
      });
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const isSiStage  = stage === "si_emerge" || stage === "si_speak";
  const isReact    = stage === "react";
  const curReact   = REACT_BEATS[reactBeat];
  const curSiLine  = SI_LINES[siLine];

  return (
    <Pressable
      style={styles.root}
      onPress={isReact ? handleTap : undefined}
      testID="si-reveal-scene"
    >
      {/* ── BATTLEFIELD ── */}
      <Animated.View style={[styles.bgWrap, { opacity: bgFade, transform: [{ scale: bgScale }] }]}>
        <ExpoImage source={ART.battlefield} style={styles.bg} contentFit="cover" />
      </Animated.View>

      {/* ── HEARTBEAT SWEEP ── */}
      <Animated.View
        style={[
          styles.sweepStripe,
          { opacity: sweepOpac, transform: [{ translateX: sweepX }] },
        ]}
        pointerEvents="none"
      />

      {/* ── RED OVERLAY (trap closing) ── */}
      <Animated.View
        style={[styles.redOverlay, { opacity: redOpac }]}
        pointerEvents="none"
      />

      {/* ── BOTTOM CRIMSON GLOW (dark energy beneath) ── */}
      <Animated.View style={[styles.bottomGlowWrap, { opacity: bottomGlow }]} pointerEvents="none">
        <LinearGradient
          colors={["transparent", "rgba(139,0,0,0.55)", "rgba(80,0,0,0.80)"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── DARK VIGNETTE ── */}
      <Animated.View style={[styles.vignette, { opacity: vignette }]} pointerEvents="none">
        <LinearGradient
          colors={[
            "rgba(0,0,0,0.70)",
            "transparent",
            "transparent",
            "rgba(0,0,0,0.60)",
          ]}
          locations={[0, 0.25, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── SILENT INFARCTION PORTRAIT (emerges from fog) ── */}
      {isSiStage && (
        <Animated.View style={[styles.siWrap, { opacity: siOpac }]} pointerEvents="none">
          <ExpoImage
            source={ART.si}
            style={styles.siPortrait}
            contentFit="contain"
          />
          {/* Red corona glow behind SI — gradient so it never renders as a rectangle */}
          <LinearGradient
            colors={["transparent", "rgba(160,0,0,0.55)", "transparent"]}
            locations={[0, 0.45, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.siGlow}
          />
        </Animated.View>
      )}

      {/* ── WHITE FREEZE FLASH ── */}
      <Animated.View
        style={[styles.flashOverlay, { opacity: whiteFade }]}
        pointerEvents="none"
      />

      {/* ── BLACK OUT ── */}
      <Animated.View
        style={[styles.blackOverlay, { opacity: blackFade }]}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        {/* ── SCENE LABEL ── */}
        <View style={styles.topBar} pointerEvents="none">
          <Text style={styles.sceneLabel}>EMERGENCY TREATMENT PLAZA  ·  TRAP ACTIVE</Text>
        </View>

        <View style={{ flex: 1 }} pointerEvents="none" />

        {/* ── DIALOGUE PANEL ── */}
        {beatVisible && (
          <Animated.View
            style={[
              styles.dlgWrap,
              { opacity: dlgFade, transform: [{ scale: dlgScale }] },
            ]}
            pointerEvents="none"
          >
            {isReact ? (
              // ─ Hero reaction ─
              <View style={styles.dlgPanel}>
                <View style={styles.reactHeader}>
                  <ExpoImage
                    source={curReact.avatar}
                    style={styles.reactAvatar}
                    contentFit="cover"
                  />
                  <Text style={[styles.reactSpeaker, { color: curReact.color }]}>
                    {curReact.speaker}
                  </Text>
                </View>
                <Text style={styles.reactLine}>{curReact.line}</Text>
                <Text style={styles.tapHint}>[ tap ]</Text>
              </View>
            ) : (
              // ─ Silent Infarction speaks ─
              <View style={styles.siDlgPanel}>
                <Text style={styles.siSpeakerLabel}>THE SILENT INFARCTION</Text>
                <Text style={styles.siLine}>{curSiLine}</Text>
              </View>
            )}
          </Animated.View>
        )}
      </SafeAreaView>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#040A12",
  },

  bgWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  bg: {
    width: "100%",
    height: "100%",
  },

  // Heartbeat sweep stripe
  sweepStripe: {
    position:        "absolute",
    top:             0,
    bottom:          0,
    left:            0,
    width:           120,
    backgroundColor: "#FF0000",
  },

  // Red overlay
  redOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#6B0000",
  },

  // Bottom glow
  bottomGlowWrap: {
    position: "absolute",
    bottom:   0,
    left:     0,
    right:    0,
    height:   "40%",
  },

  // Dark vignette
  vignette: {
    ...StyleSheet.absoluteFillObject,
  },

  // SI portrait
  siWrap: {
    position:       "absolute",
    top:            0,
    left:           0,
    right:          0,
    height:         "60%",
    alignItems:     "center",
    justifyContent: "flex-end",
  },
  siPortrait: {
    width:  220,
    height: 320,
    zIndex: 2,
  },
  siGlow: {
    position:     "absolute",
    bottom:       20,
    width:        300,
    height:       280,
    borderRadius: 150,
    overflow:     "hidden",
  },

  // White flash
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
  },

  // Black final
  blackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },

  // SafeAreaView
  safe: {
    flex:           1,
    justifyContent: "space-between",
  },

  topBar: {
    paddingTop:        16,
    paddingHorizontal: 20,
  },
  sceneLabel: {
    color:         "rgba(255,100,100,0.50)",
    fontSize:      10,
    fontWeight:    "700",
    letterSpacing: 2.5,
    textAlign:     "center",
  },

  // Dialogue container
  dlgWrap: {
    paddingHorizontal: 20,
    paddingBottom:     16,
  },

  // Hero reaction beat
  dlgPanel: {
    backgroundColor:    "rgba(4,10,18,0.88)",
    borderRadius:       14,
    borderWidth:        1,
    borderColor:        "rgba(255,255,255,0.08)",
    paddingHorizontal:  18,
    paddingVertical:    14,
    gap:                8,
  },
  reactHeader: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  reactAvatar: {
    width:        38,
    height:       38,
    borderRadius: 19,
  },
  reactSpeaker: {
    fontSize:      11,
    fontWeight:    "800",
    letterSpacing: 2.0,
  },
  reactLine: {
    color:         "#EDF2F7",
    fontSize:      17,
    lineHeight:    26,
    fontWeight:    "400",
    letterSpacing: 0.2,
  },
  tapHint: {
    color:         "rgba(255,255,255,0.22)",
    fontSize:      10,
    letterSpacing: 1.5,
    textAlign:     "right",
    marginTop:     2,
  },

  // SI dialogue panel
  siDlgPanel: {
    backgroundColor: "rgba(15,2,2,0.92)",
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     "rgba(139,0,0,0.45)",
    paddingHorizontal: 22,
    paddingVertical:   18,
    gap:             10,
    shadowColor:     "#FF0000",
    shadowOpacity:   0.35,
    shadowRadius:    20,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       8,
  },
  siSpeakerLabel: {
    color:         "#8B1A1A",
    fontSize:      10,
    fontWeight:    "800",
    letterSpacing: 3.5,
    textAlign:     "center",
  },
  siLine: {
    color:         "rgba(255,210,210,0.92)",
    fontSize:      16,
    lineHeight:    28,
    fontWeight:    "300",
    letterSpacing: 0.6,
    textAlign:     "center",
    fontStyle:     "italic",
  },
});
