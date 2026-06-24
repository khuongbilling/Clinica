import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { BOSS_LORD_IMBALANCE, ENEMIES, HEROES } from "@/src/game/content";
import { getEnemyHint } from "@/src/game/onboarding";
import { applyCall, applySkill, applyTempAction, endPlayerTurn, initBattle, useItem as applyItem, type BattleState } from "@/src/game/battle";
import { CALL_OPTIONS, ITEMS, TEMP_ACTIONS, findItem } from "@/src/game/items";
import { usePlayer } from "@/src/game/store";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function Battle() {
  const { enemyId, training } = useLocalSearchParams<{ enemyId: string; training?: string }>();
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
    // Prefer active_team; fall back to owned[0..2]; fall back to first 3 heroes
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
    const base = initBattle(enemy, team, player?.inventory || {});
    let stability = base.stability;
    let visibleClues = [...base.visibleClues];
    let hiddenClueIds = [...base.hiddenClueIds];
    let revealedLabels = [...base.revealedLabels];
    const log = [...base.log];

    // Apply aptitude passives
    if (player?.aptitude === "weaver" && hiddenClueIds.length > 0) {
      const revealed = hiddenClueIds.shift()!;
      visibleClues.push(revealed);
      const clue = enemy.hiddenClues.find(c => c.id === revealed);
      if (clue) revealedLabels.push(clue.label);
      log.push(`⟡ Weaver's Eye: one hidden clue revealed at battle start.`);
    }

    if (mentorAid) {
      stability = Math.min(100, stability + 10);
      log.push(`🕯 A mentor steadies your hand. Starting Stability +10.`);
    }

    if (isTraining) {
      if (hiddenClueIds.length > 0) {
        const revealed = hiddenClueIds.shift()!;
        visibleClues.push(revealed);
        const clue = enemy.hiddenClues.find(c => c.id === revealed);
        if (clue) revealedLabels.push(clue.label);
      }
      stability = Math.min(100, stability + 10);
      log.push(`📜 Training Battle: hidden clue revealed, enemy weakened.`);
    }

    return { ...base, stability, visibleClues, hiddenClueIds, revealedLabels, log };
  });

  const [selectedHeroIdx, setSelectedHeroIdx] = useState(0);
  const [sageScoutBonusUsed, setSageScoutBonusUsed] = useState(false);
  const [hintExpanded, setHintExpanded] = useState(true);

  const allClues = useMemo(() => [...enemy.visibleClues, ...enemy.hiddenClues], [enemy]);
  const stabilityColor = state.stability > 60 ? COLORS.success : state.stability > 30 ? COLORS.warning : COLORS.error;
  const corruptionPct = (state.corruption / enemy.corruption) * 100;

  const handleSkill = (hero: any, skill: any) => {
    if (state.outcome !== "ongoing" || state.outcome === "loss") return;
    // Sage: first scout costs 1 less AP
    let effectiveSkill = skill;
    if (player?.aptitude === "sage" && !sageScoutBonusUsed && skill.type === "scout" && skill.cost > 0) {
      effectiveSkill = { ...skill, cost: Math.max(0, skill.cost - 1) };
      setSageScoutBonusUsed(true);
    }
    if (state.ap < effectiveSkill.cost) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setState((s) => applySkill(s, effectiveSkill, hero));
  };

  const handleEndTurn = () => {
    if (state.outcome !== "ongoing") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setState((s) => {
      let next = endPlayerTurn(s);
      // Guardian: reduce stability loss by 5 per turn
      if (player?.aptitude === "guardian" && s.outcome === "ongoing" && next.outcome === "ongoing" && next.stability < s.stability) {
        const recovered = Math.min(5, s.stability - next.stability);
        next = { ...next, stability: Math.min(100, next.stability + recovered), log: [...next.log, `🛡 Guardian's Vigil: damage reduced by ${recovered}.`] };
      }
      // Warden: starting turn shield +25 once
      // (handled at battle start via shieldNext seed below — we apply it once on turn 1)
      return next;
    });
  };

  const finish = async () => {
    if (state.outcome === "win") {
      const isBoss = enemy.id === BOSS_LORD_IMBALANCE.id;
      const baseXp = isBoss ? 150 : 35 + enemy.difficulty * 10;
      const xp = isTraining ? Math.floor(baseXp * 0.5) : baseXp;
      const shards = isTraining ? 10 : (isBoss ? 100 : 25);
      const startingInventory = player?.inventory || {};
      const inventoryDelta: Record<string, number> = {};
      for (const [k, v] of Object.entries(state.inventory)) {
        const diff = v - (startingInventory[k] || 0);
        if (diff !== 0) inventoryDelta[k] = diff;
      }
      await applyRewards({
        xp,
        codex: enemy.teaches,
        enemyId: enemy.id,
        codexShards: shards,
        inventoryDelta,
        mastery: enemy.bestCounters.reduce((acc, c) => {
          const map: Record<string, keyof typeof acc> = {
            scout: "assessment", stabilize: "stabilization", strike: "pharmacology",
            shield: "judgment", cleanse: "judgment", command: "command",
            analyze: "systems", support: "stabilization",
          };
          const key = map[c];
          if (key) acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {} as any),
        bossId: isBoss ? enemy.id : undefined,
      });
    } else if (state.outcome === "loss") {
      await recordFailure(enemy.id);
    }
    const shardsParam = state.outcome === "win" ? String(isTraining ? 10 : (enemy.id === BOSS_LORD_IMBALANCE.id ? 100 : 25)) : "0";
    router.replace({
      pathname: "/result",
      params: { outcome: state.outcome, enemyId: enemy.id, stability: String(state.stability), training: isTraining ? "1" : "0", shards: shardsParam },
    });
  };

  const [callOpen, setCallOpen] = useState(false);
  const selectedHero = team[selectedHeroIdx];
  const sageDiscount = player?.aptitude === "sage" && !sageScoutBonusUsed;
  const hints = getEnemyHint(enemy.id);

  const handleUseItem = (itemName: string) => {
    const item = findItem(itemName);
    if (!item) return;
    const res = applyItem(state, item);
    setState(res.state);
  };
  const handleTempAction = (actionId: string) => {
    const res = applyTempAction(state, actionId);
    setState(res.state);
  };
  const decideCallItem = () => {
    if (state.revealedLabels.some(l => l.toLowerCase().includes("wheez"))) return "Albuterol Mist";
    if (state.revealedLabels.some(l => l.toLowerCase().includes("glucose"))) return "Glucose Gel";
    if (state.revealedLabels.some(l => l.toLowerCase().includes("bp"))) return "Fluid Bolus";
    if (enemy.primarySystem === "Fire" || enemy.secondarySystem === "Fire") return "Isolation Kit";
    return "Lab Token";
  };
  const availableCalls = CALL_OPTIONS.filter(opt => {
    if (state.callUsed) return false;
    if (opt.id === "call_respiratory") return enemy.primarySystem === "Air" || enemy.secondarySystem === "Air" || state.revealedLabels.some(l => l.toLowerCase().includes("wheez"));
    if (opt.id === "call_rapid") return state.stability <= 30;
    if (opt.id === "call_infection") return enemy.primarySystem === "Fire" || enemy.secondarySystem === "Fire";
    return true; // pharmacy always
  });
  const handleCall = (opt: typeof CALL_OPTIONS[number]) => {
    const itemName = opt.effect === "addRelevantItem" ? decideCallItem() : undefined;
    const res = applyCall(state, opt, itemName);
    setState(res.state);
    setCallOpen(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.enemyArea}>
        <Pressable style={styles.closeBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} testID="battle-close">
          <Ionicons name="close" size={20} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
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

        <View style={styles.corruptRow}>
          <Text style={styles.barLabel}>CORRUPTION</Text>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${corruptionPct}%`, backgroundColor: COLORS.error }]} />
          </View>
          <Text style={styles.barVal}>{state.corruption}</Text>
        </View>
        <View style={styles.corruptRow}>
          <Text style={styles.barLabel}>STABILITY</Text>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${state.stability}%`, backgroundColor: stabilityColor }]} />
          </View>
          <Text style={[styles.barVal, { color: stabilityColor }]}>{state.stability}%</Text>
        </View>
      </View>

      {/* CODEX GUIDANCE */}
      <Pressable style={styles.guidanceCard} onPress={() => setHintExpanded(!hintExpanded)} testID="battle-guidance">
        <View style={styles.guidanceHead}>
          <Ionicons name={mentorAid ? "sparkles" : "book-outline"} size={14} color={COLORS.brand} />
          <Text style={styles.guidanceLabel}>{mentorAid ? "MENTOR'S AID ACTIVE" : tacticalHint ? "MENTOR'S GUIDANCE" : gentleHint ? "THE CODEX WHISPERS" : "CODEX GUIDANCE"}</Text>
          <Ionicons name={hintExpanded ? "chevron-up" : "chevron-down"} size={14} color={COLORS.onSurfaceTertiary} style={{ marginLeft: "auto" }} />
        </View>
        {hintExpanded && (
          <Text style={styles.guidanceText}>
            {mentorAid
              ? `A mentor steadies your hand. Starting Stability +10. ${hints.tactical}`
              : tacticalHint
                ? hints.tactical
                : gentleHint
                  ? hints.gentle
                  : "Watch the clues. Choose actions that match the affected system."}
          </Text>
        )}
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clueRow}>
        {allClues.map((c) => {
          const isVisible = state.visibleClues.includes(c.id);
          return (
            <View key={c.id} style={[styles.clue, isVisible ? styles.clueVisible : styles.clueHidden]} testID={`clue-${c.id}`}>
              {isVisible ? (
                <>
                  <Text style={styles.clueLabel}>{c.label}</Text>
                  <Text style={styles.clueDetail}>{c.detail}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="help" size={20} color={COLORS.onSurfaceTertiary} />
                  <Text style={styles.clueLabel}>HIDDEN</Text>
                  <Text style={styles.clueDetail}>Scout to reveal.</Text>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.heroRow}>
        {team.map((h, idx) => {
          const active = idx === selectedHeroIdx;
          const c = ELEMENT_COLORS[h.element];
          return (
            <Pressable
              key={h.id}
              style={[styles.heroPick, active && { borderColor: c, backgroundColor: c + "1A" }]}
              onPress={() => setSelectedHeroIdx(idx)}
              testID={`battle-hero-${h.id}`}
            >
              <Text style={[styles.heroPickName, active && { color: c }]}>{h.name}</Text>
              <Text style={styles.heroPickRole}>{h.role}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Items + Call panel */}
      <View style={styles.itemsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm, paddingHorizontal: SPACING.lg }}>
          {ITEMS.map((item) => {
            const qty = state.inventory[item.name] || 0;
            const disabled = qty <= 0 || state.ap < item.costAP || state.outcome !== "ongoing";
            return (
              <Pressable
                key={item.id}
                style={[styles.itemChip, disabled && { opacity: 0.45 }]}
                onPress={() => !disabled && handleUseItem(item.name)}
                disabled={disabled}
                testID={`battle-item-${item.id}`}
              >
                <Text style={styles.itemName}>{item.name}</Text>
                <View style={styles.itemMeta}>
                  <Text style={styles.itemQty}>×{qty}</Text>
                  <Text style={styles.itemCost}>{item.costAP}AP</Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable
            style={[styles.callChip, state.callUsed && { opacity: 0.45 }]}
            onPress={() => !state.callUsed && setCallOpen(true)}
            disabled={state.callUsed || state.outcome !== "ongoing"}
            testID="battle-call-team"
          >
            <Ionicons name="call" size={14} color={COLORS.brand} />
            <Text style={styles.callName}>{state.callUsed ? "CALLED" : "CALL TEAM"}</Text>
          </Pressable>
        </ScrollView>
      </View>

      <View style={styles.actionBar}>
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

        <ScrollView style={{ maxHeight: 200 }}>
          {/* Temporary actions from Call Team */}
          {state.temporaryActionIds.map((aid) => {
            const a = TEMP_ACTIONS[aid];
            if (!a) return null;
            const disabled = state.ap < a.costAP || state.outcome !== "ongoing";
            return (
              <Pressable
                key={`temp-${aid}`}
                style={[styles.skillBtn, { borderColor: COLORS.brand + "80" }, disabled && { opacity: 0.4 }]}
                onPress={() => handleTempAction(aid)}
                disabled={disabled}
                testID={`battle-temp-${aid}`}
              >
                <View style={styles.skillBtnLeft}>
                  <Text style={[styles.skillBtnName, { color: COLORS.brand }]}>{a.name} · TEAM</Text>
                  <Text style={styles.skillBtnDesc}>{a.description}</Text>
                </View>
                <View style={styles.apCost}><Text style={styles.apCostTxt}>{a.costAP}</Text></View>
              </Pressable>
            );
          })}
          {selectedHero.skills.map((s) => {
            const sageDiscounted = sageDiscount && s.type === "scout" && s.cost > 0;
            const effectiveCost = sageDiscounted ? Math.max(0, s.cost - 1) : s.cost;
            const disabled = state.ap < effectiveCost || state.outcome !== "ongoing";
            return (
              <Pressable
                key={s.id}
                style={[styles.skillBtn, disabled && { opacity: 0.4 }]}
                onPress={() => handleSkill(selectedHero, s)}
                disabled={disabled}
                testID={`battle-skill-${s.id}`}
              >
                <View style={styles.skillBtnLeft}>
                  <Text style={styles.skillBtnName}>{s.name}{sageDiscounted && <Text style={{ color: COLORS.brand }}>  · Sage discount</Text>}</Text>
                  <Text style={styles.skillBtnDesc}>{s.description}</Text>
                </View>
                <View style={styles.apCost}>
                  {sageDiscounted ? (
                    <Text style={styles.apCostTxt}>{effectiveCost}</Text>
                  ) : (
                    <Text style={styles.apCostTxt}>{s.cost}</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Call Team modal */}
      {callOpen && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Call Team Member</Text>
            <Text style={styles.modalSub}>Choose support (1 use per battle, 2 AP).</Text>
            {availableCalls.length === 0 && (
              <Text style={styles.modalSub}>No options match the situation right now.</Text>
            )}
            {availableCalls.map((opt) => (
              <Pressable key={opt.id} style={styles.callOptBtn} onPress={() => handleCall(opt)} testID={`call-opt-${opt.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.callOptName}>{opt.name}</Text>
                  <Text style={styles.callOptDesc}>{opt.description}</Text>
                </View>
                <View style={styles.apCost}><Text style={styles.apCostTxt}>{opt.costAP}</Text></View>
              </Pressable>
            ))}
            <Pressable style={styles.secondary} onPress={() => setCallOpen(false)} testID="call-cancel">
              <Text style={styles.secondaryTxt}>CANCEL</Text>
            </Pressable>
          </View>
        </View>
      )}

      {state.outcome !== "ongoing" && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Ionicons
              name={state.outcome === "win" ? "shield-checkmark" : "alert-circle"}
              size={48}
              color={state.outcome === "win" ? COLORS.success : COLORS.error}
            />
            <Text style={styles.modalTitle}>{state.outcome === "win" ? "Purified" : "Patient Lost"}</Text>
            <Text style={styles.modalSub}>
              {state.outcome === "win"
                ? `Stability held at ${state.stability}%. Codex pages restored.${isTraining ? " (Training rewards reduced.)" : ""}`
                : `${enemy.dangerTrigger}. ${gentleHint ? "Review the codex and try again." : "The Codex whispers — read the lesson and try again."}`}
            </Text>
            <Pressable style={styles.modalBtn} onPress={finish} testID="battle-finish">
              <Text style={styles.modalBtnTxt}>CONTINUE</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  enemyArea: { padding: SPACING.lg, gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  closeBtn: { position: "absolute", right: SPACING.lg, top: SPACING.lg, padding: 6, zIndex: 1 },
  enemyKicker: { color: COLORS.error, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  trainingTag: { backgroundColor: COLORS.brandTertiary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill },
  trainingTxt: { color: COLORS.brand, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  enemyName: { color: COLORS.onSurface, fontSize: 26, fontWeight: "300" },
  systemPills: { flexDirection: "row", gap: SPACING.sm },
  sysPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1 },
  sysTxt: { fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  corruptRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: 4 },
  barLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, fontWeight: "700", width: 80 },
  barBg: { flex: 1, height: 8, backgroundColor: COLORS.surfaceTertiary, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  barVal: { color: COLORS.onSurface, fontSize: 12, fontWeight: "600", width: 44, textAlign: "right" },

  guidanceCard: {
    marginHorizontal: SPACING.lg, marginTop: SPACING.sm,
    backgroundColor: COLORS.brand + "12", borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.brand + "40",
    padding: SPACING.sm, gap: 4,
  },
  guidanceHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  guidanceLabel: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  guidanceText: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },

  clueRow: { gap: SPACING.sm, padding: SPACING.md, paddingHorizontal: SPACING.lg },
  clue: {
    width: 130, padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, gap: 4,
    backgroundColor: COLORS.surfaceSecondary, minHeight: 92,
  },
  clueVisible: { borderColor: COLORS.brand + "60" },
  clueHidden: { borderColor: COLORS.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  clueLabel: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  clueDetail: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 14 },
  heroRow: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  heroPick: {
    flex: 1, padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.surfaceSecondary, gap: 2,
  },
  heroPickName: { color: COLORS.onSurface, fontSize: 12, fontWeight: "600" },
  heroPickRole: { color: COLORS.onSurfaceTertiary, fontSize: 10 },
  actionBar: {
    flex: 1, padding: SPACING.lg, paddingTop: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary,
  },
  apRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
  apLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  apDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.border },
  apDotOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  endBtn: { marginLeft: "auto", paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.borderStrong },
  endTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, letterSpacing: 1, fontWeight: "700" },
  skillBtn: {
    flexDirection: "row", alignItems: "center", padding: SPACING.md, borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm,
  },
  skillBtnLeft: { flex: 1 },
  skillBtnName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  skillBtnDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2, lineHeight: 14 },
  apCost: { backgroundColor: COLORS.brand, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, minWidth: 32, alignItems: "center" },
  apCostTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700" },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  modal: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: "center", gap: SPACING.md, borderWidth: 1, borderColor: COLORS.brandTertiary, width: "100%", maxWidth: 380 },
  modalTitle: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300" },
  modalSub: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: "center", lineHeight: 19 },
  modalBtn: { backgroundColor: COLORS.brand, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.pill, marginTop: SPACING.sm },
  modalBtnTxt: { color: COLORS.onBrand, fontSize: 12, fontWeight: "700", letterSpacing: 2 },

  itemsBar: { paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  itemChip: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, padding: SPACING.sm, minWidth: 110, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  itemName: { color: COLORS.onSurface, fontSize: 11, fontWeight: "600" },
  itemMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemQty: { color: COLORS.brand, fontSize: 11, fontWeight: "700" },
  itemCost: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "600" },
  callChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.brandTertiary, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: SPACING.sm, borderWidth: 1, borderColor: COLORS.brand + "60" },
  callName: { color: COLORS.brand, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  callOptBtn: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.border, width: "100%" },
  callOptName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  callOptDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  secondary: { borderWidth: 1, borderColor: COLORS.borderStrong, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center", width: "100%" },
  secondaryTxt: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
});
