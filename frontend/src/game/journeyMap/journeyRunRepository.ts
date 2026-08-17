/**
 * journeyMap/journeyRunRepository.ts — PUSH 4
 *
 * HTTP implementation of IJourneyRunRepository.
 *
 * All journey run state lives in the backend MongoDB `journey_runs` collection.
 * The frontend generates topology + encounters deterministically and sends the
 * full, assembled run to the backend for storage. The backend is a trusted store
 * with a unique compound index (player_id, chapter_id, attempt_number) that
 * prevents duplicate runs even under concurrent "Challenge Chapter" requests.
 *
 * Snake-case ↔ camelCase conversion
 * ───────────────────────────────────
 * The backend uses Python/MongoDB snake_case conventions; the frontend JourneyRun
 * type uses camelCase. `toWire` converts a JourneyRun for the wire, and
 * `fromWire` parses a raw backend document back to a JourneyRun.
 * Tiles are stored and returned as opaque JSON objects and need no conversion
 * because JourneyTile.id, JourneyTile.q, etc. are already short/unambiguous.
 *
 * Concurrency protection (Push 4)
 * ────────────────────────────────
 * `_inflightCreates` is a Map<key, Promise<JourneyRun>> that deduplicates
 * concurrent run-creation calls.  If the user double-taps "Challenge Chapter"
 * before the first request completes, the second call receives the same promise
 * as the first — only one HTTP request is ever sent.  The server-side unique
 * index provides a second safety net for any race that survives the client gate.
 */

import Constants from 'expo-constants';

import { generateSecureSeed }           from './secureSeed';
import { buildInitialJourneyRun, generateRunData } from './journeyRunLifecycle';
import type { IJourneyRunRepository }   from './journeyRunLifecycle';
import type { JourneyRun, TimeOfDay }   from './types';
import { resolveRunShift }              from './chapterShiftRules';
import { computeFogAfterMove, REVEAL_RADIUS } from './fogCalculator';
import { getChapterTerrainCellCount, BLUEPRINT_PIPELINE_CHAPTERS } from './config';
import { getCanonicalChapterMapArtifact } from './canonicalMapArtifact';

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const BASE_URL = (
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  ((Constants?.expoConfig?.extra as Record<string, unknown>)?.backendUrl as string) ||
  ''
).replace(/\/$/, '');
const API = `${BASE_URL}/api`;
const BACKEND_AVAILABLE = BASE_URL.length > 0;
const TIMEOUT_MS = 8_000;

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BACKEND_AVAILABLE) throw new Error('Backend not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status));
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Returns null instead of throwing for 404 responses. */
async function httpOrNull<T>(path: string): Promise<T | null> {
  try {
    return await http<T>(path);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('API 404')) return null;
    throw err;
  }
}

// ── Shift determination ───────────────────────────────────────────────────────

/**
 * Determine the current TimeOfDay from the device's local hour.
 *
 *   Day     →  06:00–13:59
 *   Evening →  14:00–21:59
 *   Night   →  22:00–05:59
 *
 * This is frozen on the run at creation time and never changes.
 *
 * NOTE: no longer used for run creation — a run's shift is resolved by the
 * ChapterShiftRule layer (chapterShiftRules.ts) and passed explicitly into
 * the create* methods.  Kept for ambience/flavor callers only.
 */
export function getCurrentShift(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 6  && hour < 14) return 'day';
  if (hour >= 14 && hour < 22) return 'evening';
  return 'night';
}

// ── Wire format types ─────────────────────────────────────────────────────────

/** Shape of the raw JSON the backend sends and receives. */
interface WireRun {
  id:                       string;
  schema_version:           number;
  player_id:                string;
  chapter_id:               number;
  attempt_number:           number;
  seed:                     string;
  // Push 4 canonical field — optional for legacy runs that predate this field.
  shift?:                   string;
  status:                   'active' | 'cleared' | 'abandoned';
  created_at:               string;
  updated_at:               string;
  tile_count:               number;
  tiles:                    unknown[];        // opaque — passed through as-is
  start_tile_id:            string;
  current_tile_id:          string;
  gate_anchor_tile_id?:     string;
  area_boss_count:           number;
  inherited_area_boss_keys?: number;  // optional — absent on pre-rechallenge legacy runs
  area_boss_keys_collected:  number;
  chapter_boss_defeated:    boolean;
  explored_tile_count:      number;
  /**
   * Push 6 — tile IDs that have ever entered the player's FOV.
   * Absent on pre-Push-6 legacy runs; derived from tile visibility states on read.
   */
  explored_tile_ids?:       string[];
  stamina_spent:            number;
  // Push 4 canonical inventory fields — optional for legacy runs.
  call_team?:               string[];
  cards?:                   unknown[];
  blessings?:               unknown[];
  pressure?:                number;
  // Push 2 map identity — optional for legacy runs that predate this field.
  map_layout_version?:      string;
  map_blueprint_hash?:      string;
  topology_family?:         string;
}

