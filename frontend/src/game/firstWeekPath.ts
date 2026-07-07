/**
 * First 7-Day Player Journey — Clinica: Kingdom of Healing
 *
 * Defines the recommended day-by-day orientation path for new players.
 * Progress is derived from existing PlayerState fields — no new state needed.
 * Days are guidance, NOT hard time-gates: a player who progresses faster
 * simply shows more days "complete" on day 1.
 */

import { playerLevelFromXp } from './progression';

export interface JourneyStep {
  id: string;
  label: string;
  description: string;
  icon: string;
  route?: string;
  checkDone: (player: any) => boolean;
}

export interface JourneyDay {
  day: number;
  title: string;
  theme: string;
  steps: JourneyStep[];
}

export const FIRST_WEEK_PATH: JourneyDay[] = [
  {
    day: 1,
    title: 'Answer the Call',
    theme: 'First steps — prologue, University, and your first Ward Shift.',
    steps: [
      {
        id: 'd1_prologue',
        label: 'Complete the Prologue',
        description: 'Face the Infarct Sovereign and learn why healing matters.',
        icon: 'sparkles',
        checkDone: (p) => !!(p?.prologue_complete),
      },
      {
        id: 'd1_reminiscence',
        label: 'Restore Your Identity',
        description: 'Recover your healing past through the Reminiscence.',
        icon: 'layers-outline',
        checkDone: (p) => !!(p?.identity_restored),
      },
      {
        id: 'd1_university',
        label: 'Visit Clinica University',
        description: 'Open the University and see the Lotus Lessons path.',
        icon: 'school-outline',
        checkDone: (p) => (p?.university_credits || 0) > 0 || (p?.lessons_completed || []).length > 0,
      },
      {
        id: 'd1_ward_shift',
        label: 'Win Your First Ward Shift',
        description: 'Purify a disease in your first clinical encounter.',
        icon: 'medkit-outline',
        checkDone: (p) => (p?.runs_completed || 0) >= 1,
      },
      {
        id: 'd1_daily_rounds',
        label: 'Check In to Daily Ward Rounds',
        description: 'Claim your first daily check-in reward.',
        icon: 'calendar-outline',
        checkDone: (p) => {
          const rounds = p?.daily_rounds;
          if (!rounds) return false;
          const today = new Date().toISOString().slice(0, 10);
          return rounds.last_checkin_date === today || (rounds.streak_count || 0) >= 1;
        },
      },
    ],
  },
  {
    day: 2,
    title: 'Deepen Your Understanding',
    theme: 'Complete a Lotus Lesson and start your Wellness Journal.',
    steps: [
      {
        id: 'd2_lesson',
        label: 'Complete a Lotus Lesson',
        description: 'Finish a lesson in the Vital Foundations path.',
        icon: 'leaf',
        route: '/university/lessons',
        checkDone: (p) => (p?.lessons_completed || []).some((id: string) => id.startsWith('lotus:')),
      },
      {
        id: 'd2_journal',
        label: 'Log a Lotus Journal Entry',
        description: 'Record a meal, wellness check-in, or reflection.',
        icon: 'journal-outline',
        route: '/lotus-journal',
        checkDone: (p) => !!(
          (p?.wellness_log?.entries?.length) ||
          (p?.wellness_log?.activities?.length) ||
          (p?.wellness_entries > 0)
        ),
      },
      {
        id: 'd2_heroes',
        label: 'Preview Your Heroes',
        description: 'Visit the Hall of Heroes to see your healing team.',
        icon: 'people-outline',
        route: '/(tabs)/heroes',
        checkDone: (p) => (p?.heroes_owned || []).length >= 1,
      },
    ],
  },
  {
    day: 3,
    title: 'Grow Your Healers',
    theme: 'More lessons, another Ward Shift, and unlock a new hero.',
    steps: [
      {
        id: 'd3_lesson2',
        label: 'Complete a Second Lotus Lesson',
        description: 'Progress further on the Vital Foundations path.',
        icon: 'book-outline',
        route: '/university/lessons',
        checkDone: (p) => (p?.lessons_completed || []).filter((id: string) => id.startsWith('lotus:')).length >= 2,
      },
      {
        id: 'd3_ward_shift2',
        label: 'Complete Another Ward Shift',
        description: 'Face a new disease and refine your healing strategy.',
        icon: 'shield-checkmark-outline',
        checkDone: (p) => (p?.runs_completed || 0) >= 2,
      },
      {
        id: 'd3_career',
        label: 'Explore the Career Explorer',
        description: 'Discover real health career paths at the University.',
        icon: 'compass-outline',
        route: '/university/career-explorer',
        checkDone: (p) => playerLevelFromXp(p?.xp ?? 0).level >= 2,
      },
    ],
  },
  {
    day: 4,
    title: 'Defend the Ward',
    theme: 'Unlock Ward Defense and push your weekly Rounds progress.',
    steps: [
      {
        id: 'd4_level4',
        label: 'Reach Player Level 4',
        description: 'Level up by winning Ward Shifts and completing lessons.',
        icon: 'trending-up',
        checkDone: (p) => playerLevelFromXp(p?.xp ?? 0).level >= 4,
      },
      {
        id: 'd4_ward_defense',
        label: 'Try Ward Defense',
        description: 'Guard the ward from incoming disease waves.',
        icon: 'git-network-outline',
        route: '/ward-defense',
        checkDone: (p) => (p?.ward_defense_runs || 0) >= 1 || playerLevelFromXp(p?.xp ?? 0).level >= 4,
      },
      {
        id: 'd4_weekly_progress',
        label: 'Reach 3 Daily Ward Round Days',
        description: 'Build your check-in habit toward the weekly goal.',
        icon: 'calendar',
        checkDone: (p) => (p?.daily_rounds?.weekly_days_completed || 0) >= 3,
      },
    ],
  },
  {
    day: 5,
    title: 'Build Your Sanctuary',
    theme: 'Explore the Realm and build a wellness streak.',
    steps: [
      {
        id: 'd5_realm',
        label: 'Place a Building in the Realm',
        description: 'Begin building your Grand Ward Sanctuary.',
        icon: 'business-outline',
        route: '/(tabs)/kingdom',
        checkDone: (p) => Object.keys(p?.realm_buildings ?? {}).filter((k: string) => k !== 'atrium').length > 0 || Object.keys(p?.realm_layout ?? {}).filter((k: string) => k !== 'grand_ward_atrium').length > 0,
      },
      {
        id: 'd5_wellness_streak',
        label: 'Log 3 Journal Entries',
        description: 'Build a wellness habit — meals, sleep, movement, or reflection.',
        icon: 'heart-outline',
        route: '/lotus-journal',
        checkDone: (p) => (p?.wellness_log?.total_logged || 0) >= 3 || (p?.wellness_entries || 0) >= 3,
      },
      {
        id: 'd5_lesson3',
        label: 'Complete a Third Lotus Lesson',
        description: 'Continue your learning journey at Clinica University.',
        icon: 'leaf',
        route: '/university/lessons',
        checkDone: (p) => (p?.lessons_completed || []).filter((id: string) => id.startsWith('lotus:')).length >= 3,
      },
    ],
  },
  {
    day: 6,
    title: 'Community Health',
    theme: 'Learn about public health and decorate your Sanctuary.',
    steps: [
      {
        id: 'd6_community',
        label: 'Visit the Community Health Board',
        description: 'Explore world events and public health topics.',
        icon: 'globe-outline',
        checkDone: (p) => (p?.chapter_progress || 1) >= 1,
      },
      {
        id: 'd6_realm_decor',
        label: 'Add a Decoration to the Realm',
        description: 'Personalize your Sanctuary with a decoration.',
        icon: 'flower-outline',
        route: '/(tabs)/kingdom',
        checkDone: (p) => Object.keys(p?.realm_decorations ?? {}).length > 0,
      },
      {
        id: 'd6_level5',
        label: 'Reach Player Level 5',
        description: 'Keep healing and learning to grow your rank.',
        icon: 'ribbon-outline',
        checkDone: (p) => playerLevelFromXp(p?.xp ?? 0).level >= 5,
      },
    ],
  },
  {
    day: 7,
    title: 'Complete Your First Week',
    theme: 'Claim your weekly reward and celebrate your first week.',
    steps: [
      {
        id: 'd7_weekly_goal',
        label: 'Complete the Weekly Rounds Goal',
        description: 'Reach 5 daily check-in days to earn your weekly reward.',
        icon: 'trophy-outline',
        checkDone: (p) => !!(p?.daily_rounds?.last_weekly_reward_date),
      },
      {
        id: 'd7_learning_profile',
        label: 'Set Your Learning Style',
        description: 'Tell Clinica how you want to learn for personalized depth.',
        icon: 'options-outline',
        route: '/learning-profile',
        checkDone: (p) => !!(p?.learning_profile),
      },
      {
        id: 'd7_profile',
        label: 'Visit Your Profile',
        description: 'Review your progress, rank, and class identity.',
        icon: 'person-outline',
        route: '/(tabs)/profile',
        checkDone: (p) => playerLevelFromXp(p?.xp ?? 0).level >= 3,
      },
    ],
  },
];

