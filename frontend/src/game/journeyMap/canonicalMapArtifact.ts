/**
 * journeyMap/canonicalMapArtifact.ts — Production Bridge Push 1
 *
 * Single production-facing entry point that composes the Push 3–8 data
 * pipeline into one coherent object and bridges it to the run lifecycle.
 *
 * ── Pipeline ──────────────────────────────────────────────────────────────
 *   DNA → PathwayGraph → HexLayout → SceneryLayout → BackgroundSpec
 *   + FullStructuralFingerprint (DiversityEnforcement)
 *   → CanonicalChapterMapArtifact
 *
 * Callers (journeyRunLifecycle.ts) call ONE function —
 * getCanonicalChapterMapArtifact — and receive everything needed to build
 * a JourneyRun:
 *   • HexTopology-compatible topology (tiles, startTileId, gateAnchorId, distances)
 *   • Zone metadata per tile (lane / clearing / transition)
 *   • Blueprint hash and layout version for diagnostics
 *   • Scenery safety result
 *   • Full pipeline intermediates (DNA, graph, layout, scenery, bgSpec)
 *
 * ── Determinism Guarantee ─────────────────────────────────────────────────
 * The artifact seed formula is derived solely from:
 *   chapter + bookId + sagaId + MAP_LAYOUT_VERSION
 * It is NEVER derived from playerId, attemptNumber, or shift.
 * Every run of the same chapter produces the same physical tile footprint.
 * Only encounters and shift presentation change between runs.
 *
 * ── MAP_LAYOUT_VERSION ────────────────────────────────────────────────────
 * Bump when any geometry-affecting module changes (DNA seed formula,
 * PathwayGraph generator, HexLayout expansion algorithm).  Stale cached
 * topology will be abandoned by the journeyRunRepository tile-count guard.
 *
 * COMMIT TAG: feat(journey): wire chapter 1 to canonical map blueprint pipeline
 */

import { getChapterMapDNA }                        from './chapterMapDNA';
import { getChapterPathwayGraph }                  from './chapterPathwayGraph';
import { getChapterHexLayout }                     from './chapterHexLayout';
import { getChapterSceneryLayout }                 from './chapterSceneryLayout';
import { getChapterBackgroundSpec }                from './chapterBackgroundSpec';
import { computeFullFingerprint }                  from './chapterDiversityEnforcement';
import { getBackgroundAuthoringManifests }         from './backgroundAuthoringManifest';
import { getChapterTerrainCellCount }              from './config';
import { getCanonicalStage1Blueprint }             from './canonicalStageContract';
import {
  createLiveStage1CandidateSnapshot,
  getCanonicalStage1Snapshot,
}                                                   from './canonicalStageIdentity';
import type { AxialCoord, HexTileZoneMeta }        from './topology';
import type {
  ChapterMapDNA,
  PathwayGraph,
  HexLaneLayout,
  SceneryLayout,
  ChapterBackgroundSpec,
  FullStructuralFingerprint,
} from './chapterMapTemplate.types';
import type { BackgroundAuthoringManifest }        from './backgroundAuthoringManifest';

// ── Map layout version ──────────────────────────────────────────────────────

/**
 * Bump this string when any geometry-affecting module changes:
 *   • chapterMapDNA.ts seed formula or DNA values
 *   • chapterPathwayGraph.ts generator logic
 *   • chapterHexLayout.ts expansion algorithm or seed formula
 *
 * The version is embedded in the blueprint hash so external callers can
 * detect stale layouts and trigger tile-count guard abandonment.
 */
// Imported from the leaf-level constants module to avoid a circular require
// with backgroundAuthoringManifest.ts.  Re-exported here so any consumer that
// imports MAP_LAYOUT_VERSION from canonicalMapArtifact continues to work.
import { MAP_LAYOUT_VERSION, getChapterMapLayoutVersion } from './journeyMapVersion';
export { MAP_LAYOUT_VERSION };

