/**
 * scripts/generate-battle-audit.ts
 *
 * Reads enemy data from content.ts and skillCalc.ts and regenerates
 * docs/battle-audit.md from source data.
 *
 * Usage (from frontend/):
 *   node_modules/.bin/sucrase-node scripts/generate-battle-audit.ts            — write file
 *   node_modules/.bin/sucrase-node scripts/generate-battle-audit.ts --check    — diff & fail if stale
 *
 * Added to the `validate` npm script so CI catches stale docs automatically.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ENEMIES,
  AFFLICTION_ENEMIES,
  BOSS_LORD_IMBALANCE,
  BOSS_SILENT_INFARCT,
  WAVE_COMPANIONS,
} from '../src/game/content';
import { statToMultiplier } from '../src/game/skillCalc';
import type { Enemy } from '../src/game/types';

// ─── helpers ────────────────────────────────────────────────────────────────

const pct = (n: number | undefined): string =>
  n == null || n === 0 ? '0%' : `${Math.round(n * 100)}%`;

const dash = (n: number | undefined): string =>
  n == null || n === 0 ? '—' : `${Math.round(n * 100)}%`;

const systems = (e: Enemy): string => {
  const parts = [e.primarySystem];
  if (e.secondarySystem) parts.push(e.secondarySystem);
  return parts.join(' / ');
};

const flags = (e: Enemy, extraFlags: string[] = []): string => {
  const f: string[] = [...extraFlags];
  if (e.bossGuard) f.push('BOSS');
  if (e.worldBoss) f.push('WORLD BOSS');
  if (e.scriptedLoss) f.push('SCRIPTED LOSS');
  if (e.isAffliction) f.push('AFFLICTION');
  return f.length ? f.join(' · ') : '—';
};

/** Known trial-boss IDs and the chapter node they guard. */
const TRIAL_NODES: Record<string, string> = {
  fluid_phantom:      'c1n6',
  fever_shade:        'c2p7',
  gale_spirit:        'c3p8',
  ward_cascade:       'c5p8',
  imbalance_core:     'c6p7',
  contagion_wraith:   'c7p8',
  crisis_convergence: 'c8p8',
};

const trialFlag = (id: string): string =>
  TRIAL_NODES[id] ? `TRIAL (${TRIAL_NODES[id]})` : '';

// ─── section builders ────────────────────────────────────────────────────────

function statRow(e: Enemy, extraFlagTokens: string[] = []): string {
  const tf = trialFlag(e.id);
  const allFlags = tf ? [...extraFlagTokens, tf] : extraFlagTokens;
  const f = flags(e, allFlags);
  const sys = systems(e);
  return `| \`${e.id}\` | ${e.name} | ${e.corruption} | ${e.startingStability} | ${e.instability} | ${pct(e.corruptionResistance)} | ${dash(e.stabilityResistance)} | ${pct(e.hiddenDefense)} | ${pct(e.stabilityPressure)} | ${dash(e.affinityResistance)} | ${sys} | ${e.weakElement ?? '—'} | ${f} |`;
}

function ch9Row(e: Enemy): string {
  const counterpart = (e as any).simulationCounterpart ?? '—';
  const sys = systems(e);
  return `| \`${e.id}\` | ${e.name} | ${e.corruption} | ${e.startingStability} | ${e.instability} | ${pct(e.corruptionResistance)} | ${dash(e.stabilityResistance)} | ${pct(e.hiddenDefense)} | ${pct(e.stabilityPressure)} | ${dash(e.affinityResistance)} | ${sys} | ${e.weakElement ?? '—'} | \`${counterpart}\` | — |`;
}

