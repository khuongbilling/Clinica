import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/src/api/client';
import { PlayerState } from './types';
import { RANKS } from './content';
import { canEvolve, defaultProgress, evolveProgress, getProgress, DUP_SHARD_BONUS, MAX_STAR } from './evolution';
import { MAX_STAMINA, ENCOUNTER_COST, regen } from './stamina';
import { defaultWellnessState, resolveWellnessLog, WellnessLogInput, WellnessResult } from './wellness';
import {
  defaultOwnedUnits, sanitizeLoadout, rollGachaUnit, STARTER_UNIT_IDS,
  GACHA_COST, MASTERY_LEVEL_CAP, WARD_UNIT_META, getMasteryRequirement,
} from './units';

const STORAGE_KEY = 'clinica.player.v2';

// Backfill hero_progression so every owned hero has a star/copies entry,
// and clamp any malformed values. Keeps older/remote saves compatible.
function normalizeProgression(p: PlayerState): PlayerState {
  const src = p.hero_progression || {};
  const prog: Record<string, { star: number; copies: number; level: number; locked: boolean; favorite: boolean }> = {};
  let changed = !p.hero_progression;
  for (const [id, raw] of Object.entries(src)) {
    const star = Math.min(MAX_STAR, Math.max(1, Math.round(Number(raw?.star) || 1)));
    const copies = Math.max(0, Math.round(Number(raw?.copies) || 0));
    const level = Math.max(1, Math.round(Number((raw as any)?.level) || 1));
    const locked = !!(raw as any)?.locked;
    const favorite = !!(raw as any)?.favorite;
    prog[id] = { star, copies, level, locked, favorite };
    if (star !== raw?.star || copies !== raw?.copies || level !== (raw as any)?.level) changed = true;
  }
  for (const id of p.heroes_owned || []) {
    if (!prog[id]) { prog[id] = defaultProgress() as any; changed = true; }
  }
  let out = changed ? { ...p, hero_progression: prog as any } : p;
  if (!out.class_trainees) {
    out = { ...out, class_trainees: {} };
  }
  if (out.university_credits == null) {
    out = { ...out, university_credits: 0 };
  }
  if (out.stamina == null || !out.stamina_updated_at) {
    out = {
      ...out,
      stamina: out.stamina ?? MAX_STAMINA,
      stamina_updated_at: out.stamina_updated_at || new Date().toISOString(),
    };
  }
  if (!out.wellness) {
    out = { ...out, wellness: defaultWellnessState() };
  }
  if (out.crowns == null) {
    out = { ...out, crowns: 0 };
  }
  if (!out.owned_skins || !out.owned_upgrades || out.equipped_skin == null) {
    out = {
      ...out,
      owned_skins: out.owned_skins || [],
      equipped_skin: out.equipped_skin || '',
      owned_upgrades: out.owned_upgrades || [],
    };
  }
  if (!out.owned_units || Object.keys(out.owned_units).length === 0) {
    out = { ...out, owned_units: defaultOwnedUnits() };
  }
  if (!out.unit_shards) {
    out = { ...out, unit_shards: {} };
  }
  // Always sanitize (dedupe, owned-only, cap at LOADOUT_SIZE); fall back to
  // starters when empty so a malformed/over-long persisted loadout is corrected.
  {
    const base = (out.ward_loadout && out.ward_loadout.length > 0) ? out.ward_loadout : STARTER_UNIT_IDS;
    out = { ...out, ward_loadout: sanitizeLoadout(base, out.owned_units!) };
  }
  return out;
}

type CreatePlayerArgs = {
  name: string;
  aptitude: string;
  recommended_aptitude?: string;
  learning_goal?: string;
  learning_profile?: string;
  difficulty?: string;
  player_class?: string;
  system_affinity?: string;
  explanation_style?: string;
  codex_depth?: string;
};

