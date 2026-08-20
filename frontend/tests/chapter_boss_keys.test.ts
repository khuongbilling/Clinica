/**
 * tests/chapter_boss_keys.test.ts — Area Boss key progression (Push 13)
 *
 * Tests for frontend/src/game/journeyMap/chapterBossKeys.ts
 *
 * Coverage:
 *   1–20:   Constants — CHAPTER_BOSS_KEY_REQUIREMENT, AREA_BOSS_MAP_MAX, KEYS_PER_MAP_MAX
 *  21–45:   areaBossProbabilityBp — all chapter ranges, boundaries
 *  46–55:   areaBossEnabled — enabled/disabled by chapter
 *  56–75:   createChapterBossKeyState — factory, initial values, clamping
 *  76–110:  claimAreaBossKey — award, idempotency, deduplication, clamp at 3
 * 111–125:  claimAreaBossKeys — batch claim, idempotent batch
 * 126–140:  isChapterBossGateOpen — gate open/closed thresholds
 * 141–155:  getKeyProgress / describeKeyProgress — structured summary
 * 156–175:  checkRechallengeEligibility — all ineligible cases, eligible cases
 * 176–200:  buildRechallengeMapSpec — preserved/reset fields, attempt increment
 * 201–215:  simulateMultiRunKeyProgression — cross-run key carry-forward
 * 216–235:  validateChapterBossKeyState — all invariants
 * 236–250:  Immutability — original state never mutated
 */

import {
  CHAPTER_BOSS_KEY_REQUIREMENT,
  AREA_BOSS_MAP_MAX,
  KEYS_PER_MAP_MAX,
  RECHALLENGE_MAP_LABEL,
  RECHALLENGE_RESET_FIELDS,
  RECHALLENGE_PRESERVED_FIELDS,
  areaBossProbabilityBp,
  areaBossEnabled,
  createChapterBossKeyState,
  claimAreaBossKey,
  claimAreaBossKeys,
  isChapterBossGateOpen,
  getKeyProgress,
  describeKeyProgress,
  checkRechallengeEligibility,
  buildRechallengeMapSpec,
  simulateMultiRunKeyProgression,
  validateChapterBossKeyState,
  type ChapterBossKeyState,
  type RechallengeMapInput,
} from '../src/game/journeyMap/chapterBossKeys';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, value: boolean): void {
  if (value) { passed++; console.log(`PASS - ${label}`); }
  else       { failed++; failures.push(label); console.error(`FAIL - ${label}`); }
}
function eq<T>(a: T, b: T, label: string): void { check(label, a === b); }

// ── Factory ───────────────────────────────────────────────────────────────────

function state(chapterId: number, keys = 0, tileIds: string[] = []): ChapterBossKeyState {
  return createChapterBossKeyState(chapterId, keys, tileIds);
}

function input(overrides: Partial<RechallengeMapInput> = {}): RechallengeMapInput {
  return {
    playerId:              'player-1',
    chapterId:             5,
    shift:                 'day',
    currentAttemptNumber:  1,
    chapterBossDefeated:   false,
    ...overrides,
  };
}

// ── 1–20: Constants ───────────────────────────────────────────────────────────

console.log('\n── Constants ──');

