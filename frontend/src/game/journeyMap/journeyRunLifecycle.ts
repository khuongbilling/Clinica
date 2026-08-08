/**
 * journeyMap/journeyRunLifecycle.ts — PUSH 8
 *
 * Pure lifecycle logic for fog-map journey runs.
 *
 * All persistence is delegated through IJourneyRunRepository so that these
 * functions can be exercised in tests with a mock repository, without any real
 * database or HTTP connection.
 *
 * STATE MACHINE
 * ─────────────
 *
 *   loadOrCreateJourneyRun(playerId, chapterId, repo)
 *   ┌─────────────────────────────────────────────────┐
 *   │ active run exists? ──yes──► return active run    │
 *   │       │ no                                       │
 *   │ latest run is cleared? ──yes──► return cleared   │  ← summary screen
 *   │       │ no (no run ever)                         │
 *   │ createFirstRun ──────────────► return new run    │
 *   └─────────────────────────────────────────────────┘
 *
 *   challengeChapter(playerId, chapterId, repo)          ← only after cleared
 *   ┌─────────────────────────────────────────────────┐
 *   │ latest run cleared? ──no──► throw               │
 *   │ createChallengeRun(playerId, chapterId,          │
 *   │   latest.attemptNumber)  ──► return new run      │
 *   └─────────────────────────────────────────────────┘
 *
 * DO NOT REROLL on: page refresh, route change, app reopen, battle return,
 * menu open, stamina refill, failed battle, component remount.
 * The ONLY reroll trigger is an explicit Challenge Chapter call after a
 * cleared run.
 */

import { generateHexTopology }       from './topology';
import { assignJourneyEncounters }   from './encounters';
import { computeInitialFog }         from './fogCalculator';
import type { HexTopology }          from './topology';
import type { EncounterAssignment }  from './encounters';
import type { JourneyRun, JourneyTile, TileVisibility } from './types';

// ── Public schema version ─────────────────────────────────────────────────────

export const JOURNEY_RUN_SCHEMA_VERSION = 1;

// ── Repository interface ──────────────────────────────────────────────────────

/**
 * Persistence contract for journey runs.
 *
 * The concrete implementation (JourneyRunRepository) calls the backend API.
 * Tests supply a mock that satisfies this interface without any real I/O.
 */
export interface IJourneyRunRepository {
  /** Returns the current active (in-progress) run, or null if none exists. */
  getActiveRun(playerId: string, chapterId: number): Promise<JourneyRun | null>;

  /**
   * Returns the most recent run (any status) for this player+chapter,
   * or null if no run has ever been created.
   */
  getLatestRun(playerId: string, chapterId: number): Promise<JourneyRun | null>;

  /**
   * Create attempt #1. Idempotent: if one already exists (e.g. from a
   * concurrent request), returns the existing run rather than creating a
   * duplicate.
   */
  createFirstRun(playerId: string, chapterId: number): Promise<JourneyRun>;

  /**
   * Atomically create the next challenge attempt.
   * Callers supply the prior attempt number; the repository derives
   * `newAttemptNumber = priorAttemptNumber + 1` and uses the unique compound
   * index (player_id, chapter_id, attempt_number) to prevent duplicates from
   * concurrent requests.
   */
  createChallengeRun(
    playerId:           string,
    chapterId:          number,
    priorAttemptNumber: number,
  ): Promise<JourneyRun>;

  /** Persist the full mutable run state after player actions. */
  saveRun(run: JourneyRun): Promise<JourneyRun>;

  /** Transition a run from 'active' to 'cleared' after the chapter boss dies. */
  markRunCleared(runId: string): Promise<JourneyRun>;
}

// ── buildInitialJourneyRun ────────────────────────────────────────────────────

export interface BuildRunOptions {
  /** Server-assigned stable UUID for this run. */
  id:            string;
  playerId:      string;
  chapterId:     number;
  attemptNumber: number;
  seed:          string;
  topology:      HexTopology;
  encounters:    EncounterAssignment;
}

/**
 * Assemble a brand-new JourneyRun from a pre-generated topology and encounter
 * assignment. Pure — no I/O.
 *
 * Initial visibility rules (delegated to fogCalculator.computeInitialFog):
 *   start tile          → 'revealed'
 *   tiles adjacent (d=1) → 'frontier'
 *   all others           → 'hidden'
 */
