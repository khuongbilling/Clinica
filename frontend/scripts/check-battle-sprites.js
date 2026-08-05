#!/usr/bin/env node
/**
 * check-battle-sprites.js
 *
 * Validates that every recruitable hero in the game has a corresponding entry
 * in HeroBattleSprites.ts AND that the PNG file referenced by that entry
 * actually exists on disk.
 *
 * ── Sources of hero IDs ───────────────────────────────────────────────────────
 *
 *   heroRoster.ts  (LAUNCH_ROSTER)
 *     The primary roster; contains all heroes available for recruitment.
 *     Every `id:` value inside the LAUNCH_ROSTER array is checked.
 *
 *   gacha.ts  (GACHA_HEROES)
 *     Contains legacy heroes (novice_guardian, apprentice_seer, etc.) that live
 *     in content.ts instead of heroRoster.ts.  Every `heroId:` value here is
 *     checked as well so gacha-pool heroes are never missed.
 *
 * ── What is checked ──────────────────────────────────────────────────────────
 *
 *   Check A — sprite entry exists
 *     Every hero ID from both sources above must have a key inside
 *     BATTLE_SPRITES in HeroBattleSprites.ts.
 *
 *   Check B — PNG file exists on disk
 *     Every `require(...)` path inside BATTLE_SPRITES must resolve to a real
 *     file on disk (relative to frontend/src/components/HeroBattleSprites.ts).
 *
 * ── Exit codes ───────────────────────────────────────────────────────────────
 *
 *   0  — all checks pass.
 *   1  — one or more violations found.
 *
 * ── How to run ───────────────────────────────────────────────────────────────
 *
 *   node frontend/scripts/check-battle-sprites.js
 *   npm run check:battle-sprites   (from frontend/)
 *
 *   Automatically runs as part of `npm run validate`.
 *
 * ── When to add a new hero ───────────────────────────────────────────────────
 *
 *   1. Add the hero to heroRoster.ts (LAUNCH_ROSTER) OR gacha.ts (GACHA_HEROES).
 *   2. Add the hero's battle sprite PNG to assets/heroes/battle/.
 *   3. Add an entry to BATTLE_SPRITES in HeroBattleSprites.ts.
 *   Running this script (or `npm run validate`) will confirm all three are in sync.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── file paths ───────────────────────────────────────────────────────────────

const ROOT         = path.resolve(__dirname, '..');
const ROSTER_FILE  = path.join(ROOT, 'src', 'game', 'heroRoster.ts');
const GACHA_FILE   = path.join(ROOT, 'src', 'game', 'gacha.ts');
const SPRITES_FILE = path.join(ROOT, 'src', 'components', 'HeroBattleSprites.ts');


// The sprites file uses require() paths relative to its own location.
const SPRITES_DIR  = path.dirname(SPRITES_FILE);

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Read a file and return its text, or throw with a helpful message. */
function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: File not found: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, 'utf8');
}

// ─── parse hero IDs from heroRoster.ts ───────────────────────────────────────
// Matches lines like:    id: 'wardlight_apprentice',
// (4-space indent used inside the LAUNCH_ROSTER array objects)

function parseRosterIds(src) {
  const ids = [];
  for (const m of src.matchAll(/^    id:\s*'([^']+)'/gm)) {
    ids.push(m[1]);
  }
  return ids;
}

// ─── parse heroId values from gacha.ts ───────────────────────────────────────
// Matches lines like:    heroId: 'novice_guardian',

function parseGachaHeroIds(src) {
  const ids = [];
  for (const m of src.matchAll(/heroId:\s*'([^']+)'/g)) {
    ids.push(m[1]);
  }
  return ids;
}

// ─── parse BATTLE_SPRITES from HeroBattleSprites.ts ──────────────────────────
// Returns:
//   { keys: string[], requires: Map<string, string> }
//     keys      — every sprite key defined (e.g. 'wardlight_apprentice')
//     requires  — key → resolved absolute file path of the PNG

function parseSpritesFile(src) {
  const keys = [];
  const requires = new Map();

  // Match lines like:
  //   wardlight_apprentice: require('../../assets/heroes/battle/wardlight_apprentice.png'),
  //   florence_nightingale:  require('../../assets/images/nightingale_battle_sprite.png'),
  const lineRe = /^\s+([a-z][a-z0-9_]+)\s*:\s*require\(['"]([^'"]+)['"]\)/gm;

  for (const m of src.matchAll(lineRe)) {
    const key      = m[1];
    const reqPath  = m[2];
    const absPath  = path.resolve(SPRITES_DIR, reqPath);
    keys.push(key);
    requires.set(key, absPath);
  }

  return { keys, requires };
}

// ─── main ─────────────────────────────────────────────────────────────────────

function main() {
  const rosterSrc  = readFile(ROSTER_FILE);
  const gachaSrc   = readFile(GACHA_FILE);
  const spritesSrc = readFile(SPRITES_FILE);

  const rosterIds  = parseRosterIds(rosterSrc);
  const gachaIds   = parseGachaHeroIds(gachaSrc);
  const { keys: spriteKeys, requires: spriteRequires } = parseSpritesFile(spritesSrc);

  // Union of all hero IDs that need a battle sprite — deduplicated.
  const allHeroIds = [...new Set([...rosterIds, ...gachaIds])];

  const spriteKeySet = new Set(spriteKeys);

  let errors = 0;

  // ── Check A: every hero ID has a sprite entry ────────────────────────────
  console.log('\n[check:battle-sprites] Check A — sprite entry exists in HeroBattleSprites.ts');

  const missingEntry = allHeroIds.filter(id => !spriteKeySet.has(id));

  if (missingEntry.length === 0) {
    console.log(`  ✓ All ${allHeroIds.length} hero IDs have a sprite entry.`);
  } else {
    console.error(`  ✗ ${missingEntry.length} hero(es) missing a BATTLE_SPRITES entry:`);
    for (const id of missingEntry) {
      console.error(`      - ${id}`);
    }
    errors += missingEntry.length;
  }

  // ── Check B: every PNG path referenced in BATTLE_SPRITES exists on disk ─
  console.log('\n[check:battle-sprites] Check B — PNG files exist on disk');

  const missingFile = [];
  for (const [key, absPath] of spriteRequires.entries()) {
    if (!fs.existsSync(absPath)) {
      missingFile.push({ key, absPath });
    }
  }

  if (missingFile.length === 0) {
    console.log(`  ✓ All ${spriteRequires.size} sprite PNG files exist on disk.`);
  } else {
    console.error(`  ✗ ${missingFile.length} sprite PNG file(s) missing on disk:`);
    for (const { key, absPath } of missingFile) {
      console.error(`      - ${key} → ${path.relative(ROOT, absPath)}`);
    }
    errors += missingFile.length;
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('');
  if (errors === 0) {
    console.log('[check:battle-sprites] ✓ All checks passed.');
    process.exit(0);
  } else {
    console.error(`[check:battle-sprites] ✗ ${errors} error(s) found.`);
    console.error('');
    console.error('  To fix a missing sprite entry:');
    console.error('    1. Add the PNG to frontend/assets/heroes/battle/<heroId>.png');
    console.error('    2. Add an entry to BATTLE_SPRITES in');
    console.error('       frontend/src/components/HeroBattleSprites.ts');
    process.exit(1);
  }
}

main();
