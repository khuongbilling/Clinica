/**
 * journeyMap/journeyRunLifecycle.ts — PUSH 4
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
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ active run exists? ──yes──► return active run                   │
 *   │       │ no                                                      │
 *   │ latest run is cleared? ──yes──► return cleared  ← summary screen│
 *   │       │ no                                                      │
 *   │ latest run is abandoned? ──yes──► createRechallengeRun          │
 *   │   (recovery: rechallenge abandon succeeded but create failed)   │
 *   │       │ no (no run ever)                                        │
 *   │ createFirstRun ──────────────► return new run                   │
 *   └─────────────────────────────────────────────────────────────────┘
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
 *
 * Canonical generator (Push 4)
 * ─────────────────────────────
 * When JOURNEY_CANONICAL_V1 is true, generateRunData() uses
 * assignCanonicalEncounters() (shift-weighted, density-capped, one-roll-per-tile)
 * instead of the legacy assignJourneyEncounters().
 *
 * wardEvent tiles from the canonical generator are silently downgraded to
 * encounter='none' until WARD_EVENTS_V1 is enabled (and 'wardEvent' is added to
 * the EncounterType union).  The wardEventSubtype field is preserved on the tile
 * so no data is lost when WARD_EVENTS_V1 flips true.
 */

import { getChapterHexTopology, isAuthoredChapter } from './chapterMapTemplates';
import { generateHexTopology }         from './topology';
import { fnv1a32 }                     from './prng';
import { assignJourneyEncounters }     from './encounters';
import { assignCanonicalEncounters }   from './canonicalEncounters';
import { computeInitialFog }           from './fogCalculator';
import {
  checkRechallengeEligibility,
} from './chapterBossKeys';
import type { ChapterBossKeyState }    from './chapterBossKeys';
import { JOURNEY_CANONICAL_V1 }        from '../featureFlags';
import type { HexTopology }            from './topology';
import type {
  JourneyRun,
  JourneyTile,
  TileVisibility,
  TimeOfDay,
  ChestTier,
  WardEventSubtype,
  EncounterType,
  TerrainVisualVariant,
} from './types';

// ── Public schema version ─────────────────────────────────────────────────────

export const JOURNEY_RUN_SCHEMA_VERSION = 2;  // bumped at Push 4 (new canonical fields)

// ── Encounter type guard ──────────────────────────────────────────────────────

/**
 * The current persisted EncounterType values.
 * 'wardEvent' is NOT here until WARD_EVENTS_V1 enables it.
 * Any encounter from the canonical generator that isn't in this set is
 * downgraded to 'none' so the EncounterType union stays stable.
 *
 * When WARD_EVENTS_V1 flips true:
 *   1. Add 'wardEvent' to EncounterType in types.ts.
 *   2. Remove 'wardEvent' from the list of values that hit this gate.
 */
const PERSISTED_ENCOUNTER_TYPES = new Set<string>([
  'none', 'battle', 'treasure', 'merchant', 'areaBoss',
]);

function toPersistedEncounterType(raw: string): EncounterType {
  return PERSISTED_ENCOUNTER_TYPES.has(raw) ? (raw as EncounterType) : 'none';
}

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
  createFirstRun(playerId: string, chapterId: number, shift?: TimeOfDay): Promise<JourneyRun>;

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
    shift?:             TimeOfDay,
  ): Promise<JourneyRun>;

  /** Persist the full mutable run state after player actions. */
  saveRun(run: JourneyRun): Promise<JourneyRun>;

  /** Transition a run from 'active' to 'cleared' after the chapter boss dies. */
  markRunCleared(runId: string): Promise<JourneyRun>;

  /**
   * Transition an active run to 'abandoned' before creating a Rechallenge Map
   * attempt.  The run is preserved in the database for history/debugging; it is
   * simply ineligible to be returned by getActiveRun or getLatestRun in future.
   */
  abandonRun(runId: string): Promise<void>;

  /**
   * Create the next Rechallenge Map attempt, carrying chapter-level boss keys
   * accumulated on prior attempts into the new run's initial state.
   *
   * Distinct from createChallengeRun (post-clear replay, keys reset to 0).
   * Uses the same dedup / unique-index guard as createChallengeRun.
   *
   * @param inheritedAreaBossKeys  Keys to seed into the new run's areaBossKeysCollected.
   */
  createRechallengeRun(
    playerId:             string,
    chapterId:            number,
    priorAttemptNumber:   number,
    inheritedAreaBossKeys: number,
    shift?:               TimeOfDay,
  ): Promise<JourneyRun>;
}

