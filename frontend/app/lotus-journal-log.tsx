import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import {
  DAILY_INSIGHT_CAP,
  FOOD_TILES_BY_CATEGORY,
  PLATE_CATEGORY_LABEL,
  PlateCategory,
  WellnessLogInput,
  WellnessLogType,
  WellnessResult,
} from "@/src/game/wellness";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const MEAL_TYPES: { key: WellnessLogType; label: string; icon: string }[] = [
  { key: "breakfast", label: "Breakfast", icon: "sunny-outline" },
  { key: "lunch", label: "Lunch", icon: "restaurant-outline" },
  { key: "dinner", label: "Dinner", icon: "moon-outline" },
  { key: "snack", label: "Snack", icon: "cafe-outline" },
];

const WELLNESS_TYPES: { key: WellnessLogType; label: string; icon: string; color: string }[] = [
  { key: "hydration", label: "Hydration", icon: "water-outline", color: COLORS.river },
  { key: "sleep", label: "Sleep", icon: "bed-outline", color: COLORS.mind },
  { key: "movement", label: "Movement", icon: "body-outline", color: COLORS.protection },
  { key: "mindfulness", label: "Mindfulness", icon: "flower-outline", color: "#A78BFA" },
  { key: "reflection", label: "Reflection", icon: "journal-outline", color: COLORS.brand },
  { key: "checkin", label: "Wellness Check-In", icon: "heart-outline", color: COLORS.growth },
];

const CATEGORY_ORDER: PlateCategory[] = ["protein", "carb", "veg_fruit_fiber", "fat_flavor", "drink", "treat"];

const DRINK_CHOICES = [
  { key: "water", label: "Water" },
  { key: "tea", label: "Unsweetened Tea" },
  { key: "herbal_tea", label: "Herbal Tea" },
  { key: "coffee", label: "Coffee" },
  { key: "soda", label: "Soda" },
  { key: "other", label: "Other" },
];

const HABIT_CHOICES = [
  { key: "sleep", label: "Slept well" },
  { key: "movement", label: "Moved my body" },
  { key: "stress_reset", label: "Took a stress reset" },
  { key: "hydration", label: "Stayed hydrated" },
];

const SLEEP_RATINGS = [
  { key: "great", label: "Slept great", icon: "sunny", color: COLORS.growth },
  { key: "ok", label: "Slept okay", icon: "partly-sunny-outline", color: COLORS.energy },
  { key: "fair", label: "A little restless", icon: "cloudy-outline", color: COLORS.onSurfaceSecondary },
  { key: "poor", label: "Not enough sleep", icon: "rainy-outline", color: COLORS.onSurfaceTertiary },
];

const ACTIVITY_TYPES = [
  { key: "walk", label: "Walk or jog" },
  { key: "stretch", label: "Stretching" },
  { key: "yoga", label: "Yoga" },
  { key: "sports", label: "Sports or gym" },
  { key: "dance", label: "Dance" },
  { key: "cycling", label: "Cycling" },
  { key: "other", label: "Something else" },
];

const MINDFUL_CHOICES = [
  { key: "breathing", label: "Breathing exercise" },
  { key: "meditation", label: "Short meditation" },
  { key: "nature", label: "Nature walk or quiet moment" },
  { key: "journaling", label: "Journaling" },
  { key: "other", label: "Another mindful pause" },
];

const REFLECTION_PROMPTS = [
  "How is your energy today?",
  "Did you drink water today?",
  "Did you move or stretch?",
  "How did you rest last night?",
  "What is one healthy choice you made?",
];

type Step = "type" | "plate" | "hydration" | "checkin" | "sleep" | "movement" | "mindfulness" | "reflection" | "result";