function buildEnemyStatBlocks(): string {
  const lines: string[] = [];
  // Single unified header used for every chapter section.
  // "System" shows "Primary" or "Primary / Secondary" — no separate 2nd System column,
  // which keeps every row cell-count consistent with its header.
  const HEADER = `| ID | Name | HP (Corr) | Stab | Instab | Corr Resist % | Stab Resist % | Hidden Def % | Stab Press % | Aff Resist % | System | Weakness | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|`;

  // ── Ch1 ──────────────────────────────────────────────────────────────────
  const ch1 = ENEMIES.filter(e => e.difficulty === 1 && !e.isAffliction && !e.worldBoss && !e.chapterGate);
  lines.push('### Chapter 1 — Introduction (difficulty 1)\n');
  lines.push(HEADER);
  ch1.forEach(e => lines.push(statRow(e)));
  lines.push('');
  lines.push('**Notes:**');
  lines.push('- All Ch 1 enemies have 0% affinity resistance and very low hidden defense — designed for new players.');
  lines.push(`- \`fluid_phantom\` is the Chapter 1 mini-boss: ~2× the corruption of a normal Ch1 enemy.`);
  lines.push('');
  lines.push('---\n');

  // ── Ch2 ──────────────────────────────────────────────────────────────────
  const ch2 = ENEMIES.filter(e => e.difficulty === 2 && !e.isAffliction && !e.worldBoss && !e.chapterGate);
  lines.push('### Chapter 2 — Escalation (difficulty 2)\n');
  lines.push(HEADER);
  ch2.forEach(e => lines.push(statRow(e)));
  lines.push('');
  lines.push('**Notes:**');
  lines.push('- `mind_fog` is the first enemy with `stabilityPressure` (2%) and `affinityResistance` (5%) — introduces active pressure mechanic.');
  lines.push('');
  lines.push('---\n');

  // ── Ch3 ──────────────────────────────────────────────────────────────────
  const ch3 = ENEMIES.filter(e => e.difficulty === 3 && !e.isAffliction && !e.worldBoss && !e.chapterGate);
  lines.push('### Chapter 3 — Complexity (difficulty 3)\n');
  lines.push(HEADER);
  ch3.forEach(e => lines.push(statRow(e)));
  lines.push('');
  lines.push('**Notes:**');
  lines.push('- All regular Ch3 enemies share identical resistance values (10% / 12% / 3% / 5%) — Ch3 is the balance calibration tier.');
  lines.push('- `fever_shade` is Ch2\'s trial boss but has `difficulty:3` (one step above the chapter pool) — appears in Ch3 filter, not Ch2.');
  lines.push('- `cardion_echo` spawns with `hypoxia_wisp` affliction companion. `septara_seed` spawns with `shock_spike`.');
  lines.push('');
  lines.push('---\n');

  // ── Ch4 ──────────────────────────────────────────────────────────────────
  const ch4 = ENEMIES.filter(e => e.difficulty === 4 && !e.isAffliction && !e.worldBoss && !e.chapterGate);
  lines.push('### Chapter 4 — Code Rush / Priority (difficulty 4)\n');
  lines.push(HEADER);
  ch4.forEach(e => lines.push(statRow(e)));
  lines.push('');
  lines.push('**Notes:**');
  lines.push('- Ch4 is the first chapter with `stabilityPressure` at 6% — ward is actively deteriorating.');
  lines.push('- `gale_spirit` is Ch3\'s trial boss with `difficulty:4`.');
  lines.push('- `pulmora_wisp` (Ch2) spawns with `mucus_wisp`; `air_sprite` spawns with `panic_wraith`; `electrox_flicker` spawns with `wheeze_guard`.');
  lines.push('');
  lines.push('---\n');

  // ── Ch5 ──────────────────────────────────────────────────────────────────
  const ch5 = ENEMIES.filter(e => e.difficulty === 5 && !e.isAffliction && !e.worldBoss && !e.chapterGate && !e.bossGuard);
  lines.push('### Chapter 5 — Sanctuary / Recovery (difficulty 5)\n');
  lines.push(HEADER);
  ch5.forEach(e => lines.push(statRow(e)));
  lines.push('');
  lines.push('**Notes:**');
  lines.push('- These are the last two enemies in the simulation era without `stabilityResistance`.');
  lines.push('- `recovery_lapse` teaches the concept that apparent improvement can mask secondary deterioration.');
  lines.push('');
  lines.push('---\n');

  // ── Ch6 trial ─────────────────────────────────────────────────────────────
  const ch6 = ENEMIES.filter(e => e.difficulty === 6 && !e.isAffliction && !e.worldBoss && !e.chapterGate);
  lines.push('### Chapter 6 Trial Boss (difficulty 6)\n');
  lines.push(HEADER);
  ch6.forEach(e => lines.push(statRow(e)));
  lines.push('');
  lines.push('**Notes:**');
  lines.push('- First enemy with `stabilityResistance` (10%) outside of named bosses.');
  lines.push('- Weak to `Protection` element (unusual — not one of the standard seven systems).');
  lines.push('- This is Ch5\'s trial boss with `difficulty:6`.');
  lines.push('');
  lines.push('---\n');

  // ── Ch7 trials ────────────────────────────────────────────────────────────
  const ch7 = ENEMIES.filter(e => e.difficulty === 7 && !e.isAffliction && !e.worldBoss && !e.chapterGate);
  lines.push('### Chapter 7 Trial Bosses (difficulty 7)\n');
  lines.push(HEADER);
  ch7.forEach(e => lines.push(statRow(e)));
  lines.push('');
  lines.push('**Notes:**');
  lines.push('- Both share identical resistance profiles — Ch7 calibration tier.');
  lines.push('- `contagion_wraith` has `Protection` as secondary system (unusual).');
  lines.push('');
  lines.push('---\n');

  // ── Ch8 trial ─────────────────────────────────────────────────────────────
  const ch8 = ENEMIES.filter(e => e.difficulty === 8 && !e.isAffliction && !e.worldBoss && !e.chapterGate);
  lines.push('### Chapter 8 Trial Boss (difficulty 8)\n');
  lines.push(HEADER);
  ch8.forEach(e => lines.push(statRow(e)));
  lines.push('');
  lines.push('**Notes:**');
  lines.push('- Lowest starting stability of all non-boss difficulty 8 enemies (36).');
  lines.push('- 4 hidden clues — the most of any non-boss enemy.');
  lines.push('');
  lines.push('---\n');

  // ── Ch9 real-ward ─────────────────────────────────────────────────────────
  const ch9 = ENEMIES.filter(e => (e as any).chapterGate === 9 && !e.worldBoss);
  const HEADER_CH9 = `| ID | Name | HP (Corr) | Stab | Instab | Corr Resist % | Stab Resist % | Hidden Def % | Stab Press % | Aff Resist % | System | Weakness | Sim Counterpart | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`;
  lines.push('### Chapter 9 — Real-Ward Counterparts (difficulty 9)\n');
  lines.push('These are the true-ward versions of simulation-era enemies. All have `chapterGate:9` (excluded from low-level pools), fewer visible clues, higher corruption, and active `stabilityResistance`.\n');
  lines.push(HEADER_CH9);
  ch9.forEach(e => lines.push(ch9Row(e)));
  lines.push('');
  lines.push('**Notes:**');
  lines.push('- All share the same Corr Resist / Hidden Def / Stab Press / Aff Resist baseline (22% / 24% / 14% / 12%).');
  lines.push('- `dehydration_specter` has the highest `stabilityResistance` of all Ch9 enemies (22%) and is the strongest (265 HP). It links back to `fluid_phantom` (the Ch1 trial boss) rather than the standard Ch1 pool enemy.');
  lines.push('- `confusion_veil` has the highest starting stability (62) — misleadingly "healthy-looking" patient, matching its delirium theme.');
  lines.push('');
  lines.push('---\n');

  // ── Named bosses ──────────────────────────────────────────────────────────
  const namedBosses: Enemy[] = [
    BOSS_LORD_IMBALANCE,
    ENEMIES.find(e => e.id === 'verdantha')!,
    BOSS_SILENT_INFARCT,
  ].filter(Boolean);

  lines.push('### Named Bosses\n');
  lines.push('These bosses live outside the normal chapter pool (not in `ENEMIES` array, or tagged `worldBoss:true`) and are only reachable through dedicated battle entries.\n');
  lines.push(HEADER);
  namedBosses.forEach(e => {
    const sys = e.secondarySystem
      ? `${e.primarySystem} / ${e.secondarySystem}`
      : e.primarySystem;
    const f = flags(e);
    lines.push(`| \`${e.id}\` | ${e.name} | ${e.corruption} | ${e.startingStability} | ${e.instability} | ${pct(e.corruptionResistance)} | ${dash(e.stabilityResistance)} | ${pct(e.hiddenDefense)} | ${pct(e.stabilityPressure)} | ${dash(e.affinityResistance)} | ${sys} | ${e.weakElement ?? '—'} | ${f} |`);
  });
  lines.push('');

  // Verdantha phases footnote
  const verdantha = ENEMIES.find(e => e.id === 'verdantha');
  if (verdantha && (verdantha as any).phases?.length) {
    const phases: Array<{ phaseId: string; weakElementOverride: string | null }> = (verdantha as any).phases;
    const phaseNotes = phases.map((p, i) => {
      const label = `Phase ${i + 1}`;
      return p.weakElementOverride ? `${label} → ${p.weakElementOverride}` : `${label}: no weakness`;
    });
    lines.push(`¹ Verdantha's weakness shifts per phase: ${phaseNotes.join(', ')}.\n`);
  }

  lines.push('**Lord Imbalance** (`lord_imbalance`)');
  lines.push(`- Chapter: difficulty ${BOSS_LORD_IMBALANCE.difficulty} (Chapter 1 story boss, node separate from pool)`);
  lines.push('- `bossGuard: true`');
  lines.push(`- ${Math.round((BOSS_LORD_IMBALANCE.stabilityResistance ?? 0) * 100)}% stability resistance — healing sticks poorly; lean on Strike and Shield.`);
  lines.push(`- ${BOSS_LORD_IMBALANCE.hiddenClues?.length ?? 0} hidden clues.`);
  lines.push('- Best fought with Scout first to reveal both hidden clues.');
  lines.push('');

  if (verdantha) {
    lines.push('**Verdantha, the Bloom Matriarch** (`verdantha`)');
    lines.push(`- Chapter: difficulty ${verdantha.difficulty} (World Event Boss, accessed via boss.tsx gate)`);
    lines.push('- `bossGuard: true`, `worldBoss: true`');
    lines.push(`- ${Math.round((verdantha.stabilityResistance ?? 0) * 100)}% stability resistance — the Bloom regrows; stabilize is heavily suppressed.`);
    lines.push('- 3-phase battle; weakness element changes with each phase.');
    lines.push('- Phase 1 weak: Forge; Phase 2 weak: Filter; Phase 3: no weakness.');
    lines.push('');
  }

  lines.push('**The Silent Infarct** (`silent_infarct`)');
  lines.push(`- Chapter: difficulty ${BOSS_SILENT_INFARCT.difficulty} (Prologue boss — narratively unwinnable)`);
  lines.push('- `scriptedLoss: true`, `bossGuard: true`');
  lines.push(`- ${Math.round((BOSS_SILENT_INFARCT.stabilityResistance ?? 0) * 100)}% stability resistance — every stabilize attempt barely registers.`);
  lines.push(`- ${BOSS_SILENT_INFARCT.corruption.toLocaleString()} HP (unreachable). Instability ${BOSS_SILENT_INFARCT.instability} — each turn is catastrophic.`);
  lines.push(`- Only ${BOSS_SILENT_INFARCT.visibleClues?.length ?? 0} visible clue${(BOSS_SILENT_INFARCT.visibleClues?.length ?? 0) !== 1 ? 's' : ''} + ${BOSS_SILENT_INFARCT.hiddenClues?.length ?? 0} hidden clue (both misleading).`);
  lines.push('- Battle ends at a forced turn cap; see `battle.tsx` scripted-loss handling.');
  lines.push('');
  lines.push('---\n');

  // ── Wave Afflictions ──────────────────────────────────────────────────────
  lines.push('### Wave Afflictions\n');
  lines.push('Afflictions are small companion enemies that spawn alongside a primary enemy (`isAffliction: true`). They always start at full stability (100) with 0 instability and have low corruption. They are excluded from chapter pool counts.\n');
  lines.push('**Wave companion pairings:**\n');
  lines.push('| Primary Enemy | Spawns With |');
  lines.push('|---|---|');
  Object.entries(WAVE_COMPANIONS).forEach(([primary, companions]) => {
    lines.push(`| \`${primary}\` | ${companions.map(c => `\`${c}\``).join(', ')} |`);
  });
  lines.push('');
  lines.push('**Affliction stat blocks:**\n');
  lines.push('| ID | Name | HP (Corr) | Corr Resist % | Hidden Def % | System | Weakness | Behavior Tag |');
  lines.push('|---|---|---|---|---|---|---|---|');
  AFFLICTION_ENEMIES.forEach(e => {
    const bt = (e as any).behaviorTag ?? '—';
    lines.push(`| \`${e.id}\` | ${e.name} | ${e.corruption} | ${pct(e.corruptionResistance)} | ${pct(e.hiddenDefense)} | ${e.primarySystem} | ${e.weakElement ?? '—'} | ${bt} |`);
  });
  lines.push('');
  lines.push(`All afflictions: \`startingStability: 100\`, \`instability: 0\`, \`stabilityPressure: 0\`, \`hiddenDefense: 0\`.\n`);
  lines.push('---');

  return lines.join('\n');
}

