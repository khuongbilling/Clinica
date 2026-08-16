/**
 * journeyMap/chapterDiversityEnforcement.ts — Push 8: Structural Diversity
 *
 * Validates that chapters within a Book do not feel structurally repetitive.
 *
 * ── Problem ──────────────────────────────────────────────────────────────────
 *   Even when hex coordinates differ, a map can feel like "the same map
 *   rotated" if its structural signature matches too many dimensions of
 *   an existing chapter.
 *
 * ── Solution ─────────────────────────────────────────────────────────────────
 *   1. Compute a 12-dimension FullStructuralFingerprint for each chapter,
 *      drawing from DNA + PathwayGraph + HexLaneLayout.
 *   2. Reject any chapter whose fingerprint matches ≥ FULL_REJECT_THRESHOLD
 *      dimensions of any existing chapter in the same Book.
 *   3. Assert that the Book covers all required diversity axes.
 *
 * ── Diversity Axes (from directive) ─────────────────────────────────────────
 *   open vs structured        → variety of topology families
 *   wide vs tall              → aspectRatio spread (≥1 wide, ≥1 portrait)
 *   single vs multiple hubs   → hubCount 0–1 AND ≥2 present
 *   looping vs branching      → loopBand AND branchBand 'mid'/'high' present
 *   symmetric vs asymmetric   → symmetry 'strong'/'partial' AND 'none' present
 *   clearing-heavy vs lane-heavy → clearingCountBand variety
 *
 * COMMIT TAG: test(journey): enforce structural diversity across chapter maps
 */

import { getChapterMapDNA }          from './chapterMapDNA';
import { getChapterPathwayGraph, validatePathwayGraph }
                                     from './chapterPathwayGraph';
import { getChapterHexLayout }       from './chapterHexLayout';
import type {
  FullStructuralFingerprint,
  BookDiversityReport,
  MapTopologyFamily,
  JunctionCountBand,
  ClearingCountBand,
  AvgClearingSizeBand,
  PrimaryLaneBand,
  DeadEndBand,
} from './chapterMapTemplate.types';

// ── Threshold ─────────────────────────────────────────────────────────────────

/**
 * Maximum allowed similarity before a map is rejected as "too similar".
 * With 12 dimensions, 8 matching means 67% overlap — at that point the map
 * reads like the same location in a different skin.
 */
/**
 * Maximum allowed similarity before a map is rejected as "too similar".
 *
 * Calibration: the original 7-dimension MapStructureSignature used 5/7 ≈ 71%.
 * With 12 dimensions, 71% ≈ 8.5 → ceiling = 9.
 *
 * At similarity = 9/12, a chapter pair differs on only 3 dimensions, one of
 * which is always topologyFamily (guaranteed unique in BOOK1).  That leaves
 * only 2 other dimensions distinguishing the two maps — still meaningfully
 * different environments, but right at the "same map" boundary.
 *
 * Chapters are rejected when ≥ 9 of 12 dimensions match (75% overlap).
 */
export const FULL_REJECT_THRESHOLD = 9;

// ── Bucketing helpers ─────────────────────────────────────────────────────────

function branchBand(n: number): 'low' | 'mid' | 'high' {
  return n <= 2 ? 'low' : n <= 4 ? 'mid' : 'high';
}

function loopBand(n: number): 'low' | 'mid' | 'high' {
  return n <= 1 ? 'low' : n <= 3 ? 'mid' : 'high';
}

function junctionCountBand(n: number): JunctionCountBand {
  return n <= 2 ? 'few' : n <= 5 ? 'moderate' : 'many';
}

function clearingCountBand(n: number): ClearingCountBand {
  return n <= 6 ? 'few' : n <= 9 ? 'moderate' : 'many';
}

function avgClearingSizeBand(meanArea: number): AvgClearingSizeBand {
  return meanArea < 4 ? 'small' : meanArea < 8 ? 'medium' : 'large';
}

function primaryLaneBand(w: number): PrimaryLaneBand {
  return w <= 4 ? 'narrow' : w <= 6 ? 'standard' : 'wide';
}

function deadEndBand(n: number): DeadEndBand {
  return n === 0 ? 'none' : n <= 2 ? 'few' : 'many';
}

