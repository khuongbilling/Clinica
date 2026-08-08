/**
 * tests/opening_readiness.test.ts — Speed-based opening Readiness (Push 9)
 *
 * Tests for frontend/src/game/openingReadiness.ts
 *
 * Coverage:
 *   1–22:   calcTeamReadiness — avg, each bonus type, penalty, stacking
 *  23–40:   calcEnemyReadiness — avg, each modifier type, stacking
 *  41–70:   getOpeningOutcome — all 5 outcomes, every boundary value
 *  71–110:  calcOpeningReadiness — all outcome paths, all result fields
 * 111–130:  validateReadinessInputs — all error categories
 * 131–145:  speedOrderIndices — ordering, ties, single element
 * 146–155:  describeOutcome — all 5 outcomes
 * 156–165:  AMBUSH constraint — max 2 enemy actions, no two complete rounds
 */

import {
  calcTeamReadiness,
  calcEnemyReadiness,
  getOpeningOutcome,
  calcOpeningReadiness,
  validateReadinessInputs,
  speedOrderIndices,
  describeOutcome,
  FIRST_RESPONSE_THRESHOLD,
  TEAM_INITIATIVE_THRESHOLD,
  SPEED_ORDER_LOWER,
  ENEMY_INITIATIVE_THRESHOLD,
  AMBUSH_THRESHOLD,
  FIRST_RESPONSE_AP_BONUS,
  AMBUSH_MAX_ENEMY_ACTIONS,
  type TeamReadinessInput,
  type EnemyReadinessInput,
  type OpeningOutcome,
} from '../src/game/openingReadiness';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, value: boolean): void {
  if (value) { passed++; console.log(`PASS - ${label}`); }
  else       { failed++; failures.push(label); console.error(`FAIL - ${label}`); }
}
function eq<T>(a: T, b: T, label: string): void { check(label, a === b); }
function near(a: number, b: number, label: string, eps = 0.0001): void {
  check(label, Math.abs(a - b) < eps);
}

// ── Factories ─────────────────────────────────────────────────────────────────

function teamInput(
  heroSpeeds: number[],
  opts: Partial<Omit<TeamReadinessInput, 'heroSpeeds'>> = {},
): TeamReadinessInput {
  return {
    heroSpeeds,
    mapBonus:        opts.mapBonus        ?? 0,
    cardBonus:       opts.cardBonus       ?? 0,
    blessingBonus:   opts.blessingBonus   ?? 0,
    supportBonus:    opts.supportBonus    ?? 0,
    pressurePenalty: opts.pressurePenalty ?? 0,
  };
}

function enemyInput(
  threatSpeeds: number[],
  opts: Partial<Omit<EnemyReadinessInput, 'threatSpeeds'>> = {},
): EnemyReadinessInput {
  return {
    threatSpeeds,
    encounterAlertness: opts.encounterAlertness ?? 0,
    ambushBonus:        opts.ambushBonus        ?? 0,
    bossModifier:       opts.bossModifier       ?? 0,
  };
}

// ── 1–22: calcTeamReadiness ───────────────────────────────────────────────────

console.log('\n── calcTeamReadiness ──');

// Single hero
near(calcTeamReadiness(teamInput([6])), 6, '1. single hero speed=6 → 6.0');

// Multiple heroes: average
near(calcTeamReadiness(teamInput([4, 6])), 5, '2. avg([4,6]) = 5.0');
near(calcTeamReadiness(teamInput([3, 6, 9])), 6, '3. avg([3,6,9]) = 6.0');
near(calcTeamReadiness(teamInput([1, 2, 3])), 2, '4. avg([1,2,3]) = 2.0');

// Non-integer average is exact
near(calcTeamReadiness(teamInput([5, 6])), 5.5, '5. avg([5,6]) = 5.5');
near(calcTeamReadiness(teamInput([4, 5, 6])), 5, '6. avg([4,5,6]) = 5.0');

// mapBonus adds to average
near(calcTeamReadiness(teamInput([5], { mapBonus: 3 })), 8, '7. avg(5) + mapBonus(3) = 8');

// cardBonus adds
near(calcTeamReadiness(teamInput([5], { cardBonus: 2 })), 7, '8. avg(5) + cardBonus(2) = 7');

// blessingBonus adds
near(calcTeamReadiness(teamInput([5], { blessingBonus: 4 })), 9, '9. avg(5) + blessingBonus(4) = 9');

// supportBonus adds
near(calcTeamReadiness(teamInput([5], { supportBonus: 1 })), 6, '10. avg(5) + supportBonus(1) = 6');

