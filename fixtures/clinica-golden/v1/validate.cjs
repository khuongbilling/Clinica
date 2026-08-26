#!/usr/bin/env node
'use strict';

/**
 * Data-only golden fixture validation. This intentionally validates portable
 * contracts only; FastAPI/Mongo/session/concurrency checks remain executable
 * backend tests.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
const fail = (message) => {
  throw new Error(`[clinica-golden] ${message}`);
};

function canonicalize(value) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    if (value !== value.normalize('NFC') || value.includes('\r')) fail('canonical payload contains non-NFC text or CR line endings');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('canonical payload contains a non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  fail(`unsupported canonical value type: ${typeof value}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
}

function requireEnvelope(fixture, expected) {
  const required = [
    'fixture_id', 'fixture_revision', 'schema_id', 'schema_version', 'authority',
    'normalization_version', 'content_manifest_id', 'content_manifest_version',
    'source_revision', 'payload',
  ];
  for (const key of required) if (!(key in fixture)) fail(`${expected.fixture_id}: missing ${key}`);
  if (fixture.fixture_id !== expected.fixture_id) fail(`${expected.fixture_id}: fixture_id mismatch`);
  if (fixture.authority !== expected.authority) fail(`${expected.fixture_id}: authority mismatch`);
  if (!/^clinica\.golden\./.test(fixture.schema_id)) fail(`${expected.fixture_id}: invalid schema_id`);
  if (!Number.isInteger(fixture.fixture_revision) || fixture.fixture_revision < 1) fail(`${expected.fixture_id}: invalid fixture_revision`);
  if (!Number.isInteger(fixture.schema_version) || fixture.schema_version < 1) fail(`${expected.fixture_id}: invalid schema_version`);
  if (!Number.isInteger(fixture.normalization_version) || fixture.normalization_version < 1) fail(`${expected.fixture_id}: invalid normalization_version`);
}

function makeCatalogLookup(catalog) {
  const groups = ['items', 'equipment', 'heroes', 'skills', 'activities', 'features', 'buildings', 'chapters', 'encounter_types'];
  const lookup = {};
  for (const group of groups) {
    const records = catalog.payload[group];
    if (!Array.isArray(records)) fail(`catalog: ${group} must be an array`);
    const ids = new Set();
    for (const record of records) {
      if (!record || typeof record.id !== 'string' || !record.id) fail(`catalog: invalid ${group} ID`);
      if (ids.has(record.id)) fail(`catalog: duplicate ${group} ID ${record.id}`);
      ids.add(record.id);
    }
    lookup[group] = records;
  }
  return lookup;
}

function assertResolves(lookup, group, id, context) {
  if (!lookup[group].some((entry) => entry.id === id)) fail(`${context}: unresolved ${group} ID ${id}`);
}

function assertNonNegativeQuantities(quantities, context) {
  for (const [id, quantity] of Object.entries(quantities)) {
    if (!Number.isInteger(quantity) || quantity < 0) fail(`${context}: invalid quantity for ${id}`);
  }
}

function assertNoMint(caseRecord, context) {
  const delta = caseRecord.grant_delta;
  if (!delta || delta.currency !== 0 || delta.stamina !== 0) fail(`${context}: migration must not mint currency or stamina`);
  if (Object.values(delta.inventory || {}).some((value) => value !== 0)) fail(`${context}: migration must not mint inventory`);
  for (const key of ['heroes', 'equipment', 'claims', 'receipts']) {
    if (!Array.isArray(delta[key]) || delta[key].length !== 0) fail(`${context}: migration must not mint ${key}`);
  }
}

function validateFixtures(fixtures, lookup) {
  const migration = fixtures['player-migration-vectors'].payload;
  if (migration.target_player_schema_id !== 'clinica.player' || migration.target_save_version !== 3) fail('player migration target must be clinica.player v3');
  for (const record of migration.cases) {
    assertNoMint(record, `migration:${record.case_id}`);
    if (record.input.inventory) {
      const hasMalformedQuantity = Object.values(record.input.inventory).some((quantity) => !Number.isInteger(quantity) || quantity < 0);
      if (hasMalformedQuantity && record.expected.action !== 'quarantine') {
        fail(`migration:${record.case_id}: malformed inventory must quarantine`);
      }
      if (!hasMalformedQuantity) assertNonNegativeQuantities(record.input.inventory, `migration:${record.case_id}`);
    }
    if (record.expected.action === 'quarantine' && record.expected.never_downgrade !== undefined && !record.expected.never_downgrade) {
      fail(`migration:${record.case_id}: future version must not downgrade`);
    }
  }
  const future = migration.cases.find((record) => record.case_id === 'unknown-future-quarantine');
  if (!future || future.expected.action !== 'quarantine' || !future.expected.preserve_input_unchanged) fail('migration: unknown future version must quarantine unchanged');

  for (const record of fixtures['account-gates-vectors'].payload.cases) assertResolves(lookup, 'features', record.feature_id, `gate:${record.case_id}`);

  const journey = fixtures['journey-canonical-run-vectors'].payload;
  if (journey.run.schema_version !== 2) fail('journey schema_version must remain 2');
  assertResolves(lookup, 'chapters', journey.run.chapter_id, 'journey');
  const tileIds = new Set();
  for (const tile of journey.run.tiles) {
    if (tileIds.has(tile.id)) fail(`journey: duplicate tile ID ${tile.id}`);
    tileIds.add(tile.id);
    assertResolves(lookup, 'encounter_types', tile.encounter_type, `journey:${tile.id}`);
  }
  if (!tileIds.has(journey.run.start_tile_id) || !tileIds.has(journey.run.gate_tile_id)) fail('journey: start/gate references must resolve');

  const daily = fixtures['daily-rounds-v2-vectors'].payload;
  if (daily.daily_rounds_version !== 2) fail('daily rounds version must remain 2');
  for (const activityId of daily.board_generation.expected_activity_ids) assertResolves(lookup, 'activities', activityId, 'daily board');
  if (daily.legacy_migration.grant_delta.currency !== 0 || daily.legacy_migration.grant_delta.xp !== 0) fail('daily legacy migration must not settle rewards locally');

  const realm = fixtures['realm-layout-classification'].payload;
  for (const placement of realm.placements) assertResolves(lookup, 'buildings', placement.building_id, 'realm placement');
  if (realm.producer_projection.authority !== 'local_projection' || realm.producer_projection.durable_grant !== false) fail('realm production must remain local projection');

  const activityRecords = fixtures['server-issued-attempt-receipt-vectors'].payload.records;
  const attemptIds = new Set();
  for (const record of activityRecords) {
    assertResolves(lookup, 'activities', record.activity_id, `activity:${record.attempt_id}`);
    if (attemptIds.has(record.attempt_id)) fail(`activities: duplicate attempt ID ${record.attempt_id}`);
    attemptIds.add(record.attempt_id);
    if (!record.receipt_id || record.status !== 'claimed') fail(`activities: invalid claimed record ${record.attempt_id}`);
  }

  const roundtrip = fixtures['replit-godot-unity-roundtrip'].payload;
  const player = roundtrip.canonical_player;
  if (player.schema_id !== 'clinica.player' || player.save_version !== 3) fail('roundtrip: player must be clinica.player v3');
  assertNonNegativeQuantities(player.authoritative.inventory, 'roundtrip inventory');
  for (const itemId of Object.keys(player.authoritative.inventory)) assertResolves(lookup, 'items', itemId, 'roundtrip inventory');
  const ownedEquipment = new Set(player.authoritative.equipment_owned);
  for (const equipmentId of ownedEquipment) assertResolves(lookup, 'equipment', equipmentId, 'roundtrip equipment');
  for (const loadout of player.authoritative.loadout) {
    if (!ownedEquipment.has(loadout.equipment_id)) fail(`roundtrip: loadout does not own ${loadout.equipment_id}`);
    const equipment = lookup.equipment.find((entry) => entry.id === loadout.equipment_id);
    if (equipment.slot !== loadout.slot) fail(`roundtrip: incompatible slot for ${loadout.equipment_id}`);
  }
  const rosterIds = new Set(player.authoritative.roster_heroes.map((hero) => hero.hero_id));
  for (const heroId of rosterIds) assertResolves(lookup, 'heroes', heroId, 'roundtrip roster');
  if (rosterIds.has(player.authoritative.player_hero.player_hero_id)) fail('roundtrip: Player Hero must remain separate from roster Heroes');
  if (!attemptIds.has(player.authoritative.activity_attempt_refs[0])) fail('roundtrip: activity attempt reference must resolve');
  if (player.authoritative.journey_run_refs[0] !== journey.run.id) fail('roundtrip: Journey run reference must resolve');
  const versions = roundtrip.semantic_projection.versions;
  if (versions.player_save_version !== 3 || versions.journey_schema_version !== 2 || versions.daily_rounds_version !== 2) {
    fail('roundtrip: nested versions must remain separate');
  }
}

function main() {
  const index = readJson('fixture-index.json');
  const hashManifest = readJson('hashes.json');
  const hashes = new Map(hashManifest.entries.map((entry) => [entry.fixture_id, entry]));
  if (hashes.size !== index.fixtures.length) fail('hash manifest must contain exactly one entry per fixture');

  const fixtures = {};
  for (const expected of index.fixtures) {
    const fixture = readJson(expected.path);
    requireEnvelope(fixture, expected);
    const entry = hashes.get(expected.fixture_id);
    if (!entry || entry.path !== expected.path) fail(`${expected.fixture_id}: missing hash entry`);
    const actual = sha256(fixture.payload);
    if (entry.payload_sha256 !== actual) fail(`${expected.fixture_id}: payload SHA-256 mismatch`);
    fixtures[expected.fixture_id] = fixture;
  }

  validateFixtures(fixtures, makeCatalogLookup(fixtures['stable-id-manifest']));
  console.log(`PASS [clinica-golden] ${index.fixtures.length} fixtures validated with ${index.canonicalization_profile}`);
}

main();