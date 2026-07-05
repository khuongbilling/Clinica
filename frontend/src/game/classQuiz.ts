// Shared class-diagnostic quiz data + scoring.
//
// This is the single source of truth for the "Codex Awakening" class quiz.
// It is used by the live post-recall onboarding flow (app/post-recall.tsx),
// which runs the quiz AFTER the prologue tutorial battle + Lotus Recall +
// name entry and applies the result to the existing player.
//
// NOTE: app/onboarding.tsx is the older, unlinked create-a-new-player flow
// and keeps its own private copy of this data. The reachable quiz is the one
// wired through this module.

export type QuizAnswers = {
  learningGoal: string;   // Q1 → learning_profile / codex_depth
  challenge: string;      // Q2 → difficulty
  healerStyle: string;    // Q3 → player_class / aptitude
  fantasyRole: string;    // Q4 → system_affinity
  learningStyle: string;  // Q5 → explanation_style
};

export type QuizChoice = { label: string; value: string; icon: string };
export type QuizQuestion = {
  id: keyof QuizAnswers;
  progress: string;
  kicker: string;
  title: string;
  choices: QuizChoice[];
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'learningGoal',
    progress: '1 / 5',
    kicker: 'CODEX AWAKENING · LEARNING GOAL',
    title: 'Why did the Codex call you?',
    choices: [
      { label: 'I am curious about medicine and want to learn in a fun way.', value: 'curious', icon: 'bulb-outline' },
      { label: 'I am learning anatomy, physiology, or healthcare basics.', value: 'medical_learner', icon: 'book-outline' },
      { label: 'I am a nursing or healthcare student.', value: 'nursing_student', icon: 'medkit-outline' },
      { label: 'I am preparing for NCLEX or clinical judgment exams.', value: 'nclex', icon: 'clipboard-outline' },
      { label: 'I already work in healthcare and want a light review.', value: 'professional', icon: 'pulse-outline' },
    ],
  },
  {
    id: 'challenge',
    progress: '2 / 5',
    kicker: 'CODEX AWAKENING · CHALLENGE LEVEL',
    title: 'How much guidance do you want in battle?',
    choices: [
      { label: 'Guide me closely. I am new.', value: 'guided', icon: 'compass-outline' },
      { label: 'Give me some clues, but let me think.', value: 'standard', icon: 'shield-half-outline' },
      { label: 'Hide more clues so I can practice reasoning.', value: 'clinical', icon: 'eye-outline' },
      { label: 'Make it like clinical judgment. I want to assess first.', value: 'nclex', icon: 'clipboard-outline' },
      { label: 'Challenge me with changing conditions later.', value: 'expert_later', icon: 'trending-up-outline' },
    ],
  },
  {
    id: 'healerStyle',
    progress: '3 / 5',
    kicker: 'CODEX AWAKENING · HEALER STYLE',
    title: 'When a patient is in danger, what do you do first?',
    choices: [
      { label: 'Protect them and buy time.', value: 'Guardian', icon: 'shield-outline' },
      { label: 'Look for clues before acting.', value: 'Seer', icon: 'search-outline' },
      { label: 'Treat the main problem quickly.', value: 'Interventionist', icon: 'flash-outline' },
      { label: 'Coordinate the team and resources.', value: 'Coordinator', icon: 'people-outline' },
      { label: 'Prevent harm before it happens.', value: 'Protector', icon: 'lock-closed-outline' },
    ],
  },
  {
    id: 'fantasyRole',
    progress: '4 / 5',
    kicker: 'CODEX AWAKENING · BODY-SYSTEM AFFINITY',
    title: 'Which healer path calls to you?',
    choices: [
      { label: 'Air Temple Guardian — breathing and oxygenation.', value: 'Air', icon: 'partly-sunny-outline' },
      { label: 'River Gate Healer — circulation and flow.', value: 'River', icon: 'water-outline' },
      { label: 'Fire Ward Purifier — infection and inflammation.', value: 'Fire', icon: 'flame-outline' },
      { label: 'Energy Shrine Alchemist — glucose, fuel, and balance.', value: 'Energy', icon: 'battery-charging-outline' },
      { label: 'Mind Lantern Guide — mental status and safety.', value: 'Mind', icon: 'moon-outline' },
    ],
  },
  {
    id: 'learningStyle',
    progress: '5 / 5',
    kicker: 'CODEX AWAKENING · LEARNING STYLE',
    title: 'How do you like to learn?',
    choices: [
      { label: 'Simple story first, medical meaning after.', value: 'fantasy_first', icon: 'book-outline' },
      { label: 'Visual examples and short definitions.', value: 'visual_medical', icon: 'images-outline' },
      { label: 'Clinical reasoning and patient care steps.', value: 'clinical_reasoning', icon: 'list-outline' },
      { label: 'NCLEX-style cues, priorities, and rationales.', value: 'nclex_judgment', icon: 'checkmark-circle-outline' },
      { label: 'Brief professional terms without too much explanation.', value: 'professional_brief', icon: 'speedometer-outline' },
    ],
  },
];

