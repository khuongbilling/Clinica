/**
 * journey_map_diversity.test.ts — Push 8: Structural Diversity Enforcement
 *
 * Validates that BOOK1_DNA (Ch1–10) satisfies all structural diversity
 * constraints from the directive.
 *
 * WHAT THESE TESTS ENFORCE
 * ─────────────────────────
 *   • 12-dimension FullStructuralFingerprint is computed correctly
 *   • No pair of chapters has fingerprint similarity ≥ FULL_REJECT_THRESHOLD
 *   • No consecutive chapters share the same topology family
 *   • All six diversity axes are covered:
 *       open vs structured   (≥ 4 distinct topology families)
 *       wide vs tall         (both 'wide' and 'portrait' present)
 *       single vs multi hub  (hubCount ≤1 AND ≥2 both present)
 *       looping vs branching (loopBand AND branchBand mid/high present)
 *       symmetric vs async   (symmetry strong/partial AND none present)
 *       clearing-heavy vs lane-heavy (≥ 2 distinct clearingCountBands)
 *   • validateBookDiversity() returns valid for Ch1-10
 *   • Pairwise similarity matrix — all values < FULL_REJECT_THRESHOLD
 *   • Each fingerprint has chapterId matching input
 *   • Bucketing functions produce valid band values
 *   • Cache determinism
 */

import assert from 'assert';
import {
  computeFullFingerprint,
  getChapterFullFingerprint,
  fullFingerprintSimilarity,
  validateBookDiversity,
  FULL_REJECT_THRESHOLD,
} from '../src/game/journeyMap/chapterDiversityEnforcement';
import { getChapterMapDNA }         from '../src/game/journeyMap/chapterMapDNA';
import { getChapterPathwayGraph, validatePathwayGraph }
                                    from '../src/game/journeyMap/chapterPathwayGraph';
import { getChapterHexLayout }      from '../src/game/journeyMap/chapterHexLayout';
import type {
  FullStructuralFingerprint,
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

// ── Constants ─────────────────────────────────────────────────────────────────

const BOOK1_CHAPTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const VALID_BRANCH_BANDS    = new Set(['low', 'mid', 'high']);
const VALID_LOOP_BANDS      = new Set(['low', 'mid', 'high']);
const VALID_JUNCTION_BANDS  = new Set(['few', 'moderate', 'many']);
const VALID_CLEARING_BANDS  = new Set(['few', 'moderate', 'many']);
const VALID_AVG_SIZE_BANDS  = new Set(['small', 'medium', 'large']);
const VALID_LANE_BANDS      = new Set(['narrow', 'standard', 'wide']);
const VALID_DEAD_END_BANDS  = new Set(['none', 'few', 'many']);
const VALID_SYMMETRIES      = new Set(['none', 'partial', 'strong']);
const VALID_ASPECT_RATIOS   = new Set(['wide', 'portrait', 'balanced']);
const VALID_SGR             = new Set(['opposite', 'diagonal', 'offset', 'indirect']);

// ── Precompute fingerprints once ──────────────────────────────────────────────

const fps: FullStructuralFingerprint[] = BOOK1_CHAPTERS.map(computeFullFingerprint);

// ── Section 1: Fingerprint field validity (all chapters) ──────────────────────

test('[fingerprint] chapterId field matches input chapter', () => {
  for (let i = 0; i < BOOK1_CHAPTERS.length; i++) {
    eq(fps[i]!.chapterId, BOOK1_CHAPTERS[i]!, `ch${BOOK1_CHAPTERS[i]} chapterId`);
  }
});

test('[fingerprint] topologyFamily matches DNA', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp  = computeFullFingerprint(ch);
    const dna = getChapterMapDNA(ch);
    eq(fp.topologyFamily, dna.topologyFamily, `ch${ch} topologyFamily`);
  }
});

test('[fingerprint] aspectRatio matches DNA and is valid', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp  = computeFullFingerprint(ch);
    const dna = getChapterMapDNA(ch);
    eq(fp.aspectRatio, dna.aspectRatio, `ch${ch} aspectRatio`);
    ok(VALID_ASPECT_RATIOS.has(fp.aspectRatio), `ch${ch} invalid aspectRatio '${fp.aspectRatio}'`);
  }
});

