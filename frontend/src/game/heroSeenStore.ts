/**
 * heroSeenStore — lightweight "new hero" tracker for the Heroes tab.
 *
 * Persists the set of hero IDs the player has already seen in the Heroes
 * screen to `clinica.seen_heroes` (AsyncStorage — the `clinica.` prefix keeps
 * it inside the account-reset wipe). Heroes present in heroes_owned but not in
 * this set count as NEW and drive the red badge on the Heroes tab and the
 * Recruit shortcut card; opening the Heroes screen marks everything seen and
 * clears the badge.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "clinica.seen_heroes";

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

/** Count of owned hero IDs the player hasn't seen in the Heroes screen yet. */
export function useNewHeroCount(ownedIds: string[]): number {
  const idsKey = ownedIds.join("|");
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    const recalc = async () => {
      const seen = await load();
      if (live) setCount(ownedIds.filter((id) => !seen.includes(id)).length);
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
export function clearHeroSeenCache(): void {
  cache = null;
  subs.forEach((f) => f());
}

/** Mark hero IDs as seen (call when the Heroes screen gains focus). */
export async function markHeroesSeen(ids: string[]): Promise<void> {
  const seen = await load();
  const merged = Array.from(new Set([...seen, ...ids]));
  if (merged.length === seen.length) return;
  cache = merged;
  await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  subs.forEach((f) => f());
}
