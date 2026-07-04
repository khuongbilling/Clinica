// Hero Equipment & Clinical Supplies Foundation (Push 5)
// -----------------------------------------------------------------------------
// DATA + DOCUMENTATION layer only, mirroring the conventions of materials.ts,
// economy.ts, and realm.ts. This file catalogs equipment slots, role-flavored
// sample items, rarity, and monetization guardrails.
//
// Explicitly NOT built here: live crafting timers, paid equipment gacha,
// random loot tables, paid best-in-slot gear, unlimited paid upgrade
// materials, instant-max equipment, or any battle-balance wiring. Equipment
// stats below are descriptive/flavor text for the foundation UI — they are
// not yet consumed by battle math. Full equipping/crafting is a future push.
// -----------------------------------------------------------------------------

import type { HeroRole } from "./types";

export type EquipmentSlot = "focusTool" | "wardGarment" | "charm" | "medicalKit" | "relic";

export type EquipmentRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export type EquipmentStatus = "active" | "future";

// Broad role families used to flavor sample equipment — looser than HeroRole
// so both the class-fantasy name (used in this push's spec) and the existing
// HeroRole enum can both key into the same item.
export type EquipmentRoleFamily =
  | "seer" // Assessor / Apprentice Seer
  | "o2healer" // Stabilizer (airway/oxygen focus)
  | "mistcaster" // Analyst (respiratory/mist focus)
  | "caretaker" // Coordinator / Village Caretaker
  | "herbalchemist" // Educator / Herbal Chemist (pharmacology)
  | "guardian"; // Specialist / Novice Guardian

export const EQUIPMENT_SLOT_META: Record<EquipmentSlot, { label: string; icon: string; blurb: string }> = {
  focusTool: { label: "Focus Tool", icon: "scan-outline", blurb: "Assessment & diagnostic instruments — sharpens what a hero can see and read." },
  wardGarment: { label: "Ward Garment", icon: "shirt-outline", blurb: "Worn protection and comfort gear — supports stability and resilience." },
  charm: { label: "Charm / Talisman", icon: "sparkles-outline", blurb: "Small worn tokens that reinforce a hero's role identity." },
  medicalKit: { label: "Medical Kit", icon: "medkit-outline", blurb: "Carried supplies and tools for treatment and support in the field." },
  relic: { label: "Relic", icon: "diamond-outline", blurb: "Rare, story-significant items — the slowest to earn, always role-fit first." },
};

export const EQUIPMENT_RARITY_META: Record<EquipmentRarity, { label: string; color: string; order: number }> = {
  common: { label: "Common", color: "#9ca3af", order: 0 },
  uncommon: { label: "Uncommon", color: "#22c55e", order: 1 },
  rare: { label: "Rare", color: "#3b82f6", order: 2 },
  epic: { label: "Epic", color: "#a855f7", order: 3 },
  legendary: { label: "Legendary", color: "#f59e0b", order: 4 },
  mythic: { label: "Mythic", color: "#ef4444", order: 5 },
};

export const EQUIPMENT_ROLE_FAMILY_META: Record<EquipmentRoleFamily, { label: string; heroRoles: HeroRole[]; icon: string }> = {
  seer: { label: "Apprentice Seer (Assessment)", heroRoles: ["Assessor"], icon: "eye-outline" },
  o2healer: { label: "O2 Healer (Airway/Stabilize)", heroRoles: ["Stabilizer"], icon: "pulse-outline" },
  mistcaster: { label: "Mist Caster (Respiratory)", heroRoles: ["Analyst"], icon: "cloud-outline" },
  caretaker: { label: "Village Caretaker (Coordination)", heroRoles: ["Coordinator"], icon: "heart-outline" },
  herbalchemist: { label: "Herbal Chemist (Pharmacology)", heroRoles: ["Educator"], icon: "flask-outline" },
  guardian: { label: "Novice Guardian (Protection)", heroRoles: ["Specialist"], icon: "shield-outline" },
};