/**
 * Result of comparing a persisted run's actual coordinates to the canonical
 * Stage 2 footprint. Identity strings are useful diagnostics, but cannot prove
 * that a run's JSON tiles were not partially migrated or otherwise corrupted.
 */
export interface CanonicalRunGeometryComparison {
  readonly matches: boolean;
  readonly missingTileIds: readonly string[];
  readonly extraTileIds: readonly string[];
  readonly duplicateTileIds: readonly string[];
  readonly malformedTileIds: readonly string[];
  readonly startMatches: boolean;
  readonly gateMatches: boolean;
  readonly expectedStartTileId: string;
  readonly expectedGateAnchorTileId: string;
}

type RunGeometryCandidate = {
  readonly tiles: readonly { readonly id: string; readonly q: number; readonly r: number }[];
  readonly startTileId: string;
  readonly gateAnchorTileId?: string;
};

/**
 * Verifies the persisted coordinate set and route anchors, not only its claimed
 * version/hash. This is deliberately reusable by run recovery and Stage 2 UI
 * gating so both make the same fail-closed decision.
 */
export function compareRunGeometryToCanonicalArtifact(
  run: RunGeometryCandidate,
  artifact: Pick<CanonicalChapterMapArtifact, 'walkableCells' | 'asTopology'>,
): CanonicalRunGeometryComparison {
  const expected = new Set(artifact.walkableCells.map(cell => cellKey(cell.q, cell.r)));
  const actual = new Set<string>();
  const duplicateTileIds: string[] = [];
  const malformedTileIds: string[] = [];

  for (const tile of run.tiles) {
    const coordinateId = cellKey(tile.q, tile.r);
    if (!Number.isInteger(tile.q) || !Number.isInteger(tile.r) || tile.id !== coordinateId) {
      malformedTileIds.push(tile.id);
    }
    if (actual.has(coordinateId)) duplicateTileIds.push(coordinateId);
    actual.add(coordinateId);
  }

  const missingTileIds = [...expected].filter(id => !actual.has(id)).sort();
  const extraTileIds = [...actual].filter(id => !expected.has(id)).sort();
  const expectedStartTileId = artifact.asTopology.startTileId;
  const expectedGateAnchorTileId = artifact.asTopology.gateAnchorId;
  const startMatches = run.startTileId === expectedStartTileId;
  const gateMatches = run.gateAnchorTileId === expectedGateAnchorTileId;

  return {
    matches:
      missingTileIds.length === 0 &&
      extraTileIds.length === 0 &&
      duplicateTileIds.length === 0 &&
      malformedTileIds.length === 0 &&
      startMatches &&
      gateMatches,
    missingTileIds,
    extraTileIds,
    duplicateTileIds: [...new Set(duplicateTileIds)].sort(),
    malformedTileIds: [...new Set(malformedTileIds)].sort(),
    startMatches,
    gateMatches,
    expectedStartTileId,
    expectedGateAnchorTileId,
  };
}

// ── Internal hex geometry (self-contained, no topology.ts import needed) ────

const HEX_DIRS: AxialCoord[] = [
  { q:  1, r:  0 }, { q: -1, r:  0 },
  { q:  0, r:  1 }, { q:  0, r: -1 },
  { q:  1, r: -1 }, { q: -1, r:  1 },
];

function cellKey(q: number, r: number): string { return `${q},${r}`; }

function buildAdjacency(cells: AxialCoord[]): Map<string, string[]> {
  const coordSet = new Set(cells.map(c => cellKey(c.q, c.r)));
  const adj      = new Map<string, string[]>();
  for (const c of cells) {
    const k    = cellKey(c.q, c.r);
    const nbrs: string[] = [];
    for (const d of HEX_DIRS) {
      const nk = cellKey(c.q + d.q, c.r + d.r);
      if (coordSet.has(nk)) nbrs.push(nk);
    }
    adj.set(k, nbrs);
  }
  return adj;
}

