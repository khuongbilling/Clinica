import assert from 'assert';
import { BLUEPRINT_PIPELINE_CHAPTERS } from '../src/game/journeyMap/config';
import {
  compareStage2ToStage1,
  getCanonicalChapterMapArtifact,
  validateStage2Candidate,
} from '../src/game/journeyMap/canonicalMapArtifact';
import { JOURNEY_MAP_AUTHORING_REFERENCE_SLOTS } from '../src/game/journeyMap/canonicalStageContract';
import {
  selectStage3Asset,
  type Stage3ManifestIdentity,
} from '../src/game/journeyMap/stage3AssetSelector';
import { getEnvironmentRevealRadius } from '../src/game/journeyMap/fog/fogRevealGeometry';
import { AUTHORED_MAP_TILE_SZ, computeHexWorldCoords } from '../src/components/journey/hexWorldCoords';
import { worldContentZForAxialDepth } from '../src/components/journey/journeyZ';
import {
  getRequiredRuntimePropType,
  validateObstaclePresentationContract,
} from '../src/game/journeyMap/obstaclePresentationContract';
import { planSceneryProps } from '../src/game/journeyMap/sceneryPropPlacer';
import { SCENERY_PROP_DEFS } from '../src/game/journeyMap/sceneryPropTypes';
import type { SceneryLayout } from '../src/game/journeyMap/chapterMapTemplate.types';
import type { HexWorldCoords } from '../src/components/journey/hexWorldCoords';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.error(`  ✗ ${name}\n    ${error instanceof Error ? error.message : String(error)}`);
  }
}

function manifest(overrides: Partial<Stage3ManifestIdentity> = {}): Stage3ManifestIdentity {
  return {
    chapterId: 1,
    shift: 'day',
    mapBlueprintHash: 'abc12345',
    mapStructureHash: 'def67890',
    mapLayoutVersion: 'v1',
    rasterAsset: 'assets/ui/journey/map/map-platform-background-ch1-day.png',
    assetStatus: 'validated',
    assetVersion: 'v1:abc12345:def67890',
    ...overrides,
  };
}

test('every blueprint-pipeline chapter has locked Stage 1 and validated Stage 2 evidence', () => {
  for (const chapter of BLUEPRINT_PIPELINE_CHAPTERS) {
    const artifact = getCanonicalChapterMapArtifact(chapter);
    assert.strictEqual(artifact.stage1Blueprint.status, 'LOCKED', `Ch${chapter} Stage 1`);
    assert.strictEqual(artifact.stage1Blueprint.blueprintHash, artifact.blueprintHash, `Ch${chapter} hash`);
    assert.ok(/^[0-9a-f]{8}$/.test(artifact.stage1Blueprint.structureHash), `Ch${chapter} structure hash`);
    assert.strictEqual(artifact.stage2Validation.status, 'VALIDATED', `Ch${chapter} Stage 2`);
    assert.ok(artifact.stage2Validation.pass, `Ch${chapter} Stage 2 pass`);
    assert.ok(artifact.stage2Validation.startToGateConnected, `Ch${chapter} gate connectivity`);
    assert.ok(artifact.stage2Validation.requiredRegionsConnected, `Ch${chapter} region connectivity`);
    assert.ok(artifact.stage2Validation.obstacleIntersectionPass, `Ch${chapter} obstacle safety`);
    assert.ok(artifact.stage2Validation.voidIntersectionPass, `Ch${chapter} void safety`);
  }
});

test('Pack A and Pack B slots are upload-ready but non-rendering pending references', () => {
  assert.strictEqual(JOURNEY_MAP_AUTHORING_REFERENCE_SLOTS.length, 6);
  for (const slot of JOURNEY_MAP_AUTHORING_REFERENCE_SLOTS) {
    assert.strictEqual(slot.status, 'PENDING_UPLOAD', slot.id);
    assert.ok(slot.uploadPath.startsWith('assets/ui/journey/map/authoring/'), slot.uploadPath);
  }
});

test('Stage 3 approves only an exact validated asset and hash match', () => {
  const m = manifest();
  const selection = selectStage3Asset(m, {
    '1:day:abc12345:def67890': {
      source: 123,
      assetPath: m.rasterAsset,
    },
  });
  assert.strictEqual(selection.status, 'APPROVED');
  assert.strictEqual(selection.source, 123);
  assert.strictEqual(selection.selectedAssetPath, m.rasterAsset);
});

test('Stage 3 reports MISSING without an exact chapter-shift-hash registration', () => {
  const selection = selectStage3Asset(manifest(), {});
  assert.strictEqual(selection.status, 'MISSING');
  assert.strictEqual(selection.source, undefined);
});

test('Stage 3 reports MISMATCHED and never returns a source for a wrong asset path', () => {
  const selection = selectStage3Asset(manifest(), {
    '1:day:abc12345:def67890': {
      source: 456,
      assetPath: 'assets/ui/journey/map/unrelated-legacy-background.png',
    },
  });
  assert.strictEqual(selection.status, 'MISMATCHED');
  assert.strictEqual(selection.source, undefined);
  assert.strictEqual(selection.candidateAssetPath, 'assets/ui/journey/map/unrelated-legacy-background.png');
});

