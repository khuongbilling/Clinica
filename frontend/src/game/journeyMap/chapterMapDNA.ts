/**
 * journeyMap/chapterMapDNA.ts — Push 3: Procedural Map Archetype Grammar
 *
 * Implements the MAP DNA system: every chapter owns a ChapterMapDNA that
 * describes its structural geometry at the level of topology family,
 * aspect ratio, lane widths, branch/loop/hub counts, clearing pattern,
 * obstacle pattern, start-gate relationship, and route bias.
 *
 * CRITICAL DESIGN RULES
 * ─────────────────────
 * 1. "Academic Quad" (or any family) is NOT a fixed layout.
 *    It is a GENERATION FAMILY.  Two Academic Quad maps must differ
 *    substantially in aspect ratio, hub location, branch count, etc.
 * 2. Background art reads from the DNA — DNA must never read from art.
 * 3. On rechallenge, DNA does NOT change.  Only encounters change.
 *
 * SEED FORMULA
 * ─────────────
 *   seed = `${sagaId}|${bookId}|${chapterId}|map-layout-v1`
 *
 * Book I (chapters 1–10) carry hardcoded DNA that accurately describes
 * their authored geometry.  Chapter 11+ DNA is generated procedurally
 * from the seed formula, subject to diversity constraints.
 *
 * DIVERSITY RULES (within a Book)
 * ─────────────────────────────────
 * • No consecutive chapters share the same topologyFamily.
 * • No topologyFamily appears more than twice in chapters 1–10.
 * • A newly generated DNA is rejected (up to MAX_DNA_RETRIES times) if
 *   its MapStructureSignature matches any existing chapter signature on
 *   ≥ SIMILARITY_REJECT_THRESHOLD dimensions.
 */

import { fnv1a32, mulberry32 } from './prng';
import type {
  ChapterMapDNA,
  MapTopologyFamily,
  ClearingPattern,
  ObstaclePattern,
  RouteBias,
  MapStructureSignature,
} from './chapterMapTemplate.types';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Saga / book identifiers for the seed formula. */
export const SAGA_ID  = 'saga-1';
export const BOOK1_ID = 'book-1';

/** Two signatures matching on this many dimensions trigger a re-roll. */
export const SIMILARITY_REJECT_THRESHOLD = 5;

/** Max re-roll attempts before accepting a less-diverse DNA as fallback. */
const MAX_DNA_RETRIES = 24;

// ── Seed formula ──────────────────────────────────────────────────────────────

/**
 * Canonical seed string for a chapter's map DNA.
 *
 *   seed = `${sagaId}|${bookId}|${chapterId}|map-layout-v1`
 */
export function dnaSeedFor(
  sagaId:    string,
  bookId:    string,
  chapterId: number,
): string {
  return `${sagaId}|${bookId}|${chapterId}|map-layout-v1`;
}

// ── Per-family generation profiles ───────────────────────────────────────────
//
// Each family has a RANGE of valid parameter values that the procedural
// generator samples from.  Families differ deliberately so the same
// RNG state produces structurally dissimilar maps across families.

interface FamilyProfile {
  aspectRatios:           ('wide' | 'portrait' | 'balanced')[];
  symmetries:             ('none' | 'partial' | 'strong')[];
  primaryLaneWidthRange:  [number, number]; // inclusive min, max
  secondaryLaneWidthRange:[number, number];
  branchCountRange:       [number, number];
  loopCountRange:         [number, number];
  hubCountRange:          [number, number];
  clearingPatterns:       ClearingPattern[];
  obstaclePatterns:       ObstaclePattern[];
  startGateRelationships: ('opposite' | 'diagonal' | 'offset' | 'indirect')[];
  routeBiases:            RouteBias[];
}

