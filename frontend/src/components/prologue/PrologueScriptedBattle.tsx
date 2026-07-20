/**
 * PrologueScriptedBattle
 *
 * Push 6 — "The Fall" (scripted_defeat phase)
 *
 * Cinematic guided battle — same format as PrologueBattleTutorial.
 * Legendary party: Nightingale, The Prodigy, Fleming face the Silent Infarction.
 * Three skill demos → boss adapts → trap closes → scripted defeat.
 *
 * Stages:
 *   opening          → battlefield settles (auto 1.5 s)
 *   nightingale_entry → Nightingale speaks (tap SEE SKILL)
 *   lamp_prompt       → Lamp of Observation card (tap USE SKILL)
 *   lamp_effect       → Golden glow + hazard reveals (auto 2.8 s)
 *   prodigy_entry     → The Prodigy speaks (tap SEE SKILL)
 *   strike_prompt     → Brilliant Intervention card (tap USE SKILL)
 *   strike_effect     → Crimson burst + adaptation warning (auto 2.8 s)
 *   fleming_entry     → Fleming speaks (tap SEE SKILL)
 *   analyze_prompt    → Culture & Sensitivity card (tap USE SKILL)
 *   analyze_effect    → Teal scan + true-source panel (auto 2.8 s)
 *   trap_closing      → Boss counterattack overlay (auto 3.5 s)
 *   finale_0..4       → Tappable defeat dialogue cards
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

// ─── Art ──────────────────────────────────────────────────────────────────────

const ART = {
  battlefield:    require("../../../assets/images/tactical_battlefield.png"),
  theProdigy:     require("../../../assets/heroes/battle/the_prodigy.png"),
  nightingale:    require("../../../assets/images/nightingale_nobg.png"),
  fleming:        require("../../../assets/images/fleming_nobg.png"),
  masterBai:      require("../../../assets/images/master_bai_nobg.png"),
  bossPortrait:   require("../../../assets/images/silent_infarction_nobg.png"),
} as const;

// ─── Stage machine ────────────────────────────────────────────────────────────

type Stage =
  | "opening"
  | "nightingale_entry"
  | "lamp_prompt"
  | "lamp_effect"
  | "prodigy_entry"
  | "strike_prompt"
  | "strike_effect"
  | "fleming_entry"
  | "analyze_prompt"
  | "analyze_effect"
  | "trap_closing"
  | "finale"
  | "done";

// ─── Skill data ───────────────────────────────────────────────────────────────

const LAMP_SKILL = {
  name:      "Lamp of Observation",
  apCost:    2,
  owner:     "FLORENCE NIGHTINGALE",
  ownerColor: "#E8C453",
  avatar:    ART.nightingale,
  accentBg:  "rgba(232,196,83,0.08)",
  accentBorder: "rgba(232,196,83,0.30)",
  effectColor: "#E8C453",
  effects: [
    "Scout: reveals hidden hazards and concealed patient status",
    "Must be used before Strike — blind attacks are far weaker",
    "Exposes the true source of deterioration over time",
    "AP Cost: 2 — the investment that makes everything else work",
  ],
  prompt: "Do not attack yet. Let me read the field first.",
} as const;

const STRIKE_SKILL = {
  name:      "Brilliant Intervention",
  apCost:    3,
  owner:     "THE PRODIGY",
  ownerColor: "#E8354A",
  avatar:    ART.theProdigy,
  accentBg:  "rgba(232,53,74,0.08)",
  accentBorder: "rgba(232,53,74,0.30)",
  effectColor: "#E8354A",
  effects: [
    "Strike: peak power when scouted cues are known",
    "Corruption reduced: but the source is not yet visible",
    "Broad attacks cause adaptation — precision must follow",
    "AP Cost: 3 — only effective after proper assessment",
  ],
  prompt: "I see it. Stand back — I know this condition.",
} as const;

const ANALYZE_SKILL = {
  name:      "Culture & Sensitivity",
  apCost:    2,
  owner:     "SIR ALEXANDER FLEMING",
  ownerColor: "#3ECFB2",
  avatar:    ART.fleming,
  accentBg:  "rgba(62,207,178,0.08)",
  accentBorder: "rgba(62,207,178,0.30)",
  effectColor: "#3ECFB2",
  effects: [
    "Analyze: identifies the true source and its resistance profile",
    "Reveals what broad treatment cannot stop",
    "The Silent Infarction was never the surface enemy",
    "AP Cost: 2 — too late. The trap was already set.",
  ],
  prompt: "Wait. This is not the primary lesion. Something is hiding beneath it.",
} as const;

// ─── Finale dialogue ──────────────────────────────────────────────────────────

interface FinaleCard {
  speaker:  string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  portrait: any | null;
  text:     string;
  subtext?: string;
  color:    string;
}

const FINALE: FinaleCard[] = [
  {
    speaker: null,
    portrait: null,
    text: "THE TRAP CLOSES.",
    subtext: "Not because the party was weak. Because the root cause was set before the battle began.",
    color: "#FF3333",
  },
  {
    speaker: "FLORENCE NIGHTINGALE",
    portrait: ART.nightingale,
    text: "We have to retreat. The damage is done. The trap was always closing — we just could not see it in time.",
    color: "#E8C453",
  },
  {
    speaker: "ALEXANDER FLEMING",
    portrait: ART.fleming,
    text: "The overconfidence was the trap. The choices that led here came long before this battle.",
    color: "#3ECFB2",
  },
  {
    speaker: "MASTER BAI",
    portrait: ART.masterBai,
    text: "You were brilliant. That was never in question. But brilliance that skips the assessment is the most dangerous kind.",
    color: "#D9A441",
  },
  {
    speaker: null,
    portrait: null,
    text: "The battle is lost.\nBut something survived.",
    subtext: "The knowledge. The consequence. The beginning.",
    color: "rgba(200,210,220,0.65)",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function PrologueScriptedBattle({ onComplete }: Props) {
  const [stage, setStage] = useState<Stage>("opening");
  const stageRef   = useRef<Stage>("opening");
  const mountedRef = useRef(true);
  const timers     = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Boss reveal progress (0..1) — increases as skills are used
  const [bossRevealed, setBossRevealed] = useState(0);
  const bossRevRef = useRef(0);

  // Finale step index
  const [finaleStep, setFinaleStep] = useState(0);
  const finaleStepRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // ── Animated values ───────────────────────────────────────────────────────────

  const bgFade      = useRef(new Animated.Value(0)).current;
  const bgScale     = useRef(new Animated.Value(1.04)).current;
  const redPulse    = useRef(new Animated.Value(0)).current;
  const labelFade   = useRef(new Animated.Value(0)).current;
  const charFade    = useRef(new Animated.Value(0)).current;
  const charSlide   = useRef(new Animated.Value(40)).current;
  const dlgFade     = useRef(new Animated.Value(0)).current;
  const skillFade   = useRef(new Animated.Value(0)).current;
  const skillScale  = useRef(new Animated.Value(0.94)).current;
  const doomFade    = useRef(new Animated.Value(0)).current;
  const flashFade   = useRef(new Animated.Value(0)).current;
  const finaleFade  = useRef(new Animated.Value(0)).current;

  // Lamp effect
  const lampGlowScale = useRef(new Animated.Value(0.2)).current;
  const lampGlowFade  = useRef(new Animated.Value(0)).current;
  const lamp1Fade     = useRef(new Animated.Value(0)).current;
  const lamp2Fade     = useRef(new Animated.Value(0)).current;
  const lamp3Fade     = useRef(new Animated.Value(0)).current;

  // Strike effect
  const strikeGlow  = useRef(new Animated.Value(0)).current;
  const strikeRing  = useRef(new Animated.Value(0.3)).current;
  const strike1Fade = useRef(new Animated.Value(0)).current;
  const strike2Fade = useRef(new Animated.Value(0)).current;

  // Analyze effect
  const scanY        = useRef(new Animated.Value(-200)).current;
  const scanFade     = useRef(new Animated.Value(0)).current;
  const analysisFade = useRef(new Animated.Value(0)).current;

  // Trap overlay
  const trapFade = useRef(new Animated.Value(0)).current;

  // Boss glow
  const bossGlow = useRef(new Animated.Value(0)).current;

  // ── Helpers ───────────────────────────────────────────────────────────────────

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

  function applyBossReveal(delta: number) {
    const next = Math.min(1, Math.max(0, bossRevRef.current + delta));
    bossRevRef.current = next;
    setBossRevealed(next);
  }

  function flashScreen() {
    Animated.sequence([
      Animated.timing(flashFade, { toValue: 0.35, duration: 160, useNativeDriver: false }),
      Animated.timing(flashFade, { toValue: 0,    duration: 500, useNativeDriver: false }),
    ]).start();
  }

  function showChar() {
    charFade.setValue(0);
    charSlide.setValue(40);
    dlgFade.setValue(0);
    Animated.parallel([
      Animated.timing(charFade,  { toValue: 1, duration: 450, useNativeDriver: false }),
      Animated.timing(charSlide, { toValue: 0, duration: 450, useNativeDriver: false }),
    ]).start(() => anim(dlgFade, 1, 350));
  }

  function hideChar(cb: () => void) {
    Animated.parallel([
      Animated.timing(charFade, { toValue: 0, duration: 250, useNativeDriver: false }),
      Animated.timing(dlgFade,  { toValue: 0, duration: 250, useNativeDriver: false }),
    ]).start(() => cb());
  }

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

  // ── Startup ───────────────────────────────────────────────────────────────────

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

    const bossBreath = Animated.loop(
      Animated.sequence([
        Animated.timing(bossGlow, { toValue: 1, duration: 2200, useNativeDriver: false }),
        Animated.timing(bossGlow, { toValue: 0, duration: 2200, useNativeDriver: false }),
      ])
    );
    bossBreath.start();

    anim(bgFade, 1, 800);
    after(600, () => anim(labelFade, 1, 600));

    // Nightingale enters first
    after(1500, () => {
      toStage("nightingale_entry");
      showChar();
    });

    return () => {
      breathe.stop();
      pulse.stop();
      bossBreath.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Skill effects ─────────────────────────────────────────────────────────────

  function playLampEffect() {
    lampGlowScale.setValue(0.2);
    lampGlowFade.setValue(0);
    lamp1Fade.setValue(0);
    lamp2Fade.setValue(0);
    lamp3Fade.setValue(0);

    Animated.parallel([
      Animated.timing(lampGlowScale, { toValue: 2.8, duration: 1200, useNativeDriver: false }),
      Animated.timing(lampGlowFade,  { toValue: 0.60, duration: 500,  useNativeDriver: false }),
    ]).start(() => anim(lampGlowFade, 0, 700));

    after(400,  () => anim(lamp1Fade, 1, 400));
    after(800,  () => anim(lamp2Fade, 1, 400));
    after(1200, () => anim(lamp3Fade, 1, 400));

    applyBossReveal(0.25);

    after(2800, () => {
      Animated.parallel([
        Animated.timing(lamp1Fade, { toValue: 0, duration: 350, useNativeDriver: false }),
        Animated.timing(lamp2Fade, { toValue: 0, duration: 350, useNativeDriver: false }),
        Animated.timing(lamp3Fade, { toValue: 0, duration: 350, useNativeDriver: false }),
      ]).start(() => {
        toStage("prodigy_entry");
        showChar();
      });
    });
  }

  function playStrikeEffect() {
    strikeGlow.setValue(0);
    strikeRing.setValue(0.3);
    strike1Fade.setValue(0);
    strike2Fade.setValue(0);

    Animated.parallel([
      Animated.timing(strikeGlow, { toValue: 0.70, duration: 500,  useNativeDriver: false }),
      Animated.timing(strikeRing, { toValue: 2.4,  duration: 1000, useNativeDriver: false }),
    ]).start(() => anim(strikeGlow, 0, 800));

    after(400, () => anim(strike1Fade, 1, 350));
    after(900, () => anim(strike2Fade, 1, 350));

    flashScreen();
    applyBossReveal(0.30);

    after(2800, () => {
      Animated.parallel([
        Animated.timing(strike1Fade, { toValue: 0, duration: 350, useNativeDriver: false }),
        Animated.timing(strike2Fade, { toValue: 0, duration: 350, useNativeDriver: false }),
      ]).start(() => {
        toStage("fleming_entry");
        showChar();
      });
    });
  }

  function playAnalyzeEffect() {
    scanY.setValue(-200);
    scanFade.setValue(0);
    analysisFade.setValue(0);

    anim(scanFade, 0.8, 200);
    Animated.timing(scanY, { toValue: 600, duration: 900, useNativeDriver: false }).start(
      () => anim(scanFade, 0, 300),
    );

    after(900, () => anim(analysisFade, 1, 500));
    applyBossReveal(0.45);

    after(2800, () => {
      Animated.parallel([
        Animated.timing(analysisFade, { toValue: 0, duration: 350, useNativeDriver: false }),
        Animated.timing(scanFade,     { toValue: 0, duration: 250, useNativeDriver: false }),
      ]).start(() => startTrapClosing());
    });
  }

  // ── Trap closing sequence (auto) ──────────────────────────────────────────────

  function startTrapClosing() {
    toStage("trap_closing");
    anim(doomFade, 0.75, 1800);
    after(500,  () => anim(trapFade, 1, 600));
    after(3500, () => {
      anim(trapFade,  0, 500);
      anim(doomFade, 1, 1400, () => {
        // Start tappable finale
        toStage("finale");
        finaleStepRef.current = 0;
        setFinaleStep(0);
        finaleFade.setValue(0);
        anim(finaleFade, 1, 600);
      });
    });
  }

  // ── Finale advance (tappable) ─────────────────────────────────────────────────

  const handleFinaleAdvance = useCallback(() => {
    if (stageRef.current !== "finale") return;
    const next = finaleStepRef.current + 1;
    if (next >= FINALE.length) {
      anim(finaleFade, 0, 600, () => {
        toStage("done");
        onComplete();
      });
      return;
    }
    anim(finaleFade, 0, 300, () => {
      finaleStepRef.current = next;
      setFinaleStep(next);
      anim(finaleFade, 1, 400);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete]);

  // ── Tap handlers ──────────────────────────────────────────────────────────────

  const handleTapEntry = useCallback(() => {
    const s = stageRef.current;
    if (s === "nightingale_entry") {
      hideChar(() => { toStage("lamp_prompt"); showSkillCard(); });
    } else if (s === "prodigy_entry") {
      hideChar(() => { toStage("strike_prompt"); showSkillCard(); });
    } else if (s === "fleming_entry") {
      hideChar(() => { toStage("analyze_prompt"); showSkillCard(); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUseLamp = useCallback(() => {
    if (stageRef.current !== "lamp_prompt") return;
    hideSkillCard(() => { toStage("lamp_effect"); playLampEffect(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUseStrike = useCallback(() => {
    if (stageRef.current !== "strike_prompt") return;
    hideSkillCard(() => { toStage("strike_effect"); playStrikeEffect(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUseAnalyze = useCallback(() => {
    if (stageRef.current !== "analyze_prompt") return;
    hideSkillCard(() => { toStage("analyze_effect"); playAnalyzeEffect(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived render state ──────────────────────────────────────────────────────

  const isNightingaleEntry = stage === "nightingale_entry";
  const isProdigyEntry     = stage === "prodigy_entry";
  const isFlemingEntry     = stage === "fleming_entry";
  const isEntryStage       = isNightingaleEntry || isProdigyEntry || isFlemingEntry;

  const isLampPrompt    = stage === "lamp_prompt";
  const isStrikePrompt  = stage === "strike_prompt";
  const isAnalyzePrompt = stage === "analyze_prompt";
  const isSkillPrompt   = isLampPrompt || isStrikePrompt || isAnalyzePrompt;

  const isLampEffect    = stage === "lamp_effect";
  const isStrikeEffect  = stage === "strike_effect";
  const isAnalyzeEffect = stage === "analyze_effect";
  const isTrapClosing   = stage === "trap_closing";
  const isFinale        = stage === "finale";

  const currentChar = isNightingaleEntry ? LAMP_SKILL
                    : isProdigyEntry     ? STRIKE_SKILL
                    : isFlemingEntry     ? ANALYZE_SKILL
                    : null;

  const currentSkill = isLampPrompt    ? LAMP_SKILL
                     : isStrikePrompt  ? STRIKE_SKILL
                     : isAnalyzePrompt ? ANALYZE_SKILL
                     : null;

  const bossGlowOpacity = bossGlow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.48] });
  const finaleCard = FINALE[finaleStep] ?? FINALE[0];

  // Progress step indicator
  const stepDone = (i: number) =>
    (i === 0 && ["prodigy_entry","strike_prompt","strike_effect","fleming_entry","analyze_prompt","analyze_effect","trap_closing","finale","done"].includes(stage)) ||
    (i === 1 && ["fleming_entry","analyze_prompt","analyze_effect","trap_closing","finale","done"].includes(stage)) ||
    (i === 2 && ["trap_closing","finale","done"].includes(stage));

  const stepActive = (i: number) =>
    (i === 0 && ["opening","nightingale_entry","lamp_prompt","lamp_effect"].includes(stage)) ||
    (i === 1 && ["prodigy_entry","strike_prompt","strike_effect"].includes(stage)) ||
    (i === 2 && ["fleming_entry","analyze_prompt","analyze_effect"].includes(stage));

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* BACKGROUND */}
      <Animated.View style={[styles.bgWrap, { opacity: bgFade, transform: [{ scale: bgScale }] }]}>
        <ExpoImage source={ART.battlefield} style={styles.bg} contentFit="cover" />
      </Animated.View>

      {/* Dark tint */}
      <View style={styles.darkTint} pointerEvents="none" />

      {/* Red trap pulse */}
      <Animated.View style={[styles.redOverlay, { opacity: redPulse }]} pointerEvents="none" />

      {/* Progressive doom overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: doomFade }]}
        pointerEvents="none"
      />

      {/* Hit flash */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#CC0000", opacity: flashFade }]}
        pointerEvents="none"
      />

      {/* ── LAMP EFFECT LAYER ── */}
      {isLampEffect && (
        <View style={styles.effectLayer} pointerEvents="none">
          <Animated.View
            style={[styles.lampGlow, { opacity: lampGlowFade, transform: [{ scale: lampGlowScale }] }]}
          />
          <Animated.View style={[styles.revealChip, styles.chipTop, { opacity: lamp1Fade }]}>
            <Text style={styles.revealHazard}>⚠  CONCEALED HAZARD</Text>
            <Text style={styles.revealSub}>Secondary source detected beneath surface enemy</Text>
          </Animated.View>
          <Animated.View style={[styles.revealChip, styles.chipMid, { opacity: lamp2Fade }]}>
            <Text style={styles.revealDecoy}>◈  DECOY DETECTED</Text>
            <Text style={styles.revealSub}>Visible enemy is not the primary threat</Text>
          </Animated.View>
          <Animated.View style={[styles.revealChip, styles.chipBot, { opacity: lamp3Fade }]}>
            <Text style={styles.revealPatient}>↓  PATIENT STATUS: CRITICAL</Text>
            <Text style={styles.revealSub}>Deterioration in progress — assess before striking</Text>
          </Animated.View>
        </View>
      )}

      {/* ── STRIKE EFFECT LAYER ── */}
      {isStrikeEffect && (
        <View style={styles.effectLayer} pointerEvents="none">
          <Animated.View
            style={[styles.strikeGlow, { opacity: strikeGlow, transform: [{ scale: strikeRing }] }]}
          />
          <Animated.View style={[styles.revealChip, styles.chipTop, { opacity: strike1Fade }]}>
            <Text style={[styles.revealHazard, { color: "#E8354A" }]}>BRILLIANT INTERVENTION</Text>
            <Text style={styles.revealSub}>Corruption reduced — surface enemy weakening</Text>
          </Animated.View>
          <Animated.View style={[styles.revealChip, styles.chipBot, { opacity: strike2Fade }]}>
            <Text style={[styles.revealHazard, { color: "#FF8C00" }]}>⚠  SOURCE ADAPTING</Text>
            <Text style={styles.revealSub}>True threat has not been reached</Text>
          </Animated.View>
        </View>
      )}

      {/* ── ANALYZE EFFECT LAYER ── */}
      {isAnalyzeEffect && (
        <View style={styles.effectLayer} pointerEvents="none">
          <Animated.View
            style={[styles.scanLine, { opacity: scanFade, transform: [{ translateY: scanY }] }]}
          />
          <Animated.View style={[styles.analysisPanel, { opacity: analysisFade }]}>
            <Text style={styles.analysisPanelTitle}>ENEMY ANALYSIS</Text>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisWeak}>✓  TRUE SOURCE</Text>
              <Text style={styles.analysisValue}>Silent Infarction</Text>
            </View>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisResist}>✗  RESISTANCE</Text>
              <Text style={styles.analysisValue}>All Broad-Spectrum Strikes</Text>
            </View>
            <View style={[styles.analysisRow, styles.analysisWarningRow]}>
              <Text style={styles.analysisWarn}>⚠  Trap was set before this battle began</Text>
            </View>
          </Animated.View>
        </View>
      )}

      {/* ── TRAP CLOSING OVERLAY ── */}
      {isTrapClosing && (
        <Animated.View style={[styles.trapOverlay, { opacity: trapFade }]} pointerEvents="none">
          <Text style={styles.trapTitle}>THE TRAP CLOSES.</Text>
          <Text style={styles.trapSub}>
            The Silent Infarction was never the surface enemy.
          </Text>
        </Animated.View>
      )}

      {/* BOTTOM GRADIENT */}
      <LinearGradient
        colors={["transparent", "rgba(4,10,18,0.55)", "rgba(4,10,18,0.97)"]}
        locations={[0, 0.30, 0.72]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} pointerEvents="box-none">

        {/* ── TOP BAR (scene label + step row + boss card) ── */}
        {!isFinale && stage !== "done" && (
          <Animated.View style={[styles.topBar, { opacity: labelFade }]} pointerEvents="none">
            <Text style={styles.sceneLabel}>
              LEGENDARY PARTY  ·  SILENT INFARCTION ENCOUNTER
            </Text>

            {/* Step progress */}
            <View style={styles.stepRow}>
              {["Scout", "Strike", "Analyze"].map((label, i) => (
                <View key={label} style={styles.stepItem}>
                  <View style={[
                    styles.stepDot,
                    stepDone(i)   && styles.stepDotDone,
                    stepActive(i) && styles.stepDotActive,
                  ]} />
                  <Text style={[
                    styles.stepText,
                    stepDone(i)   && styles.stepTextDone,
                    stepActive(i) && styles.stepTextActive,
                  ]}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Boss card — small, top right */}
            <View style={styles.bossCardRow}>
              <View style={styles.bossCard}>
                <View style={styles.bossPortraitWrap}>
                  <ExpoImage
                    source={ART.bossPortrait}
                    style={styles.bossPortrait}
                    contentFit="contain"
                  />
                  {/* Concealment overlay */}
                  <View
                    style={[styles.bossConcealment, { opacity: Math.max(0, 1 - bossRevealed) }]}
                    pointerEvents="none"
                  />
                  <Animated.View
                    style={[styles.bossGlowRing, { opacity: bossGlowOpacity }]}
                    pointerEvents="none"
                  />
                </View>
                <Text style={styles.bossName}>SILENT INFARCTION</Text>
                <Text style={styles.bossHp}>
                  {bossRevealed < 0.4
                    ? "??? / ???"
                    : bossRevealed < 0.9
                    ? "Partially revealed"
                    : "TRUE SOURCE VISIBLE"}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

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
            {/* Standing portrait above card */}
            <View style={styles.entryPortraitRow}>
              <ExpoImage
                source={currentChar.avatar}
                style={styles.entryPortrait}
                contentFit="contain"
              />
            </View>

            {/* Dialogue card */}
            <View style={[styles.entryCard, { borderColor: currentChar.accentBorder, backgroundColor: currentChar.accentBg }]}>
              <View style={styles.entryNameRow}>
                <Text style={[styles.entryOwner, { color: currentChar.ownerColor }]}>
                  {currentChar.owner}
                </Text>
                <Text style={styles.entryRole}>
                  {isNightingaleEntry ? "Legendary Support — Scout"
                    : isProdigyEntry  ? "The Prodigy — Peak Strike"
                    : "Legendary Assessment"}
                </Text>
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
          </Animated.View>
        )}

        {/* ── SKILL CARD ── */}
        {isSkillPrompt && currentSkill && (
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

            <View style={styles.effectsList}>
              {currentSkill.effects.map((effect, i) => (
                <View key={i} style={styles.effectRow}>
                  <Text style={[styles.effectDot, { color: currentSkill.effectColor }]}>◆</Text>
                  <Text style={styles.effectText}>{effect}</Text>
                </View>
              ))}
            </View>

            <Pressable
              style={[styles.useSkillBtn, { borderColor: currentSkill.accentBorder }]}
              onPress={isLampPrompt ? handleUseLamp : isStrikePrompt ? handleUseStrike : handleUseAnalyze}
            >
              <LinearGradient
                colors={
                  isLampPrompt
                    ? ["rgba(232,196,83,0.18)", "rgba(232,196,83,0.08)"]
                    : isStrikePrompt
                    ? ["rgba(232,53,74,0.18)", "rgba(232,53,74,0.08)"]
                    : ["rgba(62,207,178,0.18)", "rgba(62,207,178,0.08)"]
                }
                style={styles.useSkillGradient}
              >
                <Text style={[styles.useSkillText, { color: currentSkill.ownerColor }]}>
                  USE SKILL
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {/* ── FINALE CARD ── */}
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
              {finaleCard.subtext ? (
                <Text style={styles.finaleSubtext}>{finaleCard.subtext}</Text>
              ) : null}
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
  bottomGradient: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: "60%",
  },

  safe: { flex: 1, paddingHorizontal: 16, paddingBottom: 12 },

  // Top bar
  topBar: { paddingTop: 14, gap: 8 },
  sceneLabel: {
    color: "rgba(255,100,100,0.45)", fontSize: 10, fontWeight: "700",
    letterSpacing: 2.5, textAlign: "center",
  },
  stepRow: { flexDirection: "row", justifyContent: "center", gap: 28 },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.20)",
  },
  stepDotDone:   { backgroundColor: "rgba(255,255,255,0.45)" },
  stepDotActive: {
    backgroundColor: "#E8C453",
    shadowColor: "#E8C453", shadowOpacity: 0.8, shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  stepText: {
    color: "rgba(255,255,255,0.30)", fontSize: 10, fontWeight: "700", letterSpacing: 1.5,
  },
  stepTextDone:   { color: "rgba(255,255,255,0.55)" },
  stepTextActive: { color: "#F4F7FB" },

  // Boss card (compact, top right)
  bossCardRow: { alignItems: "flex-end", paddingRight: 4 },
  bossCard: {
    alignItems: "center", paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: "rgba(20,4,4,0.72)", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(200,20,20,0.25)", gap: 3,
  },
  bossPortraitWrap: { position: "relative", width: 60, height: 76 },
  bossPortrait:     { width: 60, height: 76 },
  bossConcealment: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#050505",
    borderRadius: 6,
  },
  bossGlowRing: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#600000",
    borderRadius: 10,
  },
  bossName: { color: "#CC3333", fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  bossHp:   { color: "rgba(200,100,100,0.55)", fontSize: 9, fontWeight: "300" },

  // Effect layers
  effectLayer: { ...StyleSheet.absoluteFillObject },

  // Lamp glow
  lampGlow: {
    position: "absolute", top: "20%", left: "10%",
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(255,200,60,0.55)",
  },

  // Strike glow
  strikeGlow: {
    position: "absolute", alignSelf: "center", top: "30%",
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: "rgba(232,53,74,0.45)",
  },

  // Scan line
  scanLine: {
    position: "absolute", left: 0, right: 0, height: 2,
    backgroundColor: "rgba(62,207,178,0.70)",
  },

  // Reveal chips
  revealChip: {
    position: "absolute", left: 20, right: 20,
    backgroundColor: "rgba(4,10,18,0.88)",
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", gap: 3,
  },
  chipTop: { top: "22%" },
  chipMid: { top: "42%" },
  chipBot: { top: "62%" },
  revealHazard: { color: "#E8C453", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  revealDecoy:  { color: "#CC88FF", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  revealPatient: { color: "#FF6B6B", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  revealSub:    { color: "rgba(255,255,255,0.55)", fontSize: 11 },

  // Analysis panel
  analysisPanel: {
    position: "absolute", left: 20, right: 20, top: "30%",
    backgroundColor: "rgba(4,10,18,0.92)", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(62,207,178,0.30)",
    paddingVertical: 14, paddingHorizontal: 16, gap: 8,
  },
  analysisPanelTitle: {
    color: "#3ECFB2", fontSize: 11, fontWeight: "800", letterSpacing: 2, marginBottom: 4,
  },
  analysisRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  analysisWeak:  { color: "#3ECFB2", fontSize: 12, fontWeight: "700" },
  analysisResist: { color: "#FF6B6B", fontSize: 12, fontWeight: "700" },
  analysisValue: { color: "rgba(255,255,255,0.65)", fontSize: 12 },
  analysisWarningRow: {
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", paddingTop: 8, marginTop: 4,
  },
  analysisWarn: { color: "#E8C453", fontSize: 11, flex: 1 },

  // Trap overlay
  trapOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(100,0,0,0.25)",
    paddingHorizontal: 32, gap: 16,
  },
  trapTitle: {
    color: "#FF3333", fontSize: 26, fontWeight: "800",
    letterSpacing: 3, textAlign: "center",
  },
  trapSub: {
    color: "rgba(255,200,200,0.70)", fontSize: 14, textAlign: "center", lineHeight: 22,
  },

  // Entry card
  entryWrap: {
    marginBottom: 12,
  },
  entryPortraitRow: {
    paddingHorizontal: 16,
    alignItems:        "flex-start",
  },
  entryPortrait: {
    width:        120,
    height:       172,
    marginBottom: -22,
  },
  entryCard: {
    borderRadius: 12, borderWidth: 1,
    paddingVertical: 12, paddingHorizontal: 16, gap: 12,
  },
  entryNameRow: { gap: 2 },
  entryOwner:   { fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  entryRole:    { color: "rgba(255,255,255,0.50)", fontSize: 11, marginTop: 2 },
  entryDialogue: {
    color: "rgba(255,255,255,0.80)", fontSize: 14, lineHeight: 22, fontStyle: "italic",
  },
  entryAdvance: { alignSelf: "flex-end" },
  entryAdvanceText: { fontSize: 13, fontWeight: "700", letterSpacing: 1 },

  // Skill card
  skillCard: {
    marginBottom: 12, borderRadius: 12, borderWidth: 1,
    paddingVertical: 16, paddingHorizontal: 16, gap: 14,
  },
  skillHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  skillAvatar: { width: 44, height: 44, borderRadius: 22 },
  skillOwner:  { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  skillName:   { fontSize: 16, fontWeight: "700", marginTop: 2 },
  effectsList: { gap: 8 },
  effectRow:   { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  effectDot:   { fontSize: 9, marginTop: 3 },
  effectText:  { color: "rgba(255,255,255,0.75)", fontSize: 13, flex: 1, lineHeight: 19 },
  useSkillBtn: {
    borderRadius: 8, borderWidth: 1, overflow: "hidden",
  },
  useSkillGradient: {
    paddingVertical: 14, alignItems: "center", justifyContent: "center",
  },
  useSkillText: { fontSize: 15, fontWeight: "800", letterSpacing: 2 },

  // Finale
  finaleWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center", alignItems: "center",
    paddingHorizontal: 28,
  },
  finaleCard: {
    backgroundColor: "rgba(4,10,18,0.92)",
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    paddingVertical: 28, paddingHorizontal: 24, gap: 16,
    width: "100%",
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
