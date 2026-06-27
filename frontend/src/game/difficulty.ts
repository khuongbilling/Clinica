/**
 * Difficulty system — Clinica: Kingdom of Healing
 *
 * Difficulty is SEPARATE from LearningProfile:
 *   LearningProfile → explanation language/depth
 *   DifficultyLevel → clue visibility + hint strength + pressure
 *
 * A player can combine NCLEX explanations with Guided difficulty,
 * or Curious explanations with NCLEX difficulty — fully independent.
 */

export type DifficultyLevel = 'guided' | 'standard' | 'clinical' | 'nclex' | 'expert';

export const DIFFICULTY_ORDER: DifficultyLevel[] = ['guided', 'standard', 'clinical', 'nclex', 'expert'];

export interface DifficultyModifier {
  visibleClues: number;
  enemyDamageMultiplier: number;
  wrongActionPenaltyBonus: number;
  hintLevel: 'strong' | 'normal' | 'light' | 'minimal';
  starTurnBonus: number;
  rewardMultiplier: number;
}

export const DIFFICULTY_MODIFIERS: Record<DifficultyLevel, DifficultyModifier> = {
  guided: {
    visibleClues: 3,
    enemyDamageMultiplier: 0.75,
    wrongActionPenaltyBonus: 0,
    hintLevel: 'strong',
    starTurnBonus: 1,
    rewardMultiplier: 1.0,
  },
  standard: {
    visibleClues: 2,
    enemyDamageMultiplier: 1.0,
    wrongActionPenaltyBonus: 0,
    hintLevel: 'normal',
    starTurnBonus: 0,
    rewardMultiplier: 1.1,
  },
  clinical: {
    visibleClues: 1,
    enemyDamageMultiplier: 1.15,
    wrongActionPenaltyBonus: 1,
    hintLevel: 'light',
    starTurnBonus: -1,
    rewardMultiplier: 1.25,
  },
  nclex: {
    visibleClues: 0,
    enemyDamageMultiplier: 1.25,
    wrongActionPenaltyBonus: 2,
    hintLevel: 'minimal',
    starTurnBonus: -1,
    rewardMultiplier: 1.4,
  },
  expert: {
    visibleClues: 0,
    enemyDamageMultiplier: 1.4,
    wrongActionPenaltyBonus: 3,
    hintLevel: 'minimal',
    starTurnBonus: -2,
    rewardMultiplier: 1.6,
  },
};

export function getDifficultyModifier(level: DifficultyLevel | undefined): DifficultyModifier {
  return DIFFICULTY_MODIFIERS[level ?? 'standard'];
}

export const DEFAULT_DIFFICULTY_BY_PROFILE: Record<string, DifficultyLevel> = {
  // New quiz IDs
  curious: 'guided',
  medical_learner: 'standard',
  nursing_student: 'clinical',
  nclex: 'nclex',
  professional: 'clinical',
  // Legacy onboarding IDs
  rpg: 'guided',
  cozy: 'guided',
  teen: 'guided',
  preNursing: 'standard',
  nursingStudent: 'clinical',
  nclexPrep: 'nclex',
  healthcareProfessional: 'clinical',
  nonmedical: 'guided',
};

export const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  guided: 'Guided',
  standard: 'Standard',
  clinical: 'Clinical',
  nclex: 'NCLEX',
  expert: 'Expert',
};

export const DIFFICULTY_SUBLABEL: Record<DifficultyLevel, string> = {
  guided: 'More clues visible. Stronger hints. Best for new players.',
  standard: 'Balanced challenge. Some clues visible, some hidden.',
  clinical: 'Fewer hints. More clues hidden. Reasoning matters more.',
  nclex: 'All clues hidden. Recognize cues to succeed.',
  expert: 'Hardest mode. All clues hidden. Conditions may evolve.',
};

export const DIFFICULTY_ICON: Record<DifficultyLevel, string> = {
  guided: 'compass',
  standard: 'shield-half',
  clinical: 'eye',
  nclex: 'clipboard',
  expert: 'skull',
};

export const WRONG_ACTION_FEEDBACK: Record<DifficultyLevel, string> = {
  guided:   'This helped only a little. The clues point more toward breathing. Try revealing a clue or using an Air action.',
  standard: 'Limited effect. This action does not match the main pattern.',
  clinical: 'Poor clinical fit. Reassess the cues and identify the priority system.',
  nclex:    'Intervention does not address the priority cues. Re-evaluate data before taking action.',
  expert:   'Unsafe or low-yield action. Patient condition may worsen if priority is missed.',
};

export const HINT_INTRO_BY_DIFFICULTY: Record<DifficultyLevel, string> = {
  guided:   'Likely System: Air. Try revealing the hidden clue, then use an Air skill.',
  standard: 'The clues point toward breathing difficulty. Air actions may help.',
  clinical: 'Current cues suggest a respiratory pattern. Confirm with assessment.',
  nclex:    'Recognize cues before selecting an intervention.',
  expert:   'The patient\'s condition may change. Reassess to detect the new priority.',
};

export const OBJECTIVE_BY_DIFFICULTY: Record<DifficultyLevel, string> = {
  guided:   'Reveal clue → Stabilize → Use matching skill → Reassess',
  standard: 'Scout → Stabilize → Counter → Reassess',
  clinical: 'Recognize pattern → Stabilize if needed → Treat priority → Reassess',
  nclex:    'Recognize Cues → Prioritize → Take Action → Evaluate Outcomes',
  expert:   'Priority may change. Reassess trends and respond safely.',
};
