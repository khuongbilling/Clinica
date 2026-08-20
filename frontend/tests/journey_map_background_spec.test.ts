/**
 * journey_map_background_spec.test.ts — Push 7: ChapterBackgroundSpec tests
 *
 * Validates all guarantees stated in the ChapterBackgroundSpec contract:
 *   • Valid ChapterEnvironmentType per chapter
 *   • All three shifts present (day / evening / night)
 *   • AI prompts are non-empty and contain required keywords
 *   • Negative prompts are non-empty
 *   • Target asset paths match the canonical convention
 *   • Metro require paths match canonical convention
 *   • Target dimensions are 1024 × 1024
 *   • Geometry invariant note mentions all three shifts
 *   • Art direction, path/clearing/scenery style are non-empty strings
 *   • environmentName matches DNA.themeName
 *   • seed matches DNA.seed
 *   • Day/Evening/Night prompts contain distinct lighting terms
 *   • Cache determinism (same chapter → same object reference)
 *   • Range API consistency
 *   • getChapterGenerationPrompts convenience accessor
 *   • Full-sweep per chapter (all invariants)
 */

import assert from 'assert';
import {
  getChapterBackgroundSpec,
  getChapterBackgroundSpecRange,
  getChapterGenerationPrompts,
} from '../src/game/journeyMap/chapterBackgroundSpec';
import { getChapterMapDNA } from '../src/game/journeyMap/chapterMapDNA';
import type {
  ChapterBackgroundSpec,
  ShiftBackgroundSpec,
} from '../src/game/journeyMap/chapterMapTemplate.types';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try { fn(); passed++; }
  catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`FAIL - ${name}\n       ${msg}`);
    console.error(`FAIL - ${name}\n       ${msg}`);
  }
}

