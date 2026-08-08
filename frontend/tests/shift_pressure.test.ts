/**
 * tests/shift_pressure.test.ts — Persistent shift pressure system (Push 11)
 *
 * Tests for frontend/src/game/shiftPressure.ts
 *
 * Coverage:
 *   1–18:   getPressureLevel — all boundaries and mid-range values
 *  19–30:   getPressureLabel — all three shifts, exhaustiveness
 *  31–50:   createPressure — defaults, clamping, label set
 *  51–70:   applyPressureModifier / applyPressureModifiers — delta, clamping, sequence
 *  71–120:  getPressureEffects — all 6 shift×level combos, stacking cap, moderate=empty
 * 121–145:  Effect query helpers — team/enemy readiness, AP, arrival, intent, latent
 * 146–160:  describePressure / describePressureEffects — string content
 * 161–175:  validatePressure — all error categories
 * 176–185:  Constants sanity
 */

import {
  getPressureLevel,
  getPressureLabel,
  createPressure,
  applyPressureModifier,
  applyPressureModifiers,
  getPressureEffects,
  findEffect,
  pressureTeamReadinessDelta,
  pressureEnemyReadinessDelta,
  pressureApPenalty,
  pressureArrivalDelta,
  pressureHidesIntent,
  pressureRevealsIntent,
  pressureRevealsLatent,
  pressureLatentBonus,
  describePressure,
  describePressureEffects,
  validatePressure,
  PRESSURE_HIGH_THRESHOLD,
  PRESSURE_LOW_THRESHOLD,
  PRESSURE_MIN,
  PRESSURE_MAX,
  DAY_HIGH_AP_PENALTY,
  DAY_LOW_READINESS_BONUS,
  EVENING_HIGH_ARRIVAL_DELTA,
  EVENING_LOW_ARRIVAL_DELTA,
  NIGHT_HIGH_ENEMY_READINESS,
  NIGHT_LOW_TEAM_READINESS,
  NIGHT_HIGH_LATENT_BONUS,
  DEFAULT_PRESSURE_BY_SHIFT,
  type ShiftPressure,
  type PressureModifier,
} from '../src/game/shiftPressure';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, value: boolean): void {
  if (value) { passed++; console.log(`PASS - ${label}`); }
  else       { failed++; failures.push(label); console.error(`FAIL - ${label}`); }
}
function eq<T>(a: T, b: T, label: string): void { check(label, a === b); }

// ── Helpers ───────────────────────────────────────────────────────────────────

function pressure(shift: ShiftPressure['shift'], value: number): ShiftPressure {
  return createPressure(shift, value);
}

function mod(delta: number, source: PressureModifier['source'] = 'ward_event'): PressureModifier {
  return { source, delta, reason: 'test' };
}

// ── 1–18: getPressureLevel ────────────────────────────────────────────────────

console.log('\n── getPressureLevel ──');

// Low band (≤30)
eq(getPressureLevel(0),   'low',      '1. value=0 → low');
eq(getPressureLevel(15),  'low',      '2. value=15 → low (mid)');
eq(getPressureLevel(30),  'low',      '3. value=30 → low (boundary)');

// Moderate band (31–69)
eq(getPressureLevel(31),  'moderate', '4. value=31 → moderate');
eq(getPressureLevel(50),  'moderate', '5. value=50 → moderate (mid)');
eq(getPressureLevel(69),  'moderate', '6. value=69 → moderate (top)');

// High band (≥70)
eq(getPressureLevel(70),  'high',     '7. value=70 → high (boundary)');
eq(getPressureLevel(85),  'high',     '8. value=85 → high (mid)');
eq(getPressureLevel(100), 'high',     '9. value=100 → high');

// Clamping
eq(getPressureLevel(-10), 'low',      '10. value<0 → clamped → low');
eq(getPressureLevel(110), 'high',     '11. value>100 → clamped → high');

// Exact boundaries
eq(getPressureLevel(PRESSURE_LOW_THRESHOLD),  'low',      '12. at LOW threshold → low');
eq(getPressureLevel(PRESSURE_LOW_THRESHOLD + 1), 'moderate','13. LOW+1 → moderate');
eq(getPressureLevel(PRESSURE_HIGH_THRESHOLD - 1),'moderate','14. HIGH-1 → moderate');
eq(getPressureLevel(PRESSURE_HIGH_THRESHOLD),    'high',    '15. at HIGH threshold → high');

