/**
 * objectiveProgress.test.ts — Step 7 unblock regression
 *
 * Confirms that a player who already has `runs_completed > 0` sees
 * `obj_university_arrived` back-filled automatically by
 * `reconcileEarlyObjectives`, without needing to delete and reinstall the app.
 *
 * Run: npx sucrase-node src/game/objectiveProgress.test.ts
 *      (from the frontend/ directory)
 */

// ── In-memory AsyncStorage mock ────────────────────────────────────────────
// Must be created BEFORE the module under test is loaded, so both
// objectiveProgress.ts and its chainProgress.ts dependency pick up the mock.

const _store = new Map<string, string>();
const _mockAsyncStorage = {
  getItem:    async (key: string)               => _store.get(key) ?? null,
  setItem:    async (key: string, val: string)  => { _store.set(key, val); },
  removeItem: async (key: string)               => { _store.delete(key); },
};

// Intercept Node's module loader so every require('@react-native-async-storage/async-storage')
// returns our in-memory mock.  This covers both objectiveProgress.ts and chainProgress.ts.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _Module = require('module');
const _origLoad = _Module._load.bind(_Module);
_Module._load = function (id: string, parent: unknown, isMain: boolean) {
  if (id === '@react-native-async-storage/async-storage') {
    // sucrase compiles `import AsyncStorage from '...'` → accesses .default
    return Object.assign(_mockAsyncStorage, { default: _mockAsyncStorage, __esModule: true });
  }
  return _origLoad(id, parent, isMain);
};

// Load the module under test AFTER the hook is in place.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { reconcileEarlyObjectives } =
  require('./objectiveProgress') as typeof import('./objectiveProgress');

// ── Tiny test harness ─────────────────────────────────────────────────────
type Result = { name: string; pass: boolean; details: string };
const results: Result[] = [];

function check(name: string, cond: boolean, details = ''): void {
  results.push({ name, pass: cond, details });
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${cond ? '' : ` :: ${details}`}`);
}

// ── Tests ─────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  // ── Test 1: Step 7 backfill ──────────────────────────────────────────────
  // Starting from an empty objective record, a player who has already
  // completed at least one Ward Shift run (`runs_completed: 1`) must have
  // `obj_university_arrived` back-filled in the `newly` array.
  {
    _store.clear(); // ensure a clean slate (empty objective record)

    const newly = await reconcileEarlyObjectives({
      runs_completed: 1,
      lessons_completed: [],
    });

    check(
      'Step 7 backfill: obj_university_arrived is newly written',
      newly.includes('obj_university_arrived'),
      `newly=${JSON.stringify(newly)}`,
    );

    // runs_completed > 0 also implies step 12 (first Ward Shift) is done.
    check(
      'Step 12 backfill: obj_ward_shift_first is newly written',
      newly.includes('obj_ward_shift_first'),
      `newly=${JSON.stringify(newly)}`,
    );
  }

  // ── Test 2: Idempotency ──────────────────────────────────────────────────
  // Calling reconcileEarlyObjectives a second time with the same player state
  // (while the storage already reflects the first call's writes) must return
  // an empty `newly` array — no duplicate writes.
  {
    const newly2 = await reconcileEarlyObjectives({
      runs_completed: 1,
      lessons_completed: [],
    });

    check(
      'Idempotent: second call returns empty newly array',
      newly2.length === 0,
      `newly2=${JSON.stringify(newly2)}`,
    );
  }

  // ── Test 3: No false positives on a fresh player ─────────────────────────
  // A brand-new player with no flags set should not have any objectives
  // back-filled by this path (they haven't reached step 7 yet).
  {
    _store.clear();

    const newlyFresh = await reconcileEarlyObjectives({
      runs_completed: 0,
      lessons_completed: [],
    });

    check(
      'Fresh player: obj_university_arrived is NOT back-filled',
      !newlyFresh.includes('obj_university_arrived'),
      `newlyFresh=${JSON.stringify(newlyFresh)}`,
    );
  }

  // ── Test 4: Lotus-lesson path also unblocks step 7 ───────────────────────
  // A player who completed a lotus lesson (but no runs) still passes through
  // University, so step 7 must also be back-filled via that path.
  {
    _store.clear();

    const newlyLotus = await reconcileEarlyObjectives({
      runs_completed: 0,
      lessons_completed: ['lotus:hydration_basics'],
    });

    check(
      'Lotus-lesson path: obj_university_arrived is newly written',
      newlyLotus.includes('obj_university_arrived'),
      `newlyLotus=${JSON.stringify(newlyLotus)}`,
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.pass);
  console.log(`\n========== SUMMARY ==========`);
  console.log(`Total: ${results.length}  Passed: ${results.length - failed.length}  Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log('\nFailing tests:');
    failed.forEach((f) => console.log(`  - ${f.name} :: ${f.details}`));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
