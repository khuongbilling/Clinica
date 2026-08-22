/**
 * Age 1 Ward Defense domain model.
 *
 * This is intentionally independent of the animated board.  Scenario selection,
 * encounter pacing, response matching, clinical checks, records and reward
 * eligibility can therefore be tested without rendering a run.
 */

export type WardResponseTag =
  | 'airway' | 'oxygenation' | 'perfusion' | 'infection_control'
  | 'metabolic' | 'assessment' | 'rapid_response';

export const WARD_RESPONSE_LABELS: Record<WardResponseTag, string> = {
  airway: 'Airway',
  oxygenation: 'Oxygenation',
  perfusion: 'Perfusion',
  infection_control: 'Infection Control',
  metabolic: 'Metabolic',
  assessment: 'Assessment',
  rapid_response: 'Rapid Response',
};

export type WardPoint = readonly [number, number];
export type WardWave = { id: string; spawns: string[]; threatTags: WardResponseTag[] };

export interface WardScenario {
  id: string;
  name: string;
  subtitle: string;
  unlockLevel: number;
  path: WardPoint[];
  deployPads: WardPoint[];
  airLanes: { from: WardPoint; to: WardPoint }[];
  hazards: string[];
  mechanics: string[];
  normalWaves: readonly WardWave[];
  boss: WardWave;
  overtime: { scoreMultiplier: number; corruptionPerWave: number; maxRecordWave: number };
}

const PAD_GRID: WardPoint[] = [
  [0.345, 0.350], [0.510, 0.350], [0.675, 0.350],
  [0.345, 0.493], [0.510, 0.493], [0.675, 0.493],
  [0.345, 0.626], [0.510, 0.626], [0.675, 0.626],
];

const TEMPLATES: readonly WardWave[] = [
  { id: 'w1', spawns: ['breathless_wisp', 'panic_imp', 'breathless_wisp'], threatTags: ['assessment', 'airway'] },
  { id: 'w2', spawns: ['breathless_wisp', 'wheeze_sprite', 'panic_imp', 'wheeze_sprite'], threatTags: ['airway', 'oxygenation'] },
  { id: 'w3', spawns: ['wheeze_sprite', 'mucus_slime', 'fever_imp', 'spore_drift', 'panic_imp'], threatTags: ['infection_control', 'airway'] },
  { id: 'w4', spawns: ['hypoxia_wraith', 'spore_drift', 'mucus_slime', 'fever_imp', 'stun_toad'], threatTags: ['oxygenation', 'infection_control'] },
  { id: 'w5', spawns: ['shock_shade', 'stun_toad', 'spore_drift', 'wheeze_sprite', 'corruption_leech'], threatTags: ['perfusion', 'rapid_response'] },
  { id: 'w6', spawns: ['spore_drift', 'hypoxia_wraith', 'corruption_leech', 'fever_imp', 'shock_shade', 'stun_toad'], threatTags: ['rapid_response', 'metabolic'] },
];

const BOSS: WardWave = {
  id: 'boss',
  spawns: ['bronchospasm_drake'],
  threatTags: ['assessment', 'airway', 'oxygenation'],
};

function scenario(
  id: string, name: string, subtitle: string, unlockLevel: number,
  path: WardPoint[], mechanics: string[], hazards: string[], airLanes: WardScenario['airLanes'] = [],
): WardScenario {
  return {
    id, name, subtitle, unlockLevel, path, deployPads: PAD_GRID, airLanes, mechanics, hazards,
    normalWaves: TEMPLATES.map((wave, index) => ({
      ...wave,
      id: `${id}_${wave.id}`,
      // Later maps move pressure earlier without changing the fixed six-wave pacing.
      spawns: index >= 3 && unlockLevel >= 6 ? [...wave.spawns, 'panic_imp'] : [...wave.spawns],
    })),
    boss: { ...BOSS, id: `${id}_boss` },
    overtime: { scoreMultiplier: 1 + Math.min(0.35, unlockLevel * 0.025), corruptionPerWave: 7, maxRecordWave: 20 },
  };
}

