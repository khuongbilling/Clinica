/* ═══════════════════════════════════════════════════════════════════
   WARD DEFENSE: AIRWAY CODE RUSH
   Sprite tower-defense board — Clinica: Kingdom of Healing
   NCLEX Clinical Judgment integrated throughout gameplay
   ═══════════════════════════════════════════════════════════════════ */
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated, Image, Pressable, ScrollView,
  StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WardBoardV2 } from "@/src/components/WardBoardV2";
import {
  RoleId, WARD_UNIT_META, WARD_UNIT_IDS, STARTER_UNIT_IDS,
  LOADOUT_SIZE, UNIT_LEVEL_DMG_STEP, sanitizeLoadout,
  MERGE_RANK_NAMES, MERGE_RANK_CAP, MERGE_RANK_DMG_MULT, mergeRankName,
} from "@/src/game/units";

/* ── Card portrait images — Hall of Heroes battle sprites for bottom dock ── */
const CARD_PORTRAITS: Record<string, any> = {
  ward_scout:      require("../assets/heroes/battle/apprentice_seer.png"),
  reassess_sage:   require("../assets/heroes/battle/mindkeeper.png"),
  mist_caster:     require("../assets/heroes/battle/village_caretaker.png"),
  herbal_chemist:  require("../assets/heroes/battle/wound_sage.png"),
  o2_healer:       require("../assets/heroes/battle/novice_guardian.png"),
  guardian:        require("../assets/heroes/battle/junior_warden.png"),
  rhythm_medic:    require("../assets/heroes/battle/storm_runner.png"),
  lantern_scribe:  require("../assets/heroes/battle/data_acolyte.png"),
  fever_warden:    require("../assets/heroes/battle/infection_warden.png"),
  airway_sentinel: require("../assets/heroes/battle/night_watcher.png"),
};

/* ── Disease-spirit portrait images — donghua sprites for the lobby bestiary ── */
const ENEMY_PORTRAITS: Record<string, any> = {
  breathless_wisp:    require("../assets/images/enemy_breathless_wisp.png"),
  wheeze_sprite:      require("../assets/images/enemy_wheeze_sprite.png"),
  mucus_slime:        require("../assets/images/enemy_mucus_slime.png"),
  hypoxia_wraith:     require("../assets/images/enemy_hypoxia_wraith.png"),
  panic_imp:          require("../assets/images/enemy_panic_imp.png"),
  fever_imp:          require("../assets/images/enemy_fever_imp.png"),
  shock_shade:        require("../assets/images/enemy_shock_shade.png"),
  stun_toad:          require("../assets/images/enemy_stun_toad.png"),
  corruption_leech:   require("../assets/images/enemy_corruption_leech.png"),
  bronchospasm_drake: require("../assets/images/enemy_bronchospasm_drake.png"),
};

import { usePlayer } from "@/src/game/store";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { RewardPreview } from "@/src/components/RewardPreview";
import { WARD_BOOSTS, findWardBoost } from "@/src/game/shop";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

/* ── Tick speed ── */
const TICK_MS          = 500;
const ENEMY_SPEED_BOOST = 1.3;   /* global multiplier — enemies advance a little faster */
const MAX_STABILITY    = 100;
const MAX_AP           = 15;
const INIT_AP          = 3;
const AP_REGEN_TICKS   = 20;   /* 1 AP per 10 s — passive is secondary */
const WAVE_PAUSE_TICKS = 40;   /* 20 s for pre-wave question phase */
const SPAWN_GAP_TICKS  = 7;
const KILL_AP_BONUS    = 2;
const PREWAVE_AP_BONUS = 8;    /* AP granted for correct pre-wave NCLEX answer */
const CUE_STABILIZE_BONUS = 8; /* Stability granted by the "Stability Surge" Clinical Cue tactical choice */
const CLINICAL_CHAIN_WINDOW = 40; /* ticks after an Assess hit that a Treat/Stabilize hit still combos */
const BOSS_UNREVEALED_RESIST = 0.2; /* Bronchospasm Drake shrugs off damage until an Assess reveals its weakness */
const ROAD_W           = 40;   /* visual road width in px */
const TILE_SIZE        = 46;   /* deployment tile size in px */

/* ── Stability ⇄ Corruption pressure loop (risk/loss system) ── */
const MAX_CORRUPTION          = 100;
const CORRUPTION_DRAIN_START  = 50;   /* corruption above this begins passively draining Stability */
const CORRUPTION_DRAIN_RATE   = 0.03; /* Stability lost per tick, per point of corruption over the threshold */
const CORRUPTION_MAX_PENALTY  = 3;    /* extra flat Stability/tick drain once Corruption is fully maxed */
const CORRUPTION_DAMPEN_MAX   = 0.4;  /* at full Stability, incoming corruption pressure is cut by this much */
const CORRUPTION_CLEANSE_MAX  = 0.5;  /* at full Stability, cleanse effects are boosted by this much */
const PULSE_TICKS             = 6;    /* how long the HUD danger pulses stay visible */
/* Ability cooldowns (ticks) — prevents spamming Stabilize/Protect/Reassess for free safety */
const ABILITY_COOLDOWN_TICKS: Record<string, number> = {
  broncho_burst: 14, emergency_o2: 16, positioning_order: 12, reassess_protocol: 10,
};
const STABILIZE_DIMINISH = 0.55; /* each repeat Emergency O₂ use this wave heals less */
const PROTECT_SHIELD_TICKS = 6;  /* Positioning halves incoming Stability loss for this many ticks */
const TREATMENT_FIELD_TICKS = 5; /* Broncho Burst leaves a lingering AoE field for this many ticks */
const TREATMENT_FIELD_DMG   = 4; /* per-tick damage dealt to every enemy while a Treatment Field is active */
/* Placeholder for a future mechanic: repeating the same ability back-to-back would build fatigue and
   reduce its effect. Intentionally inert — not wired into any cast path yet. */
const TREATMENT_FATIGUE_ENABLED = false;

/* Enemy route — traces the illustrated stone walkway in the reference map.
   MUST stay identical to ward-defense-v2.tsx.                              */
const PATH_WPS: [number, number][] = [
  [0.122, 0.13], /*  0  Disease Gate spawn        */
  [0.122, 0.26], /*  1  left lane upper           */
  [0.114, 0.40], /*  2  left lane                 */
  [0.114, 0.54], /*  3  left lane                 */
  [0.131, 0.68], /*  4  left lane lower           */
  [0.175, 0.78], /*  5  bottom-left curve         */
  [0.297, 0.83], /*  6  bottom lane left          */
  [0.510, 0.84], /*  7  bottom lane center        */
  [0.703, 0.83], /*  8  bottom lane right         */
  [0.825, 0.78], /*  9  bottom-right curve        */
  [0.877, 0.68], /* 10  right lane lower          */
  [0.886, 0.54], /* 11  right lane                */
  [0.886, 0.40], /* 12  right lane                */
  [0.869, 0.26], /* 13  right lane upper          */
  [0.825, 0.13], /* 14  Vital Lantern exit        */
];
const N_SEGS = PATH_WPS.length - 1;

/* ── Nine deploy pads — aligned onto the drawn cross pedestals (3 cols × 3 rows) ── */
const DEPLOY_TILES: [number, number][] = [
  [0.345, 0.350], [0.510, 0.350], [0.675, 0.350],
  [0.345, 0.493], [0.510, 0.493], [0.675, 0.493],
  [0.345, 0.626], [0.510, 0.626], [0.675, 0.626],
];

/* ═══════════════════════════════════════════════════════════════════
   CLINICAL WEAKNESS TYPES — the "clinical problem" each enemy embodies.
   Game-friendly wording (not dry medical text); drives matchup bonuses.
   ═══════════════════════════════════════════════════════════════════ */
type WeaknessId = "airway" | "oxygenation" | "secretion" | "infection" | "perfusion" | "panic" | "neuro" | "corruption";
type WeaknessDef = { label: string; icon: string; color: string };
const WEAKNESS_TYPES: Record<WeaknessId, WeaknessDef> = {
  panic:       { label: "Panic Surge",        icon: "😨", color: "#93C5FD" },
  airway:      { label: "Airway Narrowing",   icon: "🌀", color: "#F472B6" },
  secretion:   { label: "Secretion Block",    icon: "🫧", color: "#86EFAC" },
  oxygenation: { label: "Oxygenation Threat", icon: "👻", color: "#C4B5FD" },
  infection:   { label: "Inflamed Core",      icon: "🔥", color: "#FCA5A5" },
  perfusion:   { label: "Perfusion Threat",   icon: "⚡", color: "#FCD34D" },
  neuro:       { label: "Altered Neuro",      icon: "💫", color: "#8B5CF6" },
  corruption:  { label: "Protective Corruption", icon: "🐲", color: "#F97316" },
};

/* ═══════════════════════════════════════════════════════════════════
   ENEMY CATALOGUE
   ═══════════════════════════════════════════════════════════════════ */
type EnemyDef = {
  name: string; icon: string; maxHp: number;
  speed: number; damage: number; color: string;
  weakUnits: string[];   /* unit type IDs that deal full damage */
  strongUnits: string[]; /* unit type IDs that deal extra damage */
  clue: string; flavor: string; isBoss?: boolean;
  weakness: WeaknessId;
  /* Stability ⇄ Corruption pressure loop */
  corruptionPressure: number; /* Corruption added per tick while this enemy is alive on the path */
  corruptionOnLeak: number;   /* Corruption spike when this enemy reaches the Vital Lantern */
  isPriority?: boolean;       /* priority threats add more Corruption + reward bigger "Priority Controlled" cleanse */
  hiddenPathology?: boolean;  /* elite threat — shrugs off most damage until an Assess hit reveals its true weakness */
  behavior?: "swarm" | "bruiser" | "burst" | "disabler" | "regenerator" | "elite";
  /* ── distinct lane behaviours (all optional / additive) ── */
  selfHealPerTick?: number;   /* Corruption Leech regenerates HP while alive */
  speedBurstChance?: number;  /* Shock Shade — chance per tick to lurch forward at double speed */
  stunOnPass?: boolean;       /* Stun Toad — briefly disables the nearest deployed unit it passes */
  /* Player-facing ability blurb — MUST describe the spirit's real mechanical behaviour */
  ability: { name: string; desc: string };
};

const ENEMY_DATA: Record<string, EnemyDef> = {
  breathless_wisp: {
    name: "Dyspnea Wisp", icon: "💨",
    maxHp: 55, speed: 0.058, damage: 8, color: "#60A5FA",
    weakUnits: ["ward_scout"],
    strongUnits: [],
    clue: "Dyspnea",
    flavor: "A restless wisp that steals breath — early assessment reveals its pattern.",
    weakness: "panic",
    corruptionPressure: 0.12, corruptionOnLeak: 6, behavior: "swarm",
    ability: { name: "Fleeting Breath", desc: "Fragile and low-health — falls quickly to a well-matched healer, but slips forward if ignored." },
  },
  wheeze_sprite: {
    name: "Wheeze Spirit", icon: "🌀",
    maxHp: 80, speed: 0.065, damage: 10, color: "#F472B6",
    weakUnits: ["mist_caster", "airway_sentinel"],
    strongUnits: [],
    clue: "Wheezing",
    flavor: "Tightens airways — a wheeze audible on auscultation. Mist and suction clear it.",
    weakness: "airway",
    corruptionPressure: 0.15, corruptionOnLeak: 8, behavior: "swarm",
    ability: { name: "Airway Constrict", desc: "Steady mid-tier threat; Mist Caster and Airway Sentinel cut it down fastest." },
  },
  mucus_slime: {
    name: "Mucus Slime", icon: "🫧",
    maxHp: 95, speed: 0.042, damage: 14, color: "#86EFAC",
    weakUnits: ["herbal_chemist", "airway_sentinel"],
    strongUnits: [],
    clue: "Secretions",
    flavor: "A slow secretion blob — suction and drainage break it apart.",
    weakness: "secretion",
    corruptionPressure: 0.18, corruptionOnLeak: 8, behavior: "bruiser",
    ability: { name: "Sticky Mass", desc: "Slow but high-health and hard-hitting — Herbal Chemist and Airway Sentinel break it apart." },
  },
  hypoxia_wraith: {
    name: "Hypoxia Wraith", icon: "👻",
    maxHp: 105, speed: 0.070, damage: 16, color: "#C4B5FD",
    weakUnits: ["o2_healer", "rhythm_medic"],
    strongUnits: [],
    clue: "Cyanosis",
    flavor: "Oxygen-starving spirit that drains the ward — supplemental O₂ is the direct counter.",
    weakness: "oxygenation",
    corruptionPressure: 0.32, corruptionOnLeak: 12, isPriority: true,
    hiddenPathology: true, behavior: "elite",
    ability: { name: "Oxygen Drain · Priority", desc: "Elite — Hidden Pathology masks its weakness until an Assess unit reveals it; moves fast and floods the lane with corruption." },
  },
  panic_imp: {
    name: "Panic Imp", icon: "😱",
    maxHp: 58, speed: 0.086, damage: 9, color: "#93C5FD",
    weakUnits: ["ward_scout", "reassess_sage", "lantern_scribe"],
    strongUnits: [],
    clue: "Agitation",
    flavor: "A frantic imp that darts down the lane — calm assessment and reassurance settle it.",
    weakness: "panic",
    corruptionPressure: 0.16, corruptionOnLeak: 7, behavior: "swarm",
    ability: { name: "Frantic Dash", desc: "The fastest spirit on the lane — reaches the Vital Lantern quickly unless intercepted early." },
  },
  fever_imp: {
    name: "Fever Imp", icon: "🔥",
    maxHp: 90, speed: 0.060, damage: 12, color: "#FCA5A5",
    weakUnits: ["herbal_chemist", "fever_warden"],
    strongUnits: [],
    clue: "Fever",
    flavor: "Inflammatory heat spirit — recognise the cue, then cool and treat the source.",
    weakness: "infection",
    corruptionPressure: 0.32, corruptionOnLeak: 12, isPriority: true,
    behavior: "burst",
    ability: { name: "Inflamed Heat · Priority", desc: "Burst threat — steadily raises corruption; cool it with Fever Warden or Herbal Chemist." },
  },
  shock_shade: {
    name: "Shock Shade", icon: "⚡",
    maxHp: 115, speed: 0.050, damage: 18, color: "#7DD3FC",
    weakUnits: ["o2_healer", "rhythm_medic", "reassess_sage"],
    strongUnits: [],
    clue: "Hypotension",
    flavor: "Circulatory-collapse shade that lurches forward in bursts — stabilise it fast.",
    weakness: "perfusion",
    corruptionPressure: 0.36, corruptionOnLeak: 14, isPriority: true,
    speedBurstChance: 0.28, behavior: "burst",
    ability: { name: "Shock Surge", desc: "Randomly lurches forward in sudden speed bursts — a priority threat that's hard to time; stabilise it fast." },
  },
  stun_toad: {
    name: "Stun Toad", icon: "😵",
    maxHp: 130, speed: 0.044, damage: 15, color: "#8B5CF6",
    weakUnits: ["guardian", "lantern_scribe"],
    strongUnits: [],
    clue: "Altered LOC",
    flavor: "A dazing toad that briefly stuns the nearest healer it lumbers past — shield the line.",
    weakness: "neuro",
    corruptionPressure: 0.30, corruptionOnLeak: 13, isPriority: true,
    stunOnPass: true, behavior: "disabler",
    ability: { name: "Dazing Pass", desc: "Briefly stuns the nearest deployed healer it passes, disabling its attacks — shield or space out your line." },
  },
  corruption_leech: {
    name: "Corruption Leech", icon: "🪱",
    maxHp: 150, speed: 0.038, damage: 16, color: "#EA580C",
    weakUnits: ["herbal_chemist", "guardian", "fever_warden"],
    strongUnits: [],
    clue: "Rising Corruption",
    flavor: "A self-mending parasite that floods the lane with corruption — burn it down quickly.",
    weakness: "corruption",
    corruptionPressure: 0.5, corruptionOnLeak: 16, isPriority: true,
    selfHealPerTick: 2, behavior: "regenerator",
    ability: { name: "Self-Mending", desc: "Regenerates its own health every moment — focus heavy, matched damage to burn it down before it heals back." },
  },
  bronchospasm_drake: {
    name: "Bronchospasm Drake", icon: "🐲",
    maxHp: 300, speed: 0.028, damage: 30, color: "#F97316",
    weakUnits: ["mist_caster"],
    strongUnits: [],
    isBoss: true,
    clue: "Bronchospasm",
    flavor: "Severe bronchospasm incarnate — Assess to expose its weakness, then hit it with bronchodilator mist. It shrugs off damage until revealed.",
    weakness: "corruption",
    corruptionPressure: 0.9, corruptionOnLeak: 30, isPriority: true,
    hiddenPathology: true, behavior: "elite",
    ability: { name: "Hardened Hide", desc: "Elite — Hidden Pathology shrugs off most damage until an Assess exposes its weakness — reveal it first, then hit with bronchodilator mist." },
  },
};

const BEHAVIOR_META: Record<string, { label: string; icon: string; counter: string }> = {
  swarm:       { label: "Swarm",       icon: "🐝", counter: "AoE Treat units clear these fastest." },
  bruiser:     { label: "Bruiser",     icon: "🛡", counter: "High single-target damage or Protect shielding works best." },
  burst:       { label: "Burst",       icon: "💥", counter: "Punishes slow reactions — pre-position matched units." },
  disabler:    { label: "Disabler",    icon: "😵", counter: "Space out or shield your line so one stun can't chain." },
  regenerator: { label: "Regenerator", icon: "🪱", counter: "Focus fire with matched damage before it heals back." },
  elite:       { label: "Elite · Hidden Pathology", icon: "🔒", counter: "Deploy an Assess unit first to expose its true weakness." },
};

/* ═══════════════════════════════════════════════════════════════════
   HEALER UNIT CATALOGUE — deployable on tiles
   ═══════════════════════════════════════════════════════════════════ */
type UnitDef = {
  name: string; color: string; apCost: number;
  damage: number; attackSpeed: number; range: number; aoe: boolean;
  category: string; role: RoleId;
  strong: string[];   /* enemy type IDs = full damage */
  weak: string[];     /* enemy type IDs = reduced damage */
  concept: string; flavor: string;
  artsName: string;   /* Clinical Arts attack name shown in feedback */
};

/* ── Clinical Arts roles — each hero's tactical identity (RoleId from src/game/units) ── */
type RoleDef = { label: string; icon: string; color: string; desc: string };
const ROLE_DATA: Record<RoleId, RoleDef> = {
  ASSESS:    { label: "Assess",    icon: "🔍", color: "#A78BFA", desc: "Reveals enemy weaknesses; enables follow-up bonus damage." },
  TREAT:     { label: "Treat",     icon: "💊", color: "#F472B6", desc: "Deals stronger damage when it matches the enemy's clinical problem." },
  STABILIZE: { label: "Stabilize", icon: "🌊", color: "#06B6D4", desc: "Protects the Vital Lantern and restores stability." },
  PROTECT:   { label: "Protect",   icon: "🛡", color: "#34D399", desc: "Shields or slows threats to the lane." },
  REASSESS:  { label: "Reassess",  icon: "🔄", color: "#EC4899", desc: "Confirms response — grants bonus AP or extra effects." },
};

/* Battle-only stats. Display meta (name/color/apCost/category/role) is merged
   in from WARD_UNIT_META (src/game/units) so the roster stays single-source. */
type UnitBattle = Pick<UnitDef, "damage" | "attackSpeed" | "range" | "aoe" | "strong" | "weak" | "concept" | "flavor" | "artsName">;
const UNIT_BATTLE: Record<string, UnitBattle> = {
  ward_scout: {
    damage: 18, attackSpeed: 2, range: 0.33, aoe: false,
    strong: ["breathless_wisp", "panic_imp"],
    weak:   ["mucus_slime", "corruption_leech", "bronchospasm_drake"],
    concept: "Auscultation identifies respiratory cues — assess before treating.",
    flavor: "Mind-element scout who reads vital signs with uncanny clarity.",
    artsName: "Moonlit Assessment Pulse",
  },
  reassess_sage: {
    damage: 21, attackSpeed: 3, range: 0.30, aoe: false,
    strong: ["panic_imp", "shock_shade"],
    weak:   ["mucus_slime", "bronchospasm_drake"],
    concept: "Reassessment catches deterioration early and confirms the response.",
    flavor: "Memory-element sage who rewinds the moment to catch what changed.",
    artsName: "Recursive Insight",
  },
  mist_caster: {
    damage: 38, attackSpeed: 4, range: 0.26, aoe: false,
    strong: ["wheeze_sprite", "bronchospasm_drake"],
    weak:   ["hypoxia_wraith", "mucus_slime", "shock_shade"],
    concept: "Bronchodilators relax airway smooth muscle — first-line for bronchospasm.",
    flavor: "Growth-element educator who soothes airway spirits with healing mist.",
    artsName: "Bronchodilator Mist",
  },
  herbal_chemist: {
    damage: 26, attackSpeed: 4, range: 0.24, aoe: true,
    strong: ["mucus_slime", "fever_imp", "corruption_leech"],
    weak:   ["hypoxia_wraith", "shock_shade"],
    concept: "Compounded remedies splash multiple threats — antibiotics and mucolytics.",
    flavor: "Alchemy-element healer who lobs volatile flasks over a cluster of spirits.",
    artsName: "Volatile Remedy Flask",
  },
  o2_healer: {
    damage: 22, attackSpeed: 3, range: 0.29, aoe: true,
    strong: ["hypoxia_wraith", "shock_shade"],
    weak:   ["wheeze_sprite", "bronchospasm_drake", "fever_imp"],
    concept: "O₂ corrects hypoxemia; positioning aids secretion drainage.",
    flavor: "River-element stabilizer whose oxygenation aura shields the whole ward.",
    artsName: "Lotus Oxygen Ward",
  },
  guardian: {
    damage: 20, attackSpeed: 3, range: 0.28, aoe: false,
    strong: ["stun_toad", "corruption_leech"],
    weak:   ["hypoxia_wraith", "breathless_wisp"],
    concept: "Positioning and barrier care shield the lane from disabling threats.",
    flavor: "Stone-element warden who braces the line with a shield bash.",
    artsName: "Aegis Bash",
  },
  rhythm_medic: {
    damage: 30, attackSpeed: 4, range: 0.27, aoe: false,
    strong: ["shock_shade", "hypoxia_wraith"],
    weak:   ["wheeze_sprite", "fever_imp"],
    concept: "Perfusion support and rhythm control restore circulatory stability.",
    flavor: "Storm-element medic who jolts collapsing spirits back into rhythm.",
    artsName: "Defib Surge",
  },
  lantern_scribe: {
    damage: 16, attackSpeed: 2, range: 0.34, aoe: false,
    strong: ["panic_imp", "stun_toad"],
    weak:   ["corruption_leech", "bronchospasm_drake"],
    concept: "Documentation and orientation cut through confusion and agitation.",
    flavor: "Light-element scribe whose lantern flare sweeps clarity down the lane.",
    artsName: "Lantern Flare Sweep",
  },
  fever_warden: {
    damage: 34, attackSpeed: 4, range: 0.26, aoe: false,
    strong: ["fever_imp", "corruption_leech"],
    weak:   ["shock_shade", "hypoxia_wraith"],
    concept: "Antipyretics and source control quench inflammatory heat.",
    flavor: "Flame-element warden who smothers fevers with a cooling wave.",
    artsName: "Cooling Ward Wave",
  },
  airway_sentinel: {
    damage: 24, attackSpeed: 3, range: 0.28, aoe: false,
    strong: ["mucus_slime", "wheeze_sprite"],
    weak:   ["shock_shade", "fever_imp"],
    concept: "Suction and airway positioning clear secretions and open the airway.",
    flavor: "Night-element sentinel who draws obstructions out with a suction pull.",
    artsName: "Suction Pull Strike",
  },
};
const UNIT_DATA: Record<string, UnitDef> = Object.fromEntries(
  WARD_UNIT_IDS.map((id) => {
    const m = WARD_UNIT_META[id];
    return [id, {
      name: m.name, color: m.color, apCost: m.apCost,
      category: m.category, role: m.role,
      ...UNIT_BATTLE[id],
    } as UnitDef];
  })
);
const UNIT_TYPES = Object.keys(UNIT_DATA);

/* ═══════════════════════════════════════════════════════════════════
   GLOBAL ABILITY CATALOGUE — bottom hand cards
   ═══════════════════════════════════════════════════════════════════ */
type AbilityDef = {
  name: string; icon: string; color: string; apCost: number;
  category: string; concept: string; flavor: string;
};

const ABILITY_DATA: Record<string, AbilityDef> = {
  broncho_burst: {
    name: "Broncho Burst", icon: "💨", color: "#F59E0B", apCost: 4,
    category: "TREAT",
    concept: "Nebulized bronchodilator treats all active bronchospasm.",
    flavor: `Deal 30 dmg to all enemies + leaves a Treatment Field (${TREATMENT_FIELD_DMG} dmg/tick for ${TREATMENT_FIELD_TICKS} ticks).`,
  },
  emergency_o2: {
    name: "Emergency O₂", icon: "🆘", color: "#34D399", apCost: 3,
    category: "STABILIZE",
    concept: "Emergency supplemental O₂ addresses immediate hypoxemia.",
    flavor: "Restore +15 Stability instantly.",
  },
  positioning_order: {
    name: "Positioning", icon: "🛌", color: "#A78BFA", apCost: 2,
    category: "PROTECT",
    concept: "Upright positioning reduces work of breathing and aids drainage.",
    flavor: "Slow all enemies 50% for 6 ticks.",
  },
  reassess_protocol: {
    name: "Reassess", icon: "🔄", color: "#EC4899", apCost: 3,
    category: "REASSESS",
    concept: "Reassessment closes the clinical loop — confirms interventions work.",
    flavor: "+5 Stability if correct units are deployed. Reveals cues.",
  },
};
const ABILITIES = Object.keys(ABILITY_DATA);

/* ── Wave definitions ── */
type WaveDef = { spawns: string[]; isBoss?: boolean };
const WAVES: WaveDef[] = [
  { spawns: ["breathless_wisp", "panic_imp", "breathless_wisp"] },
  { spawns: ["breathless_wisp", "wheeze_sprite", "panic_imp", "wheeze_sprite"] },
  { spawns: ["wheeze_sprite", "mucus_slime", "fever_imp", "panic_imp"] },
  { spawns: ["hypoxia_wraith", "mucus_slime", "fever_imp", "stun_toad", "hypoxia_wraith"] },
  { spawns: ["shock_shade", "stun_toad", "wheeze_sprite", "shock_shade", "corruption_leech", "mucus_slime"] },
  { spawns: ["hypoxia_wraith", "corruption_leech", "fever_imp", "shock_shade", "stun_toad", "corruption_leech", "panic_imp"] },
  { spawns: ["bronchospasm_drake"], isBoss: true },
];

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
type ActiveEnemy = {
  uid: string; typeId: string; hp: number; maxHp: number;
  pathIndex: number; pathProgress: number;
  hitFlash: number; slowTicks: number;
  revealed: boolean;   /* weakness cue discovered by an Assess hit */
  assessTick: number;  /* tick of most recent Assess hit — Clinical Chain window */
  chainFlash: number;  /* ticks of gold Clinical Chain hit-flash */
};

type DeployedUnit = {
  uid: string; typeId: string; tileIndex: number;
  cooldown: number; castFlash: number;
  level: number;      /* Merge Rank 1-5 (Novice→Ascended) — battle-only, resets each run */
  mergeFlash: number; /* ticks of golden merge-ascension glow */
  atkDx?: number; atkDy?: number; /* normalized direction to last target — drives lunge choreography */
  stunTicks?: number; /* ticks this unit is disabled by a Stun Toad passing */
};

type Projectile = {
  uid: string; toEnemyUid: string;
  fromFx: number; fromFy: number;
  toFx: number; toFy: number;
  progress: number; color: string;
  damage: number; unitTypeId: string;
};

type Feedback = {
  id: string; text: string; color: string;
  quality: "strong" | "partial" | "weak" | "bonus"; ticks: number;
};

type Phase = "lobby" | "playing" | "wave_pause" | "won" | "lost";
type EnemyMasteryEntry = { defeated: boolean; correctDefeated: boolean };
type LearningStats = {
  priorityActions: number;
  strongMatches: number; partialMatches: number; weakMatches: number;
  peakCareChain: number; reassessUses: number;
  learnedConcepts: string[];
  enemyMastery: Record<string, EnemyMasteryEntry>;
};

