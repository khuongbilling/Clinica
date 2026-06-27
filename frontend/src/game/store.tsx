import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/src/api/client';
import { PlayerState } from './types';
import { RANKS } from './content';

const STORAGE_KEY = 'clinica.player.v2';

type CreatePlayerArgs = {
  name: string;
  aptitude: string;
  recommended_aptitude?: string;
  learning_goal?: string;
  learning_profile?: string;
  codex_depth?: string;
};

type Ctx = {
  player: PlayerState | null;
  loading: boolean;
  createPlayer: (args: CreatePlayerArgs) => Promise<void>;
  applyRewards: (rewards: { xp?: number; codex?: string[]; mastery?: Partial<PlayerState['mastery']>; bossId?: string; heroes?: string[]; buildings?: Record<string, number>; enemyId?: string; codexShards?: number; inventoryDelta?: Record<string, number>; enemyName?: string }) => Promise<void>;
  recordFailure: (enemyId: string) => Promise<void>;
  syncInventory: (newInventory: Record<string, number>) => Promise<void>;
  saveActiveTeam: (teamIds: string[]) => Promise<void>;
  summonOnce: () => Promise<{ entry: any; duplicate: boolean; message: string } | null>;
  resetPlayer: () => Promise<void>;
  refresh: () => Promise<void>;
};

const PlayerContext = createContext<Ctx | null>(null);

function applyXp(p: PlayerState, addXp: number): PlayerState {
  const newXp = p.xp + addXp;
  let idx = p.rank_index;
  while (idx < RANKS.length - 1 && newXp >= RANKS[idx + 1].xpRequired) idx++;
  return { ...p, xp: newXp, rank: RANKS[idx].name, rank_index: idx };
}

function makeLocalId(): string {
  return 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function defaultPlayer(args: CreatePlayerArgs, id: string): PlayerState {
  const aptitudeStartingHero: Record<string, string> = {
    guardian: 'novice_guardian',
    sage: 'apprentice_seer',
    warden: 'junior_warden',
    weaver: 'data_acolyte',
  };
  const starting = aptitudeStartingHero[args.aptitude] || 'novice_guardian';
  return {
    id,
    name: (args.name || 'Healer').trim().slice(0, 24) || 'Healer',
    aptitude: args.aptitude as any,
    recommended_aptitude: args.recommended_aptitude as any || null,
    learning_goal: args.learning_goal || null,
    learning_profile: args.learning_profile || null,
    codex_depth: args.codex_depth || 'simple',
    onboarding_complete: true,
    rank: 'Sprout Healer',
    rank_index: 0,
    xp: 0,
    mastery: { assessment: 0, stabilization: 0, pharmacology: 0, judgment: 0, command: 0, systems: 0 },
    codex_unlocked: [],
    heroes_owned: [starting, 'village_caretaker'],
    active_team: [starting, 'village_caretaker'],
    kingdom_levels: {
      academy_of_healing: 1,
      library_of_knowledge: 1,
      hall_of_heroes: 1,
      apothecary: 1,
    },
    runs_completed: 0,
    bosses_defeated: [],
    failure_counts: {},
    inventory: {
      'Albuterol Mist': 1,
      'Glucose Gel': 1,
      'Fluid Bolus': 1,
      'Isolation Kit': 1,
      'Lab Token': 2,
    },
    codex_shards: 50,
    summon_history: [],
    enemy_mastery: {},
    chapter_progress: 1,
    region_progress: {},
  };
}

async function saveLocal(p: PlayerState) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

async function loadLocal(): Promise<PlayerState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlayerState;
  } catch {
    return null;
  }
}

