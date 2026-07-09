// Economy Foundation (Push 2)
// -----------------------------------------------------------------------------
// This file is a DATA + DOCUMENTATION layer only. Nothing here wires up real
// money, live player-to-player trading, or subscriptions. Every "price" below
// is a design anchor for future work. UI built on top of this file must render
// these as informational / "Coming Soon" — never as a working purchase flow
// unless a real payment/trading system is separately built and reviewed.
//
// Core principle: free players can earn meaningful premium value through time,
// learning, wellness, events, and skill. Paying players get convenience,
// cosmetics, faster access, and luxury — never unfair power. No pay-to-win.
// -----------------------------------------------------------------------------

export type CurrencyId =
  | "crowns"
  | "codex_shards"
  | "insight_crystals"
  | "refined_lotus_gems"
  | "lotus_gems_paid"
  | "ward_sigils"
  | "university_credits";

export interface CurrencyDef {
  id: CurrencyId;
  displayName: string;
  shortLabel: string;
  icon: string;
  color: "brand" | "river" | "storm" | "growth" | "energy" | "protection";
  category: "free" | "earned-premium" | "paid-premium" | "recruitment" | "progression";
  tagline: string;
  earnedFrom: string;
  spentOn: string;
}

// Displayed in this exact order in the Economy Guide / Shop Premium tab.
export const CURRENCIES: CurrencyDef[] = [
  {
    id: "crowns",
    displayName: "Ward Coins",
    shortLabel: "Coins",
    icon: "diamond",
    color: "brand",
    category: "free",
    tagline: "The main free gameplay currency.",
    earnedFrom: "Ward Shift rewards, battle results, daily play.",
    spentOn: "Apothecary Market items, boosts, Ward Unit Mastery, stamina refills.",
  },
  {
    id: "codex_shards",
    displayName: "Codex Shards",
    shortLabel: "Shards",
    icon: "book",
    color: "river",
    category: "recruitment",
    tagline: "Hero recruitment currency — earned-first, only lightly monetized.",
    earnedFrom: "Ward Shift (primary), University milestones, Clinical Cue mastery, Codex discoveries, events, boss clears.",
    spentOn: "Recruiting heroes at the University Recruitment Hall.",
  },
  {
    id: "insight_crystals",
    displayName: "Insight Crystals",
    shortLabel: "Insight",
    icon: "sparkles",
    color: "growth",
    category: "earned-premium",
    tagline: "Earned-effort premium foundation currency.",
    earnedFrom: "Clinica University lessons/research, Lotus Plate Journal wellness milestones (capped), mastery achievements.",
    spentOn: "Exchanged at the Sanctuary Bank into Refined Lotus Gems.",
  },
  {
    id: "refined_lotus_gems",
    displayName: "Refined Lotus Gems",
    shortLabel: "Refined Gems",
    icon: "flower",
    color: "protection",
    category: "earned-premium",
    tagline: "Earned premium-equivalent currency — weaker purchasing power than paid Lotus Gems.",
    earnedFrom: "Sanctuary Bank exchange (from Insight Crystals).",
    spentOn: "Selected cosmetics at a 1.2x price vs. Lotus Gems, small marketplace/listing use.",
  },
  {
    id: "lotus_gems_paid",
    displayName: "Lotus Gems",
    shortLabel: "Gems",
    icon: "diamond-outline",
    color: "storm",
    category: "paid-premium",
    tagline: "The paid premium currency placeholder. Most flexible currency in the economy.",
    earnedFrom: "Planned real-money bundles (not active — foundation only).",
    spentOn: "Cosmetics, convenience, marketplace access, monetization products.",
  },
  {
    id: "ward_sigils",
    displayName: "Ward Sigils",
    shortLabel: "Sigils",
    icon: "shield-half",
    color: "energy",
    category: "progression",
    tagline: "Ward Defense unit recruitment/progression currency, separate from hero Codex Shards.",
    earnedFrom: "Ward Defense runs, Defense Blueprints, Unit Mastery milestones.",
    spentOn: "Future Ward Defense unit recruitment/progression (foundation only).",
  },
  {
    id: "university_credits",
    displayName: "University Credits",
    shortLabel: "Credits",
    icon: "school",
    color: "growth",
    category: "progression",
    tagline: "The University's learning currency — proof of study, spent on hero promotions.",
    earnedFrom: "University lessons, Recruitment Hall rolls (10% of rolls, guaranteed in a Full Class ×10), Research Library.",
    spentOn: "Hero Certification Star promotions at the University (500 → 1,500 → 5,000 → 15,000 Credits per star).",
  },
];

