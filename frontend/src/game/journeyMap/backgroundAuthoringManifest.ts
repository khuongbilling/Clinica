/**
 * journeyMap/backgroundAuthoringManifest.ts — Production Bridge Push 4
 *
 * Versioned background authoring manifest: bridges blueprint geometry data
 * to the raster art assets that are registered in chapterMapVisuals.ts.
 *
 * ── Purpose ──────────────────────────────────────────────────────────────────
 *   1. Records WHICH blueprint hash/version a background was generated from.
 *   2. Stores spatial zone data (clearings, scenery, walkable bounds) as
 *      logical hex coordinates — not pixels — so authoring tools can
 *      ground-truth-check an image against the layout.
 *   3. Provides per-shift asset status so DevDiagnostics can show
 *      "BACKGROUND SYNCED TO BLUEPRINT" vs "PENDING".
 *
 * ── Asset Status Lifecycle (Task 766) ────────────────────────────────────────
 *   'pending'            — no usable raster asset exists; generation required.
 *                          DevDiagnostics shows ⚠.
 *   'spec_ready'         — prompt/spec finalized, raster not yet generated.
 *   'raster_unvalidated' — raster exists but has not passed the background
 *                          composition validator.
 *   'validated'          — raster exists AND validateBackgroundComposition
 *                          passed (no blocking scenery inside the walkable bed).
 *                          DevDiagnostics shows the BACKGROUND VALIDATED badge.
 *   'invalid_overlap'    — validator found blocking scenery overlapping the
 *                          walkable bed; raster must be regenerated.
 *   'failed'             — generation attempt failed; regeneration required.
 *
 * ── No Circular Imports ───────────────────────────────────────────────────────
 *   This module imports from the same pipeline modules as canonicalMapArtifact
 *   (DNA, HexLayout, SceneryLayout, BackgroundSpec) but NOT from
 *   canonicalMapArtifact itself.  canonicalMapArtifact imports this module.
 *
 * COMMIT TAG: feat(journey): background authoring manifest bridges blueprint to raster art
 */

import { getChapterMapDNA }        from './chapterMapDNA';
import { getChapterHexLayout }     from './chapterHexLayout';
import { getChapterSceneryLayout } from './chapterSceneryLayout';
import { getChapterBackgroundSpec } from './chapterBackgroundSpec';
import { getWalkableBed }          from './walkableBedGenerator';
import { validateBackgroundComposition } from './backgroundValidator';
import type { BackgroundValidationResult } from './backgroundValidator';
import { getChapterMapLayoutVersion } from './journeyMapVersion'; // leaf import — no cycle
import { getCanonicalStage1Snapshot } from './canonicalStageIdentity';
import type { CanonicalStage1Snapshot } from './canonicalStageIdentity';
import type { CanonicalStageStatus } from './canonicalStageContract';
import type { TimeOfDay }          from './types';
import type { WalkableBed }        from './chapterMapTemplate.types';
import type {
  HexLaneLayout,
  SceneryLayout,
  ChapterBackgroundSpec,
  ClearingType,
  SceneryZoneType,
} from './chapterMapTemplate.types';

// ── Public types ─────────────────────────────────────────────────────────────

/**
 * Asset lifecycle status for one shift's raster background (Task 766).
 * See the lifecycle table in the module header for meanings.
 */
export type ManifestAssetStatus =
  | 'pending'
  | 'spec_ready'
  | 'raster_unvalidated'
  | 'validated'
  | 'invalid_overlap'
  | 'failed';

/** Axial bounding box of all walkable tiles, plus total tile count. */
export interface WalkableBounds {
  readonly minQ: number;
  readonly maxQ: number;
  readonly minR: number;
  readonly maxR: number;
  readonly totalTiles: number;
}

/**
 * Summary of one encounter clearing zone — expressed in axial hex coordinates
 * so authoring tools can verify that the painted clearing space is open.
 */
export interface ManifestClearingZone {
  readonly id:        string;
  readonly type:      ClearingType;
  readonly centroidQ: number;
  readonly centroidR: number;
  readonly cellCount: number;
  readonly exitCount: number;
}

/**
 * Summary of one scenery (negative-space) zone — expressed in axial hex
 * coordinates so authoring tools can verify that scenery stays outside
 * the walkable safety mask.
 */
export interface ManifestSceneryZone {
  readonly id:        string;
  readonly type:      SceneryZoneType;
  readonly centroidQ: number;
  readonly centroidR: number;
  readonly cellCount: number;
}

