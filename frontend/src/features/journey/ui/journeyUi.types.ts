/**
 * journeyUi.types.ts — UI-layer contracts for the Journey screen.
 *
 * These types are DISPLAY-ONLY adapters that sit on top of the canonical
 * progression/gating domain (chapterJourney.ts, bookOneUnlocks.ts,
 * chapterBossKeys.ts).  Selectors consume domain state and produce values
 * that the UI renders; they never mutate progression.
 *
 * Shift is a re-export of TimeOfDay so UI code can import from one place.
 */

import type { TimeOfDay } from '../../../game/journeyMap/types';

// Re-export so UI files import from here, not from the domain directly.
export type Shift = TimeOfDay; // 'day' | 'evening' | 'night'

// ── Node status ───────────────────────────────────────────────────────────────

export type JourneyNodeStatus =
  | 'locked'
  | 'available'
  | 'in_progress'
  | 'cleared';

// ── Gate reason ───────────────────────────────────────────────────────────────

export interface JourneyGateReason {
  /**
   * Stable machine-readable reason from the EXISTING gating system.
   * Examples:
   *   chapter_not_cleared
   *   shift_locked
   *   boss_keys_missing
   */
  code: string;

  /**
   * Human-readable explanation.
   *
   * IMPORTANT:
   * The authoritative gating layer should create this message.
   * The UI should DISPLAY it, not independently decide whether
   * the requirement has been fulfilled.
   */
  message: string;
}

// ── Node UI shape ─────────────────────────────────────────────────────────────

export interface JourneyNodeUi {
  id: string;
  chapterId: string;
  chapterNumber: number;

  shift: Shift;

  status: JourneyNodeStatus;

  /**
   * True when this node is part of required first-clear story progression.
   */
  requiredForStory: boolean;

  /**
   * Chapters 4, 7, and 9 may use this.
   * Example: "chapter-4-shift-choice"
   */
  branchGroupId?: string;

  /**
   * Route already chosen as canonical for this branch.
   */
  canonicalBranchSelected?: boolean;

  href: string;

  /**
   * Existing battle/encounter already underway.
   */
  activeEncounterHref?: string;

  /**
   * Populated from the AUTHORITATIVE gate evaluator.
   */
  lockReasons: JourneyGateReason[];
}

// ── Chapter summary ───────────────────────────────────────────────────────────

export interface ChapterUiSummary {
  chapterId: string;
  chapterNumber: number;

  storyCleared: boolean;

  masteryStars: number;
  maxMasteryStars: number;

  /**
   * True only when the existing progression service says this Chapter is the
   * current meaningful story Chapter.
   */
  current: boolean;
}

// ── Recommendation context ────────────────────────────────────────────────────

export interface JourneyRecommendationContext {
  nodes: JourneyNodeUi[];

  /**
   * Existing canonical branch selections.
   * key = branchGroupId
   * value = chosen node id
   */
  canonicalChoices: Record<string, string | undefined>;

  bookCleared: boolean;

  /**
   * Existing destination after completing the Book,
   * such as Book II or another progression page.
   */
  nextDestinationHref?: string;
}

// ── Recommended action discriminated union ────────────────────────────────────

/** Player should engage the given node. */
export interface RecommendedActionPlayNode {
  kind: 'play_node';
  node: JourneyNodeUi;
}

/** Player must choose a canonical branch before proceeding. */
export interface RecommendedActionBranchChoice {
  kind: 'branch_choice';
  branchGroupId: string;
  /** All candidate nodes in this branch group (available, not yet resolved). */
  candidateNodes: JourneyNodeUi[];
}

/** Player has cleared the Book — route to the next destination. */
export interface RecommendedActionBookComplete {
  kind: 'book_complete';
  href?: string;
}

/** No actionable recommendation can be determined from current state. */
export interface RecommendedActionIdle {
  kind: 'idle';
}

export type RecommendedAction =
  | RecommendedActionPlayNode
  | RecommendedActionBranchChoice
  | RecommendedActionBookComplete
  | RecommendedActionIdle;
