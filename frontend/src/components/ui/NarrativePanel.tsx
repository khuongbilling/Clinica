import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, ViewStyle } from "react-native";

import { UI, UI_RADIUS, SPACING } from "@/src/theme/ui";

// NarrativePanel — the bottom story panel for cinematic scenes. Keeps narrative
// text in a clear, legible frosted band at the bottom of a full-screen
// illustration, preserving emotional clarity over decorative complexity.
// tone="ink" is the mature-manhwa variant used by narrative story scenes:
// a colder, darker ink wash with a muted gold hairline instead of the warm
// plum frosted band used across donghua gameplay screens.
export function NarrativePanel({
  children,
  style,
  tone = "default",
  testID,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  tone?: "default" | "ink";
  testID?: string;
}) {
  const ink = tone === "ink";
  return (
    <View style={[styles.wrap, ink && styles.wrapInk, style]} testID={testID}>
      <LinearGradient
        colors={
          ink
            ? ["rgba(8,10,16,0.72)", "rgba(4,5,9,0.94)"]
            : ["rgba(18,12,26,0.62)", "rgba(14,9,20,0.9)"]
        }
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
  wrapInk: { borderColor: "rgba(224,180,92,0.28)" },
  inner: { padding: SPACING.lg },
});
