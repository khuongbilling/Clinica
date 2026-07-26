/**
 * LotusRecallCinematic.tsx  (Push 7)
 *
 * Defeat-aftermath cinematic for the `lotus_recall_cinematic` prologue phase.
 * Plays immediately after PrologueScriptedBattle's scripted defeat.
 *
 * Three acts:
 *   Act 1 — Dialogue      (tap-to-advance, 4 beats)
 *   Act 2 — Visual        (auto-advancing, ~18 s)
 *               destabilize → overwhelm → silence → lotus_appear → silhouette → reaching
 *   Act 3 — Result screen (static Lotus Recall card, gold CTA button)
 *
 * Art style: donghua / Genshin-Impact cel-shading.
 * useNativeDriver: false everywhere.  pointerEvents as View prop only.
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

const { width: W, height: H } = Dimensions.get("window");
import { LinearGradient } from "expo-linear-gradient";
import { Image as ExpoImage } from "expo-image";

// ── Art assets ────────────────────────────────────────────────────────────────
import { PROLOGUE_CHARACTERS } from "../../game/prologueCharacters";

const ART = {
  battlefield:     require("../../../assets/images/tactical_battlefield.png"),
  nightingale:     PROLOGUE_CHARACTERS.NIGHTINGALE.avatar48,
  fleming:         require("../../../assets/images/fleming_vn_bust.png"),
  masterBai:       PROLOGUE_CHARACTERS.MASTER_BAI.avatar48,
  formerSelf:      PROLOGUE_CHARACTERS.PRODIGY.avatar48,
  // Canonical full-body VN art used for the disappearing sequence — distinct
  // from the portrait crop used in dialogue bars.
  prodigyCanonical: require("../../../assets/images/prodigy_vn_canonical.png"),
};

// ── Dialogue beats ────────────────────────────────────────────────────────────
interface DialogueBeat {
  speaker:  string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  portrait: any;
  color:    string;
  text:     string;
}

const DIALOGUE_BEATS: DialogueBeat[] = [
  {
    speaker:  "FLORENCE NIGHTINGALE",
    portrait: ART.nightingale,
    color:    "#E8C453",
    text:     '"We can stabilize the others, but we cannot reach you in time!"',
  },
  {
    speaker:  "ALEXANDER FLEMING",
    portrait: ART.fleming,
    color:    "#3ECFB2",
    text:     '"The enemy adapted to every intervention you used against the decoy."',
  },
  {
    speaker:  "MASTER BAI",
    portrait: ART.masterBai,
    color:    "#D9A441",
    text:     '"Your strength was never the problem."',
  },
  {
    speaker:  "MASTER BAI",
    portrait: ART.masterBai,
    color:    "#D9A441",
    text:     '"You stopped listening before the battle began."',
  },
];

// ── Lotus petal scatter layout ────────────────────────────────────────────────
interface Petal {
  top?:   string;
  left?:  string;
  right?: string;
  rot:    number;
  w:      number;
  h:      number;
}

const PETALS: Petal[] = [
  { top: "18%", left:  "14%", rot:  25, w: 20, h: 30 },
  { top: "12%", right: "22%", rot: -12, w: 16, h: 24 },
  { top: "38%", left:  "70%", rot:  48, w: 18, h: 28 },
  { top: "58%", left:  "22%", rot: -30, w: 22, h: 32 },
  { top: "70%", right: "18%", rot:  15, w: 14, h: 22 },
  { top: "28%", left:  "42%", rot: -45, w: 17, h: 26 },
  { top: "75%", left:  "52%", rot:  62, w: 15, h: 23 },
  { top: "48%", left:   "8%", rot: -20, w: 12, h: 18 },
];

// ── Result-screen status lines ────────────────────────────────────────────────
const RESULT_LINES = [
  { icon: "◈", label: "TIMELINE FAILED",               color: "#E85555" },
  { icon: "✦", label: "LOTUS RECALL TRIGGERED",         color: "#D9A441" },
  { icon: "◆", label: "HEALER'S RHYTHM LEARNED",        color: "#3ECFB2" },
  { icon: "◉", label: "IDENTITY RECONSTRUCTION PENDING", color: "#EDF2F7" },
];

// ── Stage types ───────────────────────────────────────────────────────────────
type Stage =
  | "fade_in"
  | "dialogue"
  | "destabilize"
  | "overwhelm"
  | "silence"
  | "lotus_appear"
  | "silhouette"
  | "reaching"
  | "result_screen";

// ─────────────────────────────────────────────────────────────────────────────

interface Props { onComplete: () => void; }

export default function LotusRecallCinematic({ onComplete }: Props) {
  const mountedRef = useRef(true);
  const timers     = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // ── Stage ──────────────────────────────────────────────────────────────────
  const [stage, setStage]             = useState<Stage>("fade_in");
  const stageRef                      = useRef<Stage>("fade_in");
  const [dialogueIdx, setDialogueIdx] = useState(0);
  const dialogueIdxRef                = useRef(0);

  const toStage = (s: Stage) => { stageRef.current = s; setStage(s); };

  // ── Utilities ──────────────────────────────────────────────────────────────
  const after = useCallback((ms: number, fn: () => void) => {
    const id = setTimeout(() => { if (mountedRef.current) fn(); }, ms);
    timers.current.push(id);
  }, []);

  const anim = useCallback((
    val: Animated.Value,
    toVal: number,
    dur: number,
    cb?: () => void,
  ) => {
    Animated.timing(val, { toValue: toVal, duration: dur, useNativeDriver: false })
      .start(cb ? ({ finished }) => { if (finished && mountedRef.current) cb(); } : undefined);
  }, []);

  // ── Animation values ──────────────────────────────────────────────────────

  // Scene / backdrop
  const bgFade     = useRef(new Animated.Value(0)).current;
  const bgLift     = useRef(new Animated.Value(0)).current;   // 0 → -50 (camera rises)
  const screenDark = useRef(new Animated.Value(0)).current;   // 0 → 0.92

  // Act 1 — dialogue
  const charFade  = useRef(new Animated.Value(0)).current;
  const charSlide = useRef(new Animated.Value(30)).current;
  const dlgFade   = useRef(new Animated.Value(0)).current;

  // Act 2 — destabilize
  const auraOpacity = useRef(new Animated.Value(0)).current;
  const auraScale   = useRef(new Animated.Value(0.55)).current;
  const crackFlash  = useRef(new Animated.Value(0)).current;
  const formerDim   = useRef(new Animated.Value(1)).current;

  // Act 2 — overwhelm
  const goldX     = useRef(new Animated.Value(-130)).current;
  const tealX     = useRef(new Animated.Value(130)).current;
  const allyFade  = useRef(new Animated.Value(0)).current;
  const darkCloud = useRef(new Animated.Value(0)).current;

  // Act 2 — silence / heartbeat
  const hbScale    = useRef(new Animated.Value(1)).current;
  const hbOpacity  = useRef(new Animated.Value(0)).current;
  const silBlack   = useRef(new Animated.Value(0)).current;

  // Act 2 — lotus petals
  const petalFades = useRef(PETALS.map(() => new Animated.Value(0))).current;

  // Act 2 — silhouette
  const silFade  = useRef(new Animated.Value(0)).current;
  const silGlow  = useRef(new Animated.Value(0)).current;
  const silShift = useRef(new Animated.Value(0)).current;  // reach: 0 → 28

  // Act 3 — result
  const resultFade = useRef(new Animated.Value(0)).current;

  // ── Kick off on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    anim(bgFade, 1, 1400, () => {
      after(350, () => {
        toStage("dialogue");
        anim(charSlide, 0, 360);
        anim(charFade, 1, 360);
        after(100, () => anim(dlgFade, 1, 420));
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Dialogue tap handler ──────────────────────────────────────────────────
  const handleDialogueTap = useCallback(() => {
    if (stageRef.current !== "dialogue") return;
    const next = dialogueIdxRef.current + 1;

    if (next >= DIALOGUE_BEATS.length) {
      anim(dlgFade, 0, 240, () => {
        anim(charFade, 0, 300, () => {
          toStage("destabilize");
          startDestabilize();
        });
      });
    } else {
      anim(dlgFade, 0, 200, () => {
        anim(charFade, 0, 220, () => {
          dialogueIdxRef.current = next;
          setDialogueIdx(next);
          charSlide.setValue(30);
          anim(charSlide, 0, 360);
          anim(charFade, 1, 360);
          after(80, () => anim(dlgFade, 1, 360));
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Act 2: Visual-sequence chain ─────────────────────────────────────────

  const startDestabilize = useCallback(() => {
    // Slow camera ascent + progressive darkening run the whole visual sequence
    anim(bgLift, -50, 18_000);
    anim(screenDark, 0.90, 7_000);

    anim(formerDim, 0.55, 2_200);

    after(200, () => {
      anim(auraOpacity, 0.85, 600);
      Animated.timing(auraScale, {
        toValue: 2.4, duration: 2_300, useNativeDriver: false,
      }).start();
    });

    // Equipment-crack white flash
    after(1_000, () => {
      anim(crackFlash, 1, 100, () => anim(crackFlash, 0, 300));
    });

    after(2_800, () => { toStage("overwhelm"); startOverwhelm(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startOverwhelm = useCallback(() => {
    anim(allyFade, 0.88, 500);
    Animated.timing(goldX, { toValue: -28, duration: 2_400, useNativeDriver: false }).start();
    Animated.timing(tealX, { toValue:  28, duration: 2_400, useNativeDriver: false }).start();

    after(900, () => anim(darkCloud, 0.68, 1_600));
    // Allies' reach fails — their glow fades
    after(2_300, () => anim(allyFade, 0, 550));

    after(3_000, () => { toStage("silence"); startSilence(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSilence = useCallback(() => {
    anim(silBlack, 0.84, 1_300);

    // Four heartbeat pulses, each slower and quieter
    const pulse = (delay: number, scale: number, opStart: number, dur: number) => {
      after(delay, () => {
        hbScale.setValue(1);
        hbOpacity.setValue(opStart);
        Animated.sequence([
          Animated.timing(hbScale, { toValue: scale, duration: dur * 0.38, useNativeDriver: false }),
          Animated.timing(hbScale, { toValue: 1,     duration: dur * 0.62, useNativeDriver: false }),
        ]).start();
        anim(hbOpacity, 0, dur);
      });
    };

    pulse(400,  1.22, 0.70, 460);
    pulse(1_400, 1.16, 0.52, 560);
    pulse(2_700, 1.10, 0.36, 720);
    pulse(4_100, 1.05, 0.20, 900);

    after(4_300, () => { toStage("lotus_appear"); startLotus(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startLotus = useCallback(() => {
    petalFades.forEach((pf, i) => {
      after(i * 200, () => anim(pf, 1, 520));
    });
    after(2_800, () => { toStage("silhouette"); startSilhouette(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSilhouette = useCallback(() => {
    anim(silFade, 1, 620);
    after(320, () => anim(silGlow, 0.80, 1_600));
    after(2_500, () => { toStage("reaching"); startReaching(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startReaching = useCallback(() => {
    Animated.timing(silShift, { toValue: 28, duration: 2_100, useNativeDriver: false }).start();
    after(1_900, () => {
      anim(silFade, 0, 850, () => {
        anim(silBlack, 1, 700, () => {
          after(450, () => {
            toStage("result_screen");
            anim(resultFade, 1, 950);
          });
        });
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const petalView = (p: Petal, i: number, opacityOverride?: number, scaleOverride?: number) => {
    const pos: Record<string, string | number> = {};
    if (p.top   !== undefined) pos.top   = p.top;
    if (p.left  !== undefined) pos.left  = p.left;
    if (p.right !== undefined) pos.right = p.right;
    const w = p.w * (scaleOverride ?? 1);
    const h = p.h * (scaleOverride ?? 1);

    return (
      <Animated.View
        key={i}
        style={[
          styles.petal,
          pos,
          { width: w, height: h, transform: [{ rotate: `${p.rot}deg` }],
            opacity: opacityOverride !== undefined ? opacityOverride : petalFades[i] },
        ]}
      >
        <LinearGradient
          colors={["rgba(255,210,240,0.90)", "rgba(230,150,200,0.70)"]}
          style={styles.petalGrad}
        />
      </Animated.View>
    );
  };

  const beat = DIALOGUE_BEATS[dialogueIdx];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>

      {/* ── BATTLEFIELD BACKGROUND ────────────────────────────────────────── */}
      <Animated.View style={[
        StyleSheet.absoluteFill,
        { opacity: bgFade, transform: [{ translateY: bgLift }] },
      ]}>
        <ExpoImage source={ART.battlefield} style={styles.bg} contentFit="cover" />
        <LinearGradient
          colors={["rgba(4,10,18,0.40)", "rgba(4,10,18,0.78)"]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── PROGRESSIVE DARKNESS ──────────────────────────────────────────── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#040A12", opacity: screenDark }]}
        pointerEvents="none"
      />

      {/* ══════════════════════════════════════════════════════════════════════
          ACT 1 — DIALOGUE
      ══════════════════════════════════════════════════════════════════════ */}
      {stage === "dialogue" && (
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDialogueTap}>
          <SafeAreaView style={styles.dialogueSafe}>

            <Animated.View style={[
              styles.dlgPanel,
              { opacity: charFade, transform: [{ translateY: charSlide }] },
            ]}>
              <LinearGradient
                colors={["rgba(6,14,26,0.93)", "rgba(10,20,38,0.97)"]}
                style={styles.dlgPanelBg}
              />

              {/* Portrait + name row */}
              <View style={styles.dlgHeader}>
                <ExpoImage
                  source={beat.portrait}
                  style={styles.dlgPortrait}
                  contentFit="cover"
                />
                <View style={styles.dlgMeta}>
                  <Text style={[styles.dlgSpeaker, { color: beat.color }]}>
                    {beat.speaker}
                  </Text>
                  <View style={[styles.dlgAccentBar, { backgroundColor: beat.color }]} />
                </View>
              </View>

              {/* Dialogue text */}
              <Animated.View style={{ opacity: dlgFade }}>
                <Text style={styles.dlgText}>{beat.text}</Text>
              </Animated.View>

              <Text style={styles.dlgTapHint}>
                {dialogueIdx < DIALOGUE_BEATS.length - 1 ? "tap to continue  ▶" : "tap to witness  ▶"}
              </Text>

            </Animated.View>

          </SafeAreaView>
        </Pressable>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ACT 2a — DESTABILIZE
          Former Self aura cracks; legendary equipment flashes
      ══════════════════════════════════════════════════════════════════════ */}
      {(stage === "destabilize" || stage === "overwhelm") && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">

          {/* Former Self portrait — bottom-anchored, 150% height so face clears top */}
          <Animated.View style={[styles.formerPortraitWrap, { opacity: formerDim }]}>
            <ExpoImage
              source={ART.prodigyCanonical}
              style={styles.formerPortrait}
              contentFit="contain"
              contentPosition="bottom"
            />
          </Animated.View>

          {/* Aura rings — centred over the portrait */}
          <View style={[StyleSheet.absoluteFill, styles.centreLayer]}>
            <Animated.View style={[
              styles.auraRing,
              { opacity: auraOpacity, transform: [{ scale: auraScale }] },
            ]} />
            <Animated.View style={[
              styles.auraRingInner,
              { opacity: auraOpacity, transform: [{ scale: auraScale }] },
            ]} />
          </View>

          {/* Equipment-crack flash */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: "#FFF6EE", opacity: crackFlash }]}
          />
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ACT 2b — OVERWHELM
          Nightingale (gold) and Fleming (teal) glow reach inward from edges
      ══════════════════════════════════════════════════════════════════════ */}
      {stage === "overwhelm" && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">

          {/* Nightingale — gold glow from left */}
          <Animated.View style={[
            styles.allyGlowLeft,
            { opacity: allyFade, transform: [{ translateX: goldX }] },
          ]}>
            <LinearGradient
              colors={["rgba(232,196,83,0.58)", "transparent"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Fleming — teal glow from right */}
          <Animated.View style={[
            styles.allyGlowRight,
            { opacity: allyFade, transform: [{ translateX: tealX }] },
          ]}>
            <LinearGradient
              colors={["transparent", "rgba(62,207,178,0.58)"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Dark energy closes from centre */}
          <Animated.View style={[styles.darkCloudLayer, { opacity: darkCloud }]}>
            <LinearGradient
              colors={[
                "transparent",
                "rgba(40,4,80,0.52)",
                "rgba(90,4,24,0.68)",
                "rgba(40,4,80,0.52)",
                "transparent",
              ]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ACT 2c — SILENCE
          Near-black; heartbeat slows to stillness
      ══════════════════════════════════════════════════════════════════════ */}
      {(stage === "silence" || stage === "lotus_appear") && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: "#040008", opacity: silBlack }]}
          />
          <View style={styles.heartCentre} pointerEvents="none">
            <Animated.View style={[
              styles.heartRing,
              { opacity: hbOpacity, transform: [{ scale: hbScale }] },
            ]} />
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ACT 2d — LOTUS PETALS
          Pink-white petals materialise among the darkness
      ══════════════════════════════════════════════════════════════════════ */}
      {(stage === "lotus_appear" || stage === "silhouette" || stage === "reaching") && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {PETALS.map((p, i) => petalView(p, i))}
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ACT 2e/f — SILHOUETTE & REACHING
          Former Self becomes luminous light; reaches toward their team
      ══════════════════════════════════════════════════════════════════════ */}
      {(stage === "silhouette" || stage === "reaching") && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Ghost portrait — bottom-anchored at 150% height, barely visible */}
          <Animated.View style={[
            styles.silWrap,
            { opacity: silFade, transform: [{ translateX: silShift }] },
          ]}>
            <ExpoImage
              source={ART.prodigyCanonical}
              style={styles.silPortrait}
              contentFit="contain"
              contentPosition="bottom"
            />
            {/* Luminous white-gold overlay — becomes the silhouette */}
            <Animated.View style={[StyleSheet.absoluteFill, styles.silGlowOverlay, { opacity: silGlow }]}>
              <LinearGradient
                colors={["rgba(255,248,218,0.90)", "rgba(220,190,255,0.55)"]}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Animated.View>
          {/* Outer radial halo — centred on screen */}
          <View style={[StyleSheet.absoluteFill, styles.centreLayer]}>
            <Animated.View style={[styles.silHalo, { opacity: silGlow }]} />
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ACT 3 — LOTUS RECALL RESULT SCREEN
      ══════════════════════════════════════════════════════════════════════ */}
      {stage === "result_screen" && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: resultFade }]}>
          <LinearGradient
            colors={["#040008", "#060A18", "#040008"]}
            style={StyleSheet.absoluteFill}
          />

          {/* Decorative petals (faint, static) */}
          {PETALS.map((p, i) => petalView(p, i, 0.14, 0.55))}

          <SafeAreaView style={styles.resultSafe}>
            <View style={styles.resultCard}>

              <Text style={styles.resultGlyph}>✿</Text>
              <Text style={styles.resultTitle}>LOTUS RECALL</Text>

              <View style={styles.resultDivider} />

              {RESULT_LINES.map((line) => (
                <View key={line.label} style={styles.resultLine}>
                  <Text style={[styles.resultIcon, { color: line.color }]}>{line.icon}</Text>
                  <Text style={[styles.resultLabel, { color: line.color }]}>{line.label}</Text>
                </View>
              ))}

              <View style={styles.resultGap} />
              <View style={styles.resultDivider} />

              <Text style={styles.resultFlavour}>
                {"The Recall does not erase what was learned.\nIt transfers the knowing to your next form."}
              </Text>

              <View style={styles.resultGap} />

              <Pressable style={styles.resultBtn} onPress={onComplete}>
                <LinearGradient
                  colors={["#7A5E1A", "#C49A2C", "#7A5E1A"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.resultBtnGrad}
                >
                  <Text style={styles.resultBtnText}>RECALL AND CONTINUE  →</Text>
                </LinearGradient>
              </Pressable>

            </View>
          </SafeAreaView>
        </Animated.View>
      )}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#040A12" },
  bg:   { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },

  // ── Shared ────────────────────────────────────────────────────────────────
  centreLayer: { justifyContent: "center", alignItems: "center" },

  // ── Dialogue panel ────────────────────────────────────────────────────────
  dialogueSafe: { flex: 1, justifyContent: "flex-end", paddingBottom: 32 },
  dlgPanel: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200,180,130,0.18)",
    overflow: "hidden",
    padding: 16,
  },
  dlgPanelBg: { ...StyleSheet.absoluteFillObject },
  dlgHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  dlgPortrait: {
    width: 62, height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: "rgba(200,180,130,0.28)",
    marginRight: 12,
  },
  dlgMeta:  { flex: 1 },
  dlgSpeaker: {
    fontSize: 11, fontWeight: "800",
    letterSpacing: 1.8, marginBottom: 5,
  },
  dlgAccentBar: { height: 1.5, width: 48, borderRadius: 1 },
  dlgText: {
    color: "#EDF2F7",
    fontSize: 15, lineHeight: 22,
    fontStyle: "italic",
    marginBottom: 12,
  },
  dlgTapHint: {
    color: "rgba(200,185,155,0.48)",
    fontSize: 10, letterSpacing: 1.5,
    textAlign: "right",
  },

  // ── Destabilize ───────────────────────────────────────────────────────────
  // Portrait fills 150% of screen height, bottom-anchored so the crop line
  // sits at the screen edge and the face is well above it.
  formerPortraitWrap: {
    position:       "absolute",
    bottom:         0,
    left:           0,
    right:          0,
    height:         H * 1.5,
    alignItems:     "center",
    justifyContent: "flex-end",
  },
  formerPortrait: { width: W, height: H * 1.5 },
  auraRing: {
    position: "absolute",
    width: 230, height: 230, borderRadius: 115,
    borderWidth: 3,
    borderColor: "rgba(190,55,190,0.72)",
    backgroundColor: "transparent",
  },
  auraRingInner: {
    position: "absolute",
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 2,
    borderColor: "rgba(220,55,80,0.52)",
    backgroundColor: "transparent",
  },

  // ── Overwhelm ─────────────────────────────────────────────────────────────
  allyGlowLeft: {
    position: "absolute", top: 0, bottom: 0, left: 0, width: "55%",
  },
  allyGlowRight: {
    position: "absolute", top: 0, bottom: 0, right: 0, width: "55%",
  },
  darkCloudLayer: {
    position: "absolute",
    top: "22%", bottom: "22%", left: 0, right: 0,
  },

  // ── Silence / heartbeat ───────────────────────────────────────────────────
  heartCentre: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center", alignItems: "center",
  },
  heartRing: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: "rgba(200,38,60,0.20)",
    borderWidth: 1.5,
    borderColor: "rgba(200,58,80,0.52)",
  },

  // ── Lotus petals ──────────────────────────────────────────────────────────
  petal: { position: "absolute", borderRadius: 999, overflow: "hidden" },
  petalGrad: { flex: 1 },

  // ── Silhouette ────────────────────────────────────────────────────────────
  silWrap: {
    position:       "absolute",
    bottom:         0,
    left:           0,
    right:          0,
    height:         H * 1.5,
  },
  silPortrait: { width: W, height: H * 1.5, opacity: 0.38 },
  silGlowOverlay: { borderRadius: 0 },
  silHalo: {
    width: 320, height: 380, borderRadius: 160,
    backgroundColor: "rgba(245,225,175,0.14)",
  },

  // ── Result screen ─────────────────────────────────────────────────────────
  resultSafe: { flex: 1, justifyContent: "center", alignItems: "center" },
  resultCard: {
    width: "86%", maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(180,148,72,0.26)",
    backgroundColor: "rgba(8,4,18,0.88)",
    padding: 28,
    alignItems: "center",
  },
  resultGlyph: { color: "#C49A2C", fontSize: 30, marginBottom: 4 },
  resultTitle: {
    color: "#C49A2C", fontSize: 13,
    fontWeight: "800", letterSpacing: 4,
    marginBottom: 14,
  },
  resultDivider: {
    height: 1, width: "100%",
    backgroundColor: "rgba(180,148,72,0.20)",
    marginVertical: 12,
  },
  resultLine: {
    flexDirection: "row", alignItems: "center",
    width: "100%", marginVertical: 5,
  },
  resultIcon:  { fontSize: 14, width: 24, textAlign: "center", marginRight: 10 },
  resultLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.8, flex: 1 },
  resultGap:   { height: 8 },
  resultFlavour: {
    color: "rgba(200,185,160,0.52)",
    fontSize: 11, lineHeight: 17,
    textAlign: "center", fontStyle: "italic",
    paddingHorizontal: 8,
  },
  resultBtn: { width: "100%", borderRadius: 8, overflow: "hidden", marginTop: 8 },
  resultBtnGrad: { paddingVertical: 14, alignItems: "center" },
  resultBtnText: {
    color: "#FFF8E1", fontSize: 13,
    fontWeight: "800", letterSpacing: 2.5,
  },
});
