import {
  AGE1_REPEAT_FULL_BUDGET,
  age1StaminaBonusDay,
  age1WeeklyStaminaBonus,
  consumeAge1RepeatBudget,
} from '../src/game/age1Economy';
import {
  AREA_BOSS_ENCOUNTER_COST,
  BOSS_ENCOUNTER_COST,
  ELITE_ENCOUNTER_COST,
  ENCOUNTER_COST,
  REGEN_MINUTES,
  getJourneyStaminaCost,
  getWardShiftStaminaCost,
  regen,
} from '../src/game/stamina';
import { staminaMaxForLevel } from '../src/game/progression';
import { readFileSync } from 'node:fs';

let failures = 0;
function check(label: string, result: boolean) {
  if (result) console.log(`PASS - ${label}`);
  else { console.error(`FAIL - ${label}`); failures++; }
}

const jan1 = new Date('2026-01-01T12:00:00.000Z');
const jan2 = new Date('2026-01-02T12:00:00.000Z');
const jan8 = new Date('2026-01-08T12:00:00.000Z');

check('Level 1 stamina cap is 20', staminaMaxForLevel(1) === 20);
check('Level 5 stamina cap is 22', staminaMaxForLevel(5) === 22);
check('Level 7 stamina cap is 24', staminaMaxForLevel(7) === 24);
check('Levels 9 and 10 stamina cap at 26', staminaMaxForLevel(9) === 26 && staminaMaxForLevel(10) === 26);
check('Level 20 stamina cap is 30', staminaMaxForLevel(20) === 30);
check('Stamina regenerates once per 15 minutes', REGEN_MINUTES === 15
  && regen(10, '2026-01-01T12:00:00.000Z', Date.parse('2026-01-01T12:15:00.000Z'), 20).stamina === 11);

check('Meaningful action cost ladder is consistent',
  ENCOUNTER_COST === 1
  && ELITE_ENCOUNTER_COST === 2
  && AREA_BOSS_ENCOUNTER_COST === 3
  && BOSS_ENCOUNTER_COST === 5
  && getWardShiftStaminaCost(1) === 1
  && getWardShiftStaminaCost(3) === 2
  && getJourneyStaminaCost('none') === 0
  && getJourneyStaminaCost('merchant') === 0
  && getJourneyStaminaCost('battle', 3) === 2
  && getJourneyStaminaCost('areaBoss') === 3);

let repeat = { age1_reward_day: '2026-01-01', age1_reward_units: 0 };
for (let i = 0; i < AGE1_REPEAT_FULL_BUDGET; i++) {
  const outcome = consumeAge1RepeatBudget(repeat, 1, jan1);
  repeat = outcome.state;
  check(`Repeat reward ${i + 1} retains full value`, outcome.multiplier === 1);
}
const reduced = consumeAge1RepeatBudget(repeat, 1, jan1);
check('Repeat rewards taper after full budget', reduced.multiplier === 0.45);
const exhausted = consumeAge1RepeatBudget(
  { age1_reward_day: '2026-01-01', age1_reward_units: 24 },
  1,
  jan1,
);
check('Repeatable University rewards have no value after the shared daily budget',
  exhausted.multiplier === 0);
const boundaryBoss = consumeAge1RepeatBudget(
  { age1_reward_day: '2026-01-01', age1_reward_units: 10 },
  5,
  jan1,
);
check('Multi-unit rewards prorate across taper boundaries',
  Math.abs(boundaryBoss.multiplier - ((2 + 3 * 0.45) / 5)) < 0.000001);
const nextDay = consumeAge1RepeatBudget(reduced.state, 1, jan2);
check('Daily repeat budget resets on a new day', nextDay.multiplier === 1 && nextDay.state.age1_reward_units === 1);

const firstCue = age1StaminaBonusDay({}, 'practice:cue_lab', 1, jan1);
const replayCue = age1StaminaBonusDay(firstCue, 'practice:cue_lab', 1, jan1);
const nextCueDay = age1StaminaBonusDay(replayCue, 'practice:cue_lab', 1, jan2);
check('Educational stamina bonus is once per source per day',
  firstCue.staminaBonus === 1 && replayCue.staminaBonus === 0 && nextCueDay.staminaBonus === 1);

const firstWeek = age1WeeklyStaminaBonus({}, 3, jan1);
const sameWeek = age1WeeklyStaminaBonus(firstWeek, 3, new Date('2026-01-03T12:00:00.000Z'));
const nextWeek = age1WeeklyStaminaBonus(sameWeek, 3, jan8);
check('Weekly stamina bonus is idempotent within its reset week',
  firstWeek.staminaBonus === 3 && sameWeek.staminaBonus === 0 && nextWeek.staminaBonus === 3);

const legacyPracticeRoutes = [
  'app/university/cue-hunt.tsx',
  'app/university/rapid-triage.tsx',
  'app/university/stabilize-stack.tsx',
];
check('All reachable legacy University labs use the shared repeat-reward guard',
  legacyPracticeRoutes.every((route) => readFileSync(route, 'utf8').includes('grantLegacyUniPracticeReward')));

if (failures > 0) process.exit(1);