/**
 * bagSeenStore — lightweight "new item" tracker for the Bag.
 *
 * Persists the set of inventory item names the player has already seen in
 * `clinica.seen_bag_items` (AsyncStorage — the `clinica.` prefix keeps it
 * inside the account-reset wipe). Items present in the inventory but not in
 * this set count as NEW and drive the red badge on the Bag tab; opening the
 * bag marks everything seen and clears the badge.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "clinica.seen_bag_items";

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

/** Count of inventory item names the player hasn't seen in the Bag yet. */
export function useNewBagCount(inventoryNames: string[]): number {
  const namesKey = inventoryNames.join("|");
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    const recalc = async () => {
      const seen = await load();
      if (live) setCount(inventoryNames.filter((n) => !seen.includes(n)).length);
    };
    void recalc();
    const sub = () => void recalc();
    subs.add(sub);
    return () => { live = false; subs.delete(sub); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey]);
  return count;
}

/**
 * Drop the in-memory cache and re-notify subscribers. MUST be called by the
 * account reset flow after it wipes `clinica.*` AsyncStorage keys, or a
 * fresh account keeps the previous account's seen-set until reload.
 */
export function clearBagSeenCache(): void {
  cache = null;
  subs.forEach((f) => f());
}

/** Mark item names as seen (call when the Bag screen opens). */
export async function markBagItemsSeen(names: string[]): Promise<void> {
  const seen = await load();
  const merged = Array.from(new Set([...seen, ...names]));
  if (merged.length === seen.length) return;
  cache = merged;
  await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  subs.forEach((f) => f());
}
