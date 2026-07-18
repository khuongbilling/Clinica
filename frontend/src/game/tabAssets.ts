import { HERO_SPRITE_MODULES } from "@/src/components/HeroSprites";
import { HERO_BATTLE_SPRITE_MODULES } from "@/src/components/HeroBattleSprites";
import { REALM_IMAGE_MODULES, prefetchModules } from "@/src/game/realmAssets";
import { CHAPTER_MAP_BG_MODULES } from "@/src/game/illustratedAssets";

// Every image rendered across the five bottom tabs (Shop, Heroes, Shift, Realm,
// Faction) plus the Journey Map chapter backgrounds. Warmed once at game start
// so switching between tabs and opening chapter maps appears instantly.
const TAB_IMAGE_MODULES: number[] = [
  require("../../assets/images/home_hub_bg.png"), // Shift — hub background
  ...HERO_SPRITE_MODULES,        // Shift lead-hero portrait + Heroes lists
  ...HERO_BATTLE_SPRITE_MODULES, // Heroes tab — battle sprite cards
  ...REALM_IMAGE_MODULES,        // Realm — terrain + buildings
  ...CHAPTER_MAP_BG_MODULES,     // Journey Map — V3 illustrated chapter backgrounds
];

let preloadPromise: Promise<void> | null = null;

// Warm the cache for all bottom-tab images. Idempotent (single shared promise),
// best-effort (never throws). Fire-and-forget at app launch.
export function preloadTabAssets(): Promise<void> {
  if (!preloadPromise) preloadPromise = prefetchModules(TAB_IMAGE_MODULES);
  return preloadPromise;
}
