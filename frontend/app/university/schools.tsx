import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CLASS_TRAINEE_BY_ROLE } from "@/src/game/university";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const SCHOOL_ROLES = Object.values(CLASS_TRAINEE_BY_ROLE);

const FUTURE_FEATURES = [
  { icon: "book-outline", label: "Role-specific Lotus Lessons" },
  { icon: "flask-outline", label: "Clinical Simulation cases" },
  { icon: "ribbon-outline", label: "Specialization Certifications" },
  { icon: "trending-up-outline", label: "Department XP tracks" },
];

export default function DepartmentSchoolsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} testID="schools-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>FUTURE SPECIALIZATIONS</Text>
        <Text style={styles.title}>Department Schools</Text>
        <Text style={styles.sub}>
          Each department will eventually offer its own learning path — role-specific lessons, simulations, and specialization milestones.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Preview notice */}
        <View style={styles.previewBanner}>
          <Ionicons name="time-outline" size={16} color={COLORS.brand} />
          <Text style={styles.previewTxt}>
            Department Schools are in development. The roles below will each receive their own learning path in a future chapter.
          </Text>
        </View>

        {/* Department cards */}
        {SCHOOL_ROLES.map((t) => {
          const accent = ELEMENT_COLORS[t.role] ?? COLORS.brand;
          return (
            <View key={t.id} style={[styles.card, { borderLeftColor: accent }]} testID={`school-${t.id}`}>
              <View style={styles.cardHeader}>
                <View style={[styles.dot, { backgroundColor: accent }]} />
                <Text style={styles.cardName}>{t.role} School</Text>
                <View style={styles.soonBadge}>
                  <Text style={styles.soonTxt}>FUTURE CHAPTER</Text>
                </View>
              </View>
              <Text style={styles.cardDesc}>Will train {t.label}s with role-specific cases and simulations.</Text>
            </View>
          );
        })}

        {/* What's coming section */}
        <Text style={styles.sectionLbl}>WHAT EACH SCHOOL WILL INCLUDE</Text>
        <View style={styles.featuresCard}>
          {FUTURE_FEATURES.map((f) => (
            <View key={f.label} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon as any} size={16} color={COLORS.brand} />
              </View>
              <Text style={styles.featureTxt}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* Return button */}
        <Pressable style={styles.returnBtn} onPress={() => goBack(router, "/university")} testID="schools-return">
          <Ionicons name="arrow-back" size={16} color={COLORS.onBrand} />
          <Text style={styles.returnBtnTxt}>Return to University</Text>
        </Pressable>

        <View style={styles.footNote}>
          <Ionicons name="information-circle-outline" size={13} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footNoteTxt}>
            Clinica University is a game progression system only. It does not offer CME/CE credit or real-world continuing education certification.
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
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 12, marginTop: 2, lineHeight: 18 },
  scroll: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.xxxl },
  previewBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    backgroundColor: COLORS.brand + "15", borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.brand + "44", padding: SPACING.md,
    marginBottom: SPACING.xs ?? 4,
  },
  previewTxt: { flex: 1, color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },
  card: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderLeftWidth: 3,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: 6,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600", flex: 1 },
  cardDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 16 },
  soonBadge: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  soonTxt: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  sectionLbl: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginTop: SPACING.sm },
  featuresCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm,
  },
  featureRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  featureIcon: { width: 34, height: 34, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.brand + "20" },
  featureTxt: { color: COLORS.onSurface, fontSize: 13 },
  returnBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: 13,
    marginTop: SPACING.sm,
  },
  returnBtnTxt: { color: COLORS.onBrand, fontSize: 14, fontWeight: "700" },
  footNote: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.xs ?? 4 },
  footNoteTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 16 },
});
