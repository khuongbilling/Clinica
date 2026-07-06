import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

interface BazaarSectionCardProps {
  title: string;
  icon: string;
  accentColor: string;
  intro?: string;
  children: React.ReactNode;
  testID?: string;
}

/**
 * Shared card shell for every Sanctuary Bazaar info section (Push 8). Pure
 * presentation — no trading, listing, or purchase logic lives here.
 */
export function BazaarSectionCard({ title, icon, accentColor, intro, children, testID }: BazaarSectionCardProps) {
  return (
    <View style={[styles.card, { borderColor: accentColor + "40" }]} testID={testID}>
      <LinearGradient
        colors={[accentColor + "1A", COLORS.surfaceSecondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.headRow}>
        <View style={[styles.iconWrap, { borderColor: accentColor + "70", backgroundColor: accentColor + "22" }]}>
          <Ionicons name={icon as any} size={18} color={accentColor} />
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      {intro && <Text style={styles.intro}>{intro}</Text>}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  title: { color: COLORS.onSurface, fontSize: 15, fontWeight: "700", flex: 1 },
  intro: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },
  body: { gap: SPACING.xs },
});