// ─── statToMultiplier table (generated from real function) ────────────────────

function buildStatTable(): string {
  const checkpoints = [5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 25, 28, 30, 35, 40, 45, 55];
  const whoHas: Record<number, string> = {
    5:  'Very low — weakest common',
    6:  '—',
    7:  '—',
    8:  '—',
    9:  '—',
    10: 'Common average — baseline',
    12: '—',
    14: '—',
    16: 'Uncommon peak',
    18: '—',
    20: '—',
    22: 'Rare peak',
    25: '—',
    28: '—',
    30: 'Epic peak',
    35: '—',
    40: 'Hard cap reached',
    45: 'Legendary / prologue heroes (capped)',
    55: 'Mythic — hard cap',
  };
  const lines: string[] = [];
  lines.push('| Stat | ×Mult | Who Has This |');
  lines.push('|---|---|---|');
  checkpoints.forEach(stat => {
    const mult = statToMultiplier(stat);
    lines.push(`| ${stat} | ×${mult.toFixed(2)} | ${whoHas[stat] ?? '—'} |`);
  });
  return lines.join('\n');
}

// ─── chapter pools section ────────────────────────────────────────────────────

function buildChapterPools(): string {
  const lines: string[] = [];

  // Pool filter: same as production — difficulty === chapter, !worldBoss, !isAffliction
  // Named bosses from separate exports (BOSS_LORD_IMBALANCE, BOSS_SILENT_INFARCT) are not in ENEMIES array
  // BOSS_VERDANTHA IS in ENEMIES but excluded by worldBoss:true
  for (let ch = 1; ch <= 9; ch++) {
    const pool = ENEMIES.filter(e => e.difficulty === ch && !e.worldBoss && !e.isAffliction && !e.chapterGate);
    const label = ch === 9 ? `Chapter ${ch} Pool — ${pool.length} enemies (all gated by \`chapterGate:9\`)` : `Chapter ${ch} Pool — ${pool.length} ${pool.length === 1 ? 'enemy' : 'enemies'}`;
    lines.push(`### ${label}\n`);

    if (ch === 9) {
      lines.push('All have `chapterGate: 9` — excluded from earlier chapter pools by separate gate logic.\n');
      lines.push('| Enemy ID | Name | System | Sim Counterpart |');
      lines.push('|---|---|---|---|');
      // ch9 enemies have chapterGate:9, so they won't show in the loop above;
      // use the chapterGate filter instead
      const ch9pool = ENEMIES.filter(e => (e as any).chapterGate === 9 && !e.worldBoss);
      ch9pool.forEach(e => {
        const counterpart = (e as any).simulationCounterpart ?? '—';
        lines.push(`| \`${e.id}\` | ${e.name} | ${systems(e)} | \`${counterpart}\` |`);
      });
    } else {
      lines.push('| Enemy ID | Name | System | Flags |');
      lines.push('|---|---|---|---|');
      pool.forEach(e => {
        const tf = trialFlag(e.id);
        lines.push(`| \`${e.id}\` | ${e.name} | ${systems(e)} | ${tf || '—'} |`);
      });
    }
    lines.push('');
  }

  // Chapter 10 — boss only
  lines.push('### Chapter 10 — Boss Only\n');
  lines.push('Chapter 10 has no pool enemies. The only enemy with `difficulty: 10` is:\n');
  lines.push('| Enemy ID | Name | System | Flags |');
  lines.push('|---|---|---|---|');
  const ch10 = [BOSS_SILENT_INFARCT];
  ch10.forEach(e => {
    lines.push(`| \`${e.id}\` | ${e.name} | ${e.primarySystem} | BOSS · SCRIPTED LOSS |`);
  });

  return lines.join('\n');
}