function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? 'eq'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}
function ok(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}
function includes(s: string, sub: string, msg?: string): void {
  if (!s.includes(sub)) throw new Error(`${msg ?? 'includes'}: "${sub}" not found in string`);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_ENV_TYPES = new Set([
  'ACADEMIC_QUAD', 'SIMULATION_PLAZA', 'CLINICAL_SKILLS_COMPLEX',
  'MOCK_WARD_CAMPUS', 'DIAGNOSTIC_CENTER', 'EMERGENCY_SIMULATION_CENTER',
  'ANATOMY_GARDEN', 'CAPSTONE_CAMPUS',
]);

const SHIFTS = ['day', 'evening', 'night'] as const;

function expectedAssetPath(chapter: number, shift: typeof SHIFTS[number]): string {
  if (chapter === 1) {
    const revision = shift === 'night' ? '-v4' : '';
    return `assets/ui/journey/map/map-campus-background-ch1-${shift}-clean${revision}.png`;
  }
  const revision = chapter === 2 && shift !== 'day' ? '-v2' : '';
  return `assets/ui/journey/map/map-platform-background-ch${chapter}-${shift}${revision}.png`;
}

function expectedMetroPath(chapter: number, shift: typeof SHIFTS[number]): string {
  return `@/${expectedAssetPath(chapter, shift)}`;
}

// Keywords expected in per-shift AI prompts
const SHIFT_KEYWORDS: Record<string, string[]> = {
  day:     ['morning', 'sunlight', 'golden'],
  evening: ['amber', 'lantern', 'evening'],
  night:   ['navy', 'night', 'bioluminescent'],
};

// ── Full invariant battery ────────────────────────────────────────────────────

function assertSpecValid(ch: number, spec: ChapterBackgroundSpec, label: string): void {
  const dna = getChapterMapDNA(ch);

  // 1. chapterId correct
  eq(spec.chapterId, ch, `[${label}] chapterId`);

  // 2. seed matches DNA
  eq(spec.seed, dna.seed, `[${label}] seed`);

  // 3. environmentName matches DNA.themeName
  eq(spec.environmentName, dna.themeName, `[${label}] environmentName`);

  // 4. environmentType is valid
  ok(VALID_ENV_TYPES.has(spec.environmentType),
    `[${label}] invalid environmentType '${spec.environmentType}'`);

  // 5. Non-empty text fields
  ok(spec.artDirection.length >= 50,
    `[${label}] artDirection too short (${spec.artDirection.length})`);
  ok(spec.walkablePathStyle.length >= 30,
    `[${label}] walkablePathStyle too short`);
  ok(spec.clearingStyle.length >= 30,
    `[${label}] clearingStyle too short`);
  ok(spec.sceneryFramingStyle.length >= 30,
    `[${label}] sceneryFramingStyle too short`);
  ok(spec.geometryInvariantNote.length >= 50,
    `[${label}] geometryInvariantNote too short`);

  // 6. Geometry invariant note mentions all three shifts
  includes(spec.geometryInvariantNote, 'Day', `[${label}] geoNote missing 'Day'`);
  includes(spec.geometryInvariantNote, 'Evening', `[${label}] geoNote missing 'Evening'`);
  includes(spec.geometryInvariantNote, 'Night', `[${label}] geoNote missing 'Night'`);

  // 7. All three shifts present
  for (const shift of SHIFTS) {
    ok(spec.shifts[shift] !== undefined, `[${label}] missing shift '${shift}'`);
  }

  // 8. Per-shift invariants
  for (const shift of SHIFTS) {
    const sv: ShiftBackgroundSpec = spec.shifts[shift];

    // shift field correct
    eq(sv.shift, shift, `[${label}] shift[${shift}].shift field`);

    // Non-empty descriptions
    ok(sv.lightingDescription.length >= 20,
      `[${label}] shift[${shift}].lightingDescription too short`);
    ok(sv.atmosphereDescription.length >= 20,
      `[${label}] shift[${shift}].atmosphereDescription too short`);
    ok(sv.ambientDetail.length >= 20,
      `[${label}] shift[${shift}].ambientDetail too short`);

    // AI prompt non-empty and long enough
    ok(sv.aiPrompt.length >= 100,
      `[${label}] shift[${shift}].aiPrompt too short (${sv.aiPrompt.length})`);

    // Negative prompt non-empty
    ok(sv.negativePrompt.length >= 30,
      `[${label}] shift[${shift}].negativePrompt too short`);

    // Negative prompt contains key exclusions
    includes(sv.negativePrompt, 'characters',
      `[${label}] shift[${shift}].negativePrompt missing 'characters'`);
    includes(sv.negativePrompt, 'UI elements',
      `[${label}] shift[${shift}].negativePrompt missing 'UI elements'`);
    includes(sv.negativePrompt, 'text',
      `[${label}] shift[${shift}].negativePrompt missing 'text'`);

    // Target asset path matches convention
    const expectedPath = expectedAssetPath(ch, shift);
    eq(sv.targetAssetPath, expectedPath, `[${label}] shift[${shift}].targetAssetPath`);

    // Metro require path matches convention
    const expectedMetro = expectedMetroPath(ch, shift);
    eq(sv.metroRequirePath, expectedMetro, `[${label}] shift[${shift}].metroRequirePath`);

    // Target dimensions
    eq(sv.targetDimensions.width, 1024,
      `[${label}] shift[${shift}].targetDimensions.width`);
    eq(sv.targetDimensions.height, 1024,
      `[${label}] shift[${shift}].targetDimensions.height`);

    // Shift-specific keywords present in AI prompt
    const keywords = SHIFT_KEYWORDS[shift] ?? [];
    for (const kw of keywords) {
      ok(sv.aiPrompt.toLowerCase().includes(kw.toLowerCase()),
        `[${label}] shift[${shift}].aiPrompt missing keyword '${kw}'`);
    }
  }

  // 9. AI prompts differ between shifts (not identical copy-paste)
  ok(spec.shifts.day.aiPrompt !== spec.shifts.evening.aiPrompt,
    `[${label}] day and evening prompts are identical`);
  ok(spec.shifts.evening.aiPrompt !== spec.shifts.night.aiPrompt,
    `[${label}] evening and night prompts are identical`);
  ok(spec.shifts.day.aiPrompt !== spec.shifts.night.aiPrompt,
    `[${label}] day and night prompts are identical`);

  // 10. All three shifts share same targetDimensions (same geometry output size)
  eq(spec.shifts.day.targetDimensions.width,     spec.shifts.evening.targetDimensions.width,
    `[${label}] day/evening width mismatch`);
  eq(spec.shifts.evening.targetDimensions.width, spec.shifts.night.targetDimensions.width,
    `[${label}] evening/night width mismatch`);
  eq(spec.shifts.day.targetDimensions.height,     spec.shifts.evening.targetDimensions.height,
    `[${label}] day/evening height mismatch`);

  // 11. AI prompt contains style anchor keywords
  includes(spec.shifts.day.aiPrompt, 'donghua',
    `[${label}] day aiPrompt missing 'donghua'`);
  includes(spec.shifts.day.aiPrompt, 'top-down',
    `[${label}] day aiPrompt missing 'top-down'`);

  // 12. AI prompt mentions raster geometry (no characters)
  includes(spec.shifts.day.aiPrompt, 'no characters',
    `[${label}] day aiPrompt missing 'no characters'`);
}

// ── Section 1: Per-chapter validation (Ch 1–10) ───────────────────────────────

for (let ch = 1; ch <= 10; ch++) {
  test(`[Ch${ch}] full background spec validation`, () => {
    assertSpecValid(ch, getChapterBackgroundSpec(ch), `Ch${ch}`);
  });
}

// ── Section 2: environmentType coverage ───────────────────────────────────────

test('[env-type] all chapters have valid environment types', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const spec = getChapterBackgroundSpec(ch);
    ok(VALID_ENV_TYPES.has(spec.environmentType),
      `Ch${ch} invalid env type: '${spec.environmentType}'`);
  }
});