// Round-trip through rounding
eq(getPressureLevel(29.6), 'low',     '16. 29.6 rounds to 30 → low');
eq(getPressureLevel(30.4), 'low',     '17. 30.4 rounds to 30 (≤LOW) → low');
// Actually 30.4 rounds to 30 which is low
eq(getPressureLevel(30.5), 'moderate','18. 30.5 rounds to 31 → moderate');

// ── 19–30: getPressureLabel ───────────────────────────────────────────────────

console.log('\n── getPressureLabel ──');

eq(getPressureLabel('day'),     'Coordination Load', '19. day → Coordination Load');
eq(getPressureLabel('evening'), 'Handoff Debt',      '20. evening → Handoff Debt');
eq(getPressureLabel('night'),   'Silent Risk',       '21. night → Silent Risk');

// All labels are distinct
check('22. all labels distinct',
  new Set(['day','evening','night'].map(s => getPressureLabel(s as ShiftPressure['shift']))).size === 3);

// Label is non-empty for all shifts
for (const shift of ['day','evening','night'] as const) {
  check(`23. label non-empty (${shift})`, getPressureLabel(shift).length > 0);
}

// ── 31–50: createPressure ─────────────────────────────────────────────────────

console.log('\n── createPressure ──');

// Default values
for (const shift of ['day','evening','night'] as const) {
  const p = createPressure(shift);
  eq(p.value, DEFAULT_PRESSURE_BY_SHIFT[shift], `24. default (${shift}) = ${DEFAULT_PRESSURE_BY_SHIFT[shift]}`);
  eq(p.shift, shift, `25. shift preserved (${shift})`);
  eq(p.label, getPressureLabel(shift), `26. label matches getPressureLabel (${shift})`);
}

// Custom initial value
const p42 = createPressure('day', 42);
eq(p42.value, 42, '27. custom value=42 preserved');

// Clamping on create
const pHigh = createPressure('night', 150);
eq(pHigh.value, PRESSURE_MAX, '28. initial > MAX → clamped to 100');
const pLow = createPressure('evening', -10);
eq(pLow.value, PRESSURE_MIN, '29. initial < MIN → clamped to 0');

// Boundary values
const p0 = createPressure('day', 0);
eq(p0.value, 0,   '30. initial=0 preserved');
const p100 = createPressure('day', 100);
eq(p100.value, 100, '31. initial=100 preserved');

// validatePressure on freshly created pressure
for (const shift of ['day','evening','night'] as const) {
  eq(validatePressure(createPressure(shift)).length, 0,
    `32. fresh pressure (${shift}) is valid`);
}

// ── 51–70: applyPressureModifier ──────────────────────────────────────────────

console.log('\n── applyPressureModifier ──');

{
  const base = createPressure('day', 50);

  // Positive delta increases pressure
  const p1 = applyPressureModifier(base, mod(10));
  eq(p1.value, 60, '33. +10 → 60');

  // Negative delta decreases pressure
  const p2 = applyPressureModifier(base, mod(-20));
  eq(p2.value, 30, '34. -20 → 30');

  // Zero delta: no change
  const p3 = applyPressureModifier(base, mod(0));
  eq(p3.value, 50, '35. ±0 → unchanged');

  // Upper clamp
  const p4 = applyPressureModifier(base, mod(100));
  eq(p4.value, PRESSURE_MAX, '36. large +delta → clamped to 100');

  // Lower clamp
  const p5 = applyPressureModifier(base, mod(-200));
  eq(p5.value, PRESSURE_MIN, '37. large -delta → clamped to 0');

  // Shift and label preserved
  eq(p1.shift, 'day',              '38. shift preserved after modifier');
  eq(p1.label, 'Coordination Load','39. label preserved after modifier');

  // Original not mutated
  eq(base.value, 50, '40. original unchanged after modifier');

  // Fractional delta is rounded
  const pFrac = applyPressureModifier(base, mod(3.7));
  eq(pFrac.value, 54, '41. 50 + round(3.7)=4 → 54');
  const pFrac2 = applyPressureModifier(base, mod(3.4));
  eq(pFrac2.value, 53, '42. 50 + round(3.4)=3 → 53');

  // applyPressureModifiers — sequence
  const mods: PressureModifier[] = [mod(20), mod(-5), mod(10)];
  const seq = applyPressureModifiers(base, mods);
  eq(seq.value, 75, '43. 50+20-5+10 = 75');

  // Empty sequence: no change
  const empty = applyPressureModifiers(base, []);
  eq(empty.value, 50, '44. empty modifiers → unchanged');

  // Sequence clamps at each step
  const clampSeq = applyPressureModifiers(createPressure('day', 90), [mod(50), mod(-20)]);
  eq(clampSeq.value, 80, '45. 90+50→100(clamped), 100-20=80');

  // Different sources all work
  for (const src of ['ward_event','battle_win','battle_loss','map_decision','call_team','chapter_start'] as const) {
    const r = applyPressureModifier(base, { source: src, delta: 1, reason: 'test' });
    eq(r.value, 51, `46. source '${src}' applies correctly`);
  }
}

