import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { goBack } from "@/src/utils/navigation";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BADGES, DEPARTMENTS, SAFETY_NOTE, lessonsForDepartment, simulationsForDepartment,
} from "@/src/game/lessons";
import { LOTUS_PATHS, isLotusNodeComplete, LotusLessonNode } from "@/src/game/lotusLessons";
import { usePlayer } from "@/src/game/store";
import { useClearTutorialOnExit } from "@/src/hooks/useClearTutorialOnExit";
import { useEffect, useRef } from "react";
import { completeObjective } from "@/src/game/objectiveProgress";
import { TutorialOverlay } from "@/src/components/TutorialOverlay";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── Topic metadata per lotus lesson node ──────────────────────────────────────
const NODE_META: Record<string, { icon: string; color: string; label: string }> = {
  'recognizing-cues-hydration': { icon: 'water-outline',       color: '#06B6D4', label: 'Hydration' },
  'fever-and-warmth':           { icon: 'thermometer-outline', color: '#F97316', label: 'Fever' },
  'breathing-basics':           { icon: 'pulse-outline',       color: '#B0DEFF', label: 'Breathing' },
};

// ── Tiny reward pill ──────────────────────────────────────────────────────────
function RewardPill({ icon, value, color }: { icon: string; value: string | number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Ionicons name={icon as any} size={10} color={color} />
      <Text style={{ fontSize: 10, fontWeight: '700', color }}>{value}</Text>
    </View>
  );
}

// ── Node icon PNGs ────────────────────────────────────────────────────────────
const NODE_ICONS = {
  story:    require("../../assets/map-nodes/node_story.png"),
  memory:   require("../../assets/map-nodes/node_memory.png"),
  reward:   require("../../assets/map-nodes/node_reward.png"),
};

