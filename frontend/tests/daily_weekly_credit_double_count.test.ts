// Daily Ward Rounds — weekly-goal crediting double-count safety tests.
// Run: npx sucrase-node tests/daily_weekly_credit_double_count.test.ts
//
// `recordObjectiveProgress` in dailyRounds.ts bumps `weekly_days_completed`
// the first time all of a day's objectives are complete, guarding re-credit
// with `weekly_credited_dates`. If two objective-progress events land
// concurrently (e.g. the final objective completes while another reward
// handler fires), a stale read could credit the same calendar day toward the
// 5-day weekly goal twice. The real safety net is:
//   1. The pure `recordObjectiveProgress` is idempotent per calendar day —
//      once today's date is in `weekly_credited_dates` it never re-credits.
//   2. The store's `foldDaily` runs inside callbacks that commit the folded
//      state to playerRef SYNCHRONOUSLY before awaiting persistence, so a
//      rapid second event reads the already-credited state.
//
// These tests reconstruct the store's foldDaily critical section (using the
// real dailyRounds.ts helpers) and fire rapid/concurrent progress events that
// each complete the full objective set on the same day, asserting
// weekly_days_completed increments exactly once and the date appears exactly
// once in weekly_credited_dates.

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
// Fixtures
// ─────────────────────────────────────────────────────────────
const TODAY = dateKey(new Date());
const WEEK = weekKey(new Date());

function obj(
  id: string,
  event: DailyEventType,
  target: number,
  progress: number,
): DailyObjectiveState {
  return {
    id,
    mode: 'ward_shift',
    event,
    target,
    progress,
    claimed: false,
    label: id,
    description: '',
    icon: 'medkit',
    reward: { crowns: 10 },
  };
}

// A daily_rounds state pinned to TODAY/WEEK so ensureFreshDailyRounds never
// rerolls (which would wipe our hand-built objectives).
function roundsWith(overrides: Partial<DailyRoundsState>): DailyRoundsState {
  return {
    ...defaultDailyRoundsState(),
    daily_date: TODAY,
    weekly_key: WEEK,
    ...overrides,
  };
}

interface Player {
  id: string;
  daily_rounds: DailyRoundsState;
}

function makePlayer(rounds: DailyRoundsState): Player {
  return { id: 'p1', daily_rounds: rounds };
}

// ─────────────────────────────────────────────────────────────
// Store reconstruction — mirrors store.tsx's foldDaily + the reward-handler
// pattern that wraps it. The key property under test is the SYNCHRONOUS
// playerRef commit before the awaited persistence: this is what makes a
// rapid second progress event observe the already-credited weekly state.
// ─────────────────────────────────────────────────────────────
function makeStore(initial: Player) {
  let playerRef: Player = initial;
  let persistCount = 0;

  // Simulated async persistence (like updateState -> AsyncStorage/network).
  // Mirroring the real store, this does NOT touch playerRef; the ref is
  // committed synchronously in the callbacks BEFORE this await. The await is
  // exactly where a naive implementation would be vulnerable if it committed
  // the ref AFTER awaiting instead of before.
  const updateState = async (_next: Player) => {
    persistCount += 1;
    await Promise.resolve();
  };

  // Mirrors store.tsx foldDaily: ensureFresh -> recordObjectiveProgress.
  // (The pulse-emission side effect is UI-only and irrelevant to crediting.)
  const foldDaily = (p: Player, event: DailyEventType, amount: number = 1): Player => {
    const before = ensureFreshDailyRounds(p.daily_rounds, [], p.id).state;
    const rec = recordObjectiveProgress(before, event, amount);
    return { ...p, daily_rounds: rec.state };
  };

  // Mirrors a reward handler in store.tsx (e.g. the ward-shift-win path):
  // read playerRef, fold progress, commit ref synchronously, then persist.
  const creditProgress = async (event: DailyEventType, amount: number = 1): Promise<void> => {
    const base = playerRef;
    if (!base) return;
    const next = foldDaily(base, event, amount);
    playerRef = next; // commit synchronously BEFORE awaiting persistence
    await updateState(next);
  };

  return {
    creditProgress,
    get player() { return playerRef; },
    get persistCount() { return persistCount; },
  };
}

function creditedCount(p: Player, date: string): number {
  return p.daily_rounds.weekly_credited_dates.filter((d) => d === date).length;
}

