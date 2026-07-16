import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PlayerHeader } from "@/src/components/PlayerHeader";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// Faction Embassy — Future Chapter gate screen.
// The tab is permanently hidden from the bottom nav (href:null in _layout.tsx)
// but the route stays alive so deep links and Realm building taps don't crash.
// No live faction systems, currencies, or joining flows exist in this push.

const STATUS_COLOR = "#A78BFA";

const PREVIEW_BULLETS = [
  { icon: "people-outline", text: "Form or join a Healer Faction with allied players" },
  { icon: "planet-outline", text: "Cooperate on world boss battles and epidemic responses" },
  { icon: "ribbon-outline", text: "Earn faction-exclusive cosmetics and profile titles" },
];

export default function FactionScreen() {
  const { player } = usePlayer();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="faction-screen">
      {player && <PlayerHeader player={player} />}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Sealed gate header */}
        <View style={styles.lockHeader} testID="faction-lock-header">
          <View style={styles.lockBadge}>
            <Ionicons name="flag" size={28} color={STATUS_COLOR} />
          </View>
          <Text style={styles.kicker}>FUTURE CHAPTER</Text>
          <Text style={styles.title}>Faction Embassy</Text>
          <Text style={styles.flavor}>
            The banners remain sealed. Alliances will matter when the ward expands beyond the first sanctuary.
          </Text>
        </View>

        {/* Minimal preview — three bullets, not a marketing wall */}
        <View style={styles.previewCard} testID="faction-preview-card">
          <Text style={styles.previewKicker}>WHAT'S COMING</Text>
          {PREVIEW_BULLETS.map((b, i) => (
            <View key={i} style={styles.bulletRow}>
              <Ionicons name={b.icon as any} size={15} color={STATUS_COLOR} />
              <Text style={styles.bulletTxt}>{b.text}</Text>
            </View>
          ))}
        </View>

        {/* Primary CTA */}
        <Pressable
          style={styles.returnBtn}
          onPress={() => router.replace("/(tabs)")}
          testID="faction-return-hub"
        >
          <Ionicons name="home-outline" size={17} color={COLORS.onBrand} />
          <Text style={styles.returnBtnTxt}>Return to Hub</Text>
        </Pressable>

        {/* Secondary: quieter embassy deep-link */}
        <Pressable
          style={styles.embassyLink}
          onPress={() => router.push("/embassy" as any)}
          testID="faction-open-embassy"
        >
          <Text style={styles.embassyLinkTxt}>Preview the Embassy →</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  scroll: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    paddingBottom: SPACING.xxxl,
    alignItems: "center",
  },

  lockHeader: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    maxWidth: 360,
    width: "100%",
  },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: STATUS_COLOR + "15",
    borderWidth: 1.5,
    borderColor: STATUS_COLOR + "50",
    marginBottom: SPACING.xs,
  },
  kicker: {
    color: STATUS_COLOR,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "800",
  },
  title: {
    color: COLORS.onSurface,
    fontSize: 26,
    fontWeight: "300",
    textAlign: "center",
  },
  flavor: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    fontStyle: "italic",
    marginTop: SPACING.xs,
  },

  previewCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: STATUS_COLOR + "30",
    padding: SPACING.lg,
    gap: SPACING.md,
    width: "100%",
    maxWidth: 400,
  },
  previewKicker: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  bulletTxt: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },

  returnBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.brand,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
    width: "100%",
    maxWidth: 400,
  },
  returnBtnTxt: {
    color: COLORS.onBrand,
    fontSize: 15,
    fontWeight: "700",
  },

  embassyLink: {
    alignItems: "center",
    paddingVertical: SPACING.sm,
  },
  embassyLinkTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
