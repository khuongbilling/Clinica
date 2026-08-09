/**
 * ChapterTabBadge — compact icon shown on a chapter selector tab.
 *
 * Delegates the mastered / story-cleared / in-progress decision entirely to
 * `getCompletionLabel` from journeyVisibility so this component can never
 * drift from the canonical boolean logic in ChapterCompletion.tsx.
 *
 * Three render states:
 *   Mastered      → gold star (⭐) Ionicons icon  testID="chapter-tab-badge-mastered"
 *   Story Cleared, no mastery nodes
 *                 → accent checkmark icon          testID="chapter-tab-badge-cleared"
 *   Story Cleared, mastery in progress
 *                 → "n/max★" text badge            testID="chapter-tab-badge-partial"
 *   In Progress   → null (nothing shown)
 *
 * This component is intentionally presentational — it receives a ChapterUiSummary
 * and the tab accent color, and renders the appropriate badge.
 */

import React from 'react';
import { Text, type TextStyle, type StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCompletionLabel } from './journeyVisibility';
import type { ChapterUiSummary } from './journeyUi.types';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ChapterTabBadgeProps {
  /** Summary built by buildChapterUiSummary — provides storyCleared, masteryStars, maxMasteryStars. */
  summary: ChapterUiSummary;
  /** Tab accent color used for the "cleared" checkmark icon. */
  accentColor: string;
  /** Optional style for the partial-mastery "n/max★" text node. */
  badgeTextStyle?: StyleProp<TextStyle>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChapterTabBadge({
  summary,
  accentColor,
  badgeTextStyle,
}: ChapterTabBadgeProps): React.ReactElement | null {
  // Single authoritative decision — no inlined boolean logic.
  const label = getCompletionLabel(summary);

  if (label === 'Mastered') {
    return (
      <Ionicons
        testID="chapter-tab-badge-mastered"
        name="star"
        size={8}
        color="#d4a017"
      />
    );
  }

  if (label === 'Story Cleared') {
    if (summary.maxMasteryStars === 0) {
      // Narrative chapter — simple checkmark, nothing more to show.
      return (
        <Ionicons
          testID="chapter-tab-badge-cleared"
          name="checkmark-circle"
          size={8}
          color={accentColor}
        />
      );
    }

    // Mastery exists but is incomplete — show progress fraction.
    return (
      <Text testID="chapter-tab-badge-partial" style={badgeTextStyle}>
        {summary.masteryStars}/{summary.maxMasteryStars}★
      </Text>
    );
  }

  // 'In Progress' — nothing to show on the tab.
  return null;
}
