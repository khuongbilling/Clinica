// Material Economy & Reward Source Organization (Push 4)
// -----------------------------------------------------------------------------
// DATA + DOCUMENTATION layer only. This file catalogs every currency and
// material in Clinica so players (and future UI) can always answer:
// "What is this, where do I earn it, what is it for, which mode/building does
// it belong to, and is it power / cosmetic / wellness / learning / faction?"
//
// Nothing here implements crafting, live trading, real purchases, or loot
// tables. Full equipment crafting, marketplace trading, and paid material
// farming are explicitly NOT built yet — this is organization only.
// -----------------------------------------------------------------------------

export type MaterialCategory =
  | "core_currency"
  | "recruitment"
  | "hero_growth"
  | "player_class"
  | "realm"
  | "clinical_supplies"
  | "ward_defense"
  | "wellness"
  | "events"
  | "faction";

export type MaterialKind = "power" | "cosmetic" | "wellness" | "learning" | "faction";
export type MaterialStatus = "active" | "future";

export interface MaterialDef {
  id: string;
  name: string;
  icon: string;
  category: MaterialCategory;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  kind: MaterialKind;
  source: string;
  usedFor: string;
  relatedMode: string;
  status: MaterialStatus;
  note?: string;
  examples?: string[];
}

export const MATERIAL_CATEGORY_META: Record<MaterialCategory, { label: string; icon: string; blurb: string }> = {
  core_currency: { label: "Core Currency", icon: "diamond-outline", blurb: "The main currencies that flow through every mode." },
  recruitment: { label: "Recruitment", icon: "people-outline", blurb: "Currencies spent to recruit heroes or Ward Defense units." },
  hero_growth: { label: "Hero Growth", icon: "trending-up-outline", blurb: "Materials that level, star, and certify your heroes." },
  player_class: { label: "Player Class", icon: "school-outline", blurb: "Account-level class tree, specialization, and ascension." },
  realm: { label: "Realm", icon: "business-outline", blurb: "Building construction, upgrades, and district improvements." },
  clinical_supplies: { label: "Clinical Supplies", icon: "medkit-outline", blurb: "Future battle consumables and hero equipment foundation." },
  ward_defense: { label: "Ward Defense", icon: "shield-half-outline", blurb: "Ward Defense unit mastery, upgrades, and map progress." },
  wellness: { label: "Wellness", icon: "leaf-outline", blurb: "Lotus Plate Journal & Nutrition Garden — reflection, not restriction." },
  events: { label: "Events", icon: "flame-outline", blurb: "Limited-time materials for seasonal and lore content." },
  faction: { label: "Faction", icon: "flag-outline", blurb: "Faction and world-boss materials — future systems." },
};

// -----------------------------------------------------------------------------
// Core currencies (mirrors frontend/src/game/economy.ts CURRENCIES — kept as
// the single source of truth for currency copy; represented here so the
// Material Guide can show them alongside every other material.)
// -----------------------------------------------------------------------------
const CORE_CURRENCY_MATERIALS: MaterialDef[] = [
  {
    id: "crowns", name: "Ward Coins", icon: "diamond", category: "core_currency", rarity: "common", kind: "power",
    source: "Ward Shift, Ward Defense, daily/weekly quests, Realm production (later), events.",
    usedFor: "Basic upgrades, building upgrades, hero leveling fees, shop supplies, crafting fees.",
    relatedMode: "All modes", status: "active",
  },
  {
    id: "lotus_gems_paid", name: "Lotus Gems", icon: "diamond-outline", category: "core_currency", rarity: "epic", kind: "cosmetic",
    source: "Planned real-money bundles (not active — foundation only).",
    usedFor: "Premium cosmetics, shop bundles, passes (later), player-market purchases (later), luxury convenience.",
    relatedMode: "Shop", status: "future",
    note: "Never buys direct unfair power — cosmetics and convenience only.",
  },
  {
    id: "refined_lotus_gems", name: "Refined Lotus Gems", icon: "flower", category: "core_currency", rarity: "rare", kind: "cosmetic",
    source: "Sanctuary Bank conversion (from Insight Crystals), high-effort achievements.",
    usedFor: "Selected cosmetics, seller listing fees (later), older premium items, some building skins.",
    relatedMode: "Sanctuary Bank / Shop", status: "active",
  },
  {
    id: "insight_crystals", name: "Insight Crystals", icon: "sparkles", category: "core_currency", rarity: "uncommon", kind: "learning",
    source: "University mastery, Clinical Cue milestones, Lotus Plate Journal streaks, wellness/nutrition reflection, achievements, events.",
    usedFor: "Sanctuary Bank conversion into Refined Lotus Gems.",
    relatedMode: "Sanctuary Bank", status: "active",
  },
];