const FAMILY_PROFILES: Readonly<Record<MapTopologyFamily, FamilyProfile>> = {
  open_plaza: {
    aspectRatios:            ['balanced', 'wide'],
    symmetries:              ['none', 'partial'],
    primaryLaneWidthRange:   [3, 5],
    secondaryLaneWidthRange: [2, 3],
    branchCountRange:        [1, 3],
    loopCountRange:          [0, 2],
    hubCountRange:           [1, 2],
    clearingPatterns:        ['scattered', 'radial'],
    obstaclePatterns:        ['none', 'islands'],
    startGateRelationships:  ['opposite', 'diagonal'],
    routeBiases:             ['open', 'mixed'],
  },
  academic_quad: {
    aspectRatios:            ['wide', 'balanced'],
    symmetries:              ['partial', 'strong'],
    primaryLaneWidthRange:   [2, 4],
    secondaryLaneWidthRange: [1, 3],
    branchCountRange:        [2, 4],
    loopCountRange:          [2, 4],
    hubCountRange:           [1, 3],
    clearingPatterns:        ['scattered', 'clustered'],
    obstaclePatterns:        ['islands', 'blocks'],
    startGateRelationships:  ['diagonal', 'offset'],
    routeBiases:             ['looping', 'mixed'],
  },
  simulation_complex: {
    aspectRatios:            ['portrait', 'balanced'],
    symmetries:              ['none', 'partial'],
    primaryLaneWidthRange:   [2, 4],
    secondaryLaneWidthRange: [1, 2],
    branchCountRange:        [2, 4],
    loopCountRange:          [0, 2],
    hubCountRange:           [1, 2],
    clearingPatterns:        ['linear', 'twin_pole'],
    obstaclePatterns:        ['blocks', 'walls'],
    startGateRelationships:  ['opposite', 'offset'],
    routeBiases:             ['progressive', 'branching'],
  },
  hub_and_spoke: {
    aspectRatios:            ['balanced', 'wide', 'portrait'],
    symmetries:              ['none', 'partial'],
    primaryLaneWidthRange:   [3, 5],
    secondaryLaneWidthRange: [1, 3],
    branchCountRange:        [3, 6],
    loopCountRange:          [0, 2],
    hubCountRange:           [1, 2],
    clearingPatterns:        ['radial', 'scattered'],
    obstaclePatterns:        ['islands', 'none'],
    startGateRelationships:  ['diagonal', 'opposite'],
    routeBiases:             ['branching', 'open'],
  },
  twin_hub: {
    aspectRatios:            ['portrait', 'balanced'],
    symmetries:              ['none', 'partial'],
    primaryLaneWidthRange:   [2, 4],
    secondaryLaneWidthRange: [2, 3],
    branchCountRange:        [2, 4],
    loopCountRange:          [1, 3],
    hubCountRange:           [2, 3],
    clearingPatterns:        ['twin_pole', 'clustered'],
    obstaclePatterns:        ['walls', 'islands'],
    startGateRelationships:  ['indirect', 'offset'],
    routeBiases:             ['mixed', 'looping'],
  },
  braided_pathways: {
    aspectRatios:            ['portrait', 'balanced'],
    symmetries:              ['none'],
    primaryLaneWidthRange:   [2, 3],
    secondaryLaneWidthRange: [1, 2],
    branchCountRange:        [2, 4],
    loopCountRange:          [3, 5],
    hubCountRange:           [1, 2],
    clearingPatterns:        ['scattered', 'linear'],
    obstaclePatterns:        ['none', 'islands'],
    startGateRelationships:  ['opposite', 'diagonal'],
    routeBiases:             ['looping', 'mixed'],
  },
  campus_promenade: {
    aspectRatios:            ['portrait', 'balanced'],
    symmetries:              ['none', 'partial'],
    primaryLaneWidthRange:   [3, 5],
    secondaryLaneWidthRange: [2, 3],
    branchCountRange:        [1, 3],
    loopCountRange:          [2, 4],
    hubCountRange:           [2, 3],
    clearingPatterns:        ['linear', 'scattered'],
    obstaclePatterns:        ['none', 'islands'],
    startGateRelationships:  ['opposite', 'offset'],
    routeBiases:             ['looping', 'progressive'],
  },
  radial_training_center: {
    aspectRatios:            ['balanced', 'wide'],
    symmetries:              ['none', 'partial'],
    primaryLaneWidthRange:   [3, 5],
    secondaryLaneWidthRange: [2, 3],
    branchCountRange:        [3, 6],
    loopCountRange:          [1, 3],
    hubCountRange:           [1, 2],
    clearingPatterns:        ['radial', 'scattered'],
    obstaclePatterns:        ['islands', 'none'],
    startGateRelationships:  ['diagonal', 'offset'],
    routeBiases:             ['branching', 'open'],
  },
  staggered_academic_blocks: {
    aspectRatios:            ['wide', 'balanced'],
    symmetries:              ['none'],
    primaryLaneWidthRange:   [2, 4],
    secondaryLaneWidthRange: [1, 3],
    branchCountRange:        [3, 5],
    loopCountRange:          [1, 3],
    hubCountRange:           [2, 4],
    clearingPatterns:        ['clustered', 'scattered'],
    obstaclePatterns:        ['blocks', 'mixed'],
    startGateRelationships:  ['diagonal', 'indirect'],
    routeBiases:             ['branching', 'mixed'],
  },
  clustered_training_bays: {
    aspectRatios:            ['balanced', 'portrait'],
    symmetries:              ['partial', 'none'],
    primaryLaneWidthRange:   [3, 5],
    secondaryLaneWidthRange: [2, 3],
    branchCountRange:        [2, 4],
    loopCountRange:          [0, 2],
    hubCountRange:           [1, 3],
    clearingPatterns:        ['clustered', 'twin_pole'],
    obstaclePatterns:        ['walls', 'blocks'],
    startGateRelationships:  ['opposite', 'offset'],
    routeBiases:             ['progressive', 'branching'],
  },
  serpentine_campus_walk: {
    aspectRatios:            ['portrait', 'balanced'],
    symmetries:              ['none'],
    primaryLaneWidthRange:   [2, 4],
    secondaryLaneWidthRange: [1, 3],
    branchCountRange:        [2, 3],
    loopCountRange:          [2, 4],
    hubCountRange:           [1, 3],
    clearingPatterns:        ['linear', 'scattered'],
    obstaclePatterns:        ['mixed', 'walls'],
    startGateRelationships:  ['opposite', 'offset'],
    routeBiases:             ['progressive', 'looping'],
  },
  multi_court_campus: {
    aspectRatios:            ['balanced', 'wide', 'portrait'],
    symmetries:              ['none', 'partial'],
    primaryLaneWidthRange:   [3, 5],
    secondaryLaneWidthRange: [2, 3],
    branchCountRange:        [2, 4],
    loopCountRange:          [1, 3],
    hubCountRange:           [2, 4],
    clearingPatterns:        ['clustered', 'twin_pole'],
    obstaclePatterns:        ['islands', 'blocks'],
    startGateRelationships:  ['opposite', 'diagonal'],
    routeBiases:             ['mixed', 'open'],
  },
};

