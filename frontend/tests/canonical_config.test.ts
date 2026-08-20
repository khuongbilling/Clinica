/**
 * canonical_config.test.ts
 *
 * Unit tests for journeyMap/canonicalConfig.ts (Push 1 balance values).
 *
 * Run: npx sucrase-node tests/canonical_config.test.ts
 *
 * Spot chapters: 1, 2, 3, 4, 5, 10, 11, 20, 21, 35, 50, 100
 *
 * Covers:
 *  - Tile counts at every band boundary
 *  - Area boss rate tiers (Ch 1 = 3%, Ch 2–3 = 0%, Ch 4–10 = 3%,
 *    Ch 11–20 = 4%, Ch 21+ = 5%)
 *  - Treasure rate progression and 12% cap
 *  - Merchant rate progression and 5% cap
 *  - Ward event rates: partial unlock at Ch 2/3, full rates at Ch 4+
 *  - Full encounter table sums to exactly 10 000 bp for all spot chapters × all times
 *  - Enemy density caps by time of day
 *  - Chest quality rates: checkpoints and total = 10 000 bp
 *  - validateCanonicalRates catches bad tables
 *  - validateCanonicalChestRates catches bad tables
 */

import {
  CANONICAL_TOTAL_BP,
  CANONICAL_AREA_BOSS_HARD_MAX,
  CANONICAL_CHEST_BRONZE_MIN_BP,
  CANONICAL_CHEST_GOLD_MAX_BP,
  CANONICAL_WARD_EVENT_FULL_DAY_BP,
  CANONICAL_WARD_EVENT_FULL_EVENING_BP,
  CANONICAL_WARD_EVENT_FULL_NIGHT_BP,
  TIME_OF_DAY_VALUES,
  canonicalTileCount,
  canonicalAreaBossRateBp,
  canonicalTreasureRateBp,
  canonicalMerchantRateBp,
  canonicalWardEventRateBp,
  canonicalEncounterRatesBp,
  canonicalChestQualityRatesBp,
  canonicalEnemyDensityCapBp,
  validateCanonicalRates,
  validateCanonicalChestRates,
  type TimeOfDay,
} from '../src/game/journeyMap/canonicalConfig';

// ── Test harness ───────────────────────────────────────────────────────────────

let _errors = 0;
function check(name: string, pass: boolean, detail = '') {
  if (pass) {
    console.log(`PASS - ${name}`);
  } else {
    console.error(`FAIL - ${name}${detail ? ` (${detail})` : ''}`);
    _errors++;
  }
}

const SPOT_CHAPTERS = [1, 2, 3, 4, 5, 10, 11, 20, 21, 35, 50, 100] as const;

function pct(bp: number): number { return bp / 100; }

// ── 1. Tile counts ─────────────────────────────────────────────────────────────

console.log('\n── 1. Tile counts ──');

check('ch1  → 30', canonicalTileCount(1)   === 30);
check('ch2  → 30', canonicalTileCount(2)   === 30);
check('ch5  → 30', canonicalTileCount(5)   === 30);
check('ch6  → 35', canonicalTileCount(6)   === 35);
check('ch10 → 35', canonicalTileCount(10)  === 35);
check('ch11 → 40', canonicalTileCount(11)  === 40);
check('ch20 → 40', canonicalTileCount(20)  === 40);
check('ch21 → 45', canonicalTileCount(21)  === 45);
check('ch30 → 45', canonicalTileCount(30)  === 45);
check('ch31 → 50', canonicalTileCount(31)  === 50);
check('ch35 → 50', canonicalTileCount(35)  === 50);
check('ch40 → 50', canonicalTileCount(40)  === 50);
check('ch41 → 55', canonicalTileCount(41)  === 55);
check('ch50 → 55', canonicalTileCount(50)  === 55);
check('ch51 → 60', canonicalTileCount(51)  === 60);
check('ch100 → 80', canonicalTileCount(100) === 80,
  `got ${canonicalTileCount(100)}`);

// ── 2. Area boss rates ─────────────────────────────────────────────────────────

console.log('\n── 2. Area boss rates ──');

