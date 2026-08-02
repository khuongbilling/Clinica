/**
 * Dev-Only Battle Audit Screen
 *
 * Surfaces all combat data in one place: every enemy's full stat block,
 * the live skill-calculation formula chain, and chapter enemy pool membership.
 * Mirrors the pattern of /hero-audit.
 *
 * Only accessible in __DEV__. Production shows "not available".
 * Access via ROUTES.battleAudit ("/battle-audit").
 */

import { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ENEMIES,
  AFFLICTION_ENEMIES,
  BOSS_LORD_IMBALANCE,
  BOSS_SILENT_INFARCT,
  BOSS_VERDANTHA,
} from "@/src/game/content";
import { statToMultiplier } from "@/src/game/skillCalc";
import { COLORS, ELEMENT_COLORS } from "@/src/theme/colors";
import type { Enemy } from "@/src/game/types";

// ── Data helpers ──────────────────────────────────────────────────────────────

/** Deduplicated master list: ENEMIES + AFFLICTION_ENEMIES + named boss singletons */
function buildMasterList(): Enemy[] {
  const seen = new Set<string>();
  const out: Enemy[] = [];
  const push = (e: Enemy) => {
    if (!seen.has(e.id)) { seen.add(e.id); out.push(e); }
  };
  ENEMIES.forEach(push);
  // Named bosses may or may not already be in ENEMIES (BOSS_VERDANTHA is)
  [BOSS_LORD_IMBALANCE, BOSS_SILENT_INFARCT, BOSS_VERDANTHA].forEach(push);
  AFFLICTION_ENEMIES.forEach(push);
  return out;
}

const ALL_ENEMIES = buildMasterList();

// ── Filter types ──────────────────────────────────────────────────────────────

type EnemyFilter =
  | "all"
  | "ch1" | "ch2" | "ch3" | "ch4" | "ch5"
  | "ch6" | "ch7" | "ch8" | "ch9" | "ch10"
  | "bosses"
  | "afflictions"
  | "high_resistance"
  | "hidden_defense";

const ENEMY_FILTERS: { key: EnemyFilter; label: string }[] = [
  { key: "all",            label: "All" },
  { key: "ch1",            label: "Ch 1" },
  { key: "ch2",            label: "Ch 2" },
  { key: "ch3",            label: "Ch 3" },
  { key: "ch4",            label: "Ch 4" },
  { key: "ch5",            label: "Ch 5" },
  { key: "ch6",            label: "Ch 6" },
  { key: "ch7",            label: "Ch 7" },
  { key: "ch8",            label: "Ch 8" },
  { key: "ch9",            label: "Ch 9" },
  { key: "ch10",           label: "Ch 10" },
  { key: "bosses",         label: "Bosses" },
  { key: "afflictions",    label: "Afflictions" },
  { key: "high_resistance",label: "High Resistance" },
  { key: "hidden_defense", label: "Has Hidden Def" },
];