// ── Book I authored DNA (Chapters 1–10) ───────────────────────────────────────
//
// Each entry accurately describes the structural character of its authored map.
// Families are all distinct (maximum intra-book diversity).
// No consecutive pair shares a family.
//
// Ch  | Family                    | Theme
// ─────────────────────────────────────────────────────────────────
//  1  | open_plaza                | Clinical Simulation Commons
//  2  | academic_quad             | Academic Training Quad
//  3  | simulation_complex        | Skills Practice Plaza
//  4  | hub_and_spoke             | Emergency Simulation Court
//  5  | twin_hub                  | Standardized Patient Pavilion
//  6  | campus_promenade          | Mock Ward Campus
//  7  | braided_pathways          | Diagnostic Training Center
//  8  | staggered_academic_blocks | Anatomy Learning Garden
//  9  | serpentine_campus_walk    | Clinical Skills Complex
// 10  | multi_court_campus        | Capstone Simulation Campus

const BOOK1_DNA: Readonly<Record<number, ChapterMapDNA>> = {
  1: {
    chapterId:             1,
    seed:                  dnaSeedFor(SAGA_ID, BOOK1_ID, 1),
    themeName:             'Clinical Simulation Commons',
    topologyFamily:        'open_plaza',
    aspectRatio:           'balanced',
    symmetry:              'partial',
    primaryLaneWidth:      4,
    secondaryLaneWidth:    2,
    branchCount:           2,
    loopCount:             1,
    hubCount:              1,
    clearingPattern:       'scattered',
    obstaclePattern:       'none',
    startGateRelationship: 'opposite',
    routeBias:             'open',
  },
  2: {
    chapterId:             2,
    seed:                  dnaSeedFor(SAGA_ID, BOOK1_ID, 2),
    themeName:             'Academic Training Quad',
    topologyFamily:        'academic_quad',
    aspectRatio:           'wide',
    symmetry:              'partial',
    primaryLaneWidth:      3,
    secondaryLaneWidth:    2,
    branchCount:           3,
    loopCount:             2,
    hubCount:              2,
    clearingPattern:       'scattered',
    obstaclePattern:       'islands',
    startGateRelationship: 'diagonal',
    routeBias:             'looping',
  },
  3: {
    chapterId:             3,
    seed:                  dnaSeedFor(SAGA_ID, BOOK1_ID, 3),
    themeName:             'Skills Practice Plaza',
    topologyFamily:        'simulation_complex',
    aspectRatio:           'portrait',
    symmetry:              'none',
    primaryLaneWidth:      3,
    secondaryLaneWidth:    2,
    branchCount:           2,
    loopCount:             1,
    hubCount:              1,
    clearingPattern:       'linear',
    obstaclePattern:       'blocks',
    startGateRelationship: 'opposite',
    routeBias:             'progressive',
  },
  4: {
    chapterId:             4,
    seed:                  dnaSeedFor(SAGA_ID, BOOK1_ID, 4),
    themeName:             'Emergency Simulation Court',
    topologyFamily:        'hub_and_spoke',
    aspectRatio:           'balanced',
    symmetry:              'partial',
    primaryLaneWidth:      3,
    secondaryLaneWidth:    1,
    branchCount:           4,
    loopCount:             1,
    hubCount:              1,
    clearingPattern:       'radial',
    obstaclePattern:       'islands',
    startGateRelationship: 'diagonal',
    routeBias:             'branching',
  },
  5: {
    chapterId:             5,
    seed:                  dnaSeedFor(SAGA_ID, BOOK1_ID, 5),
    themeName:             'Standardized Patient Pavilion',
    topologyFamily:        'twin_hub',
    aspectRatio:           'portrait',
    symmetry:              'none',
    primaryLaneWidth:      3,
    secondaryLaneWidth:    2,
    branchCount:           3,
    loopCount:             2,
    hubCount:              2,
    clearingPattern:       'twin_pole',
    obstaclePattern:       'walls',
    startGateRelationship: 'indirect',
    routeBias:             'mixed',
  },
  6: {
    chapterId:             6,
    seed:                  dnaSeedFor(SAGA_ID, BOOK1_ID, 6),
    themeName:             'Mock Ward Campus',
    topologyFamily:        'campus_promenade',
    aspectRatio:           'portrait',
    symmetry:              'none',
    primaryLaneWidth:      4,
    secondaryLaneWidth:    2,
    branchCount:           2,
    loopCount:             3,
    hubCount:              2,
    clearingPattern:       'linear',
    obstaclePattern:       'none',
    startGateRelationship: 'opposite',
    routeBias:             'looping',
  },
  7: {
    chapterId:             7,
    seed:                  dnaSeedFor(SAGA_ID, BOOK1_ID, 7),
    themeName:             'Diagnostic Training Center',
    topologyFamily:        'braided_pathways',
    aspectRatio:           'portrait',
    symmetry:              'none',
    primaryLaneWidth:      3,
    secondaryLaneWidth:    1,
    branchCount:           3,
    loopCount:             4,
    hubCount:              1,
    clearingPattern:       'scattered',
    obstaclePattern:       'none',
    startGateRelationship: 'opposite',
    routeBias:             'looping',
  },
  8: {
    chapterId:             8,
    seed:                  dnaSeedFor(SAGA_ID, BOOK1_ID, 8),
    themeName:             'Anatomy Learning Garden',
    topologyFamily:        'staggered_academic_blocks',
    aspectRatio:           'wide',
    symmetry:              'none',
    primaryLaneWidth:      3,
    secondaryLaneWidth:    2,
    branchCount:           4,
    loopCount:             2,
    hubCount:              3,
    clearingPattern:       'clustered',
    obstaclePattern:       'blocks',
    startGateRelationship: 'diagonal',
    routeBias:             'branching',
  },
  9: {
    chapterId:             9,
    seed:                  dnaSeedFor(SAGA_ID, BOOK1_ID, 9),
    themeName:             'Clinical Skills Complex',
    topologyFamily:        'serpentine_campus_walk',
    aspectRatio:           'portrait',
    symmetry:              'none',
    primaryLaneWidth:      3,
    secondaryLaneWidth:    2,
    branchCount:           2,
    loopCount:             2,
    hubCount:              2,
    clearingPattern:       'scattered',
    obstaclePattern:       'mixed',
    startGateRelationship: 'offset',
    routeBias:             'progressive',
  },
  10: {
    chapterId:             10,
    seed:                  dnaSeedFor(SAGA_ID, BOOK1_ID, 10),
    themeName:             'Capstone Simulation Campus',
    topologyFamily:        'multi_court_campus',
    aspectRatio:           'balanced',
    symmetry:              'none',
    primaryLaneWidth:      4,
    secondaryLaneWidth:    2,
    branchCount:           3,
    loopCount:             2,
    hubCount:              3,
    clearingPattern:       'clustered',
    obstaclePattern:       'islands',
    startGateRelationship: 'opposite',
    routeBias:             'mixed',
  },
};