// ── 71–120: getPressureEffects ────────────────────────────────────────────────

console.log('\n── getPressureEffects ──');

{
  // Moderate: always empty (all shifts)
  for (const shift of ['day','evening','night'] as const) {
    const p = pressure(shift, 50);
    eq(getPressureEffects(p).length, 0, `47. moderate (${shift}): no effects`);
  }

  // DAY HIGH (≥70)
  const dayHigh = pressure('day', 70);
  const dhFx    = getPressureEffects(dayHigh);
  check('48. day high: ap_penalty present',     dhFx.some(e => e.kind === 'ap_penalty'));
  check('49. day high: side_objective present', dhFx.some(e => e.kind === 'side_objective'));
  check('50. day high: call_team_penalty present', dhFx.some(e => e.kind === 'call_team_penalty'));
  const apE = findEffect(dhFx, 'ap_penalty');
  eq(apE?.amount, DAY_HIGH_AP_PENALTY, '51. day high: ap_penalty amount = DAY_HIGH_AP_PENALTY');

  // DAY LOW (≤30)
  const dayLow = pressure('day', 30);
  const dlFx   = getPressureEffects(dayLow);
  check('52. day low: readiness_team_bonus present', dlFx.some(e => e.kind === 'readiness_team_bonus'));
  check('53. day low: support_faster present',        dlFx.some(e => e.kind === 'support_faster'));
  const tbE = findEffect(dlFx, 'readiness_team_bonus');
  eq(tbE?.amount, DAY_LOW_READINESS_BONUS, '54. day low: readiness bonus = DAY_LOW_READINESS_BONUS');

  // DAY HIGH has no low-only effects
  check('55. day high: no readiness_team_bonus', !dhFx.some(e => e.kind === 'readiness_team_bonus'));
  check('56. day high: no support_faster',       !dhFx.some(e => e.kind === 'support_faster'));

  // EVENING HIGH (≥70)
  const eveHigh = pressure('evening', 80);
  const ehFx    = getPressureEffects(eveHigh);
  check('57. evening high: intent_hidden present',            ehFx.some(e => e.kind === 'intent_hidden'));
  check('58. evening high: reinforcement_arrival_delta present', ehFx.some(e => e.kind === 'reinforcement_arrival_delta'));
  check('59. evening high: support_delay present',            ehFx.some(e => e.kind === 'support_delay'));
  const eArrH = findEffect(ehFx, 'reinforcement_arrival_delta');
  eq(eArrH?.rounds, EVENING_HIGH_ARRIVAL_DELTA, '60. evening high: arrival delta = EVENING_HIGH_ARRIVAL_DELTA');

  // EVENING LOW (≤30)
  const eveLow = pressure('evening', 20);
  const elFx   = getPressureEffects(eveLow);
  check('61. evening low: intent_revealed present',              elFx.some(e => e.kind === 'intent_revealed'));
  check('62. evening low: protocol_card_opportunity present',    elFx.some(e => e.kind === 'protocol_card_opportunity'));
  check('63. evening low: reinforcement_arrival_delta present',  elFx.some(e => e.kind === 'reinforcement_arrival_delta'));
  const eArrL = findEffect(elFx, 'reinforcement_arrival_delta');
  eq(eArrL?.rounds, EVENING_LOW_ARRIVAL_DELTA, '64. evening low: arrival delta = EVENING_LOW_ARRIVAL_DELTA');

  // Evening: high and low have opposite arrival deltas
  check('65. evening: high arrival < 0 (earlier)', (eArrH?.rounds ?? 0) < 0);
  check('66. evening: low arrival > 0 (later)',   (eArrL?.rounds ?? 0) > 0);

  // NIGHT HIGH (≥70)
  const nightHigh = pressure('night', 90);
  const nhFx      = getPressureEffects(nightHigh);
  check('67. night high: readiness_enemy_bonus present',  nhFx.some(e => e.kind === 'readiness_enemy_bonus'));
  check('68. night high: latent_readiness_bonus present', nhFx.some(e => e.kind === 'latent_readiness_bonus'));
  check('69. night high: ambush_eligible present',        nhFx.some(e => e.kind === 'ambush_eligible'));
  const erE = findEffect(nhFx, 'readiness_enemy_bonus');
  eq(erE?.amount, NIGHT_HIGH_ENEMY_READINESS, '70. night high: enemy readiness = NIGHT_HIGH_ENEMY_READINESS');
  const lrE = findEffect(nhFx, 'latent_readiness_bonus');
  eq(lrE?.value, NIGHT_HIGH_LATENT_BONUS, '71. night high: latent bonus = NIGHT_HIGH_LATENT_BONUS');

  // NIGHT LOW (≤30)
  const nightLow = pressure('night', 10);
  const nlFx     = getPressureEffects(nightLow);
  check('72. night low: readiness_team_bonus present',  nlFx.some(e => e.kind === 'readiness_team_bonus'));
  check('73. night low: latent_threat_reveal present',  nlFx.some(e => e.kind === 'latent_threat_reveal'));
  check('74. night low: first_response_eligible present', nlFx.some(e => e.kind === 'first_response_eligible'));
  const ntbE = findEffect(nlFx, 'readiness_team_bonus');
  eq(ntbE?.amount, NIGHT_LOW_TEAM_READINESS, '75. night low: team readiness = NIGHT_LOW_TEAM_READINESS');

  // Stacking cap: each kind appears AT MOST ONCE per effect list
  const allLists = [dhFx, dlFx, ehFx, elFx, nhFx, nlFx];
  for (const fx of allLists) {
    const kinds = fx.map(e => e.kind);
    const unique = new Set(kinds);
    check(`76. no duplicate effect kinds in list of length ${fx.length}`, unique.size === kinds.length);
  }

  // Opposite effects never appear together in the same list
  for (const fx of allLists) {
    check('77. intent_hidden and intent_revealed never together',
      !(fx.some(e => e.kind === 'intent_hidden') && fx.some(e => e.kind === 'intent_revealed')));
    check('78. readiness_team_bonus and readiness_enemy_bonus never together',
      !(fx.some(e => e.kind === 'readiness_team_bonus') && fx.some(e => e.kind === 'readiness_enemy_bonus')));
  }
}