check('ch1  areaBoss=3%',  canonicalAreaBossRateBp(1)  === 300);
check('ch2  areaBoss=0%',  canonicalAreaBossRateBp(2)  ===   0);
check('ch3  areaBoss=0%',  canonicalAreaBossRateBp(3)  ===   0);
check('ch4  areaBoss=3%',  canonicalAreaBossRateBp(4)  === 300);
check('ch5  areaBoss=3%',  canonicalAreaBossRateBp(5)  === 300);
check('ch10 areaBoss=3%',  canonicalAreaBossRateBp(10) === 300);
check('ch11 areaBoss=4%',  canonicalAreaBossRateBp(11) === 400);
check('ch20 areaBoss=4%',  canonicalAreaBossRateBp(20) === 400);
check('ch21 areaBoss=5%',  canonicalAreaBossRateBp(21) === 500);
check('ch35 areaBoss=5%',  canonicalAreaBossRateBp(35) === 500);
check('ch50 areaBoss=5%',  canonicalAreaBossRateBp(50) === 500);
check('ch100 areaBoss=5%', canonicalAreaBossRateBp(100) === 500);
check('area boss hard max = 3', CANONICAL_AREA_BOSS_HARD_MAX === 3);

// ── 3. Treasure rates ──────────────────────────────────────────────────────────

console.log('\n── 3. Treasure rates ──');

check('ch1  treasure=5%',  canonicalTreasureRateBp(1)  ===  500);
check('ch4  treasure=5%',  canonicalTreasureRateBp(4)  ===  500);
check('ch5  treasure=6%',  canonicalTreasureRateBp(5)  ===  600);
check('ch10 treasure=7%',  canonicalTreasureRateBp(10) ===  700);
check('ch11 treasure=7%',  canonicalTreasureRateBp(11) ===  700);
check('ch20 treasure=9%',  canonicalTreasureRateBp(20) ===  900);
check('ch21 treasure=9%',  canonicalTreasureRateBp(21) ===  900);
check('ch35 treasure=12%', canonicalTreasureRateBp(35) === 1_200);
check('ch50 treasure=12% (cap)', canonicalTreasureRateBp(50)  === 1_200);
check('ch100 treasure=12% (cap)', canonicalTreasureRateBp(100) === 1_200);

// ── 4. Merchant rates ──────────────────────────────────────────────────────────

console.log('\n── 4. Merchant rates ──');

check('ch1  merchant=0%',  canonicalMerchantRateBp(1)  ===   0);
check('ch4  merchant=0%',  canonicalMerchantRateBp(4)  ===   0);
check('ch5  merchant=1%',  canonicalMerchantRateBp(5)  === 100);
check('ch10 merchant=2%',  canonicalMerchantRateBp(10) === 200);
check('ch11 merchant=2%',  canonicalMerchantRateBp(11) === 200);
check('ch20 merchant=4%',  canonicalMerchantRateBp(20) === 400);
check('ch21 merchant=4%',  canonicalMerchantRateBp(21) === 400);
check('ch25 merchant=5%',  canonicalMerchantRateBp(25) === 500);
check('ch35 merchant=5% (cap)',  canonicalMerchantRateBp(35)  === 500);
check('ch100 merchant=5% (cap)', canonicalMerchantRateBp(100) === 500);

// ── 5. Ward event rates ────────────────────────────────────────────────────────

console.log('\n── 5. Ward event rates ──');

// Chapter 1: always 0
for (const tod of TIME_OF_DAY_VALUES) {
  check(`ch1 wardEvent=0% (${tod})`, canonicalWardEventRateBp(1, tod) === 0);
}

// Chapter 2: 5% day only
check('ch2 wardEvent=5% (day)',     canonicalWardEventRateBp(2, 'day')     === 500);
check('ch2 wardEvent=0% (evening)', canonicalWardEventRateBp(2, 'evening') ===   0);
check('ch2 wardEvent=0% (night)',   canonicalWardEventRateBp(2, 'night')   ===   0);

// Chapter 3: 10% day only
check('ch3 wardEvent=10% (day)',    canonicalWardEventRateBp(3, 'day')     === 1_000);
check('ch3 wardEvent=0% (evening)', canonicalWardEventRateBp(3, 'evening') ===   0);
check('ch3 wardEvent=0% (night)',   canonicalWardEventRateBp(3, 'night')   ===   0);

// Chapter 4+: full rates
for (const ch of [4, 5, 10, 11, 20, 21, 35, 50, 100]) {
  check(`ch${ch} wardEvent=15% (day)`,
    canonicalWardEventRateBp(ch, 'day')     === CANONICAL_WARD_EVENT_FULL_DAY_BP);
  check(`ch${ch} wardEvent=12% (evening)`,
    canonicalWardEventRateBp(ch, 'evening') === CANONICAL_WARD_EVENT_FULL_EVENING_BP);
  check(`ch${ch} wardEvent=9%  (night)`,
    canonicalWardEventRateBp(ch, 'night')   === CANONICAL_WARD_EVENT_FULL_NIGHT_BP);
}

