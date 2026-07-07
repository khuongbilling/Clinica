// ────────────────────────────────────────────────────────────────────────────
// WORLD EVENT FOUNDATION — Push 10: Miasma Bloom
// ────────────────────────────────────────────────────────────────────────────
// This module is DATA + DOCUMENTATION only. It does not wire any gameplay,
// currencies, purchases, multiplayer, leaderboards, or online synchronisation.
// All `progress` values are static preview numbers for UI layout purposes.
// Every entry carries a `badge` of "Preview" | "Planned" | "Coming Soon".
//
// Art direction: donghua / manhwa / anime (Genshin-style cel shading, luminous
// teal-green-gold palette, soft clean linework). NOT western comic-book style.
// ────────────────────────────────────────────────────────────────────────────

export type WorldEventBadge = "Preview" | "Planned" | "Coming Soon";

// ── Lore ────────────────────────────────────────────────────────────────────

export interface WorldEventLore {
  title: string;
  subtitle: string;
  flavor: string;
  chapter: string;
  setting: string;
  threat: string;
  hook: string;
}

export const MIASMA_BLOOM_LORE: WorldEventLore = {
  title: "Miasma Bloom",
  subtitle: "A Realm-Wide Epidemic Event",
  flavor:
    "The Verdant Miasma — a luminous, spore-bearing fungal entity — has drifted from the Outer Wilds into the Sanctuary districts, seeding disease-bloom outbreaks across every ward. It is not a single patient, not a single battle. It is a tide.",
  chapter: "Interlude I — Between the Wards",
  setting:
    "The Sanctuary of Clinica, Grand Ward Atrium and its surrounding districts",
  threat:
    "Miasma Bloom is a slow-moving epidemic — it does not attack directly but corrupts the land itself, weakening healer effectiveness and multiplying disease-monster pressure until the Sanctuary's Vital Lantern dims. Every system in the Sanctuary must coordinate: ward shifts slow the spread, Ward Defense holds the perimeter, the University develops countermeasures, the Realm generates supplies, the Lotus Journal sustains healer wellness, and the Faction Embassy coordinates sector contributions.",
  hook:
    "The Bloom only recedes when Sanctuary-wide pressure crosses the Global Containment Threshold — a collective milestone tracked across all active healers' contributions.",
};

// ── Event State (static preview) ─────────────────────────────────────────────

export interface WorldEventPhase {
  id: string;
  label: string;
  description: string;
  thresholdLabel: string;
  thresholdProgress: number; // 0..1 (static preview)
  badge: WorldEventBadge;
}

export const MIASMA_BLOOM_PHASES: WorldEventPhase[] = [
  {
    id: "phase_seedfall",
    label: "Phase I — Seedfall",
    description:
      "Initial spore dispersal detected. Ward shifts are encountering mutated Bloom-variants of known disease monsters. Containment protocols activated.",
    thresholdLabel: "Containment 0 / 1 000 (Preview)",
    thresholdProgress: 0,
    badge: "Preview",
  },
  {
    id: "phase_bloom",
    label: "Phase II — Full Bloom",
    description:
      "Miasma density rising. Ward Defense perimeters are under elevated pressure. The University races to formulate a Research Countermeasure.",
    thresholdLabel: "Containment 0 / 5 000 (Planned)",
    thresholdProgress: 0,
    badge: "Planned",
  },
  {
    id: "phase_convergence",
    label: "Phase III — Convergence",
    description:
      "World Boss Verdantha materialises at the Sanctuary Core. All factions redirect resources to the final push.",
    thresholdLabel: "Containment 0 / 10 000 (Planned)",
    thresholdProgress: 0,
    badge: "Planned",
  },
];

// ── System Connections ────────────────────────────────────────────────────────

export interface SystemContribution {
  id: string;
  systemName: string;
  icon: string;
  accentColor: string;
  badge: WorldEventBadge;
  shortDesc: string;
  mechanicDesc: string;
  contribution: string;
  rewardHint: string;
  route?: string;
}