// -----------------------------------------------------------------------------
// Recruitment currencies
// -----------------------------------------------------------------------------
const RECRUITMENT_MATERIALS: MaterialDef[] = [
  {
    id: "codex_shards", name: "Codex Shards", icon: "book", category: "recruitment", rarity: "rare", kind: "power",
    source: "Ward Shift (main source). Bonus: University milestones, Clinical Cue mastery, chapter clears, boss clears, events, achievements.",
    usedFor: "Hero recruitment at the Clinica University Recruitment Hall.",
    relatedMode: "Clinica University — Recruitment Hall", status: "active",
    note: "Earned-first with capped monetization only — never unlimited paid Codex Shards.",
  },
  {
    id: "ward_sigils", name: "Ward Sigils", icon: "shield-half", category: "recruitment", rarity: "rare", kind: "power",
    source: "Ward Defense Code Rush, defense events, Vital Lantern milestones, defense quests.",
    usedFor: "Ward Defense unit recruitment, unit mastery, defense upgrades, Ward Defense shop tab.",
    relatedMode: "Ward Defense", status: "active",
    note: "Kept separate from Codex Shards so hero recruitment is never confused with Ward Defense units.",
  },
];

// -----------------------------------------------------------------------------
// Hero progression materials
// -----------------------------------------------------------------------------
const HERO_GROWTH_MATERIALS: MaterialDef[] = [
  {
    id: "hero_exp", name: "Hero EXP", icon: "trending-up", category: "hero_growth", rarity: "common", kind: "power",
    source: "Ward Shift battles, Ward Defense participation (if heroes are used), Training Hall passive training (later), event battles.",
    usedFor: "Hero Level and stat growth.",
    relatedMode: "Ward Shift / Training Hall", status: "active",
  },
  {
    id: "hero_shards", name: "Hero Shards", icon: "person-add", category: "hero_growth", rarity: "rare", kind: "power",
    source: "Duplicate recruitment, Ward Shift chapter drops, events, hero-specific missions, future Bazaar (with limits).",
    usedFor: "Hero certification / star progression and hero-specific advancement.",
    relatedMode: "University — Hero Certification", status: "active",
  },
  {
    id: "class_trainees", name: "Class Trainees", icon: "school", category: "hero_growth", rarity: "uncommon", kind: "power",
    source: "Clinica University, Training Hall, Recruitment, events.",
    usedFor: "Certification / star support and class-based hero development.",
    relatedMode: "University — Training Hall", status: "active",
    examples: ["Assess Trainee", "Treat Trainee", "Stabilize Trainee", "Protect Trainee", "Support Trainee", "Reassess Trainee"],
  },
  {
    id: "skill_books", name: "Skill Books", icon: "book-outline", category: "hero_growth", rarity: "rare", kind: "power",
    source: "Clinica University, Training Hall, events, boss rewards.",
    usedFor: "Hero skill rank and Clinical Arts upgrades.",
    relatedMode: "University — Training Hall", status: "active",
    examples: ["Airway Skill Book", "Assessment Skill Book", "Stabilization Skill Book", "Pharmacology Skill Book", "Nutrition Skill Book", "Emergency Skill Book"],
  },
  {
    id: "clinical_certificates", name: "Clinical Certificates", icon: "ribbon", category: "hero_growth", rarity: "epic", kind: "power",
    source: "Ward Shift boss clears, chapter mastery, University exams, advanced simulations, events.",
    usedFor: "Higher hero certification, advanced skill unlocks, class milestones.",
    relatedMode: "University — Hero Certification", status: "active",
  },
];

