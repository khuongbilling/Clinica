/**
 * Shared, UI-independent clinical challenge contract.
 *
 * This module deliberately knows nothing about routes, rewards, Stamina, combat,
 * or React. Practice modes adapt authored content into these contracts, then use
 * the deterministic evaluator below.
 */

export type ClinicalDifficulty = 'introductory' | 'standard' | 'advanced' | 'expert';
export type ChallengeInteraction = 'single_choice' | 'priority' | 'sequence' | 'multi_step_case';
export type ChallengeStatus = 'draft' | 'clinical_review' | 'approved' | 'deprecated';
export type ClinicalVerdict = 'correct' | 'partially_correct' | 'review' | 'unsafe';
export type SafetyResult = 'safe' | 'needs_review' | 'unsafe';
export type MasteryDomain = 'assessment' | 'stabilization' | 'pharmacology' | 'judgment' | 'command' | 'systems';

export interface ClinicalOption {
  id: string;
  text: string;
  /** 0–1 authored credit. The evaluator never relies on array order. */
  credit?: number;
  unsafe?: boolean;
  distractorExplanation?: string;
}

export interface SequenceRelationship {
  beforeId: string;
  afterId: string;
  required?: boolean;
  rationale?: string;
}

export interface ClinicalChallenge {
  id: string;
  version: number;
  variantFamilyId: string;
  status: ChallengeStatus;
  activity: 'cue_lab' | 'triage' | 'stack';
  difficulty: ClinicalDifficulty;
  interaction: ChallengeInteraction;
  title: string;
  context: string;
  prompt: string;
  options: ClinicalOption[];
  /** Correct ids for single choice / acceptable first priorities. */
  correctIds?: string[];
  /** Full ranked order where known. The first id is always the primary priority. */
  priorityOrder?: string[];
  /** Flexible dependency rules for an ordered response. */
  relationships?: SequenceRelationship[];
  requiredIds?: string[];
  rationale: string;
  keyLearning: string;
  nextStepGuidance: string;
  topicTags: string[];
  masteryTags: MasteryDomain[];
  safety: { unsafeCap?: number; unsafeOptionIds?: string[] };
}

export interface ClinicalResponse {
  selectedIds?: string[];
  rankedIds?: string[];
  sequenceIds?: string[];
  steps?: Record<string, ClinicalResponse>;
}

