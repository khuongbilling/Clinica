/**
 * journeyMap/bookOneUnlocks.ts — Push 14: Book I Journey + Combat unlock cadence.
 *
 * CANONICAL UNLOCK TABLE — Book I (Chapters 1–10)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Ch 1  — Stability, Corruption (baseline; always active)
 *  Ch 2  — Multi-threat introduction, Support Ally / Call Team tutorial
 *  Ch 3  — Intent visibility, Protocol Cards, Evening Shift
 *  Ch 4  — Area Bosses, Chapter Boss Keys, Chapter Boss Gate, Shift Divergence
 *  Ch 5  — Merchant, Ward Blessings, Supplies interactions
 *  Ch 6  — Night Shift, Ward Hazards, Silent Risk, Expanded map (35-tile)
 *  Ch 7  — Full 2–3 threat battle composition
 *  Ch 8  — Persistent Handoff Debt / consequence mechanics
 *  Ch 9  — Advanced shift-pressure combinations
 *  Ch 10 — Three Watches examination, Challenge Chapter, Clinical Reflection
 *
 * USAGE RULES
 * ─────────────────────────────────────────────────────────────────────────────
 *  • isSystemUnlocked(system, chapter) is the primary runtime gate.
 *    Use it to decide whether a system is active for a given run.
 *  • isShiftAvailable(shift, chapter) gates shift selection at run-creation time.
 *    Day is always available.  Evening unlocks at Ch 3.  Night at Ch 6.
 *  • availableShifts(chapter) returns the ordered list for a shift-selector UI.
 *  • getChapterUnlocks(chapter) returns systems newly introduced at that chapter.
 *  • getCumulativeUnlocks(chapter) returns all systems active up through chapter.
 *  • isBookIComplete(chapter) is true when all 24 Book I systems are available.
 *
 * LOCKED-SYSTEM PREVIEWS
 * ─────────────────────────────────────────────────────────────────────────────
 *  "Keep locked systems visible only where product design already calls for
 *  previews." — previews are a UI/product concern, not a domain concern.
 *  This module does NOT enforce UI visibility; callers decide presentation.
 *
 * RELATIONSHIP TO FEATURE FLAGS
 * ─────────────────────────────────────────────────────────────────────────────
 *  Feature flags (MULTI_THREAT_COMBAT_V1, WARD_EVENTS_V1) are DEPLOYMENT gates
 *  that can hold a system back even when its chapter is reached.
 *  The unlock table here governs the IN-GAME progressive cadence.
 *  Both gates must be satisfied for a system to be active at runtime:
 *    featureFlag === true  AND  isSystemUnlocked(system, chapter) === true.
 *
 * CROSS-VALIDATION
 * ─────────────────────────────────────────────────────────────────────────────
 *  validateBookIConsistency() cross-checks this table against derived rules
 *  in existing domain modules.  Call it in tests to catch future drift.
 *
 * This module is pure domain logic — no React, no I/O, no mutable state.
 */

import type { TimeOfDay } from './types';
import { TIME_OF_DAY_VALUES } from './canonicalConfig';
import { areaBossEnabled }    from './chapterBossKeys';
import { merchantMaxCount }   from './config';

// ── BookISystem union ─────────────────────────────────────────────────────────

/**
 * Every distinct system or mechanic introduced during Book I (Chapters 1–10).
 * The string literals are stable identifiers — never change them; add new
 * values with a new Book prefix for later chapters.
 */
export type BookISystem =
  // Chapter 1 — baseline
  | 'stability'
  | 'corruption'
  // Chapter 2 — multi-threat introduction
  | 'multi_threat_introduction'
  | 'call_team'
  // Chapter 3 — intent layer + evening shift
  | 'intent_visibility'
  | 'protocol_cards'
  | 'evening_shift'
  // Chapter 4 — boss key loop
  | 'area_boss'
  | 'chapter_boss_keys'
  | 'chapter_boss_gate'
  | 'shift_divergence'
  // Chapter 5 — off-ward economy
  | 'merchant'
  | 'ward_blessings'
  | 'supply_interactions'
  // Chapter 6 — night shift + hazards + map expansion
  | 'night_shift'
  | 'ward_hazards'
  | 'silent_risk'
  | 'expanded_map'
  // Chapter 7 — full threat composition
  | 'full_threat_composition'
  // Chapter 8 — persistent consequence
  | 'handoff_debt'
  // Chapter 9 — pressure mastery
  | 'advanced_pressure'
  // Chapter 10 — examination + endgame
  | 'three_watches_exam'
  | 'challenge_chapter'
  | 'clinical_reflection';

