import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ENEMIES } from "@/src/game/content";
import { ENEMY_CLINICAL } from "@/src/game/clinical";
import { getEnemySprite } from "@/src/components/EnemySprites";
import { QUEST_ICON } from "@/src/components/ModeBanners";
import { StaminaPill } from "@/src/components/StaminaPill";
import { usePlayer } from "@/src/game/store";
import { goBack } from "@/src/utils/navigation";
import {
  BOSS_ENCOUNTER_COST, ENCOUNTER_COST, formatCountdown, useLiveStamina,
} from "@/src/game/stamina";
import { chapterSimulationLabel } from "@/src/game/modeHub";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ─────────────────────────────────────────────────────────────
// TODAY'S SHIFT — the Daily Quests page reached from the Ward Shift intro.
// Instead of listing every possible case, it cycles through a small rotating
// set of "Daily Quests". Regular cases cost 1 Shift Challenge; the boss costs 5.
// ─────────────────────────────────────────────────────────────
export default function ShiftCasesPage() {
  const router = useRouter();
  const { player, spendStamina } = usePlayer();
  const { stamina, msUntilNext, max } = useLiveStamina(player);
  const launchingRef = useRef(false);
  const [index, setIndex] = useState(0);

  const dailyShift = useMemo(() => {
    if (!player) return [];
    const starters = ENEMIES.filter((e) => e.difficulty <= 2 && !e.worldBoss);
    const advanced = ENEMIES.filter((e) => e.difficulty >= 3 && !e.worldBoss);
    const seed = (player.runs_completed || 0) % 5;
    const seed2 = (seed + 2) % 5;
    return [
      starters[seed % starters.length],
      starters[(seed + 1) % starters.length],
      advanced[seed2 % advanced.length],
    ].filter(Boolean);
  }, [player]);

  if (!player) {
    return (
      <SafeAreaView style={[styles.root, styles.loading]} edges={["top", "bottom"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  const bossUnlocked = (player.bosses_defeated?.length ?? 0) > 0 || player.runs_completed >= 1;
  const canPlay = stamina >= ENCOUNTER_COST;
  const count = dailyShift.length;
  const current = dailyShift[index % Math.max(1, count)];

  const cycle = (dir: number) => {
    if (count === 0) return;
    setIndex((i) => (i + dir + count) % count);
  };

  const launchEncounter = async (enemyId: string) => {
    if (launchingRef.current) return;
    launchingRef.current = true;
    const ok = await spendStamina(ENCOUNTER_COST);
    if (!ok) {
      launchingRef.current = false;
      return;
    }
    router.push({ pathname: "/battle", params: { enemyId } });
    setTimeout(() => { launchingRef.current = false; }, 1000);
  };

  const accent = current ? (ELEMENT_COLORS[current.primarySystem] ?? COLORS.brand) : COLORS.brand;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/mode/ward-shift")} hitSlop={10} testID="shift-cases-back">
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>WARD SHIFT</Text>
          <Text style={styles.title}>Today's Shift</Text>
        </View>
        <StaminaPill player={player} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Challenge status */}
        <View style={styles.challengeBar}>
          <Ionicons name="flash" size={16} color={COLORS.brand} />
          <Text style={styles.challengeTxt}>
            <Text style={{ color: COLORS.onSurface, fontWeight: "800" }}>{stamina}/{max}</Text> Shift Challenges
          </Text>
          <View style={{ flex: 1 }} />
          {stamina < max ? (
            <Text style={styles.regenTxt}>+1 in {formatCountdown(msUntilNext)}</Text>
          ) : (
            <Text style={[styles.regenTxt, { color: COLORS.success }]}>Full</Text>
          )}
        </View>

        {/* Daily Quests header with donghua quest emblem */}
        <View style={styles.questHeader}>
          <ExpoImage source={QUEST_ICON} style={styles.questIcon} contentFit="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.questTitle}>Daily Quests</Text>
            <Text style={styles.questSub}>A rotating set of clinical cases — cycle through and choose one.</Text>
          </View>
        </View>

        {!canPlay && (
          <View style={styles.warn}>
            <Ionicons name="flash-off-outline" size={16} color={COLORS.error} />
            <Text style={styles.warnTxt}>
              You're out of Shift Challenges. Each case costs {ENCOUNTER_COST}. Next in {formatCountdown(msUntilNext)}.
            </Text>
          </View>
        )}

        {/* Cycling case card */}
        {current && (
          <View style={[styles.caseCard, { borderColor: accent + "55" }]}>
            <View style={styles.caseThumbWrap}>
              {getEnemySprite(current.id) ? (
                <>
                  <ExpoImage source={getEnemySprite(current.id)} style={StyleSheet.absoluteFillObject} contentFit="contain" />
                  <LinearGradient colors={["transparent", "rgba(12,14,18,0.85)"]} style={StyleSheet.absoluteFillObject} />
                </>
              ) : (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: accent + "20", alignItems: "center", justifyContent: "center" }]}>
                  <Ionicons name="medical" size={40} color={accent} />
                </View>
              )}
              <View style={styles.costBadge}>
                <Ionicons name="flash" size={11} color={COLORS.brand} />
                <Text style={styles.costBadgeTxt}>{ENCOUNTER_COST}</Text>
              </View>
              <View style={styles.caseCounter}>
                <Text style={styles.caseCounterTxt}>{(index % count) + 1} / {count}</Text>
              </View>
            </View>

            <View style={styles.caseBody}>
              <Text style={styles.chapterLabel}>
                CHAPTER {ENEMY_CLINICAL[current.id]?.chapter ?? 1} · UNIVERSITY SIMULATION: {chapterSimulationLabel(ENEMY_CLINICAL[current.id]?.chapter).toUpperCase()}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.caseSys, { color: accent }]}>{current.primarySystem.toUpperCase()}</Text>
                {current.secondarySystem && (
                  <Text style={[styles.caseSys, { color: (ELEMENT_COLORS[current.secondarySystem] ?? accent) + "AA" }]}>
                    · {current.secondarySystem.toUpperCase()}
                  </Text>
                )}
                <View style={styles.diffRow}>
                  {Array.from({ length: current.difficulty }).map((_, i) => (
                    <Ionicons key={i} name="star" size={9} color={COLORS.brand} />
                  ))}
                </View>
              </View>
              <Text style={styles.caseName}>{current.name}</Text>
              <Text style={styles.caseReal}>{current.realWorld}</Text>

              <Pressable
                style={[styles.beginBtn, { backgroundColor: canPlay ? accent : COLORS.surfaceTertiary }]}
                onPress={() => launchEncounter(current.id)}
                disabled={!canPlay}
                testID={`shift-encounter-${current.id}`}
              >
                <Text style={[styles.beginTxt, { color: canPlay ? COLORS.onBrand : COLORS.onSurfaceTertiary }]}>
                  {canPlay ? "Begin Case" : "No Challenges"}
                </Text>
                {canPlay && <Ionicons name="enter-outline" size={16} color={COLORS.onBrand} />}
              </Pressable>
            </View>

            {/* Cycle controls */}
            {count > 1 && (
              <>
                <Pressable style={[styles.arrow, styles.arrowLeft]} onPress={() => cycle(-1)} hitSlop={8} testID="shift-cases-prev">
                  <Ionicons name="chevron-back" size={22} color="#fff" />
                </Pressable>
                <Pressable style={[styles.arrow, styles.arrowRight]} onPress={() => cycle(1)} hitSlop={8} testID="shift-cases-next">
                  <Ionicons name="chevron-forward" size={22} color="#fff" />
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Dots */}
        {count > 1 && (
          <View style={styles.dots}>
            {dailyShift.map((_, i) => (
              <View key={i} style={[styles.dot, i === index % count && { backgroundColor: accent, width: 18 }]} />
            ))}
          </View>
        )}

        {/* Boss quest */}
        {bossUnlocked && (
          <>
            <Text style={styles.section}>Special Quest</Text>
            <Pressable style={styles.bossCard} onPress={() => router.push("/boss")} testID="shift-cases-boss">
              <View style={[styles.bossIcon, { borderColor: COLORS.error + "70", backgroundColor: COLORS.error + "1E" }]}>
                <Ionicons name="flame" size={22} color={COLORS.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bossTitle}>Boss Ward</Text>
                <Text style={styles.bossSub}>A major pathology encounter with higher stakes.</Text>
              </View>
              <View style={styles.bossCost}>
                <Ionicons name="flash" size={12} color={COLORS.brand} />
                <Text style={styles.bossCostTxt}>{BOSS_ENCOUNTER_COST}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.error} />
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg, paddingBottom: SPACING.sm },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  kicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300", marginTop: 2 },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.md, paddingBottom: SPACING.xxxl },

  challengeBar: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  challengeTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13 },
  regenTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "600" },

  questHeader: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  questIcon: { width: 56, height: 56 },
  questTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: "800" },
  questSub: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 16, marginTop: 1 },

  warn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.error + "18", borderWidth: 1, borderColor: COLORS.error + "50",
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  warnTxt: { color: COLORS.onSurface, fontSize: 12, lineHeight: 18, flex: 1 },

  caseCard: {
    borderRadius: RADIUS.lg, borderWidth: 1.5, overflow: "hidden",
    backgroundColor: COLORS.surfaceSecondary,
  },
  caseThumbWrap: { height: 180, backgroundColor: COLORS.surfaceTertiary, overflow: "hidden" },
  costBadge: {
    position: "absolute", top: SPACING.sm, right: SPACING.sm,
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(12,14,18,0.7)", borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3,
  },
  costBadgeTxt: { color: COLORS.brand, fontSize: 11, fontWeight: "800" },
  caseCounter: {
    position: "absolute", top: SPACING.sm, left: SPACING.sm,
    backgroundColor: "rgba(12,14,18,0.7)", borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3,
  },
  caseCounterTxt: { color: "#fff", fontSize: 10, fontWeight: "700" },
  caseBody: { padding: SPACING.md, gap: 5 },
  chapterLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  caseSys: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  diffRow: { flexDirection: "row", gap: 2, marginLeft: 2 },
  caseName: { color: COLORS.onSurface, fontSize: 20, fontWeight: "600" },
  caseReal: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginBottom: SPACING.xs },
  beginBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: RADIUS.md, paddingVertical: SPACING.md, marginTop: SPACING.xs,
  },
  beginTxt: { fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  arrow: {
    position: "absolute", top: 70,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(12,14,18,0.55)", alignItems: "center", justifyContent: "center",
  },
  arrowLeft: { left: SPACING.sm },
  arrowRight: { right: SPACING.sm },

  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: -SPACING.xs },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.border },

  section: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginTop: SPACING.md, marginBottom: 2 },
  bossCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.error + "45", padding: SPACING.md,
  },
  bossIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  bossTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "700" },
  bossSub: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15 },
  bossCost: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 4,
  },
  bossCostTxt: { color: COLORS.brand, fontSize: 12, fontWeight: "800" },
});