// ── Core: compute full fingerprint ────────────────────────────────────────────

/**
 * Computes the 12-dimension FullStructuralFingerprint for a chapter.
 *
 * Sources:
 *   ChapterMapDNA    → dimensions 1, 2, 3, 4, 6, 7, 10, 11
 *   PathwayGraph     → dimension 5 (junctionCount), 12 (deadEndCount)
 *   HexLaneLayout    → dimensions 8 (clearingCount), 9 (avgClearingSize)
 */
export function computeFullFingerprint(chapter: number): FullStructuralFingerprint {
  const dna    = getChapterMapDNA(chapter);
  const graph  = getChapterPathwayGraph(chapter);
  const layout = getChapterHexLayout(chapter);
  const val    = validatePathwayGraph(graph);

  // Dimension 5: junction count from PathwayGraph node types
  const jCount = graph.nodes.filter(n => n.type === 'JUNCTION').length;

  // Dimensions 8 + 9: clearing zones from HexLaneLayout
  const czs     = layout.clearingZones;
  const cCount  = czs.length;
  const meanArea = cCount === 0 ? 0
    : czs.reduce((s, cz) => s + cz.cells.length, 0) / cCount;

  return {
    chapterId:             chapter,
    topologyFamily:        dna.topologyFamily,
    aspectRatio:           dna.aspectRatio,
    symmetry:              dna.symmetry,
    hubCount:              dna.hubCount,
    junctionCountBand:     junctionCountBand(jCount),
    branchBand:            branchBand(dna.branchCount),
    loopBand:              loopBand(dna.loopCount),
    clearingCountBand:     clearingCountBand(cCount),
    avgClearingSizeBand:   avgClearingSizeBand(meanArea),
    primaryLaneBand:       primaryLaneBand(dna.primaryLaneWidth),
    startGateRelationship: dna.startGateRelationship,
    deadEndBand:           deadEndBand(val.deadEndCount),
  };
}

// ── Similarity ────────────────────────────────────────────────────────────────

/**
 * Returns the number of dimensions (0–12) on which two fingerprints agree.
 *
 * A count ≥ FULL_REJECT_THRESHOLD (8) means the two chapters feel like
 * the same map in different tile clothing.
 */
export function fullFingerprintSimilarity(
  a: FullStructuralFingerprint,
  b: FullStructuralFingerprint,
): number {
  return [
    a.topologyFamily        === b.topologyFamily,
    a.aspectRatio           === b.aspectRatio,
    a.symmetry              === b.symmetry,
    a.hubCount              === b.hubCount,
    a.junctionCountBand     === b.junctionCountBand,
    a.branchBand            === b.branchBand,
    a.loopBand              === b.loopBand,
    a.clearingCountBand     === b.clearingCountBand,
    a.avgClearingSizeBand   === b.avgClearingSizeBand,
    a.primaryLaneBand       === b.primaryLaneBand,
    a.startGateRelationship === b.startGateRelationship,
    a.deadEndBand           === b.deadEndBand,
  ].filter(Boolean).length;
}

// ── Diversity axis checks ─────────────────────────────────────────────────────

/**
 * Checks that the set of fingerprints covers all six required diversity axes.
 * Returns a list of violation strings; empty = all axes covered.
 */
