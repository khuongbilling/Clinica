/**
 * canonicalConfig.ts — Push 1: canonical journey balance configuration.
 *
 * Single source of truth for all canonical V1 encounter rates, tile counts,
 * chest quality, and density caps.  Nothing here imports from React, Expo,
 * or any UI layer.
 *
 * All rates use integer basis points:  10 000 = 100%,  100 = 1%,  50 = 0.5%
 *
 * STATUS: data-only — NOT yet wired to the encounter generator.
 * The generator will switch to these values when JOURNEY_CANONICAL_V1 is
 * enabled (a later push).  Current gameplay (config.ts / encounters.ts)
 * is completely unchanged.
 *
 * Changes MUST be accompanied by updated tests in
 * frontend/tests/canonical_config.test.ts.
 */

// ── Shared constant ────────────────────────────────────────────────────────────

/** 10 000 basis points = 100%.  Every rate table must sum to exactly this. */
export const CANONICAL_TOTAL_BP = 10_000;

// ── Time of day ────────────────────────────────────────────────────────────────
// Canonical definition lives in types.ts (the domain model layer).
// Imported here for use in this file's function signatures, and re-exported so
// existing consumers (`import { TimeOfDay } from './canonicalConfig'`) still work.
import type { TimeOfDay } from './types';
import { areaBossProbabilityBp as _areaBossProbabilityBp } from './chapterBossKeys';
export type { TimeOfDay };
export const TIME_OF_DAY_VALUES: readonly TimeOfDay[] = ['day', 'evening', 'night'];

// ── Map tile counts ────────────────────────────────────────────────────────────
//
//   Ch  1– 5 →  30 tiles
//   Ch  6–10 →  35 tiles
//   Ch 11–20 →  40 tiles
//   Ch 21–30 →  45 tiles
//   Ch 31–40 →  50 tiles
//   Ch 41–50 →  55 tiles  (+5 per 10-chapter band thereafter)
//
// Formula from Ch 11+:  40 + 5 × floor((chapter − 11) / 10)

export function canonicalTileCount(chapter: number): number {
  if (chapter <=  5) return 30;
  if (chapter <= 10) return 35;
  return 40 + 5 * Math.floor((chapter - 11) / 10);
}

// ── Battle rate ────────────────────────────────────────────────────────────────
//
// Fixed at 30% across all chapters and times of day.
// Actual tile density is further constrained by CANONICAL_ENEMY_DENSITY_CAP_BP
// during assignment — that cap takes precedence when it would produce fewer
// battle tiles than the 30% roll rate implies.

/** 30% — constant across all chapters. */
export const CANONICAL_BATTLE_RATE_BP = 3_000;

// ── Enemy density caps ─────────────────────────────────────────────────────────
//
// Maximum fraction of eligible tiles that may be assigned as battle encounters.
//
//   Day     → 40%   (4 000 bp)
//   Evening → 33%   (3 300 bp)
//   Night   → 25%   (2 500 bp)

export const CANONICAL_ENEMY_DENSITY_CAP_BP: Record<TimeOfDay, number> = {
  day:     4_000,
  evening: 3_300,
  night:   2_500,
};

export function canonicalEnemyDensityCapBp(timeOfDay: TimeOfDay): number {
  return CANONICAL_ENEMY_DENSITY_CAP_BP[timeOfDay];
}

// ── Area Boss ──────────────────────────────────────────────────────────────────
//
//   Ch  1– 3 →  0%   (no area bosses in opening chapters)
//   Ch  4–10 →  3%
//   Ch 11–20 →  4%
//   Ch 21+   →  5%
//
//   Hard tile maximum per run: 3  (regardless of roll rate or chapter)

/** Hard cap: at most this many area-boss tiles per run. */
export const CANONICAL_AREA_BOSS_HARD_MAX = 3;

/**
 * Delegates to `areaBossProbabilityBp` from chapterBossKeys.ts, which is the
 * authoritative definition.  Having a single implementation guarantees the
 * canonical encounter generator and the boss-key spec can never silently
 * diverge.
 */
export function canonicalAreaBossRateBp(chapter: number): number {
  return _areaBossProbabilityBp(chapter);
}

// ── Treasure ───────────────────────────────────────────────────────────────────
//
//   Base 5%.  +1% every five chapters.  Maximum 12%.
//   No tile count cap in canonical mode (rate-only control).

export const CANONICAL_TREASURE_BASE_BP = 500;    //  5%
export const CANONICAL_TREASURE_STEP_BP = 100;    //  1% per 5-chapter band
export const CANONICAL_TREASURE_MAX_BP  = 1_200;  // 12%