/** Ordered array of every Book I system value. */
export const BOOK_I_SYSTEMS: readonly BookISystem[] = [
  'stability',
  'corruption',
  'multi_threat_introduction',
  'call_team',
  'intent_visibility',
  'protocol_cards',
  'evening_shift',
  'area_boss',
  'chapter_boss_keys',
  'chapter_boss_gate',
  'shift_divergence',
  'merchant',
  'ward_blessings',
  'supply_interactions',
  'night_shift',
  'ward_hazards',
  'silent_risk',
  'expanded_map',
  'full_threat_composition',
  'handoff_debt',
  'advanced_pressure',
  'three_watches_exam',
  'challenge_chapter',
  'clinical_reflection',
] as const;

// ── Unlock table ──────────────────────────────────────────────────────────────

/**
 * Canonical unlock chapter for every Book I system.
 * A system is available when chapter >= BOOK_I_UNLOCK_CHAPTER[system].
 */
export const BOOK_I_UNLOCK_CHAPTER: Record<BookISystem, number> = {
  // Ch 1 — baseline
  stability:                1,
  corruption:               1,
  // Ch 2 — multi-threat
  multi_threat_introduction: 2,
  call_team:                 2,
  // Ch 3 — intent + cards + evening
  intent_visibility:         3,
  protocol_cards:            3,
  evening_shift:             3,
  // Ch 4 — area boss loop
  area_boss:                 4,
  chapter_boss_keys:         4,
  chapter_boss_gate:         4,
  shift_divergence:          4,
  // Ch 5 — economy
  merchant:                  5,
  ward_blessings:            5,
  supply_interactions:       5,
  // Ch 6 — night + hazards + map
  night_shift:               6,
  ward_hazards:              6,
  silent_risk:               6,
  expanded_map:              6,
  // Ch 7 — threat composition
  full_threat_composition:   7,
  // Ch 8 — consequence
  handoff_debt:              8,
  // Ch 9 — pressure mastery
  advanced_pressure:         9,
  // Ch 10 — exam + challenge + reflection
  three_watches_exam:        10,
  challenge_chapter:         10,
  clinical_reflection:       10,
};

/** The final chapter of Book I. */
export const BOOK_I_FINAL_CHAPTER = 10;

// ── Core query functions ──────────────────────────────────────────────────────

/**
 * True when the system is available at the given chapter.
 * A system is available when chapter >= its unlock chapter.
 *
 * @param system  Any BookISystem.
 * @param chapter Current chapter number (1-based).
 */
export function isSystemUnlocked(system: BookISystem, chapter: number): boolean {
  return chapter >= BOOK_I_UNLOCK_CHAPTER[system];
}

/**
 * Chapter at which a system first becomes available.
 */
export function getSystemUnlockChapter(system: BookISystem): number {
  return BOOK_I_UNLOCK_CHAPTER[system];
}

/**
 * All Book I systems newly introduced at exactly `chapter`.
 * Returns empty array when no new systems unlock at that chapter.
 */
export function getChapterUnlocks(chapter: number): readonly BookISystem[] {
  return BOOK_I_SYSTEMS.filter(s => BOOK_I_UNLOCK_CHAPTER[s] === chapter);
}

/**
 * All Book I systems available up through (and including) `chapter`.
 * Ordered by unlock chapter ascending, then by BOOK_I_SYSTEMS order within a chapter.
 */
export function getCumulativeUnlocks(chapter: number): readonly BookISystem[] {
  return BOOK_I_SYSTEMS.filter(s => BOOK_I_UNLOCK_CHAPTER[s] <= chapter);
}