// pressurePenalty subtracts
near(calcTeamReadiness(teamInput([8], { pressurePenalty: 3 })), 5, '11. avg(8) - penalty(3) = 5');

// All bonuses stack
near(
  calcTeamReadiness(teamInput([4], {
    mapBonus: 2, cardBonus: 1, blessingBonus: 1, supportBonus: 1, pressurePenalty: 1,
  })),
  8, '12. avg(4) + map(2)+card(1)+blessing(1)+support(1) - penalty(1) = 8',
);

// Penalty can push readiness below 0
check('13. penalty can push readiness negative',
  calcTeamReadiness(teamInput([2], { pressurePenalty: 10 })) < 0);

// Zero bonuses and penalty: result = avg
near(calcTeamReadiness(teamInput([7])), 7, '14. no modifiers → readiness = avg speed');

// High speed team
near(calcTeamReadiness(teamInput([10, 10, 10])), 10, '15. all max speed → 10');

// Low speed team
near(calcTeamReadiness(teamInput([1, 1, 1])), 1, '16. all min speed → 1');

// Fractional average preserved
near(calcTeamReadiness(teamInput([5, 5, 6])), 16/3, '17. [5,5,6] → 16/3');

// Only pressure: no bonuses
near(calcTeamReadiness(teamInput([6], { pressurePenalty: 6 })), 0, '18. avg=6, penalty=6 → 0');

// Support and map cancel penalty
near(
  calcTeamReadiness(teamInput([5], { mapBonus: 2, supportBonus: 2, pressurePenalty: 4 })),
  5, '19. map+support cancel penalty → 5',
);

// 4-hero team
near(calcTeamReadiness(teamInput([4, 6, 8, 10])), 7, '20. avg([4,6,8,10]) = 7');

// Order of heroSpeeds doesn't affect result (it's an average)
const r1 = calcTeamReadiness(teamInput([3, 7]));
const r2 = calcTeamReadiness(teamInput([7, 3]));
near(r1, r2, '21. order of heroSpeeds does not affect result');

// Each bonus type contributes independently
near(calcTeamReadiness(teamInput([0], { mapBonus: 5 })), 5, '22. zero avg + mapBonus(5) = 5');

// ── 23–40: calcEnemyReadiness ─────────────────────────────────────────────────

console.log('\n── calcEnemyReadiness ──');

// Single threat
near(calcEnemyReadiness(enemyInput([7])), 7, '23. single threat speed=7 → 7');

// Multiple threats: average
near(calcEnemyReadiness(enemyInput([5, 7])), 6, '24. avg([5,7]) = 6');
near(calcEnemyReadiness(enemyInput([3, 6, 9])), 6, '25. avg([3,6,9]) = 6');

// encounterAlertness adds
near(calcEnemyReadiness(enemyInput([5], { encounterAlertness: 4 })), 9,
  '26. avg(5) + alertness(4) = 9');

// ambushBonus adds
near(calcEnemyReadiness(enemyInput([5], { ambushBonus: 6 })), 11,
  '27. avg(5) + ambushBonus(6) = 11');

// bossModifier adds
near(calcEnemyReadiness(enemyInput([5], { bossModifier: 3 })), 8,
  '28. avg(5) + bossModifier(3) = 8');

// All enemy modifiers stack
near(
  calcEnemyReadiness(enemyInput([4], {
    encounterAlertness: 2, ambushBonus: 3, bossModifier: 1,
  })),
  10, '29. avg(4)+alertness(2)+ambush(3)+boss(1) = 10',
);

// Zero modifiers → avg
near(calcEnemyReadiness(enemyInput([8])), 8, '30. no modifiers → readiness = avg speed');

// Fractional average
near(calcEnemyReadiness(enemyInput([5, 6])), 5.5, '31. avg([5,6]) = 5.5');

// Large ambush bonus for night scenario
near(calcEnemyReadiness(enemyInput([5], { ambushBonus: 12 })), 17,
  '32. night ambush scenario: avg(5)+bonus(12) = 17');

// Boss with three threats
near(calcEnemyReadiness(enemyInput([7, 5, 6], { bossModifier: 3 })),
  6 + 3, '33. avg([7,5,6])+boss(3) = 9');

// ── 41–70: getOpeningOutcome ──────────────────────────────────────────────────

console.log('\n── getOpeningOutcome ──');

