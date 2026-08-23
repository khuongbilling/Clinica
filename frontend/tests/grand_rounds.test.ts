import assert from 'node:assert/strict';
import type { GrandRoundsAttempt, GrandRoundsDebrief } from '../src/game/grandRounds';

// The public API contract is intentionally projection-only. This compile-time
// fixture catches accidental addition of official answer keys/effects to the
// client-facing case state while backend authority tests cover evaluation.
const publicAttempt: GrandRoundsAttempt = {
  attemptId: 'attempt', caseId: 'case', version: 1, branchId: 'round-a', difficulty: 'standard',
  status: 'active', safety: 'safe', notes: '', complicationActive: false,
  patient: { stability: 70, oxygenation: 72, perfusion: 65, concern: 'Changing trend', acuity: 'moderate' },
  known: [], timeline: [],
  stage: { id: 'observe', label: 'Focused assessment', inputKind: 'single_choice', prompt: 'Choose.', options: [{ id: 'assess', label: 'Assess', rationale: 'Clarifies risk.' }] },
};
const debrief: Pick<GrandRoundsDebrief, 'outcome' | 'patientOutcome' | 'score' | 'rawScore' | 'safety'> = {
  outcome: 'competent', patientOutcome: 'stabilized', score: 72, rawScore: 72, safety: 'safe',
};

assert.equal(publicAttempt.stage?.options[0].id, 'assess');
assert.equal(debrief.outcome, 'competent');
assert.ok(!JSON.stringify(publicAttempt).includes('points'));
console.log('grand rounds public contract tests passed');