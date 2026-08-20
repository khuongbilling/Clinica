/**
 * journeyMap/chapterBossKeys.ts — Push 13: Area Boss key progression +
 * Chapter Boss Gate + Rechallenge Map rules.
 *
 * CANONICAL RULES (replaces prior per-map key requirement)
 * ─────────────────────────────────────────────────────────
 *
 * Chapter Boss Gate
 *   Requires exactly 3 Chapter Boss Keys (CHAPTER_BOSS_KEY_REQUIREMENT = 3).
 *   This is FIXED — it does NOT vary with how many Area Bosses generate on
 *   the current map.
 *
 * Area Boss tile probability (per generated map)
 *   Ch  1     →  3%   (expanded campus expedition)
 *   Ch  2– 3 →  0%   (no area bosses in the remaining opening chapters)
 *   Ch  4–10 →  3%
 *   Ch 11–20 →  4%
 *   Ch 21+   →  5%
 *   Hard maximum: 3 Area Bosses per generated map.
 *   No guaranteed minimum — a map may generate 0, 1, 2, or 3.
 *
 * Key award rule
 *   Each newly defeated Area Boss awards +1 Chapter Boss Key.
 *   Each tile may award its key only ONCE (areaBossKeyClaimed guard on tile).
 *   Deduplication prevents double-awards from revisiting, refreshing,
 *   reconnecting, reopening the chapter, or duplicate server requests.
 *
 * Chapter-level persistence (new — replaces run-level-only tracking)
 *   ChapterBossKeyState is stored at the CHAPTER level, not the run level.
 *   Keys earned on one map carry into the next randomised map for the same
 *   chapter via Rechallenge Map.
 *   Keys reset ONLY when the Chapter Boss is defeated (permanent chapter
 *   completion) — never on rechallenge, refresh, close, or stamina refill.
 *
 * Rechallenge Map (DISTINCT from Challenge Chapter)
 *   "Challenge Chapter" = post-clear replay (chapter boss already defeated).
 *   "Rechallenge Map"   = pre-clear new randomised map for the same chapter.
 *   Rechallenge Map is available while:
 *     • chapterBossDefeated === false
 *     • keysCollected < CHAPTER_BOSS_KEY_REQUIREMENT (3)
 *   On Rechallenge Map:
 *     PRESERVED — chapterBossKeysCollected, claimedTileIds, permanent chapter
 *                 progression, canonical story/shift choice.
 *     RESET     — current map position, revealed tiles, resolved encounters,
 *                 run-scoped Call Team, Protocol Cards, Ward Blessings,
 *                 Ward Hazards, seed, topology, all encounter distributions,
 *                 fog state.
 *
 * This module is pure domain logic — no React, no I/O, no BattleState writes.
 */

import type { TimeOfDay } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Exact number of Chapter Boss Keys required to open the Chapter Boss Gate. */
export const CHAPTER_BOSS_KEY_REQUIREMENT = 3;

/**
 * Hard maximum number of Area Boss tiles per generated map (any chapter).
 * The map generator enforces this cap separately from the probability roll.
 * Matches CANONICAL_AREA_BOSS_HARD_MAX in canonicalConfig.ts.
 */
export const AREA_BOSS_MAP_MAX = 3;

// ── Area Boss tile probability ────────────────────────────────────────────────

/**
 * Probability (in basis points out of 10 000) that any given eligible tile
 * will roll as an Area Boss tile.
 *
 * The generator zero-out this rate once AREA_BOSS_MAP_MAX tiles have been
 * placed — so the actual count per map is bounded to [0, AREA_BOSS_MAP_MAX].
 *
 *   Ch  1     →  300  (  3 %)
 *   Ch  2– 3  →    0  (  0 %)
 *   Ch  4–10  →  300  (  3 %)
 *   Ch 11–20  →  400  (  4 %)
 *   Ch 21+    →  500  (  5 %)
 *
 * This is the authoritative definition.  canonicalConfig.canonicalAreaBossRateBp()
 * must match these values.
 */
export function areaBossProbabilityBp(chapter: number): number {
  if (chapter <= 0)  return 0;
  if (chapter === 1) return 300;
  if (chapter <= 3)  return 0;
  if (chapter <= 10) return 300;
  if (chapter <= 20) return 400;
  return 500;
}

/**
 * True when Area Boss tiles are possible for the given chapter.
 * Chapter 1 has a 3% expedition rate; Chapters 2–3 remain disabled.
 */
