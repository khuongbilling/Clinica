import { getDifficultyModifier } from './difficulty';
import { ElementSystem, Enemy, Hero, HeroSkill } from './types';
import { CallOption, Item, ITEMS, TEMP_ACTIONS } from './items';
import { CARD_CLINICAL, CARD_POOL, drawCards, getCard, SkillCard } from './cards';
import {
  ActionClinical,
  ActionStatus,
  AffinityResult,
  apMessage,
  applyChapterForgivenessToStatus,
  buildRationale,
  CALL_CLINICAL,
  canAdvanceChain,
  ChainRole,
  ChainState,
  normalizePathwayRoles,
  PathwayRole,
  CHAIN_BONUSES,
  ClinicalCueQuestion,
  emptyChain,
  ENEMY_CLINICAL,
  EnemyClinical,
  evaluateClinicalAppropriateness,
  generateBattleMessage,
  getActiveFeedbackLevel,
  getAffinityModifier,
  getChapterForgiveness,
  getCorruptionOutcome,
  getCorruptionPenaltyScale,
  getDangerLevel,
  getEnemyDamage,
  getRandomClinicalCue,
  getStabilizationModifier,
  getStabilityGainModifier,
  stabilityResistanceMultiplier,
  getSystemMatchModifier,
  getTreatmentStabilityModifier,
  getTurnAP,
  ITEM_CLINICAL,
  LearningProfile,
  SKILL_CLINICAL,
  statusLabel,
  TEMP_CLINICAL,
  ULTIMATE_BY_ROLE,
  ULTIMATE_CHARGE_MAX,
  SYSTEM_TO_CUE_TOPIC,
} from './clinical';
import {
  calcShieldEffect,
  calcAffinityFamilyMod,
  calcStabilizeEffect,
  calcStrikeEffect,
  neutralModifiers,
  SkillModifiers,
  statForSkillType,
  statToMultiplier,
} from './skillCalc';
import { getLeaderBonus, scaleLeaderBonus } from './leaderSpecialty';
import type { ClassTreeBattleBonus } from './classTree';
import { getAggregatedEquipmentEffect, type AggregatedEquipmentEffect } from './equipment';
import type { ActionType } from './types';

/**
 * Returns the flat stat bonus from a hero's aggregated equipment effect for a
 * given skill action type. Mirrors statForSkillType()'s skill→stat mapping.
 *
 * | type              | stat        | bonus field       |
 * |-------------------|-------------|-------------------|
 * | scout / analyze   | insight     | insightBonus      |
 * | stabilize / support / cleanse | carePower | carePowerBonus |
 * | strike / counter  | intervention| interventionBonus |
 * | shield            | guard       | guardBonus        |
 * | command           | coordination| coordinationBonus |
 */
function equipStatBonusForType(type: ActionType, fx: AggregatedEquipmentEffect): number {
  switch (type) {
    case 'scout':
    case 'analyze':    return fx.insightBonus;
    case 'stabilize':
    case 'support':
    case 'cleanse':    return fx.carePowerBonus;
    case 'strike':
    case 'counter':    return fx.interventionBonus;
    case 'shield':     return fx.guardBonus;
    case 'command':    return fx.coordinationBonus;
    default:           return 0;
  }
}

export interface WaveMember {
  enemy: Enemy;
  corruption: number;
  defeated: boolean;
}

// Hard ceiling for AP granted by bonuses (e.g. correct Clinical Cues) that stack
// above the normal per-turn limit. Keeps bonus AP meaningful without runaway stacking.
const AP_BONUS_CEILING = 12;

export interface BattleState {
  enemy: Enemy;
  enemyClinical: EnemyClinical | undefined;
  wave: WaveMember[];
  activeEnemyId: string;
  team: Hero[];
  stability: number;
  corruption: number;
  shieldNext: number;
  ap: number;
  apMax: number;
  visibleClues: string[]; // clue ids
  hiddenClueIds: string[];
  revealedLabels: string[]; // human-readable labels of revealed clues
  log: string[];
  outcome: 'ongoing' | 'win' | 'loss';
  turn: number;
  inventory: Record<string, number>;
  callUsed: boolean; // legacy (any call used)
  temporaryActionIds: string[];

  // Clinical reasoning layer state
  chain: ChainState;
  fullChainCompleted: boolean;
  unsafeActionsUsed: number;
  poorFitActionsUsed: number;
  reassessUsed: boolean;
  reassessUsedAnytime: boolean; // sticky flag for star scoring
  turnsTaken: number; // increments per player-action consuming AP
  feedbackLevel: ReturnType<typeof getActiveFeedbackLevel>;
  chapter: number;
  profile: LearningProfile | undefined;
  difficulty: string | undefined;
  enemyDamageReduction: number;
  reboundArmed: boolean; // set true when corruption first drops below 40; cleared by reassess

  // Hero-based turn system
  selectedHeroId: string | null;
  heroActionsUsed: Record<string, boolean>;
  callsUsed: { pharmacy: boolean; respiratory: boolean; rapidResponse: boolean; infectionControl: boolean; lab: boolean; rehab: boolean; social: boolean };
  // P9 — total calls remaining this battle (global budget across all call types).
  callHelpRemaining: number;
  preparedItemDiscount: string | null;
  nextAirActionDiscount: boolean;
  rapidResponseActive: boolean;
  dangerTriggerActive: boolean;

  // Consult balance tracking
  consultsUsed: number;
  emergencyCallsUsed: number;
  inappropriateConsultsUsed: number;
  blockNextSpread: boolean;
  basicAidUses: number;

  // Active skill cards (hand/tray)
  hand: string[];
  // P8 — remaining loaded cards not yet in hand (drawn from equippedCards overflow).
  // Empty array in legacy random-draw mode.
  cardDeck: string[];
  // True when this battle was started with player-equipped cards (limited use);
  // false means legacy random-draw mode (infinite cycling from the global pool).
  limitedCardMode: boolean;

  // Question-to-power (Clinical Cue)
  pendingCue: ClinicalCueQuestion | null;
  nextCueTurn: number; // earliest turn the next cue may trigger (randomized, ≥2 turns after the last presentation)
  cuesAnswered: string[];
  cueBonusStabilize: number; // bonus from correct cue answers; boosts every stabilizing action this turn, cleared at end of turn
  cuesTopicsCorrect: string[]; // topic ids answered correctly this battle, for Codex/University progress

  // Clinical Arts ultimates
  heroUltimateCharge: Record<string, number>;
  ultimateUsedCount: Record<string, number>;

  // Hero EXP — per-hero battle contribution points (damage/heal/shield/reveal/AP
  // spent), used at battle end to split Hero EXP proportionally (see
  // progression.ts splitContributionToHeroXp). Distinct from Player EXP.
  heroContribution: Record<string, number>;

  // Push 11 — Player class tree combat bonuses (computed once at initBattle from
  // class_tree_id + class_progress; never mutated during battle).
  classBonus: ClassTreeBattleBonus | null;
  classFirstScoutUsed: boolean;        // Seer: true after the first scout action of this battle
  classStabilizeUsedThisTurn: boolean; // Caretaker: true when any stabilize skill fired this turn

