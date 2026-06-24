import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/src/api/client';
import { PlayerState } from './types';
import { RANKS } from './content';

const STORAGE_KEY = 'clinica.playerId.v1';

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

  const createPlayer = useCallback(async (args: CreatePlayerArgs) => {
    const p = await api.createPlayer(args);
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
    if (rewards.enemyId) {
      // Reset failure count on win
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
    next.runs_completed = next.runs_completed + 1;
    // Auto-advance chapter at thresholds
    const newChapter = next.runs_completed >= 10 ? 3 : next.runs_completed >= 3 ? 2 : 1;
    next.chapter_progress = Math.max(next.chapter_progress || 1, newChapter);
    const updated = await api.updatePlayer(next.id, {
      xp: next.xp, rank: next.rank, rank_index: next.rank_index,
      mastery: next.mastery, codex_unlocked: next.codex_unlocked,
      heroes_owned: next.heroes_owned, kingdom_levels: next.kingdom_levels,
      runs_completed: next.runs_completed, bosses_defeated: next.bosses_defeated,
      failure_counts: next.failure_counts,
      codex_shards: next.codex_shards,
      inventory: next.inventory,
      enemy_mastery: next.enemy_mastery,
      chapter_progress: next.chapter_progress,
    });
    setPlayer(updated);
  }, [player]);

  const recordFailure = useCallback(async (enemyId: string) => {
    if (!player) return;
    const current = (player.failure_counts || {})[enemyId] || 0;
    const newCounts = { ...(player.failure_counts || {}), [enemyId]: current + 1 };
    const updated = await api.updatePlayer(player.id, { failure_counts: newCounts });
    setPlayer(updated);
  }, [player]);

  const syncInventory = useCallback(async (newInventory: Record<string, number>) => {
    if (!player) return;
    const updated = await api.updatePlayer(player.id, { inventory: newInventory });
    setPlayer(updated);
  }, [player]);

  const saveActiveTeam = useCallback(async (teamIds: string[]) => {
    if (!player) return;
    const updated = await api.updatePlayer(player.id, { active_team: teamIds });
    setPlayer(updated);
  }, [player]);

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
    const updated = await api.updatePlayer(player.id, {
      codex_shards: nextShards,
      heroes_owned: nextHeroes,
      summon_history: nextHistory,
    });
    setPlayer(updated);
    return result;
  }, [player]);

  const resetPlayer = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setPlayer(null);
  }, []);

  const value = useMemo<Ctx>(() => ({ player, loading, createPlayer, applyRewards, recordFailure, syncInventory, saveActiveTeam, summonOnce, resetPlayer, refresh }), [player, loading, createPlayer, applyRewards, recordFailure, syncInventory, saveActiveTeam, summonOnce, resetPlayer, refresh]);
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
