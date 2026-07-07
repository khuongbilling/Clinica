// Daily Ward Rounds — day/week ROLLOVER weekly-credit safety tests.
// Run: npx sucrase-node tests/daily_weekly_credit_rollover.test.ts
//
// Companion to daily_weekly_credit_double_count.test.ts, which pins daily_date
// to "today" so ensureFreshDailyRounds never rerolls. These tests exercise the
// untested seam: the midnight rollover. When ensureFreshDailyRounds rerolls
// objectives for a NEW date (and, on ISO-week rollover, clears
// weekly_credited_dates / weekly_days_completed), we assert:
//   1. A completion on the NEW day credits the weekly goal exactly once.
//   2. A stale in-flight event carrying the OLD day's completed objectives
//      neither credits the new day nor duplicates the old date.
//   3. Week rollover resets weekly counters, and the new week's first
//      completion credits exactly once from zero.
//   4. The store-style critical section (ensureFresh -> record -> synchronous
//      ref commit) stays credit-safe across the boundary under concurrency.
//
// All calls use a controlled `now` (noon UTC to avoid timezone day drift).

import {
  DailyRoundsState,
  DailyObjectiveState,
  DailyEventType,
  defaultDailyRoundsState,
  ensureFreshDailyRounds,
  recordObjectiveProgress,
  allObjectivesComplete,
} from '../src/game/dailyRounds';
import { dateKey, weekKey } from '../src/game/wellness';

