/**
 * Per-session item-loadout store.
 * Shared between /mission-loadout ↔ /item-bag navigation.
 *
 * The in-memory buffer serves two roles:
 *   1. Item-bag communication channel — item-bag calls setLoadoutItems() before
 *      navigating back; the `_fromItemBag` flag marks these picks as "fresh".
 *   2. Pre-populate source for item-bag — mission-loadout calls syncCurrentLoadout()
 *      after hydrating so item-bag sees the current selection when re-opened.
 *
 * AsyncStorage holds the last selection PER mission type so returning to any
 * mission-type prep screen (boss / battle / ward_defense / …) restores the
 * player's preferred kit even after an app restart.
 *
 * Also hosts the hero-picker communication channel (pendingHeroPick) which
 * follows the same drain-once pattern used by the item-bag channel.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const PERSIST_PREFIX = "clinica.loadout.items.";

let _items: string[] = [];
let _fromItemBag = false;

// ── Hero-picker communication channel ────────────────────────────────────────

type HeroPick = { slot: number; heroId: string };
let _pendingHeroPick: HeroPick | null = null;

/**
 * Called by /hero-picker on confirm — stores the player's pick so
 * mission-loadout can consume it on next focus via drainHeroPick().
 */
export function setPendingHeroPick(pick: HeroPick): void {
  _pendingHeroPick = pick;
}

/**
 * Drain the hero pick exactly once. Returns the pick if hero-picker just
 * confirmed a selection, otherwise returns null.
 * Call on mission-loadout focus.
 */
export function drainHeroPick(): HeroPick | null {
  const pick = _pendingHeroPick;
  _pendingHeroPick = null;
  return pick;
}

// ── In-memory API (used by item-bag) ─────────────────────────────────────────

/** Read the current in-memory loadout (item-bag uses this to pre-populate). */
export function getLoadoutItems(): string[] {
  return [..._items];
}

/**
 * Called by item-bag on confirm — stores the player's pick and marks it as a
 * fresh item-bag selection so mission-loadout knows to consume it on next focus.
 */
export function setLoadoutItems(ids: string[]): void {
  _items = ids.slice(0, 3);
  _fromItemBag = true;
}

export function clearLoadoutItems(): void {
  _items = [];
  _fromItemBag = false;
}

/**
 * Drain the item-bag selection exactly once.
 * Returns the items if they were just set by item-bag (and clears the flag),
 * or null if the in-memory buffer does NOT represent a fresh item-bag pick
 * (e.g. it was set by syncCurrentLoadout or is empty).
 *
 * Call this on mission-loadout focus to decide whether to use the item-bag
 * result or fall back to the per-type persisted loadout.
 */
export function drainItemBagSelection(): string[] | null {
  if (!_fromItemBag) return null;
  _fromItemBag = false;
  return [..._items];
}

/**
 * Called by mission-loadout after it has resolved its item selection (from
 * the item-bag result or from the persisted store).  Syncs the resolved items
 * back to the in-memory buffer WITHOUT setting the item-bag flag, so if the
 * player taps "Browse Supplies" again the item-bag screen opens pre-populated
 * with the current selection — without accidentally being treated as a fresh
 * item-bag pick on the next mission-loadout focus.
 */
export function syncCurrentLoadout(ids: string[]): void {
  _items = ids.slice(0, 3);
  _fromItemBag = false;
}

// ── AsyncStorage API (per-mission-type persistence) ──────────────────────────

/**
 * Load the last persisted item selection for a given mission type.
 * Returns an empty array when nothing has been saved yet.
 */
export async function loadPersistedLoadoutForType(missionType: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PERSIST_PREFIX + missionType);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return (parsed as unknown[])
        .filter((x): x is string => typeof x === "string")
        .slice(0, 3);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Persist the current item selection for a given mission type.
 * Silently swallows errors so a storage failure never blocks the player.
 */
export async function persistLoadoutForType(missionType: string, ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PERSIST_PREFIX + missionType, JSON.stringify(ids.slice(0, 3)));
  } catch {
    // storage failures are non-fatal
  }
}
