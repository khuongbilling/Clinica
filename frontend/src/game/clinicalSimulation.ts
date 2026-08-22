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

type CoreVariation = {
  id: string;
  variantFamilyId: string;
  title: string;
  subtitle: string;
  domain: SimulationDomain;
  difficulty: SimulationDifficulty;
  style: SimulationStyle;
  patientName: string;
  patientAge: number;
  handoff: string;
  initialState: Omit<PatientState, 'hiddenFindings' | 'complications' | 'interventionCount'>;
  findingLabel: string;
  findingValue: string;
  focus: string;
  supportLabel: string;
  unsafeLabel: string;
  safeDelta: Pick<SimulationEffect, 'stability' | 'oxygenation' | 'perfusion'>;
  clinicalPrinciple: string;
  relatedPractice: string[];
};

const makeCoreVariation = (caseData: CoreVariation): SimulationManifest => {
  const findingId = `${caseData.id}-finding`;
  return makeManifest({
    ...caseData,
    initialState: { ...caseData.initialState, hiddenFindings: [findingId], complications: [], interventionCount: 0 },
    knownInformation: commonKnown([[findingId, caseData.findingLabel, caseData.findingValue, 'reveal']]),
    objectives: [
      { id: `${caseData.id}-assessed`, label: `Assess ${caseData.focus}`, weight: 25 },
      { id: `${caseData.id}-supported`, label: caseData.supportLabel, weight: 35 },
      { id: `${caseData.id}-reassessed`, label: 'Reassess the response', weight: 40 },
    ],
    actions: [
      { id: `${caseData.id}-assess`, label: `Assess ${caseData.focus}`, group: 'assess', beats: ['assess'], effects: { reveal: [findingId], objectiveIds: [`${caseData.id}-assessed`], announcement: `Assessment reveals the key ${caseData.focus} change.` }, rationale: 'A focused assessment turns a concerning handoff into an observable clinical trend.' },
      { id: `${caseData.id}-support`, label: caseData.supportLabel, group: 'support', beats: ['prioritize', 'intervene'], effects: { ...caseData.safeDelta, objectiveIds: [`${caseData.id}-supported`], announcement: `${caseData.supportLabel} improves the immediate concern.` }, rationale: 'Address the immediate concern before returning to lower-priority work.' },
      { id: `${caseData.id}-unsafe`, label: caseData.unsafeLabel, group: 'treat', beats: ['prioritize', 'intervene'], unsafe: true, effects: { stability: -20, safety: 'unsafe', announcement: 'The concern is deferred and the patient deteriorates.' }, rationale: 'A concerning change needs a deliberate response, not delay.' },
      { id: `${caseData.id}-reassess`, label: 'Reassess the response', group: 'reassess', beats: ['reassess'], effects: { objectiveIds: [`${caseData.id}-reassessed`], announcement: 'A repeat assessment confirms whether the response is working.' }, rationale: 'Interventions must be checked rather than assumed to be effective.' },
    ],
    complications: [],
  });
};

export const EXPANDED_SIMULATION_IDS = [
  'sim-assessment-new-confusion', 'sim-assessment-fever-trend', 'sim-assessment-post-op-pain',
  'sim-medication-identity', 'sim-medication-renal-dose', 'sim-medication-sedation-check',
  'sim-judgment-prioritize-fall', 'sim-judgment-call-rapid-response', 'sim-judgment-change-plan',
  'sim-sepsis-subtle-trend', 'sim-sepsis-source-control', 'sim-sepsis-escalation',
] as const;