// -----------------------------------------------------------------------------
// Step 2 — Premium currency hierarchy & exchange anchors
// -----------------------------------------------------------------------------
export const ECONOMY_ANCHORS = {
  lotusGemsPer99Cents: 100, // 100 Lotus Gems ≈ $0.99
  lotusGemPerUsd: 0.01, // 1 Lotus Gem ≈ $0.01
  insightCrystalsPerRefinedGem: 100, // 100 Insight Crystals = 1 Refined Lotus Gem
  refinedGemToLotusGemValue: 0.83, // 1 Refined Lotus Gem ≈ 0.83 Lotus Gem value
  refinedGemPriceMultiplier: 1.2, // Refined Lotus Gem shop price = Lotus Gem price × 1.2
};

export const ECONOMY_HIERARCHY_NOTES = [
  "Lotus Gems are the paid premium currency placeholder — most flexible, buys everything premium.",
  "Refined Lotus Gems are earned premium-equivalent currency — accepted for select purchases, but priced 1.2x higher than Lotus Gems, so they are never treated as equal.",
  "Insight Crystals reward effort, learning, wellness, and mastery. They only become spendable premium value once exchanged at the Sanctuary Bank.",
];

// -----------------------------------------------------------------------------
// Step 3 — Sanctuary Bank: Insight Crystals -> Refined Lotus Gems
// -----------------------------------------------------------------------------
export interface BankExchangeRow {
  insightCrystals: number;
  refinedLotusGems: number;
}

export const SANCTUARY_BANK_EXCHANGE_TABLE: BankExchangeRow[] = [
  { insightCrystals: 100, refinedLotusGems: 1 },
  { insightCrystals: 1000, refinedLotusGems: 11 },
  { insightCrystals: 5000, refinedLotusGems: 58 },
  { insightCrystals: 10000, refinedLotusGems: 120 },
];

export const SANCTUARY_BANK_CAPS = {
  weeklyRefinedGemCap: 50,
  monthlyRefinedGemCap: 200,
  specialEventBonusCapNote: "Special event bonus exchanges are tracked separately and do not count against the weekly/monthly caps.",
};

export const SANCTUARY_BANK_STATUS = "active" as const; // "foundation" | "active" — exchange flow is live (Push 5.5); weekly/monthly caps are informational only, not yet enforced in code.

// -----------------------------------------------------------------------------
// Step 4 — Lotus Gem bundle pricing (planned future shop offerings, not live)
// -----------------------------------------------------------------------------
export interface GemBundle {
  id: string;
  baseGems: number;
  bonusPercent: number;
  totalGems: number;
  usd: number;
  limit: string;
}

export const WEEKLY_GEM_BUNDLES: GemBundle[] = [
  { id: "weekly_1", baseGems: 100, bonusPercent: 30, totalGems: 130, usd: 0.99, limit: "1 per week" },
  { id: "weekly_2", baseGems: 500, bonusPercent: 25, totalGems: 625, usd: 4.99, limit: "2 per week" },
  { id: "weekly_3", baseGems: 1000, bonusPercent: 20, totalGems: 1200, usd: 9.99, limit: "3 per week" },
  { id: "weekly_4", baseGems: 2000, bonusPercent: 15, totalGems: 2300, usd: 19.99, limit: "4 per week" },
  { id: "weekly_5", baseGems: 5000, bonusPercent: 35, totalGems: 6750, usd: 49.99, limit: "2 per week (safer limit)" },
  { id: "weekly_6", baseGems: 10000, bonusPercent: 40, totalGems: 14000, usd: 99.99, limit: "1 per week (safer limit)" },
];

