/**
 * tests/shift_orchestration.test.ts — Shift-specific threat orchestration (Push 8)
 *
 * Tests for frontend/src/game/shiftOrchestration.ts
 *
 * Coverage:
 *   1–18:   orchestrateDay — all group sizes, hints, no reinforcements
 *  19–44:   orchestrateEvening — 1/2-threat passthrough, 3-threat handoff, counterplay
 *  45–80:   orchestrateNight — 1-threat passthrough, 2/3-threat hidden threat,
 *             reinforcement structure, acute never hidden
 *  81–90:   orchestrateForShift — dispatch for all three shifts
 *  91–112:  validateOrchestration — all invariants
 * 113–120:  totalThreatCount — convenience query
 */

import {
  orchestrateDay,
  orchestrateEvening,
  orchestrateNight,
  orchestrateForShift,
  validateOrchestration,
  totalThreatCount,
  EVENING_ARRIVAL_ROUND,
  NIGHT_ARRIVAL_ROUND,
  NIGHT_READINESS_BONUS,
  type OrchestrationResult,
  type Reinforcement,
} from '../src/game/shiftOrchestration';
import { makeThreat, MAX_THREATS }   from '../src/game/threats';
import { type ThreatGroup }          from '../src/game/threatGroups';
import type { Threat }               from '../src/game/threats';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, value: boolean): void {
  if (value) { passed++; console.log(`PASS - ${label}`); }
  else       { failed++; failures.push(label); console.error(`FAIL - ${label}`); }
}
function eq<T>(a: T, b: T, label: string): void { check(label, a === b); }

// ── Factories ─────────────────────────────────────────────────────────────────

function makeThreatWith(id: string, role: Threat['role'], speed = 5): Threat {
  return makeThreat({ id, name: id, corruptionMax: 60, corruptionCurrent: 60, role, speed });
}

/** Build a minimal ThreatGroup with 1, 2, or 3 pre-made threats. */
function makeGroup(count: 1 | 2 | 3, kind: ThreatGroup['kind'] = 'normal'): ThreatGroup {
  const roles = (['acute', 'progressive', 'disruptor'] as const).slice(0, count);
  const threats = roles.map((r, i) => makeThreatWith(`t${i + 1}`, r, 4 + i));
  return { kind, chapter: 5, seed: 'test-seed', threats };
}

// ── 1–18: orchestrateDay ──────────────────────────────────────────────────────

console.log('\n── orchestrateDay ──');

{
  for (const count of [1, 2, 3] as const) {
    const group  = makeGroup(count);
    const result = orchestrateDay(group);

    eq(result.shift,                    'day',           `${count}-threat: shift = 'day'`);
    eq(result.threats.length,           count,           `${count}-threat: all threats active`);
    eq(result.reinforcements.length,    0,               `${count}-threat: no reinforcements`);
    eq(result.hints.intentVisibility,   'full',          `${count}-threat: intentVisibility = full`);
    eq(result.hints.supportAvailability,'high',          `${count}-threat: supportAvailability = high`);
    eq(result.hints.pressureType,       'simultaneous',  `${count}-threat: pressureType = simultaneous`);
  }

  // Threats are the exact same objects (no mutation)
  const group = makeGroup(3);
  const result = orchestrateDay(group);
  check('1. threats reference same objects as group',
    result.threats[0] === group.threats[0] &&
    result.threats[1] === group.threats[1] &&
    result.threats[2] === group.threats[2]);

  // No threat is hidden or latent
  check('2. no threat is hidden after orchestrateDay',
    result.threats.every(t => !t.hidden));
  check('3. no threat is latent after orchestrateDay',
    result.threats.every(t => !t.latent));

  // hints.shift matches result.shift
  eq(result.hints.shift, 'day', '4. hints.shift = day');
}

// ── 19–44: orchestrateEvening ─────────────────────────────────────────────────

console.log('\n── orchestrateEvening ──');