const CORE_VARIATIONS: CoreVariation[] = [
  { id: 'sim-assessment-new-confusion', variantFamilyId: 'deterioration-recognition', title: 'The Different Answer', subtitle: 'A subtle change in attention can be an early change in condition.', domain: 'assessment', difficulty: 'introductory', style: 'guided', patientName: 'Mrs. Ortiz', patientAge: 78, handoff: 'Mrs. Ortiz usually follows every conversation, but today she asks the same question twice.', initialState: { stability: 63, oxygenation: 70, perfusion: 66, concern: 'New confusion', acuity: 'moderate' }, findingLabel: 'Baseline comparison', findingValue: 'Family confirms this level of confusion is new today.', focus: 'mental-status change', supportLabel: 'Protect safety and escalate the new change', unsafeLabel: 'Assume this is her usual behavior', safeDelta: { stability: 18, perfusion: 12 }, clinicalPrinciple: 'Compare behavior to baseline; a new mental-status change requires attention.', relatedPractice: ['Clinical Cue Lab', 'Rapid Triage Hall'] },
  { id: 'sim-assessment-fever-trend', variantFamilyId: 'deterioration-recognition', title: 'The Rising Line', subtitle: 'A trend across observations matters more than a single isolated result.', domain: 'assessment', difficulty: 'standard', style: 'transfer', patientName: 'Mr. Flynn', patientAge: 52, handoff: 'Mr. Flynn reports chills, and his temperature has risen at each check this shift.', initialState: { stability: 61, oxygenation: 74, perfusion: 58, concern: 'Rising temperature trend', acuity: 'moderate' }, findingLabel: 'Temperature trend', findingValue: 'Temperature has risen at three consecutive observations.', focus: 'temperature trend', supportLabel: 'Support comfort and escalate the trend', unsafeLabel: 'Wait for the next routine vital set', safeDelta: { stability: 19, perfusion: 14 }, clinicalPrinciple: 'Trend recognition prevents a changing condition from being hidden by one familiar number.', relatedPractice: ['Clinical Cue Lab', 'Stabilize Stack Lab'] },
  { id: 'sim-assessment-post-op-pain', variantFamilyId: 'deterioration-recognition', title: 'Pain That Changed', subtitle: 'A new pattern deserves reassessment instead of an automatic repeat of the old plan.', domain: 'judgment', difficulty: 'advanced', style: 'focused', patientName: 'Ms. Imani', patientAge: 39, handoff: 'Ms. Imani has a new, sharper pain pattern after initially recovering comfortably.', initialState: { stability: 58, oxygenation: 76, perfusion: 57, concern: 'Changing postoperative pain', acuity: 'high' }, findingLabel: 'Pain pattern', findingValue: 'The pain is new in location and does not match the earlier pattern.', focus: 'new pain pattern', supportLabel: 'Support comfort and urgently communicate the change', unsafeLabel: 'Repeat the earlier plan without assessment', safeDelta: { stability: 20, perfusion: 16 }, clinicalPrinciple: 'A changing symptom pattern calls for reassessment and escalation, not autopilot.', relatedPractice: ['Rapid Triage Hall', 'Clinical Cue Lab'] },
  { id: 'sim-medication-identity', variantFamilyId: 'medication-safety', title: 'The Name Mismatch', subtitle: 'A familiar task becomes unsafe when one identifier does not match.', domain: 'pharmacology', difficulty: 'introductory', style: 'guided', patientName: 'Mr. Wells', patientAge: 67, handoff: 'A medication is ready, but the name on the prepared record does not match the patient at bedside.', initialState: { stability: 72, oxygenation: 82, perfusion: 76, concern: 'Medication identity mismatch', acuity: 'low' }, findingLabel: 'Identity check', findingValue: 'The second identifier does not match the prepared record.', focus: 'medication identity', supportLabel: 'Pause the medication and verify identity', unsafeLabel: 'Give it because the room number matches', safeDelta: { stability: 12, perfusion: 10 }, clinicalPrinciple: 'A mismatch is a stop signal: verify before proceeding.', relatedPractice: ['Clinical Cue Lab', 'Rapid Triage Hall'] },
  { id: 'sim-medication-renal-dose', variantFamilyId: 'medication-safety', title: 'The Changed Clearance', subtitle: 'A current medication list does not replace checking a changing patient context.', domain: 'pharmacology', difficulty: 'standard', style: 'focused', patientName: 'Mrs. Kapoor', patientAge: 74, handoff: 'Mrs. Kapoor has a new lab result relevant to the medication scheduled this morning.', initialState: { stability: 66, oxygenation: 80, perfusion: 62, concern: 'Medication context changed', acuity: 'moderate' }, findingLabel: 'New context', findingValue: 'A new result changes the safety context for the scheduled medication.', focus: 'medication safety context', supportLabel: 'Hold and clarify the changed medication plan', unsafeLabel: 'Give the scheduled dose without review', safeDelta: { stability: 16, perfusion: 18 }, clinicalPrinciple: 'Medication safety depends on the current patient context, not only the routine schedule.', relatedPractice: ['Clinical Cue Lab', 'Stabilize Stack Lab'] },
  { id: 'sim-medication-sedation-check', variantFamilyId: 'medication-safety', title: 'Before the Next Dose', subtitle: 'A drowsier patient needs a current assessment before another sedating step.', domain: 'pharmacology', difficulty: 'advanced', style: 'transfer', patientName: 'Mr. Okafor', patientAge: 61, handoff: 'Mr. Okafor is noticeably drowsier than at the prior check and has another dose scheduled.', initialState: { stability: 57, oxygenation: 58, perfusion: 68, concern: 'Increasing drowsiness', acuity: 'high' }, findingLabel: 'Sedation trend', findingValue: 'He needs repeated prompting to stay awake during conversation.', focus: 'sedation change', supportLabel: 'Pause, support breathing, and escalate review', unsafeLabel: 'Give the next sedating dose on schedule', safeDelta: { stability: 22, oxygenation: 25 }, clinicalPrinciple: 'A new sedation change is a reason to pause, assess, and communicate before another dose.', relatedPractice: ['Rapid Triage Hall', 'Clinical Cue Lab'] },
  { id: 'sim-judgment-prioritize-fall', variantFamilyId: 'escalation-handoff', title: 'The Unsteady Call', subtitle: 'A near-fall is a safety cue that needs a current plan, not blame.', domain: 'judgment', difficulty: 'introductory', style: 'guided', patientName: 'Mr. Diaz', patientAge: 81, handoff: 'Mr. Diaz nearly falls while trying to stand without assistance.', initialState: { stability: 65, oxygenation: 80, perfusion: 57, concern: 'Immediate fall risk', acuity: 'moderate' }, findingLabel: 'Mobility change', findingValue: 'He is more unsteady than during the earlier assisted walk.', focus: 'fall-risk change', supportLabel: 'Protect safety and communicate the mobility change', unsafeLabel: 'Tell him to try again alone', safeDelta: { stability: 18, perfusion: 20 }, clinicalPrinciple: 'A changing mobility risk requires immediate protection and a shared plan.', relatedPractice: ['Rapid Triage Hall', 'Clinical Cue Lab'] },
  { id: 'sim-judgment-call-rapid-response', variantFamilyId: 'escalation-handoff', title: 'The Whole Picture', subtitle: 'Several modest changes can add up to a need for urgent help.', domain: 'judgment', difficulty: 'standard', style: 'focused', patientName: 'Ms. Thomas', patientAge: 63, handoff: 'Ms. Thomas has become more breathless, less responsive, and harder to rouse over the last hour.', initialState: { stability: 50, oxygenation: 51, perfusion: 55, concern: 'Multiple worsening cues', acuity: 'critical' }, findingLabel: 'Combined trend', findingValue: 'Breathing, responsiveness, and circulation cues are worsening together.', focus: 'combined deterioration', supportLabel: 'Start support and call for urgent review', unsafeLabel: 'Address one sign and ignore the rest', safeDelta: { stability: 30, oxygenation: 29, perfusion: 17 }, clinicalPrinciple: 'Escalate when the whole pattern signals deterioration, even if each cue alone seems modest.', relatedPractice: ['Rapid Triage Hall', 'Stabilize Stack Lab'] },
  { id: 'sim-judgment-change-plan', variantFamilyId: 'escalation-handoff', title: 'When the Plan Stops Working', subtitle: 'Repeating an ineffective plan can delay the adaptation a patient needs.', domain: 'judgment', difficulty: 'advanced', style: 'transfer', patientName: 'Mr. Njeri', patientAge: 45, handoff: 'Mr. Njeri has not improved after the expected first response and now appears more fatigued.', initialState: { stability: 55, oxygenation: 59, perfusion: 60, concern: 'Incomplete response', acuity: 'high' }, findingLabel: 'Response check', findingValue: 'The expected improvement has not appeared at reassessment.', focus: 'incomplete response', supportLabel: 'Adapt support and communicate the failed response', unsafeLabel: 'Repeat the same plan without review', safeDelta: { stability: 27, oxygenation: 25, perfusion: 17 }, clinicalPrinciple: 'Reassessment changes the plan when the first response is incomplete.', relatedPractice: ['Rapid Triage Hall', 'Clinical Cue Lab'] },
  { id: 'sim-sepsis-subtle-trend', variantFamilyId: 'sepsis-pattern', title: 'The Subtle Shift', subtitle: 'New chills, fatigue, and a changing trend should be read together.', domain: 'assessment', difficulty: 'introductory', style: 'guided', patientName: 'Mr. Allen', patientAge: 62, handoff: 'Mr. Allen reports chills and seems more tired than he did at the last conversation.', initialState: { stability: 60, oxygenation: 72, perfusion: 56, concern: 'Possible infection trend', acuity: 'moderate' }, findingLabel: 'Clustered changes', findingValue: 'Several small changes have appeared together since the earlier assessment.', focus: 'clustered infection cues', supportLabel: 'Support the patient and communicate the trend', unsafeLabel: 'Treat each small change as unrelated', safeDelta: { stability: 20, perfusion: 25 }, clinicalPrinciple: 'Clustered changes deserve assessment and escalation before they become a crisis.', relatedPractice: ['Clinical Cue Lab', 'Rapid Triage Hall'] },
  { id: 'sim-sepsis-source-control', variantFamilyId: 'sepsis-pattern', title: 'The New Drainage', subtitle: 'A new local change can matter when the whole patient is becoming less well.', domain: 'assessment', difficulty: 'standard', style: 'transfer', patientName: 'Ms. Lewis', patientAge: 48, handoff: 'Ms. Lewis has new drainage at a healing site and says she feels increasingly unwell.', initialState: { stability: 57, oxygenation: 74, perfusion: 53, concern: 'New local and systemic cues', acuity: 'high' }, findingLabel: 'New local finding', findingValue: 'The drainage is new and accompanies a broader change in how she feels.', focus: 'new drainage finding', supportLabel: 'Support the patient and escalate the new finding', unsafeLabel: 'Cover the finding and wait for the next check', safeDelta: { stability: 24, perfusion: 29 }, clinicalPrinciple: 'Link local changes with the patient’s overall trend instead of treating them in isolation.', relatedPractice: ['Clinical Cue Lab', 'Stabilize Stack Lab'] },
  { id: 'sim-sepsis-escalation', variantFamilyId: 'sepsis-pattern', title: 'The Escalation Window', subtitle: 'When several responses are not enough, early escalation protects the patient.', domain: 'judgment', difficulty: 'advanced', style: 'focused', patientName: 'Mr. Huang', patientAge: 73, handoff: 'Mr. Huang has worsening fatigue, lower output, and a new change in responsiveness.', initialState: { stability: 49, oxygenation: 66, perfusion: 42, concern: 'Escalating systemic concern', acuity: 'critical' }, findingLabel: 'Escalation pattern', findingValue: 'Output, responsiveness, and overall appearance have worsened together.', focus: 'escalation pattern', supportLabel: 'Begin support and escalate urgent review', unsafeLabel: 'Continue routine observations without escalation', safeDelta: { stability: 32, oxygenation: 20, perfusion: 34 }, clinicalPrinciple: 'Escalate early when multiple worsening cues point to a changing systemic condition.', relatedPractice: ['Rapid Triage Hall', 'Stabilize Stack Lab'] },
];

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
      { id: 'assess-recurrence', label: 'Assess the recurrence', weight: 25 },
      { id: 'support-airway', label: 'Support airway', weight: 45 },
      { id: 'reassess-response', label: 'Reassess response', weight: 20 },
      { id: 'adapt-plan', label: 'Adapt when symptoms recur', weight: 10 },
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
  makeManifest({
    id: 'sim-airway-breathless-walk', variantFamilyId: 'airway-change', title: 'The Breathless Walk',
    subtitle: 'Exertion reveals a respiratory change that the resting snapshot missed.',
    domain: 'airway', difficulty: 'standard', style: 'focused', patientName: 'Ms. Ren', patientAge: 61,
    handoff: 'Ms. Ren was comfortable at rest after a respiratory infection. Walking to the chair leaves her breathless and unable to finish a sentence.',
    initialState: { stability: 64, oxygenation: 55, perfusion: 72, concern: 'Exertional breathing change', acuity: 'high', hiddenFindings: ['walking-spo2'], complications: [], interventionCount: 0 },
    knownInformation: commonKnown([['walking-spo2', 'Exertional oxygen trend', 'Her SpO₂ falls to 87% while walking and recovers slowly at rest.', 'reveal']]),
    objectives: [
      { id: 'assess-exertion', label: 'Assess the exertional change', weight: 25 },
      { id: 'support-exertion', label: 'Prioritize breathing support', weight: 45 },
      { id: 'reassess-exertion', label: 'Reassess after support', weight: 30 },
    ],
    actions: [
      { id: 'assess-exertional-breathing', label: 'Assess breathing with activity', group: 'assess', beats: ['assess'], effects: { reveal: ['walking-spo2'], objectiveIds: ['assess-exertion'], announcement: 'Activity exposes a clinically important oxygenation trend.' }, rationale: 'A resting snapshot can miss an exertional respiratory decline.' },
      { id: 'support-exertional-breathing', label: 'Pause activity and support breathing', group: 'support', beats: ['prioritize', 'intervene'], effects: { stability: 16, oxygenation: 24, objectiveIds: ['support-exertion'], announcement: 'Breathing support and rest improve the exertional response.' }, rationale: 'Address breathing and oxygenation before continuing an activity.' },
      { id: 'continue-walk', label: 'Encourage her to walk it off', group: 'treat', beats: ['prioritize', 'intervene'], unsafe: true, effects: { stability: -20, oxygenation: -18, safety: 'unsafe', announcement: 'Continuing activity worsens the breathing change.' }, rationale: 'New exertional distress needs support rather than encouragement to push through.' },
      { id: 'reassess-exertional-breathing', label: 'Reassess the activity response', group: 'reassess', beats: ['reassess'], effects: { objectiveIds: ['reassess-exertion'], announcement: 'A repeat check confirms whether the patient has recovered safely.' }, rationale: 'Reassessment determines whether activity can be reconsidered.' },
      { id: 'escalate-exertional-trend', label: 'Escalate the exertional trend', group: 'escalate', beats: ['prioritize'], effects: { objectiveIds: ['support-exertion'], announcement: 'The exertional decline is communicated for further review.' }, rationale: 'A new activity-related decline deserves a clear handoff.' },
    ],
    complications: [], clinicalPrinciple: 'Compare activity tolerance with the resting picture and respond to the trend.', relatedPractice: ['Clinical Cue Lab', 'Rapid Triage Hall'],
  }),
  makeManifest({
    id: 'sim-perfusion-cool-hand', variantFamilyId: 'perfusion-hidden', title: 'The Cool Hand',
    subtitle: 'A simple bedside clue changes what needs attention first.',
    domain: 'assessment', difficulty: 'introductory', style: 'guided', patientName: 'Mr. Okafor', patientAge: 67,
    handoff: 'Mr. Okafor reports dizziness when sitting up. His monitor looks stable, but one hand is cool and his skin is pale.',
    initialState: { stability: 66, oxygenation: 78, perfusion: 48, concern: 'Possible reduced perfusion', acuity: 'moderate', hiddenFindings: ['capillary-refill'], complications: [], interventionCount: 0 },
    knownInformation: commonKnown([['capillary-refill', 'Capillary refill', 'Capillary refill is delayed and the cool hand remains pale.', 'reveal']]),
    objectives: [
      { id: 'assess-cool-hand', label: 'Assess the circulation clue', weight: 25 },
      { id: 'support-cool-hand', label: 'Prioritize perfusion support', weight: 45 },
      { id: 'reassess-cool-hand', label: 'Reassess circulation', weight: 30 },
    ],
    actions: [
      { id: 'assess-cool-hand', label: 'Assess skin and capillary refill', group: 'assess', beats: ['assess'], effects: { reveal: ['capillary-refill'], objectiveIds: ['assess-cool-hand'], announcement: 'The bedside assessment confirms a meaningful perfusion clue.' }, rationale: 'Skin temperature and refill add context to monitor values.' },
      { id: 'support-cool-hand', label: 'Support circulation and call for review', group: 'support', beats: ['prioritize', 'intervene'], effects: { stability: 14, perfusion: 26, objectiveIds: ['support-cool-hand'], announcement: 'Circulatory support begins while the concern is communicated.' }, rationale: 'Support the immediate circulation concern while seeking appropriate review.' },
      { id: 'ignore-cool-hand', label: 'Wait for the next routine vital sign', group: 'treat', beats: ['prioritize', 'intervene'], unsafe: true, effects: { stability: -18, perfusion: -18, safety: 'unsafe', announcement: 'The perfusion clue is missed while the patient worsens.' }, rationale: 'A concerning assessment finding should not wait for a routine check.' },
      { id: 'reassess-cool-hand', label: 'Reassess circulation and symptoms', group: 'reassess', beats: ['reassess'], effects: { objectiveIds: ['reassess-cool-hand'], announcement: 'A repeat assessment checks whether circulation is improving.' }, rationale: 'Support is only useful when the response is verified.' },
      { id: 'escalate-cool-hand', label: 'Escalate the circulation concern', group: 'escalate', beats: ['prioritize'], effects: { objectiveIds: ['support-cool-hand'], announcement: 'The circulation concern is handed off clearly.' }, rationale: 'Escalation protects against a missed change in condition.' },
    ],
    complications: [], clinicalPrinciple: 'Simple bedside findings can reveal a circulation problem before a monitor changes.', relatedPractice: ['Clinical Cue Lab', 'Stabilize Stack Lab'],
  }),
  makeManifest({
    id: 'sim-perfusion-reassuring-monitor', variantFamilyId: 'perfusion-hidden', title: 'The Reassuring Monitor',
    subtitle: 'A normal-looking number does not replace reassessment of the whole patient.',
    domain: 'assessment', difficulty: 'advanced', style: 'focused', patientName: 'Ms. Imani', patientAge: 58,
    handoff: 'Ms. Imani has a near-normal blood pressure after a procedure but is increasingly drowsy, clammy, and difficult to rouse.',
    initialState: { stability: 54, oxygenation: 74, perfusion: 44, concern: 'Deterioration despite a reassuring monitor', acuity: 'high', hiddenFindings: ['mental-status-trend'], complications: [], interventionCount: 0 },
    knownInformation: commonKnown([['mental-status-trend', 'Mental status trend', 'Her responses have slowed over the last 20 minutes.', 'reveal']]),
    objectives: [
      { id: 'assess-monitor-context', label: 'Assess the full clinical picture', weight: 30 },
      { id: 'support-monitor-context', label: 'Prioritize the deterioration', weight: 40 },
      { id: 'reassess-monitor-context', label: 'Reassess the response', weight: 20 },
      { id: 'adapt-monitor-context', label: 'Adapt the escalation plan', weight: 10 },
    ],
    actions: [
      { id: 'assess-monitor-context', label: 'Assess responsiveness and perfusion', group: 'assess', beats: ['assess'], effects: { reveal: ['mental-status-trend'], objectiveIds: ['assess-monitor-context'], announcement: 'The bedside trend confirms that the monitor is not the whole picture.' }, rationale: 'Change in responsiveness is a significant cue even when one value looks reassuring.' },
      { id: 'support-monitor-context', label: 'Support perfusion and escalate concern', group: 'support', beats: ['prioritize', 'intervene'], effects: { stability: 24, perfusion: 28, objectiveIds: ['support-monitor-context'], announcement: 'Support begins while the deterioration is escalated.' }, rationale: 'Treat the patient’s condition, not a single reassuring number.' },
      { id: 'anchor-on-monitor', label: 'Rely on the normal monitor value', group: 'treat', beats: ['prioritize', 'intervene'], unsafe: true, effects: { stability: -24, perfusion: -20, safety: 'unsafe', announcement: 'Anchoring on one value delays a response to deterioration.' }, rationale: 'A normal-looking value does not cancel a worsening clinical trend.' },
      { id: 'reassess-monitor-context', label: 'Reassess responsiveness', group: 'reassess', beats: ['reassess'], effects: { objectiveIds: ['reassess-monitor-context'], announcement: 'A repeat check tests whether the patient is responding to support.' }, rationale: 'Reassessment verifies whether the chosen response is enough.' },
      { id: 'adapt-monitor-context', label: 'Adapt the escalation plan', group: 'escalate', beats: ['adaptation'], effects: { stability: 10, objectiveIds: ['adapt-monitor-context'], announcement: 'The changed response is communicated and the plan is adapted.' }, rationale: 'A changing patient may require a higher level of response.' },
    ],
    complications: [{
      id: 'slower-responses', label: 'Responsiveness slows further', eligibleDifficulties: ['advanced', 'expert'],
      triggerAfterActionIds: ['reassess-monitor-context'], preventionActionIds: ['support-monitor-context'],
      outcomeActionIds: ['adapt-monitor-context'], rationale: 'An incomplete early response can allow the trend to continue.',
      announcement: 'Her responses slow further — reassess and adapt.',
    }],
    clinicalPrinciple: 'Reassess the whole patient when the bedside picture and a monitor value conflict.', relatedPractice: ['Clinical Cue Lab', 'Rapid Triage Hall'],
  }),
  makeManifest({
    id: 'sim-stabilization-first-response', variantFamilyId: 'stabilization-sequence', title: 'The First Response',
    subtitle: 'A calm first sequence creates room to see whether the patient is improving.',
    domain: 'stabilization', difficulty: 'introductory', style: 'guided', patientName: 'Mr. Singh', patientAge: 45,
    handoff: 'Mr. Singh suddenly feels faint after standing. He is sweaty, anxious, and asking to lie down.',
    initialState: { stability: 62, oxygenation: 80, perfusion: 54, concern: 'Acute faintness and instability', acuity: 'moderate', hiddenFindings: ['orthostatic-symptoms'], complications: [], interventionCount: 0 },
    knownInformation: commonKnown([['orthostatic-symptoms', 'Position change', 'Symptoms began immediately after standing and improve when he lies back.', 'reveal']]),
    objectives: [
      { id: 'assess-first-response', label: 'Assess the immediate change', weight: 25 },
      { id: 'stabilize-first-response', label: 'Start a safe stabilization sequence', weight: 45 },
      { id: 'reassess-first-response', label: 'Reassess after support', weight: 30 },
    ],
    actions: [
      { id: 'assess-first-response', label: 'Assess symptoms and position change', group: 'assess', beats: ['assess'], effects: { reveal: ['orthostatic-symptoms'], objectiveIds: ['assess-first-response'], announcement: 'The position change helps explain the immediate instability.' }, rationale: 'A focused assessment guides the safest first response.' },
      { id: 'stabilize-first-response', label: 'Keep him safe and support recovery', group: 'support', beats: ['prioritize', 'intervene'], effects: { stability: 26, perfusion: 18, objectiveIds: ['stabilize-first-response'], announcement: 'Safety measures and support help the patient recover.' }, rationale: 'Preventing a fall and supporting the immediate need come before routine tasks.' },
      { id: 'rush-first-response', label: 'Send him to walk it off', group: 'treat', beats: ['prioritize', 'intervene'], unsafe: true, effects: { stability: -24, perfusion: -14, safety: 'unsafe', announcement: 'The unsafe activity worsens his instability.' }, rationale: 'A faint patient needs stabilization, not more activity.' },
      { id: 'reassess-first-response', label: 'Reassess stability before moving', group: 'reassess', beats: ['reassess'], effects: { objectiveIds: ['reassess-first-response'], announcement: 'A repeat check confirms whether it is safe to continue care.' }, rationale: 'Reassessment prevents an assumption that the first response worked.' },
    ],
    complications: [], clinicalPrinciple: 'Start with safety, support the immediate concern, then verify the response.', relatedPractice: ['Stabilize Stack Lab', 'Rapid Triage Hall'],
  }),
  makeManifest({
    id: 'sim-stabilization-repeat-check', variantFamilyId: 'stabilization-sequence', title: 'The Repeat Check',
    subtitle: 'A helpful intervention is not the endpoint; the response determines the next decision.',
    domain: 'stabilization', difficulty: 'standard', style: 'focused', patientName: 'Ms. Torres', patientAge: 39,
    handoff: 'Ms. Torres feels better after initial support but remains pale and says the room still spins when she sits up.',
    initialState: { stability: 60, oxygenation: 79, perfusion: 56, concern: 'Incomplete response after support', acuity: 'moderate', hiddenFindings: ['persistent-dizziness'], complications: [], interventionCount: 0 },
    knownInformation: commonKnown([['persistent-dizziness', 'Ongoing symptom', 'Her dizziness returns as soon as she changes position.', 'reveal']]),
    objectives: [
      { id: 'assess-repeat-check', label: 'Assess the incomplete response', weight: 25 },
      { id: 'stabilize-repeat-check', label: 'Maintain a safe support plan', weight: 45 },
      { id: 'reassess-repeat-check', label: 'Reassess before progressing', weight: 30 },
    ],
    actions: [
      { id: 'assess-repeat-check', label: 'Assess the response to position change', group: 'assess', beats: ['assess'], effects: { reveal: ['persistent-dizziness'], objectiveIds: ['assess-repeat-check'], announcement: 'The symptom returns with position change, showing the response is incomplete.' }, rationale: 'A partial improvement should be tested, not assumed complete.' },
      { id: 'stabilize-repeat-check', label: 'Continue support and protect from falls', group: 'support', beats: ['prioritize', 'intervene'], effects: { stability: 24, perfusion: 18, objectiveIds: ['stabilize-repeat-check'], announcement: 'Continued support reduces the immediate safety risk.' }, rationale: 'A patient with ongoing dizziness still needs a safe support plan.' },
      { id: 'skip-repeat-check', label: 'Document improvement and move on', group: 'treat', beats: ['prioritize', 'intervene'], unsafe: true, effects: { stability: -18, perfusion: -14, safety: 'unsafe', announcement: 'Moving on without reassessment misses the ongoing safety risk.' }, rationale: 'A report of feeling better is not enough when symptoms recur.' },
      { id: 'reassess-repeat-check', label: 'Reassess before changing the plan', group: 'reassess', beats: ['reassess'], effects: { objectiveIds: ['reassess-repeat-check'], announcement: 'A repeat check confirms whether the support plan is working.' }, rationale: 'Reassessment turns an intervention into a verified response.' },
    ],
    complications: [], clinicalPrinciple: 'Stabilization includes reassessment; a partial response is still information.', relatedPractice: ['Stabilize Stack Lab', 'Clinical Cue Lab'],
  }),
  makeManifest({
    id: 'sim-stabilization-plan-slips', variantFamilyId: 'stabilization-sequence', title: 'When the Plan Slips',
    subtitle: 'A patient’s response changes when the first support plan is not enough.',
    domain: 'stabilization', difficulty: 'advanced', style: 'transfer', patientName: 'Mr. Chen', patientAge: 73,
    handoff: 'Mr. Chen is weak after a long day of poor intake. He initially improves with support, then becomes more unsteady when he tries to stand again.',
    initialState: { stability: 56, oxygenation: 77, perfusion: 50, concern: 'Recurring instability', acuity: 'high', hiddenFindings: ['recurrent-unsteadiness'], complications: [], interventionCount: 0 },
    knownInformation: commonKnown([['recurrent-unsteadiness', 'Repeat change', 'The unsteadiness returns after the first apparent improvement.', 'reveal']]),
    objectives: [
      { id: 'assess-plan-slips', label: 'Assess the recurring instability', weight: 30 },
      { id: 'stabilize-plan-slips', label: 'Start appropriate support', weight: 40 },
      { id: 'reassess-plan-slips', label: 'Reassess the response', weight: 20 },
      { id: 'adapt-plan-slips', label: 'Adapt the safety plan', weight: 10 },
    ],
    actions: [
      { id: 'assess-plan-slips', label: 'Assess the recurrent unsteadiness', group: 'assess', beats: ['assess'], effects: { reveal: ['recurrent-unsteadiness'], objectiveIds: ['assess-plan-slips'], announcement: 'The recurrence shows the first improvement was not a complete resolution.' }, rationale: 'Recurring instability requires a new assessment rather than a repeated assumption.' },
      { id: 'stabilize-plan-slips', label: 'Support and protect from another fall', group: 'support', beats: ['prioritize', 'intervene'], effects: { stability: 25, perfusion: 22, objectiveIds: ['stabilize-plan-slips'], announcement: 'Focused support addresses the immediate safety concern.' }, rationale: 'The first priority is preventing harm while the response is clarified.' },
      { id: 'minimize-plan-slips', label: 'Tell him to try standing again alone', group: 'treat', beats: ['prioritize', 'intervene'], unsafe: true, effects: { stability: -26, perfusion: -16, safety: 'unsafe', announcement: 'The recurring instability creates an avoidable safety event.' }, rationale: 'A patient with recurrent unsteadiness should not be asked to test it alone.' },
      { id: 'reassess-plan-slips', label: 'Reassess before advancing activity', group: 'reassess', beats: ['reassess'], effects: { objectiveIds: ['reassess-plan-slips'], announcement: 'The reassessment identifies whether the patient is truly ready to progress.' }, rationale: 'Support must be followed by a check of the response.' },
      { id: 'adapt-plan-slips', label: 'Adapt the plan and escalate support', group: 'escalate', beats: ['adaptation'], effects: { stability: 12, objectiveIds: ['adapt-plan-slips'], announcement: 'The changing pattern is communicated and the support plan is adapted.' }, rationale: 'A repeated safety concern warrants a higher level of planning.' },
    ],
    complications: [{
      id: 'repeat-instability', label: 'Instability returns', eligibleDifficulties: ['advanced', 'expert'],
      triggerAfterActionIds: ['reassess-plan-slips'], preventionActionIds: ['stabilize-plan-slips'],
      outcomeActionIds: ['adapt-plan-slips'], rationale: 'An incomplete first response can reveal a recurring problem.',
      announcement: 'The unsteadiness returns — adapt the safety plan.',
    }],
    clinicalPrinciple: 'A recurring problem is a cue to reassess and adapt, not simply repeat the first plan.', relatedPractice: ['Stabilize Stack Lab', 'Rapid Triage Hall'],
  }),
  makeManifest({
    id: 'sim-systems-handoff-detail', variantFamilyId: 'systems-handoff', title: 'The Handoff Detail',
    subtitle: 'One overlooked detail can change how the next team understands the risk.',
    domain: 'systems', difficulty: 'introductory', style: 'guided', patientName: 'Ms. Park', patientAge: 52,
    handoff: 'Ms. Park is transferring after a new medication caused nausea and weakness. The receiving area is busy and asks for a quick summary.',
    initialState: { stability: 68, oxygenation: 82, perfusion: 62, concern: 'Transfer with a recent clinical change', acuity: 'moderate', hiddenFindings: ['medication-timing'], complications: [], interventionCount: 0 },
    knownInformation: commonKnown([['medication-timing', 'Medication timing', 'Symptoms began shortly after the new medication was given.', 'reveal']]),
    objectives: [
      { id: 'assess-handoff-detail', label: 'Assess the transfer-relevant detail', weight: 25 },
      { id: 'support-handoff-detail', label: 'Prepare a safe handoff', weight: 45 },
      { id: 'reassess-handoff-detail', label: 'Confirm shared understanding', weight: 30 },
    ],
    actions: [
      { id: 'assess-handoff-detail', label: 'Confirm symptom and medication timing', group: 'assess', beats: ['assess'], effects: { reveal: ['medication-timing'], objectiveIds: ['assess-handoff-detail'], announcement: 'The timing links the new symptom to information the next team needs.' }, rationale: 'A concise handoff still needs the details that change risk.' },
      { id: 'support-handoff-detail', label: 'Share the change and current concern', group: 'support', beats: ['prioritize', 'intervene'], effects: { stability: 18, perfusion: 10, objectiveIds: ['support-handoff-detail'], announcement: 'A clear handoff keeps the current concern visible during transfer.' }, rationale: 'Communication is a clinical action when it preserves continuity of care.' },
      { id: 'omit-handoff-detail', label: 'Give only the room number and diagnosis', group: 'treat', beats: ['prioritize', 'intervene'], unsafe: true, effects: { stability: -18, safety: 'unsafe', announcement: 'The missing detail leaves the receiving team without a relevant warning.' }, rationale: 'A transfer can become unsafe when a recent change is omitted.' },
      { id: 'reassess-handoff-detail', label: 'Confirm the receiving plan', group: 'reassess', beats: ['reassess'], effects: { objectiveIds: ['reassess-handoff-detail'], announcement: 'A closed-loop check confirms the concern was understood.' }, rationale: 'A handoff is stronger when shared understanding is verified.' },
    ],
    complications: [], clinicalPrinciple: 'A safe handoff carries forward the change, current concern, and next check.', relatedPractice: ['Rapid Triage Hall', 'Clinical Cue Lab'],
  }),
  makeManifest({
    id: 'sim-systems-delayed-escalation', variantFamilyId: 'systems-handoff', title: 'The Delayed Escalation',
    subtitle: 'When several people notice a change, coordination decides whether the response arrives in time.',
    domain: 'systems', difficulty: 'standard', style: 'focused', patientName: 'Mr. Alvarez', patientAge: 69,
    handoff: 'Mr. Alvarez is more confused than at shift start. A family member and aide both mention the change, but no one has documented or escalated it yet.',
    initialState: { stability: 58, oxygenation: 76, perfusion: 57, concern: 'Uncommunicated change in mental status', acuity: 'high', hiddenFindings: ['baseline-comparison'], complications: [], interventionCount: 0 },
    knownInformation: commonKnown([['baseline-comparison', 'Baseline comparison', 'He was oriented at shift start and is now unsure where he is.', 'reveal']]),
    objectives: [
      { id: 'assess-delayed-escalation', label: 'Assess the reported change', weight: 25 },
      { id: 'support-delayed-escalation', label: 'Coordinate an urgent response', weight: 45 },
      { id: 'reassess-delayed-escalation', label: 'Reassess after communication', weight: 30 },
    ],
    actions: [
      { id: 'assess-delayed-escalation', label: 'Compare with the documented baseline', group: 'assess', beats: ['assess'], effects: { reveal: ['baseline-comparison'], objectiveIds: ['assess-delayed-escalation'], announcement: 'The baseline comparison confirms a significant change in status.' }, rationale: 'A reported change becomes actionable when it is compared with baseline.' },
      { id: 'support-delayed-escalation', label: 'Document and escalate the change', group: 'support', beats: ['prioritize', 'intervene'], effects: { stability: 20, perfusion: 12, objectiveIds: ['support-delayed-escalation'], announcement: 'The change is documented and shared so the response can begin.' }, rationale: 'Coordination reduces the risk that a concerning change is lost between people.' },
      { id: 'delay-delayed-escalation', label: 'Wait for the next team huddle', group: 'treat', beats: ['prioritize', 'intervene'], unsafe: true, effects: { stability: -22, perfusion: -12, safety: 'unsafe', announcement: 'Waiting delays attention to a significant change in status.' }, rationale: 'A newly altered mental status should not wait for a routine meeting.' },
      { id: 'reassess-delayed-escalation', label: 'Reassess after the escalation', group: 'reassess', beats: ['reassess'], effects: { objectiveIds: ['reassess-delayed-escalation'], announcement: 'A follow-up check confirms whether the coordinated response is helping.' }, rationale: 'Communication must be paired with follow-through.' },
    ],
    complications: [], clinicalPrinciple: 'Shared observations become safe care only when they are documented, escalated, and followed through.', relatedPractice: ['Rapid Triage Hall', 'Clinical Cue Lab'],
  }),
  makeManifest({
    id: 'sim-systems-across-teams', variantFamilyId: 'systems-handoff', title: 'Across the Teams',
    subtitle: 'A shifting patient needs one plan that survives the boundaries between teams.',
    domain: 'systems', difficulty: 'advanced', style: 'transfer', patientName: 'Ms. Haddad', patientAge: 63,
    handoff: 'Ms. Haddad is awaiting transfer after a worsening abdominal concern. One team is ending shift while another is preparing a procedure area.',
    initialState: { stability: 52, oxygenation: 75, perfusion: 49, concern: 'Deterioration across a care transition', acuity: 'high', hiddenFindings: ['unresolved-order'], complications: [], interventionCount: 0 },
    knownInformation: commonKnown([['unresolved-order', 'Unresolved order', 'A time-sensitive reassessment order has not yet been acknowledged by the receiving team.', 'reveal']]),
    objectives: [
      { id: 'assess-across-teams', label: 'Assess the transition risk', weight: 30 },
      { id: 'support-across-teams', label: 'Coordinate the immediate plan', weight: 40 },
      { id: 'reassess-across-teams', label: 'Reassess ownership of the plan', weight: 20 },
      { id: 'adapt-across-teams', label: 'Adapt the escalation pathway', weight: 10 },
    ],
    actions: [
      { id: 'assess-across-teams', label: 'Confirm the unresolved order and owner', group: 'assess', beats: ['assess'], effects: { reveal: ['unresolved-order'], objectiveIds: ['assess-across-teams'], announcement: 'The assessment identifies a time-sensitive task without a clear owner.' }, rationale: 'Transitions are risky when an important next step has no confirmed owner.' },
      { id: 'support-across-teams', label: 'Coordinate the immediate plan across teams', group: 'support', beats: ['prioritize', 'intervene'], effects: { stability: 26, perfusion: 20, objectiveIds: ['support-across-teams'], announcement: 'The immediate plan is coordinated with a named next action.' }, rationale: 'Shared ownership prevents a time-sensitive concern from being lost in transition.' },
      { id: 'assume-across-teams', label: 'Assume the other team will follow up', group: 'treat', beats: ['prioritize', 'intervene'], unsafe: true, effects: { stability: -25, perfusion: -18, safety: 'unsafe', announcement: 'The unowned task delays a response to deterioration.' }, rationale: 'Assumption is not a handoff; the next action needs an owner.' },
      { id: 'reassess-across-teams', label: 'Reassess whether the plan is owned', group: 'reassess', beats: ['reassess'], effects: { objectiveIds: ['reassess-across-teams'], announcement: 'The follow-up confirms whether the time-sensitive plan is being carried forward.' }, rationale: 'Reassessment of ownership closes the coordination loop.' },
      { id: 'adapt-across-teams', label: 'Escalate to a unified response', group: 'escalate', beats: ['adaptation'], effects: { stability: 12, objectiveIds: ['adapt-across-teams'], announcement: 'The changing situation is escalated through one coordinated pathway.' }, rationale: 'When a transition plan is insufficient, the escalation path must become clearer.' },
    ],
    complications: [{
      id: 'handoff-gap', label: 'The reassessment order is missed', eligibleDifficulties: ['advanced', 'expert'],
      triggerAfterActionIds: ['reassess-across-teams'], preventionActionIds: ['support-across-teams'],
      outcomeActionIds: ['adapt-across-teams'], rationale: 'An unclear transfer plan can reveal a missed time-sensitive task.',
      announcement: 'The reassessment order was missed — unify the response.',
    }],
    clinicalPrinciple: 'Across team boundaries, safe care requires a named owner, a shared next action, and a closed-loop check.', relatedPractice: ['Rapid Triage Hall', 'Stabilize Stack Lab'],
  }),
  ...CORE_VARIATIONS.map(makeCoreVariation),
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
