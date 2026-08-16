/**
 * tests/journey_map_dna.test.ts — Push 3: Procedural Map Archetype Grammar
 *
 * Verifies the ChapterMapDNA system:
 *   1. Valid DNA shape for all Book I chapters (1–10)
 *   2. Book I uses all distinct topology families
 *   3. No consecutive chapters share the same topology family
 *   4. No topology family used more than twice in Ch1–10
 *   5. Seed matches the canonical formula
 *   6. DNA is deterministic / cached (same chapter → same object)
 *   7. Structural signatures are sufficiently diverse within Book I
 *   8. Procedural DNA (Ch11+) satisfies diversity rules against Ch1–10
 *   9. Family profiles cover all 12 families
 *  10. Archetype ≠ fixed layout: two procedural chapters in same family differ
 */

import {
  getChapterMapDNA,
  getChapterDNARange,
  computeStructureSignature,
  signatureSimilarity,
  generateProceduralDNA,
  dnaSeedFor,
  SAGA_ID,
  BOOK1_ID,
  SIMILARITY_REJECT_THRESHOLD,
} from '../src/game/journeyMap/chapterMapDNA';

import type {
  ChapterMapDNA,
  MapTopologyFamily,
  ClearingPattern,
  ObstaclePattern,
  RouteBias,
} from '../src/game/journeyMap/chapterMapTemplate.types';

let passed = 0, failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { passed++; console.log(`PASS - ${name}`); }
  else    { failed++; console.log(`FAIL - ${name}${detail ? ': ' + detail : ''}`); }
}

// ── valid value sets ──────────────────────────────────────────────────────────

const VALID_FAMILIES: MapTopologyFamily[] = [
  'open_plaza', 'academic_quad', 'simulation_complex', 'hub_and_spoke',
  'twin_hub', 'braided_pathways', 'campus_promenade', 'radial_training_center',
  'staggered_academic_blocks', 'clustered_training_bays',
  'serpentine_campus_walk', 'multi_court_campus',
];
const VALID_ASPECT    = new Set(['wide', 'portrait', 'balanced']);
const VALID_SYMMETRY  = new Set(['none', 'partial', 'strong']);
const VALID_SGR       = new Set(['opposite', 'diagonal', 'offset', 'indirect']);
const VALID_CLEARING: ClearingPattern[]  = ['scattered','clustered','linear','radial','twin_pole'];
const VALID_OBSTACLE: ObstaclePattern[]  = ['none','islands','walls','blocks','mixed'];
const VALID_ROUTE:    RouteBias[]        = ['open','branching','looping','progressive','mixed'];

// ── 1. Valid DNA shape for all Book I chapters ────────────────────────────────

for (let ch = 1; ch <= 10; ch++) {
  const dna = getChapterMapDNA(ch);

  check(`[ch${ch}] chapterId === ${ch}`,         dna.chapterId === ch);
  check(`[ch${ch}] seed is non-empty string`,    typeof dna.seed === 'string' && dna.seed.length > 0);
  check(`[ch${ch}] themeName is non-empty`,      typeof dna.themeName === 'string' && dna.themeName.length > 0);
  check(`[ch${ch}] topologyFamily is valid`,     VALID_FAMILIES.includes(dna.topologyFamily),
    `got '${dna.topologyFamily}'`);
  check(`[ch${ch}] aspectRatio is valid`,        VALID_ASPECT.has(dna.aspectRatio));
  check(`[ch${ch}] symmetry is valid`,           VALID_SYMMETRY.has(dna.symmetry));
  check(`[ch${ch}] primaryLaneWidth ≥ 1`,        dna.primaryLaneWidth >= 1);
  check(`[ch${ch}] secondaryLaneWidth ≥ 1`,      dna.secondaryLaneWidth >= 1);
  check(`[ch${ch}] primaryLane ≥ secondaryLane`, dna.primaryLaneWidth >= dna.secondaryLaneWidth);
  check(`[ch${ch}] branchCount ≥ 1`,             dna.branchCount >= 1);
  check(`[ch${ch}] loopCount ≥ 0`,               dna.loopCount >= 0);
  check(`[ch${ch}] hubCount ≥ 1`,                dna.hubCount >= 1);
  check(`[ch${ch}] clearingPattern is valid`,    VALID_CLEARING.includes(dna.clearingPattern));
  check(`[ch${ch}] obstaclePattern is valid`,    VALID_OBSTACLE.includes(dna.obstaclePattern));
  check(`[ch${ch}] startGateRelationship valid`, VALID_SGR.has(dna.startGateRelationship));
  check(`[ch${ch}] routeBias is valid`,          VALID_ROUTE.includes(dna.routeBias));
}

// ── 2. Book I uses all distinct topology families ─────────────────────────────

{
  const book1 = getChapterDNARange(1, 10);
  const families = book1.map(d => d.topologyFamily);
  const uniqueFamilies = new Set(families);

  check('[diversity] all 10 Book I chapters use distinct families',
    uniqueFamilies.size === 10, `unique count: ${uniqueFamilies.size}`);
}

