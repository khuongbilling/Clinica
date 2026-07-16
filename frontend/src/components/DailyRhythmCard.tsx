// ─────────────────────────────────────────────────────────────────────────────
// DailyRhythmCard — P3 retention hook.
//
// A compact horizontal strip shown on the Shift hub (Ward Operations) giving
// the player an immediate at-a-glance answer to "what should I do today?":
//
//   🔥 3   ●●○ 2/3 duties   |   NEXT  Rapid Triage Drill →
//
// Tapping anywhere opens the DailyRoundsPanel.
// Only rendered for Level 2+ players (same gate as the Rounds panel).
// ─────────────────────────────────────────────────────────────────────────────

import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CHAPTERS } from "@/src/game/chapterJourney";
import {
  DailyRoundsState,
  ensureFreshDailyRounds,
} from "@/src/game/dailyRounds";
import { getJourneyNodeDef } from "@/src/game/journeyRewards";
import {
  buildGateContext,
  checkFeatureGate,
  playerLevelFromXp,
} from "@/src/game/progression";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── constants ─────────────────────────────────────────────────────────────────

const LEVEL_GATE = 2;

const DAILY_ROUNDS_MODES = [
  "ward_shift",
  "ward_defense",
  "university",
  "lotus_journal",
  "hall_of_heroes",
];

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

// ── helpers ───────────────────────────────────────────────────────────────────

function unlockedModes(player: any): string[] {
  const ctx = buildGateContext(player);
  return DAILY_ROUNDS_MODES.filter(
    (m) => checkFeatureGate(m, ctx).unlocked,
  );
}

/** First unclaimed, reward-def-backed node in the player's current chapter. */
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

// ── component ─────────────────────────────────────────────────────────────────

interface DailyRhythmCardProps {
  player: any;
  onPress: () => void;
}

export function DailyRhythmCard({ player, onPress }: DailyRhythmCardProps) {
  if (!player) return null;

  const level = playerLevelFromXp(player.xp ?? 0).level;
  if (level < LEVEL_GATE) return null;

  const state: DailyRoundsState = ensureFreshDailyRounds(
    player.daily_rounds,
    unlockedModes(player),
    player.id,
  ).state;

  const streak  = state.streak_count;
  const done    = state.objectives.filter((o) => o.progress >= o.target).length;
  const total   = state.objectives.length;
  const allDone = total > 0 && done === total;
  const allClaimed = allDone && state.all_complete_claimed;

  const nextNode = getNextJourneyNode(player);
  const nodeIcon = (NODE_TYPE_ICON[nextNode?.type ?? ""] ?? "map-outline") as any;

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      testID="daily-rhythm-card"
    >
      {/* ── Streak pill ── */}
      <View style={styles.streakPill}>
        <Ionicons name="flame" size={13} color={COLORS.energy} />
        <Text style={styles.streakTxt}>{streak}</Text>
      </View>

      {/* ── Duty dots + label ── */}
      <View style={styles.dutyCol}>
        <View style={styles.dutyDots}>
          {Array.from({ length: Math.max(total, 3) }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i < done ? styles.dotDone : styles.dotEmpty]}
            />
          ))}
        </View>
        <Text
          style={[
            styles.dutyTxt,
            allDone && (allClaimed ? styles.dutyTxtClaimed : styles.dutyTxtDone),
          ]}
          numberOfLines={1}
        >
          {allClaimed
            ? "Duties claimed"
            : allDone
            ? "Claim rewards!"
            : total > 0
            ? `${done}/${total} duties`
            : "Duties today"}
        </Text>
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Next Journey node ── */}
      <View style={styles.nextCol}>
        <Text style={styles.nextKicker}>NEXT</Text>
        {nextNode ? (
          <View style={styles.nextRow}>
            <Ionicons name={nodeIcon} size={11} color={COLORS.brand} />
            <Text style={styles.nextTitle} numberOfLines={1}>
              {nextNode.title}
            </Text>
          </View>
        ) : (
          <Text style={styles.nextTitle} numberOfLines={1}>
            Chapter complete!
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={14} color={COLORS.onSurfaceTertiary} />
    </Pressable>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: SPACING.sm,
  },

  // Streak
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: COLORS.energy + "1A",
    borderRadius: RADIUS.pill,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexShrink: 0,
  },
  streakTxt: {
    color: COLORS.energy,
    fontSize: 12,
    fontWeight: "800",
  },

  // Duty dots
  dutyCol: {
    alignItems: "flex-start",
    gap: 3,
    flexShrink: 0,
  },
  dutyDots: {
    flexDirection: "row",
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotDone: {
    backgroundColor: COLORS.success,
  },
  dotEmpty: {
    backgroundColor: COLORS.onSurfaceTertiary + "50",
  },
  dutyTxt: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 10,
    fontWeight: "600",
  },
  dutyTxtDone: {
    color: COLORS.success,
  },
  dutyTxtClaimed: {
    color: COLORS.onSurfaceTertiary,
  },

  // Divider
  divider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
    flexShrink: 0,
  },

  // Next node
  nextCol: {
    flex: 1,
    gap: 2,
    overflow: "hidden",
  },
  nextKicker: {
    color: COLORS.brand,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  nextTitle: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },
});
