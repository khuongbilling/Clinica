import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";

import { GLOW, GRADIENTS, UI, UI_RADIUS, SPACING } from "@/src/theme/ui";

// PrimaryButton — the single, obvious primary action. Luminous gold (or teal)
// gradient with a soft glow and a comfortable thumb-sized tap target.
export function PrimaryButton({
  label,
  onPress,
  icon,
  iconRight = "arrow-forward",
  tone = "gold",
  disabled = false,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap | null;
  tone?: "gold" | "teal";
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}) {
  const ramp = tone === "teal" ? GRADIENTS.tealButton : GRADIENTS.goldButton;
  const fg = tone === "teal" ? UI.onTeal : UI.onGold;
  const glow = tone === "teal" ? GLOW.teal : GLOW.gold;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [
        styles.wrap,
        glow,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <LinearGradient
        colors={ramp}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.row}>
        {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
        {iconRight ? <Ionicons name={iconRight} size={17} color={fg} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 54,
    borderRadius: UI_RADIUS.pill,
    overflow: "hidden",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  label: { fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