// -----------------------------------------------------------------------------
// Player class progression materials
// -----------------------------------------------------------------------------
const PLAYER_CLASS_MATERIALS: MaterialDef[] = [
  {
    id: "knowledge_points", name: "Knowledge Points", icon: "bulb", category: "player_class", rarity: "uncommon", kind: "learning",
    source: "Clinica University, Research Library, Clinical Cue mastery, University lessons, Realm University assignment (later).",
    usedFor: "Player class tree, research bonuses, learning progression, account-level passives.",
    relatedMode: "University", status: "active",
  },
  {
    id: "class_manuals", name: "Class Manuals", icon: "reader", category: "player_class", rarity: "epic", kind: "learning",
    source: "University lessons, school completion, chapter milestones, exam events.",
    usedFor: "Player class specialization at Level 10/20/30.",
    relatedMode: "University", status: "active",
    examples: ["Guardian Manual", "Seer Manual", "Caretaker Manual", "Scholar Manual", "Alchemist Manual", "Medic Manual"],
  },
  {
    id: "ascension_seals", name: "Ascension Seals", icon: "medal", category: "player_class", rarity: "legendary", kind: "power",
    source: "Major boss clears, chapter finales, University exams, limited events.",
    usedFor: "Class change and major account progression.",
    relatedMode: "University", status: "active",
    note: "Not directly purchasable.",
  },
];

// -----------------------------------------------------------------------------
// Realm building materials
// -----------------------------------------------------------------------------
const REALM_MATERIALS: MaterialDef[] = [
  { id: "ward_timber", name: "Ward Timber", icon: "hammer", category: "realm", rarity: "common", kind: "power",
    source: "Realm activities, Ward Shift, daily quests, future building production, events.",
    usedFor: "Building construction, building upgrades, district improvements, Realm customization support.",
    relatedMode: "Realm", status: "active" },
  { id: "healing_clay", name: "Healing Clay", icon: "water", category: "realm", rarity: "common", kind: "power",
    source: "Realm activities, Ward Shift, daily quests, events.",
    usedFor: "Building construction and upgrades.", relatedMode: "Realm", status: "active" },
  { id: "spirit_stone", name: "Spirit Stone", icon: "diamond-outline", category: "realm", rarity: "uncommon", kind: "power",
    source: "Realm activities, Ward Shift, events.",
    usedFor: "Building construction and upgrades.", relatedMode: "Realm", status: "active" },
  { id: "sterile_kits_realm", name: "Sterile Kits", icon: "medkit", category: "realm", rarity: "common", kind: "power",
    source: "Realm activities, daily quests, events.",
    usedFor: "Building construction and district improvements.", relatedMode: "Realm", status: "active" },
  { id: "herb_bundles", name: "Herb Bundles", icon: "leaf", category: "realm", rarity: "common", kind: "power",
    source: "Realm activities, Ward Shift, events.",
    usedFor: "Building construction and upgrades.", relatedMode: "Realm", status: "active" },
  { id: "lab_reagents", name: "Lab Reagents", icon: "flask", category: "realm", rarity: "uncommon", kind: "power",
    source: "Realm activities, Ward Shift, events.",
    usedFor: "Building construction and upgrades.", relatedMode: "Realm", status: "active" },
  { id: "building_blueprints", name: "Building Blueprints", icon: "document-text", category: "realm", rarity: "rare", kind: "power",
    source: "Realm activities, future building production, events.",
    usedFor: "Unlocking new building tiers and Realm customization support.", relatedMode: "Realm", status: "active" },
  { id: "aether_glass", name: "Aether Glass", icon: "sparkles-outline", category: "realm", rarity: "epic", kind: "power",
    source: "Boss clears, events, future faction/world boss, high-level Realm production.",
    usedFor: "Higher building upgrades and district upgrades.", relatedMode: "Realm", status: "future" },
  { id: "lotus_core", name: "Lotus Core", icon: "flower-outline", category: "realm", rarity: "epic", kind: "power",
    source: "Boss clears, events, high-level Realm production.",
    usedFor: "Premium-looking non-paid Realm progression.", relatedMode: "Realm", status: "future" },
  { id: "meridian_crystal", name: "Meridian Crystal", icon: "diamond", category: "realm", rarity: "legendary", kind: "power",
    source: "Boss clears, future faction/world boss, high-level Realm production.",
    usedFor: "Advanced research buildings and district upgrades.", relatedMode: "Realm", status: "future" },
  { id: "sanctuary_blueprint", name: "Sanctuary Blueprint", icon: "document-lock", category: "realm", rarity: "legendary", kind: "power",
    source: "Events, future faction/world boss.",
    usedFor: "Higher building upgrades.", relatedMode: "Realm", status: "future" },
  { id: "celestial_tile", name: "Celestial Tile", icon: "grid", category: "realm", rarity: "legendary", kind: "cosmetic",
    source: "Boss clears, events, high-level Realm production.",
    usedFor: "Premium-looking non-paid Realm progression and district upgrades.", relatedMode: "Realm", status: "future" },
];

