/**
 * tests/stability_engine.test.ts — Shared Stability combat loop (Push 7)
 *
 * Tests for frontend/src/game/stabilityEngine.ts
 *
 * Coverage:
 *  1–18:   getStabilityTier — all boundaries and tier properties
 *  19–28:  STABILITY_TIERS — structure, ordering, coverage
 *  29–47:  describeIntent — all six intent kinds
 *  48–75:  calcThreatPressure — all cases (resolved, latent, each intent, drain)
 *  76–103: buildThreatDisplayData — all fields, edge cases
 *  104–135: calcIncomingPressure — aggregate, projection, tier-drop
 *  136–150: buildMultiThreatDisplay — convenience wrapper
 */

import {
  STABILITY_TIERS,
  getStabilityTier,
  describeIntent,
  calcThreatPressure,
  getThreatStatus,
  buildThreatDisplayData,
  calcIncomingPressure,
  buildMultiThreatDisplay,
  type StabilityTierName,
  type ThreatStatus,
} from '../src/game/stabilityEngine';
import { makeThreat, setThreatIntent, type MakeThreatOptions } from '../src/game/threats';
import type { Threat, ThreatIntent } from '../src/game/threats';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, value: boolean): void {
  if (value) { passed++; console.log(`PASS - ${label}`); }
  else       { failed++; failures.push(label); console.error(`FAIL - ${label}`); }
}
function eq<T>(a: T, b: T, label: string): void { check(label, a === b); }

// ── Threat factories ──────────────────────────────────────────────────────────

/** Build a Threat with sensible defaults — all fields are optional here. */
function threat(overrides: Partial<MakeThreatOptions> = {}): Threat {
  const opts = Object.assign(
    { id: 'test', name: 'Test', corruptionMax: 80 },
    overrides,
  ) as MakeThreatOptions;
  return makeThreat(opts);
}

function withIntent(t: Threat, intent: ThreatIntent): Threat {
  return setThreatIntent(t, intent);
}

// ── 1–18: getStabilityTier ────────────────────────────────────────────────────

console.log('\n── getStabilityTier ──');

// Failure tier
eq(getStabilityTier(0).name,  'failure',  '1. stability=0 → failure');
eq(getStabilityTier(-1).name, 'failure',  '2. stability=-1 → clamped → failure');

// Critical tier (1–24)
eq(getStabilityTier(1).name,   'critical', '3. stability=1 → critical');
eq(getStabilityTier(12).name,  'critical', '4. stability=12 → critical (mid)');
eq(getStabilityTier(24).name,  'critical', '5. stability=24 → critical (top)');

// Unstable tier (25–49)
eq(getStabilityTier(25).name,  'unstable', '6. stability=25 → unstable');
eq(getStabilityTier(37).name,  'unstable', '7. stability=37 → unstable (mid)');
eq(getStabilityTier(49).name,  'unstable', '8. stability=49 → unstable (top)');

// Guarded tier (50–74)
eq(getStabilityTier(50).name,  'guarded',  '9. stability=50 → guarded');
eq(getStabilityTier(62).name,  'guarded',  '10. stability=62 → guarded (mid)');
eq(getStabilityTier(74).name,  'guarded',  '11. stability=74 → guarded (top)');

// Stable tier (75–100)
eq(getStabilityTier(75).name,  'stable',   '12. stability=75 → stable');
eq(getStabilityTier(88).name,  'stable',   '13. stability=88 → stable (mid)');
eq(getStabilityTier(100).name, 'stable',   '14. stability=100 → stable');
eq(getStabilityTier(101).name, 'stable',   '15. stability=101 → clamped to 100 → stable');

// Exact boundary transitions
eq(getStabilityTier(0).name,  'failure',  '16. boundary 0 = failure (not critical)');
eq(getStabilityTier(1).name,  'critical', '17. boundary 1 = critical (not failure)');
eq(getStabilityTier(75).name, 'stable',   '18. boundary 75 = stable (not guarded)');

// ── 19–28: STABILITY_TIERS structure ─────────────────────────────────────────

console.log('\n── STABILITY_TIERS structure ──');

