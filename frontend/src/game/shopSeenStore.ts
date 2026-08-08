/**
 * shopSeenStore — lightweight "new shop section" tracker for the Shop tab.
 *
 * Persists the set of shop section IDs the player has seen while the Shop was
 * open to `clinica.seen_shop_sections` (AsyncStorage — the `clinica.` prefix
 * keeps it inside the account-reset wipe). Unlocked section IDs not in this
 * set count as NEW and drive the red badge on the Shop tab; opening the Shop
 * marks all currently-unlocked sections as seen and clears the badge.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "clinica.seen_shop_sections";

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
 * Count of unlocked shop section IDs the player hasn't seen in the Shop yet.
 * Pass the IDs of sections currently visible and accessible to the player.
 */
export function useNewShopSectionCount(unlockedIds: string[]): number {
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
export function clearShopSeenCache(): void {
  cache = null;
  subs.forEach((f) => f());
}

/** Mark shop section IDs as seen (call when the Shop screen gains focus). */
export async function markShopSectionsSeen(ids: string[]): Promise<void> {
  const seen = await load();
  const merged = Array.from(new Set([...seen, ...ids]));
  if (merged.length === seen.length) return;
  cache = merged;
  await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  subs.forEach((f) => f());
}
