/**
 * journeyMap/config.ts
 *
 * Single source of truth for all fog-map balance numbers.
 *
 * All rates use integer basis points:  10 000 = 100%,  100 = 1%,  50 = 0.5%
 *
 * Nothing in this file imports from React, Expo, or any UI layer.
 * Probability logic must never be duplicated inside a component.
 *
 * Expected encounter examples (updated Push 13 area-boss rates):
 *   Ch  1– 3 → None 65%  Battle 30%  Boss  0%  Treasure  5%  Merchant  0%
 *   Ch  4–10 → None 60%  Battle 30%  Boss  3%  Treasure  6%  Merchant  1%
 *   Ch 11–20 → None 54%  Battle 30%  Boss  4%  Treasure  9%  Merchant  3%
 *   Ch 21+   → None 52%  Battle 30%  Boss  5%  Treasure 10%  Merchant  3%
 *
 * Authoritative chest checkpoint:
 *   Ch 10 → Bronze 75.5%  Silver 23.5%  Gold 1%
 */

import type { BasisPoints, EncounterType, ChestTier } from './types';

const BP = 10_000;

/**
 * Canonical total physical terrain cell count for a chapter.
 *
 * This is the SINGLE SOURCE OF TRUTH for terrain sizing.  All systems that
 * need a cell count — template validation, run creation, progress UI, topology
 * generation, diagnostics — MUST call this function.  Never duplicate these
 * numbers in component code, map templates, or JourneyRun creation logic.
 *
 * The count includes ALL physical cells on the authored terrain field:
 *   • 1 Start cell
 *   • 1 Chapter Boss Gate anchor cell
 *   • (N − 2) traversable encounter-eligible cells
 *
 * So for Chapter 1: total = 60, encounterEligible = 58.
 *
 * Band table:
 *   Ch  1– 5 →  60
 *   Ch  6–10 →  70
 *   Ch 11–20 →  80
 *   Ch 21–30 →  90
 *   Ch 31–40 → 100
 *   Ch 41–50 → 110
 *   … +10 per ten-chapter band thereafter
 *
 * Formula for ch ≥ 11: 80 + 10 × floor((chapter − 11) / 10)
 */
export function getChapterTerrainCellCount(chapter: number): number {
  if (chapter <= 5)  return 60;
  if (chapter <= 10) return 70;

  return 80 + 10 * Math.floor((chapter - 11) / 10);
}

/**
 * Chapters whose production geometry is sourced from the canonical map
 * blueprint pipeline (DNA → PathwayGraph → HexLayout → SceneryLayout).
 *
 * MIGRATION GATE — add a chapter here only after its pipeline geometry has
 * been accepted as the production replacement for the authored circular blob.
 *
 * Priority rule: BLUEPRINT_PIPELINE_CHAPTERS beats PRODUCTION_AUTHORED_CHAPTERS.
 * When a chapter appears here, generateRunData bypasses both isAuthoredChapter()
 * and generateHexTopology() and calls getCanonicalChapterMapArtifact() instead.
 *
 * ⚠ NEVER remove a chapter from this set once players have active runs on it.
 */
export const BLUEPRINT_PIPELINE_CHAPTERS = new Set<number>([
  // Production Bridge Push 1 — Ch1 canary (academic_quad, 60 cells)
  1,
]);

/** Alias exported for callers that use the old name — see chapterTileCount. */
export function chapterTileCount(chapter: number): number {
  return getChapterTerrainCellCount(chapter);
}

/** @deprecated Renamed to getChapterTerrainCellCount. Remove usages; this
 *  alias will be deleted once all call-sites are migrated. */
export const getChapterTileCount = getChapterTerrainCellCount;

export function getEncounterRatesBp(chapter: number) {
  const fiveChapterSteps = Math.floor(chapter / 5);

  const battle = 3_000;
  const areaBoss = legacyAreaBossRateBp(chapter);

  const treasure = Math.min(
    1_200,
    500 + fiveChapterSteps * 100,
  );

  const merchant = Math.min(
    500,
    fiveChapterSteps * 100,
  );

  const none = BP - battle - areaBoss - treasure - merchant;

  if (none < 0) {
    throw new Error('Encounter configuration exceeds 100%');
  }

  return {
    none,
    battle,
    areaBoss,
    treasure,
    merchant,
  };
}

