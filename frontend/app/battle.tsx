import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { BOSS_LORD_IMBALANCE, ENEMIES, HEROES } from "@/src/game/content";
import { getEnemyHint } from "@/src/game/onboarding";
import { getMission, getGuidedFeedback } from "@/src/game/missions";
import { applyCall, applyCareAttempt, applySkill, applyTempAction, careAttemptDamage, endPlayerTurn, initBattle, selectHero, useItem as applyItem, previewSkillStatus, previewItemStatus, previewTempStatus, previewCallStatus, type BattleState } from "@/src/game/battle";
import { CALL_OPTIONS, ITEMS, TEMP_ACTIONS, Item } from "@/src/game/items";
import { getStartingHandicap, statusColor, statusLabel, type ActionStatus, type LearningProfile } from "@/src/game/clinical";
import { LongPressCoachmark } from "@/src/components/LongPressCoachmark";
import { TipBubble, useTipsQueue } from "@/src/components/BattleTips";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { getHeroSprite } from "@/src/components/HeroSprites";
import { getEnemySprite } from "@/src/components/EnemySprites";
import type { Hero, HeroSkill } from "@/src/game/types";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

type Tab = "actions" | "items" | "call" | "team";

type DetailEntry =
  | { kind: "skill"; hero: Hero; skill: HeroSkill }
  | { kind: "temp"; actionId: string }
  | { kind: "item"; item: Item }
  | { kind: "call"; option: typeof CALL_OPTIONS[number] };

export default function Battle() {
  const { enemyId, training } = useLocalSearchParams<{ enemyId: string; training?: string }>();
  const { player, loading } = usePlayer();
  if (loading || !player) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg }}>
        <Text style={{ color: COLORS.onSurfaceTertiary }}>Loading…</Text>
      </View>
    );
  }
  return <BattleInner enemyId={enemyId} training={training} />;
}