// ── Structural signature ──────────────────────────────────────────────────────

function branchBand(n: number): 'low' | 'mid' | 'high' {
  return n <= 2 ? 'low' : n <= 4 ? 'mid' : 'high';
}

function loopBand(n: number): 'low' | 'mid' | 'high' {
  return n <= 1 ? 'low' : n <= 3 ? 'mid' : 'high';
}

/** Computes the 7-dimension structural signature used for diversity comparison. */
export function computeStructureSignature(dna: ChapterMapDNA): MapStructureSignature {
  return {
    topologyFamily:        dna.topologyFamily,
    aspectRatio:           dna.aspectRatio,
    branchBand:            branchBand(dna.branchCount),
    loopBand:              loopBand(dna.loopCount),
    hubCount:              dna.hubCount,
    clearingPattern:       dna.clearingPattern,
    startGateRelationship: dna.startGateRelationship,
  };
}

/**
 * Returns the number of dimensions (0–7) on which two signatures agree.
 * Used to detect structural similarity during diversity enforcement.
 */
export function signatureSimilarity(
  a: MapStructureSignature,
  b: MapStructureSignature,
): number {
  return [
    a.topologyFamily        === b.topologyFamily,
    a.aspectRatio           === b.aspectRatio,
    a.branchBand            === b.branchBand,
    a.loopBand              === b.loopBand,
    a.hubCount              === b.hubCount,
    a.clearingPattern       === b.clearingPattern,
    a.startGateRelationship === b.startGateRelationship,
  ].filter(Boolean).length;
}