/**
 * Push 15 renamed TileVisibility values (hidden→unexplored, frontier→visibleNow,
 * revealed→exploredButOutOfVision).  Runs persisted BEFORE the rename still carry
 * the legacy strings; without normalization every tile fails all visibility
 * branches → no terrain, no fog, no movement.  Normalize on read, forever.
 */
const LEGACY_VISIBILITY: Record<string, string> = {
  hidden:   'unexplored',
  frontier: 'visibleNow',
  revealed: 'exploredButOutOfVision',
};

function normalizeTiles(tiles: unknown[], currentTileId: string): JourneyRun['tiles'] {
  // Detect legacy evidence FIRST: only runs persisted before the rename carry
  // any of the old strings.  Canonical runs (even ones that legitimately have
  // no visibleNow frontier, e.g. fully explored maps or class-expanded vision
  // radii) must pass through completely untouched.
  const wasLegacy = (tiles as Array<Record<string, unknown>>)
    .some(t => LEGACY_VISIBILITY[t.visibility as string] !== undefined);
  if (!wasLegacy) return tiles as unknown as JourneyRun['tiles'];

  let out = (tiles as Array<Record<string, unknown>>).map(t => {
    const mapped = LEGACY_VISIBILITY[t.visibility as string];
    return mapped ? { ...t, visibility: mapped } : t;
  }) as unknown as JourneyRun['tiles'];

  // Legacy runs also predate PERSISTED frontier state: the old renderer derived
  // "frontier" at display time, so stored tiles are only hidden/revealed and
  // movement validation (which requires 'visibleNow') rejects every destination.
  // If no tile is visibleNow, recompute the fog ring around the current tile.
  // Legacy runs all pre-date class vision bonuses, so REVEAL_RADIUS is correct.
  const hasFrontier = out.some(t => t.visibility === 'visibleNow');
  if (!hasFrontier && out.some(t => t.id === currentTileId)) {
    // Pass empty exploredTileIds — legacy runs have correct visited flags so
    // exploredButOutOfVision tiles are already permanent; we only need the
    // FOV ring fix here.  The exploredTileIds set is derived from tile states
    // in fromWire() after normalizeTiles() returns.
    ({ tiles: out } = computeFogAfterMove(out, currentTileId, REVEAL_RADIUS, new Set()));
  }
  return out;
}

function fromWire(w: WireRun): JourneyRun {
  const tiles = normalizeTiles(w.tiles, w.current_tile_id);

  // Push 6 — exploredTileIds: tile IDs that have ever entered the player's FOV.
  // For legacy runs (pre-Push-6) the field is absent on the wire; derive it from
  // current tile visibility states so they get full remembered-terrain behaviour
  // immediately on load without a migration script.
  const exploredTileIds: string[] =
    w.explored_tile_ids ??
    tiles.filter(t => t.visibility !== 'unexplored').map(t => t.id);

  return {
    id:                     w.id,
    schemaVersion:          w.schema_version,
    playerId:               w.player_id,
    chapterId:              w.chapter_id,
    attemptNumber:          w.attempt_number,
    seed:                   w.seed,
    // Canonical fields: fall back to sensible defaults for legacy runs.
    shift:                  (w.shift as TimeOfDay | undefined) ?? 'day',
    // Push 2 map identity: '' / 'legacy' for runs that predate these fields.
    // getActiveRun() compares these against the current artifact for blueprint
    // chapters — a mismatch triggers stale-run abandonment.
    mapLayoutVersion:       w.map_layout_version ?? 'legacy',
    mapBlueprintHash:       w.map_blueprint_hash  ?? '',
    topologyFamily:         w.topology_family,
    status:                 w.status,
    createdAt:              w.created_at,
    updatedAt:              w.updated_at,
    tileCount:              w.tile_count,
    tiles,
    startTileId:            w.start_tile_id,
    currentTileId:          w.current_tile_id,
    gateAnchorTileId:       w.gate_anchor_tile_id,
    areaBossCount:          w.area_boss_count,
    inheritedAreaBossKeys:  w.inherited_area_boss_keys ?? 0,
    areaBossKeysCollected:  w.area_boss_keys_collected,
    chapterBossDefeated:    w.chapter_boss_defeated,
    exploredTileCount:      w.explored_tile_count,
    exploredTileIds,
    staminaSpent:           w.stamina_spent,
    callTeam:               w.call_team  ?? [],
    cards:                  (w.cards     ?? []) as JourneyRun['cards'],
    blessings:              (w.blessings ?? []) as JourneyRun['blessings'],
    pressure:               w.pressure   ?? 0,
  };
}