function BattleInner({ enemyId, training }: { enemyId?: string; training?: string }) {
  const router = useRouter();
  const { player, applyRewards, recordFailure } = usePlayer();
  const { isCompleted, startTutorial, onRequiredAction } = useTutorial();
  const { width: screenW } = useWindowDimensions();
  const isTraining = training === "1";

  const enemy = useMemo(() => {
    if (!enemyId) return ENEMIES[0];
    if (enemyId === BOSS_LORD_IMBALANCE.id) return BOSS_LORD_IMBALANCE;
    return ENEMIES.find((e) => e.id === enemyId) || ENEMIES[0];
  }, [enemyId]);

  const team = useMemo(() => {
    if (!player) return HEROES.slice(0, 3);
    const teamIds = (player.active_team && player.active_team.length > 0) ? player.active_team : player.heroes_owned;
    const fromTeam = teamIds.map(id => HEROES.find(h => h.id === id)).filter(Boolean) as typeof HEROES;
    if (fromTeam.length >= 1) return fromTeam.slice(0, 3);
    return HEROES.slice(0, 3);
  }, [player]);

  const failureCount = (player?.failure_counts || {})[enemy.id] || 0;
  const mentorAid = failureCount >= 3;
  const tacticalHint = failureCount >= 2;
  const gentleHint = failureCount >= 1;

  const [state, setState] = useState<BattleState>(() => {
    const profile = (player?.learning_profile as LearningProfile | undefined) || undefined;
    const handicap = getStartingHandicap(profile);
    const mentorAid = failureCount >= 3;
    const base = initBattle(enemy, team, {
      inventory: player?.inventory || {},
      profile,
      enemyMastery: player?.enemy_mastery,
      chapter: player?.chapter_progress,
      startingStabilityBonus: handicap.startingStabilityBonus + (mentorAid ? 10 : 0) + (isTraining ? 10 : 0),
      enemyDamageReduction: handicap.enemyDamageReduction,
      revealOneExtraClue: handicap.revealOneExtraClue || isTraining,
    });
    let { stability, visibleClues, hiddenClueIds, revealedLabels, log } = base;

    if (player?.aptitude === "weaver" && hiddenClueIds.length > 0) {
      const revealed = hiddenClueIds.shift()!;
      visibleClues = [...visibleClues, revealed];
      const clue = enemy.hiddenClues.find(c => c.id === revealed);
      if (clue) revealedLabels = [...revealedLabels, clue.label];
      log = [...log, `⟡ Weaver's Eye: one hidden clue revealed at battle start.`];
    }
    if (mentorAid) log = [...log, `🕯 A mentor steadies your hand. Starting Stability +10.`];
    if (isTraining) log = [...log, `📜 Training Battle: hidden clue revealed, enemy weakened.`];
    return { ...base, stability, visibleClues, hiddenClueIds, revealedLabels, log };
  });

  const [activeTab, setActiveTab] = useState<Tab>("actions");
  const [showBriefing, setShowBriefing] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [codexExpanded, setCodexExpanded] = useState(false);
  const [sageScoutBonusUsed, setSageScoutBonusUsed] = useState(false);
  const [detail, setDetail] = useState<DetailEntry | null>(null);

  // ---- Contextual tutorial tips (one-shot, persisted) ----
  const tips = useTipsQueue();
  const prevHiddenCount = useRef(state.hiddenClueIds.length);
  const prevActionCount = useRef(state.turnsTaken);
  const prevTurn = useRef(state.turnsTaken);
  // Auto-start firstBattle tutorial on first visit
  useEffect(() => {
    if (!isCompleted("firstBattle")) {
      const t = setTimeout(() => startTutorial("firstBattle"), 800);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  const corruptionPct = (state.corruption / enemy.corruption) * 100;
  const hints = getEnemyHint(enemy.id);
  const mission = getMission(enemy.id);
  const isNonmedical = player?.learning_profile === "nonmedical";
  const isFirstBattle = (player?.runs_completed ?? 0) === 0 && enemy.id === "air_sprite";
  const sageDiscount = player?.aptitude === "sage" && !sageScoutBonusUsed;

  const showFeedback = (actionType: string) => {
    if (!isNonmedical) return;
    const msg = getGuidedFeedback(enemy.id, actionType);
    if (!msg) return;
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    setFeedbackMsg(msg);
    feedbackTimeout.current = setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleSkill = (hero: Hero, skill: HeroSkill) => {
    if (state.outcome !== "ongoing") return;
    let effective = skill;
    if (sageDiscount && skill.type === "scout" && skill.cost > 0) {
      effective = { ...skill, cost: Math.max(0, skill.cost - 1) };
      setSageScoutBonusUsed(true);
    }
    if (state.ap < effective.cost) return;
    onRequiredAction(skill.type);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setState((s) => applySkill(s, effective, hero).state);
    showFeedback(skill.type);
    setDetail(null);
  };
  const handleTempAction = (actionId: string) => {
    const res = applyTempAction(state, actionId);
    setState(res.state);
    setDetail(null);
  };
  const handleUseItem = (item: Item) => {
    const res = applyItem(state, item);
    setState(res.state);
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
    const itemName = opt.effect === "addRelevantItem" ? decideCallItem() : undefined;
    const res = applyCall(state, opt, itemName);
    setState(res.state);
    setDetail(null);
  };

  const handleEndTurn = () => {
    if (state.outcome !== "ongoing") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
    if (state.outcome === "win") {
      const isBoss = enemy.id === BOSS_LORD_IMBALANCE.id;
      const baseXp = isBoss ? 150 : 35 + enemy.difficulty * 10;
      const xp = isTraining ? Math.floor(baseXp * 0.5) : baseXp;
      const baseShards = isTraining ? 10 : (isBoss ? 100 : 25);
      const chainBonus = state.fullChainCompleted ? 10 : 0;
      const shards = baseShards + chainBonus;
      const startingInventory = player?.inventory || {};
      const inventoryDelta: Record<string, number> = {};
      for (const [k, v] of Object.entries(state.inventory)) {
        const diff = v - (startingInventory[k] || 0);
        if (diff !== 0) inventoryDelta[k] = diff;
      }
      await applyRewards({
        xp, codex: enemy.teaches, enemyId: enemy.id, enemyName: enemy.name, codexShards: shards, inventoryDelta,
        mastery: enemy.bestCounters.reduce((acc, c) => {
          const map: Record<string, keyof typeof acc> = { scout: "assessment", stabilize: "stabilization", strike: "pharmacology", shield: "judgment", cleanse: "judgment", command: "command", analyze: "systems", support: "stabilization" };
          const key = map[c]; if (key) acc[key] = (acc[key] || 0) + 1; return acc;
        }, {} as any),
        bossId: isBoss ? enemy.id : undefined,
      });
    } else if (state.outcome === "loss") {
      await recordFailure(enemy.id);
    }
    const isBoss2 = enemy.id === BOSS_LORD_IMBALANCE.id;
    const baseShards = state.outcome === "win" ? (isTraining ? 10 : (isBoss2 ? 100 : 25)) : 0;
    router.replace({
      pathname: "/result",
      params: {
        outcome: state.outcome,
        enemyId: enemy.id,
        stability: String(state.stability),
        training: isTraining ? "1" : "0",
        shards: String(baseShards),
        fullChain: state.fullChainCompleted ? "1" : "0",
        unsafe: String(state.unsafeActionsUsed),
        poorFit: String(state.poorFitActionsUsed),
        turns: String(state.turnsTaken),
        reassess: state.reassessUsedAnytime ? "1" : "0",
        consults: String(state.consultsUsed),
        emergency: String(state.emergencyCallsUsed),
        inappropriate: String(state.inappropriateConsultsUsed),
        basicAid: String(state.basicAidUses),
      },
    });
  };

  // (Skills are filtered per selected hero in the Actions tab)

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>

      {/* ── ZONE A: Enemy header (compact, ~18% height) ── */}
      <View style={styles.zoneA}>
        <Pressable style={styles.closeBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} testID="battle-close">
          <Ionicons name="close" size={16} color={COLORS.onSurface} />
        </Pressable>
        <Pressable style={styles.helpBtn} onPress={() => router.push("/tutorial")} hitSlop={10} testID="battle-tutorial-button">
          <Ionicons name="help-circle-outline" size={16} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={styles.enemyHeaderRow}>
          {getEnemySprite(enemy.id) && (
            <View style={[styles.enemyPortraitWrap, { borderColor: ELEMENT_COLORS[enemy.primarySystem] + "AA" }]}>
              <Image source={getEnemySprite(enemy.id)!} style={styles.enemyPortrait} resizeMode="cover" />
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
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
          </View>
        </View>
      </View>

      {/* ── ZONE B: Meters + Codex + Clues (~18% height) ── */}
      <View style={styles.zoneB}>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>CORRUPT</Text>
          <View style={styles.barBg}><View style={[styles.barFill, { width: `${corruptionPct}%`, backgroundColor: COLORS.error }]} /></View>
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
            {mentorAid ? "MENTOR'S AID: " : tacticalHint ? "MENTOR: " : gentleHint ? "CODEX WHISPERS: " : "CODEX: "}
            <Text style={styles.codexText}>
              {mentorAid ? `+10 Stability. ${hints.tactical}` : tacticalHint ? hints.tactical : gentleHint ? hints.gentle : `Match actions to the ${enemy.primarySystem} system.`}
            </Text>
          </Text>
          <Ionicons name={codexExpanded ? "chevron-up" : "chevron-down"} size={11} color={COLORS.onSurfaceTertiary} />
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clueRow}>
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
      </View>

      {/* ── ZONE C: Team + AP + Tabs (~16% height) ── */}
      <View style={styles.zoneC}>
        <View style={[styles.heroRow, { paddingHorizontal: SPACING.xs }]}>
          {team.map(h => {
            const acted = !!state.heroActionsUsed[h.id];
            const selected = state.selectedHeroId === h.id;
            const elementColor = ELEMENT_COLORS[h.element] || COLORS.brand;
            const pillW = Math.floor((screenW - SPACING.xs * 2 - (team.length - 1) * 5) / team.length);
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
              </Pressable>
            );
          })}
        </View>
        <View style={styles.apRow}>
          <Text style={styles.apLabel}>AP</Text>
          <View style={{ flexDirection: "row", gap: 4, flex: 1 }}>
            {Array.from({ length: state.apMax }).map((_, i) => (
              <View key={i} style={[styles.apDot, i < state.ap && styles.apDotOn]} />
            ))}
          </View>
          <Pressable onPress={handleEndTurn} style={styles.endBtn} disabled={state.outcome !== "ongoing"} testID="battle-end-turn">
            <Text style={styles.endTxt}>END TURN</Text>
          </Pressable>
        </View>
        <View style={styles.tabs}>
          {(["actions", "items", "call", "team"] as Tab[]).map(t => (
            <Pressable key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)} testID={`tab-${t}`}>
              <Text style={[styles.tabTxt, activeTab === t && styles.tabTxtActive]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.affordanceHint}>Tap to use · Long-press for details</Text>
      </View>

      {/* ── ZONE D: Action area (flex 1, scrolls internally) ── */}
      <View style={styles.zoneD}>
        {/* Objective strip / guided feedback banner */}
        {isNonmedical && feedbackMsg ? (
          <View style={styles.feedbackBanner}>
            <Ionicons name="information-circle" size={11} color={COLORS.brand} />
            <Text style={styles.feedbackText} numberOfLines={2}>{feedbackMsg}</Text>
          </View>
        ) : (
          <View style={styles.objectiveStrip}>
            <Text style={styles.objectiveText}>Goal: Scout → Stabilize → Counter → Reassess</Text>
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
                <Pressable key="care-attempt" style={[styles.actionBtn, { borderColor: COLORS.onSurfaceTertiary }, careDisabled && styles.disabled]} onPress={() => careDisabled ? null : setState(prev => applyCareAttempt(prev).state)} testID="battle-care-attempt">
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
                  <Pressable key={`${selHero.id}-${skill.id}`} style={[styles.actionBtn, { borderColor: statusColor(preview.status) }, disabled && styles.disabled]} onPress={() => disabled ? null : handleSkill(selHero, skill)} onLongPress={() => disabled ? null : setDetail({ kind: "skill", hero: selHero, skill })} delayLongPress={350} testID={`battle-skill-${skill.id}`}>
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
                      {Array.from({ length: h.rarity }).map((_, i) => (
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

      <TutorialOverlay />
      <LongPressCoachmark visible={activeTab === "actions" && !detail && state.outcome === "ongoing"} />

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

      {showBriefing && (
        <Pressable style={styles.briefingOverlay} onPress={() => setShowBriefing(false)}>
          <ScrollView contentContainerStyle={styles.briefingScroll} showsVerticalScrollIndicator={false}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              {isFirstBattle && (
                <View style={styles.briefingClinica}>
                  <Text style={styles.briefingClinicaKicker}>ABOUT CLINICA</Text>
                  <Text style={styles.briefingClinicaText}>
                    Clinica is a kingdom shaped like the human body. Disease corruption is spreading through the body systems. Your healer team must read clues, keep Patient Stability above 0, reduce Disease Corruption to 0, and restore each region.
                  </Text>
                </View>
              )}
              <Text style={styles.briefingKicker}>MISSION BRIEFING</Text>
              <Text style={styles.briefingTitle}>{mission?.missionTitle ?? enemy.name}</Text>
              <Text style={styles.briefingEnemy}>{enemy.name} · {enemy.realWorld}</Text>
              {mission && <Text style={styles.briefingStory}>{mission.story}</Text>}
              <View style={styles.briefingDivider} />
              <View style={styles.briefingRow}>
                <View style={styles.briefingCol}>
                  <Text style={styles.briefingColLabel}>SYSTEM</Text>
                  <Text style={styles.briefingColVal}>{enemy.primarySystem}</Text>
                </View>
                <View style={styles.briefingColSep} />
                <View style={styles.briefingCol}>
                  <Text style={styles.briefingColLabel}>RECOMMENDED</Text>
                  <Text style={styles.briefingColVal}>{(mission?.recommendedRoles ?? enemy.bestCounters).join(", ")}</Text>
                </View>
              </View>
              <View style={styles.briefingWinRow}>
                <Ionicons name="flag" size={12} color={COLORS.brand} />
                <Text style={styles.briefingWinText}>{mission?.winCondition ?? "Keep Stability above 0 and reduce Corruption to 0"}</Text>
              </View>
              <View style={styles.briefingDivider} />
              <Text style={styles.briefingGoalsTitle}>STAR GOALS</Text>
              {(mission?.starGoals ?? (["Win the battle", "Complete the care chain", "Win efficiently"] as [string,string,string])).map((g, i) => (
                <View key={i} style={styles.briefingGoalRow}>
                  {Array.from({ length: i + 1 }).map((_, j) => (
                    <Ionicons key={j} name="star-outline" size={11} color={COLORS.brand} />
                  ))}
                  <Text style={styles.briefingGoalText}>{g}</Text>
                </View>
              ))}
              <Pressable style={styles.briefingEnterBtn} onPress={() => setShowBriefing(false)} testID="briefing-enter">
                <Text style={styles.briefingEnterTxt}>ENTER BATTLE</Text>
              </Pressable>
              <Text style={styles.briefingDismissHint}>Tap anywhere to dismiss</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      )}

      {state.outcome !== "ongoing" && (
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
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  closeBtn: { position: "absolute", right: SPACING.xs, top: SPACING.sm, padding: 8, zIndex: 2 },
  helpBtn: { position: "absolute", right: SPACING.xs + 32, top: SPACING.sm, padding: 8, zIndex: 2 },
  enemyHeaderRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingRight: 68 },
  enemyPortraitWrap: { width: 60, height: 60, borderRadius: RADIUS.md, borderWidth: 2, overflow: "hidden", backgroundColor: COLORS.surfaceTertiary, flexShrink: 0 },
  enemyPortrait: { width: "100%", height: "100%" },
  enemyKicker: { color: COLORS.error, fontSize: 9, letterSpacing: 2, fontWeight: "700" },
  trainingTag: { backgroundColor: COLORS.brandTertiary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: RADIUS.pill },
  trainingTxt: { color: COLORS.brand, fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  enemyName: { color: COLORS.onSurface, fontSize: 20, fontWeight: "300", lineHeight: 22 },
  systemPills: { flexDirection: "row", gap: 4, marginTop: 2, flexWrap: "wrap" },
  sysPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.pill, borderWidth: 1 },
  sysTxt: { fontSize: 9, letterSpacing: 1, fontWeight: "700" },

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
  barBg: { flex: 1, height: 6, backgroundColor: COLORS.surfaceTertiary, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  barVal: { color: COLORS.onSurface, fontSize: 10, fontWeight: "600", width: 36, textAlign: "right" },
  codexCard: {
    backgroundColor: COLORS.brand + "10", borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.brand + "30",
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  codexLabel: { color: COLORS.brand, fontSize: 9, fontWeight: "700", letterSpacing: 0.4, flex: 1, lineHeight: 13 },
  codexText: { color: COLORS.onSurfaceSecondary, fontWeight: "400", fontSize: 9 },
  clueRow: { gap: SPACING.sm, paddingVertical: 2 },
  clue: { width: 90, height: 60, padding: SPACING.xs, borderRadius: RADIUS.sm, borderWidth: 1, gap: 2, backgroundColor: COLORS.surfaceSecondary },
  clueVisible: { borderColor: COLORS.brand + "60" },
  clueHidden: { borderColor: COLORS.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
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
  heroPill: { paddingHorizontal: 5, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceTertiary, alignItems: "center", overflow: "hidden" },
  heroPillActed: { opacity: 0.45 },
  heroPillName: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700" },
  heroPillRole: { color: COLORS.onSurfaceTertiary, fontSize: 8, fontWeight: "700", letterSpacing: 1, marginTop: 1 },
  apRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  apLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 1, fontWeight: "700" },
  apDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.border },
  apDotOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
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
    width: "48.5%", minHeight: 70, padding: 8, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.border, gap: 2,
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
  detailModal: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: 6, borderWidth: 1, borderColor: COLORS.brandTertiary, width: "100%", maxWidth: 380, maxHeight: "80%" },
  detailKicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 1.5, fontWeight: "700" },
  detailTitle: { color: COLORS.onSurface, fontSize: 22, fontWeight: "400", marginBottom: 2 },
  detailHero: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontStyle: "italic", marginBottom: 6 },
  detailSection: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 1.5, fontWeight: "700", marginTop: 8 },
  detailBody: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18 },
  useBtn: { backgroundColor: COLORS.brand, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center", marginTop: SPACING.md },
  useBtnTxt: { color: COLORS.onBrand, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  modalDismiss: { padding: SPACING.sm, alignItems: "center", marginTop: 4 },
  modalDismissTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  outcomeModal: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: "center", gap: SPACING.md, borderWidth: 1, borderColor: COLORS.brandTertiary, width: "100%", maxWidth: 380 },
  modalTitle: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300" },
  modalSub: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: "center", lineHeight: 19 },
  continueBtn: { backgroundColor: COLORS.brand, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.pill, marginTop: SPACING.sm },
  continueBtnTxt: { color: COLORS.onBrand, fontSize: 12, fontWeight: "700", letterSpacing: 2 },

  objectiveStrip: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 3, marginBottom: 3 },
  objectiveText: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.4, fontStyle: "italic" },
  feedbackBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 5,
    backgroundColor: COLORS.brand + "14", borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.brand + "30", marginBottom: 4,
  },
  feedbackText: { color: COLORS.brand, fontSize: 10, lineHeight: 14, flex: 1 },

  briefingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.93)", zIndex: 100 },
  briefingScroll: { padding: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.xxl },
  briefingClinica: {
    backgroundColor: COLORS.brand + "14", borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.brand + "30", marginBottom: SPACING.lg,
  },
  briefingClinicaKicker: { color: COLORS.brand, fontSize: 9, letterSpacing: 2, fontWeight: "700", marginBottom: 4 },
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
  briefingEnterBtn: { backgroundColor: COLORS.brand, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center", marginTop: SPACING.xl },
  briefingEnterTxt: { color: COLORS.onBrand, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  briefingDismissHint: { color: COLORS.onSurfaceTertiary, fontSize: 10, textAlign: "center", marginTop: SPACING.sm, fontStyle: "italic" },
});