// ── 3. No consecutive chapters share the same topology family ─────────────────

{
  const book1 = getChapterDNARange(1, 10);
  let consecutiveViolation = false;
  for (let i = 1; i < book1.length; i++) {
    if (book1[i]!.topologyFamily === book1[i - 1]!.topologyFamily) {
      consecutiveViolation = true;
      check(`[diversity] ch${i} and ch${i+1} MUST NOT share family — VIOLATION`,
        false, `both use '${book1[i]!.topologyFamily}'`);
    }
  }
  if (!consecutiveViolation) {
    check('[diversity] no consecutive chapters share topology family', true);
  }
}

// ── 4. No family used more than twice in Ch1–10 ───────────────────────────────

{
  const book1   = getChapterDNARange(1, 10);
  const counts  = new Map<string, number>();
  for (const d of book1) {
    counts.set(d.topologyFamily, (counts.get(d.topologyFamily) ?? 0) + 1);
  }
  let maxUsage = 0;
  for (const [fam, n] of counts) {
    if (n > maxUsage) maxUsage = n;
    check(`[diversity] '${fam}' used ≤ 2 times`, n <= 2, `used ${n} times`);
  }
  check('[diversity] max family usage ≤ 2', maxUsage <= 2, `actual max: ${maxUsage}`);
}

// ── 5. Seed matches the canonical formula ─────────────────────────────────────

{
  for (let ch = 1; ch <= 10; ch++) {
    const expected = dnaSeedFor(SAGA_ID, BOOK1_ID, ch);
    const actual   = getChapterMapDNA(ch).seed;
    check(`[seed ch${ch}] matches formula`, actual === expected,
      `expected '${expected}', got '${actual}'`);
  }
}

// ── 6. DNA is deterministic / cached ─────────────────────────────────────────

{
  for (const ch of [1, 5, 10]) {
    const a = getChapterMapDNA(ch);
    const b = getChapterMapDNA(ch);
    check(`[cache ch${ch}] same object reference returned`, a === b);
  }

  // Procedural chapter
  const p1 = getChapterMapDNA(12);
  const p2 = getChapterMapDNA(12);
  check('[cache ch12] procedural chapter is cached', p1 === p2);
}

// ── 7. Structural signatures are diverse within Book I ────────────────────────
//
// No two chapters should match on ≥ SIMILARITY_REJECT_THRESHOLD dimensions.

{
  const book1 = getChapterDNARange(1, 10);
  const sigs  = book1.map(computeStructureSignature);

  let violationFound = false;
  for (let i = 0; i < sigs.length; i++) {
    for (let j = i + 1; j < sigs.length; j++) {
      const sim = signatureSimilarity(sigs[i]!, sigs[j]!);
      if (sim >= SIMILARITY_REJECT_THRESHOLD) {
        violationFound = true;
        check(
          `[diversity-sig] ch${i+1} vs ch${j+1} similarity ${sim} < ${SIMILARITY_REJECT_THRESHOLD}`,
          false, `sim=${sim}`);
      }
    }
  }
  if (!violationFound) {
    check('[diversity-sig] all Book I chapter pairs below similarity threshold', true);
  }
}

// ── 8. computeStructureSignature produces valid signatures ────────────────────

{
  const VALID_BANDS = new Set(['low', 'mid', 'high']);
  for (let ch = 1; ch <= 10; ch++) {
    const sig = computeStructureSignature(getChapterMapDNA(ch));
    check(`[sig ch${ch}] topologyFamily valid`,     VALID_FAMILIES.includes(sig.topologyFamily));
    check(`[sig ch${ch}] aspectRatio valid`,        VALID_ASPECT.has(sig.aspectRatio));
    check(`[sig ch${ch}] branchBand valid`,         VALID_BANDS.has(sig.branchBand));
    check(`[sig ch${ch}] loopBand valid`,           VALID_BANDS.has(sig.loopBand));
    check(`[sig ch${ch}] hubCount >= 1`,            sig.hubCount >= 1);
    check(`[sig ch${ch}] clearingPattern valid`,    VALID_CLEARING.includes(sig.clearingPattern));
    check(`[sig ch${ch}] startGateRelationship valid`, VALID_SGR.has(sig.startGateRelationship));
  }
}

// ── 9. Procedural DNA (Ch11–15) satisfies diversity rules ─────────────────────