eq(CHAPTER_BOSS_KEY_REQUIREMENT, 3,               '1. CHAPTER_BOSS_KEY_REQUIREMENT = 3');
eq(AREA_BOSS_MAP_MAX,            3,               '2. AREA_BOSS_MAP_MAX = 3');
eq(KEYS_PER_MAP_MAX,             AREA_BOSS_MAP_MAX,'3. KEYS_PER_MAP_MAX = AREA_BOSS_MAP_MAX');
eq(RECHALLENGE_MAP_LABEL,       'Rechallenge Map','4. RECHALLENGE_MAP_LABEL correct');
check('5. RECHALLENGE_RESET_FIELDS is non-empty',      RECHALLENGE_RESET_FIELDS.length > 0);
check('6. RECHALLENGE_PRESERVED_FIELDS is non-empty',  RECHALLENGE_PRESERVED_FIELDS.length > 0);
check('7. reset includes seed',                        RECHALLENGE_RESET_FIELDS.includes('seed'));
check('8. reset includes fogState',                    RECHALLENGE_RESET_FIELDS.includes('fogState'));
check('9. reset includes callTeam',                    RECHALLENGE_RESET_FIELDS.includes('callTeam'));
check('10. reset includes protocolCards',              RECHALLENGE_RESET_FIELDS.includes('protocolCards'));
check('11. reset includes wardBlessings',              RECHALLENGE_RESET_FIELDS.includes('wardBlessings'));
check('12. reset includes wardHazards',                RECHALLENGE_RESET_FIELDS.includes('wardHazards'));
check('13. preserved includes chapterBossKeysCollected',
  RECHALLENGE_PRESERVED_FIELDS.includes('chapterBossKeysCollected'));
check('14. preserved includes claimedTileIds',
  RECHALLENGE_PRESERVED_FIELDS.includes('claimedTileIds'));
check('15. preserved includes shiftChoice',
  RECHALLENGE_PRESERVED_FIELDS.includes('shiftChoice'));

// No overlap between reset and preserved
{
  const resetSet = new Set(RECHALLENGE_RESET_FIELDS as readonly string[]);
  const preservedSet = new Set(RECHALLENGE_PRESERVED_FIELDS as readonly string[]);
  const overlap = [...resetSet].filter(f => preservedSet.has(f));
  eq(overlap.length, 0, '16. no overlap between reset and preserved fields');
}

check('17. KEYS_PER_MAP_MAX ≤ CHAPTER_BOSS_KEY_REQUIREMENT',
  KEYS_PER_MAP_MAX <= CHAPTER_BOSS_KEY_REQUIREMENT);
check('18. CHAPTER_BOSS_KEY_REQUIREMENT > 0', CHAPTER_BOSS_KEY_REQUIREMENT > 0);
check('19. AREA_BOSS_MAP_MAX > 0',            AREA_BOSS_MAP_MAX > 0);
check('20. all constants are integers',
  Number.isInteger(CHAPTER_BOSS_KEY_REQUIREMENT) &&
  Number.isInteger(AREA_BOSS_MAP_MAX) &&
  Number.isInteger(KEYS_PER_MAP_MAX));

// ── 21–45: areaBossProbabilityBp ─────────────────────────────────────────────

console.log('\n── areaBossProbabilityBp ──');

// Ch 1: 3%; Ch 2–3 remain 0%.
eq(areaBossProbabilityBp(1), 300,   '21. ch1 → 300 bp (3% campus expedition)');
eq(areaBossProbabilityBp(2),   0,   '22. ch2 → 0 bp');
eq(areaBossProbabilityBp(3),   0,   '23. ch3 → 0 bp (boundary)');

// Ch 4–10: 3%
eq(areaBossProbabilityBp(4),   300, '24. ch4 → 300 bp (3%)');
eq(areaBossProbabilityBp(7),   300, '25. ch7 → 300 bp (mid)');
eq(areaBossProbabilityBp(10),  300, '26. ch10 → 300 bp (boundary)');

// Ch 11–20: 4%
eq(areaBossProbabilityBp(11),  400, '27. ch11 → 400 bp (4%)');
eq(areaBossProbabilityBp(15),  400, '28. ch15 → 400 bp (mid)');
eq(areaBossProbabilityBp(20),  400, '29. ch20 → 400 bp (boundary)');

// Ch 21+: 5%
eq(areaBossProbabilityBp(21),  500, '30. ch21 → 500 bp (5%)');
eq(areaBossProbabilityBp(50),  500, '31. ch50 → 500 bp');
eq(areaBossProbabilityBp(100), 500, '32. ch100 → 500 bp');

