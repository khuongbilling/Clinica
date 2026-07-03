import { getDifficultyModifier } from './difficulty';
import { ElementSystem, Enemy, Hero, HeroSkill } from './types';
import { CallOption, Item, ITEMS, TEMP_ACTIONS } from './items';
import {
  ActionClinical,
  ActionStatus,
  apMessage,
  applyChapterForgivenessToStatus,
  buildRationale,
  CALL_CLINICAL,
  canAdvanceChain,
  ChainRole,
  ChainState,
  CHAIN_BONUSES,
  combineFinalEffect,
  emptyChain,
  ENEMY_CLINICAL,
  EnemyClinical,
  evaluateClinicalAppropriateness,
  generateBattleMessage,
  getActiveFeedbackLevel,
  getChapterForgiveness,
  getDangerLevel,
  getEnemyDamage,
  getStabilizationModifier,
  getSystemMatchModifier,
  getTreatmentStabilityModifier,
  getTurnAP,
  ITEM_CLINICAL,
  LearningProfile,
  SKILL_CLINICAL,
  statusLabel,
  TEMP_CLINICAL,
} from './clinical';

export interface BattleState {
  enemy: Enemy;
  enemyClinical: EnemyClinical | undefined;
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
  callsUsed: { pharmacy: boolean; respiratory: boolean; rapidResponse: boolean; infectionControl: boolean };
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
}

export function initBattle(enemy: Enemy, team: Hero[], opts: InitBattleOptions = {}): BattleState {
  const enemyClinical = ENEMY_CLINICAL[enemy.id];
  const chapter = opts.chapter || enemyClinical?.chapter || (enemy.difficulty <= 2 ? 1 : 2);
  const feedbackLevel = getActiveFeedbackLevel(opts.profile, enemy.name, opts.enemyMastery, chapter);

  // Difficulty-based clue visibility
  // allClues ordered: visibleClues first (priority), then hiddenClues
  const allClues = [...enemy.visibleClues, ...enemy.hiddenClues];
  const diffMod = getDifficultyModifier(opts.difficulty as any);
  const targetVisible = Math.min(diffMod.visibleClues, allClues.length);
  const finalVisible = allClues.slice(0, targetVisible).map(c => c.id);
  const finalHidden = allClues.slice(targetVisible).map(c => c.id);
  const finalRevealedLabels = allClues.slice(0, targetVisible).map(c => c.label);

  let stability = enemy.startingStability + (opts.startingStabilityBonus || 0);
  stability = clamp(stability, 0, 100);

  // Apply difficulty damage adjustment to the handicap reduction
  const diffDamageEffect = Math.round((1 - diffMod.enemyDamageMultiplier) * 100);
  const combinedDamageReduction = (opts.enemyDamageReduction || 0) + diffDamageEffect;

  const corruption = enemy.corruption;
  const turnAp = getTurnAP(stability, corruption, chapter, {});

  const log: string[] = [`The ${enemy.name} corrupts the patient. Stability ${stability}%.`];
  log.push(apMessage(turnAp));

  // Mentor aid: reveal one extra clue on top of difficulty count
  if (opts.revealOneExtraClue && finalHidden.length > 0) {
    const id = finalHidden.shift()!;
    finalVisible.push(id);
    const clue = allClues.find(c => c.id === id);
    if (clue) finalRevealedLabels.push(clue.label);
    log.push(`Mentor's eye: one hidden clue is already revealed.`);
  }

  const heroActionsUsed: Record<string, boolean> = {};
  team.forEach(h => { heroActionsUsed[h.id] = false; });

  return {
    enemy,
    enemyClinical,
    team,
    stability,
    corruption,
    shieldNext: 0,
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
    callsUsed: { pharmacy: false, respiratory: false, rapidResponse: false, infectionControl: false },
    preparedItemDiscount: null,
    nextAirActionDiscount: false,
    rapidResponseActive: false,
    dangerTriggerActive: false,
    consultsUsed: 0,
    emergencyCallsUsed: 0,
    inappropriateConsultsUsed: 0,
    blockNextSpread: false,
    basicAidUses: 0,
  };
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
  return { ...s, heroActionsUsed: { ...s.heroActionsUsed, [heroId]: true } };
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

  if (next.corruption <= 0) {
    next.log.push(`✨ The ${s.enemy.name} is purified! Stability holds at ${next.stability}%.`);
    next.outcome = 'win';
  }

  return { state: next, message: `Care Attempt: -${damage} Corruption.`, status: 'weak' };
}

