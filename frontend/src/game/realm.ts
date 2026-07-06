// Realm of Clinica / Grand Ward Sanctuary — Sanctuary Builder Foundation
//
// This file is the single source of truth for the Realm map: Sanctuary Plot
// definitions, districts, and Grand Ward Atrium unlock progression. Clinica's
// Realm is an original healing-sanctuary builder — NOT a Clash-of-Clans-style
// attack/defense base. There are no walls, traps, raids, resource stealing,
// or enemy attacks on the Realm. It is a FOUNDATION PASS — fixed plots only
// (no free placement), no live trading, no real payments, no PvP/world boss/
// complex production math yet.
//
// The Realm loop is: Build -> Assign -> Research -> Prepare -> Customize ->
// Expand. Every plot the player unlocks starts EMPTY (aside from the Grand
// Ward Atrium landmark) and is constructed deliberately via Build Sanctuary
// mode, so new players see a sanctuary they grow into rather than a
// pre-painted finished city.
//
// Any UI (app/(tabs)/kingdom.tsx) should render from these exports rather
// than hardcoding building copy, positions, or unlock rules.

import { cellId, DEFAULT_ATRIUM_ORIGIN, DEFAULT_UNIVERSITY_ORIGIN } from "./realmGrid";

export const REALM_LOOP_NOTE =
  "The Realm loop: Build a Sanctuary Plot, Assign a hero or trainee, let it Research/Prepare passive " +
  "bonuses, Customize it cosmetically, then Expand to the next plot or district. There is no Defend, " +
  "no Attacked, no Repair step — nothing here is a war base.";

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
  { id: "defense", name: "Defense District", tagline: "Ward Defense readiness — never Realm combat.", colorToken: "fire" },
  { id: "diplomacy", name: "Diplomacy District", tagline: "Future faction relations and collaboration.", colorToken: "storm" },
];

export type RealmLinkKind = "route" | "placeholder";

export interface RealmRequirement {
  atriumLevel: number;
  materials: string[];
}

export type AssignmentSlotType = "hero" | "trainee" | "mentor";

export interface HeroAssignmentSlot {
  role: string;
  flavor: string;
  slotType: AssignmentSlotType;
}

export type PlotSize = "small" | "medium" | "large";

// Sanctuary Plot types — Push 5.5 correction: land is no longer split into
// per-district plot types that hard-gate placement. A cell is now simply
// buildable, a decoration cell, or blocked terrain. District/theme identity
// (see DistrictId above) becomes a purely cosmetic tag used for Realm
// Harmony proximity bonuses (see REALM_HARMONY note + getHarmonyBonus below),
// never a placement requirement.
export type PlotType = "buildable" | "decoration" | "blocked";

export interface PlotTypeMeta {
  id: PlotType;
  name: string;
  icon: string;
  description: string;
}

export const PLOT_TYPE_META: PlotTypeMeta[] = [
  { id: "buildable", name: "Buildable Ground", icon: "leaf", description: "Open grass, meadow, or stone courtyard — any unlocked, empty building fits here if the footprint fits." },
  { id: "decoration", name: "Decoration Cell", icon: "flower", description: "Purely cosmetic — lanterns, banners, statues, gardens." },
  { id: "blocked", name: "Blocked Cell", icon: "leaf-outline", description: "Water, forest, cliff, or the map border — not buildable." },
];

export function getPlotTypeMeta(type: PlotType): PlotTypeMeta {
  return PLOT_TYPE_META.find((t) => t.id === type) || PLOT_TYPE_META[PLOT_TYPE_META.length - 1];
}

// ---------------------------------------------------------------------------
// Building purpose categories — drive the bottom building-card tray. This is
// independent from `district` (which is now cosmetic/Harmony-only theming).
// ---------------------------------------------------------------------------
export type BuildingCategory =
  | "core" | "learning" | "care" | "supplies" | "wellness" | "economy" | "defense" | "faction";

export interface BuildingCategoryMeta {
  id: BuildingCategory;
  name: string;
  icon: string;
}

export const BUILDING_CATEGORIES: BuildingCategoryMeta[] = [
  { id: "core", name: "Core", icon: "sparkles" },
  { id: "learning", name: "Learning", icon: "school" },
  { id: "care", name: "Care", icon: "medkit" },
  { id: "supplies", name: "Supplies", icon: "flask" },
  { id: "wellness", name: "Wellness", icon: "leaf" },
  { id: "economy", name: "Economy", icon: "business" },
  { id: "defense", name: "Defense Support", icon: "shield" },
  { id: "faction", name: "Faction", icon: "flag" },
];

