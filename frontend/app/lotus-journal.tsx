import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { goBack } from "@/src/utils/navigation";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { RewardPreview } from "@/src/components/RewardPreview";
import { DAILY_INSIGHT_CAP, WELLNESS_LESSONS } from "@/src/game/wellness";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const GARDEN_METERS = [
  { key: "hydration" as const, label: "Hydration Well", icon: "water", color: COLORS.river },
  { key: "fiber" as const, label: "Fiber Vines", icon: "leaf", color: COLORS.protection },
  { key: "protein" as const, label: "Training Kitchen", icon: "flame", color: COLORS.forge },
  { key: "heart" as const, label: "Heart Lantern", icon: "heart", color: COLORS.growth },
];

const BOUTIQUE_ITEMS = [
  "Hero outfits", "Café decorations", "Nutrition Garden themes", "Journal themes",
  "Recipe card skins", "Profile frames", "Non-combat companions", "Battle visual effects",
];

export default function LotusJournalPage() {
  const router = useRouter();
  const { player, logWellnessActivity } = usePlayer();
  const { isCompleted, startTutorial, onRequiredAction } = useTutorial();
  const [lessonOpen, setLessonOpen] = useState<string | null>(null);
  const [lessonMsg, setLessonMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isCompleted("firstLotusEntry")) {
      const t = setTimeout(() => startTutorial("firstLotusEntry"), 600);
      return () => clearTimeout(t);
    }
  }, []);

  if (!player || !player.wellness) {
    return (
      <SafeAreaView style={[styles.root, styles.loading]} edges={["top", "bottom"]} testID="lotus-journal-loading">
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }
  const wellness = player.wellness;

  const today = new Date().toISOString().slice(0, 10);
  const gemsToday = wellness.daily.date === today ? wellness.daily.gems_earned : 0;
  const gemsCappedToday = gemsToday >= DAILY_INSIGHT_CAP;

  const completeLesson = async (lessonId: string) => {
    const res = await logWellnessActivity({ type: "lesson", lessonId });
    if (res) {
      setLessonMsg(res.gemAwarded ? `+${res.petalsEarned} Nourishment Petals!` : res.petalsEarned > 0 ? `+${res.petalsEarned} Nourishment Petals!` : "Nice refresher!");
    }
    setLessonOpen(null);
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <PlayerHeader player={player} />
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/(tabs)")} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>OFF-SHIFT · NO STAMINA COST</Text>
          <Text style={styles.title}>Lotus Plate Journal</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          Log meals, hydration, sleep, movement, mindfulness, and reflections — learn simple everyday wellness
          tips, grow your Nutrition Garden, and earn safe cosmetic rewards. Entirely off-shift — never spends
          stamina or shift time. General wellness tools only, not medical advice.
        </Text>

        {/* Currencies */}
        <View style={styles.currencyRow}>
          <View style={styles.currencyPill}>
            <Ionicons name="flower" size={16} color={COLORS.growth} />
            <Text style={styles.currencyVal}>{wellness.nourishment_petals}</Text>
            <Text style={styles.currencyLbl}>Petals</Text>
          </View>
          <View style={styles.currencyPill}>
            <Ionicons name="sparkles" size={16} color={COLORS.mind} />
            <Text style={styles.currencyVal}>{wellness.insight_crystals_earned}</Text>
            <Text style={styles.currencyLbl}>Insight Crystals</Text>
          </View>
          <View style={styles.currencyPill}>
            <Ionicons name={gemsCappedToday ? "lock-closed" : "flash"} size={14} color={gemsCappedToday ? COLORS.onSurfaceTertiary : COLORS.brand} />
            <Text style={[styles.currencyLbl, { color: gemsCappedToday ? COLORS.onSurfaceTertiary : COLORS.onSurfaceSecondary }]}>
              {gemsCappedToday ? "Crystals capped today" : `${gemsToday}/${DAILY_INSIGHT_CAP} crystals today`}
            </Text>
          </View>
        </View>

        <RewardPreview mode="Lotus Plate Journal" />

        {/* Main actions */}
        <Pressable style={styles.actionCard} onPress={() => router.push("/lotus-journal-log")}>
          <View style={[styles.actionIcon, { backgroundColor: COLORS.growth + "20" }]}>
            <Ionicons name="restaurant" size={22} color={COLORS.growth} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Log a Meal or Check-In</Text>
            <Text style={styles.actionSub}>Build a plate, log hydration, or check in on sleep/movement/stress</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.onSurfaceTertiary} />
        </Pressable>

        <Pressable style={styles.actionCard} onPress={() => router.push("/lotus-journal-recipes")}>
          <View style={[styles.actionIcon, { backgroundColor: COLORS.energy + "20" }]}>
            <Ionicons name="book" size={22} color={COLORS.energy} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Recipe Ideas</Text>
            <Text style={styles.actionSub}>Simple recipes by goal, with hand-portion guidance</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.onSurfaceTertiary} />
        </Pressable>

        {/* Nutrition Garden */}
        <Text style={styles.sectionTitle}>Nutrition Garden</Text>
        <View style={styles.gardenCard}>
          {GARDEN_METERS.map((m) => {
            const value = (wellness.garden as any)[m.key] as number;
            return (
              <View key={m.key} style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name={m.icon as any} size={14} color={m.color} />
                  <Text style={styles.gardenLbl}>{m.label}</Text>
                  <Text style={styles.gardenVal}>{value}/100</Text>
                </View>
                <View style={styles.gardenBarTrack}>
                  <View style={[styles.gardenBarFill, { width: `${value}%`, backgroundColor: m.color }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Lessons */}
        <Text style={styles.sectionTitle}>Quick Lessons (Optional)</Text>
        {WELLNESS_LESSONS.map((lesson) => {
          const done = wellness.lessons_completed.includes(lesson.id);
          return (
            <Pressable key={lesson.id} style={styles.lessonCard} onPress={() => setLessonOpen(lesson.id)}>
              <Ionicons name={done ? "checkmark-circle" : "sparkles"} size={18} color={done ? COLORS.success : COLORS.brand} />
              <Text style={styles.lessonTitle}>{lesson.title}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.onSurfaceTertiary} />
            </Pressable>
          );
        })}
        {lessonMsg && <Text style={styles.lessonMsg}>{lessonMsg}</Text>}

        {/* Boutique placeholder */}
        <Text style={styles.sectionTitle}>Lotus Gem Boutique</Text>
        <View style={styles.boutiqueCard}>
          <Text style={styles.boutiqueLead}>
            Lotus Gems are a safe, capped currency — spendable only on purely cosmetic items. Coming soon:
          </Text>
          <View style={styles.boutiqueGrid}>
            {BOUTIQUE_ITEMS.map((item) => (
              <View key={item} style={styles.boutiqueChip}>
                <Ionicons name="lock-closed" size={11} color={COLORS.onSurfaceTertiary} />
                <Text style={styles.boutiqueChipTxt}>{item}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.boutiqueFoot}>
            Lotus Gems will never buy stamina refills, rare hero pulls, boss skips, XP boosts, or combat power.
          </Text>
        </View>

        {/* Learning credits placeholder */}
        <View style={styles.creditsCard}>
          <Ionicons name="school-outline" size={18} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.creditsTxt}>
            <Text style={{ fontWeight: "700" }}>Clinica Learning Credits</Text> — a future, separate track that may
            support premium education modules or professional learning pathways. Not implemented yet. Fully
            separate from gameplay power, Lotus Gems, and Nourishment Petals. No real-money, Google Play, or CME/CE
            redemption exists.
          </Text>
        </View>

        {/* Safety note */}
        <View style={styles.safetyCard}>
          <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.onSurfaceSecondary} />
          <Text style={styles.safetyTxt}>
            The Lotus Plate Journal offers general wellness education and game rewards — it is not medical advice
            and Clinica does not diagnose conditions or prescribe diets. You never need to enter exact calories,
            weight, or medical details here. If you have specific medical or dietary needs, please follow your
            clinician's guidance.
          </Text>
        </View>
      </ScrollView>

      <TutorialOverlay />

      <Modal visible={!!lessonOpen} transparent animationType="fade" onRequestClose={() => setLessonOpen(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {(() => {
              const lesson = WELLNESS_LESSONS.find((l) => l.id === lessonOpen);
              if (!lesson) return null;
              return (
                <>
                  <Text style={styles.modalTitle}>{lesson.title}</Text>
                  {lesson.body.map((line, i) => (
                    <Text key={i} style={styles.modalLine}>{line}</Text>
                  ))}
                  <Pressable style={styles.modalBtn} onPress={() => completeLesson(lesson.id)}>
                    <Text style={styles.modalBtnTxt}>Got it</Text>
                  </Pressable>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg, paddingBottom: SPACING.sm },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  kicker: { color: COLORS.growth, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300", marginTop: 2 },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  lead: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 22, marginBottom: SPACING.sm },
  currencyRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.sm },
  currencyPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.pill,
    paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  currencyVal: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700" },
  currencyLbl: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  actionCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  actionIcon: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  actionTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  actionSub: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  sectionTitle: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "700", letterSpacing: 1, marginTop: SPACING.sm },
  gardenCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
  },
  gardenLbl: { color: COLORS.onSurfaceSecondary, fontSize: 12, flex: 1 },
  gardenVal: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  gardenBarTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.surfaceTertiary, overflow: "hidden" },
  gardenBarFill: { height: "100%", borderRadius: 3 },
  lessonCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  lessonTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: "500", flex: 1 },
  lessonMsg: { color: COLORS.success, fontSize: 12, fontStyle: "italic" },
  boutiqueCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
  },
  boutiqueLead: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },
  boutiqueGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  boutiqueChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.pill,
    paddingVertical: 6, paddingHorizontal: 10,
  },
  boutiqueChipTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  boutiqueFoot: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontStyle: "italic", lineHeight: 16 },
  creditsCard: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, padding: SPACING.md,
  },
  creditsTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 17, flex: 1 },
  safetyCard: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  safetyTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18, flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  modalCard: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.sm, width: "100%", maxWidth: 420, borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: "600", marginBottom: 4 },
  modalLine: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20 },
  modalBtn: { marginTop: SPACING.sm, backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: "center" },
  modalBtnTxt: { color: COLORS.onBrand, fontWeight: "700" },
});
