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

// Sanctuary Plot types — an original Clinica system, organized by purpose
// rather than by "attack" vs "defense" the way base-builder clones are.
export type PlotType =
  | "landmark" | "care" | "scholar" | "wellness" | "commerce"
  | "defenseSupport" | "diplomacy" | "decoration";

export interface PlotTypeMeta {
  id: PlotType;
  name: string;
  icon: string;
  description: string;
}

export const PLOT_TYPE_META: PlotTypeMeta[] = [
  { id: "landmark", name: "Landmark Plot", icon: "sparkles", description: "Anchors the Realm — required, fixed, and always visible." },
  { id: "care", name: "Care Plot", icon: "medkit", description: "Hosts patient-care and stability-support structures." },
  { id: "scholar", name: "Scholar Plot", icon: "school", description: "Hosts learning, research, and recruitment structures." },
  { id: "wellness", name: "Wellness Plot", icon: "leaf", description: "Hosts nutrition and off-shift recovery structures." },
  { id: "commerce", name: "Commerce Plot", icon: "business", description: "Hosts supply, banking, and future trade structures." },
  { id: "defenseSupport", name: "Defense Support Plot", icon: "shield-checkmark", description: "Hosts Ward Defense readiness structures — prep, not combat." },
  { id: "diplomacy", name: "Diplomacy Plot", icon: "flag", description: "Hosts future faction and collaboration structures." },
  { id: "decoration", name: "Decoration Plot", icon: "flower", description: "Purely cosmetic — lanterns, banners, statues, gardens." },
];

export function getPlotTypeMeta(type: PlotType): PlotTypeMeta {
  return PLOT_TYPE_META.find((t) => t.id === type) || PLOT_TYPE_META[PLOT_TYPE_META.length - 1];
}

