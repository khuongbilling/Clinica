#!/usr/bin/env node
/**
 * check-routes.js
 *
 * Cross-references every static ROUTES value declared in
 * frontend/src/game/routes.ts against the actual file-system tree under
 * frontend/app/.
 *
 * Exits 0  — all constants resolve to a real file.
 * Exits 1  — one or more constants have no matching file (stale after a rename
 *             or delete) and prints the offending paths.
 *
 * Add to CI / workflow:  node frontend/scripts/check-routes.js
 * Run as npm script:     cd frontend && npm run check:routes
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const APP_DIR   = path.join(ROOT, 'app');
const ROUTES_TS = path.join(ROOT, 'src', 'game', 'routes.ts');

// ── 1. Walk frontend/app/ and build the set of known route patterns ──────────
//
// Rules mirroring Expo Router's file-based conventions:
//   app/foo.tsx              → /foo
//   app/foo/index.tsx        → /foo
//   app/(tabs)/foo.tsx       → /(tabs)/foo
//   app/(tabs)/index.tsx     → /(tabs)
//   app/foo/[id].tsx         → /foo/[id]   (kept as a glob for matching below)
//   _layout.tsx, +html.tsx   → ignored (not navigable routes)

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

const knownRouteSet = new Set(walkAppDir(APP_DIR, ''));

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

// ── 3. Cross-reference: does each candidate route have a backing file? ───────
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

// ── 4. Report ─────────────────────────────────────────────────────────────────
if (missing.length === 0) {
  console.log(
    `✓ check-routes: all ${candidateRoutes.size} route strings in routes.ts` +
    ` resolve to a real file in app/.`
  );
  process.exit(0);
} else {
  console.error(
    `✗ check-routes: ${missing.length} route string(s) in routes.ts` +
    ` have no matching file in app/:\n`
  );
  for (const r of missing) {
    console.error(`  ${r}`);
  }
  console.error(
    '\nFix: either rename/restore the file in frontend/app/, or update the' +
    ' constant in frontend/src/game/routes.ts.'
  );
  process.exit(1);
}