{
  const names: StabilityTierName[] = ['stable', 'guarded', 'unstable', 'critical', 'failure'];
  eq(STABILITY_TIERS.length, 5, '19. STABILITY_TIERS has 5 entries');

  names.forEach((name, i) => {
    check(`20-${i}. tier[${i}] has name '${name}'`, STABILITY_TIERS[i].name === name);
  });

  // Tiers are ordered highest to lowest (min descending)
  for (let i = 1; i < STABILITY_TIERS.length; i++) {
    check(`21. tier[${i}].min < tier[${i - 1}].min`,
      STABILITY_TIERS[i].min < STABILITY_TIERS[i - 1].min);
  }

  // No stability value is left uncovered (scan 0–100)
  let uncovered = 0;
  for (let s = 0; s <= 100; s++) {
    const hit = STABILITY_TIERS.some(t => s >= t.min && s <= t.max);
    if (!hit) uncovered++;
  }
  eq(uncovered, 0, '22. all values 0–100 are covered by a tier');

  // Each tier has label, cue, colorToken
  for (const tier of STABILITY_TIERS) {
    check(`23. tier '${tier.name}' has a non-empty label`,  tier.label.length > 0);
    check(`24. tier '${tier.name}' has a non-empty cue`,    tier.cue.length > 0);
    check(`25. tier '${tier.name}' has a colorToken`,       tier.colorToken.length > 0);
  }
}

// ── 29–47: describeIntent ─────────────────────────────────────────────────────

console.log('\n── describeIntent ──');

{
  const idle:    ThreatIntent = { kind: 'idle' };
  const surge:   ThreatIntent = { kind: 'surge',    magnitude: 10 };
  const corrupt: ThreatIntent = { kind: 'corrupt',  magnitude: 5  };
  const spread:  ThreatIntent = { kind: 'spread' };
  const spreadT: ThreatIntent = { kind: 'spread', targetThreatId: 'other' };
  const escal:   ThreatIntent = { kind: 'escalate' };
  const disrupt: ThreatIntent = { kind: 'disrupt', targetRole: 'acute' };

  check('29. idle: returns non-empty string',       describeIntent(idle).length > 0);
  check('30. surge: mentions magnitude',            describeIntent(surge).includes('10'));
  check('31. corrupt: mentions magnitude',          describeIntent(corrupt).includes('5'));
  check('32. spread (no target): non-empty',        describeIntent(spread).length > 0);
  check('33. spread (with target): non-empty',      describeIntent(spreadT).length > 0);
  check('34. escalate: mentions escalat',           describeIntent(escal).toLowerCase().includes('escalat'));
  check('35. disrupt: mentions targetRole',         describeIntent(disrupt).includes('acute'));
  check('36. disrupt: mentions disrupt',            describeIntent(disrupt).toLowerCase().includes('disrupt'));

  // Distinct intents produce distinct descriptions
  const allDescs = [idle, surge, corrupt, spread, escal, disrupt].map(describeIntent);
  const unique   = new Set(allDescs);
  eq(unique.size, allDescs.length, '37. all intent kinds produce distinct descriptions');

  // Spread with vs without targetThreatId produces different output
  check('38. spread with/without target: different descriptions',
    describeIntent(spread) !== describeIntent(spreadT));
}

// ── 48–75: calcThreatPressure ─────────────────────────────────────────────────

console.log('\n── calcThreatPressure ──');