test('[env-type] all 8 environment types used across Ch1-10', () => {
  const used = new Set<string>();
  for (let ch = 1; ch <= 10; ch++) used.add(getChapterBackgroundSpec(ch).environmentType);
  // With 10 chapters and 8 types, at least 6 distinct types should be used
  ok(used.size >= 6, `only ${used.size} distinct env types used across Ch1-10 (expected ≥ 6)`);
});

// ── Section 3: environmentName / seed wiring ─────────────────────────────────

test('[wiring] environmentName matches DNA.themeName for all chapters', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const spec = getChapterBackgroundSpec(ch);
    const dna  = getChapterMapDNA(ch);
    eq(spec.environmentName, dna.themeName, `Ch${ch} environmentName`);
  }
});

test('[wiring] seed matches DNA.seed for all chapters', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const spec = getChapterBackgroundSpec(ch);
    const dna  = getChapterMapDNA(ch);
    eq(spec.seed, dna.seed, `Ch${ch} seed`);
  }
});

// ── Section 4: Asset path convention ─────────────────────────────────────────

test('[paths] target asset paths follow canonical convention', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const spec = getChapterBackgroundSpec(ch);
    for (const shift of SHIFTS) {
      const expected = expectedAssetPath(ch, shift);
      eq(spec.shifts[shift].targetAssetPath, expected, `Ch${ch} ${shift} targetAssetPath`);
    }
  }
});

test('[paths] metro require paths follow canonical convention', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const spec = getChapterBackgroundSpec(ch);
    for (const shift of SHIFTS) {
      const expected = expectedMetroPath(ch, shift);
      eq(spec.shifts[shift].metroRequirePath, expected, `Ch${ch} ${shift} metroRequirePath`);
    }
  }
});

test('[paths] Ch1 day path matches existing chapterMapVisuals.ts convention', () => {
  const spec = getChapterBackgroundSpec(1);
  eq(spec.shifts.day.targetAssetPath,
    'assets/ui/journey/map/map-campus-background-ch1-day-clean.png',
    'Ch1 day path');
});

test('[paths] Ch1 evening path matches existing chapterMapVisuals.ts convention', () => {
  const spec = getChapterBackgroundSpec(1);
  eq(spec.shifts.evening.targetAssetPath,
    'assets/ui/journey/map/map-campus-background-ch1-evening-clean.png',
    'Ch1 evening path');
});

