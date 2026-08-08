/**
 * tests/gate_evaluation.test.ts
 *
 * Unit tests for the gate evaluators in gateEvaluation.ts.
 * Verifies that:
 *   • evaluateChapterGate — correct codes/messages from chapter data
 *   • evaluateShiftGate   — delegates to isShiftAvailable / SHIFT_UNLOCK_CHAPTER
 *   • evaluateBossKeyGate — delegates to isChapterBossGateOpen / describeKeyProgress
 *   • evaluateNodeGate    — composes chapter + optional boss-key gate
 *   • No message is hardcoded by chapter number; messages are derived from data
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateChapterGate,
  evaluateShiftGate,
  evaluateBossKeyGate,
  evaluateNodeGate,
} from '../src/features/journey/ui/gateEvaluation';

import { CHAPTERS } from '../src/game/chapterJourney';
import {
  createChapterBossKeyState,
  claimAreaBossKey,
  CHAPTER_BOSS_KEY_REQUIREMENT,
} from '../src/game/journeyMap/chapterBossKeys';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ch1 = CHAPTERS.find((c) => c.number === 1)!;
const ch2 = CHAPTERS.find((c) => c.number === 2)!;
const ch6 = CHAPTERS.find((c) => c.number === 6)!;
const ch10 = CHAPTERS.find((c) => c.number === 10)!;

// ── evaluateChapterGate ───────────────────────────────────────────────────────

describe('evaluateChapterGate', () => {
  it('is unlocked for Chapter 1 at any level', () => {
    const result = evaluateChapterGate(ch1, 1, []);
    expect(result.unlocked).toBe(true);
    expect(result.unmetRequirements).toHaveLength(0);
  });

  it('is locked by level_gate when playerLevel < chapter.levelGate', () => {
    // Chapter 2 requires level > 1
    const result = evaluateChapterGate(ch2, 1, []);
    const levelReq = result.unmetRequirements.find((r) => r.code === 'level_gate');
    expect(levelReq).toBeDefined();
    // Message references the actual gate level, not a hardcoded number
    expect(levelReq!.message).toContain(`Level ${ch2.levelGate}`);
    expect(levelReq!.message).toContain(`Chapter ${ch2.number}`);
  });

  it('is locked by previous_chapter when required nodes not claimed', () => {
    // Chapter 2 needs ch1's requiredCompletionNodes
    const highLevel = 99; // bypass level gate
    const result = evaluateChapterGate(ch2, highLevel, []);
    const prevReq = result.unmetRequirements.find((r) => r.code === 'previous_chapter');
    if (ch1.requiredCompletionNodes?.length) {
      expect(prevReq).toBeDefined();
      expect(prevReq!.message).toContain(`Chapter ${ch1.number}`);
    }
  });

  it('clears previous_chapter once all required nodes are claimed', () => {
    const highLevel = 99;
    const required  = ch1.requiredCompletionNodes ?? [];
    const result    = evaluateChapterGate(ch2, highLevel, required);
    const prevReq   = result.unmetRequirements.find((r) => r.code === 'previous_chapter');
    expect(prevReq).toBeUndefined();
  });

  it('reports both level_gate and previous_chapter when both unmet', () => {
    // Player level 1, ch2 level gate > 1, and no prior nodes claimed
    const result = evaluateChapterGate(ch2, 1, []);
    const codes  = result.unmetRequirements.map((r) => r.code);
    expect(codes).toContain('level_gate');
    if (ch1.requiredCompletionNodes?.length) {
      expect(codes).toContain('previous_chapter');
    }
    expect(result.unlocked).toBe(false);
  });

  it('is unlocked when all gates pass', () => {
    const highLevel = 99;
    const required  = ch1.requiredCompletionNodes ?? [];
    const result    = evaluateChapterGate(ch2, highLevel, required);
    expect(result.unlocked).toBe(true);
    expect(result.unmetRequirements).toHaveLength(0);
  });

  it('message level number matches chapter.levelGate, not a constant', () => {
    // ch6 has a different levelGate than ch2 — message must reflect that
    const r2 = evaluateChapterGate(ch2,  1, []);
    const r6 = evaluateChapterGate(ch6,  1, []);
    const msg2 = r2.unmetRequirements.find((r) => r.code === 'level_gate')?.message ?? '';
    const msg6 = r6.unmetRequirements.find((r) => r.code === 'level_gate')?.message ?? '';
    expect(msg2).toContain(String(ch2.levelGate));
    expect(msg6).toContain(String(ch6.levelGate));
    if (ch2.levelGate !== ch6.levelGate) {
      expect(msg2).not.toBe(msg6);
    }
  });

  it('Chapter 1 has no previous_chapter gate (it is the first)', () => {
    const result = evaluateChapterGate(ch1, 1, []);
    expect(result.unmetRequirements.find((r) => r.code === 'previous_chapter')).toBeUndefined();
  });
});

// ── evaluateShiftGate ─────────────────────────────────────────────────────────

describe('evaluateShiftGate', () => {
  it('day shift is always unlocked', () => {
    for (const ch of [1, 3, 6, 10]) {
      const result = evaluateShiftGate('day', ch);
      expect(result.unlocked).toBe(true);
    }
  });

  it('evening shift is locked before Chapter 3', () => {
    const result = evaluateShiftGate('evening', 2);
    expect(result.unlocked).toBe(false);
    expect(result.unmetRequirements[0].code).toBe('evening_shift_locked');
    expect(result.unmetRequirements[0].message).toContain('Evening Shift');
    expect(result.unmetRequirements[0].message).toContain('Chapter 3');
  });

  it('evening shift is unlocked at Chapter 3', () => {
    expect(evaluateShiftGate('evening', 3).unlocked).toBe(true);
  });

  it('night shift is locked before Chapter 6', () => {
    const result = evaluateShiftGate('night', 5);
    expect(result.unlocked).toBe(false);
    expect(result.unmetRequirements[0].code).toBe('night_shift_locked');
    expect(result.unmetRequirements[0].message).toContain('Night Shift');
    expect(result.unmetRequirements[0].message).toContain('Chapter 6');
  });

  it('night shift is unlocked at Chapter 6', () => {
    expect(evaluateShiftGate('night', 6).unlocked).toBe(true);
  });

  it('night shift is unlocked beyond Chapter 6', () => {
    expect(evaluateShiftGate('night', 10).unlocked).toBe(true);
  });

  it('unlock chapter in message matches SHIFT_UNLOCK_CHAPTER, not hardcoded', () => {
    // Verify by checking both evening and night produce correct chapters
    const ev = evaluateShiftGate('evening', 1).unmetRequirements[0].message;
    const ni = evaluateShiftGate('night', 1).unmetRequirements[0].message;
    expect(ev).toContain('Chapter 3'); // SHIFT_UNLOCK_CHAPTER.evening = 3
    expect(ni).toContain('Chapter 6'); // SHIFT_UNLOCK_CHAPTER.night = 6
  });
});

// ── evaluateBossKeyGate ───────────────────────────────────────────────────────

describe('evaluateBossKeyGate', () => {
  const chapterId = 1; // chapterId is number (chapter number, 1-based)

  it('is locked with 0 keys', () => {
    const state = createChapterBossKeyState(chapterId);
    const result = evaluateBossKeyGate(state);
    expect(result.unlocked).toBe(false);
    expect(result.unmetRequirements[0].code).toBe('boss_keys_missing');
    expect(result.unmetRequirements[0].message).toContain(String(CHAPTER_BOSS_KEY_REQUIREMENT));
  });

  it('is locked with 2 keys (one short)', () => {
    let state = createChapterBossKeyState(chapterId);
    state = claimAreaBossKey(state, 'tile_1');
    state = claimAreaBossKey(state, 'tile_2');
    const result = evaluateBossKeyGate(state);
    expect(result.unlocked).toBe(false);
    // Progress reflected in message
    expect(result.unmetRequirements[0].message).toMatch(/2\s*\/\s*3|2\/3/);
  });

  it('is unlocked with all 3 keys', () => {
    let state = createChapterBossKeyState(chapterId);
    state = claimAreaBossKey(state, 'tile_1');
    state = claimAreaBossKey(state, 'tile_2');
    state = claimAreaBossKey(state, 'tile_3');
    expect(evaluateBossKeyGate(state).unlocked).toBe(true);
  });

  it('message contains current progress from describeKeyProgress', () => {
    let state = createChapterBossKeyState(chapterId);
    state = claimAreaBossKey(state, 'tile_1');
    const msg = evaluateBossKeyGate(state).unmetRequirements[0].message;
    // describeKeyProgress returns "1/3" — message must include it
    expect(msg).toMatch(/1\s*\/\s*3|1\/3/);
  });
});

// ── evaluateNodeGate ──────────────────────────────────────────────────────────

describe('evaluateNodeGate', () => {
  it('composes chapter gate only when no bossKeyState', () => {
    const result = evaluateNodeGate(ch2, 1, []);
    const codes  = result.unmetRequirements.map((r) => r.code);
    expect(codes).toContain('level_gate');
    expect(codes).not.toContain('boss_keys_missing');
  });

  it('adds boss_keys_missing when bossKeyState provided and gate not open', () => {
    const state  = createChapterBossKeyState(1);
    const result = evaluateNodeGate(ch1, 1, [], state);
    expect(result.unmetRequirements.find((r) => r.code === 'boss_keys_missing')).toBeDefined();
  });

  it('unlocked when chapter passes and boss gate open', () => {
    let state = createChapterBossKeyState(1);
    state = claimAreaBossKey(state, 'tile_1');
    state = claimAreaBossKey(state, 'tile_2');
    state = claimAreaBossKey(state, 'tile_3');
    const result = evaluateNodeGate(ch1, 1, [], state);
    expect(result.unlocked).toBe(true);
  });

  it('unlocked for ch1 at level 1 with no boss key state', () => {
    const result = evaluateNodeGate(ch1, 1, []);
    expect(result.unlocked).toBe(true);
  });

  it('returns empty unmetRequirements when fully unlocked', () => {
    const result = evaluateNodeGate(ch1, 1, []);
    expect(result.unmetRequirements).toHaveLength(0);
  });
});