export const MONTHLY_GEM_BUNDLES: GemBundle[] = [
  { id: "monthly_1", baseGems: 100, bonusPercent: 35, totalGems: 135, usd: 0.99, limit: "1 per month" },
  { id: "monthly_2", baseGems: 500, bonusPercent: 30, totalGems: 650, usd: 4.99, limit: "2 per month" },
  { id: "monthly_3", baseGems: 1000, bonusPercent: 25, totalGems: 1250, usd: 9.99, limit: "3 per month" },
  { id: "monthly_4", baseGems: 2000, bonusPercent: 20, totalGems: 2400, usd: 19.99, limit: "4 per month" },
  { id: "monthly_5", baseGems: 5000, bonusPercent: 40, totalGems: 7000, usd: 49.99, limit: "5 per month" },
  { id: "monthly_6", baseGems: 10000, bonusPercent: 45, totalGems: 14500, usd: 99.99, limit: "5 per month" },
];

export const GEM_BUNDLE_STATUS = "planned" as const; // Never "purchasable" without a real payment integration.

// -----------------------------------------------------------------------------
// Step 5 — Cosmetic price tiers (anchors, not live items)
// -----------------------------------------------------------------------------
export interface PriceTier {
  id: string;
  label: string;
  lotusGemsMin: number;
  lotusGemsMax: number;
  refinedAllowed: boolean;
  note?: string;
}

export const COSMETIC_PRICE_TIERS: PriceTier[] = [
  { id: "small", label: "Small cosmetics", lotusGemsMin: 80, lotusGemsMax: 300, refinedAllowed: true },
  { id: "standard", label: "Standard cosmetics", lotusGemsMin: 700, lotusGemsMax: 1600, refinedAllowed: true },
  { id: "premium", label: "Premium cosmetics", lotusGemsMin: 1800, lotusGemsMax: 5000, refinedAllowed: true },
  { id: "prestige", label: "Limited prestige items", lotusGemsMin: 5000, lotusGemsMax: 20000, refinedAllowed: false, note: "Usually Lotus Gems only." },
];

export interface CosmeticExample {
  name: string;
  lotusGemsMin: number;
  lotusGemsMax: number;
  refinedNote: string;
}

export const COSMETIC_PRICE_EXAMPLES: CosmeticExample[] = [
  { name: "Simple profile frame", lotusGemsMin: 80, lotusGemsMax: 150, refinedNote: "100–180 Refined Lotus Gems" },
  { name: "Basic title/banner", lotusGemsMin: 100, lotusGemsMax: 200, refinedNote: "120–240 Refined Lotus Gems" },
  { name: "Basic hero recolor", lotusGemsMin: 300, lotusGemsMax: 500, refinedNote: "360–600 Refined Lotus Gems" },
  { name: "Standard hero skin", lotusGemsMin: 700, lotusGemsMax: 1200, refinedNote: "840–1440 Refined Lotus Gems" },
  { name: "Clinical Art visual effect", lotusGemsMin: 900, lotusGemsMax: 1600, refinedNote: "1080–1920 Refined Lotus Gems" },
  { name: "Premium animated hero skin", lotusGemsMin: 1800, lotusGemsMax: 2800, refinedNote: "2160–3360 Refined Lotus Gems" },
  { name: "Premium Realm theme", lotusGemsMin: 3000, lotusGemsMax: 5000, refinedNote: "3600–6000 Refined Lotus Gems" },
  { name: "Limited event skin", lotusGemsMin: 3000, lotusGemsMax: 5000, refinedNote: "Usually not Refined at launch" },
  { name: "Animated limited skin", lotusGemsMin: 5000, lotusGemsMax: 8000, refinedNote: "Rerun-only for Refined, at higher prices" },
  { name: "Full limited event set", lotusGemsMin: 8000, lotusGemsMax: 12000, refinedNote: "Lotus Gems only" },
  { name: "Mythic cosmetic collection", lotusGemsMin: 12000, lotusGemsMax: 20000, refinedNote: "Lotus Gems only" },
];

