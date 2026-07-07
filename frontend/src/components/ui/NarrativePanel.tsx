import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, ViewStyle } from "react-native";

import { UI, UI_RADIUS, SPACING } from "@/src/theme/ui";

// NarrativePanel — the bottom story panel for cinematic scenes. Keeps narrative
// text in a clear, legible frosted band at the bottom of a full-screen
// illustration, preserving emotional clarity over decorative complexity.
export function NarrativePanel({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}) {
  return (
    <View style={[styles.wrap, style]} testID={testID}>
      <LinearGradient
        colors={["rgba(18,12,26,0.62)", "rgba(14,9,20,0.9)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: UI_RADIUS.xl,
    borderWidth: 1,
    borderColor: UI.border,
    overflow: "hidden",
  },
  inner: { padding: SPACING.lg },
});
