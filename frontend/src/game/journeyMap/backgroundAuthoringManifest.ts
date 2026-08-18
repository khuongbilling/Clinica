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
 * ── Asset Status Lifecycle ────────────────────────────────────────────────────
 *   'pending'   — no usable raster asset exists; generation required.
 *                 DevDiagnostics shows ⚠.
 *   'generated' — raster was produced from the blueprint spec (or aligned to
 *                 the same geometry specification before the pipeline existed).
 *                 DevDiagnostics shows ✓.
 *   'approved'  — artist-reviewed; confirmed visually correct.
 *                 DevDiagnostics shows ✓✓.
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
import { MAP_LAYOUT_VERSION }      from './journeyMapVersion';    // leaf import — no cycle
import { fnv1a32 }                 from './prng';
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

/** Asset lifecycle status for one shift's raster background. */
export type ManifestAssetStatus = 'pending' | 'generated' | 'approved';

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
 *     '{mapLayoutVersion}:{blueprintHash}' (generated).
 */
export interface BackgroundAuthoringManifest {
  // Identity
  readonly chapterId:        number;
  readonly shift:            TimeOfDay;
  readonly mapBlueprintHash: string;
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
   * Lifecycle status.
   * 'pending'   → no raster exists; ⚠ in DevDiagnostics.
   * 'generated' → raster was produced from (or aligned to) this blueprint spec.
   * 'approved'  → artist-reviewed.
   */
  readonly assetStatus:      ManifestAssetStatus;
  /**
   * Blueprint version string when the asset was generated.
   *
   *   'BACKGROUND_ASSET_REQUIRED' — status is 'pending'
   *   '{mapLayoutVersion}:{hash}'  — status is 'generated' or 'approved'
   *
   * DevDiagnostics compares this to the live artifact's version+hash to
   * detect whether the background is stale (geometry changed since generation).
   */
  readonly assetVersion:     string;
}

// ── Asset registry ────────────────────────────────────────────────────────────
//
// Manual declaration: which chapter+shift combos have approved raster assets.
//
// RULES FOR UPDATING:
//   1. Set assetStatus to 'generated' only after the raster file exists at the
//      targetAssetPath and is registered in chapterMapVisuals.ts.
//   2. Set assetStatus to 'approved' only after an artist has reviewed the image
//      and confirmed it aligns with the walkable layout.
//   3. Day/Evening/Night variants must all be registered before the chapter is
//      considered fully synced.
//
// Ch1 — Production Bridge Push 4:
//   day     — created in Push 9 from academic_quad specification;
//              aligned with the same geometry that the pipeline produces.
//   evening — created in Push 10; same geometry spec as day.
//   night   — generated in Push 4 from the full pipeline spec + spatial brief.

const ASSET_REGISTRY: Partial<Record<number, Record<TimeOfDay, ManifestAssetStatus>>> = {
  1: {
    day:     'generated',   // Push 6: bed-aware re-generation (blueprint-first)
    evening: 'generated',   // Push 6: bed-aware generation (new asset)
    night:   'generated',   // Push 6: bed-aware generation (new asset)
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

// ── Blueprint hash (mirrors canonicalMapArtifact.ts logic) ───────────────────

function computeBlueprintHash(layout: HexLaneLayout): string {
  const sortedKeys = layout.cells
    .map(c => `${c.q},${c.r}`)
    .sort()
    .join('|');
  const raw = fnv1a32(`${layout.seed}:${MAP_LAYOUT_VERSION}:${sortedKeys}`);
  return raw.toString(16).padStart(8, '0');
}

// ── Builder ───────────────────────────────────────────────────────────────────

function buildManifest(
  chapter:       number,
  shift:         TimeOfDay,
  layout:        HexLaneLayout,
  scenery:       SceneryLayout,
  bgSpec:        ChapterBackgroundSpec,
  blueprintHash: string,
  bed:           WalkableBed,
): BackgroundAuthoringManifest {
  const registry = ASSET_REGISTRY[chapter];
  const assetStatus: ManifestAssetStatus = registry?.[shift] ?? 'pending';
  const assetVersion = assetStatus === 'pending'
    ? 'BACKGROUND_ASSET_REQUIRED'
    : `${MAP_LAYOUT_VERSION}:${blueprintHash}`;

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
    mapBlueprintHash: blueprintHash,
    mapLayoutVersion: MAP_LAYOUT_VERSION,
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
  const hash     = computeBlueprintHash(layout);

  const SHIFTS: TimeOfDay[] = ['day', 'evening', 'night'];
  const manifests = SHIFTS.map(shift =>
    buildManifest(chapter, shift, layout, scenery, bgSpec, hash, bed),
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
 * 'generated' or 'approved', and their assetVersion matches the current
 * blueprint hash.  Used by DevDiagnostics to show the full-sync indicator.
 */
export function isChapterBackgroundSynced(chapter: number): boolean {
  const layout    = getChapterHexLayout(chapter);
  const hash      = computeBlueprintHash(layout);
  const currentVer = `${MAP_LAYOUT_VERSION}:${hash}`;
  return getBackgroundAuthoringManifests(chapter).every(
    m => m.assetStatus !== 'pending' && m.assetVersion === currentVer,
  );
}
