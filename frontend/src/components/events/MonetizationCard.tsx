import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MONETIZATION_BADGE_COLOR, MonetizationCardDef } from "@/src/game/eventsHub";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

interface MonetizationCardProps {
  card: MonetizationCardDef;
  onPress: (card: MonetizationCardDef) => void;
  testID?: string;
}

/**
 * Monetization preview card for the Push 7 Event Hub. Every card is clearly
 * badged (Preview / Planned / Coming Soon / Not Active) and never triggers a
 * purchase, billing call, or platform IAP flow — tapping only opens an info
 * sheet confirming it isn't live yet.
 */
export function MonetizationCard({ card, onPress, testID }: MonetizationCardProps) {
  const badgeColor = MONETIZATION_BADGE_COLOR[card.badge];
  return (
    <Pressable style={[styles.card, { borderColor: card.accentColor + "45" }]} onPress={() => onPress(card)} testID={testID}>
      <LinearGradient
        colors={[card.accentColor + "22", COLORS.surfaceSecondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { borderColor: card.accentColor + "70", backgroundColor: card.accentColor + "22" }]}>
          <Ionicons name={card.icon as any} size={20} color={card.accentColor} />
        </View>
        <View style={[styles.badge, { backgroundColor: badgeColor + "26", borderColor: badgeColor + "55" }]}>
          <Ionicons name="lock-closed-outline" size={9} color={badgeColor} />
          <Text style={[styles.badgeTxt, { color: badgeColor }]}>{card.badge.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.title}>{card.title}</Text>
      <Text style={styles.subtitle} numberOfLines={2}>{card.subtitle}</Text>
      <View style={styles.footerRow}>
        <Ionicons name="information-circle-outline" size={12} color={COLORS.onSurfaceTertiary} />
        <Text style={styles.footerTxt}>Tap for details — nothing to buy yet</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.md,
    gap: 5,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3,
  },
  badgeTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  title: { color: COLORS.onSurface, fontSize: 15, fontWeight: "700", marginTop: 2 },
  subtitle: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 16 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  footerTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontStyle: "italic" },
});
