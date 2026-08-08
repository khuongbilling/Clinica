/**
 * tests/book_one_unlocks.test.ts — Book I system unlock cadence (Push 14)
 *
 * Tests for frontend/src/game/journeyMap/bookOneUnlocks.ts
 *
 * Coverage:
 *   1– 30:  Constants — BOOK_I_SYSTEMS (24 entries), BOOK_I_FINAL_CHAPTER,
 *           named groups (BASELINE_SYSTEMS, BOSS_KEY_LOOP_SYSTEMS,
 *           PRESSURE_SYSTEMS, CHAPTER_10_SYSTEMS, BOOK_I_SHIFTS)
 *  31– 55:  BOOK_I_UNLOCK_CHAPTER — exact chapter for every system
 *  56– 90:  isSystemUnlocked — each system at unlock, unlock-1, ch10
 *  91–110:  getChapterUnlocks — new systems at each chapter 1–10
 * 111–130:  getCumulativeUnlocks — cumulative counts and completeness
 * 131–140:  getLockedSystems — correct inverse of cumulative
 * 141–145:  isBookIComplete — gate at ch 10
 * 146–155:  getSystemsByChapter — grouping correctness
 * 156–175:  SHIFT_UNLOCK_CHAPTER + isShiftAvailable — all chapter × shift combos
 * 176–190:  availableShifts — correct ordered list per chapter
 * 191–200:  getBookIMapTileCount — 30/35/40 bands
 * 201–210:  Named groupings — membership and ordering
 * 211–220:  validateBookIConsistency — passes on valid table, catches mutations
 * 221–230:  Immutability — returned arrays are fresh, constants unchanged
 */

import {
  BOOK_I_SYSTEMS,
  BOOK_I_FINAL_CHAPTER,
  BOOK_I_UNLOCK_CHAPTER,
  BASELINE_SYSTEMS,
  BOSS_KEY_LOOP_SYSTEMS,
  PRESSURE_SYSTEMS,
  CHAPTER_10_SYSTEMS,
  BOOK_I_SHIFTS,
  SHIFT_UNLOCK_CHAPTER,
  isSystemUnlocked,
  getSystemUnlockChapter,
  getChapterUnlocks,
  getCumulativeUnlocks,
  getLockedSystems,
  isBookIComplete,
  getSystemsByChapter,
  isShiftAvailable,
  availableShifts,
  getBookIMapTileCount,
  validateBookIConsistency,
  type BookISystem,
} from '../src/game/journeyMap/bookOneUnlocks';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, value: boolean): void {
  if (value) { passed++; console.log(`PASS - ${label}`); }
  else       { failed++; failures.push(label); console.error(`FAIL - ${label}`); }
}
function eq<T>(a: T, b: T, label: string): void { check(label, a === b); }

// ── 1–30: Constants ───────────────────────────────────────────────────────────

console.log('\n── Constants ──');

eq(BOOK_I_SYSTEMS.length, 24,  '1. BOOK_I_SYSTEMS has exactly 24 entries');
eq(BOOK_I_FINAL_CHAPTER,  10,  '2. BOOK_I_FINAL_CHAPTER = 10');

// Every system appears exactly once
{
  const uniq = new Set(BOOK_I_SYSTEMS);
  eq(uniq.size, 24,            '3. BOOK_I_SYSTEMS has no duplicates');
}

