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

import { getCorruptionModeMultiplier } from './difficulty';

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
  // Push 13: Ch1 weakModifier 0.60 → 0.65 — beginners are forgiven a little more for
  // slightly off-target treatments so the first chapter stays accessible and educational.
  if (chapter === 1) return { poorFitModifier: 0.35, weakModifier: 0.65, enemyDamageMultiplier: 0.85, allowLuckyWin: true };
  if (chapter === 2) return { poorFitModifier: 0.25, weakModifier: 0.5, enemyDamageMultiplier: 1.0, allowLuckyWin: true };
  return { poorFitModifier: 0.1, weakModifier: 0.35, enemyDamageMultiplier: 1.1, allowLuckyWin: false };
}

// ------------------------------------------------------------
// ACTION CLINICAL METADATA
// ------------------------------------------------------------

// NM-01: canonical Care Pathway role IDs.
export type PathwayRole = 'assess' | 'stabilize' | 'treat' | 'protect' | 'reassess' | 'escalate';


// Disease domain that a skill or action belongs to — drives the affinity bonus system.
// 'general' = assessment / escalation / catch-all → always neutral (never penalised).
export type DiseaseCategory =
  | 'respiratory'    // airways, oxygenation, bronchodilator, ventilation
  | 'circulatory'    // fluid resuscitation, IV fluids, hydration, perfusion
  | 'infection'      // antimicrobial, isolation, infection treatment
  | 'metabolic'      // glucose management, hypoglycemia, insulin, electrolytes
  | 'cardiac'        // heart rhythm, cardiac output, dysrhythmia
  | 'neurological'   // orientation, mental status, pain, de-escalation
  | 'integumentary'  // skin, wound care, dressings
  | 'safety'         // fall prevention, medication safety
  | 'general';       // assessment, reassessment, escalation, command — always neutral

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
  /** NM-01 canonical pathway roles. */
  pathwayRoles?: PathwayRole[];
  // Optional activation gate (used for Rapid Response style)
  conditionalRequiresLowStability?: number; // if defined, action is "weak" when stability is above this
  // Disease domain — drives the affinity modifier (super-effective / limited)
  diseaseCategory?: DiseaseCategory;
}

// --- Hero skill metadata (keyed by skill id) ---
export const SKILL_CLINICAL: Record<string, ActionClinical> = {
  breath_of_dawn: {
    clinicalTags: ['airway', 'oxygenation', 'respiratory', 'assessment'],
    appropriateForSystems: ['Air'],
    pathwayRoles: ['stabilize', 'treat'],
    diseaseCategory: 'respiratory',
  },
  lantern_of_clues: {
    clinicalTags: ['assessment'],
    pathwayRoles: ['assess'],
    diseaseCategory: 'general',
  },
  rapid_response: {
    clinicalTags: ['escalation', 'acute deterioration', 'emergency'],
    pathwayRoles: ['escalate', 'stabilize'],
    conditionalRequiresLowStability: 50,
    diseaseCategory: 'general',
  },
  vital_ward: {
    clinicalTags: ['assessment', 'reassessment', 'general support'],
    pathwayRoles: ['assess', 'reassess'],
    diseaseCategory: 'general',
  },
  rally_bell: {
    clinicalTags: ['escalation', 'command'],
    pathwayRoles: ['escalate'],
    diseaseCategory: 'general',
  },
  pattern_sight: {
    clinicalTags: ['assessment', 'neurovascular assessment'],
    pathwayRoles: ['assess', 'treat'],
    diseaseCategory: 'neurological',
  },
  focused_lens: {
    clinicalTags: ['assessment', 'reassessment'],
    pathwayRoles: ['assess', 'reassess'],
    diseaseCategory: 'general',
  },
  safety_circle: {
    clinicalTags: ['fall prevention', 'safety'],
    pathwayRoles: ['protect'],
    diseaseCategory: 'safety',
  },
  isolation_seal: {
    clinicalTags: ['infection isolation', 'transmission prevention'],
    appropriateForSystems: ['Fire', 'Protection'],
    pathwayRoles: ['protect', 'treat'],
    diseaseCategory: 'infection',
  },
  threadwatch: {
    clinicalTags: ['assessment', 'reassessment'],
    pathwayRoles: ['assess', 'reassess'],
    diseaseCategory: 'general',
  },
  codex_link: {
    clinicalTags: ['assessment'],
    pathwayRoles: ['assess', 'treat'],
    diseaseCategory: 'general',
  },
  mythic_prescience: {
    clinicalTags: ['assessment', 'reassessment', 'anticipatory care'],
    pathwayRoles: ['treat'],
    diseaseCategory: 'general',
  },
  guardians_touch: {
    clinicalTags: ['general support', 'comfort'],
    pathwayRoles: ['stabilize', 'treat'],
    diseaseCategory: 'general',
  },
  mend: {
    clinicalTags: ['skin integrity', 'wound care', 'protect', 'general support', 'comfort'],
    appropriateForSystems: ['Protection'],
    pathwayRoles: ['treat', 'stabilize'],
    diseaseCategory: 'integumentary',
  },
  reassess: {
    clinicalTags: ['reassessment', 'assessment'],
    pathwayRoles: ['reassess', 'assess'],
    diseaseCategory: 'general',
  },
  glucose_round: {
    clinicalTags: ['glucose replacement', 'hypoglycemia', 'assessment', 'monitoring'],
    appropriateForSystems: ['Energy'],
    pathwayRoles: ['treat', 'assess'],
    diseaseCategory: 'metabolic',
  },
  critical_response: {
    clinicalTags: ['escalation', 'acute deterioration', 'emergency'],
    pathwayRoles: ['stabilize', 'escalate'],
    conditionalRequiresLowStability: 50,
    diseaseCategory: 'general',
  },
  river_surge: {
    clinicalTags: ['circulation', 'fluid resuscitation'],
    appropriateForSystems: ['River'],
    unsafeIfClues: ['Crackles', 'Leg Swelling', 'Weight +'],
    pathwayRoles: ['treat', 'stabilize'],
    diseaseCategory: 'circulatory',
  },
  infection_scan: {
    clinicalTags: ['assessment', 'infection assessment'],
    pathwayRoles: ['assess'],
    diseaseCategory: 'infection',
  },
  purity_mark: {
    clinicalTags: ['antimicrobial', 'infection treatment'],
    appropriateForSystems: ['Fire'],
    pathwayRoles: ['treat'],
    diseaseCategory: 'infection',
  },
  skin_shield: {
    clinicalTags: ['skin integrity', 'protect'],
    pathwayRoles: ['protect'],
    diseaseCategory: 'integumentary',
  },
  mind_anchor: {
    clinicalTags: ['orientation', 'therapeutic communication', 'neuro', 'comfort'],
    appropriateForSystems: ['Mind'],
    pathwayRoles: ['treat', 'stabilize'],
    diseaseCategory: 'neurological',
  },
  error_ward: {
    clinicalTags: ['safety', 'medication safety'],
    pathwayRoles: ['protect'],
    diseaseCategory: 'safety',
  },
};

// --- Item metadata (keyed by item.name as used in inventory) ---
export const ITEM_CLINICAL: Record<string, ActionClinical> = {
  'Albuterol Mist': {
    clinicalTags: ['bronchospasm', 'wheezing', 'airway', 'respiratory'],
    requiredClues: ['Wheezing'],
    appropriateForSystems: ['Air'],
    pathwayRoles: ['treat'],
    diseaseCategory: 'respiratory',
  },
  'Glucose Gel': {
    clinicalTags: ['glucose replacement', 'hypoglycemia'],
    requiredClues: ['Glucose'],
    appropriateForSystems: ['Energy'],
    pathwayRoles: ['treat'],
    diseaseCategory: 'metabolic',
  },
  'Fluid Bolus': {
    clinicalTags: ['circulation', 'fluid resuscitation'],
    requiredClues: ['BP'],
    appropriateForSystems: ['River'],
    unsafeIfClues: ['Crackles', 'Leg Swelling', 'Weight +'],
    pathwayRoles: ['treat', 'stabilize'],
    diseaseCategory: 'circulatory',
  },
  'Isolation Kit': {
    clinicalTags: ['infection isolation', 'transmission prevention'],
    appropriateForSystems: ['Fire'],
    pathwayRoles: ['protect'],
    diseaseCategory: 'infection',
  },
  'Lab Token': {
    clinicalTags: ['assessment'],
    pathwayRoles: ['assess'],
    diseaseCategory: 'general',
  },
  'Antipyretic Draught': {
    clinicalTags: ['fever', 'antipyretic', 'inflammation', 'infection'],
    appropriateForSystems: ['Fire'],
    pathwayRoles: ['treat'],
    diseaseCategory: 'infection',
  },
  'Oxygen Sigil': {
    clinicalTags: ['oxygenation', 'hypoxia', 'respiratory', 'airway'],
    appropriateForSystems: ['Air'],
    pathwayRoles: ['stabilize'],
    diseaseCategory: 'respiratory',
  },
  'Calming Elixir': {
    clinicalTags: ['anxiety', 'panic', 'de-escalation'],
    appropriateForSystems: ['Mind'],
    pathwayRoles: ['stabilize'],
    diseaseCategory: 'neurological',
  },
  'Analgesic Balm': {
    clinicalTags: ['pain', 'analgesia', 'comfort'],
    appropriateForSystems: ['Mind'],
    pathwayRoles: ['stabilize'],
    diseaseCategory: 'neurological',
  },
  'Rhythm Elixir': {
    clinicalTags: ['dysrhythmia', 'heart rate', 'rhythm'],
    appropriateForSystems: ['Storm'],
    pathwayRoles: ['stabilize'],
    diseaseCategory: 'cardiac',
  },
  'Antiemetic Charm': {
    clinicalTags: ['nausea', 'vomiting', 'antiemetic', 'hydration'],
    appropriateForSystems: ['Filter'],
    pathwayRoles: ['treat'],
    diseaseCategory: 'general',
  },
};

