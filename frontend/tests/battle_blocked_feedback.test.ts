// battle_blocked_feedback.test.ts
// Verifies that every "blocked" action path in the battle engine returns an
// abort message (the value that showBlockMsg will surface to the player on web).
// Run: npx sucrase-node tests/battle_blocked_feedback.test.ts

import { CALL_OPTIONS, ITEMS, TEMP_ACTIONS } from '../src/game/items';
import { applyCall, applySkill, applyUltimate, applyCard, useItem, applyTempAction, initBattle } from '../src/game/battle';
import { ENEMIES, HEROES } from '../src/game/content';

type Result = { name: string; pass: boolean; details?: string };
const results: Result[] = [];
function check(name: string, cond: boolean, details = '') {
  results.push({ name, pass: !!cond, details });
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${cond ? '' : ` :: ${details}`}`);
}

const enemy = ENEMIES.find(e => e.id === 'air_sprite')!;
const team  = HEROES.slice(0, 3);
const base  = () => initBattle(enemy, team, { chapter: 1, inventory: { 'Lab Token': 2 } });

// ── 1. Skill: insufficient AP ─────────────────────────────────────────────
{
  const s = { ...base(), ap: 0 };
  const hero  = s.team[0]!;
  const skill = hero.skills.find(sk => sk.cost > 0)!;
  const r = applySkill(s, skill, hero);
  check('SKILL-AP: aborted=true when AP<cost', r.aborted === true, `aborted=${r.aborted}`);
  check('SKILL-AP: message is non-empty', typeof r.message === 'string' && r.message.length > 0, `msg="${r.message}"`);
  check('SKILL-AP: state unchanged (stability same)', r.state.stability === s.stability);
}

// ── 2. Skill: hero already acted ──────────────────────────────────────────
{
  let s = base();
  const hero  = s.team[0]!;
  const skill = hero.skills[0]!;
  s = { ...s, heroActionsUsed: { ...s.heroActionsUsed, [hero.id]: true } };
  const r = applySkill(s, skill, hero);
  check('SKILL-ACTED: aborted=true', r.aborted === true);
  check('SKILL-ACTED: message mentions hero or acted', r.message.toLowerCase().includes('already') || r.message.toLowerCase().includes('acted'), `msg="${r.message}"`);
}

// ── 3. Ultimate: not ready ────────────────────────────────────────────────
{
  const s = { ...base(), ultimateCharges: {} };
  const hero = s.team[0]!;
  const r = applyUltimate(s, hero.id);
  check('ULT-NOT-READY: aborted=true', r.aborted === true);
  check('ULT-NOT-READY: message is non-empty', r.message.length > 0, `msg="${r.message}"`);
}

// ── 4. Item: out of stock ─────────────────────────────────────────────────
{
  const s = { ...base(), inventory: {} };
  const item = ITEMS[0]!;
  const r = useItem(s, item);
  check('ITEM-STOCK: aborted=true when qty=0', r.aborted === true, `aborted=${r.aborted}`);
  check('ITEM-STOCK: message is non-empty', r.message.length > 0, `msg="${r.message}"`);
}

// ── 5. Item: insufficient AP ──────────────────────────────────────────────
{
  const item = ITEMS.find(it => it.costAP > 0)!;
  const s = { ...base(), ap: 0, inventory: { [item.name]: 3 } };
  const r = useItem(s, item);
  check('ITEM-AP: aborted=true', r.aborted === true);
  check('ITEM-AP: message mentions AP', r.message.toLowerCase().includes('ap') || r.message.toLowerCase().includes('action'), `msg="${r.message}"`);
}

// ── 6. Call: already used ────────────────────────────────────────────────
{
  const phar = CALL_OPTIONS.find(o => o.id === 'call_pharmacy')!;
  const s = { ...base(), callsUsed: { pharmacy: true, respiratory: false, rapidResponse: false, infectionControl: false } };
  const r = applyCall(s, phar);
  check('CALL-USED: aborted=true', r.aborted === true, `aborted=${r.aborted}`);
  check('CALL-USED: message is non-empty', r.message.length > 0, `msg="${r.message}"`);
}

// ── 7. Call: Rapid Response gated (stability > 30) ──────────────────────
{
  const rap = CALL_OPTIONS.find(o => o.id === 'call_rapid')!;
  const s = { ...base(), stability: 80 };
  const r = applyCall(s, rap);
  check('RAPID-GATE: aborted=true', r.aborted === true, `aborted=${r.aborted}`);
  check('RAPID-GATE: message mentions stability or crashing', r.message.toLowerCase().includes('stability') || r.message.toLowerCase().includes('crash') || r.message.toLowerCase().includes('reserv'), `msg="${r.message}"`);
}

// ── 8. Call: insufficient AP ─────────────────────────────────────────────
{
  const phar = CALL_OPTIONS.find(o => o.id === 'call_pharmacy')!;
  const s = { ...base(), ap: 0 };
  const r = applyCall(s, phar);
  check('CALL-AP: aborted=true', r.aborted === true);
  check('CALL-AP: message is non-empty', r.message.length > 0, `msg="${r.message}"`);
}

// ── 9. TempAction: insufficient AP ───────────────────────────────────────
{
  const tempId = Object.keys(TEMP_ACTIONS)[0];
  if (tempId) {
    const a = TEMP_ACTIONS[tempId]!;
    const s = { ...base(), ap: 0, temporaryActionIds: [tempId] };
    const r = applyTempAction(s, tempId);
    check('TEMP-AP: aborted=true when AP=0', r.aborted === true, `aborted=${r.aborted}`);
    check('TEMP-AP: message is non-empty', r.message.length > 0, `msg="${r.message}"`);
  } else {
    check('TEMP-AP: (no temp actions registered, skip)', true);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('FAILURES:');
  failed.forEach(f => console.log(`  ✗ ${f.name}: ${f.details}`));
  process.exit(1);
}
