/**
 * journeyMap/backgroundValidator.ts — Task 766: geometry-level background validation
 *
 * Validates that NO blocking scenery zone occupies any cell of the walkable
 * bed.  This is the hard constraint behind obstacle-safe background
 * composition: blocking props (furniture, equipment, structures) may exist
 * ONLY in negative-space scenery zones, never inside the playable footprint.
 *
 * Scope: geometry / spec level only.  This validator checks the SceneryLayout
 * against the WalkableBed — it does NOT perform pixel-level analysis of the
 * generated raster (out of scope; see task 766).
 *
 * Consumers:
 *   • backgroundAuthoringManifest.ts — runs once per chapter, exposes
 *     `validationResult` on every BackgroundAuthoringManifest and promotes
 *     'raster_unvalidated' → 'validated' (or demotes to 'invalid_overlap').
 *   • DevDiagnostics (fog-map.tsx)   — "BACKGROUND VALIDATED" badge.
 *   • Footprint dev overlay          — MAGENTA outline on violation cells.
 *
 * No circular imports: imports only leaf modules (sceneryClassification,
 * chapterMapTemplate.types).
 */

import { isBlockingSceneryZone } from './sceneryClassification';
import type {
  SceneryLayout,
  SceneryZoneType,
  WalkableBed,
} from './chapterMapTemplate.types';

// ── Public types ─────────────────────────────────────────────────────────────

/** One blocking scenery zone that illegally overlaps the walkable bed. */
export interface BackgroundValidationViolation {
  /** SceneryZone.id of the offending zone. */
  readonly zoneId: string;
  /** SceneryZone.type — always a BLOCKING type (non-blocking zones never violate). */
  readonly zoneType: SceneryZoneType;
  /** "q,r" keys of the zone cells that fall inside bed.walkableCellKeys. */
  readonly overlappingCellKeys: readonly string[];
}

/** Result of validating one chapter's scenery layout against its walkable bed. */
export interface BackgroundValidationResult {
  readonly chapterId: number;
  /** True when zero blocking scenery cells overlap the walkable bed. */
  readonly pass: boolean;
  /** One entry per blocking zone with ≥ 1 overlapping cell.  Empty when pass. */
  readonly violations: readonly BackgroundValidationViolation[];
  /** Total scenery zones examined (blocking + non-blocking). */
  readonly checkedZoneCount: number;
  /** How many of the checked zones are blocking types. */
  readonly blockingZoneCount: number;
  /** Size of the walkable bed cell set the zones were checked against. */
  readonly walkableCellCount: number;
}

// ── Cache (referential stability) ─────────────────────────────────────────────
//
// Keyed on the exact (scenery, bed) object pair so repeated calls with the
// same inputs — including synthetic test fixtures — return the SAME result
// object.  WeakMaps let garbage collection reclaim synthetic fixtures.

const resultCache = new WeakMap<SceneryLayout, WeakMap<WalkableBed, BackgroundValidationResult>>();

// ── Validator ─────────────────────────────────────────────────────────────────

/**
 * Checks every BLOCKING SceneryZone cell against `bed.walkableCellKeys`.
 *
 * Returns `{ pass: true, violations: [] }` when no blocking zone touches the
 * walkable bed (the geometric guarantee the safety mask already provides for
 * pipeline-generated layouts), or `{ pass: false, violations: [...] }` naming
 * each offending zone and the exact overlapping "q,r" cell keys.
 *
 * Referentially stable: calling twice with the same (scenery, bed) objects
 * returns the same result object.
 */
export function validateBackgroundComposition(
  chapter: number,
  scenery: SceneryLayout,
  bed:     WalkableBed,
): BackgroundValidationResult {
  let inner = resultCache.get(scenery);
  if (inner) {
    const cached = inner.get(bed);
    if (cached) return cached;
  } else {
    inner = new WeakMap();
    resultCache.set(scenery, inner);
  }

  const walkable = new Set(bed.walkableCellKeys);

  const violations: BackgroundValidationViolation[] = [];
  let blockingZoneCount = 0;

  for (const zone of scenery.sceneryZones) {
    if (!isBlockingSceneryZone(zone.type)) continue;
    blockingZoneCount++;

    const overlapping: string[] = [];
    for (const cell of zone.cells) {
      const key = `${cell.q},${cell.r}`;
      if (walkable.has(key)) overlapping.push(key);
    }
    if (overlapping.length > 0) {
      violations.push({
        zoneId:              zone.id,
        zoneType:            zone.type,
        overlappingCellKeys: overlapping,
      });
    }
  }

  const result: BackgroundValidationResult = {
    chapterId:         chapter,
    pass:              violations.length === 0,
    violations,
    checkedZoneCount:  scenery.sceneryZones.length,
    blockingZoneCount,
    walkableCellCount: walkable.size,
  };

  inner.set(bed, result);
  return result;
}
