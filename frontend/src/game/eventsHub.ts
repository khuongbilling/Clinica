// ────────────────────────────────────────────────────────────
// EVENT TRACKS + MONETIZATION UI FOUNDATION (Push 7)
// ────────────────────────────────────────────────────────────
// This module is DATA + DOCUMENTATION only. It adds no gameplay, no
// currencies, no purchase flow, no billing, and no platform integrations.
// Every entry below is a visual/UX placeholder for the future Event Hub:
//   - `MonetizationCardDef[]` — offer cards for the (future) storefront.
//     Every single one MUST carry a `badge` of "Preview" | "Planned" |
//     "Coming Soon" | "Not Active" and MUST NOT be wired to any purchase,
//     billing SDK, or platform IAP call. Tapping one only opens an
//     info sheet explaining it is not yet available.
//   - `EventTrackDef[]` — gameplay event previews (Daily Orders, Weekly
//     Trials, etc). Each event previews a FREE reward track and a
//     PREMIUM reward track, but the premium track is cosmetic/lore/
//     material only — never exclusive power, stat boosts, or pay-to-win
//     advantages. Progress values below are static preview numbers for
//     layout purposes; there is no live event engine yet.
//
// Illustrated art direction stays consistent with modeHub.ts: bright
// anime/donghua fantasy-medical style, jade/gold/lotus accents, painterly
// shading — NOT dark generic gradients, NOT western comic-book style.
// ────────────────────────────────────────────────────────────

export type MonetizationBadge = "Preview" | "Planned" | "Coming Soon" | "Not Active";

export interface MonetizationCardDef {
  id: string;
  title: string;
  subtitle: string;
  icon: string; // Ionicons glyph
  accentColor: string;
  badge: MonetizationBadge;
  detail: string;
  artBrief: string;
}

// ---------- Monetization preview cards (left side) ----------
// None of these are wired to a store, billing SDK, or platform IAP. All are
// purely descriptive placeholders so the future storefront layout can be
// designed against real copy before any payment integration exists.
export const MONETIZATION_CARDS: MonetizationCardDef[] = [
  {
    id: "ad-free-blessing",
    title: "Ad-Free Blessing",
    subtitle: "Remove all optional ads across the Sanctuary.",
    icon: "sparkles-outline",
    accentColor: "#D4AF37",
    badge: "Not Active",
    detail:
      "A one-time blessing that would quiet every optional ad placement. No ads currently run in Clinica, so this card is purely a layout placeholder — nothing to buy, nothing to remove yet.",
    artBrief: "A soft golden ward-sigil settling over the Sanctuary skyline, quieting distant noise motes.",
  },
  {
    id: "sanctuary-pass",
    title: "Sanctuary Pass",
    subtitle: "A seasonal track of cosmetic and lore rewards.",
    icon: "ribbon-outline",
    accentColor: "#A78BFA",
    badge: "Planned",
    detail:
      "Planned as a seasonal pass with two parallel tracks — Free and Pass — both granting cosmetics, lore, and materials only. No exclusive power, stat boosts, or gameplay advantages are planned for the Pass track.",
    artBrief: "A folded jade-and-gold ceremonial scroll pass, unopened, resting on a lotus pedestal.",
  },
  {
    id: "weekly-healer-kit",
    title: "Weekly Healer Kit",
    subtitle: "A bundle of convenience items, refreshed weekly.",
    icon: "medkit-outline",
    accentColor: "#5B9BD5",
    badge: "Coming Soon",
    detail:
      "Envisioned as a modest weekly bundle of Clinical Supplies and cosmetic flair for returning healers. Still in design — no price, contents, or purchase flow exist yet.",
    artBrief: "A neatly wrapped healer's satchel with soft glowing supply icons peeking from the flap.",
  },
  {
    id: "limited-cosmetic-bundle",
    title: "Limited Cosmetic Bundle",
    subtitle: "Rotating hero skins and Realm decorations.",
    icon: "color-palette-outline",
    accentColor: "#F472B6",
    badge: "Coming Soon",
    detail:
      "A future rotating bundle of purely cosmetic hero skins and Realm decorations. Cosmetics never affect stats, battle outcomes, or progression speed — this preview card has no live rotation yet.",
    artBrief: "A display rack of shimmering donghua-style hero outfits and miniature Realm ornaments.",
  },
  {
    id: "premium-currency-offers",
    title: "Premium Currency Offers",
    subtitle: "Optional Gem bundles for cosmetics and passes.",
    icon: "diamond-outline",
    accentColor: "#22D3EE",
    badge: "Not Active",
    detail:
      "A placeholder for optional Gem bundles that would only ever be spendable on cosmetics, passes, and convenience — never on power. No billing, storefront, or platform integration is connected. Nothing can be purchased today.",
    artBrief: "A cluster of faceted lotus-cut gems glowing softly on a ceremonial tray, uncollected.",
  },
  {
    id: "founder-support",
    title: "Support Clinica",
    subtitle: "Help fund free clinical education for everyone.",
    icon: "heart-outline",
    accentColor: "#F43F5E",
    badge: "Planned",
    detail:
      "Clinica is built to make real clinical reasoning education accessible and free. A future 'Founder' or direct-support option would let players contribute to ongoing development and server costs, with no gameplay advantage granted in return — just our sincere gratitude and a small profile badge.",
    artBrief: "A glowing lotus lantern held up toward a starlit Sanctuary skyline, warmly illuminating the ward.",
  },
];

