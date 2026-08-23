import {
  DailyOpportunityInput,
  defaultDailyRoundsState,
  ensureFreshDailyRounds,
  recordObjectiveProgress,
  claimAllCompleteBonus,
  claimWeeklyAllComplete,
} from '../src/game/dailyRounds';

const early: DailyOpportunityInput[] = [
  { id: 'university-practice', label: 'University Practice', category: 'learning', dailyMode: 'university', route: '/university/apply-it' },
  { id: 'ward-shift', label: 'Ward Shift', category: 'care', dailyMode: 'ward_shift', route: '/shift' },
  { id: 'journey', label: 'Journey', category: 'adventure', dailyMode: 'ward_shift', route: '/journey' },
  { id: 'lotus-journal', label: 'Lotus Plate Journal', category: 'wellness', dailyMode: 'lotus_journal', route: '/lotus-journal' },
  { id: 'hero-growth', label: 'Hero Growth', category: 'roster', dailyMode: 'hall_of_heroes', route: '/(tabs)/heroes' },
];
const day = new Date(2026, 7, 23, 12);
const expect = (label: string, condition: boolean) => {
  if (!condition) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
};

let state = ensureFreshDailyRounds(defaultDailyRoundsState(), early, 'p5b-test', day, false).state;
expect('V2 migrates to a versioned registry board', state.version === 2);
expect('early board requires any two', state.required_count === 2);
expect('board has four to six opportunities', state.objectives.length >= 4 && state.objectives.length <= 6);
expect('board prioritizes category variety', new Set(state.objectives.map((o) => o.category)).size === state.objectives.length);
expect('opportunities retain registry GO metadata', state.objectives.every((o) => !!o.activity_id && !!o.route));
const universityOnly: DailyOpportunityInput[] = [
  { id: 'university-practice', label: 'University Practice', category: 'learning', dailyMode: 'university', route: '/university/apply-it' },
  { id: 'clinical-simulation', label: 'Clinical Simulation', category: 'learning', dailyMode: 'university', route: '/university/simulation/clinical' },
  { id: 'grand-rounds', label: 'Grand Rounds', category: 'learning', dailyMode: 'university', route: '/university/grand-rounds' },
  { id: 'crisis-drill', label: 'Crisis Drill', category: 'learning', dailyMode: 'university', route: '/university/crisis-drill' },
];
const universityBoard = ensureFreshDailyRounds(defaultDailyRoundsState(), universityOnly, 'p5b-university', day, false).state;
expect('University cards retain their distinct verified activity identities', universityBoard.objectives.length === 4);
const universityProgress = recordObjectiveProgress(universityBoard, 'university_lesson', 1, day, 'university-practice').state;
expect('one University receipt credits only its matching card', universityProgress.objectives.filter((o) => o.progress === 1).length === 1);
const oneReceiptBoard = ensureFreshDailyRounds(defaultDailyRoundsState(), universityOnly.slice(0, 1), 'p5b-one-receipt', day, false).state;
expect('Daily target stays unavailable until two verified opportunities exist', oneReceiptBoard.required_count === 0 && oneReceiptBoard.objectives.length === 0);

const before = state;
for (const opportunity of state.objectives.slice(0, 2)) {
  state = recordObjectiveProgress(state, opportunity.event, 1, day, opportunity.activity_id).state;
}
expect('two meaningful completions satisfy the early target', state.weekly_days_completed === 1);
const again = recordObjectiveProgress(state, state.objectives[0].event, 10, day, state.objectives[0].activity_id).state;
expect('replayed completion cannot add a second weekly day', again.weekly_days_completed === 1 && again.weekly_credited_dates.length === 1);

const daily = claimAllCompleteBonus(state);
expect('daily meta receipt awards only its bounded recovery', daily.reward?.stamina === 1);
expect('daily meta receipt is idempotent', claimAllCompleteBonus(daily.state).reward === null);

const mature = ensureFreshDailyRounds(defaultDailyRoundsState(), early, 'p5b-mature', day, true).state;
expect('mature board requires any three', mature.required_count === 3);
const weeklyState = { ...mature, weekly_days_completed: 5, weekly_momentum_claimed: [] };
const weekly = claimWeeklyAllComplete(weeklyState);
expect('five-day weekly momentum awards +5 stamina', weekly.reward?.stamina === 5);
expect('weekly momentum is idempotent', claimWeeklyAllComplete(weekly.state).reward === null);
console.log('Daily Rounds V2 tests passed');