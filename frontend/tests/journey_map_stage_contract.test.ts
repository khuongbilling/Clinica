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

console.log(`\njourney_map_stage_contract: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
