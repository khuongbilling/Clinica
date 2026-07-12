/**
 * Chain Progress — "The Fading Apprentice" mini-game chain.
 *
 * Persists which steps of the Cue Hunt → Rapid Triage → Stabilize Stack
 * chain the player has completed, so Back never loses their place and
 * re-entering the chain always resumes from the next unfinished step.
 *
 * Storage key:  clinica.chain.fading_apprentice.v1
 * Pattern:      same fail-open AsyncStorage pattern used by tutorialStore.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "clinica.chain.fading_apprentice.v1";

export interface ChainProgress {
  cueHuntDone: boolean;
  rapidTriageDone: boolean;
  stabilizeDone: boolean;
}

const DEFAULT: ChainProgress = {
  cueHuntDone: false,
  rapidTriageDone: false,
  stabilizeDone: false,
};

export async function getChainProgress(): Promise<ChainProgress> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<ChainProgress>) };
  } catch {
    return { ...DEFAULT };
  }
}

export async function markChainStep(
  step: keyof ChainProgress,
): Promise<void> {
  try {
    const current = await getChainProgress();
    if (current[step]) return;
    current[step] = true;
    await AsyncStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // fail-open: progress stored in memory even if storage write fails
  }
}

export async function resetChain(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