{
  // 1-threat: passthrough (same as day)
  const g1 = makeGroup(1);
  const e1 = orchestrateEvening(g1);
  eq(e1.threats.length,        1, '5. evening 1-threat: all threats active');
  eq(e1.reinforcements.length, 0, '6. evening 1-threat: no reinforcements');
  eq(e1.hints.shift,           'evening', '7. evening 1-threat: shift = evening');

  // 2-threat: passthrough
  const g2 = makeGroup(2);
  const e2 = orchestrateEvening(g2);
  eq(e2.threats.length,        2, '8. evening 2-threat: both threats active');
  eq(e2.reinforcements.length, 0, '9. evening 2-threat: no reinforcements');

  // 3-threat: handoff
  const g3 = makeGroup(3);
  const e3 = orchestrateEvening(g3);

  eq(e3.shift,                  'evening',   '10. evening 3-threat: shift = evening');
  eq(e3.threats.length,         2,           '11. evening 3-threat: only 2 initial threats');
  eq(e3.reinforcements.length,  1,           '12. evening 3-threat: 1 reinforcement');

  // First two threats are unchanged
  check('13. evening: threats[0] is first group threat',
    e3.threats[0].id === g3.threats[0].id);
  check('14. evening: threats[1] is second group threat',
    e3.threats[1].id === g3.threats[1].id);

  // Third threat is in the reinforcement, not the active list
  const reinf = e3.reinforcements[0];
  check('15. evening: reinforcement threat is third group threat',
    reinf.threat.id === g3.threats[2].id);
  check('16. evening: third threat NOT in active threats',
    !e3.threats.some(t => t.id === g3.threats[2].id));

  // Reinforcement structure
  eq(reinf.kind,           'handoff',              '17. evening: reinforcement kind = handoff');
  eq(reinf.arrivalRound,   EVENING_ARRIVAL_ROUND,  '18. evening: arrivalRound = EVENING_ARRIVAL_ROUND');
  eq(reinf.telegraphed,    true,                   '19. evening: telegraphed = true');
  eq(reinf.readinessBonus, 0,                      '20. evening: readinessBonus = 0');

  // Counterplay: revealsOn includes scout and analyze
  check('21. evening: counterplay.revealsOn includes scout',
    reinf.counterplay.revealsOn.includes('scout'));
  check('22. evening: counterplay.revealsOn includes analyze',
    reinf.counterplay.revealsOn.includes('analyze'));

  // Counterplay: delaysOn is non-empty
  check('23. evening: counterplay.delaysOn non-empty',
    reinf.counterplay.delaysOn.length > 0);
  check('24. evening: delay triggers have rounds >= 1',
    reinf.counterplay.delaysOn.every(d => d.rounds >= 1));

  // Counterplay: weakensOn has reductionPct in (0,1]
  check('25. evening: counterplay.weakensOn non-empty',
    reinf.counterplay.weakensOn.length > 0);
  check('26. evening: weakenPct in (0,1]',
    reinf.counterplay.weakensOn.every(w => w.reductionPct > 0 && w.reductionPct <= 1));

  // Hints
  eq(e3.hints.intentVisibility,   'partial',    '27. evening: intentVisibility = partial');
  eq(e3.hints.supportAvailability,'normal',     '28. evening: supportAvailability = normal');
  eq(e3.hints.pressureType,       'sequential', '29. evening: pressureType = sequential');

  // Active threats are not hidden or latent
  check('30. evening: active threats not hidden',
    e3.threats.every(t => !t.hidden));
  check('31. evening: active threats not latent',
    e3.threats.every(t => !t.latent));

  // totalThreatCount = 3 (2 active + 1 handoff)
  eq(totalThreatCount(e3), 3, '32. evening: totalThreatCount = 3');
}

// ── 45–80: orchestrateNight ───────────────────────────────────────────────────

console.log('\n── orchestrateNight ──');

