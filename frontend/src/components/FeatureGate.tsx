import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { buildGateContext, checkFeatureGate, type GateResult } from "@/src/game/progression";
import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// Derive the live gate state for a feature from the current player. Screens use
// this at entry to block direct navigation into a still-locked area; link
// sources use it to disable/lock in-app links pointing at gated routes.
export function useFeatureGate(featureId: string): GateResult {
  const { player } = usePlayer();
  return checkFeatureGate(featureId, buildGateContext(player));
}

// Friendly full-screen locked state shown when a player reaches a gated screen
// out of order (e.g. via a deep link or in-app link that skipped the gate).
export function FeatureLockedView({
  title,
  reason,
  fallback = "/(tabs)",
}: {
  title: string;
  reason: string | null;
  fallback?: string;
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={40} color={COLORS.brand} />
        </View>
        <Text style={styles.title}>{title} is locked</Text>
        <Text style={styles.reason}>
          {reason ?? "Keep progressing to unlock this area."}
        </Text>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, fallback as any)}
          testID="feature-locked-back"
        >
          <Ionicons name="arrow-back" size={16} color={COLORS.surface} />
          <Text style={styles.backTxt}>Go Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  title: {
    color: COLORS.onSurface,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  reason: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.brand,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  backTxt: { color: COLORS.surface, fontWeight: "700", fontSize: 14 },
});