// Exact threshold values
eq(getOpeningOutcome(FIRST_RESPONSE_THRESHOLD),    'first_response',   '34. delta=15 → first_response');
eq(getOpeningOutcome(TEAM_INITIATIVE_THRESHOLD),   'team_initiative',  '35. delta=5 → team_initiative');
eq(getOpeningOutcome(SPEED_ORDER_LOWER),           'speed_order',      '36. delta=-4 → speed_order');
eq(getOpeningOutcome(ENEMY_INITIATIVE_THRESHOLD),  'enemy_initiative', '37. delta=-5 → enemy_initiative');
eq(getOpeningOutcome(AMBUSH_THRESHOLD),            'ambush',           '38. delta=-15 → ambush');

// Mid-range values
eq(getOpeningOutcome(20),   'first_response',   '39. delta=20 → first_response');
eq(getOpeningOutcome(10),   'team_initiative',  '40. delta=10 → team_initiative');
eq(getOpeningOutcome(0),    'speed_order',      '41. delta=0 → speed_order');
eq(getOpeningOutcome(-10),  'enemy_initiative', '42. delta=-10 → enemy_initiative');
eq(getOpeningOutcome(-20),  'ambush',           '43. delta=-20 → ambush');

// Just inside each threshold
eq(getOpeningOutcome(14),    'team_initiative',  '44. delta=14 → team_initiative (not first_response)');
eq(getOpeningOutcome(16),    'first_response',   '45. delta=16 → first_response');
eq(getOpeningOutcome(4),     'speed_order',      '46. delta=4 → speed_order (not team_initiative)');
eq(getOpeningOutcome(-4),    'speed_order',      '47. delta=-4 → speed_order (not enemy_initiative)');
eq(getOpeningOutcome(-6),    'enemy_initiative', '48. delta=-6 → enemy_initiative');
eq(getOpeningOutcome(-14),   'enemy_initiative', '49. delta=-14 → enemy_initiative (not ambush)');
eq(getOpeningOutcome(-16),   'ambush',           '50. delta=-16 → ambush');

// Fractional deltas near boundaries
eq(getOpeningOutcome(14.9),  'team_initiative',  '51. delta=14.9 → team_initiative');
eq(getOpeningOutcome(15.0),  'first_response',   '52. delta=15.0 → first_response');
eq(getOpeningOutcome(4.9),   'speed_order',      '53. delta=4.9 → speed_order');
eq(getOpeningOutcome(-4.9),  'speed_order',      '54. delta=-4.9 → speed_order');
eq(getOpeningOutcome(-5.0),  'enemy_initiative', '55. delta=-5.0 → enemy_initiative');
eq(getOpeningOutcome(-14.9), 'enemy_initiative', '56. delta=-14.9 → enemy_initiative');
eq(getOpeningOutcome(-15.0), 'ambush',           '57. delta=-15.0 → ambush');

// Extreme values
eq(getOpeningOutcome(100),  'first_response', '58. very high delta → first_response');
eq(getOpeningOutcome(-100), 'ambush',         '59. very low delta → ambush');

// ── 71–110: calcOpeningReadiness ──────────────────────────────────────────────

console.log('\n── calcOpeningReadiness ──');

// First Response: delta ≥ 15
{
  const t = teamInput([10, 9], { mapBonus: 3 }); // avg=9.5 + 3 = 12.5
  const e = enemyInput([3]);                      // avg=3
  // delta = 12.5 - 3 = 9.5 … not quite 15. Let me make it bigger:
  const t2 = teamInput([10, 10], { mapBonus: 10 }); // 10+10=20
  const e2 = enemyInput([5]);                        // 5 → delta=15
  const r = calcOpeningReadiness(t2, e2);

  eq(r.outcome,                'first_response', '60. delta=15 → first_response');
  eq(r.apBonus,                FIRST_RESPONSE_AP_BONUS, '61. apBonus = 1 for first_response');
  eq(r.maxEnemyOpeningActions, 0,               '62. no enemy opening actions for first_response');
  near(r.delta, 15,                              '63. delta = 15');
  eq(r.openingActorIndex, 0,                     '64. fastest hero is index 0 (both speed=10, first wins)');
}

// Team Initiative: 5 ≤ delta < 15
{
  const t = teamInput([8, 6]); // avg=7
  const e = enemyInput([3]);   // 3 → delta=4 … need bigger gap
  const t2 = teamInput([8, 8]); // avg=8
  const e2 = enemyInput([3]);   // delta=5
  const r = calcOpeningReadiness(t2, e2);

  eq(r.outcome,                'team_initiative', '65. delta=5 → team_initiative');
  eq(r.apBonus,                0,                 '66. apBonus = 0 for team_initiative');
  eq(r.maxEnemyOpeningActions, 0,                 '67. no enemy opening actions for team_initiative');
  eq(r.openingActorIndex,      0,                 '68. fastest hero index (tie → first)');
}

