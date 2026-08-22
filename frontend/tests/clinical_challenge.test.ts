import {
  ClinicalChallenge,
  EMPTY_CLINICAL_PRACTICE_PROFILE,
  chooseFreshChallenge,
  evaluateClinicalChallenge,
  recommendClinicalDifficulty,
} from '../src/game/clinicalChallenge';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const base: ClinicalChallenge = {
  id: 'test-priority', version: 1, variantFamilyId: 'priority-family', status: 'approved',
  activity: 'triage', difficulty: 'standard', interaction: 'priority',
  title: 'Test', context: 'Context', prompt: 'Prompt',
  options: [{ id: 'stable', text: 'Stable' }, { id: 'urgent', text: 'Urgent' }],
  correctIds: ['urgent'], priorityOrder: ['urgent'], rationale: 'Rationale',
  keyLearning: 'Learning', nextStepGuidance: 'Continue', topicTags: ['priority-care'],
  masteryTags: ['judgment'], safety: {},
};

const perfect = evaluateClinicalChallenge(base, { rankedIds: ['urgent'] });
assert(perfect.verdict === 'correct' && perfect.score === 100, 'priority choice should score deterministically');

const sequence: ClinicalChallenge = {
  ...base, id: 'test-sequence', interaction: 'sequence',
  options: [{ id: 'call', text: 'Call' }, { id: 'assess', text: 'Assess' }, { id: 'routine', text: 'Routine', unsafe: true }],
  requiredIds: ['call', 'assess'],
  relationships: [{ beforeId: 'call', afterId: 'assess', required: true }],
  safety: { unsafeCap: 0.35 },
};
const partial = evaluateClinicalChallenge(sequence, { sequenceIds: ['call'] });
assert(partial.verdict === 'partially_correct', 'missing a required sequence step should receive partial credit');
const unsafe = evaluateClinicalChallenge(sequence, { sequenceIds: ['routine', 'call', 'assess'] });
assert(unsafe.verdict === 'unsafe' && unsafe.score <= 35, 'unsafe actions must cap the score');

const fresh = chooseFreshChallenge([base, { ...base, id: 'test-priority-v2' }], {
  ...EMPTY_CLINICAL_PRACTICE_PROFILE,
  history: [{ challengeId: base.id, challengeVersion: 1, variantFamilyId: base.variantFamilyId, activity: 'triage', difficulty: 'standard', score: 100, safety: 'safe', topicTags: [], masteryTags: [], completedAt: '2026-01-01T00:00:00Z' }],
});
assert(fresh?.id === 'test-priority-v2', 'exact variants should be suppressed before a fresh presentation');
assert(recommendClinicalDifficulty({ ...EMPTY_CLINICAL_PRACTICE_PROFILE, history: Array.from({ length: 3 }, () => ({ challengeId: 'x', challengeVersion: 1, variantFamilyId: 'x', activity: 'cue_lab' as const, difficulty: 'advanced' as const, score: 95, safety: 'safe' as const, topicTags: [], masteryTags: [], completedAt: '2026-01-01T00:00:00Z' })) }) === 'expert', 'strong safe recent performance should recommend Expert');

console.log('clinical_challenge: deterministic scoring, safety cap, freshness, and recommendation passed');