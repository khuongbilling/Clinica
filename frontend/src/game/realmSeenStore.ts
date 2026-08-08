/**
 * realmSeenStore — lightweight "new building" tracker for the Realm shortcut.
 *
 * Persists the set of building IDs the player has already seen on the Realm
 * screen to `clinica.seen_realm_buildings` (AsyncStorage — the `clinica.`
 * prefix keeps it inside the account-reset wipe). Buildings that are unlocked
 * (atriumLevelRequired ≤ current atrium level) but not yet in this set count
 * as NEW and drive the red badge on the Realm shortcut card; opening the Realm
 * screen marks all currently-unlocked buildings as seen and clears the badge.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "clinica.seen_realm_buildings";

let cache: string[] | null = null;
const subs = new Set<() => void>();

async function load(): Promise<string[]> {
  if (cache) return cache;
  try {
    cache = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "[]") as string[];
  } catch {
    cache = [];
  }
  return cache;
}

/**
 * Count of unlocked building IDs the player hasn't seen in the Realm yet.
 * Pass the IDs of buildings currently unlocked for the player.
 */
export function useNewRealmBuildingCount(unlockedIds: string[]): number {
  const idsKey = unlockedIds.join("|");
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    const recalc = async () => {
      const seen = await load();
      if (live) setCount(unlockedIds.filter((id) => !seen.includes(id)).length);
    };
    void recalc();
    const sub = () => void recalc();
    subs.add(sub);
    return () => { live = false; subs.delete(sub); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);
  return count;
}

/**
 * Drop the in-memory cache and re-notify subscribers. MUST be called by the
 * account reset flow after it wipes `clinica.*` AsyncStorage keys, or a fresh
 * account keeps the previous account's seen-set until reload.
 */
export function clearRealmSeenCache(): void {
  cache = null;
  subs.forEach((f) => f());
}

/** Mark building IDs as seen (call when the Realm screen gains focus). */
export async function markRealmBuildingsSeen(ids: string[]): Promise<void> {
  const seen = await load();
  const merged = Array.from(new Set([...seen, ...ids]));
  if (merged.length === seen.length) return;
  cache = merged;
  await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  subs.forEach((f) => f());
}
