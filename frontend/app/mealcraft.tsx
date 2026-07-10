/**
 * Mealcraft: Lotus Plate
 *
 * Off-Shift nutrition mini-game. The player receives a patient meal ticket,
 * taps food items to build a plate, watches 5 nutrition meters update, then
 * serves the tray and gets short clinical feedback.
 *
 * Case 1: "Diabetic Lunch Tray"
 *
 * Tutorial: mealcraftIntro (forced, System-narrated, defined in tutorials.ts)
 *   Step 1 — centre dialogue: "Build a plate that keeps blood sugar steady."
 *   Step 2 — requireAction + requiredTargetId:"food_grilled_chicken"
 *             → TutorialOverlay scrim blocks all but the highlighted chicken card.
 *
 * Entry: Off-Shift → Lotus Plate Journal → Mealcraft card → /mealcraft
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { playRewardCue } from "@/src/game/cues";
import { usePlayer } from "@/src/game/store";
import { useHighlightTarget, useTutorial } from "@/src/game/tutorialStore";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ─────────────────────────────────────────────────────────────────────────────
// Types & Data
// ─────────────────────────────────────────────────────────────────────────────

interface NutritionValues {
  protein: number;
  fiber: number;
  sugar: number;
  sodium: number;
  hydration: number;
}

interface FoodItem {
  id: string;
  label: string;
  emoji: string;
  color: string;
  risk?: boolean;
  effect: Partial<NutritionValues>;
}

const FOODS: FoodItem[] = [
  {
    id: "food_grilled_chicken",
    label: "Grilled Chicken",
    emoji: "🍗",
    color: "#F97316",
    effect: { protein: 3, sodium: 1 },
  },
  {
    id: "food_brown_rice",
    label: "Brown Rice",
    emoji: "🌾",
    color: "#D97706",
    effect: { protein: 1, fiber: 2, sugar: 1 },
  },
  {
    id: "food_steamed_veg",
    label: "Steamed Veg",
    emoji: "🥦",
    color: "#22C55E",
    effect: { protein: 1, fiber: 3, hydration: 1 },
  },
  {
    id: "food_water",
    label: "Water",
    emoji: "💧",
    color: "#38BDF8",
    effect: { hydration: 3 },
  },
  {
    id: "food_low_sodium_soup",
    label: "Low-Sodium Soup",
    emoji: "🍜",
    color: "#6EE7B7",
    effect: { protein: 1, fiber: 1, sodium: 1, hydration: 2 },
  },
  {
    id: "food_fruit",
    label: "Fruit",
    emoji: "🍎",
    color: "#EC4899",
    effect: { fiber: 2, sugar: 2, hydration: 1 },
  },
  {
    id: "food_white_rice",
    label: "White Rice",
    emoji: "🍚",
    color: "#9CA3AF",
    risk: true,
    effect: { sugar: 2 },
  },
  {
    id: "food_soda",
    label: "Soda",
    emoji: "🥤",
    color: "#EF4444",
    risk: true,
    effect: { sugar: 4, sodium: 1, hydration: 1 },
  },
  {
    id: "food_chips",
    label: "Chips",
    emoji: "🍟",
    color: "#F59E0B",
    risk: true,
    effect: { sodium: 4, hydration: -1 },
  },
  {
    id: "food_cake",
    label: "Cake",
    emoji: "🎂",
    color: "#EF4444",
    risk: true,
    effect: { sugar: 5, sodium: 1 },
  },
];

interface MeterDef {
  key: keyof NutritionValues;
  label: string;
  color: string;
  good: "high" | "low";
  icon: string;
}

const METERS: MeterDef[] = [
  { key: "protein",   label: "Protein",   color: "#F97316", good: "high", icon: "flame" },
  { key: "fiber",     label: "Fiber",     color: "#22C55E", good: "high", icon: "leaf" },
  { key: "sugar",     label: "Sugar",     color: "#EF4444", good: "low",  icon: "alert-circle-outline" },
  { key: "sodium",    label: "Sodium",    color: "#A78BFA", good: "low",  icon: "flask-outline" },
  { key: "hydration", label: "Hydration", color: "#38BDF8", good: "high", icon: "water" },
];

const METER_MAX = 8;
const MAX_PLATE = 5;
const ZERO: NutritionValues = { protein: 0, fiber: 0, sugar: 0, sodium: 0, hydration: 0 };

function evalPlate(
  n: NutritionValues,
  count: number
): { good: boolean; text: string } {
  if (count < 2)
    return { good: false, text: "Add at least 2 items before serving." };
  if (n.sugar > 4)
    return {
      good: false,
      text: "Too much sugar. Try swapping soda or cake for water or vegetables.",
    };
  if (n.sodium > 4)
    return {
      good: false,
      text: "Too much sodium. Low-sodium choices protect kidney function.",
    };
  if (n.protein < 3)
    return {
      good: false,
      text: "Add a protein source. Protein slows glucose absorption.",
    };
  if (n.hydration < 2)
    return {
      good: false,
      text: "Add water or soup — hydration helps insulin work efficiently.",
    };
  if (n.fiber < 2)
    return {
      good: false,
      text: "More fiber helps. Try vegetables or brown rice to slow sugar spikes.",
    };
  return {
    good: true,
    text: "Good balance. Protein and fiber help slow glucose spikes. Well done.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FoodCard — own component so useHighlightTarget can be called per item
// ─────────────────────────────────────────────────────────────────────────────

interface FoodCardProps {
  food: FoodItem;
  onTap: (food: FoodItem) => void;
  onPlate: boolean;
  plateFull: boolean;
}

function FoodCard({ food, onTap, onPlate, plateFull }: FoodCardProps) {
  const { isHighlighted, onTargetPress, highlightStyle } = useHighlightTarget(
    food.id
  );

  const handlePress = useCallback(() => {
    if (onPlate) return;
    if (plateFull && !isHighlighted) return;
    if (isHighlighted) onTargetPress();
    onTap(food);
  }, [food, onPlate, plateFull, isHighlighted, onTargetPress, onTap]);

  const dimmed = onPlate || (plateFull && !isHighlighted);

  return (
    <Pressable
      testID={food.id}
      onPress={handlePress}
      style={[
        styles.foodCard,
        { borderColor: food.color + "40" },
        isHighlighted && (highlightStyle as ViewStyle),
        dimmed && styles.foodCardDim,
      ]}
    >
      <Text style={styles.foodEmoji}>{food.emoji}</Text>
      <Text
        style={[styles.foodLabel, { color: dimmed ? COLORS.onSurfaceTertiary : food.color }]}
        numberOfLines={2}
      >
        {food.label}
      </Text>
      {onPlate && (
        <View style={styles.foodCheck}>
          <Ionicons name="checkmark" size={10} color="#fff" />
        </View>
      )}
      {food.risk && !onPlate && (
        <View style={styles.riskTag}>
          <Text style={styles.riskTxt}>!</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NutritionMeter
// ─────────────────────────────────────────────────────────────────────────────

function NutritionMeter({
  def,
  value,
}: {
  def: MeterDef;
  value: number;
}) {
  const clamped = Math.min(Math.max(value, 0), METER_MAX);
  const pct = (clamped / METER_MAX) * 100;

  // Warn if a "low is good" meter is high, or "high is good" meter is low
  const warn =
    (def.good === "low" && clamped > 4) ||
    (def.good === "high" && clamped < 2 && value > 0);

  const fillColor = warn ? "#EF4444" : def.color;

  return (
    <View style={styles.meterRow}>
      <View style={styles.meterLabelWrap}>
        <Ionicons name={def.icon as any} size={12} color={fillColor} />
        <Text style={[styles.meterLabel, { color: fillColor }]}>{def.label}</Text>
      </View>
      <View style={styles.meterTrack}>
        <Animated.View
          style={[styles.meterFill, { width: `${pct}%` as any, backgroundColor: fillColor }]}
        />
      </View>
      <Text style={[styles.meterVal, { color: fillColor }]}>
        {clamped}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function MealcraftScreen() {
  const router = useRouter();
  const { player } = usePlayer();
  const { isCompleted, startTutorial } = useTutorial();

  const [plate, setPlate] = useState<string[]>([]);
  const [nutrition, setNutrition] = useState<NutritionValues>(ZERO);
  const [phase, setPhase] = useState<"build" | "result">("build");
  const [feedback, setFeedback] = useState<{ good: boolean; text: string } | null>(null);
  const [doneReady, setDoneReady] = useState(false);

  // Completion badge animation
  const badgeFade = useRef(new Animated.Value(0)).current;
  const badgeSlide = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!isCompleted("mealcraftIntro")) {
      const t = setTimeout(() => startTutorial("mealcraftIntro"), 600);
      return () => clearTimeout(t);
    }
  }, []);

  // ── Food tap ──────────────────────────────────────────────────────────────
  const addFood = useCallback((food: FoodItem) => {
    setPlate((prev) => {
      if (prev.includes(food.id) || prev.length >= MAX_PLATE) return prev;
      return [...prev, food.id];
    });
    setNutrition((n) => ({
      protein:   Math.max(0, n.protein   + (food.effect.protein   ?? 0)),
      fiber:     Math.max(0, n.fiber     + (food.effect.fiber     ?? 0)),
      sugar:     Math.max(0, n.sugar     + (food.effect.sugar     ?? 0)),
      sodium:    Math.max(0, n.sodium    + (food.effect.sodium    ?? 0)),
      hydration: Math.max(0, n.hydration + (food.effect.hydration ?? 0)),
    }));
  }, []);

  const removeFood = useCallback((foodId: string) => {
    const food = FOODS.find((f) => f.id === foodId);
    if (!food) return;
    setPlate((prev) => prev.filter((id) => id !== foodId));
    setNutrition((n) => ({
      protein:   Math.max(0, n.protein   - (food.effect.protein   ?? 0)),
      fiber:     Math.max(0, n.fiber     - (food.effect.fiber     ?? 0)),
      sugar:     Math.max(0, n.sugar     - (food.effect.sugar     ?? 0)),
      sodium:    Math.max(0, n.sodium    - (food.effect.sodium    ?? 0)),
      hydration: Math.max(0, n.hydration - (food.effect.hydration ?? 0)),
    }));
  }, []);

  // ── Serve ─────────────────────────────────────────────────────────────────
  const handleServe = useCallback(() => {
    const result = evalPlate(nutrition, plate.length);
    setFeedback(result);
    setPhase("result");
    playRewardCue();

    // Badge entrance
    setTimeout(() => {
      setDoneReady(true);
      Animated.parallel([
        Animated.timing(badgeFade,  { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(badgeSlide, { toValue: 0, duration: 340, useNativeDriver: true }),
      ]).start();
    }, 300);
  }, [nutrition, plate.length, badgeFade, badgeSlide]);

  // ── Loading guard ─────────────────────────────────────────────────────────
  if (!player) {
    return (
      <SafeAreaView style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: COLORS.onSurfaceSecondary, fontSize: 14 }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const plateFull = plate.length >= MAX_PLATE;
  const canServe  = plate.length >= 2;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <PlayerHeader player={player} />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/lotus-journal")}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>OFF-SHIFT · NUTRITION</Text>
          <Text style={styles.title}>Mealcraft: Lotus Plate</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Patient Ticket ──────────────────────────────────────────────── */}
        <View style={styles.ticketCard}>
          <View style={styles.ticketTopRow}>
            <View style={styles.ticketBadge}>
              <Ionicons name="document-text" size={12} color="#F59E0B" />
              <Text style={styles.ticketBadgeTxt}>MEAL TICKET</Text>
            </View>
            <Text style={styles.ticketRole}>Diabetic Patient · Lunch</Text>
          </View>
          <Text style={styles.ticketQuote}>
            "My blood sugar has been running high. I need a balanced lunch before my afternoon walk."
          </Text>
          <View style={styles.ticketGoal}>
            <Ionicons name="flag" size={12} color="#F59E0B" />
            <Text style={styles.ticketGoalTxt}>
              Build a balanced, blood-sugar-friendly plate
            </Text>
          </View>
        </View>

        {/* ── Food Grid (build phase only) ────────────────────────────────── */}
        {phase === "build" && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>CHOOSE ITEMS  ·  TAP TO ADD</Text>
              {plateFull && (
                <Text style={styles.plateFull}>Tray full — remove an item to swap</Text>
              )}
            </View>
            <View style={styles.foodGrid}>
              {FOODS.map((food) => (
                <FoodCard
                  key={food.id}
                  food={food}
                  onTap={addFood}
                  onPlate={plate.includes(food.id)}
                  plateFull={plateFull}
                />
              ))}
            </View>
          </>
        )}

        {/* ── Meal Tray ───────────────────────────────────────────────────── */}
        <View style={styles.trayCard}>
          <View style={styles.trayHeader}>
            <Ionicons name="restaurant" size={15} color="#F59E0B" />
            <Text style={styles.trayTitle}>
              Meal Tray ({plate.length}/{MAX_PLATE})
            </Text>
            {phase === "build" && plate.length > 0 && (
              <Text style={styles.trayHint}>tap chip to remove</Text>
            )}
          </View>

          {plate.length === 0 ? (
            <Text style={styles.trayEmpty}>Tap food above to add it to the tray</Text>
          ) : (
            <View style={styles.trayChips}>
              {plate.map((id) => {
                const food = FOODS.find((f) => f.id === id);
                if (!food) return null;
                return (
                  <Pressable
                    key={id}
                    style={[styles.trayChip, { borderColor: food.color + "55" }]}
                    onPress={() => phase === "build" && removeFood(id)}
                    hitSlop={4}
                  >
                    <Text style={styles.trayEmoji}>{food.emoji}</Text>
                    <Text style={[styles.trayLabel, { color: food.color }]}>
                      {food.label}
                    </Text>
                    {phase === "build" && (
                      <Ionicons name="close" size={11} color={COLORS.onSurfaceTertiary} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Nutrition Meters ─────────────────────────────────────────────── */}
        <View style={styles.metersCard}>
          <Text style={styles.metersTitle}>NUTRITION BALANCE</Text>
          {METERS.map((m) => (
            <NutritionMeter key={m.key} def={m} value={nutrition[m.key]} />
          ))}
          <View style={styles.metersLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#22C55E" }]} />
              <Text style={styles.legendTxt}>high = good</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
              <Text style={styles.legendTxt}>low = good</Text>
            </View>
          </View>
        </View>

        {/* ── Result Feedback (result phase) ─────────────────────────────── */}
        {phase === "result" && feedback && (
          <View
            style={[
              styles.feedbackCard,
              feedback.good ? styles.feedbackGood : styles.feedbackRisky,
            ]}
          >
            <Ionicons
              name={feedback.good ? "checkmark-circle" : "alert-circle-outline"}
              size={22}
              color={feedback.good ? "#22C55E" : "#F59E0B"}
            />
            <Text
              style={[
                styles.feedbackText,
                { color: feedback.good ? "#22C55E" : "#F59E0B" },
              ]}
            >
              {feedback.text}
            </Text>
          </View>
        )}

        {/* ── Completion Badge (result phase + good plate) ─────────────────── */}
        {phase === "result" && feedback?.good && (
          <Animated.View
            style={[
              styles.completionCard,
              {
                opacity: badgeFade,
                transform: [{ translateY: badgeSlide }],
              },
            ]}
            pointerEvents={doneReady ? "auto" : "none"}
          >
            <View style={styles.completionIcon}>
              <Ionicons name="trophy" size={22} color="#F59E0B" />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.completionKicker}>LOTUS PLATE COMPLETE</Text>
              <Text style={styles.completionLabel}>Nutrition Sense +1</Text>
            </View>
          </Animated.View>
        )}

        {/* ── Serve / Continue Button ──────────────────────────────────────── */}
        {phase === "build" ? (
          <Pressable
            style={[styles.serveBtn, !canServe && styles.serveBtnDisabled]}
            onPress={canServe ? handleServe : undefined}
            disabled={!canServe}
          >
            <Ionicons
              name="checkmark-done"
              size={18}
              color={canServe ? "#0B1A18" : COLORS.onSurfaceTertiary}
            />
            <Text
              style={[
                styles.serveTxt,
                !canServe && { color: COLORS.onSurfaceTertiary },
              ]}
            >
              {canServe
                ? "Serve the Tray"
                : `Add ${2 - plate.length} more item${2 - plate.length === 1 ? "" : "s"} to serve`}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.continueBtn}
            onPress={() => goBack(router, "/lotus-journal")}
          >
            <Text style={styles.continueTxt}>Return to Journal</Text>
            <Ionicons name="arrow-forward" size={18} color="#0B1A18" />
          </Pressable>
        )}

        {/* ── Safety note ──────────────────────────────────────────────────── */}
        <View style={styles.safetyRow}>
          <Ionicons name="shield-checkmark-outline" size={13} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.safetyTxt}>
            Nutrition game only — not medical advice. Individual dietary needs vary.
          </Text>
        </View>
      </ScrollView>

      <TutorialOverlay />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  kicker: {
    color: "#F59E0B",
    fontSize: 10, fontWeight: "700", letterSpacing: 2,
  },
  title: {
    color: COLORS.onSurface,
    fontSize: 22, fontWeight: "300", marginTop: 2,
  },

  // Scroll
  scroll: {
    padding: SPACING.lg,
    paddingTop: SPACING.xs,
    gap: SPACING.md,
    paddingBottom: 48,
  },

  // Patient Ticket
  ticketCard: {
    backgroundColor: "#111f18",
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: "#F59E0B30",
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  ticketTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },
  ticketBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F59E0B18",
    borderRadius: RADIUS.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#F59E0B40",
  },
  ticketBadgeTxt: {
    color: "#F59E0B",
    fontSize: 9, fontWeight: "800", letterSpacing: 1.5,
  },
  ticketRole: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 12, fontWeight: "600",
  },
  ticketQuote: {
    color: COLORS.onSurface,
    fontSize: 14, fontStyle: "italic", lineHeight: 20, fontWeight: "300",
  },
  ticketGoal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F59E0B0A",
    borderRadius: RADIUS.sm,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
  },
  ticketGoalTxt: {
    color: "#F59E0B",
    fontSize: 12, fontWeight: "600", flex: 1,
  },

  // Section Header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 4,
  },
  sectionTitle: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10, fontWeight: "700", letterSpacing: 1.5,
  },
  plateFull: {
    color: "#F59E0B",
    fontSize: 11, fontStyle: "italic",
  },

  // Food Grid
  foodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  foodCard: {
    width: "47%",
    minWidth: 140,
    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    padding: SPACING.sm,
    alignItems: "center",
    gap: 5,
    minHeight: 80,
    justifyContent: "center",
    position: "relative",
  },
  foodCardDim: {
    opacity: 0.4,
  },
  foodEmoji: {
    fontSize: 28,
    lineHeight: 34,
  },
  foodLabel: {
    fontSize: 12, fontWeight: "600", textAlign: "center", lineHeight: 16,
  },
  foodCheck: {
    position: "absolute",
    top: 6, right: 6,
    width: 18, height: 18,
    borderRadius: 9,
    backgroundColor: "#22C55E",
    alignItems: "center", justifyContent: "center",
  },
  riskTag: {
    position: "absolute",
    top: 6, left: 6,
    width: 16, height: 16,
    borderRadius: 8,
    backgroundColor: "#EF444420",
    borderWidth: 1, borderColor: "#EF444440",
    alignItems: "center", justifyContent: "center",
  },
  riskTxt: {
    color: "#EF4444",
    fontSize: 10, fontWeight: "900",
  },

  // Tray
  trayCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "#F59E0B22",
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  trayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trayTitle: {
    color: "#F59E0B",
    fontSize: 12, fontWeight: "700", flex: 1,
  },
  trayHint: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10, fontStyle: "italic",
  },
  trayEmpty: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12, fontStyle: "italic", textAlign: "center",
    paddingVertical: SPACING.sm,
  },
  trayChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  trayChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  trayEmoji: { fontSize: 14 },
  trayLabel: {
    fontSize: 11, fontWeight: "600",
  },

  // Nutrition Meters
  metersCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: 10,
  },
  metersTitle: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 9, fontWeight: "700", letterSpacing: 1.5,
    marginBottom: 2,
  },
  meterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  meterLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: 76,
  },
  meterLabel: {
    fontSize: 11, fontWeight: "600",
  },
  meterTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.surfaceTertiary,
    overflow: "hidden",
  },
  meterFill: {
    height: "100%",
    borderRadius: 4,
  },
  meterVal: {
    fontSize: 11, fontWeight: "700",
    width: 16, textAlign: "right",
  },
  metersLegend: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: 2,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10 },

  // Feedback
  feedbackCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    padding: SPACING.md,
  },
  feedbackGood: {
    backgroundColor: "#0a1f0a",
    borderColor: "#22C55E30",
  },
  feedbackRisky: {
    backgroundColor: "#1f1800",
    borderColor: "#F59E0B30",
  },
  feedbackText: {
    fontSize: 14, lineHeight: 20, fontWeight: "500", flex: 1,
  },

  // Completion Badge
  completionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: "#1a1200",
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: "#F59E0B40",
    padding: SPACING.md,
  },
  completionIcon: {
    width: 46, height: 46,
    borderRadius: 23,
    backgroundColor: "#F59E0B18",
    borderWidth: 1, borderColor: "#F59E0B40",
    alignItems: "center", justifyContent: "center",
  },
  completionKicker: {
    color: "#F59E0B",
    fontSize: 9, fontWeight: "800", letterSpacing: 2,
  },
  completionLabel: {
    color: COLORS.onSurface,
    fontSize: 15, fontWeight: "300",
  },

  // Serve Button
  serveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F59E0B",
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    minHeight: 54,
  },
  serveBtnDisabled: {
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  serveTxt: {
    color: "#0B1A18",
    fontSize: 15, fontWeight: "800", letterSpacing: 0.3,
  },

  // Continue Button
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F59E0B",
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    minHeight: 54,
  },
  continueTxt: {
    color: "#0B1A18",
    fontSize: 15, fontWeight: "800",
  },

  // Safety
  safetyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingTop: 4,
  },
  safetyTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10, lineHeight: 15, flex: 1,
  },
});
