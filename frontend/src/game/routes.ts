/**
 * Clinica — Typed Route Constants
 *
 * Single source of truth for all navigation destinations in the app.
 * Expo Router's `typedRoutes: true` (set in app.json) validates `Href` values
 * against the file-system at build time, so any renamed or deleted route
 * causes a compile-time error rather than a silent runtime dead-end.
 *
 * Usage:
 *   import { ROUTES, dynRoute } from "@/src/game/routes";
 *   router.push(ROUTES.UNIVERSITY);
 *   router.push(dynRoute.lotusLesson(node.id));
 *
 * Data interfaces that carry route strings (ChapterPart.route, ModeCardDef.route,
 * etc.) should use the `AppRoute` alias exported below.
 */

import type { Href } from "expo-router";

// Re-export as a convenience alias so data files can import a short name.
export type AppRoute = Href;

// ── Tab routes ──────────────────────────────────────────────────────────────
const HOME:       AppRoute = "/(tabs)";
const CODEX:      AppRoute = "/(tabs)/codex";
const HEROES:     AppRoute = "/(tabs)/heroes";
const KINGDOM:    AppRoute = "/(tabs)/kingdom";
const PROFILE:    AppRoute = "/(tabs)/profile";
const SHOP_TAB:   AppRoute = "/(tabs)/shop";
const FACTION:    AppRoute = "/(tabs)/faction";

// ── Core gameplay ────────────────────────────────────────────────────────────
const BATTLE:          AppRoute = "/battle";
const MISSION_LOADOUT: AppRoute = "/mission-loadout";
const SHIFT:           AppRoute = "/shift";
const SHIFT_CASES:     AppRoute = "/shift-cases";
const BOSS:            AppRoute = "/boss";
const WARD_DEFENSE:    AppRoute = "/ward-defense";
const JOURNEY:         AppRoute = "/journey";
const EVENTS:          AppRoute = "/events";
const WORLD_EVENT:     AppRoute = "/world-event";
const RESULT:          AppRoute = "/result";
const PROLOGUE:        AppRoute = "/prologue";
const ONBOARDING:      AppRoute = "/onboarding";
const REMINISCENCE:    AppRoute = "/reminiscence";
const POST_RECALL:     AppRoute = "/post-recall";
const STORY_SCENE:     AppRoute = "/story-scene";

// ── University ───────────────────────────────────────────────────────────────
const UNIVERSITY:             AppRoute = "/university";
const UNI_LESSONS:            AppRoute = "/university/lessons";
const UNI_RECRUIT:            AppRoute = "/university/recruit";
const UNI_TRAINING:           AppRoute = "/university/training";
const UNI_PRACTICE:           AppRoute = "/university/practice";
const UNI_CUE_HUNT:           AppRoute = "/university/cue-hunt";
const UNI_RAPID_TRIAGE:       AppRoute = "/university/rapid-triage";
const UNI_STABILIZE_STACK:    AppRoute = "/university/stabilize-stack";
const UNI_CUE_LAB:            AppRoute = "/university/cue-lab";
const UNI_TRIAGE_HALL:        AppRoute = "/university/triage-hall";
const UNI_STACK_LAB:          AppRoute = "/university/stack-lab";
const UNI_SKILL_ACADEMY:      AppRoute = "/university/skill-academy";
const UNI_MILESTONES:         AppRoute = "/university/uni-milestones";
const UNI_SHOP:               AppRoute = "/university/uni-shop";
const UNI_CUE_HUNT_LESSON:      AppRoute = "/university/cue-hunt-lesson";
const UNI_APPLY_IT:             AppRoute = "/university/apply-it";
const UNI_TRIAGE_LESSON:        AppRoute = "/university/triage-lesson";
const UNI_STABILIZE_LESSON:     AppRoute = "/university/stabilize-lesson";
const UNI_STABILIZE_PLACEHOLDER: AppRoute = "/university/stabilize-placeholder";
const UNI_STABILIZE_COMPLETE:   AppRoute = "/university/stabilize-complete";
const UNI_TRIAGE_COMPLETE:      AppRoute = "/university/triage-complete";
const UNI_CAREER_EXPLORER:      AppRoute = "/university/career-explorer";
const UNI_SCHOOLS:              AppRoute = "/university/schools";

