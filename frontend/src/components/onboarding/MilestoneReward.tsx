import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export type MilestoneRewardItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  amount?: string;
};

/**
 * Push 7 — a single, consistent "you reached a milestone" reward card used
 * across every onboarding beat (prologue survival, identity restored, class
 * registered, first lesson, first Simulation Shift). Deliberately modest:
 * a short list of small item/currency chips, no big banners or fanfare
 * overload — matches the "modest rewards only" requirement.
 *
 * Pure presentation: caller decides what items to show; this only animates
 * them in with a small pop + stagger so completing an onboarding step feels
 * satisfying without needing new art or sound assets.
 */
export function MilestoneReward({
  title,
  items,
  accent = COLORS.brand,
}: {
  title: string;
  items: MilestoneRewardItem[];
  accent?: string;
}) {
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
  }, [title, pop]);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Animated.View
      style={[styles.wrap, { borderColor: accent + "55", opacity: pop, transform: [{ scale }] }]}
      testID="milestone-reward"
    >
      <View style={styles.head}>
        <Ionicons name="sparkles" size={14} color={accent} />
        <Text style={[styles.title, { color: accent }]}>{title}</Text>
      </View>
      <View style={styles.row}>
        {items.map((it, i) => (
          <View key={i} style={styles.chip}>
            <Ionicons name={it.icon} size={13} color={accent} />
            <Text style={styles.chipTxt} numberOfLines={1}>
              {it.label}
              {it.amount ? ` +${it.amount}` : ""}
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: "700" },
});
