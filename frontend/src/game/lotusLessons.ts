import { PlayerState } from './types';

// ────────────────────────────────────────────────────────────
// Push 5 — Lotus Lessons (Duolingo-style onboarding path).
//
// A separate, simpler on-ramp than the full "Lessons & Simulations"
// department system in lessons.ts. Lotus Lessons is the FIRST thing a
// player is pointed to after the memory-reminiscence scene: one short,
// paced, reality-based lesson with 3-5 quick interactions, a visible
// safety disclaimer, and modest earned-only rewards (no paid Lotus Gems).
// Nothing here ever permanently fails the player out — wrong answers just
// show gentle feedback and let them continue.
// ────────────────────────────────────────────────────────────

export const LOTUS_LESSON_SAFETY_NOTE =
  'This is general wellness education, not personal medical advice. It will never block your progress — ' +
  'answer as best you can and keep going.';

export type LotusInteractionType = 'info' | 'choice';

export interface LotusInteraction {
  type: LotusInteractionType;
  prompt: string;
  detail?: string;
  choices?: { text: string; correct: boolean; feedback: string }[];
}

export interface LotusLessonRewards {
  insightCrystals: number;
  crowns: number;
  universityCredits: number;
  xp: number;
  // Hero ids granted into heroes_owned on first completion. This is how a new
  // healer earns their first heroes ("units") through University lessons —
  // completing the onboarding path populates the Hall of Heroes.
  grantHeroes?: string[];
}

export interface LotusLessonNode {
  id: string;
  pathId: string;
  title: string;
  subtitle: string;
  status: 'available' | 'coming_soon';
  interactions: LotusInteraction[];
  rewards: LotusLessonRewards;
  // Enemy id in ENEMIES/ENEMY_CLINICAL this node's concept pays off in Ward Shift.
  linkedCaseId?: string;
  payoffCopy?: string;
  // Short learning labels shown in the lesson UI and on the result bridge banner.
  // Format: "Health Skill: Noticing Cues" | "NCLEX Concept: Assessment" | "Clinical Habit: Reassess"
  learningTags?: string[];
}

export interface LotusPath {
  id: string;
  name: string;
  description: string;
  nodes: LotusLessonNode[];
}

