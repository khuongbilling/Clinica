import Constants from 'expo-constants';
import { PlayerState } from '@/src/game/types';
import type { PlayerHeroEligibility, PlayerHeroRecord, PlayerHeroAppearance } from '@/src/game/playerHero';
import type {
  SimulationConfig, SimulationDebrief, SimulationManifest, SimulationAttemptState,
} from '@/src/game/clinicalSimulation';

const BASE_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || (Constants?.expoConfig?.extra as any)?.backendUrl || '').replace(/\/$/, '');
const API = `${BASE_URL}/api`;
const BACKEND_AVAILABLE = BASE_URL.length > 0;

const REQUEST_TIMEOUT_MS = 6000;

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BACKEND_AVAILABLE) throw new Error('Backend not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  createPlayer: (params: { name: string; aptitude: string; recommended_aptitude?: string; learning_goal?: string; learning_profile?: string; codex_depth?: string; prologue_complete?: boolean; identity_restored?: boolean; diagnostic_intro_seen?: boolean }) =>
    http<PlayerState>('/player', { method: 'POST', body: JSON.stringify(params) }),
  migrateGuestSession: (id: string, legacyToken: string) =>
    http<{ session_token: string }>(`/player/${id}/session/migrate`, {
      method: 'POST',
      headers: { 'X-Clinica-Economy-Token': legacyToken },
    }),
  getPlayer: (id: string, economyToken?: string) => http<PlayerState>(
    `/player/${id}`,
    { headers: economyToken ? { 'X-Clinica-Session': economyToken, 'X-Clinica-Economy-Token': economyToken } : {} },
  ),
  updatePlayer: (id: string, patch: Partial<PlayerState>, economyToken?: string) =>
    http<PlayerState>(`/player/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
      headers: economyToken ? { 'X-Clinica-Session': economyToken, 'X-Clinica-Economy-Token': economyToken } : {},
    }),
  claimSpecialization: (id: string, specializationId: string, sessionToken?: string) =>
    http<PlayerState>(`/player/${id}/claim-specialization`, {
      method: 'POST',
      body: JSON.stringify({ specialization_id: specializationId }),
      headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
    }),
  getPlayerHeroEligibility: (id: string, sessionToken?: string) =>
    http<PlayerHeroEligibility>(`/player/${id}/player-hero/eligibility`, {
      headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
    }),
  createPlayerHero: (
    id: string,
    input: {
      display_name: string;
      pronouns: string;
      appearance: PlayerHeroAppearance;
      focus: string;
      stats: Record<string, number>;
      core_trait_id: string;
      natural_talent_id: string;
      creed_id: string;
    },
    sessionToken?: string,
  ) => http<{ player: PlayerState; player_hero: PlayerHeroRecord; already_created: boolean }>(
    `/player/${id}/player-hero/create`,
    {
      method: 'POST',
      body: JSON.stringify(input),
      headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
    },
  ),
  mutateEconomy: (
    id: string,
    mutation: {
      kind: 'spend_stamina' | 'refill_stamina' | 'consume_repeat_budget' | 'grant_stamina_bonus';
      cost?: number;
      amount?: number;
      units?: number;
      source?: string;
      period?: 'day' | 'week';
    },
    economyToken?: string,
  ) => http<{ player: PlayerState; multiplier: number; granted?: number; cost?: number; stamina_bonus?: number }>(
    `/player/${id}/economy`,
    {
      method: 'POST',
      body: JSON.stringify(mutation),
      headers: economyToken ? { 'X-Clinica-Session': economyToken, 'X-Clinica-Economy-Token': economyToken } : {},
    },
  ),
  grantActivityReward: (
    id: string,
    activity: 'clinical_battle' | 'journey_treasure' | 'auto_sweep' | 'ward_defense' | 'university_practice' | 'world_event',
    grant: {
      tier?: 'regular' | 'elite' | 'area_boss' | 'major_boss';
      repeatable?: boolean;
      claim_key?: string;
      attempt_id?: string;
      xp?: number; crowns?: number; codex_shards?: number; epidemic_tokens?: number; university_credits?: number;
      hero_xp?: Record<string, number>; inventory?: Record<string, number>; mastery?: Record<string, number>;
    },
    economyToken?: string,
  ) => http<{ player: PlayerState; multiplier: number; units: number; granted: Record<string, number> }>(
    `/player/${id}/rewards/${activity}`,
    {
      method: 'POST',
      body: JSON.stringify({ activity, ...grant }),
      headers: economyToken ? { 'X-Clinica-Session': economyToken, 'X-Clinica-Economy-Token': economyToken } : {},
    },
  ),
  beginActivityAttempt: (
    id: string,
    activity: 'clinical_battle' | 'journey_treasure' | 'auto_sweep' | 'ward_defense' | 'university_practice' | 'world_event',
    tier: 'regular' | 'elite' | 'area_boss' | 'major_boss',
    sessionToken?: string,
  ) => http<{ attempt_id: string; activity: string; tier: string }>(
    `/player/${id}/activity-attempts/${activity}`,
    {
      method: 'POST',
      body: JSON.stringify({ tier }),
      headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
    },
  ),
  claimActivityAttempt: (id: string, attemptId: string, sessionToken?: string) =>
    http<{ player: PlayerState; multiplier: number; units: number; granted: Record<string, number> }>(
      `/player/${id}/activity-attempts/${attemptId}/claim`,
      {
        method: 'POST',
        headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
      },
    ),
  completeUniversityPractice: (
    id: string,
    completion: {
      activity: 'cue_lab' | 'triage' | 'stack';
      difficulty: 'introductory' | 'standard' | 'advanced' | 'expert';
      challenge_id: string;
      challenge_version: number;
      attempt_id: string;
      score: number;
      safety_result: 'safe' | 'needs_review' | 'unsafe';
    },
    sessionToken?: string,
  ) => http<{ player: PlayerState; multiplier: number; granted: Record<string, number>; first_completion: boolean; already_claimed: boolean; milestone_ids: string[] }>(
    `/player/${id}/university-practice/complete`,
    {
      method: 'POST',
      body: JSON.stringify(completion),
      headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
    },
  ),
  getClinicalSimulations: (id: string, sessionToken?: string) =>
    http<{ simulations: SimulationManifest[]; recommended_id: string; eligible: boolean; reason?: string }>(
      `/player/${id}/clinical-simulations`,
      { headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  beginClinicalSimulation: (
    id: string,
    simulationId: string,
    config: SimulationConfig,
    retryMode: 'same_branch' | 'new_variation' | 'similar_case' | 'guided' = 'new_variation',
    priorAttemptId?: string,
    sessionToken?: string,
  ) => http<{ attempt: SimulationAttemptState }>(
    `/player/${id}/clinical-simulations/attempts`,
    {
      method: 'POST',
      body: JSON.stringify({ simulation_id: simulationId, config, retry_mode: retryMode, prior_attempt_id: priorAttemptId }),
      headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
    },
  ),
  getClinicalSimulationAttempt: (id: string, attemptId: string, sessionToken?: string) =>
    http<{ attempt: SimulationAttemptState }>(
      `/player/${id}/clinical-simulations/attempts/${attemptId}`,
      { headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  submitClinicalSimulationAction: (id: string, attemptId: string, actionId: string, sessionToken?: string) =>
    http<{ attempt: SimulationAttemptState }>(
      `/player/${id}/clinical-simulations/attempts/${attemptId}/actions`,
      {
        method: 'POST',
        body: JSON.stringify({ action_id: actionId }),
        headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
      },
    ),
  completeClinicalSimulation: (id: string, attemptId: string, sessionToken?: string) =>
    http<{ player: PlayerState; debrief: SimulationDebrief; already_completed: boolean }>(
      `/player/${id}/clinical-simulations/attempts/${attemptId}/complete`,
      {
        method: 'POST',
        headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
      },
    ),
  beginUniversityPracticeAttempt: (
    id: string,
    attempt: {
      activity: 'cue_lab' | 'triage' | 'stack';
      difficulty: 'introductory' | 'standard' | 'advanced' | 'expert';
      challenge_id: string;
      challenge_version: number;
    },
    sessionToken?: string,
  ) => http<{ attempt_id: string; activity: string; challenge_id: string; challenge_version: number }>(
    `/player/${id}/university-practice/attempts`,
    { method: 'POST', body: JSON.stringify(attempt), headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
  ),
  completeWardDefense: (
    id: string,
    completion: {
      run_id: string; cleared: boolean; stability: number; score: number;
      clinical_correct: number; clinical_total: number; overtime_wave: number;
      question_family_ids: string[]; missed_family_ids: string[];
    },
    sessionToken?: string,
  ) => http<{ player: PlayerState; already_claimed: boolean; granted: Record<string, number>; stars: number; aegis_fragment: boolean }>(
    `/player/${id}/ward-defense/complete`,
    { method: 'POST', body: JSON.stringify(completion), headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
  ),
  startWardDefense: (id: string, sessionToken?: string) =>
    http<{ run_id: string; scenario_id: string; reused: boolean }>(
      `/player/${id}/ward-defense/start`,
      { method: 'POST', body: JSON.stringify({}), headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  purchaseWardExchange: (id: string, itemId: string, sessionToken?: string) =>
    http<{ player: PlayerState; granted: Record<string, number>; purchase_count: number }>(
      `/player/${id}/ward-defense/exchange`,
      { method: 'POST', body: JSON.stringify({ item_id: itemId }), headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  assembleWardAegis: (id: string, sessionToken?: string) =>
    http<{ player: PlayerState; assembled: boolean }>(
      `/player/${id}/ward-defense/assemble-aegis`,
      { method: 'POST', headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  purchaseWardAegisSidegrade: (id: string, upgradeId: string, sessionToken?: string) =>
    http<{ player: PlayerState; unlocked: string }>(
      `/player/${id}/ward-defense/aegis-sidegrade`,
      { method: 'POST', body: JSON.stringify({ upgrade_id: upgradeId }), headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  completeJourneyChapterBoss: (id: string, runId: string, tileId: string, sessionToken?: string) =>
    http<{ already_completed: boolean; player?: PlayerState; run: unknown; granted: Record<string, number> }>(
      `/player/${id}/journey-runs/${runId}/chapter-boss-completion`,
      {
        method: 'POST',
        body: JSON.stringify({ tile_id: tileId }),
        headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
      },
    ),
  completeJourneyAreaBoss: (id: string, runId: string, chapterId: number, tileId: string, sessionToken?: string) =>
    http<{ already_completed: boolean; run: unknown; chapter_key_state: { keys_collected?: number; claimed_tile_ids?: string[] } }>(
      `/player/${id}/journey-runs/${runId}/area-boss-completion`,
      {
        method: 'POST',
        body: JSON.stringify({ chapter_id: chapterId, tile_id: tileId }),
        headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
      },
    ),
  selectClass: (id: string, classId: string, sessionToken?: string) =>
    http<PlayerState>(`/player/${id}/select-class`, {
      method: 'POST',
      body: JSON.stringify({ class_id: classId }),
      headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
    }),
  claimClassTier: (id: string, level: 1 | 10 | 20 | 30, sessionToken?: string) =>
    http<PlayerState>(`/player/${id}/class-tiers`, {
      method: 'POST',
      body: JSON.stringify({ level }),
      headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
    }),
  purchaseJourneyMerchant: (id: string, runId: string, tileId: string, stockId: string, sessionToken?: string) =>
    http<{ player: PlayerState; run: unknown }>(
      `/player/${id}/journey-runs/${runId}/merchant-purchase`,
      {
        method: 'POST',
        body: JSON.stringify({ tile_id: tileId, stock_id: stockId }),
        headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
      },
    ),
  completeVerdantha: (id: string, sessionToken?: string) =>
    http<{ already_completed: boolean; player: PlayerState; granted: Record<string, number> }>(
      `/player/${id}/world-event/verdantha/completion`,
      { method: 'POST', headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
};
