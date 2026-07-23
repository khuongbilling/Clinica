/**
 * PrologueScriptedBattle — simplified scripted-defeat scene
 *
 * Phase: scripted_defeat
 *
 * The second battle. Legendary party vs the Silent Infarction.
 * One brief Master Bai warning → trap closes → scripted defeat cards.
 * No full tutorial: the Prodigy already knows the mechanics.
 *
 * Stages:
 *   opening       → battlefield settles (auto 1.5 s)
 *   bai_warning   → Master Bai warns (tap to continue)
 *   trap_closing  → red overlay + doom text (auto 3.5 s)
 *   finale        → 5 tappable defeat dialogue cards
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

// ─── Art ──────────────────────────────────────────────────────────────────────

const ART = {
  battlefield:       require("../../../assets/images/tactical_battlefield.png"),
  theProdigy:        require("../../../assets/images/prodigy_vn_canonical.png"),
  nightingale:       require("../../../assets/images/nightingale_vn_bust.png"),
  fleming:           require("../../../assets/images/fleming_vn_bust.png"),
  masterBai:         require("../../../assets/images/master_bai_vn.png"),
  bossPortrait:      require("../../../assets/images/silent_infarction_nobg.png"),
  prodigySprite:     require("../../../assets/images/prodigy_battle_sprite.png"),
  nightingaleSprite: require("../../../assets/images/nightingale_battle_sprite.png"),
  flemingSprite:     require("../../../assets/images/fleming_battle_sprite.png"),
} as const;

// ─── Stage machine ────────────────────────────────────────────────────────────

type Stage = "opening" | "bai_warning" | "trap_closing" | "finale" | "done";

// ─── Finale dialogue cards ────────────────────────────────────────────────────

interface FinaleCard {
  speaker:  string | null;
  portrait: any | null;
  text:     string;
  subtext?: string;
  color:    string;
}

const FINALE: FinaleCard[] = [
  {
    speaker:  null,
    portrait: null,
    text:     "THE TRAP CLOSES.",
    subtext:  "Not because the party was weak. Because the root cause was set before the battle began.",
    color:    "#FF3333",
  },
  {
    speaker:  "FLORENCE NIGHTINGALE",
    portrait: ART.nightingale,
    text:     "We have to retreat. The damage is done. The trap was always closing — we just could not see it in time.",
    color:    "#E8C453",
  },
  {
    speaker:  "ALEXANDER FLEMING",
    portrait: ART.fleming,
    text:     "The overconfidence was the trap. The choices that led here came long before this battle.",
    color:    "#3ECFB2",
  },
  {
    speaker:  "MASTER BAI",
    portrait: ART.masterBai,
    text:     "You were brilliant. That was never in question. But brilliance that skips the assessment is the most dangerous kind.",
    color:    "#D9A441",
  },
  {
    speaker:  null,
    portrait: null,
    text:     "The battle is lost.\nBut something survived.",
    subtext:  "The knowledge. The consequence. The beginning.",
    color:    "rgba(200,210,220,0.65)",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function PrologueScriptedBattle({ onComplete }: Props) {
  const [stage, setStage]         = useState<Stage>("opening");
  const stageRef                  = useRef<Stage>("opening");
  const [finaleStep, setFinaleStep] = useState(0);
  const finaleStepRef             = useRef(0);
  const mountedRef                = useRef(true);
  const timers                    = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // ── Animated values ───────────────────────────────────────────────────────

  const bgFade     = useRef(new Animated.Value(0)).current;
  const bgScale    = useRef(new Animated.Value(1.04)).current;
  const redPulse   = useRef(new Animated.Value(0)).current;
  const labelFade  = useRef(new Animated.Value(0)).current;
  const baiCardSlide = useRef(new Animated.Value(60)).current;
  const baiCardFade  = useRef(new Animated.Value(0)).current;
  const doomFade   = useRef(new Animated.Value(0)).current;
  const trapFade   = useRef(new Animated.Value(0)).current;
  const finaleFade = useRef(new Animated.Value(0)).current;
  const bossGlow   = useRef(new Animated.Value(0)).current;
  const heroBreath = useRef(new Animated.Value(0)).current;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function anim(val: Animated.Value, to: number, dur: number, cb?: () => void) {
    Animated.timing(val, { toValue: to, duration: dur, useNativeDriver: false }).start(cb ?? (() => {}));
  }

  function after(ms: number, fn: () => void) {
    const t = setTimeout(() => { if (mountedRef.current) fn(); }, ms);
    timers.current.push(t);
  }

  function toStage(s: Stage) {
    stageRef.current = s;
    setStage(s);
  }

  // ── Startup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(bgScale, { toValue: 1.00, duration: 6000, useNativeDriver: false }),
        Animated.timing(bgScale, { toValue: 1.04, duration: 6000, useNativeDriver: false }),
      ])
    );
    breathe.start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(redPulse, { toValue: 0.35, duration: 1800, useNativeDriver: false }),
        Animated.timing(redPulse, { toValue: 0.12, duration: 1800, useNativeDriver: false }),
      ])
    );
    pulse.start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bossGlow, { toValue: 1, duration: 2200, useNativeDriver: false }),
        Animated.timing(bossGlow, { toValue: 0, duration: 2200, useNativeDriver: false }),
      ])
    ).start();

    // Hero idle breath — scale only, no vertical float
    const heroBreathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroBreath, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(heroBreath, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    heroBreathLoop.start();

    anim(bgFade, 1, 700);
    after(500, () => anim(labelFade, 1, 600));

    // Opening → bai_warning after 1.5 s
    after(1500, () => {
      toStage("bai_warning");
      baiCardSlide.setValue(60);
      baiCardFade.setValue(0);
      Animated.parallel([
        Animated.timing(baiCardSlide, { toValue: 0, duration: 350, useNativeDriver: false }),
        Animated.timing(baiCardFade,  { toValue: 1, duration: 350, useNativeDriver: false }),
      ]).start();
    });

    return () => { breathe.stop(); pulse.stop(); heroBreathLoop.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Trap closing ──────────────────────────────────────────────────────────

  function startTrapClosing() {
    toStage("trap_closing");

    // Intensify red pulse — override the loop
    anim(redPulse, 0.70, 800);

    // Boss glow flare
    anim(trapFade, 0.35, 600);
    after(600, () => {
      anim(doomFade, 1, 500);
    });

    // After 3.5 s → start finale cards
    after(3500, () => {
      toStage("finale");
      finaleStepRef.current = 0;
      setFinaleStep(0);
      finaleFade.setValue(0);
      anim(finaleFade, 1, 500);
    });
  }

  // ── Advance finale card ───────────────────────────────────────────────────

  const handleFinaleAdvance = useCallback(() => {
    if (stageRef.current !== "finale") return;

    const next = finaleStepRef.current + 1;
    if (next >= FINALE.length) {
      toStage("done");
      anim(finaleFade, 0, 400, () => {
        after(80, onComplete);
      });
      return;
    }

    anim(finaleFade, 0, 250, () => {
      finaleStepRef.current = next;
      setFinaleStep(next);
      anim(finaleFade, 1, 400);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete]);

  // ── Tap handler (bai_warning phase) ──────────────────────────────────────

  const handleBaiTap = useCallback(() => {
    if (stageRef.current !== "bai_warning") return;
    Animated.parallel([
      Animated.timing(baiCardFade,  { toValue: 0, duration: 250, useNativeDriver: false }),
      Animated.timing(baiCardSlide, { toValue: 40, duration: 250, useNativeDriver: false }),
    ]).start(() => startTrapClosing());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const isBaiWarning   = stage === "bai_warning";
  const isTrapClosing  = stage === "trap_closing";
  const isFinale       = stage === "finale";
  const finaleCard     = FINALE[finaleStep];

  const bossGlowOpac = bossGlow.interpolate({ inputRange: [0,1], outputRange: [0.08, 0.28] });
  const heroBreathScale = heroBreath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });

  return (
    <View style={styles.root}>
      {/* ── BATTLEFIELD BACKGROUND ── */}
      <Animated.View style={[styles.bgWrap, { opacity: bgFade, transform: [{ scale: bgScale }] }]}>
        <ExpoImage source={ART.battlefield} style={styles.bg} contentFit="cover" />
      </Animated.View>

      <View style={styles.darkTint} pointerEvents="none" />

      {/* Red pulse overlay */}
      <Animated.View style={[styles.redOverlay, { opacity: redPulse }]} pointerEvents="none" />

      {/* Boss glow */}
      <Animated.View style={[styles.bossGlow, { opacity: bossGlowOpac }]} pointerEvents="none" />

      {/* Trap overlay (darkens on trap_closing) */}
      {isTrapClosing && (
        <Animated.View style={[styles.trapOverlay, { opacity: trapFade }]} pointerEvents="none" />
      )}

      <LinearGradient
        colors={["transparent", "rgba(4,10,18,0.65)", "rgba(4,10,18,0.96)"]}
        locations={[0, 0.38, 0.75]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} pointerEvents="box-none">

        {/* ── TOP LABEL ── */}
        <Animated.View style={[styles.topBar, { opacity: labelFade }]} pointerEvents="none">
          <Text style={styles.sceneLabel}>LEGENDARY PARTY  ·  SECOND ENCOUNTER</Text>
          <View style={styles.bossRow}>
            <View style={styles.bossCard}>
              <ExpoImage source={ART.bossPortrait} style={styles.bossPortrait} contentFit="contain" />
              <Text style={styles.bossName}>SILENT INFARCTION</Text>
              <Text style={styles.bossHp}>Corruption Unknown</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── ALLY SPRITE PANEL ── */}
        {!isFinale && (
          <View style={styles.allyRow} pointerEvents="none">
            <View style={styles.allyUnit}>
              <Animated.View style={{ transform: [{ scale: heroBreathScale }] }}>
                <ExpoImage source={ART.nightingaleSprite} style={styles.allySprite} contentFit="contain" />
              </Animated.View>
              <Text style={[styles.allyName, { color: "#E8C453" }]}>NIGHTINGALE</Text>
            </View>
            <View style={styles.allyUnit}>
              <Animated.View style={{ transform: [{ scale: heroBreathScale }] }}>
                <ExpoImage source={ART.prodigySprite} style={styles.allySprite} contentFit="contain" />
              </Animated.View>
              <Text style={[styles.allyName, { color: "#E8354A" }]}>THE PRODIGY</Text>
            </View>
            <View style={styles.allyUnit}>
              <Animated.View style={{ transform: [{ scale: heroBreathScale }] }}>
                <ExpoImage source={ART.flemingSprite} style={styles.allySprite} contentFit="contain" />
              </Animated.View>
              <Text style={[styles.allyName, { color: "#3ECFB2" }]}>FLEMING</Text>
            </View>
          </View>
        )}

        <View style={{ flex: 1 }} pointerEvents="none" />

        {/* ── TRAP CLOSING DOOM TEXT ── */}
        {isTrapClosing && (
          <Animated.View style={[styles.doomWrap, { opacity: doomFade }]} pointerEvents="none">
            <Text style={styles.doomTitle}>THE TRAP CLOSES.</Text>
            <Text style={styles.doomSub}>
              The corruption was never the visible enemy.{"\n"}
              It was waiting for overconfidence to open the door.
            </Text>
          </Animated.View>
        )}

        {/* ── MASTER BAI WARNING CARD ── */}
        {isBaiWarning && (
          <Animated.View
            style={[
              styles.baiCard,
              { opacity: baiCardFade, transform: [{ translateY: baiCardSlide }] },
            ]}
          >
            <View style={styles.baiHeader}>
              <ExpoImage source={ART.masterBai} style={styles.baiAvatar} contentFit="contain" />
              <View style={styles.baiMeta}>
                <Text style={styles.baiSpeaker}>MASTER BAI</Text>
                <Text style={styles.baiRole}>The Mentor — Final Warning</Text>
              </View>
            </View>
            <Text style={styles.baiLine}>
              "This corruption is different. It knows what you know. There will be no opening move."
            </Text>
            <Pressable style={styles.baiAdvance} onPress={handleBaiTap}>
              <Text style={styles.baiAdvanceText}>PROCEED  →</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── FINALE CARDS ── */}
        {isFinale && (
          <Pressable style={styles.finaleWrap} onPress={handleFinaleAdvance}>
            <Animated.View style={[styles.finaleCard, { opacity: finaleFade }]}>
              {finaleCard.speaker && finaleCard.portrait && (
                <View style={styles.finaleSpeakerRow}>
                  <ExpoImage
                    source={finaleCard.portrait}
                    style={styles.finaleSpeakerAvatar}
                    contentFit="cover"
                  />
                  <Text style={[styles.finaleSpeaker, { color: finaleCard.color }]}>
                    {finaleCard.speaker}
                  </Text>
                </View>
              )}
              <Text style={[styles.finaleText, { color: finaleCard.color }]}>
                {finaleCard.text}
              </Text>
              {finaleCard.subtext && (
                <Text style={styles.finaleSubtext}>{finaleCard.subtext}</Text>
              )}
              <Text style={styles.finaleTapHint}>
                {finaleStep < FINALE.length - 1 ? "TAP TO CONTINUE" : "TAP TO PROCEED"}
              </Text>
            </Animated.View>
          </Pressable>
        )}

      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#040A12" },

  bgWrap: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  bg:     { width: "100%", height: "100%" },

  darkTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,14,28,0.32)",
  },
  redOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#5C0000",
  },
  bossGlow: {
    position:        "absolute",
    top:             "10%",
    left:            "20%",
    right:           "20%",
    height:          "40%",
    borderRadius:    200,
    backgroundColor: "rgba(180,20,20,0.4)",
  },
  trapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(80,0,0,0.35)",
  },
  bottomGradient: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: "60%",
  },

  allyRow: {
    flexDirection:     "row",
    justifyContent:    "space-evenly",
    alignItems:        "flex-end",
    paddingHorizontal: 8,
    paddingVertical:   12,
  },
  allyUnit: {
    alignItems: "center",
    gap:        3,
  },
  allySprite: {
    width:   80,
    height:  120,
    opacity: 0.94,
  },
  allyName: {
    fontSize:         7,
    fontWeight:       "800",
    letterSpacing:    0.8,
    textShadowColor:  "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  safe: { flex: 1, paddingHorizontal: 16, paddingBottom: 12 },

  // Top bar
  topBar: { paddingTop: 14, gap: 10 },
  sceneLabel: {
    color: "rgba(255,100,100,0.45)", fontSize: 10, fontWeight: "700",
    letterSpacing: 2.5, textAlign: "center",
  },
  bossRow:    { alignItems: "center" },
  bossCard:   {
    alignItems: "center", paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: "rgba(20,4,4,0.72)", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(200,20,20,0.25)", gap: 4,
  },
  bossPortrait: { width: 68, height: 88 },
  bossName: { color: "#CC3333", fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  bossHp:   { color: "rgba(200,100,100,0.55)", fontSize: 9 },

  // Doom text
  doomWrap: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  doomTitle: {
    color: "#FF2222", fontSize: 28, fontWeight: "800",
    letterSpacing: 3, textAlign: "center",
  },
  doomSub: {
    color: "rgba(255,180,180,0.65)", fontSize: 14, textAlign: "center",
    lineHeight: 22, fontStyle: "italic",
  },

  // Master Bai card
  baiCard: {
    backgroundColor: "rgba(4,10,18,0.92)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(217,164,65,0.35)",
    padding: 16,
    gap: 12,
    marginBottom: 8,
  },
  baiHeader:  { flexDirection: "row", alignItems: "center", gap: 12 },
  baiAvatar:  { width: 52, height: 68 },
  baiMeta:    { flex: 1, gap: 2 },
  baiSpeaker: {
    color: "#D9A441", fontSize: 10, fontWeight: "800", letterSpacing: 2,
  },
  baiRole: {
    color: "rgba(200,180,140,0.55)", fontSize: 11,
  },
  baiLine: {
    color: "rgba(230,240,255,0.88)", fontSize: 15.5, lineHeight: 24,
    fontStyle: "italic", letterSpacing: 0.2,
  },
  baiAdvance: { alignSelf: "flex-end", paddingTop: 4 },
  baiAdvanceText: {
    color: "#D9A441", fontSize: 11, fontWeight: "800", letterSpacing: 1.5,
  },

  // Finale
  finaleWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center", alignItems: "center",
    paddingHorizontal: 28,
  },
  finaleCard: {
    backgroundColor: "rgba(4,10,18,0.92)",
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    paddingVertical: 28, paddingHorizontal: 24, gap: 16, width: "100%",
  },
  finaleSpeakerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  finaleSpeakerAvatar: { width: 42, height: 42, borderRadius: 21 },
  finaleSpeaker: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  finaleText: {
    fontSize: 18, fontWeight: "600", lineHeight: 28, textAlign: "center",
  },
  finaleSubtext: {
    color: "rgba(255,255,255,0.45)", fontSize: 13, textAlign: "center",
    lineHeight: 20, fontStyle: "italic",
  },
  finaleTapHint: {
    color: "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: "700",
    letterSpacing: 2, textAlign: "center", marginTop: 8,
  },
});
