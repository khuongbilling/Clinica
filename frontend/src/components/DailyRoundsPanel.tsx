import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { NarratorGuide } from "@/src/components/NarratorGuide";
import { InlineNotice, useInlineNotice } from "@/src/components/WebAlert";
import { usePlayer } from "@/src/game/store";
import { getUiIcon } from "@/src/game/uiIcons";
import { buildGateContext, checkFeatureGate, playerLevelFromXp } from "@/src/game/progression";
import {
  DailyReward, DailyRoundsState, defaultDailyRoundsState, ensureFreshDailyRounds,
  allObjectivesComplete, WEEKLY_GOAL_TARGET, WEEKLY_GOAL_REWARD, ALL_COMPLETE_BONUS,
  formatCountdown, msUntilNextDay, hasCheckedInToday, summarizeReward, streakRewardForDay,
} from "@/src/game/dailyRounds";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const SEEN_KEY = "clinica.dailyRounds.seen";
const DAILY_ROUNDS_MODES = ["ward_shift", "ward_defense", "university", "lotus_journal", "hall_of_heroes"];

function unlockedModes(player: any): string[] {
  const ctx = buildGateContext(player);
  return DAILY_ROUNDS_MODES.filter((m) => checkFeatureGate(m, ctx).unlocked);
}