{
  // Resolved → 0
  const resolved = threat({ id: 'r', corruptionCurrent: 0, speed: 7 });
  eq(calcThreatPressure(resolved), 0, '39. resolved threat → pressure = 0');

  // Latent → 0
  const latent = threat({ id: 'l', corruptionCurrent: 50, speed: 7, latent: true });
  eq(calcThreatPressure(latent), 0, '40. latent threat → pressure = 0');

  // Active, idle intent: base = speed
  const idle = threat({ id: 'i', corruptionCurrent: 50, speed: 5 });
  eq(calcThreatPressure(idle), 5, '41. idle intent → pressure = speed');

  // Surge intent: base + magnitude
  const surge = withIntent(
    threat({ id: 's', corruptionCurrent: 50, speed: 4 }),
    { kind: 'surge', magnitude: 8 },
  );
  eq(calcThreatPressure(surge), 12, '42. surge(8) + speed(4) = 12');

  // Corrupt intent: base + magnitude
  const corrupt = withIntent(
    threat({ id: 'c', corruptionCurrent: 50, speed: 3 }),
    { kind: 'corrupt', magnitude: 6 },
  );
  eq(calcThreatPressure(corrupt), 9, '43. corrupt(6) + speed(3) = 9');

  // Spread intent: base only (no bonus)
  const spread = withIntent(
    threat({ id: 'sp', corruptionCurrent: 50, speed: 5 }),
    { kind: 'spread' },
  );
  eq(calcThreatPressure(spread), 5, '44. spread → pressure = speed only');

  // Escalate intent: base + ceil(base × 0.5)
  const escal6 = withIntent(
    threat({ id: 'e6', corruptionCurrent: 50, speed: 6 }),
    { kind: 'escalate' },
  );
  eq(calcThreatPressure(escal6), 9, '45. escalate speed=6 → 6 + ceil(3) = 9');

  const escal5 = withIntent(
    threat({ id: 'e5', corruptionCurrent: 50, speed: 5 }),
    { kind: 'escalate' },
  );
  eq(calcThreatPressure(escal5), 8, '46. escalate speed=5 → 5 + ceil(2.5) = 8');

  // Disrupt intent: base only
  const disrupt = withIntent(
    threat({ id: 'd', corruptionCurrent: 50, speed: 4 }),
    { kind: 'disrupt', targetRole: 'acute' },
  );
  eq(calcThreatPressure(disrupt), 4, '47. disrupt → pressure = speed only');

  // stabilityDrainBonus stacks with base
  const drained = threat({
    id: 'dr', corruptionCurrent: 50, speed: 4,
    modifiers: { stabilityDrainBonus: 3 },
  });
  eq(calcThreatPressure(drained), 7, '48. drainBonus(3) + speed(4) = 7');

  // Drain bonus stacks with intent bonus
  const drainAndSurge = withIntent(
    threat({ id: 'ds', corruptionCurrent: 50, speed: 4, modifiers: { stabilityDrainBonus: 2 } }),
    { kind: 'surge', magnitude: 5 },
  );
  eq(calcThreatPressure(drainAndSurge), 11, '49. speed(4) + surge(5) + drain(2) = 11');

  // Negative drain bonus floors at 0
  const negative = threat({
    id: 'neg', corruptionCurrent: 50, speed: 2,
    modifiers: { stabilityDrainBonus: -10 },
  });
  eq(calcThreatPressure(negative), 0, '50. negative total → floor at 0');

  // Hidden (non-latent) threat still contributes pressure
  const hidden = threat({ id: 'h', corruptionCurrent: 50, speed: 6, hidden: true });
  check('51. hidden threat still contributes pressure', calcThreatPressure(hidden) > 0);

  // Speed boundary: min speed (1) produces 1 base pressure
  const minSpeed = threat({ id: 'ms', corruptionCurrent: 50, speed: 1 });
  eq(calcThreatPressure(minSpeed), 1, '52. min speed (1) → base pressure 1');

  // Speed boundary: max speed (10) produces 10 base pressure
  const maxSpeed = threat({ id: 'Ms', corruptionCurrent: 50, speed: 10 });
  eq(calcThreatPressure(maxSpeed), 10, '53. max speed (10) → base pressure 10');
}

// ── getThreatStatus ───────────────────────────────────────────────────────────

console.log('\n── getThreatStatus ──');

{
  const active   = threat({ id: 'a', corruptionCurrent: 50 });
  const resolved = threat({ id: 'r', corruptionCurrent: 0  });
  const hidden   = threat({ id: 'h', corruptionCurrent: 50, hidden: true });
  const latent   = threat({ id: 'l', corruptionCurrent: 50, latent: true });
  // Resolved takes priority over hidden
  const resHid   = threat({ id: 'rh', corruptionCurrent: 0, hidden: true });

  eq(getThreatStatus(active),   'active',   '54. active threat → active');
  eq(getThreatStatus(resolved), 'resolved', '55. resolved threat → resolved');
  eq(getThreatStatus(hidden),   'hidden',   '56. hidden threat → hidden');
  eq(getThreatStatus(latent),   'latent',   '57. latent threat → latent');
  eq(getThreatStatus(resHid),   'resolved', '58. resolved+hidden → resolved takes priority');
}

// ── 76–103: buildThreatDisplayData ────────────────────────────────────────────

console.log('\n── buildThreatDisplayData ──');

