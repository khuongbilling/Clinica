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
    { level: 20, name: 'Compassion Chain', description: 'Support-focused heroes restore additional Stability when completing a Care Pathway step.', requirements: TIER_20_REQ },
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
    { level: 10, name: 'Flexible Practice', description: 'A small once-per-battle bonus to Assess, Stabilize, Treat, or Reassess.', requirements: TIER_10_REQ },
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
    case 'alchemist': return 'alchemist';
    default: return DEFAULT_CLASS_ID;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Specialization paths — unlocked after Lv30 is claimed for that class.
// Each class offers 2–3 named branches; a player picks one permanently
// per class. The choice is written to PlayerState.class_specialization.
// ─────────────────────────────────────────────────────────────────────────────

export interface ClassSpecialization {
  id: string;
  label: string;          // short fantasy title (e.g. "Triage Commander")
  fantasyTitle: string;   // displayed title on the branch card
  careerPath: string;     // modern department it resonates with
  description: string;    // 1–2 sentence player-facing description
  battleBonusLabel: string; // short summary of the extra battle bonus
  icon: string;           // Ionicons glyph
}

export const CLASS_SPECIALIZATIONS: Record<ClassId, ClassSpecialization[]> = {
  guardian: [
    {
      id: 'triage_commander',
      label: 'Triage Commander',
      fantasyTitle: 'Triage Commander',
      careerPath: 'Nursing / Leadership',
      description: 'You direct the ward with authority — every protector on your team holds their ground longer under your command.',
      battleBonusLabel: 'Shields regenerate +5 flat each turn; +1 extra AP at battle start.',
      icon: 'flag',
    },
    {
      id: 'intervention_specialist',
      label: 'Intervention Specialist',
      fantasyTitle: 'Intervention Specialist',
      careerPath: 'Medicine',
      description: 'You meet every danger with a precise, focused counter — incoming instability is blunted further and every strike hits harder.',
      battleBonusLabel: 'Incoming instability reduced an extra 5%; all strike actions 8% stronger.',
      icon: 'shield-checkmark',
    },
    {
      id: 'ward_shield',
      label: 'Ward Shield',
      fantasyTitle: 'Ward Shield',
      careerPath: 'Defense',
      description: 'You become an immovable barrier. Shields on the patient last longer, and partial damage is absorbed before Stability can fall too low.',
      battleBonusLabel: 'Shield skills 8% stronger; partial damage cannot push Stability below 8 (lethal damage still applies).',
      icon: 'shield',
    },
  ],
  seer: [
    {
      id: 'clinical_oracle',
      label: 'Clinical Oracle',
      fantasyTitle: 'Clinical Oracle',
      careerPath: 'Medicine',
      description: 'Every assessment reveals deeper truths — you see what others overlook, turning knowledge into decisive advantage.',
      battleBonusLabel: 'Assess reveals +2 extra clues; correct cue grants +2 AP.',
      icon: 'eye',
    },
    {
      id: 'mindweaver',
      label: 'Mindweaver',
      fantasyTitle: 'Mindweaver',
      careerPath: 'Mental Health',
      description: 'You read the patient\'s hidden psychological state, converting empathy into protection and foresight.',
      battleBonusLabel: 'Cue bonus flat +4 extra; reassess restores +6 stability.',
      icon: 'sparkles',
    },
    {
      id: 'observer',
      label: 'Observer',
      fantasyTitle: 'Observer',
      careerPath: 'Public Health',
      description: 'You track patterns across the whole ward. Each scouted clue empowers the team\'s next action.',
      battleBonusLabel: 'First scout reveals all visible clues instantly; stability mod +5%.',
      icon: 'search',
    },
  ],
  caretaker: [
    {
      id: 'community_healer',
      label: 'Community Healer',
      fantasyTitle: 'Community Healer',
      careerPath: 'Nursing / Public Health',
      description: 'Healing extends beyond the bedside — sustained care keeps the patient recovering turn after turn, and your care chain flows stronger.',
      battleBonusLabel: '+6 Stability restored automatically each enemy turn; Care Chain 8% stronger.',
      icon: 'people',
    },
    {
      id: 'sanctuary',
      label: 'Sanctuary',
      fantasyTitle: 'Sanctuary',
      careerPath: 'Mental Health',
      description: 'You create a space where trauma cannot reach. Partial damage is cushioned so Stability never falls too low — though overwhelming force still breaks through.',
      battleBonusLabel: 'Partial damage cushioned: Stability floor +8 (lethal damage still applies); reassess after stabilize +10.',
      icon: 'home-heart',
    },
    {
      id: 'lotus_recovery',
      label: 'Lotus Recovery',
      fantasyTitle: 'Lotus Recovery',
      careerPath: 'Deep Heal',
      description: 'The Lotus flows through every touch — sustained recovery that keeps the patient stable turn after turn.',
      battleBonusLabel: 'Stabilize mod +8% extra; +4 stability restored each enemy turn.',
      icon: 'flower',
    },
  ],
  scholar: [
    {
      id: 'grand_archivist',
      label: 'Grand Archivist',
      fantasyTitle: 'Grand Archivist',
      careerPath: 'Education',
      description: 'You have mastered every text. Correct clinical cues empower the whole team immediately with bonus AP and heightened stabilisation.',
      battleBonusLabel: 'Correct cue grants +1 AP immediately; cue stabilise bonus flat +3 extra.',
      icon: 'library',
    },
    {
      id: 'epidemic_warden',
      label: 'Epidemic Warden',
      fantasyTitle: 'Epidemic Warden',
      careerPath: 'Public Health',
      description: 'You see the spread before it happens. Corruption-reducing actions hit harder, and each scout exposes an extra hidden detail.',
      battleBonusLabel: 'Strike mod +5% extra; each scout action reveals +1 extra clue.',
      icon: 'earth',
    },
    {
      id: 'research_lead',
      label: 'Research Lead',
      fantasyTitle: 'Research Lead',
      careerPath: 'Medicine',
      description: 'Evidence is your weapon. Every battle is a study — and your synthesis of results improves each pass.',
      battleBonusLabel: 'Cue flat bonus +5 extra; strike and stabilize mods both +3%.',
      icon: 'flask',
    },
  ],
  alchemist: [
    {
      id: 'lotus_pharmacist',
      label: 'Lotus Pharmacist',
      fantasyTitle: 'Lotus Pharmacist',
      careerPath: 'Pharmacy',
      description: 'You mix every compound to perfection. Items deal more and cost less of your resources.',
      battleBonusLabel: 'Item mod +8% extra; first item use each battle costs 0 AP.',
      icon: 'beaker',
    },
    {
      id: 'innovation_alchemist',
      label: 'Innovation Alchemist',
      fantasyTitle: 'Innovation Alchemist',
      careerPath: 'Innovation',
      description: 'You push the boundaries of treatment. Strike and stabilize both benefit from your cutting-edge methods.',
      battleBonusLabel: 'Strike mod +5% extra; stabilize mod +5% extra.',
      icon: 'bulb',
    },
    {
      id: 'ward_artisan',
      label: 'Ward Artisan',
      fantasyTitle: 'Ward Artisan',
      careerPath: 'Design',
      description: 'Precision craft extends to every tool you carry. Each supply used restores a little stability as well.',
      battleBonusLabel: 'Item use restores +5 stability; care chain mod +8%.',
      icon: 'construct',
    },
  ],
  medic: [
    {
      id: 'code_calm_specialist',
      label: 'Code Calm Specialist',
      fantasyTitle: 'Code Calm Specialist',
      careerPath: 'Resilience',
      description: 'When the alarm sounds, you are already three steps ahead. Your calm is the team\'s anchor.',
      battleBonusLabel: 'Start battle with +1 AP extra; care chain mod +8%.',
      icon: 'pulse',
    },
    {
      id: 'field_commander',
      label: 'Field Commander',
      fantasyTitle: 'Field Commander',
      careerPath: 'Leadership',
      description: 'You lead from the front. Leader bonuses are amplified and the team\'s AP efficiency improves.',
      battleBonusLabel: '+1 extra AP at battle start; stabilize mod +5%.',
      icon: 'star',
    },
    {
      id: 'adaptive_healer',
      label: 'Adaptive Healer',
      fantasyTitle: 'Adaptive Healer',
      careerPath: 'Multi-Role',
      description: 'No situation stumps you. Strike, stabilize, and item effects all improve under your flexible hand.',
      battleBonusLabel: 'Strike, stabilize, and item mods all +5%; start AP +1.',
      icon: 'sync',
    },
  ],
};

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
  // ── Specialization bonus fields (set only when a specialization is chosen) ──
  // Guardian specs
  shieldRegenPerTurn: number;           // triage_commander: flat shield added each turn
  // Seer specs
  cueApRefund: number;                  // clinical_oracle: AP granted on correct cue answer
  // Caretaker specs
  stabilityFloor: number;              // sanctuary: stability cannot drop below this value
  stabilityPerEnemyTurn: number;       // lotus_recovery: flat stability each enemy turn
  // Scholar specs
  cueTeamApBonus: number;             // grand_archivist: AP bonus for team after correct cue
  // Alchemist specs
  itemFirstFree: boolean;             // lotus_pharmacist: first item use each battle costs 0 AP
  itemRestoreStability: number;       // ward_artisan: flat stability restored on item use
  // Medic specs (startApBonus reused for some)
  // (field_commander startApBonus +1 handled via startApBonus; adaptive_healer uses mods)
}

