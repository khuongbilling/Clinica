/**
 * journeyMap/journeyRunRepository.ts — PUSH 8
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
 */

import Constants from 'expo-constants';

import { generateSecureSeed }           from './secureSeed';
import { buildInitialJourneyRun, generateRunData } from './journeyRunLifecycle';
import type { IJourneyRunRepository }   from './journeyRunLifecycle';
import type { JourneyRun }              from './types';

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

// ── Wire format types ─────────────────────────────────────────────────────────

/** Shape of the raw JSON the backend sends and receives. */
interface WireRun {
  id:                      string;
  schema_version:          number;
  player_id:               string;
  chapter_id:              number;
  attempt_number:          number;
  seed:                    string;
  status:                  'active' | 'cleared';
  created_at:              string;
  updated_at:              string;
  tile_count:              number;
  tiles:                   unknown[];        // opaque — passed through as-is
  start_tile_id:           string;
  current_tile_id:         string;
  gate_anchor_tile_id?:    string;
  area_boss_count:         number;
  area_boss_keys_collected: number;
  chapter_boss_defeated:   boolean;
  explored_tile_count:     number;
  stamina_spent:           number;
}

function fromWire(w: WireRun): JourneyRun {
  return {
    id:                     w.id,
    schemaVersion:          w.schema_version,
    playerId:               w.player_id,
    chapterId:              w.chapter_id,
    attemptNumber:          w.attempt_number,
    seed:                   w.seed,
    status:                 w.status,
    createdAt:              w.created_at,
    updatedAt:              w.updated_at,
    tileCount:              w.tile_count,
    tiles:                  w.tiles as JourneyRun['tiles'],
    startTileId:            w.start_tile_id,
    currentTileId:          w.current_tile_id,
    gateAnchorTileId:       w.gate_anchor_tile_id,
    areaBossCount:          w.area_boss_count,
    areaBossKeysCollected:  w.area_boss_keys_collected,
    chapterBossDefeated:    w.chapter_boss_defeated,
    exploredTileCount:      w.explored_tile_count,
    staminaSpent:           w.stamina_spent,
  };
}

function toWire(run: JourneyRun): Omit<WireRun, 'id' | 'created_at' | 'updated_at'> & {
  chapter_id: number;
} {
  return {
    schema_version:          run.schemaVersion,
    player_id:               run.playerId,
    chapter_id:              run.chapterId,
    attempt_number:          run.attemptNumber,
    seed:                    run.seed,
    status:                  run.status,
    tile_count:              run.tileCount,
    tiles:                   run.tiles,
    start_tile_id:           run.startTileId,
    current_tile_id:         run.currentTileId,
    gate_anchor_tile_id:     run.gateAnchorTileId,
    area_boss_count:         run.areaBossCount,
    area_boss_keys_collected: run.areaBossKeysCollected,
    chapter_boss_defeated:   run.chapterBossDefeated,
    explored_tile_count:     run.exploredTileCount,
    stamina_spent:           run.staminaSpent,
  };
}

// ── Concrete repository ───────────────────────────────────────────────────────

export class JourneyRunRepository implements IJourneyRunRepository {
  // ── Queries ────────────────────────────────────────────────────────────────

  async getActiveRun(playerId: string, chapterId: number): Promise<JourneyRun | null> {
    const raw = await httpOrNull<WireRun>(
      `/player/${playerId}/journey-runs/${chapterId}/active`,
    );
    return raw ? fromWire(raw) : null;
  }

  async getLatestRun(playerId: string, chapterId: number): Promise<JourneyRun | null> {
    const raw = await httpOrNull<WireRun>(
      `/player/${playerId}/journey-runs/${chapterId}/latest`,
    );
    return raw ? fromWire(raw) : null;
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  async createFirstRun(playerId: string, chapterId: number): Promise<JourneyRun> {
    const seed     = generateSecureSeed();
    const run      = this._buildNewRun(playerId, chapterId, 1, seed);
    const wire     = toWire(run);
    const raw      = await http<WireRun>(
      `/player/${playerId}/journey-runs`,
      { method: 'POST', body: JSON.stringify(wire) },
    );
    return fromWire(raw);
  }

  async createChallengeRun(
    playerId:           string,
    chapterId:          number,
    priorAttemptNumber: number,
  ): Promise<JourneyRun> {
    const seed         = generateSecureSeed();
    const attemptNumber = priorAttemptNumber + 1;
    const run          = this._buildNewRun(playerId, chapterId, attemptNumber, seed);
    const wire         = toWire(run);

    try {
      const raw = await http<WireRun>(
        `/player/${playerId}/journey-runs`,
        { method: 'POST', body: JSON.stringify(wire) },
      );
      return fromWire(raw);
    } catch (err) {
      // 409 Conflict = unique index collision from a concurrent request.
      // Return the run that was already created by the other request.
      if (err instanceof Error && err.message.startsWith('API 409')) {
        const existing = await this.getLatestRun(playerId, chapterId);
        if (existing && existing.status === 'active') return existing;
      }
      throw err;
    }
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
          stamina_spent:            run.staminaSpent,
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

  // ── Internal helpers ───────────────────────────────────────────────────────

  /** Generate topology + encounters and assemble an in-memory run (no id yet). */
  private _buildNewRun(
    playerId:      string,
    chapterId:     number,
    attemptNumber: number,
    seed:          string,
  ): JourneyRun {
    const { topology, encounters } = generateRunData(chapterId, seed);
    return buildInitialJourneyRun({
      id: '',      // server will assign the real UUID
      playerId,
      chapterId,
      attemptNumber,
      seed,
      topology,
      encounters,
    });
  }
}

/** Singleton instance for use throughout the app. */
export const journeyRunRepository = new JourneyRunRepository();
