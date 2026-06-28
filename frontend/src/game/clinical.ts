/**
 * Clinical Reasoning Layer for Clinica: Kingdom of Healing
 *
 * Provides clinical-appropriateness rules, care-chain progression,
 * star objectives, reward scaling, feedback intensity tuning,
 * and beginner handicap support.
 *
 * Designed as an ADDITIVE layer on top of the existing battle engine —
 * the original HeroSkill/Item/Enemy interfaces are unchanged. Clinical
 * metadata is looked up by id/name from this module so we never break
 * existing data flows.
 */

// ------------------------------------------------------------
// LEARNING PROFILE
// ------------------------------------------------------------

export type LearningProfile =
  | 'nonmedical'           // legacy id — maps to curious
  | 'preNursing'
  | 'nursingStudent'
  | 'nclexPrep'
  | 'healthcareProfessional'
  // new audience-specific profiles
  | 'rpg'
  | 'cozy'
  | 'curious'
  | 'teen'
  | 'professional';       // alias for healthcareProfessional

export type FeedbackLevel = 'guided' | 'supportive' | 'standard' | 'minimal' | 'expert';

export const FEEDBACK_ORDER: FeedbackLevel[] = ['guided', 'supportive', 'standard', 'minimal', 'expert'];

export function getInitialFeedbackLevel(profile: LearningProfile | undefined): FeedbackLevel {
  switch (profile) {
    case 'rpg':
    case 'cozy':
    case 'curious':
    case 'teen':
    case 'nonmedical': return 'guided';
    case 'preNursing': return 'supportive';
    case 'nursingStudent': return 'standard';
    case 'nclexPrep': return 'minimal';
    case 'professional':
    case 'healthcareProfessional': return 'expert';
    default: return 'supportive';
  }
}

function shiftFeedback(level: FeedbackLevel, steps: number): FeedbackLevel {
  const idx = FEEDBACK_ORDER.indexOf(level);
  return FEEDBACK_ORDER[Math.min(idx + steps, FEEDBACK_ORDER.length - 1)];
}

export function getActiveFeedbackLevel(
  profile: LearningProfile | undefined,
  enemyName: string,
  enemyMastery: Record<string, number> | undefined,
  chapter: number,
): FeedbackLevel {
  const base = getInitialFeedbackLevel(profile);
  const mastery = (enemyMastery && enemyMastery[enemyName]) || 0;

  if (chapter >= 4) return shiftFeedback(base, 2);
  if (chapter >= 2 || mastery >= 2) return shiftFeedback(base, 1);
  return base;
}

// ------------------------------------------------------------
// HANDICAP
// ------------------------------------------------------------

export interface Handicap {
  startingStabilityBonus: number;
  enemyDamageReduction: number;
  revealOneExtraClue: boolean;
  stricterStars: boolean;
}

export function getStartingHandicap(profile: LearningProfile | undefined): Handicap {
  switch (profile) {
    case 'rpg':
    case 'cozy':
    case 'curious':
    case 'teen':
    case 'nonmedical':
      return { startingStabilityBonus: 15, enemyDamageReduction: 5, revealOneExtraClue: true, stricterStars: false };
    case 'preNursing':
      return { startingStabilityBonus: 10, enemyDamageReduction: 3, revealOneExtraClue: false, stricterStars: false };
    case 'nclexPrep':
    case 'professional':
    case 'healthcareProfessional':
      return { startingStabilityBonus: 0, enemyDamageReduction: 0, revealOneExtraClue: false, stricterStars: true };
    default:
      return { startingStabilityBonus: 0, enemyDamageReduction: 0, revealOneExtraClue: false, stricterStars: false };
  }
}

// ------------------------------------------------------------
// CHAPTER FORGIVENESS
// ------------------------------------------------------------

export interface ChapterForgiveness {
  poorFitModifier: number;
  weakModifier: number;
  enemyDamageMultiplier: number;
  allowLuckyWin: boolean;
}

export function getChapterForgiveness(chapter: number): ChapterForgiveness {
  if (chapter === 1) return { poorFitModifier: 0.35, weakModifier: 0.6, enemyDamageMultiplier: 0.85, allowLuckyWin: true };
  if (chapter === 2) return { poorFitModifier: 0.25, weakModifier: 0.5, enemyDamageMultiplier: 1.0, allowLuckyWin: true };
  return { poorFitModifier: 0.1, weakModifier: 0.35, enemyDamageMultiplier: 1.1, allowLuckyWin: false };
}

// ------------------------------------------------------------
// ACTION CLINICAL METADATA
// ------------------------------------------------------------

export type ChainRole = 'Scout' | 'Stabilize' | 'Counter' | 'Protect' | 'Reassess' | 'Command';

export interface ActionClinical {
  clinicalTags: string[];
  requiredClues?: string[]; // case-insensitive substrings of revealed clue labels
  appropriateForSystems?: string[];
  appropriateForDiseases?: string[];
  inappropriateForSystems?: string[];
  inappropriateForDiseases?: string[];
  unsafeIfSystems?: string[];
  unsafeIfClues?: string[];
  unsafeIfMissingClues?: string[];
  chainRoles?: ChainRole[];
  // Optional activation gate (used for Rapid Response style)
  conditionalRequiresLowStability?: number; // if defined, action is "weak" when stability is above this
}

