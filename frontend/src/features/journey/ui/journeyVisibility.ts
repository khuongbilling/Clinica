/**
 * journeyVisibility.ts — UI selectors for Journey lock state and chapter status.
 *
 * Pure read-only functions.  They delegate to the canonical gating layer and
 * surface the results in UI-consumable shapes.  No progression state is mutated.
 *
 * KEY INVARIANT:
 *   storyCleared !== mastered
 *
 *   isChapterMastered requires maxMasteryStars > 0.
 *   A narrative/story-only chapter (maxMasteryStars === 0) is NEVER "Mastered"
 *   even when storyCleared is true.  UI components must not collapse these two
 *   states — e.g. masteryStars === 3 must never become a story gate check.
 *
 * Answers:
 *   5. Why is a locked node locked?           → getLockReasonsForNode
 *   6. Is Night Shift unlocked?               → isNightShiftUnlocked
 *   7. Is a Chapter Story Cleared?            → isChapterStoryCleared
 *   8. Is a Chapter Mastered?                 → isChapterMastered
 *      Which Chapters in focused mode?        → getFocusedChapters
 *      Completion label for display?          → getCompletionLabel
 *                                             + buildChapterUiSummary
 */

import { isShiftAvailable } from '../../../game/journeyMap/bookOneUnlocks';
import { getChapterStatus } from '../../../game/chapterJourney';
import type { Chapter }     from '../../../game/chapterJourney';
import type { JourneyGateReason, JourneyNodeUi, ChapterUiSummary } from './journeyUi.types';

// ── 5. Lock reasons for a node ────────────────────────────────────────────────

/**
 * Returns the lock reasons recorded on a node.
 *
 * The reasons are authored by the AUTHORITATIVE gate evaluator when the
 * JourneyNodeUi array is constructed; this selector simply surfaces them so
 * the UI has a stable access point rather than reaching into lockReasons
 * directly and coupling itself to the field name.
 *
 * Returns an empty array when the node is not locked.
 */
export function getLockReasonsForNode(node: JourneyNodeUi): JourneyGateReason[] {
  if (node.status !== 'locked') return [];
  return node.lockReasons;
}

/**
 * Returns a single primary lock reason for display in compact UI contexts
 * (e.g. a small badge on the tile).  Returns null when the node is not locked
 * or has no reasons recorded.
 */
export function getPrimaryLockReason(node: JourneyNodeUi): JourneyGateReason | null {
  const reasons = getLockReasonsForNode(node);
  return reasons[0] ?? null;
}

// ── 6. Night Shift unlocked ───────────────────────────────────────────────────

/**
 * Returns true when Night Shift is available for run creation at the given
 * chapter number.
 *
 * Delegates to isShiftAvailable (bookOneUnlocks.ts) — unlocks at Chapter 6.
 */
export function isNightShiftUnlocked(chapter: number): boolean {
  return isShiftAvailable('night', chapter);
}

// ── 7. Chapter Story Cleared ──────────────────────────────────────────────────

/**
 * Returns true when all of the chapter's required completion nodes appear in
 * the player's claimedNodeIds list.
 *
 * Chapters without any requiredCompletionNodes defined are considered cleared
 * as soon as they are accessible (the gate is level-only).
 *
 * This is the authoritative definition used throughout the UI layer; do not
 * duplicate this logic in components.
 */
export function isChapterStoryCleared(
  chapter: Chapter,
  claimedNodeIds: readonly string[],
): boolean {
  const required = chapter.requiredCompletionNodes;
  if (!required || required.length === 0) return true;
  const claimedSet = new Set(claimedNodeIds);
  return required.every((id) => claimedSet.has(id));
}

// ── 8. Chapter Mastered ───────────────────────────────────────────────────────

/**
 * Returns true when the chapter summary represents a fully mastered chapter.
 *
 * INVARIANT: requires maxMasteryStars > 0.
 *   A chapter with no mastery-eligible nodes (pure narrative) is NEVER mastered,
 *   even if storyCleared is true.  This prevents UI components from accidentally
 *   treating "masteryStars === 3" as a story gate.
 */
