/**
 * tests/chapter_loadout.test.ts — Ward Event chapter loadout (Push 10)
 *
 * Tests for frontend/src/game/chapterLoadout.ts
 *
 * Coverage:
 *   1–15:   createEmptyLoadout — initial state, all defaults
 *  16–40:   Call Team — add, full check, replace, upgrade, convert, capacity upgrade
 *  41–65:   Protocol Cards — add, hand limit, use, replace, convert, available/used queries
 *  66–100:  Ward Blessings — major slot, minor slots, addBlessing, clear, convert
 * 101–120:  Ward Hazards — add (uncapped), remove, scope filters, pressure penalty
 * 121–135:  clearChapterLoadout — all resources wiped, capacity preserved
 * 136–155:  Query helpers — activeBlessings, battleHazards, mapHazards, totalPressurePenalty
 * 156–175:  validateChapterLoadout — all invariants
 * 176–185:  Immutability — originals never mutated
 */

import {
  createEmptyLoadout,
  isCallTeamFull,
  isCallTeamDuplicate,
  findCallTeamDuplicateIndex,
  addCallTeamMember,
  replaceCallTeamMember,
  upgradeCallTeamMember,
  convertCallTeamMember,
  upgradeCallTeamCapacity,
  canDrawCard,
  isHandFull,
  addCard,
  useCard,
  replaceCard,
  convertCard,
  isMajorBlessingFull,
  isMinorBlessingFull,
  isBlessingSlotFull,
  addBlessing,
  setMajorBlessing,
  setMinorBlessing,
  clearMajorBlessing,
  clearMinorBlessing,
  convertBlessing,
  addHazard,
  removeHazard,
  clearChapterLoadout,
  availableCards,
  usedCards,
  activeBlessings,
  battleHazards,
  mapHazards,
  totalPressurePenalty,
  validateChapterLoadout,
  INITIAL_CALL_TEAM_CAPACITY,
  MAX_CALL_TEAM_CAPACITY,
  CARD_HAND_LIMIT,
  MINOR_BLESSING_SLOTS,
  CONVERT_CALL_TEAM_FAVOR,
  CONVERT_BLESSING_FAVOR,
  CONVERT_CARD_FAVOR,
  type ChapterLoadout,
  type CallTeamMember,
  type ProtocolCard,
  type WardBlessing,
  type WardHazard,
} from '../src/game/chapterLoadout';

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

function member(id: string, role: CallTeamMember['role'] = 'doctor'): CallTeamMember {
  return { id, name: id, role, bonus: { kind: 'stability_restore', magnitude: 5 }, upgraded: false };
}

function card(id: string): ProtocolCard {
  return { id, name: id, effect: { kind: 'stabilize', magnitude: 10 }, sourceTileId: 'tile_0', used: false };
}

function blessing(id: string, tier: WardBlessing['tier']): WardBlessing {
  return {
    id, name: id, tier, sourceTileId: 'tile_0',
    effect: { kind: 'opening_readiness', magnitude: 3, trigger: 'passive' },
  };
}

function hazard(id: string, scope: WardHazard['scope'] = 'battle'): WardHazard {
  return {
    id, name: id, scope, sourceTileId: 'tile_0',
    penalty: { kind: 'readiness_reduce', magnitude: 2 },
  };
}

// ── 1–15: createEmptyLoadout ──────────────────────────────────────────────────

console.log('\n── createEmptyLoadout ──');

{
  const l = createEmptyLoadout();
  eq(l.callTeam.length,         0,                        '1. callTeam starts empty');
  eq(l.callTeamCapacity,        INITIAL_CALL_TEAM_CAPACITY,'2. capacity = INITIAL (2)');
  eq(l.cards.length,            0,                        '3. cards starts empty');
  eq(l.cardHandLimit,           CARD_HAND_LIMIT,          '4. cardHandLimit = 5');
  eq(l.majorBlessing,           null,                     '5. majorBlessing = null');
  eq(l.minorBlessings.length,   MINOR_BLESSING_SLOTS,     '6. minorBlessings has 2 slots');
  check('7. minorBlessings all null', l.minorBlessings.every(b => b === null));
  eq(l.hazards.length,          0,                        '8. hazards starts empty');
  eq(validateChapterLoadout(l).length, 0,                 '9. empty loadout is valid');
  eq(INITIAL_CALL_TEAM_CAPACITY, 2,                       '10. INITIAL_CALL_TEAM_CAPACITY = 2');
  eq(MAX_CALL_TEAM_CAPACITY,     3,                       '11. MAX_CALL_TEAM_CAPACITY = 3');
  eq(CARD_HAND_LIMIT,            5,                       '12. CARD_HAND_LIMIT = 5');
  eq(MINOR_BLESSING_SLOTS,       2,                       '13. MINOR_BLESSING_SLOTS = 2');
  eq(CONVERT_CALL_TEAM_FAVOR,    15,                      '14. CONVERT_CALL_TEAM_FAVOR = 15');
  eq(CONVERT_BLESSING_FAVOR,     10,                      '15. CONVERT_BLESSING_FAVOR = 10');
}

