import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ────────────────────────────────────────────────────────────────────────────
// B9 Trust Cleanup — Sanctuary Bazaar is a Future Chapter preview only.
// This screen shows what the Bazaar will eventually offer, with no live
// trading, listings, purchases, auctions, or player-to-player transactions.
// ────────────────────────────────────────────────────────────────────────────

const BAZAAR_PILLARS = [
  { icon: "swap-horizontal-outline", label: "Player-to-player item exchange", color: "#A78BFA" },
  { icon: "pricetag-outline", label: "List and discover rare drops", color: "#22D3EE" },
  { icon: "shield-checkmark-outline", label: "Scam-free with built-in safeguards", color: "#34D399" },
  { icon: "leaf-outline", label: "Cosmetic-only crown transactions", color: COLORS.growth },
];

const BAZAAR_TEASER = [
  "Trade cosmetic drops, material bundles, and Ward tokens with other players",
  "Browse listings at your own pace — no live auction pressure",
  "Safety guardrails built in from the start",
  "No pay-to-win items will ever appear in the Bazaar",
];

export default function BazaarScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/(tabs)/kingdom")} hitSlop={10} testID="bazaar-back">
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>SANCTUARY COMMERCE</Text>
          <Text style={styles.title}>Sanctuary Bazaar</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Prominent preview banner */}
        <View style={styles.previewBanner}>
          <Ionicons name="time-outline" size={20} color={COLORS.storm} />
          <View style={{ flex: 1 }}>
            <Text style={styles.previewTitle}>Preview Only</Text>
            <Text style={styles.previewBody}>
              This feature will open in a future chapter. No live trading, listings, purchases, or player-to-player transactions exist yet.
            </Text>
          </View>
        </View>

        {/* Hero card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>COMING IN A FUTURE CHAPTER</Text>
          <Text style={styles.heroTitle}>The Sanctuary Bazaar</Text>
          <Text style={styles.heroBody}>
            A player-driven marketplace where healers can trade cosmetic items, material bundles, and ward tokens with each other — built from the ground up with fairness and safety in mind.
          </Text>
        </View>

        {/* Pillars */}
        <Text style={styles.sectionLbl}>WHAT THE BAZAAR WILL OFFER</Text>
        <View style={styles.pillarGrid}>
          {BAZAAR_PILLARS.map((p) => (
            <View key={p.label} style={[styles.pillar, { borderColor: p.color + "44" }]}>
              <View style={[styles.pillarIcon, { backgroundColor: p.color + "22" }]}>
                <Ionicons name={p.icon as any} size={18} color={p.color} />
              </View>
              <Text style={styles.pillarTxt}>{p.label}</Text>
            </View>
          ))}
        </View>

        {/* Teaser bullets */}
        <Text style={styles.sectionLbl}>PLANNED FEATURES</Text>
        <View style={styles.teaserCard}>
          {BAZAAR_TEASER.map((item, i) => (
            <View key={i} style={styles.teaserRow}>
              <Ionicons name="ellipse" size={6} color={COLORS.brand} />
              <Text style={styles.teaserTxt}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Return button */}
        <Pressable style={styles.returnBtn} onPress={() => goBack(router, "/(tabs)/kingdom")} testID="bazaar-return">
          <Ionicons name="home-outline" size={18} color={COLORS.onBrand} />
          <Text style={styles.returnBtnTxt}>Return to Kingdom</Text>
        </Pressable>

        <View style={styles.footNote}>
          <Ionicons name="information-circle-outline" size={13} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footNoteTxt}>
            All features shown are planning previews and may change before the Bazaar ever opens.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg, paddingBottom: SPACING.sm },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  kicker: { color: COLORS.storm, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300", marginTop: 2 },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  previewBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.md,
    backgroundColor: COLORS.storm + "15", borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: COLORS.storm + "50",
    padding: SPACING.md,
  },
  previewTitle: { color: COLORS.storm, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  previewBody: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },
  heroCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, gap: 6,
  },
  heroKicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  heroTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: "700" },
  heroBody: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20, marginTop: 2 },
  sectionLbl: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  pillarGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  pillar: {
    flexBasis: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, padding: SPACING.sm,
  },
  pillarIcon: { width: 34, height: 34, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  pillarTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, flex: 1, lineHeight: 16 },
  teaserCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm,
  },
  teaserRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 2 },
  teaserTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19, flex: 1 },
  returnBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: 14,
    marginTop: SPACING.sm,
  },
  returnBtnTxt: { color: COLORS.onBrand, fontSize: 15, fontWeight: "700" },
  footNote: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start" },
  footNoteTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 16, fontStyle: "italic" },
});