// -----------------------------------------------------------------------------
// Step 6 — Monetization product placeholders (no real purchase flow)
// -----------------------------------------------------------------------------
export interface MonetizationProduct {
  id: string;
  name: string;
  priceUsd: string;
  cadence: "one-time" | "monthly" | "seasonal" | "weekly";
  benefits: string[];
  status: "placeholder";
}

export const MONETIZATION_PRODUCTS: MonetizationProduct[] = [
  {
    id: "ad_free_blessing",
    name: "Ad-Free Blessing",
    priceUsd: "$6.99–$7.99",
    cadence: "one-time",
    benefits: ["Removes optional ads (once ads exist)", "Cosmetic badge", "No power advantage"],
    status: "placeholder",
  },
  {
    id: "sanctuary_pass",
    name: "Sanctuary Pass",
    priceUsd: "$4.99/month",
    cadence: "monthly",
    benefits: ["Daily Lotus Gems", "Cosmetic reward track", "Small stamina convenience", "Extra University Credits", "Extra Ward Coins", "Profile frame"],
    status: "placeholder",
  },
  {
    id: "premium_event_pass",
    name: "Premium Event/Battle Pass",
    priceUsd: "$9.99",
    cadence: "seasonal",
    benefits: ["Cosmetic track", "Extra materials", "Lore", "Profile frame", "Capped Codex Shards"],
    status: "placeholder",
  },
  {
    id: "weekly_healer_kit",
    name: "Weekly Healer Kit",
    priceUsd: "$1.99–$2.99",
    cadence: "weekly",
    benefits: ["Small Lotus Gem bundle", "Stamina items", "Ward Coins", "Basic upgrade materials"],
    status: "placeholder",
  },
];

// -----------------------------------------------------------------------------
// Step 7 — Codex Shard monetization & recruitment rules
// -----------------------------------------------------------------------------
export const CODEX_SHARD_RULES = {
  earnedFirst: true,
  primarySource: "Ward Shift",
  bonusSources: [
    "Clinica University milestones",
    "Clinical Cue mastery",
    "Codex discoveries",
    "Events",
    "Achievements",
    "Boss clears",
    "Faction/world boss rewards (later)",
  ],
  neverSoldUnlimited: true,
  recruitCosts: { singleRecruit: 100, tenPullGuaranteed: 1000 },
  cappedPaidBundle: {
    id: "weekly_codex_bundle",
    name: "Weekly Codex Bundle",
    codexShards: 300,
    priceLotusGems: 300,
    limit: "1 per week",
  },
  passRewardRange: "1,000–2,000 Codex Shards total over a monthly/event pass period",
};

// -----------------------------------------------------------------------------
// Step 8 — Gacha/progression currency separation
// -----------------------------------------------------------------------------
export interface GachaTypeDoc {
  id: string;
  name: string;
  currency: string;
  location: string;
  monetizationSafety: "earned-first" | "capped-supplemental" | "avoid-paid-only" | "safe-future-monetization";
  note: string;
}

export const GACHA_TYPES: GachaTypeDoc[] = [
  {
    id: "hero_recruitment",
    name: "Hero Recruitment",
    currency: "Codex Shards",
    location: "Clinica University — Recruitment Hall",
    monetizationSafety: "earned-first",
    note: "Only lightly monetized via capped bundles/passes. Never unlimited paid recruitment.",
  },
  {
    id: "ward_defense_units",
    name: "Ward Defense Unit Recruitment",
    currency: "Ward Sigils",
    location: "Ward Defense progression (foundation)",
    monetizationSafety: "capped-supplemental",
    note: "Kept separate from hero Codex Shards so the two gacha systems are never confused.",
  },
  {
    id: "equipment",
    name: "Equipment",
    currency: "Crafting materials, drops, Realm production",
    location: "Crafting, world boss drops, event drops, Realm",
    monetizationSafety: "avoid-paid-only",
    note: "No pure paid equipment gacha for now — equipment should not be paid-only.",
  },
  {
    id: "cosmetic_gacha",
    name: "Cosmetic Gacha",
    currency: "Lotus Gems or Cosmetic Tickets",
    location: "Shop (future)",
    monetizationSafety: "safe-future-monetization",
    note: "Rewards skins, auras, profile frames, Realm decorations, non-power collectibles. The safest gacha to monetize.",
  },
];