// Boundary pairs
eq(areaBossProbabilityBp(3),   0,   '33. ch3 → 0 (last zero-rate chapter)');
eq(areaBossProbabilityBp(4),   300, '34. ch4 → 300 (first non-zero chapter)');
eq(areaBossProbabilityBp(10),  300, '35. ch10 → 300 (last 3% chapter)');
eq(areaBossProbabilityBp(11),  400, '36. ch11 → 400 (first 4% chapter)');
eq(areaBossProbabilityBp(20),  400, '37. ch20 → 400 (last 4% chapter)');
eq(areaBossProbabilityBp(21),  500, '38. ch21 → 500 (first 5% chapter)');

// Edge: ch 0 and negative
eq(areaBossProbabilityBp(0),   0,   '39. ch0 → 0 (clamped)');
eq(areaBossProbabilityBp(-1),  0,   '40. ch-1 → 0 (clamped)');

// Values are strictly increasing (0 → 300 → 400 → 500)
check('41. ch4 > ch3 rate',   areaBossProbabilityBp(4)  > areaBossProbabilityBp(3));
check('42. ch11 > ch10 rate', areaBossProbabilityBp(11) > areaBossProbabilityBp(10));
check('43. ch21 > ch20 rate', areaBossProbabilityBp(21) > areaBossProbabilityBp(20));

// All valid chapters return a non-negative multiple of 100
for (const ch of [1,4,11,21,50]) {
  check(`44. ch${ch} probability is non-negative and multiple of 100`,
    areaBossProbabilityBp(ch) >= 0 && areaBossProbabilityBp(ch) % 100 === 0);
}

// ── 46–55: areaBossEnabled ────────────────────────────────────────────────────

console.log('\n── areaBossEnabled ──');

check('45. ch1 enabled',     areaBossEnabled(1));
check('46. ch2 disabled',   !areaBossEnabled(2));
check('47. ch3 disabled',   !areaBossEnabled(3));
check('48. ch4 enabled',     areaBossEnabled(4));
check('49. ch10 enabled',    areaBossEnabled(10));
check('50. ch11 enabled',    areaBossEnabled(11));
check('51. ch20 enabled',    areaBossEnabled(20));
check('52. ch21 enabled',    areaBossEnabled(21));
check('53. ch50 enabled',    areaBossEnabled(50));

// ── 56–75: createChapterBossKeyState ─────────────────────────────────────────

console.log('\n── createChapterBossKeyState ──');

{
  const s = createChapterBossKeyState(5);
  eq(s.chapterId,            5, '54. chapterId = 5');
  eq(s.keysCollected,        0, '55. default keysCollected = 0');
  eq(s.claimedTileIds.length,0, '56. default claimedTileIds empty');
  eq(validateChapterBossKeyState(s).length, 0, '57. fresh state is valid');

  // With initial keys
  const s2 = createChapterBossKeyState(5, 2, ['tile_a', 'tile_b']);
  eq(s2.keysCollected,        2,          '58. initial keys = 2');
  eq(s2.claimedTileIds.length,2,          '59. initial claimedTileIds.length = 2');
  check('60. claimedTileIds sorted', s2.claimedTileIds[0] <= s2.claimedTileIds[1]);

  // Clamp initial keys to CHAPTER_BOSS_KEY_REQUIREMENT
  const s3 = createChapterBossKeyState(5, 5);
  eq(s3.keysCollected, CHAPTER_BOSS_KEY_REQUIREMENT, '61. initial keys clamped to 3');

  // Negative keys → 0
  const s4 = createChapterBossKeyState(5, -1);
  eq(s4.keysCollected, 0, '62. negative initial keys → 0');

  // Dedup in initial claimedTileIds
  const s5 = createChapterBossKeyState(5, 2, ['tile_a', 'tile_a', 'tile_b']);
  eq(s5.claimedTileIds.length, 2, '63. initial claimedTileIds deduped');

  // Sorted order
  const s6 = createChapterBossKeyState(5, 2, ['tile_z', 'tile_a']);
  check('64. claimedTileIds sorted ascending', s6.claimedTileIds[0] === 'tile_a');
}