export interface RealmBuilding {
  id: string;
  name: string;
  district: DistrictId;
  icon: string;
  // Position on the map background, as a percentage of width/height (0-100).
  // This is the DEFAULT position (see REALM_PLOTS / buildDefaultRealmLayout);
  // a building's live position is wherever `player.realm_layout` places it.
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
  // Push 3.6 — plot system
  size: PlotSize;
  // Landmark/anchor buildings stay put; everything else can be relocated via Move mode.
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
    icon: "sparkles",
    x: 50, y: 46,
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
    size: "large",
    movable: false,
    fixedReason: "The Grand Ward Atrium anchors the entire Realm and never moves.",
  },
  {
    id: "clinica_university",
    name: "Clinica University",
    district: "scholar",
    icon: "school",
    x: 26, y: 26,
    purpose: "Generates Knowledge Points and supports Class Manuals, Research, the Recruitment Hall, and Clinical Cue mastery.",
    benefitForLevel: (lvl) => `Lv.${lvl} generates Knowledge Points and unlocks lessons and research.`,
    nextUpgradeForLevel: (lvl) => `Next level gives +5% Knowledge generation.`,
    maxLevel: 5,
    kingdomLevelsKey: "academy_of_healing",
    requirementsForLevel: (lvl) => ({ atriumLevel: 2, materials: ["Ward Timber", "Spirit Stone", "University Credits"] }),
    atriumLevelRequired: 3,
    linkKind: "route",
    linkRoute: "/university",
    linkLabel: "Open Clinica University",
    heroSlots: [
      { role: "Scholar", flavor: "A Scholar hero here increases Knowledge Point generation.", slotType: "hero" },
      { role: "University Trainee", flavor: "A Seer or University trainee boosts research progress.", slotType: "trainee" },
      { role: "Faculty Mentor", flavor: "A Mentor here speeds up trainee learning.", slotType: "mentor" },
    ],
    skinPlaceholder: true,
    size: "large",
    movable: false,
    fixedReason: "Clinica University's main hall is a Realm landmark and stays put.",
  },
  {
    id: "research_library",
    name: "Research Library",
    district: "scholar",
    icon: "library",
    x: 16, y: 42,
    purpose: "Houses the Codex, class manuals, lore, Clinical Cue review, and research bonuses.",
    benefitForLevel: (lvl) => `Lv.${lvl} unlocks deeper Codex entries and Clinical Cue review tools.`,
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
    size: "medium",
    movable: true,
  },
  {
    id: "hospital_ward",
    name: "Hospital Ward",
    district: "care",
    icon: "medkit",
    x: 66, y: 24,
    purpose: "Supports Ward Shift preparation, Hero EXP support, Stability bonuses, and Clinical Certificates.",
    benefitForLevel: (lvl) => `Lv.${lvl} boosts stability gain during Ward Shift battles.`,
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
    size: "large",
    movable: false,
    fixedReason: "The Hospital Ward core is a Realm landmark and stays put.",
  },
  {
    id: "hall_of_heroes",
    name: "Training Hall",
    district: "care",
    icon: "people-circle",
    x: 78, y: 42,
    purpose: "Supports hero training, Skill Books, Class Trainees, and practice simulations.",
    benefitForLevel: (lvl) => `Lv.${lvl} raises the Hero EXP cap and trainee capacity.`,
    nextUpgradeForLevel: (lvl) => `Next level adds another training slot.`,
    maxLevel: 5,
    kingdomLevelsKey: "hall_of_heroes",
    requirementsForLevel: (lvl) => ({ atriumLevel: 2, materials: ["Spirit Stone", "Skill Books"] }),
    atriumLevelRequired: 2,
    linkKind: "route",
    linkRoute: "/(tabs)/heroes",
    linkLabel: "Open Hall of Heroes",
    heroSlots: [
      { role: "Drillmaster", flavor: "A Drillmaster hero here speeds up hero training.", slotType: "hero" },
      { role: "Class Trainee", flavor: "A Trainee here runs practice simulations for bonus Skill Books.", slotType: "trainee" },
      { role: "Veteran Mentor", flavor: "A Mentor here improves trainee outcomes.", slotType: "mentor" },
    ],
    skinPlaceholder: true,
    size: "medium",
    movable: true,
  },
  {
    id: "apothecary",
    name: "Apothecary",
    district: "commerce",
    icon: "flask",
    x: 62, y: 60,
    purpose: "Supports Clinical Supplies, Herbal Vials, Sterile Kits, crafting, and links to the Shop.",
    benefitForLevel: (lvl) => `Lv.${lvl} unlocks more consumables per shift.`,
    nextUpgradeForLevel: (lvl) => `Next level adds a new consumable slot.`,
    maxLevel: 5,
    kingdomLevelsKey: "apothecary",
    requirementsForLevel: (lvl) => ({ atriumLevel: 1, materials: ["Ward Coins", "Herbal Extract"] }),
    atriumLevelRequired: 1,
    linkKind: "route",
    linkRoute: "/(tabs)/shop",
    linkLabel: "Open the Shop",
    heroSlots: [
      { role: "Herbalist", flavor: "A Herbal-type hero here improves clinical supply crafting.", slotType: "hero" },
      { role: "Alchemist Trainee", flavor: "A Treat/Alchemist trainee boosts Clinical Supply production.", slotType: "trainee" },
    ],
    skinPlaceholder: true,
    size: "medium",
    movable: true,
  },
  {
    id: "sanctuary_bank",
    name: "Sanctuary Bank",
    district: "commerce",
    icon: "business",
    x: 74, y: 66,
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
    size: "medium",
    movable: true,
  },
  {
    id: "sanctuary_bazaar",
    name: "Sanctuary Bazaar (Night Market)",
    district: "commerce",
    icon: "moon",
    x: 88, y: 58,
    purpose: "Future placeholder for a cosmetic/collectible trading economy — not live yet, and never resource-stealing or PvP trading.",
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
    size: "medium",
    movable: true,
  },
  {
    id: "nutrition_garden",
    name: "Nutrition Garden",
    district: "wellness",
    icon: "leaf",
    x: 34, y: 66,
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
    size: "medium",
    movable: true,
  },
  {
    id: "ward_defense_tower",
    name: "Ward Defense Tower",
    district: "defense",
    icon: "shield",
    x: 40, y: 82,
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
    size: "medium",
    movable: true,
  },
  {
    id: "faction_embassy",
    name: "Faction Embassy",
    district: "diplomacy",
    icon: "flag",
    x: 60, y: 88,
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
    size: "large",
    movable: false,
    fixedReason: "The Faction Embassy landmark plot is reserved and stays put.",
  },
];

