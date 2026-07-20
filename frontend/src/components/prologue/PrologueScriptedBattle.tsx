/**
 * PrologueScriptedBattle
 *
 * Push 6 — "The Fall" (scripted_defeat phase)
 *
 * A self-contained playable battle that ends in scripted defeat.
 * The player has meaningful agency for 4 turns before the trap closes.
 *
 * DESIGN RULES:
 *  - Former Self is powerful and impressive. Attacks look spectacular.
 *  - Nightingale and Fleming are competent and effective.
 *  - Decoys are killable. Silent Infarction is not.
 *  - Defeat is story-driven: the Former Self's past choices are the cause.
 *  - No normal "Game Over". No "Try Again". No score.
 *  - After 4 turns the scripted finale begins automatically.
 *
 * Turn cap safety: enemy turn 4 deals lethal damage regardless of hero HP,
 * ensuring the finale always triggers and no softlock is possible.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

// ─── Art registry ─────────────────────────────────────────────────────────────

const ART = {
  battlefield:      require("../../../assets/images/tactical_battlefield.png"),
  theProdigy:       require("../../../assets/heroes/battle/the_prodigy.png"),
  nightingale:      require("../../../assets/images/nightingale_portrait.png"),
  fleming:          require("../../../assets/images/fleming_portrait.png"),
  masterBai:        require("../../../assets/images/master_bai.png"),
  bossPortrait:     require("../../../assets/images/silent_infarction_portrait.png"),
  decoyFeverShade:  require("../../../assets/enemies/fever_shade.png"),
  decoyMindFog:     require("../../../assets/enemies/mind_fog.png"),
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type BattleStage =
  | "intro"
  | "selecting_hero"
  | "selecting_action"
  | "action_result"
  | "enemy_turn"
  | "narrative_beat"
  | "finale"
  | "done";

type ActionType = "strike" | "support" | "reveal" | "risky";

interface HeroAction {
  id:         string;
  label:      string;
  type:       ActionType;
  apCost:     number;
}

interface HeroData {
  id:       string;
  name:     string;
  short:    string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  image:    any;
  color:    string;
  maxHp:    number;
  actions:  HeroAction[];
}

interface FinaleStep {
  speaker:  string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  portrait: any;
  text:     string;
  subtext?: string;
  color:    string;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const HEROES: HeroData[] = [
  {
    id: "the_prodigy",
    name: "The Prodigy",
    short: "Prodigy",
    image: ART.theProdigy,
    color: "#E8354A",
    maxHp: 100,
    actions: [
      { id: "brilliant_intervention",  label: "Brilliant Intervention",  type: "strike",  apCost: 3 },
      { id: "radiant_stabilization",   label: "Radiant Stabilization",   type: "support", apCost: 2 },
    ],
  },
  {
    id: "nightingale",
    name: "Florence Nightingale",
    short: "Nightingale",
    image: ART.nightingale,
    color: "#E8C453",
    maxHp: 90,
    actions: [
      { id: "lamp_of_observation", label: "Lamp of Observation", type: "reveal",  apCost: 2 },
      { id: "ward_vigil",          label: "Ward Vigil",          type: "support", apCost: 1 },
    ],
  },
  {
    id: "fleming",
    name: "Alexander Fleming",
    short: "Fleming",
    image: ART.fleming,
    color: "#3ECFB2",
    maxHp: 90,
    actions: [
      { id: "culture_and_sensitivity", label: "Culture & Sensitivity", type: "reveal", apCost: 2 },
      { id: "targeted_antidote",       label: "Targeted Antidote",     type: "strike", apCost: 2 },
    ],
  },
];

// Scripted enemy responses, one per player turn (index = turn - 1).
// turn 4 dmg is 999 = lethal safety net — Hidden Deterioration → Unseen Collapse.
const ENEMY_SCRIPT = [
  { target: "the_prodigy", dmg: 16, text: "Hidden Deterioration — the Silent Infarction works beneath the surface. The Prodigy holds." },
  { target: "nightingale", dmg: 12, text: "False Reassurance — a cue is hidden. Nightingale catches the backlash." },
  { target: "the_prodigy", dmg: 31, text: "Hidden Deterioration — the trap tightens. The Prodigy absorbs the blow." },
  { target: "the_prodigy", dmg: 999, text: "Unseen Collapse. The trap that was set before this battle ever began." },
] as const;

// Narrative beats triggered by specific player actions (one-shot per battle).
const NARRATIVE: Record<string, string> = {
  first_decoy_killed:         "The decoy dissolves. But the true source was never there.",
  lamp_used:                  "The field opens. Three civilians in critical deterioration. Two exits blocked.\n\nThe trap was always here.",
  rally_used:                 "Stabilization holds. The team breathes.\n\nBut the root cause is still spreading beneath the surface.",
  culture_used:               "Analysis complete.\n\nTargeted intervention only. Broad approaches cause adaptation.",
  brilliant_intervention_warn: "The Prodigy: \"I know this. I can handle it.\"\n\nBut something hidden is still spreading.",
  broad_warning:              "⚠  Broad treatment applied. The Silent Infarction adapts.\n\nTargeted therapy is the only path forward.",
};

const FINALE_STEPS: FinaleStep[] = [
  {
    speaker: null,
    portrait: null,
    text: "THE TRAP CLOSES.",
    subtext: "Not because The Prodigy was weak. Because they rushed before they looked.",
    color: "#FF3333",
  },
  {
    speaker: "FLORENCE NIGHTINGALE",
    portrait: ART.nightingale,
    text: "We have to retreat. The damage is done.\n\nThe trap was always closing.",
    color: "#E8C453",
  },
  {
    speaker: "ALEXANDER FLEMING",
    portrait: ART.fleming,
    text: "The overconfidence was the trap.\n\nThe choices came before this battle.",
    color: "#3ECFB2",
  },
  {
    speaker: "MASTER BAI",
    portrait: ART.masterBai,
    text: "You were brilliant. That was never in question.\n\nBut brilliance that skips the assessment is the most dangerous kind.",
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

// ─── Sub-components ───────────────────────────────────────────────────────────

interface DecoyCardProps {
  name:    string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  image:   any;
  hp:      number;
  maxHp:   number;
  color:   string;
}

function DecoyCard({ name, image, hp, maxHp, color }: DecoyCardProps) {
  const dead = hp <= 0;
  const pct  = Math.max(0, hp / maxHp) * 100;
  return (
    <View style={[dcStyles.card, dead && dcStyles.cardDead]}>
      <ExpoImage
        source={image}
        style={[dcStyles.portrait, dead && { opacity: 0.2 }]}
        contentFit="contain"
      />
      <Text style={[dcStyles.name, { color: dead ? "#555" : color }]} numberOfLines={1}>
        {dead ? "DEFEATED" : name}
      </Text>
      {!dead && (
        <View style={dcStyles.hpBar}>
          <View style={[dcStyles.hpFill, { width: `${pct}%` as any, backgroundColor: color }]} />
        </View>
      )}
    </View>
  );
}

const dcStyles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: "rgba(4,10,18,0.60)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 4,
  },
  cardDead: { opacity: 0.55 },
  portrait: { width: 56, height: 72 },
  name: { fontSize: 9, fontWeight: "700", letterSpacing: 1, textAlign: "center" },
  hpBar: {
    width: "90%",
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  hpFill: { height: "100%", borderRadius: 2 },
});

// ── Boss card ──────────────────────────────────────────────────────────────────

interface BossCardProps {
  revealed: number;  // 0..1
  glowAnim: Animated.Value;
}

function BossCard({ revealed, glowAnim }: BossCardProps) {
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.55] });
  const concealOpacity = Math.max(0, 1 - revealed);

  return (
    <View style={bcStyles.card}>
      <View style={bcStyles.portraitWrap}>
        <ExpoImage source={ART.bossPortrait} style={bcStyles.portrait} contentFit="contain" />
        {/* Concealment dark overlay — fades as boss is revealed */}
        <View
          style={[bcStyles.concealment, { opacity: concealOpacity }]}
          pointerEvents="none"
        />
        {/* Ambient red glow ring */}
        <Animated.View
          style={[bcStyles.glow, { opacity: glowOpacity }]}
          pointerEvents="none"
        />
      </View>
      <Text style={bcStyles.name}>SILENT INFARCTION</Text>
      <Text style={bcStyles.hp}>??? / ???</Text>
      {revealed >= 0.4 && (
        <Text style={bcStyles.hint} numberOfLines={1}>
          {revealed >= 0.8 ? "⚠  True source visible" : "◉  Partially revealed"}
        </Text>
      )}
    </View>
  );
}