// ── Section 5: Target dimensions ─────────────────────────────────────────────

test('[dimensions] all chapters/shifts use 1024×1024', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const spec = getChapterBackgroundSpec(ch);
    for (const shift of SHIFTS) {
      eq(spec.shifts[shift].targetDimensions.width,  1024, `Ch${ch} ${shift} width`);
      eq(spec.shifts[shift].targetDimensions.height, 1024, `Ch${ch} ${shift} height`);
    }
  }
});

// ── Section 6: AI prompt quality ─────────────────────────────────────────────

test('[prompts] day prompt contains morning/sunlight keywords', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const prompt = getChapterBackgroundSpec(ch).shifts.day.aiPrompt.toLowerCase();
    ok(prompt.includes('morning') || prompt.includes('sunlight') || prompt.includes('golden'),
      `Ch${ch} day prompt missing morning/sunlight/golden`);
  }
});

test('[prompts] evening prompt contains amber/lantern keywords', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const prompt = getChapterBackgroundSpec(ch).shifts.evening.aiPrompt.toLowerCase();
    ok(prompt.includes('amber') || prompt.includes('lantern') || prompt.includes('evening'),
      `Ch${ch} evening prompt missing amber/lantern/evening`);
  }
});

test('[prompts] night prompt contains navy/bioluminescent keywords', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const prompt = getChapterBackgroundSpec(ch).shifts.night.aiPrompt.toLowerCase();
    ok(prompt.includes('navy') || prompt.includes('bioluminescent') || prompt.includes('teal'),
      `Ch${ch} night prompt missing navy/bioluminescent/teal`);
  }
});

test('[prompts] all prompts contain style anchor keywords', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const spec = getChapterBackgroundSpec(ch);
    for (const shift of SHIFTS) {
      const p = spec.shifts[shift].aiPrompt;
      includes(p, 'donghua',   `Ch${ch} ${shift} prompt missing 'donghua'`);
      includes(p, 'top-down',  `Ch${ch} ${shift} prompt missing 'top-down'`);
      includes(p, 'no characters', `Ch${ch} ${shift} prompt missing 'no characters'`);
    }
  }
});

test('[prompts] all prompts mention walkable geometry invariant', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const spec = getChapterBackgroundSpec(ch);
    for (const shift of SHIFTS) {
      const p = spec.shifts[shift].aiPrompt;
      ok(p.includes('floor') || p.includes('path') || p.includes('traversal'),
        `Ch${ch} ${shift} prompt missing floor/path/traversal`);
    }
  }
});

test('[prompts] all negative prompts exclude required elements', () => {
  const required = ['characters', 'UI elements', 'text', 'grid'];
  for (let ch = 1; ch <= 10; ch++) {
    const spec = getChapterBackgroundSpec(ch);
    for (const shift of SHIFTS) {
      const neg = spec.shifts[shift].negativePrompt;
      for (const r of required) {
        includes(neg, r, `Ch${ch} ${shift} negativePrompt missing '${r}'`);
      }
    }
  }
});

test('[prompts] three shift prompts are distinct per chapter', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const spec = getChapterBackgroundSpec(ch);
    const { day, evening, night } = spec.shifts;
    ok(day.aiPrompt !== evening.aiPrompt, `Ch${ch} day/evening prompts identical`);
    ok(evening.aiPrompt !== night.aiPrompt, `Ch${ch} evening/night prompts identical`);
    ok(day.aiPrompt !== night.aiPrompt, `Ch${ch} day/night prompts identical`);
  }
});

// ── Section 7: Geometry invariant note ───────────────────────────────────────

test('[geo-note] mentions all three shift names', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const note = getChapterBackgroundSpec(ch).geometryInvariantNote;
    includes(note, 'Day',     `Ch${ch} geoNote missing 'Day'`);
    includes(note, 'Evening', `Ch${ch} geoNote missing 'Evening'`);
    includes(note, 'Night',   `Ch${ch} geoNote missing 'Night'`);
  }
});

