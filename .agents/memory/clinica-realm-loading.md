---
name: Clinica Realm loading screen
description: Why the Realm was slow to open and the durable constraints of its loading screen.
---

# Realm loading screen + asset preload

**Root cause of Realm slowness:** `/kingdom` fetches + decodes ~21MB of PNGs on mount (terrain
textures used as SVG pattern fills + building sprites). Uncached first visit = visible lag. Any new
realm image should be added to the preload list so it's warmed too.

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