export function canonicalTreasureRateBp(chapter: number): number {
  const steps = Math.floor(chapter / 5);
  return Math.min(
    CANONICAL_TREASURE_MAX_BP,
    CANONICAL_TREASURE_BASE_BP + steps * CANONICAL_TREASURE_STEP_BP,
  );
}

// ── Merchant ───────────────────────────────────────────────────────────────────
//
//   Base 0%.  +1% every five chapters.  Maximum 5%.
//   No tile count cap in canonical mode.

export const CANONICAL_MERCHANT_BASE_BP = 0;    //  0%
export const CANONICAL_MERCHANT_STEP_BP = 100;  //  1% per 5-chapter band
export const CANONICAL_MERCHANT_MAX_BP  = 500;  //  5%

export function canonicalMerchantRateBp(chapter: number): number {
  const steps = Math.floor(chapter / 5);
  return Math.min(
    CANONICAL_MERCHANT_MAX_BP,
    CANONICAL_MERCHANT_BASE_BP + steps * CANONICAL_MERCHANT_STEP_BP,
  );
}

// ── Ward Events ────────────────────────────────────────────────────────────────
//
//   Chapter 1          →  0%  (all times)
//   Chapter 2 (day)    →  5%  — partial unlock; evening/night remain 0%
//   Chapter 3 (day)    → 10%  — partial unlock; evening/night remain 0%
//   Chapter 4+ day     → 15%  — full unlock
//   Chapter 4+ evening → 12%
//   Chapter 4+ night   →  9%
//
//   No tile count cap in canonical mode.
//   At the encounter-generator level this pool is gated by WARD_EVENTS_V1.

export const CANONICAL_WARD_EVENT_FULL_DAY_BP     = 1_500;  // 15%
export const CANONICAL_WARD_EVENT_FULL_EVENING_BP = 1_200;  // 12%
export const CANONICAL_WARD_EVENT_FULL_NIGHT_BP   =   900;  //  9%

export function canonicalWardEventRateBp(chapter: number, timeOfDay: TimeOfDay): number {
  if (chapter <= 1) return 0;
  if (chapter === 2) return timeOfDay === 'day' ?   500 : 0;  //  5% day-only
  if (chapter === 3) return timeOfDay === 'day' ? 1_000 : 0;  // 10% day-only
  // Chapter 4+: full rates per time of day
  if (timeOfDay === 'day')     return CANONICAL_WARD_EVENT_FULL_DAY_BP;
  if (timeOfDay === 'evening') return CANONICAL_WARD_EVENT_FULL_EVENING_BP;
  return CANONICAL_WARD_EVENT_FULL_NIGHT_BP;
}

// ── Full canonical encounter rate table ────────────────────────────────────────
//
// All six encounter categories.  `none` absorbs the remainder so the total
// is always exactly CANONICAL_TOTAL_BP (10 000 bp).
//
// Throws if the non-none rates would exceed 10 000 bp (configuration error).

export interface CanonicalEncounterRates {
  readonly none:      number;
  readonly battle:    number;
  readonly areaBoss:  number;
  readonly treasure:  number;
  readonly merchant:  number;
  readonly wardEvent: number;
}

export function canonicalEncounterRatesBp(
  chapter: number,
  timeOfDay: TimeOfDay,
): CanonicalEncounterRates {
  const battle    = CANONICAL_BATTLE_RATE_BP;
  const areaBoss  = canonicalAreaBossRateBp(chapter);
  const treasure  = canonicalTreasureRateBp(chapter);
  const merchant  = canonicalMerchantRateBp(chapter);
  const wardEvent = canonicalWardEventRateBp(chapter, timeOfDay);

  const none = CANONICAL_TOTAL_BP - battle - areaBoss - treasure - merchant - wardEvent;

  if (none < 0) {
    throw new Error(
      `[canonicalConfig] encounter rates exceed ${CANONICAL_TOTAL_BP} bp ` +
      `at ch${chapter}/${timeOfDay}: ` +
      `battle=${battle} areaBoss=${areaBoss} treasure=${treasure} ` +
      `merchant=${merchant} wardEvent=${wardEvent}`,
    );
  }

  return { none, battle, areaBoss, treasure, merchant, wardEvent };
}

// ── Rate table validation ──────────────────────────────────────────────────────

/** Returns an array of human-readable error strings; empty means valid. */
export function validateCanonicalRates(rates: CanonicalEncounterRates): string[] {
  const errors: string[] = [];
  let sum = 0;
  for (const [key, bp] of Object.entries(rates) as [string, number][]) {
    if (bp < 0) errors.push(`rate '${key}' is negative: ${bp} bp`);
    sum += bp;
  }
  if (sum !== CANONICAL_TOTAL_BP) {
    errors.push(`encounter rates sum to ${sum} bp (expected ${CANONICAL_TOTAL_BP})`);
  }
  return errors;
}