// ── 16–40: Call Team ──────────────────────────────────────────────────────────

console.log('\n── Call Team ──');

{
  const empty = createEmptyLoadout();

  // isCallTeamFull
  check('16. empty: not full',              !isCallTeamFull(empty));
  const one  = addCallTeamMember(empty, member('m1'));
  check('17. one member: not full',         !isCallTeamFull(one));
  const two  = addCallTeamMember(one, member('m2', 'specialist'));
  check('18. two members: full (cap=2)',     isCallTeamFull(two));

  // addCallTeamMember
  eq(two.callTeam.length, 2,                '19. added 2 members');
  eq(two.callTeam[0].id, 'm1',             '20. first member id preserved');
  eq(two.callTeam[1].id, 'm2',             '21. second member id preserved');

  // throws when full
  let threw = false;
  try { addCallTeamMember(two, member('m3')); } catch { threw = true; }
  check('22. addCallTeamMember throws when full', threw);

  // isCallTeamDuplicate
  check('23. no duplicate: same member role is duplicate', isCallTeamDuplicate(one, member('m99', 'doctor')));
  check('24. different role: not duplicate', !isCallTeamDuplicate(one, member('m99', 'specialist')));

  // findCallTeamDuplicateIndex
  eq(findCallTeamDuplicateIndex(two, member('dup', 'doctor')), 0,  '25. duplicate at index 0');
  eq(findCallTeamDuplicateIndex(two, member('dup', 'consultant')), -1, '26. no duplicate → -1');

  // replaceCallTeamMember
  const replaced = replaceCallTeamMember(two, 0, member('new', 'consultant'));
  eq(replaced.callTeam[0].id,   'new',       '27. replaced slot 0');
  eq(replaced.callTeam[1].id,   'm2',        '28. slot 1 unchanged');
  eq(replaced.callTeam.length,  2,           '29. length unchanged after replace');

  // throws on bad index
  let threwReplace = false;
  try { replaceCallTeamMember(two, 5, member('x')); } catch { threwReplace = true; }
  check('30. replaceCallTeamMember bad index throws', threwReplace);

  // upgradeCallTeamMember
  const upgMember = { ...member('m1-upgraded', 'doctor'), upgraded: true };
  const upgraded  = upgradeCallTeamMember(two, 0, upgMember);
  check('31. upgraded member has upgraded=true', upgraded.callTeam[0].upgraded);
  eq(upgraded.callTeam[0].id, 'm1-upgraded',    '32. upgraded member id updated');

  // convertCallTeamMember
  const { loadout: cvtL, convert } = convertCallTeamMember(two, member('extra'));
  eq(cvtL.callTeam.length, 2,                    '33. convert: loadout unchanged');
  eq(convert.favorGained,  CONVERT_CALL_TEAM_FAVOR, '34. convert: favor = CONVERT_CALL_TEAM_FAVOR');

  // upgradeCallTeamCapacity
  const upgraded3 = upgradeCallTeamCapacity(two);
  eq(upgraded3.callTeamCapacity, 3,              '35. capacity upgraded to 3');
  check('36. after capacity upgrade, can add third', !isCallTeamFull(upgraded3));
  const three = addCallTeamMember(upgraded3, member('m3', 'consultant'));
  eq(three.callTeam.length, 3,                   '37. three members after capacity upgrade');
  check('38. at cap=3, is now full',              isCallTeamFull(three));

  // upgradeCallTeamCapacity idempotent at max
  const atMax = upgradeCallTeamCapacity(upgraded3);
  eq(atMax.callTeamCapacity, MAX_CALL_TEAM_CAPACITY, '39. capacity at max stays at max');
  eq(upgradeCallTeamCapacity(atMax).callTeamCapacity, MAX_CALL_TEAM_CAPACITY,
    '40. second upgrade still at max');
}

