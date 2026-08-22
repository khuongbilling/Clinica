/**
 * Clinical Simulation Lab — Package 2
 *
 * This is the shared, UI-independent contract for authored simulations.
 * Patient state is private to the reducer; known information is the subset
 * explicitly revealed by an authored action. No wall-clock value participates
 * in scoring, progression, or branch selection.
 */

export type SimulationDifficulty = 'introductory' | 'standard' | 'advanced' | 'expert';
export type SimulationStyle = 'guided' | 'focused' | 'transfer';
export type SimulationDomain = 'airway' | 'assessment' | 'stabilization' | 'pharmacology' | 'judgment' | 'systems';
export type SimulationBeat =
  | 'handoff' | 'assess' | 'reveal' | 'prioritize' | 'intervene'
  | 'reassess' | 'complication' | 'adaptation' | 'outcome';
export type SimulationActionGroup = 'assess' | 'support' | 'treat' | 'escalate' | 'reassess';
export type SimulationRetryMode = 'same_branch' | 'new_variation' | 'similar_case' | 'guided';
export type SimulationOutcome = 'stabilized' | 'partially_stabilized' | 'unsafe' | 'missed';
export type SimulationSafety = 'safe' | 'needs_review' | 'unsafe';

/** Shared discovery gate; kept explicit so Age 1 tuning is not buried in UI. */
export const CLINICAL_SIMULATION_ADVANCED_LEVEL_GATE = 25;

export interface PatientState {
  stability: number;
  oxygenation: number;
  perfusion: number;
  concern: string;
  acuity: 'low' | 'moderate' | 'high' | 'critical';
  hiddenFindings: string[];
  complications: string[];
  interventionCount: number;
}

export interface KnownInformation {
  id: string;
  label: string;
  value: string;
  discoveredAt: SimulationBeat;
}

export interface SimulationObjective {
  id: string;
  label: string;
  weight: number;
  required?: boolean;
}

export interface SimulationEffect {
  stability?: number;
  oxygenation?: number;
  perfusion?: number;
  reveal?: string[];
  objectiveIds?: string[];
  complicationId?: string;
  safety?: SimulationSafety;
  announcement: string;
}

export interface SimulationAction {
  id: string;
  label: string;
  group: SimulationActionGroup;
  beats: SimulationBeat[];
  effects: SimulationEffect;
  unsafe?: boolean;
  rationale: string;
}

export interface SimulationComplication {
  id: string;
  label: string;
  eligibleDifficulties: SimulationDifficulty[];
  triggerAfterActionIds: string[];
  preventionActionIds: string[];
  outcomeActionIds: string[];
  rationale: string;
  announcement: string;
}

export interface SimulationManifest {
  id: string;
  version: number;
  variantFamilyId: string;
  title: string;
  subtitle: string;
  domain: SimulationDomain;
  difficulty: SimulationDifficulty;
  style: SimulationStyle;
  reviewed: boolean;
  patientName: string;
  patientAge: number;
  handoff: string;
  initialState: PatientState;
  knownInformation: KnownInformation[];
  objectives: SimulationObjective[];
  actions: SimulationAction[];
  complications: SimulationComplication[];
  clinicalPrinciple: string;
  relatedPractice: string[];
  estimatedMinutes: number;
}

export interface SimulationConfig {
  difficulty: SimulationDifficulty;
  style: SimulationStyle;
  complicationId?: string;
  assistance: 'none' | 'coach' | 'guided';
}

export interface SimulationTimelineEntry {
  actionId: string;
  beat: SimulationBeat;
  announcement: string;
  stateDelta: string;
  knownIds: string[];
}

export interface SimulationAttemptState {
  attemptId: string;
  simulationId: string;
  version: number;
  seed: number;
  branchId: string;
  config: SimulationConfig;
  beat: SimulationBeat;
  patient: PatientState;
  known: KnownInformation[];
  completedObjectiveIds: string[];
  actionIds: string[];
  timeline: SimulationTimelineEntry[];
  safety: SimulationSafety;
  status: 'active' | 'completed';
  complicationTriggered: boolean;
}