function neutralClassBonus(): ClassTreeBattleBonus {
  return {
    stabilizeMod: 1, strikeMod: 1, shieldMod: 1, itemMod: 1, careChainMod: 1,
    incomingDamageReduction: 0, scoutRevealBonus: 0, scoutFirstActionRevealBonus: 0,
    cueBonusFlatBonus: 0, reassessAfterStabilizeBonus: 0, startApBonus: 0,
    shieldRegenPerTurn: 0,
    cueApRefund: 0,
    stabilityFloor: 0,
    stabilityPerEnemyTurn: 0,
    cueTeamApBonus: 0,
    itemFirstFree: false,
    itemRestoreStability: 0,
  };
}

const hasTier = (progress: number[], level: number) => progress.includes(level);

/**
 * Returns the combat bonus for the given class, claimed tier progress, and
 * optional chosen specialization (class_specialization[classId]).
 */
export function getClassTreeBattleBonuses(
  classId: ClassId,
  classProgress: number[],
  specialization?: string,
): ClassTreeBattleBonus {
  const b = neutralClassBonus();
  const t10 = hasTier(classProgress, 10);
  const t20 = hasTier(classProgress, 20);
  const t30 = hasTier(classProgress, 30);

  switch (classId) {
    case 'guardian':
      // Lv1 (automatic): incoming instability −5%, stabilize 3% stronger
      b.incomingDamageReduction = 0.05;
      b.stabilizeMod = 1.03;
      // Lv10: instability cut increases, first shield per battle is 8% stronger
      if (t10) { b.incomingDamageReduction = 0.08; b.shieldMod = 1.08; }
      // Lv20: shield skills generally stronger, incoming cut grows
      if (t20) { b.shieldMod = 1.12; b.incomingDamageReduction = 0.10; }
      // Lv30: Triage Wall — full defensive suite at maximum
      if (t30) { b.incomingDamageReduction = 0.12; b.shieldMod = 1.15; b.stabilizeMod = 1.06; }
      // Specialization bonuses
      if (specialization === 'triage_commander') { b.shieldRegenPerTurn = 5; b.startApBonus += 1; }
      if (specialization === 'intervention_specialist') { b.incomingDamageReduction += 0.05; b.strikeMod = 1.08; }
      if (specialization === 'ward_shield') { b.shieldMod += 0.08; b.stabilityFloor = 8; }
      break;

    case 'seer':
      // Lv1: scout reveals +1 extra clue
      b.scoutRevealBonus = 1;
      // Lv10: first scout of battle reveals +2 additional clues
      if (t10) { b.scoutFirstActionRevealBonus = 2; }
      // Lv20: correct cue empowers further (+3 flat), scout reveals +2
      if (t20) { b.cueBonusFlatBonus = 3; b.scoutRevealBonus = 2; }
      // Lv30: cue flat 5, scout reveal 3, reassess bonus unlocked
      if (t30) { b.cueBonusFlatBonus = 5; b.scoutRevealBonus = 3; b.reassessAfterStabilizeBonus = 4; }
      // Specialization bonuses
      if (specialization === 'clinical_oracle') { b.scoutRevealBonus += 2; b.cueApRefund = 2; }
      if (specialization === 'mindweaver') { b.cueBonusFlatBonus += 4; b.reassessAfterStabilizeBonus += 6; }
      if (specialization === 'observer') { b.scoutFirstActionRevealBonus += 99; b.stabilizeMod = 1.05; } // 99 = reveal all visible
      break;

    case 'caretaker':
      // Lv1: stabilize 5% stronger
      b.stabilizeMod = 1.05;
      // Lv10: reassess after stabilize restores flat +5 stability
      if (t10) { b.reassessAfterStabilizeBonus = 5; }
      // Lv20: stabilize 10% stronger, reassess bonus grows
      if (t20) { b.stabilizeMod = 1.10; b.reassessAfterStabilizeBonus = 8; }
      // Lv30: stabilize 14% stronger, reassess 12, care chain amplified
      if (t30) { b.stabilizeMod = 1.14; b.reassessAfterStabilizeBonus = 12; b.careChainMod = 1.08; }
      // Specialization bonuses
      if (specialization === 'community_healer') { b.careChainMod += 0.08; b.stabilityPerEnemyTurn = 6; }
      if (specialization === 'sanctuary') { b.stabilityFloor = 8; b.reassessAfterStabilizeBonus += 10; }
      if (specialization === 'lotus_recovery') { b.stabilizeMod += 0.08; b.stabilityPerEnemyTurn = 4; }
      break;

    case 'scholar':
      // Lv1: correct cue grants +2 cueBonusStabilize
      b.cueBonusFlatBonus = 2;
      // Lv10: cue flat +4, strike 3% stronger
      if (t10) { b.cueBonusFlatBonus = 4; b.strikeMod = 1.03; }
      // Lv20: cue flat +5, strike 5% stronger, one free re-read (reassessBonus)
      if (t20) { b.cueBonusFlatBonus = 5; b.strikeMod = 1.05; b.reassessAfterStabilizeBonus = 3; }
      // Lv30: cue flat +6, strike 8%, cue AP refund
      if (t30) { b.cueBonusFlatBonus = 6; b.strikeMod = 1.08; b.cueApRefund = 1; }
      // Specialization bonuses
      if (specialization === 'grand_archivist') { b.cueBonusFlatBonus += 3; b.cueTeamApBonus = 1; }
      if (specialization === 'epidemic_warden') { b.strikeMod += 0.05; b.scoutRevealBonus += 1; }
      if (specialization === 'research_lead') { b.cueBonusFlatBonus += 5; b.strikeMod += 0.03; b.stabilizeMod = 1.03; }
      break;

    case 'alchemist':
      // Lv1: clinical supplies 8% stronger, treatment strikes 3% stronger
      b.itemMod = 1.08;
      b.strikeMod = 1.03;
      // Lv10: supplies 12% stronger, strikes 6%
      if (t10) { b.itemMod = 1.12; b.strikeMod = 1.06; }
      // Lv20: supplies 15%, stabilize 5%, strikes 8%
      if (t20) { b.itemMod = 1.15; b.stabilizeMod = 1.05; b.strikeMod = 1.08; }
      // Lv30: supplies 18%, stabilize 8%, strikes 10%
      if (t30) { b.itemMod = 1.18; b.stabilizeMod = 1.08; b.strikeMod = 1.10; }
      // Specialization bonuses
      if (specialization === 'lotus_pharmacist') { b.itemMod += 0.08; b.itemFirstFree = true; }
      if (specialization === 'innovation_alchemist') { b.strikeMod += 0.05; b.stabilizeMod += 0.05; }
      if (specialization === 'ward_artisan') { b.itemRestoreStability = 5; b.careChainMod = 1.08; }
      break;

    case 'medic':
      // Lv1: Care Chain completion 8% stronger
      b.careChainMod = 1.08;
      // Lv10: chain 12%, start +1 AP
      if (t10) { b.careChainMod = 1.12; b.startApBonus = 1; }
      // Lv20: chain 15%, start +1 AP
      if (t20) { b.careChainMod = 1.15; b.startApBonus = 1; }
      // Lv30: chain 20%, start +2 AP
      if (t30) { b.careChainMod = 1.20; b.startApBonus = 2; }
      // Specialization bonuses
      if (specialization === 'code_calm_specialist') { b.startApBonus += 1; b.careChainMod += 0.08; }
      if (specialization === 'field_commander') { b.startApBonus += 1; b.stabilizeMod = 1.05; }
      if (specialization === 'adaptive_healer') { b.strikeMod = 1.05; b.stabilizeMod = 1.05; b.itemMod = 1.05; b.startApBonus += 1; }
      break;

    default:
      break;
  }
  return b;
}

