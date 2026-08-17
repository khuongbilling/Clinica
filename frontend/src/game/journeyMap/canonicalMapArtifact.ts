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
import { fnv1a32 }                                 from './prng';
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
export const MAP_LAYOUT_VERSION = 'v1';

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

// ── Blueprint hash ──────────────────────────────────────────────────────────

/**
 * Deterministic short hash identifying the physical layout.
 * Encodes: layout.seed + MAP_LAYOUT_VERSION + sorted tile keys.
 * Changes whenever the geometry changes; stable otherwise.
 * Used in DEV diagnostics and can detect stale cached runs.
 */
function computeBlueprintHash(layout: HexLaneLayout): string {
  const sortedKeys = layout.cells
    .map(c => cellKey(c.q, c.r))
    .sort()
    .join('|');
  const raw = fnv1a32(`${layout.seed}:${MAP_LAYOUT_VERSION}:${sortedKeys}`);
  return raw.toString(16).padStart(8, '0');
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

function buildArtifact(chapter: number): CanonicalChapterMapArtifact {
  const dna           = getChapterMapDNA(chapter);
  const pathwayGraph  = getChapterPathwayGraph(chapter);
  const hexLayout     = getChapterHexLayout(chapter);
  const sceneryLayout = getChapterSceneryLayout(chapter);
  const backgroundSpec = getChapterBackgroundSpec(chapter);
  const fingerprint   = computeFullFingerprint(chapter);

  const startKey = cellKey(hexLayout.startCell.q, hexLayout.startCell.r);
  const gateKey  = cellKey(hexLayout.gateCell.q,  hexLayout.gateCell.r);

  const adj          = buildAdjacency(hexLayout.cells);
  const graphDistances = bfsDistances(adj, startKey);

  const zoneMeta         = buildZoneMeta(hexLayout);
  const blueprintHash    = computeBlueprintHash(hexLayout);
  const scenerySafetyPass = checkScenerySafety(sceneryLayout);

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
    mapLayoutVersion: MAP_LAYOUT_VERSION,
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