// ── 76–110: claimAreaBossKey ──────────────────────────────────────────────────

console.log('\n── claimAreaBossKey ──');

{
  const empty = state(5);

  // Award first key
  const s1 = claimAreaBossKey(empty, 'tile_1');
  eq(s1.keysCollected,         1,          '65. first key: keysCollected = 1');
  eq(s1.claimedTileIds.length, 1,          '66. first key: claimedTileIds.length = 1');
  check('67. tile_1 is in claimedTileIds', s1.claimedTileIds.includes('tile_1'));

  // Award second key
  const s2 = claimAreaBossKey(s1, 'tile_2');
  eq(s2.keysCollected,         2,          '68. second key: keysCollected = 2');
  eq(s2.claimedTileIds.length, 2,          '69. second key: claimedTileIds.length = 2');

  // Award third key — gate now opens
  const s3 = claimAreaBossKey(s2, 'tile_3');
  eq(s3.keysCollected,         3,          '70. third key: keysCollected = 3');
  check('71. gate open after 3 keys',      isChapterBossGateOpen(s3));

  // IDEMPOTENCY: revisiting tile_1 does NOT award another key
  const dup = claimAreaBossKey(s3, 'tile_1');
  eq(dup.keysCollected,         3,          '72. revisit tile_1: keys unchanged');
  eq(dup.claimedTileIds.length, 3,          '73. revisit tile_1: claimedTileIds unchanged');
  check('74. revisit returns same keys count', dup === s3 || dup.keysCollected === s3.keysCollected);

  // CLAMP: trying to add a 4th key (fourth tile never existed, but test the clamp)
  const s4 = claimAreaBossKey(s3, 'tile_4');
  eq(s4.keysCollected, CHAPTER_BOSS_KEY_REQUIREMENT, '75. 4th tile clamped to 3');
  eq(s4.claimedTileIds.length, 4, '76. claimedTileIds still records tile_4 for dedup');

  // After clamp: tile_4 is deduplicated
  const s4b = claimAreaBossKey(s4, 'tile_4');
  eq(s4b.keysCollected,         3,          '77. reclaimimg tile_4: still 3');
  eq(s4b.claimedTileIds.length, 4,          '78. reclaimimg tile_4: still 4 ids');

  // Original state unchanged
  eq(empty.keysCollected,         0,         '79. original state unchanged after claim');
  eq(empty.claimedTileIds.length, 0,         '80. original claimedTileIds unchanged');

  // Idempotency scenarios: reconnect, refresh, duplicate server request
  // All simulate claiming the same tile again after state was persisted

  // Scenario: reconnect — state loaded, same tile claimed again
  const reconnect = claimAreaBossKey(s1, 'tile_1');
  eq(reconnect.keysCollected, 1,            '81. reconnect: claim same tile → no double key');

  // Scenario: refresh — page reload, server re-sends the claim
  const refresh = claimAreaBossKey(s2, 'tile_2');
  eq(refresh.keysCollected, 2,              '82. refresh: claim same tile → no double key');

  // Scenario: duplicate server request — two requests for same boss win
  const dup2a = claimAreaBossKey(empty, 'tile_boss');
  const dup2b = claimAreaBossKey(dup2a,  'tile_boss');  // second request, same tile
  eq(dup2b.keysCollected, 1,               '83. duplicate server req: still 1 key');

  // Scenario: reopen chapter — state restored, same tile
  const restored = createChapterBossKeyState(5, 1, ['tile_1']);
  const reopen   = claimAreaBossKey(restored, 'tile_1');
  eq(reopen.keysCollected, 1,              '84. reopen chapter: claim same tile → no double key');

  // Scenario: replay completed battle result
  const postBattle = claimAreaBossKey(s2, 'tile_2');
  eq(postBattle.keysCollected, 2,          '85. replay battle result: no double key');

  // claimedTileIds stays sorted after multiple claims
  const unsorted = claimAreaBossKey(claimAreaBossKey(empty, 'tile_z'), 'tile_a');
  check('86. claimedTileIds sorted after two claims',
    unsorted.claimedTileIds[0] === 'tile_a' && unsorted.claimedTileIds[1] === 'tile_z');
}

