// Push 3/4 — System personality/career quiz + Automated Class Assignment,
// class-result lore translation, and confirmation copy.
//
// This is the single source of truth for the post-recall class-diagnostic
// quiz and its result-screen flavor content. It is used by the live
// post-recall onboarding flow (app/post-recall.tsx), which runs the quiz
// AFTER the prologue tutorial battle + Lotus Recall + name entry.
//
// Scope note (Push 3): scores a recommendation (primary fantasy class,
// modern department resonance, second closest fit) or generates an
// Automated Class Assignment.
// Scope note (Push 4): adds the lore/flavor content (class title, "why this
// fits", future path hint) shown on the result screen, and the confirmation
// SYSTEM-message copy. Saving the choice onto the player is handled by
// store.confirmClassDiagnostic, which writes into the EXISTING class_tree_id
// field from classTree.ts (see fantasyClassFromClassId/classIdFromFantasyClass
// below for the two-way mapping) — no new PlayerState fields are introduced.
// Starting-trait text is intentionally NOT duplicated here; it is read live
// from classTree.ts's CLASS_TREES (Lv1 card) so the two systems never drift.
// Reminiscence, University transition, Lotus Lessons, and simulation
// chapters remain Push 5+ work.
//
// NOTE: app/onboarding.tsx is the older, unlinked create-a-new-player flow
// and keeps its own private copy of quiz-like data. The reachable quiz is
// the one wired through this module.

import type { ClassId } from './classTree';

export const FANTASY_CLASSES = ['Guardian', 'Seer', 'Caretaker', 'Scholar', 'Alchemist', 'Medic'] as const;
export type FantasyClass = (typeof FANTASY_CLASSES)[number];

// classTree.ts's ClassId values are exactly the lowercase form of
// FANTASY_CLASSES — this mapping is guaranteed stable by that shared
// vocabulary (both lists are hand-kept in sync; a mismatch would break
// class-tree lookups immediately and loudly, not silently).
export function classIdFromFantasyClass(cls: FantasyClass): ClassId {
  return cls.toLowerCase() as ClassId;
}

export function fantasyClassFromClassId(id: ClassId): FantasyClass {
  return (id.charAt(0).toUpperCase() + id.slice(1)) as FantasyClass;
}

export type QuestionId = 'q1' | 'q2' | 'q3' | 'q4' | 'q5';

export type QuizChoice = {
  value: string;
  label: string;
  icon: string;
  // Most choices resonate with exactly one class, but a few intentionally
  // resonate with two (e.g. "Clinic — everyday health" fits both Medic and
  // Caretaker). Weights are summed across all 5 answers per class.
  classWeights: Partial<Record<FantasyClass, number>>;
  resonance: string;
};

