/* ═══════════════════════════════════════════════════════════════════
   WARD DEFENSE UNIT ROSTER — shared source of truth
   Display meta + collection/gacha config used by the shop, the store,
   and the Ward Defense screen. Battle-only stats (damage, range, matchups)
   live in UNIT_BATTLE inside app/ward-defense.tsx, keyed by the same ids.
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
export const GACHA_COST = 150;         // Crowns per recruit pull
export const MAX_UNIT_LEVEL = 5;       // dupes level a unit up to this cap
export const LOADOUT_SIZE = 5;         // max units chosen before a run
export const UNIT_LEVEL_DMG_STEP = 0.08; // +8% damage per level above 1

/* Default owned_units map for a fresh player (starters at level 1). */
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
