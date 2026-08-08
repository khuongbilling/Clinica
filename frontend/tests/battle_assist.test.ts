/**
 * tests/battle_assist.test.ts
 *
 * Tests for the battle assist pure functions and authored configs.
 *
 * KEY INVARIANTS:
 *   • getBattleAssistRule returns null at 0 failures — no hint before first loss
 *   • The HIGHEST threshold below consecutiveFailures wins (most specific hint)
 *   • recordEncounterFailure increments; recordEncounterVictory resets to 0
 *   • Disabled config always returns null
 *   • getAssistConfigForEncounter returns undefined for non-chapter battles
 */

import { describe, it, expect } from 'vitest';
import {
  getBattleAssistRule,
  recordEncounterFailure,
  recordEncounterVictory,
  type BattleAssistConfig,
  type EncounterAttemptState,
} from '../src/features/battle/battleAssist';
import {
  chapter1BattleAssist,
  chapter2BattleAssist,
  chapter3BattleAssist,
  getAssistConfigForEncounter,
} from '../src/features/battle/battleAssistConfigs';

// ── getBattleAssistRule ───────────────────────────────────────────────────────

describe('getBattleAssistRule', () => {
  const config: BattleAssistConfig = {
    enabled: true,
    freeBattleRetry: true,
    rules: [
      { afterConsecutiveFailures: 1, mentorText: 'Gentle hint.' },
      { afterConsecutiveFailures: 2, mentorText: 'Tactical hint.', highlightActionId: 'act-1' },
      { afterConsecutiveFailures: 4, mentorText: 'Full mentor.', highlightActionId: 'act-2', highlightTargetId: 'tgt-1' },
    ],
  };

  it('returns null at 0 failures', () => {
    expect(getBattleAssistRule(config, 0)).toBeNull();
  });

  it('returns null for undefined config', () => {
    expect(getBattleAssistRule(undefined, 3)).toBeNull();
  });

  it('returns null when config.enabled is false', () => {
    expect(getBattleAssistRule({ ...config, enabled: false }, 5)).toBeNull();
  });

  it('returns null when no threshold reached', () => {
    // 0 failures, threshold 1 — should not fire
    expect(getBattleAssistRule(config, 0)).toBeNull();
  });

  it('activates the rule at exactly its threshold', () => {
    const rule = getBattleAssistRule(config, 1);
    expect(rule).not.toBeNull();
    expect(rule!.mentorText).toBe('Gentle hint.');
  });

  it('returns MOST SPECIFIC rule (highest threshold ≤ failures)', () => {
    // At 2 failures: thresholds 1 and 2 are eligible; 2 wins
    const rule = getBattleAssistRule(config, 2);
    expect(rule!.mentorText).toBe('Tactical hint.');
    expect(rule!.highlightActionId).toBe('act-1');
  });

  it('returns MOST SPECIFIC rule at 3 failures (threshold 2, not 1)', () => {
    const rule = getBattleAssistRule(config, 3);
    expect(rule!.mentorText).toBe('Tactical hint.');
  });

  it('escalates to full mentor at 4 failures', () => {
    const rule = getBattleAssistRule(config, 4);
    expect(rule!.mentorText).toBe('Full mentor.');
    expect(rule!.highlightActionId).toBe('act-2');
    expect(rule!.highlightTargetId).toBe('tgt-1');
  });

  it('stays at full mentor beyond 4 failures', () => {
    const rule = getBattleAssistRule(config, 99);
    expect(rule!.mentorText).toBe('Full mentor.');
  });

  it('returns null when rules array is empty', () => {
    expect(getBattleAssistRule({ ...config, rules: [] }, 5)).toBeNull();
  });

  it('handles single-rule config correctly', () => {
    const single: BattleAssistConfig = {
      enabled: true,
      freeBattleRetry: false,
      rules: [{ afterConsecutiveFailures: 2, mentorText: 'Only hint.' }],
    };
    expect(getBattleAssistRule(single, 1)).toBeNull();
    expect(getBattleAssistRule(single, 2)!.mentorText).toBe('Only hint.');
    expect(getBattleAssistRule(single, 10)!.mentorText).toBe('Only hint.');
  });
});

// ── recordEncounterFailure ────────────────────────────────────────────────────

describe('recordEncounterFailure', () => {
  it('increments consecutiveFailures by 1', () => {
    const s: EncounterAttemptState = { consecutiveFailures: 0 };
    expect(recordEncounterFailure(s).consecutiveFailures).toBe(1);
  });

  it('does not mutate the input state', () => {
    const s: EncounterAttemptState = { consecutiveFailures: 2 };
    const next = recordEncounterFailure(s);
    expect(s.consecutiveFailures).toBe(2); // unchanged
    expect(next.consecutiveFailures).toBe(3);
  });

  it('accumulates across multiple calls', () => {
    let s: EncounterAttemptState = { consecutiveFailures: 0 };
    s = recordEncounterFailure(s);
    s = recordEncounterFailure(s);
    s = recordEncounterFailure(s);
    expect(s.consecutiveFailures).toBe(3);
  });
});

// ── recordEncounterVictory ────────────────────────────────────────────────────

