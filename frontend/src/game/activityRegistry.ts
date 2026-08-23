import manifest from './activityRegistry.manifest.json';

import { ACTIVITY_REGISTRY_5A, APOTHECARY_LAB_5A_PREVIEW } from './featureFlags';
import { buildGateContext, checkFeatureGate } from './progression';

export type ActivityCategory = 'learning' | 'care' | 'adventure' | 'sanctuary' | 'wellness' | 'roster' | 'market' | 'crafting';
export type ActivityHomeArea = 'university' | 'shift' | 'journey' | 'realm' | 'lotus' | 'heroes' | 'shop';
export type ActivityVisibility = 'hidden' | 'teased' | 'available' | 'temporarily_unavailable';
export type ActivityCompletionKind = 'attempt' | 'run' | 'node' | 'reflection' | 'progression' | 'none';

export interface ActivityDefinition {
  id: string;
  label: string;
  category: ActivityCategory;
  homeArea: ActivityHomeArea;
  featureId: string;
  route?: string;
  visibility: ActivityVisibility;
  dailyEligible: boolean;
  /** Existing Daily pool mode. null deliberately means no Daily objective. */
  dailyMode: string | null;
  completionKind: ActivityCompletionKind;
}

export type ActivityAccessState = 'available' | 'locked' | 'teased' | 'temporarily_unavailable' | 'hidden';

export interface ActivityAccess {
  activity: ActivityDefinition | null;
  state: ActivityAccessState;
  allowed: boolean;
  reasonCode: 'unknown_activity' | 'feature_disabled' | 'teased' | 'temporarily_unavailable' | 'feature_locked' | 'intro_incomplete' | null;
  reason: string | null;
  route?: string;
}

export interface ActivityRegistryRuntime {
  activityRegistry?: boolean;
  apothecaryPreview?: boolean;
}

export interface ActivityPlayerSnapshot {
  player_level?: number | null;
  xp?: number | null;
  runs_completed?: number | null;
  ward_defense_waves?: number | null;
  lessons_completed?: unknown[] | null;
  uni_cue_lab_count?: number | null;
  uni_triage_count?: number | null;
  uni_stack_count?: number | null;
  claimed_journey_nodes?: unknown[] | null;
  heroes_owned?: unknown[] | null;
  seen_university_intro?: boolean | null;
  wellness?: { logs_completed?: number | null } | null;
}

const rawActivities = manifest.activities as ActivityDefinition[];
export const ACTIVITY_REGISTRY_VERSION = manifest.version;
export const ACTIVITY_REGISTRY: readonly ActivityDefinition[] = rawActivities;

export function getActivity(id: string): ActivityDefinition | null {
  return ACTIVITY_REGISTRY.find((activity) => activity.id === id) ?? null;
}

function runtimeEnabled(runtime?: ActivityRegistryRuntime): boolean {
  return runtime?.activityRegistry ?? ACTIVITY_REGISTRY_5A;
}

function resolvedVisibility(activity: ActivityDefinition, runtime?: ActivityRegistryRuntime): ActivityVisibility {
  if (activity.id === 'apothecary-lab' && !(runtime?.apothecaryPreview ?? APOTHECARY_LAB_5A_PREVIEW)) {
    return 'hidden';
  }
  return activity.visibility;
}

/** Existing tutorial evidence only. This never creates a new progress counter. */
export function hasCompletedActivityIntroduction(activityId: string, player: ActivityPlayerSnapshot | null | undefined): boolean {
  if (!player) return false;
  switch (activityId) {
    case 'university-practice':
      return !!player.seen_university_intro && (player.lessons_completed?.length ?? 0) > 0;
    case 'clinical-simulation':
    case 'grand-rounds':
    case 'crisis-drill':
      return (player.lessons_completed?.length ?? 0) > 0
        && (player.uni_cue_lab_count ?? 0) > 0
        && (player.uni_triage_count ?? 0) > 0
        && (player.uni_stack_count ?? 0) > 0;
    case 'ward-shift':
      return (player.runs_completed ?? 0) > 0;
    case 'ward-defense':
      return (player.ward_defense_waves ?? 0) > 0;
    case 'journey':
      return (player.claimed_journey_nodes?.length ?? 0) > 0;
    case 'lotus-journal':
      return (player.wellness?.logs_completed ?? 0) > 0;
    case 'hero-growth':
      return (player.heroes_owned?.length ?? 0) > 0;
    default:
      return true;
  }
}

