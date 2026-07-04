/* ═══════════════════════════════════════════════════════════════════
   WARD DEFENSE: CODE RUSH — UNIT ROSTER
   Display meta + collection/gacha config used by the shop, the store,
   and the Ward Defense screen. Battle-only stats (damage, range, matchups)
   live in UNIT_BATTLE inside app/ward-defense.tsx, keyed by the same ids.

   TWO SEPARATE PROGRESSION SYSTEMS — do not conflate them:
   - Unit Mastery Level (this file): PERMANENT, outside battle. Spends
     duplicate shards + Ward Coins. Persists across every run. 1-15.
   - Merge Rank (app/ward-defense.tsx): TEMPORARY, battle-only. Gained by
     merging matching deployed units during a single Ward Defense run.
     Resets to Rank 1 the moment a new run starts. Never spends shards.
   ═══════════════════════════════════════════════════════════════════ */

export type RoleId = "ASSESS" | "TREAT" | "STABILIZE" | "PROTECT" | "REASSESS";

export type UnitMeta = {
  id: string;
  name: string;
  color: string;
  apCost: number;
  category: string;
  role: RoleId;
  blurb: string;
};

export const WARD_UNIT_META: Record<string, UnitMeta> = {
  ward_scout: {
    id: "ward_scout", name: "Ward Scout", color: "#A78BFA", apCost: 3,
    category: "ASSESS", role: "ASSESS",
    blurb: "Reads enemy cues. Strong vs breathless & panic threats.",
  },
  reassess_sage: {
    id: "reassess_sage", name: "Reassess Sage", color: "#F0ABFC", apCost: 4,
    category: "REASSESS", role: "REASSESS",
    blurb: "Confirms the response for bonus effects. Strong vs panic & shock.",
  },
  mist_caster: {
    id: "mist_caster", name: "Mist Caster", color: "#F472B6", apCost: 5,
    category: "TREAT", role: "TREAT",
    blurb: "Heavy single-target treatment. Strong vs wheeze & bronchospasm.",
  },
  herbal_chemist: {
    id: "herbal_chemist", name: "Herbal Chemist", color: "#A3E635", apCost: 5,
    category: "TREAT", role: "TREAT",
    blurb: "Splash damage over clusters. Strong vs mucus, fever & corruption.",
  },
  o2_healer: {
    id: "o2_healer", name: "O₂ Healer", color: "#22D3EE", apCost: 4,
    category: "STABILIZE", role: "STABILIZE",
    blurb: "Oxygen aura stabilizes the lane. Strong vs hypoxia & shock.",
  },
  guardian: {
    id: "guardian", name: "Novice Guardian", color: "#34D399", apCost: 4,
    category: "PROTECT", role: "PROTECT",
    blurb: "Braces the line with a shield bash. Strong vs stun & corruption.",
  },
  rhythm_medic: {
    id: "rhythm_medic", name: "Rhythm Medic", color: "#FBBF24", apCost: 5,
    category: "STABILIZE", role: "STABILIZE",
    blurb: "Restores circulatory rhythm. Strong vs shock & hypoxia.",
  },
  lantern_scribe: {
    id: "lantern_scribe", name: "Lantern Scribe", color: "#FDE047", apCost: 3,
    category: "REASSESS", role: "REASSESS",
    blurb: "Cuts through confusion. Strong vs panic & stun.",
  },
  fever_warden: {
    id: "fever_warden", name: "Fever Warden", color: "#FB7185", apCost: 5,
    category: "TREAT", role: "TREAT",
    blurb: "Quenches inflammatory heat. Strong vs fever & corruption.",
  },
  airway_sentinel: {
    id: "airway_sentinel", name: "Airway Sentinel", color: "#818CF8", apCost: 4,
    category: "PROTECT", role: "PROTECT",
    blurb: "Clears the airway with a suction pull. Strong vs mucus & wheeze.",
  },
};

export const WARD_UNIT_IDS: string[] = Object.keys(WARD_UNIT_META);

/* Units a brand-new player already owns — enough to field a loadout. */
export const STARTER_UNIT_IDS: string[] = ["ward_scout", "o2_healer", "guardian"];

/* Collection tuning */
export const GACHA_COST = 150;           // Crowns per recruit pull
export const LOADOUT_SIZE = 5;           // max units chosen before a run
export const UNIT_LEVEL_DMG_STEP = 0.08; // +8% base damage per Mastery Level above 1

