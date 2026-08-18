/**
 * journeyMap/sceneryClassification.ts — Task 766: blocking vs non-blocking scenery
 *
 * Classifies every SceneryZoneType into BLOCKING (produces a physical obstacle
 * that can never overlap the walkable safety mask) or NON-BLOCKING (small
 * floor-level decoration that never obstructs traversal).
 *
 * This classification is the single source of truth consumed by:
 *   • backgroundValidator.ts       — geometry-level composition validation
 *   • walkableBedGenerator.ts      — FORBIDDEN ZONE / SCENERY ZONE prompt text
 *   • fog-map.tsx footprint overlay — RED cells = blocking scenery zones
 *
 * Leaf module: imports ONLY from chapterMapTemplate.types.  Safe to import
 * from any pipeline module without creating a circular dependency.
 */

import type { SceneryZoneType } from './chapterMapTemplate.types';

/**
 * Scenery types that produce physical obstacles (furniture, equipment,
 * structures, large set pieces).  Their zone cells MUST stay strictly outside
 * the walkable safety mask — a blocking cell inside the walkable bed is an
 * illegal overlap that fails background validation.
 *
 * Note: ARCHITECTURE is not in the original 7-type task list but is a physical
 * building mass placed by ZONE_POOLS — it is classified blocking for the same
 * reason as BUILDING_WING.
 */
export const BLOCKING_SCENERY_TYPES: ReadonlySet<SceneryZoneType> = new Set<SceneryZoneType>([
  'SIMULATION_STRUCTURE',
  'GARDEN',              // large planted mass — not traversable
  'COLUMN_GROUP',
  'BUILDING_WING',
  'OBSERVATION_DECK',
  'WATER_FEATURE',
  'ACADEMIC_STATUE',
  'ARCHITECTURE',        // physical building mass (see note above)
]);

/**
 * Scenery types that are small, floor-level, and decorative.  They may sit
 * near the walkable bed without blocking traversal (they still never appear
 * inside it — the safety mask keeps all scenery cells out of the bed).
 */
export const NON_BLOCKING_SCENERY_TYPES: ReadonlySet<SceneryZoneType> = new Set<SceneryZoneType>([
  'PLANTER',              // small decorative planter
  'DECORATIVE_LANDMARK',  // floor-level landmark (inlay / mosaic scale)
]);

/**
 * Returns true when the given scenery zone type produces a physical obstacle
 * that cannot overlap the walkable safety mask.
 */
export function isBlockingSceneryZone(type: SceneryZoneType): boolean {
  return BLOCKING_SCENERY_TYPES.has(type);
}

/** Human-readable lowercase label for a scenery type ('SIMULATION_STRUCTURE' → 'simulation structure'). */
export function sceneryTypeLabel(type: SceneryZoneType): string {
  return type.toLowerCase().replace(/_/g, ' ');
}