// Spot-check a few to confirm the values are the expected strings
check('4. stability in BOOK_I_SYSTEMS',            BOOK_I_SYSTEMS.includes('stability'));
check('5. corruption in BOOK_I_SYSTEMS',           BOOK_I_SYSTEMS.includes('corruption'));
check('6. multi_threat_introduction in list',      BOOK_I_SYSTEMS.includes('multi_threat_introduction'));
check('7. call_team in list',                      BOOK_I_SYSTEMS.includes('call_team'));
check('8. intent_visibility in list',              BOOK_I_SYSTEMS.includes('intent_visibility'));
check('9. protocol_cards in list',                 BOOK_I_SYSTEMS.includes('protocol_cards'));
check('10. evening_shift in list',                 BOOK_I_SYSTEMS.includes('evening_shift'));
check('11. area_boss in list',                     BOOK_I_SYSTEMS.includes('area_boss'));
check('12. chapter_boss_keys in list',             BOOK_I_SYSTEMS.includes('chapter_boss_keys'));
check('13. chapter_boss_gate in list',             BOOK_I_SYSTEMS.includes('chapter_boss_gate'));
check('14. shift_divergence in list',              BOOK_I_SYSTEMS.includes('shift_divergence'));
check('15. merchant in list',                      BOOK_I_SYSTEMS.includes('merchant'));
check('16. ward_blessings in list',                BOOK_I_SYSTEMS.includes('ward_blessings'));
check('17. supply_interactions in list',           BOOK_I_SYSTEMS.includes('supply_interactions'));
check('18. night_shift in list',                   BOOK_I_SYSTEMS.includes('night_shift'));
check('19. ward_hazards in list',                  BOOK_I_SYSTEMS.includes('ward_hazards'));
check('20. silent_risk in list',                   BOOK_I_SYSTEMS.includes('silent_risk'));
check('21. expanded_map in list',                  BOOK_I_SYSTEMS.includes('expanded_map'));
check('22. full_threat_composition in list',       BOOK_I_SYSTEMS.includes('full_threat_composition'));
check('23. handoff_debt in list',                  BOOK_I_SYSTEMS.includes('handoff_debt'));
check('24. advanced_pressure in list',             BOOK_I_SYSTEMS.includes('advanced_pressure'));
check('25. three_watches_exam in list',            BOOK_I_SYSTEMS.includes('three_watches_exam'));
check('26. challenge_chapter in list',             BOOK_I_SYSTEMS.includes('challenge_chapter'));
check('27. clinical_reflection in list',           BOOK_I_SYSTEMS.includes('clinical_reflection'));

// BOOK_I_SHIFTS
eq(BOOK_I_SHIFTS.length, 3,                       '28. BOOK_I_SHIFTS has 3 entries');
check('29. day in BOOK_I_SHIFTS',                  BOOK_I_SHIFTS.includes('day'));
check('30. evening in BOOK_I_SHIFTS',              BOOK_I_SHIFTS.includes('evening'));

// ── 31–55: BOOK_I_UNLOCK_CHAPTER exact values ─────────────────────────────────

console.log('\n── BOOK_I_UNLOCK_CHAPTER ──');

