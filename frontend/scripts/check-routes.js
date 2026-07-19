#!/usr/bin/env node
/**
 * check-routes.js
 *
 * Two-way cross-reference between ROUTES in frontend/src/game/routes.ts
 * and screen files in frontend/app/.
 *
 * Check A — stale constants  (original check)
 *   Every static route string declared in routes.ts must resolve to a real
 *   file in frontend/app/.
 *
 * Check B — orphan screens  (new reverse check)
 *   Every navigable screen file in frontend/app/ must have a matching value
 *   in routes.ts.
 *   Exempt from this check:
 *     - _layout.tsx, +html.tsx  (framework files, not navigable screens)
 *     - index.tsx               (parent folder path already appears in ROUTES)
 *     - [param].tsx / [param]/  (dynamic segments; covered by dynRoute helpers)
 *
 * Exits 0  — both checks pass.
 * Exits 1  — one or more violations found.
 *
 * ── How to run ────────────────────────────────────────────────────────────────
 *
 *   Locally (from project root):
 *     node frontend/scripts/check-routes.js
 *
 *   As an npm script (from frontend/):
 *     npm run check:routes
 *
 *   In Replit CI:
 *     The "Check Routes" workflow runs this script automatically.
 *     It exits non-zero on any violation, blocking bad merges.
 *     Restart it after adding/removing screen files or route constants.
 *
 *   When you add a new screen (frontend/app/…):
 *     → Add a matching constant to ROUTES in frontend/src/game/routes.ts
 *
 *   When you remove a screen:
 *     → Remove or update the corresponding constant in routes.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const APP_DIR   = path.join(ROOT, 'app');
const ROUTES_TS = path.join(ROOT, 'src', 'game', 'routes.ts');

// ── 1. Walk frontend/app/ — two passes ──────────────────────────────────────
//
// Rules mirroring Expo Router's file-based conventions:
//   app/foo.tsx              → /foo
//   app/foo/index.tsx        → /foo
//   app/(tabs)/foo.tsx       → /(tabs)/foo
//   app/(tabs)/index.tsx     → /(tabs)
//   app/foo/[id].tsx         → /foo/[id]   (kept as a glob for check A matching)
//   _layout.tsx, +html.tsx   → ignored (not navigable routes)

/**
 * Full walk — includes dynamic segments, excludes layout/html.
 * Used for Check A (stale-constant resolution).
 */
function walkAppDir(dir, prefix) {
  const knownRoutes = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = entry.name;

    // Skip framework/layout files
    if (name.startsWith('+') || name.startsWith('_')) continue;

    const fullPath = path.join(dir, name);
    const segment  = name.replace(/\.(tsx?|jsx?)$/, '');

    if (entry.isDirectory()) {
      knownRoutes.push(...walkAppDir(fullPath, `${prefix}/${name}`));
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      const routePath = segment === 'index'
        ? (prefix || '/')
        : `${prefix}/${segment}`;
      knownRoutes.push(routePath);
    }
  }

  return knownRoutes;
}

/**
 * Orphan walk — excludes dynamic segments AND index files in addition to
 * framework files. Only static, non-index screen files are candidates for
 * Check B (orphan-screen detection).
 */
function walkOrphanCandidates(dir, prefix) {
  const candidates = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = entry.name;

    // Skip framework/layout files
    if (name.startsWith('+') || name.startsWith('_')) continue;

    const fullPath = path.join(dir, name);
    const segment  = name.replace(/\.(tsx?|jsx?)$/, '');

    if (entry.isDirectory()) {
      // Skip dynamic segment directories like [id]/
      if (name.startsWith('[') && name.endsWith(']')) continue;
      candidates.push(...walkOrphanCandidates(fullPath, `${prefix}/${name}`));
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      // Skip index files (parent folder path already appears in ROUTES)
      if (segment === 'index') continue;
      // Skip dynamic segment files like [id].tsx
      if (segment.startsWith('[') && segment.endsWith(']')) continue;

      candidates.push(`${prefix}/${segment}`);
    }
  }

  return candidates;
}

const knownRouteSet      = new Set(walkAppDir(APP_DIR, ''));
const orphanCandidates   = walkOrphanCandidates(APP_DIR, '');

// ── 2. Extract static route strings from routes.ts ───────────────────────────
//
// We look for every quoted string that starts with "/" in the file.
// We strip query-string suffixes (e.g. ?sceneId=…) before comparing because
// those are runtime parameters, not file-system paths.

