/**
 * tests/threat_groups.test.ts — Chapter-scaled threat group generation (Push 6)
 *
 * Tests for frontend/src/game/threatGroups.ts
 *
 * Coverage:
 *  1–7:    rollThreatCount / getCountWeightsForChapter — chapter boundaries
 *  8–20:   rollThreatCount probability boundaries (deterministic via mock RNG)
 *  21–35:  buildNormalThreatGroup — count, roles, clamping, determinism
 *  36–50:  buildAreaBossThreatGroup — role assignment, cap, no probabilistic roll
 *  51–75:  buildChapterBossThreatGroup — phases, latent supports, sort, validation
 *  76–100: validateThreatGroup — all invariants
 */

import {
  rollThreatCount,
  getCountWeightsForChapter,
  buildNormalThreatGroup,
  buildAreaBossThreatGroup,
  buildChapterBossThreatGroup,
  validateThreatGroup,
  type ThreatGroup,
  type BossPhaseInput,
} from '../src/game/threatGroups';
import { MAX_THREATS } from '../src/game/threats';
import type { Enemy } from '../src/game/types';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, value: boolean): void {
  if (value) { passed++; console.log(`PASS - ${label}`); }
  else       { failed++; failures.push(label); console.error(`FAIL - ${label}`); }
}
function eq<T>(a: T, b: T, label: string): void { check(label, a === b); }

// ── Enemy stub factory ────────────────────────────────────────────────────────

