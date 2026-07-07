import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

import { BOSS_LORD_IMBALANCE, BOSS_VERDANTHA } from "@/src/game/content";
import { getEnemySprite } from "@/src/components/EnemySprites";
import { InlineNotice, useInlineNotice } from "@/src/components/WebAlert";
import { usePlayer } from "@/src/game/store";
import { goBack } from "@/src/utils/navigation";
import { BOSS_ENCOUNTER_COST, formatCountdown, useLiveStamina } from "@/src/game/stamina";
import { VERDANTHA, VERDANTHA_UNLOCKED } from "@/src/game/worldEvent";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const BLOOM_ACCENT = "#34D399";

export default function BossPage() {
  const router = useRouter();
  const { bossId } = useLocalSearchParams<{ bossId?: string }>();
  const { player, spendStamina } = usePlayer();
  const { stamina, msUntilNext } = useLiveStamina(player);
  const { notice, flashNotice } = useInlineNotice();

  const isVerdantha = bossId === "verdantha";

  if (!player) {
    return (
      <SafeAreaView style={[styles.root, styles.loading]} edges={["top", "bottom"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  const boss = isVerdantha ? BOSS_VERDANTHA : BOSS_LORD_IMBALANCE;
  const sprite = getEnemySprite(boss.id);
  const accent = isVerdantha ? BLOOM_ACCENT : (ELEMENT_COLORS[boss.primarySystem] ?? "#F87171");
  const canFight = stamina >= BOSS_ENCOUNTER_COST;

  // Verdantha is gated behind Phase III — Convergence. Until that goes live
  // (VERDANTHA_UNLOCKED) the fight cannot start. Lord Imbalance unlocks after
  // any completed shift as before.
  const bossUnlocked = isVerdantha
    ? VERDANTHA_UNLOCKED
    : ((player.bosses_defeated?.length ?? 0) > 0 || player.runs_completed >= 1);

  const backTarget = isVerdantha ? "/world-event" : "/(tabs)";

  const enter = async () => {
    if (!canFight) {
      flashNotice(
        `Not enough Shift Challenges — a boss encounter costs ${BOSS_ENCOUNTER_COST}. You have ${stamina}. Next challenge in ${formatCountdown(msUntilNext)}.`,
      );
      return;
    }
    const ok = await spendStamina(BOSS_ENCOUNTER_COST);
    if (!ok) {
      flashNotice(`Not enough Shift Challenges — a boss encounter costs ${BOSS_ENCOUNTER_COST}.`);
      return;
    }
    router.push({ pathname: "/battle", params: { enemyId: boss.id } });
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Back button */}
      <Pressable style={styles.backBtn} onPress={() => goBack(router, backTarget)} hitSlop={10} testID="boss-back">
        <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Boss portrait */}
        <View style={styles.portraitWrap}>
          {sprite ? (
            <ExpoImage source={sprite} style={StyleSheet.absoluteFillObject} contentFit="contain" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.portraitFallback, { backgroundColor: COLORS.surfaceSecondary }]}>
              <Ionicons name="skull" size={72} color={accent + "55"} />
            </View>
          )}
          <LinearGradient
            colors={["rgba(12,14,18,0.4)", "rgba(12,14,18,0.0)", "rgba(12,14,18,0.95)"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.portraitContent}>
            <Text style={[styles.chapterKicker, isVerdantha && { color: accent + "CC" }]}>
              {isVerdantha ? "WORLD EVENT · PHASE III — CONVERGENCE" : "CHAPTER I · FINAL ENCOUNTER"}
            </Text>
            <Text style={styles.bossName}>{boss.name}</Text>
            <Text style={styles.bossSubtitle}>{isVerdantha ? VERDANTHA.title : "Lord of Systemic Imbalance"}</Text>
            <View style={styles.pillRow}>
              <View style={[styles.pill, { borderColor: accent + "60" }]}>
                <Text style={[styles.pillTxt, { color: accent }]}>
                  {boss.primarySystem.toUpperCase()}
                </Text>
              </View>
              {boss.secondarySystem && (
                <View style={[styles.pill, { borderColor: (ELEMENT_COLORS[boss.secondarySystem] ?? "#22D3EE") + "60" }]}>
                  <Text style={[styles.pillTxt, { color: ELEMENT_COLORS[boss.secondarySystem] ?? "#22D3EE" }]}>
                    {boss.secondarySystem.toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.pill}>
                <Text style={styles.pillTxt}>★ {boss.difficulty}/5</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Lore */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>THREAT REPORT</Text>
          {isVerdantha ? (
            <Text style={styles.loreText}>{VERDANTHA.lore}</Text>
          ) : (
            <>
              <Text style={styles.loreText}>
                The Fading Core pulses at the heart of Clinica — a catastrophic convergence of every systemic failure the kingdom has faced. Air falters. River rages. Mind unravels. All at once.
              </Text>
              <Text style={styles.loreText}>
                Lord Imbalance is not a single disease — it is the cascade. To defeat it, your team must triage, prioritize, and act with disciplined clinical judgment under pressure.
              </Text>
            </>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          {(isVerdantha
            ? [
                { label: "SYSTEMS INVOLVED", val: `${boss.primarySystem} · ${boss.secondarySystem ?? ""}` },
                { label: "SCALE", val: VERDANTHA.difficulty },
                { label: "DIFFICULTY", val: `★★★★★ (${boss.difficulty}/5)` },
                { label: "BEST COUNTERS", val: boss.bestCounters?.join(", ") ?? "Balanced team" },
              ]
            : [
                { label: "SYSTEMS INVOLVED", val: "Air · River · Mind" },
                { label: "STAGES", val: "5 escalating phases" },
                { label: "DIFFICULTY", val: `★★★★★ (${boss.difficulty}/5)` },
                { label: "BEST COUNTERS", val: boss.bestCounters?.join(", ") ?? "Balanced team" },
              ]
          ).map((s) => (
            <View key={s.label} style={styles.statRow}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statVal}>{s.val}</Text>
            </View>
          ))}
        </View>

        {/* Verdantha-only: signature attack, weaknesses, drop rewards */}
        {isVerdantha && (
          <>
            <View style={[styles.infoCard, { borderColor: COLORS.error + "30" }]}>
              <Text style={[styles.sectionLabel, { color: COLORS.error }]}>SIGNATURE ATTACK</Text>
              <Text style={styles.loreText}>{VERDANTHA.signatureAttack}</Text>
            </View>
            <View style={[styles.infoCard, { borderColor: COLORS.success + "30" }]}>
              <Text style={[styles.sectionLabel, { color: COLORS.success }]}>WEAKNESSES</Text>
              <Text style={styles.loreText}>{VERDANTHA.weaknesses}</Text>
            </View>
            <View style={[styles.infoCard, { borderColor: accent + "30" }]}>
              <Text style={[styles.sectionLabel, { color: accent }]}>BOSS DROP REWARDS</Text>
              {VERDANTHA.dropRewards.map((drop, i) => (
                <View key={i} style={styles.dropRow}>
                  <Ionicons name="cube-outline" size={14} color={accent} />
                  <Text style={styles.dropTxt}>{drop}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Warning */}
        <View style={styles.warningCard}>
          <Ionicons name="warning-outline" size={16} color={COLORS.error} />
          <Text style={styles.warningTxt}>
            {isVerdantha
              ? "A world-scale threat. Bloom Cascade strikes every ward at once — the whole Sanctuary must coordinate to hold her back."
              : "Multi-system collapse. Read every clue. Choose one crisis at a time. The patient will deteriorate fast."}
          </Text>
        </View>

        {notice && (
          <View style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.md }}>
            <InlineNotice notice={notice} icon="flash" testID="boss-notice" />
          </View>
        )}

        {/* CTA */}
        {bossUnlocked ? (
          <Pressable style={[styles.enterBtn, isVerdantha && { backgroundColor: accent }]} onPress={enter} testID="boss-enter">
            <Text style={styles.enterTxt}>{isVerdantha ? "CONFRONT VERDANTHA" : "ENTER THE FADING CORE"}</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.onBrand} />
          </Pressable>
        ) : (
          <View style={styles.lockedCard} testID="boss-locked">
            <Ionicons name="lock-closed" size={22} color={COLORS.onSurfaceTertiary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lockedTitle}>
                {isVerdantha ? "Verdantha Slumbers — Coming Soon" : "The Fading Core is Sealed"}
              </Text>
              <Text style={styles.lockedSub}>
                {isVerdantha
                  ? "The Bloom Matriarch only manifests at Phase III — Convergence, when the Sanctuary-wide Containment Threshold is crossed. This world-boss fight is not yet live."
                  : "Complete at least one shift to break the seal and confront Lord Imbalance."}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  backBtn: {
    position: "absolute", top: 60, left: SPACING.lg, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(12,14,18,0.8)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: COLORS.border,
  },
  scroll: { paddingBottom: SPACING.xxxl },

  portraitWrap: { height: 320, position: "relative", overflow: "hidden" },
  portraitContent: { position: "absolute", bottom: 0, left: 0, right: 0, padding: SPACING.lg, gap: 6 },
  chapterKicker: { color: COLORS.error + "CC", fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  bossName: { color: COLORS.onSurface, fontSize: 32, fontWeight: "300" },
  bossSubtitle: { color: COLORS.onSurfaceSecondary, fontSize: 13, letterSpacing: 0.5 },
  pillRow: { flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap", marginTop: 4 },
  pill: { borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillTxt: { color: COLORS.onSurface, fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  portraitFallback: { alignItems: "center", justifyContent: "center" },

  section: { padding: SPACING.lg, gap: SPACING.sm },
  sectionLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 2 },
  loreText: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 22 },

  infoCard: {
    marginHorizontal: SPACING.lg, marginTop: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, gap: SPACING.xs,
  },
  dropRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: 2 },
  dropTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, flex: 1 },

  statsCard: {
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
  },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: SPACING.md },
  statLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 1, flex: 1 },
  statVal: { color: COLORS.onSurface, fontSize: 13, flex: 2, textAlign: "right" },

  warningCard: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    margin: SPACING.lg,
    backgroundColor: COLORS.error + "14",
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.error + "30",
  },
  warningTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20, flex: 1 },

  enterBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.sm, backgroundColor: COLORS.brand,
    marginHorizontal: SPACING.lg, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
  },
  enterTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 2 },

  lockedCard: {
    flexDirection: "row", gap: SPACING.md, alignItems: "center",
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  lockedTitle: { color: COLORS.onSurfaceSecondary, fontSize: 15, fontWeight: "500", marginBottom: 2 },
  lockedSub: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18 },
});