// Chapter 1
eq(BOOK_I_UNLOCK_CHAPTER['stability'],                 1, '31. stability → ch1');
eq(BOOK_I_UNLOCK_CHAPTER['corruption'],                1, '32. corruption → ch1');
// Chapter 2
eq(BOOK_I_UNLOCK_CHAPTER['multi_threat_introduction'], 2, '33. multi_threat_introduction → ch2');
eq(BOOK_I_UNLOCK_CHAPTER['call_team'],                 2, '34. call_team → ch2');
// Chapter 3
eq(BOOK_I_UNLOCK_CHAPTER['intent_visibility'],         3, '35. intent_visibility → ch3');
eq(BOOK_I_UNLOCK_CHAPTER['protocol_cards'],            3, '36. protocol_cards → ch3');
eq(BOOK_I_UNLOCK_CHAPTER['evening_shift'],             3, '37. evening_shift → ch3');
// Chapter 4
eq(BOOK_I_UNLOCK_CHAPTER['area_boss'],                 4, '38. area_boss → ch4');
eq(BOOK_I_UNLOCK_CHAPTER['chapter_boss_keys'],         4, '39. chapter_boss_keys → ch4');
eq(BOOK_I_UNLOCK_CHAPTER['chapter_boss_gate'],         4, '40. chapter_boss_gate → ch4');
eq(BOOK_I_UNLOCK_CHAPTER['shift_divergence'],          4, '41. shift_divergence → ch4');
// Chapter 5
eq(BOOK_I_UNLOCK_CHAPTER['merchant'],                  5, '42. merchant → ch5');
eq(BOOK_I_UNLOCK_CHAPTER['ward_blessings'],            5, '43. ward_blessings → ch5');
eq(BOOK_I_UNLOCK_CHAPTER['supply_interactions'],       5, '44. supply_interactions → ch5');
// Chapter 6
eq(BOOK_I_UNLOCK_CHAPTER['night_shift'],               6, '45. night_shift → ch6');
eq(BOOK_I_UNLOCK_CHAPTER['ward_hazards'],              6, '46. ward_hazards → ch6');
eq(BOOK_I_UNLOCK_CHAPTER['silent_risk'],               6, '47. silent_risk → ch6');
eq(BOOK_I_UNLOCK_CHAPTER['expanded_map'],              6, '48. expanded_map → ch6');
// Chapter 7
eq(BOOK_I_UNLOCK_CHAPTER['full_threat_composition'],   7, '49. full_threat_composition → ch7');
// Chapter 8
eq(BOOK_I_UNLOCK_CHAPTER['handoff_debt'],              8, '50. handoff_debt → ch8');
// Chapter 9
eq(BOOK_I_UNLOCK_CHAPTER['advanced_pressure'],         9, '51. advanced_pressure → ch9');
// Chapter 10
eq(BOOK_I_UNLOCK_CHAPTER['three_watches_exam'],       10, '52. three_watches_exam → ch10');
eq(BOOK_I_UNLOCK_CHAPTER['challenge_chapter'],        10, '53. challenge_chapter → ch10');
eq(BOOK_I_UNLOCK_CHAPTER['clinical_reflection'],      10, '54. clinical_reflection → ch10');

// getSystemUnlockChapter mirrors the table
eq(getSystemUnlockChapter('area_boss'), 4,            '55. getSystemUnlockChapter(area_boss) = 4');

// ── 56–90: isSystemUnlocked ───────────────────────────────────────────────────

console.log('\n── isSystemUnlocked ──');

// Baseline: always unlocked
check('56. stability unlocked at ch1',   isSystemUnlocked('stability', 1));
check('57. corruption unlocked at ch1',  isSystemUnlocked('corruption', 1));

// Ch2 systems: locked at ch1, open at ch2+
check('58. call_team locked at ch1',     !isSystemUnlocked('call_team', 1));
check('59. call_team unlocked at ch2',    isSystemUnlocked('call_team', 2));
check('60. multi_threat locked at ch1',  !isSystemUnlocked('multi_threat_introduction', 1));
check('61. multi_threat unlocked at ch2', isSystemUnlocked('multi_threat_introduction', 2));

// Ch3 systems
check('62. intent_visibility locked at ch2',  !isSystemUnlocked('intent_visibility', 2));
check('63. intent_visibility unlocked at ch3', isSystemUnlocked('intent_visibility', 3));
check('64. protocol_cards locked at ch2',     !isSystemUnlocked('protocol_cards', 2));
check('65. protocol_cards unlocked at ch3',    isSystemUnlocked('protocol_cards', 3));
check('66. evening_shift locked at ch2',      !isSystemUnlocked('evening_shift', 2));
check('67. evening_shift unlocked at ch3',     isSystemUnlocked('evening_shift', 3));

// Ch4 systems
check('68. area_boss locked at ch3',          !isSystemUnlocked('area_boss', 3));
check('69. area_boss unlocked at ch4',         isSystemUnlocked('area_boss', 4));
check('70. chapter_boss_gate locked at ch3',  !isSystemUnlocked('chapter_boss_gate', 3));
check('71. chapter_boss_gate unlocked at ch4', isSystemUnlocked('chapter_boss_gate', 4));
check('72. shift_divergence unlocked at ch4',  isSystemUnlocked('shift_divergence', 4));