{
  // 1-threat: passthrough (cannot hide sole acute)
  const g1 = makeGroup(1);
  const n1 = orchestrateNight(g1);
  eq(n1.threats.length,        1,       '33. night 1-threat: threat unchanged');
  eq(n1.reinforcements.length, 0,       '34. night 1-threat: no reinforcements');
  check('35. night 1-threat: threat not hidden', !n1.threats[0].hidden);
  check('36. night 1-threat: threat not latent', !n1.threats[0].latent);
  eq(n1.hints.shift, 'night', '37. night 1-threat: shift = night');

  // 2-threat: last threat hidden
  const g2 = makeGroup(2);
  const n2 = orchestrateNight(g2);
  eq(n2.threats.length,        2,       '38. night 2-threat: both threats in array');
  eq(n2.reinforcements.length, 1,       '39. night 2-threat: 1 reinforcement');

  // First threat (acute) unchanged
  check('40. night 2-threat: acute unchanged',
    n2.threats[0].id === g2.threats[0].id && !n2.threats[0].hidden && !n2.threats[0].latent);

  // Second threat is hidden + latent
  check('41. night 2-threat: last threat is hidden',  n2.threats[1].hidden);
  check('42. night 2-threat: last threat is latent',  n2.threats[1].latent);
  check('43. night 2-threat: last threat preserves id', n2.threats[1].id === g2.threats[1].id);

  // 3-threat: only last threat hidden
  const g3 = makeGroup(3);
  const n3 = orchestrateNight(g3);
  eq(n3.threats.length, 3, '44. night 3-threat: all 3 in array');
  check('45. night 3-threat: threats[0] (acute) not hidden',   !n3.threats[0].hidden);
  check('46. night 3-threat: threats[1] (progressive) not hidden', !n3.threats[1].hidden);
  check('47. night 3-threat: threats[2] (disruptor) is hidden',  n3.threats[2].hidden);
  check('48. night 3-threat: threats[2] is latent', n3.threats[2].latent);

  // Reinforcement structure (2-threat case)
  const reinf = n2.reinforcements[0];
  eq(reinf.kind,           'latent_activation', '49. night: reinforcement kind = latent_activation');
  eq(reinf.arrivalRound,   NIGHT_ARRIVAL_ROUND, '50. night: arrivalRound = NIGHT_ARRIVAL_ROUND');
  eq(reinf.telegraphed,    false,               '51. night: telegraphed = false (hidden)');
  eq(reinf.readinessBonus, NIGHT_READINESS_BONUS, '52. night: readinessBonus = NIGHT_READINESS_BONUS');

  // Reinforcement threat is the same object as in the threats array
  check('53. night: reinforcement threat matches hidden threat in array',
    reinf.threat.id === n2.threats[1].id);

  // Counterplay: revealsOn includes scout, analyze, blessing
  check('54. night: revealsOn includes scout',   reinf.counterplay.revealsOn.includes('scout'));
  check('55. night: revealsOn includes analyze', reinf.counterplay.revealsOn.includes('analyze'));
  check('56. night: revealsOn includes blessing',reinf.counterplay.revealsOn.includes('blessing'));

  // Counterplay: no delay options at night
  eq(reinf.counterplay.delaysOn.length, 0, '57. night: no delay counterplay');

  // Counterplay: blessing weakens
  check('58. night: blessing weakens the threat',
    reinf.counterplay.weakensOn.some(w => w.trigger === 'blessing'));
  check('59. night: weakenPct in (0,1]',
    reinf.counterplay.weakensOn.every(w => w.reductionPct > 0 && w.reductionPct <= 1));

  // Hints
  eq(n3.hints.intentVisibility,    'hidden', '60. night: intentVisibility = hidden');
  eq(n3.hints.supportAvailability, 'low',    '61. night: supportAvailability = low');
  eq(n3.hints.pressureType,        'latent', '62. night: pressureType = latent');
  eq(n3.hints.shift,               'night',  '63. night: hints.shift = night');

  // Acute NEVER hidden regardless of group size
  for (const count of [1, 2, 3] as const) {
    const g = makeGroup(count);
    const n = orchestrateNight(g);
    const acuteThreat = n.threats.find(t => t.role === 'acute');
    check(`64-${count}. night: acute is never hidden (count=${count})`,
      !!acuteThreat && !acuteThreat.hidden);
    check(`65-${count}. night: acute is never latent (count=${count})`,
      !!acuteThreat && !acuteThreat.latent);
  }

  // Exactly ONE threat hidden per night encounter (2+)
  check('66. night 2-threat: exactly 1 hidden threat',
    n2.threats.filter(t => t.hidden).length === 1);
  check('67. night 3-threat: exactly 1 hidden threat',
    n3.threats.filter(t => t.hidden).length === 1);

  // totalThreatCount: latent_activation does NOT add to count (already in threats)
  eq(totalThreatCount(n3), 3, '68. night: totalThreatCount = 3 (no extra)');
  eq(totalThreatCount(n2), 2, '69. night: totalThreatCount = 2');

  // Original group threats not mutated
  check('70. night: original group.threats[1] NOT mutated (still visible)',
    !g2.threats[1].hidden && !g2.threats[1].latent);
}

