// Realm / Kingdom Builder Foundation (Push 3)
//
// This file is the single source of truth for the Realm map: building plot
// definitions, districts, and Grand Ward Atrium unlock progression. It is a
// FOUNDATION PASS — fixed plots only (no free placement), no live trading,
// no real payments, no PvP/world boss/complex production math yet.
//
// Any UI (app/(tabs)/kingdom.tsx) should render from these exports rather
// than hardcoding building copy, positions, or unlock rules.

export type DistrictId =
  | "sanctuary" | "scholar" | "care" | "commerce" | "wellness" | "defense" | "diplomacy";

export interface RealmDistrict {
  id: DistrictId;
  name: string;
  tagline: string;
  colorToken: "brand" | "mind" | "protection" | "energy" | "growth" | "fire" | "storm";
}

export const REALM_DISTRICTS: RealmDistrict[] = [
  { id: "sanctuary", name: "Sanctuary District", tagline: "The living heart of the Realm.", colorToken: "brand" },
  { id: "scholar", name: "Scholar District", tagline: "Learning, recruitment, and research.", colorToken: "mind" },
  { id: "care", name: "Care District", tagline: "Patient care and stability support.", colorToken: "protection" },
  { id: "commerce", name: "Commerce District", tagline: "Supplies, banking, and future trade.", colorToken: "energy" },
  { id: "wellness", name: "Wellness District", tagline: "Nutrition and off-shift recovery.", colorToken: "growth" },
  { id: "defense", name: "Defense District", tagline: "Ward Defense readiness.", colorToken: "fire" },
  { id: "diplomacy", name: "Diplomacy District", tagline: "Future faction relations.", colorToken: "storm" },
];

export type RealmLinkKind = "route" | "placeholder";

export interface RealmRequirement {
  atriumLevel: number;
  materials: string[];
}

export interface HeroAssignmentSlot {
  role: string;
  flavor: string;
}

export interface RealmBuilding {
  id: string;
  name: string;
  district: DistrictId;
  icon: string;
  // Position on the map background, as a percentage of width/height (0-100).
  x: number;
  y: number;
  isAtrium?: boolean;
  purpose: string;
  benefitForLevel: (level: number) => string;
  nextUpgradeForLevel: (level: number) => string;
  maxLevel: number;
  kingdomLevelsKey: string;
  requirementsForLevel: (level: number) => RealmRequirement;
  atriumLevelRequired: number;
  linkKind: RealmLinkKind;
  linkRoute?: string;
  linkLabel: string;
  heroSlots: HeroAssignmentSlot[];
  skinPlaceholder: boolean;
  comingSoon?: boolean;
}

export const ATRIUM_ID = "grand_ward_atrium";

// Grand Ward Atrium unlock progression — the town-hall limiter for every other plot.
export const ATRIUM_UNLOCKS: { level: number; unlocks: string[]; note: string }[] = [
  { level: 1, unlocks: ["hospital_ward", "apothecary", "research_library"], note: "Atrium Lv.1 opens the Care, Commerce, and Scholar foundations." },
  { level: 2, unlocks: ["training_hall", "nutrition_garden"], note: "Atrium Lv.2 opens Training Hall and the Nutrition Garden." },
  { level: 3, unlocks: ["clinica_university", "sanctuary_bank"], note: "Atrium Lv.3 expands Clinica University and opens the Sanctuary Bank." },
  { level: 4, unlocks: ["ward_defense_tower"], note: "Atrium Lv.4 opens the Ward Defense Tower and a decoration slot preview." },
  { level: 5, unlocks: ["sanctuary_bazaar"], note: "Atrium Lv.5 opens the Sanctuary Bazaar / Night Market placeholder." },
  { level: 6, unlocks: ["faction_embassy"], note: "Atrium Lv.6 opens the Faction Embassy placeholder." },
  { level: 7, unlocks: [], note: "Atrium Lv.7+ previews advanced districts and future world-event preparation." },
];

