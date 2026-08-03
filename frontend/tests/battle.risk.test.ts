// River Surge risk penalty — integration tests
// Verifies that the ifSystem risk block in applySkill fires against a Fluid / Hydration
// enemy (Cardion Echo) and is suppressed for non-matching affinities.
// Run: npx sucrase-node tests/battle.risk.test.ts

import { applySkill, initBattle } from '../src/game/battle';
import { ENEMIES, HEROES } from '../src/game/content';
import type { Enemy, HeroSkill } from '../src/game/types';

// ── Test harness ──────────────────────────────────────────────────────────────
type Result = { name: string; pass: boolean; details?: string };
const results: Result[] = [];

function check(name: string, cond: boolean, details = '') {
  results.push({ name, pass: !!cond, details });
  console.log(`${cond ? 'PASS' : 'FAIL'} – ${name}${cond ? '' : ` :: ${details}`}`);
}

// ── Shared fixtures ───────────────────────────────────────────────────────────

// storm_runner owns river_surge in content.ts; any hero works for the risk block
// (the block reads skill.risk, not hero-specific state).
const stormRunner = HEROES.find(h => h.id === 'storm_runner');

// river_surge WITHOUT ranges so strike/stabilize are fixed (deterministic).
const RIVER_SURGE_FIXED: HeroSkill = {
  id: 'river_surge',
  name: 'River Surge',
  type: 'strike',
  systemType: 'River',
  cost: 2,
  description: 'Strike 20 + stabilize 12. Risk: heart failure.',
  shortEffect: 'River • +12 Stability · −20 Corruption',
  strike: 20,
  stabilize: 12,
  risk: {
    ifSystem: 'Fluid / Hydration',
    penalty: 20,
    description: 'Aggressive fluids worsen pulmonary edema in Cardion.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — river_surge skill definition sanity checks
// ─────────────────────────────────────────────────────────────────────────────
{
  check('Test 1a – storm_runner exists in HEROES',
    !!stormRunner, 'storm_runner not found');

  const skill = stormRunner?.skills.find(s => s.id === 'river_surge');
  check('Test 1b – river_surge skill exists on storm_runner',
    !!skill, 'river_surge not found on storm_runner');

  check('Test 1c – river_surge risk.ifSystem = "Fluid / Hydration"',
    skill?.risk?.ifSystem === 'Fluid / Hydration',
    `got: ${skill?.risk?.ifSystem}`);

  check('Test 1d – river_surge risk.penalty = 20',
    skill?.risk?.penalty === 20,
    `got: ${skill?.risk?.penalty}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — Cardion Echo (Fluid / Hydration primary) data checks
// ─────────────────────────────────────────────────────────────────────────────
{
  const cardion = ENEMIES.find(e => e.id === 'cardion_echo');
  check('Test 2a – cardion_echo exists in ENEMIES',
    !!cardion, 'cardion_echo not found');

  check('Test 2b – cardion_echo primaryAffinity = "Fluid / Hydration"',
    cardion?.primaryAffinity === 'Fluid / Hydration',
    `got: ${cardion?.primaryAffinity}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — Risk penalty fires against Fluid / Hydration primary affinity enemy
//
// Setup: cardion_echo (primaryAffinity: 'Fluid / Hydration')
//        river_surge (risk.ifSystem: 'Fluid / Hydration', penalty: 20)
//
// Expected: final stability = stabilityBefore + stabilizeGain - risk.penalty
//   where stabilizeGain comes from the skill's stabilize field.
// We verify this by comparing final stability to a matched control that has
// no risk (non-Fluid enemy), then asserting the difference equals the penalty.
// ─────────────────────────────────────────────────────────────────────────────
{
  const cardion = ENEMIES.find(e => e.id === 'cardion_echo');

  if (!stormRunner || !cardion) {
    check('Test 3 – setup: storm_runner + cardion_echo found', false,
      `stormRunner=${!!stormRunner}, cardion=${!!cardion}`);
  } else {
    // Use high corruption so the strike doesn't deplete the enemy (which would
    // clamp corruption at 0 and mask the stability change we're testing).
    const cardionHigh: Enemy = { ...cardion, corruption: 500 };

    // Non-matching control: same enemy shape but primaryAffinity != Fluid/Hydration.
    const nonFluidEnemy: Enemy = {
      ...cardionHigh,
      primaryAffinity: 'Storm / Cardiac',
      secondaryAffinities: [],
    };

    const stateFluid    = initBattle(cardionHigh,   [stormRunner], { chapter: 3, inventory: {} });
    const stateNonFluid = initBattle(nonFluidEnemy, [stormRunner], { chapter: 3, inventory: {} });

    const afterFluid    = applySkill(stateFluid,    RIVER_SURGE_FIXED, stormRunner);
    const afterNonFluid = applySkill(stateNonFluid, RIVER_SURGE_FIXED, stormRunner);

    // Both states start at the same stability (cardion.startingStability = 50).
    // The stabilize gain is identical in both cases (same skill, same starting stability).
    // Only difference: the Fluid case gets -20 penalty.
    const stabilityFluid    = afterFluid.state.stability;
    const stabilityNonFluid = afterNonFluid.state.stability;
    const penaltyObserved   = stabilityNonFluid - stabilityFluid;

    check(
      'Test 3a – Risk penalty fires: Fluid enemy stability is lower than non-Fluid enemy',
      stabilityFluid < stabilityNonFluid,
      `fluid=${stabilityFluid}, nonFluid=${stabilityNonFluid}`,
    );

    check(
      'Test 3b – Risk penalty magnitude = 20 (skill.risk.penalty)',
      penaltyObserved === 20,
      `observed diff=${penaltyObserved}, expected=20`,
    );

    // The log must contain the risk warning.
    const riskLog = afterFluid.state.log.find(l => l.includes('Risk triggered'));
    check(
      'Test 3c – Log contains "Risk triggered" message for Fluid enemy',
      !!riskLog,
      `log: ${afterFluid.state.log.slice(-5).join(' | ')}`,
    );

    // Non-Fluid enemy must NOT have a risk log entry.
    const riskLogNonFluid = afterNonFluid.state.log.find(l => l.includes('Risk triggered'));
    check(
      'Test 3d – No "Risk triggered" log for non-Fluid enemy',
      !riskLogNonFluid,
      `unexpected: ${riskLogNonFluid}`,
    );

    // unsafeActionsUsed counter must include the risk-fired increment for the Fluid case.
    // (The non-Fluid case may also increment from the clinical-appropriateness scorer
    // if river_surge is rated unsafe for a non-Fluid enemy — that is a separate counter path.)
    check(
      'Test 3e – unsafeActionsUsed increments when risk fires',
      afterFluid.state.unsafeActionsUsed > stateFluid.unsafeActionsUsed,
      `before=${stateFluid.unsafeActionsUsed}, after=${afterFluid.state.unsafeActionsUsed}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — Risk also fires when Fluid / Hydration is a secondaryAffinity
//
// The risk block reads:
//   skill.risk.ifSystem === primaryAffinity || secondaryAffinities.includes(ifSystem)
// Verify the secondary branch works independently.
// ─────────────────────────────────────────────────────────────────────────────
{
  const cardion = ENEMIES.find(e => e.id === 'cardion_echo');

  if (!stormRunner || !cardion) {
    check('Test 4 – setup: storm_runner + cardion_echo found', false,
      `stormRunner=${!!stormRunner}, cardion=${!!cardion}`);
  } else {
    // Enemy whose PRIMARY is something else, but Fluid/Hydration is secondary.
    const secondaryFluidEnemy: Enemy = {
      ...cardion,
      corruption: 500,
      primaryAffinity: 'Storm / Cardiac',
      secondaryAffinities: ['Fluid / Hydration'],
    };

    // Control: neither primary nor secondary matches.
    const noFluidEnemy: Enemy = {
      ...cardion,
      corruption: 500,
      primaryAffinity: 'Storm / Cardiac',
      secondaryAffinities: ['Fire / Inflammation'],
    };

    const stateSecFluid = initBattle(secondaryFluidEnemy, [stormRunner], { chapter: 3, inventory: {} });
    const stateNoFluid  = initBattle(noFluidEnemy,        [stormRunner], { chapter: 3, inventory: {} });

    const afterSecFluid = applySkill(stateSecFluid, RIVER_SURGE_FIXED, stormRunner);
    const afterNoFluid  = applySkill(stateNoFluid,  RIVER_SURGE_FIXED, stormRunner);

    const diff = afterNoFluid.state.stability - afterSecFluid.state.stability;

    check(
      'Test 4a – Risk fires when Fluid / Hydration is in secondaryAffinities',
      diff === 20,
      `observed diff=${diff}, expected=20`,
    );

    check(
      'Test 4b – No risk when Fluid / Hydration absent from both primary and secondary',
      !afterNoFluid.state.log.find(l => l.includes('Risk triggered')),
      `unexpected risk log found`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 — Risk does NOT fire for non-Fluid enemies (spot-check a few)
// ─────────────────────────────────────────────────────────────────────────────
{
  if (!stormRunner) {
    check('Test 5 – setup: storm_runner found', false, 'storm_runner not found');
  } else {
    // fever_shade has secondaryAffinities: ['Fluid / Hydration'] so risk fires there (correct).
    // Only test enemies with no Fluid / Hydration in primary OR secondary.
    const nonFluidIds = ['gale_spirit', 'verdantha', 'glycora_spark'];
    for (const id of nonFluidIds) {
      const enemy = ENEMIES.find(e => e.id === id);
      if (!enemy) {
        check(`Test 5 – ${id} found in ENEMIES`, false, `${id} not found`);
        continue;
      }
      const state = initBattle({ ...enemy, corruption: 500 } as Enemy, [stormRunner], { chapter: 3, inventory: {} });
      const after = applySkill(state, RIVER_SURGE_FIXED, stormRunner);
      const hasRisk = !!after.state.log.find(l => l.includes('Risk triggered'));
      check(
        `Test 5 – No risk penalty vs ${enemy.name} (primaryAffinity: ${enemy.primaryAffinity})`,
        !hasRisk,
        `unexpected risk log for ${id}`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;
console.log(`\n── Summary: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