export const WARD_SCENARIOS: readonly WardScenario[] = [
  scenario('triage_corridor', 'Triage Corridor', 'Read the first signal, then hold the line.', 1,
    [[.12,.13],[.12,.30],[.86,.30],[.86,.44],[.12,.44],[.12,.58],[.86,.58],[.86,.72],[.86,.13],[.825,.13]],
    ['Priority marks retarget the ward.', 'Early assessment reveals hidden threats.'], ['narrow approach'],
    [{ from: [.12,.13], to: [.825,.13] }]),
  scenario('central_cross', 'Central Cross', 'Four approaches converge under one lantern.', 2,
    [[.12,.22],[.50,.22],[.50,.42],[.15,.42],[.15,.64],[.84,.64],[.84,.40],[.50,.40],[.50,.13],[.825,.13]],
    ['Code Blue triggers when the crossing crowds.', 'Reassess windows last longer at the center.'], ['crossing surge']),
  scenario('sanctuary_courtyard', 'Sanctuary Courtyard', 'Protect open ground from airborne drift.', 3,
    [[.12,.72],[.28,.58],[.12,.43],[.35,.28],[.66,.28],[.88,.45],[.72,.62],[.82,.18],[.825,.13]],
    ['Air lanes split over the courtyard.', 'Protection slows every lane.'], ['open air'], [{ from: [.12,.72], to: [.825,.13] }]),
  scenario('supply_hall', 'Supply Hall', 'Keep the supply route clear under pressure.', 4,
    [[.12,.16],[.76,.16],[.76,.34],[.26,.34],[.26,.53],[.83,.53],[.83,.73],[.35,.73],[.825,.13]],
    ['Corrupted pads lock until cleansed.', 'Supply crates reward targeted responses.'], ['corrupted pads']),
  scenario('isolation_wing', 'Isolation Wing', 'Contain spread before it reaches the lantern.', 5,
    [[.12,.72],[.12,.28],[.38,.28],[.38,.60],[.65,.60],[.65,.30],[.88,.30],[.88,.13],[.825,.13]],
    ['Infection pressure increases after a leak.', 'Isolation responses receive a score bonus.'], ['spread cells'], [{ from: [.12,.28], to: [.825,.13] }]),
  scenario('critical_care_hub', 'Critical Care Hub', 'Escalate quickly through high-acuity turns.', 6,
    [[.12,.44],[.34,.44],[.34,.20],[.65,.20],[.65,.70],[.20,.70],[.84,.70],[.84,.13],[.825,.13]],
    ['Rapid Response counters gain chain score.', 'Code Blue threshold is lower.'], ['acuity surge']),
  scenario('dual_ward', 'Dual Ward', 'Cover parallel lanes without losing the clinical loop.', 8,
    [[.12,.22],[.44,.22],[.44,.48],[.12,.48],[.12,.72],[.88,.72],[.88,.48],[.58,.48],[.58,.13],[.825,.13]],
    ['Two air lanes alternate.', 'Assessment prevents dual-lane ambushes.'], ['dual gates'],
    [{ from: [.12,.22], to: [.825,.13] }, { from: [.12,.72], to: [.825,.13] }]),
  scenario('grand_convergence', 'Grand Convergence', 'Every discipline meets at the final ward.', 10,
    [[.12,.14],[.85,.14],[.85,.34],[.17,.34],[.17,.53],[.85,.53],[.85,.72],[.50,.72],[.50,.13],[.825,.13]],
    ['All response tags appear.', 'Overtime adds rotating mixed threats.'], ['convergence pulse'],
    [{ from: [.12,.14], to: [.825,.13] }, { from: [.85,.14], to: [.825,.13] }]),
];

export const WARD_SCENARIO_BY_ID = Object.fromEntries(
  WARD_SCENARIOS.map((item) => [item.id, item]),
) as Record<string, WardScenario>;

export function unlockedWardScenarios(playerLevel: number): WardScenario[] {
  return WARD_SCENARIOS.filter((scenario) => playerLevel >= scenario.unlockLevel);
}

export type WardRotationState = {
  bag: string[];
  currentScenarioId?: string;
  rotationCompletedIds?: string[];
  dailyKey?: string;
  dailyClaimed?: boolean;
  recentScenarioIds?: string[];
};

