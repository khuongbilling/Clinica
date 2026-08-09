// Tutorial-state & learner-profile normalization tests
// Run: npx sucrase-node tests/tutorial_state.test.ts

import { normalizeProfileId, PROFILE_ID_COMPAT } from '../src/game/onboarding';
import { getExplanationLayer } from '../src/game/explanationLayers';

// ── Test harness ──────────────────────────────────────────────────────────────
type Result = { name: string; pass: boolean; details?: string };
const results: Result[] = [];

function check(name: string, cond: boolean, details = '') {
  results.push({ name, pass: !!cond, details });
  console.log(`${cond ? 'PASS' : 'FAIL'} – ${name}${cond ? '' : ` :: ${details}`}`);
}

// ── Minimal tutorial state machine (pure, no React) ──────────────────────────
// Mirrors the behaviour of tutorialStore.tsx so lifecycle rules can be tested
// without spinning up a React context.

interface TutorialState {
  completed: Record<string, boolean>;
  dismissed: Record<string, boolean>;
  active: string | null;
  step: number;
}

function makeTutorialState(): TutorialState {
  return { completed: {}, dismissed: {}, active: null, step: 0 };
}

function startTutorial(s: TutorialState, id: string, totalSteps: number): TutorialState {
  if (s.active) return s;                   // already running
  if (s.completed[id]) return s;            // already done
  if (s.dismissed[id]) return s;            // dismissed mid-flow
  return { ...s, active: id, step: 0 };
}

function advanceStep(s: TutorialState, totalSteps: number): TutorialState {
  if (!s.active) return s;
  const next = s.step + 1;
  if (next >= totalSteps) {
    // final step → mark complete
    return {
      ...s,
      completed: { ...s.completed, [s.active]: true },
      dismissed: { ...s.dismissed, [s.active]: false },
      active: null,
      step: 0,
    };
  }
  return { ...s, step: next };
}

function skipTutorial(s: TutorialState): TutorialState {
  if (!s.active) return s;
  return {
    ...s,
    completed: { ...s.completed, [s.active]: true },
    active: null,
    step: 0,
  };
}

function clearActiveTutorial(s: TutorialState): TutorialState {
  if (!s.active) return s;
  return {
    ...s,
    dismissed: { ...s.dismissed, [s.active]: true },
    active: null,
    step: 0,
  };
}

function replayTutorial(s: TutorialState, id: string): TutorialState {
  return {
    ...s,
    completed: { ...s.completed, [id]: false },
    dismissed: { ...s.dismissed, [id]: false },
    active: id,
    step: 0,
  };
}

function resetTutorials(s: TutorialState): TutorialState {
  return { completed: {}, dismissed: {}, active: null, step: 0 };
}

const TOTAL_STEPS = 3; // representative step count for tests

