import { HERO_SPRITE_MODULES } from "@/src/components/HeroSprites";
import { HERO_PORTRAIT_MODULES } from "@/src/components/HeroPortraits";
import { HERO_BATTLE_SPRITE_MODULES } from "@/src/components/HeroBattleSprites";
import { REALM_IMAGE_MODULES, prefetchModules } from "@/src/game/realmAssets";
// Every image rendered across the five bottom tabs (Journey, Heroes, Sanctuary,
// Inventory, Shop). Warmed once at game start so switching between tabs appears instantly.
const TAB_IMAGE_MODULES: number[] = [
  require("../../assets/images/home_hub_bg_v4.png"), // hub background
  // Tab icon PNGs — warmed so the bar renders instantly on cold launch
  require("../../assets/ui-icons/tab-journey.png"),   // follow-up task: Task #469 or new icon-pack task — replace with final asset once icon set ships
  require("../../assets/ui-icons/tab-heroes.png"),
  require("../../assets/ui-icons/tab-realm.png"),     // Sanctuary tab icon
  require("../../assets/ui-icons/tab-inventory.png"), // follow-up task: Task #469 or new icon-pack task — replace with final asset once icon set ships
  require("../../assets/ui-icons/tab-shop.png"),
  ...HERO_SPRITE_MODULES,        // Legacy full-body portraits
  ...(HERO_PORTRAIT_MODULES as unknown as number[]), // Bust portraits — collection + gacha cards
  ...HERO_BATTLE_SPRITE_MODULES, // Heroes tab — battle sprite cards
  ...REALM_IMAGE_MODULES,        // Realm — terrain + buildings
];

let preloadPromise: Promise<void> | null = null;

// Warm the cache for all bottom-tab images. Idempotent (single shared promise),
// best-effort (never throws). Fire-and-forget at app launch.
export function preloadTabAssets(): Promise<void> {
  if (!preloadPromise) preloadPromise = prefetchModules(TAB_IMAGE_MODULES);
  return preloadPromise;
}
