import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";

import { UI, UI_RADIUS, SPACING } from "@/src/theme/ui";

// SecondaryButton — subordinate action. Outlined, quiet, still comfortable to
// tap. Visually clearly below the PrimaryButton in hierarchy.
export function SecondaryButton({
  label,
  onPress,
  icon,
  iconRight,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed, style]}
    >
      <View style={styles.row}>
        {icon ? <Ionicons name={icon} size={16} color={UI.gold} /> : null}
        <Text style={styles.label}>{label}</Text>
        {iconRight ? <Ionicons name={iconRight} size={15} color={UI.gold} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 48,
    borderRadius: UI_RADIUS.pill,
    borderWidth: 1,
    borderColor: UI.borderStrong,
    backgroundColor: "rgba(232,200,104,0.06)",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
  },
  label: { color: UI.gold, fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },
  pressed: { opacity: 0.8 },
});
