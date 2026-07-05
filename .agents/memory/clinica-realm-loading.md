---
name: Clinica asset preloading (Realm loading screen + launch tab preload)
description: Why the Realm was slow, the durable constraints of image preloading, and the two-tier preload design.
---

# Asset preloading (Realm loading screen + launch-time tab preload)

**Root cause of Realm slowness:** `/kingdom` fetches + decodes ~21MB of PNGs on mount (terrain
textures used as SVG pattern fills + building sprites). Uncached first visit = visible lag. Any new
realm image should be added to the preload list so it's warmed too.

**Two-tier preload design:**
- `prefetchModules(modules)` in `realmAssets.ts` is the single shared best-effort helper
  (resolve require()→uri via RNImage.resolveAssetSource, then expo-image Image.prefetch). Reuse it.
- `preloadTabAssets()` (`tabAssets.ts`) runs once at app launch from `_layout.tsx` useEffect,
  warming EVERY bottom-tab image: home_hub_bg + hero portraits + hero battle sprites + all realm
  modules. Fire-and-forget, memoized module-level promise.
- `preloadRealmAssets()` stays separate so the Realm loading screen has its own awaitable; the two
  promises can double-warm realm images if Realm opens before launch preload finishes, but
  expo-image dedups by URL so it's harmless redundant work, not a bug.
- **Avoid path drift:** pull hero image lists from the existing require maps
  (`HERO_SPRITE_MODULES` = Object.values(SPRITES), `HERO_BATTLE_SPRITE_MODULES`) rather than
  re-typing paths. When new art is added to any tab, append to the exported module map/list.
- SHOP + FACTION currently render no static PNGs (icons/text only) — nothing to preload there yet.

**Durable constraints:**
- expo-asset is NOT installed; warm the image cache with expo-image `Image.prefetch`, resolving
  `require()` modules to URIs via `RNImage.resolveAssetSource(m).uri`. Keep prefetch best-effort —
  it must never block or crash the Realm.
- Render the parchment scroll art with **expo-image**, not RN `<Image>` (RN Image fails silently on
  web here, per the image-rendering memory).
- Animated fades MUST use `useNativeDriver:false` on Expo web or opacity won't animate.
- Any rotating-tip / timeout / animation effect needs a `cancelled` closure flag + `clearTimeout` +
  `fade.stopAnimation()` in cleanup, or you get setState-after-unmount when leaving mid-animation.
- The loader is gated by a module-level "warmed" flag (first open per session only) with a minimum
  display time so at least one tip is readable even when prefetch finishes instantly.

**Gotcha:** expo-image needs a beat to decode the parchment; a screenshot taken immediately after
navigation can catch text-without-scroll — re-screenshot to confirm the art actually paints.