export function resolveActivityAccess(
  activityId: string,
  player: ActivityPlayerSnapshot | null | undefined,
  runtime?: ActivityRegistryRuntime,
): ActivityAccess {
  const activity = getActivity(activityId);
  if (!activity) {
    return { activity: null, state: 'hidden', allowed: false, reasonCode: 'unknown_activity', reason: 'This activity is not registered.', route: undefined };
  }
  if (!runtimeEnabled(runtime)) {
    // A safe compatibility path: the canonical layer can be rolled back without
    // changing the legacy feature gate behavior.
    const gate = checkFeatureGate(activity.featureId, buildGateContext(player));
    return { activity, state: gate.unlocked ? 'available' : 'locked', allowed: gate.unlocked, reasonCode: gate.unlocked ? null : 'feature_locked', reason: gate.reason, route: activity.route };
  }
  const visibility = resolvedVisibility(activity, runtime);
  if (visibility === 'hidden') {
    return { activity, state: 'hidden', allowed: false, reasonCode: 'feature_disabled', reason: null, route: undefined };
  }
  if (visibility === 'teased') {
    return { activity, state: 'teased', allowed: false, reasonCode: 'teased', reason: 'This activity is being prepared for a future update.', route: undefined };
  }
  if (visibility === 'temporarily_unavailable') {
    return { activity, state: 'temporarily_unavailable', allowed: false, reasonCode: 'temporarily_unavailable', reason: 'This activity is temporarily unavailable.', route: undefined };
  }
  const gate = checkFeatureGate(activity.featureId, buildGateContext(player));
  if (!gate.unlocked) {
    return { activity, state: 'locked', allowed: false, reasonCode: 'feature_locked', reason: gate.reason, route: activity.route };
  }
  // These reviewed University modes already have stronger server-side start
  // gates. Mirroring their established foundation here prevents a deep link
  // from presenting a misleading playable screen before the server rejects it.
  if (['clinical-simulation', 'grand-rounds', 'crisis-drill'].includes(activity.id)
    && !hasCompletedActivityIntroduction(activity.id, player)) {
    return {
      activity,
      state: 'locked',
      allowed: false,
      reasonCode: 'intro_incomplete',
      reason: 'Complete a Lotus Lesson plus one Cue, Triage, and Stabilize Stack practice before entering this reviewed activity.',
      route: activity.route,
    };
  }
  return { activity, state: 'available', allowed: true, reasonCode: null, reason: null, route: activity.route };
}

/** Daily can discover only introduced activities; it never grants or claims rewards. */
export function getDailyEligibleFeatureIds(
  player: ActivityPlayerSnapshot | null | undefined,
  runtime?: ActivityRegistryRuntime,
): string[] {
  const features = new Set<string>();
  for (const activity of ACTIVITY_REGISTRY) {
    if (!activity.dailyEligible || !activity.dailyMode) continue;
    if (!runtimeEnabled(runtime)) {
      // Exact pre-5A behavior: Daily used its static feature IDs with the
      // existing feature ladder only. Do not carry the new intro filter into a
      // rollback, because that would change an existing reward-bearing pool.
      if (checkFeatureGate(activity.featureId, buildGateContext(player)).unlocked) {
        features.add(activity.dailyMode);
      }
      continue;
    }
    const access = resolveActivityAccess(activity.id, player, runtime);
    if (access.allowed && hasCompletedActivityIntroduction(activity.id, player)) {
      features.add(activity.dailyMode);
    }
  }
  return [...features];
}

/** Safe public analytics metadata. No player identity, note, answer, or wellness values are included. */
export function activityAnalyticsShape(activityId: string) {
  const activity = getActivity(activityId);
  if (!activity) return null;
  return { activityId: activity.id, category: activity.category, homeArea: activity.homeArea, version: ACTIVITY_REGISTRY_VERSION };
}