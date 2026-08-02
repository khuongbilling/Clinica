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
 *
 * VN bar uses PrologueVNBar:
 *  – react / loadout stages: hero portrait + standard typewriter bar
 *  – si_speak stage: no right portrait (SI is shown as a large centred presence),
 *    SI speaker in bar with monologue text style (italic, auto-advance, no arrow)
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
import { type PrologueSpeakerId } from "../../game/prologueCharacters";
import { useVNTypewriter } from "../../hooks/useVNTypewriter";
import PrologueVNBar, { vnSpeakerFor, VN_BAR_HEIGHT, type VNSpeakerDef } from "./PrologueVNBar";

const { width: W } = Dimensions.get("window");

const ART = {
  battlefield: require("../../../assets/images/tactical_battlefield.png"),
  si:          require("../../../assets/images/silent_infarction_nobg.png"),
} as const;

// ── The Silent Infarction as a VNSpeakerDef ───────────────────────────────────

const SI_SPEAKER: VNSpeakerDef = {
  name:          "THE SILENT\nINFARCTION",
  color:         "#8B1A1A",
  barColor:      "rgba(15,2,2,0.96)",
  largePortrait: ART.si,
  avatar:        ART.si,
  artFit:        "contain",
  avatarFit:     "contain",   // enemy PNG, not a face crop
};

// ── Dialogue beats ────────────────────────────────────────────────────────────

type RevealStage =
  | "quiet" | "pulse" | "react"
  | "si_emerge" | "si_speak"
  | "freeze" | "loadout" | "ready";

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

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { onComplete: () => void }

export default function SilentInfarctionRevealScene({ onComplete }: Props) {
  const insets   = useSafeAreaInsets();
  const barTotal = VN_BAR_HEIGHT + insets.bottom;

  const [stage,          setStage]          = useState<RevealStage>("quiet");
  const [reactBeat,      setReactBeat]      = useState(0);
  const [siLine,         setSiLine]         = useState(0);
  const [loadoutBeatIdx, setLoadoutBeatIdx] = useState(0);
  const [beatVisible,    setBeatVisible]    = useState(false);

  const stageRef          = useRef<RevealStage>("quiet");
  const loadoutBeatIdxRef = useRef(0);
  const mountedRef        = useRef(true);
  const timers            = useRef<ReturnType<typeof setTimeout>[]>([]);

  const {
    displayed,
    typewriterDone,
    startTypewriter,
    skipTypewriter,
    stopTypewriter,
    instantShow,
  } = useVNTypewriter(CHARS_PER_SEC);

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
    };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function anim(val: Animated.Value, toValue: number, duration: number, cb?: () => void) {
    Animated.timing(val, { toValue, duration, useNativeDriver: true }).start(cb ?? (() => {}));
  }

  function after(ms: number, fn: () => void) {
    const t = setTimeout(() => { if (mountedRef.current) fn(); }, ms);
    timers.current.push(t);
  }

  function toStage(s: RevealStage) { stageRef.current = s; setStage(s); }

  // ── VN bar show / hide ───────────────────────────────────────────────────────

  function showDialogue(line: string, useTypewriter: boolean) {
    stopTypewriter();
    barFade.setValue(0); barSlide.setValue(60); charFade.setValue(0);
    setBeatVisible(true);
    // For instant mode (SI monologue), set text before animation starts
    if (!useTypewriter) instantShow(line);
    Animated.parallel([
      Animated.timing(barFade,  { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(barSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(charFade, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start(() => {
      if (!mountedRef.current || !useTypewriter) return;
      startTypewriter(line);
    });
  }

  function hideDialogue(cb: () => void) {
    stopTypewriter();
    Animated.parallel([
      Animated.timing(barFade,  { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(charFade, { toValue: 0, duration: 180, useNativeDriver: true }),
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
        Animated.timing(bgScale, { toValue: 1.00, duration: 5000, useNativeDriver: true }),
        Animated.timing(bgScale, { toValue: 1.04, duration: 5000, useNativeDriver: true }),
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
        skipTypewriter(REACT_BEATS[reactBeat].line);
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
        skipTypewriter(LOADOUT_BEATS[loadoutBeatIdxRef.current].line);
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

  const activeSpeakerId: PrologueSpeakerId | null =
    isReact   ? REACT_BEATS[reactBeat].speaker
  : isLoadout ? LOADOUT_BEATS[Math.min(loadoutBeatIdx, LOADOUT_BEATS.length - 1)].speaker
  : null;

  const activeVNSpeaker: VNSpeakerDef =
    activeSpeakerId ? vnSpeakerFor(activeSpeakerId) : SI_SPEAKER;

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

      {/* ── Silent Infarction centred portrait (emerges during si_emerge / si_speak) ── */}
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

      {/* ── VN portrait + dialogue bar (shared component) ── */}
      <PrologueVNBar
        speaker={activeVNSpeaker}
        displayed={displayed}
        typewriterDone={typewriterDone}
        barSlide={barSlide}
        barFade={barFade}
        charFade={charFade}
        visible={beatVisible}
        showPortrait={isReact || isLoadout}
        textVariant={isSiStage ? "monologue" : "normal"}
        showArrow={(isReact || isLoadout) && typewriterDone}
      />

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

      {/* ── White freeze flash ── */}
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
