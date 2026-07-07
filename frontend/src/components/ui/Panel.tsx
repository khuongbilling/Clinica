import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, ViewStyle } from "react-native";

import { GLOW, GRADIENTS, UI, UI_RADIUS, SPACING } from "@/src/theme/ui";

export type PanelTone = "default" | "gold" | "teal";

// Panel — the primary illustrated-academy surface. A soft gradient card with a
// gold-tinted hairline border and gentle depth, so every menu/card reads as
// part of the same magical world. Presentation-only wrapper.
export function Panel({
  children,
  tone = "default",
  glow = false,
  padded = true,
  style,
  testID,
}: {
  children: React.ReactNode;
  tone?: PanelTone;
  glow?: boolean;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}) {
  const ramp =
    tone === "gold" ? GRADIENTS.panelGold : tone === "teal" ? GRADIENTS.panelTeal : GRADIENTS.panel;
  const borderColor = tone === "default" ? UI.border : tone === "teal" ? "rgba(79,216,196,0.34)" : UI.borderStrong;

  return (
    <View
      style={[styles.wrap, { borderColor }, glow && GLOW.ambient, style]}
      testID={testID}
    >
      <LinearGradient colors={ramp} style={StyleSheet.absoluteFill} />
      <View style={padded ? styles.pad : undefined}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: UI_RADIUS.card,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: UI.panel,
  },
  pad: { padding: SPACING.lg },
});