// -----------------------------------------------------------------------------
// Step 9 — Sanctuary Bazaar (future placeholder only, no live trading)
// -----------------------------------------------------------------------------
export const SANCTUARY_BAZAAR_STATUS = "future-placeholder" as const;

export const SANCTUARY_BAZAAR_TRADEABLE = [
  "Limited event cosmetics",
  "Duplicate skins",
  "Realm decorations",
  "Event materials",
  "Non-core crafting materials",
  "Rare collectibles",
  "Some equipment materials",
  "Selected shard bundles (with caps)",
];

export const SANCTUARY_BAZAAR_NON_TRADEABLE = [
  "Achievement badges",
  "Wellness milestone badges",
  "Paid-only subscription benefits",
  "Core story unlocks",
  "Unlimited Codex Shards",
  "Exclusive strongest heroes",
  "Player accounts",
];

// -----------------------------------------------------------------------------
// Step 10 — Future Marketplace premium currency rules (not live)
// -----------------------------------------------------------------------------
export const MARKETPLACE_STATUS = "future-placeholder" as const;

export const MARKETPLACE_CURRENCY_RULES = {
  buyerPrimaryCurrency: "Lotus Gems",
  refinedGemBuyerCapPercent: 20, // Buyer may use Refined Lotus Gems for up to 20% of a purchase (optional, later rule).
  refinedGemDailyMarketplaceCap: 50,
  sellerFeeCurrencies: ["Lotus Gems", "Refined Lotus Gems"],
};

export interface MarketplaceTaxTier {
  id: "normal" | "rare_limited";
  label: string;
  buyerTaxPercent: number;
  sellerTaxPercent: number;
}

export const MARKETPLACE_TAX_TIERS: MarketplaceTaxTier[] = [
  { id: "normal", label: "Normal premium trades", buyerTaxPercent: 3, sellerTaxPercent: 3 },
  { id: "rare_limited", label: "Rare / limited items", buyerTaxPercent: 5, sellerTaxPercent: 5 },
];

export interface MarketplaceTaxExample {
  tier: "normal" | "rare_limited";
  itemPrice: number;
  buyerPays: number;
  sellerReceives: number;
  systemRemoves: number;
}

export const MARKETPLACE_TAX_EXAMPLES: MarketplaceTaxExample[] = [
  { tier: "normal", itemPrice: 300, buyerPays: 309, sellerReceives: 291, systemRemoves: 18 },
  { tier: "rare_limited", itemPrice: 1000, buyerPays: 1050, sellerReceives: 950, systemRemoves: 100 },
];

// -----------------------------------------------------------------------------
// Step 11 — Listing fees & marketplace safeguards (not live)
// -----------------------------------------------------------------------------
export const LISTING_FEE_RULES = {
  feePercent: 1,
  minFee: 1,
  maxFee: 20,
  currencies: ["Lotus Gems", "Refined Lotus Gems"],
  refundOnSellPercent: 50,
  lostOnExpire: true,
};

export const MARKETPLACE_SAFEGUARDS = [
  "New accounts cannot trade for 7 days",
  "Must reach Player Level 10 to trade",
  "Daily listing limit",
  "Weekly premium trade volume cap",
  "Price floor/ceiling (50%–300% of value)",
  "Event items tradeable only 7–14 days after the event ends",
  "High-value trade confirmation step",
  "Some items are account-bound and never tradeable",
  "Suspicious trades are flagged",
];

export const MARKETPLACE_PRICE_BOUNDS = { floorPercentOfValue: 50, ceilingPercentOfValue: 300 };

// -----------------------------------------------------------------------------
// Step 12 — Material economy sources, organized by mode
// -----------------------------------------------------------------------------
export interface MaterialSourceDoc {
  mode: string;
  rewards: string[];
}