/**
 * All Book I systems that are NOT yet available at `chapter`.
 * Ordered by unlock chapter ascending.
 */
export function getLockedSystems(chapter: number): readonly BookISystem[] {
  return BOOK_I_SYSTEMS.filter(s => BOOK_I_UNLOCK_CHAPTER[s] > chapter);
}

/**
 * True when all 24 Book I systems are available (chapter ≥ 10).
 */
export function isBookIComplete(chapter: number): boolean {
  return chapter >= BOOK_I_FINAL_CHAPTER;
}

/**
 * Returns a Map<unlockChapter, BookISystem[]> for all 10 Book I chapters.
 * Useful for generating chapter-summary UIs.
 */
export function getSystemsByChapter(): ReadonlyMap<number, readonly BookISystem[]> {
  const map = new Map<number, BookISystem[]>();
  for (const system of BOOK_I_SYSTEMS) {
    const ch = BOOK_I_UNLOCK_CHAPTER[system];
    if (!map.has(ch)) map.set(ch, []);
    map.get(ch)!.push(system);
  }
  return map;
}

// ── Shift availability ────────────────────────────────────────────────────────

/**
 * Shift unlock chapters.
 *
 *   day     →  Ch 1  (always available)
 *   evening →  Ch 3  (introduced in Chapter 3)
 *   night   →  Ch 6  (introduced in Chapter 6)
 *
 * Matches BOOK_I_UNLOCK_CHAPTER['evening_shift'] and ['night_shift'].
 */
export const SHIFT_UNLOCK_CHAPTER: Record<TimeOfDay, number> = {
  day:     1,
  evening: BOOK_I_UNLOCK_CHAPTER['evening_shift'],
  night:   BOOK_I_UNLOCK_CHAPTER['night_shift'],
};

/**
 * True when `shift` is available for run creation at `chapter`.
 *
 *   day     — always true
 *   evening — chapter >= 3
 *   night   — chapter >= 6
 */
export function isShiftAvailable(shift: TimeOfDay, chapter: number): boolean {
  return chapter >= SHIFT_UNLOCK_CHAPTER[shift];
}

/**
 * Ordered list of shifts available for run creation at `chapter`.
 * Always [day] at Ch 1–2; [day, evening] at Ch 3–5; [day, evening, night] at Ch 6+.
 * Order follows TIME_OF_DAY_VALUES: ['day', 'evening', 'night'].
 */
export function availableShifts(chapter: number): readonly TimeOfDay[] {
  return TIME_OF_DAY_VALUES.filter(s => isShiftAvailable(s, chapter));
}

// ── Chapter-size gate ─────────────────────────────────────────────────────────

/**
 * Minimum tile count introduced at a given chapter band, per the expanded-map
 * unlock at Chapter 6 (35 tiles) and future expansions.
 *
 *   Ch  1– 5  → 30 tiles   (standard)
 *   Ch  6–10  → 35 tiles   (expanded_map unlock)
 *   Ch 11–20  → 40 tiles   (future — beyond Book I)
 */
export function getBookIMapTileCount(chapter: number): number {
  if (chapter <= 5)  return 30;
  if (chapter <= 10) return 35;
  return 40; // beyond Book I, for completeness
}

// ── Named groupings ───────────────────────────────────────────────────────────

/**
 * The two systems that form the baseline combat loop — always active in Book I.
 */
export const BASELINE_SYSTEMS: readonly BookISystem[] = ['stability', 'corruption'];

/**
 * All three shift values present in Book I, in unlock order.
 */
export const BOOK_I_SHIFTS: readonly TimeOfDay[] = ['day', 'evening', 'night'];

/**
 * Systems that constitute the "boss key loop" introduced in Chapter 4.
 */
export const BOSS_KEY_LOOP_SYSTEMS: readonly BookISystem[] = [
  'area_boss',
  'chapter_boss_keys',
  'chapter_boss_gate',
];