// Ch5 systems
check('73. merchant locked at ch4',          !isSystemUnlocked('merchant', 4));
check('74. merchant unlocked at ch5',         isSystemUnlocked('merchant', 5));
check('75. ward_blessings locked at ch4',    !isSystemUnlocked('ward_blessings', 4));
check('76. ward_blessings unlocked at ch5',   isSystemUnlocked('ward_blessings', 5));
check('77. supply_interactions unlocked ch5', isSystemUnlocked('supply_interactions', 5));

// Ch6 systems
check('78. night_shift locked at ch5',   !isSystemUnlocked('night_shift', 5));
check('79. night_shift unlocked at ch6',  isSystemUnlocked('night_shift', 6));
check('80. ward_hazards locked at ch5',  !isSystemUnlocked('ward_hazards', 5));
check('81. ward_hazards unlocked at ch6', isSystemUnlocked('ward_hazards', 6));
check('82. silent_risk locked at ch5',   !isSystemUnlocked('silent_risk', 5));
check('83. silent_risk unlocked at ch6',  isSystemUnlocked('silent_risk', 6));
check('84. expanded_map unlocked at ch6', isSystemUnlocked('expanded_map', 6));

// Ch7–10 single-chapter unlocks
check('85. full_threat_composition locked at ch6', !isSystemUnlocked('full_threat_composition', 6));
check('86. full_threat_composition unlocked ch7',   isSystemUnlocked('full_threat_composition', 7));
check('87. handoff_debt locked at ch7',            !isSystemUnlocked('handoff_debt', 7));
check('88. handoff_debt unlocked at ch8',           isSystemUnlocked('handoff_debt', 8));
check('89. advanced_pressure locked at ch8',       !isSystemUnlocked('advanced_pressure', 8));
check('90. advanced_pressure unlocked at ch9',      isSystemUnlocked('advanced_pressure', 9));
check('91. three_watches_exam locked at ch9',      !isSystemUnlocked('three_watches_exam', 9));
check('92. three_watches_exam unlocked at ch10',    isSystemUnlocked('three_watches_exam', 10));
check('93. challenge_chapter unlocked at ch10',     isSystemUnlocked('challenge_chapter', 10));
check('94. clinical_reflection unlocked at ch10',   isSystemUnlocked('clinical_reflection', 10));

// All systems unlocked at ch10
for (const system of BOOK_I_SYSTEMS) {
  check(`95. ${system} unlocked at ch10`, isSystemUnlocked(system, 10));
}

// ── 91–110: getChapterUnlocks ─────────────────────────────────────────────────

console.log('\n── getChapterUnlocks ──');