/**
 * Complete background authoring manifest for one chapter shift.
 *
 * Immutable after construction.  Returned by getBackgroundAuthoringManifests().
 *
 * Key design rules:
 *   • clearingZones / sceneryZones / walkableBounds use axial hex coordinates,
 *     NOT pixel addresses.  The renderer is responsible for the hex→pixel
 *     transform; the manifest deals only in logical layout space.
 *   • rasterAsset is a path relative to `frontend/` (not the Metro alias).
 *   • metroRequirePath uses the `@/` alias — must match what
 *     chapterMapVisuals.ts passes to require().
 *   • assetVersion is either 'BACKGROUND_ASSET_REQUIRED' (pending) or
 *     '{mapLayoutVersion}:{blueprintHash}:{structureHash}' (generated).
 */
export interface BackgroundAuthoringManifest {
  // Identity
  readonly chapterId:        number;
  readonly shift:            TimeOfDay;
  readonly mapBlueprintHash: string;
  /** Obstacle-aware Stage 1 identity required for exact Stage 3 approval. */
  readonly mapStructureHash: string;
  readonly mapLayoutVersion: string;
  readonly topologyFamily:   string;

  // World geometry (logical hex coordinate space — NOT pixels)
  /** Aspect ratio classification derived from the hex bounding box. */
  readonly worldAspectRatio: 'wide' | 'portrait' | 'balanced';
  /** Target pixel dimensions for the generated raster (all chapters: 1024×1024). */
  readonly targetDimensions: { readonly width: number; readonly height: number };
  /** Axial bounding box and tile count of the walkable footprint. */
  readonly walkableBounds:   WalkableBounds;
  /**
   * Clearing zone summaries — positions and footprints of named encounter
   * clearings.  Walkable: clearings MUST render as open floor space.
   */
  readonly clearingZones:    readonly ManifestClearingZone[];
  /**
   * Scenery zone summaries — positions of non-walkable environmental zones.
   * Scenery MUST NOT overlap the walkable safety mask (walkable + 1-tile ring).
   */
  readonly sceneryZones:     readonly ManifestSceneryZone[];

  /**
   * Push 6: Walkable Bed — the authoritative floor-geometry specification
   * derived from the canonical HexLaneLayout blueprint.
   *
   * Contains the bedPromptFragment that was injected into aiPrompt, plus the
   * full zone/adjacency data for diagnostic and tooling use.
   *
   * All three shift manifests for a chapter share the SAME walkableBed
   * (geometry is shift-invariant; only lighting changes between day/evening/night).
   */
  readonly walkableBed:      WalkableBed;

  // Art specification
  readonly aiPrompt:         string;
  readonly negativePrompt:   string;

  // Asset tracking
  /**
   * Filesystem path relative to `frontend/`.
   * E.g. `assets/ui/journey/map/map-platform-background-ch1-night.png`
   */
  readonly rasterAsset:      string;
  /**
   * Metro `require()` alias string — must match the literal string used
   * in chapterMapVisuals.ts.
   * E.g. `@/assets/ui/journey/map/map-platform-background-ch1-night.png`
   */
  readonly metroRequirePath: string;
  /**
   * Lifecycle status (Task 766).
   * 'pending' / 'spec_ready' / 'failed' → no usable raster; ⚠ in DevDiagnostics.
   * 'raster_unvalidated'                → raster exists, validator not passed.
   * 'validated'                         → raster exists AND composition check passed.
   * 'invalid_overlap'                   → validator found blocking scenery in the bed.
   */
  readonly assetStatus:      ManifestAssetStatus;
  /**
   * Blueprint version string when the asset was generated.
   *
   *   'BACKGROUND_ASSET_REQUIRED' — no usable raster ('pending' / 'spec_ready' / 'failed')
 *   '{mapLayoutVersion}:{blueprintHash}:{structureHash}' — a raster exists
 *   for this complete Stage 1 blueprint
   *
   * DevDiagnostics compares this to the live artifact's version+hash to
   * detect whether the background is stale (geometry changed since generation).
   */
  readonly assetVersion:     string;
  /**
   * Explicit Stage 3 approval state. This records authoring readiness only;
   * runtime still requires the exact hash registration in stage3AssetSelector.
   */
  readonly stage3Status: CanonicalStageStatus;

  /**
   * Task 766: result of validateBackgroundComposition for this chapter's
   * scenery layout vs walkable bed.  Shared by all three shift manifests
   * (geometry is shift-invariant).  Drives the 'validated' / 'invalid_overlap'
   * status promotion and the DevDiagnostics BACKGROUND VALIDATED badge.
   */
  readonly validationResult: BackgroundValidationResult;
}

