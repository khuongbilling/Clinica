import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/src/api/client';
import { PlayerState } from './types';
import { RANKS } from './content';
import { isValidAvatarId } from './avatars';
import { canEvolve, defaultProgress, evolveProgress, getProgress, DUP_SHARD_BONUS, MAX_STAR } from './evolution';
import { MAX_STAMINA, ENCOUNTER_COST, regen, maxStaminaForPlayer } from './stamina';
import { addHeroXp, playerLevelFromXp, staminaMaxForLevel } from './progression';
import { levelCapForStar } from './university';
import { defaultWellnessState, resolveWellnessLog, WellnessLogInput, WellnessResult } from './wellness';
import {
  DailyEventType, DailyReward, DailyRoundsState, defaultDailyRoundsState, ensureFreshDailyRounds,
  checkInDailyRounds as computeCheckIn, recordObjectiveProgress, claimObjectiveReward,
  claimAllCompleteBonus, claimWeeklyReward, CheckInResult, allObjectivesComplete,
} from './dailyRounds';
import { buildGateContext, checkFeatureGate } from './progression';
import {
  defaultOwnedUnits, sanitizeLoadout, rollGachaUnit, STARTER_UNIT_IDS,
  GACHA_COST, MASTERY_LEVEL_CAP, WARD_UNIT_META, getMasteryRequirement,
} from './units';
import { buildDefaultRealmLayout, getProducerBuildings } from './realm';
import { findSkin } from './shop';
import { isValidCellId } from './realmGrid';
import {
  ClassId, CLASS_IDS, canClaimTier, classIdForAptitude, defaultClassProgress, getClassTree,
} from './classTree';
import { CLASS_DEFAULT_RESONANCE, FANTASY_CLASSES, fantasyClassFromClassId } from './classQuiz';
import { TokenExchangeItem, MIASMA_BLOOM_MILESTONES, getMilestoneProgress } from './worldEvent';

const STORAGE_KEY = 'clinica.player.v2';