function revealHiddenClues(s: BattleState, count: number): BattleState {
  const reveal = Math.min(count, s.hiddenClueIds.length);
  if (reveal === 0) return s;
  const hiddenClueIds = [...s.hiddenClueIds];
  const visibleClues = [...s.visibleClues];
  const revealedLabels = [...s.revealedLabels];
  const log = [...s.log];
  for (let i = 0; i < reveal; i++) {
    const id = hiddenClueIds.shift()!;
    visibleClues.push(id);
    const clue = s.enemy.hiddenClues.find(c => c.id === id);
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
  chainAdvanced: ChainRole | null;
  chainCompletedNow: boolean;
  rationale: string | undefined;
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
  let chainAdvanced: ChainRole | null = null;
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
  return { status: evalRes.status, modifier: effectiveMod, systemModifier: sysMod, chainAdvanced, chainCompletedNow, rationale };
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
  if (res.status === 'unsafe') {
    next.unsafeActionsUsed = next.unsafeActionsUsed + 1;
    next.stability = clamp(next.stability - 10, 0, 100);
    next.log.push(`⚠ Unsafe: ${actionName}. Stability -10.`);
  }
  if (res.status === 'inappropriate') {
    next.poorFitActionsUsed = next.poorFitActionsUsed + 1;
  }

  // Track chain progress
  if (res.chainAdvanced) {
    next.chain = { ...next.chain, progress: [...next.chain.progress, res.chainAdvanced] };
    if (res.chainCompletedNow) {
      next.chain = { ...next.chain, completed: true };
      next.fullChainCompleted = true;
      next.corruption = Math.max(0, next.corruption - CHAIN_BONUSES.fullChainCorruptionDamage);
      next.stability = clamp(next.stability + CHAIN_BONUSES.fullChainStabilityBonus, 0, 100);
      next.log.push(`✨ Complete Care Chain: -${CHAIN_BONUSES.fullChainCorruptionDamage} corruption, +${CHAIN_BONUSES.fullChainStabilityBonus} stability.`);
    }
  }

  return { state: next, aborted: false };
}

// ============================================================
// Apply: skills, items, temp actions, calls
// ============================================================

export interface ApplyResult { state: BattleState; message: string; status?: ActionStatus; aborted?: boolean }

export function applySkill(s: BattleState, skill: HeroSkill, hero: Hero): ApplyResult {
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

  // Treatment stability modifier — corruption damage scales with how stable the patient is
  const treatMod = getTreatmentStabilityModifier(next.stability);
  const eff = (n: number) => combineFinalEffect({ baseEffect: n, clinicalMod: res.modifier, systemMod: res.systemModifier, chapterModifier: treatMod });
  const stabEff = (n: number) => combineFinalEffect({ baseEffect: n, clinicalMod: res.modifier, systemMod: res.systemModifier, corruptionMod: getStabilizationModifier(next.corruption) });

  let effectAmount = 0;
  let effectType: 'corruption' | 'stability' | 'shield' | 'clue' | 'mixed' = 'mixed';

  if (skill.reveal) {
    next = revealHiddenClues(next, skill.reveal);
    effectType = 'clue';
  }
  if (skill.stabilize) {
    const amt = Math.max(0, stabEff(skill.stabilize));
    next.stability = clamp(next.stability + amt, 0, 100);
    effectAmount = Math.max(effectAmount, amt);
    effectType = effectType === 'clue' ? 'mixed' : 'stability';
  }
  if (skill.strike) {
    const bonus = s.enemy.weakSystem && hero.element === s.enemy.weakSystem ? Math.floor(skill.strike * 0.3) : 0;
    const amt = Math.max(0, eff(skill.strike + bonus));
    next.corruption = Math.max(0, next.corruption - amt);
    effectAmount = Math.max(effectAmount, amt);
    effectType = effectType === 'clue' ? 'mixed' : (effectType === 'stability' ? 'mixed' : 'corruption');
  }
  if (skill.shield) {
    next.shieldNext = Math.max(next.shieldNext, skill.shield);
    effectAmount = Math.max(effectAmount, skill.shield);
    effectType = effectType === 'mixed' ? 'mixed' : 'shield';
  }
  if (skill.risk?.ifSystem && (skill.risk.ifSystem === s.enemy.primarySystem || skill.risk.ifSystem === s.enemy.secondarySystem)) {
    const pen = skill.risk.penalty || 15;
    next.stability = clamp(next.stability - pen, 0, 100);
    next.unsafeActionsUsed = next.unsafeActionsUsed + 1;
    next.log.push(`⚠ Risk triggered: ${skill.risk.description} (-${pen}%)`);
  }

  // Track reassess
  if ((action?.chainRoles || []).includes('Reassess')) {
    next.reassessUsed = true;
    next.reassessUsedAnytime = true;
    next.reboundArmed = false;
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
    nextChainStep: next.enemyClinical?.treatmentChain[next.chain.progress.length] || null,
    fullChainCompleted: next.fullChainCompleted,
    rationale: res.rationale,
  });
  if (msg) next.log.push(msg);

  if (next.corruption <= 0) {
    next.log.push(`✨ The ${s.enemy.name} is purified! Stability holds at ${next.stability}%.`);
    next.outcome = 'win';
  }

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

  const stabMod = getStabilizationModifier(next.corruption);
  const treatMod = getTreatmentStabilityModifier(next.stability);

  let effectAmount = 0;
  let effectType: 'corruption' | 'stability' | 'shield' | 'clue' | 'mixed' = 'mixed';

  if (item.target === 'corruption') {
    const amt = Math.max(0, combineFinalEffect({ baseEffect: item.baseEffect, clinicalMod: res.modifier, systemMod: res.systemModifier, chapterModifier: treatMod }));
    next.corruption = Math.max(0, next.corruption - amt);
    effectAmount = amt; effectType = 'corruption';
  }
  if (item.target === 'stability') {
    const amt = Math.max(0, combineFinalEffect({ baseEffect: item.baseEffect, clinicalMod: res.modifier, systemMod: res.systemModifier, corruptionMod: stabMod }));
    next.stability = clamp(next.stability + amt, 0, 100);
    effectAmount = amt; effectType = 'stability';
  }
  if (item.target === 'shield') {
    next.shieldNext = Math.max(next.shieldNext, item.baseEffect);
    effectAmount = item.baseEffect; effectType = 'shield';
  }
  if (item.target === 'clue') {
    next = revealHiddenClues(next, 1);
    effectType = 'clue';
  }

  if ((action?.chainRoles || []).includes('Reassess')) {
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
    nextChainStep: next.enemyClinical?.treatmentChain[next.chain.progress.length] || null,
    fullChainCompleted: next.fullChainCompleted,
    rationale: res.rationale,
  });
  if (msg) next.log.push(msg);

  if (next.corruption <= 0) { next.log.push(`✨ Purified!`); next.outcome = 'win'; }
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
  if (a.stabilize) {
    const amt = Math.max(0, combineFinalEffect({ baseEffect: a.stabilize, clinicalMod: res.modifier, systemMod: res.systemModifier, corruptionMod: getStabilizationModifier(next.corruption) }));
    next.stability = clamp(next.stability + amt, 0, 100);
  }
  if (a.strike) {
    const amt = Math.max(0, combineFinalEffect({ baseEffect: a.strike, clinicalMod: res.modifier, systemMod: res.systemModifier }));
    next.corruption = Math.max(0, next.corruption - amt);
  }
  if (a.shield) next.shieldNext = Math.max(next.shieldNext, a.shield);
  if (next.corruption <= 0) { next.log.push(`✨ Purified!`); next.outcome = 'win'; }
  return { state: next, message: `${a.name} resolved.`, status: res.status };
}

