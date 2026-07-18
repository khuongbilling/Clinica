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
import { getLessonBanner, getSchoolBanner } from "@/src/game/illustratedAssets";

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

// ── V7: Wide illustrated banner lesson card ───────────────────────────────────
function LessonPathCard({
  node, done, isNext, locked, onPress,
}: { node: LotusLessonNode; done: boolean; isNext: boolean; locked: boolean; onPress: () => void }) {
  const meta = NODE_META[node.id] ?? { icon: 'leaf-outline', color: '#06B6D4', label: 'Lesson' };
  const accentColor = done ? '#34D399' : locked ? '#3A4A55' : meta.color;
  const banner = getLessonBanner(node.id);

  return (
    <Pressable
      disabled={locked}
      onPress={onPress}
      testID={`lotus-node-${node.id}`}
      style={[
        bannerStyles.card,
        locked && { opacity: 0.52 },
        isNext && !done && { borderColor: meta.color + '90' },
        done && { borderColor: '#34D39940' },
      ]}
    >
      {/* Illustrated banner background */}
      {banner ? (
        <Image
          source={banner}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: accentColor + '22' }]} />
      )}

      {/* Art-zone scrim: light overlay on the top two-thirds */}
      <View style={bannerStyles.scrimTop} />
      {/* Text-zone scrim: heavy dark gradient on the bottom third */}
      <View style={bannerStyles.scrimBottom} />

      {/* Content layer */}
      <View style={bannerStyles.content}>

        {/* ── Top row: topic pill + status badge ── */}
        <View style={bannerStyles.topRow}>
          <View style={[bannerStyles.topicPill, { backgroundColor: '#00000055', borderColor: accentColor + '80' }]}>
            <Text style={[bannerStyles.topicTxt, { color: accentColor }]}>
              {meta.label.toUpperCase()}
            </Text>
          </View>

          {done && (
            <View style={[bannerStyles.statusBadge, { backgroundColor: '#34D39922', borderColor: '#34D39966' }]}>
              <Ionicons name="checkmark-circle" size={11} color="#34D399" />
              <Text style={[bannerStyles.statusTxt, { color: '#34D399' }]}>CLEARED</Text>
            </View>
          )}
          {isNext && !done && !locked && (
            <View style={[bannerStyles.statusBadge, { backgroundColor: meta.color + '25', borderColor: meta.color + '80' }]}>
              <Ionicons name="play-circle" size={11} color={meta.color} />
              <Text style={[bannerStyles.statusTxt, { color: meta.color }]}>ACTIVE</Text>
            </View>
          )}
          {locked && (
            <View style={[bannerStyles.statusBadge, { backgroundColor: '#00000055', borderColor: '#ffffff25' }]}>
              <Ionicons name="lock-closed" size={10} color="#ffffff77" />
              <Text style={[bannerStyles.statusTxt, { color: '#ffffff77' }]}>LOCKED</Text>
            </View>
          )}
        </View>

        {/* ── Bottom block: title + subtitle + rewards + CTA ── */}
        <View style={bannerStyles.bottomBlock}>
          <Text style={bannerStyles.title} numberOfLines={2}>{node.title}</Text>
          <Text style={bannerStyles.subtitle} numberOfLines={1}>{node.subtitle}</Text>

          {!locked && (
            <View style={bannerStyles.bottomRow}>
              {/* Reward chips */}
              <View style={bannerStyles.rewardRow}>
                <RewardPill icon="diamond-outline"     value={node.rewards.insightCrystals}  color="#A78BFA" />
                <RewardPill icon="cash-outline"        value={node.rewards.crowns}            color="#F59E0B" />
                <RewardPill icon="trending-up-outline" value={`+${node.rewards.xp} XP`}      color="#34D399" />
              </View>

              {/* Call-to-action */}
              {!done && (
                <View style={[
                  bannerStyles.ctaBtn,
                  isNext
                    ? { backgroundColor: meta.color }
                    : { backgroundColor: '#ffffff18', borderWidth: 1, borderColor: '#ffffff30' },
                ]}>
                  <Text style={[bannerStyles.ctaTxt, !isNext && { color: '#ffffffaa' }]}>
                    {isNext ? 'BEGIN' : 'STUDY'}
                  </Text>
                  <Ionicons name="chevron-forward" size={11} color={isNext ? '#fff' : '#ffffff88'} />
                </View>
              )}
              {done && (
                <View style={[bannerStyles.ctaBtn, { backgroundColor: '#34D39918', borderWidth: 1, borderColor: '#34D39944' }]}>
                  <Text style={[bannerStyles.ctaTxt, { color: '#34D399' }]}>REVIEW</Text>
                  <Ionicons name="refresh-outline" size={11} color="#34D399" />
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const bannerStyles = StyleSheet.create({
  card: {
    width: '100%', height: 172,
    borderRadius: RADIUS.md, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#FFFFFF18',
    backgroundColor: '#0B1825',
  },
  scrimTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: '62%',
    backgroundColor: 'rgba(10,20,30,0.30)',
  },
  scrimBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '52%',
    backgroundColor: 'rgba(8,16,26,0.82)',
  },
  content: {
    flex: 1, padding: SPACING.md,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  topicPill: {
    borderRadius: RADIUS.pill, borderWidth: 1,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  topicTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: RADIUS.pill, borderWidth: 1,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  statusTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  bottomBlock: { gap: 3 },
  title: {
    color: '#FFFFFF', fontSize: 20, fontWeight: '700', lineHeight: 26,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 18,
  },
  bottomRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 6,
  },
  rewardRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap',
  },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 5,
  },
  ctaTxt: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
});

// ── V8: Per-department accent colors ─────────────────────────────────────────
const DEPT_ACCENT: Record<string, string> = {
  assessment:        '#8B5CF6',
  airway:            '#7DD3FC',
  nutrition:         '#34D399',
  stabilization:     '#06B6D4',
  pharmacology:      '#F59E0B',
  emergency:         '#EF4444',
  mental_wellness:   '#A78BFA',
  chronic_disease:   '#10B981',
  professional_track:'#94A3B8',
};

// ── V8: Wide illustrated department banner card ───────────────────────────────
function DeptBannerCard({ d, completedLessons, onPress }: {
  d: { id: string; name: string; description: string; status: string };
  completedLessons: string[];
  onPress?: () => void;
}) {
  const isAvailable = d.status === 'available';
  const accent = DEPT_ACCENT[d.id] ?? COLORS.brand;
  const banner = getSchoolBanner(d.id);
  const deptLessons = isAvailable ? lessonsForDepartment(d.id) : [];
  const deptSims    = isAvailable ? simulationsForDepartment(d.id) : [];
  const doneCount   = deptLessons.filter((l) => completedLessons.includes(l.id)).length;
  const pct         = deptLessons.length ? Math.round((doneCount / deptLessons.length) * 100) : 0;

  return (
    <Pressable
      disabled={!isAvailable}
      onPress={onPress}
      testID={isAvailable ? `lessons-dept-${d.id}` : `lessons-dept-locked-${d.id}`}
      style={[
        deptBStyles.card,
        !isAvailable && { opacity: 0.56 },
        isAvailable && { borderColor: accent + '55' },
      ]}
    >
      {/* Illustrated background */}
      {banner ? (
        <Image source={banner} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: accent + '18' }]} />
      )}
      <View style={deptBStyles.scrimTop} />
      <View style={deptBStyles.scrimBottom} />

      {/* Content */}
      <View style={deptBStyles.content}>

        {/* Top row: SCHOOL label + open/soon badge */}
        <View style={deptBStyles.topRow}>
          <View style={[deptBStyles.schoolPill, { backgroundColor: '#00000066', borderColor: accent + '80' }]}>
            <Text style={[deptBStyles.schoolPillTxt, { color: accent }]}>SCHOOL</Text>
          </View>
          {isAvailable ? (
            <View style={[deptBStyles.statBadge, { backgroundColor: accent + '22', borderColor: accent + '66' }]}>
              <Ionicons name="library" size={9} color={accent} />
              <Text style={[deptBStyles.statBadgeTxt, { color: accent }]}>OPEN</Text>
            </View>
          ) : (
            <View style={[deptBStyles.statBadge, { backgroundColor: '#00000055', borderColor: '#ffffff22' }]}>
              <Ionicons name="time-outline" size={9} color="#ffffff88" />
              <Text style={[deptBStyles.statBadgeTxt, { color: '#ffffff88' }]}>COMING SOON</Text>
            </View>
          )}
        </View>

        {/* Bottom: name + desc + progress/meta */}
        <View style={deptBStyles.bottomBlock}>
          <Text style={deptBStyles.name} numberOfLines={1}>{d.name}</Text>
          <Text style={deptBStyles.desc} numberOfLines={1}>{d.description}</Text>

          {isAvailable && deptLessons.length > 0 && (
            <View style={deptBStyles.metaRow}>
              <Text style={deptBStyles.metaTxt}>
                {deptLessons.length} lesson{deptLessons.length !== 1 ? 's' : ''}
                {deptSims.length > 0 ? `  ·  ${deptSims.length} sim${deptSims.length !== 1 ? 's' : ''}` : ''}
              </Text>
              <View style={deptBStyles.progressBar}>
                <View style={[deptBStyles.progressFill, { width: `${pct}%` as any, backgroundColor: accent }]} />
              </View>
              <Text style={[deptBStyles.progressTxt, { color: accent }]}>{doneCount}/{deptLessons.length}</Text>
              <View style={[deptBStyles.ctaBtn, { backgroundColor: accent }]}>
                <Ionicons name="chevron-forward" size={13} color="#fff" />
              </View>
            </View>
          )}
          {!isAvailable && (
            <Text style={deptBStyles.soonCopy}>Unlocks in a future update</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const deptBStyles = StyleSheet.create({
  card: {
    width: '100%', height: 152,
    borderRadius: RADIUS.md, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#FFFFFF18',
    backgroundColor: '#0B1825',
  },
  scrimTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: '58%', backgroundColor: 'rgba(10,20,30,0.28)',
  },
  scrimBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '55%', backgroundColor: 'rgba(8,16,26,0.84)',
  },
  content: { flex: 1, padding: SPACING.md, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  schoolPill: {
    borderRadius: RADIUS.pill, borderWidth: 1,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  schoolPillTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  statBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: RADIUS.pill, borderWidth: 1,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  statBadgeTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  bottomBlock: { gap: 4 },
  name: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', lineHeight: 26 },
  desc: { color: 'rgba(255,255,255,0.70)', fontSize: 13, lineHeight: 18 },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 4, flexWrap: 'nowrap',
  },
  metaTxt: { color: 'rgba(255,255,255,0.60)', fontSize: 10, flexShrink: 1 },
  progressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressTxt: { fontSize: 10, fontWeight: '700' },
  ctaBtn: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  soonCopy: { color: 'rgba(255,255,255,0.42)', fontSize: 10, marginTop: 4, fontStyle: 'italic' },
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

          {DEPARTMENTS.map((d) => (
            <DeptBannerCard
              key={d.id}
              d={d}
              completedLessons={completedLessons}
              onPress={d.status === 'available'
                ? () => router.push(`/university/department/${d.id}` as any)
                : undefined}
            />
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
  sectionSub: { color: COLORS.onSurfaceSecondary, fontSize: 14, marginTop: 1, lineHeight: 19 },
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
