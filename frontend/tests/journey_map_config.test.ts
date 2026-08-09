/**
 * journey_map_config.test.ts
 *
 * Unit tests for journeyMap/config.ts and journeyMap/validate.ts.
 *
 * Run: npx sucrase-node tests/journey_map_config.test.ts
 *
 * Covers:
 *  - getChapterTileCount at every chapter boundary and band edge
 *  - getEncounterRatesBp totals, individual rates, no negatives
 *  - getTreasureCap / getMerchantCap at every 10-chapter boundary
 *  - getAreaBossCap constant
 *  - getChestTierRatesBp totals, bronze min, gold max, specific checkpoints
 *  - validateEncounterRates and validateChestQualityRates guard bad values
 *  - Spot-checks at Ch 1, 2, 5, 10, 20, 25, 35, 40, 50, 100
 *  - Expected examples from design spec table verified exactly
 */

import {
  TOTAL_BP,
  getChapterTileCount,
  getEncounterRatesBp,
  getTreasureCap,
  getMerchantCap,
  getAreaBossCap,
  getChestTierRatesBp,
} from '../src/game/journeyMap/config';

import {
  validateEncounterRates,
  validateChestQualityRates,
} from '../src/game/journeyMap/validate';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, details = ''): void {
  if (cond) {
    console.log(`PASS - ${name}`);
    passed++;
  } else {
    console.error(`FAIL - ${name}${details ? ` :: ${details}` : ''}`);
    failed++;
  }
}

function eq(a: number, b: number, label: string): void {
  check(label, a === b, `got ${a}, expected ${b}`);
}

// ── 1. getChapterTileCount ────────────────────────────────────────────────────

console.log('\n── getChapterTileCount ──');

eq(getChapterTileCount(1),   30, 'ch 1  → 30');
eq(getChapterTileCount(3),   30, 'ch 3  → 30');
eq(getChapterTileCount(5),   30, 'ch 5  → 30');
eq(getChapterTileCount(6),   35, 'ch 6  → 35');
eq(getChapterTileCount(10),  35, 'ch 10 → 35');
eq(getChapterTileCount(11),  40, 'ch 11 → 40');
eq(getChapterTileCount(20),  40, 'ch 20 → 40');
eq(getChapterTileCount(21),  45, 'ch 21 → 45');
eq(getChapterTileCount(30),  45, 'ch 30 → 45');
eq(getChapterTileCount(31),  50, 'ch 31 → 50');
eq(getChapterTileCount(40),  50, 'ch 40 → 50');
eq(getChapterTileCount(41),  55, 'ch 41 → 55');
eq(getChapterTileCount(50),  55, 'ch 50 → 55');
eq(getChapterTileCount(51),  60, 'ch 51 → 60');
eq(getChapterTileCount(60),  60, 'ch 60 → 60');
eq(getChapterTileCount(100), 80, 'ch 100 → 80');

// +5 per band boundary (ch 11, 21, 31 … 91)
for (let base = 11; base <= 91; base += 10) {
  const atBand  = getChapterTileCount(base);
  const preBand = getChapterTileCount(base - 1);
  check(
    `ch${base} is 5 more than ch${base - 1}`,
    atBand === preBand + 5,
    `ch${base - 1}=${preBand}, ch${base}=${atBand}`,
  );
}

// ── 2. getEncounterRatesBp — totals and no negatives ─────────────────────────

console.log('\n── getEncounterRatesBp totals ──');

const SPOT_CHAPTERS = [1, 2, 4, 5, 9, 10, 11, 15, 20, 25, 30, 35, 40, 50, 100];

for (const ch of SPOT_CHAPTERS) {
  const r   = getEncounterRatesBp(ch);
  const vals = Object.values(r);
  const sum  = vals.reduce((a, b) => a + b, 0);
  check(`ch${ch}: encounter rates sum to ${TOTAL_BP}`, sum === TOTAL_BP, `sum=${sum}`);
  check(`ch${ch}: no negative encounter rate`, vals.every((v) => v >= 0), JSON.stringify(r));
}

// validateEncounterRates returns no errors for all spot chapters
for (const ch of SPOT_CHAPTERS) {
  const errs = validateEncounterRates(getEncounterRatesBp(ch), ch);
  check(`validateEncounterRates ch${ch}: no errors`, errs.length === 0, errs.join('; '));
}

// ── 3. Design-spec table (exact values from screenshot) ───────────────────────

console.log('\n── design-spec table ──');

function pct(bp: number) { return bp / 100; }

