import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getDepartment, lessonsForDepartment, simulationsForDepartment, getBadge } from "@/src/game/lessons";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function DepartmentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { player } = usePlayer();
  const dept = getDepartment(String(id));

  if (!player || !dept) return null;

  const lessons = lessonsForDepartment(dept.id);
  const sims = simulationsForDepartment(dept.id);
  const completedLessons = player.lessons_completed || [];
  const completedSims = player.simulations_completed || [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero}>
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} testID="department-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>DEPARTMENT</Text>
        <Text style={styles.title}>{dept.name}</Text>
        <Text style={styles.sub}>{dept.description}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.assocBox}>
          <Text style={styles.assocTitle}>Connects to gameplay</Text>
          <View style={styles.assocRow}>
            {dept.associated.map((a) => (
              <View key={a} style={styles.assocChip}>
                <Text style={styles.assocChipTxt}>{a}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.section}>Lessons</Text>
        {lessons.map((l) => {
          const done = completedLessons.includes(l.id);
          const badge = getBadge(l.badgeId);
          return (
            <Pressable
              key={l.id}
              style={styles.card}
              onPress={() => router.push(`/university/lesson/${l.id}` as any)}
              testID={`department-lesson-${l.id}`}
            >
              <Ionicons name={done ? "checkmark-circle" : "book-outline"} size={20} color={done ? COLORS.brand : COLORS.onSurfaceTertiary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{l.title}</Text>
                {badge && <Text style={styles.cardMeta}>Badge: {badge.name}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.onSurfaceTertiary} />
            </Pressable>
          );
        })}

        {sims.length > 0 && (
          <>
            <Text style={styles.section}>Simulations</Text>
            {sims.map((s) => {
              const done = completedSims.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  style={styles.card}
                  onPress={() => router.push(`/university/simulation/${s.id}` as any)}
                  testID={`department-sim-${s.id}`}
                >
                  <Ionicons name={done ? "checkmark-circle" : "flask-outline"} size={20} color={done ? COLORS.brand : COLORS.onSurfaceTertiary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{s.title}</Text>
                    <Text style={styles.cardMeta}>Simulation case</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.onSurfaceTertiary} />
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: {
    padding: SPACING.lg, paddingTop: SPACING.xl, gap: 4,
    backgroundColor: COLORS.brandTertiary + "28",
    borderBottomWidth: 1, borderBottomColor: COLORS.brandTertiary + "40",
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)", marginBottom: SPACING.sm,
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 22, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  assocBox: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, backgroundColor: COLORS.surfaceSecondary, gap: 6,
  },
  assocTitle: { color: COLORS.onSurface, fontSize: 11, fontWeight: "700" },
  assocRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  assocChip: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  assocChipTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "600" },
  section: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700", marginTop: SPACING.sm },
  card: {
    flexDirection: "row", gap: SPACING.md, alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  cardTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: "600" },
  cardMeta: { color: COLORS.onSurfaceTertiary, fontSize: 10, marginTop: 2 },
});