{
  const t60   = threat({ id: 't60', corruptionMax: 80, corruptionCurrent: 60, speed: 5 });
  const data  = buildThreatDisplayData(t60, 80); // stability = 80 → stable

  eq(data.status,           'active',  '59. status = active');
  eq(data.corruptionPct,    75,        '60. corruptionPct = round(60/80*100) = 75');
  eq(data.pressureThisRound, 5,        '61. pressureThisRound = speed(5) + idle');
  eq(data.stabilityTier.name, 'stable','62. stabilityTier = stable (80 → stable)');
  check('63. intentLabel is non-empty',  data.intentLabel.length > 0);
  check('64. isPressingNow = true (active, pressure > 0)', data.isPressingNow === true);

  // corruptionPct for 100% (fully corrupted — not yet damaged)
  const full  = threat({ id: 'f', corruptionMax: 100, corruptionCurrent: 100 });
  eq(buildThreatDisplayData(full, 60).corruptionPct, 100, '65. full corruption → 100%');

  // corruptionPct for 0% (resolved)
  const res   = threat({ id: 'res', corruptionMax: 100, corruptionCurrent: 0 });
  const rData = buildThreatDisplayData(res, 50);
  eq(rData.corruptionPct,      0,        '66. resolved → corruptionPct = 0');
  eq(rData.status,             'resolved','67. resolved → status = resolved');
  eq(rData.pressureThisRound,  0,        '68. resolved → pressureThisRound = 0');
  eq(rData.isPressingNow,      false,    '69. resolved → isPressingNow = false');

  // Stability tier reflects current stability
  const guarded = buildThreatDisplayData(t60, 60); // stability = 60 → guarded
  eq(guarded.stabilityTier.name, 'guarded', '70. stabilityTier updates with stability');

  // isPressingNow false for latent
  const lat   = threat({ id: 'lat', corruptionCurrent: 50, speed: 7, latent: true });
  const lData = buildThreatDisplayData(lat, 70);
  eq(lData.isPressingNow, false,     '71. latent → isPressingNow = false');
  eq(lData.status,        'latent',  '72. latent → status = latent');

  // corruptionPct rounds correctly
  const frac = threat({ id: 'frac', corruptionMax: 3, corruptionCurrent: 2 });
  // 2/3*100 = 66.67 → rounds to 67
  eq(buildThreatDisplayData(frac, 80).corruptionPct, 67, '73. corruptionPct rounds correctly');

  // corruptionMax = 0 edge case → 0%
  const zero = { ...threat({ id: 'z', corruptionMax: 100 }), corruptionMax: 0 } as Threat;
  eq(buildThreatDisplayData(zero, 80).corruptionPct, 0,  '74. corruptionMax=0 → 0%');

  // Hidden threat: status = hidden
  const hid = threat({ id: 'hid', corruptionCurrent: 50, hidden: true });
  eq(buildThreatDisplayData(hid, 80).status, 'hidden', '75. hidden threat → status = hidden');
}

// ── 104–135: calcIncomingPressure ─────────────────────────────────────────────

console.log('\n── calcIncomingPressure ──');

