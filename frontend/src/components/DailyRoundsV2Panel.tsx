import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { usePlayer } from "@/src/game/store";
import { getDailyEligibleActivities, resolveActivityAccess } from "@/src/game/activityRegistry";
import {
  DailyRoundsState, defaultDailyRoundsState, ensureFreshDailyRounds,
  allObjectivesComplete, formatCountdown, msUntilNextDay, summarizeReward,
  WEEKLY_GOAL_TARGET,
} from "@/src/game/dailyRounds";
import { playerLevelFromXp } from "@/src/game/progression";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const LEVEL_GATE = 2;
const MOMENTUM_MARKS = [2, 4, 5] as const;

export function DailyRoundsV2Panel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { player, claimDailyAllComplete, claimWeeklyAllComplete } = usePlayer();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const level = playerLevelFromXp(player?.xp ?? 0).level;
  const mature = level >= 5;
  const state: DailyRoundsState = useMemo(() => {
    if (!player) return defaultDailyRoundsState();
    return ensureFreshDailyRounds(
      player.daily_rounds,
      getDailyEligibleActivities(player),
      player.id,
      new Date(),
      mature,
    ).state;
  }, [player, mature]);

  const completed = state.objectives.filter((item) => item.progress >= item.target).length;
  const required = state.required_count ?? Math.min(mature ? 3 : 2, state.objectives.length);
  const dailyReady = allObjectivesComplete(state);
  const weeklyDays = Math.min(7, state.weekly_days_completed ?? 0);
  const weeklyClaimed = (state.weekly_momentum_claimed ?? []).includes("5");
  const locked = level < LEVEL_GATE;

  const go = (activityId?: string) => {
    if (!player || !activityId) return;
    const access = resolveActivityAccess(activityId, player);
    if (!access.allowed || !access.route) {
      setMessage(access.reason ?? "This opportunity is not available yet.");
      return;
    }
    onClose();
    router.push(access.route as any);
  };

  const claimDaily = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await claimDailyAllComplete();
      setMessage(result.ok ? `${result.message} ${result.reward ? `+${summarizeReward(result.reward)}` : ""}` : result.message);
    } finally {
      setBusy(false);
    }
  };

  const claimMomentum = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await claimWeeklyAllComplete();
      setMessage(result.ok ? `${result.message} ${result.reward ? `+${summarizeReward(result.reward)}` : ""}` : result.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>WARD OPERATIONS</Text>
              <Text style={styles.title}>Daily Rounds</Text>
              <Text style={styles.subtitle}>Complete meaningful care and learning activities. Access stays open after credit.</Text>
            </View>
            <Pressable style={styles.close} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={19} color={COLORS.onSurfaceSecondary} />
            </Pressable>
          </View>
          {!locked && (
            <View style={styles.refresh}>
              <Ionicons name="time-outline" size={13} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.refreshText}>New opportunities in {formatCountdown(msUntilNextDay())}</Text>
            </View>
          )}
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {locked ? (
              <View style={styles.empty}>
                <Ionicons name="lock-closed" size={28} color={COLORS.brand} />
                <Text style={styles.emptyTitle}>Unlocks at Level 2</Text>
                <Text style={styles.emptyBody}>Keep following your care pathway to unlock Daily Rounds.</Text>
              </View>
            ) : (
              <>
                <View style={[styles.target, dailyReady && styles.targetReady]}>
                  <View style={styles.targetIcon}><Ionicons name={dailyReady ? "checkmark-circle" : "compass"} size={20} color={dailyReady ? COLORS.success : COLORS.brand} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.targetKicker}>TODAY'S TARGET</Text>
                    <Text style={styles.targetTitle}>{completed}/{required} opportunities completed</Text>
                    <Text style={styles.targetBody}>{mature ? "Choose any 3 from today's board." : "Choose any 2 from today's board."}</Text>
                  </View>
                  {state.all_complete_claimed ? (
                    <Text style={styles.claimed}>CLAIMED</Text>
                  ) : dailyReady ? (
                    <Pressable style={styles.claim} disabled={busy} onPress={claimDaily}>
                      {busy ? <ActivityIndicator size="small" color={COLORS.onBrand} /> : <Text style={styles.claimText}>CLAIM +1</Text>}
                    </Pressable>
                  ) : null}
                </View>

                <Text style={styles.section}>OPPORTUNITIES</Text>
                {state.objectives.length === 0 ? (
                  <View style={styles.empty}>
                    <Ionicons name="sparkles-outline" size={24} color={COLORS.brand} />
                    <Text style={styles.emptyTitle}>Your board is preparing</Text>
                    <Text style={styles.emptyBody}>Finish an introduced activity and return for a board tailored to your unlocked pathway.</Text>
                  </View>
                ) : state.objectives.map((opportunity) => {
                  const done = opportunity.progress >= opportunity.target;
                  return (
                    <View key={opportunity.id} style={[styles.opportunity, done && styles.opportunityDone]}>
                      <View style={[styles.opportunityIcon, done && styles.opportunityIconDone]}>
                        <Ionicons name={(done ? "checkmark" : opportunity.icon) as any} size={17} color={done ? COLORS.success : COLORS.brand} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.opportunityTitle}>{opportunity.label}</Text>
                        <Text style={styles.opportunityBody}>{done ? "Completion credited for today's board." : opportunity.description}</Text>
                      </View>
                      {done ? <Text style={styles.done}>DONE</Text> : null}
                      <Pressable
                        style={styles.go}
                        accessibilityRole="button"
                        accessibilityLabel={`Go to ${opportunity.label}`}
                        onPress={() => go(opportunity.activity_id)}
                      >
                          <Text style={styles.goText}>GO</Text>
                          <Ionicons name="arrow-forward" size={12} color={COLORS.onBrand} />
                      </Pressable>
                    </View>
                  );
                })}

                <Text style={styles.section}>WEEKLY MOMENTUM</Text>
                <View style={styles.momentum}>
                  <Text style={styles.momentumTitle}>{weeklyDays}/7 distinct days</Text>
                  <Text style={styles.momentumBody}>Complete your Daily target on different days. Milestones celebrate a sustainable rhythm.</Text>
                  <View style={styles.marks}>
                    {MOMENTUM_MARKS.map((mark) => {
                      const reached = weeklyDays >= mark;
                      const claimed = (state.weekly_momentum_claimed ?? []).includes(String(mark));
                      return (
                        <View key={mark} style={[styles.mark, reached && styles.markReached]}>
                          <Ionicons name={reached ? "checkmark-circle" : "ellipse-outline"} size={14} color={reached ? COLORS.success : COLORS.onSurfaceTertiary} />
                          <Text style={[styles.markText, reached && styles.markTextReached]}>{mark === 5 ? "5 days · +5 Stamina" : `${mark} days`}</Text>
                          {mark === 5 && reached && !claimed && (
                            <Pressable style={styles.claim} disabled={busy} onPress={claimMomentum}>
                              <Text style={styles.claimText}>CLAIM</Text>
                            </Pressable>
                          )}
                          {mark === 5 && claimed && <Text style={styles.claimed}>CLAIMED</Text>}
                        </View>
                      );
                    })}
                  </View>
                  {!weeklyClaimed && weeklyDays < WEEKLY_GOAL_TARGET && (
                    <Text style={styles.momentumHint}>{WEEKLY_GOAL_TARGET - weeklyDays} more completed day{WEEKLY_GOAL_TARGET - weeklyDays === 1 ? "" : "s"} for the weekly Stamina recovery.</Text>
                  )}
                </View>
                {message && (
                  <Pressable style={styles.notice} onPress={() => setMessage(null)}>
                    <Ionicons name="information-circle-outline" size={15} color={COLORS.brand} />
                    <Text style={styles.noticeText}>{message}</Text>
                  </Pressable>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#000000A8", justifyContent: "flex-end" },
  card: { maxHeight: "90%", backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border },
  header: { flexDirection: "row", gap: SPACING.sm, padding: SPACING.lg, paddingBottom: SPACING.sm },
  kicker: { color: COLORS.brand, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "800", marginTop: 2 },
  subtitle: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17, marginTop: 5, maxWidth: 330 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceSecondary },
  refresh: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  refreshText: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  content: { padding: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.sm },
  target: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.brand + "14", borderWidth: 1, borderColor: COLORS.brand + "45" },
  targetReady: { backgroundColor: COLORS.success + "12", borderColor: COLORS.success + "55" },
  targetIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceSecondary },
  targetKicker: { color: COLORS.brand, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  targetTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "800", marginTop: 1 },
  targetBody: { color: COLORS.onSurfaceSecondary, fontSize: 11, marginTop: 2 },
  section: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginTop: SPACING.md, marginBottom: 2 },
  opportunity: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border },
  opportunityDone: { borderColor: COLORS.success + "66", backgroundColor: COLORS.success + "0F" },
  opportunityIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.brand + "18" },
  opportunityIconDone: { backgroundColor: COLORS.success + "18" },
  opportunityTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700" },
  opportunityBody: { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 15, marginTop: 2 },
  go: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: COLORS.brand },
  goText: { color: COLORS.onBrand, fontSize: 10, fontWeight: "800" },
  done: { color: COLORS.success, fontSize: 10, fontWeight: "800" },
  claim: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: COLORS.brand, minWidth: 64, alignItems: "center" },
  claimText: { color: COLORS.onBrand, fontSize: 10, fontWeight: "800" },
  claimed: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "800" },
  momentum: { padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border },
  momentumTitle: { color: COLORS.onSurface, fontSize: 15, fontWeight: "800" },
  momentumBody: { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 15, marginTop: 3 },
  marks: { gap: 6, marginTop: SPACING.sm },
  mark: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 4 },
  markReached: { backgroundColor: COLORS.success + "0D" },
  markText: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "600", flex: 1 },
  markTextReached: { color: COLORS.success },
  momentumHint: { color: COLORS.onSurfaceTertiary, fontSize: 10, marginTop: 7 },
  notice: { flexDirection: "row", gap: 7, alignItems: "flex-start", marginTop: SPACING.sm, padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.brand + "12" },
  noticeText: { flex: 1, color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 15 },
  empty: { alignItems: "center", gap: 7, padding: SPACING.xl, backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  emptyTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: "800" },
  emptyBody: { color: COLORS.onSurfaceSecondary, fontSize: 11, textAlign: "center", lineHeight: 16 },
});