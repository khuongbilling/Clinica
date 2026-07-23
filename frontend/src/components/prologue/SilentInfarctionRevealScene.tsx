/**
 * SilentInfarctionRevealScene
 *
 * Phase: silent_infarction_initial_reveal
 *
 * VN-style dialogue — same methodology as FormerSelfVictoryCutscene:
 *   React beats : hero large portrait (right, grounded) + bottom VN bar
 *                 (avatar ring · speaker name · typewriter text · ▾ arrow)
 *   SI speaks   : crimson VN bar (SI avatar · auto-display italic lines)
 *
 * Stage machine:
 *  quiet → pulse → react → si_emerge → si_speak → freeze → out
 *
 * Image consistency:
 *  All hero portraits from PROLOGUE_CHARACTERS (same source as other VN scenes).
 *  SI portrait uses silent_infarction_nobg.png (background removed).
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
  | "out";

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
  const insets  = useSafeAreaInsets();
  const barTotal = BAR_HEIGHT + insets.bottom;

  const [stage,          setStage]          = useState<RevealStage>("quiet");
  const [reactBeat,      setReactBeat]      = useState(0);
  const [siLine,         setSiLine]         = useState(0);
  const [beatVisible,    setBeatVisible]    = useState(false);
  const [displayed,      setDisplayed]      = useState("");
  const [typewriterDone, setTypewriterDone] = useState(false);

  const stageRef   = useRef<RevealStage>("quiet");
  const mountedRef = useRef(true);
  const timers     = useRef<ReturnType<typeof setTimeout>[]>([]);
  const twTimer    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Animated values ─────────────────────────────────────────────────────────

  const bgScale    = useRef(new Animated.Value(1.04)).current;
  const bgFade     = useRef(new Animated.Value(0)).current;
  const sweepX     = useRef(new Animated.Value(-500)).current;
  const sweepOpac  = useRef(new Animated.Value(0)).current;
  const redOpac    = useRef(new Animated.Value(0)).current;
  const bottomGlow = useRef(new Animated.Value(0)).current;
  const vignette   = useRef(new Animated.Value(0)).current;
  const siOpac     = useRef(new Animated.Value(0)).current;
  const whiteFade  = useRef(new Animated.Value(0)).current;
  const blackFade  = useRef(new Animated.Value(0)).current;
  // VN bar (same pattern as FormerSelfVictoryCutscene)
  const charFade   = useRef(new Animated.Value(0)).current;
  const barSlide   = useRef(new Animated.Value(60)).current;
  const barFade    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
      if (twTimer.current) clearInterval(twTimer.current);
    };
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────

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

  function toStage(s: RevealStage) { stageRef.current = s; setStage(s); }

  // ── VN bar show / hide (same mechanics as FormerSelfVictoryCutscene) ─────────

  function showDialogue(line: string, useTypewriter: boolean) {
    if (twTimer.current) { clearInterval(twTimer.current); twTimer.current = null; }
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
          if (twTimer.current) { clearInterval(twTimer.current); twTimer.current = null; }
          if (mountedRef.current) setTypewriterDone(true);
        }
      }, interval);
    });
  }

  function hideDialogue(cb: () => void) {
    if (twTimer.current) { clearInterval(twTimer.current); twTimer.current = null; }
    Animated.parallel([
      Animated.timing(barFade,  { toValue: 0, duration: 220, useNativeDriver: false }),
      Animated.timing(charFade, { toValue: 0, duration: 180, useNativeDriver: false }),
    ]).start(() => { setBeatVisible(false); cb(); });
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
        toStage("out");
        anim(blackFade, 1, 900, () => { if (mountedRef.current) onComplete(); });
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
      anim(sweepX, 600, 700, () => { anim(sweepOpac, 0, 200); });
      anim(redOpac, 0.35, 1200);
      anim(bottomGlow, 0.9, 1000);
      anim(vignette, 0.55, 1000);
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
    if (stageRef.current !== "react") return;
    if (!typewriterDone) {
      if (twTimer.current) { clearInterval(twTimer.current); twTimer.current = null; }
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
        anim(redOpac, 0.60, 1200);
        anim(vignette, 0.85, 1200);
        anim(bottomGlow, 1, 600);
        after(600, () => { anim(siOpac, 1, 1200); });
        after(2200, () => {
          toStage("si_speak");
          setSiLine(0);
          showDialogue(SI_LINES[0], false);
          scheduleNextSiLine(0);
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactBeat, typewriterDone]);

  // ── Derived values ───────────────────────────────────────────────────────────

  const isReact   = stage === "react";
  const isSiStage = stage === "si_emerge" || stage === "si_speak";
  const curBeat   = REACT_BEATS[reactBeat];
  const curSpeaker = PROLOGUE_CHARACTERS[curBeat.speaker];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Pressable style={styles.root} onPress={handleTap} testID="si-reveal-scene">

      {/* ── Battlefield ── */}
      <Animated.View style={[styles.bgWrap, { opacity: bgFade, transform: [{ scale: bgScale }] }]}>
        <ExpoImage source={ART.battlefield} style={styles.bg} contentFit="cover" />
      </Animated.View>

      {/* ── Heartbeat sweep stripe ── */}
      <Animated.View
        style={[styles.sweepStripe, { opacity: sweepOpac, transform: [{ translateX: sweepX }] }]}
        pointerEvents="none"
      />

      {/* ── Red overlay (trap closing) ── */}
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

      {/* ── Silent Infarction portrait (emerges from fog, no background) ── */}
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

      {/* ── Hero character portrait — right side, grounded behind VN bar ── */}
      {beatVisible && isReact && (
        <Animated.View
          style={[styles.charWrap, { bottom: barTotal - 80, opacity: charFade }]}
          pointerEvents="none"
        >
          <ExpoImage
            source={curSpeaker.largePortrait}
            style={styles.charArt}
            contentFit="contain"
            contentPosition="bottom"
          />
        </Animated.View>
      )}

      {/* ── VN Dialogue Bar (same pattern as FormerSelfVictoryCutscene) ── */}
      {beatVisible && (
        <Animated.View
          style={[
            styles.vnBar,
            {
              opacity:         barFade,
              transform:       [{ translateY: barSlide }],
              height:          barTotal,
              paddingBottom:   insets.bottom + 14,
              backgroundColor: isReact ? curSpeaker.barColor : SI_SPEAKER.barColor,
              borderTopColor:  isReact ? `${curSpeaker.color}66` : SI_SPEAKER.barBorder,
            },
          ]}
          pointerEvents="none"
        >
          <View style={[styles.vnBarAccent, { backgroundColor: isReact ? curSpeaker.color : SI_SPEAKER.color }]} />
          <View style={styles.vnBarInner}>
            {/* Left column: avatar + speaker name */}
            <View style={styles.vnLeftCol}>
              <View style={[styles.vnAvatarRing, { borderColor: isReact ? curSpeaker.color : SI_SPEAKER.color }]}>
                <ExpoImage
                  source={isReact ? curSpeaker.avatar48 : ART.si}
                  style={styles.vnAvatarImg}
                  contentFit={isReact ? "cover" : "contain"}
                />
              </View>
              <Text style={[styles.vnSpeakerName, { color: isReact ? curSpeaker.color : SI_SPEAKER.color }]}>
                {isReact ? curSpeaker.name : SI_SPEAKER.name}
              </Text>
            </View>

            {/* Right column: dialogue text */}
            <View style={styles.vnTextCol}>
              {isReact ? (
                <Text style={styles.vnDlgText} numberOfLines={4}>
                  {displayed}
                  {!typewriterDone && (
                    <Text style={{ color: curSpeaker.color }}>▌</Text>
                  )}
                </Text>
              ) : (
                <Text style={styles.vnSiText} numberOfLines={4}>
                  {displayed}
                </Text>
              )}
            </View>

            {/* Advance arrow (react only, when typewriter done) */}
            {isReact && typewriterDone && (
              <View style={styles.vnArrowWrap}>
                <Text style={[styles.vnArrow, { color: curSpeaker.color }]}>▾</Text>
              </View>
            )}
          </View>
        </Animated.View>
      )}

      {/* ── White freeze flash ── */}
      <Animated.View style={[styles.flashOverlay, { opacity: whiteFade }]} pointerEvents="none" />

      {/* ── Black final fade ── */}
      <Animated.View style={[styles.blackOverlay, { opacity: blackFade }]} pointerEvents="none" />

      {/* ── Scene label (top) ── */}
      <SafeAreaView style={styles.topSafe} pointerEvents="none">
        <Text style={styles.sceneLabel}>EMERGENCY TREATMENT PLAZA  ·  TRAP ACTIVE</Text>
      </SafeAreaView>

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

  redOverlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: "#6B0000" },
  flashOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: "#FFFFFF" },
  blackOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: "#000000" },

  bottomGlowWrap: { position: "absolute", bottom: 0, left: 0, right: 0, height: "40%" },
  vignette:       { ...StyleSheet.absoluteFillObject },

  siWrap: {
    position:       "absolute",
    top:            0,
    left:           0,
    right:          0,
    height:         "60%",
    alignItems:     "center",
    justifyContent: "flex-end",
  },
  siPortrait: { width: 220, height: 320, zIndex: 2 },
  siGlow: {
    position:     "absolute",
    bottom:       20,
    width:        300,
    height:       280,
    borderRadius: 150,
    overflow:     "hidden",
  },

  // Hero portrait — right side, grounded behind VN bar (same as FormerSelfVictoryCutscene)
  charWrap: {
    position:       "absolute",
    right:          0,
    alignItems:     "flex-end",
    justifyContent: "flex-end",
    width:          W * 0.80,
    height:         H * 0.82,
  },
  charArt: { width: "100%", height: "100%" },

  // VN Bar (mirrors FormerSelfVictoryCutscene)
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
  vnAvatarImg:   { width: "100%", height: "100%" },
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

  // Scene label
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