// ── 41–65: Protocol Cards ─────────────────────────────────────────────────────

console.log('\n── Protocol Cards ──');

{
  const empty = createEmptyLoadout();

  // canDrawCard / isHandFull
  check('41. empty: can draw',   canDrawCard(empty));
  check('42. empty: not full',   !isHandFull(empty));

  // Fill to hand limit
  let l = empty;
  for (let i = 0; i < CARD_HAND_LIMIT; i++) {
    l = addCard(l, card(`c${i}`));
  }
  check('43. full hand: canDrawCard false',  !canDrawCard(l));
  check('44. full hand: isHandFull true',     isHandFull(l));
  eq(l.cards.length, CARD_HAND_LIMIT,        '45. cards.length = CARD_HAND_LIMIT');

  // throws when full
  let threw = false;
  try { addCard(l, card('overflow')); } catch { threw = true; }
  check('46. addCard throws when full', threw);

  // useCard
  const l2  = addCard(createEmptyLoadout(), card('c1'));
  const l2u = useCard(l2, 'c1');
  check('47. used card has used=true',    l2u.cards[0].used);
  eq(l2u.cards.length, 1,               '48. used card still in hand');
  // unknown id: no-op
  const l2x = useCard(l2, 'unknown');
  check('49. unknown id: unused card unchanged', !l2x.cards[0].used);

  // replaceCard
  const l3  = addCard(addCard(createEmptyLoadout(), card('a')), card('b'));
  const l3r = replaceCard(l3, 0, card('replaced'));
  eq(l3r.cards[0].id, 'replaced',        '50. replaceCard slot 0');
  eq(l3r.cards[1].id, 'b',               '51. slot 1 unchanged');
  let threwReplace = false;
  try { replaceCard(l3, 10, card('x')); } catch { threwReplace = true; }
  check('52. replaceCard bad index throws', threwReplace);

  // convertCard
  const { loadout: cvtL, convert } = convertCard(l, card('extra'));
  eq(cvtL.cards.length, CARD_HAND_LIMIT, '53. convert: hand unchanged');
  eq(convert.favorGained, CONVERT_CARD_FAVOR, '54. convert: CONVERT_CARD_FAVOR');

  // availableCards / usedCards
  const la = addCard(createEmptyLoadout(), card('x'));
  const lb = useCard(addCard(la, card('y')), 'y');
  eq(availableCards(lb).length, 1,        '55. availableCards: 1 unplayed');
  eq(usedCards(lb).length,      1,        '56. usedCards: 1 played');
  eq(availableCards(lb)[0].id,  'x',      '57. available card is x');
  eq(usedCards(lb)[0].id,       'y',      '58. used card is y');

  // CONVERT_CARD_FAVOR constant
  eq(CONVERT_CARD_FAVOR, 5, '59. CONVERT_CARD_FAVOR = 5');
}

// ── 66–100: Ward Blessings ────────────────────────────────────────────────────

console.log('\n── Ward Blessings ──');