// ── Other screens ─────────────────────────────────────────────────────────────
const TITLE:               AppRoute = "/title";
const PRELOADER:           AppRoute = "/preloader";
const TUTORIAL:            AppRoute = "/tutorial";
const TUTORIAL_CENTER:     AppRoute = "/tutorial-center";
const TUTORIAL_ENCYCLOPEDIA: AppRoute = "/tutorial-encyclopedia";
const CLASS_TREE:          AppRoute = "/class-tree";
const CLASS_RESULT:        AppRoute = "/class-result";
const HERO_SELECT:         AppRoute = "/hero-select";
const SUMMON:              AppRoute = "/summon";
const ITEM_BAG:            AppRoute = "/item-bag";
const MEALCRAFT:           AppRoute = "/mealcraft";
const LOTUS_JOURNAL:       AppRoute = "/lotus-journal";
const LOTUS_JOURNAL_LOG:   AppRoute = "/lotus-journal-log";
const LOTUS_JOURNAL_RECIPES: AppRoute = "/lotus-journal-recipes";
const COMPENDIUM:          AppRoute = "/compendium";
const ECONOMY:             AppRoute = "/economy";
const BAZAAR:              AppRoute = "/bazaar";
const EMBASSY:             AppRoute = "/embassy";
const MILESTONES:          AppRoute = "/milestones";
const ACADEMY_PATH:        AppRoute = "/academy-path";
const MATERIALS:           AppRoute = "/materials";
const LEARNING_PROFILE:    AppRoute = "/learning-profile";
const SHOP:                AppRoute = "/shop";
const SUMMON_CEREMONY:     AppRoute = "/summon";
const LOTUS_RECALL:        AppRoute = "/lotus-recall";
const OPENING_PROLOGUE:    AppRoute = "/opening-prologue"    as AppRoute;
const DEV_PROLOGUE_TESTER: AppRoute = "/dev-prologue-tester" as AppRoute;

/**
 * Static route constants — prefer these over raw string literals in
 * router.push / router.replace calls and in navigation data objects.
 *
 * Two naming conventions are exported for backwards compatibility:
 *   UPPERCASE (canonical, preferred for new code): ROUTES.UNIVERSITY
 *   camelCase (aliases, supported in existing code): ROUTES.university
 */
export const ROUTES = {
  // ── Tabs ──────────────────────────────────────────────────────────────────
  HOME,
  CODEX,
  HEROES,
  KINGDOM,
  PROFILE,
  SHOP_TAB,
  FACTION,

  // ── Core gameplay ──────────────────────────────────────────────────────────
  BATTLE,
  MISSION_LOADOUT,
  SHIFT,
  SHIFT_CASES,
  BOSS,
  WARD_DEFENSE,
  JOURNEY,
  EVENTS,
  WORLD_EVENT,
  RESULT,
  PROLOGUE,
  ONBOARDING,
  REMINISCENCE,
  POST_RECALL,
  STORY_SCENE,

  // ── University ────────────────────────────────────────────────────────────
  UNIVERSITY,
  UNI_LESSONS,
  UNI_RECRUIT,
  UNI_TRAINING,
  UNI_PRACTICE,
  UNI_CUE_HUNT,
  UNI_RAPID_TRIAGE,
  UNI_STABILIZE_STACK,
  UNI_CUE_LAB,
  UNI_TRIAGE_HALL,
  UNI_STACK_LAB,
  UNI_SKILL_ACADEMY,
  UNI_MILESTONES,
  UNI_SHOP,
  UNI_CUE_HUNT_LESSON,
  UNI_APPLY_IT,
  UNI_TRIAGE_LESSON,
  UNI_STABILIZE_LESSON,
  UNI_STABILIZE_PLACEHOLDER,
  UNI_STABILIZE_COMPLETE,
  UNI_TRIAGE_COMPLETE,
  UNI_CAREER_EXPLORER,
  UNI_SCHOOLS,

  // ── Other screens ─────────────────────────────────────────────────────────
  TITLE,
  PRELOADER,
  TUTORIAL,
  TUTORIAL_CENTER,
  TUTORIAL_ENCYCLOPEDIA,
  CLASS_TREE,
  CLASS_RESULT,
  HERO_SELECT,
  SUMMON,
  ITEM_BAG,
  MEALCRAFT,
  LOTUS_JOURNAL,
  LOTUS_JOURNAL_LOG,
  LOTUS_JOURNAL_RECIPES,
  COMPENDIUM,
  ECONOMY,
  BAZAAR,
  EMBASSY,
  MILESTONES,
  ACADEMY_PATH,
  MATERIALS,
  LEARNING_PROFILE,
  SHOP,
  SUMMON_CEREMONY,
  LOTUS_RECALL,

  // ── camelCase aliases (for files migrated before the uppercase convention) ─
  tabs:             HOME,
  tabHome:          HOME,
  tabCodex:         CODEX,
  tabHeroes:        HEROES,
  tabShop:          SHOP_TAB,
  tabKingdom:       KINGDOM,
  tabProfile:       PROFILE,
  tabFaction:       FACTION,

  title:                TITLE,
  preloader:            PRELOADER,
  onboarding:           ONBOARDING,
  university:           UNIVERSITY,
  battle:               BATTLE,
  shift:                SHIFT,
  shiftCases:           SHIFT_CASES,
  result:               RESULT,
  prologue:             PROLOGUE,
  tutorial:             TUTORIAL,
  tutorialCenter:       TUTORIAL_CENTER,
  tutorialEncyclopedia: TUTORIAL_ENCYCLOPEDIA,
  wardDefense:          WARD_DEFENSE,
  boss:                 BOSS,
  worldEvent:           WORLD_EVENT,
  summon:               SUMMON,
  journey:              JOURNEY,
  academyPath:          ACADEMY_PATH,
  classTree:            CLASS_TREE,
  classResult:          CLASS_RESULT,
  economy:              ECONOMY,
  bazaar:               BAZAAR,
  embassy:              EMBASSY,
  events:               EVENTS,
  lotusJournal:         LOTUS_JOURNAL,
  lotusJournalLog:      LOTUS_JOURNAL_LOG,
  lotusJournalRecipes:  LOTUS_JOURNAL_RECIPES,
  lotusRecall:          LOTUS_RECALL,
  mealcraft:            MEALCRAFT,
  reminiscence:         REMINISCENCE,
  postRecall:           POST_RECALL,
  storyScene:           STORY_SCENE,
  materials:            MATERIALS,
  milestones:           MILESTONES,
  itemBag:              ITEM_BAG,
  heroSelect:           HERO_SELECT,
  missionLoadout:       MISSION_LOADOUT,
  shop:                 SHOP,
  compendium:           COMPENDIUM,
  learningProfile:      LEARNING_PROFILE,
  modeWardDefense:      "/mode/ward-defense" as AppRoute,
  modeWardShift:        "/mode/ward-shift"   as AppRoute,

  universityLessons:              UNI_LESSONS,
  universityRecruit:              UNI_RECRUIT,
  universityTraining:             UNI_TRAINING,
  universityPractice:             UNI_PRACTICE,
  universitySkillAcademy:         UNI_SKILL_ACADEMY,
  universityCareerExplorer:       UNI_CAREER_EXPLORER,
  universitySchools:              UNI_SCHOOLS,
  universityCueHunt:              UNI_CUE_HUNT,
  universityCueHuntLesson:        UNI_CUE_HUNT_LESSON,
  universityRapidTriage:          UNI_RAPID_TRIAGE,
  universityTriageLesson:         UNI_TRIAGE_LESSON,
  universityTriageComplete:       UNI_TRIAGE_COMPLETE,
  universityStabilizeStack:       UNI_STABILIZE_STACK,
  universityStabilizeLesson:      UNI_STABILIZE_LESSON,
  universityStabilizePlaceholder: UNI_STABILIZE_PLACEHOLDER,
  universityStabilizeComplete:    UNI_STABILIZE_COMPLETE,
  universityApplyIt:              UNI_APPLY_IT,
  universityCueLab:               UNI_CUE_LAB,
  universityTriageHall:           UNI_TRIAGE_HALL,
  universityStackLab:             UNI_STACK_LAB,
  universityUniMilestones:        UNI_MILESTONES,
  universityUniShop:              UNI_SHOP,
  universityLotusLessonHydration: "/university/lotus-lesson/recognizing-cues-hydration" as AppRoute,

  // ── Prologue ───────────────────────────────────────────────────────────────
  OPENING_PROLOGUE,
  openingPrologue:    OPENING_PROLOGUE,
  // Dev-only scene jumper — not reachable in production builds.
  DEV_PROLOGUE_TESTER,
  devPrologueTester:  DEV_PROLOGUE_TESTER,
} as const;