{
  const ch1 = getChapterUnlocks(1);
  eq(ch1.length, 2,                         '96. ch1 unlocks 2 systems');
  check('97. ch1 includes stability',        ch1.includes('stability'));
  check('98. ch1 includes corruption',       ch1.includes('corruption'));

  const ch2 = getChapterUnlocks(2);
  eq(ch2.length, 2,                         '99. ch2 unlocks 2 systems');
  check('100. ch2 includes call_team',       ch2.includes('call_team'));
  check('101. ch2 includes multi_threat_introduction', ch2.includes('multi_threat_introduction'));

  const ch3 = getChapterUnlocks(3);
  eq(ch3.length, 3,                         '102. ch3 unlocks 3 systems');
  check('103. ch3 includes evening_shift',   ch3.includes('evening_shift'));
  check('104. ch3 includes intent_visibility', ch3.includes('intent_visibility'));
  check('105. ch3 includes protocol_cards',  ch3.includes('protocol_cards'));

  const ch4 = getChapterUnlocks(4);
  eq(ch4.length, 4,                         '106. ch4 unlocks 4 systems');
  check('107. ch4 includes area_boss',       ch4.includes('area_boss'));
  check('108. ch4 includes chapter_boss_keys', ch4.includes('chapter_boss_keys'));
  check('109. ch4 includes chapter_boss_gate', ch4.includes('chapter_boss_gate'));
  check('110. ch4 includes shift_divergence', ch4.includes('shift_divergence'));

  const ch5 = getChapterUnlocks(5);
  eq(ch5.length, 3,                         '111. ch5 unlocks 3 systems');
  check('112. ch5 includes merchant',        ch5.includes('merchant'));

  const ch6 = getChapterUnlocks(6);
  eq(ch6.length, 4,                         '113. ch6 unlocks 4 systems');
  check('114. ch6 includes night_shift',     ch6.includes('night_shift'));
  check('115. ch6 includes ward_hazards',    ch6.includes('ward_hazards'));
  check('116. ch6 includes silent_risk',     ch6.includes('silent_risk'));
  check('117. ch6 includes expanded_map',    ch6.includes('expanded_map'));

  eq(getChapterUnlocks(7).length, 1,        '118. ch7 unlocks 1 system');
  eq(getChapterUnlocks(8).length, 1,        '119. ch8 unlocks 1 system');
  eq(getChapterUnlocks(9).length, 1,        '120. ch9 unlocks 1 system');

  const ch10 = getChapterUnlocks(10);
  eq(ch10.length, 3,                        '121. ch10 unlocks 3 systems');
  check('122. ch10 includes three_watches_exam', ch10.includes('three_watches_exam'));
  check('123. ch10 includes challenge_chapter',  ch10.includes('challenge_chapter'));
  check('124. ch10 includes clinical_reflection', ch10.includes('clinical_reflection'));

  // No chapter unlocks 0 systems within 1–10
  let totalFromAllChapters = 0;
  for (let ch = 1; ch <= 10; ch++) {
    const unlocks = getChapterUnlocks(ch);
    check(`125. ch${ch} unlocks ≥ 1 system`, unlocks.length >= 1);
    totalFromAllChapters += unlocks.length;
  }
  eq(totalFromAllChapters, 24, '126. total unlocks across ch1–10 = 24');
}

// ── 111–130: getCumulativeUnlocks ─────────────────────────────────────────────

console.log('\n── getCumulativeUnlocks ──');

eq(getCumulativeUnlocks(1).length,  2,   '127. cumulative at ch1 = 2');
eq(getCumulativeUnlocks(2).length,  4,   '128. cumulative at ch2 = 4');
eq(getCumulativeUnlocks(3).length,  7,   '129. cumulative at ch3 = 7');
eq(getCumulativeUnlocks(4).length,  11,  '130. cumulative at ch4 = 11');
eq(getCumulativeUnlocks(5).length,  14,  '131. cumulative at ch5 = 14');
eq(getCumulativeUnlocks(6).length,  18,  '132. cumulative at ch6 = 18');
eq(getCumulativeUnlocks(7).length,  19,  '133. cumulative at ch7 = 19');
eq(getCumulativeUnlocks(8).length,  20,  '134. cumulative at ch8 = 20');
eq(getCumulativeUnlocks(9).length,  21,  '135. cumulative at ch9 = 21');
eq(getCumulativeUnlocks(10).length, 24,  '136. cumulative at ch10 = 24 (all)');

// Cumulative at ch10 contains all systems
{
  const all = getCumulativeUnlocks(10);
  for (const system of BOOK_I_SYSTEMS) {
    check(`137. ch10 cumulative includes ${system}`, all.includes(system));
  }
}

// ch0 → empty
eq(getCumulativeUnlocks(0).length, 0,    '138. cumulative at ch0 = 0');

// Monotonically non-decreasing
for (let ch = 1; ch < 10; ch++) {
  check(`139. cumulative(${ch+1}) ≥ cumulative(${ch})`,
    getCumulativeUnlocks(ch + 1).length >= getCumulativeUnlocks(ch).length);
}

// ── 131–140: getLockedSystems ─────────────────────────────────────────────────

console.log('\n── getLockedSystems ──');

eq(getLockedSystems(0).length, 24,        '140. all locked at ch0');
eq(getLockedSystems(1).length, 22,        '141. 22 locked after ch1');
eq(getLockedSystems(9).length, 3,         '142. 3 locked after ch9');
eq(getLockedSystems(10).length, 0,        '143. 0 locked after ch10');