/* ── Unit Mastery Level (PERMANENT) ─────────────────────────────────────
   Spends duplicate shards (earned from gacha dupes) + Ward Coins (crowns).
   Rising cost curve, capped at MASTERY_LEVEL_CAP. */
export const MASTERY_LEVEL_CAP = 15;
export type MasteryRequirement = { shards: number; coins: number };
export const MASTERY_REQUIREMENTS: Record<number, MasteryRequirement> = {
  2:  { shards: 2,   coins: 100 },
  3:  { shards: 4,   coins: 250 },
  4:  { shards: 8,   coins: 500 },
  5:  { shards: 15,  coins: 1000 },
  6:  { shards: 25,  coins: 2000 },
  7:  { shards: 40,  coins: 3500 },
  8:  { shards: 65,  coins: 6000 },
  9:  { shards: 100, coins: 9500 },
  10: { shards: 150, coins: 15000 },
  11: { shards: 220, coins: 24000 },
  12: { shards: 320, coins: 38000 },
  13: { shards: 460, coins: 60000 },
  14: { shards: 650, coins: 95000 },
  15: { shards: 900, coins: 150000 },
};
export function getMasteryRequirement(targetLevel: number): MasteryRequirement | null {
  return MASTERY_REQUIREMENTS[targetLevel] || null;
}

/* ── Merge Rank (TEMPORARY, battle-only) ─────────────────────────────── */
export const MERGE_RANK_NAMES = ["Novice", "Adept", "Expert", "Master", "Ascended"];
export const MERGE_RANK_CAP = MERGE_RANK_NAMES.length; // 5
/* Damage multiplier per merge rank (index 0 = Rank 1 Novice). Replaces the
   old 3-tier curve — now goes all the way to Rank 5 Ascended. */
export const MERGE_RANK_DMG_MULT = [1.0, 1.55, 2.15, 2.85, 3.6];
export function mergeRankName(rank: number): string {
  return MERGE_RANK_NAMES[Math.min(Math.max(rank, 1), MERGE_RANK_CAP) - 1];
}

/* Default owned_units map for a fresh player (starters at Mastery Level 1). */
export function defaultOwnedUnits(): Record<string, number> {
  const m: Record<string, number> = {};
  for (const id of STARTER_UNIT_IDS) m[id] = 1;
  return m;
}

/* Roll a single gacha pull across the full roster (uniform). */
export function rollGachaUnit(): string {
  return WARD_UNIT_IDS[Math.floor(Math.random() * WARD_UNIT_IDS.length)];
}

/* Sanitize a proposed loadout: keep only owned ids, dedupe, cap at LOADOUT_SIZE. */
export function sanitizeLoadout(ids: string[], owned: Record<string, number>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    if (!owned[id]) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= LOADOUT_SIZE) break;
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════
   ROLE-SPECIFIC STATS — permanent, grow with Unit Mastery Level.
   Each unit gets a distinct stat sheet instead of generic damage-only
   numbers. `perLevel` is added once per Mastery Level above 1 (linear,
   capped at MASTERY_LEVEL_CAP), so growth stays modest and readable.
   ═══════════════════════════════════════════════════════════════════ */
export type StatKey = string;
export type UnitStatBlock = {
  order: StatKey[];                       // display order
  labels: Record<StatKey, string>;        // human label
  suffix: Record<StatKey, string>;        // e.g. "%", "s", "AP"
  base: Record<StatKey, number>;          // value at Mastery Level 1
  perLevel: Record<StatKey, number>;      // added per level above 1
  milestones: { level: 5 | 10 | 15; title: string; desc: string }[];
};

