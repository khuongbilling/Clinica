// ────────────────────────────────────────────────────────────
// SHOP HUB — shared data for the Apothecary Market hub. Mirrors the Ward
// Operations (Shift) hub pattern: the Shop tab is a hub of illustrated
// donghua banners, and each active banner branches to its own destination
// page at `/shop-section/<id>`. "Coming Soon" banners (e.g. Night Market)
// carry copy + art only and surface an inline notice on the hub (no route).
//
// Balanced grouping of the legacy single-screen shop tabs:
//   apothecary-market → consumables + ward-defense boosts + refills
//   summoning-altar   → gacha recruit + unit mastery
//   regalia-upgrades  → permanent upgrades + cosmetic skins
//   sanctuary-bank    → currencies, exchange, bazaar & premium bundles
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
}

export const SHOP_SECTIONS: ShopSectionDef[] = [
  {
    id: "apothecary-market",
    title: "Apothecary Market",
    subtitle: "Battle consumables, Ward Defense boosts, and Stamina refills.",
    icon: "flask",
    accentColor: "#34D399",
    status: "active",
    size: "large",
    route: "/shop-section/apothecary-market",
    rewardPreview: "Consumables · Ward Boosts · Refills",
    imageKey: "apothecary-market",
    groups: ["consumables", "ward", "refills"],
    artBrief:
      "A bustling apothecary market stall of glowing potions, herbs, and clinical supplies.",
  },
  {
    id: "summoning-altar",
    title: "Summoning Altar",
    subtitle: "Recruit Ward Defense healers and raise their Unit Mastery.",
    icon: "sparkles",
    accentColor: "#A78BFA",
    status: "active",
    size: "medium",
    route: "/shop-section/summoning-altar",
    rewardPreview: "Healer Units · Unit Shards",
    imageKey: "summoning-altar",
    groups: ["recruit"],
    artBrief:
      "A radiant summoning altar with a healer spirit materializing in golden light.",
  },
  {
    id: "regalia-upgrades",
    title: "Regalia & Upgrades",
    subtitle: "Permanent account upgrades and cosmetic hero auras.",
    icon: "color-palette",
    accentColor: "#D4AF37",
    status: "active",
    size: "medium",
    route: "/shop-section/regalia-upgrades",
    rewardPreview: "Permanent Buffs · Cosmetic Skins",
    imageKey: "regalia-upgrades",
    groups: ["upgrades", "skins"],
    artBrief:
      "Ornate glowing regalia and shimmering cosmetic auras on display stands.",
  },
  {
    id: "sanctuary-bank",
    title: "Sanctuary Bank",
    subtitle: "Exchange currencies and preview premium bundles.",
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