export function getAtriumLevel(kingdomLevels: Record<string, number>): number {
  return kingdomLevels[ATRIUM_ID] || 0;
}

export function isBuildingUnlocked(building: RealmBuilding, atriumLevel: number): boolean {
  if (building.isAtrium) return true;
  return atriumLevel >= building.atriumLevelRequired;
}

// ---------------------------------------------------------------------------
// Push 3.6 — Plot system
//
// A "plot" is a fixed footprint on the Realm map. Buildings live ON plots via
// player.realm_layout (buildingId -> plotId); decorations live on plots via
// player.realm_decor (plotId -> decorationId). Plots are predefined — there is
// no free-placement editor. Some plots ship locked, to be unlocked by future
// progression, giving the Realm room to grow without new code.
// ---------------------------------------------------------------------------

export type PlotUnlockRequirement =
  | { kind: "atriumLevel"; level: number; label: string }
  | { kind: "playerLevel"; level: number; label: string }
  | { kind: "chapter"; chapter: number; label: string }
  | { kind: "buildingBuilt"; buildingId: string; label: string };

export interface RealmPlot {
  id: string;
  name: string;
  district: DistrictId;
  // Sanctuary Plot type — what kind of structure this plot is meant for.
  plotType: PlotType;
  size: PlotSize;
  x: number;
  y: number;
  // Building ids (or decoration ids, for decoration-only plots) allowed here.
  allowedBuildingIds: string[];
  allowedDecorationIds: string[];
  // The building associated with this plot for reference/unlock-label purposes.
  defaultBuildingId?: string;
  // Only true for the Grand Ward Atrium plot. All other plots start EMPTY for
  // a brand-new player and must be built into deliberately via Build
  // Sanctuary mode — the Realm is not pre-painted with every building.
  prebuilt?: boolean;
  // Undefined = always unlocked (subject to the occupant building's own
  // atrium gating). Defined = an extra Realm-expansion plot with its own gate.
  unlockRequirement?: PlotUnlockRequirement;
}

