import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { BOSS_LORD_IMBALANCE, BOSS_SILENT_INFARCT, ENEMIES, HEROES, getWaveAdditionalEnemies } from "@/src/game/content";
import { getEnemyHint } from "@/src/game/onboarding";
import { getMission, getGuidedFeedback } from "@/src/game/missions";
import { getExplanationLayer, getObjectiveStrip, MISSION_BRIEFINGS, SCOUT_FEEDBACK, STABILIZE_FEEDBACK, COUNTER_FEEDBACK, REASSESS_FEEDBACK } from "@/src/game/explanationLayers";
import { getDifficultyModifier, OBJECTIVE_BY_DIFFICULTY, type DifficultyLevel } from "@/src/game/difficulty";
import { applyCall, applyCareAttempt, applySkill, applyTempAction, careAttemptDamage, endPlayerTurn, getEnemySignatureAttack, initBattle, isUltimateReady, selectHero, useItem as applyItem, previewSkillStatus, previewItemStatus, previewTempStatus, previewCallStatus, applyCard, applyUltimate, answerClinicalCue, skillSupportsCastTiming, type BattleState, type CastQuality } from "@/src/game/battle";
import { CALL_OPTIONS, ITEMS, TEMP_ACTIONS, Item } from "@/src/game/items";
import { aggregateUpgradeEffects, findSkin } from "@/src/game/shop";
import { getCard } from "@/src/game/cards";
import { computeStars, ENEMY_CLINICAL, getStartingHandicap, getStarRules, statusColor, statusLabel, ULTIMATE_BY_ROLE, CUE_TIER_LABELS, CUE_TIER_NUMBER, CUE_TOPIC_LABELS, type ActionStatus, type LearningProfile } from "@/src/game/clinical";
import { computePlayerXpReward, getClassBattleBonuses, splitContributionToHeroXp } from "@/src/game/progression";
import { computeEpidemicTokens } from "@/src/game/worldEvent";
import { useTestSession } from "@/src/game/testSession";
import { TipBubble, useTipsQueue } from "@/src/components/BattleTips";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { BattlefieldScene, type BattleFx, type EnemyAttackKind } from "@/src/components/BattlefieldScene";
import { SystemPanel } from "@/src/components/onboarding/SystemPanel";
import { SceneTransition } from "@/src/components/onboarding/SceneTransition";
import type { ActionType, Hero, HeroSkill } from "@/src/game/types";
import { applyStarToHero, getProgress } from "@/src/game/evolution";
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
  const { player, applyRewards, recordFailure, recordCueTopics } = usePlayer();
  const { isCompleted, startTutorial, replayTutorial, onRequiredAction, currentStep, activeTutorialId, guidedReserve } = useTutorial();
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
    const base = initBattle(enemy, team, {
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

  const [activeTab, setActiveTab] = useState<Tab>("actions");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [actionFx, setActionFx] = useState<BattleFx>(null);
  const [enemyFxTs, setEnemyFxTs] = useState(0);
  const [enemyFxAction, setEnemyFxAction] = useState<ActionType | null>(null);
  const [enemyAttackTs, setEnemyAttackTs] = useState(0);
  const [enemyAttackKind, setEnemyAttackKind] = useState<EnemyAttackKind | null>(null);
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
    let msg: string | null = null;
    if (actionType === 'scout')    msg = SCOUT_FEEDBACK[explanationLayer];
    else if (actionType === 'stabilize') msg = STABILIZE_FEEDBACK[explanationLayer];
    else if (actionType === 'strike')    msg = COUNTER_FEEDBACK[explanationLayer];
    else if (actionType === 'analyze')   msg = REASSESS_FEEDBACK[explanationLayer];
    else msg = getGuidedFeedback(enemy.id, actionType) ?? null;
    if (!msg) return;
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    setFeedbackMsg(msg);
    feedbackTimeout.current = setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // ---- Guided tutorial battle: force a specific care-chain sequence ----
  // Covers both the prologue battle and the first post-onboarding battle so
  // that wrong taps are caught with a nudge in both tutorials.
  const isTutorialBattle = activeTutorialId === "prologueBattle" || activeTutorialId === "firstBattle";
  const guidedStep = isTutorialBattle && currentStep?.requireAction ? currentStep : null;
  const guidedSkillId = guidedStep?.requiredSkillId;
  const guidedCueStep = guidedStep?.requiredActionType === "cue";
  const guidedEndTurnStep = guidedStep?.requiredActionType === "endTurn";
  const tutorialNudge = () => {
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    setFeedbackMsg("Follow the highlighted step to continue.");
    feedbackTimeout.current = setTimeout(() => setFeedbackMsg(null), 2500);
  };

  const handleSkill = (hero: Hero, skill: HeroSkill, castQuality: CastQuality = "normal") => {
    if (state.outcome !== "ongoing") return;
    if (guidedStep && skill.id !== guidedSkillId) { tutorialNudge(); return; }
    let effective = skill;
    if (sageDiscount && skill.type === "scout" && skill.cost > 0) {
      effective = { ...skill, cost: Math.max(0, skill.cost - 1) };
      setSageScoutBonusUsed(true);
    }
    if (state.ap < effective.cost) return;
    if (castQuality === "normal" && skillSupportsCastTiming(effective) && state.outcome === "ongoing" && !guidedSkillId) {
      openTimingPrompt(hero, effective);
      return;
    }
    onRequiredAction(skill.type, skill.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setState((s) => applySkill(s, effective, hero, castQuality).state);
    triggerFx(hero.id, effective.type);
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
    if (res.aborted) return;
    setState(res.state);
    triggerFx(state.selectedHeroId ?? undefined, "support");
    setDetail(null);
  };

  const handleUltimate = (hero: Hero) => {
    if (state.outcome !== "ongoing") return;
    if (guidedStep) { tutorialNudge(); return; }
    const res = applyUltimate(state, hero.id);
    if (res.aborted) return;
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
    setState(res.state);
    triggerFx(state.selectedHeroId ?? undefined, "support");
    setDetail(null);
  };
  const handleUseItem = (item: Item) => {
    if (guidedStep) { tutorialNudge(); return; }
    const res = applyItem(state, item);
    setState(res.state);
    triggerFx(state.selectedHeroId ?? undefined, "stabilize");
    setDetail(null);
  };
  const decideCallItem = () => {
    if (state.revealedLabels.some(l => l.toLowerCase().includes("wheez"))) return "Albuterol Mist";
    if (state.revealedLabels.some(l => l.toLowerCase().includes("glucose"))) return "Glucose Gel";
    if (state.revealedLabels.some(l => l.toLowerCase().includes("bp"))) return "Fluid Bolus";
    if (enemy.primarySystem === "Fire" || enemy.secondarySystem === "Fire") return "Isolation Kit";
    return "Lab Token";
  };
  // Show ALL calls all the time — players learn by misusing them (penalty handled in applyCall)
  const availableCalls = CALL_OPTIONS;
  const handleCall = (opt: typeof CALL_OPTIONS[number]) => {
    if (guidedStep) { tutorialNudge(); return; }
    const itemName = opt.effect === "addRelevantItem" ? decideCallItem() : undefined;
    const res = applyCall(state, opt, itemName);
    setState(res.state);
    triggerFx(state.selectedHeroId ?? undefined, "support");
    setDetail(null);
  };

  const handleEndTurn = () => {
    if (state.outcome !== "ongoing") return;
    if (guidedStep && !guidedEndTurnStep) { tutorialNudge(); return; }
    onRequiredAction("endTurn");
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
    // Push 1 prologue boss: no normal Game Over, no normal victory rewards.
    // Route straight into the Lotus Recall cutscene regardless of outcome.
    if (isPrologueBoss) {
      router.replace({ pathname: "/lotus-recall", params: { enemyId: enemy.id, replay: isReplay ? "1" : "" } });
      return;
    }
    let playerLevelUp: { fromLevel: number; toLevel: number } | null = null;
    let heroLevelUps: { heroId: string; fromLevel: number; toLevel: number }[] = [];
    let playerXpEarned = 0;
    let heroXpEarned: Record<string, number> = {};
    let epidemicTokensEarned = 0;
    // Push 6 replay: skip every reward/progress mutation below (XP, hero XP,
    // shards, crowns, inventory, mastery, codex, failure counts, cue topics).
    // Falls straight through to the outcome screen with nothing granted.
    if (isReplay) {
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
          playerXp: "0", heroXp: "{}", playerLevelUp: "", heroLevelUps: "[]",
        },
      });
      return;
    }
    if (state.outcome === "win") {
      // Boss-tier rewards apply to the scripted prologue boss AND any World
      // Event world boss (Verdantha). Keyed on a shared check rather than a
      // single hardcoded id so live world bosses aren't under-rewarded.
      const isBoss = isBossEnemy;
      const baseXp = isBoss ? 150 : 35 + enemy.difficulty * 10;
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
      const heroAwards = isTraining ? [] : splitContributionToHeroXp({
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
    } else if (state.outcome === "loss") {
      await recordFailure(enemy.id);
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
        {!isTutorialBattle && (
          <Pressable style={styles.closeBtn} onPress={() => goBack(router, "/(tabs)")} testID="battle-close">
            <Ionicons name="close" size={16} color={COLORS.onSurface} />
          </Pressable>
        )}
        {!isTutorialBattle && (
          <Pressable style={styles.helpBtn} onPress={() => router.push("/tutorial")} hitSlop={10} testID="battle-tutorial-button">
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
          <Text style={styles.barLabel}>CORRUPT</Text>
          <View style={styles.barBg}><View style={[styles.barFill, { width: `${corruptionPct}%`, backgroundColor: COLORS.corruptCrystal }]} /></View>
          <Text style={styles.barVal}>{state.corruption}</Text>
        </View>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>STABILITY</Text>
          <View style={styles.barBg}><View style={[styles.barFill, { width: `${state.stability}%`, backgroundColor: stabilityColor }]} /></View>
          <Text style={[styles.barVal, { color: stabilityColor }]}>{state.stability}%</Text>
        </View>
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
          <Pressable onPress={handleEndTurn} style={[styles.endBtn, guidedEndTurnStep && styles.guidedHighlight, guidedStep && !guidedEndTurnStep && styles.guidedDim]} disabled={state.outcome !== "ongoing"} testID="battle-end-turn">
            <Text style={styles.endTxt}>END TURN</Text>
          </Pressable>
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
        {/* Objective strip / adaptive feedback banner. While the guided
            prologue tutorial is actively narrating (Master Bai walks the
            player through every step), the goal strip is redundant noise —
            hide it and let the narrator carry the objective. */}
        {feedbackMsg ? (
          <View style={styles.feedbackBanner}>
            <Ionicons name="information-circle" size={11} color={COLORS.brand} />
            <Text style={styles.feedbackText} numberOfLines={2}>{feedbackMsg}</Text>
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
              return (
                <Pressable key={`tmp-${aid}`} style={[styles.actionBtn, { borderColor: statusColor(preview.status) }, disabled && styles.disabled]} onPress={() => disabled ? null : handleTempAction(aid)} onLongPress={() => disabled ? null : setDetail({ kind: "temp", actionId: aid })} delayLongPress={350} testID={`battle-temp-${aid}`}>
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
              const careDisabled = state.ap < 1 || state.outcome !== "ongoing";
              const careNode = (
                <Pressable key="care-attempt" style={[styles.actionBtn, { borderColor: COLORS.onSurfaceTertiary }, careDisabled && styles.disabled, guidedStep && styles.guidedDim]} onPress={() => { if (guidedStep) { tutorialNudge(); return; } if (careDisabled) return; setState(prev => applyCareAttempt(prev).state); triggerFx(selHero.id); }} testID="battle-care-attempt">
                  <View style={styles.basicTag}><Text style={styles.basicTagTxt}>BASIC</Text></View>
                  <View style={styles.actionHead}>
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
                const disabled = isLocked || state.ap < cost || state.outcome !== "ongoing";
                return (
                  <Pressable key={`${selHero.id}-${skill.id}`} style={[styles.actionBtn, { borderColor: statusColor(preview.status) }, disabled && styles.disabled, guidedSkillId === skill.id && styles.guidedHighlight, !!guidedSkillId && guidedSkillId !== skill.id && styles.guidedDim]} onPress={() => disabled ? null : handleSkill(selHero, skill)} onLongPress={() => disabled ? null : setDetail({ kind: "skill", hero: selHero, skill })} delayLongPress={350} testID={`battle-skill-${skill.id}`}>
                    <StatusBadge status={preview.status} />
                    <View style={styles.actionHead}>
                      <Text style={styles.actionName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{skill.name}</Text>
                      <Text style={styles.apTag}>{cost} AP</Text>
                    </View>
                    <Text style={styles.actionEffect} numberOfLines={2}>{skill.shortEffect || skill.description}</Text>
                    <Text style={styles.actionHero} numberOfLines={1}>{sageDisc ? "Sage · " : ""}{airDisc ? "Air disc · " : ""}{skill.systemType || "Universal"}</Text>
                  </Pressable>
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
              return (
                <Pressable key={item.id} style={[styles.actionBtn, { borderColor: statusColor(preview.status) }, disabled && styles.disabled]} onPress={() => disabled ? null : handleUseItem(item)} onLongPress={() => setDetail({ kind: "item", item })} delayLongPress={350} testID={`battle-item-${item.id}`}>
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
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
            {(() => {
              const selHero = state.team.find(h => h.id === state.selectedHeroId);
              if (!selHero) return <Text style={styles.emptyTab}>Tap a hero above first — skill cards use the chosen hero's action.</Text>;
              if (state.heroActionsUsed[selHero.id]) return <Text style={styles.emptyTab}>{selHero.name} has already acted.</Text>;
              return null;
            })()}
            {state.hand.map((cardId, idx) => {
              const card = getCard(cardId);
              if (!card) return null;
              const sel = state.team.find(h => h.id === state.selectedHeroId);
              const heroBlocked = !sel || !!state.heroActionsUsed[sel.id];
              const disabled = state.ap < card.costAP || state.outcome !== "ongoing" || heroBlocked;
              return (
                <Pressable key={`${cardId}-${idx}`} style={[styles.actionBtn, { borderColor: COLORS.runeGold }, disabled && styles.disabled]} onPress={() => disabled ? null : handleCard(cardId)} testID={`battle-card-${cardId}`}>
                  <View style={styles.basicTag}><Text style={styles.basicTagTxt}>CARD</Text></View>
                  <View style={styles.actionHead}>
                    <Text style={styles.actionName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{card.name}</Text>
                    <Text style={styles.apTag}>{card.costAP} AP</Text>
                  </View>
                  <Text style={styles.actionEffect} numberOfLines={2}>{card.shortEffect}</Text>
                  <Text style={styles.actionHero} numberOfLines={1}>{card.systemType || "Universal"}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        {activeTab === "call" && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
            {availableCalls.length === 0 && <Text style={styles.helpTxt}>No support options available.</Text>}
            {availableCalls.map(opt => {
              const callKey: keyof BattleState["callsUsed"] | null =
                opt.id === "call_pharmacy" ? "pharmacy" :
                opt.id === "call_respiratory" ? "respiratory" :
                opt.id === "call_rapid" ? "rapidResponse" :
                opt.id === "call_infection" ? "infectionControl" : null;
              const alreadyUsed = !!(callKey && state.callsUsed[callKey]);
              const preview = previewCallStatus(state, opt.id);
              const isLocked = preview.status === "locked";
              const rapidGated = opt.id === "call_rapid" && state.stability > 30 && !state.dangerTriggerActive;
              const disabled = isLocked || alreadyUsed || rapidGated || state.ap < opt.costAP || state.outcome !== "ongoing";
              return (
                <Pressable key={opt.id} style={[styles.actionBtn, { borderColor: statusColor(preview.status) }, disabled && styles.disabled]} onPress={() => disabled ? null : handleCall(opt)} onLongPress={() => setDetail({ kind: "call", option: opt })} delayLongPress={350} testID={`call-opt-${opt.id}`}>
                  <StatusBadge status={preview.status} />
                  <View style={styles.actionHead}>
                    <Text style={styles.actionName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{opt.name}</Text>
                    <Text style={styles.apTag}>{opt.costAP} AP</Text>
                  </View>
                  <Text style={styles.actionEffect} numberOfLines={2}>{opt.description}</Text>
                  {alreadyUsed && <Text style={styles.actionHero}>Already called</Text>}
                  {rapidGated && !alreadyUsed && <Text style={styles.actionHero}>Reserved for Stability ≤ 30</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
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

      {state.outcome !== "ongoing" && !isPrologueBoss && activeTutorialId !== "prologueBattle" && (
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
  enemyKicker: { color: COLORS.error, fontSize: 9, letterSpacing: 2, fontWeight: "700" },
  trainingTag: { backgroundColor: COLORS.brandTertiary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: RADIUS.pill },
  trainingTxt: { color: COLORS.brand, fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  systemWarningBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.error + "18", borderWidth: 1, borderColor: COLORS.error + "50", borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 },
  systemWarningTxt: { color: COLORS.error, fontSize: 10, fontWeight: "700", letterSpacing: 0.5, flex: 1 },
  enemyName: { color: COLORS.onSurface, fontSize: 16, fontWeight: "300", lineHeight: 18 },
  systemPills: { flexDirection: "row", gap: 4, marginTop: 2, flexWrap: "wrap" },
  sysPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.pill, borderWidth: 1 },
  sysTxt: { fontSize: 9, letterSpacing: 1, fontWeight: "700" },
  waveRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, flexWrap: "wrap" },
  waveLabel: { color: COLORS.onSurfaceTertiary, fontSize: 8, letterSpacing: 1.5, fontWeight: "700" },
  wavePip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceSecondary },
  wavePipActive: { borderColor: COLORS.error, backgroundColor: COLORS.error + "20" },
  wavePipDefeated: { borderColor: COLORS.success, backgroundColor: COLORS.success + "18", opacity: 0.6 },
  wavePipTxt: { color: COLORS.onSurfaceSecondary, fontSize: 8, fontWeight: "700" },

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
  barLabel: { color: COLORS.onSurfaceTertiary, fontSize: 8, letterSpacing: 1, fontWeight: "700", width: 52 },
  barBg: { flex: 1, height: 8, backgroundColor: COLORS.surfaceTertiary, borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2 },
  barVal: { color: COLORS.onSurface, fontSize: 10, fontWeight: "600", width: 36, textAlign: "right" },
  codexCard: {
    backgroundColor: COLORS.brand + "18", borderRadius: 4,
    borderWidth: 1, borderColor: COLORS.brand + "50",
    borderLeftWidth: 3, borderLeftColor: COLORS.brand,
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  codexLabel: { color: COLORS.brand, fontSize: 9, fontWeight: "700", letterSpacing: 0.4, flex: 1, lineHeight: 13 },
  codexText: { color: COLORS.onSurfaceSecondary, fontWeight: "400", fontSize: 9 },
  clueRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, paddingVertical: 2 },
  clue: { flex: 1, minWidth: 80, maxWidth: 140, height: 58, padding: SPACING.xs, borderRadius: 4, borderWidth: 1, gap: 2, backgroundColor: COLORS.surface },
  clueVisible: { borderColor: COLORS.brand + "80", borderTopWidth: 2, borderTopColor: COLORS.brand + "CC" },
  clueHidden: { borderColor: COLORS.borderStrong, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  clueLabel: { color: COLORS.onSurface, fontSize: 11, fontWeight: "600" },
  clueDetail: { color: COLORS.onSurfaceTertiary, fontSize: 9, lineHeight: 11 },

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
  heroPillRole: { color: COLORS.onSurfaceTertiary, fontSize: 8, fontWeight: "700", letterSpacing: 1, marginTop: 1 },
  apRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  apLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 1, fontWeight: "700" },
  apDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.borderStrong },
  apDotOn: { backgroundColor: COLORS.runeGold, borderColor: COLORS.runeGold },
  apDotBonus: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  endBtn: { marginLeft: "auto", paddingHorizontal: 11, paddingVertical: 4, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.borderStrong },
  endTxt: { color: COLORS.onSurfaceSecondary, fontSize: 9, letterSpacing: 1, fontWeight: "700" },
  tabs: { flexDirection: "row", gap: 4 },
  tab: { flex: 1, paddingVertical: 5, alignItems: "center", borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceTertiary },
  tabActive: { backgroundColor: COLORS.brand },
  tabTxt: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  tabTxtActive: { color: COLORS.onBrand },
  affordanceHint: { color: COLORS.onSurfaceTertiary, fontSize: 8, textAlign: "center", fontStyle: "italic", letterSpacing: 0.4 },

  // ── Zone D: Actions ──
  zoneD: { flex: 1, paddingHorizontal: SPACING.sm, paddingTop: SPACING.sm, overflow: "hidden" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, paddingBottom: SPACING.sm },
  actionBtn: {
    width: "48.5%", minHeight: 70, padding: 8, borderRadius: 4,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderStrong, gap: 2,
  },
  disabled: { opacity: 0.4 },
  actionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  actionName: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600", flex: 1 },
  actionEffect: { color: COLORS.onSurfaceSecondary, fontSize: 10, lineHeight: 12 },
  actionHero: { color: COLORS.onSurfaceTertiary, fontSize: 8, marginTop: 2, fontStyle: "italic" },
  apTag: { color: COLORS.brand, fontSize: 10, fontWeight: "700", marginLeft: 4 },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, borderWidth: 1, marginBottom: 2, maxWidth: "100%" },
  statusBadgeTxt: { fontSize: 7, fontWeight: "800", letterSpacing: 0.7 },
  basicTag: { alignSelf: "flex-start", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, borderWidth: 1, borderColor: COLORS.onSurfaceTertiary, backgroundColor: COLORS.onSurfaceTertiary + "20", marginBottom: 2 },
  basicTagTxt: { fontSize: 7, fontWeight: "800", letterSpacing: 0.7, color: COLORS.onSurfaceTertiary },
  emptyTab: { color: COLORS.onSurfaceTertiary, fontSize: 12, textAlign: "center", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, width: "100%" },

  teamList: { gap: SPACING.sm, paddingBottom: SPACING.sm },
  teamCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surfaceTertiary, padding: SPACING.sm, borderRadius: RADIUS.md, borderLeftWidth: 4, borderWidth: 1, borderColor: COLORS.border },
  teamName: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  teamRole: { color: COLORS.onSurfaceTertiary, fontSize: 10, marginTop: 2 },
  passiveCard: { backgroundColor: COLORS.brand + "12", borderRadius: RADIUS.md, padding: SPACING.sm, borderColor: COLORS.brand + "40", borderWidth: 1, marginTop: SPACING.sm },
  passiveLbl: { color: COLORS.brand, fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  passiveTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, marginTop: 4, lineHeight: 15 },
  helpTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, textAlign: "center", padding: SPACING.md, fontStyle: "italic" },

  // ── Modals ──
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  // On web, the guided TutorialOverlay action layer sits at zIndex 9000; without
  // an explicit zIndex the cue-question modal renders beneath it and swallows all
  // clicks (works on native because JSX paint order wins). Match the feedback card.
  cueModalOverlay: { zIndex: 9500 },
  detailModal: { backgroundColor: COLORS.surfaceSecondary, borderRadius: 8, padding: SPACING.lg, gap: 6, borderWidth: 1, borderColor: COLORS.brand + "50", width: "100%", maxWidth: 380, maxHeight: "80%" },
  detailKicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 1.5, fontWeight: "700" },
  detailTitle: { color: COLORS.onSurface, fontSize: 22, fontWeight: "400", marginBottom: 2 },
  detailHero: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontStyle: "italic", marginBottom: 6 },
  detailSection: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 1.5, fontWeight: "700", marginTop: 8 },
  detailBody: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18 },
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
  bossCollapseOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.94)", alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  bossCollapseInner: { width: "100%", maxWidth: 400, alignItems: "center", gap: SPACING.lg },
  bossCollapseTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: "400", lineHeight: 26 },
  bossCollapseBody: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20 },
  bossCollapseBtn: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.brand, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.pill },
  bossCollapseBtnTxt: { color: COLORS.onBrand, fontSize: 12, fontWeight: "700", letterSpacing: 2 },

  // ── Ultimate charge meter (hero pill) ──
  ultBarBg: { width: "100%", height: 3, borderRadius: 2, backgroundColor: COLORS.surface, marginTop: 3, overflow: "hidden" },
  ultBarFill: { height: "100%", borderRadius: 2 },
  ultBtn: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: COLORS.runeGold, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, marginTop: 3, alignSelf: "stretch", justifyContent: "center" },
  ultBtnTxt: { color: "#1A1200", fontSize: 8, fontWeight: "700" },

  // ── Clinical Cue modal ──
  cueModal: { backgroundColor: COLORS.surfaceSecondary, borderRadius: 8, borderWidth: 1, borderColor: COLORS.runeGold + "60", width: "100%", maxWidth: 380, maxHeight: "85%", flexGrow: 0 },
  cueModalContent: { padding: SPACING.lg, gap: 8 },
  cueFeedbackWrap: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", padding: SPACING.md, backgroundColor: "rgba(0,0,0,0.92)", zIndex: 9500 },
  cueFeedbackCard: { backgroundColor: COLORS.surfaceSecondary, borderRadius: 8, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.runeGold + "60", width: "100%", maxWidth: 380, maxHeight: "82%", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 20 },
  cueKicker: { color: COLORS.runeGold, fontSize: 10, letterSpacing: 1.5, fontWeight: "700", textAlign: "center" },
  cueTierTopic: { color: COLORS.onSurfaceSecondary, fontSize: 10, letterSpacing: 0.5, fontWeight: "600", marginTop: -4, textAlign: "center" },
  cuePrompt: { color: COLORS.onSurface, fontSize: 15, lineHeight: 21, marginBottom: 4, textAlign: "center" },
  cueOption: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  cueOptionTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: "center" },
  cueOptionCorrect: { borderColor: COLORS.success, backgroundColor: COLORS.success + "1F" },
  cueOptionWrong: { borderColor: COLORS.error, backgroundColor: COLORS.error + "1F" },
  cueRationaleBox: { marginTop: 6, backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, padding: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.runeGold },
  cueRationaleLabel: { color: COLORS.runeGold, fontSize: 9, letterSpacing: 1.5, fontWeight: "700", marginBottom: 3 },
  cueRationaleTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  cueRewardBox: { marginTop: 4, backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, padding: SPACING.md, gap: 3 },
  cueRewardLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 1.5, fontWeight: "700", marginBottom: 2 },
  cueRewardTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },
  cueContinueBtn: { marginTop: 8, backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: "center" },
  cueContinueTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  cueAutoHint: { color: COLORS.onSurfaceTertiary, fontSize: 10, textAlign: "center", marginTop: 2 },

  // ── Perfect Cast timing modal ──
  timingModal: { backgroundColor: COLORS.surfaceSecondary, borderRadius: 8, padding: SPACING.lg, gap: 10, borderWidth: 1, borderColor: COLORS.runeGold + "60", width: "100%", maxWidth: 380, alignItems: "center" },
  timingTrack: { width: "100%", height: 18, borderRadius: 9, backgroundColor: COLORS.surface, overflow: "hidden", justifyContent: "center" },
  timingPerfectZone: { position: "absolute", left: "38%", width: "24%", height: "100%", backgroundColor: COLORS.runeGold + "50" },
  timingMarker: { position: "absolute", width: 4, height: "100%", backgroundColor: COLORS.onSurface, borderRadius: 2 },
  timingTapBtn: { backgroundColor: COLORS.runeGold, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.pill, marginTop: SPACING.sm, alignSelf: "stretch", alignItems: "center" },
  timingTapTxt: { color: "#1A1200", fontSize: 14, fontWeight: "700", letterSpacing: 2 },

  objectiveStrip: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 3, marginBottom: 3 },
  objectiveText: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.4, fontStyle: "italic" },
  feedbackBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 5,
    backgroundColor: COLORS.brand + "14", borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.brand + "30", marginBottom: 4,
  },
  feedbackText: { color: COLORS.brand, fontSize: 10, lineHeight: 14, flex: 1 },

  guidedHighlight: { borderColor: COLORS.brand, borderWidth: 2, backgroundColor: "rgba(88,166,255,0.10)" },
  guidedDim: { opacity: 0.35 },
  briefingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.93)", zIndex: 100, justifyContent: "flex-end" },
  briefingPanel: { maxHeight: "90%", backgroundColor: COLORS.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: "hidden", borderTopWidth: 1, borderColor: COLORS.brand + "40" },
  briefingScroll: { padding: SPACING.lg, paddingTop: SPACING.md },
  briefingFooter: { padding: SPACING.md, paddingBottom: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 6 },
  briefingClinica: {
    backgroundColor: COLORS.brand + "14", borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.brand + "30", marginBottom: SPACING.lg,
  },
  briefingClinicaKicker: { color: COLORS.brand, fontSize: 9, letterSpacing: 2, fontWeight: "700", marginBottom: 4 },
  briefingFocusCard: { backgroundColor: COLORS.brand + "10", borderRadius: 4, padding: SPACING.sm, marginTop: SPACING.sm, borderWidth: 1, borderColor: COLORS.brand + "30", borderLeftWidth: 3, borderLeftColor: COLORS.brand },
  briefingFocusLabel: { color: COLORS.brand, fontSize: 9, letterSpacing: 2, fontWeight: "700", marginBottom: 2 },
  briefingFocusText: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },
  briefingClinicaText: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20 },
  briefingKicker: { color: COLORS.brand, fontSize: 9, letterSpacing: 3, fontWeight: "700" },
  briefingTitle: { color: COLORS.onSurface, fontSize: 28, fontWeight: "300", lineHeight: 32, marginTop: 4 },
  briefingEnemy: { color: COLORS.onSurfaceTertiary, fontSize: 13, marginTop: 2, marginBottom: SPACING.sm },
  briefingStory: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21 },
  briefingDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },
  briefingRow: { flexDirection: "row", gap: SPACING.md },
  briefingCol: { flex: 1, gap: 4 },
  briefingColSep: { width: 1, backgroundColor: COLORS.border },
  briefingColLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 1.5, fontWeight: "700" },
  briefingColVal: { color: COLORS.onSurface, fontSize: 13, lineHeight: 18 },
  briefingWinRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACING.sm },
  briefingWinText: { color: COLORS.onSurfaceSecondary, fontSize: 12, flex: 1 },
  briefingGoalsTitle: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 1.5, fontWeight: "700", marginBottom: 8 },
  briefingGoalRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  briefingGoalText: { color: COLORS.onSurface, fontSize: 13, flex: 1 },
  briefingEnterBtn: { backgroundColor: COLORS.brand, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center" },
  briefingEnterTxt: { color: COLORS.onBrand, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  briefingDismissHint: { color: COLORS.onSurfaceTertiary, fontSize: 10, textAlign: "center", marginTop: SPACING.sm, fontStyle: "italic" },
});
