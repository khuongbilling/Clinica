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
  DailyReward, DailyRoundsState, WeeklyTaskState, defaultDailyRoundsState, ensureFreshDailyRounds,
  allObjectivesComplete, allWeeklyTasksComplete, ALL_COMPLETE_BONUS, WEEKLY_ALL_COMPLETE_REWARD,
  WEEKLY_TASKS, QUEST_MILESTONES,
  formatCountdown, msUntilNextDay, hasCheckedInToday, summarizeReward, streakRewardForDay,
} from "@/src/game/dailyRounds";
import { CHAPTERS } from "@/src/game/chapterJourney";
import { getJourneyNodeDef } from "@/src/game/journeyRewards";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── Journey-map helpers (P3) ──────────────────────────────────────────────────

const NODE_TYPE_ICON: Record<string, string> = {
  memory_fragment: "film-outline",
  challenge:       "shuffle-outline",
  battle:          "medical-outline",
  mini_boss:       "skull-outline",
  reflection:      "alert-circle-outline",
  story:           "book-outline",
  ward_defense:    "shield-half-outline",
  realm:           "home-outline",
};

const NODE_TYPE_LABEL: Record<string, string> = {
  memory_fragment: "Memory",
  challenge:       "Challenge",
  battle:          "Ward Shift",
  mini_boss:       "Chapter Trial",
  reflection:      "Reflection",
  story:           "Story",
  ward_defense:    "Defense",
  realm:           "Realm",
};

function getNextJourneyNode(
  player: any,
): { id: string; title: string; type: string } | null {
  const claimed: string[] = player?.claimed_journey_nodes ?? [];
  const chapterNum: number = player?.chapter_progress ?? 1;
  const chapter = CHAPTERS.find((c) => c.number === chapterNum);
  if (!chapter) return null;
  for (const part of chapter.parts) {
    if (!claimed.includes(part.id) && getJourneyNodeDef(part.id)) {
      return { id: part.id, title: part.title, type: part.type };
    }
  }
  return null;
}

function getNextMilestoneTeaser(player: any): typeof QUEST_MILESTONES[number] | null {
  const claimed: string[] = player?.claimed_daily_milestones ?? [];
  // First unclaimed milestone that is NOT yet done (upcoming, shows as a climax teaser)
  return (
    QUEST_MILESTONES.find((m) => !claimed.includes(m.id) && !m.isDone(player)) ?? null
  );
}

/** P13: Returns a short proximity hint when a major moment is 1–2 nodes away. */
function getJourneyProximityHint(player: any): string | null {
  const claimed: string[] = player?.claimed_journey_nodes ?? [];
  const chapterNum: number = player?.chapter_progress ?? 1;
  const chapter = CHAPTERS.find((c) => c.number === chapterNum);
  if (!chapter) return null;
  const unclaimed = chapter.parts.filter((p) => !claimed.includes(p.id));
  if (unclaimed.length === 0) return null;
  for (let i = 0; i < Math.min(2, unclaimed.length); i++) {
    const node = unclaimed[i];
    if (node.type === "mini_boss") {
      return i === 0 ? "Chapter trial is next!" : "Chapter trial approaching — 1 node away.";
    }
    if (node.type === "memory_fragment") {
      return i === 0 ? "Memory fragment ready." : "Memory fragment nearby.";
    }
  }
  // Chest ready?
  const required = chapter.requiredCompletionNodes ?? [];
  if (required.length > 0 && required.every((id) => claimed.includes(id))) {
    return "Chapter cleared — chest reward ready!";
  }
  return null;
}

const SEEN_KEY = "clinica.dailyRounds.seen";
const DAILY_ROUNDS_MODES = ["ward_shift", "ward_defense", "university", "lotus_journal", "hall_of_heroes"];
const LEVEL_GATE = 2;

function unlockedModes(player: any): string[] {
  const ctx = buildGateContext(player);
  return DAILY_ROUNDS_MODES.filter((m) => checkFeatureGate(m, ctx).unlocked);
}