check('full day bp = 1500',     CANONICAL_WARD_EVENT_FULL_DAY_BP     === 1_500);
check('full evening bp = 1200', CANONICAL_WARD_EVENT_FULL_EVENING_BP === 1_200);
check('full night bp = 900',    CANONICAL_WARD_EVENT_FULL_NIGHT_BP   ===   900);

// ── 6. Full encounter table sums ───────────────────────────────────────────────

console.log('\n── 6. Full encounter table sums to 10 000 bp ──');

for (const ch of SPOT_CHAPTERS) {
  for (const tod of TIME_OF_DAY_VALUES) {
    const r = canonicalEncounterRatesBp(ch, tod);
    const errs = validateCanonicalRates(r);
    check(`ch${ch}/${tod} sum=${CANONICAL_TOTAL_BP}`,
      errs.length === 0,
      errs.join('; '));
  }
}

// ── 7. Spot-check specific rate values ────────────────────────────────────────

console.log('\n── 7. Spot-check rate values ──');

{
  const r = canonicalEncounterRatesBp(1, 'day');
  check('ch1/day battle=30%',   pct(r.battle)    === 30);
  check('ch1/day areaBoss=3%',  pct(r.areaBoss)  ===  3);
  check('ch1/day treasure=5%',  pct(r.treasure)  ===  5);
  check('ch1/day merchant=0%',  pct(r.merchant)  ===  0);
  check('ch1/day wardEvent=0%', pct(r.wardEvent) ===  0);
  check('ch1/day none=62%',     pct(r.none)      === 62);
}
{
  const r = canonicalEncounterRatesBp(2, 'day');
  check('ch2/day wardEvent=5%', pct(r.wardEvent) === 5);
  check('ch2/day none=60%',     pct(r.none)      === 60);
}
{
  const r = canonicalEncounterRatesBp(2, 'evening');
  check('ch2/evening wardEvent=0%', pct(r.wardEvent) === 0);
  check('ch2/evening none=65%',     pct(r.none)      === 65);
}
{
  const r = canonicalEncounterRatesBp(3, 'day');
  check('ch3/day wardEvent=10%', pct(r.wardEvent) === 10);
  check('ch3/day none=55%',      pct(r.none)      === 55);
}
{
  const r = canonicalEncounterRatesBp(4, 'day');
  check('ch4/day areaBoss=3%',   pct(r.areaBoss)  ===  3);
  check('ch4/day wardEvent=15%', pct(r.wardEvent) === 15);
  check('ch4/day none=47%',      pct(r.none)      === 47);
}
{
  const r = canonicalEncounterRatesBp(5, 'day');
  check('ch5/day treasure=6%',   pct(r.treasure)  ===  6);
  check('ch5/day merchant=1%',   pct(r.merchant)  ===  1);
  check('ch5/day none=45%',      pct(r.none)      === 45);
}
{
  const r = canonicalEncounterRatesBp(10, 'day');
  check('ch10/day areaBoss=3%',  pct(r.areaBoss)  ===  3);
  check('ch10/day treasure=7%',  pct(r.treasure)  ===  7);
  check('ch10/day merchant=2%',  pct(r.merchant)  ===  2);
  check('ch10/day wardEvent=15%', pct(r.wardEvent) === 15);
  check('ch10/day none=43%',     pct(r.none)      === 43);
}
{
  const r = canonicalEncounterRatesBp(11, 'day');
  check('ch11/day areaBoss=4%',  pct(r.areaBoss)  === 4);
  check('ch11/day none=42%',     pct(r.none)      === 42);
}
{
  const r = canonicalEncounterRatesBp(20, 'day');
  check('ch20/day areaBoss=4%',  pct(r.areaBoss)  ===  4);
  check('ch20/day treasure=9%',  pct(r.treasure)  ===  9);
  check('ch20/day merchant=4%',  pct(r.merchant)  ===  4);
  check('ch20/day none=38%',     pct(r.none)      === 38);
}
{
  const r = canonicalEncounterRatesBp(21, 'day');
  check('ch21/day areaBoss=5%',  pct(r.areaBoss)  ===  5);
  check('ch21/day none=37%',     pct(r.none)      === 37);
}
{
  const r = canonicalEncounterRatesBp(35, 'day');
  check('ch35/day treasure=12% (cap)', pct(r.treasure) === 12);
  check('ch35/day merchant=5%  (cap)', pct(r.merchant) ===  5);
  check('ch35/day none=33%',           pct(r.none)     === 33);
}
{
  // At Ch 50+ all rate caps are hit — same as Ch 35
  const r35 = canonicalEncounterRatesBp(35,  'day');
  const r50 = canonicalEncounterRatesBp(50,  'day');
  const r100 = canonicalEncounterRatesBp(100, 'day');
  check('ch50/day == ch35/day (all caps hit)',
    JSON.stringify(r50) === JSON.stringify(r35));
  check('ch100/day == ch35/day (all caps hit)',
    JSON.stringify(r100) === JSON.stringify(r35));
}

