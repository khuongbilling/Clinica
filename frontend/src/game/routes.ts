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

// ── Other screens ─────────────────────────────────────────────────────────────
const SUMMON:              AppRoute = "/summon";
const ITEM_BAG:            AppRoute = "/item-bag";
const MEALCRAFT:           AppRoute = "/mealcraft";
const LOTUS_JOURNAL:       AppRoute = "/lotus-journal";
const LOTUS_JOURNAL_LOG:   AppRoute = "/lotus-journal-log";
const LOTUS_JOURNAL_RECIPES: AppRoute = "/lotus-journal-recipes";
const COMPENDIUM:          AppRoute = "/compendium";
const CLASS_TREE:          AppRoute = "/class-tree";
const ECONOMY:             AppRoute = "/economy";
const BAZAAR:              AppRoute = "/bazaar";
const EMBASSY:             AppRoute = "/embassy";
const MILESTONES:          AppRoute = "/milestones";
const ACADEMY_PATH:        AppRoute = "/academy-path";
const MATERIALS:           AppRoute = "/materials";
const LEARNING_PROFILE:    AppRoute = "/learning-profile";
const SHOP:                AppRoute = "/shop";
const SUMMON_CEREMONY:     AppRoute = "/summon";
const TUTORIAL_ENCYCLOPEDIA: AppRoute = "/tutorial-encyclopedia";
const TUTORIAL_CENTER:     AppRoute = "/tutorial-center";
const LOTUS_RECALL:        AppRoute = "/lotus-recall";

/**
 * Static route constants — prefer these over raw string literals in
 * router.push / router.replace calls and in navigation data objects.
 */
export const ROUTES = {
  HOME,
  CODEX,
  HEROES,
  KINGDOM,
  PROFILE,
  SHOP_TAB,

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

  SUMMON,
  ITEM_BAG,
  MEALCRAFT,
  LOTUS_JOURNAL,
  LOTUS_JOURNAL_LOG,
  LOTUS_JOURNAL_RECIPES,
  COMPENDIUM,
  CLASS_TREE,
  ECONOMY,
  BAZAAR,
  EMBASSY,
  MILESTONES,
  ACADEMY_PATH,
  MATERIALS,
  LEARNING_PROFILE,
  SHOP,
  SUMMON_CEREMONY,
  TUTORIAL_ENCYCLOPEDIA,
  TUTORIAL_CENTER,
  LOTUS_RECALL,
} as const;

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
