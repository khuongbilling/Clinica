/**
 * Immutable, data-only Stage 1 identity shared by the artifact and authoring
 * manifest. Keeping this leaf module independent prevents either side from
 * silently hashing a different interpretation of the authored geometry.
 */
import { getChapterMapLayoutVersion } from './journeyMapVersion';
import { fnv1a32 } from './prng';
import type { HexLaneLayout, SceneryLayout } from './chapterMapTemplate.types';
import { getCanonicalStage1Source } from './canonicalStage1Source';

function cellKey(q: number, r: number): string {
  return `${q},${r}`;
}

function sortedUniqueKeys(cells: readonly { q: number; r: number }[]): readonly string[] {
  return Object.freeze([...new Set(cells.map(cell => cellKey(cell.q, cell.r)))].sort());
}

export interface CanonicalStage1Snapshot {
  readonly blueprintHash: string;
  readonly structureHash: string;
  readonly footprintCellKeys: readonly string[];
  readonly requiredRegionCellKeys: readonly string[];
  readonly obstacleCellKeys: readonly string[];
  readonly startKey: string;
  readonly gateKey: string;
}

export function createLiveStage1CandidateSnapshot(
  layout: HexLaneLayout,
  scenery: SceneryLayout,
): CanonicalStage1Snapshot {
  const layoutVersion = getChapterMapLayoutVersion(layout.chapterId);
  const footprintCellKeys = sortedUniqueKeys(layout.cells);
  const requiredRegionCellKeys = sortedUniqueKeys(
    layout.clearingZones.flatMap(zone => zone.cells),
  );
  const obstacleCellKeys = sortedUniqueKeys(
    scenery.sceneryZones.flatMap(zone => zone.cells),
  );
  const blueprintHash = fnv1a32(
    `${layout.seed}:${layoutVersion}:${footprintCellKeys.join('|')}`,
  ).toString(16).padStart(8, '0');
  const scenerySignature = scenery.sceneryZones
    .map(zone => {
      const cells = sortedUniqueKeys(zone.cells).join('|');
      return `${zone.id}:${zone.type}:${cells}`;
    })
    .sort()
    .join('||');
  const clearingSignature = layout.clearingZones
    .map(zone => {
      const cells = sortedUniqueKeys(zone.cells).join('|');
      return `${zone.id}:${zone.type}:${cells}`;
    })
    .sort()
    .join('||');
  const startKey = cellKey(layout.startCell.q, layout.startCell.r);
  const gateKey = cellKey(layout.gateCell.q, layout.gateCell.r);
  const structureHash = fnv1a32(
    `${layout.seed}:${layoutVersion}:${blueprintHash}:start=${startKey}:gate=${gateKey}:` +
    `clearings=${clearingSignature}:scenery=${scenerySignature}`,
  ).toString(16).padStart(8, '0');

  return Object.freeze({
    blueprintHash,
    structureHash,
    footprintCellKeys,
    requiredRegionCellKeys,
    obstacleCellKeys,
    startKey,
    gateKey,
  });
}

/**
 * Returns the checked-in authoring identity. It is deliberately separate from
 * live generated layouts so Stage 2 cannot validate a self-derived snapshot.
 */
export function getCanonicalStage1Snapshot(chapter: number): CanonicalStage1Snapshot {
  const source = getCanonicalStage1Source(chapter);
  return Object.freeze({
    blueprintHash: source.blueprintHash,
    structureHash: source.structureHash,
    footprintCellKeys: Object.freeze([]),
    requiredRegionCellKeys: source.requiredRegionCellKeys,
    obstacleCellKeys: Object.freeze([]),
    startKey: source.startKey,
    gateKey: source.gateKey,
  });
}