export type EventCadence = "daily" | "weekly" | "monthly" | "seasonal" | "special";

export interface EventRewardPreview {
  freeTrack: string; // short description of the free reward track
  premiumTrack: string; // premium track placeholder — cosmetic/lore/material ONLY
  milestoneLabel: string; // e.g. "3 / 7 milestones"
  milestoneProgress: number; // 0..1 static preview fill, not live progress
  loreReward: string;
  cosmeticReward: string;
  materialReward: string;
}

export interface EventTrackDef {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  cadence: EventCadence;
  badge: MonetizationBadge;
  rewards: EventRewardPreview;
  artBrief: string;
}

// ---------- Gameplay event track cards (right side) ----------
// Every event previews a Free + Premium track. The Premium track is
// deliberately restricted to cosmetic/lore/material rewards — no exclusive
// power, no stat boosts, no pay-to-win. `milestoneProgress` is a static
// preview number for layout only; there is no live event engine yet.
export const EVENT_TRACKS: EventTrackDef[] = [
  {
    id: "daily-orders",
    title: "Daily Orders",
    subtitle: "Short daily objectives refreshed every shift.",
    icon: "sunny-outline",
    accentColor: "#F59E0B",
    cadence: "daily",
    badge: "Preview",
    rewards: {
      freeTrack: "Crowns + Codex Shards for completing 3 daily orders.",
      premiumTrack: "Cosmetic order-ticket border + bonus Lore Fragment.",
      milestoneLabel: "0 / 3 orders",
      milestoneProgress: 0,
      loreReward: "A short ward-log entry from a supporting hero.",
      cosmeticReward: "Order-ticket frame decoration.",
      materialReward: "Codex Shards, Ward Coins.",
    },
    artBrief: "A cheerful healer checking off glowing order tickets on a bright morning ward board.",
  },
  {
    id: "weekly-trials",
    title: "Weekly Trials",
    subtitle: "A rotating gauntlet of tougher clinical scenarios.",
    icon: "flash-outline",
    accentColor: "#EF4444",
    cadence: "weekly",
    badge: "Preview",
    rewards: {
      freeTrack: "Hero EXP + Ward Coins for each trial cleared.",
      premiumTrack: "Cosmetic trial banner + extra Lore Fragment.",
      milestoneLabel: "0 / 5 trials",
      milestoneProgress: 0,
      loreReward: "A trial commendation scroll with hero flavor text.",
      cosmeticReward: "Trial victory banner.",
      materialReward: "Hero EXP, Unit Shards.",
    },
    artBrief: "Healers bracing together at the entrance of a glowing weekly trial gate.",
  },
  {
    id: "monthly-milestones",
    title: "Monthly Milestones",
    subtitle: "A long-arc track of cumulative shift progress.",
    icon: "calendar-outline",
    accentColor: "#34D399",
    cadence: "monthly",
    badge: "Preview",
    rewards: {
      freeTrack: "Crowns and materials at each milestone tier.",
      premiumTrack: "Cosmetic monthly emblem + bonus material chest.",
      milestoneLabel: "0 / 10 tiers",
      milestoneProgress: 0,
      loreReward: "A monthly Sanctuary chronicle page.",
      cosmeticReward: "Monthly emblem badge for the Profile screen.",
      materialReward: "Crowns, Refined Gems.",
    },
    artBrief: "A calendar scroll unrolling across a sunlit Sanctuary courtyard, milestones lighting up in gold.",
  },
  {
    id: "character-lore-event",
    title: "Character Lore Event",
    subtitle: "A themed story arc spotlighting one hero.",
    icon: "book-outline",
    accentColor: "#A78BFA",
    cadence: "seasonal",
    badge: "Coming Soon",
    rewards: {
      freeTrack: "Story panels + a themed Codex entry.",
      premiumTrack: "Cosmetic hero alt-portrait + extended epilogue panel.",
      milestoneLabel: "0 / 6 panels",
      milestoneProgress: 0,
      loreReward: "A full illustrated backstory arc for the spotlighted hero.",
      cosmeticReward: "Alternate hero portrait frame.",
      materialReward: "Codex Shards.",
    },
    artBrief: "A spotlighted hero framed by soft lantern light, panels of their story unfolding around them.",
  },
  {
    id: "boss-challenge",
    title: "Boss Challenge",
    subtitle: "A limited-time high-stakes boss rematch.",
    icon: "flame-outline",
    accentColor: "#F97316",
    cadence: "special",
    badge: "Coming Soon",
    rewards: {
      freeTrack: "Rare materials scaled to clear time.",
      premiumTrack: "Cosmetic victory frame + bonus Lore Fragment.",
      milestoneLabel: "0 / 3 clears",
      milestoneProgress: 0,
      loreReward: "A boss encounter epilogue scene.",
      cosmeticReward: "Boss-victory portrait frame.",
      materialReward: "Rare materials, Codex Shards.",
    },
    artBrief: "A healer team standing resolute before a towering corrupted pathology boss under dramatic light.",
  },
  {
    id: "university-exam-event",
    title: "University Exam Event",
    subtitle: "A timed review of recent Clinical Cues.",
    icon: "school-outline",
    accentColor: "#5B9BD5",
    cadence: "seasonal",
    badge: "Coming Soon",
    rewards: {
      freeTrack: "University Credits for each correct review question.",
      premiumTrack: "Cosmetic honor-roll seal + bonus Lore Fragment.",
      milestoneLabel: "0 / 8 questions",
      milestoneProgress: 0,
      loreReward: "A University commencement note from a mentor NPC.",
      cosmeticReward: "Honor-roll seal for the Profile screen.",
      materialReward: "University Credits, Class Manuals.",
    },
    artBrief: "Students in fantasy-medical uniforms reviewing glowing exam scrolls in a sunlit lecture hall.",
  },
  {
    id: "ward-defense-season",
    title: "Ward Defense Season",
    subtitle: "A themed seasonal ladder for Ward Defense: Code Rush.",
    icon: "shield-checkmark-outline",
    accentColor: "#06B6D4",
    cadence: "seasonal",
    badge: "Coming Soon",
    rewards: {
      freeTrack: "Ward Coins and Unit Shards per wave milestone.",
      premiumTrack: "Cosmetic seasonal unit skin + bonus Lore Fragment.",
      milestoneLabel: "0 / 12 waves",
      milestoneProgress: 0,
      loreReward: "A seasonal Vital Lantern chronicle entry.",
      cosmeticReward: "Seasonal defender unit skin.",
      materialReward: "Ward Coins, Unit Shards.",
    },
    artBrief: "Guardian units holding a seasonal-themed Vital Lantern line against a colorful disease-spirit wave.",
  },
];

export const MONETIZATION_BADGE_COLOR: Record<MonetizationBadge, string> = {
  Preview: "#5B9BD5",
  Planned: "#A78BFA",
  "Coming Soon": "#F59E0B",
  "Not Active": "#7A8494",
};