export const REALM_BUILDINGS: RealmBuilding[] = [
  {
    id: ATRIUM_ID,
    name: "Grand Ward Atrium",
    district: "sanctuary",
    icon: "sparkles",
    x: 50, y: 46,
    isAtrium: true,
    purpose: "The town hall of the Realm — every other building's growth is gated by its level.",
    benefitForLevel: (lvl) => `Realm capacity Lv.${lvl}. Unlocks new districts as it grows.`,
    nextUpgradeForLevel: (lvl) => `Lv.${lvl + 1} unlocks the next wave of districts (see progression).`,
    maxLevel: 7,
    kingdomLevelsKey: "grand_ward_atrium",
    requirementsForLevel: (lvl) => ({ atriumLevel: 0, materials: ["Ward Timber", "Spirit Stone", `${(lvl + 1) * 200} Ward Coins`] }),
    atriumLevelRequired: 0,
    linkKind: "placeholder",
    linkLabel: "Realm core — no external link",
    heroSlots: [{ role: "Realm Steward", flavor: "A future hero role that boosts overall Realm growth." }],
    skinPlaceholder: true,
  },
  {
    id: "clinica_university",
    name: "Clinica University",
    district: "scholar",
    icon: "school",
    x: 26, y: 26,
    purpose: "Generates Knowledge Points and links to learning, recruitment, class manuals, and research.",
    benefitForLevel: (lvl) => `Lv.${lvl} generates Knowledge Points and unlocks lessons and research.`,
    nextUpgradeForLevel: (lvl) => `Next level gives +5% Knowledge generation.`,
    maxLevel: 5,
    kingdomLevelsKey: "academy_of_healing",
    requirementsForLevel: (lvl) => ({ atriumLevel: 2, materials: ["Ward Timber", "Spirit Stone", "University Credits"] }),
    atriumLevelRequired: 3,
    linkKind: "route",
    linkRoute: "/university",
    linkLabel: "Open Clinica University",
    heroSlots: [{ role: "Scholar", flavor: "A Scholar hero here increases Knowledge Point generation." }],
    skinPlaceholder: true,
  },
  {
    id: "research_library",
    name: "Research Library",
    district: "scholar",
    icon: "library",
    x: 16, y: 42,
    purpose: "Houses the Codex, class manuals, lore, and Clinical Cue review.",
    benefitForLevel: (lvl) => `Lv.${lvl} unlocks deeper Codex entries and Clinical Cue review tools.`,
    nextUpgradeForLevel: (lvl) => `Next level reveals another Codex tier.`,
    maxLevel: 5,
    kingdomLevelsKey: "library_of_knowledge",
    requirementsForLevel: (lvl) => ({ atriumLevel: 1, materials: ["Ward Timber", "Codex Shards"] }),
    atriumLevelRequired: 1,
    linkKind: "route",
    linkRoute: "/(tabs)/codex",
    linkLabel: "Open Codex & Manuals",
    heroSlots: [{ role: "Seer", flavor: "A Seer hero here improves research and Codex progress." }],
    skinPlaceholder: true,
  },
  {
    id: "hospital_ward",
    name: "Hospital Ward",
    district: "care",
    icon: "medkit",
    x: 66, y: 24,
    purpose: "Supports Ward Shift and grants stability / patient-care bonuses.",
    benefitForLevel: (lvl) => `Lv.${lvl} boosts stability gain during Ward Shift battles.`,
    nextUpgradeForLevel: (lvl) => `Next level further improves patient-care outcomes.`,
    maxLevel: 5,
    kingdomLevelsKey: "hospital_ward",
    requirementsForLevel: (lvl) => ({ atriumLevel: 1, materials: ["Ward Timber", "Ward Coins"] }),
    atriumLevelRequired: 1,
    linkKind: "route",
    linkRoute: "/(tabs)/index",
    linkLabel: "Go to Ward Shift",
    heroSlots: [{ role: "Village Caretaker", flavor: "A Village Caretaker hero here improves Stability rewards." }],
    skinPlaceholder: true,
  },
  {
    id: "hall_of_heroes",
    name: "Training Hall",
    district: "care",
    icon: "people-circle",
    x: 78, y: 42,
    purpose: "Supports hero training, Hero EXP, skill books, and class trainee systems.",
    benefitForLevel: (lvl) => `Lv.${lvl} raises the Hero EXP cap and trainee capacity.`,
    nextUpgradeForLevel: (lvl) => `Next level adds another training slot.`,
    maxLevel: 5,
    kingdomLevelsKey: "hall_of_heroes",
    requirementsForLevel: (lvl) => ({ atriumLevel: 2, materials: ["Spirit Stone", "Skill Books"] }),
    atriumLevelRequired: 2,
    linkKind: "route",
    linkRoute: "/(tabs)/heroes",
    linkLabel: "Open Hall of Heroes",
    heroSlots: [{ role: "Drillmaster", flavor: "A Drillmaster hero here speeds up hero training." }],
    skinPlaceholder: true,
  },
  {
    id: "apothecary",
    name: "Apothecary",
    district: "commerce",
    icon: "flask",
    x: 62, y: 60,
    purpose: "Links to the Shop and, later, clinical supply and pharmaceutical crafting.",
    benefitForLevel: (lvl) => `Lv.${lvl} unlocks more consumables per shift.`,
    nextUpgradeForLevel: (lvl) => `Next level adds a new consumable slot.`,
    maxLevel: 5,
    kingdomLevelsKey: "apothecary",
    requirementsForLevel: (lvl) => ({ atriumLevel: 1, materials: ["Ward Coins", "Herbal Extract"] }),
    atriumLevelRequired: 1,
    linkKind: "route",
    linkRoute: "/(tabs)/shop",
    linkLabel: "Open the Shop",
    heroSlots: [{ role: "Herbalist", flavor: "A Herbal-type hero here improves clinical supply crafting." }],
    skinPlaceholder: true,
  },
  {
    id: "sanctuary_bank",
    name: "Sanctuary Bank",
    district: "commerce",
    icon: "business",
    x: 74, y: 66,
    purpose: "Explains the Insight Crystal to Refined Lotus Gem exchange economy.",
    benefitForLevel: (lvl) => `Lv.${lvl} raises your daily exchange cap at the Bank.`,
    nextUpgradeForLevel: (lvl) => `Next level increases the daily Insight Crystal exchange cap.`,
    maxLevel: 5,
    kingdomLevelsKey: "sanctuary_bank",
    requirementsForLevel: (lvl) => ({ atriumLevel: 3, materials: ["Ward Coins", "Insight Crystals"] }),
    atriumLevelRequired: 3,
    linkKind: "route",
    linkRoute: "/economy",
    linkLabel: "Open Economy Guide",
    heroSlots: [{ role: "Treasurer", flavor: "A Treasurer hero here improves exchange rates slightly." }],
    skinPlaceholder: true,
  },
  {
    id: "sanctuary_bazaar",
    name: "Sanctuary Bazaar (Night Market)",
    district: "commerce",
    icon: "moon",
    x: 88, y: 58,
    purpose: "Future home of player-to-player trading for cosmetics, event materials, and collectibles.",
    benefitForLevel: () => "Not yet active — this is a Coming Soon / Future Feature placeholder.",
    nextUpgradeForLevel: () => "Future updates will add listing limits, taxes, and account-safety rules.",
    maxLevel: 1,
    kingdomLevelsKey: "sanctuary_bazaar",
    requirementsForLevel: () => ({ atriumLevel: 5, materials: [] }),
    atriumLevelRequired: 5,
    linkKind: "placeholder",
    linkLabel: "Coming Soon — Future Feature",
    heroSlots: [],
    skinPlaceholder: true,
    comingSoon: true,
  },
  {
    id: "nutrition_garden",
    name: "Nutrition Garden",
    district: "wellness",
    icon: "leaf",
    x: 34, y: 66,
    purpose: "Supports the Lotus Plate Journal and off-shift wellness / nutrition rewards.",
    benefitForLevel: (lvl) => `Lv.${lvl} boosts Lotus Plate Journal wellness rewards.`,
    nextUpgradeForLevel: (lvl) => `Next level unlocks a new garden plot.`,
    maxLevel: 5,
    kingdomLevelsKey: "nutrition_garden",
    requirementsForLevel: (lvl) => ({ atriumLevel: 2, materials: ["Ward Coins", "Garden Seeds"] }),
    atriumLevelRequired: 2,
    linkKind: "route",
    linkRoute: "/lotus-journal",
    linkLabel: "Open Lotus Plate Journal",
    heroSlots: [{ role: "Gardener", flavor: "A Gardener hero here improves nutrition rewards." }],
    skinPlaceholder: true,
  },
  {
    id: "ward_defense_tower",
    name: "Ward Defense Tower",
    district: "defense",
    icon: "shield",
    x: 40, y: 82,
    purpose: "Supports Code Rush and Ward Defense readiness.",
    benefitForLevel: (lvl) => `Lv.${lvl} raises the Ward Defense difficulty ceiling and rewards.`,
    nextUpgradeForLevel: (lvl) => `Next level unlocks a tougher Ward Defense tier.`,
    maxLevel: 5,
    kingdomLevelsKey: "ward_defense_tower",
    requirementsForLevel: (lvl) => ({ atriumLevel: 4, materials: ["Ward Sigils", "Spirit Stone"] }),
    atriumLevelRequired: 4,
    linkKind: "route",
    linkRoute: "/ward-defense",
    linkLabel: "Open Ward Defense",
    heroSlots: [{ role: "Sentinel", flavor: "A Sentinel hero here strengthens tower defense." }],
    skinPlaceholder: true,
  },
  {
    id: "faction_embassy",
    name: "Faction Embassy",
    district: "diplomacy",
    icon: "flag",
    x: 60, y: 88,
    purpose: "Future home for allied factions, shared world events, and collaborative rewards.",
    benefitForLevel: () => "Not yet active — this is a Coming Soon / Future Feature placeholder.",
    nextUpgradeForLevel: () => "Future updates will add faction rosters and shared world-boss goals.",
    maxLevel: 1,
    kingdomLevelsKey: "faction_embassy",
    requirementsForLevel: () => ({ atriumLevel: 6, materials: [] }),
    atriumLevelRequired: 6,
    linkKind: "placeholder",
    linkLabel: "Coming Soon — Future Feature",
    heroSlots: [],
    skinPlaceholder: true,
    comingSoon: true,
  },
];

export function getAtriumLevel(kingdomLevels: Record<string, number>): number {
  return kingdomLevels[ATRIUM_ID] || 0;
}

export function isBuildingUnlocked(building: RealmBuilding, atriumLevel: number): boolean {
  if (building.isAtrium) return true;
  return atriumLevel >= building.atriumLevelRequired;
}

export const REALM_CUSTOMIZATION_NOTE =
  "Realm customization is a future direction: building skins, district themes, decorations, " +
  "road and path styles, lanterns, banners, statues, gardens, and seasonal Realm-wide themes. " +
  "All planned customization is purely cosmetic and will never grant gameplay power.";

export const REALM_HERO_ASSIGNMENT_NOTE =
  "Hero assignment is a future direction. Assigning a hero to a building will grant small " +
  "passive bonuses to that building without ever locking the hero out of battles or teams.";

export const REALM_BAZAAR_NOTE =
  "The Sanctuary Bazaar will one day let players trade limited cosmetics, event materials, " +
  "rare collectibles, and non-core materials — never core power items. Planned safeguards " +
  "include listing limits, taxes, account-safety checks, and non-pay-to-win restrictions. " +
  "No live trading is active yet.";
