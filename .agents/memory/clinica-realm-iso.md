---
name: Clinica Realm 2.5D isometric render
description: How the Realm/Sanctuary base-builder is drawn as faux-isometric 3D, and the native-dep install trap that broke react-native-svg.
---

# 2.5D iso realm rendering
The Realm builder (`frontend/app/(tabs)/kingdom.tsx`) renders the square grid as a
faux-isometric scene WITHOUT changing grid/builder logic in `realmGrid.ts`.
- Projection math lives in `frontend/src/game/realmIso.ts` (`project`, `cellCenterIso`, `footprintIso`, `cellDepth`). x=(v-u)*hw+originX, y=(v+u)*hh+topPad, hw=24, hh=12.
- Ground is ONE `react-native-svg` scene (`IsoTerrain.tsx`): each cell is an iso cube = top diamond (corners A/B/C/D) + left/right side faces extruded DOWNWARD by BLOCK_H.
- **Rule:** extrude only downward so the top face stays exactly on the old flat-tile plane; otherwise `footprintIso().bottom.y` anchoring for `IsoBuildingSprite` billboards drifts.
- Terrain variation & scatter objects (grass tufts/flowers/pebbles) use a deterministic per-cell PRNG seeded from (row,col) so they're stable across re-renders (no flicker).
- SVG has `pointerEvents="none"`; taps still work via the separate transparent `Pressable` hit-target layer drawn on top (also holds locked badges + decoration icons).

# react-native-svg on Expo 54 + React 19
- Its 15.x bundled typings fail tsc under React 19 with "cannot be used as a JSX component". Fix: `import * as RNSvg` then cast each primitive `as unknown as React.ComponentType<any>`. Runtime is unaffected.

# NATIVE-DEP INSTALL TRAP (cost hours)
Installing a package for the Expo app misfired badly. Symptoms + the checklist:
- **Why:** this repo has a TRACKED root `package.json`/`package-lock.json` (name "workspace", NOT a real npm workspace). Running an installer from repo root (or a tool that picks root) hoists the dep into root `node_modules` + pollutes root `package.json` with the dep's peer versions (expo/react-native), and/or drops a BROKEN PARTIAL copy in `frontend/node_modules` (missing `lib/commonjs/index.js`) that SHADOWS everything. Metro then reports "Unable to resolve react-native-svg".
- **How to apply — after installing any RN/native dep for the frontend, verify ALL of:**
  1. Complete copy in `frontend/node_modules/<pkg>` — check `lib/commonjs/index.js` AND `src/index.ts` exist; `require.resolve` from `frontend/` points INSIDE frontend, not repo root.
  2. Listed in `frontend/package.json` deps AND in BOTH `frontend/package-lock.json` and `frontend/yarn.lock` (use `npm install --package-lock-only --legacy-peer-deps` in frontend to fix the lockfile without touching node_modules; npm needs `--legacy-peer-deps` here).
  3. Root `package.json`/`package-lock.json` NOT modified — restore with `git show HEAD:package.json > package.json` if polluted.
  4. Clear Metro cache (`rm -rf /tmp/metro-file-map-*`) and restart the workflow; confirm the entry.bundle returns JS (HTTP 200) not an error JSON.