// ─── balance summary (generated from data) ───────────────────────────────────

function buildBalanceSummary(): string {
  const lines: string[] = [];
  lines.push('## Balance Summary\n');
  lines.push('### Resistance Progression by Tier\n');
  lines.push('| Tier | Chapters | Corr Resist | Stab Resist | Hidden Def | Stab Press | Aff Resist |');
  lines.push('|---|---|---|---|---|---|---|');

  const tiers: Array<{ label: string; chapters: string; filter: (e: Enemy) => boolean }> = [
    { label: 'Intro',       chapters: '1',       filter: e => e.difficulty === 1 && !e.isAffliction && !e.worldBoss && !e.chapterGate },
    { label: 'Escalation',  chapters: '2',       filter: e => e.difficulty === 2 && !e.isAffliction && !e.worldBoss && !e.chapterGate },
    { label: 'Complexity',  chapters: '3',       filter: e => e.difficulty === 3 && !e.isAffliction && !e.worldBoss && !e.chapterGate },
    { label: 'Code Rush',   chapters: '4',       filter: e => e.difficulty === 4 && !e.isAffliction && !e.worldBoss && !e.chapterGate },
    { label: 'Recovery',    chapters: '5',       filter: e => e.difficulty === 5 && !e.isAffliction && !e.worldBoss && !e.chapterGate && !e.bossGuard },
    { label: 'Trial 6',     chapters: '(c5p8)',  filter: e => e.difficulty === 6 && !e.isAffliction && !e.worldBoss && !e.chapterGate },
    { label: 'Trial 7',     chapters: '(c6–7)',  filter: e => e.difficulty === 7 && !e.isAffliction && !e.worldBoss && !e.chapterGate },
    { label: 'Trial 8',     chapters: '(c8p8)',  filter: e => e.difficulty === 8 && !e.isAffliction && !e.worldBoss && !e.chapterGate },
    { label: 'Real-Ward',   chapters: '9',       filter: e => (e as any).chapterGate === 9 && !e.worldBoss },
    { label: 'Named Bosses',chapters: '—',       filter: e => !!(e.bossGuard && !e.chapterGate) },
  ];

  tiers.forEach(({ label, chapters, filter }) => {
    const pool = [
      ...ENEMIES,
      BOSS_LORD_IMBALANCE,
      BOSS_SILENT_INFARCT,
    ].filter(filter);
    if (pool.length === 0) return;

    const corrRange = rangeStr(pool.map(e => e.corruptionResistance ?? 0), true);
    const stabRange = rangeStr(pool.map(e => e.stabilityResistance ?? 0), true, true);
    const hidRange  = rangeStr(pool.map(e => e.hiddenDefense ?? 0), true);
    const pressRange = rangeStr(pool.map(e => e.stabilityPressure ?? 0), true);
    const affRange  = rangeStr(pool.map(e => e.affinityResistance ?? 0), true);
    lines.push(`| ${label} | ${chapters} | ${corrRange} | ${stabRange} | ${hidRange} | ${pressRange} | ${affRange} |`);
  });

  lines.push('');
  lines.push('### Corruption (HP) Progression\n');
  lines.push('| Tier | Typical Range | Notes |');
  lines.push('|---|---|---|');

  // Generated from actual data
  const addRow = (label: string, enemies: Enemy[], note: string) => {
    if (enemies.length === 0) return;
    const min = Math.min(...enemies.map(e => e.corruption));
    const max = Math.max(...enemies.map(e => e.corruption));
    const range = min === max ? String(min) : `${min}–${max}`;
    lines.push(`| ${label} | ${range} | ${note} |`);
  };

  addRow('Ch1 normal', ENEMIES.filter(e => e.difficulty === 1 && !e.isAffliction && !e.worldBoss && !TRIAL_NODES[e.id] && !e.chapterGate), 'Very low; intended for single-turn resolution of individual skills');
  addRow('Ch1 trial boss', ENEMIES.filter(e => e.id === 'fluid_phantom'), '~2× pool enemy');
  addRow('Ch2', ENEMIES.filter(e => e.difficulty === 2 && !e.isAffliction && !e.worldBoss && !e.chapterGate), '—');
  addRow('Ch3 normal', ENEMIES.filter(e => e.difficulty === 3 && !e.isAffliction && !e.worldBoss && !TRIAL_NODES[e.id] && !e.chapterGate), '—');
  addRow('Ch3 trial boss', ENEMIES.filter(e => e.id === 'fever_shade'), '—');
  addRow('Ch4 normal', ENEMIES.filter(e => e.difficulty === 4 && !e.isAffliction && !e.worldBoss && !TRIAL_NODES[e.id] && !e.chapterGate), '—');
  addRow('Ch4 trial boss', ENEMIES.filter(e => e.id === 'gale_spirit'), '—');
  addRow('Ch5', ENEMIES.filter(e => e.difficulty === 5 && !e.isAffliction && !e.worldBoss && !e.bossGuard && !e.chapterGate), '—');
  addRow('Ch6 trial', ENEMIES.filter(e => e.difficulty === 6 && !e.isAffliction && !e.worldBoss && !e.chapterGate), '—');
  addRow('Ch7 trial', ENEMIES.filter(e => e.difficulty === 7 && !e.isAffliction && !e.worldBoss && !e.chapterGate), '—');
  addRow('Ch8 trial', ENEMIES.filter(e => e.difficulty === 8 && !e.isAffliction && !e.worldBoss && !e.chapterGate), '—');
  addRow('Ch9 real-ward', ENEMIES.filter(e => (e as any).chapterGate === 9 && !e.worldBoss), `Wide spread; \`dehydration_specter\` is the outlier at ${ENEMIES.find(e => e.id === 'dehydration_specter')?.corruption}`);
  lines.push(`| Lord Imbalance | ${BOSS_LORD_IMBALANCE.corruption} | Story boss — lower HP than Ch9 pool; leans on resistance instead |`);
  const verdantha = ENEMIES.find(e => e.id === 'verdantha');
  if (verdantha) lines.push(`| Verdantha | ${verdantha.corruption} | World Boss; ${Math.round((verdantha.stabilityResistance ?? 0) * 100)}% stab resistance makes HP effectively much higher |`);
  lines.push(`| Silent Infarct | ${BOSS_SILENT_INFARCT.corruption.toLocaleString()} | Scripted loss; unreachable in normal play |`);

  return lines.join('\n');
}

