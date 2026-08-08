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
 * Expected encounter examples (from design spec):
 *   Ch  1 → None 55%  Battle 30%  Boss 10%  Treasure  5%  Merchant  0%
 *   Ch  5 → None 53%  Battle 30%  Boss 10%  Treasure  6%  Merchant  1%
 *   Ch 10 → None 51%  Battle 30%  Boss 10%  Treasure  7%  Merchant  2%
 *   Ch 20 → None 47%  Battle 30%  Boss 10%  Treasure  9%  Merchant  4%
 *   Ch 25 → None 45%  Battle 30%  Boss 10%  Treasure 10%  Merchant  5%
 *   Ch 35+ → None 43% Battle 30%  Boss 10%  Treasure 12%  Merchant  5%
 *
 * Authoritative chest checkpoint:
 *   Ch 10 → Bronze 75.5%  Silver 23.5%  Gold 1%
 */

const BP = 10_000;

export function getChapterTileCount(chapter: number): number {
  if (chapter <= 5) return 30;
  if (chapter <= 10) return 35;

  return 40 + 5 * Math.floor((chapter - 11) / 10);
}

export function getEncounterRatesBp(chapter: number) {
  const fiveChapterSteps = Math.floor(chapter / 5);

  const battle = 3_000;
  const areaBoss = 1_000;

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

/** Total basis points (10 000 = 100%). Exported for validators and tests. */
export const TOTAL_BP = BP;