// ── Asset registry ────────────────────────────────────────────────────────────
//
// Manual declaration: which chapter+shift combos have approved raster assets.
//
// RULES FOR UPDATING (Task 766):
//   1. Set assetStatus to 'raster_unvalidated' only after the raster file
//      exists and is registered in chapterMapVisuals.ts — buildManifest will
//      promote it to 'validated' (or demote to 'invalid_overlap') by running
//      validateBackgroundComposition at manifest build time.
//   2. 'validated' may also be declared directly once a raster generated from
//      the hardened composition-discipline prompts has passed the validator
//      AND been visually confirmed obstacle-safe.
//   3. Day/Evening/Night variants must all be 'validated' before the chapter
//      is considered fully synced.
//
// Ch1 — v2 open-courtyard rasters share one five-court composition across every
// shift. Their clear paving is reviewed against the authored walkable bed; the
// geometry validator continues to enforce scenery-zone safety.

const ASSET_REGISTRY: Partial<Record<number, Record<TimeOfDay, ManifestAssetStatus>>> = {
  1: {
    day:     'validated',
    evening: 'validated',
    night:   'validated',
  },
};

// ── Coordinate helpers ────────────────────────────────────────────────────────

function computeWalkableBounds(cells: readonly { q: number; r: number }[]): WalkableBounds {
  if (cells.length === 0) return { minQ: 0, maxQ: 0, minR: 0, maxR: 0, totalTiles: 0 };
  let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  for (const c of cells) {
    if (c.q < minQ) minQ = c.q;
    if (c.q > maxQ) maxQ = c.q;
    if (c.r < minR) minR = c.r;
    if (c.r > maxR) maxR = c.r;
  }
  return { minQ, maxQ, minR, maxR, totalTiles: cells.length };
}

function computeAspectRatio(
  bounds: WalkableBounds,
): 'wide' | 'portrait' | 'balanced' {
  const qSpan = bounds.maxQ - bounds.minQ + 1;
  const rSpan = bounds.maxR - bounds.minR + 1;
  // Hex grid: each q step ≈ √3/2 hex widths, each r step ≈ 1 hex height.
  // Compute approximate pixel ratio using flat-top hex geometry factors.
  const approxPixelRatio = (qSpan * 0.866) / (rSpan * 1.0);
  if (approxPixelRatio > 1.25) return 'wide';
  if (approxPixelRatio < 0.75) return 'portrait';
  return 'balanced';
}

// ── Builder ───────────────────────────────────────────────────────────────────