// locked + cumulative = 24 for every chapter
for (let ch = 0; ch <= 10; ch++) {
  check(`144. locked + cumulative = 24 at ch${ch}`,
    getLockedSystems(ch).length + getCumulativeUnlocks(ch).length === 24);
}

// ── 141–145: isBookIComplete ──────────────────────────────────────────────────

console.log('\n── isBookIComplete ──');

check('145. ch9: not complete',  !isBookIComplete(9));
check('146. ch10: complete',      isBookIComplete(10));
check('147. ch11: complete',      isBookIComplete(11));
check('148. ch1: not complete',  !isBookIComplete(1));

// ── 146–155: getSystemsByChapter ─────────────────────────────────────────────

console.log('\n── getSystemsByChapter ──');

{
  const byChapter = getSystemsByChapter();
  eq(byChapter.size, 10,                      '149. map has 10 chapter keys');
  check('150. ch1 key exists',                 byChapter.has(1));
  check('151. ch10 key exists',                byChapter.has(10));
  eq(byChapter.get(1)?.length ?? 0, 2,        '152. ch1 has 2 systems in map');
  eq(byChapter.get(6)?.length ?? 0, 4,        '153. ch6 has 4 systems in map');
  eq(byChapter.get(10)?.length ?? 0, 3,       '154. ch10 has 3 systems in map');

  // Union of all map values = 24 systems
  let total = 0;
  for (const [, systems] of byChapter) total += systems.length;
  eq(total, 24,                                '155. map union = 24 systems');
}

// ── 156–175: SHIFT_UNLOCK_CHAPTER + isShiftAvailable ─────────────────────────

console.log('\n── SHIFT_UNLOCK_CHAPTER + isShiftAvailable ──');

eq(SHIFT_UNLOCK_CHAPTER['day'],     1, '156. day unlocks at ch1');
eq(SHIFT_UNLOCK_CHAPTER['evening'], 3, '157. evening unlocks at ch3');
eq(SHIFT_UNLOCK_CHAPTER['night'],   6, '158. night unlocks at ch6');

// day: always available
for (let ch = 1; ch <= 10; ch++) {
  check(`159. day available at ch${ch}`, isShiftAvailable('day', ch));
}

// evening: locked ch1–2, available ch3+
check('160. evening locked at ch1',    !isShiftAvailable('evening', 1));
check('161. evening locked at ch2',    !isShiftAvailable('evening', 2));
check('162. evening available at ch3',  isShiftAvailable('evening', 3));
check('163. evening available at ch4',  isShiftAvailable('evening', 4));
check('164. evening available at ch10', isShiftAvailable('evening', 10));

// night: locked ch1–5, available ch6+
check('165. night locked at ch1',      !isShiftAvailable('night', 1));
check('166. night locked at ch2',      !isShiftAvailable('night', 2));
check('167. night locked at ch3',      !isShiftAvailable('night', 3));
check('168. night locked at ch4',      !isShiftAvailable('night', 4));
check('169. night locked at ch5',      !isShiftAvailable('night', 5));
check('170. night available at ch6',    isShiftAvailable('night', 6));
check('171. night available at ch7',    isShiftAvailable('night', 7));
check('172. night available at ch10',   isShiftAvailable('night', 10));

// SHIFT_UNLOCK_CHAPTER matches evening_shift / night_shift unlock chapters
eq(SHIFT_UNLOCK_CHAPTER['evening'], BOOK_I_UNLOCK_CHAPTER['evening_shift'],
  '173. SHIFT_UNLOCK_CHAPTER.evening matches evening_shift unlock');
eq(SHIFT_UNLOCK_CHAPTER['night'], BOOK_I_UNLOCK_CHAPTER['night_shift'],
  '174. SHIFT_UNLOCK_CHAPTER.night matches night_shift unlock');

// ── 176–190: availableShifts ─────────────────────────────────────────────────

console.log('\n── availableShifts ──');

// ch1–2: only day
eq(availableShifts(1).length, 1,          '175. ch1: 1 shift available');
eq(availableShifts(1)[0], 'day',          '176. ch1 shift is day');
eq(availableShifts(2).length, 1,          '177. ch2: 1 shift available');

