/**
 * Fixed, collision-backed landmarks for the Chapter 1 campus.
 *
 * These objects are rendered at runtime above the clean campus floor. Their
 * occupied cells are the canonical non-walkable cells, so a landmark can never
 * be painted underneath a playable hex.
 */

import { worldContentZForAxialDepth } from '../../components/journey/journeyZ';

export type CampusLandmarkKind = 'grandFountain' | 'planterCypresses';

export interface ChapterOneCampusLandmark {
  readonly id: string;
  readonly kind: CampusLandmarkKind;
  readonly anchor: { readonly q: number; readonly r: number };
  readonly blockedCellKeys: readonly string[];
  readonly sizeTiles: { readonly w: number; readonly h: number };
}

export const CHAPTER_ONE_CAMPUS_LANDMARKS: readonly ChapterOneCampusLandmark[] = Object.freeze([
  {
    id: 'grand-quad-fountain',
    kind: 'grandFountain',
    anchor: { q: 0, r: 0 },
    blockedCellKeys: ['-1,0', '-1,1', '0,-1', '0,0', '0,1', '1,-1', '1,0'],
    sizeTiles: { w: 2.85, h: 2.25 },
  },
  {
    id: 'upper-west-planters',
    kind: 'planterCypresses',
    anchor: { q: -1, r: -3 },
    blockedCellKeys: ['-2,-2', '-1,-3'],
    sizeTiles: { w: 1.8, h: 2.1 },
  },
  {
    id: 'upper-east-planters',
    kind: 'planterCypresses',
    anchor: { q: 1, r: -4 },
    blockedCellKeys: ['1,-4', '2,-4'],
    sizeTiles: { w: 1.8, h: 2.1 },
  },
  {
    id: 'lower-processional-planter',
    kind: 'planterCypresses',
    anchor: { q: 0, r: 3 },
    blockedCellKeys: ['-1,3', '0,3', '1,2'],
    sizeTiles: { w: 2.2, h: 2.4 },
  },
]);

/** Single collision authority for the Chapter 1 fixed landmark layer. */
export const CHAPTER_ONE_CAMPUS_OBSTACLE_CELL_KEYS: readonly string[] = Object.freeze(
  CHAPTER_ONE_CAMPUS_LANDMARKS.flatMap(landmark => landmark.blockedCellKeys),
);

/** Matches HexObjectLayer's axial depth axis for stable 2.5D occlusion. */
export function chapterOneCampusLandmarkZ(q: number, r: number): number {
  return worldContentZForAxialDepth(r + q / 2);
}