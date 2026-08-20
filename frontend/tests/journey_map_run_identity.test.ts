/**
 * journey_map_run_identity.test.ts — Production Bridge Push 2
 *
 * Validates map geometry identity persistence on JourneyRun:
 *
 *   generateRunData identity fields:
 *   • Ch1 returns mapLayoutVersion='v1' and mapBlueprintHash=artifact.hash
 *   • Ch1 returns topologyFamily='academic_quad'
 *   • Different seed, same chapter → SAME mapBlueprintHash (geometry is immutable)
 *   • Different shift, same chapter → SAME mapBlueprintHash (shift-invariant)
 *   • Ch2 remains on the shared blueprint pipeline and has a stable identity
 *
 *   buildInitialJourneyRun identity threading:
 *   • Built run carries mapLayoutVersion / mapBlueprintHash / topologyFamily
 *
 *   Stale-run detection logic (unit-level, no HTTP):
 *   • Legacy run (hash='', version='legacy') fails identity check vs artifact
 *   • Current-version run passes identity check
 *   • Run with wrong version string fails
 *   • A non-pipeline chapter skips the blueprint identity check
 *
 *   Rechallenge geometry invariant:
 *   • Two calls with different seeds for the same blueprint chapter yield
 *     the same mapBlueprintHash (canonical artifact is seed-independent)
 */

import assert          from 'assert';
import {
  generateRunData,
  buildInitialJourneyRun,
  type GenerateRunDataResult,
  type BuildRunOptions,
  type RunEncounterInput,
} from '../src/game/journeyMap/journeyRunLifecycle';
import {
  compareRunGeometryToCanonicalArtifact,
  getCanonicalChapterMapArtifact,
} from '../src/game/journeyMap/canonicalMapArtifact';
import { BLUEPRINT_PIPELINE_CHAPTERS }    from '../src/game/journeyMap/config';
import type { JourneyRun }                from '../src/game/journeyMap/types';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed   = 0;
let failed   = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
  } catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`FAIL - ${name}\n       ${msg}`);
    console.error(`FAIL - ${name}\n       ${msg}`);
  }
}