type GS = {
  phase: Phase; wave: number;
  stability: number; ap: number; apTimer: number;
  deployedUnits: DeployedUnit[];
  enemies: ActiveEnemy[]; projectiles: Projectile[];
  spawnQueue: string[]; spawnTimer: number;
  wavePauseTicks: number; feedbacks: Feedback[];
  score: number; tickCount: number; uidSeed: number;
  /* NCLEX learning */
  careChain: number; peakCareChain: number; priorityActions: number;
  strongMatches: number; partialMatches: number; weakMatches: number;
  reassessUses: number; learnedConcepts: string[];
  enemyMastery: Record<string, EnemyMasteryEntry>;
  lastKillQuality: "strong" | "partial" | "weak" | null;
  /* Clinical Arts Stage 1 */
  cueBonusReady: boolean; /* correct Clinical Cue answer primes next strong hit */
  /* Stability ⇄ Corruption pressure loop */
  corruption: number;
  stabilityPulse: number;   /* ticks remaining on the red/orange "Stability dropped" HUD flash */
  corruptionPulse: number;  /* ticks remaining on the purple "Corruption rising" HUD flash */
  shieldTicks: number;      /* Positioning shield — halves incoming Stability loss while active */
  abilityCooldowns: Record<string, number>;
  stabilizeUsesThisWave: number; /* diminishing returns for repeated Emergency O₂ casts */
  loadout: string[];             /* unit type ids the player may deploy this run */
  unitLevels: Record<string, number>; /* persistent collection level per unit → damage bonus */
  treatmentFieldTicks: number; /* Treatment Field — lingering AoE tick damage left by Broncho Burst */
};

/* ═══════════════════════════════════════════════════════════════════
   PURE HELPERS
   ═══════════════════════════════════════════════════════════════════ */
function freshMastery(): Record<string, EnemyMasteryEntry> {
  const m: Record<string, EnemyMasteryEntry> = {};
  Object.keys(ENEMY_DATA).forEach(k => { m[k] = { defeated: false, correctDefeated: false }; });
  return m;
}

function freshState(
  boost?: { startAP?: number; startShield?: number },
  loadout?: string[],
  unitLevels?: Record<string, number>,
): GS {
  const startAp = cl(INIT_AP + (boost?.startAP || 0), 0, MAX_AP);
  const startShieldTicks = boost?.startShield ? Math.round(boost.startShield) : 0;
  return {
    phase: "lobby", wave: 0,
    loadout: (loadout && loadout.length > 0) ? loadout : [...STARTER_UNIT_IDS],
    unitLevels: unitLevels || {},
    stability: MAX_STABILITY, ap: startAp, apTimer: AP_REGEN_TICKS,
    deployedUnits: [], enemies: [], projectiles: [],
    spawnQueue: [], spawnTimer: 0, wavePauseTicks: 0, feedbacks: [],
    score: 0, tickCount: 0, uidSeed: 0,
    careChain: 0, peakCareChain: 0, priorityActions: 0,
    strongMatches: 0, partialMatches: 0, weakMatches: 0,
    reassessUses: 0, learnedConcepts: [], enemyMastery: freshMastery(),
    lastKillQuality: null,
    cueBonusReady: false,
    corruption: 0, stabilityPulse: 0, corruptionPulse: 0, shieldTicks: startShieldTicks,
    abilityCooldowns: {}, stabilizeUsesThisWave: 0, treatmentFieldTicks: 0,
  };
}

function beginWave(gs: GS, waveIdx: number): GS {
  return {
    ...gs, wave: waveIdx, phase: "playing",
    spawnQueue: [...WAVES[waveIdx].spawns],
    spawnTimer: 0, enemies: [], projectiles: [],
    feedbacks: [], wavePauseTicks: 0,
    stabilizeUsesThisWave: 0,
  };
}

/* ── Vital Lantern Stability States — named thresholds shown on the HUD ── */
const STABILITY_STATES = [
  { min: 0,  max: 20,  label: "Critical",  color: "#F87171", desc: "The ward is failing — every leak now risks defeat." },
  { min: 20, max: 45,  label: "Strained",  color: "#FBBF24", desc: "Under heavy pressure — prioritize stabilizing units." },
  { min: 45, max: 75,  label: "Stable",    color: "#34D399", desc: "Holding steady — keep matching treatments to threats." },
  { min: 75, max: 101, label: "Fortified", color: "#22D3EE", desc: "The ward is thriving — corruption pressure is dampened." },
];
function getStabilityState(stability: number) {
  return STABILITY_STATES.find(st => stability >= st.min && stability < st.max) ?? STABILITY_STATES[0];
}

