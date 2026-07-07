import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { UI, UI_RADIUS } from "@/src/theme/ui";

// RewardCard — a compact chip that signals a reward or outcome. Reused inside
// quest cards, result surfaces, and reward previews so payoff reads the same
// everywhere.
export function RewardCard({
  icon = "sparkles",
  label,
  tint = UI.gold,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  tint?: string;
}) {
  return (
    <View style={[styles.wrap, { borderColor: tint + "55", backgroundColor: tint + "18" }]}>
      <Ionicons name={icon} size={12} color={tint} />
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: UI_RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
});