// ─────────────────────────────────────────────────────────────────────────────
// T-1  Complete: advancing through all steps marks complete, clears active
// ─────────────────────────────────────────────────────────────────────────────
{
  let s = makeTutorialState();
  s = startTutorial(s, 'systemHubIntro', TOTAL_STEPS);
  check('T-1a  startTutorial sets active', s.active === 'systemHubIntro', `active=${s.active}`);
  s = advanceStep(s, TOTAL_STEPS); // step 0 → 1
  s = advanceStep(s, TOTAL_STEPS); // step 1 → 2
  s = advanceStep(s, TOTAL_STEPS); // step 2 → done
  check('T-1b  complete sets completed[id]=true', s.completed['systemHubIntro'] === true, `completed=${s.completed['systemHubIntro']}`);
  check('T-1c  complete clears active', s.active === null, `active=${s.active}`);
  check('T-1d  complete resets step to 0', s.step === 0, `step=${s.step}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// T-2  Skip: marks complete without advancing through all steps
// ─────────────────────────────────────────────────────────────────────────────
{
  let s = makeTutorialState();
  s = startTutorial(s, 'firstSummon', TOTAL_STEPS);
  s = skipTutorial(s);
  check('T-2a  skip marks completed', s.completed['firstSummon'] === true, `completed=${s.completed['firstSummon']}`);
  check('T-2b  skip clears active', s.active === null, `active=${s.active}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// T-3  Leave mid-tutorial (navigate away): dismissed=true, NOT completed
// ─────────────────────────────────────────────────────────────────────────────
{
  let s = makeTutorialState();
  s = startTutorial(s, 'prologueBattle', TOTAL_STEPS);
  s = advanceStep(s, TOTAL_STEPS); // one step in
  s = clearActiveTutorial(s);      // player navigates away
  check('T-3a  dismissed[id]=true after leave-mid', s.dismissed['prologueBattle'] === true, `dismissed=${s.dismissed['prologueBattle']}`);
  check('T-3b  completed[id] NOT true after leave-mid', !s.completed['prologueBattle'], `completed=${s.completed['prologueBattle']}`);
  check('T-3c  active cleared after leave-mid', s.active === null, `active=${s.active}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// T-4  Re-enter after dismissal: startTutorial is blocked; does not auto-restart
// ─────────────────────────────────────────────────────────────────────────────
{
  let s = makeTutorialState();
  s = startTutorial(s, 'firstBattle', TOTAL_STEPS);
  s = clearActiveTutorial(s);   // dismissed
  const before = s;
  s = startTutorial(s, 'firstBattle', TOTAL_STEPS); // should be blocked
  check('T-4  re-enter after dismissal is blocked', s.active === null && s === before, `active=${s.active}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// T-5  Replay: clears completed+dismissed, forces active from step 0
// ─────────────────────────────────────────────────────────────────────────────
{
  let s = makeTutorialState();
  s = startTutorial(s, 'firstSummon', TOTAL_STEPS);
  s = skipTutorial(s); // completed
  check('T-5-pre  tutorial completed before replay', s.completed['firstSummon'] === true);
  s = replayTutorial(s, 'firstSummon');
  check('T-5a  replay clears completed', s.completed['firstSummon'] === false, `completed=${s.completed['firstSummon']}`);
  check('T-5b  replay clears dismissed', s.dismissed['firstSummon'] === false, `dismissed=${s.dismissed['firstSummon']}`);
  check('T-5c  replay sets active', s.active === 'firstSummon', `active=${s.active}`);
  check('T-5d  replay starts at step 0', s.step === 0, `step=${s.step}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// T-6  Replay after dismissal: clears dismissed flag, forces active
// ─────────────────────────────────────────────────────────────────────────────
{
  let s = makeTutorialState();
  s = startTutorial(s, 'clinicalCueIntro', TOTAL_STEPS);
  s = clearActiveTutorial(s); // dismissed
  check('T-6-pre  dismissed before replay', s.dismissed['clinicalCueIntro'] === true);
  s = replayTutorial(s, 'clinicalCueIntro');
  check('T-6a  replay clears dismissed', s.dismissed['clinicalCueIntro'] === false, `dismissed=${s.dismissed['clinicalCueIntro']}`);
  check('T-6b  replay sets active', s.active === 'clinicalCueIntro', `active=${s.active}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// T-7  resetTutorials: wipes all state
// ─────────────────────────────────────────────────────────────────────────────
{
  let s = makeTutorialState();
  s = startTutorial(s, 'firstBattle', TOTAL_STEPS);
  s = skipTutorial(s);
  s = startTutorial(s, 'systemHubIntro', TOTAL_STEPS);
  s = clearActiveTutorial(s);
  s = resetTutorials(s);
  check('T-7a  resetTutorials clears completed map', Object.keys(s.completed).length === 0, `keys=${Object.keys(s.completed)}`);
  check('T-7b  resetTutorials clears dismissed map', Object.keys(s.dismissed).length === 0, `keys=${Object.keys(s.dismissed)}`);
  check('T-7c  resetTutorials clears active', s.active === null, `active=${s.active}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// T-8  prologueBattle force-replay: replayTutorial always runs regardless of
//      completed/dismissed state (mirrors isPrologueTutorial=true on mount)
// ─────────────────────────────────────────────────────────────────────────────
{
  let s = makeTutorialState();
  // Simulate a player who already completed prologueBattle
  s = startTutorial(s, 'prologueBattle', TOTAL_STEPS);
  s = advanceStep(s, TOTAL_STEPS);
  s = advanceStep(s, TOTAL_STEPS);
  s = advanceStep(s, TOTAL_STEPS); // completed
  check('T-8-pre  prologueBattle completed', s.completed['prologueBattle'] === true);
  // On prologue mount the battle screen always calls replayTutorial
  s = replayTutorial(s, 'prologueBattle');
  check('T-8a  force-replay ignores completed flag', s.active === 'prologueBattle', `active=${s.active}`);
  check('T-8b  force-replay starts at step 0', s.step === 0, `step=${s.step}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// T-9  systemHubIntro hub-effect logic: startTutorial fires for ALL eligible
//      players regardless of chapter_progress. This mirrors the fixed
//      useEffect in frontend/app/(tabs)/index.tsx.
//
//      Before the fix the effect had:
//        if (chapterProgress >= 2) { markDone("systemHubIntro"); return; }
//      which permanently locked out the tutorial without showing it.
//      The fix removes that branch entirely. We test three representative cases.
// ─────────────────────────────────────────────────────────────────────────────
{
  // Helper: simulate the hub effect for a given player configuration.
  // Returns the state after the effect runs (mirrors index.tsx useEffect body).
  function simulateHubEffect(params: {
    seenReminiscence: boolean;
    systemHubIntroCompleted: boolean;
    // chapter_progress deliberately absent — the fixed effect no longer
    // inspects it; callers can pass any value and it must not change behaviour.
    chapterProgress: number;
  }): TutorialState {
    let s = makeTutorialState();
    // Pre-seed completed state to match the incoming flag.
    if (params.systemHubIntroCompleted) {
      s = { ...s, completed: { ...s.completed, systemHubIntro: true } };
    }

    // Fixed effect body — no chapterProgress branch:
    //   if (!player.seen_reminiscence) return;
    //   if (isCompleted("systemHubIntro")) return;
    //   startTutorial("systemHubIntro");
    if (!params.seenReminiscence) return s;
    if (params.systemHubIntroCompleted) return s;
    // The 700 ms setTimeout calls startTutorial synchronously in our sim.
    s = startTutorial(s, 'systemHubIntro', TOTAL_STEPS);
    return s;
  }

  // Case A: brand-new player on Chapter 1 — tutorial fires.
  {
    const s = simulateHubEffect({ seenReminiscence: true, systemHubIntroCompleted: false, chapterProgress: 1 });
    check('T-9a  ch1 player: startTutorial fires', s.active === 'systemHubIntro', `active=${s.active}`);
  }

  // Case B: progressed player on Chapter 3 — tutorial ALSO fires (was blocked before fix).
  {
    const s = simulateHubEffect({ seenReminiscence: true, systemHubIntroCompleted: false, chapterProgress: 3 });
    check('T-9b  ch3 player: startTutorial fires (post-fix)', s.active === 'systemHubIntro', `active=${s.active}`);
    check('T-9c  ch3 player: tutorial NOT silently completed', !s.completed['systemHubIntro'], `completed=${s.completed['systemHubIntro']}`);
  }

  // Case C: player who already completed it — effect returns early, active stays null.
  {
    const s = simulateHubEffect({ seenReminiscence: true, systemHubIntroCompleted: true, chapterProgress: 5 });
    check('T-9d  completed player: effect is a no-op', s.active === null, `active=${s.active}`);
  }

  // Case D: player without seen_reminiscence — effect returns early.
  {
    const s = simulateHubEffect({ seenReminiscence: false, systemHubIntroCompleted: false, chapterProgress: 0 });
    check('T-9e  no seen_reminiscence: effect is a no-op', s.active === null, `active=${s.active}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// P-1  normalizeProfileId: all legacy aliases map to canonical IDs
// ─────────────────────────────────────────────────────────────────────────────
{
  const cases: [string, string][] = [
    // curious aliases
    ['nonmedical',            'curious'],
    ['rpg',                   'curious'],
    ['cozy',                  'curious'],
    ['teen',                  'curious'],
    // nursing_student aliases
    ['nursingStudent',        'nursing_student'],
    ['preNursing',            'nursing_student'],
    ['medical_learner',       'nursing_student'],
    // nclex aliases
    ['nclexPrep',             'nclex'],
    // professional aliases
    ['healthcareProfessional','professional'],
    // canonical IDs pass through unchanged
    ['curious',               'curious'],
    ['nursing_student',       'nursing_student'],
    ['nclex',                 'nclex'],
    ['professional',          'professional'],
  ];

  for (const [input, expected] of cases) {
    const got = normalizeProfileId(input);
    check(
      `P-1  normalizeProfileId("${input}") → "${expected}"`,
      got === expected,
      `got="${got}"`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// P-2  normalizeProfileId: null / undefined pass through safely
// ─────────────────────────────────────────────────────────────────────────────
{
  check('P-2a  normalizeProfileId(null) returns null',      normalizeProfileId(null) === null);
  check('P-2b  normalizeProfileId(undefined) returns undefined', normalizeProfileId(undefined) === undefined);
  check('P-2c  normalizeProfileId("") returns ""',          normalizeProfileId('') === '');
}

// ─────────────────────────────────────────────────────────────────────────────
// P-3  nursing_student normalization: getExplanationLayer returns 'nursing'
//      (Practiced tier, standard depth, no novice handicap)
// ─────────────────────────────────────────────────────────────────────────────
{
  const nursingAliases = ['nursing_student', 'nursingStudent', 'preNursing', 'medical_learner'];
  for (const alias of nursingAliases) {
    const layer = getExplanationLayer(alias);
    check(
      `P-3  getExplanationLayer("${alias}") → "nursing" (Practiced tier)`,
      layer === 'nursing',
      `got="${layer}"`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// P-4  getExplanationLayer: full canonical-and-legacy coverage
// ─────────────────────────────────────────────────────────────────────────────
{
  // After normalization:
  //   preNursing      → nursing_student → nursing
  //   medical_learner → nursing_student → nursing
  //   (both now get the Practiced / clinical tier, not simpleMedical)
  const layerCases: [string, string][] = [
    ['curious',              'fantasy'],
    ['nonmedical',           'fantasy'],
    ['rpg',                  'fantasy'],
    ['cozy',                 'fantasy'],
    ['teen',                 'fantasy'],
    ['medical_learner',      'nursing'],   // normalizes nursing_student → nursing
    ['nursing_student',      'nursing'],
    ['nursingStudent',       'nursing'],
    ['preNursing',           'nursing'],   // normalizes nursing_student → nursing
    ['nclex',                'nclex'],
    ['nclexPrep',            'nclex'],
    ['professional',         'professional'],
    ['healthcareProfessional','professional'],
  ];

  for (const [input, expected] of layerCases) {
    const got = getExplanationLayer(input);
    check(
      `P-4  getExplanationLayer("${input}") → "${expected}"`,
      got === expected,
      `got="${got}"`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// P-5  applyClassDiagnostic normalization: legacy profile IDs are canonicalized
//      before being stored (mirrors the Task 375 fix in store.tsx)
// ─────────────────────────────────────────────────────────────────────────────
{
  // Simulate the normalisation that applyClassDiagnostic now performs.
  // The real action lives in store.tsx but the pure logic is just
  // normalizeProfileId, which we can exercise directly.
  const diagnosticCases: [string, string][] = [
    // Legacy aliases that the post-recall class flow could previously write
    ['nursingStudent',        'nursing_student'],
    ['nclexPrep',             'nclex'],
    ['healthcareProfessional','professional'],
    ['nonmedical',            'curious'],
    ['preNursing',            'nursing_student'],
    // Canonical IDs already pass through unchanged
    ['nursing_student',       'nursing_student'],
    ['nclex',                 'nclex'],
    ['professional',          'professional'],
    ['curious',               'curious'],
  ];

  for (const [input, expected] of diagnosticCases) {
    // Reproduce the exact guard from the fixed applyClassDiagnostic:
    //   const canonicalProfile = input
    //     ? (normalizeProfileId(input) ?? input)
    //     : input;
    const canonicalProfile = input
      ? (normalizeProfileId(input) ?? input)
      : input;
    check(
      `P-5  applyClassDiagnostic normalizes "${input}" → "${expected}"`,
      canonicalProfile === expected,
      `got="${canonicalProfile}"`,
    );
  }

  // Null / undefined pass through safely (no crash when profile is absent)
  const nullResult   = normalizeProfileId(null);
  const undefResult  = normalizeProfileId(undefined);
  check('P-5  applyClassDiagnostic: null profile is safe',      nullResult === null);
  check('P-5  applyClassDiagnostic: undefined profile is safe', undefResult === undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// FQ — Force-quit recovery: hydration dismisses stale battle tutorial IDs
//      Mirrors the boot-time logic added to tutorialStore.tsx's useEffect.
//      ACTIVE_KEY is written by startTutorial and cleared by every normal exit
//      (markDone / skipTutorial / clearActiveTutorial / replayTutorial).  If
//      the app is force-quit while a battle tutorial is active, ACTIVE_KEY
//      still names it on next boot; hydration must dismiss it so hub screens
//      are never blocked.
// ─────────────────────────────────────────────────────────────────────────────
{
  // Pure simulation of the tutorialStore hydration guard.
  const BATTLE_TUTORIAL_IDS = new Set(['prologueBattle', 'firstBattle', 'clinicalCueIntro']);

  type HydrateInput = {
    completed: Record<string, boolean>;
    dismissed: Record<string, boolean>;
    storedActiveId: string | null;
  };
  type HydrateOutput = {
    dismissed: Record<string, boolean>;
    activeKeyCleared: boolean;
  };

  function simulateHydration({ completed, dismissed, storedActiveId }: HydrateInput): HydrateOutput {
    let dPatched = { ...dismissed };
    let activeKeyCleared = false;

    if (
      storedActiveId &&
      BATTLE_TUTORIAL_IDS.has(storedActiveId) &&
      !completed[storedActiveId] &&
      !dismissed[storedActiveId]
    ) {
      // Force-quit during a battle tutorial → auto-dismiss
      dPatched = { ...dPatched, [storedActiveId]: true };
      activeKeyCleared = true;
    } else if (storedActiveId && (completed[storedActiveId] || dismissed[storedActiveId])) {
      // Orphaned marker for an already-finished tutorial → just clean up
      activeKeyCleared = true;
    }

    return { dismissed: dPatched, activeKeyCleared };
  }

  // FQ-1  Force-quit during prologueBattle → auto-dismissed
  {
    const { dismissed, activeKeyCleared } = simulateHydration({
      completed: {},
      dismissed: {},
      storedActiveId: 'prologueBattle',
    });
    check('FQ-1a  prologueBattle force-quit: auto-dismissed', dismissed['prologueBattle'] === true, `dismissed=${dismissed['prologueBattle']}`);
    check('FQ-1b  prologueBattle force-quit: ACTIVE_KEY cleared', activeKeyCleared === true);
  }

  // FQ-2  Force-quit during firstBattle → auto-dismissed
  {
    const { dismissed, activeKeyCleared } = simulateHydration({
      completed: {},
      dismissed: {},
      storedActiveId: 'firstBattle',
    });
    check('FQ-2a  firstBattle force-quit: auto-dismissed', dismissed['firstBattle'] === true, `dismissed=${dismissed['firstBattle']}`);
    check('FQ-2b  firstBattle force-quit: ACTIVE_KEY cleared', activeKeyCleared === true);
  }

  // FQ-3  Force-quit during clinicalCueIntro → auto-dismissed
  {
    const { dismissed, activeKeyCleared } = simulateHydration({
      completed: {},
      dismissed: {},
      storedActiveId: 'clinicalCueIntro',
    });
    check('FQ-3a  clinicalCueIntro force-quit: auto-dismissed', dismissed['clinicalCueIntro'] === true, `dismissed=${dismissed['clinicalCueIntro']}`);
    check('FQ-3b  clinicalCueIntro force-quit: ACTIVE_KEY cleared', activeKeyCleared === true);
  }

  // FQ-4  Force-quit during a non-battle tutorial → NOT auto-dismissed
  {
    const { dismissed, activeKeyCleared } = simulateHydration({
      completed: {},
      dismissed: {},
      storedActiveId: 'systemHubIntro',
    });
    check('FQ-4a  systemHubIntro force-quit: NOT auto-dismissed', !dismissed['systemHubIntro'], `dismissed=${dismissed['systemHubIntro']}`);
    check('FQ-4b  systemHubIntro force-quit: ACTIVE_KEY NOT cleared', activeKeyCleared === false);
  }

  // FQ-5  Fresh install (no stored active key) → nothing changes
  {
    const { dismissed, activeKeyCleared } = simulateHydration({
      completed: {},
      dismissed: {},
      storedActiveId: null,
    });
    check('FQ-5a  fresh install: no dismissals added', Object.keys(dismissed).length === 0, `keys=${Object.keys(dismissed)}`);
    check('FQ-5b  fresh install: ACTIVE_KEY not cleared', activeKeyCleared === false);
  }

  // FQ-6  Normal exit: prologueBattle was already completed before boot
  //        (ACTIVE_KEY cleared by markDone before force-quit could occur, but
  //         simulate orphaned-marker cleanup path where completed=true & key set)
  {
    const { dismissed, activeKeyCleared } = simulateHydration({
      completed: { prologueBattle: true },
      dismissed: {},
      storedActiveId: 'prologueBattle',
    });
    check('FQ-6a  already-completed + stale key: NOT re-dismissed', !dismissed['prologueBattle'], `dismissed=${dismissed['prologueBattle']}`);
    check('FQ-6b  already-completed + stale key: orphaned key cleared', activeKeyCleared === true);
  }

  // FQ-7  Already dismissed at a prior session + stale key → orphaned marker
  //        cleaned up, dismissed state not duplicated
  {
    const { dismissed, activeKeyCleared } = simulateHydration({
      completed: {},
      dismissed: { firstBattle: true },
      storedActiveId: 'firstBattle',
    });
    check('FQ-7a  already-dismissed + stale key: dismissed unchanged', dismissed['firstBattle'] === true, `dismissed=${dismissed['firstBattle']}`);
    check('FQ-7b  already-dismissed + stale key: orphaned key cleared', activeKeyCleared === true);
  }

  // FQ-8  After auto-dismissal, replayTutorial must be able to clear the flag
  //        and restart — force-quit protection must not permanently block replay.
  {
    let s = makeTutorialState();
    // Simulate hydration having auto-dismissed prologueBattle due to force-quit.
    s = { ...s, dismissed: { ...s.dismissed, prologueBattle: true } };
    // startTutorial is now blocked (dismissed).
    const before = s;
    s = startTutorial(s, 'prologueBattle', TOTAL_STEPS);
    check('FQ-8a  auto-dismissed battle tutorial: startTutorial blocked', s.active === null && s === before);
    // But replayTutorial lifts the block.
    s = replayTutorial(s, 'prologueBattle');
    check('FQ-8b  replay clears auto-dismissal', s.dismissed['prologueBattle'] === false, `dismissed=${s.dismissed['prologueBattle']}`);
    check('FQ-8c  replay sets active', s.active === 'prologueBattle', `active=${s.active}`);
    check('FQ-8d  replay starts at step 0', s.step === 0, `step=${s.step}`);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed tests:');
  results.filter(r => !r.pass).forEach(r => console.log(`  FAIL – ${r.name}  ::  ${r.details}`));
  process.exit(1);
}