/** Reward chips row — supports all currency types. */
function RewardChips({ reward, dim }: { reward: DailyReward; dim?: boolean }) {
  return (
    <View style={styles.rewardRow}>
      {!!reward.crowns && (
        <View style={styles.rewardChip}>
          <ExpoImage source={getUiIcon("crowns")} style={styles.rewardIcon} contentFit="contain" />
          <Text style={[styles.rewardTxt, dim && styles.rewardTxtDim]}>{reward.crowns}</Text>
        </View>
      )}
      {!!reward.codexShards && (
        <View style={styles.rewardChip}>
          <Ionicons name="sparkles" size={13} color={dim ? COLORS.onSurfaceTertiary : "#5B9BD5"} />
          <Text style={[styles.rewardTxt, dim && styles.rewardTxtDim]}>{reward.codexShards}</Text>
        </View>
      )}
      {!!reward.universityCredits && (
        <View style={styles.rewardChip}>
          <Ionicons name="school" size={12} color={dim ? COLORS.onSurfaceTertiary : "#7AB8A4"} />
          <Text style={[styles.rewardTxt, dim && styles.rewardTxtDim]}>{reward.universityCredits} UC</Text>
        </View>
      )}
      {!!reward.playerXp && (
        <View style={styles.rewardChip}>
          <Ionicons name="trending-up" size={12} color={dim ? COLORS.onSurfaceTertiary : COLORS.energy} />
          <Text style={[styles.rewardTxt, dim && styles.rewardTxtDim]}>+{reward.playerXp} XP</Text>
        </View>
      )}
      {!!reward.heroXp && (
        <View style={styles.rewardChip}>
          <Ionicons name="people" size={12} color={dim ? COLORS.onSurfaceTertiary : "#C084FC"} />
          <Text style={[styles.rewardTxt, dim && styles.rewardTxtDim]}>+{reward.heroXp} HXP</Text>
        </View>
      )}
      {!!reward.refinedLotusGems && (
        <View style={styles.rewardChip}>
          <Ionicons name="diamond" size={12} color={dim ? COLORS.onSurfaceTertiary : "#A78BFA"} />
          <Text style={[styles.rewardTxt, dim && styles.rewardTxtDim]}>{reward.refinedLotusGems} RLG</Text>
        </View>
      )}
      {!!reward.insightCrystals && (
        <View style={styles.rewardChip}>
          <Ionicons name="diamond" size={12} color={dim ? COLORS.onSurfaceTertiary : "#A78BFA"} />
          <Text style={[styles.rewardTxt, dim && styles.rewardTxtDim]}>{reward.insightCrystals}</Text>
        </View>
      )}
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

function ClaimedPill() {
  return (
    <View style={styles.claimedPill}>
      <Ionicons name="checkmark" size={12} color={COLORS.onSurfaceTertiary} />
      <Text style={styles.claimedTxt}>CLAIMED</Text>
    </View>
  );
}

function ClaimButton({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  return (
    <Pressable style={styles.claimBtn} disabled={busy} onPress={onPress}>
      <Text style={styles.claimBtnTxt}>CLAIM</Text>
    </Pressable>
  );
}

// ── Weekly Tasks ──────────────────────────────────────────────────────────────
function WeeklyTaskCard({
  task, busy, onClaim,
}: { task: WeeklyTaskState; busy: boolean; onClaim: (id: string) => void }) {
  const complete = task.progress >= task.target;
  return (
    <View style={[styles.objCard, complete && !task.claimed && styles.objCardReady]}>
      <View style={[styles.objIcon, complete && styles.objIconDone]}>
        <Ionicons name={task.icon as any} size={18} color={complete ? COLORS.success : COLORS.brand} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.objTopRow}>
          <Text style={styles.objLabel}>{task.label}</Text>
          <Text style={styles.objCount}>{Math.min(task.progress, task.target)}/{task.target}</Text>
        </View>
        <Text style={styles.objDesc}>{task.description}</Text>
        <ProgressBar value={task.progress} target={task.target} color={complete ? COLORS.success : COLORS.energy} />
        <View style={styles.objBottomRow}>
          <RewardChips reward={task.reward} dim={task.claimed} />
          {task.claimed ? (
            <ClaimedPill />
          ) : complete ? (
            <ClaimButton busy={busy} onPress={() => onClaim(task.id)} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ── Quest Milestones (claimable) — P3: sorted ready-to-claim first ────────────
function QuestMilestonesSection({
  player, busy, onClaim,
}: { player: any; busy: boolean; onClaim: (id: string) => void }) {
  if (!player) return null;
  const claimedIds: string[] = player.claimed_daily_milestones ?? [];
  const doneCount = QUEST_MILESTONES.filter(m => m.isDone(player)).length;

  // P3: Sort order: ready-to-claim (done + unclaimed) → achieved+claimed → upcoming
  const sorted = [...QUEST_MILESTONES].sort((a, b) => {
    const aDone = a.isDone(player);
    const bDone = b.isDone(player);
    const aClaimed = claimedIds.includes(a.id);
    const bClaimed = claimedIds.includes(b.id);
    const aReady = aDone && !aClaimed;
    const bReady = bDone && !bClaimed;
    if (aReady && !bReady) return -1;
    if (!aReady && bReady) return  1;
    if (aClaimed && !bClaimed) return  1;
    if (!aClaimed && bClaimed) return -1;
    return 0;
  });

  const readyCount = sorted.filter(m => m.isDone(player) && !claimedIds.includes(m.id)).length;

  return (
    <View style={styles.milestonesWrap}>
      <View style={styles.milestonesProgress}>
        <Text style={styles.milestonesProgressTxt}>
          {doneCount} / {QUEST_MILESTONES.length} achieved
          {readyCount > 0 ? ` · ${readyCount} ready to claim` : ""}
        </Text>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${Math.round((doneCount / QUEST_MILESTONES.length) * 100)}%` as any, backgroundColor: COLORS.brand }]} />
        </View>
      </View>
      {sorted.map((m) => {
        const done = m.isDone(player);
        const claimed = claimedIds.includes(m.id);
        return (
          <View key={m.id} style={[styles.milestoneRow, done && !claimed && styles.milestoneRowReady, done && claimed && styles.milestoneRowDone]}>
            <View style={[styles.milestoneIcon, done && (claimed ? styles.milestoneIconClaimed : styles.milestoneIconDone)]}>
              <Ionicons name={(done ? (claimed ? 'checkmark-done' : 'checkmark') : m.icon) as any} size={14} color={done ? (claimed ? COLORS.onSurfaceTertiary : COLORS.success) : COLORS.onSurfaceTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.milestoneLabel, done && (claimed ? styles.milestoneLabelClaimed : styles.milestoneLabelDone)]}>{m.label}</Text>
              <Text style={styles.milestoneDesc}>{m.description}</Text>
              {done && !claimed && (
                <View style={styles.milestoneRewardRow}>
                  <RewardChips reward={m.reward} />
                </View>
              )}
            </View>
            {done && !claimed ? (
              <ClaimButton busy={busy} onPress={() => onClaim(m.id)} />
            ) : done && claimed ? (
              <ClaimedPill />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ── Level 2 gate ─────────────────────────────────────────────────────────────
function LockedPreview() {
  return (
    <View style={styles.lockedWrap}>
      <View style={styles.lockedIconWrap}>
        <Ionicons name="lock-closed" size={32} color={COLORS.brand} />
      </View>
      <Text style={styles.lockedTitle}>Unlocks at Level 2</Text>
      <Text style={styles.lockedDesc}>
        Complete your Prologue and University introduction to unlock Daily Ward Rounds — free daily duties, weekly quests, and one-time journey milestones, all granting real rewards.
      </Text>
    </View>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export function DailyRoundsPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const {
    player, checkInDailyRounds, claimDailyObjective, claimDailyAllComplete,
    claimWeeklyTask, claimWeeklyAllComplete, claimQuestMilestone,
  } = usePlayer();
  const { notice, flashNotice } = useInlineNotice();
  const [showExplainer, setShowExplainer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  // P6: weekly completion burst (brief celebration when weekly all-complete is claimed)
  const [weeklyBurstActive, setWeeklyBurstActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'milestones'>('daily');
  const checkedInThisOpen = useRef(false);

  // Live countdown
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [visible]);

  // Auto check-in + first-time explainer
  useEffect(() => {
    if (!visible || !player) return;
    let cancelled = false;
    (async () => {
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

  const state: DailyRoundsState = useMemo(() => {
    if (!player) return defaultDailyRoundsState();
    return ensureFreshDailyRounds(player.daily_rounds, unlockedModes(player), player.id).state;
  }, [player]);

  const playerLevel = playerLevelFromXp(player?.xp ?? 0).level;
  const isLocked = playerLevel < LEVEL_GATE;

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
  const allWeeklyComplete = allWeeklyTasksComplete(state);
  const checkedIn = hasCheckedInToday(state, new Date(now));
  const todayStreakReward = streakRewardForDay(Math.max(1, state.streak_count));
  const weeklyTasks: WeeklyTaskState[] = state.weekly_tasks?.length
    ? state.weekly_tasks
    : WEEKLY_TASKS.map(t => ({ ...t, progress: 0, claimed: false }));

  const canClaimAnyDaily = state.objectives.some(o => o.progress >= o.target && !o.claimed)
    || (allComplete && !state.all_complete_claimed);
  const canClaimAnyWeekly = weeklyTasks.some(t => (t.progress ?? 0) >= t.target && !t.claimed)
    || (allWeeklyComplete && !state.weekly_all_complete_claimed);

  const claimAllDaily = async () => {
    if (busy) return;
    setBusy(true);
    try {
      for (const o of state.objectives) {
        if (o.progress >= o.target && !o.claimed) await claimDailyObjective(o.id);
      }
      if (allComplete && !state.all_complete_claimed) await claimDailyAllComplete();
    } finally { setBusy(false); }
  };
  const claimAllWeekly = async () => {
    if (busy) return;
    setBusy(true);
    try {
      for (const task of weeklyTasks) {
        if ((task.progress ?? 0) >= task.target && !task.claimed) await claimWeeklyTask(task.id);
      }
      if (allWeeklyComplete && !state.weekly_all_complete_claimed) await claimWeeklyAllComplete();
    } finally { setBusy(false); }
  };

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
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={18} color={COLORS.onSurfaceSecondary} />
            </Pressable>
          </View>

          {!isLocked && (
            <View style={styles.refreshRow}>
              <Ionicons name="time-outline" size={12} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.refreshTxt}>Objectives refresh in {formatCountdown(msUntilNextDay(new Date(now)))}</Text>
            </View>
          )}

          {!isLocked && (
            <View style={styles.tabRow}>
              {(['daily', 'weekly', 'milestones'] as const).map((tab) => (
                <Pressable key={tab} style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} onPress={() => setActiveTab(tab)}>
                  <Text style={[styles.tabTxt, activeTab === tab && styles.tabTxtActive]}>
                    {tab === 'daily' ? 'DUTIES' : tab === 'weekly' ? 'WEEKLY' : 'JOURNEY'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Level 2 gate */}
            {isLocked ? (
              <LockedPreview />
            ) : (
              <>
                {showExplainer && (
                  <View style={{ marginBottom: SPACING.sm }}>
                    <NarratorGuide
                      message="Ward Rounds reward you for showing up. Check in daily, clear your three duties, complete weekly quests, and claim one-time Journey Milestones — all free."
                      objective="Check in each day and complete your three duties."
                      ctaLabel="Understood"
                      onPress={dismissExplainer}
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

                {/* P3: Next on Your Journey ─ compact card linking daily play to the map */}
                {(() => {
                  const nextNode = getNextJourneyNode(player);
                  const teaser = getNextMilestoneTeaser(player);
                  const proximityHint = getJourneyProximityHint(player);
                  if (!nextNode && !teaser) return null;
                  return (
                    <View style={styles.journeyCard}>
                      {nextNode && (
                        <View style={styles.journeyRow}>
                          <View style={styles.journeyIconWrap}>
                            <Ionicons
                              name={(NODE_TYPE_ICON[nextNode.type] ?? "map-outline") as any}
                              size={15}
                              color={COLORS.brand}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.journeyKicker}>NEXT ON YOUR JOURNEY</Text>
                            <Text style={styles.journeyTitle} numberOfLines={1}>{nextNode.title}</Text>
                            <Text style={styles.journeyType}>{NODE_TYPE_LABEL[nextNode.type] ?? nextNode.type}</Text>
                            {!!proximityHint && (
                              <Text style={styles.journeyProximityHint}>{proximityHint}</Text>
                            )}
                          </View>
                          <Ionicons name="arrow-forward" size={13} color={COLORS.brand + "99"} />
                        </View>
                      )}
                      {teaser && (
                        <View style={[styles.journeyRow, nextNode && { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: SPACING.xs, paddingTop: SPACING.xs }]}>
                          <View style={[styles.journeyIconWrap, { backgroundColor: COLORS.energy + "18" }]}>
                            <Ionicons name={teaser.icon as any} size={14} color={COLORS.energy} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.journeyKicker, { color: COLORS.energy }]}>UPCOMING MILESTONE</Text>
                            <Text style={styles.journeyTitle} numberOfLines={1}>{teaser.label}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })()}

                {/* Daily objectives */}
                {activeTab === 'daily' && (<>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>TODAY'S DUTIES</Text>
                  {canClaimAnyDaily && (
                    <Pressable style={styles.claimAllBtn} onPress={claimAllDaily} disabled={busy}>
                      <Text style={styles.claimAllTxt}>CLAIM ALL</Text>
                    </Pressable>
                  )}
                </View>
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
                      <View key={o.id} style={[styles.objCard, complete && !o.claimed && styles.objCardReady]}>
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
                              <ClaimedPill />
                            ) : complete ? (
                              <ClaimButton busy={busy} onPress={() => runClaim(() => claimDailyObjective(o.id))} />
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
                      name={allComplete ? "trophy" : "trophy-outline"}
                      size={20}
                      color={allComplete ? COLORS.energy : COLORS.onSurfaceTertiary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bonusTitle}>All Duties Bonus</Text>
                      <RewardChips reward={ALL_COMPLETE_BONUS} dim={state.all_complete_claimed} />
                    </View>
                    {state.all_complete_claimed ? (
                      <ClaimedPill />
                    ) : allComplete ? (
                      <ClaimButton busy={busy} onPress={() => runClaim(claimDailyAllComplete)} />
                    ) : (
                      <Text style={styles.lockHint}>Finish all</Text>
                    )}
                  </View>
                )}

                </>)}
                {/* Weekly tasks */}
                {activeTab === 'weekly' && (<>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>WEEKLY TASKS</Text>
                  {canClaimAnyWeekly && (
                    <Pressable style={styles.claimAllBtn} onPress={claimAllWeekly} disabled={busy}>
                      <Text style={styles.claimAllTxt}>CLAIM ALL</Text>
                    </Pressable>
                  )}
                </View>
                {weeklyTasks.map((task) => (
                  <WeeklyTaskCard
                    key={task.id}
                    task={task}
                    busy={busy}
                    onClaim={(id) => runClaim(() => claimWeeklyTask(id))}
                  />
                ))}
                {/* Weekly completion bonus */}
                <View style={[styles.bonusCard, allWeeklyComplete && styles.bonusCardWeekly]}>
                  <Ionicons
                    name={allWeeklyComplete ? "ribbon" : "ribbon-outline"}
                    size={20}
                    color={allWeeklyComplete ? "#A78BFA" : COLORS.onSurfaceTertiary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bonusTitle}>Weekly Completion Bonus</Text>
                    <Text style={styles.weeklySub}>Complete all 4 weekly tasks</Text>
                    <RewardChips reward={WEEKLY_ALL_COMPLETE_REWARD} dim={state.weekly_all_complete_claimed} />
                  </View>
                  {state.weekly_all_complete_claimed ? (
                    <ClaimedPill />
                  ) : allWeeklyComplete ? (
                    <ClaimButton busy={busy} onPress={() => {
                      runClaim(claimWeeklyAllComplete).then(() => setWeeklyBurstActive(true));
                    }} />
                  ) : (
                    <Text style={styles.lockHint}>Finish all</Text>
                  )}
                </View>

                {/* P6: weekly completion burst celebration */}
                {weeklyBurstActive && (
                  <View style={styles.weeklyBurstRow}>
                    <Ionicons name="ribbon" size={15} color="#A78BFA" />
                    <Text style={styles.weeklyBurstTxt}>Weekly Training Complete — well done, Healer!</Text>
                  </View>
                )}

                </>)}
                {/* Journey Milestones */}
                {activeTab === 'milestones' && (<>
                <Text style={styles.sectionLabel}>JOURNEY MILESTONES</Text>
                <QuestMilestonesSection
                  player={player}
                  busy={busy}
                  onClaim={(id) => runClaim(() => claimQuestMilestone(id))}
                />

                </>)}
                <Text style={styles.footNote}>
                  All rewards are free — no purchases involved. Duties are drawn only from wards you've unlocked.
                </Text>
              </>
            )}
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

  lockedWrap: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    padding: SPACING.lg, alignItems: "center", gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, margin: SPACING.lg,
  },
  lockedIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.brand + "18",
    alignItems: "center", justifyContent: "center",
  },
  lockedTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: "700", textAlign: "center" },
  lockedDesc: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18, textAlign: "center" },

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

  sectionLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACING.sm },
  claimAllBtn: {
    backgroundColor: COLORS.success + "22", borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: COLORS.success + "55",
    paddingHorizontal: 10, paddingVertical: 4,
  },
  claimAllTxt: { color: COLORS.success, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabBtnActive: { borderBottomWidth: 2.5, borderBottomColor: COLORS.brand },
  tabTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  tabTxtActive: { color: COLORS.brand },

  emptyBox: { backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  emptyTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },

  objCard: {
    flexDirection: "row", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  objCardReady: { borderColor: COLORS.success + "55", backgroundColor: COLORS.success + "0A" },
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

  rewardRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap", flex: 1 },
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
  bonusCardWeekly: { borderColor: "#A78BFA44", backgroundColor: "#A78BFA12" },
  weeklyBurstRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: "#A78BFA50",
    backgroundColor: "#A78BFA12",
    marginTop: 4,
  },
  weeklyBurstTxt: {
    fontSize: 12,
    fontWeight: "600",
    color: "#C4B5FD",
    flex: 1,
    lineHeight: 16,
  },
  bonusTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700", marginBottom: 1 },
  weeklySub: { color: COLORS.onSurfaceSecondary, fontSize: 11, marginBottom: 3 },

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
  milestoneRowDone:  { borderColor: COLORS.onSurfaceTertiary + "25", opacity: 0.55 },
  milestoneRowReady: { borderColor: COLORS.success + "55", backgroundColor: COLORS.success + "0A", opacity: 1 },
  milestoneIcon: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.surfaceTertiary,
    alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
  },
  milestoneIconDone:    { backgroundColor: COLORS.success + "1A" },
  milestoneIconClaimed: { backgroundColor: COLORS.surfaceTertiary },
  milestoneLabel: { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },
  milestoneLabelDone:    { color: COLORS.onSurface },
  milestoneLabelClaimed: { color: COLORS.onSurfaceTertiary },
  milestoneDesc: { color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 14, marginTop: 1 },
  milestoneRewardRow: { marginTop: 4 },

  // P3: Next-on-journey card
  journeyCard: {
    backgroundColor: COLORS.brand + "0E",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.brand + "30",
    padding: SPACING.sm,
    gap: 0,
  },
  journeyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: 2,
  },
  journeyIconWrap: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.brand + "1A",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  journeyKicker: {
    color: COLORS.brand,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  journeyTitle: {
    color: COLORS.onSurface,
    fontSize: 13,
    fontWeight: "700",
  },
  journeyType: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    marginTop: 1,
  },
  // P13: proximity hint line
  journeyProximityHint: {
    color: "#F97316",
    fontSize: 10,
    fontStyle: "italic",
    marginTop: 2,
  },
});