/** Deterministic Fisher–Yates makes the persisted bag safe across reloads. */
function seededShuffle<T>(source: readonly T[], seed: string): T[] {
  let state = Array.from(seed).reduce((n, char) => ((n * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
  const next = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 0x100000000; };
  const values = [...source];
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

export function nextWardScenario(
  state: WardRotationState | undefined,
  playerLevel: number,
  seed: string,
): { scenario: WardScenario; state: WardRotationState } {
  const unlocked = unlockedWardScenarios(playerLevel).map((entry) => entry.id);
  if (!unlocked.length) throw new Error('No Ward Defense scenario is unlocked.');
  const validBag = (state?.bag ?? []).filter((id) => unlocked.includes(id));
  const recent = (state?.recentScenarioIds ?? []).filter((id) => unlocked.includes(id)).slice(-1);
  const refill = () => {
    const fresh = seededShuffle(unlocked, seed).filter((id) => id !== recent[0] || unlocked.length === 1);
    return fresh.length ? fresh : seededShuffle(unlocked, `${seed}:fallback`);
  };
  const bag = validBag.length ? validBag : refill();
  const scenarioId = bag[0];
  return {
    scenario: WARD_SCENARIO_BY_ID[scenarioId],
    state: {
      ...state,
      bag: bag.slice(1),
      currentScenarioId: scenarioId,
      recentScenarioIds: [...recent, scenarioId].slice(-2),
      rotationCompletedIds: state?.rotationCompletedIds ?? [],
    },
  };
}

export const ENEMY_THREAT_TAGS: Record<string, WardResponseTag[]> = {
  breathless_wisp: ['assessment', 'oxygenation'],
  wheeze_sprite: ['airway'],
  mucus_slime: ['airway', 'assessment'],
  hypoxia_wraith: ['oxygenation', 'rapid_response'],
  panic_imp: ['assessment'],
  fever_imp: ['infection_control'],
  shock_shade: ['perfusion', 'rapid_response'],
  stun_toad: ['rapid_response'],
  corruption_leech: ['metabolic', 'infection_control'],
  spore_drift: ['infection_control', 'oxygenation'],
  bronchospasm_drake: ['assessment', 'airway', 'oxygenation'],
};

export const UNIT_RESPONSE_TAGS: Record<string, WardResponseTag[]> = {
  ward_scout: ['assessment'],
  reassess_sage: ['assessment', 'rapid_response'],
  mist_caster: ['airway'],
  herbal_chemist: ['metabolic'],
  o2_healer: ['oxygenation'],
  guardian: ['rapid_response', 'perfusion'],
  rhythm_medic: ['perfusion'],
  lantern_scribe: ['assessment', 'infection_control'],
  fever_warden: ['infection_control'],
  airway_sentinel: ['airway', 'oxygenation'],
};

export type WardMatchQuality = 'strong' | 'partial' | 'weak';
export function wardMatchQuality(unitId: string, enemyId: string): WardMatchQuality {
  const responses = UNIT_RESPONSE_TAGS[unitId] ?? [];
  const threats = ENEMY_THREAT_TAGS[enemyId] ?? [];
  const matched = responses.filter((tag) => threats.includes(tag)).length;
  if (matched >= 1) return 'strong';
  // Assessment and rapid response stay viable outside a perfect matchup.
  if (responses.includes('assessment') || responses.includes('rapid_response')) return 'partial';
  return 'weak';
}

export type WardClinicalVariant = 'intro' | 'standard' | 'advanced';
export interface WardClinicalChoice { id: string; text: string; }
export interface WardClinicalQuestion {
  id: string;
  familyId: string;
  variant: WardClinicalVariant;
  chapterTheme: number;
  topic: WardResponseTag;
  prompt: string;
  choices: WardClinicalChoice[];
  correctChoiceId: string;
  rationale: string;
  clinicalPearl: string;
  battleTranslation: string;
  codexId?: string;
}

const THEMES: Array<{ label: string; topic: WardResponseTag }> = [
  { label: 'airway patterns', topic: 'airway' },
  { label: 'oxygen delivery', topic: 'oxygenation' },
  { label: 'perfusion signals', topic: 'perfusion' },
  { label: 'infection containment', topic: 'infection_control' },
  { label: 'metabolic warning signs', topic: 'metabolic' },
  { label: 'focused assessment', topic: 'assessment' },
  { label: 'rapid escalation', topic: 'rapid_response' },
  { label: 'reassessment loops', topic: 'assessment' },
  { label: 'prioritization', topic: 'rapid_response' },
  { label: 'team response', topic: 'perfusion' },
];

const VARIANTS: WardClinicalVariant[] = ['intro', 'standard', 'advanced'];

/**
 * 120 families × 3 variants.  Stable IDs are generated from checked-in family
 * coordinates; no question identity depends on randomized answer position.
 */
export const WARD_CLINICAL_BANK: WardClinicalQuestion[] = THEMES.flatMap((theme, themeIndex) =>
  Array.from({ length: 12 }, (_, conceptIndex) => VARIANTS.map((variant) => {
    const familyId = `ward_c${themeIndex + 1}_${String(conceptIndex + 1).padStart(2, '0')}`;
    const correctId = `${familyId}_${variant}_priority`;
    const label = `${theme.label} concept ${conceptIndex + 1}`;
    return {
      id: `${familyId}_${variant}`,
      familyId,
      variant,
      chapterTheme: themeIndex + 1,
      topic: theme.topic,
      prompt: `During a Ward Defense ${label} check, which response should be prioritized first?`,
      choices: [
        { id: correctId, text: `${WARD_RESPONSE_LABELS[theme.topic]} response guided by the current cue` },
        { id: `${familyId}_${variant}_delay`, text: 'Delay action until every detail is known' },
        { id: `${familyId}_${variant}_unrelated`, text: 'Use an unrelated response without reassessing' },
        { id: `${familyId}_${variant}_document`, text: 'Document first and continue the same plan' },
      ],
      correctChoiceId: correctId,
      rationale: `Prioritize the visible ${WARD_RESPONSE_LABELS[theme.topic].toLowerCase()} cue, then reassess the response.`,
      clinicalPearl: 'Act on urgent cues first; reassessment confirms whether the response worked.',
      battleTranslation: `A correct check primes a ${WARD_RESPONSE_LABELS[theme.topic]} tactical response.`,
      codexId: `ward_${theme.topic}`,
    };
  })).flat(),
);

export const STANDARD_CLINICAL_CHECKS = Object.freeze([
  { id: 'before_wave_1', waveIndex: 0 },
  { id: 'before_wave_3', waveIndex: 2 },
  { id: 'before_boss', waveIndex: 6 },
] as const);

export function shuffledChoices(question: WardClinicalQuestion, seed: string): WardClinicalChoice[] {
  return seededShuffle(question.choices, `${question.id}:${seed}`);
}

export function selectWardClinicalChecks(
  seed: string,
  recentFamilyIds: readonly string[] = [],
  missedFamilyIds: readonly string[] = [],
): WardClinicalQuestion[] {
  const selected: WardClinicalQuestion[] = [];
  const used = new Set<string>();
  const recency = new Set(recentFamilyIds);
  const missed = new Set(missedFamilyIds);
  for (const check of STANDARD_CLINICAL_CHECKS) {
    const preferred = WARD_CLINICAL_BANK.filter((entry) =>
      !used.has(entry.familyId) && (missed.has(entry.familyId) || !recency.has(entry.familyId)));
    const candidates = preferred.length ? preferred : WARD_CLINICAL_BANK.filter((entry) => !used.has(entry.familyId));
    const ordered = seededShuffle(candidates, `${seed}:${check.id}`);
    const question = ordered[0];
    used.add(question.familyId);
    selected.push(question);
  }
  return selected;
}

export interface WardRunRecord {
  bestStars: number;
  bestScore: number;
  bestStability: number;
  highestOvertimeWave: number;
  bestClinicalAccuracy: number;
  clears: number;
}

export function calculateWardStars(stability: number, clinicalAccuracy: number, bossDefeated: boolean): 0 | 1 | 2 | 3 {
  if (!bossDefeated) return 0;
  if (stability >= 75 && clinicalAccuracy >= 0.8) return 3;
  if (stability >= 45 && clinicalAccuracy >= 0.5) return 2;
  return 1;
}

export function updateWardRecord(
  previous: WardRunRecord | undefined,
  result: { stars: number; score: number; stability: number; overtimeWave: number; clinicalAccuracy: number; cleared: boolean },
): WardRunRecord {
  const base: WardRunRecord = previous ?? { bestStars: 0, bestScore: 0, bestStability: 0, highestOvertimeWave: 0, bestClinicalAccuracy: 0, clears: 0 };
  return {
    bestStars: Math.max(base.bestStars, result.stars),
    bestScore: Math.max(base.bestScore, result.score),
    bestStability: Math.max(base.bestStability, Math.round(result.stability)),
    highestOvertimeWave: Math.max(base.highestOvertimeWave, result.overtimeWave),
    bestClinicalAccuracy: Math.max(base.bestClinicalAccuracy, result.clinicalAccuracy),
    clears: base.clears + (result.cleared ? 1 : 0),
  };
}

export type WardRewardSnapshot = {
  xp: number; codexShards: number; wardSigils: number; firstClear: boolean;
  dailyBonus: boolean; rotationBonus: boolean; overtimeMilestone: boolean;
};

export function calculateWardReward(input: {
  cleared: boolean; stars: number; accuracy: number; firstClear: boolean;
  dailyBonus: boolean; rotationBonus: boolean; overtimeWave: number;
}): WardRewardSnapshot {
  if (!input.cleared) return { xp: 0, codexShards: 0, wardSigils: 0, firstClear: false, dailyBonus: false, rotationBonus: false, overtimeMilestone: false };
  const overtimeMilestone = input.overtimeWave > 0 && input.overtimeWave % 5 === 0;
  return {
    xp: 48 + input.stars * 12,
    codexShards: 8 + Math.round(input.accuracy * 6),
    wardSigils: 6 + input.stars * 2 + (input.firstClear ? 4 : 0) + (input.dailyBonus ? 2 : 0) + (input.rotationBonus ? 3 : 0) + (overtimeMilestone ? 1 : 0),
    firstClear: input.firstClear,
    dailyBonus: input.dailyBonus,
    rotationBonus: input.rotationBonus,
    overtimeMilestone,
  };
}

export const AEGIS_FRAGMENT_ITEM = 'ward_defense_aegis_fragment';
export const AEGIS_IMPRINT_ITEM = 'ward_defense_aegis_imprint';
export const AEGIS_FRAGMENTS_PER_IMPRINT = 5;