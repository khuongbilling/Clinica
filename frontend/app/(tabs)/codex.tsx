import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CODEX } from "@/src/game/content";
import { usePlayer } from "@/src/game/store";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function CodexScreen() {
  const { player } = usePlayer();
  if (!player) return null;
  const unlocked = new Set(player.codex_unlocked);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>THE GREAT CODEX</Text>
        <Text style={styles.title}>Library of Knowledge</Text>
        <Text style={styles.sub}>{unlocked.size} of {CODEX.length} pages restored</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {CODEX.map((entry) => {
          const isUnlocked = unlocked.has(entry.id);
          const c = ELEMENT_COLORS[entry.system];
          return (
            <View key={entry.id} style={styles.card} testID={`codex-entry-${entry.id}`}>
              <View style={styles.cardHead}>
                <View style={[styles.elementBadge, { backgroundColor: c + "22", borderColor: c }]}>
                  <Text style={[styles.elementText, { color: c }]}>{entry.system.toUpperCase()}</Text>
                </View>
                <View style={styles.level}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <View key={i} style={[styles.lvlDot, i < entry.level && { backgroundColor: COLORS.brand }]} />
                  ))}
                </View>
              </View>
              {isUnlocked ? (
                <>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  <Text style={styles.entryBody}>{entry.body}</Text>
                </>
              ) : (
                <View style={styles.locked}>
                  <Ionicons name="lock-closed" size={20} color={COLORS.onSurfaceTertiary} />
                  <Text style={styles.lockedTitle}>Sealed Page</Text>
                  <Text style={styles.lockedSub}>Defeat a {entry.system} corruption to reveal this lore.</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: { padding: SPACING.lg, gap: 4 },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 28, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  scroll: { padding: SPACING.lg, paddingTop: 0, gap: SPACING.md, paddingBottom: SPACING.xxxl },
  card: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  elementBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, borderWidth: 1 },
  elementText: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  level: { flexDirection: "row", gap: 4 },
  lvlDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.surfaceTertiary },
  entryTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: "400" },
  entryBody: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21 },
  locked: { alignItems: "center", paddingVertical: SPACING.lg, gap: 6 },
  lockedTitle: { color: COLORS.onSurfaceTertiary, fontSize: 14, fontWeight: "500" },
  lockedSub: { color: COLORS.onSurfaceTertiary, fontSize: 12, textAlign: "center", paddingHorizontal: SPACING.lg },
});
