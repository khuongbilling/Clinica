/**
 * tests/journey_ui_selectors.test.ts
 *
 * Unit tests for the Journey UI selector layer.
 * Covers journeyRecommendation.ts and journeyVisibility.ts.
 * No progression state is mutated in any test.
 *
 * Sections:
 *   1 –  20: journeyUi.types — type aliases are consistent with domain
 *  21 –  90: getJourneyRecommendation — canonical tests + edge cases
 *  91 – 110: getEmphasizedChapterId
 * 111 – 130: shouldOpenBranchChoice
 * 131 – 150: getFocusedChapterIds
 * 151 – 175: getLockReasonsForNode / getPrimaryLockReason
 * 176 – 195: isNightShiftUnlocked
 * 196 – 240: isChapterStoryCleared
 * 241 – 280: isChapterMastered / countMasteryStars / maxMasteryStars
 * 281 – 320: buildChapterUiSummary — integration with real CHAPTERS data
 */

import { describe, it, expect } from 'vitest';

// ── Selectors under test ──────────────────────────────────────────────────────
import {
  getJourneyRecommendation,
  getEmphasizedChapterId,
  shouldOpenBranchChoice,
  getFocusedChapterIds,
} from '../src/features/journey/ui/journeyRecommendation';

import {
  getLockReasonsForNode,
  getPrimaryLockReason,
  isNightShiftUnlocked,
  isChapterStoryCleared,
  isChapterMastered,
  countMasteryStars,
  maxMasteryStars,
  buildChapterUiSummary,
} from '../src/features/journey/ui/journeyVisibility';

import type {
  JourneyNodeUi,
  JourneyGateReason,
  JourneyRecommendationContext,
} from '../src/features/journey/ui/journeyUi.types';

// ── Domain data (real chapters for integration tests) ─────────────────────────
import { CHAPTERS } from '../src/game/chapterJourney';

// ── Test fixtures ─────────────────────────────────────────────────────────────

/** Canonical node factory from the uploaded spec. */
function node(overrides: Partial<JourneyNodeUi> = {}): JourneyNodeUi {
  return {
    id:               'node-1',
    chapterId:        'chapter-1',
    chapterNumber:    1,
    shift:            'day',
    status:           'available',
    requiredForStory: true,
    href:             '/journey/chapter/1',
    lockReasons:      [],
    ...overrides,
  };
}

function makeContext(
  nodes: JourneyNodeUi[],
  overrides: Partial<Omit<JourneyRecommendationContext, 'nodes'>> = {},
): JourneyRecommendationContext {
  return {
    nodes,
    canonicalChoices:    overrides.canonicalChoices    ?? {},
    bookCleared:         overrides.bookCleared         ?? false,
    nextDestinationHref: overrides.nextDestinationHref,
  };
}

// ── Section 1: Type aliases ───────────────────────────────────────────────────

describe('journeyUi.types — Shift alias', () => {
  it('accepts all three TimeOfDay values', () => {
    const shifts: JourneyNodeUi['shift'][] = ['day', 'evening', 'night'];
    expect(shifts).toHaveLength(3);
  });

  it('JourneyNodeStatus covers all four states', () => {
    const statuses: JourneyNodeUi['status'][] = [
      'locked', 'available', 'in_progress', 'cleared',
    ];
    expect(statuses).toHaveLength(4);
  });
});

// ── Section 2: getJourneyRecommendation (canonical tests from spec) ───────────