// --- Hero skill metadata (keyed by skill id) ---
export const SKILL_CLINICAL: Record<string, ActionClinical> = {
  breath_of_dawn: {
    clinicalTags: ['airway', 'oxygenation', 'respiratory', 'assessment'],
    appropriateForSystems: ['Air'],
    chainRoles: ['Stabilize', 'Counter'],
  },
  lantern_of_clues: {
    clinicalTags: ['assessment'],
    chainRoles: ['Scout'],
  },
  rapid_response: {
    clinicalTags: ['escalation', 'acute deterioration', 'emergency'],
    chainRoles: ['Command', 'Stabilize'],
    conditionalRequiresLowStability: 40,
  },
  vital_ward: {
    clinicalTags: ['assessment', 'reassessment', 'general support'],
    chainRoles: ['Scout', 'Reassess'],
  },
  rally_bell: {
    clinicalTags: ['escalation', 'command'],
    chainRoles: ['Command'],
  },
  pattern_sight: {
    clinicalTags: ['assessment', 'neurovascular assessment'],
    chainRoles: ['Scout', 'Counter'],
  },
  focused_lens: {
    clinicalTags: ['assessment', 'reassessment'],
    chainRoles: ['Scout', 'Reassess'],
  },
  safety_circle: {
    clinicalTags: ['fall prevention', 'safety'],
    chainRoles: ['Protect'],
  },
  isolation_seal: {
    clinicalTags: ['infection isolation', 'transmission prevention'],
    appropriateForSystems: ['Fire', 'Protection'],
    chainRoles: ['Protect', 'Counter'],
  },
  threadwatch: {
    clinicalTags: ['assessment', 'reassessment'],
    chainRoles: ['Scout', 'Reassess'],
  },
  codex_link: {
    clinicalTags: ['assessment'],
    chainRoles: ['Scout', 'Counter'],
  },
  guardians_touch: {
    clinicalTags: ['general support', 'comfort'],
    chainRoles: ['Stabilize', 'Counter'],
  },
  mend: {
    clinicalTags: ['skin integrity', 'wound care', 'protect', 'general support', 'comfort'],
    appropriateForSystems: ['Protection'],
    chainRoles: ['Counter', 'Stabilize'],
  },
  reassess: {
    clinicalTags: ['reassessment', 'assessment'],
    chainRoles: ['Reassess', 'Scout'],
  },
  critical_response: {
    clinicalTags: ['escalation', 'acute deterioration', 'emergency'],
    chainRoles: ['Stabilize', 'Command'],
    conditionalRequiresLowStability: 50,
  },
  river_surge: {
    clinicalTags: ['circulation', 'fluid resuscitation'],
    appropriateForSystems: ['River'],
    unsafeIfClues: ['Crackles', 'Leg Swelling', 'Weight +'],
    chainRoles: ['Counter', 'Stabilize'],
  },
  infection_scan: {
    clinicalTags: ['assessment', 'infection assessment'],
    chainRoles: ['Scout'],
  },
  purity_mark: {
    clinicalTags: ['antimicrobial', 'infection treatment'],
    appropriateForSystems: ['Fire'],
    chainRoles: ['Counter'],
  },
  skin_shield: {
    clinicalTags: ['skin integrity', 'protect'],
    chainRoles: ['Protect'],
  },
  mind_anchor: {
    clinicalTags: ['orientation', 'therapeutic communication', 'neuro', 'comfort'],
    appropriateForSystems: ['Mind'],
    chainRoles: ['Counter', 'Stabilize'],
  },
  error_ward: {
    clinicalTags: ['safety', 'medication safety'],
    chainRoles: ['Protect'],
  },
};

// --- Item metadata (keyed by item.name as used in inventory) ---
export const ITEM_CLINICAL: Record<string, ActionClinical> = {
  'Albuterol Mist': {
    clinicalTags: ['bronchospasm', 'wheezing', 'airway', 'respiratory'],
    requiredClues: ['Wheezing'],
    appropriateForSystems: ['Air'],
    chainRoles: ['Counter'],
  },
  'Glucose Gel': {
    clinicalTags: ['glucose replacement', 'hypoglycemia'],
    requiredClues: ['Glucose'], // any clue containing "glucose" (e.g., "Glucose 48", "Low Glucose")
    appropriateForSystems: ['Energy'],
    chainRoles: ['Counter'],
  },
  'Fluid Bolus': {
    clinicalTags: ['circulation', 'fluid resuscitation'],
    requiredClues: ['BP'],
    appropriateForSystems: ['River'],
    unsafeIfClues: ['Crackles', 'Leg Swelling', 'Weight +'],
    chainRoles: ['Counter', 'Stabilize'],
  },
  'Isolation Kit': {
    clinicalTags: ['infection isolation', 'transmission prevention'],
    appropriateForSystems: ['Fire'],
    chainRoles: ['Protect'],
  },
  'Lab Token': {
    clinicalTags: ['assessment'],
    chainRoles: ['Scout'],
  },
};

