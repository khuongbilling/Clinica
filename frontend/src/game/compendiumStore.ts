/**
 * Persists enemy discovery state for the Clinical Compendium.
 * Enemies are unlocked after being defeated in Ward Defense.
 * Stored in AsyncStorage so it survives app reloads.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const COMPENDIUM_STORAGE_KEY = "clinica.wd_compendium_v1";

export async function markEnemiesDefeated(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    const raw  = await AsyncStorage.getItem(COMPENDIUM_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : { defeated: [] };
    const next = Array.from(new Set([...(data.defeated ?? []), ...ids]));
    await AsyncStorage.setItem(COMPENDIUM_STORAGE_KEY, JSON.stringify({ defeated: next }));
  } catch (_) {}
}

export async function getDefeatedEnemies(): Promise<string[]> {
  try {
    const raw  = await AsyncStorage.getItem(COMPENDIUM_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data.defeated ?? [];
  } catch (_) { return []; }
}
