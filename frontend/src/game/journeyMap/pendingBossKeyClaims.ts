/**
 * pendingBossKeyClaims.ts
 *
 * AsyncStorage-backed queue for Area Boss key claims that failed to reach
 * the backend.  Each entry is stored idempotently; draining is attempted on
 * the next fog-map mount for the relevant chapter.
 *
 * Queue key:  clinica.pending_boss_key_claims
 * Entry shape: { playerId, chapterId, claimKey }
 *
 * The claim key is run-scoped ("{runId}:{tileId}"), so an entry is naturally
 * idempotent on the server — re-sending an already-claimed key is a no-op.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'clinica.pending_boss_key_claims';

export interface PendingBossKeyClaim {
  playerId:  string;
  chapterId: number;
  claimKey:  string;
}

/** Read the full pending-claim queue (empty array on any read error). */
async function readQueue(): Promise<PendingBossKeyClaim[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingBossKeyClaim[]) : [];
  } catch {
    return [];
  }
}

/** Persist the queue (silently ignores write errors). */
async function writeQueue(queue: PendingBossKeyClaim[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('[pendingBossKeyClaims] writeQueue failed:', e);
  }
}

/**
 * Add a claim to the retry queue.  Deduplicates by claimKey so re-adding the
 * same entry (e.g. if the effect fires twice due to strict-mode double-invoke)
 * is always a no-op.
 */
export async function enqueuePendingBossKeyClaim(
  playerId:  string,
  chapterId: number,
  claimKey:  string,
): Promise<void> {
  const queue = await readQueue();
  const already = queue.some((e) => e.claimKey === claimKey);
  if (already) return;
  queue.push({ playerId, chapterId, claimKey });
  await writeQueue(queue);
}

/**
 * Return all pending claims for a specific player + chapter, leaving other
 * chapters' claims untouched in the queue.
 *
 * The caller is responsible for attempting the claims and then calling
 * `removePendingBossKeyClaims` with the keys it successfully drained.
 */
export async function getPendingBossKeyClaims(
  playerId:  string,
  chapterId: number,
): Promise<PendingBossKeyClaim[]> {
  const queue = await readQueue();
  return queue.filter((e) => e.playerId === playerId && e.chapterId === chapterId);
}

/**
 * Remove entries whose claimKey is in `drainedKeys`.  Call this after
 * successfully flushing a batch of pending claims.
 */
export async function removePendingBossKeyClaims(drainedKeys: string[]): Promise<void> {
  if (drainedKeys.length === 0) return;
  const queue = await readQueue();
  const next  = queue.filter((e) => !drainedKeys.includes(e.claimKey));
  await writeQueue(next);
}