test('Stage 3 reports MISSING when a registered raster is not approved in the manifest', () => {
  const m = manifest({ assetStatus: 'pending', assetVersion: 'BACKGROUND_ASSET_REQUIRED' });
  const selection = selectStage3Asset(m, {
    '1:day:abc12345:def67890': { source: 789, assetPath: m.rasterAsset },
  });
  assert.strictEqual(selection.status, 'MISSING');
  assert.strictEqual(selection.source, undefined);
});

test('Stage 3 suppresses a future raster missing its obstacle presentation contract', () => {
  const m = manifest({
    chapterId: 6,
    assetStatus: 'missing_obstacle_presentation',
  });
  const selection = selectStage3Asset(m, {
    '6:day:abc12345:def67890': { source: 790, assetPath: m.rasterAsset },
  });
  assert.strictEqual(selection.status, 'MISSING');
  assert.strictEqual(selection.source, undefined);
  assert.match(selection.reason, /missing_obstacle_presentation/);
});

test('Stage 2 failure suppresses an otherwise exact Stage 3 raster', () => {
  const m = manifest();
  const selection = selectStage3Asset(m, {
    '1:day:abc12345:def67890': { source: 901, assetPath: m.rasterAsset },
  }, { stage2Pass: false });
  assert.strictEqual(selection.status, 'MISMATCHED');
  assert.strictEqual(selection.source, undefined);
  assert.match(selection.reason, /Stage 2/);
});

test('Stage 1 structure changes invalidate Stage 3 even when walkable hash is unchanged', () => {
  const m = manifest();
  const selection = selectStage3Asset(
    { ...m, mapStructureHash: 'changed01', assetVersion: 'v1:abc12345:changed01' },
    { '1:day:abc12345:def67890': { source: 246, assetPath: m.rasterAsset } },
  );
  assert.strictEqual(selection.status, 'MISSING');
  assert.strictEqual(selection.source, undefined);
});

test('Stage 2 rejects a same-count candidate whose footprint or obstacle structure differs from Stage 1', () => {
  const artifact = getCanonicalChapterMapArtifact(1);
  const [removed] = artifact.hexLayout.cells;
  assert.ok(removed);
  const changedLayout = {
    ...artifact.hexLayout,
    cells: [
      ...artifact.hexLayout.cells.slice(1),
      { q: removed.q + 40, r: removed.r + 40 },
    ],
  };
  const changedFootprint = compareStage2ToStage1(
    artifact.stage1Blueprint,
    changedLayout,
    artifact.sceneryLayout,
  );
  assert.strictEqual(changedFootprint.stage1FootprintMatch, false);

  const firstZone = artifact.sceneryLayout.sceneryZones[0]!;
  const changedScenery = {
    ...artifact.sceneryLayout,
    sceneryZones: [{
      ...firstZone,
      cells: [...firstZone.cells, { q: 70, r: 70 }],
      area: firstZone.area + 1,
    }, ...artifact.sceneryLayout.sceneryZones.slice(1)],
  };
  const changedStructure = compareStage2ToStage1(
    artifact.stage1Blueprint,
    artifact.hexLayout,
    changedScenery,
  );
  assert.strictEqual(changedStructure.stage1StructureMatch, false);
});

test('the production Stage 2 evaluator rejects changed start, gate, and clearing identities', () => {
  const artifact = getCanonicalChapterMapArtifact(1);
  const firstClearing = artifact.hexLayout.clearingZones[0]!;

  const changedStart = validateStage2Candidate(1, {
    ...artifact.hexLayout,
    startCell: artifact.hexLayout.cells[1]!,
  }, artifact.sceneryLayout);
  assert.strictEqual(changedStart.pass, false);
  assert.strictEqual(changedStart.stage1StructureMatch, false);

  const changedGate = validateStage2Candidate(1, {
    ...artifact.hexLayout,
    gateCell: artifact.hexLayout.cells[2]!,
  }, artifact.sceneryLayout);
  assert.strictEqual(changedGate.pass, false);
  assert.strictEqual(changedGate.stage1StructureMatch, false);

  const changedClearings = validateStage2Candidate(1, {
    ...artifact.hexLayout,
    clearingZones: [{
      ...firstClearing,
      id: `${firstClearing.id}-changed`,
    }, ...artifact.hexLayout.clearingZones.slice(1)],
  }, artifact.sceneryLayout);
  assert.strictEqual(changedClearings.pass, false);
  assert.strictEqual(changedClearings.stage1StructureMatch, false);
});

test('native and web environment reveal use the shared high-FOV radius geometry', () => {
  assert.strictEqual(getEnvironmentRevealRadius(80, 'explored', 3), 100);
  assert.strictEqual(getEnvironmentRevealRadius(80, 'visible', 2), 186);
  assert.strictEqual(getEnvironmentRevealRadius(80, 'visible', 3), 252);
});

