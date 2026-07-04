import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { getMaterialById, rewardPreviewForMode } from "@/src/game/materials";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export function RewardPreview({ mode, label }: { mode: string; label?: string }) {
  const router = useRouter();
  const preview = rewardPreviewForMode(mode);
  if (!preview) return null;
  const items = preview.materialIds.map(getMaterialById).filter(Boolean) as NonNullable<ReturnType<typeof getMaterialById>>[];
  if (items.length === 0) return null;

  return (
    <Pressable
      onPress={() => router.push("/materials")}
      style={styles.wrap}
      testID={`reward-preview-${mode.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <View style={styles.head}>
        <Ionicons name={preview.icon as any} size={13} color={COLORS.brand} />
        <Text style={styles.label}>{label || "You can earn"}</Text>
        <Ionicons name="chevron-forward" size={12} color={COLORS.onSurfaceTertiary} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {items.map((m) => (
          <View key={m.id} style={styles.chip}>
            <Ionicons name={m.icon as any} size={12} color={COLORS.brand} />
            <Text style={styles.chipTxt}>{m.name}</Text>
          </View>
        ))}
      </ScrollView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.surfaceSecondary, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  label: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: "700", flex: 1 },
  chips: { flexDirection: "row", gap: 6 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.border,
  },
  chipTxt: { color: COLORS.onSurfaceSecondary, fontSize: 10, fontWeight: "600" },
});