function bfsDistances(
  adj:      Map<string, string[]>,
  startKey: string,
): Map<string, number> {
  const dist = new Map<string, number>();
  dist.set(startKey, 0);
  const queue: string[] = [startKey];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    const d   = dist.get(cur)!;
    for (const nb of (adj.get(cur) ?? [])) {
      if (!dist.has(nb)) { dist.set(nb, d + 1); queue.push(nb); }
    }
  }
  return dist;
}

// ── Zone classification ─────────────────────────────────────────────────────

/**
 * Classify every walkable cell in the HexLaneLayout into lane / clearing /
 * transition zone.
 *
 * Priority:
 *   1. clearing  — cell appears in any ClearingZone.cells
 *   2. lane      — cell appears in any LaneSegment.cells (not already clearing)
 *   3. transition — any remaining walkable cell (BFS expansion or gap filler)
 *
 * For clearingId / clearingType, the first matching ClearingZone wins
 * (cells belong to at most one zone in practice; deterministic tie-break).
 * For laneClass, the first matching LaneSegment wins.
 */
function buildZoneMeta(layout: HexLaneLayout): Map<string, HexTileZoneMeta> {
  const meta        = new Map<string, HexTileZoneMeta>();
  const clearingSet = new Set<string>();

  // 1. Clearing cells — highest priority
  for (const cz of layout.clearingZones) {
    for (const c of cz.cells) {
      const k = cellKey(c.q, c.r);
      if (!clearingSet.has(k)) {
        clearingSet.add(k);
        meta.set(k, {
          zoneType:    'clearing',
          clearingId:  cz.id,
          clearingType: cz.type as string,
        });
      }
    }
  }

  // 2. Lane cells — not already clearing
  const laneSet = new Set<string>();
  for (const seg of layout.laneSegments) {
    for (const c of seg.cells) {
      const k = cellKey(c.q, c.r);
      if (!clearingSet.has(k) && !laneSet.has(k)) {
        laneSet.add(k);
        meta.set(k, {
          zoneType:  'lane',
          laneClass: seg.width,
        });
      }
    }
  }

  // 3. Transition cells — any remaining walkable cell
  for (const c of layout.cells) {
    const k = cellKey(c.q, c.r);
    if (!meta.has(k)) {
      meta.set(k, { zoneType: 'transition' });
    }
  }

  return meta;
}

// ── Scenery safety check ────────────────────────────────────────────────────

/**
 * Verifies the hard invariant from Push 6:
 *   sceneryCell ∩ walkableSafetyMask === ∅
 *
 * Returns true when all scenery zones are clear of the safety mask.
 * Logs a warning (not a throw) so a rare edge-case does not crash production.
 */
function checkScenerySafety(scenery: SceneryLayout): boolean {
  const safetyMask = new Set(scenery.walkableSafetyMaskKeys);
  for (const zone of scenery.sceneryZones) {
    for (const cell of zone.cells) {
      if (safetyMask.has(cellKey(cell.q, cell.r))) return false;
    }
  }
  return true;
}

// ── Public types ────────────────────────────────────────────────────────────

/**
 * Topology-compatible representation of the artifact.
 * Satisfies the HexTopology shape expected by journeyRunLifecycle.ts
 * and buildInitialJourneyRun — callers do not need to import HexTopology
 * separately when they consume the artifact.
 */
export interface ArtifactTopology {
  readonly chapter:        number;
  readonly seed:           string;
  readonly tiles:          AxialCoord[];
  readonly startTileId:    string;
  readonly gateAnchorId:   string;
  readonly graphDistances: Map<string, number>;
  readonly zoneMeta:       Map<string, HexTileZoneMeta>;
}

/**
 * Stage 2 proof that the locked Stage 1 geometry can host the Journey run.
 * This is deliberately derived from the canonical artifact, never from a run
 * seed, so content rerolls cannot alter the validation result.
 */