export type QuizQuestion = {
  id: QuestionId;
  progress: string;
  kicker: string;
  title: string;
  choices: QuizChoice[];
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    progress: '1 / 5',
    kicker: 'SYSTEM DIAGNOSTIC · Q1',
    title: 'The ward is collapsing. What do you do first?',
    choices: [
      { value: 'shield_danger', label: 'Shield the patient from danger.', icon: 'shield-outline', classWeights: { Guardian: 1 }, resonance: 'Emergency' },
      { value: 'hidden_cause', label: 'Look for the hidden cause.', icon: 'search-outline', classWeights: { Seer: 1 }, resonance: 'Diagnostics' },
      { value: 'stabilize_comfort', label: 'Stabilize them and offer comfort.', icon: 'heart-outline', classWeights: { Caretaker: 1 }, resonance: 'Primary Care' },
      { value: 'organize_team', label: 'Organize the team\u2019s response.', icon: 'people-outline', classWeights: { Medic: 1 }, resonance: 'Leadership' },
      { value: 'safest_formula', label: 'Prepare the safest treatment formula.', icon: 'flask-outline', classWeights: { Alchemist: 1 }, resonance: 'Pharmacy' },
      { value: 'recall_teaching', label: 'Recall what the academy taught you.', icon: 'book-outline', classWeights: { Scholar: 1 }, resonance: 'Research-Education' },
    ],
  },
  {
    id: 'q2',
    progress: '2 / 5',
    kicker: 'SYSTEM DIAGNOSTIC · Q2',
    title: 'Which modern health setting feels closest to you?',
    choices: [
      { value: 'er_ambulance', label: 'Emergency room or ambulance.', icon: 'pulse-outline', classWeights: { Guardian: 1 }, resonance: 'Emergency' },
      { value: 'clinic_everyday', label: 'Clinic \u2014 everyday health.', icon: 'medkit-outline', classWeights: { Medic: 1, Caretaker: 1 }, resonance: 'Primary Care' },
      { value: 'mental_counseling', label: 'Mental health or counseling.', icon: 'moon-outline', classWeights: { Caretaker: 1, Seer: 1 }, resonance: 'Mental Health' },
      { value: 'public_outbreak', label: 'Public health or outbreak response.', icon: 'globe-outline', classWeights: { Scholar: 1, Guardian: 1 }, resonance: 'Public Health' },
      { value: 'pharmacy_lab', label: 'Pharmacy, lab, or medication safety.', icon: 'flask-outline', classWeights: { Alchemist: 1 }, resonance: 'Pharmacy' },
      { value: 'classroom_research', label: 'Classroom, simulation, or research.', icon: 'school-outline', classWeights: { Scholar: 1 }, resonance: 'Research-Education' },
    ],
  },
  {
    id: 'q3',
    progress: '3 / 5',
    kicker: 'SYSTEM DIAGNOSTIC · Q3',
    title: 'What bothers you most?',
    choices: [
      { value: 'ignored_emergency', label: 'An emergency being ignored.', icon: 'alert-circle-outline', classWeights: { Guardian: 1 }, resonance: 'Emergency' },
      { value: 'treated_before_understood', label: 'Being treated before being understood.', icon: 'help-circle-outline', classWeights: { Seer: 1 }, resonance: 'Diagnostics' },
      { value: 'scared_alone', label: 'Someone feeling scared, alone, or unsupported.', icon: 'heart-outline', classWeights: { Caretaker: 1 }, resonance: 'Mental Health' },
      { value: 'preventable_spread', label: 'A preventable illness spreading.', icon: 'globe-outline', classWeights: { Scholar: 1 }, resonance: 'Public Health' },
      { value: 'treatment_misused', label: 'A treatment or medication used incorrectly.', icon: 'flask-outline', classWeights: { Alchemist: 1 }, resonance: 'Pharmacy' },
      { value: 'not_taught_clearly', label: 'Not being taught clearly enough.', icon: 'book-outline', classWeights: { Scholar: 1 }, resonance: 'Education' },
    ],
  },
  {
    id: 'q4',
    progress: '4 / 5',
    kicker: 'SYSTEM DIAGNOSTIC · Q4',
    title: 'What kind of task gives you the most satisfaction?',
    choices: [
      { value: 'stabilizing_danger', label: 'Stabilizing someone in danger.', icon: 'shield-outline', classWeights: { Guardian: 1 }, resonance: 'Critical Care' },
      { value: 'solving_mystery', label: 'Solving a mystery from clues.', icon: 'search-outline', classWeights: { Seer: 1 }, resonance: 'Diagnostics' },
      { value: 'helping_recovery', label: 'Helping someone recover over time.', icon: 'heart-outline', classWeights: { Caretaker: 1 }, resonance: 'Primary Care' },
      { value: 'teaching_knowledge', label: 'Teaching useful knowledge.', icon: 'book-outline', classWeights: { Scholar: 1 }, resonance: 'Education' },
      { value: 'creating_protocol', label: 'Creating a plan, formula, or protocol.', icon: 'flask-outline', classWeights: { Alchemist: 1 }, resonance: 'Pharmacy' },
      { value: 'coordinating_parts', label: 'Coordinating many moving parts.', icon: 'people-outline', classWeights: { Medic: 1 }, resonance: 'Leadership' },
    ],
  },
  {
    id: 'q5',
    progress: '5 / 5',
    kicker: 'SYSTEM DIAGNOSTIC · Q5',
    title: 'Which phrase sounds most like you?',
    choices: [
      { value: 'keep_alive_first', label: '\u201cKeep them alive first.\u201d', icon: 'shield-outline', classWeights: { Guardian: 1 }, resonance: 'Emergency' },
      { value: 'find_real_cause', label: '\u201cFind the real cause.\u201d', icon: 'search-outline', classWeights: { Seer: 1 }, resonance: 'Diagnostics' },
      { value: 'healing_patience', label: '\u201cHealing takes patience.\u201d', icon: 'heart-outline', classWeights: { Caretaker: 1 }, resonance: 'Primary Care' },
      { value: 'prevention_protects', label: '\u201cPrevention protects the most people.\u201d', icon: 'globe-outline', classWeights: { Scholar: 1 }, resonance: 'Public Health' },
      { value: 'right_treatment', label: '\u201cThe right treatment matters.\u201d', icon: 'flask-outline', classWeights: { Alchemist: 1 }, resonance: 'Pharmacy' },
      { value: 'team_needs_plan', label: '\u201cThe team needs a plan.\u201d', icon: 'people-outline', classWeights: { Medic: 1 }, resonance: 'Leadership' },
    ],
  },
];