const src = fs.readFileSync(ROUTES_TS, 'utf8');

// Match strings assigned to AppRoute variables or object values, e.g.:
//   const FOO: AppRoute = "/foo/bar";
//   modeWardDefense: "/mode/ward-defense" as AppRoute,
//   universityLotusLessonHydration: "/university/lotus-lesson/recognizing-cues-hydration" as AppRoute,
const STRING_RE = /["'](\/?[a-zA-Z0-9_()\-\/\[\]]+)["']/g;

const candidateRoutes = new Set();
let m;
while ((m = STRING_RE.exec(src)) !== null) {
  const s = m[1].split('?')[0]; // drop query params
  if (s.startsWith('/')) candidateRoutes.add(s);
}

// ── 3. Check A: does each ROUTES constant resolve to a real file? ─────────────
//
// Match strategy (in order):
//   a) Exact match against knownRouteSet.
//   b) Segment-by-segment match where any filesystem [param] segment is a wildcard.

function resolves(route) {
  if (knownRouteSet.has(route)) return true;

  const routeParts = route.split('/').filter(Boolean);

  for (const known of knownRouteSet) {
    const knownParts = known.split('/').filter(Boolean);
    if (knownParts.length !== routeParts.length) continue;

    const allMatch = knownParts.every((kp, i) => {
      // Dynamic segment like [id] or [nodeId] matches anything
      if (kp.startsWith('[') && kp.endsWith(']')) return true;
      // Group segments like (tabs) match literally
      return kp === routeParts[i];
    });

    if (allMatch) return true;
  }

  return false;
}

const missing = [...candidateRoutes].filter(r => !resolves(r)).sort();

// ── 4. Check B: does each static screen file have a ROUTES entry? ─────────────
//
// For each orphan candidate route (static, non-index screen file) we check
// whether any value in candidateRoutes covers it.  A group-segment path like
// /(tabs)/codex is an exact match; we also allow matching where group
// parentheses are stripped (some ROUTES entries omit the group).

function isInRoutes(screenRoute) {
  // Direct exact match
  if (candidateRoutes.has(screenRoute)) return true;

  // Strip group-folder segments like (tabs) from the screen route and retry,
  // because ROUTES might omit the group prefix in some entries.
  const stripped = '/' + screenRoute.split('/').filter(Boolean)
    .filter(seg => !(seg.startsWith('(') && seg.endsWith(')')))
    .join('/');
  if (stripped !== screenRoute && candidateRoutes.has(stripped)) return true;

  // Also accept if a ROUTES value with group stripped matches this screen's
  // stripped path (handles symmetrical cases).
  for (const r of candidateRoutes) {
    const rStripped = '/' + r.split('/').filter(Boolean)
      .filter(seg => !(seg.startsWith('(') && seg.endsWith(')')))
      .join('/');
    if (rStripped === stripped && stripped !== '/') return true;
  }

  return false;
}

const orphans = orphanCandidates.filter(r => !isInRoutes(r)).sort();

// ── 5. Report ─────────────────────────────────────────────────────────────────

let exitCode = 0;

if (missing.length === 0) {
  console.log(
    `✓ check-routes [A]: all ${candidateRoutes.size} route string(s) in routes.ts` +
    ` resolve to a real file in app/.`
  );
} else {
  exitCode = 1;
  console.error(
    `✗ check-routes [A]: ${missing.length} route string(s) in routes.ts` +
    ` have no matching file in app/:\n`
  );
  for (const r of missing) {
    console.error(`  ${r}`);
  }
  console.error(
    '\nFix: either rename/restore the file in frontend/app/, or update the' +
    ' constant in frontend/src/game/routes.ts.'
  );
}

if (orphans.length === 0) {
  console.log(
    `✓ check-routes [B]: all ${orphanCandidates.length} static screen file(s) in app/` +
    ` have a matching entry in routes.ts.`
  );
} else {
  exitCode = 1;
  console.error(
    `\n✗ check-routes [B]: ${orphans.length} screen file(s) in app/ have no` +
    ` matching entry in routes.ts:\n`
  );
  for (const r of orphans) {
    console.error(`  ${r}`);
  }
  console.error(
    '\nFix: add a constant for each path to ROUTES in frontend/src/game/routes.ts,' +
    '\nor if the screen is intentionally un-navigable, rename it to start with "_".'
  );
}

process.exit(exitCode);
