import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { BOSS_LORD_IMBALANCE, ENEMIES, HEROES } from "@/src/game/content";
import { getEnemyHint } from "@/src/game/onboarding";
import { applyCall, applyCareAttempt, applySkill, applyTempAction, careAttemptDamage, endPlayerTurn, initBattle, selectHero, useItem as applyItem, previewSkillStatus, previewItemStatus, previewTempStatus, previewCallStatus, type BattleState } from "@/src/game/battle";
import { CALL_OPTIONS, ITEMS, TEMP_ACTIONS, Item } from "@/src/game/items";
import { getStartingHandicap, statusColor, statusLabel, type ActionStatus, type LearningProfile } from "@/src/game/clinical";
import { LongPressCoachmark } from "@/src/components/LongPressCoachmark";
import { TipBubble, useTipsQueue } from "@/src/components/BattleTips";
import { getHeroSprite } from "@/src/components/HeroSprites";
import { getEnemySprite } from "@/src/components/EnemySprites";
import type { Hero, HeroSkill } from "@/src/game/types";
import { usePlayer } from "@/src/game/store";
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
  const [codexExpanded, setCodexExpanded] = useState(false);
  const [sageScoutBonusUsed, setSageScoutBonusUsed] = useState(false);
  const [detail, setDetail] = useState<DetailEntry | null>(null);

  // ---- Contextual tutorial tips (one-shot, persisted) ----
  const tips = useTipsQueue();
  const prevHiddenCount = useRef(state.hiddenClueIds.length);
  const prevActionCount = useRef(state.turnsTaken);
  const prevTurn = useRef(state.turnsTaken);
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
  const sageDiscount = player?.aptitude === "sage" && !sageScoutBonusUsed;

  const handleSkill = (hero: Hero, skill: HeroSkill) => {
    if (state.outcome !== "ongoing") return;
    let effective = skill;
    if (sageDiscount && skill.type === "scout" && skill.cost > 0) {
      effective = { ...skill, cost: Math.max(0, skill.cost - 1) };
      setSageScoutBonusUsed(true);
    }
    if (state.ap < effective.cost) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setState((s) => applySkill(s, effective, hero).state);
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
      {/* Scrollable upper content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {/* Compact enemy header */}
        <View style={styles.enemyHeader}>
          <Pressable style={styles.closeBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} testID="battle-close">
            <Ionicons name="close" size={18} color={COLORS.onSurface} />
          </Pressable>
          <Pressable
            style={styles.helpBtn}
            onPress={() => router.push("/tutorial")}
            hitSlop={10}
            testID="battle-tutorial-button"
          >
            <Ionicons name="help-circle-outline" size={20} color={COLORS.onSurfaceSecondary} />
          </Pressable>
          <View style={styles.enemyHeaderRow}>
            {getEnemySprite(enemy.id) && (
              <View style={[styles.enemyPortraitWrap, { borderColor: ELEMENT_COLORS[enemy.primarySystem] + "AA" }]}>
                <Image source={getEnemySprite(enemy.id)!} style={styles.enemyPortrait} resizeMode="cover" />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" }}>
                <Text style={styles.enemyKicker}>{enemy.realWorld.toUpperCase()}</Text>
                {isTraining && <View style={styles.trainingTag}><Text style={styles.trainingTxt}>TRAINING</Text></View>}
              </View>
              <Text style={styles.enemyName}>{enemy.name}</Text>
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

        {/* Bars */}
        <View style={styles.barsBlock}>
          <View style={styles.barRow}>
            <Text style={styles.barLabel}>CORRUPTION</Text>
            <View style={styles.barBg}><View style={[styles.barFill, { width: `${corruptionPct}%`, backgroundColor: COLORS.error }]} /></View>
            <Text style={styles.barVal}>{state.corruption}</Text>
          </View>
          <View style={styles.barRow}>
            <Text style={styles.barLabel}>STABILITY</Text>
            <View style={styles.barBg}><View style={[styles.barFill, { width: `${state.stability}%`, backgroundColor: stabilityColor }]} /></View>
            <Text style={[styles.barVal, { color: stabilityColor }]}>{state.stability}%</Text>
          </View>
        </View>

        {/* Collapsed Codex guidance */}
        <Pressable style={styles.codexCard} onPress={() => setCodexExpanded(!codexExpanded)} testID="battle-guidance">
          <Ionicons name="book-outline" size={13} color={COLORS.brand} />
          <Text style={styles.codexLabel} numberOfLines={codexExpanded ? undefined : 1}>
            {mentorAid ? "MENTOR'S AID: " : tacticalHint ? "MENTOR: " : gentleHint ? "CODEX WHISPERS: " : "CODEX: "}
            <Text style={styles.codexText}>
              {mentorAid ? `+10 Stability. ${hints.tactical}` : tacticalHint ? hints.tactical : gentleHint ? hints.gentle : `Match actions to the ${enemy.primarySystem} system.`}
            </Text>
          </Text>
          <Ionicons name={codexExpanded ? "chevron-up" : "chevron-down"} size={13} color={COLORS.onSurfaceTertiary} />
        </Pressable>

        {/* Compact clue row */}
        <Text style={styles.sectionLbl}>CLUES</Text>
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
                    <Ionicons name="help" size={16} color={COLORS.onSurfaceTertiary} />
                    <Text style={styles.clueLabel}>HIDDEN</Text>
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      </ScrollView>

      {/* Fixed bottom action bar */}
      <View style={styles.actionBar}>
        {/* Hero pills row */}
        <View style={styles.heroRow}>
          {team.map(h => {
            const acted = !!state.heroActionsUsed[h.id];
            const selected = state.selectedHeroId === h.id;
            const elementColor = ELEMENT_COLORS[h.element] || COLORS.brand;
            const onPick = () => {
              if (acted) return;
              setState(prev => selectHero(prev, h.id));
            };
            return (
              <Pressable
                key={h.id}
                onPress={onPick}
                hitSlop={6}
                style={[styles.heroPill, selected && !acted && { borderColor: elementColor, backgroundColor: elementColor + "18" }, acted && styles.heroPillActed]}
                testID={`hero-pill-${h.id}`}
                accessibilityRole="button"
              >
                {getHeroSprite(h.id) && (
                  <Image source={getHeroSprite(h.id)!} style={styles.heroPillSprite} resizeMode="cover" />
                )}
                <Text style={[styles.heroPillName, selected && !acted && { color: elementColor }, acted && { color: COLORS.onSurfaceTertiary }]} numberOfLines={1}>
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
          <Text style={styles.apLabel}>ACTION POINTS</Text>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {Array.from({ length: state.apMax }).map((_, i) => (
              <View key={i} style={[styles.apDot, i < state.ap && styles.apDotOn]} />
            ))}
          </View>
          <Pressable onPress={handleEndTurn} style={styles.endBtn} disabled={state.outcome !== "ongoing"} testID="battle-end-turn">
            <Text style={styles.endTxt}>END TURN</Text>
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(["actions", "items", "call", "team"] as Tab[]).map(t => (
            <Pressable key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)} testID={`tab-${t}`}>
              <Text style={[styles.tabTxt, activeTab === t && styles.tabTxtActive]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.affordanceHint}>Tap to use · Long-press for details</Text>

        {/* Tab content */}
        <View style={styles.tabContent}>
          {activeTab === "actions" && (
            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
              <View style={styles.grid}>
                {state.temporaryActionIds.map((aid) => {
                  const a = TEMP_ACTIONS[aid]; if (!a) return null;
                  const preview = previewTempStatus(state, aid);
                  const isLocked = preview.status === "locked";
                  const selHero = state.team.find(h => h.id === state.selectedHeroId);
                  const heroBlocked = !selHero || !!state.heroActionsUsed[selHero.id];
                  const disabled = isLocked || state.ap < a.costAP || state.outcome !== "ongoing" || heroBlocked;
                  return (
                    <Pressable
                      key={`tmp-${aid}`}
                      style={[styles.actionBtn, { borderColor: statusColor(preview.status) }, disabled && styles.disabled]}
                      onPress={() => disabled ? null : handleTempAction(aid)}
                      onLongPress={() => disabled ? null : setDetail({ kind: "temp", actionId: aid })}
                      delayLongPress={350}
                      testID={`battle-temp-${aid}`}
                    >
                      <StatusBadge status={preview.status} />
                      <View style={styles.actionHead}>
                        <Text style={[styles.actionName, { color: COLORS.brand }]} numberOfLines={1}>{a.name}</Text>
                        <Text style={styles.apTag}>{a.costAP} AP</Text>
                      </View>
                      <Text style={styles.actionEffect} numberOfLines={2}>{a.shortEffect || a.description}</Text>
                      <Text style={styles.actionHero} numberOfLines={1}>Team Support · {a.systemType || "Universal"}</Text>
                    </Pressable>
                  );
                })}
                {(() => {
                  const selHero = state.team.find(h => h.id === state.selectedHeroId);
                  if (!selHero) return <Text style={styles.emptyTab}>Tap a hero above to select.</Text>;
                  const acted = !!state.heroActionsUsed[selHero.id];
                  if (acted) return <Text style={styles.emptyTab}>{selHero.name} has already acted. Pick another hero or end the turn.</Text>;
                  const isBoss = (state.enemyClinical?.rewardBase || 0) >= 100;
                  const careDmg = careAttemptDamage(state.chapter, isBoss);
                  const careDisabled = state.ap < 1 || state.outcome !== "ongoing";
                  const careNode = (
                    <Pressable
                      key="care-attempt"
                      style={[styles.actionBtn, { borderColor: COLORS.onSurfaceTertiary }, careDisabled && styles.disabled]}
                      onPress={() => careDisabled ? null : setState(prev => applyCareAttempt(prev).state)}
                      testID="battle-care-attempt"
                    >
                      <View style={styles.basicTag}><Text style={styles.basicTagTxt}>BASIC</Text></View>
                      <View style={styles.actionHead}>
                        <Text style={styles.actionName} numberOfLines={1}>Care Attempt</Text>
                        <Text style={styles.apTag}>1 AP</Text>
                      </View>
                      <Text style={styles.actionEffect} numberOfLines={2}>Unfocused aid · −{careDmg} Corruption. Does not advance care chain.</Text>
                      <Text style={styles.actionHero} numberOfLines={1}>Fallback only — targeted skills are stronger</Text>
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
                      <Pressable
                        key={`${selHero.id}-${skill.id}`}
                        style={[styles.actionBtn, { borderColor: statusColor(preview.status) }, disabled && styles.disabled]}
                        onPress={() => disabled ? null : handleSkill(selHero, skill)}
                        onLongPress={() => disabled ? null : setDetail({ kind: "skill", hero: selHero, skill })}
                        delayLongPress={350}
                        testID={`battle-skill-${skill.id}`}
                      >
                        <StatusBadge status={preview.status} />
                        <View style={styles.actionHead}>
                          <Text style={styles.actionName} numberOfLines={1}>{skill.name}</Text>
                          <Text style={styles.apTag}>{cost} AP</Text>
                        </View>
                        <Text style={styles.actionEffect} numberOfLines={2}>{skill.shortEffect || skill.description}</Text>
                        <Text style={styles.actionHero} numberOfLines={1}>{sageDisc ? "Sage discount · " : ""}{airDisc ? "Air discount · " : ""}{skill.systemType || "Universal"}</Text>
                      </Pressable>
                    );
                  });
                  return [careNode, ...skillNodes];
                })()}
              </View>
            </ScrollView>
          )}
          {activeTab === "items" && (
            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
              {(() => {
                const selHero = state.team.find(h => h.id === state.selectedHeroId);
                if (!selHero) return <Text style={styles.emptyTab}>Tap a hero above first — items consume the chosen hero&apos;s action.</Text>;
                if (state.heroActionsUsed[selHero.id]) return <Text style={styles.emptyTab}>{selHero.name} has already acted. Pick another hero to use an item.</Text>;
                return null;
              })()}
              <View style={styles.grid}>
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
                    <Pressable
                      key={item.id}
                      style={[styles.actionBtn, { borderColor: statusColor(preview.status) }, disabled && styles.disabled]}
                      onPress={() => disabled ? null : handleUseItem(item)}
                      onLongPress={() => setDetail({ kind: "item", item })}
                      delayLongPress={350}
                      testID={`battle-item-${item.id}`}
                    >
                      <StatusBadge status={preview.status} />
                      <View style={styles.actionHead}>
                        <Text style={styles.actionName} numberOfLines={1}>{item.displayName}</Text>
                        <Text style={styles.apTag}>×{qty}</Text>
                      </View>
                      <Text style={styles.actionEffect} numberOfLines={2}>{item.shortEffect}</Text>
                      <Text style={styles.actionHero} numberOfLines={1}>{discounted ? "Prepared · " : ""}{cost} AP</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}
          {activeTab === "call" && (
            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
              {availableCalls.length === 0 && <Text style={styles.helpTxt}>No support options match the situation yet.</Text>}
              <View style={styles.grid}>
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
                    <Pressable
                      key={opt.id}
                      style={[styles.actionBtn, { borderColor: statusColor(preview.status) }, disabled && styles.disabled]}
                      onPress={() => disabled ? null : handleCall(opt)}
                      onLongPress={() => setDetail({ kind: "call", option: opt })}
                      delayLongPress={350}
                      testID={`call-opt-${opt.id}`}
                    >
                      <StatusBadge status={preview.status} />
                      <View style={styles.actionHead}>
                        <Text style={styles.actionName} numberOfLines={1}>{opt.name}</Text>
                        <Text style={styles.apTag}>{opt.costAP} AP</Text>
                      </View>
                      <Text style={styles.actionEffect} numberOfLines={3}>{opt.description}</Text>
                      {alreadyUsed && <Text style={styles.actionHero}>Already called</Text>}
                      {rapidGated && !alreadyUsed && <Text style={styles.actionHero}>Reserved for Stability ≤ 30</Text>}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}
          {activeTab === "team" && (
            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
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
      </View>

      {/* First-battle coachmark */}
      <LongPressCoachmark visible={activeTab === "actions" && !detail && state.outcome === "ongoing"} />

      {/* Detail modal */}
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

      {state.outcome !== "ongoing" && (
        <View style={styles.modalOverlay}>
          <View style={styles.outcomeModal}>
            <Ionicons
              name={state.outcome === "win" ? "shield-checkmark" : "alert-circle"}
              size={48}
              color={state.outcome === "win" ? COLORS.success : COLORS.error}
            />
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
  content: { flex: 1 },
  contentInner: { paddingBottom: SPACING.md },

  enemyHeader: { padding: SPACING.lg, paddingBottom: SPACING.sm, gap: 4 },
  enemyHeaderRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingRight: 76 },
  enemyPortraitWrap: { width: 72, height: 72, borderRadius: RADIUS.md, borderWidth: 2, overflow: "hidden", backgroundColor: COLORS.surfaceTertiary },
  enemyPortrait: { width: "100%", height: "100%" },
  closeBtn: { position: "absolute", right: SPACING.sm, top: SPACING.md, padding: 8, zIndex: 1 },
  helpBtn: { position: "absolute", right: SPACING.sm + 36, top: SPACING.md, padding: 8, zIndex: 1 },
  enemyKicker: { color: COLORS.error, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  trainingTag: { backgroundColor: COLORS.brandTertiary, paddingHorizontal: 8, paddingVertical: 1, borderRadius: RADIUS.pill },
  trainingTxt: { color: COLORS.brand, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  enemyName: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300", lineHeight: 28 },
  systemPills: { flexDirection: "row", gap: SPACING.sm, marginTop: 4 },
  sysPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1 },
  sysTxt: { fontSize: 10, letterSpacing: 1, fontWeight: "700" },

  barsBlock: { paddingHorizontal: SPACING.lg, gap: 6, marginBottom: SPACING.sm },
  barRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  barLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 1, fontWeight: "700", width: 72 },
  barBg: { flex: 1, height: 7, backgroundColor: COLORS.surfaceTertiary, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  barVal: { color: COLORS.onSurface, fontSize: 11, fontWeight: "600", width: 40, textAlign: "right" },

  codexCard: {
    marginHorizontal: SPACING.lg, marginTop: SPACING.sm,
    backgroundColor: COLORS.brand + "10", borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.brand + "30",
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  codexLabel: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 0.5, flex: 1, lineHeight: 14 },
  codexText: { color: COLORS.onSurfaceSecondary, fontWeight: "400", fontSize: 11 },

  sectionLbl: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 2, fontWeight: "700", paddingHorizontal: SPACING.lg, marginTop: SPACING.md },
  clueRow: { gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: 6 },
  clue: { width: 130, height: 78, padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, gap: 4, backgroundColor: COLORS.surfaceSecondary },
  clueVisible: { borderColor: COLORS.brand + "60" },
  clueHidden: { borderColor: COLORS.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  clueLabel: { color: COLORS.onSurface, fontSize: 12, fontWeight: "600" },
  clueDetail: { color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 13 },

  actionBar: {
    backgroundColor: COLORS.surfaceSecondary, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm,
  },
  apRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
  apLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  apDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.border },
  apDotOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  endBtn: { marginLeft: "auto", paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.borderStrong },
  endTxt: { color: COLORS.onSurfaceSecondary, fontSize: 10, letterSpacing: 1, fontWeight: "700" },

  tabs: { flexDirection: "row", gap: 4, marginBottom: SPACING.sm },
  tab: { flex: 1, paddingVertical: 6, alignItems: "center", borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceTertiary },
  tabActive: { backgroundColor: COLORS.brand },
  tabTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  tabTxtActive: { color: COLORS.onBrand },
  affordanceHint: { color: COLORS.onSurfaceTertiary, fontSize: 9, textAlign: "center", marginBottom: SPACING.xs, fontStyle: "italic", letterSpacing: 0.5 },

  tabContent: { paddingBottom: SPACING.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  actionBtn: {
    width: "48.5%", minHeight: 64, padding: 8, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.border,
    gap: 2,
  },
  disabled: { opacity: 0.4 },
  actionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  actionName: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600", flex: 1 },
  actionEffect: { color: COLORS.onSurfaceSecondary, fontSize: 10, lineHeight: 12 },
  actionHero: { color: COLORS.onSurfaceTertiary, fontSize: 9, marginTop: 2, fontStyle: "italic" },
  apTag: { color: COLORS.brand, fontSize: 10, fontWeight: "700", marginLeft: 4 },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1, marginBottom: 2, maxWidth: "100%" },
  statusBadgeTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
  basicTag: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1, borderColor: COLORS.onSurfaceTertiary, backgroundColor: COLORS.onSurfaceTertiary + "20", marginBottom: 2 },
  basicTagTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 0.8, color: COLORS.onSurfaceTertiary },
  heroRow: { flexDirection: "row", paddingHorizontal: SPACING.lg, gap: 8, paddingBottom: 8, flexWrap: "wrap" },
  heroPill: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 6, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceTertiary, minWidth: 88, alignItems: "center", flexShrink: 1 },
  heroPillSprite: { width: 40, height: 40, borderRadius: 8, marginBottom: 4, backgroundColor: COLORS.bg },
  heroPillActed: { opacity: 0.45 },
  heroPillName: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700" },
  heroPillRole: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1, marginTop: 2 },
  emptyTab: { color: COLORS.onSurfaceTertiary, fontSize: 12, textAlign: "center", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },

  teamList: { gap: SPACING.sm },
  teamCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surfaceTertiary, padding: SPACING.sm, borderRadius: RADIUS.md, borderLeftWidth: 4, borderWidth: 1, borderColor: COLORS.border },
  teamName: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  teamRole: { color: COLORS.onSurfaceTertiary, fontSize: 10, marginTop: 2 },
  passiveCard: { backgroundColor: COLORS.brand + "12", borderRadius: RADIUS.md, padding: SPACING.sm, borderColor: COLORS.brand + "40", borderWidth: 1, marginTop: SPACING.sm },
  passiveLbl: { color: COLORS.brand, fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  passiveTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, marginTop: 4, lineHeight: 15 },

  helpTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, textAlign: "center", padding: SPACING.md, fontStyle: "italic" },

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
});
