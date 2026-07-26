// ────────────────────────────────────────────────────────────
// CLASS TREE — Player Class identity + Lv1/10/20/30 ability foundation
// (Push 6). This is an ADDITIVE, forward-looking system layered on top of
// the existing account-level Player Level. It intentionally does NOT touch
// or replace the existing aptitude-driven battle bonuses in progression.ts
// (PLAYER_CLASS_ABILITIES / getClassBattleBonuses, still wired into
// battle.tsx) — that system keeps working exactly as before. Deeper battle
// integration for these new class-tree abilities is intentionally gradual
// future work (see GUARDRAIL_LINES below), so this module is safe to ship
// without any battle rebalance risk.
//
// Six class identities, each with its own Lv1 (free/automatic) → Lv10 →
// Lv20 → Lv30 ability card. Tiers 10/20/30 require spending existing
// Player Class materials (see materials.ts PLAYER_CLASS_MATERIALS) — no new
// material family is introduced.
// ────────────────────────────────────────────────────────────

export type ClassId = 'guardian' | 'seer' | 'caretaker' | 'scholar' | 'alchemist' | 'medic';

export const CLASS_IDS: ClassId[] = ['guardian', 'seer', 'caretaker', 'scholar', 'alchemist', 'medic'];

export const DEFAULT_CLASS_ID: ClassId = 'medic';

export interface ClassIdentity {
  id: ClassId;
  name: string;
  icon: string; // Ionicons glyph name
  color: string;
  lore: string;
  focusTags: string[];
  role: string;
}

export const CLASS_IDENTITIES: Record<ClassId, ClassIdentity> = {
  guardian: {
    id: 'guardian',
    name: 'Guardian',
    icon: 'shield',
    color: '#5B9BD5',
    lore: "Guardians plant themselves between danger and the patient, buying every second of stability the team needs.",
    focusTags: ['Protection', 'Barriers', 'Emergency Stability'],
    role: 'Reduces pressure and helps the team hold the line when things go wrong.',
  },
  seer: {
    id: 'seer',
    name: 'Seer',
    icon: 'eye',
    color: '#A78BFA',
    lore: "Seers read the body's hidden signs before anyone else, turning careful assessment into a real edge.",
    focusTags: ['Assessment', 'Clinical Cue', 'Weakness Detection'],
    role: 'Reveals hidden pathology and turns correct calls into an advantage.',
  },
  caretaker: {
    id: 'caretaker',
    name: 'Caretaker',
    icon: 'heart',
    color: '#34D399',
    lore: 'Caretakers hold the line on recovery, making sure no one is left destabilized for long.',
    focusTags: ['Healing', 'Stabilization', 'Team Sustain'],
    role: "Keeps the team's Stability high and supports steady recovery.",
  },
  scholar: {
    id: 'scholar',
    name: 'Scholar',
    icon: 'school',
    color: '#F59E0B',
    lore: 'Scholars turn every battle into a lesson, sharpening judgment through study, review, and the Codex.',
    focusTags: ['Research', 'Clinical Cue Mastery', 'University'],
    role: 'Converts learning and correct calls into lasting growth.',
  },
  alchemist: {
    id: 'alchemist',
    name: 'Alchemist',
    icon: 'flask',
    color: '#22D3EE',
    lore: 'Alchemists blend Clinical Supplies and technique into precise, dependable care.',
    focusTags: ['Clinical Supplies', 'Apothecary', 'Cleanse'],
    role: 'Makes supplies, cleanses, and treatments hit harder.',
  },
  medic: {
    id: 'medic',
    name: 'Medic',
    icon: 'medkit',
    color: '#D4AF37',
    lore: 'Medics are trained to do a bit of everything — dependable in any situation, on any Ward.',
    focusTags: ['Versatility', 'Field Support', 'Team Balance'],
    role: 'A balanced generalist with a little support for every action. The default starting class.',
  },
};

export type ClassTierLevel = 1 | 10 | 20 | 30;
export const CLASS_TIER_LEVELS: ClassTierLevel[] = [1, 10, 20, 30];

export interface ClassTierRequirement {
  material: string; // material id from materials.ts
  qty: number;
}

export interface ClassAbilityCard {
  level: ClassTierLevel;
  name: string;
  description: string;
  requirements: ClassTierRequirement[]; // empty for Lv1 — automatic, no cost
}

// Requirement pattern shared by every class, per Step 3 of the spec:
//   Lv1  — free, automatic once this is your current class and you're Lv1+.
//   Lv10 — requires 1 Class Manual.
//   Lv20 — requires University Credits + 1 Class Manual.
//   Lv30 — requires 1 Ascension Seal.
const TIER_10_REQ: ClassTierRequirement[] = [{ material: 'class_manuals', qty: 1 }];
const TIER_20_REQ: ClassTierRequirement[] = [{ material: 'knowledge_points', qty: 30 }, { material: 'class_manuals', qty: 1 }];
const TIER_30_REQ: ClassTierRequirement[] = [{ material: 'ascension_seals', qty: 1 }];

