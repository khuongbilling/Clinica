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
import { useState } from "react";
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
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── Part type label + color helpers ──────────────────────────────────────────

const PART_TYPE_LABEL: Record<ChapterPartType, string> = {
  battle:       "SHIFT",
  minigame:     "MINI-GAME",
  lesson:       "LESSON",
  story:        "STORY",
  reward:       "REWARD",
  realm:        "REALM",
  mode_preview: "PREVIEW",
  chain:        "CHAIN",
  community:    "COMMUNITY",
  arena:        "ARENA",
};

const PART_TYPE_COLOR: Record<ChapterPartType, string> = {
  battle:       COLORS.error,
  minigame:     COLORS.brand,
  lesson:       "#34D399",
  story:        "#B0DEFF",
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
  /** Called when a chapter card is pressed (for expand/collapse). */
  onChapterPress?: (chapterId: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ChapterJourneyMap({ playerLevel }: Props) {
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
        return (
          <ChapterCard
            key={chapter.id}
            chapter={chapter}
            status={status}
            isExpanded={isExpanded}
            isFirst={idx === 0}
            isLast={idx === CHAPTERS.length - 1}
            onToggle={() => toggle(chapter.id)}
            onPartPress={(part) => {
              if (part.route && !part.isPlaceholder) {
                router.push(part.route as any);
              }
            }}
          />
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
  onToggle,
  onPartPress,
}: {
  chapter: Chapter;
  status: ChapterStatus;
  isExpanded: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onPartPress: (part: ChapterPart) => void;
}) {
  const accent = status === "locked" ? COLORS.onSurfaceTertiary : chapter.accentColor;
  const isLocked = status === "locked";
  const isDone = status === "complete";

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
          <Text style={[styles.chapterMeta, { color: COLORS.onSurfaceTertiary }]}>
            {chapter.parts.length} parts · Level {chapter.levelGate}+
          </Text>
        </View>

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
          {chapter.parts.map((part, idx) => (
            <PartRow
              key={part.id}
              part={part}
              index={idx}
              chapterAccent={chapter.accentColor}
              chapterLocked={isLocked}
              onPress={() => onPartPress(part)}
              isLast={idx === chapter.parts.length - 1}
            />
          ))}

          {/* Locked chapter body message */}
          {isLocked && (
            <View style={styles.lockedMsg}>
              <Ionicons name="lock-closed" size={14} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.lockedMsgTxt}>
                Reach Level {chapter.levelGate} to begin this chapter.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── PartRow ───────────────────────────────────────────────────────────────────

function PartRow({
  part,
  index,
  chapterAccent,
  chapterLocked,
  onPress,
  isLast,
}: {
  part: ChapterPart;
  index: number;
  chapterAccent: string;
  chapterLocked: boolean;
  onPress: () => void;
  isLast: boolean;
}) {
  const typeColor = chapterLocked ? COLORS.onSurfaceTertiary : PART_TYPE_COLOR[part.type];
  const isActionable = !!part.route && !part.isPlaceholder && !chapterLocked;

  return (
    <View style={[styles.partWrap, !isLast && styles.partDivider]}>
      {/* Part number indicator */}
      <View style={[styles.partNum, { backgroundColor: chapterLocked ? COLORS.surfaceTertiary : chapterAccent + "18" }]}>
        <Text style={[styles.partNumTxt, { color: chapterLocked ? COLORS.onSurfaceTertiary : chapterAccent }]}>
          {index + 1}
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
  partNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  partNumTxt: {
    fontSize: 11,
    fontWeight: "700",
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
});
