#!/usr/bin/env node
/**
 * check-hero-pronouns.js
 *
 * Validates that hero lore text uses pronouns consistent with the hero's declared gender.
 *
 * ── Sources ──────────────────────────────────────────────────────────────────
 *
 *   heroRoster.ts  (LAUNCH_ROSTER)
 *     Each hero has an explicit `gender: 'female'|'male'|'nonbinary'` field.
 *     Fields checked for mismatches: description, quote.
 *
 *   content.ts  (HEROES)
 *     No `gender` field on the Hero type.  Gender is inferred from the
 *     dominant pronoun count across description + quote + backstory + all
 *     starLore text.
 *
 *     For inferred-gender heroes, only description, quote, and backstory are
 *     tested for mismatches.  starLore prose is intentionally excluded from
 *     the mismatch check because it naturally references other characters
 *     (mentors, patients, colleagues) who have their own pronouns.
 *
 *     If a hero has an explicit `gender` field in content.ts (possible future
 *     state), ALL text fields are tested for mismatches just like roster heroes.
 *
 * ── Rules ────────────────────────────────────────────────────────────────────
 *
 *   female    → she / her / hers / herself are expected.
 *               he / him / his / himself are mismatches.
 *
 *   male      → he / him / his / himself are expected.
 *               she / her / hers / herself are mismatches.
 *
 *   nonbinary → they / them / their / theirs / themselves are expected.
 *               he / him / his / himself / she / her / hers / herself are
 *               mismatches.
 *
 * ── Exit codes ───────────────────────────────────────────────────────────────
 *
 *   0  — no mismatches found.
 *   1  — one or more mismatches found.
 *
 * ── How to run ───────────────────────────────────────────────────────────────
 *
 *   node frontend/scripts/check-hero-pronouns.js
 *   npm run check:pronouns          (from frontend/)
 *
 * ── When to run ──────────────────────────────────────────────────────────────
 *
 *   After adding or editing any hero in heroRoster.ts or content.ts.
 *   Run manually or wire into a CI workflow to catch regressions before they
 *   ship.  Exits non-zero on any violation so it integrates cleanly as a
 *   validation step.
 *
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── file paths ───────────────────────────────────────────────────────────────

const ROOT         = path.resolve(__dirname, '..');
const ROSTER_FILE  = path.join(ROOT, 'src', 'game', 'heroRoster.ts');
const CONTENT_FILE = path.join(ROOT, 'src', 'game', 'content.ts');

// ─── pronoun word lists ───────────────────────────────────────────────────────

const FEMALE_PRONOUNS = ['she', 'her', 'hers', 'herself'];
const MALE_PRONOUNS   = ['he', 'him', 'his', 'himself'];
const NB_PRONOUNS     = ['they', 'them', 'their', 'theirs', 'themselves'];

/** Build a whole-word case-insensitive regex for a list of pronouns. */
function buildRegex(pronouns) {
  const sorted = [...pronouns].sort((a, b) => b.length - a.length);
  return new RegExp(`\\b(${sorted.join('|')})\\b`, 'gi');
}

const FEMALE_RE = buildRegex(FEMALE_PRONOUNS);
const MALE_RE   = buildRegex(MALE_PRONOUNS);
const NB_RE     = buildRegex(NB_PRONOUNS);

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Count all whole-word occurrences of a regex in text. Resets lastIndex. */
function countMatches(re, text) {
  re.lastIndex = 0;
  let n = 0;
  for (const _ of text.matchAll(re)) n++;
  return n;
}

/**
 * Return an array of { pronoun, snippet } for every cross-gender pronoun found
 * in text.  Deduplicates by pronoun so only the first occurrence is reported.
 *
 * @param {'female'|'male'|'nonbinary'} gender
 * @param {string} text
 */
function findMismatches(gender, text) {
  let wrongRe;
  if (gender === 'female')    wrongRe = buildRegex(MALE_PRONOUNS);
  else if (gender === 'male') wrongRe = buildRegex(FEMALE_PRONOUNS);
  else                        wrongRe = buildRegex([...MALE_PRONOUNS, ...FEMALE_PRONOUNS]);

  const seen = new Set();
  const results = [];
  for (const m of text.matchAll(wrongRe)) {
    const pronoun = m[1].toLowerCase();
    if (seen.has(pronoun)) continue;
    seen.add(pronoun);
    const start   = Math.max(0, m.index - 20);
    const end     = Math.min(text.length, m.index + m[1].length + 20);
    const snippet = '…' + text.slice(start, end).replace(/\n/g, ' ') + '…';
    results.push({ pronoun, snippet });
  }
  return results;
}