// Upgrade requirement — foundation preview only, no live crafting execution.
export interface EquipmentUpgradeRequirement {
  materialIds: string[]; // ids referencing materials.ts MaterialDef.id where possible
  currency?: "crowns" | "insight_crystals";
  amount?: number;
}

export interface EquipmentDef {
  id: string;
  name: string;
  slot: EquipmentSlot;
  roleFamily: EquipmentRoleFamily;
  rarity: EquipmentRarity;
  level: number; // foundation baseline level, always 1 for now (no live upgrade grind)
  mainStat: string; // human-readable primary stat line, role-specific
  secondaryTrait: string; // human-readable secondary trait line
  description: string;
  source: string;
  upgradeRequires?: EquipmentUpgradeRequirement;
  relatedBuilding?: string; // Realm building id/name this item connects to
  status: EquipmentStatus;
  note?: string;
}

// -----------------------------------------------------------------------------
// Role-based stat vocabulary (Step 3) — documentation only, referenced by UI
// copy so players understand what each role family's gear tends to improve.
// -----------------------------------------------------------------------------
export const ROLE_STAT_VOCABULARY: Record<EquipmentRoleFamily, string[]> = {
  seer: ["Reveal duration", "Hidden Pathology detection", "Clinical Cue bonus", "Marked-enemy bonus", "Research/Codex bonus"],
  o2healer: ["Oxygen support", "Stability drain resistance", "Airway-enemy bonus", "Mist slow support", "Clinical Art charge"],
  caretaker: ["Stability restore", "Shield strength", "Healing support", "Reassessment bonus", "Patient-care reward bonus"],
  mistcaster: ["Mist slow support", "Airway-enemy bonus", "Oxygen support", "Reveal duration", "Clinical Art charge"],
  herbalchemist: ["Cleanse strength", "Infection/toxin counter", "Clinical supply crafting bonus", "Debuff duration", "Tincture effect"],
  guardian: ["Barrier strength", "Damage reduction", "Emergency shield", "Protect bonus", "Boss pressure resistance"],
};

