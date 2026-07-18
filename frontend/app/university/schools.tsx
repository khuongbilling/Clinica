import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CLASS_TRAINEE_BY_ROLE } from "@/src/game/university";
import { getSchoolBanner } from "@/src/game/illustratedAssets";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const SCHOOL_ROLES = Object.values(CLASS_TRAINEE_BY_ROLE);

// ── Role → banner + accent + subtitle ────────────────────────────────────────
const ROLE_META: Record<string, { bannerKey: string; accent: string; subtitle: string }> = {
  Assessor:    { bannerKey: 'assessment',     accent: '#8B5CF6', subtitle: 'Clinical observation, cue recognition, and triage priority.' },
  Stabilizer:  { bannerKey: 'stabilization',  accent: '#06B6D4', subtitle: 'Keeping patients steady — shields, support, and reassessment.' },
  Analyst:     { bannerKey: 'pharmacology',   accent: '#F59E0B', subtitle: 'Remedies, herbs, and the safe use of clinical treatments.' },
  Coordinator: { bannerKey: 'emergency',      accent: '#EF4444', subtitle: 'Fast, calm decision-making when seconds matter.' },
  Educator:    { bannerKey: 'mental_wellness', accent: '#A78BFA', subtitle: 'Stress, rest, mindset, and supportive care.' },
  Specialist:  { bannerKey: 'chronic_disease', accent: '#10B981', subtitle: 'Living and thriving with long-term conditions.' },
};

const FUTURE_FEATURES = [
  { icon: "book-outline",        label: "Role-specific Lotus Lessons" },
  { icon: "flask-outline",       label: "Clinical Simulation cases" },
  { icon: "ribbon-outline",      label: "Specialization Certifications" },
  { icon: "trending-up-outline", label: "Department XP tracks" },
];

// ── Illustrated school banner card (future placeholder) ───────────────────────
function SchoolBannerCard({ role, label }: { role: string; label: string }) {
  const meta   = ROLE_META[role] ?? { bannerKey: '', accent: COLORS.brand, subtitle: `Role-specific lessons for the ${role}.` };
  const accent = meta.accent;
  const banner = getSchoolBanner(meta.bannerKey);

  return (
    <View
      style={[sbStyles.card, { borderColor: accent + '30' }]}
      testID={`school-${role.toLowerCase()}`}
    >
      {/* Illustrated background */}
      {banner ? (
        <Image source={banner} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: accent + '18' }]} />
      )}
      <View style={sbStyles.scrimTop} />
      <View style={sbStyles.scrimBottom} />

      {/* Content */}
      <View style={sbStyles.content}>

        {/* Top: SCHOOL pill + FUTURE badge */}
        <View style={sbStyles.topRow}>
          <View style={[sbStyles.schoolPill, { backgroundColor: '#00000066', borderColor: accent + '80' }]}>
            <Text style={[sbStyles.schoolPillTxt, { color: accent }]}>SCHOOL</Text>
          </View>
          <View style={sbStyles.futureBadge}>
            <Ionicons name="time-outline" size={9} color="#ffffff88" />
            <Text style={sbStyles.futureBadgeTxt}>FUTURE CHAPTER</Text>
          </View>
        </View>

        {/* Bottom: name + subtitle + role chip */}
        <View style={sbStyles.bottomBlock}>
          <Text style={sbStyles.name} numberOfLines={1}>{role} School</Text>
          <Text style={sbStyles.subtitle} numberOfLines={2}>{meta.subtitle}</Text>
          <View style={sbStyles.chipRow}>
            <View style={[sbStyles.roleChip, { backgroundColor: accent + '22', borderColor: accent + '55' }]}>
              <Text style={[sbStyles.roleChipTxt, { color: accent }]}>{label}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const sbStyles = StyleSheet.create({
  card: {
    width: '100%', height: 148,
    borderRadius: RADIUS.md, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#FFFFFF15',
    backgroundColor: '#0B1825',
  },
  scrimTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: '55%', backgroundColor: 'rgba(10,20,30,0.30)',
  },
  scrimBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '58%', backgroundColor: 'rgba(8,16,26,0.84)',
  },
  content: { flex: 1, padding: SPACING.md, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  schoolPill: {
    borderRadius: RADIUS.pill, borderWidth: 1,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  schoolPillTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  futureBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: RADIUS.pill, borderWidth: 1,
    borderColor: '#ffffff22', backgroundColor: '#00000055',
    paddingHorizontal: 9, paddingVertical: 3,
  },
  futureBadgeTxt: { color: '#ffffff88', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  bottomBlock: { gap: 3 },
  name: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', lineHeight: 22 },
  subtitle: { color: 'rgba(255,255,255,0.68)', fontSize: 11, lineHeight: 16 },
  chipRow: { flexDirection: 'row', marginTop: 4 },
  roleChip: {
    borderRadius: RADIUS.pill, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  roleChipTxt: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function DepartmentSchoolsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero}>
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} testID="schools-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>CLINICA UNIVERSITY</Text>
        <Text style={styles.title}>Department Schools</Text>
        <Text style={styles.sub}>
          Each role unlocks its own learning path — lessons, simulations, and specialization milestones in a future chapter.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Preview notice */}
        <View style={styles.previewBanner}>
          <Ionicons name="time-outline" size={16} color={COLORS.brand} />
          <Text style={styles.previewTxt}>
            Department Schools are in development. Each school below will receive its own full learning path in a future chapter.
          </Text>
        </View>

        {/* V8: Illustrated school banner cards */}
        {SCHOOL_ROLES.map((t) => (
          <SchoolBannerCard key={t.id} role={t.role} label={t.label} />
        ))}

        {/* What's coming */}
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
  sectionLbl: {
    color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "800",
    letterSpacing: 1.5, marginTop: SPACING.sm,
  },
  featuresCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm,
  },
  featureRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  featureIcon: {
    width: 34, height: 34, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.brand + "20",
  },
  featureTxt: { color: COLORS.onSurface, fontSize: 13 },
  returnBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: 13,
    marginTop: SPACING.sm,
  },
  returnBtnTxt: { color: COLORS.onBrand, fontSize: 14, fontWeight: "700" },
  footNote: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    marginTop: SPACING.xs ?? 4,
  },
  footNoteTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 16 },
});
