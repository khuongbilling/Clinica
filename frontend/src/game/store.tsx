import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearBagSeenCache } from '@/src/game/bagSeenStore';
import { clearHeroSeenCache } from '@/src/game/heroSeenStore';
import { clearRealmSeenCache } from '@/src/game/realmSeenStore';
import { clearShopSeenCache } from '@/src/game/shopSeenStore';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/src/api/client';
import { Aptitude, PlayerState } from './types';
import type { PlayerHeroEligibility, PlayerHeroRecord, PlayerHeroAppearance } from './playerHero';
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
  claimAllCompleteBonus, claimWeeklyReward,
  claimWeeklyTask as claimWeeklyTaskPure, claimWeeklyAllComplete as claimWeeklyAllCompletePure,
  recordWeeklyProgress, QUEST_MILESTONES, CheckInResult, allObjectivesComplete, allWeeklyTasksComplete,
} from './dailyRounds';
import { buildGateContext, checkFeatureGate } from './progression';
import { getDailyEligibleFeatureIds } from './activityRegistry';
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
import { reconcileEarlyObjectives, setPendingReconcile } from './objectiveProgress';
import { CLASS_DEFAULT_RESONANCE, FANTASY_CLASSES, fantasyClassFromClassId } from './classQuiz';
import { normalizeProfileId } from './onboarding';
import { TokenExchangeItem, MIASMA_BLOOM_MILESTONES, getMilestoneProgress } from './worldEvent';
import { scaledAge1Reward } from './age1Economy';
import type { ClinicalChallenge, ClinicalEvaluation } from './clinicalChallenge';

const STORAGE_KEY = 'clinica.player.v2';

