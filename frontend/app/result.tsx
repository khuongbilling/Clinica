import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BOSS_LORD_IMBALANCE, CODEX, ENEMIES } from "@/src/game/content";
import { getEnemyHint } from "@/src/game/onboarding";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function Result() {
  const router = useRouter();
  const { player } = usePlayer();
  const { outcome, enemyId, stability, training } = useLocalSearchParams<{ outcome: string; enemyId: string; stability: string; training?: string }>();
  const won = outcome === "win";
  const isTraining = training === "1";
  const enemy = useMemo(() => {
    if (enemyId === BOSS_LORD_IMBALANCE.id) return BOSS_LORD_IMBALANCE;
    return ENEMIES.find((e) => e.id === enemyId);
  }, [enemyId]);

  const codexUnlocked = useMemo(() => {
    if (!enemy || !won) return [];
    return CODEX.filter((c) => enemy.teaches.includes(c.id));
  }, [enemy, won]);

  // After loss, current failure count was just incremented by battle.tsx
  const failureCount = enemy ? ((player?.failure_counts || {})[enemy.id] || 0) : 0;
  const hints = enemy ? getEnemyHint(enemy.id) : null;

  // For the result hint banner:
  // - 1 failure → gentle hint
  // - 2 failures → tactical hint
  // - 3+ failures → training battle offer
  const showTactical = !won && failureCount === 2;
  const showTraining = !won && failureCount >= 3;

  const retryTraining = () => {
    if (!enemy) return;
    router.replace({ pathname: "/battle", params: { enemyId: enemy.id, training: "1" } });
  };
  const retryNormal = () => {
    if (!enemy) return;
    router.replace({ pathname: "/battle", params: { enemyId: enemy.id } });
  };

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
          <Text style={styles.sub}>{enemy?.realWorld}{isTraining ? " · Training" : ""}</Text>
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
                <Text style={styles.statVal}>+{Math.floor((enemy?.id === BOSS_LORD_IMBALANCE.id ? 150 : 35 + (enemy?.difficulty || 1) * 10) * (isTraining ? 0.5 : 1))}</Text>
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

        {!won && hints && (
          <View style={[styles.tipCard, showTraining && { borderColor: COLORS.brand }]}>
            <Text style={styles.tipKicker}>
              {showTraining ? "A MENTOR JOINS YOU" : showTactical ? "MENTOR'S GUIDANCE" : "THE CODEX WHISPERS"}
            </Text>
            <Text style={styles.tipTitle}>{enemy?.dangerTrigger}</Text>
            <Text style={styles.tipBody}>
              {showTraining
                ? `${hints.tactical}\n\nTry a Training Battle to learn the pattern with extra help.`
                : showTactical
                  ? hints.tactical
                  : hints.gentle}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          {showTraining && enemy && (
            <Pressable style={styles.training} onPress={retryTraining} testID="result-try-training">
              <Ionicons name="sparkles" size={16} color={COLORS.onBrand} />
              <Text style={styles.primaryTxt}>TRY TRAINING BATTLE</Text>
            </Pressable>
          )}
          {!won && enemy && (
            <Pressable style={styles.primary} onPress={retryNormal} testID="result-retry">
              <Text style={styles.primaryTxt}>TRY AGAIN</Text>
            </Pressable>
          )}
          <Pressable style={won ? styles.primary : styles.secondary} onPress={() => router.replace("/(tabs)")} testID="result-back">
            <Text style={won ? styles.primaryTxt : styles.secondaryTxt}>RETURN TO SHIFT</Text>
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
  tipKicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  tipTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: "500" },
  tipBody: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  actions: { gap: SPACING.sm, marginTop: SPACING.md },
  primary: { backgroundColor: COLORS.brand, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center" },
  training: { backgroundColor: COLORS.brand, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: SPACING.sm },
  primaryTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
  secondary: { borderWidth: 1, borderColor: COLORS.borderStrong, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center" },
  secondaryTxt: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
});
