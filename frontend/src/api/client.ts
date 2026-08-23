import Constants from 'expo-constants';
import { PlayerState } from '@/src/game/types';
import type { PlayerHeroEligibility, PlayerHeroRecord, PlayerHeroAppearance } from '@/src/game/playerHero';
import type {
  SimulationConfig, SimulationDebrief, SimulationManifest, SimulationAttemptState, SimulationRetryMode,
} from '@/src/game/clinicalSimulation';
import type {
  GrandRoundsAttempt, GrandRoundsCaseCard, GrandRoundsDebrief, GrandRoundsGate,
} from '@/src/game/grandRounds';
import type {
  FacultyCredential, FacultyCredentialBoard, FacultyGrandRoundsBoard, FacultyGrandRoundsDraft, FacultyGrandRoundsRole,
} from '@/src/game/facultyGrandRounds';
import type {
  CrisisDrillAttempt, CrisisDrillCaseCard, CrisisDrillDebrief, CrisisDrillGate, CrisisDrillDifficulty,
} from '@/src/game/crisisDrill';

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
  settleLegacyDailyRounds: (id: string, legacySnapshot: unknown, economyToken?: string) =>
    http<{ player: PlayerState; settled: boolean; entitlement_ids: string[] }>(
      `/player/${id}/daily-rounds/legacy-settlement`,
      {
        method: 'POST',
        body: JSON.stringify({ legacy_snapshot: legacySnapshot }),
        headers: economyToken ? { 'X-Clinica-Session': economyToken, 'X-Clinica-Economy-Token': economyToken } : {},
      },
    ),
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
    retryMode: SimulationRetryMode = 'new_variation',
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
  getGrandRounds: (id: string, sessionToken?: string) =>
    http<{ cases: GrandRoundsCaseCard[]; gate: GrandRoundsGate; recommended_id?: string }>(
      `/player/${id}/grand-rounds`,
      { headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  beginGrandRounds: (
    id: string,
    caseId: string,
    caseVersion: number,
    retryMode: 'same_case' | 'fresh_case' | 'guided' = 'fresh_case',
    priorAttemptId?: string,
    sessionToken?: string,
  ) => http<{ attempt: GrandRoundsAttempt }>(
    `/player/${id}/grand-rounds/attempts`,
    {
      method: 'POST',
      body: JSON.stringify({ case_id: caseId, case_version: caseVersion, retry_mode: retryMode, prior_attempt_id: priorAttemptId }),
      headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
    },
  ),
  getGrandRoundsAttempt: (id: string, attemptId: string, sessionToken?: string) =>
    http<{ attempt: GrandRoundsAttempt }>(
      `/player/${id}/grand-rounds/attempts/${attemptId}`,
      { headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  submitGrandRoundsResponse: (id: string, attemptId: string, responseId: string, sessionToken?: string) =>
    http<{ attempt: GrandRoundsAttempt }>(
      `/player/${id}/grand-rounds/attempts/${attemptId}/responses`,
      {
        method: 'POST',
        body: JSON.stringify({ response_id: responseId }),
        headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
      },
    ),
  pauseGrandRounds: (id: string, attemptId: string, sessionToken?: string) =>
    http<{ attempt: GrandRoundsAttempt }>(
      `/player/${id}/grand-rounds/attempts/${attemptId}/pause`,
      { method: 'POST', headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  resumeGrandRounds: (id: string, attemptId: string, sessionToken?: string) =>
    http<{ attempt: GrandRoundsAttempt }>(
      `/player/${id}/grand-rounds/attempts/${attemptId}/resume`,
      { method: 'POST', headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  abandonGrandRounds: (id: string, attemptId: string, sessionToken?: string) =>
    http<{ player: PlayerState }>(
      `/player/${id}/grand-rounds/attempts/${attemptId}/abandon`,
      { method: 'POST', headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  saveGrandRoundsNotes: (id: string, attemptId: string, notes: string, sessionToken?: string) =>
    http<{ attempt: GrandRoundsAttempt }>(
      `/player/${id}/grand-rounds/attempts/${attemptId}/notes`,
      {
        method: 'PUT',
        body: JSON.stringify({ notes }),
        headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
      },
    ),
  completeGrandRounds: (id: string, attemptId: string, sessionToken?: string) =>
    http<{ player: PlayerState; debrief: GrandRoundsDebrief; already_completed: boolean }>(
      `/player/${id}/grand-rounds/attempts/${attemptId}/complete`,
      { method: 'POST', headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  getFacultyGrandRounds: (facultyKey: string) =>
    http<FacultyGrandRoundsBoard>('/faculty/grand-rounds/cases', { headers: { 'X-Clinica-Faculty-Key': facultyKey } }),
  createFacultyGrandRoundsDraft: (facultyKey: string, caseId: string, manifest: Record<string, unknown>) =>
    http<{ draft: FacultyGrandRoundsDraft }>('/faculty/grand-rounds/cases/drafts', {
      method: 'POST', body: JSON.stringify({ case_id: caseId, manifest }), headers: { 'X-Clinica-Faculty-Key': facultyKey },
    }),
  updateFacultyGrandRoundsDraft: (facultyKey: string, draftId: string, expectedRevision: number, manifest: Record<string, unknown>) =>
    http<{ draft: FacultyGrandRoundsDraft }>(`/faculty/grand-rounds/cases/drafts/${draftId}`, {
      method: 'PUT', body: JSON.stringify({ expected_revision: expectedRevision, manifest }), headers: { 'X-Clinica-Faculty-Key': facultyKey },
    }),
  submitFacultyGrandRoundsReview: (facultyKey: string, draftId: string, expectedRevision: number) =>
    http<{ draft: FacultyGrandRoundsDraft }>(`/faculty/grand-rounds/cases/drafts/${draftId}/submit-review`, {
      method: 'POST', body: JSON.stringify({ expected_revision: expectedRevision }), headers: { 'X-Clinica-Faculty-Key': facultyKey },
    }),
  reviewFacultyGrandRoundsDraft: (
    facultyKey: string, draftId: string, expectedRevision: number,
    decision: 'approve_for_publish' | 'changes_requested', notes: string,
  ) => http<{ draft: FacultyGrandRoundsDraft }>(`/faculty/grand-rounds/cases/drafts/${draftId}/review`, {
    method: 'POST', body: JSON.stringify({ expected_revision: expectedRevision, decision, notes }), headers: { 'X-Clinica-Faculty-Key': facultyKey },
  }),
  approveFacultyGrandRoundsDraft: (facultyKey: string, draftId: string, expectedRevision: number) =>
    http<{ draft: FacultyGrandRoundsDraft; published: { caseId: string; version: number } }>(`/faculty/grand-rounds/cases/drafts/${draftId}/approve`, {
      method: 'POST', body: JSON.stringify({ expected_revision: expectedRevision }), headers: { 'X-Clinica-Faculty-Key': facultyKey },
    }),
  retireFacultyGrandRoundsCase: (facultyKey: string, caseId: string, reason: string) =>
    http<{ caseId: string; status: 'retired' }>(`/faculty/grand-rounds/cases/${caseId}/retire`, {
      method: 'POST', body: JSON.stringify({ reason }), headers: { 'X-Clinica-Faculty-Key': facultyKey },
    }),
  getFacultyCredentials: (adminKey: string) =>
    http<FacultyCredentialBoard>('/faculty/admin/credentials', {
      headers: { 'X-Clinica-Curriculum-Admin-Key': adminKey },
    }),
  issueFacultyCredential: (adminKey: string, facultyId: string, role: FacultyGrandRoundsRole) =>
    http<{ credential: FacultyCredential; oneTimeCredential: string }>('/faculty/admin/credentials', {
      method: 'POST',
      body: JSON.stringify({ faculty_id: facultyId, role }),
      headers: { 'X-Clinica-Curriculum-Admin-Key': adminKey },
    }),
  rotateFacultyCredential: (
    adminKey: string, credentialId: string, role: FacultyGrandRoundsRole, reason: string,
  ) => http<{ credential: FacultyCredential; oneTimeCredential: string }>(
    `/faculty/admin/credentials/${credentialId}/rotate`,
    {
      method: 'POST',
      body: JSON.stringify({ role, reason }),
      headers: { 'X-Clinica-Curriculum-Admin-Key': adminKey },
    },
  ),
  revokeFacultyCredential: (adminKey: string, credentialId: string, reason: string) =>
    http<{ credential: FacultyCredential; alreadyRevoked: boolean }>(
      `/faculty/admin/credentials/${credentialId}/revoke`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
        headers: { 'X-Clinica-Curriculum-Admin-Key': adminKey },
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
  recordActivityCompletion: (
    id: string,
    activityId: 'university-practice' | 'clinical-simulation' | 'grand-rounds' | 'crisis-drill',
    attemptId: string,
    sessionToken?: string,
  ) => http<{ accepted: boolean; duplicate: boolean; receipt: { activityId: string; completionKey: string; dailyEligible: boolean } }>(
    `/player/${id}/activity-completions`,
    {
      method: 'POST',
      body: JSON.stringify({ activity_id: activityId, completion_key: attemptId }),
      headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
    },
  ),
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
  getCrisisDrills: (id: string, sessionToken?: string) =>
    http<{ cases: CrisisDrillCaseCard[]; gate: CrisisDrillGate }>(
      `/player/${id}/crisis-drills`,
      { headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  beginCrisisDrill: (
    id: string,
    caseId: string,
    caseVersion: number,
    mode: CrisisDrillDifficulty = 'training',
    retryMode: 'fresh_case' | 'same_case' | 'guided' = 'fresh_case',
    priorAttemptId?: string,
    sessionToken?: string,
  ) => http<{ attempt: CrisisDrillAttempt }>(
    `/player/${id}/crisis-drills/attempts`,
    {
      method: 'POST',
      body: JSON.stringify({ drill_id: caseId, drill_version: caseVersion, mode, retry_mode: retryMode, prior_attempt_id: priorAttemptId }),
      headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
    },
  ),
  getCrisisDrillAttempt: (id: string, attemptId: string, sessionToken?: string) =>
    http<{ attempt: CrisisDrillAttempt }>(
      `/player/${id}/crisis-drills/attempts/${attemptId}`,
      { headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  submitCrisisDrillResponse: (id: string, attemptId: string, responseId: string, sessionToken?: string) =>
    http<{ attempt: CrisisDrillAttempt }>(
      `/player/${id}/crisis-drills/attempts/${attemptId}/action`,
      {
        method: 'POST',
        body: JSON.stringify({ response_id: responseId }),
        headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {},
      },
    ),
  pauseCrisisDrill: (id: string, attemptId: string, sessionToken?: string) =>
    http<{ attempt: CrisisDrillAttempt }>(
      `/player/${id}/crisis-drills/attempts/${attemptId}/pause`,
      { method: 'POST', headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  resumeCrisisDrill: (id: string, attemptId: string, sessionToken?: string) =>
    http<{ attempt: CrisisDrillAttempt }>(
      `/player/${id}/crisis-drills/attempts/${attemptId}/resume`,
      { method: 'POST', headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  abandonCrisisDrill: (id: string, attemptId: string, sessionToken?: string) =>
    http<{ player: PlayerState }>(
      `/player/${id}/crisis-drills/attempts/${attemptId}/abandon`,
      { method: 'POST', headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
  completeCrisisDrill: (id: string, attemptId: string, sessionToken?: string) =>
    http<{ player: PlayerState; debrief: CrisisDrillDebrief; already_completed: boolean }>(
      `/player/${id}/crisis-drills/attempts/${attemptId}/complete`,
      { method: 'POST', headers: sessionToken ? { 'X-Clinica-Session': sessionToken } : {} },
    ),
};