/**
 * Dev-mode validator: checks that every realm building's linkRoute is a known
 * ROUTES value. Called once at app startup from _layout.tsx so stale strings
 * surface immediately rather than silently producing dead navigation.
 * Throws in __DEV__ if any route is unrecognised; warns in production.
 */
export function validateRealmRoutes(
  buildings: ReadonlyArray<{ id?: string; linkRoute?: string }>
): void {
  const knownRoutes = new Set<string>(Object.values(ROUTES) as string[]);
  const bad: string[] = [];
  for (const b of buildings) {
    if (b.linkRoute && !knownRoutes.has(b.linkRoute)) {
      bad.push(`${b.id ?? '?'}: "${b.linkRoute}"`);
    }
  }
  if (bad.length > 0) {
    const msg = `validateRealmRoutes: unknown linkRoutes — ${bad.join(', ')}`;
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      throw new Error(msg);
    }
    console.warn(msg);
  }
}

/**
 * Helpers for dynamic (parameterised) routes.
 * These return `AppRoute` so call sites stay type-safe without `as any`.
 */
export const dynRoute = {
  mode:        (id: string): AppRoute => `/mode/${id}` as AppRoute,
  hero:        (id: string): AppRoute => `/hero/${id}` as AppRoute,
  lotusLesson: (nodeId: string): AppRoute => `/university/lotus-lesson/${nodeId}` as AppRoute,
  lesson:      (id: string): AppRoute => `/university/lesson/${id}` as AppRoute,
  shopSection: (id: string): AppRoute => `/shop-section/${id}` as AppRoute,
  storyScene:  (sceneId: string): AppRoute => `/story-scene?sceneId=${sceneId}` as AppRoute,
  simulation:  (id: string): AppRoute => `/university/simulation/${id}` as AppRoute,
  department:  (id: string): AppRoute => `/university/department/${id}` as AppRoute,
} as const;