// ── Input interfaces ──────────────────────────────────────────────────────────

/**
 * Minimal tile descriptor accepted by buildInitialJourneyRun.
 * Both AssignedTile (encounters.ts) and CanonicalAssignedTile
 * (canonicalEncounters.ts) satisfy this structurally.
 */
export interface RunTileInput {
  readonly tileKey:           string;
  readonly encounter:         string;   // string for EncounterType | CanonicalEncounterType compat
  readonly chestTier?:        ChestTier;
  readonly wardEventSubtype?: WardEventSubtype;
}

/** Encounter assignment accepted by buildInitialJourneyRun. */
export interface RunEncounterInput {
  readonly tiles:         ReadonlyArray<RunTileInput>;
  readonly areaBossCount: number;
}

// ── BuildRunOptions ───────────────────────────────────────────────────────────

export interface BuildRunOptions {
  /** Server-assigned stable UUID for this run. */
  id:            string;
  playerId:      string;
  chapterId:     number;
  attemptNumber: number;
  seed:          string;
  /**
   * Shift at run creation (frozen for lifetime of run).
   * Determines ward event subtype distribution and density caps.
   */
  shift:         TimeOfDay;
  topology:      HexTopology;
  encounters:    RunEncounterInput;
  /**
   * Chapter Boss Keys accumulated on PREVIOUS attempts for this chapter.
   * Passed only by Rechallenge Map so keys carry forward across map resets.
   * Defaults to 0 for first runs and post-clear challenge runs.
   */
  initialAreaBossKeysCollected?: number;
  /**
   * Player's effective field-of-vision radius for the initial fog computation.
   * Defaults to REVEAL_RADIUS (= 1) — current tile + 1 ring.
   * Pass computeEffectiveVisionRadius(resolveVisionBonuses(classTreeId)) from
   * visionConfig when a class passive or buff should expand the starting view.
   */
  visionRadius?: number;
}

// ── buildInitialJourneyRun ────────────────────────────────────────────────────

/**
 * Assemble a brand-new JourneyRun from a pre-generated topology and encounter
 * assignment. Pure — no I/O.
 *
 * Initial visibility rules (delegated to fogCalculator.computeInitialFog):
 *   start tile                   → 'exploredButOutOfVision'
 *   tiles within REVEAL_RADIUS   → 'visibleNow'
 *   all others                   → 'unexplored'
 *
 * Encounter type gating:
 *   Canonical generator values not yet in EncounterType (e.g. 'wardEvent'
 *   before WARD_EVENTS_V1) are downgraded to 'none'.  The wardEventSubtype
 *   field is preserved so it can be re-enabled without regeneration.
 */