const bcStyles = StyleSheet.create({
  card: {
    flex: 1.25,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: "rgba(20,4,4,0.72)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(200,20,20,0.25)",
    gap: 4,
  },
  portraitWrap: { position: "relative", width: 68, height: 82 },
  portrait: { width: 68, height: 82 },
  concealment: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#050505",
    borderRadius: 6,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#600000",
    borderRadius: 10,
  },
  name: { color: "#CC3333", fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  hp:   { color: "rgba(200,100,100,0.55)", fontSize: 10, fontWeight: "300" },
  hint: { color: "#E8C453", fontSize: 8, letterSpacing: 0.5 },
});

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function PrologueScriptedBattle({ onComplete }: Props) {
  // ── Stage ──────────────────────────────────────────────────────────────────
  const stageRef = useRef<BattleStage>("intro");
  const [stage,   setStage]   = useState<BattleStage>("intro");

  // ── Turn ───────────────────────────────────────────────────────────────────
  const turnRef = useRef(1);
  const [turn,  setTurn]   = useState(1);

  // ── Action Points (legendary prologue budget) ──────────────────────────────
  // Starts at PROLOGUE_AP_CONFIG.startingAP; regenerates apPerTurn each new turn.
  const playerAPRef = useRef<number>(PROLOGUE_AP_CONFIG.startingAP);
  const [playerAP,  setPlayerAP]  = useState<number>(PROLOGUE_AP_CONFIG.startingAP);

  // ── Hero HPs (ref for closure safety, state for rendering) ─────────────────
  const heroHPsRef = useRef<Record<string, number>>({ the_prodigy: 100, nightingale: 90, fleming: 90 });
  const [heroHPs,  setHeroHPs]  = useState({ ...heroHPsRef.current });

  // ── Decoy HPs ──────────────────────────────────────────────────────────────
  const decoyHPsRef = useRef<Record<string, number>>({ fever_shade: 55, mind_fog: 55 });
  const [decoyHPs, setDecoyHPs] = useState({ ...decoyHPsRef.current });

  // ── Boss reveal (0..1) ─────────────────────────────────────────────────────
  const bossRevRef = useRef(0);
  const [bossRevealed, setBossRevealed] = useState(0);

  // ── Selection ──────────────────────────────────────────────────────────────
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  const selectedHeroIdRef = useRef<string | null>(null);

  // ── Battle log (last 2 lines) ──────────────────────────────────────────────
  const [log, setLog] = useState<string[]>([]);

  // ── Overlay text (action result + enemy turn) ──────────────────────────────
  const [overlayText,  setOverlayText]  = useState("");
  const [overlayColor, setOverlayColor] = useState("#FFFFFF");

  // ── Narrative beat ─────────────────────────────────────────────────────────
  const [narrativeText, setNarrativeText] = useState("");

  // ── Finale ─────────────────────────────────────────────────────────────────
  const finaleStepRef = useRef(0);
  const [finaleStep, setFinaleStep] = useState(0);

  // ── One-shot narrative guards ──────────────────────────────────────────────
  const beatsShownRef = useRef<Set<string>>(new Set());

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  const mountedRef = useRef(true);
  const timers     = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // ─── Animations ──────────────────────────────────────────────────────────────

  const bgFade       = useRef(new Animated.Value(0)).current;
  const introFade    = useRef(new Animated.Value(0)).current;
  const overlayFade  = useRef(new Animated.Value(0)).current;
  const narrativeFade = useRef(new Animated.Value(0)).current;
  const finaleFade   = useRef(new Animated.Value(0)).current;
  const doomFade     = useRef(new Animated.Value(0)).current; // progressive battlefield darkening
  const flashFade    = useRef(new Animated.Value(0)).current;
  const bossGlow     = useRef(new Animated.Value(0)).current;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function after(ms: number, fn: () => void) {
    const t = setTimeout(() => { if (mountedRef.current) fn(); }, ms);
    timers.current.push(t);
  }

  function anim(v: Animated.Value, to: number, dur: number, cb?: () => void) {
    Animated.timing(v, { toValue: to, duration: dur, useNativeDriver: false }).start(
      cb ?? (() => {}),
    );
  }

  function toStage(s: BattleStage) {
    stageRef.current = s;
    setStage(s);
  }

  function applyHeroHP(changes: Partial<Record<string, number>>) {
    heroHPsRef.current = { ...heroHPsRef.current, ...changes } as Record<string, number>;
    setHeroHPs({ ...heroHPsRef.current });
  }

  function applyDecoyHP(changes: Partial<Record<string, number>>) {
    decoyHPsRef.current = { ...decoyHPsRef.current, ...changes } as Record<string, number>;
    setDecoyHPs({ ...decoyHPsRef.current });
  }

  function applyBossReveal(delta: number) {
    const next = Math.min(1, Math.max(0, bossRevRef.current + delta));
    bossRevRef.current = next;
    setBossRevealed(next);
  }

  function pushLog(line: string) {
    setLog(prev => [line, ...prev].slice(0, 2));
  }

  function flashScreen(color: string) {
    Animated.sequence([
      Animated.timing(flashFade, { toValue: 0.38, duration: 160, useNativeDriver: false }),
      Animated.timing(flashFade, { toValue: 0,    duration: 500, useNativeDriver: false }),
    ]).start();
  }

  // ── Startup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    anim(bgFade, 1, 900);
    after(700, () => anim(introFade, 1, 600));

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(bossGlow, { toValue: 1, duration: 2100, useNativeDriver: false }),
        Animated.timing(bossGlow, { toValue: 0, duration: 2100, useNativeDriver: false }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Action resolution ─────────────────────────────────────────────────────

  const resolveAction = useCallback((heroId: string, actionId: string) => {
    const dHPs  = decoyHPsRef.current;
    const hHPs  = heroHPsRef.current;
    const beats = beatsShownRef.current;

    let resultText   = "";
    let resultColor  = "#FFFFFF";
    let logLine      = "";
    let hpChanges: Partial<Record<string,number>>    = {};
    let decoyChanges: Partial<Record<string,number>> = {};
    let bossRevDelta = 0;
    let beatKey: string | null = null;

    switch (actionId) {
      case "brilliant_intervention": {
        const d1 = dHPs["fever_shade"] ?? 0;
        const d2 = dHPs["mind_fog"]    ?? 0;
        // Brilliant Intervention vs Silent Infarction shows reduced effect — story beat
        const bossRevealedFraction = bossRevRef.current;
        const dmg = bossRevealedFraction < 0.3
          ? 28 + Math.floor(Math.random() * 8)   // hidden cues: reduced effectiveness
          : 38 + Math.floor(Math.random() * 10);  // revealed: full power

        if (d1 > 0) {
          const next = Math.max(0, d1 - dmg);
          decoyChanges = { fever_shade: next };
          const killed = next <= 0;
          resultText  = killed ? "FEVER SHADE DEFEATED" : `BRILLIANT INTERVENTION\n-${dmg} CORRUPTION`;
          resultColor = killed ? "#FF8C00" : "#E8354A";
          logLine     = killed
            ? "Brilliant Intervention — the Fever Shade dissolves."
            : `Brilliant Intervention lowered Corruption by ${dmg}.`;
          if (killed && !beats.has("first_decoy_killed")) beatKey = "first_decoy_killed";
        } else if (d2 > 0) {
          const next = Math.max(0, d2 - dmg);
          decoyChanges = { mind_fog: next };
          const killed = next <= 0;
          resultText  = killed ? "MIND FOG DEFEATED" : `BRILLIANT INTERVENTION\n-${dmg} CORRUPTION`;
          resultColor = killed ? "#FF8C00" : "#E8354A";
          logLine     = killed
            ? "Brilliant Intervention cuts through the Mind Fog."
            : `Brilliant Intervention lowered Corruption by ${dmg}.`;
        } else {
          // Both decoys dead — Brilliant Intervention shows reduced effect against the boss
          bossRevDelta = bossRevealedFraction < 0.3 ? 0.08 : 0.14;
          resultText  = bossRevealedFraction < 0.3
            ? "REDUCED EFFECT\nSomething hidden remains"
            : "THE DARKNESS\nPartially Resists";
          resultColor = bossRevealedFraction < 0.3 ? "#FF6B35" : "#886655";
          logLine     = bossRevealedFraction < 0.3
            ? "Brilliant Intervention was powerful — but something hidden continued to spread."
            : "The Prodigy's intervention lands. The Silent Infarction barely yields.";
          if (!beats.has("brilliant_intervention_warn") && bossRevealedFraction < 0.3) {
            beatKey = "brilliant_intervention_warn";
          }
        }
        break;
      }

      case "radiant_stabilization": {
        const nHP = Math.min(90, (hHPs["nightingale"] ?? 90) + 10);
        const fHP = Math.min(90, (hHPs["fleming"]    ?? 90) + 10);
        const pHP = Math.min(100, (hHPs["the_prodigy"] ?? 100) + 12);
        hpChanges   = { the_prodigy: pHP, nightingale: nHP, fleming: fHP };
        resultText  = "RADIANT STABILIZATION\n+8 STABILITY";
        resultColor = "#E8354A";
        logLine     = "Radiant Stabilization. The Prodigy holds the team together.";
        if (!beats.has("rally_used")) beatKey = "rally_used";
        break;
      }

      case "lamp_of_observation": {
        const pHP   = Math.min(100, (hHPs["the_prodigy"] ?? 100) + 10);
        hpChanges   = { the_prodigy: pHP };
        bossRevDelta = 0.24;
        resultText  = "FIELD REVEALED";
        resultColor = "#E8C453";
        logLine     = "Nightingale's lamp thins the concealment. Three civilians stabilized.";
        if (!beats.has("lamp_used")) beatKey = "lamp_used";
        break;
      }

      case "ward_vigil": {
        const pHP   = Math.min(100, (hHPs["the_prodigy"] ?? 100) + 18);
        const fHP   = Math.min(90,  (hHPs["fleming"]     ?? 90)  + 10);
        hpChanges   = { the_prodigy: pHP, fleming: fHP };
        resultText  = "WARD VIGIL\n+18 STABILITY";
        resultColor = "#E8C453";
        logLine     = "Ward Vigil: Nightingale steadies the ward. Stability restored across the team.";
        break;
      }

      case "culture_and_sensitivity": {
        bossRevDelta = 0.30;
        resultText  = "WEAKNESS IDENTIFIED\nTargeted Intervention";
        resultColor = "#3ECFB2";
        logLine     = "Culture & Sensitivity: Fleming marks the pathway. Targeted intervention confirmed.";
        if (!beats.has("culture_used")) beatKey = "culture_used";
        break;
      }

      case "targeted_antidote": {
        const d1 = dHPs["fever_shade"] ?? 0;
        const d2 = dHPs["mind_fog"]    ?? 0;
        const dmg = 22;
        if (d1 > 0) {
          decoyChanges = { fever_shade: Math.max(0, d1 - dmg) };
          resultText   = `TARGETED ANTIDOTE\n-${dmg} TARGETED`;
        } else if (d2 > 0) {
          decoyChanges = { mind_fog: Math.max(0, d2 - dmg) };
          resultText   = `TARGETED ANTIDOTE\n-${dmg} TARGETED`;
        } else {
          bossRevDelta = 0.18;
          resultText   = "TARGETED ANTIDOTE\nEnemy Weakened";
        }
        resultColor = "#3ECFB2";
        logLine     = "Targeted Antidote: Fleming deploys a precise counter. No collateral effect.";
        break;
      }

      default:
        resultText = "ACTION TAKEN";
        logLine    = "The team takes action.";
    }

    return { resultText, resultColor, logLine, hpChanges, decoyChanges, bossRevDelta, beatKey };
  }, []);

  // ── Enemy turn (scripted, called after each player action) ────────────────

  const runEnemyTurn = useCallback(() => {
    const t      = turnRef.current;
    const script = ENEMY_SCRIPT[t - 1];
    if (!script) { startFinale(); return; }

    const currentHP = heroHPsRef.current[script.target] ?? 0;
    const isLethal  = script.dmg >= 999;
    const newHP     = isLethal ? 0 : Math.max(0, currentHP - script.dmg);
    applyHeroHP({ [script.target]: newHP });

    setOverlayText(script.text);
    setOverlayColor("#CC1111");
    toStage("enemy_turn");
    anim(overlayFade, 1, 300);
    flashScreen("#CC1111");

    // Battlefield darkens progressively from turn 3
    if (t >= 3) anim(doomFade, Math.min(0.65, (t - 2) * 0.22), 1200);

    after(2100, () => {
      anim(overlayFade, 0, 300, () => {
        if (isLethal || t >= 4) {
          startFinale();
        } else {
          turnRef.current = t + 1;
          setTurn(t + 1);
          // Regenerate AP at turn start (PROLOGUE_AP_CONFIG.apPerTurn per turn, capped at startingAP)
          const nextAP = Math.min(
            PROLOGUE_AP_CONFIG.startingAP,
            playerAPRef.current + PROLOGUE_AP_CONFIG.apPerTurn,
          );
          playerAPRef.current = nextAP;
          setPlayerAP(nextAP);
          selectedHeroIdRef.current = null;
          setSelectedHeroId(null);
          toStage("selecting_hero");
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Finale sequence (auto-advancing — full dialogue lives in lotus_recall_cinematic) ──

  const startFinale = useCallback(() => {
    toStage("finale");
    anim(doomFade, 0.88, 1800);
    after(900, () => anim(finaleFade, 1, 700));
    // Hold "THE TRAP CLOSES." for 3.8 s then fade to black → onComplete
    after(4700, () => {
      anim(finaleFade, 0, 700, () => {
        anim(doomFade, 1, 1600, () => {
          after(400, () => {
            toStage("done");
            onComplete();
          });
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete]);

  // ── Player action handler ─────────────────────────────────────────────────

  const handleAction = useCallback((heroId: string, actionId: string, apCost: number) => {
    if (stageRef.current !== "selecting_action") return;
    // Gate: insufficient AP
    if (playerAPRef.current < apCost) return;

    // Consume AP (synchronous ref write + state update)
    const newAP = playerAPRef.current - apCost;
    playerAPRef.current = newAP;
    setPlayerAP(newAP);

    const result = resolveAction(heroId, actionId);

    if (Object.keys(result.hpChanges).length)    applyHeroHP(result.hpChanges);
    if (Object.keys(result.decoyChanges).length) applyDecoyHP(result.decoyChanges);
    if (result.bossRevDelta !== 0)               applyBossReveal(result.bossRevDelta);
    pushLog(result.logLine);
    if (result.beatKey) beatsShownRef.current.add(result.beatKey);

    flashScreen(result.resultColor);
    setOverlayText(result.resultText);
    setOverlayColor(result.resultColor);
    toStage("action_result");
    anim(overlayFade, 1, 300);

    after(1700, () => {
      anim(overlayFade, 0, 280, () => {
        if (result.beatKey && NARRATIVE[result.beatKey]) {
          setNarrativeText(NARRATIVE[result.beatKey]);
          toStage("narrative_beat");
          anim(narrativeFade, 1, 400);
        } else {
          runEnemyTurn();
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveAction, runEnemyTurn]);

  // ── Narrative beat continue ───────────────────────────────────────────────

  const handleNarrativeContinue = useCallback(() => {
    if (stageRef.current !== "narrative_beat") return;
    anim(narrativeFade, 0, 300, () => runEnemyTurn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runEnemyTurn]);

  // ── Hero/action selection ─────────────────────────────────────────────────

  const handleSelectHero = useCallback((id: string) => {
    if (stageRef.current !== "selecting_hero") return;
    if ((heroHPsRef.current[id] ?? 0) <= 0) return;
    selectedHeroIdRef.current = id;
    setSelectedHeroId(id);
    toStage("selecting_action");
  }, []);

  const handleCancelAction = useCallback(() => {
    if (stageRef.current !== "selecting_action") return;
    selectedHeroIdRef.current = null;
    setSelectedHeroId(null);
    toStage("selecting_hero");
  }, []);

  const handleStartBattle = useCallback(() => {
    anim(introFade, 0, 500, () => toStage("selecting_hero"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────

  const selectedHero = useMemo(
    () => HEROES.find(h => h.id === selectedHeroId) ?? null,
    [selectedHeroId],
  );

  const currentFinale = FINALE_STEPS[finaleStep] ?? FINALE_STEPS[0];

  const showBattleUI = !["intro", "finale", "done"].includes(stage);
  const isInteractive = stage === "selecting_hero" || stage === "selecting_action";

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* BACKGROUND */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgFade }]}>
        <ExpoImage source={ART.battlefield} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>

      {/* PROGRESSIVE DOOM OVERLAY */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: doomFade }]}
        pointerEvents="none"
      />

      {/* HIT FLASH */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "#CC0000", opacity: flashFade }]}
        pointerEvents="none"
      />

      {/* BOTTOM GRADIENT */}
      <LinearGradient
        colors={["transparent", "rgba(4,10,18,0.50)", "rgba(4,10,18,0.96)"]}
        locations={[0, 0.30, 0.70]}
        style={styles.bottomGrad}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} pointerEvents="box-none">

        {/* ── OBJECTIVE BAR ── */}
        {showBattleUI && (
          <View style={styles.topBar}>
            <Text style={styles.objectiveTitle}>OBJECTIVE</Text>
            <Text style={styles.objectiveText}>
              Learn the field.  Save who you can.  Survive the trap.
            </Text>
            <View style={styles.turnRow}>
              {[1, 2, 3, 4].map(t => (
                <View
                  key={t}
                  style={[
                    styles.turnDot,
                    turn === t && styles.turnDotActive,
                    turn > t  && styles.turnDotDone,
                  ]}
                />
              ))}
              <Text style={styles.turnLabel}>
                TURN {Math.min(turn, 4)} / 4  ·  AP {playerAP} / {PROLOGUE_AP_CONFIG.startingAP}
              </Text>
            </View>
          </View>
        )}

        {/* ── ENEMY AREA ── */}
        {showBattleUI && (
          <View style={styles.enemyRow}>
            <DecoyCard
              name="Fever Shade"
              image={ART.decoyFeverShade}
              hp={decoyHPs["fever_shade"] ?? 55}
              maxHp={55}
              color="#FF6B35"
            />
            <View style={styles.enemyGap} />
            <DecoyCard
              name="Mind Fog"
              image={ART.decoyMindFog}
              hp={decoyHPs["mind_fog"] ?? 55}
              maxHp={55}
              color="#9B7FD4"
            />
            <View style={styles.enemyGap} />
            <BossCard revealed={bossRevealed} glowAnim={bossGlow} />
          </View>
        )}

        {/* ── BATTLE LOG ── */}
        {showBattleUI && log.length > 0 && (
          <View style={styles.logArea}>
            {log.map((line, i) => (
              <Text
                key={`${i}-${line}`}
                style={[styles.logLine, i > 0 && styles.logLineOld]}
                numberOfLines={1}
              >
                {line}
              </Text>
            ))}
          </View>
        )}

        <View style={{ flex: 1 }} pointerEvents="none" />

        {/* ── HERO ROW ── */}
        {isInteractive && (
          <View style={styles.heroRow}>
            {HEROES.map(hero => {
              const hp       = heroHPs[hero.id] ?? hero.maxHp;
              const isDown   = hp <= 0;
              const isActive = selectedHeroId === hero.id && stage === "selecting_action";
              const hpPct    = (Math.max(0, hp) / hero.maxHp) * 100;

              return (
                <Pressable
                  key={hero.id}
                  style={[
                    styles.heroCard,
                    isDown   && styles.heroCardDown,
                    isActive && { borderColor: hero.color, borderWidth: 2, backgroundColor: `${hero.color}14` },
                  ]}
                  onPress={() => {
                    if (isDown) return;
                    if (isActive) { handleCancelAction(); }
                    else          { handleSelectHero(hero.id); }
                  }}
                >
                  <ExpoImage
                    source={hero.image}
                    style={[styles.heroPortrait, isDown && { opacity: 0.35 }]}
                    contentFit="cover"
                  />
                  <Text style={[styles.heroName, { color: isDown ? "#555" : hero.color }]} numberOfLines={1}>
                    {isDown ? "FALLEN" : hero.short}
                  </Text>
                  <View style={styles.heroHpBar}>
                    <View
                      style={[
                        styles.heroHpFill,
                        { width: `${hpPct}%` as any, backgroundColor: hero.color },
                      ]}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── ACTION PANEL ── */}
        {stage === "selecting_action" && selectedHero && (
          <View style={[styles.actionPanel, { borderColor: `${selectedHero.color}35` }]}>
            <Text style={[styles.actionPanelHero, { color: selectedHero.color }]}>
              {selectedHero.short}
            </Text>
            <View style={styles.actionBtnRow}>
              {selectedHero.actions.map(action => {
                const isRisky    = action.type === "risky";
                const canAfford  = playerAP >= action.apCost;
                const dimmed     = !canAfford;
                return (
                  <Pressable
                    key={action.id}
                    style={[
                      styles.actionBtn,
                      isRisky
                        ? styles.actionBtnRisky
                        : { borderColor: `${selectedHero.color}55` },
                      dimmed && { opacity: 0.38 },
                    ]}
                    onPress={() => handleAction(selectedHero.id, action.id, action.apCost)}
                  >
                    <Text style={[
                      styles.actionBtnLabel,
                      { color: isRisky ? "#FF6B35" : selectedHero.color },
                    ]}>
                      {action.label}
                    </Text>
                    <Text style={[styles.actionBtnCost, dimmed && { color: "#FF4444" }]}>
                      {action.apCost} AP
                    </Text>
                    {isRisky && (
                      <Text style={styles.actionBtnRiskyNote}>⚠  use carefully</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={handleCancelAction} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>← BACK</Text>
            </Pressable>
          </View>
        )}

        {/* ── ACTION RESULT / ENEMY TURN OVERLAY ── */}
        {(stage === "action_result" || stage === "enemy_turn") && (
          <Animated.View
            style={[styles.resultOverlay, { opacity: overlayFade }]}
            pointerEvents="none"
          >
            <Text style={[styles.resultText, { color: overlayColor }]}>{overlayText}</Text>
          </Animated.View>
        )}

        {/* ── NARRATIVE BEAT ── */}
        {stage === "narrative_beat" && (
          <Animated.View style={[styles.narrativePanel, { opacity: narrativeFade }]}>
            <Text style={styles.narrativeText}>{narrativeText}</Text>
            <Pressable style={styles.narrativeContinue} onPress={handleNarrativeContinue}>
              <Text style={styles.narrativeContinueText}>CONTINUE  ▶</Text>
            </Pressable>
          </Animated.View>
        )}

      </SafeAreaView>

      {/* ── INTRO OVERLAY (full-screen, rendered outside SafeAreaView) ── */}
      {stage === "intro" && (
        <Animated.View style={[styles.introOverlay, { opacity: introFade }]}>
          <LinearGradient
            colors={["rgba(4,10,18,0.85)", "rgba(4,10,18,0.97)"]}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView style={styles.introSafe}>
            <View style={styles.introContent}>
              <Text style={styles.introPhaseLabel}>THE FALL</Text>
              <Text style={styles.introTitle}>Emergency Treatment Plaza</Text>
              <View style={styles.introDivider} />
              <Text style={styles.introObjective}>
                {`Learn the field.\nSave who you can.\nSurvive the trap.`}
              </Text>
              <View style={styles.introHints}>
                <Text style={styles.introHintLine}>
                  ◆  Decoy enemies can be defeated
                </Text>
                <Text style={styles.introHintLine}>
                  ◆  The true source cannot be beaten. Only revealed.
                </Text>
                <Text style={styles.introHintLine}>
                  ◆  This battle has no victory condition
                </Text>
              </View>
              <Pressable style={styles.introBtn} onPress={handleStartBattle}>
                <LinearGradient
                  colors={["#7B2020", "#B22222", "#7B2020"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.introBtnGrad}
                >
                  <Text style={styles.introBtnText}>BEGIN</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </SafeAreaView>
        </Animated.View>
      )}

      {/* ── FINALE OVERLAY (full-screen, auto-advancing — no tap required) ── */}
      {stage === "finale" && (
        <Animated.View
          style={[styles.finaleOverlay, { opacity: finaleFade }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={["rgba(6,2,2,0.93)", "rgba(4,10,18,0.98)"]}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView style={styles.finaleSafe} pointerEvents="none">
            <View style={styles.finaleContent}>
              <Text style={[styles.finaleText, styles.finaleTextDrama, { color: "#FF3333" }]}>
                THE TRAP CLOSES.
              </Text>
              <Text style={styles.finaleSubtext}>
                The power was real. The overconfidence was the trap. It was always here.
              </Text>
            </View>
          </SafeAreaView>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#040A12",
  },

  bottomGrad: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: "58%",
  },

  safe: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },

  // ── Objective bar ──────────────────────────────────────────────────────────
  topBar: {
    paddingTop: 14,
    gap: 4,
  },
  objectiveTitle: {
    color: "rgba(180,100,100,0.55)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 3,
  },
  objectiveText: {
    color: "rgba(200,220,240,0.75)",
    fontSize: 12,
    letterSpacing: 0.3,
  },
  turnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  turnDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  turnDotActive: { backgroundColor: "#E8354A" },
  turnDotDone:   { backgroundColor: "rgba(255,255,255,0.45)" },
  turnLabel: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginLeft: 4,
  },

  // ── Enemy row ──────────────────────────────────────────────────────────────
  enemyRow: {
    flexDirection: "row",
    marginTop: 14,
    height: 160,
  },
  enemyGap: { width: 6 },

  // ── Log ────────────────────────────────────────────────────────────────────
  logArea: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(4,10,18,0.70)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 2,
  },
  logLine: {
    color: "rgba(200,220,240,0.80)",
    fontSize: 11,
    lineHeight: 16,
  },
  logLineOld: { color: "rgba(160,180,200,0.40)" },

  // ── Hero row ───────────────────────────────────────────────────────────────
  heroRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  heroCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: "rgba(4,10,18,0.80)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 4,
  },
  heroCardDown: { opacity: 0.55 },
  heroPortrait: {
    width: 52, height: 52, borderRadius: 26,
  },
  heroName: {
    fontSize: 9, fontWeight: "700", letterSpacing: 0.8, textAlign: "center",
  },
  heroHpBar: {
    width: "80%", height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  heroHpFill: { height: "100%", borderRadius: 2 },

  // ── Action panel ───────────────────────────────────────────────────────────
  actionPanel: {
    backgroundColor: "rgba(4,10,18,0.94)",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    marginBottom: 4,
  },
  actionPanelHero: {
    fontSize: 10, fontWeight: "800", letterSpacing: 2,
  },
  actionBtnRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    gap: 2,
  },
  actionBtnRisky: {
    borderColor: "rgba(255,107,53,0.45)",
    backgroundColor: "rgba(255,107,53,0.06)",
  },
  actionBtnLabel: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  actionBtnCost: { fontSize: 10, color: "rgba(255,255,255,0.45)", textAlign: "center", marginTop: 2 },
  actionBtnRiskyNote: {
    color: "rgba(255,107,53,0.60)",
    fontSize: 9,
    letterSpacing: 0.5,
  },
  cancelBtn: {
    alignSelf: "flex-start",
    paddingVertical: 2,
  },
  cancelText: {
    color: "rgba(200,220,240,0.35)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },

  // ── Result / enemy turn overlay ────────────────────────────────────────────
  resultOverlay: {
    position: "absolute",
    left: 0, right: 0,
    bottom: "28%",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  resultText: {
    fontSize: 22, fontWeight: "800", textAlign: "center",
    letterSpacing: 1.5, lineHeight: 32,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  // ── Narrative beat ─────────────────────────────────────────────────────────
  narrativePanel: {
    backgroundColor: "rgba(4,10,18,0.94)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
    gap: 12,
    marginBottom: 8,
  },
  narrativeText: {
    color: "rgba(220,235,255,0.88)",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "300",
    fontStyle: "italic",
  },
  narrativeContinue: { alignSelf: "flex-end" },
  narrativeContinueText: {
    color: "rgba(200,220,240,0.45)",
    fontSize: 11, fontWeight: "800", letterSpacing: 1.5,
  },

  // ── Intro overlay ──────────────────────────────────────────────────────────
  introOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  introSafe: {
    flex: 1,
    justifyContent: "center",
  },
  introContent: {
    paddingHorizontal: 28,
    gap: 14,
  },
  introPhaseLabel: {
    color: "rgba(200,60,60,0.70)",
    fontSize: 10, fontWeight: "800", letterSpacing: 4,
    textAlign: "center",
  },
  introTitle: {
    color: "rgba(200,220,240,0.60)",
    fontSize: 13, fontWeight: "300", letterSpacing: 0.5,
    textAlign: "center",
  },
  introDivider: {
    height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 4,
  },
  introObjective: {
    color: "#EDF2F7",
    fontSize: 22, fontWeight: "300", lineHeight: 36,
    textAlign: "center", letterSpacing: 0.3,
  },
  introHints: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  introHintLine: {
    color: "rgba(180,200,220,0.55)",
    fontSize: 12, lineHeight: 18,
  },
  introBtn: {
    borderRadius: 10, overflow: "hidden", marginTop: 6,
  },
  introBtnGrad: {
    paddingVertical: 16, alignItems: "center",
  },
  introBtnText: {
    color: "#FFFFFF", fontSize: 14, fontWeight: "800", letterSpacing: 4,
  },

  // ── Finale overlay ─────────────────────────────────────────────────────────
  finaleOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  finaleSafe: {
    flex: 1,
    justifyContent: "center",
  },
  finaleContent: {
    paddingHorizontal: 28,
    alignItems: "center",
    gap: 16,
  },
  finalePortrait: {
    width: 64, height: 64, borderRadius: 32, marginBottom: 4,
  },
  finaleSpeaker: {
    fontSize: 9, fontWeight: "800", letterSpacing: 3,
  },
  finaleText: {
    fontSize: 18, fontWeight: "300", lineHeight: 30,
    textAlign: "center", letterSpacing: 0.3,
  },
  finaleTextDrama: {
    fontSize: 28, fontWeight: "800", letterSpacing: 4, lineHeight: 40,
  },
  finaleSubtext: {
    color: "rgba(200,220,240,0.38)",
    fontSize: 12, letterSpacing: 0.5, textAlign: "center",
  },
  finaleTapHint: {
    color: "rgba(200,220,240,0.22)",
    fontSize: 11, letterSpacing: 1, marginTop: 8,
  },
});
