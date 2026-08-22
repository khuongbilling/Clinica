import {
  PLAYER_HERO_ARTIFACT_RECIPES,
  potentialFromBasisPoints,
  validateLawOfEquilibrium,
  validatePlayerHeroStats,
} from "../src/game/playerHero";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const validStats = { insight: 5, carePower: 5, intervention: 5, guard: 5, coordination: 5 };
assert(validatePlayerHeroStats(validStats).length === 0, "valid five-stat allocation should pass");
assert(validatePlayerHeroStats({ ...validStats, insight: 11, carePower: 4 }).length > 0, "out-of-range stat must fail");
assert(validatePlayerHeroStats({ ...validStats, insight: 4 }).length > 0, "allocation below 25 must fail");

assert(validateLawOfEquilibrium({
  activeStrongEffects: 1, counterTags: ["standard_signature"],
  amplificationCap: 0.25, mitigationCap: 0.25, freeActionCap: 0,
}).length === 0, "baseline equilibrium must pass");
assert(validateLawOfEquilibrium({
  activeStrongEffects: 2, counterTags: [], amplificationCap: 0.3, mitigationCap: 0.3, freeActionCap: 1,
}).length === 4, "stacking/free-action budget abuse must fail");

for (const recipe of Object.values(PLAYER_HERO_ARTIFACT_RECIPES)) {
  assert(recipe.fragmentId.startsWith("player_hero_"), "artifact families require Player Hero-only fragments");
  assert(recipe.fragmentsRequired > 0, "artifact recipe needs a positive family-specific ratio");
}

// One million deterministic profiles: cycling every basis-point roll gives an
// exact, reproducible distribution without relying on client or Math.random.
const counts = { standard: 0, prodigy: 0, convergence: 0 };
for (let i = 0; i < 1_000_000; i++) counts[potentialFromBasisPoints(i % 10_000)]++;
assert(counts.standard === 940_000, `standard distribution drifted: ${counts.standard}`);
assert(counts.prodigy === 50_000, `prodigy distribution drifted: ${counts.prodigy}`);
assert(counts.convergence === 10_000, `convergence distribution drifted: ${counts.convergence}`);

console.log("player_hero_foundation: contracts, stacking caps, namespaces, and 1M potential distribution passed");