export function areaBossEnabled(chapter: number): boolean {
  return areaBossProbabilityBp(chapter) > 0;
}

/**
 * Maximum number of Chapter Boss Keys that can appear on a single map.
 * Equal to AREA_BOSS_MAP_MAX (one key per area boss tile).
 */
export const KEYS_PER_MAP_MAX = AREA_BOSS_MAP_MAX;

// ── ChapterBossKeyState ───────────────────────────────────────────────────────

/**
 * Chapter-level key progression.  Persists across all map attempts for
 * a given chapter.  Stored and managed OUTSIDE the JourneyRun record.
 *
 *  chapterId      Which chapter these keys belong to.
 *  keysCollected  How many keys have been earned so far (0–CHAPTER_BOSS_KEY_REQUIREMENT).
 *  claimedTileIds Sorted list of Area Boss tile ids whose keys have been
 *                 claimed.  Used for deduplication — if a tileId is already
 *                 in this list, claimAreaBossKey is a no-op for that tile.
 */
export interface ChapterBossKeyState {
  readonly chapterId:      number;
  readonly keysCollected:  number;
  /** Sorted ascending so comparisons are stable. */
  readonly claimedTileIds: readonly string[];
}

/**
 * Create a fresh ChapterBossKeyState for a chapter.
 *
 * @param chapterId       Chapter number (1-based).
 * @param keysCollected   Initial key count (default 0).  Pass the persisted
 *                        value when restoring from storage.
 * @param claimedTileIds  Previously claimed tile ids (default []).
 */
export function createChapterBossKeyState(
  chapterId:      number,
  keysCollected:  number = 0,
  claimedTileIds: readonly string[] = [],
): ChapterBossKeyState {
  const keys = Math.min(
    Math.max(0, Math.round(keysCollected)),
    CHAPTER_BOSS_KEY_REQUIREMENT,
  );
  const ids = [...new Set(claimedTileIds)].sort();
  return { chapterId, keysCollected: keys, claimedTileIds: ids };
}

// ── Key claiming ──────────────────────────────────────────────────────────────

/**
 * Claim the Chapter Boss Key from a defeated Area Boss tile.
 *
 * IDEMPOTENT — if `tileId` is already in `claimedTileIds`, returns the
 * original state unchanged.  This prevents duplicate awards from:
 *   • revisiting the tile
 *   • refreshing or reconnecting
 *   • reopening the chapter
 *   • replaying a completed battle result
 *   • duplicate server requests
 *
 * The returned state's keysCollected is clamped to CHAPTER_BOSS_KEY_REQUIREMENT.
 *
 * @param state   Current chapter key state.
 * @param tileId  Area Boss tile id that was just defeated.
 */
export function claimAreaBossKey(
  state:  ChapterBossKeyState,
  tileId: string,
): ChapterBossKeyState {
  // Idempotency guard — already claimed
  if (state.claimedTileIds.includes(tileId)) return state;

  const newKeys = Math.min(
    state.keysCollected + 1,
    CHAPTER_BOSS_KEY_REQUIREMENT,
  );
  const newIds = [...state.claimedTileIds, tileId].sort();

  return {
    ...state,
    keysCollected:  newKeys,
    claimedTileIds: newIds,
  };
}

/**
 * Claim multiple Area Boss keys at once (e.g. when restoring from a batch
 * of server-confirmed defeats).  Applies each tileId idempotently in order.
 */
export function claimAreaBossKeys(
  state:   ChapterBossKeyState,
  tileIds: readonly string[],
): ChapterBossKeyState {
  return tileIds.reduce(claimAreaBossKey, state);
}

// ── Gate check ────────────────────────────────────────────────────────────────

/**
 * True when the player has collected enough Chapter Boss Keys to open the
 * Chapter Boss Gate.  Requires exactly CHAPTER_BOSS_KEY_REQUIREMENT (3) keys.
 */
export function isChapterBossGateOpen(state: ChapterBossKeyState): boolean {
  return state.keysCollected >= CHAPTER_BOSS_KEY_REQUIREMENT;
}

// ── Progress summary ──────────────────────────────────────────────────────────

export interface KeyProgress {
  readonly collected: number;
  readonly required:  number;
  readonly remaining: number;
  readonly isOpen:    boolean;
}

/**
 * Return a structured progress summary for the Chapter Boss Gate HUD.
 */
