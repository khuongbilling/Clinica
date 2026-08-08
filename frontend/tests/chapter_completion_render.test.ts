/**
 * tests/chapter_completion_render.test.ts
 *
 * Section C: Render-level tests for ChapterCompletion.tsx.
 *
 * These tests catch drift between the boolean expressions in the component
 * and the derivation logic tested in chapter_completion.test.ts.
 * If someone edits the mastered/storyCleared conditionals or moves a testID to
 * the wrong branch, the pure-logic tests in Section A/B still pass but these
 * tests will fail.
 *
 * Strategy: mock react-native primitives as intrinsic string elements so
 * React.createElement produces plain JS objects. Walk the element tree to
 * collect testID props — no jsdom or native runtime needed.
 *
 * INVARIANTS UNDER TEST:
 *   • storyCleared + maxMasteryStars > 0 + masteryStars >= max  → "chapter-completion-mastered"
 *   • storyCleared, mastery incomplete (or no mastery nodes)    → "chapter-completion-cleared"
 *   • storyCleared:false                                        → "chapter-completion-progress"
 *   • maxMasteryStars === 0 → mastery sub-text absent in cleared state
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// ── Mock react-native ──────────────────────────────────────────────────────────
// View and Text become intrinsic string elements so React.createElement returns
// plain objects we can walk.  StyleSheet.create is an identity pass-through.
vi.mock('react-native', () => ({
  View:       'View',
  Text:       'Text',
  StyleSheet: { create: (s: Record<string, unknown>) => s },
}));

// Import AFTER mock registration (vitest hoists vi.mock calls before imports).
import { ChapterCompletion } from '../src/features/journey/ui/ChapterCompletion';

// ── Element tree walker ────────────────────────────────────────────────────────

type AnyElement = React.ReactElement | null | undefined | boolean | number | string;

/** Recursively collect all testID values found in the element tree. */
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

/** Recursively collect all Text node string children in the element tree. */
function collectTextContent(el: AnyElement): string[] {
  if (el == null) return [];
  if (typeof el === 'string' || typeof el === 'number') return [String(el)];
  if (typeof el !== 'object') return [];
  const elem = el as React.ReactElement<{ children?: AnyElement | AnyElement[] }>;
  const { children } = elem.props ?? {};
  if (Array.isArray(children)) {
    return children.flatMap(c => collectTextContent(c as AnyElement));
  }
  if (children != null) return collectTextContent(children as AnyElement);
  return [];
}

/**
 * Invoke the component as a function to obtain its element tree.
 * React.createElement(ChapterCompletion, props) produces a lazy element;
 * calling the component directly returns the actual rendered tree.
 */
function render(props: { storyCleared: boolean; masteryStars: number; maxMasteryStars: number }) {
  return (ChapterCompletion as (p: typeof props) => React.ReactElement)(props);
}

// ── Section C: testID mount verification ──────────────────────────────────────