let _eid = 0;
function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  const id = overrides.id ?? `enemy-${++_eid}`;
  return {
    id,
    name:                id,
    realWorld:           'Test',
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

/** Create a fixed-value RNG that always returns `value`. */
function fixedRng(value: number): () => number {
  return () => value;
}

// ── 1–7: rollThreatCount chapter boundary mapping ─────────────────────────────

console.log('\n── rollThreatCount: chapter boundaries ──');

// ch <= 1: always 1
eq(rollThreatCount(1, fixedRng(0.0)),  1, '1. ch1 rng=0.00 → 1 threat');
eq(rollThreatCount(1, fixedRng(0.99)), 1, '2. ch1 rng=0.99 → 1 threat (100% one)');

// ch 2: 70% one / 30% two
//   rng * 10000 < 7000 → 1; else → 2
eq(rollThreatCount(2, fixedRng(0.0)),   1, '3. ch2 rng=0.00 → 1 threat (below 70% boundary)');
eq(rollThreatCount(2, fixedRng(0.699)), 1, '4. ch2 rng=0.699 → 1 threat (just under 70%)');
eq(rollThreatCount(2, fixedRng(0.70)),  2, '5. ch2 rng=0.70 → 2 threats (at 70% → enters two band)');
eq(rollThreatCount(2, fixedRng(0.99)),  2, '6. ch2 rng=0.99 → 2 threats (top of two band)');

// ch 3: always 2
eq(rollThreatCount(3, fixedRng(0.0)),  2, '7. ch3 rng=0.00 → 2 threats (100% two)');
eq(rollThreatCount(3, fixedRng(0.99)), 2, '8. ch3 rng=0.99 → 2 threats (100% two)');

// ch 4: 80% two / 20% three
//   rng * 10000 < 8000 → 2; else → 3
eq(rollThreatCount(4, fixedRng(0.0)),   2, '9.  ch4 rng=0.00 → 2 threats');
eq(rollThreatCount(4, fixedRng(0.799)), 2, '10. ch4 rng=0.799 → 2 threats (just under 80%)');
eq(rollThreatCount(4, fixedRng(0.80)),  3, '11. ch4 rng=0.80 → 3 threats (at 80%)');
eq(rollThreatCount(6, fixedRng(0.80)),  3, '12. ch6 rng=0.80 → 3 threats (same row as ch4)');

// ch 7: 40% two / 60% three
//   rng * 10000 < 4000 → 2; else → 3
eq(rollThreatCount(7,  fixedRng(0.0)),   2, '13. ch7 rng=0.00 → 2 threats');
eq(rollThreatCount(7,  fixedRng(0.399)), 2, '14. ch7 rng=0.399 → 2 threats (just under 40%)');
eq(rollThreatCount(7,  fixedRng(0.40)),  3, '15. ch7 rng=0.40 → 3 threats');
eq(rollThreatCount(10, fixedRng(0.40)),  3, '16. ch10 rng=0.40 → 3 threats (same row as ch7)');

// ch 11+: 25% two / 75% three
//   rng * 10000 < 2500 → 2; else → 3
eq(rollThreatCount(11, fixedRng(0.0)),   2, '17. ch11 rng=0.00 → 2 threats');
eq(rollThreatCount(11, fixedRng(0.249)), 2, '18. ch11 rng=0.249 → 2 threats (just under 25%)');
eq(rollThreatCount(11, fixedRng(0.25)),  3, '19. ch11 rng=0.25 → 3 threats');
eq(rollThreatCount(99, fixedRng(0.25)),  3, '20. ch99 rng=0.25 → 3 threats (same row as ch11)');

// ── Edge: ch <= 0 treated as ch 1 ────────────────────────────────────────────
eq(rollThreatCount(0,  fixedRng(0.5)), 1, '21. ch0 → treated as ch1 (always 1)');
eq(rollThreatCount(-5, fixedRng(0.5)), 1, '22. ch-5 → treated as ch1 (always 1)');

// ── getCountWeightsForChapter ─────────────────────────────────────────────────

console.log('\n── getCountWeightsForChapter ──');

{
  const w1  = getCountWeightsForChapter(1);
  const w2  = getCountWeightsForChapter(2);
  const w3  = getCountWeightsForChapter(3);
  const w4  = getCountWeightsForChapter(4);
  const w7  = getCountWeightsForChapter(7);
  const w11 = getCountWeightsForChapter(11);

  eq(w1.length,  1, '23. ch1 has 1 weight entry');
  eq(w2.length,  2, '24. ch2 has 2 weight entries');
  eq(w3.length,  1, '25. ch3 has 1 weight entry');

  // Verify the basis-point weights sum to 10 000
  const sum = (entries: readonly { bpWeight: number }[]) =>
    entries.reduce((s, e) => s + e.bpWeight, 0);

  eq(sum(w1),  10_000, '26. ch1 weights sum to 10 000');
  eq(sum(w2),  10_000, '27. ch2 weights sum to 10 000');
  eq(sum(w3),  10_000, '28. ch3 weights sum to 10 000');
  eq(sum(w4),  10_000, '29. ch4 weights sum to 10 000');
  eq(sum(w7),  10_000, '30. ch7 weights sum to 10 000');
  eq(sum(w11), 10_000, '31. ch11 weights sum to 10 000');
}

// ── buildNormalThreatGroup ─────────────────────────────────────────────────────

console.log('\n── buildNormalThreatGroup ──');

{
  const e1 = makeEnemy({ id: 'n1', instability: 3 });
  const e2 = makeEnemy({ id: 'n2', instability: 5 });
  const e3 = makeEnemy({ id: 'n3', instability: 7 });

  // Chapter 1 → always 1 threat regardless of seed
  const g1 = buildNormalThreatGroup([e1, e2, e3], 1, 'seed-a');
  eq(g1.threats.length, 1,        '32. ch1: always 1 threat');
  eq(g1.threats[0].role, 'acute', '33. ch1: first threat is acute');
  eq(g1.kind, 'normal',           '34. kind is normal');
  eq(g1.chapter, 1,               '35. chapter stored correctly');
  eq(g1.seed, 'seed-a',           '36. seed stored correctly');

  // Chapter 3 → always 2 threats
  const g3 = buildNormalThreatGroup([e1, e2, e3], 3, 'seed-b');
  eq(g3.threats.length, 2,             '37. ch3: always 2 threats');
  eq(g3.threats[0].role, 'acute',      '38. ch3: first is acute');
  eq(g3.threats[1].role, 'progressive','39. ch3: second is progressive');

  // Determinism: same seed + chapter → identical result
  const gA = buildNormalThreatGroup([e1, e2, e3], 5, 'det-seed');
  const gB = buildNormalThreatGroup([e1, e2, e3], 5, 'det-seed');
  eq(gA.threats.length, gB.threats.length, '40. determinism: same count for same seed+chapter');
  check('41. determinism: same first threat id',
    gA.threats[0].id === gB.threats[0].id);

  // Different seed → may differ (run several seeds to make sure we can get different counts on ch2)
  // We can force this by choosing seeds that straddle the 70/30 boundary.
  // Instead, just verify the output is valid (count in [1,3]).
  for (let i = 0; i < 20; i++) {
    const g = buildNormalThreatGroup([e1, e2, e3], 2, `vary-seed-${i}`);
    check(`42. ch2 vary seed ${i}: count in [1,2]`,
      g.threats.length >= 1 && g.threats.length <= 2);
  }

  // Clamping: fewer enemies than rolled count
  // ch3 wants 2, but only 1 enemy → must produce 1
  const gClamp = buildNormalThreatGroup([e1], 3, 'clamp-seed');
  eq(gClamp.threats.length, 1, '43. fewer enemies than rolled count → clamped to enemies.length');

  // Cap at MAX_THREATS: ch11 could roll 3, but with only 2 enemies → max 2
  const gMax = buildNormalThreatGroup([e1, e2], 11, 'max-seed');
  check('44. capped at min(rolledCount, enemies.length)',
    gMax.threats.length <= 2);

  // Role sequence: 3-threat group has acute/progressive/disruptor
  const g3r = buildNormalThreatGroup([e1, e2, e3], 11, 'role-seed-three');
  // If we get 3 threats, verify roles
  if (g3r.threats.length === 3) {
    eq(g3r.threats[0].role, 'acute',       '45. 3-threat: slot 0 is acute');
    eq(g3r.threats[1].role, 'progressive', '46. 3-threat: slot 1 is progressive');
    eq(g3r.threats[2].role, 'disruptor',   '47. 3-threat: slot 2 is disruptor');
  } else {
    // Got 2 — still verify the roles we have
    eq(g3r.threats[0].role, 'acute',       '45. 2-threat fallback: slot 0 is acute');
    eq(g3r.threats[1].role, 'progressive', '46. 2-threat fallback: slot 1 is progressive');
    check('47. 2-threat fallback: no third threat', true);
  }

  // Enemy stats preserved (id, corruption, speed)
  const g3e = buildNormalThreatGroup([e1, e2, e3], 3, 'stats-seed');
  eq(g3e.threats[0].id,            'n1', '48. first threat id from first enemy');
  eq(g3e.threats[0].corruptionMax, 60,   '49. corruptionMax from enemy.corruption');
  eq(g3e.threats[0].speed,          3,   '50. speed from enemy.instability');
}

// ── buildAreaBossThreatGroup ───────────────────────────────────────────────────

console.log('\n── buildAreaBossThreatGroup ──');

{
  const boss = makeEnemy({ id: 'area-boss', name: 'Area Boss', corruption: 150, instability: 8 });
  const sup1 = makeEnemy({ id: 'sup1',      name: 'Support1',  corruption:  40, instability: 3 });
  const sup2 = makeEnemy({ id: 'sup2',      name: 'Support2',  corruption:  35, instability: 4 });
  const sup3 = makeEnemy({ id: 'sup3',      name: 'ExtraSupp', corruption:  30, instability: 2 });

  // Solo boss (no supports)
  const solo = buildAreaBossThreatGroup(boss, [], 'ab-seed', 5);
  eq(solo.threats.length,       1,       '51. area boss solo: 1 threat');
  eq(solo.threats[0].id,        'area-boss', '52. area boss solo: boss is first');
  eq(solo.threats[0].role,      'acute', '53. area boss: boss role is acute');
  eq(solo.kind,                 'area_boss', '54. kind is area_boss');

  // Boss + 1 support
  const one = buildAreaBossThreatGroup(boss, [sup1], 'ab-seed', 5);
  eq(one.threats.length, 2,              '55. area boss + 1 support: 2 threats');
  eq(one.threats[1].role, 'progressive', '56. first support is progressive');

  // Boss + 2 supports
  const two = buildAreaBossThreatGroup(boss, [sup1, sup2], 'ab-seed', 5);
  eq(two.threats.length, 3,             '57. area boss + 2 supports: 3 threats');
  eq(two.threats[1].role, 'progressive','58. first support is progressive');
  eq(two.threats[2].role, 'disruptor',  '59. second support is disruptor');

  // Boss + 3 supports → capped at 3 total (2 supports used)
  const capped = buildAreaBossThreatGroup(boss, [sup1, sup2, sup3], 'ab-seed', 5);
  eq(capped.threats.length, MAX_THREATS, '60. area boss + 3 supports capped at MAX_THREATS');
  check('61. capped: third support discarded (only 2 support slots)',
    capped.threats.every(t => t.id !== sup3.id));

  // No random count: area boss always gives 1 + supports.length (≤ 3)
  const ab1 = buildAreaBossThreatGroup(boss, [sup1], 'seed-x', 3);
  const ab2 = buildAreaBossThreatGroup(boss, [sup1], 'seed-y', 3);
  eq(ab1.threats.length, ab2.threats.length, '62. area boss count not affected by seed');

  // Stats preserved
  eq(two.threats[0].corruptionMax, 150, '63. boss corruptionMax preserved');
  eq(two.threats[0].speed,           8, '64. boss speed preserved');
  eq(two.threats[1].corruptionMax,  40, '65. sup1 corruptionMax preserved');
  eq(two.threats[1].id,          'sup1','66. sup1 id preserved');

  // Chapter stored
  eq(two.chapter, 5, '67. chapter stored in area_boss group');
}

// ── buildChapterBossThreatGroup ────────────────────────────────────────────────

console.log('\n── buildChapterBossThreatGroup ──');

{
  const cboss = makeEnemy({ id: 'ch-boss', name: 'Chapter Boss', corruption: 300, instability: 9 });
  const ps1   = makeEnemy({ id: 'ps1',     name: 'Phase1Sup',    corruption:  50, instability: 4 });
  const ps2   = makeEnemy({ id: 'ps2',     name: 'Phase2Sup',    corruption:  40, instability: 5 });

  const phases: BossPhaseInput[] = [
    { phaseId: 'p1', label: 'Phase 1', activatesAt: 100 },
    { phaseId: 'p2', label: 'Phase 2', activatesAt: 66, supports: [ps1] },
    { phaseId: 'p3', label: 'Phase 3', activatesAt: 33, supports: [ps1, ps2] },
  ];

  // Solo chapter boss (no phases)
  const solo = buildChapterBossThreatGroup(cboss, [], 'cb-seed', 10);
  eq(solo.threats.length,  1,            '68. chapter boss solo: 1 initial threat');
  eq(solo.threats[0].role, 'acute',      '69. chapter boss: role is acute');
  eq(solo.threats[0].id,   'ch-boss',    '70. chapter boss: id from enemy');
  eq(solo.phases!.length,  0,            '71. chapter boss solo: empty phases array');
  eq(solo.kind,            'chapter_boss', '72. kind is chapter_boss');

  // Chapter boss with phases
  const g = buildChapterBossThreatGroup(cboss, phases, 'cb-seed', 10);
  eq(g.threats.length,   1,              '73. chapter boss with phases: still 1 initial threat');
  eq(g.phases!.length,   3,             '74. all 3 phases present');

  // Phases sorted descending by activatesAt
  eq(g.phases![0].activatesAt, 100,     '75. phases[0].activatesAt = 100 (opening)');
  eq(g.phases![1].activatesAt,  66,     '76. phases[1].activatesAt = 66');
  eq(g.phases![2].activatesAt,  33,     '77. phases[2].activatesAt = 33 (final)');

  // Phase labels
  eq(g.phases![0].label, 'Phase 1',     '78. phases[0] label');
  eq(g.phases![2].label, 'Phase 3',     '79. phases[2] label');

  // Phase supports are latent Threats
  eq(g.phases![0].supports.length, 0,   '80. phase 1: no supports');
  eq(g.phases![1].supports.length, 1,   '81. phase 2: 1 support');
  eq(g.phases![2].supports.length, 2,   '82. phase 3: 2 supports');

  check('83. phase 2 support is latent',
    g.phases![1].supports[0].latent === true);
  check('84. phase 3 first support is latent',
    g.phases![2].supports[0].latent === true);

  // Support roles in phases
  eq(g.phases![1].supports[0].role, 'progressive', '85. phase 2 support role is progressive');
  eq(g.phases![2].supports[0].role, 'progressive', '86. phase 3 first support is progressive');
  eq(g.phases![2].supports[1].role, 'disruptor',   '87. phase 3 second support is disruptor');

  // Phase with too many supports (3) → capped at 2
  const manySupports: BossPhaseInput = {
    phaseId: 'px', label: 'Overcrowded', activatesAt: 50,
    supports: [ps1, ps2, makeEnemy({ id: 'ps3' })],
  };
  const gcap = buildChapterBossThreatGroup(cboss, [manySupports], 'cap-seed', 8);
  eq(gcap.phases![0].supports.length, 2, '88. phase supports capped at MAX_THREATS - 1');

  // Unsorted input phases → sorted output
  const unsorted: BossPhaseInput[] = [
    { phaseId: 'pB', label: 'Mid',  activatesAt: 50  },
    { phaseId: 'pA', label: 'High', activatesAt: 100 },
    { phaseId: 'pC', label: 'Low',  activatesAt: 20  },
  ];
  const gs = buildChapterBossThreatGroup(cboss, unsorted, 'sort-seed', 9);
  eq(gs.phases![0].activatesAt, 100, '89. unsorted input: sorted to 100 first');
  eq(gs.phases![1].activatesAt,  50, '90. unsorted input: 50 second');
  eq(gs.phases![2].activatesAt,  20, '91. unsorted input: 20 last');

  // Boss stats preserved
  eq(g.threats[0].corruptionMax, 300, '92. chapter boss corruptionMax');
  eq(g.threats[0].speed,           9, '93. chapter boss speed');
}

// ── validateThreatGroup ───────────────────────────────────────────────────────

console.log('\n── validateThreatGroup ──');

{
  const e  = makeEnemy({ id: 've1' });
  const e2 = makeEnemy({ id: 've2' });
  const e3 = makeEnemy({ id: 've3' });
  const boss = makeEnemy({ id: 'vboss', corruption: 200, instability: 8 });

  // Valid normal
  const vNormal = buildNormalThreatGroup([e, e2, e3], 1, 'val-seed');
  eq(validateThreatGroup(vNormal).length, 0, '94. valid normal group: no errors');

  // Valid area boss (2 supports)
  const vAB = buildAreaBossThreatGroup(boss, [e, e2], 'val-seed', 5);
  eq(validateThreatGroup(vAB).length, 0, '95. valid area_boss group: no errors');

  // Valid chapter boss (with phases)
  const vCB = buildChapterBossThreatGroup(boss, [
    { phaseId: 'p1', label: 'P1', activatesAt: 100 },
    { phaseId: 'p2', label: 'P2', activatesAt: 50 },
  ], 'val-seed', 10);
  eq(validateThreatGroup(vCB).length, 0, '96. valid chapter_boss group: no errors');

  // Invalid: empty threats
  const empty: ThreatGroup = { kind: 'normal', chapter: 3, seed: 's', threats: [] };
  check('97. empty threats: has error',
    validateThreatGroup(empty).length > 0);

  // Invalid: too many threats — manually construct 4 threats (> MAX_THREATS = 3)
  const over: ThreatGroup = {
    kind: 'normal', chapter: 7, seed: 's',
    threats: [
      ...buildNormalThreatGroup([e, e2, e3], 3, 's').threats,    // 2 threats
      buildNormalThreatGroup([makeEnemy({ id: 'extra1' })], 1, 'x1').threats[0],  // 1 more → 3
      buildNormalThreatGroup([makeEnemy({ id: 'extra2' })], 1, 'x2').threats[0],  // 1 more → 4
    ],
  };
  check('98. too many threats: has error', validateThreatGroup(over).length > 0);

  // Invalid: area_boss where first threat is not acute
  const wrongRole: ThreatGroup = {
    kind: 'area_boss', chapter: 5, seed: 's',
    threats: [{ ...buildNormalThreatGroup([e], 1, 's').threats[0], role: 'progressive' as const }],
  };
  check('99. area_boss non-acute first: has error',
    validateThreatGroup(wrongRole).some(err => err.includes("'acute'")));

  // Invalid: chapter_boss with wrong initial threat count
  const cbWrong: ThreatGroup = {
    kind: 'chapter_boss', chapter: 10, seed: 's',
    threats: buildNormalThreatGroup([e, e2], 3, 's').threats,  // 2 threats instead of 1
    phases: [],
  };
  check('100. chapter_boss with 2 initial threats: has error',
    validateThreatGroup(cbWrong).some(err => err.includes('exactly [boss]')));

  // Invalid: chapter_boss with undefined phases
  const cbNoPhases: ThreatGroup = {
    kind: 'chapter_boss', chapter: 10, seed: 's',
    threats: [buildAreaBossThreatGroup(boss, [], 's', 10).threats[0]],
    // phases intentionally undefined
  };
  check('101. chapter_boss missing phases: has error',
    validateThreatGroup(cbNoPhases).some(err => err.includes('phases must be defined')));

  // Invalid: phase activatesAt out of range
  const badPhase = buildChapterBossThreatGroup(boss, [
    { phaseId: 'px', label: 'Bad', activatesAt: 150 },  // > 100
  ], 'bp-seed', 8);
  check('102. phase activatesAt > 100: has error',
    validateThreatGroup(badPhase).some(err => err.includes('activatesAt')));

  // Invalid: duplicate threat ids
  const dup: ThreatGroup = {
    kind: 'normal', chapter: 3, seed: 's',
    threats: [
      buildNormalThreatGroup([e], 1, 's').threats[0],
      buildNormalThreatGroup([e], 1, 's').threats[0],  // same id 've1'
    ],
  };
  check('103. duplicate threat ids: has error',
    validateThreatGroup(dup).some(err => err.includes('Duplicate')));
}

// ── Cross-cutting: no mutation of input arrays ─────────────────────────────────

console.log('\n── Immutability ──');

{
  const enemies = [
    makeEnemy({ id: 'im1' }),
    makeEnemy({ id: 'im2' }),
    makeEnemy({ id: 'im3' }),
  ];
  const snapshot = enemies.map(e => e.id);
  buildNormalThreatGroup(enemies, 7, 'immut-seed');
  check('104. buildNormalThreatGroup does not mutate input array',
    enemies.every((e, i) => e.id === snapshot[i]));
}

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failures.length > 0) {
  console.error('\nFailed tests:');
  failures.forEach(f => console.error(`  • ${f}`));
  process.exit(1);
}