test('[fingerprint] symmetry matches DNA and is valid', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp  = computeFullFingerprint(ch);
    const dna = getChapterMapDNA(ch);
    eq(fp.symmetry, dna.symmetry, `ch${ch} symmetry`);
    ok(VALID_SYMMETRIES.has(fp.symmetry), `ch${ch} invalid symmetry '${fp.symmetry}'`);
  }
});

test('[fingerprint] hubCount matches DNA', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp  = computeFullFingerprint(ch);
    const dna = getChapterMapDNA(ch);
    eq(fp.hubCount, dna.hubCount, `ch${ch} hubCount`);
    ok(fp.hubCount >= 0, `ch${ch} hubCount < 0`);
  }
});

test('[fingerprint] branchBand is valid', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp = computeFullFingerprint(ch);
    ok(VALID_BRANCH_BANDS.has(fp.branchBand), `ch${ch} invalid branchBand '${fp.branchBand}'`);
  }
});

test('[fingerprint] loopBand is valid', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp = computeFullFingerprint(ch);
    ok(VALID_LOOP_BANDS.has(fp.loopBand), `ch${ch} invalid loopBand '${fp.loopBand}'`);
  }
});

test('[fingerprint] junctionCountBand is valid', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp = computeFullFingerprint(ch);
    ok(VALID_JUNCTION_BANDS.has(fp.junctionCountBand),
      `ch${ch} invalid junctionCountBand '${fp.junctionCountBand}'`);
  }
});

test('[fingerprint] clearingCountBand is valid', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp = computeFullFingerprint(ch);
    ok(VALID_CLEARING_BANDS.has(fp.clearingCountBand),
      `ch${ch} invalid clearingCountBand '${fp.clearingCountBand}'`);
  }
});

test('[fingerprint] avgClearingSizeBand is valid', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp = computeFullFingerprint(ch);
    ok(VALID_AVG_SIZE_BANDS.has(fp.avgClearingSizeBand),
      `ch${ch} invalid avgClearingSizeBand '${fp.avgClearingSizeBand}'`);
  }
});

test('[fingerprint] primaryLaneBand is valid', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp = computeFullFingerprint(ch);
    ok(VALID_LANE_BANDS.has(fp.primaryLaneBand),
      `ch${ch} invalid primaryLaneBand '${fp.primaryLaneBand}'`);
  }
});

test('[fingerprint] startGateRelationship is valid', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp = computeFullFingerprint(ch);
    ok(VALID_SGR.has(fp.startGateRelationship),
      `ch${ch} invalid startGateRelationship '${fp.startGateRelationship}'`);
  }
});

test('[fingerprint] deadEndBand is valid', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp = computeFullFingerprint(ch);
    ok(VALID_DEAD_END_BANDS.has(fp.deadEndBand),
      `ch${ch} invalid deadEndBand '${fp.deadEndBand}'`);
  }
});

// ── Section 2: Cross-module wiring ────────────────────────────────────────────

test('[wiring] junctionCountBand reflects actual JUNCTION node count', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp    = computeFullFingerprint(ch);
    const graph = getChapterPathwayGraph(ch);
    const jCount = graph.nodes.filter((n: any) => n.type === 'JUNCTION').length;
    const expectedBand =
      jCount <= 2 ? 'few' : jCount <= 5 ? 'moderate' : 'many';
    eq(fp.junctionCountBand, expectedBand,
      `ch${ch} junctionCountBand: jCount=${jCount}`);
  }
});

test('[wiring] clearingCountBand reflects HexLaneLayout.clearingZones.length', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp     = computeFullFingerprint(ch);
    const layout = getChapterHexLayout(ch);
    const cCount = layout.clearingZones.length;
    const expectedBand =
      cCount <= 6 ? 'few' : cCount <= 9 ? 'moderate' : 'many';
    eq(fp.clearingCountBand, expectedBand,
      `ch${ch} clearingCountBand: cCount=${cCount}`);
  }
});

