/**
 * /milestones — Level Milestones & Chapter 3-Star Bonus screen (C4)
 *
 * Two sections:
 *   1. Level Milestones — claimable one-time rewards tied to Player Level.
 *   2. Chapter ★★★ Bonuses — Refined Lotus Gems for first-ever 3-star clear.
 *
 * Chapter Completion Chests live on the Journey Map (/journey) instead,
 * so both surfaces are useful and neither is crowded.
 *
 * Route: /milestones
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ENEMIES } from "@/src/game/content";
import {
  CHAPTER_3STAR_REWARDS,
  LEVEL_MILESTONES,
  formatReward,
  hasChapter3StarClear,
  type Chapter3StarReward,
  type LevelMilestone,
} from "@/src/game/milestones";
import { playerLevelFromXp } from "@/src/game/progression";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── Colour constants ──────────────────────────────────────────────────────────

const GOLD   = "#D4AF37";
const TEAL   = COLORS.brand;
const MUTED  = COLORS.onSurfaceTertiary;

// ── Claim state helpers ───────────────────────────────────────────────────────

type ClaimState = "locked" | "claimable" | "claimed";

function levelMilestoneState(
  m: LevelMilestone,
  playerLevel: number,
  claimedIds: string[],
): ClaimState {
  if (claimedIds.includes(m.id)) return "claimed";
  if (playerLevel >= m.level)    return "claimable";
  return "locked";
}

function chapter3StarState(
  r: Chapter3StarReward,
  battleStars: Record<string, number>,
  claimedIds: string[],
): ClaimState {
  if (claimedIds.includes(r.id)) return "claimed";
  if (hasChapter3StarClear(battleStars, r.chapter, ENEMIES)) return "claimable";
  return "locked";
}

// ── Milestone row ─────────────────────────────────────────────────────────────

function MilestoneRow({
  state,
  levelLabel,
  unlock,
  rewardText,
  onClaim,
  claiming,
}: {
  state: ClaimState;
  levelLabel: string;
  unlock: string;
  rewardText: string;
  onClaim: () => void;
  claiming: boolean;
}) {
  const dimmed = state === "locked";

  return (
    <View style={[styles.row, dimmed && styles.rowDimmed]}>
      {/* Badge */}
      <View style={[styles.badge, state === "claimed" && styles.badgeClaimed]}>
        {state === "claimed" ? (
          <Ionicons name="checkmark" size={14} color={COLORS.surface} />
        ) : state === "claimable" ? (
          <Ionicons name="gift" size={14} color={GOLD} />
        ) : (
          <Ionicons name="lock-closed" size={13} color={MUTED} />
        )}
      </View>

      {/* Text */}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, dimmed && styles.rowLabelDimmed]}>
          {levelLabel}
        </Text>
        <Text style={styles.rowUnlock} numberOfLines={1}>{unlock}</Text>
        <Text style={[styles.rowReward, dimmed && { opacity: 0.4 }]}>{rewardText}</Text>
      </View>

      {/* Action */}
      {state === "claimable" && (
        <Pressable
          style={[styles.claimBtn, claiming && styles.claimBtnDisabled]}
          onPress={onClaim}
          disabled={claiming}
        >
          {claiming ? (
            <ActivityIndicator size="small" color={COLORS.surface} />
          ) : (
            <Text style={styles.claimBtnTxt}>Claim</Text>
          )}
        </Pressable>
      )}
      {state === "claimed" && (
        <View style={styles.claimedPill}>
          <Text style={styles.claimedTxt}>Done</Text>
        </View>
      )}
      {state === "locked" && (
        <View style={styles.lockedPill}>
          <Text style={styles.lockedTxt}>Lv.{/* filled by caller */}</Text>
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function MilestonesScreen() {
  const router = useRouter();
  const { player, loading, claimLevelReward, claimChapter3Star } = usePlayer();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const playerLevel = useMemo(
    () => (player ? playerLevelFromXp(player.xp ?? 0).level : 1),
    [player],
  );

  const claimedLevel   = useMemo(() => player?.claimed_level_rewards   ?? [], [player]);
  const claimed3Star   = useMemo(() => player?.claimed_chapter_3star   ?? [], [player]);
  const battleStars    = useMemo(() => player?.battle_stars ?? {}, [player]);

  const handleClaimLevel = useCallback(
    async (id: string) => {
      setClaimingId(id);
      const res = await claimLevelReward(id);
      setClaimingId(null);
      if (!res.ok) Alert.alert("Not yet", res.message);
    },
    [claimLevelReward],
  );

  const handleClaim3Star = useCallback(
    async (id: string) => {
      setClaimingId(id);
      const res = await claimChapter3Star(id);
      setClaimingId(null);
      if (!res.ok) Alert.alert("Not yet", res.message);
    },
    [claimChapter3Star],
  );

  if (loading || !player) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={["top", "bottom"]}>
        <ActivityIndicator color={TEAL} />
      </SafeAreaView>
    );
  }

  const claimableLevel  = LEVEL_MILESTONES.filter(m => levelMilestoneState(m, playerLevel, claimedLevel) === "claimable").length;
  const claimable3Star  = CHAPTER_3STAR_REWARDS.filter(r => chapter3StarState(r, battleStars, claimed3Star) === "claimable").length;
  const totalClaimable  = claimableLevel + claimable3Star;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="milestones-screen">
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={10}
          testID="milestones-back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>GENEROSITY REWARDS</Text>
          <Text style={styles.title}>Milestones</Text>
        </View>
        {totalClaimable > 0 && (
          <View style={styles.badgePill}>
            <Text style={styles.badgePillTxt}>{totalClaimable} Ready</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Level Milestones section ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up" size={16} color={TEAL} />
            <Text style={styles.sectionTitle}>Level Milestones</Text>
          </View>
          <Text style={styles.sectionSub}>
            Claim rewards as you reach new Player Levels. These never expire.
          </Text>

          {LEVEL_MILESTONES.map((m) => {
            const state = levelMilestoneState(m, playerLevel, claimedLevel);
            return (
              <View key={m.id} style={styles.rowWrap}>
                <MilestoneRow
                  state={state}
                  levelLabel={m.label}
                  unlock={m.unlock}
                  rewardText={formatReward(m.rewards)}
                  onClaim={() => handleClaimLevel(m.id)}
                  claiming={claimingId === m.id}
                />
                {state === "locked" && (
                  <View style={styles.lockedOverlay}>
                    <Text style={styles.lockedReq}>Lv.{m.level}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Chapter ★★★ Bonuses section ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star" size={16} color={GOLD} />
            <Text style={styles.sectionTitle}>Chapter ★★★ Bonuses</Text>
          </View>
          <Text style={styles.sectionSub}>
            Earn a 3-star rating on any enemy in the chapter's difficulty band for a one-time Refined Gem bonus. Total: 220 Refined Gems.
          </Text>

          <View style={styles.starGrid}>
            {CHAPTER_3STAR_REWARDS.map((r) => {
              const state = chapter3StarState(r, battleStars, claimed3Star);
              const dimmed = state === "locked";
              return (
                <View
                  key={r.id}
                  style={[
                    styles.starCard,
                    state === "claimed" && styles.starCardClaimed,
                    state === "claimable" && styles.starCardClaimable,
                  ]}
                >
                  <Text style={[styles.starChLabel, dimmed && { opacity: 0.4 }]}>
                    Ch.{r.chapter}
                  </Text>
                  <View style={styles.starRow}>
                    {[1, 2, 3].map((s) => (
                      <Ionicons
                        key={s}
                        name="star"
                        size={12}
                        color={state === "claimed" ? GOLD : state === "claimable" ? GOLD : MUTED}
                        style={{ opacity: dimmed ? 0.35 : 1 }}
                      />
                    ))}
                  </View>
                  <Text style={[styles.starGemAmt, dimmed && { opacity: 0.4 }]}>
                    +{r.refinedLotusGems}💎
                  </Text>

                  {state === "claimable" && (
                    <Pressable
                      style={[styles.starClaimBtn, claimingId === r.id && styles.claimBtnDisabled]}
                      onPress={() => handleClaim3Star(r.id)}
                      disabled={claimingId === r.id}
                    >
                      {claimingId === r.id ? (
                        <ActivityIndicator size="small" color={COLORS.surface} />
                      ) : (
                        <Text style={styles.starClaimTxt}>Claim</Text>
                      )}
                    </Pressable>
                  )}
                  {state === "claimed" && (
                    <View style={styles.starDonePill}>
                      <Ionicons name="checkmark" size={10} color={COLORS.surface} />
                    </View>
                  )}
                  {state === "locked" && (
                    <View style={styles.starLockPill}>
                      <Ionicons name="lock-closed" size={9} color={MUTED} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Footer note ── */}
        <View style={styles.footerNote}>
          <Ionicons name="information-circle-outline" size={14} color={MUTED} />
          <Text style={styles.footerTxt}>
            Chapter Completion Chests are on the{" "}
            <Text style={{ color: TEAL }}>Journey Map</Text> screen.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: TEAL,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.onSurface,
  },
  badgePill: {
    backgroundColor: GOLD + "25",
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: GOLD + "70",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  badgePillTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: GOLD,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Section
  section: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.onSurface,
  },
  sectionSub: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 17,
    marginBottom: SPACING.sm,
  },

  // Level milestone row
  rowWrap: { position: "relative" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  rowDimmed: { opacity: 0.55 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  badgeClaimed: {
    backgroundColor: TEAL,
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.onSurface,
  },
  rowLabelDimmed: { color: MUTED },
  rowUnlock: {
    fontSize: 11,
    color: MUTED,
    marginTop: 1,
  },
  rowReward: {
    fontSize: 11,
    fontWeight: "600",
    color: GOLD,
    marginTop: 2,
  },
  claimBtn: {
    backgroundColor: TEAL,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    minWidth: 60,
    alignItems: "center",
  },
  claimBtnDisabled: { opacity: 0.5 },
  claimBtnTxt: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.surface,
  },
  claimedPill: {
    backgroundColor: TEAL + "25",
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: TEAL + "60",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  claimedTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: TEAL,
  },
  lockedPill: {
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  lockedTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
  },
  lockedOverlay: {
    position: "absolute",
    right: SPACING.sm,
    top: "50%",
    transform: [{ translateY: -10 }],
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  lockedReq: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
  },

  // Chapter 3-star grid
  starGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  starCard: {
    width: "18%",
    minWidth: 62,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: 4,
    gap: 4,
  },
  starCardClaimed: {
    borderColor: GOLD + "60",
    backgroundColor: GOLD + "10",
  },
  starCardClaimable: {
    borderColor: GOLD,
    backgroundColor: GOLD + "18",
  },
  starChLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.onSurface,
  },
  starRow: {
    flexDirection: "row",
    gap: 1,
  },
  starGemAmt: {
    fontSize: 10,
    fontWeight: "700",
    color: GOLD,
  },
  starClaimBtn: {
    backgroundColor: TEAL,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: "center",
    width: "100%",
  },
  starClaimTxt: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.surface,
  },
  starDonePill: {
    backgroundColor: TEAL,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  starLockPill: {
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  // Footer note
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    padding: SPACING.sm,
    backgroundColor: TEAL + "12",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: TEAL + "30",
  },
  footerTxt: {
    flex: 1,
    fontSize: 12,
    color: MUTED,
    lineHeight: 17,
  },
});
