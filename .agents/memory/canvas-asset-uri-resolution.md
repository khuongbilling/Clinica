---
name: Canvas asset URI resolution on Expo web
description: How to get a web-accessible URL from a Metro require() module number for use in HTMLCanvasElement drawImage() calls.
---

# Canvas asset URI resolution on Expo web

## Rule

`Image.resolveAssetSource(moduleNumber)` from `react-native` is **NOT implemented** in react-native-web. It throws `"resolveAssetSource is not a function"` (or `"RNImage.default.resolveAssetSource is not a function"` depending on transpilation) on Expo web.

Use **`expo-asset`'s `Asset.fromModule()`** instead:

```typescript
import { Asset } from 'expo-asset';

async function loadBundledImage(source: number): Promise<HTMLImageElement> {
  const asset = Asset.fromModule(source);
  if (!asset.uri) await asset.downloadAsync(); // guarantees uri is set
  const uri = asset.uri ?? '';
  const img = new window.Image();
  img.src = uri;
  // ...
}
```

**Why:** `expo-asset` has its own cross-platform `resolveAssetSource` that works in the Metro web dev server. The `react-native` version calls into native asset registry APIs absent on web.

## How to apply

- Any code that needs a URL string from a `require()` image module for non-`Image`/non-`expo-image` use (canvas drawImage, fetch, etc.) must go through `expo-asset`.
- `expo-asset` IS installed as a transitive Expo dependency — no extra install needed.
- `asset.uri` may be null before `downloadAsync()` on native; on web it is typically available immediately, but calling `downloadAsync()` first is safe and guarantees it.
- Raw URI strings like `'/assets/...'` return 404 in the Metro dev server — Metro does NOT mount a static file server for `public/`. Use `require()` + `Asset.fromModule` for all canvas image loading.

## Related

- `metro-public-dir.md` — Metro dev server never serves `public/`; all bundled assets must use `require()`.
- Fog canvas drawing: `fogBase.ts` and `fogMid.ts` both use this pattern for `loadBundledImage`.