// -----------------------------------------------------------------------------
// Sample role-based equipment (Step 2) — foundation items, all "future" status
// until full equipping/crafting is built. Five slots are represented across
// the six role families named in the spec.
// -----------------------------------------------------------------------------
export const EQUIPMENT_ITEMS: EquipmentDef[] = [
  // Apprentice Seer (Assessor)
  {
    id: "insight_lens", name: "Insight Lens", slot: "focusTool", roleFamily: "seer", rarity: "uncommon", level: 1,
    mainStat: "+8% Reveal duration", secondaryTrait: "+4% Hidden Pathology detection",
    description: "A folding diagnostic lens that lingers on what it reveals, giving assessors more time to read the clues.",
    source: "Research Library, Ward Shift assessment chapters, University exams.",
    upgradeRequires: { materialIds: ["lab_reagents", "codex_shards"], currency: "crowns", amount: 400 },
    relatedBuilding: "Research Library", status: "future",
  },
  {
    id: "cue_compass", name: "Cue Compass", slot: "charm", roleFamily: "seer", rarity: "rare", level: 1,
    mainStat: "+6% Clinical Cue bonus", secondaryTrait: "+3% Marked-enemy bonus",
    description: "A brass compass that always points toward the next clinical detail worth noticing.",
    source: "Clinical Cue milestones, Research Library, events.",
    upgradeRequires: { materialIds: ["skill_books"], currency: "crowns", amount: 600 },
    relatedBuilding: "Research Library", status: "future",
  },
  {
    id: "diagnostic_scroll", name: "Diagnostic Scroll", slot: "relic", roleFamily: "seer", rarity: "epic", level: 1,
    mainStat: "+10% Research/Codex bonus", secondaryTrait: "+5% Reveal duration",
    description: "A well-worn scroll of case notes passed between generations of assessors at the University.",
    source: "Clinica University advanced formulas, boss clears, events.",
    upgradeRequires: { materialIds: ["class_manuals"], currency: "insight_crystals", amount: 30 },
    relatedBuilding: "Clinica University", status: "future",
  },

  // O2 Healer (Stabilizer — airway/oxygen)
  {
    id: "oxygen_lantern_core", name: "Oxygen Lantern Core", slot: "medicalKit", roleFamily: "o2healer", rarity: "rare", level: 1,
    mainStat: "+6% Oxygen support", secondaryTrait: "+3% Stability drain resistance",
    description: "A softly glowing core that steadies breath and buys precious time during airway crises.",
    source: "Apothecary, Ward Shift airway chapters, Hospital Ward, events.",
    upgradeRequires: { materialIds: ["oxygen_core", "spirit_stone"], currency: "crowns", amount: 500 },
    relatedBuilding: "Apothecary", status: "future",
  },
  {
    id: "breath_talisman", name: "Breath Talisman", slot: "charm", roleFamily: "o2healer", rarity: "uncommon", level: 1,
    mainStat: "+5% Airway-enemy bonus", secondaryTrait: "+3% Mist slow support",
    description: "A carved talisman worn close to the chest, said to ease labored breathing nearby.",
    source: "Hospital Ward, Ward Shift, events.",
    upgradeRequires: { materialIds: ["triage_band"], currency: "crowns", amount: 350 },
    relatedBuilding: "Hospital Ward", status: "future",
  },
  {
    id: "airway_satchel", name: "Airway Satchel", slot: "wardGarment", roleFamily: "o2healer", rarity: "common", level: 1,
    mainStat: "+4% Clinical Art charge", secondaryTrait: "+3% Oxygen support",
    description: "A satchel of quick-access airway supplies, kept within arm's reach at all times.",
    source: "Apothecary, Hospital Ward, Ward Shift.",
    upgradeRequires: { materialIds: ["sterile_kit_supply"], currency: "crowns", amount: 250 },
    relatedBuilding: "Hospital Ward", status: "future",
  },

  // Mist Caster (Analyst — respiratory)
  {
    id: "respiratory_mist_ampoule_gear", name: "Respiratory Mist Ampoule", slot: "medicalKit", roleFamily: "mistcaster", rarity: "rare", level: 1,
    mainStat: "+6% Mist slow support", secondaryTrait: "+3% Airway-enemy bonus",
    description: "A pressurized ampoule of medicated mist, calibrated to slow the spread of respiratory distress.",
    source: "Ward Shift, Hospital Ward, events.",
    upgradeRequires: { materialIds: ["respiratory_mist_ampoule"], currency: "crowns", amount: 450 },
    relatedBuilding: "Hospital Ward", status: "future",
  },
  {
    id: "nebula_inhaler", name: "Nebula Inhaler", slot: "focusTool", roleFamily: "mistcaster", rarity: "uncommon", level: 1,
    mainStat: "+5% Oxygen support", secondaryTrait: "+3% Reveal duration",
    description: "A hand-held nebulizer shaped like a compact star map, easing airflow while reading vitals.",
    source: "Apothecary, Ward Shift, events.",
    upgradeRequires: { materialIds: ["herbal_vial"], currency: "crowns", amount: 300 },
    relatedBuilding: "Apothecary", status: "future",
  },
  {
    id: "cloud_charm", name: "Cloud Charm", slot: "charm", roleFamily: "mistcaster", rarity: "common", level: 1,
    mainStat: "+4% Clinical Art charge", secondaryTrait: "+2% Mist slow support",
    description: "A small charm shaped like drifting cloud wisps, favored by respiratory specialists.",
    source: "Ward Shift, events.",
    upgradeRequires: { materialIds: ["herb_bundles"], currency: "crowns", amount: 200 },
    relatedBuilding: "Apothecary", status: "future",
  },

  // Village Caretaker (Coordinator)
  {
    id: "recovery_apron", name: "Recovery Apron", slot: "wardGarment", roleFamily: "caretaker", rarity: "uncommon", level: 1,
    mainStat: "+6% Stability restore", secondaryTrait: "+3% Shield strength",
    description: "A sturdy apron lined with recovery tools, worn by caretakers who never stop moving between patients.",
    source: "Hospital Ward, Ward Shift, patient-care rewards.",
    upgradeRequires: { materialIds: ["healing_clay"], currency: "crowns", amount: 350 },
    relatedBuilding: "Hospital Ward", status: "future",
  },
  {
    id: "hearth_charm", name: "Hearth Charm", slot: "charm", roleFamily: "caretaker", rarity: "common", level: 1,
    mainStat: "+4% Healing support", secondaryTrait: "+3% Reassessment bonus",
    description: "A warm little token said to carry the comfort of home into the ward.",
    source: "Hospital Ward, Ward Shift, events.",
    upgradeRequires: { materialIds: ["ward_timber"], currency: "crowns", amount: 200 },
    relatedBuilding: "Hospital Ward", status: "future",
  },
  {
    id: "stability_kit", name: "Stability Kit", slot: "medicalKit", roleFamily: "caretaker", rarity: "rare", level: 1,
    mainStat: "+6% Shield strength", secondaryTrait: "+4% Patient-care reward bonus",
    description: "A compact kit of stabilization tools, kept ready for the moment a patient needs steadying.",
    source: "Hospital Ward, Apothecary, events.",
    upgradeRequires: { materialIds: ["stability_salve"], currency: "crowns", amount: 500 },
    relatedBuilding: "Hospital Ward", status: "future",
  },

  // Herbal Chemist (Educator — pharmacology)
  {
    id: "tincture_satchel", name: "Tincture Satchel", slot: "wardGarment", roleFamily: "herbalchemist", rarity: "uncommon", level: 1,
    mainStat: "+6% Tincture effect", secondaryTrait: "+3% Clinical supply crafting bonus",
    description: "A satchel of hand-labeled tinctures, brewed and carried by Apothecary apprentices.",
    source: "Apothecary, Ward Shift, events.",
    upgradeRequires: { materialIds: ["herbal_vial"], currency: "crowns", amount: 350 },
    relatedBuilding: "Apothecary", status: "future",
  },
  {
    id: "cleanse_vial_gear", name: "Cleanse Vial", slot: "medicalKit", roleFamily: "herbalchemist", rarity: "rare", level: 1,
    mainStat: "+6% Cleanse strength", secondaryTrait: "+3% Infection/toxin counter",
    description: "A stoppered vial of purifying solution, brewed for stubborn infections.",
    source: "Apothecary, events.",
    upgradeRequires: { materialIds: ["antiseptic_charm"], currency: "crowns", amount: 450 },
    relatedBuilding: "Apothecary", status: "future",
  },
  {
    id: "herb_codex", name: "Herb Codex", slot: "relic", roleFamily: "herbalchemist", rarity: "epic", level: 1,
    mainStat: "+8% Debuff duration", secondaryTrait: "+5% Clinical supply crafting bonus",
    description: "A hand-bound codex of herbal formulas passed down through the Apothecary's senior chemists.",
    source: "Clinica University advanced formulas, Apothecary, boss clears.",
    upgradeRequires: { materialIds: ["class_manuals"], currency: "insight_crystals", amount: 30 },
    relatedBuilding: "Clinica University", status: "future",
  },

  // Novice Guardian (Specialist — protection)
  {
    id: "barrier_charm", name: "Barrier Charm", slot: "charm", roleFamily: "guardian", rarity: "uncommon", level: 1,
    mainStat: "+5% Barrier strength", secondaryTrait: "+3% Damage reduction",
    description: "A protective charm etched with warding symbols, favored by frontline guardians.",
    source: "Training Hall, Ward Shift, events.",
    upgradeRequires: { materialIds: ["spirit_stone"], currency: "crowns", amount: 350 },
    relatedBuilding: "Training Hall", status: "future",
  },
  {
    id: "ward_shield_gear", name: "Ward Shield", slot: "medicalKit", roleFamily: "guardian", rarity: "rare", level: 1,
    mainStat: "+6% Emergency shield", secondaryTrait: "+4% Protect bonus",
    description: "A compact emergency shield kit, ready to deploy the instant a patient is at risk.",
    source: "Training Hall, Hospital Ward, events.",
    upgradeRequires: { materialIds: ["sterile_kits_realm"], currency: "crowns", amount: 500 },
    relatedBuilding: "Training Hall", status: "future",
  },
  {
    id: "protectors_garment", name: "Protector's Garment", slot: "wardGarment", roleFamily: "guardian", rarity: "epic", level: 1,
    mainStat: "+8% Boss pressure resistance", secondaryTrait: "+5% Damage reduction",
    description: "Reinforced protective wear earned through Training Hall drills against high-pressure scenarios.",
    source: "Training Hall, boss clears, events.",
    upgradeRequires: { materialIds: ["building_blueprints"], currency: "crowns", amount: 800 },
    relatedBuilding: "Training Hall", status: "future",
  },
];