export interface SimulationDebrief {
  outcome: SimulationOutcome;
  rating: 'excellent' | 'strong' | 'developing' | 'unsafe';
  score: number;
  safety: SimulationSafety;
  domainBreakdown: Record<SimulationDomain, number>;
  strongDecisions: string[];
  missedOpportunities: string[];
  clinicalPrinciple: string;
  relatedPractice: string[];
  timeline: SimulationTimelineEntry[];
  firstClear: boolean;
  achievements: string[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const beatOrder: SimulationBeat[] = [
  'handoff', 'assess', 'reveal', 'prioritize', 'intervene',
  'reassess', 'complication', 'adaptation', 'outcome',
];

export function seededBranch(seed: number, variantFamilyId: string): string {
  let hash = seed >>> 0;
  for (const char of variantFamilyId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `branch-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function nextBeat(state: SimulationAttemptState, manifest: SimulationManifest): SimulationBeat {
  const has = (group: SimulationActionGroup) => state.actionIds.some((id) => manifest.actions.find((a) => a.id === id)?.group === group);
  if (!has('assess')) return 'assess';
  if (manifest.actions.some((a) => a.effects.reveal?.length) && !state.known.length) return 'reveal';
  if (!has('escalate') && !has('support') && !has('treat')) return 'prioritize';
  if (!has('support') && !has('treat') && !has('escalate')) return 'intervene';
  if (!has('reassess')) return 'reassess';
  if (state.complicationTriggered && !has('escalate')) return 'adaptation';
  return 'outcome';
}

export function createSimulationAttempt(
  manifest: SimulationManifest,
  attemptId: string,
  config: SimulationConfig,
  seed: number,
): SimulationAttemptState {
  const allowedComplication = !config.complicationId || manifest.complications.some((c) => c.id === config.complicationId);
  if (!allowedComplication) throw new Error('Unknown complication');
  if (config.difficulty !== manifest.difficulty && !['introductory', 'standard'].includes(config.difficulty)) {
    throw new Error('Difficulty is fixed by the reviewed manifest');
  }
  return {
    attemptId, simulationId: manifest.id, version: manifest.version, seed,
    branchId: seededBranch(seed, manifest.variantFamilyId), config,
    beat: 'handoff', patient: { ...manifest.initialState, hiddenFindings: [...manifest.initialState.hiddenFindings], complications: [] },
    known: [], completedObjectiveIds: [], actionIds: [], timeline: [],
    safety: 'safe', status: 'active', complicationTriggered: false,
  };
}

function stateDelta(before: PatientState, after: PatientState): string {
  const changes: string[] = [];
  if (before.stability !== after.stability) changes.push(`stability ${after.stability > before.stability ? '+' : ''}${after.stability - before.stability}`);
  if (before.oxygenation !== after.oxygenation) changes.push(`oxygenation ${after.oxygenation > before.oxygenation ? '+' : ''}${after.oxygenation - before.oxygenation}`);
  if (before.perfusion !== after.perfusion) changes.push(`perfusion ${after.perfusion > before.perfusion ? '+' : ''}${after.perfusion - before.perfusion}`);
  return changes.length ? changes.join(' · ') : 'no measurable vital change';
}

export function applySimulationAction(
  state: SimulationAttemptState,
  manifest: SimulationManifest,
  actionId: string,
): SimulationAttemptState {
  if (state.status !== 'active') throw new Error('Attempt is already complete');
  const action = manifest.actions.find((candidate) => candidate.id === actionId);
  if (!action) throw new Error('Unknown action');
  if (!action.beats.includes(state.beat)) throw new Error(`Action is not legal during ${state.beat}`);
  if (state.actionIds.includes(actionId)) throw new Error('Action already submitted');
  const before = state.patient;
  const effect = action.effects;
  const patient: PatientState = {
    ...before,
    stability: clamp(before.stability + (effect.stability ?? 0)),
    oxygenation: clamp(before.oxygenation + (effect.oxygenation ?? 0)),
    perfusion: clamp(before.perfusion + (effect.perfusion ?? 0)),
    interventionCount: before.interventionCount + (action.group === 'assess' || action.group === 'reassess' ? 0 : 1),
    hiddenFindings: [...before.hiddenFindings],
    complications: [...before.complications],
  };
  const revealed = (effect.reveal ?? []).filter((id) => patient.hiddenFindings.includes(id));
  const known = [...state.known, ...manifest.knownInformation.filter((item) => revealed.includes(item.id) && !state.known.some((k) => k.id === item.id))];
  patient.hiddenFindings = patient.hiddenFindings.filter((id) => !revealed.includes(id));
  const completedObjectiveIds = [...new Set([
    ...state.completedObjectiveIds,
    ...(effect.objectiveIds ?? []),
  ])];
  const complication = manifest.complications.find((candidate) => candidate.id === state.config.complicationId);
  const triggered = !!complication && !state.complicationTriggered &&
    complication.triggerAfterActionIds.includes(actionId) &&
    !complication.preventionActionIds.some((id) => state.actionIds.includes(id) || id === actionId);
  if (triggered && complication) {
    patient.complications.push(complication.id);
    patient.acuity = 'high';
  }
  const safety: SimulationSafety = action.unsafe || effect.safety === 'unsafe'
    ? 'unsafe' : effect.safety === 'needs_review' ? 'needs_review' : state.safety;
  const next: SimulationAttemptState = {
    ...state, patient, known, completedObjectiveIds,
    actionIds: [...state.actionIds, actionId],
    timeline: [...state.timeline, {
      actionId, beat: state.beat, announcement: effect.announcement,
      stateDelta: stateDelta(before, patient), knownIds: revealed,
    }],
    safety, complicationTriggered: state.complicationTriggered || triggered,
    beat: state.beat === 'handoff' ? 'assess' : nextBeat({ ...state, patient, known, actionIds: [...state.actionIds, actionId], complicationTriggered: state.complicationTriggered || triggered }, manifest),
  };
  if (next.beat === 'outcome') next.status = 'completed';
  return next;
}

export function evaluateSimulation(manifest: SimulationManifest, state: SimulationAttemptState): SimulationDebrief {
  const required = manifest.objectives.filter((o) => o.required !== false);
  const objectiveScore = required.length
    ? required.filter((o) => state.completedObjectiveIds.includes(o.id)).reduce((sum, o) => sum + o.weight, 0) /
      required.reduce((sum, o) => sum + o.weight, 0)
    : 1;
  const vitals = (state.patient.stability + state.patient.oxygenation + state.patient.perfusion) / 3;
  const score = clamp(objectiveScore * 60 + vitals * 0.4 - (state.patient.complications.length * 15));
  const unsafe = state.safety === 'unsafe' || state.patient.stability < 35;
  const outcome: SimulationOutcome = unsafe ? 'unsafe' : score >= 82 ? 'stabilized' : score >= 55 ? 'partially_stabilized' : 'missed';
  const rating = unsafe ? 'unsafe' : score >= 90 ? 'excellent' : score >= 72 ? 'strong' : 'developing';
  const missedOpportunities = manifest.objectives.filter((o) => !state.completedObjectiveIds.includes(o.id)).map((o) => o.label);
  const strongDecisions = state.timeline.filter((entry) => !entry.stateDelta.includes('no measurable')).map((entry) => entry.announcement);
  const domainBreakdown = Object.fromEntries(
    (['airway', 'assessment', 'stabilization', 'pharmacology', 'judgment', 'systems'] as SimulationDomain[])
      .map((domain) => [domain, domain === manifest.domain ? score : clamp(score - 8)]),
  ) as Record<SimulationDomain, number>;
  const achievements = [
    state.timeline.some((e) => e.actionId.includes('stabilize') || e.actionId.includes('support')) ? 'first_stabilization' : '',
    state.timeline.some((e) => e.beat === 'reassess') ? 'reassessment_matters' : '',
    state.safety === 'safe' && outcome === 'stabilized' ? 'safe_hands' : '',
    state.complicationTriggered && outcome === 'stabilized' ? 'adaptive_thinker' : '',
    outcome === 'stabilized' ? 'clinical_simulator' : '',
  ].filter(Boolean);
  return {
    outcome, rating, score, safety: state.safety, domainBreakdown, strongDecisions,
    missedOpportunities, clinicalPrinciple: manifest.clinicalPrinciple,
    relatedPractice: manifest.relatedPractice, timeline: state.timeline,
    firstClear: false, achievements,
  };
}

const commonKnown = (items: Array<[string, string, string, SimulationBeat]>) =>
  items.map(([id, label, value, discoveredAt]) => ({ id, label, value, discoveredAt }));

const makeManifest = (partial: Omit<SimulationManifest, 'version' | 'reviewed' | 'estimatedMinutes'>): SimulationManifest => ({
  ...partial, version: 1, reviewed: true, estimatedMinutes: 5,
});

export const CLINICAL_SIMULATIONS: SimulationManifest[] = [
  makeManifest({
    id: 'sim-airway-quiet-change', variantFamilyId: 'airway-change', title: 'The Quiet Change',
    subtitle: 'A subtle respiratory decline asks you to see the trend, not just the snapshot.',
    domain: 'airway', difficulty: 'introductory', style: 'guided', patientName: 'Mr. Luo', patientAge: 64,
    handoff: 'Mr. Luo is recovering from pneumonia. He is quieter than usual and his lips look slightly blue when he speaks.',
    initialState: { stability: 68, oxygenation: 48, perfusion: 72, concern: 'New breathing change', acuity: 'high', hiddenFindings: ['spo2-trend'], complications: [], interventionCount: 0 },
    knownInformation: commonKnown([['spo2-trend', 'Oxygen trend', 'SpO₂ has fallen from 96% to 89%.', 'reveal']]),
    objectives: [
      { id: 'assess-breathing', label: 'Assess the breathing change', weight: 25 },
      { id: 'support-airway', label: 'Support oxygenation', weight: 35 },
      { id: 'reassess-response', label: 'Reassess after support', weight: 30 },
      { id: 'escalate-concern', label: 'Escalate a worsening trend', weight: 10, required: false },
    ],
    actions: [
      { id: 'assess-respiratory', label: 'Assess breathing and speech', group: 'assess', beats: ['assess'], effects: { objectiveIds: ['assess-breathing'], reveal: ['spo2-trend'], announcement: 'You pause to assess the new breathing change.' }, rationale: 'Assessment distinguishes a quiet patient from a deteriorating one.' },
      { id: 'support-oxygen', label: 'Support oxygenation', group: 'support', beats: ['prioritize', 'intervene'], effects: { stability: 18, oxygenation: 28, objectiveIds: ['support-airway'], announcement: 'Airway support improves oxygenation.' }, rationale: 'Breathing support comes before less urgent concerns.' },
      { id: 'wait-and-see', label: 'Wait and see', group: 'treat', beats: ['prioritize', 'intervene'], unsafe: true, effects: { stability: -20, safety: 'unsafe', announcement: 'The delay allows the respiratory concern to worsen.' }, rationale: 'A new oxygenation change should not be ignored.' },
      { id: 'reassess-luo', label: 'Reassess response', group: 'reassess', beats: ['reassess'], effects: { objectiveIds: ['reassess-response'], announcement: 'A repeat check confirms the response to support.' }, rationale: 'Reassessment verifies whether the intervention worked.' },
      { id: 'escalate-respiratory', label: 'Escalate the trend', group: 'escalate', beats: ['reassess', 'adaptation'], effects: { objectiveIds: ['escalate-concern'], announcement: 'You communicate the worsening trend for further review.' }, rationale: 'A worsening trend needs a clear handoff.' },
    ],
    complications: [], clinicalPrinciple: 'A new breathing change deserves assessment, support, and reassessment.', relatedPractice: ['Clinical Cue Lab', 'Rapid Triage Hall'],
  }),
  makeManifest({
    id: 'sim-perfusion-hidden', variantFamilyId: 'perfusion-hidden', title: 'The Hidden Perfusion Signal',
    subtitle: 'The reassuring number is not the whole patient.',
    domain: 'assessment', difficulty: 'standard', style: 'transfer', patientName: 'Mr. Sato', patientAge: 70,
    handoff: 'Mr. Sato is being monitored after blood loss. His blood pressure is not severely low, but he is restless and pale.',
    initialState: { stability: 60, oxygenation: 76, perfusion: 42, concern: 'Possible poor perfusion', acuity: 'high', hiddenFindings: ['urine-output'], complications: [], interventionCount: 0 },
    knownInformation: commonKnown([['urine-output', 'Urine output', 'Only 15 mL per hour after blood loss.', 'reveal']]),
    objectives: [
      { id: 'assess-perfusion', label: 'Assess circulation and output', weight: 25 },
      { id: 'prioritize-perfusion', label: 'Prioritize perfusion', weight: 25 },
      { id: 'support-perfusion', label: 'Support the patient', weight: 30 },
      { id: 'reassess-perfusion', label: 'Reassess after intervention', weight: 20 },
    ],
    actions: [
      { id: 'assess-perfusion', label: 'Assess perfusion clues', group: 'assess', beats: ['assess'], effects: { objectiveIds: ['assess-perfusion'], reveal: ['urine-output'], announcement: 'You look beyond the blood pressure and check perfusion clues.' }, rationale: 'Restlessness, pallor, and output can reveal poor perfusion early.' },
      { id: 'prioritize-perfusion', label: 'Prioritize the perfusion concern', group: 'escalate', beats: ['reveal', 'prioritize'], effects: { objectiveIds: ['prioritize-perfusion'], announcement: 'The converging clues make perfusion the priority.' }, rationale: 'A cluster of changes outweighs one reassuring vital sign.' },
      { id: 'support-circulation', label: 'Support circulation', group: 'support', beats: ['prioritize', 'intervene'], effects: { perfusion: 25, stability: 12, objectiveIds: ['prioritize-perfusion', 'support-perfusion'], announcement: 'Support is started while the concern is communicated.' }, rationale: 'Support the immediate need while seeking appropriate review.' },
      { id: 'dismiss-bp', label: 'Dismiss it because BP is okay', group: 'treat', beats: ['reveal', 'prioritize', 'intervene'], unsafe: true, effects: { perfusion: -18, stability: -15, safety: 'unsafe', announcement: 'The early perfusion signals are missed.' }, rationale: 'A near-normal blood pressure does not rule out early hypoperfusion.' },
      { id: 'reassess-circulation', label: 'Reassess circulation', group: 'reassess', beats: ['reassess'], effects: { objectiveIds: ['reassess-perfusion'], announcement: 'Repeat observations show whether circulation is improving.' }, rationale: 'The response must be checked, not assumed.' },
    ],
    complications: [], clinicalPrinciple: 'Read converging cues and trends rather than anchoring on one number.', relatedPractice: ['Clinical Cue Lab', 'Stabilize Stack Lab'],
  }),
  makeManifest({
    id: 'sim-adaptive-airway', variantFamilyId: 'airway-change', title: 'The Returning Wheeze',
    subtitle: 'A first response helped, but a complication tests your adaptation.',
    domain: 'judgment', difficulty: 'advanced', style: 'focused', patientName: 'Ms. Bai', patientAge: 54,
    handoff: 'Ms. Bai has recurrent wheezing after initial airway support. Her first response was incomplete.',
    initialState: { stability: 58, oxygenation: 44, perfusion: 70, concern: 'Recurrent airway distress', acuity: 'high', hiddenFindings: ['work-of-breathing'], complications: [], interventionCount: 0 },
    knownInformation: commonKnown([['work-of-breathing', 'Work of breathing', 'She cannot finish a sentence without pausing.', 'reveal']]),
    objectives: [
      { id: 'assess-recurrence', label: 'Assess the recurrence', weight: 20 },
      { id: 'support-airway', label: 'Support airway', weight: 25 },
      { id: 'reassess-response', label: 'Reassess response', weight: 20 },
      { id: 'adapt-plan', label: 'Adapt when symptoms recur', weight: 35 },
    ],
    actions: [
      { id: 'assess-recurrence', label: 'Assess speech and breathing', group: 'assess', beats: ['assess'], effects: { reveal: ['work-of-breathing'], objectiveIds: ['assess-recurrence'], announcement: 'The interrupted speech confirms increased work of breathing.' }, rationale: 'Speech tolerance is an important clue to respiratory status.' },
      { id: 'support-airway-focused', label: 'Support the airway', group: 'support', beats: ['prioritize', 'intervene'], effects: { oxygenation: 25, stability: 15, objectiveIds: ['support-airway'], announcement: 'Focused airway support gives the patient room to recover.' }, rationale: 'Support the immediate airway problem before secondary tasks.' },
      { id: 'prioritize-airway-response', label: 'Prioritize an urgent respiratory response', group: 'treat', beats: ['prioritize'], effects: { announcement: 'You recognize the recurring respiratory concern needs urgent follow-through.' }, rationale: 'Recognizing an urgent concern is not the same as completing the airway support plan.' },
      { id: 'reassess-airway', label: 'Reassess after support', group: 'reassess', beats: ['reassess'], effects: { objectiveIds: ['reassess-response'], announcement: 'You check whether speech and breathing have improved.' }, rationale: 'A response must be verified.' },
      { id: 'adapt-airway-plan', label: 'Adapt and escalate the plan', group: 'escalate', beats: ['adaptation'], effects: { stability: 10, objectiveIds: ['adapt-plan'], announcement: 'The recurrence is communicated and the plan is adapted.' }, rationale: 'A returning problem needs a new plan, not repetition without review.' },
      { id: 'ignore-recurrence', label: 'Ignore the recurrence', group: 'treat', beats: ['reassess', 'adaptation'], unsafe: true, effects: { stability: -25, safety: 'unsafe', announcement: 'The recurrence is ignored and the patient worsens.' }, rationale: 'Recurrent symptoms are a reason to reassess and adapt.' },
    ],
    complications: [{
      id: 'recurrent-wheeze', label: 'Wheeze returns', eligibleDifficulties: ['advanced', 'expert'],
      triggerAfterActionIds: ['reassess-airway'], preventionActionIds: ['support-airway-focused'],
      outcomeActionIds: ['adapt-airway-plan'], rationale: 'An incomplete first response can recur.',
      announcement: 'The wheeze returns — reassess and adapt.',
    }],
    clinicalPrinciple: 'Safe care is a loop: assess, support, reassess, and adapt.', relatedPractice: ['Rapid Triage Hall', 'Clinical Cue Lab'],
  }),
];

export function getClinicalSimulation(id: string): SimulationManifest | undefined {
  return CLINICAL_SIMULATIONS.find((simulation) => simulation.id === id);
}

export function simulationsForLab(config?: Partial<SimulationConfig>): SimulationManifest[] {
  return CLINICAL_SIMULATIONS.filter((simulation) =>
    (!config?.difficulty || simulation.difficulty === config.difficulty) &&
    (!config?.style || simulation.style === config.style),
  );
}

export function recommendedSimulation(
  history: Array<{ simulationId: string; variantFamilyId: string; score: number }> = [],
): SimulationManifest {
  const seen = new Set(history.map((item) => item.simulationId));
  return [...CLINICAL_SIMULATIONS].sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)))[0];
}

export function canConfigureSimulation(
  playerLevel: number,
  difficulty: SimulationDifficulty,
  completedPackageOneLabs: number,
): boolean {
  if (difficulty === 'introductory') return completedPackageOneLabs >= 3;
  if (difficulty === 'standard') return playerLevel >= 5 && completedPackageOneLabs >= 3;
  return playerLevel >= 25 && completedPackageOneLabs >= 3;
}

export const SIMULATION_ACHIEVEMENTS = {
  first_stabilization: 'First Stabilization',
  reassessment_matters: 'Reassessment Matters',
  broad_clinician: 'Broad Clinician',
  safe_hands: 'Safe Hands',
  adaptive_thinker: 'Adaptive Thinker',
  clinical_simulator: 'Clinical Simulator',
} as const;