// ── 121–145: Effect query helpers ─────────────────────────────────────────────

console.log('\n── Effect query helpers ──');

{
  const dayH = getPressureEffects(pressure('day',     70));
  const dayL = getPressureEffects(pressure('day',     30));
  const eveH = getPressureEffects(pressure('evening', 80));
  const eveL = getPressureEffects(pressure('evening', 20));
  const ngtH = getPressureEffects(pressure('night',   90));
  const ngtL = getPressureEffects(pressure('night',   10));
  const mod_ = getPressureEffects(pressure('day',     50));

  // pressureTeamReadinessDelta
  eq(pressureTeamReadinessDelta(dayL), DAY_LOW_READINESS_BONUS,  '79. day low team readiness delta');
  eq(pressureTeamReadinessDelta(ngtL), NIGHT_LOW_TEAM_READINESS,  '80. night low team readiness delta');
  eq(pressureTeamReadinessDelta(dayH), 0,  '81. day high: no team bonus');
  eq(pressureTeamReadinessDelta(mod_), 0,  '82. moderate: no team bonus');

  // pressureEnemyReadinessDelta
  eq(pressureEnemyReadinessDelta(ngtH), NIGHT_HIGH_ENEMY_READINESS, '83. night high enemy readiness delta');
  eq(pressureEnemyReadinessDelta(dayH), 0, '84. day high: no enemy bonus');
  eq(pressureEnemyReadinessDelta(mod_), 0, '85. moderate: no enemy bonus');

  // pressureApPenalty
  eq(pressureApPenalty(dayH), DAY_HIGH_AP_PENALTY, '86. day high: AP penalty');
  eq(pressureApPenalty(dayL), 0,                   '87. day low: no AP penalty');
  eq(pressureApPenalty(mod_), 0,                   '88. moderate: no AP penalty');

  // pressureArrivalDelta
  eq(pressureArrivalDelta(eveH), EVENING_HIGH_ARRIVAL_DELTA, '89. evening high arrival delta (earlier)');
  eq(pressureArrivalDelta(eveL), EVENING_LOW_ARRIVAL_DELTA,  '90. evening low arrival delta (later)');
  eq(pressureArrivalDelta(dayH), 0, '91. day high: no arrival delta');
  eq(pressureArrivalDelta(mod_), 0, '92. moderate: no arrival delta');

  // pressureHidesIntent / pressureRevealsIntent
  check('93. evening high: hides intent',      pressureHidesIntent(eveH));
  check('94. evening low: reveals intent',     pressureRevealsIntent(eveL));
  check('95. evening low: does not hide',      !pressureHidesIntent(eveL));
  check('96. evening high: does not reveal',   !pressureRevealsIntent(eveH));
  check('97. moderate: does not hide',         !pressureHidesIntent(mod_));
  check('98. moderate: does not reveal',       !pressureRevealsIntent(mod_));

  // pressureRevealsLatent
  check('99. night low: reveals latent',       pressureRevealsLatent(ngtL));
  check('100. night high: no latent reveal',   !pressureRevealsLatent(ngtH));
  check('101. moderate: no latent reveal',     !pressureRevealsLatent(mod_));

  // pressureLatentBonus
  eq(pressureLatentBonus(ngtH), NIGHT_HIGH_LATENT_BONUS, '102. night high: latent bonus');
  eq(pressureLatentBonus(ngtL), 0, '103. night low: no latent bonus');
  eq(pressureLatentBonus(mod_), 0, '104. moderate: no latent bonus');
}