function toWire(run: JourneyRun): Omit<WireRun, 'id' | 'created_at' | 'updated_at'> {
  return {
    schema_version:           run.schemaVersion,
    player_id:                run.playerId,
    chapter_id:               run.chapterId,
    attempt_number:           run.attemptNumber,
    seed:                     run.seed,
    shift:                    run.shift,
    map_layout_version:       run.mapLayoutVersion,
    map_blueprint_hash:       run.mapBlueprintHash,
    topology_family:          run.topologyFamily,
    status:                   run.status,
    tile_count:               run.tileCount,
    tiles:                    run.tiles,
    start_tile_id:            run.startTileId,
    current_tile_id:          run.currentTileId,
    gate_anchor_tile_id:      run.gateAnchorTileId,
    area_boss_count:           run.areaBossCount,
    inherited_area_boss_keys:  run.inheritedAreaBossKeys,
    area_boss_keys_collected:  run.areaBossKeysCollected,
    chapter_boss_defeated:    run.chapterBossDefeated,
    explored_tile_count:      run.exploredTileCount,
    explored_tile_ids:        run.exploredTileIds as string[],
    stamina_spent:            run.staminaSpent,
    call_team:                run.callTeam as string[],
    cards:                    run.cards,
    blessings:                run.blessings,
    pressure:                 run.pressure,
  };
}

// ── Concrete repository ───────────────────────────────────────────────────────

export class JourneyRunRepository implements IJourneyRunRepository {
  /**
   * Client-side concurrency deduplication.
   * Key: `${playerId}:${chapterId}:attempt:${attemptNumber}`
   * Value: in-flight creation promise.
   *
   * A second call with the same key before the first resolves receives the
   * same promise — only one HTTP request is sent.  Entries are deleted on
   * settlement (both resolve and reject) so future retries after errors go
   * through fresh requests.
   */
  private _inflightCreates = new Map<string, Promise<JourneyRun>>();

  // ── Queries ────────────────────────────────────────────────────────────────

  async getActiveRun(playerId: string, chapterId: number): Promise<JourneyRun | null> {
    const raw = await httpOrNull<WireRun>(
      `/player/${playerId}/journey-runs/${chapterId}/active`,
    );
    if (!raw) return null;
    const run = fromWire(raw);
    // Legacy compatibility: runs created before the tile-count doubling (Push 1)
    // carry fewer tiles than the current config expects.
    //
    // Strategy: abandon the stale run on the backend so that getLatestRun
    // (called next by the lifecycle) sees it as abandoned.  The lifecycle
    // then follows the "abandoned → createRechallengeRun" branch, which
    // creates a fresh run (attempt N+1) with the current tile count — no
    // TERRAIN ASSERTION FAIL.
    //
    // We do NOT just return null without abandoning: that would leave an
    // active run on the server, causing createFirstRun to conflict and
    // preventing recovery.
    if (run.tiles.length !== getChapterTerrainCellCount(chapterId)) {
      const expected = getChapterTerrainCellCount(chapterId);
      console.warn(
        `[journeyRunRepository] legacy run for ch${chapterId} has ` +
        `${run.tiles.length} tiles (expected ${expected}); ` +
        `abandoning run ${run.id} so a fresh run can be created.`,
      );
      try {
        await this.abandonRun(run.id);
      } catch (err) {
        // Log but don't crash — the lifecycle will surface a clean error
        // if the backend is in an inconsistent state rather than silently
        // crashing the fog-map screen.
        console.error('[journeyRunRepository] failed to abandon legacy run:', err);
      }
      return null;
    }

    // ── Blueprint identity check (Push 2) ─────────────────────────────────────
    // For chapters on the canonical blueprint pipeline, also validate the map
    // geometry fingerprint.  Tile count alone cannot distinguish an old circular-
    // blob run (60 tiles, hash='') from a new campus-lane run (also 60 tiles, but
    // different physical coordinates and a known hash).
    //
    // Strategy: same as the tile-count guard — abandon the stale run so that
    // getLatestRun sees it as abandoned and the lifecycle creates a rechallenge
    // run with the current geometry.
    if (BLUEPRINT_PIPELINE_CHAPTERS.has(chapterId)) {
      const artifact = getCanonicalChapterMapArtifact(chapterId);
      const hashOk    = run.mapBlueprintHash === artifact.blueprintHash;
      const versionOk = run.mapLayoutVersion  === artifact.mapLayoutVersion;
      if (!hashOk || !versionOk) {
        console.warn(
          `[journeyRunRepository] ch${chapterId}: stale blueprint identity — ` +
          `stored ${run.mapLayoutVersion}/${run.mapBlueprintHash} ` +
          `expected ${artifact.mapLayoutVersion}/${artifact.blueprintHash}; ` +
          `abandoning run ${run.id}`,
        );
        try {
          await this.abandonRun(run.id);
        } catch (err) {
          console.error('[journeyRunRepository] failed to abandon stale-blueprint run:', err);
        }
        return null;
      }
    }

    return run;
  }

