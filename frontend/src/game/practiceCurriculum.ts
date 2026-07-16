/**
 * Push 4 — University Practice Curriculum
 *
 * A structured 3-track learning path that organises the existing repeatable
 * mini-games (Cue Lab, Triage Hall, Stack Lab) into progressive modules.
 * Each module surfaces a "why" context, a primary activity, and a one-time
 * module reward — turning open-ended drills into a guided learning journey.
 *
 * No new mini-games, no new currencies. Everything links to existing routes.
 */

import { PlayerState } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PracticeActivityKind = 'cue_lab' | 'triage' | 'stack';

export interface CurriculumActivity {
  kind: PracticeActivityKind;
  label: string;
  description: string;
  route: string;          // existing route
  difficulty: 'beginner' | 'standard' | 'advanced';
}

export interface ModuleReward {
  universityCredits: number;
  playerXp: number;
  codexShards?: number;
}

export interface CurriculumModule {
  id: string;
  trackId: string;
  title: string;
  summary: string;           // 1-2 sentence "why" context
  activity: CurriculumActivity;
  reward: ModuleReward;
  /** Minimum play-count of the activity's kind needed to unlock the Claim button */
  requiredCount: number;
}

export interface CurriculumTrack {
  id: string;
  title: string;
  subtitle: string;
  icon: string;             // Ionicons name
  accentColor: string;
  modules: CurriculumModule[];
}

// ── Tracks & modules ─────────────────────────────────────────────────────────

export const CURRICULUM_TRACKS: CurriculumTrack[] = [
  // ── Track 1: Assessment Foundation ───────────────────────────────────────
  {
    id: 'track_assessment',
    title: 'Assessment Foundation',
    subtitle: 'Spot what others miss before the crisis arrives',
    icon: 'eye-outline',
    accentColor: '#2DD4BF',
    modules: [
      {
        id: 'mod_assess_1',
        trackId: 'track_assessment',
        title: 'Reading the Room',
        summary:
          'Clinical assessment starts with observation. Every patient tells a story through visible signs — before vitals, before labs. Train your eye to notice what matters.',
        activity: {
          kind: 'cue_lab',
          label: 'Cue Lab — Beginner',
          description: 'Identify the single most important clinical cue in a patient scene.',
          route: '/university/cue-lab',
          difficulty: 'beginner',
        },
        reward: { universityCredits: 30, playerXp: 20 },
        requiredCount: 1,
      },
      {
        id: 'mod_assess_2',
        trackId: 'track_assessment',
        title: 'Pattern Recognition',
        summary:
          'Experienced clinicians see patterns, not isolated symptoms. When you\'ve trained on dozens of presentations, the picture starts to speak first.',
        activity: {
          kind: 'cue_lab',
          label: 'Cue Lab — Standard',
          description: 'Spot the cue that changes the clinical picture from stable to deteriorating.',
          route: '/university/cue-lab',
          difficulty: 'standard',
        },
        reward: { universityCredits: 45, playerXp: 30, codexShards: 10 },
        requiredCount: 3,
      },
      {
        id: 'mod_assess_3',
        trackId: 'track_assessment',
        title: 'Expert Eye',
        summary:
          'Advanced assessment integrates subtle, easily-missed signs. The gap between a novice and an expert clinician is how quickly they notice what\'s hidden in plain sight.',
        activity: {
          kind: 'cue_lab',
          label: 'Cue Lab — Advanced',
          description: 'Multiple overlapping signs — identify the highest-acuity cue.',
          route: '/university/cue-lab',
          difficulty: 'advanced',
        },
        reward: { universityCredits: 65, playerXp: 45, codexShards: 20 },
        requiredCount: 6,
      },
    ],
  },

  // ── Track 2: Priority Care ────────────────────────────────────────────────
  {
    id: 'track_priority',
    title: 'Priority Care',
    subtitle: 'Make the right call when time is limited',
    icon: 'flash-outline',
    accentColor: '#F59E0B',
    modules: [
      {
        id: 'mod_priority_1',
        trackId: 'track_priority',
        title: 'Sorting by Urgency',
        summary:
          'Triage is the art of seeing four patients and knowing instantly who waits and who cannot. It is the most consequential clinical judgment — and it is a learnable skill.',
        activity: {
          kind: 'triage',
          label: 'Triage Hall — Beginner',
          description: 'Sort a small ward by urgency: Emergency, Urgent, or Routine.',
          route: '/university/triage-hall',
          difficulty: 'beginner',
        },
        reward: { universityCredits: 30, playerXp: 20 },
        requiredCount: 1,
      },
      {
        id: 'mod_priority_2',
        trackId: 'track_priority',
        title: 'Urgency Under Pressure',
        summary:
          'Real triage happens fast, under noise, with incomplete information. Building the reflex to prioritise accurately is the bridge between knowing and doing.',
        activity: {
          kind: 'triage',
          label: 'Triage Hall — Standard',
          description: 'Competing presentations — who deteriorates if you wait?',
          route: '/university/triage-hall',
          difficulty: 'standard',
        },
        reward: { universityCredits: 45, playerXp: 30, codexShards: 10 },
        requiredCount: 3,
      },
      {
        id: 'mod_priority_3',
        trackId: 'track_priority',
        title: 'Complex Ward Priorities',
        summary:
          'Advanced triage means re-sorting on the fly as conditions change. A patient who was routine five minutes ago may now be the one you run to.',
        activity: {
          kind: 'triage',
          label: 'Triage Hall — Advanced',
          description: 'Multi-patient scenario with evolving acuity.',
          route: '/university/triage-hall',
          difficulty: 'advanced',
        },
        reward: { universityCredits: 65, playerXp: 45, codexShards: 20 },
        requiredCount: 6,
      },
    ],
  },

  // ── Track 3: Care Sequencing ──────────────────────────────────────────────
  {
    id: 'track_sequencing',
    title: 'Care Sequencing',
    subtitle: 'Build the right plan in the right order',
    icon: 'layers-outline',
    accentColor: '#22D3EE',
    modules: [
      {
        id: 'mod_seq_1',
        trackId: 'track_sequencing',
        title: 'Care in Order',
        summary:
          'Clinical care is not a checklist you work through randomly. Each intervention creates the conditions for the next — wrong order means wasted effort or real harm.',
        activity: {
          kind: 'stack',
          label: 'Stack Lab — Beginner',
          description: 'Arrange three care steps for a straightforward patient scenario.',
          route: '/university/stack-lab',
          difficulty: 'beginner',
        },
        reward: { universityCredits: 30, playerXp: 20 },
        requiredCount: 1,
      },
      {
        id: 'mod_seq_2',
        trackId: 'track_sequencing',
        title: 'Building the Stack',
        summary:
          'Experienced clinicians build a mental care stack rapidly — they\'ve seen the patterns enough times that sequencing happens before they consciously think about it.',
        activity: {
          kind: 'stack',
          label: 'Stack Lab — Standard',
          description: 'Sequence a 5-step care plan with interdependent interventions.',
          route: '/university/stack-lab',
          difficulty: 'standard',
        },
        reward: { universityCredits: 45, playerXp: 30, codexShards: 10 },
        requiredCount: 3,
      },
      {
        id: 'mod_seq_3',
        trackId: 'track_sequencing',
        title: 'Perfect Sequence',
        summary:
          'At expert level, a single step out of order can cascade into missed windows. Perfect sequencing is the mark of a clinician who thinks in systems, not steps.',
        activity: {
          kind: 'stack',
          label: 'Stack Lab — Advanced',
          description: 'Complex multi-system patient — no margin for sequencing error.',
          route: '/university/stack-lab',
          difficulty: 'advanced',
        },
        reward: { universityCredits: 65, playerXp: 45, codexShards: 20 },
        requiredCount: 6,
      },
    ],
  },
];

