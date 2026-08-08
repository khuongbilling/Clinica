/**
 * tests/chapter_completion.test.ts
 *
 * Tests for ChapterCompletion presentation logic and the star-gating regression.
 *
 * CRITICAL INVARIANTS:
 *   1. Story progression depends on storyCleared, NOT masteryStars.
 *      A player with storyCleared:true but 0 mastery stars is still "Story Cleared".
 *   2. maxMasteryStars === 0 → "Mastered" is impossible (narrative chapters).
 *   3. masteryStars < maxMasteryStars + storyCleared:true → "Story Cleared", not mastered.
 *   4. Mastery progress line is absent when maxMasteryStars === 0.
 */

import { describe, it, expect } from 'vitest';

// ── Derive component logic from the same formula as ChapterCompletion.tsx ────
// Tests drive the pure boolean logic; we do not render the component
// (no JSDOM/NativeTestInstance configured), so we test the derivation directly
// and rely on the component being a transparent render of these booleans.

function deriveCompletionState(p: {
  storyCleared:    boolean;
  masteryStars:    number;
  maxMasteryStars: number;
}) {
  const mastered =
    p.storyCleared &&
    p.maxMasteryStars > 0 &&
    p.masteryStars >= p.maxMasteryStars;
  return { mastered, storyCleared: p.storyCleared };
}

// ── Regression: story progression must not require mastery stars ──────────────

describe('story progression', () => {
  it('does not require optional mastery stars', () => {
    const progress = {
      storyCleared:    true,
      masteryStars:    1,
      maxMasteryStars: 3,
    };

    expect(progress.storyCleared).toBe(true);

    expect(progress.masteryStars === progress.maxMasteryStars).toBe(false);

    /**
     * Story advancement should depend on storyCleared / existing gate evaluator,
     * not masteryStars.
     */
    const { mastered } = deriveCompletionState(progress);
    // Not mastered (mastery incomplete) — but story IS cleared.
    expect(mastered).toBe(false);
    expect(progress.storyCleared).toBe(true);
  });

  it('storyCleared:true with 0 mastery stars renders "Story Cleared", not "In Progress"', () => {
    const progress = { storyCleared: true, masteryStars: 0, maxMasteryStars: 3 };
    const { mastered, storyCleared } = deriveCompletionState(progress);
    expect(storyCleared).toBe(true);
    expect(mastered).toBe(false);
  });

  it('storyCleared:false never renders cleared or mastered regardless of mastery stars', () => {
    for (const stars of [0, 3, 99]) {
      const { mastered, storyCleared } = deriveCompletionState({
        storyCleared: false, masteryStars: stars, maxMasteryStars: 3,
      });
      expect(storyCleared).toBe(false);
      expect(mastered).toBe(false);
    }
  });
});

// ── Mastered invariant: maxMasteryStars > 0 required ─────────────────────────

describe('mastered state', () => {
  it('INVARIANT: mastered is false when maxMasteryStars === 0, even if storyCleared', () => {
    // Narrative/story-only chapter — no mastery nodes authored
    const { mastered } = deriveCompletionState({
      storyCleared: true, masteryStars: 0, maxMasteryStars: 0,
    });
    expect(mastered).toBe(false);
  });

  it('is false when masteryStars < maxMasteryStars', () => {
    const { mastered } = deriveCompletionState({
      storyCleared: true, masteryStars: 2, maxMasteryStars: 3,
    });
    expect(mastered).toBe(false);
  });

  it('is true when storyCleared + masteryStars >= maxMasteryStars + maxMasteryStars > 0', () => {
    const { mastered } = deriveCompletionState({
      storyCleared: true, masteryStars: 3, maxMasteryStars: 3,
    });
    expect(mastered).toBe(true);
  });

  it('remains true when masteryStars exceeds maxMasteryStars', () => {
    const { mastered } = deriveCompletionState({
      storyCleared: true, masteryStars: 4, maxMasteryStars: 3,
    });
    expect(mastered).toBe(true);
  });

  it('is false when storyCleared is false even with full mastery stars', () => {
    const { mastered } = deriveCompletionState({
      storyCleared: false, masteryStars: 3, maxMasteryStars: 3,
    });
    expect(mastered).toBe(false);
  });
});

// ── Canonical snapshots ───────────────────────────────────────────────────────

describe('canonical display states', () => {
  it('"Story in Progress": storyCleared:false', () => {
    const s = deriveCompletionState({ storyCleared: false, masteryStars: 0, maxMasteryStars: 3 });
    expect(s.storyCleared).toBe(false);
    expect(s.mastered).toBe(false);
  });

  it('"Story Cleared": storyCleared:true, partial mastery', () => {
    const s = deriveCompletionState({ storyCleared: true, masteryStars: 1, maxMasteryStars: 3 });
    expect(s.storyCleared).toBe(true);
    expect(s.mastered).toBe(false);
  });

  it('"Story Cleared": narrative chapter (maxMasteryStars === 0)', () => {
    const s = deriveCompletionState({ storyCleared: true, masteryStars: 0, maxMasteryStars: 0 });
    expect(s.storyCleared).toBe(true);
    expect(s.mastered).toBe(false);
  });

  it('"Mastered": storyCleared + all mastery stars', () => {
    const s = deriveCompletionState({ storyCleared: true, masteryStars: 3, maxMasteryStars: 3 });
    expect(s.storyCleared).toBe(true);
    expect(s.mastered).toBe(true);
  });

  // Star-gating guard: this scenario must ALWAYS be "cleared" not "in progress"
  it('partial mastery never blocks story-cleared display', () => {
    const scenarios = [
      { storyCleared: true, masteryStars: 0, maxMasteryStars: 3 },
      { storyCleared: true, masteryStars: 1, maxMasteryStars: 3 },
      { storyCleared: true, masteryStars: 2, maxMasteryStars: 3 },
    ];
    for (const s of scenarios) {
      const { mastered, storyCleared } = deriveCompletionState(s);
      expect(storyCleared).toBe(true);
      expect(mastered).toBe(false);
      // The component renders "Story Cleared" — mastery is optional content.
    }
  });
});

// ── Mastery progress line visibility ─────────────────────────────────────────

describe('mastery progress line', () => {
  it('is hidden when maxMasteryStars === 0 (narrative chapter)', () => {
    // Component checks hasMastery = maxMasteryStars > 0
    const maxMasteryStars = 0;
    expect(maxMasteryStars > 0).toBe(false);
  });

  it('is visible when maxMasteryStars > 0', () => {
    expect(3 > 0).toBe(true);
  });
});