/**
 * Shift-pressure systems, each tied to a specific shift:
 *   shift_divergence   — Ch 4 (first divergence: day vs evening effects differ)
 *   silent_risk        — Ch 6 (night-shift pressure mechanic)
 *   handoff_debt       — Ch 8 (cross-shift consequence mechanic)
 *   advanced_pressure  — Ch 9 (combined pressure mastery)
 */
export const PRESSURE_SYSTEMS: readonly BookISystem[] = [
  'shift_divergence',
  'silent_risk',
  'handoff_debt',
  'advanced_pressure',
];

/**
 * Chapter 10 examination systems — all three unlock together.
 */
export const CHAPTER_10_SYSTEMS: readonly BookISystem[] = [
  'three_watches_exam',
  'challenge_chapter',
  'clinical_reflection',
];

// ── Validation ────────────────────────────────────────────────────────────────

export interface BookIConsistencyError {
  readonly system:   BookISystem;
  readonly expected: string;
  readonly actual:   string;
}

/**
 * Cross-validate the Book I unlock table against derived rules in other domain
 * modules.  Returns an array of errors; empty means consistent.
 *
 * Checks:
 *  1. area_boss unlocks at the same chapter areaBossEnabled() first returns true.
 *  2. merchant unlocks at the same chapter merchantMaxCount() first returns > 0.
 *  3. evening_shift unlock matches SHIFT_UNLOCK_CHAPTER['evening'].
 *  4. night_shift unlock matches SHIFT_UNLOCK_CHAPTER['night'].
 *  5. expanded_map unlock chapter matches getBookIMapTileCount transition (30→35).
 *  6. All unlock chapters are integers in [1, BOOK_I_FINAL_CHAPTER].
 *  7. BOOK_I_SYSTEMS length == 24 (exhaustiveness guard).
 *  8. SHIFT_UNLOCK_CHAPTER entries match the corresponding BookISystem unlock chapters.
 *  9. getChapterUnlocks(ch) for ch 1–10 covers all 24 systems exactly once.
 * 10. getCumulativeUnlocks(BOOK_I_FINAL_CHAPTER) == all 24 systems.
 */