function applyEnemyFilter(enemies: Enemy[], filter: EnemyFilter): Enemy[] {
  switch (filter) {
    case "all": return enemies;
    case "bosses": return enemies.filter(
      (e) => e.bossGuard || e.worldBoss || e.scriptedLoss ||
             e.id === BOSS_LORD_IMBALANCE.id || e.id === BOSS_SILENT_INFARCT.id
    );
    case "afflictions": return enemies.filter((e) => e.isAffliction);
    case "high_resistance": return enemies.filter((e) => (e.corruptionResistance ?? 0) > 0.15);
    case "hidden_defense":  return enemies.filter((e) => (e.hiddenDefense ?? 0) > 0);
    default: {
      const ch = parseInt(filter.replace("ch", ""), 10);
      return enemies.filter((e) => e.difficulty === ch);
    }
  }
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function corruptResistColor(v: number): string {
  if (v > 0.4)  return "#EF4444"; // red
  if (v > 0.15) return "#F59E0B"; // amber
  return "#22C55E";               // green
}

function elementColor(sys: string | null | undefined): string {
  if (!sys) return COLORS.onSurfaceTertiary;
  return ELEMENT_COLORS[sys] ?? COLORS.brand;
}

// ── Stat multiplier table ─────────────────────────────────────────────────────

const STAT_TABLE_VALS = [5, 10, 16, 22, 30, 45];

// ── Tab type ──────────────────────────────────────────────────────────────────

type Tab = "enemies" | "mechanics" | "pools";

// ── Main component ────────────────────────────────────────────────────────────

export default function BattleAuditScreen() {
  if (!__DEV__) {
    return (
      <SafeAreaView style={styles.notAvail}>
        <Text style={styles.notAvailText}>
          Battle audit is only available in development builds.
        </Text>
      </SafeAreaView>
    );
  }
  return <BattleAuditContent />;
}

function BattleAuditContent() {
  const [tab, setTab] = useState<Tab>("enemies");
  const [enemyFilter, setEnemyFilter] = useState<EnemyFilter>("all");

  const filtered = useMemo(
    () => applyEnemyFilter(ALL_ENEMIES, enemyFilter),
    [enemyFilter]
  );

  return (
    <SafeAreaView style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Battle Audit</Text>
        <Text style={styles.subtitle}>
          {ALL_ENEMIES.length} entries · {ENEMIES.length} enemies ·{" "}
          {AFFLICTION_ENEMIES.length} afflictions · 3 named bosses
        </Text>
      </View>

      {/* ── Tab bar ── */}
      <View style={styles.tabBar}>
        {(["enemies", "mechanics", "pools"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === "enemies" ? "Enemies" : t === "mechanics" ? "Mechanics" : "Chapter Pools"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "enemies" && (
        <EnemiesTab
          filtered={filtered}
          activeFilter={enemyFilter}
          setFilter={setEnemyFilter}
        />
      )}
      {tab === "mechanics" && <MechanicsTab />}
      {tab === "pools" && <ChapterPoolsTab />}
    </SafeAreaView>
  );
}

// ── Enemies Tab ───────────────────────────────────────────────────────────────

function EnemiesTab({
  filtered,
  activeFilter,
  setFilter,
}: {
  filtered: Enemy[];
  activeFilter: EnemyFilter;
  setFilter: (f: EnemyFilter) => void;
}) {
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {ENEMY_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterLabel, activeFilter === f.key && styles.filterLabelActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.countLabel}>{filtered.length} shown</Text>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.listPad}>
        {filtered.map((e) => (
          <EnemyCard key={e.id} enemy={e} />
        ))}
      </ScrollView>
    </>
  );
}

function EnemyCard({ enemy: e }: { enemy: Enemy }) {
  const isBoss = e.bossGuard || e.worldBoss || e.scriptedLoss;
  const isAffliction = !!e.isAffliction;
  const sysColor = elementColor(e.primarySystem);
  const crColor = corruptResistColor(e.corruptionResistance ?? 0);

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <Text style={[styles.cardName, { color: sysColor }]} numberOfLines={1}>
          {e.name}
        </Text>
        <View style={styles.badgeRow}>
          {isBoss && (
            <View style={[styles.chip, { backgroundColor: "#EF444422", borderColor: "#EF4444" }]}>
              <Text style={[styles.chipText, { color: "#EF4444" }]}>BOSS</Text>
            </View>
          )}
          {isAffliction && (
            <View style={[styles.chip, { backgroundColor: "#A78BFA22", borderColor: "#A78BFA" }]}>
              <Text style={[styles.chipText, { color: "#A78BFA" }]}>AFFLICTION</Text>
            </View>
          )}
          {e.worldBoss && (
            <View style={[styles.chip, { backgroundColor: "#F59E0B22", borderColor: "#F59E0B" }]}>
              <Text style={[styles.chipText, { color: "#F59E0B" }]}>WORLD BOSS</Text>
            </View>
          )}
        </View>
      </View>

      {/* ID + chapter */}
      <Text style={styles.cardId}>{e.id}</Text>
      <Text style={styles.cardSub}>Ch {e.difficulty} · {e.corruptionAspect}</Text>

      {/* Primary stats */}
      <View style={styles.statGrid}>
        <StatBadge label="HP (corruption)" value={e.corruption} color={COLORS.error} />
        <StatBadge label="Stability" value={e.startingStability} color={COLORS.success} />
        <StatBadge label="Instability" value={e.instability} color={COLORS.warning} />
        <StatBadge
          label="Corrupt Resist"
          value={`${((e.corruptionResistance ?? 0) * 100).toFixed(0)}%`}
          color={crColor}
        />
        {(e.stabilityResistance ?? 0) > 0 && (
          <StatBadge
            label="Stab Resist"
            value={`${((e.stabilityResistance ?? 0) * 100).toFixed(0)}%`}
            color="#F59E0B"
          />
        )}
        {(e.hiddenDefense ?? 0) > 0 && (
          <StatBadge
            label="Hidden Def"
            value={`${((e.hiddenDefense ?? 0) * 100).toFixed(0)}%`}
            color="#8B5CF6"
          />
        )}
        {(e.stabilityPressure ?? 0) > 0 && (
          <StatBadge
            label="Stab Pressure"
            value={`${((e.stabilityPressure ?? 0) * 100).toFixed(0)}%`}
            color="#F97316"
          />
        )}
        {e.bossGuard && (
          <StatBadge label="Boss Guard" value="ON" color="#EF4444" />
        )}
      </View>

      {/* Element chips */}
      <View style={styles.chipRow}>
        <ElementChip label={`System: ${e.primarySystem}`} color={elementColor(e.primarySystem)} />
        {e.secondarySystem && (
          <ElementChip label={`2nd: ${e.secondarySystem}`} color={elementColor(e.secondarySystem)} />
        )}
        {e.weakElement && (
          <ElementChip label={`Weak: ${e.weakElement}`} color={elementColor(e.weakElement)} prefix="↓" />
        )}
        {e.resistantElement && (
          <ElementChip label={`Resist: ${e.resistantElement}`} color={elementColor(e.resistantElement)} prefix="↑" />
        )}
      </View>
    </View>
  );
}

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <View style={[styles.statBadge, { borderColor: color + "55" }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ElementChip({
  label,
  color,
  prefix,
}: {
  label: string;
  color: string;
  prefix?: string;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: color + "18", borderColor: color + "88" }]}>
      <Text style={[styles.chipText, { color }]}>
        {prefix ? `${prefix} ` : ""}{label}
      </Text>
    </View>
  );
}