// Team Initiative: opening actor index picks fastest hero
{
  const t = teamInput([4, 9, 6]); // avg=19/3≈6.33; hero 1 is fastest
  const e = enemyInput([1]);      // delta≈5.33 → team_initiative
  const r = calcOpeningReadiness(t, e);
  eq(r.outcome,           'team_initiative', '69. opens as team_initiative');
  eq(r.openingActorIndex, 1,                 '70. fastest hero is index 1 (speed=9)');
}

// Speed Order: -4 ≤ delta ≤ 4
{
  const t = teamInput([5]);  // 5
  const e = enemyInput([5]); // 5 → delta=0
  const r = calcOpeningReadiness(t, e);

  eq(r.outcome,                'speed_order', '71. delta=0 → speed_order');
  eq(r.apBonus,                0,             '72. apBonus = 0 for speed_order');
  eq(r.maxEnemyOpeningActions, 0,             '73. no enemy opening actions for speed_order');
  eq(r.openingActorIndex,      -1,            '74. openingActorIndex = -1 for speed_order');
}

// Speed Order at boundaries
{
  // delta = 9-5 = 4 → speed_order
  const rPos4 = calcOpeningReadiness(teamInput([9]), enemyInput([5]));
  eq(rPos4.outcome, 'speed_order', '75. delta=4 → speed_order');
  const rNeg4 = calcOpeningReadiness(teamInput([5]), enemyInput([9]));
  eq(rNeg4.outcome, 'speed_order', '76. delta=-4 → speed_order');
}

// Enemy Initiative: -14 ≤ delta ≤ -5
{
  const t = teamInput([3]);  // 3
  const e = enemyInput([8]); // 8 → delta=-5
  const r = calcOpeningReadiness(t, e);

  eq(r.outcome,                'enemy_initiative', '77. delta=-5 → enemy_initiative');
  eq(r.apBonus,                0,                  '78. apBonus = 0 for enemy_initiative');
  eq(r.maxEnemyOpeningActions, 0,                  '79. no enemy opening actions for enemy_initiative');
  eq(r.openingActorIndex,      0,                  '80. fastest threat is index 0');
}

// Enemy Initiative: fastest threat index
{
  const t = teamInput([2]);          // 2
  const e = enemyInput([4, 9, 7]);  // avg=20/3≈6.67 → delta≈2-6.67=-4.67 … hmm
  // Need delta in [-14,-5]: let me use avg=8 for threats, avg=2 for team → delta=-6
  const e2 = enemyInput([7, 9]); // avg=8 → delta=2-8=-6
  const r = calcOpeningReadiness(teamInput([2]), e2);
  eq(r.outcome,           'enemy_initiative', '81. enemy_initiative with 2 threats');
  eq(r.openingActorIndex, 1,                  '82. fastest threat is index 1 (speed=9)');
}

// Ambush: delta ≤ -15
{
  const t = teamInput([2], { pressurePenalty: 2 }); // 2-2=0
  const e = enemyInput([5], { ambushBonus: 10 });   // 5+10=15 → delta=-15
  const r = calcOpeningReadiness(t, e);

  eq(r.outcome,                'ambush',               '83. delta=-15 → ambush');
  eq(r.apBonus,                0,                      '84. apBonus = 0 for ambush');
  eq(r.maxEnemyOpeningActions, AMBUSH_MAX_ENEMY_ACTIONS, '85. maxEnemyOpeningActions = 2');
  eq(r.openingActorIndex,      0,                      '86. fastest threat index for ambush');
}

// Ambush: fastest threat index is selected
{
  const t = teamInput([1]);
  const e = enemyInput([3, 8, 5], { ambushBonus: 10 }); // avg≈5.33+10=15.33 → delta=1-15.33=-14.33
  // Need bigger gap: ambushBonus=14 → avg=5.33+14=19.33 → delta=1-19.33=-18.33
  const e2 = enemyInput([3, 8, 5], { ambushBonus: 14 });
  const r = calcOpeningReadiness(teamInput([1]), e2);
  eq(r.outcome,           'ambush', '87. deep ambush scenario');
  eq(r.openingActorIndex, 1,        '88. fastest threat is index 1 (speed=8)');
}