// ── Procedural DNA generator (Ch11+) ─────────────────────────────────────────

/** All 12 topology families in canonical order. */
const ALL_FAMILIES: MapTopologyFamily[] = [
  'open_plaza', 'academic_quad', 'simulation_complex', 'hub_and_spoke',
  'twin_hub', 'braided_pathways', 'campus_promenade', 'radial_training_center',
  'staggered_academic_blocks', 'clustered_training_bays',
  'serpentine_campus_walk', 'multi_court_campus',
];

/** Picks index `i` from an array using a pre-seeded RNG value in [0,1). */
function pick<T>(arr: T[], rval: number): T {
  return arr[Math.floor(rval * arr.length)]!;
}

/** Returns an integer in [min, max] inclusive using a pre-seeded RNG value. */
function intInRange(min: number, max: number, rval: number): number {
  return min + Math.floor(rval * (max - min + 1));
}

/**
 * Draws one candidate DNA from a deterministic RNG for the given chapter.
 * The RNG is derived from the chapter's seed + an optional retry suffix.
 */
function drawDNA(
  chapter:  number,
  seedStr:  string,
  retrySuffix: string,
): ChapterMapDNA {
  const rng = mulberry32(fnv1a32(`${seedStr}:dna:${retrySuffix}`));

  const family  = pick(ALL_FAMILIES, rng());
  const profile = FAMILY_PROFILES[family];

  return {
    chapterId:             chapter,
    seed:                  seedStr,
    themeName:             `Chapter ${chapter} Training Campus`,
    topologyFamily:        family,
    aspectRatio:           pick(profile.aspectRatios,            rng()) as ChapterMapDNA['aspectRatio'],
    symmetry:              pick(profile.symmetries,              rng()) as ChapterMapDNA['symmetry'],
    primaryLaneWidth:      intInRange(...profile.primaryLaneWidthRange,   rng()),
    secondaryLaneWidth:    intInRange(...profile.secondaryLaneWidthRange,  rng()),
    branchCount:           intInRange(...profile.branchCountRange,         rng()),
    loopCount:             intInRange(...profile.loopCountRange,            rng()),
    hubCount:              intInRange(...profile.hubCountRange,             rng()),
    clearingPattern:       pick(profile.clearingPatterns,        rng()) as ClearingPattern,
    obstaclePattern:       pick(profile.obstaclePatterns,        rng()) as ObstaclePattern,
    startGateRelationship: pick(profile.startGateRelationships,  rng()) as ChapterMapDNA['startGateRelationship'],
    routeBias:             pick(profile.routeBiases,             rng()) as RouteBias,
  };
}