export function getKeyProgress(state: ChapterBossKeyState): KeyProgress {
  const collected = state.keysCollected;
  const required  = CHAPTER_BOSS_KEY_REQUIREMENT;
  return {
    collected,
    required,
    remaining: Math.max(0, required - collected),
    isOpen:    collected >= required,
  };
}

/**
 * Short display string for the HUD: "1 / 3", "3 / 3".
 */
export function describeKeyProgress(state: ChapterBossKeyState): string {
  return `${state.keysCollected} / ${CHAPTER_BOSS_KEY_REQUIREMENT}`;
}

// ── Rechallenge Map ───────────────────────────────────────────────────────────

/**
 * The product-approved action name for starting a new pre-clear map.
 * DISTINCT from "Challenge Chapter" (post-clear replay).
 */
export const RECHALLENGE_MAP_LABEL = 'Rechallenge Map';

/**
 * Run-scoped fields that are RESET when a Rechallenge Map is confirmed.
 * These are re-generated fresh for the new map attempt.
 */
export const RECHALLENGE_RESET_FIELDS = [
  'seed',
  'mapTopology',
  'fogState',
  'currentMapPosition',
  'revealedTiles',
  'resolvedEncounters',
  'encounterDistribution',
  'areaBossDistribution',
  'treasureRolls',
  'merchantRolls',
  'wardEventRolls',
  'callTeam',           // run-scoped Call Team contacts
  'protocolCards',      // run-scoped Protocol Cards
  'wardBlessings',      // run-scoped Ward Blessings
  'wardHazards',        // temporary Ward Hazards
  'pressure',           // run pressure meter
] as const;

export type RechallengeResetField = typeof RECHALLENGE_RESET_FIELDS[number];

/**
 * Chapter-scoped fields that are PRESERVED when a Rechallenge Map is confirmed.
 * These carry forward into every new attempt for this chapter.
 */
export const RECHALLENGE_PRESERVED_FIELDS = [
  'chapterBossKeysCollected',
  'claimedTileIds',
  'permanentChapterProgression',
  'canonicalStoryChoice',
  'shiftChoice',
] as const;

export type RechallengePreservedField = typeof RECHALLENGE_PRESERVED_FIELDS[number];

// ── Rechallenge eligibility ───────────────────────────────────────────────────

export interface RechallengeEligibility {
  readonly eligible: boolean;
  /** Reason why the action is unavailable.  Absent when eligible. */
  readonly reason?:  string;
}

/**
 * Check whether the player may trigger Rechallenge Map.
 *
 * Eligible when:
 *   • Chapter Boss has NOT been defeated.
 *   • Fewer than CHAPTER_BOSS_KEY_REQUIREMENT keys collected.
 *
 * NOT eligible when:
 *   • Chapter Boss defeated (use Challenge Chapter instead).
 *   • 3 keys collected (gate is open — fight the boss first).
 */
export function checkRechallengeEligibility(
  state:               ChapterBossKeyState,
  chapterBossDefeated: boolean,
): RechallengeEligibility {
  if (chapterBossDefeated) {
    return {
      eligible: false,
      reason:   'Chapter Boss already defeated. Use Challenge Chapter for post-clear replay.',
    };
  }
  if (isChapterBossGateOpen(state)) {
    return {
      eligible: false,
      reason:   `Chapter Boss Gate is open (${state.keysCollected}/${CHAPTER_BOSS_KEY_REQUIREMENT} keys). Fight the boss first.`,
    };
  }
  return { eligible: true };
}

// ── Rechallenge Map spec ──────────────────────────────────────────────────────

/**
 * Minimal run information required to build a Rechallenge Map spec.
 * Caller extracts these from the active JourneyRun.
 */
export interface RechallengeMapInput {
  readonly playerId:            string;
  readonly chapterId:           number;
  /** Shift frozen at run creation (preserved across rechallenge). */
  readonly shift:               TimeOfDay;
  /** Current run's attemptNumber.  New run will be +1. */
  readonly currentAttemptNumber: number;
  readonly chapterBossDefeated: boolean;
}

/**
 * What the caller must do to create the new Rechallenge Map run.
 *
 * The caller:
 *   1. Verifies eligibleToRechallenge is true.
 *   2. Generates a new cryptographically random seed.
 *   3. Calls generateRunData(chapterId, newSeed, shift) for topology + encounters.
 *   4. Passes the result + preservedKeyState into buildInitialJourneyRun().
 *   5. Archives or marks the previous run as abandoned.
 */
