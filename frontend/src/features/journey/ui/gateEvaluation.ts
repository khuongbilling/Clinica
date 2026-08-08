/**
 * gateEvaluation.ts — Push D gate evaluators.
 *
 * Each evaluator calls the AUTHORITATIVE gating function and returns both
 * the boolean AND the human-readable reasons so the UI never has to decide
 * whether a requirement is met — it only displays what it receives.
 *
 * RULE: no hardcoded `if (chapterNumber === 6)` messages here.
 *   Messages are derived from the same data the gate reads, so they
 *   cannot drift away from the actual gating system.
 */

import { CHAPTERS }                 from '../../../game/chapterJourney';
import type { Chapter }             from '../../../game/chapterJourney';
import { isShiftAvailable, SHIFT_UNLOCK_CHAPTER } from '../../../game/journeyMap/bookOneUnlocks';
import {
  isChapterBossGateOpen,
  CHAPTER_BOSS_KEY_REQUIREMENT,
  describeKeyProgress,
}                                   from '../../../game/journeyMap/chapterBossKeys';
import type { ChapterBossKeyState } from '../../../game/journeyMap/chapterBossKeys';
import type { TimeOfDay }           from '../../../game/journeyMap/types';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface GateRequirement {
  code: string;
  message: string;
}

/**
 * Result of evaluating a single gate.
 *
 * `unlocked`          — true when every requirement is satisfied.
 * `unmetRequirements` — ordered list of reasons why the gate is closed.
 *                       Empty when unlocked.
 *
 * The UI is deliberately simple: it receives this object and renders
 * unmetRequirements.map(r => r.message).  No UI-side logic.
 */
export interface GateEvaluation {
  unlocked: boolean;
  unmetRequirements: GateRequirement[];
}

// ── Evaluators ────────────────────────────────────────────────────────────────

/**
 * Evaluates why a chapter is locked for a given player.
 *
 * Gates checked (same order as getChapterStatus):
 *   1. level_gate          — playerLevel < chapter.levelGate
 *   2. previous_chapter    — previous chapter's requiredCompletionNodes not all claimed
 *
 * Messages are derived from the chapter data, not hardcoded per chapter number.
 */
export function evaluateChapterGate(
  chapter: Chapter,
  playerLevel: number,
  claimedNodeIds: readonly string[],
): GateEvaluation {
  const unmet: GateRequirement[] = [];

  // 1. Level gate
  if (playerLevel < chapter.levelGate) {
    unmet.push({
      code:    'level_gate',
      message: `Reach Level ${chapter.levelGate} to unlock Chapter ${chapter.number}.`,
    });
  }

  // 2. Completion gate — previous chapter's required nodes
  const idx = CHAPTERS.findIndex((c) => c.id === chapter.id);
  if (idx > 0) {
    const prev     = CHAPTERS[idx - 1];
    const required = prev.requiredCompletionNodes ?? [];
    if (required.length > 0) {
      const claimedSet = new Set(claimedNodeIds);
      const allDone    = required.every((id) => claimedSet.has(id));
      if (!allDone) {
        unmet.push({
          code:    'previous_chapter',
          message: `Complete Chapter ${prev.number} to continue.`,
        });
      }
    }
  }

  return { unlocked: unmet.length === 0, unmetRequirements: unmet };
}

/**
 * Evaluates whether a shift is available for run creation at the given chapter.
 *
 * Delegates to isShiftAvailable — the unlock chapter comes from
 * SHIFT_UNLOCK_CHAPTER, the same table the gate itself reads.
 */
export function evaluateShiftGate(
  shift: TimeOfDay,
  chapterNumber: number,
): GateEvaluation {
  if (isShiftAvailable(shift, chapterNumber)) {
    return { unlocked: true, unmetRequirements: [] };
  }

  const unlockAt = SHIFT_UNLOCK_CHAPTER[shift];
  const label    = shift === 'night' ? 'Night Shift' : 'Evening Shift';

  return {
    unlocked: false,
    unmetRequirements: [
      {
        code:    `${shift}_shift_locked`,
        message: `${label} unlocks after completing Chapter ${unlockAt}.`,
      },
    ],
  };
}

/**
 * Evaluates whether the Chapter Boss gate is open.
 *
 * Delegates to isChapterBossGateOpen.  Progress text comes from
 * describeKeyProgress — the same source the HUD uses — so it stays in sync.
 */
export function evaluateBossKeyGate(state: ChapterBossKeyState): GateEvaluation {
  if (isChapterBossGateOpen(state)) {
    return { unlocked: true, unmetRequirements: [] };
  }

  const progress = describeKeyProgress(state);

  return {
    unlocked: false,
    unmetRequirements: [
      {
        code:    'boss_keys_missing',
        message: `Collect ${CHAPTER_BOSS_KEY_REQUIREMENT} Chapter Boss Keys. Current progress: ${progress}.`,
      },
    ],
  };
}

/**
 * Convenience: evaluates all applicable gates for a chapter node and returns
 * the combined GateEvaluation.  Useful when building JourneyNodeUi.lockReasons.
 *
 * Boss key gate is only checked when a ChapterBossKeyState is supplied.
 */
export function evaluateNodeGate(
  chapter: Chapter,
  playerLevel: number,
  claimedNodeIds: readonly string[],
  bossKeyState?: ChapterBossKeyState,
): GateEvaluation {
  const unmet: GateRequirement[] = [];

  const chapterEval = evaluateChapterGate(chapter, playerLevel, claimedNodeIds);
  unmet.push(...chapterEval.unmetRequirements);

  if (bossKeyState) {
    const bossEval = evaluateBossKeyGate(bossKeyState);
    unmet.push(...bossEval.unmetRequirements);
  }

  return { unlocked: unmet.length === 0, unmetRequirements: unmet };
}
