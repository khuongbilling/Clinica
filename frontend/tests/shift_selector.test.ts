/**
 * tests/shift_selector.test.ts
 *
 * Unit tests for ShiftAvailability logic and display rules.
 *
 * CRITICAL INVARIANTS UNDER TEST:
 *   1. Before a shift's teaser chapter, slot is completely hidden
 *      (unlocked=false, teaserVisible=false) — not CSS-hidden, absent.
 *   2. Teaser appears exactly at the right chapter, disappears on unlock.
 *   3. No hardcoded chapter numbers — values derived from SHIFT_UNLOCK_CHAPTER.
 */

import { describe, it, expect } from 'vitest';
import {
  getShiftAvailability,
  isShiftVisible,
} from '../src/features/journey/ui/shiftAvailability';
import { SHIFT_UNLOCK_CHAPTER } from '../src/game/journeyMap/bookOneUnlocks';

// Convenience aliases derived from the authoritative table — tests must not
// hardcode these numbers directly.
const EVE_UNLOCK  = SHIFT_UNLOCK_CHAPTER.evening; // 3
const NIGHT_UNLOCK = SHIFT_UNLOCK_CHAPTER.night;  // 6
const EVE_TEASER  = EVE_UNLOCK - 1;               // 2
const NIGHT_TEASER = EVE_UNLOCK;                  // 3 (after evening unlock)

// ── Day shift (always available) ──────────────────────────────────────────────

describe('day shift', () => {
  for (const ch of [1, 2, 3, 6, 10]) {
    it(`is unlocked at chapter ${ch}`, () => {
      const { day } = getShiftAvailability(ch);
      expect(day.unlocked).toBe(true);
      expect(day.teaserVisible).toBe(false);
    });
  }
});

// ── Evening shift ─────────────────────────────────────────────────────────────

describe('evening shift', () => {
  it('is completely hidden before the teaser chapter', () => {
    // Chapter 1 — below teaser threshold (EVE_TEASER = 2)
    const { evening } = getShiftAvailability(EVE_TEASER - 1);
    expect(evening.unlocked).toBe(false);
    expect(evening.teaserVisible).toBe(false);
    // CRITICAL: no node data should be sent to ShiftSelector
    expect(isShiftVisible(evening)).toBe(false);
  });

  it('shows teaser at the chapter before unlock', () => {
    const { evening } = getShiftAvailability(EVE_TEASER);
    expect(evening.unlocked).toBe(false);
    expect(evening.teaserVisible).toBe(true);
    expect(isShiftVisible(evening)).toBe(true);
  });

  it('is fully unlocked at EVE_UNLOCK chapter', () => {
    const { evening } = getShiftAvailability(EVE_UNLOCK);
    expect(evening.unlocked).toBe(true);
    expect(evening.teaserVisible).toBe(false);
    expect(isShiftVisible(evening)).toBe(true);
  });

  it('teaser disappears exactly at unlock — no overlap', () => {
    const before = getShiftAvailability(EVE_UNLOCK - 1).evening;
    const at     = getShiftAvailability(EVE_UNLOCK).evening;
    expect(before.teaserVisible).toBe(true);
    expect(before.unlocked).toBe(false);
    expect(at.unlocked).toBe(true);
    expect(at.teaserVisible).toBe(false);
  });

  it('remains unlocked at all chapters after EVE_UNLOCK', () => {
    for (const ch of [EVE_UNLOCK + 1, NIGHT_UNLOCK, NIGHT_UNLOCK + 2]) {
      const { evening } = getShiftAvailability(ch);
      expect(evening.unlocked).toBe(true);
    }
  });
});

// ── Night shift ───────────────────────────────────────────────────────────────

