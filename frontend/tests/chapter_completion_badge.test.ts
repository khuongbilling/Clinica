/**
 * tests/chapter_completion_badge.test.ts
 *
 * Unit tests for getChapterTabBadgeState — the pure function that drives
 * which badge (checkmark / star / partial / lock / none) renders on each
 * chapter selector tab in journey.tsx.
 *
 * Covered states (one test group each):
 *   1. locked         → { kind: 'lock' }
 *   2. narrative ✓    → { kind: 'checkmark' }   (storyCleared, maxMasteryStars === 0)
 *   3. mastered ★     → { kind: 'star' }         (storyCleared, masteryStars >= max > 0)
 *   4. partial n/max★ → { kind: 'partial' }      (storyCleared, 0 < masteryStars < max)
 *   5. uncleared      → { kind: 'none' }         (not locked, not cleared)
 *   6. edge cases
 */

import { describe, it, expect } from 'vitest';
import {
  getChapterTabBadgeState,
  type ChapterTabBadgeState,
} from '../src/features/journey/ui/journeyVisibility';
import type { ChapterUiSummary } from '../src/features/journey/ui/journeyUi.types';

// ── Fixture factory ───────────────────────────────────────────────────────────

function summary(overrides: Partial<ChapterUiSummary> = {}): ChapterUiSummary {
  return {
    chapterId:       'chapter_1',
    chapterNumber:   1,
    storyCleared:    false,
    masteryStars:    0,
    maxMasteryStars: 0,
    current:         true,
    ...overrides,
  };
}

// ── 1. Locked tab ─────────────────────────────────────────────────────────────

describe('getChapterTabBadgeState — locked', () => {
  it('returns lock when chapter is locked, regardless of storyCleared', () => {
    const badge = getChapterTabBadgeState(
      summary({ storyCleared: false, masteryStars: 0, maxMasteryStars: 0 }),
      /* locked */ true,
    );
    expect(badge.kind).toBe('lock');
  });

  it('returns lock even when story appears cleared (gate not yet passed)', () => {
    // A player could have storyCleared=true data but the chapter still locked
    // (e.g. from a content patch that added a new gate).
    const badge = getChapterTabBadgeState(
      summary({ storyCleared: true, masteryStars: 3, maxMasteryStars: 3 }),
      /* locked */ true,
    );
    expect(badge.kind).toBe('lock');
  });

  it('lock badge has no earned/total fields', () => {
    const badge = getChapterTabBadgeState(summary(), /* locked */ true);
    expect(badge).not.toHaveProperty('earned');
    expect(badge).not.toHaveProperty('total');
  });
});

// ── 2. Narrative cleared (checkmark ✓) ───────────────────────────────────────

describe('getChapterTabBadgeState — narrative cleared (checkmark)', () => {
  it('returns checkmark for a story-only chapter that is cleared', () => {
    const badge = getChapterTabBadgeState(
      summary({ storyCleared: true, masteryStars: 0, maxMasteryStars: 0 }),
      /* locked */ false,
    );
    expect(badge.kind).toBe('checkmark');
  });

  it('checkmark has no earned/total fields', () => {
    const badge = getChapterTabBadgeState(
      summary({ storyCleared: true, maxMasteryStars: 0 }),
      false,
    );
    expect(badge).not.toHaveProperty('earned');
    expect(badge).not.toHaveProperty('total');
  });

  it('does NOT return checkmark when maxMasteryStars > 0 (mastery exists)', () => {
    const badge = getChapterTabBadgeState(
      summary({ storyCleared: true, masteryStars: 0, maxMasteryStars: 2 }),
      false,
    );
    expect(badge.kind).not.toBe('checkmark');
  });
});

// ── 3. Fully mastered (star ★) ────────────────────────────────────────────────

describe('getChapterTabBadgeState — mastered (star)', () => {
  it('returns star when masteryStars equals maxMasteryStars', () => {
    const badge = getChapterTabBadgeState(
      summary({ storyCleared: true, masteryStars: 3, maxMasteryStars: 3 }),
      false,
    );
    expect(badge.kind).toBe('star');
  });

  it('returns star when masteryStars exceeds maxMasteryStars (bonus stars)', () => {
    const badge = getChapterTabBadgeState(
      summary({ storyCleared: true, masteryStars: 5, maxMasteryStars: 3 }),
      false,
    );
    expect(badge.kind).toBe('star');
  });

  it('returns star for single-star chapters (maxMasteryStars === 1) when earned', () => {
    const badge = getChapterTabBadgeState(
      summary({ storyCleared: true, masteryStars: 1, maxMasteryStars: 1 }),
      false,
    );
    expect(badge.kind).toBe('star');
  });

  it('star badge has no earned/total fields', () => {
    const badge = getChapterTabBadgeState(
      summary({ storyCleared: true, masteryStars: 3, maxMasteryStars: 3 }),
      false,
    );
    expect(badge).not.toHaveProperty('earned');
    expect(badge).not.toHaveProperty('total');
  });
});

