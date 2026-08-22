import {
  applySimulationAction,
  CLINICAL_SIMULATIONS,
  createSimulationAttempt,
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

for (const legacySimulation of SIMULATIONS) {
  assert(resolveSimulationRoute(legacySimulation.id) === 'legacy', `${legacySimulation.id} preserves the legacy Department completion flow`);
}
for (const clinicalSimulation of CLINICAL_SIMULATIONS) {
  assert(resolveSimulationRoute(clinicalSimulation.id) === 'clinical', `${clinicalSimulation.id} opens the Clinical Simulation Lab`);
}
assert(resolveSimulationRoute('missing-simulation') === 'unknown', 'unknown IDs never fall back to a different simulation');

console.log('clinical_simulation: deterministic state, route ownership, hidden data, safety, branch identity, and completion passed');