describe('recordEncounterVictory', () => {
  it('resets consecutiveFailures to 0', () => {
    const s: EncounterAttemptState = { consecutiveFailures: 5 };
    expect(recordEncounterVictory(s).consecutiveFailures).toBe(0);
  });

  it('is a no-op on an already-zero state', () => {
    const s: EncounterAttemptState = { consecutiveFailures: 0 };
    expect(recordEncounterVictory(s).consecutiveFailures).toBe(0);
  });

  it('does not mutate the input state', () => {
    const s: EncounterAttemptState = { consecutiveFailures: 3 };
    const next = recordEncounterVictory(s);
    expect(s.consecutiveFailures).toBe(3); // unchanged
    expect(next.consecutiveFailures).toBe(0);
  });
});

// ── failure → victory → failure cycle ────────────────────────────────────────

describe('failure/victory cycle', () => {
  it('win resets, subsequent failure starts fresh from 1', () => {
    let s: EncounterAttemptState = { consecutiveFailures: 0 };
    s = recordEncounterFailure(s); // 1
    s = recordEncounterFailure(s); // 2
    s = recordEncounterVictory(s); // 0
    expect(s.consecutiveFailures).toBe(0);
    s = recordEncounterFailure(s); // 1
    expect(s.consecutiveFailures).toBe(1);
  });

  it('hint fires again after a win resets the streak', () => {
    const config = chapter1BattleAssist;
    let s: EncounterAttemptState = { consecutiveFailures: 0 };
    s = recordEncounterFailure(s);
    s = recordEncounterFailure(s);
    // At 2 failures → second rule fires
    expect(getBattleAssistRule(config, s.consecutiveFailures)).not.toBeNull();
    s = recordEncounterVictory(s);
    // After win → no hint
    expect(getBattleAssistRule(config, s.consecutiveFailures)).toBeNull();
  });
});

// ── chapter1BattleAssist authored config ─────────────────────────────────────

describe('chapter1BattleAssist', () => {
  it('is enabled with free retry', () => {
    expect(chapter1BattleAssist.enabled).toBe(true);
    expect(chapter1BattleAssist.freeBattleRetry).toBe(true);
  });


  it('has no hint at 0 failures', () => {
    expect(getBattleAssistRule(chapter1BattleAssist, 0)).toBeNull();
  });

  it('gives an observation hint at 1 failure (no highlight yet)', () => {
    const rule = getBattleAssistRule(chapter1BattleAssist, 1)!;
    expect(rule).not.toBeNull();
    expect(rule.highlightActionId).toBeUndefined();
    expect(rule.highlightTargetId).toBeUndefined();
    expect(rule.mentorText.length).toBeGreaterThan(10);
  });

  it('adds action + target highlight at 2 failures', () => {
    const rule = getBattleAssistRule(chapter1BattleAssist, 2)!;
    expect(rule.highlightActionId).toBeTruthy();
    expect(rule.highlightTargetId).toBeTruthy();
  });

  it('stays on 2-failure rule beyond 2 failures (only 2 rules authored)', () => {
    const at2 = getBattleAssistRule(chapter1BattleAssist, 2);
    const at5 = getBattleAssistRule(chapter1BattleAssist, 5);
    expect(at2!.mentorText).toBe(at5!.mentorText);
  });
});

// ── Canonical stamina invariant across all authored configs ───────────────────

describe('stamina rule invariant', () => {
  // CANONICAL: tile-entry costs 1 stamina (spent on map movement, gone).
  // Battle retry costs 0 additional stamina — always.
  // freeBattleRetry:false would charge stamina twice → forbidden.
  const allAuthoredConfigs = [
    { name: 'chapter1BattleAssist', config: chapter1BattleAssist },
    { name: 'chapter2BattleAssist', config: chapter2BattleAssist },
    { name: 'chapter3BattleAssist', config: chapter3BattleAssist },
  ];

  for (const { name, config } of allAuthoredConfigs) {
    it(`${name}: freeBattleRetry is true (retry never costs additional stamina)`, () => {
      expect(config.freeBattleRetry).toBe(true);
    });
  }

  it('getAssistConfigForEncounter never returns a config with freeBattleRetry:false', () => {
    for (const ch of ['1', '2', '3', '4', '5', '6']) {
      const cfg = getAssistConfigForEncounter(ch);
      if (cfg) {
        expect(cfg.freeBattleRetry).toBe(true);
      }
    }
  });
});

// ── getAssistConfigForEncounter ───────────────────────────────────────────────

describe('getAssistConfigForEncounter', () => {
  it('returns undefined for undefined journeyChapterId', () => {
    expect(getAssistConfigForEncounter(undefined)).toBeUndefined();
  });

  it('returns undefined for non-numeric id (training / prologue / world boss)', () => {
    expect(getAssistConfigForEncounter('prologue')).toBeUndefined();
    expect(getAssistConfigForEncounter('')).toBeUndefined();
  });

  it('returns chapter1BattleAssist for "1"', () => {
    expect(getAssistConfigForEncounter('1')).toBe(chapter1BattleAssist);
  });

  it('returns undefined for an unauthored chapter number', () => {
    // Chapter 10 has no config yet
    expect(getAssistConfigForEncounter('10')).toBeUndefined();
  });

  it('returns a config for all authored chapters', () => {
    for (const ch of ['1', '2', '3']) {
      expect(getAssistConfigForEncounter(ch)).toBeDefined();
    }
  });
});