export interface RechallengeMapSpec {
  /** True when the action is allowed. */
  readonly eligibleToRechallenge:  boolean;
  /** Reason unavailable (only set when eligibleToRechallenge is false). */
  readonly ineligibilityReason?:   string;
  readonly playerId:               string;
  readonly chapterId:              number;
  /** Shift to pass into the new run (preserved canonical story choice). */
  readonly shift:                  TimeOfDay;
  /** attemptNumber for the new run (currentAttemptNumber + 1). */
  readonly newAttemptNumber:       number;
  /** Chapter-level key state to carry into the new run.  Identical to input state. */
  readonly preservedKeyState:      ChapterBossKeyState;
  /** Fields the caller MUST reset / re-generate. */
  readonly resetFields:            readonly RechallengeResetField[];
  /** Fields the caller MUST preserve. */
  readonly preservedFields:        readonly RechallengePreservedField[];
}

/**
 * Build the Rechallenge Map spec from an active run and the chapter key state.
 *
 * Call checkRechallengeEligibility() before using this if you want a
 * user-facing error message.  This function also sets eligibleToRechallenge.
 */
export function buildRechallengeMapSpec(
  input:    RechallengeMapInput,
  keyState: ChapterBossKeyState,
): RechallengeMapSpec {
  const eligibility = checkRechallengeEligibility(keyState, input.chapterBossDefeated);

  return {
    eligibleToRechallenge:  eligibility.eligible,
    ineligibilityReason:    eligibility.reason,
    playerId:               input.playerId,
    chapterId:              input.chapterId,
    shift:                  input.shift,
    newAttemptNumber:       input.currentAttemptNumber + 1,
    preservedKeyState:      keyState,       // keys carry forward as-is
    resetFields:            RECHALLENGE_RESET_FIELDS,
    preservedFields:        RECHALLENGE_PRESERVED_FIELDS,
  };
}

// ── Multi-run key example trace ───────────────────────────────────────────────

/**
 * Simulate a multi-run key progression to verify the carry-forward rule.
 * Returns the final state after claiming all provided tileIds across runs.
 *
 * Useful for tests and documentation — not used in production.
 *
 * @param chapterId  Chapter being simulated.
 * @param runBatches Each inner array is one run's worth of claimed tile ids.
 */
export function simulateMultiRunKeyProgression(
  chapterId:  number,
  runBatches: ReadonlyArray<readonly string[]>,
): ChapterBossKeyState {
  let state = createChapterBossKeyState(chapterId);
  for (const batch of runBatches) {
    state = claimAreaBossKeys(state, batch);
  }
  return state;
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a ChapterBossKeyState for internal consistency.
 * Returns an array of error strings; empty means valid.
 *
 * Checks:
 *  • chapterId is a positive integer.
 *  • keysCollected is an integer in [0, CHAPTER_BOSS_KEY_REQUIREMENT].
 *  • claimedTileIds has no duplicates.
 *  • claimedTileIds.length ≤ keysCollected (may be equal or less if some
 *    tiles were on earlier runs without tile-level tracking).
 *  • All claimedTileIds are non-empty strings.
 */
export function validateChapterBossKeyState(
  state: ChapterBossKeyState,
): readonly string[] {
  const errors: string[] = [];
  const { chapterId, keysCollected, claimedTileIds } = state;

  if (!Number.isInteger(chapterId) || chapterId < 1) {
    errors.push(`chapterId ${chapterId} must be a positive integer.`);
  }
  if (!Number.isInteger(keysCollected) || keysCollected < 0 || keysCollected > CHAPTER_BOSS_KEY_REQUIREMENT) {
    errors.push(`keysCollected ${keysCollected} must be an integer in [0, ${CHAPTER_BOSS_KEY_REQUIREMENT}].`);
  }
  const uniqueIds = new Set(claimedTileIds);
  if (uniqueIds.size !== claimedTileIds.length) {
    errors.push(`claimedTileIds contains duplicates.`);
  }
  for (const id of claimedTileIds) {
    if (!id || typeof id !== 'string') {
      errors.push(`claimedTileIds contains an empty or non-string entry.`);
    }
  }
  if (claimedTileIds.length > keysCollected) {
    errors.push(
      `claimedTileIds.length (${claimedTileIds.length}) exceeds keysCollected (${keysCollected}).`,
    );
  }
  return errors;
}