{
  // Ch1–3: areaBoss = 0% (area bosses start at Ch4).  The 10% that used to be
  // allocated to areaBoss now goes into none.
  const r = getEncounterRatesBp(1);
  check('ch1 none=65%',     pct(r.none)     === 65, `${pct(r.none)}%`);
  check('ch1 battle=30%',   pct(r.battle)   === 30, `${pct(r.battle)}%`);
  check('ch1 areaBoss=0%',  pct(r.areaBoss) ===  0, `${pct(r.areaBoss)}%`);
  check('ch1 treasure=5%',  pct(r.treasure) ===  5, `${pct(r.treasure)}%`);
  check('ch1 merchant=0%',  pct(r.merchant) ===  0, `${pct(r.merchant)}%`);
}
{
  // Ch4–10: areaBoss = 3%.
  const r = getEncounterRatesBp(5);
  check('ch5 none=60%',     pct(r.none)     === 60, `${pct(r.none)}%`);
  check('ch5 treasure=6%',  pct(r.treasure) ===  6, `${pct(r.treasure)}%`);
  check('ch5 merchant=1%',  pct(r.merchant) ===  1, `${pct(r.merchant)}%`);
}
{
  const r = getEncounterRatesBp(10);
  check('ch10 none=58%',    pct(r.none)     === 58, `${pct(r.none)}%`);
  check('ch10 treasure=7%', pct(r.treasure) ===  7, `${pct(r.treasure)}%`);
  check('ch10 merchant=2%', pct(r.merchant) ===  2, `${pct(r.merchant)}%`);
}
{
  // Ch11–20: areaBoss = 4%.
  const r = getEncounterRatesBp(20);
  check('ch20 none=53%',    pct(r.none)     === 53, `${pct(r.none)}%`);
  check('ch20 treasure=9%', pct(r.treasure) ===  9, `${pct(r.treasure)}%`);
  check('ch20 merchant=4%', pct(r.merchant) ===  4, `${pct(r.merchant)}%`);
}
{
  // Ch21+: areaBoss = 5%.
  const r = getEncounterRatesBp(25);
  check('ch25 none=50%',     pct(r.none)     === 50, `${pct(r.none)}%`);
  check('ch25 treasure=10%', pct(r.treasure) === 10, `${pct(r.treasure)}%`);
  check('ch25 merchant=5%',  pct(r.merchant) ===  5, `${pct(r.merchant)}%`);
}
{
  // ch 35+ means any chapter ≥ 35 where both caps are hit.
  for (const ch of [35, 40, 50, 100]) {
    const r = getEncounterRatesBp(ch);
    check(`ch${ch} none=48%`,     pct(r.none)     === 48, `${pct(r.none)}%`);
    check(`ch${ch} treasure=12%`, pct(r.treasure) === 12, `${pct(r.treasure)}%`);
    check(`ch${ch} merchant=5%`,  pct(r.merchant) ===  5, `${pct(r.merchant)}%`);
  }
}

// ── 4. getAreaBossCap ────────────────────────────────────────────────────────

console.log('\n── getAreaBossCap ──');

eq(getAreaBossCap(), 3, 'getAreaBossCap() = 3');

// ── 5. getTreasureCap ────────────────────────────────────────────────────────

console.log('\n── getTreasureCap ──');

eq(getTreasureCap(1),  3, 'ch1  → 3');
eq(getTreasureCap(10), 3, 'ch10 → 3');
eq(getTreasureCap(11), 4, 'ch11 → 4');
eq(getTreasureCap(20), 4, 'ch20 → 4');
eq(getTreasureCap(21), 5, 'ch21 → 5');
eq(getTreasureCap(30), 5, 'ch30 → 5');
eq(getTreasureCap(31), 6, 'ch31 → 6');
eq(getTreasureCap(40), 6, 'ch40 → 6');
eq(getTreasureCap(50), 7, 'ch50 → 7');

for (let base = 11; base <= 91; base += 10) {
  check(
    `getTreasureCap ch${base} is 1 more than ch${base - 1}`,
    getTreasureCap(base) === getTreasureCap(base - 1) + 1,
    `ch${base - 1}=${getTreasureCap(base - 1)}, ch${base}=${getTreasureCap(base)}`,
  );
}

// ── 6. getMerchantCap ────────────────────────────────────────────────────────

console.log('\n── getMerchantCap ──');

eq(getMerchantCap(1),  0, 'ch1  → 0  (rate is 0%)');
eq(getMerchantCap(4),  0, 'ch4  → 0  (rate is 0%)');
eq(getMerchantCap(5),  1, 'ch5  → 1');
eq(getMerchantCap(10), 1, 'ch10 → 1');
eq(getMerchantCap(11), 2, 'ch11 → 2');
eq(getMerchantCap(20), 2, 'ch20 → 2');
eq(getMerchantCap(21), 3, 'ch21 → 3');
eq(getMerchantCap(30), 3, 'ch30 → 3');
eq(getMerchantCap(40), 4, 'ch40 → 4');
eq(getMerchantCap(50), 5, 'ch50 → 5');

for (let base = 11; base <= 91; base += 10) {
  check(
    `getMerchantCap ch${base} is 1 more than ch${base - 1}`,
    getMerchantCap(base) === getMerchantCap(base - 1) + 1,
    `ch${base - 1}=${getMerchantCap(base - 1)}, ch${base}=${getMerchantCap(base)}`,
  );
}

// ── 7. getChestTierRatesBp ───────────────────────────────────────────────────

console.log('\n── getChestTierRatesBp ──');

const CHEST_CHAPTERS = [...SPOT_CHAPTERS, 40, 50, 80, 81, 100, 150, 200];

