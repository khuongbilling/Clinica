import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import {
  MATERIALS, MATERIAL_CATEGORY_META, MATERIAL_GUARDRAILS,
  MaterialCategory, MaterialDef,
} from "@/src/game/materials";

const CATEGORY_ORDER: MaterialCategory[] = [
  "core_currency", "recruitment", "hero_growth", "player_class", "realm",
  "clinical_supplies", "ward_defense", "wellness", "events", "faction",
];

const RARITY_COLOR: Record<MaterialDef["rarity"], string> = {
  common: COLORS.onSurfaceTertiary,
  uncommon: COLORS.growth,
  rare: COLORS.river,
  epic: COLORS.storm,
  legendary: COLORS.brand,
};

const KIND_LABEL: Record<MaterialDef["kind"], string> = {
  power: "Power", cosmetic: "Cosmetic", wellness: "Wellness", learning: "Learning", faction: "Faction",
};

export default function MaterialGuideScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<MaterialCategory | "all">("all");

  const meta = category !== "all" ? MATERIAL_CATEGORY_META[category] : null;
  const items = useMemo(
    () => (category === "all" ? MATERIALS : MATERIALS.filter((m) => m.category === category)),
    [category]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/profile"); }}
          hitSlop={10}
          style={styles.backBtn}
          testID="materials-back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Material Guide</Text>
          <Text style={styles.subtitle}>What it is, where to earn it, what it's for</Text>
        </View>
      </View>

      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          <Pressable
            onPress={() => setCategory("all")}
            style={[styles.tab, category === "all" && styles.tabActive]}
            testID="materials-tab-all"
          >
            <Ionicons name="apps-outline" size={14} color={category === "all" ? COLORS.onBrand : COLORS.onSurfaceSecondary} />
            <Text style={[styles.tabTxt, category === "all" && styles.tabTxtActive]}>All</Text>
          </Pressable>
          {CATEGORY_ORDER.map((c) => {
            const m = MATERIAL_CATEGORY_META[c];
            const active = category === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.tab, active && styles.tabActive]}
                testID={`materials-tab-${c}`}
              >
                <Ionicons name={m.icon as any} size={14} color={active ? COLORS.onBrand : COLORS.onSurfaceSecondary} />
                <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {meta && <Text style={styles.blurb}>{meta.blurb}</Text>}
        {!meta && (
          <Text style={styles.blurb}>
            Every currency and material in Clinica, organized by where you earn it and what it's
            for. Each one belongs primarily to one mode so you always know where to farm it.
          </Text>
        )}

        {items.map((m) => (
          <View key={m.id} style={styles.card} testID={`material-card-${m.id}`}>
            <View style={styles.cardHead}>
              <View style={[styles.iconBadge, { borderColor: RARITY_COLOR[m.rarity] }]}>
                <Ionicons name={m.icon as any} size={20} color={RARITY_COLOR[m.rarity]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{m.name}</Text>
                <View style={styles.pillRow}>
                  <Text style={[styles.pill, { color: RARITY_COLOR[m.rarity], borderColor: RARITY_COLOR[m.rarity] }]}>
                    {m.rarity}
                  </Text>
                  <Text style={styles.pill}>{KIND_LABEL[m.kind]}</Text>
                  <Text style={[styles.pill, m.status === "future" ? styles.pillFuture : styles.pillActive]}>
                    {m.status === "future" ? "Future" : "Active"}
                  </Text>
                </View>
              </View>
            </View>

            {m.examples && m.examples.length > 0 && (
              <Text style={styles.cardExamples}>{m.examples.join(" · ")}</Text>
            )}

            <Text style={styles.cardRow}><Text style={styles.cardLabel}>Source: </Text>{m.source}</Text>
            <Text style={styles.cardRow}><Text style={styles.cardLabel}>Used for: </Text>{m.usedFor}</Text>
            <Text style={styles.cardRow}><Text style={styles.cardLabel}>Related: </Text>{m.relatedMode}</Text>
            {m.note && <Text style={styles.cardNote}>{m.note}</Text>}
          </View>
        ))}

        {category === "all" && (
          <>
            <Text style={styles.sectionLabel}>ECONOMY GUARDRAILS</Text>
            {MATERIAL_GUARDRAILS.map((g, i) => (
              <View key={i} style={styles.guardrailCard}>
                <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
                <Text style={styles.guardrailTxt}>{g}</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 2 },
  title: { color: COLORS.onSurface, fontSize: 20, fontWeight: "800" },
  subtitle: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 1 },
  tabsWrap: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabs: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  tabTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "600" },
  tabTxtActive: { color: COLORS.onBrand, fontWeight: "800" },
  scroll: { padding: SPACING.lg, gap: SPACING.md },
  blurb: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 17, marginBottom: SPACING.xs },
  sectionLabel: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: SPACING.md },
  card: {
    backgroundColor: COLORS.surfaceSecondary, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.md, gap: 3, marginBottom: SPACING.sm,
  },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  iconBadge: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surfaceTertiary,
  },
  cardName: { color: COLORS.onSurface, fontSize: 15, fontWeight: "700" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  pill: {
    color: COLORS.onSurfaceSecondary, fontSize: 9, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase",
    borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.border,
  },
  pillActive: { color: COLORS.success, borderColor: COLORS.success },
  pillFuture: { color: COLORS.warning, borderColor: COLORS.warning },
  cardExamples: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontStyle: "italic", marginTop: 6 },
  cardRow: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 16, marginTop: 5 },
  cardLabel: { color: COLORS.onSurfaceSecondary, fontWeight: "700" },
  cardNote: { color: COLORS.warning, fontSize: 11, lineHeight: 15, marginTop: 5, fontStyle: "italic" },
  guardrailCard: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.xs,
  },
  guardrailTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18, flex: 1 },
});