export const LOTUS_PATHS: LotusPath[] = [
  {
    id: 'vital-foundations',
    name: 'Vital Foundations',
    description: 'The first path every recalled healer walks — simple, reality-based cues you can trust.',
    nodes: [
      {
        id: 'recognizing-cues-hydration',
        pathId: 'vital-foundations',
        title: 'Recognizing Cues: Hydration Basics',
        subtitle: 'Notice the simple signs your body gives you.',
        status: 'available',
        linkedCaseId: 'dehydration_wisp',
        payoffCopy: 'Your Lotus Lesson helped you recognize the dehydration cue — thirst, dry lips, low energy. You\'ll meet that pattern in the ward very soon.',
        learningTags: ['Health Skill: Noticing Cues', 'NCLEX Concept: Assessment'],
        rewards: { insightCrystals: 2, crowns: 25, universityCredits: 10, xp: 15, grantHeroes: ['apprentice_seer', 'village_caretaker'] },
        interactions: [
          {
            type: 'info',
            prompt: 'Before this world, before the ward — the body has always spoken in small signals.',
            detail: 'A dry mouth. A pull of tiredness. Thirst you almost ignored. These are cues, not emergencies — just information worth noticing.',
          },
          {
            type: 'choice',
            prompt: 'Which of these is a simple, everyday cue that someone may need water?',
            choices: [
              { text: 'Feeling thirsty', correct: true, feedback: 'Correct — thirst is one of the body\'s most direct hydration cues.' },
              { text: 'Feeling full after a meal', correct: false, feedback: 'Not quite — fullness is about food, not fluids. Thirst is the clearer hydration cue.' },
              { text: 'Feeling cold', correct: false, feedback: 'Not quite — feeling cold isn\'t a typical hydration cue on its own.' },
            ],
          },
          {
            type: 'info',
            prompt: 'Mild dehydration can also show up as dry lips, low energy, or trouble focusing.',
            detail: 'None of these alone mean something is seriously wrong — but together, they\'re worth a glass of water and a moment of attention.',
          },
          {
            type: 'choice',
            prompt: 'Someone reports dry lips, mild tiredness, and thirst. What is a sensible first response?',
            choices: [
              { text: 'Offer water and keep an eye on how they feel', correct: true, feedback: 'Correct — a supportive, low-pressure first response: offer water, then reassess.' },
              { text: 'Ignore it — it will pass on its own', correct: false, feedback: 'Not quite — these cues are easy and low-risk to respond to, so it\'s worth acting gently now.' },
              { text: 'Assume it\'s unrelated to fluids entirely', correct: false, feedback: 'Not quite — thirst, dry lips, and fatigue together point toward hydration first.' },
            ],
          },
          {
            type: 'info',
            prompt: 'You just practiced the first skill every Clinica healer needs: noticing before acting.',
            detail: 'In the ward, this is called a Clinical Cue — the same small, honest signal, just given a name. You\'ll meet it again very soon.',
          },
        ],
      },

      // ── Lesson 2: Fever & Warmth ─────────────────────────────────────────
      {
        id: 'fever-and-warmth',
        pathId: 'vital-foundations',
        title: 'Recognizing Cues: Fever & Warmth',
        subtitle: 'Learn to read the body\'s heat signals.',
        status: 'available',
        linkedCaseId: 'fire_imp',
        payoffCopy: 'The warmth cue you studied here is exactly what you\'ll see in the Fire Ward — the body\'s fever response, made visible. Scout first, then act.',
        learningTags: ['Health Skill: Noticing Cues', 'Clinical Habit: Reassess', 'NCLEX Concept: Assessment'],
        rewards: { insightCrystals: 2, crowns: 30, universityCredits: 10, xp: 15 },
        interactions: [
          {
            type: 'info',
            prompt: 'The body uses warmth as a messenger — not an enemy.',
            detail: 'A rise in temperature is one of the body\'s oldest tools. It signals that something is happening internally — often the immune system responding to a threat. Warmth alone isn\'t a crisis, but it is worth noticing.',
          },
          {
            type: 'choice',
            prompt: 'Which group of signs together suggests the body may be responding to infection?',
            choices: [
              { text: 'Feeling warm, chills, and unusual fatigue', correct: true, feedback: 'Correct — warmth with chills and fatigue is a classic cluster of signs that the body is working hard to fight something.' },
              { text: 'Feeling hungry, energetic, and alert', correct: false, feedback: 'Not quite — hunger and high energy aren\'t typical signs of the body responding to an infection.' },
              { text: 'Feeling calm, cool, and well-rested', correct: false, feedback: 'Not quite — these signs suggest the body is comfortable, not responding to a challenge.' },
            ],
          },
          {
            type: 'info',
            prompt: 'When warmth, chills, and fatigue appear together — rest, fluids, and reassessment are sensible first steps.',
            detail: 'These cues don\'t always mean a serious illness. But they do mean: slow down, stay hydrated, and check again in a little while to see if the signs are improving, staying the same, or getting worse. That\'s the habit of reassessment.',
          },
          {
            type: 'choice',
            prompt: 'Someone has felt warm and very tired for two days. They also report chills. What is a sensible general response?',
            choices: [
              { text: 'Encourage rest, ensure fluids, and check again in a few hours', correct: true, feedback: 'Correct — rest and fluids support the body while you monitor whether the signs improve. Checking back in is the key habit.' },
              { text: 'Assume it will pass and do nothing', correct: false, feedback: 'Not quite — two days of warmth with chills and fatigue is worth gentle monitoring, not ignoring.' },
              { text: 'Expect the warmth to be permanent', correct: false, feedback: 'Not quite — fever patterns change. Reassessment helps you notice if things are getting better or worse.' },
            ],
          },
          {
            type: 'info',
            prompt: 'The most important habit here is reassessment: you act gently, then you check again.',
            detail: 'In the ward, this is called Reassess — the same pattern. A healer doesn\'t just treat once and walk away. They watch whether the patient responds, and they adjust. You\'ve just practiced the start of that habit.',
          },
        ],
      },

      // ── Lesson 3: Breathing Basics ───────────────────────────────────────
      {
        id: 'breathing-basics',
        pathId: 'vital-foundations',
        title: 'Recognizing Cues: Breathing Basics',
        subtitle: 'Why breathing is always the first thing a healer checks.',
        status: 'available',
        linkedCaseId: 'air_sprite',
        payoffCopy: 'The breathing cues you studied here — rate, effort, unusual sounds — are the same ones you\'ll use to Scout the Air Sprite in the ward. Notice first, then act.',
        learningTags: ['NCLEX Concept: Priority', 'Health Skill: Noticing Cues', 'NCLEX Concept: Assessment'],
        rewards: { insightCrystals: 2, crowns: 30, universityCredits: 10, xp: 15 },
        interactions: [
          {
            type: 'info',
            prompt: 'Breathing is always the first thing a healer checks — before anything else.',
            detail: 'The body can manage without food for days. Without water for hours. But breathing? Minutes. That\'s why every clinical framework — ABC, ABCDE, SBAR — starts with the airway and breathing. It\'s not a rule someone invented; it\'s the body\'s own priority order.',
          },
          {
            type: 'choice',
            prompt: 'Which sign most clearly suggests someone may need immediate breathing support?',
            choices: [
              { text: 'Breathing faster than normal and saying they can\'t get enough air', correct: true, feedback: 'Correct — rapid breathing combined with a feeling of air hunger is a priority cue that the body is working hard just to breathe.' },
              { text: 'Breathing slowly and feeling relaxed', correct: false, feedback: 'Not quite — slow, relaxed breathing is a sign of comfort, not distress. The priority cue is fast breathing with effort.' },
              { text: 'Holding a normal conversation without effort', correct: false, feedback: 'Not quite — if someone can talk easily, their breathing is managing. Look for the effort, not just the rate.' },
            ],
          },
          {
            type: 'info',
            prompt: 'Calm observation tells you more than rushing to act.',
            detail: 'When you notice unusual breathing, the first step is to observe — not to immediately intervene. Count the breaths per minute (roughly). Look for effort: are the shoulders heaving? Are the nostrils flaring? Listen for sounds: wheezing, rattling, or none at all. This takes under a minute, and it shapes every decision after.',
          },
          {
            type: 'choice',
            prompt: 'You notice someone breathing quickly, with effort. Their lips look slightly blue. What should you do first?',
            choices: [
              { text: 'Observe carefully — count breaths, note effort and sounds — then act based on what you find', correct: true, feedback: 'Correct — a focused 30-second observation gives you the information to act well. The goal is targeted help, not blind response.' },
              { text: 'Immediately start any available treatment without assessing further', correct: false, feedback: 'Not quite — acting without assessing can mean you miss the real cause. Observe first, then choose the right action.' },
              { text: 'Wait and hope the signs resolve on their own', correct: false, feedback: 'Not quite — blue-tinged lips with fast, effortful breathing is a priority signal. Calm observation and then action are both needed.' },
            ],
          },
          {
            type: 'info',
            prompt: 'In the ward, this is called Scouting — and it\'s the most powerful first move in every case.',
            detail: 'Scout before you act. The Ward Shift clinical cases reward healers who observe first and then choose the right targeted action. The breathing priority you just learned is exactly the logic behind why Airway and Breathing lead every assessment.',
          },
        ],
      },
    ],
  },
];

