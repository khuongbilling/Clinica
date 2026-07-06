import { StyleSheet, Text, View } from "react-native";
import { COLORS, SPACING } from "@/src/theme/colors";

// Push 7 — a single shared progress indicator spanning the WHOLE guided
// onboarding arc (prologue through first Simulation Shift), so the player
// always has a sense of "how much is left" instead of only ever seeing a
// per-screen sub-progress (e.g. quiz question 2/5). Screens pass their own
// step index; the bar itself owns the canonical step list/order.
export const ONBOARDING_STEPS = [
  "Prologue",
  "Lotus Recall",
  "Identity",
  "Diagnostic",
  "Class Result",
  "Memory",
  "University",
  "Lessons",
  "First Shift",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function OnboardingProgressBar({
  step,
  accent = COLORS.brand,
}: {
  step: OnboardingStep;
  accent?: string;
}) {
  const index = ONBOARDING_STEPS.indexOf(step);
  if (index < 0) return null;
  return (
    <View style={styles.wrap} testID="onboarding-progress-bar">
      <View style={styles.dots}>
        {ONBOARDING_STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i <= index && { backgroundColor: accent, flex: 1.6 },
              i > index && { flex: 1 },
            ]}
          />
        ))}
      </View>
      <Text style={styles.label}>
        {`Step ${index + 1} of ${ONBOARDING_STEPS.length} \u00b7 ${step}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", gap: 6, alignItems: "center" },
  dots: { flexDirection: "row", gap: 4, width: "100%" },
  dot: { height: 3, borderRadius: 2, backgroundColor: COLORS.border, flex: 1 },
  label: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 0.5, fontWeight: "600" },
});
