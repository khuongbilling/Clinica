import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

interface BazaarChipListProps {
  items: string[];
  accentColor: string;
  icon: string;
}

/** Wrapping chip list used for Tradeable / Non-Tradeable category previews. */
export function BazaarChipList({ items, accentColor, icon }: BazaarChipListProps) {
  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <View key={item} style={[styles.chip, { borderColor: accentColor + "50", backgroundColor: accentColor + "16" }]}>
          <Ionicons name={icon as any} size={11} color={accentColor} />
          <Text style={styles.chipTxt} numberOfLines={2}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: RADIUS.pill, borderWidth: 1,
    paddingHorizontal: 9, paddingVertical: 5, maxWidth: "100%",
  },
  chipTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, flexShrink: 1 },
});