// ── 8. Enemy density caps ──────────────────────────────────────────────────────

console.log('\n── 8. Enemy density caps ──');

check('day density cap = 40%',     canonicalEnemyDensityCapBp('day')     === 4_000);
check('evening density cap = 33%', canonicalEnemyDensityCapBp('evening') === 3_300);
check('night density cap = 25%',   canonicalEnemyDensityCapBp('night')   === 2_500);

// ── 9. Chest quality rates ─────────────────────────────────────────────────────

console.log('\n── 9. Chest quality rates ──');

// Checkpoints from spec
{
  const r = canonicalChestQualityRatesBp(1);
  check('ch1 chest: bronze=80%', pct(r.bronze) === 80);
  check('ch1 chest: silver=20%', pct(r.silver) === 20);
  check('ch1 chest: gold=0%',    pct(r.gold)   ===  0);
}
{
  const r = canonicalChestQualityRatesBp(10);
  check('ch10 chest: bronze=75.5%', r.bronze === 7_550);
  check('ch10 chest: silver=23.5%', r.silver === 2_350);
  check('ch10 chest: gold=1%',      r.gold   ===   100);
}
{
  const r = canonicalChestQualityRatesBp(20);
  check('ch20 chest: bronze=70.5%', r.bronze === 7_050);
  check('ch20 chest: silver=27.5%', r.silver === 2_750);
  check('ch20 chest: gold=2%',      r.gold   ===   200);
}

// All spot chapters must sum to CANONICAL_TOTAL_BP and pass validation
for (const ch of SPOT_CHAPTERS) {
  const r = canonicalChestQualityRatesBp(ch);
  const errs = validateCanonicalChestRates(r);
  check(`ch${ch} chest sum=${CANONICAL_TOTAL_BP}`, errs.length === 0, errs.join('; '));
}

// Constants
check('chest bronze min = 40%', CANONICAL_CHEST_BRONZE_MIN_BP === 4_000);
check('chest gold max = 15%',   CANONICAL_CHEST_GOLD_MAX_BP   === 1_500);

// Bronze floor: chapter 160+ would drive bronze below 4000 without clamp
const rHigh = canonicalChestQualityRatesBp(160);
check('ch160 bronze >= 40% floor', rHigh.bronze >= CANONICAL_CHEST_BRONZE_MIN_BP,
  `bronze=${rHigh.bronze}`);

// ── 10. validateCanonicalRates: catches bad tables ─────────────────────────────

console.log('\n── 10. Validation catches bad tables ──');

{
  const bad = { none: 5_000, battle: 3_000, areaBoss: 300, treasure: 500, merchant: 0, wardEvent: 0 };
  // sum = 8800, should fail
  const errs = validateCanonicalRates(bad);
  check('validation: catches wrong sum (8 800 ≠ 10 000)', errs.length > 0, errs.join('; '));
}
{
  const negative = { none: 6_500, battle: 3_000, areaBoss: 0, treasure: 500, merchant: 0, wardEvent: -500 };
  const errs = validateCanonicalRates(negative);
  check('validation: catches negative rate', errs.length > 0, errs.join('; '));
}
{
  const valid = canonicalEncounterRatesBp(5, 'day');
  const errs = validateCanonicalRates(valid);
  check('validation: ch5/day is valid', errs.length === 0, errs.join('; '));
}

// ── 11. validateCanonicalChestRates: catches bad tables ───────────────────────

console.log('\n── 11. Chest validation catches bad tables ──');

{
  const bad = { bronze: 7_000, silver: 2_000, gold: 500 };
  // sum = 9500 ≠ 10000
  const errs = validateCanonicalChestRates(bad);
  check('chest validation: catches wrong sum (9 500)', errs.length > 0, errs.join('; '));
}
{
  const belowFloor = { bronze: 3_000, silver: 6_000, gold: 1_000 };
  const errs = validateCanonicalChestRates(belowFloor);
  check('chest validation: catches bronze below 40% floor', errs.length > 0, errs.join('; '));
}
{
  const aboveCap = { bronze: 5_000, silver: 2_500, gold: 2_500 };
  const errs = validateCanonicalChestRates(aboveCap);
  check('chest validation: catches gold above 15% ceiling', errs.length > 0, errs.join('; '));
}

// ── Results ────────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${_errors === 0 ? 'ALL PASSED' : `${_errors} FAILED`} ──`);
if (_errors > 0) process.exit(1);