function rangeStr(values: number[], asPercent: boolean, dashIfZero = false): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (dashIfZero && max === 0) return '—';
  const fmt = (v: number) => asPercent ? `${Math.round(v * 100)}%` : String(v);
  return min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;
}

// ─── static sections ──────────────────────────────────────────────────────────

const FORMULAS_SECTION = `## 2. Formulas

All formulas are implemented in \`frontend/src/game/skillCalc.ts\`. Output is always \`Math.max(0, Math.round(result))\`.

### Strike Formula

**Reduces enemy Corruption.**

\`\`\`
result = base × (1 + elementBonus)
       × affinityMod
       × clinicalMod
       × systemMod
       × chapterMod
       × castMult
       × heroStatMod
       × affinityFamilyMod
       × corruptionResistanceMod
       × hiddenDefenseMod
       × [heroLevelMod × equipmentMod × leaderBonusMod × playerClassMod × careChainMod × clinicalCueMod]
\`\`\`

Square-bracketed factors are future slots, all currently ×1.00.

| Factor | Value / Formula | Notes |
|---|---|---|
| \`base\` | skill's \`strike\` field | Raw corruption reduction from the skill definition |
| \`elementBonus\` | \`+0.30\` if \`hero.element === enemy.weakElement\`, else \`0\` | Additive pre-multiply — scales with all subsequent mods |
| \`affinityMod\` | Treatment-correctness multiplier | Strong ×1.6 / Appropriate ×1.0 / Weak ×0.3 / Bad ×0 (from \`evaluateClinicalAppropriateness\`) |
| \`clinicalMod\` | From \`corrOutcome.reductionMult\` | Clinical approach modifier from the correctness evaluation |
| \`systemMod\` | From \`res.systemModifier\` | Bonus when hero's system matches the enemy's primary system |
| \`chapterMod\` | \`getTreatmentStabilityModifier(stability)\` | Dampens corruption reduction when enemy is already very high stability; \`×1.00\` for cards/temp |
| \`castMult\` | Perfect / Good / Normal | \`CAST_QUALITY_MULTIPLIER\`; \`×1.00\` for items, cards, temp actions |
| \`heroStatMod\` | \`statToMultiplier(hero.stats.intervention)\` | See table below; Push 4 |
| \`affinityFamilyMod\` | \`calcAffinityFamilyMod(...)\` | See Affinity Family table; Push 6 / 13 |
| \`corruptionResistanceMod\` | \`1 − enemy.corruptionResistance\` | Enemy's resistance to corruption-lowering (Strike only); bosses 0.65–0.72 |
| \`hiddenDefenseMod\` | \`1 − (enemy.hiddenDefense × hiddenCluesFraction)\` | Drops to \`1.00\` when all hidden clues revealed; Push 7 |

---

### Stabilize Formula

**Restores enemy Stability.**

\`\`\`
coreResult = base
           × clinicalMod
           × systemMod
           × corruptionMod
           × castMult
           × heroStatMod
           × affinityFamilyMod
           × hiddenDefenseMod
           × [heroLevelMod × equipmentMod × leaderBonusMod × playerClassMod × careChainMod × clinicalCueMod]

withFlat = max(0, coreResult) + cueBonusFlat

result = withFlat × stabilityGainMod × enemyResistanceMod
\`\`\`

Square-bracketed factors are future slots, all currently ×1.00.

| Factor | Value / Formula | Notes |
|---|---|---|
| \`base\` | skill's \`stabilize\` field | Raw stability gain from the skill definition |
| \`clinicalMod\` | From \`res.modifier\` | From \`evaluateClinicalAppropriateness\`; stabilize uses a different branch than strike |
| \`systemMod\` | From \`res.systemModifier\` | Same as Strike |
| \`corruptionMod\` | \`getStabilizationModifier(corruption)\` | Dampens healing when enemy corruption is already very low (near-win suppressor) |
| \`castMult\` | Perfect / Good / Normal | Same as Strike; \`×1.00\` for items, cards, temp actions |
| \`heroStatMod\` | \`statToMultiplier(hero.stats.carePower)\` | Uses \`carePower\` stat, not \`intervention\`; Push 4 |
| \`affinityFamilyMod\` | \`calcAffinityFamilyMod(...)\` | Same formula as Strike; Push 6 / 13 |
| \`hiddenDefenseMod\` | \`1 − (enemy.hiddenDefense × hiddenCluesFraction)\` | Same as Strike; \`corruptionResistanceMod = 1.00\` for Stabilize |
| \`cueBonusFlat\` | \`+8\` from Clinical Cue bonus | Added AFTER core multiply, BEFORE state modifiers; cleared at \`endPlayerTurn\` |
| \`stabilityGainMod\` | \`getStabilityGainModifier(stability)\` | Diminishing returns near 100 stability |
| \`enemyResistanceMod\` | \`1 − enemy.stabilityResistance\` | Range 0.03–0.97; boss healer-suppressor; \`1.00\` for enemies without this field |

**Key ordering note:** \`cueBonusFlat\` (+8) is inserted between the core multiply and the patient-state modifiers. This means the cue bonus also passes through \`stabilityGainMod × enemyResistanceMod\`, so it provides less benefit when healing a nearly-dead or boss enemy.

---

### Shield Formula

**Grants Protection % (stored in \`shieldNext\`).**

\`\`\`
result = base
       × heroStatMod
       × affinityFamilyMod
       × hiddenDefenseMod
       × [heroLevelMod × equipmentMod × leaderBonusMod × playerClassMod × careChainMod]
\`\`\`

Square-bracketed factors are future slots, all currently ×1.00. Caller enforces the hard 100% ceiling via \`Math.min\`.

| Factor | Value / Formula | Notes |
|---|---|---|
| \`base\` | skill's \`shield\` field | Raw protection percentage |
| \`heroStatMod\` | \`statToMultiplier(hero.stats.guard)\` | Uses \`guard\` stat regardless of skill type; Push 4 |
| \`affinityFamilyMod\` | \`calcAffinityFamilyMod(...)\` | Same strong/neutral/weak formula as Strike; Push 6 / 13 |
| \`hiddenDefenseMod\` | \`1 − (enemy.hiddenDefense × hiddenCluesFraction)\` | All action types equally reduced; Push 7 |

**Note:** Shield does **not** use \`clinicalMod\`, \`affinityMod\`, \`castMult\`, \`systemMod\`, or \`corruptionResistanceMod\`. There is no \`clinicalCueMod\` future slot for Shield either.

---`;