async function trySyncToBackend(p: PlayerState): Promise<PlayerState> {
  try {
    const updated = await api.updatePlayer(p.id, p as any);
    return updated;
  } catch {
    return p;
  }
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const local = await loadLocal();
      if (!local) { setPlayer(null); setLoading(false); return; }
      setPlayer(local);

      try {
        const remote = await api.getPlayer(local.id);
        setPlayer(remote);
        await saveLocal(remote);
      } catch {
        // Backend unavailable — use local data
      }
    } catch (e) {
      console.warn('Failed to load player', e);
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createPlayer = useCallback(async (args: CreatePlayerArgs) => {
    let p: PlayerState;
    try {
      p = await api.createPlayer(args);
    } catch {
      p = defaultPlayer(args, makeLocalId());
    }
    await saveLocal(p);
    setPlayer(p);
  }, []);

  const updateState = useCallback(async (next: PlayerState) => {
    setPlayer(next);
    await saveLocal(next);
    trySyncToBackend(next);
  }, []);

  const applyRewards = useCallback(async (rewards: Parameters<Ctx['applyRewards']>[0] & { regionId?: string }) => {
    if (!player) return;
    let next = { ...player };
    if (rewards.xp) next = applyXp(next, rewards.xp);
    if (rewards.codex?.length) {
      next.codex_unlocked = Array.from(new Set([...next.codex_unlocked, ...rewards.codex]));
    }
    if (rewards.mastery) {
      next.mastery = { ...next.mastery };
      for (const [k, v] of Object.entries(rewards.mastery)) {
        (next.mastery as any)[k] = ((next.mastery as any)[k] || 0) + (v as number);
      }
    }
    if (rewards.bossId && !next.bosses_defeated.includes(rewards.bossId)) {
      next.bosses_defeated = [...next.bosses_defeated, rewards.bossId];
    }
    if (rewards.heroes) {
      next.heroes_owned = Array.from(new Set([...next.heroes_owned, ...rewards.heroes]));
    }
    if (rewards.buildings) {
      next.kingdom_levels = { ...next.kingdom_levels, ...rewards.buildings };
    }
    if (rewards.enemyId) {
      next.failure_counts = { ...(next.failure_counts || {}), [rewards.enemyId]: 0 };
    }
    if (rewards.codexShards) {
      next.codex_shards = (next.codex_shards || 0) + rewards.codexShards;
    }
    if (rewards.inventoryDelta) {
      next.inventory = { ...(next.inventory || {}) };
      for (const [k, v] of Object.entries(rewards.inventoryDelta)) {
        next.inventory[k] = (next.inventory[k] || 0) + v;
      }
    }
    if (rewards.enemyName) {
      next.enemy_mastery = { ...(next.enemy_mastery || {}) };
      next.enemy_mastery[rewards.enemyName] = (next.enemy_mastery[rewards.enemyName] || 0) + 1;
    }
    if (rewards.regionId) {
      next.region_progress = { ...(next.region_progress || {}) };
      next.region_progress[rewards.regionId] = (next.region_progress[rewards.regionId] || 0) + 1;
    }
    next.runs_completed = next.runs_completed + 1;
    const newChapter = next.runs_completed >= 10 ? 3 : next.runs_completed >= 3 ? 2 : 1;
    next.chapter_progress = Math.max(next.chapter_progress || 1, newChapter);
    await updateState(next);
  }, [player, updateState]);

  const recordFailure = useCallback(async (enemyId: string) => {
    if (!player) return;
    const current = (player.failure_counts || {})[enemyId] || 0;
    const next = { ...player, failure_counts: { ...(player.failure_counts || {}), [enemyId]: current + 1 } };
    await updateState(next);
  }, [player, updateState]);

  const syncInventory = useCallback(async (newInventory: Record<string, number>) => {
    if (!player) return;
    await updateState({ ...player, inventory: newInventory });
  }, [player, updateState]);

  const saveActiveTeam = useCallback(async (teamIds: string[]) => {
    if (!player) return;
    await updateState({ ...player, active_team: teamIds });
  }, [player, updateState]);

  const summonOnce = useCallback(async () => {
    if (!player) return null;
    const { summonOnce: roll, SUMMON_COST, DUPLICATE_REFUND } = await import('./gacha');
    if ((player.codex_shards || 0) < SUMMON_COST) {
      return { entry: null as any, duplicate: false, message: 'Not enough Codex Shards.' };
    }
    const result = roll(player.heroes_owned);
    const nextShards = (player.codex_shards || 0) - SUMMON_COST + (result.duplicate ? DUPLICATE_REFUND : 0);
    const nextHeroes = result.duplicate ? player.heroes_owned : [...player.heroes_owned, result.entry.heroId];
    const nextHistory = [
      ...(player.summon_history || []),
      { hero: result.entry.name, rarity: result.entry.rarity, duplicate: result.duplicate, date: new Date().toISOString() },
    ];
    await updateState({ ...player, codex_shards: nextShards, heroes_owned: nextHeroes, summon_history: nextHistory });
    return result;
  }, [player, updateState]);

  const resetPlayer = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setPlayer(null);
  }, []);

  const value = useMemo<Ctx>(() => ({
    player, loading, createPlayer, applyRewards, recordFailure,
    syncInventory, saveActiveTeam, summonOnce, resetPlayer, refresh,
  }), [player, loading, createPlayer, applyRewards, recordFailure, syncInventory, saveActiveTeam, summonOnce, resetPlayer, refresh]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