// -----------------------------------------------------------------------------
// Clinical Supplies — foundation for future Push 5 (no crafting yet)
// -----------------------------------------------------------------------------
const CLINICAL_SUPPLIES_MATERIALS: MaterialDef[] = [
  { id: "oxygen_core", name: "Oxygen Core", icon: "pulse", category: "clinical_supplies", rarity: "uncommon", kind: "power",
    source: "Apothecary, Ward Shift, Hospital Ward, events, Shop.",
    usedFor: "Battle consumables, crafting, hero equipment, outbreak preparation, Ward Shift support items.",
    relatedMode: "Apothecary / Hospital Ward", status: "future" },
  { id: "sterile_kit_supply", name: "Sterile Kit", icon: "bandage", category: "clinical_supplies", rarity: "common", kind: "power",
    source: "Apothecary, Ward Shift, Hospital Ward, Shop.",
    usedFor: "Battle consumables and outbreak preparation.", relatedMode: "Apothecary / Hospital Ward", status: "future" },
  { id: "herbal_vial", name: "Herbal Vial", icon: "flask-outline", category: "clinical_supplies", rarity: "common", kind: "power",
    source: "Apothecary, Ward Shift, events.",
    usedFor: "Battle consumables and crafting.", relatedMode: "Apothecary", status: "future" },
  { id: "triage_band", name: "Triage Band", icon: "bandage-outline", category: "clinical_supplies", rarity: "uncommon", kind: "power",
    source: "Ward Shift, Hospital Ward, events.",
    usedFor: "Battle consumables and hero equipment.", relatedMode: "Hospital Ward", status: "future" },
  { id: "antiseptic_charm", name: "Antiseptic Charm", icon: "shield-checkmark-outline", category: "clinical_supplies", rarity: "rare", kind: "power",
    source: "Apothecary, events, Shop.",
    usedFor: "Hero equipment and outbreak preparation.", relatedMode: "Apothecary", status: "future" },
  { id: "respiratory_mist_ampoule", name: "Respiratory Mist Ampoule", icon: "cloud-outline", category: "clinical_supplies", rarity: "rare", kind: "power",
    source: "Ward Shift, Hospital Ward, events.",
    usedFor: "Battle consumables for respiratory encounters.", relatedMode: "Hospital Ward", status: "future" },
  { id: "stability_salve", name: "Stability Salve", icon: "medkit-outline", category: "clinical_supplies", rarity: "uncommon", kind: "power",
    source: "Apothecary, Ward Shift, Shop.",
    usedFor: "Battle consumables and Ward Shift support items.", relatedMode: "Apothecary", status: "future" },
  { id: "ward_infusion", name: "Ward Infusion", icon: "water-outline", category: "clinical_supplies", rarity: "epic", kind: "power",
    source: "Hospital Ward, events, boss rewards.",
    usedFor: "Crafting and hero equipment (future).", relatedMode: "Hospital Ward", status: "future" },
];

