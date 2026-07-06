// Single entry point that warms EVERY image the game needs — heroes, realm,
// battle stages, enemies, and loading art — so gameplay never paints a blank
// frame waiting on a large PNG to decode. Called from the full-page preloader
// screen after the player taps "Start Game". Idempotent: the work runs once and
// subsequent callers await the same promise.
import { prefetchModules, REALM_IMAGE_MODULES } from "@/src/game/realmAssets";
import { preloadTabAssets } from "@/src/game/tabAssets";
import { HERO_SPRITE_MODULES } from "@/src/components/HeroSprites";
import { HERO_BATTLE_SPRITE_MODULES } from "@/src/components/HeroBattleSprites";
import { BATTLE_IMAGE_MODULES } from "@/src/game/battleAssets";
import { LOADING_ART } from "@/src/game/loadingArt";

const ALL_MODULES: number[] = [
  ...(HERO_SPRITE_MODULES as unknown as number[]),
  ...(HERO_BATTLE_SPRITE_MODULES as unknown as number[]),
  ...(REALM_IMAGE_MODULES as unknown as number[]),
  ...BATTLE_IMAGE_MODULES,
  ...LOADING_ART,
];

let inflight: Promise<void> | null = null;

export function preloadAllGameAssets(): Promise<void> {
  if (!inflight) {
    inflight = Promise.all([
      prefetchModules(ALL_MODULES),
      // Tab backgrounds live in tabAssets; run its warmer too for full coverage.
      Promise.resolve(preloadTabAssets()).catch(() => undefined),
    ]).then(() => undefined);
  }
  return inflight;
}