// ── 146–160: describePressure / describePressureEffects ───────────────────────

console.log('\n── describe functions ──');

{
  const ph = pressure('day', 72);
  const pm = pressure('evening', 50);
  const pl = pressure('night', 28);

  const dh = describePressure(ph);
  check('105. describePressure includes label',   dh.includes('Coordination Load'));
  check('106. describePressure includes value',   dh.includes('72'));
  check('107. describePressure includes level',   dh.toLowerCase().includes('high'));

  const dm = describePressure(pm);
  check('108. moderate includes Handoff Debt',    dm.includes('Handoff Debt'));
  check('109. moderate includes value 50',        dm.includes('50'));

  const dl = describePressure(pl);
  check('110. low includes Silent Risk',          dl.includes('Silent Risk'));
  check('111. low includes Low',                  dl.toLowerCase().includes('low'));

  // describePressureEffects
  const fx_day_high   = describePressureEffects(pressure('day',     80));
  const fx_day_low    = describePressureEffects(pressure('day',     20));
  const fx_eve_high   = describePressureEffects(pressure('evening', 80));
  const fx_eve_low    = describePressureEffects(pressure('evening', 20));
  const fx_ngt_high   = describePressureEffects(pressure('night',   80));
  const fx_ngt_low    = describePressureEffects(pressure('night',   20));
  const fx_moderate   = describePressureEffects(pressure('day',     50));

  check('112. moderate: empty string',    fx_moderate === '');
  check('113. day high: non-empty',       fx_day_high.length > 0);
  check('114. day low: non-empty',        fx_day_low.length > 0);
  check('115. evening high: non-empty',   fx_eve_high.length > 0);
  check('116. evening low: non-empty',    fx_eve_low.length > 0);
  check('117. night high: non-empty',     fx_ngt_high.length > 0);
  check('118. night low: non-empty',      fx_ngt_low.length > 0);

  // Key terms in each description
  check('119. day high mentions AP',         fx_day_high.includes('AP'));
  check('120. evening high mentions intent', fx_eve_high.toLowerCase().includes('intent'));
  check('121. night high mentions Enemy',    fx_ngt_high.includes('Enemy Readiness'));
  check('122. night low mentions First',     fx_ngt_low.includes('First Response'));
}