const AFFINITY_SECTIONS = `### Affinity Modifier (Treatment Correctness)

Controls how well a chosen treatment approach matches the disease. Applied as \`affinityMod\` in Strike and \`clinicalMod\` in Stabilize.

| Match Level | ×Mult | Description |
|---|---|---|
| Strong match | ×1.60 | Correct evidence-based intervention for this pathology |
| Appropriate | ×1.00 | Reasonable but not optimal |
| Weak match | ×0.30 | Suboptimal; will help slightly but poorly |
| Bad / contraindicated | ×0.00 | Causes harm — Strike deals 0 damage, Stabilize adds 0 stability |

A "bad" treatment also applies a stability penalty to the player (damage to the patient from iatrogenic harm).

---

### Affinity Family Modifier

Scales all three action types (Strike, Stabilize, Shield) based on whether the hero's clinical specialisation matches the enemy's domain. Implemented in \`calcAffinityFamilyMod()\`.

Both enemy affinity slots are checked (primary + secondary), so a hero specialising in a secondary domain still gets the bonus.

| Condition | ×Mult | Formula |
|---|---|---|
| Hero strong affinity ∩ enemy affinity ≠ ∅ | ×1.18 (max) | \`1 + 0.18 × (1 − min(affinityResistance, 1))\` |
| Neutral — no overlap | ×1.00 | — |
| Hero weak affinity ∩ enemy affinity ≠ ∅ | ×0.87 | Penalty not dampened by \`affinityResistance\` |

**Push 13 changes:** Bonus raised from ×1.15 → effective ×1.18; penalty tightened from ×0.90 → ×0.87.

**\`affinityResistance\` dampening (Push 7):**
- Only dampens the **bonus portion** of a strong match, not the base ×1.0.
- At \`affinityResistance: 0.15\` (bosses), a strong match gives \`1 + 0.18 × 0.85 ≈ ×1.153\` instead of ×1.18.
- At \`affinityResistance: 0.20\` (The Silent Infarct), strong match gives \`1 + 0.18 × 0.80 = ×1.144\`.

**Quick reference at various resistance values:**

| affinityResistance | Strong-Match ×Mult |
|---|---|
| 0.00 (Ch1 enemies) | ×1.180 |
| 0.05 (Ch3 normal) | ×1.171 |
| 0.08 (Ch4 normal) | ×1.165 |
| 0.10 (Ch5–8) | ×1.162 |
| 0.12 (Ch9 real-ward) | ×1.158 |
| 0.15 (Lord Imbalance, Verdantha) | ×1.153 |
| 0.20 (Silent Infarct) | ×1.144 |

---

### Care Chain Bonuses

A Care Chain is built by using skills whose \`chainRoles\` connect. Bonuses are applied as \`careChainMod\` (future slot, currently ×1.00 except as noted below — these values reflect the intended design from Push 13 and may not yet be multiplied in).

**Push 13 target values:**

| Chain Length | Strike Bonus | Stabilize Bonus | Notes |
|---|---|---|---|
| 1 link | Small bonus | Small bonus | Per-step size: +6% per link |
| 2 links | +12% | +12% | — |
| 3 links | +18% | +18% | — |
| 4 links | +24% | +24% | — |
| ≥5 links (full chain) | **+25%** | **+18%** | Stabilize cap is lower than Strike cap |

**Parameters (Push 13):** Step size 6% · Strike full-chain cap +25% · Stabilize full-chain cap +18%.

---`;