export const REALM_PLOTS: RealmPlot[] = [
  { id: "atrium_plot", name: "Atrium Grounds", district: "sanctuary", plotType: "landmark", size: "large", x: 50, y: 46, allowedBuildingIds: ["grand_ward_atrium"], allowedDecorationIds: [], defaultBuildingId: "grand_ward_atrium", prebuilt: true },
  { id: "university_plot", name: "University Grounds", district: "scholar", plotType: "scholar", size: "large", x: 26, y: 26, allowedBuildingIds: ["clinica_university"], allowedDecorationIds: [], defaultBuildingId: "clinica_university" },
  { id: "library_plot", name: "Library Yard", district: "scholar", plotType: "scholar", size: "medium", x: 16, y: 42, allowedBuildingIds: ["research_library"], allowedDecorationIds: [], defaultBuildingId: "research_library" },
  { id: "hospital_plot", name: "Hospital Grounds", district: "care", plotType: "care", size: "large", x: 66, y: 24, allowedBuildingIds: ["hospital_ward"], allowedDecorationIds: [], defaultBuildingId: "hospital_ward" },
  { id: "training_hall_plot", name: "Training Yard", district: "care", plotType: "care", size: "medium", x: 78, y: 42, allowedBuildingIds: ["hall_of_heroes", "apothecary"], allowedDecorationIds: [], defaultBuildingId: "hall_of_heroes" },
  { id: "apothecary_plot", name: "Market Row — East", district: "commerce", plotType: "commerce", size: "medium", x: 62, y: 60, allowedBuildingIds: ["apothecary", "sanctuary_bank", "sanctuary_bazaar"], allowedDecorationIds: [], defaultBuildingId: "apothecary" },
  { id: "bank_plot", name: "Market Row — South", district: "commerce", plotType: "commerce", size: "medium", x: 74, y: 66, allowedBuildingIds: ["sanctuary_bank", "apothecary", "sanctuary_bazaar"], allowedDecorationIds: [], defaultBuildingId: "sanctuary_bank" },
  { id: "bazaar_plot", name: "Market Row — Night Corner", district: "commerce", plotType: "commerce", size: "medium", x: 88, y: 58, allowedBuildingIds: ["sanctuary_bazaar", "apothecary", "sanctuary_bank"], allowedDecorationIds: [], defaultBuildingId: "sanctuary_bazaar" },
  { id: "garden_plot", name: "Garden Terrace", district: "wellness", plotType: "wellness", size: "medium", x: 34, y: 66, allowedBuildingIds: ["nutrition_garden"], allowedDecorationIds: [], defaultBuildingId: "nutrition_garden" },
  { id: "defense_plot", name: "Watch Grounds", district: "defense", plotType: "defenseSupport", size: "medium", x: 40, y: 82, allowedBuildingIds: ["ward_defense_tower"], allowedDecorationIds: [], defaultBuildingId: "ward_defense_tower" },
  { id: "embassy_plot", name: "Embassy Grounds", district: "diplomacy", plotType: "diplomacy", size: "large", x: 60, y: 88, allowedBuildingIds: ["faction_embassy"], allowedDecorationIds: [], defaultBuildingId: "faction_embassy" },

  // Empty from day one — small decoration-only plots near the Atrium so Build
  // Mode always has something to do, regardless of progression.
  {
    id: "lantern_court", name: "Lantern Court", district: "sanctuary", plotType: "decoration", size: "small", x: 40, y: 54,
    allowedBuildingIds: [], allowedDecorationIds: ["lantern", "banner", "garden_hedge", "statue"],
  },
  {
    id: "statue_court", name: "Statue Court", district: "sanctuary", plotType: "decoration", size: "small", x: 60, y: 54,
    allowedBuildingIds: [], allowedDecorationIds: ["lantern", "banner", "garden_hedge", "statue"],
  },

  // Locked expansion plots — give Move Mode somewhere new to go, and give the
  // Realm visible room to grow.
  {
    id: "scholar_annex_plot", name: "Scholar Annex Plot", district: "scholar", plotType: "scholar", size: "medium", x: 20, y: 14,
    allowedBuildingIds: ["research_library"], allowedDecorationIds: [],
    unlockRequirement: { kind: "playerLevel", level: 8, label: "Reach Player Level 8" },
  },
  {
    id: "care_support_plot", name: "Care Support Plot", district: "care", plotType: "decoration", size: "small", x: 82, y: 28,
    allowedBuildingIds: [], allowedDecorationIds: ["lantern", "banner", "garden_hedge", "statue"],
    unlockRequirement: { kind: "atriumLevel", level: 3, label: "Grand Ward Atrium Lv.3" },
  },
  {
    id: "commerce_expansion_plot", name: "Commerce Expansion Plot", district: "commerce", plotType: "commerce", size: "medium", x: 92, y: 70,
    allowedBuildingIds: ["apothecary", "sanctuary_bank", "sanctuary_bazaar"], allowedDecorationIds: [],
    unlockRequirement: { kind: "buildingBuilt", buildingId: "sanctuary_bank", label: "Build the Sanctuary Bank" },
  },
  {
    id: "wellness_grove_plot", name: "Wellness Grove Plot", district: "wellness", plotType: "decoration", size: "small", x: 24, y: 78,
    allowedBuildingIds: [], allowedDecorationIds: ["lantern", "banner", "garden_hedge", "statue"],
    unlockRequirement: { kind: "atriumLevel", level: 3, label: "Grand Ward Atrium Lv.3" },
  },
  {
    id: "defense_outpost_plot", name: "Defense Outpost Plot", district: "defense", plotType: "defenseSupport", size: "medium", x: 28, y: 90,
    allowedBuildingIds: ["ward_defense_tower"], allowedDecorationIds: [],
    unlockRequirement: { kind: "chapter", chapter: 3, label: "Clear Chapter 3" },
  },
  {
    id: "diplomacy_garden_plot", name: "Diplomacy Garden Plot", district: "diplomacy", plotType: "decoration", size: "small", x: 72, y: 94,
    allowedBuildingIds: [], allowedDecorationIds: ["lantern", "banner", "garden_hedge", "statue"],
    unlockRequirement: { kind: "atriumLevel", level: 6, label: "Grand Ward Atrium Lv.6" },
  },
];

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