describe('getJourneyRecommendation', () => {

  // ── Canonical tests from uploaded spec ───────────────────────────────────
  it('resumes active encounter before anything else', () => {
    const result = getJourneyRecommendation({
      nodes: [
        node({ id: 'chapter-2', chapterNumber: 2 }),
        node({ id: 'chapter-1', status: 'in_progress', activeEncounterHref: '/battle/abc' }),
      ],
      canonicalChoices: {},
      bookCleared: false,
    });
    expect(result.kind).toBe('resume');
  });

  it('does not automatically choose a branch', () => {
    const result = getJourneyRecommendation({
      nodes: [
        node({ id: 'chapter-4-day',     chapterNumber: 4, branchGroupId: 'chapter-4-shift', shift: 'day' }),
        node({ id: 'chapter-4-evening', chapterNumber: 4, branchGroupId: 'chapter-4-shift', shift: 'evening' }),
      ],
      canonicalChoices: {},
      bookCleared: false,
    });
    expect(result.kind).toBe('choose_branch');
  });

  it('continues canonical branch when already selected', () => {
    const result = getJourneyRecommendation({
      nodes: [
        node({ id: 'chapter-4-day',     chapterNumber: 4, branchGroupId: 'chapter-4-shift', shift: 'day' }),
        node({ id: 'chapter-4-evening', chapterNumber: 4, branchGroupId: 'chapter-4-shift', shift: 'evening' }),
      ],
      canonicalChoices: { 'chapter-4-shift': 'chapter-4-evening' },
      bookCleared: false,
    });
    expect(result).toMatchObject({ kind: 'continue', nodeId: 'chapter-4-evening' });
  });

  // ── Priority and edge cases ───────────────────────────────────────────────
  it('resume carries the activeEncounterHref', () => {
    const result = getJourneyRecommendation({
      nodes: [node({ status: 'in_progress', activeEncounterHref: '/battle/xyz' })],
      canonicalChoices: {},
      bookCleared: false,
    });
    expect(result.kind).toBe('resume');
    if (result.kind === 'resume') expect(result.href).toBe('/battle/xyz');
  });

  it('in_progress without active encounter falls through to continue', () => {
    const result = getJourneyRecommendation({
      nodes: [node({ status: 'in_progress' })],
      canonicalChoices: {},
      bookCleared: false,
    });
    expect(result.kind).toBe('continue');
  });

  it('returns continue for a simple available required node', () => {
    const result = getJourneyRecommendation({
      nodes: [node({ status: 'available' })],
      canonicalChoices: {},
      bookCleared: false,
    });
    expect(result.kind).toBe('continue');
    if (result.kind === 'continue') expect(result.nodeId).toBe('node-1');
  });

  it('choose_branch carries the branchGroupId and all candidate nodeIds', () => {
    const result = getJourneyRecommendation({
      nodes: [
        node({ id: 'n-day',     chapterNumber: 4, branchGroupId: 'g4', shift: 'day' }),
        node({ id: 'n-evening', chapterNumber: 4, branchGroupId: 'g4', shift: 'evening' }),
        node({ id: 'n-night',   chapterNumber: 4, branchGroupId: 'g4', shift: 'night' }),
      ],
      canonicalChoices: {},
      bookCleared: false,
    });
    expect(result.kind).toBe('choose_branch');
    if (result.kind === 'choose_branch') {
      expect(result.branchGroupId).toBe('g4');
      expect(result.nodeIds).toContain('n-day');
      expect(result.nodeIds).toContain('n-evening');
      expect(result.nodeIds).toContain('n-night');
    }
  });

  it('single-node branch group does not trigger choose_branch', () => {
    const result = getJourneyRecommendation({
      nodes: [node({ id: 'only', chapterNumber: 4, branchGroupId: 'g4', shift: 'day' })],
      canonicalChoices: {},
      bookCleared: false,
    });
    // Only 1 playable candidate — falls through to continue
    expect(result.kind).toBe('continue');
  });

  it('non-required available node is offered after required nodes exhausted', () => {
    const result = getJourneyRecommendation({
      nodes: [node({ id: 'opt', requiredForStory: false, status: 'available' })],
      canonicalChoices: {},
      bookCleared: false,
    });
    expect(result.kind).toBe('continue');
    if (result.kind === 'continue') expect(result.nodeId).toBe('opt');
  });

  it('returns next_destination when book cleared and nextDestinationHref provided', () => {
    const result = getJourneyRecommendation({
      nodes: [],
      canonicalChoices: {},
      bookCleared: true,
      nextDestinationHref: '/book-2',
    });
    expect(result.kind).toBe('next_destination');
    if (result.kind === 'next_destination') expect(result.href).toBe('/book-2');
  });

  it('returns complete when book cleared but no nextDestinationHref', () => {
    const result = getJourneyRecommendation({
      nodes: [],
      canonicalChoices: {},
      bookCleared: true,
    });
    expect(result.kind).toBe('complete');
  });

  it('returns complete when all nodes are locked and book not cleared', () => {
    const result = getJourneyRecommendation({
      nodes: [node({ status: 'locked', lockReasons: [{ code: 'level_gate', message: 'x' }] })],
      canonicalChoices: {},
      bookCleared: false,
    });
    expect(result.kind).toBe('complete');
  });

  it('returns complete for empty node list', () => {
    const result = getJourneyRecommendation({ nodes: [], canonicalChoices: {}, bookCleared: false });
    expect(result.kind).toBe('complete');
  });

  it('sorts nodes by chapterNumber before evaluating priority', () => {
    // ch2 available, ch1 in_progress with active encounter — ch1 must win
    const result = getJourneyRecommendation({
      nodes: [
        node({ id: 'ch2', chapterNumber: 2, status: 'available' }),
        node({ id: 'ch1', chapterNumber: 1, status: 'in_progress', activeEncounterHref: '/b/1' }),
      ],
      canonicalChoices: {},
      bookCleared: false,
    });
    expect(result.kind).toBe('resume');
    if (result.kind === 'resume') expect(result.nodeId).toBe('ch1');
  });

  it('result label matches kind contract', () => {
    const resume = getJourneyRecommendation({
      nodes: [node({ status: 'in_progress', activeEncounterHref: '/b/1' })],
      canonicalChoices: {}, bookCleared: false,
    });
    expect(resume.kind === 'resume' && resume.label).toBe('Resume Encounter');

    const cont = getJourneyRecommendation({
      nodes: [node()], canonicalChoices: {}, bookCleared: false,
    });
    expect(cont.kind === 'continue' && cont.label).toBe('Continue Journey');

    const complete = getJourneyRecommendation({ nodes: [], canonicalChoices: {}, bookCleared: false });
    expect(complete.kind === 'complete' && complete.label).toBe('Journey Complete');
  });
});