// --- Temp action metadata ---
export const TEMP_CLINICAL: Record<string, ActionClinical> = {
  open_airflow: {
    clinicalTags: ['airway', 'oxygenation', 'respiratory'],
    appropriateForSystems: ['Air'],
    chainRoles: ['Counter', 'Stabilize'],
  },
  containment_order: {
    clinicalTags: ['infection isolation', 'transmission prevention'],
    appropriateForSystems: ['Fire'],
    chainRoles: ['Protect'],
  },
};

// --- Call option metadata ---
export const CALL_CLINICAL: Record<string, ActionClinical> = {
  call_respiratory: {
    clinicalTags: ['airway', 'oxygenation', 'respiratory', 'escalation'],
    appropriateForSystems: ['Air'],
    chainRoles: ['Command'],
  },
  call_pharmacy: {
    clinicalTags: ['escalation', 'command'],
    chainRoles: ['Command'],
  },
  call_rapid: {
    clinicalTags: ['acute deterioration', 'escalation', 'emergency'],
    chainRoles: ['Command', 'Stabilize'],
    conditionalRequiresLowStability: 35,
  },
  call_infection: {
    clinicalTags: ['infection isolation', 'transmission prevention', 'escalation'],
    appropriateForSystems: ['Fire'],
    chainRoles: ['Command', 'Protect'],
  },
};

// ------------------------------------------------------------
// ENEMY CLINICAL METADATA
// ------------------------------------------------------------

export interface EnemyClinical {
  clinicalCategory: string;
  diseaseTags: string[];
  allowedActionTags: string[];
  strongActionTags: string[];
  weakActionTags: string[];
  inappropriateActionTags: string[];
  unsafeActionTags?: string[];
  treatmentChain: ChainRole[];
  preferredChainTags: string[];
  weaknesses: string[]; // system types this enemy is weak to
  resistances: string[];
  starTurnLimit: number;
  rewardBase: number;
  chapter: 1 | 2 | 3;
}

const ASSESS_CHAIN: ChainRole[] = ['Scout', 'Stabilize', 'Counter', 'Reassess'];