export const MIASMA_BLOOM_SYSTEMS: SystemContribution[] = [
  {
    id: "ward_shift",
    systemName: "Ward Shift",
    icon: "flame",
    accentColor: "#EF4444",
    badge: "Preview",
    shortDesc: "Every patient treated pushes back the Bloom.",
    mechanicDesc:
      "Completing Ward Shift runs against Bloom-variant enemies earns Epidemic Tokens. Each cleared patient reduces the Sanctuary Corruption Meter by 1 point. Bloom-variant enemies are harder but drop Rare Loot.",
    contribution:
      "Epidemic Tokens (1–3 per shift run), reduced Sanctuary Corruption, chance of Supply Crate drops from Bloom enemies.",
    rewardHint: "Bloom-tier enemies have a chance to drop World Boss Relic shards.",
    route: "/(tabs)",
  },
  {
    id: "ward_defense",
    systemName: "Ward Defense: Code Rush",
    icon: "shield-checkmark",
    accentColor: "#06B6D4",
    badge: "Preview",
    shortDesc: "Hold the supply perimeter against Bloom waves.",
    mechanicDesc:
      "Bloom waves in Ward Defense: Code Rush carry upgraded Miasma units. Every wave survived earns Supply Crates that feed the Realm's production bonus. A new Bloom-boss unit spawns at wave 10 during the event.",
    contribution:
      "Supply Crates per wave, Faction Marks for the embassy, Insight Crystals.",
    rewardHint: "Surviving the Bloom wave boss unlocks an event-exclusive unit skin (Coming Soon).",
    route: "/ward-defense",
  },
  {
    id: "university",
    systemName: "Clinica University",
    icon: "school",
    accentColor: "#A78BFA",
    badge: "Preview",
    shortDesc: "Research countermeasures that slow the Bloom's spread.",
    mechanicDesc:
      "Completing University Lessons and Simulations tagged [BLOOM-RESPONSE] earns Research Points that contribute to the Research Countermeasure bar. At each countermeasure tier, Sanctuary-wide Corruption decay rate improves for all players.",
    contribution:
      "Research Points → countermeasure tiers, bonus Knowledge Points, Codex Shards.",
    rewardHint: "Completing the Research Countermeasure chain unlocks a Bloom Anatomy Codex entry.",
    route: "/university",
  },
  {
    id: "lotus_journal",
    systemName: "Lotus Plate Journal",
    icon: "flower",
    accentColor: "#34D399",
    badge: "Preview",
    shortDesc: "Healer wellness sustains the team through the outbreak.",
    mechanicDesc:
      "Logging meals, hydration, and wellness check-ins during the event earns Bloom-Resilience Points. Higher resilience reduces the penalty the Bloom applies to Stamina regeneration. This is entirely off-shift — no gameplay power advantage, purely optional.",
    contribution:
      "Bloom-Resilience Points, bonus Nourishment Petals, Insight Crystals.",
    rewardHint: "Reaching max Bloom-Resilience grants a wellness-themed profile badge (Coming Soon).",
    route: "/lotus-journal",
  },
  {
    id: "realm",
    systemName: "Realm — Sanctuary Buildings",
    icon: "business",
    accentColor: "#D4AF37",
    badge: "Preview",
    shortDesc: "Realm buildings generate event supplies passively.",
    mechanicDesc:
      "Placed and hero-assigned producer buildings (Clinica University, Research Library, Sanctuary Bank) generate event Supply Crates alongside their normal currencies. Supply Crates are capped per building per day — more heroes assigned means faster fill.",
    contribution:
      "Supply Crates (based on assignment), bonus production during the event window.",
    rewardHint: "Buildings at max hero-assignment generate double Supply Crates during Phase III.",
    route: "/(tabs)/kingdom",
  },
  {
    id: "faction_embassy",
    systemName: "Faction Embassy",
    icon: "flag",
    accentColor: "#F472B6",
    badge: "Planned",
    shortDesc: "Factions coordinate sector containment strategies.",
    mechanicDesc:
      "The Faction Embassy coordinates Sector Contribution Drive — each faction targets a different Bloom district. Depositing Faction Marks (earned across all systems) into your chosen faction's drive accelerates that sector's containment and unlocks faction-specific event rewards.",
    contribution:
      "Faction Marks → sector containment progress, Faction Reputation, cosmetic faction banner.",
    rewardHint: "The leading faction at Phase III earns a permanent cosmetic banner for all members (Planned).",
    route: "/(tabs)/faction",
  },
];

// ── Milestone Rewards ─────────────────────────────────────────────────────────

export interface MilestoneReward {
  id: string;
  tier: number;
  label: string;
  requirement: string;
  rewards: { icon: string; label: string; accentColor: string }[];
  badge: WorldEventBadge;
  claimed: boolean; // static preview — always false
}

