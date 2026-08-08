/**
 * tests/threats.test.ts — Multi-threat domain model (Push 5)
 *
 * Tests for frontend/src/game/threats.ts
 *
 * Coverage:
 *  1–5:    makeThreat — construction, defaults, clamping
 *  6–10:   makeThreat — speed clamping, resolved auto-detection
 *  11–14:  threatFromEnemy — field mapping
 *  15–18:  buildThreats — role assignment, max-3 cap
 *  19–23:  isThreatResolved / isRequiredThreat
 *  24–28:  allRequiredResolved
 *  29–34:  isVictory / isFailure
 *  35–38:  activeThreatCount / pendingThreats
 *  39–43:  threatsInTurnOrder
 *  44–52:  applyCorruptionDelta — damage, healing, resistance, shield, clamp
 *  53–57:  setThreatIntent / revealThreat / activateThreat / syncResolved
 *  58–78:  validateThreats — all invariants
 */

import {
  makeThreat,
  threatFromEnemy,
  buildThreats,
  isThreatResolved,
  isRequiredThreat,
  allRequiredResolved,
  isVictory,
  isFailure,
  activeThreatCount,
  pendingThreats,
  threatsInTurnOrder,
  applyCorruptionDelta,
  setThreatIntent,
  revealThreat,
  activateThreat,
  syncResolved,
  validateThreats,
  MAX_THREATS,
  MIN_SPEED,
  MAX_SPEED,
  DEFAULT_THREAT_MODIFIERS,
  type Threat,
  type ThreatRole,
  type ThreatIntent,
} from '../src/game/threats';
import type { Enemy } from '../src/game/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, value: boolean): void {
  if (value) {
    passed++;
    console.log(`PASS - ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.error(`FAIL - ${label}`);
  }
}

function eq<T>(a: T, b: T, label: string): void {
  check(label, a === b);
}

/** Minimal valid Enemy stub for testing threatFromEnemy / buildThreats. */
function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id:                  'test-enemy-001',
    name:                'Test Pathogen',
    realWorld:           'Test Infection',
    difficulty:          3,
    visibleClues:        [],
    hiddenClues:         [],
    dangerTrigger:       'spread',
    bestCounters:        ['stabilize'],
    instability:         4,
    startingStability:   80,
    corruption:          60,
    corruptionAspect:    'Necrosis',
    weakElement:         null,
    secondaryAffinities: [],
    teaches:             [],
    ...overrides,
  } as Enemy;
}

/** Shorthand: make a resolved threat (corruptionCurrent = 0). */
function resolvedThreat(role: ThreatRole = 'acute'): Threat {
  return makeThreat({ id: `resolved-${role}`, name: 'Resolved', corruptionMax: 50, corruptionCurrent: 0, role });
}

/** Shorthand: make an unresolved threat. */
function activeThreat(role: ThreatRole = 'acute', id = `active-${role}`): Threat {
  return makeThreat({ id, name: 'Active', corruptionMax: 50, corruptionCurrent: 30, role });
}

// ── 1–5: makeThreat construction ─────────────────────────────────────────────

console.log('\n── makeThreat: construction ──');

{
  const t = makeThreat({ id: 'a', name: 'Alpha', corruptionMax: 80 });

  eq(t.id,               'a',      '1. id is set');
  eq(t.name,             'Alpha',  '2. name is set');
  eq(t.corruptionMax,    80,       '3. corruptionMax is set');
  eq(t.corruptionCurrent, 80,      '4. corruptionCurrent defaults to corruptionMax');
  eq(t.role,             'acute',  '5. role defaults to acute');
}

// ── 6–10: makeThreat defaults and clamping ────────────────────────────────────

console.log('\n── makeThreat: defaults and clamping ──');

{
  const t = makeThreat({ id: 'b', name: 'Beta', corruptionMax: 100 });
  eq(t.speed,   5,              '6. speed defaults to 5');
  eq(t.hidden,  false,          '7. hidden defaults to false');
  eq(t.latent,  false,          '8. latent defaults to false');
  eq(t.resolved, false,         '9. resolved defaults to false when corruptionCurrent > 0');
  check('10. intent defaults to idle', t.intent.kind === 'idle');
}

// ── makeThreat clamping ───────────────────────────────────────────────────────

{
  const over = makeThreat({ id: 'c', name: 'C', corruptionMax: 50, corruptionCurrent: 999 });
  eq(over.corruptionCurrent, 50, '11. corruptionCurrent clamped to corruptionMax');

  const under = makeThreat({ id: 'd', name: 'D', corruptionMax: 50, corruptionCurrent: -10 });
  eq(under.corruptionCurrent, 0,   '12. corruptionCurrent clamped to 0 (negative)');

  const fast = makeThreat({ id: 'e', name: 'E', corruptionMax: 10, speed: 99 });
  eq(fast.speed, MAX_SPEED,         '13. speed clamped to MAX_SPEED');

  const slow = makeThreat({ id: 'f', name: 'F', corruptionMax: 10, speed: -5 });
  eq(slow.speed, MIN_SPEED,         '14. speed clamped to MIN_SPEED');
}

// ── resolved auto-detection ───────────────────────────────────────────────────

{
  const t = makeThreat({ id: 'g', name: 'G', corruptionMax: 50, corruptionCurrent: 0 });
  eq(t.resolved, true, '15. resolved is true when corruptionCurrent is 0');

  // Explicit override respected
  const explicit = makeThreat({ id: 'h', name: 'H', corruptionMax: 50, corruptionCurrent: 10, resolved: true });
  eq(explicit.resolved, true, '16. explicit resolved override is accepted');
}

// ── modifiers merge ───────────────────────────────────────────────────────────

{
  const t = makeThreat({
    id: 'i', name: 'I', corruptionMax: 50,
    modifiers: { corruptionResistance: 0.3, shielded: true },
  });
  eq(t.modifiers.corruptionResistance, 0.3,  '17. partial modifiers override merges correctly');
  eq(t.modifiers.shielded,             true, '18. partial modifiers: shielded set');
  eq(t.modifiers.spreadChance,         0,    '19. partial modifiers: unset fields use defaults');
}

// ── 11–14: threatFromEnemy ────────────────────────────────────────────────────

console.log('\n── threatFromEnemy ──');

{
  const enemy  = makeEnemy({ id: 'pneumonia', name: 'Pneumonia', corruption: 75, instability: 6 });
  const threat = threatFromEnemy(enemy);

  eq(threat.id,               'pneumonia',  '20. id maps from enemy.id');
  eq(threat.name,             'Pneumonia',  '21. name maps from enemy.name');
  eq(threat.corruptionMax,    75,           '22. corruptionMax maps from enemy.corruption');
  eq(threat.corruptionCurrent, 75,          '23. corruptionCurrent initialised to corruptionMax');
  eq(threat.speed,             6,           '24. speed maps from enemy.instability');
  eq(threat.role,              'acute',     '25. role defaults to acute');
  eq(threat.resolved,          false,       '26. resolved is false at start');

  const prog = threatFromEnemy(enemy, 'progressive');
  eq(prog.role, 'progressive', '27. explicit role argument is used');
}

// ── 15–18: buildThreats ───────────────────────────────────────────────────────

console.log('\n── buildThreats ──');

{
  const e1 = makeEnemy({ id: 'e1', name: 'E1' });
  const e2 = makeEnemy({ id: 'e2', name: 'E2' });
  const e3 = makeEnemy({ id: 'e3', name: 'E3' });
  const e4 = makeEnemy({ id: 'e4', name: 'E4' });

  const two = buildThreats([e1, e2]);
  eq(two.length, 2,              '28. buildThreats returns correct count for 2 enemies');
  eq(two[0].role, 'acute',       '29. first enemy gets role acute');
  eq(two[1].role, 'progressive', '30. second enemy gets role progressive');

  const three = buildThreats([e1, e2, e3]);
  eq(three[2].role, 'disruptor', '31. third enemy gets role disruptor');

  const capped = buildThreats([e1, e2, e3, e4]);
  eq(capped.length, MAX_THREATS, '32. buildThreats caps at MAX_THREATS');

  const custom = buildThreats([e1, e2], ['barrier', 'risk']);
  eq(custom[0].role, 'barrier',  '33. custom roles: first slot');
  eq(custom[1].role, 'risk',     '34. custom roles: second slot');
}

// ── 19–23: isThreatResolved / isRequiredThreat ────────────────────────────────

console.log('\n── isThreatResolved / isRequiredThreat ──');

{
  const res  = resolvedThreat('acute');
  const act  = activeThreat('acute');
  const lat  = makeThreat({ id: 'lat', name: 'L', corruptionMax: 50, corruptionCurrent: 30, latent: true, role: 'acute' });

  check('35. isThreatResolved true when corruption = 0',  isThreatResolved(res));
  check('36. isThreatResolved false when corruption > 0', !isThreatResolved(act));

  check('37. acute is required',                    isRequiredThreat(activeThreat('acute')));
  check('38. progressive is required',              isRequiredThreat(activeThreat('progressive')));
  check('39. disruptor is required',                isRequiredThreat(activeThreat('disruptor')));
  check('40. risk is NOT required',                 !isRequiredThreat(activeThreat('risk')));
  check('41. barrier is NOT required',              !isRequiredThreat(activeThreat('barrier')));
  check('42. latent acute is NOT required',         !isRequiredThreat(lat));
}

// ── 24–28: allRequiredResolved ────────────────────────────────────────────────

console.log('\n── allRequiredResolved ──');

{
  // Single required threat resolved
  check('43. single resolved acute → allRequiredResolved true',
    allRequiredResolved([resolvedThreat('acute')]));

  // Two required, both resolved
  check('44. two resolved required threats → true',
    allRequiredResolved([resolvedThreat('acute'), resolvedThreat('progressive')]));

  // One unresolved required
  check('45. one unresolved required threat → false',
    !allRequiredResolved([resolvedThreat('acute'), activeThreat('progressive')]));

  // Optional (risk) unresolved but all required resolved
  check('46. optional risk unresolved, required resolved → true',
    allRequiredResolved([resolvedThreat('acute'), activeThreat('risk')]));

  // Latent required threat is ignored
  const latentAcute = makeThreat({ id: 'la', name: 'L', corruptionMax: 50, corruptionCurrent: 40, latent: true, role: 'acute' });
  check('47. latent required threat does not block resolution',
    allRequiredResolved([latentAcute]));
}

// ── 29–34: isVictory / isFailure ─────────────────────────────────────────────

console.log('\n── isVictory / isFailure ──');

{
  const threats = [resolvedThreat('acute'), resolvedThreat('progressive')];

  check('48. victory: all required resolved + stability > 0',
    isVictory(threats, 40));
  check('49. no victory when stability = 0',
    !isVictory(threats, 0));
  check('50. no victory when stability < 0',
    !isVictory(threats, -5));
  check('51. no victory when required threat unresolved',
    !isVictory([activeThreat('acute')], 80));
  check('52. victory with optional threat unresolved',
    isVictory([resolvedThreat('acute'), activeThreat('risk')], 50));

  check('53. isFailure true when stability = 0',   isFailure(0));
  check('54. isFailure true when stability < 0',   isFailure(-1));
  check('55. isFailure false when stability = 1',  !isFailure(1));
  check('56. isFailure false when stability > 0',  !isFailure(100));
}

// ── 35–38: activeThreatCount / pendingThreats ─────────────────────────────────

console.log('\n── activeThreatCount / pendingThreats ──');

{
  const t1 = activeThreat('acute');
  const t2 = activeThreat('progressive', 'active-prog');
  const res = resolvedThreat('disruptor');
  const lat = makeThreat({ id: 'lat2', name: 'L', corruptionMax: 50, corruptionCurrent: 30, latent: true, role: 'risk' });

  eq(activeThreatCount([t1, t2, res, lat]), 3, '57. activeThreatCount excludes latent');
  eq(activeThreatCount([lat]),             0, '58. activeThreatCount = 0 if only latent threats');

  const pending = pendingThreats([t1, t2, res, lat]);
  eq(pending.length, 2, '59. pendingThreats excludes resolved and latent');
  check('60. pendingThreats contains only unresolved active threats',
    pending.every(t => !t.resolved && !t.latent));
}

// ── 39–43: threatsInTurnOrder ─────────────────────────────────────────────────

console.log('\n── threatsInTurnOrder ──');

{
  const slow   = makeThreat({ id: 's', name: 'S', corruptionMax: 50, speed: 2 });
  const medium = makeThreat({ id: 'm', name: 'M', corruptionMax: 50, speed: 5 });
  const fast   = makeThreat({ id: 'f', name: 'F', corruptionMax: 50, speed: 8 });

  const ordered = threatsInTurnOrder([slow, medium, fast]);
  eq(ordered[0].id, 'f', '61. fastest threat acts first');
  eq(ordered[1].id, 'm', '62. medium speed second');
  eq(ordered[2].id, 's', '63. slowest acts last');

  // Tie-breaking: original order preserved
  const tieA = makeThreat({ id: 'tA', name: 'A', corruptionMax: 50, speed: 5 });
  const tieB = makeThreat({ id: 'tB', name: 'B', corruptionMax: 50, speed: 5 });
  const tied = threatsInTurnOrder([tieA, tieB]);
  eq(tied[0].id, 'tA', '64. equal speed: original order preserved');

  // Original array unchanged (immutable)
  const original = [slow, fast, medium];
  threatsInTurnOrder(original);
  eq(original[0].id, 's', '65. threatsInTurnOrder does not mutate input array');
}

// ── 44–52: applyCorruptionDelta ───────────────────────────────────────────────

console.log('\n── applyCorruptionDelta ──');

{
  const base = makeThreat({ id: 'base', name: 'B', corruptionMax: 100, corruptionCurrent: 60 });

  // Damage (negative delta)
  const damaged = applyCorruptionDelta(base, -20);
  eq(damaged.corruptionCurrent, 40,    '66. damage reduces corruptionCurrent');
  eq(base.corruptionCurrent,    60,    '67. original threat not mutated by damage');

  // Heal (positive delta)
  const healed = applyCorruptionDelta(damaged, 10);
  eq(healed.corruptionCurrent, 50,     '68. healing increases corruptionCurrent');

  // Heal capped at max
  const overHeal = applyCorruptionDelta(base, 500);
  eq(overHeal.corruptionCurrent, 100,  '69. healing clamped to corruptionMax');

  // Damage to zero → resolved
  const killed = applyCorruptionDelta(base, -100);
  eq(killed.corruptionCurrent, 0,      '70. damage to zero: corruptionCurrent = 0');
  eq(killed.resolved,          true,   '71. damage to zero: resolved = true');

  // Damage not below zero
  const overDmg = applyCorruptionDelta(base, -200);
  eq(overDmg.corruptionCurrent, 0,     '72. damage cannot go below 0');

  // Corruption resistance dampens damage
  const resistant = makeThreat({
    id: 'res', name: 'R', corruptionMax: 100, corruptionCurrent: 80,
    modifiers: { corruptionResistance: 0.5 },
  });
  const resHit = applyCorruptionDelta(resistant, -40);
  eq(resHit.corruptionCurrent, 60,     '73. 50% resistance halves damage (80 - 20 = 60)');

  // Healing bypasses resistance
  const resHeal = applyCorruptionDelta(resistant, 10);
  eq(resHeal.corruptionCurrent, 90,    '74. healing is not reduced by resistance');

  // Shield absorbs hit
  const shielded = makeThreat({
    id: 'sh', name: 'S', corruptionMax: 100, corruptionCurrent: 80,
    modifiers: { shielded: true },
  });
  const absorbed = applyCorruptionDelta(shielded, -30);
  eq(absorbed.corruptionCurrent, 80,     '75. shield absorbs damage (HP unchanged)');
  eq(absorbed.modifiers.shielded, false, '76. shield is consumed after absorb');

  // Shield does not block healing
  const healShielded = applyCorruptionDelta(shielded, 10);
  eq(healShielded.corruptionCurrent, 90, '77. shield does not block healing');
  eq(healShielded.modifiers.shielded, true, '78. shield not consumed by healing');
}

// ── 53–57: intent / reveal / activate / syncResolved ─────────────────────────

console.log('\n── setThreatIntent / revealThreat / activateThreat / syncResolved ──');

{
  const base = makeThreat({ id: 'x', name: 'X', corruptionMax: 50, corruptionCurrent: 30 });

  // setThreatIntent
  const surging: ThreatIntent = { kind: 'surge', magnitude: 15 };
  const intented = setThreatIntent(base, surging);
  check('79. setThreatIntent changes intent', intented.intent.kind === 'surge');
  eq(base.intent.kind, 'idle', '80. original not mutated by setThreatIntent');

  // revealThreat
  const hidden = makeThreat({ id: 'h', name: 'H', corruptionMax: 50, hidden: true });
  const revealed = revealThreat(hidden);
  eq(revealed.hidden, false, '81. revealThreat sets hidden = false');
  eq(hidden.hidden,   true,  '82. original not mutated by revealThreat');
  const alreadyVisible = revealThreat(base);
  check('83. revealThreat on already-visible threat returns same ref', alreadyVisible === base);

  // activateThreat
  const latent = makeThreat({ id: 'lat', name: 'L', corruptionMax: 50, latent: true });
  const activated = activateThreat(latent);
  eq(activated.latent, false, '84. activateThreat sets latent = false');
  eq(latent.latent,    true,  '85. original not mutated by activateThreat');
  const alreadyActive = activateThreat(base);
  check('86. activateThreat on already-active threat returns same ref', alreadyActive === base);

  // syncResolved
  const inconsistent = { ...base, resolved: true }; // resolved but corruption > 0
  const synced = syncResolved(inconsistent);
  eq(synced.resolved, false, '87. syncResolved corrects resolved=true when corruption > 0');
  const consistent = syncResolved(base);
  check('88. syncResolved on consistent threat returns same ref', consistent === base);
}

// ── 58–78: validateThreats ────────────────────────────────────────────────────

console.log('\n── validateThreats ──');

{
  // Valid single threat
  const valid = [activeThreat('acute')];
  eq(validateThreats(valid).length, 0, '89. valid single threat: no errors');

  // Valid 3-threat array
  const three = [
    activeThreat('acute'),
    activeThreat('progressive', 'active-prog'),
    activeThreat('disruptor',   'active-dis'),
  ];
  eq(validateThreats(three).length, 0, '90. valid 3-threat array: no errors');

  // Too many threats
  const tooMany = [
    activeThreat('acute'),
    activeThreat('progressive', 'p'),
    activeThreat('disruptor',   'd'),
    activeThreat('risk',        'r'),
  ];
  const tmErrors = validateThreats(tooMany);
  check('91. too many threats: has error', tmErrors.length > 0);
  check('92. too many threats: error mentions count',
    tmErrors.some(e => e.includes('Too many')));

  // Duplicate id
  const dup = [activeThreat('acute'), activeThreat('progressive', 'active-acute')];
  // Both have id 'active-acute' now
  const dupT = makeThreat({ id: 'dup', name: 'D', corruptionMax: 50, corruptionCurrent: 30 });
  const dupArr = [dupT, { ...dupT, role: 'progressive' as ThreatRole }];
  check('93. duplicate ids: has error', validateThreats(dupArr).some(e => e.includes('duplicate')));

  // corruptionMax = 0
  const zeroMax = makeThreat({ id: 'zm', name: 'Z', corruptionMax: 0 });
  check('94. corruptionMax = 0: has error',
    validateThreats([zeroMax]).some(e => e.includes('corruptionMax')));

  // corruptionCurrent > corruptionMax (manually constructed)
  const overLoaded: Threat = { ...activeThreat('acute'), corruptionCurrent: 200 };
  check('95. corruptionCurrent > corruptionMax: has error',
    validateThreats([overLoaded]).some(e => e.includes('corruptionCurrent')));

  // Speed out of range
  const badSpeed = { ...activeThreat('acute'), speed: 0 };
  check('96. speed out of range: has error',
    validateThreats([badSpeed as Threat]).some(e => e.includes('speed')));

  // corruptionResistance out of range
  const badResist = makeThreat({ id: 'br', name: 'BR', corruptionMax: 50, modifiers: { corruptionResistance: 1.5 } });
  check('97. corruptionResistance > 1: has error',
    validateThreats([badResist]).some(e => e.includes('corruptionResistance')));

  // spreadChance out of range
  const badSpread = makeThreat({ id: 'bs', name: 'BS', corruptionMax: 50, modifiers: { spreadChance: -0.1 } });
  check('98. spreadChance < 0: has error',
    validateThreats([badSpread]).some(e => e.includes('spreadChance')));

  // Two acute threats
  const twoAcute = [activeThreat('acute'), activeThreat('acute', 'acute-2')];
  check('99. two acute threats: has error',
    validateThreats(twoAcute).some(e => e.includes("'acute'")));

  // resolved inconsistency
  const inconsistent: Threat = { ...activeThreat('acute'), resolved: true };
  check('100. resolved inconsistency: has error',
    validateThreats([inconsistent]).some(e => e.includes('resolved')));

  // resolved threat is valid (corruptionCurrent = 0, resolved = true)
  const validResolved = resolvedThreat('acute');
  eq(validateThreats([validResolved]).length, 0, '101. resolved threat with corruption=0: no errors');

  // Mixed valid: one required resolved, one optional active
  const mixed = [resolvedThreat('acute'), activeThreat('risk', 'risk-1')];
  eq(validateThreats(mixed).length, 0, '102. mixed valid: no errors');
}

// ── Intents coverage (discriminated union) ────────────────────────────────────

console.log('\n── ThreatIntent exhaustiveness ──');

{
  const intents: ThreatIntent[] = [
    { kind: 'idle' },
    { kind: 'surge',    magnitude: 10 },
    { kind: 'corrupt',  magnitude: 5  },
    { kind: 'spread'                   },
    { kind: 'spread',   targetThreatId: 'other-threat' },
    { kind: 'escalate'                 },
    { kind: 'disrupt',  targetRole: 'acute' },
  ];

  for (const intent of intents) {
    const t = setThreatIntent(activeThreat('acute'), intent);
    check(`103. intent '${intent.kind}' round-trips through setThreatIntent`,
      t.intent.kind === intent.kind);
  }
}

// ── MAX_THREATS constant ──────────────────────────────────────────────────────

check('110. MAX_THREATS is 3', MAX_THREATS === 3);
check('111. MIN_SPEED is 1',   MIN_SPEED   === 1);
check('112. MAX_SPEED is 10',  MAX_SPEED   === 10);

// ── DEFAULT_THREAT_MODIFIERS ──────────────────────────────────────────────────

check('113. DEFAULT_THREAT_MODIFIERS.corruptionResistance = 0',  DEFAULT_THREAT_MODIFIERS.corruptionResistance === 0);
check('114. DEFAULT_THREAT_MODIFIERS.stabilityDrainBonus = 0',   DEFAULT_THREAT_MODIFIERS.stabilityDrainBonus  === 0);
check('115. DEFAULT_THREAT_MODIFIERS.spreadChance = 0',          DEFAULT_THREAT_MODIFIERS.spreadChance         === 0);
check('116. DEFAULT_THREAT_MODIFIERS.immuneToChain = false',     DEFAULT_THREAT_MODIFIERS.immuneToChain        === false);
check('117. DEFAULT_THREAT_MODIFIERS.shielded = false',          DEFAULT_THREAT_MODIFIERS.shielded             === false);

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failures.length > 0) {
  console.error('\nFailed tests:');
  failures.forEach(f => console.error(`  • ${f}`));
  process.exit(1);
}