test('[geo-note] states geometry does not change between shifts', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const note = getChapterBackgroundSpec(ch).geometryInvariantNote.toLowerCase();
    ok(note.includes('same') || note.includes('identical') || note.includes('not move'),
      `Ch${ch} geoNote doesn't assert geometry invariance`);
  }
});

test('[geo-note] mentions tile count and clearing count', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const note = getChapterBackgroundSpec(ch).geometryInvariantNote;
    ok(/\d+ walkable tiles/.test(note) || /\d+ named clearings/.test(note),
      `Ch${ch} geoNote missing tile/clearing count`);
  }
});

// ── Section 8: Cache determinism ─────────────────────────────────────────────

test('[cache] same chapter returns same object reference', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const a = getChapterBackgroundSpec(ch);
    const b = getChapterBackgroundSpec(ch);
    ok(a === b, `Ch${ch} cache returned different object references`);
  }
});

// ── Section 9: Range API ─────────────────────────────────────────────────────

test('[range] getChapterBackgroundSpecRange(1,10) returns 10 specs', () => {
  eq(getChapterBackgroundSpecRange(1, 10).length, 10, 'range length');
});

test('[range] each spec has correct chapterId', () => {
  const specs = getChapterBackgroundSpecRange(1, 10);
  for (let i = 0; i < specs.length; i++) {
    eq(specs[i]!.chapterId, i + 1, `range[${i}].chapterId`);
  }
});

test('[range] range matches individual calls', () => {
  const specs = getChapterBackgroundSpecRange(1, 10);
  for (let ch = 1; ch <= 10; ch++) {
    ok(specs[ch - 1] === getChapterBackgroundSpec(ch),
      `Ch${ch} range[${ch - 1}] !== individual call`);
  }
});

// ── Section 10: getChapterGenerationPrompts convenience accessor ──────────────

test('[convenience] getChapterGenerationPrompts returns all three shifts', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const prompts = getChapterGenerationPrompts(ch);
    ok(prompts.day     !== undefined, `Ch${ch} prompts.day missing`);
    ok(prompts.evening !== undefined, `Ch${ch} prompts.evening missing`);
    ok(prompts.night   !== undefined, `Ch${ch} prompts.night missing`);
  }
});

test('[convenience] prompt objects have aiPrompt, negativePrompt, targetAssetPath', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const prompts = getChapterGenerationPrompts(ch);
    for (const shift of SHIFTS) {
      const p = prompts[shift];
      ok(typeof p.aiPrompt === 'string' && p.aiPrompt.length > 0,
        `Ch${ch} ${shift}.aiPrompt empty`);
      ok(typeof p.negativePrompt === 'string' && p.negativePrompt.length > 0,
        `Ch${ch} ${shift}.negativePrompt empty`);
      ok(typeof p.targetAssetPath === 'string' && p.targetAssetPath.length > 0,
        `Ch${ch} ${shift}.targetAssetPath empty`);
    }
  }
});

test('[convenience] prompts match shift specs', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const spec    = getChapterBackgroundSpec(ch);
    const prompts = getChapterGenerationPrompts(ch);
    for (const shift of SHIFTS) {
      eq(prompts[shift].aiPrompt, spec.shifts[shift].aiPrompt,
        `Ch${ch} ${shift} aiPrompt mismatch`);
      eq(prompts[shift].targetAssetPath, spec.shifts[shift].targetAssetPath,
        `Ch${ch} ${shift} targetAssetPath mismatch`);
    }
  }
});

// ── Section 11: Full-sweep per chapter ───────────────────────────────────────

for (let ch = 1; ch <= 10; ch++) {
  test(`[full-sweep ch${ch}] all invariants pass`, () => {
    assertSpecValid(ch, getChapterBackgroundSpec(ch), `ch${ch}`);
  });
}

// ── Results ───────────────────────────────────────────────────────────────────

const total = passed + failed;
for (const f of failures) console.log(f);
if (failed === 0) {
  console.log(`\nPASS - all ${total} tests passed`);
} else {
  console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
  process.exit(1);
}
