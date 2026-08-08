/**
 * shiftAvailability.ts — teaser and unlock visibility rules for shift tabs.
 *
 * KEY RULE (from spec):
 *   Before a shift is unlocked, don't render its actual nodes and then hide
 *   them via CSS.  Don't send node details to ShiftSelector at all.
 *   ShiftSelector receives only ShiftAvailability booleans.
 *
 * Teaser ladder (per spec):
 *   Ch 1   — Evening hidden, Night hidden
 *   Ch 2   — Evening TEASER, Night hidden
 *   Ch 3+  — Evening UNLOCKED, Night TEASER
 *   Ch 6+  — Evening UNLOCKED, Night UNLOCKED
 */

import {
  isShiftAvailable,
  SHIFT_UNLOCK_CHAPTER,
} from '../../../game/journeyMap/bookOneUnlocks';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Display availability for the three shift tabs.
 *
 *  `unlocked`     — true → render a selectable tab.
 *  `teaserVisible`— true AND !unlocked → render a disabled teaser ("Revealed
 *                   through the story").  false AND !unlocked → hidden entirely.
 */
export interface ShiftSlot {
  unlocked:      boolean;
  teaserVisible: boolean;
}

export interface ShiftAvailability {
  day:     ShiftSlot;   // always unlocked
  evening: ShiftSlot;
  night:   ShiftSlot;
}

// ── Derived rules ─────────────────────────────────────────────────────────────

/**
 * Compute ShiftAvailability for a given chapter number.
 *
 * Evening teaser:  chapter >= 2 and evening not yet unlocked
 * Night teaser:    evening is unlocked (chapter >= 3) and night not yet unlocked
 *
 * Both rules derive from SHIFT_UNLOCK_CHAPTER — no hardcoded numbers.
 */
export function getShiftAvailability(chapterNumber: number): ShiftAvailability {
  const eveningUnlocked = isShiftAvailable('evening', chapterNumber);
  const nightUnlocked   = isShiftAvailable('night',   chapterNumber);

  return {
    day: {
      unlocked:      true,
      teaserVisible: false,
    },
    evening: {
      unlocked:      eveningUnlocked,
      // Teaser appears once the player reaches the chapter before the unlock.
      // SHIFT_UNLOCK_CHAPTER.evening is 3, so teaser is visible at chapter 2.
      teaserVisible: !eveningUnlocked && chapterNumber >= SHIFT_UNLOCK_CHAPTER.evening - 1,
    },
    night: {
      unlocked:      nightUnlocked,
      // Teaser appears once evening is unlocked (chapter >= 3).
      teaserVisible: !nightUnlocked && eveningUnlocked,
    },
  };
}

/**
 * True when the shift tab is visible in any form (unlocked OR teaser).
 * Useful for deciding whether to include a shift in the tab row at all.
 */
export function isShiftVisible(slot: ShiftSlot): boolean {
  return slot.unlocked || slot.teaserVisible;
}