export function isChapterMastered(chapter: ChapterUiSummary): boolean {
  return (
    chapter.maxMasteryStars > 0 &&
    chapter.masteryStars >= chapter.maxMasteryStars
  );
}

/**
 * Returns a three-way completion label for display in chapter headers and lists.
 *
 *   "In Progress"   — story not yet cleared
 *   "Story Cleared" — story cleared but mastery incomplete (or no mastery nodes)
 *   "Mastered"      — story cleared AND all mastery nodes claimed
 *                     (only reachable when maxMasteryStars > 0)
 */
export function getCompletionLabel(
  chapter: ChapterUiSummary,
): 'In Progress' | 'Story Cleared' | 'Mastered' {
  if (!chapter.storyCleared) return 'In Progress';
  if (isChapterMastered(chapter))  return 'Mastered';
  return 'Story Cleared';
}

// ── Focused chapters ──────────────────────────────────────────────────────────

/**
 * Returns the subset of chapters the Journey screen should display prominently.
 *
 * Collapsed (expanded = false):
 *   • Finds the current chapter (current = true) or, as fallback, the first
 *     uncleared chapter.
 *   • Returns [current, next] when a next chapter exists, or [current] alone.
 *   • When everything is cleared, returns the final chapter.
 *
 * Expanded (expanded = true):
 *   • Returns all chapters in ascending order — the UI is fully scrollable.
 *
 * Input order is not assumed; chapters are always sorted by chapterNumber.
 */
export function getFocusedChapters(
  chapters: ChapterUiSummary[],
  expanded: boolean,
): ChapterUiSummary[] {
  const ordered = [...chapters].sort(
    (a, b) => a.chapterNumber - b.chapterNumber,
  );

  if (expanded) return ordered;

  const current =
    ordered.find((ch) => ch.current) ??
    ordered.find((ch) => !ch.storyCleared);

  if (!current) {
    // Everything cleared — show the final chapter.
    return ordered.slice(-1);
  }

  const next = ordered.find(
    (ch) => ch.chapterNumber > current.chapterNumber,
  );

  return next ? [current, next] : [current];
}

// ── Summary builder ───────────────────────────────────────────────────────────

/**
 * Part types that contribute to chapter mastery.
 * Mastery is measured on combat and defense encounters — the skill-testing nodes.
 */
const MASTERY_PART_TYPES = new Set(['battle', 'mini_boss', 'ward_defense']);

function getMasteryNodeIds(chapter: Chapter): string[] {
  return chapter.parts
    .filter((p) => !p.isPlaceholder && MASTERY_PART_TYPES.has(p.type))
    .map((p) => p.id);
}

/** Returns the number of mastery-eligible nodes the player has claimed. */
export function countMasteryStars(
  chapter: Chapter,
  claimedNodeIds: readonly string[],
): number {
  const claimedSet = new Set(claimedNodeIds);
  return getMasteryNodeIds(chapter).filter((id) => claimedSet.has(id)).length;
}

/** Returns the total mastery-eligible node count for the chapter. */
export function maxMasteryStars(chapter: Chapter): number {
  return getMasteryNodeIds(chapter).length;
}

/**
 * Constructs the full ChapterUiSummary for one chapter.
 *
 * @param chapter        — Chapter definition from chapterJourney.ts
 * @param playerLevel    — Current player level (used by getChapterStatus)
 * @param claimedNodeIds — Nodes the player has cleared (player.claimed_journey_nodes)
 */
export function buildChapterUiSummary(
  chapter: Chapter,
  playerLevel: number,
  claimedNodeIds: readonly string[],
): ChapterUiSummary {
  const status = getChapterStatus(chapter, playerLevel, [...claimedNodeIds]);

  return {
    chapterId:       chapter.id,
    chapterNumber:   chapter.number,
    storyCleared:    isChapterStoryCleared(chapter, claimedNodeIds),
    masteryStars:    countMasteryStars(chapter, claimedNodeIds),
    maxMasteryStars: maxMasteryStars(chapter),
    current:         status === 'active',
  };
}