async function run() {
  // ── 1. Pure helper idempotency ──────────────────────────────
  // Completing the set credits the weekly goal exactly once; a further
  // progress event on the already-complete same day never re-credits.
  {
    const state = roundsWith({
      objectives: [
        obj('a', 'ward_shift_win', 1, 0),
        obj('b', 'hero_action', 1, 1),
      ],
    });
    const r1 = recordObjectiveProgress(state, 'ward_shift_win');
    check('PURE: completing the set credits weekly once',
      r1.state.weekly_days_completed === 1, `days=${r1.state.weekly_days_completed}`);
    check('PURE: today recorded in weekly_credited_dates',
      r1.state.weekly_credited_dates.includes(TODAY));
    const r2 = recordObjectiveProgress(r1.state, 'ward_shift_win');
    check('PURE: repeat event on complete day does not re-credit',
      r2.state.weekly_days_completed === 1, `days=${r2.state.weekly_days_completed}`);
    check('PURE: repeat event is a no-op change', r2.changed === false);
    const r3 = recordObjectiveProgress(r1.state, 'hero_action', 5);
    check('PURE: different event on complete day does not re-credit',
      r3.state.weekly_days_completed === 1, `days=${r3.state.weekly_days_completed}`);
    check('PURE: date appears exactly once after repeats',
      creditedCount({ id: 'x', daily_rounds: r3.state }, TODAY) === 1,
      `dates=${JSON.stringify(r3.state.weekly_credited_dates)}`);
  }

  // Even a hand-built "stale" state where objectives are all complete but the
  // date is already credited must never bump the counter again.
  {
    const state = roundsWith({
      objectives: [obj('a', 'ward_shift_win', 1, 1)],
      weekly_days_completed: 1,
      weekly_credited_dates: [TODAY],
    });
    const r = recordObjectiveProgress(state, 'wellness_log');
    check('PURE: already-credited day never re-credits',
      r.state.weekly_days_completed === 1, `days=${r.state.weekly_days_completed}`);
  }

  // ── 2. Store critical section: concurrent completing events ─
  // Two concurrent events, EACH of which completes the full set (both target
  // the final outstanding objective) — the classic stale-read hazard.
  {
    const store = makeStore(makePlayer(roundsWith({
      objectives: [
        obj('a', 'ward_shift_win', 2, 1), // one tick from done
        obj('b', 'hero_action', 1, 1),    // already done
      ],
    })));
    await Promise.all([
      store.creditProgress('ward_shift_win'),
      store.creditProgress('ward_shift_win'),
    ]);
    check('STORE: concurrent completing events credit weekly exactly once',
      store.player.daily_rounds.weekly_days_completed === 1,
      `days=${store.player.daily_rounds.weekly_days_completed}`);
    check('STORE: date appears exactly once in weekly_credited_dates',
      creditedCount(store.player, TODAY) === 1,
      `dates=${JSON.stringify(store.player.daily_rounds.weekly_credited_dates)}`);
    check('STORE: objectives all complete in final state',
      allObjectivesComplete(store.player.daily_rounds));
  }

  // Final objective completes while a DIFFERENT reward handler fires
  // concurrently (mixed events, same tick).
  {
    const store = makeStore(makePlayer(roundsWith({
      objectives: [
        obj('a', 'ward_shift_win', 1, 0),
        obj('b', 'hero_action', 3, 3), // already done
      ],
    })));
    await Promise.all([
      store.creditProgress('ward_shift_win'), // completes the set
      store.creditProgress('hero_action'),    // fires concurrently, no-op progress
    ]);
    check('STORE: mixed concurrent handlers credit weekly exactly once',
      store.player.daily_rounds.weekly_days_completed === 1,
      `days=${store.player.daily_rounds.weekly_days_completed}`);
    check('STORE: mixed handlers record the date once',
      creditedCount(store.player, TODAY) === 1,
      `dates=${JSON.stringify(store.player.daily_rounds.weekly_credited_dates)}`);
  }

  // Five-event burst on an already-complete day (e.g. spam-winning waves
  // after the set is done) must never inflate the weekly counter.
  {
    const store = makeStore(makePlayer(roundsWith({
      objectives: [
        obj('a', 'ward_shift_win', 1, 0),
        obj('b', 'ward_defense_wave', 1, 1),
      ],
    })));
    await Promise.all(
      Array.from({ length: 5 }, () => store.creditProgress('ward_shift_win')),
    );
    check('STORE: 5-event burst credits weekly exactly once',
      store.player.daily_rounds.weekly_days_completed === 1,
      `days=${store.player.daily_rounds.weekly_days_completed}`);
    check('STORE: 5-event burst records the date once',
      creditedCount(store.player, TODAY) === 1,
      `dates=${JSON.stringify(store.player.daily_rounds.weekly_credited_dates)}`);
    check('STORE: all 5 events persisted', store.persistCount === 5,
      `persists=${store.persistCount}`);
  }

  // Sequential: complete the set, then more events later the same day.
  {
    const store = makeStore(makePlayer(roundsWith({
      objectives: [obj('a', 'ward_shift_win', 1, 0)],
    })));
    await store.creditProgress('ward_shift_win');
    await store.creditProgress('ward_shift_win');
    await store.creditProgress('wellness_log');
    check('STORE: sequential later events same day never re-credit',
      store.player.daily_rounds.weekly_days_completed === 1,
      `days=${store.player.daily_rounds.weekly_days_completed}`);
    check('STORE: sequential date recorded once',
      creditedCount(store.player, TODAY) === 1,
      `dates=${JSON.stringify(store.player.daily_rounds.weekly_credited_dates)}`);
  }

  // Prior week days already credited — a new day's completion adds exactly
  // one more, and never duplicates the earlier dates.
  {
    const store = makeStore(makePlayer(roundsWith({
      objectives: [obj('a', 'ward_shift_win', 1, 0)],
      weekly_days_completed: 2,
      weekly_credited_dates: ['2026-07-05', '2026-07-06'],
    })));
    await Promise.all([
      store.creditProgress('ward_shift_win'),
      store.creditProgress('ward_shift_win'),
    ]);
    check('STORE: prior days preserved, new day adds exactly one',
      store.player.daily_rounds.weekly_days_completed === 3,
      `days=${store.player.daily_rounds.weekly_days_completed}`);
    check('STORE: credited dates list is [prior, prior, today] with no dupes',
      store.player.daily_rounds.weekly_credited_dates.length === 3 &&
      creditedCount(store.player, TODAY) === 1,
      `dates=${JSON.stringify(store.player.daily_rounds.weekly_credited_dates)}`);
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
