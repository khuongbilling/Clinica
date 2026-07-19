import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { BOSS_LORD_IMBALANCE, BOSS_SILENT_INFARCT, ENEMIES, HEROES, getWaveAdditionalEnemies } from "@/src/game/content";
import { getEnemyHint } from "@/src/game/onboarding";
import { getMission, getGuidedFeedback } from "@/src/game/missions";
import { getExplanationLayer, getObjectiveStrip, MISSION_BRIEFINGS, COUNTER_FEEDBACK, getContextualScoutFeedback, getContextualStabilizeFeedback, getContextualReassessFeedback } from "@/src/game/explanationLayers";
import { getDifficultyModifier, OBJECTIVE_BY_DIFFICULTY, type DifficultyLevel } from "@/src/game/difficulty";
import { applyCall, applyCareAttempt, applySkill, applyTempAction, careAttemptDamage, endPlayerTurn, getEnemySignatureAttack, initBattle, isUltimateReady, selectHero, useItem as applyItem, previewSkillStatus, previewItemStatus, previewTempStatus, previewCallStatus, applyCard, applyUltimate, answerClinicalCue, skillSupportsCastTiming, type BattleState, type CastQuality } from "@/src/game/battle";
import { CALL_OPTIONS, ITEMS, TEMP_ACTIONS, Item } from "@/src/game/items";
import { aggregateUpgradeEffects, findSkin } from "@/src/game/shop";
import { getCard, CHAIN_TYPE_CONFIG } from "@/src/game/cards";
import { computeStars, ENEMY_CLINICAL, getStartingHandicap, getStarRules, statusColor, statusLabel, ULTIMATE_BY_ROLE, CUE_TIER_LABELS, CUE_TIER_NUMBER, CUE_TOPIC_LABELS, type ActionStatus, type LearningProfile, type ChainRole } from "@/src/game/clinical";
import { computePlayerXpReward, getClassBattleBonuses, splitContributionToHeroXp } from "@/src/game/progression";
import { getBattleBaseXp, starXpMultiplier, starMultiplierLabel, LOSS_LEARNING_XP } from "@/src/game/battleXp";
import { completeObjective, markObjectiveXpGranted } from "@/src/game/objectiveProgress";
import { computeEpidemicTokens } from "@/src/game/worldEvent";
import { useTestSession } from "@/src/game/testSession";
import { TipBubble, useTipsQueue } from "@/src/components/BattleTips";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { useBlockBack } from "@/src/hooks/useBlockBack";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { BattlefieldScene, type BattleFx, type EnemyAttackKind } from "@/src/components/BattlefieldScene";
import { SystemPanel } from "@/src/components/onboarding/SystemPanel";
import { ROUTES } from "@/src/game/routes";
import { SceneTransition } from "@/src/components/onboarding/SceneTransition";
import type { ActionType, ClassFamily, Hero, HeroSkill } from "@/src/game/types";
import { applyStarToHero, getProgress } from "@/src/game/evolution";
import { applySkillUpgradesToTeam } from "@/src/game/heroSkillAcademy";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

type Tab = "actions" | "items" | "cards" | "call" | "team";

type DetailEntry =
  | { kind: "skill"; hero: Hero; skill: HeroSkill }
  | { kind: "temp"; actionId: string }
  | { kind: "item"; item: Item }
  | { kind: "call"; option: typeof CALL_OPTIONS[number] };

export default function Battle() {
  const { enemyId, training, prologue, replay } = useLocalSearchParams<{ enemyId: string; training?: string; prologue?: string; replay?: string }>();
  const { player, loading } = usePlayer();
  if (loading || !player) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface }}>
        <Text style={{ color: COLORS.onSurfaceTertiary }}>Loading…</Text>
      </View>
    );
  }
  return <BattleInner enemyId={enemyId} training={training} prologue={prologue} replay={replay} />;
}

