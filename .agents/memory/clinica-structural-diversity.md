---
name: Structural Diversity Enforcement (Push 8)
description: FullStructuralFingerprint (12 dimensions) + validateBookDiversity for detecting structural repetition across chapter maps. Includes threshold calibration lessons and BOOK1 DNA tweaks.
---

## Rule
Before accepting a generated chapter map, compare its 12-dimension FullStructuralFingerprint against every existing chapter in the same Book. Reject the candidate if similarity ≥ FULL_REJECT_THRESHOLD (9 out of 12 dimensions match).

**Why:** Even with different hex coordinates, 9+ matching dimensions means the player will perceive it as "the same map rotated". TopologyFamily is the strongest differentiator but topologically distinct families can still feel structurally identical across the other 11 dimensions.

## How to apply
- Module: `frontend/src/game/journeyMap/chapterDiversityEnforcement.ts`
- Public API: `computeFullFingerprint(chapter)`, `getChapterFullFingerprint(chapter)` (cached), `fullFingerprintSimilarity(a, b)`, `validateBookDiversity(chapters)`, `FULL_REJECT_THRESHOLD`
- Types added in Push 8 section of `chapterMapTemplate.types.ts`: `FullStructuralFingerprint`, `BookDiversityReport`, `JunctionCountBand`, `ClearingCountBand`, `AvgClearingSizeBand`, `PrimaryLaneBand`, `DeadEndBand`

## 12 Fingerprint Dimensions
1. topologyFamily (DNA, exact)
2. aspectRatio (DNA, exact)
3. symmetry (DNA, exact — was missing from the old 7-dim MapStructureSignature)
4. hubCount (DNA, exact)
5. junctionCountBand (PathwayGraph JUNCTION nodes: few≤2, moderate≤5, many≥6)
6. branchBand (DNA branchCount: low≤2, mid≤4, high≥5)
7. loopBand (DNA loopCount: low≤1, mid≤3, high≥4)
8. clearingCountBand (HexLaneLayout.clearingZones.length: few≤6, moderate≤9, many≥10)
9. avgClearingSizeBand (mean clearing tile area: small<4, medium<8, large≥8)
10. primaryLaneBand (DNA.primaryLaneWidth: narrow≤4, standard≤6, wide≥7)
11. startGateRelationship (DNA, exact)
12. deadEndBand (PathwayGraphValidation.deadEndCount: none=0, few≤2, many≥3)

## Threshold Calibration
- Original 7-dim MapStructureSignature used 5/7 ≈ 71%.
- With 12 dimensions: 71% × 12 ≈ 8.5 → ceiling = 9.
- FULL_REJECT_THRESHOLD = 9 (reject if ≥ 9 of 12 match).
- **Critical:** Initial guess of 8 was too strict — BOOK1_DNA had 7 pairs at similarity ≥ 8 but only 3 at ≥ 9.

## Computed dimensions inflate similarity
junctionCountBand, clearingCountBand, avgClearingSizeBand, deadEndBand are derived from PathwayGraph + HexLaneLayout. Many chapters naturally produce similar band values (e.g., most chapters have 'few' junctions, 'small' average clearing size). This can push two chapters to 8-9/12 similarity even when they feel structurally distinct. **Set threshold at ≥ 75% of dim count, not lower.**

## BOOK1_DNA tweaks required (Ch3 + Ch6)
After raising FULL_REJECT_THRESHOLD to 9, three pairs still scored 9/12:
- Ch1 × Ch3: shared hubCount=1, branchBand=low, loopBand=low, primaryLaneBand=narrow, startGateRelationship=opposite + computed
- Ch5 × Ch6: shared portrait, none(sym), mid-loop, hubCount=2, narrow + computed
- Ch6 × Ch9: shared portrait, none(sym), low-branch, mid-loop, hubCount=2, narrow + computed

**Fix applied to BOOK1_DNA:**
- Ch3: `startGateRelationship: 'opposite' → 'indirect'` (breaks Ch1×Ch3 match)
- Ch6: `symmetry: 'none' → 'partial'` (breaks Ch5×Ch6 AND Ch6×Ch9 matches simultaneously)

These changes cascade to PathwayGraph → HexLaneLayout → SceneryLayout → BackgroundSpec for those two chapters, but all structural property tests continued to pass.

## Diversity Axes Required
validateBookDiversity checks all six axes:
1. wide vs tall: ≥1 'wide' aspectRatio AND ≥1 'portrait' aspectRatio
2. single vs multi hub: hubCount ≤1 AND ≥2 both present
3. looping vs branching: loopBand mid/high AND branchBand mid/high both present
4. symmetric vs asymmetric: symmetry strong/partial AND none both present
5. clearing density: ≥2 distinct clearingCountBands
6. topology variety: ≥4 distinct topology families (BOOK1 has 10 — all unique)

## Test File
`frontend/tests/journey_map_diversity.test.ts` — 45 tests.
Total tests as of Push 8: 2,214 passed, 0 failed.