/**
 * Infer gender from pronoun dominance across text.
 * "they" and "them" are weighted 2× to reduce noise from generic plural use.
 * Returns null if no gendered pronouns are found.
 *
 * @param {string} allText
 * @returns {'female'|'male'|'nonbinary'|null}
 */
function inferGender(allText) {
  const f  = countMatches(FEMALE_RE, allText);
  const m  = countMatches(MALE_RE,   allText);
  let nb = 0;
  for (const hit of allText.matchAll(NB_RE)) {
    const w = hit[1].toLowerCase();
    nb += (w === 'they' || w === 'them') ? 2 : 1;
  }
  if (f === 0 && m === 0 && nb === 0) return null;
  if (f >= m && f >= nb) return 'female';
  if (m >= f && m >= nb) return 'male';
  return 'nonbinary';
}

/**
 * Extract the inline string value from a line containing `fieldName: '...'`
 * or `fieldName: "..."`.  Handles basic backslash-escaped quotes.
 * Returns null if the field is not found on this line.
 */
function extractInlineString(line, fieldName) {
  const re = new RegExp(
    `\\b${fieldName}\\s*:\\s*` +
    `(?:'((?:[^'\\\\]|\\\\.)*)'|"((?:[^"\\\\]|\\\\.)*)")`,
  );
  const m = re.exec(line);
  if (!m) return null;
  return (m[1] !== undefined ? m[1] : m[2])
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"');
}

// ─── parser ───────────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   id:     string,
 *   gender: string|null,
 *   checkFields:  {name: string, text: string}[],   // for mismatch checking
 *   inferFields:  {name: string, text: string}[],   // only for gender inference
 * }} HeroRecord
 */

/**
 * Parse heroRoster.ts or content.ts and return one HeroRecord per hero.
 *
 * `checkFieldNames`  — fields whose values are BOTH used for inference AND
 *                      checked for mismatches.
 * `inferOnlyFields`  — fields whose values are used ONLY for inference
 *                      (starLore in content.ts heroes without a declared gender).
 *
 * @param {string}   filePath
 * @param {string[]} checkFieldNames
 * @param {string[]} inferOnlyFieldNames
 * @returns {HeroRecord[]}
 */