function buildManifest(
  chapter:       number,
  shift:         TimeOfDay,
  layout:        HexLaneLayout,
  scenery:       SceneryLayout,
  bgSpec:        ChapterBackgroundSpec,
  stage1:        CanonicalStage1Snapshot,
  bed:           WalkableBed,
  validation:    BackgroundValidationResult,
): BackgroundAuthoringManifest {
  const layoutVersion = getChapterMapLayoutVersion(chapter);
  const registry = ASSET_REGISTRY[chapter];
  const declaredStatus: ManifestAssetStatus = registry?.[shift] ?? 'pending';

  // Task 766: statuses that assert "a raster exists" are re-derived from the
  // geometry validator at build time — promote to 'validated' on pass, demote
  // to 'invalid_overlap' on fail.  Non-raster statuses pass through unchanged.
  const hasRaster =
    declaredStatus === 'raster_unvalidated' ||
    declaredStatus === 'validated' ||
    declaredStatus === 'invalid_overlap';
  const assetStatus: ManifestAssetStatus = hasRaster
    ? (validation.pass ? 'validated' : 'invalid_overlap')
    : declaredStatus;

  const assetVersion = hasRaster
    ? `${layoutVersion}:${stage1.blueprintHash}:${stage1.structureHash}`
    : 'BACKGROUND_ASSET_REQUIRED';
  const stage3Status: CanonicalStageStatus =
    assetStatus === 'validated' ? 'APPROVED'
      : assetStatus === 'invalid_overlap' || assetStatus === 'failed' ? 'REJECTED'
      : declaredStatus === 'raster_unvalidated' ? 'PENDING_APPROVAL'
      : 'PENDING_UPLOAD';

  const walkableBounds  = computeWalkableBounds(layout.cells);
  const worldAspectRatio = computeAspectRatio(walkableBounds);

  const clearingZones: ManifestClearingZone[] = layout.clearingZones.map(cz => ({
    id:        cz.id,
    type:      cz.type,
    centroidQ: cz.center.q,
    centroidR: cz.center.r,
    cellCount: cz.cells.length,
    exitCount: cz.exitCount,
  }));

  const sceneryZones: ManifestSceneryZone[] = scenery.sceneryZones.map(sz => ({
    id:        sz.id,
    type:      sz.type,
    centroidQ: sz.centroid.q,
    centroidR: sz.centroid.r,
    cellCount: sz.area,
  }));

  const shiftSpec = bgSpec.shifts[shift];

  return {
    chapterId:        chapter,
    shift,
    mapBlueprintHash: stage1.blueprintHash,
    mapStructureHash: stage1.structureHash,
    mapLayoutVersion: layoutVersion,
    topologyFamily:   layout.seed.includes(':')
      ? layout.seed.split(':')[1] ?? bgSpec.environmentName
      : bgSpec.environmentType,
    worldAspectRatio,
    targetDimensions: shiftSpec.targetDimensions,
    walkableBounds,
    clearingZones,
    sceneryZones,
    walkableBed:      bed,
    aiPrompt:         shiftSpec.aiPrompt,
    negativePrompt:   shiftSpec.negativePrompt,
    rasterAsset:      shiftSpec.targetAssetPath,
    metroRequirePath: shiftSpec.metroRequirePath,
    assetStatus,
    assetVersion,
    stage3Status,
    validationResult: validation,
  };
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const manifestCache = new Map<number, BackgroundAuthoringManifest[]>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the background authoring manifests for all three shifts of a chapter.
 *
 * Order: [day, evening, night] — matches TimeOfDay declaration order.
 *
 * Each manifest contains:
 *   • Blueprint identity (hash + version) for stale-detection.
 *   • Logical spatial data (walkable bounds, clearing positions, scenery zones)
 *     in axial hex coordinates — not pixels.
 *   • Asset status and version so DevDiagnostics can report sync state.
 *   • Full AI prompt and asset paths from the BackgroundSpec pipeline.
 *
 * The manifests are computed once and cached for the process lifetime.
 * Called by canonicalMapArtifact.ts and DevDiagnostics.
 */
export function getBackgroundAuthoringManifests(
  chapter: number,
): BackgroundAuthoringManifest[] {
  const cached = manifestCache.get(chapter);
  if (cached) return cached;

  const layout   = getChapterHexLayout(chapter);
  const scenery  = getChapterSceneryLayout(chapter);
  const bgSpec   = getChapterBackgroundSpec(chapter);
  const bed      = getWalkableBed(chapter);   // Push 6: blueprint-first bed
  const stage1   = getCanonicalStage1Snapshot(chapter);

  // Task 766: run the geometry-level composition validator once per chapter;
  // the result is cached alongside the manifests (all shifts share it).
  const validation = validateBackgroundComposition(chapter, scenery, bed);

  const SHIFTS: TimeOfDay[] = ['day', 'evening', 'night'];
  const manifests = SHIFTS.map(shift =>
    buildManifest(chapter, shift, layout, scenery, bgSpec, stage1, bed, validation),
  );

  manifestCache.set(chapter, manifests);
  return manifests;
}

/**
 * Returns the background authoring manifest for a specific chapter + shift.
 * Convenience accessor backed by the same cache as getBackgroundAuthoringManifests.
 */
export function getBackgroundAuthoringManifest(
  chapter: number,
  shift:   TimeOfDay,
): BackgroundAuthoringManifest {
  return getBackgroundAuthoringManifests(chapter).find(m => m.shift === shift)!;
}

/**
 * Returns true when all three shifts for a chapter have an asset status of
 * 'validated' (raster exists AND passed the composition validator), and their
 * assetVersion matches the current blueprint hash.  Used by DevDiagnostics to
 * show the full-sync indicator.
 */
export function isChapterBackgroundSynced(chapter: number): boolean {
  const layout    = getChapterHexLayout(chapter);
  const scenery   = getChapterSceneryLayout(chapter);
  const stage1    = getCanonicalStage1Snapshot(chapter);
  const currentVer =
    `${getChapterMapLayoutVersion(chapter)}:${stage1.blueprintHash}:${stage1.structureHash}`;
  return getBackgroundAuthoringManifests(chapter).every(
    m => m.assetStatus === 'validated' && m.assetVersion === currentVer,
  );
}