function checkDiversityAxes(fps: FullStructuralFingerprint[]): string[] {
  const violations: string[] = [];

  // Axis 1: wide vs tall — need at least one 'wide' AND one 'portrait'
  if (!fps.some(f => f.aspectRatio === 'wide')) {
    violations.push('aspect-ratio: no chapter with aspectRatio="wide"');
  }
  if (!fps.some(f => f.aspectRatio === 'portrait')) {
    violations.push('aspect-ratio: no chapter with aspectRatio="portrait"');
  }

  // Axis 2: single vs multiple hubs — need hubCount 0/1 AND hubCount ≥2
  if (!fps.some(f => f.hubCount <= 1)) {
    violations.push('hub-count: no chapter with hubCount ≤ 1 (single-hub)');
  }
  if (!fps.some(f => f.hubCount >= 2)) {
    violations.push('hub-count: no chapter with hubCount ≥ 2 (multi-hub)');
  }

  // Axis 3: looping vs branching
  if (!fps.some(f => f.loopBand === 'mid' || f.loopBand === 'high')) {
    violations.push('loop-vs-branch: no chapter with loopBand mid/high');
  }
  if (!fps.some(f => f.branchBand === 'mid' || f.branchBand === 'high')) {
    violations.push('loop-vs-branch: no chapter with branchBand mid/high');
  }

  // Axis 4: symmetric vs asymmetric
  if (!fps.some(f => f.symmetry === 'strong' || f.symmetry === 'partial')) {
    violations.push('symmetry: no chapter with symmetry strong/partial');
  }
  if (!fps.some(f => f.symmetry === 'none')) {
    violations.push('symmetry: no chapter with symmetry="none" (asymmetric)');
  }

  // Axis 5: clearing-heavy vs lane-heavy — need clearingCountBand variety
  const bandSet = new Set(fps.map(f => f.clearingCountBand));
  if (bandSet.size < 2) {
    violations.push(
      `clearing-density: all chapters share the same clearingCountBand ` +
      `(${[...bandSet].join(', ')}); need at least 2 distinct bands`,
    );
  }

  // Axis 6: open vs structured topology variety — need ≥ 4 distinct families
  const familySet = new Set(fps.map(f => f.topologyFamily));
  if (familySet.size < 4) {
    violations.push(
      `topology-variety: only ${familySet.size} distinct topology families ` +
      `(expected ≥ 4)`,
    );
  }

  return violations;
}

// ── Book diversity validation ─────────────────────────────────────────────────

/**
 * Validates structural diversity across a set of chapters.
 *
 * Checks:
 *   1. No pair of chapters has fingerprint similarity ≥ FULL_REJECT_THRESHOLD
 *   2. No consecutive chapters share the same topology family
 *   3. All six diversity axes are adequately covered
 *
 * @param chapters  Array of chapter numbers to validate (e.g. [1,2,...,10]).
 */
export function validateBookDiversity(chapters: number[]): BookDiversityReport {
  const fingerprints = chapters.map(computeFullFingerprint);

  // Check 1: pairwise similarity
  const tooSimilarPairs: BookDiversityReport['tooSimilarPairs'] = [];
  for (let i = 0; i < fingerprints.length; i++) {
    for (let j = i + 1; j < fingerprints.length; j++) {
      const sim = fullFingerprintSimilarity(fingerprints[i]!, fingerprints[j]!);
      if (sim >= FULL_REJECT_THRESHOLD) {
        tooSimilarPairs.push({
          chA: fingerprints[i]!.chapterId,
          chB: fingerprints[j]!.chapterId,
          similarity: sim,
        });
      }
    }
  }

  // Check 2: consecutive family violations
  const consecutiveFamilyViolations: BookDiversityReport['consecutiveFamilyViolations'] = [];
  for (let i = 0; i < fingerprints.length - 1; i++) {
    const a = fingerprints[i]!;
    const b = fingerprints[i + 1]!;
    if (a.topologyFamily === b.topologyFamily) {
      consecutiveFamilyViolations.push({
        chA: a.chapterId,
        chB: b.chapterId,
        family: a.topologyFamily as MapTopologyFamily,
      });
    }
  }

  // Check 3: diversity axis coverage
  const axisViolations = checkDiversityAxes(fingerprints);

  const valid =
    tooSimilarPairs.length           === 0 &&
    consecutiveFamilyViolations.length === 0 &&
    axisViolations.length            === 0;

  return { valid, tooSimilarPairs, consecutiveFamilyViolations, axisViolations, fingerprints };
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const fingerprintCache = new Map<number, FullStructuralFingerprint>();

/**
 * Cached version of `computeFullFingerprint`.
 * All chapter inputs (DNA, graph, layout) are already cached in their own
 * modules, so the cache here simply avoids re-bucketing.
 */
export function getChapterFullFingerprint(chapter: number): FullStructuralFingerprint {
  const cached = fingerprintCache.get(chapter);
  if (cached) return cached;
  const result = computeFullFingerprint(chapter);
  fingerprintCache.set(chapter, result);
  return result;
}