export function buildInitialJourneyRun({
  id,
  playerId,
  chapterId,
  attemptNumber,
  seed,
  shift,
  topology,
  encounters,
  initialAreaBossKeysCollected = 0,
  visionRadius,
}: BuildRunOptions): JourneyRun {
  const now      = new Date().toISOString();
  const startKey = topology.startTileId;
  const gateKey  = topology.gateAnchorId;

  // Compute initial fog via the canonical fogCalculator.
  // visionRadius defaults to REVEAL_RADIUS (1) — pass a larger value from
  // visionConfig.computeEffectiveVisionRadius() when a class/buff expands the
  // starting field of vision.
  const coordTiles = topology.tiles.map(t => ({ id: `${t.q},${t.r}`, q: t.q, r: t.r }));
  const visMap     = computeInitialFog(coordTiles, startKey, visionRadius);

  // Build an O(1) lookup from tileKey → RunTileInput.
  const assignedByKey = new Map(encounters.tiles.map(t => [t.tileKey, t]));

  // ── Terrain visual variant seeding ──────────────────────────────────────────
  // Deterministic cosmetic variant for 'none' encounter tiles only.
  // Namespace is isolated from topology ("ch${c}:${s}") and encounter
  // ("${s}:encounters") streams so the variant roll never perturbs either.
  // No gameplay effect — purely surface decoration for the renderer.
  const TERRAIN_VARIANTS: TerrainVisualVariant[] = [
    'plain', 'cracked', 'moss', 'rune', 'flowers', 'lantern', 'debris',
  ];
  function terrainVariant(tileKey: string): TerrainVisualVariant {
    const hash = fnv1a32(`${seed}:terrain:${tileKey}`);
    return TERRAIN_VARIANTS[hash % TERRAIN_VARIANTS.length];
  }

  const tiles: JourneyTile[] = topology.tiles.map(coord => {
    const tileKey  = `${coord.q},${coord.r}`;
    const assigned = assignedByKey.get(tileKey);
    const dist     = topology.graphDistances.get(tileKey) ?? 0;

    const visibility: TileVisibility = visMap.get(tileKey) ?? 'unexplored';

    // Gate encounter type to values currently in the EncounterType union.
    // 'wardEvent' from the canonical generator is 'none' until WARD_EVENTS_V1.
    const rawEncounter   = assigned?.encounter ?? 'none';
    const encounter      = toPersistedEncounterType(rawEncounter);

    // Preserve wardEventSubtype when the encounter makes it through the gate
    // (currently never, since wardEvent → none; will pass through once
    //  WARD_EVENTS_V1 adds 'wardEvent' to EncounterType and the gate check above).
    // wardEventSubtype is also preserved when encounter === 'none' because the
    // tile WAS a wardEvent tile — the subtype is kept so that enabling
    // WARD_EVENTS_V1 on an existing run can restore the correct subtype.
    const wardEventSubtype = assigned?.wardEventSubtype;

    return {
      id:                     tileKey,
      q:                      coord.q,
      r:                      coord.r,
      encounter,
      chestTier:              encounter === 'treasure' ? assigned?.chestTier : undefined,
      wardEventSubtype,
      // Cosmetic variant — only on empty terrain, no gameplay effect.
      visualVariant:          encounter === 'none' ? terrainVariant(tileKey) : undefined,
      visibility,
      visited:                tileKey === startKey,
      resolved:               false,
      current:                tileKey === startKey,
      graphDistanceFromStart: dist,
      areaBossKeyClaimed:     false,
      rewardClaimed:          false,
    };
  });

  // tileCount = playable tiles only (gate excluded).
  const tileCount = topology.tiles.length - 1;

  // exploredTileIds: all tiles visible at run start (start tile + initial FOV ring).
  // Derived from the constructed tiles array so the set is always consistent
  // with the initial visibility states written into each JourneyTile.
  const exploredTileIds = tiles
    .filter(t => t.visibility !== 'unexplored')
    .map(t => t.id);

  return {
    id,
    schemaVersion:          JOURNEY_RUN_SCHEMA_VERSION,
    playerId,
    chapterId,
    attemptNumber,
    seed,
    shift,
    status:                 'active',
    createdAt:              now,
    updatedAt:              now,
    tileCount,
    tiles,
    startTileId:            startKey,
    currentTileId:          startKey,
    gateAnchorTileId:       gateKey,
    areaBossCount:          encounters.areaBossCount,
    inheritedAreaBossKeys:  Math.max(0, Math.round(initialAreaBossKeysCollected)),
    areaBossKeysCollected:  Math.max(0, Math.round(initialAreaBossKeysCollected)),
    chapterBossDefeated:    false,
    exploredTileCount:      1,  // start tile is always revealed at creation
    exploredTileIds,
    staminaSpent:           0,
    // Canonical run inventory — empty at run start
    callTeam:               [],
    cards:                  [],
    blessings:              [],
    pressure:               0,
  };
}