export function getTreasureCap(chapter: number): number {
  return 3 + Math.floor((chapter - 1) / 10);
}

export function getMerchantCap(chapter: number): number {
  const merchantChance = getEncounterRatesBp(chapter).merchant;

  if (merchantChance === 0) return 0;

  return 1 + Math.floor((chapter - 1) / 10);
}

export function getAreaBossCap(): number {
  return 3;
}

export function getChestTierRatesBp(chapter: number) {
  const bronze = Math.max(
    4_000,
    8_000 - 50 * (chapter - 1),
  );

  const gold = Math.min(
    1_500,
    Math.floor(chapter / 10) * 100,
  );

  const silver = BP - bronze - gold;

  if (silver < 0) {
    throw new Error('Chest tier configuration is invalid');
  }

  return {
    bronze,
    silver,
    gold,
  };
}

/** 10 000 basis points = 100% */
export const TOTAL_BP = 10_000;

/** Fixed battle encounter rate across all chapters. */
export const BATTLE_RATE_BP: BasisPoints = 3_000; // 30%

/** Treasure rate at Chapter 1. */
export const TREASURE_BASE_BP: BasisPoints = 500; // 5%

/** Bronze decreases by this many bp per chapter after Chapter 1. */
export const CHEST_BRONZE_STEP_BP: BasisPoints = 50; // 0.5 pp

export interface EncounterRates {
  /** encounter → rate in basis points.
   *  'boss'      — excluded: assigned deterministically to the gate tile, never rolled.
   *  'wardEvent' — excluded from rolling pool (Push 20): assigned by the map template
   *                generator at authoring time, not by the probability table.
   */
  readonly rates: Readonly<Record<Exclude<EncounterType, 'boss' | 'wardEvent'>, BasisPoints>>;
}

/**
 * Computes the full encounter-rate profile for a chapter.
 *
 * - Battle is fixed at 30%.
 * - Area boss is the desired roll rate (10%); the generator enforces the hard
 *   count cap separately.
 * - Treasure starts at 5%, +1% every 5 chapters, capped at 12%.
 * - Merchant starts at 0%, +1% every 5 chapters, capped at 5%.
 * - None absorbs all remaining probability so the total is always 10 000 bp.
 */
export function encounterRates(chapter: number): EncounterRates {
  const battle    = BATTLE_RATE_BP;
  const areaBoss  = legacyAreaBossRateBp(chapter);
  const treasure  = Math.min(
    TREASURE_BASE_BP + Math.floor(chapter / 5) * TREASURE_STEP_BP,
    TREASURE_MAX_BP,
  );
  const merchant  = Math.min(
    Math.floor(chapter / 5) * MERCHANT_STEP_BP,
    MERCHANT_MAX_BP,
  );
  const none      = TOTAL_BP - battle - areaBoss - treasure - merchant;

  return {
    rates: { battle, areaBoss, treasure, merchant, none },
  };
}

/**
 * Maximum number of merchant tiles allowed in a single run of the given chapter.
 *
 * Returns 0 while the merchant encounter rate is 0% (chapters 1–4).
 *
 *   Ch  1– 4 → 0  (rate is 0%)
 *   Ch  5–10 → 1
 *   Ch 11–20 → 2
 *   Ch 21–30 → 3
 *   … +1 per 10-chapter band
 */
export function merchantMaxCount(chapter: number): number {
  const { rates } = encounterRates(chapter);
  if (rates.merchant === 0) return 0;
  return 1 + Math.floor((chapter - 1) / 10);
}

export interface ChestQualityRates {
  readonly rates: Readonly<Record<ChestTier, BasisPoints>>;
}

/** Gold quality ceiling. */
export const CHEST_GOLD_MAX_BP: BasisPoints = 1_500; // 15%

/** Hard cap on the number of area-boss tiles per run (any chapter). */
export const AREA_BOSS_MAX_COUNT = 3;

/** Hard ceiling on the treasure rate. */
export const TREASURE_MAX_BP: BasisPoints = 1_200; // 12%

/** Merchant rate starts at 0. */
export const MERCHANT_BASE_BP: BasisPoints = 0; // 0%