function cl(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function lp(a: number, b: number, t: number)   { return a + (b - a) * cl(t, 0, 1); }

function getEnemyPosFrac(e: ActiveEnemy): { x: number; y: number } {
  const pi = cl(e.pathIndex, 0, N_SEGS - 1);
  const from = PATH_WPS[pi], to = PATH_WPS[pi + 1];
  return { x: lp(from[0], to[0], e.pathProgress), y: lp(from[1], to[1], e.pathProgress) };
}

function getUnitPosFrac(tileIdx: number): { x: number; y: number } {
  return { x: DEPLOY_TILES[tileIdx][0], y: DEPLOY_TILES[tileIdx][1] };
}

function distFrac(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function getMatchQuality(unitTypeId: string, enemyTypeId: string): "strong" | "partial" | "weak" {
  const u = UNIT_DATA[unitTypeId];
  if (u.strong.includes(enemyTypeId)) return "strong";
  if (u.weak.includes(enemyTypeId))   return "weak";
  return "partial";
}

function applyDmg(base: number, q: "strong" | "partial" | "weak"): number {
  return q === "strong" ? base : q === "partial" ? Math.round(base * 0.55) : Math.round(base * 0.25);
}

function calcRewards(won: boolean, stability: number) {
  if (won) {
    const b = Math.floor(stability / 20);
    return { codexShards: 22 + b * 4, playerXp: 70 + b * 8, heroXp: 25 + b * 3, airCatalyst: b + 1 };
  }
  return { codexShards: 6, playerXp: 18, heroXp: 8, airCatalyst: 0 };
}

/* ── Care Synthesis helpers ── */
function getScaledStats(def: UnitDef, mergeRank: number, unitLevel: number = 1) {
  const rank = cl(mergeRank, 1, MERGE_RANK_CAP);
  const dmgMult = MERGE_RANK_DMG_MULT[rank - 1];
  /* Persistent collection level (from gacha duplicates) adds a modest damage bonus. */
  const masteryMult = 1 + UNIT_LEVEL_DMG_STEP * (Math.max(1, unitLevel) - 1);
  return {
    damage:      Math.round(def.damage * dmgMult * masteryMult),
    attackSpeed: Math.max(1, def.attackSpeed - (rank - 1) * 0.6),
    range:       def.range + (rank - 1) * 0.03,
  };
}

function findMergePair(units: DeployedUnit[]): [DeployedUnit, DeployedUnit] | null {
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i], b = units[j];
      if (a.typeId === b.typeId && a.level === b.level && a.level < MERGE_RANK_CAP) return [a, b];
    }
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════
   ARENA FLOOR — stone courtyard tiles replacing the blueprint grid
   ═══════════════════════════════════════════════════════════════════ */
function ArenaFloor({ aw, ah }: { aw: number; ah: number }) {
  if (aw < 20 || ah < 20) return null;
  const SW = 54, SH = 40;
  const cols = Math.ceil(aw / SW) + 2;
  const rows = Math.ceil(ah / SH) + 2;
  return (
    <>
      {/* Stone floor tiles — very dark, creates strong contrast with bright stone lane */}
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const offsetX = r % 2 === 0 ? 0 : SW / 2;
          const variant = (r * 3 + c * 7) % 6;
          const bg = variant < 2 ? "#050403" : variant < 4 ? "#060504" : "#070605";
          return (
            <View key={`s${r}_${c}`} style={{
              position: "absolute",
              left: c * SW - offsetX - SW / 2,
              top: r * SH - SH / 2,
              width: SW - 1.5,
              height: SH - 1.5,
              backgroundColor: bg,
              borderWidth: 0.5,
              borderColor: "#0e0c08",
              zIndex: 0,
            }} />
          );
        })
      )}
      {/* Ambient clinical rune glows scattered across the arena floor */}
      {([
        [0.22, 0.20, "#22d3ee", 18],
        [0.70, 0.15, "#a78bfa", 13],
        [0.40, 0.56, "#34d399", 15],
        [0.82, 0.68, "#22d3ee", 11],
        [0.16, 0.74, "#a78bfa", 10],
        [0.58, 0.36, "#fbbf24", 8],
        [0.50, 0.80, "#34d399", 9],
      ] as [number, number, string, number][]).map(([fx, fy, col, r], i) => (
        <View key={`rg${i}`} style={{
          position: "absolute",
          left: fx * aw - r,
          top: fy * ah - r,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          backgroundColor: col + "07",
          borderWidth: 0.5,
          borderColor: col + "1a",
          zIndex: 0,
        }} />
      ))}
      {/* Decorative pillar shadows at four corners — gives arena depth */}
      {([[0, 0], [1, 0], [0, 1], [1, 1]] as [number, number][]).map(([cx, cy], i) => (
        <View key={`pillar${i}`} style={{
          position: "absolute",
          left: cx === 0 ? 0 : aw - 22,
          top: cy === 0 ? 0 : ah - 22,
          width: 22, height: 22,
          backgroundColor: "#00000060",
          zIndex: 0,
        }} />
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STONE LANE ROAD — wide paved stone path with visible 3D edges,
   material mortar joints, and embedded clinical rune center-stripe
   ═══════════════════════════════════════════════════════════════════ */
function PathTileRoad({ aw, ah }: { aw: number; ah: number }) {
  if (aw < 20 || ah < 20) return null;

  const ROAD_VIS  = ROAD_W;       /* full road width */
  const TILE_LONG = 30;           /* paving slab length along path */
  const TILE_GAP  = 3;
  const STEP      = TILE_LONG + TILE_GAP;

  const tiles: { cx: number; cy: number; angle: number; seg: number; idx: number }[] = [];
  for (let seg = 0; seg < N_SEGS; seg++) {
    const from = PATH_WPS[seg], to = PATH_WPS[seg + 1];
    const x1 = from[0] * aw, y1 = from[1] * ah;
    const x2 = to[0] * aw,   y2 = to[1] * ah;
    const dx = x2 - x1, dy = y2 - y1;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    const angle  = Math.atan2(dy, dx) * (180 / Math.PI);
    const n = Math.max(1, Math.floor(segLen / STEP));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      tiles.push({ cx: x1 + dx * t, cy: y1 + dy * t, angle, seg, idx: i });
    }
  }

  return (
    <>
      {/* ── Drop-shadow beneath road (depth) ── */}
      {PATH_WPS.slice(0, -1).map((wp, seg) => {
        const to = PATH_WPS[seg + 1];
        const x1 = wp[0] * aw, y1 = wp[1] * ah;
        const x2 = to[0] * aw, y2 = to[1] * ah;
        const len   = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        return (
          <View key={`shd${seg}`} style={{
            position: "absolute",
            left: (x1 + x2) / 2 - len / 2,
            top:  (y1 + y2) / 2 - (ROAD_VIS + 10) / 2,
            width: len, height: ROAD_VIS + 10,
            backgroundColor: "#00000075",
            transform: [{ rotate: `${angle}deg` }], zIndex: 1,
          }} />
        );
      })}
      {/* ── Corner junction drop-shadows ── */}
      {PATH_WPS.slice(1, -1).map(([fx, fy], i) => (
        <View key={`cshd${i}`} style={{
          position: "absolute",
          left: fx * aw - (ROAD_VIS + 10) / 2,
          top:  fy * ah - (ROAD_VIS + 10) / 2,
          width: ROAD_VIS + 10, height: ROAD_VIS + 10, borderRadius: (ROAD_VIS + 10) / 2,
          backgroundColor: "#00000075", zIndex: 1,
        }} />
      ))}
      {/* ── SOLID STONE LANE BASE — warm golden stone, clearly lighter than floor ── */}
      {PATH_WPS.slice(0, -1).map((wp, seg) => {
        const to = PATH_WPS[seg + 1];
        const x1 = wp[0] * aw, y1 = wp[1] * ah;
        const x2 = to[0] * aw, y2 = to[1] * ah;
        const len   = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        return (
          <View key={`base${seg}`} style={{
            position: "absolute",
            left: (x1 + x2) / 2 - len / 2,
            top:  (y1 + y2) / 2 - ROAD_VIS / 2,
            width: len, height: ROAD_VIS,
            backgroundColor: "#6a5030",
            transform: [{ rotate: `${angle}deg` }], zIndex: 2,
          }} />
        );
      })}
      {/* ── Corner junction stone caps ── */}
      {PATH_WPS.slice(1, -1).map(([fx, fy], i) => (
        <View key={`corner${i}`} style={{
          position: "absolute",
          left: fx * aw - ROAD_VIS / 2,
          top:  fy * ah - ROAD_VIS / 2,
          width: ROAD_VIS, height: ROAD_VIS, borderRadius: ROAD_VIS / 2,
          backgroundColor: "#6a5030", zIndex: 2,
        }} />
      ))}
      {/* ── Individual paving slabs — visible texture on bright base ── */}
      {tiles.map((tile, i) => {
        const isAlt = (tile.idx + tile.seg) % 2 === 0;
        return (
          <View key={`tile${i}`} style={{
            position: "absolute",
            left: tile.cx - TILE_LONG / 2,
            top:  tile.cy - (ROAD_VIS - 8) / 2,
            width: TILE_LONG, height: ROAD_VIS - 8,
            backgroundColor: isAlt ? "#7a6038" : "#604820",
            borderWidth: 1,
            borderColor: "#9a7a40",
            borderRadius: 3,
            transform: [{ rotate: `${tile.angle}deg` }], zIndex: 3,
          }} />
        );
      })}
      {/* ── Clinical rune center stripe — directional glow ── */}
      {PATH_WPS.slice(0, -1).map((wp, seg) => {
        const to = PATH_WPS[seg + 1];
        const x1 = wp[0] * aw, y1 = wp[1] * ah;
        const x2 = to[0] * aw, y2 = to[1] * ah;
        const len   = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        return (
          <View key={`rune${seg}`} style={{
            position: "absolute",
            left: (x1 + x2) / 2 - len / 2,
            top:  (y1 + y2) / 2 - 1.5,
            width: len, height: 3,
            backgroundColor: "#22d3ee55",
            transform: [{ rotate: `${angle}deg` }], zIndex: 4,
          }} />
        );
      })}
      {/* ── Bright top-edge highlight strip — raises road visually ── */}
      {PATH_WPS.slice(0, -1).map((wp, seg) => {
        const to = PATH_WPS[seg + 1];
        const x1 = wp[0] * aw, y1 = wp[1] * ah;
        const x2 = to[0] * aw, y2 = to[1] * ah;
        const len   = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        return (
          <View key={`hi${seg}`} style={{
            position: "absolute",
            left: (x1 + x2) / 2 - len / 2,
            top:  (y1 + y2) / 2 - ROAD_VIS / 2,
            width: len, height: 2,
            backgroundColor: "#b09050",
            transform: [{ rotate: `${angle}deg` }], zIndex: 4,
          }} />
        );
      })}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BOARD ENDPOINTS
   ═══════════════════════════════════════════════════════════════════ */

/* CORRUPTION PORTAL — dramatic void-breach replacing the small X gate */
function CorruptionPortal({ aw, ah }: { aw: number; ah: number }) {
  const [fx, fy] = PATH_WPS[0];
  const px = fx * aw, py = fy * ah;
  return (
    <View style={{ position: "absolute", left: px - 40, top: py < 50 ? 4 : py - 30, alignItems: "center", zIndex: 8 }}>
      {/* Label */}
      <Text style={{ color: "#f87171", fontSize: 6, fontWeight: "700", letterSpacing: 0.8, marginBottom: 2 }}>BREACH</Text>
      {/* Fixed-size 80×80 container — spikes + circle all anchored here */}
      <View style={{ width: 80, height: 80, alignItems: "center", justifyContent: "center" }}>
        {/* Outer halo */}
        <View style={{ position: "absolute", width: 80, height: 80, borderRadius: 40,
          backgroundColor: "#ef44440d" }} />
        {/* 8 spike diamonds around the portal — positioned relative to this 80×80 box */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
          const rr = 37;
          const rad = deg * Math.PI / 180;
          const sx = 40 + Math.sin(rad) * rr - 3.5;
          const sy = 40 - Math.cos(rad) * rr - 3.5;
          return (
            <View key={i} style={{
              position: "absolute", left: sx, top: sy,
              width: i % 2 === 0 ? 7 : 5, height: i % 2 === 0 ? 7 : 5,
              borderRadius: 1,
              backgroundColor: i % 2 === 0 ? "#ef4444cc" : "#7c1d35aa",
              transform: [{ rotate: "45deg" }],
            }} />
          );
        })}
        {/* Portal frame — 64px circle, centered */}
        <View style={{ width: 64, height: 64, borderRadius: 32,
          backgroundColor: "#0d0008",
          borderWidth: 2.5, borderColor: "#ef4444",
          alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {/* Void gradient interior */}
          <LinearGradient colors={["#2d0318", "#180010", "#050008"]}
            start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          {/* Inner corruption ring */}
          <View style={{ position: "absolute", width: 48, height: 48, borderRadius: 24,
            borderWidth: 1.5, borderColor: "#7c1d3560" }} />
          {/* Second inner ring */}
          <View style={{ position: "absolute", width: 32, height: 32, borderRadius: 16,
            borderWidth: 1, borderColor: "#ef444430" }} />
          {/* Void eye — single pulsing oval, not a cross */}
          <View style={{ width: 20, height: 14, borderRadius: 10, backgroundColor: "#ef444422",
            borderWidth: 1.5, borderColor: "#ef4444bb",
            alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444dd" }} />
          </View>
        </View>
      </View>
      {/* Crack lines at base */}
      <View style={{ flexDirection: "row", gap: 5, marginTop: 3 }}>
        {[-1, 0, 1].map((d, i) => (
          <View key={i} style={{ width: 1.5, height: 6 + Math.abs(d) * 3,
            borderRadius: 1, backgroundColor: "#ef444430",
            transform: [{ rotate: `${d * 18}deg` }] }} />
        ))}
      </View>
    </View>
  );
}

/* VITAL LANTERN SHRINE — large sacred lantern as the protected base */
function VitalLanternShrine({ stability, aw, ah }: { stability: number; aw: number; ah: number }) {
  const [fx, fy] = PATH_WPS[PATH_WPS.length - 1];
  const px = fx * aw, py = fy * ah;
  const stabState = getStabilityState(stability);
  const glow  = stabState.color;
  const glow60 = glow + "60";
  const glow30 = glow + "30";
  const glow15 = glow + "15";
  return (
    <View style={{ position: "absolute", left: px < 40 ? 2 : px - 36, top: py - 96, alignItems: "center", zIndex: 9 }}>
      {/* Wide outer glow halo */}
      <View style={{ position: "absolute", top: 8, width: 90, height: 90, borderRadius: 45,
        backgroundColor: glow15 }} />
      <View style={{ position: "absolute", top: 20, width: 64, height: 64, borderRadius: 32,
        backgroundColor: glow + "20" }} />
      {/* Label */}
      <Text style={{ color: glow, fontSize: 6.5, fontWeight: "700", letterSpacing: 0.8, marginBottom: 3 }}>VITAL LANTERN — {stabState.label.toUpperCase()}</Text>
      {/* Lantern cap — decorative top bar */}
      <View style={{ width: 56, height: 8, borderRadius: 4,
        backgroundColor: "#2e2212", borderWidth: 1.5, borderColor: glow60, marginBottom: 1 }}>
        <LinearGradient colors={["#5a4820", "#3a2c10"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 4 }} />
        {/* Cap bead dots */}
        {[-14, -7, 0, 7, 14].map((x, i) => (
          <View key={i} style={{ position: "absolute", left: 28 + x - 2, top: 2,
            width: 4, height: 4, borderRadius: 2, backgroundColor: glow + "88" }} />
        ))}
      </View>
      {/* Lantern body — larger for readability */}
      <View style={{ width: 68, height: 56, borderRadius: 10,
        backgroundColor: "#0c0e0a",
        borderWidth: 2.5, borderColor: glow60,
        alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <LinearGradient colors={[glow + "55", glow + "22", glow + "44"]}
          start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        {/* Vertical ribs */}
        {[-22, -11, 0, 11, 22].map((x, i) => (
          <View key={i} style={{ position: "absolute", left: 34 + x - 0.5, top: 0,
            width: 1, height: 56, backgroundColor: glow + "30" }} />
        ))}
        {/* Glowing diamond core — sacred healing crystal */}
        <View style={{ width: 22, height: 22, borderRadius: 3,
          backgroundColor: glow + "ee",
          transform: [{ rotate: "45deg" }] }} />
        {/* Inner glow halo */}
        <View style={{ position: "absolute", width: 38, height: 38, borderRadius: 19,
          backgroundColor: glow + "28" }} />
      </View>
      {/* Lantern base cap */}
      <View style={{ width: 46, height: 7, borderRadius: 3, marginTop: 1,
        backgroundColor: "#2e2212", borderWidth: 1, borderColor: glow + "80" }}>
        <LinearGradient colors={["#2a1e10", "#1e1608"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 3 }} />
      </View>
      {/* Tassels */}
      <View style={{ flexDirection: "row", gap: 20, marginTop: 2 }}>
        {[0, 1].map(i => (
          <View key={i} style={{ alignItems: "center" }}>
            <View style={{ width: 2, height: 18, backgroundColor: glow60, borderRadius: 1 }} />
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: glow }} />
          </View>
        ))}
      </View>
      {/* Pole connecting to pedestal */}
      <View style={{ width: 4, height: 10, backgroundColor: "#4a3c1c",
        borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: glow + "50" }} />
      {/* Stone pedestal */}
      <View style={{ width: 72, height: 18, borderRadius: 6,
        backgroundColor: "#201808", borderWidth: 1.5, borderColor: "#4a3c18",
        alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <LinearGradient colors={["#4a3c18", "#2e2410", "#1a1208"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        {/* Pedestal rune mark */}
        <View style={{ width: 28, height: 1.5, backgroundColor: glow + "60", borderRadius: 1 }} />
      </View>
      {/* Stability crystal bar */}
      <View style={{ width: 72, height: 7, borderRadius: 3.5,
        backgroundColor: "#1a1208", borderWidth: 1, borderColor: "#3a2c10",
        marginTop: 5, overflow: "hidden" }}>
        <View style={{ width: `${stability}%` as any, height: "100%",
          borderRadius: 3.5, backgroundColor: glow }} />
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DISEASE ORGANISM SPRITES — image-4 style: round blob/virus creatures
   Each is a distinct disease pathogen silhouette, not a humanoid
   ═══════════════════════════════════════════════════════════════════ */
type SpriteProps = { hitFlash: boolean; bobY: Animated.AnimatedInterpolation<number> };

/* ─── DISEASE ORGANISM SPRITES ───────────────────────────────────────────────
   Visual brief: round blob pathogen creatures from image-4 medical fantasy.
   Each sprite = a spiky/blobby round organism, NOT a humanoid.
   • All built on a centered 60×60 spike-container with an inner orb
   • Spikes placed with Math.sin/cos around the orb perimeter
   • Linear gradient gives the orb volume (highlight top-left → dark bottom-right)
   • Small cute-but-menacing faces on every orb
   ─────────────────────────────────────────────────────────────────────────── */

/* BREATHLESS WISP — silver hollow orb, wispy exhale trails, gasping hollow eyes */
function BreathlessWispSprite({ hitFlash, bobY }: SpriteProps) {
  const c    = hitFlash ? "#ffffff" : "#bfdbfe";
  const dark = "#0f2a4a";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* SPEED TRAIL — right (trailing edge as it rushes left) */}
      <View style={{ position:"absolute", right:-10, top:14, gap:3 }}>
        {[24,16,30,12,20].map((w,i)=>(
          <View key={i} style={{ width:w, height:2, borderRadius:1,
            backgroundColor:c+(["80","50","90","38","65"][i]) }}/>
        ))}
      </View>
      {/* FORWARD TENDRILS — left, reaching toward healers */}
      <View style={{ position:"absolute", top:20, left:-20 }}>
        <View style={{ width:24, height:7, borderRadius:4,
          backgroundColor:"#bfdbfe30", borderWidth:1.5, borderColor:c+"70",
          transform:[{rotate:"-14deg"}]}}/>
        <View style={{ width:18, height:6, borderRadius:4, marginTop:6,
          backgroundColor:"#bfdbfe20", borderWidth:1, borderColor:c+"45",
          transform:[{rotate:"10deg"}]}}/>
      </View>
      {/* OFFSET DROP SHADOW behind body — gives 2.5D lift */}
      <View style={{ width:36, height:56, borderRadius:18,
        borderTopLeftRadius:10, borderTopRightRadius:10,
        borderBottomLeftRadius:20, borderBottomRightRadius:20,
        backgroundColor:"#0f172a60", position:"absolute", top:4, left:4 }}/>
      {/* MAIN BODY — tall teardrop */}
      <View style={{ width:36, height:56, borderRadius:18,
        borderTopLeftRadius:10, borderTopRightRadius:10,
        borderBottomLeftRadius:20, borderBottomRightRadius:20,
        borderWidth:2, borderColor:c, overflow:"hidden",
        backgroundColor:"#1e3a8a50" }}>
        <LinearGradient colors={[c+"80","#3b82f630","#1e3a8a15"]}
          start={{x:0.15,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {/* Top highlight */}
        <View style={{ position:"absolute", top:5, left:8, width:14, height:8,
          borderRadius:7, backgroundColor:"#ffffff30" }}/>
        {/* HOLLOW SOCKET EYES — dark pits with glow core */}
        <View style={{ position:"absolute", top:16, left:4, right:4,
          flexDirection:"row", justifyContent:"space-around" }}>
          {[0,1].map(i=>(
            <View key={i} style={{ width:12, height:14, borderRadius:6,
              backgroundColor:"#0f172a", borderWidth:1.5, borderColor:dark,
              alignItems:"center", justifyContent:"center" }}>
              <View style={{ width:5, height:8, borderRadius:3, backgroundColor:"#020617" }}/>
              <View style={{ position:"absolute", width:5, height:5,
                borderRadius:3, backgroundColor:c+"90" }}/>
              <View style={{ position:"absolute", top:2, right:1.5, width:2.5, height:2.5,
                borderRadius:1.5, backgroundColor:"#93c5fd" }}/>
            </View>
          ))}
        </View>
        {/* Slashed mouth */}
        <View style={{ position:"absolute", top:36, left:8, right:8, height:4,
          borderRadius:2, backgroundColor:"#0f172a",
          borderWidth:1, borderColor:dark }}/>
      </View>
      {/* DISSOLVING TAIL STRANDS at base */}
      <View style={{ flexDirection:"row", gap:1, marginTop:-6 }}>
        {[{w:7,h:16,r:-16},{w:5,h:22,r:-5},{w:7,h:17,r:5},{w:4,h:13,r:16}].map((t,i)=>(
          <View key={i} style={{ width:t.w, height:t.h, borderRadius:999,
            backgroundColor:"#bfdbfe18", borderWidth:1, borderColor:c+"25",
            transform:[{rotate:`${t.r}deg`}]}}/>
        ))}
      </View>
    </Animated.View>
  );
}

/* WHEEZE SPRITE — angry goblin riding its own cyclone, head atop vortex body */
function WheezeSpriteSprite({ hitFlash, bobY }: SpriteProps) {
  const c    = hitFlash ? "#fff" : "#34d399";
  const dark = "#065f46";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* WIND TRAIL — right */}
      <View style={{ position:"absolute", right:-8, top:20, gap:2.5 }}>
        {[20,13,26,10,18].map((w,i)=>(
          <View key={i} style={{ width:w, height:2, borderRadius:1,
            backgroundColor:c+(["65","40","80","30","55"][i]) }}/>
        ))}
      </View>
      {/* WIND ARMS — sweeping from sides */}
      <View style={{ position:"absolute", top:14, left:-18, width:22, height:9,
        borderRadius:5, backgroundColor:dark+"90",
        borderWidth:2, borderColor:c+"80", transform:[{rotate:"28deg"}]}}/>
      <View style={{ position:"absolute", top:12, right:-16, width:22, height:9,
        borderRadius:5, backgroundColor:dark+"90",
        borderWidth:2, borderColor:c, transform:[{rotate:"-20deg"}]}}/>
      {/* OFFSET SHADOW — behind goblin head */}
      <View style={{ width:40, height:28, borderRadius:12,
        borderTopLeftRadius:8, borderTopRightRadius:16,
        backgroundColor:"#0a0a0a70", position:"absolute", top:4, left:4 }}/>
      {/* GOBLIN HEAD — angry, asymmetric, wind-pressed */}
      <View style={{ width:40, height:28, borderRadius:12,
        borderTopLeftRadius:8, borderTopRightRadius:16,
        borderWidth:2, borderColor:c, overflow:"hidden",
        backgroundColor:"#166534" }}>
        <LinearGradient colors={[c+"55","#1a6b4a","#065f46"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {/* Heavy brow ridge */}
        <View style={{ position:"absolute", top:2, left:3, right:3, height:7,
          borderRadius:4, borderBottomLeftRadius:2, borderBottomRightRadius:2,
          backgroundColor:dark }}/>
        {/* LEFT eye — wind-squinted nearly shut */}
        <View style={{ position:"absolute", top:8, left:4, width:9, height:4,
          borderRadius:2, backgroundColor:dark, transform:[{rotate:"-12deg"}]}}/>
        {/* RIGHT eye — fierce open */}
        <View style={{ position:"absolute", top:7, right:3, width:9, height:11,
          borderRadius:5, backgroundColor:dark,
          alignItems:"center", justifyContent:"center",
          borderWidth:1, borderColor:c+"60" }}>
          <View style={{ width:4, height:6, borderRadius:3, backgroundColor:c }}/>
          <View style={{ position:"absolute", top:1, right:1, width:2.5, height:2.5,
            borderRadius:1.5, backgroundColor:"#fff" }}/>
        </View>
        {/* Snout bump */}
        <View style={{ position:"absolute", top:16, right:9, width:6, height:4,
          borderRadius:3, backgroundColor:dark+"90" }}/>
        {/* Grin — clenched teeth */}
        <View style={{ position:"absolute", bottom:1, left:4, right:4, height:5,
          borderRadius:2, borderTopLeftRadius:0, borderTopRightRadius:0,
          backgroundColor:dark, flexDirection:"row",
          justifyContent:"space-around", paddingTop:1 }}>
          {[0,1,2,3].map(i=>(
            <View key={i} style={{ width:5, height:3, borderRadius:1,
              borderBottomLeftRadius:3, borderBottomRightRadius:3,
              backgroundColor:"#ecfdf5" }}/>
          ))}
        </View>
      </View>
      {/* CYCLONE BODY — cone tapering downward */}
      <View style={{ width:42, height:34, borderRadius:21,
        borderTopLeftRadius:10, borderTopRightRadius:10,
        borderBottomLeftRadius:4, borderBottomRightRadius:4,
        borderWidth:2, borderColor:c, marginTop:-3, overflow:"hidden",
        backgroundColor:"#065f4660" }}>
        <LinearGradient colors={[c+"40","#065f4672","#064e3b20"]}
          start={{x:0.25,y:0}} end={{x:0.75,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {/* Vortex swirl lines */}
        {[4,11,18,24].map((t,i)=>(
          <View key={i} style={{ position:"absolute", top:t, left:6, right:6, height:1.5,
            borderRadius:1, backgroundColor:c+(["50","35","28","18"][i]),
            transform:[{rotate:`${[-9,6,-7,4][i]}deg`}]}}/>
        ))}
      </View>
      {/* Cyclone tip */}
      <View style={{ width:8, height:10, borderRadius:4,
        borderBottomLeftRadius:999, borderBottomRightRadius:999,
        backgroundColor:dark, borderWidth:1.5, borderColor:c+"70", marginTop:-4 }}/>
      {/* Ground shadow */}
      <View style={{ width:26, height:4, borderRadius:13,
        backgroundColor:"#000000aa", marginTop:2 }}/>
    </Animated.View>
  );
}

/* MUCUS SLIME — wide dome blob monster with reaching pseudopods, fang maw */
function MucusSlimeSprite({ hitFlash, bobY }: SpriteProps) {
  const c    = hitFlash ? "#fff" : "#86efac";
  const dark = "#14532d";
  const mid  = "#166534";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* DRIP TRAIL — right */}
      <View style={{ position:"absolute", right:-4, top:12, gap:3 }}>
        {[{w:8,h:5},{w:5,h:9},{w:7,h:5}].map((d,i)=>(
          <View key={i} style={{ width:d.w, height:d.h, borderRadius:999,
            backgroundColor:c+"55" }}/>
        ))}
      </View>
      {/* MAIN PSEUDOPOD — reaching left toward healers */}
      <View style={{ position:"absolute", top:8, left:-24, zIndex:4 }}>
        <View style={{ width:28, height:14, borderRadius:7,
          borderTopRightRadius:0, borderBottomRightRadius:2,
          backgroundColor:mid, borderWidth:2, borderColor:c,
          transform:[{rotate:"-6deg"}]}}/>
        {/* Suction tip */}
        <View style={{ position:"absolute", top:1, left:-12, width:14, height:14,
          borderRadius:7, backgroundColor:dark, borderWidth:2, borderColor:c,
          alignItems:"center", justifyContent:"center" }}>
          <View style={{ width:5, height:5, borderRadius:3,
            borderWidth:1.5, borderColor:c }}/>
        </View>
      </View>
      {/* SECONDARY PSEUDOPOD — lower angle */}
      <View style={{ position:"absolute", top:28, left:-18, width:22, height:10,
        borderRadius:5, backgroundColor:mid, borderWidth:1.5, borderColor:c,
        transform:[{rotate:"18deg"}]}}/>
      {/* OFFSET DROP SHADOW */}
      <View style={{ width:56, height:40, borderRadius:20,
        borderTopLeftRadius:13, borderTopRightRadius:25,
        borderBottomLeftRadius:9, borderBottomRightRadius:17,
        backgroundColor:"#0a0a0a80", position:"absolute", top:4, left:4 }}/>
      {/* DOME BLOB BODY — wide, asymmetric */}
      <View style={{ width:56, height:40, borderRadius:20,
        borderTopLeftRadius:13, borderTopRightRadius:25,
        borderBottomLeftRadius:9, borderBottomRightRadius:17,
        borderWidth:2.5, borderColor:c, overflow:"hidden",
        backgroundColor:mid }}>
        <LinearGradient colors={[c+"60","#166534","#14532d"]}
          start={{x:0.15,y:0}} end={{x:0.85,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {/* Highlight bubble */}
        <View style={{ position:"absolute", top:5, left:8, width:15, height:8,
          borderRadius:8, backgroundColor:"#ffffff30" }}/>
        {/* Surface nodule bumps */}
        {[{t:5,l:33,s:7},{t:15,l:42,s:5},{t:7,l:19,s:4}].map((b,i)=>(
          <View key={i} style={{ position:"absolute", top:b.t, left:b.l,
            width:b.s, height:b.s, borderRadius:b.s/2,
            backgroundColor:dark, borderWidth:1, borderColor:c+"50" }}/>
        ))}
        {/* DROOPING EYES — sunken into blob, grotesque */}
        <View style={{ position:"absolute", top:7, left:6, flexDirection:"row", gap:9 }}>
          {[0,1].map(i=>(
            <View key={i} style={{ alignItems:"center" }}>
              <View style={{ width:13, height:8, borderRadius:4,
                borderBottomLeftRadius:1, borderBottomRightRadius:1,
                backgroundColor:dark, transform:[{rotate:`${i===0?-7:7}deg`}]}}/>
              <View style={{ width:10, height:10, borderRadius:5,
                backgroundColor:dark, marginTop:-1,
                borderWidth:1, borderColor:c+"60",
                alignItems:"center", justifyContent:"center" }}>
                <View style={{ width:4, height:4, borderRadius:2, backgroundColor:"#bbf7d0" }}/>
                <View style={{ position:"absolute", top:1, right:1, width:2, height:2,
                  borderRadius:1, backgroundColor:"#fff" }}/>
              </View>
            </View>
          ))}
        </View>
        {/* Wide fang maw */}
        <View style={{ position:"absolute", bottom:3, left:6, right:4, height:10,
          borderRadius:5, borderTopLeftRadius:2, borderTopRightRadius:2,
          backgroundColor:dark, flexDirection:"row",
          justifyContent:"space-around", alignItems:"flex-start",
          paddingTop:1, paddingHorizontal:2 }}>
          {[0,1,2,3,4].map(i=>(
            <View key={i} style={{ width:4, height:i%2===0?8:5, borderRadius:1,
              borderBottomLeftRadius:4, borderBottomRightRadius:4,
              backgroundColor:c, opacity:i%2===0?1:0.7 }}/>
          ))}
        </View>
      </View>
      {/* DRIP BASE — slime oozing onto ground */}
      <View style={{ flexDirection:"row", gap:2, marginTop:-4 }}>
        {[{w:12,h:7},{w:7,h:11},{w:11,h:7},{w:6,h:5}].map((d,i)=>(
          <View key={i} style={{ width:d.w, height:d.h, borderRadius:999,
            backgroundColor:mid, borderWidth:1.5, borderColor:c+"45",
            marginTop:i%2===1?4:0 }}/>
        ))}
      </View>
      {/* Ground shadow */}
      <View style={{ width:44, height:5, borderRadius:22,
        backgroundColor:"#000000bb", marginTop:-2 }}/>
    </Animated.View>
  );
}

/* HYPOXIA WRAITH — tall hooded death-spirit, glowing eyes, skeletal reaching hand */
function HypoxiaWraithSprite({ hitFlash, bobY }: SpriteProps) {
  const c     = hitFlash ? "#fff" : "#c4b5fd";
  const cloak = "#1a0040";
  const deep  = "#0d001a";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* BASE MIST below cloak hem */}
      <View style={{ position:"absolute", bottom:14, left:-16, right:-16, height:20,
        borderRadius:12, backgroundColor:"#2e107035" }}/>
      {/* SKELETAL REACHING HAND — left, toward healers */}
      <View style={{ position:"absolute", top:20, left:-24, zIndex:6 }}>
        {/* Palm */}
        <View style={{ width:13, height:11, borderRadius:5,
          backgroundColor:"#c8d0d8", borderWidth:1.5, borderColor:"#64748b" }}/>
        {/* Four fingers */}
        {[{l:0,t:-12,h:13,r:-13},{l:3,t:-15,h:16,r:-4},
          {l:7,t:-15,h:16,r:5},{l:11,t:-12,h:13,r:15}].map((f,i)=>(
          <View key={i} style={{ position:"absolute", left:f.l, top:f.t,
            width:4.5, height:f.h, borderRadius:2.5,
            backgroundColor:"#c8d0d8", borderWidth:1, borderColor:"#64748b",
            transform:[{rotate:`${f.r}deg`}]}}/>
        ))}
      </View>
      {/* OFFSET DROP SHADOW — behind cloak */}
      <View style={{ width:40, height:60, borderRadius:10,
        borderTopLeftRadius:4, borderTopRightRadius:20,
        borderBottomLeftRadius:8, borderBottomRightRadius:16,
        backgroundColor:"#0a0a0a80", position:"absolute", top:4, left:4 }}/>
      {/* TATTERED CLOAK — tall, asymmetric silhouette */}
      <View style={{ width:40, height:60, borderRadius:10,
        borderTopLeftRadius:4, borderTopRightRadius:20,
        borderBottomLeftRadius:8, borderBottomRightRadius:16,
        borderWidth:2, borderColor:c+"90",
        overflow:"hidden", backgroundColor:cloak }}>
        <LinearGradient colors={["#4c1d9565","#1a004098","#0d001a"]}
          start={{x:0.2,y:0}} end={{x:0.8,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {/* Deep hood shadow */}
        <View style={{ position:"absolute", top:0, left:0, right:0, height:30,
          borderTopLeftRadius:4, borderTopRightRadius:20,
          backgroundColor:deep+"92" }}/>
        {/* GLOWING EYES — burning violet */}
        <View style={{ position:"absolute", top:12, left:7, right:7,
          flexDirection:"row", justifyContent:"space-between" }}>
          {[0,1].map(i=>(
            <View key={i} style={{ width:9, height:10, borderRadius:5,
              backgroundColor:"#6d28d9", borderWidth:1.5, borderColor:c,
              alignItems:"center", justifyContent:"center" }}>
              <View style={{ width:4, height:4, borderRadius:2, backgroundColor:c }}/>
              <View style={{ position:"absolute", top:1, right:1, width:2, height:2,
                borderRadius:1, backgroundColor:"#fff" }}/>
            </View>
          ))}
        </View>
        {/* Cloak interior seam */}
        <View style={{ position:"absolute", top:30, bottom:0, left:"47%", width:1.5,
          backgroundColor:c+"22" }}/>
      </View>
      {/* TATTERED STRIPS at cloak bottom — touching ground */}
      <View style={{ flexDirection:"row", gap:1, marginTop:-12, zIndex:2 }}>
        {[{w:7,h:20,r:-14},{w:5,h:27,r:-5},{w:7,h:21,r:4},{w:5,h:16,r:15},{w:6,h:23,r:-7}].map((t,i)=>(
          <View key={i} style={{ width:t.w, height:t.h,
            borderRadius:3, borderBottomLeftRadius:999, borderBottomRightRadius:999,
            backgroundColor:cloak+"D0", borderWidth:1, borderColor:c+"22",
            transform:[{rotate:`${t.r}deg`}]}}/>
        ))}
      </View>
      {/* Ground shadow */}
      <View style={{ width:32, height:5, borderRadius:16,
        backgroundColor:"#00000090", marginTop:-4 }}/>
    </Animated.View>
  );
}

/* FEVER IMP — small fiery infection sprite: flickering ember body, mischievous grin */
function FeverImpSprite({ hitFlash, bobY }: SpriteProps) {
  const c    = hitFlash ? "#fff" : "#f87171";
  const mid  = "#b91c1c";
  const dark = "#450a0a";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* HEAT WISPS — rising above head */}
      <View style={{ position:"absolute", top:-14, left:6, gap:2 }}>
        {[{w:5,h:8,l:0},{w:4,h:6,l:10}].map((d,i)=>(
          <View key={i} style={{ position:"absolute", left:d.l, width:d.w, height:d.h,
            borderRadius:999, backgroundColor:c+"60" }}/>
        ))}
      </View>
      {/* CLAWED ARM — reaching left */}
      <View style={{ position:"absolute", top:16, left:-16, zIndex:4 }}>
        <View style={{ width:16, height:8, borderRadius:4,
          backgroundColor:mid, borderWidth:1.5, borderColor:c,
          transform:[{rotate:"-10deg"}]}}/>
      </View>
      {/* OFFSET DROP SHADOW */}
      <View style={{ width:34, height:34, borderRadius:16,
        borderTopLeftRadius:8, borderTopRightRadius:20,
        backgroundColor:"#0a0a0a80", position:"absolute", top:3, left:3 }}/>
      {/* EMBER BODY */}
      <View style={{ width:34, height:34, borderRadius:16,
        borderTopLeftRadius:8, borderTopRightRadius:20,
        borderWidth:2, borderColor:c, overflow:"hidden", backgroundColor:mid }}>
        <LinearGradient colors={[c+"70", mid, dark]}
          start={{x:0.2,y:0}} end={{x:0.8,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {/* Cracked ember lines */}
        <View style={{ position:"absolute", top:6, left:14, width:10, height:1.5,
          backgroundColor:c+"90", transform:[{rotate:"25deg"}]}}/>
        {/* GLOWING EYES */}
        <View style={{ position:"absolute", top:10, left:5, right:5,
          flexDirection:"row", justifyContent:"space-between" }}>
          {[0,1].map(i=>(
            <View key={i} style={{ width:6, height:6, borderRadius:3,
              backgroundColor:"#fef08a", borderWidth:1, borderColor:c }}/>
          ))}
        </View>
        {/* Grin */}
        <View style={{ position:"absolute", bottom:6, left:10, width:14, height:4,
          borderRadius:2, backgroundColor:dark, borderWidth:1, borderColor:c+"60" }}/>
      </View>
      {/* Tiny horns */}
      <View style={{ flexDirection:"row", gap:14, marginTop:-32, marginBottom:14, zIndex:5 }}>
        {[-18,18].map((rot,i)=>(
          <View key={i} style={{ width:5, height:9, borderRadius:2,
            backgroundColor:mid, borderWidth:1, borderColor:c,
            transform:[{rotate:`${rot}deg`}]}}/>
        ))}
      </View>
      {/* Ground shadow */}
      <View style={{ width:22, height:4, borderRadius:12,
        backgroundColor:"#00000090", marginTop:-2 }}/>
    </Animated.View>
  );
}

/* SHOCK SHADE — perfusion-weak wraith flickering with faint blue pulse (weak circulation) */
function ShockShadeSprite({ hitFlash, bobY }: SpriteProps) {
  const c    = hitFlash ? "#fff" : "#7dd3fc";
  const body = "#0c2d48";
  const dark = "#041220";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* PULSE RINGS — faint circulation flicker */}
      <View style={{ position:"absolute", top:10, left:-8, width:56, height:36,
        borderRadius:18, borderWidth:1.5, borderColor:c+"35" }}/>
      {/* SKELETAL HAND — reaching left */}
      <View style={{ position:"absolute", top:18, left:-20, zIndex:5 }}>
        <View style={{ width:11, height:9, borderRadius:4,
          backgroundColor:"#94a3b8", borderWidth:1.2, borderColor:c }}/>
      </View>
      {/* OFFSET DROP SHADOW */}
      <View style={{ width:36, height:52, borderRadius:8,
        borderTopLeftRadius:3, borderTopRightRadius:18,
        borderBottomLeftRadius:6, borderBottomRightRadius:14,
        backgroundColor:"#0a0a0a80", position:"absolute", top:4, left:4 }}/>
      {/* FLICKERING SHADE FORM */}
      <View style={{ width:36, height:52, borderRadius:8,
        borderTopLeftRadius:3, borderTopRightRadius:18,
        borderBottomLeftRadius:6, borderBottomRightRadius:14,
        borderWidth:2, borderColor:c+"85", overflow:"hidden", backgroundColor:body }}>
        <LinearGradient colors={[c+"30", body, dark]}
          start={{x:0.2,y:0}} end={{x:0.8,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {/* Faint pulse vein */}
        <View style={{ position:"absolute", top:8, bottom:8, left:"48%", width:1.5,
          backgroundColor:c+"40" }}/>
        {/* DIM FLICKERING EYES — weak signal */}
        <View style={{ position:"absolute", top:10, left:6, right:6,
          flexDirection:"row", justifyContent:"space-between" }}>
          {[0,1].map(i=>(
            <View key={i} style={{ width:7, height:7, borderRadius:3.5,
              backgroundColor:"#1e3a5f", borderWidth:1.3, borderColor:c+"90",
              alignItems:"center", justifyContent:"center" }}>
              <View style={{ width:2.5, height:2.5, borderRadius:1.5, backgroundColor:c }}/>
            </View>
          ))}
        </View>
      </View>
      {/* Ground shadow */}
      <View style={{ width:26, height:4, borderRadius:13,
        backgroundColor:"#00000090", marginTop:-3 }}/>
    </Animated.View>
  );
}

/* BRONCHOSPASM DRAKE — boss dragon: wings spread, standing on claws, flame breath */
function BronchospasmDrakeSprite({ hitFlash, bobY }: SpriteProps) {
  const c   = hitFlash ? "#fff" : "#fb923c";
  const mid = "#92330a";
  const dk  = "#431407";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* LEFT WING — large, swept back */}
      <View style={{ position:"absolute", top:20, left:-40, width:60, height:60,
        borderRadius:8, borderTopLeftRadius:50, borderTopRightRadius:4,
        borderWidth:2, borderColor:c+"85",
        overflow:"hidden", backgroundColor:"#7c2d1238",
        transform:[{rotate:"-10deg"}]}}>
        <LinearGradient colors={[c+"38","#7c2d1210","transparent"]}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {[{t:8,l:10,w:38,r:-36},{t:19,l:14,w:30,r:-23},{t:29,l:18,w:22,r:-13}].map((b,i)=>(
          <View key={i} style={{ position:"absolute", top:b.t, left:b.l,
            width:b.w, height:2, borderRadius:1,
            backgroundColor:c+"65", transform:[{rotate:`${b.r}deg`}]}}/>
        ))}
      </View>
      {/* RIGHT WING */}
      <View style={{ position:"absolute", top:20, right:-40, width:60, height:60,
        borderRadius:8, borderTopLeftRadius:4, borderTopRightRadius:50,
        borderWidth:2, borderColor:c+"85",
        overflow:"hidden", backgroundColor:"#7c2d1238",
        transform:[{rotate:"10deg"}]}}>
        <LinearGradient colors={[c+"38","#7c2d1210","transparent"]}
          start={{x:1,y:0}} end={{x:0,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {[{t:8,r:10,w:38,rot:36},{t:19,r:14,w:30,rot:23},{t:29,r:18,w:22,rot:13}].map((b,i)=>(
          <View key={i} style={{ position:"absolute", top:b.t, right:b.r,
            width:b.w, height:2, borderRadius:1,
            backgroundColor:c+"65", transform:[{rotate:`${b.rot}deg`}]}}/>
        ))}
      </View>
      {/* HORNS */}
      <View style={{ flexDirection:"row", gap:22, marginBottom:-8, zIndex:7 }}>
        {[-22,22].map((rot,i)=>(
          <View key={i} style={{ width:10, height:24, borderRadius:5,
            borderTopLeftRadius:2, borderTopRightRadius:2,
            backgroundColor:dk, borderWidth:1.5, borderColor:c+"75",
            transform:[{rotate:`${rot}deg`}]}}/>
        ))}
      </View>
      {/* HEAD OFFSET SHADOW */}
      <View style={{ width:66, height:60, borderRadius:18,
        borderTopLeftRadius:27, borderTopRightRadius:27,
        backgroundColor:"#0a0a0a80", position:"absolute", top:32, left:6 }}/>
      {/* DRAGON HEAD */}
      <View style={{ width:66, height:60, borderRadius:18,
        borderTopLeftRadius:27, borderTopRightRadius:27,
        borderWidth:2.5, borderColor:c, overflow:"hidden",
        backgroundColor:mid, zIndex:5 }}>
        <LinearGradient colors={[c+"45","#92330a","#431407"]}
          start={{x:0.15,y:0}} end={{x:0.85,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {/* Scale rows */}
        {[14,24,38].map((t,i)=>(
          <View key={i} style={{ position:"absolute", top:t, left:"8%", right:"8%",
            height:1.5, backgroundColor:"#f9731430" }}/>
        ))}
        {/* SLIT EYES — fierce gold */}
        <View style={{ flexDirection:"row", gap:14, justifyContent:"center", marginTop:4 }}>
          {[0,1].map(i=>(
            <View key={i} style={{ width:15, height:14, borderRadius:8,
              backgroundColor:dk, borderWidth:2.5, borderColor:"#fbbf24",
              alignItems:"center", justifyContent:"center" }}>
              <View style={{ width:6, height:6, borderRadius:3, backgroundColor:"#fbbf24" }}/>
              <View style={{ position:"absolute", width:2.5, height:11,
                borderRadius:1.5, backgroundColor:dk }}/>
              <View style={{ position:"absolute", top:2, right:2, width:3, height:3,
                borderRadius:2, backgroundColor:"#fff" }}/>
            </View>
          ))}
        </View>
        {/* JAW with fangs */}
        <View style={{ width:38, height:17, borderRadius:7,
          borderTopLeftRadius:4, borderTopRightRadius:4,
          backgroundColor:dk, borderWidth:2, borderColor:c,
          marginTop:8, alignSelf:"center",
          flexDirection:"row", justifyContent:"space-around",
          alignItems:"flex-start", paddingTop:2, paddingHorizontal:3 }}>
          {[0,1,2,3,4].map(i=>(
            <View key={i} style={{ width:4, height:i%2===0?11:6, borderRadius:1.5,
              borderBottomLeftRadius:4, borderBottomRightRadius:4,
              backgroundColor:"#fde68a", opacity:i%2===0?1:0.8 }}/>
          ))}
        </View>
        {/* Nostrils */}
        <View style={{ position:"absolute", top:32, left:16, width:6, height:4,
          borderRadius:4, backgroundColor:dk }}/>
        <View style={{ position:"absolute", top:32, right:16, width:6, height:4,
          borderRadius:4, backgroundColor:dk }}/>
      </View>
      {/* COMPACT TORSO */}
      <View style={{ width:52, height:26, borderRadius:12,
        borderWidth:2, borderColor:c+"80", overflow:"hidden",
        backgroundColor:mid, marginTop:-6, zIndex:4 }}>
        <LinearGradient colors={[c+"32","#92330a","#431407"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        <View style={{ position:"absolute", top:4, left:10, width:14, height:7,
          borderRadius:7, backgroundColor:c+"30" }}/>
      </View>
      {/* LEGS + CLAWS — standing */}
      <View style={{ flexDirection:"row", gap:12, marginTop:-4, zIndex:5 }}>
        {[-7,7].map((rot,i)=>(
          <View key={i} style={{ alignItems:"center", transform:[{rotate:`${rot}deg`}] }}>
            <View style={{ width:14, height:16, borderRadius:7,
              backgroundColor:mid, borderWidth:2, borderColor:c+"80" }}/>
            <View style={{ flexDirection:"row", gap:1, marginTop:-3 }}>
              {[-10,0,10].map((cr,ci)=>(
                <View key={ci} style={{ width:5, height:8, borderRadius:999,
                  borderBottomLeftRadius:1, borderBottomRightRadius:1,
                  backgroundColor:dk, borderWidth:1, borderColor:c+"60",
                  transform:[{rotate:`${cr}deg`}]}}/>
              ))}
            </View>
          </View>
        ))}
      </View>
      {/* FLAME BREATH — streams left from jaw */}
      {!hitFlash && (
        <View style={{ position:"absolute", left:-26, top:48,
          flexDirection:"column", gap:2 }}>
          {[{w:28,col:"#f97316"},{w:36,col:"#fbbf24"},{w:22,col:"#ef4444"},{w:32,col:"#fde68a"}].map((fl,i)=>(
            <View key={i} style={{ width:fl.w, height:5, borderRadius:999,
              borderTopLeftRadius:2, borderBottomLeftRadius:2,
              backgroundColor:fl.col+"72" }}/>
          ))}
        </View>
      )}
      {/* Ground shadow */}
      <View style={{ width:58, height:6, borderRadius:29,
        backgroundColor:"#000000cc", marginTop:2 }}/>
    </Animated.View>
  );
}


function EnemySprite({ typeId, hitFlash, bobY }: { typeId: string; hitFlash: boolean; bobY: Animated.AnimatedInterpolation<number> }) {
  switch (typeId) {
    case "breathless_wisp":    return <BreathlessWispSprite hitFlash={hitFlash} bobY={bobY} />;
    case "wheeze_sprite":      return <WheezeSpriteSprite   hitFlash={hitFlash} bobY={bobY} />;
    case "mucus_slime":        return <MucusSlimeSprite     hitFlash={hitFlash} bobY={bobY} />;
    case "hypoxia_wraith":     return <HypoxiaWraithSprite  hitFlash={hitFlash} bobY={bobY} />;
    case "bronchospasm_drake": return <BronchospasmDrakeSprite hitFlash={hitFlash} bobY={bobY} />;
    case "fever_imp":          return <FeverImpSprite         hitFlash={hitFlash} bobY={bobY} />;
    case "shock_shade":        return <ShockShadeSprite       hitFlash={hitFlash} bobY={bobY} />;
    default: return <View style={{ width: 34, height: 44, borderRadius: 8, backgroundColor: "#334155" }} />;
  }
}

/* ─── UNIT SPRITES ───────────────────────────────────────────────────────────
   Design principles — what makes these CHARACTERS not ICONS:
   • Visible legs + shoes at bottom — grounds them as characters
   • 3/4 right-facing pose — asymmetric: left eye smaller, right eye main
   • Hair extends BEYOND head circle — distinctive non-circular silhouette
   • Front arm extended, holding actual prop (stethoscope disc / staff / mask)
   • Back arm behind body, partially visible
   • Costume details: lapels, buttons, belt, pockets — layered depth
   ─────────────────────────────────────────────────────────────────────────── */

/* WARD SCOUT — Blue nurse, 3/4 right-facing, white A-line coat, stethoscope */
function WardScoutSprite({ castFlash }: { castFlash: boolean }) {
  const trim = castFlash ? "#2563eb" : "#3b82f6";
  const coat = castFlash ? "#bfdbfe" : "#f0f9ff";
  const skin = "#fde8c8";
  const hair = "#1c3557";
  return (
    <View style={{ width:52, height:68, position:"relative" }}>
      {/* LEGS — dark trousers with shadow offset */}
      <View style={{ position:"absolute", bottom:10, left:14, width:9, height:18,
        borderRadius:4, backgroundColor:"#1e293b", borderWidth:1.5, borderColor:"#0f172a" }}/>
      <View style={{ position:"absolute", bottom:10, left:24, width:9, height:16,
        borderRadius:4, backgroundColor:"#1e293b", borderWidth:1.5, borderColor:"#0f172a",
        transform:[{rotate:"-8deg"}]}}/>
      {/* Shoes */}
      <View style={{ position:"absolute", bottom:4, left:9, width:16, height:7,
        borderRadius:4, backgroundColor:coat, borderWidth:2, borderColor:trim }}/>
      <View style={{ position:"absolute", bottom:3, left:20, width:16, height:7,
        borderRadius:4, backgroundColor:coat, borderWidth:2, borderColor:trim,
        transform:[{rotate:"-5deg"}]}}/>
      {/* BACK ARM */}
      <View style={{ position:"absolute", top:28, left:2, width:10, height:22,
        borderRadius:5, backgroundColor:"#d1d5db", borderWidth:1.5, borderColor:trim,
        transform:[{rotate:"-28deg"}]}}/>
      {/* COAT BODY — offset shadow first */}
      <View style={{ position:"absolute", top:29, left:8, width:38, height:36,
        borderRadius:8, borderTopLeftRadius:16, borderTopRightRadius:6,
        backgroundColor:"#0f172a60" }}/>
      {/* COAT BODY — cel-shaded white coat */}
      <View style={{ position:"absolute", top:26, left:5, width:38, height:36,
        borderRadius:8, borderTopLeftRadius:16, borderTopRightRadius:6,
        borderWidth:2, borderColor:trim, overflow:"hidden",
        backgroundColor:coat }}>
        <LinearGradient colors={["#ffffff","#e0f0ff","#bfdbfe80"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {/* Left lapel shadow */}
        <View style={{ position:"absolute", top:0, left:4, width:10, height:18,
          borderRadius:4, borderTopLeftRadius:10, backgroundColor:trim+"45" }}/>
        {/* Right trim */}
        <View style={{ position:"absolute", top:0, right:0, bottom:0, width:7,
          borderTopRightRadius:5, borderBottomRightRadius:7, backgroundColor:trim+"30" }}/>
        {/* Buttons */}
        {[9,17,25].map((t,i)=>(
          <View key={i} style={{ position:"absolute", top:t, left:21, width:5, height:5,
            borderRadius:3, backgroundColor:trim, borderWidth:1, borderColor:"#1d4ed8" }}/>
        ))}
        {/* Belt line */}
        <View style={{ position:"absolute", top:20, left:0, right:0, height:3,
          backgroundColor:trim+"70" }}/>
        {/* Breast pocket */}
        <View style={{ position:"absolute", bottom:5, left:5, width:11, height:9,
          borderRadius:4, borderWidth:1.5, borderColor:trim+"70" }}/>
      </View>
      {/* FRONT ARM */}
      <View style={{ position:"absolute", top:28, right:2, width:11, height:24,
        borderRadius:6, backgroundColor:coat, borderWidth:2, borderColor:trim,
        transform:[{rotate:"28deg"}]}}/>
      {/* Stethoscope disc */}
      <View style={{ position:"absolute", top:50, right:-4, width:14, height:14,
        borderRadius:7, backgroundColor:"#94a3b8", borderWidth:2.5, borderColor:"#475569",
        alignItems:"center", justifyContent:"center" }}>
        <View style={{ width:6, height:6, borderRadius:3, backgroundColor:"#0f172a" }}/>
        <View style={{ position:"absolute", top:1.5, right:1.5, width:3, height:3,
          borderRadius:2, backgroundColor:"#e2e8f0" }}/>
      </View>
      {/* NECK */}
      <View style={{ position:"absolute", top:22, left:19, width:11, height:8,
        backgroundColor:skin, borderWidth:1, borderColor:"#e9a84c" }}/>
      {/* HEAD SHADOW */}
      <View style={{ position:"absolute", top:2, left:13, width:32, height:28,
        borderRadius:14, backgroundColor:"#0f172a60" }}/>
      {/* HEAD */}
      <View style={{ position:"absolute", top:0, left:11, width:32, height:28,
        borderRadius:14, backgroundColor:skin, borderWidth:2, borderColor:"#e9a84c",
        overflow:"hidden" }}>
        <LinearGradient colors={["#fef3c7","#fde8c8","#e9a84c40"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {/* Hair back */}
        <View style={{ position:"absolute", top:-10, left:-3, width:38, height:18,
          borderRadius:999, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:2, left:-6, width:9, height:20,
          borderRadius:5, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:-6, right:3, width:7, height:14,
          borderRadius:4, backgroundColor:hair }}/>
        {/* NURSE CAP */}
        <View style={{ position:"absolute", top:-5, left:7, width:22, height:10,
          borderRadius:5, borderBottomLeftRadius:0, borderBottomRightRadius:0,
          backgroundColor:"#f0f9ff", borderWidth:2, borderColor:trim }}>
          <View style={{ position:"absolute", left:6, top:2, width:9, height:2.5,
            backgroundColor:"#ef4444" }}/>
          <View style={{ position:"absolute", left:9, top:-2, width:2.5, height:7,
            backgroundColor:"#ef4444" }}/>
        </View>
        {/* Blush */}
        <View style={{ position:"absolute", top:16, right:2, width:8, height:5,
          borderRadius:4, backgroundColor:"#fca5a568" }}/>
        {/* Left eye — smaller 3/4 */}
        <View style={{ position:"absolute", top:10, left:4, width:5, height:7,
          borderRadius:3, backgroundColor:"#1e3a5f" }}>
          <View style={{ position:"absolute", top:1, right:1, width:2, height:2,
            borderRadius:1, backgroundColor:"#fff" }}/>
        </View>
        {/* Right eye — main */}
        <View style={{ position:"absolute", top:9, right:4, width:9, height:10,
          borderRadius:5, backgroundColor:"#1e3a5f" }}>
          <View style={{ width:5, height:5, borderRadius:2.5, backgroundColor:"#60a5fa",
            marginTop:2, marginLeft:2 }}/>
          <View style={{ position:"absolute", top:1.5, right:1.5, width:3.5, height:3.5,
            borderRadius:2, backgroundColor:"#fff" }}/>
        </View>
        {/* Nose / smile */}
        <View style={{ position:"absolute", top:17, right:10, width:3, height:2,
          borderRadius:2, backgroundColor:"#e9a84c70" }}/>
        <View style={{ position:"absolute", bottom:4, right:3, width:10, height:4,
          borderRadius:3, borderBottomWidth:2.5, borderColor:"#c2410c" }}/>
      </View>
      {/* Ground shadow under boots */}
      <View style={{ position:"absolute", bottom:0, left:8, width:34, height:4,
        borderRadius:17, backgroundColor:"#000000aa" }}/>
      {castFlash && (
        <View style={{ position:"absolute", top:-2, left:-2, right:-2, bottom:-2,
          borderRadius:14, borderWidth:2.5, borderColor:`${trim}80` }}/>
      )}
    </View>
  );
}

/* MIST CASTER — amber alchemist mage, tall hat, flowing robe, casting staff */
function MistCasterSprite({ castFlash }: { castFlash: boolean }) {
  const accent = castFlash ? "#fde68a" : "#f59e0b";
  const robe   = castFlash ? "#4c1d95" : "#1e1b4b";
  const skin   = "#fde8c8";
  const hair   = "#0f172a";
  return (
    <View style={{ width:52, height:74, position:"relative" }}>
      {/* STAFF — tall, right side */}
      <View style={{ position:"absolute", top:-12, right:7, width:6, height:86,
        borderRadius:3, backgroundColor:"#44260a", borderWidth:1.5, borderColor:accent+"80" }}>
        {/* Orb */}
        <View style={{ position:"absolute", top:-13, left:-10, width:26, height:26,
          borderRadius:13, borderWidth:3, borderColor:accent,
          backgroundColor:castFlash ? "#fde68a" : accent+"45",
          alignItems:"center", justifyContent:"center" }}>
          <View style={{ width:10, height:10, borderRadius:5,
            backgroundColor:castFlash ? "#fff" : accent }}/>
          <View style={{ position:"absolute", top:3, left:3, width:5, height:5,
            borderRadius:3, backgroundColor:"#ffffff50" }}/>
        </View>
        {[22,38,54].map((t,i)=>(
          <View key={i} style={{ position:"absolute", top:t, left:-2, right:-2, height:4,
            borderRadius:2, backgroundColor:accent+"65" }}/>
        ))}
      </View>
      {/* FEET peeking under hem */}
      <View style={{ position:"absolute", bottom:8, left:10, width:13, height:7,
        borderRadius:4, borderTopLeftRadius:0, backgroundColor:"#0f172a" }}/>
      <View style={{ position:"absolute", bottom:8, left:22, width:11, height:6,
        borderRadius:4, borderTopLeftRadius:0, backgroundColor:"#0f172a" }}/>
      {/* ROBE SHADOW */}
      <View style={{ position:"absolute", top:33, left:7, width:34, height:44,
        borderRadius:10, borderTopLeftRadius:14, borderTopRightRadius:6,
        backgroundColor:"#0f172a70" }}/>
      {/* ROBE BODY — wide hem, tapered waist */}
      <View style={{ position:"absolute", top:30, left:4, width:34, height:44,
        borderRadius:10, borderTopLeftRadius:14, borderTopRightRadius:6,
        borderWidth:2, borderColor:accent+"70", overflow:"hidden",
        backgroundColor:robe }}>
        <LinearGradient colors={["#312e8160","#1e1b4b","#12103a"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {/* Amber hem trim */}
        <View style={{ position:"absolute", bottom:0, left:0, right:0, height:7,
          borderBottomLeftRadius:9, borderBottomRightRadius:9,
          backgroundColor:accent+"48" }}/>
        {/* Waist sash */}
        <View style={{ position:"absolute", top:16, left:0, right:0, height:4,
          backgroundColor:accent+"68" }}/>
        {/* Robe folds */}
        <View style={{ position:"absolute", top:12, left:8, width:1.5, height:24,
          backgroundColor:accent+"28" }}/>
        <View style={{ position:"absolute", top:8, right:8, width:1.5, height:28,
          backgroundColor:accent+"22" }}/>
        {/* Gem clasp */}
        <View style={{ position:"absolute", top:2, left:10, width:9, height:9,
          borderRadius:2, backgroundColor:accent+"90",
          transform:[{rotate:"45deg"}]}}/>
      </View>
      {/* LEFT SLEEVE — raised casting */}
      <View style={{ position:"absolute", top:28, left:-6, width:18, height:30,
        borderRadius:9, borderTopLeftRadius:12,
        backgroundColor:robe, borderWidth:2, borderColor:accent+"70",
        transform:[{rotate:"-16deg"}]}}/>
      {/* Casting glow on left hand */}
      <View style={{ position:"absolute", top:14, left:-4, width:16, height:16,
        borderRadius:8, backgroundColor:accent+"60", borderWidth:2, borderColor:accent }}/>
      {/* RIGHT SLEEVE */}
      <View style={{ position:"absolute", top:30, right:16, width:13, height:26,
        borderRadius:7, borderTopRightRadius:10,
        backgroundColor:robe, borderWidth:2, borderColor:accent+"65",
        transform:[{rotate:"10deg"}]}}/>
      {/* NECK */}
      <View style={{ position:"absolute", top:26, left:17, width:10, height:8,
        backgroundColor:skin, borderWidth:1, borderColor:"#e9a84c" }}/>
      {/* HEAD SHADOW */}
      <View style={{ position:"absolute", top:4, left:12, width:28, height:26,
        borderRadius:13, backgroundColor:"#0f172a70" }}/>
      {/* HEAD */}
      <View style={{ position:"absolute", top:2, left:10, width:28, height:26,
        borderRadius:13, backgroundColor:skin, borderWidth:2, borderColor:"#e9a84c",
        overflow:"hidden" }}>
        <LinearGradient colors={["#fef3c7","#fde8c8","#e9a84c40"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {/* Hair */}
        <View style={{ position:"absolute", top:-8, left:-2, width:32, height:16,
          borderRadius:999, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:0, left:-5, width:8, height:22,
          borderRadius:4, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:-4, right:-1, width:6, height:16,
          borderRadius:3, backgroundColor:hair }}/>
        {/* Tall pointed hat tip */}
        <View style={{ position:"absolute", top:-22, left:9, width:8, height:18,
          borderRadius:4, borderTopLeftRadius:1, borderTopRightRadius:1,
          backgroundColor:hair, borderWidth:1.5, borderColor:accent+"65",
          transform:[{rotate:"-5deg"}]}}/>
        {/* Hat brim */}
        <View style={{ position:"absolute", top:-8, left:0, width:28, height:9,
          borderRadius:5, borderBottomLeftRadius:2, borderBottomRightRadius:2,
          backgroundColor:hair, borderWidth:1.5, borderColor:accent+"65" }}>
          <View style={{ position:"absolute", bottom:0, left:0, right:0, height:3,
            backgroundColor:accent+"85" }}/>
          <View style={{ position:"absolute", bottom:0, left:6, width:5, height:5,
            borderRadius:1, backgroundColor:accent, transform:[{rotate:"45deg"}]}}/>
        </View>
        {/* Blush */}
        <View style={{ position:"absolute", top:14, right:2, width:7, height:4,
          borderRadius:4, backgroundColor:"#fca5a560" }}/>
        {/* Left eye smaller */}
        <View style={{ position:"absolute", top:10, left:3, width:5, height:6,
          borderRadius:3, backgroundColor:"#0f172a" }}>
          <View style={{ position:"absolute", top:1, right:1, width:2, height:2,
            borderRadius:1, backgroundColor:"#fff" }}/>
        </View>
        {/* Right eye main */}
        <View style={{ position:"absolute", top:9, right:3, width:9, height:10,
          borderRadius:5, backgroundColor:"#0f172a" }}>
          <View style={{ width:5, height:5, borderRadius:2.5, backgroundColor:accent,
            marginTop:2, marginLeft:2 }}/>
          <View style={{ position:"absolute", top:1.5, right:1.5, width:3.5, height:3.5,
            borderRadius:2, backgroundColor:"#fff" }}/>
        </View>
        {/* Mouth */}
        <View style={{ position:"absolute", bottom:4, right:3, width:9, height:4,
          borderRadius:2, borderBottomWidth:2, borderColor:"#92400e" }}/>
      </View>
      {/* Ground shadow under feet */}
      <View style={{ position:"absolute", bottom:4, left:8, width:28, height:4,
        borderRadius:14, backgroundColor:"#000000aa" }}/>
      {castFlash && (
        <View style={{ position:"absolute", top:-4, left:-4, right:-4, bottom:-4,
          borderRadius:14, borderWidth:2, borderColor:`${accent}70` }}/>
      )}
    </View>
  );
}

/* O2 HEALER — green RT, stocky build, O₂ tank on back, mask in outstretched hand */
function O2HealerSprite({ castFlash }: { castFlash: boolean }) {
  const accent = castFlash ? "#6ee7b7" : "#34d399";
  const vest   = castFlash ? "#065f46" : "#064e3b";
  const skin   = "#fde8c8";
  const hair   = "#1f2937";
  return (
    <View style={{ width:52, height:66, position:"relative" }}>
      {/* O₂ TANK — cylindrical, strapped to left/back */}
      <View style={{ position:"absolute", top:22, left:-5, width:14, height:34,
        borderRadius:7, backgroundColor:"#1e293b", borderWidth:2, borderColor:accent }}>
        <View style={{ position:"absolute", top:-5, left:1, width:12, height:7,
          borderRadius:3, backgroundColor:"#334155" }}/>
        <Text style={{ position:"absolute", top:8, left:0, right:0, textAlign:"center",
          color:accent, fontSize:7, fontWeight:"800" }}>O₂</Text>
        <View style={{ position:"absolute", bottom:3, left:1, right:1, height:9,
          borderRadius:5, backgroundColor:"#0f172a",
          borderWidth:1, borderColor:accent+"65",
          justifyContent:"center", alignItems:"center" }}>
          <View style={{ width:5, height:5, borderRadius:3,
            borderWidth:1.5, borderColor:accent+"80" }}/>
        </View>
      </View>
      {/* Tank strap */}
      <View style={{ position:"absolute", top:26, left:9, width:2, height:14,
        borderRadius:1, backgroundColor:accent+"70" }}/>
      {/* LEGS — cargo pants */}
      <View style={{ position:"absolute", bottom:10, left:14, width:10, height:16,
        borderRadius:4, backgroundColor:"#1e293b", borderWidth:1.5, borderColor:"#0f172a" }}/>
      <View style={{ position:"absolute", bottom:10, left:25, width:10, height:14,
        borderRadius:4, backgroundColor:"#1e293b", borderWidth:1.5, borderColor:"#0f172a",
        transform:[{rotate:"-8deg"}]}}/>
      {/* Boots */}
      <View style={{ position:"absolute", bottom:3, left:10, width:17, height:8,
        borderRadius:4, backgroundColor:"#374151", borderWidth:2, borderColor:"#1f2937" }}/>
      <View style={{ position:"absolute", bottom:3, left:22, width:16, height:7,
        borderRadius:4, backgroundColor:"#374151", borderWidth:2, borderColor:"#1f2937",
        transform:[{rotate:"-5deg"}]}}/>
      {/* BACK ARM */}
      <View style={{ position:"absolute", top:26, left:8, width:10, height:22,
        borderRadius:5, backgroundColor:vest, borderWidth:1.5, borderColor:accent,
        transform:[{rotate:"-22deg"}]}}/>
      {/* VEST SHADOW */}
      <View style={{ position:"absolute", top:25, left:12, width:35, height:34,
        borderRadius:8, borderTopLeftRadius:16, borderTopRightRadius:8,
        backgroundColor:"#0f172a70" }}/>
      {/* VEST BODY — stocky, wide-shouldered */}
      <View style={{ position:"absolute", top:22, left:9, width:35, height:34,
        borderRadius:8, borderTopLeftRadius:16, borderTopRightRadius:8,
        borderWidth:2, borderColor:accent, overflow:"hidden",
        backgroundColor:vest }}>
        <LinearGradient colors={["#10b98140","#064e3b","#022c22"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {/* Chest pocket */}
        <View style={{ position:"absolute", top:5, left:3, width:12, height:9,
          borderRadius:3, borderWidth:1.5, borderColor:accent+"70" }}>
          <Text style={{ color:accent, fontSize:5.5, fontWeight:"800", textAlign:"center" }}>O₂</Text>
        </View>
        {/* Right pocket */}
        <View style={{ position:"absolute", bottom:5, right:3, width:9, height:8,
          borderRadius:3, borderWidth:1.5, borderColor:accent+"70" }}/>
        {/* Center zipper */}
        <View style={{ position:"absolute", top:0, bottom:0, left:"47%", width:2,
          backgroundColor:accent+"42" }}/>
        {/* Shoulder patch */}
        <View style={{ position:"absolute", top:3, right:3, width:10, height:5,
          borderRadius:2, backgroundColor:accent+"42", borderWidth:1, borderColor:accent }}/>
      </View>
      {/* FRONT ARM — holding O₂ mask out */}
      <View style={{ position:"absolute", top:24, right:1, width:11, height:24,
        borderRadius:6, backgroundColor:vest, borderWidth:2, borderColor:accent,
        transform:[{rotate:"32deg"}]}}/>
      {/* O₂ MASK */}
      <View style={{ position:"absolute", top:44, right:-8, width:18, height:13,
        borderRadius:5, backgroundColor:accent+"88", borderWidth:2.5, borderColor:accent,
        alignItems:"center", justifyContent:"center" }}>
        <View style={{ width:9, height:4, borderRadius:2,
          backgroundColor:"#065f46", borderWidth:1, borderColor:accent }}/>
        <View style={{ position:"absolute", right:-4, top:3, width:5, height:2,
          borderRadius:1, backgroundColor:accent+"70" }}/>
      </View>
      {/* Hose */}
      <View style={{ position:"absolute", top:30, left:12, width:2, height:18,
        borderRadius:1, backgroundColor:accent+"62", transform:[{rotate:"22deg"}]}}/>
      {/* NECK */}
      <View style={{ position:"absolute", top:18, left:20, width:12, height:7,
        backgroundColor:skin, borderWidth:1, borderColor:"#e9a84c" }}/>
      {/* HEAD SHADOW */}
      <View style={{ position:"absolute", top:2, left:12, width:32, height:26,
        borderRadius:13, backgroundColor:"#0f172a70" }}/>
      {/* HEAD */}
      <View style={{ position:"absolute", top:0, left:10, width:32, height:26,
        borderRadius:13, backgroundColor:skin, borderWidth:2, borderColor:"#e9a84c",
        overflow:"hidden" }}>
        <LinearGradient colors={["#fef3c7","#fde8c8","#e9a84c40"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }}/>
        {/* Hair */}
        <View style={{ position:"absolute", top:-8, left:-2, width:36, height:16,
          borderRadius:999, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:2, left:-5, width:8, height:18,
          borderRadius:4, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:-4, right:0, width:8, height:12,
          borderRadius:4, backgroundColor:hair }}/>
        {/* Medical headband */}
        <View style={{ position:"absolute", top:-2, left:0, right:0, height:8,
          borderRadius:4, borderBottomLeftRadius:0, borderBottomRightRadius:0,
          backgroundColor:vest, borderWidth:2, borderColor:accent }}>
          <View style={{ position:"absolute", right:5, top:1.5, width:11, height:5,
            borderRadius:2, borderWidth:1, borderColor:accent+"80" }}/>
        </View>
        {/* Mask pushed up on forehead */}
        <View style={{ position:"absolute", top:4, left:3, width:16, height:5,
          borderRadius:3, backgroundColor:accent+"70", borderWidth:1.5, borderColor:accent }}/>
        {/* Blush */}
        <View style={{ position:"absolute", top:15, right:2, width:8, height:4,
          borderRadius:4, backgroundColor:"#fca5a560" }}/>
        {/* Left eye smaller */}
        <View style={{ position:"absolute", top:10, left:4, width:6, height:7,
          borderRadius:3, backgroundColor:"#0f172a" }}>
          <View style={{ position:"absolute", top:1, right:1, width:2, height:2,
            borderRadius:1, backgroundColor:"#fff" }}/>
        </View>
        {/* Right eye main */}
        <View style={{ position:"absolute", top:9, right:4, width:9, height:10,
          borderRadius:5, backgroundColor:"#0f172a" }}>
          <View style={{ width:5, height:5, borderRadius:2.5, backgroundColor:accent,
            marginTop:2, marginLeft:2 }}/>
          <View style={{ position:"absolute", top:1.5, right:1.5, width:3.5, height:3.5,
            borderRadius:2, backgroundColor:"#fff" }}/>
        </View>
        {/* Determined mouth */}
        <View style={{ position:"absolute", bottom:4, right:3, width:10, height:3,
          borderRadius:1.5, backgroundColor:"#b45309" }}/>
      </View>
      {/* Ground shadow under boots */}
      <View style={{ position:"absolute", bottom:0, left:8, width:34, height:4,
        borderRadius:17, backgroundColor:"#000000aa" }}/>
      {castFlash && (
        <View style={{ position:"absolute", top:-4, left:-4, right:-4, bottom:-4,
          borderRadius:16, borderWidth:2.5, borderColor:`${accent}70` }}/>
      )}
    </View>
  );
}

function UnitSprite({ typeId, castFlash, level = 1 }: { typeId: string; castFlash: boolean; level?: number }) {
  let sprite: React.ReactElement;
  switch (typeId) {
    case "ward_scout":  sprite = <WardScoutSprite castFlash={castFlash} />; break;
    case "mist_caster": sprite = <MistCasterSprite castFlash={castFlash} />; break;
    case "o2_healer":   sprite = <O2HealerSprite castFlash={castFlash} />; break;
    default: return <View style={{ width: 22, height: 28, borderRadius: 6, backgroundColor: "#334155" }} />;
  }
  return (
    <View style={{ alignItems: "center" }}>
      {/* Level 3: gold crown accent */}
      {level >= 3 && (
        <View style={{ position: "absolute", top: -2, flexDirection: "row", gap: 3, zIndex: 10 }}>
          {[0,1,2].map(i => (
            <View key={i} style={{ width: 3.5, height: i === 1 ? 6 : 4, borderRadius: 2,
              backgroundColor: "#FFD700", opacity: 0.9 }} />
          ))}
        </View>
      )}
      {sprite}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BOARD ENTITY RENDERERS
   ═══════════════════════════════════════════════════════════════════ */
function EnemyOnPath({
  enemy, bobY, aw, ah,
}: { enemy: ActiveEnemy; bobY: Animated.AnimatedInterpolation<number>; aw: number; ah: number }) {
  const def = ENEMY_DATA[enemy.typeId];
  const fpos = getEnemyPosFrac(enemy);
  const px = fpos.x * aw, py = fpos.y * ah;
  const isBoss = !!def.isBoss;
  const spriteScale = isBoss ? 1.05 : 0.86;
  const hpPct = Math.round((enemy.hp / enemy.maxHp) * 100);
  const HP_BAR_W = isBoss ? 54 : 36;

  return (
    <View style={{
      position: "absolute",
      left: px - (isBoss ? 30 : 20),
      top: py - (isBoss ? 46 : 34),
      alignItems: "center", zIndex: 8,
    }}>
      {/* Clue badge — NCLEX cue recognition */}
      <View style={{
        backgroundColor: def.color + "22", borderWidth: 1,
        borderColor: def.color + "70", borderRadius: 4,
        paddingHorizontal: 4, paddingVertical: 1.5, marginBottom: 1.5,
      }}>
        <Text style={{ color: def.color, fontSize: 6.5, fontWeight: "700", letterSpacing: 0.4 }}>
          {def.clue}
        </Text>
      </View>
      {/* Weakness badge — revealed by an Assess hit */}
      {enemy.revealed && (
        <View style={{
          position: "absolute", top: 13, right: -10, zIndex: 9,
          backgroundColor: WEAKNESS_TYPES[def.weakness].color + "30", borderWidth: 1,
          borderColor: WEAKNESS_TYPES[def.weakness].color, borderRadius: 8,
          width: 15, height: 15, alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 8 }}>{WEAKNESS_TYPES[def.weakness].icon}</Text>
        </View>
      )}
      {/* Hidden Pathology lock — elite threat shrugs off most damage until Assess reveals it */}
      {def.hiddenPathology && !enemy.revealed && (
        <View style={{
          position: "absolute", top: 13, right: -10, zIndex: 9,
          backgroundColor: "#0a0e1a", borderWidth: 1.3,
          borderColor: "#94A3B8", borderRadius: 8,
          width: 15, height: 15, alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons name="lock-closed" size={8} color="#94A3B8" />
        </View>
      )}
      {/* Boss HP counter */}
      {isBoss && (
        <Text style={{ color: def.color, fontSize: 8, fontWeight: "700",
          marginBottom: 1, textShadowColor: "#000", textShadowRadius: 2 }}>
          {enemy.hp}
        </Text>
      )}
      {/* Enemy sprite (scaled for board) — golden ring flash on Clinical Chain hit */}
      <View style={{
        transform: [{ scale: spriteScale }],
        ...(enemy.chainFlash > 0 ? {
          borderRadius: 999, borderWidth: 2, borderColor: COLORS.runeGold + "cc",
          shadowColor: COLORS.runeGold, shadowOpacity: 0.9, shadowRadius: 8,
        } : {}),
      }}>
        <EnemySprite typeId={enemy.typeId} hitFlash={enemy.hitFlash > 0} bobY={bobY} />
      </View>
      {/* HP bar */}
      <View style={{ width: HP_BAR_W, height: 4, borderRadius: 2, backgroundColor: "#0a1428",
        marginTop: 2, overflow: "hidden" }}>
        <View style={{ width: `${hpPct}%` as any, height: "100%", borderRadius: 2, backgroundColor: def.color }} />
      </View>
      {/* Ground shadow — anchors enemy visually on the board surface */}
      <View style={{
        width: isBoss ? 46 : 28, height: 5, borderRadius: 3,
        backgroundColor: "#000000aa", marginTop: 1,
      }} />
      {/* Slow indicator */}
      {enemy.slowTicks > 0 && (
        <View style={{ position: "absolute", top: -4, right: -8,
          backgroundColor: "#A78BFA22", borderRadius: 4, paddingHorizontal: 3 }}>
          <Text style={{ color: "#A78BFA", fontSize: 6 }}>↓</Text>
        </View>
      )}
    </View>
  );
}

function DeploymentTileView({
  tileIdx, unit, selectedUnit, canAfford, isMergeCandidate, onPress, aw, ah,
}: {
  tileIdx: number; unit: DeployedUnit | undefined;
  selectedUnit: string; canAfford: boolean;
  isMergeCandidate?: boolean;
  onPress: () => void; aw: number; ah: number;
}) {
  const [fx, fy] = DEPLOY_TILES[tileIdx];
  const px = fx * aw, py = fy * ah;
  const selColor = UNIT_DATA[selectedUnit]?.color ?? "#60A5FA";
  const isOccupied = !!unit;
  const unitColor = isOccupied ? UNIT_DATA[unit!.typeId].color : selColor;
  const isZoneA = tileIdx < 3;
  const isFirstInZone = tileIdx === 0 || tileIdx === 3;
  const cornerColor = isOccupied ? unitColor : canAfford ? selColor : "#2a4a6a";

  return (
    <>
      {/* Zone label — first tile of each zone only */}
      {isFirstInZone && (
        <View style={{
          position: "absolute",
          left: px - TILE_SIZE / 2, top: py - TILE_SIZE / 2 - 14,
          zIndex: 5,
        }}>
          <Text style={{ color: "#d4a840", fontSize: 7, fontWeight: "700", letterSpacing: 1.2 }}>
            {isZoneA ? "WARD-A" : "WARD-B"}
          </Text>
        </View>
      )}

      {/* Summon pad — raised stone rune platform, clearly visible */}
      <Pressable
        style={{
          position: "absolute",
          left: px - TILE_SIZE / 2, top: py - TILE_SIZE / 2,
          width: TILE_SIZE, height: TILE_SIZE,
          borderRadius: TILE_SIZE / 2,
          backgroundColor: isOccupied
            ? unitColor + "33"
            : canAfford
              ? "#5a4828"
              : "#3a2e18",
          borderWidth: isOccupied ? 2.5 : 2,
          borderColor: isOccupied
            ? unitColor + "ee"
            : canAfford
              ? selColor + "cc"
              : "#6a5428",
          alignItems: "center", justifyContent: "center", zIndex: 4,
        }}
        onPress={onPress}
      >
        {/* Stone pad base gradient — warm raised platform look */}
        <LinearGradient
          colors={isOccupied
            ? [unitColor + "40", unitColor + "18"]
            : canAfford
              ? ["#7a6030", "#4a3820"]
              : ["#4a3c1c", "#2e2412"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: TILE_SIZE / 2 }}
        />
        {/* Inner rune ring */}
        <View style={{ position: "absolute", width: TILE_SIZE - 12, height: TILE_SIZE - 12,
          borderRadius: (TILE_SIZE - 12) / 2, borderWidth: 1.5,
          borderColor: isOccupied ? unitColor + "cc" : canAfford ? selColor + "aa" : "#c8a05060" }} />
        {/* 6 rune point diamonds at pad edge */}
        {[0, 60, 120, 180, 240, 300].map((deg, i) => {
          const rr = (TILE_SIZE - 10) / 2;
          const bx = TILE_SIZE / 2 + Math.sin(deg * Math.PI / 180) * rr - 2.5;
          const by = TILE_SIZE / 2 - Math.cos(deg * Math.PI / 180) * rr - 2.5;
          return (
            <View key={i} style={{ position: "absolute", left: bx, top: by,
              width: 5, height: 5, borderRadius: 1,
              backgroundColor: isOccupied ? unitColor : canAfford ? selColor : "#c8a050",
              opacity: isOccupied ? 0.92 : canAfford ? 0.88 : 0.60,
              transform: [{ rotate: "45deg" }] }} />
          );
        })}

        {isOccupied ? (
          <>
            {/* Merge candidate golden pulse ring */}
            {isMergeCandidate && (
              <View style={{ position: "absolute", top: -4, left: -4, right: -4, bottom: -4,
                borderRadius: TILE_SIZE / 2 + 4, borderWidth: 2, borderColor: "#FFD70088" }} />
            )}
            {/* Merge flash golden fill */}
            {(unit!.mergeFlash ?? 0) > 0 && (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                borderRadius: TILE_SIZE / 2, backgroundColor: "#FFD70018" }} />
            )}
            {/* Merge Rank badge top-left — battle-only, resets each run */}
            {(unit!.level ?? 1) > 1 && (
              <View style={{ position: "absolute", top: 3, left: 3, borderRadius: 3,
                backgroundColor: (unit!.level ?? 1) >= MERGE_RANK_CAP ? "#FFD700" : "#a78bfa",
                paddingHorizontal: 3, paddingVertical: 1 }}>
                <Text style={{ color: "#0a0a1a", fontSize: 5, fontWeight: "800" }}>
                  {mergeRankName(unit!.level ?? 1)}
                </Text>
              </View>
            )}
            {/* Category badge top-right */}
            <View style={{ position: "absolute", top: 3, right: 3,
              backgroundColor: unitColor + "35", borderRadius: 3, paddingHorizontal: 3 }}>
              <Text style={{ color: unitColor, fontSize: 5.5, fontWeight: "700" }}>
                {UNIT_DATA[unit!.typeId].category.slice(0, 3)}
              </Text>
            </View>
            {/* Drop shadow beneath sprite — grounds unit on tile */}
            <View style={{ position: "absolute", bottom: 5, width: TILE_SIZE - 16, height: 5,
              borderRadius: 3, backgroundColor: "#00000070" }} />
            <UnitSprite typeId={unit!.typeId} castFlash={unit!.castFlash > 0} level={unit!.level ?? 1} />
            {/* Attack range ring */}
            <View style={{ position: "absolute",
              width: UNIT_DATA[unit!.typeId].range * 2 * aw,
              height: UNIT_DATA[unit!.typeId].range * 2 * aw,
              borderRadius: UNIT_DATA[unit!.typeId].range * aw,
              borderWidth: 1, borderColor: unitColor + "18",
              backgroundColor: unitColor + "04", zIndex: -1 }} />
          </>
        ) : (
          /* Empty pad: rune spiral rings — ward summoning circle, no plus symbol */
          <View style={{ alignItems: "center", justifyContent: "center", width: TILE_SIZE, height: TILE_SIZE }}>
            {/* Outer glow ring */}
            <View style={{ position: "absolute", width: TILE_SIZE - 4, height: TILE_SIZE - 4,
              borderRadius: (TILE_SIZE - 4) / 2,
              borderWidth: 1.5, borderColor: canAfford ? selColor + "88" : "#c8a05055",
              borderStyle: "dashed" as any }} />
            {/* Middle ring */}
            <View style={{ position: "absolute", width: TILE_SIZE - 14, height: TILE_SIZE - 14,
              borderRadius: (TILE_SIZE - 14) / 2,
              borderWidth: 1, borderColor: canAfford ? selColor + "55" : "#c8a05033" }} />
            {/* Center glow dot */}
            <View style={{ width: 6, height: 6, borderRadius: 3,
              backgroundColor: canAfford ? selColor + "cc" : "#c8a050aa" }} />
          </View>
        )}
      </Pressable>
    </>
  );
}

function ProjectileView({
  p, aw, ah,
}: { p: Projectile; aw: number; ah: number }) {
  const cx = lp(p.fromFx, p.toFx, p.progress) * aw;
  const cy = lp(p.fromFy, p.toFy, p.progress) * ah;
  return (
    <View style={{
      position: "absolute",
      left: cx - 7, top: cy - 7,
      width: 14, height: 14, borderRadius: 7,
      backgroundColor: p.color + "55",
      borderWidth: 1.5, borderColor: p.color,
      alignItems: "center", justifyContent: "center",
      zIndex: 10,
    }}>
      {/* Bright core */}
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#ffffff" }} />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HAND PANEL — Deploy units + use abilities
   ═══════════════════════════════════════════════════════════════════ */
function HandPanel({
  mode, setMode, selectedUnit, onSelectUnit, onUseAbility, ap, isPlaying,
  hasMerge, onSynthesize, abilityCooldowns, loadout,
}: {
  mode: "deploy" | "abilities";
  setMode: (m: "deploy" | "abilities") => void;
  selectedUnit: string;
  onSelectUnit: (typeId: string) => void;
  onUseAbility: (id: string) => void;
  ap: number;
  isPlaying: boolean;
  hasMerge: boolean;
  onSynthesize: () => void;
  abilityCooldowns: Record<string, number>;
  loadout: string[];
}) {
  return (
    <View style={s.handArea}>
      <View style={s.handRow}>
        {/* Cards area — flex row, fills space */}
        <View style={s.handCards}>
          {mode === "deploy" ? (
            <>
              {hasMerge && (
                <Pressable onPress={onSynthesize}
                  style={[s.unitCard, { borderColor: "#FFD700", backgroundColor: "#1a1000",
                    borderWidth: 2, justifyContent: "center", alignItems: "center" }]}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2,
                    borderColor: "#FFD700", backgroundColor: "#FFD70020",
                    alignItems: "center", justifyContent: "center", marginBottom: 3 }}>
                    {[0,1,2].map(i=>(
                      <View key={i} style={{ position: "absolute", width: 2.5, height: i===1?9:6,
                        borderRadius: 2, backgroundColor: "#FFD700",
                        transform: [{ rotate: `${i*60}deg` }] }} />
                    ))}
                  </View>
                  <Text style={{ color: "#FFD700", fontSize: 6, fontWeight: "800",
                    letterSpacing: 0.8, textAlign: "center" }}>CARE{"\n"}SYNTHESIS</Text>
                  <View style={[s.apRune, { borderColor: "#FFD700", backgroundColor: "#FFD70022", marginTop: 3 }]}>
                    <Text style={[s.apRuneTxt, { color: "#FFD700" }]}>✦</Text>
                    <Text style={[s.apRuneLabel, { color: "#FFD700CC" }]}>FREE</Text>
                  </View>
                </Pressable>
              )}
              {(loadout.length > 0 ? loadout : UNIT_TYPES).map(typeId => {
                const u = UNIT_DATA[typeId];
                if (!u) return null;
                const canAfford = ap >= u.apCost;
                const isSelected = selectedUnit === typeId;
                return (
                  <Pressable key={typeId}
                    style={[s.unitCard, { borderColor: isSelected ? u.color : canAfford ? u.color + "55" : COLORS.border,
                      backgroundColor: isSelected ? u.color + "20" : canAfford ? "#080e18" : "#060a12" }]}
                    onPress={() => onSelectUnit(typeId)}>
                    <Text style={[s.cardCatBadge, { color: canAfford ? u.color : COLORS.onSurfaceTertiary }]}>
                      {u.category}
                    </Text>
                    <View style={{
                      width: "100%", minHeight: 72, borderRadius: 8,
                      overflow: "hidden", marginVertical: 2,
                      alignItems: "center", justifyContent: "flex-end",
                    }}>
                      <LinearGradient
                        colors={[u.color + "0a", u.color + "30"]}
                        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <ExpoImage
                        source={CARD_PORTRAITS[typeId]}
                        style={{ width: 60, height: 78 }}
                        contentFit="contain"
                        cachePolicy="none"
                      />
                      {!canAfford && (
                        <View style={{ ...StyleSheet.absoluteFillObject as any, backgroundColor: "#00000060" }}/>
                      )}
                    </View>
                    <Text style={[s.unitCardName, { color: isSelected ? u.color : canAfford ? u.color + "CC" : COLORS.onSurfaceTertiary }]}
                      numberOfLines={1}>{u.name}</Text>
                    <View style={[s.apRune, { borderColor: canAfford ? u.color + "70" : COLORS.border,
                      backgroundColor: canAfford ? u.color + "22" : "transparent" }]}>
                      <Text style={[s.apRuneTxt, { color: canAfford ? u.color : COLORS.onSurfaceTertiary }]}>{u.apCost}</Text>
                      <Text style={[s.apRuneLabel, { color: canAfford ? u.color + "CC" : COLORS.onSurfaceTertiary }]}>AP</Text>
                    </View>
                  </Pressable>
                );
              })}
            </>
          ) : (
            ABILITIES.map(id => {
              const ab = ABILITY_DATA[id];
              const cooldown = abilityCooldowns[id] ?? 0;
              const onCooldown = cooldown > 0;
              const canAfford = ap >= ab.apCost && isPlaying && !onCooldown;
              return (
                <Pressable key={id}
                  style={[s.abilityCard, { borderColor: canAfford ? ab.color + "70" : COLORS.border,
                    backgroundColor: canAfford ? "#080e18" : "#060a12", opacity: canAfford ? 1 : 0.45 }]}
                  onPress={() => onUseAbility(id)} disabled={!canAfford}>
                  <Text style={{ fontSize: 7.5, fontWeight: "700", color: canAfford ? ab.color : COLORS.onSurfaceTertiary, letterSpacing: 0.8 }}>
                    {ab.category}
                  </Text>
                  <Text style={{ fontSize: 20, marginVertical: 3 }}>{ab.icon}</Text>
                  <Text style={[s.unitCardName, { color: canAfford ? ab.color : COLORS.onSurfaceTertiary }]}
                    numberOfLines={2}>{ab.name}</Text>
                  <View style={[s.apRune, { borderColor: canAfford ? ab.color + "70" : COLORS.border,
                    backgroundColor: canAfford ? ab.color + "22" : "transparent" }]}>
                    <Text style={[s.apRuneTxt, { color: canAfford ? ab.color : COLORS.onSurfaceTertiary }]}>{ab.apCost}</Text>
                    <Text style={[s.apRuneLabel, { color: canAfford ? ab.color + "CC" : COLORS.onSurfaceTertiary }]}>AP</Text>
                  </View>
                  {onCooldown && (
                    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: "#00000090", borderRadius: 10,
                      alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="time-outline" size={14} color="#FBBF24" />
                      <Text style={{ color: "#FBBF24", fontSize: 11, fontWeight: "800", marginTop: 2 }}>
                        {Math.ceil(cooldown / 2)}s
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
        </View>

        {/* Right sidebar */}
        <View style={s.handSidebar}>
          <Pressable style={s.handSideBtn}
            onPress={() => setMode(mode === "deploy" ? "abilities" : "deploy")}>
            <Text style={{ fontSize: 13 }}>{mode === "deploy" ? "⚡" : "⚔"}</Text>
            <Text style={s.handSideBtnTxt}>{mode === "deploy" ? "SKILLS" : "UNITS"}</Text>
          </Pressable>
          <View style={s.handItemsBadge}>
            <Text style={s.handItemsNum}>2</Text>
            <Text style={s.handItemsLabel}>ITEMS</Text>
          </View>
          <View style={s.handPauseBtn}>
            <Text style={{ fontSize: 11 }}>✿</Text>
            <Text style={s.handPauseTxt}>PAUSE</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ── Wave pause overlay ── */
function WavePauseOverlay({ wave }: { wave: number }) {
  const nextWave = wave + 1;
  const isBossNext = WAVES[nextWave]?.isBoss;
  return (
    <View style={s.pauseOverlay}>
      <LinearGradient colors={["rgba(4,10,22,0.90)", "rgba(4,10,22,0.96)"]}
        style={StyleSheet.absoluteFillObject} />
      <Text style={s.pauseTitle}>
        {isBossNext ? "⚠ BOSS WAVE INCOMING" : nextWave < WAVES.length
          ? `WAVE ${nextWave + 1} INCOMING` : "FINAL WAVE CLEARED…"}
      </Text>
      <Text style={s.pauseSub}>Deploy your units — ward stabilizing…</Text>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN WARD DEFENSE COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function WardDefense() {
  const router = useRouter();
  const { player, applyRewards, recordWardWaves, syncInventory, setWardLoadout } = usePlayer();
  const [pendingBoosts, setPendingBoosts] = useState<string[]>([]);

  const gsRef = useRef<GS>(freshState());
  const [, bump] = useState(0);
  const rewardsApplied = useRef(false);
  /* Wave indices already banked into ward_defense_waves this run (dedupe so a
     wave clears exactly once even though the tick loop re-renders many times). */
  const wavesRecorded = useRef<Set<number>>(new Set());

  const gs = gsRef.current;
  function set(next: GS) { gsRef.current = next; bump(t => t + 1); }

  /* Arena size (updated via onLayout) */
  const [arena, setArena] = useState({ w: 360, h: 260 });

  /* Hand mode + selected unit (UI state) */
  const [handMode, setHandMode] = useState<"deploy" | "abilities">("deploy");
  const [speedMul, setSpeedMul] = useState(1);   /* 1× or 2× game speed */
  const [selectedUnit, setSelectedUnit] = useState("ward_scout");
  const [cqAnswered, setCqAnswered] = useState<{ wave: number; correct: boolean } | null>(null);
  const [cqCueChoice, setCqCueChoice] = useState<{ wave: number; choice: "empower" | "stabilize" } | null>(null);
  const [cqDismissedWave, setCqDismissedWave] = useState<number | null>(null);

  /* Shared idle bob animation */
  const bobAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bobAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
      Animated.timing(bobAnim, { toValue: 0, duration: 900, useNativeDriver: false }),
    ])).start();
  }, []);
  const bobY = bobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  /* ── Clinical question AP bonus — shown during wave prep pauses ── */
  function answerClinQ(optIdx: number) {
    if (cqAnswered?.wave === gs.wave) return;
    const q = CLINICAL_QUESTIONS[gs.wave % CLINICAL_QUESTIONS.length];
    const correct = optIdx === q.correct;
    setCqAnswered({ wave: gs.wave, correct });
    const s = gsRef.current;
    if (correct) {
      set({ ...s, ap: Math.min(s.ap + PREWAVE_AP_BONUS, MAX_AP),
        feedbacks: [{ id: String(Date.now()), text: `+${PREWAVE_AP_BONUS} AP · Clinical reasoning! Choose your tactical edge below.`, color: "#22d3ee", quality: "bonus" as any, ticks: 10 }, ...s.feedbacks.slice(0, 1)] });
    } else {
      set({ ...s,
        feedbacks: [{ id: String(Date.now()), text: "✗ Study the rationale — no AP bonus.", color: "#f87171", quality: "weak" as any, ticks: 10 }, ...s.feedbacks.slice(0, 1)] });
    }
  }

  /* ── Clinical Cue tactical choice — player picks the reward for a correct answer ── */
  function chooseCueTactic(choice: "empower" | "stabilize") {
    if (cqCueChoice?.wave === gs.wave) return;
    setCqCueChoice({ wave: gs.wave, choice });
    const s = gsRef.current;
    if (choice === "empower") {
      set({ ...s, cueBonusReady: true,
        feedbacks: [{ id: String(Date.now()) + "e", text: "⚔ Empower chosen — next strong hit is boosted!", color: "#22d3ee", quality: "bonus" as any, ticks: 8 }, ...s.feedbacks.slice(0, 1)] });
    } else {
      const stability = cl(s.stability + CUE_STABILIZE_BONUS, 0, MAX_STABILITY);
      set({ ...s, stability,
        feedbacks: [{ id: String(Date.now()) + "s", text: `🌊 Stability Surge chosen — +${CUE_STABILIZE_BONUS} Stability!`, color: "#06B6D4", quality: "bonus" as any, ticks: 8 }, ...s.feedbacks.slice(0, 1)] });
    }
  }

  /* ── Game tick ── */
  useEffect(() => {
    const iv = setInterval(() => {
      const s = gsRef.current;

      /* Wave pause countdown */
      if (s.phase === "wave_pause") {
        const pt = s.wavePauseTicks - 1;
        if (pt <= 0) {
          const nw = s.wave + 1;
          if (nw >= WAVES.length) set({ ...s, phase: "won" });
          else set(beginWave(s, nw));
        } else set({ ...s, wavePauseTicks: pt });
        return;
      }

      if (s.phase !== "playing") return;

      /* AP regen */
      let ap = s.ap;
      let apTimer = s.apTimer - 1;
      if (apTimer <= 0 && ap < MAX_AP) { ap++; apTimer = AP_REGEN_TICKS; }
      else apTimer = Math.max(0, apTimer);

      let feedbacks = s.feedbacks.map(f => ({ ...f, ticks: f.ticks - 1 })).filter(f => f.ticks > 0);

      /* Spawn enemies */
      let { spawnQueue, spawnTimer, uidSeed } = s;
      spawnTimer = Math.max(0, spawnTimer - 1);
      let spawnedEnemies = [...s.enemies];
      if (spawnTimer === 0 && spawnQueue.length > 0) {
        const typeId = spawnQueue[0];
        spawnedEnemies = [...spawnedEnemies, {
          uid: `e${uidSeed}`, typeId,
          hp: ENEMY_DATA[typeId].maxHp, maxHp: ENEMY_DATA[typeId].maxHp,
          pathIndex: 0, pathProgress: 0, hitFlash: 0, slowTicks: 0,
          revealed: false, assessTick: -999, chainFlash: 0,
        }];
        spawnQueue = spawnQueue.slice(1);
        spawnTimer = SPAWN_GAP_TICKS;
        uidSeed++;
        if (ENEMY_DATA[typeId].isBoss) {
          feedbacks = [{ id: `boss${uidSeed}`, text: `⚠ Priority Target — ${ENEMY_DATA[typeId].name} incoming!`,
            color: ENEMY_DATA[typeId].color, quality: "bonus" as any, ticks: 8 }, ...feedbacks.slice(0, 1)];
        }
      }

      /* Move enemies along path */
      const reachedLantern: ActiveEnemy[] = [];
      const movedEnemies: ActiveEnemy[] = [];
      for (const e of spawnedEnemies) {
        const eDef = ENEMY_DATA[e.typeId];
        /* Shock Shade lurches forward in sudden bursts; slow effect still applies */
        const burst = eDef.speedBurstChance && Math.random() < eDef.speedBurstChance ? 2.0 : 1.0;
        const spd = eDef.speed * ENEMY_SPEED_BOOST * (e.slowTicks > 0 ? 0.45 : 1.0) * burst;
        let pi = e.pathIndex, pp = e.pathProgress + spd;
        let sl = Math.max(0, e.slowTicks - 1);
        let hf = Math.max(0, e.hitFlash - 1);
        let cf = Math.max(0, e.chainFlash - 1);
        /* Corruption Leech mends itself while alive */
        let hp = e.hp;
        if (eDef.selfHealPerTick && hp < e.maxHp) hp = Math.min(e.maxHp, hp + eDef.selfHealPerTick);
        while (pp >= 1.0 && pi < N_SEGS) { pp -= 1.0; pi++; }
        if (pi >= N_SEGS) reachedLantern.push(e);
        else movedEnemies.push({ ...e, hp, pathIndex: pi, pathProgress: pp, slowTicks: sl, hitFlash: hf, chainFlash: cf });
      }

      /* Shield decay (Positioning — halves incoming Stability loss while active) */
      const shieldMul = s.shieldTicks > 0 ? 0.5 : 1.0;
      const shieldTicks = Math.max(0, s.shieldTicks - 1);
      const abilityCooldowns: Record<string, number> = {};
      for (const [k, v] of Object.entries(s.abilityCooldowns)) {
        const nv = v - 1; if (nv > 0) abilityCooldowns[k] = nv;
      }

      /* Treatment Field — lingering Broncho Burst mist ticks damage to every enemy while active */
      const treatmentFieldTicks = Math.max(0, s.treatmentFieldTicks - 1);
      if (s.treatmentFieldTicks > 0) {
        for (let i = 0; i < movedEnemies.length; i++) {
          movedEnemies[i] = { ...movedEnemies[i], hp: movedEnemies[i].hp - TREATMENT_FIELD_DMG, hitFlash: 2 };
        }
      }
      const fieldKilled = movedEnemies.filter(e => e.hp <= 0);
      if (fieldKilled.length > 0) {
        for (const e of fieldKilled) movedEnemies.splice(movedEnemies.indexOf(e), 1);
      }

      /* Lantern leaks — direct Stability damage + a Corruption spike (an uncontrolled threat got through) */
      let stability = s.stability;
      let corruption = s.corruption;
      let leakCorruption = 0;
      for (const e of reachedLantern) {
        stability = Math.max(0, stability - Math.round(ENEMY_DATA[e.typeId].damage * shieldMul));
        leakCorruption += ENEMY_DATA[e.typeId].corruptionOnLeak;
      }
      corruption = cl(corruption + leakCorruption, 0, MAX_CORRUPTION);

      /* Units: decay cooldown → fire projectiles */
      let newProjectiles = [...s.projectiles];
      const updatedUnits = s.deployedUnits.map(u => {
        const cd = Math.max(0, u.cooldown - 1);
        const cf = Math.max(0, u.castFlash - 1);
        const mf = Math.max(0, (u.mergeFlash ?? 0) - 1);
        const uPos = getUnitPosFrac(u.tileIndex);
        /* Stun Toad disables the nearest healer it lumbers past */
        let stunTicks = Math.max(0, (u.stunTicks ?? 0) - 1);
        for (const e of movedEnemies) {
          if (ENEMY_DATA[e.typeId].stunOnPass && distFrac(uPos, getEnemyPosFrac(e)) < 0.06) {
            stunTicks = 4; break;
          }
        }
        if (stunTicks > 0) return { ...u, cooldown: Math.max(cd, 1), castFlash: cf, mergeFlash: mf, stunTicks };
        if (cd > 0) return { ...u, cooldown: cd, castFlash: cf, mergeFlash: mf, stunTicks };
        const uDef = UNIT_DATA[u.typeId];
        const scaled = getScaledStats(uDef, u.level ?? 1, s.unitLevels[u.typeId] ?? 1);
        let tgt: ActiveEnemy | null = null, minD = Infinity;
        for (const e of movedEnemies) {
          const d = distFrac(uPos, getEnemyPosFrac(e));
          if (d <= scaled.range && d < minD) { minD = d; tgt = e; }
        }
        if (!tgt) return { ...u, cooldown: 0, castFlash: cf, mergeFlash: mf, stunTicks };
        const ePos = getEnemyPosFrac(tgt);
        /* Lunge direction toward the target — drives the per-unit attack choreography */
        const ddx = ePos.x - uPos.x, ddy = ePos.y - uPos.y;
        const dmag = Math.hypot(ddx, ddy) || 1;
        newProjectiles = [...newProjectiles, {
          uid: `p${s.tickCount}_${u.uid}`,
          toEnemyUid: tgt.uid,
          fromFx: uPos.x, fromFy: uPos.y,
          toFx: ePos.x, toFy: ePos.y,
          progress: 0, color: uDef.color,
          damage: scaled.damage, unitTypeId: u.typeId,
        }];
        return { ...u, cooldown: scaled.attackSpeed, castFlash: 2, mergeFlash: mf, stunTicks,
          atkDx: ddx / dmag, atkDy: ddy / dmag };
      });

      /* Move projectiles → collect hits */
      type HitRec = { dmg: number; quality: "strong"|"partial"|"weak"; unitTypeId: string; chain?: boolean; cueBonus?: boolean };
      const hitMap: Record<string, HitRec[]> = {};
      const revealMap: Record<string, boolean> = {};
      const aliveProj: Projectile[] = [];
      let cueBonusReady = s.cueBonusReady;
      let cueBonusFeedback: string | null = null;
      for (const p of newProjectiles) {
        const te = movedEnemies.find(e => e.uid === p.toEnemyUid);
        if (!te) continue;
        const ePos = getEnemyPosFrac(te);
        const np = p.progress + 0.38;
        if (np >= 1.0) {
          const q = getMatchQuality(p.unitTypeId, te.typeId);
          let dmg = applyDmg(p.damage, q);
          const uRole = UNIT_DATA[p.unitTypeId]?.role;
          let chain = false;
          if (uRole === "ASSESS") {
            revealMap[te.uid] = true;
          } else if ((uRole === "TREAT" || uRole === "STABILIZE") && te.revealed
            && (s.tickCount - te.assessTick) <= CLINICAL_CHAIN_WINDOW) {
            dmg = Math.round(dmg * 1.25);
            chain = true;
          }
          let cueBonus = false;
          if (cueBonusReady && q === "strong") {
            dmg = Math.round(dmg * 1.2);
            cueBonus = true;
            cueBonusReady = false;
            cueBonusFeedback = `✚ Response Improved — Clinical Cue bonus applied!`;
          }
          /* Hidden Pathology: elite enemies shrug off nearly all damage until
             their weakness is revealed (Assess/Reassess). Reveal is applied
             later this tick, so the enemy stays resistant through the reveal hit
             itself, then takes full matchup damage from the next hit onward. */
          if (ENEMY_DATA[te.typeId].hiddenPathology && !te.revealed) {
            dmg = Math.max(1, Math.round(dmg * BOSS_UNREVEALED_RESIST));
          }
          (hitMap[te.uid] ??= []).push({ dmg, quality: q, unitTypeId: p.unitTypeId, chain, cueBonus });
        } else {
          aliveProj.push({ ...p, toFx: ePos.x, toFy: ePos.y, progress: np });
        }
      }

      /* Apply hits to enemies */
      let careChain = s.careChain, peakCareChain = s.peakCareChain;
      let priorityActions = s.priorityActions;
      let strongMatches = s.strongMatches, partialMatches = s.partialMatches, weakMatches = s.weakMatches;
      let learnedConcepts = s.learnedConcepts;
      let enemyMastery = { ...s.enemyMastery };
      let lastKillQuality = s.lastKillQuality;
      let score = s.score;
      let corruptionCleanse = 0; /* correct matchups push Corruption back down */

      if (cueBonusFeedback) {
        feedbacks = [{ id: `cue${s.tickCount}`, text: cueBonusFeedback,
          color: "#22d3ee", quality: "bonus" as any, ticks: 6 }, ...feedbacks.slice(0, 1)];
      }

      const survEnemies: ActiveEnemy[] = [];
      for (const e of movedEnemies) {
        const hits = hitMap[e.uid];
        if (!hits?.length) { survEnemies.push(e); continue; }
        const totalDmg = hits.reduce((sum, h) => sum + h.dmg, 0);
        const quality: "strong"|"partial"|"weak" = hits.some(h => h.quality === "strong") ? "strong"
          : hits.some(h => h.quality === "partial") ? "partial" : "weak";
        const gotChain = hits.some(h => h.chain);
        const nowRevealed = e.revealed || !!revealMap[e.uid];
        if (quality === "strong") { strongMatches++; corruptionCleanse += gotChain ? 2.5 : 1.5; }
        else if (quality === "partial") { partialMatches++; corruptionCleanse += 0.4; }
        else weakMatches++;
        score += totalDmg;

        if (!e.revealed && revealMap[e.uid]) {
          const wk = WEAKNESS_TYPES[ENEMY_DATA[e.typeId].weakness];
          feedbacks = [{ id: `rv${e.uid}`, text: `🔍 Cue Revealed — ${wk.icon} ${wk.label}`,
            color: wk.color, quality: "bonus" as any, ticks: 5 }, ...feedbacks.slice(0, 1)];
        }
        if (gotChain) {
          feedbacks = [{ id: `cc${e.uid}`, text: `⚡ Clinical Chain — Cause Addressed!`,
            color: COLORS.runeGold, quality: "bonus" as any, ticks: 5 }, ...feedbacks.slice(0, 1)];
        }

        const newHp = e.hp - totalDmg;
        if (newHp <= 0) {
          ap = Math.min(MAX_AP, ap + KILL_AP_BONUS);
          const prevM = enemyMastery[e.typeId] ?? { defeated: false, correctDefeated: false };
          enemyMastery = { ...enemyMastery, [e.typeId]: {
            defeated: true, correctDefeated: prevM.correctDefeated || quality === "strong",
          }};
          if (quality === "strong") {
            careChain++; peakCareChain = Math.max(peakCareChain, careChain);
            priorityActions++; lastKillQuality = "strong";
            const sUnit = hits.find(h => h.quality === "strong")!.unitTypeId;
            if (!learnedConcepts.includes(sUnit)) learnedConcepts = [...learnedConcepts, sUnit];
            if (ENEMY_DATA[e.typeId].isPriority) {
              corruptionCleanse += 5;
              feedbacks = [{ id: `pc${e.uid}`, text: `✦ Priority Controlled — ${ENEMY_DATA[e.typeId].name} neutralized`,
                color: COLORS.success, quality: "strong", ticks: 6 }, ...feedbacks.slice(0, 1)];
            } else {
              corruptionCleanse += 2;
              feedbacks = [{ id: `k${e.uid}`, text: `✦ Priority Action — ${ENEMY_DATA[e.typeId].name} neutralized`,
                color: COLORS.success, quality: "strong", ticks: 6 }, ...feedbacks.slice(0, 1)];
            }
            if (careChain >= 2) {
              ap = Math.min(MAX_AP, ap + 1);
              feedbacks = [{ id: `ch${s.tickCount}`, text: `⛓ Care Chain ×${careChain}! +1 AP`,
                color: COLORS.runeGold, quality: "bonus" as any, ticks: 7 }, ...feedbacks.slice(0, 1)];
            }
          } else if (quality === "weak") {
            careChain = 0; lastKillQuality = "weak";
            feedbacks = [{ id: `w${e.uid}`, text: `◌ Weak Match — deploy a more targeted unit`,
              color: COLORS.onSurfaceTertiary, quality: "weak", ticks: 5 }, ...feedbacks.slice(0, 1)];
          } else {
            careChain = 0; lastKillQuality = "partial";
            feedbacks = [{ id: `pm${e.uid}`, text: `◈ Partial Match — partially effective`,
              color: COLORS.warning, quality: "partial", ticks: 4 }, ...feedbacks.slice(0, 1)];
          }
        } else {
          survEnemies.push({
            ...e, hp: newHp, hitFlash: 3,
            revealed: nowRevealed,
            assessTick: revealMap[e.uid] ? s.tickCount : e.assessTick,
            chainFlash: gotChain ? 4 : e.chainFlash,
          });
        }
      }

      /* Corruption pressure from active threats, dampened by current Stability —
         a healthier ward resists disease pressure better. */
      const dampen = 1 - (cl(stability, 0, 100) / 100) * CORRUPTION_DAMPEN_MAX;
      let corruptionGain = 0;
      for (const e of survEnemies) corruptionGain += ENEMY_DATA[e.typeId].corruptionPressure * dampen;
      const cleanseMul = 1 + (cl(stability, 0, 100) / 100) * CORRUPTION_CLEANSE_MAX;
      corruption = cl(corruption + corruptionGain - corruptionCleanse * cleanseMul, 0, MAX_CORRUPTION);

      /* Corruption ⇄ Stability feedback — high Corruption actively drains Stability;
         once Corruption is maxed out, the drain becomes severe. */
      let corruptionDrain = 0;
      if (corruption > CORRUPTION_DRAIN_START) corruptionDrain += (corruption - CORRUPTION_DRAIN_START) * CORRUPTION_DRAIN_RATE;
      if (corruption >= MAX_CORRUPTION) corruptionDrain += CORRUPTION_MAX_PENALTY;
      if (corruptionDrain > 0) stability = cl(stability - corruptionDrain * shieldMul, 0, MAX_STABILITY);

      /* HUD danger pulses */
      let stabilityPulse = Math.max(0, s.stabilityPulse - 1);
      if (stability < s.stability) stabilityPulse = PULSE_TICKS;
      let corruptionPulse = Math.max(0, s.corruptionPulse - 1);
      if (corruption > s.corruption || corruption >= CORRUPTION_DRAIN_START) corruptionPulse = PULSE_TICKS;

      const ns: GS = {
        ...s,
        ap: Math.min(MAX_AP, ap), apTimer,
        spawnQueue, spawnTimer, uidSeed,
        enemies: survEnemies, projectiles: aliveProj,
        deployedUnits: updatedUnits,
        stability, feedbacks, score,
        tickCount: s.tickCount + 1,
        careChain, peakCareChain, priorityActions,
        strongMatches, partialMatches, weakMatches,
        learnedConcepts, enemyMastery, lastKillQuality,
        cueBonusReady,
        corruption, stabilityPulse, corruptionPulse, shieldTicks, abilityCooldowns,
        treatmentFieldTicks,
      };

      if (ns.stability <= 0) { set({ ...ns, phase: "lost" }); return; }
      if (ns.spawnQueue.length === 0 && ns.enemies.length === 0) {
        const nw = ns.wave + 1;
        if (nw >= WAVES.length) { set({ ...ns, phase: "won" }); return; }
        set({ ...ns, phase: "wave_pause", wavePauseTicks: WAVE_PAUSE_TICKS });
        return;
      }
      set(ns);
    }, TICK_MS / speedMul);
    return () => clearInterval(iv);
  }, [speedMul]);

  /* ── Bank each cleared Bloom wave into the persisted counter ── */
  useEffect(() => {
    // A wave is fully cleared when the run transitions into the between-wave
    // pause (moving on to the next wave) or into "won" (the final wave cleared).
    // gs.wave still holds the just-cleared wave index at both points.
    if ((gs.phase === "wave_pause" || gs.phase === "won") && !wavesRecorded.current.has(gs.wave)) {
      wavesRecorded.current.add(gs.wave);
      recordWardWaves(1).catch(() => {});
    }
  }, [gs.phase, gs.wave]);

  /* ── Apply rewards on game end ── */
  useEffect(() => {
    if ((gs.phase === "won" || gs.phase === "lost") && !rewardsApplied.current && player) {
      rewardsApplied.current = true;
      const r = calcRewards(gs.phase === "won", gs.stability);
      applyRewards({ xp: r.playerXp, codexShards: r.codexShards }).catch(() => {});
    }
  }, [gs.phase, player]);

  /* ── Start / replay ── */
  function startGame() {
    rewardsApplied.current = false;
    wavesRecorded.current = new Set();
    setHandMode("deploy");

    // Resolve this run's loadout: player's chosen units, filtered to owned; fall
    // back to starters so a fresh/empty loadout can never leave the player unarmed.
    const owned = player?.owned_units || {};
    const chosen = (player?.ward_loadout && player.ward_loadout.length > 0)
      ? player.ward_loadout : STARTER_UNIT_IDS;
    // Sanitize: dedupe, owned-only, cap at LOADOUT_SIZE — guards against malformed data.
    let runLoadout = sanitizeLoadout(chosen, owned);
    if (runLoadout.length === 0) runLoadout = [...STARTER_UNIT_IDS];
    setSelectedUnit(runLoadout[0]);

    // Apply + consume any activated Ward Defense boosts from inventory.
    const boostEffect: { startAP: number; startShield: number } = {
      startAP: 0, startShield: 0,
    };
    if (player && pendingBoosts.length > 0) {
      const inv = { ...(player.inventory || {}) };
      let consumedAny = false;
      pendingBoosts.forEach((id) => {
        const boost = findWardBoost(id);
        if (!boost) return;
        if ((inv[boost.name] || 0) <= 0) return;
        inv[boost.name] = inv[boost.name] - 1;
        if (inv[boost.name] <= 0) delete inv[boost.name];
        boostEffect.startAP += boost.effect.startAP || 0;
        boostEffect.startShield += boost.effect.startShield || 0;
        consumedAny = true;
      });
      if (consumedAny) syncInventory(inv).catch(() => {});
    }
    setPendingBoosts([]);
    setCqAnswered(null);
    setCqCueChoice(null);
    setCqDismissedWave(null);
    set(beginWave(freshState(boostEffect, runLoadout, owned), 0));
  }

  /* ── Deploy a unit on a tile ── */
  function deployUnit(tileIdx: number) {
    const s = gsRef.current;
    if (s.phase !== "playing" && s.phase !== "wave_pause") return;
    if (s.deployedUnits.find(u => u.tileIndex === tileIdx)) {
      const fid = String(Date.now());
      set({ ...s, feedbacks: [{ id: fid, text: "Tile occupied", color: COLORS.onSurfaceTertiary, quality: "weak", ticks: 3 }, ...s.feedbacks.slice(0, 1)] });
      return;
    }
    const uDef = UNIT_DATA[selectedUnit];
    if (!uDef || (s.loadout.length > 0 && !s.loadout.includes(selectedUnit))) {
      const fid = String(Date.now());
      set({ ...s, feedbacks: [{ id: fid, text: "Unit not in your loadout", color: COLORS.warning, quality: "weak", ticks: 4 }, ...s.feedbacks.slice(0, 1)] });
      return;
    }
    if (s.ap < uDef.apCost) {
      const fid = String(Date.now());
      set({ ...s, feedbacks: [{ id: fid, text: `Need ${uDef.apCost} AP for ${uDef.name}`, color: COLORS.warning, quality: "weak", ticks: 4 }, ...s.feedbacks.slice(0, 1)] });
      return;
    }
    const fid = String(Date.now());
    set({
      ...s,
      ap: s.ap - uDef.apCost,
      deployedUnits: [...s.deployedUnits, { uid: `u${s.uidSeed}`, typeId: selectedUnit, tileIndex: tileIdx, cooldown: 0, castFlash: 0, level: 1, mergeFlash: 0 }],
      uidSeed: s.uidSeed + 1,
      feedbacks: [{ id: fid, text: `${uDef.name} deployed — ${uDef.flavor}`, color: uDef.color, quality: "bonus" as any, ticks: 5 }, ...s.feedbacks.slice(0, 1)],
    });
  }

  /* ── Care Synthesis — merge two same-type same-level units → Lv+1 ── */
  function handleSynthesize() {
    const s = gsRef.current;
    const pair = findMergePair(s.deployedUnits);
    if (!pair) return;
    const [a, b] = pair;
    const newLevel = a.level + 1;
    const uName = UNIT_DATA[a.typeId].name;
    const fid = String(Date.now());
    set({
      ...s,
      deployedUnits: [
        ...s.deployedUnits.filter(u => u.uid !== a.uid && u.uid !== b.uid),
        { uid: `u${s.uidSeed}`, typeId: a.typeId, tileIndex: a.tileIndex,
          cooldown: 0, castFlash: 2, level: newLevel, mergeFlash: 5 },
      ],
      uidSeed: s.uidSeed + 1,
      feedbacks: [{
        id: fid,
        text: `✦ Care Synthesis — ${uName} reached Merge Rank ${mergeRankName(newLevel)}!`,
        color: "#FFD700", quality: "bonus" as any, ticks: 8,
      }, ...s.feedbacks.slice(0, 1)],
    });
  }

  /* ── Use a global ability ── */
  function useAbility(abilityId: string) {
    const s = gsRef.current;
    if (s.phase !== "playing") return;
    const ab = ABILITY_DATA[abilityId];
    if (s.ap < ab.apCost) return;
    if ((s.abilityCooldowns[abilityId] ?? 0) > 0) return; /* on cooldown — no free spam-safety */

    let newEnemies = s.enemies;
    let newStability = s.stability;
    let newCorruption = s.corruption;
    let newReassessUses = s.reassessUses;
    let newShieldTicks = s.shieldTicks;
    let newStabilizeUses = s.stabilizeUsesThisWave;
    let newCueBonusReady = s.cueBonusReady;
    let newTreatmentFieldTicks = s.treatmentFieldTicks;
    let feedbackText = "", feedbackColor = ab.color;

    switch (abilityId) {
      case "broncho_burst": {
        const dmgd = newEnemies.map(e => ({ ...e, hp: e.hp - 30, hitFlash: 3 }));
        const killed = dmgd.filter(e => e.hp <= 0).length;
        newEnemies = dmgd.filter(e => e.hp > 0);
        const cleanse = 3 + killed * 4;
        newCorruption = cl(s.corruption - cleanse, 0, MAX_CORRUPTION);
        /* Treatment Field — Broncho Burst leaves a lingering bronchodilator
           mist over the whole lane, ticking extra damage for a few beats. */
        newTreatmentFieldTicks = TREATMENT_FIELD_TICKS;
        feedbackText = killed > 0
          ? `💨 Broncho Burst — ${killed} spirit${killed !== 1 ? "s" : ""} defeated! Treatment Field laid · Corruption Cleansed -${cleanse}`
          : `💨 Broncho Burst — 30 dmg to all · Treatment Field laid · Corruption Cleansed -${cleanse}`;
        break;
      }
      case "emergency_o2": {
        const restore = Math.max(4, Math.round(15 * Math.pow(STABILIZE_DIMINISH, newStabilizeUses)));
        newStability = Math.min(MAX_STABILITY, s.stability + restore);
        newStabilizeUses = s.stabilizeUsesThisWave + 1;
        feedbackText = newStabilizeUses > 1
          ? `🆘 Stabilized +${restore} — diminishing returns this wave`
          : `🆘 Stabilized +${restore} Stability`;
        feedbackColor = COLORS.success;
        break;
      }
      case "positioning_order":
        newEnemies = s.enemies.map(e => ({ ...e, slowTicks: 6 }));
        newShieldTicks = PROTECT_SHIELD_TICKS;
        feedbackText = "🛡 Shielded — enemies slowed, Stability loss halved";
        feedbackColor = "#A78BFA";
        break;
      case "reassess_protocol": {
        newReassessUses = s.reassessUses + 1;
        const hasCorrect = s.enemies.some(e =>
          s.deployedUnits.some(u => UNIT_DATA[u.typeId].strong.includes(e.typeId))
        );
        if (hasCorrect && s.lastKillQuality === "strong") {
          /* Response Confirmed — Reassess Sage's signature payoff: the prior
             intervention is validated, restoring Stability, cleansing Corruption,
             and priming the next strong hit like a correct Clinical Cue answer. */
          newStability = Math.min(MAX_STABILITY, s.stability + 5);
          newCorruption = cl(s.corruption - 3, 0, MAX_CORRUPTION);
          newCueBonusReady = true;
          feedbackText = "✅ Response Confirmed — sequencing validated! +5 Stability, next strong hit empowered";
          feedbackColor = COLORS.success;
        } else if (hasCorrect) {
          feedbackText = "🔄 Reassess — correct units on field, keep going";
          feedbackColor = COLORS.warning;
        } else {
          feedbackText = "🔄 Reassess — check enemy cues, adjust unit types";
          feedbackColor = COLORS.onSurfaceTertiary;
        }
        break;
      }
    }

    const fid = String(Date.now());
    set({ ...s, ap: s.ap - ab.apCost, enemies: newEnemies, stability: newStability,
      corruption: newCorruption, reassessUses: newReassessUses, shieldTicks: newShieldTicks,
      stabilizeUsesThisWave: newStabilizeUses, cueBonusReady: newCueBonusReady,
      treatmentFieldTicks: newTreatmentFieldTicks,
      abilityCooldowns: { ...s.abilityCooldowns, [abilityId]: ABILITY_COOLDOWN_TICKS[abilityId] ?? 0 },
      feedbacks: [{ id: fid, text: feedbackText, color: feedbackColor, quality: "bonus" as any, ticks: 7 }, ...s.feedbacks.slice(0, 1)] });
  }

  /* ── Lobby ── */
  if (gs.phase === "lobby") {
    return (
      <LobbyScreen
        onStart={startGame}
        onBack={() => router.back()}
        inventory={player?.inventory || {}}
        pendingBoosts={pendingBoosts}
        onToggleBoost={(id) =>
          setPendingBoosts((prev) =>
            prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
          )
        }
        ownedUnits={player?.owned_units || {}}
        loadout={player?.ward_loadout || []}
        onToggleUnit={(id) => {
          const cur = player?.ward_loadout || [];
          if (cur.includes(id)) {
            setWardLoadout(cur.filter((x) => x !== id));
          } else if (cur.length < LOADOUT_SIZE) {
            setWardLoadout([...cur, id]);
          }
        }}
      />
    );
  }

  /* ── Result ── */
  if (gs.phase === "won" || gs.phase === "lost") {
    const rewards = calcRewards(gs.phase === "won", gs.stability);
    const ls: LearningStats = {
      priorityActions: gs.priorityActions, strongMatches: gs.strongMatches,
      partialMatches: gs.partialMatches, weakMatches: gs.weakMatches,
      peakCareChain: gs.peakCareChain, reassessUses: gs.reassessUses,
      learnedConcepts: gs.learnedConcepts, enemyMastery: gs.enemyMastery,
    };
    return (
      <ResultScreen won={gs.phase === "won"} wave={gs.wave} stability={gs.stability}
        score={gs.score} rewards={rewards} learningStats={ls}
        onReplay={startGame} onBack={() => router.back()} />
    );
  }

  /* ── Active game ── */
  const stabilityColor = gs.stability > 60 ? COLORS.success : gs.stability > 30 ? COLORS.warning : COLORS.error;
  const corruptionColor = gs.corruption >= CORRUPTION_DRAIN_START ? "#F87171" : gs.corruption >= 30 ? "#C084FC" : "#7C3AED";
  const waveDef = WAVES[gs.wave] ?? WAVES[WAVES.length - 1];

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>

      {/* ── HUD bar ── */}
      <LinearGradient
        colors={["#060e1aff", "#040c14f0"]}
        style={s.hud}
      >
        {/* Back button */}
        <Pressable style={s.hudBack} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={15} color={COLORS.onSurface} />
        </Pressable>

        {/* Ward title + wave */}
        <View style={s.hudWave}>
          <Text style={s.hudTitle}>Lotus Healing Ward</Text>
          {gs.phase === "wave_pause" ? (
            <Text style={s.hudWaveTxt}>⚕ Answer to earn AP</Text>
          ) : waveDef.isBoss ? (
            <Text style={[s.hudWaveTxt, { color: COLORS.error }]}>⚠ Boss Wave {gs.wave + 1}/{WAVES.length}</Text>
          ) : (
            <Text style={s.hudWaveTxt}>Wave {gs.wave + 1}/{WAVES.length} 💀</Text>
          )}
        </View>

        {/* Stability + Corruption meters */}
        <View style={s.hudStability}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 }}>
            <Text style={s.hudBarLabel}>Stability</Text>
            <Text style={{ fontSize: 9 }}>❤️</Text>
            <Text style={[s.hudBarVal, { color: stabilityColor, marginLeft: "auto" as any }]}>{Math.round(gs.stability)}%</Text>
          </View>
          <View style={[s.hudStabilityBg, gs.stabilityPulse > 0 && {
            borderWidth: 1, borderColor: "#F97316", shadowColor: "#F97316",
            shadowOpacity: 0.9, shadowRadius: 4, elevation: 4,
          }]}>
            <LinearGradient
              colors={[stabilityColor + "cc", stabilityColor]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[s.hudStabilityFill, { width: `${cl(gs.stability, 0, 100)}%` as any }]}
            />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, marginBottom: 2 }}>
            <Text style={s.hudBarLabel}>Corruption</Text>
            <Text style={{ fontSize: 9 }}>🐲</Text>
            <Text style={[s.hudBarVal, { color: corruptionColor, marginLeft: "auto" as any }]}>{Math.round(gs.corruption)}%</Text>
          </View>
          <View style={[s.hudStabilityBg, gs.corruptionPulse > 0 && {
            borderWidth: 1, borderColor: "#C084FC", shadowColor: "#C084FC",
            shadowOpacity: 0.9, shadowRadius: 4, elevation: 4,
          }]}>
            <LinearGradient
              colors={[corruptionColor + "cc", corruptionColor]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[s.hudStabilityFill, { width: `${cl(gs.corruption, 0, 100)}%` as any }]}
            />
          </View>
          {gs.treatmentFieldTicks > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 }}>
              <Text style={{ fontSize: 8 }}>🌫️</Text>
              <Text style={{ color: "#67e8f9", fontSize: 7.5, fontWeight: "700" }}>
                Treatment Field active ({gs.treatmentFieldTicks})
              </Text>
            </View>
          )}
        </View>

        {/* AP display */}
        <View style={s.hudAp}>
          <Text style={s.hudBarLabel}>AP</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2, marginTop: 1 }}>
            <Text style={{ color: "#60A5FA", fontSize: 18, fontWeight: "800", lineHeight: 20 }}>
              {gs.ap}
            </Text>
            <Text style={{ color: "#60A5FA60", fontSize: 9, fontWeight: "700" }}>
              /{MAX_AP}
            </Text>
          </View>
        </View>

        {/* Game-speed toggle */}
        <Pressable
          style={[s.hudSpeed, speedMul === 2 && s.hudSpeedActive]}
          hitSlop={10}
          onPress={() => setSpeedMul(m => (m === 1 ? 2 : 1))}
        >
          <Ionicons
            name={speedMul === 2 ? "play-forward" : "play"}
            size={11}
            color={speedMul === 2 ? "#0a0e14" : COLORS.onSurface}
          />
          <Text style={[s.hudSpeedTxt, speedMul === 2 && { color: "#0a0e14" }]}>{speedMul}×</Text>
        </Pressable>
      </LinearGradient>

      {/* ── Ward Defense V2 Board — Lotus Healing Sanctum ── */}
      <View style={s.ward}>
        {(() => {
          const mergePair = findMergePair(gs.deployedUnits);
          const mergeTileSet = mergePair
            ? new Set([mergePair[0].tileIndex, mergePair[1].tileIndex])
            : new Set<number>();
          const unitColors = Object.fromEntries(
            Object.entries(UNIT_DATA).map(([k, v]) => [k, v.color])
          );
          return (
            <WardBoardV2
              aw={arena.w} ah={arena.h}
              onLayout={e => {
                const { width, height } = e.nativeEvent.layout;
                setArena({ w: width, h: height });
              }}
              enemies={gs.enemies}
              deployedUnits={gs.deployedUnits}
              projectiles={gs.projectiles}
              stability={gs.stability}
              phase={gs.phase}
              wave={gs.wave}
              bobY={bobY}
              spawnQueueLen={gs.spawnQueue.length}
              mergeTileSet={mergeTileSet}
              onTilePress={deployUnit}
              unitColors={unitColors}
            />
          );
        })()}
      </View>

      {/* Feedback strip — stays in flow so the board layout doesn't jump during the wave pause */}
      <View style={s.feedbackPanel}>
        {gs.feedbacks.slice(0, 2).map((f, idx) => (
          <View key={f.id} style={[s.feedbackRow, { borderLeftColor: f.color, marginTop: idx > 0 ? 2 : 0 }]}>
            <Text style={[s.feedbackTxt, { color: f.color }]} numberOfLines={1}>{f.text}</Text>
          </View>
        ))}
        {gs.feedbacks.length === 0 && (
          <Text style={s.feedbackHint}>Select a unit → tap a tile to deploy.</Text>
        )}
      </View>

      {/* Clinical Cue Check — floats OVER everything during the wave pause */}
      {gs.phase === "wave_pause" && cqDismissedWave !== gs.wave && (
        <View style={s.clinicalOverlay}>
          <View style={s.clinicalOverlayCard}>
            <ClinicalQuestionPanel
              question={CLINICAL_QUESTIONS[gs.wave % CLINICAL_QUESTIONS.length]}
              onAnswer={answerClinQ}
              answered={cqAnswered?.wave === gs.wave}
              answeredCorrect={cqAnswered?.wave === gs.wave ? cqAnswered!.correct : null}
              wave={gs.wave}
              cueChoice={cqCueChoice?.wave === gs.wave ? cqCueChoice!.choice : null}
              onChooseCue={chooseCueTactic}
              onClose={() => setCqDismissedWave(gs.wave)}
            />
          </View>
        </View>
      )}

      {/* Hand */}
      <HandPanel
        mode={handMode} setMode={setHandMode}
        selectedUnit={selectedUnit} onSelectUnit={setSelectedUnit}
        onUseAbility={useAbility}
        ap={gs.ap} isPlaying={gs.phase === "playing"}
        hasMerge={findMergePair(gs.deployedUnits) !== null}
        onSynthesize={handleSynthesize}
        abilityCooldowns={gs.abilityCooldowns}
        loadout={gs.loadout}
      />

    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CLINICAL QUESTION PANEL — mid-battle NCLEX cues with AP reward
   ═══════════════════════════════════════════════════════════════════ */
const CLINICAL_QUESTIONS = [
  {
    q: "A patient has wheezing, tachypnea, and SpO₂ 88%. Which action is priority?",
    opts: ["Increase IV fluids", "Administer oxygen", "Encourage ambulation", "Give antipyretic"],
    correct: 1,
    rationale: "SpO₂ 88% = hypoxemia. Administer supplemental oxygen immediately to correct life-threatening desaturation.",
  },
  {
    q: "BEST sign of improving oxygenation after bronchodilator therapy?",
    opts: ["Decreased work of breathing", "Increased heart rate", "Louder wheeze", "Higher temperature"],
    correct: 0,
    rationale: "Reduced WOB = decreased airway resistance = effective treatment.",
  },
  {
    q: "COPD patient, 2L O₂/NC: RR 28, SpO₂ 89%. FIRST nursing action?",
    opts: ["Reposition upright (HOB↑)", "Notify provider", "Increase O₂ flow", "Document and monitor"],
    correct: 0,
    rationale: "Upright positioning optimizes lung expansion — quick, safe, first action.",
  },
  {
    q: "Bronchospasm is BEST characterized by:",
    opts: ["Expiratory wheeze + air trapping", "Inspiratory stridor only", "Productive cough + fever", "Low RR + deep breaths"],
    correct: 0,
    rationale: "Narrowed lower airways = expiratory wheeze + air trapping.",
  },
  {
    q: "Albuterol 2.5 mg nebulized PRN wheeze. When do you administer?",
    opts: ["Patient reports chest tightness + wheeze", "SpO₂ 96%, resting comfortably", "Every 4h on schedule", "Fever > 38°C is present"],
    correct: 0,
    rationale: "PRN = give for symptoms (wheeze/chest tightness), not on a fixed schedule.",
  },
  {
    q: "Which finding is MOST consistent with respiratory distress requiring immediate action?",
    opts: ["Nasal flaring + tripod positioning", "SpO₂ 97% on room air", "RR 16 with clear breath sounds", "Mild cough, afebrile"],
    correct: 0,
    rationale: "Nasal flaring + tripod position = significant accessory muscle use = respiratory distress.",
  },
];

function ClinicalQuestionPanel({
  question, onAnswer, answered, answeredCorrect, wave, cueChoice, onChooseCue, onClose,
}: {
  question: typeof CLINICAL_QUESTIONS[0];
  onAnswer: (idx: number) => void;
  answered: boolean;
  answeredCorrect: boolean | null;
  wave: number;
  cueChoice: "empower" | "stabilize" | null;
  onChooseCue: (choice: "empower" | "stabilize") => void;
  onClose: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [chosen, setChosen] = useState<number | null>(null);

  useEffect(() => { setTimeLeft(30); setChosen(null); }, [wave]);

  useEffect(() => {
    if (answered || timeLeft <= 0) return;
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [answered, timeLeft]);

  function handleAnswer(i: number) {
    if (answered) return;
    setChosen(i);
    onAnswer(i);
  }

  return (
    <LinearGradient colors={["#e8d5a8", "#d4b870"]} style={s.clinicalPanel}>
      {/* Header row */}
      <View style={s.clinicalHeaderRow}>
        <View style={s.clinicalBadge}>
          <Text style={s.clinicalBadgeTxt}>🩺  CLINICAL CUE CHECK</Text>
        </View>
        <View style={{ flex: 1 }} />
        {!answered && (
          <View style={s.clinicalTimerBadge}>
            <Text style={s.clinicalTimerTxt}>🕐 {timeLeft}s</Text>
          </View>
        )}
        {answered && answeredCorrect && (
          <Text style={{ color: "#155a38", fontSize: 9, fontWeight: "800" }}>✓ +{PREWAVE_AP_BONUS} AP earned</Text>
        )}
        <Pressable onPress={onClose} hitSlop={10} style={s.clinicalClose}>
          <Ionicons name="close" size={14} color="#4a2e00" />
        </Pressable>
      </View>

      {/* Main row: question+answers | lotus sidebar */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "stretch" }}>
        <View style={{ flex: 1 }}>
          <Text style={s.clinicalQ} numberOfLines={2}>{question.q}</Text>
          {answered ? (
            <View style={[s.clinicalResult, {
              borderColor: answeredCorrect ? "#22d3ee88" : "#ef444488",
              backgroundColor: answeredCorrect ? "#0a3020e0" : "#3a0a0ae0",
            }]}>
              <Text style={{ color: answeredCorrect ? "#34d399" : "#f87171",
                fontSize: 9, fontWeight: "800", marginBottom: 2 }}>
                {answeredCorrect
                  ? "✓ Correct! Great clinical judgment."
                  : `✗ Correct answer: ${question.opts[question.correct]}`}
              </Text>
              <Text style={{ color: answeredCorrect ? "#a7f3d0" : "#fca5a5", fontSize: 8, lineHeight: 11.5 }}>
                {question.rationale}
              </Text>
              {answeredCorrect && (
                <View style={{ marginTop: 6 }}>
                  <Text style={{ color: "#a7f3d0", fontSize: 8, fontWeight: "800", marginBottom: 3 }}>
                    CHOOSE YOUR TACTICAL EDGE:
                  </Text>
                  <View style={{ flexDirection: "row", gap: 5 }}>
                    <Pressable
                      onPress={() => onChooseCue("empower")}
                      disabled={!!cueChoice}
                      style={{
                        flex: 1, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 6,
                        borderWidth: 1.5,
                        borderColor: cueChoice === "empower" ? "#22d3ee" : "#22d3ee55",
                        backgroundColor: cueChoice === "empower" ? "#0a3020" : "#0a302066",
                        opacity: cueChoice && cueChoice !== "empower" ? 0.4 : 1,
                      }}
                    >
                      <Text style={{ color: "#67e8f9", fontSize: 8, fontWeight: "800" }}>⚔ Empower Next Strong Hit</Text>
                      <Text style={{ color: "#a7f3d0", fontSize: 7 }}>+20% dmg on next strong-match hit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onChooseCue("stabilize")}
                      disabled={!!cueChoice}
                      style={{
                        flex: 1, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 6,
                        borderWidth: 1.5,
                        borderColor: cueChoice === "stabilize" ? "#06B6D4" : "#06B6D455",
                        backgroundColor: cueChoice === "stabilize" ? "#062a33" : "#062a3366",
                        opacity: cueChoice && cueChoice !== "stabilize" ? 0.4 : 1,
                      }}
                    >
                      <Text style={{ color: "#67e8f9", fontSize: 8, fontWeight: "800" }}>🌊 Stability Surge</Text>
                      <Text style={{ color: "#a7f3d0", fontSize: 7 }}>+{CUE_STABILIZE_BONUS} Stability now</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={s.clinicalGrid}>
              {question.opts.map((opt, i) => (
                <Pressable key={i} onPress={() => handleAnswer(i)}
                  style={[s.clinicalBtn,
                    answered && i === question.correct ? { borderColor: "#22d3ee", backgroundColor: "#0a3020" } :
                    answered && i === chosen ? { borderColor: "#ef4444", backgroundColor: "#3a0a0a" } : {}
                  ]}>
                  <View style={s.clinicalLetter}>
                    <Text style={s.clinicalLetterTxt}>{["A","B","C","D"][i]}</Text>
                  </View>
                  <Text style={s.clinicalOptTxt} numberOfLines={2}>{opt}</Text>
                  {answered && i === question.correct && (
                    <Text style={{ color: "#22d3ee", fontSize: 11, marginLeft: 2 }}>✓</Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Right lotus badge */}
        <View style={s.clinicalLotus}>
          <LinearGradient
            colors={["#2d1500", "#6b3800", "#c8700040"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.clinicalLotusBg}
          >
            <Text style={{ fontSize: 18, textAlign: "center" }}>✿</Text>
            <Text style={s.clinicalLotusLabel}>+{PREWAVE_AP_BONUS}{"\n"}AP</Text>
          </LinearGradient>
        </View>
      </View>
    </LinearGradient>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LOBBY SCREEN
   ═══════════════════════════════════════════════════════════════════ */
/* ── Translation Codex data ────────────────────────────────────────────────── */
const TRANSLATION_CODEX = [
  {
    fantasyName: "Windway Curse",
    icon: "🌀",
    accentColor: "#6ee7b7",
    medicalMeaning: "Narrowed airway / bronchospasm pattern",
    cues: ["Wheezing", "Fast breathing", "Anxious posture", "Dim oxygen glow"],
    battleMeaning: "Wheeze Sprite and Bronchospasm Drake represent airway narrowing",
    bestMatches: [
      "Bronchodilator Mist (Mist Caster) — targets narrowed airway spirits directly",
      "Oxygen Ward (O₂ Healer) — supports oxygenation, stabilises the Vital Lantern",
    ],
    reassessCue: "Breathing effort · audible wheeze · oxygen glow brightness",
    commonTrap: "Oxygen supports stability, but may not resolve airway narrowing alone — pair it with bronchodilator.",
  },
] as const;

/* ── Case intro data ───────────────────────────────────────────────────────── */
const WINDWAY_CASE = {
  title: "The Windway Curse",
  kicker: "AIRWAY CODE RUSH · CASE BRIEFING",
  story:
    "A courier collapses at the clinic gate. The local healer says wind spirits have knotted his breath-channels.",
  findings: ["Fast, laboured breathing", "Audible wheeze on approach", "Anxious posture, gripping the gate", "Vital Lantern flickering dim"],
  sections: [
    {
      label: "FANTASY BELIEF",
      color: "#a78bfa",
      body: "Wind spirits tied invisible knots through the courier's breath channels, strangling the sacred airflow.",
    },
    {
      label: "CLINICAL CUES",
      color: "#6ee7b7",
      body: "↑ RR · audible wheeze · accessory muscle use · SpO₂ trending down · anxious affect",
    },
    {
      label: "OBJECTIVE",
      color: "#60a5fa",
      body: "Defend the Vital Lantern. Match care cards to the right disease spirits. Reassess breathing effort and wheeze after each intervention.",
    },
  ],
} as const;

/* ── Roadmap data ──────────────────────────────────────────────────────────── */
const ROADMAP_ITEMS = [
  { status: "done",   icon: "📜", label: "Post-battle Clinical Translation Summary",  desc: "Connects the fantasy battle back to medical learning — cues, priority threat, correct matches, reassessment, common trap, codex progress." },
  { status: "done",   icon: "🌀", label: "Translation Codex + Case Intro (Step 1)",  desc: "Windway Curse codex entry and 'The Windway Curse' case briefing before battle." },
  { status: "next",   icon: "🏰", label: "Ward Realm Framing",                       desc: "Each ward becomes a fantasy realm — Airway Ward, Cardiac Citadel, Neuro Spire." },
  { status: "coming", icon: "🦸", label: "Hero Learning Roles",                       desc: "Unlock specialisations: Airway Sentinel, Medication Alchemist, Neuro Scout." },
  { status: "coming", icon: "⚗️",  label: "Apothecary Lab Preview",                  desc: "Craft care items from battle drops. Combine materials into ability upgrades." },
  { status: "locked", icon: "⚔️",  label: "Arena (Locked Preview)",                  desc: "Challenge curated ward setups from Clinica scholars. Coming after Ward Realm." },
  { status: "locked", icon: "🎓", label: "Scholarly Arena Duel Prototype",           desc: "Turn-based PvE duel using clinical reasoning vs opponent ward builds." },
] as const;

function LobbyScreen({
  onStart,
  onBack,
  inventory,
  pendingBoosts,
  onToggleBoost,
  ownedUnits,
  loadout,
  onToggleUnit,
}: {
  onStart: () => void;
  onBack: () => void;
  inventory: Record<string, number>;
  pendingBoosts: string[];
  onToggleBoost: (id: string) => void;
  ownedUnits: Record<string, number>;
  loadout: string[];
  onToggleUnit: (id: string) => void;
}) {
  const { player } = usePlayer();
  const [caseVisible,   setCaseVisible]   = useState(false);
  const [codexExpanded, setCodexExpanded] = useState(false);
  const [mapExpanded,   setMapExpanded]   = useState(false);

  const ownedBoosts = WARD_BOOSTS.filter((b) => (inventory[b.name] || 0) > 0);
  const ownedUnitIds = WARD_UNIT_IDS.filter((id) => (ownedUnits[id] || 0) > 0);

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>
      <Image source={require("../assets/images/ward_lobby_bg.png")}
        style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient colors={["#00000000", "#00000000", "#010610cc", "#010610f0"]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFillObject} />
      {player && <PlayerHeader player={player} compact />}

      {/* ── CASE INTRO MODAL ─────────────────────────────────────────── */}
      {caseVisible && (
        <View style={{ position:"absolute", inset:0, zIndex:99, backgroundColor:"#00000090",
          justifyContent:"center", alignItems:"center", padding:16 }}>
          <View style={{ backgroundColor:"#0a1628", borderRadius:16, borderWidth:1.5,
            borderColor:"#1e3a5f", maxWidth:480, width:"100%", overflow:"hidden" }}>
            {/* Header */}
            <LinearGradient colors={["#0e2a4a","#081828"]}
              style={{ padding:18, paddingBottom:14 }}>
              <Text style={{ color:"#60a5fa", fontSize:9, fontWeight:"700",
                letterSpacing:1.4, marginBottom:4 }}>{WINDWAY_CASE.kicker}</Text>
              <Text style={{ color:"#f0f9ff", fontSize:20, fontWeight:"800",
                letterSpacing:0.3 }}>{WINDWAY_CASE.title}</Text>
            </LinearGradient>
            <ScrollView style={{ maxHeight:480 }} contentContainerStyle={{ padding:16, gap:12 }}
              showsVerticalScrollIndicator={false}>
              {/* Story + findings */}
              <Text style={{ color:"#94a3b8", fontSize:12.5, lineHeight:19 }}>
                {WINDWAY_CASE.story}
              </Text>
              <View style={{ backgroundColor:"#0f1f38", borderRadius:10, padding:12,
                borderLeftWidth:3, borderColor:"#60a5fa" }}>
                <Text style={{ color:"#60a5fa", fontSize:9, fontWeight:"700",
                  letterSpacing:1, marginBottom:6 }}>YOU NOTICE</Text>
                {WINDWAY_CASE.findings.map((f,i) => (
                  <View key={i} style={{ flexDirection:"row", gap:8, marginBottom:4 }}>
                    <Text style={{ color:"#60a5fa", fontSize:12 }}>·</Text>
                    <Text style={{ color:"#cbd5e1", fontSize:12, lineHeight:18 }}>{f}</Text>
                  </View>
                ))}
              </View>
              {/* Three sections */}
              {WINDWAY_CASE.sections.map(sec => (
                <View key={sec.label} style={{ backgroundColor:"#0d1b30", borderRadius:10,
                  padding:12, borderLeftWidth:3, borderColor:sec.color }}>
                  <Text style={{ color:sec.color, fontSize:9, fontWeight:"700",
                    letterSpacing:1, marginBottom:5 }}>{sec.label}</Text>
                  <Text style={{ color:"#94a3b8", fontSize:12, lineHeight:18 }}>{sec.body}</Text>
                </View>
              ))}
              {/* Begin button */}
              <Pressable onPress={() => { setCaseVisible(false); onStart(); }}
                style={{ backgroundColor:"#1d4ed8", borderRadius:12, padding:14,
                  alignItems:"center", flexDirection:"row", justifyContent:"center", gap:8,
                  marginTop:4 }}>
                <Ionicons name="shield-checkmark" size={18} color="#fff" />
                <Text style={{ color:"#fff", fontSize:14, fontWeight:"800",
                  letterSpacing:0.5 }}>BEGIN DEFENSE</Text>
              </Pressable>
              <Pressable onPress={() => setCaseVisible(false)}
                style={{ alignItems:"center", paddingVertical:8 }}>
                <Text style={{ color:"#475569", fontSize:11 }}>← Back to Briefing</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={s.lobbyContent} showsVerticalScrollIndicator={false}>
        <Pressable style={s.hudBack} onPress={onBack} hitSlop={10}>
          <Ionicons name="arrow-back" size={16} color={COLORS.onSurface} />
        </Pressable>

        <View style={s.lobbyHeroArea}>
          <View style={s.lobbyEmblem}>
            <LinearGradient colors={["#0e2040", "#081828"]} style={StyleSheet.absoluteFillObject} />
            <View style={{ width: 48, height: 14, borderRadius: 2, backgroundColor: "#60A5FA" }} />
            <View style={{ position: "absolute", width: 14, height: 48, borderRadius: 2, backgroundColor: "#60A5FA" }} />
          </View>
          <Text style={s.lobbyKicker}>WARD DEFENSE · AIRWAY CODE RUSH</Text>
          <Text style={s.lobbyTitle}>Bronchospasm Siege</Text>
          <Text style={s.lobbySubtitle}>6 Waves · Deploy Healers · Defend the Lantern</Text>
        </View>

        <RewardPreview mode="Ward Defense" />

        {/* Mission */}
        <View style={s.lobbyCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.air }} />
            <Text style={s.lobbySectionTitle}>MISSION</Text>
          </View>
          <Text style={s.lobbyBodyTxt}>
            Disease spirits march through the Airway Ward toward the{" "}
            <Text style={{ color: COLORS.air }}>Vital Lantern</Text>. Deploy healer units on board tiles to auto-attack and neutralize each threat. Use clinical abilities to boost your defense.
          </Text>
          <Text style={[s.lobbyBodyTxt, { marginTop: 8 }]}>
            <Text style={{ color: COLORS.air }}>NCLEX Clinical Judgment:</Text> Recognize cues on each enemy · Prioritize threats · Deploy the right unit · Evaluate with Reassess.
          </Text>
          <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: "#ffffff14", paddingTop: 8 }}>
            <Text style={[s.lobbyBodyTxt, { fontSize: 10.5 }]}>
              <Text style={{ color: "#FBBF24", fontWeight: "800" }}>Mastery</Text> (Lv 1–15) is permanent —
              earned with shards from duplicate pulls + Ward Coins, upgraded anytime in the Apothecary.{" "}
              <Text style={{ color: "#67e8f9", fontWeight: "800" }}>Merge Rank</Text> (Novice→Ascended) is
              temporary — only for this run, reset when you leave. Both stack: Mastery raises your floor,
              Merge Rank is what you build mid-battle.
            </Text>
          </View>
        </View>

        {/* ── LOADOUT (choose deployable units from your collection) ────── */}
        <View style={s.lobbyCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.air }} />
            <Text style={s.lobbySectionTitle}>LOADOUT</Text>
            <Text style={{ color: "#64748b", fontSize: 11, fontWeight: "600", marginLeft: "auto" }}>
              {loadout.length}/{LOADOUT_SIZE}
            </Text>
          </View>
          <Text style={[s.lobbyBodyTxt, { marginBottom: 10 }]}>
            Pick up to {LOADOUT_SIZE} units from your collection. Only these can be deployed this run. Recruit more in the Apothecary.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {ownedUnitIds.map((id) => {
              const m = WARD_UNIT_META[id];
              const active = loadout.includes(id);
              const lvl = ownedUnits[id] || 1;
              const full = !active && loadout.length >= LOADOUT_SIZE;
              return (
                <Pressable
                  key={id}
                  onPress={() => onToggleUnit(id)}
                  disabled={full}
                  testID={`ward-loadout-${id}`}
                  style={{
                    width: "48%",
                    flexDirection: "row", alignItems: "center", gap: 8,
                    backgroundColor: active ? m.color + "22" : "#0d1b30",
                    borderRadius: 10, padding: 10,
                    borderWidth: 1, borderColor: active ? m.color : "#1e3a5f",
                    opacity: full ? 0.4 : 1,
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#f0f9ff", fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text style={{ color: "#94a3b8", fontSize: 10, marginTop: 1 }}>
                      {m.category} · Lv{lvl} · {m.apCost} AP
                    </Text>
                  </View>
                  <Ionicons
                    name={active ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={active ? m.color : "#475569"}
                  />
                </Pressable>
              );
            })}
          </View>
          {loadout.length === 0 && (
            <Text style={{ color: COLORS.warning, fontSize: 11, marginTop: 8 }}>
              No units selected — your 3 starter units will be used by default.
            </Text>
          )}
        </View>

        {/* ── WARD BOOSTS (from the Apothecary Market) ─────────────────── */}
        {ownedBoosts.length > 0 && (
          <View style={s.lobbyCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.energy }} />
              <Text style={s.lobbySectionTitle}>WARD BOOSTS</Text>
            </View>
            <Text style={[s.lobbyBodyTxt, { marginBottom: 10 }]}>
              Activate boosts from your Apothecary supplies. Selected boosts are consumed when this run begins.
            </Text>
            {ownedBoosts.map((b) => {
              const active = pendingBoosts.includes(b.id);
              const qty = inventory[b.name] || 0;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => onToggleBoost(b.id)}
                  testID={`ward-boost-${b.id}`}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 10,
                    backgroundColor: active ? COLORS.energy + "22" : "#0d1b30",
                    borderRadius: 10, padding: 10, marginBottom: 8,
                    borderWidth: 1, borderColor: active ? COLORS.energy : "#1e3a5f",
                  }}
                >
                  <Ionicons name={b.icon as any} size={20} color={active ? COLORS.energy : "#94a3b8"} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#f0f9ff", fontSize: 13, fontWeight: "700" }}>
                      {b.name} <Text style={{ color: "#64748b", fontWeight: "500" }}>×{qty}</Text>
                    </Text>
                    <Text style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{b.subtitle}</Text>
                  </View>
                  <Ionicons
                    name={active ? "checkmark-circle" : "ellipse-outline"}
                    size={20}
                    color={active ? COLORS.energy : "#475569"}
                  />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── TRANSLATION CODEX ──────────────────────────────────────── */}
        <Pressable style={[s.lobbyCard, { gap:0 }]} onPress={() => setCodexExpanded(v => !v)}>
          <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
            <View style={{ width:3, height:14, borderRadius:2, backgroundColor:"#a78bfa" }}/>
            <Text style={s.lobbySectionTitle}>TRANSLATION CODEX</Text>
            <View style={{ flex:1 }}/>
            <View style={{ backgroundColor:"#a78bfa22", borderRadius:6,
              paddingHorizontal:7, paddingVertical:2 }}>
              <Text style={{ color:"#a78bfa", fontSize:8, fontWeight:"700" }}>
                {TRANSLATION_CODEX.length} ENTRY{TRANSLATION_CODEX.length !== 1 ? "S" : ""}
              </Text>
            </View>
            <Ionicons name={codexExpanded ? "chevron-up" : "chevron-down"}
              size={14} color="#64748b" />
          </View>
          {!codexExpanded && (
            <Text style={{ color:"#475569", fontSize:11, marginTop:6 }}>
              Translate fantasy illnesses into plain medical concepts.
            </Text>
          )}
          {codexExpanded && TRANSLATION_CODEX.map((entry, i) => (
            <View key={i} style={{ marginTop:14, gap:10 }}>
              {/* Entry header */}
              <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
                <Text style={{ fontSize:18 }}>{entry.icon}</Text>
                <View>
                  <Text style={{ color:"#a78bfa", fontSize:13, fontWeight:"800" }}>
                    {entry.fantasyName}
                  </Text>
                  <Text style={{ color:"#94a3b8", fontSize:11, marginTop:1 }}>
                    {entry.medicalMeaning}
                  </Text>
                </View>
              </View>
              {/* Recognize cues */}
              <View style={{ backgroundColor:"#0d1b30", borderRadius:8, padding:10,
                borderLeftWidth:2.5, borderColor:entry.accentColor }}>
                <Text style={{ color:entry.accentColor, fontSize:8.5, fontWeight:"700",
                  letterSpacing:0.9, marginBottom:5 }}>RECOGNIZE CUES</Text>
                <View style={{ flexDirection:"row", flexWrap:"wrap", gap:5 }}>
                  {entry.cues.map((cue,j) => (
                    <View key={j} style={{ backgroundColor:entry.accentColor+"20",
                      borderRadius:5, paddingHorizontal:7, paddingVertical:2 }}>
                      <Text style={{ color:entry.accentColor, fontSize:10, fontWeight:"600" }}>
                        {cue}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              {/* Battle meaning */}
              <View style={{ backgroundColor:"#130820", borderRadius:8, padding:10,
                borderLeftWidth:2.5, borderColor:"#7c3aed" }}>
                <Text style={{ color:"#a78bfa", fontSize:8.5, fontWeight:"700",
                  letterSpacing:0.9, marginBottom:4 }}>BATTLE MEANING</Text>
                <Text style={{ color:"#94a3b8", fontSize:11, lineHeight:17 }}>
                  {entry.battleMeaning}
                </Text>
              </View>
              {/* Best matches */}
              <View style={{ backgroundColor:"#081c14", borderRadius:8, padding:10,
                borderLeftWidth:2.5, borderColor:"#34d399" }}>
                <Text style={{ color:"#34d399", fontSize:8.5, fontWeight:"700",
                  letterSpacing:0.9, marginBottom:5 }}>BEST MATCHES</Text>
                {entry.bestMatches.map((m,j) => (
                  <View key={j} style={{ flexDirection:"row", gap:6, marginBottom:3 }}>
                    <Text style={{ color:"#34d399", fontSize:11 }}>✦</Text>
                    <Text style={{ color:"#94a3b8", fontSize:11, lineHeight:17, flex:1 }}>{m}</Text>
                  </View>
                ))}
              </View>
              {/* Reassess + trap */}
              <View style={{ flexDirection:"row", gap:8 }}>
                <View style={{ flex:1, backgroundColor:"#0e1f10", borderRadius:8, padding:9,
                  borderWidth:1, borderColor:"#166534" }}>
                  <Text style={{ color:"#6ee7b7", fontSize:8, fontWeight:"700",
                    letterSpacing:0.8, marginBottom:3 }}>REASSESS</Text>
                  <Text style={{ color:"#86efac", fontSize:10.5, lineHeight:16 }}>
                    {entry.reassessCue}
                  </Text>
                </View>
                <View style={{ flex:1, backgroundColor:"#1a0e0a", borderRadius:8, padding:9,
                  borderWidth:1, borderColor:"#7c3412" }}>
                  <Text style={{ color:"#f97316", fontSize:8, fontWeight:"700",
                    letterSpacing:0.8, marginBottom:3 }}>COMMON TRAP</Text>
                  <Text style={{ color:"#fdba74", fontSize:10.5, lineHeight:16 }}>
                    {entry.commonTrap}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </Pressable>

        {/* Healer units */}
        <View style={s.lobbyCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.brand }} />
            <Text style={s.lobbySectionTitle}>HEALER UNITS — DEPLOY ON TILES</Text>
          </View>
          {UNIT_TYPES.map(typeId => {
            const u = UNIT_DATA[typeId];
            return (
              <View key={typeId} style={s.lobbyListRow}>
                <View style={[s.lobbyEnemyChip, { borderColor: u.color + "55", backgroundColor: u.color + "18", overflow: "hidden" }]}>
                  <ExpoImage
                    source={CARD_PORTRAITS[typeId]}
                    style={{ width: "128%", height: "128%" }}
                    contentFit="contain"
                    cachePolicy="none"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[s.lobbyListName, { color: u.color }]}>{u.name}</Text>
                    <View style={{ backgroundColor: u.color + "22", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ color: u.color, fontSize: 8, fontWeight: "700" }}>{u.apCost} AP · {u.category}</Text>
                    </View>
                  </View>
                  <Text style={s.lobbyListDesc}>{u.flavor}</Text>
                  <Text style={[s.lobbyListDesc, { color: COLORS.air, marginTop: 2 }]}>{u.concept}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Disease spirits */}
        <View style={s.lobbyCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.error }} />
            <Text style={s.lobbySectionTitle}>DISEASE SPIRITS — RECOGNIZE CUES</Text>
          </View>
          {Object.entries(ENEMY_DATA).map(([eid, def]) => (
            <View key={def.name} style={s.lobbyListRow}>
              <View style={[s.lobbyEnemyChip, { borderColor: def.color + "55", backgroundColor: def.color + "12", overflow: "hidden" }]}>
                {ENEMY_PORTRAITS[eid] ? (
                  <ExpoImage
                    source={ENEMY_PORTRAITS[eid]}
                    style={{ width: "120%", height: "120%" }}
                    contentFit="contain"
                    cachePolicy="none"
                  />
                ) : (
                  <Text style={{ fontSize: 18 }}>{def.icon}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[s.lobbyListName, { color: def.color }]}>{def.name}</Text>
                  <View style={{ backgroundColor: def.color + "20", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                    <Text style={{ color: def.color, fontSize: 7, fontWeight: "700" }}>{def.clue}</Text>
                  </View>
                  {def.isBoss && (
                    <View style={{ backgroundColor: COLORS.error + "22", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ color: COLORS.error, fontSize: 8, fontWeight: "700" }}>BOSS</Text>
                    </View>
                  )}
                  {def.behavior && (
                    <View style={{ backgroundColor: "#ffffff14", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ color: COLORS.onSurfaceSecondary, fontSize: 8, fontWeight: "700" }}>
                        {BEHAVIOR_META[def.behavior].icon} {BEHAVIOR_META[def.behavior].label}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={s.lobbyListDesc}>{def.flavor}</Text>
                <View style={{
                  flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 4,
                  backgroundColor: def.color + "10", borderRadius: 6,
                  borderLeftWidth: 2, borderLeftColor: def.color + "88",
                  paddingVertical: 4, paddingHorizontal: 6,
                }}>
                  <Text style={{ color: def.color, fontSize: 8.5, fontWeight: "800", letterSpacing: 0.3 }}>
                    {def.ability.name.toUpperCase()}
                  </Text>
                  <Text style={{ color: COLORS.onSurfaceSecondary, fontSize: 9, flex: 1, lineHeight: 12 }}>
                    {def.ability.desc}
                  </Text>
                </View>
                {def.behavior && (
                  <View style={{
                    flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 3,
                    backgroundColor: "#22c55e10", borderRadius: 6,
                    borderLeftWidth: 2, borderLeftColor: "#22c55e88",
                    paddingVertical: 4, paddingHorizontal: 6,
                  }}>
                    <Text style={{ color: "#4ade80", fontSize: 8.5, fontWeight: "800", letterSpacing: 0.3 }}>
                      COUNTER
                    </Text>
                    <Text style={{ color: COLORS.onSurfaceSecondary, fontSize: 9, flex: 1, lineHeight: 12 }}>
                      {BEHAVIOR_META[def.behavior].counter}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* ── ROADMAP ────────────────────────────────────────────────── */}
        <Pressable style={[s.lobbyCard, { gap:0 }]} onPress={() => setMapExpanded(v => !v)}>
          <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
            <View style={{ width:3, height:14, borderRadius:2, backgroundColor:"#f59e0b" }}/>
            <Text style={s.lobbySectionTitle}>CLINICA ROADMAP</Text>
            <View style={{ flex:1 }}/>
            <View style={{ backgroundColor:"#f59e0b22", borderRadius:6,
              paddingHorizontal:7, paddingVertical:2 }}>
              <Text style={{ color:"#f59e0b", fontSize:8, fontWeight:"700" }}>IN DEVELOPMENT</Text>
            </View>
            <Ionicons name={mapExpanded ? "chevron-up" : "chevron-down"}
              size={14} color="#64748b" />
          </View>
          {!mapExpanded && (
            <Text style={{ color:"#475569", fontSize:11, marginTop:6 }}>
              What's coming next for Clinica.
            </Text>
          )}
          {mapExpanded && (
            <View style={{ marginTop:14, gap:8 }}>
              {ROADMAP_ITEMS.map((item, i) => {
                const statusColor =
                  item.status === "done"   ? "#60a5fa" :
                  item.status === "next"   ? "#34d399" :
                  item.status === "coming" ? "#f59e0b" : "#475569";
                const statusLabel =
                  item.status === "done"   ? "✦ SHIPPED" :
                  item.status === "next"   ? "UP NEXT"   :
                  item.status === "coming" ? "COMING SOON" : "LOCKED";
                return (
                  <View key={i} style={{ flexDirection:"row", gap:10, alignItems:"flex-start",
                    backgroundColor: item.status === "done" ? "#070f1e" : "#0a1628",
                    borderRadius:10, padding:12,
                    borderWidth:1, borderColor:statusColor+"28",
                    opacity: item.status === "locked" ? 0.6 : 1 }}>
                    <Text style={{ fontSize:18, marginTop:1 }}>{item.icon}</Text>
                    <View style={{ flex:1, gap:3 }}>
                      <View style={{ flexDirection:"row", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                        <Text style={{ color:"#e2e8f0", fontSize:12, fontWeight:"700", flex:1 }}>
                          {item.label}
                        </Text>
                        <View style={{ backgroundColor:statusColor+"20", borderRadius:4,
                          paddingHorizontal:5, paddingVertical:1 }}>
                          <Text style={{ color:statusColor, fontSize:7, fontWeight:"700" }}>
                            {statusLabel}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color:"#64748b", fontSize:11, lineHeight:16 }}>
                        {item.desc}
                      </Text>
                    </View>
                  </View>
                );
              })}
              <Text style={{ color:"#334155", fontSize:10, textAlign:"center", marginTop:4 }}>
                Roadmap is informational — items may shift as development progresses.
              </Text>
            </View>
          )}
        </Pressable>

        {/* Enter button — opens case intro first */}
        <Pressable style={s.enterBtn} onPress={() => setCaseVisible(true)}>
          <Ionicons name="shield-checkmark" size={20} color={COLORS.onBrand} />
          <Text style={s.enterBtnTxt}>ENTER AIRWAY WARD</Text>
        </Pressable>
        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   RESULT SCREEN — Clinical Judgment Report
   ═══════════════════════════════════════════════════════════════════ */
function ResultScreen({
  won, wave, stability, score, rewards, learningStats, onReplay, onBack,
}: {
  won: boolean; wave: number; stability: number; score: number;
  rewards: ReturnType<typeof calcRewards>;
  learningStats: LearningStats;
  onReplay: () => void; onBack: () => void;
}) {
  const total = learningStats.strongMatches + learningStats.partialMatches + learningStats.weakMatches;
  const masteredEnemies = Object.entries(learningStats.enemyMastery).filter(([, m]) => m.defeated);

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>
      <LinearGradient
        colors={won ? ["#041c10", "#062a18", "#041410"] : ["#180608", "#26090c", "#120406"]}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={won ? ["#34D39920", "#00000000"] : ["#F8717120", "#00000000"]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: "40%" }}
      />
      <ScrollView contentContainerStyle={s.resultContent} showsVerticalScrollIndicator={false}>
        <Text style={s.resultEmoji}>{won ? "🏆" : "💔"}</Text>
        <Text style={[s.resultTitle, { color: won ? COLORS.success : COLORS.error }]}>
          {won ? "WARD DEFENDED!" : "VITAL LANTERN DIMMED"}
        </Text>
        <Text style={s.resultSub}>
          {won
            ? `All ${WAVES.length} waves cleared · ${stability} Stability remaining`
            : `Fell on Wave ${wave + 1} of ${WAVES.length}`}
        </Text>

        {/* Rewards */}
        <View style={s.rewardBox}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.brand }} />
            <Text style={s.lobbySectionTitle}>REWARDS EARNED</Text>
          </View>
          {[
            { label: "Codex Shards", icon: "📖", val: rewards.codexShards },
            { label: "Player XP",    icon: "⭐", val: rewards.playerXp },
            { label: "Hero XP",      icon: "🦸", val: rewards.heroXp },
            { label: "Air Catalyst", icon: "💨", val: rewards.airCatalyst },
          ].map(r => (
            <View key={r.label} style={s.rewardRow}>
              <Text style={{ fontSize: 20 }}>{r.icon}</Text>
              <Text style={s.rewardLbl}>{r.label}</Text>
              <Text style={[s.rewardVal, { color: r.val > 0 ? COLORS.brand : COLORS.onSurfaceTertiary }]}>+{r.val}</Text>
            </View>
          ))}
        </View>

        {/* Clinical Judgment Report */}
        {total > 0 && (
          <View style={[s.rewardBox, { gap: 0 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: COLORS.air }} />
              <Text style={s.lobbySectionTitle}>CLINICAL JUDGMENT REPORT</Text>
            </View>

            {/* Match quality 3-column */}
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
              {[
                { count: learningStats.strongMatches,  label: "STRONG",  color: COLORS.success, sym: "✦" },
                { count: learningStats.partialMatches, label: "PARTIAL", color: COLORS.warning,  sym: "◈" },
                { count: learningStats.weakMatches,    label: "WEAK",    color: COLORS.onSurfaceTertiary, sym: "◌" },
              ].map(m => (
                <View key={m.label} style={{ flex: 1, alignItems: "center",
                  backgroundColor: m.color + "12", borderRadius: 8,
                  borderWidth: 1, borderColor: m.color + "30", paddingVertical: 8 }}>
                  <Text style={{ color: m.color, fontSize: 18, fontWeight: "700" }}>{m.count}</Text>
                  <Text style={{ color: m.color, fontSize: 7, fontWeight: "700", letterSpacing: 0.8 }}>
                    {m.sym} {m.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* NCLEX steps summary */}
            {[
              learningStats.priorityActions > 0 && {
                icon: "⚔", label: "Priority Actions",
                val: `×${learningStats.priorityActions}`, color: COLORS.success },
              learningStats.peakCareChain >= 2 && {
                icon: "⛓", label: "Best Care Chain",
                val: `×${learningStats.peakCareChain}`, color: COLORS.runeGold },
              learningStats.reassessUses > 0 && {
                icon: "🔄", label: "Reassess Uses",
                val: `×${learningStats.reassessUses}`, color: "#EC4899" },
            ].filter(Boolean).map((item: any) => (
              <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Text style={{ fontSize: 14 }}>{item.icon}</Text>
                <Text style={{ color: COLORS.onSurfaceSecondary, fontSize: 12, flex: 1 }}>{item.label}</Text>
                <Text style={{ color: item.color, fontSize: 13, fontWeight: "700" }}>{item.val}</Text>
              </View>
            ))}

            {/* Learned clinical concepts */}
            {learningStats.learnedConcepts.length > 0 && (
              <View style={{ marginTop: 6, borderTopWidth: 1, borderColor: "#1a3050", paddingTop: 10 }}>
                <Text style={[s.lobbySectionTitle, { marginBottom: 8 }]}>LEARNED</Text>
                {learningStats.learnedConcepts.slice(0, 3).map(uid => (
                  <View key={uid} style={{ flexDirection: "row", gap: 6, alignItems: "flex-start", marginBottom: 6 }}>
                    <Text style={{ color: COLORS.air, fontSize: 11, marginTop: 1 }}>✦</Text>
                    <Text style={{ color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 16, flex: 1 }}>
                      {UNIT_DATA[uid]?.concept}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Enemy mastery */}
            {masteredEnemies.length > 0 && (
              <View style={{ marginTop: 6, borderTopWidth: 1, borderColor: "#1a3050", paddingTop: 10 }}>
                <Text style={[s.lobbySectionTitle, { marginBottom: 8 }]}>ENEMY MASTERY</Text>
                {masteredEnemies.map(([typeId, m]) => {
                  const def = ENEMY_DATA[typeId];
                  if (!def) return null;
                  return (
                    <View key={typeId} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <Text style={{ fontSize: 14 }}>{def.icon}</Text>
                      <Text style={{ color: COLORS.onSurfaceSecondary, fontSize: 11, flex: 1 }}>{def.name}</Text>
                      <View style={{ backgroundColor: (m.correctDefeated ? COLORS.success : COLORS.onSurfaceTertiary) + "18",
                        borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 }}>
                        <Text style={{ color: m.correctDefeated ? COLORS.success : COLORS.onSurfaceTertiary,
                          fontSize: 8, fontWeight: "700" }}>
                          {m.correctDefeated ? "✦ CORRECT" : "◌ MATCHED"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        <ClinicalTranslationSummary learningStats={learningStats} won={won} />

        <Text style={s.scoreLine}>Total clinical impact: {score}</Text>

        <Pressable style={s.enterBtn} onPress={onReplay}>
          <Ionicons name="refresh" size={18} color={COLORS.onBrand} />
          <Text style={s.enterBtnTxt}>PLAY AGAIN</Text>
        </Pressable>
        <Pressable style={s.exitBtn} onPress={onBack}>
          <Text style={s.exitBtnTxt}>RETURN HOME</Text>
        </Pressable>
        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CLINICAL TRANSLATION SUMMARY
   Connects the fantasy battle back to medical learning.
   Appears after every Ward Defense run (win or lose).
   Safe educational wording throughout — no prescribing guidance.
   ═══════════════════════════════════════════════════════════════════ */
function ClinicalTranslationSummary({
  learningStats, won,
}: { learningStats: LearningStats; won: boolean }) {
  const [open, setOpen] = useState(true);

  /* ── Derive what happened from learningStats ─────────────────── */
  const m = learningStats.enemyMastery;

  /* Which airway-narrowing enemies were defeated correctly */
  const wheezeCorrect = m.wheeze_sprite?.correctDefeated ?? false;
  const drakeCorrect  = m.bronchospasm_drake?.correctDefeated ?? false;
  const hypoxiaHit    = m.hypoxia_wraith?.defeated ?? false;
  const hypoxiaCorrect= m.hypoxia_wraith?.correctDefeated ?? false;

  /* Codex mastery score 0–4 */
  const masteryScore =
    (wheezeCorrect ? 1 : 0) +
    (drakeCorrect  ? 1 : 0) +
    (hypoxiaCorrect ? 1 : 0) +
    (learningStats.reassessUses > 0 ? 1 : 0);

  const codexLabel =
    masteryScore >= 4 ? "MASTERED" :
    masteryScore >= 2 ? "PROGRESSING" :
    masteryScore >= 1 ? "UNLOCKED"  : "ENCOUNTERED";

  const codexColor =
    masteryScore >= 4 ? "#34d399" :
    masteryScore >= 2 ? "#f59e0b" :
    masteryScore >= 1 ? "#a78bfa" : "#475569";

  /* Build correct-match sentences dynamically */
  const matchLines: { icon: string; text: string; color: string }[] = [];
  if (wheezeCorrect || drakeCorrect) {
    const targets = [
      wheezeCorrect && "Wheeze Sprite",
      drakeCorrect  && "Bronchospasm Drake",
    ].filter(Boolean).join(" and ");
    matchLines.push({
      icon: "🌀",
      color: "#f59e0b",
      text: `Mist Caster's Bronchodilator Mist matched well against ${targets} — in this simulation, those spirits represent airway-narrowing patterns.`,
    });
  }
  if (hypoxiaCorrect) {
    matchLines.push({
      icon: "💧",
      color: "#34d399",
      text: "O₂ Healer matched Hypoxia Wraith — in this simulation, that spirit represents oxygenation concern.",
    });
  }
  if (matchLines.length === 0) {
    /* Generic fallback if no correct defeats */
    matchLines.push({
      icon: "💡",
      color: "#60a5fa",
      text: "In this simulation, Mist Caster's Bronchodilator Mist works best against airway-narrowing spirits (Wheeze Sprite, Bronchospasm Drake). O₂ Healer supports oxygenation threats.",
    });
  }

  /* ── Section content ─────────────────────────────────────────── */
  const sections = [
    {
      key: "cues",
      icon: "👁",
      label: "CUES RECOGNIZED",
      color: "#60a5fa",
      bg: "#0a1e36",
      border: "#1e3a6e",
      body: (
        <View style={{ flexDirection:"row", flexWrap:"wrap", gap:5, marginTop:5 }}>
          {[
            "Wheezing",
            "Fast breathing",
            "Anxious posture",
            "Dim oxygen glow",
            "Oxygenation concern",
          ].map(cue => (
            <View key={cue} style={{ backgroundColor:"#60a5fa20", borderRadius:5,
              paddingHorizontal:8, paddingVertical:3 }}>
              <Text style={{ color:"#93c5fd", fontSize:10.5, fontWeight:"600" }}>{cue}</Text>
            </View>
          ))}
        </View>
      ),
    },
    {
      key: "priority",
      icon: "⚠️",
      label: "PRIORITY THREAT",
      color: "#c4b5fd",
      bg: "#130a2a",
      border: "#3b1d8a",
      body: (
        <Text style={{ color:"#94a3b8", fontSize:11.5, lineHeight:18, marginTop:5 }}>
          {hypoxiaHit
            ? "The Hypoxia Wraith threatened the Vital Lantern and represents oxygenation risk in this simulation. Oxygenation threats prioritised — recognised."
            : "The Hypoxia Wraith represents oxygenation risk. In future runs, prioritise oxygenation threats to protect the Vital Lantern."}
        </Text>
      ),
    },
    {
      key: "matches",
      icon: "✦",
      label: "CORRECT MATCHES",
      color: "#34d399",
      bg: "#071a12",
      border: "#134d34",
      body: (
        <View style={{ gap:7, marginTop:5 }}>
          {matchLines.map((ml, i) => (
            <View key={i} style={{ flexDirection:"row", gap:8, alignItems:"flex-start" }}>
              <Text style={{ fontSize:13, marginTop:1 }}>{ml.icon}</Text>
              <Text style={{ color:"#94a3b8", fontSize:11, lineHeight:17, flex:1 }}>
                <Text style={{ color:ml.color, fontWeight:"700" }}>Match — </Text>
                {ml.text}
              </Text>
            </View>
          ))}
        </View>
      ),
    },
    {
      key: "reassess",
      icon: "🔄",
      label: "REASSESSMENT",
      color: "#ec4899",
      bg: "#1a0820",
      border: "#6d1f54",
      body: (
        <Text style={{ color:"#94a3b8", fontSize:11.5, lineHeight:18, marginTop:5 }}>
          {learningStats.reassessUses > 0
            ? `You reassessed ×${learningStats.reassessUses} — evaluating whether breathing effort, wheeze, or oxygen glow improved after each care action. Reassessment closes the clinical loop.`
            : "Reassessment wasn't used this run. After each care action, reassess whether breathing effort, wheeze, or oxygen glow improved — that's how the loop closes."}
        </Text>
      ),
    },
    {
      key: "trap",
      icon: "⚡",
      label: "COMMON TRAP",
      color: "#f97316",
      bg: "#1a0c04",
      border: "#7c3412",
      body: (
        <Text style={{ color:"#fdba74", fontSize:11.5, lineHeight:18, marginTop:5 }}>
          Oxygen supports stability, but may not resolve airway narrowing on its own. In this simulation, the Bronchodilator Mist is the targeted match for airway-narrowing spirits — pairing both covers more of the clinical picture.
        </Text>
      ),
    },
  ] as const;

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <View style={{ marginHorizontal:16, marginBottom:16 }}>
      {/* Header — tap to collapse */}
      <Pressable
        onPress={() => setOpen(v => !v)}
        style={{ flexDirection:"row", alignItems:"center", gap:8,
          backgroundColor:"#0a1628", borderRadius:12,
          borderWidth:1.5, borderColor:"#1e3a5f",
          paddingHorizontal:14, paddingVertical:10,
          borderBottomLeftRadius: open ? 0 : 12,
          borderBottomRightRadius: open ? 0 : 12 }}>
        <Text style={{ fontSize:16 }}>📜</Text>
        <View style={{ flex:1 }}>
          <Text style={{ color:"#a78bfa", fontSize:8, fontWeight:"700",
            letterSpacing:1.2 }}>WINDWAY CURSE · AIRWAY TRANSLATION</Text>
          <Text style={{ color:"#e2e8f0", fontSize:13, fontWeight:"800", marginTop:1 }}>
            Clinical Translation Summary
          </Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color="#475569" />
      </Pressable>

      {open && (
        <View style={{ backgroundColor:"#060f1e", borderWidth:1.5, borderTopWidth:0,
          borderColor:"#1e3a5f", borderBottomLeftRadius:12, borderBottomRightRadius:12,
          padding:12, gap:10 }}>

          {/* Narrative intro */}
          <Text style={{ color:"#475569", fontSize:11, lineHeight:17,
            borderBottomWidth:1, borderColor:"#0f1f38", paddingBottom:10 }}>
            {won
              ? "The Ward was defended. Here is what the battle translated into — connecting the fantasy action to the clinical concepts it represents."
              : "The Vital Lantern dimmed, but the learning remains. Here is what the battle translated into — each spirit represented a clinical concept worth recognising."}
          </Text>

          {/* Six sections */}
          {sections.map(sec => (
            <View key={sec.key} style={{ backgroundColor:sec.bg, borderRadius:10,
              borderWidth:1, borderColor:sec.border, padding:11 }}>
              <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                <Text style={{ fontSize:13 }}>{sec.icon}</Text>
                <Text style={{ color:sec.color, fontSize:9, fontWeight:"700",
                  letterSpacing:1 }}>{sec.label}</Text>
              </View>
              {sec.body}
            </View>
          ))}

          {/* Codex progress */}
          <View style={{ backgroundColor:"#0d0818", borderRadius:10,
            borderWidth:1.5, borderColor:codexColor+"50", padding:12 }}>
            <View style={{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:8 }}>
              <Text style={{ fontSize:16 }}>🌀</Text>
              <View style={{ flex:1 }}>
                <Text style={{ color:"#94a3b8", fontSize:10, fontWeight:"700",
                  letterSpacing:0.8 }}>CODEX PROGRESS</Text>
                <Text style={{ color:"#e2e8f0", fontSize:12, fontWeight:"700", marginTop:1 }}>
                  Windway Curse — Airway Translation
                </Text>
              </View>
              <View style={{ backgroundColor:codexColor+"22", borderRadius:6,
                paddingHorizontal:8, paddingVertical:3 }}>
                <Text style={{ color:codexColor, fontSize:8.5, fontWeight:"700" }}>
                  {codexLabel}
                </Text>
              </View>
            </View>
            {/* Progress bar */}
            <View style={{ height:6, backgroundColor:"#1e293b", borderRadius:3, overflow:"hidden" }}>
              <View style={{ height:"100%", borderRadius:3,
                backgroundColor:codexColor,
                width:`${Math.min(100, (masteryScore / 4) * 100)}%` as any }} />
            </View>
            <Text style={{ color:"#475569", fontSize:10, marginTop:6 }}>
              {masteryScore}/4 mastery points · {
                masteryScore >= 4 ? "Full clinical loop complete — cues, action, match, reassessment." :
                masteryScore >= 2 ? "Keep practising. Try reassessing after each care action." :
                "Next run: try matching Mist Caster to wheeze spirits and reassessing the result."
              }
            </Text>
          </View>

          {/* Footer note */}
          <Text style={{ color:"#334155", fontSize:9.5, textAlign:"center", lineHeight:14 }}>
            This is a fantasy-medical simulation for learning purposes only.{"\n"}
            It does not represent real clinical guidance or prescribing advice.
          </Text>
        </View>
      )}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#040c18" },

  /* HUD */
  hud: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 7,
    borderBottomWidth: 1, borderColor: "#1a3050",
  },
  hudBack: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#0d1e30", borderWidth: 1, borderColor: "#1e3a5a",
    alignItems: "center", justifyContent: "center",
  },
  hudSpeed: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2,
    height: 32, paddingHorizontal: 8, borderRadius: 16,
    backgroundColor: "#0d1e30", borderWidth: 1, borderColor: "#1e3a5a",
  },
  hudSpeedActive: { backgroundColor: "#facc15", borderColor: "#fde047" },
  hudSpeedTxt: { color: COLORS.onSurface, fontSize: 11, fontWeight: "800" },
  hudWave: { flex: 1 },
  hudTitle: { color: COLORS.onSurface, fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
  hudKicker: { color: COLORS.air, fontSize: 7, fontWeight: "800", letterSpacing: 1.8 },
  hudWaveTxt: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 0.3, marginTop: 1 },
  hudStability: { flex: 1.4 },
  hudBarLabel: { color: COLORS.onSurfaceTertiary, fontSize: 7, fontWeight: "700", letterSpacing: 0.8 },
  hudBarVal: { fontSize: 9, fontWeight: "800" },
  hudStabilityBg: { height: 8, backgroundColor: "#0a1428", borderRadius: 5, overflow: "hidden" },
  hudStabilityFill: { height: "100%", borderRadius: 5 },
  hudAp: { width: 52, alignItems: "flex-end" },
  hudGemRow: { flexDirection: "row", flexWrap: "wrap", gap: 2, marginTop: 3 },
  hudGem: { width: 5.5, height: 5.5, borderRadius: 3 },

  /* Arena */
  ward: { flex: 1, width: "100%", overflow: "hidden", position: "relative", backgroundColor: "#050912" },
  sceneStrip: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    overflow: "hidden", zIndex: 0,
  },
  boardFrame: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 1.5, borderColor: "#3a2c14",
    opacity: 0.45, zIndex: 0,
  },
  spawnEdge: {
    position: "absolute", right: 10, top: "40%",
    backgroundColor: "#2c0a0a", borderRadius: 6,
    borderWidth: 1, borderColor: COLORS.error + "60",
    paddingHorizontal: 6, paddingVertical: 3,
  },
  spawnTxt: { color: COLORS.error, fontSize: 10, fontWeight: "700" },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center", gap: 8, zIndex: 20,
  },
  pauseTitle: { color: COLORS.air, fontSize: 15, fontWeight: "700", letterSpacing: 2 },
  pauseSub: { color: COLORS.onSurfaceTertiary, fontSize: 11 },

  /* Feedback */
  feedbackPanel: {
    minHeight: 36, paddingHorizontal: SPACING.md, paddingVertical: 5,
    justifyContent: "center", backgroundColor: "#040c18",
    borderTopWidth: 1, borderColor: "#0e2040",
  },
  feedbackRow: { borderLeftWidth: 2, paddingLeft: SPACING.sm },
  feedbackTxt: { fontSize: 10, lineHeight: 14, fontWeight: "500" },
  feedbackHint: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontStyle: "italic" },

  /* Clinical cue check — floats over the whole battle as a centered modal-style overlay */
  clinicalOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 100, elevation: 100,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#000000b0", padding: 16,
  },
  clinicalOverlayCard: {
    width: "100%", maxWidth: 440,
    borderRadius: 14, overflow: "hidden",
    borderWidth: 2, borderColor: "#6b4118",
    shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 18, elevation: 12,
  },
  /* Clinical cue check panel — parchment/teal style matching reference */
  clinicalPanel: {
    paddingHorizontal: 10, paddingVertical: 8,
    borderTopWidth: 2, borderColor: "#6b4118",
    minHeight: 110,
  },
  clinicalHeaderRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5,
  },
  clinicalBadge: {
    backgroundColor: "#0d5c52", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: "#22d3ee60",
  },
  clinicalBadgeTxt: {
    color: "#e0fffa", fontSize: 8.5, fontWeight: "800", letterSpacing: 0.8,
  },
  clinicalTimerBadge: {
    backgroundColor: "#5a2e00cc", borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: "#c8700060",
  },
  clinicalTimerTxt: { color: "#fbbf24", fontSize: 9, fontWeight: "800" },
  clinicalClose: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#00000018", borderWidth: 1, borderColor: "#4a2e0033",
  },
  clinicalQ: {
    color: "#2d1200", fontSize: 10, fontWeight: "700", lineHeight: 14,
    marginBottom: 6,
  },
  clinicalResult: {
    borderRadius: 8, padding: 8, borderWidth: 1.5,
  },
  clinicalGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 4,
  },
  clinicalBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    width: "48%" as any,
    backgroundColor: "#c8a06088", borderRadius: 8, padding: 7,
    borderWidth: 1.5, borderColor: "#8b5e3c",
  },
  clinicalLetter: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#6b3200", borderWidth: 1.5, borderColor: "#c8700080",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  clinicalLetterTxt: { color: "#fde68a", fontSize: 8, fontWeight: "900" },
  clinicalOptTxt: { color: "#2d1200", fontSize: 9, flex: 1, lineHeight: 12 },
  clinicalLotus: { width: 48, alignItems: "center", justifyContent: "center" },
  clinicalLotusBg: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#c8700060",
  },
  clinicalLotusLabel: {
    color: "#6b3200", fontSize: 7.5, fontWeight: "800",
    textAlign: "center", marginTop: 2, lineHeight: 10,
  },

  /* Hand */
  handArea: { backgroundColor: "#040c18", borderTopWidth: 1, borderColor: "#0e2040" },
  handRow: { flexDirection: "row", padding: 5, gap: 5 },
  handTabs: {
    flexDirection: "row", borderBottomWidth: 1, borderColor: "#0e2040",
    paddingHorizontal: SPACING.sm,
  },
  handTabBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  handTabActive: { borderBottomWidth: 2, borderColor: COLORS.air },
  handTabTxt: { fontSize: 9.5, fontWeight: "700", letterSpacing: 1.2 },
  handApBadge: {
    flexDirection: "row", alignItems: "center", gap: 2,
    paddingVertical: 6, paddingHorizontal: 8,
  },
  handApTxt: { color: COLORS.runeGold, fontSize: 14, fontWeight: "700" },
  handApLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  handCards: { flex: 1, flexDirection: "row", gap: 5 },
  handSidebar: {
    width: 52, alignItems: "center", justifyContent: "space-around",
    paddingVertical: 4, gap: 4,
  },
  handSideBtn: {
    alignItems: "center", justifyContent: "center",
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#0d1e30", borderWidth: 1, borderColor: "#1e3a5a",
  },
  handSideBtnTxt: {
    color: COLORS.onSurfaceTertiary, fontSize: 6, fontWeight: "700",
    letterSpacing: 0.4, marginTop: 1,
  },
  handItemsBadge: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#080e18", borderRadius: 8,
    borderWidth: 1, borderColor: "#1a3050",
    paddingHorizontal: 6, paddingVertical: 4,
  },
  handItemsNum: { color: COLORS.onSurface, fontSize: 13, fontWeight: "800" },
  handItemsLabel: { color: COLORS.onSurfaceTertiary, fontSize: 6, fontWeight: "700", letterSpacing: 0.5 },
  handPauseBtn: { alignItems: "center" },
  handPauseTxt: { color: COLORS.onSurfaceTertiary, fontSize: 6.5, fontWeight: "700", letterSpacing: 0.3, marginTop: 1 },
  unitCard: {
    flex: 1, alignItems: "center", gap: 3,
    paddingVertical: 5, paddingTop: 5, paddingHorizontal: 4,
    borderRadius: RADIUS.md, borderWidth: 1.5,
    minHeight: 108,
  },
  abilityCard: {
    flex: 1, alignItems: "center", gap: 2,
    paddingVertical: 5,
    borderRadius: RADIUS.md, borderWidth: 1.5,
    minHeight: 105,
  },
  cardCatBadge: { fontSize: 7.5, fontWeight: "800", letterSpacing: 0.8 },
  unitCardName: { fontSize: 8, fontWeight: "700", textAlign: "center", lineHeight: 11, paddingHorizontal: 3 },
  apRune: {
    flexDirection: "row", alignItems: "center", gap: 2,
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 6, paddingVertical: 2, marginTop: 1,
  },
  apRuneTxt: { fontSize: 11, fontWeight: "700" },
  apRuneLabel: { fontSize: 6.5, fontWeight: "700", letterSpacing: 0.5, marginTop: 1 },

  /* Lobby */
  lobbyContent: { padding: SPACING.lg, gap: SPACING.lg },
  lobbyHeroArea: { alignItems: "center", gap: 8, paddingVertical: SPACING.md },
  lobbyEmblem: {
    width: 72, height: 72, borderRadius: 12,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    borderWidth: 1.5, borderColor: "#60A5FA40", marginBottom: 8,
  },
  lobbyKicker: { color: COLORS.air, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  lobbyTitle: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300" },
  lobbySubtitle: { color: COLORS.onSurfaceSecondary, fontSize: 12 },
  lobbyCard: {
    backgroundColor: "#080e1c", borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: "#1a3050",
  },
  lobbySectionTitle: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  lobbyBodyTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20 },
  lobbyListRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start", marginBottom: 10 },
  lobbyEnemyChip: {
    width: 44, height: 44, borderRadius: 8, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  lobbyListName: { fontSize: 12, fontWeight: "700" },
  lobbyListDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  enterBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.sm, backgroundColor: COLORS.brand, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md + 2,
  },
  enterBtnTxt: { color: COLORS.onBrand, fontSize: 14, fontWeight: "700", letterSpacing: 2 },
  exitBtn: {
    width: "100%", borderWidth: 1, borderColor: "#1a3050",
    borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: "center",
  },
  exitBtnTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },

  /* Result */
  resultContent: { padding: SPACING.xl, alignItems: "center", gap: SPACING.md },
  resultEmoji: { fontSize: 64, marginTop: SPACING.xl },
  resultTitle: { fontSize: 22, fontWeight: "700", letterSpacing: 2, textAlign: "center" },
  resultSub: { color: COLORS.onSurfaceSecondary, fontSize: 13, textAlign: "center" },
  rewardBox: {
    width: "100%", backgroundColor: "#08101c",
    borderRadius: RADIUS.md, padding: SPACING.lg,
    borderWidth: 1, borderColor: "#1a3050",
  },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  rewardLbl: { flex: 1, color: COLORS.onSurfaceSecondary, fontSize: 14 },
  rewardVal: { fontSize: 18, fontWeight: "700" },
  scoreLine: { color: COLORS.onSurfaceTertiary, fontSize: 12 },
});