// ── All modules flat list ─────────────────────────────────────────────────────

export const ALL_CURRICULUM_MODULES: CurriculumModule[] = CURRICULUM_TRACKS.flatMap(
  (t) => t.modules,
);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Count for the relevant practice activity in PlayerState. */
export function getActivityCount(player: PlayerState, kind: PracticeActivityKind): number {
  if (kind === 'cue_lab') return player.uni_cue_lab_count ?? 0;
  if (kind === 'triage')  return player.uni_triage_count ?? 0;
  return player.uni_stack_count ?? 0;
}

/** True if the player has done enough practice sessions to claim this module's reward. */
export function isModuleReadyToClaim(
  player: PlayerState,
  module: CurriculumModule,
): boolean {
  return getActivityCount(player, module.activity.kind) >= module.requiredCount;
}

/** True if the player has already claimed this module's one-time reward. */
export function isModuleComplete(player: PlayerState, module: CurriculumModule): boolean {
  return (player.practice_modules_completed ?? []).includes(module.id);
}

/**
 * Number of modules completed across all tracks.
 * Used for the progress summary chip on the hub card.
 */
export function countCompletedModules(player: PlayerState): number {
  return ALL_CURRICULUM_MODULES.filter((m) => isModuleComplete(player, m)).length;
}

/**
 * The first unclaimed, ready-to-claim module across all tracks
 * (used by the hub card "next action" hint).
 */
export function getNextRecommendedModule(
  player: PlayerState,
): CurriculumModule | null {
  // Ready-to-claim but not yet claimed
  const ready = ALL_CURRICULUM_MODULES.find(
    (m) => isModuleReadyToClaim(player, m) && !isModuleComplete(player, m),
  );
  if (ready) return ready;

  // Otherwise first uncompleted module
  return ALL_CURRICULUM_MODULES.find((m) => !isModuleComplete(player, m)) ?? null;
}

/** Returns all modules for a given track, with completion status. */
export function getTrackProgress(
  player: PlayerState,
  trackId: string,
): { completed: number; total: number } {
  const modules = ALL_CURRICULUM_MODULES.filter((m) => m.trackId === trackId);
  const completed = modules.filter((m) => isModuleComplete(player, m)).length;
  return { completed, total: modules.length };
}