// Backfill hero_progression so every owned hero has a star/copies entry,
// and clamp any malformed values. Keeps older/remote saves compatible.
function normalizeProgression(p: PlayerState): PlayerState {
  const src = p.hero_progression || {};
  const prog: Record<string, { star: number; copies: number; level: number; xp: number; locked: boolean; favorite: boolean }> = {};
  let changed = !p.hero_progression;
  if (p.night_market_unlocked === undefined) {
    p = { ...p, night_market_unlocked: (p.inventory?.['Night Market Ticket'] ?? 0) > 0 };
    changed = true;
  }
  if (p.prologue_complete === undefined) { p = { ...p, prologue_complete: true }; changed = true; }
  if (p.identity_restored === undefined) { p = { ...p, identity_restored: true }; changed = true; }
  if (p.diagnostic_intro_seen === undefined) { p = { ...p, diagnostic_intro_seen: true }; changed = true; }
  // Safety-net: if the player already has a confirmed class_tree_id they
  // definitely completed the diagnostic — promote any stale false values.
  // Also covers: player has a custom name (completed identity phase), or has
  // played at least one run (well past onboarding).  These are one-way flags
  // so promoting them here is always safe.
  if (p.class_tree_id && !p.diagnostic_intro_seen) { p = { ...p, diagnostic_intro_seen: true }; changed = true; }
  if (p.class_tree_id && !p.identity_restored)     { p = { ...p, identity_restored: true };     changed = true; }
  if ((p.runs_completed ?? 0) > 0 && !p.diagnostic_intro_seen) { p = { ...p, diagnostic_intro_seen: true }; changed = true; }
  if ((p.runs_completed ?? 0) > 0 && !p.identity_restored)     { p = { ...p, identity_restored: true };     changed = true; }
  if (p.avatar_id === undefined) { p = { ...p, avatar_id: '' }; changed = true; }
  // Player Hero is deliberately read-side only here. Legacy accounts do not
  // receive it by migration; the dedicated server endpoint creates it exactly
  // once after every eligibility requirement has been verified.
  if (p.player_hero === undefined) { p = { ...p, player_hero: null }; changed = true; }
  if (p.player_hero_opportunities === undefined) { p = { ...p, player_hero_opportunities: [] }; changed = true; }
  if (p.awakening_beat_complete === undefined) { p = { ...p, awakening_beat_complete: false }; changed = true; }
  // Task 369 — one-time migration: rewrite stored legacy learning_profile IDs
  // to their canonical equivalents so the dual-branch fallbacks in
  // getTutorialTier / getInitialFeedbackLevel / getStarRules /
  // DEFAULT_DIFFICULTY_BY_PROFILE / getExplanationLayer can be safely removed
  // in a future push.  Only IDs with byte-for-byte identical behaviour in all
  // five functions are remapped here; `preNursing` is intentionally excluded
  // because its explanation layer (simpleMedical) differs from nursing_student.
  {
    const LEGACY_PROFILE_MAP: Record<string, string> = {
      nonmedical:            'curious',
      nursingStudent:        'nursing_student',
      nclexPrep:             'nclex',
      healthcareProfessional: 'professional',
    };
    const lp = p.learning_profile as string | null | undefined;
    if (lp && Object.prototype.hasOwnProperty.call(LEGACY_PROFILE_MAP, lp)) {
      p = { ...p, learning_profile: LEGACY_PROFILE_MAP[lp] };
      changed = true;
    }
  }
  // Push 5 — existing players (created before this push) never had the
  // reminiscence scene, so backfill them as "already seen" rather than
  // surprising returning players with it. Brand-new players get `false`
  // explicitly in createPlayer below, so they DO see it once.
  if (p.seen_reminiscence === undefined) { p = { ...p, seen_reminiscence: true }; changed = true; }
  // Push 8 — character-creation fields; null backfill for pre-existing players.
  if (p.pronouns      === undefined) { p = { ...p, pronouns: null };       changed = true; }
  if (p.char_skin_tone === undefined) { p = { ...p, char_skin_tone: null }; changed = true; }
  if (p.char_hair_style === undefined) { p = { ...p, char_hair_style: null }; changed = true; }
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
  // Age 1 bookkeeping is read-side optional so old local/backend saves remain
  // loadable.  The old default was 5 stamina; migrate only that untouched
  // legacy default to the new Level 1 baseline, preserving genuinely spent
  // stamina for returning players.
  if (out.age1_reward_units == null) out = { ...out, age1_reward_units: 0 };
  if (out.age1_stamina_bonus_sources == null) out = { ...out, age1_stamina_bonus_sources: [] };
  if (out.age1_refill_amount == null) out = { ...out, age1_refill_amount: 0 };
  if (out.stamina === 5 && !out.age1_reward_day && !out.age1_refill_day) {
    out = { ...out, stamina: MAX_STAMINA, stamina_updated_at: new Date().toISOString() };
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
  // Board records, rotation history and Aegis protection are independent from
  // ordinary battle stars and safely backfilled for every legacy save.
  if (!out.ward_defense_records) out = { ...out, ward_defense_records: {} };
  if (!out.ward_defense_rotation) out = { ...out, ward_defense_rotation: { bag: [], rotationCompletedIds: [] } };
  if (!out.ward_defense_claimed_run_ids) out = { ...out, ward_defense_claimed_run_ids: [] };
  if (!out.ward_defense_recent_families) out = { ...out, ward_defense_recent_families: [] };
  if (!out.ward_defense_missed_families) out = { ...out, ward_defense_missed_families: [] };
  if (!out.ward_exchange_purchases) out = { ...out, ward_exchange_purchases: {} };
  if (out.ward_aegis_pity == null) out = { ...out, ward_aegis_pity: 0 };
  if (out.ward_aegis_lifetime_fragments == null) out = { ...out, ward_aegis_lifetime_fragments: 0 };
  if (out.ward_aegis_weekly_random_drops == null) out = { ...out, ward_aegis_weekly_random_drops: 0 };
  if (out.ward_aegis_milestone_granted == null) out = { ...out, ward_aegis_milestone_granted: false };
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
  // P5 — backfill seen_university_intro.
  // Existing players who already have lessons or runs skip the intro (they've
  // been to University before). New players start with false so they see it
  // on their first University visit.
  if (out.seen_university_intro == null) {
    const hasUniProgress = (out.lessons_completed?.length ?? 0) > 0 || (out.runs_completed ?? 0) > 0;
    out = { ...out, seen_university_intro: hasUniProgress };
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
  // P1 — migrate legacy Chapter 1 node IDs (c1p*) to the revised 6-node format.
  // Old: c1p1 (story), c1p2 (battle), c1p3 (placeholder), c1p4 (battle), c1p5 (mini_boss)
  // New: c1n1 (memory_fragment), c1n2 (challenge), c1n3 (challenge),
  //      c1n4 (battle), c1n5 (reflection), c1n6 (mini_boss)
  // c1p3 was always isPlaceholder with no route so it was never claimable.
  // c1p4 (intermediate battle) maps to c1n4 as the equivalent ward-shift slot.
  if ((out.claimed_journey_nodes as string[]).some((id: string) => id.startsWith("c1p"))) {
    const nodeMap: Record<string, string> = {
      c1p1: "c1n1",
      c1p2: "c1n4",
      c1p4: "c1n4",
      c1p5: "c1n6",
    };
    const current = out.claimed_journey_nodes as string[];
    let changed = false;
    const migrated = [...current];
    for (const [oldId, newId] of Object.entries(nodeMap)) {
      if (current.includes(oldId) && !migrated.includes(newId)) {
        migrated.push(newId);
        changed = true;
      }
    }
    if (changed) out = { ...out, claimed_journey_nodes: migrated };
  }
  // J3 — backfill University practice counters and milestone claims.
  if (out.uni_cue_lab_count == null) out = { ...out, uni_cue_lab_count: 0 };
  if (out.uni_triage_count == null)  out = { ...out, uni_triage_count: 0 };
  if (out.uni_stack_count == null)   out = { ...out, uni_stack_count: 0 };
  if (!out.uni_practice_milestones_claimed) out = { ...out, uni_practice_milestones_claimed: [] };
  // J4 — backfill Hero Skill Academy upgrade state for pre-J4 saves.
  if (!out.hero_skill_upgrades) out = { ...out, hero_skill_upgrades: {} };
  if (!out.clinical_practice) {
    out = {
      ...out,
      clinical_practice: { history: [], mastery: { domains: {}, topics: {} }, personalBest: {}, safetyStreak: 0 },
    };
  }
  if (!Array.isArray(out.clinical_simulation_history)) {
    out = { ...out, clinical_simulation_history: [] };
  }
  if (!Array.isArray(out.clinical_simulation_achievements)) {
    out = { ...out, clinical_simulation_achievements: [] };
  }
  if (out.clinical_simulation_active_attempt_id === undefined) {
    out = { ...out, clinical_simulation_active_attempt_id: null };
  }
  if (out.grand_rounds_history === undefined) out = { ...out, grand_rounds_history: [] };
  if (out.grand_rounds_active_attempt_id === undefined) out = { ...out, grand_rounds_active_attempt_id: null };
  if (out.grand_rounds_first_clear_claims === undefined) out = { ...out, grand_rounds_first_clear_claims: {} };
  if (out.grand_rounds_case_bests === undefined) out = { ...out, grand_rounds_case_bests: {} };
  if (out.grand_rounds_daily_event_ids === undefined) out = { ...out, grand_rounds_daily_event_ids: [] };
  // Task 817 — Crisis Drill backfills for pre-817 saves.
  if (out.crisis_drill_history === undefined) out = { ...out, crisis_drill_history: [] };
  if (out.crisis_drill_active_attempt_id === undefined) out = { ...out, crisis_drill_active_attempt_id: null };
  if (out.crisis_drill_case_bests === undefined) out = { ...out, crisis_drill_case_bests: {} };
  if (out.crisis_drill_first_clear_claims === undefined) out = { ...out, crisis_drill_first_clear_claims: {} };
  if (out.crisis_drill_drill_bests === undefined) out = { ...out, crisis_drill_drill_bests: {} };
  if (out.crisis_drill_mastery_by_family === undefined) out = { ...out, crisis_drill_mastery_by_family: {} };
  if (out.crisis_drill_daily_event_ids === undefined) out = { ...out, crisis_drill_daily_event_ids: [] };
  if (!out.clinical_simulation_first_clear_claims) {
    out = { ...out, clinical_simulation_first_clear_claims: {} };
  }
  if (!out.clinical_simulation_family_bests) {
    out = { ...out, clinical_simulation_family_bests: {} };
  }
  if (!Array.isArray(out.clinical_simulation_daily_event_ids)) {
    out = { ...out, clinical_simulation_daily_event_ids: [] };
  }
  // Push 10 — backfill hero equipment loadouts for pre-P10 saves.
  if (!out.hero_equipment) out = { ...out, hero_equipment: {} };
  // Task 270 — backfill owned equipment list for pre-270 saves.
  if (!Array.isArray(out.owned_equipment)) out = { ...out, owned_equipment: [] };
  // Task 513 — backfill class specialization map for pre-513 saves.
  if (!out.class_specialization) out = { ...out, class_specialization: {} };
  // Task 570 — backfill chapter-level Area Boss key progression for pre-570 saves.
  if (!out.chapter_boss_keys) out = { ...out, chapter_boss_keys: {} };
  if (!out.canonical_shifts) out = { ...out, canonical_shifts: {} };
  // Push 4 — backfill Practice Curriculum completion list for pre-P4 saves.
  if (!out.practice_modules_completed) out = { ...out, practice_modules_completed: [] };
  if (out.seen_practice_curriculum == null) out = { ...out, seen_practice_curriculum: false };
  // Push 5 — Tutorial Recruitment Ceremony flags. Returning players who already
  // own the relevant heroes are backfilled as "done" so they never get extra
  // duplicate guaranteed heroes. New players start with both false.
  if (out.tutorial_summon_1_done == null) {
    const ownedCount = (out.heroes_owned || []).length;
    out = { ...out, tutorial_summon_1_done: ownedCount >= 1, tutorial_summon_2_done: ownedCount >= 2 };
  } else if (out.tutorial_summon_2_done == null) {
    const ownedCount = (out.heroes_owned || []).length;
    out = { ...out, tutorial_summon_2_done: ownedCount >= 2 };
  }
  // Fix 9 — backfill quest milestone claim tracking.
  if (!out.claimed_daily_milestones) out = { ...out, claimed_daily_milestones: [] };
  // Florence cameo — existing players are past the tutorial, so backfill as seen.
  if (out.seen_florence_cameo == null) out = { ...out, seen_florence_cameo: true };
  // Boss narrator — existing players already past the prologue boss, backfill as seen.
  if (out.seen_boss_narrator == null) out = { ...out, seen_boss_narrator: true };
  // Push 1 v2 — new cinematic prologue framework. Existing players never saw
  // it, so backfill as complete so they are never routed into it.
  // Brand-new players get opening_prologue_complete:false in defaultPlayer.
  if (out.opening_prologue_complete === undefined) out = { ...out, opening_prologue_complete: true };
  if (out.opening_prologue_phase === undefined)    out = { ...out, opening_prologue_phase: null };
  if (out.prologue_rewards_claimed === undefined)  out = { ...out, prologue_rewards_claimed: out.opening_prologue_complete ?? true };
  // P6 — Normalize chapter_progress based on actual journey node completion.
  // Only ever advances forward; never resets down. Corrects saves where
  // chapter_progress was set to 2 via run count before this push without the
  // player having actually cleared the Chapter 1 Trial (c1n6).
  {
    const claimed: string[] = (out.claimed_journey_nodes as string[]) ?? [];
    if (claimed.includes('c1n6') && (out.chapter_progress ?? 1) < 2) {
      out = { ...out, chapter_progress: 2 };
    }
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
  // P8 — Battle card deck (mission loadout). Empty list for all existing players
  // so no cards are pre-loaded (legacy random-draw mode stays active until the
  // player explicitly sets a loadout). New players also start with [].
  if (!Array.isArray(out.equipped_cards)) {
    out = { ...out, equipped_cards: [] };
  }
  // P8 — Card tutorial: all players (new and returning) should see the one-time
  // "what are cards?" modal the first time they open the Cards tab.
  if (out.seen_card_tutorial == null) {
    out = { ...out, seen_card_tutorial: false };
  }
  // P9 — Call tutorial: all players should see the one-time "how does Call
  // for Help work?" modal the first time they open the Call tab in battle.
  if (out.seen_call_tutorial == null) {
    out = { ...out, seen_call_tutorial: false };
  }
  // Push 3 — Elemental Counter tutorial (Fluid Phantom) and Clinical Expertise
  // tutorial (Lord Imbalance). Both default false so every player sees the
  // one-time overlay the next time they enter that encounter.
  if (out.seen_fluid_phantom_counter_tutorial == null) {
    out = { ...out, seen_fluid_phantom_counter_tutorial: false };
  }
  if (out.seen_lord_imbalance_expertise_tutorial == null) {
    out = { ...out, seen_lord_imbalance_expertise_tutorial: false };
  }
  // Guard: codex_shards must always be a finite non-negative integer.
  // Old saves may have undefined or NaN here, which would silently corrupt
  // wallet arithmetic (e.g. recruitOnce/recruitTen shard refund additions).
  if (!Number.isFinite(out.codex_shards) || out.codex_shards == null) {
    out = { ...out, codex_shards: 0 };
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
  // Push 1 v2 — new cinematic prologue. Callers that explicitly pass
  // opening_prologue_complete: true skip the new prologue (used by the
  // dev tester to create an already-through player).
  opening_prologue_complete?: boolean;
  opening_prologue_phase?: string;
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
    /** Repeatable power rewards spend the hidden Age 1 daily value budget. */
    repeatable?: boolean;
    progressionValue?: number;
    /** Journey paid its encounter stamina before entering battle. */
    prepaidStamina?: boolean;
    /** Server reward endpoint selected by a trusted gameplay flow. */
    rewardActivity?: 'clinical_battle' | 'journey_treasure' | 'auto_sweep' | 'ward_defense' | 'university_practice' | 'world_event';
    contentKey?: string;
  }) => Promise<{
    playerLevelUp: { fromLevel: number; toLevel: number } | null;
    heroLevelUps: { heroId: string; fromLevel: number; toLevel: number }[];
  }>;
  claimJourneyChapterBoss: (runId: string, tileId: string) => Promise<{
    already_completed: boolean;
    granted: Record<string, number>;
    playerLevelUp: null;
    heroLevelUps: { heroId: string; fromLevel: number; toLevel: number }[];
  }>;
  claimJourneyAreaBoss: (runId: string, chapterId: number, tileId: string) => Promise<{
    keys_collected?: number;
    claimed_tile_ids?: string[];
    playerLevelUp: null;
    heroLevelUps: { heroId: string; fromLevel: number; toLevel: number }[];
  }>;
  completeVerdantha: () => Promise<{
    already_completed: boolean;
    granted: Record<string, number>;
    playerLevelUp: null;
    heroLevelUps: { heroId: string; fromLevel: number; toLevel: number }[];
  }>;
  // Ward Defense: persist that `count` Bloom waves were cleared/survived this run.
  // Increments the account-wide ward_defense_waves counter (drives ms_3).
  recordWardWaves: (count: number) => Promise<void>;
  completeWardDefense: (result: {
    runId: string; scenarioId: string; cleared: boolean; stability: number; score: number;
    clinicalCorrect: number; clinicalTotal: number; overtimeWave: number;
    questionFamilyIds: string[]; missedFamilyIds: string[]; dailyBonus?: boolean; rotationBonus?: boolean;
  }) => Promise<{ alreadyClaimed: boolean; granted: Record<string, number>; stars: number; aegisFragment: boolean }>;
  purchaseWardExchange: (itemId: string) => Promise<{ ok: boolean; message: string }>;
  assembleWardAegis: () => Promise<{ ok: boolean; message: string }>;
  purchaseItem: (itemName: string, price: number, qty?: number) => Promise<{ ok: boolean; message: string }>;
  purchaseJourneyMerchant: (runId: string, tileId: string, stockId: string) => Promise<{ ok: boolean; message: string }>;
  assembleCovenantScroll: () => Promise<{ ok: boolean; message: string }>;
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
  setEquippedCards: (cardIds: string[]) => Promise<{ ok: boolean; message: string }>;
  markCardTutorialSeen: () => Promise<void>;
  markCallTutorialSeen: () => Promise<void>;
  setRealmLayout: (layoutPatch: Record<string, string | null>, decorPatch?: Record<string, string | null>) => Promise<{ ok: boolean; message: string }>;
  setRealmAssignment: (buildingId: string, heroIds: string[]) => Promise<{ ok: boolean; message: string }>;
  collectRealmProduction: (buildingId: string) => Promise<{ ok: boolean; message: string; amount?: number }>;
  recordFailure: (enemyId: string) => Promise<void>;
  syncInventory: (newInventory: Record<string, number>) => Promise<void>;
  saveActiveTeam: (teamIds: string[]) => Promise<void>;
  summonOnce: () => Promise<{ entry: any; duplicate: boolean; message: string } | null>;
  evolveHero: (heroId: string) => Promise<{ ok: boolean; message: string; star?: number }>;
  recruitOnce: () => Promise<{ ok: boolean; message: string; result?: import('./university').RecruitResult }>;
  freeRecruitOnce: () => Promise<{ ok: boolean; message: string; result?: import('./university').RecruitResult }>;
  tutorialRecruitOnce: (summonIndex: 1 | 2) => Promise<{ ok: boolean; message: string; result?: import('./university').RecruitResult }>;
  recruitTen: () => Promise<{ ok: boolean; message: string; results?: import('./university').RecruitResult[] }>;
  promoteHeroCert: (heroId: string) => Promise<{ ok: boolean; message: string }>;
  /** Use `scrollKey` to specify which scroll tier to consume (e.g. 'exp_scroll_xs'). Defaults to the highest tier available. */
  trainHero: (heroId: string, scrollKey?: string) => Promise<{ ok: boolean; message: string }>;
  toggleHeroLock: (heroId: string) => Promise<void>;
  toggleHeroFavorite: (heroId: string) => Promise<void>;
  completeLesson: (lessonId: string) => Promise<{ ok: boolean; message: string; result?: import('./lessons').CompletionResult }>;
  completeSimulation: (simId: string, wasCorrect: boolean) => Promise<{ ok: boolean; message: string; result?: import('./lessons').CompletionResult }>;
  startClinicalSimulation: (
    simulationId: string,
    config: import('./clinicalSimulation').SimulationConfig,
    retryMode?: import('./clinicalSimulation').SimulationRetryMode,
    priorAttemptId?: string,
  ) => Promise<import('./clinicalSimulation').SimulationAttemptState>;
  resumeClinicalSimulation: (attemptId: string) => Promise<import('./clinicalSimulation').SimulationAttemptState>;
  submitClinicalSimulationAction: (attemptId: string, actionId: string) => Promise<import('./clinicalSimulation').SimulationAttemptState>;
  completeClinicalSimulation: (attemptId: string) => Promise<{
    debrief: import('./clinicalSimulation').SimulationDebrief;
    alreadyCompleted: boolean;
  }>;
  startGrandRounds: (
    caseId: string, caseVersion: number,
    retryMode?: 'same_case' | 'fresh_case' | 'guided', priorAttemptId?: string,
  ) => Promise<import('./grandRounds').GrandRoundsAttempt>;
  resumeGrandRounds: (attemptId: string) => Promise<import('./grandRounds').GrandRoundsAttempt>;
  submitGrandRoundsResponse: (attemptId: string, responseId: string) => Promise<import('./grandRounds').GrandRoundsAttempt>;
  pauseGrandRounds: (attemptId: string) => Promise<import('./grandRounds').GrandRoundsAttempt>;
  abandonGrandRounds: (attemptId: string) => Promise<void>;
  saveGrandRoundsNotes: (attemptId: string, notes: string) => Promise<import('./grandRounds').GrandRoundsAttempt>;
  completeGrandRounds: (attemptId: string) => Promise<{
    debrief: import('./grandRounds').GrandRoundsDebrief; alreadyCompleted: boolean;
  }>;
  // Crisis Drill — server-authoritative emergency simulation lifecycle.
  startCrisisDrill: (
    caseId: string, caseVersion: number,
    mode?: import('./crisisDrill').CrisisDrillDifficulty,
    retryMode?: 'fresh_case' | 'same_case' | 'guided',
    priorAttemptId?: string,
  ) => Promise<import('./crisisDrill').CrisisDrillAttempt>;
  resumeCrisisDrill: (attemptId: string) => Promise<import('./crisisDrill').CrisisDrillAttempt>;
  submitCrisisDrillResponse: (attemptId: string, responseId: string) => Promise<import('./crisisDrill').CrisisDrillAttempt>;
  pauseCrisisDrill: (attemptId: string) => Promise<import('./crisisDrill').CrisisDrillAttempt>;
  abandonCrisisDrill: (attemptId: string) => Promise<void>;
  completeCrisisDrill: (attemptId: string) => Promise<{
    debrief: import('./crisisDrill').CrisisDrillDebrief; alreadyCompleted: boolean;
  }>;
  // J3 — University practice activity completion (Clinical Cue Lab, Rapid Triage, Stabilize Stack).
  // Increments the counter, grants XP/UC/scrolls/heroXP, auto-claims newly earned practice milestones,
  // emits a university_lesson daily event. Milestone rewards are granted exactly once per milestone.
  completeUniPractice: (
    activityType: 'cue_lab' | 'triage' | 'stack',
    difficulty: import('./uniPractice').PracticeDifficulty,
    challenge: ClinicalChallenge,
    evaluation: ClinicalEvaluation,
  ) => Promise<{
    ok: boolean;
    reward: import('./uniPractice').GrantedPracticeReward;
    newMilestones: import('./uniPractice').UniPracticeMilestone[];
  }>;
  /** Economy-aware completion for the legacy Fading Apprentice practice routes. */
  grantLegacyUniPracticeReward: (
    activityType: 'cue_lab' | 'triage' | 'stack',
    universityCredits: number,
    objectiveXp: number,
    isFirstStoryClear: boolean,
    firstPerfectBonus?: number,
  ) => Promise<{ universityCredits: number; staminaBonus: number }>;
  spendStamina: (cost?: number) => Promise<boolean>;
  logWellnessActivity: (input: WellnessLogInput) => Promise<WellnessResult | null>;
  // Daily Ward Rounds — free-to-earn daily engagement loop.
  checkInDailyRounds: () => Promise<CheckInResult | null>;
  claimDailyObjective: (objectiveId: string) => Promise<{ ok: boolean; message: string; reward?: DailyReward }>;
  claimDailyAllComplete: () => Promise<{ ok: boolean; message: string; reward?: DailyReward }>;
  claimWeeklyGoal: () => Promise<{ ok: boolean; message: string; reward?: DailyReward }>;
  claimWeeklyTask: (taskId: string) => Promise<{ ok: boolean; message: string; reward?: DailyReward }>;
  claimWeeklyAllComplete: () => Promise<{ ok: boolean; message: string; reward?: DailyReward }>;
  claimQuestMilestone: (milestoneId: string) => Promise<{ ok: boolean; message: string; reward?: DailyReward }>;
  claimPracticeModule: (moduleId: string) => Promise<{ ok: boolean; message: string }>;
  markPracticeCurriculumSeen: () => Promise<void>;
  exchangeInsightCrystals: (insightCrystalsCost: number) => Promise<{ ok: boolean; message: string }>;
  recordCueTopics: (topics: string[]) => Promise<void>;
  resetPlayer: () => Promise<void>;
  refresh: () => Promise<void>;
  setPlayerClass: (classId: ClassId) => Promise<{ ok: boolean; message: string }>;
  claimClassTier: (classId: ClassId, level: 1 | 10 | 20 | 30) => Promise<{ ok: boolean; message: string }>;
  completePrologue: () => Promise<void>;
  // Push 1 v2 — new cinematic prologue state machine.
  advanceProloguePhase: (phase: import('./prologueTypes').ProloguePhase) => Promise<void>;
  completePrologueCinematic: () => Promise<void>;
  claimPrologueRewards: () => Promise<{ ok: boolean }>;
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
  // Fog-map chapter boss: atomically apply completion XP + mark requiredCompletionNodes in one
  // store write.  Reads playerRef (fresh) so it is safe to call from fire-and-forget effects
  // where the React closure's `player` snapshot may be stale.
  applyFogMapChapterBossRewards: (requiredNodes: readonly string[], completionXp: number) => Promise<void>;
  // Task 576 — reconcile chapter-level Area Boss key state against the
  // server-confirmed values returned by claimChapterBossKeyOnServer.  Reads
  // playerRef.current (always fresh) to avoid a stale-closure race with the
  // optimistic write that fires immediately before the server call.
  reconcileChapterBossKeys: (
    chapterId:  number,
    serverKeys: { keys_collected: number; claimed_tile_ids: string[] },
  ) => Promise<void>;
  // C5 — dismiss the Level 2 "Apprentice Path Opened" celebration modal.
  markLv2UnlockSeen: () => Promise<void>;
  /**
   * Record the canonical shift for a choice chapter at FIRST CLEAR.
   * Idempotent: first write wins — later clears never mutate it.
   */
  setCanonicalShift: (chapterId: number, shift: 'day' | 'evening' | 'night') => Promise<void>;
  // P5 — dismiss the University intro panel (shown once on first visit).
  markUniversityIntroSeen: () => Promise<void>;
  // Low-level full-player write — prefer applyRewards for incremental updates.
  // Exposed so mini-game completion handlers can batch credits + XP in one call.
  // J4 — Hero Skill Academy: spend learning materials + University Credits to upgrade hero skills.
  upgradeHeroSkill: (upgradeId: string) => Promise<{ ok: boolean; message: string }>;
  updateState: (next: PlayerState) => Promise<void>;
  // Push 10 — Hero Equipment: equip/unequip items by slot (one item per slot per hero).
  equipItem: (heroId: string, slot: string, itemId: string) => Promise<void>;
  unequipItem: (heroId: string, slot: string) => Promise<void>;
  // Push 8 — Save all choices from the Lotus Recall identity-reconstruction screen.
  confirmIdentityReconstruction: (data: IdentityReconstructionInput) => Promise<void>;
  // Task 513 — Permanently lock in a specialization for a class (requires Lv30 claimed).
  claimSpecialization: (classId: import('./classTree').ClassId, specializationId: string) => Promise<{ ok: boolean; message: string }>;
  getPlayerHeroEligibility: () => Promise<PlayerHeroEligibility | null>;
  createPlayerHero: (input: {
    displayName: string; pronouns: string; appearance: PlayerHeroAppearance; focus: string;
    stats: Record<string, number>; coreTraitId: string; naturalTalentId: string; creedId: string;
  }) => Promise<{ ok: boolean; message: string; hero?: PlayerHeroRecord }>;
};

// Push 8 — Full set of identity choices made during Lotus Recall character creation.
export type IdentityReconstructionInput = {
  name: string;
  pronouns: string;
  skinTone: number;
  hairStyle: number;
  aptitude: Aptitude;
  recommendedAptitude: Aptitude;
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
function dailyRoundsUnlockedModes(p: PlayerState): string[] {
  return getDailyEligibleFeatureIds(p);
}

// Credit currency reward from a claimed daily/weekly/streak/milestone reward.
// Fix 9 extends this to universityCredits, playerXp, heroXp, refinedLotusGems.
function addDailyReward(p: PlayerState, r: DailyReward): PlayerState {
  let next: PlayerState = {
    ...p,
    crowns: (p.crowns || 0) + (r.crowns || 0),
    codex_shards: (p.codex_shards || 0) + (r.codexShards || 0),
    insight_crystals: (p.insight_crystals || 0) + (r.insightCrystals || 0),
    university_credits: (p.university_credits || 0) + (r.universityCredits || 0),
    refined_lotus_gems: (p.refined_lotus_gems || 0) + (r.refinedLotusGems || 0),
  };
  // Task 270 — grant equipment items (deduped; items can only be owned once).
  if (r.equipmentItems && r.equipmentItems.length > 0) {
    const existing = Array.isArray(next.owned_equipment) ? next.owned_equipment : [];
    const added = r.equipmentItems.filter((id) => !existing.includes(id));
    if (added.length > 0) {
      next = { ...next, owned_equipment: [...existing, ...added] };
    }
  }
  if (r.playerXp) next = applyXp(next, r.playerXp);
  if (r.heroXp) {
    const teamIds = (next.active_team || []).filter(Boolean);
    const pool = teamIds.length > 0 ? teamIds : (next.heroes_owned || []).slice(0, 3);
    if (pool.length > 0) {
      const perHero = Math.max(1, Math.round(r.heroXp / pool.length));
      const prog = { ...(next.hero_progression || {}) };
      const playerLvl = playerLevelFromXp(next.xp ?? 0).level;
      for (const heroId of pool) {
        const ex = prog[heroId] ?? { star: 1, copies: 0, level: 1, xp: 0 };
        // Cap = min(star cap, player level) — prevents batch-XP rewards from
        // bypassing the same gate as the Training Hall scroll system.
        const cap = Math.min(levelCapForStar(ex.star ?? 1), playerLvl);
        const result = addHeroXp(ex.level ?? 1, ex.xp ?? 0, perHero, cap);
        prog[heroId] = { ...ex, xp: result.xp, level: result.level };
      }
      next = { ...next, hero_progression: prog };
    }
  }
  // Stamina is intentionally not a local Daily Rounds reward. The economy
  // endpoint derives its once-per-reset bonus and persists it atomically.
  return next;
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
    pronouns: null,
    char_skin_tone: null,
    char_hair_style: null,
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
    // New players go through the cinematic prologue (opening_prologue_complete
    // defaults to false).  After it ends, /post-recall must show the
    // questionnaire and class-chooser, so both flags must start false.
    // Callers that explicitly pass opening_prologue_complete:true are creating
    // legacy / admin players who have already completed onboarding, so keep
    // the old true default for those.
    identity_restored: args.identity_restored ?? (args.opening_prologue_complete === true),
    diagnostic_intro_seen: args.diagnostic_intro_seen ?? (args.opening_prologue_complete === true),
    // Push 5 — new players have not seen the memory-reminiscence scene yet;
    // it plays once, right after their class-diagnostic is confirmed.
    seen_reminiscence: false,
    story_scenes_seen: [],
    rank: 'Sprout Healer',
    rank_index: 0,
    xp: 0,
    player_level: 1,
    player_hero: null,
    player_hero_opportunities: [],
    awakening_beat_complete: false,
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
    ward_defense_records: {},
    ward_defense_rotation: { bag: [], rotationCompletedIds: [] },
    ward_defense_claimed_run_ids: [],
    ward_defense_recent_families: [],
    ward_defense_missed_families: [],
    ward_exchange_purchases: {},
    ward_aegis_pity: 0,
    ward_aegis_lifetime_fragments: 0,
    ward_aegis_week_key: '',
    ward_aegis_weekly_random_drops: 0,
    ward_aegis_milestone_granted: false,
    bosses_defeated: [],
    claimed_milestones: [],
    claimed_daily_milestones: [],
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
    codex_shards: 100,
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
    seen_university_intro: false,
    seen_florence_cameo: false,
    seen_boss_narrator: false,
    // Push 1 v2 — new cinematic prologue. New players start at phase 0;
    // opening_prologue_complete is backfilled as true for existing players
    // in normalizeProgression so they are never re-routed.
    opening_prologue_complete: args.opening_prologue_complete ?? false,
    opening_prologue_phase: args.opening_prologue_phase ?? 'opening_memory_cinematic',
    prologue_rewards_claimed: false,
    claimed_level_rewards: [],
    claimed_chapter_chests: [],
    claimed_chapter_3star: [],
    chapter_progress: 1,
    region_progress: {},
    stamina: MAX_STAMINA,
    stamina_updated_at: new Date().toISOString(),
    age1_reward_day: undefined,
    age1_reward_units: 0,
    age1_stamina_bonus_day: undefined,
    age1_stamina_bonus_sources: [],
    age1_stamina_bonus_week: undefined,
    age1_refill_day: undefined,
    age1_refill_amount: 0,
    wellness: defaultWellnessState(),
    daily_rounds: defaultDailyRoundsState(),
    realm_seed: Math.floor(Math.random() * 2_000_000_000) + 1,
    tutorial_summon_1_done: false,
    tutorial_summon_2_done: false,
    hero_equipment: {},
    owned_equipment: [],
    clinical_simulation_history: [],
    clinical_simulation_achievements: [],
    clinical_simulation_active_attempt_id: null,
    clinical_simulation_first_clear_claims: {},
    clinical_simulation_family_bests: {},
    clinical_simulation_daily_event_ids: [],
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
  // Tokenless pre-session saves are deliberately local-only. There is no
  // verifiable recovery factor with which to safely bind their old backend ID.
  if (!p.economy_token) return p;
  try {
    const updated = await api.updatePlayer(p.id, p as any, p.economy_token);
    return updated;
  } catch {
    return p;
  }
}

/** Web-only: read clinica.player.v2 from localStorage synchronously so the
 *  hub can render on frame 1 rather than waiting for the AsyncStorage round-trip.
 *  Falls back to null on native or when storage is empty/corrupt. */
function readPlayerSync(): PlayerState | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('clinica.player.v2');
    if (!raw) return null;
    return normalizeProgression(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<PlayerState | null>(readPlayerSync);
  const [loading, setLoading] = useState(() => readPlayerSync() === null);
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
    // Fix 9 — also update weekly task progress for the same event.
    const weeklyRec = recordWeeklyProgress(rec.state, event, amount);
    const finalState = weeklyRec.changed ? weeklyRec.state : rec.state;
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
        const allNow = allObjectivesComplete(finalState);
        const allBefore = allObjectivesComplete(before);
        pulseId.current += 1;
        setDailyPulse({
          id: pulseId.current,
          advanced,
          allComplete: allNow,
          allJustCompleted: allNow && !allBefore,
        });
      }
    }
    return { ...p, daily_rounds: finalState };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const local = await loadLocal();
      if (!local) { setPlayer(null); setLoading(false); return; }
      const normalized = normalizeProgression(local);
      setPlayer(normalized);

      // Reconcile early objectives (steps 1-6) against PlayerState flags so the
      // hub never shows a regressed step for players whose objective storage is
      // behind their actual progress (crash, existing account backfill, etc.).
      // Store the promise so the hub can await it before reading objectives
      // (avoids a focus-read race where the hub picks up stale data).
      setPendingReconcile(reconcileEarlyObjectives(normalized).catch(() => [] as import('./objectiveProgress').ObjectiveId[]));

      try {
        let sessionToken = local.economy_token;
        // Saves created before guest sessions retain their old local credential.
        // Exchange it exactly once; ordinary session reads never issue tokens.
        if (sessionToken) {
          try {
            const migrated = await api.migrateGuestSession(local.id, sessionToken);
            sessionToken = migrated.session_token;
          } catch { /* already a signed session, offline, or local-only save */ }
        }
        // Policy for accounts created before signed sessions: preserve their
        // local save, but do not send an unauthenticated ID-only read/mutation
        // that could either 401 or bind someone else's account.
        if (!sessionToken) {
          await saveLocal(normalized);
          return;
        }
        const remote = normalizeProgression(await api.getPlayer(local.id, sessionToken));
        // One-way completion flags: never regress a locally-advanced value
        // with a stale backend copy.  This happens when the fire-and-forget
        // trySyncToBackend call didn't finish before the previous session
        // ended (e.g. user force-closed the app mid-diagnostic).  Taking the
        // logical OR is safe because these flags only ever move false → true,
        // never the other way around.
        const merged: PlayerState = {
          ...remote,
          economy_token: sessionToken ?? normalized.economy_token,
          identity_restored:     (normalized.identity_restored     || remote.identity_restored)     ?? remote.identity_restored,
          diagnostic_intro_seen: (normalized.diagnostic_intro_seen || remote.diagnostic_intro_seen) ?? remote.diagnostic_intro_seen,
          seen_reminiscence:     (normalized.seen_reminiscence     || remote.seen_reminiscence)     ?? remote.seen_reminiscence,
        };
        setPlayer(merged);
        await saveLocal(merged);
        // Also reconcile against the backend-authoritative snapshot in case
        // flags differ between local and remote (e.g. resumed on a new device).
        // Re-set the slot so the hub awaits the freshest reconcile.
        setPendingReconcile(reconcileEarlyObjectives(merged).catch(() => [] as import('./objectiveProgress').ObjectiveId[]));
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
    // Fire generic sync in background; when it resolves, merge the server's
    // authoritative class_specialization back into local state so a concurrent
    // claim (on this or another device) is never silently discarded.
    trySyncToBackend(next).then(async (fromServer) => {
      const serverSpec = fromServer.class_specialization;
      if (!serverSpec) return;
      const current = playerRef.current;
      if (!current) return;
      const localSpec = current.class_specialization || {};
      // Check if server has any keys the local copy is missing
      const hasNew = Object.keys(serverSpec).some((k) => serverSpec[k] !== localSpec[k]);
      if (!hasNew) return;
      const merged: PlayerState = { ...current, class_specialization: { ...localSpec, ...serverSpec } };
      playerRef.current = merged;
      setPlayer(merged);
      await saveLocal(merged);
    }).catch(() => { /* ignore — offline / transient failures are fine */ });
  }, []);

  // The backend owns Age 1 stamina and taper bookkeeping. Only merge those
  // fields from its mutation response, preserving the caller's unrelated
  // optimistic state update.
  const mergeEconomyState = useCallback(async (current: PlayerState, remote: PlayerState) => {
    const next: PlayerState = {
      ...current,
      crowns: remote.crowns,
      stamina: remote.stamina,
      stamina_updated_at: remote.stamina_updated_at,
      age1_reward_day: remote.age1_reward_day,
      age1_reward_units: remote.age1_reward_units,
      age1_stamina_bonus_day: remote.age1_stamina_bonus_day,
      age1_stamina_bonus_sources: remote.age1_stamina_bonus_sources,
      age1_stamina_bonus_week: remote.age1_stamina_bonus_week,
      age1_refill_day: remote.age1_refill_day,
      age1_refill_amount: remote.age1_refill_amount,
    };
    playerRef.current = next;
    setPlayer(next);
    await saveLocal(next);
    return next;
  }, []);

  const applyRewards = useCallback(async (rewards: Parameters<Ctx['applyRewards']>[0] & { regionId?: string }) => {
    const base = playerRef.current ?? player;
    if (!base) return { playerLevelUp: null, heroLevelUps: [] };
    let next = { ...base };
    // First-clear, authored, key, chapter, and boss rewards call this without
    // `repeatable`, so they always receive their complete intended value.
    if (rewards.repeatable && (rewards.progressionValue ?? 0) > 0) {
      const tier = rewards.progressionValue === 5 ? 'major_boss'
        : rewards.progressionValue === 3 ? 'area_boss'
          : rewards.progressionValue === 2 ? 'elite' : 'regular';
      const activity = rewards.rewardActivity === 'auto_sweep' ? 'auto_sweep'
        : rewards.rewardActivity === 'ward_defense' ? 'ward_defense'
          : rewards.rewardActivity === 'university_practice' ? 'university_practice'
            : rewards.rewardActivity === 'world_event' ? 'world_event'
              : 'clinical_battle';
      if (activity === 'clinical_battle' && !rewards.prepaidStamina) {
        const cost = tier === 'major_boss' ? 5 : tier === 'area_boss' ? 3 : tier === 'elite' ? 2 : 1;
        const economy = await api.mutateEconomy(next.id, { kind: 'spend_stamina', cost }, next.economy_token);
        next = await mergeEconomyState(next, economy.player);
      }
      const attempt = await api.beginActivityAttempt(next.id, activity, tier, next.economy_token);
      const server = await api.claimActivityAttempt(next.id, attempt.attempt_id, next.economy_token);
      const authoritative = normalizeProgression(server.player);
      playerRef.current = authoritative;
      setPlayer(authoritative);
      await saveLocal(authoritative);
      return { playerLevelUp: null, heroLevelUps: [] };
    }
    // One-time story and authored numeric grants use the same atomic endpoint,
    // but deliberately do not spend the repeat budget. Story-state fields such
    // as codex unlocks and boss flags continue through the ordinary snapshot.
    if (rewards.xp || rewards.crowns || rewards.codexShards || rewards.epidemicTokens
      || rewards.inventoryDelta || rewards.heroXp || rewards.mastery) {
      const activity = rewards.rewardActivity ?? (rewards.enemyId === 'journey_treasure' ? 'journey_treasure' : 'clinical_battle');
      const hasAuthoritativeActivity = !!rewards.rewardActivity || !!rewards.enemyId;
      if (!rewards.repeatable && hasAuthoritativeActivity
        && (activity === 'clinical_battle' || activity === 'auto_sweep' || activity === 'journey_treasure' || activity === 'university_practice' || activity === 'ward_defense')) {
        const tier = rewards.progressionValue === 5 ? 'major_boss'
          : rewards.progressionValue === 3 ? 'area_boss'
            : rewards.progressionValue === 2 ? 'elite' : 'regular';
        const firstClearAttempt = activity === 'clinical_battle'
          ? await (async () => {
            if (rewards.prepaidStamina) return api.beginActivityAttempt(next.id, activity, tier, next.economy_token);
            const cost = tier === 'major_boss' ? 5 : tier === 'area_boss' ? 3 : tier === 'elite' ? 2 : 1;
            const economy = await api.mutateEconomy(next.id, { kind: 'spend_stamina', cost }, next.economy_token);
            next = await mergeEconomyState(next, economy.player);
            return api.beginActivityAttempt(next.id, activity, tier, next.economy_token);
          })()
          : null;
        const server = await api.grantActivityReward(next.id, activity, {
          repeatable: false,
          claim_key: rewards.contentKey ?? rewards.enemyId ?? rewards.enemyName ?? activity,
          attempt_id: firstClearAttempt?.attempt_id,
        }, next.economy_token);
        const authoritative = normalizeProgression(server.player);
        // The server owns numeric reward fields. Preserve local story and
        // encounter markers so a first-clear battle still records its codex,
        // boss, hero, and chapter bookkeeping without trusting client amounts.
        next = {
          ...authoritative,
          codex_unlocked: Array.from(new Set([...(authoritative.codex_unlocked || []), ...(next.codex_unlocked || [])])),
          bosses_defeated: Array.from(new Set([...(authoritative.bosses_defeated || []), ...(next.bosses_defeated || [])])),
          failure_counts: next.failure_counts,
          enemy_mastery: next.enemy_mastery,
          region_progress: next.region_progress,
          runs_completed: next.runs_completed,
        };
        if (rewards.codex?.length) {
          next.codex_unlocked = Array.from(new Set([...(next.codex_unlocked || []), ...rewards.codex]));
        }
        if (rewards.bossId && !next.bosses_defeated.includes(rewards.bossId)) {
          next.bosses_defeated = [...next.bosses_defeated, rewards.bossId];
        }
        if (rewards.enemyId) {
          next.failure_counts = { ...(next.failure_counts || {}), [rewards.enemyId]: 0 };
        }
        if (rewards.enemyName) {
          next.enemy_mastery = {
            ...(next.enemy_mastery || {}),
            [rewards.enemyName]: (next.enemy_mastery?.[rewards.enemyName] || 0) + 1,
          };
        }
        if (rewards.regionId) {
          next.region_progress = {
            ...(next.region_progress || {}),
            [rewards.regionId]: (next.region_progress?.[rewards.regionId] || 0) + 1,
          };
        }
        next.runs_completed = (next.runs_completed || 0) + 1;
        playerRef.current = next;
        setPlayer(next);
        await saveLocal(next);
        // Persist non-numeric completion markers (codex, mastery, boss and
        // regional state) alongside the server-issued numeric reward snapshot.
        // This writes the exact authoritative totals back, not client-computed
        // reward amounts, so it cannot double the first-clear grant.
        await updateState(next);
        return { playerLevelUp: null, heroLevelUps: [] };
      }
      throw new Error(`No server-owned reward route for ${activity}`);
    }
    let playerLevelUp: { fromLevel: number; toLevel: number } | null = null;
    if (rewards.xp) {
      const applied = applyXpDetailed(next, rewards.xp);
      next = applied.player;
      if (applied.leveledUp) playerLevelUp = { fromLevel: applied.fromLevel, toLevel: applied.toLevel };
    }
    const heroLevelUps: { heroId: string; fromLevel: number; toLevel: number }[] = [];
    if (rewards.heroXp) {
      const prog = { ...(next.hero_progression || {}) };
      // Use post-reward player level so a level-up this battle immediately
      // raises the hero cap — XP earned while at cap is banked, not lost.
      const battlePlayerLvl = playerLevelFromXp(next.xp ?? 0).level;
      for (const [heroId, xpAmount] of Object.entries(rewards.heroXp)) {
        if (!xpAmount) continue;
        const existing = prog[heroId] ? { ...prog[heroId] } : (defaultProgress() as any);
        const fromLevel = existing.level ?? 1;
        // Same player-level gate as the Training Hall scroll system.
        const cap = Math.min(levelCapForStar(existing.star ?? 1), battlePlayerLvl);
        const result = addHeroXp(fromLevel, existing.xp ?? 0, xpAmount as number, cap);
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
        next.inventory[k] = (next.inventory[k] || 0) + (v as number);
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
    // P6 — chapter_progress now advances only via journey node claims (claimJourneyNode),
    // NOT from run count. Run count alone never equals chapter completion.
    next = foldDaily(next, 'ward_shift_win');
    await updateState(next);
    return { playerLevelUp, heroLevelUps };
  }, [player, updateState, mergeEconomyState]);

  const claimJourneyChapterBoss = useCallback(async (runId: string, tileId: string) => {
    const base = playerRef.current ?? player;
    if (!base) throw new Error('No player loaded');
    const result = await api.completeJourneyChapterBoss(base.id, runId, tileId, base.economy_token);
    if (!result.player) return { ...result, playerLevelUp: null, heroLevelUps: [] };
    const authoritative = normalizeProgression(result.player);
    playerRef.current = authoritative;
    setPlayer(authoritative);
    await saveLocal(authoritative);
    return { ...result, playerLevelUp: null, heroLevelUps: [] };
  }, [player]);

  const claimJourneyAreaBoss = useCallback(async (runId: string, chapterId: number, tileId: string) => {
    const base = playerRef.current ?? player;
    if (!base) throw new Error('No player loaded');
    const result = await api.completeJourneyAreaBoss(base.id, runId, chapterId, tileId, base.economy_token);
    const current = playerRef.current ?? base;
    const keyState = result.chapter_key_state;
    const next = {
      ...current,
      chapter_boss_keys: {
        ...(current.chapter_boss_keys ?? {}),
        [String(chapterId)]: {
          keys_collected: keyState.keys_collected ?? 0,
          claimed_tile_ids: keyState.claimed_tile_ids ?? [],
        },
      },
    };
    playerRef.current = next;
    setPlayer(next);
    await saveLocal(next);
    return { ...keyState, playerLevelUp: null, heroLevelUps: [] };
  }, [player]);

  const completeVerdantha = useCallback(async () => {
    const base = playerRef.current ?? player;
    if (!base) throw new Error('No player loaded');
    const result = await api.completeVerdantha(base.id, base.economy_token);
    const authoritative = normalizeProgression(result.player);
    playerRef.current = authoritative;
    setPlayer(authoritative);
    await saveLocal(authoritative);
    return { ...result, playerLevelUp: null, heroLevelUps: [] };
  }, [player]);

  const recordWardWaves = useCallback(async (count: number) => {
    if (!player || !count || count <= 0) return;
    let next = { ...player, ward_defense_waves: (player.ward_defense_waves || 0) + count };
    next = foldDaily(next, 'ward_defense_wave', count);
    await updateState(next);
  }, [player, updateState]);

  const completeWardDefense = useCallback(async (result: {
    runId: string; scenarioId: string; cleared: boolean; stability: number; score: number;
    clinicalCorrect: number; clinicalTotal: number; overtimeWave: number;
    questionFamilyIds: string[]; missedFamilyIds: string[]; dailyBonus?: boolean; rotationBonus?: boolean;
  }) => {
    const base = playerRef.current ?? player;
    if (!base) throw new Error('No player loaded');
    const response = await api.completeWardDefense(base.id, {
      run_id: result.runId, cleared: result.cleared,
      stability: result.stability, score: result.score, clinical_correct: result.clinicalCorrect,
      clinical_total: result.clinicalTotal, overtime_wave: result.overtimeWave,
      question_family_ids: result.questionFamilyIds, missed_family_ids: result.missedFamilyIds,
    }, base.economy_token);
    const authoritative = normalizeProgression(response.player);
    playerRef.current = authoritative;
    setPlayer(authoritative);
    await saveLocal(authoritative);
    return { alreadyClaimed: response.already_claimed, granted: response.granted, stars: response.stars, aegisFragment: response.aegis_fragment };
  }, [player]);

  const purchaseWardExchange = useCallback(async (itemId: string) => {
    const base = playerRef.current ?? player;
    if (!base) return { ok: false, message: 'No player loaded.' };
    try {
      const response = await api.purchaseWardExchange(base.id, itemId, base.economy_token);
      const authoritative = normalizeProgression(response.player);
      playerRef.current = authoritative;
      setPlayer(authoritative);
      await saveLocal(authoritative);
      return { ok: true, message: 'Ward Supply Exchange purchase complete.' };
    } catch (error: any) {
      return { ok: false, message: error?.message || 'This Ward Supply Exchange purchase could not be completed.' };
    }
  }, [player]);

  const assembleWardAegis = useCallback(async () => {
    const base = playerRef.current ?? player;
    if (!base) return { ok: false, message: 'No player loaded.' };
    try {
      const response = await api.assembleWardAegis(base.id, base.economy_token);
      const authoritative = normalizeProgression(response.player);
      playerRef.current = authoritative;
      setPlayer(authoritative);
      await saveLocal(authoritative);
      return { ok: true, message: response.assembled ? 'Aegis Imprint assembled.' : 'Assembly unavailable.' };
    } catch (error: any) {
      return { ok: false, message: error?.message || 'Five Ward Aegis Fragments are required.' };
    }
  }, [player]);

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
    // Deduct summon cost; refund DUPLICATE_REFUND codex shards when a duplicate hero is pulled.
    let nextShards = Math.max(0, Math.round((player.codex_shards || 0) - SUMMON_COST + (result.kind === 'shards' ? (result.codexShardRefund || 0) : 0)));
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

  const freeRecruitOnce = useCallback(async () => {
    if (!player) return { ok: false, message: 'No player loaded.' };
    const last = player.last_free_summon_at;
    if (last) {
      const msAgo = Date.now() - new Date(last).getTime();
      if (msAgo < 24 * 60 * 60 * 1000) {
        const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - msAgo) / (60 * 60 * 1000));
        return { ok: false, message: `Free summon resets in ${hoursLeft}h — come back tomorrow!` };
      }
    }
    const { recruitOnce: roll, applyRecruitResultToProgression } = await import('./university');
    const result = roll(new Set(player.heroes_owned));
    const { heroesOwned, progression } = applyRecruitResultToProgression(player.hero_progression, player.heroes_owned, result);
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
    // The free daily draw has no cost, so no Codex Shard refund is given even on
    // duplicates — there is nothing to refund. The UI explicitly communicates this.
    await updateState(foldDaily({
      ...player,
      last_free_summon_at: new Date().toISOString(),
      heroes_owned: heroesOwned,
      hero_progression: progression,
      class_trainees: nextTrainees,
      university_credits: nextCredits,
      summon_history: nextHistory,
    }, 'hero_action'));
    return { ok: true, message: result.message, result };
  }, [player, updateState]);

  // Push 5 — Tutorial Recruitment Ceremony. Guaranteed-hero pull (summon 1 & 2).
  // Idempotent: re-calling after the flag is set returns an error, not a free hero.
  // Summon 2 tries to pick a different role from the first enrolled hero.
  const tutorialRecruitOnce = useCallback(async (summonIndex: 1 | 2) => {
    if (!player) return { ok: false, message: 'No player loaded.' };
    if (summonIndex === 1 && player.tutorial_summon_1_done) {
      return { ok: false, message: 'First ceremony summon already claimed.' };
    }
    if (summonIndex === 2 && player.tutorial_summon_2_done) {
      return { ok: false, message: 'Second ceremony summon already claimed.' };
    }
    const { tutorialRecruitOnce: pull, applyRecruitResultToProgression } = await import('./university');
    const { FOUNDATION_BANNER } = await import('./gacha');
    const ownedSet = new Set(player.heroes_owned);
    let preferDifferentRole: string | undefined;
    if (summonIndex === 2 && player.heroes_owned.length > 0) {
      const firstHeroId = player.heroes_owned[0];
      const firstEntry = FOUNDATION_BANNER.find(e => e.heroId === firstHeroId);
      preferDifferentRole = firstEntry?.role;
    }
    const result = pull(ownedSet, preferDifferentRole);
    const { heroesOwned, progression } = applyRecruitResultToProgression(player.hero_progression, player.heroes_owned, result);
    const nextHistory = [...(player.summon_history || [])];
    if (result.entry) {
      nextHistory.push({ hero: result.entry.name, rarity: result.entry.rarity, duplicate: result.kind === 'shards', date: new Date().toISOString() });
    }
    // Apply codex shard refund if the fallback path returned a duplicate result.
    const tutorialRefund = result.kind === 'shards' ? (result.codexShardRefund || 0) : 0;
    await updateState(foldDaily({
      ...player,
      codex_shards: Math.max(0, Math.round((player.codex_shards || 0) + tutorialRefund)),
      heroes_owned: heroesOwned,
      hero_progression: progression,
      summon_history: nextHistory,
      tutorial_summon_1_done: summonIndex === 1 ? true : (player.tutorial_summon_1_done ?? false),
      tutorial_summon_2_done: summonIndex === 2 ? true : (player.tutorial_summon_2_done ?? false),
      // Each ceremony pull consumes the daily free slot so the player cannot
      // claim an additional free recruitment on the same day.
      last_free_summon_at: new Date().toISOString(),
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
    let codexRefund = 0;
    for (const result of results) {
      const applied = applyRecruitResultToProgression(progression, heroesOwned, result);
      heroesOwned = applied.heroesOwned;
      progression = applied.progression;
      if (result.kind === 'shards') {
        // Accumulate codex shard refund for each duplicate pull in the batch.
        codexRefund += result.codexShardRefund || 0;
      }
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
      codex_shards: Math.max(0, Math.round((player.codex_shards || 0) - cost + codexRefund)),
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

  const trainHero = useCallback(async (heroId: string, scrollKey?: string) => {
    if (!player) return { ok: false, message: 'No player loaded.' };
    if (!player.heroes_owned.includes(heroId)) return { ok: false, message: 'Hero not owned.' };

    // Synchronous read to prevent double-spend.
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };

    const { heroEffectiveLevelCap, levelCapForStar, SCROLL_TIERS, findScrollTier } = await import('./university');
    const { heroXpCostForLevel } = await import('./progression');

    // Resolve which scroll tier to use: caller-specified key, or best available.
    const inv = base.inventory ?? {};
    let tier = scrollKey ? findScrollTier(scrollKey) : undefined;
    if (!tier) {
      // Auto-pick: highest tier the player actually has
      for (let i = SCROLL_TIERS.length - 1; i >= 0; i--) {
        if ((inv[SCROLL_TIERS[i].key] ?? 0) >= 1) { tier = SCROLL_TIERS[i]; break; }
      }
    }
    if (!tier) {
      return { ok: false, message: 'No Experience Scrolls available. Earn them from 2★+ battles or buy from the Training Hall.' };
    }
    if ((inv[tier.key] ?? 0) < 1) {
      return { ok: false, message: `No ${tier.label} available.` };
    }

    const cur = getProgress(base.hero_progression, heroId);
    const playerLvl = base.player_level ?? playerLevelFromXp(base.xp ?? 0).level;
    const effectiveCap = heroEffectiveLevelCap(cur.star, playerLvl);
    const starCap = levelCapForStar(cur.star);
    const curLevel = cur.level ?? 1;

    if (curLevel >= effectiveCap) {
      if (effectiveCap < starCap) {
        return { ok: false, message: `Hero level is capped at your Player Level (${playerLvl}). Earn more account XP to raise it.` };
      }
      return { ok: false, message: `Already at Level ${starCap} cap for ${cur.star}★. Promote the Certification Star to raise the cap.` };
    }

    const result = addHeroXp(curLevel, cur.xp ?? 0, tier.xp, effectiveCap);
    const nextProg = { ...cur, level: result.level, xp: result.xp };
    const nextInv = { ...inv, [tier.key]: (inv[tier.key] ?? 0) - 1 };

    const nextState = foldDaily({
      ...base,
      inventory: nextInv,
      hero_progression: { ...(base.hero_progression || {}), [heroId]: nextProg },
    }, 'hero_action');

    playerRef.current = nextState;
    await updateState(nextState);

    const xpNeeded = heroXpCostForLevel(result.level);
    if (result.leveledUp) {
      return { ok: true, message: `Leveled up! ${result.levelsGained > 1 ? `+${result.levelsGained} levels → ` : ''}Level ${result.level} (${result.xp}/${xpNeeded} XP to next)` };
    }
    return { ok: true, message: `+${tier.xp} XP · ${result.xp}/${xpNeeded} XP to Level ${result.level + 1}` };
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
    try {
      const result = await api.mutateEconomy(base.id, { kind: 'spend_stamina', cost }, base.economy_token);
      await mergeEconomyState(base, result.player);
      return true;
    } catch {
      return false;
    }
  }, [mergeEconomyState]);

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
    let next = addDailyReward({ ...base, daily_rounds: res.state }, res.reward);
    let staminaBonus = 0;
    try {
      const economy = await api.mutateEconomy(base.id, {
        kind: 'grant_stamina_bonus', source: 'daily_rounds_complete', amount: 2,
      }, base.economy_token);
      staminaBonus = economy.stamina_bonus ?? 0;
      next = await mergeEconomyState(next, economy.player);
    } catch { /* already claimed or offline: the visible round reward remains */ }
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: res.message, reward: { ...res.reward, stamina: staminaBonus } };
  }, [updateState, mergeEconomyState]);

  const claimWeeklyGoal = useCallback(async () => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const modes = dailyRoundsUnlockedModes(base);
    const fresh = ensureFreshDailyRounds(base.daily_rounds, modes, base.id).state;
    const res = claimWeeklyReward(fresh);
    if (!res.reward) return { ok: false, message: res.message };
    let next = addDailyReward({ ...base, daily_rounds: res.state }, res.reward);
    let staminaBonus = 0;
    try {
      const economy = await api.mutateEconomy(base.id, {
        kind: 'grant_stamina_bonus', source: 'weekly_rounds_complete', period: 'week',
      }, base.economy_token);
      staminaBonus = economy.stamina_bonus ?? 0;
      next = await mergeEconomyState(next, economy.player);
    } catch { /* already claimed or offline: preserve the non-stamina claim */ }
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: res.message, reward: { ...res.reward, stamina: staminaBonus } };
  }, [updateState, mergeEconomyState]);

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
      night_market_unlocked: base.night_market_unlocked || itemName === 'Night Market Ticket',
    };
    playerRef.current = next; // commit synchronously before awaiting persistence
    await updateState(next);
    return { ok: true, message: `Purchased ${qty}× ${itemName} for ${cost} Crowns.` };
  }, [updateState]);

  const purchaseJourneyMerchant = useCallback(async (runId: string, tileId: string, stockId: string) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    try {
      const result = await api.purchaseJourneyMerchant(base.id, runId, tileId, stockId, base.economy_token);
      const next = normalizeProgression(result.player);
      playerRef.current = next;
      setPlayer(next);
      await saveLocal(next);
      return { ok: true, message: 'Purchase complete.' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Purchase unavailable.' };
    }
  }, []);

  const assembleCovenantScroll = useCallback(async () => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const { assembleCovenantScroll: assemble } = await import('./journeyMap/merchant');
    const result = assemble(base.inventory || {});
    if (!result.ok) return result;
    const next = { ...base, inventory: result.inventory };
    playerRef.current = next;
    await updateState(next);
    return result;
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
    if ((base.crowns || 0) < price) return { ok: false, message: 'Not enough Crowns.' };
    try {
      const result = await api.mutateEconomy(base.id, { kind: 'refill_stamina', amount }, base.economy_token);
      const restoredAmount = result.granted ?? 0;
      const cost = result.cost ?? price;
      const next = await mergeEconomyState(base, result.player);
      await updateState(next);
      return { ok: true, message: `Restored ${restoredAmount} Stamina for ${cost} Crowns.` };
    } catch {
      return { ok: false, message: 'Refill unavailable or today’s limit is reached.' };
    }
  }, [updateState, mergeEconomyState]);

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

  // Package 2 simulations use their own server-owned attempt state. The
  // client never calculates an official score/outcome/reward; it simply
  // renders the authoritative attempt returned after each ordered action.
  const startClinicalSimulation = useCallback(async (
    simulationId: string,
    config: import('./clinicalSimulation').SimulationConfig,
    retryMode: import('./clinicalSimulation').SimulationRetryMode = 'new_variation',
    priorAttemptId?: string,
  ) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    const { attempt } = await api.beginClinicalSimulation(base.id, simulationId, config, retryMode, priorAttemptId, base.economy_token);
    const next = { ...base, clinical_simulation_active_attempt_id: attempt.attemptId };
    playerRef.current = next;
    setPlayer(next);
    await saveLocal(next);
    return attempt;
  }, []);

  const resumeClinicalSimulation = useCallback(async (attemptId: string) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    const { attempt } = await api.getClinicalSimulationAttempt(base.id, attemptId, base.economy_token);
    const next = { ...base, clinical_simulation_active_attempt_id: attempt.status === 'active' ? attempt.attemptId : null };
    playerRef.current = next;
    setPlayer(next);
    await saveLocal(next);
    return attempt;
  }, []);

  const submitClinicalSimulationAction = useCallback(async (attemptId: string, actionId: string) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    const { attempt } = await api.submitClinicalSimulationAction(base.id, attemptId, actionId, base.economy_token);
    return attempt;
  }, []);

  const completeClinicalSimulation = useCallback(async (attemptId: string) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    const response = await api.completeClinicalSimulation(base.id, attemptId, base.economy_token);
    // A completion enters Daily/Weekly progress through exactly one existing
    // University Practice event. No simulation-only currency, timer, AP, or
    // energy is introduced.
    const authoritative = normalizeProgression(response.player);
    // The server advances the normalized University Practice event with the
    // completion attempt ID. This makes a response loss recoverable and
    // prevents a close/reopen from silently missing the daily objective.
    const next = authoritative;
    playerRef.current = next;
    setPlayer(next);
    await saveLocal(next);
    // This non-rewarding receipt is intentionally best-effort: the simulation
    // endpoint above remains the only source of rewards and Daily progress.
    void api.recordActivityCompletion(base.id, 'clinical-simulation', attemptId, base.economy_token).catch(() => undefined);
    return { debrief: response.debrief, alreadyCompleted: response.already_completed };
  }, []);

  // Grand Rounds is its own server-authoritative lifecycle. These wrappers
  // never calculate state, scores, or rewards locally; they only persist the
  // compact player receipt that the server returned after a mutation.
  const startGrandRounds = useCallback(async (
    caseId: string, caseVersion: number, retryMode: 'same_case' | 'fresh_case' | 'guided' = 'fresh_case', priorAttemptId?: string,
  ) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    const { attempt } = await api.beginGrandRounds(base.id, caseId, caseVersion, retryMode, priorAttemptId, base.economy_token);
    const next = { ...base, grand_rounds_active_attempt_id: attempt.attemptId };
    playerRef.current = next; setPlayer(next); await saveLocal(next);
    return attempt;
  }, []);

  const resumeGrandRounds = useCallback(async (attemptId: string) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    const { attempt } = await api.resumeGrandRounds(base.id, attemptId, base.economy_token);
    const next = { ...base, grand_rounds_active_attempt_id: ['active', 'paused'].includes(attempt.status) ? attempt.attemptId : null };
    playerRef.current = next; setPlayer(next); await saveLocal(next);
    return attempt;
  }, []);

  const submitGrandRoundsResponse = useCallback(async (attemptId: string, responseId: string) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    return (await api.submitGrandRoundsResponse(base.id, attemptId, responseId, base.economy_token)).attempt;
  }, []);

  const pauseGrandRounds = useCallback(async (attemptId: string) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    return (await api.pauseGrandRounds(base.id, attemptId, base.economy_token)).attempt;
  }, []);

  const abandonGrandRounds = useCallback(async (attemptId: string) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    const response = await api.abandonGrandRounds(base.id, attemptId, base.economy_token);
    const next = normalizeProgression(response.player);
    playerRef.current = next; setPlayer(next); await saveLocal(next);
  }, []);

  const saveGrandRoundsNotes = useCallback(async (attemptId: string, notes: string) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    return (await api.saveGrandRoundsNotes(base.id, attemptId, notes, base.economy_token)).attempt;
  }, []);

  const completeGrandRounds = useCallback(async (attemptId: string) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    const response = await api.completeGrandRounds(base.id, attemptId, base.economy_token);
    const next = normalizeProgression(response.player);
    playerRef.current = next; setPlayer(next); await saveLocal(next);
    void api.recordActivityCompletion(base.id, 'grand-rounds', attemptId, base.economy_token).catch(() => undefined);
    return { debrief: response.debrief, alreadyCompleted: response.already_completed };
  }, []);

  // Crisis Drill is server-authoritative. These wrappers never compute state,
  // scores, or rewards locally; they only persist the compact player receipt.
  const startCrisisDrill = useCallback(async (
    caseId: string, caseVersion: number,
    mode: import('./crisisDrill').CrisisDrillDifficulty = 'training',
    retryMode: 'fresh_case' | 'same_case' | 'guided' = 'fresh_case',
    priorAttemptId?: string,
  ) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    const { attempt } = await api.beginCrisisDrill(base.id, caseId, caseVersion, mode, retryMode, priorAttemptId, base.economy_token);
    const next = { ...base, crisis_drill_active_attempt_id: attempt.attemptId };
    playerRef.current = next; setPlayer(next); await saveLocal(next);
    return attempt;
  }, []);

  const resumeCrisisDrill = useCallback(async (attemptId: string) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    const { attempt } = await api.resumeCrisisDrill(base.id, attemptId, base.economy_token);
    const next = { ...base, crisis_drill_active_attempt_id: ['active', 'paused'].includes(attempt.status) ? attempt.attemptId : null };
    playerRef.current = next; setPlayer(next); await saveLocal(next);
    return attempt;
  }, []);

  const submitCrisisDrillResponse = useCallback(async (attemptId: string, responseId: string) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    return (await api.submitCrisisDrillResponse(base.id, attemptId, responseId, base.economy_token)).attempt;
  }, []);

  const pauseCrisisDrill = useCallback(async (attemptId: string) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    return (await api.pauseCrisisDrill(base.id, attemptId, base.economy_token)).attempt;
  }, []);

  const abandonCrisisDrill = useCallback(async (attemptId: string) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    const response = await api.abandonCrisisDrill(base.id, attemptId, base.economy_token);
    const next = normalizeProgression(response.player);
    playerRef.current = next; setPlayer(next); await saveLocal(next);
  }, []);

  const completeCrisisDrill = useCallback(async (attemptId: string) => {
    const base = playerRef.current;
    if (!base) throw new Error('No player loaded.');
    const response = await api.completeCrisisDrill(base.id, attemptId, base.economy_token);
    const next = normalizeProgression(response.player);
    playerRef.current = next; setPlayer(next); await saveLocal(next);
    void api.recordActivityCompletion(base.id, 'crisis-drill', attemptId, base.economy_token).catch(() => undefined);
    return { debrief: response.debrief, alreadyCompleted: response.already_completed };
  }, []);

  // Shared challenge practice completion. The backend owns attempt receipts,
  // rewards, counters, milestones, and compact mastery history.
  const completeUniPractice = useCallback(async (
    activityType: 'cue_lab' | 'triage' | 'stack',
    difficulty: import('./uniPractice').PracticeDifficulty,
    challenge: ClinicalChallenge,
    evaluation: ClinicalEvaluation,
  ) => {
    const base = playerRef.current;
    const empty = { ok: false, reward: null as any, newMilestones: [] as any[] };
    if (!base) return empty;

    const { PRACTICE_REWARDS, PRACTICE_REPEAT_REWARDS, UNI_PRACTICE_MILESTONES } = await import('./uniPractice');
    // A receipt is issued for this exact approved id/version before a rewardable
    // completion can be submitted. No client-selected reward data crosses this boundary.
    const attempt = await api.beginUniversityPracticeAttempt(base.id, {
      activity: activityType,
      difficulty,
      challenge_id: challenge.id,
      challenge_version: challenge.version,
    }, base.economy_token);
    const grant = await api.completeUniversityPractice(
      base.id,
      {
        activity: activityType,
        difficulty,
        challenge_id: challenge.id,
        challenge_version: challenge.version,
        attempt_id: attempt.attempt_id,
        score: evaluation.score,
        safety_result: evaluation.safety,
      },
      base.economy_token,
    );
    void api.recordActivityCompletion(base.id, 'university-practice', attempt.attempt_id, base.economy_token).catch(() => undefined);
    const isFirstComplete = grant.first_completion;
    const rawRewardDef = (isFirstComplete ? PRACTICE_REWARDS : PRACTICE_REPEAT_REWARDS)[activityType][difficulty];
    const rewardDef = {
      ...rawRewardDef,
      playerXp: grant.granted.xp ?? 0,
      heroXp: 0,
      universityCredits: grant.granted.university_credits ?? 0,
      scrollCount: grant.granted[`inventory.${rawRewardDef.scrollKey}`] ?? 0,
      bonusItemCount: undefined,
    };

    let next = normalizeProgression(grant.player);

    // Each meaningful lab can offer one small educational Stamina recovery per
    // calendar day. Replays still record scores, but cannot repeatedly refill.
    let bonusAmount = 0;
    try {
      const economy = await api.mutateEconomy(base.id, {
        kind: 'grant_stamina_bonus', source: `practice:${activityType}`, amount: 1,
      }, base.economy_token);
      bonusAmount = economy.stamina_bonus ?? 0;
      next = await mergeEconomyState(next, economy.player);
    } catch { /* repeated labs remain playable without an additional bonus */ }

    const newlyEarned = UNI_PRACTICE_MILESTONES.filter((milestone) => grant.milestone_ids.includes(milestone.id));

    // Daily rounds — counts as a university_lesson event + material_earned
    // (practice sessions always grant at least 1 learning material scroll).
    next = foldDaily(next, 'university_lesson');
    next = foldDaily(next, 'material_earned');

    playerRef.current = next;
    await updateState(next);

    return {
      ok: true,
      reward: { ...rewardDef, stamina: bonusAmount, activityType, difficulty, isFirstComplete },
      newMilestones: newlyEarned,
    };
  }, [updateState, mergeEconomyState]);

  // The Fading Apprentice labs predate the data-driven practice screen but
  // remain reachable from the University. Keep their story-first rewards full,
  // while sending any replayable credit grant through the same daily budget.
  const grantLegacyUniPracticeReward = useCallback(async (
    activityType: 'cue_lab' | 'triage' | 'stack',
    universityCredits: number,
    objectiveXp: number,
    isFirstStoryClear: boolean,
    firstPerfectBonus = 0,
  ) => {
    const base = playerRef.current;
    if (!base) return { universityCredits: 0, staminaBonus: 0 };

    const grant = await (async () => {
      const attempt = await api.beginActivityAttempt(base.id, 'university_practice', 'regular', base.economy_token);
      return api.claimActivityAttempt(base.id, attempt.attempt_id, base.economy_token);
    })();
    const grantedCredits = scaledAge1Reward(universityCredits, grant.multiplier);
    let next = normalizeProgression(grant.player);
    const persistedCredits = grantedCredits + (isFirstStoryClear ? firstPerfectBonus : 0);
    if (objectiveXp > 0) next = applyXp(next, objectiveXp);
    if (persistedCredits > 0) {
      next = { ...next, university_credits: (next.university_credits || 0) + persistedCredits };
    }
    let staminaBonus = 0;
    try {
      const economy = await api.mutateEconomy(base.id, {
        kind: 'grant_stamina_bonus', source: `practice:${activityType}`, amount: 1,
      }, base.economy_token);
      staminaBonus = economy.stamina_bonus ?? 0;
      next = await mergeEconomyState(next, economy.player);
    } catch { /* only one educational bonus is available per lab/day */ }
    playerRef.current = next;
    await updateState(next);
    return { universityCredits: grantedCredits, staminaBonus };
  }, [updateState, mergeEconomyState]);

  // J4 — Hero Skill Academy: spend learning materials + University Credits to
  // purchase the next rank of a skill upgrade. Uses playerRef critical section
  // to prevent double-spend on rapid taps. Grants hero XP to owned heroes when
  // the upgrade definition includes an heroXp effect.
  const upgradeHeroSkill = useCallback(async (upgradeId: string) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    if (upgradeId === 'aegis_clinical_resonance') {
      try {
        const response = await api.purchaseWardAegisSidegrade(base.id, upgradeId, base.economy_token);
        const authoritative = normalizeProgression(response.player);
        playerRef.current = authoritative;
        setPlayer(authoritative);
        await saveLocal(authoritative);
        return { ok: true, message: 'Ward Aegis sidegrade unlocked.' };
      } catch (error: any) {
        return { ok: false, message: error?.message || 'A Ward Aegis Imprint is required.' };
      }
    }

    const { SKILL_UPGRADES, maxHeroLevel } = await import('./heroSkillAcademy');
    const upg = SKILL_UPGRADES.find(u => u.id === upgradeId);
    if (!upg) return { ok: false, message: 'Unknown upgrade.' };

    const currentRank = (base.hero_skill_upgrades ?? {})[upgradeId] ?? 0;
    if (currentRank >= upg.maxRank) return { ok: false, message: 'Already at max rank.' };

    const rankDef = upg.ranks[currentRank];
    if (!rankDef) return { ok: false, message: 'No rank definition found.' };

    const heroLevel = maxHeroLevel(base);
    if (heroLevel < rankDef.requirements.hero_level) {
      return { ok: false, message: `Requires a hero at level ${rankDef.requirements.hero_level}.` };
    }

    const inv = { ...(base.inventory ?? {}) };
    const uc  = base.university_credits ?? 0;
    const req = rankDef.requirements;

    if ((inv.cue_scroll         ?? 0) < (req.cue_scroll         ?? 0)) return { ok: false, message: `Need ${req.cue_scroll} Cue Scroll(s).` };
    if ((inv.triage_scroll      ?? 0) < (req.triage_scroll      ?? 0)) return { ok: false, message: `Need ${req.triage_scroll} Triage Scroll(s).` };
    if ((inv.stab_scroll        ?? 0) < (req.stab_scroll        ?? 0)) return { ok: false, message: `Need ${req.stab_scroll} Stabilization Scroll(s).` };
    if ((inv.lesson_note        ?? 0) < (req.lesson_note        ?? 0)) return { ok: false, message: `Need ${req.lesson_note} Lesson Note(s).` };
    if ((inv.care_chain_manual  ?? 0) < (req.care_chain_manual  ?? 0)) return { ok: false, message: `Need ${req.care_chain_manual} Care Pathway Manual(s).` };
    if ((inv.hero_training_page ?? 0) < (req.hero_training_page ?? 0)) return { ok: false, message: `Need ${req.hero_training_page} Hero Training Page(s).` };
    if ((inv.ward_defense_aegis_imprint ?? 0) < (req.ward_defense_aegis_imprint ?? 0)) return { ok: false, message: `Need ${req.ward_defense_aegis_imprint} Ward Aegis Imprint(s).` };
    if (uc < req.university_credits)                                    return { ok: false, message: `Need ${req.university_credits} University Credits.` };

    // Deduct materials
    if (req.cue_scroll)         inv.cue_scroll         = (inv.cue_scroll         ?? 0) - req.cue_scroll;
    if (req.triage_scroll)      inv.triage_scroll      = (inv.triage_scroll      ?? 0) - req.triage_scroll;
    if (req.stab_scroll)        inv.stab_scroll        = (inv.stab_scroll        ?? 0) - req.stab_scroll;
    if (req.lesson_note)        inv.lesson_note        = (inv.lesson_note        ?? 0) - req.lesson_note;
    if (req.care_chain_manual)  inv.care_chain_manual  = (inv.care_chain_manual  ?? 0) - req.care_chain_manual;
    if (req.hero_training_page) inv.hero_training_page = (inv.hero_training_page ?? 0) - req.hero_training_page;
    if (req.ward_defense_aegis_imprint) inv.ward_defense_aegis_imprint = (inv.ward_defense_aegis_imprint ?? 0) - req.ward_defense_aegis_imprint;

    let next: PlayerState = {
      ...base,
      inventory: inv,
      university_credits: uc - req.university_credits,
      hero_skill_upgrades: {
        ...(base.hero_skill_upgrades ?? {}),
        [upgradeId]: currentRank + 1,
      },
    };

    // Grant hero XP to owned heroes if the rank effect includes heroXp
    if (rankDef.effect.heroXp && rankDef.effect.heroXp > 0) {
      const heroPool = (base.heroes_owned ?? []).slice(0, 8);
      if (heroPool.length > 0) {
        const prog = { ...(next.hero_progression ?? {}) };
        for (const heroId of heroPool) {
          const ex = prog[heroId] ? { ...prog[heroId] } : { star: 1, copies: 0, level: 1, xp: 0 };
          const cap = levelCapForStar(ex.star ?? 1);
          const r = addHeroXp(ex.level ?? 1, ex.xp ?? 0, rankDef.effect.heroXp, cap);
          prog[heroId] = { ...ex, xp: r.xp, level: r.level };
        }
        next = { ...next, hero_progression: prog };
      }
    }

    playerRef.current = next;
    await updateState(next);

    return { ok: true, message: `${upg.name} upgraded to Rank ${currentRank + 1}!` };
  }, [updateState]);

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
  //
  // Locked legendary heroes (e.g. Florence Nightingale) have no dedicated
  // AsyncStorage keys — their state lives exclusively inside the player record
  // (`clinica.player.v2`) and in in-memory content definitions. They are fully
  // cleared by this wipe. If any future feature adds per-hero flags (e.g. a
  // "florence_teaser_seen" one-time flag), it MUST use the `clinica.` prefix
  // or it will survive a reset and bleed into the fresh-account experience.
  //
  // Tutorial ceremony-summon flags (`tutorial_recruit_1_claimed`,
  // `tutorial_recruit_2_claimed`) are fields inside PlayerState and are wiped
  // with the player record — free draws are fully restored after reset.
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
    clearBagSeenCache();   // bag "new item" tracker caches in-module — drop it with the wiped keys
    clearHeroSeenCache();  // hero seen-set caches in-module — drop it with the wiped keys
    clearRealmSeenCache(); // realm building seen-set caches in-module — drop it with the wiped keys
    clearShopSeenCache();  // shop seen-set caches in-module — drop it with the wiped keys
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
    try {
      const response = await api.selectClass(base.id, classId, base.economy_token);
      const next = normalizeProgression({ ...response, economy_token: base.economy_token });
      playerRef.current = next;
      setPlayer(next);
      await saveLocal(next);
    } catch {
      return { ok: false, message: 'Your Root Calling could not be saved. Please try again.' };
    }
    return { ok: true, message: `Your class is now ${classId[0].toUpperCase()}${classId.slice(1)}.` };
  }, []);

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
    try {
      const response = await api.claimClassTier(base.id, level, base.economy_token);
      const next = normalizeProgression({ ...response, economy_token: base.economy_token });
      playerRef.current = next;
      setPlayer(next);
      await saveLocal(next);
    } catch {
      return { ok: false, message: 'This class tier could not be claimed. Please try again.' };
    }
    return { ok: true, message: `${card.name} unlocked.` };
  }, []);

  // Task 513 — Permanently lock in a specialization for a class.
  // Client pre-checks prevent unnecessary round-trips; the backend endpoint is
  // the authoritative guard (Lv30 ownership + valid ID + immutable-once-set).
  const claimSpecialization = useCallback(async (classId: import('./classTree').ClassId, specializationId: string) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };

    // Client-side pre-flight (fast fail before network round-trip)
    const progress = (base.class_progress || {})[classId] || [];
    if (!progress.includes(30)) return { ok: false, message: 'Claim Lv30 first to unlock your path.' };
    const existing = base.class_specialization || {};
    if (existing[classId]) return { ok: false, message: 'Specialization already chosen for this class.' };
    const { CLASS_SPECIALIZATIONS } = require('./classTree');
    const validIds: string[] = (CLASS_SPECIALIZATIONS[classId] || []).map((s: { id: string }) => s.id);
    if (!validIds.includes(specializationId)) {
      return { ok: false, message: `"${specializationId}" is not a valid specialization for the ${classId} class.` };
    }

    // Backend is authoritative — call dedicated endpoint so eligibility &
    // permanence are enforced server-side (not through the generic PUT).
    try {
      const updated = await api.claimSpecialization(base.id, specializationId, base.economy_token);
      const next = normalizeProgression(updated);
      playerRef.current = next;
      setPlayer(next);
      await saveLocal(next);
      return { ok: true, message: 'Specialization path locked in.' };
    } catch (err: any) {
      // Surface server rejection (e.g. already set on another device)
      const msg = err?.message || 'Failed to lock specialization. Try again.';
      return { ok: false, message: msg };
    }
  }, []);

  const getPlayerHeroEligibility = useCallback(async (): Promise<PlayerHeroEligibility | null> => {
    const base = playerRef.current;
    if (!base?.economy_token) return null;
    try {
      return await api.getPlayerHeroEligibility(base.id, base.economy_token);
    } catch {
      return null;
    }
  }, []);

  const createPlayerHero = useCallback(async (input: {
    displayName: string; pronouns: string; appearance: PlayerHeroAppearance; focus: string;
    stats: Record<string, number>; coreTraitId: string; naturalTalentId: string; creedId: string;
  }) => {
    const base = playerRef.current;
    if (!base?.economy_token) return { ok: false, message: 'Reconnect your session before creating a Player Hero.' };
    try {
      const result = await api.createPlayerHero(base.id, {
        display_name: input.displayName,
        pronouns: input.pronouns,
        appearance: input.appearance,
        focus: input.focus,
        stats: input.stats,
        core_trait_id: input.coreTraitId,
        natural_talent_id: input.naturalTalentId,
        creed_id: input.creedId,
      }, base.economy_token);
      const next = normalizeProgression({ ...result.player, economy_token: base.economy_token });
      playerRef.current = next;
      setPlayer(next);
      await saveLocal(next);
      return {
        ok: true,
        message: result.already_created ? 'Your Player Hero was already created.' : 'Player Hero created.',
        hero: result.player_hero,
      };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Could not create your Player Hero.' };
    }
  }, []);

  // Push 1 prologue — marks the guided tutorial + scripted boss sequence
  // finished so the player never re-enters it. Idempotent no-op if already set.
  const completePrologue = useCallback(async () => {
    const base = playerRef.current;
    if (!base || base.prologue_complete) return;
    const next = { ...base, prologue_complete: true };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // Push 1 v2 — Advance to a specific phase of the new cinematic prologue and
  // persist the checkpoint so the app can resume after a crash or close.
  // Safe to call repeatedly (idempotent to the same phase).
  const advanceProloguePhase = useCallback(async (phase: import('./prologueTypes').ProloguePhase) => {
    const base = playerRef.current;
    if (!base) return;
    const next = { ...base, opening_prologue_phase: phase };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // Push 1 v2 — Mark the entire new cinematic prologue complete and persist.
  // Also marks the old prologue_complete flag so nothing else re-routes the
  // player back into the tutorial battle path.  Idempotent.
  //
  // Crucially, we reset identity_restored and diagnostic_intro_seen to false
  // here so /post-recall always shows the questionnaire and class-chooser even
  // if the player was created before these defaults were fixed (old records
  // carried true from createPlayer defaults and would have skipped the quiz).
  const completePrologueCinematic = useCallback(async () => {
    const base = playerRef.current;
    if (!base || base.opening_prologue_complete) return;
    const next = {
      ...base,
      opening_prologue_complete: true,
      opening_prologue_phase: null,
      prologue_complete: true,
      identity_restored: false,
      diagnostic_intro_seen: false,
    };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // Push 1 v2 — Grant memory-echo award items (nightingale + fleming echoes)
  // as inventory entries.  Idempotent: does nothing if already claimed.
  const claimPrologueRewards = useCallback(async (): Promise<{ ok: boolean }> => {
    const base = playerRef.current;
    if (!base) return { ok: false };
    if (base.prologue_rewards_claimed) return { ok: true };
    const { PROLOGUE_AWARD_ITEMS } = await import('./prologueTypes');
    const newInventory = { ...(base.inventory || {}) };
    for (const itemId of PROLOGUE_AWARD_ITEMS) {
      if (!newInventory[itemId]) newInventory[itemId] = 1;
    }
    const next = { ...base, inventory: newInventory, prologue_rewards_claimed: true };
    playerRef.current = next;
    await updateState(next);
    return { ok: true };
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

  // Push 8 — Save all identity-reconstruction choices in one atomic write.
  // Called from IdentityReconstructionScreen just before onComplete() advances
  // the prologue phase. Idempotent: calling it again only overwrites fields.
  const confirmIdentityReconstruction = useCallback(async (data: IdentityReconstructionInput) => {
    const base = playerRef.current;
    if (!base) return;
    const cleanName = (data.name || '').trim().slice(0, 24) || 'Healer';
    const next: PlayerState = {
      ...base,
      name:                 cleanName,
      pronouns:             data.pronouns || null,
      char_skin_tone:       data.skinTone,
      char_hair_style:      data.hairStyle,
      aptitude:             data.aptitude,
      recommended_aptitude: data.recommendedAptitude,
      identity_restored:    true,
    };
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
    let next: PlayerState = {
      ...withXp,
      lessons_completed: [...completed, completionId],
      insight_crystals: (base.insight_crystals || 0) + node.rewards.insightCrystals,
      crowns: (base.crowns || 0) + node.rewards.crowns,
      university_credits: (base.university_credits || 0) + node.rewards.universityCredits,
    };
    // J3 — grant 1 Lesson Note per Lotus lesson completion and check Lotus milestones.
    const lotusInv = { ...(next.inventory || {}) };
    lotusInv['lesson_note'] = (lotusInv['lesson_note'] || 0) + 1;
    next = { ...next, inventory: lotusInv };

    const { getNewLotusLessonMilestones } = await import('./uniPractice');
    const newLotusCount = (next.lessons_completed ?? []).length;
    const alreadyClaimed = base.uni_practice_milestones_claimed ?? [];
    const lotusMs = getNewLotusLessonMilestones(newLotusCount, alreadyClaimed);
    for (const ms of lotusMs) {
      if (ms.rewards.playerXp) next = applyXp(next, ms.rewards.playerXp);
      if (ms.rewards.universityCredits) {
        next = { ...next, university_credits: (next.university_credits || 0) + ms.rewards.universityCredits };
      }
      if (ms.rewards.codexShards) {
        next = { ...next, codex_shards: (next.codex_shards || 0) + ms.rewards.codexShards };
      }
      if (ms.rewards.inventory) {
        const msInv = { ...(next.inventory || {}) };
        for (const [k, v] of Object.entries(ms.rewards.inventory)) {
          msInv[k] = (msInv[k] || 0) + v;
        }
        next = { ...next, inventory: msInv };
      }
    }
    if (lotusMs.length > 0) {
      next = { ...next, uni_practice_milestones_claimed: [...alreadyClaimed, ...lotusMs.map((m) => m.id)] };
    }
    playerRef.current = next;
    await updateState(next);

    // ── Single source of truth: sync hub guide objective ─────────────────
    // Always write obj_lotus_first_lesson to AsyncStorage here, regardless
    // of which screen path called completeLotusLessonNode.  This makes the
    // store the authority for BOTH player.lessons_completed (player state)
    // AND the hub guide 15-step chain (AsyncStorage).  Screen components no
    // longer need their own completeObjective calls — they are removed.
    // completeObjective is idempotent; reconcileEarlyObjectives at boot is
    // the secondary fallback for any device that loses AsyncStorage.
    if (nodeId === 'recognizing-cues-hydration') {
      try {
        const { completeObjective, isObjectiveXpGranted, markObjectiveXpGranted } =
          await import('./objectiveProgress');
        const isNewObj = await completeObjective('obj_lotus_first_lesson');
        if (isNewObj) {
          const alreadyGranted = await isObjectiveXpGranted('obj_lotus_first_lesson');
          if (!alreadyGranted) {
            // Objective step XP (10 XP) is separate from node.rewards.xp above.
            const withObjXp = applyXp(playerRef.current!, 10);
            playerRef.current = withObjXp;
            await updateState(withObjXp);
            await markObjectiveXpGranted('obj_lotus_first_lesson');
          }
        }
      } catch {
        // Fail silently — reconcileEarlyObjectives at next boot is the fallback.
      }
    }

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
    // Task 375 — normalize learning_profile so legacy aliases (nursingStudent,
    // nclexPrep, etc.) are never persisted; same guard as setLearningProfile.
    const canonicalProfile = profile.learning_profile
      ? (normalizeProfileId(profile.learning_profile) ?? profile.learning_profile)
      : profile.learning_profile;
    const next: PlayerState = {
      ...base,
      aptitude: profile.aptitude as any,
      player_class: profile.player_class,
      learning_profile: canonicalProfile,
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
    // Always persist the canonical ID so downstream systems never see a legacy alias.
    const canonical = normalizeProfileId(profileId) ?? profileId;
    const next: PlayerState = { ...base, learning_profile: canonical };
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
    await applyRewards({
      xp, codexShards: 0, crowns: sweepCrowns, codex: [],
      enemyId, enemyName: enemyId, repeatable: true, progressionValue: 1, rewardActivity: 'auto_sweep',
    });
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
    // J6: gate chest on all journey-rewarded nodes being cleared first.
    const { getChapterNodeIds } = await import('./journeyRewards');
    const nodeIds = getChapterNodeIds(chest.chapter);
    const claimedJourneyNodes = base.claimed_journey_nodes ?? [];
    if (nodeIds.length > 0 && !nodeIds.every((id) => claimedJourneyNodes.includes(id))) {
      return { ok: false, message: 'Clear all chapter nodes to unlock the chapter chest.' };
    }
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
    // Fix 9 — credit weekly w_battles task for journey node completions.
    next = foldDaily(next, 'journey_node');
    // P6 — advance chapter_progress when a chapter-final node is claimed.
    // c1n6 = Chapter 1 Trial (mini_boss) → unlocks Chapter 2 content + cutscene.
    // c2p7 = Chapter 2 Trial (boss)      → unlocks Chapter 3 content.
    // c3p9 = Chapter 3 Trial (mini_boss) → unlocks Chapter 4 content.
    // c4p9 = Chapter 4 Trial (mini_boss) → unlocks Chapter 5 content.
    // c5p8 = Chapter 5 Trial (mini_boss) → unlocks Chapter 6 content.
    // c6p7 = Chapter 6 Trial (imbalance_core)     → unlocks Chapter 7 content.
    // c7p8 = Chapter 7 Trial (contagion_wraith)    → unlocks Chapter 8 content.
    // c8p8 = Chapter 8 Trial (crisis_convergence)  → unlocks Chapter 9 content.
    if (nodeId === 'c1n6') {
      next = { ...next, chapter_progress: Math.max(next.chapter_progress || 1, 2) };
    } else if (nodeId === 'c2p7' || nodeId === 'c2p8') {
      next = { ...next, chapter_progress: Math.max(next.chapter_progress || 1, 3) };
    } else if (nodeId === 'c3p9') {
      next = { ...next, chapter_progress: Math.max(next.chapter_progress || 1, 4) };
    } else if (nodeId === 'c4p9') {
      next = { ...next, chapter_progress: Math.max(next.chapter_progress || 1, 5) };
    } else if (nodeId === 'c5p8') {
      next = { ...next, chapter_progress: Math.max(next.chapter_progress || 1, 6) };
    } else if (nodeId === 'c6p7') {
      next = { ...next, chapter_progress: Math.max(next.chapter_progress || 1, 7) };
    } else if (nodeId === 'c7p8') {
      next = { ...next, chapter_progress: Math.max(next.chapter_progress || 1, 8) };
    } else if (nodeId === 'c8p8') {
      next = { ...next, chapter_progress: Math.max(next.chapter_progress || 1, 9) };
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

  // ── Fog-map chapter boss — atomic XP + claimed-nodes update ─────────────────
  // Reads playerRef.current (always fresh) so that a single updateState covers
  // both the completion-XP grant and the required-node claims.  This avoids the
  // stale-closure race that occurs when two independent updateState calls are
  // fired from the same effect (e.g. the old pattern of applyRewards + a second
  // updateState using the same captured player snapshot).
  const applyFogMapChapterBossRewards = useCallback(async (
    requiredNodes: readonly string[],
    completionXp: number,
  ): Promise<void> => {
    const base = playerRef.current;
    if (!base) return;
    // Apply completion XP (advances rank + player_level) when a bonus is set.
    let next: PlayerState = completionXp > 0 ? applyXp(base, completionXp) : { ...base };
    // Mark required completion nodes as claimed (idempotent — skips already claimed).
    const alreadyClaimed = next.claimed_journey_nodes ?? [];
    const toAdd = requiredNodes.filter((id) => !alreadyClaimed.includes(id));
    if (toAdd.length > 0) {
      next = { ...next, claimed_journey_nodes: [...alreadyClaimed, ...toAdd] };
    }
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // ── Task 576 — reconcile chapter-level Area Boss keys with server truth ─────
  // Called after claimChapterBossKeyOnServer resolves so the authoritative
  // { keys_collected, claimed_tile_ids } from the backend overwrites the
  // optimistic snapshot.  Reads playerRef.current (fresh) to avoid the stale-
  // closure race that would occur if we used the `player` captured at the time
  // the battle-return effect ran.
  const reconcileChapterBossKeys = useCallback(async (
    chapterId:  number,
    serverKeys: { keys_collected: number; claimed_tile_ids: string[] },
  ): Promise<void> => {
    const base = playerRef.current;
    if (!base) return;
    // Read the current local state fresh from the ref (not the stale closure).
    const localEntry = base.chapter_boss_keys?.[String(chapterId)];
    const localCount = localEntry?.keys_collected ?? 0;
    // Merge: take the union of claimed IDs and the higher key count so an
    // out-of-order or stale server response never regresses local progress.
    const localIds: string[] = localEntry?.claimed_tile_ids ?? [];
    const mergedIds = Array.from(new Set([...localIds, ...serverKeys.claimed_tile_ids])).sort();
    const mergedCount = Math.max(localCount, serverKeys.keys_collected, mergedIds.length > 3 ? 3 : mergedIds.length);
    const next: PlayerState = {
      ...base,
      chapter_boss_keys: {
        ...(base.chapter_boss_keys ?? {}),
        [String(chapterId)]: {
          keys_collected:   Math.min(mergedCount, 3),
          claimed_tile_ids: mergedIds,
        },
      },
    };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // ── Canonical shift (Book I choice chapters) — first-clear, write-once ─────
  const setCanonicalShift = useCallback(async (
    chapterId: number,
    shift: 'day' | 'evening' | 'night',
  ) => {
    const base = playerRef.current;
    if (!base) return;
    const key = String(chapterId);
    if (base.canonical_shifts?.[key]) return; // first write wins
    const next: PlayerState = {
      ...base,
      canonical_shifts: { ...(base.canonical_shifts ?? {}), [key]: shift },
    };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // ── C5 — mark the Level 2 unlock celebration as seen ───────────────────────
  const markLv2UnlockSeen = useCallback(async () => {
    const base = playerRef.current;
    if (!base || base.seen_lv2_unlock) return;
    const next: PlayerState = { ...base, seen_lv2_unlock: true };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // ── P5 — mark the University intro panel as seen ────────────────────────────
  const markUniversityIntroSeen = useCallback(async () => {
    const base = playerRef.current;
    if (!base || base.seen_university_intro) return;
    const next: PlayerState = { ...base, seen_university_intro: true };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // ── Fix 9 — weekly task claims + quest milestone claims ─────────────────────
  const claimWeeklyTask = useCallback(async (taskId: string) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player.' };
    const modes = dailyRoundsUnlockedModes(base);
    const fresh = ensureFreshDailyRounds(base.daily_rounds, modes, base.id).state;
    const res = claimWeeklyTaskPure(fresh, taskId);
    if (!res.reward) return { ok: false, message: res.message };
    const next = addDailyReward({ ...base, daily_rounds: res.state }, res.reward);
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: res.message, reward: res.reward };
  }, [updateState]);

  const claimWeeklyAllComplete = useCallback(async () => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player.' };
    const modes = dailyRoundsUnlockedModes(base);
    const fresh = ensureFreshDailyRounds(base.daily_rounds, modes, base.id).state;
    const res = claimWeeklyAllCompletePure(fresh);
    if (!res.reward) return { ok: false, message: res.message };
    let next = addDailyReward({ ...base, daily_rounds: res.state }, res.reward);
    let staminaBonus = 0;
    try {
      const economy = await api.mutateEconomy(base.id, {
        kind: 'grant_stamina_bonus', source: 'weekly_rounds_complete', amount: 3, period: 'week',
      }, base.economy_token);
      staminaBonus = economy.stamina_bonus ?? 0;
      next = await mergeEconomyState(next, economy.player);
    } catch { /* only one weekly recovery bonus is available */ }
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: res.message, reward: { ...res.reward, stamina: staminaBonus } };
  }, [updateState, mergeEconomyState]);

  const claimQuestMilestone = useCallback(async (milestoneId: string) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player.' };
    const ms = QUEST_MILESTONES.find(m => m.id === milestoneId);
    if (!ms) return { ok: false, message: 'Unknown milestone.' };
    if (!ms.isDone(base)) return { ok: false, message: 'Milestone not yet complete.' };
    const claimed = base.claimed_daily_milestones ?? [];
    if (claimed.includes(milestoneId)) return { ok: false, message: 'Already claimed.' };
    let next: PlayerState = { ...base, claimed_daily_milestones: [...claimed, milestoneId] };
    next = addDailyReward(next, ms.reward);
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: 'Milestone reward claimed!', reward: ms.reward };
  }, [updateState]);

  // Push 4 — Claim a Practice Curriculum module one-time reward.
  const claimPracticeModule = useCallback(async (moduleId: string) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player.' };
    const { ALL_CURRICULUM_MODULES, isModuleReadyToClaim } = await import('./practiceCurriculum');
    const mod = ALL_CURRICULUM_MODULES.find((m) => m.id === moduleId);
    if (!mod) return { ok: false, message: 'Unknown module.' };
    const already = base.practice_modules_completed ?? [];
    if (already.includes(moduleId)) return { ok: false, message: 'Already claimed.' };
    if (!isModuleReadyToClaim(base, mod)) {
      return { ok: false, message: `Complete ${mod.requiredCount} ${mod.activity.kind.replace('_', ' ')} session(s) first.` };
    }
    let next: PlayerState = { ...base, practice_modules_completed: [...already, moduleId] };
    next = applyXp(next, mod.reward.playerXp);
    next = { ...next, university_credits: (next.university_credits || 0) + mod.reward.universityCredits };
    if (mod.reward.codexShards) {
      next = { ...next, codex_shards: (next.codex_shards || 0) + mod.reward.codexShards };
    }
    // Curriculum module completions count as a university_lesson for daily objectives.
    next = foldDaily(next, 'university_lesson');
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: `Module complete! +${mod.reward.universityCredits} University Credits.` };
  }, [updateState, foldDaily]);

  // Push 4 — Mark the Practice Curriculum intro card as seen (one-time dismiss).
  const markPracticeCurriculumSeen = useCallback(async () => {
    const base = playerRef.current;
    if (!base || base.seen_practice_curriculum) return;
    const next: PlayerState = { ...base, seen_practice_curriculum: true };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // P8 — Persist the player's card loadout (up to 3 card IDs for limited-use battle).
  const setEquippedCards = useCallback(async (cardIds: string[]) => {
    const base = playerRef.current;
    if (!base) return { ok: false, message: 'No player loaded.' };
    const clean = cardIds.filter(Boolean).slice(0, 3);
    const next: PlayerState = { ...base, equipped_cards: clean };
    playerRef.current = next;
    await updateState(next);
    return { ok: true, message: 'Card deck saved.' };
  }, [updateState]);

  // P8 — Mark the first-time "what are cards?" tutorial modal as seen.
  const markCardTutorialSeen = useCallback(async () => {
    const base = playerRef.current;
    if (!base || base.seen_card_tutorial) return;
    const next: PlayerState = { ...base, seen_card_tutorial: true };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // P9 — Mark the first-time "Call for Help" tutorial modal as seen.
  const markCallTutorialSeen = useCallback(async () => {
    const base = playerRef.current;
    if (!base || base.seen_call_tutorial) return;
    const next: PlayerState = { ...base, seen_call_tutorial: true };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  // Push 10 — Equip/unequip hero equipment items.
  // Equipping a new item into a slot replaces any existing item in that slot.
  // Task 270: blocks equipping items the player does not own.
  const equipItem = useCallback(async (heroId: string, slot: string, itemId: string) => {
    const base = playerRef.current;
    if (!base) return;
    const ownedEq = Array.isArray(base.owned_equipment) ? base.owned_equipment : [];
    if (!ownedEq.includes(itemId)) return; // not owned — silently ignore
    const existing = base.hero_equipment ?? {};
    const heroSlots = { ...(existing[heroId] ?? {}), [slot]: itemId };
    const next: PlayerState = { ...base, hero_equipment: { ...existing, [heroId]: heroSlots } };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  const unequipItem = useCallback(async (heroId: string, slot: string) => {
    const base = playerRef.current;
    if (!base) return;
    const existing = base.hero_equipment ?? {};
    const heroSlots = { ...(existing[heroId] ?? {}) };
    delete heroSlots[slot];
    const next: PlayerState = { ...base, hero_equipment: { ...existing, [heroId]: heroSlots } };
    playerRef.current = next;
    await updateState(next);
  }, [updateState]);

  const value = useMemo<Ctx>(() => ({
    player, loading, dailyPulse, openRoundsSignal, requestOpenDailyRounds, createPlayer, applyRewards, claimJourneyChapterBoss, claimJourneyAreaBoss, completeVerdantha, recordWardWaves, purchaseItem, purchaseJourneyMerchant, assembleCovenantScroll, redeemExchangeItem, claimMilestone, setActiveTitle, purchaseSkin, equipSkin, purchaseUpgrade, refillStamina, pullGacha, upgradeUnitMastery, setWardLoadout, setRealmLayout, setRealmAssignment, collectRealmProduction, recordFailure,
    syncInventory, saveActiveTeam, summonOnce, evolveHero, recruitOnce, freeRecruitOnce, tutorialRecruitOnce, recruitTen, promoteHeroCert, trainHero, toggleHeroLock, toggleHeroFavorite, completeLesson, completeSimulation, startClinicalSimulation, resumeClinicalSimulation, submitClinicalSimulationAction, completeClinicalSimulation, startGrandRounds, resumeGrandRounds, submitGrandRoundsResponse, pauseGrandRounds, abandonGrandRounds, saveGrandRoundsNotes, completeGrandRounds, completeUniPractice, grantLegacyUniPracticeReward, upgradeHeroSkill, spendStamina, logWellnessActivity, checkInDailyRounds, claimDailyObjective, claimDailyAllComplete, claimWeeklyGoal, claimWeeklyTask, claimWeeklyAllComplete, claimQuestMilestone, claimPracticeModule, markPracticeCurriculumSeen, exchangeInsightCrystals, recordCueTopics, resetPlayer, refresh, setPlayerClass, claimClassTier, completePrologue, completeIdentityRestore, setAvatar, completeDiagnosticIntro, markReminiscenceSeen, markStorySceneSeen, completeLotusLessonNode, applyClassDiagnostic, confirmClassDiagnostic, setLearningProfile, updateBattleStars, performSweep, claimLevelReward, claimChapterChest, claimChapter3Star, claimJourneyNode, markLv2UnlockSeen, markUniversityIntroSeen, completeWardDefense, purchaseWardExchange, assembleWardAegis, updateState,
    setEquippedCards, markCardTutorialSeen, markCallTutorialSeen,
    advanceProloguePhase, completePrologueCinematic, claimPrologueRewards,
    confirmIdentityReconstruction,
    equipItem, unequipItem,
    claimSpecialization,
    getPlayerHeroEligibility, createPlayerHero,
    applyFogMapChapterBossRewards,
    reconcileChapterBossKeys,
    setCanonicalShift,
    startCrisisDrill, resumeCrisisDrill, submitCrisisDrillResponse, pauseCrisisDrill, abandonCrisisDrill, completeCrisisDrill,
  }), [player, loading, dailyPulse, openRoundsSignal, requestOpenDailyRounds, createPlayer, applyRewards, claimJourneyChapterBoss, claimJourneyAreaBoss, completeVerdantha, recordWardWaves, purchaseItem, purchaseJourneyMerchant, assembleCovenantScroll, redeemExchangeItem, claimMilestone, setActiveTitle, purchaseSkin, equipSkin, purchaseUpgrade, refillStamina, pullGacha, upgradeUnitMastery, setWardLoadout, setRealmLayout, setRealmAssignment, collectRealmProduction, recordFailure, syncInventory, saveActiveTeam, summonOnce, evolveHero, recruitOnce, freeRecruitOnce, tutorialRecruitOnce, recruitTen, promoteHeroCert, trainHero, toggleHeroLock, toggleHeroFavorite, completeLesson, completeSimulation, startClinicalSimulation, resumeClinicalSimulation, submitClinicalSimulationAction, completeClinicalSimulation, startGrandRounds, resumeGrandRounds, submitGrandRoundsResponse, pauseGrandRounds, abandonGrandRounds, saveGrandRoundsNotes, completeGrandRounds, completeUniPractice, grantLegacyUniPracticeReward, upgradeHeroSkill, spendStamina, logWellnessActivity, checkInDailyRounds, claimDailyObjective, claimDailyAllComplete, claimWeeklyGoal, claimWeeklyTask, claimWeeklyAllComplete, claimQuestMilestone, claimPracticeModule, markPracticeCurriculumSeen, exchangeInsightCrystals, recordCueTopics, resetPlayer, refresh, setPlayerClass, claimClassTier, completePrologue, completeIdentityRestore, setAvatar, completeDiagnosticIntro, markReminiscenceSeen, markStorySceneSeen, completeLotusLessonNode, applyClassDiagnostic, confirmClassDiagnostic, setLearningProfile, updateBattleStars, performSweep, claimLevelReward, claimChapterChest, claimChapter3Star, claimJourneyNode, markLv2UnlockSeen, markUniversityIntroSeen, completeWardDefense, purchaseWardExchange, assembleWardAegis, updateState, setEquippedCards, markCardTutorialSeen, markCallTutorialSeen, advanceProloguePhase, completePrologueCinematic, claimPrologueRewards, confirmIdentityReconstruction, equipItem, unequipItem, claimSpecialization, getPlayerHeroEligibility, createPlayerHero, applyFogMapChapterBossRewards, reconcileChapterBossKeys, startCrisisDrill, resumeCrisisDrill, submitCrisisDrillResponse, pauseCrisisDrill, abandonCrisisDrill, completeCrisisDrill]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