test('future maps require both raster attestation and asset-backed raised obstacle props', () => {
  const blockingScenery = {
    sceneryZones: [{
      id: 'future-garden',
      type: 'GARDEN',
      cells: [{ q: 4, r: 4 }],
      centroid: { q: 4, r: 4 },
      area: 1,
      walkableContactCount: 0,
    }],
  } as unknown as SceneryLayout;

  const currentMap = validateObstaclePresentationContract(5, blockingScenery, false);
  assert.strictEqual(currentMap.required, false);
  assert.strictEqual(currentMap.pass, true);

  const futureMap = validateObstaclePresentationContract(6, blockingScenery, true);
  assert.strictEqual(futureMap.required, true);
  assert.strictEqual(futureMap.rasterObstaclesAttested, true);
  assert.strictEqual(futureMap.pass, false);
  assert.ok(futureMap.missingRuntimePropZoneTypes.includes('GARDEN'));
});

test('a secondary prop asset never approves a future blocking zone', () => {
  const blockingGarden = {
    sceneryZones: [{
      id: 'future-garden',
      type: 'GARDEN',
      cells: [{ q: 4, r: 4 }],
      centroid: { q: 4, r: 4 },
      area: 1,
      walkableContactCount: 0,
    }],
  } as unknown as SceneryLayout;

  assert.strictEqual(getRequiredRuntimePropType('GARDEN'), 'ACADEMY_PLANTER');
  const onlySecondaryArt = validateObstaclePresentationContract(
    6,
    blockingGarden,
    true,
    propType => propType === 'BENCH',
  );
  assert.strictEqual(onlySecondaryArt.pass, false);
  assert.ok(onlySecondaryArt.missingRuntimePropZoneTypes.includes('GARDEN'));
});

test('an unsafe required future blocker suppresses runtime placement and future approval', () => {
  const blockingGarden = {
    sceneryZones: [{
      id: 'future-garden',
      type: 'GARDEN',
      cells: [{ q: 0, r: 0 }],
      centroid: { q: 0, r: 0 },
      area: 1,
      walkableContactCount: 0,
    }],
    walkableSafetyMaskKeys: ['0,0'],
  } as unknown as SceneryLayout;
  const coords = {
    sz: 80,
    worldOriginX: 0,
    worldOriginY: 0,
    worldWidth: 400,
    worldHeight: 400,
    axialToWorld: (q: number, r: number) => ({
      left: q * 58,
      top: r * 63,
      cx: q * 58 + 40,
      cy: r * 63 + 40,
    }),
  } as HexWorldCoords;
  const planter = SCENERY_PROP_DEFS.ACADEMY_PLANTER as { asset: number | null };
  const originalAsset = planter.asset;

  planter.asset = 999;
  try {
    const placement = planSceneryProps(blockingGarden, coords, 6);
    assert.strictEqual(placement.props.length, 0);
    assert.deepStrictEqual(placement.unplacedRequiredZoneIds, ['future-garden']);
    const approval = validateObstaclePresentationContract(
      6,
      blockingGarden,
      true,
      propType => propType === 'ACADEMY_PLANTER',
      zoneId => !placement.unplacedRequiredZoneIds.includes(zoneId),
    );
    assert.strictEqual(approval.pass, false);
  } finally {
    planter.asset = originalAsset;
  }
});

test('Chapters 2–5 render their raised primary scenery props through safe placement', () => {
  const expectedPrimaryProps = {
    2: 'DECORATIVE_COLUMN',
    3: 'WORKSTATION',
    4: 'OBSERVATION_TERMINAL',
    5: 'DECORATIVE_COLUMN',
  } as const;

  for (const [chapterValue, expectedType] of Object.entries(expectedPrimaryProps)) {
    const chapter = Number(chapterValue);
    const artifact = getCanonicalChapterMapArtifact(chapter);
    const coords = computeHexWorldCoords(
      artifact.hexLayout.cells,
      1,
      AUTHORED_MAP_TILE_SZ,
    );
    const placement = planSceneryProps(artifact.sceneryLayout, coords, chapter);
    const primaryProp = placement.props.find(prop => prop.type === expectedType);

    assert.ok(primaryProp, `Ch${chapter} should place ${expectedType}`);
    assert.notStrictEqual(primaryProp!.def.asset, null, `Ch${chapter} ${expectedType} needs production art`);
    const propZ = worldContentZForAxialDepth(primaryProp!.axialDepth);
    const northernPlayerZ = worldContentZForAxialDepth(primaryProp!.axialDepth - 1);
    const southernPlayerZ = worldContentZForAxialDepth(primaryProp!.axialDepth + 1);
    assert.ok(
      northernPlayerZ < propZ,
      `Ch${chapter} player north of ${expectedType} should render behind it`,
    );
    assert.ok(
      propZ < southernPlayerZ,
      `Ch${chapter} player south of ${expectedType} should render in front of it`,
    );
    assert.deepStrictEqual(
      placement.unplacedRequiredZoneIds,
      [],
      `Ch${chapter} cannot leave required raised blockers unplaced`,
    );
  }
});

console.log(`\njourney_map_stage_contract: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
