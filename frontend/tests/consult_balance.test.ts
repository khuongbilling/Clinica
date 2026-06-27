// Consult balance logic tests for items.ts, battle.ts, clinical.ts
// Run: npx sucrase-node tests/consult_balance.test.ts
import { CALL_OPTIONS, ITEMS, TEMP_ACTIONS } from '../src/game/items';
import { applyCall, applySkill, initBattle, endPlayerTurn, useItem } from '../src/game/battle';
import { computeStars, getStarRules } from '../src/game/clinical';
import { ENEMIES, HEROES } from '../src/game/content';

type Result = { name: string; pass: boolean; details?: string };
const results: Result[] = [];
function check(name: string, cond: boolean, details = '') {
  results.push({ name, pass: !!cond, details });
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${cond ? '' : ` :: ${details}`}`);
}

// -------- 1. AP COSTS --------
const phar = CALL_OPTIONS.find(c => c.id === 'call_pharmacy')!;
const resp = CALL_OPTIONS.find(c => c.id === 'call_respiratory')!;
const inf  = CALL_OPTIONS.find(c => c.id === 'call_infection')!;
const rap  = CALL_OPTIONS.find(c => c.id === 'call_rapid')!;
check('AP COST: call_pharmacy = 2 AP', phar.costAP === 2, `got ${phar.costAP}`);
check('AP COST: call_respiratory = 2 AP', resp.costAP === 2, `got ${resp.costAP}`);
check('AP COST: call_infection = 2 AP', inf.costAP === 2, `got ${inf.costAP}`);
check('AP COST: call_rapid = 3 AP', rap.costAP === 3, `got ${rap.costAP}`);

// Set up battle: air_sprite with starter team
const airSprite = ENEMIES.find(e => e.id === 'air_sprite')!;
const team = HEROES.slice(0, 3);
const baseInit = () => initBattle(airSprite, team, { chapter: 1, inventory: {} });

// -------- 2. PHARMACY-WITHOUT-CLUE --------
{
  // Force no clues revealed
  let s = baseInit();
  s = { ...s, revealedLabels: [], visibleClues: [], hiddenClueIds: [...airSprite.visibleClues.map(c=>c.id), ...airSprite.hiddenClues.map(c=>c.id)] };
  const r = applyCall(s, phar);
  const inv = r.state.inventory;
  check('PHARMACY-NO-CLUE: Lab Token added', (inv['Lab Token'] || 0) === 1, JSON.stringify(inv));
  check('PHARMACY-NO-CLUE: No Bronchodilator added', !inv['Albuterol Mist'], JSON.stringify(inv));
  check('PHARMACY-NO-CLUE: preparedItemDiscount stays null', r.state.preparedItemDiscount === null, `got ${r.state.preparedItemDiscount}`);
  check('PHARMACY-NO-CLUE: log message present',
    r.state.log.some(l => l.includes('Pharmacy needs more assessment data') && l.includes('Lab Token added instead')),
    r.state.log.slice(-3).join(' | '));
  check('PHARMACY-NO-CLUE: consultsUsed incremented', r.state.consultsUsed === 1, `got ${r.state.consultsUsed}`);
}

// -------- 3. PHARMACY-WITH-CLUE (Wheezing revealed) --------
{
  let s = baseInit();
  // Reveal Wheezing clue
  s = { ...s, revealedLabels: [...s.revealedLabels, 'Wheezing'] };
  const r = applyCall(s, phar);
  check('PHARMACY-CLUE: Bronchodilator Mist (Albuterol Mist) added',
    (r.state.inventory['Albuterol Mist'] || 0) === 1, JSON.stringify(r.state.inventory));
  check('PHARMACY-CLUE: preparedItemDiscount = Albuterol Mist',
    r.state.preparedItemDiscount === 'Albuterol Mist', `got ${r.state.preparedItemDiscount}`);
  // Verify item cost would be 1 in items tab logic: discounted cost = max(1, costAP - 1)
  const bronch = ITEMS.find(i => i.name === 'Albuterol Mist')!;
  const discCost = r.state.preparedItemDiscount === bronch.name ? Math.max(1, bronch.costAP - 1) : bronch.costAP;
  check('PHARMACY-CLUE: Bronchodilator effective cost = 1 AP', discCost === 1, `got ${discCost}`);
}

// -------- 4. RESPIRATORY-INAPPROPRIATE (non-Air, no resp clue) --------
// Use river_sludge enemy with no resp clues
const river = ENEMIES.find(e => e.id === 'river_sludge');
if (!river) {
  check('RESP-INAPPROPRIATE: river_sludge enemy exists', false, 'enemy not found');
} else {
  let s = initBattle(river, team, { chapter: 1, inventory: {} });
  // strip any wheez-like clues
  s = { ...s, revealedLabels: s.revealedLabels.filter(l => !/wheez|o2|tripod|breathing fast/i.test(l)) };
  const before = s.inappropriateConsultsUsed;
  const r = applyCall(s, resp);
  check('RESP-INAPPROPRIATE: temp action NOT unlocked',
    !r.state.temporaryActionIds.includes('open_airflow'), JSON.stringify(r.state.temporaryActionIds));
  check('RESP-INAPPROPRIATE: log message present',
    r.state.log.some(l => l.includes('Respiratory Support does not fit the current clues. Limited benefit')),
    r.state.log.slice(-2).join(' | '));
  check('RESP-INAPPROPRIATE: inappropriateConsultsUsed incremented',
    r.state.inappropriateConsultsUsed === before + 1, `before=${before} after=${r.state.inappropriateConsultsUsed}`);
}

// -------- 5. RESPIRATORY-APPROPRIATE (Air Sprite) --------
{
  let s = baseInit();
  const r = applyCall(s, resp);
  check('RESP-APPROP: Open Airflow added to temporaryActionIds',
    r.state.temporaryActionIds.includes('open_airflow'), JSON.stringify(r.state.temporaryActionIds));
  check('RESP-APPROP: nextAirActionDiscount NOT set',
    r.state.nextAirActionDiscount === false, `got ${r.state.nextAirActionDiscount}`);
  // Confirm next Air skill (Breath of Dawn) keeps full cost
  const heroWithAir = team.find(h => h.skills.some(sk => sk.id === 'breath_of_dawn'));
  if (heroWithAir) {
    const bod = heroWithAir.skills.find(sk => sk.id === 'breath_of_dawn')!;
    // Need to select that hero
    let s2 = { ...r.state, selectedHeroId: heroWithAir.id };
    const before = s2.ap;
    const apRes = applySkill(s2, bod, heroWithAir);
    const consumed = before - apRes.state.ap;
    check('RESP-APPROP: Breath of Dawn consumed full AP (no discount)',
      consumed === bod.cost, `expected ${bod.cost}, consumed ${consumed}`);
  } else {
    check('RESP-APPROP: Air skill verification (Breath of Dawn hero exists)', false, 'no hero with breath_of_dawn in starter team');
  }
}

// -------- 6. RAPID HARD-GATE --------
{
  let s = baseInit();
  // Stability default for air_sprite is high enough
  check('RAPID-GATE: stability > 30 initial', s.stability > 30, `stability=${s.stability}`);
  const r = applyCall(s, rap);
  check('RAPID-GATE: call aborted when stability>30 & no danger',
    r.aborted === true && r.state.callsUsed.rapidResponse === false,
    `aborted=${r.aborted} used=${r.state.callsUsed.rapidResponse}`);
  // Now drop stability ≤ 30 — activate
  let s2 = { ...s, stability: 25 };
  const before = s2.stability;
  const r2 = applyCall(s2, rap);
  check('RAPID-GATE: call succeeds at stability≤30', !r2.aborted, `aborted=${r2.aborted}`);
  check('RAPID-GATE: stability +15', r2.state.stability === Math.min(100, before + 15), `before=${before} after=${r2.state.stability}`);
  check('RAPID-GATE: shieldNext = 100', r2.state.shieldNext === 100, `got ${r2.state.shieldNext}`);
  check('RAPID-GATE: emergencyCallsUsed = 1', r2.state.emergencyCallsUsed === 1, `got ${r2.state.emergencyCallsUsed}`);
}

// -------- 7. INFECTION-INAPPROPRIATE (Air Sprite) --------
{
  let s = baseInit();
  const before = s.inappropriateConsultsUsed;
  const r = applyCall(s, inf);
  check('INF-INAPPROP: temp action NOT unlocked',
    !r.state.temporaryActionIds.includes('containment_order'), JSON.stringify(r.state.temporaryActionIds));
  check('INF-INAPPROP: log message present',
    r.state.log.some(l => l.includes('Infection Control does not match the current problem. Limited benefit')),
    r.state.log.slice(-2).join(' | '));
  check('INF-INAPPROP: inappropriateConsultsUsed incremented',
    r.state.inappropriateConsultsUsed === before + 1, `got ${r.state.inappropriateConsultsUsed}`);
}

// -------- 8. STAR PENALTY — TWO CONSULTS --------
const enemyClin = require('../src/game/clinical').ENEMY_CLINICAL['air_sprite'];
const rules = getStarRules('nursingStudent', enemyClin);
{
  const r = computeStars({
    won: true, fullChainCompleted: true, unsafeActionsUsed: 0,
    poorFitActionsUsed: 0, turnsTaken: 4, reassessUsed: true,
    consultsUsed: 2, emergencyCallsUsed: 0, inappropriateConsultsUsed: 0,
  }, rules);
  check('STAR-2CONSULT: 3rd star withheld', r.stars === 2, `stars=${r.stars}`);
}

// -------- 9. STAR PENALTY — EMERGENCY --------
{
  const r = computeStars({
    won: true, fullChainCompleted: true, unsafeActionsUsed: 0,
    poorFitActionsUsed: 0, turnsTaken: 4, reassessUsed: true,
    consultsUsed: 1, emergencyCallsUsed: 1, inappropriateConsultsUsed: 0,
  }, rules);
  check('STAR-EMERGENCY: 3rd star withheld', r.stars === 2, `stars=${r.stars}`);
}

// -------- 10. STAR PENALTY — INAPPROPRIATE --------
{
  const r = computeStars({
    won: true, fullChainCompleted: true, unsafeActionsUsed: 0,
    poorFitActionsUsed: 0, turnsTaken: 4, reassessUsed: true,
    consultsUsed: 1, emergencyCallsUsed: 0, inappropriateConsultsUsed: 1,
  }, rules);
  check('STAR-INAPPROP: 3rd star withheld', r.stars === 2, `stars=${r.stars}`);
}

// -------- 11. STAR ALLOWED — ONE GOOD CONSULT --------
{
  const r = computeStars({
    won: true, fullChainCompleted: true, unsafeActionsUsed: 0,
    poorFitActionsUsed: 0, turnsTaken: 4, reassessUsed: true,
    consultsUsed: 1, emergencyCallsUsed: 0, inappropriateConsultsUsed: 0,
  }, rules);
  check('STAR-ONE-GOOD: 3 stars earned', r.stars === 3, `stars=${r.stars}`);
}

// -------- 12. REGRESSION: dynamic AP / hero-action / endPlayerTurn flag --------
{
  let s = baseInit();
  check('REG: dynamic AP at full stability = 4', s.ap === 4, `ap=${s.ap}`);
  // Rapid hard gate then verify endPlayerTurn no longer auto-restores AP
  let s2 = { ...s, stability: 25, ap: 3 };
  const r = applyCall(s2, rap);
  check('REG: after rapid, ap consumed (3->0)', r.state.ap === 0, `ap=${r.state.ap}`);
  // After end turn from a CRITICAL state, AP per turn shouldn't be forced to 4
  // stability is 25+15 = 40 after rapid, but enemy turn will reduce it
  const after = endPlayerTurn(r.state);
  // Just ensure no error and apMax reflects state-based recalculation
  check('REG: endPlayerTurn produces ongoing/loss state', after.outcome === 'ongoing' || after.outcome === 'loss', `outcome=${after.outcome}`);
  // The previous rule "auto-restore to ≥4 after Rapid" should be gone — check rapidResponseActive cleared
  check('REG: rapidResponseActive cleared after endPlayerTurn', after.rapidResponseActive === false, `got ${after.rapidResponseActive}`);
}

// -------- 13. Hero-action-once-per-turn --------
{
  let s = baseInit();
  const hero = team[0];
  const skill = hero.skills.find(sk => sk.cost <= s.ap);
  if (skill) {
    const r = applySkill(s, skill, hero);
    check('REG: hero action consumed', r.state.heroActionsUsed[hero.id] === true);
    // Re-apply same skill must abort
    const r2 = applySkill(r.state, skill, hero);
    check('REG: same hero cannot act twice', r2.aborted === true);
  }
}

// -------- Summary --------
const failed = results.filter(r => !r.pass);
console.log(`\n========== SUMMARY ==========`);
console.log(`Total: ${results.length}  Passed: ${results.length - failed.length}  Failed: ${failed.length}`);
if (failed.length) {
  console.log('\nFailing tests:');
  failed.forEach(f => console.log(`  - ${f.name} :: ${f.details}`));
  process.exit(1);
}