type Result = { name: string; pass: boolean; details?: string };
const results: Result[] = [];
function check(name: string, cond: boolean, details = '') {
  results.push({ name, pass: !!cond, details });
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${cond ? '' : ` :: ${details}`}`);
}

// ─────────────────────────────────────────────────────────────
// Controlled clock. Noon UTC keeps dateKey (UTC-based) and weekKey
// (local-component-based) on the same calendar day in any test timezone.
// ─────────────────────────────────────────────────────────────
const DAY1 = new Date('2026-07-07T12:00:00Z'); // Tuesday
const DAY2 = new Date('2026-07-08T12:00:00Z'); // Wednesday, same ISO week
const SUNDAY = new Date('2026-07-12T12:00:00Z'); // last day of ISO week
const MONDAY = new Date('2026-07-13T12:00:00Z'); // first day of NEXT ISO week

const D1 = dateKey(DAY1);
const D2 = dateKey(DAY2);
const DSUN = dateKey(SUNDAY);
const DMON = dateKey(MONDAY);

check('FIXTURE: day1/day2 share an ISO week', weekKey(DAY1) === weekKey(DAY2));
check('FIXTURE: sunday/monday cross an ISO week boundary', weekKey(SUNDAY) !== weekKey(MONDAY));

// Only ward_shift unlocked -> reroll deterministically yields exactly the
// obj_ward_shift objective (event ward_shift_win, target 2).
const MODES = ['ward_shift'];
const PLAYER_ID = 'p-rollover';

function freshFor(now: Date, prev?: DailyRoundsState): DailyRoundsState {
  return ensureFreshDailyRounds(prev, MODES, PLAYER_ID, now).state;
}

// Complete every objective in `state` via progress events at `now`.
function completeAll(state: DailyRoundsState, now: Date): DailyRoundsState {
  let s = state;
  for (const o of s.objectives) {
    const remaining = o.target - o.progress;
    if (remaining > 0) s = recordObjectiveProgress(s, o.event, remaining, now).state;
  }
  return s;
}

function creditedCount(s: DailyRoundsState, date: string): number {
  return s.weekly_credited_dates.filter((d) => d === date).length;
}

// ─────────────────────────────────────────────────────────────
// Store reconstruction with an injectable clock — mirrors store.tsx foldDaily
// (ensureFresh -> recordObjectiveProgress) with the synchronous playerRef
// commit before awaited persistence.
// ─────────────────────────────────────────────────────────────
interface Player { id: string; daily_rounds: DailyRoundsState; }

function makeStore(initial: Player) {
  let playerRef: Player = initial;
  let now: Date = DAY1;

  const updateState = async (_next: Player) => { await Promise.resolve(); };

  const foldDaily = (p: Player, event: DailyEventType, amount: number = 1): Player => {
    const before = ensureFreshDailyRounds(p.daily_rounds, MODES, p.id, now).state;
    const rec = recordObjectiveProgress(before, event, amount, now);
    return { ...p, daily_rounds: rec.state };
  };

  const creditProgress = async (event: DailyEventType, amount: number = 1): Promise<void> => {
    const base = playerRef;
    if (!base) return;
    const next = foldDaily(base, event, amount);
    playerRef = next; // commit synchronously BEFORE awaiting persistence
    await updateState(next);
  };

  return {
    creditProgress,
    setNow(d: Date) { now = d; },
    get player() { return playerRef; },
  };
}

async function run() {
  // ── 1. Day rollover (same week): new day earns its own credit once ──
  {
    let s = freshFor(DAY1);
    s = completeAll(s, DAY1);
    check('DAY: day1 completion credited once', s.weekly_days_completed === 1 && creditedCount(s, D1) === 1,
      `days=${s.weekly_days_completed} dates=${JSON.stringify(s.weekly_credited_dates)}`);

    // Midnight reroll to day2.
    const rolled = ensureFreshDailyRounds(s, MODES, PLAYER_ID, DAY2);
    check('DAY: rollover flags changed', rolled.changed === true);
    const s2 = rolled.state;
    check('DAY: reroll resets objective progress',
      s2.daily_date === D2 && s2.objectives.every((o) => o.progress === 0 && !o.claimed),
      `daily_date=${s2.daily_date}`);
    check('DAY: reroll preserves weekly credit from day1',
      s2.weekly_days_completed === 1 && creditedCount(s2, D1) === 1,
      `days=${s2.weekly_days_completed} dates=${JSON.stringify(s2.weekly_credited_dates)}`);

    // Complete the NEW day's set.
    let s3 = completeAll(s2, DAY2);
    check('DAY: new day completion credits exactly once more',
      s3.weekly_days_completed === 2 && creditedCount(s3, D2) === 1 && creditedCount(s3, D1) === 1,
      `days=${s3.weekly_days_completed} dates=${JSON.stringify(s3.weekly_credited_dates)}`);

    // Further events on the completed new day never re-credit.
    const r = recordObjectiveProgress(s3, 'ward_shift_win', 5, DAY2);
    check('DAY: repeat events on new day never re-credit',
      r.state.weekly_days_completed === 2 && r.state.weekly_credited_dates.length === 2,
      `days=${r.state.weekly_days_completed}`);
  }

  // ── 2. Stale old-day event after reroll ─────────────────────
  // A handler that ran ensureFresh at DAY2 discards the old completed
  // objectives; the stale event must not credit the new day.
  {
    let s = freshFor(DAY1);
    s = completeAll(s, DAY1); // day1 credited
    // In-flight event from day1 lands after the day2 reroll:
    const fresh2 = freshFor(DAY2, s);
    const r = recordObjectiveProgress(fresh2, 'ward_shift_win', 1, DAY2);
    check('STALE: single stale-style event after reroll does not credit new day',
      r.state.weekly_days_completed === 1 && creditedCount(r.state, D2) === 0,
      `days=${r.state.weekly_days_completed} dates=${JSON.stringify(r.state.weekly_credited_dates)}`);
    check('STALE: old date not duplicated', creditedCount(r.state, D1) === 1);
  }

  // A truly stale snapshot (old daily_date, objectives complete, already
  // credited) processed WITHOUT ensureFresh must still be inert: crediting
  // keys on daily_date, so it can neither duplicate the old date nor touch
  // the new one.
  {
    let s = freshFor(DAY1);
    s = completeAll(s, DAY1);
    const r = recordObjectiveProgress(s, 'wellness_log', 1, DAY2); // stale state, new-day clock
    check('STALE: raw stale snapshot never credits the new date',
      r.state.weekly_days_completed === 1 &&
      creditedCount(r.state, D1) === 1 && creditedCount(r.state, D2) === 0,
      `days=${r.state.weekly_days_completed} dates=${JSON.stringify(r.state.weekly_credited_dates)}`);
  }

  // ── 3. Week rollover: counters reset, new week credits from zero ──
  {
    let s = freshFor(SUNDAY);
    s = completeAll(s, SUNDAY);
    s = { ...s, weekly_days_completed: 4, weekly_credited_dates: ['2026-07-09', '2026-07-10', '2026-07-11', DSUN] };
    const rolled = freshFor(MONDAY, s);
    check('WEEK: rollover clears weekly counters',
      rolled.weekly_key === weekKey(MONDAY) &&
      rolled.weekly_days_completed === 0 &&
      rolled.weekly_credited_dates.length === 0 &&
      rolled.weekly_claimed === false,
      `days=${rolled.weekly_days_completed} dates=${JSON.stringify(rolled.weekly_credited_dates)}`);
    check('WEEK: rollover rerolls to the new date',
      rolled.daily_date === DMON && rolled.objectives.every((o) => o.progress === 0));

    let s2 = completeAll(rolled, MONDAY);
    check('WEEK: first completion of new week credits exactly once',
      s2.weekly_days_completed === 1 && creditedCount(s2, DMON) === 1 && s2.weekly_credited_dates.length === 1,
      `days=${s2.weekly_days_completed} dates=${JSON.stringify(s2.weekly_credited_dates)}`);
    const r = recordObjectiveProgress(s2, 'ward_shift_win', 3, MONDAY);
    check('WEEK: repeat events in new week never re-credit',
      r.state.weekly_days_completed === 1 && r.state.weekly_credited_dates.length === 1);
  }

  // ── 4. Store critical section across the boundary ───────────
  // Complete day1 through the store, roll the clock to day2, then fire
  // concurrent events: one stale-pattern burst plus the completing pair.
  {
    const store = makeStore({ id: PLAYER_ID, daily_rounds: freshFor(DAY1) });
    await store.creditProgress('ward_shift_win', 2); // completes day1 set (target 2)
    check('STORE: day1 credited once',
      store.player.daily_rounds.weekly_days_completed === 1 &&
      creditedCount(store.player.daily_rounds, D1) === 1,
      `days=${store.player.daily_rounds.weekly_days_completed}`);

    store.setNow(DAY2);
    // A stale-feeling first event after midnight: reroll happens inside the
    // handler; single tick must not credit (target is 2).
    await store.creditProgress('ward_shift_win', 1);
    check('STORE: first post-midnight event rerolls without crediting',
      store.player.daily_rounds.daily_date === D2 &&
      store.player.daily_rounds.weekly_days_completed === 1,
      `daily_date=${store.player.daily_rounds.daily_date} days=${store.player.daily_rounds.weekly_days_completed}`);

    // Concurrent completing burst on the new day.
    await Promise.all([
      store.creditProgress('ward_shift_win'),
      store.creditProgress('ward_shift_win'),
      store.creditProgress('ward_shift_win'),
    ]);
    check('STORE: concurrent new-day burst credits exactly once',
      store.player.daily_rounds.weekly_days_completed === 2 &&
      creditedCount(store.player.daily_rounds, D2) === 1 &&
      creditedCount(store.player.daily_rounds, D1) === 1,
      `days=${store.player.daily_rounds.weekly_days_completed} dates=${JSON.stringify(store.player.daily_rounds.weekly_credited_dates)}`);
    check('STORE: new-day objectives complete', allObjectivesComplete(store.player.daily_rounds));
  }

  // Store-level WEEK rollover: credited progress resets, new week credits once.
  {
    const store = makeStore({ id: PLAYER_ID, daily_rounds: freshFor(SUNDAY) });
    store.setNow(SUNDAY);
    await store.creditProgress('ward_shift_win', 2); // credit sunday
    store.setNow(MONDAY);
    await Promise.all([
      store.creditProgress('ward_shift_win'),
      store.creditProgress('ward_shift_win'),
    ]);
    const dr = store.player.daily_rounds;
    check('STORE: week rollover resets then credits new week exactly once',
      dr.weekly_key === weekKey(MONDAY) &&
      dr.weekly_days_completed === 1 &&
      dr.weekly_credited_dates.length === 1 &&
      creditedCount(dr, DMON) === 1 &&
      creditedCount(dr, DSUN) === 0,
      `key=${dr.weekly_key} days=${dr.weekly_days_completed} dates=${JSON.stringify(dr.weekly_credited_dates)}`);
  }

  // ── Summary ────────────────────────────────────────────────
  const failed = results.filter((r) => !r.pass);
  console.log(`\n========== SUMMARY ==========`);
  console.log(`Total: ${results.length}  Passed: ${results.length - failed.length}  Failed: ${failed.length}`);
  if (failed.length) {
    console.log('\nFailing tests:');
    failed.forEach((f) => console.log(`  - ${f.name} :: ${f.details}`));
    process.exit(1);
  }
}

run();
