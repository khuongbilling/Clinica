/**
 * chapterShiftRules.ts — canonical Book I chapter → shift rule layer.
 *
 * This layer is SEPARATE from player-level shift availability
 * (bookOneUnlocks.ts availableShifts / isShiftAvailable): availability says
 * which shifts the PLAYER has unlocked; the ChapterShiftRule says which
 * shifts a CHAPTER offers and how a run's TimeOfDay is chosen when a
 * JourneyRun is created.  availableShifts() must never by itself determine
 * which routes a chapter offers.
 *
 * Book I rules:
 *   Ch 1-3  → fixed Day
 *   Ch 4    → choice: Day or Evening
 *   Ch 5-6  → inherit the canonical Chapter 4 shift
 *   Ch 7    → choice: Day, Evening, or Night
 *   Ch 8    → inherit the canonical Chapter 7 shift
 *   Ch 9    → choice: Day, Evening, or Night
 *   Ch 10   → multi-shift finale (all three offered)
 *
 * "Canonical shift" = the shift of the player's FIRST CLEAR of a choice
 * chapter, persisted on PlayerState.canonical_shifts (never mutated by
 * switching the visible Book-map shift tab).  Pre-clear rechallenge attempts
 * inherit the prior run's shift directly (see journeyRunLifecycle).
 *
 * Chapters beyond Book I (11+) default to full choice until Book II rules
 * are authored.
 */

import type { TimeOfDay } from './types';

export type ChapterShiftRule =
  | { kind: 'fixed';   shift: TimeOfDay }
  | { kind: 'choice';  options: readonly TimeOfDay[] }
  | { kind: 'inherit'; from: number }
  | { kind: 'finale';  options: readonly TimeOfDay[] };

const ALL_SHIFTS: readonly TimeOfDay[] = ['day', 'evening', 'night'];

export function getChapterShiftRule(chapter: number): ChapterShiftRule {
  if (chapter <= 3)   return { kind: 'fixed',   shift: 'day' };
  if (chapter === 4)  return { kind: 'choice',  options: ['day', 'evening'] };
  if (chapter <= 6)   return { kind: 'inherit', from: 4 };
  if (chapter === 7)  return { kind: 'choice',  options: ALL_SHIFTS };
  if (chapter === 8)  return { kind: 'inherit', from: 7 };
  if (chapter === 9)  return { kind: 'choice',  options: ALL_SHIFTS };
  if (chapter === 10) return { kind: 'finale',  options: ALL_SHIFTS };
  // Book II+ — full choice until authored.
  return { kind: 'choice', options: ALL_SHIFTS };
}

/** The shifts a chapter offers (for UI: which tabs/routes to show). */
export function chapterOfferedShifts(
  chapter: number,
  canonicalShiftFor: (chapter: number) => TimeOfDay | undefined,
): readonly TimeOfDay[] {
  const rule = getChapterShiftRule(chapter);
  switch (rule.kind) {
    case 'fixed':   return [rule.shift];
    case 'inherit': return [canonicalShiftFor(rule.from) ?? 'day'];
    case 'choice':
    case 'finale':  return rule.options;
  }
}

/**
 * Resolve the TimeOfDay for a NEW run of `chapter`.
 *
 *  - fixed   → the fixed shift.
 *  - inherit → the canonical shift of the source chapter (falls back to 'day'
 *              if the source chapter has no recorded canonical shift yet —
 *              possible only for out-of-order debug entry).
 *  - choice/finale → `requested` when it is one of the offered options,
 *              otherwise the first option ('day').
 */
export function resolveRunShift(
  chapter: number,
  canonicalShiftFor: (chapter: number) => TimeOfDay | undefined,
  requested?: TimeOfDay,
): TimeOfDay {
  const rule = getChapterShiftRule(chapter);
  switch (rule.kind) {
    case 'fixed':
      return rule.shift;
    case 'inherit':
      return canonicalShiftFor(rule.from) ?? 'day';
    case 'choice':
    case 'finale':
      return requested && rule.options.includes(requested)
        ? requested
        : rule.options[0];
  }
}

/** True when `chapter` is a choice chapter whose first clear sets a canonical shift. */
export function isCanonicalChoiceChapter(chapter: number): boolean {
  const rule = getChapterShiftRule(chapter);
  return rule.kind === 'choice' || rule.kind === 'finale';
}
