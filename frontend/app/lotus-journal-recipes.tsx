import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { RECIPE_GOAL_LABEL, RECIPES, RecipeGoal } from "@/src/game/wellness";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const GOALS = Object.keys(RECIPE_GOAL_LABEL) as RecipeGoal[];

export default function LotusJournalRecipesPage() {
  const router = useRouter();
  const { logWellnessActivity } = usePlayer();
  const [activeGoal, setActiveGoal] = useState<RecipeGoal | null>(null);
  const [triedMsg, setTriedMsg] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    if (!activeGoal) return RECIPES;
    return RECIPES.filter((r) => r.goals.includes(activeGoal));
  }, [activeGoal]);

  const tryRecipe = async (recipeId: string) => {
    const res = await logWellnessActivity({ type: "recipe", recipeId });
    if (res) {
      setTriedMsg((prev) => ({
        ...prev,
        [recipeId]: res.gemAwarded ? `+${res.petalsEarned} Petals, +1 Lotus Gem!` : `+${res.petalsEarned} Petals!`,
      }));
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>LOTUS PLATE JOURNAL</Text>
          <Text style={styles.title}>Recipe Ideas</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.goalScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: SPACING.lg }}>
        <Pressable style={[styles.goalChip, !activeGoal && styles.goalChipActive]} onPress={() => setActiveGoal(null)}>
          <Text style={[styles.goalChipTxt, !activeGoal && { color: COLORS.onBrand }]}>All</Text>
        </Pressable>
        {GOALS.map((g) => (
          <Pressable key={g} style={[styles.goalChip, activeGoal === g && styles.goalChipActive]} onPress={() => setActiveGoal(g)}>
            <Text style={[styles.goalChipTxt, activeGoal === g && { color: COLORS.onBrand }]}>{RECIPE_GOAL_LABEL[g]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.hint}>
          Portions use hand-size guides instead of grams: protein ≈ palm, carb ≈ fist, vegetables/fruit ≈ 1–2 fists,
          fat/sauce ≈ thumb, drink ≈ water or an unsweetened option when possible.
        </Text>
        {filtered.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.cardName}>{r.name}</Text>
            <View style={styles.tagsRow}>
              {r.goals.map((g) => (
                <View key={g} style={styles.tag}>
                  <Text style={styles.tagTxt}>{RECIPE_GOAL_LABEL[g]}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.cardLabel}>Ingredients</Text>
            <Text style={styles.cardTxt}>{r.ingredients.join(", ")}</Text>
            <Text style={styles.cardLabel}>Hand-Portion Guide</Text>
            <Text style={styles.cardTxt}>{r.portionGuide}</Text>
            <Text style={styles.cardLabel}>Why It Helps</Text>
            <Text style={styles.cardTxt}>{r.why}</Text>
            <Pressable style={styles.tryBtn} onPress={() => tryRecipe(r.id)}>
              <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.onBrand} />
              <Text style={styles.tryBtnTxt}>I Tried This</Text>
            </Pressable>
            {triedMsg[r.id] && <Text style={styles.triedMsg}>{triedMsg[r.id]}</Text>}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg, paddingBottom: SPACING.sm },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  kicker: { color: COLORS.growth, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300", marginTop: 2 },
  goalScroll: { flexGrow: 0, marginBottom: SPACING.sm },
  goalChip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border,
  },
  goalChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  goalChipTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "600" },
  scroll: { padding: SPACING.lg, paddingTop: 0, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  hint: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18, fontStyle: "italic", marginBottom: SPACING.sm },
  card: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, gap: 6,
  },
  cardName: { color: COLORS.onSurface, fontSize: 16, fontWeight: "600" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  tag: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.pill, paddingVertical: 3, paddingHorizontal: 8 },
  tagTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "600" },
  cardLabel: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginTop: 4 },
  cardTxt: { color: COLORS.onSurface, fontSize: 12, lineHeight: 18 },
  tryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: 10, marginTop: SPACING.sm,
  },
  tryBtnTxt: { color: COLORS.onBrand, fontWeight: "700", fontSize: 13 },
  triedMsg: { color: COLORS.success, fontSize: 12, fontStyle: "italic", textAlign: "center" },
});