  // Push 10 — Aggregated equipment effects per hero (computed once at initBattle).
  // Keyed by hero.id. Heroes with no equipped items get a neutral (all-1.00) effect.
  heroEquipmentEffects: Record<string, AggregatedEquipmentEffect>;
  // True after the Triage Sash first-loss reduction has fired once this battle.
  equipFirstLossUsed: boolean;
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

export interface InitBattleOptions {
  inventory?: Record<string, number>;
  profile?: LearningProfile;
  enemyMastery?: Record<string, number>;
  chapter?: number;
  startingStabilityBonus?: number;
  enemyDamageReduction?: number;
  revealOneExtraClue?: boolean;
  difficulty?: string;
  additionalEnemies?: Enemy[];
  apBonus?: number;
  // Player Class ability bonus (see progression.ts getClassBattleBonuses) —
  // seeds the shield the patient starts battle with (Guardian/Caretaker tiers).
  startShield?: number;
  // P8 — card IDs the player loaded in the mission loadout (limited-use mode).
  // When provided, these become the battle hand; when empty/undefined, random draw.
  equippedCards?: string[];
  // Push 11 — Pre-computed class tree bonus; passed from battle.tsx so battle.ts
  // doesn't need to import classTree directly. null/undefined = no class bonus.
  classTreeBonus?: ClassTreeBattleBonus;
  // Push 10 — Hero equipment loadout (player.hero_equipment). Used at init to
  // compute heroEquipmentEffects. Skipped for prologue loaner battles.
  heroEquipment?: Record<string, Record<string, string>>;
}

// ============================================================
// Wave (multi-enemy) helpers
// ============================================================

/** Behavior pressure applied by companion/affliction enemies still alive in the wave, each enemy turn. */
export function getWaveBehaviorPressure(wave: WaveMember[]): { stabilityDrain: number; urgent: boolean; log: string[] } {
  let stabilityDrain = 0;
  let urgent = false;
  const log: string[] = [];
  for (const m of wave) {
    if (m.defeated) continue;
    if (m.enemy.behaviorTag === 'hypoxia') {
      stabilityDrain += 6;
      log.push(`${m.enemy.name} chokes off oxygen further. Stability -6.`);
    } else if (m.enemy.behaviorTag === 'shock') {
      stabilityDrain += 8;
      urgent = true;
      log.push(`${m.enemy.name} destabilizes perfusion. Stability -8.`);
    }
  }
  return { stabilityDrain, urgent, log };
}

/** Damage multiplier applied to the active enemy's signature attack from panic-type companions. */
export function getWaveDamageMultiplier(wave: WaveMember[]): number {
  let mult = 1;
  for (const m of wave) {
    if (m.defeated) continue;
    if (m.enemy.behaviorTag === 'panic') mult *= 1.15;
  }
  return mult;
}

/** Defensive pressure reduction — some wave members shield each other from the same treatments. */
export function getWaveDefenseModifier(target: Enemy, wave: WaveMember[]): number {
  let mod = 1;
  for (const m of wave) {
    if (m.defeated || m.enemy.id === target.id) continue;
    if (m.enemy.behaviorTag === 'wheeze' && target.primarySystem === 'Air') mod *= 0.5;
    if (m.enemy.behaviorTag === 'mucus' && target.id === m.enemy.id) mod *= 0.4;
  }
  if (target.behaviorTag === 'mucus') mod *= 0.6;
  return mod;
}

/** After any corruption change to the active enemy: mark defeat, advance to next alive member, or win. */
function syncWaveAndCheckVictory(s: BattleState): BattleState {
  let next = { ...s, wave: s.wave.map(m => m.enemy.id === s.activeEnemyId ? { ...m, corruption: s.corruption } : m) };
  if (next.corruption > 0) return next;

  // Active enemy defeated
  next.wave = next.wave.map(m => m.enemy.id === next.activeEnemyId ? { ...m, corruption: 0, defeated: true } : m);
  const defeatedEnemy = next.wave.find(m => m.enemy.id === next.activeEnemyId)?.enemy;
  const nextAlive = next.wave.find(m => !m.defeated);

  if (!nextAlive) {
    next.log = [...next.log, `✨ The ${defeatedEnemy?.name || s.enemy.name} is purified! Stability holds at ${next.stability}%.`];
    next.outcome = 'win';
    return next;
  }

  // Advance to the next enemy in the wave
  next.log = [...next.log, `✨ ${defeatedEnemy?.name} is purified! ${nextAlive.enemy.name} presses the attack.`];
  next.enemy = nextAlive.enemy;
  next.enemyClinical = ENEMY_CLINICAL[nextAlive.enemy.id];
  next.activeEnemyId = nextAlive.enemy.id;
  next.corruption = nextAlive.corruption;
  return next;
}

export function initBattle(enemy: Enemy, team: Hero[], opts: InitBattleOptions = {}): BattleState {
  // Dev-mode validation: warn if enemy is missing the weakElement field entirely.
  // null means "no elemental weakness" (valid); undefined means the field was not set.
  const _devMode = (typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production');
  if (_devMode) {
    const VALID_ELEMENTS = new Set(['Air','River','Fire','Energy','Storm','Mind','Filter','Forge','Protection','Growth']);
    // weakElement: must be present, and if non-null must be a valid ElementSystem value.
    if (!Object.prototype.hasOwnProperty.call(enemy, 'weakElement')) {
      console.warn(`[Enemy:${enemy.id}] missing weakElement — add weakElement: ElementSystem | null (required by Push 1)`);
    } else if (enemy.weakElement !== null && !VALID_ELEMENTS.has(enemy.weakElement as string)) {
      console.warn(`[Enemy:${enemy.id}] weakElement "${String(enemy.weakElement)}" is not a valid ElementSystem value`);
    }
    // weakSystem: removed in Push 1; must not be present.
    if (Object.prototype.hasOwnProperty.call(enemy, 'weakSystem')) {
      console.warn(`[Enemy:${enemy.id}] has legacy weakSystem — remove it and use weakElement: ElementSystem | null`);
    }
    // corruptionAspect: required narrative label.
    if (!enemy.corruptionAspect || typeof enemy.corruptionAspect !== 'string') {
      console.warn(`[Enemy:${enemy.id}] missing corruptionAspect — add a narrative label string (e.g. 'Depletion')`);
    }
    // secondaryAffinities: required array; warn when absent or non-array.
    if (!Object.prototype.hasOwnProperty.call(enemy, 'secondaryAffinities')) {
      console.warn(`[Enemy:${enemy.id}] missing secondaryAffinities — add secondaryAffinities: [] (required by Push 1)`);
    } else if (!Array.isArray(enemy.secondaryAffinities)) {
      console.warn(`[Enemy:${enemy.id}] secondaryAffinities must be an array — got ${typeof enemy.secondaryAffinities}`);
    }
    // secondaryAffinity (single): deprecated; should have been migrated to secondaryAffinities.
    if (Object.prototype.hasOwnProperty.call(enemy, 'secondaryAffinity')) {
      console.warn(`[Enemy:${enemy.id}] has legacy secondaryAffinity (single string) — migrate to secondaryAffinities: []`);
    }
  }

  const enemyClinical = ENEMY_CLINICAL[enemy.id];
  const chapter = opts.chapter || enemyClinical?.chapter || (enemy.difficulty <= 2 ? 1 : 2);
  const feedbackLevel = getActiveFeedbackLevel(opts.profile, enemy.name, opts.enemyMastery, chapter);

  // Difficulty-based clue visibility
  // allClues ordered: visibleClues first (priority), then hiddenClues
  const allClues = [...enemy.visibleClues, ...enemy.hiddenClues];
  const diffMod = getDifficultyModifier(opts.difficulty as any);
  // All clues start hidden — revealed only through Scout skills during battle.
  const targetVisible = 0;
  const finalVisible = allClues.slice(0, targetVisible).map(c => c.id);
  const finalHidden = allClues.slice(targetVisible).map(c => c.id);
  const finalRevealedLabels = allClues.slice(0, targetVisible).map(c => c.label);

  let stability = enemy.startingStability + (opts.startingStabilityBonus || 0);
  stability = clamp(stability, 0, 100);

  // Apply difficulty damage adjustment to the handicap reduction
  const diffDamageEffect = Math.round((1 - diffMod.enemyDamageMultiplier) * 100);
  const combinedDamageReduction = (opts.enemyDamageReduction || 0) + diffDamageEffect;

  const corruption = enemy.corruption;
  const turnAp = getTurnAP(stability, corruption, chapter, {}) + (opts.apBonus || 0);

  const log: string[] = [`The ${enemy.name} corrupts the patient. Stability ${stability}%.`];
  log.push(apMessage(turnAp));

  // Mentor aid: reveal one extra clue on top of difficulty count
  if (opts.revealOneExtraClue && finalHidden.length > 0) {
    const id = finalHidden.shift()!;
    finalVisible.push(id);
    const clue = allClues.find(c => c.id === id);
    if (clue) finalRevealedLabels.push(clue.label);
    log.push(`The System's eye: one hidden clue is already revealed.`);
  }

  const heroActionsUsed: Record<string, boolean> = {};
  team.forEach(h => { heroActionsUsed[h.id] = false; });

  const waveList = [enemy, ...(opts.additionalEnemies || [])];
  const wave: WaveMember[] = waveList.map(e => ({ enemy: e, corruption: e.corruption, defeated: false }));
  if (waveList.length > 1) {
    log.push(`⚔ A wave of ${waveList.length} spirits assails the ward — defeat ${enemy.name} first.`);
  }

  const heroUltimateCharge: Record<string, number> = {};
  const ultimateUsedCount: Record<string, number> = {};
  team.forEach(h => { heroUltimateCharge[h.id] = 0; ultimateUsedCount[h.id] = 0; });

  // P8 — limited-use card mode: if the player equipped cards in the loadout,
  // use those as the starting hand (one use each). Otherwise random-draw (legacy).
  const equippedCards = opts.equippedCards ?? [];
  const limitedCardMode = equippedCards.length > 0;
  const hand = limitedCardMode ? equippedCards.slice(0, 3) : drawCards(3);
  const cardDeck = limitedCardMode ? equippedCards.slice(3) : [];
  const pendingCue = getRandomClinicalCue([], { chapter, topicHint: SYSTEM_TO_CUE_TOPIC[enemy.primarySystem] });

  return {
    enemy,
    enemyClinical,
    wave,
    activeEnemyId: enemy.id,
    team,
    stability,
    corruption,
    shieldNext: Math.max(0, opts.startShield || 0),
    ap: turnAp,
    apMax: turnAp,
    visibleClues: finalVisible,
    hiddenClueIds: finalHidden,
    revealedLabels: finalRevealedLabels,
    log,
    outcome: 'ongoing',
    turn: 1,
    inventory: { ...(opts.inventory || {}) },
    callUsed: false,
    temporaryActionIds: [],
    chain: emptyChain(),
    fullChainCompleted: false,
    unsafeActionsUsed: 0,
    poorFitActionsUsed: 0,
    reassessUsed: false,
    reassessUsedAnytime: false,
    turnsTaken: 0,
    feedbackLevel,
    chapter,
    profile: opts.profile,
    difficulty: opts.difficulty,
    enemyDamageReduction: combinedDamageReduction,
    reboundArmed: false,

    selectedHeroId: team[0]?.id || null,
    heroActionsUsed,
    callsUsed: { pharmacy: false, respiratory: false, rapidResponse: false, infectionControl: false, lab: false, rehab: false, social: false },
    callHelpRemaining: 3,
    preparedItemDiscount: null,
    nextAirActionDiscount: false,
    rapidResponseActive: false,
    dangerTriggerActive: false,
    consultsUsed: 0,
    emergencyCallsUsed: 0,
    inappropriateConsultsUsed: 0,
    blockNextSpread: false,
    basicAidUses: 0,

    hand,
    cardDeck,
    limitedCardMode,
    pendingCue,
    // Opening cue counts as the first presentation: next cue rolls 2–4 turns later.
    nextCueTurn: 1 + rollCueGap(),
    cuesAnswered: [],
    cueBonusStabilize: 0,
    cuesTopicsCorrect: [],

    heroUltimateCharge,
    ultimateUsedCount,
    heroContribution: {},

    classBonus: opts.classTreeBonus ?? null,
    classFirstScoutUsed: false,
    classStabilizeUsedThisTurn: false,

    // Push 10 — pre-compute each hero's aggregated equipment effect once at init.
    heroEquipmentEffects: Object.fromEntries(
      team.map(h => [h.id, getAggregatedEquipmentEffect(h.id, opts.heroEquipment)])
    ),
    equipFirstLossUsed: false,
  };
}

/** Adds battle-contribution points for a hero (damage/heal/shield/reveal/AP spent), used to split Hero EXP at battle end. */
function addContribution(s: BattleState, heroId: string | null | undefined, points: number): BattleState {
  if (!heroId || points <= 0) return s;
  const heroContribution = { ...s.heroContribution, [heroId]: (s.heroContribution[heroId] || 0) + points };
  return { ...s, heroContribution };
}

// ============================================================
// Hero selection
// ============================================================

export function selectHero(s: BattleState, heroId: string): BattleState {
  if (!s.team.find(h => h.id === heroId)) return s;
  return { ...s, selectedHeroId: heroId };
}

export function isHeroReady(s: BattleState, heroId: string): boolean {
  return !s.heroActionsUsed[heroId];
}

function consumeHeroAction(s: BattleState, heroId: string): BattleState {
  const heroActionsUsed = { ...s.heroActionsUsed, [heroId]: true };
  // Auto-advance to the next hero who hasn't acted yet this turn.
  const nextReady = s.team.find(h => !heroActionsUsed[h.id]);
  return {
    ...s,
    heroActionsUsed,
    selectedHeroId: nextReady ? nextReady.id : s.selectedHeroId,
  };
}

// ============================================================
// Clinical Arts — ultimate charge
// ============================================================

function addUltimateCharge(s: BattleState, heroId: string | null, amount: number): BattleState {
  if (!heroId) return s;
  const current = s.heroUltimateCharge[heroId] ?? 0;
  const next = clamp(current + amount, 0, ULTIMATE_CHARGE_MAX);
  return { ...s, heroUltimateCharge: { ...s.heroUltimateCharge, [heroId]: next } };
}

export function isUltimateReady(s: BattleState, heroId: string): boolean {
  return (s.heroUltimateCharge[heroId] ?? 0) >= ULTIMATE_CHARGE_MAX;
}

export function applyUltimate(s: BattleState, heroId: string): ApplyResult {
  if (s.outcome !== 'ongoing') return { state: s, message: 'Battle is over.', aborted: true };
  const hero = s.team.find(h => h.id === heroId);
  if (!hero) return { state: s, message: 'Hero not found.', aborted: true };
  if (!isUltimateReady(s, heroId)) return { state: s, message: `${hero.name}'s Clinical Art is not ready.`, aborted: true };
  if (s.heroActionsUsed[heroId]) return { state: s, message: `${hero.name} has already acted this turn.`, aborted: true };

  const ult = ULTIMATE_BY_ROLE[hero.role];
  let next: BattleState = consumeHeroAction({
    ...s,
    heroUltimateCharge: { ...s.heroUltimateCharge, [heroId]: 0 },
    ultimateUsedCount: { ...s.ultimateUsedCount, [heroId]: (s.ultimateUsedCount[heroId] || 0) + 1 },
    turnsTaken: s.turnsTaken + 1,
    log: [...s.log, `✦ Clinical Art: ${hero.name} unleashes ${ult.name}! ${ult.description}`],
  }, heroId);

  switch (hero.role) {
    case 'Assessor':
      next = revealHiddenClues(next, next.hiddenClueIds.length);
      break;
    case 'Stabilizer':
      next.stability = clamp(next.stability + 30, 0, 100);
      break;
    case 'Analyst':
      next.corruption = Math.max(0, next.corruption - 25);
      break;
    case 'Coordinator': {
      const heroActionsUsed: Record<string, boolean> = {};
      next.team.forEach(h => { heroActionsUsed[h.id] = false; });
      heroActionsUsed[heroId] = true; // the caster has still acted
      next.heroActionsUsed = heroActionsUsed;
      // Refresh the team's turn — point at the next hero who can now act again.
      const ready = next.team.find(h => !heroActionsUsed[h.id]);
      if (ready) next.selectedHeroId = ready.id;
      break;
    }
    case 'Educator':
      next = revealHiddenClues(next, 2);
      next.shieldNext = Math.max(next.shieldNext, 30);
      break;
    case 'Specialist':
      next.corruption = Math.max(0, next.corruption - 30);
      break;
  }

  next = addContribution(next, heroId, 40);
  next = syncWaveAndCheckVictory(next);
  return { state: next, message: `${ult.name} unleashed!`, status: 'appropriate' };
}

// ============================================================
// Care Attempt — universal basic action
// ============================================================

export function careAttemptDamage(chapter: number, isBoss: boolean): number {
  if (isBoss) return 2;
  if (chapter >= 3) return 3;
  if (chapter >= 2) return 4;
  return 5;
}

export function applyCareAttempt(s: BattleState): ApplyResult {
  if (s.outcome !== 'ongoing') return { state: s, message: 'Battle is over.', aborted: true };
  const heroId = s.selectedHeroId;
  if (!heroId) return { state: s, message: 'Select a hero first.', aborted: true };
  if (s.heroActionsUsed[heroId]) {
    const hero = s.team.find(h => h.id === heroId);
    return { state: s, message: `${hero?.name || 'That hero'} has already acted this turn.`, aborted: true };
  }
  if (s.ap < 1) return { state: s, message: 'Not enough AP.', aborted: true };

  const hero = s.team.find(h => h.id === heroId);
  const isBoss = (s.enemyClinical?.rewardBase || 0) >= 100;
  const damage = careAttemptDamage(s.chapter, isBoss);

  let next: BattleState = consumeHeroAction({
    ...s,
    ap: s.ap - 1,
    corruption: Math.max(0, s.corruption - damage),
    turnsTaken: s.turnsTaken + 1,
    basicAidUses: s.basicAidUses + 1,
    log: [
      ...s.log,
      `${hero?.name || 'Hero'} → Care Attempt.`,
      `Care Attempt reduced Disease Corruption by ${damage}. A targeted clinical action would be stronger.`,
    ],
  }, heroId);

  next = addUltimateCharge(next, heroId, 8);
  next = addContribution(next, heroId, damage + 2);
  next = syncWaveAndCheckVictory(next);

  return { state: next, message: `Care Attempt: -${damage} Corruption.`, status: 'weak' };
}

export function revealHiddenClues(s: BattleState, count: number): BattleState {
  const reveal = Math.min(count, s.hiddenClueIds.length);
  if (reveal === 0) return s;
  const hiddenClueIds = [...s.hiddenClueIds];
  const visibleClues = [...s.visibleClues];
  const revealedLabels = [...s.revealedLabels];
  const log = [...s.log];
  const cluePool = [...s.enemy.visibleClues, ...s.enemy.hiddenClues];
  for (let i = 0; i < reveal; i++) {
    const id = hiddenClueIds.shift()!;
    visibleClues.push(id);
    const clue = cluePool.find(c => c.id === id);
    if (clue) {
      revealedLabels.push(clue.label);
      log.push(`Hidden clue revealed: ${clue.label}.`);
    }
  }
  return { ...s, hiddenClueIds, visibleClues, revealedLabels, log };
}

// ============================================================
// Core appropriateness pipeline
// ============================================================

interface ResolveResult {
  status: ActionStatus;
  modifier: number;
  systemModifier: number;
  chainAdvanced: PathwayRole | null;
  chainCompletedNow: boolean;
  rationale: string | undefined;
  affinityResult: AffinityResult;
}

function resolveAction(
  action: ActionClinical | undefined,
  systemType: string | undefined,
  state: BattleState,
): ResolveResult {
  const enemy = state.enemyClinical;
  const evalRes = evaluateClinicalAppropriateness(action, enemy, { revealedLabels: state.revealedLabels, stability: state.stability });
  const sysMod = getSystemMatchModifier(systemType, enemy, state.enemy.primarySystem);

  // Chapter forgiveness on weak/inappropriate
  const forg = getChapterForgiveness(state.chapter);
  const effectiveMod = applyChapterForgivenessToStatus(evalRes.status, evalRes.modifier, forg);

  // Care chain advancement
  let chainAdvanced: PathwayRole | null = null;
  let chainCompletedNow = false;
  if (evalRes.status !== 'locked' && evalRes.status !== 'unsafe' && evalRes.status !== 'inappropriate') {
    const next = canAdvanceChain(action, enemy, state.chain, systemType);
    if (next) {
      chainAdvanced = next;
      const newProgress = [...state.chain.progress, next];
      if (enemy && newProgress.length >= enemy.treatmentChain.length) {
        chainCompletedNow = true;
      }
    }
  }

  const rationale = buildRationale(evalRes.status, action, enemy);
  const affinityResult = getAffinityModifier(action, enemy);
  return { status: evalRes.status, modifier: effectiveMod, systemModifier: sysMod, chainAdvanced, chainCompletedNow, rationale, affinityResult };
}

function applyResolutionToState(
  s: BattleState,
  res: ResolveResult,
  actionName: string,
): { state: BattleState; aborted: boolean } {
  if (res.status === 'locked') {
    // Don't consume AP, don't apply
    const lockedMsg = `${actionName} is locked — reveal the required clue first.`;
    return { state: { ...s, log: [...s.log, `🔒 ${lockedMsg}`] }, aborted: true };
  }

  let next = { ...s, log: [...s.log] };
  // Harshness of a wrong treatment scales with chapter progression + difficulty mode
  // (gentle in Chapter 1, brutal on Chaos).
  const penaltyScale = getCorruptionPenaltyScale(s.chapter, s.difficulty);
  if (res.status === 'unsafe') {
    next.unsafeActionsUsed = next.unsafeActionsUsed + 1;
    const outcome = getCorruptionOutcome('unsafe', penaltyScale);
    next.stability = clamp(next.stability - 10, 0, 100);
    if (outcome.worsenBase > 0) next.corruption = Math.max(0, next.corruption + outcome.worsenBase);
    next.log.push(`⚠ Unsafe: ${actionName}. Stability -10${outcome.worsenBase > 0 ? `, Corruption Spread increases (+${outcome.worsenBase} Corruption)` : ''}.`);
  }
  if (res.status === 'inappropriate') {
    next.poorFitActionsUsed = next.poorFitActionsUsed + 1;
    // Totally unrelated treatment: no help, actively harms the patient.
    const outcome = getCorruptionOutcome('inappropriate', penaltyScale);
    if (outcome.stabilityPenalty > 0) next.stability = clamp(next.stability - outcome.stabilityPenalty, 0, 100);
    if (outcome.worsenBase > 0) next.corruption = Math.max(0, next.corruption + outcome.worsenBase);
    next.log.push(`✗ ${actionName} does not match this condition — Stability -${outcome.stabilityPenalty}, Corruption worsens (+${outcome.worsenBase}).`);
  }

  // Track chain progress
  if (res.chainAdvanced) {
    next.chain = { ...next.chain, progress: [...next.chain.progress, res.chainAdvanced] };
    if (res.chainCompletedNow) {
      next.chain = { ...next.chain, completed: true };
      next.fullChainCompleted = true;
      // Push 11: Medic careChainMod amplifies care-chain completion bonus.
      const ccm = s.classBonus?.careChainMod ?? 1;
      const chainCorr = Math.round(CHAIN_BONUSES.fullChainCorruptionDamage * ccm);
      next.corruption = Math.max(0, next.corruption - chainCorr);
      const chainStab = Math.round(CHAIN_BONUSES.fullChainStabilityBonus * ccm * getStabilityGainModifier(next.stability) * stabilityResistanceMultiplier(next.enemy));
      next.stability = clamp(next.stability + chainStab, 0, 100);
      const ccNote = ccm > 1.005 ? ` (Medic +${Math.round((ccm - 1) * 100)}%)` : '';
      next.log.push(`✨ Complete Care Chain: -${chainCorr} corruption, +${chainStab} stability.${ccNote}`);
    }
  }

  return { state: next, aborted: false };
}

// ============================================================
// Apply: skills, items, temp actions, calls
// ============================================================

export interface ApplyResult { state: BattleState; message: string; status?: ActionStatus; aborted?: boolean }

export type CastQuality = 'perfect' | 'good' | 'normal';

export const CAST_QUALITY_MULTIPLIER: Record<CastQuality, number> = {
  perfect: 1.3,
  good: 1.12,
  normal: 1,
};

/** Skills that support the Perfect Cast timing prompt — those with a meaningful strike or stabilize payload. */
export function skillSupportsCastTiming(skill: HeroSkill): boolean {
  return !!(skill.strike || skill.strikeRange || skill.stabilize || skill.stabilizeRange);
}

/** Roll a random integer within a [min, max] inclusive range. */
function rollRange([min, max]: [number, number]): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function applySkill(s: BattleState, skill: HeroSkill, hero: Hero, castQuality: CastQuality = 'normal'): ApplyResult {
  const _devModeSkill = (typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production');
  if (s.outcome !== 'ongoing') return { state: s, message: 'Battle is over.', aborted: true };

  // Hero must be the selected hero, and ready
  if (s.selectedHeroId && s.selectedHeroId !== hero.id) {
    return { state: s, message: 'That hero is not selected.', aborted: true };
  }
  if (s.heroActionsUsed[hero.id]) {
    return { state: s, message: `${hero.name} has already acted this turn.`, aborted: true };
  }

  // Compute cost with discounts
  let cost = skill.cost;
  let consumedAirDiscount = false;
  if (s.nextAirActionDiscount && (skill.systemType === 'Air')) {
    cost = Math.max(1, cost - 1);
    consumedAirDiscount = true;
  }
  if (s.ap < cost) return { state: s, message: 'Not enough AP.', aborted: true };

  const action = SKILL_CLINICAL[skill.id];
  const systemType = skill.systemType || 'Universal';
  const res = resolveAction(action, systemType, s);

  const { state: post, aborted } = applyResolutionToState(s, res, skill.name);
  if (aborted) return { state: post, message: `${skill.name} is locked.`, status: 'locked', aborted: true };

  let next = consumeHeroAction(post, hero.id);
  next.ap = s.ap - cost;
  next.turnsTaken = next.turnsTaken + 1;
  next.log = [...next.log, `${hero.name} → ${skill.name}.`];
  if (consumedAirDiscount) next.nextAirActionDiscount = false;

  // Build modifier bags for this skill use (Push 2 pipeline + Push 4 + Push 6).
  // Strike and stabilize need different clinicalMod sources, so two bags.
  const treatMod = getTreatmentStabilityModifier(next.stability);
  const castMult = CAST_QUALITY_MULTIPLIER[castQuality];
  const corrOutcome = getCorruptionOutcome(res.status);

  // Push 10: equipment effect for the acting hero (pre-computed at initBattle).
  // Must be fetched before heroStatMult so stat bonuses can be included in the multiplier.
  const equipFx = s.heroEquipmentEffects[hero.id] ?? { strikeMult: 1, stabilizeMult: 1, shieldMult: 1, itemMult: 1, cardMult: 1, scoutRevealBonus: 0, firstStabilityLossReduction: 0, callForHelpBonus: 0, insightBonus: 0, carePowerBonus: 0, interventionBonus: 0, guardBonus: 0, coordinationBonus: 0 };

  // Push 4 + Push 12: heroStatMod — per-hero stat scale factor from HeroCombatStats.
  // Push 12: equipment flat stat bonuses (insightBonus, carePowerBonus, etc.) are added to
  // the raw stat value before converting to a multiplier, so equipped stat-boosting gear
  // actually improves combat performance.
  const heroStatMult   = statToMultiplier(statForSkillType(skill.type, hero.stats) + equipStatBonusForType(skill.type, equipFx));
  const shieldStatMult = statToMultiplier(hero.stats.guard + equipFx.guardBonus);

  // Push 6: affinityFamilyMod — ×1.15 strong / ×0.90 weak / ×1.00 neutral.
  // Checks hero.strongAffinities / weakAffinities vs enemy.primaryAffinity +
  // secondaryAffinity. Falls safely to ×1.00 when Push-5 data is absent.
  // Push 6: affinityFamilyMod — dampened by enemy.affinityResistance (Push 7).
  const affinityFamilyMult = calcAffinityFamilyMod(
    hero.strongAffinities,
    hero.weakAffinities,
    s.enemy.primaryAffinity,
    s.enemy.secondaryAffinities ?? (s.enemy.secondaryAffinity ? [s.enemy.secondaryAffinity] : []),
    s.enemy.affinityResistance ?? 0,
  );

  // Push 7: enemy defense modifiers.
  // corruptionResistanceMod: enemy's resistance to corruption-lowering effects (strikes only).
  const corruptionResistanceMod = 1 - (s.enemy.corruptionResistance ?? 0);
  // hiddenDefenseMod: scales down all effects proportionally to remaining unrevealed hidden clues.
  // = 1.00 when no hidden clues / all revealed. Falls below 1.00 while clues are concealed.
  const totalHiddenClues = s.enemy.hiddenClues.length;
  const hiddenFraction = totalHiddenClues > 0 ? s.hiddenClueIds.length / totalHiddenClues : 0;
  const hiddenDefenseMod = 1 - (s.enemy.hiddenDefense ?? 0) * hiddenFraction;

  // Push 9: Leader Spot — team[0] = slot 1 = the Leader hero.
  // Scale by their rarity/star before building mod bags so each bag gets the correct value.
  const lb = s.team[0] ? scaleLeaderBonus(getLeaderBonus(s.team[0]), s.team[0]) : null;
  const cb = s.classBonus; // Push 11: class tree bonus

  const strikeMods: SkillModifiers = {
    ...neutralModifiers(),
    clinicalMod: corrOutcome.reductionMult,
    systemMod: res.systemModifier,
    castMult,
    chapterMod: treatMod,
    affinityMod: res.affinityResult.multiplier,
    // elementBonus: ONLY for skills whose type is 'strike'. command/analyze/support/etc.
    // actions may carry a strike payload but must NOT receive the elemental counter bonus.
    elementBonus: skill.type === 'strike' && s.enemy.weakElement && hero.element === s.enemy.weakElement ? 0.3 : 0,
    heroStatMod: heroStatMult,
    affinityFamilyMod: affinityFamilyMult,
    corruptionResistanceMod,             // Push 7
    hiddenDefenseMod,                    // Push 7
    leaderBonusMod: lb?.strikeMult ?? 1, // Push 9
    playerClassMod: cb?.strikeMod ?? 1,  // Push 11
    equipmentMod: equipFx.strikeMult,    // Push 10
  };
  const stabMods: SkillModifiers = {
    ...neutralModifiers(),
    clinicalMod: res.modifier,
    // Push 1 elemental independence: stabilize effects are system-neutral (systemMod = 1.0).
    // The element-based system bonus flows only through strikeMods; clinical effectiveness
    // for stabilize is carried by clinicalMod (appropriateness) + affinityFamilyMod (domain).
    systemMod: 1.0,
    castMult,
    corruptionMod: getStabilizationModifier(next.corruption),
    stabilityGainMod: getStabilityGainModifier(next.stability),
    enemyResistanceMod: stabilityResistanceMultiplier(next.enemy),
    cueBonusFlat: next.cueBonusStabilize,
    heroStatMod: heroStatMult,
    affinityFamilyMod: affinityFamilyMult,
    hiddenDefenseMod,                       // Push 7 (corruptionResistanceMod not applied to stabilize)
    leaderBonusMod: lb?.stabilizeMult ?? 1, // Push 9
    playerClassMod: cb?.stabilizeMod ?? 1,  // Push 11
    equipmentMod: equipFx.stabilizeMult,    // Push 10
  };
  // Shield modifier bag — guard stat always; affinity + hidden-defense apply here too.
  const shieldMods: SkillModifiers = {
    ...neutralModifiers(),
    heroStatMod: shieldStatMult,
    affinityFamilyMod: affinityFamilyMult,
    hiddenDefenseMod,                    // Push 7
    leaderBonusMod: lb?.shieldMult ?? 1, // Push 9
    playerClassMod: cb?.shieldMod ?? 1,  // Push 11
    equipmentMod: equipFx.shieldMult,    // Push 10
  };

  if (castQuality !== 'normal') {
    next.log = [...next.log, castQuality === 'perfect' ? '✨ Perfect Cast! Effect amplified.' : '⭐ Good Cast — effect boosted.'];
  }

  // Push 6: affinity family feedback — only log non-neutral events.
  if (affinityFamilyMult > 1.0) {
    next.log = [...next.log, '✅ Affinity advantage — effect increased.'];
  } else if (affinityFamilyMult < 1.0) {
    next.log = [...next.log, '⚠️ Weak affinity — effect reduced.'];
  }

  // Push 7: hidden-defense hint on the very first action of the battle.
  // Shows once only — tells the player Scout/Reassess will help.
  if (hiddenDefenseMod < 0.99 && s.turnsTaken === 0) {
    next.log = [...next.log, `🔍 Hidden pathology detected — Scout or Reassess to reveal clues and strengthen effects.`];
  }

  let effectAmount = 0;
  let effectType: 'corruption' | 'stability' | 'shield' | 'clue' | 'mixed' = 'mixed';

  if (skill.reveal) {
    // Push 11: Seer — extra hidden clues per scout; first scout of battle gets an additional bonus.
    let revealCount = skill.reveal;
    if ((cb?.scoutRevealBonus ?? 0) > 0 || (cb?.scoutFirstActionRevealBonus ?? 0) > 0) {
      revealCount += cb?.scoutRevealBonus ?? 0;
      if (!next.classFirstScoutUsed && (cb?.scoutFirstActionRevealBonus ?? 0) > 0) {
        revealCount += cb!.scoutFirstActionRevealBonus;
        next.log = [...next.log, `👁 Seer's Eye: first Scout of battle reveals an extra clue.`];
      }
      next.classFirstScoutUsed = true;
    }
    // Push 10: Culture Lens — extra clue per scout action.
    if (equipFx.scoutRevealBonus > 0) {
      revealCount += equipFx.scoutRevealBonus;
      next.log = [...next.log, `🔬 Culture Lens: +${equipFx.scoutRevealBonus} extra clue${equipFx.scoutRevealBonus > 1 ? 's' : ''} revealed.`];
    }
    next = revealHiddenClues(next, revealCount);
    effectType = 'clue';
  }
  if (skill.stabilize || skill.stabilizeRange) {
    const base = skill.stabilizeRange ? rollRange(skill.stabilizeRange) : skill.stabilize!;
    const amt = calcStabilizeEffect(base, stabMods);
    next.stability = clamp(next.stability + amt, 0, 100);
    effectAmount = Math.max(effectAmount, amt);
    effectType = effectType === 'clue' ? 'mixed' : 'stability';
    // Push 11: Caretaker — mark stabilize used so reassess combo can fire this turn.
    if ((cb?.reassessAfterStabilizeBonus ?? 0) > 0) next.classStabilizeUsedThisTurn = true;
  }
  if (skill.strike || skill.strikeRange) {
    const base = skill.strikeRange ? rollRange(skill.strikeRange) : skill.strike!;
    const rawAmt = calcStrikeEffect(base, strikeMods);
    // Push 7: bossGuard caps single-hit corruption reduction to 40% of current corruption.
    // Prevents one-turn burst deletion of bosses — sustained effort still wins.
    const bossMaxHit = s.enemy.bossGuard
      ? Math.max(1, Math.floor(next.corruption * 0.40))
      : rawAmt;
    const amt = Math.min(rawAmt, bossMaxHit);
    if (s.enemy.bossGuard && amt < rawAmt) {
      next.log = [...next.log, `🛡 ${s.enemy.name}'s resilience limits the impact — sustained treatment is required.`];
    }
    next.corruption = Math.max(0, next.corruption - amt);
    if (res.affinityResult.label) next.log.push(`${res.affinityResult.label}!`);
    // Push 2: Elemental Counter feedback — distinct log line when the element bonus fires.
    if (strikeMods.elementBonus > 0 && s.enemy.weakElement) {
      next.log = [...next.log, `⚡ ELEMENTAL COUNTER — ${hero.element} disrupts ${s.enemy.corruptionAspect}. Strike +30%.`];
    }
    effectAmount = Math.max(effectAmount, amt);
    effectType = effectType === 'clue' ? 'mixed' : (effectType === 'stability' ? 'mixed' : 'corruption');
    // Push 1 dev breakdown: log base value, each modifier, and final for strikes.
    if (_devModeSkill) {
      const eb = strikeMods.elementBonus > 0 ? ` elem=×${(1 + strikeMods.elementBonus).toFixed(2)}` : '';
      console.log(
        `[Strike] ${hero.name}→${skill.name} vs ${s.enemy.name}: ` +
        `base=${base}` +
        ` clinical=×${strikeMods.clinicalMod.toFixed(2)}` +
        ` system=×${strikeMods.systemMod.toFixed(2)}` +
        `${eb}` +
        ` affFam=×${strikeMods.affinityFamilyMod.toFixed(2)}` +
        ` stat=×${strikeMods.heroStatMod.toFixed(2)}` +
        ` resist=×${strikeMods.corruptionResistanceMod.toFixed(2)}` +
        ` → raw=${rawAmt} final=${amt}`,
      );
    }
  }
  if (skill.shield || skill.shieldRange) {
    const base = skill.shieldRange ? rollRange(skill.shieldRange) : skill.shield!;
    const amt = calcShieldEffect(base, shieldMods);
    next.shieldNext = Math.max(next.shieldNext, amt);
    effectAmount = Math.max(effectAmount, amt);
    effectType = effectType === 'mixed' ? 'mixed' : 'shield';
  }
  if (skill.blockSpread) {
    next.blockNextSpread = true;
    next.log.push(`🛡 Spread contained — the next spread attack is blocked.`);
  }
  if (skill.risk?.ifSystem && (skill.risk.ifSystem === s.enemy.primarySystem || skill.risk.ifSystem === s.enemy.secondarySystem)) {
    const pen = skill.risk.penalty || 15;
    next.stability = clamp(next.stability - pen, 0, 100);
    next.unsafeActionsUsed = next.unsafeActionsUsed + 1;
    next.log.push(`⚠ Risk triggered: ${skill.risk.description} (-${pen}%)`);
  }

  // Track reassess (NM-01: resolve via pathwayRoles with legacy fallback)
  const skillResolvedRoles = action?.pathwayRoles ?? normalizePathwayRoles(action?.chainRoles ?? []);
  if (skillResolvedRoles.includes('reassess')) {
    next.reassessUsed = true;
    next.reassessUsedAnytime = true;
    next.reboundArmed = false;
    // Push 11: Caretaker — bonus stability when Reassess follows a Stabilize action this turn.
    const reassessStabBonus = s.classStabilizeUsedThisTurn ? (cb?.reassessAfterStabilizeBonus ?? 0) : 0;
    if (reassessStabBonus > 0) {
      const adjusted = Math.round(reassessStabBonus * getStabilityGainModifier(next.stability) * stabilityResistanceMultiplier(next.enemy));
      next.stability = clamp(next.stability + adjusted, 0, 100);
      next.log = [...next.log, `💚 Caretaker's Rhythm: Reassess after Stabilize +${adjusted} Stability.`];
    }
  }

  // Rebound arming when corruption drops below 40
  if (next.corruption < 40 && s.corruption >= 40 && !next.reassessUsed) {
    next.reboundArmed = true;
  }

  // Build message
  const msg = generateBattleMessage({
    feedbackLevel: next.feedbackLevel,
    actionName: skill.name,
    status: res.status,
    systemModifier: res.systemModifier,
    effectAmount,
    effectType,
    chainAdvanced: res.chainAdvanced,
    nextChainStep: (() => { const r = next.enemyClinical?.treatmentChain[next.chain.progress.length]; return r ? (normalizePathwayRoles([r])[0] ?? null) : null; })(),
    fullChainCompleted: next.fullChainCompleted,
    rationale: res.rationale,
  });
  if (msg) next.log.push(msg);

  // Push 8: brief modifier-feedback notes appended after the primary outcome line.
  // Only fires for non-expert feedback levels — experts read numbers directly.
  // Thresholds prevent noise on tutorial/Ch.1 enemies (0–4% resistance).
  if (next.feedbackLevel !== 'expert') {
    // Enemy resistance (significant ≥5% reduction on strike effects)
    if ((s.enemy.corruptionResistance ?? 0) >= 0.05 && (skill.strike || skill.strikeRange)) {
      next.log.push('Enemy resistance reduced the effect.');
    }
    // Hidden-pathology defense (significant ≥5% active reduction, not already shown on turn 0)
    const activeHiddenDef = (s.enemy.hiddenDefense ?? 0) * hiddenFraction;
    if (activeHiddenDef >= 0.05 && s.turnsTaken > 0) {
      next.log.push('Hidden pathology softened the result.');
    }
  }

  next = addUltimateCharge(next, hero.id, res.chainAdvanced ? 20 : 12);
  next = addContribution(next, hero.id, effectAmount + cost * 2);
  next = syncWaveAndCheckVictory(next);

  return { state: next, message: msg || `${skill.name} resolved.`, status: res.status };
}

export function useItem(s: BattleState, item: Item): ApplyResult {
  if (s.outcome !== 'ongoing') return { state: s, message: 'Battle is over.', aborted: true };

  // Require a selected hero who is ready
  const heroId = s.selectedHeroId;
  if (!heroId) return { state: s, message: 'Select a hero to use this item.', aborted: true };
  if (s.heroActionsUsed[heroId]) {
    const hero = s.team.find(h => h.id === heroId);
    return { state: s, message: `${hero?.name || 'That hero'} has already acted this turn.`, aborted: true };
  }
  const hero = s.team.find(h => h.id === heroId);

  // Item cost with prepared-pharmacy discount
  let cost = item.costAP;
  if (s.preparedItemDiscount === item.name) cost = Math.max(1, cost - 1);
  if (s.ap < cost) return { state: s, message: 'Not enough AP.', aborted: true };

  const qty = s.inventory[item.name] || 0;
  if (qty <= 0) return { state: s, message: `${item.name} is not available.`, aborted: true };

  const action = ITEM_CLINICAL[item.name];
  const systemType = item.systemType || 'Universal';
  const res = resolveAction(action, systemType, s);

  const { state: post, aborted } = applyResolutionToState(s, res, item.displayName);
  if (aborted) return { state: post, message: `${item.displayName} is locked.`, status: 'locked', aborted: true };

  let next: BattleState = consumeHeroAction({
    ...post,
    ap: s.ap - cost,
    inventory: { ...s.inventory, [item.name]: qty - 1 },
    turnsTaken: post.turnsTaken + 1,
    log: [...post.log, `${hero?.name || 'Hero'} used ${item.displayName}.`],
  }, heroId);

  // Build modifier bags for item use (no castMult for items — no cast prompt).
  const corrOutcome = getCorruptionOutcome(res.status);
  // Push 9: item mult from Leader (slot 0). Same mult applied to both bags.
  const itemLb = s.team[0] ? scaleLeaderBonus(getLeaderBonus(s.team[0]), s.team[0]) : null;
  const itemCb = s.classBonus; // Push 11
  // Push 10: Apothecary Seal — highest itemMult across the whole team applies.
  const teamItemMult = Math.max(1, ...s.team.map(h => s.heroEquipmentEffects[h.id]?.itemMult ?? 1));
  const itemStrikeMods: SkillModifiers = {
    ...neutralModifiers(),
    clinicalMod: corrOutcome.reductionMult,
    systemMod: res.systemModifier,
    chapterMod: getTreatmentStabilityModifier(next.stability),
    affinityMod: res.affinityResult.multiplier,
    // no elementBonus — items are system-neutral tools
    leaderBonusMod: itemLb?.itemMult ?? 1, // Push 9
    playerClassMod: itemCb?.itemMod ?? 1,  // Push 11
    equipmentMod: teamItemMult,             // Push 10
  };
  const itemStabMods: SkillModifiers = {
    ...neutralModifiers(),
    clinicalMod: res.modifier,
    systemMod: 1.0, // elemental independence: items stabilize via clinical tags, not element-system match
    corruptionMod: getStabilizationModifier(next.corruption),
    stabilityGainMod: getStabilityGainModifier(next.stability),
    enemyResistanceMod: stabilityResistanceMultiplier(next.enemy),
    cueBonusFlat: next.cueBonusStabilize,
    leaderBonusMod: itemLb?.itemMult ?? 1, // Push 9
    playerClassMod: itemCb?.itemMod ?? 1,  // Push 11
    equipmentMod: teamItemMult,             // Push 10
  };

  let effectAmount = 0;
  let effectType: 'corruption' | 'stability' | 'shield' | 'clue' | 'mixed' = 'mixed';

  if (item.target === 'corruption') {
    const amt = calcStrikeEffect(item.baseEffect, itemStrikeMods);
    next.corruption = Math.max(0, next.corruption - amt);
    if (res.affinityResult.label) next.log.push(`${res.affinityResult.label}!`);
    effectAmount = amt; effectType = 'corruption';
  }
  if (item.target === 'stability') {
    const amt = calcStabilizeEffect(item.baseEffect, itemStabMods);
    next.stability = clamp(next.stability + amt, 0, 100);
    effectAmount = amt; effectType = 'stability';
  }
  if (item.target === 'shield') {
    const amt = calcShieldEffect(item.baseEffect, neutralModifiers());
    next.shieldNext = Math.max(next.shieldNext, amt);
    effectAmount = amt; effectType = 'shield';
  }
  if (item.target === 'clue') {
    next = revealHiddenClues(next, 1);
    effectType = 'clue';
  }

  // NM-01: resolve via pathwayRoles with legacy fallback
  const itemResolvedRoles = action?.pathwayRoles ?? normalizePathwayRoles(action?.chainRoles ?? []);
  if (itemResolvedRoles.includes('reassess')) {
    next.reassessUsed = true;
    next.reassessUsedAnytime = true;
    next.reboundArmed = false;
  }

  if (next.corruption < 40 && s.corruption >= 40 && !next.reassessUsed) next.reboundArmed = true;

  const msg = generateBattleMessage({
    feedbackLevel: next.feedbackLevel,
    actionName: item.displayName,
    status: res.status,
    systemModifier: res.systemModifier,
    effectAmount,
    effectType,
    chainAdvanced: res.chainAdvanced,
    nextChainStep: (() => { const r = next.enemyClinical?.treatmentChain[next.chain.progress.length]; return r ? (normalizePathwayRoles([r])[0] ?? null) : null; })(),
    fullChainCompleted: next.fullChainCompleted,
    rationale: res.rationale,
  });
  if (msg) next.log.push(msg);

  next = addUltimateCharge(next, hero?.id || heroId, res.chainAdvanced ? 18 : 10);
  next = addContribution(next, hero?.id || heroId, effectAmount + cost * 2);
  next = syncWaveAndCheckVictory(next);
  return { state: next, message: msg, status: res.status };
}

export function applyTempAction(s: BattleState, actionId: string): ApplyResult {
  const a = TEMP_ACTIONS[actionId];
  if (!a) return { state: s, message: 'Action not available.', aborted: true };
  if (s.outcome !== 'ongoing') return { state: s, message: 'Battle is over.', aborted: true };
  if (s.ap < a.costAP) return { state: s, message: 'Not enough AP.', aborted: true };
  const heroId = s.selectedHeroId;
  if (!heroId) return { state: s, message: 'Select a hero to perform this action.', aborted: true };
  if (s.heroActionsUsed[heroId]) {
    const hero = s.team.find(h => h.id === heroId);
    return { state: s, message: `${hero?.name || 'That hero'} has already acted this turn.`, aborted: true };
  }
  const hero = s.team.find(h => h.id === heroId);

  const action = TEMP_CLINICAL[actionId];
  const res = resolveAction(action, 'Universal', s);

  const { state: post, aborted } = applyResolutionToState(s, res, a.name);
  if (aborted) return { state: post, message: `${a.name} is locked.`, status: 'locked', aborted: true };

  let next: BattleState = consumeHeroAction({ ...post, ap: s.ap - a.costAP, turnsTaken: post.turnsTaken + 1, log: [...post.log, `${hero?.name || 'Hero'} → ${a.name}.`] }, heroId);
  // No castMult or chapterMod for temp actions (no cast prompt; chapter modifier
  // was not applied to temp-action strikes historically — preserved here).
  if (a.stabilize) {
    const taMods: SkillModifiers = {
      ...neutralModifiers(),
      clinicalMod: res.modifier,
      systemMod: 1.0, // elemental independence: temp actions stabilize via clinical tags, not element-system match
      corruptionMod: getStabilizationModifier(next.corruption),
      stabilityGainMod: getStabilityGainModifier(next.stability),
      enemyResistanceMod: stabilityResistanceMultiplier(next.enemy),
      cueBonusFlat: next.cueBonusStabilize,
    };
    const amt = calcStabilizeEffect(a.stabilize, taMods);
    next.stability = clamp(next.stability + amt, 0, 100);
  }
  if (a.strike) {
    const corrOutcome = getCorruptionOutcome(res.status);
    const taStrikeMods: SkillModifiers = {
      ...neutralModifiers(),
      clinicalMod: corrOutcome.reductionMult,
      systemMod: res.systemModifier,
      affinityMod: res.affinityResult.multiplier,
    };
    const amt = calcStrikeEffect(a.strike, taStrikeMods);
    next.corruption = Math.max(0, next.corruption - amt);
    if (res.affinityResult.label) next.log.push(`${res.affinityResult.label}!`);
  }
  if (a.shield) next.shieldNext = Math.max(next.shieldNext, calcShieldEffect(a.shield, neutralModifiers()));
  next = addUltimateCharge(next, heroId, 8);
  next = addContribution(next, heroId, Math.max(a.stabilize || 0, a.strike || 0, a.shield || 0) + a.costAP * 2);
  next = syncWaveAndCheckVictory(next);
  return { state: next, message: `${a.name} resolved.`, status: res.status };
}

// ============================================================
// Active skill cards (hand/tray)
// ============================================================

export function applyCard(s: BattleState, cardId: string): ApplyResult {
  if (s.outcome !== 'ongoing') return { state: s, message: 'Battle is over.', aborted: true };
  if (!s.hand.includes(cardId)) return { state: s, message: 'That card is not in hand.', aborted: true };
  const card = getCard(cardId);
  if (!card) return { state: s, message: 'Card not found.', aborted: true };
  if (s.ap < card.costAP) return { state: s, message: 'Not enough AP.', aborted: true };
  const heroId = s.selectedHeroId;
  if (!heroId) return { state: s, message: 'Select a hero to play this card.', aborted: true };
  if (s.heroActionsUsed[heroId]) {
    const hero = s.team.find(h => h.id === heroId);
    return { state: s, message: `${hero?.name || 'That hero'} has already acted this turn.`, aborted: true };
  }
  const hero = s.team.find(h => h.id === heroId);

  const action = CARD_CLINICAL[cardId];
  const res = resolveAction(action, card.systemType, s);

  const { state: post, aborted } = applyResolutionToState(s, res, card.name);
  if (aborted) return { state: post, message: `${card.name} is locked.`, status: 'locked', aborted: true };

  const handAfterPlay = post.hand.filter((id, idx) => !(id === cardId && idx === post.hand.indexOf(cardId)));

  // P8 — limited-use vs. legacy draw:
  // · limitedCardMode: draw from pre-loaded deck; if exhausted hand shrinks (no random fill).
  // · legacy (limitedCardMode=false): randomly redraw to keep 3 cards in hand.
  let newHand: string[];
  let newDeck: string[];
  if (post.limitedCardMode) {
    if (post.cardDeck.length > 0) {
      newHand = [...handAfterPlay, post.cardDeck[0]];
      newDeck = post.cardDeck.slice(1);
    } else {
      newHand = handAfterPlay; // hand shrinks — this card is gone for this battle
      newDeck = [];
    }
  } else {
    const [redrawn] = drawCards(1, handAfterPlay);
    newHand = [...handAfterPlay, redrawn];
    newDeck = [];
  }

  let next: BattleState = consumeHeroAction({
    ...post,
    ap: post.ap - card.costAP,
    turnsTaken: post.turnsTaken + 1,
    hand: newHand,
    cardDeck: newDeck,
    log: [...post.log, `${hero?.name || 'Hero'} plays ${card.name}.`],
  }, heroId);

  // Build modifier bags for card play (no castMult or chapterMod — historically
  // cards did not apply either, so we preserve that pipeline here).
  const corrOutcome = getCorruptionOutcome(res.status);
  // Push 9: card mult from Leader (slot 0).
  const cardLb = s.team[0] ? scaleLeaderBonus(getLeaderBonus(s.team[0]), s.team[0]) : null;
  const cardCb = s.classBonus; // Push 11
  // Push 10: Apothecary Seal — highest cardMult across the whole team applies.
  const teamCardMult = Math.max(1, ...s.team.map(h => s.heroEquipmentEffects[h.id]?.cardMult ?? 1));
  const cardStrikeMods: SkillModifiers = {
    ...neutralModifiers(),
    clinicalMod: corrOutcome.reductionMult,
    systemMod: res.systemModifier,
    affinityMod: res.affinityResult.multiplier,
    leaderBonusMod: cardLb?.cardMult ?? 1,  // Push 9
    playerClassMod: cardCb?.strikeMod ?? 1, // Push 11
    equipmentMod: teamCardMult,              // Push 10
  };
  const cardStabMods: SkillModifiers = {
    ...neutralModifiers(),
    clinicalMod: res.modifier,
    systemMod: 1.0, // elemental independence: cards stabilize via clinical tags, not element-system match
    corruptionMod: getStabilizationModifier(next.corruption),
    stabilityGainMod: getStabilityGainModifier(next.stability),
    enemyResistanceMod: stabilityResistanceMultiplier(next.enemy),
    cueBonusFlat: next.cueBonusStabilize,
    leaderBonusMod: cardLb?.cardMult ?? 1,    // Push 9
    playerClassMod: cardCb?.stabilizeMod ?? 1, // Push 11
    equipmentMod: teamCardMult,                // Push 10
  };

  let effectAmount = 0;
  let effectType: 'corruption' | 'stability' | 'shield' | 'clue' | 'mixed' = 'mixed';

  if (card.reveal) { next = revealHiddenClues(next, card.reveal); next.reboundArmed = false; effectType = 'clue'; }
  if (card.stabilize) {
    const amt = calcStabilizeEffect(card.stabilize, cardStabMods);
    next.stability = clamp(next.stability + amt, 0, 100);
    effectAmount = amt; effectType = effectType === 'clue' ? 'mixed' : 'stability';
  }
  if (card.strike) {
    const amt = calcStrikeEffect(card.strike, cardStrikeMods);
    next.corruption = Math.max(0, next.corruption - amt);
    if (res.affinityResult.label) next.log.push(`${res.affinityResult.label}!`);
    effectAmount = Math.max(effectAmount, amt); effectType = effectType === 'stability' || effectType === 'clue' ? 'mixed' : 'corruption';
  }
  if (card.shield) {
    const amt = calcShieldEffect(card.shield, neutralModifiers());
    next.shieldNext = Math.max(next.shieldNext, amt);
    effectAmount = Math.max(effectAmount, amt); effectType = effectType === 'mixed' ? 'mixed' : 'shield';
  }

  // NM-01: resolve via pathwayRoles with legacy fallback
  const cardResolvedRoles = action?.pathwayRoles ?? normalizePathwayRoles(action?.chainRoles ?? []);
  if (cardResolvedRoles.includes('reassess')) {
    next.reassessUsed = true;
    next.reassessUsedAnytime = true;
    next.reboundArmed = false;
  }

  const msg = generateBattleMessage({
    feedbackLevel: next.feedbackLevel,
    actionName: card.name,
    status: res.status,
    systemModifier: res.systemModifier,
    effectAmount,
    effectType,
    chainAdvanced: res.chainAdvanced,
    nextChainStep: (() => { const r = next.enemyClinical?.treatmentChain[next.chain.progress.length]; return r ? (normalizePathwayRoles([r])[0] ?? null) : null; })(),
    fullChainCompleted: next.fullChainCompleted,
    rationale: res.rationale,
  });
  if (msg) next.log.push(msg);

  next = addUltimateCharge(next, heroId, res.chainAdvanced ? 16 : 9);
  next = addContribution(next, heroId, effectAmount + card.costAP * 2);
  next = syncWaveAndCheckVictory(next);
  return { state: next, message: msg || `${card.name} resolved.`, status: res.status };
}

// ============================================================
// Question-to-power (Clinical Cue)
// ============================================================

// Small, topic-flavored bonus layered on top of the universal correct-answer reward.
// Reuses existing BattleState mechanics only — no new gameplay systems introduced.
function applyCueTopicBonus(s: BattleState, topic: ClinicalCueQuestion['topic']): { state: BattleState; label: string } {
  switch (topic) {
    case 'oxygen_breathing':
    case 'heart_circulation':
      return {
        state: { ...s, cueBonusStabilize: s.cueBonusStabilize + 4 },
        label: 'stabilizing actions further empowered this turn',
      };
    case 'assessment_reassessment': {
      const next = revealHiddenClues(s, 1);
      return { state: next, label: next.hiddenClueIds.length < s.hiddenClueIds.length ? 'a hidden clue revealed' : 'no hidden clues left to reveal' };
    }
    case 'infection_inflammation':
    case 'medication_safety':
      return {
        state: { ...s, corruption: Math.max(0, s.corruption - 3) },
        label: '-3 Corruption',
      };
    case 'nutrition_wellness':
    case 'blood_sugar_energy':
      return {
        state: { ...s, stability: clamp(s.stability + 5, 0, 100) },
        label: '+5 Stability',
      };
    case 'brain_stress_sleep':
      return {
        state: { ...s, shieldNext: Math.max(s.shieldNext, s.shieldNext + 10) },
        label: '+10 Shield',
      };
    case 'hydration_kidneys':
    default:
      return { state: s, label: '' };
  }
}

export function answerClinicalCue(s: BattleState, optionIndex: number): ApplyResult {
  const cue = s.pendingCue;
  if (!cue) return { state: s, message: 'No question pending.', aborted: true };
  const option = cue.options[optionIndex];
  const cuesAnswered = [...s.cuesAnswered, cue.id];
  if (!option) return { state: { ...s, pendingCue: null, cuesAnswered }, message: 'No answer selected.', aborted: true };

  if (option.correct) {
    const heroId = s.selectedHeroId;
    let next: BattleState = {
      ...s,
      pendingCue: null,
      cuesAnswered,
      cueBonusStabilize: s.cueBonusStabilize + 8 + (s.classBonus?.cueBonusFlatBonus ?? 0),
      cuesTopicsCorrect: [...s.cuesTopicsCorrect, cue.topic],
      // Bonus AP stacks ABOVE the normal per-turn limit (hard-capped to avoid runaway).
      ap: Math.min(s.ap + 1, AP_BONUS_CEILING),
    };
    next = addUltimateCharge(next, heroId, 15);
    const { state: withBonus, label } = applyCueTopicBonus(next, cue.topic);
    next = withBonus;
    // Push 9: Analyst leader bonus — first correct Cue this battle grants extra AP.
    // Check s.cuesTopicsCorrect (original state, BEFORE this update) so it fires once only.
    const cueLb = s.team[0] ? getLeaderBonus(s.team[0]) : null;
    const cueLeaderAp = (cueLb?.cueCorrectApBonus ?? 0) > 0 && s.cuesTopicsCorrect.length === 0
      ? cueLb!.cueCorrectApBonus
      : 0;
    if (cueLeaderAp > 0) {
      next = { ...next, ap: Math.min(next.ap + cueLeaderAp, AP_BONUS_CEILING) };
    }
    const bonusLog = label ? `, ${label}` : '';
    const leaderCueLog = cueLeaderAp > 0 ? `, +${cueLeaderAp} AP (Leader bonus)` : '';
    const cueBonusClassFlat = s.classBonus?.cueBonusFlatBonus ?? 0;
    const classCueLog = cueBonusClassFlat > 0 ? `, Scholar empowerment +${cueBonusClassFlat}` : '';
    next = { ...next, log: [...next.log, `✅ Clinical Cue correct: ${cue.rationale} (+1 bonus AP above the limit, all stabilizing actions this turn empowered${bonusLog}${leaderCueLog}${classCueLog})`] };
    return { state: next, message: 'Correct! +1 AP and a power boost.', status: 'appropriate' };
  }

  const next: BattleState = {
    ...s,
    pendingCue: null,
    cuesAnswered,
    log: [...s.log, `❌ Clinical Cue missed: ${cue.rationale}`],
  };
  return { state: next, message: 'Not quite — no bonus this time.', status: 'weak' };
}

/** Random gap (2–4 turns) between Clinical Cue presentations. */
function rollCueGap(): number {
  return 2 + Math.floor(Math.random() * 3);
}

export function maybeTriggerClinicalCue(s: BattleState): BattleState {
  if (s.pendingCue) return s;
  if (s.cuesAnswered.length >= 4) return s;
  const isBoss = (s.enemyClinical?.rewardBase || 0) >= 100;
  const topicHint = SYSTEM_TO_CUE_TOPIC[s.enemy.primarySystem];
  return {
    ...s,
    pendingCue: getRandomClinicalCue(s.cuesAnswered, { chapter: s.chapter, isBoss, topicHint }),
    nextCueTurn: s.turn + rollCueGap(),
  };
}

// Push 10: Thin wrapper that post-processes every non-aborted, non-inappropriate
// call result to apply Field Coordinator Badge AP bonus without touching all 10+
// early-return paths inside the core logic.
export function applyCall(s: BattleState, option: CallOption, addedItemName?: string): ApplyResult {
  const result = _applyCallCore(s, option, addedItemName);
  if (!result.aborted && result.status !== 'inappropriate' && result.status !== 'locked') {
    const maxBonus = Math.max(0, ...result.state.team.map(h => result.state.heroEquipmentEffects[h.id]?.callForHelpBonus ?? 0));
    if (maxBonus > 0) {
      return {
        ...result,
        state: {
          ...result.state,
          ap: Math.min(result.state.ap + maxBonus, AP_BONUS_CEILING),
          log: [...result.state.log, `🏅 Field Coordinator Badge: +${maxBonus} AP from successful call.`],
        },
      };
    }
  }
  return result;
}

function _applyCallCore(s: BattleState, option: CallOption, addedItemName?: string): ApplyResult {
  const callKey: keyof BattleState['callsUsed'] | null =
    option.id === 'call_pharmacy' ? 'pharmacy' :
    option.id === 'call_respiratory' ? 'respiratory' :
    option.id === 'call_rapid' ? 'rapidResponse' :
    option.id === 'call_infection' ? 'infectionControl' :
    option.id === 'call_lab' ? 'lab' :
    option.id === 'call_rehab' ? 'rehab' :
    option.id === 'call_social' ? 'social' : null;

  if (callKey && s.callsUsed[callKey]) {
    return { state: s, message: `${option.name} has already been called this battle.`, aborted: true };
  }
  if (s.callHelpRemaining <= 0) {
    return { state: s, message: 'No calls remaining this battle.', aborted: true };
  }
  if (s.ap < option.costAP) return { state: s, message: `Not enough AP (needs ${option.costAP}).`, aborted: true };

  // Rapid Response hard-gate
  if (option.id === 'call_rapid' && s.stability > 30 && !s.dangerTriggerActive) {
    return { state: s, message: 'Rapid Response is reserved for crashing patients (Stability ≤ 30).', aborted: true };
  }

  const action = CALL_CLINICAL[option.id];
  const res = resolveAction(action, 'Universal', s);

  const { state: post, aborted } = applyResolutionToState(s, res, option.name);
  if (aborted) return { state: post, message: `${option.name} is locked.`, status: 'locked', aborted: true };

  // Calls do NOT consume a hero action — but they DO count toward consultsUsed
  let next: BattleState = {
    ...post,
    ap: s.ap - option.costAP,
    callUsed: true,
    callsUsed: callKey ? { ...s.callsUsed, [callKey]: true } : s.callsUsed,
    callHelpRemaining: Math.max(0, s.callHelpRemaining - 1),
    consultsUsed: post.consultsUsed + 1,
    log: [...post.log, `📞 ${option.name} (−${option.costAP} AP).`],
  };

  const revealedLower = next.revealedLabels.map(l => l.toLowerCase());
  const hasRespClue = revealedLower.some(l => /wheez|o2|tripod|breathing fast/.test(l));
  const hasInfectionClue = revealedLower.some(l => /redness|infection|fever|wound/.test(l));

  if (option.id === 'call_pharmacy') {
    if (next.revealedLabels.length === 0) {
      // No clinical data yet — Pharmacy can only hand over a generic Lab Sigil/Token
      const fallback = 'Lab Token';
      next.inventory = { ...next.inventory, [fallback]: (next.inventory[fallback] || 0) + 1 };
      next.log.push(`Pharmacy needs more assessment data. ${fallback} added instead.`);
      return { state: next, message: 'Pharmacy needs assessment first.', status: res.status };
    }

    let itemKey = 'Lab Token';
    if (revealedLower.some(l => l.includes('wheez'))) itemKey = 'Albuterol Mist';
    else if (revealedLower.some(l => l.includes('glucose'))) itemKey = 'Glucose Gel';
    else if (revealedLower.some(l => /bp|blood pressure/.test(l))) itemKey = 'Fluid Bolus';
    else if (s.enemy.primarySystem === 'Fire' || (s.enemyClinical?.diseaseTags || []).some(t => /infection|spread/.test(t))) itemKey = 'Isolation Kit';
    else if (s.enemy.primarySystem === 'Air') itemKey = 'Albuterol Mist';
    else if (s.enemy.primarySystem === 'Energy') itemKey = 'Glucose Gel';
    else if (s.enemy.primarySystem === 'River') itemKey = 'Fluid Bolus';

    next.inventory = { ...next.inventory, [itemKey]: (next.inventory[itemKey] || 0) + 1 };
    next.preparedItemDiscount = itemKey;
    const display = ITEMS.find(i => i.name === itemKey)?.displayName || itemKey;
    next.log.push(`Pharmacy prepared ${display}. Costs 1 less AP this battle.`);
    return { state: next, message: `Pharmacy prepared ${display}.`, status: res.status };
  }

  if (option.id === 'call_respiratory') {
    const appropriate = s.enemy.primarySystem === 'Air' || hasRespClue;
    if (!appropriate) {
      next.inappropriateConsultsUsed = next.inappropriateConsultsUsed + 1;
      next.log.push(`Respiratory Support does not fit the current clues. Limited benefit.`);
      return { state: next, message: 'Inappropriate consult — limited benefit.', status: 'inappropriate' };
    }
    // Unlock Assisted Airflow (open_airflow) — do NOT also discount Air actions
    if (option.actionId && !next.temporaryActionIds.includes(option.actionId)) {
      next.temporaryActionIds = [...next.temporaryActionIds, option.actionId];
    }
    next.log.push(`Respiratory Support joins. Assisted Airflow is available this battle.`);
    return { state: next, message: 'Respiratory support engaged.', status: res.status };
  }

  if (option.id === 'call_rapid') {
    next.shieldNext = Math.max(next.shieldNext, 100);
    next.stability = clamp(next.stability + 15, 0, 100);
    next.rapidResponseActive = true;
    next.emergencyCallsUsed = next.emergencyCallsUsed + 1;
    next.log.push(`Rapid Response stabilized the crisis. Stability +15, next attack blocked.`);
    return { state: next, message: 'Rapid Response stabilized the crisis.', status: res.status };
  }

  if (option.id === 'call_infection') {
    const appropriate = s.enemy.primarySystem === 'Fire'
      || (s.enemyClinical?.diseaseTags || []).some(t => /infection|spread/.test(t))
      || hasInfectionClue;
    if (!appropriate) {
      next.inappropriateConsultsUsed = next.inappropriateConsultsUsed + 1;
      next.log.push(`Infection Control does not match the current problem. Limited benefit.`);
      return { state: next, message: 'Inappropriate consult — limited benefit.', status: 'inappropriate' };
    }
    if (option.actionId && !next.temporaryActionIds.includes(option.actionId)) {
      next.temporaryActionIds = [...next.temporaryActionIds, option.actionId];
    }
    next.blockNextSpread = true;
    next.log.push(`Infection Control joins. Isolation Seal available, next spread blocked.`);
    return { state: next, message: 'Infection Control engaged.', status: res.status };
  }

  // P9 new family-specific calls ─────────────────────────────────────────────

  if (option.id === 'call_lab') {
    // Reveal one random hidden clue (if any exist), then add a Lab Token
    const revealed = next.hiddenClueIds.length > 0;
    if (revealed) {
      const revealId = next.hiddenClueIds[0];
      const revealedClue = [...next.enemy.visibleClues, ...next.enemy.hiddenClues].find(c => c.id === revealId);
      next.hiddenClueIds = next.hiddenClueIds.slice(1);
      next.visibleClues = [...next.visibleClues, revealId];
      if (revealedClue) {
        next.revealedLabels = [...next.revealedLabels, revealedClue.label];
        next.log.push(`Lab & Imaging revealed: ${revealedClue.label}.`);
      }
    } else {
      next.log.push(`Lab & Imaging found no new hidden findings.`);
    }
    const token = 'Lab Token';
    next.inventory = { ...next.inventory, [token]: (next.inventory[token] || 0) + 1 };
    next.log.push(`Lab Token added to inventory.`);
    const detail = revealed
      ? `Diagnostic clue revealed + Lab Token added.`
      : `No hidden clues remain. Lab Token added as fallback.`;
    return { state: next, message: detail, status: res.status };
  }

  if (option.id === 'call_rehab') {
    if (!next.temporaryActionIds.includes('mobility_aid')) {
      next.temporaryActionIds = [...next.temporaryActionIds, 'mobility_aid'];
    }
    next.log.push(`Rehab Consult joins. Mobility Aid is available this battle.`);
    return { state: next, message: 'Rehab support engaged. Mobility Aid unlocked.', status: res.status };
  }

  if (option.id === 'call_social') {
    if (!next.temporaryActionIds.includes('systems_consult')) {
      next.temporaryActionIds = [...next.temporaryActionIds, 'systems_consult'];
    }
    next.log.push(`Systems Support joins. Systems Consultation is available this battle.`);
    return { state: next, message: 'Systems support engaged. Systems Consultation unlocked.', status: res.status };
  }

  // Legacy fallbacks
  if (option.effect === 'unlockAction' && option.actionId) {
    next.temporaryActionIds = [...next.temporaryActionIds, option.actionId];
    return { state: next, message: 'Support unlocked.', status: res.status };
  }
  if (option.effect === 'addRelevantItem' && addedItemName) {
    next.inventory = { ...next.inventory, [addedItemName]: (next.inventory[addedItemName] || 0) + 1 };
    return { state: next, message: `Added ${addedItemName}.`, status: res.status };
  }
  return { state: next, message: 'Support called.', status: res.status };
}

// ============================================================
// Enemy signature attacks — each disease-spirit strikes its own way
// ============================================================
export type EnemyAttackKind = 'assault' | 'spread' | 'hex';

export interface EnemySignatureAttack {
  name: string;
  kind: EnemyAttackKind;
}

// assault → raw stability damage (full).
// spread  → trades half the stability damage for spreading corruption back.
// hex     → trades half the stability damage for hampering next-turn actions.
const SIGNATURE_ATTACKS: Record<ElementSystem, EnemySignatureAttack> = {
  Air: { name: 'Bronchial Clamp', kind: 'assault' },
  River: { name: 'Arrhythmic Surge', kind: 'assault' },
  Fire: { name: 'Fever Bloom', kind: 'spread' },
  Energy: { name: 'Glucose Crash', kind: 'hex' },
  Storm: { name: 'Nerve Static', kind: 'hex' },
  Mind: { name: 'Fog of Confusion', kind: 'hex' },
  Filter: { name: 'Fluid Overload', kind: 'assault' },
  Forge: { name: 'Bone Grind', kind: 'assault' },
  Protection: { name: 'Immune Collapse', kind: 'spread' },
  Growth: { name: 'Malignant Bloom', kind: 'spread' },
};

const SPREAD_CORRUPTION_REGROW = 5;

export function getEnemySignatureAttack(enemy: Enemy): EnemySignatureAttack {
  if (enemy.id === 'lord_imbalance') return { name: 'Cascade of Imbalance', kind: 'spread' };
  return SIGNATURE_ATTACKS[enemy.primarySystem] ?? { name: 'Corrupting Surge', kind: 'assault' };
}

export function endPlayerTurn(s: BattleState): BattleState {
  if (s.outcome !== 'ongoing') return s;
  const log = [...s.log];

  // Enemy turn — shielded by Rapid Response or shieldNext.
  // Corruption's grip on stability scales with chapter + difficulty mode (soft in Ch.1, harsh on Chaos).
  const rawBaseDmg = getEnemyDamage(s.corruption, s.enemy.instability, getCorruptionPenaltyScale(s.chapter, s.difficulty));
  // Push 7: stabilityPressure amplifies enemy instability damage.
  // 0.0 (tutorial) → no change. 0.15 (boss) → +15% pressure per enemy turn.
  const pressureMult = 1 + (s.enemy.stabilityPressure ?? 0);
  const baseDmg = pressureMult > 1.001 ? Math.ceil(rawBaseDmg * pressureMult) : rawBaseDmg;
  const damageMultiplier = getChapterForgiveness(s.chapter).enemyDamageMultiplier;
  const waveMultiplier = getWaveDamageMultiplier(s.wave);
  const reductionAfterShield = Math.floor(baseDmg * (1 - s.shieldNext / 100) * damageMultiplier * waveMultiplier);
  let reduced = Math.max(0, reductionAfterShield - s.enemyDamageReduction);
  // Push 11: Guardian — reduces incoming Instability by a class-tier percentage.
  const classGuardianReduction = s.classBonus?.incomingDamageReduction ?? 0;
  if (classGuardianReduction > 0) reduced = Math.max(0, Math.floor(reduced * (1 - classGuardianReduction)));
  // Push 10: Triage Sash — blocks a fraction of the FIRST enemy attack's stability damage this battle.
  let equipFirstLossUsed = s.equipFirstLossUsed;
  if (!equipFirstLossUsed && reduced > 0) {
    const maxSashReduction = Math.max(0, ...s.team.map(h => s.heroEquipmentEffects[h.id]?.firstStabilityLossReduction ?? 0));
    if (maxSashReduction > 0) {
      const mitigated = Math.floor(reduced * maxSashReduction);
      if (mitigated > 0) {
        reduced = Math.max(0, reduced - mitigated);
        equipFirstLossUsed = true;
        log.push(`🏥 Triage Sash absorbed ${mitigated} Stability damage (${Math.round(maxSashReduction * 100)}% of the opening blow).`);
      }
    }
  }

  // Companion affliction pressure — wisps/spikes still alive in the wave drain stability every turn
  const wavePressure = getWaveBehaviorPressure(s.wave);
  reduced += wavePressure.stabilityDrain;
  log.push(...wavePressure.log);

  // Rebound: corruption dropped below 40 without reassess this turn
  if (s.reboundArmed && !s.reassessUsed) {
    reduced = reduced + 10;
    log.push(`⚠ Rebound Bronchospasm: the disease surges back. Stability and Corruption worsen.`);
  }

  // ── Signature attack: shape the enemy turn by the spirit's nature ──
  const attack = getEnemySignatureAttack(s.enemy);
  let corruptionRegrow = 0;
  let apPenalty = 0;
  let spreadBlocked = false;
  if (attack.kind === 'spread') {
    reduced = Math.ceil(reduced * 0.5);
    if (s.blockNextSpread) {
      spreadBlocked = true;
    } else {
      corruptionRegrow = SPREAD_CORRUPTION_REGROW;
    }
  } else if (attack.kind === 'hex') {
    reduced = Math.ceil(reduced * 0.5);
    apPenalty = 1;
  }

  let stability = clamp(s.stability - reduced, 0, 100);
  let corruption = s.corruption;
  if (s.reboundArmed && !s.reassessUsed) {
    corruption = Math.max(0, corruption + 10);
  }
  corruption = Math.max(0, corruption + corruptionRegrow);

  // Shield absorbed = damage that would have landed without the shield
  const rawDmgNoShield = Math.floor(baseDmg * damageMultiplier * waveMultiplier);
  const shieldAbsorbed = s.shieldNext > 0 ? Math.max(0, rawDmgNoShield - reductionAfterShield) : 0;
  const shieldNote = shieldAbsorbed > 0
    ? ` 🛡 Protection absorbed ${shieldAbsorbed}% incoming Instability. Protection does not block Corruption Spread or passive disease effects.`
    : '';
  if (attack.kind === 'spread') {
    if (spreadBlocked) {
      log.push(`🧫 Isolation Seal contains ${attack.name}. Spread blocked — Corruption holds. Stability −${reduced}%.${shieldNote}`);
    } else {
      log.push(`🦠 ${s.enemy.name} unleashes ${attack.name}. Corruption +${corruptionRegrow}, Stability −${reduced}%.${shieldNote}`);
    }
  } else if (attack.kind === 'hex') {
    log.push(`💫 ${s.enemy.name} unleashes ${attack.name}. Team hindered — 1 fewer action next turn. Stability −${reduced}%.${shieldNote}`);
  } else {
    log.push(`🩸 ${s.enemy.name} unleashes ${attack.name}. Stability −${reduced}%.${shieldNote}`);
  }

  if (stability <= 0) {
    log.push(`💀 ${s.enemy.dangerTrigger}. The patient is lost.`);
    return { ...s, stability: 0, corruption, shieldNext: 0, log, outcome: 'loss', equipFirstLossUsed };
  }

  // Next-turn AP — dynamic based on patient state
  let nextAp = getTurnAP(stability, corruption, s.chapter, {});
  if (apPenalty > 0) nextAp = Math.max(1, nextAp - apPenalty);
  log.push(apMessage(nextAp));

  // Reset hero action map
  const heroActionsUsed: Record<string, boolean> = {};
  s.team.forEach(h => { heroActionsUsed[h.id] = false; });

  // Update danger flag
  const danger = getDangerLevel(stability, corruption);
  const dangerTriggerActive = danger === 'critical';

  let next: BattleState = {
    ...s,
    stability,
    corruption,
    shieldNext: 0,
    ap: nextAp,
    apMax: nextAp,
    turn: s.turn + 1,
    log,
    blockNextSpread: attack.kind === 'spread' ? false : s.blockNextSpread,
    reassessUsed: false,
    reboundArmed: false,
    rapidResponseActive: false,
    cueBonusStabilize: 0,
    classStabilizeUsedThisTurn: false, // Push 11: reset Caretaker combo tracker each enemy turn
    equipFirstLossUsed,                // Push 10: persist Triage Sash one-shot flag
    heroActionsUsed,
    selectedHeroId: s.team.find(h => !heroActionsUsed[h.id])?.id || s.selectedHeroId,
    dangerTriggerActive,
  };

  // Clinical Cue — next question lands on a randomized turn, always ≥2 turns after the last one
  if (next.turn >= next.nextCueTurn) {
    next = maybeTriggerClinicalCue(next);
  }

  return next;
}

export function flatSkills(team: Hero[]): { hero: Hero; skill: import('./types').HeroSkill }[] {
  const out: { hero: Hero; skill: import('./types').HeroSkill }[] = [];
  team.forEach(h => h.skills.forEach(s => out.push({ hero: h, skill: s })));
  return out;
}

// ============================================================
// UI helpers: status preview for action buttons
// ============================================================

export function previewSkillStatus(state: BattleState, skill: HeroSkill): { status: ActionStatus; label: string } {
  const action = SKILL_CLINICAL[skill.id];
  const res = evaluateClinicalAppropriateness(action, state.enemyClinical, { revealedLabels: state.revealedLabels, stability: state.stability });
  return { status: res.status, label: statusLabel(res.status) };
}

export function previewItemStatus(state: BattleState, item: Item): { status: ActionStatus; label: string } {
  const action = ITEM_CLINICAL[item.name];
  const res = evaluateClinicalAppropriateness(action, state.enemyClinical, { revealedLabels: state.revealedLabels, stability: state.stability });
  return { status: res.status, label: statusLabel(res.status) };
}

export function previewTempStatus(state: BattleState, actionId: string): { status: ActionStatus; label: string } {
  const action = TEMP_CLINICAL[actionId];
  const res = evaluateClinicalAppropriateness(action, state.enemyClinical, { revealedLabels: state.revealedLabels, stability: state.stability });
  return { status: res.status, label: statusLabel(res.status) };
}

export function previewCallStatus(state: BattleState, callId: string): { status: ActionStatus; label: string } {
  const action = CALL_CLINICAL[callId];
  const res = evaluateClinicalAppropriateness(action, state.enemyClinical, { revealedLabels: state.revealedLabels, stability: state.stability });
  return { status: res.status, label: statusLabel(res.status) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Push 12 — Advanced calculation detail view
//
// Pre-computes the displayable modifier breakdown for a skill in the current
// battle context. Safe to call during render — pure function, no side effects.
//
// Clinical correctness (clinicalMod) and cast quality (castMult) are unknown
// pre-fire, so the estimate assumes appropriate (×1.0) and normal cast (×1.0).
// The note below the estimate tells the player this explicitly.
// ─────────────────────────────────────────────────────────────────────────────

export interface CalcRow {
  label: string;
  /** mult: 1.08 means ×1.08; flat: 8 means +8 */
  value: number;
  kind: 'mult' | 'flat';
}

export interface CalcBreakdown {
  effectType: 'strike' | 'stabilize' | 'shield' | 'none';
  baseDisplay: string;    // "7" for fixed, "5–9" for ranged
  estimatedBase: number;  // midpoint used for estimate; 0 if effectType === 'none'
  rows: CalcRow[];        // only non-trivial active factors
  estimated: number;      // estimated final value (assumes appropriate + normal cast)
  note: string;           // caveat shown below the estimate
}

/**
 * Pre-computes the displayable modifier breakdown for a skill in the current
 * battle context. Called from the long-press detail panel in battle.tsx.
 */
export function buildSkillCalcBreakdown(
  state: BattleState,
  hero: Hero,
  skill: HeroSkill,
): CalcBreakdown {
  // ── Determine primary effect type and base value ────────────────────────────
  let effectType: CalcBreakdown['effectType'] = 'none';
  let baseMin = 0, baseMax = 0;

  if (skill.strike || skill.strikeRange) {
    effectType = 'strike';
    [baseMin, baseMax] = skill.strikeRange
      ? [skill.strikeRange[0], skill.strikeRange[1]]
      : [skill.strike!, skill.strike!];
  } else if (skill.stabilize || skill.stabilizeRange) {
    effectType = 'stabilize';
    [baseMin, baseMax] = skill.stabilizeRange
      ? [skill.stabilizeRange[0], skill.stabilizeRange[1]]
      : [skill.stabilize!, skill.stabilize!];
  } else if (skill.shield || skill.shieldRange) {
    effectType = 'shield';
    [baseMin, baseMax] = skill.shieldRange
      ? [skill.shieldRange[0], skill.shieldRange[1]]
      : [skill.shield!, skill.shield!];
  }

  const isRange = baseMin !== baseMax;
  const baseDisplay = isRange ? `${baseMin}–${baseMax}` : `${baseMin}`;
  const estimatedBase = isRange ? Math.round((baseMin + baseMax) / 2) : baseMin;

  if (effectType === 'none' || estimatedBase <= 0) {
    return { effectType: 'none', baseDisplay: '—', estimatedBase: 0, rows: [], estimated: 0, note: '' };
  }

  // ── Compute each modifier (mirrors applySkill bags, minus unknown pre-fire values) ──

  // Push 12: equipment flat stat bonuses (mirrors applySkill logic).
  const equipFxBreakdown = state.heroEquipmentEffects?.[hero.id] ?? {
    insightBonus: 0, carePowerBonus: 0, interventionBonus: 0, guardBonus: 0, coordinationBonus: 0,
  };

  // Hero combat stat for this effect type + equipment stat bonus
  const stats = hero.stats;
  const heroStatMult = stats
    ? statToMultiplier(
        effectType === 'shield'
          ? stats.guard + (equipFxBreakdown.guardBonus ?? 0)
          : effectType === 'stabilize'
            ? stats.carePower + (equipFxBreakdown.carePowerBonus ?? 0)
            : stats.intervention + (equipFxBreakdown.interventionBonus ?? 0),
      )
    : 1.0;

  // Affinity family match (hero strong/weak affinities vs enemy)
  const affinityFamilyMult = calcAffinityFamilyMod(
    hero.strongAffinities, hero.weakAffinities,
    state.enemy.primaryAffinity,
    state.enemy.secondaryAffinities ?? (state.enemy.secondaryAffinity ? [state.enemy.secondaryAffinity] : []),
    state.enemy.affinityResistance ?? 0,
  );

  // Element advantage: strike only — hero element hits enemy weak element
  // Warn whenever weakSystem is present — it is deprecated regardless of whether weakElement is also set.
  const _devModeBreakdown = (typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production');
  if (_devModeBreakdown && (state.enemy as any).weakSystem !== undefined) {
    console.warn(`[Elemental] Enemy "${state.enemy.id}" still has legacy weakSystem — remove it and use weakElement: ElementSystem | null instead.`);
  }
  // Gate on skill.type === 'strike' — command/analyze skills that carry a strike payload
  // must not receive the elemental counter bonus (mirrors applySkill strikeMods logic).
  const elementBonus = effectType === 'strike' && skill.type === 'strike'
    && !!state.enemy.weakElement && hero.element === state.enemy.weakElement ? 0.3 : 0;

  // Push 13 fix: corruption resistance reduces strike damage (mirrors applySkill line 714).
  // Was missing from Push 12 — omitting it made estimates too optimistic for resistant enemies.
  const corruptionResistMod = effectType === 'strike'
    ? 1 - (state.enemy.corruptionResistance ?? 0)
    : 1;

  // Hidden-pathology defense — scales down all effects while clues remain unrevealed
  const totalHidden = state.enemy.hiddenClues.length;
  const hiddenFraction = totalHidden > 0 ? state.hiddenClueIds.length / totalHidden : 0;
  const hiddenDefenseMod = 1 - (state.enemy.hiddenDefense ?? 0) * hiddenFraction;

  // Leader bonus (team slot 0 = Leader)
  const lb = state.team[0] ? scaleLeaderBonus(getLeaderBonus(state.team[0]), state.team[0]) : null;
  const leaderMult =
    effectType === 'strike'    ? (lb?.strikeMult    ?? 1)
    : effectType === 'stabilize' ? (lb?.stabilizeMult ?? 1)
    :                              (lb?.shieldMult    ?? 1);

  // Class bonus
  const cb = state.classBonus;
  const classMult =
    effectType === 'strike'    ? (cb?.strikeMod    ?? 1)
    : effectType === 'stabilize' ? (cb?.stabilizeMod ?? 1)
    :                              (cb?.shieldMod    ?? 1);

  // Clinical-cue empowerment — additive, stabilize only, active this turn
  const cueBonusFlat = effectType === 'stabilize' ? state.cueBonusStabilize : 0;

  // ── Build rows — only include non-trivial factors ──────────────────────────
  const rows: CalcRow[] = [];

  function pushRow(label: string, value: number, kind: 'mult' | 'flat') {
    const trivial = kind === 'mult' ? Math.abs(value - 1.0) < 0.005 : Math.abs(value) < 1;
    if (!trivial) rows.push({ label, value, kind });
  }

  if (elementBonus > 0)          pushRow('Elemental Counter',  1 + elementBonus,  'mult');
  pushRow('Hero stat',             heroStatMult,                                   'mult');
  pushRow('Affinity match',        affinityFamilyMult,                             'mult');
  if (hiddenDefenseMod < 0.995)   pushRow('Hidden pathology',  hiddenDefenseMod,   'mult');
  if (corruptionResistMod < 0.995) pushRow('Enemy resistance',  corruptionResistMod, 'mult');
  if (leaderMult !== 1.0)         pushRow('Leader bonus',      leaderMult,         'mult');
  if (classMult !== 1.0)          pushRow('Class bonus',       classMult,          'mult');
  if (cueBonusFlat > 0)           pushRow('Cue empowerment',   cueBonusFlat,       'flat');

  // ── Estimate — assumes clinicalMod=1, castMult=1, systemMod=1 ─────────────
  let estimated: number;
  if (effectType === 'strike') {
    estimated = Math.max(0, Math.round(
      estimatedBase * (1 + elementBonus)
      * heroStatMult * affinityFamilyMult
      * hiddenDefenseMod * corruptionResistMod * leaderMult * classMult,
    ));
  } else if (effectType === 'stabilize') {
    const core = Math.max(0,
      estimatedBase * heroStatMult * affinityFamilyMult
      * hiddenDefenseMod * leaderMult * classMult,
    );
    estimated = Math.max(0, Math.round(core + cueBonusFlat));
  } else {
    estimated = Math.max(0, Math.round(
      estimatedBase * heroStatMult * affinityFamilyMult
      * hiddenDefenseMod * leaderMult * classMult,
    ));
  }

  const note = isRange
    ? `Dice roll ${baseDisplay} · clinical alignment, system match & enemy resistance also apply`
    : 'Clinical alignment, system match & enemy resistance also apply';

  return { effectType, baseDisplay, estimatedBase, rows, estimated, note };
}