describe('ChapterCompletion — render-level: correct testID per state', () => {
  it('mounts chapter-completion-mastered when storyCleared + full mastery stars', () => {
    const el = render({ storyCleared: true, masteryStars: 3, maxMasteryStars: 3 });
    const ids = collectTestIDs(el);
    expect(ids).toContain('chapter-completion-mastered');
    expect(ids).not.toContain('chapter-completion-cleared');
    expect(ids).not.toContain('chapter-completion-progress');
  });

  it('mounts chapter-completion-mastered when masteryStars exceeds maxMasteryStars', () => {
    const el = render({ storyCleared: true, masteryStars: 5, maxMasteryStars: 3 });
    const ids = collectTestIDs(el);
    expect(ids).toContain('chapter-completion-mastered');
  });

  it('mounts chapter-completion-cleared when storyCleared + partial mastery', () => {
    const el = render({ storyCleared: true, masteryStars: 1, maxMasteryStars: 3 });
    const ids = collectTestIDs(el);
    expect(ids).toContain('chapter-completion-cleared');
    expect(ids).not.toContain('chapter-completion-mastered');
    expect(ids).not.toContain('chapter-completion-progress');
  });

  it('mounts chapter-completion-cleared when storyCleared + 0 mastery stars (maxMasteryStars > 0)', () => {
    const el = render({ storyCleared: true, masteryStars: 0, maxMasteryStars: 3 });
    const ids = collectTestIDs(el);
    expect(ids).toContain('chapter-completion-cleared');
    expect(ids).not.toContain('chapter-completion-mastered');
  });

  it('mounts chapter-completion-cleared for narrative chapter (maxMasteryStars === 0)', () => {
    // A narrative chapter that is story-cleared — mastered is impossible.
    const el = render({ storyCleared: true, masteryStars: 0, maxMasteryStars: 0 });
    const ids = collectTestIDs(el);
    expect(ids).toContain('chapter-completion-cleared');
    expect(ids).not.toContain('chapter-completion-mastered');
    expect(ids).not.toContain('chapter-completion-progress');
  });

  it('mounts chapter-completion-progress when storyCleared is false', () => {
    const el = render({ storyCleared: false, masteryStars: 0, maxMasteryStars: 3 });
    const ids = collectTestIDs(el);
    expect(ids).toContain('chapter-completion-progress');
    expect(ids).not.toContain('chapter-completion-mastered');
    expect(ids).not.toContain('chapter-completion-cleared');
  });

  it('mounts chapter-completion-progress even with full mastery stars when storyCleared is false', () => {
    // Guard: mastery stars alone must not flip the badge.
    const el = render({ storyCleared: false, masteryStars: 3, maxMasteryStars: 3 });
    const ids = collectTestIDs(el);
    expect(ids).toContain('chapter-completion-progress');
    expect(ids).not.toContain('chapter-completion-mastered');
  });

  it('exactly one testID is present in the tree for each state', () => {
    const cases: [{ storyCleared: boolean; masteryStars: number; maxMasteryStars: number }, string][] = [
      [{ storyCleared: true,  masteryStars: 3, maxMasteryStars: 3 }, 'chapter-completion-mastered'],
      [{ storyCleared: true,  masteryStars: 1, maxMasteryStars: 3 }, 'chapter-completion-cleared'],
      [{ storyCleared: false, masteryStars: 0, maxMasteryStars: 3 }, 'chapter-completion-progress'],
    ];
    for (const [props, expectedID] of cases) {
      const ids = collectTestIDs(render(props));
      const known = ['chapter-completion-mastered', 'chapter-completion-cleared', 'chapter-completion-progress'];
      const found = ids.filter(id => known.includes(id));
      expect(found).toEqual([expectedID]);
    }
  });
});

// ── Section C2: mastery progress line visibility ───────────────────────────────

describe('ChapterCompletion — render-level: mastery progress sub-text', () => {
  it('mastery sub-text IS present in cleared state when maxMasteryStars > 0', () => {
    const el = render({ storyCleared: true, masteryStars: 1, maxMasteryStars: 3 });
    const texts = collectTextContent(el).join(' ');
    // Should contain the "Optional Mastery" sub-text (the fraction arrives as
    // separate JSX expressions, so check the label string that only appears
    // when hasMastery is true).
    expect(texts).toContain('Optional Mastery');
  });

  it('mastery sub-text is ABSENT in cleared state when maxMasteryStars === 0', () => {
    // Narrative chapter: hasMastery = false → {hasMastery && <Text>...} is not rendered.
    const el = render({ storyCleared: true, masteryStars: 0, maxMasteryStars: 0 });
    const texts = collectTextContent(el).join(' ');
    // Should NOT contain a fraction like "0/0 Optional Mastery"
    expect(texts).not.toContain('0/0');
    expect(texts).not.toContain('Optional Mastery');
  });

  it('mastery sub-text is absent in "in progress" state regardless of maxMasteryStars', () => {
    const el = render({ storyCleared: false, masteryStars: 0, maxMasteryStars: 3 });
    const texts = collectTextContent(el).join(' ');
    expect(texts).not.toContain('Optional Mastery');
  });
});