export function getPlotById(id: string): RealmPlot | undefined {
  return REALM_PLOTS.find((p) => p.id === id);
}

export function getDecorationById(id: string): RealmDecoration | undefined {
  return DECORATIONS.find((d) => d.id === id);
}

// The baseline layout every new (or not-yet-migrated) player starts with.
// Only the Grand Ward Atrium (`prebuilt: true`) is placed automatically —
// every other Sanctuary Plot starts EMPTY so a new Realm reads as something
// the player builds into, not a pre-painted finished city. Existing players'
// already-saved realm_layout is untouched; this only affects fresh layouts.
export function buildDefaultRealmLayout(): Record<string, string> {
  const layout: Record<string, string> = {};
  for (const plot of REALM_PLOTS) {
    if (plot.prebuilt && plot.defaultBuildingId) layout[plot.defaultBuildingId] = plot.id;
  }
  return layout;
}

export interface RealmUnlockContext {
  atriumLevel: number;
  playerLevel: number;
  chapterProgress: number;
  kingdomLevels: Record<string, number>;
}

export function isPlotUnlocked(plot: RealmPlot, ctx: RealmUnlockContext): boolean {
  if (plot.unlockRequirement) {
    const req = plot.unlockRequirement;
    if (req.kind === "atriumLevel") return ctx.atriumLevel >= req.level;
    if (req.kind === "playerLevel") return ctx.playerLevel >= req.level;
    if (req.kind === "chapter") return ctx.chapterProgress >= req.chapter;
    if (req.kind === "buildingBuilt") return (ctx.kingdomLevels[req.buildingId] || 0) >= 1;
    return false;
  }
  // No explicit gate: a plot with a default building is unlocked once that
  // building itself is unlocked (mirrors the original atrium-gated map).
  if (plot.defaultBuildingId) {
    const building = getBuildingById(plot.defaultBuildingId);
    if (building) return isBuildingUnlocked(building, ctx.atriumLevel);
  }
  return true;
}

export function plotUnlockLabel(plot: RealmPlot): string {
  if (plot.unlockRequirement) return plot.unlockRequirement.label;
  if (plot.defaultBuildingId) {
    const building = getBuildingById(plot.defaultBuildingId);
    if (building) return `Grand Ward Atrium Lv.${building.atriumLevelRequired}`;
  }
  return "Unlocked";
}

export function isBuildingAllowedOnPlot(building: RealmBuilding, plot: RealmPlot): boolean {
  return plot.allowedBuildingIds.includes(building.id);
}

export function isDecorationAllowedOnPlot(decoration: RealmDecoration, plot: RealmPlot): boolean {
  return plot.allowedDecorationIds.includes(decoration.id);
}

// What building currently occupies a plot, if any (derived from realm_layout).
export function getOccupantBuildingId(plotId: string, layout: Record<string, string>): string | undefined {
  return Object.keys(layout).find((buildingId) => layout[buildingId] === plotId);
}

// Every plot that a movable building could relocate to: allowed by rules,
// currently unlocked, and not already occupied by another building.
export function compatiblePlotsForBuilding(
  building: RealmBuilding,
  plots: RealmPlot[],
  layout: Record<string, string>,
  ctx: RealmUnlockContext
): RealmPlot[] {
  const currentPlotId = layout[building.id];
  return plots.filter((plot) => {
    if (plot.id === currentPlotId) return false;
    if (!isBuildingAllowedOnPlot(building, plot)) return false;
    if (!isPlotUnlocked(plot, ctx)) return false;
    const occupant = getOccupantBuildingId(plot.id, layout);
    return !occupant;
  });
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
