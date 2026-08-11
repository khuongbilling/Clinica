/**
 * journeyMap/createRun.ts — PUSH 8
 *
 * Factory that builds a complete, ready-to-play JourneyRun from first
 * principles: topology generation followed by encounter assignment.
 *
 * Design rules
 * ────────────
 * • Start tile  — always 'none'; starts revealed, visited, and current.
 * • Gate tile   — always 'boss' (set by assignJourneyEncounters); hidden.
 * • All other tiles begin hidden and unvisited.
 * • The seed is deterministically derived from chapterId + attemptNumber so
 *   every run can be reconstructed from those two values alone.
 * • tileCount   = tiles.length − 1  (gate tile is non-playable and excluded).
 * • gateAnchorTileId references the gate tile's id within the tiles array.
 *
 * No React, Expo, or UI imports belong here.
 */

import { getChapterHexTopology, isAuthoredChapter } from './chapterMapTemplates';
import { generateHexTopology } from './topology';
import { assignJourneyEncounters } from './encounters';
import type { JourneyRun, JourneyTile, TimeOfDay } from './types';

// ── Public types ──────────────────────────────────────────────────────────────

export interface CreateJourneyRunOptions {
  playerId:      string;
  chapterId:     number;
  /**
   * Monotonically incrementing attempt counter for this chapter (1-based).
   * Different attempts produce different maps via PRNG seeding.
   */
  attemptNumber: number;
  /**
   * Optional ISO-8601 timestamp for the run's creation time.
   * Defaults to `new Date().toISOString()` when omitted.
   * Inject a fixed value in tests to keep snapshots deterministic.
   */
  nowIso?: string;
  /**
   * Shift (time of day) at which this run is created.
   * Defaults to 'day' when omitted.
   * Determines ward event subtype distribution for the run's lifetime.
   */
  shift?: TimeOfDay;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Increment when the shape of JourneyRun changes. */
export const JOURNEY_RUN_SCHEMA_VERSION = 1;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseTileKey(key: string): { q: number; r: number } {
  const c = key.indexOf(',');
  return { q: Number(key.slice(0, c)), r: Number(key.slice(c + 1)) };
}

function tileIdFromKey(key: string): string {
  const { q, r } = parseTileKey(key);
  return `tile_${q}_${r}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Create a new JourneyRun for the given player, chapter, and attempt number.
 *
 * Pure and deterministic for a fixed `nowIso`.  All randomness is seeded
 * from `chapterId` and `attemptNumber` so the same run is always reproducible.
 */
export function createJourneyRun({
  playerId,
  chapterId,
  attemptNumber,
  nowIso,
  shift = 'day',
}: CreateJourneyRunOptions): JourneyRun {
  // Deterministic string seed: unique across reasonable chapter/attempt ranges.
  const seed = String(chapterId * 100_000 + attemptNumber);
  const now  = nowIso ?? new Date().toISOString();

  // Deterministic stable ID: player + chapter + attempt uniquely identifies a run.
  const id = `run_${playerId}_ch${chapterId}_a${attemptNumber}`;

  // ── Geometry: authored (fixed) for production-authored chapters, procedural otherwise ──
  const topology = isAuthoredChapter(chapterId)
    ? getChapterHexTopology(chapterId)            // authored: seed has no effect on layout
    : generateHexTopology({ chapter: chapterId, seed }); // procedural: seed-derived

  // ── Assign encounters and chest tiers to every tile ─────────────────────────
  const { tiles: assignedTiles, areaBossCount } = assignJourneyEncounters({
    chapter: chapterId,
    seed,
    topology,
  });

  const startKey    = topology.startTileId;
  const gateKey     = topology.gateAnchorId;
  const startTileId = tileIdFromKey(startKey);
  const gateTileId  = tileIdFromKey(gateKey);

  // ── Convert AssignedTile → JourneyTile ──────────────────────────────────────
  const tiles: JourneyTile[] = assignedTiles.map(at => {
    const isStart = at.tileKey === startKey;
    return {
      id:                    `tile_${at.q}_${at.r}`,
      q:                     at.q,
      r:                     at.r,
      encounter:             at.encounter,
      chestTier:             at.chestTier,
      // Start tile is immediately visible; everything else begins in the fog.
      visibility:            isStart ? 'exploredButOutOfVision' : 'unexplored',
      visited:               isStart,
      resolved:              false,
      current:               isStart,
      graphDistanceFromStart: topology.graphDistances.get(at.tileKey) ?? 0,
      areaBossKeyClaimed:    false,
      rewardClaimed:         false,
    };
  });

  // tileCount = playable tiles only (gate is non-playable → excluded).
  const tileCount = tiles.length - 1;

  // Only the start tile is revealed at creation time.
  const exploredTileCount = 1;

  // exploredTileIds: all tiles visible at run start.
  // createRun only marks the start tile as exploredButOutOfVision (no FOV ring);
  // derive from tile states so the set is always consistent.
  const exploredTileIds = tiles
    .filter(t => t.visibility !== 'unexplored')
    .map(t => t.id);

  return {
    id,
    schemaVersion:        JOURNEY_RUN_SCHEMA_VERSION,
    playerId,
    chapterId,
    attemptNumber,
    seed,
    status:               'active',
    createdAt:            now,
    updatedAt:            now,
    tileCount,
    tiles,
    startTileId,
    currentTileId:        startTileId,
    gateAnchorTileId:     gateTileId,
    areaBossCount,
    inheritedAreaBossKeys: 0,  // 0 for all new runs; carried forward only by rechallenge logic
    areaBossKeysCollected: 0,
    chapterBossDefeated:  false,
    exploredTileCount,
    exploredTileIds,
    staminaSpent:         0,
    shift,
    callTeam:             [],
    cards:                [],
    blessings:            [],
    pressure:             0,
  };
}