// --- Temp action metadata ---
export const TEMP_CLINICAL: Record<string, ActionClinical> = {
  open_airflow: {
    clinicalTags: ['airway', 'oxygenation', 'respiratory'],
    appropriateForSystems: ['Air'],
    pathwayRoles: ['treat', 'stabilize'],
    diseaseCategory: 'respiratory',
  },
  containment_order: {
    clinicalTags: ['infection isolation', 'transmission prevention'],
    appropriateForSystems: ['Fire'],
    pathwayRoles: ['protect'],
    diseaseCategory: 'infection',
  },
};

// --- Call option metadata ---
export const CALL_CLINICAL: Record<string, ActionClinical> = {
  call_respiratory: {
    clinicalTags: ['airway', 'oxygenation', 'respiratory', 'escalation'],
    appropriateForSystems: ['Air'],
    pathwayRoles: ['escalate'],
    diseaseCategory: 'respiratory',
  },
  call_pharmacy: {
    clinicalTags: ['escalation', 'command'],
    pathwayRoles: ['escalate'],
    diseaseCategory: 'general',
  },
  call_rapid: {
    clinicalTags: ['acute deterioration', 'escalation', 'emergency'],
    pathwayRoles: ['escalate', 'stabilize'],
    conditionalRequiresLowStability: 35,
    diseaseCategory: 'general',
  },
  call_infection: {
    clinicalTags: ['infection isolation', 'transmission prevention', 'escalation'],
    appropriateForSystems: ['Fire'],
    pathwayRoles: ['escalate', 'protect'],
    diseaseCategory: 'infection',
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
  treatmentChain: PathwayRole[];
  preferredChainTags: string[];
  weaknesses: string[]; // system types this enemy is weak to
  resistances: string[];
  starTurnLimit: number;
  rewardBase: number;
  chapter: number;
  // Disease-domain affinity — skills in affinityStrong get ×1.5 strike; affinityWeak get ×0.5.
  // 'general' category skills are always neutral regardless of these lists.
  affinityStrong?: DiseaseCategory[];
  affinityWeak?: DiseaseCategory[];
}

const ASSESS_CHAIN: PathwayRole[] = ['assess', 'stabilize', 'treat', 'reassess'];

export const ENEMY_CLINICAL: Record<string, EnemyClinical> = {
  // Chapter 9 trial / prologue tutorial enemy — same Fluid Balance clinical
  // profile as the wisp but tighter star-turn limit (harder fight).
  dehydration_specter: {
    clinicalCategory: 'Fluid Balance',
    diseaseTags: ['dehydration', 'hypovolemia', 'severe fluid loss', 'desiccation'],
    allowedActionTags: ['assessment', 'reassessment', 'general support', 'airway', 'oxygenation', 'respiratory', 'circulation', 'fluid resuscitation', 'monitoring', 'hydration', 'escalation'],
    strongActionTags: ['circulation', 'fluid resuscitation', 'hydration'],
    weakActionTags: ['comfort'],
    inappropriateActionTags: ['glucose replacement', 'antimicrobial', 'bronchospasm', 'skin integrity', 'orientation', 'fall prevention', 'infection isolation'],
    unsafeActionTags: [],
    treatmentChain: ASSESS_CHAIN,
    preferredChainTags: ['assessment', 'reassessment', 'circulation', 'fluid resuscitation', 'hydration'],
    weaknesses: ['River'],
    resistances: ['Fire'],
    starTurnLimit: 5,
    rewardBase: 35,
    chapter: 9,
    affinityStrong: ['circulatory'],
    affinityWeak: ['infection', 'metabolic', 'integumentary', 'safety', 'neurological', 'cardiac'],
  },
  // Chapter 1 mini-boss (fluid_phantom) — same profile as the wisp but
  // with a tighter star-turn limit (harder fight, rewarded for efficiency).
  fluid_phantom: {
    clinicalCategory: 'Fluid Balance',
    diseaseTags: ['dehydration', 'hypovolemia', 'fluid loss'],
    allowedActionTags: ['assessment', 'reassessment', 'general support', 'comfort', 'airway', 'oxygenation', 'respiratory', 'circulation', 'fluid resuscitation', 'monitoring', 'hydration', 'escalation'],
    strongActionTags: ['circulation', 'fluid resuscitation', 'hydration'],
    weakActionTags: ['comfort'],
    inappropriateActionTags: ['glucose replacement', 'antimicrobial', 'bronchospasm', 'skin integrity', 'orientation', 'fall prevention', 'infection isolation'],
    unsafeActionTags: [],
    treatmentChain: ASSESS_CHAIN,
    preferredChainTags: ['assessment', 'reassessment', 'general support', 'circulation', 'fluid resuscitation', 'hydration'],
    weaknesses: ['River'],
    resistances: ['Fire'],
    starTurnLimit: 5,
    rewardBase: 30,
    chapter: 1,
    affinityStrong: ['circulatory'],
    affinityWeak: ['infection', 'metabolic', 'integumentary', 'safety', 'neurological', 'cardiac'],
  },
  dehydration_wisp: {
    clinicalCategory: 'Fluid Balance',
    diseaseTags: ['dehydration', 'hypovolemia', 'fluid loss'],
    allowedActionTags: ['assessment', 'reassessment', 'general support', 'comfort', 'airway', 'oxygenation', 'respiratory', 'circulation', 'fluid resuscitation', 'monitoring', 'hydration', 'escalation'],
    strongActionTags: ['circulation', 'fluid resuscitation', 'hydration'],
    weakActionTags: ['comfort'],
    inappropriateActionTags: ['glucose replacement', 'antimicrobial', 'bronchospasm', 'skin integrity', 'orientation', 'fall prevention', 'infection isolation'],
    unsafeActionTags: [],
    treatmentChain: ASSESS_CHAIN,
    preferredChainTags: ['assessment', 'reassessment', 'general support', 'comfort', 'airway', 'oxygenation', 'respiratory', 'circulation', 'fluid resuscitation', 'hydration'],
    weaknesses: ['River'],
    resistances: ['Fire'],
    starTurnLimit: 6,
    rewardBase: 20,
    chapter: 1,
    affinityStrong: ['circulatory'],
    affinityWeak: ['infection', 'metabolic', 'integumentary', 'safety', 'neurological', 'cardiac'],
  },
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
  // Chapter 3 trial — advanced respiratory/airway failure encounter.
  gale_spirit: {
    clinicalCategory: 'Respiratory Failure',
    diseaseTags: ['respiratory failure', 'hypoxia', 'airway obstruction', 'SpO2 drop'],
    allowedActionTags: ['airway', 'oxygenation', 'respiratory', 'bronchospasm', 'assessment', 'reassessment', 'escalation', 'monitoring', 'general support'],
    strongActionTags: ['airway', 'oxygenation', 'respiratory', 'escalation'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['skin integrity', 'fall prevention', 'infection isolation', 'glucose replacement', 'fluid resuscitation', 'antimicrobial'],
    unsafeActionTags: [],
    treatmentChain: ASSESS_CHAIN,
    preferredChainTags: ['assessment', 'airway', 'oxygenation', 'respiratory', 'reassessment', 'escalation'],
    weaknesses: ['Air'],
    resistances: ['Fire'],
    starTurnLimit: 5,
    rewardBase: 35,
    chapter: 3,
    affinityStrong: ['respiratory'],
    affinityWeak: ['infection', 'metabolic', 'integumentary', 'safety', 'neurological', 'cardiac', 'circulatory'],
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
    affinityStrong: ['circulatory'],
    affinityWeak: ['infection', 'metabolic', 'integumentary', 'safety', 'neurological', 'cardiac'],
  },
  energy_lock: {
    clinicalCategory: 'Endocrine',
    diseaseTags: ['hypoglycemia', 'low glucose'],
    allowedActionTags: ['glucose replacement', 'hypoglycemia', 'assessment', 'reassessment', 'escalation', 'general support', 'monitoring', 'comfort'],
    strongActionTags: ['glucose replacement', 'hypoglycemia'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['bronchospasm', 'antimicrobial', 'fluid resuscitation', 'infection isolation', 'skin integrity', 'fall prevention'],
    unsafeActionTags: [],
    treatmentChain: ['assess', 'treat', 'reassess'],
    preferredChainTags: ['assessment', 'glucose replacement', 'hypoglycemia', 'reassessment'],
    weaknesses: ['Energy'],
    resistances: ['Air', 'Fire'],
    starTurnLimit: 5,
    rewardBase: 25,
    chapter: 1,
    affinityStrong: ['metabolic'],
    affinityWeak: ['respiratory', 'infection', 'integumentary', 'safety', 'neurological', 'cardiac', 'circulatory'],
  },
  fire_imp: {
    clinicalCategory: 'Infection',
    diseaseTags: ['infection', 'cellulitis', 'localized infection'],
    allowedActionTags: ['infection isolation', 'transmission prevention', 'antimicrobial', 'infection treatment', 'infection assessment', 'assessment', 'reassessment', 'escalation'],
    strongActionTags: ['infection isolation', 'antimicrobial', 'infection treatment'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['bronchospasm', 'glucose replacement', 'fluid resuscitation', 'orientation'],
    unsafeActionTags: [],
    treatmentChain: ['assess', 'protect', 'treat', 'reassess'],
    preferredChainTags: ['assessment', 'infection isolation', 'antimicrobial', 'reassessment'],
    weaknesses: ['Fire', 'Protection'],
    resistances: ['Air'],
    starTurnLimit: 6,
    rewardBase: 30,
    chapter: 1,
    affinityStrong: ['infection'],
    affinityWeak: ['metabolic', 'integumentary', 'neurological', 'cardiac', 'circulatory'],
  },
  // Chapter 2 trial — advanced fever/inflammation encounter.
  fever_shade: {
    clinicalCategory: 'Fever / Inflammation',
    diseaseTags: ['fever', 'hyperthermia', 'inflammation', 'infection'],
    allowedActionTags: ['assessment', 'reassessment', 'fever management', 'antipyretic', 'antimicrobial', 'fluid resuscitation', 'hydration', 'monitoring', 'escalation', 'general support'],
    strongActionTags: ['fever management', 'antipyretic', 'antimicrobial', 'fluid resuscitation'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['bronchospasm', 'glucose replacement', 'orientation', 'fall prevention', 'skin integrity'],
    unsafeActionTags: [],
    treatmentChain: ['assess', 'treat', 'reassess'],
    preferredChainTags: ['assessment', 'fever management', 'antipyretic', 'fluid resuscitation', 'reassessment'],
    weaknesses: ['River', 'Fire'],
    resistances: [],
    starTurnLimit: 5,
    rewardBase: 35,
    chapter: 2,
    affinityStrong: ['infection', 'circulatory'],
    affinityWeak: ['metabolic', 'integumentary', 'safety', 'neurological', 'cardiac'],
  },
  mind_fog: {
    clinicalCategory: 'Neuro',
    diseaseTags: ['delirium', 'altered mental status', 'fall risk'],
    allowedActionTags: ['orientation', 'therapeutic communication', 'safety', 'fall prevention', 'neuro', 'assessment', 'reassessment', 'escalation', 'emergency', 'general support', 'comfort'],
    strongActionTags: ['orientation', 'therapeutic communication', 'fall prevention'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['bronchospasm', 'glucose replacement', 'fluid resuscitation', 'antimicrobial'],
    unsafeActionTags: [],
    treatmentChain: ['assess', 'protect', 'treat', 'reassess'],
    preferredChainTags: ['assessment', 'orientation', 'fall prevention', 'reassessment'],
    weaknesses: ['Mind', 'Protection'],
    resistances: ['Fire'],
    starTurnLimit: 6,
    rewardBase: 28,
    chapter: 1,
    affinityStrong: ['neurological', 'safety'],
    affinityWeak: ['circulatory', 'infection', 'metabolic', 'integumentary', 'cardiac', 'respiratory'],
  },
  septara_seed: {
    clinicalCategory: 'Sepsis',
    diseaseTags: ['sepsis', 'systemic infection', 'shock'],
    allowedActionTags: ['infection isolation', 'antimicrobial', 'fluid resuscitation', 'circulation', 'assessment', 'reassessment', 'escalation'],
    strongActionTags: ['antimicrobial', 'fluid resuscitation', 'infection isolation', 'escalation'],
    weakActionTags: ['general support'],
    inappropriateActionTags: ['glucose replacement', 'orientation', 'fall prevention', 'skin integrity', 'bronchospasm'],
    unsafeActionTags: [],
    treatmentChain: ['assess', 'stabilize', 'treat', 'reassess'],
    preferredChainTags: ['assessment', 'fluid resuscitation', 'antimicrobial', 'reassessment'],
    weaknesses: ['Fire', 'River'],
    resistances: ['Mind'],
    starTurnLimit: 6,
    rewardBase: 45,
    chapter: 2,
    affinityStrong: ['infection', 'circulatory'],
    affinityWeak: ['metabolic', 'integumentary', 'neurological', 'cardiac'],
  },
  cardion_echo: {
    clinicalCategory: 'Cardiac',
    diseaseTags: ['heart failure', 'fluid overload', 'pulmonary edema'],
    allowedActionTags: ['oxygenation', 'airway', 'reassessment', 'assessment', 'escalation', 'general support'],
    strongActionTags: ['oxygenation', 'airway'],
    weakActionTags: ['general support'],
    inappropriateActionTags: ['bronchospasm', 'glucose replacement', 'orientation', 'fall prevention', 'antimicrobial'],
    unsafeActionTags: ['fluid resuscitation'], // critical: fluids worsen CHF
    treatmentChain: ['assess', 'stabilize', 'treat', 'reassess'],
    preferredChainTags: ['assessment', 'oxygenation', 'reassessment'],
    weaknesses: ['Air', 'River'],
    resistances: ['Fire'],
    starTurnLimit: 6,
    rewardBase: 40,
    chapter: 2,
    affinityStrong: ['cardiac', 'respiratory'],
    affinityWeak: ['metabolic', 'integumentary', 'infection', 'safety', 'neurological'],
  },
  glycora_spark: {
    clinicalCategory: 'Endocrine Crisis',
    diseaseTags: ['DKA', 'hyperglycemia', 'acid-base imbalance'],
    allowedActionTags: ['fluid resuscitation', 'assessment', 'reassessment', 'escalation', 'circulation'],
    strongActionTags: ['fluid resuscitation', 'assessment'],
    weakActionTags: ['general support'],
    inappropriateActionTags: ['bronchospasm', 'orientation', 'fall prevention', 'antimicrobial', 'glucose replacement'],
    unsafeActionTags: [],
    treatmentChain: ['assess', 'stabilize', 'treat', 'reassess'],
    preferredChainTags: ['assessment', 'fluid resuscitation', 'reassessment'],
    weaknesses: ['Energy', 'Storm'],
    resistances: ['Air'],
    starTurnLimit: 6,
    rewardBase: 45,
    chapter: 2,
    affinityStrong: ['circulatory'],
    affinityWeak: ['infection', 'integumentary', 'neurological', 'safety', 'respiratory', 'cardiac'],
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
    affinityStrong: ['respiratory'],
    affinityWeak: ['circulatory', 'infection', 'metabolic', 'integumentary', 'safety', 'neurological', 'cardiac'],
  },
  electrox_flicker: {
    clinicalCategory: 'Electrolyte',
    diseaseTags: ['hyperkalemia', 'rhythm disturbance'],
    allowedActionTags: ['assessment', 'reassessment', 'escalation', 'circulation', 'general support'],
    strongActionTags: ['assessment', 'circulation'],
    weakActionTags: ['general support'],
    inappropriateActionTags: ['bronchospasm', 'glucose replacement', 'antimicrobial', 'orientation', 'fall prevention'],
    unsafeActionTags: [],
    treatmentChain: ['assess', 'stabilize', 'treat', 'reassess'],
    preferredChainTags: ['assessment', 'circulation', 'reassessment'],
    weaknesses: ['Storm', 'River'],
    resistances: ['Fire'],
    starTurnLimit: 6,
    rewardBase: 40,
    chapter: 2,
    affinityStrong: ['cardiac'],
    affinityWeak: ['infection', 'metabolic', 'integumentary', 'safety', 'neurological', 'respiratory'],
  },
  // Chapter 5 finale — multi-system ward collapse encounter.
  ward_cascade: {
    clinicalCategory: 'Multi-System / Ward Surge',
    diseaseTags: ['ward collapse', 'multi-patient surge', 'mass casualty', 'code blue'],
    allowedActionTags: ['assessment', 'reassessment', 'escalation', 'emergency', 'airway', 'oxygenation', 'circulation', 'fluid resuscitation', 'monitoring', 'infection isolation', 'general support'],
    strongActionTags: ['escalation', 'emergency', 'circulation', 'airway', 'infection isolation'],
    weakActionTags: ['comfort'],
    inappropriateActionTags: ['glucose replacement', 'antimicrobial', 'bronchospasm', 'orientation', 'fall prevention', 'skin integrity'],
    unsafeActionTags: [],
    treatmentChain: ['assess', 'protect', 'treat', 'reassess'],
    preferredChainTags: ['assessment', 'escalation', 'emergency', 'circulation', 'infection isolation', 'reassessment'],
    weaknesses: ['Protection', 'River'],
    resistances: ['Mind'],
    starTurnLimit: 7,
    rewardBase: 60,
    chapter: 5,
    affinityStrong: ['circulatory', 'respiratory', 'infection'],
    affinityWeak: ['metabolic', 'integumentary', 'neurological'],
  },
  lord_imbalance: {
    clinicalCategory: 'Multi-System',
    diseaseTags: ['multi-system failure', 'unstable', 'shock'],
    allowedActionTags: ['airway', 'oxygenation', 'circulation', 'fluid resuscitation', 'glucose replacement', 'orientation', 'escalation', 'assessment', 'reassessment', 'antimicrobial'],
    strongActionTags: ['airway', 'oxygenation', 'circulation', 'fluid resuscitation', 'escalation', 'glucose replacement'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['skin integrity'],
    unsafeActionTags: [],
    treatmentChain: ['assess', 'stabilize', 'treat', 'reassess'],
    preferredChainTags: ['assessment', 'airway', 'circulation', 'reassessment', 'escalation'],
    weaknesses: ['Air', 'River', 'Mind'],
    resistances: [],
    starTurnLimit: 8,
    rewardBase: 100,
    chapter: 3,
    affinityStrong: ['respiratory', 'circulatory', 'infection'],
    affinityWeak: ['integumentary', 'safety'],
  },
  hypoxia_wisp: {
    clinicalCategory: 'Respiratory',
    diseaseTags: ['hypoxia', 'desaturation', 'respiratory distress'],
    allowedActionTags: ['airway', 'oxygenation', 'respiratory', 'assessment', 'reassessment', 'escalation', 'general support'],
    strongActionTags: ['oxygenation', 'airway'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['skin integrity', 'fall prevention', 'glucose replacement', 'antimicrobial'],
    unsafeActionTags: [],
    treatmentChain: ['stabilize', 'reassess'],
    preferredChainTags: ['oxygenation', 'reassessment'],
    weaknesses: ['Air'],
    resistances: [],
    starTurnLimit: 4,
    rewardBase: 12,
    chapter: 2,
    affinityStrong: ['respiratory'],
    affinityWeak: ['circulatory', 'infection', 'metabolic', 'integumentary', 'safety', 'neurological', 'cardiac'],
  },
  mucus_wisp: {
    clinicalCategory: 'Respiratory',
    diseaseTags: ['airway obstruction', 'secretions'],
    allowedActionTags: ['airway', 'oxygenation', 'respiratory', 'assessment', 'reassessment', 'escalation', 'general support'],
    strongActionTags: ['airway', 'oxygenation'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['skin integrity', 'fall prevention', 'glucose replacement', 'antimicrobial'],
    unsafeActionTags: [],
    treatmentChain: ['stabilize', 'reassess'],
    preferredChainTags: ['airway', 'reassessment'],
    weaknesses: ['Air'],
    resistances: [],
    starTurnLimit: 4,
    rewardBase: 12,
    chapter: 2,
    affinityStrong: ['respiratory'],
    affinityWeak: ['circulatory', 'infection', 'metabolic', 'integumentary', 'safety', 'neurological', 'cardiac'],
  },
  panic_wraith: {
    clinicalCategory: 'Mental Health',
    diseaseTags: ['anxiety', 'panic', 'agitation'],
    allowedActionTags: ['orientation', 'assessment', 'reassessment', 'escalation', 'general support', 'comfort'],
    strongActionTags: ['comfort', 'orientation'],
    weakActionTags: ['general support'],
    inappropriateActionTags: ['skin integrity', 'fall prevention', 'glucose replacement', 'antimicrobial', 'fluid resuscitation'],
    unsafeActionTags: [],
    treatmentChain: ['stabilize', 'reassess'],
    preferredChainTags: ['comfort', 'reassessment'],
    weaknesses: ['Mind'],
    resistances: [],
    starTurnLimit: 4,
    rewardBase: 10,
    chapter: 2,
    affinityStrong: ['neurological'],
    affinityWeak: ['circulatory', 'infection', 'metabolic', 'integumentary', 'cardiac', 'respiratory'],
  },
  wheeze_guard: {
    clinicalCategory: 'Respiratory',
    diseaseTags: ['bronchospasm', 'wheezing'],
    allowedActionTags: ['airway', 'oxygenation', 'respiratory', 'bronchospasm', 'wheezing', 'assessment', 'reassessment', 'escalation', 'general support'],
    strongActionTags: ['wheezing', 'bronchospasm', 'oxygenation'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['skin integrity', 'fall prevention', 'glucose replacement', 'antimicrobial'],
    unsafeActionTags: [],
    treatmentChain: ['stabilize', 'reassess'],
    preferredChainTags: ['bronchospasm', 'reassessment'],
    weaknesses: ['Air'],
    resistances: [],
    starTurnLimit: 4,
    rewardBase: 13,
    chapter: 2,
    affinityStrong: ['respiratory'],
    affinityWeak: ['circulatory', 'infection', 'metabolic', 'integumentary', 'safety', 'neurological', 'cardiac'],
  },
  shock_spike: {
    clinicalCategory: 'Circulatory',
    diseaseTags: ['shock', 'hypoperfusion'],
    allowedActionTags: ['circulation', 'fluid resuscitation', 'assessment', 'reassessment', 'escalation', 'general support'],
    strongActionTags: ['circulation', 'fluid resuscitation', 'escalation'],
    weakActionTags: ['general support', 'comfort'],
    inappropriateActionTags: ['skin integrity', 'fall prevention', 'glucose replacement', 'antimicrobial'],
    unsafeActionTags: [],
    treatmentChain: ['stabilize', 'reassess'],
    preferredChainTags: ['circulation', 'reassessment'],
    weaknesses: ['River'],
    resistances: [],
    starTurnLimit: 4,
    rewardBase: 15,
    chapter: 2,
    affinityStrong: ['circulatory'],
    affinityWeak: ['infection', 'metabolic', 'integumentary', 'safety', 'neurological', 'cardiac', 'respiratory'],
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

/**
 * Push 1 — Elemental Counter Overhaul:
 * Returns 1.0 unconditionally. The old element-string path
 * (ENEMY_CLINICAL.weaknesses / resistances → ×1.5 / ×0.5 / ×0.25) is
 * removed so that fantasy element matching cannot influence clinical
 * effectiveness. The only elemental modifier is `weakElement` → ×1.30
 * applied exclusively via `elementBonus` in the strike modifier bag.
 * Clinical fit is now determined solely by:
 *   • evaluateClinicalAppropriateness (action clinical tags vs enemy disease)
 *   • calcAffinityFamilyMod (hero affinity domains)
 */
export function getSystemMatchModifier(_systemType: string | undefined, _enemy: EnemyClinical | undefined, _enemyPrimarySystem?: string): number {
  return 1.0;
}

// ------------------------------------------------------------
// DISEASE-DOMAIN AFFINITY
// ------------------------------------------------------------

export type AffinityLevel = 'strong' | 'neutral' | 'weak';

export interface AffinityResult {
  level: AffinityLevel;
  multiplier: number; // applied to strike/corruption-reduction base amount
  label: string;      // player-facing label ('Super Effective' | '' | 'Limited Effect')
}

const AFFINITY_NEUTRAL: AffinityResult = { level: 'neutral', multiplier: 1.0, label: '' };

/**
 * Returns a strike multiplier based on how well the skill's disease domain
 * matches the enemy's clinical affinity map.
 *
 * - Strong (×1.5)  — e.g. respiratory skill vs respiratory disease (Albuterol vs wheeze_guard)
 * - Neutral (×1.0) — 'general' category or no match either way
 * - Weak   (×0.5)  — e.g. metabolic skill vs respiratory disease (Glucose Gel vs air_sprite)
 *
 * Stacks multiplicatively with appropriateness and system modifiers.
 */
export function getAffinityModifier(
  action: ActionClinical | undefined,
  enemy: EnemyClinical | undefined,
): AffinityResult {
  if (!action || !enemy) return AFFINITY_NEUTRAL;
  const category = action.diseaseCategory;
  if (!category || category === 'general') return AFFINITY_NEUTRAL;

  if ((enemy.affinityStrong || []).includes(category)) {
    return { level: 'strong', multiplier: 1.5, label: 'Super Effective' };
  }
  if ((enemy.affinityWeak || []).includes(category)) {
    return { level: 'weak', multiplier: 0.5, label: 'Limited Effect' };
  }
  return AFFINITY_NEUTRAL;
}

// Treatment is more effective when patient is more stable.
export function getTreatmentStabilityModifier(stability: number): number {
  if (stability >= 80) return 1.1;
  if (stability >= 40) return 1.0;
  if (stability >= 20) return 0.85;
  return 0.7;
}

// Dynamic AP each turn based on patient state.
// Base AP scales across stability checkpoints (10 / 25 / 50 / 75 / 100): a healthier
// patient lets the team coordinate more actions, a crashing one limits them.
export function getTurnAP(stability: number, corruption: number, chapter: number, modifiers: { allowHighStabilityBonus?: boolean; preventNextAPLoss?: boolean } = {}): number {
  let ap: number;
  if (stability >= 100) ap = 10;
  else if (stability >= 75) ap = 9;
  else if (stability >= 50) ap = 8;
  else if (stability >= 25) ap = 5;
  else ap = 3; // critical floor
  if (stability >= 75 && modifiers.allowHighStabilityBonus) ap += 1;
  if (chapter >= 2 && corruption >= 80) ap -= 1;
  if (modifiers.preventNextAPLoss) {
    ap = Math.max(ap, 5);
    modifiers.preventNextAPLoss = false;
  }
  return Math.max(3, Math.min(ap, 10));
}

export function apMessage(ap: number): string {
  if (ap >= 10) return 'The patient is thriving — legendary coordination. 10 AP available.';
  if (ap >= 9)  return 'The patient is thriving — the team moves in perfect sync. 9 AP available.';
  if (ap >= 8)  return 'The patient is stable and the team is fully coordinated. 8 AP available.';
  if (ap >= 6)  return 'The team has solid coordination. 6 AP available.';
  if (ap >= 5)  return 'The situation is demanding. The team keeps pace. 5 AP available.';
  if (ap >= 4)  return 'The situation is unstable. The team is stretched. 4 AP available.';
  return 'Critical condition. Prioritize emergency actions. 3 AP available.';
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

// Diminishing returns on stabilizing: the closer the patient is to fully stable,
// the less each stabilizing action adds. Keeps 100% Stability hard to reach and
// sustain, so Stability stays a meaningful resource instead of being pinned at max.
export function getStabilityGainModifier(stability: number): number {
  if (stability >= 85) return 0.25;
  if (stability >= 70) return 0.45;
  if (stability >= 50) return 0.7;
  return 1.0;
}

// Hidden per-enemy stat. Bosses and later elite enemies resist stabilization, so
// the patient recovers LESS than a skill's listed number. 0 = no resistance
// (normal enemies), 0.3 = 30% of every stabilization is shrugged off. Capped at
// 0.8 so a resistant enemy can never make stabilizing worthless. Never surfaced
// in the UI — the listed skill number still shows, the delivered gain is quietly
// dampened, which the player feels as "healing isn't sticking on this boss."
export function stabilityResistanceMultiplier(enemy?: { stabilityResistance?: number }): number {
  const r = enemy?.stabilityResistance ?? 0;
  return 1 - Math.max(0, Math.min(0.8, r));
}

export function getEnemyDamage(corruption: number, baseInstability: number, accelScale: number = 1): number {
  // Higher Disease Corruption accelerates stability loss — the sicker the patient,
  // the harder each enemy assault lands. accelScale (chapter + difficulty mode) tunes
  // HOW steeply corruption amplifies the hit: gentle in Chapter 1, brutal on Chaos.
  let mult = 1.0;
  if (corruption >= 85) mult = 1.8;
  else if (corruption >= 70) mult = 1.55;
  else if (corruption >= 55) mult = 1.35;
  else if (corruption >= 40) mult = 1.2;
  else if (corruption >= 25) mult = 1.08;
  // Only the corruption-driven EXTRA portion scales; base damage is untouched.
  const scaledMult = 1 + (mult - 1) * accelScale;
  return Math.round(baseInstability * scaledMult);
}

// ------------------------------------------------------------
// CORRUPTION HARSHNESS SCALING (chapter progression + difficulty mode)
// ------------------------------------------------------------
// Chapter 1 is deliberately gentle so new players can learn without spiraling;
// the disease grows more punishing as the story escalates.
export function getChapterCorruptionScale(chapter: number): number {
  if (chapter <= 1) return 0.6;
  if (chapter === 2) return 0.85;
  if (chapter === 3) return 1.0;
  if (chapter === 4) return 1.1;
  return 1.2;
}

// Single harshness knob for the corruption algorithm: story progression times
// the difficulty mode (Normal 1.0 / Hard 1.3 / Chaos 1.55). Clamped so the
// early game never becomes unwinnable and the late game never trivial.
export function getCorruptionPenaltyScale(chapter: number, difficulty?: string): number {
  const raw = getChapterCorruptionScale(chapter) * getCorruptionModeMultiplier(difficulty);
  return Math.min(1.8, Math.max(0.5, raw));
}

// ------------------------------------------------------------
// TREATMENT ↔ DISEASE CORRELATION → CORRUPTION OUTCOME
// ------------------------------------------------------------
// How well a treatment matches the disease decides its effect on Disease Corruption:
//  - Recommended / correlated (strong): cuts corruption hard.
//  - Correct (appropriate): solid corruption reduction.
//  - Related but off-target (weak): minimal corruption reduction.
//  - Totally unrelated (inappropriate): no reduction — actively worsens symptoms
//    (Corruption rises) and destabilizes the patient (Stability drops).
//  - Contraindicated (unsafe): no reduction and worsens the disease.
export interface CorruptionOutcome {
  reductionMult: number;    // multiplier applied to a treatment's corruption-reduction power
  worsenBase: number;       // flat Corruption increase inflicted by a mismatched treatment
  stabilityPenalty: number; // flat Stability loss inflicted by a mismatched treatment
}

export function getCorruptionOutcome(status: ActionStatus, penaltyScale: number = 1): CorruptionOutcome {
  let base: CorruptionOutcome;
  switch (status) {
    case 'strong':        base = { reductionMult: 1.6, worsenBase: 0, stabilityPenalty: 0 }; break;
    case 'appropriate':   base = { reductionMult: 1.0, worsenBase: 0, stabilityPenalty: 0 }; break;
    case 'weak':          base = { reductionMult: 0.3, worsenBase: 0, stabilityPenalty: 0 }; break;
    case 'inappropriate': base = { reductionMult: 0.25, worsenBase: 8, stabilityPenalty: 6 }; break; // Push 1: ×0.25 strike still lands; worsening + penalty are the real punishment
    case 'unsafe':        base = { reductionMult: 0, worsenBase: 6, stabilityPenalty: 0 }; break;
    default:              base = { reductionMult: 0, worsenBase: 0, stabilityPenalty: 0 }; break;
  }
  if (penaltyScale === 1) return base;
  // Only the punishing side (worsening + destabilization) scales with harshness;
  // the reward for correct treatment (reductionMult) stays consistent so the game
  // remains fair. A penalty that exists at all never rounds away to zero.
  const scaleFlat = (n: number) => (n > 0 ? Math.max(1, Math.round(n * penaltyScale)) : 0);
  return {
    reductionMult: base.reductionMult,
    worsenBase: scaleFlat(base.worsenBase),
    stabilityPenalty: scaleFlat(base.stabilityPenalty),
  };
}

// ------------------------------------------------------------
// CARE CHAIN
// ------------------------------------------------------------

export interface ChainState {
  progress: PathwayRole[]; // ordered canonical steps already completed
  completed: boolean;
}

export function emptyChain(): ChainState { return { progress: [], completed: false }; }

// NM-01: renamed canAdvanceChain → canAdvancePathway; old export kept as alias
// for call sites not yet updated. Remove alias after all call sites migrate.
export function canAdvancePathway(
  action: ActionClinical | undefined,
  enemy: EnemyClinical | undefined,
  chain: ChainState,
): PathwayRole | null {
  if (!action || !enemy) return null;
  if (chain.completed) return null;

  // All treatmentChain values are canonical PathwayRole IDs.
  const nextStep = enemy.treatmentChain[chain.progress.length];
  if (!nextStep) return null;

  // Resolve action roles from canonical pathwayRoles.
  const roles = action.pathwayRoles ?? [];
  if (!roles.includes(nextStep)) return null;

  // NM-01: element/system matching removed — clinical tag overlap is the sole qualifier.
  const tagMatches = (action.clinicalTags || []).some(t => enemy.preferredChainTags.includes(t));
  return tagMatches ? nextStep : null;
}

/** @deprecated Use canAdvancePathway. */
export function canAdvanceChain(
  action: ActionClinical | undefined,
  enemy: EnemyClinical | undefined,
  chain: ChainState,
  _systemType?: string, // ignored — NM-01 removed element matching
): PathwayRole | null {
  return canAdvancePathway(action, enemy, chain);
}

// Push 13: Chain bonuses tuned upward so care-chain momentum feels rewarding.
// step 5→6, fullCorr 20→25, fullStab 15→18; shard reward unchanged.
export const CHAIN_BONUSES = {
  stepCorruptionDamage: 6,
  fullChainCorruptionDamage: 25,
  fullChainStabilityBonus: 18,
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
    details.push('Completed the Care Pathway.');
  } else if (scoring.won) {
    details.push('Care Pathway incomplete.');
  }

  const efficient = scoring.turnsTaken <= rules.turnLimit;
  const safe = scoring.unsafeActionsUsed === 0;
  const poorOk = rules.allowOnePoorFit ? scoring.poorFitActionsUsed <= 1 : scoring.poorFitActionsUsed === 0;
  const reassessOk = !rules.requireReassess || scoring.reassessUsed;
  const consultsOk = (scoring.consultsUsed ?? 0) <= 1;
  const noEmergency = (scoring.emergencyCallsUsed ?? 0) === 0;
  const noInappropriate = (scoring.inappropriateConsultsUsed ?? 0) === 0;
  const lowBasicAid = (scoring.basicAidUses ?? 0) <= 2;

  const efficiencyCriteriaMet = efficient && safe && poorOk && reassessOk && consultsOk && noEmergency && noInappropriate && lowBasicAid;
  if (scoring.won && (scoring.fullChainCompleted || efficiencyCriteriaMet)) {
    stars++;
    details.push(efficiencyCriteriaMet ? 'Efficient and safe care.' : 'Clinical chain mastered.');
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
  chainAdvanced: PathwayRole | null;
  nextChainStep: PathwayRole | null;
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
  // Push 8: natural-language effect description — "Lowered Corruption by 11." is
  // easier to scan than "Disease Corruption -11." and matches the spec log examples.
  const effectStr = effectType === 'clue' ? '' :
    effectType === 'stability'  ? `Raised Stability by ${effectAmount}.` :
    effectType === 'corruption' ? `Lowered Corruption by ${effectAmount}.` :
    effectType === 'shield'     ? `Protection raised to ${effectAmount}%.` : '';

  if (feedbackLevel === 'expert') {
    // Expert: just the number — minimal noise, maximum density.
    return effectStr || `${eff}.`;
  }
  if (feedbackLevel === 'minimal') {
    // Minimal: effectiveness label + number on one line.
    return `${eff}. ${effectStr}`.trim();
  }
  if (feedbackLevel === 'standard') {
    // Standard: action name + label + number. Chain info appended inline.
    const chainStr = chainAdvanced ? ` Chain: ${chainAdvanced} complete.` : '';
    const fullChainStr = fullChainCompleted ? ' Full Care Pathway!' : '';
    return `${actionName}: ${eff}. ${effectStr}${chainStr}${fullChainStr}`.trim();
  }
  // supportive / guided — verbose, educational, multi-line.
  const why = rationale ? ` ${rationale}` : '';
  const chainLine = chainAdvanced ? `\nCare Pathway: ${chainAdvanced} complete.` : '';
  const nextStepLine = !fullChainCompleted && nextChainStep && chainAdvanced
    ? `\nNext: ${nextChainStep}.`
    : '';
  const fullChainLine = fullChainCompleted
    ? '\nComplete Care Pathway: assess, stabilize, treat, reassess.'
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

// ------------------------------------------------------------
// CLINICAL CUE — question-to-power
// ------------------------------------------------------------

export interface ClinicalCueOption {
  text: string;
  correct: boolean;
}

export type ClinicalCueTier = 'everyday' | 'body_basics' | 'symptom_cue' | 'clinical_judgment';

export const CUE_TIER_LABELS: Record<ClinicalCueTier, string> = {
  everyday: 'Everyday Health',
  body_basics: 'Body Basics',
  symptom_cue: 'Symptom Cue',
  clinical_judgment: 'Clinical Judgment',
};

export const CUE_TIER_NUMBER: Record<ClinicalCueTier, number> = {
  everyday: 1,
  body_basics: 2,
  symptom_cue: 3,
  clinical_judgment: 4,
};

export type ClinicalCueTopic =
  | 'oxygen_breathing'
  | 'heart_circulation'
  | 'hydration_kidneys'
  | 'blood_sugar_energy'
  | 'infection_inflammation'
  | 'brain_stress_sleep'
  | 'medication_safety'
  | 'assessment_reassessment'
  | 'nutrition_wellness';

export const CUE_TOPIC_LABELS: Record<ClinicalCueTopic, string> = {
  oxygen_breathing: 'Oxygen & Breathing',
  heart_circulation: 'Heart & Circulation',
  hydration_kidneys: 'Hydration & Kidneys',
  blood_sugar_energy: 'Blood Sugar & Energy',
  infection_inflammation: 'Infection & Inflammation',
  brain_stress_sleep: 'Brain, Stress & Sleep',
  medication_safety: 'Medication Safety',
  assessment_reassessment: 'Assessment & Reassessment',
  nutrition_wellness: 'Nutrition & Wellness',
};

// Maps an enemy's elemental system to the topic most cues should lean toward
// when that enemy is on screen, so the question feels connected to the fight.
export const SYSTEM_TO_CUE_TOPIC: Record<string, ClinicalCueTopic> = {
  Air: 'oxygen_breathing',
  River: 'hydration_kidneys',
  Energy: 'blood_sugar_energy',
  Fire: 'infection_inflammation',
  Storm: 'heart_circulation',
  Mind: 'brain_stress_sleep',
};

export const CUE_SAFETY_NOTE =
  'Clinical Cues teach general health-education concepts for the game — they are simplified for learning, are not medical advice, and should never be used to diagnose, treat, or make real-world care decisions. Always follow guidance from a qualified clinician.';

export interface ClinicalCueQuestion {
  id: string;
  tier: ClinicalCueTier;
  topic: ClinicalCueTopic;
  prompt: string;
  options: ClinicalCueOption[];
  rationale: string; // "Why it matters" — plain-language explanation of the concept
  battleTranslation: string; // how the concept maps to what's happening in the fight
  learnerNote?: string; // optional deeper note, used for Tier 3/4 (Symptom Cue / Clinical Judgment)
  codexEntryId?: string; // optional link into University/Codex learning entries
}

export const CLINICAL_CUES: ClinicalCueQuestion[] = [
  // ---------------- Tier 1: Everyday Health ----------------
  {
    id: 'cue_water_thirst',
    tier: 'everyday',
    topic: 'hydration_kidneys',
    prompt: 'Feeling thirsty and having darker urine are early signs your body needs...',
    options: [
      { text: 'More water', correct: true },
      { text: 'More sugar', correct: false },
      { text: 'Less rest', correct: false },
    ],
    rationale: 'Thirst and darker urine are your body\u2019s everyday signals that fluid levels are running low — drinking water restores balance before things get worse.',
    battleTranslation: 'The ward\u2019s River currents run low the same way — Hydration actions matter most when the warning signs appear early.',
    codexEntryId: 'hydration-basics',
  },
  {
    id: 'cue_rest_recover',
    tier: 'everyday',
    topic: 'nutrition_wellness',
    prompt: 'After a long, tiring day, what helps your body recover best?',
    options: [
      { text: 'Rest, food, and water', correct: true },
      { text: 'Skipping meals to save time', correct: false },
      { text: 'Ignoring how tired you feel', correct: false },
    ],
    rationale: 'Rest, nutrition, and hydration are the basic building blocks the body uses to repair and recharge every day.',
    battleTranslation: 'Stability in the ward works the same way — small, steady care keeps a patient from tipping into crisis.',
  },
  {
    id: 'cue_handwashing',
    tier: 'everyday',
    topic: 'infection_inflammation',
    prompt: 'What is the simplest, most effective everyday habit to prevent spreading illness?',
    options: [
      { text: 'Washing your hands regularly', correct: true },
      { text: 'Avoiding all fresh air', correct: false },
      { text: 'Only washing hands after eating', correct: false },
    ],
    rationale: 'Handwashing removes germs before they can spread to others or cause infection — it\u2019s one of the most effective everyday health habits there is.',
    battleTranslation: 'Blocking the spread of corruption before it takes hold is the same idea — prevention beats a bigger fight later.',
  },
  {
    id: 'cue_notice_change',
    tier: 'everyday',
    topic: 'assessment_reassessment',
    prompt: 'You notice something feels different about your body today. What is the best first step?',
    options: [
      { text: 'Pay attention and take note of what changed', correct: true },
      { text: 'Ignore it completely', correct: false },
      { text: 'Assume it will fix itself with no thought', correct: false },
    ],
    rationale: 'Noticing changes early — before jumping to conclusions — is the first step of clinical thinking: gather information before acting.',
    battleTranslation: 'Assessing for clues before choosing an action works the same way in the ward.',
    codexEntryId: 'what-is-a-clinical-cue',
  },
  // ---------------- Tier 2: Body Basics ----------------
  {
    id: 'cue_abc',
    tier: 'body_basics',
    topic: 'oxygen_breathing',
    prompt: 'Which comes first when prioritizing patient needs?',
    options: [
      { text: 'Airway', correct: true },
      { text: 'Circulation', correct: false },
      { text: 'Comfort', correct: false },
    ],
    rationale: 'Airway, Breathing, Circulation (ABC) — without an open airway, nothing else can be treated, so airway always comes first.',
    battleTranslation: 'Air-aligned foes threaten the airway first — clearing that threat opens the door to every other action.',
    codexEntryId: 'oxygenation-made-simple',
  },
  {
    id: 'cue_pulse_basics',
    tier: 'body_basics',
    topic: 'heart_circulation',
    prompt: 'A fast, weak pulse most often signals the body is trying to compensate for...',
    options: [
      { text: 'Reduced circulation or blood volume', correct: true },
      { text: 'Too much rest', correct: false },
      { text: 'Excess hydration', correct: false },
    ],
    rationale: 'When circulation drops, the heart beats faster to try to keep enough blood moving — a fast, weak pulse is an early compensation sign.',
    battleTranslation: 'Storm-aligned corruption strains circulation the same way, and needs stabilizing before it worsens.',
  },
  {
    id: 'cue_blood_sugar_basics',
    tier: 'body_basics',
    topic: 'blood_sugar_energy',
    prompt: 'Shakiness, sudden fatigue, and confusion can be everyday signs of...',
    options: [
      { text: 'Low blood sugar', correct: true },
      { text: 'Too much sleep', correct: false },
      { text: 'Perfect hydration', correct: false },
    ],
    rationale: 'The brain and muscles run on blood sugar for fuel — when it drops too low, shakiness, fatigue, and confusion are the body\u2019s warning signs.',
    battleTranslation: 'Energy-aligned foes drain the ward\u2019s reserves in a similar way — the pattern is the same, just at ward-scale.',
  },
  {
    id: 'cue_rebound',
    tier: 'body_basics',
    topic: 'assessment_reassessment',
    prompt: 'Corruption is dropping fast without reassessment. What is the risk?',
    options: [
      { text: 'A rebound worsening if the cause is not confirmed', correct: true },
      { text: 'No risk — lower corruption is always safe', correct: false },
      { text: 'The patient becomes immune to further disease', correct: false },
    ],
    rationale: 'Rapid improvement without reassessment can mask a worsening underlying cause — always confirm with reassessment before assuming the job is done.',
    battleTranslation: 'This is exactly why Reassess closes out the Care Pathway — confirming the win keeps it from unraveling.',
  },
  {
    id: 'cue_fever_basics',
    tier: 'body_basics',
    topic: 'infection_inflammation',
    prompt: 'A fever is generally best understood as...',
    options: [
      { text: 'The body\u2019s natural response while fighting an infection', correct: true },
      { text: 'A sign the body has stopped fighting', correct: false },
      { text: 'Always dangerous no matter how mild', correct: false },
    ],
    rationale: 'Fever is often a healthy sign the immune system is actively responding — it\u2019s a clue, not automatically a crisis.',
    battleTranslation: 'Fire-aligned corruption flares up the same way when the ward\u2019s defenses are actively engaged.',
  },
  // ---------------- Tier 3: Symptom Cue ----------------
  {
    id: 'cue_chain',
    tier: 'symptom_cue',
    topic: 'assessment_reassessment',
    prompt: 'What is the correct order of the Care Pathway?',
    options: [
      { text: 'Assess \u2192 Stabilize \u2192 Treat \u2192 Reassess', correct: true },
      { text: 'Treat \u2192 Assess \u2192 Stabilize \u2192 Reassess', correct: false },
      { text: 'Reassess \u2192 Treat \u2192 Assess \u2192 Stabilize', correct: false },
    ],
    rationale: 'Gather data (Assess), support the patient (Stabilize), treat the cause (Treat), then confirm (Reassess) — this order prevents treating the wrong problem.',
    battleTranslation: 'Following this order in battle is what unlocks full Care Pathway bonuses instead of partial credit.',
    learnerNote: 'In real practice this mirrors the nursing process: Assessment \u2192 Intervention \u2192 Evaluation, repeated continuously rather than done once.',
    codexEntryId: 'what-is-a-clinical-cue',
  },
  {
    id: 'cue_shortness_breath',
    tier: 'symptom_cue',
    topic: 'oxygen_breathing',
    prompt: 'A patient reports sudden shortness of breath with bluish lips. What does this combination most suggest?',
    options: [
      { text: 'A significant oxygenation problem needing urgent attention', correct: true },
      { text: 'Ordinary tiredness from exercise', correct: false },
      { text: 'A minor issue that can wait until tomorrow', correct: false },
    ],
    rationale: 'Bluish lips (cyanosis) paired with sudden shortness of breath signals the blood isn\u2019t carrying enough oxygen — a combination that needs prompt attention.',
    battleTranslation: 'Air-aligned enemies that spike quickly demand a fast, prioritized response for the same reason.',
    learnerNote: 'Cyanosis is a late sign of hypoxia — by the time it appears, oxygen saturation has often already dropped significantly.',
  },
  {
    id: 'cue_dehydration_signs',
    tier: 'symptom_cue',
    topic: 'hydration_kidneys',
    prompt: 'Sunken eyes, dry mouth, and reduced urine output together most likely point to...',
    options: [
      { text: 'Moderate to severe dehydration', correct: true },
      { text: 'Normal, healthy hydration', correct: false },
      { text: 'An unrelated skin condition', correct: false },
    ],
    rationale: 'These three signs together (not just one alone) form a pattern that reliably points to significant fluid loss.',
    battleTranslation: 'River-aligned corruption often shows multiple linked clues at once — spotting the pattern, not just one clue, sharpens the read.',
    learnerNote: 'Clustering findings rather than reacting to a single symptom is a core clinical-reasoning skill.',
  },
  {
    id: 'cue_infection_spread',
    tier: 'symptom_cue',
    topic: 'infection_inflammation',
    prompt: 'Redness, warmth, and spreading swelling around a wound most likely indicate...',
    options: [
      { text: 'A localized infection that could spread if untreated', correct: true },
      { text: 'A normal healing bruise', correct: false },
      { text: 'A sign of dehydration', correct: false },
    ],
    rationale: 'Redness, warmth, and spreading swelling are classic signs of infection — the "spreading" part is the key detail suggesting it needs treatment before it worsens.',
    battleTranslation: 'This is exactly why Infection Control matters against Fire-aligned foes with Corruption Spread — stopping the spread early prevents a bigger fight.',
    learnerNote: 'These are the classic local signs of infection: redness, warmth, swelling, and pain — spreading margins suggest it is not yet contained.',
  },
  {
    id: 'cue_low_energy_pattern',
    tier: 'symptom_cue',
    topic: 'blood_sugar_energy',
    prompt: 'Repeated episodes of shakiness, sweating, and confusion that improve quickly after eating suggest a pattern of...',
    options: [
      { text: 'Recurring low blood sugar episodes', correct: true },
      { text: 'A one-time random event', correct: false },
      { text: 'Normal daily energy dips', correct: false },
    ],
    rationale: 'When the same cluster of symptoms recurs and resolves with food, that repeating pattern points to a blood-sugar regulation issue, not a one-off.',
    battleTranslation: 'Energy-aligned foes that drain and recover in cycles are showing the same kind of repeating pattern to watch for.',
    learnerNote: 'Recognizing a pattern across multiple episodes (not just one) is what separates a coincidence from a clinical trend.',
  },
  // ---------------- Tier 4: Clinical Judgment ----------------
  {
    id: 'cue_priority',
    tier: 'clinical_judgment',
    topic: 'assessment_reassessment',
    prompt: 'A patient shows a new symptom. What comes first?',
    options: [
      { text: 'Assess before treating', correct: true },
      { text: 'Treat immediately, assess later', correct: false },
      { text: 'Wait for the doctor to arrive', correct: false },
    ],
    rationale: 'Assessment (gathering data) always precedes intervention — treating before you know what you\u2019re treating risks making the wrong call.',
    battleTranslation: 'Assessing clues before committing an action is what keeps Care Pathway bonuses on track instead of guessing.',
    learnerNote: 'This is the foundation of clinical judgment: data drives the plan, not the other way around.',
    codexEntryId: 'what-is-a-clinical-cue',
  },
  {
    id: 'cue_unsafe',
    tier: 'clinical_judgment',
    topic: 'medication_safety',
    prompt: 'An action is flagged unsafe for this patient. What should you do?',
    options: [
      { text: 'Avoid it and pick a safer action', correct: true },
      { text: 'Use it anyway for a faster win', correct: false },
      { text: 'Use it twice to be sure', correct: false },
    ],
    rationale: 'Unsafe actions can actively harm the patient — always choose the safer, clinically appropriate path even if it feels slower.',
    battleTranslation: 'This mirrors why unsafe actions in battle carry a real penalty instead of just being "less optimal."',
    learnerNote: 'In practice, "first, do no harm" outweighs speed — an unsafe shortcut is never worth the risk.',
  },
  {
    id: 'cue_competing_priorities',
    tier: 'clinical_judgment',
    topic: 'heart_circulation',
    prompt: 'Two patients need attention: one has a minor complaint, the other shows signs of poor circulation. Who is seen first?',
    options: [
      { text: 'The patient with signs of poor circulation', correct: true },
      { text: 'Whoever asked first', correct: false },
      { text: 'The patient with the minor complaint, since it\u2019s quicker', correct: false },
    ],
    rationale: 'Prioritization means addressing the most physiologically urgent need first, even if another request came in sooner.',
    battleTranslation: 'This is the same logic behind targeting the more dangerous threat first in a multi-enemy encounter.',
    learnerNote: 'This reflects real-world triage principles: severity and urgency outrank order of arrival.',
  },
  {
    id: 'cue_stress_sleep_link',
    tier: 'clinical_judgment',
    topic: 'brain_stress_sleep',
    prompt: 'A patient with ongoing poor sleep and high stress is also slower to recover from illness. What does this suggest?',
    options: [
      { text: 'Sleep and stress meaningfully affect the body\u2019s ability to heal', correct: true },
      { text: 'Sleep and stress have no effect on physical recovery', correct: false },
      { text: 'Only medication affects recovery speed', correct: false },
    ],
    rationale: 'Chronic stress and poor sleep impair immune function and healing — mind and body recovery are linked, not separate.',
    battleTranslation: 'Mind-aligned corruption drains stability the same way — calming and steadying a patient speeds every other treatment.',
    learnerNote: 'This connects to the mind-body link in clinical practice: psychosocial factors are part of the full clinical picture, not an afterthought.',
  },
  {
    id: 'cue_med_double_check',
    tier: 'clinical_judgment',
    topic: 'medication_safety',
    prompt: 'Before giving any treatment, what is the safest habit to build?',
    options: [
      { text: 'Double-check it is the right treatment for the right patient', correct: true },
      { text: 'Move as fast as possible without checking', correct: false },
      { text: 'Assume it is correct if it was correct last time', correct: false },
    ],
    rationale: 'A quick double-check before acting catches most preventable errors — speed should never replace verification.',
    battleTranslation: 'This is why confirming a clue before committing to a Treat action pays off more than rushing in.',
    learnerNote: 'This reflects core medication-safety practice: verifying before administering prevents the majority of avoidable errors.',
  },
];

export function getRandomClinicalCue(
  excludeIds: string[] = [],
  opts?: { chapter?: number; isBoss?: boolean; topicHint?: ClinicalCueTopic }
): ClinicalCueQuestion {
  const notExcluded = CLINICAL_CUES.filter(c => !excludeIds.includes(c.id));
  const base = notExcluded.length > 0 ? notExcluded : CLINICAL_CUES;

  const chapter = opts?.chapter ?? 1;
  const isBoss = !!opts?.isBoss;

  let allowedTiers: ClinicalCueTier[];
  if (isBoss) {
    allowedTiers = chapter >= 3 ? ['symptom_cue', 'clinical_judgment'] : ['body_basics', 'symptom_cue'];
  } else if (chapter <= 1) {
    allowedTiers = ['everyday', 'body_basics'];
  } else if (chapter === 2) {
    allowedTiers = ['everyday', 'body_basics', 'symptom_cue'];
  } else if (chapter === 3) {
    allowedTiers = ['body_basics', 'symptom_cue'];
  } else if (chapter === 4) {
    allowedTiers = ['symptom_cue', 'clinical_judgment'];
  } else {
    allowedTiers = ['symptom_cue', 'clinical_judgment'];
  }

  const tierPool = base.filter(c => allowedTiers.includes(c.tier));
  const pool = shuffleCues(tierPool.length > 0 ? tierPool : base);

  // Topic hint biases (but does not lock) selection toward the enemy's system,
  // so the same enemy no longer surfaces the same narrow question set every battle.
  if (opts?.topicHint && Math.random() < 0.6) {
    const topicMatches = pool.filter(c => c.topic === opts.topicHint);
    if (topicMatches.length > 0) return topicMatches[0];
  }

  return pool[0];
}

/** Fisher–Yates shuffle (returns a new array; source untouched). */
function shuffleCues(list: ClinicalCueQuestion[]): ClinicalCueQuestion[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ------------------------------------------------------------
// CLINICAL ARTS — role ultimates
// ------------------------------------------------------------

export interface UltimateDef {
  name: string;
  rpgFlavor: string;
  description: string;
}

export const ULTIMATE_BY_ROLE: Record<import('./types').HeroRole, UltimateDef> = {
  Assessor: {
    name: "Seer's Revelation",
    rpgFlavor: 'The Assessor pierces every veil at once, laying the full truth bare.',
    description: 'Reveals all remaining hidden clues.',
  },
  Stabilizer: {
    name: 'Ward of Renewal',
    rpgFlavor: 'A pulse of restorative light steadies the patient to their core.',
    description: 'Stability +30.',
  },
  Analyst: {
    name: "Diagnostic Cascade",
    rpgFlavor: "The Analyst's insight strikes the corruption at its root.",
    description: 'Corruption -25 with full clinical bonuses.',
  },
  Coordinator: {
    name: 'Rally of the Ward',
    rpgFlavor: 'The Coordinator\u2019s call refreshes every hero for one more action.',
    description: 'Resets all hero actions for this turn.',
  },
  Educator: {
    name: "Lantern of Understanding",
    rpgFlavor: 'The Educator\u2019s lantern illuminates the safest path forward.',
    description: 'Reveals 2 hidden clues and grants Protection.',
  },
  Specialist: {
    name: 'Precision Strike',
    rpgFlavor: 'The Specialist channels every ounce of expertise into one perfect strike.',
    description: 'Corruption -30, ignoring resistance.',
  },
  Scout: {
    name: 'Eyes of the Ward',
    rpgFlavor: 'The Scout reads the room before anyone else even looks up.',
    description: 'Reveals all hidden clues.',
  },
  Striker: {
    name: 'Decisive Blow',
    rpgFlavor: 'The Striker commits everything to one devastating intervention.',
    description: 'Corruption -35.',
  },
  Restorer: {
    name: 'Full Recovery',
    rpgFlavor: 'The Restorer pours every last drop of energy into the patient.',
    description: 'Stability +35.',
  },
  Preventer: {
    name: 'Protective Seal',
    rpgFlavor: 'The Preventer raises a barrier the disease cannot cross.',
    description: 'Protection 30 and blocks next Corruption Spread.',
  },
  SystemsLeader: {
    name: 'Grand Rounds',
    rpgFlavor: 'The Systems Leader organizes the entire ward in one sweeping motion.',
    description: 'Resets all hero actions and grants bonus AP.',
  },
};

export const ULTIMATE_CHARGE_MAX = 100;
