/**
 * ChapterJourneyMap — Phase 1 chapter progression UI
 *
 * Shows all 10 Phase 1 chapters as vertical cards. The active chapter is
 * expanded to display its parts; locked chapters show a compact locked card;
 * completed chapters show a compact completed card.
 *
 * Designed for mobile: full-width scrollable list, no horizontal scroll.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  CHAPTERS,
  Chapter,
  ChapterPart,
  ChapterStatus,
  getChapterStatus,
  PHASE_1_SUMMARY,
  type ChapterPartType,
} from "@/src/game/chapterJourney";
import { ENEMIES } from "@/src/game/content";
import { getJourneyNodeDef, computeJourneyReward } from "@/src/game/journeyRewards";
import { CHAPTER_CHESTS } from "@/src/game/milestones";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── Part type label + color helpers ──────────────────────────────────────────

const PART_TYPE_LABEL: Record<ChapterPartType, string> = {
  battle:       "SHIFT",
  mini_boss:    "MINI-BOSS",
  ward_defense: "WARD DEF.",
  minigame:     "MINI-GAME",
  lesson:       "LESSON",
  story:        "STORY",
  reflection:   "REFLECTION",
  reward:       "REWARD",
  realm:        "REALM",
  mode_preview: "PREVIEW",
  chain:        "CHAIN",
  community:    "COMMUNITY",
  arena:        "ARENA",
};

const PART_TYPE_COLOR: Record<ChapterPartType, string> = {
  battle:       COLORS.error,
  mini_boss:    "#D4AF37",
  ward_defense: "#EF4444",
  minigame:     COLORS.brand,
  lesson:       "#34D399",
  story:        "#B0DEFF",
  reflection:   "#A78BFA",
  reward:       "#D4AF37",
  realm:        "#34D399",
  mode_preview: COLORS.river,
  chain:        COLORS.fire,
  community:    "#F472B6",
  arena:        "#8B5CF6",
};

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  playerLevel: number;
  /** Best star ratings per enemy id — drives star badges on battle parts. */
  battleStars?: Record<string, number>;
  /** Called when a chapter card is pressed (for expand/collapse). */
  onChapterPress?: (chapterId: string) => void;
  // C4 — chapter completion chest claim support.
  /** IDs of chapter chests already claimed (e.g. ["chest_ch1"]). */
  claimedChests?: string[];
  /** Callback fired when the player claims a chapter completion chest. */
  onChestClaim?: (chestId: string) => Promise<void>;
  // J2 — journey node first-clear claim support.
  /** IDs of journey nodes already claimed (player.claimed_journey_nodes). */
  claimedNodes?: string[];
  /** Story scene ids already watched (player.story_scenes_seen). */
  storyScenesSeen?: string[];
  /** Number of ward defense waves completed (player.ward_defense_waves). */
  wardDefenseWaves?: number;
  /** Callback fired when a journey node first-clear is claimed. */
  onNodeClaim?: (nodeId: string, stars: number) => Promise<void>;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ChapterJourneyMap({
  playerLevel,
  battleStars = {},
  claimedChests = [],
  claimedNodes = [],
  storyScenesSeen = [],
  wardDefenseWaves = 0,
  onChestClaim,
  onNodeClaim,
}: Props) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    // Default expand the active chapter.
    for (let i = CHAPTERS.length - 1; i >= 0; i--) {
      if (playerLevel >= CHAPTERS[i].levelGate) return CHAPTERS[i].id;
    }
    return CHAPTERS[0].id;
  });

  const toggle = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <View style={styles.root}>
      {/* ── Phase 1 header ── */}
      <View style={styles.phaseHeader}>
        <View style={styles.phaseBadge}>
          <Text style={styles.phaseBadgeTxt}>PHASE 1</Text>
        </View>
        <Text style={styles.phaseTitle}>Kingdom of Healing</Text>
        <Text style={styles.phaseSub} numberOfLines={3}>{PHASE_1_SUMMARY}</Text>
      </View>

      {/* ── Chapter list ── */}
      {CHAPTERS.map((chapter, idx) => {
        const status = getChapterStatus(chapter, playerLevel);
        const isExpanded = expandedId === chapter.id;
        const chest = CHAPTER_CHESTS.find((c) => c.chapter === chapter.number);
        const chestClaimed = chest ? claimedChests.includes(chest.id) : false;
        const chestClaimable = chest && !chestClaimed && status !== "locked";
        return (
          <React.Fragment key={chapter.id}>
            <ChapterCard
              chapter={chapter}
              status={status}
              isExpanded={isExpanded}
              isFirst={idx === 0}
              isLast={idx === CHAPTERS.length - 1}
              playerLevel={playerLevel}
              battleStars={battleStars}
              chestId={chest?.id}
              chestClaimed={chestClaimed}
              chestClaimable={!!chestClaimable}
              claimedNodes={claimedNodes}
              storyScenesSeen={storyScenesSeen}
              wardDefenseWaves={wardDefenseWaves}
              onToggle={() => toggle(chapter.id)}
              onChestClaim={onChestClaim}
              onNodeClaim={onNodeClaim}
              onPartPress={(part) => {
                if (part.route && !part.isPlaceholder) {
                  router.push(part.route as any);
                }
              }}
              onUniversityPress={() => router.push("/university" as any)}
              onSkillAcademyPress={() => router.push("/university/skill-academy" as any)}
            />
            {/* C6 — Simulation→Real-Ward transition callout between Ch.8 and Ch.9 */}
            {chapter.number === 8 && (
              <View style={styles.simToRealBanner}>
                <Ionicons name="arrow-down-circle-outline" size={20} color="#06B6D4" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.simToRealTitle}>SIMULATION ERA ENDS HERE</Text>
                  <Text style={styles.simToRealSub}>
                    The simulation doors open. Chapter 9 begins real-world ward encounters — no safety net, no reset button.
                  </Text>
                </View>
              </View>
            )}
          </React.Fragment>
        );
      })}

      {/* ── Phase 2 teaser ── */}
      <View style={styles.phase2Teaser}>
        <Ionicons name="lock-closed" size={20} color={COLORS.onSurfaceTertiary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.phase2Title}>Phase 2 — Coming Soon</Text>
          <Text style={styles.phase2Sub}>
            Complete Chapter 10 and reach a higher level to unlock the next era.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── ChapterCard ───────────────────────────────────────────────────────────────