export const MATERIAL_SOURCES: MaterialSourceDoc[] = [
  { mode: "Ward Shift", rewards: ["Player EXP", "Hero EXP", "Ward Coins", "Codex Shards", "Clinical Certificates", "Chapter materials", "Hero shards"] },
  { mode: "Ward Defense", rewards: ["Ward Sigils", "Vital Lantern Cores", "Defense Blueprints", "Enemy Essence", "Unit Mastery materials"] },
  { mode: "Clinica University", rewards: ["University Credits", "Skill Books", "Class Manuals", "Research Scrolls", "Insight Crystals"] },
  { mode: "Lotus Plate Journal", rewards: ["Nourishment Petals", "Recipe Cards", "Nutrition Garden Seeds", "Wellness Badges", "Insight Crystals (capped)"] },
  { mode: "Realm", rewards: ["Ward Timber", "Healing Clay", "Spirit Stone", "Sterile Kit Bundles", "Herb Bundles", "Lab Reagents", "Building Blueprints"] },
  { mode: "Faction / World Boss (later)", rewards: ["Faction Marks", "Epidemic Tokens", "Supply Crates", "World Boss Relics", "Rare Research Samples", "Limited Set Pieces"] },
];

// -----------------------------------------------------------------------------
// Step 13 — Player & hero progression economy rules
// -----------------------------------------------------------------------------
export const PLAYER_PROGRESSION_RULES = {
  currencies: ["Player EXP", "University Credits", "Class Manuals", "Ascension Seals"],
  classChangeLevels: [10, 20, 30],
  classChangeRequires: ["Player level", "Chapter progression", "University Credits", "Class Manual", "Ascension Seal", "University milestone"],
  paidCurrencyCanBuyClassAdvancement: false,
};

export const HERO_PROGRESSION_RULES = {
  currencies: ["Hero EXP", "Hero Shards", "Class Trainees", "Skill Books", "Clinical Certificates", "Equipment materials", "Ward Coins"],
  paidCurrencyCanStarUpHeroes: false,
  safePaidConvenienceLater: ["Capped material bundles", "Cosmetics", "Training queue slots", "Weekly limited support packs"],
};

// -----------------------------------------------------------------------------
// Step 14 — Limited event & Epidemic/world boss economy notes (future)
// -----------------------------------------------------------------------------
export const EVENT_ECONOMY_NOTES = {
  limitedEventRewards: ["Limited skins", "Decorations", "Lore pages", "Profile titles", "Set pieces", "Event materials", "Insight Crystals", "Faction Marks"],
  eventItemTradeableWindow: "7–14 days after the event ends",
  epidemicConnectsModes: {
    wardShift: "Treats cases",
    wardDefense: "Protects supply routes",
    university: "Researches countermeasures",
    realm: "Buildings produce supplies",
    faction: "Secures regions",
    worldBoss: "Unlocks when server progress reaches a threshold",
  },
  epidemicRewards: ["Epidemic Tokens", "Supply Crates", "World Boss Relics", "Limited skins", "Limited equipment set pieces", "Faction Marks", "Insight Crystals", "Rare crafting materials"],
};

// -----------------------------------------------------------------------------
// Step 15 — Final economy guardrails
// -----------------------------------------------------------------------------
export const ECONOMY_GUARDRAILS: string[] = [
  "Lotus Gems buy flexibility, cosmetics, convenience, and marketplace access.",
  "Refined Lotus Gems let free players access selected premium value, at weaker purchasing power than Lotus Gems.",
  "Insight Crystals reward effort, learning, wellness, and mastery.",
  "Codex Shards are earned-first and only lightly monetized, with caps.",
  "Hero power progression is not directly purchasable without limits.",
  "The marketplace creates Lotus Gem demand, but lets free players earn real premium currency by selling rare earned items.",
  "Limited items support retention but are never mandatory for normal story progression.",
];

export function usdForGems(gems: number): number {
  return Math.round(gems * ECONOMY_ANCHORS.lotusGemPerUsd * 100) / 100;
}
