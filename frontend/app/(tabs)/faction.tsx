import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PlayerHeader } from "@/src/components/PlayerHeader";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const PREVIEW_ITEMS: { icon: string; title: string; desc: string }[] = [
  {
    icon: "planet-outline",
    title: "World Bosses",
    desc: "Band together with other healer factions to bring down colossal corruption events too large for one team alone.",
  },
  {
    icon: "pulse-outline",
    title: "Epidemic Events",
    desc: "Time-limited outbreaks that call every faction to respond, with shared progress toward a cure.",
  },
  {
    icon: "shield-outline",
    title: "Territory Support",
    desc: "Back your faction's standing in the Kingdom by contributing to collaborative defense goals.",
  },
  {
    icon: "people-circle-outline",
    title: "Collaborative Goals",
    desc: "Group objectives that reward the whole faction — no solo grinding required.",
  },
  {
    icon: "diamond-outline",
    title: "Rare Material Rewards",
    desc: "Faction participation will unlock crafting materials not available anywhere else.",
  },
];

export default function FactionScreen() {
  const { player } = usePlayer();
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
          A future home for allied healer factions, shared world events, and collaborative rewards.
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

        <View style={styles.footNote}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footNoteTxt}>
            None of these features are live yet. Factions, trading, and territory control are in
            design — this page will grow into a full hub as they ship.
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
  footNote: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginTop: SPACING.sm },
  footNoteTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 15 },
});
