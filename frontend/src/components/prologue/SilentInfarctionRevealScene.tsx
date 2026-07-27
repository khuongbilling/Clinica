/**
 * SilentInfarctionRevealScene
 *
 * Phase: silent_infarction_initial_reveal
 *
 * Two-part scene:
 *  Part 1 — SI Reveal: tappable REACT_BEATS (hero reactions) → auto SI monologue → freeze flash
 *  Part 2 — Loadout Dialogue: Nightingale + Fleming + Master Bai speak, tappable beats,
 *            followed by an "ENTER THE BATTLEFIELD" button → calls onComplete
 *
 * Stage machine:
 *  quiet → pulse → react → si_emerge → si_speak → freeze → loadout → ready
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PROLOGUE_CHARACTERS,
  type PrologueSpeakerId,
} from "../../game/prologueCharacters";

const { width: W, height: H } = Dimensions.get("window");

const ART = {
  battlefield: require("../../../assets/images/tactical_battlefield.png"),
  si:          require("../../../assets/images/silent_infarction_nobg.png"),
} as const;

type RevealStage =
  | "quiet"
  | "pulse"
  | "react"
  | "si_emerge"
  | "si_speak"
  | "freeze"
  | "loadout"
  | "ready";

const REACT_BEATS: Array<{ speaker: PrologueSpeakerId; line: string }> = [
  { speaker: "NIGHTINGALE", line: "Their condition is deteriorating!" },
  { speaker: "FLEMING",     line: "The visible creatures are not the source!" },
  { speaker: "MASTER_BAI",  line: "Fall back! Now!" },
];

const SI_LINES = [
  "The strongest healers are often the easiest to deceive.",
  "They see what they expect to see.",
  "And act before they understand.",
];

const LOADOUT_BEATS: Array<{ speaker: PrologueSpeakerId; line: string }> = [
  { speaker: "NIGHTINGALE", line: "I will watch for the dangers hidden between the obvious ones." },
  { speaker: "FLEMING",     line: "And I will ensure that our response is guided by evidence rather than assumption." },
  { speaker: "MASTER_BAI",  line: "A capable team does not exist to admire your strength." },
  { speaker: "MASTER_BAI",  line: "It exists to challenge your judgment." },
];

const SI_LINE_HOLD_MS = 2800;
const CHARS_PER_SEC   = 28;
const BAR_HEIGHT      = 200;

const SI_SPEAKER = {
  name:      "THE SILENT\nINFARCTION",
  color:     "#8B1A1A",
  barColor:  "rgba(15,2,2,0.96)" as const,
  barBorder: "rgba(139,0,0,0.60)" as const,
};

interface Props { onComplete: () => void }

export default function SilentInfarctionRevealScene({ onComplete }: Props) {
  const insets   = useSafeAreaInsets();
  const barTotal = BAR_HEIGHT + insets.bottom;

  const [stage,          setStage]          = useState<RevealStage>("quiet");
  const [reactBeat,      setReactBeat]      = useState(0);
  const [siLine,         setSiLine]         = useState(0);
  const [loadoutBeatIdx, setLoadoutBeatIdx] = useState(0);
  const [beatVisible,    setBeatVisible]    = useState(false);
  const [displayed,      setDisplayed]      = useState("");
  const [typewriterDone, setTypewriterDone] = useState(false);

  const stageRef          = useRef<RevealStage>("quiet");
  const loadoutBeatIdxRef = useRef(0);
  const mountedRef        = useRef(true);
  const timers            = useRef<ReturnType<typeof setTimeout>[]>([]);
  const twTimer           = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Animated values ──────────────────────────────────────────────────────────

  const bgScale    = useRef(new Animated.Value(1.04)).current;
  const bgFade     = useRef(new Animated.Value(0)).current;
  const sweepX     = useRef(new Animated.Value(-500)).current;
  const sweepOpac  = useRef(new Animated.Value(0)).current;
  const redOpac    = useRef(new Animated.Value(0)).current;
  const bottomGlow = useRef(new Animated.Value(0)).current;
  const vignette   = useRef(new Animated.Value(0)).current;
  const siOpac     = useRef(new Animated.Value(0)).current;
  const whiteFade  = useRef(new Animated.Value(0)).current;
  const charFade   = useRef(new Animated.Value(0)).current;
  const barSlide   = useRef(new Animated.Value(60)).current;
  const barFade    = useRef(new Animated.Value(0)).current;
  const readyFade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
      if (twTimer.current) clearInterval(twTimer.current);
    };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function anim(val: Animated.Value, toValue: number, duration: number, cb?: () => void) {
    Animated.timing(val, { toValue, duration, useNativeDriver: false }).start(cb ?? (() => {}));
  }

  function after(ms: number, fn: () => void) {
    const t = setTimeout(() => { if (mountedRef.current) fn(); }, ms);
    timers.current.push(t);
  }

  function toStage(s: RevealStage) { stageRef.current = s; setStage(s); }

  // ── VN bar show / hide ───────────────────────────────────────────────────────

  function stopTypewriter() {
    if (twTimer.current) { clearInterval(twTimer.current); twTimer.current = null; }
  }

  function showDialogue(line: string, useTypewriter: boolean) {
    stopTypewriter();
    barFade.setValue(0); barSlide.setValue(60); charFade.setValue(0);
    setBeatVisible(true);
    if (!useTypewriter) {
      setDisplayed(line); setTypewriterDone(true);
    } else {
      setDisplayed(""); setTypewriterDone(false);
    }
    Animated.parallel([
      Animated.timing(barFade,  { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(barSlide, { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.timing(charFade, { toValue: 1, duration: 350, useNativeDriver: false }),
    ]).start(() => {
      if (!mountedRef.current || !useTypewriter) return;
      let pos = 0;
      const interval = Math.round(1000 / CHARS_PER_SEC);
      twTimer.current = setInterval(() => {
        pos += 1;
        setDisplayed(line.slice(0, pos));
        if (pos >= line.length) {
          stopTypewriter();
          if (mountedRef.current) setTypewriterDone(true);
        }
      }, interval);
    });
  }

  function hideDialogue(cb: () => void) {
    stopTypewriter();
    Animated.parallel([
      Animated.timing(barFade,  { toValue: 0, duration: 220, useNativeDriver: false }),
      Animated.timing(charFade, { toValue: 0, duration: 180, useNativeDriver: false }),
    ]).start(() => { setBeatVisible(false); cb(); });
  }

  // ── Loadout beat helpers ─────────────────────────────────────────────────────

  function startLoadoutBeat(idx: number) {
    if (!mountedRef.current) return;
    loadoutBeatIdxRef.current = idx;
    setLoadoutBeatIdx(idx);
    showDialogue(LOADOUT_BEATS[idx].line, true);
  }

  // ── Auto-advance SI lines ────────────────────────────────────────────────────

  function scheduleNextSiLine(current: number) {
    const next = current + 1;
    after(SI_LINE_HOLD_MS, () => {
      if (next < SI_LINES.length) {
        hideDialogue(() => {
          setSiLine(next);
          after(300, () => {
            showDialogue(SI_LINES[next], false);
            scheduleNextSiLine(next);
          });
        });
      } else {
        hideDialogue(() => runFreeze());
      }
    });
  }

  function runFreeze() {
    toStage("freeze");
    anim(whiteFade, 1, 180, () => {
      anim(whiteFade, 0, 250, () => {
        // Transition into loadout dialogue — soften the atmosphere, hide SI
        toStage("loadout");
        loadoutBeatIdxRef.current = 0;
        setLoadoutBeatIdx(0);
        anim(redOpac,    0.15, 900);
        anim(vignette,   0.40, 900);
        anim(siOpac,     0,    600);
        anim(bottomGlow, 0.40, 900);
        barSlide.setValue(60);
        barFade.setValue(0);
        charFade.setValue(0);
        after(1000, () => startLoadoutBeat(0));
      });
    });
  }

  // ── Background breathing ─────────────────────────────────────────────────────

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(bgScale, { toValue: 1.00, duration: 5000, useNativeDriver: false }),
        Animated.timing(bgScale, { toValue: 1.04, duration: 5000, useNativeDriver: false }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [bgScale]);

  // ── Main sequence ────────────────────────────────────────────────────────────

  useEffect(() => {
    anim(bgFade, 1, 800);
    after(1200, () => {
      toStage("pulse");
      sweepX.setValue(-500);
      anim(sweepOpac, 0.7, 150);
      anim(sweepX,    600, 700, () => { anim(sweepOpac, 0, 200); });
      anim(redOpac,    0.35, 1200);
      anim(bottomGlow, 0.9,  1000);
      anim(vignette,   0.55, 1000);
      after(1400, () => {
        toStage("react");
        setReactBeat(0);
        showDialogue(REACT_BEATS[0].line, true);
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tap handler ──────────────────────────────────────────────────────────────

  const handleTap = useCallback(() => {
    const s = stageRef.current;

    if (s === "react") {
      if (!typewriterDone) {
        stopTypewriter();
        setDisplayed(REACT_BEATS[reactBeat].line);
        setTypewriterDone(true);
        return;
      }
      hideDialogue(() => {
        const next = reactBeat + 1;
        if (next < REACT_BEATS.length) {
          setReactBeat(next);
          after(100, () => showDialogue(REACT_BEATS[next].line, true));
        } else {
          toStage("si_emerge");
          anim(redOpac,    0.60, 1200);
          anim(vignette,   0.85, 1200);
          anim(bottomGlow, 1,    600);
          after(600, () => { anim(siOpac, 1, 1200); });
          after(2200, () => {
            toStage("si_speak");
            setSiLine(0);
            showDialogue(SI_LINES[0], false);
            scheduleNextSiLine(0);
          });
        }
      });
      return;
    }

    if (s === "loadout") {
      if (!typewriterDone) {
        stopTypewriter();
        setDisplayed(LOADOUT_BEATS[loadoutBeatIdxRef.current].line);
        setTypewriterDone(true);
        return;
      }
      hideDialogue(() => {
        const next = loadoutBeatIdxRef.current + 1;
        if (next < LOADOUT_BEATS.length) {
          after(80, () => startLoadoutBeat(next));
        } else {
          toStage("ready");
          after(200, () => anim(readyFade, 1, 500));
        }
      });
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactBeat, typewriterDone, loadoutBeatIdx]);

  // ── Derived values ───────────────────────────────────────────────────────────

  const isReact   = stage === "react";
  const isSiStage = stage === "si_emerge" || stage === "si_speak";
  const isLoadout = stage === "loadout";
  const isReady   = stage === "ready";

  const curReactSpeaker   = PROLOGUE_CHARACTERS[REACT_BEATS[reactBeat].speaker];
  const curLoadoutSpeaker = PROLOGUE_CHARACTERS[LOADOUT_BEATS[Math.min(loadoutBeatIdx, LOADOUT_BEATS.length - 1)].speaker];
  const activeSpeaker     = isReact ? curReactSpeaker : isLoadout ? curLoadoutSpeaker : null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Pressable style={styles.root} onPress={handleTap} testID="si-reveal-scene">

      {/* ── Battlefield background ── */}
      <Animated.View style={[styles.bgWrap, { opacity: bgFade, transform: [{ scale: bgScale }] }]}>
        <ExpoImage source={ART.battlefield} style={styles.bg} contentFit="cover" />
      </Animated.View>

      {/* ── Heartbeat sweep stripe ── */}
      <Animated.View
        style={[styles.sweepStripe, { opacity: sweepOpac, transform: [{ translateX: sweepX }] }]}
        pointerEvents="none"
      />

      {/* ── Red overlay (trap closing in) ── */}
      <Animated.View style={[styles.redOverlay, { opacity: redOpac }]} pointerEvents="none" />

      {/* ── Bottom crimson glow ── */}
      <Animated.View style={[styles.bottomGlowWrap, { opacity: bottomGlow }]} pointerEvents="none">
        <LinearGradient
          colors={["transparent", "rgba(139,0,0,0.55)", "rgba(80,0,0,0.80)"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── Dark vignette ── */}
      <Animated.View style={[styles.vignette, { opacity: vignette }]} pointerEvents="none">
        <LinearGradient
          colors={["rgba(0,0,0,0.70)", "transparent", "transparent", "rgba(0,0,0,0.60)"]}
          locations={[0, 0.25, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── Silent Infarction portrait (emerges from fog during si_emerge/si_speak) ── */}
      {isSiStage && (
        <Animated.View style={[styles.siWrap, { opacity: siOpac }]} pointerEvents="none">
          <ExpoImage source={ART.si} style={styles.siPortrait} contentFit="contain" />
          <LinearGradient
            colors={["transparent", "rgba(160,0,0,0.55)", "transparent"]}
            locations={[0, 0.45, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.siGlow}
          />
        </Animated.View>
      )}

      {/* ── Hero character portrait — grounded above VN bar ── */}
      {beatVisible && (isReact || isLoadout) && (
        <Animated.View
          style={[styles.charWrap, { opacity: charFade, bottom: 0 }]}
          pointerEvents="none"
        >
          <ExpoImage
            source={activeSpeaker!.largePortrait}
            style={[
              styles.charArt,
              activeSpeaker!.largePortrait === PROLOGUE_CHARACTERS.NIGHTINGALE.largePortrait && { width: W, height: H * 0.99, transform: [{ translateY: H * 0.495 }] },
              activeSpeaker!.largePortrait === PROLOGUE_CHARACTERS.FLEMING.largePortrait    && { transform: [{ translateY: H * 0.1 }] },
            ]}
            contentFit="contain"
            contentPosition={activeSpeaker!.largePortrait === PROLOGUE_CHARACTERS.NIGHTINGALE.largePortrait ? "top" : "bottom"}
          />
        </Animated.View>
      )}

      {/* ── VN Dialogue Bar ── */}
      {beatVisible && (
        <Animated.View
          style={[
            styles.vnBar,
            {
              opacity:         barFade,
              transform:       [{ translateY: barSlide }],
              height:          barTotal,
              paddingBottom:   insets.bottom + 14,
              backgroundColor: activeSpeaker ? activeSpeaker.barColor : SI_SPEAKER.barColor,
              borderTopColor:  activeSpeaker ? `${activeSpeaker.color}66` : SI_SPEAKER.barBorder,
            },
          ]}
          pointerEvents="none"
        >
          <View style={[styles.vnBarAccent, { backgroundColor: activeSpeaker ? activeSpeaker.color : SI_SPEAKER.color }]} />
          <View style={styles.vnBarInner}>
            <View style={styles.vnLeftCol}>
              <View style={[styles.vnAvatarRing, { borderColor: activeSpeaker ? activeSpeaker.color : SI_SPEAKER.color }]}>
                <ExpoImage
                  source={activeSpeaker ? activeSpeaker.avatar48 : ART.si}
                  style={styles.vnAvatarImg}
                  contentFit={activeSpeaker ? "cover" : "contain"}
                />
              </View>
              <Text style={[styles.vnSpeakerName, { color: activeSpeaker ? activeSpeaker.color : SI_SPEAKER.color }]}>
                {activeSpeaker ? activeSpeaker.name : SI_SPEAKER.name}
              </Text>
            </View>

            <View style={styles.vnTextCol}>
              {(isReact || isLoadout) ? (
                <Text style={styles.vnDlgText} numberOfLines={4}>
                  {displayed}
                  {!typewriterDone && <Text style={{ color: activeSpeaker!.color }}>▌</Text>}
                </Text>
              ) : (
                <Text style={styles.vnSiText} numberOfLines={4}>{displayed}</Text>
              )}
            </View>

            {(isReact || isLoadout) && typewriterDone && (
              <View style={styles.vnArrowWrap}>
                <Text style={[styles.vnArrow, { color: activeSpeaker!.color }]}>▾</Text>
              </View>
            )}
          </View>
        </Animated.View>
      )}

      {/* ── ENTER THE BATTLEFIELD button (ready stage) ── */}
      {isReady && (
        <Animated.View
          style={[styles.startBtnWrap, { opacity: readyFade, paddingBottom: insets.bottom + 16 }]}
          pointerEvents="box-none"
        >
          <Pressable style={styles.startBtn} onPress={onComplete} testID="loadout-enter-battle">
            <LinearGradient
              colors={["#8B1A1A", "#B22222", "#8B1A1A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startBtnGradient}
            >
              <Text style={styles.startBtnText}>ENTER THE BATTLEFIELD</Text>
            </LinearGradient>
          </Pressable>
          <Text style={styles.startBtnSub}>Assess.  Prioritize.  Intervene.  Reassess.</Text>
        </Animated.View>
      )}

      {/* ── White freeze flash (full-screen overlay) ── */}
      <Animated.View style={[styles.flashOverlay, { opacity: whiteFade }]} pointerEvents="none" />

      {/* ── Scene label ── */}
      {!isLoadout && !isReady && (
        <SafeAreaView style={styles.topSafe} pointerEvents="none">
          <Text style={styles.sceneLabel}>EMERGENCY TREATMENT PLAZA  ·  TRAP ACTIVE</Text>
        </SafeAreaView>
      )}

    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#040A12" },

  bgWrap: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  bg:     { width: "100%", height: "100%" },

  sweepStripe: {
    position:        "absolute",
    top:             0,
    bottom:          0,
    left:            0,
    width:           120,
    backgroundColor: "#FF0000",
  },

  redOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: "#6B0000" },
  flashOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#FFFFFF" },

  bottomGlowWrap: { position: "absolute", bottom: 0, left: 0, right: 0, height: "40%" },
  vignette:       { ...StyleSheet.absoluteFillObject },

  siWrap: {
    position:       "absolute",
    top:            -40,
    left:           0,
    right:          0,
    height:         "78%",
    alignItems:     "center",
    justifyContent: "flex-end",
  },
  siPortrait: { width: 440, height: 640, zIndex: 2 },
  siGlow: {
    position:     "absolute",
    bottom:       40,
    width:        520,
    height:       460,
    borderRadius: 260,
    overflow:     "hidden",
  },

  charWrap: {
    position:       "absolute",
    left:           0,
    right:          0,
    height:         H,
    alignItems:     "center",
    justifyContent: "flex-end",
  },
  charArt: { width: W, height: H * 0.66 },

  vnBar: {
    position:       "absolute",
    bottom:         0,
    left:           0,
    right:          0,
    borderTopWidth: 1.5,
  },
  vnBarAccent: { height: 2, width: "100%", opacity: 0.8 },
  vnBarInner: {
    flex:              1,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingTop:        12,
    gap:               14,
  },
  vnLeftCol: { alignItems: "center", gap: 6, flexShrink: 0, width: 80 },
  vnAvatarRing: {
    width:        80,
    height:       80,
    borderRadius: 40,
    borderWidth:  3,
    overflow:     "hidden",
  },
  vnAvatarImg: { width: "100%", height: "100%" },
  vnSpeakerName: {
    fontSize:      10,
    fontWeight:    "800",
    letterSpacing: 1.2,
    textAlign:     "center",
    textTransform: "uppercase",
    lineHeight:    14,
  },
  vnTextCol: { flex: 1 },
  vnDlgText: {
    color:      "#E8EEF6",
    fontSize:   17,
    fontWeight: "400",
    lineHeight: 26,
  },
  vnSiText: {
    color:         "rgba(255,210,210,0.92)",
    fontSize:      16,
    fontWeight:    "300",
    lineHeight:    26,
    letterSpacing: 0.6,
    fontStyle:     "italic",
  },
  vnArrowWrap: { alignSelf: "flex-end", paddingBottom: 4, flexShrink: 0 },
  vnArrow:     { fontSize: 24, fontWeight: "900", opacity: 0.9 },

  startBtnWrap: {
    position:          "absolute",
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 24,
    alignItems:        "center",
    gap:               10,
  },
  startBtn: { width: "100%", borderRadius: 10, overflow: "hidden" },
  startBtnGradient: {
    paddingVertical: 18,
    alignItems:      "center",
    justifyContent:  "center",
  },
  startBtnText: {
    color:         "#FFFFFF",
    fontSize:      14,
    fontWeight:    "800",
    letterSpacing: 3.5,
  },
  startBtnSub: {
    color:         "rgba(255,255,255,0.28)",
    fontSize:      11,
    letterSpacing: 1.2,
    textAlign:     "center",
  },

  topSafe: {
    position:          "absolute",
    top:               0,
    left:              0,
    right:             0,
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
});
