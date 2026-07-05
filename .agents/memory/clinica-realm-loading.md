---
name: Clinica asset preloading (Realm loading screen + launch tab preload)
description: Why the Realm was slow, the durable constraints of image preloading, and the two-tier preload design.
---

# Asset preloading (Realm loading screen + launch-time tab preload)

**Root cause of Realm slowness:** `/kingdom` fetches + decodes ~21MB of PNGs on mount (terrain
textures used as SVG pattern fills + building sprites). Uncached first visit = visible lag. Any new
realm image should be added to the preload list so it's warmed too.

**Loading screen visual:** shows ONE random comedic splash illustration per mount
(`loadingArt.ts` LOADING_ART / randomLoadingArt) in a contained square card sized to fit
portrait+landscape without cropping, with the rotating tip + label overlaid on an
expo-linear-gradient scrim. Replaced the old parchment-scroll design (parchment asset kept but
dropped from REALM_IMAGE_MODULES since nothing renders it now). LOADING_ART is warmed at launch via
preloadTabAssets, but on a truly cold first launch the illustration still fades in via expo-image.

**Web cache gotcha (the real "empty then slowly loads" cause):** expo-image's `Image.prefetch`
warms ONLY expo-image's own cache. The Realm paints terrain via react-native-svg `<image>` and
buildings via RN `<Image>` — both read the browser's NATIVE image cache, which prefetch does NOT
populate. So on web, `prefetchModules` must decode each URI through a real `HTMLImageElement`
(`new window.Image()` + `img.decode()`), which is the exact cache those elements use. Skip
expo-image.prefetch on web (redundant double-download); keep it for native. Wrap the web decode in
`Promise.race([decodeAll, 12s ceiling])` so a slow/huge asset can never hang the loading gate —
`decodeInBrowser` resolves on load/error/catch (never rejects) and the timeout always resolves, so
`preloadRealmAssets().finally(...)` is guaranteed to progress. **Why:** without this the gate
resolved (prefetch done) but SVG/RN tiles were still uncached, so the map showed blank then filled.

**Two-tier preload design:**
- `prefetchModules(modules)` in `realmAssets.ts` is the single shared best-effort helper
  (resolve require()→uri via RNImage.resolveAssetSource; web = HTMLImageElement decode w/ ceiling,
  native = expo-image Image.prefetch). Reuse it.
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
