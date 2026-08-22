import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { BOSS_LORD_IMBALANCE, BOSS_SILENT_INFARCT, ENEMIES, HEROES, getWaveAdditionalEnemies } from "@/src/game/content";
import { getEnemyHint } from "@/src/game/onboarding";
import { getMission, getGuidedFeedback } from "@/src/game/missions";
import { getExplanationLayer, getObjectiveStrip, MISSION_BRIEFINGS, COUNTER_FEEDBACK, getContextualScoutFeedback, getContextualStabilizeFeedback, getContextualReassessFeedback } from "@/src/game/explanationLayers";
import { getDifficultyModifier, OBJECTIVE_BY_DIFFICULTY, type DifficultyLevel } from "@/src/game/difficulty";
import { applyCall, applyCareAttempt, applySkill, applyTempAction, careAttemptDamage, endPlayerTurn, getEnemySignatureAttack, initBattle, isUltimateReady, resolveEnemyWeakElement, selectHero, useItem as applyItem, previewSkillStatus, previewItemStatus, previewTempStatus, previewCallStatus, applyCard, applyUltimate, answerClinicalCue, skillSupportsCastTiming, buildSkillCalcBreakdown, getRunChance, attemptRun, type BattleState, type CastQuality, type CalcBreakdown } from "@/src/game/battle";
import { CALL_OPTIONS, ITEMS, TEMP_ACTIONS, Item } from "@/src/game/items";
import { aggregateUpgradeEffects, findSkin } from "@/src/game/shop";
import { getCard, CHAIN_TYPE_CONFIG } from "@/src/game/cards";
import { computeStars, ENEMY_CLINICAL, getStartingHandicap, getStarRules, isNonmedicalProfile, statusColor, statusLabel, ULTIMATE_BY_ROLE, CUE_TIER_LABELS, CUE_TIER_NUMBER, CUE_TOPIC_LABELS, SKILL_CLINICAL, PATHWAY_ROLE_LABEL, type ActionStatus, type LearningProfile, type PathwayRole } from "@/src/game/clinical";
import { getLeaderBonus } from "@/src/game/leaderSpecialty";
import { heroRoleLabel } from "@/src/game/university";
import { EQUIPMENT_ITEMS } from "@/src/game/equipment";
import { CLASS_IDENTITIES, ClassId, getClassTreeBattleBonuses } from "@/src/game/classTree";
import { computePlayerXpReward, getClassBattleBonuses, splitContributionToHeroXp } from "@/src/game/progression";
import { getBattleBaseXp, getBattleScrollDrop, starXpMultiplier, starMultiplierLabel, LOSS_LEARNING_XP } from "@/src/game/battleXp";
import { completeObjective, markObjectiveXpGranted } from "@/src/game/objectiveProgress";
import { computeEpidemicTokens } from "@/src/game/worldEvent";
import { TipBubble, useTipsQueue } from "@/src/components/BattleTips";
import { TutorialOverlay, TypewriterText } from "@/src/components/TutorialOverlay";
import { MASTER_BAI } from "@/src/game/systemNarrator";
import { useBlockBack } from "@/src/hooks/useBlockBack";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { BattlefieldScene, type BattleFx, type EnemyAttackKind } from "@/src/components/BattlefieldScene";
import { SystemPanel } from "@/src/components/onboarding/SystemPanel";
import { ROUTES, dynRoute } from "@/src/game/routes";
import { SceneTransition } from "@/src/components/onboarding/SceneTransition";
import type { ActionType, ClassFamily, Hero, HeroSkill } from "@/src/game/types";
import { applyStarToHero, getProgress } from "@/src/game/evolution";
import { getHeroVisuals } from "@/src/components/getHeroVisuals";
import { applySkillUpgradesToTeam } from "@/src/game/heroSkillAcademy";
import { getBattleAssistRule } from "@/src/features/battle/battleAssist";
import { getAssistConfigForEncounter } from "@/src/features/battle/battleAssistConfigs";
import { resolveJourneyAreaBossEnemyId } from "@/src/game/journeyMap/encounterResolution";
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
  const { enemyId, training, prologue, replay, journeyReturn, journeyChapterId, journeyTileId, journeyIsAreaBoss, journeyIsChapterBoss, journeyRunId, journeyShift } = useLocalSearchParams<{ enemyId: string; training?: string; prologue?: string; replay?: string; journeyReturn?: string; journeyChapterId?: string; journeyTileId?: string; journeyIsAreaBoss?: string; journeyIsChapterBoss?: string; journeyRunId?: string; journeyShift?: string }>();
  const { player, loading } = usePlayer();
  if (loading || !player) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface }}>
        <Text style={{ color: COLORS.onSurfaceTertiary }}>Loading…</Text>
      </View>
    );
  }
  return <BattleInner enemyId={enemyId} training={training} prologue={prologue} replay={replay} journeyReturn={journeyReturn} journeyChapterId={journeyChapterId} journeyTileId={journeyTileId} journeyIsAreaBoss={journeyIsAreaBoss} journeyIsChapterBoss={journeyIsChapterBoss} journeyRunId={journeyRunId} journeyShift={journeyShift} />;
}

