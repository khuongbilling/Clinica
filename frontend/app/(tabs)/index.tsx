import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APTITUDE_INFO, BOSS_LORD_IMBALANCE, ENEMIES, RANKS } from "@/src/game/content";
import { getEnemySprite } from "@/src/components/EnemySprites";
import { usePlayer } from "@/src/game/store";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function RunHome() {
  const router = useRouter();
  const { player } = usePlayer();

  const dailyShift = useMemo(() => {
    if (!player) return [];
    const starters = ENEMIES.filter((e) => e.difficulty <= 2);
    const advanced = ENEMIES.filter((e) => e.difficulty >= 3);
    const seed = (player.runs_completed || 0) % 5;
    const seed2 = (seed + 2) % 5;
    return [
      starters[seed % starters.length],
      starters[(seed + 1) % starters.length],
      advanced[seed2 % advanced.length],
    ];
  }, [player]);

  if (!player) return null;
  const apt = APTITUDE_INFO[player.aptitude];
  const nextRank = RANKS[player.rank_index + 1];
  const progress = nextRank ? Math.min(1, (player.xp - RANKS[player.rank_index].xpRequired) / (nextRank.xpRequired - RANKS[player.rank_index].xpRequired)) : 1;
  const bossUnlocked = (player.bosses_defeated?.length ?? 0) > 0 || player.runs_completed >= 1;

  const launchEncounter = (enemyId: string) => {
    router.push({ pathname: "/battle", params: { enemyId } });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Player header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>{apt.title.toUpperCase()} · {player.rank.toUpperCase()}</Text>
            <Text style={styles.welcome}>{player.name}</Text>
          </View>
          <View style={[styles.aptBadge, { borderColor: apt.color }]}>
            <Ionicons name={apt.icon as any} size={20} color={apt.color} />
          </View>
        </View>

        {/* XP bar */}
        <View style={styles.xpRow}>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.xpText}>{nextRank ? `${player.xp} / ${nextRank.xpRequired} XP` : "MAX RANK"}</Text>
        </View>

        {/* Boss card */}
        <Pressable
          style={styles.bossCard}
          onPress={() => bossUnlocked && launchEncounter(BOSS_LORD_IMBALANCE.id)}
          disabled={!bossUnlocked}
          testID="run-boss-card"
        >
          <Image
            source={getEnemySprite(BOSS_LORD_IMBALANCE.id) || { uri: "https://images.pexels.com/photos/27987438/pexels-photo-27987438.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" }}
            style={StyleSheet.absoluteFillObject}
            blurRadius={1}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["rgba(17,19,21,0.2)", "rgba(17,19,21,0.95)"]}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.bossInner}>
            <Text style={styles.bossKicker}>CHAPTER I BOSS</Text>
            <Text style={styles.bossName}>{BOSS_LORD_IMBALANCE.name}</Text>
            <Text style={styles.bossDesc}>
              Multi-system collapse. Air, River, Mind all faltering. Choose what matters most.
            </Text>
            <View style={styles.bossMeta}>
              <View style={styles.metaPill}><Text style={styles.metaTxt}>★ {BOSS_LORD_IMBALANCE.difficulty}/5</Text></View>
              <View style={styles.metaPill}><Text style={styles.metaTxt}>5 STAGES</Text></View>
              <View style={[styles.metaPill, { backgroundColor: ELEMENT_COLORS[BOSS_LORD_IMBALANCE.primarySystem] + "30" }]}>
                <Text style={[styles.metaTxt, { color: ELEMENT_COLORS[BOSS_LORD_IMBALANCE.primarySystem] }]}>{BOSS_LORD_IMBALANCE.primarySystem.toUpperCase()}</Text>
              </View>
            </View>
            <View style={[styles.bossCta, !bossUnlocked && styles.bossCtaLocked]}>
              {bossUnlocked ? (
                <>
                  <Text style={styles.bossCtaText} numberOfLines={1}>ENTER THE FADING CORE</Text>
                  <Ionicons name="arrow-forward" size={16} color={COLORS.onBrand} />
                </>
              ) : (
                <>
                  <Ionicons name="lock-closed" size={14} color={COLORS.onSurfaceSecondary} />
                  <Text style={styles.bossCtaLockedText} numberOfLines={1} adjustsFontSizeToFit>
                    COMPLETE 1 SHIFT TO UNLOCK
                  </Text>
                </>
              )}
            </View>
          </View>
        </Pressable>

        {/* Daily shift */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{"Today's Shift"}</Text>
          <Text style={styles.sectionSub}>3 encounters · {player.runs_completed} runs completed</Text>
        </View>

        {dailyShift.map((e, idx) => (
          <Pressable
            key={e.id + idx}
            style={styles.encCard}
            onPress={() => launchEncounter(e.id)}
            testID={`run-encounter-${e.id}`}
          >
            {getEnemySprite(e.id) ? (
              <View style={[styles.encThumbWrap, { borderColor: ELEMENT_COLORS[e.primarySystem] + "AA" }]}>
                <Image source={getEnemySprite(e.id)!} style={styles.encThumb} resizeMode="cover" />
              </View>
            ) : (
              <View style={[styles.encDot, { backgroundColor: ELEMENT_COLORS[e.primarySystem] }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.encName}>{e.name}</Text>
              <Text style={styles.encReal}>{e.realWorld}</Text>
              <View style={styles.encMeta}>
                <Text style={[styles.encSys, { color: ELEMENT_COLORS[e.primarySystem] }]}>{e.primarySystem.toUpperCase()}</Text>
                {e.secondarySystem && (
                  <>
                    <Text style={styles.encDot2}>·</Text>
                    <Text style={[styles.encSys, { color: ELEMENT_COLORS[e.secondarySystem] }]}>{e.secondarySystem.toUpperCase()}</Text>
                  </>
                )}
                <Text style={styles.encDot2}>·</Text>
                <Text style={styles.encDiff}>★{e.difficulty}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.onSurfaceTertiary} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxxl },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "600" },
  welcome: { color: COLORS.onSurface, fontSize: 26, fontWeight: "400", marginTop: 4 },
  aptBadge: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceSecondary },
  xpRow: { gap: 6 },
  xpBarBg: { height: 6, borderRadius: 3, backgroundColor: COLORS.surfaceSecondary, overflow: "hidden" },
  xpBarFill: { height: "100%", backgroundColor: COLORS.brand },
  xpText: { color: COLORS.onSurfaceTertiary, fontSize: 11, letterSpacing: 1 },

  bossCard: {
    height: 280, borderRadius: RADIUS.lg, overflow: "hidden",
    borderWidth: 1, borderColor: COLORS.brandTertiary,
  },
  bossInner: { flex: 1, padding: SPACING.lg, justifyContent: "flex-end", gap: SPACING.sm },
  bossKicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 3, fontWeight: "700" },
  bossName: { color: COLORS.onSurface, fontSize: 30, fontWeight: "300" },
  bossDesc: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 18 },
  bossMeta: { flexDirection: "row", gap: SPACING.sm, marginTop: 4 },
  metaPill: { backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  metaTxt: { color: COLORS.onSurface, fontSize: 10, letterSpacing: 1, fontWeight: "600" },
  bossCta: {
    flexDirection: "row", backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center",
    paddingVertical: 12, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, gap: SPACING.sm, marginTop: SPACING.sm,
  },
  bossCtaLocked: {
    backgroundColor: COLORS.surfaceTertiary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bossCtaText: { color: COLORS.onBrand, fontSize: 12, fontWeight: "700", letterSpacing: 2, textAlign: "center", flexShrink: 1 },
  bossCtaLockedText: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textAlign: "center", flexShrink: 1 },

  sectionHeader: { gap: 4, marginTop: SPACING.sm },
  sectionTitle: { color: COLORS.onSurface, fontSize: 20, fontWeight: "400" },
  sectionSub: { color: COLORS.onSurfaceTertiary, fontSize: 12 },

  encCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  encDot: { width: 8, height: 56, borderRadius: 4 },
  encThumbWrap: { width: 56, height: 56, borderRadius: RADIUS.md, borderWidth: 2, overflow: "hidden", backgroundColor: COLORS.surfaceTertiary },
  encThumb: { width: "100%", height: "100%" },
  encName: { color: COLORS.onSurface, fontSize: 16, fontWeight: "500" },
  encReal: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  encMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  encSys: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  encDot2: { color: COLORS.onSurfaceTertiary, fontSize: 10 },
  encDiff: { color: COLORS.brand, fontSize: 10, fontWeight: "700" },
});
