import Constants from 'expo-constants';
import { PlayerState } from '@/src/game/types';

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
    activity: 'cue_lab' | 'triage' | 'stack',
    difficulty: 'beginner' | 'standard' | 'advanced',
    sessionToken?: string,
  ) => http<{ player: PlayerState; multiplier: number; granted: Record<string, number> }>(
    `/player/${id}/university-practice/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ activity, difficulty }),
      headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
    },
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