test('[wiring] deadEndBand reflects PathwayGraphValidation.deadEndCount', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp    = computeFullFingerprint(ch);
    const graph = getChapterPathwayGraph(ch);
    const val   = validatePathwayGraph(graph);
    const expectedBand =
      val.deadEndCount === 0 ? 'none' :
      val.deadEndCount <= 2  ? 'few' :
                               'many';
    eq(fp.deadEndBand, expectedBand,
      `ch${ch} deadEndBand: deadEndCount=${val.deadEndCount}`);
  }
});

test('[wiring] primaryLaneBand reflects DNA.primaryLaneWidth', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp  = computeFullFingerprint(ch);
    const dna = getChapterMapDNA(ch);
    const expectedBand =
      dna.primaryLaneWidth <= 4 ? 'narrow' :
      dna.primaryLaneWidth <= 6 ? 'standard' :
                                  'wide';
    eq(fp.primaryLaneBand, expectedBand,
      `ch${ch} primaryLaneBand: laneWidth=${dna.primaryLaneWidth}`);
  }
});

// ── Section 3: Similarity function ───────────────────────────────────────────

test('[similarity] identical fingerprint scores 12/12', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const fp  = computeFullFingerprint(ch);
    const sim = fullFingerprintSimilarity(fp, fp);
    eq(sim, 12, `ch${ch} self-similarity`);
  }
});

test('[similarity] returns a value in [0, 12]', () => {
  for (let i = 0; i < fps.length; i++) {
    for (let j = i + 1; j < fps.length; j++) {
      const sim = fullFingerprintSimilarity(fps[i]!, fps[j]!);
      ok(sim >= 0 && sim <= 12,
        `Ch${fps[i]!.chapterId}×Ch${fps[j]!.chapterId} similarity ${sim} out of range [0,12]`);
    }
  }
});

test('[similarity] is symmetric (a,b) === (b,a)', () => {
  for (let i = 0; i < fps.length; i++) {
    for (let j = i + 1; j < fps.length; j++) {
      const ab = fullFingerprintSimilarity(fps[i]!, fps[j]!);
      const ba = fullFingerprintSimilarity(fps[j]!, fps[i]!);
      eq(ab, ba, `Ch${fps[i]!.chapterId}×Ch${fps[j]!.chapterId} symmetry`);
    }
  }
});

// ── Section 4: Pairwise similarity below reject threshold ─────────────────────

test('[diversity] FULL_REJECT_THRESHOLD is 9', () => {
  eq(FULL_REJECT_THRESHOLD, 9, 'FULL_REJECT_THRESHOLD');
});

test('[diversity] no pair of Ch1-10 chapters exceeds FULL_REJECT_THRESHOLD', () => {
  const violations: string[] = [];
  for (let i = 0; i < fps.length; i++) {
    for (let j = i + 1; j < fps.length; j++) {
      const sim = fullFingerprintSimilarity(fps[i]!, fps[j]!);
      if (sim >= FULL_REJECT_THRESHOLD) {
        violations.push(
          `Ch${fps[i]!.chapterId} × Ch${fps[j]!.chapterId}: similarity ${sim} ≥ ${FULL_REJECT_THRESHOLD}`
        );
      }
    }
  }
  ok(violations.length === 0,
    `Similarity violations:\n  ${violations.join('\n  ')}`);
});

test('[diversity] all pairwise similarities (matrix for debugging)', () => {
  // This test always passes — it just prints the matrix to aid debugging
  // if the reject-threshold test above fails.
  const rows: string[] = [];
  for (let i = 0; i < fps.length; i++) {
    const cells: string[] = [];
    for (let j = 0; j < fps.length; j++) {
      cells.push(i === j ? ' -' : String(fullFingerprintSimilarity(fps[i]!, fps[j]!)).padStart(2));
    }
    rows.push(`Ch${fps[i]!.chapterId}: ${cells.join(' ')}`);
  }
  // Emit matrix so it's visible in test output when run with --verbose
  // Not a failure — just informational
});

// ── Section 5: No consecutive same family ─────────────────────────────────────

test('[diversity] no consecutive chapters share the same topology family', () => {
  const violations: string[] = [];
  for (let i = 0; i < fps.length - 1; i++) {
    if (fps[i]!.topologyFamily === fps[i + 1]!.topologyFamily) {
      violations.push(
        `Ch${fps[i]!.chapterId} → Ch${fps[i+1]!.chapterId}: both '${fps[i]!.topologyFamily}'`
      );
    }
  }
  ok(violations.length === 0,
    `Consecutive family violations:\n  ${violations.join('\n  ')}`);
});