export const MIASMA_BLOOM_MILESTONES: MilestoneReward[] = [
  {
    id: "ms_1",
    tier: 1,
    label: "First Response",
    requirement: "Complete 1 Ward Shift against a Bloom-variant enemy.",
    rewards: [
      { icon: "flask", label: "50 Epidemic Tokens", accentColor: "#34D399" },
      { icon: "cube", label: "1 Supply Crate", accentColor: "#D4AF37" },
    ],
    badge: "Preview",
    claimed: false,
  },
  {
    id: "ms_2",
    tier: 2,
    label: "Ward Containment",
    requirement: "Treat 5 Bloom-variant patients in total.",
    rewards: [
      { icon: "flask", label: "200 Epidemic Tokens", accentColor: "#34D399" },
      { icon: "sparkles", label: "Bloom Research Notes (Codex)", accentColor: "#A78BFA" },
    ],
    badge: "Preview",
    claimed: false,
  },
  {
    id: "ms_3",
    tier: 3,
    label: "Perimeter Held",
    requirement: "Survive 3 Bloom waves in Ward Defense: Code Rush.",
    rewards: [
      { icon: "flask", label: "500 Epidemic Tokens", accentColor: "#34D399" },
      { icon: "diamond", label: "200 Insight Crystals", accentColor: "#22D3EE" },
      { icon: "cube", label: "3 Supply Crates", accentColor: "#D4AF37" },
    ],
    badge: "Preview",
    claimed: false,
  },
  {
    id: "ms_4",
    tier: 4,
    label: "Research Breakthrough",
    requirement: "Complete any Bloom-Response lesson in the University.",
    rewards: [
      { icon: "flask", label: "1 000 Epidemic Tokens", accentColor: "#34D399" },
      { icon: "ribbon", label: "Bloom Researcher Title (Profile)", accentColor: "#A78BFA" },
      { icon: "library", label: "Bloom Anatomy entry (Codex)", accentColor: "#5B9BD5" },
    ],
    badge: "Preview",
    claimed: false,
  },
  {
    id: "ms_5",
    tier: 5,
    label: "Phase I Cleared",
    requirement: "Reach Phase I Containment Threshold (collective milestone).",
    rewards: [
      { icon: "flask", label: "2 000 Epidemic Tokens", accentColor: "#34D399" },
      { icon: "trophy", label: "Bloom Veteran Title", accentColor: "#D4AF37" },
      { icon: "cube", label: "World Boss Relic Shard ×3", accentColor: "#F97316" },
    ],
    badge: "Preview",
    claimed: false,
  },
  {
    id: "ms_6",
    tier: 6,
    label: "Bloom Suppressed",
    requirement: "Reach Phase III — defeat the World Boss Verdantha.",
    rewards: [
      { icon: "star", label: "Rare Material: Verdanthite ×5", accentColor: "#34D399" },
      { icon: "ribbon", label: "Verdantha Slayer Title", accentColor: "#EF4444" },
      { icon: "color-palette", label: "Bloom Ward Skin (Coming Soon)", accentColor: "#F472B6" },
      { icon: "cube", label: "World Boss Relic — Verdantha's Core", accentColor: "#F97316" },
    ],
    badge: "Planned",
    claimed: false,
  },
];

// ── Reward Catalog Preview ────────────────────────────────────────────────────

export interface EventRewardItem {
  id: string;
  name: string;
  icon: string;
  accentColor: string;
  category: "currency" | "material" | "cosmetic" | "title" | "relic" | "codex";
  description: string;
  source: string;
  badge: WorldEventBadge;
}