{
  const pool     = getChapterDNARange(1, 10);
  const pool15   = getChapterDNARange(1, 15);
  const sigs15   = pool15.map(computeStructureSignature);

  // 9a: No consecutive violation across Ch10–15
  for (let i = 10; i < pool15.length; i++) {
    const prev = pool15[i - 1]!;
    const cur  = pool15[i]!;
    check(`[proc ch${i+1}] family differs from ch${i}`,
      cur.topologyFamily !== prev.topologyFamily,
      `both '${cur.topologyFamily}'`);
  }

  // 9b: No pair in Ch1–15 is too similar
  let procViolation = false;
  for (let i = 0; i < sigs15.length; i++) {
    for (let j = i + 1; j < sigs15.length; j++) {
      const sim = signatureSimilarity(sigs15[i]!, sigs15[j]!);
      if (sim >= SIMILARITY_REJECT_THRESHOLD) {
        procViolation = true;
        check(
          `[proc-sim] ch${i+1} vs ch${j+1} similarity ${sim} < ${SIMILARITY_REJECT_THRESHOLD}`,
          false, `sim=${sim}`);
      }
    }
  }
  if (!procViolation) {
    check('[proc] no chapter pair in Ch1–15 exceeds similarity threshold', true);
  }

  // 9c: Procedural chapters have valid DNA shape
  for (let ch = 11; ch <= 15; ch++) {
    const dna = getChapterMapDNA(ch);
    check(`[proc ch${ch}] valid topologyFamily`, VALID_FAMILIES.includes(dna.topologyFamily));
    check(`[proc ch${ch}] valid aspectRatio`,    VALID_ASPECT.has(dna.aspectRatio));
    check(`[proc ch${ch}] branchCount ≥ 1`,      dna.branchCount >= 1);
    check(`[proc ch${ch}] hubCount ≥ 1`,         dna.hubCount >= 1);
    check(`[proc ch${ch}] valid clearingPattern`, VALID_CLEARING.includes(dna.clearingPattern));
    check(`[proc ch${ch}] chapterId === ${ch}`,  dna.chapterId === ch);
  }
}

// ── 10. Archetype ≠ fixed layout: same family → different structure ───────────
//
// Two chapters procedurally generated in the same family (by forcing the
// family) must differ on at least one other structural dimension.
// We test this by generating with different seeds and confirming the DNA
// objects differ in at least 2 fields.

{
  // Force two different chapter numbers that end up in the same family
  // by finding a family used in Ch11–20 and checking its partner.
  const range = getChapterDNARange(11, 22);
  const byFamily = new Map<MapTopologyFamily, ChapterMapDNA[]>();
  for (const dna of range) {
    const arr = byFamily.get(dna.topologyFamily) ?? [];
    arr.push(dna);
    byFamily.set(dna.topologyFamily, arr);
  }

  let variantFound = false;
  for (const [fam, members] of byFamily) {
    if (members.length >= 2) {
      variantFound = true;
      const [a, b] = [members[0]!, members[1]!];
      const diffs = [
        a.aspectRatio !== b.aspectRatio,
        a.symmetry !== b.symmetry,
        a.branchCount !== b.branchCount,
        a.loopCount !== b.loopCount,
        a.hubCount !== b.hubCount,
        a.clearingPattern !== b.clearingPattern,
        a.startGateRelationship !== b.startGateRelationship,
        a.routeBias !== b.routeBias,
      ].filter(Boolean).length;

      check(
        `[variant] two '${fam}' maps differ on ≥ 2 structural fields`,
        diffs >= 2,
        `only ${diffs} differences (ch${a.chapterId} vs ch${b.chapterId})`,
      );
    }
  }

  if (!variantFound) {
    // Expand the search window until we find a shared family
    check('[variant] found at least one shared family in procedural range', false,
      'no family appeared twice in Ch11–22; widen the test range');
  }
}

// ── 11. signatureSimilarity is symmetric and self-similarity is 7 ────────────

{
  for (const ch of [1, 5, 10]) {
    const sig = computeStructureSignature(getChapterMapDNA(ch));
    check(`[sim-sym ch${ch}] self-similarity === 7`, signatureSimilarity(sig, sig) === 7);
  }

  const s1 = computeStructureSignature(getChapterMapDNA(1));
  const s2 = computeStructureSignature(getChapterMapDNA(2));
  check('[sim-sym] similarity(a,b) === similarity(b,a)',
    signatureSimilarity(s1, s2) === signatureSimilarity(s2, s1));
}

// ── 12. dnaSeedFor produces chapter-unique seeds ──────────────────────────────

{
  const seeds = new Set<string>();
  for (let ch = 1; ch <= 10; ch++) {
    seeds.add(dnaSeedFor(SAGA_ID, BOOK1_ID, ch));
  }
  check('[seed] all 10 Book I seeds are unique', seeds.size === 10);

  check('[seed] seed contains sagaId',   dnaSeedFor(SAGA_ID, BOOK1_ID, 1).includes(SAGA_ID));
  check('[seed] seed contains bookId',   dnaSeedFor(SAGA_ID, BOOK1_ID, 1).includes(BOOK1_ID));
  check('[seed] seed contains chapter',  dnaSeedFor(SAGA_ID, BOOK1_ID, 7).includes('7'));
  check('[seed] seed contains version',  dnaSeedFor(SAGA_ID, BOOK1_ID, 1).includes('map-layout-v1'));
}

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