export const CLASS_TREES: Record<ClassId, ClassAbilityCard[]> = {
  guardian: [
    { level: 1, name: 'Steady Hands', description: 'Prevents up to 5 Stability loss from the next deterioration event.', requirements: [] },
    { level: 10, name: 'Barrier Response', description: 'The first time Stability drops below 50% in a battle, prevents the next Stability loss event.', requirements: TIER_10_REQ },
    { level: 20, name: 'Protected Ward', description: 'Guardian-type heroes reduce incoming Instability from the next deterioration event.', requirements: TIER_20_REQ },
    { level: 30, name: 'Vital Bastion', description: 'Prevents Stability from falling below 1 this turn — Triage Wall holds the line.', requirements: TIER_30_REQ },
  ],
  seer: [
    { level: 1, name: 'Early Recognition', description: 'The first successful Clinical Cue each battle reveals one hidden weakness.', requirements: [] },
    { level: 10, name: 'Pattern Finder', description: 'Assessment-focused heroes keep revealed weaknesses visible longer.', requirements: TIER_10_REQ },
    { level: 20, name: 'Reassessment Lens', description: 'After using Reassess, your next correct Clinical Cue grants bonus AP.', requirements: TIER_20_REQ },
    { level: 30, name: 'True Cue Revelation', description: "Briefly reveals all of the enemy's active weaknesses at once.", requirements: TIER_30_REQ },
  ],
  caretaker: [
    { level: 1, name: 'Gentle Stabilization', description: 'Stabilize restores slightly more Stability, keeping the patient safer longer.', requirements: [] },
    { level: 10, name: 'Recovery Rhythm', description: 'Post-battle recovery rewards improve.', requirements: TIER_10_REQ },
    { level: 20, name: 'Compassion Chain', description: 'Support-focused heroes restore additional Stability when completing a Care Chain step.', requirements: TIER_20_REQ },
    { level: 30, name: 'Lotus Recovery Field', description: 'Restores a small amount of Stability each turn — recurring Instability slows.', requirements: TIER_30_REQ },
  ],
  scholar: [
    { level: 1, name: 'Studious Mind', description: 'Gain extra University Credits from Clinical Cue success.', requirements: [] },
    { level: 10, name: 'Lesson Retention', description: 'University lessons give increased progress.', requirements: TIER_10_REQ },
    { level: 20, name: 'Codex Memory', description: 'Reviewing the Codex after Clinical Cue success gives a small Insight Crystal bonus.', requirements: TIER_20_REQ },
    { level: 30, name: 'Grand Rounds', description: "Correct answers temporarily strengthen your active heroes' role bonuses.", requirements: TIER_30_REQ },
  ],
  alchemist: [
    { level: 1, name: 'Careful Preparation', description: 'Clinical Supplies lower Corruption and identify resistance more effectively.', requirements: [] },
    { level: 10, name: 'Herbal Precision', description: 'Lower Corruption and resistance identification effects improve.', requirements: TIER_10_REQ },
    { level: 20, name: 'Apothecary Efficiency', description: 'Supply production and Apothecary discounts improve.', requirements: TIER_20_REQ },
    { level: 30, name: 'Purifying Formula', description: 'Briefly lowers Corruption and boosts treatment effectiveness.', requirements: TIER_30_REQ },
  ],
  medic: [
    { level: 1, name: 'Field Readiness', description: 'A small AP preparation bonus reduces early-turn pressure.', requirements: [] },
    { level: 10, name: 'Flexible Practice', description: 'A small once-per-battle bonus to Scout, Stabilize, Treat, or Reassess.', requirements: TIER_10_REQ },
    { level: 20, name: 'Team Coordination', description: "Your active team gains a minor role-synergy bonus.", requirements: TIER_20_REQ },
    { level: 30, name: 'Code Calm', description: 'An emergency support boost that restores Stability and grants AP.', requirements: TIER_30_REQ },
  ],
};

export function getClassTree(classId: ClassId): ClassAbilityCard[] {
  return CLASS_TREES[classId] || CLASS_TREES[DEFAULT_CLASS_ID];
}

export function defaultClassProgress(): Record<ClassId, number[]> {
  return { guardian: [], seer: [], caretaker: [], scholar: [], alchemist: [], medic: [] };
}

// Migration-only helper: derives a starting class identity from the
// existing onboarding `aptitude` field so pre-existing saves get a sensible
// default the first time they open the Class Tree. This does NOT drive any
// battle mechanic — see file header note.
export function classIdForAptitude(aptitude?: string | null): ClassId {
  switch (aptitude) {
    case 'sage': return 'seer';
    case 'warden': return 'caretaker';
    case 'weaver': return 'scholar';
    case 'guardian': return 'guardian';
    default: return DEFAULT_CLASS_ID;
  }
}