// One neutral default choice per question, used only when a question was
// skipped, so scoring always has a valid, deterministic input to fall back
// on. Spread across different classes so an all-skipped run doesn't hard
// -code a single winner.
const DEFAULT_ANSWERS: Record<QuestionId, string> = {
  q1: 'shield_danger',
  q2: 'pharmacy_lab',
  q3: 'treated_before_understood',
  q4: 'teaching_knowledge',
  q5: 'team_needs_plan',
};

export type QuizAnswers = Partial<Record<QuestionId, string>>;

export const CLASS_TAGLINE: Record<FantasyClass, string> = {
  Guardian: 'Protects patients by stabilizing danger first.',
  Seer: 'Uncovers the hidden cause before acting.',
  Caretaker: 'Heals through patience, comfort, and steady care.',
  Scholar: 'Turns knowledge into prevention and teaching.',
  Alchemist: 'Crafts the exact treatment the moment calls for.',
  Medic: 'Coordinates the team so nothing falls through the cracks.',
};

export const CLASS_ICON: Record<FantasyClass, string> = {
  Guardian: 'shield-outline',
  Seer: 'search-outline',
  Caretaker: 'heart-outline',
  Scholar: 'book-outline',
  Alchemist: 'flask-outline',
  Medic: 'people-outline',
};

export const CLASS_COLOR: Record<FantasyClass, string> = {
  Guardian: '#4CA8E8',
  Seer: '#B48AE8',
  Caretaker: '#E8749A',
  Scholar: '#F5C842',
  Alchemist: '#3BD8A8',
  Medic: '#E87A4C',
};

// The most natural modern department for each class — used to give the
// Automated Class Assignment a "fitting" resonance, and as the scoring
// fallback if a full-quiz run somehow produces no resonance tallies at all.
export const CLASS_DEFAULT_RESONANCE: Record<FantasyClass, string> = {
  Guardian: 'Emergency',
  Seer: 'Diagnostics',
  Caretaker: 'Primary Care',
  Scholar: 'Research-Education',
  Alchemist: 'Pharmacy',
  Medic: 'Leadership',
};

// Cosmetic-only: turns a resonance key like "Research-Education" into a
// display-friendly "Research & Education".
export function formatResonance(resonance: string): string {
  return resonance.replace(/-/g, ' & ');
}

export type QuizResult = {
  primaryClass: FantasyClass;
  secondaryClass: FantasyClass;
  primaryResonance: string;
  classScores: Record<FantasyClass, number>;
  resonanceScores: Record<string, number>;
  automated: boolean;
};

function zeroClassScores(): Record<FantasyClass, number> {
  return { Guardian: 0, Seer: 0, Caretaker: 0, Scholar: 0, Alchemist: 0, Medic: 0 };
}

function findChoice(question: QuizQuestion, value: string | undefined): QuizChoice {
  return question.choices.find((c) => c.value === value) ?? question.choices[0];
}

// Scores the 5 answers into a primary class, second-closest-fit class, and a
// modern department resonance. Any unanswered question falls back to
// DEFAULT_ANSWERS so the result is always fully defined. Ties are broken by
// FANTASY_CLASSES order, so the result is deterministic and never undefined.
export function computeQuizResult(answers: QuizAnswers): QuizResult {
  const classScores = zeroClassScores();
  const resonanceScores: Record<string, number> = {};

  for (const question of QUIZ_QUESTIONS) {
    const answerValue = answers[question.id] ?? DEFAULT_ANSWERS[question.id];
    const choice = findChoice(question, answerValue);
    for (const cls of Object.keys(choice.classWeights) as FantasyClass[]) {
      classScores[cls] += choice.classWeights[cls] ?? 0;
    }
    resonanceScores[choice.resonance] = (resonanceScores[choice.resonance] ?? 0) + 1;
  }

  const sortedClasses = [...FANTASY_CLASSES].sort((a, b) => {
    const diff = classScores[b] - classScores[a];
    if (diff !== 0) return diff;
    return FANTASY_CLASSES.indexOf(a) - FANTASY_CLASSES.indexOf(b);
  });

  const resonanceEntries = Object.entries(resonanceScores).sort((a, b) => {
    const diff = b[1] - a[1];
    if (diff !== 0) return diff;
    return a[0].localeCompare(b[0]);
  });

  const primaryClass = sortedClasses[0];
  return {
    primaryClass,
    secondaryClass: sortedClasses[1],
    primaryResonance: resonanceEntries[0]?.[0] ?? CLASS_DEFAULT_RESONANCE[primaryClass],
    classScores,
    resonanceScores,
    automated: false,
  };
}