export const MIASMA_BLOOM_REWARDS: EventRewardItem[] = [
  {
    id: "epidemic_tokens",
    name: "Epidemic Tokens",
    icon: "flask",
    accentColor: "#34D399",
    category: "currency",
    description:
      "The primary event currency. Earned from all systems during the Miasma Bloom. Spent at the Event Token Exchange for materials, cosmetics, and relics.",
    source: "Ward Shift, Ward Defense, University Lessons, Lotus Journal",
    badge: "Preview",
  },
  {
    id: "supply_crates",
    name: "Supply Crate",
    icon: "cube",
    accentColor: "#D4AF37",
    category: "material",
    description:
      "A crate of clinical supplies assembled during the outbreak. Opened for a random selection of useful materials: Ward Coins, Codex Shards, Insight Crystals, or rare materials.",
    source: "Realm buildings, Ward Defense waves, Bloom enemy drops",
    badge: "Preview",
  },
  {
    id: "insight_crystals_event",
    name: "Insight Crystals",
    icon: "diamond",
    accentColor: "#22D3EE",
    category: "currency",
    description:
      "Realm-generated premium currency, boosted during the event. Earned from Ward Defense waves and Lotus Journal wellness milestones.",
    source: "Ward Defense Bloom waves, Lotus Journal",
    badge: "Preview",
  },
  {
    id: "faction_marks",
    name: "Faction Marks",
    icon: "flag",
    accentColor: "#F472B6",
    category: "currency",
    description:
      "Deposited into the Faction Embassy's Sector Contribution Drive to accelerate your faction's containment of a Bloom district.",
    source: "All systems (bonus during Bloom event)",
    badge: "Planned",
  },
  {
    id: "world_boss_relic",
    name: "World Boss Relic — Verdantha's Core",
    icon: "cube",
    accentColor: "#F97316",
    category: "relic",
    description:
      "A crystallised remnant of Verdantha's core, pulsing with contained miasmic energy. A rare enhancement material for hero skills and Realm buildings.",
    source: "Phase III World Boss drop, Milestone Tier 5-6",
    badge: "Planned",
  },
  {
    id: "verdanthite",
    name: "Verdanthite",
    icon: "star",
    accentColor: "#34D399",
    category: "material",
    description:
      "A rare event-exclusive material harvested from neutralised Bloom sites. Used in advanced hero evolution and Realm building upgrades.",
    source: "Phase III completion, Supply Crate (rare)",
    badge: "Planned",
  },
  {
    id: "bloom_researcher_title",
    name: "Bloom Researcher Title",
    icon: "ribbon",
    accentColor: "#A78BFA",
    category: "title",
    description:
      "Displayed on your Profile screen below your healer name. Earned by completing the Research Breakthrough milestone. Purely cosmetic — no stat effect.",
    source: "Milestone Tier 4",
    badge: "Preview",
  },
  {
    id: "verdantha_slayer_title",
    name: "Verdantha Slayer Title",
    icon: "ribbon",
    accentColor: "#EF4444",
    category: "title",
    description:
      "Awarded to healers who contributed to the defeat of the World Boss in Phase III. Displayed on Profile. Cosmetic only.",
    source: "Milestone Tier 6 / Phase III completion",
    badge: "Planned",
  },
  {
    id: "bloom_ward_skin",
    name: "Bloom Ward Skin",
    icon: "color-palette",
    accentColor: "#F472B6",
    category: "cosmetic",
    description:
      "A limited cosmetic skin for the Ward Shift arena, replacing the standard backdrop with a bioluminescent Bloom-variant scene. No gameplay effect.",
    source: "Milestone Tier 6 / Phase III completion",
    badge: "Coming Soon",
  },
  {
    id: "bloom_anatomy_codex",
    name: "Bloom Anatomy — Codex Entry",
    icon: "library",
    accentColor: "#5B9BD5",
    category: "codex",
    description:
      "A detailed clinical-lore entry in the Great Codex covering the Verdant Miasma's spore biology, infection pathway, and recommended countermeasures.",
    source: "Milestone Tier 4 / Research Breakthrough",
    badge: "Preview",
  },
];

// ── World Boss ────────────────────────────────────────────────────────────────

export interface WorldBossPreview {
  id: string;
  name: string;
  title: string;
  lore: string;
  primarySystem: string;
  secondarySystem: string;
  difficulty: string;
  badge: WorldEventBadge;
  signatureAttack: string;
  weaknesses: string;
  clinicalAnalog: string;
  unlockCondition: string;
  dropRewards: string[];
  artBrief: string;
}

// Placeholder unlock gate for the playable Verdantha encounter. The Bloom
// Matriarch only manifests at Phase III — Convergence. There is no live phase
// progression in this prototype, so this stays false: the "Challenge Verdantha"
// entry routes to the gated boss screen, which shows a Coming Soon lock instead
// of letting the fight start. Flip to true (or wire to real phase progress)
// when Phase III goes live.
export const VERDANTHA_UNLOCKED = false;

export const VERDANTHA: WorldBossPreview = {
  id: "verdantha",
  name: "Verdantha",
  title: "The Bloom Matriarch",
  lore:
    "Verdantha is the source-entity of the Verdant Miasma — a colossal, semi-sentient fungal intelligence that has been dormant in the Outer Wilds for centuries. Awakened by a surge of corrupted Clinical Cue energy, she drifts toward the Sanctuary's Vital Lantern, drawn to its life-force resonance. She does not attack with malice; she simply grows, and her growth is catastrophic.",
  primarySystem: "Growth",
  secondarySystem: "Filter",
  difficulty: "World-Scale (Phase III Only)",
  badge: "Planned",
  signatureAttack:
    "Bloom Cascade — releases a wave of spore-bombs targeting all active wards simultaneously, applying Corruption stacks to every placed hero and building. Blocked by coordinated shield actions across multiple systems.",
  weaknesses:
    "Fire (burns spore clouds), River (flushes toxins), and Research Countermeasure tier buffs from the University reduce her effective HP.",
  clinicalAnalog:
    "Invasive fungal infection (analogous to disseminated aspergillosis or mucormycosis) — requires systemic multi-agent treatment, not a single counter. Models real-world pandemic coordination challenges.",
  unlockCondition:
    "Spawns automatically at Phase III when the global Containment Threshold is crossed. Available to all participating healers for a limited window.",
  dropRewards: [
    "Verdantha's Core (World Boss Relic)",
    "Verdanthite ×3–5",
    "Verdantha Slayer Title",
    "Bloom Ward Skin (first kill)",
    "Epidemic Tokens ×5 000",
  ],
  artBrief:
    "A massive, beautiful-yet-terrifying fungal entity — her form is a cascading canopy of bioluminescent blue-green bloom-caps, trailing luminous spore-silk. Her face is serene, almost human, but her body is pure infection. She floats at the centre of the Sanctuary courtyard as petals of miasma drift around her. Donghua art style: cel-shaded, luminous, every surface glowing with soft internal light.",
};

