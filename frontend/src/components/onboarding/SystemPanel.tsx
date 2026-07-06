import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

/**
 * Push 7 — the ONE dialogue-box shape every onboarding screen should use for
 * "the System" speaking (identity restoration, diagnostic, class result,
 * confirmation messages, University framing). Unifies the icon badge, kicker
 * label, glow border, and body copy that were previously hand-rolled per
 * screen with slightly different colors/spacing.
 *
 * Purely presentational — no navigation, no state. Screens keep their own
 * copy and pass it as children.
 */
export function SystemPanel({
  icon = "hardware-chip-outline",
  label = "SYSTEM",
  accent = COLORS.brand,
  children,
  compact,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  accent?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.panel,
        { borderColor: accent + "55", shadowColor: accent },
        compact && styles.panelCompact,
      ]}
      testID="system-panel"
    >
      <View style={styles.head}>
        <View style={[styles.iconWrap, { backgroundColor: accent + "1E", borderColor: accent + "55" }]}>
          <Ionicons name={icon} size={16} color={accent} />
        </View>
        <Text style={[styles.label, { color: accent }]}>{label}</Text>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: "100%",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.sm,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  panelCompact: { padding: SPACING.md, gap: SPACING.xs },
  head: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  body: { gap: SPACING.xs },
});
