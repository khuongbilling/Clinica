/**
 * journeyRecommendation.ts — UI selectors for guided Journey progression.
 *
 * Pure read-only functions.  They consume JourneyNodeUi[] (built by the
 * authoritative gating layer) and produce display hints for the Journey screen.
 *
 * No progression state is mutated here.
 */

import type {
  JourneyNodeUi,
  JourneyRecommendationContext,
} from './journeyUi.types';

// ── Recommendation result ─────────────────────────────────────────────────────

export type JourneyRecommendation =
  | {
      kind: 'resume';
      label: 'Resume Encounter';
      nodeId: string;
      href: string;
    }
  | {
      kind: 'choose_branch';
      label: 'Choose Shift';
      branchGroupId: string;
      nodeIds: string[];
    }
  | {
      kind: 'continue';
      label: 'Continue Journey';
      nodeId: string;
      href: string;
    }
  | {
      kind: 'next_destination';
      label: 'Continue';
      href: string;
    }
  | {
      kind: 'complete';
      label: 'Journey Complete';
    };

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortJourneyNodes(nodes: JourneyNodeUi[]): JourneyNodeUi[] {
  return [...nodes].sort((a, b) => {
    if (a.chapterNumber !== b.chapterNumber) {
      return a.chapterNumber - b.chapterNumber;
    }
    const shiftOrder = { day: 0, evening: 1, night: 2 };
    return shiftOrder[a.shift] - shiftOrder[b.shift];
  });
}

function isPlayable(node: JourneyNodeUi): boolean {
  return node.status === 'available' || node.status === 'in_progress';
}

// ── 1. Single recommended next action ────────────────────────────────────────

/**
 * Returns the single best next action for the player.
 *
 * Priority order:
 *   1. Existing encounter in progress  → resume.
 *   2. First required-for-story playable node:
 *        a. Multiple unresolved branch candidates → choose_branch.
 *           (Chapters 4, 7, 9 MUST NOT silently pick a shift.)
 *        b. Canonical branch already selected   → continue the chosen node.
 *        c. No branch                           → continue.
 *   3. Any other playable node         → continue.
 *   4. Book cleared with next href     → next_destination.
 *   5. Fallthrough                     → complete.
 */
export function getJourneyRecommendation(
  context: JourneyRecommendationContext,
): JourneyRecommendation {
  const sorted = sortJourneyNodes(context.nodes);

  // 1. Existing encounter always wins.
  const activeEncounter = sorted.find(
    (node) => node.status === 'in_progress' && Boolean(node.activeEncounterHref),
  );
  if (activeEncounter && activeEncounter.activeEncounterHref) {
    return {
      kind:   'resume',
      label:  'Resume Encounter',
      nodeId: activeEncounter.id,
      href:   activeEncounter.activeEncounterHref,
    };
  }

  // 2. Find first playable required story node.
  const requiredPlayable = sorted.filter(
    (node) => node.requiredForStory && isPlayable(node),
  );

  if (requiredPlayable.length > 0) {
    const first = requiredPlayable[0];

    /**
     * Branch behaviour:
     * If this Chapter contains multiple valid shift routes and the player has
     * not yet made a canonical choice, NEVER choose Day/Evening/Night
     * automatically — return choose_branch so the UI opens a selector.
     */
    if (first.branchGroupId) {
      const branchGroup = requiredPlayable.filter(
        (node) => node.branchGroupId === first.branchGroupId,
      );
      const canonicalNodeId = context.canonicalChoices[first.branchGroupId];

      if (!canonicalNodeId) {
        const playableBranchNodes = branchGroup.filter(isPlayable);
        if (playableBranchNodes.length > 1) {
          return {
            kind:          'choose_branch',
            label:         'Choose Shift',
            branchGroupId: first.branchGroupId,
            nodeIds:       playableBranchNodes.map((node) => node.id),
          };
        }
      }

      if (canonicalNodeId) {
        const selected = branchGroup.find((node) => node.id === canonicalNodeId);
        if (selected && isPlayable(selected)) {
          return {
            kind:   'continue',
            label:  'Continue Journey',
            nodeId: selected.id,
            href:   selected.href,
          };
        }
      }
    }

    return {
      kind:   'continue',
      label:  'Continue Journey',
      nodeId: first.id,
      href:   first.href,
    };
  }

  // 3. Required story nodes finished — find any normal available continuation.
  const nextAvailable = sorted.find((node) => isPlayable(node));
  if (nextAvailable) {
    return {
      kind:   'continue',
      label:  'Continue Journey',
      nodeId: nextAvailable.id,
      href:   nextAvailable.href,
    };
  }

  // 4. Book completion transition.
  if (context.bookCleared && context.nextDestinationHref) {
    return {
      kind:  'next_destination',
      label: 'Continue',
      href:  context.nextDestinationHref,
    };
  }

  return { kind: 'complete', label: 'Journey Complete' };
}

// ── 2. Visually emphasised chapter ───────────────────────────────────────────

/**
 * Returns the chapterId that should receive visual emphasis (e.g. highlight
 * header, auto-scroll).
 *
 * Priority: in_progress → first available → null.
 */
export function getEmphasizedChapterId(nodes: JourneyNodeUi[]): string | null {
  const inProgress = nodes.find((n) => n.status === 'in_progress');
  if (inProgress) return inProgress.chapterId;
  return nodes.find((n) => n.status === 'available')?.chapterId ?? null;
}

// ── 3. Branch-choice selector open? ──────────────────────────────────────────

/**
 * Returns true when there is at least one branch group the player must resolve.
 * Delegates to getJourneyRecommendation — consistent with the main path.
 */
export function shouldOpenBranchChoice(
  nodes: JourneyNodeUi[],
  canonicalChoices: Record<string, string | undefined>,
): boolean {
  const rec = getJourneyRecommendation({
    nodes,
    canonicalChoices,
    bookCleared: false,
  });
  return rec.kind === 'choose_branch';
}

// ── 4. Focused chapters ───────────────────────────────────────────────────────

/**
 * Returns chapterIds shown in focused mode: active chapters ±1 neighbour.
 * Returns [] when all nodes are locked.
 */
export function getFocusedChapterIds(nodes: JourneyNodeUi[]): string[] {
  // Build ordered unique chapter list.
  const seen = new Map<string, number>();
  for (const n of nodes) {
    if (!seen.has(n.chapterId)) seen.set(n.chapterId, n.chapterNumber);
  }
  const chapterOrder = Array.from(seen.entries())
    .map(([chapterId, chapterNumber]) => ({ chapterId, chapterNumber }))
    .sort((a, b) => a.chapterNumber - b.chapterNumber);

  const activeNumbers = new Set<number>();
  for (const n of nodes) {
    if (n.status === 'in_progress' || n.status === 'available') {
      activeNumbers.add(n.chapterNumber);
    }
  }
  if (activeNumbers.size === 0) return [];

  const focusedNumbers = new Set<number>();
  for (const num of activeNumbers) {
    focusedNumbers.add(num - 1);
    focusedNumbers.add(num);
    focusedNumbers.add(num + 1);
  }

  return chapterOrder
    .filter((c) => focusedNumbers.has(c.chapterNumber))
    .map((c) => c.chapterId);
}
