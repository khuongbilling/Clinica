// Elemental Counter Overhaul — Push 1 tests
// Covers data schema migration, calculation correctness, and integration via applySkill.
// Run: npx sucrase-node tests/elemental_counter.test.ts

import {
  calcStrikeEffect,
  calcStabilizeEffect,
  neutralModifiers,
} from '../src/game/skillCalc';
import { applySkill, initBattle } from '../src/game/battle';
import { ENEMIES, AFFLICTION_ENEMIES, BOSS_LORD_IMBALANCE, BOSS_SILENT_INFARCT, HEROES } from '../src/game/content';
import type { Enemy, HeroSkill } from '../src/game/types';

// ── Test harness ──────────────────────────────────────────────────────────────
type Result = { name: string; pass: boolean; details?: string };
const results: Result[] = [];

function check(name: string, cond: boolean, details = '') {
  results.push({ name, pass: !!cond, details });
  console.log(`${cond ? 'PASS' : 'FAIL'} – ${name}${cond ? '' : ` :: ${details}`}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Mirrors the battle.ts expression for elementBonus. */
function getElementBonus(skillType: string, enemy: Enemy, heroElement: string): number {
  return skillType === 'strike' && !!enemy.weakElement && heroElement === enemy.weakElement
    ? 0.3 : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — Matching element on a 'strike' skill → ×1.30
// ─────────────────────────────────────────────────────────────────────────────
{
  const enemy = { weakElement: 'River' } as Pick<Enemy, 'weakElement'>;
  const bonus = getElementBonus('strike', enemy as Enemy, 'River');
  const base = 100;
  const result = calcStrikeEffect(base, { ...neutralModifiers(), elementBonus: bonus });
  const expected = Math.round(base * 1.3);
  check(
    'Test 1 – Matching element on strike: ×1.30 bonus',
    bonus === 0.3 && result === expected,
    `bonus=${bonus}, result=${result}, expected=${expected}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — Non-matching element on a 'strike' skill → ×1.00 (no bonus)
// ─────────────────────────────────────────────────────────────────────────────
{
  const enemy = { weakElement: 'River' } as Pick<Enemy, 'weakElement'>;
  const bonus = getElementBonus('strike', enemy as Enemy, 'Fire'); // different element
  const base = 100;
  const result = calcStrikeEffect(base, { ...neutralModifiers(), elementBonus: bonus });
  check(
    'Test 2 – Non-matching element on strike: ×1.00',
    bonus === 0 && result === base,
    `bonus=${bonus}, result=${result}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — Matching element on a NON-STRIKE skill → elementBonus = 0
// battle.ts gates elementBonus on skill.type === 'strike'; command/analyze/etc.
// that carry a strike payload must not receive the +30% bonus.
// ─────────────────────────────────────────────────────────────────────────────
{
  const enemy = { weakElement: 'River' } as Pick<Enemy, 'weakElement'>;
  const cmdBonus     = getElementBonus('command', enemy as Enemy, 'River');
  const analyzeBonus = getElementBonus('analyze',  enemy as Enemy, 'River');
  const stabilizeBonus = getElementBonus('stabilize', enemy as Enemy, 'River');
  check(
    'Test 3 – Non-strike skill types: elementBonus always 0 even on element match',
    cmdBonus === 0 && analyzeBonus === 0 && stabilizeBonus === 0,
    `command=${cmdBonus}, analyze=${analyzeBonus}, stabilize=${stabilizeBonus}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — Inappropriate treatment + element counter = ×0.325
// Spec requires: inappropriate strike = ×0.25 clinical × ×1.30 element = ×0.325
// base=100 → Math.round(100 * 1.30 * 0.25) = Math.round(32.5) = 33
// ─────────────────────────────────────────────────────────────────────────────
{
  const base = 100;
  const clinicalMod = 0.25;  // inappropriate (getCorruptionOutcome('inappropriate').reductionMult)
  const elementBonus = 0.3;  // matching element → ×1.30 multiplier
  const result = calcStrikeEffect(base, { ...neutralModifiers(), clinicalMod, elementBonus });
  const expected = Math.round(base * 1.3 * clinicalMod); // 33
  check(
    'Test 4 – Inappropriate treatment + counter: base×1.30×0.25 = ×0.325',
    result === expected,
    `result=${result}, expected=${expected}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 — Strong clinical, no element counter → ×1.60
// code value: strong → clinicalMod = 1.6; no element match
// base=100 → Math.round(100 * 1.0 * 1.6) = 160
// ─────────────────────────────────────────────────────────────────────────────
{
  const base = 100;
  const clinicalMod = 1.6;  // strong treatment (getCorruptionOutcome('strong').reductionMult)
  const elementBonus = 0;   // no element counter
  const result = calcStrikeEffect(base, { ...neutralModifiers(), clinicalMod, elementBonus });
  const expected = Math.round(base * 1.6);
  check(
    'Test 5 – Strong clinical, no counter: ×1.60',
    result === expected,
    `result=${result}, expected=${expected}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6 — Full optimal: strong clinical + element match + strong affinity
// clinicalMod=1.6, elementBonus=0.3, affinityFamilyMod=1.18 (Push 13 value)
// base=100 → Math.round(100 * 1.3 * 1.6 * 1.18) = Math.round(245.44) = 245
// ─────────────────────────────────────────────────────────────────────────────
{
  const base = 100;
  const clinicalMod = 1.6;
  const elementBonus = 0.3;
  const affinityFamilyMod = 1.18;
  const result = calcStrikeEffect(base, {
    ...neutralModifiers(),
    clinicalMod,
    elementBonus,
    affinityFamilyMod,
  });
  const expected = Math.round(base * 1.3 * clinicalMod * affinityFamilyMod);
  check(
    'Test 6 – Full optimal (strong + element + affinity): combined multiplier correct',
    result === expected,
    `result=${result}, expected=${expected}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 7 — null weakElement: no element bonus regardless of hero element
// ─────────────────────────────────────────────────────────────────────────────
{
  const enemy = { weakElement: null } as Pick<Enemy, 'weakElement'>;
  const bonus = getElementBonus('strike', enemy as Enemy, 'Air');
  const base = 100;
  const result = calcStrikeEffect(base, { ...neutralModifiers(), elementBonus: bonus });
  check(
    'Test 7 – null weakElement: no bonus on any element',
    bonus === 0 && result === base,
    `bonus=${bonus}, result=${result}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 8 — Verdantha phase override DATA STRUCTURE (Push 1 scope only)
// NOTE: These tests verify that the phases array is present and correctly shaped.
// Runtime phase resolution (switching weakElement mid-boss-fight) is Push 3 scope
// and is NOT tested or implemented here.
// Default weakElement = Forge; phases array: Forge → Filter → null
// ─────────────────────────────────────────────────────────────────────────────
{
  const verdantha = ENEMIES.find(e => e.id === 'verdantha');
  const ph1 = verdantha?.phases?.[0];
  const ph2 = verdantha?.phases?.[1];
  const ph3 = verdantha?.phases?.[2];
  check('Test 8a – [Data] Verdantha default weakElement = Forge',
    verdantha?.weakElement === 'Forge', `got ${verdantha?.weakElement}`);
  check('Test 8b – [Data] Verdantha phases[0] has phaseId=phase1, weakElementOverride=Forge',
    ph1?.phaseId === 'phase1' && ph1?.weakElementOverride === 'Forge', `ph1=${JSON.stringify(ph1)}`);
  check('Test 8c – [Data] Verdantha phases[1] has phaseId=phase2, weakElementOverride=Filter',
    ph2?.phaseId === 'phase2' && ph2?.weakElementOverride === 'Filter', `ph2=${JSON.stringify(ph2)}`);
  check('Test 8d – [Data] Verdantha phases[2] has phaseId=phase3, weakElementOverride=null',
    ph3?.phaseId === 'phase3' && ph3?.weakElementOverride === null, `ph3=${JSON.stringify(ph3)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 9 — Integration via applySkill: 'command' skill with strike payload
//           must NOT receive elementBonus even when hero.element === enemy.weakElement
//
// Setup:
//   enemy: dehydration_wisp (weakElement: 'River')
//   hero:  night_watcher   (element:     'River')
//   skill: rally_bell ID, but typed as 'command' (has strike payload)
//   control: same skill against enemy where weakElement ≠ hero.element
//
// If elementBonus is correctly gated on skill.type === 'strike', both battles
// must produce the same corruption reduction.
// ─────────────────────────────────────────────────────────────────────────────
{
  const wisp = ENEMIES.find(e => e.id === 'dehydration_wisp');
  const nightWatcher = HEROES.find(h => h.id === 'night_watcher');

  if (!wisp || !nightWatcher) {
    check('Test 9 – Integration setup: wisp + night_watcher found', false,
      `wisp=${!!wisp}, nightWatcher=${!!nightWatcher}`);
  } else {
    // Deterministic mock skill — no strikeRange so base is always fixed.
    // Uses rally_bell ID so SKILL_CLINICAL lookup resolves correctly.
    const BASE = { id: 'rally_bell', name: 'Rally Bell',
      systemType: 'Universal' as const, cost: 0, description: '', shortEffect: '' };
    const cmdSkill  = { ...BASE, type: 'command' as const, strike: 100 } as HeroSkill;
    const strkSkill = { ...BASE, type: 'strike'  as const, strike: 100 } as HeroSkill;

    // Use high corruption so neither strike saturates the enemy (corruption → 0).
    // wisp.corruption = 58; strike: 100 would deplete it in both match/no-match cases
    // and mask the bonus. 1000 is safely above any base×mods product for these skills.
    const wispHigh        = { ...wisp, corruption: 1000 } as Enemy;
    const wispHighNoMatch = { ...wisp, corruption: 1000, weakElement: 'Forge' } as Enemy;

    // Initialize battle states (identical except weakElement on the enemy).
    const stateMatch   = initBattle(wispHigh,        [nightWatcher], { chapter: 1, inventory: {} });
    const stateNoMatch = initBattle(wispHighNoMatch, [nightWatcher], { chapter: 1, inventory: {} });

    // ── 9a: command skill — no element bonus expected
    const rCmdMatch   = applySkill(stateMatch,   cmdSkill,  nightWatcher);
    const rCmdNoMatch = applySkill(stateNoMatch, cmdSkill,  nightWatcher);
    const dmgCmdMatch   = stateMatch.corruption   - rCmdMatch.state.corruption;
    const dmgCmdNoMatch = stateNoMatch.corruption - rCmdNoMatch.state.corruption;
    check(
      'Test 9a – Integration: command skill damage is equal regardless of element match',
      dmgCmdMatch === dmgCmdNoMatch,
      `dmgMatch=${dmgCmdMatch}, dmgNoMatch=${dmgCmdNoMatch}`,
    );

    // ── 9b: strike skill — 30% more damage when elements match
    const rStrkMatch   = applySkill(stateMatch,   strkSkill, nightWatcher);
    const rStrkNoMatch = applySkill(stateNoMatch, strkSkill, nightWatcher);
    const dmgStrkMatch   = stateMatch.corruption   - rStrkMatch.state.corruption;
    const dmgStrkNoMatch = stateNoMatch.corruption - rStrkNoMatch.state.corruption;
    const ratio = dmgStrkNoMatch > 0 ? dmgStrkMatch / dmgStrkNoMatch : 0;
    check(
      'Test 9b – Integration: strike skill damage is higher when element matches (~×1.30)',
      dmgStrkMatch > dmgStrkNoMatch && Math.abs(ratio - 1.3) < 0.15,
      `dmgMatch=${dmgStrkMatch}, dmgNoMatch=${dmgStrkNoMatch}, ratio=${ratio.toFixed(3)}`,
    );

    // ── 9c: stabilize-type skill with strike payload — no bonus
    const stabSkill = { ...BASE, type: 'stabilize' as const, strike: 100 } as HeroSkill;
    const rStabMatch   = applySkill(stateMatch,   stabSkill, nightWatcher);
    const rStabNoMatch = applySkill(stateNoMatch, stabSkill, nightWatcher);
    const dmgStabMatch   = stateMatch.corruption   - rStabMatch.state.corruption;
    const dmgStabNoMatch = stateNoMatch.corruption - rStabNoMatch.state.corruption;
    check(
      'Test 9c – Integration: stabilize skill (with strike payload) has no element bonus',
      dmgStabMatch === dmgStabNoMatch,
      `dmgMatch=${dmgStabMatch}, dmgNoMatch=${dmgStabNoMatch}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 10 — Legacy field isolation: all enemies have weakElement; none have weakSystem
// ─────────────────────────────────────────────────────────────────────────────
{
  const allEnemies: Enemy[] = [
    ...ENEMIES,
    ...AFFLICTION_ENEMIES,
    BOSS_LORD_IMBALANCE,
    BOSS_SILENT_INFARCT,
  ];

  const missingWeakElement = allEnemies.filter(
    e => !Object.prototype.hasOwnProperty.call(e, 'weakElement'),
  );
  const hasLegacyWeakSystem = allEnemies.filter(
    e => Object.prototype.hasOwnProperty.call(e, 'weakSystem'),
  );

  check('Test 10a – All enemies have weakElement field',
    missingWeakElement.length === 0,
    `Missing: ${missingWeakElement.map(e => e.id).join(', ')}`);
  check('Test 10b – No enemy retains deprecated weakSystem field',
    hasLegacyWeakSystem.length === 0,
    `Still has weakSystem: ${hasLegacyWeakSystem.map(e => e.id).join(', ')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bonus: verify migration table for the 9 scripted enemies
// ─────────────────────────────────────────────────────────────────────────────
{
  const find = (id: string): Enemy | undefined =>
    [...ENEMIES, ...AFFLICTION_ENEMIES, BOSS_LORD_IMBALANCE, BOSS_SILENT_INFARCT].find(e => e.id === id);

  const expected: Record<string, string | null> = {
    dehydration_wisp:    'River',
    fluid_phantom:       'River',
    dehydration_specter: 'River',
    fever_shade:         'River',
    gale_spirit:         'Air',
    ward_cascade:        'Protection',
    verdantha:           'Forge',
    lord_imbalance:      'River',
    silent_infarct:      'Storm',
  };

  for (const [id, we] of Object.entries(expected)) {
    const e = find(id);
    check(`Migration – ${id}: weakElement = ${we}`,
      !!(e && e.weakElement === we), `got ${e?.weakElement}`);
  }

  check('Migration – ward_cascade: primaryAffinity = Community / Public Health',
    find('ward_cascade')?.primaryAffinity === 'Community / Public Health',
    `got ${find('ward_cascade')?.primaryAffinity}`);

  check('Migration – silent_infarct: primaryAffinity = Storm / Cardiac',
    find('silent_infarct')?.primaryAffinity === 'Storm / Cardiac',
    `got ${find('silent_infarct')?.primaryAffinity}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 11 — initBattle dev-mode warning fires for legacy weakSystem
// A synthetic enemy that still carries a weakSystem field (and weakElement) must
// trigger console.warn. An enemy with only weakElement must not.
// ─────────────────────────────────────────────────────────────────────────────
{
  const wisp = ENEMIES.find(e => e.id === 'dehydration_wisp');
  const nw   = HEROES.find(h => h.id === 'night_watcher');

  if (!wisp || !nw) {
    check('Test 11 – Warning test setup', false, 'wisp or night_watcher not found');
  } else {
    // Enemy with legacy weakSystem still attached
    const legacyEnemy = { ...wisp, weakSystem: 'Fire', weakElement: 'River' } as any;
    // Enemy without weakSystem
    const cleanEnemy  = { ...wisp } as any; // weakSystem not present

    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (...args: any[]) => { warnings.push(String(args[0])); };

    try {
      initBattle(legacyEnemy, [nw], { chapter: 1, inventory: {} });
      const legacyWarned = warnings.some(w => w.includes('weakSystem') && w.includes(wisp.id));

      warnings.length = 0; // reset
      initBattle(cleanEnemy, [nw], { chapter: 1, inventory: {} });
      const cleanWarned = warnings.some(w => w.includes('weakSystem'));

      check(
        'Test 11a – initBattle warns when legacy weakSystem is present',
        legacyWarned,
        `warnings captured: ${warnings.join(' | ')}`,
      );
      check(
        'Test 11b – initBattle does NOT warn for clean enemy (only weakElement)',
        !cleanWarned,
        `unexpected warning: ${warnings.join(' | ')}`,
      );
    } finally {
      console.warn = orig;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 12 — getSystemMatchModifier is fully neutralized (always 1.0)
// After Push 1, ENEMY_CLINICAL.weaknesses/resistances must not grant a bonus or
// penalty via systemMod. The only elemental modifier is weakElement → elementBonus.
// ─────────────────────────────────────────────────────────────────────────────
import { getSystemMatchModifier } from '../src/game/clinical';
{
  // 12a: historically strong match (River vs fluid enemy with weaknesses:['River'])
  // must now return 1.0, not 1.5.
  const fluidClinical = { weaknesses: ['River'], resistances: ['Fire'] } as any;
  const matchMod = getSystemMatchModifier('River', fluidClinical, 'River');
  check(
    'Test 12a – getSystemMatchModifier: element match returns 1.0 (no second strike advantage)',
    matchMod === 1.0,
    `got ${matchMod}, expected 1.0`,
  );

  // 12b: historically resistant (Fire vs fluid enemy with resistances:['Fire'])
  // must now return 1.0, not 0.5.
  const resistMod = getSystemMatchModifier('Fire', fluidClinical, 'River');
  check(
    'Test 12b – getSystemMatchModifier: resistance entry returns 1.0 (clinical resistance handled by tags)',
    resistMod === 1.0,
    `got ${resistMod}, expected 1.0`,
  );

  // 12c: off-system (Mind vs fluid enemy) — must return 1.0, not 0.25.
  const offMod = getSystemMatchModifier('Mind', fluidClinical, 'River');
  check(
    'Test 12c – getSystemMatchModifier: off-system returns 1.0 (neutralized)',
    offMod === 1.0,
    `got ${offMod}, expected 1.0`,
  );

  // 12d: integration — strike skill with systemType matching ENEMY_CLINICAL.weaknesses
  // must deal the same damage as a strike with a non-matching systemType.
  // The ONLY way to get extra strike damage is hero.element === enemy.weakElement.
  const wisp12 = ENEMIES.find(e => e.id === 'dehydration_wisp');
  const nw12   = HEROES.find(h => h.id === 'night_watcher');
  if (!wisp12 || !nw12) {
    check('Test 12d – Integration: setup failed', false, 'wisp or night_watcher not found');
  } else {
    // Both skills are 'strike' type but with different systemTypes.
    // River matches ENEMY_CLINICAL.weaknesses for dehydration_wisp; Universal does not.
    // After neutralization, both should deal the same damage.
    const BASE12 = { id: 'rally_bell', name: 'Test', cost: 0, description: '', shortEffect: '' };
    const riverStrike = { ...BASE12, type: 'strike' as const, strike: 100,
      systemType: 'River' as const } as HeroSkill;
    const univStrike  = { ...BASE12, type: 'strike' as const, strike: 100,
      systemType: 'Universal' as const } as HeroSkill;

    // Use a hero whose element is NOT River so weakElement bonus doesn't fire.
    const nonRiverHero = { ...nw12, element: 'Fire' } as any;
    const state12 = initBattle({ ...wisp12, corruption: 1000 } as any, [nonRiverHero],
      { chapter: 1, inventory: {} });

    const rRiver = applySkill(state12, riverStrike,  nonRiverHero);
    const rUniv  = applySkill(state12, univStrike,   nonRiverHero);
    const dmgRiver = state12.corruption - rRiver.state.corruption;
    const dmgUniv  = state12.corruption - rUniv.state.corruption;
    check(
      'Test 12d – Integration: ENEMY_CLINICAL River weakness no longer boosts River strike vs Universal',
      dmgRiver === dmgUniv,
      `dmgRiver=${dmgRiver}, dmgUniv=${dmgUniv}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 13 — initBattle validator covers all Push 1 required fields
// ─────────────────────────────────────────────────────────────────────────────
{
  const wisp13 = ENEMIES.find(e => e.id === 'dehydration_wisp');
  const nw13   = HEROES.find(h => h.id === 'night_watcher');

  if (!wisp13 || !nw13) {
    check('Test 13 – setup failed', false, 'wisp or night_watcher not found');
  } else {
    const orig = console.warn;
    let warnings: string[] = [];
    console.warn = (...args: any[]) => { warnings.push(String(args[0])); };

    try {
      // 13a: invalid weakElement value triggers a warning
      warnings = [];
      initBattle({ ...wisp13, weakElement: 'NotAnElement' as any } as any, [nw13], { chapter: 1, inventory: {} });
      check(
        'Test 13a – validator warns on invalid weakElement string',
        warnings.some(w => w.includes('not a valid ElementSystem')),
        `warnings: ${warnings.join(' | ')}`,
      );

      // 13b: missing corruptionAspect triggers a warning
      warnings = [];
      const { corruptionAspect: _omit, ...wispNoAspect } = wisp13 as any;
      initBattle(wispNoAspect as any, [nw13], { chapter: 1, inventory: {} });
      check(
        'Test 13b – validator warns on missing corruptionAspect',
        warnings.some(w => w.includes('corruptionAspect')),
        `warnings: ${warnings.join(' | ')}`,
      );

      // 13c: secondaryAffinities as a string (legacy shape) triggers a warning
      warnings = [];
      initBattle({ ...wisp13, secondaryAffinities: 'Fluid / Hydration' as any } as any, [nw13], { chapter: 1, inventory: {} });
      check(
        'Test 13c – validator warns when secondaryAffinities is a string',
        warnings.some(w => w.includes('secondaryAffinities')),
        `warnings: ${warnings.join(' | ')}`,
      );

      // 13d: missing secondaryAffinities field entirely triggers a warning
      warnings = [];
      const { secondaryAffinities: _omit2, ...wispNoAffinities } = wisp13 as any;
      initBattle(wispNoAffinities as any, [nw13], { chapter: 1, inventory: {} });
      check(
        'Test 13d – validator warns when secondaryAffinities is absent',
        warnings.some(w => w.includes('secondaryAffinities') && w.includes('missing')),
        `warnings: ${warnings.join(' | ')}`,
      );

      // 13e: deprecated secondaryAffinity (single) triggers a warning
      warnings = [];
      initBattle({ ...wisp13, secondaryAffinity: 'Fluid / Hydration' as any } as any, [nw13], { chapter: 1, inventory: {} });
      check(
        'Test 13d – validator warns on deprecated secondaryAffinity (single)',
        warnings.some(w => w.includes('secondaryAffinity') && w.includes('legacy')),
        `warnings: ${warnings.join(' | ')}`,
      );

      // 13e: clean enemy (all Push 1 fields correct) emits no validator warnings
      warnings = [];
      initBattle(wisp13, [nw13], { chapter: 1, inventory: {} });
      check(
        'Test 13e – clean enemy emits no validator warnings',
        !warnings.some(w => w.startsWith('[Enemy:')),
        `unexpected: ${warnings.filter(w => w.startsWith('[Enemy:')).join(' | ')}`,
      );
    } finally {
      console.warn = orig;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 14 — dev-mode strike breakdown log is emitted from applySkill
// ─────────────────────────────────────────────────────────────────────────────
{
  const wisp14 = ENEMIES.find(e => e.id === 'dehydration_wisp');
  const nw14   = HEROES.find(h => h.id === 'night_watcher');

  if (!wisp14 || !nw14) {
    check('Test 14 – setup failed', false, 'wisp or night_watcher not found');
  } else {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => { if (String(args[0]).startsWith('[Strike]')) logs.push(String(args[0])); };

    try {
      const BASE14 = { id: 'rally_bell', name: 'TestStrike', cost: 0, description: '', shortEffect: '' };
      const strkSkill14 = { ...BASE14, type: 'strike' as const, strike: 50 } as HeroSkill;
      const state14 = initBattle({ ...wisp14, corruption: 200 } as any, [nw14], { chapter: 1, inventory: {} });
      applySkill(state14, strkSkill14, nw14);

      check(
        'Test 14a – applySkill emits [Strike] breakdown log in dev mode',
        logs.length > 0 && logs[0].includes('base=') && logs[0].includes('final='),
        `logs: ${logs[0] ?? 'none'}`,
      );

      // 14b: when element matches, log contains "elem=" to surface the counter
      logs.length = 0;
      const elemEnemy = { ...wisp14, weakElement: nw14.element, corruption: 200 } as any;
      const elemState = initBattle(elemEnemy, [nw14], { chapter: 1, inventory: {} });
      applySkill(elemState, strkSkill14, nw14);
      check(
        'Test 14b – breakdown log includes elem= when weakElement matches hero element',
        logs.some(l => l.includes('elem=')),
        `logs: ${logs[0] ?? 'none'}`,
      );

      // 14c: no [Strike] log for stabilize actions (breakdown is strike-only)
      logs.length = 0;
      const stabSkill14 = { ...BASE14, type: 'stabilize' as const, stabilize: 20 } as HeroSkill;
      applySkill(state14, stabSkill14, nw14);
      check(
        'Test 14c – no [Strike] breakdown log emitted for stabilize actions',
        logs.length === 0,
        `unexpected: ${logs[0] ?? ''}`,
      );
    } finally {
      console.log = origLog;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass).length;
console.log(`\n${passed} passed, ${failed} failed (${results.length} total)`);
if (failed > 0) process.exit(1);
