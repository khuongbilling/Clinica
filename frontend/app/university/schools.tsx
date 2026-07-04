import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CLASS_TRAINEE_BY_ROLE } from "@/src/game/university";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const SCHOOL_ROLES = Object.values(CLASS_TRAINEE_BY_ROLE);

export default function DepartmentSchoolsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} testID="schools-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>DEPARTMENT SCHOOLS</Text>
        <Text style={styles.title}>Specialized Training</Text>
        <Text style={styles.sub}>Each department school will offer role-specific lessons and simulations.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {SCHOOL_ROLES.map((t) => {
          const accent = ELEMENT_COLORS[t.role] ?? COLORS.brand;
          return (
            <View key={t.id} style={[styles.card, { borderLeftColor: accent }]} testID={`school-${t.id}`}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{t.role} School</Text>
                <View style={styles.soonBadge}>
                  <Text style={styles.soonTxt}>COMING SOON</Text>
                </View>
              </View>
              <Text style={styles.cardDesc}>Trains {t.label}s. Lessons and Simulations for the {t.role} role.</Text>
            </View>
          );
        })}

        <View style={styles.comingCard}>
          <Ionicons name="book-outline" size={22} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.comingTitle}>Lessons & Simulations</Text>
          <Text style={styles.comingDesc}>
            Interactive case-based lessons and clinical simulations are in development. Check back soon for
            new ways to earn Class Trainees and University Credits.
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
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  card: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderLeftWidth: 3,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: 6,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardName: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  cardDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  soonBadge: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  soonTxt: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  comingCard: {
    alignItems: "center", gap: 6, borderWidth: 1, borderStyle: "dashed", borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.lg, marginTop: SPACING.sm,
  },
  comingTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  comingDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, textAlign: "center", lineHeight: 16 },
});