// ch3–5: day + evening
eq(availableShifts(3).length, 2,          '178. ch3: 2 shifts available');
check('179. ch3 includes day',             availableShifts(3).includes('day'));
check('180. ch3 includes evening',         availableShifts(3).includes('evening'));
check('181. ch3 excludes night',          !availableShifts(3).includes('night'));
eq(availableShifts(5).length, 2,          '182. ch5: 2 shifts available');

// ch6–10: day + evening + night
eq(availableShifts(6).length, 3,          '183. ch6: 3 shifts available');
check('184. ch6 includes night',           availableShifts(6).includes('night'));
eq(availableShifts(10).length, 3,         '185. ch10: 3 shifts available');

// Order preserved: ['day', 'evening', 'night']
{
  const s6 = availableShifts(6);
  eq(s6[0], 'day',                         '186. ch6 shifts[0] = day');
  eq(s6[1], 'evening',                     '187. ch6 shifts[1] = evening');
  eq(s6[2], 'night',                       '188. ch6 shifts[2] = night');
}

// ── 191–200: getBookIMapTileCount ─────────────────────────────────────────────

console.log('\n── getBookIMapTileCount ──');

eq(getBookIMapTileCount(1),  30, '189. ch1  → 30 tiles');
eq(getBookIMapTileCount(5),  30, '190. ch5  → 30 tiles');
eq(getBookIMapTileCount(6),  35, '191. ch6  → 35 tiles (expanded_map unlock)');
eq(getBookIMapTileCount(10), 35, '192. ch10 → 35 tiles');
eq(getBookIMapTileCount(11), 40, '193. ch11 → 40 tiles (beyond Book I)');

// Transition points
check('194. ch5 → ch6 jumps from 30 to 35',
  getBookIMapTileCount(5) === 30 && getBookIMapTileCount(6) === 35);

// Matches isSystemUnlocked('expanded_map', ch)
for (let ch = 1; ch <= 10; ch++) {
  const expectedTiles = isSystemUnlocked('expanded_map', ch) ? 35 : 30;
  check(`195. ch${ch} tile count matches expanded_map unlock`,
    getBookIMapTileCount(ch) === expectedTiles);
}

// ── 201–210: Named groupings ──────────────────────────────────────────────────

console.log('\n── Named groupings ──');

// BASELINE_SYSTEMS
eq(BASELINE_SYSTEMS.length, 2,              '196. BASELINE_SYSTEMS has 2 entries');
check('197. stability in BASELINE_SYSTEMS',  BASELINE_SYSTEMS.includes('stability'));
check('198. corruption in BASELINE_SYSTEMS', BASELINE_SYSTEMS.includes('corruption'));

// BOSS_KEY_LOOP_SYSTEMS
eq(BOSS_KEY_LOOP_SYSTEMS.length, 3,         '199. BOSS_KEY_LOOP_SYSTEMS has 3 entries');
check('200. area_boss in boss key loop',     BOSS_KEY_LOOP_SYSTEMS.includes('area_boss'));
check('201. chapter_boss_keys in loop',      BOSS_KEY_LOOP_SYSTEMS.includes('chapter_boss_keys'));
check('202. chapter_boss_gate in loop',      BOSS_KEY_LOOP_SYSTEMS.includes('chapter_boss_gate'));

// PRESSURE_SYSTEMS
eq(PRESSURE_SYSTEMS.length, 4,             '203. PRESSURE_SYSTEMS has 4 entries');
check('204. shift_divergence in pressure',   PRESSURE_SYSTEMS.includes('shift_divergence'));
check('205. silent_risk in pressure',        PRESSURE_SYSTEMS.includes('silent_risk'));
check('206. handoff_debt in pressure',       PRESSURE_SYSTEMS.includes('handoff_debt'));
check('207. advanced_pressure in pressure',  PRESSURE_SYSTEMS.includes('advanced_pressure'));