// ---------------------------------------------------------------------------
// Realm Harmony — optional, future-leaning proximity bonuses that REPLACE the
// old hard district-plot gating. A building can be placed anywhere buildable;
// if it happens to sit near a thematically-related building or decoration, it
// shows an informational Harmony tag. Never required, never a hard placement
// rule, and never tied to attack/defense strength.
// ---------------------------------------------------------------------------
export interface HarmonyAffinity {
  label: string;
  nearBuildingIds?: string[];
  nearDecorationIds?: string[];
}

export interface RealmBuilding {
  id: string;
  name: string;
  district: DistrictId;
  // Building-purpose category — drives the bottom building-card tray. Independent
  // from `district`, which is now a cosmetic/Harmony-only theme tag, not a gate.
  category: BuildingCategory;
  // Optional Realm Harmony proximity bonus — informational only, never required.
  harmony?: HarmonyAffinity;
  icon: string;
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
  // Feature-gate id (see progression.ts FEATURE_UNLOCKS / checkFeatureGate) for
  // route links that point at a still-gated screen (Heroes, Shop, University).
  // When set, the building modal disables the link until that feature unlocks so
  // it can't be used as a shortcut into a locked area.
  linkFeature?: string;
  heroSlots: HeroAssignmentSlot[];
  skinPlaceholder: boolean;
  comingSoon?: boolean;
  // Grid placement — actual footprint (width x height, in cells) lives in
  // realmGrid.ts (BUILDING_FOOTPRINTS) so the grid engine stays UI-agnostic.
  // Only the Grand Ward Atrium is fixed; every other building can be freely
  // placed, moved, or stored via Build Sanctuary / Move mode.
  movable: boolean;
  fixedReason?: string;
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
    category: "core",
    icon: "sparkles",
    isAtrium: true,
    purpose: "The central landmark of the Sanctuary — unlocks new districts, raises building caps, and controls Realm expansion. Never an attack structure.",
    benefitForLevel: (lvl) => `Realm capacity Lv.${lvl}. Unlocks new districts as it grows.`,
    nextUpgradeForLevel: (lvl) => `Lv.${lvl + 1} unlocks the next wave of districts (see progression).`,
    maxLevel: 7,
    kingdomLevelsKey: "grand_ward_atrium",
    requirementsForLevel: (lvl) => ({ atriumLevel: 0, materials: ["Ward Timber", "Spirit Stone", `${(lvl + 1) * 200} Ward Coins`] }),
    atriumLevelRequired: 0,
    linkKind: "placeholder",
    linkLabel: "Realm core — no external link",
    heroSlots: [{ role: "Realm Steward", flavor: "A future hero role that boosts overall Realm growth.", slotType: "hero" }],
    skinPlaceholder: true,
    movable: false,
    fixedReason: "The Grand Ward Atrium anchors the entire Realm and never moves.",
  },
  {
    id: "clinica_university",
    name: "Clinica University",
    district: "scholar",
    category: "learning",
    harmony: { label: "Scholar Harmony", nearBuildingIds: ["research_library"] },
    icon: "school",
    purpose: "Generates Knowledge Points and supports Class Manuals, Research, the Recruitment Hall, Clinical Cue mastery, and advanced equipment formulas and Skill Books tied to gear progression.",
    benefitForLevel: (lvl) => `Lv.${lvl} generates Knowledge Points and unlocks lessons, research, and advanced equipment formulas.`,
    nextUpgradeForLevel: (lvl) => `Next level gives +5% Knowledge generation.`,
    maxLevel: 5,
    kingdomLevelsKey: "academy_of_healing",
    requirementsForLevel: (lvl) => ({ atriumLevel: 2, materials: ["Ward Timber", "Spirit Stone", "University Credits"] }),
    atriumLevelRequired: 3,
    linkKind: "route",
    linkRoute: "/university",
    linkLabel: "Open Clinica University",
    linkFeature: "university",
    heroSlots: [
      { role: "Scholar", flavor: "A Scholar hero here increases Knowledge Point generation.", slotType: "hero" },
      { role: "University Trainee", flavor: "A Seer or University trainee boosts research progress.", slotType: "trainee" },
      { role: "Faculty Mentor", flavor: "A Mentor here speeds up trainee learning.", slotType: "mentor" },
    ],
    skinPlaceholder: true,
    movable: true,
  },
  {
    id: "research_library",
    name: "Research Library",
    district: "scholar",
    category: "learning",
    harmony: { label: "Scholar Harmony", nearBuildingIds: ["clinica_university"] },
    icon: "library",
    purpose: "Houses the Codex, class manuals, lore, Clinical Cue review, research bonuses, and equipment lore/Codex links for gear you've earned.",
    benefitForLevel: (lvl) => `Lv.${lvl} unlocks deeper Codex entries, Clinical Cue review tools, and equipment lore links.`,
    nextUpgradeForLevel: (lvl) => `Next level reveals another Codex tier.`,
    maxLevel: 5,
    kingdomLevelsKey: "library_of_knowledge",
    requirementsForLevel: (lvl) => ({ atriumLevel: 1, materials: ["Ward Timber", "Codex Shards"] }),
    atriumLevelRequired: 1,
    linkKind: "route",
    linkRoute: "/(tabs)/codex",
    linkLabel: "Open Codex & Manuals",
    heroSlots: [
      { role: "Seer", flavor: "A Seer hero here improves research and Codex progress.", slotType: "hero" },
      { role: "Archive Trainee", flavor: "A trainee here helps catalog Codex entries faster.", slotType: "trainee" },
    ],
    skinPlaceholder: true,
    movable: true,
  },
  {
    id: "hospital_ward",
    name: "Hospital Ward",
    district: "care",
    category: "care",
    harmony: { label: "Care Harmony", nearBuildingIds: ["apothecary"] },
    icon: "medkit",
    purpose: "Supports Ward Shift preparation, Hero EXP support, Stability bonuses, Clinical Certificates, recovery/stabilization Clinical Supplies, and patient-care reward bonuses.",
    benefitForLevel: (lvl) => `Lv.${lvl} boosts stability gain during Ward Shift battles and recovery/stabilization supply yield.`,
    nextUpgradeForLevel: (lvl) => `Next level further improves patient-care outcomes.`,
    maxLevel: 5,
    kingdomLevelsKey: "hospital_ward",
    requirementsForLevel: (lvl) => ({ atriumLevel: 1, materials: ["Ward Timber", "Ward Coins"] }),
    atriumLevelRequired: 1,
    linkKind: "route",
    linkRoute: "/(tabs)/index",
    linkLabel: "Go to Ward Shift",
    heroSlots: [
      { role: "Village Caretaker", flavor: "A Village Caretaker hero here improves Stability rewards.", slotType: "hero" },
      { role: "Stabilize Trainee", flavor: "A Guardian/Stabilize trainee raises Clinical Certificate chance.", slotType: "trainee" },
    ],
    skinPlaceholder: true,
    movable: true,
  },
  {
    id: "hall_of_heroes",
    name: "Training Hall",
    district: "care",
    category: "learning",
    icon: "people-circle",
    purpose: "Supports hero training, Skill Books, Class Trainees, practice simulations, and the equipment training/enhancement foundation for gear progression.",
    benefitForLevel: (lvl) => `Lv.${lvl} raises the Hero EXP cap, trainee capacity, and equipment training foundation.`,
    nextUpgradeForLevel: (lvl) => `Next level adds another training slot.`,
    maxLevel: 5,
    kingdomLevelsKey: "hall_of_heroes",
    requirementsForLevel: (lvl) => ({ atriumLevel: 2, materials: ["Spirit Stone", "Skill Books"] }),
    atriumLevelRequired: 2,
    linkKind: "route",
    linkRoute: "/(tabs)/heroes",
    linkLabel: "Open Hall of Heroes",
    linkFeature: "hall_of_heroes",
    heroSlots: [
      { role: "Drillmaster", flavor: "A Drillmaster hero here speeds up hero training.", slotType: "hero" },
      { role: "Class Trainee", flavor: "A Trainee here runs practice simulations for bonus Skill Books.", slotType: "trainee" },
      { role: "Veteran Mentor", flavor: "A Mentor here improves trainee outcomes.", slotType: "mentor" },
    ],
    skinPlaceholder: true,
    movable: true,
  },
  {
    id: "apothecary",
    name: "Apothecary",
    district: "commerce",
    category: "supplies",
    harmony: { label: "Care Harmony", nearBuildingIds: ["hospital_ward"] },
    icon: "flask",
    purpose: "The main source for Clinical Supplies and future pharmaceutical crafting — Herbal Vials, Sterile Kits, supply recipes, and links to the Shop.",
    benefitForLevel: (lvl) => `Lv.${lvl} raises Clinical Supply yield and unlocks more supply recipes.`,
    nextUpgradeForLevel: (lvl) => `Next level adds a new consumable slot.`,
    maxLevel: 5,
    kingdomLevelsKey: "apothecary",
    requirementsForLevel: (lvl) => ({ atriumLevel: 1, materials: ["Ward Coins", "Herbal Extract"] }),
    atriumLevelRequired: 1,
    linkKind: "route",
    linkRoute: "/(tabs)/shop",
    linkLabel: "Open the Shop",
    linkFeature: "shop",
    heroSlots: [
      { role: "Herbalist", flavor: "A Herbal-type hero here improves clinical supply crafting.", slotType: "hero" },
      { role: "Alchemist Trainee", flavor: "A Treat/Alchemist trainee boosts Clinical Supply production.", slotType: "trainee" },
    ],
    skinPlaceholder: true,
    movable: true,
  },
  {
    id: "sanctuary_bank",
    name: "Sanctuary Bank",
    district: "commerce",
    category: "economy",
    icon: "business",
    purpose: "Supports Insight Crystals, Refined Lotus Gems, daily exchange limits, and economy info.",
    benefitForLevel: (lvl) => `Lv.${lvl} raises your daily exchange cap at the Bank.`,
    nextUpgradeForLevel: (lvl) => `Next level increases the daily Insight Crystal exchange cap.`,
    maxLevel: 5,
    kingdomLevelsKey: "sanctuary_bank",
    requirementsForLevel: (lvl) => ({ atriumLevel: 3, materials: ["Ward Coins", "Insight Crystals"] }),
    atriumLevelRequired: 3,
    linkKind: "route",
    linkRoute: "/economy",
    linkLabel: "Open Economy Guide",
    heroSlots: [{ role: "Treasurer", flavor: "A Treasurer hero here improves exchange rates slightly.", slotType: "hero" }],
    skinPlaceholder: true,
    movable: true,
  },
  {
    id: "sanctuary_bazaar",
    name: "Sanctuary Bazaar (Night Market)",
    district: "commerce",
    category: "economy",
    icon: "moon",
    purpose: "Future placeholder for a cosmetic/collectible trading economy — not live yet, and never resource-stealing or PvP trading.",
    benefitForLevel: () => "Not yet active — this is a Coming Soon / Future Feature placeholder.",
    nextUpgradeForLevel: () => "Future updates will add listing limits, taxes, and account-safety rules.",
    maxLevel: 1,
    kingdomLevelsKey: "sanctuary_bazaar",
    requirementsForLevel: () => ({ atriumLevel: 5, materials: [] }),
    atriumLevelRequired: 5,
    linkKind: "route",
    linkRoute: "/bazaar",
    linkLabel: "Preview the Bazaar",
    heroSlots: [],
    skinPlaceholder: true,
    comingSoon: true,
    movable: true,
  },
  {
    id: "nutrition_garden",
    name: "Nutrition Garden",
    district: "wellness",
    category: "wellness",
    harmony: { label: "Wellness Harmony", nearDecorationIds: ["garden_hedge", "statue"] },
    icon: "leaf",
    purpose: "Supports Nourishment Petals, Recipe Cards, Garden Seeds, and the Lotus Plate Journal.",
    benefitForLevel: (lvl) => `Lv.${lvl} boosts Lotus Plate Journal wellness rewards.`,
    nextUpgradeForLevel: (lvl) => `Next level unlocks a new garden plot.`,
    maxLevel: 5,
    kingdomLevelsKey: "nutrition_garden",
    requirementsForLevel: (lvl) => ({ atriumLevel: 2, materials: ["Ward Coins", "Garden Seeds"] }),
    atriumLevelRequired: 2,
    linkKind: "route",
    linkRoute: "/lotus-journal",
    linkLabel: "Open Lotus Plate Journal",
    heroSlots: [
      { role: "Gardener", flavor: "A Gardener hero here improves nutrition rewards.", slotType: "hero" },
      { role: "Wellness Trainee", flavor: "A Nutrition/Caretaker trainee boosts Recipe Cards and safe Insight Crystal progress.", slotType: "trainee" },
    ],
    skinPlaceholder: true,
    movable: true,
  },
  {
    id: "ward_defense_tower",
    name: "Ward Defense Tower",
    district: "defense",
    category: "defense",
    icon: "shield",
    purpose: "Supports Ward Defense readiness and rewards — a preparation structure, not a Realm combat building.",
    benefitForLevel: (lvl) => `Lv.${lvl} raises the Ward Defense difficulty ceiling and rewards.`,
    nextUpgradeForLevel: (lvl) => `Next level unlocks a tougher Ward Defense tier.`,
    maxLevel: 5,
    kingdomLevelsKey: "ward_defense_tower",
    requirementsForLevel: (lvl) => ({ atriumLevel: 4, materials: ["Ward Sigils", "Spirit Stone"] }),
    atriumLevelRequired: 4,
    linkKind: "route",
    linkRoute: "/ward-defense",
    linkLabel: "Open Ward Defense",
    heroSlots: [{ role: "Sentinel", flavor: "A Sentinel hero here improves Ward Defense preparation.", slotType: "hero" }],
    skinPlaceholder: true,
    movable: true,
  },
  {
    id: "faction_embassy",
    name: "Faction Embassy",
    district: "diplomacy",
    category: "faction",
    icon: "flag",
    purpose: "Future placeholder for allied factions, shared world events, and collaborative (non-PvP) rewards.",
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
    movable: true,
  },
];