{
  const empty = createEmptyLoadout();

  // Major slot
  check('60. empty: major not full',     !isMajorBlessingFull(empty));
  const withMajor = setMajorBlessing(empty, blessing('b-maj', 'major'));
  check('61. after set: major full',      isMajorBlessingFull(withMajor));
  eq(withMajor.majorBlessing?.id, 'b-maj', '62. major blessing id set');

  // Replace major
  const withMaj2 = setMajorBlessing(withMajor, blessing('b-maj2', 'major'));
  eq(withMaj2.majorBlessing?.id, 'b-maj2', '63. major blessing replaced');

  // Clear major
  const cleared = clearMajorBlessing(withMajor);
  eq(cleared.majorBlessing, null,         '64. major cleared → null');

  // Minor slots
  check('65. empty: minor not full',     !isMinorBlessingFull(empty));
  const withMin0 = setMinorBlessing(empty, 0, blessing('b-min0', 'minor'));
  eq(withMin0.minorBlessings[0]?.id, 'b-min0', '66. minor slot 0 set');
  check('67. one minor: not full', !isMinorBlessingFull(withMin0));
  const withMin1 = setMinorBlessing(withMin0, 1, blessing('b-min1', 'minor'));
  check('68. two minors: full',    isMinorBlessingFull(withMin1));

  // Clear minor slot
  const clearedMin = clearMinorBlessing(withMin1, 0);
  eq(clearedMin.minorBlessings[0], null, '69. minor slot 0 cleared');
  eq(clearedMin.minorBlessings[1]?.id, 'b-min1', '70. minor slot 1 unchanged');

  // bad minor index throws
  let threw0 = false;
  try { setMinorBlessing(empty, 5, blessing('x', 'minor')); } catch { threw0 = true; }
  check('71. bad minor index throws', threw0);

  // addBlessing — major
  const ab1 = addBlessing(empty, blessing('ab-maj', 'major'));
  eq(ab1.majorBlessing?.id, 'ab-maj',  '72. addBlessing major → major slot');
  let threwMaj = false;
  try { addBlessing(ab1, blessing('ab-maj2', 'major')); } catch { threwMaj = true; }
  check('73. addBlessing throws when major full', threwMaj);

  // addBlessing — minor fills first empty slot
  const ab2 = addBlessing(empty, blessing('ab-min0', 'minor'));
  eq(ab2.minorBlessings[0]?.id, 'ab-min0', '74. addBlessing minor → slot 0');
  const ab3 = addBlessing(ab2, blessing('ab-min1', 'minor'));
  eq(ab3.minorBlessings[1]?.id, 'ab-min1', '75. addBlessing minor → slot 1');
  let threwMin = false;
  try { addBlessing(ab3, blessing('ab-min2', 'minor')); } catch { threwMin = true; }
  check('76. addBlessing throws when all minor full', threwMin);

  // isBlessingSlotFull
  check('77. isBlessingSlotFull major=false when empty', !isBlessingSlotFull(empty, 'major'));
  check('78. isBlessingSlotFull major=true when set',     isBlessingSlotFull(ab1, 'major'));
  check('79. isBlessingSlotFull minor=false when empty',  !isBlessingSlotFull(empty, 'minor'));
  check('80. isBlessingSlotFull minor=true when full',    isBlessingSlotFull(ab3, 'minor'));

  // convertBlessing
  const { loadout: cvtL, convert } = convertBlessing(ab3, blessing('extra', 'minor'));
  check('81. convert: loadout unchanged', cvtL.minorBlessings[0]?.id === 'ab-min0');
  eq(convert.favorGained, CONVERT_BLESSING_FAVOR, '82. convert: CONVERT_BLESSING_FAVOR');

  // Blessings survive if loadout otherwise unchanged
  const unchanged = { ...ab3 };
  eq(unchanged.minorBlessings[0]?.id, 'ab-min0', '83. spread preserves blessings');
}

// ── 101–120: Ward Hazards ─────────────────────────────────────────────────────

console.log('\n── Ward Hazards ──');

{
  const empty = createEmptyLoadout();

  // Add uncapped
  let l = empty;
  for (let i = 0; i < 10; i++) {
    l = addHazard(l, hazard(`h${i}`, i % 2 === 0 ? 'battle' : 'map'));
  }
  eq(l.hazards.length, 10,                  '84. hazards uncapped: 10 added');

  // removeHazard
  const removed = removeHazard(l, 'h3');
  eq(removed.hazards.length, 9,             '85. remove: length -1');
  check('86. removed h3 not present',       !removed.hazards.some(h => h.id === 'h3'));

  // no-op on unknown id
  const noOp = removeHazard(l, 'unknown');
  eq(noOp.hazards.length, 10,               '87. remove unknown: no-op');

  // scope filter — battle hazards (even indices = battle or both)
  const bh = battleHazards(l);
  check('88. battleHazards only battle/both scope',
    bh.every(h => h.scope === 'battle' || h.scope === 'both'));

  // scope filter — map hazards (odd indices = map or both)
  const mh = mapHazards(l);
  check('89. mapHazards only map/both scope',
    mh.every(h => h.scope === 'map' || h.scope === 'both'));

  // 'both' scope hazard appears in both filters
  const withBoth = addHazard(empty,
    { ...hazard('h-both'), scope: 'both', penalty: { kind: 'readiness_reduce', magnitude: 3 } });
  check('90. both-scope in battleHazards', battleHazards(withBoth).some(h => h.id === 'h-both'));
  check('91. both-scope in mapHazards',    mapHazards(withBoth).some(h => h.id === 'h-both'));
}