export interface CanonicalStage2Validation {
  readonly status: 'VALIDATED' | 'INVALID';
  readonly validationArtifactPath: string;
  readonly expectedTileCount: number;
  readonly actualTileCount: number;
  readonly footprintLocked: boolean;
  readonly stage1FootprintMatch: boolean;
  readonly stage1StructureMatch: boolean;
  readonly connectedTileCount: number;
  readonly startPresent: boolean;
  readonly gatePresent: boolean;
  readonly startToGateConnected: boolean;
  readonly requiredRegionsConnected: boolean;
  readonly obstacleIntersectionPass: boolean;
  readonly obstacleIntersectionCellKeys: readonly string[];
  /**
   * A void result identifies an invalid coordinate, duplicate footprint cell,
   * or a required clearing cell that is absent from the locked footprint.
   */
  readonly voidIntersectionPass: boolean;
  readonly voidIntersectionCellKeys: readonly string[];
  readonly pass: boolean;
}

/**
 * Compare a mutable Stage 2 candidate with the immutable Stage 1 snapshot.
 * Exported for contract tests and authoring tools that evaluate a prospective
 * footprint before it can replace a shipped chapter map.
 */
export function compareStage2ToStage1(
  stage1: ReturnType<typeof getCanonicalStage1Blueprint>,
  layout: HexLaneLayout,
  scenery: SceneryLayout,
): Pick<CanonicalStage2Validation, 'stage1FootprintMatch' | 'stage1StructureMatch'> {
  const liveSnapshot = createLiveStage1CandidateSnapshot(layout, scenery);
  return {
    stage1FootprintMatch: stage1.blueprintHash === liveSnapshot.blueprintHash,
    stage1StructureMatch: stage1.structureHash === liveSnapshot.structureHash,
  };
}

/**
 * Complete canonical map artifact for one chapter.
 *
 * Returned by getCanonicalChapterMapArtifact().  Cached per chapter for
 * the lifetime of the process — do NOT mutate any nested object.
 */
export interface CanonicalChapterMapArtifact {
  readonly chapterId: number;

  // ── Full pipeline intermediates (diagnostics / advanced callers) ─────────
  readonly dna:            ChapterMapDNA;
  readonly pathwayGraph:   PathwayGraph;
  readonly hexLayout:      HexLaneLayout;
  readonly sceneryLayout:  SceneryLayout;
  readonly backgroundSpec: ChapterBackgroundSpec;
  readonly fingerprint:    FullStructuralFingerprint;

  // ── Derived geometry ─────────────────────────────────────────────────────
  /** All walkable tile coordinates (= hexLayout.cells). */
  readonly walkableCells:  AxialCoord[];
  readonly startCell:      AxialCoord;
  readonly gateCell:       AxialCoord;
  readonly tileCount:      number;
  readonly clearingCount:  number;
  readonly loopCount:      number;

  /** Per-tile zone classification. tileKey → HexTileZoneMeta. */
  readonly zoneMeta:       Map<string, HexTileZoneMeta>;

  // ── Validation / diagnostics ─────────────────────────────────────────────
  /** Short hex hash of the geometry (8 chars). Changes with layout version. */
  readonly blueprintHash:     string;
  /** Canonical layout version baked into blueprintHash. */
  readonly mapLayoutVersion:  string;
  /** Stage 1 authored structure identity and non-rendering Pack A/B references. */
  readonly stage1Blueprint:   ReturnType<typeof getCanonicalStage1Blueprint>;
  /** Stage 2 locked-footprint validation evidence. */
  readonly stage2Validation:  CanonicalStage2Validation;
  /**
   * True when the scenery safety invariant passes (walkable ∩ scenery = ∅).
   * Always expected to be true — log a warning and inspect if false.
   */
  readonly scenerySafetyPass: boolean;

  /**
   * HexTopology-compatible shape ready for buildInitialJourneyRun.
   * Includes zoneMeta so zone classification is preserved in JourneyTile.
   */
  readonly asTopology: ArtifactTopology;