export function equipmentForRoleFamily(roleFamily: EquipmentRoleFamily): EquipmentDef[] {
  return EQUIPMENT_ITEMS.filter((e) => e.roleFamily === roleFamily);
}

export function equipmentForHeroRole(role: HeroRole): EquipmentDef[] {
  const families = (Object.keys(EQUIPMENT_ROLE_FAMILY_META) as EquipmentRoleFamily[])
    .filter((fam) => EQUIPMENT_ROLE_FAMILY_META[fam].heroRoles.includes(role));
  return EQUIPMENT_ITEMS.filter((e) => families.includes(e.roleFamily));
}

// -----------------------------------------------------------------------------
// Step 7 — Rarity / role-fit identity rule (documentation, surfaced in UI copy)
// -----------------------------------------------------------------------------
export const ROLE_FIT_RULE =
  "Role fit matters more than raw rarity. A Rare item built for your hero's role can " +
  "outperform a Legendary item built for a different role — always check role fit first.";

// -----------------------------------------------------------------------------
// Step 12 — Monetization guardrails (documentation, surfaced in Shop/UI copy)
// -----------------------------------------------------------------------------
export const EQUIPMENT_MONETIZATION_GUARDRAILS = {
  allowedPaid: [
    "Equipment skins (cosmetic-only, no stat change)",
    "Cosmetic item frames",
    "Extra loadout slots (convenience, later)",
    "Limited cosmetic kits",
    "Small capped Clinical Supply bundles",
    "Crafting queue convenience (later, never required)",
  ],
  neverPaid: [
    "Best-in-slot equipment purchased directly",
    "Unlimited upgrade materials",
    "Instant-max equipment",
    "Paid-only stat gear unavailable to free play",
  ],
  note: "Equipment and Clinical Supplies are earned-first: farmable and craftable through Ward Shift, Realm buildings, and events. Paid currency never buys raw combat power here.",
};

// -----------------------------------------------------------------------------
// Step 13 — Cosmetic equipment placeholders (no power attached)
// -----------------------------------------------------------------------------
export interface CosmeticEquipmentPlaceholder {
  id: string;
  name: string;
  kind: "skin" | "frame" | "aura" | "idleVisual";
  description: string;
  status: EquipmentStatus;
}

export const COSMETIC_EQUIPMENT_PLACEHOLDERS: CosmeticEquipmentPlaceholder[] = [
  { id: "gilded_lens_skin", name: "Gilded Lens Skin", kind: "skin", description: "A gold-trimmed cosmetic reskin of a Focus Tool. No stat change.", status: "future" },
  { id: "lotus_frame", name: "Lotus Item Frame", kind: "frame", description: "A decorative lotus-petal frame around any equipped item icon. No stat change.", status: "future" },
  { id: "calm_aura", name: "Calm Aura", kind: "aura", description: "A soft cosmetic glow around a hero in the roster when a full loadout is equipped. No stat change.", status: "future" },
  { id: "idle_kit_visual", name: "Idle Gear Visual", kind: "idleVisual", description: "Equipped Medical Kit / Ward Garment shown on the hero's idle portrait. No stat change.", status: "future" },
];
