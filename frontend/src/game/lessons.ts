import { PlayerState } from './types';

// ────────────────────────────────────────────────────────────
// Clinica University — Lessons & Simulations (MVP)
//
// Educational, gamified mini-lessons that translate real health/clinical
// concepts into Ward Defense / Ward Shift / Lotus Plate Journal mechanics.
//
// IMPORTANT SCOPE NOTE: this is a game feature only. It does not offer
// CME/CE credit, professional certification, or medical advice. See
// SAFETY_NOTE below — always keep it visible on the Lessons hub.
// ────────────────────────────────────────────────────────────

export const SAFETY_NOTE =
  'Clinica University provides general wellness and educational information for gameplay. ' +
  'It does not diagnose, prescribe, or replace professional medical advice. For urgent symptoms ' +
  'or personal medical concerns, seek appropriate care.';

export type DepartmentStatus = 'available' | 'coming_soon';

export interface Department {
  id: string;
  name: string;
  description: string;
  status: DepartmentStatus;
  associated: string[]; // heroes/classes/systems this department connects to
  badgeIds: string[];
  icon: string;
}

export interface QuickChallenge {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface ConceptToCombat {
  realConcept: string;
  gameTranslation: string;
  battleTip: string;
}

export interface Lesson {
  id: string;
  departmentId: string;
  title: string;
  whatItMeans: string;
  whyItMatters: string;
  whatToLookFor: string;
  whatToDoFirst: string;
  gameTranslation: string;
  clinicalNote?: string;
  quickChallenge: QuickChallenge;
  conceptToCombat: ConceptToCombat;
  badgeId: string;
}

export interface SimChoice {
  text: string;
  correct: boolean;
  feedback: string;
}

export interface SimulationCard {
  id: string;
  title: string;
  departmentId: string;
  scenario: string;
  choices: SimChoice[];
  conceptToCombat: ConceptToCombat;
  badgeId: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  goal: number; // number of contributing completions to fully unlock
}

// ---------- Departments ----------
export const DEPARTMENTS: Department[] = [
  {
    id: 'assessment',
    name: 'School of Assessment',
    description: 'Learn how to notice what matters first — the foundation of every Apprentice Seer.',
    status: 'available',
    associated: ['Apprentice Seer', 'Assessor role', 'Clinical Cue', 'Hidden Pathology enemies'],
    badgeIds: ['clinical_cue_basics', 'red_flag_recognition', 'hidden_pathology'],
    icon: 'eye',
  },
  {
    id: 'airway',
    name: 'School of Airway & Breathing',
    description: 'Breathing comes first. Train with Mist Caster and O2 Healer to master airway priority.',
    status: 'available',
    associated: ['Mist Caster', 'O2 Healer', 'Hypoxia Wraith', 'Wheeze Spirit', 'Stability'],
    badgeIds: ['airway_basics', 'reassessment_basics'],
    icon: 'cloud',
  },
  {
    id: 'nutrition',
    name: 'School of Nutrition & Wellness',
    description: 'Fuel your journey with balance, not pressure — connects to your Lotus Plate Journal.',
    status: 'available',
    associated: ['Lotus Plate Journal', 'Nutrition Garden', 'Nourishment Petals', 'Lotus Gems'],
    badgeIds: ['balanced_plate', 'hydration_helper'],
    icon: 'leaf',
  },
  {
    id: 'stabilization',
    name: 'School of Stabilization',
    description: 'Coming soon — keeping patients steady under pressure.',
    status: 'coming_soon',
    associated: ['Stabilizer role'],
    badgeIds: [],
    icon: 'shield',
  },
  {
    id: 'pharmacology',
    name: 'School of Pharmacology & Herbs',
    description: 'Coming soon — the safe basics of remedies and herbal support.',
    status: 'coming_soon',
    associated: ['Analyst role'],
    badgeIds: [],
    icon: 'flask',
  },
  {
    id: 'emergency',
    name: 'School of Emergency Response',
    description: 'Coming soon — fast, calm decision-making when seconds count.',
    status: 'coming_soon',
    associated: ['Coordinator role'],
    badgeIds: [],
    icon: 'alert-circle',
  },
  {
    id: 'mental_wellness',
    name: 'Mental Wellness',
    description: 'Coming soon — supportive lessons on stress, rest, and mindset.',
    status: 'coming_soon',
    associated: ['Educator role'],
    badgeIds: [],
    icon: 'happy',
  },
  {
    id: 'chronic_disease',
    name: 'Chronic Disease',
    description: 'Coming soon — living well with long-term conditions.',
    status: 'coming_soon',
    associated: ['Specialist role'],
    badgeIds: [],
    icon: 'infinite',
  },
  {
    id: 'professional_track',
    name: 'Professional Learner Track',
    description: 'Coming soon — deeper optional detail for clinical learners. Not a source of real-world credit.',
    status: 'coming_soon',
    associated: [],
    badgeIds: [],
    icon: 'ribbon',
  },
];

export function getDepartment(id: string): Department | undefined {
  return DEPARTMENTS.find((d) => d.id === id);
}

// ---------- Badges ----------
export const BADGES: Badge[] = [
  { id: 'clinical_cue_basics', name: 'Clinical Cue Basics', description: 'Understands what a Clinical Cue reveals.', icon: 'eye', goal: 2 },
  { id: 'red_flag_recognition', name: 'Red Flag Recognition', description: 'Can spot the signs that need attention first.', icon: 'flag', goal: 1 },
  { id: 'hidden_pathology', name: 'Hidden Pathology', description: 'Knows why revealing hidden threats matters.', icon: 'search', goal: 1 },
  { id: 'airway_basics', name: 'Airway Basics', description: 'Understands why breathing comes first.', icon: 'cloud', goal: 3 },
  { id: 'reassessment_basics', name: 'Reassessment Basics', description: 'Knows to check again after acting.', icon: 'refresh', goal: 2 },
  { id: 'balanced_plate', name: 'Balanced Plate', description: 'Understands balanced, non-punishing nutrition.', icon: 'restaurant', goal: 3 },
  { id: 'hydration_helper', name: 'Hydration Helper', description: 'Knows the basics of staying hydrated.', icon: 'water', goal: 1 },
];

export function getBadge(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}

// ---------- Lessons: School of Assessment ----------
const assessmentLessons: Lesson[] = [
  {
    id: 'what-is-a-clinical-cue',
    departmentId: 'assessment',
    title: 'What is a Clinical Cue?',
    whatItMeans: 'A Clinical Cue is a small clue — a symptom, a number, or a detail — that tells you something about what is happening.',
    whyItMatters: 'Cues help you decide what to pay attention to before you decide what to do.',
    whatToLookFor: 'Anything that stands out: a change, a number outside the usual range, or something the patient mentions first.',
    whatToDoFirst: 'Notice the cue, then ask "what could this mean?" before jumping to an action.',
    gameTranslation: 'In Clinica, your Apprentice Seer reveals Clinical Cues before battle — this is exactly like noticing a symptom before deciding your next move.',
    clinicalNote: 'Clinical learners: this mirrors the "cue recognition" step of clinical judgment models.',
    quickChallenge: {
      question: 'What is a Clinical Cue best described as?',
      choices: ['A random event', 'A clue that helps you understand a situation', 'A type of medicine', 'A battle move'],
      correctIndex: 1,
      explanation: 'A Clinical Cue is a clue — a detail that helps you understand what is going on before you act.',
    },
    conceptToCombat: {
      realConcept: 'Noticing a symptom or detail before acting.',
      gameTranslation: 'Apprentice Seer reveals a Clinical Cue about the enemy before you commit to an action.',
      battleTip: 'Always check the Clinical Cue Apprentice Seer reveals — it hints at the enemy\'s weakness.',
    },
    badgeId: 'clinical_cue_basics',
  },
  {
    id: 'assess-first',
    departmentId: 'assessment',
    title: 'Assess First',
    whatItMeans: '"Assess first" means gathering information before choosing an action, instead of guessing.',
    whyItMatters: 'Acting without assessing can waste effort or make things worse. A quick look first leads to better decisions.',
    whatToLookFor: 'The most obvious or urgent detail in front of you — start there.',
    whatToDoFirst: 'Pause, observe, then choose your action based on what you noticed.',
    gameTranslation: 'The Assess role exists to reveal weaknesses before your team attacks — using Assess first almost always improves your next move.',
    quickChallenge: {
      question: 'Why assess before acting?',
      choices: ['It wastes a turn', 'It helps you choose a better action', 'It is only for beginners', 'It has no effect'],
      correctIndex: 1,
      explanation: 'Assessing first gives you information that leads to a smarter choice.',
    },
    conceptToCombat: {
      realConcept: 'Gathering information before intervening.',
      gameTranslation: 'The Assess role reveals a weakness on the enemy before your team commits to attacks.',
      battleTip: 'Use an Assessor early in a fight — the revealed weakness boosts your team\'s follow-up damage.',
    },
    badgeId: 'clinical_cue_basics',
  },
  {
    id: 'red-flags-made-simple',
    departmentId: 'assessment',
    title: 'Red Flags Made Simple',
    whatItMeans: 'A "red flag" is a warning sign that something needs attention right away, more urgently than other things.',
    whyItMatters: 'Recognizing red flags helps you prioritize — not everything needs the same urgency.',
    whatToLookFor: 'Sudden changes, severe symptoms, or anything that feels "off" compared to normal.',
    whatToDoFirst: 'Treat red flags as your top priority before handling smaller issues.',
    gameTranslation: 'In Ward Defense, some enemies or effects act like red flags — they demand priority targeting before anything else.',
    quickChallenge: {
      question: 'A red flag usually means:',
      choices: ['Nothing important', 'Something that needs priority attention', 'A decoration', 'A reward item'],
      correctIndex: 1,
      explanation: 'A red flag signals something urgent that should be prioritized.',
    },
    conceptToCombat: {
      realConcept: 'Spotting warning signs that need urgent priority.',
      gameTranslation: 'High-priority enemy effects act like red flags in Ward Defense — they should be handled first.',
      battleTip: 'When you see a dangerous effect building up, treat it like a red flag and prioritize it.',
    },
    badgeId: 'red_flag_recognition',
  },
  {
    id: 'hidden-pathology',
    departmentId: 'assessment',
    title: 'Hidden Pathology and Why Revealing Matters',
    whatItMeans: 'Hidden pathology means a problem that isn\'t obvious right away — it needs to be uncovered first.',
    whyItMatters: 'If something stays hidden, it can be missed or misunderstood until it becomes bigger.',
    whatToLookFor: 'Small inconsistencies or things that don\'t add up compared to what you\'d expect.',
    whatToDoFirst: 'Use assessment tools or a closer look to reveal what isn\'t obvious before treating.',
    gameTranslation: 'Hidden Pathology enemies in Clinica stay shielded or unclear until revealed by a Clinical Cue Check — just like real hidden conditions.',
    quickChallenge: {
      question: 'Why is revealing hidden pathology important?',
      choices: ['It looks nice', 'It has no real effect', 'It lets you treat the real problem instead of guessing', 'It slows the game down for no reason'],
      correctIndex: 2,
      explanation: 'Revealing what\'s hidden lets you respond to the real problem, not just the surface symptoms.',
    },
    conceptToCombat: {
      realConcept: 'Uncovering a problem that isn\'t obvious at first.',
      gameTranslation: 'Hidden Pathology enemies must be revealed with a Clinical Cue Check before their true weakness is exploitable.',
      battleTip: 'Never skip the Clinical Cue Check on a Hidden Pathology enemy — attacking blind wastes your best moves.',
    },
    badgeId: 'hidden_pathology',
  },
];

// ---------- Lessons: School of Airway & Breathing ----------
const airwayLessons: Lesson[] = [
  {
    id: 'why-breathing-comes-first',
    departmentId: 'airway',
    title: 'Why Breathing Comes First',
    whatItMeans: 'Breathing (airway) is checked before almost everything else because the body needs oxygen to do anything else.',
    whyItMatters: 'If breathing is in trouble, fixing other things first won\'t help much until airway is addressed.',
    whatToLookFor: 'Signs of struggling to breathe, unusual breathing sounds, or rapid breathing.',
    whatToDoFirst: 'Support breathing/airway before tackling secondary problems.',
    gameTranslation: 'In Clinica, airway-related threats drain Stability fastest — your team should stabilize breathing first, just like in real priority order.',
    clinicalNote: 'Clinical learners: this reflects the airway-first principle in primary assessment frameworks.',
    quickChallenge: {
      question: 'Why is breathing usually the first priority?',
      choices: ['It\'s the easiest to ignore', 'The body needs oxygen for everything else to work', 'It\'s the least important', 'It only matters in games'],
      correctIndex: 1,
      explanation: 'Without oxygen, nothing else in the body works well — so airway comes first.',
    },
    conceptToCombat: {
      realConcept: 'Airway and breathing are addressed before other problems.',
      gameTranslation: 'Airway threats drain Stability quickly in Ward Defense, so they demand early attention.',
      battleTip: 'Send Mist Caster or O2 Healer in early against airway-draining enemies before Stability drops too low.',
    },
    badgeId: 'airway_basics',
  },
  {
    id: 'what-wheezing-can-mean',
    departmentId: 'airway',
    title: 'What Wheezing Can Mean',
    whatItMeans: 'Wheezing is a whistling sound during breathing that can mean the airway is narrowed.',
    whyItMatters: 'It\'s a helpful clue that airway support may be needed soon.',
    whatToLookFor: 'A whistling or high-pitched sound, especially when breathing out.',
    whatToDoFirst: 'Treat wheezing as a cue to check airway status more closely.',
    gameTranslation: 'The Wheeze Spirit enemy represents this exact cue — it warns your team that airway support should be readied.',
    quickChallenge: {
      question: 'Wheezing is a clue that suggests:',
      choices: ['Nothing is wrong', 'The airway may be narrowed', 'A skin issue', 'A nutrition issue'],
      correctIndex: 1,
      explanation: 'Wheezing suggests narrowed airways and is a useful clue to check breathing more closely.',
    },
    conceptToCombat: {
      realConcept: 'A wheeze sound as a warning clue about airway narrowing.',
      gameTranslation: 'The Wheeze Spirit enemy signals your team to prepare airway support.',
      battleTip: 'When Wheeze Spirit appears, ready O2 Healer before the encounter escalates.',
    },
    badgeId: 'airway_basics',
  },
  {
    id: 'oxygenation-made-simple',
    departmentId: 'airway',
    title: 'Oxygenation Made Simple',
    whatItMeans: 'Oxygenation is how well oxygen gets into the body and reaches where it\'s needed.',
    whyItMatters: 'Good oxygenation keeps the whole body — and your Stability — running smoothly.',
    whatToLookFor: 'Signs that oxygen levels may be low, like fatigue or breathlessness.',
    whatToDoFirst: 'Support oxygenation early rather than waiting for it to get worse.',
    gameTranslation: 'O2 Healer restores Stability by simulating better oxygenation for your team.',
    quickChallenge: {
      question: 'Oxygenation refers to:',
      choices: ['How oxygen reaches the body', 'A type of food', 'A battle stat unrelated to health', 'A hero\'s name only'],
      correctIndex: 0,
      explanation: 'Oxygenation is about how well oxygen reaches and is used by the body.',
    },
    conceptToCombat: {
      realConcept: 'How well oxygen reaches the body\'s tissues.',
      gameTranslation: 'O2 Healer\'s abilities simulate restoring oxygenation, which raises Stability.',
      battleTip: 'Use O2 Healer proactively when Stability starts dropping from airway threats — don\'t wait until it\'s critical.',
    },
    badgeId: 'airway_basics',
  },
  {
    id: 'reassessing-after-breathing-support',
    departmentId: 'airway',
    title: 'Reassessing After Breathing Support',
    whatItMeans: 'After giving airway support, it\'s important to check again to see if it worked.',
    whyItMatters: 'Reassessment confirms whether your action helped, or if you need to try something else.',
    whatToLookFor: 'Whether the original signs (like wheezing) have improved after support.',
    whatToDoFirst: 'Recheck the situation shortly after acting — don\'t assume it worked.',
    gameTranslation: 'The Response Confirmed effect in Clinica happens when you reassess after Mist Caster or O2 Healer acts, confirming treatment worked.',
    quickChallenge: {
      question: 'Why reassess after giving airway support?',
      choices: ['To waste a turn', 'To confirm whether the support worked', 'It\'s not necessary', 'To lower Stability on purpose'],
      correctIndex: 1,
      explanation: 'Reassessing confirms whether your action actually helped, so you know if more support is needed.',
    },
    conceptToCombat: {
      realConcept: 'Checking again after an intervention to confirm it worked.',
      gameTranslation: 'Reassess Sage confirms whether Mist Caster or O2 Healer\'s treatment worked, triggering Response Confirmed.',
      battleTip: 'Follow up Mist Caster or O2 Healer with Reassess Sage to lock in the Response Confirmed bonus.',
    },
    badgeId: 'reassessment_basics',
  },
];

// ---------- Lessons: School of Nutrition & Wellness ----------
const nutritionLessons: Lesson[] = [
  {
    id: 'calories-as-energy',
    departmentId: 'nutrition',
    title: 'Calories as Energy, Not Punishment',
    whatItMeans: 'Calories are simply units of energy your body uses to function — they are not something to fear.',
    whyItMatters: 'Thinking of food as fuel instead of "good" or "bad" supports a healthier relationship with eating.',
    whatToLookFor: 'Whether meals give you steady energy through the day.',
    whatToDoFirst: 'Focus on eating enough to feel fueled, not on restricting.',
    gameTranslation: 'In the Lotus Plate Journal, meals earn gentle Nourishment Petals — there\'s no punishment for any food choice.',
    quickChallenge: {
      question: 'Calories are best understood as:',
      choices: ['A punishment to avoid', 'Units of energy your body uses', 'Always bad for you', 'Only found in unhealthy food'],
      correctIndex: 1,
      explanation: 'Calories are simply energy — neither good nor bad on their own.',
    },
    conceptToCombat: {
      realConcept: 'Calories are energy, not a moral scorecard.',
      gameTranslation: 'The Lotus Plate Journal rewards any logged meal with gentle Nourishment Petals — no food is "banned."',
      battleTip: 'Log any meal in your Journal to keep your Nourishment Petals flowing — consistency matters more than perfection.',
    },
    badgeId: 'balanced_plate',
  },
  {
    id: 'building-a-balanced-plate',
    departmentId: 'nutrition',
    title: 'Building a Balanced Plate',
    whatItMeans: 'A balanced plate includes a mix of food groups — like grains, protein, and vegetables — rather than just one type.',
    whyItMatters: 'Variety helps your body get the different things it needs to feel good.',
    whatToLookFor: 'Whether your plate has more than one food group represented.',
    whatToDoFirst: 'Add one more food group to a meal if it\'s missing, without stressing about perfection.',
    gameTranslation: 'The Nutrition Garden suggests balanced recipe ideas — small additions, no strict rules.',
    quickChallenge: {
      question: 'A balanced plate generally includes:',
      choices: ['Only one food group', 'A mix of different food groups', 'No food at all', 'Only supplements'],
      correctIndex: 1,
      explanation: 'Balance comes from including a mix of food groups, not just one.',
    },
    conceptToCombat: {
      realConcept: 'Including a mix of food groups for balance.',
      gameTranslation: 'The Nutrition Garden offers recipe suggestions that gently nudge toward more balanced meals.',
      battleTip: 'Check the Nutrition Garden\'s recipe suggestions for easy ways to round out a meal.',
    },
    badgeId: 'balanced_plate',
  },
  {
    id: 'hydration-basics',
    departmentId: 'nutrition',
    title: 'Hydration Basics',
    whatItMeans: 'Hydration means having enough fluids in your body to function well.',
    whyItMatters: 'Even mild dehydration can affect energy and focus.',
    whatToLookFor: 'Feeling thirsty, tired, or noticing a dry mouth are simple cues to drink water.',
    whatToDoFirst: 'Drink water regularly throughout the day rather than waiting until very thirsty.',
    gameTranslation: 'Logging water in the Lotus Plate Journal earns small, safely capped Lotus Gems.',
    quickChallenge: {
      question: 'A simple sign you might need water is:',
      choices: ['Feeling thirsty', 'Feeling full', 'Feeling cold', 'Feeling bored'],
      correctIndex: 0,
      explanation: 'Thirst is one of the body\'s simplest cues that it\'s time to hydrate.',
    },
    conceptToCombat: {
      realConcept: 'Staying adequately hydrated throughout the day.',
      gameTranslation: 'Logging water intake in the Lotus Plate Journal earns capped, cosmetic Lotus Gems.',
      battleTip: 'Make hydration logging a habit in your Journal — small and steady beats catching up all at once.',
    },
    badgeId: 'hydration_helper',
  },
  {
    id: 'fiber-protein-steady-energy',
    departmentId: 'nutrition',
    title: 'Fiber, Protein, and Steady Energy',
    whatItMeans: 'Fiber and protein help meals feel more filling and give steadier energy over time.',
    whyItMatters: 'Steadier energy can mean fewer energy crashes during the day.',
    whatToLookFor: 'Whether a meal has a source of protein or fiber-rich food, like beans, whole grains, or vegetables.',
    whatToDoFirst: 'Add a small protein or fiber source to a meal that feels like it\'s missing one.',
    gameTranslation: 'Balanced meals in the Lotus Plate Journal are gently highlighted with encouraging notes, never penalties.',
    quickChallenge: {
      question: 'Fiber and protein in a meal tend to help with:',
      choices: ['Steadier energy over time', 'Instant sugar crashes', 'Nothing noticeable', 'Only weight loss'],
      correctIndex: 0,
      explanation: 'Fiber and protein tend to support steadier, longer-lasting energy.',
    },
    conceptToCombat: {
      realConcept: 'Fiber and protein support steady energy levels.',
      gameTranslation: 'The Lotus Plate Journal gently highlights balanced meals with encouraging notes.',
      battleTip: 'Look for the Journal\'s gentle balance notes as a friendly nudge, not a rule to follow strictly.',
    },
    badgeId: 'balanced_plate',
  },
];

export const LESSONS: Lesson[] = [...assessmentLessons, ...airwayLessons, ...nutritionLessons];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function lessonsForDepartment(departmentId: string): Lesson[] {
  return LESSONS.filter((l) => l.departmentId === departmentId);
}

// ---------- Simulation Cards ----------
export const SIMULATIONS: SimulationCard[] = [
  {
    id: 'airway-distress',
    title: 'Airway Distress',
    departmentId: 'airway',
    scenario: 'A patient suddenly starts wheezing and looks distressed. What\'s the best first action?',
    choices: [
      { text: 'Support their breathing/airway right away', correct: true, feedback: 'Correct — airway comes first when breathing is in distress.' },
      { text: 'Ask about their diet', correct: false, feedback: 'Not quite — diet isn\'t urgent when breathing is in distress. Airway comes first.' },
      { text: 'Wait and see if it passes', correct: false, feedback: 'Not quite — breathing distress needs prompt attention, not waiting.' },
    ],
    conceptToCombat: {
      realConcept: 'Airway/breathing distress needs immediate attention.',
      gameTranslation: 'Send Mist Caster or O2 Healer in immediately when an airway threat appears.',
      battleTip: 'Don\'t delay airway support — Stability drops fast once an airway threat is active.',
    },
    badgeId: 'airway_basics',
  },
  {
    id: 'hidden-pathology-sim',
    title: 'Hidden Pathology',
    departmentId: 'assessment',
    scenario: 'Something seems off, but it\'s not obvious what. What should you do first?',
    choices: [
      { text: 'Assess more closely to reveal what\'s hidden', correct: true, feedback: 'Correct — revealing the hidden issue first helps you respond to the real problem.' },
      { text: 'Guess and treat randomly', correct: false, feedback: 'Not quite — guessing can miss the real issue. Reveal first.' },
      { text: 'Ignore it since it\'s not obvious', correct: false, feedback: 'Not quite — hidden issues can grow if ignored.' },
    ],
    conceptToCombat: {
      realConcept: 'Uncovering a non-obvious problem before treating it.',
      gameTranslation: 'Use a Clinical Cue Check on Hidden Pathology enemies before attacking.',
      battleTip: 'Reveal Hidden Pathology enemies with a Cue Check before spending your best attacks.',
    },
    badgeId: 'hidden_pathology',
  },
  {
    id: 'balanced-plate-sim',
    title: 'Balanced Plate',
    departmentId: 'nutrition',
    scenario: 'A meal has only one food group. What\'s a supportive next step?',
    choices: [
      { text: 'Add one more food group without stressing about perfection', correct: true, feedback: 'Correct — small, gentle additions build balance over time.' },
      { text: 'Skip the meal entirely', correct: false, feedback: 'Not quite — skipping meals isn\'t the goal here. Small additions are more supportive.' },
      { text: 'Feel guilty about the meal', correct: false, feedback: 'Not quite — there\'s no need for guilt. Just aim for one small addition next time.' },
    ],
    conceptToCombat: {
      realConcept: 'Building balance gradually, without guilt.',
      gameTranslation: 'The Nutrition Garden suggests gentle recipe additions, not restrictions.',
      battleTip: 'Check the Nutrition Garden for a simple recipe idea to round out your next logged meal.',
    },
    badgeId: 'balanced_plate',
  },
  {
    id: 'hydration-check-sim',
    title: 'Hydration Check',
    departmentId: 'nutrition',
    scenario: 'You notice you feel tired and haven\'t had water in a while. What\'s a good first step?',
    choices: [
      { text: 'Drink some water', correct: true, feedback: 'Correct — this is a simple, supportive first step.' },
      { text: 'Ignore it and keep going', correct: false, feedback: 'Not quite — a quick drink of water is an easy, supportive step.' },
      { text: 'Assume it\'s unrelated', correct: false, feedback: 'Not quite — tiredness can sometimes be linked to hydration.' },
    ],
    conceptToCombat: {
      realConcept: 'Recognizing simple hydration cues.',
      gameTranslation: 'Logging water in the Lotus Plate Journal earns small, capped Lotus Gems.',
      battleTip: 'Make a habit of logging water in your Journal throughout the day.',
    },
    badgeId: 'hydration_helper',
  },
  {
    id: 'reassessment-sim',
    title: 'Reassessment',
    departmentId: 'airway',
    scenario: 'You just gave breathing support. What should you do next?',
    choices: [
      { text: 'Check again to see if it helped', correct: true, feedback: 'Correct — reassessing confirms whether your action worked.' },
      { text: 'Assume it worked and move on', correct: false, feedback: 'Not quite — it\'s best to confirm rather than assume.' },
      { text: 'Do nothing further', correct: false, feedback: 'Not quite — a quick recheck helps confirm the support worked.' },
    ],
    conceptToCombat: {
      realConcept: 'Reassessment confirms whether an action helped.',
      gameTranslation: 'Reassess Sage confirms treatment worked, triggering Response Confirmed.',
      battleTip: 'Pair Mist Caster or O2 Healer with Reassess Sage for the Response Confirmed bonus.',
    },
    badgeId: 'reassessment_basics',
  },
];

export function getSimulation(id: string): SimulationCard | undefined {
  return SIMULATIONS.find((s) => s.id === id);
}

export function simulationsForDepartment(departmentId: string): SimulationCard[] {
  return SIMULATIONS.filter((s) => s.departmentId === departmentId);
}

// ---------- Rewards ----------
export const LESSON_FIRST_REWARD = 10;
export const LESSON_REPEAT_REWARD = 2;
export const SIM_FIRST_REWARD = 15;
export const SIM_REPEAT_REWARD = 3;

export interface CompletionResult {
  creditsEarned: number;
  isFirstCompletion: boolean;
  badgeId: string;
  badgeProgress: number;
  badgeGoal: number;
  badgeJustUnlocked: boolean;
}

export function computeLessonCompletion(
  lesson: Lesson,
  player: PlayerState,
): CompletionResult {
  const completed = player.lessons_completed || [];
  const isFirstCompletion = !completed.includes(lesson.id);
  const creditsEarned = isFirstCompletion ? LESSON_FIRST_REWARD : LESSON_REPEAT_REWARD;
  const badge = getBadge(lesson.badgeId);
  const priorProgress = (player.badge_progress || {})[lesson.badgeId] || 0;
  const nextProgress = isFirstCompletion ? priorProgress + 1 : priorProgress;
  const goal = badge?.goal ?? 1;
  return {
    creditsEarned,
    isFirstCompletion,
    badgeId: lesson.badgeId,
    badgeProgress: Math.min(nextProgress, goal),
    badgeGoal: goal,
    badgeJustUnlocked: isFirstCompletion && priorProgress < goal && nextProgress >= goal,
  };
}

export function computeSimulationCompletion(
  sim: SimulationCard,
  player: PlayerState,
  wasCorrect: boolean,
): CompletionResult {
  const completed = player.simulations_completed || [];
  const isFirstCompletion = !completed.includes(sim.id);
  const baseReward = isFirstCompletion ? SIM_FIRST_REWARD : SIM_REPEAT_REWARD;
  const creditsEarned = wasCorrect ? baseReward : Math.max(1, Math.floor(baseReward / 2));
  const badge = getBadge(sim.badgeId);
  const priorProgress = (player.badge_progress || {})[sim.badgeId] || 0;
  const nextProgress = isFirstCompletion && wasCorrect ? priorProgress + 1 : priorProgress;
  const goal = badge?.goal ?? 1;
  return {
    creditsEarned,
    isFirstCompletion,
    badgeId: sim.badgeId,
    badgeProgress: Math.min(nextProgress, goal),
    badgeGoal: goal,
    badgeJustUnlocked: isFirstCompletion && wasCorrect && priorProgress < goal && nextProgress >= goal,
  };
}
