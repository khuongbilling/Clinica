/**
 * ChapterCompletion — presentation component only.
 *
 * Push G: story cleared vs mastered is a DISPLAY state, not a progression gate.
 *
 * Three render states:
 *   mastered       — storyCleared + maxMasteryStars > 0 + masteryStars >= max
 *   story cleared  — storyCleared, mastery incomplete (or no mastery nodes)
 *   in progress    — story not yet cleared
 *
 * KEY INVARIANTS:
 *   • Story advancement depends on storyCleared / existing gate evaluator,
 *     NOT on masteryStars. Mastery is optional content.
 *   • maxMasteryStars === 0 → "Mastered" is unreachable even if storyCleared.
 *   • Mastery progress line is hidden when maxMasteryStars === 0 (nothing to show).
 *
 * This component is deliberately dumb — it receives primitives and renders.
 * The caller (ChapterPage, chapter header) owns the data lookup.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ChapterCompletionProps {
  storyCleared:    boolean;
  masteryStars:    number;
  maxMasteryStars: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChapterCompletion({
  storyCleared,
  masteryStars,
  maxMasteryStars,
}: ChapterCompletionProps) {
  // INVARIANT: mastered requires maxMasteryStars > 0.
  // A narrative chapter (maxMasteryStars === 0) is NEVER mastered even if cleared.
  const mastered =
    storyCleared &&
    maxMasteryStars > 0 &&
    masteryStars >= maxMasteryStars;

  // Show mastery progress only when the chapter has mastery-eligible nodes.
  const hasMastery = maxMasteryStars > 0;

  if (mastered) {
    return (
      <View
        style={[styles.wrap, styles.masteredWrap]}
        testID="chapter-completion-mastered"
      >
        <Text style={[styles.label, styles.masteredLabel]}>Mastered</Text>
        <Text style={[styles.sub, styles.masteredSub]}>
          {masteryStars}/{maxMasteryStars} Optional Mastery
        </Text>
      </View>
    );
  }

  if (storyCleared) {
    return (
      <View
        style={[styles.wrap, styles.clearedWrap]}
        testID="chapter-completion-cleared"
      >
        <Text style={[styles.label, styles.clearedLabel]}>Story Cleared</Text>
        {hasMastery && (
          <Text style={[styles.sub, styles.clearedSub]}>
            {masteryStars}/{maxMasteryStars} Optional Mastery
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID="chapter-completion-progress">
      <Text style={[styles.label, styles.progressLabel]}>Story in Progress</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    gap:            4,
    paddingVertical: 6,
  },

  label: {
    fontSize:      14,
    fontWeight:    '700',
    letterSpacing: 0.2,
  },
  sub: {
    fontSize:   12,
    lineHeight: 16,
  },

  // Mastered — warm gold
  masteredWrap:  {},
  masteredLabel: { color: '#d4a017' },
  masteredSub:   { color: '#b0882a' },

  // Story cleared — teal/mint
  clearedWrap:  {},
  clearedLabel: { color: '#20c4a8' },
  clearedSub:   { color: '#1a9a84' },

  // In progress — muted
  progressLabel: { color: '#8080a0' },
});