// ─── assemble full document ───────────────────────────────────────────────────

function buildDocument(): string {
  const totalEnemies = ENEMIES.filter(e => !e.isAffliction && !e.worldBoss).length;
  const totalAff = AFFLICTION_ENEMIES.length;

  return `# Battle Audit Reference

**Source files:** \`frontend/src/game/content.ts\`, \`frontend/src/game/skillCalc.ts\`
**Generated by:** \`scripts/generate-battle-audit.ts\` — run \`npm run gen:battle-audit\` to regenerate

This document compiles every enemy's full stat block, the complete formula chains for Strike / Stabilize / Shield, reference tables for stat multipliers, affinity modifiers, and care chain bonuses, and the chapter pool membership for each enemy. It is intended to be readable in any Markdown viewer or on GitHub for balance work without running the app.

${totalEnemies} main enemies · ${totalAff} wave afflictions · 3 named bosses

---

## Table of Contents

1. [Enemy Stat Blocks](#1-enemy-stat-blocks)
   - [Chapter 1 — Introduction](#chapter-1--introduction-difficulty-1)
   - [Chapter 2 — Escalation](#chapter-2--escalation-difficulty-2)
   - [Chapter 3 — Complexity](#chapter-3--complexity-difficulty-3)
   - [Chapter 4 — Code Rush / Priority](#chapter-4--code-rush--priority-difficulty-4)
   - [Chapter 5 — Sanctuary / Recovery](#chapter-5--sanctuary--recovery-difficulty-5)
   - [Chapter 6 Trial Boss](#chapter-6-trial-boss-difficulty-6)
   - [Chapter 7 Trial Bosses](#chapter-7-trial-bosses-difficulty-7)
   - [Chapter 8 Trial Boss](#chapter-8-trial-boss-difficulty-8)
   - [Chapter 9 — Real-Ward Counterparts](#chapter-9--real-ward-counterparts-difficulty-9)
   - [Named Bosses](#named-bosses)
   - [Wave Afflictions](#wave-afflictions)
2. [Formulas](#2-formulas)
   - [Strike](#strike-formula)
   - [Stabilize](#stabilize-formula)
   - [Shield](#shield-formula)
3. [Reference Tables](#3-reference-tables)
   - [statToMultiplier](#stattomultiplier-table)
   - [Affinity Modifier (Treatment Correctness)](#affinity-modifier-treatment-correctness)
   - [Affinity Family Modifier](#affinity-family-modifier)
   - [Care Chain Bonuses](#care-chain-bonuses)
4. [Chapter Pools](#4-chapter-pools)

---

## Column Key

| Column | Meaning |
|---|---|
| **HP (Corr)** | Starting Corruption — reduce to 0 to win |
| **Stab** | Starting Stability — if this hits 0, the player loses |
| **Instab** | Instability — added to enemy HP each turn the player doesn't act |
| **Corr Resist %** | \`corruptionResistance × 100\` — Strike is multiplied by \`(1 − this)\` |
| **Stab Resist %** | \`stabilityResistance × 100\` — Stabilize final value multiplied by \`(1 − this)\` |
| **Hidden Def %** | \`hiddenDefense × 100\` — all effects reduced by \`hiddenDefense × unrevealed_fraction\`; drops to 0 when all clues revealed |
| **Stab Press %** | \`stabilityPressure × 100\` — end-of-turn stability drain |
| **Aff Resist %** | \`affinityResistance × 100\` — dampens the affinity-family strong-match bonus only |
| **System** | Primary elemental system |
| **Weakness** | Element that grants +30% base for Strike (additive pre-multiply) |
| **Flags** | BOSS = \`bossGuard:true\`; WORLD BOSS = \`worldBoss:true\`; SCRIPTED LOSS = \`scriptedLoss:true\`; AFFLICTION = \`isAffliction:true\`; TRIAL = chapter mini-boss node enemy |

---

## 1. Enemy Stat Blocks

${buildEnemyStatBlocks()}

## 2. Formulas

${FORMULAS_SECTION.replace(/^## 2\. Formulas\n\n/, '')}

## 3. Reference Tables

### statToMultiplier Table

**Formula:** \`min(1.40, max(0.90, 1.0 + (stat − 10) / 75))\`

Baseline: stat 10 → ×1.00. Each point above/below shifts by ±0.0133̄.

${buildStatTable()}

**Hero stat → skill type mapping:**

| Stat | Used by |
|---|---|
| \`insight\` | \`scout\`, \`analyze\` |
| \`carePower\` | \`stabilize\`, \`support\`, \`cleanse\` |
| \`intervention\` | \`strike\`, \`counter\` |
| \`guard\` | \`shield\` (always, regardless of skill type) |
| \`coordination\` | \`command\` |

---

${AFFINITY_SECTIONS}

## 4. Chapter Pools

Chapter pools are built by filtering \`ENEMIES\` where \`e.difficulty === chapter\` and \`!e.worldBoss\` and \`!e.isAffliction\`. Named bosses exported separately (\`BOSS_LORD_IMBALANCE\`, \`BOSS_SILENT_INFARCT\`) are not in \`ENEMIES\` and are never in the pool. \`BOSS_VERDANTHA\` is in \`ENEMIES\` but is excluded by \`worldBoss: true\`.

${buildChapterPools()}

---

${buildBalanceSummary()}
`.trimEnd() + '\n';
}