// -----------------------------------------------------------------------------
// Ward Defense materials
// -----------------------------------------------------------------------------
const WARD_DEFENSE_MATERIALS: MaterialDef[] = [
  { id: "vital_lantern_cores", name: "Vital Lantern Cores", icon: "flame", category: "ward_defense", rarity: "rare", kind: "power",
    source: "Ward Defense, Code Rush waves, defense bosses, defense quests.",
    usedFor: "Vital Lantern upgrades and defense tower upgrades.", relatedMode: "Ward Defense", status: "active" },
  { id: "defense_blueprints", name: "Defense Blueprints", icon: "document-text-outline", category: "ward_defense", rarity: "rare", kind: "power",
    source: "Ward Defense, defense bosses, defense quests.",
    usedFor: "New map unlocks and defense tower upgrades.", relatedMode: "Ward Defense", status: "active" },
  { id: "enemy_essence", name: "Enemy Essence", icon: "skull", category: "ward_defense", rarity: "uncommon", kind: "power",
    source: "Ward Defense, Code Rush waves, defense bosses.",
    usedFor: "Enemy intel and unit mastery.", relatedMode: "Ward Defense", status: "active" },
  { id: "unit_mastery_tokens", name: "Unit Mastery Tokens", icon: "star-half", category: "ward_defense", rarity: "rare", kind: "power",
    source: "Ward Defense, Code Rush waves, defense quests.",
    usedFor: "Ward Defense unit mastery and unit upgrades.", relatedMode: "Ward Defense", status: "active" },
  { id: "barrier_stones", name: "Barrier Stones", icon: "shield-outline", category: "ward_defense", rarity: "uncommon", kind: "power",
    source: "Ward Defense, defense quests.",
    usedFor: "Defense tower upgrades.", relatedMode: "Ward Defense", status: "future" },
  { id: "mist_condensate", name: "Mist Condensate", icon: "cloud", category: "ward_defense", rarity: "uncommon", kind: "power",
    source: "Ward Defense, Code Rush waves.",
    usedFor: "Unit upgrades and Vital Lantern upgrades.", relatedMode: "Ward Defense", status: "future" },
  { id: "airway_runes", name: "Airway Runes", icon: "aperture-outline", category: "ward_defense", rarity: "rare", kind: "power",
    source: "Defense bosses, defense quests.",
    usedFor: "Unit mastery and new map unlocks.", relatedMode: "Ward Defense", status: "future" },
];

// -----------------------------------------------------------------------------
// Lotus Journal / Nutrition Garden — wellness materials (safety-first)
// -----------------------------------------------------------------------------
const WELLNESS_MATERIALS: MaterialDef[] = [
  { id: "nourishment_petals", name: "Nourishment Petals", icon: "flower", category: "wellness", rarity: "common", kind: "wellness",
    source: "Lotus Plate Journal logging, wellness check-ins, hydration logs, balanced plate reflections.",
    usedFor: "Nutrition Garden upgrades and wellness cosmetics.", relatedMode: "Lotus Plate Journal", status: "active" },
  { id: "recipe_cards", name: "Recipe Cards", icon: "restaurant", category: "wellness", rarity: "uncommon", kind: "wellness",
    source: "Recipe completion, Lotus Plate Journal milestones.",
    usedFor: "Recipe collection.", relatedMode: "Lotus Plate Journal", status: "active" },
  { id: "nutrition_garden_seeds", name: "Nutrition Garden Seeds", icon: "leaf", category: "wellness", rarity: "common", kind: "wellness",
    source: "Nutrition Garden, wellness check-ins.",
    usedFor: "Nutrition Garden upgrades.", relatedMode: "Nutrition Garden", status: "active" },
  { id: "hydration_droplets", name: "Hydration Droplets", icon: "water", category: "wellness", rarity: "common", kind: "wellness",
    source: "Hydration logs, Lotus Plate Journal check-ins.",
    usedFor: "Nutrition Garden upgrades and wellness cosmetics.", relatedMode: "Lotus Plate Journal", status: "active" },
  { id: "fiber_sprouts", name: "Fiber Sprouts", icon: "leaf-outline", category: "wellness", rarity: "common", kind: "wellness",
    source: "Balanced plate reflections, recipe completion.",
    usedFor: "Nutrition Garden upgrades.", relatedMode: "Nutrition Garden", status: "active" },
  { id: "protein_blossoms", name: "Protein Blossoms", icon: "flower-outline", category: "wellness", rarity: "common", kind: "wellness",
    source: "Balanced plate reflections, recipe completion.",
    usedFor: "Nutrition Garden upgrades.", relatedMode: "Nutrition Garden", status: "active" },
  { id: "wellness_badges", name: "Wellness Badges", icon: "ribbon-outline", category: "wellness", rarity: "rare", kind: "wellness",
    source: "Wellness streaks and reflection milestones.",
    usedFor: "Wellness cosmetics and safe earned Insight Crystals.", relatedMode: "Lotus Plate Journal", status: "active",
    note: "Rewards reflection, learning, balance, and consistency — never dieting, weight loss, restriction, or perfect macros." },
];