// ── 111–125: claimAreaBossKeys (batch) ────────────────────────────────────────

console.log('\n── claimAreaBossKeys ──');

{
  const empty = state(5);

  // Claim 2 in one batch
  const s2 = claimAreaBossKeys(empty, ['tile_a', 'tile_b']);
  eq(s2.keysCollected, 2,                 '87. batch 2: keysCollected = 2');

  // Claim 3 in one batch
  const s3 = claimAreaBossKeys(empty, ['tile_a', 'tile_b', 'tile_c']);
  eq(s3.keysCollected, 3,                 '88. batch 3: keysCollected = 3');
  check('89. gate open after batch 3',    isChapterBossGateOpen(s3));

  // Batch with duplicates within the batch
  const sDup = claimAreaBossKeys(empty, ['tile_a', 'tile_a', 'tile_b']);
  eq(sDup.keysCollected, 2,               '90. batch with dup: 2 keys (not 3)');

  // Empty batch: no change
  const noChange = claimAreaBossKeys(s2, []);
  eq(noChange.keysCollected, 2,           '91. empty batch: unchanged');

  // Batch on already-claimed state: idempotent
  const again = claimAreaBossKeys(s3, ['tile_a', 'tile_b', 'tile_c']);
  eq(again.keysCollected, 3,              '92. batch re-claim: still 3');
  eq(again.claimedTileIds.length, 3,      '93. batch re-claim: still 3 ids');
}

// ── 126–140: isChapterBossGateOpen ────────────────────────────────────────────

console.log('\n── isChapterBossGateOpen ──');

check('94. 0 keys: gate closed',           !isChapterBossGateOpen(state(1)));
check('95. 1 key: gate closed',            !isChapterBossGateOpen(state(5, 1, ['t1'])));
check('96. 2 keys: gate closed',           !isChapterBossGateOpen(state(5, 2, ['t1','t2'])));
check('97. 3 keys: gate OPEN',              isChapterBossGateOpen(state(5, 3, ['t1','t2','t3'])));

// After claiming all 3 through claimAreaBossKey
{
  const full = claimAreaBossKeys(state(5), ['tile_1', 'tile_2', 'tile_3']);
  check('98. gate open after 3 claims', isChapterBossGateOpen(full));
}

// Gate is open at exactly CHAPTER_BOSS_KEY_REQUIREMENT, not above (clamped)
check('99. 3 = gate open at requirement', isChapterBossGateOpen(state(5, CHAPTER_BOSS_KEY_REQUIREMENT)));

// ── 141–155: getKeyProgress / describeKeyProgress ─────────────────────────────

console.log('\n── getKeyProgress / describeKeyProgress ──');