// ── Token Exchange Preview ────────────────────────────────────────────────────

// A grant describes exactly what a redeemed exchange item hands the player.
// Items with a grant are live and purchasable; items without one (e.g. the
// cosmetic skin that has no real equippable asset yet) stay locked so the
// exchange never promises a reward it can't actually deliver.
export type ExchangeGrant =
  | { kind: "currency"; field: "codex_shards" | "insight_crystals"; amount: number }
  | { kind: "material"; itemName: string; qty: number };

export interface TokenExchangeItem {
  id: string;
  name: string;
  icon: string;
  accentColor: string;
  cost: number;
  badge: WorldEventBadge;
  category: "material" | "cosmetic" | "relic" | "currency";
  grant?: ExchangeGrant;
}

export const TOKEN_EXCHANGE: TokenExchangeItem[] = [
  { id: "ex_crate",       name: "Supply Crate",           icon: "cube",           accentColor: "#D4AF37", cost: 100,   badge: "Preview",      category: "material",  grant: { kind: "material", itemName: "Supply Crate",           qty: 1   } },
  { id: "ex_codex_shard", name: "Codex Shards ×50",       icon: "diamond",        accentColor: "#22D3EE", cost: 200,   badge: "Preview",      category: "currency",  grant: { kind: "currency", field: "codex_shards",             amount: 50  } },
  { id: "ex_crystals",    name: "Insight Crystals ×100",  icon: "diamond",        accentColor: "#22D3EE", cost: 300,   badge: "Preview",      category: "currency",  grant: { kind: "currency", field: "insight_crystals",         amount: 100 } },
  { id: "ex_verdanthite", name: "Verdanthite ×1",         icon: "star",           accentColor: "#34D399", cost: 1000,  badge: "Preview",      category: "material",  grant: { kind: "material", itemName: "Verdanthite",           qty: 1   } },
  { id: "ex_relic_shard", name: "World Boss Relic Shard", icon: "cube",           accentColor: "#F97316", cost: 2000,  badge: "Preview",      category: "relic",     grant: { kind: "material", itemName: "World Boss Relic Shard", qty: 1   } },
  { id: "ex_skin",        name: "Bloom Ward Skin",         icon: "color-palette",  accentColor: "#F472B6", cost: 5000,  badge: "Coming Soon",  category: "cosmetic"   },
];

// ── Active Event (static preview) ─────────────────────────────────────────────
// A single flag + summary so hub screens can surface the currently-running world
// event without importing the whole data set. Still preview-only — nothing here
// wires live timers, progress, or rewards.

export interface ActiveWorldEvent {
  id: string;
  title: string;
  subtitle: string;
  accentColor: string;
  route: string;
  badge: WorldEventBadge;
}

export const WORLD_EVENT_ACTIVE = true;

export const ACTIVE_WORLD_EVENT: ActiveWorldEvent = {
  id: "miasma_bloom",
  title: MIASMA_BLOOM_LORE.title,
  subtitle: MIASMA_BLOOM_LORE.subtitle,
  accentColor: "#34D399",
  route: "/world-event",
  badge: "Preview",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export const WORLD_EVENT_BADGE_COLOR: Record<WorldEventBadge, string> = {
  Preview:      "#5B9BD5",
  Planned:      "#A78BFA",
  "Coming Soon": "#F59E0B",
};

export const REWARD_CATEGORY_LABEL: Record<EventRewardItem["category"], string> = {
  currency: "Currency",
  material: "Material",
  cosmetic: "Cosmetic",
  title:    "Profile Title",
  relic:    "Boss Relic",
  codex:    "Codex Entry",
};
