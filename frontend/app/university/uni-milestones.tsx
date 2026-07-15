import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { goBack } from "@/src/utils/navigation";
import { usePlayer } from "@/src/game/store";
import {
  UNI_PRACTICE_MILESTONES, UniPracticeMilestone, AllActivityType,
  scrollLabel, itemLabel,
} from "@/src/game/uniPractice";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const ACTIVITY_COLOR: Record<AllActivityType, string> = {
  cue_lab:      '#2DD4BF',
  triage:       '#F59E0B',
  stack:        '#22D3EE',
  lotus_lesson: '#A78BFA',
};
const ACTIVITY_LABEL: Record<AllActivityType, string> = {
  cue_lab:      'Clinical Cue Lab',
  triage:       'Rapid Triage Hall',
  stack:        'Stabilize Stack Lab',
  lotus_lesson: 'Lotus Lessons',
};

export default function UniMilestonesScreen() {
  const router = useRouter();
  const { player } = usePlayer();

  if (!player) return null;

  const claimed   = player.uni_practice_milestones_claimed ?? [];
  const cueCount  = player.uni_cue_lab_count ?? 0;
  const triCount  = player.uni_triage_count ?? 0;
  const stkCount  = player.uni_stack_count ?? 0;
  const lotusCount = (player.lessons_completed ?? []).length;

  function getCount(type: AllActivityType) {
    if (type === 'cue_lab')      return cueCount;
    if (type === 'triage')       return triCount;
    if (type === 'stack')        return stkCount;
    if (type === 'lotus_lesson') return lotusCount;
    return 0;
  }

  const sections: Array<{ type: AllActivityType; milestones: UniPracticeMilestone[] }> = [
    { type: 'cue_lab',      milestones: UNI_PRACTICE_MILESTONES.filter((m) => m.activityType === 'cue_lab')      },
    { type: 'triage',       milestones: UNI_PRACTICE_MILESTONES.filter((m) => m.activityType === 'triage')       },
    { type: 'stack',        milestones: UNI_PRACTICE_MILESTONES.filter((m) => m.activityType === 'stack')        },
    { type: 'lotus_lesson', milestones: UNI_PRACTICE_MILESTONES.filter((m) => m.activityType === 'lotus_lesson') },
  ];

  const totalClaimed   = claimed.length;
  const totalMilestones = UNI_PRACTICE_MILESTONES.length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.hero}>
        <LinearGradient colors={[COLORS.brandTertiary, COLORS.surface]} style={StyleSheet.absoluteFillObject} />
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/university")} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={COLORS.onSurface} />
        </Pressable>
        <View style={styles.heroInner}>
          <Ionicons name="trophy-outline" size={28} color="#D4AF37" />
          <Text style={styles.kicker}>CLINICA UNIVERSITY</Text>
          <Text style={styles.title}>Practice Milestones</Text>
          <Text style={styles.sub}>Track your progress across all University practice activities.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Overall progress summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Ionicons name="trophy-outline" size={20} color="#D4AF37" />
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>MILESTONES EARNED</Text>
              <Text style={styles.summaryValue}>{totalClaimed} / {totalMilestones}</Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(totalClaimed / totalMilestones) * 100}%` as any }]} />
          </View>
        </View>

        <View style={styles.noteBox}>
          <Ionicons name="information-circle-outline" size={13} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.noteTxt}>
            Milestones are earned automatically when you reach activity thresholds. Rewards are granted instantly — no manual claim needed.
          </Text>
        </View>

        {sections.map(({ type, milestones }) => {
          const color = ACTIVITY_COLOR[type];
          const count = getCount(type);
          return (
            <View key={type} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: color }]} />
                <Text style={[styles.sectionLabel, { color }]}>{ACTIVITY_LABEL[type].toUpperCase()}</Text>
                <Text style={styles.sectionCount}>{count} sessions</Text>
              </View>

              {milestones.map((ms) => {
                const isClaimed = claimed.includes(ms.id);
                const isUnlocked = count >= ms.threshold;
                const progress = Math.min(1, count / ms.threshold);
                return (
                  <MilestoneRow
                    key={ms.id}
                    milestone={ms}
                    isClaimed={isClaimed}
                    isUnlocked={isUnlocked}
                    progress={progress}
                    color={color}
                  />
                );
              })}
            </View>
          );
        })}

        <View style={styles.footer}>
          <Text style={styles.footerTxt}>
            Milestone rewards include University Credits, Cue Scrolls, Triage Scrolls, Stabilization Scrolls, Lesson Notes, and rare Care Chain Manuals.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MilestoneRow({ milestone, isClaimed, isUnlocked, progress, color }: {
  milestone: UniPracticeMilestone;
  isClaimed: boolean;
  isUnlocked: boolean;
  progress: number;
  color: string;
}) {
  const r = milestone.rewards;

  // Build reward summary string
  const rewardParts: string[] = [];
  if (r.playerXp) rewardParts.push(`+${r.playerXp} XP`);
  rewardParts.push(`+${r.universityCredits} UC`);
  if (r.codexShards) rewardParts.push(`+${r.codexShards} Codex Shards`);
  if (r.inventory) {
    for (const [k, v] of Object.entries(r.inventory)) {
      rewardParts.push(`${v}× ${scrollLabel(k) !== k ? scrollLabel(k) : itemLabel(k)}`);
    }
  }

  return (
    <View style={[rowS.card,
      isClaimed  && rowS.cardClaimed,
      isUnlocked && !isClaimed && rowS.cardUnlocked,
    ]}>
      <View style={rowS.top}>
        <View style={[rowS.iconWrap, {
          backgroundColor: isClaimed ? '#34D39920' : isUnlocked ? color + '20' : COLORS.surfaceTertiary,
        }]}>
          <Ionicons
            name={isClaimed ? 'checkmark-circle' : isUnlocked ? 'trophy' : 'lock-closed'}
            size={16}
            color={isClaimed ? '#34D399' : isUnlocked ? color : COLORS.onSurfaceTertiary}
          />
        </View>
        <View style={rowS.info}>
          <Text style={[rowS.label, isClaimed && { color: '#34D399' }]}>{milestone.label}</Text>
          <Text style={rowS.desc}>{milestone.description}</Text>
        </View>
        {isClaimed && (
          <View style={rowS.earnedBadge}>
            <Text style={rowS.earnedTxt}>EARNED</Text>
          </View>
        )}
        {isUnlocked && !isClaimed && (
          <View style={[rowS.earnedBadge, { backgroundColor: color + '20' }]}>
            <Text style={[rowS.earnedTxt, { color }]}>AUTO-GRANTED</Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
      {!isClaimed && (
        <View style={rowS.progressBar}>
          <View style={[rowS.progressFill, { width: `${progress * 100}%` as any, backgroundColor: color }]} />
        </View>
      )}

      {/* Reward chips */}
      <View style={rowS.rewardRow}>
        {rewardParts.map((p) => (
          <View key={p} style={[rowS.chip, isClaimed && rowS.chipClaimed]}>
            <Text style={[rowS.chipTxt, isClaimed && { color: '#34D39980' }]}>{p}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const rowS = StyleSheet.create({
  card: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm },
  cardClaimed:  { borderColor: '#34D39930', backgroundColor: '#34D3990A' },
  cardUnlocked: { borderColor: '#D4AF3740', backgroundColor: '#D4AF3708' },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  iconWrap: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, gap: 2 },
  label: { color: COLORS.onSurface, fontSize: 13, fontWeight: '700' },
  desc: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15 },
  earnedBadge: { backgroundColor: '#34D39918', borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 3, flexShrink: 0 },
  earnedTxt: { color: '#34D399', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  progressBar: { height: 3, backgroundColor: COLORS.surfaceTertiary, borderRadius: 2 },
  progressFill: { height: 3, borderRadius: 2 },
  rewardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm, paddingHorizontal: 7, paddingVertical: 3 },
  chipClaimed: { opacity: 0.5 },
  chipTxt: { color: COLORS.onSurfaceSecondary, fontSize: 10, fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  hero: { padding: SPACING.lg, paddingTop: SPACING.xl, overflow: 'hidden' },
  heroInner: { alignItems: 'center', gap: 4 },
  kicker: { color: COLORS.brand, fontSize: 10, letterSpacing: 2, fontWeight: '700', marginTop: 6 },
  title: { color: COLORS.onSurface, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 60 },

  summaryCard: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#D4AF3740', padding: SPACING.md, gap: SPACING.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  summaryText: { flex: 1, gap: 1 },
  summaryLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  summaryValue: { color: '#D4AF37', fontSize: 18, fontWeight: '800' },
  progressBar: { height: 5, backgroundColor: COLORS.surfaceTertiary, borderRadius: 3 },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: '#D4AF37' },

  noteBox: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start', backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm, padding: SPACING.sm },
  noteTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, flex: 1, lineHeight: 16 },

  section: { gap: SPACING.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingTop: SPACING.xs },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, flex: 1 },
  sectionCount: { color: COLORS.onSurfaceTertiary, fontSize: 10 },

  footer: { paddingTop: SPACING.sm },
  footerTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
