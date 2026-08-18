/**
 * journey_map_background_manifest.test.ts — Production Bridge Push 4
 *
 * Validates the BackgroundAuthoringManifest module:
 *   • Manifest structure — all required fields present and correctly typed
 *   • Spatial data integrity — walkable bounds, clearing zones, scenery zones
 *   • Ch1 asset registration — all three shifts declared 'generated'
 *   • Blueprint hash binding — assetVersion matches MAP_LAYOUT_VERSION:hash
 *   • Consistency with canonical artifact — manifests match artifact data
 *   • isChapterBackgroundSynced returns true for Ch1
 *   • Spatial context injected into BackgroundSpec AI prompts
 *   • Day/evening/night AI prompts share identical spatial layout section
 */

import assert from 'assert';
import {
  getBackgroundAuthoringManifests,
  getBackgroundAuthoringManifest,
  isChapterBackgroundSynced,
  type BackgroundAuthoringManifest,
  type WalkableBounds,
} from '../src/game/journeyMap/backgroundAuthoringManifest';
import { getCanonicalChapterMapArtifact, MAP_LAYOUT_VERSION } from '../src/game/journeyMap/canonicalMapArtifact';
import { getChapterHexLayout } from '../src/game/journeyMap/chapterHexLayout';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed   = 0;
let failed   = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`  ✗ ${name}\n      ${msg}`);
    console.log(`  ✗ ${name}\n      ${msg}`);
  }
}