export function getAtriumLevel(kingdomLevels: Record<string, number>): number {
  return kingdomLevels[ATRIUM_ID] || 0;
}

export function isBuildingUnlocked(building: RealmBuilding, atriumLevel: number): boolean {
  if (building.isAtrium) return true;
  return atriumLevel >= building.atriumLevelRequired;
}

// Realm Harmony proximity check — purely informational. Given a building
// being placed/inspected and the set of building ids currently adjacent to it
// (computed by the caller from the grid, e.g. realmGrid.ts neighbor cells),
// returns the Harmony label if satisfied, or null. Never blocks placement,
// never affects stats — a soft "nice to know" nudge only.
export function getHarmonyBonus(
  building: RealmBuilding,
  neighborBuildingIds: string[],
  neighborDecorationIds: string[] = []
): string | null {
  const affinity = building.harmony;
  if (!affinity) return null;
  const nearBuilding = (affinity.nearBuildingIds || []).some((id) => neighborBuildingIds.includes(id));
  const nearDecoration = (affinity.nearDecorationIds || []).some((id) => neighborDecorationIds.includes(id));
  return nearBuilding || nearDecoration ? affinity.label : null;
}

// ---------------------------------------------------------------------------
// Push 5.5 structural correction — the old fixed-plot / painted-map system
// (REALM_PLOTS, RealmPlot, x/y percentage positions) has been removed. The
// Realm is now a real data-driven plot-cell GRID (see realmGrid.ts): buildings
// are separate placeable objects with footprint dimensions, free to place on
// any compatible, unlocked, unoccupied cell — not pinned to one fixed plot.
// player.realm_layout now maps buildingId -> origin cellId ("r{row}_c{col}").
// player.realm_decor now maps a single-cell decoration-plot cellId -> decorationId.
// ---------------------------------------------------------------------------
export interface RealmDecoration {
  id: string;
  name: string;
  icon: string;
  size: "small";
  flavor: string;
}