export function validateBookIConsistency(): readonly BookIConsistencyError[] {
  const errors: BookIConsistencyError[] = [];

  function fail(system: BookISystem, expected: string, actual: string): void {
    errors.push({ system, expected, actual });
  }

  // 1. area_boss — areaBossEnabled() first returns true at the declared chapter
  const areaBossChapter = BOOK_I_UNLOCK_CHAPTER['area_boss'];
  if (!areaBossEnabled(areaBossChapter)) {
    fail('area_boss',
      `areaBossEnabled(${areaBossChapter}) === true`,
      `areaBossEnabled(${areaBossChapter}) === false`);
  }
  if (areaBossEnabled(areaBossChapter - 1)) {
    fail('area_boss',
      `areaBossEnabled(${areaBossChapter - 1}) === false`,
      `areaBossEnabled(${areaBossChapter - 1}) === true`);
  }

  // 2. merchant — merchantMaxCount() first returns > 0 at the declared chapter
  const merchantChapter = BOOK_I_UNLOCK_CHAPTER['merchant'];
  if (merchantMaxCount(merchantChapter) <= 0) {
    fail('merchant',
      `merchantMaxCount(${merchantChapter}) > 0`,
      `merchantMaxCount(${merchantChapter}) === ${merchantMaxCount(merchantChapter)}`);
  }
  if (merchantMaxCount(merchantChapter - 1) > 0) {
    fail('merchant',
      `merchantMaxCount(${merchantChapter - 1}) === 0`,
      `merchantMaxCount(${merchantChapter - 1}) === ${merchantMaxCount(merchantChapter - 1)}`);
  }

  // 3. evening_shift matches SHIFT_UNLOCK_CHAPTER['evening']
  if (BOOK_I_UNLOCK_CHAPTER['evening_shift'] !== SHIFT_UNLOCK_CHAPTER['evening']) {
    fail('evening_shift',
      `SHIFT_UNLOCK_CHAPTER.evening === ${BOOK_I_UNLOCK_CHAPTER['evening_shift']}`,
      `SHIFT_UNLOCK_CHAPTER.evening === ${SHIFT_UNLOCK_CHAPTER['evening']}`);
  }

  // 4. night_shift matches SHIFT_UNLOCK_CHAPTER['night']
  if (BOOK_I_UNLOCK_CHAPTER['night_shift'] !== SHIFT_UNLOCK_CHAPTER['night']) {
    fail('night_shift',
      `SHIFT_UNLOCK_CHAPTER.night === ${BOOK_I_UNLOCK_CHAPTER['night_shift']}`,
      `SHIFT_UNLOCK_CHAPTER.night === ${SHIFT_UNLOCK_CHAPTER['night']}`);
  }

  // 5. expanded_map: tile count transitions 30→35 at the declared chapter
  const expandedCh = BOOK_I_UNLOCK_CHAPTER['expanded_map'];
  if (getBookIMapTileCount(expandedCh) !== 35) {
    fail('expanded_map',
      `getBookIMapTileCount(${expandedCh}) === 35`,
      `getBookIMapTileCount(${expandedCh}) === ${getBookIMapTileCount(expandedCh)}`);
  }
  if (getBookIMapTileCount(expandedCh - 1) !== 30) {
    fail('expanded_map',
      `getBookIMapTileCount(${expandedCh - 1}) === 30`,
      `getBookIMapTileCount(${expandedCh - 1}) === ${getBookIMapTileCount(expandedCh - 1)}`);
  }

  // 6. All unlock chapters are integers in [1, BOOK_I_FINAL_CHAPTER]
  for (const system of BOOK_I_SYSTEMS) {
    const ch = BOOK_I_UNLOCK_CHAPTER[system];
    if (!Number.isInteger(ch) || ch < 1 || ch > BOOK_I_FINAL_CHAPTER) {
      fail(system,
        `unlock chapter in [1, ${BOOK_I_FINAL_CHAPTER}]`,
        `unlock chapter = ${ch}`);
    }
  }

  // 7. BOOK_I_SYSTEMS exhaustiveness — exactly 24 entries
  if (BOOK_I_SYSTEMS.length !== 24) {
    errors.push({
      system:   'stability' as BookISystem,  // placeholder for the array-level error
      expected: 'BOOK_I_SYSTEMS.length === 24',
      actual:   `BOOK_I_SYSTEMS.length === ${BOOK_I_SYSTEMS.length}`,
    });
  }

  // 8. SHIFT_UNLOCK_CHAPTER entries match corresponding BookISystem unlock chapters
  if (SHIFT_UNLOCK_CHAPTER['day'] !== BOOK_I_UNLOCK_CHAPTER['stability']) {
    fail('stability',
      `SHIFT_UNLOCK_CHAPTER.day === ${BOOK_I_UNLOCK_CHAPTER['stability']}`,
      `SHIFT_UNLOCK_CHAPTER.day === ${SHIFT_UNLOCK_CHAPTER['day']}`);
  }

  // 9. Union of all getChapterUnlocks(1..10) equals all 24 systems exactly once
  const allFromChapters = new Set<BookISystem>();
  let duplicates = 0;
  for (let ch = 1; ch <= BOOK_I_FINAL_CHAPTER; ch++) {
    for (const s of getChapterUnlocks(ch)) {
      if (allFromChapters.has(s)) duplicates++;
      allFromChapters.add(s);
    }
  }
  if (allFromChapters.size !== BOOK_I_SYSTEMS.length) {
    errors.push({
      system:   'clinical_reflection' as BookISystem,
      expected: `all 24 systems covered by getChapterUnlocks(1..10)`,
      actual:   `${allFromChapters.size} covered (${duplicates} duplicates)`,
    });
  }

  // 10. getCumulativeUnlocks at final chapter = all 24 systems
  const cumulative = getCumulativeUnlocks(BOOK_I_FINAL_CHAPTER);
  if (cumulative.length !== BOOK_I_SYSTEMS.length) {
    errors.push({
      system:   'clinical_reflection' as BookISystem,
      expected: `getCumulativeUnlocks(10).length === 24`,
      actual:   `getCumulativeUnlocks(10).length === ${cumulative.length}`,
    });
  }

  return errors;
}