// ── 81–90: orchestrateForShift dispatch ───────────────────────────────────────

console.log('\n── orchestrateForShift dispatch ──');

{
  const g3 = makeGroup(3);

  const day     = orchestrateForShift(g3, 'day');
  const evening = orchestrateForShift(g3, 'evening');
  const night   = orchestrateForShift(g3, 'night');

  eq(day.shift,     'day',     '71. orchestrateForShift day → shift = day');
  eq(evening.shift, 'evening', '72. orchestrateForShift evening → shift = evening');
  eq(night.shift,   'night',   '73. orchestrateForShift night → shift = night');

  // Dispatch produces identical results to direct calls
  const directDay = orchestrateDay(g3);
  eq(day.threats.length,        directDay.threats.length,        '74. dispatch day = direct day (count)');
  eq(day.reinforcements.length, directDay.reinforcements.length, '75. dispatch day = direct day (reinf)');

  const directEvening = orchestrateEvening(g3);
  eq(evening.threats.length, directEvening.threats.length, '76. dispatch evening = direct evening');

  const directNight = orchestrateNight(g3);
  eq(night.threats.filter(t => t.hidden).length,
    directNight.threats.filter(t => t.hidden).length, '77. dispatch night = direct night');

  // Hints match
  eq(day.hints.intentVisibility,     'full',          '78. dispatch day hints correct');
  eq(evening.hints.pressureType,     'sequential',    '79. dispatch evening hints correct');
  eq(night.hints.supportAvailability,'low',            '80. dispatch night hints correct');
}

// ── 91–112: validateOrchestration ─────────────────────────────────────────────

console.log('\n── validateOrchestration ──');