// Purely cosmetic — decorations never affect gameplay, XP, or economy.
export const DECORATIONS: RealmDecoration[] = [
  { id: "lantern", name: "Ward Lantern", icon: "flame", size: "small", flavor: "A warm lantern to light the path." },
  { id: "banner", name: "Healer's Banner", icon: "flag-outline", size: "small", flavor: "A banner bearing your Realm's colors." },
  { id: "garden_hedge", name: "Garden Hedge", icon: "leaf-outline", size: "small", flavor: "A neatly trimmed hedge." },
  { id: "statue", name: "Founder's Statue", icon: "body-outline", size: "small", flavor: "A small statue honoring the Realm's founders." },
];

export function getBuildingById(id: string): RealmBuilding | undefined {
  return REALM_BUILDINGS.find((b) => b.id === id);
}

export function getDecorationById(id: string): RealmDecoration | undefined {
  return DECORATIONS.find((d) => d.id === id);
}

// The baseline layout every new (or not-yet-migrated) player starts with.
// The guided-onboarding pass auto-places TWO landmarks so the Realm reads as a
// living sanctuary the moment the player first reaches it (Realm unlocks at
// Player Level 3 + first Ward Shift): the Grand Ward Atrium (the anchor) and
// Clinica University (placed just below the Atrium). Every OTHER building still
// starts unplaced (in inventory) so the player keeps a sanctuary to grow into.
// Existing players' already-saved realm_layout is untouched; this only affects
// fresh layouts.
export function buildDefaultRealmLayout(): Record<string, string> {
  return {
    [ATRIUM_ID]: cellId(DEFAULT_ATRIUM_ORIGIN.row, DEFAULT_ATRIUM_ORIGIN.col),
    clinica_university: cellId(DEFAULT_UNIVERSITY_ORIGIN.row, DEFAULT_UNIVERSITY_ORIGIN.col),
  };
}

