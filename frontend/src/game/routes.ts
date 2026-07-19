// Route constants — single source of truth for every app route string used
// outside of the router itself (e.g. building deep-links in realm.ts).
//
// WHY THIS FILE EXISTS
// ─────────────────────
// `linkRoute` strings in realm.ts were plain literals completely decoupled from
// the actual file-based route files under frontend/app/.  Renaming or moving
// a screen would silently break every building that linked to it.
//
// HOW TO USE
// ──────────
// • Import the constant you need (e.g. `ROUTES.university`) rather than
//   writing the path string inline.
// • When a route file is renamed/moved, update the constant here — TypeScript
//   will flag every import site that uses the old name.
// • Add a new constant here whenever a new route is added to frontend/app/.
//
// VALIDATION
// ──────────
// `validateRealmRoutes()` at the bottom of this file can be called at app
// startup (or in a test) to assert that every route referenced by a realm
// building actually exists in the KNOWN_ROUTES set.  Import and call it once
// from your app entry point to catch stale strings at runtime.

// ---------------------------------------------------------------------------
// Route map
// ---------------------------------------------------------------------------
export const ROUTES = {
  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabHome:          "/(tabs)/index"         as const,
  tabCodex:         "/(tabs)/codex"         as const,
  tabHeroes:        "/(tabs)/heroes"        as const,
  tabShop:          "/(tabs)/shop"          as const,
  tabKingdom:       "/(tabs)/kingdom"       as const,
  tabProfile:       "/(tabs)/profile"       as const,
  tabFaction:       "/(tabs)/faction"       as const,

  // ── Top-level screens ─────────────────────────────────────────────────────
  title:                "/title"                    as const,
  preloader:            "/preloader"                as const,
  onboarding:           "/onboarding"               as const,
  university:           "/university"               as const,
  battle:               "/battle"                   as const,
  shift:                "/shift"                    as const,
  shiftCases:           "/shift-cases"              as const,
  result:               "/result"                   as const,
  prologue:             "/prologue"                 as const,
  tutorial:             "/tutorial"                 as const,
  tutorialCenter:       "/tutorial-center"          as const,
  tutorialEncyclopedia: "/tutorial-encyclopedia"    as const,
  wardDefense:          "/ward-defense"             as const,
  boss:                 "/boss"                     as const,
  worldEvent:           "/world-event"              as const,
  summon:               "/summon"                   as const,
  journey:              "/journey"                  as const,
  academyPath:          "/academy-path"             as const,
  classTree:            "/class-tree"               as const,
  classResult:          "/class-result"             as const,
  economy:              "/economy"                  as const,
  bazaar:               "/bazaar"                   as const,
  embassy:              "/embassy"                  as const,
  events:               "/events"                   as const,
  lotusJournal:         "/lotus-journal"            as const,
  lotusJournalLog:      "/lotus-journal-log"        as const,
  lotusJournalRecipes:  "/lotus-journal-recipes"    as const,
  lotusRecall:          "/lotus-recall"             as const,
  mealcraft:            "/mealcraft"                as const,
  reminiscence:         "/reminiscence"             as const,
  postRecall:           "/post-recall"              as const,
  storyScene:           "/story-scene"              as const,
  materials:            "/materials"                as const,
  milestones:           "/milestones"               as const,
  itemBag:              "/item-bag"                 as const,
  heroSelect:           "/hero-select"              as const,
  missionLoadout:       "/mission-loadout"          as const,
  shop:                 "/shop"                     as const,
  compendium:           "/compendium"               as const,
  learningProfile:      "/learning-profile"         as const,
} as const;

export type AppRoute = typeof ROUTES[keyof typeof ROUTES];

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------
// Call this once at app startup (or in a jest/vitest test) to catch stale
// linkRoute strings before they reach a user.  It checks that every
// linkRoute in the REALM_BUILDINGS catalog is present in ROUTES.
//
// Usage (e.g. in frontend/app/_layout.tsx):
//
//   import { validateRealmRoutes } from "../src/game/routes";
//   import { REALM_BUILDINGS } from "../src/game/realm";
//   validateRealmRoutes(REALM_BUILDINGS);   // throws in dev if a route is missing

const KNOWN_ROUTES = new Set<string>(Object.values(ROUTES));

export function validateRealmRoutes(
  buildings: { id: string; linkRoute?: string }[]
): void {
  const broken: string[] = [];
  for (const b of buildings) {
    if (b.linkRoute && !KNOWN_ROUTES.has(b.linkRoute)) {
      broken.push(`  building "${b.id}" → linkRoute "${b.linkRoute}" not found in ROUTES`);
    }
  }
  if (broken.length > 0) {
    const msg =
      `[Clinica] realm building deep-link(s) point to unknown routes:\n${broken.join("\n")}\n` +
      `Update the linkRoute value OR add the route to frontend/src/game/routes.ts`;
    if (__DEV__) {
      console.error(msg);
    }
    throw new Error(msg);
  }
}
