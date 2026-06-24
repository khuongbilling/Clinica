import { Enemy, Hero, HeroSkill } from './types';
import { CallOption, isClueRevealed, Item, TEMP_ACTIONS } from './items';

export interface BattleState {
  enemy: Enemy;
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
  // New: items + call
  inventory: Record<string, number>;
  callUsed: boolean;
  temporaryActionIds: string[];
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

export function initBattle(enemy: Enemy, team: Hero[], inventory: Record<string, number> = {}): BattleState {
  const visibleClueIds = enemy.visibleClues.map(c => c.id);
  const revealedLabels = enemy.visibleClues.map(c => c.label);
  return {
    enemy,
    team,
    stability: enemy.startingStability,
    corruption: enemy.corruption,
    shieldNext: 0,
    ap: 3,
    apMax: 3,
    visibleClues: visibleClueIds,
    hiddenClueIds: enemy.hiddenClues.map(c => c.id),
    revealedLabels,
    log: [`The ${enemy.name} corrupts the patient. Stability ${enemy.startingStability}%.`],
    outcome: 'ongoing',
    turn: 1,
    inventory: { ...inventory },
    callUsed: false,
    temporaryActionIds: [],
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
    if (clue) revealedLabels.push(clue.label);
  }
  log.push(`Revealed ${reveal} hidden clue${reveal > 1 ? 's' : ''}.`);
  return { ...s, hiddenClueIds, visibleClues, revealedLabels, log };
}

export function applySkill(s: BattleState, skill: HeroSkill, hero: Hero): BattleState {
  if (s.outcome !== 'ongoing') return s;
  if (s.ap < skill.cost) return s;

  let next = { ...s, log: [...s.log] };
  next.log.push(`${hero.name} → ${skill.name}.`);

  if (skill.reveal) next = revealHiddenClues(next, skill.reveal);
  if (skill.stabilize) {
    next.stability = clamp(next.stability + skill.stabilize, 0, 100);
    next.log.push(`Stability +${skill.stabilize}%.`);
  }
  if (skill.strike) {
    const bonus = s.enemy.weakSystem && hero.element === s.enemy.weakSystem ? Math.floor(skill.strike * 0.3) : 0;
    const total = skill.strike + bonus;
    next.corruption = Math.max(0, next.corruption - total);
    next.log.push(`Struck corruption ${total}${bonus ? ' (elemental bonus!)' : ''}.`);
  }
  if (skill.shield) {
    next.shieldNext = Math.max(next.shieldNext, skill.shield);
    next.log.push(`Shield ready: ${skill.shield}% reduction.`);
  }
  if (skill.risk?.ifSystem && (skill.risk.ifSystem === s.enemy.primarySystem || skill.risk.ifSystem === s.enemy.secondarySystem)) {
    const pen = skill.risk.penalty || 15;
    next.stability = clamp(next.stability - pen, 0, 100);
    next.log.push(`⚠ Risk triggered: ${skill.risk.description} (-${pen}%)`);
  }

  next.ap = s.ap - skill.cost;

  if (next.corruption <= 0) {
    next.log.push(`✨ The ${s.enemy.name} is purified! Stability holds at ${next.stability}%.`);
    next.outcome = 'win';
  }
  return next;
}

export function applyTempAction(s: BattleState, actionId: string): { state: BattleState; message: string } {
  const action = TEMP_ACTIONS[actionId];
  if (!action) return { state: s, message: 'Action not available.' };
  if (s.outcome !== 'ongoing') return { state: s, message: 'Battle is over.' };
  if (s.ap < action.costAP) return { state: s, message: 'Not enough AP.' };

  let next = { ...s, ap: s.ap - action.costAP, log: [...s.log] };
  next.log.push(`Team support → ${action.name}.`);
  if (action.stabilize) { next.stability = clamp(next.stability + action.stabilize, 0, 100); next.log.push(`Stability +${action.stabilize}%.`); }
  if (action.strike) { next.corruption = Math.max(0, next.corruption - action.strike); next.log.push(`Struck corruption ${action.strike}.`); }
  if (action.shield) { next.shieldNext = Math.max(next.shieldNext, action.shield); next.log.push(`Shield ready: ${action.shield}%.`); }
  if (next.corruption <= 0) { next.log.push(`✨ Purified!`); next.outcome = 'win'; }
  return { state: next, message: `${action.name} used.` };
}

export function useItem(s: BattleState, item: Item): { state: BattleState; message: string; success: boolean } {
  if (s.outcome !== 'ongoing') return { state: s, message: 'Battle is over.', success: false };
  if (s.ap < item.costAP) return { state: s, message: 'Not enough AP.', success: false };
  const qty = s.inventory[item.name] || 0;
  if (qty <= 0) return { state: s, message: `${item.name} is not available.`, success: false };
  if (item.requiredClueKeyword && !isClueRevealed(s.revealedLabels, item.requiredClueKeyword)) {
    return { state: s, message: `${item.name} requires "${item.requiredClueLabel}" to be revealed first.`, success: false };
  }

  let next: BattleState = {
    ...s,
    ap: s.ap - item.costAP,
    inventory: { ...s.inventory, [item.name]: qty - 1 },
    log: [...s.log, `Used ${item.name}.`],
  };

  const sysMatch = item.bonusVsSystem && (item.bonusVsSystem === s.enemy.primarySystem || item.bonusVsSystem === s.enemy.secondarySystem);

  if (item.target === 'corruption') {
    next.corruption = Math.max(0, next.corruption - item.baseEffect);
    next.log.push(`Struck corruption ${item.baseEffect}.`);
    if (sysMatch) { next.stability = clamp(next.stability + item.bonusEffect, 0, 100); next.log.push(`Elemental bonus: Stability +${item.bonusEffect}%.`); }
  }
  if (item.target === 'stability') {
    next.stability = clamp(next.stability + item.baseEffect, 0, 100);
    next.log.push(`Stability +${item.baseEffect}%.`);
    if (sysMatch) { next.corruption = Math.max(0, next.corruption - item.bonusEffect); next.log.push(`Elemental bonus: corruption -${item.bonusEffect}.`); }
  }
  if (item.target === 'shield') {
    next.shieldNext = Math.max(next.shieldNext, item.baseEffect);
    next.log.push(`Shield ready: ${item.baseEffect}%.`);
    if (sysMatch) { next.corruption = Math.max(0, next.corruption - item.bonusEffect); next.log.push(`Elemental strike: corruption -${item.bonusEffect}.`); }
  }
  if (item.target === 'clue') {
    next = revealHiddenClues(next, 1);
  }

  if (next.corruption <= 0) { next.log.push(`✨ Purified!`); next.outcome = 'win'; }
  return { state: next, message: `${item.name} used successfully.`, success: true };
}

export function applyCall(s: BattleState, option: CallOption, addedItemName?: string): { state: BattleState; message: string } {
  if (s.callUsed) return { state: s, message: 'You already called for support this battle.' };
  if (s.ap < option.costAP) return { state: s, message: 'Not enough AP.' };

  let next: BattleState = { ...s, ap: s.ap - option.costAP, callUsed: true, log: [...s.log, `📞 ${option.name}.`] };

  if (option.effect === 'unlockAction' && option.actionId) {
    next.temporaryActionIds = [...next.temporaryActionIds, option.actionId];
    const tName = TEMP_ACTIONS[option.actionId]?.name || option.actionId;
    return { state: next, message: `${tName} is now available.` };
  }
  if (option.effect === 'rapidResponse') {
    next.shieldNext = Math.max(next.shieldNext, 80);
    next.stability = clamp(next.stability + 10, 0, 100);
    next.log.push(`Rapid Response: shield + Stability +10.`);
    return { state: next, message: 'Rapid Response stabilized the crisis.' };
  }
  if (option.effect === 'addRelevantItem' && addedItemName) {
    next.inventory = { ...next.inventory, [addedItemName]: (next.inventory[addedItemName] || 0) + 1 };
    next.log.push(`Pharmacy added ${addedItemName} ×1.`);
    return { state: next, message: `Pharmacy added ${addedItemName}.` };
  }
  return { state: next, message: 'Support called.' };
}

export function endPlayerTurn(s: BattleState): BattleState {
  if (s.outcome !== 'ongoing') return s;
  const log = [...s.log];
  const raw = s.enemy.instability;
  const reduced = Math.floor(raw * (1 - s.shieldNext / 100));
  let stability = clamp(s.stability - reduced, 0, 100);
  log.push(`The ${s.enemy.name} surges. Stability -${reduced}%${s.shieldNext ? ' (shielded)' : ''}.`);
  if (stability <= 0) {
    log.push(`💀 ${s.enemy.dangerTrigger}. The patient is lost.`);
    return { ...s, stability: 0, shieldNext: 0, log, outcome: 'loss' };
  }
  return { ...s, stability, shieldNext: 0, ap: s.apMax, turn: s.turn + 1, log };
}

export function flatSkills(team: Hero[]): { hero: Hero; skill: import('./types').HeroSkill }[] {
  const out: { hero: Hero; skill: import('./types').HeroSkill }[] = [];
  team.forEach(h => h.skills.forEach(s => out.push({ hero: h, skill: s })));
  return out;
}