// Backfill hero_progression so every owned hero has a star/copies entry,
// and clamp any malformed values. Keeps older/remote saves compatible.
function normalizeProgression(p: PlayerState): PlayerState {
  const src = p.hero_progression || {};
  const prog: Record<string, { star: number; copies: number; level: number; xp: number; locked: boolean; favorite: boolean }> = {};
  let changed = !p.hero_progression;
  if (p.prologue_complete === undefined) { p = { ...p, prologue_complete: true }; changed = true; }
  if (p.identity_restored === undefined) { p = { ...p, identity_restored: true }; changed = true; }
  if (p.diagnostic_intro_seen === undefined) { p = { ...p, diagnostic_intro_seen: true }; changed = true; }
  if (p.avatar_id === undefined) { p = { ...p, avatar_id: '' }; changed = true; }
  // Push 5 — existing players (created before this push) never had the
  // reminiscence scene, so backfill them as "already seen" rather than
  // surprising returning players with it. Brand-new players get `false`
  // explicitly in createPlayer below, so they DO see it once.
  if (p.seen_reminiscence === undefined) { p = { ...p, seen_reminiscence: true }; changed = true; }
  // Manhwa story layer — backfill the seen-scenes list as empty so chapter
  // scenes at already-passed milestones still play once for existing players
  // (they have never seen them), then never again.
  if (!Array.isArray(p.story_scenes_seen)) { p = { ...p, story_scenes_seen: [] }; changed = true; }
  for (const [id, raw] of Object.entries(src)) {
    const star = Math.min(MAX_STAR, Math.max(1, Math.round(Number(raw?.star) || 1)));
    const copies = Math.max(0, Math.round(Number(raw?.copies) || 0));
    const level = Math.max(1, Math.round(Number((raw as any)?.level) || 1));
    const xp = Math.max(0, Math.round(Number((raw as any)?.xp) || 0));
    const locked = !!(raw as any)?.locked;
    const favorite = !!(raw as any)?.favorite;
    prog[id] = { star, copies, level, xp, locked, favorite };
    if (star !== raw?.star || copies !== raw?.copies || level !== (raw as any)?.level || xp !== (raw as any)?.xp) changed = true;
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
  if (!out.lessons_completed || !out.simulations_completed || !out.badge_progress) {
    out = {
      ...out,
      lessons_completed: out.lessons_completed || [],
      simulations_completed: out.simulations_completed || [],
      badge_progress: out.badge_progress || {},
    };
  }
  if (!out.claimed_milestones) {
    out = { ...out, claimed_milestones: [] };
  }
  if (!out.owned_titles) {
    out = { ...out, owned_titles: [] };
  }
  if (out.active_title == null) {
    out = { ...out, active_title: "" };
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
  if (!out.daily_rounds) {
    out = { ...out, daily_rounds: defaultDailyRoundsState() };
  }
  if (!out.cue_topic_progress) {
    out = { ...out, cue_topic_progress: {} };
  }
  // C3 — backfill battle_stars for existing players who pre-date this field.
  if (!out.battle_stars) {
    out = { ...out, battle_stars: {} };
  }
  // C5 — backfill seen_lv2_unlock.
  // Existing players who are already Level 2+ are treated as having seen the
  // modal (they don't need the first-run experience). New Level 1 players get
  // false so they'll see it the first time they cross Level 2.
  if (out.seen_lv2_unlock == null) {
    const lvl = out.player_level ?? playerLevelFromXp(out.xp || 0).level;
    out = { ...out, seen_lv2_unlock: lvl >= 2 };
  }
  // C4 — backfill the three one-time claim arrays for pre-C4 saves.
  if (!out.claimed_level_rewards) {
    out = { ...out, claimed_level_rewards: [] };
  }
  if (!out.claimed_chapter_chests) {
    out = { ...out, claimed_chapter_chests: [] };
  }
  if (!out.claimed_chapter_3star) {
    out = { ...out, claimed_chapter_3star: [] };
  }
  // J2 — backfill journey node claim tracking for pre-J2 saves.
  if (!out.claimed_journey_nodes) {
    out = { ...out, claimed_journey_nodes: [] };
  }
  // Push 5.5 structural correction — realm_layout now stores buildingId ->
  // origin cellId ("r{row}_c{col}"), not the old fixed plotId. Any saved
  // layout whose values aren't valid grid cell ids predates the rewrite and
  // is reset to the default (Atrium-only) layout so it can't crash placement.
  const layoutValues = Object.values(out.realm_layout || {});
  const layoutIsLegacy = layoutValues.length > 0 && !layoutValues.every((v) => isValidCellId(v));
  if (!out.realm_layout || Object.keys(out.realm_layout).length === 0 || layoutIsLegacy) {
    out = { ...out, realm_layout: buildDefaultRealmLayout() };
  }
  const decorKeys = Object.keys(out.realm_decor || {});
  const decorIsLegacy = decorKeys.length > 0 && !decorKeys.every((k) => isValidCellId(k));
  if (!out.realm_decor || decorIsLegacy) {
    out = { ...out, realm_decor: {} };
  }
  // Realm hero assignment + point production — backfill empty maps for saves
  // created before this system so the Realm screen never reads undefined.
  if (!out.realm_assignments) {
    out = { ...out, realm_assignments: {} };
  }
  if (!out.realm_production) {
    out = { ...out, realm_production: {} };
  }
  // Seed a production snapshot for every producer building that is currently
  // placed but has no snapshot yet. Without this, computeAccruedPoints has no
  // start timestamp and would report 0 forever — passive point generation must
  // begin the moment a producer is on the board, not only after a hero is
  // assigned. New snapshots start the clock "now" so no back-pay is granted.
  {
    const nowIso = new Date().toISOString();
    const layout = out.realm_layout || {};
    const prod = { ...(out.realm_production || {}) };
    let seeded = false;
    for (const b of getProducerBuildings()) {
      if (layout[b.id] && !prod[b.id]) {
        prod[b.id] = { points: 0, updatedAt: nowIso };
        seeded = true;
      }
    }
    if (seeded) out = { ...out, realm_production: prod };
  }
  // Push 5.6 — backfill a terrain seed for players created before the per-player
  // terrain system. Derive it deterministically from the player id (not random)
  // so a legacy player's Realm stays identical across every refresh even if the
  // seed is never persisted back to the backend record.
  if (!out.realm_seed || out.realm_seed <= 0) {
    const src = String(out.id || 'clinica');
    let h = 2166136261;
    for (let i = 0; i < src.length; i++) {
      h ^= src.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    out = { ...out, realm_seed: (h >>> 0) % 2_000_000_000 + 1 };
  }
  if (out.player_level == null) {
    out = { ...out, player_level: playerLevelFromXp(out.xp || 0).level };
  }
  if (out.ward_defense_waves == null) {
    out = { ...out, ward_defense_waves: 0 };
  }
  if (out.crowns == null) {
    out = { ...out, crowns: 0 };
  }
  if (out.insight_crystals == null || out.refined_lotus_gems == null || out.lotus_gems_paid == null || out.ward_sigils == null || out.epidemic_tokens == null) {
    out = {
      ...out,
      insight_crystals: out.insight_crystals ?? 0,
      refined_lotus_gems: out.refined_lotus_gems ?? 0,
      lotus_gems_paid: out.lotus_gems_paid ?? 0,
      ward_sigils: out.ward_sigils ?? 0,
      epidemic_tokens: out.epidemic_tokens ?? 0,
    };
  }
  if (!out.owned_skins || !out.owned_upgrades || out.equipped_skin == null || out.equipped_ward_skin == null) {
    out = {
      ...out,
      owned_skins: out.owned_skins || [],
      equipped_skin: out.equipped_skin || '',
      equipped_ward_skin: out.equipped_ward_skin || '',
      owned_upgrades: out.owned_upgrades || [],
    };
  }
  if (!out.owned_units || Object.keys(out.owned_units).length === 0) {
    out = { ...out, owned_units: defaultOwnedUnits() };
  }
  if (out.kingdom_levels && out.kingdom_levels.grand_ward_atrium == null) {
    // Realm foundation (Push 3): existing players already had academy/library/hall/apothecary
    // at Lv.1, which unlocked real University/Codex/Heroes/Shop access — default the Atrium
    // to Lv.3 so those existing routes stay reachable through the Realm map, not newly locked.
    out = { ...out, kingdom_levels: { ...out.kingdom_levels, grand_ward_atrium: 3 } };
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
  // Class Tree (Push 6) — backfill the new account-level class identity and
  // per-class ability progress for saves that predate this system.
  if (!out.class_tree_id) {
    out = { ...out, class_tree_id: classIdForAptitude(out.aptitude) };
  }
  if (!out.class_progress || CLASS_IDS.some((id) => !Array.isArray(out.class_progress![id]))) {
    out = { ...out, class_progress: { ...defaultClassProgress(), ...(out.class_progress || {}) } };
  }
  // Push 6 — backfill the diagnostic snapshot for players who confirmed a
  // class before this field existed (or switched classes via the Class Tree
  // screen, which does not go through the quiz). Falls back to a deterministic
  // default resonance/second-fit derived purely from the current class so the
  // read-only Review Class Result screen always has something to show.
  if (!out.class_diagnostic_resonance || !out.class_diagnostic_secondary) {
    const currentClass = fantasyClassFromClassId((out.class_tree_id as ClassId) || 'medic');
    const secondary = FANTASY_CLASSES.find((c) => c !== currentClass) || currentClass;
    out = {
      ...out,
      class_diagnostic_resonance: out.class_diagnostic_resonance || CLASS_DEFAULT_RESONANCE[currentClass],
      class_diagnostic_secondary: out.class_diagnostic_secondary || secondary,
    };
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
  prologue_complete?: boolean;
  identity_restored?: boolean;
  diagnostic_intro_seen?: boolean;
};

// Ephemeral, non-persisted signal emitted the moment a qualifying action
// advances one or more Daily Ward Rounds objectives, so any screen can show a
// subtle in-context cue right away instead of the panel updating silently.
export type DailyPulse = {
  id: number;                    // monotonically increasing — retriggers the toast
  advanced: { label: string; progress: number; target: number; justCompleted: boolean }[];
  allComplete: boolean;          // every duty is now complete
  allJustCompleted: boolean;     // this action was the one that completed the last duty
};

type Ctx = {
  player: PlayerState | null;
  loading: boolean;
  // Daily Ward Rounds live feedback — see DailyPulse above.
  dailyPulse: DailyPulse | null;
  openRoundsSignal: number;      // increments when a cue asks the hub to open the panel
  requestOpenDailyRounds: () => void;
  createPlayer: (args: CreatePlayerArgs) => Promise<void>;
  applyRewards: (rewards: {
    xp?: number; codex?: string[]; mastery?: Partial<PlayerState['mastery']>; bossId?: string; heroes?: string[];
    buildings?: Record<string, number>; enemyId?: string; codexShards?: number; crowns?: number;
    epidemicTokens?: number;
    inventoryDelta?: Record<string, number>; enemyName?: string;
    // Hero EXP — per-hero contribution-based EXP, distinct from Player EXP (`xp` above).
    heroXp?: Record<string, number>;
  }) => Promise<{
    playerLevelUp: { fromLevel: number; toLevel: number } | null;
    heroLevelUps: { heroId: string; fromLevel: number; toLevel: number }[];
  }>;
  // Ward Defense: persist that `count` Bloom waves were cleared/survived this run.
  // Increments the account-wide ward_defense_waves counter (drives ms_3).
  recordWardWaves: (count: number) => Promise<void>;
  purchaseItem: (itemName: string, price: number, qty?: number) => Promise<{ ok: boolean; message: string }>;
  redeemExchangeItem: (item: TokenExchangeItem) => Promise<{ ok: boolean; message: string }>;
  claimMilestone: (milestoneId: string) => Promise<{ ok: boolean; message: string; earnedTitles?: string[] }>;
  setActiveTitle: (titleId: string) => Promise<{ ok: boolean; message: string }>;
  purchaseSkin: (skinId: string, price: number) => Promise<{ ok: boolean; message: string }>;
  equipSkin: (skinId: string, kind?: 'aura' | 'ward') => Promise<{ ok: boolean; message: string }>;
  purchaseUpgrade: (upgradeId: string, price: number) => Promise<{ ok: boolean; message: string }>;
  refillStamina: (price: number, amount: number) => Promise<{ ok: boolean; message: string }>;
  pullGacha: () => Promise<{ ok: boolean; message: string; typeId?: string; isNew?: boolean; level?: number }>;
  upgradeUnitMastery: (typeId: string) => Promise<{ ok: boolean; message: string; level?: number }>;
  setWardLoadout: (ids: string[]) => Promise<{ ok: boolean; message: string }>;
  setRealmLayout: (layoutPatch: Record<string, string | null>, decorPatch?: Record<string, string | null>) => Promise<{ ok: boolean; message: string }>;
  setRealmAssignment: (buildingId: string, heroIds: string[]) => Promise<{ ok: boolean; message: string }>;
  collectRealmProduction: (buildingId: string) => Promise<{ ok: boolean; message: string; amount?: number }>;
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
  completeLesson: (lessonId: string) => Promise<{ ok: boolean; message: string; result?: import('./lessons').CompletionResult }>;
  completeSimulation: (simId: string, wasCorrect: boolean) => Promise<{ ok: boolean; message: string; result?: import('./lessons').CompletionResult }>;
  spendStamina: (cost?: number) => Promise<boolean>;
  logWellnessActivity: (input: WellnessLogInput) => Promise<WellnessResult | null>;
  // Daily Ward Rounds — free-to-earn daily engagement loop.
  checkInDailyRounds: () => Promise<CheckInResult | null>;
  claimDailyObjective: (objectiveId: string) => Promise<{ ok: boolean; message: string; reward?: DailyReward }>;
  claimDailyAllComplete: () => Promise<{ ok: boolean; message: string; reward?: DailyReward }>;
  claimWeeklyGoal: () => Promise<{ ok: boolean; message: string; reward?: DailyReward }>;
  exchangeInsightCrystals: (insightCrystalsCost: number) => Promise<{ ok: boolean; message: string }>;
  recordCueTopics: (topics: string[]) => Promise<void>;
  resetPlayer: () => Promise<void>;
  refresh: () => Promise<void>;
  setPlayerClass: (classId: ClassId) => Promise<{ ok: boolean; message: string }>;
  claimClassTier: (classId: ClassId, level: 1 | 10 | 20 | 30) => Promise<{ ok: boolean; message: string }>;
  completePrologue: () => Promise<void>;
  completeIdentityRestore: (name: string) => Promise<void>;
  setAvatar: (id: string) => Promise<void>;
  completeDiagnosticIntro: () => Promise<void>;
  markReminiscenceSeen: () => Promise<void>;
  markStorySceneSeen: (sceneId: string) => Promise<void>;
  completeLotusLessonNode: (nodeId: string) => Promise<{ ok: boolean; message: string; rewards?: import('./lotusLessons').LotusLessonRewards }>;
  applyClassDiagnostic: (profile: ClassDiagnosticInput) => Promise<void>;
  confirmClassDiagnostic: (classId: ClassId, resonance?: string, secondaryFantasyClass?: string) => Promise<{ ok: boolean; message: string }>;
  setLearningProfile: (profileId: string) => Promise<void>;
  // C3 — record the best star rating achieved for a battle (keyed by enemy id).
  updateBattleStars: (enemyId: string, stars: number) => Promise<void>;
  // C3 — auto-sweep a battle: spend stamina + grant repeatable XP/crowns (no first-clear rewards).
  performSweep: (enemyId: string, baseXp: number, bestStars: number) => Promise<{ ok: boolean; xp: number; crowns: number; message: string }>;
  // C4 — one-time milestone reward claims.
  claimLevelReward: (milestoneId: string) => Promise<{ ok: boolean; message: string }>;
  claimChapterChest: (chestId: string) => Promise<{ ok: boolean; message: string }>;
  claimChapter3Star: (rewardId: string) => Promise<{ ok: boolean; message: string }>;
  // J2 — one-time journey node first-clear reward claim.
  claimJourneyNode: (nodeId: string, stars: number) => Promise<{ ok: boolean; message: string; reward?: import('./journeyRewards').ComputedJourneyReward }>;
  // C5 — dismiss the Level 2 "Apprentice Path Opened" celebration modal.
  markLv2UnlockSeen: () => Promise<void>;
  // Low-level full-player write — prefer applyRewards for incremental updates.
  // Exposed so mini-game completion handlers can batch credits + XP in one call.
  updateState: (next: PlayerState) => Promise<void>;
};

// Result of the post-recall class-diagnostic quiz. Mirrors the class-relevant
// subset of CreatePlayerArgs, applied onto an already-existing player.
export type ClassDiagnosticInput = {
  aptitude: string;
  player_class: string;
  learning_profile: string;
  difficulty: string;
  system_affinity: string;
  explanation_style: string;
  codex_depth: string;
};

const PlayerContext = createContext<Ctx | null>(null);

interface PlayerXpApplyResult {
  player: PlayerState;
  fromLevel: number;
  toLevel: number;
  leveledUp: boolean;
}

function applyXp(p: PlayerState, addXp: number): PlayerState {
  return applyXpDetailed(p, addXp).player;
}

// Applies Player EXP, updates the legacy Rank flavor text AND the new
// independent Player Level (stamina cap / feature unlocks / Player Class
// tiers). Returns level-up info so callers (e.g. battle result) can show a
// dedicated Player level-up celebration, distinct from Hero level-ups.
function applyXpDetailed(p: PlayerState, addXp: number): PlayerXpApplyResult {
  const newXp = p.xp + addXp;
  let idx = p.rank_index;
  while (idx < RANKS.length - 1 && newXp >= RANKS[idx + 1].xpRequired) idx++;
  const fromLevel = p.player_level ?? playerLevelFromXp(p.xp).level;
  const toLevel = playerLevelFromXp(newXp).level;
  const player = { ...p, xp: newXp, rank: RANKS[idx].name, rank_index: idx, player_level: toLevel };
  return { player, fromLevel, toLevel, leveledUp: toLevel > fromLevel };
}

function makeLocalId(): string {
  return 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ---------- Daily Ward Rounds helpers ----------
// Modes a Daily Rounds objective can be drawn from. Filtered per-player through
// the same compound feature gate the rest of the app uses, so a brand-new
// player only ever gets objectives for the systems they have actually unlocked.
const DAILY_ROUNDS_MODES = ['ward_shift', 'ward_defense', 'university', 'lotus_journal', 'hall_of_heroes'];

function dailyRoundsUnlockedModes(p: PlayerState): string[] {
  const ctx = buildGateContext(p);
  return DAILY_ROUNDS_MODES.filter((m) => checkFeatureGate(m, ctx).unlocked);
}

// Credit currency reward from a claimed daily/weekly/streak reward. Uses only
// existing currencies (Crowns / Codex Shards / Insight Crystals) — no new
// currency, no monetization.
function addDailyReward(p: PlayerState, r: DailyReward): PlayerState {
  return {
    ...p,
    crowns: (p.crowns || 0) + (r.crowns || 0),
    codex_shards: (p.codex_shards || 0) + (r.codexShards || 0),
    insight_crystals: (p.insight_crystals || 0) + (r.insightCrystals || 0),
  };
}

// Fold auto-filling objective progress is done via the provider-scoped
// `foldDaily` (below), which additionally emits a `dailyPulse` cue. It ensures
// the day/week roll is fresh first so progress lands on the right objective set,
// and is a safe no-op when the matching mode isn't among today's objectives.

function defaultPlayer(args: CreatePlayerArgs, id: string): PlayerState {
  return {
    id,
    name: (args.name || 'Healer').trim().slice(0, 24) || 'Healer',
    aptitude: args.aptitude as any,
    avatar_id: '',
    recommended_aptitude: args.recommended_aptitude as any || null,
    learning_goal: args.learning_goal || null,
    learning_profile: args.learning_profile || null,
    difficulty: args.difficulty || null,
    player_class: args.player_class || null,
    system_affinity: args.system_affinity || null,
    explanation_style: args.explanation_style || null,
    codex_depth: args.codex_depth || 'simple',
    onboarding_complete: true,
    prologue_complete: args.prologue_complete ?? true,
    identity_restored: args.identity_restored ?? true,
    diagnostic_intro_seen: args.diagnostic_intro_seen ?? true,
    // Push 5 — new players have not seen the memory-reminiscence scene yet;
    // it plays once, right after their class-diagnostic is confirmed.
    seen_reminiscence: false,
    story_scenes_seen: [],
    rank: 'Sprout Healer',
    rank_index: 0,
    xp: 0,
    player_level: 1,
    mastery: { assessment: 0, stabilization: 0, pharmacology: 0, judgment: 0, command: 0, systems: 0 },
    codex_unlocked: [],
    // Heroes are earned exclusively through University Recruitment — new
    // players start with an empty roster (the prologue battle uses temporary
    // loaner heroes that are never persisted).
    heroes_owned: [],
    active_team: [],
    kingdom_levels: {
      grand_ward_atrium: 3,
      academy_of_healing: 1,
      library_of_knowledge: 1,
      hall_of_heroes: 1,
      apothecary: 1,
    },
    runs_completed: 0,
    ward_defense_waves: 0,
    bosses_defeated: [],
    claimed_milestones: [],
    owned_titles: [],
    active_title: "",
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
    insight_crystals: 0,
    refined_lotus_gems: 0,
    lotus_gems_paid: 0,
    ward_sigils: 0,
    epidemic_tokens: 0,
    owned_skins: [],
    equipped_skin: '',
    equipped_ward_skin: '',
    owned_upgrades: [],
    owned_units: defaultOwnedUnits(),
    unit_shards: {},
    ward_loadout: [...STARTER_UNIT_IDS],
    summon_history: [],
    enemy_mastery: {},
    battle_stars: {},
    seen_lv2_unlock: false,
    claimed_level_rewards: [],
    claimed_chapter_chests: [],
    claimed_chapter_3star: [],
    chapter_progress: 1,
    region_progress: {},
    stamina: MAX_STAMINA,
    stamina_updated_at: new Date().toISOString(),
    wellness: defaultWellnessState(),
    daily_rounds: defaultDailyRoundsState(),
    realm_seed: Math.floor(Math.random() * 2_000_000_000) + 1,
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

  // Daily Ward Rounds — live in-context feedback. `dailyPulse` is set by
  // `foldDaily` whenever a qualifying action moves a duty forward; a global
  // toast overlay watches it. `openRoundsSignal` lets that toast (or any cue)
  // ask the hub to open the Rounds panel.
  const [dailyPulse, setDailyPulse] = useState<DailyPulse | null>(null);
  const [openRoundsSignal, setOpenRoundsSignal] = useState(0);
  const pulseId = useRef(0);
  const requestOpenDailyRounds = useCallback(() => setOpenRoundsSignal((n) => n + 1), []);

  // Credit daily-objective progress AND emit a pulse describing what advanced,
  // so screens can surface an instant cue. Wraps the pure `foldDailyProgress`
  // by diffing the objective set before/after. Never throws on a no-op event.
  const foldDaily = useCallback((p: PlayerState, event: DailyEventType, amount: number = 1): PlayerState => {
    const modes = dailyRoundsUnlockedModes(p);
    const before = ensureFreshDailyRounds(p.daily_rounds, modes, p.id).state;
    const rec = recordObjectiveProgress(before, event, amount);
    if (rec.changed) {
      const advanced = rec.state.objectives
        .map((a) => {
          const b = before.objectives.find((o) => o.id === a.id);
          if (!b || a.progress <= b.progress) return null;
          return {
            label: a.label,
            progress: a.progress,
            target: a.target,
            justCompleted: a.progress >= a.target && b.progress < b.target,
          };
        })
        .filter(Boolean) as DailyPulse['advanced'];
      if (advanced.length > 0) {
        const allNow = allObjectivesComplete(rec.state);
        const allBefore = allObjectivesComplete(before);
        // Daily rounds completion is tracked by the daily_rounds state itself;
        // the old obj_daily_checkin objective was removed from the 15-step chain.
        pulseId.current += 1;
        setDailyPulse({
          id: pulseId.current,
          advanced,
          allComplete: allNow,
          allJustCompleted: allNow && !allBefore,
        });
      }
    }
    return { ...p, daily_rounds: rec.state };
  }, []);

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
    if (!player) return { playerLevelUp: null, heroLevelUps: [] };
    let next = { ...player };
    let playerLevelUp: { fromLevel: number; toLevel: number } | null = null;
    if (rewards.xp) {
      const applied = applyXpDetailed(next, rewards.xp);
      next = applied.player;
      if (applied.leveledUp) playerLevelUp = { fromLevel: applied.fromLevel, toLevel: applied.toLevel };
    }
    const heroLevelUps: { heroId: string; fromLevel: number; toLevel: number }[] = [];
    if (rewards.heroXp) {
      const prog = { ...(next.hero_progression || {}) };
      for (const [heroId, xpAmount] of Object.entries(rewards.heroXp)) {
        if (!xpAmount) continue;
        const existing = prog[heroId] ? { ...prog[heroId] } : (defaultProgress() as any);
        const fromLevel = existing.level ?? 1;
        const cap = levelCapForStar(existing.star ?? 1);
        const result = addHeroXp(fromLevel, existing.xp ?? 0, xpAmount, cap);
        prog[heroId] = { ...existing, xp: result.xp, level: result.level };
        if (result.level > fromLevel) heroLevelUps.push({ heroId, fromLevel, toLevel: result.level });
      }
      next.hero_progression = prog;
    }
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
    if (rewards.epidemicTokens) {
      next.epidemic_tokens = (next.epidemic_tokens || 0) + rewards.epidemicTokens;
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
    next = foldDaily(next, 'ward_shift_win');
    await updateState(next);
    return { playerLevelUp, heroLevelUps };
  }, [player, updateState]);

  const recordWardWaves = useCallback(async (count: number) => {
    if (!player || !count || count <= 0) return;
    let next = { ...player, ward_defense_waves: (player.ward_defense_waves || 0) + count };
    next = foldDaily(next, 'ward_defense_wave', count);
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
    await updateState(foldDaily({ ...player, codex_shards: nextShards, heroes_owned: nextHeroes, hero_progression: prog, summon_history: nextHistory }, 'hero_action'));
    return { ...result, message };
  }, [player, updateState]);

  const evolveHero = useCallback(async (heroId: string) => {
    if (!player) return { ok: false, message: 'No player loaded.' };
    if (!player.heroes_owned.includes(heroId)) return { ok: false, message: 'Hero not owned.' };
    const cur = getProgress(player.hero_progression, heroId);
    if (!canEvolve(cur)) return { ok: false, message: 'Not enough copies to evolve.' };
    const nextProg = evolveProgress(cur);
    await updateState(foldDaily({
      ...player,
      hero_progression: { ...(player.hero_progression || {}), [heroId]: nextProg },
    }, 'hero_action'));
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
    await updateState(foldDaily({
      ...player,
      codex_shards: nextShards,
      heroes_owned: heroesOwned,
      hero_progression: progression,
      class_trainees: nextTrainees,
      university_credits: nextCredits,
      summon_history: nextHistory,
    }, 'hero_action'));
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
    await updateState(foldDaily({
      ...player,
      codex_shards: (player.codex_shards || 0) - cost,
      heroes_owned: heroesOwned,
      hero_progression: progression,
      class_trainees: nextTrainees,
      university_credits: nextCredits,
      summon_history: nextHistory,
    }, 'hero_action'));
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
    await updateState(foldDaily({
      ...player,
      hero_progression: { ...(player.hero_progression || {}), [heroId]: next },
    }, 'hero_action'));
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
    const max = maxStaminaForPlayer(base);
    const cur = regen(base.stamina ?? max, base.stamina_updated_at ?? new Date(now).toISOString(), now, max);
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
    let next: PlayerState = { ...base, wellness: result.nextWellness };
    next = foldDaily(next, 'wellness_log');
    playerRef.current = next;
    await updateState(next);
    return result;
  }, [updateState]);

  // ---------- Daily Ward Rounds ----------
  // Perform the once-per-day login check-in. Ensures the objective/week roll is
  // fresh, then increments (or resets) the streak and credits the streak reward.
  const checkInDailyRounds = useCallback(async () => {
    const base = playerRef.current;
    if (!base) return null;
    const modes = dailyRoundsUnlockedModes(base);
    const fresh = ensureFreshDailyRounds(base.daily_rounds, modes, base.id).state;
    const result = computeCheckIn(fresh);
    let next: PlayerState = { ...base, daily_rounds: result.state };
    if (result.reward) next = addDailyReward(next, result.reward);
    playerRef.current = next;
    await updateState(next);
    return result;
  }, [updateState]);

  const claimDailyObjective = useCallback(async (objectiveId: string) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const modes = dailyRoundsUnlockedModes(base);
    const fresh = ensureFreshDailyRounds(base.daily_rounds, modes, base.id).state;
    const res = claimObjectiveReward(fresh, objectiveId);
    if (!res.reward) return { ok: false, message: res.message };
    const next = addDailyReward({ ...base, daily_rounds: res.state }, res.reward);
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: res.message, reward: res.reward };
  }, [updateState]);

  const claimDailyAllComplete = useCallback(async () => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const modes = dailyRoundsUnlockedModes(base);
    const fresh = ensureFreshDailyRounds(base.daily_rounds, modes, base.id).state;
    const res = claimAllCompleteBonus(fresh);
    if (!res.reward) return { ok: false, message: res.message };
    const next = addDailyReward({ ...base, daily_rounds: res.state }, res.reward);
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: res.message, reward: res.reward };
  }, [updateState]);

  const claimWeeklyGoal = useCallback(async () => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const modes = dailyRoundsUnlockedModes(base);
    const fresh = ensureFreshDailyRounds(base.daily_rounds, modes, base.id).state;
    const res = claimWeeklyReward(fresh);
    if (!res.reward) return { ok: false, message: res.message };
    const next = addDailyReward({ ...base, daily_rounds: res.state }, res.reward);
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: res.message, reward: res.reward };
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

  // Spend Epidemic Tokens at the Miasma Bloom Token Exchange. Mirrors
  // purchaseItem's synchronous ref-based critical section so rapid taps can't
  // overspend. Only items carrying a `grant` are redeemable; the reward is
  // applied to an existing PlayerState field (no new fields, so no backend sync
  // is needed).
  const redeemExchangeItem = useCallback(async (item: TokenExchangeItem) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    if (!item.grant) return { ok: false, message: 'This reward is coming soon.' };
    const cost = Math.max(0, Math.round(item.cost));
    const balance = base.epidemic_tokens || 0;
    if (balance < cost) {
      return { ok: false, message: `Not enough Epidemic Tokens. Need ${cost.toLocaleString()}.` };
    }
    if (item.grant.kind === 'cosmetic') {
      // Guard against re-buying a cosmetic the player already owns (skins are
      // one-time unlocks; a duplicate would waste tokens for no benefit).
      if ((base.owned_skins || []).includes(item.grant.skinId)) {
        return { ok: false, message: `${item.name} already unlocked — equip it in the Apothecary.` };
      }
    }
    const next: PlayerState = { ...base, epidemic_tokens: balance - cost };
    if (item.grant.kind === 'currency') {
      next[item.grant.field] = ((base[item.grant.field] as number) || 0) + item.grant.amount;
    } else if (item.grant.kind === 'cosmetic') {
      // Mirror purchaseSkin: add to owned_skins and auto-equip the new look.
      // Ward-backdrop skins equip into their own slot so they don't clobber any
      // hero aura the player is wearing (and vice-versa).
      next.owned_skins = [...(base.owned_skins || []), item.grant.skinId];
      const grantedSkin = findSkin(item.grant.skinId);
      if (grantedSkin?.wardBackdrop) next.equipped_ward_skin = item.grant.skinId;
      else next.equipped_skin = item.grant.skinId;
    } else {
      next.inventory = {
        ...(base.inventory || {}),
        [item.grant.itemName]: ((base.inventory || {})[item.grant.itemName] || 0) + item.grant.qty,
      };
    }
    playerRef.current = next; // commit synchronously before awaiting persistence
    await updateState(next);
    return { ok: true, message: `Redeemed ${item.name} for ${cost.toLocaleString()} Epidemic Tokens.` };
  }, [updateState]);

  // Claim a Miasma Bloom Event Milestone. Guards: milestone must exist, its
  // requirement must be met against the player's real progress, and it must not
  // already be claimed. Applies the milestone's concrete grant (currencies,
  // materials, codex entries) and records the id in claimed_milestones so the
  // reward can never be double-claimed. Uses the same synchronous playerRef
  // critical section as redeemExchangeItem so rapid taps can't double-grant.
  const claimMilestone = useCallback(async (milestoneId: string) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const ms = MIASMA_BLOOM_MILESTONES.find((m) => m.id === milestoneId);
    if (!ms) return { ok: false, message: 'Unknown milestone.' };
    const claimed = base.claimed_milestones || [];
    if (claimed.includes(milestoneId)) {
      return { ok: false, message: `${ms.label} already claimed.` };
    }
    const progress = getMilestoneProgress(ms, base);
    if (!progress.met) {
      return { ok: false, message: `${ms.label} not ready — ${progress.current}/${progress.goal}.` };
    }
    const g = ms.grant;
    const next: PlayerState = {
      ...base,
      claimed_milestones: [...claimed, milestoneId],
    };
    if (g.epidemicTokens) next.epidemic_tokens = (base.epidemic_tokens || 0) + g.epidemicTokens;
    if (g.insightCrystals) next.insight_crystals = (base.insight_crystals || 0) + g.insightCrystals;
    if (g.codexShards) next.codex_shards = (base.codex_shards || 0) + g.codexShards;
    if (g.materials) {
      next.inventory = { ...(base.inventory || {}) };
      for (const [name, qty] of Object.entries(g.materials)) {
        next.inventory[name] = (next.inventory[name] || 0) + qty;
      }
    }
    if (g.codex?.length) {
      next.codex_unlocked = Array.from(new Set([...(base.codex_unlocked || []), ...g.codex]));
    }
    // Track which titles are *newly* earned (not already owned) so the caller can
    // surface a dedicated celebratory callout for the rare cosmetic.
    let earnedTitles: string[] = [];
    if (g.titles?.length) {
      const owned = base.owned_titles || [];
      earnedTitles = g.titles.filter((t) => !owned.includes(t));
      const merged = Array.from(new Set([...owned, ...g.titles]));
      next.owned_titles = merged;
      // Auto-equip the first earned title so the reward is immediately visible;
      // once the player has picked one, respect their choice and leave it be.
      if (!base.active_title && merged.length) next.active_title = g.titles[0];
    }
    playerRef.current = next; // commit synchronously before awaiting persistence
    await updateState(next);
    return { ok: true, message: `Claimed “${ms.label}” reward!`, earnedTitles };
  }, [updateState]);

  // Set (or clear, with "") the player's displayed profile Title. Cosmetic only.
  const setActiveTitle = useCallback(async (titleId: string) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    if (titleId && !(base.owned_titles || []).includes(titleId)) {
      return { ok: false, message: 'Title not earned yet.' };
    }
    const next = { ...base, active_title: titleId };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: titleId ? 'Title updated.' : 'Title cleared.' };
  }, [updateState]);

  const purchaseSkin = useCallback(async (skinId: string, price: number) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const owned = base.owned_skins || [];
    if (owned.includes(skinId)) return { ok: false, message: 'Already owned.' };
    const cost = Math.max(0, Math.round(price));
    if ((base.crowns || 0) < cost) return { ok: false, message: 'Not enough Crowns.' };
    const skin = findSkin(skinId);
    const next = {
      ...base,
      crowns: (base.crowns || 0) - cost,
      owned_skins: [...owned, skinId],
    };
    // Auto-equip on purchase into the matching slot (ward backdrop vs hero aura)
    // so buying one cosmetic never unequips the other kind.
    if (skin?.wardBackdrop) next.equipped_ward_skin = skinId;
    else next.equipped_skin = skinId;
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: `Unlocked and equipped for ${cost} Crowns.` };
  }, [updateState]);

  // Equip (or, with skinId "", clear) a cosmetic. Ward-backdrop skins and hero
  // aura skins live in independent slots so both can be worn at once. When
  // clearing (skinId ""), pass `kind` to say which slot to reset; when equipping
  // a real skin the slot is derived from whether it carries a wardBackdrop.
  const equipSkin = useCallback(async (skinId: string, kind?: 'aura' | 'ward') => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    if (skinId && !(base.owned_skins || []).includes(skinId)) {
      return { ok: false, message: 'Skin not owned.' };
    }
    const isWard = skinId ? !!findSkin(skinId)?.wardBackdrop : kind === 'ward';
    const next = isWard
      ? { ...base, equipped_ward_skin: skinId }
      : { ...base, equipped_skin: skinId };
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
    const max = maxStaminaForPlayer(base);
    const cur = regen(base.stamina ?? max, base.stamina_updated_at ?? new Date(now).toISOString(), now, max);
    if (cur.stamina >= max) {
      return { ok: false, message: 'Stamina is already full.' };
    }
    const cost = Math.max(0, Math.round(price));
    if ((base.crowns || 0) < cost) return { ok: false, message: 'Not enough Crowns.' };
    const restored = Math.min(max, cur.stamina + amount);
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

  const setRealmLayout = useCallback(async (layoutPatch: Record<string, string | null>, decorPatch?: Record<string, string | null>) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const realm = await import('./realm');
    const nextLayout = { ...(base.realm_layout || buildDefaultRealmLayout()) };
    const nextProduction = { ...(base.realm_production || {}) };
    const now = Date.now();
    for (const [buildingId, cellId] of Object.entries(layoutPatch)) {
      const wasPlaced = !!nextLayout[buildingId];
      const willPlace = cellId != null;
      if (cellId == null) delete nextLayout[buildingId];
      else nextLayout[buildingId] = cellId;
      // Keep production honest across placement changes: a producer only earns
      // while it is on the board. On placement (re)start its clock now; on
      // removal settle accrued points and freeze so no time is banked while the
      // building sits in storage.
      const building = realm.getBuildingById(buildingId);
      if (building?.production && wasPlaced !== willPlace) {
        const lvl = (base.kingdom_levels || {})[building.kingdomLevelsKey] || 0;
        const count = realm.assignedHeroCount((base.realm_assignments || {})[buildingId]);
        const prev = nextProduction[buildingId];
        const settled = willPlace
          ? Math.max(0, prev?.points ?? 0)
          : realm.computeAccruedPoints(building, lvl, count, prev, now);
        nextProduction[buildingId] = { points: settled, updatedAt: new Date(now).toISOString() };
      }
    }
    const nextDecor = { ...(base.realm_decor || {}) };
    if (decorPatch) {
      for (const [plotId, decorationId] of Object.entries(decorPatch)) {
        if (decorationId == null) delete nextDecor[plotId];
        else nextDecor[plotId] = decorationId;
      }
    }
    const next = { ...base, realm_layout: nextLayout, realm_decor: nextDecor, realm_production: nextProduction };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: 'Realm layout updated.' };
  }, [updateState]);

  // Realm hero assignment — set the full per-slot hero id array for a building
  // ("" marks an empty slot). Before changing the roster we "settle" any points
  // that accrued under the OLD hero count, so the new rate only applies going
  // forward (never retroactively re-prices past accrual).
  const setRealmAssignment = useCallback(async (buildingId: string, heroIds: string[]) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const realm = await import('./realm');
    const building = realm.getBuildingById(buildingId);
    if (!building) return { ok: false, message: 'Unknown building.' };
    const maxSlots = building.heroSlots.length;
    if (maxSlots <= 0) return { ok: false, message: 'This building has no assignment slots.' };
    // Clamp to slot count and drop duplicate hero ids (a hero fills one slot).
    const seen = new Set<string>();
    const clamped: string[] = [];
    for (let i = 0; i < maxSlots; i++) {
      const id = heroIds[i] || '';
      if (id && !seen.has(id) && (base.heroes_owned || []).includes(id)) {
        seen.add(id);
        clamped.push(id);
      } else {
        clamped.push('');
      }
    }
    let nextProduction = base.realm_production || {};
    if (building.production) {
      const lvl = (base.kingdom_levels || {})[building.kingdomLevelsKey] || 0;
      const prevCount = realm.assignedHeroCount((base.realm_assignments || {})[buildingId]);
      const settled = realm.computeAccruedPoints(building, lvl, prevCount, (base.realm_production || {})[buildingId], Date.now());
      nextProduction = { ...nextProduction, [buildingId]: { points: settled, updatedAt: new Date().toISOString() } };
    }
    const next = {
      ...base,
      realm_assignments: { ...(base.realm_assignments || {}), [buildingId]: clamped },
      realm_production: nextProduction,
    };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: 'Assignment updated.' };
  }, [updateState]);

  // Collect the whole (floored) points a producer building has accrued into its
  // wallet currency, keeping the sub-1 fractional remainder to accrue onward.
  const collectRealmProduction = useCallback(async (buildingId: string) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const realm = await import('./realm');
    const building = realm.getBuildingById(buildingId);
    if (!building || !building.production) return { ok: false, message: 'This building does not produce points.' };
    const lvl = (base.kingdom_levels || {})[building.kingdomLevelsKey] || 0;
    if (lvl <= 0) return { ok: false, message: 'Build this structure first.' };
    // Producers only earn while on the board — reject collection if the building
    // is currently in storage, even if a frozen snapshot still holds points.
    if (!(base.realm_layout || {})[buildingId]) return { ok: false, message: 'Place this building in your Realm first.' };
    const count = realm.assignedHeroCount((base.realm_assignments || {})[buildingId]);
    const accrued = realm.computeAccruedPoints(building, lvl, count, (base.realm_production || {})[buildingId], Date.now());
    const amount = Math.floor(accrued);
    if (amount < 1) return { ok: false, message: 'Nothing to collect yet.' };
    const currency = building.production.currency;
    const next = {
      ...base,
      [currency]: ((base as any)[currency] || 0) + amount,
      realm_production: {
        ...(base.realm_production || {}),
        [buildingId]: { points: accrued - amount, updatedAt: new Date().toISOString() },
      },
    } as PlayerState;
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: `Collected ${amount.toLocaleString()} ${building.production.resource}.`, amount };
  }, [updateState]);

  const completeLesson = useCallback(async (lessonId: string) => {
    if (!player) return { ok: false, message: 'No player loaded.' };
    const { getLesson, computeLessonCompletion } = await import('./lessons');
    const lesson = getLesson(lessonId);
    if (!lesson) return { ok: false, message: 'Unknown lesson.' };
    const result = computeLessonCompletion(lesson, player);
    const completed = player.lessons_completed || [];
    const nextCompleted = result.isFirstCompletion ? [...completed, lessonId] : completed;
    await updateState(foldDaily({
      ...player,
      lessons_completed: nextCompleted,
      university_credits: (player.university_credits || 0) + result.creditsEarned,
      badge_progress: { ...(player.badge_progress || {}), [result.badgeId]: result.badgeProgress },
    }, 'university_lesson'));
    return { ok: true, message: `+${result.creditsEarned} University Credits!`, result };
  }, [player, updateState]);

  const completeSimulation = useCallback(async (simId: string, wasCorrect: boolean) => {
    if (!player) return { ok: false, message: 'No player loaded.' };
    const { getSimulation, computeSimulationCompletion } = await import('./lessons');
    const sim = getSimulation(simId);
    if (!sim) return { ok: false, message: 'Unknown simulation.' };
    const result = computeSimulationCompletion(sim, player, wasCorrect);
    const completed = player.simulations_completed || [];
    const nextCompleted = result.isFirstCompletion ? [...completed, simId] : completed;
    await updateState({
      ...player,
      simulations_completed: nextCompleted,
      university_credits: (player.university_credits || 0) + result.creditsEarned,
      badge_progress: { ...(player.badge_progress || {}), [result.badgeId]: result.badgeProgress },
    });
    return { ok: true, message: `+${result.creditsEarned} University Credits!`, result };
  }, [player, updateState]);

  // Sanctuary Bank — exchanges Insight Crystals for Refined Lotus Gems using a
  // fixed row from SANCTUARY_BANK_EXCHANGE_TABLE (Push 5.5). Weekly/monthly
  // caps are shown as informational UI copy only; not enforced here yet.
  const exchangeInsightCrystals = useCallback(async (insightCrystalsCost: number) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const { SANCTUARY_BANK_EXCHANGE_TABLE } = await import('./economy');
    const row = SANCTUARY_BANK_EXCHANGE_TABLE.find((r) => r.insightCrystals === insightCrystalsCost);
    if (!row) return { ok: false, message: 'Unknown exchange rate.' };
    const balance = base.insight_crystals || 0;
    if (balance < row.insightCrystals) {
      return { ok: false, message: `Need ${row.insightCrystals.toLocaleString()} Insight Crystals (have ${balance.toLocaleString()}).` };
    }
    const next = {
      ...base,
      insight_crystals: balance - row.insightCrystals,
      refined_lotus_gems: (base.refined_lotus_gems || 0) + row.refinedLotusGems,
    };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: `Exchanged ${row.insightCrystals.toLocaleString()} Insight Crystals for ${row.refinedLotusGems} Refined Lotus Gems.` };
  }, [updateState]);

  // Full account wipe — clears EVERY app-owned persisted flag (player,
  // one-time intro/tips banners, dismissed world-event banner, cached test
  // session, …), not just the player record, so "Reset Account" truly starts
  // the game over from scratch. All Clinica keys share the `clinica.` prefix.
  const resetPlayer = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const owned = keys.filter((k) => k.startsWith('clinica.'));
      if (owned.length) await AsyncStorage.multiRemove(owned);
      else await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // Fall back to at least clearing the player record if enumeration fails.
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
    playerRef.current = null;
    setPlayer(null);
  }, []);

  // Lightweight, additive progress hook for Clinical Cue topics answered correctly
  // in battle. Never throws/blocks — purely a counter for future Codex/University
  // surfacing. Safe no-op on an empty list.
  const recordCueTopics = useCallback(async (topics: string[]) => {
    if (!topics || topics.length === 0) return;
    const base = playerRef.current;
    if (!base) return;
    const progress = { ...(base.cue_topic_progress || {}) };
    for (const t of topics) {
      progress[t] = (progress[t] || 0) + 1;
    }
    const next = { ...base, cue_topic_progress: progress };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // Class Tree (Push 6) — safe, free class switch (no cost, no cooldown; the
  // UI is expected to gate this behind a confirm/cancel dialog).
  const setPlayerClass = useCallback(async (classId: ClassId) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    if (!CLASS_IDS.includes(classId)) return { ok: false, message: 'Unknown class.' };
    if (base.class_tree_id === classId) return { ok: true, message: 'Already your current class.' };
    const next = { ...base, class_tree_id: classId };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: `Your class is now ${classId[0].toUpperCase()}${classId.slice(1)}.` };
  }, [updateState]);

  // Class Tree (Push 6) — claims a Lv10/20/30 ability tier for a class,
  // spending the required materials from inventory. Lv1 tiers are automatic
  // and never need to be claimed. Re-validates everything server-side of
  // the UI (level, not-already-claimed, sufficient materials) before
  // spending, so this is safe to call directly.
  const claimClassTier = useCallback(async (classId: ClassId, level: 1 | 10 | 20 | 30) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const card = getClassTree(classId).find((c) => c.level === level);
    if (!card) return { ok: false, message: 'Unknown class ability.' };
    const progress = (base.class_progress || {})[classId] || [];
    const playerLevel = base.player_level ?? playerLevelFromXp(base.xp).level;
    const check = canClaimTier(card, playerLevel, progress, base.inventory || {});
    if (!check.ok) return { ok: false, message: check.reason || 'Cannot unlock this ability yet.' };
    const inventory = { ...(base.inventory || {}) };
    for (const req of card.requirements) {
      inventory[req.material] = (inventory[req.material] || 0) - req.qty;
    }
    const classProgress = { ...defaultClassProgress(), ...(base.class_progress || {}) };
    classProgress[classId] = [...(classProgress[classId] || []), level];
    const next = { ...base, inventory, class_progress: classProgress };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: `${card.name} unlocked.` };
  }, [updateState]);

  // Push 1 prologue — marks the guided tutorial + scripted boss sequence
  // finished so the player never re-enters it. Idempotent no-op if already set.
  const completePrologue = useCallback(async () => {
    const base = playerRef.current;
    if (!base || base.prologue_complete) return;
    const next = { ...base, prologue_complete: true };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // Push 2 post-recall onboarding — step 1: identity restoration. Saves the
  // player-entered name to the same `name` field used everywhere else
  // (header, profile, etc.) and marks this sub-step done so it is never
  // re-shown. Idempotent no-op if already restored.
  const completeIdentityRestore = useCallback(async (name: string) => {
    const base = playerRef.current;
    if (!base) return;
    const cleanName = (name || '').trim().slice(0, 24) || base.name || 'Healer';
    if (base.identity_restored && base.name === cleanName) return;
    const next = { ...base, name: cleanName, identity_restored: true };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // Persist the player's chosen hand-drawn portrait avatar. `id` is an avatar
  // registry key (see game/avatars.ts); '' clears back to the aptitude icon.
  const setAvatar = useCallback(async (id: string) => {
    const base = playerRef.current;
    if (!base) return;
    const clean = (id || '').trim();
    if (!isValidAvatarId(clean)) return;
    if (base.avatar_id === clean) return;
    const next = { ...base, avatar_id: clean };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // Push 3: marks the post-recall diagnostic sub-step as seen WITHOUT
  // assigning a class. This is the CURRENT live completion action used by
  // app/post-recall.tsx — Push 3 only surfaces the personality/career quiz
  // result (primary/second-closest class + resonance) for the player to
  // read; it deliberately does NOT persist a class onto the player yet,
  // since the backend/store only model 3 aptitudes (guardian/sage/warden)
  // and mapping 6 quiz classes onto those is Push 4+ work.
  // Idempotent no-op if already seen.
  const completeDiagnosticIntro = useCallback(async () => {
    const base = playerRef.current;
    if (!base || base.diagnostic_intro_seen) return;
    const next = { ...base, diagnostic_intro_seen: true };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // Push 4 — the actual "save to profile" step following the post-recall
  // class-result screen. This is now the LIVE completion path called by
  // app/post-recall.tsx: it registers the chosen class onto class_tree_id
  // (the exact same field Profile/PlayerHeader/Class Tree already read —
  // reuses setPlayerClass's validation) AND marks diagnostic_intro_seen in
  // one atomic update, so the player is never left in a half-confirmed
  // state. Deliberately does NOT touch aptitude/learning_profile/difficulty/
  // heroes_owned/active_team — the choice is meant to be forgiving and
  // non-permanent (freely re-switchable later from the Class Tree screen),
  // so no hero grants or identity fields are altered here.
  // `resonance`/`secondaryFantasyClass` are an optional Push 6 snapshot of the
  // quiz result at confirmation time, purely for the read-only Review Class
  // Result screen — never re-derives or gates any gameplay. Falls back to
  // deterministic defaults when omitted (e.g. legacy callers).
  const confirmClassDiagnostic = useCallback(async (classId: ClassId, resonance?: string, secondaryFantasyClass?: string) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    if (!CLASS_IDS.includes(classId)) return { ok: false, message: 'Unknown class.' };
    const fallbackFantasy = fantasyClassFromClassId(classId);
    const next: PlayerState = {
      ...base,
      class_tree_id: classId,
      diagnostic_intro_seen: true,
      class_diagnostic_resonance: resonance || CLASS_DEFAULT_RESONANCE[fallbackFantasy],
      class_diagnostic_secondary: secondaryFantasyClass || FANTASY_CLASSES.find((c) => c !== fallbackFantasy) || fallbackFantasy,
    };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: `Class registered — ${classId[0].toUpperCase()}${classId.slice(1)}.` };
  }, [updateState]);

  // Push 5 — marks the post-recall memory-reminiscence scene as seen so the
  // one-time redirect (post-recall -> reminiscence -> University) never
  // re-triggers on later app opens. Idempotent no-op if already seen.
  const markReminiscenceSeen = useCallback(async () => {
    const base = playerRef.current;
    if (!base || base.seen_reminiscence) return;
    const next = { ...base, seen_reminiscence: true };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // Manhwa story layer — records that a story scene has been watched (or
  // skipped), so its one-time auto-trigger / "NEW" badge never re-fires.
  // Idempotent; uses playerRef so rapid finish+skip taps can't double-write.
  const markStorySceneSeen = useCallback(async (sceneId: string) => {
    const base = playerRef.current;
    if (!base || !sceneId) return;
    const seen = base.story_scenes_seen || [];
    if (seen.includes(sceneId)) return;
    const next = { ...base, story_scenes_seen: [...seen, sceneId] };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // Push 5 — completes a Lotus Lessons node (the Duolingo-style onboarding
  // path inside University). Grants fixed, earned-only rewards (Insight
  // Crystals, Crowns/"Ward Coins", University Credits/"Knowledge Points",
  // Player XP) — never paid Lotus Gems. Tracked in the same
  // lessons_completed list as the Lessons & Simulations MVP, under a
  // "lotus:" id prefix so the two systems never collide. Repeat completions
  // are a no-op (rewards are a one-time onboarding grant, not farmable).
  const completeLotusLessonNode = useCallback(async (nodeId: string) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const { getLotusNode, lotusNodeCompletionId } = await import('./lotusLessons');
    const node = getLotusNode(nodeId);
    if (!node || node.status !== 'available') return { ok: false, message: 'Unknown lesson.' };
    const completionId = lotusNodeCompletionId(nodeId);
    const completed = base.lessons_completed || [];
    if (completed.includes(completionId)) {
      return { ok: true, message: 'Already completed.', rewards: node.rewards };
    }
    const withXp = applyXpDetailed(base, node.rewards.xp).player;
    // Heroes are earned exclusively through University Recruitment — lessons
    // never grant heroes, only currencies and XP.
    const next: PlayerState = {
      ...withXp,
      lessons_completed: [...completed, completionId],
      insight_crystals: (base.insight_crystals || 0) + node.rewards.insightCrystals,
      crowns: (base.crowns || 0) + node.rewards.crowns,
      university_credits: (base.university_credits || 0) + node.rewards.universityCredits,
    };
    playerRef.current = next;
    await updateState(next);
    return {
      ok: true,
      message: `+${node.rewards.insightCrystals} Insight Crystals · +${node.rewards.crowns} Ward Coins · +${node.rewards.universityCredits} University Credits · +${node.rewards.xp} XP`,
      rewards: node.rewards,
    };
  }, [updateState]);

  // Reserved for a future push: applies a full identity result onto the
  // EXISTING player (switches aptitude/class identity, learning +
  // difficulty settings, grants the new aptitude's starting hero, realigns
  // the account-level class tree). NOT called by the current post-recall
  // flow — Push 4 registers the class via confirmClassDiagnostic (above)
  // only, and deliberately leaves aptitude/learning-profile/hero-grant
  // fields untouched. Mapping the 6 quiz classes onto the 3 backend
  // aptitudes (if ever needed) remains future work.
  const applyClassDiagnostic = useCallback(async (profile: ClassDiagnosticInput) => {
    const base = playerRef.current;
    if (!base) return;
    // Heroes come exclusively from University Recruitment — a class switch
    // never grants a starter hero, it only realigns identity/class fields.
    const next: PlayerState = {
      ...base,
      aptitude: profile.aptitude as any,
      player_class: profile.player_class,
      learning_profile: profile.learning_profile,
      difficulty: profile.difficulty as any,
      system_affinity: profile.system_affinity,
      explanation_style: profile.explanation_style,
      codex_depth: profile.codex_depth,
      class_tree_id: classIdForAptitude(profile.aptitude),
      diagnostic_intro_seen: true,
    };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  const setLearningProfile = useCallback(async (profileId: string) => {
    const base = playerRef.current;
    if (!base) return;
    const next: PlayerState = { ...base, learning_profile: profileId };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // C3 — Record the best star rating for a battle (keyed by enemy id).
  // Only updates when the new stars beat the existing best; no-ops otherwise.
  const updateBattleStars = useCallback(async (enemyId: string, stars: number) => {
    const base = playerRef.current;
    if (!base) return;
    const currentBest = (base.battle_stars ?? {})[enemyId] ?? 0;
    if (stars <= currentBest) return;
    const next: PlayerState = {
      ...base,
      battle_stars: { ...(base.battle_stars ?? {}), [enemyId]: stars },
    };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // C3 — Auto-sweep a previously cleared battle.
  // Spends stamina, grants star-scaled XP + Ward Coins. No first-clear bonus,
  // no Codex Shards, no hero XP — repeatable rewards only.
  const performSweep = useCallback(async (
    enemyId: string,
    baseXp: number,
    bestStars: number,
  ): Promise<{ ok: boolean; xp: number; crowns: number; message: string }> => {
    const { isSweepUnlocked, getSweepXp, getSweepCrowns, SWEEP_STAMINA_COST } =
      await import('./battleXp');
    if (!isSweepUnlocked(bestStars)) {
      return { ok: false, xp: 0, crowns: 0, message: 'Reach 2 stars to unlock Auto Sweep.' };
    }
    const ok = await spendStamina(SWEEP_STAMINA_COST);
    if (!ok) return { ok: false, xp: 0, crowns: 0, message: 'Not enough Shift Challenges.' };
    const xp = getSweepXp(baseXp, bestStars);
    const sweepCrowns = getSweepCrowns(baseXp);
    await applyRewards({ xp, codexShards: 0, crowns: sweepCrowns, codex: [], enemyId, enemyName: enemyId });
    return { ok: true, xp, crowns: sweepCrowns, message: `Field Practice swept! +${xp} XP, +${sweepCrowns} Crowns.` };
  }, [spendStamina, applyRewards]);

  // ── C4 — one-time level milestone claim ─────────────────────────────────────
  const claimLevelReward = useCallback(async (milestoneId: string): Promise<{ ok: boolean; message: string }> => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player.' };
    if ((base.claimed_level_rewards ?? []).includes(milestoneId)) {
      return { ok: false, message: 'Already claimed.' };
    }
    const { LEVEL_MILESTONES } = await import('./milestones');
    const milestone = LEVEL_MILESTONES.find((m) => m.id === milestoneId);
    if (!milestone) return { ok: false, message: 'Unknown milestone.' };
    const level = playerLevelFromXp(base.xp ?? 0).level;
    if (level < milestone.level) return { ok: false, message: `Reach Level ${milestone.level} first.` };
    const next: PlayerState = {
      ...base,
      claimed_level_rewards: [...(base.claimed_level_rewards ?? []), milestoneId],
      codex_shards: (base.codex_shards || 0) + (milestone.rewards.codexShards || 0),
      crowns: (base.crowns || 0) + (milestone.rewards.crowns || 0),
      refined_lotus_gems: (base.refined_lotus_gems || 0) + (milestone.rewards.refinedLotusGems || 0),
      university_credits: (base.university_credits || 0) + (milestone.rewards.universityCredits || 0),
    };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: `Claimed ${milestone.label} reward!` };
  }, [updateState, playerLevelFromXp]);

  // ── C4 — one-time chapter chest claim ───────────────────────────────────────
  const claimChapterChest = useCallback(async (chestId: string): Promise<{ ok: boolean; message: string }> => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player.' };
    if ((base.claimed_chapter_chests ?? []).includes(chestId)) {
      return { ok: false, message: 'Already claimed.' };
    }
    const { CHAPTER_CHESTS } = await import('./milestones');
    const { CHAPTERS, getChapterStatus } = await import('./chapterJourney');
    const chest = CHAPTER_CHESTS.find((c) => c.id === chestId);
    if (!chest) return { ok: false, message: 'Unknown chest.' };
    const chapter = CHAPTERS.find((ch) => ch.number === chest.chapter);
    if (!chapter) return { ok: false, message: 'Chapter not found.' };
    const level = playerLevelFromXp(base.xp ?? 0).level;
    const status = getChapterStatus(chapter, level);
    if (status === 'locked') return { ok: false, message: `Complete Chapter ${chest.chapter} first.` };
    // Grant title if applicable (same safe-add as setActiveTitle does)
    const ownedTitles = base.owned_titles ?? [];
    const newTitles = chest.titleId && !ownedTitles.includes(chest.titleId)
      ? [...ownedTitles, chest.titleId]
      : ownedTitles;
    // Build currency state first, then layer XP on top so level-up is consistent.
    let next: PlayerState = {
      ...base,
      claimed_chapter_chests: [...(base.claimed_chapter_chests ?? []), chestId],
      codex_shards: (base.codex_shards || 0) + (chest.rewards.codexShards || 0),
      crowns: (base.crowns || 0) + (chest.rewards.crowns || 0),
      refined_lotus_gems: (base.refined_lotus_gems || 0) + (chest.rewards.refinedLotusGems || 0),
      university_credits: (base.university_credits || 0) + (chest.rewards.universityCredits || 0),
      owned_titles: newTitles,
    };
    // J2: apply player XP from the chest reward.
    if (chest.rewards.playerXp) {
      next = applyXp(next, chest.rewards.playerXp);
    }
    // J2: split hero XP equally among active team (or first 3 owned heroes).
    if (chest.rewards.heroXp && chest.rewards.heroXp > 0) {
      const teamIds = (base.active_team || []).filter(Boolean);
      const pool = teamIds.length > 0 ? teamIds : (base.heroes_owned || []).slice(0, 3);
      if (pool.length > 0) {
        const perHero = Math.max(1, Math.round(chest.rewards.heroXp / pool.length));
        const prog = { ...(next.hero_progression || {}) };
        for (const heroId of pool) {
          const existing = prog[heroId] ?? defaultProgress() as any;
          const cap = levelCapForStar(existing.star ?? 1);
          const result = addHeroXp(existing.level ?? 1, existing.xp ?? 0, perHero, cap);
          prog[heroId] = { ...existing, xp: result.xp, level: result.level };
        }
        next = { ...next, hero_progression: prog };
      }
    }
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: `Chapter ${chest.chapter} chest claimed!` };
  }, [updateState, playerLevelFromXp]);

  // ── C4 — one-time chapter 3-star bonus claim ─────────────────────────────────
  const claimChapter3Star = useCallback(async (rewardId: string): Promise<{ ok: boolean; message: string }> => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player.' };
    if ((base.claimed_chapter_3star ?? []).includes(rewardId)) {
      return { ok: false, message: 'Already claimed.' };
    }
    const { CHAPTER_3STAR_REWARDS, hasChapter3StarClear } = await import('./milestones');
    const { ENEMIES } = await import('./content');
    const reward = CHAPTER_3STAR_REWARDS.find((r) => r.id === rewardId);
    if (!reward) return { ok: false, message: 'Unknown reward.' };
    const has3Star = hasChapter3StarClear(base.battle_stars ?? {}, reward.chapter, ENEMIES);
    if (!has3Star) return { ok: false, message: `Earn a 3-star clear in Chapter ${reward.chapter} first.` };
    const next: PlayerState = {
      ...base,
      claimed_chapter_3star: [...(base.claimed_chapter_3star ?? []), rewardId],
      refined_lotus_gems: (base.refined_lotus_gems || 0) + reward.refinedLotusGems,
    };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: `Chapter ${reward.chapter} ★★★ bonus claimed! +${reward.refinedLotusGems} Refined Gems` };
  }, [updateState]);

  // ── J2 — one-time journey node first-clear reward claim ──────────────────────
  const claimJourneyNode = useCallback(async (
    nodeId: string,
    stars: number,
  ): Promise<{ ok: boolean; message: string; reward?: import('./journeyRewards').ComputedJourneyReward }> => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player.' };
    const claimed = base.claimed_journey_nodes ?? [];
    if (claimed.includes(nodeId)) {
      return { ok: false, message: 'Already claimed.' };
    }
    const { getJourneyNodeDef, computeJourneyReward } = await import('./journeyRewards');
    const def = getJourneyNodeDef(nodeId);
    if (!def) return { ok: false, message: 'Unknown journey node.' };
    const reward = computeJourneyReward(def, stars);
    // Build currency state first, then layer XP.
    let next: PlayerState = {
      ...base,
      claimed_journey_nodes: [...claimed, nodeId],
      crowns: (base.crowns || 0) + reward.coins,
      codex_shards: (base.codex_shards || 0) + reward.shards,
      university_credits: (base.university_credits || 0) + reward.credits,
    };
    if (reward.playerXp > 0) {
      next = applyXp(next, reward.playerXp);
    }
    // Split hero XP equally among active team (or first 3 owned heroes).
    if (reward.heroXp > 0) {
      const teamIds = (base.active_team || []).filter(Boolean);
      const pool = teamIds.length > 0 ? teamIds : (base.heroes_owned || []).slice(0, 3);
      if (pool.length > 0) {
        const perHero = Math.max(1, Math.round(reward.heroXp / pool.length));
        const prog = { ...(next.hero_progression || {}) };
        for (const heroId of pool) {
          const existing = prog[heroId] ?? defaultProgress() as any;
          const cap = levelCapForStar(existing.star ?? 1);
          const result = addHeroXp(existing.level ?? 1, existing.xp ?? 0, perHero, cap);
          prog[heroId] = { ...existing, xp: result.xp, level: result.level };
        }
        next = { ...next, hero_progression: prog };
      }
    }
    playerRef.current = next;
    await updateState(next);
    const parts: string[] = [];
    if (reward.playerXp) parts.push(`+${reward.playerXp} XP`);
    if (reward.heroXp)   parts.push(`+${reward.heroXp} Hero XP`);
    if (reward.coins)    parts.push(`+${reward.coins} Coins`);
    if (reward.shards)   parts.push(`+${reward.shards} Shards`);
    if (reward.credits)  parts.push(`+${reward.credits} Credits`);
    return { ok: true, message: parts.join(' · ') || 'Node cleared!', reward };
  }, [updateState]);

  // ── C5 — mark the Level 2 unlock celebration as seen ───────────────────────
  const markLv2UnlockSeen = useCallback(async () => {
    const base = playerRef.current;
    if (!base || base.seen_lv2_unlock) return;
    const next: PlayerState = { ...base, seen_lv2_unlock: true };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  const value = useMemo<Ctx>(() => ({
    player, loading, dailyPulse, openRoundsSignal, requestOpenDailyRounds, createPlayer, applyRewards, recordWardWaves, purchaseItem, redeemExchangeItem, claimMilestone, setActiveTitle, purchaseSkin, equipSkin, purchaseUpgrade, refillStamina, pullGacha, upgradeUnitMastery, setWardLoadout, setRealmLayout, setRealmAssignment, collectRealmProduction, recordFailure,
    syncInventory, saveActiveTeam, summonOnce, evolveHero, recruitOnce, recruitTen, promoteHeroCert, trainHero, toggleHeroLock, toggleHeroFavorite, completeLesson, completeSimulation, spendStamina, logWellnessActivity, checkInDailyRounds, claimDailyObjective, claimDailyAllComplete, claimWeeklyGoal, exchangeInsightCrystals, recordCueTopics, resetPlayer, refresh, setPlayerClass, claimClassTier, completePrologue, completeIdentityRestore, setAvatar, completeDiagnosticIntro, markReminiscenceSeen, markStorySceneSeen, completeLotusLessonNode, applyClassDiagnostic, confirmClassDiagnostic, setLearningProfile, updateBattleStars, performSweep, claimLevelReward, claimChapterChest, claimChapter3Star, claimJourneyNode, markLv2UnlockSeen, updateState,
  }), [player, loading, dailyPulse, openRoundsSignal, requestOpenDailyRounds, createPlayer, applyRewards, recordWardWaves, purchaseItem, redeemExchangeItem, claimMilestone, setActiveTitle, purchaseSkin, equipSkin, purchaseUpgrade, refillStamina, pullGacha, upgradeUnitMastery, setWardLoadout, setRealmLayout, setRealmAssignment, collectRealmProduction, recordFailure, syncInventory, saveActiveTeam, summonOnce, evolveHero, recruitOnce, recruitTen, promoteHeroCert, trainHero, toggleHeroLock, toggleHeroFavorite, completeLesson, completeSimulation, spendStamina, logWellnessActivity, checkInDailyRounds, claimDailyObjective, claimDailyAllComplete, claimWeeklyGoal, exchangeInsightCrystals, recordCueTopics, resetPlayer, refresh, setPlayerClass, claimClassTier, completePrologue, completeIdentityRestore, setAvatar, completeDiagnosticIntro, markReminiscenceSeen, markStorySceneSeen, completeLotusLessonNode, applyClassDiagnostic, confirmClassDiagnostic, setLearningProfile, updateBattleStars, performSweep, claimLevelReward, claimChapterChest, claimChapter3Star, claimJourneyNode, markLv2UnlockSeen, updateState]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
