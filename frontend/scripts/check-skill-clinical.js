#!/usr/bin/env node
/**
 * check-skill-clinical.js
 *
 * Validates that every hero skill id has a matching entry in the SKILL_CLINICAL
 * registry (frontend/src/game/clinical.ts).
 *
 * The console.warn in battle.ts catches missing entries at runtime, but only
 * when a battle is actually played.  This script catches gaps at dev/CI time
 * the moment a new hero or skill is added, rather than after QA plays through.
 *
 * ── Sources ───────────────────────────────────────────────────────────────────
 *
 *   content.ts   (HEROES)        — starter + prologue heroes; checked as ERRORS
 *   heroRoster.ts (LAUNCH_ROSTER) — full roster; checked as WARNINGS only
 *
 *   content.ts is the primary gate because those heroes are used in the guided
 *   tutorial and early chapters where missing clinical metadata has the most
 *   visible gameplay impact.  heroRoster.ts coverage is surfaced as warnings so
 *   the debt is visible without breaking CI while backfilling is in progress.
 *
 * ── Registry ─────────────────────────────────────────────────────────────────
 *
 *   frontend/src/game/clinical.ts — SKILL_CLINICAL record
 *
 * ── Exit codes ───────────────────────────────────────────────────────────────
 *
 *   0 — no errors (content.ts skills fully covered; roster warnings are OK)
 *   1 — one or more content.ts skill ids are missing from SKILL_CLINICAL
 *
 * ── How to run ───────────────────────────────────────────────────────────────
 *
 *   node frontend/scripts/check-skill-clinical.js
 *   npm run check:skill-clinical    (from frontend/)
 *
 * ── When to run ──────────────────────────────────────────────────────────────
 *
 *   After adding or editing any hero in content.ts or heroRoster.ts, or after
 *   adding entries to SKILL_CLINICAL in clinical.ts.  Runs automatically as
 *   part of the validate workflow so CI catches regressions in the starter
 *   roster before they ship.
 *
 *   To promote heroRoster.ts gaps to errors once backfilling is complete,
 *   change ROSTER_ERRORS = false to true at the top of this file.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── configuration ─────────────────────────────────────────────────────────────

/**
 * When true, missing heroRoster.ts entries are also treated as errors (exit 1).
 * Keep false until SKILL_CLINICAL has been backfilled for the full roster.
 */
const ROSTER_ERRORS = false;

// ── file paths ────────────────────────────────────────────────────────────────

const ROOT          = path.resolve(__dirname, '..');
const CONTENT_FILE  = path.join(ROOT, 'src', 'game', 'content.ts');
const ROSTER_FILE   = path.join(ROOT, 'src', 'game', 'heroRoster.ts');
const CLINICAL_FILE = path.join(ROOT, 'src', 'game', 'clinical.ts');

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract every skill id from the `skills: [...]` arrays in a TypeScript file.
 * Uses a bracket-balanced split so only ids inside skill arrays are collected,
 * not ids from chapter, building, codex, or other objects.
 *
 * @param {string} filePath
 * @returns {string[]} sorted, deduplicated skill ids
 */
function extractSkillIds(filePath) {
  const txt = fs.readFileSync(filePath, 'utf8');
  const ids = new Set();

  // Split on every occurrence of "skills: [" and process each block
  const parts = txt.split(/\bskills\s*:\s*\[/);

  for (let i = 1; i < parts.length; i++) {
    // Walk forward counting brackets to find the matching "]"
    let depth = 1;
    let j     = 0;
    while (j < parts[i].length && depth > 0) {
      const ch = parts[i][j];
      if (ch === '[') depth++;
      else if (ch === ']') depth--;
      j++;
    }
    const block = parts[i].slice(0, j);

    // Pull every  id: 'xxx'  from this block
    for (const m of block.matchAll(/\bid\s*:\s*'([^']+)'/g)) {
      ids.add(m[1]);
    }
  }

  return [...ids].sort();
}

/**
 * Extract every top-level key from the SKILL_CLINICAL record in clinical.ts.
 *
 * @returns {Set<string>}
 */
function extractClinicalKeys() {
  const txt = fs.readFileSync(CLINICAL_FILE, 'utf8');

  const blockMatch = txt.match(/SKILL_CLINICAL[^=]+=\s*\{([\s\S]*?)^};/m);
  if (!blockMatch) {
    console.error('✗  Could not locate SKILL_CLINICAL in', CLINICAL_FILE);
    console.error('   Ensure the record ends with "};" at the start of a line.');
    process.exit(1);
  }

  const keys = new Set();
  for (const m of blockMatch[1].matchAll(/^\s{2}([a-z_][a-z0-9_]*)\s*:\s*\{/gm)) {
    keys.add(m[1]);
  }
  return keys;
}

// ── main ──────────────────────────────────────────────────────────────────────

function main() {
  // 1. Collect skill ids from each source
  const contentIds = extractSkillIds(CONTENT_FILE);
  const rosterIds  = extractSkillIds(ROSTER_FILE);

  // Roster-only ids are those in heroRoster.ts but not already in content.ts
  const contentSet  = new Set(contentIds);
  const rosterOnly  = rosterIds.filter(id => !contentSet.has(id));

  // 2. Load SKILL_CLINICAL keys
  const clinicalKeys = extractClinicalKeys();

  // 3. Find gaps
  const contentMissing = contentIds.filter(id => !clinicalKeys.has(id));
  const rosterMissing  = rosterOnly.filter(id => !clinicalKeys.has(id));

  // 4. Report
  console.log('── Care Pathway registry check ─────────────────────────────────');
  console.log(`   content.ts  skills   : ${contentIds.length}  (hard gate)`);
  console.log(`   heroRoster.ts skills : ${rosterOnly.length} additional  (warnings)`);
  console.log(`   SKILL_CLINICAL keys  : ${clinicalKeys.size}`);
  console.log('');

  let hasErrors = false;

  // content.ts gaps → errors
  if (contentMissing.length > 0) {
    hasErrors = true;
    console.error(`✗  ${contentMissing.length} content.ts skill id(s) missing from SKILL_CLINICAL:\n`);
    for (const id of contentMissing) {
      console.error(`     ${id}`);
    }
    console.error('');
    console.error('   Add a matching entry to SKILL_CLINICAL in clinical.ts for each id');
    console.error('   above.  Minimum shape: { clinicalTags, pathwayRoles, diseaseCategory }');
    console.error('');
  } else {
    console.log(`✓  All ${contentIds.length} content.ts skill ids have a SKILL_CLINICAL entry.`);
  }

  // heroRoster.ts gaps → warnings (or errors when ROSTER_ERRORS = true)
  if (rosterMissing.length > 0) {
    const tag = ROSTER_ERRORS ? '✗ ' : '⚠ ';
    const kind = ROSTER_ERRORS ? 'error' : 'warning';
    console.log('');
    console.log(`${tag} ${rosterMissing.length} heroRoster.ts skill id(s) missing from SKILL_CLINICAL (${kind}):`);
    for (const id of rosterMissing) {
      console.log(`     ${id}`);
    }
    console.log('');
    console.log('   These are warnings — they do not fail CI.  Add SKILL_CLINICAL entries');
    console.log('   for each id above to enable full clinical-pathway support for those');
    console.log('   heroes.  Set ROSTER_ERRORS = true in this script to promote to errors');
    console.log('   once backfilling is complete.');
    if (ROSTER_ERRORS) hasErrors = true;
  } else {
    console.log(`✓  All heroRoster.ts skill ids have a SKILL_CLINICAL entry.`);
  }

  console.log('');
  process.exit(hasErrors ? 1 : 0);
}

main();