export function isTierAutomatic(level: ClassTierLevel): boolean {
  return level === 1;
}

export function isTierClaimed(progress: number[] | undefined, level: ClassTierLevel): boolean {
  if (isTierAutomatic(level)) return true;
  return !!progress && progress.includes(level);
}

export function isTierLevelReached(card: ClassAbilityCard, playerLevel: number): boolean {
  return playerLevel >= card.level;
}

export interface ClaimCheckResult {
  ok: boolean;
  reason?: string;
}

// Pure check — does NOT mutate/spend anything. Store actions perform the
// actual inventory deduction after re-validating with this same logic.
export function canClaimTier(
  card: ClassAbilityCard,
  playerLevel: number,
  progress: number[] | undefined,
  inventory: Record<string, number>,
): ClaimCheckResult {
  if (isTierAutomatic(card.level)) return { ok: false, reason: 'Automatic — no claim needed.' };
  if (isTierClaimed(progress, card.level)) return { ok: false, reason: 'Already unlocked.' };
  if (!isTierLevelReached(card, playerLevel)) return { ok: false, reason: `Requires Player Level ${card.level}.` };
  for (const req of card.requirements) {
    if ((inventory[req.material] || 0) < req.qty) return { ok: false, reason: 'Missing required materials.' };
  }
  return { ok: true };
}

export function nextClassTier(classId: ClassId, progress: number[] | undefined): ClassAbilityCard | null {
  const tree = getClassTree(classId);
  return tree.find((c) => !isTierClaimed(progress, c.level)) || null;
}

// ---------- Guardrail copy (Step 14) ----------
// Player-facing reassurance text shown on the Class Tree screen. Keep this
// list short, plain-language, and consistent with the no-pay-to-win /
// no-required-class product guarantees for this system.
export const GUARDRAIL_LINES: string[] = [
  'Class bonuses are supportive — they help, but you never need a specific class to win.',
  'There are no paid class unlocks. Class Manuals and University Credits are earned through normal play.',
  'Ascension Seals are earned through major progression milestones and are never sold directly.',
  'Basic gameplay (Ward Shift, Ward Defense, Heroes, Shop, University) stays fully available regardless of your class.',
  'Deeper battle integration for class abilities will roll out gradually in future updates.',
];

// ─────────────────────────────────────────────────────────────────────────────
// Push 11 — Class tree combat bonuses
//
// Each of the 6 classes grants numeric bonuses during battle. Bonuses scale
// with the tier levels the player has claimed (Lv1 is automatic/always active;
// Lv10/20/30 are claimed via claimClassTier and stored in class_progress).
//
// These are pre-computed in battle.tsx and passed into initBattle as
// InitBattleOptions.classTreeBonus — battle.ts never calls into classTree.ts
// directly, keeping the dependency graph clean.
// ─────────────────────────────────────────────────────────────────────────────

export interface ClassTreeBattleBonus {
  // SkillModifiers.playerClassMod — fed per bag type in battle.ts
  stabilizeMod: number;    // Caretaker/Guardian: stabilize skills amplified
  strikeMod: number;       // Alchemist/Scholar: treatment/strike skills amplified
  shieldMod: number;       // Guardian: shield skills amplified
  itemMod: number;         // Alchemist: item use amplified
  // SkillModifiers.careChainMod — multiplies Care Chain completion bonus
  careChainMod: number;    // Medic: chain completion bonus amplified
  // Special effects — handled directly in battle.ts action handlers
  incomingDamageReduction: number;      // Guardian: enemy instability × (1 − this)
  scoutRevealBonus: number;             // Seer: extra hidden clues per scout action
  scoutFirstActionRevealBonus: number;  // Seer: additional clues on the FIRST scout of the battle
  cueBonusFlatBonus: number;            // Scholar: added to cueBonusStabilize on every correct Cue
  reassessAfterStabilizeBonus: number;  // Caretaker: flat stability when Reassess follows Stabilize
  startApBonus: number;                 // Medic: flat extra AP at battle start
}

function neutralClassBonus(): ClassTreeBattleBonus {
  return {
    stabilizeMod: 1, strikeMod: 1, shieldMod: 1, itemMod: 1, careChainMod: 1,
    incomingDamageReduction: 0, scoutRevealBonus: 0, scoutFirstActionRevealBonus: 0,
    cueBonusFlatBonus: 0, reassessAfterStabilizeBonus: 0, startApBonus: 0,
  };
}

const hasTier = (progress: number[], level: number) => progress.includes(level);