function BattleInner({ enemyId, training, prologue, replay }: { enemyId?: string; training?: string; prologue?: string; replay?: string }) {
  const router = useRouter();
  const { player, applyRewards, recordFailure, recordCueTopics, updateBattleStars, markCardTutorialSeen, markCallTutorialSeen } = usePlayer();
  const { isCompleted, startTutorial, replayTutorial, onRequiredAction, advanceStep, currentStep, activeTutorialId, guidedReserve } = useTutorial();
  const isFirstBattleGuided = activeTutorialId === "firstBattle";
  const isFirstBattleActionStep =
    isFirstBattleGuided &&
    !!(currentStep?.requireAction) &&
    !!currentStep?.requiredActionType &&
    !["cue", "endTurn"].includes(currentStep.requiredActionType as string);
  const { logEvent, updateBattleSummary } = useTestSession();
  const { width: screenW } = useWindowDimensions();
  const isTraining = training === "1";
  // Push 1 prologue: "tutorial" is the guided, reliably-winnable Ward Shift
  // fight; "boss" is the narratively scripted-to-lose Silent Infarct fight.
  const isPrologueTutorial = prologue === "tutorial";
  // Push 6 — Profile "Replay Prologue" re-enters this exact guided sequence
  // without touching saved progress: no XP/currency/mastery/codex/inventory
  // is granted or recorded, and no onboarding flag is ever written.
  const isReplay = replay === "1";

  const enemy = useMemo(() => {
    if (!enemyId) return ENEMIES[0];
    if (enemyId === BOSS_LORD_IMBALANCE.id) return BOSS_LORD_IMBALANCE;
    if (enemyId === BOSS_SILENT_INFARCT.id) return BOSS_SILENT_INFARCT;
    return ENEMIES.find((e) => e.id === enemyId) || ENEMIES[0];
  }, [enemyId]);

  const isPrologueBoss = prologue === "boss" && !!enemy.scriptedLoss;
  // Shared boss check for reward tiering: the scripted prologue boss OR any
  // World Event world boss earns boss-scale XP/shards/crowns.
  const isBossEnemy = enemy.id === BOSS_LORD_IMBALANCE.id || !!enemy.worldBoss;

  // Prologue loaner heroes: brand-new players own no heroes (Recruitment is
  // the only source), so the guided tutorial battle and the scripted prologue
  // boss run on TEMPORARY loaner heroes. The tutorial script pins specific
  // skills (Lantern of Clues / Guardian's Touch), so the loaner pair must be
  // exactly Novice Guardian + Village Caretaker. Loaners are never persisted:
  // the prologue runs as training (no hero XP) and nothing writes them into
  // heroes_owned/active_team/hero_progression.
  const isPrologueLoanerBattle = isPrologueTutorial || isPrologueBoss;
  const team = useMemo(() => {
    if (isPrologueLoanerBattle || !player || (player.heroes_owned || []).length === 0) {
      const loanerIds = ["novice_guardian", "village_caretaker"];
      return loanerIds
        .map((id) => HEROES.find((h) => h.id === id))
        .filter(Boolean) as Hero[];
    }
    const teamIds = (player.active_team && player.active_team.length > 0) ? player.active_team : player.heroes_owned;
    const fromTeam = teamIds
      .map(id => {
        const base = HEROES.find(h => h.id === id);
        if (!base) return null;
        return applyStarToHero(base, getProgress(player.hero_progression, id));
      })
      .filter(Boolean) as Hero[];
    if (fromTeam.length >= 1) return fromTeam.slice(0, 3);
    return HEROES.slice(0, 3);
  }, [player, isPrologueLoanerBattle]);

  // Cosmetic ward-skin backdrop (e.g. Bloom Ward Skin). Only ward skins carry a
  // wardBackdrop; equipped aura-only skins leave the per-system arena unchanged.
  const wardBackdrop = useMemo(() => {
    const skin = findSkin(player?.equipped_ward_skin || "");
    return skin?.wardBackdrop ?? null;
  }, [player?.equipped_ward_skin]);

  const failureCount = (player?.failure_counts || {})[enemy.id] || 0;
  const mentorAid = failureCount >= 3;
  const tacticalHint = failureCount >= 2;
  const gentleHint = failureCount >= 1;
  const explanationLayer = getExplanationLayer(player?.learning_profile);
  const difficultyLevel = (player?.difficulty || 'standard') as DifficultyLevel;

  const [state, setState] = useState<BattleState>(() => {
    const profile = (player?.learning_profile as LearningProfile | undefined) || undefined;
    const handicap = getStartingHandicap(profile);
    const mentorAid = failureCount >= 3;
    const upgrades = aggregateUpgradeEffects(player?.owned_upgrades);
    // Player Class ability bonuses (Guardian/Seer/Caretaker/Scholar tiers at
    // Player Level 10/20/30) — see progression.ts getClassBattleBonuses.
    const classBonuses = getClassBattleBonuses(player?.aptitude, player?.player_level ?? 1);
    // J4 — apply Hero Skill Academy upgrade bonuses to team skills (pre-battle,
    // additive-only, does not modify HEROES source data or BattleState types).
    // Skipped for prologue loaner battles so tutorial fights are unaffected.
    const battleTeam = !isPrologueLoanerBattle
      ? applySkillUpgradesToTeam(team, player?.hero_skill_upgrades ?? {})
      : team;
    const base = initBattle(enemy, battleTeam, {
      inventory: player?.inventory || {},
      profile,
      enemyMastery: player?.enemy_mastery,
      chapter: player?.chapter_progress,
      startingStabilityBonus: handicap.startingStabilityBonus + (mentorAid ? 10 : 0) + (isTraining ? 10 : 0) + upgrades.startingStabilityBonus + classBonuses.startingStabilityBonus,
      enemyDamageReduction: handicap.enemyDamageReduction + upgrades.enemyDamageReduction,
      revealOneExtraClue: handicap.revealOneExtraClue || isTraining || upgrades.revealOneExtraClue || classBonuses.revealOneExtraClue,
      apBonus: upgrades.apBonus + classBonuses.apBonus,
      startShield: classBonuses.startShield,
      difficulty: player?.difficulty || undefined,
      additionalEnemies: getWaveAdditionalEnemies(enemy.id),
      // P8 — pass equipped cards from loadout (limited-use per battle).
      // Empty array → skip, let initBattle use random draw (legacy).
      equippedCards: (player?.equipped_cards?.length ?? 0) > 0 ? player!.equipped_cards : undefined,
    });
    let { stability, visibleClues, hiddenClueIds, revealedLabels, log } = base;

    if (player?.aptitude === "weaver" && hiddenClueIds.length > 0) {
      const revealed = hiddenClueIds.shift()!;
      visibleClues = [...visibleClues, revealed];
      const clue = [...enemy.visibleClues, ...enemy.hiddenClues].find(c => c.id === revealed);
      if (clue) revealedLabels = [...revealedLabels, clue.label];
      log = [...log, `⟡ Weaver's Eye: one hidden clue revealed at battle start.`];
    }
    if (mentorAid) log = [...log, isPrologueTutorial || isPrologueBoss ? `🕯 Master Bai steadies your hand. Starting Stability +10.` : `🕯 The System steadies your hand. Starting Stability +10.`];
    if (isTraining) log = [...log, `📜 Training Battle: hidden clue revealed, enemy weakened.`];
    return { ...base, stability, visibleClues, hiddenClueIds, revealedLabels, log };
  });

  // P9 — team hero families, used to filter available Call for Help options.
  const teamFamilies = useMemo<Set<ClassFamily>>(() => {
    const s = new Set<ClassFamily>();
    team.forEach(h => { if ((h as any).family) s.add((h as any).family as ClassFamily); });
    return s;
  }, [team]);

  const [activeTab, setActiveTabRaw] = useState<Tab>("actions");
  const cardTabOpenedRef = useRef(false);
  const [showCardTutorial, setShowCardTutorial] = useState(false);
  const callTabOpenedRef = useRef(false);
  const [showCallTutorial, setShowCallTutorial] = useState(false);
  // P9 — result popup shown after each Call for Help use.
  const [callResult, setCallResult] = useState<{ title: string; detail: string; success: boolean } | null>(null);
  function setActiveTab(tab: Tab) {
    if (tab === "cards" && !cardTabOpenedRef.current) {
      cardTabOpenedRef.current = true;
      if (!player?.seen_card_tutorial) setShowCardTutorial(true);
    }
    if (tab === "call" && !callTabOpenedRef.current) {
      callTabOpenedRef.current = true;
      if (!player?.seen_call_tutorial) setShowCallTutorial(true);
    }
    setActiveTabRaw(tab);
  }
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [feedbackIsChain, setFeedbackIsChain] = useState(false);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnActionsRef = useRef<string[]>([]);
  const [codexExpanded, setCodexExpanded] = useState(false);
  const [sageScoutBonusUsed, setSageScoutBonusUsed] = useState(false);
  const [detail, setDetail] = useState<DetailEntry | null>(null);
  const [timingSkill, setTimingSkill] = useState<{ hero: Hero; skill: HeroSkill } | null>(null);
  const [timingProgress, setTimingProgress] = useState(0);
  const timingAnim = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cueFeedback, setCueFeedback] = useState<{
    cue: NonNullable<BattleState["pendingCue"]>;
    chosenIndex: number;
    isCorrect: boolean;
  } | null>(null);
  const cueTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Defer advancing the guided tutorial until the covering cue explanation is
  // dismissed — otherwise the next step's Modal popover would render on top of
  // the feedback and steal the front layer.
  const cueAdvanceRef = useRef(false);
  const dismissCueFeedback = () => {
    if (cueTimer.current) { clearTimeout(cueTimer.current); cueTimer.current = null; }
    setCueFeedback(null);
    if (cueAdvanceRef.current) {
      cueAdvanceRef.current = false;
      onRequiredAction("cue");
    }
  };
  useEffect(() => () => { if (cueTimer.current) clearTimeout(cueTimer.current); }, []);
  useEffect(() => () => { if (termTooltipTimer.current) clearTimeout(termTooltipTimer.current); }, []);
  const [actionFx, setActionFx] = useState<BattleFx>(null);
  const [enemyFxTs, setEnemyFxTs] = useState(0);
  const [enemyFxAction, setEnemyFxAction] = useState<ActionType | null>(null);
  const [enemyAttackTs, setEnemyAttackTs] = useState(0);
  const [enemyAttackKind, setEnemyAttackKind] = useState<EnemyAttackKind | null>(null);

  // ── Pre-battle objective popup (shown once at battle start) ─────────────
  const [showObjective, setShowObjective] = useState(true);

  // ── Battle Help glossary ──────────────────────────────────────────────────
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [termTooltip, setTermTooltip] = useState<{ term: string; desc: string } | null>(null);
  const termTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTermTooltip = (term: string, desc: string) => {
    if (termTooltipTimer.current) clearTimeout(termTooltipTimer.current);
    setTermTooltip({ term, desc });
    termTooltipTimer.current = setTimeout(() => setTermTooltip(null), 4200);
  };

  // ── firstBattle cinematic story-beat overlays ─────────────────────────────
  const [cinematicText, setCinematicText] = useState<string | null>(null);
  const [cinematicSeverity, setCinematicSeverity] = useState<"positive" | "warning" | "danger">("positive");
  const [flashColor, setFlashColor] = useState("rgba(34,197,94,0.0)");
  const cinematicFadeAnim = useRef(new Animated.Value(0)).current;
  const flashFadeAnim = useRef(new Animated.Value(0)).current;
  const cinematicTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cinematicMsgId = useRef(0);
  const prevFbStepRef = useRef<string | undefined>(undefined);
  // Set to true by the firstBattle scripted-loss timer so finish() can branch
  // to the Lotus Recall "Timeline Failed" screen instead of the normal defeat.
  const isFirstBattleLoss = useRef(false);

  const triggerFx = (actorId?: string, action?: ActionType) => {
    const ts = Date.now();
    if (actorId) setActionFx({ actorId, ts, action });
    setEnemyFxAction(action ?? null);
    setEnemyFxTs(ts);
  };
  const triggerEnemyAttack = (kind: EnemyAttackKind) => {
    setEnemyAttackKind(kind);
    setEnemyAttackTs(Date.now());
  };

  // ---- Contextual tutorial tips (one-shot, persisted) ----
  const tips = useTipsQueue();
  const prevHiddenCount = useRef(state.hiddenClueIds.length);
  const prevActionCount = useRef(state.turnsTaken);
  const prevTurn = useRef(state.turnsTaken);
  const tsFirstAction = useRef(false);
  const tsPrevClueCount = useRef(state.visibleClues.length);
  // Auto-start the guided prologueBattle tutorial for the Push 1 tutorial
  // fight, otherwise fall back to the normal firstBattle tutorial.
  useEffect(() => {
    if (isPrologueTutorial) {
      // The prologue Ward Shift is only ever reached while the backend-owned
      // prologue_complete flag is still false. Tutorial completion, however,
      // lives in device-local AsyncStorage — so a phone that ran the prologue
      // before keeps prologueBattle marked done and would silently skip the
      // guided walkthrough (no forcing, no highlights) even for a fresh player.
      // Reaching this screen is itself proof the player still needs the
      // hand-held first shift, so always force-start it here. replayTutorial
      // (not startTutorial) is used because it bypasses the "already
      // completed" guard — this is the one legitimate forced restart.
      const t = setTimeout(() => replayTutorial("prologueBattle"), 800);
      return () => clearTimeout(t);
    }
    if (!isCompleted("firstBattle")) {
      const t = setTimeout(() => startTutorial("firstBattle"), 800);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Push 1 prologue boss safety net: this fight is narratively scripted to
  // end in defeat. Normal stability math already makes it nearly unwinnable
  // (very high stabilityResistance/instability, no weakSystem), but if the
  // player somehow keeps Stability alive past a generous turn cap, force the
  // scripted collapse rather than ever letting them "win" the boss.
  useEffect(() => {
    if (!isPrologueBoss) return;
    if (state.outcome !== "ongoing") return;
    if (state.turnsTaken < 6) return;
    setState((s) => ({ ...s, outcome: "loss", stability: 0, log: [...s.log, "⚠ The patient's condition collapses without warning."] }));
  }, [isPrologueBoss, state.outcome, state.turnsTaken]);

  // firstBattle scripted-loss: once the guided chain is complete (fb_done
  // overlay shows), advance the tutorial to mark it done, then trigger the
  // story defeat. The 2.5 s delay lets the fb_done overlay be readable.
  useEffect(() => {
    if (!isFirstBattleGuided) return;
    if (currentStep?.id !== "fb_done") return;
    if (state.outcome !== "ongoing") return;
    const t = setTimeout(() => {
      advanceStep();
      // Flag BEFORE setState so the outcome modal condition reads it on the
      // same render that sets outcome:"loss", preventing any flash of the
      // normal "Patient Lost" UI before finish() is invoked.
      isFirstBattleLoss.current = true;
      setState(s => ({
        ...s,
        outcome: "loss",
        stability: 0,
        log: [...s.log, "The ward is overwhelmed. This battle was always meant to test your rhythm, not to be won."],
      }));
    }, 2500);
    return () => clearTimeout(t);
  }, [isFirstBattleGuided, currentStep?.id, state.outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  // firstBattle Lotus Recall: skip the normal outcome modal entirely —
  // as soon as outcome flips to "loss" and the flag is set, auto-invoke
  // finish() which will route to /lotus-recall?firstBattle=1.
  useEffect(() => {
    if (!isFirstBattleLoss.current || state.outcome !== "loss") return;
    finish();
  }, [state.outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stability floor during firstBattle chain steps: prevent an enemy attack
  // from zeroing the patient before the chain completes.
  useEffect(() => {
    if (!isFirstBattleActionStep) return;
    if (state.stability > 0 || state.outcome !== "ongoing") return;
    setState(s => ({ ...s, stability: 1 }));
  }, [isFirstBattleActionStep, state.stability, state.outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── firstBattle cinematic helpers ────────────────────────────────────────
  // Plain functions (not useCallback) — all internal references are stable
  // refs or stable setState setters, so eslint-disable is safe.
  const _clearCinematicTimers = () => {
    cinematicTimers.current.forEach(t => clearTimeout(t));
    cinematicTimers.current = [];
  };
  const _showCinematicMsg = (text: string, severity: "positive" | "warning" | "danger", duration = 1600) => {
    const id = ++cinematicMsgId.current;
    cinematicFadeAnim.stopAnimation();
    cinematicFadeAnim.setValue(0);
    setCinematicText(text);
    setCinematicSeverity(severity);
    Animated.timing(cinematicFadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(cinematicFadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        if (cinematicMsgId.current === id) setCinematicText(null);
      });
    }, duration);
    cinematicTimers.current.push(t);
  };
  const _triggerFlash = (color: string, duration = 600) => {
    setFlashColor(color);
    flashFadeAnim.stopAnimation();
    flashFadeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(flashFadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(flashFadeAnim, { toValue: 0, duration: Math.max(80, duration - 120), useNativeDriver: true }),
    ]).start();
  };

  // Watch chain-step transitions during firstBattle and play cinematic story
  // beats: each action briefly works, then Silent Infarction fights back.
  // The final reassess→done beat triggers before the 2500ms scripted loss.
  useEffect(() => {
    const newStep = currentStep?.id;
    const prev = prevFbStepRef.current;
    prevFbStepRef.current = newStep;
    if (!isFirstBattleGuided || !prev || prev === newStep) return;

    _clearCinematicTimers();

    if (prev === "fb_scout" && newStep === "fb_stabilize") {
      // Scout done → cue confirmed, but threat lingers
      _showCinematicMsg("Cue Found", "positive", 1400);
      const t = setTimeout(() => _showCinematicMsg("Hidden danger remains...", "warning", 1700), 1700);
      cinematicTimers.current.push(t);

    } else if (prev === "fb_stabilize" && newStep === "fb_counter") {
      // Stabilize done → brief green protection, then Silent Infarction pulses back
      _triggerFlash("rgba(34,197,94,0.20)", 700);
      _showCinematicMsg("Stability Secured", "positive", 1400);
      const t = setTimeout(() => {
        _showCinematicMsg("Silent Infarction pulses...", "danger", 1700);
        _triggerFlash("rgba(239,68,68,0.26)", 900);
        setState(s => ({ ...s, stability: Math.max(1, s.stability - 18) }));
      }, 1700);
      cinematicTimers.current.push(t);

    } else if (prev === "fb_counter" && newStep === "fb_reassess") {
      // Counter done → corruption cracks, then reconstitutes
      _triggerFlash("rgba(245,158,11,0.18)", 700);
      _showCinematicMsg("Corruption Cracking", "positive", 1400);
      const t = setTimeout(() => {
        _showCinematicMsg("It reconstitutes...", "warning", 1700);
        setState(s => ({ ...s, corruption: s.corruption + 22 }));
      }, 1700);
      cinematicTimers.current.push(t);

    } else if (prev === "fb_reassess" && newStep === "fb_done") {
      // Reassess done → condition deteriorates before scripted loss at +2500ms
      _showCinematicMsg("Condition Worsening", "danger", 2200);
      _triggerFlash("rgba(239,68,68,0.28)", 1000);
      const t = setTimeout(() => {
        _triggerFlash("rgba(239,68,68,0.38)", 900);
        setState(s => ({ ...s, stability: Math.max(1, s.stability - 28) }));
      }, 1300);
      cinematicTimers.current.push(t);
    }
  }, [currentStep?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear cinematic overlays when the battle ends so they don't render above
  // the outcome modal (which has no explicit zIndex).
  useEffect(() => {
    if (state.outcome === "ongoing") return;
    cinematicTimers.current.forEach(t => clearTimeout(t));
    cinematicTimers.current = [];
    cinematicFadeAnim.setValue(0);
    flashFadeAnim.setValue(0);
    setCinematicText(null);
  }, [state.outcome, cinematicFadeAnim, flashFadeAnim]);

  // Unmount cleanup for cinematic timers
  useEffect(() => () => { cinematicTimers.current.forEach(t => clearTimeout(t)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Battle exit guards ────────────────────────────────────────────────────
  // Back navigation (browser back, Android hardware back, iOS swipe-back,
  // in-app pops) is blocked for EVERY battle — mid-battle back used to strand
  // tutorial overlays and skip the scripted prologue flow. Forward exits
  // (finish()'s router.replace, the ✕ close button's replace) always pass
  // through because the guard only swallows back-type actions. For mandatory
  // battles the ✕/help buttons are additionally hidden from render 0.
  useBlockBack();
  // Leaving mid-tutorial (any exit path) must never leak the overlay /
  // highlight / blocking scrim onto the next screen.
  useClearTutorialOnExit();

  // On mount: introduce the goal
  useEffect(() => { tips.enqueue("battle.intro"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // First skill cast
  useEffect(() => {
    if (state.turnsTaken > prevActionCount.current) {
      tips.enqueue("battle.firstSkill");
    }
    prevActionCount.current = state.turnsTaken;
  }, [state.turnsTaken, tips]);
  // Reveal of a hidden clue
  useEffect(() => {
    if (state.hiddenClueIds.length < prevHiddenCount.current) {
      tips.enqueue("battle.clueReveal");
    }
    prevHiddenCount.current = state.hiddenClueIds.length;
  }, [state.hiddenClueIds.length, tips]);
  // Low AP nudge
  useEffect(() => {
    if (state.ap === 0 && state.outcome === "ongoing") {
      tips.enqueue("battle.lowAp");
    }
  }, [state.ap, state.outcome, tips]);
  // Full care chain just completed
  useEffect(() => {
    if (state.fullChainCompleted) {
      tips.enqueue("battle.firstChain");
    }
  }, [state.fullChainCompleted, tips]);
  // End-of-turn instability tip (after first turn passes)
  useEffect(() => {
    if (state.turn > 1 && state.turn !== prevTurn.current) {
      tips.enqueue("battle.endTurn");
    }
    prevTurn.current = state.turn;
  }, [state.turn, tips]);

  const stabilityColor = state.stability > 60 ? COLORS.success : state.stability > 30 ? COLORS.warning : COLORS.error;
  const corruptionPct = Math.min(100, (state.corruption / enemy.corruption) * 100);
  const hints = getEnemyHint(enemy.id);
  const mission = getMission(enemy.id);
  const adaptiveMission = MISSION_BRIEFINGS[enemy.id]?.[explanationLayer];
  const objectiveStrip = getObjectiveStrip(enemy.id, explanationLayer, OBJECTIVE_BY_DIFFICULTY[difficultyLevel] || OBJECTIVE_BY_DIFFICULTY.standard);
  const isNonmedical = player?.learning_profile === "nonmedical";
  const isFirstBattle = (player?.runs_completed ?? 0) === 0 && enemy.id === "air_sprite";
  const sageDiscount = player?.aptitude === "sage" && !sageScoutBonusUsed;

  useEffect(() => {
    logEvent('enemy_viewed', 'battle', { gameState: { enemy: enemy.id, stability: state.stability, corruption: state.corruption, ap: state.ap } });
    logEvent('patient_stability_first_shown', 'battle', { gameState: { stability: state.stability } });
    logEvent('disease_corruption_first_shown', 'battle', { gameState: { corruption: state.corruption } });
    logEvent('mission_briefing_viewed', 'battle', { meta: { mission: mission?.missionTitle, enemy: enemy.id } });
    updateBattleSummary({ enemy: enemy.name, result: 'in_progress' });
  }, []);

  useEffect(() => {
    if (activeTab === 'items') logEvent('item_tab_opened', 'battle', { gameState: { stability: state.stability, corruption: state.corruption } });
    if (activeTab === 'call') logEvent('call_tab_opened', 'battle', { gameState: { stability: state.stability, corruption: state.corruption } });
  }, [activeTab]);

  useEffect(() => {
    if (state.outcome === 'win') {
      logEvent('battle_won', 'battle', { gameState: { stability: state.stability, turn: state.turnsTaken } });
      updateBattleSummary({ result: 'win', turns: state.turnsTaken, careChainCompleted: !!state.fullChainCompleted, careAttemptsUsed: state.basicAidUses ?? 0 });
    } else if (state.outcome === 'loss') {
      updateBattleSummary({ result: 'loss', turns: state.turnsTaken, careAttemptsUsed: state.basicAidUses ?? 0 });
    }
  }, [state.outcome]);

  useEffect(() => {
    const cur = state.visibleClues.length;
    if (cur > tsPrevClueCount.current) {
      logEvent('hidden_clue_revealed', 'battle', { gameState: { stability: state.stability, corruption: state.corruption } });
      tsPrevClueCount.current = cur;
    }
  }, [state.visibleClues.length]);

  useEffect(() => {
    if ((state.basicAidUses ?? 0) > 0) {
      logEvent('care_attempt_used', 'battle', { gameState: { stability: state.stability, corruption: state.corruption, ap: state.ap } });
    }
  }, [state.basicAidUses]);

  const showFeedback = (actionType: string) => {
    const prior = turnActionsRef.current;
    const treatedThisTurn = prior.some(a => a === 'strike' || a === 'stabilize' || a === 'support');
    const scoutedThisTurn = prior.some(a => a === 'scout');
    const ctx = { scoutedThisTurn, treatedThisTurn, stabilityLow: state.stability < 50 };
    let msg: string | null = null;
    let isChain = false;
    if (actionType === 'scout') {
      msg = getContextualScoutFeedback(explanationLayer, ctx);
    } else if (actionType === 'stabilize') {
      msg = getContextualStabilizeFeedback(explanationLayer, ctx);
    } else if (actionType === 'strike') {
      msg = COUNTER_FEEDBACK[explanationLayer];
    } else if (actionType === 'analyze') {
      msg = getContextualReassessFeedback(explanationLayer, ctx);
      isChain = treatedThisTurn;
    } else if (actionType === 'shield') {
      msg = 'Shield raised — the next enemy attack deals reduced damage to Stability.';
    } else if (actionType === 'command') {
      msg = 'Command issued — protection and pressure applied together.';
    } else {
      msg = getGuidedFeedback(enemy.id, actionType) ?? null;
    }
    if (!msg) return;
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    setFeedbackIsChain(isChain);
    setFeedbackMsg(msg);
    feedbackTimeout.current = setTimeout(() => { setFeedbackMsg(null); setFeedbackIsChain(false); }, isChain ? 4500 : 3500);
  };

  // ---- Guided tutorial battle: force a specific care-chain sequence ----
  // Covers both the prologue battle and the first post-onboarding battle so
  // that wrong taps are caught with a nudge in both tutorials.
  const isTutorialBattle = activeTutorialId === "prologueBattle" || activeTutorialId === "firstBattle";
  // isMandatoryBattle adds isPrologueBoss so the X/help buttons are hidden
  // from render 0 (not just after the 800ms tutorial-start delay), and are
  // always hidden even if firstBattle was somehow already completed.
  const isMandatoryBattle = isTutorialBattle || isPrologueBoss;
  const guidedStep = isTutorialBattle && currentStep?.requireAction ? currentStep : null;
  const guidedSkillId = guidedStep?.requiredSkillId;
  const guidedCueStep = guidedStep?.requiredActionType === "cue";
  const guidedEndTurnStep = guidedStep?.requiredActionType === "endTurn";
  // firstBattle guided rehearsal: lock the action panel to exactly one skill
  // type at a time (scout/stabilize/strike/analyze). Wrong-type buttons are
  // fully disabled (not just nudged), and the correct type pulses gold.
  const guidedActionType = (guidedStep?.requiredActionType ?? null) as string | null;

  // Pulse animation for the required battle target (skill card or End Turn).
  // Scales the highlighted element gently so the player's eye is drawn to it
  // without dimming anything else on screen.
  const skillPulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const isActive = !!(guidedSkillId || guidedEndTurnStep || isFirstBattleActionStep);
    if (!isActive) { skillPulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skillPulseAnim, { toValue: 1.05, duration: 480, useNativeDriver: true }),
        Animated.timing(skillPulseAnim, { toValue: 1.0,  duration: 480, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [guidedSkillId, guidedEndTurnStep, skillPulseAnim]);

  const tutorialNudge = () => {
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    setFeedbackMsg("Follow the highlighted step to continue.");
    feedbackTimeout.current = setTimeout(() => setFeedbackMsg(null), 2500);
  };

  const showBlockMsg = (msg: string) => {
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    setFeedbackMsg(msg);
    feedbackTimeout.current = setTimeout(() => setFeedbackMsg(null), 2500);
  };

  const handleSkill = (hero: Hero, skill: HeroSkill, castQuality: CastQuality = "normal") => {
    if (state.outcome !== "ongoing") return;
    // prologueBattle locks to a specific skill ID; firstBattle locks to a type.
    if (guidedStep && guidedSkillId && skill.id !== guidedSkillId) { tutorialNudge(); return; }
    if (isFirstBattleActionStep && skill.type !== guidedActionType) { tutorialNudge(); return; }
    let effective = skill;
    if (sageDiscount && skill.type === "scout" && skill.cost > 0) {
      effective = { ...skill, cost: Math.max(0, skill.cost - 1) };
      setSageScoutBonusUsed(true);
    }
    if (state.ap < effective.cost) { showBlockMsg("Not enough AP for this skill."); return; }
    if (castQuality === "normal" && skillSupportsCastTiming(effective) && state.outcome === "ongoing" && !guidedSkillId) {
      openTimingPrompt(hero, effective);
      return;
    }
    onRequiredAction(skill.type, skill.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setState((s) => applySkill(s, effective, hero, castQuality).state);
    triggerFx(hero.id, effective.type);
    turnActionsRef.current = [...turnActionsRef.current, effective.type];
    showFeedback(skill.type);
    if (!tsFirstAction.current) {
      tsFirstAction.current = true;
      logEvent('first_action_used', 'battle', { playerAction: effective.type, gameState: { stability: state.stability, corruption: state.corruption, ap: state.ap - effective.cost } });
    }
    const isBestCounter = enemy.bestCounters.includes(effective.type as any);
    const evName =
      effective.type === 'scout' ? 'scout_used' :
      effective.type === 'stabilize' ? 'stabilize_used' :
      effective.type === 'analyze' ? 'reassess_used' :
      isBestCounter ? 'counter_used' : 'poor_fit_action_used';
    logEvent(evName, 'battle', {
      playerAction: effective.type,
      actionQuality: (effective.type === 'scout' || isBestCounter) ? 'correct' : 'neutral',
      gameState: { stability: state.stability, corruption: state.corruption, ap: state.ap - effective.cost },
      feedbackShown: isNonmedical ? (getGuidedFeedback(enemy.id, effective.type) ?? undefined) : undefined,
    });
    setDetail(null);
  };
  useEffect(() => () => { if (timingAnim.current) clearInterval(timingAnim.current); }, []);

  // Guided prologue: auto-select the hero who owns the required skill and open
  // the Actions tab so the pinned skill is always visible for the forced tap.
  useEffect(() => {
    if (!guidedSkillId) return;
    const owner = state.team.find(h => h.skills.some(sk => sk.id === guidedSkillId));
    if (owner && state.selectedHeroId !== owner.id) {
      setState(s => selectHero(s, owner.id));
    }
    setActiveTab("actions");
  }, [guidedSkillId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openTimingPrompt = (hero: Hero, skill: HeroSkill) => {
    if (timingAnim.current) clearInterval(timingAnim.current);
    setTimingSkill({ hero, skill });
    setTimingProgress(0);
    let v = 0;
    let dir = 1;
    timingAnim.current = setInterval(() => {
      v += dir * 4;
      if (v >= 100) { v = 100; dir = -1; }
      if (v <= 0) { v = 0; dir = 1; }
      setTimingProgress(v);
    }, 16);
  };

  const stopTimingAndCast = () => {
    if (timingAnim.current) { clearInterval(timingAnim.current); timingAnim.current = null; }
    const ts = timingSkill;
    const progress = timingProgress;
    setTimingSkill(null);
    if (!ts) return;
    const dist = Math.abs(progress - 50);
    const quality: CastQuality = dist <= 8 ? "perfect" : dist <= 22 ? "good" : "normal";
    handleSkill(ts.hero, ts.skill, quality);
  };

  const skipTiming = () => {
    if (timingAnim.current) { clearInterval(timingAnim.current); timingAnim.current = null; }
    const ts = timingSkill;
    setTimingSkill(null);
    if (ts) handleSkill(ts.hero, ts.skill, "normal");
  };

  const handleCard = (cardId: string) => {
    if (state.outcome !== "ongoing") return;
    if (guidedStep) { tutorialNudge(); return; }
    const res = applyCard(state, cardId);
    if (res.aborted) { showBlockMsg(res.message); return; }
    setState(res.state);
    triggerFx(state.selectedHeroId ?? undefined, "support");
    setDetail(null);
  };

  const handleUltimate = (hero: Hero) => {
    if (state.outcome !== "ongoing") return;
    if (guidedStep) { tutorialNudge(); return; }
    const res = applyUltimate(state, hero.id);
    if (res.aborted) { showBlockMsg(res.message); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setState(res.state);
    triggerFx(hero.id, "support");
  };

  const handleCueAnswer = (optionIndex: number) => {
    const cue = state.pendingCue;
    if (!cue) return;
    const isCorrect = !!cue.options[optionIndex]?.correct;
    // Guided prologue: only the correct answer is accepted.
    if (guidedCueStep && !isCorrect) { tutorialNudge(); return; }
    const res = answerClinicalCue(state, optionIndex);
    setState(res.state);
    if (isCorrect) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (guidedCueStep) cueAdvanceRef.current = true;
    }
    setCueFeedback({ cue, chosenIndex: optionIndex, isCorrect });
    if (cueTimer.current) clearTimeout(cueTimer.current);
    cueTimer.current = setTimeout(() => {
      dismissCueFeedback();
    }, 3000);
  };

  const handleTempAction = (actionId: string) => {
    if (guidedStep) { tutorialNudge(); return; }
    const res = applyTempAction(state, actionId);
    if (res.aborted) { showBlockMsg(res.message); return; }
    setState(res.state);
    triggerFx(state.selectedHeroId ?? undefined, "support");
    setDetail(null);
  };
  const handleUseItem = (item: Item) => {
    if (guidedStep) { tutorialNudge(); return; }
    const res = applyItem(state, item);
    if (res.aborted) { showBlockMsg(res.message); return; }
    setState(res.state);
    triggerFx(state.selectedHeroId ?? undefined, "stabilize");
    const itemActionType = item.target === 'corruption' ? 'strike' : item.target === 'clue' ? 'scout' : 'stabilize';
    turnActionsRef.current = [...turnActionsRef.current, itemActionType];
    setDetail(null);
  };
  const decideCallItem = () => {
    if (state.revealedLabels.some(l => l.toLowerCase().includes("wheez"))) return "Albuterol Mist";
    if (state.revealedLabels.some(l => l.toLowerCase().includes("glucose"))) return "Glucose Gel";
    if (state.revealedLabels.some(l => l.toLowerCase().includes("bp"))) return "Fluid Bolus";
    if (enemy.primarySystem === "Fire" || enemy.secondarySystem === "Fire") return "Isolation Kit";
    return "Lab Token";
  };
  // P9 — filter Call for Help options by team family composition.
  // call_rapid (Emergency) is always available.
  // call_infection also shows when the enemy is Fire/infection-tagged.
  const availableCalls = useMemo(() => CALL_OPTIONS.filter(opt => {
    if (!opt.requiredFamilies || opt.requiredFamilies.length === 0) return true;
    if (opt.id === "call_infection") {
      const enemyIsInfection = enemy.primarySystem === "Fire"
        || (ENEMY_CLINICAL[enemy.id]?.diseaseTags || []).some((t: string) => /infection|spread/.test(t));
      if (enemyIsInfection) return true;
    }
    return opt.requiredFamilies.some(f => teamFamilies.has(f));
  }), [teamFamilies, enemy]);

  const handleCall = (opt: typeof CALL_OPTIONS[number]) => {
    if (guidedStep) { tutorialNudge(); return; }
    const itemName = opt.effect === "addRelevantItem" ? decideCallItem() : undefined;
    const res = applyCall(state, opt, itemName);
    if (res.aborted) { showBlockMsg(res.message); return; }
    setState(res.state);
    triggerFx(state.selectedHeroId ?? undefined, "support");
    setDetail(null);
    // Show result popup
    const success = !res.aborted && res.status !== "inappropriate";
    setCallResult({
      title: res.aborted ? "Support Unavailable" : opt.name,
      detail: res.message || opt.description,
      success: !!success,
    });
  };

  const handleEndTurn = () => {
    if (state.outcome !== "ongoing") return;
    // During firstBattle action steps, endTurn is always allowed so the player
    // can refill AP between guided steps without getting stuck.
    if (guidedStep && !guidedEndTurnStep && !isFirstBattleActionStep) { tutorialNudge(); return; }
    onRequiredAction("endTurn");
    turnActionsRef.current = [];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    triggerEnemyAttack(getEnemySignatureAttack(enemy).kind);
    setState((s) => {
      let next = endPlayerTurn(s);
      if (player?.aptitude === "guardian" && s.outcome === "ongoing" && next.outcome === "ongoing" && next.stability < s.stability) {
        const recovered = Math.min(5, s.stability - next.stability);
        next = { ...next, stability: Math.min(100, next.stability + recovered), log: [...next.log, `🛡 Guardian's Vigil: damage reduced by ${recovered}.`] };
      }
      return next;
    });
  };

  const finish = async () => {
    // finish() navigates via router.replace, which the useBlockBack guard
    // deliberately lets through (it only swallows back-type actions).

    // ── firstBattle scripted loss → "Timeline Failed" Lotus Recall ───────────
    // Rewards (LOSS_LEARNING_XP) are granted here so the normal loss branch
    // is never reached. No stars, no shards, no crowns — narrative beat only.
    if (isFirstBattleLoss.current) {
      await recordFailure(enemy.id);
      if (!isTraining) {
        await applyRewards({ xp: LOSS_LEARNING_XP, codexShards: 0, crowns: 0, codex: [], enemyId: enemy.id, enemyName: enemy.name });
      }
      if (state.cuesTopicsCorrect.length > 0) {
        await recordCueTopics(state.cuesTopicsCorrect);
      }
      router.replace({ pathname: "/lotus-recall", params: { firstBattle: "1" } });
      return;
    }

    // Push 1 prologue boss: no normal Game Over, no normal victory rewards.
    // Route straight into the Lotus Recall cutscene regardless of outcome.
    if (isPrologueBoss) {
      // C1: grant obj_prologue_done XP (step 1 — Recall Stabilized). Awaited
      // so XP is persisted before the navigation tear-down removes this screen.
      const isPrologueNew = await completeObjective("obj_prologue_done");
      if (isPrologueNew) {
        await markObjectiveXpGranted("obj_prologue_done");
        await applyRewards({ xp: 10, codexShards: 0, crowns: 0, codex: [], enemyId: "", enemyName: "prologue" });
      }
      router.replace({ pathname: "/lotus-recall", params: { enemyId: enemy.id, replay: isReplay ? "1" : "" } });
      return;
    }
    let playerLevelUp: { fromLevel: number; toLevel: number } | null = null;
    let heroLevelUps: { heroId: string; fromLevel: number; toLevel: number }[] = [];
    let playerXpEarned = 0;
    let heroXpEarned: Record<string, number> = {};
    let epidemicTokensEarned = 0;
    // C3: passed to result screen for XP breakdown display.
    let battleBaseXp = 0;
    let battleStarsPct = 0;
    // C3 Replay: grants star-scaled XP (no first-clear bonus, no shards/crowns/hero XP).
    // Stamina was already spent at the battle entry point.
    if (isReplay) {
      const replayBaseXp = getBattleBaseXp(enemy.difficulty, isBossEnemy);
      const replayStarResult = state.outcome === "win" ? computeStars({
        won: true, fullChainCompleted: state.fullChainCompleted,
        unsafeActionsUsed: state.unsafeActionsUsed, poorFitActionsUsed: state.poorFitActionsUsed,
        turnsTaken: state.turnsTaken, reassessUsed: state.reassessUsedAnytime,
        consultsUsed: state.consultsUsed, emergencyCallsUsed: state.emergencyCallsUsed,
        inappropriateConsultsUsed: state.inappropriateConsultsUsed, basicAidUses: state.basicAidUses,
      }, getStarRules((player?.learning_profile as LearningProfile | undefined) || undefined, ENEMY_CLINICAL[enemy.id])) : { stars: 0 };
      const replayXp = state.outcome === "win"
        ? Math.max(1, Math.round(replayBaseXp * starXpMultiplier(replayStarResult.stars) * Math.max(0.5, getDifficultyModifier(player?.difficulty as any)?.rewardMultiplier ?? 1)))
        : 0;
      const replayStarsPct = state.outcome === "win" ? Math.round(starXpMultiplier(replayStarResult.stars) * 100) : 0;
      if (replayXp > 0) {
        await applyRewards({ xp: replayXp, codexShards: 0, crowns: 0, codex: [], enemyId: enemy.id, enemyName: enemy.name });
      }
      if (state.outcome === "win") {
        await updateBattleStars(enemy.id, replayStarResult.stars);
      }
      router.replace({
        pathname: "/result",
        params: {
          outcome: state.outcome, enemyId: enemy.id, stability: String(state.stability),
          training: isTraining ? "1" : "0", prologue: isPrologueTutorial ? "tutorial" : "",
          replay: "1", shards: "0", crowns: "0", fullChain: state.fullChainCompleted ? "1" : "0",
          unsafe: String(state.unsafeActionsUsed), poorFit: String(state.poorFitActionsUsed),
          turns: String(state.turnsTaken), reassess: state.reassessUsedAnytime ? "1" : "0",
          consults: String(state.consultsUsed), emergency: String(state.emergencyCallsUsed),
          inappropriate: String(state.inappropriateConsultsUsed), basicAid: String(state.basicAidUses),
          playerXp: String(replayXp), heroXp: "{}", playerLevelUp: "", heroLevelUps: "[]",
          baseXp: String(replayBaseXp), starsPct: String(replayStarsPct),
        },
      });
      return;
    }
    if (state.outcome === "win") {
      // Boss-tier rewards apply to the scripted prologue boss AND any World
      // Event world boss (Verdantha). Keyed on a shared check rather than a
      // single hardcoded id so live world bosses aren't under-rewarded.
      const isBoss = isBossEnemy;
      // C3: chapter-aware base XP scaled by enemy difficulty and boss status.
      const baseXp = getBattleBaseXp(enemy.difficulty, isBoss);
      const baseShards = isTraining ? 10 : (isBoss ? 100 : 25);
      const chainBonus = state.fullChainCompleted ? 10 : 0;
      const shards = baseShards + chainBonus;
      const crowns = isTraining ? 8 : (isBoss ? 80 : 20 + enemy.difficulty * 5);
      const startingInventory = player?.inventory || {};
      const inventoryDelta: Record<string, number> = {};
      for (const [k, v] of Object.entries(state.inventory)) {
        const diff = v - (startingInventory[k] || 0);
        if (diff !== 0) inventoryDelta[k] = diff;
      }
      // World Boss Relic Shard drop — a real inventory grant for defeating a
      // world boss (mirrors the drop card shown on the result screen).
      if (!isTraining && !!enemy.worldBoss) {
        inventoryDelta["World Boss Relic Shard"] = (inventoryDelta["World Boss Relic Shard"] || 0) + 1;
      }

      // Player EXP: separate progression pool from Hero EXP, scaled by
      // clinical performance (stars), difficulty, first-clear and Clinical
      // Cue accuracy — see progression.ts computePlayerXpReward.
      const enemyClinical = ENEMY_CLINICAL[enemy.id];
      const starRules = getStarRules((player?.learning_profile as LearningProfile | undefined) || undefined, enemyClinical);
      const starResult = computeStars({
        won: true,
        fullChainCompleted: state.fullChainCompleted,
        unsafeActionsUsed: state.unsafeActionsUsed,
        poorFitActionsUsed: state.poorFitActionsUsed,
        turnsTaken: state.turnsTaken,
        reassessUsed: state.reassessUsedAnytime,
        consultsUsed: state.consultsUsed,
        emergencyCallsUsed: state.emergencyCallsUsed,
        inappropriateConsultsUsed: state.inappropriateConsultsUsed,
        basicAidUses: state.basicAidUses,
      }, starRules);
      const diffMod = getDifficultyModifier(player?.difficulty as any);
      const isFirstClear = !((player?.enemy_mastery?.[enemy.name] || 0) > 0);
      playerXpEarned = isTraining ? 0 : computePlayerXpReward({
        baseXp,
        difficultyMultiplier: diffMod?.rewardMultiplier ?? 1,
        stars: starResult.stars,
        isFirstClear,
        clinicalCuesCorrect: state.cuesTopicsCorrect.length,
      });
      // C3: store for result screen XP breakdown display.
      battleBaseXp = baseXp;
      battleStarsPct = Math.round(starXpMultiplier(starResult.stars) * 100);

      // Hero EXP: split the per-hero battle contribution (skills/items/cards
      // used) proportionally, with a participation floor and reduced share
      // for heroes already above the enemy's level band.
      const participantIds = team.map((h) => h.id);
      const enemyLevelBand = enemy.difficulty * 5;
      const heroProgression = player?.hero_progression;
      const overleveledIds = participantIds.filter((id) => {
        const lvl = getProgress(heroProgression, id).level ?? 1;
        return lvl > enemyLevelBand + 10;
      });
      // Prologue tutorial uses loaner heroes that are never owned — skip hero
      // XP so novice_guardian/village_caretaker don't get progression entries.
      const heroAwards = (isTraining || isPrologueTutorial) ? [] : splitContributionToHeroXp({
        totalPlayerXp: baseXp,
        contribution: state.heroContribution,
        participantIds,
        overleveledIds,
      });
      heroXpEarned = heroAwards.reduce((acc, a) => { acc[a.heroId] = a.xpAwarded; return acc; }, {} as Record<string, number>);

      // Miasma Bloom world event — a completed Ward Shift run against the
      // outbreak earns Epidemic Tokens scaled by clinical performance (stars),
      // ward difficulty, first-clear and boss status. The exact scale (and how
      // it balances against the phase thresholds) lives in computeEpidemicTokens
      // so accrual and thresholds stay tuned together. Training and the scripted
      // prologue tutorial don't count as real shift runs, so they award none.
      epidemicTokensEarned = isTraining || isPrologueTutorial ? 0 : computeEpidemicTokens({
        stars: starResult.stars,
        difficulty: enemy.difficulty,
        isBoss: isBossEnemy,
        isFirstClear,
      });

      const rewardsResult = await applyRewards({
        xp: playerXpEarned, codex: enemy.teaches, enemyId: enemy.id, enemyName: enemy.name, codexShards: shards, crowns, epidemicTokens: epidemicTokensEarned, inventoryDelta,
        mastery: enemy.bestCounters.reduce((acc, c) => {
          const map: Record<string, keyof typeof acc> = { scout: "assessment", stabilize: "stabilization", strike: "pharmacology", shield: "judgment", cleanse: "judgment", command: "command", analyze: "systems", support: "stabilization" };
          const key = map[c]; if (key) acc[key] = (acc[key] || 0) + 1; return acc;
        }, {} as any),
        bossId: isBossEnemy ? enemy.id : undefined,
        regionId: mission?.kingdomRegion ?? undefined,
        heroXp: heroXpEarned,
      } as any);
      if (rewardsResult) {
        playerLevelUp = rewardsResult.playerLevelUp || null;
        heroLevelUps = rewardsResult.heroLevelUps || [];
      }
      // C3: persist best star rating for this enemy (drives replay badge + sweep unlock).
      if (!isTraining) {
        await updateBattleStars(enemy.id, starResult.stars);
      }
    } else if (state.outcome === "loss") {
      await recordFailure(enemy.id);
      // C3: small learning XP on a real (non-training, non-prologue) loss.
      // Stamina gate (1 per attempt, 10 min regen) prevents farming.
      if (!isTraining && !isPrologueTutorial) {
        playerXpEarned = LOSS_LEARNING_XP;
        await applyRewards({ xp: LOSS_LEARNING_XP, codexShards: 0, crowns: 0, codex: [], enemyId: enemy.id, enemyName: enemy.name });
      }
    }
    if (state.cuesTopicsCorrect.length > 0) {
      await recordCueTopics(state.cuesTopicsCorrect);
    }
    const baseShards = state.outcome === "win" ? (isTraining ? 10 : (isBossEnemy ? 100 : 25)) : 0;
    const crownsEarned = state.outcome === "win" ? (isTraining ? 8 : (isBossEnemy ? 80 : 20 + enemy.difficulty * 5)) : 0;
    router.replace({
      pathname: "/result",
      params: {
        outcome: state.outcome,
        enemyId: enemy.id,
        stability: String(state.stability),
        training: isTraining ? "1" : "0",
        prologue: isPrologueTutorial ? "tutorial" : "",
        shards: String(baseShards),
        crowns: String(crownsEarned),
        epidemicTokens: String(epidemicTokensEarned),
        fullChain: state.fullChainCompleted ? "1" : "0",
        unsafe: String(state.unsafeActionsUsed),
        poorFit: String(state.poorFitActionsUsed),
        turns: String(state.turnsTaken),
        reassess: state.reassessUsedAnytime ? "1" : "0",
        consults: String(state.consultsUsed),
        emergency: String(state.emergencyCallsUsed),
        inappropriate: String(state.inappropriateConsultsUsed),
        basicAid: String(state.basicAidUses),
        playerXp: String(playerXpEarned),
        heroXp: JSON.stringify(heroXpEarned),
        playerLevelUp: playerLevelUp ? JSON.stringify(playerLevelUp) : "",
        heroLevelUps: JSON.stringify(heroLevelUps),
        baseXp: String(battleBaseXp),
        starsPct: String(battleStarsPct),
      },
    });
  };

  // (Skills are filtered per selected hero in the Actions tab)

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>

      {/* ── ZONE A: Enemy header (compact, ~18% height) ── */}
      <View style={styles.zoneA}>
        {/* Hide exit and help buttons during tutorial battles — the ✕ on
            the tutorial overlay box is the only correct exit path. */}
        {!isMandatoryBattle && (
          <Pressable style={styles.closeBtn} onPress={() => router.replace(ROUTES.tabs)} testID="battle-close">
            <Ionicons name="close" size={16} color={COLORS.onSurface} />
          </Pressable>
        )}
        {!isMandatoryBattle && (
          <Pressable style={styles.helpBtn} onPress={() => router.push(ROUTES.tutorial)} hitSlop={10} testID="battle-tutorial-button">
            <Ionicons name="help-circle-outline" size={16} color={COLORS.onSurfaceSecondary} />
          </Pressable>
        )}
        <View style={styles.enemyHeaderRow}>
          <View style={{ flex: 1, gap: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.enemyKicker} numberOfLines={1}>{enemy.realWorld.toUpperCase()}</Text>
              {isTraining && <View style={styles.trainingTag}><Text style={styles.trainingTxt}>TRAINING</Text></View>}
            </View>
            <Text style={styles.enemyName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{enemy.name}</Text>
            <View style={styles.systemPills}>
              <View style={[styles.sysPill, { borderColor: ELEMENT_COLORS[enemy.primarySystem] }]}>
                <Text style={[styles.sysTxt, { color: ELEMENT_COLORS[enemy.primarySystem] }]}>{enemy.primarySystem}</Text>
              </View>
              {enemy.secondarySystem && (
                <View style={[styles.sysPill, { borderColor: ELEMENT_COLORS[enemy.secondarySystem] }]}>
                  <Text style={[styles.sysTxt, { color: ELEMENT_COLORS[enemy.secondarySystem] }]}>{enemy.secondarySystem}</Text>
                </View>
              )}
            </View>
            {state.wave.length > 1 && (
              <View style={styles.waveRow} testID="battle-wave-row">
                <Text style={styles.waveLabel}>WAVE</Text>
                {state.wave.map((m) => (
                  <View
                    key={m.enemy.id}
                    style={[
                      styles.wavePip,
                      m.defeated && styles.wavePipDefeated,
                      m.enemy.id === state.activeEnemyId && styles.wavePipActive,
                    ]}
                    testID={`wave-pip-${m.enemy.id}`}
                  >
                    <Text style={styles.wavePipTxt} numberOfLines={1}>
                      {m.defeated ? "✓" : m.enemy.name.split(" ")[0]}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
        {isPrologueBoss && (
          <View style={styles.systemWarningBanner} testID="battle-system-warning">
            <Ionicons name="warning" size={13} color={COLORS.error} />
            <Text style={styles.systemWarningTxt}>WARD ALARM: incomplete data. Readings cannot be trusted.</Text>
          </View>
        )}
      </View>

      {/* ── ZONE A2: Battlefield — live hero + enemy sprites ── */}
      <BattlefieldScene
        enemy={{
          id: enemy.id,
          name: enemy.name,
          realWorld: enemy.realWorld,
          primarySystem: enemy.primarySystem,
          secondarySystem: enemy.secondarySystem,
          weakSystem: enemy.weakSystem,
          dangerTrigger: enemy.dangerTrigger,
          bestCounters: enemy.bestCounters,
          visibleClues: [...enemy.visibleClues, ...enemy.hiddenClues].filter((c) => state.visibleClues.includes(c.id)),
        }}
        team={team}
        selectedHeroId={state.selectedHeroId}
        heroActionsUsed={state.heroActionsUsed}
        outcome={state.outcome}
        actionFx={actionFx}
        enemyFxTs={enemyFxTs}
        enemyFxAction={enemyFxAction}
        enemyAttackTs={enemyAttackTs}
        enemyAttackKind={enemyAttackKind}
        wardBackdrop={wardBackdrop}
      />

      {/* ── ZONE B: Meters + Codex + Clues (~18% height) ── */}
      <View style={styles.zoneB}>
        <View style={styles.barRow}>
          <Pressable hitSlop={8} onPress={() => showTermTooltip("Corruption", "How much the illness is still taking over. Lower it to zero to win. Some illnesses can spread, recover, or behave in hidden ways.")} testID="term-tap-corruption">
            <Text style={[styles.barLabel, styles.barLabelTappable]}>CORRUPTION</Text>
          </Pressable>
          <View style={styles.barBg}><View style={[styles.barFill, { width: `${corruptionPct}%`, backgroundColor: COLORS.corruptCrystal }]} /></View>
          <Text style={styles.barVal}>{state.corruption}</Text>
        </View>
        <View style={styles.barRow}>
          <Pressable hitSlop={8} onPress={() => showTermTooltip("Stability", "How safely the patient is holding on. Keep it above zero — the enemy attacks it every turn. If it hits 0, the patient is lost.")} testID="term-tap-stability">
            <Text style={[styles.barLabel, styles.barLabelTappable]}>STABILITY</Text>
          </Pressable>
          <View style={styles.barBg}><View style={[styles.barFill, { width: `${state.stability}%`, backgroundColor: stabilityColor }]} /></View>
          <Text style={[styles.barVal, { color: stabilityColor }]}>{state.stability}%</Text>
        </View>
        {termTooltip && (
          <Pressable
            style={styles.termTooltipBanner}
            onPress={() => { if (termTooltipTimer.current) clearTimeout(termTooltipTimer.current); setTermTooltip(null); }}
            testID="term-tooltip-dismiss"
          >
            <Text style={styles.termTooltipTerm}>{termTooltip.term.toUpperCase()}</Text>
            <Text style={styles.termTooltipDesc}>{termTooltip.desc}</Text>
            <Ionicons name="close" size={11} color={COLORS.onSurfaceTertiary} />
          </Pressable>
        )}
        <Pressable style={styles.codexCard} onPress={() => setCodexExpanded(!codexExpanded)} testID="battle-guidance">
          <Ionicons name="book-outline" size={11} color={COLORS.brand} />
          <Text style={styles.codexLabel} numberOfLines={codexExpanded ? undefined : 1}>
            {mentorAid ? (isPrologueTutorial || isPrologueBoss ? "MASTER BAI'S AID: " : "SYSTEM'S AID: ") : tacticalHint ? (isPrologueTutorial || isPrologueBoss ? "MASTER BAI: " : "SYSTEM: ") : gentleHint ? "CODEX WHISPERS: " : "CODEX: "}
            <Text style={styles.codexText}>
              {mentorAid ? `+10 Stability. ${hints.tactical}` : tacticalHint ? hints.tactical : gentleHint ? hints.gentle : `Match actions to the ${enemy.primarySystem} system.`}
            </Text>
          </Text>
          <Ionicons name={codexExpanded ? "chevron-up" : "chevron-down"} size={11} color={COLORS.onSurfaceTertiary} />
        </Pressable>
        <View style={styles.clueRow}>
          {[...enemy.visibleClues, ...enemy.hiddenClues].map((c) => {
            const isVisible = state.visibleClues.includes(c.id);
            return (
              <View key={c.id} style={[styles.clue, isVisible ? styles.clueVisible : styles.clueHidden]} testID={`clue-${c.id}`}>
                {isVisible ? (
                  <>
                    <Text style={styles.clueLabel} numberOfLines={1}>{c.label}</Text>
                    <Text style={styles.clueDetail} numberOfLines={2}>{c.detail}</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="help" size={13} color={COLORS.onSurfaceTertiary} />
                    <Text style={styles.clueLabel}>HIDDEN</Text>
                  </>
                )}
              </View>
            );
          })}
        </View>
        <Pressable style={styles.battleHelpBtn} onPress={() => setGlossaryOpen(true)} testID="battle-help-open">
          <Ionicons name="help-circle-outline" size={12} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.battleHelpTxt}>Battle Help</Text>
        </Pressable>
      </View>

      {/* ── ZONE C: Team + AP + Tabs (~16% height) ── */}
      <View style={styles.zoneC}>
        <View style={[styles.heroRow, { paddingHorizontal: SPACING.xs }]}>
          {team.map(h => {
            const acted = !!state.heroActionsUsed[h.id];
            const selected = state.selectedHeroId === h.id;
            const elementColor = ELEMENT_COLORS[h.element] || COLORS.brand;
            const pillW = Math.floor((screenW - SPACING.xs * 2 - (team.length - 1) * 5) / team.length);
            const charge = state.heroUltimateCharge[h.id] ?? 0;
            const ultReady = isUltimateReady(state, h.id) && !acted && state.outcome === "ongoing";
            const ult = ULTIMATE_BY_ROLE[h.role];
            return (
              <Pressable
                key={h.id}
                onPress={() => { if (!acted) setState(prev => selectHero(prev, h.id)); }}
                hitSlop={6}
                style={[styles.heroPill, { width: pillW }, selected && !acted && { borderColor: elementColor, backgroundColor: elementColor + "18" }, acted && styles.heroPillActed]}
                testID={`hero-pill-${h.id}`}
                accessibilityRole="button"
              >
                <Text style={[styles.heroPillName, selected && !acted && { color: elementColor }, acted && { color: COLORS.onSurfaceTertiary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
                  {h.name}
                </Text>
                <Text style={[styles.heroPillRole, acted && { color: COLORS.onSurfaceTertiary }]} numberOfLines={1}>
                  {acted ? "ACTED" : h.element.toUpperCase()}
                </Text>
                <View style={styles.ultBarBg}>
                  <View style={[styles.ultBarFill, { width: `${Math.min(100, charge)}%`, backgroundColor: ultReady ? COLORS.runeGold : elementColor }]} />
                </View>
                {ultReady ? (
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); handleUltimate(h); }}
                    style={styles.ultBtn}
                    testID={`hero-ultimate-${h.id}`}
                  >
                    <Ionicons name="sparkles" size={9} color="#1A1200" />
                    <Text style={styles.ultBtnTxt} numberOfLines={1}>{ult.name}</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.apRow}>
          <Text style={styles.apLabel}>AP</Text>
          <View style={{ flexDirection: "row", gap: 4, flex: 1 }}>
            {Array.from({ length: Math.max(state.apMax, state.ap) }).map((_, i) => {
              const isBonus = i >= state.apMax;
              return (
                <View
                  key={i}
                  style={[
                    styles.apDot,
                    i < state.ap && styles.apDotOn,
                    isBonus && i < state.ap && styles.apDotBonus,
                  ]}
                />
              );
            })}
          </View>
          <Animated.View style={guidedEndTurnStep ? { transform: [{ scale: skillPulseAnim }] } : undefined}>
            <Pressable onPress={handleEndTurn} style={[styles.endBtn, guidedEndTurnStep && styles.guidedHighlight]} disabled={state.outcome !== "ongoing"} testID="battle-end-turn">
              <Text style={styles.endTxt}>END TURN</Text>
            </Pressable>
          </Animated.View>
        </View>
        <View style={styles.tabs}>
          {(["actions", "items", "cards", "call", "team"] as Tab[]).map(t => (
            <Pressable key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)} testID={`tab-${t}`}>
              <Text style={[styles.tabTxt, activeTab === t && styles.tabTxtActive]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.affordanceHint}>Tap to use · Long-press for details</Text>
      </View>

      {/* ── ZONE D: Action area (flex 1, scrolls internally) ── */}
      <View style={styles.zoneD}>
        {/* Care Chain Rhythm Strip — always visible during active battles.
            During tutorial battles the active step pulses and prior steps
            show a checkmark, giving a visual guide without long dialogue. */}
        {state.outcome === "ongoing" && (
          <CareChainStrip
            chain={state.chain}
            isTutorial={isTutorialBattle}
            currentStepId={currentStep?.id}
          />
        )}
        {/* Objective strip / adaptive feedback banner. While the guided
            prologue tutorial is actively narrating (Master Bai walks the
            player through every step), the goal strip is redundant noise —
            hide it and let the narrator carry the objective. */}
        {feedbackMsg ? (
          <View pointerEvents="none" style={[styles.feedbackBanner, feedbackIsChain && styles.feedbackBannerChain]}>
            <Ionicons name={feedbackIsChain ? "sparkles" : "information-circle"} size={11} color={feedbackIsChain ? COLORS.runeGold : COLORS.brand} />
            <Text style={[styles.feedbackText, feedbackIsChain && styles.feedbackTextChain]} numberOfLines={1} ellipsizeMode="tail">{feedbackMsg}</Text>
          </View>
        ) : activeTutorialId ? null : (
          <View style={styles.objectiveStrip}>
            <Text style={styles.objectiveText}>Goal: {objectiveStrip}</Text>
          </View>
        )}
        {activeTab === "actions" && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
            {state.temporaryActionIds.map((aid) => {
              const a = TEMP_ACTIONS[aid]; if (!a) return null;
              const preview = previewTempStatus(state, aid);
              const isLocked = preview.status === "locked";
              const selHero = state.team.find(h => h.id === state.selectedHeroId);
              const heroBlocked = !selHero || !!state.heroActionsUsed[selHero.id];
              const disabled = isLocked || state.ap < a.costAP || state.outcome !== "ongoing" || heroBlocked;
              const apBlocked = state.ap < a.costAP;
              return (
                <Pressable key={`tmp-${aid}`} style={[styles.actionBtn, { borderColor: statusColor(preview.status) }, disabled && styles.disabled, apBlocked && styles.apBlocked]} onPress={() => { if (!disabled) { handleTempAction(aid); return; } if (isLocked) { showBlockMsg("This action is locked."); return; } if (state.ap < a.costAP) { showBlockMsg("Not enough AP."); return; } showBlockMsg("Hero has already acted this turn."); }} onLongPress={() => disabled ? null : setDetail({ kind: "temp", actionId: aid })} delayLongPress={350} testID={`battle-temp-${aid}`}>
                  <StatusBadge status={preview.status} />
                  <View style={styles.actionHead}>
                    <Text style={[styles.actionName, { color: COLORS.brand }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{a.name}</Text>
                    <Text style={styles.apTag}>{a.costAP} AP</Text>
                  </View>
                  <Text style={styles.actionEffect} numberOfLines={2}>{a.shortEffect || a.description}</Text>
                  <Text style={styles.actionHero} numberOfLines={1}>Team · {a.systemType || "Universal"}</Text>
                </Pressable>
              );
            })}
            {(() => {
              const selHero = state.team.find(h => h.id === state.selectedHeroId);
              if (!selHero) return [<Text key="pick" style={styles.emptyTab}>Tap a hero above to select.</Text>];
              const acted = !!state.heroActionsUsed[selHero.id];
              if (acted) return [<Text key="acted" style={styles.emptyTab}>{selHero.name} has already acted.</Text>];
              const isBoss = (state.enemyClinical?.rewardBase || 0) >= 100;
              const careDmg = careAttemptDamage(state.chapter, isBoss);
              const careDisabled = state.ap < 1 || state.outcome !== "ongoing" || isFirstBattleActionStep;
              const careApBlocked = state.ap < 1;
              const careNode = (
                <Pressable key="care-attempt" style={[styles.actionBtn, { borderColor: COLORS.onSurfaceTertiary }, careDisabled && styles.disabled, careApBlocked && styles.apBlocked]} onPress={() => { if (guidedStep) { tutorialNudge(); return; } if (careDisabled) { showBlockMsg(state.ap < 1 ? "Not enough AP." : "Not available right now."); return; } setState(prev => applyCareAttempt(prev).state); triggerFx(selHero.id); }} testID="battle-care-attempt">
                  <View style={styles.basicTag}><Text style={styles.basicTagTxt}>BASIC</Text></View>
                  <View style={styles.actionHead}>
                    <Ionicons name="medkit-outline" size={14} color={COLORS.onSurfaceTertiary} style={styles.skillTypeIcon} />
                    <Text style={styles.actionName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Care Attempt</Text>
                    <Text style={styles.apTag}>1 AP</Text>
                  </View>
                  <Text style={styles.actionEffect} numberOfLines={2}>Unfocused aid · −{careDmg} Corruption.</Text>
                  <Text style={styles.actionHero} numberOfLines={1}>Fallback — targeted skills are stronger</Text>
                </Pressable>
              );
              const skillNodes = selHero.skills.map(skill => {
                const sageDisc = sageDiscount && skill.type === "scout" && skill.cost > 0;
                let cost = sageDisc ? Math.max(0, skill.cost - 1) : skill.cost;
                const airDisc = state.nextAirActionDiscount && skill.systemType === "Air";
                if (airDisc) cost = Math.max(1, cost - 1);
                const preview = previewSkillStatus(state, skill);
                const isLocked = preview.status === "locked";
                const isWrongType = isFirstBattleActionStep && skill.type !== guidedActionType;
                const disabled = isLocked || state.ap < cost || state.outcome !== "ongoing" || isWrongType;
                const apBlocked = state.ap < cost;
                const isGuidedSkill = guidedSkillId === skill.id ||
                  (isFirstBattleActionStep && skill.type === guidedActionType);
                return (
                  <Animated.View key={`${selHero.id}-${skill.id}`} style={[{ width: "48.5%" }, isGuidedSkill ? { transform: [{ scale: skillPulseAnim }] } : undefined]}>
                    <Pressable style={[styles.actionBtn, { width: "100%", borderColor: statusColor(preview.status) }, disabled && styles.disabled, apBlocked && styles.apBlocked, isGuidedSkill && styles.guidedHighlight]} onPress={() => { if (!disabled) { handleSkill(selHero, skill); return; } if (isWrongType) { tutorialNudge(); return; } if (isLocked) { showBlockMsg("This skill is locked for this battle."); return; } if (state.ap < cost) { showBlockMsg("Not enough AP for this skill."); return; } showBlockMsg(selHero.name + " has already acted this turn."); }} onLongPress={() => disabled ? null : setDetail({ kind: "skill", hero: selHero, skill })} delayLongPress={350} testID={`battle-skill-${skill.id}`}>
                      <StatusBadge status={preview.status} />
                      <View style={styles.actionHead}>
                        <Ionicons name={(SKILL_TYPE_ICONS[skill.type] || "ellipse-outline") as any} size={14} color={SKILL_CHAIN_COLOR[skill.type] || COLORS.onSurfaceTertiary} style={styles.skillTypeIcon} />
                        <Text style={styles.actionName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{skill.name}</Text>
                        <Text style={styles.apTag}>{cost} AP</Text>
                      </View>
                      <Text style={styles.actionEffect} numberOfLines={2}>{skill.shortEffect || skill.description}</Text>
                      <Text style={[styles.actionHero, { color: SKILL_CHAIN_COLOR[skill.type] || COLORS.onSurfaceTertiary }]} numberOfLines={1}>{sageDisc ? "Sage · " : ""}{airDisc ? "Air disc · " : ""}{SKILL_CHAIN_LABEL[skill.type] ? `${SKILL_CHAIN_LABEL[skill.type]} · ` : ""}{skill.systemType || "Universal"}</Text>
                    </Pressable>
                  </Animated.View>
                );
              });
              return [careNode, ...skillNodes];
            })()}
          </ScrollView>
        )}
        {activeTab === "items" && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
            {(() => {
              const selHero = state.team.find(h => h.id === state.selectedHeroId);
              if (!selHero) return <Text style={styles.emptyTab}>Tap a hero above first — items use the chosen hero's action.</Text>;
              if (state.heroActionsUsed[selHero.id]) return <Text style={styles.emptyTab}>{selHero.name} has already acted.</Text>;
              return null;
            })()}
            {ITEMS.map(item => {
              const qty = state.inventory[item.name] || 0;
              const preview = previewItemStatus(state, item);
              const isLocked = preview.status === "locked";
              const sel = state.team.find(h => h.id === state.selectedHeroId);
              const heroBlocked = !sel || !!state.heroActionsUsed[sel.id];
              const discounted = state.preparedItemDiscount === item.name;
              const cost = discounted ? Math.max(1, item.costAP - 1) : item.costAP;
              const disabled = isLocked || qty <= 0 || state.ap < cost || state.outcome !== "ongoing" || heroBlocked;
              const apBlocked = state.ap < cost;
              return (
                <Pressable key={item.id} style={[styles.actionBtn, { borderColor: statusColor(preview.status) }, disabled && styles.disabled, apBlocked && styles.apBlocked]} onPress={() => { if (!disabled) { handleUseItem(item); return; } if (isLocked) { showBlockMsg("This item is locked."); return; } if (qty <= 0) { showBlockMsg(item.displayName + " is out of stock."); return; } if (state.ap < cost) { showBlockMsg("Not enough AP."); return; } showBlockMsg("Hero has already acted this turn."); }} onLongPress={() => setDetail({ kind: "item", item })} delayLongPress={350} testID={`battle-item-${item.id}`}>
                  <StatusBadge status={preview.status} />
                  <View style={styles.actionHead}>
                    <Text style={styles.actionName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{item.displayName}</Text>
                    <Text style={styles.apTag}>×{qty}</Text>
                  </View>
                  <Text style={styles.actionEffect} numberOfLines={2}>{item.shortEffect}</Text>
                  <Text style={styles.actionHero} numberOfLines={1}>{discounted ? "Prepared · " : ""}{cost} AP</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        {activeTab === "cards" && (
          <>
            {/* First-time card tutorial modal */}
            <Modal visible={showCardTutorial} transparent animationType="fade" onRequestClose={() => {}}>
              <View style={styles.cardTutModalOverlay}>
                <View style={styles.cardTutModal}>
                  <View style={styles.cardTutHeader}>
                    <Ionicons name="card" size={22} color={COLORS.runeGold} />
                    <Text style={styles.cardTutTitle}>Battle Card Deck</Text>
                  </View>
                  <Text style={styles.cardTutBody}>
                    Cards are powerful one-use tools loaded before each battle in your Mission Loadout.
                  </Text>
                  <Text style={styles.cardTutBody}>
                    Cards marked <Text style={{ color: "#A6D8F6" }}>Scout</Text>, <Text style={{ color: "#4FD8C4" }}>Stabilize</Text>, <Text style={{ color: "#F97316" }}>Counter</Text>, or <Text style={{ color: "#BBA7EA" }}>Reassess</Text> count toward your clinical chain. <Text style={{ color: "#E8C868" }}>Support</Text> cards provide direct aid — shields, buffs, emergency calls — but do not advance the chain.
                  </Text>
                  <Text style={styles.cardTutBody}>
                    Once played, each card is spent for this battle. Choose your deck wisely in the loadout.
                  </Text>
                  <Pressable style={styles.cardTutBtn} onPress={() => { setShowCardTutorial(false); markCardTutorialSeen(); }}>
                    <Text style={styles.cardTutBtnTxt}>Understood</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
              {/* Hero-not-selected / already-acted guard */}
              {(() => {
                const selHero = state.team.find(h => h.id === state.selectedHeroId);
                if (!selHero) return <Text style={styles.emptyTab}>Tap a hero above first — skill cards use the chosen hero's action.</Text>;
                if (state.heroActionsUsed[selHero.id]) return <Text style={styles.emptyTab}>{selHero.name} has already acted.</Text>;
                return null;
              })()}

              {/* Empty hand (all limited-use cards spent) */}
              {state.hand.length === 0 && (
                <View style={styles.cardEmptyWrap}>
                  <Ionicons name="card-outline" size={28} color={COLORS.runeGold + "60"} />
                  <Text style={styles.cardEmptyTxt}>
                    {state.limitedCardMode
                      ? "All cards have been played this battle."
                      : "No cards available."}
                  </Text>
                </View>
              )}

              {/* Card hand */}
              {state.hand.map((cardId, idx) => {
                const card = getCard(cardId);
                if (!card) return null;
                const chainCfg = CHAIN_TYPE_CONFIG[card.cardChainType];
                const sel = state.team.find(h => h.id === state.selectedHeroId);
                const heroBlocked = !sel || !!state.heroActionsUsed[sel.id];
                const disabled = state.ap < card.costAP || state.outcome !== "ongoing" || heroBlocked;
                const apBlocked = state.ap < card.costAP;
                return (
                  <Pressable
                    key={`${cardId}-${idx}`}
                    style={[styles.actionBtn, { borderColor: chainCfg.color + "80" }, disabled && styles.disabled, apBlocked && styles.apBlocked]}
                    onPress={() => { if (!disabled) { handleCard(cardId); return; } if (state.ap < card.costAP) { showBlockMsg("Not enough AP for this card."); return; } showBlockMsg("Hero has already acted this turn."); }}
                    testID={`battle-card-${cardId}`}
                  >
                    {/* Chain-type badge */}
                    <View style={[styles.cardChainBadge, { backgroundColor: chainCfg.color + "22", borderColor: chainCfg.color + "55" }]}>
                      <Ionicons name={chainCfg.icon as any} size={10} color={chainCfg.color} />
                      <Text style={[styles.cardChainLabel, { color: chainCfg.color }]}>{chainCfg.label.toUpperCase()}</Text>
                    </View>

                    <View style={styles.actionHead}>
                      <Text style={styles.actionName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{card.name}</Text>
                      <Text style={styles.apTag}>{card.costAP} AP</Text>
                    </View>
                    <Text style={styles.actionEffect} numberOfLines={2}>{card.shortEffect}</Text>

                    <View style={styles.cardFooterRow}>
                      <Text style={styles.actionHero} numberOfLines={1}>{card.systemType || "Universal"}</Text>
                      <Text style={[styles.cardChainNote, { color: chainCfg.advancesChain ? "#4FD8C4" : COLORS.runeGold + "A0" }]}>
                        {chainCfg.advancesChain ? "Advances chain" : "Support only"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}

              {/* Limited-mode deck indicator */}
              {state.limitedCardMode && state.hand.length > 0 && (
                <View style={styles.cardDeckIndicator}>
                  <Ionicons name="layers-outline" size={12} color={COLORS.runeGold + "70"} />
                  <Text style={styles.cardDeckTxt}>
                    {state.cardDeck.length > 0
                      ? `${state.cardDeck.length} card${state.cardDeck.length > 1 ? "s" : ""} remaining in deck`
                      : "Last card in deck"}
                  </Text>
                </View>
              )}
            </ScrollView>
          </>
        )}
        {activeTab === "call" && (
          <>
            {/* First-time Call for Help tutorial modal */}
            <Modal visible={showCallTutorial} transparent animationType="fade" onRequestClose={() => {}}>
              <View style={styles.cardTutModalOverlay}>
                <View style={styles.cardTutModal}>
                  <View style={styles.cardTutHeader}>
                    <Ionicons name="call" size={22} color={COLORS.runeGold} />
                    <Text style={styles.cardTutTitle}>Call for Help</Text>
                  </View>
                  <Text style={styles.cardTutBody}>
                    Call for Help summons allied support teams based on your loaded heroes. Each hero family unlocks a different specialty — nursing, pharmacy, lab, rehab, and more.
                  </Text>
                  <Text style={styles.cardTutBody}>
                    You have <Text style={{ color: COLORS.runeGold, fontWeight: "700" }}>3 calls</Text> available per battle. Each individual call can only be made <Text style={{ color: "#A6D8F6", fontWeight: "700" }}>once</Text>.
                  </Text>
                  <Text style={styles.cardTutBody}>
                    Support may provide an item, a temporary skill, a clue, or stability recovery. If conditions aren't right or the right expert isn't available, the call may provide only weak or no help.
                  </Text>
                  <Pressable style={styles.cardTutBtn} onPress={() => { setShowCallTutorial(false); markCallTutorialSeen(); }}>
                    <Text style={styles.cardTutBtnTxt}>Understood</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>

            {/* Remaining calls banner */}
            <View style={styles.callRemainingBanner}>
              <Ionicons name="call-outline" size={13} color={state.callHelpRemaining > 0 ? "#A6D8F6" : COLORS.runeGold + "70"} />
              <Text style={[styles.callRemainingTxt, state.callHelpRemaining === 0 && styles.callRemainingExhausted]}>
                {state.callHelpRemaining > 0
                  ? `${state.callHelpRemaining} call${state.callHelpRemaining !== 1 ? "s" : ""} remaining this battle`
                  : "No calls remaining this battle"}
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
              {availableCalls.length === 0 && (
                <View style={styles.callEmptyState}>
                  <Ionicons name="people-outline" size={24} color={COLORS.runeGold + "60"} />
                  <Text style={styles.callEmptyTxt}>No support available for this team.</Text>
                  <Text style={styles.callEmptyHint}>Recruit heroes from Lifebreath, Wardborn, Remedybound, Truthseer, Restorebound, or Realmbound families to unlock more calls.</Text>
                </View>
              )}
              {availableCalls.map(opt => {
                const callKey: keyof BattleState["callsUsed"] | null =
                  opt.id === "call_pharmacy" ? "pharmacy" :
                  opt.id === "call_respiratory" ? "respiratory" :
                  opt.id === "call_rapid" ? "rapidResponse" :
                  opt.id === "call_infection" ? "infectionControl" :
                  opt.id === "call_lab" ? "lab" :
                  opt.id === "call_rehab" ? "rehab" :
                  opt.id === "call_social" ? "social" : null;
                const alreadyUsed = !!(callKey && state.callsUsed[callKey]);
                const preview = previewCallStatus(state, opt.id);
                const isLocked = preview.status === "locked";
                const rapidGated = opt.id === "call_rapid" && state.stability > 30 && !state.dangerTriggerActive;
                const budgetExhausted = state.callHelpRemaining <= 0;
                const disabled = isLocked || alreadyUsed || rapidGated || budgetExhausted || state.ap < opt.costAP || state.outcome !== "ongoing";
                const apBlocked = state.ap < opt.costAP;
                return (
                  <Pressable key={opt.id} style={[styles.actionBtn, { borderColor: statusColor(preview.status) }, disabled && styles.disabled, apBlocked && styles.apBlocked]} onPress={() => { if (!disabled) { handleCall(opt); return; } if (alreadyUsed) { showBlockMsg(opt.name + " has already been called this battle."); return; } if (rapidGated) { showBlockMsg("Rapid Response is reserved for Stability ≤ 30."); return; } if (budgetExhausted) { showBlockMsg("No calls remaining this battle."); return; } if (state.ap < opt.costAP) { showBlockMsg("Not enough AP."); return; } showBlockMsg(opt.name + " is locked."); }} onLongPress={() => setDetail({ kind: "call", option: opt })} delayLongPress={350} testID={`call-opt-${opt.id}`}>
                    <StatusBadge status={preview.status} />
                    <View style={styles.actionHead}>
                      <Text style={styles.actionName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{opt.name}</Text>
                      <Text style={styles.apTag}>{opt.costAP} AP</Text>
                    </View>
                    <Text style={styles.actionEffect} numberOfLines={2}>{opt.description}</Text>
                    <View style={styles.callSupportBadge}>
                      <Ionicons name="people-outline" size={10} color="#A6D8F6" />
                      <Text style={styles.callSupportLbl}>{opt.supportLabel}</Text>
                    </View>
                    {alreadyUsed && <Text style={styles.actionHero}>✓ Already called</Text>}
                    {rapidGated && !alreadyUsed && <Text style={styles.actionHero}>Reserved for Stability ≤ 30</Text>}
                    {budgetExhausted && !alreadyUsed && !rapidGated && <Text style={styles.actionHero}>No calls remaining</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Call result popup */}
            {callResult && (
              <View style={styles.callResultOverlay}>
                <View style={[styles.callResultCard, { borderColor: callResult.success ? "#4FD8C4" : COLORS.runeGold }]}>
                  <View style={styles.callResultHeader}>
                    <Ionicons name={callResult.success ? "checkmark-circle" : "alert-circle"} size={18} color={callResult.success ? "#4FD8C4" : COLORS.runeGold} />
                    <Text style={[styles.callResultTitle, { color: callResult.success ? "#4FD8C4" : COLORS.runeGold }]}>{callResult.title}</Text>
                  </View>
                  <Text style={styles.callResultDetail}>{callResult.detail}</Text>
                  <Pressable style={styles.callResultDismiss} onPress={() => setCallResult(null)}>
                    <Text style={styles.callResultDismissTxt}>OK</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}
        {activeTab === "team" && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.teamList}>
              {team.map(h => {
                const c = ELEMENT_COLORS[h.element];
                return (
                  <View key={h.id} style={[styles.teamCard, { borderLeftColor: c }]} testID={`team-${h.id}`}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teamName}>{h.name}</Text>
                      <Text style={styles.teamRole}>{h.role} · {h.element}</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 1 }}>
                      {Array.from({ length: h.star ?? 1 }).map((_, i) => (
                        <Ionicons key={i} name="star" size={10} color={COLORS.brand} />
                      ))}
                    </View>
                  </View>
                );
              })}
              {player?.aptitude && (
                <View style={styles.passiveCard}>
                  <Text style={styles.passiveLbl}>YOUR APTITUDE PASSIVE</Text>
                  <Text style={styles.passiveTxt}>
                    {player.aptitude === "guardian" && "🛡 Guardian's Vigil: -5 damage per enemy turn."}
                    {player.aptitude === "sage" && "🔍 Sage's Eye: first Scout each battle costs -1 AP."}
                    {player.aptitude === "warden" && "🔒 Warden's Watch: blocks one minor complication."}
                    {player.aptitude === "weaver" && "⟡ Weaver's Eye: one hidden clue revealed at battle start."}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>

      {detail && (
        <Pressable style={styles.modalOverlay} onPress={() => setDetail(null)}>
          <Pressable style={styles.detailModal} onPress={(e) => e.stopPropagation()}>
            <DetailContent detail={detail} state={state} onUse={() => {
              if (detail.kind === "skill") handleSkill(detail.hero, detail.skill);
              else if (detail.kind === "temp") handleTempAction(detail.actionId);
              else if (detail.kind === "item") handleUseItem(detail.item);
              else if (detail.kind === "call") handleCall(detail.option);
            }} />
            <Pressable style={styles.modalDismiss} onPress={() => setDetail(null)} testID="detail-cancel">
              <Text style={styles.modalDismissTxt}>CLOSE</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}

      {state.pendingCue && !cueFeedback && state.outcome === "ongoing" && (activeTutorialId !== "prologueBattle" || guidedCueStep) && (
        <View style={[styles.modalOverlay, styles.cueModalOverlay]}>
          <ScrollView style={styles.cueModal} contentContainerStyle={styles.cueModalContent} showsVerticalScrollIndicator={false} testID="clinical-cue-modal">
            <Text style={styles.cueKicker}>CLINICAL CUE</Text>
            <Text style={styles.cueTierTopic}>
              Tier {CUE_TIER_NUMBER[state.pendingCue.tier]} · {CUE_TIER_LABELS[state.pendingCue.tier]} · {CUE_TOPIC_LABELS[state.pendingCue.topic]}
            </Text>
            <Text style={styles.cuePrompt}>{state.pendingCue.prompt}</Text>
            {state.pendingCue.options.map((opt, idx) => (
              <Pressable key={idx} style={styles.cueOption} onPress={() => handleCueAnswer(idx)} testID={`cue-option-${idx}`}>
                <Text style={styles.cueOptionTxt}>{opt.text}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {cueFeedback && (
        <View style={styles.cueFeedbackWrap}>
          <ScrollView style={styles.cueFeedbackCard} contentContainerStyle={{ paddingBottom: 4 }} testID="clinical-cue-feedback">
            <Text style={[styles.cueKicker, { color: cueFeedback.isCorrect ? COLORS.success : COLORS.error }]}>
              {cueFeedback.isCorrect ? "✓ CORRECT" : "✗ NOT QUITE"}
            </Text>
            <Text style={styles.cueTierTopic}>
              Tier {CUE_TIER_NUMBER[cueFeedback.cue.tier]} · {CUE_TIER_LABELS[cueFeedback.cue.tier]} · {CUE_TOPIC_LABELS[cueFeedback.cue.topic]}
            </Text>
            <Text style={styles.cuePrompt}>{cueFeedback.cue.prompt}</Text>
            {cueFeedback.cue.options.map((opt, idx) => {
              const isRight = opt.correct;
              const isChosenWrong = idx === cueFeedback.chosenIndex && !opt.correct;
              return (
                <View
                  key={idx}
                  style={[
                    styles.cueOption,
                    isRight && styles.cueOptionCorrect,
                    isChosenWrong && styles.cueOptionWrong,
                  ]}
                >
                  <Text style={styles.cueOptionTxt}>
                    {isRight ? "✓ " : isChosenWrong ? "✗ " : ""}{opt.text}
                  </Text>
                </View>
              );
            })}
            {!cueFeedback.isCorrect && (
              <View style={styles.cueRationaleBox}>
                <Text style={styles.cueRationaleLabel}>BEST ANSWER</Text>
                <Text style={styles.cueRationaleTxt}>
                  {cueFeedback.cue.options.find((o) => o.correct)?.text}
                </Text>
              </View>
            )}
            <View style={styles.cueRationaleBox}>
              <Text style={styles.cueRationaleLabel}>WHY IT MATTERS</Text>
              <Text style={styles.cueRationaleTxt}>{cueFeedback.cue.rationale}</Text>
            </View>
            <View style={styles.cueRationaleBox}>
              <Text style={styles.cueRationaleLabel}>BATTLE TRANSLATION</Text>
              <Text style={styles.cueRationaleTxt}>{cueFeedback.cue.battleTranslation}</Text>
            </View>
            {cueFeedback.cue.learnerNote && (
              <View style={styles.cueRationaleBox}>
                <Text style={styles.cueRationaleLabel}>CLINICAL LEARNER NOTE</Text>
                <Text style={styles.cueRationaleTxt}>{cueFeedback.cue.learnerNote}</Text>
              </View>
            )}
            <View style={styles.cueRewardBox}>
              <Text style={styles.cueRewardLabel}>{cueFeedback.isCorrect ? "REWARD" : "MISSED BONUS"}</Text>
              {cueFeedback.isCorrect ? (
                <>
                  <Text style={styles.cueRewardTxt}>⚡ +1 Action Point</Text>
                  <Text style={styles.cueRewardTxt}>✚ All stabilizing actions this turn empowered (+8)</Text>
                  <Text style={styles.cueRewardTxt}>★ +15 Ultimate charge</Text>
                  <Text style={styles.cueRewardTxt}>❖ {CUE_TOPIC_LABELS[cueFeedback.cue.topic]} bonus applied</Text>
                </>
              ) : (
                <Text style={styles.cueRewardTxt}>Answer clinical cues correctly to earn AP, stabilize boosts, ultimate charge, and a topic-flavored bonus.</Text>
              )}
            </View>
            <Pressable style={styles.cueContinueBtn} onPress={dismissCueFeedback} testID="cue-continue">
              <Text style={styles.cueContinueTxt}>CONTINUE</Text>
            </Pressable>
            <Text style={styles.cueAutoHint}>Auto-continues in 3s</Text>
          </ScrollView>
        </View>
      )}

      {timingSkill && (
        <View style={styles.modalOverlay}>
          <View style={styles.timingModal} testID="perfect-cast-modal">
            <Text style={styles.cueKicker}>PERFECT CAST</Text>
            <Text style={styles.cuePrompt}>{timingSkill.skill.name} — tap when the marker hits the gold zone!</Text>
            <View style={styles.timingTrack}>
              <View style={styles.timingPerfectZone} />
              <View style={[styles.timingMarker, { left: `${timingProgress}%` }]} />
            </View>
            <Pressable style={styles.timingTapBtn} onPress={stopTimingAndCast} testID="timing-tap-button">
              <Text style={styles.timingTapTxt}>TAP!</Text>
            </Pressable>
            <Pressable style={styles.modalDismiss} onPress={skipTiming} testID="timing-skip">
              <Text style={styles.modalDismissTxt}>SKIP (Normal Cast)</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Tutorial overlay renders after the cue modals so its guided banner sits above them. */}
      <TutorialOverlay />

      {/* ── firstBattle cinematic message (story beat feedback) ──────────────
          zIndex 9200 sits above TutorialOverlay (≈9000) so the message is
          legible against the tutorial scrim. pointerEvents none so it never
          blocks button taps. Cleared by state.outcome cleanup before the
          outcome modal renders. */}
      {cinematicText !== null && (
        <Animated.View
          pointerEvents="none"
          style={[styles.cinematicOverlay, { opacity: cinematicFadeAnim }]}
        >
          <View style={[
            styles.cinematicCard,
            cinematicSeverity === "positive" && styles.cinematicPositive,
            cinematicSeverity === "warning"  && styles.cinematicWarning,
            cinematicSeverity === "danger"   && styles.cinematicDanger,
          ]}>
            <Text style={styles.cinematicMsgTxt}>{cinematicText}</Text>
          </View>
        </Animated.View>
      )}
      {/* Brief tinted flash for protect / hit moments — always rendered so the
          Animated.Value can drive it; invisible at opacity 0. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.cinematicFlash, { backgroundColor: flashColor, opacity: flashFadeAnim }]}
      />

      {state.outcome !== "ongoing" && isPrologueBoss && (
        <View style={styles.bossCollapseOverlay}>
          <SceneTransition duration={900} style={styles.bossCollapseInner}>
            <SystemPanel icon="pulse-outline" label="WARD ALARM · CRITICAL" accent={COLORS.error}>
              <Text style={styles.bossCollapseTitle}>The patient could not be saved.</Text>
              <Text style={styles.bossCollapseBody}>
                {enemy.dangerTrigger}. No skill in your hands could have turned this
                back — the readings were never yours to trust.
              </Text>
              <Text style={styles.bossCollapseBody}>
                And then, in the silence after, something answers. A voice that
                should not be there. It knows your name.
              </Text>
            </SystemPanel>
            <Pressable style={styles.bossCollapseBtn} onPress={finish} testID="battle-finish">
              <Ionicons name="sparkles" size={16} color={COLORS.onBrand} />
              <Text style={styles.bossCollapseBtnTxt}>ANSWER IT</Text>
            </Pressable>
          </SceneTransition>
        </View>
      )}

      {state.outcome !== "ongoing" && !isPrologueBoss && activeTutorialId !== "prologueBattle" && !isFirstBattleLoss.current && (
        <View style={styles.modalOverlay}>
          <View style={styles.outcomeModal}>
            <Ionicons name={state.outcome === "win" ? "shield-checkmark" : "alert-circle"} size={48} color={state.outcome === "win" ? COLORS.success : COLORS.error} />
            <Text style={styles.modalTitle}>{state.outcome === "win" ? "Purified" : "Patient Lost"}</Text>
            <Text style={styles.modalSub}>
              {state.outcome === "win"
                ? `Stability held at ${state.stability}%. Codex pages restored.${isTraining ? " (Training rewards reduced.)" : ""}`
                : `${enemy.dangerTrigger}. The Codex whispers — review the lesson and try again.`}
            </Text>
            <Pressable style={styles.continueBtn} onPress={finish} testID="battle-finish">
              <Text style={styles.continueBtnTxt}>CONTINUE</Text>
            </Pressable>
          </View>
        </View>
      )}

      {glossaryOpen && <BattleGlossaryModal onClose={() => setGlossaryOpen(false)} />}
      {showObjective && (
        <BattleObjectiveModal
          isPrologueBoss={isPrologueBoss}
          isBossEnemy={isBossEnemy}
          isTraining={isTraining}
          isPrologueTutorial={isPrologueTutorial}
          enemyName={enemy.name}
          onDismiss={() => setShowObjective(false)}
        />
      )}
    </SafeAreaView>
  );
}

function DetailContent({ detail, state, onUse }: { detail: DetailEntry; state: BattleState; onUse: () => void }) {
  if (detail.kind === "skill") {
    const { hero, skill } = detail;
    return (
      <>
        <Text style={styles.detailKicker}>{(skill.systemType || "Universal").toUpperCase()} · {skill.type.toUpperCase()} · {skill.cost} AP</Text>
        <Text style={styles.detailTitle}>{skill.name}</Text>
        <Text style={styles.detailHero}>{hero.name}</Text>
        {skill.rpgDescription && (<>
          <Text style={styles.detailSection}>RPG Effect</Text>
          <Text style={styles.detailBody}>{skill.rpgDescription}</Text>
        </>)}
        <Text style={styles.detailSection}>Battle Effect</Text>
        <Text style={styles.detailBody}>{skill.shortEffect || skill.description}</Text>
        {skill.beginnerExplanation && (<>
          <Text style={styles.detailSection}>Real-Life Nursing</Text>
          <Text style={styles.detailBody}>{skill.beginnerExplanation}</Text>
        </>)}
        {skill.nclexExplanation && (<>
          <Text style={styles.detailSection}>NCLEX Focus</Text>
          <Text style={styles.detailBody}>{skill.nclexExplanation}</Text>
        </>)}
        <Pressable style={styles.useBtn} onPress={onUse} testID="detail-use" disabled={state.ap < skill.cost}>
          <Text style={styles.useBtnTxt}>USE · {skill.cost} AP</Text>
        </Pressable>
      </>
    );
  }
  if (detail.kind === "temp") {
    const a = TEMP_ACTIONS[detail.actionId];
    return (
      <>
        <Text style={styles.detailKicker}>TEAM SUPPORT · {a.costAP} AP</Text>
        <Text style={styles.detailTitle}>{a.name}</Text>
        <Text style={styles.detailSection}>Battle Effect</Text>
        <Text style={styles.detailBody}>{a.description}</Text>
        <Pressable style={styles.useBtn} onPress={onUse} testID="detail-use" disabled={state.ap < a.costAP}>
          <Text style={styles.useBtnTxt}>USE · {a.costAP} AP</Text>
        </Pressable>
      </>
    );
  }
  if (detail.kind === "item") {
    const { item } = detail;
    const qty = state.inventory[item.name] || 0;
    return (
      <>
        <Text style={styles.detailKicker}>{item.rpgSubtitle.toUpperCase()} · {item.costAP} AP · ×{qty}</Text>
        <Text style={styles.detailTitle}>{item.displayName}</Text>
        <Text style={styles.detailSection}>Battle Effect</Text>
        <Text style={styles.detailBody}>{item.shortEffect}</Text>
        <Text style={styles.detailSection}>Real-Life Nursing</Text>
        <Text style={styles.detailBody}>{item.beginnerExplanation}</Text>
        <Text style={styles.detailSection}>NCLEX Focus</Text>
        <Text style={styles.detailBody}>{item.clinicalExplanation}</Text>
        <Pressable style={styles.useBtn} onPress={onUse} testID="detail-use" disabled={qty <= 0 || state.ap < item.costAP}>
          <Text style={styles.useBtnTxt}>USE · {item.costAP} AP</Text>
        </Pressable>
      </>
    );
  }
  if (detail.kind === "call") {
    const { option } = detail;
    return (
      <>
        <Text style={styles.detailKicker}>SUPPORT CALL · {option.costAP} AP · 1 USE PER BATTLE</Text>
        <Text style={styles.detailTitle}>{option.name}</Text>
        <Text style={styles.detailSection}>Battle Effect</Text>
        <Text style={styles.detailBody}>{option.description}</Text>
        <Pressable style={styles.useBtn} onPress={onUse} testID="detail-use" disabled={state.ap < option.costAP || state.callUsed}>
          <Text style={styles.useBtnTxt}>CALL · {option.costAP} AP</Text>
        </Pressable>
      </>
    );
  }
  return null;
}

function StatusBadge({ status }: { status: ActionStatus }) {
  if (status === "appropriate") return null;
  const color = statusColor(status);
  const label = statusLabel(status);
  return (
    <View style={[styles.statusBadge, { backgroundColor: color + "26", borderColor: color }]}>
      <Text style={[styles.statusBadgeTxt, { color }]} numberOfLines={1}>{label.toUpperCase()}</Text>
    </View>
  );
}

// ── Skill-type icon map ───────────────────────────────────────────────────────

const SKILL_TYPE_ICONS: Record<string, string> = {
  scout:     "eye-outline",
  stabilize: "heart-outline",
  strike:    "flash-outline",
  analyze:   "refresh-circle-outline",
  shield:    "shield-outline",
  support:   "people-outline",
  command:   "megaphone-outline",
  cleanse:   "water-outline",
};

const SKILL_CHAIN_COLOR: Record<string, string> = {
  scout:     "#5ECBC8",
  stabilize: "#6EE7B7",
  strike:    "#FBA94C",
  analyze:   "#A78BFA",
  shield:    "#94A3B8",
  support:   "#34D399",
  command:   "#F472B6",
  cleanse:   "#60A5FA",
};

const SKILL_CHAIN_LABEL: Record<string, string> = {
  scout:     "Scout",
  stabilize: "Stabilize",
  strike:    "Counter",
  analyze:   "Reassess",
  shield:    "Protect",
  support:   "Support",
  command:   "Command",
  cleanse:   "Treat",
};

// ── Battle Glossary ──────────────────────────────────────────────────────────

const BATTLE_GLOSSARY: { term: string; desc: string }[] = [
  { term: "Stability", desc: "How safely the patient is holding on. Keep it above zero — the enemy attacks it every turn. If it hits 0, the patient is lost." },
  { term: "Corruption", desc: "How much the illness is still taking over. Lower it to zero to win. Some illnesses can spread, recover, or behave in unexpected ways." },
  { term: "Cue", desc: "A clue about what is wrong with the patient. Answer correctly for bonus AP." },
  { term: "Scout", desc: "Find a hidden clue. Reveal clues before high-cost moves." },
  { term: "Stabilize", desc: "Keep the patient safe and hold off deterioration." },
  { term: "Counter", desc: "Directly weaken the illness and lower Corruption." },
  { term: "Reassess", desc: "Check what changed — often reveals new information." },
];

// ── Care Chain Rhythm Strip ───────────────────────────────────────────────────

interface StripStep {
  label: string;
  role: ChainRole;
  icon: string;
  color: string;
}

const STRIP_STEPS: StripStep[] = [
  { label: "Scout",     role: "Scout",     icon: "eye-outline",             color: "#5ECBC8" },
  { label: "Stabilize", role: "Stabilize", icon: "heart-outline",           color: "#6EE7B7" },
  { label: "Counter",   role: "Counter",   icon: "flash-outline",           color: "#FBA94C" },
  { label: "Reassess",  role: "Reassess",  icon: "refresh-circle-outline",  color: "#A78BFA" },
];

const STRIP_TUTORIAL_STEP: Record<string, number> = {
  prologue_scout:     0,
  prologue_stabilize: 1,
  prologue_counter:   2,
  prologue_reassess:  3,
  // firstBattle guided rehearsal — same four positions
  fb_scout:           0,
  fb_stabilize:       1,
  fb_counter:         2,
  fb_reassess:        3,
  // fb_done: index 4 means all four steps show as completed checkmarks
  fb_done:            4,
};

function CareChainStrip({ chain, isTutorial, currentStepId }: {
  chain: BattleState["chain"];
  isTutorial: boolean;
  currentStepId: string | undefined;
}) {
  const activeIdx = isTutorial ? (STRIP_TUTORIAL_STEP[currentStepId ?? ""] ?? -1) : -1;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (activeIdx >= 0 && activeIdx < STRIP_STEPS.length) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 500, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => { loop.stop(); pulseAnim.setValue(1); };
    } else {
      pulseAnim.setValue(1);
    }
  }, [activeIdx, pulseAnim]);

  return (
    <View style={styles.stripRow}>
      {STRIP_STEPS.map((step, idx) => {
        const done = isTutorial && activeIdx >= 0
          ? idx < activeIdx
          : chain.progress.includes(step.role);
        const isActive = idx === activeIdx;
        return (
          <View key={step.label} style={styles.stripCell}>
            {idx > 0 && (
              <Ionicons name="chevron-forward" size={9} color={COLORS.divider} style={styles.stripArrow} />
            )}
            <Animated.View style={[
              styles.stripStep,
              done      && styles.stripStepDone,
              isActive  && { ...styles.stripStepActive, borderColor: step.color },
              isActive  && { transform: [{ scale: pulseAnim }] },
            ]}>
              {done ? (
                <Ionicons name="checkmark-circle" size={13} color={COLORS.success} />
              ) : (
                <Ionicons name={step.icon as any} size={13} color={isActive ? step.color : COLORS.onSurfaceTertiary} />
              )}
              <Text style={[
                styles.stripLabel,
                done      && styles.stripLabelDone,
                isActive  && { color: step.color, fontWeight: "700" },
              ]}>
                {step.label}
              </Text>
            </Animated.View>
          </View>
        );
      })}
    </View>
  );
}

// ── Pre-battle Objective Popup ────────────────────────────────────────────────

interface ObjData {
  badge: string; badgeColor: string; badgeIcon: string;
  title: string;
  bullets: { icon: string; text: string }[];
  note?: string;
  btnLabel: string;
}
function getBattleObjData(
  isPrologueBoss: boolean, isBossEnemy: boolean,
  isTraining: boolean, isPrologueTutorial: boolean, enemyName: string,
): ObjData {
  if (isPrologueBoss) return {
    badge: "STORY ENCOUNTER", badgeColor: "#F59E0B", badgeIcon: "book-outline",
    title: "Follow the Healer's Rhythm",
    bullets: [
      { icon: "list-outline",               text: "Use Scout → Stabilize → Counter → Reassess in sequence" },
      { icon: "information-circle-outline", text: "This is a story moment — it is not meant to be won" },
      { icon: "star-outline",               text: "Lotus Recall will trigger when the time comes" },
    ],
    note: "Protection skills do not prevent the narrative outcome of this encounter.",
    btnLabel: "I UNDERSTAND",
  };
  if (isPrologueTutorial) return {
    badge: "TRAINING BATTLE", badgeColor: "#5ECBC8", badgeIcon: "school-outline",
    title: "Learning the Ward",
    bullets: [
      { icon: "trending-down-outline", text: "Win: Lower Corruption to 0 using the clinical chain" },
      { icon: "heart-outline",         text: "Lose: Stability reaches 0 — keep the patient holding on" },
      { icon: "person-outline",        text: "Follow Master Bai's guidance step by step" },
    ],
    btnLabel: "LET'S BEGIN",
  };
  if (isBossEnemy) return {
    badge: "BOSS ENCOUNTER", badgeColor: "#FBA94C", badgeIcon: "warning-outline",
    title: enemyName,
    bullets: [
      { icon: "trending-down-outline", text: "Win: Lower Corruption to 0" },
      { icon: "heart-outline",         text: "Lose: Stability reaches 0 — the patient is lost" },
      { icon: "shield-outline",        text: "Some boss effects may bypass Protection" },
    ],
    note: "Scout and Reassess may reveal hidden attack patterns.",
    btnLabel: "ENTER BATTLE",
  };
  if (isTraining) return {
    badge: "TRAINING", badgeColor: "#94A3B8", badgeIcon: "fitness-outline",
    title: "Practice Round",
    bullets: [
      { icon: "trending-down-outline", text: "Win: Lower Corruption to 0" },
      { icon: "heart-outline",         text: "Lose: Stability reaches 0" },
      { icon: "ribbon-outline",        text: "Reduced XP and rewards — no pressure" },
    ],
    btnLabel: "BEGIN TRAINING",
  };
  return {
    badge: "WARD ENCOUNTER", badgeColor: "#5ECBC8", badgeIcon: "medical-outline",
    title: enemyName,
    bullets: [
      { icon: "trending-down-outline", text: "Win: Lower Corruption to 0" },
      { icon: "heart-outline",         text: "Lose: Stability reaches 0 — the patient is lost" },
      { icon: "git-branch-outline",    text: "Build the Care Chain: Scout → Stabilize → Counter → Reassess" },
    ],
    btnLabel: "BEGIN",
  };
}

function BattleObjectiveModal(props: {
  isPrologueBoss: boolean; isBossEnemy: boolean;
  isTraining: boolean; isPrologueTutorial: boolean;
  enemyName: string; onDismiss: () => void;
}) {
  const d = getBattleObjData(
    props.isPrologueBoss, props.isBossEnemy,
    props.isTraining, props.isPrologueTutorial, props.enemyName,
  );
  return (
    <Pressable style={styles.objOverlay} onPress={props.onDismiss} testID="objective-overlay">
      <Pressable style={styles.objCard} onPress={(e) => e.stopPropagation()} testID="objective-modal">
        <View style={styles.objBadgeRow}>
          <Ionicons name={d.badgeIcon as any} size={13} color={d.badgeColor} />
          <Text style={[styles.objBadge, { color: d.badgeColor }]}>{d.badge}</Text>
        </View>
        <Text style={styles.objTitle}>{d.title}</Text>
        <View style={styles.objBullets}>
          {d.bullets.map((b, i) => (
            <View key={i} style={styles.objBulletRow}>
              <Ionicons name={b.icon as any} size={14} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.objBulletTxt}>{b.text}</Text>
            </View>
          ))}
        </View>
        {d.note && <Text style={styles.objNote}>{d.note}</Text>}
        <Pressable style={[styles.objBeginBtn, { backgroundColor: d.badgeColor }]} onPress={props.onDismiss} testID="objective-begin">
          <Text style={styles.objBeginTxt}>{d.btnLabel}</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

function BattleGlossaryModal({ onClose }: { onClose: () => void }) {
  return (
    <Pressable style={styles.glossaryOverlay} onPress={onClose} testID="glossary-overlay">
      <Pressable style={styles.glossarySheet} onPress={(e) => e.stopPropagation()} testID="battle-glossary-modal">
        <View style={styles.glossaryHeader}>
          <Ionicons name="help-circle" size={15} color={COLORS.brand} />
          <Text style={styles.glossaryTitle}>BATTLE TERMS</Text>
          <Pressable onPress={onClose} hitSlop={12} testID="glossary-close">
            <Ionicons name="close" size={18} color={COLORS.onSurfaceSecondary} />
          </Pressable>
        </View>
        {BATTLE_GLOSSARY.map((entry, idx) => (
          <View key={entry.term} style={[styles.glossaryRow, idx === BATTLE_GLOSSARY.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={styles.glossaryTerm}>{entry.term}</Text>
            <Text style={styles.glossaryDesc}>{entry.desc}</Text>
          </View>
        ))}
        <Text style={styles.glossaryHint}>Long-press any action button for full skill details.</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },

  // ── Zone A: Enemy header ──
  zoneA: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surfaceSecondary,
  },
  closeBtn: { position: "absolute", right: SPACING.xs, top: SPACING.xs, padding: 8, zIndex: 2 },
  helpBtn: { position: "absolute", right: SPACING.xs + 32, top: SPACING.xs, padding: 8, zIndex: 2 },
  enemyHeaderRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingRight: 68 },
  enemyKicker: { color: COLORS.error, fontSize: 12, letterSpacing: 0.5, fontWeight: "700" },
  trainingTag: { backgroundColor: COLORS.brandTertiary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: RADIUS.pill },
  trainingTxt: { color: COLORS.brand, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  systemWarningBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.error + "18", borderWidth: 1, borderColor: COLORS.error + "50", borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 },
  systemWarningTxt: { color: COLORS.error, fontSize: 13, fontWeight: "700", letterSpacing: 0.3, flex: 1 },
  enemyName: { color: COLORS.onSurface, fontSize: 16, fontWeight: "300", lineHeight: 18 },
  systemPills: { flexDirection: "row", gap: 4, marginTop: 2, flexWrap: "wrap" },
  sysPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.pill, borderWidth: 1 },
  sysTxt: { fontSize: 11, letterSpacing: 0.3, fontWeight: "700" },
  waveRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, flexWrap: "wrap" },
  waveLabel: { color: COLORS.onSurfaceTertiary, fontSize: 11, letterSpacing: 0.5, fontWeight: "700" },
  wavePip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceSecondary },
  wavePipActive: { borderColor: COLORS.error, backgroundColor: COLORS.error + "20" },
  wavePipDefeated: { borderColor: COLORS.success, backgroundColor: COLORS.success + "18", opacity: 0.6 },
  wavePipTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: "700" },

  // ── Zone B: Meters + Codex + Clues ──
  zoneB: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xs,
    gap: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  barRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  barLabel: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 0.2, fontWeight: "700", width: 64 },
  barBg: { flex: 1, height: 8, backgroundColor: COLORS.surfaceTertiary, borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2 },
  barVal: { color: COLORS.onSurface, fontSize: 12, fontWeight: "600", width: 40, textAlign: "right" },
  codexCard: {
    backgroundColor: COLORS.brand + "18", borderRadius: 4,
    borderWidth: 1, borderColor: COLORS.brand + "50",
    borderLeftWidth: 3, borderLeftColor: COLORS.brand,
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  codexLabel: { color: COLORS.brand, fontSize: 12, fontWeight: "700", letterSpacing: 0.2, flex: 1, lineHeight: 17 },
  codexText: { color: COLORS.onSurfaceSecondary, fontWeight: "400", fontSize: 12 },
  clueRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, paddingVertical: 2 },
  clue: { flex: 1, minWidth: 80, maxWidth: 140, height: 58, padding: SPACING.xs, borderRadius: 4, borderWidth: 1, gap: 2, backgroundColor: COLORS.surface },
  clueVisible: { borderColor: COLORS.brand + "80", borderTopWidth: 2, borderTopColor: COLORS.brand + "CC" },
  clueHidden: { borderColor: COLORS.borderStrong, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  clueLabel: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  clueDetail: { color: COLORS.onSurfaceTertiary, fontSize: 13, lineHeight: 19 },

  // ── Zone C: Team + AP + Tabs ──
  zoneC: {
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    backgroundColor: COLORS.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.xs,
  },
  heroRow: { flexDirection: "row", gap: 5 },
  heroPill: { paddingHorizontal: 5, paddingVertical: 5, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceTertiary, alignItems: "center", overflow: "hidden" },
  heroPillActed: { opacity: 0.45 },
  heroPillName: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700" },
  heroPillRole: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, marginTop: 1 },
  apRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  apLabel: { color: COLORS.onSurfaceTertiary, fontSize: 11, letterSpacing: 0.3, fontWeight: "700" },
  apDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.borderStrong },
  apDotOn: { backgroundColor: COLORS.runeGold, borderColor: COLORS.runeGold },
  apDotBonus: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  endBtn: { marginLeft: "auto", paddingHorizontal: 11, paddingVertical: 4, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.borderStrong },
  endTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, letterSpacing: 0.3, fontWeight: "700" },
  tabs: { flexDirection: "row", gap: 4 },
  tab: { flex: 1, paddingVertical: 5, alignItems: "center", borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceTertiary },
  tabActive: { backgroundColor: COLORS.brand },
  tabTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  tabTxtActive: { color: COLORS.onBrand },
  affordanceHint: { color: COLORS.onSurfaceTertiary, fontSize: 12, textAlign: "center", fontStyle: "italic", letterSpacing: 0.2 },

  // ── Zone D: Actions ──
  zoneD: { flex: 1, paddingHorizontal: SPACING.sm, paddingTop: SPACING.sm, overflow: "hidden" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, paddingBottom: SPACING.sm },
  actionBtn: {
    width: "48.5%", minHeight: 80, padding: 10, borderRadius: 6,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderStrong, gap: 3,
  },
  disabled: { opacity: 0.4 },
  apBlocked: { opacity: 0.45 },
  actionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  actionName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600", flex: 1 },
  actionEffect: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18 },
  actionHero: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2, fontStyle: "italic" },
  apTag: { color: COLORS.brand, fontSize: 12, fontWeight: "700", marginLeft: 4 },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, borderWidth: 1, marginBottom: 2, maxWidth: "100%" },
  statusBadgeTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  basicTag: { alignSelf: "flex-start", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, borderWidth: 1, borderColor: COLORS.onSurfaceTertiary, backgroundColor: COLORS.onSurfaceTertiary + "20", marginBottom: 2 },
  basicTagTxt: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2, color: COLORS.onSurfaceTertiary },
  emptyTab: { color: COLORS.onSurfaceTertiary, fontSize: 12, textAlign: "center", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, width: "100%" },

  teamList: { gap: SPACING.sm, paddingBottom: SPACING.sm },
  teamCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surfaceTertiary, padding: SPACING.sm, borderRadius: RADIUS.md, borderLeftWidth: 4, borderWidth: 1, borderColor: COLORS.border },
  teamName: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  teamRole: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  passiveCard: { backgroundColor: COLORS.brand + "12", borderRadius: RADIUS.md, padding: SPACING.sm, borderColor: COLORS.brand + "40", borderWidth: 1, marginTop: SPACING.sm },
  passiveLbl: { color: COLORS.brand, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  passiveTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, marginTop: 4, lineHeight: 19 },
  helpTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, textAlign: "center", padding: SPACING.md, fontStyle: "italic" },

  // ── Modals ──
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  // On web, the guided TutorialOverlay action layer sits at zIndex 9000; without
  // an explicit zIndex the cue-question modal renders beneath it and swallows all
  // clicks (works on native because JSX paint order wins). Match the feedback card.
  cueModalOverlay: { zIndex: 9500 },
  detailModal: { backgroundColor: COLORS.surfaceSecondary, borderRadius: 8, padding: SPACING.lg, gap: 6, borderWidth: 1, borderColor: COLORS.brand + "50", width: "100%", maxWidth: 380, maxHeight: "80%" },
  detailKicker: { color: COLORS.brand, fontSize: 12, letterSpacing: 0.5, fontWeight: "700" },
  detailTitle: { color: COLORS.onSurface, fontSize: 22, fontWeight: "400", marginBottom: 2 },
  detailHero: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontStyle: "italic", marginBottom: 6 },
  detailSection: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 0.3, fontWeight: "700", marginTop: 8 },
  detailBody: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21 },
  useBtn: { backgroundColor: COLORS.brand, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center", marginTop: SPACING.md },
  useBtnTxt: { color: COLORS.onBrand, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  modalDismiss: { padding: SPACING.sm, alignItems: "center", marginTop: 4 },
  modalDismissTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  outcomeModal: { backgroundColor: COLORS.surfaceSecondary, borderRadius: 8, padding: SPACING.xl, alignItems: "center", gap: SPACING.md, borderWidth: 1, borderColor: COLORS.brand + "60", width: "100%", maxWidth: 380 },
  modalTitle: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300" },
  modalSub: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: "center", lineHeight: 19 },
  continueBtn: { backgroundColor: COLORS.brand, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.pill, marginTop: SPACING.sm },
  continueBtnTxt: { color: COLORS.onBrand, fontSize: 12, fontWeight: "700", letterSpacing: 2 },

  // ── Prologue boss scripted-collapse cinematic overlay ──
  bossCollapseOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.94)", alignItems: "center", justifyContent: "center", padding: SPACING.lg, zIndex: 9600 },
  bossCollapseInner: { width: "100%", maxWidth: 400, alignItems: "center", gap: SPACING.lg },
  bossCollapseTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: "400", lineHeight: 26 },
  bossCollapseBody: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20 },
  bossCollapseBtn: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.brand, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.pill },
  bossCollapseBtnTxt: { color: COLORS.onBrand, fontSize: 12, fontWeight: "700", letterSpacing: 2 },

  // ── Ultimate charge meter (hero pill) ──
  ultBarBg: { width: "100%", height: 3, borderRadius: 2, backgroundColor: COLORS.surface, marginTop: 3, overflow: "hidden" },
  ultBarFill: { height: "100%", borderRadius: 2 },
  ultBtn: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: COLORS.runeGold, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, marginTop: 3, alignSelf: "stretch", justifyContent: "center" },
  ultBtnTxt: { color: "#1A1200", fontSize: 13, fontWeight: "700" },

  // ── Clinical Cue modal ──
  cueModal: { backgroundColor: COLORS.surfaceSecondary, borderRadius: 8, borderWidth: 1, borderColor: COLORS.runeGold + "60", width: "100%", maxWidth: 380, maxHeight: "85%", flexGrow: 0 },
  cueModalContent: { padding: SPACING.lg, gap: 8 },
  cueFeedbackWrap: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", padding: SPACING.md, backgroundColor: "rgba(0,0,0,0.92)", zIndex: 9500 },
  cueFeedbackCard: { backgroundColor: COLORS.surfaceSecondary, borderRadius: 8, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.runeGold + "60", width: "100%", maxWidth: 380, maxHeight: "82%", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 20 },
  cueKicker: { color: COLORS.runeGold, fontSize: 12, letterSpacing: 0.5, fontWeight: "700", textAlign: "center" },
  cueTierTopic: { color: COLORS.onSurfaceSecondary, fontSize: 12, letterSpacing: 0.3, fontWeight: "600", marginTop: -4, textAlign: "center" },
  cuePrompt: { color: COLORS.onSurface, fontSize: 17, lineHeight: 26, marginBottom: 4, textAlign: "center" },
  cueOption: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  cueOptionTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: "center" },
  cueOptionCorrect: { borderColor: COLORS.success, backgroundColor: COLORS.success + "1F" },
  cueOptionWrong: { borderColor: COLORS.error, backgroundColor: COLORS.error + "1F" },
  cueRationaleBox: { marginTop: 6, backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, padding: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.runeGold },
  cueRationaleLabel: { color: COLORS.runeGold, fontSize: 12, letterSpacing: 0.4, fontWeight: "700", marginBottom: 3 },
  cueRationaleTxt: { color: COLORS.onSurfaceSecondary, fontSize: 15, lineHeight: 22 },
  cueRewardBox: { marginTop: 4, backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, padding: SPACING.md, gap: 3 },
  cueRewardLabel: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 0.4, fontWeight: "700", marginBottom: 2 },
  cueRewardTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  cueContinueBtn: { marginTop: 8, backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: "center" },
  cueContinueTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  cueAutoHint: { color: COLORS.onSurfaceTertiary, fontSize: 12, textAlign: "center", marginTop: 2 },

  // ── Perfect Cast timing modal ──
  timingModal: { backgroundColor: COLORS.surfaceSecondary, borderRadius: 8, padding: SPACING.lg, gap: 10, borderWidth: 1, borderColor: COLORS.runeGold + "60", width: "100%", maxWidth: 380, alignItems: "center" },
  timingTrack: { width: "100%", height: 18, borderRadius: 9, backgroundColor: COLORS.surface, overflow: "hidden", justifyContent: "center" },
  timingPerfectZone: { position: "absolute", left: "38%", width: "24%", height: "100%", backgroundColor: COLORS.runeGold + "50" },
  timingMarker: { position: "absolute", width: 4, height: "100%", backgroundColor: COLORS.onSurface, borderRadius: 2 },
  timingTapBtn: { backgroundColor: COLORS.runeGold, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.pill, marginTop: SPACING.sm, alignSelf: "stretch", alignItems: "center" },
  timingTapTxt: { color: "#1A1200", fontSize: 14, fontWeight: "700", letterSpacing: 2 },

  objectiveStrip: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 3, marginBottom: 3 },
  objectiveText: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 0.2, fontStyle: "italic" },
  feedbackBanner: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: COLORS.brand + "14", borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.brand + "30", marginBottom: 4,
    maxHeight: 34, overflow: "hidden",
    // On web, TutorialOverlay's battleScrim sits at zIndex 8999 via
    // absoluteFillObject.  Without an explicit zIndex here, CSS stacking
    // places the banner beneath that scrim, making the feedback text invisible
    // during a guided tutorial step.  9100 keeps it above the scrim (8999)
    // while remaining below the narrator dialogue box (9600).
    zIndex: 9100,
  },
  feedbackBannerChain: {
    backgroundColor: COLORS.runeGold + "18",
    borderColor: COLORS.runeGold + "60",
    borderWidth: 1.5,
  },
  feedbackText: { color: COLORS.brand, fontSize: 13, lineHeight: 19, flex: 1 },
  feedbackTextChain: { color: COLORS.runeGold, fontWeight: "700" },

  guidedHighlight: { borderColor: "#FFD700", borderWidth: 2.5, backgroundColor: "rgba(255,215,0,0.09)" },
  guidedDim: { opacity: 0.35 },
  briefingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.93)", zIndex: 100, justifyContent: "flex-end" },
  briefingPanel: { maxHeight: "90%", backgroundColor: COLORS.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: "hidden", borderTopWidth: 1, borderColor: COLORS.brand + "40" },
  briefingScroll: { padding: SPACING.lg, paddingTop: SPACING.md },
  briefingFooter: { padding: SPACING.md, paddingBottom: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 6 },
  briefingClinica: {
    backgroundColor: COLORS.brand + "14", borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.brand + "30", marginBottom: SPACING.lg,
  },
  briefingClinicaKicker: { color: COLORS.brand, fontSize: 12, letterSpacing: 0.5, fontWeight: "700", marginBottom: 4 },
  briefingFocusCard: { backgroundColor: COLORS.brand + "10", borderRadius: 4, padding: SPACING.sm, marginTop: SPACING.sm, borderWidth: 1, borderColor: COLORS.brand + "30", borderLeftWidth: 3, borderLeftColor: COLORS.brand },
  briefingFocusLabel: { color: COLORS.brand, fontSize: 12, letterSpacing: 0.5, fontWeight: "700", marginBottom: 2 },
  briefingFocusText: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21 },
  briefingClinicaText: { color: COLORS.onSurfaceSecondary, fontSize: 15, lineHeight: 22 },
  briefingKicker: { color: COLORS.brand, fontSize: 12, letterSpacing: 0.6, fontWeight: "700" },
  briefingTitle: { color: COLORS.onSurface, fontSize: 28, fontWeight: "700", lineHeight: 32, marginTop: 4 },
  briefingEnemy: { color: COLORS.onSurfaceTertiary, fontSize: 13, marginTop: 2, marginBottom: SPACING.sm },
  briefingStory: { color: COLORS.onSurfaceSecondary, fontSize: 16, lineHeight: 25 },
  briefingDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },
  briefingRow: { flexDirection: "row", gap: SPACING.md },
  briefingCol: { flex: 1, gap: 4 },
  briefingColSep: { width: 1, backgroundColor: COLORS.border },
  briefingColLabel: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 0.3, fontWeight: "700" },
  briefingColVal: { color: COLORS.onSurface, fontSize: 13, lineHeight: 18 },
  briefingWinRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACING.sm },
  briefingWinText: { color: COLORS.onSurfaceSecondary, fontSize: 12, flex: 1 },
  briefingGoalsTitle: { color: COLORS.onSurfaceTertiary, fontSize: 12, letterSpacing: 0.3, fontWeight: "700", marginBottom: 8 },
  briefingGoalRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  briefingGoalText: { color: COLORS.onSurface, fontSize: 13, flex: 1 },
  briefingEnterBtn: { backgroundColor: COLORS.brand, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center" },
  briefingEnterTxt: { color: COLORS.onBrand, fontSize: 15, fontWeight: "700", letterSpacing: 0.5 },
  briefingDismissHint: { color: COLORS.onSurfaceTertiary, fontSize: 12, textAlign: "center", marginTop: SPACING.sm, fontStyle: "italic" },

  // ── Term tooltip ──
  barLabelTappable: { borderBottomWidth: 1, borderBottomColor: COLORS.onSurfaceTertiary + "50" },
  termTooltipBanner: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  termTooltipTerm: { color: COLORS.brand, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  termTooltipDesc: { color: COLORS.onSurfaceSecondary, fontSize: 12, flex: 1, lineHeight: 17 },

  // ── Battle Help button ──
  battleHelpBtn: { flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-end", paddingVertical: 2, paddingHorizontal: 4 },
  battleHelpTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontStyle: "italic" },

  // ── Battle Glossary modal ──
  // ── Pre-battle objective popup ──
  objOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9500,
    paddingHorizontal: 24,
  },
  objCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    width: "100%",
    maxWidth: 380,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  objBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  objBadge: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  objTitle: { color: COLORS.onSurface, fontSize: 17, fontWeight: "700", lineHeight: 24 },
  objBullets: { gap: SPACING.sm },
  objBulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  objBulletTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19, flex: 1 },
  objNote: {
    color: COLORS.onSurfaceTertiary, fontSize: 11, fontStyle: "italic", lineHeight: 16,
    borderTopWidth: 1, borderTopColor: COLORS.divider, paddingTop: SPACING.sm,
  },
  objBeginBtn: { borderRadius: RADIUS.pill, paddingVertical: 11, alignItems: "center" },
  objBeginTxt: { color: COLORS.surface, fontSize: 13, fontWeight: "700", letterSpacing: 1 },

  glossaryOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end", zIndex: 500 },
  glossarySheet: {
    backgroundColor: COLORS.surfaceSecondary,
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    padding: SPACING.md, paddingBottom: SPACING.lg,
    gap: 0,
    borderTopWidth: 1, borderColor: COLORS.brand + "40",
  },
  glossaryHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.xs, marginBottom: SPACING.sm },
  glossaryTitle: { color: COLORS.brand, fontSize: 12, fontWeight: "700", letterSpacing: 1, flex: 1 },
  glossaryRow: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  glossaryTerm: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700", width: 78, paddingTop: 1 },
  glossaryDesc: { color: COLORS.onSurfaceSecondary, fontSize: 13, flex: 1, lineHeight: 19 },
  glossaryHint: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontStyle: "italic", textAlign: "center", marginTop: SPACING.sm },

  // ── Care Chain Rhythm Strip ──
  stripRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
    paddingHorizontal: SPACING.xs,
    marginBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  stripCell: { flexDirection: "row", alignItems: "center" },
  stripArrow: { marginHorizontal: 3 },
  stripStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceTertiary,
  },
  stripStepDone: {
    borderColor: COLORS.success + "60",
    backgroundColor: COLORS.success + "12",
  },
  stripStepActive: {
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1.5,
  },
  stripLabel: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },
  stripLabelDone: { color: COLORS.success },

  // ── Skill-type icon in action buttons ──
  skillTypeIcon: { marginRight: 2 },

  // ── firstBattle cinematic overlays ───────────────────────────────────────
  cinematicOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9200,
  },
  cinematicCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 16,
    maxWidth: 310,
  },
  cinematicPositive: { borderColor: COLORS.success + "99" },
  cinematicWarning:  { borderColor: COLORS.runeGold + "99" },
  cinematicDanger:   { borderColor: COLORS.error + "99" },
  cinematicMsgTxt: {
    color: COLORS.onSurface,
    fontSize: 18,
    fontWeight: "300",
    letterSpacing: 2.2,
    textAlign: "center",
    textTransform: "uppercase",
  },
  cinematicFlash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1500,
  },

  // ── P8 Card system ──
  cardChainBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 3,
  },
  cardChainLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    marginTop: 2,
  },
  cardChainNote: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "right",
    flexShrink: 1,
  },
  cardEmptyWrap: {
    width: "100%",
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
    opacity: 0.7,
  },
  cardEmptyTxt: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  cardDeckIndicator: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingTop: 8,
    opacity: 0.7,
  },
  cardDeckTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 11,
    fontStyle: "italic",
  },
  // Card tutorial modal
  cardTutModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.md,
    zIndex: 9999,
  },
  cardTutModal: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.runeGold + "50",
    maxWidth: 340,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  cardTutHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: 4,
  },
  cardTutTitle: {
    color: COLORS.runeGold,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cardTutBody: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  cardTutBtn: {
    marginTop: 6,
    backgroundColor: COLORS.runeGold,
    borderRadius: RADIUS.pill,
    paddingVertical: 10,
    alignItems: "center",
  },
  cardTutBtnTxt: {
    color: "#0B1020",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  // ── P9 Call for Help tab styles ──────────────────────────────────────────
  callRemainingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(166,216,246,0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(166,216,246,0.14)",
  },
  callRemainingTxt: {
    color: "#A6D8F6",
    fontSize: 12,
    fontWeight: "600",
  },
  callRemainingExhausted: {
    color: COLORS.runeGold + "90",
  },
  callSupportBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
    alignSelf: "flex-start",
    backgroundColor: "rgba(166,216,246,0.10)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  callSupportLbl: {
    color: "#A6D8F6",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  callEmptyState: {
    alignItems: "center",
    gap: 8,
    padding: 24,
  },
  callEmptyTxt: {
    color: COLORS.runeGold + "80",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  callEmptyHint: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 17,
  },
  callResultOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 600,
    padding: 20,
  },
  callResultCard: {
    width: "100%",
    backgroundColor: "#111828",
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 18,
    gap: 10,
    maxWidth: 340,
  },
  callResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  callResultTitle: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  callResultDetail: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 13,
    lineHeight: 19,
  },
  callResultDismiss: {
    alignSelf: "flex-end",
    backgroundColor: COLORS.runeGold,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: 4,
  },
  callResultDismissTxt: {
    color: "#0B1020",
    fontSize: 13,
    fontWeight: "700",
  },
});