{
  // Valid day result
  const vDay = orchestrateDay(makeGroup(3));
  eq(validateOrchestration(vDay).length, 0, '81. valid day result: no errors');

  // Valid evening result (3-threat)
  const vEve = orchestrateEvening(makeGroup(3));
  eq(validateOrchestration(vEve).length, 0, '82. valid evening 3-threat: no errors');

  // Valid night result (3-threat)
  const vNight = orchestrateNight(makeGroup(3));
  eq(validateOrchestration(vNight).length, 0, '83. valid night 3-threat: no errors');

  // Invalid: empty threats
  const emptyThreats: OrchestrationResult = {
    shift: 'day', threats: [], reinforcements: [], hints: orchestrateDay(makeGroup(1)).hints,
  };
  check('84. empty threats: has error',
    validateOrchestration(emptyThreats).length > 0);

  // Invalid: acute hidden
  const acuteHidden: OrchestrationResult = {
    ...orchestrateDay(makeGroup(1)),
    threats: [{ ...orchestrateDay(makeGroup(1)).threats[0], hidden: true }],
  };
  check('85. acute hidden: has error',
    validateOrchestration(acuteHidden).some(e => e.includes("'acute'")));

  // Invalid: handoff threat appearing in threats array
  const evening3 = orchestrateEvening(makeGroup(3));
  const badHandoff: OrchestrationResult = {
    ...evening3,
    threats: [...evening3.threats, evening3.reinforcements[0].threat], // add handoff back
  };
  check('86. handoff threat in threats array: has error',
    validateOrchestration(badHandoff).some(e => e.includes('handoff')));

  // Invalid: latent_activation threat NOT in threats array
  const night2 = orchestrateNight(makeGroup(2));
  const badLatent: OrchestrationResult = {
    ...night2,
    threats: [night2.threats[0]],  // remove the hidden threat from threats
  };
  check('87. latent-activation threat missing from threats: has error',
    validateOrchestration(badLatent).some(e => e.includes('latent-activation')));

  // Invalid: arrivalRound < 2
  const badArrival: OrchestrationResult = {
    ...evening3,
    reinforcements: [{ ...evening3.reinforcements[0], arrivalRound: 1 }],
  };
  check('88. arrivalRound < 2: has error',
    validateOrchestration(badArrival).some(e => e.includes('arrivalRound')));

  // Invalid: readinessBonus > 1
  const badBonus: OrchestrationResult = {
    ...night2,
    reinforcements: [{ ...night2.reinforcements[0], readinessBonus: 1.5 }],
  };
  check('89. readinessBonus > 1: has error',
    validateOrchestration(badBonus).some(e => e.includes('readinessBonus')));

  // Invalid: duplicate threat ids in threats
  const t = makeThreatWith('dup', 'acute');
  const dupThreats: OrchestrationResult = {
    shift: 'day', threats: [t, { ...t, role: 'progressive' }],
    reinforcements: [], hints: orchestrateDay(makeGroup(1)).hints,
  };
  check('90. duplicate threat ids: has error',
    validateOrchestration(dupThreats).some(e => e.includes('Duplicate')));

  // Invalid: latent threat in array but not marked latent
  const nightResult = orchestrateNight(makeGroup(2));
  const notLatent: OrchestrationResult = {
    ...nightResult,
    threats: [
      nightResult.threats[0],
      { ...nightResult.threats[1], latent: false },  // hidden but not latent
    ],
  };
  check('91. latent-activation threat not marked latent: has error',
    validateOrchestration(notLatent).some(e => e.includes('not marked latent')));
}

// ── 113–120: totalThreatCount ─────────────────────────────────────────────────

console.log('\n── totalThreatCount ──');

{
  eq(totalThreatCount(orchestrateDay(makeGroup(1))),     1, '92. day 1-threat: count = 1');
  eq(totalThreatCount(orchestrateDay(makeGroup(3))),     3, '93. day 3-threat: count = 3');
  eq(totalThreatCount(orchestrateEvening(makeGroup(2))), 2, '94. evening 2-threat: count = 2');
  eq(totalThreatCount(orchestrateEvening(makeGroup(3))), 3, '95. evening 3-threat: count = 3 (2+handoff)');
  eq(totalThreatCount(orchestrateNight(makeGroup(1))),   1, '96. night 1-threat: count = 1');
  eq(totalThreatCount(orchestrateNight(makeGroup(2))),   2, '97. night 2-threat: count = 2');
  eq(totalThreatCount(orchestrateNight(makeGroup(3))),   3, '98. night 3-threat: count = 3');

  // Never exceeds MAX_THREATS
  for (const shift of ['day', 'evening', 'night'] as const) {
    for (const count of [1, 2, 3] as const) {
      const result = orchestrateForShift(makeGroup(count), shift);
      check(`99. totalThreatCount <= MAX_THREATS (${shift}, count=${count})`,
        totalThreatCount(result) <= MAX_THREATS);
    }
  }
}

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failures.length > 0) {
  console.error('\nFailed tests:');
  failures.forEach(f => console.error(`  • ${f}`));
  process.exit(1);
}
