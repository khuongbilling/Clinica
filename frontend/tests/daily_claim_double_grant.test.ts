// Daily Ward Rounds — one-tap CLAIM toast double-grant safety tests.
// Run: npx sucrase-node tests/daily_claim_double_grant.test.ts
//
// The inline CLAIM button on the DailyPulseToast grants a reward directly via
// the store's claimDailyObjective / claimDailyAllComplete / claimWeeklyGoal.
// The toast guards double-taps with a local `claiming` busy flag, but that flag
// is React state that does NOT update synchronously — a genuinely fast double
// tap (or a tap landing as the toast auto-dismisses) can bypass it. The real
// safety net is:
//   1. The pure claim helpers in dailyRounds.ts are idempotent (they mark the
//      objective / bonus claimed and refuse a second claim).
//   2. The store's claim callbacks run a synchronous playerRef critical section
//      (they commit the claimed state to playerRef BEFORE awaiting persistence),
//      so a rapid second invocation reads the already-claimed state.
//
// These tests reconstruct the EXACT store critical-section pattern (using the
// real dailyRounds.ts helpers) and the toast's onClaim decision logic, then
// fire rapid concurrent claims to prove the reward is granted exactly once for
// the single-objective path, the all-complete path, and the weekly path, and
// that the >1-outstanding case falls back to the panel and grants nothing in
// place.

