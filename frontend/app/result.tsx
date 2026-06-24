import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BOSS_LORD_IMBALANCE, CODEX, ENEMIES } from "@/src/game/content";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function Result() {
  const router = useRouter();
  const { outcome, enemyId, stability } = useLocalSearchParams<{ outcome: string; enemyId: string; stability: string }>();
  const won = outcome === "win";
  const enemy = useMemo(() => {
    if (enemyId === BOSS_LORD_IMBALANCE.id) return BOSS_LORD_IMBALANCE;
    return ENEMIES.find((e) => e.id === enemyId);
  }, [enemyId]);
  const codexUnlocked = useMemo(() => {
    if (!enemy || !won) return [];
    return CODEX.filter((c) => enemy.teaches.includes(c.id));
  }, [enemy, won]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.head}>
          <Ionicons
            name={won ? "shield-checkmark" : "alert-circle"}
            size={64}
            color={won ? COLORS.success : COLORS.error}
          />
          <Text style={styles.kicker}>{won ? "ENCOUNTER PURIFIED" : "PATIENT LOST"}</Text>
          <Text style={styles.title}>{enemy?.name}</Text>
          <Text style={styles.sub}>{enemy?.realWorld}</Text>
        </View>

        {won && (
          <>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statLbl}>STABILITY</Text>
                <Text style={styles.statVal}>{stability}%</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLbl}>XP EARNED</Text>
                <Text style={styles.statVal}>+{enemy?.id === BOSS_LORD_IMBALANCE.id ? 150 : 35 + (enemy?.difficulty || 1) * 10}</Text>
              </View>
            </View>

            {codexUnlocked.length > 0 && (
              <>
                <Text style={styles.section}>Codex Pages Restored</Text>
                {codexUnlocked.map((c) => (
                  <View key={c.id} style={styles.codex}>
                    <Ionicons name="book" size={18} color={COLORS.brand} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.codexTitle}>{c.title}</Text>
                      <Text style={styles.codexBody} numberOfLines={3}>{c.body}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {!won && enemy && (
          <View style={styles.tipCard}>
            <Text style={styles.tipKicker}>LESSON</Text>
            <Text style={styles.tipTitle}>{enemy.dangerTrigger}</Text>
            <Text style={styles.tipBody}>
              Best counters for {enemy.realWorld}: {enemy.bestCounters.join(", ")}. Review the codex and try again.
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable style={styles.primary} onPress={() => router.replace("/(tabs)")} testID="result-back">
            <Text style={styles.primaryTxt}>RETURN TO SHIFT</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => router.replace("/(tabs)/codex")} testID="result-codex">
            <Text style={styles.secondaryTxt}>OPEN CODEX</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxxl },
  head: { alignItems: "center", gap: 6, marginTop: SPACING.xl },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 3, fontWeight: "700", marginTop: SPACING.sm },
  title: { color: COLORS.onSurface, fontSize: 28, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceTertiary, fontSize: 13 },
  statRow: { flexDirection: "row", gap: SPACING.md },
  stat: { flex: 1, backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center", borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  statLbl: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  statVal: { color: COLORS.brand, fontSize: 28, fontWeight: "300" },
  section: { color: COLORS.onSurface, fontSize: 18, marginTop: SPACING.sm },
  codex: { flexDirection: "row", gap: SPACING.md, backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  codexTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  codexBody: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 4, lineHeight: 16 },
  tipCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.error + "60", gap: SPACING.sm },
  tipKicker: { color: COLORS.error, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  tipTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: "500" },
  tipBody: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  actions: { gap: SPACING.sm, marginTop: SPACING.md },
  primary: { backgroundColor: COLORS.brand, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center" },
  primaryTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
  secondary: { borderWidth: 1, borderColor: COLORS.borderStrong, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center" },
  secondaryTxt: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
});
