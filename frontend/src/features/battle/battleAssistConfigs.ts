/**
 * battleAssistConfigs.ts — Scenario-authored assist configurations.
 *
 * AUTHORING RULES:
 *   • afterConsecutiveFailures values must be positive integers.
 *   • mentorText must give a concrete observation or direction — not a generic
 *     "try harder" message.  Tell the player what to look at.
 *   • highlightActionId and highlightTargetId reference EXISTING identifiers
 *     in the battle action map and enemy registry.  The UI highlights them;
 *     it does not invent new UI elements.
 *   • freeBattleRetry: stamina is NOT refunded for map navigation already spent.
 *     Only the retry itself is free.
 */

import type { BattleAssistConfig } from './battleAssist';

// ── Chapter 1 ─────────────────────────────────────────────────────────────────

export const chapter1BattleAssist: BattleAssistConfig = {
  enabled: true,
  freeBattleRetry: true,

  rules: [
    {
      afterConsecutiveFailures: 1,
      mentorText:
        "The patient's stability is falling faster than the other threats. Look at what is acting next.",
    },
    {
      afterConsecutiveFailures: 2,
      mentorText:
        "Resolve the immediate threat before committing actions to the lower-risk problem.",
      highlightActionId: 'focused-assessment',
      highlightTargetId: 'acute-respiratory-threat',
    },
  ],
};

// ── Chapter 2 ─────────────────────────────────────────────────────────────────

export const chapter2BattleAssist: BattleAssistConfig = {
  enabled: true,
  freeBattleRetry: true,

  rules: [
    {
      afterConsecutiveFailures: 1,
      mentorText:
        "Check which threat is escalating fastest — the order you act in matters as much as what you do.",
    },
    {
      afterConsecutiveFailures: 2,
      mentorText:
        "Use your stabilisation skills on the highest-priority threat first. The secondary issue can wait one turn.",
    },
  ],
};

// ── Chapter 3 ─────────────────────────────────────────────────────────────────

export const chapter3BattleAssist: BattleAssistConfig = {
  enabled: true,
  freeBattleRetry: false, // Chapter 3 introduces resource cost for retries

  rules: [
    {
      afterConsecutiveFailures: 1,
      mentorText:
        "Watch for the corruption spreading between problems — stopping the spread is more efficient than treating each independently.",
    },
    {
      afterConsecutiveFailures: 2,
      mentorText:
        "Block the next spread first. You'll spend fewer total actions if you interrupt the chain early.",
    },
  ],
};

// ── Lookup ────────────────────────────────────────────────────────────────────

/** All authored configs keyed by chapter number (1-based). */
const CHAPTER_ASSIST_CONFIGS: Record<number, BattleAssistConfig> = {
  1: chapter1BattleAssist,
  2: chapter2BattleAssist,
  3: chapter3BattleAssist,
};

/**
 * Returns the assist config for a chapter battle.
 *
 * @param journeyChapterId  The chapter number string from route params
 *                          (e.g. "1", "2").  Returns undefined when the
 *                          battle is not a chapter encounter (training,
 *                          prologue, world boss) or no config has been
 *                          authored for that chapter.
 */
export function getAssistConfigForEncounter(
  journeyChapterId: string | undefined,
): BattleAssistConfig | undefined {
  if (!journeyChapterId) return undefined;
  const num = parseInt(journeyChapterId, 10);
  if (isNaN(num)) return undefined;
  return CHAPTER_ASSIST_CONFIGS[num];
}