// ── 161–175: validatePressure ─────────────────────────────────────────────────

console.log('\n── validatePressure ──');

{
  // Valid
  for (const shift of ['day','evening','night'] as const) {
    for (const v of [0, 30, 50, 70, 100]) {
      eq(validatePressure(createPressure(shift, v)).length, 0,
        `123. valid (${shift}, ${v}): no errors`);
    }
  }

  // Non-integer value
  const bad1: ShiftPressure = { value: 50.5, shift: 'day', label: 'Coordination Load' };
  check('124. non-integer value: error', validatePressure(bad1).length > 0);

  // Out-of-range value
  const bad2: ShiftPressure = { value: 101, shift: 'day', label: 'Coordination Load' };
  check('125. value > 100: error', validatePressure(bad2).length > 0);
  const bad3: ShiftPressure = { value: -1, shift: 'day', label: 'Coordination Load' };
  check('126. value < 0: error', validatePressure(bad3).length > 0);

  // Wrong label
  const bad4: ShiftPressure = { value: 50, shift: 'day', label: 'Wrong Label' };
  check('127. wrong label: error',
    validatePressure(bad4).some(e => e.includes('label')));

  // Invalid shift (type cast to test runtime)
  const bad5 = { value: 50, shift: 'afternoon' as ShiftPressure['shift'], label: 'Coordination Load' };
  check('128. invalid shift: error', validatePressure(bad5).length > 0);
}

// ── 176–185: Constants ────────────────────────────────────────────────────────

console.log('\n── Constants ──');

eq(PRESSURE_HIGH_THRESHOLD, 70,   '129. HIGH_THRESHOLD = 70');
eq(PRESSURE_LOW_THRESHOLD,  30,   '130. LOW_THRESHOLD = 30');
eq(PRESSURE_MIN,             0,   '131. MIN = 0');
eq(PRESSURE_MAX,           100,   '132. MAX = 100');
eq(DAY_HIGH_AP_PENALTY,      1,   '133. DAY_HIGH_AP_PENALTY = 1');
eq(DAY_LOW_READINESS_BONUS,  5,   '134. DAY_LOW_READINESS_BONUS = 5');
eq(EVENING_HIGH_ARRIVAL_DELTA, -1,'135. EVENING_HIGH_ARRIVAL_DELTA = -1 (earlier)');
eq(EVENING_LOW_ARRIVAL_DELTA,   1,'136. EVENING_LOW_ARRIVAL_DELTA = +1 (later)');
eq(NIGHT_HIGH_ENEMY_READINESS, 10,'137. NIGHT_HIGH_ENEMY_READINESS = 10');
eq(NIGHT_LOW_TEAM_READINESS,   10,'138. NIGHT_LOW_TEAM_READINESS = 10');
check('139. NIGHT_HIGH_LATENT_BONUS > 0', NIGHT_HIGH_LATENT_BONUS > 0);
check('140. NIGHT_HIGH_LATENT_BONUS ≤ 1', NIGHT_HIGH_LATENT_BONUS <= 1);
eq(DEFAULT_PRESSURE_BY_SHIFT.day,     50, '141. default day = 50');
eq(DEFAULT_PRESSURE_BY_SHIFT.evening, 50, '142. default evening = 50');
eq(DEFAULT_PRESSURE_BY_SHIFT.night,   50, '143. default night = 50');

// HIGH threshold is between LOW and MAX
check('144. LOW < HIGH < MAX',
  PRESSURE_LOW_THRESHOLD < PRESSURE_HIGH_THRESHOLD &&
  PRESSURE_HIGH_THRESHOLD < PRESSURE_MAX);

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failures.length > 0) {
  console.error('\nFailed tests:');
  failures.forEach(f => console.error(`  • ${f}`));
  process.exit(1);
}
