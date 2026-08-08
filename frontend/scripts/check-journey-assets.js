#!/usr/bin/env node
/**
 * check-journey-assets.js
 *
 * Verifies that every asset key declared in
 * frontend/src/game/journeyMap/assets.ts resolves to a real file under
 * frontend/public/assets/ui/journey/.
 *
 * Algorithm
 * ─────────
 * 1. Walk frontend/public/assets/ui/journey/ and collect every .webp path.
 * 2. Parse assets.ts with a simple regex to extract every require(…) string.
 * 3. Resolve each require path relative to the assets.ts file and check it
 *    exists on disk.
 * 4. Cross-check: warn about any disk files that have no matching require().
 *
 * Exits 0 — both checks pass.
 * Exits 1 — one or more violations found.
 *
 * ── How to run ────────────────────────────────────────────────────────────────
 *
 *   Locally (from project root):
 *     node frontend/scripts/check-journey-assets.js
 *
 *   As an npm script (from frontend/):
 *     npm run check:journey-assets
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const FRONTEND_DIR = path.resolve(__dirname, '..');
const ASSETS_TS    = path.join(FRONTEND_DIR, 'src', 'game', 'journeyMap', 'assets.ts');
const JOURNEY_DIR  = path.join(FRONTEND_DIR, 'public', 'assets', 'ui', 'journey');

// ── 1. Walk the on-disk asset directory ──────────────────────────────────────

function walkDir(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const diskFiles = new Set(walkDir(JOURNEY_DIR));

// ── 2. Extract require(…) paths from assets.ts ───────────────────────────────

const src = fs.readFileSync(ASSETS_TS, 'utf8');

// Match require('...') or require("...") — captures the inner string.
const REQUIRE_RE = /require\(\s*[`'"]([^`'"]+)[`'"]\s*\)/g;

const requiredPaths = [];
let m;
while ((m = REQUIRE_RE.exec(src)) !== null) {
  requiredPaths.push(m[1]);
}

if (requiredPaths.length === 0) {
  console.error('✗ check-journey-assets: no require() calls found in assets.ts.');
  process.exit(1);
}

// ── 3. Check A: every require() path resolves to a real file ─────────────────

const assetsDir = path.dirname(ASSETS_TS);
const missing   = [];
const resolvedSet = new Set();

for (const rel of requiredPaths) {
  const abs = path.resolve(assetsDir, rel);
  resolvedSet.add(abs);
  if (!fs.existsSync(abs)) {
    missing.push({ rel, abs });
  }
}

// ── 4. Check B: every disk file has a matching require() ─────────────────────

const unreferenced = [...diskFiles].filter(f => !resolvedSet.has(f)).sort();

// ── 5. Report ─────────────────────────────────────────────────────────────────

let exitCode = 0;

if (missing.length === 0) {
  console.log(
    `✓ check-journey-assets [A]: all ${requiredPaths.length} require() path(s) in assets.ts` +
    ` resolve to a real file on disk.`
  );
} else {
  exitCode = 1;
  console.error(
    `✗ check-journey-assets [A]: ${missing.length} require() path(s) in assets.ts` +
    ` have no matching file on disk:\n`
  );
  for (const { rel, abs } of missing) {
    console.error(`  require: ${rel}`);
    console.error(`  looked:  ${abs}\n`);
  }
  console.error(
    'Fix: either add the missing file under frontend/public/assets/ui/journey/,' +
    ' or correct the path in frontend/src/game/journeyMap/assets.ts.'
  );
}

if (unreferenced.length === 0) {
  console.log(
    `✓ check-journey-assets [B]: all ${diskFiles.size} file(s) in` +
    ` public/assets/ui/journey/ are referenced in assets.ts.`
  );
} else {
  // Warn but do not fail — a new asset may be added to disk before the index
  // is updated, and that order of operations should not break CI.
  console.warn(
    `\n⚠ check-journey-assets [B]: ${unreferenced.length} file(s) in` +
    ` public/assets/ui/journey/ are not yet referenced in assets.ts:\n`
  );
  for (const f of unreferenced) {
    console.warn(`  ${path.relative(FRONTEND_DIR, f)}`);
  }
  console.warn(
    '\nAdd a key for each file in frontend/src/game/journeyMap/assets.ts.'
  );
}

process.exit(exitCode);