export function getLotusPath(id: string): LotusPath | undefined {
  return LOTUS_PATHS.find((p) => p.id === id);
}

export function getLotusNode(id: string): LotusLessonNode | undefined {
  for (const path of LOTUS_PATHS) {
    const found = path.nodes.find((n) => n.id === id);
    if (found) return found;
  }
  return undefined;
}

// Lotus Lesson completions are tracked in the same PlayerState.lessons_completed
// list as the Lessons & Simulations MVP, under a distinct "lotus:" id prefix so
// the two systems never collide.
export function lotusNodeCompletionId(nodeId: string): string {
  return `lotus:${nodeId}`;
}

export function isLotusNodeComplete(player: PlayerState, nodeId: string): boolean {
  return (player.lessons_completed || []).includes(lotusNodeCompletionId(nodeId));
}

export function firstIncompleteLotusNode(player: PlayerState): LotusLessonNode | undefined {
  for (const path of LOTUS_PATHS) {
    for (const node of path.nodes) {
      if (node.status !== 'available') continue;
      if (!isLotusNodeComplete(player, node.id)) return node;
    }
  }
  return undefined;
}

// Find the Lotus Lesson node (if any) linked to a specific Ward Shift enemy id.
// Used by the lesson-to-battle bridge banner in shift-cases and result screens.
export function getLotusNodeForEnemy(enemyId: string): LotusLessonNode | undefined {
  for (const path of LOTUS_PATHS) {
    for (const node of path.nodes) {
      if (node.linkedCaseId === enemyId && node.status === 'available') return node;
    }
  }
  return undefined;
}