// ── generateRunData ───────────────────────────────────────────────────────────

/**
 * Generate topology + encounters for a run.
 *
 * GEOMETRY SOURCE — determined by isAuthoredChapter():
 *
 *   Authored chapter (currently Ch1):
 *     getChapterHexTopology() → fixed coordinates, start tile, Boss Gate.
 *     The run seed has NO influence on the physical layout.
 *     Rechallenges, different shifts, and new seeds all share the same map.
 *
 *   Unauth'd chapter (Ch2+, temporarily):
 *     generateHexTopology({ chapter, seed }) → procedural, seed-derived.
 *     Geometry varies between attempts just as before.
 *     When a chapter's authored template ships, add it to
 *     PRODUCTION_AUTHORED_CHAPTERS in chapterMapTemplates.ts.
 *
 * ENCOUNTER LAYER (always seed-derived):
 *   When JOURNEY_CANONICAL_V1 is true: assignCanonicalEncounters()
 *     (shift-weighted, density-capped, one-roll-per-tile).
 *   When false: legacy assignJourneyEncounters().
 *
 * The returned object satisfies RunEncounterInput plus { topology }.
 */
export function generateRunData(
  chapter: number,
  seed:    string,
  shift:   TimeOfDay,
): { topology: HexTopology; encounters: RunEncounterInput } {
  // Geometry: authored template (fixed) OR procedural (seed-derived fallback).
  const topology = isAuthoredChapter(chapter)
    ? getChapterHexTopology(chapter)
    : generateHexTopology({ chapter, seed });

  if (JOURNEY_CANONICAL_V1) {
    const enc = assignCanonicalEncounters({ chapter, seed, timeOfDay: shift, topology });
    return { topology, encounters: enc };
  }

  const enc = assignJourneyEncounters({ chapter, seed, topology });
  return { topology, encounters: enc };
}

// ── Lifecycle state machine ───────────────────────────────────────────────────

/**
 * Load or create the journey run for a given player+chapter.
 *
 * Rules:
 *   1. If an active run exists → return it (no re-roll).
 *   2. If the latest run is cleared → return it (show summary; do not auto-create).
 *   3. Recovery: if the latest run is 'abandoned' (rechallenge creation failed after
 *      the old run was archived) → create the successor attempt so the chapter is
 *      playable again.  Keys are sourced from `chapterKeysCollected` when provided
 *      (canonical chapter-level total, same value shown in the HUD), falling back
 *      to the abandoned run's areaBossKeysCollected for legacy saves.
 *   4. Otherwise (no run ever started) → create attempt #1 and return it.
 *
 * @param chapterKeysCollected  Canonical chapter-level key count from
 *   `player.chapter_boss_keys[chapterId].keys_collected`.  Pass this so the
 *   recovery path seeds the new run from the same source as the HUD display,
 *   rather than from the potentially stale run-level field.
 */