// CHAPTER_10_SYSTEMS
eq(CHAPTER_10_SYSTEMS.length, 3,           '208. CHAPTER_10_SYSTEMS has 3 entries');
check('209. three_watches_exam in ch10 set', CHAPTER_10_SYSTEMS.includes('three_watches_exam'));
check('210. challenge_chapter in ch10 set',  CHAPTER_10_SYSTEMS.includes('challenge_chapter'));

// ── 211–220: validateBookIConsistency ─────────────────────────────────────────

console.log('\n── validateBookIConsistency ──');

{
  const errors = validateBookIConsistency();
  eq(errors.length, 0,          '211. validateBookIConsistency() returns no errors');
  if (errors.length > 0) {
    for (const e of errors) {
      console.error(`  consistency error: ${e.system} — expected ${e.expected}, got ${e.actual}`);
    }
  }
}

// area_boss consistency: areaBossEnabled(4)=true, areaBossEnabled(3)=false
{
  // These are the external domain checks validateBookIConsistency() relies on
  const { areaBossEnabled }  = require('../src/game/journeyMap/chapterBossKeys');
  const { merchantMaxCount } = require('../src/game/journeyMap/config');
  check('212. areaBossEnabled(4) = true (external domain check)',   areaBossEnabled(4));
  check('213. areaBossEnabled(3) = false (external domain check)', !areaBossEnabled(3));
  check('214. merchantMaxCount(5) > 0 (external domain check)',     merchantMaxCount(5) > 0);
  check('215. merchantMaxCount(4) = 0 (external domain check)',     merchantMaxCount(4) === 0);
}

// Exhaustiveness guard: union covers ch1-10 with exactly 24 systems
{
  const unlocksByChapter = new Map<number, BookISystem[]>();
  for (const system of BOOK_I_SYSTEMS) {
    const ch = BOOK_I_UNLOCK_CHAPTER[system];
    if (!unlocksByChapter.has(ch)) unlocksByChapter.set(ch, []);
    unlocksByChapter.get(ch)!.push(system);
  }
  let totalSystems = 0;
  for (const [, systems] of unlocksByChapter) totalSystems += systems.length;
  eq(totalSystems, 24, '216. exhaustiveness: all 24 systems have exactly one unlock chapter');
}

// Unlock ordering: no system at ch N has unlock chapter > BOOK_I_FINAL_CHAPTER
{
  let allValid = true;
  for (const system of BOOK_I_SYSTEMS) {
    if (BOOK_I_UNLOCK_CHAPTER[system] > BOOK_I_FINAL_CHAPTER) { allValid = false; break; }
  }
  check('217. no system unlocks beyond BOOK_I_FINAL_CHAPTER', allValid);
}

// Chapters covered: at least one system unlocks at each chapter 1–10
{
  for (let ch = 1; ch <= 10; ch++) {
    check(`218. ch${ch} has at least one system unlocking`, getChapterUnlocks(ch).length > 0);
  }
}

// ── 221–230: Immutability ─────────────────────────────────────────────────────

console.log('\n── Immutability ──');

{
  // getChapterUnlocks returns a fresh array each time
  const a = getChapterUnlocks(3) as BookISystem[];
  const b = getChapterUnlocks(3);
  check('219. getChapterUnlocks returns independent arrays', a !== b);

  // getCumulativeUnlocks returns a fresh array
  const c = getCumulativeUnlocks(5) as BookISystem[];
  const d = getCumulativeUnlocks(5);
  check('220. getCumulativeUnlocks returns independent arrays', c !== d);

  // availableShifts returns a fresh array
  const e = availableShifts(6) as string[];
  const f = availableShifts(6);
  check('221. availableShifts returns independent arrays', e !== f);

  // BOOK_I_SYSTEMS constant is readonly — can still read from it
  check('222. BOOK_I_SYSTEMS[0] is still stability', BOOK_I_SYSTEMS[0] === 'stability');
}

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failures.length > 0) {
  console.error('\nFailed tests:');
  failures.forEach(f => console.error(`  • ${f}`));
  process.exit(1);
}
