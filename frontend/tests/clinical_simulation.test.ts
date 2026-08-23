import {
  applySimulationAction,
  CLINICAL_SIMULATIONS,
  createSimulationAttempt,
  EXPANDED_SIMULATION_IDS,
  evaluateSimulation,
  seededBranch,
} from '../src/game/clinicalSimulation';
import { SIMULATIONS } from '../src/game/lessons';
import { resolveSimulationRoute } from '../src/game/simulationRoute';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const quiet = CLINICAL_SIMULATIONS.find((simulation) => simulation.id === 'sim-airway-quiet-change')!;
const config = { difficulty: quiet.difficulty, style: quiet.style, assistance: 'coach' as const };

let safe = createSimulationAttempt(quiet, 'safe-attempt', config, 8123);
assert(safe.beat === 'handoff', 'attempt starts at authored handoff');
safe = { ...safe, beat: 'assess' };
safe = applySimulationAction(safe, quiet, 'assess-respiratory');
assert(safe.known.some((item) => item.id === 'spo2-trend'), 'assess action reveals authored hidden information');
assert(safe.patient.hiddenFindings.length === 0, 'revealed information leaves private patient state');
safe = applySimulationAction(safe, quiet, 'support-oxygen');
assert(safe.patient.oxygenation === 76, 'support action has a deterministic vital delta');
safe = applySimulationAction(safe, quiet, 'reassess-luo');
assert(safe.status === 'completed' && safe.beat === 'outcome', 'reassessment advances a safe path to outcome');
const safeDebrief = evaluateSimulation(quiet, safe);
assert(safeDebrief.outcome === 'stabilized' && safeDebrief.safety === 'safe', 'safe route produces a stable safe outcome');

let unsafe = createSimulationAttempt(quiet, 'unsafe-attempt', config, 8123);
unsafe = { ...unsafe, beat: 'assess' };
unsafe = applySimulationAction(unsafe, quiet, 'assess-respiratory');
unsafe = applySimulationAction(unsafe, quiet, 'wait-and-see');
assert(unsafe.safety === 'unsafe', 'unsafe authored action permanently marks the attempt unsafe');
assert(unsafe.patient.stability < quiet.initialState.stability, 'unsafe action has an authored adverse state change');

const fixedA = createSimulationAttempt(quiet, 'branch-a', config, 9876);
const fixedB = createSimulationAttempt(quiet, 'branch-b', config, 9876);
assert(fixedA.branchId === fixedB.branchId && fixedA.branchId === seededBranch(9876, quiet.variantFamilyId), 'fixed seeds preserve a branch across resume/retry');
assert(JSON.stringify(fixedA.patient) === JSON.stringify(fixedB.patient), 'attempt initialization does not depend on wall clock');

const expectedFamilies = new Map([
  ['airway-change', 3],
  ['perfusion-hidden', 3],
  ['stabilization-sequence', 3],
  ['systems-handoff', 3],
  ['deterioration-recognition', 3],
  ['medication-safety', 3],
  ['escalation-handoff', 3],
  ['sepsis-pattern', 3],
]);
assert(CLINICAL_SIMULATIONS.length === 24, 'the reviewed catalog contains the planned 24 core cases');
assert(new Set(CLINICAL_SIMULATIONS.map((simulation) => simulation.id)).size === CLINICAL_SIMULATIONS.length, 'every reviewed simulation id is unique');
for (const [familyId, expectedCount] of expectedFamilies) {
  assert(
    CLINICAL_SIMULATIONS.filter((simulation) => simulation.variantFamilyId === familyId).length === expectedCount,
    `${familyId} has three reviewed deterministic variations`,
  );
}

for (const simulation of CLINICAL_SIMULATIONS) {
  assert(simulation.reviewed && simulation.version === 1, `${simulation.id} is a versioned reviewed case`);
  assert(simulation.actions.some((action) => action.group === 'assess'), `${simulation.id} has an assessment action`);
  assert(simulation.actions.some((action) => action.group === 'reassess'), `${simulation.id} has a reassessment action`);
  assert(simulation.actions.some((action) => action.unsafe), `${simulation.id} has an authored unsafe path`);

  const caseConfig = {
    difficulty: simulation.difficulty,
    style: simulation.style,
    assistance: 'coach' as const,
    complicationId: simulation.complications[0]?.id,
  };
  let safePath = createSimulationAttempt(simulation, `${simulation.id}-safe`, caseConfig, 24680);
  safePath = { ...safePath, beat: 'assess' };
  while (safePath.status === 'active') {
    const legal = simulation.actions.filter((action) => action.beats.includes(safePath.beat) && !safePath.actionIds.includes(action.id) && !action.unsafe);
    const chosen = legal.find((action) => action.group === 'support') ?? legal[0];
    assert(chosen, `${simulation.id} exposes a safe action during ${safePath.beat}`);
    safePath = applySimulationAction(safePath, simulation, chosen.id);
  }
  const safeCaseDebrief = evaluateSimulation(simulation, safePath);
  assert(safeCaseDebrief.outcome === 'stabilized' && safeCaseDebrief.safety === 'safe', `${simulation.id} safe path stabilizes the patient`);

  let unsafePath = createSimulationAttempt(simulation, `${simulation.id}-unsafe`, caseConfig, 24680);
  unsafePath = { ...unsafePath, beat: 'assess' };
  let unsafeAction = simulation.actions.find((action) => action.unsafe && action.beats.includes(unsafePath.beat));
  while (!unsafeAction && unsafePath.status === 'active') {
    const legal = simulation.actions.filter((action) => action.beats.includes(unsafePath.beat) && !unsafePath.actionIds.includes(action.id) && !action.unsafe);
    const chosen = legal.find((action) => action.group === 'support') ?? legal[0];
    assert(chosen, `${simulation.id} can advance to its authored unsafe choice`);
    unsafePath = applySimulationAction(unsafePath, simulation, chosen.id);
    unsafeAction = simulation.actions.find((action) => action.unsafe && action.beats.includes(unsafePath.beat));
  }
  assert(unsafeAction, `${simulation.id} unsafe option is legal after assessment`);
  unsafePath = applySimulationAction(unsafePath, simulation, unsafeAction.id);
  assert(unsafePath.safety === 'unsafe', `${simulation.id} unsafe route records a permanent safety concern`);
}

