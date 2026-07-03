import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { formatCountdown, useLiveStamina } from "@/src/game/stamina";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export function StaminaPill({
  player,
  showTimer = true,
}: {
  player: { stamina?: number; stamina_updated_at?: string } | null;
  showTimer?: boolean;
}) {
  const { stamina, max, msUntilNext, full } = useLiveStamina(player);
  const low = stamina <= 0;
  const accent = low ? COLORS.error : COLORS.brand;
  return (
    <View style={[styles.pill, { borderColor: accent + "55" }]} testID="stamina-pill">
      <Ionicons name="flash" size={13} color={accent} />
      <Text style={styles.val}>
        {stamina}
        <Text style={styles.max}>/{max}</Text>
      </Text>
      {showTimer && !full ? (
        <Text style={styles.timer}>+1 in {formatCountdown(msUntilNext)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  val: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700" },
  max: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "600" },
  timer: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "600", letterSpacing: 0.3 },
});
