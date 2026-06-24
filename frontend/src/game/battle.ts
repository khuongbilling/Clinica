import { Enemy, Hero, HeroSkill } from './types';

export interface BattleState {
  enemy: Enemy;
  team: Hero[];
  stability: number; // 0..100
  corruption: number; // remaining HP
  shieldNext: number; // % damage reduction next enemy turn
  ap: number;
  apMax: number;
  visibleClues: string[]; // ids of clues currently visible
  hiddenClueIds: string[];
  log: string[];
  outcome: 'ongoing' | 'win' | 'loss';
  turn: number;
}

export function initBattle(enemy: Enemy, team: Hero[]): BattleState {
  return {
    enemy,
    team,
    stability: enemy.startingStability,
    corruption: enemy.corruption,
    shieldNext: 0,
    ap: 3,
    apMax: 3,
    visibleClues: enemy.visibleClues.map(c => c.id),
    hiddenClueIds: enemy.hiddenClues.map(c => c.id),
    log: [`The ${enemy.name} corrupts the patient. Stability ${enemy.startingStability}%.`],
    outcome: 'ongoing',
    turn: 1,
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function applySkill(s: BattleState, skill: HeroSkill, hero: Hero): BattleState {
  if (s.outcome !== 'ongoing') return s;
  if (s.ap < skill.cost) return s;

  const log = [...s.log];
  let stability = s.stability;
  let corruption = s.corruption;
  let shieldNext = s.shieldNext;
  const hiddenClueIds = [...s.hiddenClueIds];
  const visibleClues = [...s.visibleClues];

  log.push(`${hero.name} → ${skill.name}.`);

  // Reveal hidden clues
  if (skill.reveal) {
    const reveal = Math.min(skill.reveal, hiddenClueIds.length);
    const revealedIds = hiddenClueIds.splice(0, reveal);
    revealedIds.forEach(id => visibleClues.push(id));
    if (revealedIds.length) log.push(`Revealed ${revealedIds.length} hidden clue${revealedIds.length > 1 ? 's' : ''}.`);
  }

  // Stabilize
  if (skill.stabilize) {
    stability = clamp(stability + skill.stabilize, 0, 100);
    log.push(`Stability +${skill.stabilize}%.`);
  }

  // Strike enemy corruption (bonus if matches weak system)
  if (skill.strike) {
    const bonus = s.enemy.weakSystem && hero.element === s.enemy.weakSystem ? Math.floor(skill.strike * 0.3) : 0;
    const total = skill.strike + bonus;
    corruption = Math.max(0, corruption - total);
    log.push(`Struck corruption ${total}${bonus ? ' (elemental bonus!)' : ''}.`);
  }

  // Shield
  if (skill.shield) {
    shieldNext = Math.max(shieldNext, skill.shield);
    log.push(`Shield ready: ${skill.shield}% reduction.`);
  }

  // Risk
  if (skill.risk?.ifSystem && (skill.risk.ifSystem === s.enemy.primarySystem || skill.risk.ifSystem === s.enemy.secondarySystem)) {
    const pen = skill.risk.penalty || 15;
    stability = clamp(stability - pen, 0, 100);
    log.push(`⚠ Risk triggered: ${skill.risk.description} (-${pen}%)`);
  }

  const ap = s.ap - skill.cost;

  // Win check
  if (corruption <= 0) {
    log.push(`✨ The ${s.enemy.name} is purified! Stability holds at ${stability}%.`);
    return { ...s, stability, corruption, shieldNext, ap, hiddenClueIds, visibleClues, log, outcome: 'win' };
  }

  return { ...s, stability, corruption, shieldNext, ap, hiddenClueIds, visibleClues, log };
}

export function endPlayerTurn(s: BattleState): BattleState {
  if (s.outcome !== 'ongoing') return s;
  const log = [...s.log];

  // Enemy deals instability damage
  const raw = s.enemy.instability;
  const reduced = Math.floor(raw * (1 - s.shieldNext / 100));
  let stability = clamp(s.stability - reduced, 0, 100);
  log.push(`The ${s.enemy.name} surges. Stability -${reduced}%${s.shieldNext ? ' (shielded)' : ''}.`);

  // Trigger danger if stability collapses
  if (stability <= 0) {
    log.push(`💀 ${s.enemy.dangerTrigger}. The patient is lost.`);
    return { ...s, stability: 0, shieldNext: 0, log, outcome: 'loss' };
  }

  return {
    ...s,
    stability,
    shieldNext: 0,
    ap: s.apMax,
    turn: s.turn + 1,
    log,
  };
}

export function flatSkills(team: Hero[]): { hero: Hero; skill: import('./types').HeroSkill }[] {
  const out: { hero: Hero; skill: import('./types').HeroSkill }[] = [];
  team.forEach(h => h.skills.forEach(s => out.push({ hero: h, skill: s })));
  return out;
}