  /**
   * Background authoring manifests for all three shifts (day / evening / night).
   *
   * Each manifest records:
   *   • Blueprint hash + version (for stale-detection)
   *   • Logical spatial data (walkable bounds, clearing positions, scenery zones)
   *   • Per-shift asset status ('pending' | 'generated' | 'approved')
   *   • AI prompt and asset paths from the BackgroundSpec pipeline
   *
   * Used by DevDiagnostics and authoring tools to verify that background
   * raster art is aligned with the current blueprint geometry.
   */
  readonly backgroundManifests: readonly BackgroundAuthoringManifest[];
}

// ── Cache ────────────────────────────────────────────────────────────────────

const artifactCache = new Map<number, CanonicalChapterMapArtifact>();

// ── Builder ──────────────────────────────────────────────────────────────────

/**
 * The production Stage 2 evaluator. Authoring tools and contract tests use this
 * exact function so a prospective layout is judged against the same immutable
 * Stage 1 source that artifact construction uses.
 */
export function validateStage2Candidate(
  chapter: number,
  hexLayout: HexLaneLayout,
  sceneryLayout: SceneryLayout,
): CanonicalStage2Validation {
  const stage1Blueprint = getCanonicalStage1Blueprint(
    chapter,
    getCanonicalStage1Snapshot(chapter),
  );
  const startKey = stage1Blueprint.startKey;
  const gateKey = stage1Blueprint.gateKey;
  const adj = buildAdjacency(hexLayout.cells);
  const graphDistances = bfsDistances(adj, startKey);
  const scenerySafetyPass = checkScenerySafety(sceneryLayout);
  const walkableKeys = new Set(hexLayout.cells.map(c => cellKey(c.q, c.r)));
  const { stage1FootprintMatch, stage1StructureMatch } =
    compareStage2ToStage1(stage1Blueprint, hexLayout, sceneryLayout);
  const duplicateOrInvalidKeys = hexLayout.cells
    .filter(c => !Number.isInteger(c.q) || !Number.isInteger(c.r))
    .map(c => cellKey(c.q, c.r));
  for (const key of walkableKeys) {
    const occurrences = hexLayout.cells.filter(c => cellKey(c.q, c.r) === key).length;
    if (occurrences > 1) duplicateOrInvalidKeys.push(key);
  }
  const requiredRegionMissingKeys = stage1Blueprint.requiredRegionCellKeys
    .filter(key => !walkableKeys.has(key));
  const voidIntersectionCellKeys = [...new Set([
    ...duplicateOrInvalidKeys,
    ...requiredRegionMissingKeys,
  ])];
  const obstacleIntersectionCellKeys = sceneryLayout.sceneryZones
    .flatMap(zone => zone.cells)
    .map(c => cellKey(c.q, c.r))
    .filter(key => sceneryLayout.walkableSafetyMaskKeys.includes(key));
  const startPresent = walkableKeys.has(startKey);
  const gatePresent = walkableKeys.has(gateKey);
  const startToGateConnected = graphDistances.has(gateKey);
  const requiredRegionsConnected = stage1Blueprint.requiredRegionCellKeys.every(key =>
    graphDistances.has(key),
  );
  const footprintLocked =
    hexLayout.actualTileCount === getChapterTerrainCellCount(chapter) &&
    hexLayout.cells.length === hexLayout.actualTileCount &&
    stage1FootprintMatch;
  const pass =
    footprintLocked &&
    stage1StructureMatch &&
    graphDistances.size === hexLayout.cells.length &&
    startPresent &&
    gatePresent &&
    startToGateConnected &&
    requiredRegionsConnected &&
    scenerySafetyPass &&
    voidIntersectionCellKeys.length === 0;

  return {
    status: pass ? 'VALIDATED' : 'INVALID',
    validationArtifactPath:
      `journey-map://canonical/ch${chapter}/stage-2/${stage1Blueprint.structureHash}.json`,
    expectedTileCount: getChapterTerrainCellCount(chapter),
    actualTileCount: hexLayout.actualTileCount,
    footprintLocked,
    stage1FootprintMatch,
    stage1StructureMatch,
    connectedTileCount: graphDistances.size,
    startPresent,
    gatePresent,
    startToGateConnected,
    requiredRegionsConnected,
    obstacleIntersectionPass: scenerySafetyPass,
    obstacleIntersectionCellKeys: [...new Set(obstacleIntersectionCellKeys)],
    voidIntersectionPass: voidIntersectionCellKeys.length === 0,
    voidIntersectionCellKeys,
    pass,
  };
}