// readiness values are returned correctly
{
  const t = teamInput([6], { mapBonus: 2 }); // 6+2=8
  const e = enemyInput([5], { encounterAlertness: 1 }); // 5+1=6
  const r = calcOpeningReadiness(t, e);
  near(r.teamReadiness,  8, '89. teamReadiness = 8');
  near(r.enemyReadiness, 6, '90. enemyReadiness = 6');
  near(r.delta,          2, '91. delta = 2');
}

// ── 111–130: validateReadinessInputs ──────────────────────────────────────────

console.log('\n── validateReadinessInputs ──');

// Valid inputs
eq(validateReadinessInputs(teamInput([5]), enemyInput([5])).length, 0,
  '92. valid inputs: no errors');
eq(validateReadinessInputs(teamInput([1, 10]), enemyInput([1, 5, 10])).length, 0,
  '93. valid boundary speeds: no errors');

// Empty heroSpeeds
check('94. empty heroSpeeds: has error',
  validateReadinessInputs(teamInput([]), enemyInput([5])).some(e => e.includes('heroSpeeds')));

// Empty threatSpeeds
check('95. empty threatSpeeds: has error',
  validateReadinessInputs(teamInput([5]), enemyInput([])).some(e => e.includes('threatSpeeds')));

// Hero speed out of range
check('96. heroSpeed=0: has error',
  validateReadinessInputs(teamInput([0]), enemyInput([5])).length > 0);
check('97. heroSpeed=11: has error',
  validateReadinessInputs(teamInput([11]), enemyInput([5])).length > 0);

// Threat speed out of range
check('98. threatSpeed=0: has error',
  validateReadinessInputs(teamInput([5]), enemyInput([0])).length > 0);
check('99. threatSpeed=11: has error',
  validateReadinessInputs(teamInput([5]), enemyInput([11])).length > 0);

// Negative penalty
check('100. negative pressurePenalty: has error',
  validateReadinessInputs(teamInput([5], { pressurePenalty: -1 }), enemyInput([5])).length > 0);

// Negative team bonus
check('101. negative mapBonus: has error',
  validateReadinessInputs(teamInput([5], { mapBonus: -1 }), enemyInput([5])).length > 0);
check('102. negative cardBonus: has error',
  validateReadinessInputs(teamInput([5], { cardBonus: -1 }), enemyInput([5])).length > 0);
check('103. negative blessingBonus: has error',
  validateReadinessInputs(teamInput([5], { blessingBonus: -1 }), enemyInput([5])).length > 0);
check('104. negative supportBonus: has error',
  validateReadinessInputs(teamInput([5], { supportBonus: -1 }), enemyInput([5])).length > 0);

// Negative enemy modifier
check('105. negative encounterAlertness: has error',
  validateReadinessInputs(teamInput([5]), enemyInput([5], { encounterAlertness: -1 })).length > 0);
check('106. negative ambushBonus: has error',
  validateReadinessInputs(teamInput([5]), enemyInput([5], { ambushBonus: -1 })).length > 0);
check('107. negative bossModifier: has error',
  validateReadinessInputs(teamInput([5]), enemyInput([5], { bossModifier: -1 })).length > 0);

// Non-finite speed
check('108. Infinity heroSpeed: has error',
  validateReadinessInputs(teamInput([Infinity]), enemyInput([5])).length > 0);
check('109. NaN threatSpeed: has error',
  validateReadinessInputs(teamInput([5]), enemyInput([NaN])).length > 0);

// Multiple errors reported together
const multiErrors = validateReadinessInputs(
  teamInput([], { mapBonus: -2 }),
  enemyInput([0]),
);
check('110. multiple validation errors reported',  multiErrors.length >= 3);

// ── 131–145: speedOrderIndices ────────────────────────────────────────────────

console.log('\n── speedOrderIndices ──');