let advanced = CLINICAL_SIMULATIONS.find((simulation) => simulation.id === 'sim-adaptive-airway')!;
let complication = createSimulationAttempt(advanced, 'complication-attempt', {
  difficulty: advanced.difficulty, style: advanced.style, assistance: 'coach', complicationId: 'recurrent-wheeze',
}, 12);
complication = { ...complication, beat: 'assess' };
complication = applySimulationAction(complication, advanced, 'assess-recurrence');
// Prioritizing through an escalation rather than the prevention action leaves
// the reviewed recurrent-wheeze branch eligible.
complication = applySimulationAction(complication, advanced, 'prioritize-airway-response');
complication = applySimulationAction(complication, advanced, 'reassess-airway');
assert(complication.complicationTriggered && complication.beat === 'adaptation', 'an authored complication stays on its deterministic branch');
complication = applySimulationAction(complication, advanced, 'adapt-airway-plan');
assert(complication.status === 'completed', 'the authored adaptation resolves the complication route');

assert(CLINICAL_SIMULATIONS.length === 24, 'the reviewed early catalog contains all 24 core simulations');
const families = new Map<string, number>();
for (const simulation of CLINICAL_SIMULATIONS) {
  families.set(simulation.variantFamilyId, (families.get(simulation.variantFamilyId) ?? 0) + 1);
  assert(simulation.reviewed, `${simulation.id} is explicitly reviewed`);
  assert(simulation.actions.some((action) => action.unsafe), `${simulation.id} includes an authored unsafe route`);
}
assert(families.size === 8, 'the catalog groups transfer practice into eight core families');
for (const [family, count] of families) {
  assert(count >= 2 && count <= 3, `${family} has two or three deterministic variations`);
}
for (const domain of ['airway', 'assessment', 'stabilization', 'pharmacology', 'judgment', 'systems']) {
  assert(CLINICAL_SIMULATIONS.some((simulation) => simulation.domain === domain), `${domain} has reviewed coverage`);
}
for (const style of ['guided', 'focused', 'transfer']) {
  assert(CLINICAL_SIMULATIONS.some((simulation) => simulation.style === style), `${style} has reviewed coverage`);
}

for (const simulationId of EXPANDED_SIMULATION_IDS) {
  const simulation = CLINICAL_SIMULATIONS.find((candidate) => candidate.id === simulationId);
  assert(simulation, `${simulationId} is registered in the reviewed catalog`);
  const caseConfig = {
    difficulty: simulation.difficulty,
    style: simulation.style,
    assistance: 'coach' as const,
  };
  const actionFor = (group: 'assess' | 'support' | 'reassess' | 'treat') =>
    simulation.actions.find((action) => action.group === group)!;

  let caseSafe = createSimulationAttempt(simulation, `${simulationId}-safe`, caseConfig, 4001);
  caseSafe = { ...caseSafe, beat: 'assess' };
  caseSafe = applySimulationAction(caseSafe, simulation, actionFor('assess').id);
  assert(caseSafe.known.length === 1 && caseSafe.patient.hiddenFindings.length === 0, `${simulationId} reveals only its authored finding`);
  caseSafe = applySimulationAction(caseSafe, simulation, actionFor('support').id);
  caseSafe = applySimulationAction(caseSafe, simulation, actionFor('reassess').id);
  const caseDebrief = evaluateSimulation(simulation, caseSafe);
  assert(caseSafe.status === 'completed' && caseDebrief.outcome === 'stabilized', `${simulationId} safe path reaches a stable outcome`);

  let caseUnsafe = createSimulationAttempt(simulation, `${simulationId}-unsafe`, caseConfig, 4001);
  caseUnsafe = { ...caseUnsafe, beat: 'assess' };
  caseUnsafe = applySimulationAction(caseUnsafe, simulation, actionFor('assess').id);
  caseUnsafe = applySimulationAction(caseUnsafe, simulation, actionFor('treat').id);
  assert(caseUnsafe.safety === 'unsafe' && caseUnsafe.patient.stability < simulation.initialState.stability, `${simulationId} unsafe path stays visibly unsafe`);
}

for (const legacySimulation of SIMULATIONS) {
  assert(resolveSimulationRoute(legacySimulation.id) === 'legacy', `${legacySimulation.id} preserves the legacy Department completion flow`);
}
for (const clinicalSimulation of CLINICAL_SIMULATIONS) {
  assert(resolveSimulationRoute(clinicalSimulation.id) === 'clinical', `${clinicalSimulation.id} opens the Clinical Simulation Lab`);
}
assert(resolveSimulationRoute('clinical') === 'clinical', 'the stable Lab selector route opens the Clinical Simulation Lab');
assert(resolveSimulationRoute('missing-simulation') === 'unknown', 'unknown IDs never fall back to a different simulation');

console.log('clinical_simulation: deterministic state, 24 reviewed cases, safe/unsafe paths, route ownership, hidden data, safety, branch identity, and completion passed');