function parseHeroes(filePath, checkFieldNames, inferOnlyFieldNames = []) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  /** @type {HeroRecord[]} */
  const heroes = [];
  /** @type {HeroRecord|null} */
  let cur = null;
  let inSkills   = false;
  let inStarLore = false;

  for (const line of lines) {
    // ── Detect start of a new hero object (id: not inside a skill) ─────────
    const idMatch = line.match(/^\s+id:\s*['"]([^'"]+)['"]/);
    if (idMatch && !inSkills) {
      if (cur) heroes.push(cur);
      cur = { id: idMatch[1], gender: null, checkFields: [], inferFields: [] };
      inStarLore = false;
      inSkills   = false;
    }
    if (!cur) continue;

    // ── Track skills / starLore array boundaries ───────────────────────────
    if (/^\s+skills\s*:\s*\[/.test(line))    inSkills   = true;
    if (/^\s+starLore\s*:\s*\[/.test(line))  inStarLore = true;
    // Array closes at indent level of the hero object (~4 spaces)
    if (inSkills   && /^\s{4}\]/.test(line)) inSkills   = false;
    if (inStarLore && /^\s{4}\]/.test(line)) inStarLore = false;

    if (inSkills) continue; // skip skill object fields entirely

    // ── gender ────────────────────────────────────────────────────────────
    if (cur.gender === null) {
      const gm = line.match(/^\s+gender\s*:\s*['"](\w+)['"]/);
      if (gm) cur.gender = gm[1];
    }

    // ── named check fields (description, quote, backstory …) ─────────────
    if (!inStarLore) {
      for (const fn of checkFieldNames) {
        if (line.includes(`${fn}:`)) {
          const val = extractInlineString(line, fn);
          if (val) cur.checkFields.push({ name: fn, text: val });
        }
      }
    }

    // ── starLore text / title  (infer-only unless hero has declared gender) ─
    if (inStarLore) {
      for (const fn of ['text', 'title', ...inferOnlyFieldNames]) {
        if (line.includes(`${fn}:`) && !line.includes(`${fn}: string`)) {
          const val = extractInlineString(line, fn);
          if (val) cur.inferFields.push({ name: `starLore.${fn}`, text: val });
        }
      }
    }
  }
  if (cur) heroes.push(cur);
  return heroes;
}

// ─── checker ──────────────────────────────────────────────────────────────────

/**
 * Run the pronoun check on one set of heroes.
 *
 * @param {HeroRecord[]} heroes
 * @param {object} opts
 * @param {boolean} opts.checkStarLore  When true AND the hero has a declared
 *   gender, also check inferFields (starLore) for mismatches.
 * @returns {number}  Number of violations found.
 */
function checkHeroes(heroes, { checkStarLore = false } = {}) {
  let violations = 0;

  for (const hero of heroes) {
    // Determine effective gender for this hero
    const inferText = [
      ...hero.checkFields,
      ...hero.inferFields,
    ].map(f => f.text).join(' ');

    const gender = hero.gender ?? inferGender(inferText);
    if (!gender) continue; // no gendered pronouns anywhere — skip

    // Which fields to actually check for mismatches
    const toCheck = [...hero.checkFields];
    if (checkStarLore && hero.gender) {
      // Only extend to starLore if gender was explicitly declared
      toCheck.push(...hero.inferFields);
    }

    for (const { name: fieldName, text } of toCheck) {
      const mismatches = findMismatches(gender, text);
      for (const { pronoun, snippet } of mismatches) {
        const gLabel = hero.gender
          ? `declared=${hero.gender}`
          : `inferred=${gender}`;
        console.error(
          `  MISMATCH  id=${hero.id}  ${gLabel}  field=${fieldName}` +
          `\n            pronoun "${pronoun}" in: ${snippet}`,
        );
        violations++;
      }
    }
  }
  return violations;
}

// ─── main ─────────────────────────────────────────────────────────────────────

function main() {
  let violations = 0;

  // ── 1. heroRoster.ts — explicit gender, check description + quote ────────
  console.log('── heroRoster.ts (LAUNCH_ROSTER) ──────────────────────────────');
  const rosterHeroes = parseHeroes(ROSTER_FILE, ['description', 'quote'], []);
  // heroRoster heroes have no starLore, so checkStarLore has no effect
  const rosterViolations = checkHeroes(rosterHeroes, { checkStarLore: true });
  const rosterChecked    = rosterHeroes.filter(h => h.gender).length;
  violations += rosterViolations;

  if (rosterViolations === 0) {
    console.log(`  ✓  ${rosterChecked} heroes checked — no mismatches\n`);
  } else {
    console.log('');
  }

  // ── 2. content.ts — description/quote/backstory checked; ────────────────
  //    starLore used only for gender inference (not mismatch checks) for
  //    heroes without an explicit gender field.
  console.log('── content.ts (HEROES) ─────────────────────────────────────────');
  const contentHeroes = parseHeroes(
    CONTENT_FILE,
    ['description', 'quote', 'backstory'],
    [], // inferOnlyFieldNames — starLore text/title are parsed inside parseHeroes automatically
  );
  const contentViolations = checkHeroes(contentHeroes, {
    // If a content.ts hero ever gains a declared gender, extend the check to
    // starLore for that hero only.
    checkStarLore: true,
  });
  const inferCount   = contentHeroes.filter(h => !h.gender && inferGender(
    [...h.checkFields, ...h.inferFields].map(f => f.text).join(' ')
  ) !== null).length;
  const declaredCount = contentHeroes.filter(h => h.gender).length;
  const skipped       = contentHeroes.length - inferCount - declaredCount;
  violations += contentViolations;

  if (contentViolations === 0) {
    const detail = [
      declaredCount && `${declaredCount} declared`,
      inferCount    && `${inferCount} inferred`,
      skipped       && `${skipped} skipped (no pronouns)`,
    ].filter(Boolean).join(', ');
    console.log(`  ✓  ${contentHeroes.length} heroes (${detail}) — no mismatches\n`);
    console.log('  Note: starLore prose is excluded from mismatch checks for inferred-');
    console.log('  gender heroes because it freely references mentors, patients, and');
    console.log('  colleagues with their own pronouns.\n');
  } else {
    console.log('');
  }

  // ── 3. Summary ───────────────────────────────────────────────────────────
  const totalChecked = rosterChecked + contentHeroes.length;
  if (violations === 0) {
    console.log(`✓  All ${totalChecked} heroes passed pronoun consistency check.`);
    process.exit(0);
  } else {
    console.error(`✗  ${violations} pronoun mismatch(es) found across ${totalChecked} heroes.`);
    console.error('   Fix the lore text or correct the hero\'s gender field, then re-run.');
    process.exit(1);
  }
}

main();
