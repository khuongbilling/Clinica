// Canonical V2 Daily/Weekly claims are Stamina-only and their pure receipts
// must be idempotent even when a UI event is replayed.
import {
  claimAllCompleteBonus,
  claimObjectiveReward,
  claimWeeklyAllComplete,
  defaultDailyRoundsState,
  ensureFreshDailyRounds,
  recordObjectiveProgress,
} from '../src/game/dailyRounds';

const day = new Date(2026, 7, 23, 12);
const activities = [
  { id: 'university-practice', label: 'University Practice', category: 'learning', dailyMode: 'university', route: '/university/apply-it' },
  { id: 'clinical-simulation', label: 'Clinical Simulation', category: 'care', dailyMode: 'university', route: '/university/simulation/clinical' },
] as const;
const expect = (name: string, condition: boolean) => {
  if (!condition) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
};

let state = ensureFreshDailyRounds(defaultDailyRoundsState(), [...activities], 'double-claim', day, false).state;
for (const card of state.objectives) {
  state = recordObjectiveProgress(state, card.event, 1, day, card.activity_id).state;
}
const dailyFirst = claimAllCompleteBonus(state);
const dailySecond = claimAllCompleteBonus(dailyFirst.state);
expect('Daily receipt grants exactly +1 Stamina once', dailyFirst.reward?.stamina === 1 && Object.keys(dailyFirst.reward ?? {}).length === 1 && dailySecond.reward === null);
expect('V2 has no per-objective currency claim', claimObjectiveReward(state, state.objectives[0].id).reward === null);

const weeklyReady = { ...dailyFirst.state, weekly_days_completed: 5, weekly_momentum_claimed: [] };
const weeklyFirst = claimWeeklyAllComplete(weeklyReady);
const weeklySecond = claimWeeklyAllComplete(weeklyFirst.state);
expect('Weekly Momentum grants exactly +5 Stamina once', weeklyFirst.reward?.stamina === 5 && Object.keys(weeklyFirst.reward ?? {}).length === 1 && weeklySecond.reward === null);
console.log('Daily/Weekly double-claim tests passed');