type Ctx = {
  player: PlayerState | null;
  loading: boolean;
  createPlayer: (args: CreatePlayerArgs) => Promise<void>;
  applyRewards: (rewards: { xp?: number; codex?: string[]; mastery?: Partial<PlayerState['mastery']>; bossId?: string; heroes?: string[]; buildings?: Record<string, number>; enemyId?: string; codexShards?: number; crowns?: number; inventoryDelta?: Record<string, number>; enemyName?: string }) => Promise<void>;
  purchaseItem: (itemName: string, price: number, qty?: number) => Promise<{ ok: boolean; message: string }>;
  purchaseSkin: (skinId: string, price: number) => Promise<{ ok: boolean; message: string }>;
  equipSkin: (skinId: string) => Promise<{ ok: boolean; message: string }>;
  purchaseUpgrade: (upgradeId: string, price: number) => Promise<{ ok: boolean; message: string }>;
  refillStamina: (price: number, amount: number) => Promise<{ ok: boolean; message: string }>;
  pullGacha: () => Promise<{ ok: boolean; message: string; typeId?: string; isNew?: boolean; level?: number }>;
  upgradeUnitMastery: (typeId: string) => Promise<{ ok: boolean; message: string; level?: number }>;
  setWardLoadout: (ids: string[]) => Promise<{ ok: boolean; message: string }>;
  recordFailure: (enemyId: string) => Promise<void>;
  syncInventory: (newInventory: Record<string, number>) => Promise<void>;
  saveActiveTeam: (teamIds: string[]) => Promise<void>;
  summonOnce: () => Promise<{ entry: any; duplicate: boolean; message: string } | null>;
  evolveHero: (heroId: string) => Promise<{ ok: boolean; message: string; star?: number }>;
  recruitOnce: () => Promise<{ ok: boolean; message: string; result?: import('./university').RecruitResult }>;
  recruitTen: () => Promise<{ ok: boolean; message: string; results?: import('./university').RecruitResult[] }>;
  promoteHeroCert: (heroId: string) => Promise<{ ok: boolean; message: string }>;
  trainHero: (heroId: string) => Promise<{ ok: boolean; message: string }>;
  toggleHeroLock: (heroId: string) => Promise<void>;
  toggleHeroFavorite: (heroId: string) => Promise<void>;
  spendStamina: (cost?: number) => Promise<boolean>;
  logWellnessActivity: (input: WellnessLogInput) => Promise<WellnessResult | null>;
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
    difficulty: args.difficulty || null,
    player_class: args.player_class || null,
    system_affinity: args.system_affinity || null,
    explanation_style: args.explanation_style || null,
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
    crowns: 0,
    owned_skins: [],
    equipped_skin: '',
    owned_upgrades: [],
    owned_units: defaultOwnedUnits(),
    unit_shards: {},
    ward_loadout: [...STARTER_UNIT_IDS],
    summon_history: [],
    enemy_mastery: {},
    chapter_progress: 1,
    region_progress: {},
    stamina: MAX_STAMINA,
    stamina_updated_at: new Date().toISOString(),
    wellness: defaultWellnessState(),
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
  // Mirror of the latest player used for atomic, synchronous spends (e.g.
  // stamina) so concurrent calls in the same tick can't read stale state.
  const playerRef = useRef<PlayerState | null>(null);
  useEffect(() => { playerRef.current = player; }, [player]);

  const refresh = useCallback(async () => {
    try {
      const local = await loadLocal();
      if (!local) { setPlayer(null); setLoading(false); return; }
      setPlayer(normalizeProgression(local));

      try {
        const remote = normalizeProgression(await api.getPlayer(local.id));
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
      p = normalizeProgression(await api.createPlayer(args));
    } catch {
      p = normalizeProgression(defaultPlayer(args, makeLocalId()));
    }
    await saveLocal(p);
    setPlayer(p);
  }, []);

  const updateState = useCallback(async (next: PlayerState) => {
    playerRef.current = next;
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
      const prog = { ...(next.hero_progression || {}) };
      for (const id of rewards.heroes) {
        if (!prog[id]) prog[id] = defaultProgress();
      }
      next.hero_progression = prog;
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
    if (rewards.crowns) {
      next.crowns = (next.crowns || 0) + rewards.crowns;
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
    const { summonOnce: roll, SUMMON_COST } = await import('./gacha');
    if ((player.codex_shards || 0) < SUMMON_COST) {
      return { entry: null as any, duplicate: false, message: 'Not enough Codex Shards.' };
    }
    const result = roll(player.heroes_owned);
    let nextShards = (player.codex_shards || 0) - SUMMON_COST;
    let nextHeroes = player.heroes_owned;
    const prog = { ...(player.hero_progression || {}) };
    let message = result.message;
    if (result.duplicate) {
      // Duplicate → +1 evolution copy toward that hero, plus a small shard bonus.
      nextShards += DUP_SHARD_BONUS;
      const cur = prog[result.entry.heroId] || defaultProgress();
      prog[result.entry.heroId] = { ...cur, copies: cur.copies + 1 };
      message = `${result.entry.name} duplicate → +1 evolution copy (+${DUP_SHARD_BONUS} shards)`;
    } else {
      nextHeroes = [...player.heroes_owned, result.entry.heroId];
      if (!prog[result.entry.heroId]) prog[result.entry.heroId] = defaultProgress();
    }
    const nextHistory = [
      ...(player.summon_history || []),
      { hero: result.entry.name, rarity: result.entry.rarity, duplicate: result.duplicate, date: new Date().toISOString() },
    ];
    await updateState({ ...player, codex_shards: nextShards, heroes_owned: nextHeroes, hero_progression: prog, summon_history: nextHistory });
    return { ...result, message };
  }, [player, updateState]);

  const evolveHero = useCallback(async (heroId: string) => {
    if (!player) return { ok: false, message: 'No player loaded.' };
    if (!player.heroes_owned.includes(heroId)) return { ok: false, message: 'Hero not owned.' };
    const cur = getProgress(player.hero_progression, heroId);
    if (!canEvolve(cur)) return { ok: false, message: 'Not enough copies to evolve.' };
    const nextProg = evolveProgress(cur);
    await updateState({
      ...player,
      hero_progression: { ...(player.hero_progression || {}), [heroId]: nextProg },
    });
    return { ok: true, message: `Evolved to ★${nextProg.star}!`, star: nextProg.star };
  }, [player, updateState]);

  const recruitOnce = useCallback(async () => {
    if (!player) return { ok: false, message: 'No player loaded.' };
    const { recruitOnce: roll, applyRecruitResultToProgression } = await import('./university');
    const { SUMMON_COST } = await import('./gacha');
    if ((player.codex_shards || 0) < SUMMON_COST) {
      return { ok: false, message: 'Not enough Codex Shards for Recruitment.' };
    }
    const result = roll(new Set(player.heroes_owned));
    const { heroesOwned, progression } = applyRecruitResultToProgression(player.hero_progression, player.heroes_owned, result);
    let nextShards = (player.codex_shards || 0) - SUMMON_COST;
    let nextTrainees = { ...(player.class_trainees || {}) };
    let nextCredits = player.university_credits || 0;
    let nextHistory = player.summon_history || [];
    if (result.kind === 'trainee' && result.trainee) {
      nextTrainees[result.trainee.id] = (nextTrainees[result.trainee.id] || 0) + (result.traineeAmount || 0);
    } else if (result.kind === 'credits') {
      nextCredits += result.creditsAmount || 0;
    } else if (result.entry) {
      nextHistory = [...nextHistory, { hero: result.entry.name, rarity: result.entry.rarity, duplicate: result.kind === 'shards', date: new Date().toISOString() }];
    }
    await updateState({
      ...player,
      codex_shards: nextShards,
      heroes_owned: heroesOwned,
      hero_progression: progression,
      class_trainees: nextTrainees,
      university_credits: nextCredits,
      summon_history: nextHistory,
    });
    return { ok: true, message: result.message, result };
  }, [player, updateState]);

  const recruitTen = useCallback(async () => {
    if (!player) return { ok: false, message: 'No player loaded.' };
    const { recruitTen: rollTen, applyRecruitResultToProgression } = await import('./university');
    const { SUMMON_COST } = await import('./gacha');
    const cost = SUMMON_COST * 10;
    if ((player.codex_shards || 0) < cost) {
      return { ok: false, message: 'Not enough Codex Shards for Full Class Recruitment.' };
    }
    const results = rollTen(player.heroes_owned);
    let heroesOwned = player.heroes_owned;
    let progression = player.hero_progression || {};
    let nextTrainees = { ...(player.class_trainees || {}) };
    let nextCredits = player.university_credits || 0;
    let nextHistory = player.summon_history || [];
    for (const result of results) {
      const applied = applyRecruitResultToProgression(progression, heroesOwned, result);
      heroesOwned = applied.heroesOwned;
      progression = applied.progression;
      if (result.kind === 'trainee' && result.trainee) {
        nextTrainees[result.trainee.id] = (nextTrainees[result.trainee.id] || 0) + (result.traineeAmount || 0);
      } else if (result.kind === 'credits') {
        nextCredits += result.creditsAmount || 0;
      } else if (result.entry) {
        nextHistory = [...nextHistory, { hero: result.entry.name, rarity: result.entry.rarity, duplicate: result.kind === 'shards', date: new Date().toISOString() }];
      }
    }
    await updateState({
      ...player,
      codex_shards: (player.codex_shards || 0) - cost,
      heroes_owned: heroesOwned,
      hero_progression: progression,
      class_trainees: nextTrainees,
      university_credits: nextCredits,
      summon_history: nextHistory,
    });
    return { ok: true, message: 'Full Class Recruitment complete!', results };
  }, [player, updateState]);

  const promoteHeroCert = useCallback(async (heroId: string) => {
    if (!player) return { ok: false, message: 'No player loaded.' };
    if (!player.heroes_owned.includes(heroId)) return { ok: false, message: 'Hero not owned.' };
    const { HEROES } = await import('./content');
    const { promoteHero: doPromote } = await import('./university');
    const hero = HEROES.find((h: any) => h.id === heroId);
    if (!hero) return { ok: false, message: 'Unknown hero.' };
    const cur = getProgress(player.hero_progression, heroId);
    const result = doPromote(hero.name, hero.role, cur, player);
    if (!result.ok || !result.newProg) return { ok: false, message: result.message };
    const nextTrainees = { ...(player.class_trainees || {}) };
    if (result.trainSpent) {
      const { traineeForRole } = await import('./university');
      const trainee = traineeForRole(hero.role);
      nextTrainees[trainee.id] = Math.max(0, (nextTrainees[trainee.id] || 0) - result.trainSpent);
    }
    await updateState({
      ...player,
      hero_progression: { ...(player.hero_progression || {}), [heroId]: result.newProg },
      class_trainees: nextTrainees,
      university_credits: Math.max(0, (player.university_credits || 0) - (result.creditsSpent || 0)),
    });
    return { ok: true, message: result.message };
  }, [player, updateState]);

  const trainHero = useCallback(async (heroId: string) => {
    if (!player) return { ok: false, message: 'No player loaded.' };
    if (!player.heroes_owned.includes(heroId)) return { ok: false, message: 'Hero not owned.' };
    const { canTrain, trainProgress, levelCapForStar } = await import('./university');
    const cur = getProgress(player.hero_progression, heroId);
    if (!canTrain(cur)) {
      return { ok: false, message: `Already at Level ${levelCapForStar(cur.star)} cap for ${cur.star}-Star. Promote to raise the cap.` };
    }
    const next = trainProgress(cur);
    await updateState({
      ...player,
      hero_progression: { ...(player.hero_progression || {}), [heroId]: next },
    });
    return { ok: true, message: `Trained to Level ${next.level}!` };
  }, [player, updateState]);

  const toggleHeroLock = useCallback(async (heroId: string) => {
    if (!player) return;
    const cur = getProgress(player.hero_progression, heroId);
    await updateState({
      ...player,
      hero_progression: { ...(player.hero_progression || {}), [heroId]: { ...cur, locked: !cur.locked } },
    });
  }, [player, updateState]);

  const toggleHeroFavorite = useCallback(async (heroId: string) => {
    if (!player) return;
    const cur = getProgress(player.hero_progression, heroId);
    await updateState({
      ...player,
      hero_progression: { ...(player.hero_progression || {}), [heroId]: { ...cur, favorite: !cur.favorite } },
    });
  }, [player, updateState]);

  const spendStamina = useCallback(async (cost: number = ENCOUNTER_COST) => {
    // Read + decrement synchronously against the ref (single-threaded critical
    // section) BEFORE any await, so two rapid taps can't both spend the same point.
    const base = playerRef.current;
    if (!base) return false;
    const now = Date.now();
    const cur = regen(base.stamina ?? MAX_STAMINA, base.stamina_updated_at ?? new Date(now).toISOString(), now);
    if (cur.stamina < cost) {
      // Not enough — still persist the regenerated value so the display is fresh.
      if (cur.stamina !== base.stamina || cur.updatedAt !== base.stamina_updated_at) {
        const next = { ...base, stamina: cur.stamina, stamina_updated_at: cur.updatedAt };
        playerRef.current = next;
        await updateState(next);
      }
      return false;
    }
    const next = { ...base, stamina: cur.stamina - cost, stamina_updated_at: cur.updatedAt };
    playerRef.current = next; // commit synchronously before awaiting persistence
    await updateState(next);
    return true;
  }, [updateState]);

  const logWellnessActivity = useCallback(async (input: WellnessLogInput) => {
    // Off-shift only: never touches stamina, shift time, or combat systems.
    // Synchronous ref-based critical section mirrors spendStamina so rapid
    // double-taps can't double-credit daily/weekly Lotus Gem caps.
    const base = playerRef.current;
    if (!base) return null;
    const wellness = base.wellness ?? defaultWellnessState();
    const result = resolveWellnessLog(input, wellness);
    const next = { ...base, wellness: result.nextWellness };
    playerRef.current = next;
    await updateState(next);
    return result;
  }, [updateState]);

  const purchaseItem = useCallback(async (itemName: string, price: number, qty: number = 1) => {
    // Synchronous ref-based critical section (mirrors spendStamina) so rapid
    // double-taps can't spend the same Crowns twice or over-buy.
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const cost = Math.max(0, Math.round(price)) * qty;
    const balance = base.crowns || 0;
    if (balance < cost) {
      return { ok: false, message: 'Not enough Crowns.' };
    }
    const next = {
      ...base,
      crowns: balance - cost,
      inventory: { ...(base.inventory || {}), [itemName]: ((base.inventory || {})[itemName] || 0) + qty },
    };
    playerRef.current = next; // commit synchronously before awaiting persistence
    await updateState(next);
    return { ok: true, message: `Purchased ${qty}× ${itemName} for ${cost} Crowns.` };
  }, [updateState]);

  const purchaseSkin = useCallback(async (skinId: string, price: number) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const owned = base.owned_skins || [];
    if (owned.includes(skinId)) return { ok: false, message: 'Already owned.' };
    const cost = Math.max(0, Math.round(price));
    if ((base.crowns || 0) < cost) return { ok: false, message: 'Not enough Crowns.' };
    const next = {
      ...base,
      crowns: (base.crowns || 0) - cost,
      owned_skins: [...owned, skinId],
      equipped_skin: skinId, // auto-equip on purchase
    };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: `Unlocked and equipped for ${cost} Crowns.` };
  }, [updateState]);

  const equipSkin = useCallback(async (skinId: string) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    // Empty string clears the equipped skin (default look).
    if (skinId && !(base.owned_skins || []).includes(skinId)) {
      return { ok: false, message: 'Skin not owned.' };
    }
    const next = { ...base, equipped_skin: skinId };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: skinId ? 'Equipped.' : 'Reverted to default look.' };
  }, [updateState]);

  const purchaseUpgrade = useCallback(async (upgradeId: string, price: number) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const owned = base.owned_upgrades || [];
    if (owned.includes(upgradeId)) return { ok: false, message: 'Already owned.' };
    const cost = Math.max(0, Math.round(price));
    if ((base.crowns || 0) < cost) return { ok: false, message: 'Not enough Crowns.' };
    const next = {
      ...base,
      crowns: (base.crowns || 0) - cost,
      owned_upgrades: [...owned, upgradeId],
    };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: `Permanent upgrade acquired for ${cost} Crowns.` };
  }, [updateState]);

  const refillStamina = useCallback(async (price: number, amount: number) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const now = Date.now();
    const cur = regen(base.stamina ?? MAX_STAMINA, base.stamina_updated_at ?? new Date(now).toISOString(), now);
    if (cur.stamina >= MAX_STAMINA) {
      return { ok: false, message: 'Stamina is already full.' };
    }
    const cost = Math.max(0, Math.round(price));
    if ((base.crowns || 0) < cost) return { ok: false, message: 'Not enough Crowns.' };
    const restored = Math.min(MAX_STAMINA, cur.stamina + amount);
    const next = {
      ...base,
      crowns: (base.crowns || 0) - cost,
      stamina: restored,
      stamina_updated_at: cur.updatedAt,
    };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: `Restored ${restored - cur.stamina} Stamina for ${cost} Crowns.` };
  }, [updateState]);

  const pullGacha = useCallback(async () => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const cost = GACHA_COST;
    if ((base.crowns || 0) < cost) return { ok: false, message: `Need ${cost} Crowns to recruit.` };
    const owned = { ...(base.owned_units || {}) };
    const shards = { ...(base.unit_shards || {}) };
    const typeId = rollGachaUnit();
    const meta = WARD_UNIT_META[typeId];
    const wasOwned = !!owned[typeId];
    let level: number;
    let message: string;
    if (!wasOwned) {
      level = 1;
      owned[typeId] = 1;
      message = `Recruited ${meta.name}! Mastery Level 1.`;
    } else {
      level = owned[typeId] || 1;
      shards[typeId] = (shards[typeId] || 0) + 1;
      message = `Duplicate ${meta.name} → +1 Shard (${shards[typeId]} shards). Use shards + Ward Coins to raise Mastery Level.`;
    }
    const next = { ...base, crowns: (base.crowns || 0) - cost, owned_units: owned, unit_shards: shards };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message, typeId, isNew: !wasOwned, level };
  }, [updateState]);

  // Unit Mastery Level: PERMANENT upgrade using duplicate shards + Ward Coins (crowns).
  // Distinct from the temporary in-battle Merge Rank, which resets every run.
  const upgradeUnitMastery = useCallback(async (typeId: string) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const owned = { ...(base.owned_units || {}) };
    if (!owned[typeId]) return { ok: false, message: 'You do not own this unit yet.' };
    const level = owned[typeId] || 1;
    const req = getMasteryRequirement(level + 1);
    if (!req) return { ok: false, message: `${WARD_UNIT_META[typeId]?.name || 'Unit'} is already at max Mastery Level ${MASTERY_LEVEL_CAP}.` };
    const shards = { ...(base.unit_shards || {}) };
    const haveShards = shards[typeId] || 0;
    const haveCoins = base.crowns || 0;
    if (haveShards < req.shards || haveCoins < req.coins) {
      return {
        ok: false,
        message: `Need ${req.shards} shards (have ${haveShards}) and ${req.coins} Ward Coins (have ${haveCoins}).`,
      };
    }
    shards[typeId] = haveShards - req.shards;
    owned[typeId] = level + 1;
    const next = { ...base, crowns: haveCoins - req.coins, owned_units: owned, unit_shards: shards };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: `${WARD_UNIT_META[typeId]?.name || 'Unit'} reached Mastery Level ${level + 1}!`, level: level + 1 };
  }, [updateState]);

  const setWardLoadout = useCallback(async (ids: string[]) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const clean = sanitizeLoadout(ids, base.owned_units || {});
    const next = { ...base, ward_loadout: clean };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: 'Loadout saved.' };
  }, [updateState]);

  const resetPlayer = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setPlayer(null);
  }, []);

  const value = useMemo<Ctx>(() => ({
    player, loading, createPlayer, applyRewards, purchaseItem, purchaseSkin, equipSkin, purchaseUpgrade, refillStamina, pullGacha, upgradeUnitMastery, setWardLoadout, recordFailure,
    syncInventory, saveActiveTeam, summonOnce, evolveHero, recruitOnce, recruitTen, promoteHeroCert, trainHero, toggleHeroLock, toggleHeroFavorite, spendStamina, logWellnessActivity, resetPlayer, refresh,
  }), [player, loading, createPlayer, applyRewards, purchaseItem, purchaseSkin, equipSkin, purchaseUpgrade, refillStamina, pullGacha, upgradeUnitMastery, setWardLoadout, recordFailure, syncInventory, saveActiveTeam, summonOnce, evolveHero, recruitOnce, recruitTen, promoteHeroCert, trainHero, toggleHeroLock, toggleHeroFavorite, spendStamina, logWellnessActivity, resetPlayer, refresh]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