export function applyCall(s: BattleState, option: CallOption, addedItemName?: string): ApplyResult {
  const callKey: keyof BattleState['callsUsed'] | null =
    option.id === 'call_pharmacy' ? 'pharmacy' :
    option.id === 'call_respiratory' ? 'respiratory' :
    option.id === 'call_rapid' ? 'rapidResponse' :
    option.id === 'call_infection' ? 'infectionControl' : null;

  if (callKey && s.callsUsed[callKey]) {
    return { state: s, message: `${option.name} has already been called this battle.`, aborted: true };
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

  // Enemy turn — shielded by Rapid Response or shieldNext
  const baseDmg = getEnemyDamage(s.corruption, s.enemy.instability);
  const damageMultiplier = getChapterForgiveness(s.chapter).enemyDamageMultiplier;
  const reductionAfterShield = Math.floor(baseDmg * (1 - s.shieldNext / 100) * damageMultiplier);
  let reduced = Math.max(0, reductionAfterShield - s.enemyDamageReduction);

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
    corruption = Math.min(100, corruption + 10);
  }
  corruption = Math.min(100, corruption + corruptionRegrow);

  const shieldTag = s.shieldNext ? ' (shielded)' : '';
  if (attack.kind === 'spread') {
    if (spreadBlocked) {
      log.push(`🧫 Isolation Seal contains ${attack.name}. The spread is blocked — Corruption holds. Stability -${reduced}%${shieldTag}.`);
    } else {
      log.push(`🦠 ${s.enemy.name} unleashes ${attack.name}. Corruption +${corruptionRegrow}, Stability -${reduced}%${shieldTag}.`);
    }
  } else if (attack.kind === 'hex') {
    log.push(`💫 ${s.enemy.name} unleashes ${attack.name}. Your team is hindered — 1 fewer action next turn. Stability -${reduced}%${shieldTag}.`);
  } else {
    log.push(`🩸 ${s.enemy.name} unleashes ${attack.name}. Stability -${reduced}%${shieldTag}.`);
  }

  if (stability <= 0) {
    log.push(`💀 ${s.enemy.dangerTrigger}. The patient is lost.`);
    return { ...s, stability: 0, corruption, shieldNext: 0, log, outcome: 'loss' };
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

  return {
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
    heroActionsUsed,
    selectedHeroId: s.team.find(h => !heroActionsUsed[h.id])?.id || s.selectedHeroId,
    dangerTriggerActive,
  };
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