export default function LotusJournalLogPage() {
  const router = useRouter();
  const { logWellnessActivity } = usePlayer();
  const { onRequiredAction } = useTutorial();
  const [step, setStep] = useState<Step>("type");
  const [logType, setLogType] = useState<WellnessLogType>("breakfast");
  const [tileIds, setTileIds] = useState<string[]>([]);
  const [drinkChoice, setDrinkChoice] = useState<string | null>(null);
  const [habits, setHabits] = useState<string[]>([]);
  const [sleepRating, setSleepRating] = useState<string | null>(null);
  const [activityTypes, setActivityTypes] = useState<string[]>([]);
  const [mindfulChoice, setMindfulChoice] = useState<string | null>(null);
  const [result, setResult] = useState<WellnessResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep("type");
    setTileIds([]);
    setDrinkChoice(null);
    setHabits([]);
    setSleepRating(null);
    setActivityTypes([]);
    setMindfulChoice(null);
    setResult(null);
  };

  const chooseType = (t: WellnessLogType) => {
    setLogType(t);
    if (t === "hydration") setStep("hydration");
    else if (t === "checkin") setStep("checkin");
    else if (t === "sleep") setStep("sleep");
    else if (t === "movement") setStep("movement");
    else if (t === "mindfulness") setStep("mindfulness");
    else if (t === "reflection") setStep("reflection");
    else setStep("plate");
  };

  const toggleTile = (id: string) => {
    setTileIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleHabit = (id: string) => {
    setHabits((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleActivity = (id: string) => {
    setActivityTypes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    let input: WellnessLogInput;
    if (logType === "hydration") {
      input = { type: "hydration", drinkChoice: drinkChoice || "water" };
    } else if (logType === "checkin") {
      input = { type: "checkin", habits };
    } else if (logType === "sleep") {
      input = { type: "sleep", sleepRating: sleepRating || "ok" };
    } else if (logType === "movement") {
      input = { type: "movement", activityTypes };
    } else if (logType === "mindfulness") {
      input = { type: "mindfulness", mindfulChoice: mindfulChoice || "breathing" };
    } else if (logType === "reflection") {
      input = { type: "reflection" };
    } else {
      input = { type: logType, tileIds };
    }
    const res = await logWellnessActivity(input);
    setSubmitting(false);
    if (res) {
      setResult(res);
      setStep("result");
      onRequiredAction("logEntry");
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => (step === "type" ? router.back() : reset())} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>LOTUS PLATE JOURNAL</Text>
          <Text style={styles.title}>Log an Activity</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Type selector ─────────────────────────────────────── */}
        {step === "type" && (
          <>
            <Text style={styles.lead}>What would you like to log?</Text>

            <Text style={styles.sectionLbl}>MEALS</Text>
            <View style={styles.grid}>
              {MEAL_TYPES.map((t) => (
                <Pressable key={t.key} style={styles.typeCard} onPress={() => chooseType(t.key)}>
                  <Ionicons name={t.icon as any} size={22} color={COLORS.brand} />
                  <Text style={styles.typeLbl}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLbl}>WELLNESS CHECK-INS</Text>
            <View style={styles.grid}>
              {WELLNESS_TYPES.map((t) => (
                <Pressable key={t.key} style={styles.typeCard} onPress={() => chooseType(t.key)}>
                  <Ionicons name={t.icon as any} size={22} color={t.color} />
                  <Text style={styles.typeLbl}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.wellnessNote}>
              Wellness logs support reflection and healthy habits. They are general wellness tools, not medical advice.
            </Text>
          </>
        )}

        {/* ── Meal plate builder ────────────────────────────────── */}
        {step === "plate" && (
          <>
            <Text style={styles.lead}>
              Build your {MEAL_TYPES.find((m) => m.key === logType)?.label.toLowerCase()} plate. No exact calorie
              counting needed — just tap what is on it.
            </Text>
            {CATEGORY_ORDER.map((cat) => (
              <View key={cat} style={{ gap: 8 }}>
                <Text style={styles.categoryLbl}>{PLATE_CATEGORY_LABEL[cat]}</Text>
                <View style={styles.tileRow}>
                  {FOOD_TILES_BY_CATEGORY[cat].map((tile) => {
                    const selected = tileIds.includes(tile.id);
                    return (
                      <Pressable
                        key={tile.id}
                        style={[styles.tile, selected && styles.tileSelected]}
                        onPress={() => toggleTile(tile.id)}
                        testID={`plate-tile-${tile.id}`}
                      >
                        <Text style={styles.tileEmoji}>{tile.emoji}</Text>
                        <Text style={[styles.tileLbl, selected && { color: COLORS.onBrand }]}>{tile.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            <Pressable
              style={[styles.submitBtn, tileIds.length === 0 && { opacity: 0.4 }]}
              onPress={submit}
              disabled={tileIds.length === 0 || submitting}
            >
              <Text style={styles.submitBtnTxt}>Submit Plate</Text>
            </Pressable>
          </>
        )}

        {/* ── Hydration ─────────────────────────────────────────── */}
        {step === "hydration" && (
          <>
            <Text style={styles.lead}>How did you hydrate?</Text>
            <View style={styles.grid}>
              {DRINK_CHOICES.map((d) => (
                <Pressable
                  key={d.key}
                  style={[styles.typeCard, drinkChoice === d.key && styles.tileSelected]}
                  onPress={() => setDrinkChoice(d.key)}
                >
                  <Text style={[styles.typeLbl, drinkChoice === d.key && { color: COLORS.onBrand }]}>{d.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.submitBtn, !drinkChoice && { opacity: 0.4 }]} onPress={submit} disabled={!drinkChoice || submitting}>
              <Text style={styles.submitBtnTxt}>Log Hydration</Text>
            </Pressable>
          </>
        )}

        {/* ── Wellness Check-In ─────────────────────────────────── */}
        {step === "checkin" && (
          <>
            <Text style={styles.lead}>How is today going? Select anything that applies — no wrong answers.</Text>
            <View style={{ gap: 8 }}>
              {HABIT_CHOICES.map((h) => {
                const selected = habits.includes(h.key);
                return (
                  <Pressable key={h.key} style={[styles.habitRow, selected && styles.tileSelected]} onPress={() => toggleHabit(h.key)}>
                    <Ionicons name={selected ? "checkbox" : "square-outline"} size={18} color={selected ? COLORS.onBrand : COLORS.onSurfaceTertiary} />
                    <Text style={[styles.habitLbl, selected && { color: COLORS.onBrand }]}>{h.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.submitBtn} onPress={submit} disabled={submitting}>
              <Text style={styles.submitBtnTxt}>Submit Check-In</Text>
            </Pressable>
          </>
        )}

        {/* ── Sleep Check-In ────────────────────────────────────── */}
        {step === "sleep" && (
          <>
            <Text style={styles.promptQ}>How did you rest?</Text>
            <Text style={styles.lead}>No judgment here — just a gentle check-in on your sleep.</Text>
            <View style={{ gap: 8 }}>
              {SLEEP_RATINGS.map((r) => (
                <Pressable
                  key={r.key}
                  style={[styles.habitRow, sleepRating === r.key && styles.tileSelected]}
                  onPress={() => setSleepRating(r.key)}
                >
                  <Ionicons name={r.icon as any} size={18} color={sleepRating === r.key ? COLORS.onBrand : r.color} />
                  <Text style={[styles.habitLbl, sleepRating === r.key && { color: COLORS.onBrand }]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.submitBtn, !sleepRating && { opacity: 0.4 }]} onPress={submit} disabled={!sleepRating || submitting}>
              <Text style={styles.submitBtnTxt}>Log Sleep</Text>
            </Pressable>
          </>
        )}

        {/* ── Movement Check-In ─────────────────────────────────── */}
        {step === "movement" && (
          <>
            <Text style={styles.promptQ}>Did you move today?</Text>
            <Text style={styles.lead}>Select anything that applies. Even a short walk counts.</Text>
            <View style={{ gap: 8 }}>
              {ACTIVITY_TYPES.map((a) => {
                const selected = activityTypes.includes(a.key);
                return (
                  <Pressable key={a.key} style={[styles.habitRow, selected && styles.tileSelected]} onPress={() => toggleActivity(a.key)}>
                    <Ionicons name={selected ? "checkbox" : "square-outline"} size={18} color={selected ? COLORS.onBrand : COLORS.onSurfaceTertiary} />
                    <Text style={[styles.habitLbl, selected && { color: COLORS.onBrand }]}>{a.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.submitBtn} onPress={submit} disabled={submitting}>
              <Text style={styles.submitBtnTxt}>{activityTypes.length > 0 ? "Log Movement" : "Log — Nothing Today"}</Text>
            </Pressable>
          </>
        )}

        {/* ── Mindfulness Check-In ──────────────────────────────── */}
        {step === "mindfulness" && (
          <>
            <Text style={styles.promptQ}>Did you take a mindful moment?</Text>
            <Text style={styles.lead}>A minute of calm is still a minute of calm, no matter how it looks.</Text>
            <View style={{ gap: 8 }}>
              {MINDFUL_CHOICES.map((m) => (
                <Pressable
                  key={m.key}
                  style={[styles.habitRow, mindfulChoice === m.key && styles.tileSelected]}
                  onPress={() => setMindfulChoice(m.key)}
                >
                  <Ionicons name={mindfulChoice === m.key ? "radio-button-on" : "radio-button-off"} size={18} color={mindfulChoice === m.key ? COLORS.onBrand : COLORS.onSurfaceTertiary} />
                  <Text style={[styles.habitLbl, mindfulChoice === m.key && { color: COLORS.onBrand }]}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.submitBtn, !mindfulChoice && { opacity: 0.4 }]} onPress={submit} disabled={!mindfulChoice || submitting}>
              <Text style={styles.submitBtnTxt}>Log Mindful Moment</Text>
            </Pressable>
          </>
        )}

        {/* ── Reflection Prompt ─────────────────────────────────── */}
        {step === "reflection" && (
          <>
            <Text style={styles.promptQ}>Take a moment to reflect.</Text>
            <View style={styles.promptCard}>
              {REFLECTION_PROMPTS.map((p, i) => (
                <View key={i} style={styles.promptRow}>
                  <Ionicons name="leaf-outline" size={13} color={COLORS.brand} />
                  <Text style={styles.promptTxt}>{p}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.lead}>
              You do not need to answer every prompt — just pause and notice. Then log when you are ready.
            </Text>
            <Pressable style={styles.submitBtn} onPress={submit} disabled={submitting}>
              <Text style={styles.submitBtnTxt}>Log Reflection</Text>
            </Pressable>
          </>
        )}

        {/* ── Result ────────────────────────────────────────────── */}
        {step === "result" && result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultRating}>{result.feedback.rating}</Text>
            <View style={{ gap: 4 }}>
              <Text style={styles.resultLabel}>Strengths</Text>
              {result.feedback.strengths.map((s, i) => (
                <View key={i} style={styles.resultRow}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                  <Text style={styles.resultTxt}>{s}</Text>
                </View>
              ))}
            </View>
            <View style={{ gap: 4 }}>
              <Text style={styles.resultLabel}>One idea for next time</Text>
              <Text style={styles.resultTxt}>{result.feedback.suggestion}</Text>
            </View>
            <View style={{ gap: 4 }}>
              <Text style={styles.resultLabel}>Why it helps</Text>
              <Text style={styles.resultTxt}>{result.feedback.explanation}</Text>
            </View>
            <View style={styles.rewardRow}>
              <View style={styles.rewardPill}>
                <Ionicons name="flower" size={14} color={COLORS.growth} />
                <Text style={styles.rewardTxt}>+{result.petalsEarned} Petals</Text>
              </View>
              {result.gemAwarded && (
                <View style={styles.rewardPill}>
                  <Ionicons name="diamond" size={14} color={COLORS.mind} />
                  <Text style={styles.rewardTxt}>+1 Insight Crystal</Text>
                </View>
              )}
              {result.gemCapped && (
                <View style={[styles.rewardPill, { backgroundColor: COLORS.surfaceTertiary }]}>
                  <Ionicons name="lock-closed" size={12} color={COLORS.onSurfaceTertiary} />
                  <Text style={[styles.rewardTxt, { color: COLORS.onSurfaceTertiary }]}>
                    Insight Crystals capped for today ({DAILY_INSIGHT_CAP}/day) — come back tomorrow!
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm }}>
              <Pressable style={[styles.submitBtn, { flex: 1 }]} onPress={reset}>
                <Text style={styles.submitBtnTxt}>Log Another</Text>
              </Pressable>
              <Pressable style={[styles.submitBtn, styles.secondaryBtn, { flex: 1 }]} onPress={() => router.back()}>
                <Text style={[styles.submitBtnTxt, { color: COLORS.onSurface }]}>Back to Journal</Text>
              </Pressable>
            </View>
          </View>
        )}

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
  scroll: { padding: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  sectionLbl: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginTop: 4 },
  lead: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20, marginBottom: SPACING.sm },
  promptQ: { color: COLORS.onSurface, fontSize: 18, fontWeight: "600", lineHeight: 26 },
  wellnessNote: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 17, fontStyle: "italic", marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  typeCard: {
    width: "31%", minWidth: 100, alignItems: "center", gap: 6,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, paddingVertical: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  typeLbl: { color: COLORS.onSurface, fontSize: 12, fontWeight: "500", textAlign: "center" },
  categoryLbl: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  tileRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    alignItems: "center", gap: 2, width: 74, paddingVertical: 10,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tileSelected: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  tileEmoji: { fontSize: 20 },
  tileLbl: { color: COLORS.onSurfaceSecondary, fontSize: 11, textAlign: "center" },
  habitRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  habitLbl: { color: COLORS.onSurface, fontSize: 13 },
  promptCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm,
  },
  promptRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  promptTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19, flex: 1 },
  submitBtn: { marginTop: SPACING.md, backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: "center" },
  secondaryBtn: { backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border },
  submitBtnTxt: { color: COLORS.onBrand, fontWeight: "700" },
  resultCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md,
  },
  resultRating: { color: COLORS.brand, fontSize: 20, fontWeight: "700" },
  resultLabel: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  resultTxt: { color: COLORS.onSurface, fontSize: 13, lineHeight: 19, flex: 1 },
  rewardRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rewardPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.pill,
    paddingVertical: 6, paddingHorizontal: 10,
  },
  rewardTxt: { color: COLORS.onSurface, fontSize: 12 },
});
