#!/usr/bin/env node
/**
 * check-dead-assets.js
 *
 * Scans every TypeScript/JavaScript/TSX/JSX source file under
 * frontend/src/ and frontend/app/ and extracts every
 * require('../assets/...') or require('../../assets/...') call
 * (i.e. any require whose path contains '/assets/').
 *
 * For each found path it resolves the absolute location relative to the
 * source file that contains the call, then confirms the file exists on
 * disk.  Any path that cannot be resolved exits the script with code 1
 * so CI catches the regression immediately.
 *
 * Algorithm
 * ─────────
 * 1. Walk frontend/src/ and frontend/app/ recursively; collect .ts/.tsx/.js/.jsx files.
 * 2. For each file, extract all require(…) calls whose argument contains '/assets/'.
 * 3. Resolve the path relative to the file's directory.
 * 4. Report every path that does NOT exist on disk.
 * 5. Exit 1 if any missing paths were found, 0 otherwise.
 *
 * Exits 0 — all asset require() calls resolve to a real file.
 * Exits 1 — one or more referenced asset files are missing from disk.
 *
 * ── How to run ────────────────────────────────────────────────────────────────
 *
 *   Locally (from project root):
 *     node frontend/scripts/check-dead-assets.js
 *
 *   As an npm script (from frontend/):
 *     npm run check:dead-assets
 *
 *   Automatically runs as part of:
 *     npm run validate
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── config ──────────────────────────────────────────────────────────────────

const FRONTEND_DIR = path.resolve(__dirname, '..');

/** Source directories to scan for require() calls. */
const SCAN_DIRS = [
  path.join(FRONTEND_DIR, 'src'),
  path.join(FRONTEND_DIR, 'app'),
];

/** Only examine files with these extensions. */
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

/**
 * A require() argument is flagged for checking only when it contains '/assets/'
 * anywhere in the path.  This focuses the check on bundled static assets
 * (images, fonts, etc.) and avoids false positives from module imports.
 */
const ASSET_PATH_MARKER = '/assets/';

/**
 * Path alias map matching tsconfig.json "paths".
 * Keys are alias prefixes (without trailing '*'); values are the absolute
 * directory they expand to.
 *
 * '@/' → frontend/ root  (i.e. "@/*": ["./*"] in tsconfig.json)
 */
const PATH_ALIASES = {
  '@/': FRONTEND_DIR + path.sep,
};

// ─── walk ─────────────────────────────────────────────────────────────────────

/**
 * Recursively collect every file under `dir` whose extension is in EXTENSIONS.
 * @param {string} dir
 * @returns {string[]} Absolute file paths.
 */
function walkDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

// ─── extract require() paths ──────────────────────────────────────────────────

/**
 * Extract every require(…) argument from a source string that contains
 * '/assets/' anywhere in the path.
 *
 * Handles single-quoted, double-quoted, and backtick-quoted strings.
 * Does NOT handle computed / template-literal paths — those are ignored
 * (they cannot be statically resolved).
 *
 * @param {string} src
 * @returns {string[]}
 */
function extractAssetRequires(src) {
  // Match: require('...') / require("...") / require(`...`)
  const RE = /require\(\s*(['"`])([^'"`\n]+)\1\s*\)/g;
  const paths = [];
  let m;
  while ((m = RE.exec(src)) !== null) {
    const p = m[2];
    if (p.includes(ASSET_PATH_MARKER)) {
      paths.push(p);
    }
  }
  return paths;
}

// ─── main ─────────────────────────────────────────────────────────────────────

function main() {
  // 1. Collect source files.
  const sourceFiles = [];
  for (const dir of SCAN_DIRS) {
    sourceFiles.push(...walkDir(dir));
  }

  if (sourceFiles.length === 0) {
    console.error('✗ check-dead-assets: no source files found under src/ or app/.');
    process.exit(1);
  }

  // 2 & 3. For each file, extract and resolve asset requires.
  /** @type {Array<{sourceFile: string, requirePath: string, absPath: string}>} */
  const missing = [];
  let totalChecked = 0;

  for (const srcFile of sourceFiles) {
    let src;
    try {
      src = fs.readFileSync(srcFile, 'utf8');
    } catch {
      // Unreadable file — skip silently (not an asset reference issue).
      continue;
    }

    const assetPaths = extractAssetRequires(src);
    const fileDir    = path.dirname(srcFile);

    for (const relPath of assetPaths) {
      // Resolve path aliases (e.g. '@/' → frontend root) before resolving
      // relative to the containing file's directory.
      let absPath;
      let matched = false;
      for (const [prefix, rootDir] of Object.entries(PATH_ALIASES)) {
        if (relPath.startsWith(prefix)) {
          absPath = path.join(rootDir, relPath.slice(prefix.length));
          matched = true;
          break;
        }
      }
      if (!matched) {
        absPath = path.resolve(fileDir, relPath);
      }
      totalChecked++;

      if (!fs.existsSync(absPath)) {
        missing.push({
          sourceFile:  path.relative(FRONTEND_DIR, srcFile),
          requirePath: relPath,
          absPath:     path.relative(FRONTEND_DIR, absPath),
        });
      }
    }
  }

  // 4. Report.
  if (missing.length === 0) {
    console.log(
      `✓ check-dead-assets: all ${totalChecked} asset require() reference(s) across` +
      ` ${sourceFiles.length} file(s) resolve to a real file on disk.`
    );
    process.exit(0);
  }

  console.error(
    `\n✗ check-dead-assets: ${missing.length} asset require() reference(s) point to` +
    ` a file that does not exist on disk:\n`
  );

  for (const { sourceFile, requirePath, absPath } of missing) {
    console.error(`  Source : ${sourceFile}`);
    console.error(`  require: ${requirePath}`);
    console.error(`  Looked : ${absPath}`);
    console.error('');
  }

  console.error(
    'Fix: either restore the missing asset file under frontend/assets/,\n' +
    '     or update/remove the stale require() in the source file listed above.'
  );

  process.exit(1);
}

main();