// ── 4. Partial mastery (n/max ★) ─────────────────────────────────────────────

describe('getChapterTabBadgeState — partial mastery', () => {
  it('returns partial when 0 < masteryStars < maxMasteryStars', () => {
    const badge = getChapterTabBadgeState(
      summary({ storyCleared: true, masteryStars: 1, maxMasteryStars: 3 }),
      false,
    );
    expect(badge.kind).toBe('partial');
  });

  it('partial badge carries correct earned count', () => {
    const badge = getChapterTabBadgeState(
      summary({ storyCleared: true, masteryStars: 2, maxMasteryStars: 5 }),
      false,
    );
    expect(badge.kind).toBe('partial');
    if (badge.kind === 'partial') {
      expect(badge.earned).toBe(2);
      expect(badge.total).toBe(5);
    }
  });

  it('partial badge when masteryStars is 0 and maxMasteryStars > 0', () => {
    // Story cleared but no mastery nodes claimed yet.
    const badge = getChapterTabBadgeState(
      summary({ storyCleared: true, masteryStars: 0, maxMasteryStars: 3 }),
      false,
    );
    expect(badge.kind).toBe('partial');
    if (badge.kind === 'partial') {
      expect(badge.earned).toBe(0);
      expect(badge.total).toBe(3);
    }
  });

  it('partial badge label components match summary fields', () => {
    const s = summary({ storyCleared: true, masteryStars: 1, maxMasteryStars: 4 });
    const badge = getChapterTabBadgeState(s, false);
    expect(badge.kind).toBe('partial');
    if (badge.kind === 'partial') {
      // These are what journey.tsx renders as "{earned}/{total}★"
      expect(`${badge.earned}/${badge.total}★`).toBe('1/4★');
    }
  });
});

// ── 5. Story not cleared (no badge) ──────────────────────────────────────────

describe('getChapterTabBadgeState — uncleared (none)', () => {
  it('returns none when story is not cleared and chapter is unlocked', () => {
    const badge = getChapterTabBadgeState(
      summary({ storyCleared: false, masteryStars: 0, maxMasteryStars: 3 }),
      false,
    );
    expect(badge.kind).toBe('none');
  });

  it('returns none for a fresh, in-progress chapter', () => {
    const badge = getChapterTabBadgeState(
      summary({ storyCleared: false, current: true }),
      false,
    );
    expect(badge.kind).toBe('none');
  });

  it('none badge has no earned/total fields', () => {
    const badge = getChapterTabBadgeState(summary({ storyCleared: false }), false);
    expect(badge).not.toHaveProperty('earned');
    expect(badge).not.toHaveProperty('total');
  });
});

// ── 6. Exhaustiveness: all five kinds are reachable ──────────────────────────

describe('getChapterTabBadgeState — all badge kinds reachable', () => {
  const allKinds: ChapterTabBadgeState['kind'][] = [
    'lock', 'none', 'checkmark', 'star', 'partial',
  ];

  it('every badge kind maps to exactly one scenario', () => {
    const scenarios: ChapterTabBadgeState[] = [
      getChapterTabBadgeState(summary(), true),                                                                          // lock
      getChapterTabBadgeState(summary({ storyCleared: false }), false),                                                // none
      getChapterTabBadgeState(summary({ storyCleared: true, maxMasteryStars: 0 }), false),                             // checkmark
      getChapterTabBadgeState(summary({ storyCleared: true, masteryStars: 3, maxMasteryStars: 3 }), false),            // star
      getChapterTabBadgeState(summary({ storyCleared: true, masteryStars: 1, maxMasteryStars: 3 }), false),            // partial
    ];

    const producedKinds = scenarios.map((b) => b.kind);
    expect(producedKinds.sort()).toEqual([...allKinds].sort());
  });
});