// ── Section 6: Diversity axis coverage ───────────────────────────────────────

test('[axis] at least one chapter with aspectRatio="wide"', () => {
  ok(fps.some(f => f.aspectRatio === 'wide'),
    'No chapter has aspectRatio="wide" — need wide vs tall variety');
});

test('[axis] at least one chapter with aspectRatio="portrait"', () => {
  ok(fps.some(f => f.aspectRatio === 'portrait'),
    'No chapter has aspectRatio="portrait" — need wide vs tall variety');
});

test('[axis] at least 2 distinct aspect ratios across Ch1-10', () => {
  const aspects = new Set(fps.map(f => f.aspectRatio));
  ok(aspects.size >= 2,
    `Only ${aspects.size} aspect ratio across Ch1-10; need ≥ 2`);
});

test('[axis] at least one chapter with hubCount ≤ 1 (single-hub / hub-less)', () => {
  ok(fps.some(f => f.hubCount <= 1),
    'No chapter with hubCount ≤ 1; need single vs multiple hub variety');
});

test('[axis] at least one chapter with hubCount ≥ 2 (multi-hub)', () => {
  ok(fps.some(f => f.hubCount >= 2),
    'No chapter with hubCount ≥ 2; need single vs multiple hub variety');
});

test('[axis] at least one chapter with loopBand mid or high', () => {
  ok(fps.some(f => f.loopBand === 'mid' || f.loopBand === 'high'),
    'No chapter with substantial loops; need looping vs branching variety');
});

test('[axis] at least one chapter with branchBand mid or high', () => {
  ok(fps.some(f => f.branchBand === 'mid' || f.branchBand === 'high'),
    'No chapter with substantial branches; need looping vs branching variety');
});

test('[axis] at least one chapter with symmetry strong or partial', () => {
  ok(fps.some(f => f.symmetry === 'strong' || f.symmetry === 'partial'),
    'No chapter with any symmetry; need symmetric vs asymmetric variety');
});

test('[axis] at least one chapter with symmetry="none" (asymmetric)', () => {
  ok(fps.some(f => f.symmetry === 'none'),
    'No chapter is asymmetric; need symmetric vs asymmetric variety');
});

test('[axis] at least 2 distinct clearingCountBands across Ch1-10', () => {
  const bands = new Set(fps.map(f => f.clearingCountBand));
  ok(bands.size >= 2,
    `Only ${bands.size} clearingCountBand across Ch1-10; need clearing-heavy vs lane-heavy variety`);
});

test('[axis] at least 4 distinct topology families across Ch1-10', () => {
  const families = new Set(fps.map(f => f.topologyFamily));
  ok(families.size >= 4,
    `Only ${families.size} distinct topology families; need open vs structured variety`);
});

test('[axis] Ch1-10 use all 10 topology families (one per chapter)', () => {
  const families = new Set(fps.map(f => f.topologyFamily));
  eq(families.size, 10,
    `Expected 10 unique families in BOOK1 (one per chapter), got ${families.size}: ${[...families].join(', ')}`);
});

// ── Section 7: validateBookDiversity ─────────────────────────────────────────

test('[validate] validateBookDiversity(Ch1-10) returns valid=true', () => {
  const report = validateBookDiversity(BOOK1_CHAPTERS);
  if (!report.valid) {
    const details: string[] = [];
    if (report.tooSimilarPairs.length > 0) {
      details.push(`tooSimilarPairs: ${JSON.stringify(report.tooSimilarPairs)}`);
    }
    if (report.consecutiveFamilyViolations.length > 0) {
      details.push(`consecutiveFamilyViolations: ${JSON.stringify(report.consecutiveFamilyViolations)}`);
    }
    if (report.axisViolations.length > 0) {
      details.push(`axisViolations:\n  ${report.axisViolations.join('\n  ')}`);
    }
    ok(false, `Book diversity invalid:\n${details.join('\n')}`);
  }
});

test('[validate] report.fingerprints has 10 entries', () => {
  const report = validateBookDiversity(BOOK1_CHAPTERS);
  eq(report.fingerprints.length, 10, 'fingerprints.length');
});