function buildArtifact(chapter: number): CanonicalChapterMapArtifact {
  const dna           = getChapterMapDNA(chapter);
  const pathwayGraph  = getChapterPathwayGraph(chapter);
  const hexLayout     = getChapterHexLayout(chapter);
  const sceneryLayout = getChapterSceneryLayout(chapter);
  const backgroundSpec = getChapterBackgroundSpec(chapter);
  const fingerprint   = computeFullFingerprint(chapter);

  // Stage 1 is materialized once as an immutable authoring snapshot. Stage 2
  // validates the live layout against that snapshot rather than merely
  // re-asserting facts derived from the same mutable object.
  const stage1Snapshot = getCanonicalStage1Snapshot(chapter);
  const stage1Blueprint = getCanonicalStage1Blueprint(chapter, stage1Snapshot);
  const startKey = stage1Blueprint.startKey;
  const gateKey = stage1Blueprint.gateKey;

  const adj          = buildAdjacency(hexLayout.cells);
  const graphDistances = bfsDistances(adj, startKey);

  const zoneMeta         = buildZoneMeta(hexLayout);
  const blueprintHash    = stage1Snapshot.blueprintHash;
  const stage2Validation = validateStage2Candidate(chapter, hexLayout, sceneryLayout);
  const scenerySafetyPass = stage2Validation.obstacleIntersectionPass;

  if (!scenerySafetyPass) {
    console.warn(
      `[canonicalMapArtifact] ch${chapter}: SCENERY SAFETY FAIL — ` +
      'one or more scenery zone cells overlap the walkable safety mask.',
    );
  }

  const asTopology: ArtifactTopology = {
    chapter,
    seed:          dna.seed,
    tiles:         hexLayout.cells,
    startTileId:   startKey,
    gateAnchorId:  gateKey,
    graphDistances,
    zoneMeta,
  };

  const backgroundManifests = getBackgroundAuthoringManifests(chapter);

  return {
    chapterId:      chapter,
    dna,
    pathwayGraph,
    hexLayout,
    sceneryLayout,
    backgroundSpec,
    fingerprint,
    walkableCells:  hexLayout.cells,
    startCell:      hexLayout.startCell,
    gateCell:       hexLayout.gateCell,
    tileCount:      hexLayout.actualTileCount,
    clearingCount:  hexLayout.clearingZones.length,
    loopCount:      pathwayGraph.loopCount,
    zoneMeta,
    blueprintHash,
    mapLayoutVersion: getChapterMapLayoutVersion(chapter),
    stage1Blueprint,
    stage2Validation,
    scenerySafetyPass,
    asTopology,
    backgroundManifests,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the complete canonical map artifact for a chapter.
 *
 * Computed once and cached for the lifetime of the process.  All pipeline
 * intermediates (DNA, PathwayGraph, HexLayout, SceneryLayout, BackgroundSpec,
 * FullStructuralFingerprint) are accessible on the returned object.
 *
 * The physical tile footprint is determined solely by the chapter's DNA seed,
 * which is independent of playerId, attemptNumber, and shift.  All attempts
 * and all players on the same chapter get the same walkable layout.
 *
 * @throws if any pipeline stage fails — e.g. the pathway graph generator
 *   exhausted all retries (MAX_GRAPH_RETRIES attempts).  This is an authoring
 *   error and must be fixed in the chapter DNA, not silently swallowed.
 */
export function getCanonicalChapterMapArtifact(
  chapter: number,
): CanonicalChapterMapArtifact {
  const cached = artifactCache.get(chapter);
  if (cached) return cached;

  const artifact = buildArtifact(chapter);
  artifactCache.set(chapter, artifact);
  return artifact;
}
