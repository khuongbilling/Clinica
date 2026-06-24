import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { BOSS_LORD_IMBALANCE, ENEMIES, HEROES } from "@/src/game/content";
import { applySkill, endPlayerTurn, flatSkills, initBattle, type BattleState } from "@/src/game/battle";
import { usePlayer } from "@/src/game/store";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function Battle() {
  const { enemyId } = useLocalSearchParams<{ enemyId: string }>();
  const router = useRouter();
  const { player, applyRewards } = usePlayer();

  const enemy = useMemo(() => {
    if (!enemyId) return ENEMIES[0];
    if (enemyId === BOSS_LORD_IMBALANCE.id) return BOSS_LORD_IMBALANCE;
    return ENEMIES.find((e) => e.id === enemyId) || ENEMIES[0];
  }, [enemyId]);

  const team = useMemo(() => {
    if (!player) return HEROES.slice(0, 3);
    const owned = HEROES.filter((h) => player.heroes_owned.includes(h.id));
    if (owned.length >= 3) return owned.slice(0, 3);
    // fill from HEROES list
    const fill = HEROES.filter((h) => !player.heroes_owned.includes(h.id));
    return [...owned, ...fill].slice(0, 3);
  }, [player]);

  const [state, setState] = useState<BattleState>(() => initBattle(enemy, team));
  const [selectedHeroIdx, setSelectedHeroIdx] = useState(0);
  const allClues = useMemo(() => [...enemy.visibleClues, ...enemy.hiddenClues], [enemy]);
  const stabilityColor = state.stability > 60 ? COLORS.success : state.stability > 30 ? COLORS.warning : COLORS.error;
  const corruptionPct = (state.corruption / enemy.corruption) * 100;

  const handleSkill = (hero: any, skill: any) => {
    if (state.outcome !== "ongoing" || state.ap < skill.cost) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setState((s) => applySkill(s, skill, hero));
  };

  const handleEndTurn = () => {
    if (state.outcome !== "ongoing") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setState((s) => endPlayerTurn(s));
  };

  const finish = async () => {
    if (state.outcome === "win") {
      const isBoss = enemy.id === BOSS_LORD_IMBALANCE.id;
      const xp = isBoss ? 150 : 35 + enemy.difficulty * 10;
      await applyRewards({
        xp,
        codex: enemy.teaches,
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
    }
    router.replace({
      pathname: "/result",
      params: { outcome: state.outcome, enemyId: enemy.id, stability: String(state.stability) },
    });
  };

  const selectedHero = team[selectedHeroIdx];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Top: Enemy + stability */}
      <View style={styles.enemyArea}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()} testID="battle-close">
          <Ionicons name="close" size={20} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.enemyKicker}>{enemy.realWorld.toUpperCase()}</Text>
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

        {/* Corruption bar */}
        <View style={styles.corruptRow}>
          <Text style={styles.barLabel}>CORRUPTION</Text>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${corruptionPct}%`, backgroundColor: COLORS.error }]} />
          </View>
          <Text style={styles.barVal}>{state.corruption}</Text>
        </View>

        {/* Stability bar */}
        <View style={styles.corruptRow}>
          <Text style={styles.barLabel}>STABILITY</Text>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${state.stability}%`, backgroundColor: stabilityColor }]} />
          </View>
          <Text style={[styles.barVal, { color: stabilityColor }]}>{state.stability}%</Text>
        </View>
      </View>

      {/* Clue cards */}
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

      {/* Hero selector */}
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

      {/* Action bar */}
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
          {selectedHero.skills.map((s) => {
            const disabled = state.ap < s.cost || state.outcome !== "ongoing";
            return (
              <Pressable
                key={s.id}
                style={[styles.skillBtn, disabled && { opacity: 0.4 }]}
                onPress={() => handleSkill(selectedHero, s)}
                disabled={disabled}
                testID={`battle-skill-${s.id}`}
              >
                <View style={styles.skillBtnLeft}>
                  <Text style={styles.skillBtnName}>{s.name}</Text>
                  <Text style={styles.skillBtnDesc}>{s.description}</Text>
                </View>
                <View style={styles.apCost}><Text style={styles.apCostTxt}>{s.cost}</Text></View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Outcome modal */}
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
                ? `Stability held at ${state.stability}%. Codex pages restored.`
                : `${enemy.dangerTrigger}. Review the codex and try again.`}
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
  enemyName: { color: COLORS.onSurface, fontSize: 26, fontWeight: "300" },
  systemPills: { flexDirection: "row", gap: SPACING.sm },
  sysPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1 },
  sysTxt: { fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  corruptRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: 4 },
  barLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, fontWeight: "700", width: 80 },
  barBg: { flex: 1, height: 8, backgroundColor: COLORS.surfaceTertiary, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  barVal: { color: COLORS.onSurface, fontSize: 12, fontWeight: "600", width: 44, textAlign: "right" },
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
});
