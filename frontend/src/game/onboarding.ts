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
// Each profile captures who the player is and sets tone for Codex copy,
// hint language, and mission briefings throughout the game.
//
// `tone`:
//   'rpg'        — anime / RPG / cozy fantasy fans: fantasy flavor first, medicine second
//   'curious'    — parents, teens, curious learners: plain language, wonder-driven
//   'explorer'   — people interested in the body: anatomy + story blend
//   'foundation' — pre-med / pre-nursing / health science students: concepts + basics
//   'clinical'   — nursing students: clinical reasoning, cues, priorities
//   'nclex'      — NCLEX learners: strict lens, high feedback
//   'professional'— practicing nurses / healthcare workers: concise synthesis

export interface LearningGoal {
  id: string;
  label: string;
  sublabel: string;
  depth: string;
  tone: string;
  icon: string;
  // Short flavor text shown on the trial intro screen, tuned to this audience
  trialIntro: string;
  // One-line Codex voice — how hints and Codex pages open for this profile
  codexVoice: string;
}

export const LEARNING_GOALS: LearningGoal[] = [
  {
    id: 'rpg',
    label: "I'm here for the RPG — the medicine is a bonus.",
    sublabel: 'Fantasy story, battles, and world-building first.',
    depth: 'simple',
    tone: 'rpg',
    icon: 'game-controller',
    trialIntro:
      'A crystal corruption stirs in the Air Temple. Your healer team reads the signs, battles the disease, and restores the kingdom — one fight at a time. The Codex will explain what each clue means in plain language so the story always makes sense.',
    codexVoice: 'The Codex whispers:',
  },
  {
    id: 'cozy',
    label: "I want a cozy fantasy world with gentle learning.",
    sublabel: 'Low pressure, good vibes, body knowledge as lore.',
    depth: 'simple',
    tone: 'rpg',
    icon: 'leaf',
    trialIntro:
      'The first corruption is gentle — a mist in the Air Temple. There is no rush. Read the clues at your pace, keep the patient stable, and the Codex will explain every step. This is your kingdom to restore.',
    codexVoice: 'The Codex gently notes:',
  },
  {
    id: 'curious',
    label: "I'm curious about how the human body works.",
    sublabel: 'Plain language, no prior knowledge needed.',
    depth: 'simple',
    tone: 'curious',
    icon: 'bulb',
    trialIntro:
      'The Air system is the body\'s breathing kingdom — lungs, airways, oxygen. A corruption is blocking airflow. Your team will read clues like "oxygen saturation dropping" and choose actions that fix it. Every clue is explained in plain language.',
    codexVoice: 'The Codex explains:',
  },
  {
    id: 'teen',
    label: "I'm a student exploring health and science.",
    sublabel: 'Great for high school students or anyone starting out.',
    depth: 'simple',
    tone: 'curious',
    icon: 'school',
    trialIntro:
      'This is your first battle in the kingdom — and the best way to learn is by doing. The Air Crystal needs you. Read the patient\'s clues, pick the right actions, and the Codex will explain the real science behind everything that happens.',
    codexVoice: 'The Codex teaches:',
  },
  {
    id: 'preNursing',
    label: "I'm preparing for nursing or healthcare school.",
    sublabel: 'Foundational nursing concepts and body systems.',
    depth: 'foundation',
    tone: 'foundation',
    icon: 'heart',
    trialIntro:
      'The Air system maps to respiratory physiology — the lungs, airways, and oxygenation. Your first encounter introduces the Scout → Stabilize → Counter → Reassess care chain. Every action teaches a foundational concept you\'ll see again in school.',
    codexVoice: 'The Codex notes:',
  },
  {
    id: 'nursingStudent',
    label: "I'm in nursing school right now.",
    sublabel: 'Clinical judgment, SBAR, cue recognition.',
    depth: 'clinical',
    tone: 'clinical',
    icon: 'medkit',
    trialIntro:
      'SpO₂ dropping. Respiratory rate elevated. A hidden clue — potentially wheeze — is not yet visible. Apply the clinical care chain: recognize cues → analyze → prioritize → intervene → evaluate. The Codex gives NCLEX-adjacent feedback after each battle.',
    codexVoice: 'Clinical note:',
  },
  {
    id: 'nclexPrep',
    label: "I'm preparing for the NCLEX.",
    sublabel: 'Strict clinical lens, prioritization, safety focus.',
    depth: 'nclex',
    tone: 'nclex',
    icon: 'clipboard',
    trialIntro:
      'Apply NGN clinical judgment: recognize cues, analyze findings, prioritize hypotheses, generate solutions, take action, evaluate outcomes. This encounter tests respiratory cue recognition. The Codex provides post-battle NCLEX-style rationale.',
    codexVoice: 'NCLEX lens:',
  },
  {
    id: 'healthcareProfessional',
    label: "I work in healthcare or nursing.",
    sublabel: 'Concise clinical synthesis, professional framing.',
    depth: 'professional',
    tone: 'professional',
    icon: 'pulse',
    trialIntro:
      'Respiratory presentation — likely acute bronchospasm or early decompensation. Triage visible findings, reveal the hidden clue, and apply the strongest targeted intervention. The Codex provides concise clinical synthesis without hand-holding.',
    codexVoice: 'Clinically:',
  },
];

// Map old profile IDs to new ones for backward compatibility
export const PROFILE_ID_COMPAT: Record<string, string> = {
  nonmedical: 'curious',
  preNursing: 'preNursing',
  nursingStudent: 'nursingStudent',
  nclexPrep: 'nclexPrep',
  healthcareProfessional: 'healthcareProfessional',
};

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

// Tone guide for each profile — used by copy and hints throughout the game
export const TONE_GUIDE: Record<string, { codexOpener: string; hintStyle: string; victoryLine: string; defeatLine: string }> = {
  rpg: {
    codexOpener: 'The Codex whispers:',
    hintStyle: 'fantasy flavor → plain meaning',
    victoryLine: 'The corruption is purified. The kingdom breathes again.',
    defeatLine: 'The darkness held. But every healer learns from loss.',
  },
  curious: {
    codexOpener: 'The Codex explains:',
    hintStyle: 'plain language, body-first',
    victoryLine: 'You understood the body and restored it. Well done.',
    defeatLine: 'The body is complex. The Codex has more to teach.',
  },
  foundation: {
    codexOpener: 'The Codex notes:',
    hintStyle: 'nursing concepts, approachable',
    victoryLine: 'Strong foundational care. The region is restored.',
    defeatLine: 'Review the care chain and try again — this is how nurses learn.',
  },
  clinical: {
    codexOpener: 'Clinical note:',
    hintStyle: 'SBAR, cue recognition, priority framing',
    victoryLine: 'Sound clinical judgment. Region restored.',
    defeatLine: 'Reassess the cue priority order and retry.',
  },
  nclex: {
    codexOpener: 'NCLEX lens:',
    hintStyle: 'NGN format, recognize → analyze → prioritize → act → evaluate',
    victoryLine: 'Correct prioritization and intervention. Region restored.',
    defeatLine: 'Revisit the clinical priority hierarchy and re-enter.',
  },
  professional: {
    codexOpener: 'Clinically:',
    hintStyle: 'concise, no hand-holding',
    victoryLine: 'Targeted intervention. Region restored.',
    defeatLine: 'Suboptimal intervention sequence. Review and re-enter.',
  },
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
