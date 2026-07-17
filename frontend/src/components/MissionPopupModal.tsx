/**
 * MissionPopupModal — donghua RPG mission preview popup
 *
 * Shown when the player taps a Journey Map node. Replaces immediate
 * navigation with a preview sheet that shows:
 *   · Mission type badge + illustrated icon
 *   · Title + description
 *   · Difficulty / level hint
 *   · Reward preview chips
 *   · Two CTAs: "Prepare Team" (→ loadout) | "Back to Map"
 *
 * Locked nodes still cannot start — they show the lock reason instead.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { type ChapterPart } from "@/src/game/chapterJourney";
import {
  computeJourneyReward,
  getJourneyNodeDef,
} from "@/src/game/journeyRewards";
import { RADIUS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";
import { NODE_TYPE_ICON } from "./MapNodeShape";

// ── Type metadata ─────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  battle:          "Ward Shift",
  mini_boss:       "Chapter Trial",
  ward_defense:    "Ward Defense",
  memory_fragment: "Memory Fragment",
  challenge:       "Clinical Challenge",
  reflection:      "Reflection",
  story:           "Story Scene",
  reward:          "Reward Node",
  lesson:          "Lotus Lesson",
  realm:           "Sanctuary Task",
  chain:           "Clinical Chain",
  community:       "Community Mission",
  arena:           "Arena Bout",
  mode_preview:    "Mode Unlock",
  minigame:        "Practice Lab",
};

const TYPE_FLAVOR: Record<string, string> = {
  battle:          "Deploy your healer team to the ward. Assess clinical cues, apply actions, and stabilize your patient before corruption overwhelms them.",
  mini_boss:       "A formidable corrupted entity stands between chapters. Bring your strongest strategy and care chain to overcome this trial.",
  ward_defense:    "Hold the ward against waves of disease-monsters. Position your healers, manage stamina, and keep patients alive.",
  memory_fragment: "A flash of memory surfaces. Reflect on the healer's journey so far and claim your first-clear reward.",
  challenge:       "A rapid clinical skill challenge. Think fast, reason clearly, and demonstrate your clinical instincts.",
  reflection:      "A moment to pause, reflect, and absorb the lessons learned through the chapter so far.",
  story:           "A narrative moment unfolds. Experience the story of the Kingdom of Healing and those within it.",
  reward:          "Claim your chapter completion reward — earned through dedication and care.",
  lesson:          "A Lotus Lesson awaits. Read, reason, and answer to deepen your clinical knowledge.",
  realm:           "Build and grow your Sanctuary. A realm task connects your ward victories to the world you're restoring.",
  chain:           "A clinical chain reaction event. Navigate cascading patient conditions with careful sequencing.",
  community:       "Help the community beyond the ward walls. A public health challenge tied to the chapter's outbreak theme.",
  arena:           "A structured duel-format challenge. Face a curated opponent in a limited-format match.",
  mode_preview:    "A first look at a new game mode. No pressure — just explore.",
  minigame:        "A focused practice mini-game. Sharpen a specific clinical skill in a fast, low-stakes setting.",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  part:          ChapterPart | null;
  chapterAccent: string;
  chapterNumber: number;
  onClose:       () => void;
  battleStars:   Record<string, number>;
}

// ── Reward pill ───────────────────────────────────────────────────────────────

function RewardChip({ icon, value, color }: { icon: string; value: string | number; color: string }) {
  return (
    <View style={[chip.wrap, { borderColor: color + "40", backgroundColor: color + "14" }]}>
      <Ionicons name={icon as any} size={11} color={color} />
      <Text style={[chip.txt, { color }]}>{value}</Text>
    </View>
  );
}
const chip = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  txt:  { fontSize: 11, fontWeight: "700" },
});

// ── Main component ────────────────────────────────────────────────────────────

export function MissionPopupModal({
  part,
  chapterAccent,
  chapterNumber,
  onClose,
  battleStars,
}: Props) {
  const router = useRouter();

  if (!part) return null;

  const isLocked      = part.isPlaceholder;
  const isActionable  = !!part.route && !part.isPlaceholder;
  const typeLabel     = TYPE_LABEL[part.type] ?? part.type.replace(/_/g, " ").toUpperCase();
  const flavor        = TYPE_FLAVOR[part.type] ?? part.description;
  const icon          = NODE_TYPE_ICON[part.type] ?? "star";

  // Compute rewards
  const def = getJourneyNodeDef(part.id);
  const bestStar = Math.max(1, ...Object.values(battleStars).map(Number));
  const rwd = def ? computeJourneyReward(def, bestStar) : null;

  const xp      = rwd?.playerXp ?? part.rewardXp      ?? 0;
  const coins   = rwd?.coins   ?? part.rewardCoins    ?? 0;
  const credits = rwd?.credits ?? part.rewardCredits  ?? 0;
  const shards  = rwd?.shards  ?? part.rewardShards   ?? 0;

  const handlePrepare = () => {
    onClose();
    // Navigate to mission loadout
    router.push({
      pathname: "/mission-loadout" as any,
      params: {
        partId:        part.id,
        title:         part.title,
        missionRoute:  part.route ?? "",
        partType:      part.type,
        chapterAccent: chapterAccent,
        chapterNumber: String(chapterNumber),
      },
    });
  };

  const handleDirectLaunch = () => {
    onClose();
    if (part.route) router.push(part.route as any);
  };

  return (
    <Modal
      visible={!!part}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Scrim */}
      <Pressable style={styles.scrim} onPress={onClose} />

      {/* Sheet */}
      <View style={styles.sheet}>
        {/* Chapter accent top bar */}
        <LinearGradient
          colors={[chapterAccent + "30", "transparent"]}
          style={styles.topGlow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />

        {/* Drag handle */}
        <View style={styles.handle} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Header row */}
          <View style={styles.headerRow}>
            {/* Large illustrated icon */}
            <View style={[styles.iconFrame, { borderColor: chapterAccent + "60", backgroundColor: chapterAccent + "18" }]}>
              <Ionicons name={icon as any} size={36} color={chapterAccent} />
              {/* Corner marks */}
              <View style={[styles.cornerTL, { borderColor: chapterAccent }]} />
              <View style={[styles.cornerBR, { borderColor: chapterAccent }]} />
            </View>

            {/* Title area */}
            <View style={{ flex: 1, gap: 4 }}>
              {/* Type badge */}
              <View style={[styles.typeBadge, { backgroundColor: chapterAccent + "1C", borderColor: chapterAccent + "50" }]}>
                <Text style={[styles.typeTxt, { color: chapterAccent }]}>
                  {typeLabel.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.missionTitle}>{part.title}</Text>
              <Text style={styles.chapterLabel}>Ch.{chapterNumber} · Part {part.part}</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.flavor}>{flavor}</Text>

          {isLocked && (
            <View style={styles.lockedBanner}>
              <Ionicons name="lock-closed" size={14} color={UI.textDim} />
              <Text style={styles.lockedTxt}>
                This node is coming soon. Check back as you progress through the chapter.
              </Text>
            </View>
          )}

          {/* Rewards */}
          {(xp > 0 || coins > 0 || credits > 0 || shards > 0) && (
            <View style={styles.rewardSection}>
              <Text style={styles.rewardLabel}>FIRST-CLEAR REWARDS</Text>
              <View style={styles.rewardRow}>
                {xp > 0      && <RewardChip icon="trending-up-outline" value={`+${xp} XP`}       color="#4FD8C4" />}
                {coins > 0   && <RewardChip icon="cash-outline"        value={`${coins} ⚕`}       color="#E8C868" />}
                {credits > 0 && <RewardChip icon="school-outline"      value={`${credits} UC`}    color="#A6D8F6" />}
                {shards > 0  && <RewardChip icon="diamond-outline"     value={`${shards} Shard`}  color="#BBA7EA" />}
              </View>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.btnRow}>
            <Pressable style={styles.backBtn} onPress={onClose}>
              <Ionicons name="chevron-back" size={16} color={UI.textSoft} />
              <Text style={styles.backBtnTxt}>Back to Map</Text>
            </Pressable>

            {isActionable && (
              part.type === "battle" || part.type === "mini_boss" ? (
                <Pressable
                  style={[styles.primaryBtn, { backgroundColor: chapterAccent }]}
                  onPress={handlePrepare}
                >
                  <Ionicons name="people" size={16} color={UI.onGold} />
                  <Text style={[styles.primaryBtnTxt, { color: UI.onGold }]}>Prepare Team</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.primaryBtn, { backgroundColor: chapterAccent }]}
                  onPress={handleDirectLaunch}
                >
                  <Ionicons name="play" size={16} color={UI.onGold} />
                  <Text style={[styles.primaryBtnTxt, { color: UI.onGold }]}>Begin Mission</Text>
                </Pressable>
              )
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.60)",
  },
  sheet: {
    backgroundColor:  UI.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "rgba(232,200,104,0.22)",
    overflow: "hidden",
    maxHeight: "80%",
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  scroll: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  iconFrame: {
    width: 72,
    height: 72,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    position: "relative",
  },
  cornerTL: {
    position: "absolute",
    top: -1,
    left: -1,
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 4,
    opacity: 0.8,
  },
  cornerBR: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 4,
    opacity: 0.8,
  },
  typeBadge: {
    alignSelf: "flex-start",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  missionTitle: {
    color: UI.text,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
  chapterLabel: {
    color: UI.textDim,
    fontSize: 11,
  },

  // Description
  flavor: {
    color: UI.textSoft,
    fontSize: 14,
    lineHeight: 22,
  },

  // Locked banner
  lockedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: SPACING.sm,
  },
  lockedTxt: {
    flex: 1,
    color: UI.textDim,
    fontSize: 12,
    lineHeight: 18,
  },

  // Rewards
  rewardSection: {
    gap: 8,
  },
  rewardLabel: {
    color: UI.textDim,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  rewardRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  // Buttons
  btnRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  backBtnTxt: {
    color: UI.textSoft,
    fontSize: 14,
    fontWeight: "600",
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  primaryBtnTxt: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