function ChapterCard({
  chapter,
  status,
  isExpanded,
  isFirst,
  isLast,
  playerLevel,
  battleStars,
  chestId,
  chestClaimed,
  chestClaimable,
  claimedNodes,
  storyScenesSeen,
  wardDefenseWaves,
  onToggle,
  onChestClaim,
  onNodeClaim,
  onPartPress,
  onUniversityPress,
  onSkillAcademyPress,
}: {
  chapter: Chapter;
  status: ChapterStatus;
  isExpanded: boolean;
  isFirst: boolean;
  isLast: boolean;
  playerLevel: number;
  battleStars: Record<string, number>;
  chestId?: string;
  chestClaimed: boolean;
  chestClaimable: boolean;
  claimedNodes: string[];
  storyScenesSeen: string[];
  wardDefenseWaves: number;
  onToggle: () => void;
  onChestClaim?: (chestId: string) => Promise<void>;
  onNodeClaim?: (nodeId: string, stars: number) => Promise<void>;
  onPartPress: (part: ChapterPart) => void;
  onUniversityPress?: () => void;
  onSkillAcademyPress?: () => void;
}) {
  const accent = status === "locked" ? COLORS.onSurfaceTertiary : chapter.accentColor;
  const isLocked = status === "locked";
  const isDone = status === "complete";
  // C3: count how many enemies of this chapter's difficulty have been cleared with ★+.
  const chapterEnemies = ENEMIES.filter((e) => e.difficulty === chapter.number && !e.worldBoss);
  const battlesCleared = chapterEnemies.filter((e) => (battleStars[e.id] ?? 0) >= 1).length;
  const battlesTotal = chapterEnemies.length;
  // J2: best star rating achieved for any enemy at this chapter's difficulty.
  const bestChapterStars = chapterEnemies.reduce(
    (best, e) => Math.max(best, battleStars[e.id] ?? 0), 0,
  );
  const anyBattleWon = battlesCleared >= 1;

  // J2: per-part eligibility check for first-clear journey node claim.
  function isNodeEligible(part: ChapterPart): boolean {
    if (isLocked) return false;
    const def = getJourneyNodeDef(part.id);
    if (!def) return false; // no reward def for this node (Ch6+)
    switch (part.type) {
      case 'story':
      case 'reflection':
        if (part.isPlaceholder) return true; // auto-eligible when chapter active
        // Non-placeholder story: eligible if the linked scene has been watched.
        const sceneId = part.route?.split('sceneId=')?.[1];
        return sceneId ? storyScenesSeen.includes(sceneId) : true;
      case 'battle':
        return anyBattleWon;
      case 'mini_boss':
        return bestChapterStars >= 2;
      case 'ward_defense':
        return wardDefenseWaves >= 1;
      case 'realm':
        return true; // placeholder task — auto-eligible when chapter active
      default:
        return false;
    }
  }

  return (
    <View style={[styles.chapterWrap, isFirst && { marginTop: 0 }]}>
      {/* Vertical connector line */}
      {!isLast && <View style={[styles.connector, { backgroundColor: isLocked ? COLORS.border : accent + "40" }]} />}

      {/* Chapter header row */}
      <Pressable
        style={[
          styles.chapterCard,
          { borderColor: isLocked ? COLORS.border : accent + "50" },
          isDone && styles.chapterCardDone,
          !isLocked && !isDone && styles.chapterCardActive,
        ]}
        onPress={onToggle}
        testID={`chapter-card-${chapter.number}`}
      >
        {/* Accent glow for active */}
        {!isLocked && !isDone && (
          <LinearGradient
            colors={[accent + "18", "transparent"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}

        {/* Chapter number circle */}
        <View style={[
          styles.chapterNumCircle,
          {
            backgroundColor: isLocked ? COLORS.surfaceTertiary : accent + "22",
            borderColor: isLocked ? COLORS.border : accent + "70",
          },
        ]}>
          {isDone ? (
            <Ionicons name="checkmark" size={16} color={accent} />
          ) : isLocked ? (
            <Ionicons name="lock-closed" size={14} color={COLORS.onSurfaceTertiary} />
          ) : (
            <Ionicons name={chapter.icon as any} size={16} color={accent} />
          )}
        </View>

        {/* Chapter info */}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.chapterTopRow}>
            <Text style={[styles.chapterNum, { color: isLocked ? COLORS.onSurfaceTertiary : accent }]}>
              CH.{chapter.number}
            </Text>
            {/* Tags */}
            {chapter.simulationEra && (
              <View style={[styles.tag, { backgroundColor: "#3A4A5522", borderColor: "#5A7A9A55" }]}>
                <Text style={[styles.tagTxt, { color: "#8EAEC8" }]}>SIMULATION</Text>
              </View>
            )}
            {chapter.realWorldTransition && (
              <View style={[styles.tag, { backgroundColor: COLORS.river + "22", borderColor: COLORS.river + "60" }]}>
                <Text style={[styles.tagTxt, { color: COLORS.river }]}>REAL WARD</Text>
              </View>
            )}
            {chapter.phaseFinale && (
              <View style={[styles.tag, { backgroundColor: COLORS.error + "22", borderColor: COLORS.error + "60" }]}>
                <Text style={[styles.tagTxt, { color: COLORS.error }]}>PHASE FINALE</Text>
              </View>
            )}
          </View>
          <Text style={[styles.chapterTheme, { color: isLocked ? COLORS.onSurfaceTertiary : COLORS.onSurface }]}>
            {chapter.theme}
          </Text>
          <View style={styles.chapterMetaRow}>
            <Text style={[styles.chapterMeta, { color: COLORS.onSurfaceTertiary }]}>
              {chapter.parts.length} parts · Level {chapter.levelGate}+
            </Text>
            {/* C3: battle cleared count badge */}
            {battlesTotal > 0 && battlesCleared > 0 && (
              <View style={[styles.battleClearedBadge, { borderColor: accent + "60", backgroundColor: accent + "12" }]}>
                <Ionicons name="star" size={9} color={accent} />
                <Text style={[styles.battleClearedTxt, { color: accent }]}>
                  {battlesCleared}/{battlesTotal}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* C4 — Chapter chest button (visible when not locked) */}
        {chestId && !isLocked && (
          <Pressable
            style={[
              styles.chestBtn,
              chestClaimed && styles.chestBtnClaimed,
              chestClaimable && styles.chestBtnClaimable,
            ]}
            onPress={
              chestClaimable && onChestClaim
                ? (e) => {
                    e.stopPropagation?.();
                    onChestClaim(chestId);
                  }
                : undefined
            }
            disabled={!chestClaimable || !onChestClaim}
            hitSlop={6}
            testID={`chapter-chest-${chapter.number}`}
          >
            <Ionicons
              name={chestClaimed ? "checkmark-circle" : "gift"}
              size={16}
              color={
                chestClaimed
                  ? "#D4AF37"
                  : chestClaimable
                  ? "#D4AF37"
                  : COLORS.onSurfaceTertiary
              }
            />
          </Pressable>
        )}

        {/* Expand chevron */}
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={isLocked ? COLORS.onSurfaceTertiary : accent}
        />
      </Pressable>

      {/* ── Parts list (expanded) ── */}
      {isExpanded && (
        <View style={styles.partsList}>
          {chapter.parts.map((part, idx) => {
            const eligible = isNodeEligible(part);
            const claimed  = claimedNodes.includes(part.id);
            // Stars to pass on claim: use best chapter stars for battle nodes;
            // story/realm/reflection always get 3 (flat reward, no scaling).
            const claimStars = (
              part.type === 'battle' || part.type === 'mini_boss' || part.type === 'ward_defense'
            ) ? Math.max(1, bestChapterStars) : 3;
            // J5: Ward Defense nodes require playerLevel >= 4 (safety gate).
            // Chapter 4 itself is locked below Level 4, so this only fires if
            // somehow the chapter unlocks but the mode hasn't been reached yet.
            const isWardDefenseLocked = part.type === 'ward_defense' && playerLevel < 4;
            return (
              <PartRow
                key={part.id}
                part={part}
                index={idx}
                chapterNumber={chapter.number}
                chapterAccent={chapter.accentColor}
                chapterLocked={isLocked}
                isWardDefenseLocked={isWardDefenseLocked}
                onPress={() => onPartPress(part)}
                isLast={idx === chapter.parts.length - 1}
                isEligible={eligible}
                isClaimed={claimed}
                claimStars={claimStars}
                onClaim={onNodeClaim ? () => onNodeClaim(part.id, claimStars) : undefined}
              />
            );
          })}

          {/* Locked chapter body message */}
          {isLocked && (
            <View style={styles.lockedMsg}>
              <Ionicons name="shield-half" size={14} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.lockedMsgTxt}>
                Field Practice Required. Complete University practice, replay cleared shifts, or improve hero skills before continuing.
              </Text>
            </View>
          )}

          {/* J1/J5: University Prep Tips — non-node recommendations (only for unlocked chapters).
              J5 adds tappable "Practice at University" and "Upgrade Hero Skills" action links. */}
          {!isLocked && chapter.prepTips && chapter.prepTips.length > 0 && (
            <View style={styles.prepTipsSection}>
              <View style={styles.prepTipsHeader}>
                <Ionicons name="school-outline" size={12} color={accent} />
                <Text style={[styles.prepTipsTitle, { color: accent }]}>UNIVERSITY PREP</Text>
                <Text style={styles.prepTipsSub}>Recommended before chapter battles</Text>
              </View>
              {chapter.prepTips.map((tip, i) => (
                <View key={i} style={styles.prepTipRow}>
                  <View style={[styles.prepTipDot, { backgroundColor: accent + "60" }]} />
                  <Text style={styles.prepTipTxt}>{tip}</Text>
                </View>
              ))}
              {/* J5: "Having trouble?" — tappable shortcuts to relevant University screens */}
              <View style={styles.prepTipsHintRow}>
                <Ionicons name="information-circle-outline" size={11} color={COLORS.onSurfaceTertiary} />
                <Text style={styles.prepTipsHintTxt}>
                  Having trouble? Practice these topics at Clinica University before returning to the ward.
                </Text>
              </View>
              <View style={styles.prepTipsActionRow}>
                <Pressable
                  style={[styles.prepTipsActionBtn, { borderColor: accent + "55" }]}
                  onPress={onUniversityPress}
                  hitSlop={6}
                >
                  <Ionicons name="school-outline" size={11} color={accent} />
                  <Text style={[styles.prepTipsActionTxt, { color: accent }]}>Practice at University</Text>
                  <Ionicons name="arrow-forward" size={10} color={accent} />
                </Pressable>
                <Pressable
                  style={[styles.prepTipsActionBtn, { borderColor: "#A78BFA55" }]}
                  onPress={onSkillAcademyPress}
                  hitSlop={6}
                >
                  <Ionicons name="flash-outline" size={11} color="#A78BFA" />
                  <Text style={[styles.prepTipsActionTxt, { color: "#A78BFA" }]}>Upgrade Hero Skills</Text>
                  <Ionicons name="arrow-forward" size={10} color="#A78BFA" />
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── PartRow ───────────────────────────────────────────────────────────────────

// J5: Minimum player level required to enter a Ward Defense node.
const WARD_DEFENSE_MIN_LEVEL = 4;

function PartRow({
  part,
  index,
  chapterNumber,
  chapterAccent,
  chapterLocked,
  isWardDefenseLocked = false,
  onPress,
  isLast,
  isEligible = false,
  isClaimed = false,
  claimStars = 3,
  onClaim,
}: {
  part: ChapterPart;
  index: number;
  chapterNumber: number;
  chapterAccent: string;
  chapterLocked: boolean;
  /** J5: true when this ward_defense node is not yet reachable by the player's level. */
  isWardDefenseLocked?: boolean;
  onPress: () => void;
  isLast: boolean;
  // J2 — first-clear claim state
  isEligible?: boolean;
  isClaimed?: boolean;
  claimStars?: number;
  onClaim?: () => Promise<void>;
}) {
  const [claiming, setClaiming] = React.useState(false);
  const typeColor = (chapterLocked || isWardDefenseLocked) ? COLORS.onSurfaceTertiary : PART_TYPE_COLOR[part.type];
  const isActionable = !!part.route && !part.isPlaceholder && !chapterLocked && !isWardDefenseLocked;
  // J1: node label "1-1", "1-2", etc.
  const nodeLabel = `${chapterNumber}-${part.part}`;
  // J2: look up the journey reward def to display accurate reward chips.
  const def = getJourneyNodeDef(part.id);
  // Compute the reward preview at the player's current stars (or 3★ for story).
  const rewardPreview = def ? computeJourneyReward(def, claimStars) : null;

  async function handleClaim() {
    if (!onClaim || claiming) return;
    setClaiming(true);
    try { await onClaim(); } finally { setClaiming(false); }
  }

  return (
    <View style={[styles.partWrap, !isLast && styles.partDivider]}>
      {/* Part number indicator with X-Y node label */}
      <View style={styles.partNumCol}>
        <View style={[styles.partNum, { backgroundColor: chapterLocked ? COLORS.surfaceTertiary : chapterAccent + "18" }]}>
          <Text style={[styles.partNumTxt, { color: chapterLocked ? COLORS.onSurfaceTertiary : chapterAccent }]}>
            {index + 1}
          </Text>
        </View>
        <Text style={[styles.nodeLabelTxt, { color: chapterLocked ? COLORS.onSurfaceTertiary + "80" : chapterAccent + "90" }]}>
          {nodeLabel}
        </Text>
      </View>

      {/* Part content */}
      <Pressable
        style={[styles.partContent, isActionable && styles.partActionable]}
        onPress={isActionable ? onPress : undefined}
        testID={`chapter-part-${part.id}`}
      >
        <View style={styles.partTopRow}>
          <View style={[styles.partTypeBadge, { backgroundColor: typeColor + "18" }]}>
            <Text style={[styles.partTypeTxt, { color: typeColor }]}>
              {PART_TYPE_LABEL[part.type]}
            </Text>
          </View>
          {part.isPlaceholder && !chapterLocked && (
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonTxt}>COMING SOON</Text>
            </View>
          )}
          {isActionable && (
            <Ionicons name="arrow-forward" size={14} color={chapterAccent} />
          )}
        </View>

        <View style={styles.partTitleRow}>
          <Ionicons
            name={part.icon as any}
            size={14}
            color={chapterLocked ? COLORS.onSurfaceTertiary : typeColor}
          />
          <Text
            style={[
              styles.partTitle,
              { color: chapterLocked ? COLORS.onSurfaceTertiary : COLORS.onSurface },
            ]}
            numberOfLines={2}
          >
            {part.title}
          </Text>
        </View>

        <Text
          style={[styles.partDesc, { color: COLORS.onSurfaceTertiary }]}
          numberOfLines={2}
        >
          {part.description}
        </Text>

        {/* J5 — Ward Defense locked banner: shown when playerLevel < 4 */}
        {isWardDefenseLocked && (
          <View style={styles.wardDefenseLockedBanner}>
            <Ionicons name="lock-closed-outline" size={11} color={COLORS.onSurfaceTertiary} />
            <Text style={styles.wardDefenseLockedTxt}>
              Ward Defense opens at Level {WARD_DEFENSE_MIN_LEVEL}. Complete Field Practice and return when your ward readiness improves.
            </Text>
          </View>
        )}

        {/* J2 — reward chips: use journeyRewards.ts values as source of truth.
            Fall back to chapterJourney.ts display fields for Ch6+ nodes. */}
        {rewardPreview ? (
          <View style={styles.rewardRow}>
            {rewardPreview.playerXp > 0 && (
              <View style={styles.rewardChip}>
                <Ionicons name="star-outline" size={9} color="#F59E0B" />
                <Text style={[styles.rewardChipTxt, { color: "#F59E0B" }]}>
                  {def!.starsScale ? `≤${def!.playerXp}` : `+${rewardPreview.playerXp}`} XP
                </Text>
              </View>
            )}
            {rewardPreview.heroXp > 0 && (
              <View style={styles.rewardChip}>
                <Ionicons name="person-outline" size={9} color="#FB923C" />
                <Text style={[styles.rewardChipTxt, { color: "#FB923C" }]}>
                  {def!.starsScale ? `≤${def!.heroXp}` : `+${rewardPreview.heroXp}`} Hero XP
                </Text>
              </View>
            )}
            {rewardPreview.coins > 0 && (
              <View style={styles.rewardChip}>
                <Ionicons name="cash-outline" size={9} color="#D4AF37" />
                <Text style={[styles.rewardChipTxt, { color: "#D4AF37" }]}>
                  {def!.starsScale ? `≤${def!.coins}` : `+${rewardPreview.coins}`} Coins
                </Text>
              </View>
            )}
            {(rewardPreview.credits ?? 0) > 0 && (
              <View style={styles.rewardChip}>
                <Ionicons name="school-outline" size={9} color="#2DD4BF" />
                <Text style={[styles.rewardChipTxt, { color: "#2DD4BF" }]}>+{rewardPreview.credits} Credits</Text>
              </View>
            )}
            {(rewardPreview.shards ?? 0) > 0 && (
              <View style={styles.rewardChip}>
                <Ionicons name="diamond-outline" size={9} color="#A78BFA" />
                <Text style={[styles.rewardChipTxt, { color: "#A78BFA" }]}>
                  {def!.starsScale ? `≤${def!.shards}` : `+${rewardPreview.shards}`} Shards
                </Text>
              </View>
            )}
          </View>
        ) : (part.rewardXp || part.rewardCredits || part.rewardCoins || part.rewardShards) ? (
          // Fallback for Ch6+ nodes without a journeyRewards.ts def
          <View style={styles.rewardRow}>
            {!!part.rewardXp && (
              <View style={styles.rewardChip}>
                <Ionicons name="star-outline" size={9} color="#F59E0B" />
                <Text style={[styles.rewardChipTxt, { color: "#F59E0B" }]}>+{part.rewardXp} XP</Text>
              </View>
            )}
            {!!part.rewardCoins && (
              <View style={styles.rewardChip}>
                <Ionicons name="cash-outline" size={9} color="#D4AF37" />
                <Text style={[styles.rewardChipTxt, { color: "#D4AF37" }]}>+{part.rewardCoins} Coins</Text>
              </View>
            )}
          </View>
        ) : null}

        {/* J2 — CLAIM / CLAIMED button for first-clear journey node reward */}
        {def && !chapterLocked && (
          isClaimed ? (
            <View style={styles.nodeClaimedBadge}>
              <Ionicons name="checkmark-circle" size={11} color="#34D399" />
              <Text style={styles.nodeClaimedTxt}>CLAIMED</Text>
            </View>
          ) : isEligible && onClaim ? (
            <Pressable
              style={[styles.nodeClaimBtn, claiming && styles.nodeClaimBtnBusy]}
              onPress={handleClaim}
              disabled={claiming}
              hitSlop={6}
            >
              <Ionicons name="gift-outline" size={11} color="#FFFFFF" />
              <Text style={styles.nodeClaimBtnTxt}>{claiming ? "…" : "CLAIM"}</Text>
            </Pressable>
          ) : null
        )}
      </Pressable>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    paddingBottom: SPACING.xl,
  },

  // Phase header
  phaseHeader: {
    alignItems: "center",
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  phaseBadge: {
    backgroundColor: COLORS.brandTertiary,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.brand + "60",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  phaseBadgeTxt: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: COLORS.brand,
  },
  phaseTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.onSurface,
    letterSpacing: 0.3,
  },
  phaseSub: {
    fontSize: 12,
    color: COLORS.onSurfaceTertiary,
    textAlign: "center",
    lineHeight: 18,
  },

  // Chapter wrapper
  chapterWrap: {
    marginTop: SPACING.sm,
    marginHorizontal: SPACING.md,
  },
  connector: {
    position: "absolute",
    left: 19,
    top: 56,
    bottom: -SPACING.sm,
    width: 2,
    zIndex: 0,
  },

  // Chapter card
  chapterCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    overflow: "hidden",
    zIndex: 1,
  },
  chapterCardActive: {
    backgroundColor: COLORS.surfaceSecondary,
  },
  chapterCardDone: {
    opacity: 0.7,
  },

  chapterNumCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chapterTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    flexWrap: "wrap",
  },
  chapterNum: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  chapterTheme: {
    fontSize: 14,
    fontWeight: "600",
  },
  chapterMeta: {
    fontSize: 11,
  },
  chapterMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  battleClearedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  battleClearedTxt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // C4 — chapter chest button
  chestBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.surfaceTertiary,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chestBtnClaimed: {
    backgroundColor: "#D4AF3720",
    borderColor: "#D4AF3780",
  },
  chestBtnClaimable: {
    backgroundColor: "#D4AF3730",
    borderColor: "#D4AF37",
  },

  // Tags
  tag: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  tagTxt: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  // Parts list
  partsList: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
    marginLeft: 20,
    overflow: "hidden",
  },
  partWrap: {
    flexDirection: "row",
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
  partDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  partNumCol: {
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
    marginTop: 2,
  },
  partNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  partNumTxt: {
    fontSize: 11,
    fontWeight: "700",
  },
  nodeLabelTxt: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  partContent: {
    flex: 1,
    gap: 4,
  },
  partActionable: {
    // slight highlight when tappable handled via press state
  },
  partTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    flexWrap: "wrap",
  },
  partTypeBadge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  partTypeTxt: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  comingSoonBadge: {
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  comingSoonTxt: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.onSurfaceTertiary,
    letterSpacing: 0.8,
  },
  partTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.xs,
  },
  partTitle: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    lineHeight: 18,
  },
  partDesc: {
    fontSize: 11,
    lineHeight: 15,
  },

  // Reward chips
  rewardRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  rewardChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceTertiary,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  rewardChipTxt: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // J2 — journey node CLAIM / CLAIMED buttons
  nodeClaimBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: "#16A34A",
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  nodeClaimBtnBusy: {
    opacity: 0.5,
  },
  nodeClaimBtnTxt: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  nodeClaimedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    marginTop: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: "#34D39940",
    backgroundColor: "#34D39912",
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  nodeClaimedTxt: {
    fontSize: 9,
    fontWeight: "800",
    color: "#34D399",
    letterSpacing: 0.8,
  },

  // Locked message
  lockedMsg: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    padding: SPACING.sm,
    paddingTop: 0,
  },
  lockedMsgTxt: {
    fontSize: 12,
    color: COLORS.onSurfaceTertiary,
    fontStyle: "italic",
  },

  // J1: University Prep Tips section
  prepTipsSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    gap: 4,
  },
  prepTipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  prepTipsTitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  prepTipsSub: {
    fontSize: 9,
    color: COLORS.onSurfaceTertiary,
    fontStyle: "italic",
    flex: 1,
  },
  prepTipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingVertical: 2,
  },
  prepTipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 5,
    flexShrink: 0,
  },
  prepTipTxt: {
    fontSize: 11,
    color: COLORS.onSurfaceSecondary,
    lineHeight: 15,
    flex: 1,
  },
  // J5: "Having trouble?" hint row above action buttons
  prepTipsHintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  prepTipsHintTxt: {
    fontSize: 10,
    color: COLORS.onSurfaceTertiary,
    fontStyle: "italic",
    flex: 1,
    lineHeight: 14,
  },
  // J5: row of "Practice at University" + "Upgrade Hero Skills" action buttons
  prepTipsActionRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  prepTipsActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: COLORS.surfaceTertiary,
  },
  prepTipsActionTxt: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  // J5: Ward Defense locked banner inside a PartRow
  wardDefenseLockedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    marginTop: 5,
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  wardDefenseLockedTxt: {
    fontSize: 11,
    color: COLORS.onSurfaceTertiary,
    fontStyle: "italic",
    flex: 1,
    lineHeight: 15,
  },

  // Phase 2 teaser
  phase2Teaser: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    padding: SPACING.md,
    opacity: 0.6,
  },
  phase2Title: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.onSurfaceSecondary,
  },
  phase2Sub: {
    fontSize: 11,
    color: COLORS.onSurfaceTertiary,
    lineHeight: 16,
    marginTop: 2,
  },

  // C6: Simulation→Real-Ward transition callout (between Ch.8 and Ch.9 cards)
  simToRealBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
    backgroundColor: "#06B6D40A",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#06B6D430",
    padding: SPACING.sm,
  },
  simToRealTitle: {
    fontSize: 9,
    fontWeight: "700",
    color: "#06B6D4",
    letterSpacing: 1,
    marginBottom: 2,
  },
  simToRealSub: {
    fontSize: 11,
    color: COLORS.onSurfaceTertiary,
    lineHeight: 15,
  },
});
