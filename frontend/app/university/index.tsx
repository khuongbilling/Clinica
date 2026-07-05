import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { ModeCard } from "@/src/components/ModeCard";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { RewardPreview } from "@/src/components/RewardPreview";
import { UNIVERSITY_FUTURE_MODES } from "@/src/game/modeHub";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const MENU: { id: string; title: string; desc: string; icon: string; route?: string }[] = [
  {
    id: "recruit",
    title: "University Recruitment",
    desc: "Enroll new healers, earn Hero Shards, Class Trainees, and University Credits.",
    icon: "sparkles",
    route: "/university/recruit",
  },
  {
    id: "certification",
    title: "Hero Certification",
    desc: "Raise a hero's Certification Star in the Hall of Heroes.",
    icon: "ribbon",
    route: "/(tabs)/heroes",
  },
  {
    id: "training",
    title: "Training Hall",
    desc: "Level up your heroes toward their Certification Star's level cap.",
    icon: "trending-up",
    route: "/university/training",
  },
  {
    id: "schools",
    title: "Department Schools",
    desc: "Specialized schools for each role. More opening soon.",
    icon: "business",
    route: "/university/schools",
  },
  {
    id: "lessons",
    title: "Lessons & Simulations",
    desc: "Quick lessons, quizzes, and simulation cases that translate real health concepts into battle skills.",
    icon: "book",
    route: "/university/lessons",
  },
  {
    id: "library",
    title: "Research Library",
    desc: "Browse the Great Codex — unlocked clinical knowledge, battle mechanics, and enemy field notes.",
    icon: "library",
    route: "/(tabs)/codex",
  },
  {
    id: "class-tree",
    title: "Class Tree",
    desc: "Pick a Player Class and unlock its ability tree as you level up.",
    icon: "git-network",
    route: "/class-tree",
  },
];

export default function UniversityHubScreen() {
  const router = useRouter();
  const { player } = usePlayer();

  if (!player) return null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PlayerHeader player={player} />
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/(tabs)")} testID="university-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>CLINICA UNIVERSITY</Text>
        <Text style={styles.title}>Hero Progression Campus</Text>
        <Text style={styles.sub}>Recruit, certify, and train the healers who defend the Kingdom.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <Stat label="Codex Shards" value={String(player.codex_shards || 0)} icon="diamond" />
          <Stat label="University Credits" value={String(player.university_credits || 0)} icon="school" />
        </View>

        <RewardPreview mode="Clinica University" />

        {MENU.map((m) => (
          <Pressable
            key={m.id}
            style={styles.card}
            onPress={() => m.route && router.push(m.route as any)}
            testID={`university-menu-${m.id}`}
          >
            <View style={styles.cardIcon}>
              <Ionicons name={m.icon as any} size={22} color={COLORS.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{m.title}</Text>
              <Text style={styles.cardDesc}>{m.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.onSurfaceTertiary} />
          </Pressable>
        ))}

        <Text style={styles.sectionHeading}>Future Learning</Text>
        <View style={{ gap: SPACING.sm }}>
          {UNIVERSITY_FUTURE_MODES.map((m) => (
            <ModeCard
              key={m.id}
              mode={m}
              testID={`university-future-${m.id}`}
              onPress={() =>
                Alert.alert(
                  `${m.title} — Coming Soon`,
                  m.subtitle + "\n\nThis feature is still in development.",
                )
              }
            />
          ))}
        </View>

        <View style={styles.footNote}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footNoteTxt}>
            Clinica University is a game progression system only. It does not offer CME/CE credit
            or real-world continuing education certification.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon as any} size={16} color={COLORS.brand} />
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
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
  title: { color: COLORS.onSurface, fontSize: 26, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  statsRow: { flexDirection: "row", gap: SPACING.md },
  stat: {
    flex: 1, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: "center", gap: 4, borderWidth: 1, borderColor: COLORS.border,
  },
  statVal: { color: COLORS.onSurface, fontSize: 18, fontWeight: "300" },
  statLbl: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 0.5, textAlign: "center" },
  card: {
    flexDirection: "row", gap: SPACING.md, alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.brand + "40",
  },
  cardTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "600" },
  cardDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  footNote: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.sm },
  footNoteTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 15 },
  sectionHeading: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginTop: SPACING.md },
});
