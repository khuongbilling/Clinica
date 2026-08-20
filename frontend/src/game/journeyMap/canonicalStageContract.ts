import type { CanonicalStage1Snapshot } from './canonicalStageIdentity';

/**
 * canonicalStageContract.ts
 *
 * Non-rendering authoring contract for the three canonical Journey-map stages.
 *
 * These paths deliberately have NO Metro require() calls. Pack A and Pack B are
 * supplied reference packs that have not been uploaded to this workspace yet;
 * registering their intended locations must never make an unrelated raster
 * eligible for runtime rendering.
 */

export type CanonicalStageStatus =
  | 'LOCKED'
  | 'VALIDATED'
  | 'PENDING_UPLOAD'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export type AuthoringReferenceRole =
  | 'blueprint_only'
  | 'blueprint_with_walkable_path'
  | 'finished_environment';

export interface AuthoringReferenceSlot {
  readonly id: string;
  readonly pack: 'Pack A' | 'Pack B';
  readonly role: AuthoringReferenceRole;
  readonly status: 'PENDING_UPLOAD';
  /**
   * Upload destination relative to frontend/. It is intentionally data only:
   * add a static Metro require only after the binary has been reviewed and
   * approved for a specific Stage 3 registration.
   */
  readonly uploadPath: string;
  readonly description: string;
}

/**
 * Pack A documents the Chapter 1 relationship that all future backgrounds must
 * preserve. Pack B is a reusable authoring template, not a renderable asset.
 */
export const JOURNEY_MAP_AUTHORING_REFERENCE_SLOTS: readonly AuthoringReferenceSlot[] = [
  {
    id: 'pack-a-ch1-blueprint-only',
    pack: 'Pack A',
    role: 'blueprint_only',
    status: 'PENDING_UPLOAD',
    uploadPath: 'assets/ui/journey/map/authoring/pack-a/ch1-blueprint-only.png',
    description: 'Chapter 1 architectural and obstacle blueprint only.',
  },
  {
    id: 'pack-a-ch1-blueprint-walkable-path',
    pack: 'Pack A',
    role: 'blueprint_with_walkable_path',
    status: 'PENDING_UPLOAD',
    uploadPath: 'assets/ui/journey/map/authoring/pack-a/ch1-blueprint-walkable-path.png',
    description: 'Chapter 1 blueprint with the locked walkable hex footprint.',
  },
  {
    id: 'pack-a-ch1-finished-environment',
    pack: 'Pack A',
    role: 'finished_environment',
    status: 'PENDING_UPLOAD',
    uploadPath: 'assets/ui/journey/map/authoring/pack-a/ch1-finished-environment.png',
    description: 'Chapter 1 finished environment reference aligned to Pack A geometry.',
  },
  {
    id: 'pack-b-template-blueprint-only',
    pack: 'Pack B',
    role: 'blueprint_only',
    status: 'PENDING_UPLOAD',
    uploadPath: 'assets/ui/journey/map/authoring/pack-b/template-blueprint-only.png',
    description: 'Reusable later-chapter architecture and obstacle blueprint template.',
  },
  {
    id: 'pack-b-template-blueprint-walkable-path',
    pack: 'Pack B',
    role: 'blueprint_with_walkable_path',
    status: 'PENDING_UPLOAD',
    uploadPath: 'assets/ui/journey/map/authoring/pack-b/template-blueprint-walkable-path.png',
    description: 'Reusable later-chapter blueprint-plus-walkable-path template.',
  },
  {
    id: 'pack-b-template-finished-environment',
    pack: 'Pack B',
    role: 'finished_environment',
    status: 'PENDING_UPLOAD',
    uploadPath: 'assets/ui/journey/map/authoring/pack-b/template-finished-environment.png',
    description: 'Reusable later-chapter finished-environment reference template.',
  },
];

export interface CanonicalStage1Blueprint {
  readonly status: 'LOCKED';
  /** Walkable geometry hash used by Stage 2 and Stage 3 matching. */
  readonly blueprintHash: string;
  /** Walkable geometry plus authored scenery/obstacle-zone identity. */
  readonly structureHash: string;
  readonly artifactPath: string;
  /** Immutable Stage 1 footprint evidence that Stage 2 must compare against. */
  readonly footprintCellKeys: readonly string[];
  readonly requiredRegionCellKeys: readonly string[];
  readonly obstacleCellKeys: readonly string[];
  readonly startKey: string;
  readonly gateKey: string;
  readonly authoringReferences: readonly AuthoringReferenceSlot[];
}

export function getCanonicalStage1Blueprint(
  chapter: number,
  snapshot: CanonicalStage1Snapshot,
): CanonicalStage1Blueprint {
  const packA = chapter === 1
    ? JOURNEY_MAP_AUTHORING_REFERENCE_SLOTS.filter(slot => slot.pack === 'Pack A')
    : [];
  const packB = JOURNEY_MAP_AUTHORING_REFERENCE_SLOTS.filter(slot => slot.pack === 'Pack B');

  return {
    status: 'LOCKED',
    blueprintHash: snapshot.blueprintHash,
    structureHash: snapshot.structureHash,
    artifactPath: `journey-map://canonical/ch${chapter}/blueprint/${snapshot.structureHash}`,
    footprintCellKeys: snapshot.footprintCellKeys,
    requiredRegionCellKeys: snapshot.requiredRegionCellKeys,
    obstacleCellKeys: snapshot.obstacleCellKeys,
    startKey: snapshot.startKey,
    gateKey: snapshot.gateKey,
    authoringReferences: [...packA, ...packB],
  };
}