// -----------------------------------------------------------------------------
// Event materials
// -----------------------------------------------------------------------------
const EVENT_MATERIALS: MaterialDef[] = [
  { id: "event_tokens", name: "Event Tokens", icon: "ticket", category: "events", rarity: "uncommon", kind: "cosmetic",
    source: "Daily event tasks, weekly milestones, boss events.",
    usedFor: "Event shop.", relatedMode: "Events (future)", status: "future" },
  { id: "limited_set_pieces", name: "Limited Set Pieces", icon: "shirt", category: "events", rarity: "epic", kind: "cosmetic",
    source: "Seasonal events, limited lore quests.",
    usedFor: "Limited cosmetics.", relatedMode: "Events (future)", status: "future" },
  { id: "lore_pages", name: "Lore Pages", icon: "document", category: "events", rarity: "rare", kind: "learning",
    source: "Limited lore quests, boss events.",
    usedFor: "Lore unlocks.", relatedMode: "Events (future)", status: "future" },
  { id: "festival_coins", name: "Festival Coins", icon: "cash", category: "events", rarity: "uncommon", kind: "cosmetic",
    source: "Seasonal events, daily event tasks.",
    usedFor: "Event shop and limited cosmetics.", relatedMode: "Events (future)", status: "future" },
  { id: "memory_seals", name: "Memory Seals", icon: "bookmark", category: "events", rarity: "rare", kind: "cosmetic",
    source: "Weekly milestones, seasonal events.",
    usedFor: "Profile titles and lore unlocks.", relatedMode: "Events (future)", status: "future" },
  { id: "seasonal_decorations", name: "Seasonal Decorations", icon: "snow", category: "events", rarity: "uncommon", kind: "cosmetic",
    source: "Seasonal events.",
    usedFor: "Realm customization (cosmetic).", relatedMode: "Events (future) / Realm", status: "future",
    note: "Some event items may become tradeable later, after a delay." },
];

// -----------------------------------------------------------------------------
// Faction & world boss / epidemic materials — future systems
// -----------------------------------------------------------------------------
const FACTION_MATERIALS: MaterialDef[] = [
  { id: "faction_marks", name: "Faction Marks", icon: "flag", category: "faction", rarity: "rare", kind: "faction",
    source: "Faction Embassy, faction missions, group contribution.",
    usedFor: "Faction shop and faction cosmetics.", relatedMode: "Faction (future)", status: "future" },
  { id: "supply_crates", name: "Supply Crates", icon: "cube", category: "faction", rarity: "uncommon", kind: "faction",
    source: "Faction missions, world events, territory support (later).",
    usedFor: "Faction shop and rare material access.", relatedMode: "Faction (future)", status: "future" },
  { id: "relief_badges", name: "Relief Badges", icon: "medkit", category: "faction", rarity: "rare", kind: "faction",
    source: "Group contribution, faction missions.",
    usedFor: "Faction cosmetics.", relatedMode: "Faction (future)", status: "future" },
  { id: "alliance_banners", name: "Alliance Banners", icon: "flag-outline", category: "faction", rarity: "epic", kind: "faction",
    source: "World events, territory support (later).",
    usedFor: "Faction cosmetics and world event preparation.", relatedMode: "Faction (future)", status: "future" },
  { id: "territory_seals", name: "Territory Seals", icon: "lock-closed-outline", category: "faction", rarity: "epic", kind: "faction",
    source: "Territory support (later), group contribution.",
    usedFor: "Rare material access.", relatedMode: "Faction (future)", status: "future" },
  { id: "epidemic_tokens", name: "Epidemic Tokens", icon: "medical", category: "faction", rarity: "epic", kind: "faction",
    source: "Future Epidemic Events, server-wide progress, faction contribution.",
    usedFor: "Limited gear sets and event cosmetics.", relatedMode: "World Boss / Epidemic (future)", status: "future" },
  { id: "world_boss_relics", name: "World Boss Relics", icon: "planet", category: "faction", rarity: "legendary", kind: "faction",
    source: "World Boss, raid milestones.",
    usedFor: "Faction upgrades and rare crafting.", relatedMode: "World Boss (future)", status: "future" },
  { id: "rare_research_samples", name: "Rare Research Samples", icon: "flask", category: "faction", rarity: "epic", kind: "faction",
    source: "World Boss, raid milestones, faction contribution.",
    usedFor: "Rare crafting and prestige rewards.", relatedMode: "World Boss (future)", status: "future" },
  { id: "outbreak_data", name: "Outbreak Data", icon: "analytics", category: "faction", rarity: "rare", kind: "faction",
    source: "Future Epidemic Events, server-wide progress.",
    usedFor: "Faction upgrades and event cosmetics.", relatedMode: "World Boss / Epidemic (future)", status: "future" },
  { id: "emergency_supply_kits", name: "Emergency Supply Kits", icon: "bag-add", category: "faction", rarity: "rare", kind: "faction",
    source: "Epidemic Events, raid milestones.",
    usedFor: "Limited gear sets and prestige rewards.", relatedMode: "World Boss / Epidemic (future)", status: "future" },
];