export interface RealmUnlockContext {
  atriumLevel: number;
  playerLevel: number;
  chapterProgress: number;
  kingdomLevels: Record<string, number>;
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

// ---------------------------------------------------------------------------
// Original Clinica Realm systems — light, safe placeholders (Step 7).
// These describe FUTURE foundations. None of them are simulated yet; they
// exist so the Realm reads as an original, growing sanctuary system rather
// than a static building list.
// ---------------------------------------------------------------------------

export const REALM_HARMONY_NOTE =
  "Realm Harmony (future) will represent balance across the Care, Scholar, Wellness, Commerce, and " +
  "Support districts — not defense power. A well-rounded Sanctuary raises Harmony; neglecting a " +
  "district lowers it. Harmony will never be tied to attack, defense, or PvP strength.";

export interface CarePathwayExample {
  from: string;
  to: string;
  bonus: string;
}

export const CARE_PATHWAYS_EXAMPLES: CarePathwayExample[] = [
  { from: "Clinica University", to: "Research Library", bonus: "Knowledge Point bonus" },
  { from: "Hospital Ward", to: "Apothecary", bonus: "Clinical Supply bonus" },
  { from: "Nutrition Garden", to: "Lotus Cafe (future)", bonus: "Recipe Card bonus" },
  { from: "Ward Defense Tower", to: "Hospital Ward", bonus: "Stability preparation bonus" },
];

export const CARE_PATHWAYS_NOTE =
  "Care Pathways (future) will preview synergy bonuses from connecting nearby buildings — a " +
  "cooperative layout puzzle, not a combat formation. See CARE_PATHWAYS_EXAMPLES for planned pairs.";

export const DISTRICT_IDENTITY_NOTE =
  "District Identity (future) will let the Scholar, Care, Wellness, Commerce, Defense Support, and " +
  "Diplomacy districts each level up their own theme and passive flavor bonuses over time, " +
  "independent of individual building levels.";

export const HERO_RESIDENCY_NOTE =
  "Hero Residency (future) will visually show assigned heroes serving or studying at their building " +
  "— reading a book at the Research Library, tending herbs at the Apothecary — purely presentational " +
  "and layered on top of the existing assignment-slot bonuses.";

export interface SanctuaryRequestExample {
  title: string;
  building: string;
}

export const SANCTUARY_REQUESTS_EXAMPLES: SanctuaryRequestExample[] = [
  { title: "Complete a Clinical Cue review", building: "Research Library" },
  { title: "Clear one Ward Shift", building: "Hospital Ward" },
  { title: "Log one balanced-plate reflection", building: "Nutrition Garden" },
  { title: "Craft one clinical supply", building: "Apothecary" },
  { title: "Train one hero", building: "Training Hall" },
];

export const SANCTUARY_REQUESTS_NOTE =
  "Sanctuary Requests (future) will offer small, optional tasks tied to buildings you've built — " +
  "light day-to-day goals, never timers or forced daily chores. See SANCTUARY_REQUESTS_EXAMPLES.";

// ---------------------------------------------------------------------------
// Cosmetic customization direction (Step 8) — all examples below are purely
// cosmetic and will never grant gameplay power.
// ---------------------------------------------------------------------------

export interface RealmSkinExample {
  name: string;
  appliesTo: string;
}

export const REALM_SKIN_EXAMPLES: RealmSkinExample[] = [
  { name: "Moonlit Lotus University", appliesTo: "Clinica University" },
  { name: "Jade Apothecary", appliesTo: "Apothecary" },
  { name: "Cherry Blossom Hospital Ward", appliesTo: "Hospital Ward" },
  { name: "Celestial Research Library", appliesTo: "Research Library" },
  { name: "Golden Lantern Path", appliesTo: "Road / Path style" },
  { name: "Winter Healing Garden", appliesTo: "Nutrition Garden" },
  { name: "Epidemic Response Memorial", appliesTo: "Statue / Landmark decoration" },
  { name: "Festival Night Market", appliesTo: "Sanctuary Bazaar" },
];