{
  // Sorted descending
  const order = speedOrderIndices([3, 7, 5]);
  eq(order[0], 1, '111. fastest (7) is at index 1 → appears first');
  eq(order[1], 2, '112. second (5) is at index 2');
  eq(order[2], 0, '113. slowest (3) is at index 0 → appears last');

  // Ties: lower original index wins
  const tie = speedOrderIndices([5, 5, 5]);
  eq(tie[0], 0, '114. tie: index 0 wins first position');
  eq(tie[1], 1, '115. tie: index 1 wins second');
  eq(tie[2], 2, '116. tie: index 2 wins third');

  // Single element
  const single = speedOrderIndices([8]);
  eq(single.length, 1, '117. single element: length 1');
  eq(single[0], 0, '118. single element: index 0');

  // Descending input (already sorted)
  const desc = speedOrderIndices([10, 7, 3]);
  eq(desc[0], 0, '119. already-sorted: first is fastest');
  eq(desc[2], 2, '120. already-sorted: last is slowest');

  // Ascending input (reversed)
  const asc = speedOrderIndices([3, 7, 10]);
  eq(asc[0], 2, '121. ascending: fastest is at index 2');
  eq(asc[2], 0, '122. ascending: slowest is at index 0');

  // Partial tie at top
  const topTie = speedOrderIndices([9, 9, 3]);
  eq(topTie[0], 0, '123. top tie: lower index wins');
  eq(topTie[1], 1, '124. top tie: higher index second');
  eq(topTie[2], 2, '125. bottom after top tie');

  // Length preserved
  const lens = speedOrderIndices([5, 6, 7, 4]);
  eq(lens.length, 4, '126. 4-element: length preserved');
}

// ── 146–155: describeOutcome ──────────────────────────────────────────────────

console.log('\n── describeOutcome ──');

{
  const outcomes: OpeningOutcome[] = [
    'first_response', 'team_initiative', 'speed_order', 'enemy_initiative', 'ambush',
  ];
  outcomes.forEach(o => {
    check(`127. describeOutcome('${o}') is non-empty`, describeOutcome(o).length > 0);
  });

  // Key terms in descriptions
  check('128. first_response mentions AP',    describeOutcome('first_response').includes('+1'));
  check('129. ambush mentions opening actions or acts first',
    describeOutcome('ambush').toLowerCase().includes('ambush'));
  check('130. enemy_initiative mentions enemy', describeOutcome('enemy_initiative').toLowerCase().includes('enemy'));

  // All distinct
  const descs = outcomes.map(describeOutcome);
  eq(new Set(descs).size, outcomes.length, '131. all outcome descriptions are distinct');
}

// ── 156–165: Ambush constraint ────────────────────────────────────────────────

console.log('\n── Ambush constraint ──');

{
  // Ambush gives exactly AMBUSH_MAX_ENEMY_ACTIONS = 2
  const t = teamInput([1]);
  const e = enemyInput([1], { ambushBonus: 15 }); // 1+15=16 → delta=-15 → ambush
  const r = calcOpeningReadiness(t, e);

  eq(r.outcome,                'ambush',               '132. ambush confirmed');
  eq(r.maxEnemyOpeningActions, 2,                      '133. exactly 2 enemy opening actions');
  eq(r.maxEnemyOpeningActions, AMBUSH_MAX_ENEMY_ACTIONS, '134. matches constant');

  // Non-ambush outcomes have 0 enemy opening actions
  for (const outcome of ['first_response', 'team_initiative', 'speed_order', 'enemy_initiative'] as const) {
    // Build scenarios for each
    const scenarios: Record<string, [TeamReadinessInput, EnemyReadinessInput]> = {
      first_response:   [teamInput([10], { mapBonus: 10 }), enemyInput([5])],
      team_initiative:  [teamInput([8]),                    enemyInput([3])],
      speed_order:      [teamInput([5]),                    enemyInput([5])],
      enemy_initiative: [teamInput([3]),                    enemyInput([8])],
    };
    const [ti, ei] = scenarios[outcome];
    const rr = calcOpeningReadiness(ti, ei);
    if (rr.outcome === outcome) {
      eq(rr.maxEnemyOpeningActions, 0, `135. ${outcome}: maxEnemyOpeningActions = 0`);
    }
  }

  // Ambush still uses openingActorIndex (fastest threat)
  const r2 = calcOpeningReadiness(
    teamInput([1]),
    enemyInput([3, 9, 5], { ambushBonus: 12 }), // avg=17/3≈5.67+12=17.67 → delta≈-16.67
  );
  eq(r2.outcome,           'ambush', '136. ambush with 3 threats');
  eq(r2.openingActorIndex, 1,        '137. fastest threat (9) at index 1 acts first in ambush');

  // Constant sanity
  eq(AMBUSH_MAX_ENEMY_ACTIONS, 2, '138. AMBUSH_MAX_ENEMY_ACTIONS = 2');
  eq(FIRST_RESPONSE_AP_BONUS,  1, '139. FIRST_RESPONSE_AP_BONUS = 1');
}

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failures.length > 0) {
  console.error('\nFailed tests:');
  failures.forEach(f => console.error(`  • ${f}`));
  process.exit(1);
}
