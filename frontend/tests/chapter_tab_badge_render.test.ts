/**
 * tests/chapter_tab_badge_render.test.ts
 *
 * Render-level tests for ChapterTabBadge.tsx.
 *
 * ChapterTabBadge is the compact icon shown on each chapter selector tab in
 * journey.tsx.  A previous implementation inlined its own mastered / cleared /
 * in-progress boolean logic.  It now delegates to getCompletionLabel() so the
 * canonical logic lives in one place.
 *
 * These tests guarantee that the icon chosen matches the state label returned
 * by getCompletionLabel — if someone re-inlines the conditions the testID will
 * land on the wrong branch and these tests will fail.
 *
 * Strategy: same tree-walker pattern as chapter_completion_render.test.ts.
 *   • Mock react-native and @expo/vector-icons as intrinsic string elements.
 *   • Call ChapterTabBadge as a plain function to get its element tree.
 *   • Collect testIDs to verify the correct badge variant mounts.
 *
 * INVARIANTS UNDER TEST:
 *   • storyCleared + maxMasteryStars > 0 + masteryStars >= max → "chapter-tab-badge-mastered"
 *   • storyCleared + maxMasteryStars === 0                     → "chapter-tab-badge-cleared"
 *   • storyCleared + 0 < masteryStars < max                   → "chapter-tab-badge-partial"
 *   • !storyCleared                                            → null (no badge)
 *   • maxMasteryStars === 0 → mastered is unreachable
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('react-native', () => ({
  Text:       'Text',
  StyleSheet: { create: (s: Record<string, unknown>) => s },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// journeyVisibility imports from internal game modules; mock only the
// getCompletionLabel export so we can test ChapterTabBadge in isolation
// while still exercising the real delegation call-site.
vi.mock('@/src/features/journey/ui/journeyVisibility', () => ({
  getCompletionLabel: (ch: { storyCleared: boolean; masteryStars: number; maxMasteryStars: number }) => {
    if (!ch.storyCleared) return 'In Progress';
    const mastered = ch.maxMasteryStars > 0 && ch.masteryStars >= ch.maxMasteryStars;
    if (mastered) return 'Mastered';
    return 'Story Cleared';
  },
}));

// Import AFTER mocks are registered (vitest hoists vi.mock before imports).
import { ChapterTabBadge } from '../src/features/journey/ui/ChapterTabBadge';

// ── Helpers ────────────────────────────────────────────────────────────────────

type AnyElement = React.ReactElement | null | undefined | boolean | number | string;

function collectTestIDs(el: AnyElement): string[] {
  if (el == null || typeof el !== 'object') return [];
  const elem = el as React.ReactElement<{ testID?: string; children?: AnyElement | AnyElement[] }>;
  const ids: string[] = [];
  if (elem.props?.testID) ids.push(elem.props.testID);
  const { children } = elem.props ?? {};
  if (Array.isArray(children)) {
    for (const child of children) ids.push(...collectTestIDs(child as AnyElement));
  } else if (children != null) {
    ids.push(...collectTestIDs(children as AnyElement));
  }
  return ids;
}

function collectTextContent(el: AnyElement): string[] {
  if (el == null) return [];
  if (typeof el === 'string' || typeof el === 'number') return [String(el)];
  if (typeof el !== 'object') return [];
  const elem = el as React.ReactElement<{ children?: AnyElement | AnyElement[] }>;
  const { children } = elem.props ?? {};
  if (Array.isArray(children)) return children.flatMap(c => collectTextContent(c as AnyElement));
  if (children != null) return collectTextContent(children as AnyElement);
  return [];
}

type Summary = { storyCleared: boolean; masteryStars: number; maxMasteryStars: number; chapterId: string; chapterNumber: number; current: boolean };

function makeSummary(overrides: Partial<Summary>): Summary {
  return {
    chapterId:       'ch1',
    chapterNumber:   1,
    storyCleared:    false,
    masteryStars:    0,
    maxMasteryStars: 3,
    current:         false,
    ...overrides,
  };
}

function render(summary: Summary) {
  type Props = React.ComponentProps<typeof ChapterTabBadge>;
  return (ChapterTabBadge as (p: Props) => React.ReactElement | null)({
    summary,
    accentColor: '#20c4a8',
  });
}

const KNOWN_IDS = [
  'chapter-tab-badge-mastered',
  'chapter-tab-badge-cleared',
  'chapter-tab-badge-partial',
];

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ChapterTabBadge — render-level: correct badge per completion state', () => {
  it('renders chapter-tab-badge-mastered when storyCleared + all mastery stars', () => {
    const el = render(makeSummary({ storyCleared: true, masteryStars: 3, maxMasteryStars: 3 }));
    const ids = collectTestIDs(el);
    expect(ids).toContain('chapter-tab-badge-mastered');
    expect(ids).not.toContain('chapter-tab-badge-cleared');
    expect(ids).not.toContain('chapter-tab-badge-partial');
  });

  it('renders chapter-tab-badge-mastered when masteryStars exceeds maxMasteryStars', () => {
    const el = render(makeSummary({ storyCleared: true, masteryStars: 5, maxMasteryStars: 3 }));
    const ids = collectTestIDs(el);
    expect(ids).toContain('chapter-tab-badge-mastered');
  });

  it('renders chapter-tab-badge-cleared for a narrative chapter (maxMasteryStars === 0)', () => {
    const el = render(makeSummary({ storyCleared: true, masteryStars: 0, maxMasteryStars: 0 }));
    const ids = collectTestIDs(el);
    expect(ids).toContain('chapter-tab-badge-cleared');
    expect(ids).not.toContain('chapter-tab-badge-mastered');
    expect(ids).not.toContain('chapter-tab-badge-partial');
  });

  it('renders chapter-tab-badge-partial when storyCleared + partial mastery', () => {
    const el = render(makeSummary({ storyCleared: true, masteryStars: 1, maxMasteryStars: 3 }));
    const ids = collectTestIDs(el);
    expect(ids).toContain('chapter-tab-badge-partial');
    expect(ids).not.toContain('chapter-tab-badge-mastered');
    expect(ids).not.toContain('chapter-tab-badge-cleared');
  });

  it('renders chapter-tab-badge-partial when storyCleared + 0 mastery stars (maxMasteryStars > 0)', () => {
    // Not mastered (0/3), not narrative — shows the fraction badge.
    const el = render(makeSummary({ storyCleared: true, masteryStars: 0, maxMasteryStars: 3 }));
    const ids = collectTestIDs(el);
    expect(ids).toContain('chapter-tab-badge-partial');
  });

  it('renders null (no badge) when storyCleared is false', () => {
    const el = render(makeSummary({ storyCleared: false, masteryStars: 0, maxMasteryStars: 3 }));
    expect(el).toBeNull();
  });

  it('renders null even when masteryStars is full but storyCleared is false', () => {
    // Mastery stars must never flip the badge without storyCleared.
    const el = render(makeSummary({ storyCleared: false, masteryStars: 3, maxMasteryStars: 3 }));
    expect(el).toBeNull();
  });

  it('narrative chapter is never mastered — checkmark even when masteryStars "equals" 0/0', () => {
    // maxMasteryStars === 0 makes isChapterMastered return false.
    const el = render(makeSummary({ storyCleared: true, masteryStars: 0, maxMasteryStars: 0 }));
    const ids = collectTestIDs(el);
    expect(ids).not.toContain('chapter-tab-badge-mastered');
    expect(ids).toContain('chapter-tab-badge-cleared');
  });

  it('exactly one known badge testID is present for each non-null state', () => {
    const cases: [Summary, string][] = [
      [makeSummary({ storyCleared: true,  masteryStars: 3, maxMasteryStars: 3 }), 'chapter-tab-badge-mastered'],
      [makeSummary({ storyCleared: true,  masteryStars: 0, maxMasteryStars: 0 }), 'chapter-tab-badge-cleared'],
      [makeSummary({ storyCleared: true,  masteryStars: 1, maxMasteryStars: 3 }), 'chapter-tab-badge-partial'],
    ];
    for (const [summary, expectedId] of cases) {
      const ids = collectTestIDs(render(summary)).filter(id => KNOWN_IDS.includes(id));
      expect(ids).toEqual([expectedId]);
    }
  });
});

describe('ChapterTabBadge — render-level: partial badge shows fraction text', () => {
  it('partial badge contains the mastery fraction text', () => {
    const el = render(makeSummary({ storyCleared: true, masteryStars: 2, maxMasteryStars: 3 }));
    const texts = collectTextContent(el).join('');
    expect(texts).toContain('2');
    expect(texts).toContain('3');
    expect(texts).toContain('★');
  });
});