// ─── main ─────────────────────────────────────────────────────────────────────

const CHECK_MODE = process.argv.includes('--check');
const OUT_PATH = path.resolve(__dirname, '../../docs/battle-audit.md');

const generated = buildDocument();

if (CHECK_MODE) {
  if (!fs.existsSync(OUT_PATH)) {
    console.error('✗ [check:battle-audit] docs/battle-audit.md does not exist. Run: npm run gen:battle-audit');
    process.exit(1);
  }
  const existing = fs.readFileSync(OUT_PATH, 'utf8');
  if (existing === generated) {
    console.log('✓ [check:battle-audit] docs/battle-audit.md is up to date.');
    process.exit(0);
  }

  // Produce a clear diff-style error showing what changed
  const existingLines = existing.split('\n');
  const generatedLines = generated.split('\n');
  let diffCount = 0;
  const diffLines: string[] = [];
  const maxLines = Math.max(existingLines.length, generatedLines.length);
  for (let i = 0; i < maxLines; i++) {
    if (existingLines[i] !== generatedLines[i]) {
      diffCount++;
      if (diffCount <= 20) {
        diffLines.push(`  Line ${i + 1}:`);
        if (existingLines[i] !== undefined) diffLines.push(`  - ${existingLines[i]}`);
        if (generatedLines[i] !== undefined) diffLines.push(`  + ${generatedLines[i]}`);
      }
    }
  }
  console.error(`✗ [check:battle-audit] docs/battle-audit.md is stale — ${diffCount} line(s) differ.`);
  if (diffLines.length) {
    console.error('\nFirst differing lines (- existing / + generated):');
    diffLines.forEach(l => console.error(l));
    if (diffCount > 20) console.error(`  … and ${diffCount - 20} more.`);
  }
  console.error('\nFix: run  npm run gen:battle-audit  from the frontend/ directory.');
  process.exit(1);
} else {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, generated, 'utf8');
  const lineCount = generated.split('\n').length;
  console.log(`✓ [gen:battle-audit] docs/battle-audit.md written (${lineCount} lines).`);
}