// ── Chest quality rates ────────────────────────────────────────────────────────
//
//   Bronze:  8 000 − (chapter − 1) × 50,  clamped to [4 000, 8 000]
//   Gold:    floor(chapter / 10) × 100,    clamped to [0, 1 500]
//   Silver:  remainder  (10 000 − bronze − gold)
//
//   Authoritative checkpoints:
//     Ch  1 → Bronze 8 000 (80.0%)  Silver 2 000 (20.0%)  Gold     0 ( 0.0%)
//     Ch  2 → Bronze 7 950 (79.5%)  Silver 2 050 (20.5%)  Gold     0 ( 0.0%)
//     Ch 10 → Bronze 7 550 (75.5%)  Silver 2 350 (23.5%)  Gold   100 ( 1.0%)
//     Ch 20 → Bronze 7 050 (70.5%)  Silver 2 750 (27.5%)  Gold   200 ( 2.0%)
//     Ch 80 → Bronze 4 050 (40.5%)  Silver 5 150 (51.5%)  Gold   800 ( 8.0%)
//     Ch 90 → Bronze 4 000 (40.0%)  Silver 5 100 (51.0%)  Gold   900 ( 9.0%)
//     Ch100 → Bronze 4 000 (40.0%)  Silver 5 000 (50.0%)  Gold 1 000 (10.0%)
//             (bronze floor and gold cap prevent silver from going negative)

export const CANONICAL_CHEST_BRONZE_BASE_BP = 8_000;
export const CANONICAL_CHEST_BRONZE_STEP_BP =    50;  // per chapter
export const CANONICAL_CHEST_BRONZE_MIN_BP  = 4_000;  // 40% floor
export const CANONICAL_CHEST_GOLD_STEP_BP   =   100;  // per 10-chapter band
export const CANONICAL_CHEST_GOLD_MAX_BP    = 1_500;  // 15% ceiling

export interface CanonicalChestRates {
  readonly bronze: number;
  readonly silver: number;
  readonly gold:   number;
}

export function canonicalChestQualityRatesBp(chapter: number): CanonicalChestRates {
  const bronze = Math.max(
    CANONICAL_CHEST_BRONZE_MIN_BP,
    CANONICAL_CHEST_BRONZE_BASE_BP - (chapter - 1) * CANONICAL_CHEST_BRONZE_STEP_BP,
  );
  const gold = Math.min(
    CANONICAL_CHEST_GOLD_MAX_BP,
    Math.floor(chapter / 10) * CANONICAL_CHEST_GOLD_STEP_BP,
  );
  const silver = CANONICAL_TOTAL_BP - bronze - gold;

  if (silver < 0) {
    throw new Error(`[canonicalConfig] chest silver is negative at ch${chapter}`);
  }

  return { bronze, silver, gold };
}

/** Returns an array of human-readable error strings; empty means valid. */
export function validateCanonicalChestRates(rates: CanonicalChestRates): string[] {
  const errors: string[] = [];
  const { bronze, silver, gold } = rates;
  if (bronze < 0) errors.push(`bronze is negative: ${bronze} bp`);
  if (silver < 0) errors.push(`silver is negative: ${silver} bp`);
  if (gold   < 0) errors.push(`gold is negative: ${gold} bp`);
  if (bronze < CANONICAL_CHEST_BRONZE_MIN_BP) {
    errors.push(`bronze (${bronze} bp) is below floor (${CANONICAL_CHEST_BRONZE_MIN_BP} bp)`);
  }
  if (gold > CANONICAL_CHEST_GOLD_MAX_BP) {
    errors.push(`gold (${gold} bp) exceeds ceiling (${CANONICAL_CHEST_GOLD_MAX_BP} bp)`);
  }
  const sum = bronze + silver + gold;
  if (sum !== CANONICAL_TOTAL_BP) {
    errors.push(`chest rates sum to ${sum} bp (expected ${CANONICAL_TOTAL_BP})`);
  }
  return errors;
}

// ── Encounters with no tile-count cap ─────────────────────────────────────────
//
// In canonical mode only AREA BOSS tiles have a hard count cap
// (CANONICAL_AREA_BOSS_HARD_MAX = 3).  All other encounter types are
// controlled by rate alone.

export const CANONICAL_UNCAPPED_ENCOUNTERS = [
  'treasure',
  'merchant',
  'wardEvent',
  'supportAlly',
  'protocolCard',
  'blessing',
] as const;

export type CanonicalUncappedEncounter = typeof CANONICAL_UNCAPPED_ENCOUNTERS[number];