// ── 121–135: clearChapterLoadout ──────────────────────────────────────────────

console.log('\n── clearChapterLoadout ──');

{
  // Build a full loadout
  let l = createEmptyLoadout();
  l = addCallTeamMember(l, member('m1'));
  l = addCard(l, card('c1'));
  l = addBlessing(l, blessing('b1', 'major'));
  l = addBlessing(l, blessing('b2', 'minor'));
  l = addHazard(l, hazard('h1'));
  // Upgrade capacity
  l = upgradeCallTeamCapacity(l);

  const cleared = clearChapterLoadout(l);

  eq(cleared.callTeam.length,            0,    '92. cleared: callTeam empty');
  eq(cleared.cards.length,               0,    '93. cleared: cards empty');
  eq(cleared.majorBlessing,              null, '94. cleared: majorBlessing null');
  check('95. cleared: all minorBlessings null', cleared.minorBlessings.every(b => b === null));
  eq(cleared.hazards.length,             0,    '96. cleared: hazards empty');
  eq(cleared.cardHandLimit, CARD_HAND_LIMIT,   '97. cleared: cardHandLimit reset');

  // callTeamCapacity persists through clear
  eq(cleared.callTeamCapacity, 3,              '98. callTeamCapacity preserved after clear');

  // Original unchanged
  eq(l.callTeam.length, 1,                    '99. original loadout not mutated by clear');
  eq(validateChapterLoadout(cleared).length, 0,'100. cleared loadout is valid');
}

// ── 136–155: Query helpers ────────────────────────────────────────────────────

console.log('\n── Query helpers ──');

{
  const base = createEmptyLoadout();

  // activeBlessings
  let l = addBlessing(base, blessing('maj', 'major'));
  l     = addBlessing(l,    blessing('min0', 'minor'));
  l     = addBlessing(l,    blessing('min1', 'minor'));
  const active = activeBlessings(l);
  eq(active.length, 3,                        '101. activeBlessings = 3');
  check('102. major is in activeBlessings',    active.some(b => b.id === 'maj'));
  check('103. minor0 is in activeBlessings',   active.some(b => b.id === 'min0'));
  check('104. minor1 is in activeBlessings',   active.some(b => b.id === 'min1'));

  // empty blessings → 0 active
  eq(activeBlessings(base).length, 0,         '105. no blessings → 0 active');

  // totalPressurePenalty
  const h1 = { ...hazard('h1', 'battle'), penalty: { kind: 'readiness_reduce' as const, magnitude: 3 } };
  const h2 = { ...hazard('h2', 'battle'), penalty: { kind: 'readiness_reduce' as const, magnitude: 2 } };
  const h3 = { ...hazard('h3', 'map'),   penalty: { kind: 'readiness_reduce' as const, magnitude: 5 } }; // map only
  let lh = addHazard(addHazard(addHazard(base, h1), h2), h3);
  eq(totalPressurePenalty(lh), 5,             '106. totalPressurePenalty = battle hazards only (3+2)');

  // non-readiness hazard doesn't contribute to pressure
  const h4 = { ...hazard('h4', 'battle'), penalty: { kind: 'stability_drain' as const, magnitude: 4 } };
  lh = addHazard(lh, h4);
  eq(totalPressurePenalty(lh), 5,             '107. non-readiness-reduce hazard excluded from pressure');

  // availableCards / usedCards
  let lc = addCard(addCard(base, card('a')), card('b'));
  lc = useCard(lc, 'a');
  eq(availableCards(lc).length, 1,            '108. availableCards = 1 after use');
  eq(usedCards(lc).length, 1,                 '109. usedCards = 1');
  eq(availableCards(lc)[0].id, 'b',           '110. available is b');
}

// ── 156–175: validateChapterLoadout ───────────────────────────────────────────

console.log('\n── validateChapterLoadout ──');