{
  const s0 = state(5, 0);
  const s1 = state(5, 1, ['t1']);
  const s2 = state(5, 2, ['t1','t2']);
  const s3 = state(5, 3, ['t1','t2','t3']);

  const p0 = getKeyProgress(s0);
  eq(p0.collected, 0,                         '100. 0 keys: collected = 0');
  eq(p0.required,  CHAPTER_BOSS_KEY_REQUIREMENT, '101. required = 3');
  eq(p0.remaining, 3,                          '102. remaining = 3');
  check('103. 0 keys: isOpen false',           !p0.isOpen);

  const p1 = getKeyProgress(s1);
  eq(p1.collected, 1,                          '104. 1 key: collected = 1');
  eq(p1.remaining, 2,                          '105. 1 key: remaining = 2');
  check('106. 1 key: isOpen false',            !p1.isOpen);

  const p3 = getKeyProgress(s3);
  eq(p3.collected, 3,                          '107. 3 keys: collected = 3');
  eq(p3.remaining, 0,                          '108. 3 keys: remaining = 0');
  check('109. 3 keys: isOpen true',             p3.isOpen);

  // describeKeyProgress
  eq(describeKeyProgress(s0), '0 / 3',         '110. describe 0 keys: "0 / 3"');
  eq(describeKeyProgress(s1), '1 / 3',         '111. describe 1 key: "1 / 3"');
  eq(describeKeyProgress(s2), '2 / 3',         '112. describe 2 keys: "2 / 3"');
  eq(describeKeyProgress(s3), '3 / 3',         '113. describe 3 keys: "3 / 3"');

  // Progress is consistent with gate
  check('114. p3.isOpen matches gate fn',
    p3.isOpen === isChapterBossGateOpen(s3));
}

// ── 156–175: checkRechallengeEligibility ─────────────────────────────────────

console.log('\n── checkRechallengeEligibility ──');

{
  const s0 = state(5, 0);
  const s1 = state(5, 1, ['t1']);
  const s2 = state(5, 2, ['t1','t2']);
  const s3 = state(5, 3, ['t1','t2','t3']);

  // Eligible: no keys, boss not defeated
  const e0 = checkRechallengeEligibility(s0, false);
  check('115. 0 keys + not defeated → eligible',  e0.eligible);
  check('116. eligible: no reason',               !e0.reason);

  // Eligible: 1 key, boss not defeated
  const e1 = checkRechallengeEligibility(s1, false);
  check('117. 1 key + not defeated → eligible',   e1.eligible);

  // Eligible: 2 keys, boss not defeated
  const e2 = checkRechallengeEligibility(s2, false);
  check('118. 2 keys + not defeated → eligible',  e2.eligible);

  // Ineligible: 3 keys (gate open), boss not defeated
  const e3 = checkRechallengeEligibility(s3, false);
  check('119. 3 keys: gate open → not eligible',  !e3.eligible);
  check('120. gate open: reason provided',          !!e3.reason);
  check('121. gate open reason mentions boss',
    e3.reason?.toLowerCase().includes('boss') ?? false);

  // Ineligible: boss already defeated
  const eDefeated = checkRechallengeEligibility(s0, true);
  check('122. boss defeated → not eligible',        !eDefeated.eligible);
  check('123. boss defeated: reason provided',       !!eDefeated.reason);
  check('124. boss defeated reason mentions Challenge Chapter',
    eDefeated.reason?.includes('Challenge Chapter') ?? false);

  // Ineligible: boss defeated AND gate open
  const eBothBad = checkRechallengeEligibility(s3, true);
  check('125. boss defeated + 3 keys → not eligible', !eBothBad.eligible);
}

// ── 176–200: buildRechallengeMapSpec ─────────────────────────────────────────

console.log('\n── buildRechallengeMapSpec ──');