test('[validate] report.fingerprints are in chapter order', () => {
  const report = validateBookDiversity(BOOK1_CHAPTERS);
  for (let i = 0; i < report.fingerprints.length; i++) {
    eq(report.fingerprints[i]!.chapterId, BOOK1_CHAPTERS[i]!, `fingerprints[${i}].chapterId`);
  }
});

test('[validate] tooSimilarPairs is empty for BOOK1', () => {
  const report = validateBookDiversity(BOOK1_CHAPTERS);
  eq(report.tooSimilarPairs.length, 0,
    `Unexpected similar pairs: ${JSON.stringify(report.tooSimilarPairs)}`);
});

test('[validate] consecutiveFamilyViolations is empty for BOOK1', () => {
  const report = validateBookDiversity(BOOK1_CHAPTERS);
  eq(report.consecutiveFamilyViolations.length, 0,
    `Consecutive violations: ${JSON.stringify(report.consecutiveFamilyViolations)}`);
});

test('[validate] axisViolations is empty for BOOK1', () => {
  const report = validateBookDiversity(BOOK1_CHAPTERS);
  eq(report.axisViolations.length, 0,
    `Axis violations:\n  ${report.axisViolations.join('\n  ')}`);
});

// Adversarial: a set of identical chapters should fail diversity
test('[validate] all-same chapter fails diversity (adversarial)', () => {
  // Ch1 repeated 3 times — all identical fingerprints
  const report = validateBookDiversity([1, 1, 1]);
  ok(!report.valid, 'Expected invalid for three identical chapters');
  ok(report.tooSimilarPairs.length > 0, 'Expected tooSimilarPairs violations');
});

// ── Section 8: Cache determinism ─────────────────────────────────────────────

test('[cache] getChapterFullFingerprint same reference on second call', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const a = getChapterFullFingerprint(ch);
    const b = getChapterFullFingerprint(ch);
    ok(a === b, `Ch${ch} cache returned different object references`);
  }
});

test('[cache] getChapterFullFingerprint matches computeFullFingerprint values', () => {
  for (const ch of BOOK1_CHAPTERS) {
    const direct = computeFullFingerprint(ch);
    const cached = getChapterFullFingerprint(ch);
    eq(cached.topologyFamily,        direct.topologyFamily,        `ch${ch} topologyFamily`);
    eq(cached.aspectRatio,           direct.aspectRatio,           `ch${ch} aspectRatio`);
    eq(cached.junctionCountBand,     direct.junctionCountBand,     `ch${ch} junctionCountBand`);
    eq(cached.clearingCountBand,     direct.clearingCountBand,     `ch${ch} clearingCountBand`);
    eq(cached.avgClearingSizeBand,   direct.avgClearingSizeBand,   `ch${ch} avgClearingSizeBand`);
    eq(cached.deadEndBand,           direct.deadEndBand,           `ch${ch} deadEndBand`);
    eq(cached.startGateRelationship, direct.startGateRelationship, `ch${ch} startGateRelationship`);
  }
});

// ── Results ───────────────────────────────────────────────────────────────────

const total = passed + failed;
for (const f of failures) console.log(f);
if (failed === 0) {
  // Emit fingerprint summary for reference
  const header = 'Ch  family                      aspect  sym  hubs  jBand   brBand  loBand  czBand  szBand  lnBand  sgr       deBand';
  const rows = fps.map(f =>
    [
      String(f.chapterId).padStart(2),
      f.topologyFamily.padEnd(28),
      f.aspectRatio.padEnd(8),
      f.symmetry.padEnd(5),
      String(f.hubCount).padStart(4),
      f.junctionCountBand.padEnd(8),
      f.branchBand.padEnd(8),
      f.loopBand.padEnd(8),
      f.clearingCountBand.padEnd(8),
      f.avgClearingSizeBand.padEnd(8),
      f.primaryLaneBand.padEnd(8),
      f.startGateRelationship.padEnd(10),
      f.deadEndBand,
    ].join('  ')
  );
  console.log('\nFingerprint summary:');
  console.log(header);
  for (const row of rows) console.log(row);
  console.log(`\nPASS - all ${total} tests passed`);
} else {
  console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
  process.exit(1);
}
