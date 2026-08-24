// Daily Ward Rounds — login streak check-in idempotency tests.
// Run: npx sucrase-node tests/daily_checkin_double_grant.test.ts
//
// The login check-in is streak state only. It returns reward:null; recurring
// Daily/Weekly rewards are receipt-backed V2 Stamina recoveries covered by
// daily_claim_double_grant.test.ts and backend daily-rounds authority tests.
//
// The store callback still needs its synchronous playerRef commit:
//   1. checkInDailyRounds() returns reward:null when today's date is already
//      recorded and leaves streak_count untouched.
//   2. The store commits the post-check-in state before awaiting persistence,
//      so rapid calls cannot increment the streak twice.
//
// These tests reconstruct the store critical-section pattern using the real
// dailyRounds.ts helpers and verify streak/date state plus no local reward for
// rapid concurrent, burst, sequential, and already-checked-in calls.

import {
  DailyRoundsState,
  CheckInResult,
  defaultDailyRoundsState,
  checkInDailyRounds as computeCheckIn,
  ensureFreshDailyRounds,
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
  daily_rounds: DailyRoundsState;
}

function makePlayer(rounds: DailyRoundsState): Player {
  return { id: 'p1', daily_rounds: rounds };
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
    check('PURE: first check-in returns no local reward', r1.reward === null);
    check('PURE: first check-in increments streak to 3', r1.streakDay === 3, `day=${r1.streakDay}`);
    check('PURE: first check-in advances last_checkin_date to today',
      r1.state.last_checkin_date === TODAY, r1.state.last_checkin_date);
    const r2 = computeCheckIn(r1.state, NOW);
    check('PURE: second check-in yields no reward', r2.reward === null, `reward=${JSON.stringify(r2.reward)}`);
    check('PURE: second check-in flagged alreadyCheckedIn', r2.alreadyCheckedIn === true);
    check('PURE: second check-in leaves streak at 3', r2.state.streak_count === 3, `streak=${r2.state.streak_count}`);
  }

  // ── 2. Store critical section: rapid concurrent check-ins ────
  // Normal-increment day — fire two check-ins WITHOUT awaiting between them.
  {
    const store = makeStore(makePlayer(roundsWith({ streak_count: 2, last_checkin_date: YESTERDAY })));
    const [a, b] = await Promise.all([store.checkIn(), store.checkIn()]);
    check('STORE: concurrent check-ins return no local reward',
      [a, b].every((r) => r && r.reward === null));
    check('STORE: concurrent check-in streak incremented once (3)',
      store.player.daily_rounds.streak_count === 3, `streak=${store.player.daily_rounds.streak_count}`);
    check('STORE: concurrent check-in last_checkin_date advanced to today',
      store.player.daily_rounds.last_checkin_date === TODAY, store.player.daily_rounds.last_checkin_date);
  }

  // Normal-increment day — five rapid taps in a burst.
  {
    const store = makeStore(makePlayer(roundsWith({ streak_count: 2, last_checkin_date: YESTERDAY })));
    const burst = await Promise.all(Array.from({ length: 5 }, () => store.checkIn()));
    check('STORE: 5-tap burst returns no local reward',
      burst.every((r) => r && r.reward === null));
    check('STORE: 5-tap burst streak incremented once (3)',
      store.player.daily_rounds.streak_count === 3, `streak=${store.player.daily_rounds.streak_count}`);
  }

  // First-ever check-in (last_checkin_date '') — streak starts at 1, rapid taps.
  {
    const store = makeStore(makePlayer(roundsWith({ streak_count: 0, last_checkin_date: '' })));
    const [a, b, c] = await Promise.all([store.checkIn(), store.checkIn(), store.checkIn()]);
    check('STORE: first-ever check-in returns no local reward',
      [a, b, c].every((r) => r && r.reward === null));
    check('STORE: first-ever check-in streak set to 1',
      store.player.daily_rounds.streak_count === 1, `streak=${store.player.daily_rounds.streak_count}`);
  }

  // Sequential check-ins (check in, then check in again after settle).
  {
    const store = makeStore(makePlayer(roundsWith({ streak_count: 2, last_checkin_date: YESTERDAY })));
    const first = await store.checkIn();
    const second = await store.checkIn();
    check('STORE: sequential first check-in returns no local reward', first && first.reward === null);
    check('STORE: sequential second check-in already-checked-in',
      !!(second && second.alreadyCheckedIn && second.reward === null));
    check('STORE: sequential streak incremented once (3)',
      store.player.daily_rounds.streak_count === 3, `streak=${store.player.daily_rounds.streak_count}`);
  }

  // ── 3. Already-checked-in-today no-op path ──────────────────
  // Player already checked in today — every tap must grant NOTHING and leave
  // the streak untouched.
  {
    const store = makeStore(makePlayer(roundsWith({ streak_count: 4, last_checkin_date: TODAY })));
    const [a, b] = await Promise.all([store.checkIn(), store.checkIn()]);
    check('STORE: already-checked-in returns no reward',
      [a, b].every((r) => r && r.reward === null));
    check('STORE: already-checked-in flags alreadyCheckedIn on every tap',
      [a, b].every((r) => r && r.alreadyCheckedIn === true));
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
