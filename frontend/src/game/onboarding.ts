import { Aptitude } from './types';

// ---------- Calling Quiz ----------
export interface QuizQuestion {
  id: string;
  prompt: string;
  answers: { text: string; aptitude: Aptitude }[];
}

export const CALLING_QUIZ: QuizQuestion[] = [
  {
    id: 'q1',
    prompt: 'A patient suddenly worsens. What do you do first?',
    answers: [
      { text: 'Rush in and stabilize them.', aptitude: 'guardian' },
      { text: 'Look for the clue everyone missed.', aptitude: 'sage' },
      { text: 'Organize the team and assign tasks.', aptitude: 'warden' },
      { text: 'Check the trend to predict what happens next.', aptitude: 'weaver' },
    ],
  },
  {
    id: 'q2',
    prompt: 'Your strength as a healer is:',
    answers: [
      { text: 'Staying calm in crisis.', aptitude: 'guardian' },
      { text: 'Seeing patterns in symptoms.', aptitude: 'sage' },
      { text: 'Protecting people from harm.', aptitude: 'warden' },
      { text: 'Understanding data and systems.', aptitude: 'weaver' },
    ],
  },
  {
    id: 'q3',
    prompt: 'Which relic would you choose?',
    answers: [
      { text: 'Shield of Stability', aptitude: 'guardian' },
      { text: 'Lantern of Insight', aptitude: 'sage' },
      { text: 'Banner of Command', aptitude: 'warden' },
      { text: 'Thread of Patterns', aptitude: 'weaver' },
    ],
  },
];

const TIE_PRIORITY: Aptitude[] = ['guardian', 'sage', 'warden', 'weaver'];

export function scoreQuiz(picks: Aptitude[]): Aptitude {
  const tally: Record<Aptitude, number> = { guardian: 0, sage: 0, warden: 0, weaver: 0 };
  picks.forEach(a => { tally[a] += 1; });
  const max = Math.max(...Object.values(tally));
  for (const apt of TIE_PRIORITY) {
    if (tally[apt] === max) return apt;
  }
  return 'guardian';
}

// ---------- Aptitude Descriptions ----------
export const APTITUDE_RESULT: Record<Aptitude, { title: string; body: string; bonus: string; startingHero: string }> = {
  guardian: {
    title: 'The Codex calls you: Guardian',
    body: 'You protect life when balance begins to fall. Guardians are stabilizers who act quickly when Air, River, or Energy begins to collapse.',
    bonus: 'Guardian Bonus: Each turn, reduce Stability loss by 5.',
    startingHero: 'Novice Guardian',
  },
  sage: {
    title: 'The Codex calls you: Sage',
    body: 'You see what others miss. Sages reveal hidden clues and help the team understand what is really happening.',
    bonus: 'Sage Bonus: The first Scout action each battle costs 1 less AP.',
    startingHero: 'Apprentice Seer',
  },
  warden: {
    title: 'The Codex calls you: Warden',
    body: 'You protect the team and prevent harm before it happens. Wardens command resources, block complications, and keep the realm safe.',
    bonus: 'Warden Bonus: Block one minor safety complication at battle start.',
    startingHero: 'Junior Warden',
  },
  weaver: {
    title: 'The Codex calls you: Weaver',
    body: 'You see the threads between clues, trends, and systems. Weavers predict what will worsen before the crisis arrives.',
    bonus: 'Weaver Bonus: One hidden clue is revealed at battle start.',
    startingHero: 'Data Acolyte',
  },
};

// ---------- Learning Profiles ----------
// Maps to the clinical-layer LearningProfile (clinical.ts).
// `id` is used as `learning_profile`. `depth` is kept for codex copy compatibility.
export const LEARNING_GOALS = [
  { id: 'nonmedical', label: 'I want to learn how the body works.', sublabel: 'Guided lessons in plain language.', depth: 'simple' },
  { id: 'preNursing', label: 'I am preparing for nursing or healthcare school.', sublabel: 'Foundational nursing concepts.', depth: 'foundation' },
  { id: 'nursingStudent', label: 'I am in nursing school.', sublabel: 'Clinical judgment focus.', depth: 'clinical' },
  { id: 'nclexPrep', label: 'I am preparing for NCLEX.', sublabel: 'NCLEX-lens with stricter feedback.', depth: 'nclex' },
  { id: 'healthcareProfessional', label: 'I work in healthcare.', sublabel: 'Concise clinical synthesis.', depth: 'professional' },
] as const;