export const UNIT_STAT_BLOCKS: Record<string, UnitStatBlock> = {
  /* Ward Scout — Assess/Reveal (a.k.a. Apprentice Seer identity) */
  ward_scout: {
    order: ["revealDuration", "markedDamageBonus", "hiddenPathologyBreak", "insightSpreadChance", "clinicalChainWindow"],
    labels: {
      revealDuration: "Reveal Duration", markedDamageBonus: "Marked Damage Bonus",
      hiddenPathologyBreak: "Hidden Pathology Break", insightSpreadChance: "Insight Spread Chance",
      clinicalChainWindow: "Clinical Chain Window",
    },
    suffix: { revealDuration: "s", markedDamageBonus: "%", hiddenPathologyBreak: "%", insightSpreadChance: "%", clinicalChainWindow: "s" },
    base:     { revealDuration: 3.0, markedDamageBonus: 15, hiddenPathologyBreak: 40, insightSpreadChance: 8,  clinicalChainWindow: 2.0 },
    perLevel: { revealDuration: 0.12, markedDamageBonus: 1.4, hiddenPathologyBreak: 2.5, insightSpreadChance: 0.8, clinicalChainWindow: 0.05 },
    milestones: [
      { level: 5,  title: "Extended Assessment", desc: "Reveal lasts noticeably longer, keeping weaknesses exposed." },
      { level: 10, title: "Deep Insight", desc: "Enemies revealed from Hidden Pathology lose extra resistance." },
      { level: 15, title: "First Read", desc: "The first reveal each wave grants +1 AP." },
    ],
  },
  /* Mist Caster — Treat/Airway Control */
  mist_caster: {
    order: ["damage", "attackInterval", "mistSlow", "mistDuration", "mistCloudRadius", "airwayBonus"],
    labels: {
      damage: "Damage", attackInterval: "Attack Interval", mistSlow: "Mist Slow",
      mistDuration: "Mist Duration", mistCloudRadius: "Mist Cloud Radius", airwayBonus: "Airway Bonus",
    },
    suffix: { damage: "", attackInterval: "s", mistSlow: "%", mistDuration: "s", mistCloudRadius: "tiles", airwayBonus: "%" },
    base:     { damage: 38, attackInterval: 1.6, mistSlow: 18, mistDuration: 2.0, mistCloudRadius: 1.0, airwayBonus: 10 },
    perLevel: { damage: 3.2, attackInterval: -0.02, mistSlow: 1.1, mistDuration: 0.08, mistCloudRadius: 0.02, airwayBonus: 1.2 },
    milestones: [
      { level: 5,  title: "Spreading Mist", desc: "Mist Slow lightly affects enemies near the target." },
      { level: 10, title: "Lingering Cloud", desc: "The mist cloud lingers briefly after impact." },
      { level: 15, title: "Airway Collapse", desc: "Airway-type enemies take bonus damage while slowed." },
    ],
  },
  /* O2 Healer — Oxygen Support/Stabilize */
  o2_healer: {
    order: ["damage", "attackInterval", "oxygenationBonus", "stabilityRestore", "chainTargetCount", "oxygenFieldDuration"],
    labels: {
      damage: "Damage", attackInterval: "Attack Interval", oxygenationBonus: "Oxygenation Bonus",
      stabilityRestore: "Stability Restore", chainTargetCount: "Chain Target Count", oxygenFieldDuration: "Oxygen Field Duration",
    },
    suffix: { damage: "", attackInterval: "s", oxygenationBonus: "%", stabilityRestore: "", chainTargetCount: "", oxygenFieldDuration: "s" },
    base:     { damage: 22, attackInterval: 1.4, oxygenationBonus: 12, stabilityRestore: 1, chainTargetCount: 0, oxygenFieldDuration: 2.0 },
    perLevel: { damage: 1.6, attackInterval: -0.015, oxygenationBonus: 1.0, stabilityRestore: 0.15, chainTargetCount: 0.05, oxygenFieldDuration: 0.1 },
    milestones: [
      { level: 5,  title: "Restorative Oxygen", desc: "Defeating an oxygenation-weak enemy restores Stability." },
      { level: 10, title: "Twin Beam", desc: "The oxygen beam chains to a second oxygenation-weak enemy." },
      { level: 15, title: "Steady Field", desc: "Oxygen Field briefly reduces Stability drain nearby." },
    ],
  },
  /* Novice Guardian — Protect/Block */
  guardian: {
    order: ["barrierStrength", "stopDuration", "knockbackDistance", "blockCooldown", "laneGuardRadius"],
    labels: {
      barrierStrength: "Barrier Strength", stopDuration: "Stop Duration", knockbackDistance: "Knockback Distance",
      blockCooldown: "Block Cooldown", laneGuardRadius: "Lane Guard Radius",
    },
    suffix: { barrierStrength: "", stopDuration: "s", knockbackDistance: "tiles", blockCooldown: "s", laneGuardRadius: "tiles" },
    base:     { barrierStrength: 20, stopDuration: 1.2, knockbackDistance: 0, blockCooldown: 6.0, laneGuardRadius: 0.28 },
    perLevel: { barrierStrength: 1.8, stopDuration: 0.05, knockbackDistance: 0.02, blockCooldown: -0.08, laneGuardRadius: 0.01 },
    milestones: [
      { level: 5,  title: "Reinforced Aegis", desc: "The barrier lasts longer before fading." },
      { level: 10, title: "Shield Bash", desc: "The barrier can knock back the leading enemy." },
      { level: 15, title: "Lane Ward", desc: "The barrier affects a small segment of the lane." },
    ],
  },
  /* Reassess Sage — Reassess/Amplify */
  reassess_sage: {
    order: ["responseConfirmedBonus", "debuffExtension", "clinicalChainBonus", "apGainChance", "reassessmentRadius"],
    labels: {
      responseConfirmedBonus: "Response Confirmed Bonus", debuffExtension: "Debuff Extension",
      clinicalChainBonus: "Clinical Chain Bonus", apGainChance: "AP Gain Chance", reassessmentRadius: "Reassessment Radius",
    },
    suffix: { responseConfirmedBonus: "%", debuffExtension: "s", clinicalChainBonus: "%", apGainChance: "%", reassessmentRadius: "tiles" },
    base:     { responseConfirmedBonus: 15, debuffExtension: 0.8, clinicalChainBonus: 10, apGainChance: 6, reassessmentRadius: 0.30 },
    perLevel: { responseConfirmedBonus: 1.3, debuffExtension: 0.04, clinicalChainBonus: 1.0, apGainChance: 0.5, reassessmentRadius: 0.008 },
    milestones: [
      { level: 5,  title: "Confirmed Care", desc: "Active debuffs on treated enemies extend slightly." },
      { level: 10, title: "Charged Response", desc: "Response Confirmed grants Clinical Art charge." },
      { level: 15, title: "Closed Loop", desc: "A correct clinical chain can restore a little Stability." },
    ],
  },
  /* Herbal Chemist — Cleanse/Damage Over Time */
  herbal_chemist: {
    order: ["tinctureDamage", "damageDuration", "cleanseStrength", "spreadChance", "toxinBonus"],
    labels: {
      tinctureDamage: "Tincture Damage", damageDuration: "Damage Duration", cleanseStrength: "Cleanse Strength",
      spreadChance: "Spread Chance", toxinBonus: "Infection/Toxin Bonus",
    },
    suffix: { tinctureDamage: "", damageDuration: "s", cleanseStrength: "%", spreadChance: "%", toxinBonus: "%" },
    base:     { tinctureDamage: 6, damageDuration: 3.0, cleanseStrength: 10, spreadChance: 10, toxinBonus: 12 },
    perLevel: { tinctureDamage: 0.6, damageDuration: 0.1, cleanseStrength: 1.0, spreadChance: 0.6, toxinBonus: 1.1 },
    milestones: [
      { level: 5,  title: "Slow-Release Tincture", desc: "The tincture's damage-over-time lasts longer." },
      { level: 10, title: "Contagious Cure", desc: "Tincture can spread to a nearby enemy when its target is defeated." },
      { level: 15, title: "Cleanse Field", desc: "Can remove a nearby Corruption Zone." },
    ],
  },
  /* Rhythm Medic — Support/Attack Speed Buff */
  rhythm_medic: {
    order: ["attackSpeedAura", "auraRadius", "buffDuration", "clinicalArtChargeRate", "adjacentUnitBonus"],
    labels: {
      attackSpeedAura: "Attack Speed Aura", auraRadius: "Aura Radius", buffDuration: "Buff Duration",
      clinicalArtChargeRate: "Clinical Art Charge Rate", adjacentUnitBonus: "Adjacent Unit Bonus",
    },
    suffix: { attackSpeedAura: "%", auraRadius: "tiles", buffDuration: "s", clinicalArtChargeRate: "%", adjacentUnitBonus: "%" },
    base:     { attackSpeedAura: 8, auraRadius: 0.22, buffDuration: 2.0, clinicalArtChargeRate: 5, adjacentUnitBonus: 6 },
    perLevel: { attackSpeedAura: 0.7, auraRadius: 0.006, buffDuration: 0.06, clinicalArtChargeRate: 0.4, adjacentUnitBonus: 0.5 },
    milestones: [
      { level: 5,  title: "Steady Beat", desc: "Attack Speed Aura strength improves." },
      { level: 10, title: "Wider Rhythm", desc: "Aura radius expands to reach adjacent platforms." },
      { level: 15, title: "Shared Pulse", desc: "Buffed allies gain a small Clinical Art charge." },
    ],
  },
  /* Lantern Scribe — Economy/AP Support */
  lantern_scribe: {
    order: ["apGeneration", "activationInterval", "refundChance", "costReduction", "mergeRefundBonus"],
    labels: {
      apGeneration: "AP Generation", activationInterval: "Activation Interval", refundChance: "Refund Chance",
      costReduction: "Cost Reduction", mergeRefundBonus: "Merge Refund Bonus",
    },
    suffix: { apGeneration: "AP", activationInterval: "s", refundChance: "%", costReduction: "%", mergeRefundBonus: "%" },
    base:     { apGeneration: 1, activationInterval: 12.0, refundChance: 5, costReduction: 0, mergeRefundBonus: 0 },
    perLevel: { apGeneration: 0.03, activationInterval: -0.15, refundChance: 0.5, costReduction: 0.15, mergeRefundBonus: 0.4 },
    milestones: [
      { level: 5,  title: "Brighter Lantern", desc: "AP generation improves." },
      { level: 10, title: "Frugal Ward", desc: "Chance to refund AP after a merge." },
      { level: 15, title: "First Light", desc: "The first deploy each wave costs a little less AP." },
    ],
  },
  /* Fever Warden — reflavored as Stabilize/Support "Village Caretaker" identity */
  fever_warden: {
    order: ["shieldStrength", "stabilityRestore", "auraRadius", "lanternProtection", "cooldown", "emergencyBarrierThreshold"],
    labels: {
      shieldStrength: "Shield Strength", stabilityRestore: "Stability Restore", auraRadius: "Aura Radius",
      lanternProtection: "Lantern Protection", cooldown: "Cooldown", emergencyBarrierThreshold: "Emergency Barrier Threshold",
    },
    suffix: { shieldStrength: "", stabilityRestore: "", auraRadius: "tiles", lanternProtection: "%", cooldown: "s", emergencyBarrierThreshold: "%" },
    base:     { shieldStrength: 18, stabilityRestore: 1, auraRadius: 0.24, lanternProtection: 8, cooldown: 8.0, emergencyBarrierThreshold: 20 },
    perLevel: { shieldStrength: 1.5, stabilityRestore: 0.1, auraRadius: 0.006, lanternProtection: 0.8, cooldown: -0.1, emergencyBarrierThreshold: 0 },
    milestones: [
      { level: 5,  title: "Fortified Ward", desc: "Shield Strength increases." },
      { level: 10, title: "Stability Barrier", desc: "Overheal becomes a temporary Stability Barrier." },
      { level: 15, title: "Emergency Ward", desc: "An emergency shield triggers once when Stability is Critical." },
    ],
  },
  /* Airway Sentinel — reflavored as Fast Attack/Targeting "Ward Scout" identity */
  airway_sentinel: {
    order: ["damage", "attackInterval", "fastEnemyBonus", "precisionStrikeChance", "multiTargetChance"],
    labels: {
      damage: "Damage", attackInterval: "Attack Interval", fastEnemyBonus: "Fast Enemy Bonus",
      precisionStrikeChance: "Precision Strike Chance", multiTargetChance: "Multi-Target Chance",
    },
    suffix: { damage: "", attackInterval: "s", fastEnemyBonus: "%", precisionStrikeChance: "%", multiTargetChance: "%" },
    base:     { damage: 24, attackInterval: 1.2, fastEnemyBonus: 10, precisionStrikeChance: 0, multiTargetChance: 0 },
    perLevel: { damage: 2.0, attackInterval: -0.02, fastEnemyBonus: 1.0, precisionStrikeChance: 0.4, multiTargetChance: 0.2 },
    milestones: [
      { level: 5,  title: "Runner's Bane", desc: "Prioritizes Fast Runner enemies." },
      { level: 10, title: "Precision Strike", desc: "Unlocks a chance to land a bonus precision hit." },
      { level: 15, title: "Twin Strike", desc: "Precision Strike can hit a second target." },
    ],
  },
};

/* Compute a unit's permanent role stats at a given Mastery Level (1-15). */
export function getMasteryStats(typeId: string, level: number): Record<StatKey, number> {
  const block = UNIT_STAT_BLOCKS[typeId];
  if (!block) return {};
  const lvl = Math.min(Math.max(level, 1), MASTERY_LEVEL_CAP);
  const out: Record<StatKey, number> = {};
  for (const k of block.order) {
    out[k] = block.base[k] + block.perLevel[k] * (lvl - 1);
  }
  return out;
}

/* Milestones unlocked (<=) at a given Mastery Level. */
export function unlockedMilestones(typeId: string, level: number) {
  const block = UNIT_STAT_BLOCKS[typeId];
  if (!block) return [];
  return block.milestones.filter(m => level >= m.level);
}