function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(msg ?? `Expected ${String(a)} === ${String(b)}`);
}
function ok(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal empty encounter assignment. */
function emptyEncounters(tileCount: number): RunEncounterInput {
  return { tiles: [], areaBossCount: 0 };
}

/**
 * Checks whether a run with the given identity fields would pass the
 * blueprint identity check in getActiveRun().
 *
 * This mirrors the exact logic in journeyRunRepository.ts without needing HTTP.
 */
function passesIdentityCheck(
  chapterId: number,
  mapLayoutVersion: string,
  mapBlueprintHash: string,
): boolean {
  if (!BLUEPRINT_PIPELINE_CHAPTERS.has(chapterId)) return true; // no check for non-blueprint
  const artifact = getCanonicalChapterMapArtifact(chapterId);
  return (
    mapBlueprintHash === artifact.blueprintHash &&
    mapLayoutVersion  === artifact.mapLayoutVersion
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CH1 = 1;  // blueprint pipeline
const CH2 = 2;  // shared blueprint pipeline
const NON_PIPELINE_CHAPTER = 11;

const SEED_A = 'seed-alpha-001';
const SEED_B = 'seed-beta-002';
const HEX8   = /^[0-9a-f]{8}$/;

// ── Pre-fetch artifact for comparisons ───────────────────────────────────────

const artifact = getCanonicalChapterMapArtifact(CH1);

// ── generateRunData — blueprint chapter (Ch1) ─────────────────────────────────

let ch1ResultA: GenerateRunDataResult;
let ch1ResultB: GenerateRunDataResult;
let ch1ResultEvening: GenerateRunDataResult;

test('generateRunData(1) does not throw', () => {
  ch1ResultA       = generateRunData(CH1, SEED_A, 'day');
  ch1ResultB       = generateRunData(CH1, SEED_B, 'day');
  ch1ResultEvening = generateRunData(CH1, SEED_A, 'evening');
});

test('Ch1 mapLayoutVersion carries its open-courtyard identity', () => {
  eq(ch1ResultA.mapLayoutVersion, artifact.mapLayoutVersion,
    `expected '${artifact.mapLayoutVersion}', got '${ch1ResultA.mapLayoutVersion}'`);
});

test('Ch1 mapBlueprintHash matches canonical artifact', () => {
  eq(ch1ResultA.mapBlueprintHash, artifact.blueprintHash,
    `hash mismatch: ${ch1ResultA.mapBlueprintHash} !== ${artifact.blueprintHash}`);
});

test('Ch1 mapBlueprintHash is 8 hex chars', () => {
  ok(HEX8.test(ch1ResultA.mapBlueprintHash),
    `mapBlueprintHash '${ch1ResultA.mapBlueprintHash}' is not 8 hex chars`);
});

test('Ch1 topologyFamily is academic_quad', () => {
  eq(ch1ResultA.topologyFamily, 'academic_quad',
    `expected 'academic_quad', got '${ch1ResultA.topologyFamily}'`);
});

test('Ch1 different seed → same mapBlueprintHash (geometry is immutable)', () => {
  eq(ch1ResultA.mapBlueprintHash, ch1ResultB.mapBlueprintHash,
    `seed change should not alter blueprint hash:\n  A=${ch1ResultA.mapBlueprintHash}\n  B=${ch1ResultB.mapBlueprintHash}`);
});

test('Ch1 different shift → same mapBlueprintHash (shift-invariant)', () => {
  eq(ch1ResultA.mapBlueprintHash, ch1ResultEvening.mapBlueprintHash,
    `shift change should not alter blueprint hash:\n  day=${ch1ResultA.mapBlueprintHash}\n  evening=${ch1ResultEvening.mapBlueprintHash}`);
});

test('Ch1 different seed → same mapLayoutVersion', () => {
  eq(ch1ResultA.mapLayoutVersion, ch1ResultB.mapLayoutVersion,
    `mapLayoutVersion changed between seeds: ${ch1ResultA.mapLayoutVersion} vs ${ch1ResultB.mapLayoutVersion}`);
});

test('Ch1 different seed → same topologyFamily', () => {
  eq(ch1ResultA.topologyFamily, ch1ResultB.topologyFamily,
    `topologyFamily changed between seeds: ${ch1ResultA.topologyFamily} vs ${ch1ResultB.topologyFamily}`);
});

// ── generateRunData — authored chapter (Ch2) ──────────────────────────────────

let ch2ResultA: GenerateRunDataResult;
let ch2ResultB: GenerateRunDataResult;

test('generateRunData(2) does not throw', () => {
  ch2ResultA = generateRunData(CH2, SEED_A, 'day');
  ch2ResultB = generateRunData(CH2, SEED_A, 'night');
});

test('Ch2 mapLayoutVersion is stable across shifts', () => {
  eq(ch2ResultA.mapLayoutVersion, ch2ResultB.mapLayoutVersion,
    `map layout version changed between shifts`);
});

test('Ch2 mapBlueprintHash is 8 hex chars', () => {
  ok(HEX8.test(ch2ResultA.mapBlueprintHash),
    `Ch2 mapBlueprintHash '${ch2ResultA.mapBlueprintHash}' is not 8 hex chars`);
});

test('Ch2 authored hash is stable across shifts (same template)', () => {
  eq(ch2ResultA.mapBlueprintHash, ch2ResultB.mapBlueprintHash,
    `authored hash should not change with shift:\n  day=${ch2ResultA.mapBlueprintHash}\n  night=${ch2ResultB.mapBlueprintHash}`);
});

test('Ch2 retains its blueprint topology family', () => {
  eq(ch2ResultA.topologyFamily, 'open_plaza',
    `Ch2 topology family should be open_plaza, got '${ch2ResultA.topologyFamily}'`);
});

// ── buildInitialJourneyRun — identity field threading ────────────────────────

let builtRun: JourneyRun;

test('buildInitialJourneyRun threads identity fields into the run', () => {
  const opts: BuildRunOptions = {
    id:               'test-id-001',
    playerId:         'player-abc',
    chapterId:        CH1,
    attemptNumber:    1,
    seed:             SEED_A,
    shift:            'day',
    topology:         ch1ResultA.topology,
    encounters:       ch1ResultA.encounters,
    mapLayoutVersion: ch1ResultA.mapLayoutVersion,
    mapBlueprintHash: ch1ResultA.mapBlueprintHash,
    topologyFamily:   ch1ResultA.topologyFamily,
  };
  builtRun = buildInitialJourneyRun(opts);
});

test('built run.mapLayoutVersion matches generateRunData result', () => {
  eq(builtRun.mapLayoutVersion, ch1ResultA.mapLayoutVersion,
    `run.mapLayoutVersion mismatch`);
});

test('built run.mapBlueprintHash matches generateRunData result', () => {
  eq(builtRun.mapBlueprintHash, ch1ResultA.mapBlueprintHash,
    `run.mapBlueprintHash mismatch`);
});

test('built run.topologyFamily matches generateRunData result', () => {
  eq(builtRun.topologyFamily, ch1ResultA.topologyFamily,
    `run.topologyFamily mismatch`);
});

test('exact persisted coordinate set and anchors pass the canonical geometry check', () => {
  const comparison = compareRunGeometryToCanonicalArtifact(builtRun, artifact);
  ok(comparison.matches, `expected exact geometry match; missing=${comparison.missingTileIds}`);
});

test('same-count hybrid footprint fails even when it claims the current identity', () => {
  const hybrid = {
    ...builtRun,
  tiles: builtRun.tiles.map(tile => tile.id === '0,9'
      ? { ...tile, id: '12,0', q: 12, r: 0 }
      : tile),
  };
  const comparison = compareRunGeometryToCanonicalArtifact(hybrid, artifact);
  ok(!comparison.matches, 'hybrid coordinate footprint should fail');
  ok(comparison.missingTileIds.includes('0,9'), 'missing canonical tile should be reported');
  ok(comparison.extraTileIds.includes('12,0'), 'extra legacy tile should be reported');
});

// ── Identity check (mirrors getActiveRun staleness logic) ────────────────────

test('legacy run (hash="", version="legacy") fails identity check for Ch1', () => {
  const passes = passesIdentityCheck(CH1, 'legacy', '');
  ok(!passes, 'Legacy run should fail the blueprint identity check, but passed');
});

test('current-version run passes identity check for Ch1', () => {
  const passes = passesIdentityCheck(
    CH1,
    artifact.mapLayoutVersion,
    artifact.blueprintHash,
  );
  ok(passes, 'Current-version run should pass the blueprint identity check, but failed');
});

test('run with wrong layout version fails identity check for Ch1', () => {
  const passes = passesIdentityCheck(CH1, 'v0', artifact.blueprintHash);
  ok(!passes, 'Wrong version should fail, but passed');
});

test('run with wrong hash fails identity check for Ch1', () => {
  const passes = passesIdentityCheck(CH1, artifact.mapLayoutVersion, 'deadbeef');
  ok(!passes, 'Wrong hash should fail, but passed');
});

test('a non-pipeline chapter skips the blueprint identity check', () => {
  ok(!BLUEPRINT_PIPELINE_CHAPTERS.has(NON_PIPELINE_CHAPTER),
    'test chapter should not use the blueprint pipeline');
  const passes = passesIdentityCheck(NON_PIPELINE_CHAPTER, 'legacy', '');
  ok(passes, 'non-pipeline chapter should skip the identity check and pass');
});

// ── Rechallenge geometry invariant ───────────────────────────────────────────

test('rechallenge: different seed → same blueprint hash (canonical layout fixed)', () => {
  // Simulate what happens when a player rechallenges (new seed, same chapter).
  // The blueprint artifact is chapter-deterministic, so both attempts get the
  // same tile footprint and the same hash — no stale-run rejection loop.
  const attempt1 = generateRunData(CH1, 'attempt-1-seed', 'day');
  const attempt2 = generateRunData(CH1, 'attempt-2-seed', 'night');
  eq(attempt1.mapBlueprintHash, attempt2.mapBlueprintHash,
    `rechallenge attempts must share blueprint hash:\n  attempt1=${attempt1.mapBlueprintHash}\n  attempt2=${attempt2.mapBlueprintHash}`);
});

// ── Results ───────────────────────────────────────────────────────────────────

console.log('');
console.log('─'.repeat(70));
console.log(`journey_map_run_identity: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('');
  for (const f of failures) console.log(f);
}
console.log('─'.repeat(70));

if (failed > 0) process.exit(1);