{
  const ks = state(5, 1, ['tile_boss_1']);
  const spec = buildRechallengeMapSpec(input(), ks);

  check('126. spec.eligibleToRechallenge true',   spec.eligibleToRechallenge);
  check('127. no ineligibilityReason',            !spec.ineligibilityReason);
  eq(spec.playerId,          'player-1',          '128. playerId preserved');
  eq(spec.chapterId,         5,                   '129. chapterId preserved');
  eq(spec.shift,             'day',               '130. shift preserved');
  eq(spec.newAttemptNumber,  2,                   '131. newAttemptNumber = currentAttemptNumber+1');
  eq(spec.preservedKeyState.keysCollected, 1,     '132. preservedKeyState.keysCollected = 1');
  check('133. preservedKeyState has tile_boss_1',
    spec.preservedKeyState.claimedTileIds.includes('tile_boss_1'));
  check('134. resetFields non-empty',             spec.resetFields.length > 0);
  check('135. preservedFields non-empty',         spec.preservedFields.length > 0);
  check('136. seed in resetFields',               spec.resetFields.includes('seed'));
  check('137. chapterBossKeysCollected in preservedFields',
    spec.preservedFields.includes('chapterBossKeysCollected'));

  // Ineligible spec: boss defeated
  const defSpec = buildRechallengeMapSpec(
    input({ chapterBossDefeated: true }), ks);
  check('138. defeated: eligibleToRechallenge false', !defSpec.eligibleToRechallenge);
  check('139. defeated: ineligibilityReason set',      !!defSpec.ineligibilityReason);

  // Ineligible spec: gate open (3 keys)
  const gateSpec = buildRechallengeMapSpec(
    input(), state(5, 3, ['t1','t2','t3']));
  check('140. gate open: eligibleToRechallenge false', !gateSpec.eligibleToRechallenge);

  // Attempt number increments correctly
  const a5 = buildRechallengeMapSpec(input({ currentAttemptNumber: 5 }), ks);
  eq(a5.newAttemptNumber, 6,                      '141. attempt 5 → 6');

  // Shifts preserved for all TimeOfDay values
  for (const shift of ['day', 'evening', 'night'] as const) {
    const s = buildRechallengeMapSpec(input({ shift }), ks);
    eq(s.shift, shift, `142. shift "${shift}" preserved in spec`);
  }
}

// ── 201–215: simulateMultiRunKeyProgression ───────────────────────────────────

console.log('\n── simulateMultiRunKeyProgression ──');

{
  // Example from spec: Run 1 → 1 key, Run 2 → 2 more keys = 3 total
  const final = simulateMultiRunKeyProgression(5, [
    ['tile_1'],             // Run 1: 1 area boss → 1 key
    ['tile_2', 'tile_3'],   // Run 2: 2 area bosses → +2 keys
  ]);
  eq(final.keysCollected, 3, '143. multi-run: 1+2 = 3 keys');
  check('144. gate open after multi-run', isChapterBossGateOpen(final));
  check('145. tile_1 in final claimedTileIds', final.claimedTileIds.includes('tile_1'));
  check('146. tile_2 in final claimedTileIds', final.claimedTileIds.includes('tile_2'));
  check('147. tile_3 in final claimedTileIds', final.claimedTileIds.includes('tile_3'));

  // Run 1 only: 1 key, gate still closed
  const after1 = simulateMultiRunKeyProgression(5, [['tile_boss']]);
  eq(after1.keysCollected, 1,            '148. after run 1: 1 key');
  check('149. after run 1: gate closed', !isChapterBossGateOpen(after1));

  // Zero runs: 0 keys
  const zero = simulateMultiRunKeyProgression(5, []);
  eq(zero.keysCollected, 0,              '150. zero runs: 0 keys');

  // Run with 0 area bosses: no keys
  const noKey = simulateMultiRunKeyProgression(5, [[]]);
  eq(noKey.keysCollected, 0,             '151. empty run: 0 keys');

  // Cross-run idempotency: same tile appears on multiple runs (should NOT double-award)
  // This happens if the same tile id is generated on two maps (unlikely but test the invariant)
  const crossRunDup = simulateMultiRunKeyProgression(5, [
    ['shared_tile'],
    ['shared_tile', 'tile_2'],  // shared_tile appears again
  ]);
  eq(crossRunDup.keysCollected, 2,       '152. cross-run dup tile: 2 keys (not 3)');

  // 3 runs, 1 boss each → max out at 3
  const three = simulateMultiRunKeyProgression(5, [
    ['tile_r1b1'],
    ['tile_r2b1'],
    ['tile_r3b1'],
  ]);
  eq(three.keysCollected, 3,             '153. 3 runs × 1 boss = 3 keys');
  check('154. gate open after 3 runs',   isChapterBossGateOpen(three));
}

// ── 216–235: validateChapterBossKeyState ─────────────────────────────────────