for (const ch of CHEST_CHAPTERS) {
  const { bronze, silver, gold } = getChestTierRatesBp(ch);
  const sum = bronze + silver + gold;
  check(`ch${ch}: chest rates sum to ${TOTAL_BP}`, sum === TOTAL_BP,   `sum=${sum}`);
  check(`ch${ch}: bronze >= 4000`,                 bronze >= 4_000,    `bronze=${bronze}`);
  check(`ch${ch}: gold <= 1500`,                   gold   <= 1_500,    `gold=${gold}`);
  check(`ch${ch}: silver >= 0`,                    silver >= 0,        `silver=${silver}`);
}

// validateChestQualityRates returns no errors for all spot chapters
for (const ch of SPOT_CHAPTERS) {
  const errs = validateChestQualityRates(getChestTierRatesBp(ch), ch);
  check(`validateChestQualityRates ch${ch}: no errors`, errs.length === 0, errs.join('; '));
}

// Exact spec checkpoints
{ const q = getChestTierRatesBp(1);  eq(q.bronze, 8000, 'ch1 bronze=8000'); eq(q.silver, 2000, 'ch1 silver=2000'); eq(q.gold, 0, 'ch1 gold=0'); }
{ const q = getChestTierRatesBp(2);  eq(q.bronze, 7950, 'ch2 bronze=7950'); eq(q.silver, 2050, 'ch2 silver=2050'); eq(q.gold, 0, 'ch2 gold=0'); }
{ const q = getChestTierRatesBp(5);  eq(q.bronze, 7800, 'ch5 bronze=7800'); eq(q.silver, 2200, 'ch5 silver=2200'); eq(q.gold, 0, 'ch5 gold=0'); }
// Authoritative Ch 10 reference (0.5pp-per-chapter rule, not the rounded 75/24/1)
{ const q = getChestTierRatesBp(10); eq(q.bronze, 7550, 'ch10 bronze=7550 (75.5%) — spec ref'); eq(q.silver, 2350, 'ch10 silver=2350 (23.5%) — spec ref'); eq(q.gold, 100, 'ch10 gold=100 (1%) — spec ref'); }
{ const q = getChestTierRatesBp(20); eq(q.bronze, 7050, 'ch20 bronze=7050'); eq(q.silver, 2750, 'ch20 silver=2750'); eq(q.gold, 200, 'ch20 gold=200'); }
{ const q = getChestTierRatesBp(40); eq(q.bronze, 6050, 'ch40 bronze=6050'); eq(q.silver, 3550, 'ch40 silver=3550'); eq(q.gold, 400, 'ch40 gold=400'); }
{ const q = getChestTierRatesBp(50); eq(q.bronze, 5550, 'ch50 bronze=5550'); eq(q.silver, 3950, 'ch50 silver=3950'); eq(q.gold, 500, 'ch50 gold=500'); }
// Bronze floor at ch 81 (8000 - 80*50 = 4000)
{ const q = getChestTierRatesBp(81); eq(q.bronze, 4000, 'ch81 bronze=4000 (floor)'); }
{ const q = getChestTierRatesBp(100); eq(q.bronze, 4000, 'ch100 bronze=4000 (clamped)'); eq(q.gold, 1000, 'ch100 gold=1000'); eq(q.silver, 5000, 'ch100 silver=5000'); }

// ── 8. Validate guards catch bad values ──────────────────────────────────────

console.log('\n── validator guards ──');

{
  const errs = validateEncounterRates({ none: 4000, battle: 3000, areaBoss: 1000, treasure: 500, merchant: 0 }, 99);
  check('validateEncounterRates: catches wrong sum (4000≠5500)', errs.length > 0, errs.join('; '));
}
{
  const errs = validateEncounterRates({ none: -1, battle: 3000, areaBoss: 1000, treasure: 500, merchant: 0 }, 99);
  check('validateEncounterRates: catches negative rate', errs.length > 0, errs.join('; '));
}
{
  const errs = validateChestQualityRates({ bronze: 7000, silver: 2000, gold: 500 }, 99);
  check('validateChestQualityRates: catches wrong sum (9500≠10000)', errs.length > 0, errs.join('; '));
}
{
  const errs = validateChestQualityRates({ bronze: 3000, silver: 5500, gold: 1500 }, 99);
  check('validateChestQualityRates: catches bronze below 4000', errs.length > 0, errs.join('; '));
}
{
  const errs = validateChestQualityRates({ bronze: 5000, silver: 3400, gold: 1600 }, 99);
  check('validateChestQualityRates: catches gold above 1500', errs.length > 0, errs.join('; '));
}

// ── 9. Error-throwing guards in config ───────────────────────────────────────

console.log('\n── config throws on impossible state ──');

{
  // getEncounterRatesBp never throws for any reasonable chapter because none
  // stays positive — verify the guard path would fire for a manufactured case.
  // We test this indirectly via the validator; the throw path is a safety net.
  let ok = true;
  try { getEncounterRatesBp(1); } catch { ok = false; }
  check('getEncounterRatesBp(1) does not throw', ok);
}
{
  let ok = true;
  try { getChestTierRatesBp(1); } catch { ok = false; }
  check('getChestTierRatesBp(1) does not throw', ok);
}

// ── Result ────────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
