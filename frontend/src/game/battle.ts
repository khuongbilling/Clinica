import { Enemy, Hero, HeroSkill } from './types';
import { CallOption, Item, TEMP_ACTIONS } from './items';
import {
  ActionClinical,
  ActionStatus,
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
  getEnemyDamage,
  getStabilizationModifier,
  getSystemMatchModifier,
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
  callUsed: boolean;
  temporaryActionIds: string[];

  // Clinical reasoning layer state
  chain: ChainState;
  fullChainCompleted: boolean;
  unsafeActionsUsed: number;
  poorFitActionsUsed: number;
  reassessUsed: boolean;
  turnsTaken: number; // increments per player-action consuming AP
  feedbackLevel: ReturnType<typeof getActiveFeedbackLevel>;
  chapter: number;
  profile: LearningProfile | undefined;
  enemyDamageReduction: number;
  reboundArmed: boolean; // set true when corruption first drops below 40; cleared by reassess
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
}

export function initBattle(enemy: Enemy, team: Hero[], opts: InitBattleOptions = {}): BattleState {
  const visibleClueIds = enemy.visibleClues.map(c => c.id);
  const revealedLabels = enemy.visibleClues.map(c => c.label);
  const enemyClinical = ENEMY_CLINICAL[enemy.id];
  const chapter = opts.chapter || enemyClinical?.chapter || (enemy.difficulty <= 2 ? 1 : 2);
  const feedbackLevel = getActiveFeedbackLevel(opts.profile, enemy.name, opts.enemyMastery, chapter);
  const hiddenClueIds = enemy.hiddenClues.map(c => c.id);

  let stability = enemy.startingStability + (opts.startingStabilityBonus || 0);
  stability = clamp(stability, 0, 100);

  const log: string[] = [`The ${enemy.name} corrupts the patient. Stability ${stability}%.`];

  // Reveal one extra hidden clue if handicap calls for it
  const finalVisible = [...visibleClueIds];
  const finalHidden = [...hiddenClueIds];
  const finalRevealedLabels = [...revealedLabels];
  if (opts.revealOneExtraClue && finalHidden.length > 0) {
    const id = finalHidden.shift()!;
    finalVisible.push(id);
    const clue = enemy.hiddenClues.find(c => c.id === id);
    if (clue) finalRevealedLabels.push(clue.label);
    log.push(`Mentor's eye: one hidden clue is already revealed.`);
  }

  return {
    enemy,
    enemyClinical,
    team,
    stability,
    corruption: enemy.corruption,
    shieldNext: 0,
    ap: 3,
    apMax: 3,
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
    turnsTaken: 0,
    feedbackLevel,
    chapter,
    profile: opts.profile,
    enemyDamageReduction: opts.enemyDamageReduction || 0,
    reboundArmed: false,
  };
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
  const sysMod = getSystemMatchModifier(systemType, enemy);

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
  if (s.ap < skill.cost) return { state: s, message: 'Not enough AP.', aborted: true };

  const action = SKILL_CLINICAL[skill.id];
  const systemType = skill.systemType || 'Universal';
  const res = resolveAction(action, systemType, s);

  const { state: post, aborted } = applyResolutionToState(s, res, skill.name);
  if (aborted) return { state: post, message: `${skill.name} is locked.`, status: 'locked', aborted: true };

  let next = post;
  next.ap = s.ap - skill.cost;
  next.turnsTaken = next.turnsTaken + 1;
  next.log = [...next.log, `${hero.name} → ${skill.name}.`];

  const eff = (n: number) => combineFinalEffect({ baseEffect: n, clinicalMod: res.modifier, systemMod: res.systemModifier });
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
  if (s.ap < item.costAP) return { state: s, message: 'Not enough AP.', aborted: true };
  const qty = s.inventory[item.name] || 0;
  if (qty <= 0) return { state: s, message: `${item.name} is not available.`, aborted: true };

  const action = ITEM_CLINICAL[item.name];
  const systemType = item.systemType || 'Universal';
  const res = resolveAction(action, systemType, s);

  const { state: post, aborted } = applyResolutionToState(s, res, item.displayName);
  if (aborted) return { state: post, message: `${item.displayName} is locked.`, status: 'locked', aborted: true };

  let next: BattleState = {
    ...post,
    ap: s.ap - item.costAP,
    inventory: { ...s.inventory, [item.name]: qty - 1 },
    turnsTaken: post.turnsTaken + 1,
    log: [...post.log, `Used ${item.displayName}.`],
  };

  const stabMod = getStabilizationModifier(next.corruption);

  let effectAmount = 0;
  let effectType: 'corruption' | 'stability' | 'shield' | 'clue' | 'mixed' = 'mixed';

  if (item.target === 'corruption') {
    const amt = Math.max(0, combineFinalEffect({ baseEffect: item.baseEffect, clinicalMod: res.modifier, systemMod: res.systemModifier }));
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

  const action = TEMP_CLINICAL[actionId];
  const res = resolveAction(action, 'Universal', s);

  const { state: post, aborted } = applyResolutionToState(s, res, a.name);
  if (aborted) return { state: post, message: `${a.name} is locked.`, status: 'locked', aborted: true };

  let next: BattleState = { ...post, ap: s.ap - a.costAP, turnsTaken: post.turnsTaken + 1, log: [...post.log, `Team support → ${a.name}.`] };
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
  if (s.callUsed) return { state: s, message: 'You already called for support this battle.', aborted: true };
  if (s.ap < option.costAP) return { state: s, message: 'Not enough AP.', aborted: true };

  const action = CALL_CLINICAL[option.id];
  const res = resolveAction(action, 'Universal', s);

  const { state: post, aborted } = applyResolutionToState(s, res, option.name);
  if (aborted) return { state: post, message: `${option.name} is locked.`, status: 'locked', aborted: true };

  let next: BattleState = { ...post, ap: s.ap - option.costAP, callUsed: true, turnsTaken: post.turnsTaken + 1, log: [...post.log, `📞 ${option.name}.`] };

  if (option.effect === 'unlockAction' && option.actionId) {
    next.temporaryActionIds = [...next.temporaryActionIds, option.actionId];
    const tName = TEMP_ACTIONS[option.actionId]?.name || option.actionId;
    next.log.push(`${tName} is now available.`);
    return { state: next, message: `${tName} unlocked.`, status: res.status };
  }
  if (option.effect === 'rapidResponse') {
    next.shieldNext = Math.max(next.shieldNext, 80);
    next.stability = clamp(next.stability + 10, 0, 100);
    next.log.push(`Rapid Response: shield + Stability +10.`);
    return { state: next, message: 'Rapid Response stabilized the crisis.', status: res.status };
  }
  if (option.effect === 'addRelevantItem' && addedItemName) {
    next.inventory = { ...next.inventory, [addedItemName]: (next.inventory[addedItemName] || 0) + 1 };
    next.log.push(`Pharmacy added ${addedItemName} ×1.`);
    return { state: next, message: `Pharmacy added ${addedItemName}.`, status: res.status };
  }
  return { state: next, message: 'Support called.', status: res.status };
}

export function endPlayerTurn(s: BattleState): BattleState {
  if (s.outcome !== 'ongoing') return s;
  const log = [...s.log];
  const baseDmg = getEnemyDamage(s.corruption, s.enemy.instability);
  const damageMultiplier = getChapterForgiveness(s.chapter).enemyDamageMultiplier;
  const reductionAfterShield = Math.floor(baseDmg * (1 - s.shieldNext / 100) * damageMultiplier);
  let reduced = Math.max(0, reductionAfterShield - s.enemyDamageReduction);

  // Apply rebound if armed and no reassess used since
  if (s.reboundArmed && !s.reassessUsed) {
    reduced = reduced + 5;
    log.push(`⚠ Rebound: corruption surges back because reassessment was missed.`);
  }

  let stability = clamp(s.stability - reduced, 0, 100);
  log.push(`The ${s.enemy.name} surges. Stability -${reduced}%${s.shieldNext ? ' (shielded)' : ''}.`);
  if (stability <= 0) {
    log.push(`💀 ${s.enemy.dangerTrigger}. The patient is lost.`);
    return { ...s, stability: 0, shieldNext: 0, log, outcome: 'loss' };
  }
  return { ...s, stability, shieldNext: 0, ap: s.apMax, turn: s.turn + 1, log, reassessUsed: false };
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