// Helper alias used when computing the "stabilize per enemy turn" field
// (caretaker lotus_recovery / community_healer specializations).
// Renamed from field 'stabilityPerEnemyTurn' on the bonus object to avoid
// a naming collision with future stabilize action types.
function getStabilityPerEnemyTurn(b: ClassTreeBattleBonus): number {
  return b.stabilityPerEnemyTurn ?? 0;
}
// Expose as module utility for battle.ts callers if needed.
export { getStabilityPerEnemyTurn };

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
    lines.push(`Care Pathway completion ${Math.round((bonus.careChainMod - 1) * 100)}% stronger`);
  if (bonus.scoutRevealBonus > 0 && bonus.scoutRevealBonus < 99)
    lines.push(`Assess reveals ${bonus.scoutRevealBonus} extra hidden clue${bonus.scoutRevealBonus > 1 ? 's' : ''}`);
  if (bonus.scoutFirstActionRevealBonus > 0 && bonus.scoutFirstActionRevealBonus < 99)
    lines.push(`First Assess of battle reveals ${bonus.scoutFirstActionRevealBonus} additional clue${bonus.scoutFirstActionRevealBonus > 1 ? 's' : ''}`);
  if (bonus.scoutFirstActionRevealBonus >= 99)
    lines.push('First Assess of battle reveals all visible clues instantly');
  if (bonus.cueBonusFlatBonus > 0)
    lines.push(`Correct Cue empowers stabilizing actions further (+${bonus.cueBonusFlatBonus} bonus)`);
  if (bonus.reassessAfterStabilizeBonus > 0)
    lines.push(`Reassess after Stabilize restores +${bonus.reassessAfterStabilizeBonus} Stability`);
  if (bonus.startApBonus > 0)
    lines.push(`Start battle with +${bonus.startApBonus} AP`);
  // Specialization bonus descriptions
  if (bonus.shieldRegenPerTurn > 0)
    lines.push(`Shields regenerate +${bonus.shieldRegenPerTurn} flat each turn`);
  if (bonus.cueApRefund > 0)
    lines.push(`Correct Clinical Cue refunds +${bonus.cueApRefund} AP`);
  if (bonus.stabilityFloor > 0)
    lines.push(`Stability cannot drop below ${bonus.stabilityFloor}`);
  if (bonus.stabilityPerEnemyTurn > 0)
    lines.push(`+${bonus.stabilityPerEnemyTurn} Stability restored each enemy turn`);
  if (bonus.cueTeamApBonus > 0)
    lines.push(`Correct Cue grants +${bonus.cueTeamApBonus} AP immediately (Grand Archivist)`);
  if (bonus.itemFirstFree)
    lines.push('First item use each battle costs 0 AP');
  if (bonus.itemRestoreStability > 0)
    lines.push(`Item use restores +${bonus.itemRestoreStability} Stability`);
  return lines;
}