export const DEPTH_LABEL: Record<string, string> = {
  simple: 'General Reading',
  foundation: 'Foundations',
  clinical: 'Clinical Judgment',
  nclex: 'NCLEX Lens',
  professional: 'Clinical Concise',
};

export const DEPTH_INTRO: Record<string, string> = {
  simple: 'Reading in plain language. Focus on how the body works.',
  foundation: 'Reading at a foundational nursing level. Concepts and basics.',
  clinical: 'Reading with clinical reasoning. Cues, priorities, interventions.',
  nclex: 'Reading through the NCLEX lens: recognize cues, analyze, prioritize, act, evaluate.',
  professional: 'Concise clinical synthesis for practicing professionals.',
};

// ---------- Mentor's Guidance Hints ----------
export interface EnemyHint {
  gentle: string;
  tactical: string;
}

export const ENEMY_HINTS: Record<string, EnemyHint> = {
  air_sprite: {
    gentle: 'Breathing clues often point to the Air system. Revealing the hidden clue may strengthen your next move.',
    tactical: 'Try Reveal Cue first. If the hidden clue is wheezing, Open Airflow becomes a strong counter.',
  },
  energy_lock: {
    gentle: 'Shaking, sweating, and confusion may mean the Energy system is unstable.',
    tactical: 'Try Reveal Cue to check for low glucose. If low glucose is revealed, fast stabilization is the strongest counter.',
  },
  fire_imp: {
    gentle: 'Fever and chills may mean the Fire system is spreading.',
    tactical: 'Try Reveal Cue to look for an infection source, then use Containment Order or Purification Strike.',
  },
  river_sludge: {
    gentle: 'Pale skin, dizziness, and fast pulse may mean the River system is weak.',
    tactical: 'Try Reveal Cue to check for low blood pressure, then stabilize before striking.',
  },
  mind_fog: {
    gentle: 'Confusion and agitation may signal the Mind system is faltering — and the patient may be unsafe.',
    tactical: 'Shield against the danger trigger, then reveal the hidden cause (often an infection or imbalance).',
  },
  septara_seed: {
    gentle: 'Fever plus fast pulse plus confusion is the Codex pattern for systemic infection.',
    tactical: 'Reveal the hidden BP and lactate clues, then stabilize circulation before striking the infection source.',
  },
  cardion_echo: {
    gentle: 'Crackles and swelling mean fluid has backed up. Be careful what you give.',
    tactical: 'Aggressive Fluid Surge worsens Cardion. Use Air Blessing and stabilizing actions instead.',
  },
  glycora_spark: {
    gentle: 'Very high glucose with deep rapid breathing means the Energy system has tipped into acid.',
    tactical: 'Reveal the hidden potassium first. Insulin without checking K⁺ can be dangerous — stabilize first.',
  },
  pulmora_wisp: {
    gentle: 'Pursed-lip breathing and barrel chest point to trapped air.',
    tactical: 'Support oxygenation gently. Watch CO₂ retention — reveal the hidden clue before striking.',
  },
  electrox_flicker: {
    gentle: 'Weakness and rhythm changes point to the Storm system.',
    tactical: 'Reveal the hidden potassium value. Cleanse and stabilize rhythm before striking.',
  },
  lord_imbalance: {
    gentle: 'Multiple systems are failing at once. The Codex teaches: airway first, then circulation, then disability.',
    tactical: 'Reveal both hidden clues, shield against the danger trigger, then strike the system most at risk.',
  },
};

export function getEnemyHint(enemyId: string): EnemyHint {
  return ENEMY_HINTS[enemyId] || {
    gentle: 'The Codex whispers: study the visible clues, then reveal what is hidden.',
    tactical: 'Reveal the hidden clue first. Match your strikes to the affected system.',
  };
}