// ── Section 3: getEmphasizedChapterId ────────────────────────────────────────

describe('getEmphasizedChapterId', () => {
  it('returns chapterId of in_progress node', () => {
    const nodes = [
      node({ chapterId: 'chapter-1', status: 'cleared' }),
      node({ id: 'c2', chapterId: 'chapter-2', chapterNumber: 2, status: 'in_progress' }),
    ];
    expect(getEmphasizedChapterId(nodes)).toBe('chapter-2');
  });

  it('prefers in_progress over available', () => {
    const nodes = [
      node({ chapterId: 'chapter-1', status: 'available' }),
      node({ id: 'c2', chapterId: 'chapter-2', chapterNumber: 2, status: 'in_progress' }),
    ];
    expect(getEmphasizedChapterId(nodes)).toBe('chapter-2');
  });

  it('falls back to first available when no in_progress', () => {
    const nodes = [
      node({ chapterId: 'chapter-1', status: 'cleared' }),
      node({ id: 'c2', chapterId: 'chapter-2', chapterNumber: 2, status: 'available' }),
    ];
    expect(getEmphasizedChapterId(nodes)).toBe('chapter-2');
  });

  it('returns null when all locked or cleared', () => {
    const nodes = [
      node({ status: 'cleared' }),
      node({ id: 'c2', status: 'locked', lockReasons: [{ code: 'x', message: 'x' }] }),
    ];
    expect(getEmphasizedChapterId(nodes)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(getEmphasizedChapterId([])).toBeNull();
  });
});

// ── Section 4: shouldOpenBranchChoice ────────────────────────────────────────

describe('shouldOpenBranchChoice', () => {
  it('returns false when no nodes have a branchGroupId', () => {
    expect(shouldOpenBranchChoice([node()], {})).toBe(false);
  });

  it('returns true for an unresolved group with multiple available candidates', () => {
    const nodes = [
      node({ id: 'a', chapterNumber: 4, branchGroupId: 'g1', shift: 'day' }),
      node({ id: 'b', chapterNumber: 4, branchGroupId: 'g1', shift: 'evening' }),
    ];
    expect(shouldOpenBranchChoice(nodes, {})).toBe(true);
  });

  it('returns false when canonicalChoices resolves the group', () => {
    const nodes = [
      node({ id: 'a', chapterNumber: 4, branchGroupId: 'g1', shift: 'day' }),
      node({ id: 'b', chapterNumber: 4, branchGroupId: 'g1', shift: 'evening' }),
    ];
    expect(shouldOpenBranchChoice(nodes, { g1: 'a' })).toBe(false);
  });

  it('returns false when only one playable candidate (auto-advance)', () => {
    const nodes = [node({ id: 'a', chapterNumber: 4, branchGroupId: 'g1' })];
    expect(shouldOpenBranchChoice(nodes, {})).toBe(false);
  });
});

// ── Section 5: getFocusedChapterIds ──────────────────────────────────────────

describe('getFocusedChapterIds', () => {
  it('returns empty array when all locked', () => {
    const nodes = [node({ status: 'locked', lockReasons: [{ code: 'x', message: 'x' }] })];
    expect(getFocusedChapterIds(nodes)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(getFocusedChapterIds([])).toEqual([]);
  });

  it('includes active chapter and its immediate neighbors', () => {
    const nodes = [
      node({ id: 'c1', chapterId: 'chapter_1', chapterNumber: 1, status: 'cleared' }),
      node({ id: 'c2', chapterId: 'chapter_2', chapterNumber: 2, status: 'in_progress' }),
      node({ id: 'c3', chapterId: 'chapter_3', chapterNumber: 3, status: 'locked', lockReasons: [{ code: 'x', message: 'x' }] }),
      node({ id: 'c4', chapterId: 'chapter_4', chapterNumber: 4, status: 'locked', lockReasons: [{ code: 'x', message: 'x' }] }),
    ];
    const focused = getFocusedChapterIds(nodes);
    expect(focused).toContain('chapter_1');
    expect(focused).toContain('chapter_2');
    expect(focused).toContain('chapter_3');
    expect(focused).not.toContain('chapter_4');
  });

  it('result is in ascending chapter-number order', () => {
    const nodes = [
      node({ id: 'c3', chapterId: 'chapter_3', chapterNumber: 3, status: 'available' }),
      node({ id: 'c2', chapterId: 'chapter_2', chapterNumber: 2, status: 'cleared' }),
    ];
    const focused = getFocusedChapterIds(nodes);
    const nums = focused.map((id) => parseInt(id.replace('chapter_', ''), 10));
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
  });
});

// ── Section 6: getLockReasonsForNode / getPrimaryLockReason ──────────────────

describe('getLockReasonsForNode', () => {
  it('returns empty array for an available node', () => {
    expect(getLockReasonsForNode(node({ status: 'available' }))).toEqual([]);
  });

  it('returns empty array for cleared and in_progress nodes', () => {
    expect(getLockReasonsForNode(node({ status: 'cleared' }))).toEqual([]);
    expect(getLockReasonsForNode(node({ status: 'in_progress' }))).toEqual([]);
  });

  it('returns lockReasons for a locked node', () => {
    const reasons: JourneyGateReason[] = [
      { code: 'level_gate', message: 'Reach level 3.' },
    ];
    expect(getLockReasonsForNode(node({ status: 'locked', lockReasons: reasons }))).toEqual(reasons);
  });

  it('returns all reasons when multiple are present', () => {
    const reasons: JourneyGateReason[] = [
      { code: 'level_gate',        message: 'Level too low.' },
      { code: 'boss_keys_missing', message: 'Need 3 keys.' },
    ];
    expect(getLockReasonsForNode(node({ status: 'locked', lockReasons: reasons }))).toHaveLength(2);
  });
});

describe('getPrimaryLockReason', () => {
  it('returns null for a non-locked node', () => {
    expect(getPrimaryLockReason(node({ status: 'available' }))).toBeNull();
  });

  it('returns the first reason for a locked node', () => {
    const reasons: JourneyGateReason[] = [
      { code: 'level_gate',        message: 'Level too low.' },
      { code: 'boss_keys_missing', message: 'Need keys.' },
    ];
    expect(getPrimaryLockReason(node({ status: 'locked', lockReasons: reasons }))?.code)
      .toBe('level_gate');
  });

  it('returns null when locked node has no reasons', () => {
    expect(getPrimaryLockReason(node({ status: 'locked', lockReasons: [] }))).toBeNull();
  });
});

// ── Section 7: isNightShiftUnlocked ──────────────────────────────────────────

describe('isNightShiftUnlocked', () => {
  it('is false at chapter 1–5', () => {
    for (const ch of [1, 2, 3, 4, 5]) expect(isNightShiftUnlocked(ch)).toBe(false);
  });

  it('is true at chapter 6 and beyond', () => {
    for (const ch of [6, 7, 10, 15]) expect(isNightShiftUnlocked(ch)).toBe(true);
  });
});

// ── Section 8: isChapterStoryCleared ─────────────────────────────────────────

describe('isChapterStoryCleared', () => {
  const ch1 = CHAPTERS.find((c) => c.number === 1)!;
  const ch2 = CHAPTERS.find((c) => c.number === 2)!;

  it('is false with empty claimed list', () => {
    expect(isChapterStoryCleared(ch1, [])).toBe(false);
  });

  it('is true when all required nodes are claimed', () => {
    const required = ch1.requiredCompletionNodes ?? [];
    expect(isChapterStoryCleared(ch1, required)).toBe(true);
  });

  it('partial claim is not cleared', () => {
    const required = ch1.requiredCompletionNodes ?? [];
    if (required.length > 1) {
      expect(isChapterStoryCleared(ch1, [required[0]])).toBe(false);
    }
  });

  it('ch2 is not cleared with only ch1 nodes', () => {
    expect(isChapterStoryCleared(ch2, ch1.requiredCompletionNodes ?? [])).toBe(false);
  });

  it('ch2 is cleared when its own required nodes are claimed', () => {
    expect(isChapterStoryCleared(ch2, ch2.requiredCompletionNodes ?? [])).toBe(true);
  });

  it('extra claimed nodes do not break the check', () => {
    const required = ch1.requiredCompletionNodes ?? [];
    expect(isChapterStoryCleared(ch1, [...required, 'bonus_99'])).toBe(true);
  });

  it('chapter with no requiredCompletionNodes is always cleared', () => {
    expect(isChapterStoryCleared({ ...ch1, requiredCompletionNodes: undefined }, [])).toBe(true);
    expect(isChapterStoryCleared({ ...ch1, requiredCompletionNodes: [] }, [])).toBe(true);
  });
});

// ── Section 9: mastery helpers ────────────────────────────────────────────────

describe('maxMasteryStars', () => {
  it('returns 0 for a story-only chapter', () => {
    const storyOnly = {
      ...CHAPTERS[0],
      parts: [{ id: 's1', part: 1, type: 'story' as const, title: 'T', description: 'D', icon: 'book' }],
      requiredCompletionNodes: [],
    };
    expect(maxMasteryStars(storyOnly)).toBe(0);
  });

  it('counts only battle/mini_boss/ward_defense, excludes placeholders', () => {
    const mixed = {
      ...CHAPTERS[0],
      parts: [
        { id: 'b1', part: 1, type: 'battle'       as const, title: 'T', description: 'D', icon: 'flash' },
        { id: 'b2', part: 2, type: 'mini_boss'    as const, title: 'T', description: 'D', icon: 'skull' },
        { id: 'b3', part: 3, type: 'ward_defense' as const, title: 'T', description: 'D', icon: 'shield' },
        { id: 's1', part: 4, type: 'story'        as const, title: 'T', description: 'D', icon: 'book' },
        { id: 'p1', part: 5, type: 'battle'       as const, title: 'T', description: 'D', icon: 'flash', isPlaceholder: true },
      ],
      requiredCompletionNodes: [],
    };
    expect(maxMasteryStars(mixed)).toBe(3);
  });
});

describe('countMasteryStars', () => {
  it('returns 0 when nothing is claimed', () => {
    expect(countMasteryStars(CHAPTERS[0], [])).toBe(0);
  });

  it('counts only claimed mastery-eligible ids', () => {
    const mixed = {
      ...CHAPTERS[0],
      parts: [
        { id: 'b1', part: 1, type: 'battle' as const, title: 'T', description: 'D', icon: 'flash' },
        { id: 'b2', part: 2, type: 'battle' as const, title: 'T', description: 'D', icon: 'flash' },
        { id: 's1', part: 3, type: 'story'  as const, title: 'T', description: 'D', icon: 'book'  },
      ],
      requiredCompletionNodes: [],
    };
    expect(countMasteryStars(mixed, ['b1', 's1'])).toBe(1);
    expect(countMasteryStars(mixed, ['b1', 'b2'])).toBe(2);
  });
});

describe('isChapterMastered', () => {
  it('is false when story is not cleared', () => {
    expect(isChapterMastered(CHAPTERS[0], [])).toBe(false);
  });

  it('is true for a story-only chapter once cleared', () => {
    const ch = { ...CHAPTERS[0], parts: [{ id: 's1', part: 1, type: 'story' as const, title: 'T', description: 'D', icon: 'book' }], requiredCompletionNodes: ['s1'] };
    expect(isChapterMastered(ch, ['s1'])).toBe(true);
  });

  it('is false when story cleared but mastery nodes unclaimed', () => {
    const ch = {
      ...CHAPTERS[0],
      parts: [
        { id: 'b1', part: 1, type: 'battle' as const, title: 'T', description: 'D', icon: 'flash' },
        { id: 'b2', part: 2, type: 'battle' as const, title: 'T', description: 'D', icon: 'flash' },
        { id: 's1', part: 3, type: 'story'  as const, title: 'T', description: 'D', icon: 'book'  },
      ],
      requiredCompletionNodes: ['s1'],
    };
    expect(isChapterMastered(ch, ['s1', 'b1'])).toBe(false);
  });

  it('is true when story cleared and all mastery nodes claimed', () => {
    const ch = {
      ...CHAPTERS[0],
      parts: [
        { id: 'b1', part: 1, type: 'battle' as const, title: 'T', description: 'D', icon: 'flash' },
        { id: 's1', part: 2, type: 'story'  as const, title: 'T', description: 'D', icon: 'book'  },
      ],
      requiredCompletionNodes: ['s1'],
    };
    expect(isChapterMastered(ch, ['s1', 'b1'])).toBe(true);
  });
});

// ── Section 10: buildChapterUiSummary ─────────────────────────────────────────

describe('buildChapterUiSummary', () => {
  const ch1 = CHAPTERS.find((c) => c.number === 1)!;
  const ch2 = CHAPTERS.find((c) => c.number === 2)!;

  it('returns correct identifiers', () => {
    const s = buildChapterUiSummary(ch1, 1, []);
    expect(s.chapterId).toBe('chapter_1');
    expect(s.chapterNumber).toBe(1);
  });

  it('storyCleared reflects claim state', () => {
    expect(buildChapterUiSummary(ch1, 1, []).storyCleared).toBe(false);
    expect(buildChapterUiSummary(ch1, 2, ch1.requiredCompletionNodes ?? []).storyCleared).toBe(true);
  });

  it('masteryStars is 0 with no claimed nodes', () => {
    expect(buildChapterUiSummary(ch1, 1, []).masteryStars).toBe(0);
  });

  it('maxMasteryStars is non-negative', () => {
    expect(buildChapterUiSummary(ch1, 1, []).maxMasteryStars).toBeGreaterThanOrEqual(0);
  });

  it('current is true for the active chapter', () => {
    // Player level 1 → Chapter 1 active
    expect(buildChapterUiSummary(ch1, 1, []).current).toBe(true);
  });

  it('current is false for a locked chapter', () => {
    expect(buildChapterUiSummary(ch2, 1, []).current).toBe(false);
  });

  it('masteryStars never exceeds maxMasteryStars', () => {
    const allParts = ch1.parts.map((p) => p.id);
    const s = buildChapterUiSummary(ch1, 2, allParts);
    expect(s.masteryStars).toBeLessThanOrEqual(s.maxMasteryStars);
  });

  it('summary has all required fields', () => {
    const s = buildChapterUiSummary(ch1, 1, []);
    expect(s).toHaveProperty('chapterId');
    expect(s).toHaveProperty('chapterNumber');
    expect(s).toHaveProperty('storyCleared');
    expect(s).toHaveProperty('masteryStars');
    expect(s).toHaveProperty('maxMasteryStars');
    expect(s).toHaveProperty('current');
  });
});