/**
 * Generates a procedural DNA for the given chapter.
 *
 * Applies diversity rules: rejects candidates that are structurally too
 * similar to any DNA in `existingPool` (similarity ≥ SIMILARITY_REJECT_THRESHOLD),
 * or whose family matches the immediately preceding chapter's family.
 *
 * Falls back to the last candidate after MAX_DNA_RETRIES exhausted attempts.
 */
export function generateProceduralDNA(
  chapter:      number,
  sagaId:       string,
  bookId:       string,
  existingPool: ChapterMapDNA[],
): ChapterMapDNA {
  const seedStr  = dnaSeedFor(sagaId, bookId, chapter);
  const existingSigs = existingPool.map(computeStructureSignature);
  const prevFamily   = existingPool.length > 0
    ? existingPool[existingPool.length - 1]!.topologyFamily
    : null;

  let best: ChapterMapDNA | null = null;

  for (let attempt = 0; attempt < MAX_DNA_RETRIES; attempt++) {
    const candidate = drawDNA(chapter, seedStr, `attempt-${attempt}`);
    const sig       = computeStructureSignature(candidate);

    // Rule 1: no consecutive same family
    if (candidate.topologyFamily === prevFamily) continue;

    // Rule 2: not too similar to any existing chapter in the book
    const tooSimilar = existingSigs.some(
      es => signatureSimilarity(sig, es) >= SIMILARITY_REJECT_THRESHOLD,
    );
    if (tooSimilar) {
      // Keep as best-so-far if family at least differs from prev
      if (best === null) best = candidate;
      continue;
    }

    return candidate; // passes all checks
  }

  // Exhausted retries — return best-so-far or the first attempt as fallback
  return best ?? drawDNA(chapter, seedStr, 'attempt-0');
}

// ── Theme names for Book I procedural overflow ────────────────────────────────
//
// Ch11+ procedural maps use the theme name from the drawDNA function.
// If you need themed names for Book II chapters, override the `themeName`
// field in the persisted blueprint once the chapter is authored.

// ── Public API ────────────────────────────────────────────────────────────────

const dnaCache = new Map<number, ChapterMapDNA>();

/**
 * Returns the ChapterMapDNA for the given chapter number.
 *
 * Chapters 1–10: hardcoded, pre-accepted Book I DNA.
 * Chapters 11+:  procedurally generated from the seed formula, with
 *                diversity enforcement against all lower-numbered chapters
 *                in the same book.
 *
 * Results are cached — the same chapter always returns the same object.
 */
export function getChapterMapDNA(chapter: number): ChapterMapDNA {
  const cached = dnaCache.get(chapter);
  if (cached) return cached;

  let dna: ChapterMapDNA;

  if (chapter >= 1 && chapter <= 10) {
    dna = BOOK1_DNA[chapter]!;
  } else {
    // Build the pool of all lower-chapter DNAs for diversity checking.
    // For Ch11+ we only need Ch1–10 as the anchor pool (Book I is fixed).
    // For chapters beyond 11, include all previously generated DNA.
    const pool: ChapterMapDNA[] = [];
    for (let c = 1; c < chapter; c++) {
      pool.push(getChapterMapDNA(c));
    }
    dna = generateProceduralDNA(chapter, SAGA_ID, BOOK1_ID, pool);
  }

  dnaCache.set(chapter, dna);
  return dna;
}

/**
 * Returns all chapter DNA objects for the given chapter range (inclusive).
 * Useful for diversity analysis and testing.
 */
export function getChapterDNARange(fromChapter: number, toChapter: number): ChapterMapDNA[] {
  const result: ChapterMapDNA[] = [];
  for (let c = fromChapter; c <= toChapter; c++) {
    result.push(getChapterMapDNA(c));
  }
  return result;
}

/**
 * Returns the structural signature for a DNA object.
 * Re-exported here for use in tests and the art/blueprint pipeline.
 */
export { computeStructureSignature, signatureSimilarity };