// "Automated Class Assignment" — for players who want the System to decide.
// Picks uniformly from the 6 valid classes only (never partial/undefined
// data), assigns its most fitting resonance, and picks a distinct random
// second-closest fit for display consistency with the scored result.
export function computeAutomatedAssignment(): QuizResult {
  const primaryClass = FANTASY_CLASSES[Math.floor(Math.random() * FANTASY_CLASSES.length)];
  const remaining = FANTASY_CLASSES.filter((c) => c !== primaryClass);
  const secondaryClass = remaining[Math.floor(Math.random() * remaining.length)];
  const primaryResonance = CLASS_DEFAULT_RESONANCE[primaryClass];
  const classScores = zeroClassScores();
  classScores[primaryClass] = 1;
  return {
    primaryClass,
    secondaryClass,
    primaryResonance,
    classScores,
    resonanceScores: { [primaryResonance]: 1 },
    automated: true,
  };
}

// ── Push 4: class-result lore translation ──────────────────────────────────

// A short epithet shown alongside the bare class name on the result screen
// (distinct from CLASS_TAGLINE, which is a one-line description).
export const CLASS_FLAVOR_TITLE: Record<FantasyClass, string> = {
  Guardian: 'The Steadfast Shield',
  Seer: 'The Hidden-Cause Reader',
  Caretaker: 'The Patient Healer',
  Scholar: 'The Lifelong Student',
  Alchemist: 'The Precise Preparer',
  Medic: 'The Adaptable Generalist',
};

// "Why this fits" — a short, second-person explanation tying the class back
// to the instinct the player showed in the quiz (or was assigned, for
// Automated Class Assignment).
export const CLASS_WHY_FITS: Record<FantasyClass, string> = {
  Guardian: 'You react to danger first and think second \u2014 the instinct that keeps a ward\u2019s Vital Stability from collapsing when it matters most.',
  Seer: 'You need to understand before you act. That habit of asking \u201cwhy\u201d is exactly what uncovers what everyone else misses.',
  Caretaker: 'You measure success by how someone feels after you leave the room, not just whether a number improved.',
  Scholar: 'You turn every hard case into a lesson \u2014 and you\u2019d rather prevent the next one than just treat this one.',
  Alchemist: 'You trust the right formula more than the right feeling. Precision is how you show you care.',
  Medic: 'You don\u2019t specialize in one thing, because every ward needs someone who can do a bit of everything, reliably.',
};

// Future path hints — LORE/COPY ONLY. These describe where a class's
// training could lead someday; no mechanics, unlocks, or systems are gated
// behind these strings. Keyed by Modern Department Resonance so the hint
// stays consistent whichever class the player is currently previewing.
const FUTURE_PATH_HINTS: Record<string, string> = {
  'Emergency': 'Code Guardian',
  'Critical Care': 'Code Guardian',
  'Diagnostics': 'Pathology Seer',
  'Assessment': 'Pathology Seer',
  'Primary Care': 'Ward Practitioner',
  'Family Health': 'Ward Practitioner',
  'Chronic Care': 'Ward Practitioner',
  'Rehab': 'Ward Practitioner',
  'Mental Health': 'Mindweaver',
  'Support': 'Mindweaver',
  'Public Health': 'Epidemic Warden',
  'Prevention': 'Epidemic Warden',
  'Pharmacy': 'Lotus Pharmacist',
  'Pharmacology': 'Lotus Pharmacist',
  'Lab': 'Lotus Pharmacist',
  'Treatment Science': 'Lotus Pharmacist',
  'Research-Education': 'Grand Scholar',
  'Research & Education': 'Grand Scholar',
  'Research': 'Grand Scholar',
  'Education': 'Grand Scholar',
  'Nutrition': 'Vital Garden Sage',
  'Lifestyle Health': 'Vital Garden Sage',
  'Nutrition-Lifestyle Health': 'Vital Garden Sage',
  'Procedural': 'Blade Clinician',
  'Surgery': 'Blade Clinician',
  'Leadership': 'Triage Commander',
  'Care Coordination': 'Triage Commander',
};

// Per-class fallback so a future path hint is ALWAYS defined, even if a
// resonance string is ever introduced that isn't in the table above.
const CLASS_DEFAULT_FUTURE_PATH: Record<FantasyClass, string> = {
  Guardian: 'Code Guardian',
  Seer: 'Pathology Seer',
  Caretaker: 'Ward Practitioner',
  Scholar: 'Grand Scholar',
  Alchemist: 'Lotus Pharmacist',
  Medic: 'Triage Commander',
};

export function getFuturePathHint(resonance: string, primaryClass: FantasyClass): string {
  return FUTURE_PATH_HINTS[resonance] ?? CLASS_DEFAULT_FUTURE_PATH[primaryClass];
}

// The Modern Department Resonance to display for a given class on the
// result screen: the quiz's own scored resonance for the recommended class,
// or that class's natural default resonance when previewing/switching to a
// different class (second-closest fit or a manual pick).
export function resonanceForPreview(result: QuizResult, cls: FantasyClass): string {
  return cls === result.primaryClass ? result.primaryResonance : CLASS_DEFAULT_RESONANCE[cls];
}