// ── Individual lesson card in the path ───────────────────────────────────────
function LessonPathCard({
  node, done, isNext, locked, onPress,
}: { node: LotusLessonNode; done: boolean; isNext: boolean; locked: boolean; onPress: () => void }) {
  const meta = NODE_META[node.id] ?? { icon: 'leaf-outline', color: COLORS.brand, label: 'Lesson' };
  const accentColor = done ? COLORS.success : locked ? COLORS.border : meta.color;
  const nodeIcon = done ? NODE_ICONS.reward : NODE_ICONS.story;
  return (
    <Pressable
      disabled={locked}
      onPress={onPress}
      style={[
        lcStyles.card,
        { borderLeftColor: accentColor, opacity: locked ? 0.5 : 1 },
        isNext && !done && { backgroundColor: meta.color + '0C' },
      ]}
      testID={`lotus-node-${node.id}`}
    >
      {/* Node icon PNG (replaces icon circle) */}
      <View style={lcStyles.nodeIconWrap}>
        <Image
          source={nodeIcon}
          style={{ width: 46, height: 46 }}
          contentFit="contain"
        />
        {locked && (
          <View style={lcStyles.lockOverlay}>
            <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1, gap: 4 }}>
        {/* Top row: topic tag + status badge */}
        <View style={lcStyles.topRow}>
          <Text style={[lcStyles.topicTag, { color: locked ? COLORS.onSurfaceTertiary : accentColor }]}>
            {meta.label.toUpperCase()}
          </Text>
          {done && (
            <View style={lcStyles.donePill}>
              <Ionicons name="checkmark" size={9} color={COLORS.success} />
              <Text style={lcStyles.doneTxt}>DONE</Text>
            </View>
          )}
          {isNext && !done && !locked && (
            <View style={[lcStyles.startPill, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
              <Text style={[lcStyles.startTxt, { color: meta.color }]}>START</Text>
            </View>
          )}
          {locked && <Ionicons name="lock-closed" size={12} color={COLORS.onSurfaceTertiary} />}
        </View>

        {/* Title + subtitle */}
        <Text style={[lcStyles.title, locked && { color: COLORS.onSurfaceTertiary }]} numberOfLines={2}>
          {node.title}
        </Text>
        <Text style={lcStyles.sub} numberOfLines={1}>{node.subtitle}</Text>

        {/* Reward chips */}
        {!locked && (
          <View style={lcStyles.rewardRow}>
            <RewardPill icon="diamond-outline"  value={node.rewards.insightCrystals}               color="#A78BFA" />
            <RewardPill icon="cash-outline"     value={node.rewards.crowns}                        color={COLORS.energy} />
            <RewardPill icon="school-outline"   value={`${node.rewards.universityCredits} UC`}    color="#06B6D4" />
            <RewardPill icon="trending-up-outline" value={`+${node.rewards.xp} XP`}               color={COLORS.brand} />
          </View>
        )}
      </View>

      {!locked && !done && (
        <Ionicons name="chevron-forward" size={16} color={isNext ? meta.color : COLORS.onSurfaceTertiary} />
      )}
    </Pressable>
  );
}

const lcStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
    borderLeftWidth: 3,
  },
  nodeIconWrap: { width: 46, height: 46, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 6,
    backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  topicTag: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  donePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.success + '1A', borderRadius: RADIUS.pill, paddingHorizontal: 5, paddingVertical: 2,
  },
  doneTxt: { color: COLORS.success, fontSize: 9, fontWeight: '800' },
  startPill: { borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  startTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  title: { color: COLORS.onSurface, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 13 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flexWrap: 'wrap', marginTop: 2 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function LessonsHubScreen() {
  const router = useRouter();
  const { player, loading } = usePlayer();

  const lotusVisitRef = useRef(false);
  useEffect(() => {
    if (!player || lotusVisitRef.current) return;
    lotusVisitRef.current = true;
    completeObjective("obj_lotus_visited");
  }, [player?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useClearTutorialOnExit();

  if (loading || !player) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={[styles.hero, { backgroundColor: COLORS.brandTertiary }]}>
          <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} testID="lessons-back">
            <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
          </Pressable>
          <Text style={styles.kicker}>CLINICA UNIVERSITY</Text>
          <Text style={styles.title}>Lessons & Simulations</Text>
        </View>
        <View style={styles.fallback}>
          <ActivityIndicator color={COLORS.brand} />
        </View>
      </SafeAreaView>
    );
  }

  const badgeProgress = player.badge_progress || {};
  const completedLessons = player.lessons_completed || [];
  const available = DEPARTMENTS.filter((d) => d.status === "available");
  const comingSoon = DEPARTMENTS.filter((d) => d.status === "coming_soon");
  const vitalFoundations = LOTUS_PATHS.find((p) => p.id === "vital-foundations");
  const vfNodes = vitalFoundations?.nodes ?? [];
  const vfDone = vfNodes.filter(n => isLotusNodeComplete(player, n.id)).length;
  const firstIncompleteIdx = vfNodes.findIndex(n => n.status === 'available' && !isLotusNodeComplete(player, n.id));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={[styles.hero, { backgroundColor: COLORS.brandTertiary }]}>
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} testID="lessons-back">
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <Text style={styles.kicker}>CLINICA UNIVERSITY</Text>
        <Text style={styles.title}>Lessons & Simulations</Text>
        <Text style={styles.sub}>Quick lessons, clinical quizzes, and fantasy-medical challenges.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Vital Foundations path ─────────────────────────────────────── */}
        {vitalFoundations && (
          <View style={styles.section}>
            {/* Section header */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#06B6D41A' }]}>
                <Ionicons name="leaf" size={14} color="#06B6D4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{vitalFoundations.name}</Text>
                <Text style={styles.sectionSub}>{vitalFoundations.description}</Text>
              </View>
              <View style={styles.progressPill}>
                <Text style={styles.progressPillTxt}>{vfDone}/{vfNodes.length}</Text>
              </View>
            </View>

            {/* Path progress bar */}
            <View style={styles.pathBar}>
              <View style={[styles.pathBarFill, { width: `${Math.round((vfDone / Math.max(1, vfNodes.length)) * 100)}%` as any }]} />
            </View>

            {/* Lesson cards with connectors */}
            <View>
              {vfNodes.map((node, i) => {
                const locked = node.status !== 'available';
                const done = !locked && isLotusNodeComplete(player, node.id);
                const isNext = i === firstIncompleteIdx;
                return (
                  <View key={node.id}>
                    <LessonPathCard
                      node={node} done={done} isNext={isNext} locked={locked}
                      onPress={() => router.push(`/university/lotus-lesson/${node.id}` as any)}
                    />
                    {i < vfNodes.length - 1 && (
                      <View style={styles.connectorWrap}>
                        <View style={[styles.connectorLine, done && styles.connectorDone]} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Departments ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: COLORS.brand + '1A' }]}>
              <Ionicons name="library-outline" size={14} color={COLORS.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Departments</Text>
              <Text style={styles.sectionSub}>Advanced clinical departments</Text>
            </View>
          </View>

          {available.map((d) => {
            const lessons = lessonsForDepartment(d.id);
            const sims = simulationsForDepartment(d.id);
            const doneCount = lessons.filter((l) => completedLessons.includes(l.id)).length;
            const pct = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;
            return (
              <Pressable
                key={d.id}
                style={styles.deptCard}
                onPress={() => router.push(`/university/department/${d.id}` as any)}
                testID={`lessons-dept-${d.id}`}
              >
                <View style={styles.deptIcon}>
                  <Ionicons name={d.icon as any} size={22} color={COLORS.brand} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.deptName}>{d.name}</Text>
                  <Text style={styles.deptDesc} numberOfLines={1}>{d.description}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                    <Text style={styles.deptMeta}>{lessons.length} lessons · {sims.length} sims</Text>
                    <View style={styles.deptBar}><View style={[styles.deptBarFill, { width: `${pct}%` as any }]} /></View>
                    <Text style={styles.deptBarTxt}>{doneCount}/{lessons.length}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.onSurfaceTertiary} />
              </Pressable>
            );
          })}

          {comingSoon.map((d) => (
            <View key={d.id} style={[styles.deptCard, { opacity: 0.5 }]} testID={`lessons-dept-locked-${d.id}`}>
              <View style={[styles.deptIcon, { borderColor: COLORS.border, backgroundColor: COLORS.surfaceTertiary }]}>
                <Ionicons name={d.icon as any} size={22} color={COLORS.onSurfaceTertiary} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.deptNameDim}>{d.name}</Text>
                  <View style={styles.soonBadge}><Text style={styles.soonTxt}>SOON</Text></View>
                </View>
                <Text style={styles.deptDesc} numberOfLines={1}>{d.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Concept Badges ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: COLORS.warning + '1A' }]}>
              <Ionicons name="ribbon-outline" size={14} color={COLORS.warning} />
            </View>
            <Text style={styles.sectionTitle}>Concept Badges</Text>
          </View>
          <View style={styles.badgeGrid}>
            {BADGES.map((b) => {
              const progress = badgeProgress[b.id] || 0;
              const unlocked = progress >= b.goal;
              return (
                <View key={b.id} style={[styles.badgeTile, unlocked && styles.badgeTileUnlocked]} testID={`lessons-badge-${b.id}`}>
                  <View style={[styles.badgeIconWrap, unlocked && styles.badgeIconUnlocked]}>
                    <Ionicons name={b.icon as any} size={18} color={unlocked ? COLORS.brand : COLORS.onSurfaceTertiary} />
                  </View>
                  <Text style={[styles.badgeName, unlocked && { color: COLORS.brand }]} numberOfLines={2}>{b.name}</Text>
                  <View style={styles.badgeBar}>
                    <View style={[styles.badgeBarFill, { width: `${Math.round((Math.min(progress, b.goal) / b.goal) * 100)}%` as any }]} />
                  </View>
                  <Text style={styles.badgeCount}>{Math.min(progress, b.goal)}/{b.goal}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Safety note ────────────────────────────────────────────────── */}
        <View style={styles.safetyBox}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.safetyTxt}>{SAFETY_NOTE}</Text>
        </View>

      </ScrollView>
      <TutorialOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: 4 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)", marginBottom: SPACING.sm,
  },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: COLORS.onSurface, fontSize: 28, fontWeight: "300" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 14, marginTop: 2, lineHeight: 20 },
  scroll: { padding: SPACING.lg, gap: SPACING.xl, paddingBottom: SPACING.xxxl },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },

  // Section blocks
  section: { gap: SPACING.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  sectionIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  sectionTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: '700' },
  sectionSub: { color: COLORS.onSurfaceSecondary, fontSize: 13, marginTop: 1, lineHeight: 17 },
  progressPill: {
    backgroundColor: COLORS.brand + '1A', borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 2,
  },
  progressPillTxt: { color: COLORS.brand, fontSize: 11, fontWeight: '700' },

  // Path
  pathBar: { height: 4, borderRadius: 2, backgroundColor: COLORS.border },
  pathBarFill: { height: '100%', borderRadius: 2, backgroundColor: '#06B6D4' },
  connectorWrap: { alignItems: 'center' },
  connectorLine: { width: 2, height: 12, backgroundColor: COLORS.border },
  connectorDone: { backgroundColor: COLORS.success + '55' },

  // Departments
  deptCard: {
    flexDirection: "row", gap: SPACING.md, alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  deptIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surfaceTertiary, borderWidth: 1, borderColor: COLORS.brand + "40",
  },
  deptName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  deptNameDim: { color: COLORS.onSurfaceSecondary, fontSize: 14, fontWeight: "600" },
  deptDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  deptMeta: { color: COLORS.onSurfaceTertiary, fontSize: 10 },
  deptBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.border },
  deptBarFill: { height: '100%', borderRadius: 2, backgroundColor: COLORS.brand },
  deptBarTxt: { color: COLORS.brand, fontSize: 10, fontWeight: '700' },
  soonBadge: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.pill, paddingHorizontal: 5, paddingVertical: 2 },
  soonTxt: { color: COLORS.onSurfaceTertiary, fontSize: 8, fontWeight: "800" },

  // Badges
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  badgeTile: {
    width: "31%", borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.sm, alignItems: "center", gap: 5,
    backgroundColor: COLORS.surfaceSecondary, minHeight: 92, justifyContent: 'center',
  },
  badgeTileUnlocked: { borderColor: COLORS.brand + "55" },
  badgeIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.surfaceTertiary, alignItems: 'center', justifyContent: 'center',
  },
  badgeIconUnlocked: { backgroundColor: COLORS.brand + '1A' },
  badgeName: { color: COLORS.onSurfaceSecondary, fontSize: 10, fontWeight: "600", textAlign: "center", lineHeight: 13 },
  badgeBar: { width: '80%', height: 3, borderRadius: 2, backgroundColor: COLORS.border },
  badgeBarFill: { height: '100%', borderRadius: 2, backgroundColor: COLORS.brand },
  badgeCount: { color: COLORS.onSurfaceTertiary, fontSize: 9 },

  // Safety note
  safetyBox: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.sm, backgroundColor: COLORS.surfaceSecondary,
  },
  safetyTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 15 },
});
