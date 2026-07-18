import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getDepartment, lessonsForDepartment, simulationsForDepartment, getBadge } from "@/src/game/lessons";
import { getLessonBanner, getSchoolBanner } from "@/src/game/illustratedAssets";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";

// ── Department accent colours (mirrors lessons.tsx DEPT_ACCENT) ───────────────
const DEPT_ACCENT: Record<string, string> = {
  assessment:         "#8B5CF6",
  airway:             "#7DD3FC",
  nutrition:          "#34D399",
  stabilization:      "#06B6D4",
  pharmacology:       "#F59E0B",
  emergency:          "#EF4444",
  mental_wellness:    "#A78BFA",
  chronic_disease:    "#10B981",
  professional_track: "#94A3B8",
};

// ── Illustrated banner card for each lesson/sim ───────────────────────────────

interface EntryCardProps {
  title:    string;
  subtitle: string | null;
  type:     "LESSON" | "SIM";
  done:     boolean;
  accent:   string;
  banner:   number | undefined;
  onPress:  () => void;
  testID?:  string;
}

function EntryCard({ title, subtitle, type, done, accent, banner, onPress, testID }: EntryCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress} testID={testID}>
      {/* Illustrated background */}
      {banner ? (
        <Image source={banner} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: accent + "28" }]} />
      )}

      {/* Dark bottom scrim for readability */}
      <View style={styles.cardScrim} />

      {/* Left accent bar */}
      <View style={[styles.cardBar, { backgroundColor: accent }]} />

      {/* Content */}
      <View style={styles.cardContent}>
        {/* Top row: type pill + status */}
        <View style={styles.cardTopRow}>
          <View style={[styles.typePill, { backgroundColor: accent + "22", borderColor: accent + "60" }]}>
            <Text style={[styles.typePillTxt, { color: accent }]}>{type}</Text>
          </View>
          {done && (
            <View style={styles.clearedBadge}>
              <Text style={styles.clearedTxt}>✦ CLEARED</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>

        {/* Badge / subtitle */}
        {subtitle && (
          <Text style={styles.cardSub} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>

      {/* CTA arrow */}
      <View style={[styles.cardArrow, { backgroundColor: done ? "#34D399" + "22" : accent + "22" }]}>
        <Ionicons
          name={done ? "refresh-outline" : "chevron-forward"}
          size={16}
          color={done ? "#34D399" : accent}
        />
      </View>
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DepartmentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { player } = usePlayer();
  const dept = getDepartment(String(id));

  if (!player || !dept) return null;

  const accent    = DEPT_ACCENT[dept.id] ?? "#8B5CF6";
  const deptBanner = getSchoolBanner(dept.id);

  const lessons         = lessonsForDepartment(dept.id);
  const sims            = simulationsForDepartment(dept.id);
  const completedLessons = player.lessons_completed    ?? [];
  const completedSims    = player.simulations_completed ?? [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>

      {/* ── Illustrated hero header ─────────────────────────────────────────── */}
      <View style={styles.hero}>
        {deptBanner ? (
          <Image source={deptBanner} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: accent + "20" }]} />
        )}
        {/* Dark scrim */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(8,12,20,0.70)" }]} />

        {/* Accent tint stripe at top */}
        <View style={[styles.heroTint, { backgroundColor: accent + "30" }]} />

        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/university")}
          testID="department-back"
        >
          <Ionicons name="chevron-back" size={18} color={UI.text} />
        </Pressable>
        <Text style={[styles.kicker, { color: accent }]}>DEPARTMENT</Text>
        <Text style={styles.heroTitle}>{dept.name}</Text>
        <Text style={styles.heroSub}>{dept.description}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Gameplay connections ──────────────────────────────────────────── */}
        <View style={[styles.assocBox, { borderColor: accent + "40" }]}>
          <Text style={styles.assocTitle}>Connects to gameplay</Text>
          <View style={styles.assocRow}>
            {dept.associated.map((a) => (
              <View key={a} style={[styles.assocChip, { backgroundColor: accent + "18", borderColor: accent + "40" }]}>
                <Text style={[styles.assocChipTxt, { color: accent }]}>{a}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Lessons ──────────────────────────────────────────────────────── */}
        {lessons.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>Lessons</Text>
              <Text style={styles.sectionCount}>
                {completedLessons.filter(id => lessons.some(l => l.id === id)).length}/{lessons.length} cleared
              </Text>
            </View>
            {lessons.map((l) => {
              const done   = completedLessons.includes(l.id);
              const badge  = getBadge(l.badgeId);
              const banner = getLessonBanner(l.id) ?? getLessonBanner(l.title) ?? deptBanner;
              return (
                <EntryCard
                  key={l.id}
                  title={l.title}
                  subtitle={badge ? `Badge: ${badge.name}` : null}
                  type="LESSON"
                  done={done}
                  accent={accent}
                  banner={banner}
                  onPress={() => router.push(`/university/lesson/${l.id}` as any)}
                  testID={`department-lesson-${l.id}`}
                />
              );
            })}
          </>
        )}

        {/* ── Simulations ──────────────────────────────────────────────────── */}
        {sims.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>Simulations</Text>
              <Text style={styles.sectionCount}>
                {completedSims.filter(id => sims.some(s => s.id === id)).length}/{sims.length} cleared
              </Text>
            </View>
            {sims.map((s) => {
              const done   = completedSims.includes(s.id);
              const banner = deptBanner;
              return (
                <EntryCard
                  key={s.id}
                  title={s.title}
                  subtitle="Simulation case"
                  type="SIM"
                  done={done}
                  accent={accent}
                  banner={banner}
                  onPress={() => router.push(`/university/simulation/${s.id}` as any)}
                  testID={`department-sim-${s.id}`}
                />
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.bgDeep },

  // Hero header
  hero: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    gap: 6,
    overflow: "hidden",
    minHeight: 160,
    justifyContent: "flex-end",
  },
  heroTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    marginBottom: SPACING.sm,
    alignSelf: "flex-start",
  },
  kicker:    { fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  heroTitle: { color: UI.text, fontSize: 24, fontWeight: "700", lineHeight: 30 },
  heroSub:   { color: UI.textSoft, fontSize: 13, lineHeight: 19, marginTop: 2 },

  // Scroll content
  scroll: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxxl },

  // Association box
  assocBox: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 8,
  },
  assocTitle:   { color: UI.text, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  assocRow:     { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  assocChip:    { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  assocChipTxt: { fontSize: 11, fontWeight: "600" },

  // Section headers
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  section:      { color: UI.text, fontSize: 15, fontWeight: "700" },
  sectionCount: { color: UI.textDim, fontSize: 11 },

  // Entry card (banner style)
  card: {
    height: 108,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,12,20,0.62)",
  },
  cardBar: {
    width: 3,
    alignSelf: "stretch",
    flexShrink: 0,
    opacity: 0.85,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: 4,
    justifyContent: "center",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  typePill: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typePillTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.0,
  },
  clearedBadge: {
    backgroundColor: "#34D399" + "22",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  clearedTxt: {
    color: "#34D399",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  cardTitle: {
    color: UI.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  cardSub: {
    color: UI.textDim,
    fontSize: 11,
  },
  cardArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
    flexShrink: 0,
  },
});
