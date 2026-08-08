/**
 * tests/journey_ui_selectors.test.ts
 *
 * Unit tests for the Journey UI selector layer.
 * Covers journeyRecommendation.ts and journeyVisibility.ts.
 * No progression state is mutated in any test.
 *
 * Sections:
 *   1 –  30: journeyUi.types — type aliases are consistent with domain
 *  31 –  80: getRecommendedAction — all 6 priority branches
 *  81 – 110: getEmphasizedChapterId
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
  getRecommendedAction,
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

function makeNode(overrides: Partial<JourneyNodeUi> = {}): JourneyNodeUi {
  return {
    id:             overrides.id             ?? 'c1p1',
    chapterId:      overrides.chapterId      ?? 'chapter_1',
    chapterNumber:  overrides.chapterNumber  ?? 1,
    shift:          overrides.shift          ?? 'day',
    status:         overrides.status         ?? 'available',
    requiredForStory: overrides.requiredForStory ?? true,
    href:           overrides.href           ?? '/journey/chapter/1',
    lockReasons:    overrides.lockReasons    ?? [],
    branchGroupId:           overrides.branchGroupId,
    canonicalBranchSelected: overrides.canonicalBranchSelected,
    activeEncounterHref:     overrides.activeEncounterHref,
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

// ── Section 2: getRecommendedAction ──────────────────────────────────────────

describe('getRecommendedAction', () => {
  it('returns book_complete when bookCleared is true', () => {
    const ctx = makeContext([makeNode()], {
      bookCleared: true,
      nextDestinationHref: '/book-2',
    });
    const result = getRecommendedAction(ctx);
    expect(result.kind).toBe('book_complete');
    if (result.kind === 'book_complete') {
      expect(result.href).toBe('/book-2');
    }
  });

  it('book_complete href is undefined when nextDestinationHref is not set', () => {
    const ctx = makeContext([makeNode()], { bookCleared: true });
    const result = getRecommendedAction(ctx);
    expect(result.kind).toBe('book_complete');
    if (result.kind === 'book_complete') {
      expect(result.href).toBeUndefined();
    }
  });

  it('returns branch_choice for an unresolved branch group', () => {
    const nodes = [
      makeNode({ id: 'c4a', chapterId: 'chapter_4', chapterNumber: 4, status: 'available', branchGroupId: 'ch4-branch' }),
      makeNode({ id: 'c4b', chapterId: 'chapter_4', chapterNumber: 4, status: 'available', branchGroupId: 'ch4-branch' }),
    ];
    const ctx = makeContext(nodes);
    const result = getRecommendedAction(ctx);
    expect(result.kind).toBe('branch_choice');
    if (result.kind === 'branch_choice') {
      expect(result.branchGroupId).toBe('ch4-branch');
      expect(result.candidateNodes).toHaveLength(2);
    }
  });

  it('branch resolved via canonicalChoices skips branch_choice', () => {
    const nodes = [
      makeNode({ id: 'c4a', chapterId: 'chapter_4', chapterNumber: 4, status: 'available', branchGroupId: 'ch4-branch' }),
    ];
    const ctx = makeContext(nodes, { canonicalChoices: { 'ch4-branch': 'c4a' } });
    const result = getRecommendedAction(ctx);
    expect(result.kind).toBe('play_node');
  });

  it('branch resolved via canonicalBranchSelected skips branch_choice', () => {
    const nodes = [
      makeNode({ id: 'c4a', chapterId: 'chapter_4', chapterNumber: 4, status: 'available', branchGroupId: 'ch4-branch', canonicalBranchSelected: true }),
    ];
    const ctx = makeContext(nodes);
    const result = getRecommendedAction(ctx);
    expect(result.kind).toBe('play_node');
  });

  it('prefers active-encounter resume over plain in_progress', () => {
    const nodes = [
      makeNode({ id: 'c1p2', status: 'in_progress' }),
      makeNode({ id: 'c1p1', status: 'in_progress', activeEncounterHref: '/battle/123' }),
    ];
    const ctx = makeContext(nodes);
    const result = getRecommendedAction(ctx);
    expect(result.kind).toBe('play_node');
    if (result.kind === 'play_node') {
      expect(result.node.id).toBe('c1p1');
      expect(result.node.activeEncounterHref).toBe('/battle/123');
    }
  });

  it('returns in_progress node when no active encounter', () => {
    const nodes = [
      makeNode({ id: 'c1p2', status: 'available' }),
      makeNode({ id: 'c1p1', status: 'in_progress' }),
    ];
    const ctx = makeContext(nodes);
    const result = getRecommendedAction(ctx);
    expect(result.kind).toBe('play_node');
    if (result.kind === 'play_node') {
      expect(result.node.id).toBe('c1p1');
    }
  });

  it('returns first requiredForStory available node ahead of optional', () => {
    const nodes = [
      makeNode({ id: 'opt1', status: 'available', requiredForStory: false }),
      makeNode({ id: 'req1', status: 'available', requiredForStory: true }),
    ];
    const ctx = makeContext(nodes);
    const result = getRecommendedAction(ctx);
    expect(result.kind).toBe('play_node');
    if (result.kind === 'play_node') {
      expect(result.node.id).toBe('req1');
    }
  });

  it('falls back to any available node when no story-required node exists', () => {
    const nodes = [
      makeNode({ id: 'opt1', status: 'available', requiredForStory: false }),
    ];
    const ctx = makeContext(nodes);
    const result = getRecommendedAction(ctx);
    expect(result.kind).toBe('play_node');
    if (result.kind === 'play_node') {
      expect(result.node.id).toBe('opt1');
    }
  });

  it('returns idle when all nodes are locked', () => {
    const nodes = [
      makeNode({ status: 'locked', lockReasons: [{ code: 'level_gate', message: 'Reach level 2' }] }),
    ];
    const ctx = makeContext(nodes);
    const result = getRecommendedAction(ctx);
    expect(result.kind).toBe('idle');
  });

  it('returns idle when nodes array is empty', () => {
    const ctx = makeContext([]);
    expect(getRecommendedAction(ctx).kind).toBe('idle');
  });

  it('cleared-only nodes also return idle', () => {
    const nodes = [makeNode({ status: 'cleared' })];
    const ctx = makeContext(nodes);
    expect(getRecommendedAction(ctx).kind).toBe('idle');
  });

  it('branch group with all-locked/cleared candidates is skipped', () => {
    const nodes = [
      makeNode({ id: 'c4a', status: 'locked', branchGroupId: 'ch4-branch', lockReasons: [{ code: 'level_gate', message: 'x' }] }),
      makeNode({ id: 'c4b', status: 'cleared', branchGroupId: 'ch4-branch' }),
    ];
    const ctx = makeContext(nodes);
    // Branch has no available candidates → falls through to idle
    expect(getRecommendedAction(ctx).kind).toBe('idle');
  });
});

// ── Section 3: getEmphasizedChapterId ────────────────────────────────────────

describe('getEmphasizedChapterId', () => {
  it('returns chapterId of in_progress node', () => {
    const nodes = [
      makeNode({ chapterId: 'chapter_1', status: 'cleared' }),
      makeNode({ id: 'c2p1', chapterId: 'chapter_2', chapterNumber: 2, status: 'in_progress' }),
    ];
    expect(getEmphasizedChapterId(nodes)).toBe('chapter_2');
  });

  it('prefers in_progress over available', () => {
    const nodes = [
      makeNode({ id: 'c1p1', chapterId: 'chapter_1', status: 'available' }),
      makeNode({ id: 'c2p1', chapterId: 'chapter_2', chapterNumber: 2, status: 'in_progress' }),
    ];
    expect(getEmphasizedChapterId(nodes)).toBe('chapter_2');
  });

  it('returns chapterId of first available when no in_progress', () => {
    const nodes = [
      makeNode({ chapterId: 'chapter_1', status: 'cleared' }),
      makeNode({ id: 'c2p1', chapterId: 'chapter_2', chapterNumber: 2, status: 'available' }),
    ];
    expect(getEmphasizedChapterId(nodes)).toBe('chapter_2');
  });

  it('returns null when all locked or cleared', () => {
    const nodes = [
      makeNode({ status: 'cleared' }),
      makeNode({ id: 'c2p1', status: 'locked', lockReasons: [{ code: 'x', message: 'x' }] }),
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
    expect(shouldOpenBranchChoice([makeNode()], {})).toBe(false);
  });

  it('returns true for an unresolved group with available candidates', () => {
    const nodes = [
      makeNode({ id: 'c4a', status: 'available', branchGroupId: 'g1' }),
      makeNode({ id: 'c4b', status: 'available', branchGroupId: 'g1' }),
    ];
    expect(shouldOpenBranchChoice(nodes, {})).toBe(true);
  });

  it('returns false when canonicalChoices resolves the group', () => {
    const nodes = [makeNode({ id: 'c4a', status: 'available', branchGroupId: 'g1' })];
    expect(shouldOpenBranchChoice(nodes, { g1: 'c4a' })).toBe(false);
  });

  it('returns false when canonicalBranchSelected is true on a member', () => {
    const nodes = [makeNode({ id: 'c4a', status: 'available', branchGroupId: 'g1', canonicalBranchSelected: true })];
    expect(shouldOpenBranchChoice(nodes, {})).toBe(false);
  });

  it('returns false when all group candidates are locked or cleared', () => {
    const nodes = [
      makeNode({ id: 'c4a', status: 'cleared', branchGroupId: 'g1' }),
      makeNode({ id: 'c4b', status: 'locked',  branchGroupId: 'g1', lockReasons: [{ code: 'x', message: 'x' }] }),
    ];
    expect(shouldOpenBranchChoice(nodes, {})).toBe(false);
  });
});

// ── Section 5: getFocusedChapterIds ──────────────────────────────────────────

describe('getFocusedChapterIds', () => {
  it('returns empty array when all locked', () => {
    const nodes = [makeNode({ status: 'locked', lockReasons: [{ code: 'x', message: 'x' }] })];
    expect(getFocusedChapterIds(nodes)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(getFocusedChapterIds([])).toEqual([]);
  });

  it('includes active chapter and its neighbors', () => {
    const nodes = [
      makeNode({ id: 'c1p1', chapterId: 'chapter_1', chapterNumber: 1, status: 'cleared' }),
      makeNode({ id: 'c2p1', chapterId: 'chapter_2', chapterNumber: 2, status: 'in_progress' }),
      makeNode({ id: 'c3p1', chapterId: 'chapter_3', chapterNumber: 3, status: 'locked', lockReasons: [{ code: 'x', message: 'x' }] }),
      makeNode({ id: 'c4p1', chapterId: 'chapter_4', chapterNumber: 4, status: 'locked', lockReasons: [{ code: 'x', message: 'x' }] }),
    ];
    const focused = getFocusedChapterIds(nodes);
    // ch2 is active; ch1 (n−1) and ch3 (n+1) are neighbors; ch4 is not included
    expect(focused).toContain('chapter_1');
    expect(focused).toContain('chapter_2');
    expect(focused).toContain('chapter_3');
    expect(focused).not.toContain('chapter_4');
  });

  it('result is in ascending chapter-number order', () => {
    const nodes = [
      makeNode({ id: 'c3p1', chapterId: 'chapter_3', chapterNumber: 3, status: 'available' }),
      makeNode({ id: 'c2p1', chapterId: 'chapter_2', chapterNumber: 2, status: 'cleared' }),
    ];
    const focused = getFocusedChapterIds(nodes);
    const nums = focused.map((id) => parseInt(id.replace('chapter_', ''), 10));
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
  });

  it('does not include chapters beyond neighbor range', () => {
    const nodes = [
      makeNode({ id: 'c5p1', chapterId: 'chapter_5', chapterNumber: 5, status: 'available' }),
    ];
    const focused = getFocusedChapterIds(nodes);
    // Only ch4, ch5, ch6 in window — ch1–3 must not appear
    for (const id of focused) {
      const num = parseInt(id.replace('chapter_', ''), 10);
      expect(num).toBeGreaterThanOrEqual(4);
      expect(num).toBeLessThanOrEqual(6);
    }
  });
});

// ── Section 6: getLockReasonsForNode / getPrimaryLockReason ──────────────────

describe('getLockReasonsForNode', () => {
  it('returns empty array for an available node', () => {
    expect(getLockReasonsForNode(makeNode({ status: 'available' }))).toEqual([]);
  });

  it('returns empty array for an in_progress node', () => {
    expect(getLockReasonsForNode(makeNode({ status: 'in_progress' }))).toEqual([]);
  });

  it('returns empty array for a cleared node', () => {
    expect(getLockReasonsForNode(makeNode({ status: 'cleared' }))).toEqual([]);
  });

  it('returns lockReasons for a locked node', () => {
    const reasons: JourneyGateReason[] = [
      { code: 'level_gate', message: 'Reach level 3 to unlock Chapter 2.' },
    ];
    const node = makeNode({ status: 'locked', lockReasons: reasons });
    expect(getLockReasonsForNode(node)).toEqual(reasons);
  });

  it('returns all reasons when multiple are present', () => {
    const reasons: JourneyGateReason[] = [
      { code: 'level_gate',       message: 'Level too low.' },
      { code: 'boss_keys_missing', message: 'Collect 3 boss keys first.' },
    ];
    const node = makeNode({ status: 'locked', lockReasons: reasons });
    expect(getLockReasonsForNode(node)).toHaveLength(2);
  });
});

describe('getPrimaryLockReason', () => {
  it('returns null for a non-locked node', () => {
    expect(getPrimaryLockReason(makeNode({ status: 'available' }))).toBeNull();
  });

  it('returns first reason for a locked node', () => {
    const reasons: JourneyGateReason[] = [
      { code: 'level_gate',       message: 'Level too low.' },
      { code: 'boss_keys_missing', message: 'Need keys.' },
    ];
    const node = makeNode({ status: 'locked', lockReasons: reasons });
    expect(getPrimaryLockReason(node)?.code).toBe('level_gate');
  });

  it('returns null when locked node has no reasons recorded', () => {
    const node = makeNode({ status: 'locked', lockReasons: [] });
    expect(getPrimaryLockReason(node)).toBeNull();
  });
});

// ── Section 7: isNightShiftUnlocked ──────────────────────────────────────────

describe('isNightShiftUnlocked', () => {
  it('is false at chapter 1', () => {
    expect(isNightShiftUnlocked(1)).toBe(false);
  });

  it('is false at chapter 5', () => {
    expect(isNightShiftUnlocked(5)).toBe(false);
  });

  it('is true at chapter 6', () => {
    expect(isNightShiftUnlocked(6)).toBe(true);
  });

  it('is true at chapter 10', () => {
    expect(isNightShiftUnlocked(10)).toBe(true);
  });

  it('is true beyond Book I (ch 15)', () => {
    expect(isNightShiftUnlocked(15)).toBe(true);
  });
});

// ── Section 8: isChapterStoryCleared ─────────────────────────────────────────

describe('isChapterStoryCleared', () => {
  const ch1 = CHAPTERS.find((c) => c.number === 1)!;
  const ch2 = CHAPTERS.find((c) => c.number === 2)!;

  it('Chapter 1 is not cleared with empty claimed list', () => {
    expect(isChapterStoryCleared(ch1, [])).toBe(false);
  });

  it('Chapter 1 is cleared when all required nodes are claimed', () => {
    const required = ch1.requiredCompletionNodes ?? [];
    expect(isChapterStoryCleared(ch1, required)).toBe(true);
  });

  it('partial claim is not cleared', () => {
    const required = ch1.requiredCompletionNodes ?? [];
    if (required.length > 1) {
      expect(isChapterStoryCleared(ch1, [required[0]])).toBe(false);
    }
  });

  it('Chapter 2 is not cleared with only ch1 nodes claimed', () => {
    const ch1nodes = ch1.requiredCompletionNodes ?? [];
    expect(isChapterStoryCleared(ch2, ch1nodes)).toBe(false);
  });

  it('Chapter 2 is cleared when its own required nodes are claimed', () => {
    const required = ch2.requiredCompletionNodes ?? [];
    expect(isChapterStoryCleared(ch2, required)).toBe(true);
  });

  it('extra claimed nodes beyond required do not break the check', () => {
    const required = ch1.requiredCompletionNodes ?? [];
    expect(isChapterStoryCleared(ch1, [...required, 'bonus_node_99'])).toBe(true);
  });

  it('a chapter with no requiredCompletionNodes is always cleared', () => {
    const noReq = { ...ch1, requiredCompletionNodes: undefined };
    expect(isChapterStoryCleared(noReq, [])).toBe(true);
  });

  it('a chapter with empty requiredCompletionNodes array is always cleared', () => {
    const empty = { ...ch1, requiredCompletionNodes: [] };
    expect(isChapterStoryCleared(empty, [])).toBe(true);
  });
});

// ── Section 9: isChapterMastered / countMasteryStars / maxMasteryStars ────────

describe('maxMasteryStars', () => {
  it('returns 0 for a chapter with only story parts', () => {
    const storyOnly = {
      ...CHAPTERS[0],
      parts: [
        { id: 's1', part: 1, type: 'story' as const, title: 'T', description: 'D', icon: 'book' },
      ],
      requiredCompletionNodes: [],
    };
    expect(maxMasteryStars(storyOnly)).toBe(0);
  });

  it('counts only battle/mini_boss/ward_defense parts', () => {
    const mixed = {
      ...CHAPTERS[0],
      parts: [
        { id: 'b1', part: 1, type: 'battle' as const, title: 'T', description: 'D', icon: 'flash' },
        { id: 'b2', part: 2, type: 'mini_boss' as const, title: 'T', description: 'D', icon: 'skull' },
        { id: 'b3', part: 3, type: 'ward_defense' as const, title: 'T', description: 'D', icon: 'shield' },
        { id: 's1', part: 4, type: 'story' as const, title: 'T', description: 'D', icon: 'book' },
        { id: 'p1', part: 5, type: 'battle' as const, title: 'T', description: 'D', icon: 'flash', isPlaceholder: true },
      ],
      requiredCompletionNodes: [],
    };
    // b1, b2, b3 qualify; s1 is story; p1 is placeholder → 3
    expect(maxMasteryStars(mixed)).toBe(3);
  });

  it('excludes placeholder parts', () => {
    const withPlaceholder = {
      ...CHAPTERS[0],
      parts: [
        { id: 'b1', part: 1, type: 'battle' as const, title: 'T', description: 'D', icon: 'flash' },
        { id: 'p1', part: 2, type: 'battle' as const, title: 'T', description: 'D', icon: 'flash', isPlaceholder: true },
      ],
      requiredCompletionNodes: [],
    };
    expect(maxMasteryStars(withPlaceholder)).toBe(1);
  });
});

describe('countMasteryStars', () => {
  it('returns 0 when nothing is claimed', () => {
    const ch = CHAPTERS.find((c) => c.number === 1)!;
    expect(countMasteryStars(ch, [])).toBe(0);
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
    // Claim b1 and s1 — only b1 is mastery-eligible
    expect(countMasteryStars(mixed, ['b1', 's1'])).toBe(1);
    expect(countMasteryStars(mixed, ['b1', 'b2'])).toBe(2);
  });
});

describe('isChapterMastered', () => {
  it('is false when story is not cleared', () => {
    const ch = CHAPTERS.find((c) => c.number === 1)!;
    expect(isChapterMastered(ch, [])).toBe(false);
  });

  it('is true for a story-only chapter once cleared', () => {
    const storyOnly = {
      ...CHAPTERS[0],
      parts: [
        { id: 's1', part: 1, type: 'story' as const, title: 'T', description: 'D', icon: 'book' },
      ],
      requiredCompletionNodes: ['s1'],
    };
    expect(isChapterMastered(storyOnly, ['s1'])).toBe(true);
  });

  it('is false when story cleared but some mastery nodes unclaimed', () => {
    const ch = {
      ...CHAPTERS[0],
      parts: [
        { id: 'b1', part: 1, type: 'battle' as const, title: 'T', description: 'D', icon: 'flash' },
        { id: 'b2', part: 2, type: 'battle' as const, title: 'T', description: 'D', icon: 'flash' },
        { id: 's1', part: 3, type: 'story'  as const, title: 'T', description: 'D', icon: 'book'  },
      ],
      requiredCompletionNodes: ['s1'],
    };
    // s1 claimed (story cleared) but b2 not claimed
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

  it('returns correct chapterId and chapterNumber', () => {
    const summary = buildChapterUiSummary(ch1, 1, []);
    expect(summary.chapterId).toBe('chapter_1');
    expect(summary.chapterNumber).toBe(1);
  });

  it('storyCleared is false when required nodes are not claimed', () => {
    const summary = buildChapterUiSummary(ch1, 1, []);
    expect(summary.storyCleared).toBe(false);
  });

  it('storyCleared is true once required nodes are claimed', () => {
    const claimed = ch1.requiredCompletionNodes ?? [];
    const summary = buildChapterUiSummary(ch1, 2, claimed);
    expect(summary.storyCleared).toBe(true);
  });

  it('masteryStars is 0 with no claimed nodes', () => {
    const summary = buildChapterUiSummary(ch1, 1, []);
    expect(summary.masteryStars).toBe(0);
  });

  it('maxMasteryStars is non-negative', () => {
    const summary = buildChapterUiSummary(ch1, 1, []);
    expect(summary.maxMasteryStars).toBeGreaterThanOrEqual(0);
  });

  it('current is true when chapter is the active chapter', () => {
    // Player level 1 → Chapter 1 is active (level 1 meets gate, chapter 2 is locked)
    const summary = buildChapterUiSummary(ch1, 1, []);
    expect(summary.current).toBe(true);
  });

  it('current is false for a locked chapter', () => {
    // Chapter 2 requires level > 1; player at level 1 means ch2 is locked
    const summary = buildChapterUiSummary(ch2, 1, []);
    expect(summary.current).toBe(false);
  });

  it('masteryStars does not exceed maxMasteryStars', () => {
    const allParts = ch1.parts.map((p) => p.id);
    const summary  = buildChapterUiSummary(ch1, 2, allParts);
    expect(summary.masteryStars).toBeLessThanOrEqual(summary.maxMasteryStars);
  });

  it('summary shape is complete (all required fields present)', () => {
    const summary = buildChapterUiSummary(ch1, 1, []);
    expect(summary).toHaveProperty('chapterId');
    expect(summary).toHaveProperty('chapterNumber');
    expect(summary).toHaveProperty('storyCleared');
    expect(summary).toHaveProperty('masteryStars');
    expect(summary).toHaveProperty('maxMasteryStars');
    expect(summary).toHaveProperty('current');
  });
});