export interface JourneyProgress {
  currentDay: number;
  totalDays: number;
  completedDays: number;
  nextStep: JourneyStep | null;
  nextDayIndex: number;
}

/** Returns which step to highlight as the current recommended action. */
export function getJourneyProgress(player: any): JourneyProgress {
  const totalDays = FIRST_WEEK_PATH.length;
  let completedDays = 0;
  let nextStep: JourneyStep | null = null;
  let nextDayIndex = 0;

  for (let i = 0; i < FIRST_WEEK_PATH.length; i++) {
    const day = FIRST_WEEK_PATH[i];
    const allDone = day.steps.every((s) => s.checkDone(player));
    if (allDone) {
      completedDays++;
    } else if (!nextStep) {
      nextDayIndex = i;
      const firstIncomplete = day.steps.find((s) => !s.checkDone(player));
      if (firstIncomplete) nextStep = firstIncomplete;
    }
  }

  const currentDay = Math.min(completedDays + 1, totalDays);
  return { currentDay, totalDays, completedDays, nextStep, nextDayIndex };
}

/** Returns a short label for a learning profile ID. */
export function learningProfileLabel(profileId: string | null | undefined): string {
  switch (profileId) {
    case 'curious':
    case 'nonmedical':
    case 'rpg':
    case 'cozy':
    case 'teen':          return 'New Learner';
    case 'nursing_student':
    case 'nursingStudent':
    case 'preNursing':    return 'Health Student';
    case 'nclex':
    case 'nclexPrep':     return 'NCLEX Prep';
    case 'professional':
    case 'healthcareProfessional': return 'Clinician Review';
    case 'medical_learner': return 'Health Student';
    default:              return profileId ? profileId : 'Not set';
  }
}