export const CLASS_APTITUDE: Record<string, string> = {
  Guardian: 'guardian',
  Seer: 'sage',
  Interventionist: 'guardian',
  Coordinator: 'warden',
  Protector: 'warden',
};

export const CLASS_APTITUDE_HERO: Record<string, string> = {
  guardian: 'Novice Guardian',
  sage: 'Apprentice Seer',
  warden: 'Junior Warden',
};

export const CLASS_CLINICAL: Record<string, string> = {
  Guardian: 'Stabilization and patient safety',
  Seer: 'Assessment and cue recognition',
  Interventionist: 'Targeted intervention and decisive action',
  Coordinator: 'Care coordination and resource use',
  Protector: 'Prevention, safety, and harm reduction',
};

export const CLASS_DESCRIPTION: Record<string, string> = {
  Guardian: 'You protect patients by keeping them stable, reading clues, and restoring breath when the windways tighten.',
  Seer: 'You see what others miss — revealing hidden clues and understanding patterns before acting.',
  Interventionist: 'You act decisively once the priority is clear. Speed and precision are your strengths.',
  Coordinator: 'You manage flow, resources, and priorities under pressure. The team moves with you.',
  Protector: 'You prevent harm before it arrives. Safety, barriers, and vigilance define your path.',
};

export const SYSTEM_LABEL: Record<string, string> = {
  Air: 'Air Temple',
  River: 'River',
  Fire: 'Fire Ward',
  Energy: 'Energy Shrine',
  Mind: 'Mind Lantern',
};

export const SYSTEM_COLOR: Record<string, string> = {
  Air: '#4CA8E8',
  River: '#3B9FD8',
  Fire: '#E87A4C',
  Energy: '#F5C842',
  Mind: '#B48AE8',
};

export const PROFILE_LABEL: Record<string, string> = {
  curious: 'Curious Learner',
  medical_learner: 'Medical Learner',
  nursing_student: 'Nursing Student',
  nclex: 'NCLEX Preparer',
  professional: 'Healthcare Professional',
};

export const PROFILE_DEPTH: Record<string, string> = {
  curious: 'simple',
  medical_learner: 'simple',
  nursing_student: 'nursing',
  nclex: 'nclex',
  professional: 'professional',
};

export const DIFF_LABEL: Record<string, string> = {
  guided: 'Guided — More clues visible',
  standard: 'Standard — Balanced challenge',
  clinical: 'Clinical — Fewer hints, more reasoning',
  nclex: 'NCLEX — All clues hidden',
  expert_later: 'Clinical (Expert unlocks later)',
};

export const DIFF_VALUE: Record<string, string> = {
  guided: 'guided',
  standard: 'standard',
  clinical: 'clinical',
  nclex: 'nclex',
  expert_later: 'clinical',
};

export const DEFAULTS: QuizAnswers = {
  learningGoal: 'curious',
  challenge: 'guided',
  healerStyle: 'Guardian',
  fantasyRole: 'Air',
  learningStyle: 'fantasy_first',
};

export type ClassProfile = {
  aptitude: string;
  player_class: string;
  learning_profile: string;
  difficulty: string;
  system_affinity: string;
  explanation_style: string;
  codex_depth: string;
  pathTitle: string;
  classDescription: string;
  clinicalStyle: string;
  firstHero: string;
  profileLabel: string;
  diffLabel: string;
  accentColor: string;
};

// Turns raw quiz answers (with any gaps filled by DEFAULTS) into the concrete
// player-facing class profile + display strings. Used both to render the
// result screen and to persist onto the player.
export function computeClassProfile(answers: Partial<QuizAnswers>): ClassProfile {
  const a: QuizAnswers = { ...DEFAULTS, ...answers };
  const aptitude = CLASS_APTITUDE[a.healerStyle] || 'guardian';
  return {
    aptitude,
    player_class: a.healerStyle,
    learning_profile: a.learningGoal,
    difficulty: DIFF_VALUE[a.challenge] || a.challenge,
    system_affinity: a.fantasyRole,
    explanation_style: a.learningStyle,
    codex_depth: PROFILE_DEPTH[a.learningGoal] || 'simple',
    pathTitle: `${SYSTEM_LABEL[a.fantasyRole] ?? a.fantasyRole} ${a.healerStyle}`,
    classDescription: CLASS_DESCRIPTION[a.healerStyle] || '',
    clinicalStyle: CLASS_CLINICAL[a.healerStyle] || '',
    firstHero: CLASS_APTITUDE_HERO[aptitude] || 'Novice Guardian',
    profileLabel: PROFILE_LABEL[a.learningGoal] || a.learningGoal,
    diffLabel: DIFF_LABEL[a.challenge] || a.challenge,
    accentColor: SYSTEM_COLOR[a.fantasyRole] || '#3B9FD8',
  };
}
