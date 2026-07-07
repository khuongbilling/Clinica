// Daily Ward Rounds — login streak check-in double-grant safety tests.
// Run: npx sucrase-node tests/daily_checkin_double_grant.test.ts
//
// Sibling to daily_claim_double_grant.test.ts. Any UI button that triggers a
// login check-in (the DailyPulseToast / DailyRounds panel "check in" action)
// can be tapped twice before the once-per-day guard settles. If the second
// invocation observed the STALE pre-check-in state it would:
//   • credit the streak reward (crowns / codex shards / insight crystals) twice,
//   • increment streak_count twice,
//   • (harmlessly) re-write last_checkin_date to the same day.
//
// The real safety net is the same two-part mechanism the claim path relies on:
//   1. The pure helper checkInDailyRounds() in dailyRounds.ts is idempotent —
//      once last_checkin_date === today it returns alreadyCheckedIn with a null
//      reward and leaves streak_count untouched.
//   2. The store's checkInDailyRounds callback runs a synchronous playerRef
//      critical section: it commits the post-check-in state to playerRef BEFORE
//      awaiting persistence, so a rapid second invocation reads the
//      already-checked-in state and no-ops.
//
// These tests reconstruct the EXACT store critical-section pattern (using the
// real dailyRounds.ts helpers) and fire rapid concurrent / burst / sequential
// check-ins to prove the streak reward is granted exactly once and the streak
// advances exactly once — for the normal-increment day AND the
// already-checked-in-today no-op path.

import {
  DailyReward,
  DailyRoundsState,
  CheckInResult,
  defaultDailyRoundsState,
  checkInDailyRounds as computeCheckIn,
  ensureFreshDailyRounds,
  streakRewardForDay,
} from '../src/game/dailyRounds';
import { dateKey } from '../src/game/wellness';

