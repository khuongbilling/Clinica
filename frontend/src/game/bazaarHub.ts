// ────────────────────────────────────────────────────────────
// SANCTUARY BAZAAR PLACEHOLDER (Push 8)
// ────────────────────────────────────────────────────────────
// This module is DATA + DOCUMENTATION only. It introduces the future player
// marketplace with rich, readable copy — but wires up NO live trading, NO
// listings, NO purchases, NO auctions, and NO player-to-player transactions.
// All numeric rules below (level/account age requirements, price bounds,
// taxes, listing fees) mirror the single-source-of-truth constants already
// defined in `economy.ts` (SANCTUARY_BAZAAR_*, MARKETPLACE_*, LISTING_FEE_*).
// If those change, update this file's copy to match — never invent new
// numbers here.
//
// Illustrated art direction matches modeHub.ts / eventsHub.ts: bright
// anime/donghua fantasy-medical style, jade/gold/lotus accents.
// ────────────────────────────────────────────────────────────

import {
  SANCTUARY_BAZAAR_TRADEABLE,
  SANCTUARY_BAZAAR_NON_TRADEABLE,
  MARKETPLACE_CURRENCY_RULES,
  MARKETPLACE_TAX_TIERS,
  LISTING_FEE_RULES,
  MARKETPLACE_PRICE_BOUNDS,
} from "@/src/game/economy";

export type BazaarBadge = "Preview" | "Planned" | "Coming Soon";

export const BAZAAR_STATUS: BazaarBadge = "Coming Soon";

export const BAZAAR_WELCOME = {
  title: "Welcome to the Sanctuary Bazaar",
  kicker: "NIGHT MARKET · COMING SOON",
  body:
    "Tucked into the Sanctuary's commerce district, the Night Market is where healers will one day " +
    "trade the treasures they've gathered on their journey — rare cosmetics, event keepsakes, and " +
    "collectible curios. The lanterns are lit and the stalls are being built, but the gates are not " +
    "open yet. Everything on this page is a preview of what's planned, not something you can do today.",
};

export const BAZAAR_PURPOSE = {
  title: "Why a Marketplace?",
  body:
    "The Bazaar is designed to let healers who love collecting and trading find a home for their " +
    "duplicate cosmetics and rare finds, while giving other players a way to acquire limited items " +
    "they missed. It is built around collectibles and flair, never around power — nothing tradeable " +
    "here will ever make a hero stronger, unlock content faster, or create pay-to-win advantages.",
  pillars: [
    { icon: "sparkles-outline", label: "Cosmetics & collectibles only" },
    { icon: "shield-checkmark-outline", label: "Never exclusive power" },
    { icon: "people-outline", label: "Player-to-player, not pay-to-win" },
    { icon: "time-outline", label: "Safety rules before it ever opens" },
  ],
};

export interface BazaarChipSection {
  id: string;
  title: string;
  icon: string;
  accentColor: string;
  intro: string;
  chips: string[];
}

export const BAZAAR_TRADEABLE_SECTION: BazaarChipSection = {
  id: "tradeable",
  title: "Tradeable Item Categories",
  icon: "swap-horizontal-outline",
  accentColor: "#34D399",
  intro: "Planned categories healers will eventually be able to list and trade with each other.",
  chips: SANCTUARY_BAZAAR_TRADEABLE,
};

export const BAZAAR_NON_TRADEABLE_SECTION: BazaarChipSection = {
  id: "non-tradeable",
  title: "Non-Tradeable Categories",
  icon: "lock-closed-outline",
  accentColor: "#EF4444",
  intro: "Account-bound or progression-critical items that will never be tradeable, even after launch.",
  chips: SANCTUARY_BAZAAR_NON_TRADEABLE,
};

export interface BazaarRuleRow {
  label: string;
  value: string;
  icon: string;
}

export const BAZAAR_MARKETPLACE_RULES: BazaarRuleRow[] = [
  { icon: "trending-down-outline", label: "Price floor", value: `${MARKETPLACE_PRICE_BOUNDS.floorPercentOfValue}% of an item's estimated value` },
  { icon: "trending-up-outline", label: "Price ceiling", value: `${MARKETPLACE_PRICE_BOUNDS.ceilingPercentOfValue}% of an item's estimated value` },
  { icon: "hourglass-outline", label: "Event item delay", value: "Event items become tradeable 7–14 days after the event ends" },
  { icon: "alert-circle-outline", label: "High-value confirmation", value: "Large trades require an extra confirmation step before completing" },
  { icon: "flag-outline", label: "Suspicious trade flags", value: "Unusual trade patterns are automatically flagged for review" },
];

export const BAZAAR_TRADING_REQUIREMENTS: BazaarRuleRow[] = [
  { icon: "school-outline", label: "Player level", value: "Must reach Player Level 10 before trading unlocks" },
  { icon: "calendar-outline", label: "Account age", value: "Account must be at least 7 days old" },
  { icon: "list-outline", label: "Daily listing limit", value: "Listings per day will be capped to prevent flooding the market" },
  { icon: "repeat-outline", label: "Weekly volume cap", value: "A weekly cap on total premium trade volume per account" },
];

export const BAZAAR_TAX_TIERS = MARKETPLACE_TAX_TIERS;

export const BAZAAR_TAX_NOTES = {
  intro:
    "Every completed trade will apply a small tax split between buyer and seller, removed from the " +
    "economy to keep prices healthy. Tax rates depend on how rare the traded item is.",
  buyerCurrency: MARKETPLACE_CURRENCY_RULES.buyerPrimaryCurrency,
  refinedGemCapNote:
    `Refined Lotus Gems cannot fully replace Lotus Gems on the buyer side of a premium trade — they may ` +
    `only cover up to ${MARKETPLACE_CURRENCY_RULES.refinedGemBuyerCapPercent}% of a purchase, capped at ` +
    `${MARKETPLACE_CURRENCY_RULES.refinedGemDailyMarketplaceCap} Refined Lotus Gems per day.`,
};

export const BAZAAR_LISTING_FEES = {
  intro: "Sellers will pay a small fee to list an item, refundable in part if the item sells.",
  feePercent: LISTING_FEE_RULES.feePercent,
  minFee: LISTING_FEE_RULES.minFee,
  maxFee: LISTING_FEE_RULES.maxFee,
  currencies: LISTING_FEE_RULES.currencies,
  refundOnSellPercent: LISTING_FEE_RULES.refundOnSellPercent,
  lostOnExpire: LISTING_FEE_RULES.lostOnExpire,
};

export const BAZAAR_SAFETY_GUIDELINES: BazaarRuleRow[] = [
  { icon: "lock-closed-outline", label: "Account-bound items", value: "Some items are permanently account-bound and can never be listed" },
  { icon: "eye-outline", label: "Fraud monitoring", value: "Suspicious trades are flagged and reviewed before they can harm other players" },
  { icon: "people-circle-outline", label: "No account trading", value: "Player accounts themselves can never be bought, sold, or transferred" },
  { icon: "medal-outline", label: "Achievements stay yours", value: "Achievement and wellness milestone badges are never tradeable" },
  { icon: "shield-outline", label: "No power for sale", value: "Nothing on the Bazaar will ever grant exclusive power or a competitive advantage" },
];
