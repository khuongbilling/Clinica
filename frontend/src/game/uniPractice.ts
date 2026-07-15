/**
 * J3 — University Practice System
 *
 * Data engine for Clinical Cue Lab, Rapid Triage Hall, Stabilize Stack Lab,
 * University Practice Milestones, and University Shop preview.
 *
 * Material keys map to player.inventory (Record<string,number>):
 *   cue_scroll · triage_scroll · stab_scroll · lesson_note
 *   care_chain_manual · hero_training_page · sim_pass
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type PracticeDifficulty = 'beginner' | 'standard' | 'advanced';
export type PracticeActivityType = 'cue_lab' | 'triage' | 'stack';
export type AllActivityType = PracticeActivityType | 'lotus_lesson';

export interface PracticeRewardDef {
  playerXp: number;
  heroXp: number;
  universityCredits: number;
  scrollKey: string;
  scrollCount: number;
  bonusItemKey?: string;
  bonusItemCount?: number;
}

export interface GrantedPracticeReward extends PracticeRewardDef {
  activityType: PracticeActivityType;
  difficulty: PracticeDifficulty;
  isFirstComplete: boolean;
}

export interface UniMilestoneReward {
  playerXp?: number;
  universityCredits: number;
  codexShards?: number;
  inventory?: Record<string, number>;
}

export interface UniPracticeMilestone {
  id: string;
  activityType: AllActivityType;
  threshold: number;
  label: string;
  description: string;
  rewards: UniMilestoneReward;
}

export interface UniShopItem {
  id: string;
  name: string;
  icon: string;
  creditCost: number;
  description: string;
  category: 'scroll' | 'manual' | 'pass' | 'supply';
  status: 'active' | 'preview';
}

// ── Reward definitions ─────────────────────────────────────────────────────

export const PRACTICE_REWARDS: Record<PracticeActivityType, Record<PracticeDifficulty, PracticeRewardDef>> = {
  cue_lab: {
    beginner: { playerXp: 10, heroXp: 5,  universityCredits: 15, scrollKey: 'cue_scroll', scrollCount: 1 },
    standard: { playerXp: 15, heroXp: 10, universityCredits: 25, scrollKey: 'cue_scroll', scrollCount: 2 },
    advanced:  { playerXp: 20, heroXp: 15, universityCredits: 35, scrollKey: 'cue_scroll', scrollCount: 2, bonusItemKey: 'lesson_note', bonusItemCount: 1 },
  },
  triage: {
    beginner: { playerXp: 10, heroXp: 5,  universityCredits: 15, scrollKey: 'triage_scroll', scrollCount: 1 },
    standard: { playerXp: 15, heroXp: 10, universityCredits: 25, scrollKey: 'triage_scroll', scrollCount: 2 },
    advanced:  { playerXp: 20, heroXp: 15, universityCredits: 35, scrollKey: 'triage_scroll', scrollCount: 2, bonusItemKey: 'care_chain_manual', bonusItemCount: 1 },
  },
  stack: {
    beginner: { playerXp: 10, heroXp: 5,  universityCredits: 15, scrollKey: 'stab_scroll', scrollCount: 1 },
    standard: { playerXp: 15, heroXp: 10, universityCredits: 25, scrollKey: 'stab_scroll', scrollCount: 2 },
    advanced:  { playerXp: 20, heroXp: 15, universityCredits: 35, scrollKey: 'stab_scroll', scrollCount: 2, bonusItemKey: 'care_chain_manual', bonusItemCount: 1 },
  },
};

// Repeat rewards are smaller so farming is not profitable
export const PRACTICE_REPEAT_REWARDS: Record<PracticeActivityType, Record<PracticeDifficulty, PracticeRewardDef>> = {
  cue_lab: {
    beginner: { playerXp: 5, heroXp: 2,  universityCredits: 8,  scrollKey: 'cue_scroll', scrollCount: 1 },
    standard: { playerXp: 8, heroXp: 4,  universityCredits: 12, scrollKey: 'cue_scroll', scrollCount: 1 },
    advanced:  { playerXp: 10, heroXp: 7, universityCredits: 15, scrollKey: 'cue_scroll', scrollCount: 2 },
  },
  triage: {
    beginner: { playerXp: 5, heroXp: 2,  universityCredits: 8,  scrollKey: 'triage_scroll', scrollCount: 1 },
    standard: { playerXp: 8, heroXp: 4,  universityCredits: 12, scrollKey: 'triage_scroll', scrollCount: 1 },
    advanced:  { playerXp: 10, heroXp: 7, universityCredits: 15, scrollKey: 'triage_scroll', scrollCount: 2 },
  },
  stack: {
    beginner: { playerXp: 5, heroXp: 2,  universityCredits: 8,  scrollKey: 'stab_scroll', scrollCount: 1 },
    standard: { playerXp: 8, heroXp: 4,  universityCredits: 12, scrollKey: 'stab_scroll', scrollCount: 1 },
    advanced:  { playerXp: 10, heroXp: 7, universityCredits: 15, scrollKey: 'stab_scroll', scrollCount: 2 },
  },
};

// ── Practice milestones ────────────────────────────────────────────────────

export const UNI_PRACTICE_MILESTONES: UniPracticeMilestone[] = [
  // Clinical Cue Lab
  { id: 'cue_3',  activityType: 'cue_lab', threshold: 3,  label: 'Cue Spotter',   description: 'Complete 3 Clinical Cue Lab sessions.',
    rewards: { universityCredits: 50,  inventory: { cue_scroll: 1 } } },
  { id: 'cue_5',  activityType: 'cue_lab', threshold: 5,  label: 'Keen Observer', description: 'Complete 5 Clinical Cue Lab sessions.',
    rewards: { playerXp: 25, universityCredits: 75,  inventory: { cue_scroll: 2 } } },
  { id: 'cue_10', activityType: 'cue_lab', threshold: 10, label: 'Cue Master',    description: 'Complete 10 Clinical Cue Lab sessions.',
    rewards: { playerXp: 50, universityCredits: 125, inventory: { care_chain_manual: 1 } } },

  // Rapid Triage Hall
  { id: 'triage_3',  activityType: 'triage', threshold: 3,  label: 'First Responder', description: 'Complete 3 Rapid Triage drills.',
    rewards: { universityCredits: 50,  inventory: { triage_scroll: 1 } } },
  { id: 'triage_5',  activityType: 'triage', threshold: 5,  label: 'Quick Read',      description: 'Complete 5 Rapid Triage drills.',
    rewards: { playerXp: 25, universityCredits: 75,  inventory: { triage_scroll: 2 } } },
  { id: 'triage_10', activityType: 'triage', threshold: 10, label: 'Triage Expert',   description: 'Complete 10 Rapid Triage drills.',
    rewards: { playerXp: 50, universityCredits: 125, inventory: { care_chain_manual: 1 } } },

  // Stabilize Stack Lab
  { id: 'stack_3',  activityType: 'stack', threshold: 3,  label: 'Steady Hands',    description: 'Complete 3 Stabilize Stack drills.',
    rewards: { universityCredits: 50,  inventory: { stab_scroll: 1 } } },
  { id: 'stack_5',  activityType: 'stack', threshold: 5,  label: 'Sequencer',       description: 'Complete 5 Stabilize Stack drills.',
    rewards: { playerXp: 25, universityCredits: 75,  inventory: { stab_scroll: 2 } } },
  { id: 'stack_10', activityType: 'stack', threshold: 10, label: 'Care Architect',  description: 'Complete 10 Stabilize Stack drills.',
    rewards: { playerXp: 50, universityCredits: 125, inventory: { care_chain_manual: 1 } } },

  // Lotus Lessons
  { id: 'lotus_3',  activityType: 'lotus_lesson', threshold: 3,  label: 'Lotus Learner',  description: 'Complete 3 Lotus Lessons.',
    rewards: { playerXp: 25, universityCredits: 75,  inventory: { lesson_note: 2 } } },
  { id: 'lotus_5',  activityType: 'lotus_lesson', threshold: 5,  label: 'Lotus Scholar',  description: 'Complete 5 Lotus Lessons.',
    rewards: { playerXp: 50, universityCredits: 100, inventory: { care_chain_manual: 1 } } },
  { id: 'lotus_10', activityType: 'lotus_lesson', threshold: 10, label: 'Lotus Sage',     description: 'Complete 10 Lotus Lessons.',
    rewards: { playerXp: 75, universityCredits: 150, codexShards: 100 } },
];

// ── University Shop preview items ──────────────────────────────────────────

export const UNI_SHOP_ITEMS: UniShopItem[] = [
  { id: 'shop_cue_scroll',  name: 'Cue Scroll',           icon: 'eye-outline',       creditCost: 30,  category: 'scroll',  status: 'preview',
    description: 'A learning scroll for cue-recognition upgrades. Earned through Clinical Cue Lab practice.' },
  { id: 'shop_triage_scroll', name: 'Triage Scroll',      icon: 'flash-outline',     creditCost: 30,  category: 'scroll',  status: 'preview',
    description: 'A readiness scroll for priority and triage upgrades. Earned through Rapid Triage Hall.' },
  { id: 'shop_stab_scroll', name: 'Stabilization Scroll', icon: 'layers-outline',    creditCost: 30,  category: 'scroll',  status: 'preview',
    description: 'A precision scroll for Stabilize and recovery upgrades. Earned through Stabilize Stack Lab.' },
  { id: 'shop_lesson_note', name: 'Lesson Notes',         icon: 'document-text-outline', creditCost: 25, category: 'scroll', status: 'preview',
    description: 'Study notes from Lotus Lessons. Used to support hero knowledge development.' },
  { id: 'shop_hero_tp',     name: 'Hero Training Page',   icon: 'trending-up-outline', creditCost: 40, category: 'manual',  status: 'preview',
    description: 'A focused training reference for hero skill development and Clinical Arts study.' },
  { id: 'shop_care_chain',  name: 'Care Chain Manual',    icon: 'reader-outline',    creditCost: 125, category: 'manual',  status: 'preview',
    description: 'A comprehensive clinical manual. Rare reward for mastering University practice.' },
  { id: 'shop_sim_pass',    name: 'Simulation Pass',      icon: 'shield-checkmark-outline', creditCost: 50, category: 'pass', status: 'preview',
    description: 'Grants access to an advanced simulation run. Opens doors to harder challenges.' },
  { id: 'shop_basic_supply', name: 'Basic Medical Supply', icon: 'medkit-outline',   creditCost: 35,  category: 'supply', status: 'preview',
    description: 'A clinical supply pack with basic ward consumables for battle preparation.' },
];

// ── Clinical Cue Lab scenarios ────────────────────────────────────────────

export interface CueOption { id: string; text: string; isCorrect: boolean; }
export interface CueScenario {
  id: string;
  difficulty: PracticeDifficulty;
  title: string;
  context: string;
  question: string;
  options: CueOption[];
  explanation: string;
  keyLearning: string;
}

export const CUE_SCENARIOS: CueScenario[] = [
  // ── Beginner ──
  {
    id: 'cue_b1', difficulty: 'beginner', title: 'Hydration Signs',
    context: 'Mr. Wei, 72yo, returned from surgery 2 hours ago. He looks drowsy, his mouth is dry, and he has not asked for water.',
    question: 'What is the most important clinical cue to act on?',
    options: [
      { id: 'a', text: 'He is just tired from surgery', isCorrect: false },
      { id: 'b', text: 'Dry mouth and drowsiness after surgery', isCorrect: true },
      { id: 'c', text: 'He needs more blankets', isCorrect: false },
      { id: 'd', text: 'He seems to be resting well', isCorrect: false },
    ],
    explanation: 'Dry mouth and drowsiness are early warning signs of dehydration. After surgery, fluid balance requires close monitoring.',
    keyLearning: 'Dry mouth + post-op drowsiness = dehydration risk.',
  },
  {
    id: 'cue_b2', difficulty: 'beginner', title: 'Breathing Check',
    context: 'Ms. Bai, 58yo, is sitting up in bed and breathing faster than usual. She says she feels "a little tight" in her chest.',
    question: 'Which observation needs immediate attention?',
    options: [
      { id: 'a', text: 'She is anxious about her diagnosis', isCorrect: false },
      { id: 'b', text: 'Fast breathing with chest tightness', isCorrect: true },
      { id: 'c', text: 'Her medication schedule needs adjusting', isCorrect: false },
      { id: 'd', text: 'She just needs to relax', isCorrect: false },
    ],
    explanation: 'Fast breathing (tachypnea) combined with chest tightness is a key clinical cue for respiratory compromise that requires urgent assessment.',
    keyLearning: 'Tachypnea + chest tightness = respiratory alert.',
  },
  {
    id: 'cue_b3', difficulty: 'beginner', title: 'Wound Observation',
    context: 'Mr. Ren, 45yo, had abdominal surgery yesterday. His incision "feels warm" and he rates his pain 7 out of 10.',
    question: 'What is the key clinical cue here?',
    options: [
      { id: 'a', text: 'Post-surgical pain is expected and normal', isCorrect: false },
      { id: 'b', text: 'Warm incision and high pain rating together', isCorrect: true },
      { id: 'c', text: 'He is being overly anxious', isCorrect: false },
      { id: 'd', text: 'He should request more pillows', isCorrect: false },
    ],
    explanation: 'Warmth and increasing pain at a surgical site together are early signs of wound infection or inflammation — not just normal recovery discomfort.',
    keyLearning: 'Warm incision + worsening pain = early infection sign.',
  },
  // ── Standard ──
  {
    id: 'cue_s1', difficulty: 'standard', title: 'Fever Pattern',
    context: 'Ms. Lin, 33yo, admitted for a UTI. Temperature 38.5°C and heart rate 102 bpm. She says she feels "a bit cold."',
    question: 'Which combination of cues is most clinically significant?',
    options: [
      { id: 'a', text: 'She is feeling cold and nervous', isCorrect: false },
      { id: 'b', text: 'Elevated temperature alone is enough to watch', isCorrect: false },
      { id: 'c', text: 'Elevated temp (38.5°C) AND elevated heart rate (102 bpm) together', isCorrect: true },
      { id: 'd', text: 'Feeling cold only', isCorrect: false },
    ],
    explanation: 'Fever combined with tachycardia (HR >100) suggests the infection may be spreading beyond the urinary tract — an early systemic response that warrants close monitoring for sepsis.',
    keyLearning: 'Fever + tachycardia together escalates the clinical picture.',
  },
  {
    id: 'cue_s2', difficulty: 'standard', title: 'Dehydration Pattern',
    context: 'Mr. Park, 67yo, is on a diuretic. He has not urinated in 6 hours. His skin tents slightly when pinched gently.',
    question: 'Which two cues together indicate the most important concern?',
    options: [
      { id: 'a', text: 'The diuretic must be working properly', isCorrect: false },
      { id: 'b', text: 'No urination for 6 hours alone', isCorrect: false },
      { id: 'c', text: 'No urination for 6 hours AND skin tenting together', isCorrect: true },
      { id: 'd', text: 'He needs to increase his salt intake', isCorrect: false },
    ],
    explanation: 'Oliguria (low urine output) combined with skin tenting (poor skin turgor) are two converging cues pointing to significant dehydration — especially concerning in a patient on diuretics.',
    keyLearning: 'Oliguria + poor skin turgor = significant dehydration.',
  },
  {
    id: 'cue_s3', difficulty: 'standard', title: 'Mental Status Change',
    context: 'Mrs. Chen, 78yo, was calm at morning rounds. Now she seems confused, keeps asking where she is, and is pulling at her IV line.',
    question: 'What is the most clinically important cue?',
    options: [
      { id: 'a', text: 'She is having a difficult day emotionally', isCorrect: false },
      { id: 'b', text: 'She is pulling at her IV line', isCorrect: false },
      { id: 'c', text: 'A sudden change from calm to confused in a previously stable elderly patient', isCorrect: true },
      { id: 'd', text: 'She needs a quieter room', isCorrect: false },
    ],
    explanation: 'Acute confusion (sudden onset) in a previously calm elderly patient is a high-priority clinical cue. It can signal infection, hypoxia, electrolyte imbalance, or medication side effects — all needing investigation.',
    keyLearning: 'Acute new confusion in elderly = urgent clinical cue.',
  },
  // ── Advanced ──
  {
    id: 'cue_a1', difficulty: 'advanced', title: 'Converging Signs',
    context: 'Mr. Zhang, 55yo, returned from a procedure 4 hours ago. Chart notes: BP 90/60, RR 22, urine output 20mL/hr for the past 3 hours. He is pale and his hands are cool.',
    question: 'Which cluster of cues indicates the most urgent concern?',
    options: [
      { id: 'a', text: 'Low blood pressure alone is the main concern', isCorrect: false },
      { id: 'b', text: 'Cool hands and pallor are the only important cues', isCorrect: false },
      { id: 'c', text: 'Low BP + elevated RR + very low urine output — three converging signs', isCorrect: true },
      { id: 'd', text: 'He simply needs more rest after the procedure', isCorrect: false },
    ],
    explanation: 'Hypotension, tachypnea, and oliguria forming a pattern together indicate hypoperfusion or early shock. The hidden cue was the urine output — easily missed without actively checking fluid charts. All three must be read together.',
    keyLearning: 'Cluster of BP ↓ + RR ↑ + urine ↓ = hypoperfusion pattern.',
  },
  {
    id: 'cue_a2', difficulty: 'advanced', title: 'The Distractor',
    context: 'Ms. Fang, 29yo, post-op Day 2. She mentions mild itching from her antibiotics. Vitals: temp 37.2°C, RR 18, BP 118/76. She also mentions her calf has been aching since yesterday — she thought it was from lying in bed.',
    question: 'Which cue is being obscured by a distractor?',
    options: [
      { id: 'a', text: 'The antibiotic allergy reaction is the main concern', isCorrect: false },
      { id: 'b', text: 'Slightly elevated vital signs indicate concern', isCorrect: false },
      { id: 'c', text: 'Unilateral calf pain after surgery — the distractor is the itching', isCorrect: true },
      { id: 'd', text: 'Her inactivity in bed is the key problem', isCorrect: false },
    ],
    explanation: 'The antibiotic itch is a distractor. Vital signs are actually normal. The key clinical cue is unilateral (one-sided) calf pain in a post-operative patient — a red flag for deep vein thrombosis (DVT). Distractors are common in clinical settings.',
    keyLearning: 'New unilateral calf pain post-op = DVT red flag; do not let distractors hide it.',
  },
];

// ── Rapid Triage Hall scenarios ────────────────────────────────────────────

export interface TriagePatient { id: string; name: string; age: number; situation: string; }
export interface TriageScenario {
  id: string;
  difficulty: PracticeDifficulty;
  title: string;
  instruction: string;
  patients: TriagePatient[];
  correctPatientId: string;
  explanation: string;
  keyLearning: string;
}

export const TRIAGE_SCENARIOS: TriageScenario[] = [
  // ── Beginner (2 patients) ──
  {
    id: 'tri_b1', difficulty: 'beginner', title: 'What Matters First?',
    instruction: 'One patient needs urgent attention. Who do you prioritize?',
    patients: [
      { id: 'a', name: 'Ms. Park, 45yo', age: 45, situation: 'Asking for a warmer blanket.' },
      { id: 'b', name: 'Mr. Chen, 72yo', age: 72, situation: 'Breathing fast and appears confused.' },
    ],
    correctPatientId: 'b',
    explanation: 'Fast breathing with confusion are urgent signs that need immediate assessment. A blanket request is valid but not an emergency.',
    keyLearning: 'Breathing change + confusion = urgent. Comfort requests = lower priority.',
  },
  {
    id: 'tri_b2', difficulty: 'beginner', title: 'Urgent vs. Waiting',
    instruction: 'Both patients call at the same time. Who comes first?',
    patients: [
      { id: 'a', name: 'Mr. Ren, 61yo', age: 61, situation: 'Mild headache for 30 minutes. Took his usual pain reliever.' },
      { id: 'b', name: 'Ms. Bai, 54yo', age: 54, situation: 'Just reported chest tightness and difficulty breathing.' },
    ],
    correctPatientId: 'b',
    explanation: 'Chest tightness with breathing difficulty is a potential emergency. A chronic mild headache that is being managed can wait safely.',
    keyLearning: 'Respiratory or cardiac symptoms always take priority.',
  },
  {
    id: 'tri_b3', difficulty: 'beginner', title: 'Visible Signs',
    instruction: 'Two patients need attention at the same moment. Who is first?',
    patients: [
      { id: 'a', name: 'Mrs. Lin, 68yo', age: 68, situation: 'Cannot sleep and wants help adjusting her pillow.' },
      { id: 'b', name: 'Mr. Wei, 50yo', age: 50, situation: 'Sweating heavily, pale, and holding his abdomen.' },
    ],
    correctPatientId: 'b',
    explanation: 'Heavy sweating (diaphoresis) and pallor with abdominal pain are serious warning signs requiring urgent evaluation. Comfort requests are lower urgency.',
    keyLearning: 'Diaphoresis + pallor = warning signs requiring immediate evaluation.',
  },
  // ── Standard (3 patients) ──
  {
    id: 'tri_s1', difficulty: 'standard', title: 'Three Calls',
    instruction: 'Three patients need you at the same time. Who is highest priority?',
    patients: [
      { id: 'a', name: 'Ms. Zhang, 67yo', age: 67, situation: 'Requesting her scheduled evening medications.' },
      { id: 'b', name: 'Mr. Fang, 44yo', age: 44, situation: 'Surgical drain fell out 10 minutes ago and the site is actively bleeding.' },
      { id: 'c', name: 'Mrs. Park, 71yo', age: 71, situation: 'Has not had a bowel movement in 2 days and wants laxatives.' },
    ],
    correctPatientId: 'b',
    explanation: 'A dislodged surgical drain with active bleeding is an urgent situation requiring immediate intervention. Medications and bowel concerns are important but can wait briefly.',
    keyLearning: 'Active bleeding always takes immediate priority.',
  },
  {
    id: 'tri_s2', difficulty: 'standard', title: 'Acute Change',
    instruction: 'Three patients need attention. Who needs you first?',
    patients: [
      { id: 'a', name: 'Mr. Wei, 60yo', age: 60, situation: 'IV antibiotics completed. Asking when his next bag will be hung.' },
      { id: 'b', name: 'Mrs. Lin, 77yo', age: 77, situation: 'Sudden new confusion, trying to get out of bed. Family reports she was completely fine this morning.' },
      { id: 'c', name: 'Mr. Ren, 52yo', age: 52, situation: 'Wants to know his blood test results.' },
    ],
    correctPatientId: 'b',
    explanation: 'Acute confusion with a sudden onset in an elderly patient is a high-priority concern — it can indicate infection, hypoxia, or worse. IV timing and test results are lower urgency.',
    keyLearning: 'New acute confusion in elderly = high priority, especially if sudden.',
  },
  {
    id: 'tri_s3', difficulty: 'standard', title: 'Worst of Life',
    instruction: 'Three patients need help at once. Who is highest priority?',
    patients: [
      { id: 'a', name: 'Ms. Bai, 34yo', age: 34, situation: 'Post-op Day 3. Wound itches a little. Healing looks normal.' },
      { id: 'b', name: 'Mr. Chen, 55yo', age: 55, situation: 'Reports sudden severe headache, 9/10. "Worst headache of my life."' },
      { id: 'c', name: 'Mrs. Zhang, 48yo', age: 48, situation: 'Asking to change tonight\'s dinner menu.' },
    ],
    correctPatientId: 'b',
    explanation: 'A sudden, severe "worst headache of my life" is a classic red-flag symptom for conditions like subarachnoid hemorrhage. New severe neurological symptoms require immediate evaluation.',
    keyLearning: '"Worst headache of my life" = neurological red flag, act immediately.',
  },
  // ── Advanced (2 patients — complex decisions) ──
  {
    id: 'tri_a1', difficulty: 'advanced', title: 'Changed Status',
    instruction: 'Assess the changing situation. One patient just worsened. Who is highest priority now?',
    patients: [
      { id: 'a', name: 'Mr. Ren, 58yo', age: 58, situation: 'Post-op Day 2. BP 132/84, SpO2 98%, pain 4/10. Stable since morning.' },
      { id: 'b', name: 'Ms. Lin, 40yo', age: 40, situation: 'Was mildly nauseous 10 minutes ago. Now reports sudden severe chest pain radiating to her left arm.' },
      { id: 'c', name: 'Mr. Fang, 72yo', age: 72, situation: 'Recovering from pneumonia. Temp 37.8°C, SpO2 94%, on scheduled antibiotics. Slightly short of breath but unchanged since last check.' },
    ],
    correctPatientId: 'b',
    explanation: 'The acute change in Ms. Lin — from mild nausea to sudden severe chest pain radiating to the arm — is the critical signal. Mr. Fang (SpO2 94%) has some concerns but is on a treatment plan and unchanged. Mr. Ren is stable. Acute changes always take priority over chronic baseline concerns.',
    keyLearning: 'A sudden acute change (new chest pain + radiation) > a stable low-grade concern.',
  },
  {
    id: 'tri_a2', difficulty: 'advanced', title: 'The Subtle Priority',
    instruction: 'This decision is less obvious. Who needs you first?',
    patients: [
      { id: 'a', name: 'Mrs. Park, 82yo', age: 82, situation: 'Feeling "faint" and "a bit out of it." BP taken 5 minutes ago: 92/58 mmHg.' },
      { id: 'b', name: 'Mr. Wei, 64yo', age: 64, situation: 'Mild chest discomfort 3/10 for 2 days. Says it is "probably gas." SpO2 97%, HR 88.' },
      { id: 'c', name: 'Ms. Bai, 35yo', age: 35, situation: 'Post-procedure, asking to be disconnected from monitoring to use the bathroom.' },
    ],
    correctPatientId: 'a',
    explanation: 'Faintness with hypotension (92/58 mmHg) in an 82yo is urgent — could be orthostatic hypotension, early sepsis, or cardiac compromise. Mr. Wei\'s 2-day mild discomfort also needs follow-up but is not acutely changing. Ms. Bai\'s request is manageable.',
    keyLearning: 'Faintness + hypotension in an elderly patient = urgent investigation needed.',
  },
];

// ── Stabilize Stack Lab scenarios ─────────────────────────────────────────

export interface StackStep { id: string; text: string; explanation: string; isDistractor?: boolean; }
export interface StackScenario {
  id: string;
  difficulty: PracticeDifficulty;
  title: string;
  context: string;
  steps: StackStep[];
  correctOrder: string[];
  teachingNote: string;
}

export const STACK_SCENARIOS: StackScenario[] = [
  // ── Beginner (3 steps) ──
  {
    id: 'stack_b1', difficulty: 'beginner', title: 'Steady Hands',
    context: 'A patient shows signs of low blood sugar. Arrange these 3 care steps in the correct order.',
    steps: [
      { id: 'assess',    text: 'Assess',    explanation: 'Check glucose level and confirm symptoms of hypoglycemia first.' },
      { id: 'stabilize', text: 'Stabilize', explanation: 'Provide oral glucose or treatment as ordered.' },
      { id: 'reassess',  text: 'Reassess',  explanation: 'Check again to confirm the treatment is working.' },
    ],
    correctOrder: ['assess', 'stabilize', 'reassess'],
    teachingNote: 'Assess → Stabilize → Reassess is the foundation of safe clinical care. Never treat before confirming the problem.',
  },
  {
    id: 'stack_b2', difficulty: 'beginner', title: 'Fever Response',
    context: 'A patient has a high fever (38.9°C). Arrange these 3 steps in the correct clinical order.',
    steps: [
      { id: 'vitals',   text: 'Check vital signs',      explanation: 'Confirm the temperature and check other vitals (HR, BP) to have accurate information.' },
      { id: 'comfort',  text: 'Apply comfort measures', explanation: 'Assist with cooling measures (light blanket, cool cloth) as per protocol while monitoring.' },
      { id: 'notify',   text: 'Notify the care team',   explanation: 'Report findings with complete information so the team can decide on treatment.' },
    ],
    correctOrder: ['vitals', 'comfort', 'notify'],
    teachingNote: 'Always gather information before intervening, and always report with complete data.',
  },
  {
    id: 'stack_b3', difficulty: 'beginner', title: 'Safe Handover',
    context: 'You are handing over a patient to the next shift. Arrange these 3 steps in the safest order.',
    steps: [
      { id: 'check',     text: 'Do a final safety check',       explanation: 'Confirm the patient is stable, IV lines are secure, and nothing urgent is pending.' },
      { id: 'document',  text: 'Document your observations',    explanation: 'Write clear, accurate notes so the incoming nurse has complete information.' },
      { id: 'brief',     text: 'Brief the incoming nurse (SBAR)', explanation: 'Use SBAR to communicate current status, concerns, and outstanding tasks.' },
    ],
    correctOrder: ['check', 'document', 'brief'],
    teachingNote: 'Safety check → Document → Hand off. Never hand off before confirming stability.',
  },
  // ── Standard (4 steps) ──
  {
    id: 'stack_s1', difficulty: 'standard', title: 'Wound Care',
    context: 'You need to perform a dressing change on a surgical wound. Arrange these 4 steps correctly.',
    steps: [
      { id: 'gather',   text: 'Gather your supplies',           explanation: 'Prepare everything before touching the patient to maintain a clean field.' },
      { id: 'assess_w', text: 'Assess the wound appearance',    explanation: 'Observe the wound before cleaning — note colour, exudate, and signs of infection.' },
      { id: 'clean',    text: 'Clean and dress the wound',      explanation: 'Use proper technique to clean and apply the new dressing.' },
      { id: 'document', text: 'Document wound status',          explanation: 'Record your observations and what was done so the team has an accurate record.' },
    ],
    correctOrder: ['gather', 'assess_w', 'clean', 'document'],
    teachingNote: 'Prepare → Assess → Act → Document. Assessment before action prevents missing signs of complications.',
  },
  {
    id: 'stack_s2', difficulty: 'standard', title: 'Post-Fall Response',
    context: 'A patient has just fallen in their room. Arrange these 4 steps in priority order.',
    steps: [
      { id: 'reassure', text: 'Reassure and assess mental status', explanation: 'First contact: speak calmly, check alertness, and assess if they can communicate clearly.' },
      { id: 'injuries', text: 'Check for injuries',               explanation: 'Look for obvious injuries (head, limbs, hip) before attempting to move them.' },
      { id: 'assist',   text: 'Call for assistance if needed',    explanation: 'Do not attempt to lift alone. Request help to ensure safety for patient and staff.' },
      { id: 'document', text: 'Document the incident',            explanation: 'Record what happened, the assessment findings, and all actions taken.' },
    ],
    correctOrder: ['reassure', 'injuries', 'assist', 'document'],
    teachingNote: 'Patient safety first, then safety of move, then documentation. Always assess before moving a fallen patient.',
  },
  {
    id: 'stack_s3', difficulty: 'standard', title: 'Medication Administration',
    context: 'You are about to give oral medication to a patient. Arrange these 4 steps in the correct safe order.',
    steps: [
      { id: 'identify',  text: 'Confirm patient identity',             explanation: 'Use two identifiers (name + DOB) before any medication — always.' },
      { id: 'prepare',   text: 'Prepare the medication',               explanation: 'Check the 5 rights (patient, drug, dose, route, time) and prepare the dose.' },
      { id: 'swallow',   text: 'Assess ability to swallow safely',     explanation: 'Confirm the patient can swallow before administering to prevent aspiration.' },
      { id: 'doc_med',   text: 'Document administration',              explanation: 'Record immediately after giving, not before, to prevent double-dosing.' },
    ],
    correctOrder: ['identify', 'prepare', 'swallow', 'doc_med'],
    teachingNote: '5 Rights + identity check before every medication. Never skip the swallow assessment.',
  },
  // ── Advanced (5 steps with distractor) ──
  {
    id: 'stack_a1', difficulty: 'advanced', title: 'Rapid Response',
    context: 'A patient begins showing signs of rapid deterioration. Arrange these steps in the correct urgent order. One action, while valid, is a lower-priority distractor from immediate care.',
    steps: [
      { id: 'abcde',     text: 'Perform ABCDE assessment',               explanation: 'Start with a rapid structured assessment: Airway, Breathing, Circulation, Disability, Exposure.' },
      { id: 'airway',    text: 'Open airway + give supplemental oxygen', explanation: 'Address any immediate airway or breathing compromise first.' },
      { id: 'position',  text: 'Position safely (semi-Fowler\'s)',       explanation: 'Positioning supports breathing and reduces aspiration risk while monitoring continues.' },
      { id: 'iv_alert',  text: 'Ensure IV access and alert care team',   explanation: 'IV access enables fast treatment; alerting the team brings expert help quickly.' },
      { id: 'whiteboard', text: 'Update the patient whiteboard',         explanation: 'This is useful for communication but is NOT a priority during acute deterioration.', isDistractor: true },
    ],
    correctOrder: ['abcde', 'airway', 'position', 'iv_alert', 'whiteboard'],
    teachingNote: 'ABCDE first, then targeted interventions. The whiteboard update (distractor) matters, but never before stabilising the patient.',
  },
  {
    id: 'stack_a2', difficulty: 'advanced', title: 'Post-Op Recovery',
    context: 'A patient arrives in the recovery room after surgery. Arrange these 6 priorities in order.',
    steps: [
      { id: 'abc',       text: 'Assess airway, breathing, circulation', explanation: 'The first priority post-anaesthesia: confirm the patient is breathing and has adequate circulation.' },
      { id: 'iv_check',  text: 'Confirm IV site and fluids running',    explanation: 'Ensure IV access is patent and fluid orders are correct before any medications are needed urgently.' },
      { id: 'site',      text: 'Check surgical site and dressings',     explanation: 'Inspect for unexpected bleeding or dressing saturation while monitoring continues.' },
      { id: 'pain',      text: 'Assess pain level',                     explanation: 'Address pain promptly — but only after confirming safe ABC and IV access.' },
      { id: 'safety',    text: 'Safety rails up + call bell in reach',  explanation: 'Environmental safety prevents falls as the patient regains orientation.' },
      { id: 'discharge', text: 'Begin discharge teaching',              explanation: 'Important but last — only once the patient is stable, alert, and ready to learn.' },
    ],
    correctOrder: ['abc', 'iv_check', 'site', 'pain', 'safety', 'discharge'],
    teachingNote: 'ABC → IV → Surgical site → Pain → Safety environment → Teaching. Never teach before the patient is clinically stable.',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

/** Pick a random scenario of the given type and difficulty. */
export function pickRandomScenario(
  activityType: PracticeActivityType,
  difficulty: PracticeDifficulty,
  excludeId?: string,
): CueScenario | TriageScenario | StackScenario | null {
  const pool =
    activityType === 'cue_lab' ? CUE_SCENARIOS :
    activityType === 'triage'  ? TRIAGE_SCENARIOS :
    STACK_SCENARIOS;
  const filtered = pool.filter(
    (s) => s.difficulty === difficulty && s.id !== excludeId,
  );
  if (!filtered.length) {
    const fallback = pool.filter((s) => s.difficulty === difficulty);
    if (!fallback.length) return null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return filtered[Math.floor(Math.random() * filtered.length)];
}

/** Return which practice milestones just crossed threshold for this activity. */
export function getNewlyEarnedMilestones(
  activityType: PracticeActivityType,
  newCount: number,
  alreadyClaimed: string[],
): UniPracticeMilestone[] {
  return UNI_PRACTICE_MILESTONES.filter(
    (m) =>
      m.activityType === activityType &&
      newCount >= m.threshold &&
      !alreadyClaimed.includes(m.id),
  );
}

/** Return which Lotus Lesson milestones just crossed threshold. */
export function getNewLotusLessonMilestones(
  newCount: number,
  alreadyClaimed: string[],
): UniPracticeMilestone[] {
  return UNI_PRACTICE_MILESTONES.filter(
    (m) =>
      m.activityType === 'lotus_lesson' &&
      newCount >= m.threshold &&
      !alreadyClaimed.includes(m.id),
  );
}

/** Human-readable summary of a GrantedPracticeReward. */
export function formatPracticeReward(r: PracticeRewardDef): string {
  const parts = [`+${r.playerXp} XP`, `+${r.universityCredits} UC`, `${r.scrollCount}× ${scrollLabel(r.scrollKey)}`];
  if (r.bonusItemKey && r.bonusItemCount) {
    parts.push(`${r.bonusItemCount}× ${itemLabel(r.bonusItemKey)}`);
  }
  return parts.join(' · ');
}

export function scrollLabel(key: string): string {
  return key === 'cue_scroll' ? 'Cue Scroll' :
    key === 'triage_scroll' ? 'Triage Scroll' :
    key === 'stab_scroll' ? 'Stabilization Scroll' : key;
}

export function itemLabel(key: string): string {
  return key === 'lesson_note' ? 'Lesson Note' :
    key === 'care_chain_manual' ? 'Care Chain Manual' :
    key === 'hero_training_page' ? 'Hero Training Page' :
    key === 'sim_pass' ? 'Simulation Pass' : key;
}

export const DIFFICULTY_LABEL: Record<PracticeDifficulty, string> = {
  beginner: 'Beginner',
  standard: 'Standard',
  advanced:  'Advanced',
};

export const DIFFICULTY_COLOR: Record<PracticeDifficulty, string> = {
  beginner: '#22D3EE',
  standard: '#F59E0B',
  advanced:  '#F97316',
};

export const ACTIVITY_META: Record<PracticeActivityType, { label: string; icon: string; accent: string; description: string; battleRecommend: string }> = {
  cue_lab: {
    label: 'Clinical Cue Lab',
    icon: 'eye-outline',
    accent: '#2DD4BF',
    description: 'Read patient scenarios and identify the most important clinical cues.',
    battleRecommend: 'Strengthens Scout and Analyze actions in Ward Shift battles.',
  },
  triage: {
    label: 'Rapid Triage Hall',
    icon: 'flash-outline',
    accent: '#F59E0B',
    description: 'Review multiple patients and decide who needs attention first.',
    battleRecommend: 'Sharpens priority decisions — useful against multi-system enemies.',
  },
  stack: {
    label: 'Stabilize Stack Lab',
    icon: 'layers-outline',
    accent: '#22D3EE',
    description: 'Arrange care actions in the correct clinical sequence.',
    battleRecommend: 'Reinforces care sequencing — the foundation of the Stabilize action.',
  },
};
