import { StyleSheet, Text, View } from "react-native";

import { UI, SPACING } from "@/src/theme/ui";

// SectionHeader — a consistent kicker + title used to chunk screens so mobile
// layouts stay scannable. Optional trailing slot for a link/action.
export function SectionHeader({
  kicker,
  title,
  right,
}: {
  kicker?: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        {kicker ? <Text style={styles.kicker}>{kicker.toUpperCase()}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  left: { flex: 1, gap: 2 },
  kicker: { color: UI.gold, fontSize: 10, fontWeight: "800", letterSpacing: 2.5 },
  title: { color: UI.text, fontSize: 18, fontWeight: "800" },
});
