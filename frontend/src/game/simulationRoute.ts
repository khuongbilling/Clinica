import { getClinicalSimulation } from './clinicalSimulation';
import { getSimulation } from './lessons';

export type SimulationRouteKind = 'legacy' | 'clinical' | 'unknown';

/**
 * Department simulations and the new Clinical Simulation Lab deliberately
 * share the dynamic URL, but they do not share completion rules. Resolve the
 * authored ID before rendering so legacy cards can never fall through to a
 * recommended Lab case.
 */
export function resolveSimulationRoute(id: string): SimulationRouteKind {
  if (getSimulation(id)) return 'legacy';
  // The Lab is a selector, not a single case. This explicit sentinel is used by
  // the registry's stable route and never falls through to an unavailable case.
  if (id === 'clinical') return 'clinical';
  if (getClinicalSimulation(id)) return 'clinical';
  return 'unknown';
}