export function buildInitialJourneyRun({
  id,
  playerId,
  chapterId,
  attemptNumber,
  seed,
  topology,
  encounters,
}: BuildRunOptions): JourneyRun {
  const now      = new Date().toISOString();
  const startKey = topology.startTileId;
  const gateKey  = topology.gateAnchorId;

  // Compute initial fog via the canonical fogCalculator.
  const coordTiles = topology.tiles.map(t => ({ id: `${t.q},${t.r}`, q: t.q, r: t.r }));
  const visMap     = computeInitialFog(coordTiles, startKey);

  // Build an O(1) lookup from tileKey → AssignedTile.
  const assignedByKey = new Map(encounters.tiles.map(t => [t.tileKey, t]));

  const tiles: JourneyTile[] = topology.tiles.map(coord => {
    const tileKey  = `${coord.q},${coord.r}`;
    const assigned = assignedByKey.get(tileKey);
    const dist     = topology.graphDistances.get(tileKey) ?? 0;

    const visibility: TileVisibility = visMap.get(tileKey) ?? 'hidden';

    return {
      id:                    tileKey,   // stable "q,r" key serves as the tile id
      q:                     coord.q,
      r:                     coord.r,
      encounter:             assigned?.encounter ?? 'none',
      chestTier:             assigned?.chestTier,
      visibility,
      visited:               tileKey === startKey,
      resolved:              false,
      current:               tileKey === startKey,
      graphDistanceFromStart: dist,
      areaBossKeyClaimed:    false,
      rewardClaimed:         false,
    };
  });

  // tileCount = playable tiles only (gate excluded).
  const tileCount = topology.tiles.length - 1;

  return {
    id,
    schemaVersion:          JOURNEY_RUN_SCHEMA_VERSION,
    playerId,
    chapterId,
    attemptNumber,
    seed,
    status:                 'active',
    createdAt:              now,
    updatedAt:              now,
    tileCount,
    tiles,
    startTileId:            startKey,
    currentTileId:          startKey,
    gateAnchorTileId:       gateKey,
    areaBossCount:          encounters.areaBossCount,
    areaBossKeysCollected:  0,
    chapterBossDefeated:    false,
    exploredTileCount:      1,  // start tile is revealed at creation
    staminaSpent:           0,
  };
}

// ── generateRunData ───────────────────────────────────────────────────────────

/**
 * Convenience: generate topology + encounters from a seed and chapter.
 * Used by the concrete repository to populate a new run.
 */
export function generateRunData(chapter: number, seed: string) {
  const topology   = generateHexTopology({ chapter, seed });
  const encounters = assignJourneyEncounters({ chapter, seed, topology });
  return { topology, encounters };
}

// ── Lifecycle state machine ───────────────────────────────────────────────────

/**
 * Load or create the journey run for a given player+chapter.
 *
 * Rules:
 *   1. If an active run exists → return it (no re-roll).
 *   2. If the latest run is cleared → return it (show summary; do not auto-create).
 *   3. Otherwise (no run ever started) → create attempt #1 and return it.
 */
export async function loadOrCreateJourneyRun(
  playerId:  string,
  chapterId: number,
  repo:      IJourneyRunRepository,
): Promise<JourneyRun> {
  const active = await repo.getActiveRun(playerId, chapterId);
  if (active) return active;

  const latest = await repo.getLatestRun(playerId, chapterId);
  if (latest?.status === 'cleared') return latest;

  return repo.createFirstRun(playerId, chapterId);
}

/**
 * Create the next challenge attempt after a cleared run.
 *
 * Only callable when the latest run is cleared — throws otherwise.
 * The repository handles atomic duplicate prevention so that double-clicking
 * the "Challenge Chapter" button cannot produce two active runs.
 */
export async function challengeChapter(
  playerId:  string,
  chapterId: number,
  repo:      IJourneyRunRepository,
): Promise<JourneyRun> {
  const latest = await repo.getLatestRun(playerId, chapterId);

  if (!latest) {
    throw new Error(
      'Challenge Chapter requires a prior completed run. ' +
      `No runs found for player=${playerId} chapter=${chapterId}.`,
    );
  }
  if (latest.status !== 'cleared') {
    throw new Error(
      'Challenge Chapter is only available after the chapter is cleared. ' +
      `Current run status: "${latest.status}".`,
    );
  }

  return repo.createChallengeRun(playerId, chapterId, latest.attemptNumber);
}
