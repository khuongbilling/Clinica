/**
 * Future-map obstacle presentation contract.
 *
 * Starting with Chapter 6, a blocking scenery zone is not eligible for a
 * finished Stage 3 environment unless it has BOTH:
 *   1. an explicit raster-art attestation, and
 *   2. a real, asset-backed 2.5D runtime prop.
 *
 * The fixed hex footprint is validated separately by Stage 2; it can never
 * include any blocking scenery cells.
 */

import { isBlockingSceneryZone } from './sceneryClassification';
import {
  SCENERY_PROP_DEFS,
  ZONE_TYPE_TO_PROPS,
  type SceneryPropType,
} from './sceneryPropTypes';
import type { SceneryLayout, SceneryZoneType } from './chapterMapTemplate.types';

/** Chapters 1–5 retain their approved migration-era visual contracts. */
export const DUAL_OBSTACLE_PRESENTATION_FROM_CHAPTER = 6;

export interface ObstaclePresentationContractResult {
  readonly required: boolean;
  readonly blockingZoneCount: number;
  /** Explicit authoring review that the registered raster depicts every blocker. */
  readonly rasterObstaclesAttested: boolean;
  /** Blocking zone types that do not yet have an asset-backed runtime prop. */
  readonly missingRuntimePropZoneTypes: readonly SceneryZoneType[];
  /** True only when a future map satisfies both raster and runtime requirements. */
  readonly pass: boolean;
}

export type RuntimePropAssetChecker = (propType: SceneryPropType) => boolean;
export type RuntimePropPlacementChecker = (
  zoneId: string,
  zoneType: SceneryZoneType,
  propType: SceneryPropType,
) => boolean;

/**
 * The first zone mapping is the guaranteed primary blocker. Secondary props
 * are decorative additions and must never satisfy the release contract alone.
 */
export function getRequiredRuntimePropType(
  zoneType: SceneryZoneType,
): SceneryPropType | undefined {
  return ZONE_TYPE_TO_PROPS[zoneType]?.[0];
}

const hasRealRuntimeAsset: RuntimePropAssetChecker = propType =>
  SCENERY_PROP_DEFS[propType].asset !== null;
const hasSafeRuntimePlacement: RuntimePropPlacementChecker = () => true;

/**
 * Evaluate whether a map is allowed to reveal a finished background. This is
 * intentionally data-level validation: image pixels are not a reliable source
 * of collision truth, so a reviewed raster attestation is required alongside
 * concrete runtime art.
 */
export function validateObstaclePresentationContract(
  chapter: number,
  scenery: SceneryLayout,
  rasterObstaclesAttested: boolean,
  hasRuntimeAsset: RuntimePropAssetChecker = hasRealRuntimeAsset,
  hasRuntimePlacement: RuntimePropPlacementChecker = hasSafeRuntimePlacement,
): ObstaclePresentationContractResult {
  const blockingZones = scenery.sceneryZones.filter(zone => isBlockingSceneryZone(zone.type));
  const missingRuntimePropZoneTypes = [...new Set(
    blockingZones
      .filter(zone => {
        const primaryProp = getRequiredRuntimePropType(zone.type);
        return primaryProp == null ||
          !hasRuntimeAsset(primaryProp) ||
          !hasRuntimePlacement(zone.id, zone.type, primaryProp);
      })
      .map(zone => zone.type),
  )];
  const required = chapter >= DUAL_OBSTACLE_PRESENTATION_FROM_CHAPTER;
  const noBlockingScenery = blockingZones.length === 0;

  return {
    required,
    blockingZoneCount: blockingZones.length,
    rasterObstaclesAttested: noBlockingScenery || rasterObstaclesAttested,
    missingRuntimePropZoneTypes,
    pass: !required || (
      (noBlockingScenery || rasterObstaclesAttested) &&
      missingRuntimePropZoneTypes.length === 0
    ),
  };
}