import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { BazaarRuleRow as BazaarRuleRowDef } from "@/src/game/bazaarHub";
import { COLORS, SPACING } from "@/src/theme/colors";

interface BazaarRuleRowProps {
  row: BazaarRuleRowDef;
  accentColor: string;
}

/** Single label/value rule line used across Marketplace Rules, Trading Requirements, and Safety Guidelines. */
export function BazaarRuleRow({ row, accentColor }: BazaarRuleRowProps) {
  return (
    <View style={styles.row}>
      <Ionicons name={row.icon as any} size={14} color={accentColor} style={styles.icon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{row.label}</Text>
        <Text style={styles.value}>{row.value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm, paddingVertical: 3 },
  icon: { marginTop: 2 },
  label: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700" },
  value: { color: COLORS.onSurfaceSecondary, fontSize: 11.5, lineHeight: 16, marginTop: 1 },
});