export interface ClinicalEvaluation {
  verdict: ClinicalVerdict;
  score: number;
  rawScore: number;
  safety: SafetyResult;
  rationale: string;
  keyLearning: string;
  nextStepGuidance: string;
  distractorExplanation?: string;
  correctIds: string[];
  violatedRelationships: SequenceRelationship[];
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function selectedFor(challenge: ClinicalChallenge, response: ClinicalResponse): string[] {
  if (challenge.interaction === 'priority') return response.rankedIds ?? response.selectedIds ?? [];
  if (challenge.interaction === 'sequence') return response.sequenceIds ?? [];
  return response.selectedIds ?? [];
}

/** Stable pure scorer for current labs and future adapters. */
export function evaluateClinicalChallenge(challenge: ClinicalChallenge, response: ClinicalResponse): ClinicalEvaluation {
  const selected = selectedFor(challenge, response);
  const optionById = new Map(challenge.options.map((option) => [option.id, option]));
  const unsafeIds = new Set([...(challenge.safety.unsafeOptionIds ?? []), ...challenge.options.filter((o) => o.unsafe).map((o) => o.id)]);
  const chosenUnsafe = selected.filter((id) => unsafeIds.has(id));
  const correctIds = challenge.correctIds ?? challenge.priorityOrder?.slice(0, 1) ?? challenge.requiredIds ?? [];
  let rawScore = 0;
  let violatedRelationships: SequenceRelationship[] = [];

  if (challenge.interaction === 'single_choice') {
    const credits = selected.map((id) => optionById.get(id)?.credit ?? (correctIds.includes(id) ? 1 : 0));
    rawScore = credits.length ? Math.max(...credits) : 0;
  } else if (challenge.interaction === 'priority') {
    const primary = challenge.priorityOrder?.[0] ?? correctIds[0];
    if (selected[0] === primary) rawScore = 1;
    else if (selected.includes(primary)) rawScore = 0.55;
    else rawScore = 0;
  } else if (challenge.interaction === 'sequence') {
    const required = challenge.requiredIds ?? challenge.options.filter((o) => !o.unsafe).map((o) => o.id);
    const allPresent = required.every((id) => selected.includes(id));
    const relationships = challenge.relationships ?? [];
    const satisfied = relationships.filter((rule) => {
      const before = selected.indexOf(rule.beforeId);
      const after = selected.indexOf(rule.afterId);
      return before >= 0 && after >= 0 && before < after;
    });
    violatedRelationships = relationships.filter((rule) => rule.required !== false && !satisfied.includes(rule));
    // A missing later step is incomplete evidence, not proof the learner chose
    // the wrong relationship. Grade authored relationships only once both ends
    // are present so a safe partial chain earns meaningful partial credit.
    const applicableRelationships = relationships.filter((rule) => selected.includes(rule.beforeId) && selected.includes(rule.afterId));
    const relationshipScore = applicableRelationships.length ? satisfied.length / applicableRelationships.length : 1;
    const completeness = required.length ? required.filter((id) => selected.includes(id)).length / required.length : 1;
    rawScore = clamp((relationshipScore * 0.5) + (completeness * 0.5));
    if (!allPresent) rawScore = Math.min(rawScore, 0.74);
  } else {
    const stepResults = Object.values(response.steps ?? {}).map((step) => evaluateClinicalChallenge(
      { ...challenge, interaction: 'single_choice', correctIds, options: challenge.options },
      step,
    ));
    rawScore = stepResults.length ? stepResults.reduce((sum, result) => sum + result.score, 0) / stepResults.length : 0;
  }

  let safety: SafetyResult = chosenUnsafe.length ? 'unsafe' : rawScore < 0.5 ? 'needs_review' : 'safe';
  const unsafeCap = challenge.safety.unsafeCap ?? 0.35;
  const score = chosenUnsafe.length ? Math.min(rawScore, unsafeCap) : rawScore;
  const verdict: ClinicalVerdict = safety === 'unsafe'
    ? 'unsafe'
    : score >= 0.999
      ? 'correct'
      : score >= 0.5
        ? 'partially_correct'
        : 'review';
  const firstWrong = selected.map((id) => optionById.get(id)).find((option) => option && !correctIds.includes(option.id) && option.distractorExplanation);

  return {
    verdict,
    score: Math.round(score * 100),
    rawScore: Math.round(rawScore * 100),
    safety,
    rationale: challenge.rationale,
    keyLearning: challenge.keyLearning,
    nextStepGuidance: challenge.nextStepGuidance,
    distractorExplanation: firstWrong?.distractorExplanation,
    correctIds,
    violatedRelationships,
  };
}

export interface ClinicalPracticeAttemptRecord {
  challengeId: string;
  challengeVersion: number;
  variantFamilyId: string;
  activity: ClinicalChallenge['activity'];
  difficulty: ClinicalDifficulty;
  score: number;
  safety: SafetyResult;
  topicTags: string[];
  masteryTags: MasteryDomain[];
  completedAt: string;
}

export interface ClinicalPracticeProfile {
  history: ClinicalPracticeAttemptRecord[];
  mastery: { domains: Partial<Record<MasteryDomain, number>>; topics: Record<string, number> };
  personalBest: Record<string, number>;
  safetyStreak: number;
}

export const EMPTY_CLINICAL_PRACTICE_PROFILE: ClinicalPracticeProfile = {
  history: [],
  mastery: { domains: {}, topics: {} },
  personalBest: {},
  safetyStreak: 0,
};

/** Exact variants are suppressed strongly; family variety and weaker topics win ties. */
export function chooseFreshChallenge<T extends ClinicalChallenge>(
  candidates: readonly T[],
  profile: ClinicalPracticeProfile | undefined,
  excludeId?: string,
): T | null {
  const history = profile?.history ?? [];
  const recent = history.slice(-24);
  const scored = candidates.filter((challenge) => challenge.status === 'approved' && challenge.id !== excludeId).map((challenge) => {
    const exactSeen = recent.filter((record) => record.challengeId === challenge.id).length;
    const familySeen = recent.filter((record) => record.variantFamilyId === challenge.variantFamilyId).length;
    const topicStrength = challenge.topicTags.reduce((total, tag) => total + (profile?.mastery.topics[tag] ?? 0), 0) / Math.max(1, challenge.topicTags.length);
    return { challenge, value: (exactSeen * 100) + (familySeen * 15) + topicStrength };
  }).sort((a, b) => a.value - b.value);
  return scored[0]?.challenge ?? null;
}

/** Recommendation never locks manual selection and has no reward multiplier. */
export function recommendClinicalDifficulty(profile: ClinicalPracticeProfile | undefined): ClinicalDifficulty {
  const recent = (profile?.history ?? []).slice(-8);
  if (recent.length < 3) return 'introductory';
  const average = recent.reduce((sum, record) => sum + record.score, 0) / recent.length;
  const unsafe = recent.filter((record) => record.safety === 'unsafe').length;
  if (unsafe > 0 || average < 55) return 'introductory';
  if (average < 78) return 'standard';
  if (average < 92) return 'advanced';
  return 'expert';
}