import { HERO_SPRITE_MODULES } from "@/src/components/HeroSprites";
import { HERO_BATTLE_SPRITE_MODULES } from "@/src/components/HeroBattleSprites";
import { REALM_IMAGE_MODULES, prefetchModules } from "@/src/game/realmAssets";

// Every image rendered across the five bottom tabs (Shop, Heroes, Shift, Realm,
// Faction). Warmed once at game start so switching between tabs is instant
// instead of each tab decoding its art on first open.
const TAB_IMAGE_MODULES: number[] = [
  require("../../assets/images/home_hub_bg.png"), // Shift — hub background
  ...HERO_SPRITE_MODULES,        // Shift lead-hero portrait + Heroes lists
  ...HERO_BATTLE_SPRITE_MODULES, // Heroes tab — battle sprite cards
  ...REALM_IMAGE_MODULES,        // Realm — terrain + buildings + loading art
];

let preloadPromise: Promise<void> | null = null;

// Warm the cache for all bottom-tab images. Idempotent (single shared promise),
// best-effort (never throws). Fire-and-forget at app launch.
export function preloadTabAssets(): Promise<void> {
  if (!preloadPromise) preloadPromise = prefetchModules(TAB_IMAGE_MODULES);
  return preloadPromise;
}
