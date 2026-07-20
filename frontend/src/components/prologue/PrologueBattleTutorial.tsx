/**
 * PrologueBattleTutorial
 *
 * Push 5 prologue phase — "First Contact" (opening_battle_tutorial)
 *
 * Interactive guided cinematic on the frozen battlefield.
 * Legendary party: The Prodigy, Nightingale, Fleming (prologue loaners).
 * Teaches Scout → Stabilize → Counter → Reassess sequence through three skill demos:
 *   1. Lamp of Observation     (Nightingale) — Scout: reveals hidden hazards
 *   2. Culture and Sensitivity (Fleming)     — Stabilize: reveals weakness + resistance
 *   3. Brilliant Intervention  (The Prodigy) — Counter: powerful strike, cost of skipping Scout
 *
 * Stage machine (Scout → Stabilize → Counter → Reassess):
 *   frozen_field      → battle scene settles (auto 1.2 s)
 *   nightingale_entry → Nightingale steps forward (Scout), speaks (tap to continue)
 *   lamp_prompt       → Skill card shown, player taps USE SKILL
 *   lamp_effect       → Warm glow + reveal indicators (auto 2.8 s)
 *   fleming_entry     → Fleming steps forward (Stabilize), speaks (tap to continue)
 *   culture_prompt    → Skill card shown, player taps USE SKILL
 *   culture_effect    → Teal scan + analysis panel (auto 2.8 s)
 *   prodigy_entry     → The Prodigy steps forward (Counter), speaks (tap to continue)
 *   prodigy_prompt    → Skill card shown, player taps USE SKILL
 *   prodigy_effect    → Crimson burst + result chips (auto 2.8 s)
 *   master_bai        → Master Bai lesson — Reassess (auto 3 s)
 *   player_turn       → Player taps TAKE ACTION → onComplete()
 *
 * Rules:
 *  - Skills belong to the TEMPORARY prologue heroes (not permanent roster).
 *  - One mechanic at a time. Short mobile-readable text only.
 *  - Tap advances entry stages; player actively taps skill buttons.
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
import { PROLOGUE_AP_CONFIG } from "../../game/prologueTypes";

// ─── Art ─────────────────────────────────────────────────────────────────────

const ART = {
  battlefield: require("../../../assets/images/tactical_battlefield.png"),
  theProdigy:  require("../../../assets/images/the_prodigy_vn.png"),
  nightingale: require("../../../assets/images/nightingale_vn.png"),
  fleming:     require("../../../assets/images/fleming_vn.png"),
  masterBai:   require("../../../assets/images/master_bai_nobg.png"),
} as const;

// ─── Stage machine type ───────────────────────────────────────────────────────

type Stage =
  | "frozen_field"
  | "prodigy_entry"
  | "prodigy_prompt"
  | "prodigy_effect"
  | "nightingale_entry"
  | "lamp_prompt"
  | "lamp_effect"
  | "fleming_entry"
  | "culture_prompt"
  | "culture_effect"
  | "master_bai"
  | "player_turn";

// ─── Skill data ───────────────────────────────────────────────────────────────

const PRODIGY_SKILL = {
  id:        "prologue_radiant_stabilization",
  name:      "Radiant Stabilization",
  apCost:    2,
  owner:     "THE PRODIGY",
  ownerColor: "#E8354A",
  avatar:    ART.theProdigy,
  tagColor:  "#E8354A20",
  tagText:   "#E8354A",
  accentBg:  "rgba(232,53,74,0.08)",
  accentBorder: "rgba(232,53,74,0.30)",
  effects: [
    "Stabilize: reverse active damage over 2 rounds (+15 Stability)",
    "Must use AFTER Scout — unstabilized sites resist the effect",
    "Stabilization before countering extends your action window",
    "AP Cost: 2 — efficient when sequenced correctly",
  ],
  effectColor: "#E8354A",
  prompt: "First we scout. Now we stabilize before we strike.",
} as const;

const LAMP_SKILL = {
  id:        "prologue_lamp_of_observation",
  name:      "Lamp of Observation",
  apCost:    2,
  owner:     "FLORENCE NIGHTINGALE",
  ownerColor: "#E8C453",
  avatar:    ART.nightingale,
  tagColor:  "#E8C45320",
  tagText:   "#E8C453",
  accentBg:  "rgba(232,196,83,0.08)",
  accentBorder: "rgba(232,196,83,0.30)",
  effects: [
    "Reveals hidden hazards on the battlefield",
    "Highlights deteriorating civilians",
    "Identifies unsafe tiles and decoy enemies",
    "Patient status indicators become visible",
  ],
  effectColor: "#E8C453",
  prompt:    "Do not attack yet. Give me a moment to assess the field.",
} as const;

const CULTURE_SKILL = {
  id:        "prologue_targeted_antidote",
  name:      "Targeted Antidote",
  apCost:    2,
  owner:     "SIR ALEXANDER FLEMING",
  ownerColor: "#3ECFB2",
  avatar:    ART.fleming,
  tagColor:  "#3ECFB220",
  tagText:   "#3ECFB2",
  accentBg:  "rgba(62,207,178,0.08)",
  accentBorder: "rgba(62,207,178,0.30)",
  effects: [
    "Counter: targeted strike using the scouted weakness (-18 Corruption)",
    "Deals full damage only after Scout + Stabilize sequence",
    "Random broad-spectrum attacks deal ~40% of this",
    "AP Cost: 2 — precision saves Action Points",
  ],
  effectColor: "#3ECFB2",
  prompt:    "Scouted. Stabilized. Now we finish it precisely.",
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function PrologueBattleTutorial({ onComplete }: Props) {
  const [stage, setStage] = useState<Stage>("frozen_field");

  const stageRef   = useRef<Stage>("frozen_field");
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
  const bgScale   = useRef(new Animated.Value(1.03)).current;
  const redPulse  = useRef(new Animated.Value(0)).current;    // looping trap glow

  // Scene label
  const labelFade = useRef(new Animated.Value(0)).current;

  // Character entry card
  const charFade  = useRef(new Animated.Value(0)).current;
  const charSlide = useRef(new Animated.Value(40)).current;
  const dlgFade   = useRef(new Animated.Value(0)).current;

  // Skill card
  const skillFade  = useRef(new Animated.Value(0)).current;
  const skillScale = useRef(new Animated.Value(0.94)).current;

  // Lamp of Observation effect
  const lampGlowScale = useRef(new Animated.Value(0.2)).current;
  const lampGlowFade  = useRef(new Animated.Value(0)).current;
  const lampFogFade   = useRef(new Animated.Value(1)).current;   // fog fades OUT
  const lamp1Fade     = useRef(new Animated.Value(0)).current;
  const lamp2Fade     = useRef(new Animated.Value(0)).current;
  const lamp3Fade     = useRef(new Animated.Value(0)).current;

  // Prodigy skill effect
  const prodigyGlow   = useRef(new Animated.Value(0)).current;
  const prodigyRing   = useRef(new Animated.Value(0.3)).current;
  const prodigy1Fade  = useRef(new Animated.Value(0)).current;
  const prodigy2Fade  = useRef(new Animated.Value(0)).current;

  // Culture & Sensitivity effect
  const scanY         = useRef(new Animated.Value(-200)).current;
  const scanY2        = useRef(new Animated.Value(-200)).current;
  const scanFade      = useRef(new Animated.Value(0)).current;
  const analysisFade  = useRef(new Animated.Value(0)).current;

  // Master Bai lesson
  const mbFade        = useRef(new Animated.Value(0)).current;

  // Final CTA
  const ctaFade       = useRef(new Animated.Value(0)).current;
  const ctaScale      = useRef(new Animated.Value(0.93)).current;

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

  function toStage(s: Stage) {
    stageRef.current = s;
    setStage(s);
  }

  // ── Entry card helpers ────────────────────────────────────────────────────────

  function showChar() {
    charFade.setValue(0);
    charSlide.setValue(40);
    dlgFade.setValue(0);
    Animated.parallel([
      Animated.timing(charFade,  { toValue: 1, duration: 450, useNativeDriver: false }),
      Animated.timing(charSlide, { toValue: 0, duration: 450, useNativeDriver: false }),
    ]).start(() => {
      anim(dlgFade, 1, 350);
    });
  }

  function hideChar(cb: () => void) {
    Animated.parallel([
      Animated.timing(charFade, { toValue: 0, duration: 250, useNativeDriver: false }),
      Animated.timing(dlgFade,  { toValue: 0, duration: 250, useNativeDriver: false }),
    ]).start(() => cb());
  }

  // ── Skill card helpers ────────────────────────────────────────────────────────

  function showSkillCard() {
    skillFade.setValue(0);
    skillScale.setValue(0.94);
    Animated.parallel([
      Animated.timing(skillFade,  { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.timing(skillScale, { toValue: 1, duration: 400, useNativeDriver: false }),
    ]).start();
  }

  function hideSkillCard(cb: () => void) {
    anim(skillFade, 0, 250, cb);
  }

  // ── Main sequence ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // Ambient bg breathing
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(bgScale, { toValue: 1.00, duration: 6000, useNativeDriver: false }),
        Animated.timing(bgScale, { toValue: 1.03, duration: 6000, useNativeDriver: false }),
      ])
    );
    breathe.start();

    // Trap red pulse loop
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(redPulse, { toValue: 0.42, duration: 1600, useNativeDriver: false }),
        Animated.timing(redPulse, { toValue: 0.15, duration: 1600, useNativeDriver: false }),
      ])
    );
    pulse.start();

    // Sequence start
    anim(bgFade, 1, 700);
    after(500, () => anim(labelFade, 1, 600));

    // After brief frozen pause → Nightingale enters first (Scout step)
    after(1400, () => {
      toStage("nightingale_entry");
      showChar();
    });

    return () => {
      breathe.stop();
      pulse.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Brilliant Intervention (Prodigy) effect ───────────────────────────────────

  function playProdigyEffect() {
    prodigyGlow.setValue(0);
    prodigyRing.setValue(0.3);
    prodigy1Fade.setValue(0);
    prodigy2Fade.setValue(0);

    // Crimson glow burst
    Animated.parallel([
      Animated.timing(prodigyGlow, { toValue: 0.70, duration: 500,  useNativeDriver: false }),
      Animated.timing(prodigyRing, { toValue: 2.2,  duration: 900,  useNativeDriver: false }),
    ]).start(() => {
      anim(prodigyGlow, 0, 800);
    });

    // Staggered result chips
    after(400, () => anim(prodigy1Fade, 1, 350));
    after(900, () => anim(prodigy2Fade, 1, 350));

    // Effect hold → advance to Fleming (Counter step)
    after(2800, () => {
      Animated.parallel([
        Animated.timing(prodigy1Fade, { toValue: 0, duration: 350, useNativeDriver: false }),
        Animated.timing(prodigy2Fade, { toValue: 0, duration: 350, useNativeDriver: false }),
        Animated.timing(prodigyGlow,  { toValue: 0, duration: 350, useNativeDriver: false }),
      ]).start(() => {
        toStage("fleming_entry");
        showChar();
      });
    });
  }

  // ── Lamp of Observation effect ────────────────────────────────────────────────

  function playLampEffect() {
    lampGlowScale.setValue(0.2);
    lampGlowFade.setValue(0);
    lampFogFade.setValue(1);
    lamp1Fade.setValue(0);
    lamp2Fade.setValue(0);
    lamp3Fade.setValue(0);

    // Golden glow expands
    Animated.parallel([
      Animated.timing(lampGlowScale, { toValue: 2.8,  duration: 1200, useNativeDriver: false }),
      Animated.timing(lampGlowFade,  { toValue: 0.65, duration: 500,  useNativeDriver: false }),
    ]).start(() => {
      anim(lampGlowFade, 0, 700);
    });

    // Fog thins
    anim(lampFogFade, 0.15, 1000);

    // Staggered indicator reveals
    after(400,  () => anim(lamp1Fade, 1, 400));
    after(800,  () => anim(lamp2Fade, 1, 400));
    after(1200, () => anim(lamp3Fade, 1, 400));

    // Effect hold → auto-advance to The Prodigy (Stabilize step)
    after(2800, () => {
      // Fade out indicators
      Animated.parallel([
        Animated.timing(lamp1Fade, { toValue: 0, duration: 400, useNativeDriver: false }),
        Animated.timing(lamp2Fade, { toValue: 0, duration: 400, useNativeDriver: false }),
        Animated.timing(lamp3Fade, { toValue: 0, duration: 400, useNativeDriver: false }),
        Animated.timing(lampFogFade, { toValue: 1, duration: 500, useNativeDriver: false }),
      ]).start(() => {
        toStage("prodigy_entry");
        showChar();
      });
    });
  }

  // ── Culture and Sensitivity effect ────────────────────────────────────────────

  function playCultureEffect() {
    scanY.setValue(-200);
    scanY2.setValue(-200);
    scanFade.setValue(0);
    analysisFade.setValue(0);

    // Scan lines sweep
    anim(scanFade, 0.8, 200);
    Animated.sequence([
      Animated.timing(scanY,  { toValue: 600, duration: 900, useNativeDriver: false }),
    ]).start(() => anim(scanFade, 0, 300));
    after(300, () => {
      scanY2.setValue(-200);
      Animated.timing(scanY2, { toValue: 600, duration: 900, useNativeDriver: false }).start();
    });

    // Analysis panel appears after scan
    after(900, () => anim(analysisFade, 1, 500));

    // Effect hold → advance to Master Bai (Reassess step)
    after(2800, () => {
      Animated.parallel([
        Animated.timing(analysisFade, { toValue: 0, duration: 400, useNativeDriver: false }),
        Animated.timing(scanFade,     { toValue: 0, duration: 300, useNativeDriver: false }),
      ]).start(() => {
        toStage("master_bai");
        anim(mbFade, 1, 500);
        // Auto-advance to player turn
        after(3200, () => {
          anim(mbFade, 0, 350, () => {
            toStage("player_turn");
            anim(ctaFade, 1, 600);
            Animated.loop(
              Animated.sequence([
                Animated.timing(ctaScale, { toValue: 1.04, duration: 900, useNativeDriver: false }),
                Animated.timing(ctaScale, { toValue: 0.96, duration: 900, useNativeDriver: false }),
              ])
            ).start();
          });
        });
      });
    });
  }

  // ── Tap handlers ──────────────────────────────────────────────────────────────

  const handleTapEntry = useCallback(() => {
    const s = stageRef.current;
    if (s === "prodigy_entry") {
      hideChar(() => {
        toStage("prodigy_prompt");
        showSkillCard();
      });
    } else if (s === "nightingale_entry") {
      hideChar(() => {
        toStage("lamp_prompt");
        showSkillCard();
      });
    } else if (s === "fleming_entry") {
      hideChar(() => {
        toStage("culture_prompt");
        showSkillCard();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUseProdigy = useCallback(() => {
    if (stageRef.current !== "prodigy_prompt") return;
    hideSkillCard(() => {
      toStage("prodigy_effect");
      playProdigyEffect();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUseLamp = useCallback(() => {
    if (stageRef.current !== "lamp_prompt") return;
    hideSkillCard(() => {
      toStage("lamp_effect");
      playLampEffect();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUseCulture = useCallback(() => {
    if (stageRef.current !== "culture_prompt") return;
    hideSkillCard(() => {
      toStage("culture_effect");
      playCultureEffect();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnterBattle = useCallback(() => {
    if (stageRef.current !== "player_turn") return;
    onComplete();
  }, [onComplete]);

  // ── Derived render state ─────────────────────────────────────────────────────

  const isProdigyEntry     = stage === "prodigy_entry";
  const isProdigyPrompt    = stage === "prodigy_prompt";
  const isProdigyEffect    = stage === "prodigy_effect";
  const isNightingaleEntry = stage === "nightingale_entry";
  const isFlemingEntry     = stage === "fleming_entry";
  const isEntryStage       = isProdigyEntry || isNightingaleEntry || isFlemingEntry;
  const isLampPrompt       = stage === "lamp_prompt";
  const isCulturePrompt    = stage === "culture_prompt";
  const isLampEffect       = stage === "lamp_effect";
  const isCultureEffect    = stage === "culture_effect";
  const isMasterBai        = stage === "master_bai";
  const isPlayerTurn       = stage === "player_turn";

  const currentChar = isProdigyEntry     ? PRODIGY_SKILL
                    : isNightingaleEntry ? LAMP_SKILL
                    : isFlemingEntry     ? CULTURE_SKILL
                    : null;

  const currentSkill = isProdigyPrompt  ? PRODIGY_SKILL
                     : isLampPrompt     ? LAMP_SKILL
                     : isCulturePrompt  ? CULTURE_SKILL
                     : null;

  return (
    <View style={styles.root}>
      {/* ── BATTLEFIELD BACKGROUND ── */}
      <Animated.View style={[styles.bgWrap, { opacity: bgFade, transform: [{ scale: bgScale }] }]}>
        <ExpoImage source={ART.battlefield} style={styles.bg} contentFit="cover" />
      </Animated.View>

      {/* Frozen tint (blue-gray) */}
      <View style={styles.frozenTint} pointerEvents="none" />

      {/* Red trap pulse */}
      <Animated.View style={[styles.redOverlay, { opacity: redPulse }]} pointerEvents="none" />

      {/* ── PRODIGY EFFECT LAYER ── */}
      {isProdigyEffect && (
        <View style={styles.effectLayer} pointerEvents="none">
          {/* Crimson glow ring */}
          <Animated.View
            style={[
              styles.prodigyGlow,
              { opacity: prodigyGlow, transform: [{ scale: prodigyRing }] },
            ]}
          />

          {/* Result chips */}
          <Animated.View style={[styles.revealChip, styles.revealChip1, { opacity: prodigy1Fade }]}>
            <Text style={styles.revealHazard}>⚡  BRILLIANT INTERVENTION</Text>
            <Text style={styles.revealSub}>Corruption −12</Text>
          </Animated.View>

          <Animated.View style={[styles.revealChip, styles.revealChip3, { opacity: prodigy2Fade }]}>
            <Text style={{ color: "#E8C453", fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
              ⚠  SCOUT FIRST
            </Text>
            <Text style={styles.revealSub}>Hidden cues still spreading</Text>
          </Animated.View>
        </View>
      )}

      {/* ── LAMP EFFECT LAYER ── */}
      {isLampEffect && (
        <View style={styles.effectLayer} pointerEvents="none">
          {/* Fog overlay that thins */}
          <Animated.View style={[styles.fogLayer, { opacity: lampFogFade }]}>
            <LinearGradient
              colors={["rgba(180,210,240,0.35)", "transparent", "transparent"]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Golden glow expanding from mid-left (Nightingale position) */}
          <Animated.View
            style={[
              styles.lampGlow,
              { opacity: lampGlowFade, transform: [{ scale: lampGlowScale }] },
            ]}
          />

          {/* Revealed hazard indicators */}
          <Animated.View style={[styles.revealChip, styles.revealChip1, { opacity: lamp1Fade }]}>
            <Text style={styles.revealHazard}>⚠  HIDDEN HAZARD</Text>
            <Text style={styles.revealSub}>Cardiac Pressure Zone</Text>
          </Animated.View>

          <Animated.View style={[styles.revealChip, styles.revealChip2, { opacity: lamp2Fade }]}>
            <Text style={styles.revealDecoy}>◈  DECOY DETECTED</Text>
            <Text style={styles.revealSub}>Enemy is a secondary threat</Text>
          </Animated.View>

          <Animated.View style={[styles.revealChip, styles.revealChip3, { opacity: lamp3Fade }]}>
            <Text style={styles.revealPatient}>↓  PATIENT STATUS: CRITICAL</Text>
            <Text style={styles.revealSub}>Deterioration in progress</Text>
          </Animated.View>
        </View>
      )}

      {/* ── CULTURE EFFECT LAYER ── */}
      {isCultureEffect && (
        <View style={styles.effectLayer} pointerEvents="none">
          {/* Scan lines */}
          <Animated.View
            style={[styles.scanLine, { opacity: scanFade, transform: [{ translateY: scanY }] }]}
          />
          <Animated.View
            style={[styles.scanLine, styles.scanLine2, { opacity: scanFade, transform: [{ translateY: scanY2 }] }]}
          />

          {/* Analysis panel */}
          <Animated.View style={[styles.analysisPanel, { opacity: analysisFade }]}>
            <Text style={styles.analysisPanelTitle}>ENEMY ANALYSIS</Text>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisWeak}>✓  WEAKNESS</Text>
              <Text style={styles.analysisValue}>Targeted Intervention</Text>
            </View>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisResist}>✗  RESISTANCE</Text>
              <Text style={styles.analysisValue}>Broad Spectrum</Text>
            </View>
            <View style={[styles.analysisRow, styles.analysisWarningRow]}>
              <Text style={styles.analysisWarn}>⚠  Repeat untargeted attacks cause adaptation</Text>
            </View>
          </Animated.View>
        </View>
      )}

      {/* ── BOTTOM GRADIENT ── */}
      <LinearGradient
        colors={["transparent", "rgba(4,10,18,0.65)", "rgba(4,10,18,0.96)"]}
        locations={[0, 0.38, 0.75]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} pointerEvents="box-none">
        {/* ── TOP LABEL ── */}
        <Animated.View style={[styles.topBar, { opacity: labelFade }]} pointerEvents="none">
          <Text style={styles.sceneLabel}>LEGENDARY PARTY  ·  AP {PROLOGUE_AP_CONFIG.startingAP} / {PROLOGUE_AP_CONFIG.startingAP}  ·  BATTLE ACTIVE</Text>
          <View style={styles.stepRow}>
            {["Scout", "Stabilize", "Counter", "Reassess"].map((step, i) => {
              // Scout (Nightingale), Stabilize (Fleming), Counter (Prodigy), Reassess (Master Bai)
              const done = (i === 0 && ["lamp_effect","fleming_entry","culture_prompt","culture_effect","prodigy_entry","prodigy_prompt","prodigy_effect","master_bai","player_turn"].includes(stage))
                        || (i === 1 && ["culture_effect","prodigy_entry","prodigy_prompt","prodigy_effect","master_bai","player_turn"].includes(stage))
                        || (i === 2 && ["prodigy_effect","master_bai","player_turn"].includes(stage));
              const active = (i === 0 && ["frozen_field","nightingale_entry","lamp_prompt","lamp_effect"].includes(stage))
                           || (i === 1 && ["fleming_entry","culture_prompt","culture_effect"].includes(stage))
                           || (i === 2 && ["prodigy_entry","prodigy_prompt","prodigy_effect"].includes(stage))
                           || (i === 3 && ["master_bai","player_turn"].includes(stage));
              return (
                <View key={step} style={styles.stepItem}>
                  <View style={[
                    styles.stepDot,
                    done   && styles.stepDotDone,
                    active && styles.stepDotActive,
                  ]} />
                  <Text style={[
                    styles.stepText,
                    done   && styles.stepTextDone,
                    active && styles.stepTextActive,
                  ]}>{step}</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        <View style={{ flex: 1 }} pointerEvents="none" />

        {/* ── CHARACTER ENTRY CARD ── */}
        {isEntryStage && currentChar && (
          <Animated.View
            style={[
              styles.entryWrap,
              {
                opacity:   charFade,
                transform: [{ translateY: charSlide }],
              },
            ]}
          >
            {/* Dialogue card */}
            <View style={[styles.entryCard, { borderColor: currentChar.accentBorder, backgroundColor: currentChar.accentBg }]}>
              <View style={styles.entryNameRow}>
                {/* 48 px circle face avatar */}
                <View style={[styles.entryAvatarCircle, { borderColor: currentChar.ownerColor }]}>
                  <ExpoImage source={currentChar.avatar} style={styles.entryAvatarImg} contentFit="cover" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.entryOwner, { color: currentChar.ownerColor }]}>
                    {currentChar.owner}
                  </Text>
                  <Text style={styles.entryRole}>
                    {currentChar === PRODIGY_SKILL ? "The Prodigy — Peak Power" : currentChar === LAMP_SKILL ? "Legendary Support" : "Legendary Assessment"}
                  </Text>
                </View>
              </View>
              <Animated.Text style={[styles.entryDialogue, { opacity: dlgFade }]}>
                "{currentChar.prompt}"
              </Animated.Text>
              <Pressable style={styles.entryAdvance} onPress={handleTapEntry}>
                <Text style={[styles.entryAdvanceText, { color: currentChar.ownerColor }]}>
                  SEE SKILL  →
                </Text>
              </Pressable>
            </View>

            {/* Large head-to-torso portrait — absolute, right side, torso flush with card bottom */}
            <ExpoImage
              source={currentChar.avatar}
              style={styles.entryPortrait}
              contentFit="contain"
            />
          </Animated.View>
        )}

        {/* ── SKILL CARD ── */}
        {(isLampPrompt || isProdigyPrompt || isCulturePrompt) && currentSkill && (
          <Animated.View
            style={[
              styles.skillCard,
              {
                opacity:         skillFade,
                transform:       [{ scale: skillScale }],
                borderColor:     currentSkill.accentBorder,
                backgroundColor: "rgba(4,10,18,0.94)",
              },
            ]}
          >
            {/* Skill header */}
            <View style={styles.skillHeader}>
              <ExpoImage source={currentSkill.avatar} style={styles.skillAvatar} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.skillOwner, { color: currentSkill.ownerColor }]}>
                  {currentSkill.owner}
                </Text>
                <Text style={[styles.skillName, { color: currentSkill.ownerColor }]}>
                  {currentSkill.name}
                </Text>
              </View>
            </View>

            {/* Effects list */}
            <View style={styles.effectsList}>
              {currentSkill.effects.map((effect, i) => (
                <View key={i} style={styles.effectRow}>
                  <Text style={[styles.effectDot, { color: currentSkill.effectColor }]}>◆</Text>
                  <Text style={styles.effectText}>{effect}</Text>
                </View>
              ))}
            </View>

            {/* USE SKILL button */}
            <Pressable
              style={[styles.useSkillBtn, { borderColor: currentSkill.accentBorder }]}
              onPress={isProdigyPrompt ? handleUseProdigy : isLampPrompt ? handleUseLamp : handleUseCulture}
            >
              <LinearGradient
                colors={isProdigyPrompt
                  ? ["rgba(232,53,74,0.18)", "rgba(232,53,74,0.08)"]
                  : isLampPrompt
                  ? ["rgba(232,196,83,0.18)", "rgba(232,196,83,0.08)"]
                  : ["rgba(62,207,178,0.18)", "rgba(62,207,178,0.08)"]}
                style={styles.useSkillGradient}
              >
                <Text style={[styles.useSkillText, { color: currentSkill.ownerColor }]}>
                  USE SKILL
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {/* ── MASTER BAI LESSON ── */}
        {isMasterBai && (
          <Animated.View style={[styles.mbWrap, { opacity: mbFade }]} pointerEvents="none">
            <View style={styles.mbPanel}>
              <View style={styles.mbNameRow}>
                <View style={styles.mbAvatarCircle}>
                  <ExpoImage source={ART.masterBai} style={styles.mbAvatarImg} contentFit="cover" />
                </View>
                <Text style={styles.mbSpeaker}>MASTER BAI</Text>
              </View>
              <Text style={styles.mbLesson}>
                "Scout first. Stabilize what you find. Then counter — with everything you have. Then reassess. Every time — in that sequence."
              </Text>
            </View>
            {/* Large portrait — absolute, right side, torso flush with panel bottom */}
            <ExpoImage source={ART.masterBai} style={styles.mbPortrait} contentFit="contain" />
          </Animated.View>
        )}

        {/* ── PLAYER TURN CTA ── */}
        {isPlayerTurn && (
          <Animated.View
            style={[styles.ctaWrap, { opacity: ctaFade, transform: [{ scale: ctaScale }] }]}
          >
            <Text style={styles.ctaLabel}>Your assessment is complete.</Text>
            <Pressable style={styles.ctaBtn} onPress={handleEnterBattle}>
              <LinearGradient
                colors={["#7B2020", "#B22222", "#7B2020"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                <Text style={styles.ctaText}>TAKE ACTION</Text>
              </LinearGradient>
            </Pressable>
            <Text style={styles.ctaSub}>
              Assess.  Prioritize.  Intervene.  Reassess.
            </Text>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
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
    width:  "100%",
    height: "100%",
  },

  frozenTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,20,40,0.38)",
  },

  redOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#5C0000",
  },

  bottomGradient: {
    position: "absolute",
    bottom:   0,
    left:     0,
    right:    0,
    height:   "60%",
  },

  safe: {
    flex:              1,
    paddingHorizontal: 16,
    paddingBottom:     12,
  },

  // Top bar
  topBar: {
    paddingTop: 16,
    gap:        8,
  },
  sceneLabel: {
    color:         "rgba(255,100,100,0.45)",
    fontSize:      10,
    fontWeight:    "700",
    letterSpacing: 2.5,
    textAlign:     "center",
  },
  stepRow: {
    flexDirection:  "row",
    justifyContent: "center",
    gap:            28,
  },
  stepItem: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
  },
  stepDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: "rgba(255,255,255,0.20)",
  },
  stepDotDone:   { backgroundColor: "rgba(255,255,255,0.45)" },
  stepDotActive: { backgroundColor: "#E8C453", shadowColor: "#E8C453", shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  stepText: {
    color:         "rgba(255,255,255,0.30)",
    fontSize:      10,
    fontWeight:    "700",
    letterSpacing: 1.5,
  },
  stepTextDone:   { color: "rgba(255,255,255,0.55)" },
  stepTextActive: { color: "#F4F7FB" },

  // Effect layers
  effectLayer: {
    ...StyleSheet.absoluteFillObject,
  },

  // Prodigy effect
  prodigyGlow: {
    position:        "absolute",
    alignSelf:       "center",
    top:             "30%",
    width:           280,
    height:          280,
    borderRadius:    140,
    backgroundColor: "rgba(232,53,74,0.45)",
  },

  // Lamp effect
  fogLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  lampGlow: {
    position:        "absolute",
    top:             "20%",
    left:            "10%",
    width:           200,
    height:          200,
    borderRadius:    100,
    backgroundColor: "rgba(255,200,60,0.55)",
  },
  revealChip: {
    position:          "absolute",
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      8,
    backgroundColor:   "rgba(4,10,18,0.88)",
    borderWidth:       1,
    gap:               2,
  },
  revealChip1: { top:    "25%", left: "15%" },
  revealChip2: { top:    "40%", right: "12%" },
  revealChip3: { bottom: "38%", left: "20%" },
  revealHazard:  { color: "#FF6B35", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  revealDecoy:   { color: "#E8C453", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  revealPatient: { color: "#F77B72", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  revealSub:     { color: "rgba(200,220,240,0.60)", fontSize: 10, fontWeight: "400" },

  // Culture effect
  scanLine: {
    position:        "absolute",
    left:            0,
    right:           0,
    height:          3,
    backgroundColor: "rgba(62,207,178,0.70)",
  },
  scanLine2: {
    backgroundColor: "rgba(62,207,178,0.45)",
  },
  analysisPanel: {
    position:          "absolute",
    top:               "28%",
    left:              "10%",
    right:             "10%",
    backgroundColor:   "rgba(4,15,20,0.94)",
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       "rgba(62,207,178,0.35)",
    padding:           14,
    gap:               8,
  },
  analysisPanelTitle: {
    color:         "#3ECFB2",
    fontSize:      10,
    fontWeight:    "800",
    letterSpacing: 3,
    marginBottom:  4,
  },
  analysisRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
  },
  analysisWarningRow: {
    marginTop:    4,
    borderTopWidth: 1,
    borderTopColor: "rgba(62,207,178,0.15)",
    paddingTop:   8,
  },
  analysisWeak:   { color: "#3ECFB2", fontSize: 11, fontWeight: "700", width: 90 },
  analysisResist: { color: "#F77B72", fontSize: 11, fontWeight: "700", width: 90 },
  analysisValue:  { color: "#EDF2F7", fontSize: 12, fontWeight: "400" },
  analysisWarn:   { color: "#E8C453", fontSize: 11, fontWeight: "500", fontStyle: "italic" },

  // Entry card
  entryWrap: {
    marginBottom: 8,
    position:     "relative",
  },
  entryPortrait: {
    position: "absolute",
    right:    8,
    bottom:   0,
    width:    160,
    height:   280,
  },
  entryCard: {
    borderRadius:  14,
    borderWidth:   1,
    padding:       14,
    paddingTop:    10,
    paddingRight:  120,
    gap:           10,
  },
  entryNameRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  entryAvatarCircle: {
    width:        48,
    height:       48,
    borderRadius: 24,
    overflow:     "hidden",
    borderWidth:  2,
  },
  entryAvatarImg: {
    width:  48,
    height: 48,
  },
  entryOwner: {
    fontSize:      11,
    fontWeight:    "800",
    letterSpacing: 1.8,
  },
  entryRole: {
    color:     "rgba(200,220,240,0.55)",
    fontSize:  11,
    marginTop: 1,
  },
  entryDialogue: {
    color:         "rgba(230,240,255,0.88)",
    fontSize:      15,
    lineHeight:    24,
    fontWeight:    "300",
    letterSpacing: 0.2,
    fontStyle:     "italic",
  },
  entryAdvance: {
    alignSelf:     "flex-end",
    paddingTop:    4,
    paddingBottom: 2,
  },
  entryAdvanceText: {
    fontSize:      11,
    fontWeight:    "800",
    letterSpacing: 1.5,
  },

  // Skill card
  skillCard: {
    borderRadius: 14,
    borderWidth:  1,
    padding:      14,
    gap:          12,
    marginBottom: 8,
  },
  skillHeader: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           12,
  },
  skillAvatar: {
    width:        44,
    height:       44,
    borderRadius: 22,
  },
  skillOwner: {
    fontSize:      9,
    fontWeight:    "800",
    letterSpacing: 2,
    marginBottom:  1,
  },
  skillName: {
    fontSize:      16,
    fontWeight:    "600",
    letterSpacing: 0.3,
  },
  effectsList: {
    gap: 6,
  },
  effectRow: {
    flexDirection: "row",
    alignItems:    "flex-start",
    gap:           8,
  },
  effectDot: {
    fontSize: 8,
    marginTop: 5,
  },
  effectText: {
    color:      "#C5D5E8",
    fontSize:   13,
    lineHeight: 20,
    flex:       1,
  },
  useSkillBtn: {
    borderRadius: 10,
    borderWidth:  1,
    overflow:     "hidden",
    marginTop:    4,
  },
  useSkillGradient: {
    paddingVertical:   14,
    alignItems:        "center",
  },
  useSkillText: {
    fontSize:      13,
    fontWeight:    "800",
    letterSpacing: 3,
  },

  // Master Bai lesson
  mbWrap: {
    marginBottom: 8,
    position:     "relative",
  },
  mbPortrait: {
    position: "absolute",
    right:    8,
    bottom:   0,
    width:    140,
    height:   240,
  },
  mbPanel: {
    backgroundColor: "rgba(4,10,18,0.90)",
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     "rgba(217,164,65,0.28)",
    padding:         14,
    paddingTop:      10,
    paddingRight:    110,
    gap:             8,
  },
  mbNameRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
  },
  mbAvatarCircle: {
    width:        48,
    height:       48,
    borderRadius: 24,
    overflow:     "hidden",
    borderWidth:  2,
    borderColor:  "#D9A441",
  },
  mbAvatarImg: {
    width:  48,
    height: 48,
  },
  mbSpeaker: {
    color:         "#D9A441",
    fontSize:      10,
    fontWeight:    "800",
    letterSpacing: 2.5,
    flex:          1,
  },
  mbLesson: {
    color:         "rgba(230,240,255,0.88)",
    fontSize:      15,
    lineHeight:    24,
    fontWeight:    "300",
    fontStyle:     "italic",
    letterSpacing: 0.2,
  },

  // Player turn CTA
  ctaWrap: {
    alignItems:   "center",
    gap:          10,
    marginBottom: 4,
  },
  ctaLabel: {
    color:         "rgba(200,220,240,0.55)",
    fontSize:      12,
    letterSpacing: 0.5,
    textAlign:     "center",
  },
  ctaBtn: {
    width:        "100%",
    borderRadius: 10,
    overflow:     "hidden",
  },
  ctaGradient: {
    paddingVertical: 16,
    alignItems:      "center",
  },
  ctaText: {
    color:         "#FFFFFF",
    fontSize:      14,
    fontWeight:    "800",
    letterSpacing: 4,
  },
  ctaSub: {
    color:         "rgba(255,255,255,0.25)",
    fontSize:      11,
    letterSpacing: 1.2,
    textAlign:     "center",
  },
});
