/**
 * journeyRecommendation.ts — UI selectors for guided Journey progression.
 *
 * Pure read-only functions.  They consume JourneyNodeUi[] (built by the
 * authoritative gating layer) and produce display hints for the Journey screen:
 *   • What is the single recommended next action?
 *   • Which Chapter should be visually emphasised?
 *   • Should a branch-choice selector open?
 *   • Which Chapters should be shown in focused mode?
 *
 * No progression state is mutated here.
 */

import type {
  JourneyNodeUi,
  JourneyRecommendationContext,
  RecommendedAction,
} from './journeyUi.types';

// ── 1. Recommended next action ────────────────────────────────────────────────

/**
 * Returns the single best next action for the player.
 *
 * Priority order:
 *   1. Book already cleared → book_complete (route to next destination).
 *   2. Any branch group whose canonical choice is not yet locked → branch_choice.
 *   3. Active encounter in progress → play_node (resume it).
 *   4. First in_progress node (story progression continuity).
 *   5. First available node.
 *   6. idle — nothing actionable (all locked or no nodes).
 */
export function getRecommendedAction(
  context: JourneyRecommendationContext,
): RecommendedAction {
  const { nodes, canonicalChoices, bookCleared, nextDestinationHref } = context;

  // 1. Book complete.
  if (bookCleared) {
    return { kind: 'book_complete', href: nextDestinationHref };
  }

  // 2. Unresolved branch group — player must pick a path first.
  const unresolvedBranch = findUnresolvedBranchGroup(nodes, canonicalChoices);
  if (unresolvedBranch) {
    return {
      kind: 'branch_choice',
      branchGroupId: unresolvedBranch.branchGroupId,
      candidateNodes: unresolvedBranch.candidates,
    };
  }

  // 3. Resume an active encounter already in progress.
  const resumable = nodes.find(
    (n) => n.status === 'in_progress' && n.activeEncounterHref,
  );
  if (resumable) {
    return { kind: 'play_node', node: resumable };
  }

  // 4. First in_progress node (no active encounter — partial progress).
  const inProgress = nodes.find((n) => n.status === 'in_progress');
  if (inProgress) {
    return { kind: 'play_node', node: inProgress };
  }

  // 5. First available node in story order.
  const available = nodes.find(
    (n) => n.status === 'available' && n.requiredForStory,
  ) ?? nodes.find((n) => n.status === 'available');
  if (available) {
    return { kind: 'play_node', node: available };
  }

  return { kind: 'idle' };
}

// ── 2. Visually emphasised chapter ───────────────────────────────────────────

/**
 * Returns the chapterId that should receive visual emphasis (e.g. highlight
 * header, auto-scroll).
 *
 * Priority:
 *   1. Chapter containing an in_progress node.
 *   2. Chapter containing the first available node.
 *   3. null — nothing to emphasise (all locked or no nodes).
 */
export function getEmphasizedChapterId(nodes: JourneyNodeUi[]): string | null {
  const inProgress = nodes.find((n) => n.status === 'in_progress');
  if (inProgress) return inProgress.chapterId;

  const available = nodes.find((n) => n.status === 'available');
  return available?.chapterId ?? null;
}

// ── 3. Branch-choice selector ─────────────────────────────────────────────────

/**
 * Returns true when there is at least one branch group the player must resolve
 * before progressing.  The UI should open a branch-choice modal/selector.
 *
 * A branch group is considered unresolved when:
 *   • At least one of its nodes has a branchGroupId set.
 *   • None of the group's nodes has canonicalBranchSelected = true.
 *   • The canonical-choices map has no entry for this group.
 *   • At least one node in the group is available (not all locked/cleared).
 */
export function shouldOpenBranchChoice(
  nodes: JourneyNodeUi[],
  canonicalChoices: Record<string, string | undefined>,
): boolean {
  return findUnresolvedBranchGroup(nodes, canonicalChoices) !== null;
}

// ── 4. Focused chapters ───────────────────────────────────────────────────────

/**
 * Returns the ordered list of chapterIds that should be shown in "focused"
 * mode — i.e. displayed prominently while others are collapsed/dimmed.
 *
 * Includes:
 *   • Chapters with in_progress or available nodes (the active zone).
 *   • Their immediate neighbours (one step up and down in chapter number)
 *     to provide context and forward-looking visibility.
 *
 * Returns an empty array when all nodes are locked.
 */
export function getFocusedChapterIds(nodes: JourneyNodeUi[]): string[] {
  // Build ordered unique chapter list by chapter number.
  const chapterOrder = dedupedChapterOrder(nodes);
  if (chapterOrder.length === 0) return [];

  // Active chapter numbers (in_progress or available).
  const activeNumbers = new Set<number>();
  for (const n of nodes) {
    if (n.status === 'in_progress' || n.status === 'available') {
      activeNumbers.add(n.chapterNumber);
    }
  }

  if (activeNumbers.size === 0) return [];

  // Expand to include immediate neighbours (±1 chapter number).
  const focusedNumbers = new Set<number>();
  for (const num of activeNumbers) {
    focusedNumbers.add(num - 1);
    focusedNumbers.add(num);
    focusedNumbers.add(num + 1);
  }

  // Return chapterIds in chapter-number order, filtered to those present.
  return chapterOrder
    .filter((c) => focusedNumbers.has(c.chapterNumber))
    .map((c) => c.chapterId);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface UnresolvedBranch {
  branchGroupId: string;
  candidates: JourneyNodeUi[];
}

/**
 * Finds the first unresolved branch group, or null if none.
 */
function findUnresolvedBranchGroup(
  nodes: JourneyNodeUi[],
  canonicalChoices: Record<string, string | undefined>,
): UnresolvedBranch | null {
  // Collect nodes with a branchGroupId, grouped by that id.
  const groups = new Map<string, JourneyNodeUi[]>();
  for (const node of nodes) {
    if (!node.branchGroupId) continue;
    const existing = groups.get(node.branchGroupId) ?? [];
    existing.push(node);
    groups.set(node.branchGroupId, existing);
  }

  for (const [branchGroupId, members] of groups) {
    // Already resolved if a canonical choice is recorded in the choices map.
    if (canonicalChoices[branchGroupId] !== undefined) continue;

    // Already resolved if any member node carries canonicalBranchSelected.
    const alreadySelected = members.some((n) => n.canonicalBranchSelected);
    if (alreadySelected) continue;

    // At least one candidate must be available (not all locked/cleared).
    const candidates = members.filter(
      (n) => n.status === 'available' || n.status === 'in_progress',
    );
    if (candidates.length === 0) continue;

    return { branchGroupId, candidates };
  }

  return null;
}

/**
 * Returns chapters in ascending chapterNumber order, deduplicated.
 */
function dedupedChapterOrder(
  nodes: JourneyNodeUi[],
): Array<{ chapterId: string; chapterNumber: number }> {
  const seen = new Map<string, number>();
  for (const n of nodes) {
    if (!seen.has(n.chapterId)) seen.set(n.chapterId, n.chapterNumber);
  }
  return Array.from(seen.entries())
    .map(([chapterId, chapterNumber]) => ({ chapterId, chapterNumber }))
    .sort((a, b) => a.chapterNumber - b.chapterNumber);
}
