import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { FIRST_WEEK_PATH, getJourneyProgress, JourneyDay, JourneyStep } from "@/src/game/firstWeekPath";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { goBack } from "@/src/utils/navigation";

function StepRow({ step, done, active }: { step: JourneyStep; done: boolean; active: boolean }) {
  const router = useRouter();
  return (
    <Pressable
      style={[styles.stepRow, done && styles.stepDone]}
      onPress={() => step.route ? router.push(step.route as any) : undefined}
      disabled={!step.route || done}
    >
      <View style={[styles.stepIcon, done && styles.stepIconDone, active && !done && styles.stepIconActive]}>
        <Ionicons
          name={(done ? "checkmark" : step.icon) as any}
          size={14}
          color={done ? COLORS.success : active ? COLORS.brand : COLORS.onSurfaceTertiary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{step.label}</Text>
        <Text style={styles.stepDesc}>{step.description}</Text>
      </View>
      {step.route && !done && (
        <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
      )}
      {done && (
        <View style={styles.donePill}>
          <Text style={styles.donePillTxt}>DONE</Text>
        </View>
      )}
    </Pressable>
  );
}

function DayCard({ day, playerData, isCompleted, isCurrentDay }: {
  day: JourneyDay;
  playerData: any;
  isCompleted: boolean;
  isCurrentDay: boolean;
}) {
  const allSteps = day.steps.length;
  const doneSteps = day.steps.filter((s) => s.checkDone(playerData)).length;

  return (
    <View style={[
      styles.dayCard,
      isCompleted && styles.dayCardDone,
      isCurrentDay && styles.dayCardActive,
    ]}>
      <View style={styles.dayHeader}>
        <View style={[styles.dayBadge, isCompleted && styles.dayBadgeDone, isCurrentDay && styles.dayBadgeActive]}>
          {isCompleted
            ? <Ionicons name="checkmark" size={14} color={COLORS.success} />
            : <Text style={[styles.dayNum, isCurrentDay && styles.dayNumActive]}>Day {day.day}</Text>
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.dayTitle, isCompleted && styles.dayTitleDone]}>{day.title}</Text>
          <Text style={styles.dayTheme}>{day.theme}</Text>
        </View>
        <Text style={[styles.dayProgress, isCompleted && { color: COLORS.success }]}>
          {doneSteps}/{allSteps}
        </Text>
      </View>

      {(isCurrentDay || isCompleted) && (
        <View style={styles.stepList}>
          {day.steps.map((step, i) => (
            <StepRow
              key={step.id}
              step={step}
              done={step.checkDone(playerData)}
              active={isCurrentDay && i === day.steps.findIndex((s) => !s.checkDone(playerData))}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export default function AcademyPathScreen() {
  const router = useRouter();
  const { player } = usePlayer();

  const progress = getJourneyProgress(player);

  const progressPct = progress.totalDays > 0
    ? Math.round((progress.completedDays / progress.totalDays) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Hero header */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[COLORS.brandTertiary, COLORS.surface]}
          style={StyleSheet.absoluteFillObject}
        />
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/university")}
          testID="academy-path-back"
        >
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>CLINICA UNIVERSITY</Text>
        <Text style={styles.title}>Academy Orientation Path</Text>
        <Text style={styles.sub}>
          Your first-week journey. Guidance, not gates — progress at your own pace.
        </Text>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
        </View>
        <Text style={styles.progressTxt}>
          {progress.completedDays} of {progress.totalDays} days complete
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Next step banner */}
        {progress.nextStep && (
          <Pressable
            style={styles.nextStepBanner}
            onPress={() => progress.nextStep?.route ? router.push(progress.nextStep.route as any) : undefined}
            disabled={!progress.nextStep?.route}
            testID="academy-next-step"
          >
            <View style={styles.nextStepIcon}>
              <Ionicons name="arrow-forward-circle" size={22} color={COLORS.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextStepLabel}>Next Recommended Step</Text>
              <Text style={styles.nextStepTitle}>{progress.nextStep.label}</Text>
              <Text style={styles.nextStepDesc}>{progress.nextStep.description}</Text>
            </View>
            {progress.nextStep.route && (
              <Ionicons name="chevron-forward" size={16} color={COLORS.brand} />
            )}
          </Pressable>
        )}

        {progress.completedDays >= progress.totalDays && (
          <View style={styles.allDoneBanner}>
            <Ionicons name="trophy" size={22} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.allDoneTitle}>First Week Complete!</Text>
              <Text style={styles.allDoneDesc}>
                You've completed your academy orientation. Keep learning, healing, and growing.
              </Text>
            </View>
          </View>
        )}

        {/* Day cards */}
        {FIRST_WEEK_PATH.map((day, i) => (
          <DayCard
            key={day.day}
            day={day}
            playerData={player}
            isCompleted={i < progress.completedDays}
            isCurrentDay={i === progress.nextDayIndex && i >= progress.completedDays}
          />
        ))}

        {/* Footer note */}
        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footerTxt}>
            These are milestones, not hard gates. You can explore any mode at any time — this path simply highlights what's most rewarding to try first.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: 4 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)", marginBottom: SPACING.sm,
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 12, marginTop: 2, lineHeight: 17 },
  progressBar: {
    height: 5, backgroundColor: COLORS.surfaceTertiary, borderRadius: 3, overflow: "hidden", marginTop: SPACING.md,
  },
  progressFill: { height: "100%", backgroundColor: COLORS.brand, borderRadius: 3 },
  progressTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 4 },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },

  nextStepBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.brand + "18",
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.brand + "40",
  },
  nextStepIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.brand + "25",
    alignItems: "center", justifyContent: "center",
  },
  nextStepLabel: { color: COLORS.brand, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  nextStepTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700", marginTop: 2 },
  nextStepDesc: { color: COLORS.onSurfaceSecondary, fontSize: 11, marginTop: 2 },

  allDoneBanner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: "#F59E0B18",
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: "#F59E0B40",
  },
  allDoneTitle: { color: "#F59E0B", fontSize: 14, fontWeight: "700" },
  allDoneDesc: { color: COLORS.onSurfaceSecondary, fontSize: 11, marginTop: 2, lineHeight: 16 },

  dayCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
  },
  dayCardDone: { borderColor: COLORS.success + "40" },
  dayCardActive: { borderColor: COLORS.brand + "60" },
  dayHeader: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.md,
  },
  dayBadge: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.border,
  },
  dayBadgeDone: { backgroundColor: COLORS.success + "25", borderColor: COLORS.success + "50" },
  dayBadgeActive: { backgroundColor: COLORS.brand + "25", borderColor: COLORS.brand + "50" },
  dayNum: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "800" },
  dayNumActive: { color: COLORS.brand },
  dayTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700" },
  dayTitleDone: { color: COLORS.onSurfaceSecondary },
  dayTheme: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2, lineHeight: 15 },
  dayProgress: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "700" },

  stepList: {
    borderTopWidth: 1, borderColor: COLORS.border,
    gap: 1,
  },
  stepRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    padding: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.surface,
  },
  stepDone: { opacity: 0.65 },
  stepIcon: {
    width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.border,
  },
  stepIconDone: { backgroundColor: COLORS.success + "20", borderColor: COLORS.success + "50" },
  stepIconActive: { backgroundColor: COLORS.brand + "20", borderColor: COLORS.brand + "50" },
  stepLabel: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  stepLabelDone: { color: COLORS.onSurfaceSecondary, textDecorationLine: "line-through" },
  stepDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 1, lineHeight: 15 },
  donePill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: COLORS.success + "20",
  },
  donePillTxt: { color: COLORS.success, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  footer: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, backgroundColor: COLORS.surfaceSecondary,
    marginTop: SPACING.sm,
  },
  footerTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 15 },
});