import {
  DailyReward,
  DailyRoundsState,
  DailyObjectiveState,
  defaultDailyRoundsState,
  claimObjectiveReward,
  claimAllCompleteBonus,
  claimWeeklyReward,
  ensureFreshDailyRounds,
  allObjectivesComplete,
  WEEKLY_GOAL_TARGET,
  ALL_COMPLETE_BONUS,
  WEEKLY_GOAL_REWARD,
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

function obj(id: string, reward: DailyReward, complete = true): DailyObjectiveState {
  return {
    id,
    mode: 'ward_shift',
    event: 'ward_shift_win',
    target: 2,
    progress: complete ? 2 : 0,
    claimed: false,
    label: id,
    description: '',
    icon: 'medkit',
    reward,
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

type ClaimReturn = { ok: boolean; message: string; reward?: DailyReward };

// Faithful reconstruction of the store's claim callbacks. The key property under
// test is the SYNCHRONOUS playerRef commit before the awaited persistence: this
// is what makes a rapid second call observe the already-claimed state.
function makeStore(initial: Player) {
  let playerRef: Player = initial;
  let persistCount = 0;

  // Simulated async persistence (like updateState -> AsyncStorage/network).
  // Crucially — mirroring the real store — this does NOT touch playerRef; the
  // ref is committed synchronously in the claim callbacks BEFORE this await.
  // The await here is exactly where a naive implementation would be vulnerable
  // if it committed the ref AFTER awaiting instead of before.
  const updateState = async (_next: Player) => {
    persistCount += 1;
    await Promise.resolve();
  };

  const claimDailyObjective = async (objectiveId: string): Promise<ClaimReturn> => {
    const base = playerRef;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const fresh = ensureFreshDailyRounds(base.daily_rounds, [], base.id).state;
    const res = claimObjectiveReward(fresh, objectiveId);
    if (!res.reward) return { ok: false, message: res.message };
    const next = addDailyReward({ ...base, daily_rounds: res.state }, res.reward);
    playerRef = next; // commit synchronously BEFORE awaiting persistence
    await updateState(next);
    return { ok: true, message: res.message, reward: res.reward };
  };

  const claimDailyAllComplete = async (): Promise<ClaimReturn> => {
    const base = playerRef;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const fresh = ensureFreshDailyRounds(base.daily_rounds, [], base.id).state;
    const res = claimAllCompleteBonus(fresh);
    if (!res.reward) return { ok: false, message: res.message };
    const next = addDailyReward({ ...base, daily_rounds: res.state }, res.reward);
    playerRef = next;
    await updateState(next);
    return { ok: true, message: res.message, reward: res.reward };
  };

  const claimWeeklyGoal = async (): Promise<ClaimReturn> => {
    const base = playerRef;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const fresh = ensureFreshDailyRounds(base.daily_rounds, [], base.id).state;
    const res = claimWeeklyReward(fresh);
    if (!res.reward) return { ok: false, message: res.message };
    const next = addDailyReward({ ...base, daily_rounds: res.state }, res.reward);
    playerRef = next;
    await updateState(next);
    return { ok: true, message: res.message, reward: res.reward };
  };

  return {
    claimDailyObjective,
    claimDailyAllComplete,
    claimWeeklyGoal,
    get player() { return playerRef; },
    get persistCount() { return persistCount; },
  };
}

// ─────────────────────────────────────────────────────────────
// Toast onClaim reconstruction (mirrors DailyPulseToast.tsx)
// ─────────────────────────────────────────────────────────────
type Claimable = { kind: 'objective'; id: string } | { kind: 'all' } | { kind: 'weekly' };

// Mirrors claimableItems() in the toast component.
function claimableItems(player: Player | null): Claimable[] {
  if (!player) return [];
  const state = ensureFreshDailyRounds(player.daily_rounds, [], player.id).state;
  const items: Claimable[] = [];
  for (const o of state.objectives) {
    if (o.progress >= o.target && !o.claimed) items.push({ kind: 'objective', id: o.id });
  }
  if (allObjectivesComplete(state) && !state.all_complete_claimed) items.push({ kind: 'all' });
  if (state.weekly_days_completed >= WEEKLY_GOAL_TARGET && !state.weekly_claimed) items.push({ kind: 'weekly' });
  return items;
}

// Mirrors the toast's onClaim: single outstanding reward -> in-place claim;
// more than one -> fall back to the panel (grants nothing in place).
//
// Two React-closure realities are modelled to reproduce the WORST case of a
// genuine fast double tap, and prove the store is still safe:
//   • `claiming` is a captured (stale) value — React's setClaiming(true) does
//     not update the closure synchronously, so both taps can see it false.
//   • `claimableItems(player)` reads the STALE captured `player` prop (not the
//     live ref), so both taps can target the SAME already-being-claimed reward.
// The safety therefore rests entirely on the store's synchronous ref critical
// section + the idempotent dailyRounds.ts helpers, which is what we assert.
function makeOnClaim(store: ReturnType<typeof makeStore>) {
  let panelOpens = 0;
  const onClaim = async (playerSnapshot: Player | null, claimingCaptured: boolean): Promise<void> => {
    if (claimingCaptured) return;
    const items = claimableItems(playerSnapshot);
    if (items.length === 0) return; // dismiss()
    const only = items[0];
    if (items.length > 1) { panelOpens += 1; return; } // openPanel()
    const res = only.kind === 'weekly'
      ? await store.claimWeeklyGoal()
      : only.kind === 'all'
      ? await store.claimDailyAllComplete()
      : await store.claimDailyObjective(only.id);
    if (!res.ok) { panelOpens += 1; } // openPanel() on failure
  };
  return { onClaim, get panelOpens() { return panelOpens; } };
}

async function run() {
  // ── 1. Pure helper idempotency ──────────────────────────────
  {
    const state = roundsWith({ objectives: [obj('obj_a', { crowns: 80, codexShards: 10 })] });
    const r1 = claimObjectiveReward(state, 'obj_a');
    check('PURE: first objective claim returns reward', !!r1.reward && r1.reward.crowns === 80);
    const r2 = claimObjectiveReward(r1.state, 'obj_a');
    check('PURE: second objective claim yields no reward', r2.reward === null, r2.message);
    check('PURE: objective marked claimed', r1.state.objectives[0].claimed === true);
  }
  {
    const state = roundsWith({
      objectives: [obj('a', { crowns: 1 }), obj('b', { crowns: 1 }), obj('c', { crowns: 1 })],
      all_complete_claimed: false,
    });
    const r1 = claimAllCompleteBonus(state);
    check('PURE: first all-complete claim returns bonus', !!r1.reward);
    const r2 = claimAllCompleteBonus(r1.state);
    check('PURE: second all-complete claim yields no reward', r2.reward === null, r2.message);
  }
  {
    const state = roundsWith({ weekly_days_completed: WEEKLY_GOAL_TARGET, weekly_claimed: false });
    const r1 = claimWeeklyReward(state);
    check('PURE: first weekly claim returns reward', !!r1.reward);
    const r2 = claimWeeklyReward(r1.state);
    check('PURE: second weekly claim yields no reward', r2.reward === null, r2.message);
  }

  // ── 2. Store critical section: rapid concurrent claims ──────
  // Single objective — fire two claims WITHOUT awaiting between them.
  {
    const store = makeStore(makePlayer(roundsWith({
      objectives: [obj('obj_a', { crowns: 80, codexShards: 10 })],
    })));
    const [a, b] = await Promise.all([
      store.claimDailyObjective('obj_a'),
      store.claimDailyObjective('obj_a'),
    ]);
    const oks = [a, b].filter((r) => r.ok).length;
    check('STORE: concurrent objective claim succeeds exactly once', oks === 1, `oks=${oks}`);
    check('STORE: objective crowns credited exactly once', store.player.crowns === 80, `crowns=${store.player.crowns}`);
    check('STORE: objective codex shards credited exactly once', store.player.codex_shards === 10, `shards=${store.player.codex_shards}`);
    check('STORE: objective is claimed in final state', store.player.daily_rounds.objectives[0].claimed === true);
  }

  // Single objective — five rapid taps in a burst.
  {
    const store = makeStore(makePlayer(roundsWith({
      objectives: [obj('obj_a', { crowns: 80, codexShards: 10 })],
    })));
    const burst = await Promise.all(
      Array.from({ length: 5 }, () => store.claimDailyObjective('obj_a')),
    );
    const oks = burst.filter((r) => r.ok).length;
    check('STORE: 5-tap burst grants objective exactly once', oks === 1, `oks=${oks}`);
    check('STORE: 5-tap burst crowns credited once', store.player.crowns === 80, `crowns=${store.player.crowns}`);
  }

  // Single objective — sequential taps (claim, then claim again after settle).
  {
    const store = makeStore(makePlayer(roundsWith({
      objectives: [obj('obj_a', { crowns: 80, codexShards: 10 })],
    })));
    const first = await store.claimDailyObjective('obj_a');
    const second = await store.claimDailyObjective('obj_a');
    check('STORE: sequential re-claim first ok', first.ok === true);
    check('STORE: sequential re-claim second refused', second.ok === false, second.message);
    check('STORE: sequential crowns credited once', store.player.crowns === 80, `crowns=${store.player.crowns}`);
  }

  // All-complete bonus — rapid concurrent claims.
  {
    const store = makeStore(makePlayer(roundsWith({
      objectives: [obj('a', { crowns: 1 }), obj('b', { crowns: 1 }), obj('c', { crowns: 1 })],
      all_complete_claimed: false,
    })));
    const [a, b, c] = await Promise.all([
      store.claimDailyAllComplete(),
      store.claimDailyAllComplete(),
      store.claimDailyAllComplete(),
    ]);
    const oks = [a, b, c].filter((r) => r.ok).length;
    check('STORE: concurrent all-complete claim succeeds exactly once', oks === 1, `oks=${oks}`);
    check('STORE: all-complete bonus crowns credited once',
      store.player.crowns === ALL_COMPLETE_BONUS.crowns, `crowns=${store.player.crowns}`);
    check('STORE: all-complete insight crystals credited once',
      store.player.insight_crystals === (ALL_COMPLETE_BONUS.insightCrystals || 0),
      `crystals=${store.player.insight_crystals}`);
    check('STORE: all_complete_claimed flag set', store.player.daily_rounds.all_complete_claimed === true);
  }

  // Weekly goal — rapid concurrent claims.
  {
    const store = makeStore(makePlayer(roundsWith({
      weekly_days_completed: WEEKLY_GOAL_TARGET,
      weekly_claimed: false,
    })));
    const [a, b] = await Promise.all([
      store.claimWeeklyGoal(),
      store.claimWeeklyGoal(),
    ]);
    const oks = [a, b].filter((r) => r.ok).length;
    check('STORE: concurrent weekly claim succeeds exactly once', oks === 1, `oks=${oks}`);
    check('STORE: weekly crowns credited once',
      store.player.crowns === WEEKLY_GOAL_REWARD.crowns, `crowns=${store.player.crowns}`);
    check('STORE: weekly_claimed flag set', store.player.daily_rounds.weekly_claimed === true);
  }

  // ── 3. Toast onClaim decision logic ────────────────────────
  // Single outstanding reward — rapid double tap where BOTH taps see the stale
  // claiming=false busy flag AND the stale captured player snapshot (so both
  // target the same objective id). Must still grant exactly once; the losing
  // tap's store call returns ok:false and falls back to the panel.
  // (all_complete_claimed is pre-set so the single completed objective does not
  // ALSO expose the distinct all-complete bonus and confuse the assertion.)
  {
    const store = makeStore(makePlayer(roundsWith({
      objectives: [obj('obj_a', { crowns: 80, codexShards: 10 })],
      all_complete_claimed: true,
    })));
    const snap = store.player; // stale captured React player, shared by both taps
    const toast = makeOnClaim(store);
    await Promise.all([toast.onClaim(snap, false), toast.onClaim(snap, false)]);
    check('TOAST: double-tap (stale snapshot + busy flag) grants objective once',
      store.player.crowns === 80, `crowns=${store.player.crowns}`);
    check('TOAST: double-tap credits codex shards once', store.player.codex_shards === 10,
      `shards=${store.player.codex_shards}`);
    // The losing tap's claim returns ok:false -> falls back to opening panel.
    check('TOAST: losing tap falls back to panel', toast.panelOpens === 1, `panelOpens=${toast.panelOpens}`);
  }

  // Single all-complete outstanding (all objectives already individually
  // claimed) — double tap on the stale snapshot grants the bonus exactly once.
  {
    const store = makeStore(makePlayer(roundsWith({
      objectives: [
        obj('a', { crowns: 1 }), obj('b', { crowns: 1 }), obj('c', { crowns: 1 }),
      ].map((o) => ({ ...o, claimed: true })),
      all_complete_claimed: false,
    })));
    const snap = store.player;
    const toast = makeOnClaim(store);
    await Promise.all([toast.onClaim(snap, false), toast.onClaim(snap, false)]);
    check('TOAST: double-tap grants all-complete bonus once',
      store.player.crowns === ALL_COMPLETE_BONUS.crowns, `crowns=${store.player.crowns}`);
    check('TOAST: all-complete losing tap falls back to panel', toast.panelOpens === 1,
      `panelOpens=${toast.panelOpens}`);
  }

  // More than one reward outstanding — onClaim must fall back to the panel and
  // grant NOTHING in place, even under rapid taps.
  {
    const store = makeStore(makePlayer(roundsWith({
      objectives: [
        obj('obj_a', { crowns: 80 }),
        obj('obj_b', { crowns: 70 }),
        obj('obj_c', { crowns: 60 }),
      ],
      all_complete_claimed: false,
    })));
    const snap = store.player;
    // 3 unclaimed complete objectives + the all-complete bonus => 4 items.
    check('TOAST: fixture has multiple claimables', claimableItems(snap).length > 1,
      `len=${claimableItems(snap).length}`);
    const toast = makeOnClaim(store);
    await Promise.all([toast.onClaim(snap, false), toast.onClaim(snap, false)]);
    check('TOAST: multi-outstanding grants nothing in place', store.player.crowns === 0,
      `crowns=${store.player.crowns}`);
    check('TOAST: multi-outstanding falls back to panel on both taps', toast.panelOpens === 2,
      `panelOpens=${toast.panelOpens}`);
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