// ── Mechanics Tab ─────────────────────────────────────────────────────────────

function MechanicsTab() {
  const statRows = STAT_TABLE_VALS.map((s) => ({ stat: s, mult: statToMultiplier(s) }));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.listPad}>
      {/* Strike formula */}
      <FormulaCard
        title="Strike Formula"
        color={COLORS.error}
        lines={[
          "base × (1 + elementBonus) × affinity × clinical × system",
          "  × chapter × cast × heroStat × affinityFamily",
          "  × corruptionResist × hiddenDefense",
          "  × [heroLevel × equipment × leaderBonus",
          "     × playerClass × careChain × clinicalCue]",
        ]}
        factors={[
          { name: "elementBonus", note: "+0.30 when hero element = enemy weakElement (additive pre-multiply)" },
          { name: "affinity", note: "treatment-correctness: strong ×1.6 / appropriate ×1.0 / weak ×0.3 / bad ×0" },
          { name: "heroStat → heroStatMod", note: "statToMultiplier(hero.stats.intervention)" },
          { name: "affinityFamily (Push 6/13)", note: "×(1 + 0.18 × (1−affinityResistance)) strong · ×1.00 neutral · ×0.87 weak" },
          { name: "corruptionResistanceMod (Push 7)", note: "1 − enemy.corruptionResistance; bosses 0.65–0.72, Ch1 ~1.00" },
          { name: "hiddenDefenseMod (Push 7)", note: "1 − (enemy.hiddenDefense × hiddenCluesFraction); drops to 1.00 when all clues revealed" },
        ]}
      />

      {/* Stabilize formula */}
      <FormulaCard
        title="Stabilize Formula"
        color={COLORS.success}
        lines={[
          "base × clinical × system × corruptionMod × cast × heroStat",
          "  × affinityFamily × hiddenDefense",
          "  × [heroLevel × equipment × leaderBonus",
          "     × playerClass × careChain × clinicalCue]",
          "  + cueBonusFlat  ← flat bonus after multiply",
          "  then × stabilityGain × enemyResistance",
        ]}
        factors={[
          { name: "heroStat → heroStatMod", note: "statToMultiplier(hero.stats.carePower)" },
          { name: "hiddenDefenseMod (Push 7)", note: "1 − (enemy.hiddenDefense × hiddenCluesFraction); corruptionResistanceMod = 1.00 for stabilize" },
          { name: "cueBonusFlat", note: "+8 from Clinical Cue bonus; added after core multiply, before state modifiers; cleared at endPlayerTurn" },
          { name: "stabilityGainMod", note: "getStabilityGainModifier — diminishing returns near 100 stability" },
          { name: "enemyResistanceMod", note: "1 − enemy.stabilityResistance (0..0.8); boss suppressor" },
        ]}
      />

      {/* Shield formula */}
      <FormulaCard
        title="Shield Formula"
        color={COLORS.brand}
        lines={[
          "base × heroStat × affinityFamily × hiddenDefense",
          "  × [heroLevel × equipment × leaderBonus × playerClass × careChain]",
        ]}
        factors={[
          { name: "heroStat → heroStatMod", note: "statToMultiplier(hero.stats.guard)" },
          { name: "affinityFamily (Push 6/13)", note: "same strong/neutral/weak formula as Strike" },
          { name: "hiddenDefenseMod (Push 7)", note: "1 − (enemy.hiddenDefense × hiddenCluesFraction); all action types reduced equally" },
        ]}
      />

      {/* Affinity modifiers */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Affinity Modifiers (Push 13)</Text>
        <View style={styles.tableRow}>
          <Text style={[styles.tableCell, { color: COLORS.success }]}>Strong match</Text>
          <Text style={[styles.tableCellMono, { color: COLORS.success }]}>×1.18</Text>
        </View>
        <View style={[styles.tableRow, styles.tableRowAlt]}>
          <Text style={styles.tableCell}>Neutral</Text>
          <Text style={styles.tableCellMono}>×1.00</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={[styles.tableCell, { color: COLORS.error }]}>Weak match</Text>
          <Text style={[styles.tableCellMono, { color: COLORS.error }]}>×0.87</Text>
        </View>
      </View>

      {/* statToMultiplier table */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>statToMultiplier — live output</Text>
        <Text style={styles.sectionNote}>
          Formula: min(1.40, max(0.90, 1.0 + (stat − 10) / 75))
        </Text>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>Stat</Text>
          <Text style={[styles.tableCellMono, styles.tableHeaderText]}>×mult</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText]}>Who has this</Text>
        </View>
        {statRows.map(({ stat, mult }, i) => (
          <View key={stat} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
            <Text style={styles.tableCell}>{stat}</Text>
            <Text style={[styles.tableCellMono, { color: COLORS.brand }]}>×{mult.toFixed(2)}</Text>
            <Text style={[styles.tableCell, { color: COLORS.onSurfaceTertiary }]}>
              {stat === 5  ? "very low (weakest common)"    :
               stat === 10 ? "common average (baseline)"    :
               stat === 16 ? "uncommon peak"                :
               stat === 22 ? "rare peak"                    :
               stat === 30 ? "epic peak"                    :
               stat === 45 ? "legendary / prologue (cap)"   : ""}
            </Text>
          </View>
        ))}
      </View>

      {/* Care Chain bonuses */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Care Chain Bonuses (Push 13)</Text>
        <Text style={styles.sectionNote}>Step size 6 · full chain 25 · stabilize 18</Text>
        {[
          ["1 link",  "small bonus"],
          ["full chain (≥5 links)", "+25% strike / +18% stabilize"],
        ].map(([label, note], i) => (
          <View key={label} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
            <Text style={styles.tableCell}>{label}</Text>
            <Text style={[styles.tableCell, { color: COLORS.onSurfaceSecondary }]}>{note}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function FormulaCard({
  title,
  color,
  lines,
  factors,
}: {
  title: string;
  color: string;
  lines: string[];
  factors: { name: string; note: string }[];
}) {
  return (
    <View style={[styles.sectionCard, { borderColor: color + "44" }]}>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      <View style={[styles.codeBlock, { borderColor: color + "33" }]}>
        {lines.map((l, i) => (
          <Text key={i} style={styles.codeText}>{l}</Text>
        ))}
      </View>
      {factors.map((f) => (
        <View key={f.name} style={styles.factorRow}>
          <Text style={[styles.factorName, { color }]}>{f.name}</Text>
          <Text style={styles.factorNote}>{f.note}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Chapter Pools Tab ─────────────────────────────────────────────────────────

function ChapterPoolsTab() {
  const chapters = useMemo(() => {
    return Array.from({ length: 9 }, (_, i) => {
      const ch = i + 1;
      const pool = ENEMIES.filter(
        (e) => e.difficulty === ch && !e.worldBoss && !e.isAffliction
      );
      return { ch, pool };
    });
  }, []);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.listPad}>
      {chapters.map(({ ch, pool }) => (
        <View key={ch} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Chapter {ch}</Text>
          <Text style={styles.sectionNote}>{pool.length} enemies</Text>
          {pool.map((e) => {
            const isBoss = e.bossGuard || e.scriptedLoss;
            const sysColor = elementColor(e.primarySystem);
            return (
              <View key={e.id} style={styles.poolRow}>
                <View style={[styles.poolDot, { backgroundColor: sysColor }]} />
                <View style={styles.poolInfo}>
                  <Text style={[styles.poolName, { color: sysColor }]}>{e.name}</Text>
                  <Text style={styles.poolId}>{e.id}{isBoss ? " · BOSS" : ""}</Text>
                </View>
                <View style={[styles.chip, { backgroundColor: sysColor + "18", borderColor: sysColor + "66" }]}>
                  <Text style={[styles.chipText, { color: sysColor }]}>{e.primarySystem}</Text>
                </View>
              </View>
            );
          })}
          {pool.length === 0 && (
            <Text style={styles.emptyNote}>No enemies in pool yet.</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  notAvail: {
    flex: 1, backgroundColor: COLORS.surface,
    alignItems: "center", justifyContent: "center", padding: 32,
  },
  notAvailText: { color: COLORS.onSurfaceSecondary, fontSize: 16, textAlign: "center" },

  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { color: COLORS.onSurface, fontSize: 20, fontWeight: "800", letterSpacing: 0.5 },
  subtitle: { color: COLORS.onSurfaceSecondary, fontSize: 13, marginTop: 2 },

  tabBar: { flexDirection: "row", paddingHorizontal: 12, gap: 8, paddingBottom: 8 },
  tabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: COLORS.brand + "22", borderColor: COLORS.brand },
  tabLabel: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  tabLabelActive: { color: COLORS.brand },

  filterBar: { maxHeight: 44 },
  filterBarContent: { paddingHorizontal: 12, gap: 8, alignItems: "center", flexDirection: "row" },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.brand + "22", borderColor: COLORS.brand },
  filterLabel: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  filterLabelActive: { color: COLORS.brand },

  countLabel: {
    color: COLORS.onSurfaceTertiary, fontSize: 12,
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4,
  },

  scroll: { flex: 1 },
  listPad: { padding: 12, gap: 12 },

  // Enemy card
  card: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.border, gap: 8,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardName: { fontSize: 15, fontWeight: "800", flex: 1, marginRight: 6 },
  cardId: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontFamily: "monospace" },
  cardSub: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  badgeRow: { flexDirection: "row", gap: 4, flexShrink: 1, flexWrap: "wrap" },

  chip: {
    borderRadius: 5, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  chipText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  statBadge: {
    borderRadius: 7, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: COLORS.surface,
    alignItems: "center", minWidth: 72,
  },
  statValue: { fontSize: 13, fontWeight: "900" },
  statLabel: { fontSize: 10, color: COLORS.onSurfaceTertiary, fontWeight: "600", marginTop: 1 },

  // Mechanics tab
  sectionCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, gap: 8,
  },
  sectionTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "800" },
  sectionNote: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontFamily: "monospace" },

  codeBlock: {
    backgroundColor: COLORS.surface, borderRadius: 8, padding: 10,
    borderWidth: 1, gap: 2,
  },
  codeText: {
    color: COLORS.onSurfaceSecondary, fontSize: 11, fontFamily: "monospace", lineHeight: 17,
  },

  factorRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "flex-start" },
  factorName: { fontSize: 12, fontWeight: "800", fontFamily: "monospace" },
  factorNote: { color: COLORS.onSurfaceSecondary, fontSize: 12, flex: 1 },

  tableHeader: { borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 4 },
  tableHeaderText: { color: COLORS.onSurface, fontWeight: "800" },
  tableRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  tableRowAlt: { backgroundColor: COLORS.surface + "55", borderRadius: 4 },
  tableCell: { flex: 1, color: COLORS.onSurfaceSecondary, fontSize: 12 },
  tableCellMono: { width: 56, color: COLORS.onSurface, fontSize: 12, fontFamily: "monospace", fontWeight: "700" },

  // Chapter pools tab
  poolRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  poolDot: { width: 8, height: 8, borderRadius: 4 },
  poolInfo: { flex: 1 },
  poolName: { fontSize: 13, fontWeight: "700" },
  poolId: { fontSize: 10, color: COLORS.onSurfaceTertiary, fontFamily: "monospace" },
  emptyNote: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontStyle: "italic" },
});