function eq<T>(actual: T, expected: T, msg = ''): void {
  assert.strictEqual(actual, expected, msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function ok(value: unknown, msg = ''): void {
  assert.ok(value, msg || 'Expected truthy value');
}

function boundsContain(bounds: WalkableBounds, q: number, r: number): boolean {
  return q >= bounds.minQ && q <= bounds.maxQ && r >= bounds.minR && r <= bounds.maxR;
}

// ── Pre-compute shared fixtures (called once) ─────────────────────────────────

const manifests  = getBackgroundAuthoringManifests(1);
const dayMf      = getBackgroundAuthoringManifest(1, 'day');
const eveMf      = getBackgroundAuthoringManifest(1, 'evening');
const ngtMf      = getBackgroundAuthoringManifest(1, 'night');
const artifact   = getCanonicalChapterMapArtifact(1);
const layout     = getChapterHexLayout(1);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[1] Manifest structure');
// ─────────────────────────────────────────────────────────────────────────────

test('getBackgroundAuthoringManifests(1) returns exactly 3 manifests', () => {
  eq(manifests.length, 3);
});

test('manifests cover shifts in order: day / evening / night', () => {
  eq(manifests[0]!.shift, 'day');
  eq(manifests[1]!.shift, 'evening');
  eq(manifests[2]!.shift, 'night');
});

test('all manifests have chapterId = 1', () => {
  for (const m of manifests) eq(m.chapterId, 1);
});

test('mapLayoutVersion matches MAP_LAYOUT_VERSION for all shifts', () => {
  for (const m of manifests) eq(m.mapLayoutVersion, MAP_LAYOUT_VERSION);
});

test('mapBlueprintHash is an 8-char hex string for all shifts', () => {
  for (const m of manifests) ok(/^[0-9a-f]{8}$/.test(m.mapBlueprintHash), `bad hash: ${m.mapBlueprintHash}`);
});

test('worldAspectRatio is one of wide/portrait/balanced', () => {
  for (const m of manifests) {
    ok(['wide', 'portrait', 'balanced'].includes(m.worldAspectRatio), `bad ratio: ${m.worldAspectRatio}`);
  }
});

test('targetDimensions is 1024×1024 for all shifts', () => {
  for (const m of manifests) {
    eq(m.targetDimensions.width,  1024);
    eq(m.targetDimensions.height, 1024);
  }
});

test('aiPrompt is non-empty (> 50 chars) for all shifts', () => {
  for (const m of manifests) ok(m.aiPrompt.length > 50, `prompt too short: ${m.aiPrompt.length}`);
});

test('negativePrompt is non-empty for all shifts', () => {
  for (const m of manifests) ok(m.negativePrompt.length > 10);
});

test('rasterAsset contains shift name', () => {
  for (const m of manifests) ok(m.rasterAsset.includes(m.shift), `rasterAsset "${m.rasterAsset}" missing shift "${m.shift}"`);
});

test('metroRequirePath starts with @/assets/', () => {
  for (const m of manifests) ok(m.metroRequirePath.startsWith('@/assets/'), `bad metro path: ${m.metroRequirePath}`);
});

test('assetStatus is a valid ManifestAssetStatus (Task 766 union)', () => {
  const VALID = ['pending', 'spec_ready', 'raster_unvalidated', 'validated', 'invalid_overlap', 'failed'];
  for (const m of manifests) {
    ok(VALID.includes(m.assetStatus), `bad status: ${m.assetStatus}`);
  }
});

test('assetVersion is BACKGROUND_ASSET_REQUIRED when no raster, version:hash otherwise', () => {
  const NO_RASTER = ['pending', 'spec_ready', 'failed'];
  for (const m of manifests) {
    if (NO_RASTER.includes(m.assetStatus)) {
      eq(m.assetVersion, 'BACKGROUND_ASSET_REQUIRED');
    } else {
      ok(/^v\d+:[0-9a-f]{8}$/.test(m.assetVersion), `bad version: ${m.assetVersion}`);
    }
  }
});

test('getBackgroundAuthoringManifests caches (same array reference)', () => {
  const second = getBackgroundAuthoringManifests(1);
  ok(second === manifests, 'Expected cached reference equality');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[2] Spatial data integrity');
// ─────────────────────────────────────────────────────────────────────────────

test('walkableBounds totalTiles matches layout.actualTileCount', () => {
  eq(dayMf.walkableBounds.totalTiles, layout.actualTileCount);
});

test('walkableBounds contains startCell', () => {
  ok(boundsContain(dayMf.walkableBounds, layout.startCell.q, layout.startCell.r),
    `startCell (${layout.startCell.q},${layout.startCell.r}) outside bounds`);
});

test('walkableBounds contains gateCell', () => {
  ok(boundsContain(dayMf.walkableBounds, layout.gateCell.q, layout.gateCell.r),
    `gateCell (${layout.gateCell.q},${layout.gateCell.r}) outside bounds`);
});

test('walkableBounds maxQ >= minQ and maxR >= minR', () => {
  const { minQ, maxQ, minR, maxR } = dayMf.walkableBounds;
  ok(maxQ >= minQ, `maxQ(${maxQ}) < minQ(${minQ})`);
  ok(maxR >= minR, `maxR(${maxR}) < minR(${minR})`);
});

test('clearingZones count matches layout clearing count', () => {
  eq(dayMf.clearingZones.length, layout.clearingZones.length);
});

test('clearing zone ids are unique', () => {
  const ids = dayMf.clearingZones.map(cz => cz.id);
  eq(new Set(ids).size, ids.length, 'duplicate clearing zone ids');
});

test('clearing centroids fall within walkable bounds', () => {
  for (const cz of dayMf.clearingZones) {
    ok(boundsContain(dayMf.walkableBounds, cz.centroidQ, cz.centroidR),
      `clearing ${cz.id} centroid (${cz.centroidQ},${cz.centroidR}) outside bounds`);
  }
});

test('all clearingZones have positive cellCount', () => {
  for (const cz of dayMf.clearingZones) ok(cz.cellCount > 0, `${cz.id} cellCount = 0`);
});

test('at least one scenery zone is present', () => {
  ok(dayMf.sceneryZones.length > 0, 'no scenery zones');
});

test('all sceneryZones have positive cellCount', () => {
  for (const sz of dayMf.sceneryZones) ok(sz.cellCount > 0, `${sz.id} cellCount = 0`);
});

test('scenery zone centroids are finite numbers', () => {
  for (const sz of dayMf.sceneryZones) {
    ok(Number.isFinite(sz.centroidQ), `${sz.id} centroidQ is not finite`);
    ok(Number.isFinite(sz.centroidR), `${sz.id} centroidR is not finite`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[3] Ch1 asset registration');
// ─────────────────────────────────────────────────────────────────────────────

test('Ch1 day: assetStatus is validated (raster exists + composition check passed)', () => {
  eq(dayMf.assetStatus, 'validated');
});

test('Ch1 evening: assetStatus is validated (raster exists + composition check passed)', () => {
  eq(eveMf.assetStatus, 'validated');
});

test('Ch1 night: assetStatus is validated (raster exists + composition check passed)', () => {
  eq(ngtMf.assetStatus, 'validated');
});

test('Ch1 manifests expose a passing validationResult (Task 766)', () => {
  for (const m of manifests) {
    ok(m.validationResult != null, `${m.shift}: missing validationResult`);
    ok(m.validationResult.pass, `${m.shift}: validation failed`);
    eq(m.validationResult.violations.length, 0);
  }
});

test('all three shifts share the same validationResult reference', () => {
  ok(dayMf.validationResult === eveMf.validationResult, 'day vs evening');
  ok(dayMf.validationResult === ngtMf.validationResult, 'day vs night');
});

test('Ch1 day: rasterAsset contains "day"', () => {
  ok(dayMf.rasterAsset.includes('day'), `rasterAsset: ${dayMf.rasterAsset}`);
});

test('Ch1 evening: rasterAsset contains "evening"', () => {
  ok(eveMf.rasterAsset.includes('evening'), `rasterAsset: ${eveMf.rasterAsset}`);
});

test('Ch1 night: rasterAsset contains "night"', () => {
  ok(ngtMf.rasterAsset.includes('night'), `rasterAsset: ${ngtMf.rasterAsset}`);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[4] Blueprint hash binding');
// ─────────────────────────────────────────────────────────────────────────────

test('all three shifts share the same blueprint hash', () => {
  ok(dayMf.mapBlueprintHash === eveMf.mapBlueprintHash, 'day vs evening hash mismatch');
  ok(dayMf.mapBlueprintHash === ngtMf.mapBlueprintHash, 'day vs night hash mismatch');
});

test('assetVersion encodes mapLayoutVersion:mapBlueprintHash for raster-backed shifts', () => {
  const HAS_RASTER = ['raster_unvalidated', 'validated', 'invalid_overlap'];
  for (const m of manifests) {
    if (HAS_RASTER.includes(m.assetStatus)) {
      const expected = `${m.mapLayoutVersion}:${m.mapBlueprintHash}`;
      eq(m.assetVersion, expected);
    }
  }
});

test('blueprint hash is deterministic on repeated calls', () => {
  const a = getBackgroundAuthoringManifest(1, 'day').mapBlueprintHash;
  const b = getBackgroundAuthoringManifest(1, 'day').mapBlueprintHash;
  eq(a, b);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[5] Consistency with CanonicalChapterMapArtifact');
// ─────────────────────────────────────────────────────────────────────────────

test('artifact.backgroundManifests has 3 entries', () => {
  eq(artifact.backgroundManifests.length, 3);
});

test('artifact.backgroundManifests is the same reference as getBackgroundAuthoringManifests(1)', () => {
  ok(artifact.backgroundManifests === manifests, 'Expected reference equality via shared cache');
});

test('manifest.mapBlueprintHash matches artifact.blueprintHash', () => {
  for (const m of manifests) eq(m.mapBlueprintHash, artifact.blueprintHash);
});

test('manifest walkableBounds.totalTiles matches artifact.tileCount', () => {
  for (const m of manifests) eq(m.walkableBounds.totalTiles, artifact.tileCount);
});

test('manifest clearingZones.length matches artifact.clearingCount', () => {
  for (const m of manifests) eq(m.clearingZones.length, artifact.clearingCount);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[6] isChapterBackgroundSynced');
// ─────────────────────────────────────────────────────────────────────────────

test('isChapterBackgroundSynced(1) returns true (all shifts validated)', () => {
  ok(isChapterBackgroundSynced(1), 'Expected Ch1 to be fully synced');
});

test('isChapterBackgroundSynced returns a boolean', () => {
  eq(typeof isChapterBackgroundSynced(1), 'boolean');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[7] Spatial context in AI prompts');
// ─────────────────────────────────────────────────────────────────────────────

test('aiPrompt includes "spatial layout:" section', () => {
  ok(dayMf.aiPrompt.includes('spatial layout:'), 'missing spatial layout section');
});

test('aiPrompt mentions the topology family (academic quad)', () => {
  ok(dayMf.aiPrompt.toLowerCase().includes('academic quad'), 'missing topology family');
});

test('aiPrompt includes "start region:" description', () => {
  ok(dayMf.aiPrompt.includes('start region:'), 'missing start region');
});

test('aiPrompt includes "gate region:" description', () => {
  ok(dayMf.aiPrompt.includes('gate region:'), 'missing gate region');
});

test('aiPrompt includes CRITICAL walkable rule', () => {
  ok(dayMf.aiPrompt.includes('CRITICAL walkable rule:'), 'missing CRITICAL walkable rule');
});

test('aiPrompt mentions the clearing count', () => {
  ok(dayMf.aiPrompt.includes(`${artifact.clearingCount} named clearings`),
    `Expected "${artifact.clearingCount} named clearings" in prompt`);
});

test('all three shifts share identical spatial layout section', () => {
  function extractSpatial(prompt: string): string {
    const start = prompt.indexOf('spatial layout:');
    const end   = prompt.indexOf('; floor/ground layer:');
    return start !== -1 && end !== -1 ? prompt.slice(start, end) : '';
  }
  const dSec = extractSpatial(dayMf.aiPrompt);
  const eSec = extractSpatial(eveMf.aiPrompt);
  const nSec = extractSpatial(ngtMf.aiPrompt);
  ok(dSec.length > 0, 'day spatial section empty');
  ok(dSec === eSec, 'day vs evening spatial section differs');
  ok(dSec === nSec, 'day vs night spatial section differs');
});

test('spatial layout section includes walkable tile count', () => {
  ok(dayMf.aiPrompt.includes(`${layout.actualTileCount} walkable hexes`),
    `Expected "${layout.actualTileCount} walkable hexes" in prompt`);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[8] getBackgroundAuthoringManifest single-shift accessor');
// ─────────────────────────────────────────────────────────────────────────────

test('single-shift accessor returns the same object as array accessor', () => {
  const single = getBackgroundAuthoringManifest(1, 'evening');
  ok(single === eveMf, 'Expected reference equality from cache');
});

test('single-shift accessor returns correct shift', () => {
  eq(getBackgroundAuthoringManifest(1, 'night').shift, 'night');
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
if (failures.length > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) console.log(f);
}
console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