/** Hard ceiling on the merchant rate. */
export const MERCHANT_MAX_BP: BasisPoints = 500; // 5%

/** Bronze chest quality at Chapter 1. */
export const CHEST_BRONZE_BASE_BP: BasisPoints = 8_000; // 80%

/** Gold increases by this many bp every 10 chapters. */
export const CHEST_GOLD_STEP_BP: BasisPoints = 100; // 1 pp per 10 chapters

/** Merchant rate increase per 5 chapters. */
export const MERCHANT_STEP_BP: BasisPoints = 100; // 1%

/**
 * Chapter-specific area-boss roll rate for the LEGACY encounter generator.
 * The canonical generator (JOURNEY_CANONICAL_V1) uses canonicalAreaBossRateBp()
 * from canonicalConfig.ts which defines these same values authoritatively.
 *
 *   Ch  1– 3 →    0 bp (  0%)   No area bosses in early chapters.
 *   Ch  4–10 →  300 bp (  3%)
 *   Ch 11–20 →  400 bp (  4%)
 *   Ch 21+   →  500 bp (  5%)
 *
 * @deprecated Pass to the legacy assignJourneyEncounters() only.
 *             Use chapterBossKeys.areaBossProbabilityBp() as the canonical source.
 */
export function legacyAreaBossRateBp(chapter: number): BasisPoints {
  if (chapter <= 3)  return   0;
  if (chapter <= 10) return 300;
  if (chapter <= 20) return 400;
  return 500;
}

/**
 * Returns the chest-quality probability profile for a given chapter.
 *
 * Bronze formula:  8 000 − (chapter − 1) × 50,  clamped to [4 000, 8 000]
 * Gold formula:    floor(chapter / 10) × 100,    clamped to [0, 1 500]
 * Silver:          remainder (10 000 − bronze − gold)
 *
 * Key checkpoints (all in basis points):
 *   Ch  1 → bronze 8 000 / silver 2 000 / gold    0
 *   Ch  2 → bronze 7 950 / silver 2 050 / gold    0
 *   Ch 10 → bronze 7 550 / silver 2 350 / gold  100   (authoritative reference)
 *   Ch 20 → bronze 7 050 / silver 2 750 / gold  200
 */
export function chestQualityRates(chapter: number): ChestQualityRates {
  const bronze = Math.max(
    CHEST_BRONZE_MIN_BP,
    CHEST_BRONZE_BASE_BP - (chapter - 1) * CHEST_BRONZE_STEP_BP,
  );
  const gold = Math.min(
    CHEST_GOLD_MAX_BP,
    Math.floor(chapter / 10) * CHEST_GOLD_STEP_BP,
  );
  const silver = TOTAL_BP - bronze - gold;

  return { rates: { bronze, silver, gold } };
}

/** Treasure rate increase per 5 chapters. */
export const TREASURE_STEP_BP: BasisPoints = 100; // 1%

/**
 * Maximum number of treasure tiles allowed in a single run of the given chapter.
 *
 *   Ch  1–10 → 3
 *   Ch 11–20 → 4
 *   Ch 21–30 → 5
 *   … +1 per 10-chapter band
 */
export function treasureMaxCount(chapter: number): number {
  return 3 + Math.floor((chapter - 1) / 10);
}

/** Bronze quality floor. */
export const CHEST_BRONZE_MIN_BP: BasisPoints = 4_000; // 40%

/**
 * Returns the number of playable hex tiles for a given chapter.
 *
 * Band mapping:
 *   Ch  1– 5 →  30 tiles
 *   Ch  6–10 →  35 tiles
 *   Ch 11–20 →  40 tiles   (and +5 for each subsequent 10-chapter band)
 *   Ch 21–30 →  45 tiles
 *   Ch 31–40 →  50 tiles
 *   …
 *
 * The chapter-boss gate tile is decorative and is NOT counted here.
 */
export function tileCount(chapter: number): number {
  if (chapter <= 5)  return 30;
  if (chapter <= 10) return 35;
  // From chapter 11 onwards: base 40, +5 per complete 10-chapter band past 10.
  return 40 + Math.floor((chapter - 11) / 10) * 5;
}