{
  const base = createEmptyLoadout();
  eq(validateChapterLoadout(base).length, 0, '111. empty loadout valid');

  // callTeam over capacity
  let overTeam = { ...base, callTeam: [member('a'), member('b'), member('c')], callTeamCapacity: 2 };
  check('112. callTeam over capacity: error', validateChapterLoadout(overTeam).length > 0);

  // capacity out of range
  let badCap = { ...base, callTeamCapacity: 1 };
  check('113. callTeamCapacity too low: error', validateChapterLoadout(badCap).length > 0);
  let badCap2 = { ...base, callTeamCapacity: 4 };
  check('114. callTeamCapacity too high: error', validateChapterLoadout(badCap2).length > 0);

  // duplicate call team ids
  const dupTeam = { ...base, callTeam: [member('dup'), member('dup')] };
  check('115. duplicate call team ids: error',
    validateChapterLoadout(dupTeam).some(e => e.includes('Duplicate Call Team')));

  // cards over hand limit
  const manyCards: ProtocolCard[] = Array.from({ length: 6 }, (_, i) => card(`c${i}`));
  const overCards = { ...base, cards: manyCards };
  check('116. cards over hand limit: error', validateChapterLoadout(overCards).length > 0);

  // duplicate card ids
  const dupCards = { ...base, cards: [card('dup'), card('dup')] };
  check('117. duplicate card ids: error',
    validateChapterLoadout(dupCards).some(e => e.includes('Duplicate ProtocolCard')));

  // major blessing with wrong tier
  const badMaj = { ...base, majorBlessing: { ...blessing('b', 'minor') } };
  check('118. major slot has minor tier: error',
    validateChapterLoadout(badMaj).some(e => e.includes("'major'")));

  // minor slots wrong length
  const badMinLen = { ...base, minorBlessings: [null] as (WardBlessing | null)[] };
  check('119. minorBlessings wrong length: error',
    validateChapterLoadout(badMinLen).length > 0);

  // minor slot has major tier
  const badMinTier = { ...base, minorBlessings: [blessing('b', 'major'), null] as (WardBlessing | null)[] };
  check('120. minor slot has major tier: error',
    validateChapterLoadout(badMinTier).some(e => e.includes("'minor'")));

  // duplicate hazard ids
  const dupHaz = { ...base, hazards: [hazard('dup'), hazard('dup')] };
  check('121. duplicate hazard ids: error',
    validateChapterLoadout(dupHaz).some(e => e.includes('Duplicate WardHazard')));

  // valid full loadout
  let full = createEmptyLoadout();
  full = upgradeCallTeamCapacity(addCallTeamMember(addCallTeamMember(full, member('a')), member('b', 'specialist')));
  full = addCard(addCard(full, card('c1')), card('c2'));
  full = addBlessing(addBlessing(full, blessing('maj', 'major')), blessing('min', 'minor'));
  full = addHazard(addHazard(full, hazard('h1')), hazard('h2', 'map'));
  eq(validateChapterLoadout(full).length, 0, '122. full valid loadout: no errors');
}

// ── 176–185: Immutability ─────────────────────────────────────────────────────

console.log('\n── Immutability ──');

{
  const base = createEmptyLoadout();

  // addCallTeamMember: original unchanged
  const withMember = addCallTeamMember(base, member('m'));
  eq(base.callTeam.length, 0,    '123. addCallTeamMember: original unchanged');

  // addCard: original unchanged
  const withCard = addCard(base, card('c'));
  eq(base.cards.length, 0,       '124. addCard: original unchanged');

  // addBlessing: original unchanged
  const withBlessing = addBlessing(base, blessing('b', 'major'));
  eq(base.majorBlessing, null,   '125. addBlessing: original unchanged');

  // addHazard: original unchanged
  const withHazard = addHazard(base, hazard('h'));
  eq(base.hazards.length, 0,     '126. addHazard: original unchanged');

  // clearChapterLoadout: original unchanged
  const cleared = clearChapterLoadout(withMember);
  eq(withMember.callTeam.length, 1, '127. clearChapterLoadout: original unchanged');

  // replaceCallTeamMember: original unchanged
  const two = addCallTeamMember(withMember, member('n', 'specialist'));
  const rep = replaceCallTeamMember(two, 0, member('x'));
  eq(two.callTeam[0].id, 'm',   '128. replace: original unchanged');

  // useCard: original unchanged
  const withCard2 = addCard(base, card('d'));
  const used = useCard(withCard2, 'd');
  check('129. useCard: original card not marked used', !withCard2.cards[0].used);

  // removeHazard: original unchanged
  const withH = addHazard(base, hazard('h1'));
  removeHazard(withH, 'h1');
  eq(withH.hazards.length, 1,   '130. removeHazard: original unchanged');
}

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failures.length > 0) {
  console.error('\nFailed tests:');
  failures.forEach(f => console.error(`  • ${f}`));
  process.exit(1);
}
