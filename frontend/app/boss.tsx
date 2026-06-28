import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BOSS_LORD_IMBALANCE } from "@/src/game/content";
import { getEnemySprite } from "@/src/components/EnemySprites";
import { usePlayer } from "@/src/game/store";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function BossPage() {
  const router = useRouter();
  const { player } = usePlayer();

  if (!player) return null;

  const bossUnlocked = (player.bosses_defeated?.length ?? 0) > 0 || player.runs_completed >= 1;
  const boss = BOSS_LORD_IMBALANCE;
  const sprite = getEnemySprite(boss.id);
  const accent = ELEMENT_COLORS[boss.primarySystem] ?? "#F87171";

  const enter = () => {
    router.push({ pathname: "/battle", params: { enemyId: boss.id } });
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Back button */}
      <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10} testID="boss-back">
        <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
      </Pressable>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Boss portrait */}
        <View style={styles.portraitWrap}>
          {sprite ? (
            <Image source={sprite} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: COLORS.surfaceSecondary }]} />
          )}
          <LinearGradient
            colors={["rgba(12,14,18,0.4)", "rgba(12,14,18,0.0)", "rgba(12,14,18,0.95)"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.portraitContent}>
            <Text style={styles.chapterKicker}>CHAPTER I · FINAL ENCOUNTER</Text>
            <Text style={styles.bossName}>{boss.name}</Text>
            <Text style={styles.bossSubtitle}>Lord of Systemic Imbalance</Text>
            <View style={styles.pillRow}>
              <View style={[styles.pill, { borderColor: accent + "60" }]}>
                <Text style={[styles.pillTxt, { color: accent }]}>
                  {boss.primarySystem.toUpperCase()}
                </Text>
              </View>
              {boss.secondarySystem && (
                <View style={[styles.pill, { borderColor: ELEMENT_COLORS[boss.secondarySystem] + "60" }]}>
                  <Text style={[styles.pillTxt, { color: ELEMENT_COLORS[boss.secondarySystem] }]}>
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
          <Text style={styles.loreText}>
            The Fading Core pulses at the heart of Clinica — a catastrophic convergence of every systemic failure the kingdom has faced. Air falters. River rages. Mind unravels. All at once.
          </Text>
          <Text style={styles.loreText}>
            Lord Imbalance is not a single disease — it is the cascade. To defeat it, your team must triage, prioritize, and act with disciplined clinical judgment under pressure.
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          {[
            { label: "SYSTEMS INVOLVED", val: "Air · River · Mind" },
            { label: "STAGES", val: "5 escalating phases" },
            { label: "DIFFICULTY", val: `★★★★★ (${boss.difficulty}/5)` },
            { label: "BEST COUNTERS", val: boss.bestCounters?.join(", ") ?? "Balanced team" },
          ].map((s) => (
            <View key={s.label} style={styles.statRow}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statVal}>{s.val}</Text>
            </View>
          ))}
        </View>

        {/* Warning */}
        <View style={styles.warningCard}>
          <Ionicons name="warning-outline" size={16} color={COLORS.error} />
          <Text style={styles.warningTxt}>
            Multi-system collapse. Read every clue. Choose one crisis at a time. The patient will deteriorate fast.
          </Text>
        </View>

        {/* CTA */}
        {bossUnlocked ? (
          <Pressable style={styles.enterBtn} onPress={enter} testID="boss-enter">
            <Text style={styles.enterTxt}>ENTER THE FADING CORE</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.onBrand} />
          </Pressable>
        ) : (
          <View style={styles.lockedCard}>
            <Ionicons name="lock-closed" size={22} color={COLORS.onSurfaceTertiary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lockedTitle}>The Fading Core is Sealed</Text>
              <Text style={styles.lockedSub}>Complete at least one shift to break the seal and confront Lord Imbalance.</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
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

  section: { padding: SPACING.lg, gap: SPACING.sm },
  sectionLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 2 },
  loreText: { color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 22 },

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
