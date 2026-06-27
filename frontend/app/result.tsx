import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BOSS_LORD_IMBALANCE, CODEX, ENEMIES } from "@/src/game/content";
import { getEnemyHint } from "@/src/game/onboarding";
import { getEnemySprite } from "@/src/components/EnemySprites";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { calculateRewards, computeStars, ENEMY_CLINICAL, getStarRules, type LearningProfile } from "@/src/game/clinical";
import { getMission } from "@/src/game/missions";
import { useTestSession } from "@/src/game/testSession";

export default function Result() {
  const router = useRouter();
  const { player } = usePlayer();
  const { logEvent } = useTestSession();
  const { outcome, enemyId, stability, training, shards, fullChain, unsafe, poorFit, turns, reassess, consults, emergency, inappropriate, basicAid } = useLocalSearchParams<{
    outcome: string; enemyId: string; stability: string; training?: string; shards?: string;
    fullChain?: string; unsafe?: string; poorFit?: string; turns?: string; reassess?: string;
    consults?: string; emergency?: string; inappropriate?: string; basicAid?: string;
  }>();
  const won = outcome === "win";
  const isTraining = training === "1";
  const baseShards = parseInt(shards || "0", 10);
  const fullChainCompleted = fullChain === "1";
  const consultsUsed = parseInt(consults || "0", 10);
  const emergencyCallsUsed = parseInt(emergency || "0", 10);
  const inappropriateConsultsUsed = parseInt(inappropriate || "0", 10);
  const basicAidUses = parseInt(basicAid || "0", 10);
  const enemy = useMemo(() => {
    if (enemyId === BOSS_LORD_IMBALANCE.id) return BOSS_LORD_IMBALANCE;
    return ENEMIES.find((e) => e.id === enemyId);
  }, [enemyId]);

  const codexUnlocked = useMemo(() => {
    if (!enemy || !won) return [];
    return CODEX.filter((c) => enemy.teaches.includes(c.id));
  }, [enemy, won]);

  const mission = enemy ? getMission(enemy.id) : null;
  const enemyClinical = enemy ? ENEMY_CLINICAL[enemy.id] : undefined;
  const profile = (player?.learning_profile as LearningProfile | undefined) || undefined;
  const starRules = getStarRules(profile, enemyClinical);
  const starResult = useMemo(() => {
    return computeStars({
      won,
      fullChainCompleted,
      unsafeActionsUsed: parseInt(unsafe || "0", 10),
      poorFitActionsUsed: parseInt(poorFit || "0", 10),
      turnsTaken: parseInt(turns || "0", 10),
      reassessUsed: reassess === "1",
      consultsUsed,
      emergencyCallsUsed,
      inappropriateConsultsUsed,
      basicAidUses,
    }, starRules);
  }, [won, fullChainCompleted, unsafe, poorFit, turns, reassess, consultsUsed, emergencyCallsUsed, inappropriateConsultsUsed, basicAidUses, starRules]);

  const rewardBreakdown = won ? calculateRewards(baseShards, starResult.stars, fullChainCompleted) : null;

  useEffect(() => {
    logEvent('victory_screen_viewed', 'result', {
      meta: { won, enemyId: enemy?.id, stars: starResult.stars },
    });
    if (won) {
      logEvent('stars_earned', 'result', { meta: { stars: starResult.stars, enemyId: enemy?.id } });
      if (mission) logEvent('region_progress_updated', 'result', { meta: { region: mission.kingdomRegion } });
    }
  }, []);


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
          {enemy && getEnemySprite(enemy.id) ? (
            <View style={[styles.enemyResultPortrait, { borderColor: won ? COLORS.success : COLORS.error }]}>
              <Image source={getEnemySprite(enemy.id)!} style={styles.enemyResultImg} resizeMode="cover" />
              <View style={[styles.enemyResultBadge, { backgroundColor: won ? COLORS.success : COLORS.error }]}>
                <Ionicons name={won ? "shield-checkmark" : "alert-circle"} size={22} color={COLORS.surface} />
              </View>
            </View>
          ) : (
            <Ionicons
              name={won ? "shield-checkmark" : "alert-circle"}
              size={64}
              color={won ? COLORS.success : COLORS.error}
            />
          )}
          <Text style={styles.kicker}>{won ? "ENCOUNTER PURIFIED" : "PATIENT LOST"}</Text>
          <Text style={styles.title}>{won && mission ? mission.victoryTitle : enemy?.name ?? ""}</Text>
          <Text style={styles.sub}>{won && mission ? enemy?.name : enemy?.realWorld}{isTraining ? " · Training" : ""}</Text>
        </View>

        {won && (
          <>
            {/* Stars */}
            <View style={styles.starsCard}>
              <Text style={styles.starsTitle}>STARS EARNED</Text>
              <View style={styles.starsRow}>
                {[0, 1, 2].map((i) => (
                  <Ionicons
                    key={i}
                    name={i < starResult.stars ? "star" : "star-outline"}
                    size={36}
                    color={i < starResult.stars ? COLORS.brand : COLORS.onSurfaceTertiary}
                    style={{ marginHorizontal: 4 }}
                  />
                ))}
              </View>
              <View style={{ gap: 4, marginTop: 8 }}>
                {(mission?.starGoals ?? ["Stabilized the patient.", "Completed the clinical care chain.", "Efficient and safe care."]).map((label, i) => (
                  <View key={i} style={styles.starLine}>
                    <Ionicons name={i < starResult.stars ? "checkmark-circle" : "ellipse-outline"} size={14} color={i < starResult.stars ? COLORS.success : COLORS.onSurfaceTertiary} />
                    <Text style={[styles.starLabel, i < starResult.stars && { color: COLORS.onSurface }]}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {mission && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>WHAT HAPPENED</Text>
                <Text style={styles.summaryText}>{mission.clinicalSummary}</Text>
              </View>
            )}

            {(consultsUsed > 0 || emergencyCallsUsed > 0 || inappropriateConsultsUsed > 0 || basicAidUses > 2) && (
              <View style={styles.consultCard} testID="result-consult-notes">
                <Text style={styles.consultTitle}>CLINICAL FORM</Text>
                {basicAidUses > 2 && (
                  <Text style={styles.consultWarn}>• {basicAidUses}× Care Attempt — efficiency star withheld. Targeted clinical skills are stronger.</Text>
                )}
                {consultsUsed === 1 && inappropriateConsultsUsed === 0 && emergencyCallsUsed === 0 && (
                  <Text style={styles.consultGood}>✓ One consult used appropriately — efficient teamwork.</Text>
                )}
                {consultsUsed > 1 && (
                  <Text style={styles.consultWarn}>• {consultsUsed} consults used — efficiency star reduced.</Text>
                )}
                {emergencyCallsUsed > 0 && (
                  <Text style={styles.consultWarn}>• Rapid Response was needed — efficiency star withheld.</Text>
                )}
                {inappropriateConsultsUsed > 0 && (
                  <Text style={styles.consultWarn}>• {inappropriateConsultsUsed} consult{inappropriateConsultsUsed > 1 ? 's' : ''} did not fit the clinical problem.</Text>
                )}
              </View>
            )}

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

            {rewardBreakdown && rewardBreakdown.total > 0 && (
              <View style={styles.shardsCard} testID="result-shards">
                <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
                  <Ionicons name="diamond" size={20} color={COLORS.brand} />
                  <Text style={styles.shardsTxt}>{rewardBreakdown.total} Codex Shards earned.</Text>
                </View>
                <Text style={styles.shardsBreakdown}>
                  Base {rewardBreakdown.base}{rewardBreakdown.starBonus ? ` · Stars +${rewardBreakdown.starBonus}` : ""}{rewardBreakdown.chainBonus ? ` · Care Chain +${rewardBreakdown.chainBonus}` : ""}
                </Text>
              </View>
            )}

            {mission && (
              <View style={styles.kingdomCard}>
                <Ionicons name="globe-outline" size={16} color={COLORS.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.kingdomTitle}>{mission.kingdomRegion}</Text>
                  <Text style={styles.kingdomSub}>
                    {Math.min((player?.runs_completed ?? 0), mission.kingdomMax)}/{mission.kingdomMax} restored
                  </Text>
                </View>
              </View>
            )}

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
  enemyResultPortrait: { width: 96, height: 96, borderRadius: 6, borderWidth: 3, overflow: "hidden", backgroundColor: COLORS.surfaceTertiary, position: "relative", marginBottom: SPACING.xs },
  enemyResultImg: { width: "100%", height: "100%" },
  enemyResultBadge: { position: "absolute", right: -2, bottom: -2, width: 32, height: 32, borderRadius: 4, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: COLORS.surface },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 3, fontWeight: "700", marginTop: SPACING.sm },
  title: { color: COLORS.onSurface, fontSize: 28, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceTertiary, fontSize: 13 },
  statRow: { flexDirection: "row", gap: SPACING.md },
  stat: { flex: 1, backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center", borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  statLbl: { color: COLORS.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  statVal: { color: COLORS.brand, fontSize: 28, fontWeight: "300" },
  section: { color: COLORS.onSurface, fontSize: 18, marginTop: SPACING.sm },
  codex: { flexDirection: "row", gap: SPACING.md, backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3, borderLeftColor: COLORS.brand + "80" },
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
  shardsCard: { flexDirection: "column", gap: 6, backgroundColor: COLORS.brand + "14", borderColor: COLORS.brand + "40", borderWidth: 1, padding: SPACING.md, borderRadius: RADIUS.md },
  shardsTxt: { color: COLORS.brand, fontSize: 14, fontWeight: "600" },
  shardsBreakdown: { color: COLORS.onSurfaceSecondary, fontSize: 11 },
  starsCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, borderTopWidth: 3, borderTopColor: COLORS.brand, alignItems: "center", gap: 4 },
  starsTitle: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  starsRow: { flexDirection: "row", marginTop: 4 },
  starLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  starLabel: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
  consultCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  consultTitle: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 4 },
  consultGood: { color: COLORS.success, fontSize: 12, lineHeight: 17 },
  consultWarn: { color: COLORS.warning || COLORS.brand, fontSize: 12, lineHeight: 17 },
  summaryCard: { backgroundColor: COLORS.surfaceSecondary, padding: SPACING.md, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3, borderLeftColor: COLORS.success + "80", gap: 6 },
  summaryTitle: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  summaryText: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20 },
  kingdomCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.brand + "10", borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.brand + "30",
  },
  kingdomTitle: { color: COLORS.brand, fontSize: 13, fontWeight: "600" },
  kingdomSub: { color: COLORS.onSurfaceSecondary, fontSize: 11, marginTop: 2 },
});
