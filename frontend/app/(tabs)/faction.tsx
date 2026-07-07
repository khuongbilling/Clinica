import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PlayerHeader } from "@/src/components/PlayerHeader";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const PREVIEW_ITEMS: { icon: string; title: string; desc: string }[] = [
  {
    icon: "list-outline",
    title: "Faction Missions",
    desc: "Group objectives that reward the whole faction — no solo grinding required.",
  },
  {
    icon: "planet-outline",
    title: "World Boss",
    desc: "Band together with other healer factions to bring down colossal corruption events too large for one team alone.",
  },
  {
    icon: "pulse-outline",
    title: "Epidemic Response",
    desc: "Time-limited outbreaks that call every faction to respond, with shared progress toward a cure.",
  },
  {
    icon: "medkit-outline",
    title: "Relief Campaigns",
    desc: "Contribute supplies and effort toward Kingdom-wide relief goals alongside your faction.",
  },
  {
    icon: "flask-outline",
    title: "Research Contribution",
    desc: "Pool Insight Crystals into faction research queues to unlock group-wide passive bonuses.",
  },
  {
    icon: "diamond-outline",
    title: "Alliance Rewards",
    desc: "Faction participation unlocks Faction Marks, banners, Realm decorations, and profile titles not available anywhere else.",
  },
];

export default function FactionScreen() {
  const { player } = usePlayer();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {player && <PlayerHeader player={player} />}
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <View style={styles.heroIcon}>
          <Ionicons name="flag" size={30} color={COLORS.brand} />
        </View>
        <Text style={styles.kicker}>COMING SOON</Text>
        <Text style={styles.title}>Faction Embassy</Text>
        <Text style={styles.sub}>
          A cooperative hub for allied healer factions — donate supplies, complete group
          missions, contribute to research, and prepare for future world events together.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>WHAT'S COMING</Text>
        {PREVIEW_ITEMS.map((item) => (
          <View key={item.title} style={styles.card} testID={`faction-preview-${item.title}`}>
            <View style={styles.cardIcon}>
              <Ionicons name={item.icon as any} size={20} color={COLORS.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}

        {/* ── Embassy deep-link ── */}
        <Pressable
          style={styles.deepLink}
          onPress={() => router.push("/embassy" as any)}
          testID="faction-open-embassy"
        >
          <Ionicons name="flag-outline" size={16} color={COLORS.brand} />
          <Text style={styles.deepLinkTxt}>Open full Faction Embassy preview →</Text>
        </Pressable>

        <View style={styles.footNote}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footNoteTxt}>
            None of these features are live yet. Factions, territory control, and guild chat are
            in design — this page will grow into a full hub as they ship. Everything is
            cooperative; there is no PvP, raids, or faction-vs-faction warfare in scope.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: 4, alignItems: "center" },
  heroIcon: {
    width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.brand + "18", borderWidth: 1.5, borderColor: COLORS.brand + "60",
    marginBottom: SPACING.xs,
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 26, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 13, marginTop: 2, textAlign: "center" },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  sectionLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  card: {
    flexDirection: "row", gap: SPACING.md, alignItems: "flex-start",
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.brand + "40",
  },
  cardTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  cardDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2, lineHeight: 16 },
  deepLink: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.brand + "55",
    padding: SPACING.md, justifyContent: "center",
  },
  deepLinkTxt: { color: COLORS.brand, fontSize: 13, fontWeight: "700" },
  footNote: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.sm },
  footNoteTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 15 },
});