/** Returns the combat bonus for the given class and claimed tier progress. */
export function getClassTreeBattleBonuses(classId: ClassId, classProgress: number[]): ClassTreeBattleBonus {
  const b = neutralClassBonus();
  const t10 = hasTier(classProgress, 10);
  const t20 = hasTier(classProgress, 20);
  const t30 = hasTier(classProgress, 30);

  switch (classId) {
    case 'guardian':
      // Lv1 (automatic): incoming Instability reduced 3%, stabilize 3% stronger
      b.incomingDamageReduction = 0.03;
      b.stabilizeMod = 1.03;
      if (t10) { b.incomingDamageReduction = 0.05; b.stabilizeMod = 1.05; }
      if (t20) { b.shieldMod = 1.05; }
      if (t30) { b.incomingDamageReduction = 0.08; b.shieldMod = 1.08; }
      break;

    case 'seer':
      // Lv1: scout reveals +1 extra clue each time
      b.scoutRevealBonus = 1;
      if (t10) { b.scoutFirstActionRevealBonus = 1; }
      if (t20) { b.cueBonusFlatBonus = 2; }
      if (t30) { b.scoutRevealBonus = 2; b.cueBonusFlatBonus = 2; }
      break;

    case 'caretaker':
      // Lv1: stabilize 5% stronger
      b.stabilizeMod = 1.05;
      if (t10) { b.reassessAfterStabilizeBonus = 3; }
      if (t20) { b.stabilizeMod = 1.07; b.reassessAfterStabilizeBonus = 5; }
      if (t30) { b.stabilizeMod = 1.10; b.reassessAfterStabilizeBonus = 8; }
      break;

    case 'scholar':
      // Lv1: correct Cue grants +2 extra cueBonusStabilize
      b.cueBonusFlatBonus = 2;
      if (t10) { b.cueBonusFlatBonus = 3; }
      if (t20) { b.cueBonusFlatBonus = 4; b.strikeMod = 1.03; }
      if (t30) { b.cueBonusFlatBonus = 5; b.strikeMod = 1.05; }
      break;

    case 'alchemist':
      // Lv1: clinical supplies 5% stronger, treatment strikes 3% stronger
      b.itemMod = 1.05;
      b.strikeMod = 1.03;
      if (t10) { b.itemMod = 1.07; b.strikeMod = 1.05; }
      if (t20) { b.itemMod = 1.08; b.stabilizeMod = 1.03; }
      if (t30) { b.itemMod = 1.10; b.strikeMod = 1.07; }
      break;

    case 'medic':
      // Lv1: Care Chain completion 5% stronger
      b.careChainMod = 1.05;
      if (t10) { b.careChainMod = 1.10; b.startApBonus = 1; }
      if (t20) { b.careChainMod = 1.12; }
      if (t30) { b.careChainMod = 1.15; }
      break;

    default:
      break;
  }
  return b;
}

/** Human-readable summary of active bonuses, shown on the Class Tree screen. */
export function describeClassBattleBonuses(bonus: ClassTreeBattleBonus): string[] {
  const lines: string[] = [];
  if (bonus.incomingDamageReduction > 0)
    lines.push(`Incoming Instability reduced ${Math.round(bonus.incomingDamageReduction * 100)}%`);
  if (bonus.stabilizeMod > 1)
    lines.push(`Stabilize skills ${Math.round((bonus.stabilizeMod - 1) * 100)}% stronger`);
  if (bonus.strikeMod > 1)
    lines.push(`Treatment & strike skills ${Math.round((bonus.strikeMod - 1) * 100)}% stronger`);
  if (bonus.shieldMod > 1)
    lines.push(`Shield skills ${Math.round((bonus.shieldMod - 1) * 100)}% stronger`);
  if (bonus.itemMod > 1)
    lines.push(`Clinical supplies ${Math.round((bonus.itemMod - 1) * 100)}% stronger`);
  if (bonus.careChainMod > 1)
    lines.push(`Care Chain completion ${Math.round((bonus.careChainMod - 1) * 100)}% stronger`);
  if (bonus.scoutRevealBonus > 0)
    lines.push(`Scout reveals ${bonus.scoutRevealBonus} extra hidden clue${bonus.scoutRevealBonus > 1 ? 's' : ''}`);
  if (bonus.scoutFirstActionRevealBonus > 0)
    lines.push(`First Scout of battle reveals ${bonus.scoutFirstActionRevealBonus} additional clue`);
  if (bonus.cueBonusFlatBonus > 0)
    lines.push(`Correct Cue empowers stabilizing actions further (+${bonus.cueBonusFlatBonus} bonus)`);
  if (bonus.reassessAfterStabilizeBonus > 0)
    lines.push(`Reassess after Stabilize restores +${bonus.reassessAfterStabilizeBonus} Stability`);
  if (bonus.startApBonus > 0)
    lines.push(`Start battle with +${bonus.startApBonus} AP`);
  return lines;
}
