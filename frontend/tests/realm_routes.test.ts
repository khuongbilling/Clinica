// realm_routes.test.ts
// Guards against silent route renames breaking realm building deep-links.
// Run: npx sucrase-node tests/realm_routes.test.ts

// __DEV__ is a React Native global; define it before any import that
// might reach validateRealmRoutes' error path (only accessed on failure).
(global as any).__DEV__ = true;

import { ROUTES, validateRealmRoutes } from '../src/game/routes';
import { REALM_BUILDINGS } from '../src/game/realm';

type Result = { name: string; pass: boolean; details?: string };
const results: Result[] = [];
function check(name: string, cond: boolean, details = '') {
  results.push({ name, pass: !!cond, details });
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${cond ? '' : ` :: ${details}`}`);
}

// ── 1. Every linkRoute in REALM_BUILDINGS resolves to a known ROUTES value ──
{
  let threw = false;
  let errorMsg = '';
  try {
    validateRealmRoutes(REALM_BUILDINGS);
  } catch (e: any) {
    threw = true;
    errorMsg = e?.message ?? String(e);
  }
  check(
    'REALM-ROUTES: validateRealmRoutes throws no error for REALM_BUILDINGS',
    !threw,
    threw ? errorMsg : '',
  );
}

// ── 2. ROUTES canonical keys have no duplicate path values ───────────────
// Only SCREAMING_SNAKE_CASE keys are checked (e.g. HOME, UNIVERSITY).
// camelCase aliases (tabs, university, summon…) are intentional convenience
// duplicates and are explicitly excluded from this guard.
{
  const isCanonical = (k: string) => /^[A-Z][A-Z0-9_]*$/.test(k);
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const [key, val] of Object.entries(ROUTES) as [string, string][]) {
    if (!isCanonical(key)) continue; // skip camelCase aliases
    if (seen.has(val)) {
      dupes.push(`"${key}" and "${seen.get(val)}" both map to "${val}"`);
    } else {
      seen.set(val, key);
    }
  }
  check(
    'REALM-ROUTES: ROUTES has no duplicate path values',
    dupes.length === 0,
    dupes.join('; '),
  );
}

// ── 3. REALM_BUILDINGS has at least one entry with a linkRoute ────────────
{
  const withRoute = REALM_BUILDINGS.filter(b => b.linkRoute);
  check(
    'REALM-ROUTES: at least one REALM_BUILDING carries a linkRoute',
    withRoute.length > 0,
    `found ${withRoute.length} buildings with a linkRoute`,
  );
}

// ── Summary ───────────────────────────────────────────────────────────────
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('FAILURES:');
  failed.forEach(f => console.log(`  ✗ ${f.name}: ${f.details}`));
  process.exit(1);
}