describe('night shift', () => {
  it('is completely hidden before evening unlocks', () => {
    // Chapters 1 and 2 — night teaser requires evening to be unlocked first
    for (const ch of [1, EVE_TEASER]) {
      const { night } = getShiftAvailability(ch);
      expect(night.unlocked).toBe(false);
      expect(night.teaserVisible).toBe(false);
      expect(isShiftVisible(night)).toBe(false);
    }
  });

  it('shows teaser once evening is unlocked but night is not', () => {
    // Chapters 3 through 5 (NIGHT_TEASER through NIGHT_UNLOCK - 1)
    for (let ch = NIGHT_TEASER; ch < NIGHT_UNLOCK; ch++) {
      const { night } = getShiftAvailability(ch);
      expect(night.unlocked).toBe(false);
      expect(night.teaserVisible).toBe(true, `ch ${ch} should show night teaser`);
      expect(isShiftVisible(night)).toBe(true);
    }
  });

  it('is fully unlocked at NIGHT_UNLOCK chapter', () => {
    const { night } = getShiftAvailability(NIGHT_UNLOCK);
    expect(night.unlocked).toBe(true);
    expect(night.teaserVisible).toBe(false);
    expect(isShiftVisible(night)).toBe(true);
  });

  it('teaser disappears exactly at night unlock — no overlap', () => {
    const before = getShiftAvailability(NIGHT_UNLOCK - 1).night;
    const at     = getShiftAvailability(NIGHT_UNLOCK).night;
    expect(before.teaserVisible).toBe(true);
    expect(before.unlocked).toBe(false);
    expect(at.unlocked).toBe(true);
    expect(at.teaserVisible).toBe(false);
  });

  it('remains unlocked beyond NIGHT_UNLOCK', () => {
    for (const ch of [NIGHT_UNLOCK + 1, 9, 10]) {
      const { night } = getShiftAvailability(ch);
      expect(night.unlocked).toBe(true);
    }
  });
});

// ── Full availability snapshots at canonical chapter numbers ─────────────────

describe('canonical chapter snapshots', () => {
  it('Ch1: Day only', () => {
    const a = getShiftAvailability(1);
    expect(a.day.unlocked).toBe(true);
    expect(isShiftVisible(a.evening)).toBe(false);
    expect(isShiftVisible(a.night)).toBe(false);
  });

  it('Ch2: Day + Evening teaser, Night hidden', () => {
    const a = getShiftAvailability(2);
    expect(a.day.unlocked).toBe(true);
    expect(a.evening.unlocked).toBe(false);
    expect(a.evening.teaserVisible).toBe(true);
    expect(isShiftVisible(a.night)).toBe(false);
  });

  it('Ch3: Day + Evening unlocked + Night teaser', () => {
    const a = getShiftAvailability(3);
    expect(a.day.unlocked).toBe(true);
    expect(a.evening.unlocked).toBe(true);
    expect(a.night.unlocked).toBe(false);
    expect(a.night.teaserVisible).toBe(true);
  });

  it('Ch4: Day + Evening + Night teaser (same as Ch3-5 pattern)', () => {
    const a = getShiftAvailability(4);
    expect(a.evening.unlocked).toBe(true);
    expect(a.night.teaserVisible).toBe(true);
  });

  it('Ch6: Day + Evening + Night all unlocked', () => {
    const a = getShiftAvailability(6);
    expect(a.day.unlocked).toBe(true);
    expect(a.evening.unlocked).toBe(true);
    expect(a.night.unlocked).toBe(true);
  });

  it('Ch10: All three unlocked', () => {
    const a = getShiftAvailability(10);
    expect(a.day.unlocked).toBe(true);
    expect(a.evening.unlocked).toBe(true);
    expect(a.night.unlocked).toBe(true);
  });
});

// ── isShiftVisible helper ────────────────────────────────────────────────────

describe('isShiftVisible', () => {
  it('true when unlocked', () => {
    expect(isShiftVisible({ unlocked: true,  teaserVisible: false })).toBe(true);
  });

  it('true when teaser', () => {
    expect(isShiftVisible({ unlocked: false, teaserVisible: true  })).toBe(true);
  });

  it('false when hidden', () => {
    expect(isShiftVisible({ unlocked: false, teaserVisible: false })).toBe(false);
  });

  // CRITICAL: unlocked slot never needs teaserVisible (invariant)
  it('still true even if both unlocked and teaserVisible are true (defensive)', () => {
    expect(isShiftVisible({ unlocked: true, teaserVisible: true })).toBe(true);
  });
});
