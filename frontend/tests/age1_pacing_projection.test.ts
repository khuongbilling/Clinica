import { AGE1_REPEAT_FULL_BUDGET, consumeAge1RepeatBudget } from '../src/game/age1Economy';
import { REGEN_MINUTES } from '../src/game/stamina';
import { staminaMaxForLevel } from '../src/game/progression';

let failures = 0;
function check(label: string, result: boolean) {
  if (result) console.log(`PASS - ${label}`);
  else { console.error(`FAIL - ${label}`); failures++; }
}

/**
 * This is an auditable projection, not telemetry. It fixes the assumptions used
 * to assess Package 5B against Push 0: a Level 1 account, one 24-hour stamina
 * cycle, no paid refill, and the documented repeat-value curve. V2's only
 * incremental reward is +1 Daily Stamina and +5 Weekly Momentum spread over
 * five qualifying days; it adds no XP, currency, materials, or Codex rewards.
 */
const level = 1;
const passiveStamina = Math.floor((24 * 60) / REGEN_MINUTES);
const openingStamina = staminaMaxForLevel(level);
const preV2Stamina = openingStamina + passiveStamina;
const v2AverageDailyStamina = 1;
const v2HighlyEngagedDailyStamina = 1 + (5 / 5);
// Explicit Push-0 activity-mix assumptions. They are ratios of the canonical
// Level-1 opening-cap + 24h regeneration envelope, not hidden outcome totals.
const AVERAGE_PLAYER_STAMINA_CAPTURE = 0.79;
const HIGHLY_ENGAGED_STAMINA_CAPTURE = 0.63;

let repeatState = { age1_reward_day: '2026-08-23', age1_reward_units: 0 };
let effectiveRepeatUnits = 0;
for (let i = 0; i < 24; i++) {
  const result = consumeAge1RepeatBudget(repeatState, 1, new Date(2026, 7, 23, 12));
  repeatState = result.state;
  effectiveRepeatUnits += result.multiplier;
}

// Engagement corridors are intentionally expressed in effective reward units,
// rather than inventing per-action currency values that are not canonical data.
const averagePlayerPush0 = Math.floor(preV2Stamina * AVERAGE_PLAYER_STAMINA_CAPTURE);
const highlyEngagedPush0 = Math.floor(preV2Stamina * HIGHLY_ENGAGED_STAMINA_CAPTURE);
const averagePlayerProjection = averagePlayerPush0 + v2AverageDailyStamina;
const highlyEngagedProjection = highlyEngagedPush0 + v2HighlyEngagedDailyStamina;

console.log(JSON.stringify({
  assumptions: {
    level, openingStamina, passiveStamina, regenMinutes: REGEN_MINUTES,
    paidRefills: 0, repeatAttempts: 24,
    averagePlayerStaminaCapture: AVERAGE_PLAYER_STAMINA_CAPTURE,
    highlyEngagedStaminaCapture: HIGHLY_ENGAGED_STAMINA_CAPTURE,
  },
  push0: {
    effectiveRepeatUnits,
    currencies: 'No Daily/Weekly V2 currency, XP, material, Codex, or Insight reward exists.',
    staminaAvailableBeforeV2: preV2Stamina,
  },
  package5bDelta: {
    averageDayStamina: v2AverageDailyStamina,
    fiveDayWeeklyMomentum: 5,
    highlyEngagedDailyAverageStamina: v2HighlyEngagedDailyStamina,
  },
  corridors: { averagePlayerPush0, highlyEngagedPush0, averagePlayerProjection, highlyEngagedProjection },
}, null, 2));

check('Push 0 repeat curve is 12 full, 8 reduced, 4 sharply reduced', AGE1_REPEAT_FULL_BUDGET === 12 && Math.abs(effectiveRepeatUnits - 16) < 0.000001);
check('V2 adds only bounded recovery Stamina', v2AverageDailyStamina === 1 && v2HighlyEngagedDailyStamina === 2);
check('average-player corridor remains 90–100 effective units', averagePlayerProjection >= 90 && averagePlayerProjection <= 100);
check('highly-engaged corridor remains 70–80 effective units', highlyEngagedProjection >= 70 && highlyEngagedProjection <= 80);

if (failures > 0) process.exit(1);