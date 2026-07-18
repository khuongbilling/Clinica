/**
 * Ephemeral per-session item-loadout store.
 * Shared between /mission-loadout ↔ /item-bag navigation.
 * Not persisted — resets on app reload (intentional: loadout is per-battle).
 */

let _items: string[] = [];

export function getLoadoutItems(): string[] {
  return [..._items];
}

export function setLoadoutItems(ids: string[]): void {
  _items = ids.slice(0, 3);
}

export function clearLoadoutItems(): void {
  _items = [];
}
