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
        payoffCopy: 'Your Lotus Lesson helped you recognize the dehydration cue.',
        rewards: { insightCrystals: 2, crowns: 25, universityCredits: 10, xp: 15 },
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
      {
        id: 'fever-and-warmth',
        pathId: 'vital-foundations',
        title: 'Recognizing Cues: Fever & Warmth',
        subtitle: 'Coming soon — unlocks as you continue your training.',
        status: 'coming_soon',
        rewards: { insightCrystals: 0, crowns: 0, universityCredits: 0, xp: 0 },
        interactions: [],
      },
      {
        id: 'breathing-basics',
        pathId: 'vital-foundations',
        title: 'Recognizing Cues: Breathing Basics',
        subtitle: 'Coming soon — unlocks as you continue your training.',
        status: 'coming_soon',
        rewards: { insightCrystals: 0, crowns: 0, universityCredits: 0, xp: 0 },
        interactions: [],
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
