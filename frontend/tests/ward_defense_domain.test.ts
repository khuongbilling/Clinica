import {
  AEGIS_FRAGMENTS_PER_IMPRINT, STANDARD_CLINICAL_CHECKS, WARD_CLINICAL_BANK,
  WARD_SCENARIOS, calculateWardReward, calculateWardStars, nextWardScenario,
  selectWardClinicalChecks, shuffledChoices, wardMatchQuality,
} from '../src/game/wardDefense';

let passed = 0;
function expect(condition: unknown, label: string) {
  if (!condition) throw new Error(`FAIL: ${label}`);
  passed++;
  console.log(`PASS - ${label}`);
}

expect(WARD_SCENARIOS.length === 8, 'eight authored Ward Defense scenarios exist');
expect(WARD_SCENARIOS.every((scenario) => scenario.normalWaves.length === 6 && scenario.boss.id.endsWith('boss')), 'every scenario has six normal waves and a separate boss phase');
expect(WARD_CLINICAL_BANK.length === 360, '120 families each have Intro, Standard and Advanced variants');
expect(new Set(WARD_CLINICAL_BANK.map((question) => question.familyId)).size === 120, 'clinical bank has 120 stable families');
expect(STANDARD_CLINICAL_CHECKS.map((check) => check.waveIndex).join(',') === '0,2,6', 'exactly three checks occur before Wave 1, Wave 3 and Boss Phase');

const checks = selectWardClinicalChecks('ward-test', ['ward_c1_01'], ['ward_c2_01']);
expect(checks.length === 3 && new Set(checks.map((question) => question.familyId)).size === 3, 'run-local checks never repeat a family');
const choices = shuffledChoices(checks[0], 'ward-test');
expect(choices.some((choice) => choice.id === checks[0].correctChoiceId), 'choice shuffling preserves stable correct IDs');

const first = nextWardScenario(undefined, 10, 'rotation-a');
const second = nextWardScenario(first.state, 10, 'rotation-a');
expect(first.scenario.id !== second.scenario.id, 'shuffle bag prevents immediate scenario repeats');
expect(wardMatchQuality('airway_sentinel', 'wheeze_sprite') === 'strong', 'canonical response matching recognizes direct counters');
expect(wardMatchQuality('ward_scout', 'fever_imp') === 'partial', 'assessment remains meaningful outside direct counters');
expect(calculateWardStars(80, 0.9, true) === 3 && calculateWardStars(40, 0.9, true) === 1, 'Ward stars are distinct stability and accuracy records');
expect(calculateWardReward({ cleared: true, stars: 3, accuracy: 1, firstClear: true, dailyBonus: true, rotationBonus: true, overtimeWave: 5 }).wardSigils === 22, 'reward snapshot includes only bounded reward categories');
expect(AEGIS_FRAGMENTS_PER_IMPRINT === 5, 'five fragments assemble into one Aegis Imprint');

console.log(`ward_defense_domain: ${passed} passed`);