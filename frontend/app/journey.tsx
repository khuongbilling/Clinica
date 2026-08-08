/**
 * /journey — Chapter Journey Map screen
 *
 * Tabs: Chapter | Quests | Memories
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ROUTES, dynRoute, type AppRoute } from "@/src/game/routes";
import { FEATURE_FLAG_JOURNEY_FOG_MAP_V1 } from "@/src/game/featureFlags";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Chapter1VisualMap } from "@/src/components/Chapter1VisualMap";
import { Chapter2VisualMap } from "@/src/components/Chapter2VisualMap";
import { Chapter3VisualMap } from "@/src/components/Chapter3VisualMap";
import { Chapter4VisualMap } from "@/src/components/Chapter4VisualMap";
import { Chapter5VisualMap } from "@/src/components/Chapter5VisualMap";
import { GenericChapterVisualMap } from "@/src/components/GenericChapterVisualMap";
import { FogboundTileMap } from "@/src/components/FogboundTileMap";
import { BranchingTriageMap } from "@/src/components/BranchingTriageMap";
import { WardRestorationMap } from "@/src/components/WardRestorationMap";
import { DualStateMap } from "@/src/components/DualStateMap";
import { getDefaultFogMapConfig } from "@/src/game/fogTileMap";
import { RPGTabBar, RPGTab } from "@/src/components/RPGTabBar";
import { JourneyEmblem, LotusLessonsEmblem, WardDefenseEmblem, LotusJournalEmblem } from "@/src/components/ClinicaEmblems";
import { DailyRoundsPanel } from "@/src/components/DailyRoundsPanel";
import { getMapSprite } from "@/src/game/illustratedAssets";
import { firstIncompleteLotusNode, isLotusNodeComplete, LOTUS_PATHS } from "@/src/game/lotusLessons";
import {
  CHAPTERS,
  Chapter,
  ChapterPart,
  ChapterStatus,
  getCurrentChapter,
  getChapterFailureHint,
  getChapterStatus,
  getNextRecommendedPart,
} from "@/src/game/chapterJourney";
import { playerLevelFromXp } from "@/src/game/progression";
import { ensureFreshDailyRounds, claimableCount, checkInAvailable } from "@/src/game/dailyRounds";
import { usePlayer } from "@/src/game/store";
import React, { useEffect, useRef, useState } from "react";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";


export default function JourneyScreen() {
  const router = useRouter();
  const { player, loading, claimJourneyNode } = usePlayer();
  const [activeTab, setActiveTab]       = useState("chapter");
  const [showRounds, setShowRounds]     = useState(false);
  const [selectedChapterIdx, setSelectedChapterIdx] = useState<number>(0);
  const chapterIdxInitialized = useRef(false);

  // Auto-select the player's current chapter on first load
  useEffect(() => {
    if (!player || chapterIdxInitialized.current) return;
    chapterIdxInitialized.current = true;
    const lvl     = playerLevelFromXp(player.xp ?? 0).level;
    const claimed = player.claimed_journey_nodes ?? [];
    const current = getCurrentChapter(lvl, claimed);
    const idx     = Math.max(0, CHAPTERS.findIndex((ch) => ch.id === current.id));
    setSelectedChapterIdx(idx);
  }, [player]);

  if (loading || !player) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={["top", "bottom"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  const { level: playerLevel } = playerLevelFromXp(player.xp ?? 0);
  const leadHeroId   = player.active_team?.[0] ?? "novice_guardian";
  const leadHeroSprite = getMapSprite(leadHeroId);
  const claimedNodes = player.claimed_journey_nodes ?? [];
  const currentChapter = getCurrentChapter(playerLevel, claimedNodes);
  const nextStep     = getNextRecommendedPart(playerLevel, claimedNodes);

  // Field practice / chapter gate logic
  const hasBattleStars = Object.keys(player.battle_stars ?? {}).length > 0;
  const nextLockedChapter = CHAPTERS.find(
    (ch) => getChapterStatus(ch, playerLevel, claimedNodes) === "locked",
  );
  const showFieldPracticeStrip = !!nextLockedChapter && hasBattleStars;
  const nextLockLevelGate = nextLockedChapter?.levelGate ?? 0;
  const nextLockIsLevelGate = !!nextLockedChapter && playerLevel < nextLockLevelGate;
  const prevChapterForNextLock = nextLockedChapter
    ? CHAPTERS.find((c) => c.number === nextLockedChapter.number - 1) : null;
  const prevRequired = prevChapterForNextLock?.requiredCompletionNodes ?? [];
  const nextLockIsCompletionGate =
    prevRequired.length > 0 && !prevRequired.every((id) => claimedNodes.includes(id));
  const fieldPracticeTitle =
    nextLockIsCompletionGate && !nextLockIsLevelGate
      ? "Complete Required Battles" : "Field Practice Required";
  const fieldPracticeSubtext =
    nextLockIsLevelGate && nextLockIsCompletionGate
      ? `Complete Chapter ${(nextLockedChapter?.number ?? 1) - 1} battles and reach Level ${nextLockLevelGate}.`
      : nextLockIsLevelGate
      ? `Reach Level ${nextLockLevelGate} to unlock Chapter ${nextLockedChapter?.number}.`
      : nextLockIsCompletionGate
      ? `Complete Chapter ${(nextLockedChapter?.number ?? 1) - 1}'s required battles.`
      : "Keep progressing through the current chapter.";

  // University support strip
  const totalFailures = Object.values(player.failure_counts ?? {}).reduce(
    (sum: number, v) => sum + ((v as number) || 0), 0,
  );
  const failureHint = getChapterFailureHint(currentChapter.number);
  const showUniversitySupport = totalFailures >= 3 && !!failureHint && !showFieldPracticeStrip;

  // Quests tab
  const roundsFresh = ensureFreshDailyRounds(player.daily_rounds, [], player.id).state;
  const roundsBadge = claimableCount(roundsFresh) + (checkInAvailable(roundsFresh) ? 1 : 0);

  // Memories tab — memory fragments from claimed journey nodes
  const memoryNodes = CHAPTERS.flatMap((ch) =>
    ch.parts.filter((p) => p.type === "memory_fragment" && claimedNodes.includes(p.id)),
  );
  const lockedMemoryNodes = CHAPTERS.flatMap((ch) =>
    ch.parts.filter((p) => p.type === "memory_fragment" && !claimedNodes.includes(p.id)),
  );

  const nextLotusNode    = firstIncompleteLotusNode(player);
  const lotusCompleted   = (player.lessons_completed ?? []).filter(id => id.startsWith('lotus:')).length;

  const TABS_WITH_BADGE: RPGTab[] = [
    { key: "chapter",  label: "Chapter",  emblem: (a) => <JourneyEmblem      size={14} color={a ? UI.onGold : UI.gold} /> },
    { key: "lessons",  label: "Lessons",  emblem: (a) => <LotusLessonsEmblem size={14} color={a ? UI.onGold : UI.gold} /> },
    { key: "quests",   label: "Quests",   emblem: (a) => <WardDefenseEmblem  size={14} color={a ? UI.onGold : UI.gold} />, badge: roundsBadge || undefined },
    { key: "memories", label: "Memories", emblem: (a) => <LotusJournalEmblem size={14} color={a ? UI.onGold : UI.gold} /> },
  ];

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="journey-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10} testID="journey-back">
          <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>PHASE 1 · CHAPTERS 1–10</Text>
          <Text style={styles.title}>Chapter Journey</Text>
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelTxt}>Lv.{playerLevel}</Text>
        </View>
      </View>

      <RPGTabBar tabs={TABS_WITH_BADGE} activeTab={activeTab} onTabPress={setActiveTab} />

      {/* ── CHAPTER TAB ── */}
      {activeTab === "chapter" && (
        <>
          {showFieldPracticeStrip && (
            <Pressable
              style={styles.fieldPracticeStrip}
              onPress={() =>
                nextLockIsCompletionGate && !nextLockIsLevelGate
                  ? router.push(ROUTES.JOURNEY)
                  : router.push(dynRoute.mode("ward-shift"))
              }
              testID="journey-field-practice-strip"
            >
              <Ionicons
                name={nextLockIsCompletionGate && !nextLockIsLevelGate ? "medical" : "shield-half"}
                size={16} color={COLORS.error}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldPracticeTitle}>{fieldPracticeTitle}</Text>
                <Text style={styles.fieldPracticeSub}>{fieldPracticeSubtext}</Text>
              </View>
              <Ionicons name="arrow-forward" size={14} color={COLORS.error} />
            </Pressable>
          )}

          {showUniversitySupport && failureHint && (
            <View style={styles.universitySupportStrip} testID="journey-university-support">
              <Ionicons name="school-outline" size={16} color={COLORS.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.universitySupportTitle}>Having Trouble?</Text>
                <Text style={styles.universitySupportSub}>{failureHint.text}</Text>
                <View style={styles.universitySupportBtnRow}>
                  <Pressable style={styles.universitySupportBtn}
                    onPress={() => router.push(failureHint.primaryRoute)}>
                    <Text style={styles.universitySupportBtnTxt}>Practice at University</Text>
                  </Pressable>
                  <Pressable style={[styles.universitySupportBtn, styles.universitySupportBtnSecondary]}
                    onPress={() => router.push(failureHint.secondaryRoute)}>
                    <Text style={[styles.universitySupportBtnTxt, { color: "#A78BFA" }]}>Upgrade Skills</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {nextStep && (
            <Pressable
              style={styles.nextStepStrip}
              onPress={() => {
                if (nextStep.part.route && !nextStep.part.isPlaceholder) {
                  const isStoryNode =
                    nextStep.part.type === "story" || nextStep.part.type === "memory_fragment";
                  const route =
                    isStoryNode && nextStep.part.route.includes("story-scene")
                      ? nextStep.part.route + "&returnTo=%2Fjourney"
                      : nextStep.part.route;
                  router.push(route as AppRoute);
                }
              }}
              testID="journey-next-step"
            >
              <View style={[styles.nextDot, { backgroundColor: currentChapter.accentColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.nextKicker, { color: currentChapter.accentColor }]}>
                  NEXT · CH.{currentChapter.number} — PART {nextStep.part.part}
                </Text>
                <Text style={styles.nextTitle} numberOfLines={1}>{nextStep.part.title}</Text>
              </View>
              {nextStep.part.route && !nextStep.part.isPlaceholder ? (
                <Ionicons name="arrow-forward-circle" size={20} color={currentChapter.accentColor} />
              ) : (
                <View style={styles.comingSoonPill}>
                  <Text style={styles.comingSoonTxt}>SOON</Text>
                </View>
              )}
            </Pressable>
          )}

          {/* ── Chapter selector tabs ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chapterSelectorBar}
            contentContainerStyle={styles.chapterSelectorContent}
          >
            {CHAPTERS.map((ch, idx) => {
              const st       = getChapterStatus(ch, playerLevel, claimedNodes);
              const locked   = st === "locked";
              const selected = idx === selectedChapterIdx;
              return (
                <Pressable
                  key={ch.id}
                  style={[
                    styles.chapterTab,
                    selected && { borderColor: ch.accentColor, backgroundColor: ch.accentColor + "22" },
                    locked && { opacity: 0.35 },
                  ]}
                  onPress={() => {
                    if (locked) return;
                    if (FEATURE_FLAG_JOURNEY_FOG_MAP_V1) {
                      // Push 15: navigate to the randomised fogbound chapter map.
                      // The prior visual map at /journey remains intact as a rollback
                      // fallback — re-disable the flag to restore the old flow instantly.
                      router.push(dynRoute.chapterFogMap(String(ch.number)) as AppRoute);
                    } else {
                      setSelectedChapterIdx(idx);
                    }
                  }}
                  disabled={locked}
                  testID={`journey-ch-tab-${ch.number}`}
                >
                  <Text style={[
                    styles.chapterTabNum,
                    selected && { color: ch.accentColor },
                    locked && { color: COLORS.onSurfaceTertiary },
                  ]}>
                    CH.{ch.number}
                  </Text>
                  {!locked && st === "complete" && (
                    <Ionicons name="checkmark-circle" size={8} color={ch.accentColor} />
                  )}
                  {locked && (
                    <Ionicons name="lock-closed" size={8} color={COLORS.onSurfaceTertiary + "80"} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* ── Per-chapter visual map page ── */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.chapterPageContent}
            showsVerticalScrollIndicator={false}
            testID="journey-scroll"
          >
            <ChapterPage
              chapter={CHAPTERS[selectedChapterIdx]}
              chapterStatus={getChapterStatus(CHAPTERS[selectedChapterIdx], playerLevel, claimedNodes)}
              battleStars={player.battle_stars ?? {}}
              claimedNodes={claimedNodes}
              storyScenesSeen={player.story_scenes_seen ?? []}
              leadHeroSprite={leadHeroSprite}
              onPartPress={(part) => {
                if (part.route && !part.isPlaceholder) {
                  const isStoryNode = part.type === "story" || part.type === "memory_fragment";
                  const route = isStoryNode && part.route.includes("story-scene")
                    ? part.route + "&returnTo=%2Fjourney"
                    : part.route;
                  router.push(route as AppRoute);
                }
              }}
              onNodeClaim={async (nodeId, stars) => {
                const res = await claimJourneyNode(nodeId, stars);
                if (!res.ok) console.warn("[Journey] node claim failed:", res.message);
              }}
            />
          </ScrollView>
        </>
      )}

      {/* ── LESSONS TAB ── */}
      {activeTab === "lessons" && (
        <ScrollView contentContainerStyle={styles.questsScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLbl}>Progress</Text>
          <View style={[styles.chapterCard, { borderLeftColor: COLORS.brand }]}>
            <Text style={[styles.chapterNum, { color: COLORS.brand }]}>
              {lotusCompleted} {lotusCompleted === 1 ? "Lesson" : "Lessons"} Complete
            </Text>
            <Text style={styles.chapterName}>Lotus Lessons — Vital Foundations</Text>
            {!nextLotusNode && lotusCompleted > 0 && (
              <Text style={styles.chapterNext}>All current lessons complete ✓</Text>
            )}
            {nextLotusNode && (
              <Text style={styles.chapterNext}>Up next: {nextLotusNode.title}</Text>
            )}
          </View>

          {/* Per-lesson status list — shows completion state and lets players
              optionally review completed lessons or start the next one */}
          <Text style={[styles.sectionLbl, { marginTop: SPACING.lg }]}>Lessons</Text>
          {LOTUS_PATHS.flatMap((path) => path.nodes).map((node) => {
            const done  = isLotusNodeComplete(player, node.id);
            const isNext = nextLotusNode?.id === node.id;
            return (
              <Pressable
                key={node.id}
                style={[styles.practiceBtn, done && styles.practiceBtnSecondary]}
                onPress={() => router.push(dynRoute.lotusLesson(node.id))}
                testID={`journey-lesson-${node.id}`}
              >
                <Ionicons
                  name={done ? "checkmark-circle" : isNext ? "play-circle" : "ellipse-outline"}
                  size={18}
                  color={done ? COLORS.success : isNext ? COLORS.onBrand : COLORS.onSurfaceTertiary}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.practiceBtnTxt,
                      done  && { color: COLORS.success },
                      !done && !isNext && { color: COLORS.onSurfaceTertiary },
                    ]}
                    numberOfLines={1}
                  >
                    {node.title}
                  </Text>
                  <Text style={{ color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 1 }}>
                    {done ? "Complete — tap to review" : isNext ? "Up next" : "Coming soon"}
                  </Text>
                </View>
                {done  && <Ionicons name="refresh-outline" size={14} color={COLORS.brand} />}
                {isNext && <Ionicons name="arrow-forward"  size={14} color={COLORS.onBrand} />}
              </Pressable>
            );
          })}

          <Text style={[styles.sectionLbl, { marginTop: SPACING.lg }]}>Browse</Text>
          <Pressable
            style={[styles.practiceBtn, styles.practiceBtnSecondary]}
            onPress={() => router.push(ROUTES.UNI_LESSONS)}
          >
            <Ionicons name="book" size={18} color={COLORS.brand} />
            <Text style={[styles.practiceBtnTxt, { color: COLORS.brand }]}>All Lotus Lessons</Text>
          </Pressable>
          <Pressable
            style={[styles.practiceBtn, styles.practiceBtnSecondary]}
            onPress={() => router.push(ROUTES.UNIVERSITY)}
          >
            <Ionicons name="school" size={18} color={COLORS.brand} />
            <Text style={[styles.practiceBtnTxt, { color: COLORS.brand }]}>Open Clinica University</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── QUESTS TAB ── */}
      {activeTab === "quests" && (
        <ScrollView contentContainerStyle={styles.questsScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLbl}>Daily & Weekly Progress</Text>

          <Pressable style={styles.questCard}
            onPress={() => setShowRounds(true)} testID="journey-open-rounds">
            <View style={styles.questCardIcon}>
              <Ionicons name="list" size={22} color={COLORS.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.questCardTitle}>Daily Rounds</Text>
              <Text style={styles.questCardSub}>Check-in, daily objectives, and weekly tasks.</Text>
            </View>
            {roundsBadge > 0 && (
              <View style={styles.questBadge}>
                <Text style={styles.questBadgeTxt}>{roundsBadge > 9 ? "9+" : roundsBadge}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={16} color={COLORS.onSurfaceTertiary} />
          </Pressable>

          <Text style={[styles.sectionLbl, { marginTop: SPACING.lg }]}>Current Chapter</Text>
          <View style={[styles.chapterCard, { borderLeftColor: currentChapter.accentColor }]}>
            <Text style={[styles.chapterNum, { color: currentChapter.accentColor }]}>
              Chapter {currentChapter.number}
            </Text>
            <Text style={styles.chapterName}>{currentChapter.theme}</Text>
            {nextStep && (
              <Text style={styles.chapterNext}>Next: {nextStep.part.title}</Text>
            )}
          </View>

          <Text style={[styles.sectionLbl, { marginTop: SPACING.lg }]}>Field Practice</Text>
          <Pressable style={styles.practiceBtn}
            onPress={() => router.push(dynRoute.mode("ward-shift"))}>
            <Ionicons name="shield-half" size={18} color={COLORS.onBrand} />
            <Text style={styles.practiceBtnTxt}>Enter Ward Shift</Text>
          </Pressable>
          <Pressable style={[styles.practiceBtn, styles.practiceBtnSecondary]}
            onPress={() => router.push(ROUTES.UNIVERSITY)}>
            <Ionicons name="school" size={18} color={COLORS.brand} />
            <Text style={[styles.practiceBtnTxt, { color: COLORS.brand }]}>Practice at University</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── MEMORIES TAB ── */}
      {activeTab === "memories" && (
        <ScrollView contentContainerStyle={styles.questsScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLbl}>Collected Memories</Text>
          {memoryNodes.length === 0 && (
            <View style={styles.emptyMemory}>
              <Ionicons name="book-outline" size={32} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.emptyMemoryTxt}>
                No memory fragments collected yet. Complete memory nodes on the Chapter map.
              </Text>
            </View>
          )}
          {memoryNodes.map((node) => (
            <Pressable
              key={node.id}
              style={styles.memoryCard}
              onPress={() => {
                if (node.route) router.push(node.route as AppRoute);
              }}
            >
              <Ionicons name="book" size={16} color={UI.lavender} />
              <View style={{ flex: 1 }}>
                <Text style={styles.memoryTitle}>{node.title}</Text>
                {node.description && (
                  <Text style={styles.memorySub} numberOfLines={2}>{node.description}</Text>
                )}
              </View>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            </Pressable>
          ))}

          {lockedMemoryNodes.length > 0 && (
            <>
              <Text style={[styles.sectionLbl, { marginTop: SPACING.lg }]}>
                Locked Memories ({lockedMemoryNodes.length})
              </Text>
              {lockedMemoryNodes.map((node) => (
                <View key={node.id} style={[styles.memoryCard, { opacity: 0.4 }]}>
                  <Ionicons name="lock-closed" size={16} color={COLORS.onSurfaceTertiary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memoryTitle, { color: COLORS.onSurfaceTertiary }]}>
                      {node.title}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      <DailyRoundsPanel visible={showRounds} onClose={() => setShowRounds(false)} />
    </SafeAreaView>
  );
}

// ─── ChapterPage ────────────────────────────────────────────────────────────
// Renders the appropriate visual map for a single chapter, or a locked state.

function ChapterPage({
  chapter,
  chapterStatus,
  battleStars,
  claimedNodes,
  storyScenesSeen,
  leadHeroSprite,
  onPartPress,
  onNodeClaim,
}: {
  chapter:       Chapter;
  chapterStatus: ChapterStatus;
  battleStars:   Record<string, number>;
  claimedNodes:  string[];
  storyScenesSeen: string[];
  leadHeroSprite:  ImageSourcePropType | undefined;
  onPartPress:   (part: ChapterPart) => void;
  onNodeClaim:   (nodeId: string, stars: number) => Promise<void>;
}) {
  if (chapterStatus === "locked") {
    return (
      <View style={cpStyles.lockedWrap}>
        <Ionicons name="lock-closed" size={40} color={COLORS.onSurfaceTertiary} />
        <Text style={cpStyles.lockedTitle}>Chapter {chapter.number} — {chapter.theme}</Text>
        <Text style={cpStyles.lockedSub}>Complete the previous chapter to unlock this path.</Text>
      </View>
    );
  }

  // ── MapMode dispatcher ───────────────────────────────────────────────────
  // Push 9: read chapter.mapMode and branch to the correct renderer.
  // Undefined / 'scrollable_chapter' → existing per-chapter visual maps.
  const resolvedMode = chapter.mapMode ?? 'scrollable_chapter';

  if (resolvedMode === 'fogbound_tiles') {
    const mapConfig = getDefaultFogMapConfig(chapter);
    // Player tile: bottom-centre of the grid (row 7, col 3) — stub for Push 9.
    const playerTileId = 'tile_7_3';
    return (
      <FogboundTileMap
        chapter={chapter}
        mapConfig={mapConfig}
        playerTileId={playerTileId}
        keyFragmentsCollected={0}
        stamina={8}
        maxStamina={12}
        onTilePress={() => {/* no-op stub — Push 9 */}}
        onBack={() => {/* handled by parent scroll view */}}
      />
    );
  }

  if (resolvedMode === 'branching_triage') {
    return <BranchingTriageMap />;
  }

  if (resolvedMode === 'ward_restoration') {
    return <WardRestorationMap />;
  }

  if (resolvedMode === 'dual_state') {
    return <DualStateMap />;
  }

  // ── scrollable_chapter (default) ─────────────────────────────────────────
  const shared = {
    battleStars,
    claimedNodes,
    storyScenesSeen,
    chapterAccent: chapter.accentColor,
    onPartPress,
    onNodeClaim,
    leadHeroSprite,
  };

  switch (chapter.number) {
    case 1:  return <Chapter1VisualMap {...shared} />;
    case 2:  return <Chapter2VisualMap {...shared} />;
    case 3:  return <Chapter3VisualMap {...shared} />;
    case 4:  return <Chapter4VisualMap {...shared} />;
    case 5:  return <Chapter5VisualMap {...shared} />;
    default: return <GenericChapterVisualMap {...shared} chapter={chapter} />;
  }
}

const cpStyles = StyleSheet.create({
  lockedWrap: {
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: 64,
    paddingHorizontal: SPACING.xl,
    gap:             SPACING.md,
  },
  lockedTitle: {
    fontSize:    16,
    fontWeight:  "700",
    color:       COLORS.onSurfaceTertiary,
    textAlign:   "center",
  },
  lockedSub: {
    fontSize:    13,
    color:       COLORS.onSurfaceTertiary,
    textAlign:   "center",
    lineHeight:  20,
  },
});

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: UI.sanctuaryBg },
  center: { alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: UI.sanctuaryBorder,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: UI.sanctuaryPanel, borderWidth: 1, borderColor: UI.sanctuaryBorder,
    alignItems: "center", justifyContent: "center",
  },
  kicker: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, color: COLORS.brand },
  title:  { fontSize: 18, fontWeight: "700", color: COLORS.onSurface },
  levelBadge: {
    backgroundColor: COLORS.brandTertiary, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.brand + "60",
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
  },
  levelTxt: { fontSize: 12, fontWeight: "700", color: COLORS.brand },

  // Chapter tab strips
  fieldPracticeStrip: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginTop: SPACING.xs,
    backgroundColor: COLORS.error + "12", borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.error + "50", padding: SPACING.sm,
  },
  fieldPracticeTitle: { fontSize: 12, fontWeight: "700", color: COLORS.error, letterSpacing: 0.3 },
  fieldPracticeSub:   { fontSize: 11, color: COLORS.onSurfaceTertiary, marginTop: 1, lineHeight: 15 },

  universitySupportStrip: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginTop: SPACING.xs,
    backgroundColor: COLORS.brand + "10", borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.brand + "45", padding: SPACING.sm,
  },
  universitySupportTitle: { fontSize: 12, fontWeight: "700", color: COLORS.brand, letterSpacing: 0.3 },
  universitySupportSub:   { fontSize: 11, color: COLORS.onSurfaceTertiary, marginTop: 2, lineHeight: 15 },
  universitySupportBtnRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  universitySupportBtn: { backgroundColor: COLORS.brand, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 5 },
  universitySupportBtnSecondary: { backgroundColor: "#A78BFA20", borderWidth: 1, borderColor: "#A78BFA55" },
  universitySupportBtnTxt: { fontSize: 11, fontWeight: "700", color: COLORS.onBrand, letterSpacing: 0.5 },

  nextStepStrip: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginVertical: SPACING.sm,
    backgroundColor: UI.sanctuaryPanel, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: UI.sanctuaryBorder, padding: SPACING.sm,
  },
  nextDot:   { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  nextKicker: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  nextTitle:  { fontSize: 13, fontWeight: "600", color: COLORS.onSurface, marginTop: 1 },
  comingSoonPill: { backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 3 },
  comingSoonTxt:  { fontSize: 9, fontWeight: "700", color: COLORS.onSurfaceTertiary, letterSpacing: 0.8 },

  scroll:            { flex: 1 },
  scrollContent:     { paddingBottom: SPACING.xl },
  chapterPageContent: { paddingBottom: SPACING.xl },

  // Chapter selector tab bar
  chapterSelectorBar: {
    flexShrink: 0,
    maxHeight:  52,
    borderBottomWidth: 1,
    borderBottomColor: UI.sanctuaryBorder,
  },
  chapterSelectorContent: {
    paddingHorizontal: SPACING.sm,
    paddingVertical:   SPACING.xs,
    gap:               6,
    alignItems:        "center",
    flexDirection:     "row",
  } as const,
  chapterTab: {
    paddingHorizontal: SPACING.sm,
    paddingVertical:   6,
    borderRadius:      RADIUS.sm,
    borderWidth:       1,
    borderColor:       UI.sanctuaryBorder,
    alignItems:        "center",
    gap:               2,
    minWidth:          46,
  } as const,
  chapterTabNum: {
    fontSize:      10,
    fontWeight:    "700",
    color:         COLORS.onSurfaceSecondary,
    letterSpacing: 0.5,
  },

  // Quests / Memories shared
  questsScroll: { padding: SPACING.md, paddingBottom: 80, gap: SPACING.sm },
  sectionLbl:   { color: COLORS.onSurfaceTertiary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },

  questCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: UI.sanctuaryPanel, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: UI.sanctuaryBorder, padding: SPACING.md,
  },
  questCardIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.brand + "18", alignItems: "center", justifyContent: "center",
  },
  questCardTitle: { color: COLORS.onSurface, fontSize: 16, fontWeight: "700" },
  questCardSub:   { color: COLORS.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
  questBadge: {
    backgroundColor: COLORS.error, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  questBadgeTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },

  chapterCard: {
    backgroundColor: UI.sanctuaryPanel, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: UI.sanctuaryBorder,
    borderLeftWidth: 4, padding: SPACING.md,
  },
  chapterNum:  { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  chapterName: { color: COLORS.onSurface, fontSize: 17, fontWeight: "700", marginTop: 2 },
  chapterNext: { color: COLORS.onSurfaceSecondary, fontSize: 13, marginTop: 4 },

  practiceBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    justifyContent: "center", backgroundColor: COLORS.brand,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.xs,
  },
  practiceBtnSecondary: {
    backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.brand + "60",
  },
  practiceBtnTxt: { color: COLORS.onBrand, fontSize: 15, fontWeight: "700" },

  memoryCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: UI.sanctuaryPanel, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: UI.sanctuaryBorder, padding: SPACING.md,
    marginBottom: 4,
  },
  memoryTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  memorySub:   { color: COLORS.onSurfaceSecondary, fontSize: 12, marginTop: 2, lineHeight: 17 },

  emptyMemory: {
    alignItems: "center", gap: SPACING.sm, padding: SPACING.xxl,
    backgroundColor: UI.sanctuaryPanel, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: UI.sanctuaryBorder,
  },
  emptyMemoryTxt: { color: COLORS.onSurfaceTertiary, fontSize: 13, textAlign: "center", lineHeight: 20 },
});