console.log('\n── validateChapterBossKeyState ──');

{
  // Valid states
  eq(validateChapterBossKeyState(state(5)).length, 0,              '155. 0 keys: valid');
  eq(validateChapterBossKeyState(state(5, 1, ['t'])).length, 0,    '156. 1 key: valid');
  eq(validateChapterBossKeyState(state(5, 3, ['a','b','c'])).length, 0, '157. 3 keys: valid');

  // chapterId = 0 (invalid)
  const bad1: ChapterBossKeyState = { chapterId: 0, keysCollected: 0, claimedTileIds: [] };
  check('158. chapterId=0: error', validateChapterBossKeyState(bad1).length > 0);

  // keysCollected = -1
  const bad2: ChapterBossKeyState = { chapterId: 5, keysCollected: -1, claimedTileIds: [] };
  check('159. keysCollected=-1: error', validateChapterBossKeyState(bad2).length > 0);

  // keysCollected > CHAPTER_BOSS_KEY_REQUIREMENT
  const bad3: ChapterBossKeyState = { chapterId: 5, keysCollected: 4, claimedTileIds: [] };
  check('160. keysCollected=4: error',
    validateChapterBossKeyState(bad3).some(e => e.includes('keysCollected')));

  // Duplicate claimedTileIds
  const bad4: ChapterBossKeyState = { chapterId: 5, keysCollected: 2, claimedTileIds: ['a','a'] };
  check('161. duplicate claimedTileIds: error',
    validateChapterBossKeyState(bad4).some(e => e.includes('duplicates')));

  // claimedTileIds.length > keysCollected
  const bad5: ChapterBossKeyState = { chapterId: 5, keysCollected: 1, claimedTileIds: ['a','b','c'] };
  check('162. claimedTileIds.length > keysCollected: error',
    validateChapterBossKeyState(bad5).length > 0);

  // Empty string in claimedTileIds
  const bad6: ChapterBossKeyState = { chapterId: 5, keysCollected: 1, claimedTileIds: [''] };
  check('163. empty string in claimedTileIds: error',
    validateChapterBossKeyState(bad6).length > 0);

  // fractional chapterId
  const bad7: ChapterBossKeyState = { chapterId: 1.5, keysCollected: 0, claimedTileIds: [] };
  check('164. fractional chapterId: error', validateChapterBossKeyState(bad7).length > 0);
}

// ── 236–250: Immutability ─────────────────────────────────────────────────────

console.log('\n── Immutability ──');

{
  const original = state(5, 1, ['tile_a']);

  // claimAreaBossKey: original unchanged
  const after = claimAreaBossKey(original, 'tile_b');
  eq(original.keysCollected,         1, '165. claimAreaBossKey: original keysCollected unchanged');
  eq(original.claimedTileIds.length, 1, '166. claimAreaBossKey: original claimedTileIds unchanged');

  // claimAreaBossKeys: original unchanged
  const afterBatch = claimAreaBossKeys(original, ['tile_b', 'tile_c']);
  eq(original.keysCollected,         1, '167. claimAreaBossKeys: original unchanged');

  // buildRechallengeMapSpec: keyState unchanged
  const ks = state(5, 1, ['tile_x']);
  buildRechallengeMapSpec(input(), ks);
  eq(ks.keysCollected,         1, '168. buildRechallengeMapSpec: keyState unchanged');
  eq(ks.claimedTileIds.length, 1, '169. buildRechallengeMapSpec: claimedTileIds unchanged');

  // simulateMultiRunKeyProgression returns new state, input batches unchanged
  const batches: ReadonlyArray<readonly string[]> = [['tile_1'], ['tile_2']];
  simulateMultiRunKeyProgression(5, batches);
  eq(batches[0].length, 1, '170. simulate: input batches unchanged');
}

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failures.length > 0) {
  console.error('\nFailed tests:');
  failures.forEach(f => console.error(`  • ${f}`));
  process.exit(1);
}
