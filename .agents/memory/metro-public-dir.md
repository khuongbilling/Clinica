---
name: Metro web public dir
description: Metro dev server (Expo SDK 54) does NOT serve frontend/public/ at runtime — URI paths return 404. All bundled assets must use require().
---

# Metro web — public/ is not served in dev

## Rule
`frontend/public/` is NOT served by the Metro dev server at any path.
`{ uri: '/assets/ui/...' }` image sources return 404 in development.

**All assets that need to render in the app must live in `frontend/assets/`
and be loaded via static `require()`.**

**Why:** Metro bundles assets at build time via static require() analysis.
It does not mount a static file server for `public/` the way Webpack/Next.js does.
The `public/` directory is only meaningful for Expo's web *export* build output.

**How to apply:**
- Place new image/audio/font assets in `frontend/assets/`, not `frontend/public/`.
- Each require() must be a static string literal — no dynamic paths.
- For large asset families, create a typed index file (see task #539 pattern)
  with one explicit require() per file so Metro can resolve them all.
- The `frontend/public/` copies of journey assets can be left in place
  (they're harmless and serve the eventual production web export),
  but the canonical source for bundling is `frontend/assets/ui/journey/`.