function BattleInner({ enemyId, training, prologue, replay, journeyReturn, journeyChapterId, journeyTileId, journeyIsAreaBoss, journeyIsChapterBoss, journeyRunId, journeyShift }: { enemyId?: string; training?: string; prologue?: string; replay?: string; journeyReturn?: string; journeyChapterId?: string; journeyTileId?: string; journeyIsAreaBoss?: string; journeyIsChapterBoss?: string; journeyRunId?: string; journeyShift?: string }) {
  const router = useRouter();
  const { player, applyRewards, claimJourneyChapterBoss, claimJourneyAreaBoss, completeVerdantha, recordFailure, recordCueTopics, updateBattleStars, markCardTutorialSeen, markCallTutorialSeen, updateState, advanceProloguePhase } = usePlayer();
  const { isCompleted, startTutorial, replayTutorial, onRequiredAction, advanceStep, currentStep, activeTutorialId } = useTutorial();
  const isFirstBattleGuided = activeTutorialId === "firstBattle";
  const isFirstBattleActionStep =
    isFirstBattleGuided &&
    !!(currentStep?.requireAction) &&
    !!currentStep?.requiredActionType &&
    !["cue", "endTurn"].includes(currentStep.requiredActionType as string);
  const { width: screenW } = useWindowDimensions();
  const isTraining = training === "1";
  // Push 1 prologue: "tutorial" is the guided, reliably-winnable Ward Shift
  // fight; "boss" is the narratively scripted-to-lose Silent Infarct fight.
  const isPrologueTutorial = prologue === "tutorial";
  // Push 6 — Profile "Replay Prologue" re-enters this exact guided sequence
  // without touching saved progress: no XP/currency/mastery/codex/inventory
  // is granted or recorded, and no onboarding flag is ever written.
  const isReplay = replay === "1";

  const resolvedEnemyId = useMemo(
    () => resolveJourneyAreaBossEnemyId(
      enemyId,
      journeyChapterId,
      journeyIsAreaBoss === '1',
    ),
    [enemyId, journeyChapterId, journeyIsAreaBoss],
  );
  const enemy = useMemo(() => {
    if (!resolvedEnemyId) return ENEMIES[0];
    if (resolvedEnemyId === BOSS_LORD_IMBALANCE.id) return BOSS_LORD_IMBALANCE;
    if (resolvedEnemyId === BOSS_SILENT_INFARCT.id) return BOSS_SILENT_INFARCT;
    return ENEMIES.find((e) => e.id === resolvedEnemyId) || ENEMIES[0];
  }, [resolvedEnemyId]);

  const isPrologueBoss = prologue === "boss" && !!enemy.scriptedLoss;
  // Shared boss check for reward tiering: the scripted prologue boss OR any
  // World Event world boss earns boss-scale XP/shards/crowns.
  const isBossEnemy = enemy.id === BOSS_LORD_IMBALANCE.id || !!enemy.worldBoss;

  // Prologue loaner heroes: brand-new players own no heroes (Recruitment is
  // the only source), so the guided tutorial battle AND the scripted prologue
  // boss both run on the SAME temporary loaner trio — Florence Nightingale
  // (prologue_nightingale), Alexander Fleming (prologue_fleming), and The Prodigy
  // (prologue_former_self). Their skill IDs satisfy the guided tutorial step pins.
  // Loaners are never persisted: the prologue runs as training (no hero XP) and
  // nothing writes them into heroes_owned/active_team/hero_progression.
  const isPrologueLoanerBattle = isPrologueTutorial || isPrologueBoss;
  const team = useMemo(() => {
    let assembled: Hero[];
    if (isPrologueLoanerBattle || !player || (player.heroes_owned || []).length === 0) {
      // Tutorial + Boss: same three-hero loaner team (Nightingale, Fleming, Former Self).
      // Empty-roster fallback (shouldn't occur post-recruitment): Novice Guardian pair.
      const loanerIds = isPrologueTutorial || isPrologueBoss
        ? ["prologue_nightingale", "prologue_fleming", "prologue_former_self"]
        : ["novice_guardian", "village_caretaker"];
      assembled = loanerIds
        .map((id) => HEROES.find((h) => h.id === id))
        .filter(Boolean) as Hero[];
    } else {
      const teamIds = (player.active_team && player.active_team.length > 0) ? player.active_team : player.heroes_owned;
      const fromTeam = teamIds
        .map(id => {
          const base = HEROES.find(h => h.id === id);
          if (!base) return null;
          return applyStarToHero(base, getProgress(player.hero_progression, id));
        })
        .filter(Boolean) as Hero[];
      assembled = fromTeam.length >= 1 ? fromTeam.slice(0, 3) : HEROES.slice(0, 3);
    }
    if (__DEV__) {
      const battleType = isPrologueTutorial ? 'tutorial' : isPrologueBoss ? 'boss' : 'ward-shift';
      assembled.forEach(h => {
        const v = getHeroVisuals(h.id, h.name);
        if (!v.hasBattleSprite) console.warn(`[Battle:${battleType}] Hero "${h.id}" (${h.name}) has no battle sprite — will show letter fallback.`);
        if (!v.hasPortrait)     console.warn(`[Battle:${battleType}] Hero "${h.id}" (${h.name}) has no portrait — fallback active.`);
      });
    }
    return assembled;
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

  // Push F — scenario-authored assist rules.  Config is looked up from the
  // chapter's authored BattleAssistConfig; the UI renders what the config says.
  // Falls back gracefully to undefined (no assist) for training/prologue/boss.
  const assistConfig   = getAssistConfigForEncounter(journeyChapterId);
  const activeAssistRule = getBattleAssistRule(assistConfig, failureCount);
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
    // Push 11: class tree combat bonus (6-class system keyed by class_tree_id).
    // Skipped for prologue loaner battles so tutorial fights stay unscaled.
    const classId = ((player?.class_tree_id as ClassId) || 'medic');
    const classTreeBonus = !isPrologueLoanerBattle
      ? getClassTreeBattleBonuses(
          classId,
          (player?.class_progress || {})[classId] || [],
          (player?.class_specialization || {})[classId],
        )
      : null;
    const base = initBattle(enemy, battleTeam, {
      // Journey battle bridge — frozen run shift travels with Journey battles.
      shift: (journeyReturn === '1' && (journeyShift === 'day' || journeyShift === 'evening' || journeyShift === 'night'))
        ? journeyShift
        : undefined,
      inventory: player?.inventory || {},
      profile,
      enemyMastery: player?.enemy_mastery,
      chapter: player?.chapter_progress,
      startingStabilityBonus: handicap.startingStabilityBonus + (mentorAid ? 10 : 0) + (isTraining ? 10 : 0) + upgrades.startingStabilityBonus + classBonuses.startingStabilityBonus,
      enemyDamageReduction: handicap.enemyDamageReduction + upgrades.enemyDamageReduction,
      revealOneExtraClue: handicap.revealOneExtraClue || isTraining || upgrades.revealOneExtraClue || classBonuses.revealOneExtraClue,
      // Push 9: Leader AP bonus (Educator/"Scholar's Leadership" grants +1 starting AP).
      // Skip for prologue loaner battles so the tutorial team stays unscaled.
      // Prologue (tutorial + scripted-loss boss) always starts at 14 AP so the loaner
      // team's legendary/mythic skills are meaningfully usable from turn one.
      // Previously boss had +3 and tutorial had +0; unified to +2 for both (10 base + 2 = 12).
      apBonus: upgrades.apBonus + classBonuses.apBonus + (isPrologueLoanerBattle ? 4 : 0)
        + (!isPrologueLoanerBattle && battleTeam[0] ? getLeaderBonus(battleTeam[0]).apBonus : 0)
        + (!isPrologueLoanerBattle ? (classTreeBonus?.startApBonus ?? 0) : 0),
      startShield: classBonuses.startShield,
      difficulty: player?.difficulty || undefined,
      additionalEnemies: getWaveAdditionalEnemies(enemy.id),
      // P8 — pass equipped cards from loadout (limited-use per battle).
      // Empty array → skip, let initBattle use random draw (legacy).
      equippedCards: (player?.equipped_cards?.length ?? 0) > 0 ? player!.equipped_cards : undefined,
      classTreeBonus: classTreeBonus ?? undefined,
      // Push 10: hero equipment loadout (skipped for prologue loaner battles).
      heroEquipment: !isPrologueLoanerBattle ? (player?.hero_equipment ?? {}) : undefined,
      // Push 3: suppress elemental counter during prologue tutorial so players
      // learn Intervention Fit before Elemental Counter is introduced.
      suppressElementCounter: isPrologueTutorial,
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
    // Push 9: log the active Leader specialty so it's visible in the battle log.
    if (!isPrologueLoanerBattle && battleTeam[0]) {
      const lb = getLeaderBonus(battleTeam[0]);
      log = [...log, `👑 Leader: ${battleTeam[0].name} — ${lb.description}`];
    }
    // Push 11: log the active class bonus so it's visible in the battle log.
    if (!isPrologueLoanerBattle && classTreeBonus) {
      log = [...log, `⚕️ Class: ${CLASS_IDENTITIES[classId].name} — class bonuses active.`];
    }
    // Push 10: log active equipment for the battle team.
    if (!isPrologueLoanerBattle && player?.hero_equipment) {
      for (const hero of battleTeam) {
        const slots = player.hero_equipment[hero.id];
        if (!slots) continue;
        for (const itemId of Object.values(slots)) {
          const item = EQUIPMENT_ITEMS.find((e) => e.id === itemId && e.status === 'active');
          if (item) log = [...log, `⚕️ ${item.name} equipped on ${hero.name}.`];
        }
      }
    }
    return { ...base, stability, visibleClues, hiddenClueIds, revealedLabels, log };
  });

  // P9 — team hero families, used to filter available Call for Help options.
  const teamFamilies = useMemo<Set<ClassFamily>>(() => {
    const s = new Set<ClassFamily>();
    team.forEach(h => { if ((h as any).family) s.add((h as any).family as ClassFamily); });
    return s;
  }, [team]);

  // Push 3 — phase-resolved weak element (Verdantha phase overrides).
  // resolvedWeakElement: the effective element for the current phase (null = no counter / unrevealed).
  const resolvedWeakElement = useMemo(
    () => resolveEnemyWeakElement(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.activePhaseIndex, state.phase3WeakElementRevealed, state.suppressElementCounter, state.enemy.id],
  );
  // displayWeakElement: drives the enemy-panel pill and skill counter chips.
  // 'unknown' = not yet scouted (hide until discovered).
  const displayWeakElement = useMemo((): import("@/src/game/types").ElementSystem | null | 'unknown' => {
    if (enemy.phases && enemy.phases.length > 0) {
      // Last phase: hidden until a scout action reveals it.
      if (state.activePhaseIndex >= enemy.phases.length - 1 && !state.phase3WeakElementRevealed) return 'unknown';
      // Otherwise show the phase override (may be null = no counter this phase).
      return resolvedWeakElement;
    }
    // Standard enemy: only reveal after first clue is scouted.
    if (state.visibleClues.length === 0) return 'unknown';
    return enemy.weakElement; // null = this enemy has no elemental counter
  }, [enemy, state.activePhaseIndex, state.phase3WeakElementRevealed, state.visibleClues.length, resolvedWeakElement]);

  const [activeTab, setActiveTabRaw] = useState<Tab>("actions");
  const cardTabOpenedRef = useRef(false);
  const [showCardTutorial, setShowCardTutorial] = useState(false);
  const callTabOpenedRef = useRef(false);
  const [showCallTutorial, setShowCallTutorial] = useState(false);
  // Push 3 — one-time in-battle tutorial overlays for Elemental Counter (Fluid Phantom)
  // and Clinical Expertise (Lord Imbalance).
  const [showCounterTutorial, setShowCounterTutorial] = useState(false);
  const [showExpertiseTutorial, setShowExpertiseTutorial] = useState(false);
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
  // Rapid-tap guard: set true for the duration of a battle action so a second
  // tap that arrives before the React rerender cannot fire the same action twice.
  const actionProcessingRef = useRef(false);
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
      onRequiredAction("cue"); // satisfies prologueBattle › prologue_cue (requiredActionType:"cue")
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
  // ── Florence Nightingale one-time cameo (prologue tutorial only) ─────────
  const [showFlorenceCameo, setShowFlorenceCameo] = useState(false);
  const dismissFlorenceCameo = () => {
    setShowFlorenceCameo(false);
    if (player && !player.seen_florence_cameo) {
      updateState({ ...player, seen_florence_cameo: true });
    }
  };

  // ── Master Bai warning narration (prologue boss only) ─────────────────────
  const [showBossNarrator, setShowBossNarrator] = useState(false);
  const dismissBossNarrator = () => {
    setShowBossNarrator(false);
    if (player && !player.seen_boss_narrator) {
      updateState({ ...player, seen_boss_narrator: true });
    }
  };

  // ── Fluid Phantom: one-time Elemental Counter tutorial ────────────────────
  const dismissCounterTutorial = () => {
    setShowCounterTutorial(false);
    if (player && !player.seen_fluid_phantom_counter_tutorial) {
      updateState({ ...player, seen_fluid_phantom_counter_tutorial: true });
    }
  };
  // ── Lord Imbalance: one-time Clinical Expertise tutorial ──────────────────
  const dismissExpertiseTutorial = () => {
    setShowExpertiseTutorial(false);
    if (player && !player.seen_lord_imbalance_expertise_tutorial) {
      updateState({ ...player, seen_lord_imbalance_expertise_tutorial: true });
    }
  };

  // ── Skill pagination ─────────────────────────────────────────────────────
  const [skillPage, setSkillPage] = useState(0);
  useEffect(() => { setSkillPage(0); }, [state.selectedHeroId]);

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
    // Boss battle: show the pre-battle VN narration only — no guided tutorial
    if (isPrologueBoss) return;
    // firstBattle scripted-loss only fires when facing the Silent Infarct
    // specifically. Any other battle while firstBattle is uncompleted is a
    // normal ward shift — don't inject the Master Bai narration there.
    if (!isCompleted("firstBattle") && enemyId === "silent_infarct") {
      const t = setTimeout(() => startTutorial("firstBattle"), 800);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── clinicalCueIntro: fire once the first Clinical Cue appears in a
  // non-tutorial, non-training battle so new players understand the mechanic
  // before they answer. The tutorial is a blocking modal that auto-clears
  // when the player taps "ANSWER THE CUE", revealing the cue beneath it.
  // Guard: skip during prologue, training, and any battle where firstBattle
  // has not yet been completed. Using isCompleted("firstBattle") as the durable
  // condition ensures this never fires during the guided first battle even if
  // activeTutorialId is null at mount time (the 800ms setTimeout hasn't fired yet).
  useEffect(() => {
    if (!state.pendingCue) return;
    if (isPrologueTutorial || isPrologueBoss || isTraining) return;
    if (!isCompleted("firstBattle")) return;
    if (isCompleted("clinicalCueIntro")) return;
    startTutorial("clinicalCueIntro");
  }, [state.pendingCue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push 3 — Fluid Phantom: show the Elemental Counter one-time tutorial after a
  // short delay so the objective modal has already been dismissed.
  useEffect(() => {
    if (isPrologueTutorial || isPrologueBoss) return; // don't interrupt guided prologue
    if (enemy.id !== 'fluid_phantom') return;
    if (player?.seen_fluid_phantom_counter_tutorial) return;
    const t = setTimeout(() => setShowCounterTutorial(true), 1400);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Push 3 — Lord Imbalance: show the Clinical Expertise one-time tutorial after
  // the objective modal has been dismissed.
  useEffect(() => {
    if (enemy.id !== 'lord_imbalance') return;
    if (player?.seen_lord_imbalance_expertise_tutorial) return;
    const t = setTimeout(() => setShowExpertiseTutorial(true), 1400);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Push 1 prologue boss safety net: this fight is narratively scripted to
  // end in defeat. Normal stability math already makes it nearly unwinnable
  // (very high stabilityResistance/instability, weakElement: Storm), but if the
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
  const isNonmedical = isNonmedicalProfile(player?.learning_profile);
  const isFirstBattle = (player?.runs_completed ?? 0) === 0 && enemy.id === "air_sprite";
  const sageDiscount = player?.aptitude === "sage" && !sageScoutBonusUsed;

  useEffect(() => {
  }, []);

  useEffect(() => {
    if (state.outcome === 'win') {
      // win outcome — no-op, handled in finish()
    }
  }, [state.outcome]);

  useEffect(() => {
    const cur = state.visibleClues.length;
    if (cur > tsPrevClueCount.current) {
      tsPrevClueCount.current = cur;
    }
  }, [state.visibleClues.length]);

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
      msg = 'Protection raised — the next deterioration event will reduce less Stability.';
    } else if (actionType === 'command') {
      msg = 'Escalate issued — protection and pressure applied together.';
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
    if (actionProcessingRef.current) return;
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
    // satisfies prologueBattle steps with requiredSkillId (prologue_scout / prologue_stabilize /
    // prologue_counter / prologue_reassess) — the store checks skill.id against requiredSkillId.
    actionProcessingRef.current = true;
    onRequiredAction(skill.type, skill.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Push 8: capture result so we can display the actual effect in feedbackMsg.
    // Calling applySkill(state, ...) directly is safe — state is current at press-time,
    // which matches how all other handlers (handleCard, handleUseItem, etc.) already work.
    const prevLogLen = state.log.length;
    const applyResult = applySkill(state, effective, hero, castQuality);
    setState(applyResult.state);
    requestAnimationFrame(() => { actionProcessingRef.current = false; });
    // affinityMatchIntro: fire on the first skill that produces any non-neutral
    // affinity result so the player learns what the feedback labels mean.
    // Covers both family-affinity ("Affinity advantage" / "Weak affinity") and
    // element-based affinity result labels ("Super Effective!" / "Limited Effect!").
    // Uses isCompleted("firstBattle") as the durable guard so this cannot fire
    // during the guided first battle even before activeTutorialId is set.
    if (!isTraining && !isPrologueTutorial && !isPrologueBoss && isCompleted("firstBattle") && !isCompleted("affinityMatchIntro")) {
      const newEntries = applyResult.state.log.slice(prevLogLen);
      const hasAffinityFeedback = newEntries.some(e =>
        e.includes("Affinity advantage") || e.includes("Weak affinity") ||
        e.includes("Super Effective") || e.includes("Limited Effect")
      );
      if (hasAffinityFeedback) startTutorial("affinityMatchIntro");
    }
    triggerFx(hero.id, effective.type);
    turnActionsRef.current = [...turnActionsRef.current, effective.type];
    // Push 8: show the actual outcome ("Lowered Corruption by 11.") in the feedback banner.
    // Tutorial battles keep the guided contextual tip — the narrator is already explaining
    // each step, so outcome numbers are secondary noise there.
    // Detect care-chain progress from this action.
    const prevChainLen = state.chain.progress.length;
    const nextChainLen = applyResult.state.chain.progress.length;
    const chainStepAdvanced = nextChainLen > prevChainLen;
    const chainJustCompleted = !state.fullChainCompleted && applyResult.state.fullChainCompleted;

    if (!isTutorialBattle && applyResult.message) {
      showBlockMsg(applyResult.message.split('\n')[0]);
    } else {
      showFeedback(skill.type);
      // In tutorial battles, append a brief non-blocking chain confirmation
      // when the action actually advanced chain.progress.
      if (isTutorialBattle && (chainStepAdvanced || chainJustCompleted)) {
        const stepLabel = chainJustCompleted
          ? "Complete Care Pathway! ✨ — brilliant clinical rhythm"
          : `${applyResult.state.chain.progress[applyResult.state.chain.progress.length - 1]
              ?.charAt(0).toUpperCase()}${applyResult.state.chain.progress[applyResult.state.chain.progress.length - 1]?.slice(1)} ✓ — Care Pathway advancing`;
        setTimeout(() => showBlockMsg(stepLabel), 900);
      }
    }
    if (!tsFirstAction.current) {
      tsFirstAction.current = true;
    }
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
    // Push 8: show outcome in feedback banner (cards previously had no live feedback).
    if (res.message) showBlockMsg(res.message.split('\n')[0]);
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
    if (actionProcessingRef.current) return;
    const isCorrect = !!cue.options[optionIndex]?.correct;
    // Guided prologue: only the correct answer is accepted.
    if (guidedCueStep && !isCorrect) { tutorialNudge(); return; }
    actionProcessingRef.current = true;
    const res = answerClinicalCue(state, optionIndex);
    setState(res.state);
    requestAnimationFrame(() => { actionProcessingRef.current = false; });
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
    // Push 8: show outcome in feedback banner (temp actions previously had no live feedback).
    if (res.message) showBlockMsg(res.message.split('\n')[0]);
    setDetail(null);
  };
  const handleUseItem = (item: Item) => {
    if (guidedStep) { tutorialNudge(); return; }
    const res = applyItem(state, item);
    if (res.aborted) { showBlockMsg(res.message); return; }
    setState(res.state);
    triggerFx(state.selectedHeroId ?? undefined, "stabilize");
    // Push 8: show outcome (e.g., "Raised Stability by 15.") in feedback banner.
    if (res.message) showBlockMsg(res.message.split('\n')[0]);
    const itemActionType = item.target === 'corruption' ? 'strike' : item.target === 'clue' ? 'scout' : 'stabilize';
    turnActionsRef.current = [...turnActionsRef.current, itemActionType];
    setDetail(null);
  };
  const decideCallItem = () => {
    if (state.revealedLabels.some(l => l.toLowerCase().includes("wheez"))) return "Albuterol Mist";
    if (state.revealedLabels.some(l => l.toLowerCase().includes("glucose"))) return "Glucose Gel";
    if (state.revealedLabels.some(l => l.toLowerCase().includes("bp"))) return "Fluid Bolus";
    if (enemy.primaryAffinity === "Fire / Inflammation" || enemy.secondaryAffinities.includes("Fire / Inflammation")) return "Isolation Kit";
    return "Lab Token";
  };
  // P9 — filter Call for Help options by team family composition.
  // call_rapid (Emergency) is always available.
  // call_infection also shows when the enemy is Fire/infection-tagged.
  const availableCalls = useMemo(() => CALL_OPTIONS.filter(opt => {
    if (!opt.requiredFamilies || opt.requiredFamilies.length === 0) return true;
    if (opt.id === "call_infection") {
      const enemyIsInfection = enemy.primaryAffinity === "Fire / Inflammation"
        || enemy.secondaryAffinities.includes("Fire / Inflammation")
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
    if (actionProcessingRef.current) return;
    // During firstBattle action steps, endTurn is always allowed so the player
    // can refill AP between guided steps without getting stuck.
    if (guidedStep && !guidedEndTurnStep && !isFirstBattleActionStep) { tutorialNudge(); return; }
    actionProcessingRef.current = true;
    onRequiredAction("endTurn"); // satisfies prologueBattle › prologue_endturn (requiredActionType:"endTurn")
    turnActionsRef.current = [];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    triggerEnemyAttack(getEnemySignatureAttack(enemy).kind);
    setState((s) => {
      let next = endPlayerTurn(s);
      if (player?.aptitude === "guardian" && s.outcome === "ongoing" && next.outcome === "ongoing" && next.stability < s.stability) {
        const recovered = Math.min(5, s.stability - next.stability);
        next = { ...next, stability: Math.min(100, next.stability + recovered), log: [...next.log, `🛡 Guardian's Vigil: Instability reduced by ${recovered}.`] };
      }
      return next;
    });
    requestAnimationFrame(() => { actionProcessingRef.current = false; });
  };

  // ── Run / Flee — replaces the old ✕ instant-exit. Speed-based escape roll;
  // a failed attempt costs the turn (the enemy acts).
  const handleRun = () => {
    if (state.outcome !== "ongoing") return;
    if (actionProcessingRef.current) return;
    if (guidedStep) { tutorialNudge(); return; }
    actionProcessingRef.current = true;
    const res = attemptRun(state);
    if (res.escaped) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      // Journey battles: return WITHOUT resolvedTileId/outcome params — the
      // fog-map only mutates a tile when those come back via result.tsx, so a
      // fled tile intentionally stays unresolved and can be re-attempted.
      const dest = journeyReturn === "1" && journeyChapterId
        ? dynRoute.chapterFogMap(journeyChapterId)
        : ROUTES.tabs;
      actionProcessingRef.current = false; // defensive — in case the route stays mounted
      router.replace(dest as any);
      return;
    }
    showBlockMsg(res.message);
    turnActionsRef.current = [];
    triggerEnemyAttack(getEnemySignatureAttack(enemy).kind);
    setState(endPlayerTurn(res.state));
    requestAnimationFrame(() => { actionProcessingRef.current = false; });
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
        await applyRewards({ xp: LOSS_LEARNING_XP, codexShards: 0, crowns: 0, codex: [], enemyId: enemy.id, enemyName: enemy.name, repeatable: true, progressionValue: 1 });
      }
      if (state.cuesTopicsCorrect.length > 0) {
        await recordCueTopics(state.cuesTopicsCorrect);
      }
      router.replace({ pathname: "/lotus-recall", params: { firstBattle: "1" } });
      return;
    }

    // Push 1 prologue boss: no normal Game Over, no normal victory rewards.
    // Advance prologue phase to lotus_recall_cinematic then return to
    // /opening-prologue so the rich LotusRecallCinematic component plays.
    if (isPrologueBoss) {
      // C1: grant obj_prologue_done XP (step 1 — Recall Stabilized). Awaited
      // so XP is persisted before the navigation tear-down removes this screen.
      const isPrologueNew = await completeObjective("obj_prologue_done");
      if (isPrologueNew) {
        await markObjectiveXpGranted("obj_prologue_done");
        await applyRewards({ xp: 10, codexShards: 0, crowns: 0, codex: [], enemyId: "", enemyName: "prologue" });
      }
      try { await advanceProloguePhase("lotus_recall_cinematic"); } catch {}
      router.replace("/opening-prologue" as any);
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
        await applyRewards({
          xp: replayXp, codexShards: 0, crowns: 0, codex: [],
          enemyId: enemy.id, enemyName: enemy.name,
          repeatable: true,
          progressionValue: journeyIsChapterBoss || isBossEnemy ? 5 : journeyIsAreaBoss ? 3 : enemy.difficulty >= 3 ? 2 : 1,
        });
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
      // Experience Scroll drop — 2★+ wins reward scroll(s) that fuel the
      // Training Hall. Training and prologue battles are excluded so players
      // can't farm scrolls through free practice runs.
      // Star rating isn't known until computeStars below, so we use a
      // sentinel and patch the delta after starResult is computed.
      // (Patched at the "scroll patch" comment below, after starResult.)

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

      // Scroll patch — tiered Experience Scroll drops based on star rating and
      // boss status. Training and prologue battles are excluded (not farmable).
      if (!isTraining && !isPrologueTutorial) {
        for (const { key, count } of getBattleScrollDrop(starResult.stars, isBossEnemy)) {
          inventoryDelta[key] = (inventoryDelta[key] || 0) + count;
        }
      }

      const rewardsResult = journeyIsChapterBoss === '1' && journeyRunId && journeyTileId
        ? await claimJourneyChapterBoss(journeyRunId, journeyTileId)
        : journeyIsAreaBoss === '1' && journeyRunId && journeyTileId && journeyChapterId
          ? await claimJourneyAreaBoss(journeyRunId, Number(journeyChapterId), journeyTileId)
        : !!enemy.worldBoss
          ? await completeVerdantha()
        : await applyRewards({
          xp: playerXpEarned, codex: enemy.teaches, enemyId: enemy.id, enemyName: enemy.name, codexShards: shards, crowns, epidemicTokens: epidemicTokensEarned, inventoryDelta,
          contentKey: enemy.id,
          mastery: enemy.bestCounters.reduce((acc, c) => {
            const map: Record<string, keyof typeof acc> = { scout: "assessment", stabilize: "stabilization", strike: "pharmacology", shield: "judgment", command: "command", analyze: "systems", support: "stabilization" };
            const key = map[c]; if (key) acc[key] = (acc[key] || 0) + 1; return acc;
          }, {} as any),
          bossId: isBossEnemy ? enemy.id : undefined,
          regionId: mission?.kingdomRegion ?? undefined,
          heroXp: heroXpEarned,
          repeatable: !isFirstClear && !isTraining && !isPrologueTutorial,
          progressionValue: journeyIsChapterBoss || isBossEnemy ? 5 : journeyIsAreaBoss ? 3 : enemy.difficulty >= 3 ? 2 : 1,
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
        await applyRewards({ xp: LOSS_LEARNING_XP, codexShards: 0, crowns: 0, codex: [], enemyId: enemy.id, enemyName: enemy.name, repeatable: true, progressionValue: journeyIsChapterBoss || isBossEnemy ? 5 : journeyIsAreaBoss ? 3 : enemy.difficulty >= 3 ? 2 : 1 });
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
        // Journey fog-map context — threaded through so result.tsx can route
        // back to the exact fog-map tile rather than the generic Journey tab.
        journeyReturn:        journeyReturn        ?? "",
        journeyChapterId:     journeyChapterId     ?? "",
        journeyTileId:        journeyTileId        ?? "",
        journeyIsAreaBoss:    journeyIsAreaBoss    ?? "",
        journeyIsChapterBoss: journeyIsChapterBoss ?? "",
        journeyShift:         journeyShift         ?? "",
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
        {/* No ✕ instant-exit — leaving an encounter is a Run attempt with a
            speed-based success roll (see handleRun). */}
        {!isMandatoryBattle && state.outcome === "ongoing" && (
          <Pressable style={styles.runBtn} onPress={handleRun} testID="battle-run">
            <Ionicons name="walk" size={13} color={COLORS.onSurface} />
            <Text style={styles.runBtnTxt}>RUN {Math.round(getRunChance(state) * 100)}%</Text>
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
              {isTraining && !isPrologueTutorial && <View style={styles.trainingTag}><Text style={styles.trainingTxt}>TRAINING</Text></View>}
            </View>
            <Text style={styles.enemyName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{enemy.name}</Text>
            <View style={styles.systemPills}>
              {enemy.weakElement && (
                <View style={[styles.sysPill, { borderColor: ELEMENT_COLORS[enemy.weakElement] }]}>
                  <Text style={[styles.sysTxt, { color: ELEMENT_COLORS[enemy.weakElement] }]}>Weak: {enemy.weakElement}</Text>
                </View>
              )}
            </View>
            {/* Push 2: Corruption Aspect + Weak Element rows */}
            {enemy.corruptionAspect ? (
              <View style={styles.enemyInfoRow} accessibilityLabel={`Corruption Aspect: ${enemy.corruptionAspect}`}>
                <Text style={styles.enemyInfoLabel}>Corruption Aspect</Text>
                <Text style={styles.enemyInfoValue}>{enemy.corruptionAspect}</Text>
              </View>
            ) : null}
            {/* Push 3: enemy panel weak-element — phase-resolved for bosses like Verdantha */}
            <View style={styles.enemyInfoRow} accessibilityLabel={displayWeakElement !== 'unknown' && displayWeakElement !== null ? `Weak Element: ${displayWeakElement}` : displayWeakElement === null ? "Weak Element: None this phase" : "Weak Element: Unknown"}>
              <Text style={styles.enemyInfoLabel}>Weak Element</Text>
              {displayWeakElement !== 'unknown' && displayWeakElement !== null ? (
                <View style={styles.enemyInfoWeakPill}>
                  <Text style={[styles.enemyInfoWeakTxt, { color: ELEMENT_COLORS[displayWeakElement] }]}>⚡ {displayWeakElement}</Text>
                </View>
              ) : displayWeakElement === null ? (
                <Text style={[styles.enemyInfoValue, { color: COLORS.onSurfaceTertiary }]}>None this phase</Text>
              ) : (
                <Text style={[styles.enemyInfoValue, { color: COLORS.onSurfaceTertiary }]}>Unknown</Text>
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
          // primaryAffinity drives the arena background and enemy thematic colour.
          primaryAffinity: enemy.primaryAffinity,
          // weakElement is for combat counter UI only — not used for bg/colour.
          weakElement: enemy.weakElement,
          dangerTrigger: enemy.dangerTrigger,
          bestCounters: enemy.bestCounters,
          visibleClues: [...enemy.visibleClues, ...enemy.hiddenClues].filter((c) => state.visibleClues.includes(c.id)),
          floats: enemy.floats,
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
            <Text style={[styles.barLabel, styles.barLabelTappable]} numberOfLines={1}>CORRUPTION</Text>
          </Pressable>
          <View style={styles.barBg}><View style={[styles.barFill, { width: `${corruptionPct}%`, backgroundColor: COLORS.corruptCrystal }]} /></View>
          <Text style={styles.barVal} numberOfLines={1}>{state.corruption}/{enemy.corruption}</Text>
        </View>
        <View style={styles.barRow}>
          <Pressable hitSlop={8} onPress={() => showTermTooltip("Stability", "How safely the patient is holding on. Keep it above zero — Corruption escalates every turn. If it hits 0, the patient is lost.")} testID="term-tap-stability">
            <Text style={[styles.barLabel, styles.barLabelTappable]} numberOfLines={1}>STABILITY</Text>
          </Pressable>
          <View style={styles.barBg}><View style={[styles.barFill, { width: `${state.stability}%`, backgroundColor: stabilityColor }]} /></View>
          <Text style={[styles.barVal, { color: stabilityColor }]} numberOfLines={1}>{state.stability}/100</Text>
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
              {/* Push F: authored mentorText takes precedence over generated hints
                  when an assist rule is active.  +10 Stability (mentorAid) still
                  applies — it is a mechanic, not a display choice. */}
              {mentorAid
                ? `+10 Stability. ${activeAssistRule?.mentorText ?? hints.tactical}`
                : activeAssistRule
                ? activeAssistRule.mentorText
                : tacticalHint
                ? hints.tactical
                : gentleHint
                ? hints.gentle
                : `Match actions to the ${enemy.corruptionAspect} pathology.`}
            </Text>
          </Text>
          <Ionicons name={codexExpanded ? "chevron-up" : "chevron-down"} size={11} color={COLORS.onSurfaceTertiary} />
        </Pressable>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.clueScrollView}
          contentContainerStyle={styles.clueRow}
        >
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
        </ScrollView>
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
            treatmentChain={state.enemyClinical?.treatmentChain}
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
          <View style={styles.actionsPanel}>
            {/* Temporary bonus actions sit above the paged grid (rare game modifiers) */}
            {state.temporaryActionIds.length > 0 && (
              <View style={styles.grid}>
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
              </View>
            )}
            {/* Paged skill grid — all cards fixed to the same width + height */}
            {(() => {
              const selHero = state.team.find(h => h.id === state.selectedHeroId);
              if (!selHero) return <Text style={styles.emptyTab}>Tap a hero above to select.</Text>;
              const acted = !!state.heroActionsUsed[selHero.id];
              if (acted) return <Text style={styles.emptyTab}>{selHero.name} has already acted.</Text>;
              const isBoss = (state.enemyClinical?.rewardBase || 0) >= 100;
              const careDmg = careAttemptDamage(state.chapter, isBoss);
              const careDisabled = state.ap < 1 || state.outcome !== "ongoing" || isFirstBattleActionStep;
              const careApBlocked = state.ap < 1;

              const careEntry = {
                key: "care-attempt",
                node: (
                  <Pressable style={[styles.skillCard, { borderColor: COLORS.onSurfaceTertiary }, careDisabled && styles.disabled, careApBlocked && styles.apBlocked]} onPress={() => { if (guidedStep) { tutorialNudge(); return; } if (careDisabled) { showBlockMsg(state.ap < 1 ? "Not enough AP." : "Not available right now."); return; } setState(prev => applyCareAttempt(prev).state); triggerFx(selHero.id); }} testID="battle-care-attempt">
                    <View style={styles.basicTag}><Text style={styles.basicTagTxt}>BASIC</Text></View>
                    <View style={styles.actionHead}>
                      <Ionicons name="medkit-outline" size={14} color={COLORS.onSurfaceTertiary} style={styles.skillTypeIcon} />
                      <Text style={styles.actionName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Care Attempt</Text>
                      <Text style={styles.apTag}>1 AP</Text>
                    </View>
                    <Text style={styles.actionEffect} numberOfLines={3}>Unfocused aid · −{careDmg} Corruption.</Text>
                    <Text style={styles.actionHero} numberOfLines={1}>Fallback — targeted skills are stronger</Text>
                  </Pressable>
                ),
              };

              const skillEntries = selHero.skills.map(skill => {
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
                return {
                  key: `${selHero.id}-${skill.id}`,
                  node: (
                    <Animated.View style={[{ flex: 1 }, isGuidedSkill ? { transform: [{ scale: skillPulseAnim }] } : undefined]}>
                      <Pressable style={[styles.skillCard, { borderColor: statusColor(preview.status) }, disabled && styles.disabled, apBlocked && styles.apBlocked, isGuidedSkill && styles.guidedHighlight]} onPress={() => { if (!disabled) { handleSkill(selHero, skill); return; } if (isWrongType) { tutorialNudge(); return; } if (isLocked) { showBlockMsg("This skill is locked for this battle."); return; } if (state.ap < cost) { showBlockMsg("Not enough AP for this skill."); return; } showBlockMsg(selHero.name + " has already acted this turn."); }} onLongPress={() => disabled ? null : setDetail({ kind: "skill", hero: selHero, skill })} delayLongPress={350} testID={`battle-skill-${skill.id}`}>
                        <StatusBadge status={preview.status} />
                        <View style={styles.actionHead}>
                          <Ionicons name={(SKILL_TYPE_ICONS[skill.type] || "ellipse-outline") as any} size={14} color={SKILL_CHAIN_COLOR[skill.type] || COLORS.onSurfaceTertiary} style={styles.skillTypeIcon} />
                          <Text style={styles.actionName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{skill.name}</Text>
                          <Text style={styles.apTag}>{cost} AP</Text>
                        </View>
                        <Text style={styles.actionEffect} numberOfLines={3}>{skill.shortEffect || skill.description}</Text>
                        <Text style={[styles.actionHero, { color: SKILL_CHAIN_COLOR[skill.type] || COLORS.onSurfaceTertiary }]} numberOfLines={1}>{sageDisc ? "Sage · " : ""}{airDisc ? "Air disc · " : ""}{(() => { const firstRole = SKILL_CLINICAL[skill.id]?.pathwayRoles?.[0]; const label = firstRole ? PATHWAY_ROLE_LABEL[firstRole] : SKILL_CHAIN_LABEL[skill.type]; return label ? `${label} · ` : ""; })()}{skill.systemType || "Universal"}</Text>
                        {/* Push 2 / Push 3: Elemental Counter chip — phase-resolved; suppressed during prologue tutorial */}
                        {skill.type === "strike" && !state.suppressElementCounter && displayWeakElement !== 'unknown' && displayWeakElement !== null && selHero.element === displayWeakElement ? (
                          <View style={styles.elemCounterChip} accessibilityLabel="Elemental Counter active">
                            <Text style={styles.elemCounterTxt}>⚡ Elemental Counter</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    </Animated.View>
                  ),
                };
              });

              const entries = [careEntry, ...skillEntries];
              const CARDS_PER_PAGE = 4;
              const totalPages = Math.ceil(entries.length / CARDS_PER_PAGE);
              const page = Math.min(skillPage, Math.max(0, totalPages - 1));
              const visible = entries.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE);

              return (
                <ScrollView
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ flexGrow: 1, gap: SPACING.sm }}
                >
                  <View style={styles.skillPageGrid}>
                    {/* Row 1 — first two cards share available height */}
                    <View style={styles.skillGridRow}>
                      {visible.slice(0, 2).map(e => (
                        <View key={e.key} style={styles.skillCardSlot}>{e.node}</View>
                      ))}
                    </View>
                    {/* Row 2 — cards 3-4 (always present: Care Attempt + ≥1 skill) */}
                    {visible.length > 2 && (
                      <View style={styles.skillGridRow}>
                        {visible.slice(2, 4).map(e => (
                          <View key={e.key} style={styles.skillCardSlot}>{e.node}</View>
                        ))}
                      </View>
                    )}
                  </View>
                  {totalPages > 1 && (
                    <View style={styles.skillPageNav}>
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <Pressable key={i} onPress={() => setSkillPage(i)} hitSlop={10}>
                          <View style={[styles.skillPageDot, i === page && styles.skillPageDotActive]} />
                        </Pressable>
                      ))}
                    </View>
                  )}
                </ScrollView>
              );
            })()}
          </View>
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
                    Cards marked <Text style={{ color: "#A6D8F6" }}>Assess</Text>, <Text style={{ color: "#4FD8C4" }}>Stabilize</Text>, <Text style={{ color: "#F97316" }}>Treat</Text>, or <Text style={{ color: "#BBA7EA" }}>Reassess</Text> count toward your Care Pathway. <Text style={{ color: "#E8C868" }}>Support</Text> cards provide direct aid — shields, buffs, emergency calls — but do not advance the pathway.
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
                      <Text style={styles.teamRole}>{heroRoleLabel(h.role)} · {h.element}</Text>
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
                    {player.aptitude === "guardian" && "🛡 Guardian's Vigil: -5 Instability per enemy turn."}
                    {player.aptitude === "sage" && "🔍 Sage's Eye: first Assess each battle costs -1 AP."}
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
            {/* Push 12: ScrollView so the calc breakdown never clips on small screens */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScroll} keyboardShouldPersistTaps="handled">
              <DetailContent detail={detail} state={state} onUse={() => {
                if (detail.kind === "skill") handleSkill(detail.hero, detail.skill);
                else if (detail.kind === "temp") handleTempAction(detail.actionId);
                else if (detail.kind === "item") handleUseItem(detail.item);
                else if (detail.kind === "call") handleCall(detail.option);
              }} />
            </ScrollView>
            <Pressable style={styles.modalDismiss} onPress={() => setDetail(null)} testID="detail-cancel">
              <Text style={styles.modalDismissTxt}>CLOSE</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}

      {state.pendingCue && !cueFeedback && state.outcome === "ongoing" && activeTutorialId !== "clinicalCueIntro" && (!isPrologueTutorial || guidedCueStep) && (
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
          onDismiss={() => {
            setShowObjective(false);
            if (isPrologueTutorial && !player?.seen_florence_cameo) {
              setShowFlorenceCameo(true);
            } else if (isPrologueBoss && !player?.seen_boss_narrator) {
              setShowBossNarrator(true);
            }
          }}
        />
      )}
      {showFlorenceCameo && (
        <FlorenceCameoOverlay onDismiss={dismissFlorenceCameo} />
      )}
      {showBossNarrator && (
        <MasterBaiBossNarratorOverlay onDismiss={dismissBossNarrator} />
      )}

      {/* Push 3 — Fluid Phantom: one-time Elemental Counter tutorial */}
      <Modal visible={showCounterTutorial} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.cardTutModalOverlay}>
          <View style={styles.cardTutModal}>
            <View style={styles.cardTutHeader}>
              <Ionicons name="flash" size={22} color="#A78BFA" />
              <Text style={styles.cardTutTitle}>Elemental Counter</Text>
            </View>
            <Text style={styles.cardTutBody}>
              When a hero's element matches an enemy's weakness, strike skills deal +30% damage. This is called an Elemental Counter.
            </Text>
            <Text style={styles.cardTutBody}>
              Elemental counters improve strikes. They do not replace correct clinical decisions.
            </Text>
            <Text style={styles.cardTutBody}>
              Scout the patient first — the enemy's weak element is hidden until you look for it.
            </Text>
            <Pressable style={styles.cardTutBtn} onPress={dismissCounterTutorial} testID="counter-tutorial-dismiss">
              <Text style={styles.cardTutBtnTxt}>Understood</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Push 3 — Lord Imbalance: one-time Clinical Expertise tutorial */}
      <Modal visible={showExpertiseTutorial} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.cardTutModalOverlay}>
          <View style={styles.cardTutModal}>
            <View style={styles.cardTutHeader}>
              <Ionicons name="medkit" size={22} color="#4FD8C4" />
              <Text style={styles.cardTutTitle}>Clinical Expertise</Text>
            </View>
            <Text style={styles.cardTutBody}>
              Heroes perform more reliably when their clinical expertise matches the enemy's health domain.
            </Text>
            <Text style={styles.cardTutBody}>
              An Assessor excels in diagnostic conditions; a Stabilizer shines in fluid and stability crises. Matching expertise improves every action you take.
            </Text>
            <Text style={styles.cardTutBody}>
              Check the enemy's primary system and lead with the hero whose role fits best.
            </Text>
            <Pressable style={styles.cardTutBtn} onPress={dismissExpertiseTutorial} testID="expertise-tutorial-dismiss">
              <Text style={styles.cardTutBtnTxt}>Understood</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Push 12: Advanced calculation breakdown ───────────────────────────────────

function CalcBreakdownView({ breakdown }: { breakdown: CalcBreakdown }) {
  const effectLabel =
    breakdown.effectType === "strike"    ? "Corruption reduced"
    : breakdown.effectType === "stabilize" ? "Stability restored"
    :                                        "Shield";
  return (
    <View style={styles.calcBox}>
      <View style={styles.calcRow}>
        <Text style={styles.calcLabel}>Base</Text>
        <Text style={styles.calcVal}>{breakdown.baseDisplay}</Text>
      </View>
      {breakdown.rows.map((row, i) => (
        <View key={i} style={styles.calcRow}>
          <Text style={styles.calcLabel}>{row.label}</Text>
          <Text style={[styles.calcVal, row.kind === "mult" && row.value < 1.0 ? styles.calcValNeg : undefined]}>
            {row.kind === "mult"
              ? `×${row.value.toFixed(2)}`
              : `+${Math.round(row.value)}`}
          </Text>
        </View>
      ))}
      <View style={styles.calcDivider} />
      <View style={styles.calcRow}>
        <Text style={styles.calcEstLabel}>Est. {effectLabel}</Text>
        <Text style={styles.calcEstVal}>~{breakdown.estimated}</Text>
      </View>
      <Text style={styles.calcNote}>{breakdown.note}</Text>
    </View>
  );
}

function DetailContent({ detail, state, onUse }: { detail: DetailEntry; state: BattleState; onUse: () => void }) {
  // Push 12: toggle for the advanced calc breakdown — must be before any early returns.
  const [showCalc, setShowCalc] = useState(false);

  if (detail.kind === "skill") {
    const { hero, skill } = detail;
    // Push 12: pre-compute breakdown (pure, safe to call in render).
    const breakdown = buildSkillCalcBreakdown(state, hero, skill);
    const hasCalc = breakdown.effectType !== "none";
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
        {/* Push 2 / Push 3: Elemental Counter chip in detail — uses the same
            scouting gate as the action cards so the hidden weakness is never
            exposed before the player scouts. Phase-resolved for bosses. */}
        {(() => {
          // Mirror the displayWeakElement logic: non-phase enemies require at least
          // one scouted clue before the weakness is considered known.
          const hasPhases = !!(state.enemy.phases && state.enemy.phases.length > 0);
          const isPhase3Unrevealed = hasPhases
            && state.activePhaseIndex >= (state.enemy.phases?.length ?? 1) - 1
            && !state.phase3WeakElementRevealed;
          let dw: import("@/src/game/types").ElementSystem | null | 'unknown';
          if (hasPhases) {
            dw = isPhase3Unrevealed ? 'unknown' : resolveEnemyWeakElement(state);
          } else {
            dw = state.visibleClues.length > 0 ? state.enemy.weakElement : 'unknown';
          }
          return skill.type === "strike" && !state.suppressElementCounter && dw !== 'unknown' && dw !== null && hero.element === dw ? (
            <View style={styles.elemCounterDetailChip} accessibilityLabel="Elemental Counter active: this skill deals bonus damage">
              <Text style={styles.elemCounterDetailTxt}>⚡ Elemental Counter — {hero.element} disrupts {state.enemy.corruptionAspect}. Strike +30%.</Text>
            </View>
          ) : null;
        })()}
        {hasCalc && (
          <Pressable style={styles.calcToggle} onPress={() => setShowCalc(v => !v)} testID="detail-calc-toggle">
            <Ionicons name={showCalc ? "chevron-up-outline" : "analytics-outline"} size={11} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.calcToggleTxt}>{showCalc ? "Hide formula" : "Show formula"}</Text>
          </Pressable>
        )}
        {hasCalc && showCalc && <CalcBreakdownView breakdown={breakdown} />}
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
};

const SKILL_CHAIN_COLOR: Record<string, string> = {
  scout:     "#5ECBC8",
  stabilize: "#6EE7B7",
  strike:    "#FBA94C",
  analyze:   "#A78BFA",
  shield:    "#94A3B8",
  support:   "#34D399",
  command:   "#F472B6",
};

const SKILL_CHAIN_LABEL: Record<string, string> = {
  scout:     "Assess",
  stabilize: "Stabilize",
  strike:    "Treat",
  analyze:   "Assess",   // most analyze skills reveal clues = Assess; the named
                         // 'Reassess' skill carries 'Reassess •' in shortEffect
  shield:    "Protect",
  support:   "Support",
  command:   "Escalate",
};

// ── Battle Glossary ──────────────────────────────────────────────────────────

const BATTLE_GLOSSARY: { term: string; desc: string }[] = [
  { term: "Stability", desc: "How safely the patient is holding on. Keep it above zero — Corruption escalates every turn. If it hits 0, the patient is lost." },
  { term: "Corruption", desc: "How much the illness is still taking over. Lower it to zero to win. Some illnesses can spread, recover, or behave in unexpected ways." },
  { term: "Cue", desc: "A clue about what is wrong with the patient. Answer correctly for bonus AP." },
  { term: "Assess", desc: "Find a hidden clue. Reveal clues before high-cost moves." },
  { term: "Stabilize", desc: "Keep the patient safe and hold off deterioration." },
  { term: "Treat", desc: "Directly weaken the illness and lower Corruption." },
  { term: "Reassess", desc: "Check what changed — often reveals new information." },
];

// ── Care Chain Rhythm Strip ───────────────────────────────────────────────────

interface StripStep {
  label: string;
  role: PathwayRole;
  icon: string;
  color: string;
}

const STRIP_STEPS: StripStep[] = [
  { label: "Assess",    role: "assess",    icon: "eye-outline",             color: "#5ECBC8" },
  { label: "Stabilize", role: "stabilize", icon: "heart-outline",           color: "#6EE7B7" },
  { label: "Treat",     role: "treat",     icon: "flash-outline",           color: "#FBA94C" },
  { label: "Reassess",  role: "reassess",  icon: "refresh-circle-outline",  color: "#A78BFA" },
];

/** Metadata for every possible PathwayRole so dynamic treatmentChain steps render correctly. */
const ROLE_STEP_META: Record<PathwayRole, Omit<StripStep, "role">> = {
  assess:    { label: "Assess",    icon: "eye-outline",             color: "#5ECBC8" },
  stabilize: { label: "Stabilize", icon: "heart-outline",           color: "#6EE7B7" },
  treat:     { label: "Treat",     icon: "flash-outline",           color: "#FBA94C" },
  protect:   { label: "Protect",   icon: "shield-outline",          color: "#60A5FA" },
  reassess:  { label: "Reassess",  icon: "refresh-circle-outline",  color: "#A78BFA" },
  escalate:  { label: "Escalate",  icon: "arrow-up-circle-outline", color: "#F87171" },
};
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

function CareChainStrip({ chain, isTutorial, currentStepId, treatmentChain }: {
  chain: BattleState["chain"];
  isTutorial: boolean;
  currentStepId: string | undefined;
  /** The active enemy's treatmentChain. When provided the strip renders those
   *  steps in order instead of the hardcoded 4-step default. */
  treatmentChain?: PathwayRole[];
}) {
  // Build the display steps: use the enemy's treatmentChain when available,
  // fall back to the legacy hardcoded STRIP_STEPS for enemies without one.
  const displaySteps: StripStep[] = useMemo(() => {
    if (treatmentChain && treatmentChain.length > 0) {
      return treatmentChain.map(role => ({ role, ...ROLE_STEP_META[role] }));
    }
    return STRIP_STEPS;
  }, [treatmentChain]);

  const activeIdx = isTutorial ? (STRIP_TUTORIAL_STEP[currentStepId ?? ""] ?? -1) : -1;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (activeIdx >= 0 && activeIdx < displaySteps.length) {
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
  }, [activeIdx, displaySteps.length, pulseAnim]);

  return (
    <View style={styles.stripRow}>
      {displaySteps.map((step, idx) => {
        // Always derive completion from real chain.progress.
        // activeIdx only drives the pulsing "current step" indicator.
        const done = chain.progress.includes(step.role);
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
      { icon: "list-outline",               text: "Use Assess → Stabilize → Treat → Reassess in sequence" },
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
    note: "Assess and Reassess may reveal hidden Corruption patterns.",
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
      { icon: "git-branch-outline",    text: "Build the Care Pathway: Assess → Stabilize → Treat → Reassess" },
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

function FlorenceCameoOverlay({ onDismiss }: { onDismiss: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [typingDone, setTypingDone] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handleDismiss = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => onDismiss());
  };

  const LINES = [
    "Before your first shift begins…",
    "A legendary light flickers at the edge of the ward.",
    "Florence Nightingale — The Lady with the Lamp — briefly lends her lamp's glow to guide your hands.",
    "Her voice is quiet, certain:",
    "\"Statistics are the lamp. Compassion is the light. Use both.\"",
  ];
  const fullText = LINES.join("\n\n");

  return (
    <Pressable style={styles.cameoOverlay} onPress={typingDone ? handleDismiss : undefined} testID="florence-cameo-overlay">
      <Animated.View style={[styles.cameoCard, { opacity: fadeAnim }]}>
        <View style={styles.cameoNarratorRow}>
          <View style={[styles.cameoNarratorDot, { backgroundColor: MASTER_BAI.color }]} />
          <Text style={[styles.cameoNarratorName, { color: MASTER_BAI.color }]}>Master Bai</Text>
        </View>
        <View style={styles.cameoLampRow}>
          <Text style={styles.cameoLampIcon}>🕯</Text>
          <Text style={styles.cameoHeroName}>Florence Nightingale</Text>
          <Text style={styles.cameoLampIcon}>🕯</Text>
        </View>
        <View style={styles.cameoTextBox}>
          <TypewriterText
            text={fullText}
            style={styles.cameoText}
            speed={18}
            onComplete={() => setTypingDone(true)}
          />
        </View>
        <Pressable style={styles.camoeDismissBtn} onPress={handleDismiss} testID="florence-cameo-dismiss">
          <Text style={styles.camoeDismissTxt}>ENTER THE WARD</Text>
        </Pressable>
        <Text style={styles.cameoHint}>She will not fight alongside you today — but her legacy lights the way.</Text>
      </Animated.View>
    </Pressable>
  );
}

function MasterBaiBossNarratorOverlay({ onDismiss }: { onDismiss: () => void }) {
  const insets   = useSafeAreaInsets();
  const { height: H, width: W } = Dimensions.get("window");
  const BAR_H    = 200;
  const barTotal = BAR_H + insets.bottom;

  const BEATS = [
    {
      name:     "Master Bai",
      color:    MASTER_BAI.color,
      barColor: "rgba(22,16,4,0.96)" as const,
      portrait: require("../assets/images/master_bai_vn_extended.png"),
      avatar:   require("../assets/images/master_bai_vn_bust.png"),
      line:     "What stands before you cannot be overcome by force alone. Read every sign. This battle is not meant to be won.",
    },
    {
      name:     "The Prodigy",
      color:    "#9B8CF7",
      barColor: "rgba(12,8,24,0.96)" as const,
      portrait: require("../assets/images/prodigy_vn_extended.png"),
      avatar:   require("../assets/images/prodigy_vn_bust.png"),
      line:     "I know.",
    },
  ] as const;

  const overlayFade = useRef(new Animated.Value(0)).current;
  const charFade    = useRef(new Animated.Value(0)).current;
  const barFade     = useRef(new Animated.Value(0)).current;
  const barSlide    = useRef(new Animated.Value(60)).current;
  const btnFade     = useRef(new Animated.Value(0)).current;

  const [beatIdx,   setBeatIdx]   = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [twDone,    setTwDone]    = useState(false);
  const [showBtn,   setShowBtn]   = useState(false);
  const twTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  function stopTw() {
    if (twTimer.current) { clearInterval(twTimer.current); twTimer.current = null; }
  }

  function playBeat(idx: number) {
    if (!mountedRef.current) return;
    const beat = BEATS[idx];
    setBeatIdx(idx);
    setDisplayed(""); setTwDone(false); setShowBtn(false);
    charFade.setValue(0); barFade.setValue(0); barSlide.setValue(60);
    Animated.parallel([
      Animated.timing(charFade, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(barFade,  { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(barSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      if (!mountedRef.current) return;
      let pos = 0;
      twTimer.current = setInterval(() => {
        pos++;
        setDisplayed(beat.line.slice(0, pos));
        if (pos >= beat.line.length) { stopTw(); if (mountedRef.current) setTwDone(true); }
      }, 28);
    });
  }

  useEffect(() => {
    mountedRef.current = true;
    Animated.timing(overlayFade, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => {
      setTimeout(() => playBeat(0), 200);
    });
    return () => { mountedRef.current = false; stopTw(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTap() {
    if (!twDone) {
      stopTw();
      setDisplayed(BEATS[beatIdx].line);
      setTwDone(true);
      return;
    }
    const next = beatIdx + 1;
    if (next < BEATS.length) { playBeat(next); return; }
    setShowBtn(true);
    Animated.timing(btnFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }

  function handleDismiss() {
    Animated.timing(overlayFade, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => onDismiss());
  }

  const beat = BEATS[beatIdx];

  return (
    <Pressable
      style={[styles.bossNarratorRoot, { zIndex: 9600 }]}
      onPress={handleTap}
      testID="boss-narrator-overlay"
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(4,4,8,0.90)", opacity: overlayFade }]} />

      {/* Portrait — grounded above VN bar */}
      <Animated.View
        style={[styles.bossNarratorPortraitWrap, { bottom: barTotal, width: W, height: H * 0.82, opacity: charFade }]}
        pointerEvents="none"
      >
        <ExpoImage
          source={beat.portrait}
          style={styles.bossNarratorPortraitImg}
          contentFit="contain"
          contentPosition="bottom"
        />
      </Animated.View>

      {/* VN dialogue bar */}
      <Animated.View
        style={[
          styles.bossNarratorBar,
          {
            height:          barTotal,
            paddingBottom:   insets.bottom + 14,
            opacity:         barFade,
            transform:       [{ translateY: barSlide }],
            backgroundColor: beat.barColor,
            borderTopColor:  `${beat.color}66`,
          },
        ]}
        pointerEvents="none"
      >
        <View style={[styles.bossNarratorBarAccent, { backgroundColor: beat.color }]} />
        <View style={styles.bossNarratorBarInner}>
          <View style={styles.bossNarratorLeftCol}>
            <View style={[styles.bossNarratorAvatarRing, { borderColor: beat.color }]}>
              <ExpoImage source={beat.avatar} style={styles.bossNarratorAvatarImg} contentFit="cover" />
            </View>
            <Text style={[styles.bossNarratorSpeakerName, { color: beat.color }]}>{beat.name}</Text>
          </View>
          <View style={styles.bossNarratorTextCol}>
            <Text style={styles.bossNarratorDlgText} numberOfLines={4}>
              {displayed}
              {!twDone && <Text style={{ color: beat.color }}>▌</Text>}
            </Text>
          </View>
          {twDone && !showBtn && (
            <View style={styles.bossNarratorArrowWrap}>
              <Text style={[styles.bossNarratorArrow, { color: beat.color }]}>▾</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Dismiss button — fades in after all beats */}
      {showBtn && (
        <Animated.View
          style={[styles.bossNarratorBtnWrap, { opacity: btnFade, paddingBottom: insets.bottom + barTotal + 16 }]}
          pointerEvents="box-none"
        >
          <Pressable style={styles.bossNarratorBtn} onPress={handleDismiss} testID="boss-narrator-dismiss">
            <Text style={styles.bossNarratorBtnTxt}>FACE THE INFARCT</Text>
          </Pressable>
        </Animated.View>
      )}
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
  runBtn: {
    position: "absolute", right: SPACING.xs, top: SPACING.xs, zIndex: 2,
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  runBtnTxt: { color: COLORS.onSurface, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
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
  barRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "nowrap" },
  barLabel: { color: COLORS.onSurfaceTertiary, fontSize: 11, letterSpacing: 0, fontWeight: "700", width: 64, flexShrink: 0 },
  barBg: { flex: 1, height: 8, backgroundColor: COLORS.surfaceTertiary, borderRadius: 2, overflow: "hidden", minWidth: 20 },
  barFill: { height: "100%", borderRadius: 2 },
  barVal: { color: COLORS.onSurface, fontSize: 11, fontWeight: "600", width: 58, textAlign: "right", flexShrink: 0 },
  codexCard: {
    backgroundColor: COLORS.brand + "18", borderRadius: 4,
    borderWidth: 1, borderColor: COLORS.brand + "50",
    borderLeftWidth: 3, borderLeftColor: COLORS.brand,
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  codexLabel: { color: COLORS.brand, fontSize: 12, fontWeight: "700", letterSpacing: 0.2, flex: 1, lineHeight: 17 },
  codexText: { color: COLORS.onSurfaceSecondary, fontWeight: "400", fontSize: 12 },
  clueScrollView: { flexShrink: 0 },
  clueRow: { flexDirection: "row", gap: SPACING.xs, paddingVertical: 2, alignItems: "flex-start" },
  clue: { width: 120, height: 52, padding: 4, borderRadius: 4, borderWidth: 1, gap: 1, backgroundColor: COLORS.surface },
  clueVisible: { borderColor: COLORS.brand + "80", borderTopWidth: 2, borderTopColor: COLORS.brand + "CC" },
  clueHidden: { borderColor: COLORS.borderStrong, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  clueLabel: { color: COLORS.onSurface, fontSize: 11, fontWeight: "700" },
  clueDetail: { color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 13 },

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
  zoneD: { flex: 1, paddingHorizontal: SPACING.sm, paddingTop: SPACING.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, paddingBottom: SPACING.sm },
  actionBtn: {
    width: "48.5%", minHeight: 80, padding: 10, borderRadius: 6,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderStrong, gap: 3,
  },
  // ── Skill pagination ──
  actionsPanel: { flex: 1, gap: SPACING.xs },
  // Two-row flex grid inside a ScrollView — each row has a guaranteed minimum
  // height (minHeight) so cards are never clipped on small screens, and the
  // ScrollView scrolls when content exceeds the available zone-D space.
  skillPageGrid: { flex: 1, gap: SPACING.sm },
  skillGridRow:  { flex: 1, flexDirection: "row", gap: SPACING.sm, minHeight: 88 },
  skillCardSlot: { flex: 1 },
  skillCard: {
    flex: 1, padding: 7, borderRadius: 6,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderStrong,
    gap: 2,
  },
  skillPageNav: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 4 },
  skillPageDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.borderStrong },
  skillPageDotActive: { width: 18, height: 7, borderRadius: 4, backgroundColor: COLORS.brand },
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

  // ── Florence Nightingale one-time cameo overlay ──
  cameoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9600,
    paddingHorizontal: 24,
  },
  cameoCard: {
    backgroundColor: "#1A1610",
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    width: "100%",
    maxWidth: 380,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: "#D9A44160",
  },
  cameoNarratorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cameoNarratorDot: { width: 7, height: 7, borderRadius: 4 },
  cameoNarratorName: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  cameoLampRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    marginTop: 2,
    marginBottom: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#D9A44130",
  },
  cameoLampIcon: { fontSize: 18 },
  cameoHeroName: {
    color: "#F5D48A",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  cameoTextBox: { minHeight: 100 },
  cameoText: {
    color: "#D4CAB8",
    fontSize: 14,
    lineHeight: 22,
    fontStyle: "italic",
  },
  camoeDismissBtn: {
    borderRadius: RADIUS.pill,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#D9A441",
    marginTop: 4,
  },
  camoeDismissTxt: { color: "#1A1610", fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  cameoHint: {
    color: "#8A8070",
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 16,
  },

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

  // ── Boss narrator VN overlay ──────────────────────────────────────────────
  bossNarratorRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  bossNarratorPortraitWrap: {
    position:        "absolute",
    left:            0,
    right:           0,
    alignItems:      "center",
    justifyContent:  "flex-end",
    backgroundColor: "transparent",
  },
  bossNarratorPortraitImg: { width: "100%", height: "100%" },
  bossNarratorBar: {
    position:       "absolute",
    bottom:         0,
    left:           0,
    right:          0,
    borderTopWidth: 1.5,
  },
  bossNarratorBarAccent: { height: 2, width: "100%", opacity: 0.8 },
  bossNarratorBarInner: {
    flex:              1,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingVertical:   12,
    gap:               14,
  },
  bossNarratorLeftCol: { alignItems: "center", gap: 6, flexShrink: 0, width: 92 },
  bossNarratorAvatarRing: {
    width:        92,
    height:       92,
    borderRadius: 46,
    borderWidth:  3,
    overflow:     "hidden",
  },
  bossNarratorAvatarImg:   { width: "100%", height: "100%" },
  bossNarratorSpeakerName: {
    fontSize:      10,
    fontWeight:    "800",
    letterSpacing: 1.2,
    textAlign:     "center",
    textTransform: "uppercase",
    lineHeight:    14,
  },
  bossNarratorTextCol: { flex: 1 },
  bossNarratorDlgText: {
    color:      "#E8EEF6",
    fontSize:   17,
    fontWeight: "400",
    lineHeight: 26,
  },
  bossNarratorArrowWrap: { alignSelf: "flex-end", paddingBottom: 4, flexShrink: 0 },
  bossNarratorArrow:     { fontSize: 24, fontWeight: "900", opacity: 0.9 },
  bossNarratorBtnWrap: {
    position:          "absolute",
    bottom:            0,
    left:              0,
    right:             0,
    paddingHorizontal: 24,
    alignItems:        "center",
  },
  bossNarratorBtn: {
    backgroundColor:  "#8B1A1A",
    borderRadius:     10,
    paddingVertical:  16,
    width:            "100%",
    alignItems:       "center",
  },
  bossNarratorBtnTxt: {
    color:         "#FFFFFF",
    fontSize:      13,
    fontWeight:    "800",
    letterSpacing: 3,
  },
  // Push 12 — Advanced calculation detail view
  detailScroll: { gap: 6 },
  calcToggle: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, alignSelf: "flex-start" },
  calcToggleTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "600" },
  calcBox: { backgroundColor: COLORS.surfaceTertiary, borderRadius: 8, padding: SPACING.sm, gap: 3, marginTop: 2 },
  calcRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 1 },
  calcLabel: { color: COLORS.onSurfaceTertiary, fontSize: 11, flex: 1 },
  calcVal: { color: COLORS.onSurface, fontSize: 11, fontWeight: "700" },
  calcValNeg: { color: "#FCA5A5" },
  calcDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  calcEstLabel: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700", flex: 1 },
  calcEstVal: { color: COLORS.brand, fontSize: 14, fontWeight: "800" },
  calcNote: { color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 14, marginTop: 2, fontStyle: "italic" },
  // Push 2 — Enemy info rows (Corruption Aspect, Weak Element)
  enemyInfoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 },
  enemyInfoLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 0.4, width: 90 },
  enemyInfoValue: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: "600", flex: 1 },
  enemyInfoWeakPill: { backgroundColor: "#1a1020", borderRadius: 5, borderWidth: 1, borderColor: "#6d28d9", paddingHorizontal: 6, paddingVertical: 1 },
  enemyInfoWeakTxt: { fontSize: 11, fontWeight: "700" },
  // Push 2 — Elemental Counter chip on skill card
  elemCounterChip: { backgroundColor: "#120c22", borderRadius: 4, borderWidth: 1, borderColor: "#7c3aed", paddingHorizontal: 5, paddingVertical: 1, alignSelf: "flex-start", marginTop: 2 },
  elemCounterTxt: { color: "#a78bfa", fontSize: 9, fontWeight: "700" },
  // Push 2 — Elemental Counter chip in skill detail panel
  elemCounterDetailChip: { backgroundColor: "#120c22", borderRadius: 6, borderWidth: 1, borderColor: "#7c3aed", padding: 8, marginTop: 4 },
  elemCounterDetailTxt: { color: "#a78bfa", fontSize: 12, fontWeight: "700", lineHeight: 17 },
});