export const ENEMY_CLINICAL: Record<string, EnemyClinical> = {
  air_sprite: {
    clinicalCategory: 'Respiratory',
    diseaseTags: ['asthma', 'bronchospasm', 'wheezing', 'respiratory distress'],
    allowedActionTags: ['airway', 'oxygenation', 'respiratory', 'bronchospasm', 'wheezing', 'assessment', 'reassessment', 'escalation', 'general support'],
    strongActionTags: ['wheezing', 'bronchospasm', 'airway', 'oxygenation'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['skin integrity', 'fall prevention', 'infection isolation', 'glucose replacement', 'fluid resuscitation', 'antimicrobial'],
    unsafeActionTags: [],
    treatmentChain: ASSESS_CHAIN,
    preferredChainTags: ['assessment', 'oxygenation', 'bronchospasm', 'reassessment', 'airway'],
    weaknesses: ['Air'],
    resistances: ['Fire', 'Mind'],
    starTurnLimit: 5,
    rewardBase: 25,
    chapter: 1,
  },
  river_sludge: {
    clinicalCategory: 'Hypovolemia',
    diseaseTags: ['hypovolemia', 'low perfusion', 'shock'],
    allowedActionTags: ['circulation', 'fluid resuscitation', 'assessment', 'reassessment', 'escalation', 'general support'],
    strongActionTags: ['circulation', 'fluid resuscitation'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['bronchospasm', 'antimicrobial', 'glucose replacement', 'orientation', 'skin integrity', 'fall prevention'],
    unsafeActionTags: [],
    treatmentChain: ASSESS_CHAIN,
    preferredChainTags: ['assessment', 'circulation', 'fluid resuscitation', 'reassessment'],
    weaknesses: ['River'],
    resistances: ['Fire', 'Mind'],
    starTurnLimit: 5,
    rewardBase: 25,
    chapter: 1,
  },
  energy_lock: {
    clinicalCategory: 'Endocrine',
    diseaseTags: ['hypoglycemia', 'low glucose'],
    allowedActionTags: ['glucose replacement', 'hypoglycemia', 'assessment', 'reassessment', 'escalation'],
    strongActionTags: ['glucose replacement', 'hypoglycemia'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['bronchospasm', 'antimicrobial', 'fluid resuscitation', 'infection isolation', 'skin integrity', 'fall prevention'],
    unsafeActionTags: [],
    treatmentChain: ['Scout', 'Counter', 'Reassess'],
    preferredChainTags: ['assessment', 'glucose replacement', 'hypoglycemia', 'reassessment'],
    weaknesses: ['Energy'],
    resistances: ['Air', 'Fire'],
    starTurnLimit: 5,
    rewardBase: 25,
    chapter: 1,
  },
  fire_imp: {
    clinicalCategory: 'Infection',
    diseaseTags: ['infection', 'cellulitis', 'localized infection'],
    allowedActionTags: ['infection isolation', 'transmission prevention', 'antimicrobial', 'infection treatment', 'infection assessment', 'assessment', 'reassessment', 'escalation'],
    strongActionTags: ['infection isolation', 'antimicrobial', 'infection treatment'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['bronchospasm', 'glucose replacement', 'fluid resuscitation', 'orientation'],
    unsafeActionTags: [],
    treatmentChain: ['Scout', 'Protect', 'Counter', 'Reassess'],
    preferredChainTags: ['assessment', 'infection isolation', 'antimicrobial', 'reassessment'],
    weaknesses: ['Fire', 'Protection'],
    resistances: ['Air'],
    starTurnLimit: 6,
    rewardBase: 30,
    chapter: 1,
  },
  mind_fog: {
    clinicalCategory: 'Neuro',
    diseaseTags: ['delirium', 'altered mental status', 'fall risk'],
    allowedActionTags: ['orientation', 'therapeutic communication', 'safety', 'fall prevention', 'neuro', 'assessment', 'reassessment'],
    strongActionTags: ['orientation', 'therapeutic communication', 'fall prevention'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['bronchospasm', 'glucose replacement', 'fluid resuscitation', 'antimicrobial'],
    unsafeActionTags: [],
    treatmentChain: ['Scout', 'Protect', 'Counter', 'Reassess'],
    preferredChainTags: ['assessment', 'orientation', 'fall prevention', 'reassessment'],
    weaknesses: ['Mind', 'Protection'],
    resistances: ['Fire'],
    starTurnLimit: 6,
    rewardBase: 28,
    chapter: 1,
  },
  septara_seed: {
    clinicalCategory: 'Sepsis',
    diseaseTags: ['sepsis', 'systemic infection', 'shock'],
    allowedActionTags: ['infection isolation', 'antimicrobial', 'fluid resuscitation', 'circulation', 'assessment', 'reassessment', 'escalation'],
    strongActionTags: ['antimicrobial', 'fluid resuscitation', 'infection isolation', 'escalation'],
    weakActionTags: ['general support'],
    inappropriateActionTags: ['glucose replacement', 'orientation', 'fall prevention', 'skin integrity', 'bronchospasm'],
    unsafeActionTags: [],
    treatmentChain: ['Scout', 'Stabilize', 'Counter', 'Reassess'],
    preferredChainTags: ['assessment', 'fluid resuscitation', 'antimicrobial', 'reassessment'],
    weaknesses: ['Fire', 'River'],
    resistances: ['Mind'],
    starTurnLimit: 6,
    rewardBase: 45,
    chapter: 2,
  },
  cardion_echo: {
    clinicalCategory: 'Cardiac',
    diseaseTags: ['heart failure', 'fluid overload', 'pulmonary edema'],
    allowedActionTags: ['oxygenation', 'airway', 'reassessment', 'assessment', 'escalation', 'general support'],
    strongActionTags: ['oxygenation', 'airway'],
    weakActionTags: ['general support'],
    inappropriateActionTags: ['bronchospasm', 'glucose replacement', 'orientation', 'fall prevention', 'antimicrobial'],
    unsafeActionTags: ['fluid resuscitation'], // critical: fluids worsen CHF
    treatmentChain: ['Scout', 'Stabilize', 'Counter', 'Reassess'],
    preferredChainTags: ['assessment', 'oxygenation', 'reassessment'],
    weaknesses: ['Air', 'River'],
    resistances: ['Fire'],
    starTurnLimit: 6,
    rewardBase: 40,
    chapter: 2,
  },
  glycora_spark: {
    clinicalCategory: 'Endocrine Crisis',
    diseaseTags: ['DKA', 'hyperglycemia', 'acid-base imbalance'],
    allowedActionTags: ['fluid resuscitation', 'assessment', 'reassessment', 'escalation', 'circulation'],
    strongActionTags: ['fluid resuscitation', 'assessment'],
    weakActionTags: ['general support'],
    inappropriateActionTags: ['bronchospasm', 'orientation', 'fall prevention', 'antimicrobial', 'glucose replacement'],
    unsafeActionTags: [],
    treatmentChain: ['Scout', 'Stabilize', 'Counter', 'Reassess'],
    preferredChainTags: ['assessment', 'fluid resuscitation', 'reassessment'],
    weaknesses: ['Energy', 'Storm'],
    resistances: ['Air'],
    starTurnLimit: 6,
    rewardBase: 45,
    chapter: 2,
  },
  pulmora_wisp: {
    clinicalCategory: 'Respiratory',
    diseaseTags: ['COPD', 'CO2 retention', 'air trapping'],
    allowedActionTags: ['airway', 'oxygenation', 'respiratory', 'assessment', 'reassessment', 'escalation', 'general support'],
    strongActionTags: ['airway', 'oxygenation'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['glucose replacement', 'fluid resuscitation', 'antimicrobial', 'orientation', 'fall prevention'],
    unsafeActionTags: [],
    treatmentChain: ASSESS_CHAIN,
    preferredChainTags: ['assessment', 'oxygenation', 'airway', 'reassessment'],
    weaknesses: ['Air'],
    resistances: ['Mind', 'Fire'],
    starTurnLimit: 6,
    rewardBase: 35,
    chapter: 2,
  },
  electrox_flicker: {
    clinicalCategory: 'Electrolyte',
    diseaseTags: ['hyperkalemia', 'rhythm disturbance'],
    allowedActionTags: ['assessment', 'reassessment', 'escalation', 'circulation', 'general support'],
    strongActionTags: ['assessment', 'circulation'],
    weakActionTags: ['general support'],
    inappropriateActionTags: ['bronchospasm', 'glucose replacement', 'antimicrobial', 'orientation', 'fall prevention'],
    unsafeActionTags: [],
    treatmentChain: ['Scout', 'Stabilize', 'Counter', 'Reassess'],
    preferredChainTags: ['assessment', 'circulation', 'reassessment'],
    weaknesses: ['Storm', 'River'],
    resistances: ['Fire'],
    starTurnLimit: 6,
    rewardBase: 40,
    chapter: 2,
  },
  lord_imbalance: {
    clinicalCategory: 'Multi-System',
    diseaseTags: ['multi-system failure', 'unstable', 'shock'],
    allowedActionTags: ['airway', 'oxygenation', 'circulation', 'fluid resuscitation', 'glucose replacement', 'orientation', 'escalation', 'assessment', 'reassessment', 'antimicrobial'],
    strongActionTags: ['airway', 'oxygenation', 'circulation', 'fluid resuscitation', 'escalation', 'glucose replacement'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['skin integrity'],
    unsafeActionTags: [],
    treatmentChain: ['Scout', 'Stabilize', 'Counter', 'Reassess'],
    preferredChainTags: ['assessment', 'airway', 'circulation', 'reassessment', 'escalation'],
    weaknesses: ['Air', 'River', 'Mind'],
    resistances: [],
    starTurnLimit: 8,
    rewardBase: 100,
    chapter: 3,
  },
};

// ------------------------------------------------------------
// APPROPRIATENESS EVALUATOR
// ------------------------------------------------------------

export type ActionStatus = 'locked' | 'unsafe' | 'inappropriate' | 'strong' | 'appropriate' | 'weak';

export interface EvaluationResult {
  status: ActionStatus;
  modifier: number;
  message: string;
}

const STATUS_BASE_MODIFIER: Record<ActionStatus, number> = {
  locked: 0,
  unsafe: -1,
  inappropriate: 0.25,
  weak: 0.5,
  appropriate: 1.0,
  strong: 1.5,
};

const STATUS_LABEL: Record<ActionStatus, string> = {
  locked: 'Locked',
  unsafe: 'Unsafe',
  inappropriate: 'Poor Fit',
  weak: 'Limited',
  appropriate: 'Reasonable',
  strong: 'Recommended',
};

const STATUS_COLOR: Record<ActionStatus, string> = {
  locked: '#5A5A5A',
  unsafe: '#EF4444',
  inappropriate: '#F59E0B',
  weak: '#9CA3AF',
  appropriate: '#E5E7EB',
  strong: '#D4AF37',
};

export function statusLabel(s: ActionStatus): string { return STATUS_LABEL[s]; }
export function statusColor(s: ActionStatus): string { return STATUS_COLOR[s]; }

function clueRevealedSubstr(revealedLabels: string[], target: string): boolean {
  const t = target.toLowerCase();
  return revealedLabels.some(l => l.toLowerCase().includes(t));
}

export function evaluateClinicalAppropriateness(
  action: ActionClinical | undefined,
  enemy: EnemyClinical | undefined,
  battleState: { revealedLabels: string[]; stability: number },
): EvaluationResult {
  if (!action || !enemy) {
    return { status: 'appropriate', modifier: 1.0, message: '' };
  }

  // 1. Required clue check
  if (action.requiredClues && action.requiredClues.length > 0) {
    const missing = action.requiredClues.filter(c => !clueRevealedSubstr(battleState.revealedLabels, c));
    if (missing.length > 0) {
      return { status: 'locked', modifier: 0, message: `Requires clue: ${missing.join(', ')}.` };
    }
  }

  // 2. Unsafe via revealed-clue trigger
  if (action.unsafeIfClues && action.unsafeIfClues.some(c => clueRevealedSubstr(battleState.revealedLabels, c))) {
    return { status: 'unsafe', modifier: STATUS_BASE_MODIFIER.unsafe, message: 'Unsafe given current clues.' };
  }

  // 3. Unsafe via enemy tags
  const actTags = action.clinicalTags || [];
  if (enemy.unsafeActionTags && enemy.unsafeActionTags.some(t => actTags.includes(t))) {
    return { status: 'unsafe', modifier: STATUS_BASE_MODIFIER.unsafe, message: 'This action could worsen the patient.' };
  }

  // 4. Inappropriate
  if (enemy.inappropriateActionTags.some(t => actTags.includes(t))) {
    return { status: 'inappropriate', modifier: STATUS_BASE_MODIFIER.inappropriate, message: 'Does not fit this clinical problem.' };
  }

  // 5. Strong
  if (enemy.strongActionTags.some(t => actTags.includes(t))) {
    return { status: 'strong', modifier: STATUS_BASE_MODIFIER.strong, message: 'Fits the clinical problem well.' };
  }

  // 6. Allowed → appropriate
  if (enemy.allowedActionTags.some(t => actTags.includes(t))) {
    // Conditional gating: actions like Rapid Response should only be "appropriate" when stability is low
    if (action.conditionalRequiresLowStability && battleState.stability > action.conditionalRequiresLowStability) {
      return { status: 'weak', modifier: STATUS_BASE_MODIFIER.weak, message: 'Reserved for acute deterioration.' };
    }
    return { status: 'appropriate', modifier: STATUS_BASE_MODIFIER.appropriate, message: 'Clinically appropriate.' };
  }

  // 7. Default weak
  return { status: 'weak', modifier: STATUS_BASE_MODIFIER.weak, message: 'Limited relevance here.' };
}

// ------------------------------------------------------------
// SYSTEM / ELEMENT MATCH (with clinical relatedness)
// ------------------------------------------------------------

// Clinically related systems — oxygenation/circulation, glucose/mental status, etc.
export const RELATED_SYSTEMS: Record<string, string[]> = {
  Air: ['River', 'Protection'],
  River: ['Air', 'Storm'],
  Fire: ['Protection', 'River'],
  Energy: ['Mind', 'River'],
  Mind: ['Energy', 'Protection'],
  Storm: ['River', 'Mind'],
  Forge: ['Protection'],
  Protection: ['Forge', 'Fire', 'Mind'],
};

export function getSystemMatchModifier(systemType: string | undefined, enemy: EnemyClinical | undefined, enemyPrimarySystem?: string): number {
  if (!systemType || !enemy) return 1.0;
  if (systemType === 'Universal') return 0.75;
  if (enemy.weaknesses.includes(systemType)) return 1.5;
  if (enemy.resistances.includes(systemType)) return 0.5;
  const sys = enemyPrimarySystem || enemy.weaknesses[0] || '';
  const related = RELATED_SYSTEMS[sys] || [];
  if (related.includes(systemType)) return 1.0;
  return 0.25;
}

// Treatment is more effective when patient is more stable.
export function getTreatmentStabilityModifier(stability: number): number {
  if (stability >= 80) return 1.1;
  if (stability >= 40) return 1.0;
  if (stability >= 20) return 0.85;
  return 0.7;
}

// Dynamic AP each turn based on patient state.
export function getTurnAP(stability: number, corruption: number, chapter: number, modifiers: { allowHighStabilityBonus?: boolean; preventNextAPLoss?: boolean } = {}): number {
  let ap = 4;
  if (stability >= 80 && modifiers.allowHighStabilityBonus) ap += 1;
  if (stability < 40) ap -= 1;
  if (stability < 20) ap -= 1;
  if (chapter >= 2 && corruption >= 80) ap -= 1;
  if (modifiers.preventNextAPLoss) {
    ap = Math.max(ap, 4);
    modifiers.preventNextAPLoss = false;
  }
  return Math.max(2, Math.min(ap, 5));
}

export function apMessage(ap: number): string {
  if (ap >= 5) return 'The patient is stable and the team is well coordinated. 5 AP available.';
  if (ap >= 4) return 'The team has full coordination. 4 AP available.';
  if (ap >= 3) return 'The situation is unstable. The team has less time. 3 AP available.';
  return 'Critical condition. Prioritize emergency actions. 2 AP available.';
}

export function getDangerLevel(stability: number, corruption: number): 'controlled' | 'guarded' | 'unstable' | 'critical' {
  if (stability < 20 || corruption >= 85) return 'critical';
  if (stability < 40 || corruption >= 70) return 'unstable';
  if (stability < 60 || corruption >= 40) return 'guarded';
  return 'controlled';
}

// ------------------------------------------------------------
// CORRUPTION-BASED STABILIZATION DAMPER
// ------------------------------------------------------------

export function getStabilizationModifier(corruption: number): number {
  if (corruption >= 70) return 0.5;
  if (corruption >= 40) return 0.75;
  return 1.0;
}

export function getEnemyDamage(corruption: number, baseInstability: number): number {
  // Scales the enemy's base instability with corruption pressure
  if (corruption >= 70) return Math.round(baseInstability * 1.5);
  if (corruption >= 40) return Math.round(baseInstability * 1.15);
  return baseInstability;
}

// ------------------------------------------------------------
// CARE CHAIN
// ------------------------------------------------------------

export interface ChainState {
  progress: ChainRole[]; // ordered steps already completed
  completed: boolean;
}

export function emptyChain(): ChainState { return { progress: [], completed: false }; }

export function canAdvanceChain(
  action: ActionClinical | undefined,
  enemy: EnemyClinical | undefined,
  chain: ChainState,
  systemType: string | undefined,
): ChainRole | null {
  if (!action || !enemy) return null;
  if (chain.completed) return null;

  const nextStep = enemy.treatmentChain[chain.progress.length];
  if (!nextStep) return null;

  const roles = action.chainRoles || [];
  const roleMatches = roles.includes(nextStep);
  if (!roleMatches) return null;

  const tagMatches = (action.clinicalTags || []).some(t => enemy.preferredChainTags.includes(t));
  const systemMatches = systemType ? enemy.weaknesses.includes(systemType) : false;
  const universal = systemType === 'Universal';

  if (tagMatches || systemMatches || universal) {
    return nextStep;
  }
  return null;
}

export const CHAIN_BONUSES = {
  stepCorruptionDamage: 5,
  fullChainCorruptionDamage: 20,
  fullChainStabilityBonus: 15,
  fullChainRewardBonus: 10, // shards
};

// ------------------------------------------------------------
// REWARDS / STARS
// ------------------------------------------------------------

export interface StarRules {
  turnLimit: number;
  allowOnePoorFit: boolean;
  requireFullChainForStar2: boolean;
  requireReassess?: boolean;
}

export function getStarRules(profile: LearningProfile | undefined, enemy: EnemyClinical | undefined): StarRules {
  const baseTurnLimit = enemy?.starTurnLimit || 5;
  switch (profile) {
    case 'rpg':
    case 'cozy':
    case 'curious':
    case 'teen':
    case 'nonmedical':
      return { turnLimit: baseTurnLimit + 2, allowOnePoorFit: true, requireFullChainForStar2: true };
    case 'preNursing':
      return { turnLimit: baseTurnLimit + 1, allowOnePoorFit: true, requireFullChainForStar2: true };
    case 'nclexPrep':
    case 'professional':
    case 'healthcareProfessional':
      return { turnLimit: Math.max(3, baseTurnLimit - 1), allowOnePoorFit: false, requireFullChainForStar2: true, requireReassess: true };
    default:
      return { turnLimit: baseTurnLimit, allowOnePoorFit: false, requireFullChainForStar2: true };
  }
}

export interface BattleScoring {
  won: boolean;
  fullChainCompleted: boolean;
  unsafeActionsUsed: number;
  poorFitActionsUsed: number;
  turnsTaken: number;
  reassessUsed: boolean;
  consultsUsed?: number;
  emergencyCallsUsed?: number;
  inappropriateConsultsUsed?: number;
  basicAidUses?: number;
}

export function computeStars(scoring: BattleScoring, rules: StarRules): { stars: number; details: string[] } {
  const details: string[] = [];
  let stars = 0;

  if (scoring.won) {
    stars++;
    details.push('Stabilized the patient.');
  }

  if (scoring.won && scoring.fullChainCompleted) {
    stars++;
    details.push('Completed the clinical care chain.');
  } else if (scoring.won) {
    details.push('Care chain incomplete.');
  }

  const efficient = scoring.turnsTaken <= rules.turnLimit;
  const safe = scoring.unsafeActionsUsed === 0;
  const poorOk = rules.allowOnePoorFit ? scoring.poorFitActionsUsed <= 1 : scoring.poorFitActionsUsed === 0;
  const reassessOk = !rules.requireReassess || scoring.reassessUsed;
  const consultsOk = (scoring.consultsUsed ?? 0) <= 1;
  const noEmergency = (scoring.emergencyCallsUsed ?? 0) === 0;
  const noInappropriate = (scoring.inappropriateConsultsUsed ?? 0) === 0;
  const lowBasicAid = (scoring.basicAidUses ?? 0) <= 2;

  if (scoring.won && efficient && safe && poorOk && reassessOk && consultsOk && noEmergency && noInappropriate && lowBasicAid) {
    stars++;
    details.push('Efficient and safe care.');
  }

  return { stars, details };
}

export function calculateRewards(baseReward: number, stars: number, fullChainCompleted: boolean): {
  base: number;
  starBonus: number;
  chainBonus: number;
  total: number;
} {
  const starBonus = stars * 5;
  const chainBonus = fullChainCompleted ? CHAIN_BONUSES.fullChainRewardBonus : 0;
  return { base: baseReward, starBonus, chainBonus, total: baseReward + starBonus + chainBonus };
}

// ------------------------------------------------------------
// FINAL EFFECT
// ------------------------------------------------------------

export function combineFinalEffect(args: {
  baseEffect: number;
  clinicalMod: number;
  systemMod: number;
  corruptionMod?: number; // only when stabilizing
  chapterModifier?: number; // applied on top of clinical
  chainBonus?: number;
}): number {
  const corr = args.corruptionMod ?? 1;
  const chap = args.chapterModifier ?? 1;
  return Math.round(args.baseEffect * args.clinicalMod * args.systemMod * corr * chap + (args.chainBonus || 0));
}

// Apply chapter forgiveness to clinical modifier for weak/inappropriate (early chapters are kinder)
export function applyChapterForgivenessToStatus(
  status: ActionStatus,
  baseClinicalMod: number,
  forgiveness: ChapterForgiveness,
): number {
  if (status === 'inappropriate') return forgiveness.poorFitModifier;
  if (status === 'weak') return forgiveness.weakModifier;
  return baseClinicalMod;
}

// ------------------------------------------------------------
// FEEDBACK MESSAGES
// ------------------------------------------------------------

export interface BattleMessageContext {
  feedbackLevel: FeedbackLevel;
  actionName: string;
  status: ActionStatus;
  systemModifier: number;
  effectAmount: number;
  effectType: 'corruption' | 'stability' | 'shield' | 'clue' | 'mixed';
  chainAdvanced: ChainRole | null;
  nextChainStep: ChainRole | null;
  fullChainCompleted: boolean;
  rationale?: string;
}

function effectivenessLabel(systemModifier: number, status: ActionStatus): string {
  if (status === 'unsafe') return 'Unsafe';
  if (status === 'inappropriate') return 'Poor fit';
  if (status === 'weak') return 'Limited effect';
  if (status === 'strong' && systemModifier > 1) return 'Super effective';
  if (status === 'strong') return 'Strong fit';
  return 'Effective';
}

export function generateBattleMessage(ctx: BattleMessageContext): string {
  const { feedbackLevel, actionName, status, effectAmount, effectType, chainAdvanced, nextChainStep, fullChainCompleted, rationale, systemModifier } = ctx;

  const eff = effectivenessLabel(systemModifier, status);
  const effectStr = effectType === 'clue' ? '' :
    effectType === 'stability' ? `Stability +${effectAmount}.` :
    effectType === 'corruption' ? `Disease Corruption -${effectAmount}.` :
    effectType === 'shield' ? `Shield ${effectAmount}%.` : '';

  if (feedbackLevel === 'expert') {
    return effectStr || `${eff}.`;
  }
  if (feedbackLevel === 'minimal') {
    return `${eff}. ${effectStr}`.trim();
  }
  if (feedbackLevel === 'standard') {
    const chainStr = chainAdvanced ? ` Chain advanced: ${chainAdvanced}.` : '';
    const fullChainStr = fullChainCompleted ? ' Complete care chain!' : '';
    return `${actionName}: ${eff}. ${effectStr}${chainStr}${fullChainStr}`.trim();
  }
  // supportive / guided
  const why = rationale ? ` ${rationale}` : '';
  const chainLine = chainAdvanced ? `\nClinical Chain advanced: ${chainAdvanced} complete.` : '';
  const nextStepLine = !fullChainCompleted && nextChainStep && chainAdvanced
    ? `\nNext: ${nextChainStep}.`
    : '';
  const fullChainLine = fullChainCompleted
    ? '\nComplete Care Chain: assess, support, treat, reassess.'
    : '';

  if (feedbackLevel === 'guided') {
    return `${eff}: ${actionName}.${why} ${effectStr}${chainLine}${nextStepLine}${fullChainLine}`.trim();
  }
  // supportive
  return `${eff}: ${actionName}. ${effectStr}${chainLine}${nextStepLine}${fullChainLine}`.trim();
}

// Build a short rationale string for guided/supportive levels
export function buildRationale(status: ActionStatus, action: ActionClinical | undefined, enemy: EnemyClinical | undefined): string | undefined {
  if (!action || !enemy) return undefined;
  if (status === 'strong') {
    const overlap = (action.clinicalTags || []).find(t => enemy.strongActionTags.includes(t));
    if (overlap) return `Matches the ${enemy.clinicalCategory.toLowerCase()} problem (${overlap}).`;
  }
  if (status === 'inappropriate') {
    return `${enemy.clinicalCategory} corruption does not respond to this approach.`;
  }
  if (status === 'unsafe') {
    return 'Reassess before doing more — this could worsen the patient.';
  }
  if (status === 'weak') {
    return 'Supports the patient, but does not treat the cause.';
  }
  return undefined;
}

// ------------------------------------------------------------
// PROFILE COPY (used by onboarding UI)
// ------------------------------------------------------------

export const PROFILE_LABEL: Record<LearningProfile, string> = {
  rpg: "I'm here for the RPG — the medicine is a bonus.",
  cozy: "I want a cozy fantasy world with gentle learning.",
  curious: "I'm curious about how the human body works.",
  teen: "I'm a student exploring health and science.",
  preNursing: "I'm preparing for nursing or healthcare school.",
  nursingStudent: "I'm in nursing school right now.",
  nclexPrep: "I'm preparing for the NCLEX.",
  professional: "I work in healthcare or nursing.",
  // legacy ids
  nonmedical: "I want to learn how the body works.",
  healthcareProfessional: "I work in healthcare.",
};

export const PROFILE_SUBLABEL: Record<LearningProfile, string> = {
  rpg: 'Fantasy story, battles, and world-building first.',
  cozy: 'Low pressure, good vibes, body knowledge as lore.',
  curious: 'Plain language, no prior knowledge needed.',
  teen: 'Great for high school students or anyone starting out.',
  preNursing: 'Foundational nursing concepts and body systems.',
  nursingStudent: 'Clinical judgment, SBAR, cue recognition.',
  nclexPrep: 'Strict clinical lens, prioritization, safety focus.',
  professional: 'Concise clinical synthesis, professional framing.',
  // legacy ids
  nonmedical: 'Guided lessons in plain language.',
  healthcareProfessional: 'Concise clinical synthesis.',
};