export const MATERIALS: MaterialDef[] = [
  ...CORE_CURRENCY_MATERIALS,
  ...RECRUITMENT_MATERIALS,
  ...HERO_GROWTH_MATERIALS,
  ...PLAYER_CLASS_MATERIALS,
  ...REALM_MATERIALS,
  ...CLINICAL_SUPPLIES_MATERIALS,
  ...WARD_DEFENSE_MATERIALS,
  ...WELLNESS_MATERIALS,
  ...EVENT_MATERIALS,
  ...FACTION_MATERIALS,
];

export function getMaterialById(id: string): MaterialDef | undefined {
  return MATERIALS.find((m) => m.id === id);
}

export function materialsByCategory(category: MaterialCategory): MaterialDef[] {
  return MATERIALS.filter((m) => m.category === category);
}

// -----------------------------------------------------------------------------
// Step 12 — Mode reward previews (what a screen shows players before they play)
// -----------------------------------------------------------------------------
export interface ModeRewardPreview {
  mode: string;
  icon: string;
  materialIds: string[];
}

export const MODE_REWARD_PREVIEWS: ModeRewardPreview[] = [
  {
    mode: "Ward Shift", icon: "flash",
    materialIds: ["crowns", "codex_shards", "hero_exp", "hero_shards", "clinical_certificates"],
  },
  {
    mode: "Ward Defense", icon: "shield-half",
    materialIds: ["ward_sigils", "vital_lantern_cores", "defense_blueprints", "enemy_essence", "unit_mastery_tokens"],
  },
  {
    mode: "Clinica University", icon: "school",
    materialIds: ["knowledge_points", "skill_books", "class_manuals", "insight_crystals", "class_trainees"],
  },
  {
    mode: "Lotus Plate Journal", icon: "leaf",
    materialIds: ["nourishment_petals", "recipe_cards", "nutrition_garden_seeds", "wellness_badges", "insight_crystals"],
  },
  {
    mode: "Realm", icon: "business",
    materialIds: ["ward_timber", "healing_clay", "spirit_stone", "sterile_kits_realm", "herb_bundles", "lab_reagents", "building_blueprints"],
  },
];

export function rewardPreviewForMode(mode: string): ModeRewardPreview | undefined {
  return MODE_REWARD_PREVIEWS.find((p) => p.mode === mode);
}

// -----------------------------------------------------------------------------
// Step 14 — Additional economy guardrails specific to the material catalog
// (complements ECONOMY_GUARDRAILS in economy.ts, not a replacement for it)
// -----------------------------------------------------------------------------
export const MATERIAL_GUARDRAILS: string[] = [
  "Lotus Gems and Refined Lotus Gems are for cosmetics, convenience, and safe premium use — never direct unfair power.",
  "Codex Shards are earned-first and not unlimited paid power; recruitment stays tied to the University Recruitment Hall.",
  "Ascension Seals are not directly purchasable.",
  "Clinical Supplies should not become unlimited paid power once crafting exists.",
  "Wellness rewards (Lotus Plate Journal / Nutrition Garden) always reward reflection, learning, balance, and consistency — never dieting, weight loss, restriction, or perfect macros.",
  "Future marketplace, faction, and event materials are not live unless explicitly released — they are shown here as documented future systems only.",
  "Every material belongs primarily to one mode so players always know where to farm it.",
];