/** Small reward chip row — Crowns image + Ionicons for the two gem currencies. */
function RewardChips({ reward, dim }: { reward: DailyReward; dim?: boolean }) {
  return (
    <View style={styles.rewardRow}>
      {reward.crowns ? (
        <View style={styles.rewardChip}>
          <ExpoImage source={getUiIcon("crowns")} style={styles.rewardIcon} contentFit="contain" />
          <Text style={[styles.rewardTxt, dim && styles.rewardTxtDim]}>{reward.crowns}</Text>
        </View>
      ) : null}
      {reward.codexShards ? (
        <View style={styles.rewardChip}>
          <Ionicons name="sparkles" size={13} color="#5B9BD5" />
          <Text style={[styles.rewardTxt, dim && styles.rewardTxtDim]}>{reward.codexShards}</Text>
        </View>
      ) : null}
      {reward.insightCrystals ? (
        <View style={styles.rewardChip}>
          <Ionicons name="diamond" size={12} color="#A78BFA" />
          <Text style={[styles.rewardTxt, dim && styles.rewardTxtDim]}>{reward.insightCrystals}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ProgressBar({ value, target, color = COLORS.brand }: { value: number; target: number; color?: string }) {
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  return (
    <View style={styles.barBg}>
      <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: color }]} />
    </View>
  );
}

// ── Journey Milestones — one-time achievement display (derived from player state, display-only) ──
interface JMilestone { id: string; label: string; description: string; icon: string; done: boolean }

function buildMilestones(player: any): JMilestone[] {
  const level = playerLevelFromXp(player?.xp ?? 0).level;
  const lessonsCompleted: string[] = player?.lessons_completed ?? [];
  const hasAnyLesson = lessonsCompleted.length > 0;
  const hasLotusLesson = lessonsCompleted.some((id: string) => id.startsWith('lotus:'));
  const hasWardShiftWin = (player?.runs_completed ?? 0) >= 1;
  const journalLogged = !!(
    (player as any)?.wellness_log?.entries?.length ||
    (player as any)?.wellness_log?.activities?.length ||
    (player as any)?.wellness_entries > 0
  );
  const hasRealm = Object.keys(player?.realm_buildings ?? {}).filter((k: string) => k !== 'atrium').length > 0;
  const chapter1Done = (player?.chapter_progress ?? 1) >= 2;

  return [
    { id: 'prologue',       label: 'Complete the Prologue',       description: 'Answer the first call and face the Infarct.',         icon: 'sparkles',      done: true },
    { id: 'university',     label: 'Begin at University',          description: 'Start your first Lotus Lesson.',                     icon: 'school-outline', done: hasAnyLesson },
    { id: 'first_lesson',   label: 'Complete a Lotus Lesson',      description: 'Finish a lesson in Vital Foundations.',              icon: 'leaf',           done: hasLotusLesson },
    { id: 'ward_shift_win', label: 'Win Your First Ward Shift',    description: 'Purify a disease in a clinical case.',               icon: 'shield-checkmark-outline', done: hasWardShiftWin },
    { id: 'journal',        label: 'Log a Journal Entry',          description: 'Record your first Lotus Plate Journal activity.',    icon: 'journal-outline', done: journalLogged },
    { id: 'level_3',        label: 'Reach Level 3',                description: 'Grow your healer rank through victories.',           icon: 'trending-up',    done: level >= 3 },
    { id: 'ward_defense',   label: 'Unlock Ward Defense',          description: 'Reach Level 4 to guard the ward from waves.',        icon: 'git-network-outline', done: level >= 4 },
    { id: 'realm',          label: 'Build in the Realm',           description: 'Place your first structure in the Sanctuary.',      icon: 'business-outline', done: hasRealm },
    { id: 'chapter_1',      label: 'Complete Chapter 1',           description: 'Advance to Chapter 2 of the healing journey.',      icon: 'trophy-outline', done: chapter1Done },
  ];
}

function JourneyMilestones({ player }: { player: any }) {
  if (!player) return null;
  const milestones = buildMilestones(player);
  const doneCount = milestones.filter((m) => m.done).length;
  return (
    <View style={styles.milestonesWrap}>
      <View style={styles.milestonesProgress}>
        <Text style={styles.milestonesProgressTxt}>{doneCount} / {milestones.length} achieved</Text>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${Math.round((doneCount / milestones.length) * 100)}%` as any, backgroundColor: COLORS.brand }]} />
        </View>
      </View>
      {milestones.map((m) => (
        <View key={m.id} style={[styles.milestoneRow, m.done && styles.milestoneRowDone]}>
          <View style={[styles.milestoneIcon, m.done && styles.milestoneIconDone]}>
            <Ionicons name={(m.done ? 'checkmark' : m.icon) as any} size={14} color={m.done ? COLORS.success : COLORS.onSurfaceTertiary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.milestoneLabel, m.done && styles.milestoneLabelDone]}>{m.label}</Text>
            <Text style={styles.milestoneDesc}>{m.description}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function DailyRoundsPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { player, checkInDailyRounds, claimDailyObjective, claimDailyAllComplete, claimWeeklyGoal } = usePlayer();
  const { notice, flashNotice } = useInlineNotice();
  const [showExplainer, setShowExplainer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const checkedInThisOpen = useRef(false);

  // Live "refreshes in" countdown — recompute every 30s while the panel is open.
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [visible]);

  // Auto check-in once per open, and show the first-time explainer.
  useEffect(() => {
    if (!visible || !player) return;
    let cancelled = false;
    (async () => {
      // First-time explainer (System-narrator tone), gated by a one-time flag.
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const seen = await AsyncStorage.getItem(SEEN_KEY);
      if (!cancelled && !seen) setShowExplainer(true);

      if (checkedInThisOpen.current) return;
      checkedInThisOpen.current = true;
      const res = await checkInDailyRounds();
      if (!cancelled && res && !res.alreadyCheckedIn && res.reward) {
        const label = res.streakReset
          ? `Welcome back! New streak started · +${summarizeReward(res.reward)}`
          : `Day ${res.streakDay} check-in · +${summarizeReward(res.reward)}`;
        flashNotice(label);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, player, checkInDailyRounds, flashNotice]);

  useEffect(() => {
    if (!visible) checkedInThisOpen.current = false;
  }, [visible]);

  // Display state — always show TODAY's freshly-rolled objectives even before
  // the async check-in has persisted, so the panel never flashes empty.
  const state: DailyRoundsState = useMemo(() => {
    if (!player) return defaultDailyRoundsState();
    return ensureFreshDailyRounds(player.daily_rounds, unlockedModes(player), player.id).state;
  }, [player]);

  const dismissExplainer = async () => {
    setShowExplainer(false);
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.setItem(SEEN_KEY, "1");
  };

  const runClaim = async (fn: () => Promise<{ ok: boolean; message: string }>) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fn();
      flashNotice(res.message);
    } finally {
      setBusy(false);
    }
  };

  const allComplete = allObjectivesComplete(state);
  const weeklyReached = state.weekly_days_completed >= WEEKLY_GOAL_TARGET;
  const checkedIn = hasCheckedInToday(state, new Date(now));
  const todayStreakReward = streakRewardForDay(Math.max(1, state.streak_count));

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>WARD OPERATIONS</Text>
              <Text style={styles.title}>Daily Ward Rounds</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10} testID="daily-rounds-close">
              <Ionicons name="close" size={18} color={COLORS.onSurfaceSecondary} />
            </Pressable>
          </View>

          <View style={styles.refreshRow}>
            <Ionicons name="time-outline" size={12} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.refreshTxt}>Objectives refresh in {formatCountdown(msUntilNextDay(new Date(now)))}</Text>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {showExplainer && (
              <View style={{ marginBottom: SPACING.sm }}>
                <NarratorGuide
                  name="System"
                  message="Ward Rounds reward you for showing up. Check in daily to build your streak, clear three rotating duties across the systems you've unlocked, and hit your weekly goal — all free."
                  objective="Check in each day and complete your three duties."
                  ctaLabel="Understood"
                  onPress={dismissExplainer}
                  testID="daily-rounds-explainer"
                />
              </View>
            )}

            {/* Streak */}
            <View style={styles.streakCard}>
              <View style={styles.streakFlame}>
                <Ionicons name="flame" size={26} color={COLORS.energy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.streakDays}>{state.streak_count}-Day Streak</Text>
                <Text style={styles.streakSub}>
                  {checkedIn ? "Checked in today · " : "Check in to continue · "}
                  Today: {summarizeReward(todayStreakReward)}
                </Text>
              </View>
              {checkedIn ? (
                <View style={styles.checkPill}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                  <Text style={styles.checkPillTxt}>DONE</Text>
                </View>
              ) : (
                <ActivityIndicator color={COLORS.brand} size="small" />
              )}
            </View>

            {/* Objectives */}
            <Text style={styles.sectionLabel}>TODAY'S DUTIES</Text>
            {state.objectives.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTxt}>
                  Unlock more wards to receive daily duties. Keep progressing through the University and beyond.
                </Text>
              </View>
            ) : (
              state.objectives.map((o) => {
                const complete = o.progress >= o.target;
                return (
                  <View key={o.id} style={styles.objCard}>
                    <View style={[styles.objIcon, complete && styles.objIconDone]}>
                      <Ionicons name={o.icon as any} size={18} color={complete ? COLORS.success : COLORS.brand} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.objTopRow}>
                        <Text style={styles.objLabel}>{o.label}</Text>
                        <Text style={styles.objCount}>{Math.min(o.progress, o.target)}/{o.target}</Text>
                      </View>
                      <Text style={styles.objDesc}>{o.description}</Text>
                      <ProgressBar value={o.progress} target={o.target} color={complete ? COLORS.success : COLORS.brand} />
                      <View style={styles.objBottomRow}>
                        <RewardChips reward={o.reward} dim={o.claimed} />
                        {o.claimed ? (
                          <View style={styles.claimedPill}>
                            <Ionicons name="checkmark" size={12} color={COLORS.onSurfaceTertiary} />
                            <Text style={styles.claimedTxt}>CLAIMED</Text>
                          </View>
                        ) : complete ? (
                          <Pressable
                            style={styles.claimBtn}
                            disabled={busy}
                            onPress={() => runClaim(() => claimDailyObjective(o.id))}
                            testID={`daily-claim-${o.id}`}
                          >
                            <Text style={styles.claimBtnTxt}>CLAIM</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })
            )}

            {/* All-complete bonus */}
            {state.objectives.length > 0 && (
              <View style={[styles.bonusCard, allComplete && styles.bonusCardReady]}>
                <Ionicons
                  name={state.all_complete_claimed ? "trophy" : allComplete ? "trophy" : "trophy-outline"}
                  size={20}
                  color={allComplete ? COLORS.energy : COLORS.onSurfaceTertiary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bonusTitle}>All Duties Bonus</Text>
                  <RewardChips reward={ALL_COMPLETE_BONUS} dim={state.all_complete_claimed} />
                </View>
                {state.all_complete_claimed ? (
                  <View style={styles.claimedPill}>
                    <Ionicons name="checkmark" size={12} color={COLORS.onSurfaceTertiary} />
                    <Text style={styles.claimedTxt}>CLAIMED</Text>
                  </View>
                ) : allComplete ? (
                  <Pressable
                    style={styles.claimBtn}
                    disabled={busy}
                    onPress={() => runClaim(claimDailyAllComplete)}
                    testID="daily-claim-all"
                  >
                    <Text style={styles.claimBtnTxt}>CLAIM</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.lockHint}>Finish all</Text>
                )}
              </View>
            )}

            {/* Weekly goal */}
            <Text style={styles.sectionLabel}>WEEKLY GOAL</Text>
            <View style={styles.weeklyCard}>
              <View style={styles.weeklyTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.weeklyTitle}>Complete rounds {WEEKLY_GOAL_TARGET} days this week</Text>
                  <Text style={styles.weeklySub}>{state.weekly_days_completed}/{WEEKLY_GOAL_TARGET} days complete</Text>
                </View>
                {state.weekly_claimed ? (
                  <View style={styles.claimedPill}>
                    <Ionicons name="checkmark" size={12} color={COLORS.onSurfaceTertiary} />
                    <Text style={styles.claimedTxt}>CLAIMED</Text>
                  </View>
                ) : weeklyReached ? (
                  <Pressable
                    style={styles.claimBtn}
                    disabled={busy}
                    onPress={() => runClaim(claimWeeklyGoal)}
                    testID="daily-claim-weekly"
                  >
                    <Text style={styles.claimBtnTxt}>CLAIM</Text>
                  </Pressable>
                ) : null}
              </View>
              <ProgressBar value={state.weekly_days_completed} target={WEEKLY_GOAL_TARGET} color={COLORS.energy} />
              <RewardChips reward={WEEKLY_GOAL_REWARD} dim={state.weekly_claimed} />
            </View>

            {/* Journey Milestones */}
            <Text style={styles.sectionLabel}>JOURNEY MILESTONES</Text>
            <JourneyMilestones player={player} />

            <Text style={styles.footNote}>
              All rewards are free — no purchases involved. Duties are drawn only from wards you've unlocked.
            </Text>
          </ScrollView>

          <InlineNotice notice={notice} icon="gift" testID="daily-rounds-notice" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(4,6,10,0.72)", justifyContent: "flex-end" },
  card: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingBottom: SPACING.lg,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: 2,
  },
  kicker: { color: COLORS.brand, fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 22, fontWeight: "300", marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center",
  },
  refreshRow: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  refreshTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, gap: SPACING.sm },

  streakCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.energy + "14", borderWidth: 1, borderColor: COLORS.energy + "44",
    borderRadius: RADIUS.lg, padding: SPACING.md,
  },
  streakFlame: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.energy + "22",
    alignItems: "center", justifyContent: "center",
  },
  streakDays: { color: COLORS.onSurface, fontSize: 17, fontWeight: "700" },
  streakSub: { color: COLORS.onSurfaceSecondary, fontSize: 11, marginTop: 2, lineHeight: 15 },
  checkPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.success + "1E", borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  checkPillTxt: { color: COLORS.success, fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  sectionLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 2, marginTop: SPACING.sm },

  emptyBox: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  emptyTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },

  objCard: {
    flexDirection: "row", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  objIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.brand + "18",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  objIconDone: { backgroundColor: COLORS.success + "1E" },
  objTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  objLabel: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700", flex: 1 },
  objCount: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
  objDesc: { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 15 },
  objBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },

  rewardRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
  rewardChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  rewardIcon: { width: 15, height: 15 },
  rewardTxt: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700" },
  rewardTxtDim: { color: COLORS.onSurfaceTertiary, fontWeight: "600" },

  claimBtn: { backgroundColor: COLORS.brand, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 6 },
  claimBtnTxt: { color: COLORS.onBrand, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  claimedPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 5 },
  claimedTxt: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  lockHint: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontStyle: "italic" },

  bonusCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  bonusCardReady: { borderColor: COLORS.energy + "55", backgroundColor: COLORS.energy + "12" },
  bonusTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700", marginBottom: 3 },

  weeklyCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm,
  },
  weeklyTopRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  weeklyTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700" },
  weeklySub: { color: COLORS.onSurfaceSecondary, fontSize: 11, marginTop: 2 },

  barBg: { height: 6, borderRadius: 3, backgroundColor: COLORS.border, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },

  footNote: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontStyle: "italic", lineHeight: 14, marginTop: SPACING.sm },

  milestonesWrap: { gap: SPACING.xs },
  milestonesProgress: { gap: 5, marginBottom: SPACING.xs },
  milestonesProgressTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700" },
  milestoneRow: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, opacity: 0.7,
  },
  milestoneRowDone: { borderColor: COLORS.success + "35", backgroundColor: COLORS.success + "0C", opacity: 1 },
  milestoneIcon: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.surfaceTertiary,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  milestoneIconDone: { backgroundColor: COLORS.success + "1A" },
  milestoneLabel: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },
  milestoneLabelDone: { color: COLORS.onSurface },
  milestoneDesc: { color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 14, marginTop: 1 },
});
