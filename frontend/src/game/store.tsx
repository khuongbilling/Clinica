import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/src/api/client';
import { PlayerState } from './types';
import { RANKS } from './content';

const STORAGE_KEY = 'clinica.playerId.v1';

type Ctx = {
  player: PlayerState | null;
  loading: boolean;
  createPlayer: (name: string, aptitude: string) => Promise<void>;
  applyRewards: (rewards: { xp?: number; codex?: string[]; mastery?: Partial<PlayerState['mastery']>; bossId?: string; heroes?: string[]; buildings?: Record<string, number> }) => Promise<void>;
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

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const id = await AsyncStorage.getItem(STORAGE_KEY);
      if (!id) { setPlayer(null); setLoading(false); return; }
      const p = await api.getPlayer(id);
      setPlayer(p);
    } catch (e) {
      console.warn('Failed to load player', e);
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createPlayer = useCallback(async (name: string, aptitude: string) => {
    const p = await api.createPlayer(name, aptitude);
    await AsyncStorage.setItem(STORAGE_KEY, p.id);
    setPlayer(p);
  }, []);

  const applyRewards = useCallback(async (rewards: Parameters<Ctx['applyRewards']>[0]) => {
    if (!player) return;
    let next = { ...player };
    if (rewards.xp) next = applyXp(next, rewards.xp);
    if (rewards.codex && rewards.codex.length) {
      const set = new Set([...next.codex_unlocked, ...rewards.codex]);
      next.codex_unlocked = Array.from(set);
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
      const set = new Set([...next.heroes_owned, ...rewards.heroes]);
      next.heroes_owned = Array.from(set);
    }
    if (rewards.buildings) {
      next.kingdom_levels = { ...next.kingdom_levels, ...rewards.buildings };
    }
    next.runs_completed = next.runs_completed + 1;
    const updated = await api.updatePlayer(next.id, {
      xp: next.xp, rank: next.rank, rank_index: next.rank_index,
      mastery: next.mastery, codex_unlocked: next.codex_unlocked,
      heroes_owned: next.heroes_owned, kingdom_levels: next.kingdom_levels,
      runs_completed: next.runs_completed, bosses_defeated: next.bosses_defeated,
    });
    setPlayer(updated);
  }, [player]);

  const resetPlayer = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setPlayer(null);
  }, []);

  const value = useMemo<Ctx>(() => ({ player, loading, createPlayer, applyRewards, resetPlayer, refresh }), [player, loading, createPlayer, applyRewards, resetPlayer, refresh]);
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