export async function loadOrCreateJourneyRun(
  playerId:             string,
  chapterId:            number,
  repo:                 IJourneyRunRepository,
  chapterKeysCollected?: number,
  /**
   * Shift for a NEW attempt #1, resolved by the caller via the
   * ChapterShiftRule layer (chapterShiftRules.resolveRunShift).  Ignored when
   * an existing run is returned.  Recovery attempts always inherit the
   * abandoned run's shift (canonical shift persistence).
   */
  shift?:               TimeOfDay,
): Promise<JourneyRun> {
  const active = await repo.getActiveRun(playerId, chapterId);
  if (active) return active;

  const latest = await repo.getLatestRun(playerId, chapterId);
  if (latest?.status === 'cleared') return latest;

  if (latest?.status === 'abandoned') {
    // Recovery path: the previous rechallenge succeeded in abandoning the old
    // run but failed before the new one was created.  Create the successor now,
    // carrying the inherited key count forward so no progress is lost.
    // Prefer the canonical chapter-level total (same source as the HUD) over
    // the stale run-level field so the recovered run always matches what the
    // player sees in the key-fragment panel.
    const inheritedKeys = chapterKeysCollected ?? latest.areaBossKeysCollected;
    return repo.createRechallengeRun(
      playerId,
      chapterId,
      latest.attemptNumber,
      inheritedKeys,
      latest.shift, // pre-clear attempts keep the same canonical shift
    );
  }

  return repo.createFirstRun(playerId, chapterId, shift);
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
  /**
   * Shift for the new attempt, resolved by the caller via the
   * ChapterShiftRule layer.  Defaults to the prior run's shift so replays
   * stay on the canonical shift unless the chapter offers a choice.
   */
  shift?:    TimeOfDay,
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

  return repo.createChallengeRun(playerId, chapterId, latest.attemptNumber, shift ?? latest.shift);
}

/**
 * Start a new pre-clear map attempt while preserving accumulated boss keys.
 *
 * Distinct from challengeChapter (post-clear replay).  Only callable while
 * the chapter boss has NOT been defeated and fewer than CHAPTER_BOSS_KEY_REQUIREMENT
 * keys have been collected.
 *
 * Ordering — abandon before create:
 *   Step 1: abandonRun (archive the active run).
 *           If this fails the active run is untouched — the error propagates to
 *           the caller and nothing changes for the player.
 *   Step 2: createRechallengeRun (new attempt, inherited keys).
 *           If this fails after a successful abandon, loadOrCreateJourneyRun
 *           detects the abandoned latest run on the next load and creates the
 *           successor automatically (recovery path), so progress is not lost.
 *
 * The backend's get_active_journey_run query sorts by attempt_number DESC, so
 * if two active runs ever coexist (concurrent sessions), the newer one wins.
 *
 * The caller is responsible for passing the preserved ChapterBossKeyState into
 * whatever UI or storage layer tracks chapter-level key progress.  This function
 * only manages the JourneyRun lifecycle.
 */
export async function rechallengeMap(
  playerId:  string,
  chapterId: number,
  repo:      IJourneyRunRepository,
  keyState:  ChapterBossKeyState,
): Promise<JourneyRun> {
  const active = await repo.getActiveRun(playerId, chapterId);
  if (!active) {
    throw new Error(
      'Rechallenge Map requires an active run. ' +
      `No active run found for player=${playerId} chapter=${chapterId}.`,
    );
  }

  const eligibility = checkRechallengeEligibility(keyState, active.chapterBossDefeated);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? 'Not eligible for Rechallenge Map.');
  }

  // Archive the current run FIRST.  Any error here surfaces to the caller —
  // the active run is untouched and the player can retry safely.
  await repo.abandonRun(active.id);

  // Create the successor with chapter-level keys carried forward.
  // keyState.keysCollected is the authoritative chapter-level count that
  // survives across all prior runs — NOT active.areaBossKeysCollected (which
  // is run-scoped and would be 0 on a fresh run after data loss).
  // If this fails, loadOrCreateJourneyRun will detect the abandoned latest run
  // on the next load and invoke the recovery path to create the successor.
  return repo.createRechallengeRun(
    playerId,
    chapterId,
    active.attemptNumber,
    keyState.keysCollected,
    active.shift, // pre-clear rechallenge MUST keep the same canonical shift
  );
}