{
  // Single active threat
  const t1 = threat({ id: 'p1', corruptionCurrent: 60, speed: 8 });
  const r1 = calcIncomingPressure([t1], 80);

  eq(r1.totalPressure,       8,          '76. single threat: totalPressure = speed');
  eq(r1.projectedStability,  72,         '77. projected = 80 - 8 = 72');
  eq(r1.byThreat.length,     1,          '78. byThreat has 1 entry');
  eq(r1.byThreat[0].pressure, 8,         '79. byThreat[0].pressure = 8');
  eq(r1.byThreat[0].threatId, 'p1',      '80. byThreat[0].threatId = p1');
  eq(r1.currentTier.name,     'stable',  '81. currentTier = stable (80)');
  eq(r1.projectedTier.name,   'guarded', '82. projectedTier = guarded (72)');
  eq(r1.tierDropped,           true,     '83. tierDropped = true (stable → guarded)');

  // Two active threats
  const t2 = threat({ id: 'p2', corruptionCurrent: 40, speed: 4 });
  const r2 = calcIncomingPressure([t1, t2], 80);

  eq(r2.totalPressure,      12,         '84. two threats: totalPressure = 8 + 4');
  eq(r2.projectedStability,  68,        '85. projected = 80 - 12 = 68');
  eq(r2.byThreat.length,      2,        '86. byThreat has 2 entries');

  // Resolved threat contributes 0
  const tres = threat({ id: 'pr', corruptionCurrent: 0, speed: 6 });
  const r3 = calcIncomingPressure([t1, tres], 80);
  eq(r3.totalPressure, 8, '87. resolved threat contributes 0 pressure');
  eq(r3.byThreat[1].pressure, 0, '88. byThreat resolved entry pressure = 0');
  eq(r3.byThreat[1].status, 'resolved', '89. byThreat resolved entry status = resolved');

  // Latent threat contributes 0
  const tlat = threat({ id: 'pl', corruptionCurrent: 50, speed: 7, latent: true });
  const r4 = calcIncomingPressure([t1, tlat], 80);
  eq(r4.totalPressure, 8, '90. latent threat contributes 0 pressure');

  // Pressure that would exceed stability floors at 0
  const t5 = threat({ id: 'p5', corruptionCurrent: 50, speed: 10 });
  const r5 = calcIncomingPressure([t5], 5);
  eq(r5.projectedStability, 0, '91. projected stability floored at 0 (5 - 10 → 0)');
  eq(r5.projectedTier.name, 'failure', '92. projected tier = failure when stability hit 0');
  eq(r5.tierDropped, true, '93. tierDropped = true when dropping to failure');

  // No tier drop when staying in same tier
  const t6 = threat({ id: 'p6', corruptionCurrent: 50, speed: 1 });
  const r6 = calcIncomingPressure([t6], 80);
  // 80 - 1 = 79 → still stable
  eq(r6.tierDropped, false, '94. no tier drop when staying in same tier (80 → 79)');

  // All resolved threats → 0 total pressure
  const r7 = calcIncomingPressure(
    [threat({ id: 'a', corruptionCurrent: 0 }), threat({ id: 'b', corruptionCurrent: 0 })],
    60,
  );
  eq(r7.totalPressure,      0,  '95. all resolved → totalPressure = 0');
  eq(r7.projectedStability, 60, '96. all resolved → projected = current');
  eq(r7.tierDropped,        false, '97. all resolved → no tier drop');

  // Intent bonuses flow through into total
  const surging = withIntent(
    threat({ id: 'surge', corruptionCurrent: 50, speed: 4 }),
    { kind: 'surge', magnitude: 10 },
  );
  const r8 = calcIncomingPressure([surging], 80);
  eq(r8.totalPressure, 14, '98. surge(10) + speed(4) = 14 in aggregate');

  // byThreat status field
  const hidden = threat({ id: 'hid', corruptionCurrent: 50, speed: 5, hidden: true });
  const r9 = calcIncomingPressure([hidden], 80);
  eq(r9.byThreat[0].status, 'hidden', '99. byThreat status = hidden for hidden threat');
  check('100. hidden threat still contributes pressure to aggregate', r9.totalPressure > 0);
}

// ── 136–150: buildMultiThreatDisplay ─────────────────────────────────────────

console.log('\n── buildMultiThreatDisplay ──');

{
  const ta = threat({ id: 'a', corruptionMax: 80, corruptionCurrent: 60, speed: 5 });
  const tb = threat({ id: 'b', corruptionMax: 60, corruptionCurrent: 30, speed: 3 });
  const tc = threat({ id: 'c', corruptionMax: 40, corruptionCurrent: 0,  speed: 7 }); // resolved

  const disp = buildMultiThreatDisplay([ta, tb, tc], 65);

  eq(disp.threatRows.length,                 3,         '101. threatRows has 3 entries');
  eq(disp.stabilityTier.name,               'guarded',  '102. stabilityTier = guarded (65)');
  eq(disp.incomingPressure.totalPressure,    8,         '103. totalPressure = 5+3+0 = 8');
  eq(disp.incomingPressure.projectedStability, 57,      '104. projected = 65 - 8 = 57');
  eq(disp.threatRows[0].threat.id,          'a',        '105. threatRows[0] is threat a');
  eq(disp.threatRows[2].status,             'resolved', '106. threatRows[2] status = resolved');

  // Stability tier consistent between wrapper and per-row
  for (const row of disp.threatRows) {
    check(`107. row ${row.threat.id}: stabilityTier matches wrapper`,
      row.stabilityTier.name === disp.stabilityTier.name);
  }

  // Mutually consistent: sum of byThreat pressures = totalPressure
  const sumByThreat = disp.incomingPressure.byThreat.reduce((s, e) => s + e.pressure, 0);
  eq(sumByThreat, disp.incomingPressure.totalPressure,
    '108. byThreat pressures sum to totalPressure');
}

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failures.length > 0) {
  console.error('\nFailed tests:');
  failures.forEach(f => console.error(`  • ${f}`));
  process.exit(1);
}
