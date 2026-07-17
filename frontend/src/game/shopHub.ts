// ────────────────────────────────────────────────────────────
// SHOP HUB — shared data for the Apothecary Market hub.
//
// P24 — Shop Access Cleanup and Locked Content Visibility:
//   • featureGate: progression feature ID that must be unlocked to access the
//     section. Gated sections display as locked BannerCards on the hub and are
//     route-guarded in shop-section/[id].tsx.
//   • minLevelToShow: hide the section entirely (not even Coming Soon) when
//     the player hasn't reached this level yet — prevents overwhelming early
//     players with far-future content.
//
// Unlock ladder (mirrors FEATURE_UNLOCKS):
//   Lv3  → shop unlocks → apothecary-market (consumables/refills) + sanctuary-bank
//   Lv4  → ward_defense → summoning-altar (WD recruit + WD boosts) + regalia-upgrades
//   Lv7  → world_event  → event-shop (coming_soon, shown from Lv5)
//   TBD  → night-market (no level gate, content-pending)
// ────────────────────────────────────────────────────────────

import { ModeCardDef } from "@/src/game/modeHub";

/** Content groups (legacy shop tabs) that a section page can render, in order. */
export type ShopGroupId =
  | "consumables"
  | "ward"
  | "refills"
  | "recruit"
  | "upgrades"
  | "skins"
  | "premium";

export interface ShopSectionDef extends ModeCardDef {
  /** Legacy content groups rendered on this section's page, in display order. */
  groups?: ShopGroupId[];
  /**
   * P24: Progression feature ID (from FEATURE_UNLOCKS) that must be unlocked
   * before this section is accessible. Gated sections appear on the hub as
   * locked cards and are blocked at the route level.
   * If omitted the section is always accessible once the shop itself unlocks.
   */
  featureGate?: string;
  /**
   * P24: Minimum player level to show this section at all (even as Coming Soon).
   * Sections below this threshold are hidden entirely so early players aren't
   * shown a long list of far-future content.
   * If omitted the section is always shown once the shop unlocks (Lv3).
   */
  minLevelToShow?: number;
}

export const SHOP_SECTIONS: ShopSectionDef[] = [
  // ── GENERAL (Lv3, always open once shop unlocks) ──────────────────────────
  {
    id: "apothecary-market",
    title: "Apothecary Market",
    // P24: "ward" group removed — WD boosts require Ward Defense to be useful.
    // They are now under the Summoning Altar (also WD-gated). General supply
    // stays open from Lv3 so new players have something to spend Crowns on.
    subtitle: "Battle consumables and Stamina refills — your everyday clinical kit.",
    icon: "flask",
    accentColor: "#34D399",
    status: "active",
    size: "large",
    route: "/shop-section/apothecary-market",
    rewardPreview: "Consumables · Stamina Refills",
    imageKey: "apothecary-market",
    groups: ["consumables", "refills"],
    artBrief:
      "A bustling apothecary market stall of glowing potions, herbs, and clinical supplies.",
  },

  // ── CURRENCY / BANK (Lv3, always open — currency info is useful early) ────
  {
    id: "sanctuary-bank",
    title: "Sanctuary Bank",
    subtitle: "Exchange currencies and explore the premium economy foundation.",
    icon: "diamond-outline",
    accentColor: "#5B9BD5",
    status: "active",
    size: "medium",
    route: "/shop-section/sanctuary-bank",
    rewardPreview: "Currency Exchange · Premium Preview",
    imageKey: "sanctuary-bank",
    groups: ["premium"],
    artBrief:
      "A grand jade-and-gold treasury vault with glowing crystals and exchange scales.",
  },

  // ── WARD DEFENSE (Lv4 gate) ───────────────────────────────────────────────
  {
    id: "summoning-altar",
    title: "Summoning Altar",
    // P24: featureGate: "ward_defense" — WD units and WD boosts are useless
    // before Ward Defense unlocks. Moved "ward" group here from apothecary-market
    // so WD boosts and WD recruitment are both gated together at Lv4.
    subtitle: "Recruit Ward Defense healers and stock up on combat boosts for your next run.",
    icon: "sparkles",
    accentColor: "#A78BFA",
    status: "active",
    size: "medium",
    route: "/shop-section/summoning-altar",
    rewardPreview: "Healer Units · Ward Boosts · Unit Shards",
    imageKey: "summoning-altar",
    groups: ["recruit", "ward"],
    featureGate: "ward_defense",
    artBrief:
      "A radiant summoning altar with a healer spirit materializing in golden light.",
  },

  // ── COSMETICS / UPGRADES (Lv4 gate — mid-game milestone) ─────────────────
  {
    id: "regalia-upgrades",
    title: "Regalia & Upgrades",
    // P24: featureGate: "ward_defense" — permanent upgrades and skins are
    // mid-game content. Keeping them hidden from Lv3 players who can't afford
    // them anyway prevents early information overload.
    subtitle: "Permanent battle upgrades and cosmetic hero auras — unlocks at Ward Defense.",
    icon: "color-palette",
    accentColor: "#D4AF37",
    status: "active",
    size: "medium",
    route: "/shop-section/regalia-upgrades",
    rewardPreview: "Permanent Buffs · Cosmetic Skins",
    imageKey: "regalia-upgrades",
    groups: ["upgrades", "skins"],
    featureGate: "ward_defense",
    artBrief:
      "Ornate glowing regalia and shimmering cosmetic auras on display stands.",
  },

  // ── EVENT (Lv7 gate, shown as Coming Soon from Lv5) ──────────────────────
  {
    id: "event-shop",
    title: "Event Exchange",
    // P24: featureGate: "world_event" — Miasma Bloom and other world events
    // unlock at Lv7. Hidden entirely below Lv5 so early players aren't shown
    // far-future shop content; shown as Coming Soon from Lv5 onward.
    subtitle: "Trade Miasma Bloom Tokens for rare rewards during active world events.",
    icon: "star-half",
    accentColor: "#F97316",
    status: "coming_soon",
    size: "medium",
    imageKey: "night-market",
    featureGate: "world_event",
    minLevelToShow: 5,
    artBrief:
      "A glowing orange event stall with rare token rewards and a community board in the background.",
  },

  // ── NIGHT MARKET (no level gate — content-pending) ────────────────────────
  {
    id: "night-market",
    title: "Night Market",
    subtitle: "A rotating lantern-lit market of limited wares — coming soon.",
    icon: "moon",
    accentColor: "#7C3AED",
    status: "coming_soon",
    size: "medium",
    imageKey: "night-market",
    artBrief:
      "A mystical fantasy night market under a full moon, rows of glowing paper lanterns and stalls.",
  },
];

/** Resolve a shop section by id (used by the shared page `/shop-section/[id]`). */
export function findShopSection(id: string | undefined | null): ShopSectionDef | undefined {
  if (!id) return undefined;
  return SHOP_SECTIONS.find((s) => s.id === id);
}