  async getLatestRun(playerId: string, chapterId: number): Promise<JourneyRun | null> {
    const raw = await httpOrNull<WireRun>(
      `/player/${playerId}/journey-runs/${chapterId}/latest`,
    );
    if (!raw) return null;
    // No tile-count guard here.  The lifecycle calls getLatestRun after
    // getActiveRun returns null and needs to inspect the run's *status* and
    // *attemptNumber* to decide whether to rechallenge or start fresh.  A
    // stale-tile-count run that has been abandoned (by getActiveRun above)
    // will surface here with status='abandoned', letting the lifecycle call
    // createRechallengeRun correctly.
    return fromWire(raw);
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  async createFirstRun(playerId: string, chapterId: number, shift?: TimeOfDay): Promise<JourneyRun> {
    const key = `${playerId}:${chapterId}:attempt:1`;
    return this._dedupCreate(key, () => this._doCreateFirstRun(playerId, chapterId, shift));
  }

  async createChallengeRun(
    playerId:           string,
    chapterId:          number,
    priorAttemptNumber: number,
    shift?:             TimeOfDay,
  ): Promise<JourneyRun> {
    const newAttempt = priorAttemptNumber + 1;
    const key        = `${playerId}:${chapterId}:attempt:${newAttempt}`;
    return this._dedupCreate(key, () =>
      this._doCreateChallengeRun(playerId, chapterId, priorAttemptNumber, shift),
    );
  }

  async saveRun(run: JourneyRun): Promise<JourneyRun> {
    const raw = await http<WireRun>(
      `/journey-runs/${run.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          tiles:                    run.tiles,
          current_tile_id:          run.currentTileId,
          area_boss_keys_collected: run.areaBossKeysCollected,
          chapter_boss_defeated:    run.chapterBossDefeated,
          explored_tile_count:      run.exploredTileCount,
          explored_tile_ids:        run.exploredTileIds,
          stamina_spent:            run.staminaSpent,
          // Canonical mutable fields
          call_team:                run.callTeam,
          cards:                    run.cards,
          blessings:                run.blessings,
          pressure:                 run.pressure,
        }),
      },
    );
    return fromWire(raw);
  }

  async markRunCleared(runId: string): Promise<JourneyRun> {
    const raw = await http<WireRun>(`/journey-runs/${runId}/cleared`, {
      method: 'PATCH',
    });
    return fromWire(raw);
  }

  async abandonRun(runId: string): Promise<void> {
    await http<unknown>(`/journey-runs/${runId}/abandoned`, {
      method: 'PATCH',
    });
  }

  async createRechallengeRun(
    playerId:             string,
    chapterId:            number,
    priorAttemptNumber:   number,
    inheritedAreaBossKeys: number,
    shift?:               TimeOfDay,
  ): Promise<JourneyRun> {
    const newAttempt = priorAttemptNumber + 1;
    const key        = `${playerId}:${chapterId}:attempt:${newAttempt}`;
    return this._dedupCreate(key, () =>
      this._doCreateRechallengeRun(playerId, chapterId, priorAttemptNumber, inheritedAreaBossKeys, shift),
    );
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Deduplication wrapper.  If a promise for `key` is already in-flight,
   * returns it directly.  Otherwise runs `factory()`, caches the promise,
   * and cleans up after settlement.
   */
  private _dedupCreate(
    key:     string,
    factory: () => Promise<JourneyRun>,
  ): Promise<JourneyRun> {
    const existing = this._inflightCreates.get(key);
    if (existing) return existing;

    const promise = factory().finally(() => this._inflightCreates.delete(key));
    this._inflightCreates.set(key, promise);
    return promise;
  }

  private async _doCreateFirstRun(
    playerId:  string,
    chapterId: number,
    shift?:    TimeOfDay,
  ): Promise<JourneyRun> {
    const seed = generateSecureSeed();
    const run  = this._buildNewRun(playerId, chapterId, 1, seed, 0, shift);
    const wire = toWire(run);
    const raw  = await http<WireRun>(
      `/player/${playerId}/journey-runs`,
      { method: 'POST', body: JSON.stringify(wire) },
    );
    return fromWire(raw);
  }

  private async _doCreateChallengeRun(
    playerId:           string,
    chapterId:          number,
    priorAttemptNumber: number,
    shift?:             TimeOfDay,
  ): Promise<JourneyRun> {
    const seed          = generateSecureSeed();
    const attemptNumber = priorAttemptNumber + 1;
    const run           = this._buildNewRun(playerId, chapterId, attemptNumber, seed, 0, shift);
    const wire          = toWire(run);

    try {
      const raw = await http<WireRun>(
        `/player/${playerId}/journey-runs`,
        { method: 'POST', body: JSON.stringify(wire) },
      );
      return fromWire(raw);
    } catch (err) {
      // 409 Conflict = unique index collision from a concurrent request that
      // slipped through the client-side dedup gate (e.g. different sessions).
      // Return the run that was already created by the other request.
      if (err instanceof Error && err.message.startsWith('API 409')) {
        const existing = await this.getLatestRun(playerId, chapterId);
        if (existing && existing.status === 'active') return existing;
      }
      throw err;
    }
  }

  private async _doCreateRechallengeRun(
    playerId:             string,
    chapterId:            number,
    priorAttemptNumber:   number,
    inheritedAreaBossKeys: number,
    shift?:               TimeOfDay,
  ): Promise<JourneyRun> {
    const seed          = generateSecureSeed();
    const attemptNumber = priorAttemptNumber + 1;
    const run           = this._buildNewRun(playerId, chapterId, attemptNumber, seed, inheritedAreaBossKeys, shift);
    const wire          = toWire(run);

    try {
      const raw = await http<WireRun>(
        `/player/${playerId}/journey-runs`,
        { method: 'POST', body: JSON.stringify(wire) },
      );
      return fromWire(raw);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('API 409')) {
        const existing = await this.getLatestRun(playerId, chapterId);
        if (existing && existing.status === 'active') return existing;
      }
      throw err;
    }
  }

  /** Generate topology + encounters and assemble an in-memory run (no id yet). */
  private _buildNewRun(
    playerId:             string,
    chapterId:            number,
    attemptNumber:        number,
    seed:                 string,
    initialAreaBossKeysCollected = 0,
    explicitShift?:       TimeOfDay,
  ): JourneyRun {
    // Shift comes from the ChapterShiftRule layer (resolved by the lifecycle
    // caller). Fallback resolves the chapter rule with no canonical record —
    // deterministic (never the device clock).
    const shift = explicitShift ?? resolveRunShift(chapterId, () => undefined);
    const {
      topology,
      encounters,
      mapLayoutVersion,
      mapBlueprintHash,
      topologyFamily,
    } = generateRunData(chapterId, seed, shift);
    return buildInitialJourneyRun({
      id: '',      // server will assign the real UUID
      playerId,
      chapterId,
      attemptNumber,
      seed,
      shift,
      topology,
      encounters,
      mapLayoutVersion,
      mapBlueprintHash,
      topologyFamily,
      initialAreaBossKeysCollected,
    });
  }
}

/** Singleton instance for use throughout the app. */
export const journeyRunRepository = new JourneyRunRepository();

// ── Chapter Boss Key helpers ──────────────────────────────────────────────────

/** Shape returned by POST /player/:id/claim-area-boss-key */
export interface ChapterBossKeyResponse {
  keys_collected:  number;
  claimed_tile_ids: string[];
}

/**
 * Idempotently claim an Area Boss key for a chapter on the backend.
 *
 * Returns the updated chapter key state so the caller can apply it locally
 * without a full player re-fetch.  If the tile was already claimed the
 * response is the unchanged state and no DB write is issued server-side.
 *
 * Fails silently on network error (the run-level key was already saved by
 * saveRun; the chapter-level state will sync on the next player fetch).
 */
export async function claimChapterBossKeyOnServer(
  playerId:  string,
  chapterId: number,
  tileId:    string,
): Promise<ChapterBossKeyResponse | null> {
  try {
    return await http<ChapterBossKeyResponse>(
      `/player/${playerId}/claim-area-boss-key`,
      {
        method: 'POST',
        body: JSON.stringify({ chapter_id: chapterId, tile_id: tileId }),
      },
    );
  } catch (err) {
    console.warn('[journeyRepo] claimChapterBossKeyOnServer failed:', err);
    return null;
  }
}