type Result = { name: string; pass: boolean; details?: string };
const results: Result[] = [];
function check(name: string, cond: boolean, details = '') {
  results.push({ name, pass: !!cond, details });
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${cond ? '' : ` :: ${details}`}`);
}

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────
const NOW = new Date();
const TODAY = dateKey(NOW);
const YESTERDAY = dateKey(new Date(NOW.getTime() - 24 * 60 * 60 * 1000));

function roundsWith(overrides: Partial<DailyRoundsState>): DailyRoundsState {
  return {
    ...defaultDailyRoundsState(),
    daily_date: TODAY,
    ...overrides,
  };
}

interface Player {
  id: string;
  crowns: number;
  codex_shards: number;
  insight_crystals: number;
  daily_rounds: DailyRoundsState;
}

function makePlayer(rounds: DailyRoundsState): Player {
  return { id: 'p1', crowns: 0, codex_shards: 0, insight_crystals: 0, daily_rounds: rounds };
}

// Mirrors store.tsx addDailyReward exactly.
function addDailyReward(p: Player, r: DailyReward): Player {
  return {
    ...p,
    crowns: (p.crowns || 0) + (r.crowns || 0),
    codex_shards: (p.codex_shards || 0) + (r.codexShards || 0),
    insight_crystals: (p.insight_crystals || 0) + (r.insightCrystals || 0),
  };
}

// Faithful reconstruction of the store's checkInDailyRounds callback. The key
// property under test is the SYNCHRONOUS playerRef commit before the awaited
// persistence: this is what makes a rapid second call observe the
// already-checked-in state.
function makeStore(initial: Player) {
  let playerRef: Player = initial;
  let persistCount = 0;

  // Simulated async persistence (like updateState -> AsyncStorage/network).
  // Crucially — mirroring the real store — this does NOT touch playerRef; the
  // ref is committed synchronously in the callback BEFORE this await.
  const updateState = async (_next: Player) => {
    persistCount += 1;
    await Promise.resolve();
  };

  const checkIn = async (): Promise<CheckInResult | null> => {
    const base = playerRef;
    if (!base) return null;
    const fresh = ensureFreshDailyRounds(base.daily_rounds, [], base.id, NOW).state;
    const result = computeCheckIn(fresh, NOW);
    let next: Player = { ...base, daily_rounds: result.state };
    if (result.reward) next = addDailyReward(next, result.reward);
    playerRef = next; // commit synchronously BEFORE awaiting persistence
    await updateState(next);
    return result;
  };

  return {
    checkIn,
    get player() { return playerRef; },
    get persistCount() { return persistCount; },
  };
}

async function run() {
  // ── 1. Pure helper idempotency ──────────────────────────────
  {
    const state = roundsWith({ streak_count: 2, last_checkin_date: YESTERDAY });
    const r1 = computeCheckIn(state, NOW);
    check('PURE: first check-in returns streak reward', !!r1.reward);
    check('PURE: first check-in increments streak to 3', r1.streakDay === 3, `day=${r1.streakDay}`);
    check('PURE: first check-in advances last_checkin_date to today',
      r1.state.last_checkin_date === TODAY, r1.state.last_checkin_date);
    const r2 = computeCheckIn(r1.state, NOW);
    check('PURE: second check-in yields no reward', r2.reward === null, `reward=${JSON.stringify(r2.reward)}`);
    check('PURE: second check-in flagged alreadyCheckedIn', r2.alreadyCheckedIn === true);
    check('PURE: second check-in leaves streak at 3', r2.state.streak_count === 3, `streak=${r2.state.streak_count}`);
  }

  // Streak reward value matches the escalating cycle for the incremented day.
  {
    const state = roundsWith({ streak_count: 2, last_checkin_date: YESTERDAY });
    const r1 = computeCheckIn(state, NOW);
    const expected = streakRewardForDay(3);
    check('PURE: streak reward matches cycle for day 3',
      JSON.stringify(r1.reward) === JSON.stringify(expected),
      `reward=${JSON.stringify(r1.reward)} expected=${JSON.stringify(expected)}`);
  }

  // ── 2. Store critical section: rapid concurrent check-ins ────
  // Normal-increment day — fire two check-ins WITHOUT awaiting between them.
  {
    const store = makeStore(makePlayer(roundsWith({ streak_count: 2, last_checkin_date: YESTERDAY })));
    const reward = streakRewardForDay(3);
    const [a, b] = await Promise.all([store.checkIn(), store.checkIn()]);
    const rewarded = [a, b].filter((r) => r && r.reward).length;
    check('STORE: concurrent check-in grants reward exactly once', rewarded === 1, `rewarded=${rewarded}`);
    check('STORE: concurrent check-in crowns credited once',
      store.player.crowns === (reward.crowns || 0), `crowns=${store.player.crowns}`);
    check('STORE: concurrent check-in codex shards credited once',
      store.player.codex_shards === (reward.codexShards || 0), `shards=${store.player.codex_shards}`);
    check('STORE: concurrent check-in insight crystals credited once',
      store.player.insight_crystals === (reward.insightCrystals || 0), `crystals=${store.player.insight_crystals}`);
    check('STORE: concurrent check-in streak incremented once (3)',
      store.player.daily_rounds.streak_count === 3, `streak=${store.player.daily_rounds.streak_count}`);
    check('STORE: concurrent check-in last_checkin_date advanced to today',
      store.player.daily_rounds.last_checkin_date === TODAY, store.player.daily_rounds.last_checkin_date);
  }

  // Normal-increment day — five rapid taps in a burst.
  {
    const store = makeStore(makePlayer(roundsWith({ streak_count: 2, last_checkin_date: YESTERDAY })));
    const reward = streakRewardForDay(3);
    const burst = await Promise.all(Array.from({ length: 5 }, () => store.checkIn()));
    const rewarded = burst.filter((r) => r && r.reward).length;
    check('STORE: 5-tap burst grants reward exactly once', rewarded === 1, `rewarded=${rewarded}`);
    check('STORE: 5-tap burst crowns credited once',
      store.player.crowns === (reward.crowns || 0), `crowns=${store.player.crowns}`);
    check('STORE: 5-tap burst streak incremented once (3)',
      store.player.daily_rounds.streak_count === 3, `streak=${store.player.daily_rounds.streak_count}`);
  }

  // First-ever check-in (last_checkin_date '') — streak starts at 1, rapid taps.
  {
    const store = makeStore(makePlayer(roundsWith({ streak_count: 0, last_checkin_date: '' })));
    const reward = streakRewardForDay(1);
    const [a, b, c] = await Promise.all([store.checkIn(), store.checkIn(), store.checkIn()]);
    const rewarded = [a, b, c].filter((r) => r && r.reward).length;
    check('STORE: first-ever check-in grants reward exactly once', rewarded === 1, `rewarded=${rewarded}`);
    check('STORE: first-ever check-in crowns credited once',
      store.player.crowns === (reward.crowns || 0), `crowns=${store.player.crowns}`);
    check('STORE: first-ever check-in streak set to 1',
      store.player.daily_rounds.streak_count === 1, `streak=${store.player.daily_rounds.streak_count}`);
  }

  // Sequential check-ins (check in, then check in again after settle).
  {
    const store = makeStore(makePlayer(roundsWith({ streak_count: 2, last_checkin_date: YESTERDAY })));
    const reward = streakRewardForDay(3);
    const first = await store.checkIn();
    const second = await store.checkIn();
    check('STORE: sequential first check-in rewarded', !!(first && first.reward));
    check('STORE: sequential second check-in already-checked-in',
      !!(second && second.alreadyCheckedIn && second.reward === null));
    check('STORE: sequential crowns credited once',
      store.player.crowns === (reward.crowns || 0), `crowns=${store.player.crowns}`);
    check('STORE: sequential streak incremented once (3)',
      store.player.daily_rounds.streak_count === 3, `streak=${store.player.daily_rounds.streak_count}`);
  }

  // ── 3. Already-checked-in-today no-op path ──────────────────
  // Player already checked in today — every tap must grant NOTHING and leave
  // the streak untouched.
  {
    const store = makeStore(makePlayer(roundsWith({ streak_count: 4, last_checkin_date: TODAY })));
    const [a, b] = await Promise.all([store.checkIn(), store.checkIn()]);
    const rewarded = [a, b].filter((r) => r && r.reward).length;
    check('STORE: already-checked-in grants nothing', rewarded === 0, `rewarded=${rewarded}`);
    check('STORE: already-checked-in flags alreadyCheckedIn on every tap',
      [a, b].every((r) => r && r.alreadyCheckedIn === true));
    check('STORE: already-checked-in crowns stay 0', store.player.crowns === 0, `crowns=${store.player.crowns}`);
    check('STORE: already-checked-in streak unchanged (4)',
      store.player.daily_rounds.streak_count === 4, `streak=${store.player.daily_rounds.streak_count}`);
    check('STORE: already-checked-in last_checkin_date unchanged (today)',
      store.player.daily_rounds.last_checkin_date === TODAY, store.player.daily_rounds.last_checkin_date);
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
